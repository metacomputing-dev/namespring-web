import type { EngineConfig } from '../api/types.js';
import type { PillarIdx, StemIdx } from '../core/cycle.js';
import { ganzhiFromIndex, pillar } from '../core/cycle.js';
import { mod } from '../core/mod.js';
import type { LocalDate, LocalDateTime, LocalTime } from './iso.js';
import { gregorianToJdn } from './julian.js';
import { computeLunarNewYearBoundary } from './lunarNewYear.js';
import type { JieBoundariesAround, JieTermId, SolarTermInstant, SolarTermMethod } from './solarTerms.js';
import { jieTermMonthOrder } from './solarTerms.js';

export function addDays(date: LocalDate, days: number): LocalDate {
  // Simple (not timezone) Gregorian day increment using JS Date in UTC.
  const dt = Date.UTC(date.y, date.m - 1, date.d + days);
  const d2 = new Date(dt);
  return { y: d2.getUTCFullYear(), m: d2.getUTCMonth() + 1, d: d2.getUTCDate() };
}

export function compareLocalDateTime(a: LocalDateTime, b: LocalDateTime): number {
  // Compare lexicographically by components (same offset domain).
  if (a.date.y !== b.date.y) return a.date.y - b.date.y;
  if (a.date.m !== b.date.m) return a.date.m - b.date.m;
  if (a.date.d !== b.date.d) return a.date.d - b.date.d;
  if (a.time.h !== b.time.h) return a.time.h - b.time.h;
  return a.time.min - b.time.min;
}

export function effectiveDayDate(ldt: LocalDateTime, dayBoundary: EngineConfig['calendar']['dayBoundary']): LocalDate {
  if (dayBoundary === 'midnight') return ldt.date;
  if (dayBoundary === 'ziSplit23') {
    // Day label changes at 23:00. Equivalent to date part of (localDateTime + 1 hour).
    if (ldt.time.h === 23) return addDays(ldt.date, 1);
    return ldt.date;
  }
  return ldt.date;
}

export function calcDayPillar(localDate: LocalDate): PillarIdx {
  const jdn = gregorianToJdn(localDate);
  const idx = mod(jdn + 49, 60);
  return ganzhiFromIndex(idx);
}

export function calcHourPillar(dayStem: StemIdx, localTime: LocalTime, _hourBoundary: EngineConfig['calendar']['hourBoundary']): PillarIdx {
  const h = localTime.h;
  // Standard double-hour mapping where 子 starts at 23:00.
  const hourBranch = h === 23 ? 0 : Math.floor((h + 1) / 2);
  const base = mod(dayStem, 5) * 2;
  const hourStem = mod(base + hourBranch, 10);
  return pillar(hourStem, hourBranch);
}

export function monthOrderFromJieBoundaries(utcMs: number, boundaries: SolarTermInstant[]): number {
  // Boundaries are sorted by utcMs.
  let last: SolarTermInstant | null = null;
  for (const t of boundaries) {
    if (t.utcMs <= utcMs) last = t;
    else break;
  }
  if (!last) {
    // Extremely early date: fallback to DAXUE (子) as a safe default.
    return 10;
  }
  return jieTermMonthOrder(last.id as JieTermId) ?? 10;
}

export function calcYearPillarFromLiChunUtc(
  localYear: number,
  utcMs: number,
  liChunUtcMs: number | null,
  yearBoundary: EngineConfig['calendar']['yearBoundary'],
  offsetMinutes: number,
  solarTermMethod: SolarTermMethod,
): PillarIdx {
  let y = localYear;

  if (yearBoundary === 'liChun') {
    if (liChunUtcMs == null) {
      throw new Error('liChunUtcMs is required when yearBoundary=liChun');
    }
    if (utcMs < liChunUtcMs) y -= 1;
  }

  if (yearBoundary === 'lunarNewYear') {
    const boundaryUtcMs = computeLunarNewYearBoundary(localYear, offsetMinutes, solarTermMethod).boundaryUtcMs;
    if (utcMs < boundaryUtcMs) y -= 1;
  }

  // jan1: no adjustment

  const stem = mod(y - 4, 10);
  const branch = mod(y - 4, 12);
  return pillar(stem, branch);
}

// Backward-compatible helper (kept for internal experimentation; main engine uses calcYearPillarFromLiChunUtc).
export function calcYearPillar(ldt: LocalDateTime, yearBoundary: EngineConfig['calendar']['yearBoundary']): PillarIdx {
  let y = ldt.date.y;

  if (yearBoundary === 'liChun') {
    // Simple heuristic: if before Feb 4 (local), treat as previous year.
    const liChun: LocalDateTime = {
      date: { y, m: 2, d: 4 },
      time: { h: 0, min: 0 },
      offsetMinutes: ldt.offsetMinutes,
    };
    if (compareLocalDateTime(ldt, liChun) < 0) y -= 1;
  }

  if (yearBoundary === 'lunarNewYear') {
    const utcMs = Date.UTC(y, ldt.date.m - 1, ldt.date.d, ldt.time.h, ldt.time.min, 0) - ldt.offsetMinutes * 60_000;
    const boundaryUtcMs = computeLunarNewYearBoundary(y, ldt.offsetMinutes, 'meeus').boundaryUtcMs;
    if (utcMs < boundaryUtcMs) y -= 1;
  }

  const stem = mod(y - 4, 10);
  const branch = mod(y - 4, 12);
  return pillar(stem, branch);
}

export function calcMonthPillarFromOrder(yearStem: StemIdx, monthOrder: number): PillarIdx {
  const base = mod(mod(yearStem, 5) * 2 + 2, 10); // 寅월의 월간
  const stem = mod(base + monthOrder, 10);
  const branch = mod(2 + monthOrder, 12); // 寅(2)부터 시작
  return pillar(stem, branch);
}

export function calcMonthPillar(
  _ldt: LocalDateTime,
  _yearStem: StemIdx,
  monthBoundary: EngineConfig['calendar']['monthBoundary'],
): PillarIdx {
  // This helper previously contained an approximate jieqi-month fallback.
  // That placeholder has been removed to prevent silent misclassification.
  if (monthBoundary === 'jieqi') {
    throw new Error('calcMonthPillar(monthBoundary=jieqi) requires jie boundaries; use monthOrderByPolicy + calcMonthPillarFromOrder');
  }
  // monthBoundary === 'gregorianMonth' is deterministic without solar terms.
  throw new Error('calcMonthPillar is deprecated; use monthOrderByPolicy + calcMonthPillarFromOrder');
}

export function gregorianMonthOrder(m: number): number {
  // Purely mechanical mapping: Feb->寅, Mar->卯, ... Jan->丑
  return mod(m + 10, 12);
}

export function liChunUtcMsFromBoundaries(boundariesAround: JieBoundariesAround): number | null {
  // We need 立春 of baseYear.
  const t = boundariesAround.terms.find((x) => x.year === boundariesAround.baseYear && x.id === 'LICHUN');
  return t?.utcMs ?? null;
}

export function monthOrderByPolicy(
  utcMs: number,
  ldt: LocalDateTime,
  monthBoundary: EngineConfig['calendar']['monthBoundary'],
  jieBoundariesAround: JieBoundariesAround | null,
): number {
  if (monthBoundary === 'gregorianMonth') return gregorianMonthOrder(ldt.date.m);
  if (!jieBoundariesAround) {
    throw new Error('jieBoundariesAround is required when monthBoundary=jieqi (approx fallback removed)');
  }
  return monthOrderFromJieBoundaries(utcMs, jieBoundariesAround.terms);
}
