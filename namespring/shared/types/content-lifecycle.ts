export const CONTENT_ARTIFACT_SCHEMA_V1 = "namespring.content-artifact.v1" as const;
export const CONTENT_AUDIT_EVENT_SCHEMA_V1 = "namespring.content-audit-event.v1" as const;
export const LOCAL_CONTENT_EXPORT_SCHEMA_V1 = "namespring.local-content-export-manifest.v1" as const;
export const LOCAL_CONTENT_EXPORT_SESSION_SCHEMA_V1 = "namespring.local-content-export-session.v1" as const;
export const LOCAL_CONTENT_EXPORT_PAGE_SCHEMA_V1 = "namespring.local-content-export-page.v1" as const;
export const LOCAL_CONTENT_EXPORT_COMPLETION_SCHEMA_V1 = "namespring.local-content-export-completion.v1" as const;
/** Snapshot metadata chunk size. Response byte limits may split a chunk further. */
export const LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1 = 100 as const;
/** Reviewed architecture ceiling for one local-content export snapshot. */
export const LOCAL_CONTENT_EXPORT_HARD_MAX_ARTIFACTS_V1 = 25_000 as const;
/** Cursor chunk indexes are zero-based and must remain below this bound. */
export const LOCAL_CONTENT_EXPORT_MAX_CHUNKS_V1 = Math.ceil(
  LOCAL_CONTENT_EXPORT_HARD_MAX_ARTIFACTS_V1 / LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1,
);

export const CONTENT_LIFECYCLES_V1 = ["draft", "reviewed", "approved", "active", "retired"] as const;
export type ContentLifecycleV1 = (typeof CONTENT_LIFECYCLES_V1)[number];

export type Sha256DigestV1 = `sha256:${string}`;
/** Versioned, key-addressable pseudonym: hmac-sha256:v1:<keyId>:<64 lowercase hex>. */
export type ContentActorSubjectV1 = `hmac-sha256:v1:${string}:${string}`;
export type ContentAudienceV1 = "free_local" | "paid_server" | "shared";
export type ContentKindV1 =
  | "fortune_bundle"
  | "name_energy"
  | "report_copy"
  | "article"
  | "glossary"
  | "other";

export interface ContentTextSectionV1 {
  readonly id: string;
  readonly title?: string;
  readonly body: string;
  readonly expert?: string;
}

export interface FortuneBundlePayloadV1 {
  readonly schemaVersion: "namespring.fortune-bundle.v1";
  readonly summary: string;
  readonly hook: string;
  readonly sections: readonly ContentTextSectionV1[];
  readonly tips: readonly string[];
  readonly cautions: readonly string[];
  readonly expert?: string;
}

export interface NameEnergyPayloadV1 {
  readonly schemaVersion: "namespring.name-energy.v1";
  readonly summary: string;
  readonly sections: readonly ContentTextSectionV1[];
  readonly keywords?: readonly string[];
}

export interface ReportCopyPayloadV1 {
  readonly schemaVersion: "namespring.report-copy.v1";
  readonly title: string;
  readonly summary?: string;
  readonly sections: readonly ContentTextSectionV1[];
}

export interface ArticlePayloadV1 {
  readonly schemaVersion: "namespring.article.v1";
  readonly title: string;
  readonly dek?: string;
  readonly paragraphs: readonly string[];
  readonly tags?: readonly string[];
}

export interface GlossaryEntryV1 {
  readonly id: string;
  readonly label: string;
  readonly definition: string;
}

export interface GlossaryPayloadV1 {
  readonly schemaVersion: "namespring.glossary.v1";
  readonly entries: readonly GlossaryEntryV1[];
}

/** `other` may be staged for migration analysis, but is never runtime-deliverable. */
export interface OtherDraftPayloadV1 {
  readonly schemaVersion: "namespring.other-draft.v1";
  readonly data: Readonly<Record<string, unknown>>;
}

export type ContentPayloadV1 =
  | FortuneBundlePayloadV1
  | NameEnergyPayloadV1
  | ReportCopyPayloadV1
  | ArticlePayloadV1
  | GlossaryPayloadV1
  | OtherDraftPayloadV1;

export interface ContentChannelV1 {
  readonly contentKey: string;
  readonly kind: ContentKindV1;
  readonly audience: ContentAudienceV1;
  readonly locale: "ko-KR";
}

export interface ContentSourceProvenanceV1 {
  /** Bulk JSON is staging material only. Its presence never grants activation. */
  readonly sourceKind: "bulk_json_staging" | "generated" | "manual" | "migration";
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceDigest: Sha256DigestV1;
  readonly importedAt: string;
}

export interface ContentGenerationProvenanceV1 {
  readonly provider: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly generatedAt: string;
}

export interface ContentPromptProvenanceV1 {
  readonly promptId: string;
  readonly promptVersion: string;
  readonly promptDigest: Sha256DigestV1;
}

