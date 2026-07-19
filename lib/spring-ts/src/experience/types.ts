import type {
  CandidatePresentationEvidence,
  CandidateStrengthProfile,
  BirthInfo,
  NameCharInput,
  NameGenderTendency,
  NamingScoreVector,
  SpringOptions,
  SpringRequest,
} from '../types.js';
import type { NatalEvidenceAssessmentV1 } from '../natal-evidence.js';
import type { LocalAnalysisPrecisionConfigV1 } from '../report/analysis-options-types.js';
import type { HanjaLegalStatus } from '../hanja-annotations.js';
import type {
  CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2,
} from '../candidate-selection.js';

export const CANDIDATE_SEARCH_SCHEMA_V1 = 'spring-ts.candidate-search.v1' as const;
export const CANDIDATE_ORDERING_POLICY_V1 =
  'spring-ts.candidate-selection.v1' as const;
export const CANDIDATE_PRESENTATION_ORDERING_POLICY_V2 =
  'spring-ts.candidate-presentation.v2' as const;
export const CANDIDATE_PARETO_ORDERING_POLICY_V1 =
  'spring-ts.candidate-pareto-frontier.v1' as const;
export const CANDIDATE_QUERY_ID_PATTERN_V1 = /^candidate_query_v1_[0-9a-f]{32}$/u;

export type LocalCandidateSearchPrecisionConfigV1 = LocalAnalysisPrecisionConfigV1;

export type LocalCandidateSearchOptionsV1 = Omit<
  SpringOptions,
  'sajuConfig' | 'precisionConfig'
> & {
  readonly precisionConfig?: LocalCandidateSearchPrecisionConfigV1;
};

/** Candidate discovery is a free, local-only entrypoint. Raw server config and
 * remote lunar conversion are absent from its compile-time contract. */
export interface LocalCandidateSearchRequestV1 extends Omit<SpringRequest, 'birth' | 'options'> {
  readonly birth: BirthInfo;
  readonly options?: LocalCandidateSearchOptionsV1;
}

export interface CandidateSearchContinuationV1 {
  readonly queryId: string;
}

export interface CandidateSearchQueryV1 {
  readonly queryId: string;
  readonly scope: 'engine_session';
  readonly expiresOn: 'engine_close_or_lru_eviction';
  readonly maxBrowsableCandidates: number;
  /** True when the engine intentionally retained only the bounded top-N view. */
  readonly truncated: boolean;
  readonly clientInstruction: 'reuse_query_id_for_every_page';
}

export interface CandidateSearchOrderingV1 {
  /** SpringEngine establishes recommendation order locally; the UI never reranks. */
  readonly authority: 'spring_engine';
  readonly source: 'SpringEngine.getNameCandidateSummaries';
  readonly policyVersion:
    | typeof CANDIDATE_PRESENTATION_ORDERING_POLICY_V2
    | typeof CANDIDATE_PARETO_ORDERING_POLICY_V1;
  readonly mode: 'recommended' | 'pareto_frontier';
  readonly clientInstruction: 'preserve_order_and_rank';
  readonly rankScope: 'query';
  readonly rankingBasis: {
    /** Existing spring-ts engine score; not an external scholarly authority claim. */
    readonly rawScore: 'engine_score_unchanged';
    readonly presentationScope:
      | 'bounded_equivalent_score_window'
      | 'bounded_pareto_pool_with_diversity';
    readonly rawScoreWindow: number;
    readonly evidenceOrder:
      | typeof CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2
      | readonly [];
    readonly missingEvidence: {
      readonly scoreAxes: 'fixed_midpoint_50' | 'pairwise_axis_omission';
      readonly popularityRank: 'no_usage_bonus' | 'not_used';
    };
    readonly rarityPolicy: 'never_hard_reject';
    readonly paretoFrontier?: {
      readonly poolLimit: number;
      readonly objectives: readonly [
        'legal',
        'sajuFit',
        'yongshinFit',
        'elementBalance',
        'hanjaMeaning',
        'phonetic',
        'eraFit',
        'familyFit',
        'riskQuality',
      ];
      readonly dominance: 'non_dominated_available_axes_v1';
      readonly frontierBonus: 3;
      readonly diversityWindow: 8;
      readonly diversityBasis: 'profile_hangul_hanja_syllable_v1';
      readonly overflowOrder: 'engine_score_desc_stable_input';
    };
    readonly candidateRecall: {
      readonly generation:
        | 'legal_hanja_generation'
        | 'official_name_stat_hangul_seed_plus_legal_hanja_generation';
      readonly hanjaVariantsPerHangul: number;
      readonly variantRetentionBasis: 'engine_raw_score_then_stable_input';
    };
  };
}

