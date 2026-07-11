import type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from './core/model-types.js';
import type { FourframeMeaningEntry } from '../../seed-ts/src/database/fourframe-repository.js';
import type { ElementKey } from './core/scoring.js';
import type { HanjaLegalStatus } from './hanja-annotations.js';
import type { HanjaUnihanMetadata, RadicalElementHint } from './hanja-unihan.js';
import type { NameTrendAnalysis } from './name-trend.js';
import type { PhoneticAnalysis } from './phonetic-rules.js';
import type { SchoolPresetMetadata, SchoolPresetName } from './preset-loader.js';

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
  readonly meaning?: string;
  readonly strokes?: number;
  readonly element?: string;
  readonly elementLabel?: string;
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
  readonly schoolPreset?: SchoolPresetName;
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

  /** Input-time uncertainty safety guard.
   *  When true, the evaluator dampens saju priority for a normalized unknown
   *  hour or a missing minute whose HH:00..HH:59 envelope crosses a discrete
   *  result boundary. A stable missing-minute envelope is recorded but is not
   *  dampened. The legacy option name remains for API compatibility. */
  readonly unknownHourGuard?: boolean;

  /** Multiplier applied to saju priority when `unknownHourGuard` is true
   *  and normalized input-time uncertainty requires the guard. Default 0.5
   *  (halve). Range [0, 1]. */
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

  /** Name-element resolution strategy for SajuCalculator.
   *  - undefined / 'legacy': keep the current resource_element path exactly.
   *  - 'safeFallback': when a Hanja row lacks a canonical resource element,
   *    use conservative Hangul phonetic element evidence instead of treating
   *    weak metadata as an aggressive scoring source. */
  readonly nameElementStrategy?: NameElementStrategy;

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

  /** 감사 B1: 음력→양력 변환 소스. 기본 'builtin'(내장 KASI/KARI 표준 테이블,
   *  제품 보장 1900~2050, 오프라인 결정적). 'kasi' = Node 전용 옵트인 —
   *  data.go.kr LrsrCldInfoService/getSpcifyLunCalInfo를 먼저 시도하고
   *  실패(키 부재·네트워크·타임아웃·브라우저 런타임) 시 내장 테이블로 폴백하며
   *  SajuSummary.lunarConversion.kasiFallback으로 표기한다. */
  readonly lunarConversionSource?: 'builtin' | 'kasi';

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

  /** Surface the tiered fortune matrix (`FortuneReport.tieredMatrix`).
   *
   *  Default unset / false = `tieredMatrix` stays undefined and existing card
   *  shape is preserved (NameSpring backward-compat). When true,
   *  `buildFortuneReport` assembles a `FortuneTieredMatrix` of
   *  5 periods (life / today / thisWeek / thisMonth / thisYear) ×
   *  (1 overall + 10 categories), each cell carrying brief / standard /
   *  expert depth tiers + an inline-tag glossary.
   *
   *  Narrative content is loaded from `data/narrative/**`, which is
   *  AI-derived T1_HYPOTHESIS material per `docs/NO_AI_POLICY.md`; it is
   *  display-only and never imported by scoring code. */
  readonly surfaceTieredMatrix?: boolean;

  /** Surface `FortuneReport.insightFacts` — 미사용 엔진 출력(신살·공망·
   *  합충형파해·지장간·대운 정체)의 정규화 방출. 성인 대상자 전용,
   *  해석(insights registry)이 붙은 fact만 프론트가 렌더. Default off. */
  readonly surfaceInsightFacts?: boolean;

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
  readonly wolunStartYear?: number | null;
  readonly wolunMonthCount?: number;
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
  readonly schoolPreset?: SchoolPresetMetadata;
  readonly candidateRejections?: CandidateRejectionSummary[];
  readonly sajuAnalysis?: {
    readonly enabled: boolean;
    readonly generationMode: 'saju_guided' | 'name_only';
    readonly status?: SajuAnalysisStatus;
    readonly diagnostics?: readonly SajuAnalysisDiagnostic[];
  };
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
  readonly explanation?: NamingExplanation;
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
  readonly elementLabel?: string;
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
  readonly jieProximity?: JieProximitySummary;
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
  /** Present only when the adapter could not produce a complete analysis. */
  readonly analysisStatus?: SajuAnalysisStatus;
  /** Safe, machine-readable failure context. Raw exception text is never exposed. */
  readonly diagnostics?: readonly SajuAnalysisDiagnostic[];
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
  /** 감사 B1: 음력 입력 변환 기록. calendarType='lunar' 요청에서만 채워진다(사용자 검증용). */
  readonly lunarConversion?: LunarConversionSummary;
  /** PR-12-4 (감사 C6): 음양 균형 — 8글자 체(體) 기준 개수 집계 (additive). */
  readonly yinYangBalance?: YinYangBalanceSummary;
  /** Fortune timeline fields normalized from the saju-ts V1 bridge. */
  readonly daeunInfo?: DaeunInfoSummary | null;
  readonly saeunPillars?: readonly SaeunPillarSummary[];
  readonly wolunPillars?: readonly WolunPillarSummary[];
  /** Neutral requests never select a male/female fortune direction implicitly. */
  readonly neutralGenderBasis?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  /** Present when daeun and daeun-coupled relations were omitted for a neutral request. */
  readonly genderDependentFortuneStatus?: 'unavailable_neutral_gender';
  readonly [key: string]: unknown;
}

