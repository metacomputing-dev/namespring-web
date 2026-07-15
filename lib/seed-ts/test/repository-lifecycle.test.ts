import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import initSqlJs, { type SqlJsStatic } from 'sql.js';

import { FourframeRepository } from '../src/database/fourframe-repository.js';
import { HanjaRepository } from '../src/database/hanja-repository.js';
import { NameStatRepository } from '../src/database/name-stat-repository.js';
import {
  FOURFRAME_DATABASE_ASSET,
  HANJA_DATABASE_ASSET,
} from '../src/database/database-asset-registry.js';
import type { DatabaseAssetManifestEntry } from '../src/database/database-asset-contract.js';
import type { PinnedRepositoryDatabaseIntegrityPolicy } from '../src/database/repository-database-policy.js';
import {
  createRepositoryRuntime,
  DEFAULT_SQL_JS_WASM_SHA256,
  DEFAULT_SQL_JS_WASM_URL,
  RepositoryConfigurationError,
  RepositoryIntegrityError,
} from '../src/database/repository-runtime.js';
import type { RepositoryFetchResponse } from '../src/database/repository-runtime.js';
import { RepositoryDataError } from '../src/database/repository-errors.js';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
}

interface StatementPlan {
  readonly row?: Record<string, unknown>;
  readonly throwOnBind?: Error;
  readonly throwOnStep?: Error;
  readonly throwOnRead?: Error;
}

interface FakeStatementRecord {
  freeCount: number;
}

interface FakeDatabaseRecord {
  readonly tag: number;
  closeCount: number;
}

interface FakeSqlRuntime {
  readonly SQL: SqlJsStatic;
  readonly databases: FakeDatabaseRecord[];
  readonly statements: FakeStatementRecord[];
  readonly statementPlans: StatementPlan[];
  readonly bytes: Uint8Array;
  readonly databaseIntegrity: PinnedRepositoryDatabaseIntegrityPolicy | null;
}

const HANJA_ROW: Record<string, unknown> = {
  id: 1,
  hangul: '\uAC00',
  hanja: '\u5BB6',
  onset: '\u3131',
  nucleus: '\u314F',
  strokes: 10,
  stroke_element: 'Water',
  resource_element: 'Wood',
  meaning: 'home',
  radical: '\u5B80',
  is_surname: 0,
};

const NAME = '\uAC00\uB098';
const NAME_STAT_ROW: Record<string, unknown> = {
  id: 1,
  name: NAME,
  first_char: '\uAC00',
  first_choseong: '\u3131',
  similar_names_json: '[]',
  yearly_rank_json: '{}',
  yearly_birth_json: '{}',
  hanja_combinations_json: '[]',
  raw_entry_json: '{}',
};

const FOURFRAME_ROW: Record<string, unknown> = {
  id: 81,
  number: 81,
  title: 'completion',
  summary: 'stable result',
  detailed_explanation: 'complete explanation',
  positive_aspects: 'steady',
  caution_points: 'avoid haste',
  personality_traits: '["patient"]',
  suitable_career: '["researcher"]',
  life_period_influence: 'stable life flow',
  special_characteristics: 'consistent',
  challenge_period: 'early adjustment',
  opportunity_area: 'research',
  lucky_level: '\uC0C1\uC6B4\uC218',
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function bufferWithTag(tag: number): ArrayBuffer {
  return Uint8Array.of(tag).buffer as ArrayBuffer;
}

function response(
  body: ArrayBuffer | Promise<ArrayBuffer> = bufferWithTag(1),
  status = 200,
  statusText = status === 200 ? 'OK' : 'Unavailable',
): RepositoryFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    arrayBuffer: () => Promise.resolve(body),
  };
}

