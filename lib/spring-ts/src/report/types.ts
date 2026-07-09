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
  CandidateStrengthProfile, NamingScoreVector, TenGodPositionEvidence,
  NameElementStrategyEvidence, SajuNameSafetyProfile, SajuNameSafetyPosture,
  SourceTierMetadata,
} from '../types.js';
import type { NameTrendAnalysis } from '../name-trend.js';
import type { PhoneticAnalysis } from '../phonetic-rules.js';
import type { SchoolPresetMetadata } from '../preset-loader.js';
export type {
  SajuSummary, BirthInfo,
  SajuAxisStrengthMap, EvidenceRow, SajuJudgmentStrength, CounterexampleRow,
  CandidateStrengthProfile, NamingScoreVector, TenGodPositionEvidence,
  NameElementStrategyEvidence, SajuNameSafetyProfile, SajuNameSafetyPosture,
};
export type { NameTrendAnalysis } from '../name-trend.js';
export type { PhoneticAnalysis } from '../phonetic-rules.js';

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
  readonly scoreVector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
  readonly nameTrend?: NameTrendAnalysis;
  readonly phonetic?: PhoneticAnalysis;
  readonly safetyProfile?: SajuNameSafetyProfile;
  readonly elementStrategyEvidence?: NameElementStrategyEvidence;
  readonly tenGodPositionEvidence?: TenGodPositionEvidence;
  readonly summary: string;
  readonly details: string[];
  /** Per-axis judgment strength (PR-J-8b). Optional. Note: this card
   *  is anchored on SpringReport (not SajuSummary), so the underlying
   *  axisStrength here represents how confident the *name compatibility
   *  evaluation* is — distinct from saju-axis confidences. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing the name-compatibility rating
   *  (PR-J-8b). Anchors on overall / saju-compatibility / name-analysis
   *  sub-scores so the consumer can trace how the headline star count
   *  was derived. */
  readonly evidence?: readonly EvidenceRow[];
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
  /** Per-axis judgment strength (PR-J-5c). Mirrors the 4-tier model on
   *  OverviewSummaryCard / PersonalityCard / StrengthsWeaknessesCard.
   *  Optional. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing the life-fortune star rating
   *  and highlights (PR-J-5c). Pulls from yongshin axis + gyeokguk
   *  encyclopedia so the consumer can render "이 별점은 어떤 근거인가?"
   *  beneath the headline rating. */
  readonly evidence?: readonly EvidenceRow[];
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
  /** Per-axis judgment strength (PR-J-5b). Same 4-tier hedge model as
   *  OverviewSummaryCard / PersonalityCard. Optional. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing each strength / weakness claim
   *  (PR-J-5b). Pulls from PR-J-1's gyeokguk success rules and PR-J-2's
   *  ten-god expert tone so a UI can surface the chart features that
   *  drove each item. */
  readonly evidence?: readonly EvidenceRow[];
}

// ── 카드 6: 유의점 ───────────────────────────────────────────────────────

export interface CautionsCard {
  readonly title: '유의점';
  readonly cautions: FortuneWarning[];
  /** Per-axis judgment strength (PR-J-6). Allows the consumer to dial
   *  down the urgency of cautions whose underlying axis is low-confidence.
   *  Optional. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Counterexample rows surfacing chart configurations under which a
   *  caution should weaken or revise (PR-J-6). Per F-A7's framing, every
   *  CautionsCard row is already a warning — counterexamples expose the
   *  conditions where the warning does NOT apply. Optional. */
  readonly counterexamples?: readonly CounterexampleRow[];
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
  /** Per-axis judgment strength (PR-J-7a). Same 4-tier model.
   *  Optional. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing the period star rating + tone
   *  (PR-J-7a). Anchors on the period pillar's stem/branch element vs
   *  yongshin / gishin so the consumer can render "이 별점은 왜?" beneath
   *  each daily / weekly / monthly / yearly card. */
  readonly evidence?: readonly EvidenceRow[];
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
  /** Per-axis judgment strength (PR-J-7b). Optional. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing the life-stage rating + flow
   *  (PR-J-7b). Anchors on daewoon transitions + the chart's yongshin
   *  alignment so the consumer can render "왜 이 시기에 별점이 좋은가?"
   *  beneath the stage list. */
  readonly evidence?: readonly EvidenceRow[];
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
  /** Per-axis judgment strength (PR-J-8a). Optional. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing the category star + advice
   *  (PR-J-8a). Anchors on the category's primary element vs the
   *  chart's yongshin/gishin so the consumer can render "이 영역의
   *  별점은 어떤 근거인가?" beneath each card. */
  readonly evidence?: readonly EvidenceRow[];
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
  readonly schoolPreset?: SchoolPresetMetadata;
  readonly uncertainties?: readonly ReportUncertainty[];
}

