import {
  filesToSearchFromIndexMap,
  resolveIndexKeyFromName,
} from "./stats/index-map.js";
import { blockMatchesAt, matchesFirstBlock } from "./stats/name-block-matcher.js";
import { StatsResourceLoader } from "./stats/resource-loader.js";
import { parseNameStatisticsRow, toStringList } from "./stats/stats-parsers.js";
import type {
  NameBlock,
  NameCombination,
  NameStatistics,
  StatsRepository,
} from "./types.js";
import { normalizeText } from "./utils.js";

export class InMemoryStatsRepository implements StatsRepository {
  private readonly indexMap: Record<string, string[]>;
  private readonly loader: StatsResourceLoader;
  private readonly nameCache = new Map<string, NameStatistics | null>();

  static create(_dataRoot?: string): InMemoryStatsRepository {
    throw new Error(
      "InMemoryStatsRepository is disabled in db-only mode. Use SqliteStatsRepository.create(dbPath).",
    );
  }

  constructor(statsRoot: string, indexMap: Record<string, string[]>) {
    this.indexMap = indexMap;
    this.loader = new StatsResourceLoader(statsRoot);
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

    const files = this.indexMap[resolveIndexKeyFromName(name)] ?? [];
    for (const fileId of files) {
      const row = this.loader.load(fileId)[name];
      if (!row) {
        continue;
      }
      const stats = parseNameStatisticsRow(row);
      this.nameCache.set(name, stats);
      return stats;
    }

    this.nameCache.set(name, null);
    return null;
  }

  findNameCombinations(blocks: NameBlock[], _strokeKeys?: ReadonlySet<string>): NameCombination[] {
    if (blocks.length === 0) {
      return [];
    }

    const first = blocks[0] as NameBlock;
    const files = filesToSearchFromIndexMap(this.indexMap, first);
    const out: NameCombination[] = [];
    const length = blocks.length;

    for (const fileId of files) {
      const file = this.loader.load(fileId);
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
}
