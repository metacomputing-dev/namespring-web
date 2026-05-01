import type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from './core/model-types.js';
import type { FourframeMeaningEntry } from '../../seed-ts/src/database/fourframe-repository.js';
import type { ElementKey } from './core/scoring.js';
import type { HanjaLegalStatus } from './hanja-annotations.js';
import type { HanjaUnihanMetadata, RadicalElementHint } from './hanja-unihan.js';
import type { NameTrendAnalysis } from './name-trend.js';
import type { PhoneticAnalysis } from './phonetic-rules.js';

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
  readonly legalStatus?: HanjaLegalStatus;
  readonly legalRegistrable?: boolean;
  readonly isVariantOf?: string;
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
   *    (≈ chengbai 패격 detection until saju-ts surfaces the explicit score).
   *  - 'consensus_aware': blends final yongshin affinity with the consensus
   *    scoreboard's competing elements when independent methods disagree. */
  readonly yongshinMode?: 'classical_blend' | 'chengbai_strict' | 'consensus_aware';

  /** Day-master strength integration.
   *  - 'binary' (default): isStrong toggle drives -1 / +1 direction.
   *  - 'continuous': use totalSupport / totalOppose as a graded intensity. */
  readonly strengthMode?: 'binary' | 'continuous';

  /** Ten-god scoring.
   *  - 'simple_count' (default): 1-per-pillar group counts.
   *  - 'positional_weighted': pillar weights from the saju-ts byPosition
   *    table (year/month/day/hour distinct, hidden stem ratios applied). */
  readonly tenGodMode?: 'simple_count' | 'positional_weighted' | 'positional_weighted_v2';

  /** Gyeokguk-driven penalty curve.
   *  - 'jonggyeok_only' (default): single JONGGYEOK category, hard cliff
   *    at confidence ≥ 0.5.
   *  - 'multi_special': 9-way 종격 (deferred to a future PR — needs the
   *    adapter info richness from PR6).
   *  - 'chengbai_strict': replace the 0.5 cliff with a smooth tanh curve
   *    so confidence 0.49 vs 0.50 no longer flips the penalty on/off. */
  readonly gyeokgukMode?: 'jonggyeok_only' | 'multi_special' | 'chengbai_strict';

  /** Month-gyeok selector policy.
   *  Default unset preserves the existing saju-ts month-gyeok selector.
   *  - 'monthly_main': use the month branch main hidden stem.
   *  - 'jungki_transparent': internal/expert opt-in; use the month branch
   *    middle hidden stem only when that stem is transparent in a non-day
   *    heavenly stem, otherwise fall back to monthly_main. */
  readonly gyeokgukSelectionRule?: 'monthly_main' | 'jungki_transparent';

  /** Fortune-cascade boundary precision (PR7).
   *  - 'simple' (default): solar-month approximation. Fast but 절기 boundary
   *    오차가 평균 ±5 일 발생 (12 절기 × 5 일 ≈ 60 일/년 ≈ 16% 정확도 손실).
   *  - 'jie_based': use a 12-jie approximate-day lookup so birthdays within
   *    ±1 day of the actual jie boundary fall on the correct fortune month.
   *    Needs a Date or {month, day} of the target — see buildFortuneReport.
   *  - 'full_5layer': reserved (대운/세운/절운/일진/시진 5-layer cascade —
   *    deferred). */
  readonly fortuneCascadeMode?: 'simple' | 'jie_based' | 'full_5layer';

  // ── PR8: adaptive evaluator opt-in flags ──────────────────────────────

  /** Sajupriority curve shape used by `extractSajuPriority`.
   *  - 'linear' (default): raw signalStrength - penaltyDeduction, clamped.
   *  - 'tanh': sigmoid-shaped — softens both 0 and 1 extremes so a single
   *    very-high or very-low signal cannot over-rotate the adaptive
   *    weight system. Replaces the linear cliff with `0.5 + 0.5·tanh(…)`. */
  readonly sajuPriorityCurve?: 'linear' | 'tanh';

  /** Unknown-hour safety guard.
   *  When true AND the birth.hour is missing, the evaluator dampens the
   *  saju priority by `unknownTimeSajuDamp` (default 0.5) so a 시간미상
   *  saju cannot dominate the adaptive policy. Declared here; wiring lands
   *  alongside the curve change so both paths share a single test fixture. */
  readonly unknownHourGuard?: boolean;

  /** Multiplier applied to saju priority when `unknownHourGuard` is true
   *  and birth.hour is missing. Default 0.5 (halve). Range [0, 1]. */
  readonly unknownTimeSajuDamp?: number;

  // ── PR11: data / naming-specific opt-in flags ─────────────────────────

  /** Hanja candidate pool for name generation (PR11).
   *  - undefined / 'curated' (default): existing ~5,000-entry seed-ts DB.
   *    Every character in this set was hand-picked for naming quality, so
   *    membership itself is a positive signal — this is the production-
   *    safe default and matches all baseline-snapshot fixtures.
   *  - 'inmyeongyong_full': opt into the full legal-Hanja data file for
   *    recommendation generation. Broader but unfiltered for naming
   *    aesthetics, so it remains explicit opt-in and uses derived scoring
   *    metadata until radical/Unihan enrichment lands. */
  readonly hanjaPool?: 'curated' | 'inmyeongyong_full';

  /** Pure-hangul element-mapping schema (PR11).
   *  Different naming schools assign different elements to certain
   *  consonants and vowels. spring-info/05_naming_specific/01_pure_hangul_mode.md
   *  documents the citations.
   *  - 'auto' (PR-Q-22 K-4): schoolPreset 기반 자동 라우팅 (korean →
   *    classic_phonetic, chinese → classic_phonetic + signal cap, modern →
   *    modern_korean). 명시적 schema 가 unset 일 때 schoolPreset 으로 결정.
   *  - 'classic_phonetic' (default): 훈민정음 해례식
   *  - 'modern_korean': 한국 작명원 표준 (ㅣ→Yang, ㅡ→Yin)
   *  - 'expanded': 권위 자료 절충 변형
   *  Today this flag is declared but the existing hangul-element module
   *  uses a single hard-coded schema; per-schema element-mapping routing
   *  lands in a future PR (spring-info/09_finalization/05_pure_hangul_schema_wireup.md).
   *  The 'auto' option (PR-Q-22) routes the schema selection by schoolPreset
   *  but still uses the underlying single-schema mapping until the full
   *  wire-up lands. */
  readonly pureHangulSchema?: 'auto' | 'classic_phonetic' | 'modern_korean' | 'expanded';

  /** Pure-hangul signal confidence cap (PR-Q-23 K-5 declaration only).
   *  Multiplier applied to HANGUL_ELEMENT/HANGUL_POLARITY signal contributions.
   *  - undefined (default) | 1.0: no cap (current behavior)
   *  - 0.7: chinese 학파의 발음오행 confidence 하향 (자평진전 doctrine —
   *    한자가 정도, 발음은 부차)
   *
   *  Per spec spring-info/09_finalization/05_pure_hangul_schema_wireup.md §1.2,
   *  this declaration enables future engine wiring (HangulCalculator weights
   *  multiplied by cap at signal creation time). Current declaration-only
   *  form does NOT yet apply the cap — future PR will wire the multiplier
   *  in `src/calculator/hangul-calculator.ts:backward()`.
   *
   *  When schoolPreset='chinese' AND pureHangulSchema='auto', the engine
   *  should auto-resolve cap=0.7 (future K-5 full wire). Until then this
   *  field is opt-in only. */
  readonly pureHangulSignalCap?: number;

  /** Pure-hangul polarity model (PR-Q-23 K-6 declaration only).
   *  - 'binary' (default): yang vs yin only (현재 동작)
   *  - 'ternary': yang / yin / neutral — ㅡ/ㅣ 모음 별도 처리. 한국 모던
   *    작명 표준 (좋은이름닷컴 등) 의 절충안 doctrine.
   *
   *  Per spec spring-info/09_finalization/05_pure_hangul_schema_wireup.md §1.2,
   *  this declaration enables future yangVowels 표 확장 + neutral weighting.
   *  Current declaration-only form does NOT yet activate ternary classification.
   *  Future PR will land the seed-ts side change. */
  readonly pureHangulPolarityModel?: 'binary' | 'ternary';

  /** Surface official birth-registration Hangul name trend evidence.
   *  Display-only in PR-2.4: when true, reports may include
   *  `nameTrend`/`trendFit`/`trendRisk`, but scores, ranking, generation,
   *  and legal/Hanja logic are unchanged. */
  readonly surfaceNameTrend?: boolean;

  /** Surface Korean syllable transition and surname-boundary phonetic evidence.
   *  Display-only in PR-2.5: when true, reports may include `phonetic`
   *  warnings and scores, but scoring, ranking, generation, legal/Hanja,
   *  and Saju compatibility logic are unchanged. */
  readonly surfacePhoneticEvidence?: boolean;

  /** Surface the pre-final multi-axis naming score vector.
   *  Display-only in PR-6.1: when true, reports may include
   *  `scoreVector`, but final scores, ranking, generation, legal/Hanja,
   *  and Saju compatibility logic are unchanged. */
  readonly surfaceNamingScoreVector?: boolean;

  /** Opt into Pareto/diversity-aware candidate ordering.
   *  PR-6.2 keeps raw `finalScore` unchanged, but recommendation lists may
   *  reorder close candidates so the top set covers distinct strengths and
   *  avoids repeated syllable/Hanja patterns. */
  readonly paretoFrontierCandidates?: boolean;

  /** Surface palace (12궁) information on `SajuOutputSummary` when `true`.
   *  Off by default — consumers must opt-in.
   *
   *  Per Phase H-E (`spring-info/09_finalization/FINALIZATION_PLAN.md` §4.1
   *  PR H-E), saju-ts does not currently carry palace data. This flag is
   *  declared now so consumers can request it; the actual surfacing
   *  activates when saju-ts ports the saju_master `palace.py` table
   *  (year-pillar + month-branch → 12 palaces). Until that lands,
   *  `surfacePalace: true` produces no additional output. */
  readonly surfacePalace?: boolean;

  /** Surface naeum (納音 / 60甲子 sound table) on `SajuOutputSummary`
   *  when `true`. Off by default.
   *
   *  Per Phase H-F (FINALIZATION_PLAN.md §4.1 PR H-F), saju-ts does not
   *  currently carry naeum data. This flag is declared now; saju-ts will
   *  port the saju_master `naeum.py` 60-pair table in a follow-up. Until
   *  then `surfaceNaeum: true` produces no additional output. */
  readonly surfaceNaeum?: boolean;

  /** Surface johu (조후 / climate balance) on `SajuOutputSummary` and
   *  `OverviewSummaryCard` evidence rows when `true`. Off by default —
   *  consumers must opt-in.
   *
   *  Per Phase H-G (`spring-info/09_finalization/17_adapter_richness_phase2.md`
   *  bucket C), saju-ts does not yet surface a confidence score for the
   *  johu axis, so spring-ts reads `bundle.summary.johu` (when present)
   *  and emits a structured `SajuOutputSummary.johu` field with the
   *  classical 조후 useful-stems list and seasonal note. axisStrength
   *  for this axis remains absent until saju-ts produces a johu
   *  confidence (deferred — F-A14 audit, "saju-ts does not yet surface
   *  explicit confidences for chengbai / johu / fortuneHierarchy /
   *  rectification"). When that lands, the same flag activates the
   *  axisStrength.johu population without API change. */
  readonly surfaceJohu?: boolean;

  // ── PR10: narrative expansion flags ────────────────────────────────────

  /** Narrative style for fortune report cards.
   *  - undefined / 'plain' (default): existing user-friendly tone
   *  - 'expert':  classical 명리 terminology (격국, 용신, 십성, 조후 …)
   *  - 'counselor': flowing 상담가 paragraphs (event → fortune → advice)
   *  - 'sideBySide': both expert + plain populated for parallel display
   *  Cards expose the variant text in their `expertText`/`plainText`/
   *  `counselorText` optional fields when this flag is set. */
  readonly narrativeStyle?: 'expert' | 'plain' | 'counselor' | 'sideBySide';

  /** Reading focus — routes the report to a specific life-domain emphasis.
   *  Mirrors saju_master/situational_tone_engine: `auto` (default), `full`,
   *  `career`, `wealth`, `relationship`, `study_document`,
   *  `expression_children`, `health_stress`, `movement`, `family`. */
  readonly readingFocus?:
    | 'auto' | 'full'
    | 'career' | 'wealth' | 'relationship'
    | 'study_document' | 'expression_children'
    | 'health_stress' | 'movement' | 'family';

  /** Saju-ts school identifier (PR-H-S5). saju-ts ships ~24 schools via
   *  schools/packs/builtin.pack.json (balance / johoo / johoo.strict /
   *  tongguan / gyeokguk / ziping.strict / integrated.3d / sanmingtonghui /
   *  follow / ditiansui / hwagyeok / zhuanwang / shinsal.virtueStrict /
   *  qiongTongBaoJian / zipingzhenquan / yuhaiziping / shenfengTongkao /
   *  …). spring-ts's existing `schoolPreset` only exposes 3 high-level
   *  presets; this opt-in routes a saju-ts-side `school.id` into the
   *  legacy config so power users can target a specific 학파. Default
   *  unset = saju-ts uses its preset-derived school. spring-ts's own
   *  scoring is unaffected — this only changes the saju-ts analysis the
   *  adapter receives. */
  readonly sajuSchoolId?: string;

  /** Saryeong (司令) hidden-stem scheme (PR-H-S6). When set, saju-ts's
   *  `core/wollyul.ts:hiddenStemsForChart` weights the commanding stem
   *  per its WOLLYUL_SEGMENTS rule (1.0 on the commanding stem, 0.0 on
   *  the rest) instead of falling back to the static 7/3 or 6/3/1 split.
   *
   *  - 'classical': 餘氣 → 中氣 → 正氣 literal day counts (saju_master parity)
   *  - 'scaled':    same counts scaled to the astronomical month length
   *
   *  Default unset = saju-ts uses the static `standard` scheme (existing
   *  behavior). Targets the 사령 정밀화 (per F-A14 §1.4); spring-ts's
   *  own scoring is unaffected. */
  readonly saryeongScheme?: 'classical' | 'scaled';

  /** Aberration of light model for solar longitude (PR-H-S8). saju-ts
   *  defaults to 'constant' (~±1.4 sec residual on solar-term timing);
   *  'rCorrected' applies the dλ/dt correction from Meeus 25.10 for sub-
   *  second-arc accuracy. spring-ts default unset → preserves
   *  'constant'. Use 'rCorrected' for sub-second-class precision when
   *  paired with `solarPrecision: 'iau1980_full'`. */
  readonly aberrationModel?: 'constant' | 'rCorrected';

  /** Nutation precision tier for solar longitude (PR-H-S8). saju-ts
   *  default is 'classical' (±9″ residual); spring-ts upgrades to
   *  'iau1980_top10' (±1″) by default in PR-H-S3. This opt-in lets the
   *  caller request the full 63-row IAU 1980 series ('iau1980_full',
   *  ±0.1″ residual) for cases where boundary timing is critical
   *  (e.g. authority-case validation in Phase L). Default unset = the
   *  PR-H-S3 default ('iau1980_top10') is used. */
  readonly solarPrecision?: 'classical' | 'iau1980_top10' | 'iau1980_full';

  /** Whether `CategoryFortuneCard.subDomains` is populated (PR-K-1
   *  declaration — spring-info/09_finalization/02_event_domain_wireup.md).
   *
   *  Default false / unset = subDomains stays undefined (PR12 contract,
   *  preserves the existing 5-category surface). When true, the category
   *  builder will populate 1-3 sub-domain rows per category drawing on
   *  saju_master/event_domain_map.py mappings (career / study_document /
   *  expression_children / health_stress / movement). The data + builder
   *  wire lands in a follow-up PR; this PR declares the option only. */
  readonly surfaceSubDomains?: boolean;

  /** Evaluator mode for sajuPriority extraction (PR-K-8 declaration —
   *  spring-info/09_finalization/06_multi_axis_evaluator.md).
   *
   *  - 'single' (default): existing day-master + yongshin-priority
   *    pipeline (`extractSajuPriority` Step 4 in PR8 design).
   *  - 'multi_axis' (opt-in, future): weights multiple axes
   *    (yongshin / gyeokguk / strength / chengbai / johu /
   *    fortuneHierarchy / rectification) into the priority calculation,
   *    matching saju_master/weighted_judgment_scoreboard. Activates only
   *    when the chart's axisStrength supplies ≥ 2 axes.
   *
   *  This PR declares the option; the multi_axis branch in
   *  extractSajuPriority Step 3.5 lands in a follow-up PR (PR-K-9).
   *  Default unset = 'single' = no behavior change. */
  readonly evaluatorMode?: 'single' | 'multi_axis';

  readonly [key: string]: unknown;
}

