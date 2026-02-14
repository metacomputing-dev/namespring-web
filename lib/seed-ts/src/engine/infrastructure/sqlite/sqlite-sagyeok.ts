import { openSqliteDatabase } from "../../../core/sqlite-runtime.js";
import type { LuckyLevel } from "../../../core/types.js";
import { normalizeText, toRoundedInt } from "../../../core/utils.js";

interface SagyeokRow {
  number: unknown;
  lucky_level: unknown;
}

const POSITIVE_LEVELS = new Set<LuckyLevel>(["최상운수", "상운수", "양운수"]);

function normalizeLevel(value: unknown): LuckyLevel {
  const text = normalizeText(String(value ?? ""));
  if (text.includes("최상운수")) return "최상운수";
  if (text.includes("상운수")) return "상운수";
  if (text.includes("양운수")) return "양운수";
  if (text.includes("최흉운수")) return "최흉운수";
  if (text.includes("흉운수")) return "흉운수";
  return "미정";
}

function extractSqliteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return toRoundedInt(value);
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function loadSagyeokMapFromSqlite(sqlitePath: string): Map<number, LuckyLevel> {
  const db = openSqliteDatabase(sqlitePath);
  try {
    const stmt = db.prepare("SELECT number, lucky_level FROM sagyeok_data ORDER BY number");
    const rows = stmt.all() as SagyeokRow[];
    const out = new Map<number, LuckyLevel>();
    for (const row of rows) {
      const number = extractSqliteNumber(row.number);
      if (number === null) {
        continue;
      }
      out.set(number, normalizeLevel(row.lucky_level));
    }
    return out;
  } catch (error) {
    throw new Error("failed to load `sagyeok_data` from sqlite database", {
      cause: error as Error,
    });
  } finally {
    db.close?.();
  }
}

export function extractPositiveSagyeokNumbers(levelMap: Map<number, LuckyLevel>): Set<number> {
  const out = new Set<number>();
  for (const [num, level] of levelMap.entries()) {
    if (POSITIVE_LEVELS.has(level)) {
      out.add(num);
    }
  }
  return out;
}

export function ensureSagyeokMapNotEmpty(levelMap: Map<number, LuckyLevel>): void {
  if (levelMap.size === 0) {
    throw new Error("`sagyeok_data` is empty in sqlite database. Rebuild sqlite data first.");
  }
}