export interface ContentGateProvenanceV1 {
  readonly gateVersion: string;
  readonly decision: "passed" | "failed";
  readonly checkedAt: string;
  readonly resultDigest: Sha256DigestV1;
  /** HMAC attestation emitted by trusted CI; required for every passed gate. */
  readonly attestation?: {
    readonly attestationId: string;
    readonly runner: "trusted_ci";
    readonly keyId: string;
    readonly subjectContentDigest: Sha256DigestV1;
    readonly policyDigest: Sha256DigestV1;
    readonly signature: `hmac-sha256:${string}`;
  };
}

export interface ContentProvenanceV1 {
  readonly source: ContentSourceProvenanceV1;
  readonly generation?: ContentGenerationProvenanceV1;
  readonly prompt?: ContentPromptProvenanceV1;
  readonly gate: ContentGateProvenanceV1;
}

export interface ContentHumanReviewV1 {
  /** Stable content-domain pseudonym, not the raw internal user ID. */
  readonly reviewerId: ContentActorSubjectV1;
  readonly reviewedAt: string;
  readonly decision: "accepted";
  readonly notesDigest: Sha256DigestV1;
}

export interface ContentApprovalV1 {
  /** Stable content-domain pseudonym, not the raw internal user ID. */
  readonly approverId: ContentActorSubjectV1;
  readonly approvedAt: string;
  readonly decision: "approved";
  readonly reviewArtifactRevision: number;
}

export interface ContentActivationReceiptV1 {
  readonly activationId: string;
  readonly activatedAt: string;
  readonly activatedBy: ContentActorSubjectV1;
  readonly reason: string;
  readonly immutableContentDigest: Sha256DigestV1;
  readonly mode: "initial" | "replacement" | "rollback";
}

export interface ContentRetirementReceiptV1 {
  readonly retiredAt: string;
  readonly retiredBy: ContentActorSubjectV1;
  readonly reason: string;
  readonly replacedByArtifactId?: string;
}

export interface ContentArtifactV1 {
  readonly schemaVersion: typeof CONTENT_ARTIFACT_SCHEMA_V1;
  readonly artifactId: string;
  readonly channel: ContentChannelV1;
  readonly version: string;
  readonly lifecycle: ContentLifecycleV1;
  readonly revision: number;
  readonly contentDigest: Sha256DigestV1;
  readonly payload: ContentPayloadV1;
  readonly provenance: ContentProvenanceV1;
  readonly registeredAt: string;
  readonly registeredBy: ContentActorSubjectV1;
  readonly supersedesArtifactId?: string;
  readonly review?: ContentHumanReviewV1;
  readonly approval?: ContentApprovalV1;
  /** Append-only receipts keep every activation immutable, including rollbacks. */
  readonly activations: readonly ContentActivationReceiptV1[];
  readonly retirement?: ContentRetirementReceiptV1;
}

export interface ActiveContentPointerV1 {
  readonly channelKey: string;
  readonly artifactId: string;
  readonly activationId: string;
  readonly contentDigest: Sha256DigestV1;
  readonly activatedAt: string;
  readonly revision: number;
}

export type ContentAuditActionV1 =
  | "artifact.registered"
  | "artifact.reviewed"
  | "artifact.approved"
  | "artifact.activated"
  | "artifact.retired"
  | "artifact.rollback_activated"
  | "local_export.manifest_created"
  | "local_export.finalized";

export interface ContentAuditEventV1 {
  readonly schemaVersion: typeof CONTENT_AUDIT_EVENT_SCHEMA_V1;
  readonly auditId: string;
  readonly requestId: string;
  readonly action: ContentAuditActionV1;
  readonly occurredAt: string;
  /** Domain-separated pseudonyms; raw account/session identifiers are never persisted in this audit collection. */
  readonly actorSubject: ContentActorSubjectV1;
  readonly sessionSubject: ContentActorSubjectV1;
  /** Firestore adapters persist this ISO value as a root Timestamp for TTL deletion. */
  readonly deleteAfter: string;
  readonly artifactId: string;
  readonly channelKey: string;
  readonly fromLifecycle?: ContentLifecycleV1;
  readonly toLifecycle?: ContentLifecycleV1;
  readonly reason?: string;
  readonly contentDigest: Sha256DigestV1;
}

export interface RegisterContentArtifactRequestV1 {
  readonly requestId: string;
  readonly artifactId: string;
  readonly channel: ContentChannelV1;
  readonly version: string;
  readonly payload: ContentPayloadV1;
  readonly contentDigest: Sha256DigestV1;
  readonly provenance: ContentProvenanceV1;
  readonly supersedesArtifactId?: string;
}

export interface ReviewContentArtifactRequestV1 {
  readonly requestId: string;
  readonly artifactId: string;
  readonly expectedRevision: number;
  readonly notesDigest: Sha256DigestV1;
}