/** A counterexample row — saju_master/counterexample_refinement_engine
 *  surfaces these so a high-end reading does not just state a judgment but
 *  also the conditions under which it should weaken or revise. Cards can
 *  carry an optional `counterexamples?: CounterexampleRow[]` to expose them. */
export interface CounterexampleRow {
  /** The counterexample / weakening condition. */
  readonly condition: string;
  /** The revised claim to use when the condition triggers. */
  readonly revisedClaim: string;
  /** Which judgment-strength tier the counterexample applies to. Optional. */
  readonly appliesWhen?: SajuJudgmentStrength;
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
  readonly hanjaPool?: PrecisionConfig['hanjaPool'];
  readonly candidateRejections?: CandidateRejectionSummary[];
}

export interface CandidateRejectionSummary {
  readonly reason: string;
  readonly count: number;
  readonly examples: Array<{
    readonly hangul?: string;
    readonly hanja?: string;
    readonly legalStatus?: HanjaLegalStatus;
    readonly detail?: string;
  }>;
}

/** A single name candidate with scores and detailed analysis. */
export interface SpringCandidate {
  readonly name: CandidateName;
  readonly scores: Record<'total' | 'hangul' | 'hanja' | 'fourFrame' | 'saju', number>;
  readonly scoreVector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
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
  readonly nameTrend?: NameTrendAnalysis;
  readonly phonetic?: PhoneticAnalysis;
}

