import type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from './core/model-types.js';
import type { FourframeMeaningEntry } from '../../seed-ts/src/database/fourframe-repository.js';
import type { ElementKey } from './core/scoring.js';

// ─────────────────────────────────────────────────────────────────────────────
//  1. INPUT TYPES
//     Describe what the caller sends to the Spring engine.
// ─────────────────────────────────────────────────────────────────────────────

/** Date, time, location, and gender of the person being named. */
export interface BirthInfo {
  readonly year?: number | null;
  readonly month?: number | null;
  readonly day?: number | null;
  readonly hour?: number | null;
  readonly minute?: number | null;
  readonly gender: 'male' | 'female' | 'neutral';
  readonly calendarType?: 'solar' | 'lunar';
  readonly isLeapMonth?: boolean;
  readonly region?: string;
  readonly city?: string;
  readonly birthPlace?: string;
  readonly timezone?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly name?: string;
}

/** A single character of a name in hangul, optionally paired with its hanja. */
export interface NameCharInput {
  readonly hangul: string;
  readonly hanja?: string;
}

/** Top-level request sent to the Spring engine. */
export interface SpringRequest {
  readonly birth: BirthInfo;
  readonly surname: NameCharInput[];
  readonly givenName?: NameCharInput[];
  readonly givenNameLength?: number;
  readonly mode?: 'auto' | 'evaluate' | 'recommend' | 'all';
  readonly options?: SpringOptions;
}

/** Fine-tuning knobs for a Spring request. */
export interface SpringOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly schoolPreset?: 'korean' | 'chinese' | 'modern';
  readonly sajuTimePolicy?: SajuTimePolicyOptions;
  readonly sajuConfig?: Record<string, unknown>;
  readonly sajuOptions?: SajuRequestOptions;
  readonly pureHangulNameMode?: 'auto' | 'on' | 'off';
  readonly useSurnameHanjaInPureHangul?: boolean;
  /** Opt-in toggles for internal-precision improvements. All sub-fields are
   *  optional and default to undefined / false, preserving existing behavior. */
  readonly precisionConfig?: PrecisionConfig;
}

/**
 * Opt-in precision toggles. Every flag is optional, default behavior is
 * preserved when no flag is set. Sub-fields are added by future PRs as
 * each precision improvement lands; the type is intentionally open-ended
 * (`readonly [key: string]: unknown`) so adding a new flag never breaks
 * existing callers.
 */
export interface PrecisionConfig {
  /** When true, route SajuCalculator's school-dependent weights through
   *  config/presets/<schoolPreset>.json instead of the default
   *  saju-scoring.json values. The 'korean' preset mirrors the current
   *  defaults exactly, so enabling this flag with schoolPreset='korean'
   *  (or unset) leaves behavior unchanged. */
  readonly useSchoolPreset?: boolean;

  // ── PR5: compatibility scoring opt-in modes ────────────────────────────
  // Each mode defaults to its first variant (= legacy behavior).
  // Enabling a non-default variant changes scoring behavior in a documented,
  // testable way; default-mode regression is preserved.

  /** Balance score algorithm.
   *  - 'mathematical' (default): saju-calculator.computeOptimalSorted —
   *    deficiency-fill toward the lowest-count element first.
   *  - 'yongshin_first': bonus for name elements that match the chart's
   *    yongshin element, on top of the mathematical score.
   *  - 'classical_jonggyeok_aware': in 종격 charts, do not penalize
   *    concentration on the dominant element. */
  readonly balanceMode?: 'mathematical' | 'yongshin_first' | 'classical_jonggyeok_aware';

  /** Yongshin score algorithm.
   *  - 'classical_blend' (default): affinity ⊕ recommendation blend.
   *  - 'chengbai_strict': additional penalty when yongshin confidence is low
   *    (≈ chengbai 패격 detection until saju-ts surfaces the explicit score). */
  readonly yongshinMode?: 'classical_blend' | 'chengbai_strict';

