import type { DatabaseAssetManifestEntry } from './database-asset-contract.js';
import { cloneAndFreezeDatabaseAssetContract } from './database-asset-registry.js';
import { RepositoryConfigurationError } from './repository-runtime.js';

export interface CanonicalRepositoryDatabaseIntegrityPolicy {
  readonly mode: 'canonical';
}

export interface PinnedRepositoryDatabaseIntegrityPolicy {
  readonly mode: 'pinned';
  readonly contract: DatabaseAssetManifestEntry;
}

export type RepositoryDatabaseIntegrityPolicy =
  | CanonicalRepositoryDatabaseIntegrityPolicy
  | PinnedRepositoryDatabaseIntegrityPolicy;

function familyMismatch(
  canonical: DatabaseAssetManifestEntry,
  field: string,
): RepositoryConfigurationError {
  return new RepositoryConfigurationError(
    `Pinned database contract ${field} does not match the ${canonical.assetId} repository family.`,
  );
}

function assertPinnedFamily(
  pinned: DatabaseAssetManifestEntry,
  canonical: DatabaseAssetManifestEntry,
): void {
  const scalarFields = [
    'userVersion',
    'table',
    'schemaContractVersion',
    'schemaContractSha256',
    'shardKey',
  ] as const;
  for (const field of scalarFields) {
    if (pinned[field] !== canonical[field]) {
      throw familyMismatch(canonical, field);
    }
  }
  if (JSON.stringify(pinned.columns) !== JSON.stringify(canonical.columns)) {
    throw familyMismatch(canonical, 'columns');
  }
}

export function resolveRepositoryDatabaseContract(
  policy: RepositoryDatabaseIntegrityPolicy | undefined,
  canonical: DatabaseAssetManifestEntry,
): DatabaseAssetManifestEntry {
  if (policy === undefined) return canonical;
  if (typeof policy !== 'object' || policy === null) {
    throw new RepositoryConfigurationError(
      'databaseIntegrity must use mode "canonical" or mode "pinned" with a complete contract.',
    );
  }
  if (policy.mode === 'canonical') return canonical;
  if (policy.mode !== 'pinned' || !('contract' in policy)) {
    throw new RepositoryConfigurationError(
      'databaseIntegrity must use mode "canonical" or mode "pinned" with a complete contract.',
    );
  }
  const pinned = cloneAndFreezeDatabaseAssetContract(policy.contract);
  assertPinnedFamily(pinned, canonical);
  return pinned;
}
