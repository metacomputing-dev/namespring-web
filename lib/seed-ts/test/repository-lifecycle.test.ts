import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import initSqlJs, { type SqlJsStatic } from 'sql.js';

import {
  REPOSITORY_QUERY_INVALID,
  RepositoryQueryValidationError,
} from '../src/index.js';
import { FourframeRepository } from '../src/database/fourframe-repository.js';
import { HanjaRepository } from '../src/database/hanja-repository.js';
import { NameStatRepository } from '../src/database/name-stat-repository.js';
import {
  FOURFRAME_DATABASE_ASSET,
  HANJA_DATABASE_ASSET,
  NAME_STAT_DATABASE_ASSETS,
} from '../src/database/database-asset-registry.js';
import type { DatabaseAssetManifestEntry } from '../src/database/database-asset-contract.js';
import type {
  PinnedRepositoryDatabaseIntegrityPolicy,
  PinnedRepositoryDatabaseShardSetIntegrityPolicy,
} from '../src/database/repository-database-policy.js';
import {
  createRepositoryRuntime,
  DEFAULT_SQL_JS_VERSION,
  DEFAULT_SQL_JS_WASM_BYTE_LENGTH,
  DEFAULT_SQL_JS_WASM_SHA256,
  DEFAULT_SQL_JS_WASM_URL,
  RepositoryConfigurationError,
  RepositoryIntegrityError,
} from '../src/database/repository-runtime.js';
import type { RepositoryFetchResponse } from '../src/database/repository-runtime.js';
import { RepositoryDataError } from '../src/database/repository-errors.js';
import { awaitActiveRepositoryStep } from '../src/database/repository-lifecycle.js';

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
  closeError: Error | null;
}

