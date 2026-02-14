import type { NameCombination, NameStatistics } from "../types.js";
import { toText } from "../type-converters.js";
export { toText };

export type YearMap = Record<string, unknown>;
export type RawStatsRow = Record<string, unknown>;
export type RawStatsFile = Record<string, RawStatsRow>;

export interface StatsNameRow {
  payload_json: unknown;
}

export interface StatsComboRow {
  name_hangul: unknown;
  name_hanja: unknown;
}

export interface FileIdRow {
  file_id: unknown;
}

export interface TableInfoRow {
  name: unknown;
}

const STATS_YEAR_BASE = 2000;

export function parseYearMap(input: YearMap | undefined): Record<number, number> {
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
      out[STATS_YEAR_BASE + key] = value;
    }
  }
  return out;
}

export function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function parseNameStatisticsRow(row: RawStatsRow): NameStatistics {
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

export function parseStatsPayload(payload: unknown): NameStatistics | null {
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
  return parseNameStatisticsRow(parsed as RawStatsRow);
}

export function parseCombinationRows(rows: StatsComboRow[], length: number): NameCombination[] {
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
