import { openSqliteDatabase, type SqliteDatabase, type SqliteDatabaseOpener } from "./sqlite-runtime.js";
import type {
  NameBlock,
  NameCombination,
  NameStatistics,
  StatsRepository,
} from "./types.js";
import { normalizeText } from "./utils.js";
import { resolveIndexKeyFromFirstBlock, resolveIndexKeyFromName } from "./stats/index-map.js";
import { blockMatchesAt, matchesFirstBlock } from "./stats/name-block-matcher.js";
import { createSqliteStatsCache, type SqliteStatsCache } from "./stats/sqlite-cache.js";
import { SqliteCombinationLoader } from "./stats/sqlite-combination-loader.js";
import {
  prepareSqliteStatsStatements,
  type SqliteStatsStatements,
} from "./stats/sqlite-statements.js";
import {
  parseStatsPayload,
  toText,
  type FileIdRow,
  type StatsNameRow,
} from "./stats/stats-parsers.js";

export class SqliteStatsRepository implements StatsRepository {
  private readonly db: SqliteDatabase;
  private readonly statements: SqliteStatsStatements;
  private readonly cache: SqliteStatsCache;
  private readonly combinationLoader: SqliteCombinationLoader;

  static create(dbPath: string, opener?: SqliteDatabaseOpener): SqliteStatsRepository {
    return new SqliteStatsRepository(openSqliteDatabase(dbPath, opener ?? null));
  }

  static fromDatabase(db: SqliteDatabase): SqliteStatsRepository {
    return new SqliteStatsRepository(db);
  }

  constructor(db: SqliteDatabase) {
    this.db = db;
    this.statements = prepareSqliteStatsStatements(this.db);
    this.cache = createSqliteStatsCache();
    this.combinationLoader = new SqliteCombinationLoader({
      db: this.db,
      selectCombinationsByFileAndLength: this.statements.selectCombinationsByFileAndLength,
      cache: this.cache,
    });
  }

  findByName(nameHangul: string): NameStatistics | null {
    const name = normalizeText(nameHangul);
    if (!name) {
      return null;
    }
    const cached = this.cache.nameCache.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const files = this.getFilesByKey(resolveIndexKeyFromName(name));
    for (const fileId of files) {
      const row = this.statements.selectStatsByName.get(fileId, name) as StatsNameRow | undefined;
      if (!row) {
        continue;
      }
      const parsed = parseStatsPayload(row.payload_json);
      if (parsed) {
        this.cache.nameCache.set(name, parsed);
        return parsed;
      }
    }

    this.cache.nameCache.set(name, null);
    return null;
  }

  findNameCombinations(blocks: NameBlock[], strokeKeys?: ReadonlySet<string>): NameCombination[] {
    if (blocks.length === 0) {
      return [];
    }

    const first = blocks[0] as NameBlock;
    const files = this.filesToSearch(first);
    const out: NameCombination[] = [];
    const length = blocks.length;
    const useIndexedQuery = this.statements.hasIndexedColumns && length <= 3;

    for (const fileId of files) {
      const combinations = useIndexedQuery
        ? this.combinationLoader.loadCombinationsIndexed(fileId, blocks, strokeKeys)
        : this.combinationLoader.loadCombinations(fileId, length);

      if (useIndexedQuery) {
        for (const combination of combinations) {
          out.push(combination);
        }
        continue;
      }

      for (const combination of combinations) {
        if (!matchesFirstBlock(first, combination.korean)) {
          continue;
        }
        const nameChars = Array.from(combination.korean);
        const hanjaChars = Array.from(combination.hanja);
        let ok = true;
        for (let i = 0; i < length; i += 1) {
          if (!blockMatchesAt(blocks[i] as NameBlock, nameChars[i] ?? "", hanjaChars[i] ?? "")) {
            ok = false;
            break;
          }
        }
        if (ok) {
          out.push(combination);
        }
      }
    }
    return out;
  }

  private filesToSearch(firstBlock: NameBlock): string[] {
    const key = resolveIndexKeyFromFirstBlock(firstBlock);
    if (key !== null) {
      return this.getFilesByKey(key);
    }
    return this.getAllFiles();
  }

  private getFilesByKey(key: string): string[] {
    const cached = this.cache.filesByKeyCache.get(key);
    if (cached) {
      return cached;
    }
    const rows = this.statements.selectFilesByKey.all(key) as FileIdRow[];
    const out = rows.map((row) => toText(row.file_id)).filter((id) => id.length > 0);
    this.cache.filesByKeyCache.set(key, out);
    return out;
  }

  private getAllFiles(): string[] {
    if (this.cache.allFilesCache) {
      return this.cache.allFilesCache;
    }
    const rows = this.statements.selectAllFiles.all() as FileIdRow[];
    this.cache.allFilesCache = rows.map((row) => toText(row.file_id)).filter((id) => id.length > 0);
    return this.cache.allFilesCache;
  }
}