interface FakeSqlRuntime {
  readonly SQL: SqlJsStatic;
  readonly databases: FakeDatabaseRecord[];
  readonly statements: FakeStatementRecord[];
  readonly statementPlans: StatementPlan[];
  readonly bytes: Uint8Array;
  readonly databaseIntegrity: PinnedRepositoryDatabaseIntegrityPolicy | null;
  readonly nameStatDatabaseIntegrity:
    PinnedRepositoryDatabaseShardSetIntegrityPolicy | null;
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

async function waitUntilEventLoop(
  condition: () => boolean,
  description: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail('Timed out waiting for ' + description);
}

function requireAbortSignal(
  value: AbortSignal | null,
  description: string,
): AbortSignal {
  assert.ok(value, description);
  return value;
}

function installCryptoDigest(
  digest: SubtleCrypto['digest'],
): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { subtle: { digest } } as unknown as Crypto,
  });
  return () => {
    if (previous) {
      Object.defineProperty(globalThis, 'crypto', previous);
    } else {
      Reflect.deleteProperty(globalThis, 'crypto');
    }
  };
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
  const nameStatDatabaseIntegrity = defaultRow === NAME_STAT_ROW
    ? pinnedNameStatDatabaseIntegrity(bytes, 1)
    : null;
  const databaseContract = databaseIntegrity?.contract
    ?? nameStatDatabaseIntegrity?.contracts[0]
    ?? null;

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
    public closeError: Error | null = null;

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
      if (this.closeError) throw this.closeError;
    }
  }

  return {
    SQL: { Database: FakeDatabase } as unknown as SqlJsStatic,
    databases,
    statements,
    statementPlans,
    bytes,
    databaseIntegrity,
    nameStatDatabaseIntegrity,
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

function pinnedNameStatDatabaseIntegrity(
  bytes: Uint8Array,
  rowCount: number,
): PinnedRepositoryDatabaseShardSetIntegrityPolicy {
  const digest = createHash('sha256').update(bytes).digest('hex');
  return {
    mode: 'pinned',
    contracts: NAME_STAT_DATABASE_ASSETS.map((canonical) => ({
      ...canonical,
      assetId: `fixture-${canonical.assetId}`,
      relativePath: `memory/${canonical.assetId}.db`,
      byteLength: bytes.byteLength,
      sha256: digest,
      rowCount,
    })),
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

function createFakeNameStatRepository(
  fake: FakeSqlRuntime,
  options: ConstructorParameters<typeof NameStatRepository>[0],
): NameStatRepository {
  assert.ok(fake.nameStatDatabaseIntegrity);
  return new NameStatRepository({
    ...options,
    databaseIntegrity: fake.nameStatDatabaseIntegrity,
  });
}

function isInvalidRepositoryQuery(error: unknown): boolean {
  return error instanceof RepositoryQueryValidationError
    && error.code === REPOSITORY_QUERY_INVALID;
}

test('default sql.js WASM is version-pinned and refuses alternate stock-loader digests', async () => {
  assert.equal(DEFAULT_SQL_JS_VERSION, '1.14.1');
  assert.equal(DEFAULT_SQL_JS_WASM_BYTE_LENGTH, 659_730);
  assert.doesNotMatch(DEFAULT_SQL_JS_WASM_URL, /^https?:/iu);
  assert.doesNotMatch(DEFAULT_SQL_JS_WASM_URL, /cdn/iu);
  assert.match(DEFAULT_SQL_JS_WASM_SHA256, /^[a-f0-9]{64}$/u);

  const alternateBytes = Uint8Array.from([0, 1, 2, 3]);
  const alternateDigest = createHash('sha256').update(alternateBytes).digest('hex');
  let fetches = 0;
  const runtime = createRepositoryRuntime({
    fetch: async () => {
      fetches += 1;
      return response(alternateBytes.buffer);
    },
  });
  await assert.rejects(
    runtime.initializeSqlJs('https://example.invalid/alternate.wasm', alternateDigest),
    (error: unknown) => error instanceof RepositoryConfigurationError
      && error.code === 'REPOSITORY_CONFIGURATION_INVALID'
      && /only supports the bundled canonical WASM digest/u.test(error.message),
  );
  assert.equal(fetches, 0, 'an unsupported binary must fail before transport');

  await assert.rejects(
    runtime.initializeSqlJs(
      'https://example.invalid/corrupt-canonical.wasm',
      DEFAULT_SQL_JS_WASM_SHA256,
    ),
    (error: unknown) => error instanceof RepositoryIntegrityError
      && error.code === 'REPOSITORY_WASM_INTEGRITY_MISMATCH',
  );
  assert.equal(fetches, 1, 'canonical digest claims must still verify fetched bytes');

  const truncatedDefault = createRepositoryRuntime({
    fetch: async () => response(bufferWithTag(1)),
  });
  await assert.rejects(
    truncatedDefault.initializeSqlJs(
      DEFAULT_SQL_JS_WASM_URL,
      DEFAULT_SQL_JS_WASM_SHA256,
    ),
    /Bundled sql\.js WASM byte length mismatch: expected 659730, received 1\./u,
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
  assert.throws(
    () => new HanjaRepository({
      wasmUrl: 'https://example.invalid/alternate.wasm',
      wasmSha256: '0'.repeat(64),
    }),
    (error: unknown) => error instanceof RepositoryConfigurationError
      && error.code === 'REPOSITORY_CONFIGURATION_INVALID'
      && /only supports the bundled canonical WASM digest/u.test(error.message),
  );
  assert.doesNotThrow(() => new HanjaRepository({
    wasmUrl: 'memory://custom.wasm',
    wasmSha256: '0'.repeat(64),
    initializeSqlJs: async () => createFakeSqlRuntime(HANJA_ROW).SQL,
    fetch: async () => response(),
  }));
});

test('awaitActiveRepositoryStep owns abort listeners and skips already-aborted work', async () => {
  let listenerAdds = 0;
  let listenerRemoves = 0;
  const trackingSignal = {
    aborted: false,
    reason: undefined,
    addEventListener: () => {
      listenerAdds += 1;
    },
    removeEventListener: () => {
      listenerRemoves += 1;
    },
  } as unknown as AbortSignal;

  assert.equal(
    await awaitActiveRepositoryStep(
      async () => 7,
      () => {},
      trackingSignal,
    ),
    7,
  );
  assert.equal(listenerAdds, 1);
  assert.equal(listenerRemoves, 1);

  const cancellation = new Error('already closed');
  let abortedOperationCalls = 0;
  let abortedListenerAdds = 0;
  const alreadyAbortedSignal = {
    aborted: true,
    reason: new Error('raw abort reason'),
    addEventListener: () => {
      abortedListenerAdds += 1;
    },
    removeEventListener: () => {},
  } as unknown as AbortSignal;
  await assert.rejects(
    awaitActiveRepositoryStep(
      async () => {
        abortedOperationCalls += 1;
        return 1;
      },
      () => {
        throw cancellation;
      },
      alreadyAbortedSignal,
    ),
    (error: unknown) => error === cancellation,
  );
  assert.equal(abortedOperationCalls, 0);
  assert.equal(abortedListenerAdds, 0);
});

test('HanjaRepository close promptly cancels an ignored fetch and permits retry', async () => {
  const fake = createFakeSqlRuntime(HANJA_ROW);
  const neverFetch = new Promise<RepositoryFetchResponse>(() => {});
  const signals: AbortSignal[] = [];
  let fetches = 0;
  const repository = createFakeHanjaRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async (_url, options) => {
      fetches += 1;
      assert.ok(options?.signal);
      signals.push(options.signal);
      return fetches === 1 ? neverFetch : response(bufferWithTag(1));
    },
  });

  const staleInit = repository.init();
  const staleOutcome = staleInit.catch((error: unknown) => error);
  await waitUntil(() => fetches === 1, 'the signal-ignoring Hanja fetch');
  repository.close();

  assert.equal(signals[0]?.aborted, true);
  assert.match(String(await staleOutcome), /cancelled by close/u);
  await repository.init();
  assert.equal(fetches, 2, 'retry must start a fresh Hanja fetch');
  assert.equal(fake.databases.length, 1);
  repository.close();
});

test('FourframeRepository close promptly cancels an ignored body and permits retry', async () => {
  const fake = createFakeSqlRuntime(FOURFRAME_ROW);
  const neverBody = new Promise<ArrayBuffer>(() => {});
  const signals: AbortSignal[] = [];
  let bodyReads = 0;
  const repository = createFakeFourframeRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async (_url, options) => {
      assert.ok(options?.signal);
      signals.push(options.signal);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => {
          bodyReads += 1;
          return bodyReads === 1 ? neverBody : Promise.resolve(bufferWithTag(1));
        },
      };
    },
  });

  const staleInit = repository.init();
  const staleOutcome = staleInit.catch((error: unknown) => error);
  await waitUntil(() => bodyReads === 1, 'the signal-ignoring fourframe body');
  repository.close();

  assert.equal(signals[0]?.aborted, true);
  assert.match(String(await staleOutcome), /cancelled by close/u);
  await repository.init();
  assert.equal(bodyReads, 2, 'retry must consume a fresh fourframe body');
  assert.equal(fake.databases.length, 1);
  repository.close();
});