/** PR-12-4 (감사 C6): 음양 균형 개수 — 지지는 체(體) 기준(子寅辰午申戌=양). */
export interface YinYangBalanceSummary {
  readonly yang: number;
  readonly yin: number;
  readonly stems: { readonly yang: number; readonly yin: number };
  readonly branches: { readonly yang: number; readonly yin: number };
  readonly dominant: 'YANG' | 'YIN' | 'EVEN';
}

/** 감사 B1: 음력 입력 → 양력 변환 기록. 사용자 검증용 additive 필드 —
 *  음력 입력일 때만 존재하며 양력 입력 리포트에는 나타나지 않는다. */
export interface LunarConversionSummary {
  readonly lunar: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly isLeapMonth: boolean;
  };
  readonly solar: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
  };
  /** 실제 사용된 변환 소스. 'builtin' = 내장 KASI/KARI 표준 테이블(기본). */
  readonly source: 'builtin' | 'kasi';
  /** kasi 옵트인이었으나 실패해 내장 테이블로 폴백했음. */
  readonly kasiFallback?: boolean;
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

/** Fail-closed state emitted only for unavailable, partial, or failed analyses. */
export type SajuAnalysisStatus = 'unavailable' | 'partial' | 'failed';

/** Stable reason codes for adapter-level analysis failures. */
export type SajuAnalysisReasonCode =
  | 'SAJU_MODULE_UNAVAILABLE'
  | 'BIRTH_INPUT_INSUFFICIENT'
  | 'BIRTH_DATE_INVALID'
  | 'BIRTH_TIME_INVALID'
  | 'LUNAR_INPUT_INSUFFICIENT'
  | 'LUNAR_CONVERSION_UNAVAILABLE'
  | 'NEUTRAL_GENDER_ANALYSIS_PARTIAL'
  | 'NEUTRAL_GENDER_NATAL_MISMATCH'
  | 'NEUTRAL_GENDER_ANALYSIS_FAILED'
  | 'SAJU_INVALID_SCHOOL_PRESET_SELECTOR'
  | 'SAJU_UNKNOWN_SCHOOL_PRESET'
  | 'SAJU_CALCULATION_FAILED';

export interface SajuAnalysisDiagnostic {
  readonly reasonCode: SajuAnalysisReasonCode;
  readonly message: string;
}

/** Backward-compatible safe adapter result with optional failure metadata. */
export interface SajuSafeAnalysisResult {
  readonly summary: SajuSummary;
  readonly sajuEnabled: boolean;
  readonly analysisStatus?: SajuAnalysisStatus;
  readonly diagnostics?: readonly SajuAnalysisDiagnostic[];
}

/** Birth-time proximity to the surrounding jie solar-term boundaries. */
export interface JieProximitySummary {
  readonly birthUtcMs: number;
  readonly solarTermMethod: string;
  readonly previousTermId: string;
  readonly previousUtcMs: number;
  readonly nextTermId: string;
  readonly nextUtcMs: number;
  readonly hoursSincePrevious: number;
  readonly hoursUntilNext: number;
  readonly daysSincePrevious: number;
  readonly daysUntilNext: number;
  readonly monthLengthDays: number;
  readonly nearestTermId: string;
  readonly nearestDirection: 'previous' | 'next';
  readonly nearestHours: number;
  readonly isNearBoundary: boolean;
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
  /** 득령 여부 (0|1): 월지 본기 십성이 비겁·인성인가. (과거에는 비겁 점수 합의 재라벨이었다 — 감사 A1) */
  readonly deukryeong: number;
  /** 득지 강도 (0~1): 일지 지장간 통근(비견·겁재) — 본기 1 > 중기 0.6 > 여기 0.3. */
  readonly deukji: number;
  /** 득세 개수 (0~7): 일간 제외 7글자(년·월·시 천간 + 4지지 본기) 중 비겁·인성 개수. */
  readonly deukse: number;
  readonly details: string[];
}

