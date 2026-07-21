import type {
  BirthInfo,
  NameCharInput,
  SpringOptions,
} from '../../types.js';
import type { PremiumRegistrationPrecisionConfigV1 } from '../analysis-options-types.js';

export const STORY_COMPLETION_PRODUCT_ID_V1 = 'report.story-completion.v1' as const;
export const SERVICE_CATALOG_SCHEMA_V1 = 'namespring.service-catalog.v1' as const;
export const PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1 =
  'namespring.premium-report-registration-request.v1' as const;
export const PREMIUM_REPORT_REFERENCE_SCHEMA_V1 =
  'namespring.premium-report-reference.v1' as const;
export const REPORT_ENTITLEMENT_SCHEMA_V1 = 'namespring.report-entitlement.v1' as const;
export const PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1 =
  'namespring.premium-report-access-request.v1' as const;
export const PREMIUM_REPORT_DELIVERY_SCHEMA_V1 =
  'namespring.premium-report-delivery.v1' as const;

export type PremiumProductIdV1 = typeof STORY_COMPLETION_PRODUCT_ID_V1;
export type PremiumContentVersionV1 = string;
export type ReportIdV1 = string;
export type EntitlementIdV1 = string;
export type PremiumDeliveryIdV1 = string;
export type PremiumRegistrationMaterialDigestV1 = `sha256:${string}`;

export type PremiumBirthInfoV1 = Omit<BirthInfo, 'name'>;

export type PremiumPrecisionConfigV1 = PremiumRegistrationPrecisionConfigV1;

export interface PremiumAnalysisOptionsV1 {
  readonly schoolPreset?: SpringOptions['schoolPreset'];
  readonly sajuTimePolicy?: SpringOptions['sajuTimePolicy'];
  readonly sajuOptions?: SpringOptions['sajuOptions'];
  readonly pureHangulNameMode?: SpringOptions['pureHangulNameMode'];
  readonly useSurnameHanjaInPureHangul?: SpringOptions['useSurnameHanjaInPureHangul'];
  readonly precisionConfig?: PremiumPrecisionConfigV1;
}

/**
 * The only free-to-server handoff. The server treats this as untrusted source
 * input, recomputes saju+naming+interaction, and then issues its own persistent
 * analysis/report identifiers. `localAnalysisId` is correlation only.
 */
export interface PremiumReportRegistrationRequestV1 {
  readonly schemaVersion: typeof PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1;
  readonly requestId: string;
  readonly productId: PremiumProductIdV1;
  readonly localAnalysisId: string;
  readonly candidateId: string;
  readonly analysisInput: {
    readonly birth: PremiumBirthInfoV1;
    readonly surname: readonly NameCharInput[];
    readonly givenName: readonly NameCharInput[];
    readonly targetDate: string;
    readonly options?: PremiumAnalysisOptionsV1;
  };
}

/**
 * Trusted observation from an atomic server-side idempotency record keyed by
 * `(owner.kind, owner.subjectId, requestId)`. It is never accepted from the
 * registration request body.
 */
export type PremiumRegistrationReplayObservationV1 =
  | { readonly state: 'first_seen' }
  | {
      readonly state: 'same_material_replay';
      readonly materialDigest: PremiumRegistrationMaterialDigestV1;
      readonly priorReport: PremiumReportReferenceV1;
    }
  | { readonly state: 'conflicting_material_replay' };

export interface PremiumRegistrationAuthorizationScopeV1 {
  readonly requestId: string;
  readonly owner: PremiumEntitlementOwnerV1;
  readonly productId: PremiumProductIdV1;
  readonly candidateId: string;
  /** SHA-256 of the complete canonical registration request. */
  readonly materialDigest: PremiumRegistrationMaterialDigestV1;
}

export type PremiumReportRegistrationDecisionV1 =
  | {
      readonly registration: 'allow';
      readonly reasonCode: 'REGISTRATION_ACCEPTED';
      readonly registrationMode: 'initial';
      readonly authorization: PremiumRegistrationAuthorizationScopeV1;
    }
  | {
      readonly registration: 'allow';
      readonly reasonCode: 'REGISTRATION_IDEMPOTENT_REPLAY';
      readonly registrationMode: 'idempotent_replay';
      readonly priorReport: PremiumReportReferenceV1;
      readonly authorization: PremiumRegistrationAuthorizationScopeV1;
    }
  | {
      readonly registration: 'deny';
      readonly reasonCode:
        | 'REGISTRATION_REPLAY_MISMATCH'
        | 'REGISTRATION_REFERENCE_MISMATCH'
        | 'REGISTRATION_REPORT_RETIRED';
    };