test('all repositories close promptly while a pre-open database digest never settles', async () => {
  const neverDigest = new Promise<ArrayBuffer>(() => {});
  let digestCalls = 0;
  const restoreCrypto = installCryptoDigest(async () => {
    digestCalls += 1;
    return neverDigest;
  });

  const assertCancelledBeforeOpen = async (
    label: string,
    repository: { close(): void },
    start: () => Promise<unknown>,
    databaseCount: () => number,
  ): Promise<void> => {
    const before = digestCalls;
    const operation = start();
    const outcome = operation.catch((error: unknown) => error);
    await waitUntil(
      () => digestCalls > before,
      `${label} pre-open database digest`,
    );
    repository.close();
    assert.match(String(await outcome), /cancelled by close/u);
    assert.equal(databaseCount(), 0, `${label} must not open unverified bytes`);
  };

  try {
    const hanjaFake = createFakeSqlRuntime(HANJA_ROW);
    const hanja = createFakeHanjaRepository(hanjaFake, {
      initializeSqlJs: async () => hanjaFake.SQL,
      fetch: async () => response(bufferWithTag(1)),
    });
    await assertCancelledBeforeOpen(
      'HanjaRepository',
      hanja,
      () => hanja.init(),
      () => hanjaFake.databases.length,
    );

    const fourframeFake = createFakeSqlRuntime(FOURFRAME_ROW);
    const fourframe = createFakeFourframeRepository(fourframeFake, {
      initializeSqlJs: async () => fourframeFake.SQL,
      fetch: async () => response(bufferWithTag(1)),
    });
    await assertCancelledBeforeOpen(
      'FourframeRepository',
      fourframe,
      () => fourframe.init(),
      () => fourframeFake.databases.length,
    );

    const nameStatFake = createFakeSqlRuntime(NAME_STAT_ROW);
    const nameStat = createFakeNameStatRepository(nameStatFake, {
      initializeSqlJs: async () => nameStatFake.SQL,
      fetch: async () => response(bufferWithTag(1)),
    });
    await assertCancelledBeforeOpen(
      'NameStatRepository',
      nameStat,
      () => nameStat.findByName(NAME),
      () => nameStatFake.databases.length,
    );
  } finally {
    restoreCrypto();
  }
});

test('post-open digest cancellation consumes late settlement and closes exactly once', async () => {
  const fake = createFakeSqlRuntime(FOURFRAME_ROW);
  const repository = createFakeFourframeRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(bufferWithTag(1)),
  });
  const realDigest = globalThis.crypto.subtle.digest.bind(
    globalThis.crypto.subtle,
  );
  const stalledDigest = deferred<ArrayBuffer>();
  let stalledDigestResult: Promise<ArrayBuffer> | null = null;
  let digestCalls = 0;
  const restoreCrypto = installCryptoDigest(async (algorithm, data) => {
    digestCalls += 1;
    if (digestCalls === 1) return realDigest(algorithm, data);
    if (digestCalls === 2) {
      stalledDigestResult = realDigest(algorithm, data);
      return stalledDigest.promise;
    }
    return realDigest(algorithm, data);
  });

  try {
    const initialization = repository.init();
    const outcome = initialization.catch((error: unknown) => error);
    await waitUntilEventLoop(
      () => digestCalls === 2 && fake.databases.length === 1,
      'the post-open schema digest',
    );
    repository.close();

    assert.match(String(await outcome), /cancelled by close/u);
    assert.equal(fake.databases[0]?.closeCount, 1);
    assert.ok(stalledDigestResult);
    stalledDigest.resolve(await stalledDigestResult);
    await waitUntil(
      () => digestCalls >= 3,
      'late post-open verification settlement',
    );
    await Promise.resolve();
    assert.equal(
      fake.databases[0]?.closeCount,
      1,
      'opener and repository cleanup must not double-close the candidate',
    );
  } finally {
    restoreCrypto();
  }
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

