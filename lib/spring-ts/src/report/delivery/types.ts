import type {
  BirthInfo,
  LunarConversionSummary,
  NameCharInput,
  SajuInputUncertainty,
  SpringOptions,
  TimeCorrectionProvenance,
} from '../../types.js';
import type { LocalAnalysisPrecisionConfigV1 } from '../analysis-options-types.js';

export const REPORT_DELIVERY_REQUEST_SCHEMA_V1 = 'spring-ts.report-delivery-request.v1' as const;
export const REPORT_DELIVERY_SCHEMA_V1 = 'spring-ts.report-delivery.v1' as const;

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export type ReportSurfaceIdV1 = 'integrated' | 'saju' | 'naming';
export type ReportDepthV1 = 'brief' | 'standard' | 'expert';
export type CalendarPeriodIdV1 = 'today' | 'thisWeek' | 'thisMonth' | 'thisYear';
export type ReportLifeSelectionV1 = 'summary';
export type ReportCategoryIdV1 =
  | 'overall'
  | 'wealth'
  | 'health'
  | 'academic'
  | 'romance'
  | 'family'
  | 'career'
  | 'study_document'
  | 'expression_children'
  | 'health_stress'
  | 'movement';

export interface TimelineSelectionV1 {
  readonly periods: NonEmptyReadonlyArray<CalendarPeriodIdV1>;
  readonly categories: NonEmptyReadonlyArray<ReportCategoryIdV1>;
}

export type ReportSurfaceSelectionV1 =
  | {
      readonly id: 'integrated';
      /** The integrated hub is deliberately plain-language only. */
      readonly depth: 'brief' | 'standard';
      /** Omit for a hero/interaction-only payload. */
      readonly timeline?: TimelineSelectionV1;
    }
  | {
      readonly id: 'saju';
      readonly depth: ReportDepthV1;
      readonly timeline?: TimelineSelectionV1;
      /** Life flow is separate from calendar tabs by contract. */
      readonly life?: ReportLifeSelectionV1;
    }
  | {
      readonly id: 'naming';
      readonly depth: ReportDepthV1;
    };

export interface ReportDeliverySelectionV1 {
  readonly schemaVersion: typeof REPORT_DELIVERY_REQUEST_SCHEMA_V1;
  readonly surfaces: NonEmptyReadonlyArray<ReportSurfaceSelectionV1>;
}

/** Free delivery is an offline/local computation contract. The Node-only KASI
 * network opt-in remains available to explicit server workflows, never here. */
export type LocalReportPrecisionConfigV1 = LocalAnalysisPrecisionConfigV1;

export type LocalReportOptionsV1 = Omit<
  SpringOptions,
  'precisionConfig' | 'sajuConfig' | 'limit' | 'offset'
> & {
  readonly precisionConfig?: LocalReportPrecisionConfigV1;
};

/** Public report identity input. Derived strokes/elements/legal metadata are
 * resolved from canonical engine data and must not be supplied by callers. */
export type ReportNameCharacterInputV1 = Pick<NameCharInput, 'hangul' | 'hanja'>;

/**
 * Dedicated request for the future three-surface frontend.
 *
 * It intentionally does not extend the legacy FortuneReport response. The
 * engine can therefore return only the requested mobile payload while the
 * current frontend keeps using getFortuneReport() without any shape change.
 */
export interface ReportDeliveryRequestV1 {
  readonly birth: BirthInfo;
  readonly surname?: ReportNameCharacterInputV1[];
  readonly givenName?: ReportNameCharacterInputV1[];
  readonly targetDate?: string;
  readonly options?: LocalReportOptionsV1;
  /** Optional stable ID from CandidateSearchResponseV1; verified against the resolved name. */
  readonly candidateId?: string;
  readonly delivery: ReportDeliverySelectionV1;
}