export interface ReportUncertainty {
  readonly id: string;
  readonly severity: 'info' | 'medium' | 'high';
  readonly message: string;
  readonly affectedAxes: readonly string[];
  readonly affectedAxisLabels?: readonly string[];
  readonly fallback?: {
    readonly hour: number;
    readonly minute: number;
    readonly timezone: string;
  };
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
  /** Optional 2-D tiered fortune matrix (period × category × depth).
   *  Surfaced only when `precisionConfig.surfaceTieredMatrix === true`,
   *  otherwise undefined. NameSpring backward-compat preserved. */
  readonly tieredMatrix?: FortuneTieredMatrix;
  /** 0~100세 대운·세운 블렌드 커브 — tieredMatrix와 같은 opt-in 조건에서만 실림.
   *  점수 정본 규칙: 별점(칩·카드)이 정본, 커브는 시각화용 파생. */
  readonly lifeCurve?: import('./cards/life-curve-card.js').LifeCurveCard;
  /** 미사용 엔진 출력(신살·공망·관계·지장간·대운 정체)의 정규화 방출 —
   *  surfaceInsightFacts opt-in + 성인 대상자 전용. 해석 없는 fact는 렌더 생략. */
  readonly insightFacts?: import('./cards/insight-facts-card.js').InsightFactsCard;
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. TIERED FORTUNE MATRIX (period × category × depth)
//
//  A fully orthogonal "fortune cube" surfaced when
//  `precisionConfig.surfaceTieredMatrix === true`. Replaces nothing —
//  existing cards (overviewSummary / dailyFortune / categoryFortunes / ...)
//  remain the source of truth for default-mode callers. The tiered matrix
//  is populated from `data/narrative/**` (AI-derived T1_HYPOTHESIS material
//  per `docs/NO_AI_POLICY.md`); scoring code never imports it.
// ─────────────────────────────────────────────────────────────────────────────

/** Period axis. Distinct from existing `FortunePeriodKind`:
 *    - `today / thisWeek / thisMonth / thisYear` are calendar-relative
 *      (anchored on the report's `targetDate`).
 *    - `daily / weekly / monthly / yearly` (legacy) are saju-relative
 *      (anchored on birth pillars).
 *  `life` is a single chart-wide reading (≈ existing `lifeFortuneOverview`). */
export type TieredPeriodKind = 'life' | 'today' | 'thisWeek' | 'thisMonth' | 'thisYear';

/** Category axis. 5 base + 5 extended = 10 categories.
 *  Mirrors `FortuneCategoryExtended` so a UI can map cells to existing
 *  `CategoryFortuneCard` rows when present. The matrix also carries an
 *  `overall` (총운) cell per period, separate from these 10. */
export type TieredCategoryId =
  | 'wealth' | 'health' | 'academic' | 'romance' | 'family'
  | 'career' | 'study_document' | 'expression_children'
  | 'health_stress' | 'movement';

/** Depth axis — three independent text tiers per cell. */
export type TieredDepth = 'brief' | 'standard' | 'expert';

/** Age band used for narrative gating. Korean conventional 7-band split. */
export type TieredAgeBand = '0-9' | '10-19' | '20-29' | '30-39' | '40-54' | '55-69' | '70+';

/** User-facing life-stage bands exposed for the period UI. */
export type TieredLifeStageBand =
  | '10-19' | '20-29' | '30-39' | '40-49' | '50-59'
  | '60-69' | '70-79' | '80-89' | '90-99' | '100-109';

/** Tag taxonomy for inline `#용신` / `#천을귀인` references. */
export type TagCategory =
  | 'element' | 'tenGod' | 'gyeokguk' | 'shinsal' | 'pillar'
  | 'palace' | 'naeum' | 'yongshin' | 'gungsil' | 'compatibility';

/** Stable string identifier for a glossary entry (e.g., `"yongshin"`,
 *  `"cheonleulgwiin"`). Matches `GlossaryEntry.id`. */
export type TagId = string;

/** Token in a tagged paragraph. Token-based (not char-offset) so FE
 *  escaping / normalization / line-wrapping cannot desync the tag boundary. */
export type ParagraphToken =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'tag'; readonly tagId: TagId; readonly label: string };