test('HanjaRepository returns complete deterministic query results across SQLite index plans', async () => {
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
    ids,
  );

  repository.close();
});

test('public repository queries reject invalid types, ranges, and negative limits before SQL', async () => {
  const hanjaFake = createFakeSqlRuntime(HANJA_ROW);
  const hanja = createFakeHanjaRepository(hanjaFake, {
    initializeSqlJs: async () => hanjaFake.SQL,
    fetch: async () => response(),
  });
  const fourframeFake = createFakeSqlRuntime(FOURFRAME_ROW);
  const fourframe = createFakeFourframeRepository(fourframeFake, {
    initializeSqlJs: async () => fourframeFake.SQL,
    fetch: async () => response(),
  });
  const nameStatFake = createFakeSqlRuntime(NAME_STAT_ROW);
  let nameStatFetches = 0;
  const nameStat = createFakeNameStatRepository(nameStatFake, {
    initializeSqlJs: async () => nameStatFake.SQL,
    fetch: async () => {
      nameStatFetches += 1;
      return response();
    },
  });
  await Promise.all([hanja.init(), fourframe.init()]);

  const assertRejectedBeforeStatement = async (
    operation: () => Promise<unknown>,
  ): Promise<void> => {
    const hanjaStatements = hanjaFake.statements.length;
    const fourframeStatements = fourframeFake.statements.length;
    await assert.rejects(operation(), isInvalidRepositoryQuery);
    assert.equal(hanjaFake.statements.length, hanjaStatements);
    assert.equal(fourframeFake.statements.length, fourframeStatements);
  };

  const oversizedPrivateEnum = `private-enum-marker-${'x'.repeat(1_000_000)}`;
  const invalidHanjaQueries: Array<() => Promise<unknown>> = [
    () => hanja.findByHanja(1 as unknown as string),
    () => hanja.findByHanja('\u5BB6\u5BB6'),
    () => hanja.findByHangul('A'),
    () => hanja.findSurnamesByHangul(''),
    () => hanja.findByResourceElement('Void'),
    () => hanja.findByResourceElement(oversizedPrivateEnum),
    () => hanja.findByResourceElement('Wood', '\uAC00\uB098'),
    () => hanja.findByStrokeRange(-1, 1),
    () => hanja.findByStrokeRange(2, 1),
    () => hanja.findByStrokeRange(1.5, 2),
    () => hanja.findByOnset('not-an-onset'),
    () => hanja.findByOnset(oversizedPrivateEnum),
  ];
  for (const operation of invalidHanjaQueries) {
    await assertRejectedBeforeStatement(operation);
  }

  const invalidFourframeQueries: Array<() => Promise<unknown>> = [
    () => fourframe.findByNumber(0),
    () => fourframe.findByNumber(82),
    () => fourframe.findByNumber('81' as unknown as number),
    () => fourframe.findByLuckyLevel('not-a-lucky-level'),
    () => fourframe.findByLuckyLevel(oversizedPrivateEnum),
    () => fourframe.searchByTitleOrSummary('', 10),
    () => fourframe.searchByTitleOrSummary('completion', -1),
    () => fourframe.searchByTitleOrSummary('completion', 1.5),
    () => fourframe.searchByTitleOrSummary('x'.repeat(201), 10),
    () => fourframe.findAll(-1),
    () => fourframe.findAll(1_001),
  ];
  for (const operation of invalidFourframeQueries) {
    await assertRejectedBeforeStatement(operation);
  }

  await assert.rejects(
    nameStat.findByName(123 as unknown as string),
    isInvalidRepositoryQuery,
  );
  await assert.rejects(
    nameStat.findByName(''),
    isInvalidRepositoryQuery,
  );
  const privateName = `private-name-marker-${'x'.repeat(1_000_000)}`;
  await assert.rejects(
    nameStat.findByName(privateName),
    (error: unknown) => {
      assert.ok(error instanceof RepositoryQueryValidationError);
      assert.equal(error.repository, 'name-stat');
      assert.equal(error.path, 'name');
      assert.equal(typeof error.reason, 'string');
      assert.equal('received' in error, false);
      assert.equal(error.message.includes(privateName), false);
      assert.equal(JSON.stringify(error).includes(privateName), false);
      return true;
    },
  );
  const whitespacePaddedMarker = `${' '.repeat(1_000_000)}private-name-marker`;
  await assert.rejects(
    nameStat.findByName(whitespacePaddedMarker),
    (error: unknown) => {
      assert.ok(error instanceof RepositoryQueryValidationError);
      assert.equal(error.path, 'name');
      assert.equal(error.message.includes('private-name-marker'), false);
      assert.equal(JSON.stringify(error).includes('private-name-marker'), false);
      return true;
    },
  );
  assert.equal(nameStatFetches, 0, 'invalid name-stat queries must not load a shard');

  assert.equal(REPOSITORY_QUERY_INVALID, 'REPOSITORY_QUERY_INVALID');
  hanja.close();
  fourframe.close();
  nameStat.close();
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
  const repository = createFakeNameStatRepository(fake, {
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
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(bufferWithTag(1), 503, 'Unavailable')
        : response(bufferWithTag(1));
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
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => {
      sqlLoads += 1;
      return fake.SQL;
    },
    fetch: async () => {
      fetches += 1;
      return fetches === 1
        ? response(firstBody.promise)
        : response(bufferWithTag(1));
    },
  });

  const staleQuery = repository.findByName(NAME);
  const staleOutcome = staleQuery.catch((error: unknown) => error);
  await waitUntil(() => fetches === 1, 'the first name-stat shard fetch');
  repository.close();

  const staleError = await staleOutcome;
  assert.match(String(staleError), /cancelled by close/);

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  firstBody.resolve(bufferWithTag(1));
  await Promise.resolve();

  assert.equal(sqlLoads, 2);
  assert.equal(fetches, 2);
  const activeDb = fake.databases[0];
  assert.ok(activeDb);
  assert.equal(
    fake.databases.length,
    1,
    'the stale response body must be rejected before SQLite opens it',
  );
  assert.equal(activeDb.closeCount, 0);

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  assert.equal(fetches, 2);
  repository.close();
  assert.equal(activeDb.closeCount, 1);
});