export type DeliveryStatusV1 = 'ready' | 'limited' | 'unavailable';
export type DeliveryReasonCodeV1 =
  | 'SAJU_ANALYSIS_LIMITED'
  | 'BIRTH_TIME_IMPUTED'
  | 'SAJU_JUDGMENT_LOW_CONFIDENCE'
  | 'YONGSHIN_JONGGYEOK_RISK'
  | 'NAME_INPUT_MISSING'
  | 'NAME_ANALYSIS_UNAVAILABLE'
  | 'INTERACTION_EVIDENCE_INSUFFICIENT'
  | 'YONGSHIN_CONSENSUS_CONFLICT'
  | 'NAME_SAJU_SAFETY_CAUTION'
  | 'GENERATED_CONTENT_PARTIAL'
  | 'NOT_APPLICABLE'
  | 'METHOD_SCOPE_LIMITED'
  | 'CONTENT_EXPERT_REVIEW_REQUIRED'
  | 'NAMING_CALENDAR_METHOD_NOT_ESTABLISHED'
  | 'SERVER_ENTITLEMENT_REQUIRED';

export interface DeliveryAvailabilityV1 {
  readonly status: DeliveryStatusV1;
  readonly reasonCodes: readonly DeliveryReasonCodeV1[];
}

export type FiveElementIdV1 = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type SajuJudgmentStrengthV1 = 'definite' | 'practical' | 'candidate' | 'deferred';
export type ReportSchoolPresetV1 =
  | 'korean'
  | 'chinese'
  | 'modern'
  | 'korean_modern'
  | 'classical_text'
  | 'naming_safe';
export type ReportYongshinModeV1 =
  | 'classical_blend'
  | 'chengbai_strict'
  | 'consensus_aware';
export type YongshinMethodAxisV1 =
  | 'eokbu'
  | 'johu'
  | 'gyeokguk'
  | 'tonggwan'
  | 'byeongyak'
  | 'siksangFlow';

export interface YongshinInterpretationPolicyV1 {
  /** Product default is `korean`; an explicit request remains distinguishable. */
  readonly schoolPreset: ReportSchoolPresetV1;
  readonly schoolLabel: string;
  readonly schoolSelection: 'product_default' | 'user_selected';
  /** Whether the Spring scoring preset weights were actively applied. */
  readonly schoolWeightsApplied: boolean;
  /** Product default is `chengbai_strict`; an explicit request remains distinguishable. */
  readonly yongshinMode: ReportYongshinModeV1;
  readonly yongshinModeSelection: 'product_default' | 'user_selected';
}

export interface YongshinMethodCandidateV1 {
  readonly method: YongshinMethodAxisV1;
  readonly element: FiveElementIdV1 | null;
  /** The upstream method-axis signal, preserved as a 0..1 ratio. */
  readonly score: number;
}

interface FactBaseV1 {
  readonly id: string;
  readonly domain: 'saju' | 'naming' | 'interaction';
  readonly method: string;
}

export interface MetricFactV1 extends FactBaseV1 {
  readonly kind: 'metric';
  readonly label: string;
  readonly value: number;
  readonly unit:
    | 'score_0_100'
    | 'confidence_0_100'
    | 'ratio_0_1'
    | 'percent_0_100'
    | 'count'
    | 'stroke_count'
    | 'stars_1_5';
  readonly range: { readonly min: number; readonly max: number };
  readonly direction: 'higher_is_better' | 'higher_is_risk' | 'neutral';
}

export interface DayMasterFactV1 extends FactBaseV1 {
  readonly kind: 'day_master';
  readonly stem: string;
  readonly element: FiveElementIdV1 | null;
  readonly polarity: string;
}

export interface StrengthFactV1 extends FactBaseV1 {
  readonly kind: 'strength';
  readonly level: string;
  /** Stable code for routing/content selection; never derived from `level` copy downstream. */
  readonly levelCode: 'STRONG' | 'BALANCED' | 'WEAK' | 'UNKNOWN';
  readonly isStrong: boolean;
  readonly judgmentStrength?: SajuJudgmentStrengthV1;
}

export interface GyeokgukFactV1 extends FactBaseV1 {
  readonly kind: 'gyeokguk';
  readonly type: string;
  readonly typeCode: string | null;
  readonly category: string;
  readonly categoryCode: 'NORMAL' | 'JONGGYEOK' | 'UNKNOWN';
  readonly baseTenGod: string | null;
  readonly baseTenGodCode: string | null;
  readonly confidence: number;
  readonly judgmentStrength?: SajuJudgmentStrengthV1;
}

