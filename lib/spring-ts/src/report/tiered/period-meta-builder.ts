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
import type { ElementCode } from '../types.js';

interface BuiltPeriod {
  label: string;
  meta: TieredPeriodMeta;
}

interface LuckPillarMetaRow extends LuckPillarAnnotationsForReport {
  readonly year?: number;
  readonly stem?: string;
  readonly branch?: string;
  readonly startUtcMs?: number | null;
  readonly endUtcMs?: number | null;
}

function elementHangul(code: ElementCode | null | undefined): string {
  if (!code) return '';
  return ELEMENT_KOREAN[code] ?? '';
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function findSaeunRowForDate(saju: SajuSummary | null | undefined, targetDate: Date): LuckPillarMetaRow | null {
  const rows = (saju as { readonly saeunPillars?: readonly LuckPillarMetaRow[] } | null | undefined)?.saeunPillars;
  if (!Array.isArray(rows)) return null;
  const targetMs = targetDate.getTime();
  for (const row of rows) {
    const start = finiteNumber(row.startUtcMs);
    const end = finiteNumber(row.endUtcMs);
    if (start !== null && end !== null && targetMs >= start && targetMs < end) return row;
  }
  const year = targetDate.getFullYear();
  return rows.find((row) => row.year === year) ?? null;
}

function metaFromLuckRow(position: string, row: LuckPillarMetaRow, fallback: FortuneGanzhi): TieredPeriodMeta {
  const stemInfo = STEM_BY_CODE[String(row.stem ?? '').toUpperCase()] ?? fallback.stem;
  const branchInfo = BRANCH_BY_CODE[String(row.branch ?? '').toUpperCase()] ?? fallback.branch;
  const transitEvidence = luckAnnotationFeatures(row);
  return {
    stems: [{ position, stem: stemInfo.hangul, element: elementHangul(stemInfo.element) }],
    branches: [{ position, branch: branchInfo.hangul, element: elementHangul(branchInfo.element) }],
    ...(transitEvidence.length > 0 ? { transitEvidence } : {}),
  };
}

function luckRowGanzhiHangul(row: LuckPillarMetaRow | null, fallback: FortuneGanzhi): string {
  if (!row) return fallback.ganzhiHangul;
  const stemInfo = STEM_BY_CODE[String(row.stem ?? '').toUpperCase()];
  const branchInfo = BRANCH_BY_CODE[String(row.branch ?? '').toUpperCase()];
  return stemInfo && branchInfo ? `${stemInfo.hangul}${branchInfo.hangul}` : fallback.ganzhiHangul;
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
  const month = String(targetDate.getMonth() + 1);
  const day = String(targetDate.getDate());
  return {
    label: `오늘 (${month}월 ${day}일)`,
    meta: {
      ...metaFromGanzhi('today', f),
      relativeNote: `오늘은 ${f.ganzhiHangul}일의 흐름을 받아요.`,
    },
  };
}

function buildThisWeekMeta(targetDate: Date): BuiltPeriod {
  const start = new Date(targetDate);
  start.setDate(targetDate.getDate() - targetDate.getDay());
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
  const f = getMonthlyFortuneSolar(targetDate.getFullYear(), targetDate.getMonth() + 1);
  return {
    label: `이번 달 (${targetDate.getMonth() + 1}월)`,
    meta: {
      ...metaFromGanzhi('month', f),
      relativeNote: `이번 달은 ${f.ganzhiHangul}월의 흐름이에요.`,
    },
  };
}

function buildThisYearMeta(targetDate: Date, saju?: SajuSummary | null): BuiltPeriod {
  const year = targetDate.getFullYear();
  const f = getYearlyFortune(year);
  const saeun = findSaeunRowForDate(saju, targetDate);
  return {
    label: `올해 (${year}년)`,
    meta: {
      ...(saeun ? metaFromLuckRow('year', saeun, f) : metaFromGanzhi('year', f)),
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
    const start = new Date(targetDate);
    start.setDate(targetDate.getDate() - targetDate.getDay());
    return getDailyFortune(start).stemElement;
  }
  if (periodKind === 'thisMonth') {
    return getMonthlyFortuneSolar(targetDate.getFullYear(), targetDate.getMonth() + 1).stemElement;
  }
  if (periodKind === 'thisYear') {
    const fallback = getYearlyFortune(targetDate.getFullYear());
    const saeun = findSaeunRowForDate(saju, targetDate);
    const stemInfo = saeun ? STEM_BY_CODE[String(saeun.stem ?? '').toUpperCase()] : null;
    return stemInfo?.element ?? fallback.stemElement;
  }
  return null;
}
