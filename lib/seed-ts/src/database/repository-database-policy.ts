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

export interface CanonicalRepositoryDatabaseShardSetIntegrityPolicy {
  readonly mode: 'canonical';
}

export interface PinnedRepositoryDatabaseShardSetIntegrityPolicy {
  readonly mode: 'pinned';
  readonly contracts: readonly DatabaseAssetManifestEntry[];
}

export type RepositoryDatabaseShardSetIntegrityPolicy =
  | CanonicalRepositoryDatabaseShardSetIntegrityPolicy
  | PinnedRepositoryDatabaseShardSetIntegrityPolicy;

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

function invalidShardSet(message: string): RepositoryConfigurationError {
  return new RepositoryConfigurationError(`Pinned database shard set ${message}.`);
}

function assertCanonicalShardSet(
  canonical: readonly DatabaseAssetManifestEntry[],
): void {
  if (canonical.length === 0) {
    throw invalidShardSet('requires at least one canonical contract');
  }
  const assetIds = new Set<string>();
  const shardKeys = new Set<string>();
  for (const contract of canonical) {
    if (assetIds.has(contract.assetId)) {
      throw invalidShardSet(`duplicates canonical assetId ${contract.assetId}`);
    }
    assetIds.add(contract.assetId);
    if (contract.shardKey === null) {
      throw invalidShardSet(`canonical asset ${contract.assetId} has no shardKey`);
    }
    if (shardKeys.has(contract.shardKey)) {
      throw invalidShardSet(`duplicates canonical shardKey ${contract.shardKey}`);
    }
    shardKeys.add(contract.shardKey);
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

/**
 * Resolve a complete pinned shard set without filling missing entries from the
 * canonical set. Returned contracts are cloned, deeply frozen, and ordered
 * exactly like the canonical set.
 */
export function resolveRepositoryDatabaseShardSet(
  policy: RepositoryDatabaseShardSetIntegrityPolicy | undefined,
  canonical: readonly DatabaseAssetManifestEntry[],
): readonly DatabaseAssetManifestEntry[] {
  assertCanonicalShardSet(canonical);
  if (policy === undefined) return canonical;
  if (typeof policy !== 'object' || policy === null) {
    throw invalidShardSet(
      'must use mode "canonical" or mode "pinned" with complete contracts',
    );
  }
  if (policy.mode === 'canonical') return canonical;
  if (policy.mode !== 'pinned' || !('contracts' in policy)
    || !Array.isArray(policy.contracts)) {
    throw invalidShardSet(
      'must use mode "canonical" or mode "pinned" with complete contracts',
    );
  }

  const canonicalByShardKey = new Map(canonical.map((contract) => [
    contract.shardKey as string,
    contract,
  ]));
  const pinnedByShardKey = new Map<string, DatabaseAssetManifestEntry>();
  const pinnedAssetIds = new Set<string>();
  for (const value of policy.contracts) {
    const pinned = cloneAndFreezeDatabaseAssetContract(value);
    if (pinnedAssetIds.has(pinned.assetId)) {
      throw invalidShardSet(`duplicates assetId ${pinned.assetId}`);
    }
    pinnedAssetIds.add(pinned.assetId);
    if (pinned.shardKey === null) {
      throw invalidShardSet(`asset ${pinned.assetId} has no shardKey`);
    }
    const expected = canonicalByShardKey.get(pinned.shardKey);
    if (!expected) {
      throw invalidShardSet(`contains unknown shardKey ${pinned.shardKey}`);
    }
    if (pinnedByShardKey.has(pinned.shardKey)) {
      throw invalidShardSet(`duplicates shardKey ${pinned.shardKey}`);
    }
    assertPinnedFamily(pinned, expected);
    pinnedByShardKey.set(pinned.shardKey, pinned);
  }

  const missing = canonical
    .filter((contract) => !pinnedByShardKey.has(contract.shardKey as string))
    .map((contract) => contract.shardKey);
  if (missing.length > 0) {
    throw invalidShardSet(`is missing shardKey ${missing.join(', ')}`);
  }
  if (pinnedByShardKey.size !== canonical.length) {
    throw invalidShardSet(`expected ${canonical.length} contracts`);
  }
  return Object.freeze(canonical.map((contract) => {
    const pinned = pinnedByShardKey.get(contract.shardKey as string);
    if (!pinned) throw invalidShardSet(`is missing shardKey ${String(contract.shardKey)}`);
    return pinned;
  }));
}