export interface YongshinFactV1 extends FactBaseV1 {
  readonly kind: 'yongshin';
  readonly element: FiveElementIdV1 | null;
  readonly confidence: number;
  readonly judgmentStrength?: SajuJudgmentStrengthV1;
  readonly warnings: readonly string[];
  /** Additive policy provenance for new deliveries; omitted only by historical V1 payloads. */
  readonly interpretationPolicy?: YongshinInterpretationPolicyV1;
  /** Per-method candidates remain visible when the selected conclusion conflicts with another method. */
  readonly methodCandidates?: readonly YongshinMethodCandidateV1[];
  readonly consensus?: {
    readonly conflictLevel: 'none' | 'low' | 'medium' | 'high';
    readonly competingElements: readonly FiveElementIdV1[];
  };
  readonly jonggyeokRisk?: {
    readonly level: 'HIGH' | 'INFO';
    readonly direction: 'PRESSURE' | 'SUPPORT';
    readonly strengthIndex: number;
    readonly dominanceRatio: number;
    readonly subtypes: readonly string[];
    readonly maxCandidateScore: number;
    readonly confidenceAttenuated: boolean;
  };
}

export interface ElementDistributionFactV1 extends FactBaseV1 {
  readonly kind: 'element_distribution';
  readonly source: 'saju' | 'name';
  readonly subjectScope: 'natal_chart' | 'full_name';
  /** Each source is normalized independently; raw saju/name counts are not overlaid. */
  readonly normalization: 'within_source_percent';
  readonly values: readonly {
    readonly element: FiveElementIdV1;
    readonly sharePercent: number;
  }[];
}

export type SajuPillarPositionV1 = 'year' | 'month' | 'day' | 'hour';

export interface PillarsFactV1 extends FactBaseV1 {
  readonly kind: 'pillars';
  readonly values: readonly {
    readonly position: SajuPillarPositionV1;
    readonly stem: { readonly code: string; readonly hangul: string; readonly hanja: string };
    readonly branch: { readonly code: string; readonly hangul: string; readonly hanja: string };
  }[];
}

/**
 * Explicit provenance shared by normalized projections of existing
 * `SajuSummary` fields. These facts copy and normalize engine output; they do
 * not run another naming or saju judgment and never inherit authored insight
 * copy as fact authority.
 */
export interface SajuSummaryProjectionProvenanceV1 {
  readonly source: 'spring-ts.SajuSummary';
  readonly projection: 'normalized_without_recalculation';
  readonly sourceFields: readonly string[];
}

export type TenGodCodeV1 =
  | 'BI_GYEON'
  | 'GYEOB_JAE'
  | 'SIK_SIN'
  | 'SANG_GWAN'
  | 'PYEON_JAE'
  | 'JEONG_JAE'
  | 'PYEON_GWAN'
  | 'JEONG_GWAN'
  | 'PYEON_IN'
  | 'JEONG_IN';

export interface TenGodDescriptorV1 {
  /** Engine display label, retained verbatim after bounded-text validation. */
  readonly label: string;
  /** Canonical code when the engine label resolves to the public ten-god vocabulary. */
  readonly code: TenGodCodeV1 | null;
}

/**
 * Raw shinsal detections retained even when no authored plain-language
 * interpretation exists. Internal weights and penalties deliberately stay
 * behind the delivery boundary.
 */
export interface ShinsalHitsFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'shinsal_hits';
  readonly domain: 'saju';
  readonly method: 'saju-ts.shinsal-summary-projection.v1';
  readonly sourceFields: readonly ['shinsalHits'];
  readonly hits: readonly {
    readonly name: string;
    /** `position` is the engine's calculation-basis label, not a seat claim. */
    readonly calculationBasis: {
      readonly label: string;
      readonly code: string | null;
    };
    readonly grade: string;
    /** Actual seated pillars, when surfaced by the engine. */
    readonly seatPillars: readonly SajuPillarPositionV1[];
    readonly occurrenceCount: number;
  }[];
}

/** Per-pillar ten-god structure, including the engine's hidden-stem mapping. */
export interface TenGodAnalysisFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'ten_god_analysis';
  readonly domain: 'saju';
  readonly method: 'saju-ts.ten-god-analysis-projection.v1';
  readonly sourceFields: readonly ['tenGodAnalysis'];
  readonly dayMasterStem: string;
  readonly positions: readonly {
    readonly position: SajuPillarPositionV1;
    readonly cheongan: TenGodDescriptorV1;
    readonly jijiPrincipal: TenGodDescriptorV1;
    readonly hiddenStems: readonly {
      readonly stem: string;
      readonly element: FiveElementIdV1;
      readonly ratio: number;
      readonly tenGod: TenGodDescriptorV1;
    }[];
  }[];
}