export interface CandidateSearchEvaluationV1 {
  /** Recommendations include both natal-saju and naming evidence. */
  readonly method: 'saju_guided_name_recommendation';
  readonly inputs: readonly ['birth_saju', 'naming'];
  /** A selected name changes interaction results, never the natal chart. */
  readonly natalSajuSemantics: 'birth_chart_invariant';
  readonly candidateSemantics: 'name_conditioned_interaction';
  /** Candidate order remains visible, but uncertain natal authority is explicit. */
  readonly natalEvidence: NatalEvidenceAssessmentV1;
}

export interface CandidateSearchPaginationV1 {
  readonly offset: number;
  readonly requestedLimit: number;
  readonly returnedCount: number;
  /** Present only when the local engine actually established continuation state. */
  readonly hasMore?: boolean;
  /** Present only when an authoritative total is available. */
  readonly totalAvailable?: number;
}

export interface CandidateSearchNameV1 {
  readonly fullHangul: string;
  readonly fullHanja: string;
  readonly givenHangul: string;
  readonly givenHanja: string;
  /** Display-only evidence copied from the exact Hanja entries evaluated by the engine. */
  readonly givenCharacters: readonly CandidateSearchNameCharacterV1[];
}

export type CandidateSearchNameElementV1 =
  | 'Wood'
  | 'Fire'
  | 'Earth'
  | 'Metal'
  | 'Water';

export interface CandidateSearchNameCharacterV1 {
  readonly hangul: string;
  /** Empty only for the lower-level Hangul-only compatibility builder. */
  readonly hanja: string;
  readonly meaning?: string;
  readonly strokes?: number;
  readonly element?: CandidateSearchNameElementV1;
  readonly elementLabel?: string;
  readonly legalStatus?: HanjaLegalStatus;
  readonly legalRegistrable?: boolean;
  readonly isVariantOf?: string;
}

/**
 * Minimal continuation payload to merge into a ReportDeliveryRequestV1.
 * Birth/options stay in the caller's snapshotted analysis context. The
 * resolved surname is carried because a Hangul-only input surname may have
 * been resolved to authoritative Hanja during candidate generation.
 */
export interface CandidateReportInputV1 {
  readonly candidateId: string;
  readonly surname: readonly NameCharInput[];
  readonly givenName: readonly NameCharInput[];
}

export interface CandidateSearchScoreV1 {
  readonly final: number;
  readonly vector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
}

export interface CandidateSearchPopularityV1 {
  readonly rank: number | null;
  readonly maleRatio: number | null;
  readonly tendency: NameGenderTendency;
}

export interface CandidateSearchItemV1 {
  readonly candidateId: string;
  /** Engine-issued 1-based rank within the complete query ordering. */
  readonly rank: number;
  readonly name: CandidateSearchNameV1;
  readonly score: CandidateSearchScoreV1;
  readonly popularity: CandidateSearchPopularityV1;
  /**
   * Structured presentation evidence. Only fields named by
   * `ordering.rankingBasis.evidenceOrder` affect presentation rank; meaning
   * confidence measures automatic-review coverage rather than semantic
   * superiority. The engine score remains separate in `score.final`.
   */
  readonly presentationEvidence?: CandidatePresentationEvidence;
  readonly reportInput: CandidateReportInputV1;
}

export interface CandidateSearchResponseV1 {
  readonly schemaVersion: typeof CANDIDATE_SEARCH_SCHEMA_V1;
  readonly query: CandidateSearchQueryV1;
  readonly ordering: CandidateSearchOrderingV1;
  readonly evaluation: CandidateSearchEvaluationV1;
  readonly pagination: CandidateSearchPaginationV1;
  readonly items: readonly CandidateSearchItemV1[];
}

export type CandidateSearchContractReasonV1 =
  | 'INVALID_PAGINATION'
  | 'PAGE_TOO_LARGE'
  | 'INVALID_RANK'
  | 'INVALID_SCORE'
  | 'INVALID_POPULARITY'
  | 'INVALID_NAME_PAYLOAD'
  | 'DUPLICATE_CANDIDATE'
  | 'UNSUPPORTED_QUERY_MODE'
  | 'UNSUPPORTED_RECOMMENDATION_NAME_LENGTH'
  | 'HANJA_REQUIRED_FOR_SAJU_GUIDED_RECOMMENDATION'
  | 'SAJU_ANALYSIS_UNAVAILABLE'
  | 'REMOTE_COMPUTATION_FORBIDDEN'
  | 'INVALID_ANALYSIS_OPTIONS'
  | 'INVALID_QUERY_ID'
  | 'QUERY_ID_REQUIRED'
  | 'QUERY_SNAPSHOT_EXPIRED'
  | 'QUERY_ID_MISMATCH'
  | 'QUERY_OFFSET_OUT_OF_RANGE';

export class CandidateSearchContractErrorV1 extends TypeError {
  readonly reason: CandidateSearchContractReasonV1;

  constructor(reason: CandidateSearchContractReasonV1, message: string) {
    super(message);
    this.name = 'CandidateSearchContractErrorV1';
    this.reason = reason;
  }
}