async function createHanjaOrderingFixture(): Promise<{
  readonly SQL: SqlJsStatic;
  readonly buffer: ArrayBuffer;
  readonly databaseIntegrity: PinnedRepositoryDatabaseIntegrityPolicy;
}> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE hanjas (
      id INTEGER PRIMARY KEY,
      hangul TEXT NOT NULL,
      hanja TEXT NOT NULL,
      onset TEXT,
      nucleus TEXT,
      strokes INTEGER,
      stroke_element TEXT,
      resource_element TEXT,
      meaning TEXT,
      radical TEXT,
      is_surname INTEGER DEFAULT 0
    )
  `);

  const statement = db.prepare(`
    INSERT INTO hanjas (
      id, hangul, hanja, onset, nucleus, strokes, stroke_element,
      resource_element, meaning, radical, is_surname
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    for (let id = 1; id <= 205; id += 1) {
      statement.run([
        id,
        '\uAC00',
        '\u5BB6',
        '\u3131',
        '\u314F',
        id % 2 === 0 ? 6 : 5,
        'Water',
        id % 3 === 0 ? 'Wood' : 'Fire',
        `fixture-${id}`,
        '\u5B80',
        id % 10 === 0 ? 1 : 0,
      ]);
    }
  } finally {
    statement.free();
  }

  // These indexes deliberately expose SQLite's freedom to return equal
  // matches in a different order when a repository query omits a complete
  // ORDER BY. The public contract must not depend on the chosen query plan.
  db.run('CREATE INDEX idx_fixture_hanja_desc ON hanjas(hanja, id DESC)');
  db.run('CREATE INDEX idx_fixture_hangul_strokes_desc ON hanjas(hangul, strokes, id DESC)');
  db.run('CREATE INDEX idx_fixture_surname_desc ON hanjas(hangul, is_surname, id DESC)');
  db.run('CREATE INDEX idx_fixture_resource_desc ON hanjas(resource_element, id DESC)');
  db.run('CREATE INDEX idx_fixture_strokes_desc ON hanjas(strokes, id DESC)');
  db.run('CREATE INDEX idx_fixture_onset_desc ON hanjas(onset, id DESC)');

  const exported = db.export();
  db.close();
  const bytes = new Uint8Array(exported);
  return {
    SQL,
    buffer: bytes.buffer,
    databaseIntegrity: pinnedDatabaseIntegrity(HANJA_DATABASE_ASSET, bytes, 205),
  };
}

async function waitUntil(
  condition: () => boolean,
  description: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await Promise.resolve();
  }
  assert.fail('Timed out waiting for ' + description);
}

function createFakeSqlRuntime(defaultRow: Record<string, unknown>): FakeSqlRuntime {
  const databases: FakeDatabaseRecord[] = [];
  const statements: FakeStatementRecord[] = [];
  const statementPlans: StatementPlan[] = [];
  const bytes = Uint8Array.of(1);
  const canonicalContract = defaultRow === HANJA_ROW
    ? HANJA_DATABASE_ASSET
    : defaultRow === FOURFRAME_ROW
      ? FOURFRAME_DATABASE_ASSET
      : null;
  const databaseIntegrity = canonicalContract
    ? pinnedDatabaseIntegrity(canonicalContract, bytes, 1)
    : null;
  const databaseContract = databaseIntegrity?.contract ?? null;

  class FakeStatement {
    public freeCount = 0;
    private stepped = false;

    public constructor(private readonly plan: StatementPlan) {}

    public bind(_params: unknown[]): boolean {
      if (this.plan.throwOnBind) throw this.plan.throwOnBind;
      return true;
    }

    public step(): boolean {
      if (this.plan.throwOnStep) throw this.plan.throwOnStep;
      if (this.stepped) return false;
      this.stepped = true;
      return true;
    }

    public getAsObject(): Record<string, unknown> {
      if (this.plan.throwOnRead) throw this.plan.throwOnRead;
      return this.plan.row ?? defaultRow;
    }

    public free(): boolean {
      this.freeCount += 1;
      return true;
    }
  }

  class FakeDatabase {
    public readonly tag: number;
    public closeCount = 0;

    public constructor(bytes?: Uint8Array) {
      this.tag = bytes?.[0] ?? -1;
      databases.push(this);
    }

    public prepare(_sql: string): FakeStatement {
      const statement = new FakeStatement(statementPlans.shift() ?? {});
      statements.push(statement);
      return statement;
    }

    public exec(sql: string): Array<{
      readonly columns: string[];
      readonly values: unknown[][];
    }> {
      if (!databaseContract) {
        throw new Error('This fake database has no repository integrity contract.');
      }
      if (sql === 'PRAGMA user_version') {
        return [{ columns: ['user_version'], values: [[databaseContract.userVersion]] }];
      }
      if (sql.startsWith('PRAGMA table_info(')) {
        return [{
          columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
          values: databaseContract.columns.map((column) => [
            column.cid,
            column.name,
            column.declaredType,
            column.notNull ? 1 : 0,
            column.defaultValue,
            column.primaryKeyPosition,
          ]),
        }];
      }
      if (sql.startsWith('SELECT COUNT(*) FROM ')) {
        return [{ columns: ['COUNT(*)'], values: [[databaseContract.rowCount]] }];
      }
      throw new Error(`Unexpected integrity query: ${sql}`);
    }

    public close(): void {
      this.closeCount += 1;
    }
  }

  return {
    SQL: { Database: FakeDatabase } as unknown as SqlJsStatic,
    databases,
    statements,
    statementPlans,
    bytes,
    databaseIntegrity,
  };
}

