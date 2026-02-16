import { Jiji } from '../../domain/Jiji.js';
import { JEOL_BOUNDARY_DATA } from './JeolBoundaryData.js';

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

function momentKey(y: number, m: number, d: number, h: number, min: number): number {
  return y * 100_000_000 + m * 1_000_000 + d * 10_000 + h * 100 + min;
}

function boundaryToKey(b: JeolBoundary): number {
  return momentKey(b.year, b.month, b.day, b.hour, b.minute);
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
  let result: JeolBoundary | undefined;
  for (const boundary of ensureLoaded()) {
    const candidate = boundaryToKey(boundary);
    if (candidate < key) {
      result = boundary;
      continue;
    }
    break;
  }
  return result?.sajuMonthIndex;
}

export function nextBoundaryAfter(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): JeolBoundary | undefined {
  const key = momentKey(year, month, day, hour, minute);
  return ensureLoaded().find(boundary => boundaryToKey(boundary) > key);
}

export function previousBoundaryAtOrBefore(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): JeolBoundary | undefined {
  const key = momentKey(year, month, day, hour, minute);
  let result: JeolBoundary | undefined;
  for (const boundary of ensureLoaded()) {
    if (boundaryToKey(boundary) <= key) {
      result = boundary;
    }
  }
  return result;
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

