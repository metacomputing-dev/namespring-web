/**
 * period-meta-builder.ts -- TieredPeriodMeta + label builder
 *
 * For each TieredPeriodKind, returns the user-facing label and meta info
 * (active stems / branches and their elements). Reuses the existing
 * `getYearlyFortune / getMonthlyFortuneSolar / getDailyFortune` helpers
 * — we never re-implement pillar lookup.
 */

import type { TieredPeriodKind, TieredPeriodMeta } from '../types.js';
import type { FortuneGanzhi } from '../common/fortuneCalculator.js';
import {
  getYearlyFortune,
  getMonthlyFortuneSolar,
  getDailyFortune,
} from '../common/fortuneCalculator.js';
import { ELEMENT_KOREAN } from '../common/elementMaps.js';
import type { ElementCode } from '../types.js';
import {
  addTargetCalendarDays,
  targetCalendarDay,
  targetCalendarDayOfWeek,
  targetCalendarMonth,
  targetCalendarYear,
} from '../../target-date.js';

interface BuiltPeriod {
  label: string;
  meta: TieredPeriodMeta;
}

function elementHangul(code: ElementCode | null | undefined): string {
  if (!code) return '';
  return ELEMENT_KOREAN[code] ?? '';
}

function metaFromGanzhi(position: string, f: FortuneGanzhi): TieredPeriodMeta {
  return {
    stems: [{ position, stem: f.stem.hangul, element: elementHangul(f.stemElement) }],
    branches: [{ position, branch: f.branch.hangul, element: elementHangul(f.branchElement) }],
  };
}

function buildLifeMeta(): BuiltPeriod {
  return {
    label: '인생 전체',
    meta: { relativeNote: '사주 원국 전체를 기준으로 본 큰 흐름이에요.' },
  };
}

function buildTodayMeta(targetDate: Date): BuiltPeriod {
  const f = getDailyFortune(targetDate);
  const month = String(targetCalendarMonth(targetDate));
  const day = String(targetCalendarDay(targetDate));
  return {
    label: `오늘 (${month}월 ${day}일)`,
    meta: {
      ...metaFromGanzhi('today', f),
      relativeNote: `오늘은 ${f.ganzhiHangul}일의 흐름을 받아요.`,
    },
  };
}

function buildThisWeekMeta(targetDate: Date): BuiltPeriod {
  const start = addTargetCalendarDays(targetDate, -targetCalendarDayOfWeek(targetDate));
  const f = getDailyFortune(start);
  return {
    label: '이번 주',
    meta: {
      ...metaFromGanzhi('weekStart', f),
      relativeNote: '이번 주 7일 동안의 흐름을 한눈에 살펴봐요.',
    },
  };
}

function buildThisMonthMeta(targetDate: Date): BuiltPeriod {
  const month = targetCalendarMonth(targetDate);
  const f = getMonthlyFortuneSolar(targetCalendarYear(targetDate), month);
  return {
    label: `이번 달 (${month}월)`,
    meta: {
      ...metaFromGanzhi('month', f),
      relativeNote: `이번 달은 ${f.ganzhiHangul}월의 흐름이에요.`,
    },
  };
}

function buildThisYearMeta(targetDate: Date): BuiltPeriod {
  const year = targetCalendarYear(targetDate);
  const f = getYearlyFortune(year);
  return {
    label: `올해 (${year}년)`,
    meta: {
      ...metaFromGanzhi('year', f),
      relativeNote: `${year}년은 ${f.ganzhiHangul}년의 흐름이에요.`,
    },
  };
}

export function buildPeriodMeta(periodKind: TieredPeriodKind, targetDate: Date): BuiltPeriod {
  switch (periodKind) {
    case 'life': return buildLifeMeta();
    case 'today': return buildTodayMeta(targetDate);
    case 'thisWeek': return buildThisWeekMeta(targetDate);
    case 'thisMonth': return buildThisMonthMeta(targetDate);
    case 'thisYear': return buildThisYearMeta(targetDate);
  }
}

/** Returns the active fortune element of a period — used by cell-grader.
 *  We use the heavenly stem element (not the branch) as the dominant
 *  signal, mirroring the existing PeriodFortuneCard policy. */
export function periodFortuneElement(periodKind: TieredPeriodKind, targetDate: Date): ElementCode | null {
  if (periodKind === 'life') return null;
  if (periodKind === 'today') return getDailyFortune(targetDate).stemElement;
  if (periodKind === 'thisWeek') {
    const start = addTargetCalendarDays(targetDate, -targetCalendarDayOfWeek(targetDate));
    return getDailyFortune(start).stemElement;
  }
  if (periodKind === 'thisMonth') {
    return getMonthlyFortuneSolar(targetCalendarYear(targetDate), targetCalendarMonth(targetDate)).stemElement;
  }
  if (periodKind === 'thisYear') {
    return getYearlyFortune(targetCalendarYear(targetDate)).stemElement;
  }
  return null;
}
