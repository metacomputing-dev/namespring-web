/**
 * types.ts -- Fortune report card type definitions
 *
 * Defines all types used by the card-based fortune report API.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  1. Re-exported input types
// ─────────────────────────────────────────────────────────────────────────────

import type { SajuSummary, BirthInfo } from '../types.js';
export type { SajuSummary, BirthInfo };

// ─────────────────────────────────────────────────────────────────────────────
//  2. Code types (used by elementMaps and card builders)
// ─────────────────────────────────────────────────────────────────────────────

/** 오행 코드 */
export type ElementCode = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';

/** 음양 코드 */
export type YinYangCode = 'YANG' | 'YIN';

/** 천간 코드 */
export type StemCode =
  | 'GAP' | 'EUL' | 'BYEONG' | 'JEONG' | 'MU'
  | 'GI' | 'GYEONG' | 'SIN' | 'IM' | 'GYE';

/** 지지 코드 */
export type BranchCode =
  | 'JA' | 'CHUK' | 'IN' | 'MYO' | 'JIN' | 'SA'
  | 'O' | 'MI' | 'SIN_BRANCH' | 'YU' | 'SUL' | 'HAE';

/** 십성 코드 */
export type TenGodCode =
  | 'BI_GYEON' | 'GEOB_JAE' | 'SIK_SHIN' | 'SANG_GWAN'
  | 'PYEON_JAE' | 'JEONG_JAE' | 'PYEON_GWAN' | 'JEONG_GWAN'
  | 'PYEON_IN' | 'JEONG_IN';

/** 12운성 코드 */
export type LifeStageCode =
  | 'JANGSEONG' | 'MOKYOK' | 'GWANDAE' | 'GEONROK' | 'JEWANG'
  | 'SWOE' | 'BYEONG' | 'SA' | 'MYO' | 'JEOL' | 'TAE' | 'YANG';

/** 신강도 분류 */
export type StrengthLevel = 'EXTREME_STRONG' | 'STRONG' | 'BALANCED' | 'WEAK' | 'EXTREME_WEAK';

/** 용신 부합도 등급 */
export type YongshinMatchGrade = 5 | 4 | 3 | 2 | 1;

// ─────────────────────────────────────────────────────────────────────────────
//  3. Fortune report card types
// ─────────────────────────────────────────────────────────────────────────────

/** 별점 (1~5) */
export type StarRating = 1 | 2 | 3 | 4 | 5;

/** 5대 운세 분야 */
export type FortuneCategory = 'wealth' | 'health' | 'academic' | 'romance' | 'family';

/** 기간 유형 */
export type FortunePeriodKind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'decade';

/** 조언 (텍스트 + 이유) */
export interface FortuneAdvice {
  readonly text: string;
  readonly reason: string;
}

/** 경고 신호 (신호 + 대응 + 이유) */
export interface FortuneWarning {
  readonly signal: string;
  readonly response: string;
  readonly reason: string;
}

// ── 카드 1: 이름 적합도 평가 ──────────────────────────────────────────────

export interface NameCompatibilityCard {
  readonly title: '이름 적합도 평가';
  readonly overallStars: StarRating;
  readonly overallScore: number;
  readonly sajuCompatibilityScore: number;
  readonly nameAnalysisScore: number;
  readonly summary: string;
  readonly details: string[];
}

// ── 카드 2: 총평 요약 ────────────────────────────────────────────────────

export interface PillarDisplay {
  readonly position: string;
  readonly stem: string;
  readonly branch: string;
  readonly element: string;
}

export interface OverviewSummaryCard {
  readonly title: '총평 요약';
  readonly pillars: PillarDisplay[];
  readonly dayMasterDescription: string;
  readonly strengthDescription: string;
  readonly yongshinDescription: string;
  readonly elementBalance: string;
  readonly overallSummary: string;
}

// ── 카드 3: 인생 운세 총평 ───────────────────────────────────────────────

export interface LifeFortuneOverviewCard {
  readonly title: '인생 운세 총평';
  readonly stars: StarRating;
  readonly summary: string;
  readonly highlights: string[];
}

