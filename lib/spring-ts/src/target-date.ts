export interface TargetCalendarParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const TARGET_CALENDAR_PARTS = new WeakMap<Date, TargetCalendarParts>();
const MS_PER_DAY = 86_400_000;

export function registerTargetCalendarDate<T extends Date>(
  date: T,
  parts: TargetCalendarParts,
): T {
  TARGET_CALENDAR_PARTS.set(date, Object.freeze({ ...parts }));
  return date;
}

/**
 * Returns the calendar date declared by the caller's offset-aware input.
 * Ordinary Date values retain the legacy host-local interpretation.
 */
export function targetCalendarParts(date: Date): TargetCalendarParts {
  return TARGET_CALENDAR_PARTS.get(date) ?? {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function targetCalendarYear(date: Date): number {
  return targetCalendarParts(date).year;
}

export function targetCalendarMonth(date: Date): number {
  return targetCalendarParts(date).month;
}

export function targetCalendarDay(date: Date): number {
  return targetCalendarParts(date).day;
}

export function targetCalendarDayOfWeek(date: Date): number {
  const parts = targetCalendarParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/**
 * Capture both a Date's instant and its caller-declared calendar date.
 *
 * Freezing a Date does not freeze its mutable internal time value, so public
 * async builders must work with a fresh Date rather than the caller's object.
 */
export function snapshotTargetCalendarDate(date: Date): Date {
  let time: number;
  try {
    time = Date.prototype.getTime.call(date);
  } catch {
    throw new TypeError('Fortune target date must be a valid Date.');
  }
  if (!Number.isFinite(time)) {
    throw new TypeError('Fortune target date must be a valid Date.');
  }

  const registeredParts = TARGET_CALENDAR_PARTS.get(date);
  const parts = registeredParts ?? {
    year: Date.prototype.getFullYear.call(date),
    month: Date.prototype.getMonth.call(date) + 1,
    day: Date.prototype.getDate.call(date),
  };
  return registerTargetCalendarDate(new Date(time), parts);
}

export function addTargetCalendarDays(date: Date, days: number): Date {
  const parts = targetCalendarParts(date);
  const serial = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return registerTargetCalendarDate(
    new Date(date.getTime() + days * MS_PER_DAY),
    {
      year: serial.getUTCFullYear(),
      month: serial.getUTCMonth() + 1,
      day: serial.getUTCDate(),
    },
  );
}