/** Properties of a single character (hangul + hanja + metadata). */
export interface CharDetail {
  readonly hangul: string;
  readonly hanja: string;
  readonly meaning: string;
  readonly strokes: number;
  readonly element: string;
  readonly polarity: string;
  readonly legalStatus: HanjaLegalStatus;
  readonly legalRegistrable?: boolean;
  readonly isVariantOf?: string;
  readonly unihan?: HanjaUnihanMetadata;
  readonly radicalElementHint?: RadicalElementHint;
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
  readonly yongshinConsensus?: YongshinConsensusScoreboard;
  readonly gyeokguk: GyeokgukSummary;
  readonly elementDistribution: Record<string, number>;
  readonly deficientElements: string[];
  readonly excessiveElements: string[];
  readonly cheonganRelations: CheonganRelationSummary[];
  readonly jijiRelations: JijiRelationSummary[];
  readonly tenGodAnalysis: TenGodSummary | null;
  readonly shinsalHits: ShinsalHitSummary[];
  readonly gongmang: [string, string] | null;
  /** Per-axis judgment strength (PR9). Mirrors SajuOutputSummary.axisStrength
   *  so card builders that receive only the SajuSummary can access the same
   *  4-tier rhetoric model the adapter derives. */
  readonly axisStrength?: SajuAxisStrengthMap;
  /** 12궁 palace analysis (PR-Q-5). Populated by the adapter when
   *  `options.precisionConfig.surfacePalace === true`. Default-mode
   *  callers see this field as `undefined`. */
  readonly palace?: PalaceSummary;
  /** 60갑자 納音 summary (PR-Q-6). Populated when
   *  `options.precisionConfig.surfaceNaeum === true`. */
  readonly naeum?: NaeumSummary;
  readonly inputUncertainty?: SajuInputUncertainty;
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
  readonly consensus?: YongshinConsensusScoreboard;
}