function pinnedDatabaseIntegrity(
  canonical: DatabaseAssetManifestEntry,
  bytes: Uint8Array,
  rowCount: number,
): PinnedRepositoryDatabaseIntegrityPolicy {
  return {
    mode: 'pinned',
    contract: {
      ...canonical,
      relativePath: `memory/${canonical.assetId}.db`,
      byteLength: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount,
    },
  };
}

function createFakeFourframeRepository(
  fake: FakeSqlRuntime,
  options: ConstructorParameters<typeof FourframeRepository>[0],
): FourframeRepository {
  assert.ok(fake.databaseIntegrity);
  return new FourframeRepository({ ...options, databaseIntegrity: fake.databaseIntegrity });
}

function createFakeHanjaRepository(
  fake: FakeSqlRuntime,
  options: ConstructorParameters<typeof HanjaRepository>[0],
): HanjaRepository {
  assert.ok(fake.databaseIntegrity);
  return new HanjaRepository({ ...options, databaseIntegrity: fake.databaseIntegrity });
}

test('default sql.js WASM is version-pinned and fails closed on digest mismatch', async () => {
  assert.equal(
    DEFAULT_SQL_JS_WASM_URL,
    'https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/sql-wasm.wasm',
  );
  assert.match(DEFAULT_SQL_JS_WASM_SHA256, /^[a-f0-9]{64}$/u);

  const runtime = createRepositoryRuntime({
    fetch: async () => response(bufferWithTag(1)),
  });
  await assert.rejects(
    runtime.initializeSqlJs('https://example.invalid/sql-wasm.wasm', '0'.repeat(64)),
    (error: unknown) => error instanceof RepositoryIntegrityError
      && error.code === 'REPOSITORY_WASM_INTEGRITY_MISMATCH',
  );
});

test('default loader executes the verified WASM snapshot, not a mutable transport alias', async () => {
  const transportBytes = new Uint8Array(await readFile(
    new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url),
  )).slice();
  const transportBuffer = transportBytes.buffer;
  const expectedSha256 = createHash('sha256').update(transportBytes).digest('hex');
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalCrypto = globalThis.crypto;
  let sourceAliasMutated = false;

  assert.ok(originalCryptoDescriptor);
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: true,
    value: {
      subtle: {
        digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
          const digest = await originalCrypto.subtle.digest(algorithm, data);
          transportBytes[0] = transportBytes[0]! ^ 0xff;
          sourceAliasMutated = true;
          return digest;
        },
      },
    } as Crypto,
  });

  try {
    const runtime = createRepositoryRuntime({
      fetch: async () => response(transportBuffer),
    });
    const SQL = await runtime.initializeSqlJs('memory://verified.wasm', expectedSha256);
    const database = new SQL.Database();
    database.close();
    assert.equal(sourceAliasMutated, true);
  } finally {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
  }
});