/** A paragraph composed of inline-tagged tokens.
 *  `plainText` is derived (search / accessibility); the canonical view is
 *  `tokens`. */
export interface TaggedParagraph {
  readonly tokens: readonly ParagraphToken[];
  readonly plainText: string;
}

/** Brief tier — 1-2 sentence summary suitable for elementary/middle-school
 *  reading level. The accompanying `stars` lives on the parent `TieredFortune`. */
export interface BriefFortuneText {
  readonly headline: string;
  readonly hook?: string;
}

/** Standard tier — multi-paragraph user-friendly narrative with
 *  metaphors, living tips, and cautions. ~5 paragraphs typical, no hard cap. */
export interface StandardFortuneText {
  readonly paragraphs: readonly TaggedParagraph[];
  readonly livingTips?: readonly string[];
  readonly cautions?: readonly string[];
}

/** Expert tier — academic / classical reasoning with inline `#태그` and
 *  optional numerical evidence. Tags resolve via the report's `glossary`. */
export interface ExpertFortuneText {
  readonly paragraphs: readonly TaggedParagraph[];
  readonly numericalEvidence?: readonly NumericalEvidenceRow[];
}

export interface TieredSelectedFragmentEvidence {
  readonly fragmentId: string;
  readonly gating: Readonly<Record<string, readonly string[]>>;
  readonly tags: readonly string[];
}

export interface TieredSelectedFragments {
  readonly brief?: TieredSelectedFragmentEvidence;
  readonly standard?: TieredSelectedFragmentEvidence;
  readonly expert?: TieredSelectedFragmentEvidence;
}

/** Numeric backing for an expert claim (e.g., 용신 부합도 점수).
 *  `sourceTier` is required because expert-tier numbers must clear the
 *  NO_AI_POLICY gate — even when the prose is AI-derived, the number must
 *  trace back to deterministic engine output. */
export interface NumericalEvidenceRow {
  readonly label: string;
  readonly value: number;
  readonly unit?: string;
  readonly sourceTier: SourceTierMetadata;
}

/** A single matrix cell. Three depth tiers + meaningfulness indicator + stars. */
export interface TieredFortune {
  /** Whether this period × category cross-product is meaningful for this
   *  chart. UI can dim / hide non-meaningful cells. */
  readonly meaningfulness: 'meaningful' | 'limited' | 'na';
  /** 1-5 star rating, or `null` when `meaningfulness === 'na'`
   *  (distinguishes "not applicable" from a 3-star "average" reading). */
  readonly stars: StarRating | null;
  readonly brief: BriefFortuneText;
  readonly standard: StandardFortuneText;
  readonly expert: ExpertFortuneText;
  /** Deterministic narrative source trace for QA / expert-detail UIs. */
  readonly selectedFragments?: TieredSelectedFragments;
  /** Per-axis judgment strength (reuse from existing card surfaces). */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** Optional row-level evidence backing this cell's claims. */
  readonly evidence?: readonly EvidenceRow[];
}

/** Metadata about the period axis (which pillar / element drives it). */
export interface TieredPeriodMeta {
  readonly stems?: ReadonlyArray<{ readonly position: string; readonly stem: string; readonly element: string }>;
  readonly branches?: ReadonlyArray<{ readonly position: string; readonly branch: string; readonly element: string }>;
  /** Free-form note describing the period anchor — e.g., "이번 달 戊辰 — 무토와 진토가 만나". */
  readonly relativeNote?: string;
  /** Deterministic luck-pillar annotation evidence for the period anchor. */
  readonly transitEvidence?: readonly string[];
}

/** A life-period cell group for one user-facing 10-year age band. */
export interface AgeBandScopedFortunes {
  readonly periodKind: 'life';
  readonly ageBand: TieredLifeStageBand;
  /** The authored narrative gating band used internally for fragment selection. */
  readonly selectorAgeBand: TieredAgeBand;
  readonly startAge: number;
  readonly endAge: number;
  readonly representativeAge: number;
  readonly periodLabel: string;
  readonly periodMeta: TieredPeriodMeta;
  /** Total fortune for this life-stage band. */
  readonly overall: TieredFortune;
  readonly byCategory: Readonly<Record<TieredCategoryId, TieredFortune>>;
}

