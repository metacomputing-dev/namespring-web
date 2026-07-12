import type { Database, SqlJsStatic } from 'sql.js';

import type { DatabaseAssetManifestEntry } from './database-asset-contract.js';
import {
  verifyOpenedRepositoryDatabase,
  verifyRepositoryDatabaseBytesBeforeOpen,
} from './database-integrity.js';

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
): Promise<Database> {
  const verifiedSnapshot = bytes.slice();
  await verifyRepositoryDatabaseBytesBeforeOpen(verifiedSnapshot, contract);
  assertActive();

  let candidate: Database | null = null;
  try {
    candidate = new SQL.Database(verifiedSnapshot);
    await verifyOpenedRepositoryDatabase(candidate, contract);
    assertActive();
    return candidate;
  } catch (error) {
    if (candidate) {
      try {
        candidate.close();
      } catch {
        // Preserve the integrity or cancellation error that caused cleanup.
      }
    }
    throw error;
  }
}
