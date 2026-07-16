import type { NameStatEntry } from '../../seed-ts/src/database/name-stat-row.js';
import type { NameStatLookupResult } from './name-stat-contract.js';

export interface NameStatSourceProjection {
  readonly popularityRank: number | null;
  readonly maleBirths: number;
  readonly femaleBirths: number;
}

type FoundNameStatLookupResult =
  Extract<NameStatLookupResult, { readonly status: 'found' }>;

/**
 * Reduces a decoded repository row to the source values Spring consumes.
 *
 * The raw counts deliberately stay separate from Spring's null/unknown policy,
 * so offline compact-asset generation can preserve the same evidence.
 */
export function projectNameStatEntry(entry: NameStatEntry): NameStatSourceProjection {
  return {
    popularityRank: latestPopularityRankFromEntry(entry),
    maleBirths: sumBirthsByBucket(entry.yearly_birth, ['남자', '남']),
    femaleBirths: sumBirthsByBucket(entry.yearly_birth, ['여자', '여']),
  };
}

export function toFoundNameStatLookupResult(
  projection: NameStatSourceProjection,
): FoundNameStatLookupResult {
  const totalBirths = projection.maleBirths + projection.femaleBirths;
  if (totalBirths <= 0) {
    return {
      status: 'found',
      popularityRank: projection.popularityRank,
      maleRatio: null,
      nameGender: 'unknown',
    };
  }

  const maleRatio = normalizeRatio(projection.maleBirths / totalBirths);
  return {
    status: 'found',
    popularityRank: projection.popularityRank,
    maleRatio,
    nameGender: maleRatio >= 0.5 ? 'male' : 'female',
  };
}

function latestPopularityRankFromEntry(entry: NameStatEntry): number | null {
  const source = entry?.yearly_rank || {};
  const totalBucket = source?.['전체'];

  if (totalBucket && typeof totalBucket === 'object' && !Array.isArray(totalBucket)) {
    const sorted = Object.entries(totalBucket)
      .map(([year, rank]) => ({ year: Number(year), rank: Number(rank) }))
      .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.rank))
      .sort((a, b) => a.year - b.year);
    const latestFromTotal = sorted.length ? sorted[sorted.length - 1].rank : null;
    return Number.isFinite(Number(latestFromTotal)) && Number(latestFromTotal) > 0
      ? Number(latestFromTotal)
      : null;
  }

  const valuesByYear = new Map<number, number[]>();
  for (const [bucketKey, bucket] of Object.entries(source)) {
    const flatYear = Number(bucketKey);
    const flatValue = Number(bucket);
    if (Number.isFinite(flatYear) && Number.isFinite(flatValue)) {
      const list = valuesByYear.get(flatYear) || [];
      list.push(flatValue);
      valuesByYear.set(flatYear, list);
      continue;
    }

    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue;
    for (const [year, value] of Object.entries(bucket)) {
      const numericYear = Number(year);
      const numericValue = Number(value);
      if (!Number.isFinite(numericYear) || !Number.isFinite(numericValue)) continue;
      const list = valuesByYear.get(numericYear) || [];
      list.push(numericValue);
      valuesByYear.set(numericYear, list);
    }
  }

  if (!valuesByYear.size) return null;
  const latestYear = Math.max(...valuesByYear.keys());
  const values = valuesByYear.get(latestYear) || [];
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number.isFinite(average) && average > 0 ? average : null;
}

function sumBirthsByBucket(
  yearlyBirth: Record<string, Record<string, number>>,
  bucketNames: readonly string[],
): number {
  let total = 0;
  for (const bucketName of bucketNames) {
    const bucket = yearlyBirth?.[bucketName];
    if (!bucket || typeof bucket !== 'object') continue;
    for (const value of Object.values(bucket)) {
      const count = Number(value);
      if (Number.isFinite(count) && count > 0) {
        total += count;
      }
    }
  }
  return total;
}

function normalizeRatio(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
