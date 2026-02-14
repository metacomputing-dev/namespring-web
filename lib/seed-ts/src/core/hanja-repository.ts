import { extractChosung, extractJungsung } from "./hangul.js";
import type { Element, HanjaEntry, HanjaRepository } from "./types.js";
import { mapPush, normalizeText } from "./utils.js";

interface Pair {
  korean: string;
  hanja: string;
}

const DEFAULT_STROKE_COUNT = 10;
const EARTH: Element = "土";

function splitPairKey(key: string): Pair | null {
  const idx = key.indexOf("/");
  if (idx <= 0 || idx >= key.length - 1) {
    return null;
  }
  return {
    korean: key.slice(0, idx),
    hanja: key.slice(idx + 1),
  };
}

function buildIndex(entries: readonly HanjaEntry[], keyOf: (entry: HanjaEntry) => string): Map<string, HanjaEntry[]> {
  const out = new Map<string, HanjaEntry[]>();
  for (const entry of entries) {
    mapPush(out, keyOf(entry), entry);
  }
  return out;
}

function toFallback(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
  const hangul = (korean ?? "").trim().slice(0, 1) || "_";
  const h = (hanja ?? "").trim().slice(0, 1) || "_";
  return {
    hangul,
    hanja: h,
    meaning: "",
    strokeCount: DEFAULT_STROKE_COUNT,
    strokeElement: EARTH,
    rootElement: EARTH,
    pronunciationElement: EARTH,
    pronunciationPolarityBit: 0,
    strokePolarityBit: 0,
    radical: "",
    isSurname,
  };
}

export class InMemoryHanjaRepository implements HanjaRepository {
  private readonly nameEntries: HanjaEntry[];
  private readonly surnameEntries: HanjaEntry[];
  private readonly nameByHangul: Map<string, HanjaEntry[]>;
  private readonly surnameByHangul: Map<string, HanjaEntry[]>;
  private readonly nameByHanja: Map<string, HanjaEntry[]>;
  private readonly surnameByHanja: Map<string, HanjaEntry[]>;
  private readonly surnamePairs: Set<string>;

  static create(_dataRoot?: string): InMemoryHanjaRepository {
    throw new Error(
      "InMemoryHanjaRepository is disabled in db-only mode. Use SqliteHanjaRepository.create(dbPath).",
    );
  }

  constructor(nameEntries: HanjaEntry[], surnameEntries: HanjaEntry[], surnamePairs: Set<string>) {
    this.nameEntries = nameEntries;
    this.surnameEntries = surnameEntries;
    this.nameByHangul = buildIndex(nameEntries, (entry) => entry.hangul);
    this.surnameByHangul = buildIndex(surnameEntries, (entry) => entry.hangul);
    this.nameByHanja = buildIndex(nameEntries, (entry) => entry.hanja);
    this.surnameByHanja = buildIndex(surnameEntries, (entry) => entry.hanja);
    this.surnamePairs = surnamePairs;
  }

  getHanjaInfo(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
    const k = (korean ?? "").trim();
    const h = (hanja ?? "").trim();
    const sourceByHangul = isSurname ? this.surnameByHangul : this.nameByHangul;
    const sourceByHanja = isSurname ? this.surnameByHanja : this.nameByHanja;

    if (k && h) {
      const byHangul = sourceByHangul.get(k) ?? [];
      for (const entry of byHangul) {
        if (entry.hanja === h) {
          return entry;
        }
      }
    }
    if (h) {
      const byHanja = sourceByHanja.get(h);
      if (byHanja && byHanja.length > 0) {
        return byHanja[0] as HanjaEntry;
      }
    }
    return toFallback(k || "_", h || "_", isSurname);
  }

  getHanjaStrokeCount(korean: string, hanja: string, isSurname: boolean): number {
    return this.getHanjaInfo(korean, hanja, isSurname).strokeCount;
  }

  getSurnamePairs(surname: string, surnameHanja: string): Pair[] {
    const k = Array.from(normalizeText(surname));
    const h = Array.from(normalizeText(surnameHanja));
    if (k.length <= 1) {
      return [{ korean: k[0] ?? "", hanja: h[0] ?? "" }];
    }
    const out: Pair[] = [];
    for (let i = 0; i < k.length; i += 1) {
      out.push({
        korean: k[i] ?? "",
        hanja: h[i] ?? "",
      });
    }
    return out;
  }

  isSurname(korean: string, hanja: string): boolean {
    const key = `${normalizeText(korean)}/${normalizeText(hanja)}`;
    if (this.surnamePairs.has(key)) {
      return true;
    }
    const pair = splitPairKey(key);
    if (!pair) {
      return false;
    }
    const list = this.surnameByHangul.get(pair.korean) ?? [];
    return list.some((entry) => entry.hanja === pair.hanja);
  }

  findNameByHangul(hangul: string): readonly HanjaEntry[] {
    return this.nameByHangul.get(normalizeText(hangul)) ?? [];
  }

  findNameByHanja(hanja: string): readonly HanjaEntry[] {
    return this.nameByHanja.get(normalizeText(hanja)) ?? [];
  }

  findNameByChosung(chosung: string): readonly HanjaEntry[] {
    const normalized = normalizeText(chosung);
    if (!normalized) {
      return [];
    }
    return this.nameEntries.filter((entry) => extractChosung(entry.hangul) === normalized);
  }

  findNameByJungsung(jungsung: string): readonly HanjaEntry[] {
    const normalized = normalizeText(jungsung);
    if (!normalized) {
      return [];
    }
    return this.nameEntries.filter((entry) => extractJungsung(entry.hangul) === normalized);
  }
}