/**
 * Natal stem/branch relations. Free-form engine notes and provisional internal
 * relation scores are intentionally omitted; authored explanations remain
 * `ReportInterpretationV1`.
 */
export interface NatalRelationsFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'natal_relations';
  readonly domain: 'saju';
  readonly method: 'saju-ts.natal-relations-projection.v1';
  readonly sourceFields: readonly ['cheonganRelations', 'jijiRelations'];
  readonly cheongan: readonly {
    readonly type: string;
    readonly stems: readonly string[];
    readonly hapState: string | null;
    readonly resultElement: FiveElementIdV1 | null;
    readonly resultConfirmed: boolean;
  }[];
  readonly jiji: readonly {
    readonly type: string;
    readonly branches: readonly string[];
    readonly outcome: string | null;
  }[];
}

/** Engine classifications of materially deficient or excessive natal elements. */
export interface ElementBalanceFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'element_balance';
  readonly domain: 'saju';
  readonly method: 'saju-ts.element-balance-projection.v1';
  readonly sourceFields: readonly ['deficientElements', 'excessiveElements'];
  readonly deficient: readonly FiveElementIdV1[];
  readonly excessive: readonly FiveElementIdV1[];
}

/**
 * Engine-returned civil/solar time evidence used for day/hour boundary
 * decisions. Consumers must display these values as returned and must not
 * recompute the corrected clock time from the component offsets.
 */
export interface TimeCorrectionFactV1 extends FactBaseV1 {
  readonly kind: 'time_correction';
  /** Original calendar input and the effective solar basis used by saju-ts. */
  readonly input: TimeCorrectionProvenance['input'];
  /** Null for exact input; otherwise the engine-owned imputation envelope. */
  readonly inputUncertainty: SajuInputUncertainty | null;
  /** Non-null only when the original input calendar was lunar. */
  readonly lunarConversion: LunarConversionSummary | null;
  /**
   * Location/timezone basis used by the engine. `inputLabel` is retained only
   * as provenance. Coordinates are null for timezone-only input and must be
   * treated as a correction basis only when `coordinatesApplied` is true.
   */
  readonly location: {
    readonly inputLabel: string | null;
    readonly resolvedRegionCode: string | null;
    readonly latitude: number | null;
    readonly longitude: number | null;
    readonly timezone: string;
    readonly source: 'explicit' | 'region' | 'timezone' | 'default';
    readonly coordinatesApplied: boolean;
  };
  /**
   * Meridian used as the longitude-correction reference. Null only when
   * longitude correction is disabled.
   */
  readonly referenceMeridianDegrees: number | null;
  /** Source used to derive and independently validate the reference meridian. */
  readonly referenceMeridianBasis: TimeCorrectionProvenance['referenceMeridianBasis'];
  readonly standardLocalDateTime: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
  };
  readonly adjustedSolarLocalDateTime: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
  };
  readonly corrections: {
    readonly daylightSavingMinutes: number;
    readonly longitudeMinutes: number;
    readonly equationOfTimeMinutes: number;
  };
  readonly policy: {
    readonly trueSolarTime: 'on' | 'off';
    readonly longitudeCorrection: 'on' | 'off';
    readonly longitudeReference: 'off' | 'civilOffsetMeridian' | 'legacyPreset';
    /** Whether this request explicitly required a resolved region/coordinate tuple. */
    readonly explicitLocationRequired: boolean;
    readonly yaza: 'on' | 'off';
    readonly yazaMode: '23:00' | '23:30';
  };
  /** Whether solar correction itself crossed the civil calendar date. */
  readonly solarDateChanged: boolean;
  /**
   * Whether the corrected clock is inside the selected late-zi boundary
   * window. This is an evidence flag, not an independent pillar calculation.
   */
  readonly yazaBoundaryEffect: 'disabled' | 'outside_boundary' | 'inside_boundary';
}

