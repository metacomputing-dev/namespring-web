import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import type { DatabaseAssetManifestEntry } from '../src/database/database-asset-contract.js';
import {
  REPOSITORY_DATABASE_INTEGRITY_MISMATCH,
  RepositoryDatabaseIntegrityError,
  readNormalizedDatabaseColumns,
  verifyOpenedRepositoryDatabase,
  verifyRepositoryDatabaseBytesBeforeOpen,
} from '../src/database/database-integrity.js';
import {
  DEFAULT_SQL_JS_WASM_SHA256,
  RepositoryConfigurationError,
  RepositoryIntegrityError,
  createRepositoryRuntime,
  resolveRepositoryWasm,
} from '../src/database/repository-runtime.js';

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function createFixtureBytes(
  SQL: SqlJsStatic,
  options: {
    readonly table?: string;
    readonly userVersion?: number;
    readonly idSql?: string;
    readonly valueSql?: string;
    readonly rowCount?: number;
  } = {},
): Uint8Array {
  const table = options.table ?? 'items';
  const db = new SQL.Database();
  db.run(`PRAGMA user_version = ${options.userVersion ?? 7}`);
  db.run(
    `CREATE TABLE "${table}" (`
    + `${options.idSql ?? 'id INTEGER PRIMARY KEY'}, `
    + `${options.valueSql ?? "value TEXT NOT NULL DEFAULT 'x'"}`
    + ')',
  );
  const statement = db.prepare(`INSERT INTO "${table}" (id, value) VALUES (?, ?)`);
  try {
    for (let id = 1; id <= (options.rowCount ?? 2); id += 1) {
      statement.run([id, `value-${id}`]);
    }
  } finally {
    statement.free();
  }
  const bytes = new Uint8Array(db.export());
  db.close();
  return bytes;
}

function contractFor(
  SQL: SqlJsStatic,
  bytes: Uint8Array,
): DatabaseAssetManifestEntry {
  const db = new SQL.Database(bytes);
  const columns = readNormalizedDatabaseColumns(db, 'items');
  db.close();
  assert.ok(columns);
  return {
    assetId: 'fixture-items',
    relativePath: 'memory/items.db',
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    userVersion: 7,
    schemaContractVersion: 'namespring.seed-db-schema/test-items-v1',
    schemaContractSha256: sha256(JSON.stringify(columns)),
    table: 'items',
    columns,
    rowCount: 2,
    shardKey: null,
  };
}

function matchesDatabaseError(reason: RepositoryDatabaseIntegrityError['reason']) {
  return (error: unknown): boolean => error instanceof RepositoryDatabaseIntegrityError
    && error.code === REPOSITORY_DATABASE_INTEGRITY_MISMATCH
    && error.reason === reason
    && error.retryable === false
    && error.assetId === 'fixture-items';
}

const SQL = await initSqlJs();
const VALID_BYTES = createFixtureBytes(SQL);
const VALID_CONTRACT = contractFor(SQL, VALID_BYTES);

test('database bytes pass size and SHA-256 verification before SQLite open', async () => {
  let opened = false;
  await verifyRepositoryDatabaseBytesBeforeOpen(VALID_BYTES, VALID_CONTRACT);
  opened = true;
  const db = new SQL.Database(VALID_BYTES);
  assert.equal(opened, true);
  db.close();
});

test('size mismatch fails before SHA verification or SQLite open', async () => {
  let opened = false;
  const truncated = VALID_BYTES.slice(0, -1);
  await assert.rejects(
    async () => {
      await verifyRepositoryDatabaseBytesBeforeOpen(truncated, VALID_CONTRACT);
      opened = true;
      return new SQL.Database(truncated);
    },
    matchesDatabaseError('byte_length_mismatch'),
  );
  assert.equal(opened, false);
});

test('single-bit corruption and a wrong pinned hash fail before SQLite open', async () => {
  const corrupted = VALID_BYTES.slice();
  corrupted[corrupted.length - 1] ^= 1;
  await assert.rejects(
    verifyRepositoryDatabaseBytesBeforeOpen(corrupted, VALID_CONTRACT),
    matchesDatabaseError('sha256_mismatch'),
  );
  await assert.rejects(
    verifyRepositoryDatabaseBytesBeforeOpen(VALID_BYTES, {
      ...VALID_CONTRACT,
      sha256: '0'.repeat(64),
    }),
    matchesDatabaseError('sha256_mismatch'),
  );
});