test('NameStatRepository close aborts a pending shard fetch', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  let shardSignal: AbortSignal | null = null;
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: (_url, options) => new Promise<RepositoryFetchResponse>((_resolve, reject) => {
      shardSignal = options?.signal ?? null;
      if (!shardSignal) {
        reject(new Error('NameStat shard fetch did not receive an AbortSignal.'));
        return;
      }
      shardSignal.addEventListener(
        'abort',
        () => reject(new Error('shard fetch aborted')),
        { once: true },
      );
    }),
  });

  const lookup = repository.findByName(NAME);
  await waitUntil(() => shardSignal !== null, 'the abortable name-stat shard fetch');
  const observedSignal = requireAbortSignal(shardSignal, 'pending shard fetch signal');
  assert.equal(observedSignal.aborted, false);

  repository.close();

  assert.equal(observedSignal.aborted, true);
  await assert.rejects(lookup, /cancelled by close/);
  assert.equal(fake.databases.length, 0);
});

test('NameStatRepository cancellation settles before an ignored fetch resolves late', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const lateFetch = deferred<RepositoryFetchResponse>();
  let fetches = 0;
  let lookupSettled = false;
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: () => {
      fetches += 1;
      return lateFetch.promise;
    },
  });

  const outcome = repository.findByName(NAME)
    .catch((error: unknown) => error)
    .finally(() => {
      lookupSettled = true;
    });
  await waitUntil(() => fetches === 1, 'the signal-ignoring shard fetch');
  repository.close();

  await waitUntil(() => lookupSettled, 'cancellation before late fetch resolution');
  assert.match(String(await outcome), /cancelled by close/);
  lateFetch.resolve(response(bufferWithTag(1)));
  await Promise.resolve();
  assert.equal(fake.databases.length, 0);
});

test('NameStatRepository close aborts pending shard body consumption', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  let shardSignal: AbortSignal | null = null;
  let bodyStarted = false;
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async (_url, options) => {
      const signal = options?.signal;
      if (!signal) {
        throw new Error('NameStat shard body did not receive an AbortSignal.');
      }
      shardSignal = signal;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => new Promise<ArrayBuffer>((_resolve, reject) => {
          bodyStarted = true;
          signal.addEventListener(
            'abort',
            () => reject(new Error('shard body aborted')),
            { once: true },
          );
        }),
      };
    },
  });

  const lookup = repository.findByName(NAME);
  await waitUntil(() => bodyStarted, 'the abortable name-stat response body');
  const observedSignal = requireAbortSignal(shardSignal, 'pending shard body signal');
  assert.equal(observedSignal.aborted, false);

  repository.close();

  assert.equal(observedSignal.aborted, true);
  await assert.rejects(lookup, /cancelled by close/);
  assert.equal(fake.databases.length, 0);
});