export interface NameCharacterFactV1 extends FactBaseV1 {
  readonly kind: 'name_character';
  readonly position: 'surname' | 'givenName';
  readonly index: number;
  readonly hangul: string;
  readonly hanja?: string;
  readonly meaning?: string;
  readonly strokes?: number;
  readonly element?: FiveElementIdV1;
  readonly polarity?: string;
  readonly legal: 'registrable' | 'not_registrable' | 'unknown';
}

/**
 * Selective projection of the official-name sample already attached to
 * `NamingReport`. Free-form evidence copy is intentionally excluded: the
 * delivery carries only source values and their authority metadata.
 */
export interface NamingTrendFactV1 extends FactBaseV1 {
  readonly kind: 'naming_trend';
  readonly domain: 'naming';
  readonly method: 'spring-ts.official-name-trend-projection.v1';
  readonly source: 'spring-ts.NamingReport.nameTrend';
  readonly projection: 'selective_without_recalculation';
  readonly sourceFields: readonly ['nameTrend'];
  readonly sourceTier: 'T5_OFFICIAL';
  readonly authorityTruthEligible: true;
  readonly givenHangul: string;
  readonly gender: 'male' | 'female' | 'unknown';
  readonly birthYear: number | null;
  readonly matchedYear: number | null;
  readonly latestYear: number;
  readonly trendFit: number | null;
  readonly trendRisk: number | null;
  /** Retained from the producer and required to equal `trendFit`. */
  readonly eraFitScore: number | null;
  readonly status: 'current' | 'era_fit' | 'dated' | 'overused' | 'unknown';
  readonly matchedPoint: {
    readonly year: number;
    readonly rank: number;
    readonly count: number;
  } | null;
  readonly latestPoint: {
    readonly year: number;
    readonly rank: number;
    readonly count: number;
  } | null;
}

/**
 * Mechanical transition evidence from the existing phonetic analyzer.
 * Authored warning/evidence sentences are not promoted to deterministic fact
 * authority; the producer's non-authoritative tier is explicit in the DTO.
 */
export interface NamingPhoneticFactV1 extends FactBaseV1 {
  readonly kind: 'naming_phonetic';
  readonly domain: 'naming';
  readonly method: 'spring-ts.phonetic-transition-projection.v1';
  readonly source: 'spring-ts.NamingReport.phonetic';
  readonly projection: 'selective_without_recalculation';
  readonly sourceFields: readonly ['phonetic'];
  readonly sourceTier: 'T3_AUTHORED_INTERPRETATION';
  readonly authorityTruthEligible: false;
  readonly fullHangul: string;
  readonly surnameHangul: string;
  readonly givenHangul: string;
  readonly phoneticScore: number | null;
  readonly transitionScore: number | null;
  readonly familyNameFitScore: number | null;
  readonly status: 'smooth' | 'watch' | 'awkward' | 'unknown';
  readonly transitions: readonly {
    readonly from: string;
    readonly to: string;
    readonly boundary: 'surname_given' | 'given_internal';
    readonly score: number;
    readonly risk: 'low' | 'medium' | 'high';
    readonly signals: readonly {
      readonly code: string;
      readonly severity: 'low' | 'medium' | 'high';
      readonly penalty: number;
    }[];
  }[];
}

/**
 * Name-stat values already bound to the selected `SpringReport`. This fact is
 * omitted when the delivery did not receive a SpringReport or when all three
 * fields are unavailable; the delivery layer never performs a replacement
 * lookup or manufactures a nearby rank.
 */
export interface NameStatisticsFactV1 extends FactBaseV1 {
  readonly kind: 'name_statistics';
  readonly domain: 'naming';
  readonly method: 'spring-ts.name-stat-summary-projection.v1';
  readonly source: 'spring-ts.SpringReport';
  readonly projection: 'selective_without_recalculation';
  readonly sourceFields: readonly ['popularityRank', 'maleRatio', 'nameGender'];
  readonly popularityRank: number | null;
  readonly maleRatio: number | null;
  readonly nameGender: 'male' | 'female' | 'unknown';
}