/** A life-period cell group for one PERSONAL daeun(大運) segment.
 *  byAgeBand(달력 10년)와 달리 경계·라벨이 개인 대운을 그대로 따른다 —
 *  periodLabel도 대운 나이 범위라 본문 {{periodLabel}} 직조와 칩 라벨이 일치. */
export interface DaeunScopedFortunes extends AgeBandScopedFortunes {
  readonly daeunIndex: number;
  /** 대운 간지 표시 (예: '갑자'). */
  readonly pillarDisplay: string;
  /** '13세~22세' — 표기용 정수 나이 규약 (반올림 유파 표기 오프셋 반영, 감사 B11). */
  readonly ageLabel: string;
  /** 60갑자별 저작 리드 문장 (daeun-leads.insights.json). 같은 버킷×등급으로
   *  본문이 겹치는 인접 대운도 이 리드로 그 간지 고유의 글로 읽힌다. 없으면 생략. */
  readonly daeunLead?: string;
}

/** All cells for one period of the matrix: total + 10 categories. */
export interface PeriodScopedFortunes {
  readonly periodKind: TieredPeriodKind;
  /** User-facing label, e.g., "올해 (2026년)" / "이번 주" / "오늘 (5월 2일)". */
  readonly periodLabel: string;
  readonly periodMeta: TieredPeriodMeta;
  /** 총운 — period-level summary across all categories. */
  readonly overall: TieredFortune;
  readonly byCategory: Readonly<Record<TieredCategoryId, TieredFortune>>;
  /** Life-only: precomputed 10-year bands so UI period selection can switch content. */
  readonly byAgeBand?: Readonly<Record<TieredLifeStageBand, AgeBandScopedFortunes>>;
  /** Life-only: 개인별 대운 구간 단위 셀 (정통 축 — UI 선택 칩의 1차 소스).
   *  byAgeBand는 호환용으로 병존하며 점진 폐기 예정. */
  readonly byDaeun?: readonly DaeunScopedFortunes[];
}

/** A single glossary entry behind an inline `#태그`.
 *  Authored entries live in `data/narrative/_glossary/<tagId>.json`. */
export interface GlossaryEntry {
  readonly id: TagId;
  readonly label: string;
  readonly hashLabel: string;
  readonly category: TagCategory;
  /** One-line definition aimed at elementary / middle-school readers. */
  readonly brief: string;
  /** Multi-paragraph definition, may include analogies and classical
   *  reasoning. Plain text — no tokens (no nested glossary references). */
  readonly detailed: string;
  readonly classicalSource?: SourceTierMetadata;
  readonly related: readonly TagId[];
}

/** Glossary attached to a single tiered matrix.
 *  `entries` is the lookup table; `usedInThisReport` lists the IDs that
 *  actually appear in any cell so a UI can pre-render only those. */
export interface TagGlossary {
  readonly entries: Readonly<Record<TagId, GlossaryEntry>>;
  readonly usedInThisReport: readonly TagId[];
}

/** Top-level metadata for a tiered matrix instance. */
export interface TieredMatrixMeta {
  readonly schemaVersion: 'spring-ts.tiered-matrix.v1';
  readonly generatedAt: string;
  /** Deterministic seed used to pick fragments from variant pools.
   *  Same input → same fragment selection. Hash of
   *  (birth + targetDate + period + category + depth). */
  readonly selectionSeed: string;
  /** Frozen contract version this matrix was built against
   *  (`data/narrative/_contract/v1.json`). */
  readonly templateContractVersion: string;
  /** Whether cell text is placeholder (Phase 1 stub) or fully authored
   *  (Phase 2 fan-out output). NameSpring can render either. */
  readonly contentSource: 'placeholder' | 'authored';
  readonly fragmentCount: number;
  readonly aiGeneratedFragmentCount: number;
}

export type TieredNameFrameStage = 'earlyLife' | 'youthLife' | 'middleLife' | 'lateAndTotal';
export type TieredNameFrameType = 'won' | 'hyung' | 'lee' | 'jung';