test('custom WASM URL requires a digest unless the caller owns the loader', () => {
  assert.throws(
    () => new HanjaRepository({ wasmUrl: 'https://example.invalid/custom.wasm' }),
    (error: unknown) => error instanceof RepositoryConfigurationError
      && error.code === 'REPOSITORY_CONFIGURATION_INVALID',
  );
  assert.doesNotThrow(() => new HanjaRepository({
    wasmUrl: 'memory://custom.wasm',
    initializeSqlJs: async () => createFakeSqlRuntime(HANJA_ROW).SQL,
    fetch: async () => response(),
  }));
});

test('repository close wins races with loader, fetch, and body rejections', async () => {
  const loaderFake = createFakeSqlRuntime(HANJA_ROW);
  const loader = deferred<SqlJsStatic>();
  const loaderRepository = createFakeHanjaRepository(loaderFake, {
    initializeSqlJs: () => loader.promise,
    fetch: async () => response(),
  });
  const loaderInit = loaderRepository.init();
  const loaderAssertion = assert.rejects(loaderInit, /cancelled by close/);
  loaderRepository.close();
  loader.reject(new Error('loader failed'));
  await loaderAssertion;
  assert.equal(loaderFake.databases.length, 0);

  const fetchFake = createFakeSqlRuntime(HANJA_ROW);
  const fetched = deferred<RepositoryFetchResponse>();
  let fetches = 0;
  const fetchRepository = createFakeHanjaRepository(fetchFake, {
    initializeSqlJs: async () => fetchFake.SQL,
    fetch: () => {
      fetches += 1;
      return fetched.promise;
    },
  });
  const fetchInit = fetchRepository.init();
  const fetchAssertion = assert.rejects(fetchInit, /cancelled by close/);
  await waitUntil(() => fetches === 1, 'the rejecting DB fetch');
  fetchRepository.close();
  fetched.reject(new Error('fetch failed'));
  await fetchAssertion;
  assert.equal(fetchFake.databases.length, 0);

  const bodyFake = createFakeSqlRuntime(HANJA_ROW);
  const body = deferred<ArrayBuffer>();
  let bodyReads = 0;
  const bodyRepository = createFakeHanjaRepository(bodyFake, {
    initializeSqlJs: async () => bodyFake.SQL,
    fetch: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: () => {
        bodyReads += 1;
        return body.promise;
      },
    }),
  });
  const bodyInit = bodyRepository.init();
  const bodyAssertion = assert.rejects(bodyInit, /cancelled by close/);
  await waitUntil(() => bodyReads === 1, 'the rejecting DB response body');
  bodyRepository.close();
  body.reject(new Error('body failed'));
  await bodyAssertion;
  assert.equal(bodyFake.databases.length, 0);

  const activeFake = createFakeSqlRuntime(HANJA_ROW);
  const activeRepository = createFakeHanjaRepository(activeFake, {
    initializeSqlJs: async () => {
      throw new Error('active loader failed');
    },
    fetch: async () => response(),
  });
  await assert.rejects(activeRepository.init(), /active loader failed/);
  activeRepository.close();
});

test('FourframeRepository shares one concurrent initialization', async () => {
  const fake = createFakeSqlRuntime(FOURFRAME_ROW);
  const body = deferred<ArrayBuffer>();
  let sqlLoads = 0;
  let fetches = 0;
  const repository = createFakeFourframeRepository(fake, {
    initializeSqlJs: async () => {
      sqlLoads += 1;
      return fake.SQL;
    },
    fetch: async () => {
      fetches += 1;
      return response(body.promise);
    },
  });

  const first = repository.init();
  const second = repository.init();
  assert.strictEqual(first, second);
  assert.equal(sqlLoads, 1);
  await waitUntil(() => fetches === 1, 'the shared fourframe DB fetch');

  body.resolve(bufferWithTag(1));
  await Promise.all([first, second]);

  assert.equal(fetches, 1);
  assert.equal(fake.databases.length, 1);
  assert.equal((await repository.findByNumber(81))?.title, 'completion');
  repository.close();
});

