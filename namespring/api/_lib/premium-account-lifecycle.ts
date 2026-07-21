import { FirestorePremiumRepositoryV1 } from "./premium-repository.js";
import type { PremiumAccountExportSectionV1 } from "./premium-repository-contract.js";
import { premiumOwnerForInternalUserIdV2 } from "./premium-owner.js";
import { ApiHttpError } from "./http.js";

function assertLifecycleTimestamp(now: string): void {
  if (!Number.isFinite(Date.parse(now)) || new Date(Date.parse(now)).toISOString() !== now) {
    throw new ApiHttpError(500, "PREMIUM_LIFECYCLE_TIME_INVALID", "Premium lifecycle time is invalid.");
  }
}

export async function exportPremiumAccountDataV1(
  internalUserId: string,
  now = new Date().toISOString(),
): Promise<PremiumAccountExportSectionV1> {
  assertLifecycleTimestamp(now);
  return new FirestorePremiumRepositoryV1().exportOwnerPortableData({
    owner: premiumOwnerForInternalUserIdV2(internalUserId),
    exportedAt: now,
  });
}

export async function purgePremiumAccountPersonalDataV1(
  internalUserId: string,
  deletionRequestId: string,
  now = new Date().toISOString(),
) {
  assertLifecycleTimestamp(now);
  if (!/^deletion_request_v1_[A-Za-z0-9_-]{16,128}$/u.test(deletionRequestId)) {
    throw new ApiHttpError(400, "PREMIUM_DELETION_REQUEST_INVALID", "Deletion request identity is invalid.");
  }
  return new FirestorePremiumRepositoryV1().purgeOwnerPersonalData({
    owner: premiumOwnerForInternalUserIdV2(internalUserId),
    deletionRequestId,
    now,
  });
}