/** The recommended balancing element (yongshin) and related elements. */
export interface YongshinSummary {
  readonly element: string;
  readonly heeshin: string | null;
  readonly gishin: string | null;
  readonly gushin: string | null;
  /** Legacy/public summary confidence expressed as 0..100 points. */
  readonly confidence: number;
  readonly agreement: string;
  /** Recommendation confidence values are 0..100 points on this boundary. */
  readonly recommendations: YongshinRecommendation[];
  readonly consensus?: YongshinConsensusScoreboard;
  readonly methodBreakdown?: Record<string, unknown>;
  /** 감사 B5: 종격 가능성 경고 문구 (springLegacy yongshinResult.warnings passthrough). */
  readonly warnings?: readonly string[];
  /** 감사 B5: 종격(從格) 리스크 신호 — 억부 용신 신뢰도 게이트의 구조화 근거. */
  readonly jonggyeokRisk?: YongshinJonggyeokRisk;
}

/** 감사 B5: 종격 가능성 신호 상세. */
export interface YongshinJonggyeokRisk {
  readonly level: 'HIGH' | 'INFO';
  readonly direction: 'PRESSURE' | 'SUPPORT';
  readonly strengthIndex: number;
  readonly dominanceRatio: number;
  readonly subtypes: readonly string[];
  readonly maxCandidateScore: number;
  /** HIGH 리스크로 finalConfidence cap(35점)이 실제 적용됐는지. */
  readonly confidenceAttenuated: boolean;
}

/** A public yongshin recommendation; confidence is expressed as 0..100 points. */
export interface YongshinRecommendation {
  readonly type: string;
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}

/** Score-facing yongshin recommendation; confidence is a 0..1 ratio. */
export interface SajuYongshinRecommendation {
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
  /** Upstream consensus ratio in the closed interval 0..1. */
  readonly score: number;
  /** Per-element upstream consensus ratios in the closed interval 0..1. */
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
    /** Upstream consensus ratio in the closed interval 0..1. */
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
  /** Upstream gyeokguk confidence ratio in the closed interval 0..1. */
  readonly confidence: number;
  readonly reasoning: string;
  readonly candidates?: readonly GyeokgukCandidateSummary[];
  readonly jonggyeokCandidates?: readonly JonggyeokCandidateSummary[];
  readonly basis?: GyeokgukBasisSummary;
  readonly scores?: Readonly<Record<string, number>>;
  /** PR-6: 격국 성패(成敗) 판정 — 상신·순용/역용·성격/파격 (additive). */
  readonly seongpae?: GyeokgukSeongpaeSummary | null;
}

export interface GyeokgukBasisSummary {
  readonly monthMainTenGod?: string;
  readonly monthGyeokTenGod?: string;
  readonly monthGyeokMethod?: string;
  readonly monthGyeokSelectionRule?: string;
  readonly monthGyeokQuality?: Record<string, unknown>;
  readonly competition?: Record<string, unknown>;
  readonly seongpaeScoreAdjustment?: Record<string, unknown>;
}

/** PR-6: 격국 성패 판정 상세 (자평진전 순용/역용 계열). */
export interface GyeokgukSeongpaeSummary {
  readonly verdict: 'SEONGGYEOK' | 'PAGYEOK' | 'PAJUNG_YUGU' | 'SEONGJUNG_YUPA' | 'UNDETERMINED';
  readonly usage: 'SUNYONG' | 'YEOKYONG';
  readonly sangshin: string | null;
  readonly sangshinStemHanja: string | null;
  readonly pagyeokFactor: string | null;
  readonly gueung: string | null;
  readonly reasons: readonly string[];
}

/** Structured model metadata validated for repository consistency, not provider authentication. */
export type PanelAdjudicationModelIdentity =
  | { readonly provider: 'anthropic'; readonly family: 'claude'; readonly version: '5' }
  | { readonly provider: 'openai'; readonly family: 'gpt'; readonly version: '5' };

