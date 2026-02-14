import { MAX_STROKE_KEYS_FOR_SQL_IN } from "../constants.js";
import type { SqliteStatement } from "../sqlite-runtime.js";
import type { NameBlock, NameCombination, NameStatistics } from "../types.js";

export interface SqliteStatsCache {
  indexedQueryCache: Map<string, SqliteStatement>;
  indexedCombinationCache: Map<string, NameCombination[]>;
  nameCache: Map<string, NameStatistics | null>;
  filesByKeyCache: Map<string, string[]>;
  combinationCache: Map<string, NameCombination[]>;
  allFilesCache: string[] | null;
}

export function createSqliteStatsCache(): SqliteStatsCache {
  return {
    indexedQueryCache: new Map<string, SqliteStatement>(),
    indexedCombinationCache: new Map<string, NameCombination[]>(),
    nameCache: new Map<string, NameStatistics | null>(),
    filesByKeyCache: new Map<string, string[]>(),
    combinationCache: new Map<string, NameCombination[]>(),
    allFilesCache: null,
  };
}

export function combinationCacheKey(fileId: string, length: number): string {
  return `${fileId}|${length}`;
}

export function indexedCombinationCacheKey(
  fileId: string,
  blocks: NameBlock[],
  strokeKeys?: ReadonlySet<string>,
): string {
  const blockKey = blocks.map((block) => `${block.korean}/${block.hanja}`).join(",");
  if (!strokeKeys || strokeKeys.size === 0 || strokeKeys.size > MAX_STROKE_KEYS_FOR_SQL_IN) {
    return `${fileId}|${blockKey}`;
  }
  const strokeKey = Array.from(strokeKeys).filter((key) => key.length > 0).sort().join(",");
  if (strokeKey.length === 0) {
    return `${fileId}|${blockKey}`;
  }
  return `${fileId}|${blockKey}|${strokeKey}`;
}