test('NameStatRepository stale cleanup preserves a new-generation shard controller', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const firstFetch = deferred<RepositoryFetchResponse>();
  const secondBody = deferred<ArrayBuffer>();
  const shardSignals: AbortSignal[] = [];
  let fetches = 0;
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async (_url, options) => {
      const signal = options?.signal;
      assert.ok(signal);
      shardSignals.push(signal);
      fetches += 1;
      if (fetches === 1) return firstFetch.promise;
      if (fetches === 2) return response(secondBody.promise);
      return response(bufferWithTag(1));
    },
  });

  const staleLookup = repository.findByName(NAME);
  const staleOutcome = staleLookup.catch((error: unknown) => error);
  await waitUntil(() => fetches === 1, 'the first generation shard fetch');
  repository.close();
  assert.equal(shardSignals[0]?.aborted, true);

  const secondLookup = repository.findByName(NAME);
  const secondOutcome = secondLookup.catch((error: unknown) => error);
  await waitUntil(() => fetches === 2, 'the second generation shard fetch');
  assert.equal(shardSignals[1]?.aborted, false);

  assert.match(String(await staleOutcome), /cancelled by close/);
  firstFetch.reject(new Error('first generation fetch settled after close'));
  await Promise.resolve();

  repository.close();
  assert.equal(
    shardSignals[1]?.aborted,
    true,
    'stale cleanup must not remove the new generation controller',
  );
  assert.match(String(await secondOutcome), /cancelled by close/);
  secondBody.reject(new Error('second generation body settled after close'));
  await Promise.resolve();

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  assert.equal(fetches, 3);
  assert.equal(fake.databases.length, 1);
  repository.close();
  assert.equal(fake.databases[0]?.closeCount, 1);
});

test('NameStatRepository removes a completed shard transport controller', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  let completedSignal: AbortSignal | null = null;
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async (_url, options) => {
      completedSignal = options?.signal ?? null;
      return response(bufferWithTag(1));
    },
  });

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  const observedSignal = requireAbortSignal(completedSignal, 'completed shard signal');
  assert.equal(observedSignal.aborted, false);

  repository.close();

  assert.equal(
    observedSignal.aborted,
    false,
    'close must not retain and abort a controller whose transport already completed',
  );
});

test('default Node file transport returns the pinned artifact and rejects fallback', async () => {
  const runtime = createRepositoryRuntime();
  const fetched = await runtime.fetch(DEFAULT_SQL_JS_WASM_URL);
  assert.equal(fetched.ok, true);
  const fetchedBytes = new Uint8Array(await fetched.arrayBuffer());
  assert.equal(fetchedBytes.byteLength, DEFAULT_SQL_JS_WASM_BYTE_LENGTH);
  assert.equal(
    createHash('sha256').update(fetchedBytes).digest('hex'),
    DEFAULT_SQL_JS_WASM_SHA256,
  );

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runtime.fetch(DEFAULT_SQL_JS_WASM_URL, { signal: controller.signal }),
    (error: unknown) => error instanceof Error && error.name === 'AbortError',
  );

  const missingUrl = new URL(
    'missing-sql-wasm-1.14.1.wasm',
    DEFAULT_SQL_JS_WASM_URL,
  ).href;
  await assert.rejects(
    runtime.fetch(missingUrl),
    (error: unknown) => error instanceof Error
      && 'code' in error
      && error.code === 'ENOENT',
  );
});