/** A single yongshin recommendation with its rationale. */
export interface YongshinRecommendation {
  readonly type: string;
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}

export type YongshinConsensusAxisName =
  | 'eokbu'
  | 'johu'
  | 'gyeokguk'
  | 'tonggwan'
  | 'byeongyak'
  | 'siksangFlow';

export type YongshinConsensusConflictLevel = 'none' | 'low' | 'medium' | 'high';

export interface YongshinConsensusAxisScore {
  readonly element: string | null;
  readonly score: number;
  readonly scores: Readonly<Record<string, number>>;
  readonly evidence: readonly string[];
}

export interface YongshinConsensusScoreboard {
  readonly eokbu: YongshinConsensusAxisScore;
  readonly johu: YongshinConsensusAxisScore;
  readonly gyeokguk: YongshinConsensusAxisScore;
  readonly tonggwan: YongshinConsensusAxisScore;
  readonly byeongyak: YongshinConsensusAxisScore;
  readonly siksangFlow: YongshinConsensusAxisScore;
  readonly final: {
    readonly element: string;
    readonly confidence: number;
    readonly topMargin: number;
    readonly conflictLevel: YongshinConsensusConflictLevel;
    readonly competingElements: readonly string[];
    readonly evidence: readonly string[];
  };
}

/** The structural pattern (gyeokguk) of the birth chart. */
export interface GyeokgukSummary {
  readonly type: string;
  readonly category: string;
  readonly baseTenGod: string | null;
  readonly confidence: number;
  readonly reasoning: string;
  readonly candidates?: readonly GyeokgukCandidateSummary[];
  readonly jonggyeokCandidates?: readonly JonggyeokCandidateSummary[];
}