test('a valid opened SQLite database satisfies version, table, schema, and row count', async () => {
  const db = new SQL.Database(VALID_BYTES);
  await verifyOpenedRepositoryDatabase(db, VALID_CONTRACT);
  assert.equal(db.exec('SELECT COUNT(*) FROM items')[0]?.values[0]?.[0], 2);
  db.close();
});

test('opened database rejects wrong user version and missing table', async () => {
  const wrongVersion = new SQL.Database(createFixtureBytes(SQL, { userVersion: 8 }));
  await assert.rejects(
    verifyOpenedRepositoryDatabase(wrongVersion, VALID_CONTRACT),
    matchesDatabaseError('user_version_mismatch'),
  );
  assert.equal(wrongVersion.exec('SELECT 1')[0]?.values[0]?.[0], 1);
  wrongVersion.close();

  const wrongTable = new SQL.Database(createFixtureBytes(SQL, { table: 'other_items' }));
  await assert.rejects(
    verifyOpenedRepositoryDatabase(wrongTable, VALID_CONTRACT),
    matchesDatabaseError('table_missing'),
  );
  assert.equal(wrongTable.exec('SELECT 1')[0]?.values[0]?.[0], 1);
  wrongTable.close();
});

test('full normalized schema rejects type, nullability, default, and PK changes', async () => {
  const variants = [
    { label: 'type', valueSql: "value INTEGER NOT NULL DEFAULT 'x'" },
    { label: 'nullability', valueSql: "value TEXT DEFAULT 'x'" },
    { label: 'default', valueSql: "value TEXT NOT NULL DEFAULT 'y'" },
    { label: 'primary key', idSql: 'id INTEGER NOT NULL' },
  ] as const;
  for (const variant of variants) {
    const db = new SQL.Database(createFixtureBytes(SQL, variant));
    await assert.rejects(
      verifyOpenedRepositoryDatabase(db, VALID_CONTRACT),
      matchesDatabaseError('schema_mismatch'),
      variant.label,
    );
    assert.equal(db.exec('SELECT 1')[0]?.values[0]?.[0], 1, variant.label);
    db.close();
  }
});

test('exact row count is required and verifier never closes the caller database', async () => {
  const db = new SQL.Database(createFixtureBytes(SQL, { rowCount: 1 }));
  await assert.rejects(
    verifyOpenedRepositoryDatabase(db, VALID_CONTRACT),
    matchesDatabaseError('row_count_mismatch'),
  );
  assert.equal(db.exec('SELECT COUNT(*) FROM items')[0]?.values[0]?.[0], 1);
  db.close();
});

test('WASM digest configuration separates unsupported binaries from byte mismatches', async () => {
  assert.throws(
    () => resolveRepositoryWasm({
      wasmUrl: 'https://example.invalid/sql-wasm.wasm',
      wasmSha256: 'bad',
    }),
    (error: unknown) => error instanceof RepositoryConfigurationError
      && error.code === 'REPOSITORY_CONFIGURATION_INVALID'
      && error.message === 'wasmSha256 must be a 64-character hexadecimal SHA-256 digest.',
  );

  const bytes = Uint8Array.of(1, 2, 3);
  let fetches = 0;
  const runtime = createRepositoryRuntime({
    fetch: async () => {
      fetches += 1;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => bytes.buffer,
      };
    },
  });
  await assert.rejects(
    runtime.initializeSqlJs('https://example.invalid/sql-wasm.wasm', '0'.repeat(64)),
    (error: unknown) => error instanceof RepositoryConfigurationError
      && error.code === 'REPOSITORY_CONFIGURATION_INVALID'
      && /only supports the bundled canonical WASM digest/u.test(error.message),
  );
  assert.equal(fetches, 0);

  await assert.rejects(
    runtime.initializeSqlJs(
      'https://example.invalid/sql-wasm.wasm',
      DEFAULT_SQL_JS_WASM_SHA256,
    ),
    (error: unknown) => error instanceof RepositoryIntegrityError
      && error.code === 'REPOSITORY_WASM_INTEGRITY_MISMATCH'
      && error.message === 'The sql.js WASM artifact failed SHA-256 verification.'
      && error.expectedSha256 === DEFAULT_SQL_JS_WASM_SHA256
      && error.actualSha256 === sha256(bytes),
  );
  assert.equal(fetches, 1);
});