test('default sql.js loader owns one canonical retryable subscriber flight', async () => {
  const originalFetch = globalThis.fetch;
  const firstRuntime = createRepositoryRuntime();
  const secondRuntime = createRepositoryRuntime();
  let fetches = 0;

  try {
    globalThis.fetch = (async () => {
      fetches += 1;
      return response(bufferWithTag(0), 503, 'Unavailable');
    }) as unknown as typeof globalThis.fetch;
    await assert.rejects(
      firstRuntime.initializeSqlJs(
        'https://example.invalid/sql-wasm.wasm?single-flight=failure',
        DEFAULT_SQL_JS_WASM_SHA256,
      ),
      /Failed to fetch sql\.js WASM: 503 Unavailable/u,
    );
    assert.equal(fetches, 1);

    const neverFetch = new Promise<RepositoryFetchResponse>(() => {});
    let underlyingSignal: AbortSignal | undefined;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      options?: RequestInit,
    ) => {
      fetches += 1;
      underlyingSignal = options?.signal ?? undefined;
      return neverFetch;
    }) as unknown as typeof globalThis.fetch;

    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstCancellation = new Error('first subscriber closed');
    const secondCancellation = new Error('second subscriber closed');
    const first = firstRuntime.initializeSqlJs(
      'https://example.invalid/sql-wasm.wasm?single-flight=first-source',
      DEFAULT_SQL_JS_WASM_SHA256,
      { signal: firstController.signal },
    );
    const second = secondRuntime.initializeSqlJs(
      'https://example.invalid/sql-wasm.wasm?single-flight=second-source',
      DEFAULT_SQL_JS_WASM_SHA256,
      { signal: secondController.signal },
    );
    const firstOutcome = first.catch((error: unknown) => error);
    const secondOutcome = second.catch((error: unknown) => error);
    let secondSettled = false;
    void second.then(
      () => { secondSettled = true; },
      () => { secondSettled = true; },
    );
    await waitUntil(() => fetches === 2, 'the shared never-settling WASM fetch');

    firstController.abort(firstCancellation);
    assert.strictEqual(await firstOutcome, firstCancellation);
    await Promise.resolve();
    assert.equal(secondSettled, false, 'one close must not cancel an active subscriber');
    assert.equal(underlyingSignal?.aborted, false);

    secondController.abort(secondCancellation);
    assert.strictEqual(await secondOutcome, secondCancellation);
    assert.equal(underlyingSignal?.aborted, true);

    let unexpectedRemoteFetches = 0;
    globalThis.fetch = (async () => {
      unexpectedRemoteFetches += 1;
      throw new Error('a joined or cached canonical flight must not refetch another URL');
    }) as unknown as typeof globalThis.fetch;
    const [firstSql, secondSql] = await Promise.all([
      firstRuntime.initializeSqlJs(
        DEFAULT_SQL_JS_WASM_URL,
        DEFAULT_SQL_JS_WASM_SHA256,
      ),
      secondRuntime.initializeSqlJs(
        'https://example.invalid/sql-wasm.wasm?single-flight=joined-mirror',
        DEFAULT_SQL_JS_WASM_SHA256,
      ),
    ]);
    assert.equal(unexpectedRemoteFetches, 0);
    assert.strictEqual(firstSql, secondSql);

    const db = new firstSql.Database();
    try {
      db.run('CREATE TABLE file_transport_check (value INTEGER NOT NULL)');
      db.run('INSERT INTO file_transport_check VALUES (7)');
      assert.deepEqual(db.exec('SELECT value FROM file_transport_check'), [{
        columns: ['value'],
        values: [[7]],
      }]);
    } finally {
      db.close();
    }

    assert.strictEqual(
      await firstRuntime.initializeSqlJs(
        'https://example.invalid/sql-wasm.wasm?single-flight=cached-mirror',
        DEFAULT_SQL_JS_WASM_SHA256,
      ),
      firstSql,
    );
    assert.equal(unexpectedRemoteFetches, 0, 'canonical success must remain one-slot cached');

    const invalidBytes = Uint8Array.from([0, 1, 2, 3]);
    const invalidDigest = createHash('sha256').update(invalidBytes).digest('hex');
    await assert.rejects(
      firstRuntime.initializeSqlJs(
        'https://example.invalid/sql-wasm.wasm?single-flight=invalid-binary',
        invalidDigest,
      ),
      (error: unknown) => error instanceof RepositoryConfigurationError
        && error.code === 'REPOSITORY_CONFIGURATION_INVALID',
    );
    assert.equal(
      unexpectedRemoteFetches,
      0,
      'non-canonical bytes must fail before transport even after canonical success',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('custom fetches and loaders stay outside the default single-flight cache', async () => {
  const wasmBuffer = Uint8Array.from(readFileSync(new URL(DEFAULT_SQL_JS_WASM_URL))).buffer;
  let customFetches = 0;
  const customFetch = async (): Promise<RepositoryFetchResponse> => {
    customFetches += 1;
    return response(wasmBuffer);
  };
  const fetchRuntimeA = createRepositoryRuntime({ fetch: customFetch });
  const fetchRuntimeB = createRepositoryRuntime({ fetch: customFetch });
  await Promise.all([
    fetchRuntimeA.initializeSqlJs('memory://custom-fetch.wasm', DEFAULT_SQL_JS_WASM_SHA256),
    fetchRuntimeB.initializeSqlJs('memory://custom-fetch.wasm', DEFAULT_SQL_JS_WASM_SHA256),
  ]);
  assert.equal(customFetches, 2);

  const customLoaderCalls: Array<{
    readonly wasmUrl: string;
    readonly expectedSha256: string | null;
  }> = [];
  const fakeSql = createFakeSqlRuntime(HANJA_ROW).SQL;
  const customLoader = async (
    wasmUrl: string,
    expectedSha256: string | null,
  ): Promise<SqlJsStatic> => {
    customLoaderCalls.push({ wasmUrl, expectedSha256 });
    return fakeSql;
  };
  const loaderRuntimeA = createRepositoryRuntime({ initializeSqlJs: customLoader });
  const loaderRuntimeB = createRepositoryRuntime({ initializeSqlJs: customLoader });
  await Promise.all([
    loaderRuntimeA.initializeSqlJs('memory://custom-loader.wasm', null),
    loaderRuntimeB.initializeSqlJs('memory://alternate-loader.wasm', '0'.repeat(64)),
  ]);
  assert.deepEqual(customLoaderCalls, [
    {
      wasmUrl: 'memory://custom-loader.wasm',
      expectedSha256: null,
    },
    {
      wasmUrl: 'memory://alternate-loader.wasm',
      expectedSha256: '0'.repeat(64),
    },
  ]);
});

test('NameStatRepository aggregates abort and DB close failures before clean reinit', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(bufferWithTag(1)),
  });
  assert.equal((await repository.findByName(NAME))?.name, NAME);

  const abortFailure = new Error('fixture abort failed');
  const databaseCloseFailure = new Error('fixture database close failed');
  const internals = repository as unknown as {
    lifecycle: { controllers: Set<{ abort(): void }> };
    shardLoadPromiseByKey: Map<string, Promise<unknown>>;
    dbByShard: Map<string, unknown>;
  };
  internals.lifecycle.controllers.add({
    abort: () => {
      throw abortFailure;
    },
  });
  fake.databases[0]!.closeError = databaseCloseFailure;

  assert.throws(
    () => repository.close(),
    (error: unknown) => error instanceof AggregateError
      && error.errors.length === 2
      && error.errors[0] === abortFailure
      && error.errors[1] === databaseCloseFailure,
  );
  assert.equal(fake.databases[0]?.closeCount, 1);
  assert.equal(internals.lifecycle.controllers.size, 0);
  assert.equal(internals.shardLoadPromiseByKey.size, 0);
  assert.equal(internals.dbByShard.size, 0);

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  assert.equal(fake.databases.length, 2);
  repository.close();
  assert.equal(fake.databases[1]?.closeCount, 1);
});

