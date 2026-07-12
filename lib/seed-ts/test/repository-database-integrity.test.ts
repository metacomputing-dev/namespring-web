import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import type { DatabaseAssetManifestEntry } from '../src/database/database-asset-contract.js';
import {
  FOURFRAME_DATABASE_ASSET,
  HANJA_DATABASE_ASSET,
  NAME_STAT_DATABASE_ASSETS,
} from '../src/database/database-asset-registry.js';
import {
  RepositoryDatabaseIntegrityError,
  readNormalizedDatabaseColumns,
  verifyRepositoryDatabaseBytesBeforeOpen,
} from '../src/database/database-integrity.js';
import { FourframeRepository } from '../src/database/fourframe-repository.js';
import { HanjaRepository } from '../src/database/hanja-repository.js';
import { NameStatRepository } from '../src/database/name-stat-repository.js';
import { openVerifiedRepositoryDatabase } from '../src/database/repository-database-opener.js';
import {
  resolveRepositoryDatabaseContract,
  resolveRepositoryDatabaseShardSet,
  type RepositoryDatabaseIntegrityPolicy,
  type RepositoryDatabaseShardSetIntegrityPolicy,
} from '../src/database/repository-database-policy.js';
import {
  RepositoryConfigurationError,
  type RepositoryFetchResponse,
} from '../src/database/repository-runtime.js';

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function response(bytes: Uint8Array): RepositoryFetchResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
  };
}

function isIntegrityReason(reason: RepositoryDatabaseIntegrityError['reason']) {
  return (error: unknown): boolean => error instanceof RepositoryDatabaseIntegrityError
    && error.code === 'REPOSITORY_DATABASE_INTEGRITY_MISMATCH'
    && error.reason === reason
    && error.retryable === false;
}

const CANONICAL_HANJA_BYTES = Uint8Array.from(readFileSync(
  new URL('../../../namespring/public/data/hanja.db', import.meta.url),
));
const CANONICAL_FOURFRAME_BYTES = Uint8Array.from(readFileSync(
  new URL('../../../namespring/public/data/fourframe.db', import.meta.url),
));
const CANONICAL_NAME_STAT_01_BYTES = Uint8Array.from(readFileSync(
  new URL('../../../namespring/public/data/name-stat-shards/01.db', import.meta.url),
));
const CANONICAL_NAME_STAT_14_BYTES = Uint8Array.from(readFileSync(
  new URL('../../../namespring/public/data/name-stat-shards/14.db', import.meta.url),
));

test('canonical Hanja and four-frame assets verify through custom mirror URLs', async () => {
  const SQL = await initSqlJs();
  const requestedUrls: string[] = [];
  const hanja = new HanjaRepository({
    dbUrl: 'memory://mirror/hanja.db',
    initializeSqlJs: async () => SQL,
    fetch: async (url) => {
      requestedUrls.push(url);
      return response(CANONICAL_HANJA_BYTES);
    },
  });
  const fourframe = new FourframeRepository({
    dbUrl: 'memory://mirror/fourframe.db',
    initializeSqlJs: async () => SQL,
    fetch: async (url) => {
      requestedUrls.push(url);
      return response(CANONICAL_FOURFRAME_BYTES);
    },
  });

  await Promise.all([hanja.init(), fourframe.init()]);
  assert.ok((await hanja.findByHangul('\uAC00')).length > 0);
  assert.equal((await fourframe.findByNumber(81))?.number, 81);
  assert.deepEqual(requestedUrls, [
    'memory://mirror/hanja.db',
    'memory://mirror/fourframe.db',
  ]);
  hanja.close();
  fourframe.close();
});

test('NameStat lazily verifies selected canonical edge shards through mirror URLs', async () => {
  const SQL = await initSqlJs();
  const requestedUrls: string[] = [];
  const repository = new NameStatRepository({
    shardBaseUrl: 'memory://mirror/name-stat',
    initializeSqlJs: async () => SQL,
    fetch: async (url) => {
      requestedUrls.push(url);
      if (url.endsWith('/01.db')) return response(CANONICAL_NAME_STAT_01_BYTES);
      if (url.endsWith('/14.db')) return response(CANONICAL_NAME_STAT_14_BYTES);
      throw new Error(`Unexpected NameStat shard URL: ${url}`);
    },
  });

  assert.equal(
    await repository.findByName('가나다라마바사아자차카타파하'),
    null,
  );
  assert.equal(
    await repository.findByName('하파타카차자아사바마라다나가'),
    null,
  );
  assert.deepEqual(requestedUrls, [
    'memory://mirror/name-stat/01.db',
    'memory://mirror/name-stat/14.db',
  ]);
  repository.close();
});

