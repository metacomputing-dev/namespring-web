import trendData from '../data/hangul-name-trends.json';
import type { BirthInfo, NameCharInput } from './types.js';

export type NameTrendGender = 'male' | 'female';
export type NameTrendStatus = 'current' | 'era_fit' | 'dated' | 'overused' | 'unknown';

export interface NameTrendPoint {
  readonly year: number;
  readonly rank: number;
  readonly count: number;
}

export interface NameTrendAnalysis {
  readonly givenHangul: string;
  readonly gender: NameTrendGender | 'unknown';
  readonly birthYear: number | null;
  readonly matchedYear: number | null;
  readonly latestYear: number;
  readonly trendFit: number | null;
  readonly trendRisk: number | null;
  readonly eraFitScore: number | null;
  readonly status: NameTrendStatus;
  readonly matchedPoint?: NameTrendPoint;
  readonly latestPoint?: NameTrendPoint;
  readonly evidence: readonly string[];
  readonly sourceTier: 'T5_OFFICIAL';
  readonly authorityTruthEligible: true;
}

interface TrendRow {
  readonly name: string;
  readonly gender: NameTrendGender;
  readonly year: number;
  readonly rank: number;
  readonly count: number;
}

interface TrendDataFile {
  readonly asOfYear: number;
  readonly rows: readonly TrendRow[];
}

const data = trendData as TrendDataFile;
const rows = data.rows ?? [];
const latestYear = data.asOfYear;
const years = Array.from(new Set(rows.map((row) => row.year))).sort((a, b) => a - b);
const minYear = years[0] ?? latestYear;

function givenHangulKey(givenName: readonly NameCharInput[] | undefined): string {
  return (givenName ?? []).map((char) => char.hangul ?? '').join('').trim();
}

function normalizeGender(gender: BirthInfo['gender'] | undefined): NameTrendGender | 'unknown' {
  return gender === 'male' || gender === 'female' ? gender : 'unknown';
}

function rowsForName(givenHangul: string, gender: NameTrendGender): TrendRow[] {
  return rows
    .filter((row) => row.name === givenHangul && row.gender === gender)
    .sort((a, b) => a.year - b.year);
}

function nearestFixtureYear(birthYear: number): number {
  let best = years[0] ?? birthYear;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const year of years) {
    const distance = Math.abs(year - birthYear);
    if (distance < bestDistance || (distance === bestDistance && year > best)) {
      best = year;
      bestDistance = distance;
    }
  }
  return best;
}

function scoreRank(rank: number | null | undefined): number | null {
  if (!Number.isInteger(rank) || Number(rank) <= 0) return null;
  return Math.max(20, 100 - (Number(rank) - 1) * 4);
}

function asPoint(row: TrendRow | undefined): NameTrendPoint | undefined {
  if (!row) return undefined;
  return { year: row.year, rank: row.rank, count: row.count };
}

function unknownTrend(
  givenHangul: string,
  gender: NameTrendGender | 'unknown',
  birthYear: number | null,
  reason: string,
): NameTrendAnalysis {
  return {
    givenHangul,
    gender,
    birthYear,
    matchedYear: null,
    latestYear,
    trendFit: null,
    trendRisk: null,
    eraFitScore: null,
    status: 'unknown',
    evidence: [reason],
    sourceTier: 'T5_OFFICIAL',
    authorityTruthEligible: true,
  };
}

export function getNameTrendAnalysis(
  givenName: readonly NameCharInput[] | undefined,
  birth: BirthInfo,
): NameTrendAnalysis {
  const givenHangul = givenHangulKey(givenName);
  const gender = normalizeGender(birth.gender);
  const birthYear = Number.isInteger(birth.year) ? Number(birth.year) : null;

  if (!givenHangul) {
    return unknownTrend(givenHangul, gender, birthYear, 'No Hangul given name was supplied.');
  }
  if (gender === 'unknown') {
    return unknownTrend(givenHangul, gender, birthYear, 'Name trend fixture is gender-specific; neutral gender is not inferred.');
  }
  if (birthYear === null) {
    return unknownTrend(givenHangul, gender, birthYear, 'Birth year is required for era-fit name trend analysis.');
  }
  if (birthYear < minYear) {
    return unknownTrend(givenHangul, gender, birthYear, 'Official fixture starts at 2008, so earlier birth years are outside scope.');
  }

  const nameRows = rowsForName(givenHangul, gender);
  if (nameRows.length === 0) {
    return unknownTrend(givenHangul, gender, birthYear, 'Name is not present in the small official top-20 fixture.');
  }

  const matchedYear = nearestFixtureYear(Math.min(birthYear, latestYear));
  const matchedRow = nameRows.find((row) => row.year === matchedYear);
  const latestRow = nameRows.find((row) => row.year === latestYear);
  const bestRow = nameRows.reduce((best, row) => row.rank < best.rank ? row : best, nameRows[0]);
  const matchedRankScore = scoreRank(matchedRow?.rank);
  const trendFit = matchedRankScore ?? (birthYear >= latestYear && bestRow.year < latestYear ? 35 : 45);

  let trendRisk = 20;
  let status: NameTrendStatus = 'era_fit';
  if (latestRow && latestRow.rank <= 3 && birthYear >= latestYear - 1) {
    trendRisk = 55;
    status = 'overused';
  } else if (!latestRow && birthYear >= latestYear - 1 && bestRow.rank <= 10) {
    trendRisk = 75;
    status = 'dated';
  } else if (matchedRow && matchedRow.rank <= 10 && birthYear < latestYear - 1) {
    trendRisk = 25;
    status = 'era_fit';
  } else if (latestRow && birthYear >= latestYear - 1) {
    trendRisk = latestRow.rank <= 10 ? 30 : 40;
    status = 'current';
  } else if (!matchedRow) {
    trendRisk = 50;
  }

  const evidence = [
    matchedRow
      ? `${matchedYear} ${gender} rank ${matchedRow.rank}, count ${matchedRow.count}.`
      : `${givenHangul} is not in the top-20 fixture for ${matchedYear} ${gender}.`,
    latestRow
      ? `${latestYear} ${gender} rank ${latestRow.rank}, count ${latestRow.count}.`
      : `${givenHangul} is not in the ${latestYear} ${gender} top-20 fixture.`,
    'Trend score is display-only and does not affect ranking or total score.',
  ];

  return {
    givenHangul,
    gender,
    birthYear,
    matchedYear,
    latestYear,
    trendFit,
    trendRisk,
    eraFitScore: trendFit,
    status,
    matchedPoint: asPoint(matchedRow),
    latestPoint: asPoint(latestRow),
    evidence,
    sourceTier: 'T5_OFFICIAL',
    authorityTruthEligible: true,
  };
}