/**
 * Source-tier metadata matching test/baseline/schema/sourceTier.schema.json.
 * URL and review fields are provenance/accountability metadata; they do not
 * independently authenticate a source, reviewer, model origin, or expertise.
 */
export interface SourceTierMetadata {
  readonly tier: string;
  readonly sourceType: string;
  readonly sourceUrl: string | null;
  readonly accessedAt: string;
  readonly quoteShort: string | null;
  readonly humanInterpretation: string;
  readonly copyrightNote: string;
  readonly authorityTruthEligible: boolean;
  readonly aiGenerated?: boolean;
  readonly panelAdjudication?: {
    readonly models: readonly PanelAdjudicationModelIdentity[];
    readonly scopes: readonly 'saju_doctrine'[];
    readonly adversarialVerification: true;
    readonly dossier: string;
    readonly recordId: string;
    readonly contentDigest: string;
  };
  /** Accountability metadata only; external expert certification is a separate release gate. */
  readonly authorityReview?: {
    readonly status: 'approved';
    readonly reviewedBy: string;
    readonly reviewedAt: string;
  };
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

/** Evidence-only jonggyeok classifier output; numeric signals are 0..1 ratios. */
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

/** Display-only candidate evidence; score and confidence are 0..1 ratios. */
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
  /** PR-5 (감사 B531): 합 상태 — 'HUA' | 'HAPGEO' | 'JAENGHAP' | 'YOHAP' (HAP만). */
  readonly hapState?: string;
  /** 합 상태 한글 표기 (예: '합이불화 — 기반(묶임)'). */
  readonly hapStateKo?: string;
  /** resultElement(화기 오행)를 확정 표기해도 되는지 — 합화(HUA) 성립 시에만 true. */
  readonly resultConfirmed?: boolean;
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
  /** ⚠ 산출 기준(basedOn)의 축약이지 앉은 궁위가 아니다 — 궁위는 seatPillars를 볼 것. */
  readonly position: string;
  readonly grade: string;
  readonly baseWeight: number;
  readonly positionMultiplier: number;
  readonly weightedScore: number;
  /** 산출 기준 원값: YEAR_BRANCH | DAY_BRANCH | MONTH_BRANCH | DAY_STEM | YEAR_STEM | OTHER. */
  readonly basedOn?: string;
  /** 실제 앉은 기둥(궁위) — 근묘화실 통변의 전제 (감사 C2, HANDOFF 작업 5-후속 스펙). */
  readonly seatPillars?: readonly ('year' | 'month' | 'day' | 'hour')[];
  /** 같은 (type, position) 키로 합쳐진 발동 횟수 (예: 도화 2개). */
  readonly count?: number;
  readonly qualityReasons?: readonly string[];
  readonly conditionPenalty?: number;
}

/** A single 대운 (10-year luck cycle) pillar entry. */
export interface TransitShinsalSummary {
  readonly anchor: 'YEAR_BRANCH' | string;
  readonly anchorBranch: string;
  readonly targetBranch: string;
  readonly twelveSal: string;
  readonly samjae: {
    readonly active: boolean;
    readonly phase: 'DEUL' | 'NUL' | 'NAL' | null | string;
    readonly group: readonly string[];
  };
  readonly sangmun: boolean;
  readonly jogaek: boolean;
}

export interface LuckPillarRelationSummary {
  readonly type: string;
  readonly members: readonly string[];
  readonly natalPositions: readonly ('year' | 'month' | 'day' | 'hour' | string)[];
  readonly luckPosition: 'luck' | string;
  readonly resultElement?: string | null;
}

export interface LuckPillarRelationsWithNatalSummary {
  readonly stemRelations: readonly LuckPillarRelationSummary[];
  readonly branchRelations: readonly LuckPillarRelationSummary[];
}

export interface LuckPairRelationSummary {
  readonly type: string;
  readonly members: readonly string[];
  readonly luckPositions: readonly ('decade' | 'year' | string)[];
  readonly resultElement?: string | null;
}

export interface LuckDecadeYearRelationSummary {
  readonly decadeIndex: number;
  readonly decadePillar: {
    readonly cheongan: string;
    readonly jiji: string;
  };
  readonly stemRelations: readonly LuckPairRelationSummary[];
  readonly branchRelations: readonly LuckPairRelationSummary[];
}