/** Seed-ts four-frame naming evidence that can support broad life-stage
 *  readings (early/youth/middle/late-total) without changing saju scoring. */
export interface TieredNameFrameEvidence {
  readonly source: 'seed-ts.fourframe';
  readonly stage: TieredNameFrameStage;
  readonly label: string;
  readonly frameType: TieredNameFrameType;
  readonly strokeSum: number;
  readonly element: string;
  readonly elementLabel?: string;
  readonly polarity: string;
  readonly luckyLevel: number;
  readonly title?: string;
  readonly summary?: string;
  readonly lifePeriodInfluence?: string | null;
}

export interface TieredNamingEvidence {
  readonly source: 'spring-ts.namingReport.analysis.fourFrame';
  readonly fourFrameScore: number;
  readonly luckScore: number;
  readonly elementScore: number;
  readonly frames: readonly TieredNameFrameEvidence[];
}

/** Top-level tiered matrix container. Attached to `FortuneReport.tieredMatrix`
 *  when `precisionConfig.surfaceTieredMatrix === true`. */
/** A1 cross-cell synthesis — one plain-language profile composed from the
 *  person's measured category grades (the 10-category star pattern). The grade
 *  vector is a fingerprint, so this reads as "about ME" while exposing zero
 *  saju jargon (general-tier plain language). Optional/additive: absent when
 *  too few categories are graded. */
export interface TieredPersonalReading {
  readonly source: 'spring-ts.tiered.personalReading';
  /** One plain-language sentence naming the high/low pattern. */
  readonly headline: string;
  /** 2-3 plain sentences elaborating the profile. Jargon-free. */
  readonly paragraph: string;
  /** Categories that graded high (⭐≥4), most-notable first. */
  readonly highlights: readonly TieredCategoryId[];
  /** Categories that graded low (⭐≤2), for optional gentle framing. */
  readonly cautions: readonly TieredCategoryId[];
}

/** N1 name↔saju reinforcement — one grounded plain-language sentence about how
 *  the name supports the chart's needed element. Jargon-free, conditioned on the
 *  real `yongshinMatchCount` (honest when zero). Optional/additive: absent when
 *  no name/compatibility data is available or the yongshin is unresolved. */
export interface TieredNameSajuReading {
  readonly source: 'spring-ts.tiered.nameSajuReading';
  /** One plain sentence about the name's timing benefit. No jargon. */
  readonly sentence: string;
  /** Does the name carry the needed (yongshin) element at all? */
  readonly reinforces: boolean;
  /** How many name characters carry the needed element. */
  readonly yongshinMatchCount: number;
}

export interface FortuneTieredMatrix {
  readonly schemaVersion: 'spring-ts.tiered-matrix.v1';
  readonly periods: Readonly<Record<TieredPeriodKind, PeriodScopedFortunes>>;
  readonly glossary: TagGlossary;
  readonly namingEvidence?: TieredNamingEvidence;
  /** A1 cross-cell synthesis reading (optional/additive). */
  readonly personalReading?: TieredPersonalReading;
  /** N1 name↔saju reinforcement sentence (optional/additive). */
  readonly nameSajuReading?: TieredNameSajuReading;
  readonly meta: TieredMatrixMeta;
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
  /** Whether `CategoryFortuneCard.subDomains` is populated (PR-K-1 wire-up,
   *  spec spring-info/09_finalization/02_event_domain_wireup.md §4).
   *  Default unset/false = subDomains stays undefined (PR12 contract).
   *  When true, builder populates 1-3 sub-domain rows per card drawing on
   *  saju_master/event_domain_map.py FINE_DOMAIN_KEYWORDS + TEN_GOD_TOPIC_HINTS. */
  readonly surfaceSubDomains?: boolean;
  /** Surface the tiered fortune matrix (`FortuneReport.tieredMatrix`).
   *  Default unset / false. Mirrors `PrecisionConfig.surfaceTieredMatrix`. */
  readonly surfaceTieredMatrix?: boolean;
  /** Surface `FortuneReport.insightFacts` (전문 인사이트 원자료).
   *  Default unset / false. 성인 대상자에게만 빌드된다(미성년 페이로드 제외). */
  readonly surfaceInsightFacts?: boolean;
  /** Report-wide selected doctrine lens and whether it affected scoring. */
  readonly schoolPreset?: SchoolPresetMetadata;
}