test('FourframeRepository close prevents a late initialization from publishing', async () => {
  const fake = createFakeSqlRuntime(FOURFRAME_ROW);
  const firstBody = deferred<ArrayBuffer>();
  let fetches = 0;
  const repository = createFakeFourframeRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(firstBody.promise)
        : response(bufferWithTag(1));
    },
  });

  const staleInit = repository.init();
  const staleOutcome = staleInit.catch((error: unknown) => error);
  await waitUntil(() => fetches === 1, 'the first fourframe DB fetch');
  repository.close();

  await repository.init();
  firstBody.resolve(bufferWithTag(1));
  const staleError = await staleOutcome;

  assert.match(String(staleError), /cancelled by close/);
  const [activeDb] = fake.databases;
  assert.ok(activeDb);
  assert.equal(fake.databases.length, 1, 'cancelled bytes must not reach SQL.Database');
  assert.equal(activeDb.closeCount, 0);
  assert.equal((await repository.findByNumber(81))?.number, 81);

  repository.close();
  assert.equal(activeDb.closeCount, 1);
});

test('FourframeRepository removes a failed init promise so initialization can retry', async () => {
  const fake = createFakeSqlRuntime(FOURFRAME_ROW);
  let fetches = 0;
  const repository = createFakeFourframeRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(bufferWithTag(1), 503, 'Unavailable')
        : response(bufferWithTag(1));
    },
  });

  await assert.rejects(repository.init(), /Failed to fetch DB/);
  await repository.init();

  assert.equal(fetches, 2);
  assert.equal(fake.databases.length, 1);
  assert.equal(fake.databases[0]?.tag, 1);
  repository.close();
});

test('FourframeRepository always frees a prepared statement after query failure', async () => {
  const fake = createFakeSqlRuntime(FOURFRAME_ROW);
  const repository = createFakeFourframeRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(),
  });
  await repository.init();
  fake.statementPlans.push({ throwOnStep: new Error('step failed') });

  await assert.rejects(repository.findByNumber(81), /step failed/);
  assert.equal(fake.statements.at(-1)?.freeCount, 1);
  repository.close();
});

test('HanjaRepository shares one concurrent initialization', async () => {
  const fake = createFakeSqlRuntime(HANJA_ROW);
  const body = deferred<ArrayBuffer>();
  let sqlLoads = 0;
  let fetches = 0;
  const repository = createFakeHanjaRepository(fake, {
    initializeSqlJs: async () => {
      sqlLoads += 1;
      return fake.SQL;
    },
    fetch: async () => {
      fetches += 1;
      return response(body.promise);
    },
  });

  const first = repository.init();
  const second = repository.init();
  assert.strictEqual(first, second);
  assert.equal(sqlLoads, 1);
  await waitUntil(() => fetches === 1, 'the shared Hanja DB fetch');

  body.resolve(bufferWithTag(1));
  await Promise.all([first, second]);

  assert.equal(fetches, 1);
  assert.equal(fake.databases.length, 1);
  assert.equal((await repository.findByHanja('\u5BB6'))?.hangul, '\uAC00');
  repository.close();
});

test('HanjaRepository query order is deterministic across SQLite index plans', async () => {
  const fixture = await createHanjaOrderingFixture();
  const repository = new HanjaRepository({
    initializeSqlJs: async () => fixture.SQL,
    fetch: async () => response(fixture.buffer),
    databaseIntegrity: fixture.databaseIntegrity,
  });
  await repository.init();

  const ids = Array.from({ length: 205 }, (_, index) => index + 1);
  const expectedByStroke = [
    ...ids.filter((id) => id % 2 === 1),
    ...ids.filter((id) => id % 2 === 0),
  ];
  const expectedSurnames = ids.filter((id) => id % 10 === 0);
  const expectedWood = ids.filter((id) => id % 3 === 0);

  assert.equal((await repository.findByHanja('\u5BB6'))?.id, 1);
  assert.deepEqual(
    (await repository.findByHangul('\uAC00')).map((entry) => entry.id),
    expectedByStroke,
  );
  assert.deepEqual(
    (await repository.findSurnamesByHangul('\uAC00')).map((entry) => entry.id),
    expectedSurnames,
  );
  assert.deepEqual(
    (await repository.findByResourceElement('Wood')).map((entry) => entry.id),
    expectedWood,
  );
  assert.deepEqual(
    (await repository.findByResourceElement('Wood', '\uAC00')).map((entry) => entry.id),
    expectedWood,
  );
  assert.deepEqual(
    (await repository.findByStrokeRange(5, 5)).map((entry) => entry.id),
    ids.filter((id) => id % 2 === 1),
  );
  assert.deepEqual(
    (await repository.findByOnset('\u3131')).map((entry) => entry.id),
    ids.slice(0, 200),
  );

  repository.close();
});

