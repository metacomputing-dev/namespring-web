import {
  DATABASE_ASSET_MANIFEST_SCHEMA_VERSION,
  type DatabaseAssetManifestEntry,
  type NormalizedDatabaseColumn,
} from './database-asset-contract.js';
import { GENERATED_DATABASE_ASSET_MANIFEST } from './database-asset-manifest.generated.js';
import { RepositoryConfigurationError } from './repository-runtime.js';

function invalidContract(message: string): RepositoryConfigurationError {
  return new RepositoryConfigurationError(message);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidContract(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidContract(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw invalidContract(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function cloneColumn(value: unknown, index: number): NormalizedDatabaseColumn {
  const label = `Database contract column ${index}`;
  const column = requireRecord(value, label);
  const defaultValue = column.defaultValue;
  if (defaultValue !== null && typeof defaultValue !== 'string') {
    throw invalidContract(`${label}.defaultValue must be a string or null.`);
  }
  if (typeof column.notNull !== 'boolean') {
    throw invalidContract(`${label}.notNull must be a boolean.`);
  }
  return Object.freeze({
    cid: requireNonNegativeInteger(column.cid, `${label}.cid`),
    name: requireNonEmptyString(column.name, `${label}.name`),
    declaredType: requireNonEmptyString(column.declaredType, `${label}.declaredType`),
    notNull: column.notNull,
    defaultValue,
    primaryKeyPosition: requireNonNegativeInteger(
      column.primaryKeyPosition,
      `${label}.primaryKeyPosition`,
    ),
  });
}

/** Clone and deeply freeze a complete asset contract at the trust boundary. */
export function cloneAndFreezeDatabaseAssetContract(
  value: unknown,
): DatabaseAssetManifestEntry {
  const contract = requireRecord(value, 'Database integrity contract');
  if (!Array.isArray(contract.columns) || contract.columns.length === 0) {
    throw invalidContract('Database integrity contract.columns must be a non-empty array.');
  }
  const shardKey = contract.shardKey;
  if (shardKey !== null && typeof shardKey !== 'string') {
    throw invalidContract('Database integrity contract.shardKey must be a string or null.');
  }
  const columns = Object.freeze(contract.columns.map(cloneColumn));
  return Object.freeze({
    assetId: requireNonEmptyString(contract.assetId, 'Database integrity contract.assetId'),
    relativePath: requireNonEmptyString(
      contract.relativePath,
      'Database integrity contract.relativePath',
    ),
    byteLength: requireNonNegativeInteger(
      contract.byteLength,
      'Database integrity contract.byteLength',
    ),
    sha256: requireNonEmptyString(contract.sha256, 'Database integrity contract.sha256'),
    userVersion: requireNonNegativeInteger(
      contract.userVersion,
      'Database integrity contract.userVersion',
    ),
    schemaContractVersion: requireNonEmptyString(
      contract.schemaContractVersion,
      'Database integrity contract.schemaContractVersion',
    ),
    schemaContractSha256: requireNonEmptyString(
      contract.schemaContractSha256,
      'Database integrity contract.schemaContractSha256',
    ),
    table: requireNonEmptyString(contract.table, 'Database integrity contract.table'),
    columns,
    rowCount: requireNonNegativeInteger(
      contract.rowCount,
      'Database integrity contract.rowCount',
    ),
    shardKey,
  });
}

if (
  (GENERATED_DATABASE_ASSET_MANIFEST.schemaVersion as string)
  !== DATABASE_ASSET_MANIFEST_SCHEMA_VERSION
) {
  throw invalidContract('Generated database asset manifest schema version is unsupported.');
}

const ASSET_BY_ID = new Map<string, DatabaseAssetManifestEntry>();
for (const rawAsset of GENERATED_DATABASE_ASSET_MANIFEST.assets) {
  const asset = cloneAndFreezeDatabaseAssetContract(rawAsset);
  if (ASSET_BY_ID.has(asset.assetId)) {
    throw invalidContract(`Generated database asset manifest duplicates ${asset.assetId}.`);
  }
  ASSET_BY_ID.set(asset.assetId, asset);
}

function requireGeneratedAsset(assetId: string): DatabaseAssetManifestEntry {
  const asset = ASSET_BY_ID.get(assetId);
  if (!asset) {
    throw invalidContract(`Generated database asset manifest is missing ${assetId}.`);
  }
  return asset;
}

export const FOURFRAME_DATABASE_ASSET = requireGeneratedAsset('fourframe');
export const HANJA_DATABASE_ASSET = requireGeneratedAsset('hanja');
