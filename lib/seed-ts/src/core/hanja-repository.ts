import path from "node:path";

import { CHOSUNG_ELEMENT, DIGIT_TO_ELEMENT } from "./constants.js";
import { extractChosung, isYangVowel } from "./hangul.js";
import { readGzipLinesSync, readJsonSync, resolveSeedDataRoot } from "./resource.js";
import type { Element, HanjaEntry, HanjaRepository } from "./types.js";
import { mapPush, normalizeText } from "./utils.js";

interface HanjaMetadata {
  files?: Record<string, string>;
}

interface Pair {
  korean: string;
  hanja: string;
}

const DEFAULT_HOEKSU = 10;
const EARTH: Element = "\u571F";

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

function parseRadicals(lines: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) {
      continue;
    }
    out.set(normalizeText(line.slice(0, idx)), normalizeText(line.slice(idx + 1)));
  }
  return out;
}

function toElement(value: string): Element {
  return DIGIT_TO_ELEMENT[value] ?? EARTH;
}

function parseDict(lines: readonly string[], radicals: Map<string, string>, isSurname: boolean): HanjaEntry[] {
  const out: HanjaEntry[] = [];
  for (const line of lines) {
    const idx = line.indexOf(";");
    if (idx < 0) {
      continue;
    }
    const info = line.slice(0, idx);
    const meaning = normalizeText(line.slice(idx + 1));
    if (info.length < 6) {
      continue;
    }
    const hangul = normalizeText(info.slice(0, 1));
    const hanja = normalizeText(info.slice(1, 2));
    const hoeksu = Number.parseInt(info.slice(2, 4), 10);
    if (!hangul || !hanja || Number.isNaN(hoeksu)) {
      continue;
    }

    const strokeElement = toElement(info.slice(4, 5));
    const rootElement = toElement(info.slice(5, 6));
    const pronunciationElement = CHOSUNG_ELEMENT[extractChosung(hangul)] ?? EARTH;
    const pronunciationPolarityBit: 0 | 1 = isYangVowel(hangul) ? 1 : 0;
    const strokePolarityBit: 0 | 1 = Math.abs(hoeksu) % 2 === 0 ? 0 : 1;
    const radical = radicals.get(hanja) ?? "";

    out.push({
      hangul,
      hanja,
      meaning,
      strokeCount: hoeksu,
      strokeElement,
      rootElement,
      pronunciationElement,
      pronunciationPolarityBit,
      strokePolarityBit,
      radical,
      hoeksu,
      hoeksuOhaeng: strokeElement,
      jawonOhaeng: rootElement,
      pronunciationOhaeng: pronunciationElement,
      pronunciationEumyang: pronunciationPolarityBit,
      hoeksuEumyang: strokePolarityBit,
      boosoo: radical,
      isSurname,
    });
  }
  return out;
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
    strokeCount: DEFAULT_HOEKSU,
    strokeElement: EARTH,
    rootElement: EARTH,
    pronunciationElement: EARTH,
    pronunciationPolarityBit: 0,
    strokePolarityBit: 0,
    radical: "",
    hoeksu: DEFAULT_HOEKSU,
    hoeksuOhaeng: EARTH,
    jawonOhaeng: EARTH,
    pronunciationOhaeng: EARTH,
    pronunciationEumyang: 0,
    hoeksuEumyang: 0,
    boosoo: "",
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

  static create(dataRoot?: string): InMemoryHanjaRepository {
    const root = resolveSeedDataRoot(dataRoot);
    const hanjaRoot = path.join(root, "hanja");
    const metadata = readJsonSync<HanjaMetadata>(path.join(hanjaRoot, "metadata.json"));
    const files = metadata.files ?? {};

    const nameRadicals = parseRadicals(
      readGzipLinesSync(path.join(hanjaRoot, files.name_hanja_dict_radicals ?? "name_hanja_dict_radicals.gz")),
    );
    const surnameRadicals = parseRadicals(
      readGzipLinesSync(path.join(hanjaRoot, files.surname_hanja_dict_radicals ?? "surname_hanja_dict_radicals.gz")),
    );

    const nameEntries = parseDict(
      readGzipLinesSync(path.join(hanjaRoot, files.name_hanja_dict ?? "name_hanja_dict.gz")),
      nameRadicals,
      false,
    );
    const surnameEntries = parseDict(
      readGzipLinesSync(path.join(hanjaRoot, files.surname_hanja_dict ?? "surname_hanja_dict.gz")),
      surnameRadicals,
      true,
    );
    const surnamePairs = new Set<string>(
      readGzipLinesSync(path.join(hanjaRoot, files.surname_pairs ?? "surname_pairs.gz")).map((line) =>
        normalizeText(line),
      ),
    );

    return new InMemoryHanjaRepository(nameEntries, surnameEntries, surnamePairs);
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
    const info = this.getHanjaInfo(korean, hanja, isSurname);
    return info.strokeCount || DEFAULT_HOEKSU;
  }

  getHanjaHoeksuCount(korean: string, hanja: string, isSurname: boolean): number {
    return this.getHanjaStrokeCount(korean, hanja, isSurname);
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
}