export interface NamingFrameFactV1 extends FactBaseV1 {
  readonly kind: 'naming_frame';
  readonly stage: 'earlyLife' | 'youthLife' | 'middleLife' | 'lateAndTotal';
  readonly frameType: 'won' | 'hyung' | 'lee' | 'jung';
  readonly strokeSum: number;
  readonly element: FiveElementIdV1 | null;
  readonly polarity: string;
  /** Configured fortune bucket score (currently one of 0,5,10,15,20,25), not stars. */
  readonly luckyLevel: number;
}

export interface NameSajuInteractionFactV1 extends FactBaseV1 {
  readonly kind: 'name_saju_interaction';
  readonly method: 'yongshin-gishin-element-match.v1';
  readonly classification:
    | 'supportive_signal'
    | 'mixed_signals'
    | 'no_direct_match'
    | 'caution_signal'
    | 'unavailable';
  readonly yongshinElement: FiveElementIdV1 | null;
  readonly gishinElement: FiveElementIdV1 | null;
  readonly nameElements: readonly FiveElementIdV1[];
  readonly nameElementScope: 'surname_and_given_name';
  readonly yongshinMatchCount: number;
  readonly gishinMatchCount: number;
  /** Established engine safety posture; separate from the direct-match signal. */
  readonly safety?: {
    readonly posture: 'safe' | 'balanced' | 'aggressive';
    readonly strategy:
      | 'legacy_direct_reinforcement'
      | 'safe_balance'
      | 'aggressive_reinforcement';
    readonly conflictLevel?: 'none' | 'low' | 'medium' | 'high';
    readonly competingElements: readonly FiveElementIdV1[];
  };
  readonly limitations: readonly (
    | 'element_match_scope_only'
    | 'not_a_combined_balance_score'
    | 'consensus_conflict_present'
    | 'safety_profile_caution'
    | 'safety_profile_unavailable'
  )[];
}

/** Day-pillar-derived void (공망) branches, projected verbatim. */
export interface GongmangFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'gongmang';
  readonly domain: 'saju';
  readonly method: 'saju-ts.gongmang-projection.v1';
  readonly sourceFields: readonly ['gongmang'];
  /** Engine display labels for the two void branches (e.g. `진(辰)`). */
  readonly voidBranches: readonly [string, string];
}

export type GyeokgukSeongpaeVerdictV1 =
  | 'SEONGGYEOK'
  | 'PAGYEOK'
  | 'PAJUNG_YUGU'
  | 'SEONGJUNG_YUPA'
  | 'UNDETERMINED';

/**
 * Gyeokguk seong/pae (성패) adjudication. Free-form engine reasons stay behind
 * the delivery boundary; authored explanations remain interpretations.
 */
export interface GyeokgukSeongpaeFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'gyeokguk_seongpae';
  readonly domain: 'saju';
  readonly method: 'saju-ts.gyeokguk-seongpae-projection.v1';
  readonly sourceFields: readonly ['gyeokguk'];
  readonly verdict: GyeokgukSeongpaeVerdictV1;
  readonly usage: 'SUNYONG' | 'YEOKYONG';
  readonly sangshin: string | null;
  readonly sangshinStemHanja: string | null;
  readonly pagyeokFactor: string | null;
  readonly gueung: string | null;
}

/** Twelve life stages (십이운성) of each natal pillar, projected verbatim. */
export interface SibiUnseongFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'sibi_unseong';
  readonly domain: 'saju';
  readonly method: 'saju-ts.sibi-unseong-projection.v1';
  readonly sourceFields: readonly ['sibiUnseong'];
  readonly stages: readonly {
    readonly position: SajuPillarPositionV1;
    /** Engine display label for the stage (e.g. `장생`). */
    readonly stage: string;
  }[];
}

/**
 * Personal daeun (대운) decade intervals. Ages are the engine's continuous
 * interval values; `startAgeDisplay` mirrors the common almanac notation.
 */
export interface DaeunTimelineFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'daeun_timeline';
  readonly domain: 'saju';
  readonly method: 'saju-ts.daeun-info-projection.v1';
  readonly sourceFields: readonly ['daeunInfo'];
  readonly isForward: boolean;
  readonly firstStartAge: number;
  readonly firstStartAgeDisplay: number | null;
  /** Solar-term anchor for the daeun start count (e.g. `LICHUN`). */
  readonly boundaryTermId: string | null;
  readonly periods: readonly {
    readonly order: number;
    readonly stem: string;
    readonly branch: string;
    /** Inclusive continuous start age. */
    readonly startAge: number;
    /** Exclusive continuous end age. */
    readonly endAge: number;
    readonly tenGod: string | null;
    /** Twelve-life-stage label of this decade pillar, when annotated. */
    readonly lifeStage: string | null;
  }[];
}

