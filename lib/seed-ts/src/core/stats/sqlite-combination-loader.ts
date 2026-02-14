import type { SqliteDatabase, SqliteStatement } from "../sqlite-runtime.js";
import type { NameBlock, NameCombination } from "../types.js";
import {
  blockMatchesAt,
  isChosungOnly,
  isCompleteKorean,
  isJungsungOnly,
  isKoreanEmpty,
} from "./name-block-matcher.js";
import {
  combinationCacheKey,
  indexedCombinationCacheKey,
  type SqliteStatsCache,
} from "./sqlite-cache.js";
import { parseCombinationRows, type StatsComboRow } from "./stats-parsers.js";

export interface SqliteCombinationLoaderOptions {
  db: SqliteDatabase;
  selectCombinationsByFileAndLength: SqliteStatement;
  cache: Pick<SqliteStatsCache, "indexedQueryCache" | "indexedCombinationCache" | "combinationCache">;
}

export class SqliteCombinationLoader {
  private readonly db: SqliteDatabase;
  private readonly selectCombinationsByFileAndLength: SqliteStatement;
  private readonly cache: Pick<SqliteStatsCache, "indexedQueryCache" | "indexedCombinationCache" | "combinationCache">;

  constructor(options: SqliteCombinationLoaderOptions) {
    this.db = options.db;
    this.selectCombinationsByFileAndLength = options.selectCombinationsByFileAndLength;
    this.cache = options.cache;
  }

  loadCombinations(fileId: string, length: number): NameCombination[] {
    const cacheKey = combinationCacheKey(fileId, length);
    const cached = this.cache.combinationCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const rows = this.selectCombinationsByFileAndLength.all(fileId, length) as StatsComboRow[];
    const out = parseCombinationRows(rows, length);
    this.cache.combinationCache.set(cacheKey, out);
    return out;
  }

  loadCombinationsIndexed(
    fileId: string,
    blocks: NameBlock[],
    strokeKeys?: ReadonlySet<string>,
  ): NameCombination[] {
    const cacheKey = indexedCombinationCacheKey(fileId, blocks, strokeKeys);
    const cached = this.cache.indexedCombinationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const length = blocks.length;
    const clauses: string[] = ["file_id = ?", "name_length = ?"];
    const params: unknown[] = [fileId, length];

    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i] as NameBlock;
      const pos = i + 1;

      if (isCompleteKorean(block)) {
        clauses.push(`k${pos} = ?`);
        params.push(block.korean);
      } else if (isChosungOnly(block)) {
        clauses.push(`c${pos} = ?`);
        params.push(block.korean);
      } else if (isJungsungOnly(block)) {
        clauses.push(`j${pos} = ?`);
        params.push(block.korean);
      } else if (!isKoreanEmpty(block)) {
        const fallback = this.loadCombinations(fileId, length).filter((combination) => {
          const nameChars = Array.from(combination.korean);
          const hanjaChars = Array.from(combination.hanja);
          for (let j = 0; j < length; j += 1) {
            if (!blockMatchesAt(blocks[j] as NameBlock, nameChars[j] ?? "", hanjaChars[j] ?? "")) {
              return false;
            }
          }
          return true;
        });
        this.cache.indexedCombinationCache.set(cacheKey, fallback);
        return fallback;
      }

      if (block.hanja.length > 0 && block.hanja !== "_") {
        clauses.push(`h${pos} = ?`);
        params.push(block.hanja);
      }
    }

    if (strokeKeys && strokeKeys.size > 0 && strokeKeys.size <= 900) {
      const keys = Array.from(strokeKeys).filter((key) => key.length > 0).sort();
      if (keys.length > 0) {
        clauses.push(`stroke_key IN (${keys.map(() => "?").join(",")})`);
        params.push(...keys);
      }
    }

    const sql = [
      "SELECT name_hangul, name_hanja",
      "  FROM stats_combinations",
      ` WHERE ${clauses.join(" AND ")}`,
      " ORDER BY rowid",
    ].join("\n");
    const rows = this.getIndexedStatement(sql).all(...params) as StatsComboRow[];
    const out = parseCombinationRows(rows, length);
    this.cache.indexedCombinationCache.set(cacheKey, out);
    return out;
  }

  private getIndexedStatement(sql: string): SqliteStatement {
    const cached = this.cache.indexedQueryCache.get(sql);
    if (cached) {
      return cached;
    }
    const prepared = this.db.prepare(sql);
    this.cache.indexedQueryCache.set(sql, prepared);
    return prepared;
  }
}
