import type { Database } from 'sql.js';

import type {
  DatabaseAssetManifestEntry,
  NormalizedDatabaseColumn,
} from './database-asset-contract.js';
import {
  normalizeSha256Digest,
  verifySha256Digest,
} from './repository-artifact-integrity.js';

export const REPOSITORY_DATABASE_INTEGRITY_MISMATCH =
  'REPOSITORY_DATABASE_INTEGRITY_MISMATCH' as const;

export type RepositoryDatabaseIntegrityReason =
  | 'contract_invalid'
  | 'crypto_unavailable'
  | 'byte_length_mismatch'
  | 'sha256_mismatch'
  | 'user_version_mismatch'
  | 'table_missing'
  | 'schema_mismatch'
  | 'row_count_mismatch';

export type RepositoryDatabaseIntegrityValue = string | number | null;

export class RepositoryDatabaseIntegrityError extends Error {
  public readonly code = REPOSITORY_DATABASE_INTEGRITY_MISMATCH;
  public readonly retryable = false;

  public constructor(
    public readonly assetId: string,
    public readonly reason: RepositoryDatabaseIntegrityReason,
    public readonly expected: RepositoryDatabaseIntegrityValue,
    public readonly actual: RepositoryDatabaseIntegrityValue,
  ) {
    super(`Database asset ${assetId} failed integrity verification: ${reason}.`);
    this.name = 'RepositoryDatabaseIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function integrityError(
  contract: DatabaseAssetManifestEntry,
  reason: RepositoryDatabaseIntegrityReason,
  expected: RepositoryDatabaseIntegrityValue,
  actual: RepositoryDatabaseIntegrityValue,
): RepositoryDatabaseIntegrityError {
  return new RepositoryDatabaseIntegrityError(
    contract.assetId,
    reason,
    expected,
    actual,
  );
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizedNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function scalarInteger(db: Database, sql: string): number | null {
  const value = db.exec(sql)[0]?.values[0]?.[0];
  return normalizedNonNegativeInteger(value);
}

export function readNormalizedDatabaseColumns(
  db: Database,
  table: string,
): NormalizedDatabaseColumn[] | null {
  const result = db.exec(`PRAGMA table_info(${quoteIdentifier(table)})`)[0];
  if (!result || result.values.length === 0) return null;
  const columnIndex = new Map(result.columns.map((name, index) => [name, index]));
  const valueAt = (row: readonly unknown[], name: string): unknown => {
    const index = columnIndex.get(name);
    if (index === undefined) throw new Error(`PRAGMA table_info omitted ${name}`);
    return row[index];
  };

  return result.values.map((row, rowIndex) => {
    const name = valueAt(row, 'name');
    const declaredType = valueAt(row, 'type');
    const defaultValue = valueAt(row, 'dflt_value');
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Column ${rowIndex} has an invalid name`);
    }
    if (typeof declaredType !== 'string') {
      throw new Error(`Column ${name} has an invalid declared type`);
    }
    if (defaultValue !== null && typeof defaultValue !== 'string') {
      throw new Error(`Column ${name} has an invalid default value`);
    }
    const cid = normalizedNonNegativeInteger(valueAt(row, 'cid'));
    const notNull = normalizedNonNegativeInteger(valueAt(row, 'notnull'));
    const primaryKeyPosition = normalizedNonNegativeInteger(valueAt(row, 'pk'));
    if (cid === null || notNull === null || primaryKeyPosition === null) {
      throw new Error(`Column ${name} has invalid numeric metadata`);
    }
    return {
      cid,
      name,
      declaredType: declaredType.trim().replace(/\s+/gu, ' ').toUpperCase(),
      notNull: notNull === 1,
      defaultValue: defaultValue === null
        ? null
        : defaultValue.trim().replace(/\s+/gu, ' '),
      primaryKeyPosition,
    };
  });
}

function normalizedContractSha256(
  contract: DatabaseAssetManifestEntry,
  value: string,
): string {
  return normalizeSha256Digest(
    value,
    () => integrityError(contract, 'contract_invalid', '64 lowercase hex characters', value),
  );
}

function assertContractInteger(
  contract: DatabaseAssetManifestEntry,
  field: 'byteLength' | 'userVersion' | 'rowCount',
): number {
  const value = normalizedNonNegativeInteger(contract[field]);
  if (value === null) {
    throw integrityError(contract, 'contract_invalid', 'non-negative safe integer', null);
  }
  return value;
}

async function verifyTextDigest(
  contract: DatabaseAssetManifestEntry,
  text: string,
  expectedSha256: string,
  mismatchReason: 'contract_invalid' | 'schema_mismatch',
): Promise<void> {
  await verifySha256Digest(
    new TextEncoder().encode(text),
    normalizedContractSha256(contract, expectedSha256),
    {
      cryptoUnavailable: () => integrityError(
        contract,
        'crypto_unavailable',
        'Web Crypto SHA-256 support',
        null,
      ),
      mismatch: (expected, actual) => integrityError(
        contract,
        mismatchReason,
        expected,
        actual,
      ),
    },
  );
}

/** Verify immutable bytes before passing them to `new SQL.Database(...)`. */
export async function verifyRepositoryDatabaseBytesBeforeOpen(
  bytes: Uint8Array,
  contract: DatabaseAssetManifestEntry,
): Promise<void> {
  const expectedLength = assertContractInteger(contract, 'byteLength');
  if (bytes.byteLength !== expectedLength) {
    throw integrityError(
      contract,
      'byte_length_mismatch',
      expectedLength,
      bytes.byteLength,
    );
  }
  const expectedSha256 = normalizedContractSha256(contract, contract.sha256);
  await verifySha256Digest(bytes, expectedSha256, {
    cryptoUnavailable: () => integrityError(
      contract,
      'crypto_unavailable',
      'Web Crypto SHA-256 support',
      null,
    ),
    mismatch: (expected, actual) => integrityError(
      contract,
      'sha256_mismatch',
      expected,
      actual,
    ),
  });
}

/**
 * Verify an already-open sql.js database. The caller retains ownership and is
 * solely responsible for closing the database on success or failure.
 */
export async function verifyOpenedRepositoryDatabase(
  db: Database,
  contract: DatabaseAssetManifestEntry,
): Promise<void> {
  const expectedUserVersion = assertContractInteger(contract, 'userVersion');
  const expectedRowCount = assertContractInteger(contract, 'rowCount');
  if (typeof contract.table !== 'string' || contract.table.length === 0) {
    throw integrityError(contract, 'contract_invalid', 'non-empty table name', null);
  }
  if (!Array.isArray(contract.columns) || contract.columns.length === 0) {
    throw integrityError(contract, 'contract_invalid', 'normalized columns', null);
  }

  let actualUserVersion: number | null;
  try {
    actualUserVersion = scalarInteger(db, 'PRAGMA user_version');
  } catch {
    actualUserVersion = null;
  }
  if (actualUserVersion !== expectedUserVersion) {
    throw integrityError(
      contract,
      'user_version_mismatch',
      expectedUserVersion,
      actualUserVersion,
    );
  }

  let actualColumns: NormalizedDatabaseColumn[] | null;
  try {
    actualColumns = readNormalizedDatabaseColumns(db, contract.table);
  } catch {
    throw integrityError(contract, 'schema_mismatch', contract.schemaContractSha256, null);
  }
  if (!actualColumns) {
    throw integrityError(contract, 'table_missing', contract.table, null);
  }

  const expectedColumnsJson = JSON.stringify(contract.columns);
  const actualColumnsJson = JSON.stringify(actualColumns);
  await verifyTextDigest(
    contract,
    expectedColumnsJson,
    contract.schemaContractSha256,
    'contract_invalid',
  );
  await verifyTextDigest(
    contract,
    actualColumnsJson,
    contract.schemaContractSha256,
    'schema_mismatch',
  );
  if (actualColumnsJson !== expectedColumnsJson) {
    throw integrityError(
      contract,
      'schema_mismatch',
      contract.schemaContractSha256,
      null,
    );
  }

  let actualRowCount: number | null;
  try {
    actualRowCount = scalarInteger(
      db,
      `SELECT COUNT(*) FROM ${quoteIdentifier(contract.table)}`,
    );
  } catch {
    actualRowCount = null;
  }
  if (actualRowCount !== expectedRowCount) {
    throw integrityError(
      contract,
      'row_count_mismatch',
      expectedRowCount,
      actualRowCount,
    );
  }
}
