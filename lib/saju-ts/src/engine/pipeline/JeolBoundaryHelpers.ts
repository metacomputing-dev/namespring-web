import { JeolBoundaryTable } from '../../calendar/solar/JeolBoundaryTable.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const FIRST_DAY_SINCE_BOUNDARY = 1;

function utcDateMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function elapsedDaysBetweenUtcDates(startDateMs: number, endDateMs: number): number {
  return Math.floor((endDateMs - startDateMs) / MILLISECONDS_PER_DAY);
}

function toOneBasedDayCount(elapsedDays: number): number {
  return Math.max(FIRST_DAY_SINCE_BOUNDARY, elapsedDays + FIRST_DAY_SINCE_BOUNDARY);
}

export function calculateDaysSinceJeol(
  standardYear: number,
  standardMonth: number,
  standardDay: number,
  standardHour: number,
  standardMinute: number,
): number | null {
  const boundary = JeolBoundaryTable.previousBoundaryAtOrBefore(
    standardYear, standardMonth, standardDay, standardHour, standardMinute,
  );
  if (boundary === undefined) return null;

  const birthMs = utcDateMs(standardYear, standardMonth, standardDay);
  const boundaryMs = utcDateMs(boundary.year, boundary.month, boundary.day);
  const elapsedDays = elapsedDaysBetweenUtcDates(boundaryMs, birthMs);
  return toOneBasedDayCount(elapsedDays);
}