test('NameStatRepository close clears every shard even when one database close throws', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(bufferWithTag(1)),
  });

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  const secondName = '나나';
  fake.statementPlans.push({
    row: {
      ...NAME_STAT_ROW,
      name: secondName,
      first_char: '나',
      first_choseong: 'ㄴ',
    },
  });
  assert.equal((await repository.findByName(secondName))?.name, secondName);
  assert.equal(fake.databases.length, 2);

  fake.databases[0]!.closeError = new Error('first shard close failed');
  assert.throws(
    () => repository.close(),
    (error: unknown) => error instanceof AggregateError
      && error.errors.length === 1
      && String(error.errors[0]).includes('first shard close failed'),
  );
  assert.deepEqual(
    fake.databases.slice(0, 2).map((database) => database.closeCount),
    [1, 1],
  );

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  assert.equal(fake.databases.length, 3, 'failed close must not retain any old shard');
  repository.close();
  assert.equal(fake.databases[2]?.closeCount, 1);
});

test('NameStatRepository cancels a cached-shard lookup when close wins its await', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => fake.SQL,
    fetch: async () => response(bufferWithTag(1)),
  });

  assert.equal((await repository.findByName(NAME))?.name, NAME);
  assert.equal(fake.statements.length, 1);

  const staleLookup = repository.findByName(NAME);
  repository.close();

  await assert.rejects(staleLookup, /cancelled by close/);
  assert.equal(
    fake.statements.length,
    1,
    'a stale cached-shard lookup must not prepare a statement on the closed database',
  );
  assert.equal(fake.databases[0]?.closeCount, 1);
});

test('NameStatRepository lookup rejects if close runs before its shard promise settles', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const body = deferred<ArrayBuffer>();
  let fetches = 0;
  const repository = createFakeNameStatRepository(fake, {
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
  assert.equal(
    fake.databases.length,
    0,
    'close during byte verification must prevent SQLite from opening the shard',
  );
});

test('NameStatRepository close invalidates an in-flight SQL initialization', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const firstSqlLoad = new Promise<SqlJsStatic>(() => {});
  let sqlLoads = 0;
  const repository = createFakeNameStatRepository(fake, {
    initializeSqlJs: async () => {
      sqlLoads += 1;
      return sqlLoads === 1 ? firstSqlLoad : fake.SQL;
    },
    fetch: async () => response(),
  });

  const staleInit = repository.init();
  const staleOutcome = staleInit.catch((error: unknown) => error);
  repository.close();
  assert.match(String(await staleOutcome), /cancelled by close/u);

  await repository.init();

  assert.equal(sqlLoads, 2);
  repository.close();
});

test('NameStatRepository always frees a prepared statement after bind failure', async () => {
  const fake = createFakeSqlRuntime(NAME_STAT_ROW);
  const repository = createFakeNameStatRepository(fake, {
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
  const repository = createFakeNameStatRepository(fake, {
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
