import { Jiji } from '../../domain/Jiji.js';
import { JEOL_BOUNDARY_DATA } from './JeolBoundaryData.js';
import {
  findFirstBoundaryByKey,
  findLastBoundaryByKey,
  momentKey,
} from './JeolBoundarySearch.js';

export interface JeolBoundary {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly solarLongitude: number;
  readonly sajuMonthIndex: number;
  readonly branch: Jiji;
}

let boundaries: JeolBoundary[] | null = null;
let boundariesByYear: Map<number, JeolBoundary[]> | null = null;

function ensureLoaded(): JeolBoundary[] {
  if (boundaries != null) return boundaries;
  boundaries = JEOL_BOUNDARY_DATA.map(row => ({
    year: row[0],
    month: row[1],
    day: row[2],
    hour: row[3],
    minute: row[4],
    solarLongitude: row[5],
    sajuMonthIndex: row[6],
    branch: row[7] as Jiji,
  }));
  return boundaries;
}

function ensureByYear(): Map<number, JeolBoundary[]> {
  if (boundariesByYear != null) return boundariesByYear;
  boundariesByYear = new Map<number, JeolBoundary[]>();
  for (const boundary of ensureLoaded()) {
    const current = boundariesByYear.get(boundary.year);
    if (current) {
      current.push(boundary);
      continue;
    }
    boundariesByYear.set(boundary.year, [boundary]);
  }
  return boundariesByYear;
}

export function isSupportedYear(year: number): boolean {
  return ensureByYear().has(year);
}

export function ipchunOf(year: number): JeolBoundary | undefined {
  return ensureByYear().get(year)?.find(boundary => boundary.sajuMonthIndex === 1);
}

export function sajuMonthIndexAt(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number | undefined {
  const key = momentKey(year, month, day, hour, minute);
  return findLastBoundaryByKey(ensureLoaded(), key, false)?.sajuMonthIndex;
}

export function nextBoundaryAfter(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): JeolBoundary | undefined {
  const key = momentKey(year, month, day, hour, minute);
  return findFirstBoundaryByKey(ensureLoaded(), key, false);
}

export function previousBoundaryAtOrBefore(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): JeolBoundary | undefined {
  const key = momentKey(year, month, day, hour, minute);
  return findLastBoundaryByKey(ensureLoaded(), key, true);
}

export function boundariesForYear(year: number): Map<number, JeolBoundary> | undefined {
  const entries = ensureByYear().get(year);
  if (!entries) return undefined;
  return new Map(entries.map(boundary => [boundary.sajuMonthIndex, boundary]));
}

export const JeolBoundaryTable = {
  isSupportedYear,
  ipchunOf,
  sajuMonthIndexAt,
  nextBoundaryAfter,
  previousBoundaryAtOrBefore,
  boundariesForYear,
} as const;