test('NameStat rejects tampered or truncated selected-shard bytes before SQLite opens', async () => {
  let databaseOpenCount = 0;
  class NeverOpenedDatabase {
    public constructor() {
      databaseOpenCount += 1;
      throw new Error('SQLite must not receive unverified NameStat bytes.');
    }
  }
  const SQL = { Database: NeverOpenedDatabase } as unknown as SqlJsStatic;
  const tampered = CANONICAL_NAME_STAT_01_BYTES.slice();
  tampered[tampered.length - 1] ^= 1;
  const repository = new NameStatRepository({
    initializeSqlJs: async () => SQL,
    fetch: async () => response(tampered),
  });

  await assert.rejects(
    repository.findByName('가나'),
    isIntegrityReason('sha256_mismatch'),
  );
  assert.equal(databaseOpenCount, 0);

  const truncatedRepository = new NameStatRepository({
    initializeSqlJs: async () => SQL,
    fetch: async () => response(CANONICAL_NAME_STAT_01_BYTES.slice(0, -1)),
  });
  await assert.rejects(
    truncatedRepository.findByName('가나'),
    isIntegrityReason('byte_length_mismatch'),
  );
  assert.equal(databaseOpenCount, 0);
});

test('injected fetch and sql.js loaders cannot bypass byte verification', async () => {
  let databaseOpenCount = 0;
  class NeverOpenedDatabase {
    public constructor() {
      databaseOpenCount += 1;
      throw new Error('SQLite must not receive unverified bytes.');
    }
  }
  const SQL = { Database: NeverOpenedDatabase } as unknown as SqlJsStatic;

  const tampered = CANONICAL_HANJA_BYTES.slice();
  tampered[tampered.length - 1] ^= 1;
  const tamperedRepository = new HanjaRepository({
    dbUrl: 'memory://mirror/tampered-hanja.db',
    initializeSqlJs: async () => SQL,
    fetch: async () => response(tampered),
  });
  await assert.rejects(tamperedRepository.init(), isIntegrityReason('sha256_mismatch'));
  assert.equal(databaseOpenCount, 0);

  const truncatedRepository = new HanjaRepository({
    dbUrl: 'memory://mirror/truncated-hanja.db',
    initializeSqlJs: async () => SQL,
    fetch: async () => response(CANONICAL_HANJA_BYTES.slice(0, -1)),
  });
  await assert.rejects(truncatedRepository.init(), isIntegrityReason('byte_length_mismatch'));
  assert.equal(databaseOpenCount, 0);
});