export interface ApproveContentArtifactRequestV1 {
  readonly requestId: string;
  readonly artifactId: string;
  readonly expectedRevision: number;
}

export interface ActivateContentArtifactRequestV1 {
  readonly requestId: string;
  readonly artifactId: string;
  readonly expectedRevision: number;
  readonly reason: string;
}

export interface RetireContentArtifactRequestV1 {
  readonly requestId: string;
  readonly artifactId: string;
  readonly expectedRevision: number;
  readonly reason: string;
}

export interface RollbackContentArtifactRequestV1 {
  readonly requestId: string;
  readonly artifactId: string;
  readonly expectedRevision: number;
  readonly reason: string;
}

export interface LocalContentExportEntryV1 {
  readonly artifactId: string;
  readonly contentKey: string;
  readonly kind: ContentKindV1;
  readonly audience: "free_local" | "shared";
  readonly locale: "ko-KR";
  readonly version: string;
  readonly contentDigest: Sha256DigestV1;
  readonly activationId: string;
}

/**
 * This manifest is consumed only by the build pipeline. The free runtime loads
 * the packaged SQLite/lazy asset and has no content-server endpoint dependency.
 */
export interface LocalContentExportManifestV1 {
  readonly schemaVersion: typeof LOCAL_CONTENT_EXPORT_SCHEMA_V1;
  readonly exportId: string;
  readonly exportedAt: string;
  readonly runtimeBoundary: "build_time_local_asset_only";
  readonly entries: readonly LocalContentExportEntryV1[];
  /** Stable for the same sorted active artifact set, independent of export time. */
  readonly assetSetDigest: Sha256DigestV1;
  readonly manifestDigest: Sha256DigestV1;
}

export interface ContentMutationResponseV1 {
  readonly artifact: {
    readonly artifactId: string;
    readonly channelKey: string;
    readonly version: string;
    readonly lifecycle: ContentLifecycleV1;
    readonly revision: number;
    readonly contentDigest: Sha256DigestV1;
  };
  readonly operation: "initial" | "idempotent_replay";
}

export interface GetContentArtifactRequestV1 {
  readonly artifactId: string;
}

export interface ListContentArtifactsRequestV1 {
  readonly lifecycle: ContentLifecycleV1;
  readonly afterArtifactId?: string;
  readonly limit?: number;
}

export interface ListContentArtifactsResponseV1 {
  readonly artifacts: readonly ContentArtifactV1[];
  readonly nextCursor: string | null;
}

export interface LocalContentExportArtifactV1 {
  readonly entry: LocalContentExportEntryV1;
  readonly payload: ContentPayloadV1;
}

export interface LocalContentExportSessionV1 {
  readonly schemaVersion: typeof LOCAL_CONTENT_EXPORT_SESSION_SCHEMA_V1;
  readonly exportId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly catalogRevision: number;
  readonly artifactCount: number;
  readonly chunkCount: number;
  /** Metadata snapshot chunk size; response bytes remain independently capped. */
  readonly maxPageItems: typeof LOCAL_CONTENT_EXPORT_CHUNK_ITEMS_V1;
  readonly maxPageBytes: 1500000;
  readonly assetSetDigest: Sha256DigestV1;
  readonly runtimeBoundary: "authenticated_build_pipeline_only";
}

export interface LocalContentExportCursorV1 {
  readonly chunkIndex: number;
  readonly offset: number;
}

export interface LocalContentExportPageRequestV1 {
  readonly exportId: string;
  readonly cursor?: LocalContentExportCursorV1;
}

export interface LocalContentExportPageV1 {
  readonly schemaVersion: typeof LOCAL_CONTENT_EXPORT_PAGE_SCHEMA_V1;
  readonly exportId: string;
  readonly catalogRevision: number;
  readonly assetSetDigest: Sha256DigestV1;
  readonly artifacts: readonly LocalContentExportArtifactV1[];
  readonly nextCursor: LocalContentExportCursorV1 | null;
  readonly pageBytes: number;
  readonly pageDigest: Sha256DigestV1;
}

export interface FinalizeLocalContentExportRequestV1 {
  readonly exportId: string;
  readonly observedArtifactCount: number;
  readonly observedAssetSetDigest: Sha256DigestV1;
}

export interface LocalContentExportCompletionV1 {
  readonly schemaVersion: typeof LOCAL_CONTENT_EXPORT_COMPLETION_SCHEMA_V1;
  readonly exportId: string;
  readonly catalogRevision: number;
  readonly artifactCount: number;
  readonly assetSetDigest: Sha256DigestV1;
  readonly finalizedAt: string;
  readonly receiptDigest: Sha256DigestV1;
  readonly publishGate: "recheck_immediately_before_asset_publication";
}
