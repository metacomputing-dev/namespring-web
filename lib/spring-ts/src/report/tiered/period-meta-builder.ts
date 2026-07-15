/**
 * period-meta-builder.ts -- TieredPeriodMeta + label builder
 *
 * For each TieredPeriodKind, returns the user-facing label and meta info
 * (active stems / branches and their elements). Reuses the existing
 * `getYearlyFortune / getMonthlyFortuneSolar / getDailyFortune` helpers
 * — we never re-implement pillar lookup.
 */

import type { SajuSummary } from '../../types.js';
import type { TieredPeriodKind, TieredPeriodMeta } from '../types.js';
import type { FortuneGanzhi } from '../common/fortuneCalculator.js';
import {
  getYearlyFortune,
  getMonthlyFortuneSolar,
  getDailyFortune,
} from '../common/fortuneCalculator.js';
import { BRANCH_BY_CODE, ELEMENT_KOREAN, STEM_BY_CODE } from '../common/elementMaps.js';
import { luckAnnotationFeatures, type LuckPillarAnnotationsForReport } from '../common/transit-luck-metadata.js';
import {
  findYearLuckRowForInstant,
  LuckIntervalSelectionError,
} from '../common/luck-interval.js';
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

interface LuckPillarMetaRow extends LuckPillarAnnotationsForReport {
  readonly year?: unknown;
  readonly stem?: unknown;
  readonly branch?: unknown;
  readonly startUtcMs?: unknown;
  readonly endUtcMs?: unknown;
}

function elementHangul(code: ElementCode | null | undefined): string {
  if (!code) return '';
  return ELEMENT_KOREAN[code] ?? '';
}

function findSaeunRowForDate(saju: SajuSummary | null | undefined, targetDate: Date): LuckPillarMetaRow | null {
  const rows = (saju as { readonly saeunPillars?: readonly LuckPillarMetaRow[] } | null | undefined)?.saeunPillars;
  return findYearLuckRowForInstant(rows, targetDate.getTime(), targetCalendarYear(targetDate));
}

function resolveLuckRowParts(row: LuckPillarMetaRow): {
  stemInfo: (typeof STEM_BY_CODE)[string];
  branchInfo: (typeof BRANCH_BY_CODE)[string];
} {
  const stemInfo = typeof row.stem === 'string'
    ? STEM_BY_CODE[row.stem.toUpperCase()]
    : undefined;
  const branchInfo = typeof row.branch === 'string'
    ? BRANCH_BY_CODE[row.branch.toUpperCase()]
    : undefined;
  if (!stemInfo || !branchInfo) {
    throw new LuckIntervalSelectionError('selected year luck row has an invalid stem or branch');
  }
  return { stemInfo, branchInfo };
}

function metaFromLuckRow(position: string, row: LuckPillarMetaRow): TieredPeriodMeta {
  const { stemInfo, branchInfo } = resolveLuckRowParts(row);
  const transitEvidence = luckAnnotationFeatures(row);
  return {
    stems: [{ position, stem: stemInfo.hangul, element: elementHangul(stemInfo.element) }],
    branches: [{ position, branch: branchInfo.hangul, element: elementHangul(branchInfo.element) }],
    ...(transitEvidence.length > 0 ? { transitEvidence } : {}),
  };
}

function luckRowGanzhiHangul(row: LuckPillarMetaRow | null, fallback: FortuneGanzhi): string {
  if (!row) return fallback.ganzhiHangul;
  const { stemInfo, branchInfo } = resolveLuckRowParts(row);
  return `${stemInfo.hangul}${branchInfo.hangul}`;
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

function buildThisYearMeta(targetDate: Date, saju?: SajuSummary | null): BuiltPeriod {
  const year = targetCalendarYear(targetDate);
  const f = getYearlyFortune(year);
  const saeun = findSaeunRowForDate(saju, targetDate);
  return {
    label: `올해 (${year}년)`,
    meta: {
      ...(saeun ? metaFromLuckRow('year', saeun) : metaFromGanzhi('year', f)),
      relativeNote: `${year}년은 ${luckRowGanzhiHangul(saeun, f)}년의 흐름이에요.`,
    },
  };
}

export function buildPeriodMeta(periodKind: TieredPeriodKind, targetDate: Date, saju?: SajuSummary | null): BuiltPeriod {
  switch (periodKind) {
    case 'life': return buildLifeMeta();
    case 'today': return buildTodayMeta(targetDate);
    case 'thisWeek': return buildThisWeekMeta(targetDate);
    case 'thisMonth': return buildThisMonthMeta(targetDate);
    case 'thisYear': return buildThisYearMeta(targetDate, saju);
  }
}

/** Returns the active fortune element of a period — used by cell-grader.
 *  We use the heavenly stem element (not the branch) as the dominant
 *  signal, mirroring the existing PeriodFortuneCard policy. */
export function periodFortuneElement(periodKind: TieredPeriodKind, targetDate: Date, saju?: SajuSummary | null): ElementCode | null {
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
    const fallback = getYearlyFortune(targetCalendarYear(targetDate));
    const saeun = findSaeunRowForDate(saju, targetDate);
    if (!saeun) return fallback.stemElement;
    return resolveLuckRowParts(saeun).stemInfo.element;
  }
  return null;
}