function createFixture(SQL: SqlJsStatic): {
  readonly bytes: Uint8Array;
  readonly contract: DatabaseAssetManifestEntry;
} {
  const db = new SQL.Database();
  db.run('PRAGMA user_version = 3');
  db.run('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  db.run("INSERT INTO items (id, value) VALUES (1, 'one')");
  const columns = readNormalizedDatabaseColumns(db, 'items');
  assert.ok(columns);
  const bytes = new Uint8Array(db.export());
  db.close();
  return {
    bytes,
    contract: {
      assetId: 'fixture-items',
      relativePath: 'memory/items.db',
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      userVersion: 3,
      schemaContractVersion: 'namespring.seed-db-schema/fixture-items-v1',
      schemaContractSha256: sha256(JSON.stringify(columns)),
      table: 'items',
      columns,
      rowCount: 1,
      shardKey: null,
    },
  };
}

function createCountingSql(SQL: SqlJsStatic): {
  readonly SQL: SqlJsStatic;
  readonly opened: Array<{ readonly inner: Database; closeCount: number }>;
} {
  const opened: Array<{ readonly inner: Database; closeCount: number }> = [];
  class CountingDatabase {
    public readonly inner: Database;
    public closeCount = 0;

    public constructor(bytes?: Uint8Array) {
      this.inner = new SQL.Database(bytes);
      opened.push(this);
    }

    public exec(sql: string) {
      return this.inner.exec(sql);
    }

    public close(): void {
      this.closeCount += 1;
      this.inner.close();
    }
  }
  return {
    SQL: { Database: CountingDatabase } as unknown as SqlJsStatic,
    opened,
  };
}

test('verified opener closes candidates exactly once after post-open failure or cancellation', async () => {
  const realSQL = await initSqlJs();
  const fixture = createFixture(realSQL);

  const rowMismatch = createCountingSql(realSQL);
  await assert.rejects(
    openVerifiedRepositoryDatabase(
      rowMismatch.SQL,
      fixture.bytes,
      { ...fixture.contract, rowCount: 2 },
      () => {},
    ),
    isIntegrityReason('row_count_mismatch'),
  );
  assert.equal(rowMismatch.opened.length, 1);
  assert.equal(rowMismatch.opened[0]?.closeCount, 1);

  const schemaMismatch = createCountingSql(realSQL);
  const mismatchedColumns = fixture.contract.columns.map((column) => (
    column.name === 'value'
      ? { ...column, declaredType: 'INTEGER' }
      : { ...column }
  ));
  await assert.rejects(
    openVerifiedRepositoryDatabase(
      schemaMismatch.SQL,
      fixture.bytes,
      {
        ...fixture.contract,
        columns: mismatchedColumns,
        schemaContractSha256: sha256(JSON.stringify(mismatchedColumns)),
      },
      () => {},
    ),
    isIntegrityReason('schema_mismatch'),
  );
  assert.equal(schemaMismatch.opened.length, 1);
  assert.equal(schemaMismatch.opened[0]?.closeCount, 1);

  const cancelled = createCountingSql(realSQL);
  let activeChecks = 0;
  await assert.rejects(
    openVerifiedRepositoryDatabase(
      cancelled.SQL,
      fixture.bytes,
      fixture.contract,
      () => {
        activeChecks += 1;
        if (activeChecks === 2) throw new Error('cancelled by close');
      },
    ),
    /cancelled by close/,
  );
  assert.equal(cancelled.opened.length, 1);
  assert.equal(cancelled.opened[0]?.closeCount, 1);
});

test('pinned policies are immutable, family-bound, and fail closed when malformed', async () => {
  const mutable = {
    ...HANJA_DATABASE_ASSET,
    columns: HANJA_DATABASE_ASSET.columns.map((column) => ({ ...column })),
  };
  const resolved = resolveRepositoryDatabaseContract(
    { mode: 'pinned', contract: mutable },
    HANJA_DATABASE_ASSET,
  );
  const originalSha = resolved.sha256;
  const originalColumn = resolved.columns[0]?.name;
  mutable.sha256 = '0'.repeat(64);
  if (mutable.columns[0]) mutable.columns[0].name = 'mutated';

  assert.notStrictEqual(resolved, mutable);
  assert.equal(resolved.sha256, originalSha);
  assert.equal(resolved.columns[0]?.name, originalColumn);
  assert.equal(Object.isFrozen(resolved), true);
  assert.equal(Object.isFrozen(resolved.columns), true);
  assert.equal(Object.isFrozen(resolved.columns[0]), true);

  assert.throws(
    () => resolveRepositoryDatabaseContract(
      {
        mode: 'pinned',
        contract: { ...HANJA_DATABASE_ASSET, table: 'wrong_table' },
      },
      HANJA_DATABASE_ASSET,
    ),
    (error: unknown) => error instanceof RepositoryConfigurationError
      && error.code === 'REPOSITORY_CONFIGURATION_INVALID',
  );
  assert.throws(
    () => resolveRepositoryDatabaseContract(
      null as unknown as RepositoryDatabaseIntegrityPolicy,
      HANJA_DATABASE_ASSET,
    ),
    RepositoryConfigurationError,
  );
  assert.throws(
    () => resolveRepositoryDatabaseContract(
      { mode: 'pinned' } as RepositoryDatabaseIntegrityPolicy,
      HANJA_DATABASE_ASSET,
    ),
    RepositoryConfigurationError,
  );

  await assert.rejects(
    verifyRepositoryDatabaseBytesBeforeOpen(
      CANONICAL_FOURFRAME_BYTES,
      { ...FOURFRAME_DATABASE_ASSET, sha256: 'invalid' },
    ),
    isIntegrityReason('contract_invalid'),
  );
});

test('NameStat pinned shard sets are complete, family-bound, immutable, and canonical-order', () => {
  const makeMutableContracts = () => NAME_STAT_DATABASE_ASSETS.map(
    (canonical, index) => ({
      ...canonical,
      assetId: `mirror-name-stat-${String(index + 1).padStart(2, '0')}`,
      relativePath: `memory://mirror/${String(index + 1).padStart(2, '0')}.db`,
      columns: canonical.columns.map((column) => ({ ...column })),
    }),
  );
  const mutableContracts = makeMutableContracts();
  const resolved = resolveRepositoryDatabaseShardSet(
    { mode: 'pinned', contracts: [...mutableContracts].reverse() },
    NAME_STAT_DATABASE_ASSETS,
  );

  assert.deepEqual(
    resolved.map((contract) => contract.shardKey),
    NAME_STAT_DATABASE_ASSETS.map((contract) => contract.shardKey),
  );
  assert.deepEqual(
    resolved.map((contract) => contract.assetId),
    mutableContracts.map((contract) => contract.assetId),
    'alternate assetId and relativePath provenance must remain supported',
  );
  assert.equal(Object.isFrozen(resolved), true);
  assert.ok(resolved.every((contract) => Object.isFrozen(contract)));
  assert.ok(resolved.every((contract) => Object.isFrozen(contract.columns)));
  assert.ok(resolved.every((contract) => Object.isFrozen(contract.columns[0])));

  const firstResolvedSha = resolved[0]?.sha256;
  mutableContracts[0]!.sha256 = '0'.repeat(64);
  mutableContracts[0]!.columns[0]!.name = 'mutated';
  assert.equal(resolved[0]?.sha256, firstResolvedSha);
  assert.notEqual(resolved[0]?.columns[0]?.name, 'mutated');

  const expectInvalid = (
    contracts: readonly DatabaseAssetManifestEntry[],
    message: RegExp,
  ): void => {
    assert.throws(
      () => resolveRepositoryDatabaseShardSet(
        { mode: 'pinned', contracts },
        NAME_STAT_DATABASE_ASSETS,
      ),
      (error: unknown) => {
        if (!(error instanceof RepositoryConfigurationError)) return false;
        assert.equal(error.code, 'REPOSITORY_CONFIGURATION_INVALID');
        assert.match(error.message, message);
        return true;
      },
    );
  };

  expectInvalid(makeMutableContracts().slice(0, -1), /missing shardKey/u);

  const duplicateAssetIds = makeMutableContracts();
  duplicateAssetIds[1] = {
    ...duplicateAssetIds[1]!,
    assetId: duplicateAssetIds[0]!.assetId,
  };
  expectInvalid(duplicateAssetIds, /duplicates assetId/u);

  const duplicateShardKeys = makeMutableContracts();
  duplicateShardKeys[1] = {
    ...duplicateShardKeys[1]!,
    shardKey: duplicateShardKeys[0]!.shardKey,
  };
  expectInvalid(duplicateShardKeys, /duplicates shardKey/u);

  const unknownShardKey = makeMutableContracts();
  unknownShardKey[0] = {
    ...unknownShardKey[0]!,
    shardKey: 'unknown-shard',
  };
  expectInvalid(unknownShardKey, /unknown shardKey/u);

  const crossFamilyTable = makeMutableContracts();
  crossFamilyTable[0] = {
    ...crossFamilyTable[0]!,
    table: HANJA_DATABASE_ASSET.table,
  };
  expectInvalid(crossFamilyTable, /contract table does not match/u);

  assert.throws(
    () => resolveRepositoryDatabaseShardSet(
      null as unknown as RepositoryDatabaseShardSetIntegrityPolicy,
      NAME_STAT_DATABASE_ASSETS,
    ),
    RepositoryConfigurationError,
  );
  assert.throws(
    () => resolveRepositoryDatabaseShardSet(
      { mode: 'pinned' } as RepositoryDatabaseShardSetIntegrityPolicy,
      NAME_STAT_DATABASE_ASSETS,
    ),
    RepositoryConfigurationError,
  );
});
