/**
 * types.ts -- Fortune report card type definitions
 *
 * Defines all types used by the card-based fortune report API.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  1. Re-exported input types
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SajuSummary, BirthInfo,
  SajuAxisStrengthMap, EvidenceRow, SajuJudgmentStrength, CounterexampleRow,
} from '../types.js';
export type {
  SajuSummary, BirthInfo,
  SajuAxisStrengthMap, EvidenceRow, SajuJudgmentStrength, CounterexampleRow,
};

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

/** Extended category union (PR12). Adds 4 saju_master event_domain_map
 *  parallels that the original 5 collapsed:
 *    - career             별도 직업운 (관성 중심) — 기존 'academic' 라벨 위에 분리
 *    - study_document     학업 / 문서 (인성 중심) — 기존 'academic' 의 study 측면
 *    - expression_children 표현 / 자녀 (식상 중심) — 기존 'academic' 의 output 측면
 *    - health_stress      건강 / 스트레스 (조후 + 충해) — 기존 'health' 강화
 *    - movement           이동 / 변동 (역마 + 충) — 신규 도메인
 *  Cards (today) carry only the 5-element FortuneCategory; `subDomains`
 *  surfaces additional 도메인 detail when present. */
export type FortuneCategoryExtended =
  | FortuneCategory
  | 'career'
  | 'study_document'
  | 'expression_children'
  | 'health_stress'
  | 'movement';

/** A sub-domain row inside a `CategoryFortuneCard` (PR12). Each row carries
 *  a finer-grained life-domain breakdown so a UI can render
 *  "재물 안에서도 정재(안정)는 좋고 편재(투자)는 주의" 같은 differentiation. */
export interface CategoryFortuneSubDomain {
  readonly name: FortuneCategoryExtended;
  readonly title: string;
  readonly stars: StarRating;
  readonly narrative: string;
}

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
  /** Per-axis judgment strength (PR9). Mirrors `SajuOutputSummary.axisStrength`
   *  so the consuming UI can apply hedge wording or render a strength
   *  indicator next to each claim. Optional — absent when the upstream saju
   *  engine doesn't report axis confidences. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing each claim in this card (PR9).
   *  Each row carries the supporting chart features and (when known) a
   *  weakness condition under which the claim should be revised. */
  readonly evidence?: readonly EvidenceRow[];
  /** PR10 — narrative-style variant texts. Populated when
   *  `precisionConfig.narrativeStyle` selects the matching style or 'sideBySide'. */
  readonly expertText?: string;
  readonly plainText?: string;
  readonly counselorText?: string;
  /** PR10 — counterexample rows. Each row lists a weakening condition +
   *  the revised claim to use when that condition holds. */
  readonly counterexamples?: readonly CounterexampleRow[];
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
  /** Per-axis judgment strength (PR-J-5a). Mirrors the same 4-tier hedge
   *  model that OverviewSummaryCard uses, so the consumer can dial down
   *  confidence on traits sourced from low-confidence axes (yongshin /
   *  gyeokguk / strength). Optional. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing personality claims (PR-J-5a).
   *  Surfaces the chart features that drove each trait — e.g. the day
   *  master + classical imagery for the dayMaster row, the gyeokguk
   *  principle for the gyeokguk row, 천간/지지 relations for the
   *  relations row. Empty when no axis can supply rows. */
  readonly evidence?: readonly EvidenceRow[];
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
  /** Optional sub-domain rows (PR12). When present, the UI can render
   *  finer-grained 도메인 breakdowns alongside the headline `summary`.
   *  saju_master/event_domain_map.py is the doctrine reference. */
  readonly subDomains?: readonly CategoryFortuneSubDomain[];
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

/** Optional knobs forwarded to buildFortuneReport / buildPeriodFortuneCard.
 *  Each field is optional and falls through to the legacy default when
 *  unset, so existing callers that pass no options observe no change. */
export interface FortuneReportOptions {
  /** Boundary precision for monthly fortune lookup (PR7). */
  readonly fortuneCascadeMode?: 'simple' | 'jie_based' | 'full_5layer';
  /** Narrative style for cards that surface variant texts (PR10). */
  readonly narrativeStyle?: 'expert' | 'plain' | 'counselor' | 'sideBySide';
  /** Reading focus — drives saju_master/situational_tone_engine routing
   *  in cards that surface focus-aware text (PR10). */
  readonly readingFocus?:
    | 'auto' | 'full'
    | 'career' | 'wealth' | 'relationship'
    | 'study_document' | 'expression_children'
    | 'health_stress' | 'movement' | 'family';
}
