import path from "node:path";

import { extractChosung, extractJungsung } from "./hangul.js";
import { readGzipJsonSync, resolveSeedDataRoot } from "./resource.js";
import type {
  NameBlock,
  NameCombination,
  NameStatistics,
  StatsRepository,
} from "./types.js";
import { normalizeText } from "./utils.js";

type YearMap = Record<string, unknown>;
type RawStatsRow = Record<string, unknown>;
type RawStatsFile = Record<string, RawStatsRow>;

const CHOSUNG_TO_ENGLISH: Record<string, string> = {
  "\u3131": "g",
  "\u3132": "gg",
  "\u3134": "n",
  "\u3137": "d",
  "\u3138": "dd",
  "\u3139": "r",
  "\u3141": "m",
  "\u3142": "b",
  "\u3143": "bb",
  "\u3145": "s",
  "\u3146": "ss",
  "\u3147": "ng",
  "\u3148": "j",
  "\u3149": "jj",
  "\u314A": "ch",
  "\u314B": "k",
  "\u314C": "t",
  "\u314D": "p",
  "\u314E": "h",
};

const CHOSUNG_ONLY = new Set<string>(Object.keys(CHOSUNG_TO_ENGLISH));
const JUNGSUNG_ONLY = new Set<string>([
  "\u314F",
  "\u3150",
  "\u3151",
  "\u3152",
  "\u3153",
  "\u3154",
  "\u3155",
  "\u3156",
  "\u3157",
  "\u3158",
  "\u3159",
  "\u315A",
  "\u315B",
  "\u315C",
  "\u315D",
  "\u315E",
  "\u315F",
  "\u3160",
  "\u3161",
  "\u3162",
  "\u3163",
]);

