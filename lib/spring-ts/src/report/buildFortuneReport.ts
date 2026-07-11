/**
 * buildFortuneReport.ts -- Fortune Report orchestrator
 *
 * Assembles a complete FortuneReport by calling each card builder with
 * the appropriate arguments. Required calculations fail closed: emitting a
 * neutral-looking fallback score would disguise a backend defect as a reading.
 */

import type { SajuSummary, SpringReport, BirthInfo } from '../types.js';
import type {
  FortuneReport,
  FortuneReportOptions,
  FortuneTieredMatrix,
  ReportMeta,
  ReportUncertainty,
} from './types.js';

// Card builders
import { buildOverviewSummaryCard } from './cards/overview-summary-card.js';
import { buildLifeFortuneOverviewCard } from './cards/life-fortune-overview-card.js';
import { buildPersonalityCard } from './cards/personality-card.js';
import { buildStrengthsWeaknessesCard } from './cards/strengths-weaknesses-card.js';
import { buildNameCompatibilityCard } from './cards/name-compatibility-card.js';
import { buildCautionsCard } from './cards/cautions-card.js';
import { buildPeriodFortuneCard } from './cards/period-fortune-card.js';
import { buildLifeStageFortuneCard } from './cards/life-stage-fortune-card.js';
import { buildCategoryFortuneCards } from './cards/category-fortune-card.js';
import { buildTieredMatrix, preloadGeneratedForReport } from './tiered/build-tiered-matrix.js';
import { buildLifeCurveCard, type LifeCurveCard } from './cards/life-curve-card.js';
import { buildInsightFactsCard, type InsightFactsCard } from './cards/insight-facts-card.js';
import { assertScorableSajuSummary } from '../saju-analysis-contract.js';
import { FortuneReportBuildError } from './report-input-contract.js';

// ---------------------------------------------------------------------------
//  Age computation
// ---------------------------------------------------------------------------

/**
 * Compute the person's current age (Korean counting age approximation)
 * from the birth year stored in the saju's timeCorrection or pillar data.
 */
function computeCurrentAge(saju: SajuSummary, targetDate: Date): number | null {
  // Prefer the standardYear from timeCorrection (the original birth year)
  const birthYear = saju.timeCorrection?.standardYear;
  if (birthYear && birthYear > 0) {
    return targetDate.getFullYear() - birthYear;
  }
  return null;
}

// ---------------------------------------------------------------------------
//  Required card builder boundary
// ---------------------------------------------------------------------------

function buildRequired<T>(context: string, builder: () => T): T {
  try {
    return builder();
  } catch (error) {
    throw new FortuneReportBuildError(context, error);
  }
}

function resolveUncertaintyTimezone(
  uncertaintyTimezone: string | undefined,
  birthTimezone: string | undefined,
): string {
  for (const value of [uncertaintyTimezone, birthTimezone]) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return 'Asia/Seoul';
}

function buildReportUncertainties(
  saju: SajuSummary,
  birth?: BirthInfo,
): readonly ReportUncertainty[] | undefined {
  const rows: ReportUncertainty[] = [];
  const unknownHour = saju.inputUncertainty?.unknownHour;
  if (unknownHour) {
    const timezone = resolveUncertaintyTimezone(unknownHour.fallbackTimezone, birth?.timezone);
    rows.push({
      id: 'unknown-hour',
      severity: 'medium',
      message: unknownHour.message,
      affectedAxes: unknownHour.affectedAxes,
      affectedAxisLabels: unknownHour.affectedAxisLabels,
      fallback: {
        hour: unknownHour.fallbackHour,
        minute: unknownHour.fallbackMinute,
        timezone,
      },
    });
  }

  const unknownMinute = saju.inputUncertainty?.unknownMinute;
  if (unknownMinute) {
    const timezone = resolveUncertaintyTimezone(unknownMinute.fallbackTimezone, birth?.timezone);
    rows.push({
      id: 'unknown-minute',
      severity: unknownMinute.boundarySensitive ? 'medium' : 'info',
      message: unknownMinute.message,
      affectedAxes: unknownMinute.affectedAxes,
      affectedAxisLabels: unknownMinute.affectedAxisLabels,
      fallback: {
        hour: unknownMinute.fallbackHour,
        minute: unknownMinute.fallbackMinute,
        timezone,
      },
      evaluatedMinuteRange: unknownMinute.evaluatedMinuteRange,
      boundarySensitive: unknownMinute.boundarySensitive,
      continuousTimingAffected: unknownMinute.continuousTimingAffected,
      confidenceTierShift: unknownMinute.confidenceTierShift,
    });
  }

  return rows.length > 0 ? rows : undefined;
}

// ---------------------------------------------------------------------------
//  Public builder
// ---------------------------------------------------------------------------

