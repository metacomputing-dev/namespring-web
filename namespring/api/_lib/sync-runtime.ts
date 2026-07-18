import { getRequiredEnv } from "./env.js";
import { FirestoreMaintenanceStatusReaderV1 } from "./maintenance-coordinator.js";
import { AccountSyncServiceV1, SyncRetentionStatusServiceV1 } from "./sync-service.js";
import {
  FirestoreSyncRepositoryV1,
  FirestoreSyncRetentionStatusRepositoryV1,
} from "./sync-repository.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

export function createAccountSyncServiceAccessorV1(
  createService: (pepper: string) => AccountSyncServiceV1,
): () => AccountSyncServiceV1 {
  let cachedService: AccountSyncServiceV1 | null = null;
  let cachedPepper: string | null = null;
  return () => {
    const pepper = getRequiredEnv("SYNC_DELETION_HASH_PEPPER");
    // Re-evaluate the complete environment on every warm invocation. This
    // keeps a previously cached service from bypassing a newly introduced
    // cross-domain collision and recreates it if the deployment rotates the
    // pepper in place.
    assertServerSecretSeparationV1("sync_deletion", [pepper], "SYNC_DELETION_KEY_REUSE");
    if (!cachedService || cachedPepper !== pepper) {
      cachedService = createService(pepper);
      cachedPepper = pepper;
    }
    return cachedService;
  };
}

export const getAccountSyncService = createAccountSyncServiceAccessorV1(
  (pepper) => new AccountSyncServiceV1(new FirestoreSyncRepositoryV1(), pepper),
);

let retentionStatusService: SyncRetentionStatusServiceV1 | null = null;

export function getSyncRetentionStatusService(): SyncRetentionStatusServiceV1 {
  if (!retentionStatusService) {
    retentionStatusService = new SyncRetentionStatusServiceV1(
      new FirestoreSyncRetentionStatusRepositoryV1(),
      new FirestoreMaintenanceStatusReaderV1(),
    );
  }
  return retentionStatusService;
}