export interface EvaluatePremiumReportRegistrationV1Input {
  readonly request: PremiumReportRegistrationRequestV1;
  /** Authenticated by trusted server middleware, never copied from the body. */
  readonly principal: PremiumEntitlementOwnerV1;
  readonly replay: PremiumRegistrationReplayObservationV1;
}

/** Trusted server identity that owns an entitlement; never a browser claim. */
export interface PremiumEntitlementOwnerV1 {
  readonly kind: 'account' | 'anonymous_session';
  readonly subjectId: string;
}

export interface ServerCatalogPriceV1 {
  /** Integer KRW amount. The authoritative value comes from the server catalog. */
  readonly amount: number;
  readonly currency: 'KRW';
  readonly authority: 'server_catalog';
  readonly taxIncluded: boolean;
}

export interface ServiceCatalogProductV1 {
  readonly productId: PremiumProductIdV1;
  readonly contentVersion: PremiumContentVersionV1;
  readonly displayName: string;
  readonly availability: 'active' | 'unavailable' | 'retired';
  readonly price: ServerCatalogPriceV1;
}

export interface ServiceCatalogV1 {
  readonly schemaVersion: typeof SERVICE_CATALOG_SCHEMA_V1;
  readonly catalogVersion: string;
  readonly generatedAt: string;
  readonly products: readonly ServiceCatalogProductV1[];
}

/**
 * Immutable scope of one paid report resource.
 *
 * `reportId` is issued by the server only after it has verified the referenced
 * free analysis/name snapshot. None of these identifiers is an authorization
 * credential by itself.
 */
export interface PremiumReportBindingV1 {
  readonly reportId: ReportIdV1;
  readonly analysisId: string;
  readonly candidateId: string;
  readonly productId: PremiumProductIdV1;
  readonly contentVersion: PremiumContentVersionV1;
}

export interface PremiumReportReferenceV1 {
  readonly schemaVersion: typeof PREMIUM_REPORT_REFERENCE_SCHEMA_V1;
  readonly authority: 'server';
  /** Immutable provenance of the owner-scoped registration that created it. */
  readonly registration: PremiumRegistrationAuthorizationScopeV1;
  readonly binding: PremiumReportBindingV1;
  readonly status: 'registered' | 'retired';
  readonly registeredAt: string;
  readonly updatedAt: string;
}

export type ReportEntitlementStatusV1 =
  | 'pending_payment'
  | 'active'
  | 'revoked'
  | 'refunded'
  | 'expired';

export type ReportEntitlementGrantSourceV1 =
  | 'verified_payment'
  | 'promotion'
  | 'admin_grant';

export interface ReportEntitlementV1 {
  readonly schemaVersion: typeof REPORT_ENTITLEMENT_SCHEMA_V1;
  /** Server-issued. Never derived from a browser storage flag. */
  readonly entitlementId: EntitlementIdV1;
  readonly authority: 'server';
  readonly owner: PremiumEntitlementOwnerV1;
  readonly binding: PremiumReportBindingV1;
  readonly status: ReportEntitlementStatusV1;
  readonly grantSource: ReportEntitlementGrantSourceV1;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly expiresAt?: string;
}

/**
 * Access request checked against server-side report and entitlement records.
 * There is intentionally no `isUnlocked`, `paid`, or premium body field.
 */
export interface PremiumReportAccessRequestV1 {
  readonly schemaVersion: typeof PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1;
  /** Idempotency/replay key. It grants no authority. */
  readonly requestId: string;
  readonly entitlementId: EntitlementIdV1;
  readonly binding: PremiumReportBindingV1;
}

/** Observed by trusted server storage, never accepted as a client assertion. */
export type PremiumReplayObservationV1 =
  | { readonly state: 'first_seen' }
  | {
      readonly state: 'same_binding_replay';
      readonly priorDeliveryId: PremiumDeliveryIdV1;
    }
  | {
      readonly state: 'conflicting_binding_replay';
      readonly priorDeliveryId?: PremiumDeliveryIdV1;
    };

export type PremiumAccessReasonCodeV1 =
  | 'ACCESS_GRANTED'
  | 'IDEMPOTENT_REPLAY'
  | 'REPORT_NOT_FOUND'
  | 'REPORT_RETIRED'
  | 'REPORT_OWNER_MISMATCH'
  | 'ENTITLEMENT_NOT_FOUND'
  | 'ENTITLEMENT_ID_MISMATCH'
  | 'ENTITLEMENT_OWNER_MISMATCH'
  | 'REPORT_ID_MISMATCH'
  | 'ANALYSIS_ID_MISMATCH'
  | 'CANDIDATE_ID_MISMATCH'
  | 'PRODUCT_ID_MISMATCH'
  | 'CONTENT_VERSION_MISMATCH'
  | 'ENTITLEMENT_PENDING_PAYMENT'
  | 'ENTITLEMENT_REVOKED'
  | 'ENTITLEMENT_REFUNDED'
  | 'ENTITLEMENT_EXPIRED'
  | 'ENTITLEMENT_NOT_ACTIVE'
  | 'REPLAY_BINDING_MISMATCH';