test('HanjaRepository close prevents a late initialization from publishing', async () => {
  const fake = createFakeSqlRuntime(HANJA_ROW);
  const firstBody = deferred<ArrayBuffer>();
  let fetches = 0;
  const repository = createFakeHanjaRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(firstBody.promise)
        : response(bufferWithTag(1));
    },
  });

  const staleInit = repository.init();
  const staleOutcome = staleInit.catch((error: unknown) => error);
  await waitUntil(() => fetches === 1, 'the first Hanja DB fetch');
  repository.close();

  await repository.init();
  firstBody.resolve(bufferWithTag(1));
  const staleError = await staleOutcome;

  assert.match(String(staleError), /cancelled by close/);
  const [activeDb] = fake.databases;
  assert.ok(activeDb);
  assert.equal(fake.databases.length, 1, 'cancelled bytes must not reach SQL.Database');
  assert.equal(activeDb.closeCount, 0);
  assert.equal((await repository.findByHanja('\u5BB6'))?.hanja, '\u5BB6');

  repository.close();
  assert.equal(activeDb.closeCount, 1);
});

test('HanjaRepository init rejects if close runs before its promise settles', async () => {
  const fake = createFakeSqlRuntime(HANJA_ROW);
  const body = deferred<ArrayBuffer>();
  let fetches = 0;
  const repository = createFakeHanjaRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return response(body.promise);
    },
  });

  const initialization = repository.init();
  await waitUntil(() => fetches === 1, 'the Hanja DB fetch');
  body.resolve(bufferWithTag(1));
  queueMicrotask(() => repository.close());

  await assert.rejects(initialization, /cancelled by close/);
  assert.equal(fake.databases.length, 0, 'cancelled bytes must not reach SQL.Database');
  await assert.rejects(repository.findByHanja('\u5BB6'), /Database not initialized/);
});

test('HanjaRepository removes a failed init promise so initialization can retry', async () => {
  const fake = createFakeSqlRuntime(HANJA_ROW);
  let fetches = 0;
  const repository = createFakeHanjaRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(bufferWithTag(1), 503, 'Unavailable')
        : response(bufferWithTag(1));
    },
  });

  await assert.rejects(repository.init(), /Failed to fetch DB/);
  await repository.init();

  assert.equal(fetches, 2);
  assert.equal(fake.databases.length, 1);
  assert.equal(fake.databases[0]?.tag, 1);
  repository.close();
});

test('HanjaRepository always frees a prepared statement after query failure', async () => {
  const fake = createFakeSqlRuntime(HANJA_ROW);
  const repository = createFakeHanjaRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(),
  });
  await repository.init();
  fake.statementPlans.push({ throwOnStep: new Error('step failed') });

  await assert.rejects(repository.findByHanja('\u5BB6'), /step failed/);
  assert.equal(fake.statements.at(-1)?.freeCount, 1);
  repository.close();
});

test('NameStatRepository shares one same-shard load', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const body = deferred<ArrayBuffer>();
  let sqlLoads = 0;
  let fetches = 0;
  const repository = new NameStatRepository({
    initializeSqlJs: async () => {
      sqlLoads += 1;
      return fake.SQL;
    },
    fetch: async () => {
      fetches += 1;
      return response(body.promise);
    },
  });

  const first = repository.findByName(NAME);
  const second = repository.findByName(NAME);
  await waitUntil(() => fetches === 1, 'the shared name-stat shard fetch');
  body.resolve(bufferWithTag(1));
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(sqlLoads, 1);
  assert.equal(fetches, 1);
  assert.equal(fake.databases.length, 1);
  assert.equal(firstResult?.name, NAME);
  assert.equal(secondResult?.name, NAME);
  assert.deepEqual(fake.statements.map((statement) => statement.freeCount), [1, 1]);
  repository.close();
});