// ── 카드 4: 나의 성향 ────────────────────────────────────────────────────

export interface PersonalityTrait {
  readonly trait: string;
  readonly description: string;
  readonly source: string;
}

export interface PersonalityCard {
  readonly title: '나의 성향';
  readonly traits: PersonalityTrait[];
  readonly summary: string;
}

// ── 카드 5: 나의 장/단점 ─────────────────────────────────────────────────

export interface StrengthsWeaknessesCard {
  readonly title: '나의 장/단점';
  readonly strengths: FortuneAdvice[];
  readonly weaknesses: FortuneAdvice[];
}

// ── 카드 6: 유의점 ───────────────────────────────────────────────────────

export interface CautionsCard {
  readonly title: '유의점';
  readonly cautions: FortuneWarning[];
}

// ── Time-series data ──────────────────────────────────────────────────────

/** Single data point for fortune time-series charts */
export interface FortuneTimeSeriesPoint {
  readonly label: string;
  readonly value: number;
}

/** Time-series data for period fortune charts */
export interface FortuneTimeSeries {
  readonly points: FortuneTimeSeriesPoint[];
}

// ── 카드 7: 기간별 운세 ──────────────────────────────────────────────────

export interface PeriodFortuneCard {
  readonly title: string;
  readonly periodKind: FortunePeriodKind;
  readonly periodLabel: string;
  readonly stars: StarRating;
  readonly summary: string;
  readonly goodActions: FortuneAdvice[];
  readonly badActions: FortuneAdvice[];
  readonly warning: FortuneWarning;
  readonly categoryScores: Record<FortuneCategory, StarRating>;
  readonly timeSeries?: FortuneTimeSeries;
}

// ── 카드 7b: 생애 시기별 운세 ────────────────────────────────────────────

export interface LifeStageFortuneEntry {
  readonly ageRange: string;
  readonly startAge: number;
  readonly endAge: number;
  readonly pillarDisplay: string;
  readonly stars: StarRating;
  readonly summary: string;
  readonly highlights: string[];
}

export interface LifeStageFortuneCard {
  readonly title: '생애 시기별 운세';
  readonly stages: LifeStageFortuneEntry[];
  readonly currentStageIndex: number | null;
}

// ── 카드 8: 5대 분야별 운세 ──────────────────────────────────────────────

export interface CategoryFortuneCard {
  readonly title: string;
  readonly category: FortuneCategory;
  readonly stars: StarRating;
  readonly summary: string;
  readonly advice: FortuneAdvice[];
  readonly caution: FortuneWarning | null;
}

// ── 운세 보고서 요청/응답 ────────────────────────────────────────────────

export interface FortuneReportRequest {
  readonly birth: import('../types.js').BirthInfo;
  readonly surname?: import('../types.js').NameCharInput[];
  readonly givenName?: import('../types.js').NameCharInput[];
  readonly targetDate?: string;
  readonly options?: import('../types.js').SpringOptions;
}

/** 보고서 메타데이터 */
export interface ReportMeta {
  readonly version: string;
  readonly generatedAt: string;
  readonly targetName?: string;
  readonly targetGender?: string;
  readonly engineVersion?: string;
}

export interface FortuneReport {
  readonly nameCompatibility: NameCompatibilityCard | null;
  readonly overviewSummary: OverviewSummaryCard;
  readonly lifeFortuneOverview: LifeFortuneOverviewCard;
  readonly personality: PersonalityCard;
  readonly strengthsWeaknesses: StrengthsWeaknessesCard;
  readonly cautions: CautionsCard;
  readonly dailyFortune: PeriodFortuneCard;
  readonly weeklyFortune: PeriodFortuneCard;
  readonly monthlyFortune: PeriodFortuneCard;
  readonly yearlyFortune: PeriodFortuneCard;
  readonly lifeStageFortune: LifeStageFortuneCard;
  readonly categoryFortunes: Record<FortuneCategory, CategoryFortuneCard>;
  readonly meta: ReportMeta;
}