export async function buildFortuneReport(
  saju: SajuSummary,
  targetDate: Date,
  springReport: SpringReport | null,
  options?: FortuneReportOptions,
  birth?: BirthInfo,
): Promise<FortuneReport> {
  assertScorableSajuSummary(saju);
  const currentAge = computeCurrentAge(saju, targetDate);

  // ── 1. Name compatibility (only when spring report is available) ──
  const nameCompatibility = springReport
    ? buildRequired('nameCompatibility', () => buildNameCompatibilityCard(springReport))
    : null;

  // ── 2. Overview summary ──
  const overviewSummary = buildRequired('overviewSummary',
    () => buildOverviewSummaryCard(saju, { narrativeStyle: options?.narrativeStyle }),
  );

  // ── 3. Life fortune overview ──
  const lifeFortuneOverview = buildRequired('lifeFortuneOverview',
    () => buildLifeFortuneOverviewCard(saju),
  );

  // ── 4. Personality ──
  const personality = buildRequired('personality',
    () => buildPersonalityCard(saju),
  );

  // ── 5. Strengths & weaknesses ──
  const strengthsWeaknesses = buildRequired('strengthsWeaknesses',
    () => buildStrengthsWeaknessesCard(saju),
  );

  // ── 6. Cautions ──
  const cautions = buildRequired('cautions',
    () => buildCautionsCard(saju),
  );

  // ── 7. Period fortune cards ──
  const dailyFortune = buildRequired('dailyFortune',
    () => buildPeriodFortuneCard(saju, 'daily', targetDate, options, { currentAge }),
  );

  const weeklyFortune = buildRequired('weeklyFortune',
    () => buildPeriodFortuneCard(saju, 'weekly', targetDate, options, { currentAge }),
  );

  const monthlyFortune = buildRequired('monthlyFortune',
    () => buildPeriodFortuneCard(saju, 'monthly', targetDate, options, { currentAge }),
  );

  const yearlyFortune = buildRequired('yearlyFortune',
    () => buildPeriodFortuneCard(saju, 'yearly', targetDate, options, { currentAge }),
  );

  // ── 8. Life stage fortune ──
  const lifeStageFortune = buildRequired('lifeStageFortune',
    () => buildLifeStageFortuneCard(saju, currentAge),
  );

  // ── 9. Category fortunes ──
  const categoryFortunes = buildRequired('categoryFortunes',
    () => buildCategoryFortuneCards(
      saju,
      targetDate,
      options,
      currentAge == null ? undefined : { currentAge },
    ),
  );

  // ── 10. Tiered fortune matrix (opt-in) ──
  // `surfaceTieredMatrix !== true` → undefined, preserving backward-compat.
  // When enabled, build a 5×11 cell matrix from data/narrative/** seeds.
  // An explicitly requested surface is part of the response contract, so its
  // builder failure is reported instead of being omitted silently.
  // Browser: fetch the person's packed generated bundles before the (sync)
  // matrix build so class-first selection finds them. Node: no-op.
  if (options?.surfaceTieredMatrix === true && birth) {
    await preloadGeneratedForReport(saju, birth, targetDate, springReport?.sajuCompatibility ?? null)
      .catch(() => { /* leave on base fallback */ });
  }
  const tieredMatrix: FortuneTieredMatrix | undefined =
    options?.surfaceTieredMatrix === true && birth
      ? buildRequired('tieredMatrix',
          () => buildTieredMatrix(saju, birth, targetDate, {
            enabled: true,
            namingReport: springReport?.namingReport ?? null,
            sajuCompatibility: springReport?.sajuCompatibility ?? null,
          }),
        )
      : undefined;

  // ── 11. Life curve (opt-in, tieredMatrix와 동일 조건) ──
  // 0~100세 대운·세운 블렌드 커브. 별점(칩·카드)이 정본이고 커브는 시각화용
  // 파생값이라는 규약은 life-curve-card.ts 참조.
  const birthYearForCurve = birth?.year ?? saju.timeCorrection?.standardYear ?? null;
  const lifeCurve: LifeCurveCard | undefined =
    options?.surfaceTieredMatrix === true && birthYearForCurve
      ? buildRequired(
          'lifeCurve',
          () => buildLifeCurveCard(saju, birthYearForCurve, currentAge),
        ) ?? undefined
      : undefined;

  // ── 12. Insight facts (opt-in + 성인 전용) ──
  // 미성년 페이로드에는 싣지 않는다 — 성인성 신살 필터 규칙이 정의되기
  // 전까지의 보수적 게이팅 (DESIGN_LIFEFLOW_INSIGHTS.md §Phase 2).
  const insightFacts: InsightFactsCard | undefined =
    options?.surfaceInsightFacts === true && currentAge !== null && currentAge >= 20
      ? buildRequired('insightFacts', () => buildInsightFactsCard(saju)) ?? undefined
      : undefined;

  // ── Meta ──
  const meta: ReportMeta = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    schoolPreset: options?.schoolPreset,
    uncertainties: buildReportUncertainties(saju, birth),
  };

  return {
    nameCompatibility,
    overviewSummary,
    lifeFortuneOverview,
    personality,
    strengthsWeaknesses,
    cautions,
    dailyFortune,
    weeklyFortune,
    monthlyFortune,
    yearlyFortune,
    lifeStageFortune,
    categoryFortunes,
    meta,
    ...(tieredMatrix ? { tieredMatrix } : {}),
    ...(lifeCurve ? { lifeCurve } : {}),
    ...(insightFacts ? { insightFacts } : {}),
  };
}