export interface LuckPillarRelationsWithDecadeSummary {
  readonly decadeRelations: readonly LuckDecadeYearRelationSummary[];
}

export interface LuckPillarStemBranchInteractionSummary {
  readonly gaedoo?: boolean;
  readonly geogak?: boolean;
  readonly labels?: readonly string[];
  readonly stemElement?: ElementKey | string;
  readonly branchElement?: ElementKey | string;
}

export interface LuckPillarAnnotationSummary {
  readonly tenGod?: string;
  readonly lifeStage?: string;
  readonly lifeStageKo?: string;
  readonly transitShinsal?: TransitShinsalSummary;
  readonly relationsWithNatal?: LuckPillarRelationsWithNatalSummary;
  readonly relationsWithDecade?: LuckPillarRelationsWithDecadeSummary;
  readonly stemBranchInteraction?: LuckPillarStemBranchInteractionSummary;
}

export interface DaeunPillarSummary extends LuckPillarAnnotationSummary {
  readonly stem: string;
  readonly branch: string;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
  readonly displayStartAge?: number | null;
  readonly displayEndAge?: number | null;
  /** Approximate UTC boundary for display/timeline only; continuous age remains authoritative. */
  readonly approxStartUtcMs?: number | null;
  readonly approxEndUtcMs?: number | null;
}

/** Daeun (대운, 10-year luck cycles) overview for a chart. Mirrors the
 *  shape that `saju-adapter.ts:extractDaeunInfo` already produces and that
 *  the LifeStageFortuneCard / FortuneCascade builders consume. PR-H-D
 *  formalises this as an interface so SajuSummary and SajuOutputSummary can
 *  declare it type-safely without changing the runtime payload. */
export interface DaeunInfoSummary {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  /** 표기용 정수 대운수 — 반올림 유파(기본: 1일 버림·2일 올림) + 하한 1. 상용 만세력 표기와 정합 (감사 B11). */
  readonly firstDaeunStartAgeDisplay?: number | null;
  readonly ageDisplayMode?: string | null;
  readonly ageDisplayLabel?: string | null;
  readonly firstDaeunStartMonths: number;
  /** 대운 기산 절기 id (예: 'LICHUN'). 과거에는 무관한 일경계 정책 문자열이 들어갔다. */
  readonly boundaryMode: string;
  /** 기산 절기의 UTC ms — 절기 경계 부재 시 null. */
  readonly boundaryUtcMs?: number | null;
  /** 출생→기산 절기까지 일수 (소수 3자리). */
  readonly deltaDays?: number | null;
  /** 대운수 산출 공식 문자열 (예: 'startAgeYears = (Δdays / 3)  // 三日一歲'). */
  readonly formula?: string | null;
  readonly warnings: readonly string[];
  readonly pillars: readonly DaeunPillarSummary[];
}

/** A single 세운 (yearly luck) pillar entry. */
export interface SaeunPillarSummary extends LuckPillarAnnotationSummary {
  readonly year: number;
  readonly stem: string;
  readonly branch: string;
  readonly startUtcMs?: number | null;
  readonly endUtcMs?: number | null;
  readonly approxStartAgeYears?: number | null;
  readonly approxEndAgeYears?: number | null;
}

export interface WolunPillarSummary extends LuckPillarAnnotationSummary {
  readonly year: number;
  readonly monthOrder: number;
  readonly startJie: string;
  readonly stem: string;
  readonly branch: string;
  readonly startUtcMs?: number | null;
  readonly endUtcMs?: number | null;
  readonly approxStartAgeYears?: number | null;
  readonly approxEndAgeYears?: number | null;
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
  readonly elementLabel?: string;
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
  readonly displayReasons?: readonly string[];
  readonly paretoFrontier: boolean;
}

export type NamingExplanationSignalKind = 'strength' | 'caution' | 'unavailable';
export type NamingExplanationPhraseMode =
  | 'assertive'
  | 'practical'
  | 'candidate'
  | 'deferred'
  | 'displayOnly';

export interface NamingExplanationSignal {
  readonly axis: keyof NamingScoreVector;
  readonly kind: NamingExplanationSignalKind;
  readonly phraseMode: NamingExplanationPhraseMode;
  readonly label: string;
  readonly value: number | null;
  readonly sourceTier: SourceTierMetadata;
  readonly phrase: string;
}