/** Source-tier metadata matching test/baseline/schema/sourceTier.schema.json. */
export interface SourceTierMetadata {
  readonly tier: string;
  readonly sourceType: string;
  readonly sourceUrl: string | null;
  readonly accessedAt: string;
  readonly quoteShort: string | null;
  readonly humanInterpretation: string;
  readonly copyrightNote: string;
  readonly authorityTruthEligible: boolean;
}

export type JonggyeokCandidateStatus = 'none' | 'possible' | 'candidate' | 'selected' | 'blocked';

export type JonggyeokSubtype =
  | 'cong_cai'
  | 'cong_guan'
  | 'cong_sha'
  | 'cong_er'
  | 'cong_yin'
  | 'cong_bi'
  | 'zhuan_wang'
  | 'hua_qi';

/** Evidence-only jonggyeok classifier output. */
export interface JonggyeokCandidateSummary {
  readonly subtype: JonggyeokSubtype;
  readonly status: JonggyeokCandidateStatus;
  readonly score: number;
  readonly confidence: number;
  readonly followPressure: number;
  readonly dayMasterIsolation: number;
  readonly rootWeakness: number;
  readonly dominantElementShare: number;
  readonly breakerPenalty: number;
  readonly selectedReason?: string;
  readonly blockedReason?: string;
  readonly evidence: readonly string[];
  readonly sourceTier: SourceTierMetadata;
}

/** Display-only candidate evidence for the selected gyeokguk. */
export interface GyeokgukCandidateSummary {
  readonly type: string;
  readonly category: string;
  readonly baseTenGod: string | null;
  readonly score: number;
  readonly confidence: number;
  readonly supportingRules: readonly string[];
  readonly blockingRules: readonly string[];
  readonly compositeClassical?: GyeokgukCompositeClassicalScore;
  readonly sourceTier: SourceTierMetadata;
}

/** Evidence-only composite-classical score for a gyeokguk candidate. */
export interface GyeokgukCompositeClassicalScore {
  readonly model: 'composite_classical';
  readonly score: number;
  readonly confidence: number;
  readonly status: 'candidate_evidence' | 'low_confidence_evidence' | 'trace_only';
  readonly selectionPolicy: 'evidence_only_never_promote';
  readonly selectedByComposite: false;
  readonly breakerPenalty: number;
  readonly features: readonly GyeokgukCompositeClassicalFeatureScore[];
  readonly basisRules: readonly string[];
}