test('NameStatRepository removes a failed shard promise so loading can retry', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  let fetches = 0;
  const repository = new NameStatRepository({
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(bufferWithTag(1), 503, 'Unavailable')
        : response(bufferWithTag(2));
    },
  });

  const outcomes = await Promise.allSettled([
    repository.findByName(NAME),
    repository.findByName(NAME),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ['rejected', 'rejected']);
  assert.equal(fetches, 1);

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  assert.equal(fetches, 2);
  assert.equal(fake.databases.length, 1);
  repository.close();
});

test('NameStatRepository close prevents a late shard from replacing the active DB', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const firstBody = deferred<ArrayBuffer>();
  let sqlLoads = 0;
  let fetches = 0;
  const repository = new NameStatRepository({
    initializeSqlJs: async () => {
      sqlLoads += 1;
      return fake.SQL;
    },
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(firstBody.promise)
        : response(bufferWithTag(2));
    },
  });

  const staleQuery = repository.findByName(NAME);
  const staleOutcome = staleQuery.catch((error: unknown) => error);
  await waitUntil(() => fetches === 1, 'the first name-stat shard fetch');
  repository.close();

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  firstBody.resolve(bufferWithTag(1));
  const staleError = await staleOutcome;

  assert.match(String(staleError), /cancelled by close/);
  assert.equal(sqlLoads, 2);
  assert.equal(fetches, 2);
  const activeDb = fake.databases.find((db) => db.tag === 2);
  const staleDb = fake.databases.find((db) => db.tag === 1);
  assert.ok(activeDb);
  assert.ok(staleDb);
  assert.equal(activeDb.closeCount, 0);
  assert.equal(staleDb.closeCount, 1);

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  assert.equal(fetches, 2);
  repository.close();
  assert.equal(activeDb.closeCount, 1);
});

test('NameStatRepository lookup rejects if close runs before its shard promise settles', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const body = deferred<ArrayBuffer>();
  let fetches = 0;
  const repository = new NameStatRepository({
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return response(body.promise);
    },
  });

  const lookup = repository.findByName(NAME);
  await waitUntil(() => fetches === 1, 'the name-stat shard fetch');
  body.resolve(bufferWithTag(1));
  queueMicrotask(() => repository.close());

  await assert.rejects(lookup, /cancelled by close/);
  assert.equal(fake.databases[0]?.closeCount, 1);
});

test('NameStatRepository close invalidates an in-flight SQL initialization', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const firstSqlLoad = deferred<SqlJsStatic>();
  let sqlLoads = 0;
  const repository = new NameStatRepository({
    initializeSqlJs: async () => {
      sqlLoads += 1;
      return sqlLoads === 1 ? firstSqlLoad.promise : fake.SQL;
    },
    fetch: async () => response(),
  });

  const staleInit = repository.init();
  const staleOutcome = staleInit.catch((error: unknown) => error);
  repository.close();
  await repository.init();
  firstSqlLoad.resolve(fake.SQL);

  assert.match(String(await staleOutcome), /cancelled by close/);
  assert.equal(sqlLoads, 2);
  repository.close();
});

test('NameStatRepository always frees a prepared statement after bind failure', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const repository = new NameStatRepository({
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(),
  });
  assert.equal((await repository.findByName(NAME))?.name, NAME);
  fake.statementPlans.push({ throwOnBind: new Error('bind failed') });

  await assert.rejects(repository.findByName(NAME), /bind failed/);
  assert.equal(fake.statements.at(-1)?.freeCount, 1);
  repository.close();
});