/** Natal yin/yang counts over the eight characters (body basis). */
export interface YinYangBalanceFactV1
  extends FactBaseV1, SajuSummaryProjectionProvenanceV1 {
  readonly kind: 'yin_yang_balance';
  readonly domain: 'saju';
  readonly method: 'saju-ts.yin-yang-balance-projection.v1';
  readonly sourceFields: readonly ['yinYangBalance'];
  readonly yang: number;
  readonly yin: number;
  readonly stems: { readonly yang: number; readonly yin: number };
  readonly branches: { readonly yang: number; readonly yin: number };
  readonly dominant: 'YANG' | 'YIN' | 'EVEN';
}

export type ReportFactV1 =
  | MetricFactV1
  | DayMasterFactV1
  | StrengthFactV1
  | GyeokgukFactV1
  | YongshinFactV1
  | ElementDistributionFactV1
  | PillarsFactV1
  | ShinsalHitsFactV1
  | TenGodAnalysisFactV1
  | NatalRelationsFactV1
  | ElementBalanceFactV1
  | TimeCorrectionFactV1
  | NameCharacterFactV1
  | NamingTrendFactV1
  | NamingPhoneticFactV1
  | NameStatisticsFactV1
  | NamingFrameFactV1
  | NameSajuInteractionFactV1
  | GongmangFactV1
  | GyeokgukSeongpaeFactV1
  | SibiUnseongFactV1
  | DaeunTimelineFactV1
  | YinYangBalanceFactV1;

export interface ReportInterpretationV1 {
  readonly id: string;
  readonly domain: 'fortune' | 'saju' | 'naming' | 'interaction';
  readonly availability: DeliveryAvailabilityV1;
  /** Narrative is interpretive and never upgrades to engine fact authority. */
  readonly authority: 'interpretive';
  readonly origin: 'deterministic_template' | 'authored_bundle' | 'mixed';
  readonly factRefs: readonly string[];
  readonly brief: { readonly headline: string; readonly hook?: string };
  readonly standard?: {
    readonly paragraphs: readonly string[];
    readonly livingTips?: readonly string[];
    readonly cautions?: readonly string[];
  };
  readonly expert?: {
    readonly paragraphs: readonly string[];
    readonly numericalFactRefs?: readonly string[];
  };
}

interface BlockBaseV1 {
  readonly id: string;
  readonly availability: DeliveryAvailabilityV1;
  readonly title: string;
}

export type ReportBlockV1 =
  | (BlockBaseV1 & {
      readonly kind: 'hero';
      readonly interpretationRef: string;
      readonly supportingFactRefs: readonly string[];
    })
  | (BlockBaseV1 & {
      readonly kind: 'fact_group';
      readonly factRefs: readonly string[];
      readonly interpretationRef?: string;
      readonly presentation: 'summary' | 'metrics' | 'pillars' | 'characters' | 'evidence';
    })
  | (BlockBaseV1 & {
      readonly kind: 'element_comparison';
      readonly sajuDistributionFactRef: string;
      readonly nameDistributionFactRef: string;
      readonly presentation: 'overlay';
      readonly normalization: 'within_source_percent';
    })
  | (BlockBaseV1 & {
      readonly kind: 'timeline';
      /** Calendar cells are natal-saju transit readings, not name-caused fortune. */
      readonly basis: 'natal_saju_calendar';
      readonly defaultPeriod: CalendarPeriodIdV1;
      readonly availablePeriodOrder: readonly CalendarPeriodIdV1[];
      readonly periods: readonly {
        readonly id: CalendarPeriodIdV1;
        readonly label: string;
        readonly cells: readonly {
          readonly category: ReportCategoryIdV1;
          readonly availability: DeliveryAvailabilityV1;
          readonly ratingFactRef?: string;
          readonly interpretationRef?: string;
        }[];
      }[];
    })
  | (BlockBaseV1 & {
      readonly kind: 'life_flow';
      readonly interpretationRef: string;
      readonly ratingFactRef?: string;
      /** Per-daeun overall ratings for the life curve; each ref is a
       *  `stars_1_5` metric graded by the same engine cell grader. */
      readonly daeunRatings?: readonly {
        readonly order: number;
        readonly ratingFactRef: string;
      }[];
    })
  | (BlockBaseV1 & {
      readonly kind: 'four_frames';
      readonly items: readonly {
        readonly stage: NamingFrameFactV1['stage'];
        readonly factRef: string;
        readonly interpretationRef?: string;
      }[];
    })
  | (BlockBaseV1 & {
      readonly kind: 'capability';
      readonly feature: 'calendar_fortune';
    })
  | (BlockBaseV1 & {
      readonly kind: 'premium_teaser';
      readonly offerId: 'story_completion';
      readonly teaserInterpretationRef?: string;
    })
  | (BlockBaseV1 & {
      readonly kind: 'deep_links';
      /** URLs remain frontend-owned; the backend supplies only semantic targets. */
      readonly targets: readonly { readonly surface: ReportSurfaceIdV1; readonly anchor?: string }[];
    });