function parseYearMap(input: YearMap | undefined): Record<number, number> {
  if (!input) {
    return {};
  }
  const out: Record<number, number> = {};
  for (const [offset, raw] of Object.entries(input)) {
    const key = Number.parseInt(offset, 10);
    if (Number.isNaN(key)) {
      continue;
    }
    const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
    if (!Number.isNaN(value)) {
      out[2000 + key] = value;
    }
  }
  return out;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function isKoreanSyllable(char: string): boolean {
  if (!char || char.length !== 1) {
    return false;
  }
  const code = char.codePointAt(0);
  return code !== undefined && code >= 0xac00 && code <= 0xd7a3;
}

function isKoreanEmpty(block: NameBlock): boolean {
  return block.korean === "_" || block.korean.length === 0;
}

function isCompleteKorean(block: NameBlock): boolean {
  return block.korean.length === 1 && isKoreanSyllable(block.korean);
}

function isChosungOnly(block: NameBlock): boolean {
  return block.korean.length === 1 && CHOSUNG_ONLY.has(block.korean);
}

function isJungsungOnly(block: NameBlock): boolean {
  return block.korean.length === 1 && JUNGSUNG_ONLY.has(block.korean);
}

function matchesFirstBlock(block: NameBlock, name: string): boolean {
  if (name.length === 0) {
    return false;
  }
  const first = Array.from(name)[0] ?? "";
  if (isKoreanEmpty(block)) {
    return true;
  }
  if (isCompleteKorean(block)) {
    return first === block.korean;
  }
  if (isChosungOnly(block)) {
    return extractChosung(first) === block.korean;
  }
  if (isJungsungOnly(block)) {
    return extractJungsung(first) === block.korean;
  }
  return false;
}

function blockMatchesAt(block: NameBlock, nameChar: string, hanjaChar: string): boolean {
  const koreanOk =
    isKoreanEmpty(block) ||
    (isCompleteKorean(block) && block.korean === nameChar) ||
    (isChosungOnly(block) && extractChosung(nameChar) === block.korean) ||
    (isJungsungOnly(block) && extractJungsung(nameChar) === block.korean);

  const hanjaOk = block.hanja.length === 0 || block.hanja === "_" || block.hanja === hanjaChar;
  return koreanOk && hanjaOk;
}

export class InMemoryStatsRepository implements StatsRepository {
  private readonly statsRoot: string;
  private readonly indexMap: Record<string, string[]>;
  private readonly fileCache = new Map<string, RawStatsFile>();
  private readonly nameCache = new Map<string, NameStatistics | null>();

  static create(dataRoot?: string): InMemoryStatsRepository {
    const root = resolveSeedDataRoot(dataRoot);
    const statsRoot = path.join(root, "stats");
    const indexMap = readGzipJsonSync<Record<string, string[]>>(path.join(statsRoot, "chosung_index.json.gz"));
    return new InMemoryStatsRepository(statsRoot, indexMap);
  }

  constructor(statsRoot: string, indexMap: Record<string, string[]>) {
    this.statsRoot = statsRoot;
    this.indexMap = indexMap;
  }

  findByName(nameHangul: string): NameStatistics | null {
    const name = normalizeText(nameHangul);
    if (!name) {
      return null;
    }
    const cached = this.nameCache.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const first = Array.from(name)[0] ?? "";
    const key = CHOSUNG_TO_ENGLISH[extractChosung(first)] ?? "misc";
    const files = this.indexMap[key] ?? [];
    for (const fileId of files) {
      const row = this.loadFile(fileId)[name];
      if (!row) {
        continue;
      }
      const stats: NameStatistics = {
        similarNames: toStringList(row.s),
        totalRankByYear: parseYearMap((row.r as Record<string, YearMap> | undefined)?.t),
        maleRankByYear: parseYearMap((row.r as Record<string, YearMap> | undefined)?.m),
        totalBirthByYear: parseYearMap((row.b as Record<string, YearMap> | undefined)?.t),
        maleBirthByYear: parseYearMap((row.b as Record<string, YearMap> | undefined)?.m),
        hanjaCombinations: toStringList(row.h),
      };
      this.nameCache.set(name, stats);
      return stats;
    }

    this.nameCache.set(name, null);
    return null;
  }

  findNameCombinations(blocks: NameBlock[]): NameCombination[] {
    if (blocks.length === 0) {
      return [];
    }

    const first = blocks[0] as NameBlock;
    const files = this.filesToSearch(first);
    const out: NameCombination[] = [];
    const length = blocks.length;

    for (const fileId of files) {
      const file = this.loadFile(fileId);
      for (const [name, row] of Object.entries(file)) {
        if (Array.from(name).length !== length) {
          continue;
        }
        if (!matchesFirstBlock(first, name)) {
          continue;
        }
        const hanjaList = toStringList(row.h);
        for (const hanja of hanjaList) {
          if (Array.from(hanja).length !== length) {
            continue;
          }
          const nameChars = Array.from(name);
          const hanjaChars = Array.from(hanja);
          let ok = true;
          for (let i = 0; i < length; i += 1) {
            if (!blockMatchesAt(blocks[i] as NameBlock, nameChars[i] ?? "", hanjaChars[i] ?? "")) {
              ok = false;
              break;
            }
          }
          if (ok) {
            out.push({ korean: name, hanja });
          }
        }
      }
    }

    return out;
  }

  private filesToSearch(firstBlock: NameBlock): string[] {
    let key: string | null = null;
    if (isChosungOnly(firstBlock)) {
      key = CHOSUNG_TO_ENGLISH[firstBlock.korean] ?? "misc";
    } else if (isCompleteKorean(firstBlock)) {
      const first = Array.from(firstBlock.korean)[0] ?? "";
      key = CHOSUNG_TO_ENGLISH[extractChosung(first)] ?? "misc";
    }
    if (key !== null) {
      return this.indexMap[key] ?? [];
    }
    const all: string[] = [];
    for (const values of Object.values(this.indexMap)) {
      for (const file of values) {
        all.push(file);
      }
    }
    return all;
  }

  private loadFile(fileId: string): RawStatsFile {
    const cached = this.fileCache.get(fileId);
    if (cached) {
      return cached;
    }
    const parsed = readGzipJsonSync<RawStatsFile>(path.join(this.statsRoot, `stat_${fileId}.gz`));
    this.fileCache.set(fileId, parsed);
    return parsed;
  }
}
