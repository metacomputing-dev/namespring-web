import type {
  StageContentBatchRequestV1,
  StagingContentArtifactInputV1,
} from "../../shared/types/content-staging.js";
import { ApiHttpError } from "./http.js";
import { parseRegisterContentArtifactRequest, requireContentIdentifier } from "./content-validation.js";

const MAX_STAGING_BATCH = 50;
export const CONTENT_STAGING_BODY_MAX_BYTES = 1024 * 1024;

export function parseStageContentBatchRequest(value: unknown): StageContentBatchRequestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiHttpError(400, "INVALID_STAGING_BATCH", "Staging request must be an object.");
  }
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object);
  if (keys.some((key) => !["requestId", "mode", "artifacts"].includes(key))) {
    throw new ApiHttpError(400, "INVALID_STAGING_BATCH", "Staging request contains unsupported fields.");
  }
  const requestId = requireContentIdentifier(object.requestId, "requestId");
  if (object.mode !== "validate_only" && object.mode !== "register_drafts") {
    throw new ApiHttpError(400, "INVALID_STAGING_BATCH", "mode must be validate_only or register_drafts.");
  }
  if (!Array.isArray(object.artifacts) || object.artifacts.length < 1 || object.artifacts.length > MAX_STAGING_BATCH) {
    throw new ApiHttpError(400, "INVALID_STAGING_BATCH", `artifacts must contain 1-${MAX_STAGING_BATCH} items.`);
  }
  const artifacts = object.artifacts.map((artifact, index) => {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
      throw new ApiHttpError(400, "INVALID_STAGING_BATCH", `artifacts[${index}] must be an object.`);
    }
    const parsed = parseRegisterContentArtifactRequest({
      ...(artifact as Record<string, unknown>),
      requestId: `${requestId}:${index}`,
    });
    if (parsed.provenance.source.sourceKind !== "bulk_json_staging") {
      throw new ApiHttpError(
        400,
        "STAGING_SOURCE_REQUIRED",
        `artifacts[${index}] must declare sourceKind=bulk_json_staging.`,
      );
    }
    const { requestId: _itemRequestId, ...input } = parsed;
    return input satisfies StagingContentArtifactInputV1;
  });
  const ids = artifacts.map((artifact) => artifact.artifactId);
  if (new Set(ids).size !== ids.length) {
    throw new ApiHttpError(400, "DUPLICATE_STAGING_ARTIFACT", "artifactId must be unique within a staging batch.");
  }
  return { requestId, mode: object.mode, artifacts };
}
