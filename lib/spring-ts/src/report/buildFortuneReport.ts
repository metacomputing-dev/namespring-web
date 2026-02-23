/**
 * buildFortuneReport.ts -- Fortune Report orchestrator
 *
 * Assembles a complete FortuneReport by calling each card builder with
 * the appropriate arguments. Each builder call is wrapped in try-catch
 * for safety; a failed card produces a sensible fallback rather than
 * crashing the entire report.
 */

import type { SajuSummary, SpringReport } from '../types.js';
import type { FortuneReport, ReportMeta, FortuneCategory } from './types.js';

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

// Card types (re-imported for fallback construction)
import type {
  OverviewSummaryCard,
  LifeFortuneOverviewCard,
  PersonalityCard,
  StrengthsWeaknessesCard,
  NameCompatibilityCard,
  CautionsCard,
  PeriodFortuneCard,
  LifeStageFortuneCard,
  CategoryFortuneCard,
  FortunePeriodKind,
} from './types.js';

// ---------------------------------------------------------------------------
//  Age computation
// ---------------------------------------------------------------------------

/**
 * Compute the person's current age (Korean counting age approximation)
 * from the birth year stored in the saju's timeCorrection or pillar data.
 */
function computeCurrentAge(saju: SajuSummary, targetDate: Date): number {
  // Prefer the standardYear from timeCorrection (the original birth year)
  const birthYear = saju.timeCorrection?.standardYear;
  if (birthYear && birthYear > 0) {
    return targetDate.getFullYear() - birthYear;
  }
  // Fallback: no reliable birth year -- assume 30 as a safe default
  return 30;
}

// ---------------------------------------------------------------------------
//  Safe card builder wrappers
// ---------------------------------------------------------------------------

function safeCall<T>(builder: () => T, fallback: T, context = 'unknown-card'): T {
  try {
    return builder();
  } catch (error) {
    console.error(`[spring-ts] Fortune report builder failed: ${context}`, error);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
//  Fallback cards
// ---------------------------------------------------------------------------

const FALLBACK_OVERVIEW_SUMMARY: OverviewSummaryCard = {
  title: '총평 요약',
  pillars: [],
  dayMasterDescription: '사주 정보를 분석하는 중이에요.',
  strengthDescription: '',
  yongshinDescription: '',
  elementBalance: '',
  overallSummary: '사주 정보를 기반으로 총평을 준비하고 있어요.',
};

const FALLBACK_LIFE_FORTUNE: LifeFortuneOverviewCard = {
  title: '인생 운세 총평',
  stars: 3,
  summary: '인생 운세를 분석하는 중이에요.',
  highlights: [],
};

const FALLBACK_PERSONALITY: PersonalityCard = {
  title: '나의 성향',
  traits: [],
  summary: '성향 분석을 준비하고 있어요.',
};

const FALLBACK_STRENGTHS_WEAKNESSES: StrengthsWeaknessesCard = {
  title: '나의 장/단점',
  strengths: [],
  weaknesses: [],
};

const FALLBACK_CAUTIONS: CautionsCard = {
  title: '유의점',
  cautions: [],
};

function makeFallbackPeriodFortune(periodKind: FortunePeriodKind, periodLabel: string): PeriodFortuneCard {
  return {
    title: `${periodLabel} 운세`,
    periodKind,
    periodLabel,
    stars: 3,
    summary: `${periodLabel} 운세를 분석하고 있어요.`,
    goodActions: [],
    badActions: [],
    warning: { signal: '', response: '', reason: '' },
    categoryScores: { wealth: 3, health: 3, academic: 3, romance: 3, family: 3 },
  };
}

const FALLBACK_LIFE_STAGE: LifeStageFortuneCard = {
  title: '생애 시기별 운세',
  stages: [],
  currentStageIndex: null,
};

function makeFallbackCategoryFortune(category: FortuneCategory, title: string): CategoryFortuneCard {
  return {
    title,
    category,
    stars: 3,
    summary: `${title}을 분석하고 있어요.`,
    advice: [],
    caution: null,
  };
}

const FALLBACK_CATEGORY_FORTUNES: Record<FortuneCategory, CategoryFortuneCard> = {
  wealth: makeFallbackCategoryFortune('wealth', '재물운'),
  health: makeFallbackCategoryFortune('health', '건강운'),
  academic: makeFallbackCategoryFortune('academic', '학업/직장운'),
  romance: makeFallbackCategoryFortune('romance', '연애/결혼운'),
  family: makeFallbackCategoryFortune('family', '가정운'),
};

// ---------------------------------------------------------------------------
//  Public builder
// ---------------------------------------------------------------------------

export function buildFortuneReport(
  saju: SajuSummary,
  targetDate: Date,
  springReport: SpringReport | null,
): FortuneReport {
  const currentAge = computeCurrentAge(saju, targetDate);

  // ── 1. Name compatibility (only when spring report is available) ──
  const nameCompatibility: NameCompatibilityCard | null = springReport
    ? safeCall(() => buildNameCompatibilityCard(springReport), null)
    : null;

  // ── 2. Overview summary ──
  const overviewSummary = safeCall(
    () => buildOverviewSummaryCard(saju),
    FALLBACK_OVERVIEW_SUMMARY,
  );

  // ── 3. Life fortune overview ──
  const lifeFortuneOverview = safeCall(
    () => buildLifeFortuneOverviewCard(saju),
    FALLBACK_LIFE_FORTUNE,
  );

  // ── 4. Personality ──
  const personality = safeCall(
    () => buildPersonalityCard(saju),
    FALLBACK_PERSONALITY,
  );

  // ── 5. Strengths & weaknesses ──
  const strengthsWeaknesses = safeCall(
    () => buildStrengthsWeaknessesCard(saju),
    FALLBACK_STRENGTHS_WEAKNESSES,
  );

  // ── 6. Cautions ──
  const cautions = safeCall(
    () => buildCautionsCard(saju),
    FALLBACK_CAUTIONS,
  );

  // ── 7. Period fortune cards ──
  const dailyFortune = safeCall(
    () => buildPeriodFortuneCard(saju, 'daily', targetDate),
    makeFallbackPeriodFortune('daily', '오늘'),
    'dailyFortune',
  );

  const weeklyFortune = safeCall(
    () => buildPeriodFortuneCard(saju, 'weekly', targetDate),
    makeFallbackPeriodFortune('weekly', '이번 주'),
    'weeklyFortune',
  );

  const monthlyFortune = safeCall(
    () => buildPeriodFortuneCard(saju, 'monthly', targetDate),
    makeFallbackPeriodFortune('monthly', '이번 달'),
    'monthlyFortune',
  );

  const yearlyFortune = safeCall(
    () => buildPeriodFortuneCard(saju, 'yearly', targetDate),
    makeFallbackPeriodFortune('yearly', '올해'),
    'yearlyFortune',
  );

  // ── 8. Life stage fortune ──
  const lifeStageFortune = safeCall(
    () => buildLifeStageFortuneCard(saju, currentAge),
    FALLBACK_LIFE_STAGE,
  );

  // ── 9. Category fortunes ──
  const categoryFortunes = safeCall(
    () => buildCategoryFortuneCards(saju, targetDate),
    FALLBACK_CATEGORY_FORTUNES,
  );

  // ── Meta ──
  const meta: ReportMeta = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
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
  };
}
