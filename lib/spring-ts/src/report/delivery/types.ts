import type {
  BirthInfo,
  NameCharInput,
  SpringOptions,
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
  | 'NAMING_CALENDAR_METHOD_NOT_ESTABLISHED'
  | 'SERVER_ENTITLEMENT_REQUIRED';

export interface DeliveryAvailabilityV1 {
  readonly status: DeliveryStatusV1;
  readonly reasonCodes: readonly DeliveryReasonCodeV1[];
}

export type FiveElementIdV1 = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type SajuJudgmentStrengthV1 = 'definite' | 'practical' | 'candidate' | 'deferred';

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

export interface PillarsFactV1 extends FactBaseV1 {
  readonly kind: 'pillars';
  readonly values: readonly {
    readonly position: 'year' | 'month' | 'day' | 'hour';
    readonly stem: { readonly code: string; readonly hangul: string; readonly hanja: string };
    readonly branch: { readonly code: string; readonly hangul: string; readonly hanja: string };
  }[];
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

export type ReportFactV1 =
  | MetricFactV1
  | DayMasterFactV1
  | StrengthFactV1
  | GyeokgukFactV1
  | YongshinFactV1
  | ElementDistributionFactV1
  | PillarsFactV1
  | NameCharacterFactV1
  | NamingFrameFactV1
  | NameSajuInteractionFactV1;

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
      readonly presentation: 'summary' | 'metrics' | 'pillars' | 'characters';
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