export type PremiumReportAccessDecisionV1 =
  | {
      readonly access: 'allow';
      readonly reasonCode: 'ACCESS_GRANTED' | 'IDEMPOTENT_REPLAY';
      readonly deliveryMode: 'initial' | 'idempotent_replay';
      readonly priorDeliveryId?: PremiumDeliveryIdV1;
      /** Exact trusted scope evaluated by the server. Delivery validation
       * rejects decisions accidentally mixed across accounts or reports. */
      readonly authorization: PremiumAccessAuthorizationScopeV1;
    }
  | {
      readonly access: 'deny';
      readonly reasonCode: Exclude<
        PremiumAccessReasonCodeV1,
        'ACCESS_GRANTED' | 'IDEMPOTENT_REPLAY'
      >;
    };

export interface PremiumAccessAuthorizationScopeV1 {
  readonly requestId: string;
  readonly entitlementId: EntitlementIdV1;
  readonly owner: PremiumEntitlementOwnerV1;
  readonly binding: PremiumReportBindingV1;
}

export interface PremiumReportContentSectionV1 {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Stable fact/interpretation IDs from the server-recomputed analysis. */
  readonly evidenceRefs: readonly string[];
}

export interface PremiumReportContentV1 {
  readonly kind: 'story_completion';
  readonly format: 'structured_plain_text_v1';
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly PremiumReportContentSectionV1[];
}

/**
 * Paid content is delivered only in this separate server response. It must
 * never be embedded in the free SpringEngine ReportDeliveryV1 DTO.
 */
export interface PremiumReportDeliveryV1 {
  readonly schemaVersion: typeof PREMIUM_REPORT_DELIVERY_SCHEMA_V1;
  readonly deliveryId: PremiumDeliveryIdV1;
  readonly binding: PremiumReportBindingV1;
  readonly entitlement: {
    readonly entitlementId: EntitlementIdV1;
    readonly status: 'active';
  };
  readonly deliveryMode: 'initial' | 'idempotent_replay';
  readonly deliveredAt: string;
  readonly premiumContent: PremiumReportContentV1;
}

/** Trusted server-side evidence and entitlement scope for delivery validation. */
export interface PremiumReportDeliveryValidationContextV1 {
  readonly entitlement: ReportEntitlementV1;
  /** Fact/interpretation IDs produced by the server's registered recomputation. */
  readonly allowedEvidenceRefs: readonly string[];
  /** Trusted result of evaluatePremiumReportAccessV1 for this exact request. */
  readonly accessDecision: Extract<PremiumReportAccessDecisionV1, { readonly access: 'allow' }>;
}

export interface EvaluatePremiumReportAccessV1Input {
  readonly request: PremiumReportAccessRequestV1;
  readonly report: PremiumReportReferenceV1 | null;
  readonly entitlement: ReportEntitlementV1 | null;
  /** Authenticated by trusted server middleware, not copied from the request body. */
  readonly principal: PremiumEntitlementOwnerV1;
  readonly replay: PremiumReplayObservationV1;
  /** Trusted server clock serialized as ISO-8601. */
  readonly now: string;
}

export type PremiumContractInvalidReasonV1 =
  | 'INVALID_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'INVALID_SCHEMA_VERSION'
  | 'INVALID_ID'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_CATALOG'
  | 'INVALID_REGISTRATION_REQUEST'
  | 'PARTIAL_HANJA_IDENTITY'
  | 'PURE_HANGUL_MODE_CONFLICT'
  | 'PURE_HANGUL_MODE_DISABLED'
  | 'INVALID_BINDING'
  | 'INVALID_ENTITLEMENT'
  | 'INVALID_ACCESS_REQUEST'
  | 'INVALID_DELIVERY'
  | 'DUPLICATE_VALUE'
  | 'PAYLOAD_BUDGET_EXCEEDED'
  | 'FREE_DELIVERY_PREMIUM_LEAK';

export class PremiumContractValidationErrorV1 extends TypeError {
  readonly code = 'PREMIUM_CONTRACT_INVALID' as const;

  constructor(readonly reason: PremiumContractInvalidReasonV1, detail: string) {
    super(`Invalid premium report contract: ${reason} (${detail}).`);
    this.name = 'PremiumContractValidationErrorV1';
  }
}