export interface NamingExplanation {
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly cautions: readonly string[];
  readonly signals: readonly NamingExplanationSignal[];
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
  readonly explanation?: NamingExplanation;
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
  readonly schoolPreset?: SchoolPresetMetadata;
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

export type SajuNameSafetyPosture = 'safe' | 'balanced' | 'aggressive';
export type SajuNameSafetyStrategy =
  | 'legacy_direct_reinforcement'
  | 'safe_balance'
  | 'aggressive_reinforcement';

export interface SajuNameSafetyProfile {
  readonly posture: SajuNameSafetyPosture;
  readonly strategy: SajuNameSafetyStrategy;
  readonly riskScore: number;
  readonly conflictLevel?: YongshinConsensusConflictLevel;
  readonly competingElements: readonly string[];
  readonly yongshinRatio: number;
  readonly heesinRatio: number;
  readonly gishinRatio: number;
  readonly gusinRatio: number;
  readonly reasons: readonly string[];
}

export type NameElementStrategy = 'legacy' | 'safeFallback';
export type NameElementResolutionSource =
  | 'resourceElement'
  | 'hangulPhonetic'
  | 'neutralEarth';
export type NameElementResolutionSafety = 'safe' | 'fallback' | 'aggressive';

export interface NameElementResolutionEvidence {
  readonly scope: 'surname' | 'givenName';
  readonly index: number;
  readonly hangul: string;
  readonly hanja: string;
  readonly selectedElement: ElementKey;
  readonly source: NameElementResolutionSource;
  readonly safety: NameElementResolutionSafety;
  readonly reason: string;
}

export interface NameElementStrategyEvidence {
  readonly requestedStrategy: NameElementStrategy;
  readonly effectiveStrategy: NameElementStrategy;
  readonly safe: boolean;
  readonly fallbackCount: number;
  readonly aggressiveCount: number;
  readonly decisions: readonly NameElementResolutionEvidence[];
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
  readonly safetyProfile?: SajuNameSafetyProfile;
  readonly elementStrategyEvidence?: NameElementStrategyEvidence;
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
  gyeokguk?: SajuGyeokgukOutputSummary;
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
  wolunPillars?: readonly WolunPillarSummary[];
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
  jieProximity?: JieProximitySummary;
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
  | 'yearPillar'
  | 'monthPillar'
  | 'dayPillar'
  | 'hourPillar'
  | 'yongshin'
  | 'gyeokguk'
  | 'strength'
  | 'tenGod'
  | 'relations'
  | 'shinsal'
  | 'fortuneTiming';

export interface SajuInputUncertainty {
  readonly unknownHour?: {
    readonly fallbackHour: number;
    readonly fallbackMinute: number;
    readonly fallbackTimezone?: string;
    readonly affectedAxes: readonly SajuInputUncertaintyAxis[];
    readonly affectedAxisLabels?: readonly string[];
    readonly confidenceTierShift: 'downgrade-one-step';
    readonly message: string;
  };
  /** A known hour whose minute was omitted. The adapter evaluates the whole
   *  HH:00..HH:59 envelope under the selected time-correction policy instead
   *  of silently treating the imputed :00 value as exact. */
  readonly unknownMinute?: {
    readonly fallbackHour: number;
    readonly fallbackMinute: number;
    readonly fallbackTimezone?: string;
    readonly evaluatedMinuteRange: {
      readonly from: 0;
      readonly to: 59;
    };
    readonly comparedMinutes: readonly [0, 59];
    /** True because minute imputation always limits continuous fortune timing
     *  precision even when no discrete pillar/output boundary is crossed. */
    readonly continuousTimingAffected: true;
    readonly boundarySensitive: boolean;
    readonly affectedAxes: readonly SajuInputUncertaintyAxis[];
    readonly affectedAxisLabels?: readonly string[];
    readonly confidenceTierShift: 'none' | 'downgrade-affected-axes-one-step';
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
export interface SajuGyeokgukOutputSummary {
  category: string;
  type: string;
  /** Internal score-facing confidence ratio in the closed interval 0..1. */
  confidence: number;
  basis?: GyeokgukBasisSummary;
  scores?: Readonly<Record<string, number>>;
}

export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  /** Internal score-facing confidence ratio in the closed interval 0..1. */
  finalConfidence: number;
  /** Recommendation confidence values are 0..1 ratios on this boundary. */
  recommendations: SajuYongshinRecommendation[];
  consensus?: YongshinConsensusScoreboard;
  methodBreakdown?: Record<string, unknown>;
}