/** One weighted input to the composite-classical candidate score. */
export interface GyeokgukCompositeClassicalFeatureScore {
  readonly name:
    | 'monthMainMatch'
    | 'stemTransparency'
    | 'rootSupport'
    | 'seasonalCommand'
    | 'transformationSupport'
    | 'purityScore'
    | 'usefulGodAlignment'
    | 'sourceTierBoost'
    | 'stabilityAcrossModes';
  readonly score: number;
  readonly weight: number;
  readonly contribution: number;
  readonly reason: string;
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

/** A single 대운 (10-year luck cycle) pillar entry. */
export interface DaeunPillarSummary {
  readonly stem: string;
  readonly branch: string;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
}

/** Daeun (대운, 10-year luck cycles) overview for a chart. Mirrors the
 *  shape that `saju-adapter.ts:extractDaeunInfo` already produces and that
 *  the LifeStageFortuneCard / FortuneCascade builders consume. PR-H-D
 *  formalises this as an interface so SajuOutputSummary can declare it
 *  type-safely; SajuSummary picks it up via the existing
 *  `[key: string]: unknown` index signature without a breaking change. */
export interface DaeunInfoSummary {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  readonly firstDaeunStartMonths: number;
  readonly boundaryMode: string;
  readonly warnings: readonly string[];
  readonly pillars: readonly DaeunPillarSummary[];
}

/** A single 세운 (yearly luck) pillar entry. */
export interface SaeunPillarSummary {
  readonly year: number;
  readonly stem: string;
  readonly branch: string;
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

/** Pre-final multi-axis score vector for candidate comparison. */
export interface NamingScoreVector {
  /** Legal registrability quality, 0..100. */
  readonly legal: number | null;
  /** Integrated saju-name fit, 0..100; null when no saju frame was evaluated. */
  readonly sajuFit: number | null;
  /** Yongshin-specific fit, 0..100; null when no saju scoring detail exists. */
  readonly yongshinFit: number | null;
  /** Name and saju element-balance quality, 0..100. */
  readonly elementBalance: number | null;
  /** Hanja meaning coverage quality, 0..100; null for pure Hangul names. */
  readonly hanjaMeaning: number | null;
  /** Phonetic flow quality, 0..100; null when unavailable. */
  readonly phonetic: number | null;
  /** Birth-era name trend quality, 0..100; null when unavailable. */
  readonly eraFit: number | null;
  /** Surname-to-given phonetic fit, 0..100; null when unavailable. */
  readonly familyFit: number | null;
  /** Aggregate caution level, 0..100, where higher means more risk. */
  readonly risk: number;
}

export type CandidateStrengthProfileId =
  | 'saju_reinforcement'
  | 'phonetic_stability'
  | 'era_balance'
  | 'legal_meaning'
  | 'risk_managed'
  | 'balanced';

export interface CandidateStrengthProfile {
  readonly id: CandidateStrengthProfileId;
  readonly label: string;
  readonly primaryAxis: keyof NamingScoreVector | 'balanced';
  readonly reasons: readonly string[];
  readonly paretoFrontier: boolean;
}

/** Pure name analysis result (no saju). Returned by getNamingReport(). */
export interface NamingReport {
  readonly name: CandidateName;
  readonly totalScore: number;
  readonly scores: { hangul: number; hanja: number; fourFrame: number };
  readonly scoreVector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
  readonly analysis: {
    readonly hangul: HangulAnalysis;
    readonly hanja: HanjaAnalysis;
    readonly fourFrame: NamingReportFourFrame;
  };
  readonly nameTrend?: NameTrendAnalysis;
  readonly phonetic?: PhoneticAnalysis;
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
  readonly scoreVector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
  readonly popularityRank: number | null;
  readonly maleRatio: number | null;
  readonly nameGender: NameGenderTendency;
  readonly nameTrend?: NameTrendAnalysis;
  readonly phonetic?: PhoneticAnalysis;
  readonly namingReport: NamingReport;
  readonly sajuReport: SajuReport;
  readonly sajuCompatibility: SajuCompatibility;
  readonly combinedDistribution: Record<ElementKey, number>;
  rank: number;
}

/** Lightweight candidate item for list pages. */
export interface SpringCandidateSummary {
  readonly finalScore: number;
  readonly scoreVector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
  readonly fullHangul: string;
  readonly fullHanja: string;
  readonly givenHangul: string;
  readonly givenName: NameCharInput[];
  readonly popularityRank: number | null;
  readonly maleRatio: number | null;
  readonly nameGender: NameGenderTendency;
  readonly nameTrend?: NameTrendAnalysis;
  readonly phonetic?: PhoneticAnalysis;
  rank: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  4-B. COMPATIBILITY & ADAPTER TYPES
//       Used to bridge saju analysis with name scoring.
// ─────────────────────────────────────────────────────────────────────────────

export type TenGodEvidenceSource = 'cheongan' | 'jijiPrincipal' | 'hiddenStem';
export type TenGodEvidenceMode = 'simple_count' | 'positional_weighted' | 'positional_weighted_v2';
export type TenGodEvidenceNormalization = 'deviation_from_average_count' | 'presence_visibility_expected_by_chart_shape';

export interface TenGodPositionEvidenceContribution {
  readonly position: string;
  readonly source: TenGodEvidenceSource;
  readonly group: string;
  readonly weight: number;
  readonly presence?: number;
  readonly visibility?: number;
  readonly stem?: string;
  readonly element?: ElementKey | null;
  readonly ratio?: number;
  readonly rank?: number;
}

export interface TenGodPositionEvidence {
  readonly requestedMode: TenGodEvidenceMode;
  readonly effectiveMode: TenGodEvidenceMode;
  readonly score: number;
  readonly normalization: TenGodEvidenceNormalization;
  readonly topContributions: readonly TenGodPositionEvidenceContribution[];
  readonly groupCounts: Record<string, number>;
  readonly deviations: Record<string, number>;
  readonly elementWeights: Record<ElementKey, number>;
  readonly presenceCounts?: Record<string, number>;
  readonly visibilityCounts?: Record<string, number>;
  readonly expectedPresenceByChartShape?: number;
  readonly meanVisibilityPerPresence?: number;
  readonly fallbackReason?: string;
}

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
  readonly yongshinConsensusConflictLevel?: YongshinConsensusConflictLevel;
  readonly yongshinConsensusCompetingElements?: readonly string[];
  readonly tenGodPositionEvidence?: TenGodPositionEvidence;
}

/** Lightweight saju summary used by the SajuCalculator adapter. */
export interface SajuOutputSummary {
  dayMaster?: { element: ElementKey };
  strength?: { isStrong: boolean; totalSupport: number; totalOppose: number };
  yongshin?: SajuYongshinSummary;
  yongshinConsensus?: YongshinConsensusScoreboard;
  tenGod?: {
    groupCounts: Record<string, number>;
    /** Per-pillar ten-god detail (year/month/day/hour). Optional — populated
     *  by the adapter when the upstream saju engine surfaces tenGodAnalysis.
     *  Used by positional ten-god modes to apply
     *  position-specific weights (천간 4.0, 지지 정기 1.8, 지장간 1.2/0.7/0.45). */
    byPosition?: Record<SajuPillarPosition, SajuTenGodPositionGroup>;
  };
  gyeokguk?: { category: string; type: string; confidence: number };
  deficientElements?: string[];
  excessiveElements?: string[];
  /** Per-axis judgment strength (PR9). Bins each axis's saju-engine
   *  confidence into the 4-tier rhetoric model:
   *    'definite'  (확정형) — conf ≥ 0.85, can state as fact
   *    'practical' (실전형) — conf ≥ 0.65, can state with mild hedge
   *    'candidate' (후보형) — conf ≥ 0.45, must hedge as possibility
   *    'deferred'  (보류형) — conf < 0.45, omit or fully hedge
   *  Cards (PR9 onwards) use this to choose narrative wording. */
  axisStrength?: SajuAxisStrengthMap;
  /** Heavenly-stem (천간) relations among the chart's four pillars (PR-H-A).
   *  Surfaces the same shape that `SajuSummary.cheonganRelations` already
   *  exposes — additive optional so default-mode regression is preserved.
   *  Used by the cautions / personality narrative cards (Phase J) to surface
   *  합·충·극 to the user without re-fetching the SajuSummary. */
  cheonganRelations?: readonly CheonganRelationSummary[];
  /** Earthly-branch (지지) relations among the chart's four pillars (PR-H-A).
   *  Mirrors `SajuSummary.jijiRelations`. Same opt-in / additive policy as
   *  cheonganRelations above. Used by cautions and life-overview cards to
   *  surface 합·충·형·파·해 evidence rows. */
  jijiRelations?: readonly JijiRelationSummary[];
  /** Shinsal (신살) hits weighted by quality grade × pillar position multiplier
   *  (PR-H-B). Mirrors `SajuSummary.shinsalHits` — additive optional readonly
   *  array, undefined when the source produces no hits. Used by life-overview
   *  / cautions narrative cards (Phase J) and provides evidence rows. */
  shinsalHits?: readonly ShinsalHitSummary[];
  /** Void branches (공망 = 旬中空亡) tuple for the chart's day pillar
   *  (PR-H-B). Mirrors `SajuSummary.gongmang`. Two branch codes when the
   *  upstream engine reports them; undefined otherwise. Used by cautions
   *  card narrative as a hedge-trigger. */
  gongmang?: readonly [string, string];
  /** Daeun (대운, 10-year luck cycles) overview (PR-H-D). Lifts
   *  SajuSummary.daeunInfo into the scoring/output path so the
   *  LifeStageFortuneCard builder can surface narrative + transitions
   *  detail (decade pillars + isForward direction + boundaryMode +
   *  warnings) without re-fetching the full SajuSummary. */
  daeunInfo?: DaeunInfoSummary | null;
  /** Saeun (세운, yearly luck) pillar list (PR-H-D). Mirrors the existing
   *  SajuSummary.saeunPillars production. Used by the period fortune card
   *  builders for year-level trace + transitions. */
  saeunPillars?: readonly SaeunPillarSummary[];
  /** 12궁 palace analysis (PR-Q-5). Surfaced by the saju-adapter only when
   *  `precisionConfig.surfacePalace === true` and the adapter has access to
   *  saju-ts's `analyzePalaces`. Each position carries the canonical
   *  meta (조상궁/부모궁/배우자궁/자식궁) plus its main hidden ten-god,
   *  길신 flag, root status, and overall good/caution/normal status. */
  palace?: PalaceSummary;
  /** 60갑자 納音 summary (PR-Q-6). Surfaced when
   *  `precisionConfig.surfaceNaeum === true`. */
  naeum?: NaeumSummary;
  /** Input-completeness uncertainty. This is separate from doctrinal
   *  `axisStrength`: e.g. unknown birth hour means the engine used a
   *  documented fallback time, so hour-sensitive conclusions should be
   *  labeled and hedged even when the calculated chart is internally valid. */
  inputUncertainty?: SajuInputUncertainty;
}

/** 12궁 palace analysis surfaced on SajuOutputSummary (PR-Q-5).
 *  Mirror of saju-ts `PalaceReport` with the field shapes simplified
 *  to plain strings (vs StemIdx/BranchIdx) so spring-ts callers do not
 *  have to import saju-ts internal types. */
export interface PalaceSummary {
  readonly positions: Readonly<Record<'year' | 'month' | 'day' | 'hour', PalaceSummaryPosition | undefined>>;
  readonly rule: string;
  readonly caution: string;
}

export interface PalaceSummaryPosition {
  /** 조상궁 / 부모궁 / 배우자궁 / 자식궁 */
  readonly name: string;
  /** 초년 / 청년 / 장년 / 말년 */
  readonly period: string;
  /** 1~20세 / 21~40세 / 41~60세 / 61~80세 */
  readonly ageRange: string;
  /** 뿌리 根 / 묘목 苗 / 꽃 花 / 열매 實 */
  readonly metaphor: string;
  /** Topic phrase from saju_master palace.py PALACE_INFO[pos].topic. */
  readonly topic: string;
  /** Main hidden stem of the branch (정기) — Korean reading (e.g., '갑'/'을'/...). */
  readonly mainHiddenStem: string;
  /** Korean ten-god name of mainHiddenStem relative to day stem
   *  (e.g., '식신'/'정인'/...). */
  readonly mainTenGod: string;
  /** Whether mainTenGod is in the 길신 (吉神) group. */
  readonly isGilshin: boolean;
  /** Whether the branch contains the day-master's same-element root. */
  readonly hasDayMasterRoot: boolean;
  /** Whether the branch contains 비겁 / 인성 supporting hidden stems. */
  readonly hasSupportingRoot: boolean;
  /** Overall status: 'good' (길신 + supporting root) / 'caution' (흉신) / 'normal'. */
  readonly status: 'good' | 'caution' | 'normal';
}

/** 60갑자 納音 (sound of the pillar) summary surfaced on SajuOutputSummary
 *  when `precisionConfig.surfaceNaeum === true` (PR-Q-6). Mirrors saju-ts
 *  `NaeumReport`. */
export interface NaeumSummary {
  readonly positions: Readonly<Record<'year' | 'month' | 'day' | 'hour', NaeumSummaryPosition | undefined>>;
  /** Element-hanja (金/木/水/火/土) → count of pillars matching that 納音 element. */
  readonly elementCounts: Readonly<Record<string, number>>;
  readonly caution: string;
}

export interface NaeumSummaryPosition {
  /** Ganzhi of the pillar (e.g., '甲子'). */
  readonly pillar: string;
  /** 한자 명칭 (e.g., '海中金'). */
  readonly nameHanja: string;
  /** 한글 명칭 (e.g., '해중금'). */
  readonly nameKorean: string;
  /** 5요소 한자 (金/木/水/火/土). */
  readonly elementHanja: string;
  /** 비유 의미. */
  readonly meaning: string;
}

export type SajuJudgmentStrength = 'definite' | 'practical' | 'candidate' | 'deferred';

/** Each saju axis's judgment strength (PR9). All entries optional —
 *  an axis is included only when the upstream engine reports a confidence
 *  for it. Matches the 7 axes documented in
 *  spring-info/03_adaptive_evaluator/01_saju_priority.md §2. */
export interface SajuAxisStrengthMap {
  readonly yongshin?: SajuJudgmentStrength;
  readonly gyeokguk?: SajuJudgmentStrength;
  readonly strength?: SajuJudgmentStrength;
  readonly chengbai?: SajuJudgmentStrength;
  readonly johu?: SajuJudgmentStrength;
  readonly fortuneHierarchy?: SajuJudgmentStrength;
  readonly rectification?: SajuJudgmentStrength;
}

export type SajuInputUncertaintyAxis =
  | 'hourPillar'
  | 'yongshin'
  | 'gyeokguk'
  | 'strength'
  | 'tenGod'
  | 'fortuneTiming';

export interface SajuInputUncertainty {
  readonly unknownHour?: {
    readonly fallbackHour: number;
    readonly fallbackMinute: number;
    readonly affectedAxes: readonly SajuInputUncertaintyAxis[];
    readonly confidenceTierShift: 'downgrade-one-step';
    readonly message: string;
  };
}

/** Evidence backing a single narrative claim (PR9).
 *
 *  saju_master `interpretation_evidence_bridge.py:expert_evidence_table`
 *  surfaces a row per claim: axis, the claim itself, supporting chart
 *  features, optional weakness / counterexample, and the judgment
 *  strength of the claim. spring-ts cards (overview/personality/...)
 *  include an optional `evidence` array of these rows so a downstream
 *  UI can render "이 주장은 무엇을 근거로 하는가?" beneath each card. */
export interface EvidenceRow {
  /** Saju axis the claim is anchored on (e.g., 'yongshin', 'gyeokguk'). */
  readonly axis: string;
  /** The claim being made, in user-facing language. */
  readonly claim: string;
  /** Concrete chart features that support the claim. */
  readonly supportingFeatures: readonly string[];
  /** Conditions under which the claim weakens or revises (optional). */
  readonly weakness?: string;
  /** Judgment-strength tier of this claim. Aligns with `SajuAxisStrengthMap`. */
  readonly strength?: SajuJudgmentStrength;
}

/** Pillar position keys used by SajuOutputSummary.tenGod.byPosition. */
export type SajuPillarPosition = 'year' | 'month' | 'day' | 'hour';

/** Per-pillar ten-god group exposure for positional weighting. */
export interface SajuTenGodPositionGroup {
  /** Group of the heavenly stem (천간) at this pillar.
   *  One of: 'friend' | 'output' | 'wealth' | 'authority' | 'resource', or
   *  undefined when the upstream engine cannot resolve it. */
  readonly cheonganGroup?: string;
  /** Group of the earthly branch's principal hidden stem (지지 정기). */
  readonly jijiPrincipalGroup?: string;
  /** All hidden stems (지장간) of the earthly branch with their ratios.
   *  When present each entry's `group` is the ten-god group of that stem
   *  relative to the day master. */
  readonly hiddenStems?: ReadonlyArray<{
    readonly stem: string;
    readonly element: ElementKey | null;
    readonly ratio: number;
    readonly group?: string;
  }>;
}

/** Yongshin details as returned by the saju calculator. */
export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  recommendations: YongshinRecommendation[];
  consensus?: YongshinConsensusScoreboard;
}