  /** Day-master strength integration.
   *  - 'binary' (default): isStrong toggle drives -1 / +1 direction.
   *  - 'continuous': use totalSupport / totalOppose as a graded intensity. */
  readonly strengthMode?: 'binary' | 'continuous';

  /** Ten-god scoring.
   *  - 'simple_count' (default): 1-per-pillar group counts.
   *  - 'positional_weighted': pillar weights from the saju-ts byPosition
   *    table (year/month/day/hour distinct, hidden stem ratios applied). */
  readonly tenGodMode?: 'simple_count' | 'positional_weighted';

  /** Gyeokguk-driven penalty curve.
   *  - 'jonggyeok_only' (default): single JONGGYEOK category, hard cliff
   *    at confidence ≥ 0.5.
   *  - 'multi_special': 9-way 종격 (deferred to a future PR — needs the
   *    adapter info richness from PR6).
   *  - 'chengbai_strict': replace the 0.5 cliff with a smooth tanh curve
   *    so confidence 0.49 vs 0.50 no longer flips the penalty on/off. */
  readonly gyeokgukMode?: 'jonggyeok_only' | 'multi_special' | 'chengbai_strict';

  readonly [key: string]: unknown;
}

/** High-level time-policy toggles bridged to saju-ts legacy config. */
export interface SajuTimePolicyOptions {
  readonly trueSolarTime?: 'on' | 'off';
  readonly longitudeCorrection?: 'on' | 'off';
  readonly yaza?: 'on' | 'off';
  readonly yazaMode?: '23:00' | '23:30';
}

