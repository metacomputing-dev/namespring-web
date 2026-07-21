import type {
  ContentChannelV1,
  ContentMutationResponseV1,
  ContentPayloadV1,
  ContentProvenanceV1,
  Sha256DigestV1,
} from "./content-lifecycle.js";

export interface StagingContentArtifactInputV1 {
  readonly artifactId: string;
  readonly channel: ContentChannelV1;
  readonly version: string;
  readonly payload: ContentPayloadV1;
  readonly contentDigest: Sha256DigestV1;
  readonly provenance: ContentProvenanceV1;
  readonly supersedesArtifactId?: string;
}

export interface StageContentBatchRequestV1 {
  readonly requestId: string;
  readonly mode: "validate_only" | "register_drafts";
  readonly artifacts: readonly StagingContentArtifactInputV1[];
}

export interface StageContentBatchResponseV1 {
  readonly mode: StageContentBatchRequestV1["mode"];
  readonly validatedCount: number;
  readonly registered: readonly ContentMutationResponseV1[];
  readonly invariant: "staging_never_auto_activates";
}