function isDataError(
  error: unknown,
  repository: RepositoryDataError['repository'],
  pathFragment: string,
): boolean {
  assert.ok(error instanceof RepositoryDataError);
  assert.equal(error.code, 'REPOSITORY_DATA_INVALID');
  assert.equal(error.retryable, false);
  assert.equal(error.repository, repository);
  assert.match(error.path, new RegExp(pathFragment));
  assert.equal('received' in error, false, 'data errors must not retain row values');
  return true;
}

test('FourframeRepository rejects malformed and non-finite rows without leaking statements', async () => {
  const fake = createFakeSqlRuntime(FOURFRAME_ROW);
  const repository = createFakeFourframeRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(),
  });
  await repository.init();

  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...FOURFRAME_ROW, id: Number.NaN }, 'id'],
    [{ ...FOURFRAME_ROW, number: Number.POSITIVE_INFINITY }, 'number'],
    [{ ...FOURFRAME_ROW, personality_traits: '{broken' }, 'personality_traits'],
    [{ ...FOURFRAME_ROW, lucky_level: '' }, 'lucky_level'],
  ];
  for (const [row, path] of cases) {
    fake.statementPlans.push({ row });
    await assert.rejects(
      repository.findByNumber(81),
      (error: unknown) => isDataError(error, 'fourframe', path),
    );
  }

  assert.ok(fake.statements.slice(-cases.length).every((statement) => statement.freeCount === 1));
  repository.close();
});

test('HanjaRepository rejects invalid numbers, enums, required fields, and character metadata', async () => {
  const fake = createFakeSqlRuntime(HANJA_ROW);
  const repository = createFakeHanjaRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(),
  });
  await repository.init();

  const missingMeaning = { ...HANJA_ROW };
  delete missingMeaning.meaning;
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...HANJA_ROW, strokes: Number.NaN }, 'strokes'],
    [{ ...HANJA_ROW, strokes: -1 }, 'strokes'],
    [{ ...HANJA_ROW, resource_element: 'Void' }, 'resource_element'],
    [{ ...HANJA_ROW, onset: '\u3147' }, 'onset'],
    [{ ...HANJA_ROW, is_surname: 2 }, 'is_surname'],
    [missingMeaning, 'meaning'],
  ];
  for (const [row, path] of cases) {
    fake.statementPlans.push({ row });
    await assert.rejects(
      repository.findByHanja('\u5BB6'),
      (error: unknown) => isDataError(error, 'hanja', path),
    );
  }

  assert.ok(fake.statements.slice(-cases.length).every((statement) => statement.freeCount === 1));
  repository.close();
});

test('NameStatRepository rejects malformed JSON and unsafe statistic values', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const repository = new NameStatRepository({
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(),
  });

  const missingRawEntry = { ...NAME_STAT_ROW };
  delete missingRawEntry.raw_entry_json;
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...NAME_STAT_ROW, similar_names_json: '{broken' }, 'similar_names_json'],
    [{
      ...NAME_STAT_ROW,
      yearly_birth_json: JSON.stringify({ male: { 2020: 'Infinity' } }),
    }, 'yearly_birth_json'],
    [{
      ...NAME_STAT_ROW,
      yearly_rank_json: JSON.stringify({ all: { 2020: -1 } }),
    }, 'yearly_rank_json'],
    [{
      ...NAME_STAT_ROW,
      yearly_rank_json: JSON.stringify({ all: { 2020: null } }),
    }, 'yearly_rank_json'],
    [{ ...NAME_STAT_ROW, raw_entry_json: '{"metric":1e400}' }, 'raw_entry_json'],
    [{
      ...NAME_STAT_ROW,
      raw_entry_json: '{"__proto__":{"polluted":true}}',
    }, 'raw_entry_json'],
    [missingRawEntry, 'raw_entry_json'],
    [{ ...NAME_STAT_ROW, name: '\uB2E4\uB77C' }, 'name'],
  ];
  for (const [row, path] of cases) {
    fake.statementPlans.push({ row });
    await assert.rejects(
      repository.findByName(NAME),
      (error: unknown) => isDataError(error, 'name-stat', path),
    );
  }

  assert.ok(fake.statements.slice(-cases.length).every((statement) => statement.freeCount === 1));
  repository.close();
});