/** Saju-specific request options (daeun count, saeun year range). */
export interface SajuRequestOptions {
  readonly daeunCount?: number;
  readonly saeunStartYear?: number | null;
  readonly saeunYearCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. OUTPUT TYPES
//     Describe what the Spring engine returns.
// ─────────────────────────────────────────────────────────────────────────────

/** Top-level response from the Spring engine. */
export interface SpringResponse {
  readonly request: SpringRequest;
  readonly mode: 'evaluate' | 'recommend' | 'all';
  readonly saju: SajuSummary;
  readonly candidates: SpringCandidate[];
  readonly totalCount: number;
  readonly meta: ResponseMeta;
}

/** Version and timestamp attached to every response. */
export interface ResponseMeta {
  readonly version: string;
  readonly timestamp: string;
}

/** A single name candidate with scores and detailed analysis. */
export interface SpringCandidate {
  readonly name: CandidateName;
  readonly scores: Record<'total' | 'hangul' | 'hanja' | 'fourFrame' | 'saju', number>;
  readonly analysis: CandidateAnalysis;
  readonly interpretation: string;
  readonly rank: number;
}

/** The full name of a candidate, split into surname and given name. */
export interface CandidateName {
  readonly surname: CharDetail[];
  readonly givenName: CharDetail[];
  readonly fullHangul: string;
  readonly fullHanja: string;
}

/** All analysis facets for a single candidate name. */
export interface CandidateAnalysis {
  readonly hangul: HangulAnalysis;
  readonly hanja: HanjaAnalysis;
  readonly fourFrame: FourFrameAnalysis;
  readonly saju: SajuCompatibility;
}

/** Properties of a single character (hangul + hanja + metadata). */
export interface CharDetail {
  readonly hangul: string;
  readonly hanja: string;
  readonly meaning: string;
  readonly strokes: number;
  readonly element: string;
  readonly polarity: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. SAJU ANALYSIS TYPES
//     The Four Pillars (saju) reading derived from the birth info.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete saju analysis for a person's birth chart.
 *
 * The index signature (`[key: string]: unknown`) is intentional:
 * downstream consumers may attach extra computed properties at runtime,
 * so this interface stays open for extension without requiring a code change.
 */
export interface SajuSummary {
  readonly pillars: Record<'year' | 'month' | 'day' | 'hour', PillarSummary>;
  readonly timeCorrection: TimeCorrectionSummary;
  readonly dayMaster: DayMasterSummary;
  readonly strength: StrengthSummary;
  readonly yongshin: YongshinSummary;
  readonly gyeokguk: GyeokgukSummary;
  readonly elementDistribution: Record<string, number>;
  readonly deficientElements: string[];
  readonly excessiveElements: string[];
  readonly cheonganRelations: CheonganRelationSummary[];
  readonly jijiRelations: JijiRelationSummary[];
  readonly tenGodAnalysis: TenGodSummary | null;
  readonly shinsalHits: ShinsalHitSummary[];
  readonly gongmang: [string, string] | null;
  readonly [key: string]: unknown;
}

/** The heavenly stem and earthly branch that form one pillar. */
export interface PillarSummary {
  readonly stem: PillarCode;
  readonly branch: PillarCode;
}

/** Code, hangul, and hanja for a single stem or branch. */
export interface PillarCode {
  readonly code: string;
  readonly hangul: string;
  readonly hanja: string;
}

/** How the raw birth time was adjusted (DST, longitude, equation of time). */
export interface TimeCorrectionSummary {
  readonly standardYear: number;
  readonly standardMonth: number;
  readonly standardDay: number;
  readonly standardHour: number;
  readonly standardMinute: number;
  readonly adjustedYear: number;
  readonly adjustedMonth: number;
  readonly adjustedDay: number;
  readonly adjustedHour: number;
  readonly adjustedMinute: number;
  readonly dstCorrectionMinutes: number;
  readonly longitudeCorrectionMinutes: number;
  readonly equationOfTimeMinutes: number;
}

/** The day master (il-gan): the stem of the day pillar. */
export interface DayMasterSummary {
  readonly stem: string;
  readonly element: string;
  readonly polarity: string;
}

/** Whether the day master is strong or weak, and how that was determined. */
export interface StrengthSummary {
  readonly level: string;
  readonly isStrong: boolean;
  readonly totalSupport: number;
  readonly totalOppose: number;
  readonly deukryeong: number;
  readonly deukji: number;
  readonly deukse: number;
  readonly details: string[];
}

/** The recommended balancing element (yongshin) and related elements. */
export interface YongshinSummary {
  readonly element: string;
  readonly heeshin: string | null;
  readonly gishin: string | null;
  readonly gushin: string | null;
  readonly confidence: number;
  readonly agreement: string;
  readonly recommendations: YongshinRecommendation[];
}

/** A single yongshin recommendation with its rationale. */
export interface YongshinRecommendation {
  readonly type: string;
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}

/** The structural pattern (gyeokguk) of the birth chart. */
export interface GyeokgukSummary {
  readonly type: string;
  readonly category: string;
  readonly baseTenGod: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}

/** A relationship between two heavenly stems (cheongan). */
export interface CheonganRelationSummary {
  readonly type: string;
  readonly stems: string[];
  readonly resultElement: string | null;
  readonly note: string;
  readonly score: CheonganRelationScore | null;
}

/** Numeric breakdown of a heavenly-stem relation's score. */
export interface CheonganRelationScore {
  readonly baseScore: number;
  readonly adjacencyBonus: number;
  readonly outcomeMultiplier: number;
  readonly finalScore: number;
  readonly rationale: string;
}

/** A relationship between earthly branches (jiji). */
export interface JijiRelationSummary {
  readonly type: string;
  readonly branches: string[];
  readonly note: string;
  readonly outcome: string | null;
  readonly reasoning: string | null;
}

/** Ten-god analysis for each pillar position. */
export interface TenGodSummary {
  readonly dayMaster: string;
  readonly byPosition: Record<string, TenGodPosition>;
}

/** Ten-god detail for one pillar position. */
export interface TenGodPosition {
  readonly cheonganTenGod: string;
  readonly jijiPrincipalTenGod: string;
  readonly hiddenStems: HiddenStem[];
  readonly hiddenStemTenGod: HiddenStemTenGod[];
}

/** A hidden stem inside an earthly branch. */
export interface HiddenStem {
  readonly stem: string;
  readonly element: string;
  readonly ratio: number;
}

/** The ten-god label for a hidden stem. */
export interface HiddenStemTenGod {
  readonly stem: string;
  readonly tenGod: string;
}

/** A divine-sha (shinsal) hit and its weighted score. */
export interface ShinsalHitSummary {
  readonly type: string;
  readonly position: string;
  readonly grade: string;
  readonly baseWeight: number;
  readonly positionMultiplier: number;
  readonly weightedScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. COMPATIBILITY & ADAPTER TYPES
//     Used to bridge saju analysis with name scoring.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  4-A. NEW PUBLIC API TYPES
//       Three dedicated report types for the new 3-method API.
// ─────────────────────────────────────────────────────────────────────────────

/** A single four-frame entry with meaning data included. */
export interface NamingReportFrame {
  readonly type: 'won' | 'hyung' | 'lee' | 'jung';
  readonly strokeSum: number;
  readonly element: string;
  readonly polarity: string;
  readonly luckyLevel: number;
  readonly meaning: FourframeMeaningEntry | null;
}

/** Four-frame analysis with enriched frame data. */
export interface NamingReportFourFrame {
  readonly frames: NamingReportFrame[];
  readonly elementScore: number;
  readonly luckScore: number;
}

/** Pure name analysis result (no saju). Returned by getNamingReport(). */
export interface NamingReport {
  readonly name: CandidateName;
  readonly totalScore: number;
  readonly scores: { hangul: number; hanja: number; fourFrame: number };
  readonly analysis: {
    readonly hangul: HangulAnalysis;
    readonly hanja: HanjaAnalysis;
    readonly fourFrame: NamingReportFourFrame;
  };
  readonly interpretation: string;
}

/** Saju analysis result with module availability flag. Returned by getSajuReport(). */
export type SajuReport = SajuSummary & {
  readonly sajuEnabled: boolean;
};

/** Gender tendency inferred from name-stat birth distribution. */
export type NameGenderTendency = 'male' | 'female' | 'unknown';

/** Combined name + saju report. Returned by getNameCandidates(). */
export interface SpringReport {
  readonly finalScore: number;
  readonly popularityRank: number | null;
  readonly maleRatio: number | null;
  readonly nameGender: NameGenderTendency;
  readonly namingReport: NamingReport;
  readonly sajuReport: SajuReport;
  readonly sajuCompatibility: SajuCompatibility;
  readonly combinedDistribution: Record<ElementKey, number>;
  rank: number;
}

/** Lightweight candidate item for list pages. */
export interface SpringCandidateSummary {
  readonly finalScore: number;
  readonly fullHangul: string;
  readonly fullHanja: string;
  readonly givenHangul: string;
  readonly givenName: NameCharInput[];
  readonly popularityRank: number | null;
  readonly maleRatio: number | null;
  readonly nameGender: NameGenderTendency;
  rank: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  4-B. COMPATIBILITY & ADAPTER TYPES
//       Used to bridge saju analysis with name scoring.
// ─────────────────────────────────────────────────────────────────────────────

/** How well a name's elemental makeup aligns with the saju yongshin. */
export interface SajuCompatibility {
  readonly yongshinElement: string;
  readonly heeshinElement: string | null;
  readonly gishinElement: string | null;
  readonly nameElements: string[];
  readonly yongshinMatchCount: number;
  readonly gishinMatchCount: number;
  readonly dayMasterSupportScore: number;
  readonly affinityScore: number;
}

/** Lightweight saju summary used by the SajuCalculator adapter. */
export interface SajuOutputSummary {
  dayMaster?: { element: ElementKey };
  strength?: { isStrong: boolean; totalSupport: number; totalOppose: number };
  yongshin?: SajuYongshinSummary;
  tenGod?: { groupCounts: Record<string, number> };
  gyeokguk?: { category: string; type: string; confidence: number };
  deficientElements?: string[];
  excessiveElements?: string[];
}

/** Yongshin details as returned by the saju calculator. */
export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  recommendations: YongshinRecommendation[];
}
