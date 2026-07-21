import type { Database, SqlJsStatic } from 'sql.js';

import type { DatabaseAssetManifestEntry } from './database-asset-contract.js';
import {
  verifyOpenedRepositoryDatabase,
  verifyRepositoryDatabaseBytesBeforeOpen,
} from './database-integrity.js';
import { awaitActiveRepositoryStep } from './repository-lifecycle.js';

/**
 * Open exactly the immutable byte snapshot that passed integrity verification.
 * The returned database is owned by the caller; every failure after open is
 * closed here before the error escapes.
 */
export async function openVerifiedRepositoryDatabase(
  SQL: SqlJsStatic,
  bytes: Uint8Array,
  contract: DatabaseAssetManifestEntry,
  assertActive: () => void,
  signal?: AbortSignal,
): Promise<Database> {
  const verifiedSnapshot = bytes.slice();
  await awaitActiveRepositoryStep(
    () => verifyRepositoryDatabaseBytesBeforeOpen(verifiedSnapshot, contract),
    assertActive,
    signal,
  );

  let candidate: Database | null = null;
  let candidateClosed = false;
  let abortListenerAttached = false;
  const closeCandidate = (): void => {
    if (!candidate || candidateClosed) return;
    candidateClosed = true;
    try {
      candidate.close();
    } catch {
      // Preserve the integrity or cancellation error that owns this path.
    }
  };
  const onAbort = (): void => closeCandidate();
  try {
    candidate = new SQL.Database(verifiedSnapshot);
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
      abortListenerAttached = true;
      if (signal.aborted) closeCandidate();
    }
    await awaitActiveRepositoryStep(
      () => verifyOpenedRepositoryDatabase(candidate as Database, contract),
      assertActive,
      signal,
    );
    return candidate;
  } catch (error) {
    closeCandidate();
    throw error;
  } finally {
    if (signal && abortListenerAttached) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}
