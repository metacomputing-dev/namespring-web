import { extractChosung, extractJungsung } from "./hangul.js";
import { openSqliteDatabase, type SqliteDatabase, type SqliteStatement } from "./sqlite-runtime.js";
import type {
  NameBlock,
  NameCombination,
  NameStatistics,
  StatsRepository,
} from "./types.js";
import { normalizeText } from "./utils.js";

type YearMap = Record<string, unknown>;

interface StatsNameRow {
  payload_json: unknown;
}

interface StatsComboRow {
  name_hangul: unknown;
  name_hanja: unknown;
}

interface FileIdRow {
  file_id: unknown;
}

interface TableInfoRow {
  name: unknown;
}

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

function toText(value: unknown): string {
  return normalizeText(String(value ?? ""));
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

function parseStatsPayload(payload: unknown): NameStatistics | null {
  if (typeof payload !== "string") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const row = parsed as Record<string, unknown>;
  const rank = (row.r as Record<string, YearMap> | undefined) ?? {};
  const birth = (row.b as Record<string, YearMap> | undefined) ?? {};
  return {
    similarNames: toStringList(row.s),
    totalRankByYear: parseYearMap(rank.t),
    maleRankByYear: parseYearMap(rank.m),
    totalBirthByYear: parseYearMap(birth.t),
    maleBirthByYear: parseYearMap(birth.m),
    hanjaCombinations: toStringList(row.h),
  };
}

export class SqliteStatsRepository implements StatsRepository {
  private readonly db: SqliteDatabase;
  private readonly selectFilesByKey: SqliteStatement;
  private readonly selectAllFiles: SqliteStatement;
  private readonly selectStatsByName: SqliteStatement;
  private readonly selectCombinationsByFileAndLength: SqliteStatement;
  private readonly hasIndexedColumns: boolean;
  private readonly indexedQueryCache = new Map<string, SqliteStatement>();
  private readonly nameCache = new Map<string, NameStatistics | null>();
  private readonly filesByKeyCache = new Map<string, string[]>();
  private allFilesCache: string[] | null = null;
  private readonly combinationCache = new Map<string, NameCombination[]>();

  static create(dbPath: string): SqliteStatsRepository {
    return new SqliteStatsRepository(openSqliteDatabase(dbPath));
  }

  constructor(db: SqliteDatabase) {
    this.db = db;
    this.selectFilesByKey = this.db.prepare(
      "SELECT file_id FROM stats_index WHERE chosung_key = ? ORDER BY ord, file_id",
    );
    this.selectAllFiles = this.db.prepare(
      "SELECT file_id FROM stats_index ORDER BY rowid",
    );
    this.selectStatsByName = this.db.prepare(
      "SELECT payload_json FROM stats_name WHERE file_id = ? AND name_hangul = ? LIMIT 1",
    );
    this.selectCombinationsByFileAndLength = this.db.prepare(
      "SELECT name_hangul, name_hanja FROM stats_combinations WHERE file_id = ? AND name_length = ? ORDER BY rowid",
    );
    this.hasIndexedColumns = this.detectIndexedColumns();
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
    const files = this.getFilesByKey(key);
    for (const fileId of files) {
      const row = this.selectStatsByName.get(fileId, name) as StatsNameRow | undefined;
      if (!row) {
        continue;
      }
      const parsed = parseStatsPayload(row.payload_json);
      if (parsed) {
        this.nameCache.set(name, parsed);
        return parsed;
      }
    }

    this.nameCache.set(name, null);
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
    const useIndexedQuery = this.hasIndexedColumns && length <= 3;

    for (const fileId of files) {
      const combinations = useIndexedQuery
        ? this.loadCombinationsIndexed(fileId, blocks, strokeKeys)
        : this.loadCombinations(fileId, length);

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
    let key: string | null = null;
    if (isChosungOnly(firstBlock)) {
      key = CHOSUNG_TO_ENGLISH[firstBlock.korean] ?? "misc";
    } else if (isCompleteKorean(firstBlock)) {
      const first = Array.from(firstBlock.korean)[0] ?? "";
      key = CHOSUNG_TO_ENGLISH[extractChosung(first)] ?? "misc";
    }
    if (key !== null) {
      return this.getFilesByKey(key);
    }
    return this.getAllFiles();
  }

  private getFilesByKey(key: string): string[] {
    const cached = this.filesByKeyCache.get(key);
    if (cached) {
      return cached;
    }
    const rows = this.selectFilesByKey.all(key) as FileIdRow[];
    const out = rows.map((row) => toText(row.file_id)).filter((id) => id.length > 0);
    this.filesByKeyCache.set(key, out);
    return out;
  }

  private getAllFiles(): string[] {
    if (this.allFilesCache) {
      return this.allFilesCache;
    }
    const rows = this.selectAllFiles.all() as FileIdRow[];
    this.allFilesCache = rows.map((row) => toText(row.file_id)).filter((id) => id.length > 0);
    return this.allFilesCache;
  }

  private detectIndexedColumns(): boolean {
    try {
      const rows = this.db.prepare("PRAGMA table_info(stats_combinations)").all() as TableInfoRow[];
      const columns = new Set(rows.map((row) => toText(row.name)));
      const required = [
        "k1",
        "k2",
        "k3",
        "h1",
        "h2",
        "h3",
        "c1",
        "c2",
        "c3",
        "j1",
        "j2",
        "j3",
        "stroke_key",
      ];
      return required.every((name) => columns.has(name));
    } catch {
      return false;
    }
  }

  private getIndexedStatement(sql: string): SqliteStatement {
    const cached = this.indexedQueryCache.get(sql);
    if (cached) {
      return cached;
    }
    const prepared = this.db.prepare(sql);
    this.indexedQueryCache.set(sql, prepared);
    return prepared;
  }

  private loadCombinationsIndexed(
    fileId: string,
    blocks: NameBlock[],
    strokeKeys?: ReadonlySet<string>,
  ): NameCombination[] {
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
        const fallback = this.loadCombinations(fileId, length);
        return fallback.filter((combination) => {
          const nameChars = Array.from(combination.korean);
          const hanjaChars = Array.from(combination.hanja);
          for (let j = 0; j < length; j += 1) {
            if (!blockMatchesAt(blocks[j] as NameBlock, nameChars[j] ?? "", hanjaChars[j] ?? "")) {
              return false;
            }
          }
          return true;
        });
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
    return rows
      .map((row) => ({ korean: toText(row.name_hangul), hanja: toText(row.name_hanja) }))
      .filter(
        (value) =>
          value.korean.length > 0 &&
          value.hanja.length > 0 &&
          Array.from(value.korean).length === length &&
          Array.from(value.hanja).length === length,
      );
  }

  private loadCombinations(fileId: string, length: number): NameCombination[] {
    const cacheKey = `${fileId}|${length}`;
    const cached = this.combinationCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const rows = this.selectCombinationsByFileAndLength.all(fileId, length) as StatsComboRow[];
    const out = rows
      .map((row) => ({ korean: toText(row.name_hangul), hanja: toText(row.name_hanja) }))
      .filter(
        (value) =>
          value.korean.length > 0 &&
          value.hanja.length > 0 &&
          Array.from(value.korean).length === length &&
          Array.from(value.hanja).length === length,
      );
    this.combinationCache.set(cacheKey, out);
    return out;
  }
}