export interface ReportSurfaceV1 {
  readonly id: ReportSurfaceIdV1;
  readonly depth: ReportDepthV1;
  /** Stable lazy-merge key; semantic `id` alone is intentionally not a cache key. */
  readonly sliceKey: string;
  readonly availability: DeliveryAvailabilityV1;
  /** Array order is the recommended information order, not a UI component DSL. */
  readonly blocks: readonly ReportBlockV1[];
}

export interface ReportOfferV1 {
  readonly id: 'story_completion';
  readonly productId: 'report.story-completion.v1';
  readonly access: 'requires_server_entitlement';
  readonly entitlementAuthority: 'server';
  /** Full paid content is intentionally absent from this public DTO. */
  readonly contentState: 'omitted';
  /** Entitlements must be scoped to this exact analysis/name pair. */
  readonly analysisId: string;
  readonly candidateId?: string;
}

export type Sha256DigestV1 = `sha256:${string}`;

export interface ReportDeliveryV1 {
  readonly schemaVersion: typeof REPORT_DELIVERY_SCHEMA_V1;
  /** Opaque, engine-session-stable ID used to merge lazy period/depth chunks. */
  readonly analysisId: string;
  readonly generatedAt: string;
  readonly anchorDate: string;
  readonly subject: { readonly displayName?: string; readonly candidateId?: string };
  readonly coverage: {
    /** Exact requested slices carried by this payload. */
    readonly surfaces: readonly ReportSurfaceSelectionV1[];
  };
  readonly provenance: {
    readonly engine: 'spring-ts';
    readonly facts: 'deterministic-engine-output';
    readonly narratives: 'interpretive-not-fact-authority';
    /** Lazy chunks may merge only inside the same engine session and version set. */
    readonly cacheScope: 'engine_session';
    /**
     * Identity of the declared tracked build-input source set. This is not an
     * accuracy attestation, an execution transcript, or a source authority.
     */
    readonly artifactIdentity: {
      readonly manifestSchema: 'namespring.engine-build-input-manifest.v1';
      readonly digest: Sha256DigestV1;
      readonly authority: 'build-time-artifact-identity-only';
      readonly correctnessAuthority: false;
    };
    readonly versions: {
      readonly engine: string;
      /** Conservative digest over tracked runtime code plus rule inputs. */
      readonly ruleset: Sha256DigestV1;
      /** Digest over the declared runtime data inputs only. */
      readonly data: Sha256DigestV1;
      readonly deliveryTemplate: 'delivery-template-v1';
      readonly timelineArticleTemplate: 'article-v1';
    };
    readonly computation: {
      readonly natalSaju: 'birth-derived-invariant';
      readonly naming: 'name-derived';
      readonly interaction: 'birth-and-name-conditioned';
    };
  };
  readonly availability: DeliveryAvailabilityV1;
  /** Deterministic/structured layer. */
  readonly facts: readonly ReportFactV1[];
  /** Human-readable, explicitly interpretive layer. */
  readonly interpretations: readonly ReportInterpretationV1[];
  /** Ordered semantic composition layer. */
  readonly surfaces: readonly ReportSurfaceV1[];
  readonly offers: readonly ReportOfferV1[];
}
