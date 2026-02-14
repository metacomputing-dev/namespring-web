import type { SqliteDatabase, SqliteStatement } from "../sqlite-runtime.js";
import { toText, type TableInfoRow } from "./stats-parsers.js";

export interface SqliteStatsStatements {
  selectFilesByKey: SqliteStatement;
  selectAllFiles: SqliteStatement;
  selectStatsByName: SqliteStatement;
  selectCombinationsByFileAndLength: SqliteStatement;
  hasIndexedColumns: boolean;
}

const REQUIRED_INDEXED_COLUMNS = [
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

function detectIndexedColumns(db: SqliteDatabase): boolean {
  try {
    const rows = db.prepare("PRAGMA table_info(stats_combinations)").all() as TableInfoRow[];
    const columns = new Set(rows.map((row) => toText(row.name)));
    return REQUIRED_INDEXED_COLUMNS.every((name) => columns.has(name));
  } catch {
    return false;
  }
}

export function prepareSqliteStatsStatements(db: SqliteDatabase): SqliteStatsStatements {
  return {
    selectFilesByKey: db.prepare("SELECT file_id FROM stats_index WHERE chosung_key = ? ORDER BY ord, file_id"),
    selectAllFiles: db.prepare("SELECT file_id FROM stats_index ORDER BY rowid"),
    selectStatsByName: db.prepare(
      "SELECT payload_json FROM stats_name WHERE file_id = ? AND name_hangul = ? LIMIT 1",
    ),
    selectCombinationsByFileAndLength: db.prepare(
      "SELECT name_hangul, name_hanja FROM stats_combinations WHERE file_id = ? AND name_length = ? ORDER BY rowid",
    ),
    hasIndexedColumns: detectIndexedColumns(db),
  };
}
