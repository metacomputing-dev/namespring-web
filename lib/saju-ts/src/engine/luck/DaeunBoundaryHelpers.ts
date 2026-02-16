import { DaeunBoundaryMode } from '../../domain/DaeunInfo.js';
import { JeolBoundaryTable } from '../../calendar/solar/JeolBoundaryTable.js';

const APPROX_BOUNDARY_DAY = 6;
const APPROX_BOUNDARY_HOUR = 12;
const APPROX_BOUNDARY_TIME_LABEL = `${String(APPROX_BOUNDARY_HOUR).padStart(2, '0')}:00`;
const MILLISECONDS_PER_MINUTE = 60_000;

function monthShift(
  year: number,
  month: number,
  deltaMonths: number,
): { year: number; month: number } {
  const shiftedDate = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth() + 1,
  };
}

function approxBoundaryUtcMs(year: number, month: number): number {
  const boundaryDay = Math.min(APPROX_BOUNDARY_DAY, daysInMonth(year, month));
  return Date.UTC(year, month - 1, boundaryDay, APPROX_BOUNDARY_HOUR, 0);
}

function absoluteMinutesBetweenUtcMs(ms1: number, ms2: number): number {
  return Math.abs(Math.floor((ms2 - ms1) / MILLISECONDS_PER_MINUTE));
}

function approxBoundaryWarning(year: number, directionLabel: 'next' | 'previous'): string {
  return `Jeol boundary table miss for year=${year}; used minute-level approximate boundary day=${APPROX_BOUNDARY_DAY}@${APPROX_BOUNDARY_TIME_LABEL} (${directionLabel}), expected precision lower than exact mode.`;
}

export interface BoundaryDistance {
  readonly totalMinutes: number;
  readonly mode: DaeunBoundaryMode;
  readonly warning?: string;
}

export function minutesBetween(
  y1: number, mo1: number, d1: number, h1: number, mi1: number,
  y2: number, mo2: number, d2: number, h2: number, mi2: number,
): number {
  const ms1 = Date.UTC(y1, mo1 - 1, d1, h1, mi1);
  const ms2 = Date.UTC(y2, mo2 - 1, d2, h2, mi2);
  return absoluteMinutesBetweenUtcMs(ms1, ms2);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function minutesToBoundaryExact(
  year: number, month: number, day: number, hour: number, minute: number,
  isForward: boolean,
): number | undefined {
  const boundary = isForward
    ? JeolBoundaryTable.nextBoundaryAfter(year, month, day, hour, minute)
    : JeolBoundaryTable.previousBoundaryAtOrBefore(year, month, day, hour, minute);
  if (boundary === undefined) return undefined;

  return minutesBetween(
    year, month, day, hour, minute,
    boundary.year, boundary.month, boundary.day, boundary.hour, boundary.minute,
  );
}

export function minutesToBoundaryApprox(
  year: number, month: number, day: number, hour: number, minute: number,
  isForward: boolean,
): number {
  const thisMonthBoundaryMs = approxBoundaryUtcMs(year, month);
  const birthMs = Date.UTC(year, month - 1, day, hour, minute);

  let boundaryMs: number;
  if (isForward) {
    if (birthMs < thisMonthBoundaryMs) {
      boundaryMs = thisMonthBoundaryMs;
    } else {
      const nextMonth = monthShift(year, month, 1);
      boundaryMs = approxBoundaryUtcMs(nextMonth.year, nextMonth.month);
    }
  } else {
    if (birthMs >= thisMonthBoundaryMs) {
      boundaryMs = thisMonthBoundaryMs;
    } else {
      const previousMonth = monthShift(year, month, -1);
      boundaryMs = approxBoundaryUtcMs(previousMonth.year, previousMonth.month);
    }
  }

  return absoluteMinutesBetweenUtcMs(birthMs, boundaryMs);
}
export function boundaryDistance(
  year: number, month: number, day: number, hour: number, minute: number,
  isForward: boolean,
): BoundaryDistance {
  const exactMinutes = minutesToBoundaryExact(year, month, day, hour, minute, isForward);
  if (exactMinutes !== undefined) {
    const inTable = JeolBoundaryTable.isSupportedYear(year);
    const warning = !inTable
      ? `Birth year ${year} is outside JeolBoundaryTable (1900-2050); used VSOP87D fallback boundary.`
      : undefined;
    return {
      totalMinutes: exactMinutes,
      mode: inTable ? DaeunBoundaryMode.EXACT_TABLE : DaeunBoundaryMode.VSOP87D_CALCULATED,
      warning,
    };
  }

  const approxMinutes = minutesToBoundaryApprox(year, month, day, hour, minute, isForward);
  const directionLabel = isForward ? 'next' : 'previous';
  return {
    totalMinutes: approxMinutes,
    mode: DaeunBoundaryMode.APPROXIMATE_DAY6,
    warning: approxBoundaryWarning(year, directionLabel),
  };
}

