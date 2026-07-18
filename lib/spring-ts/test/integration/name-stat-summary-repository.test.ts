import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

import { NAME_STAT_SUMMARY_ASSET_PROVENANCE } from '../../src/name-stat-summary-asset.generated.js';
import {
  type NameStatSummaryAssetProvenance,
  NAME_STAT_SUMMARY_SCHEMA_VERSION,
} from '../../src/name-stat-summary-contract.js';
import {
  NAME_STAT_SUMMARY_INTEGRITY_MISMATCH,
  NameStatSummaryIntegrityError,
  NameStatSummaryRepository,
  type NameStatSummaryRepositoryRuntime,
} from '../../src/name-stat-summary-repository.js';
import { NameStatLookupUnavailableError } from '../../src/name-stat-contract.js';
import {
  SpringEngine,
  SpringEngineOperationCancelledError,
} from '../../src/spring-engine.js';
import {
  FOURFRAME_LUCKY_LEVELS,
  FOURFRAME_MAX_NUMBER,
} from '../../src/fourframe-contract.js';
import type { FourframeMeaningEntry } from '../../../seed-ts/src/database/fourframe-repository.js';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail('Timed out waiting for the repository checkpoint.');
}

interface FakeHttpStreamState {
  readCalls: number;
  getReaderCalls: number;
  cancelCalls: number;
}

function fakeHttpResponse(
  chunks: readonly Uint8Array[],
  declaredLength?: string,
): { readonly response: Response; readonly state: FakeHttpStreamState } {
  const state: FakeHttpStreamState = {
    readCalls: 0,
    getReaderCalls: 0,
    cancelCalls: 0,
  };
  let cursor = 0;
  const body = {
    cancel: async (): Promise<void> => {
      state.cancelCalls += 1;
    },
    getReader: () => {
      state.getReaderCalls += 1;
      return {
        read: async () => {
          state.readCalls += 1;
          if (cursor >= chunks.length) {
            return { done: true as const, value: undefined };
          }
          const value = chunks[cursor++]!;
          return { done: false as const, value };
        },
        cancel: async (): Promise<void> => {
          state.cancelCalls += 1;
        },
        releaseLock: (): void => undefined,
      };
    },
  };
  return {
    response: {
      ok: true,
      status: 200,
      headers: new Headers(
        declaredLength === undefined
          ? undefined
          : { 'content-length': declaredLength },
      ),
      body,
    } as unknown as Response,
    state,
  };
}

async function withFetchResponse<T>(
  response: Response,
  operation: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => response) as typeof fetch;
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function customProvenance(
  compressedBytes: Uint8Array,
  canonicalBytes: Uint8Array,
  rowCount = 1,
  sourceAssetSetSha256 = 'a'.repeat(64),
): NameStatSummaryAssetProvenance {
  return {
    ...NAME_STAT_SUMMARY_ASSET_PROVENANCE,
    sourceAssetSetSha256,
    rowCount,
    canonicalJsonByteLength: canonicalBytes.byteLength,
    canonicalJsonSha256: sha256(canonicalBytes),
    compressedByteLength: compressedBytes.byteLength,
    compressedSha256: sha256(compressedBytes),
  };
}

function injectedAsset(
  compressedBytes: Uint8Array,
  canonicalBytes: Uint8Array,
): Partial<NameStatSummaryRepositoryRuntime> {
  return {
    readAsset: async () => compressedBytes.slice(),
    gunzip: async () => canonicalBytes.slice(),
  };
}

async function expectIntegrityReason(
  repository: NameStatSummaryRepository,
  reason: NameStatSummaryIntegrityError['reason'],
): Promise<void> {
  await assert.rejects(repository.findByName('민준'), (error: unknown) => {
    assert.ok(error instanceof NameStatSummaryIntegrityError);
    assert.equal(error.code, NAME_STAT_SUMMARY_INTEGRITY_MISMATCH);
    assert.equal(error.reason, reason);
    assert.equal(error.retryable, false);
    assert.equal(error.message.includes('민준'), false);
    return true;
  });
}

const committedBytes = new Uint8Array(
  fs.readFileSync(new URL(
    '../../data/name-stat/name-stat-summary.v1.bin',
    import.meta.url,
  )),
);
const committedCanonicalBytes = new Uint8Array(gunzipSync(committedBytes));
const compactGivenName = [
  { hangul: '\uAE30' },
  { hangul: '\uD0C0' },
] as const;

function makeValidFourFrameRecords(): FourframeMeaningEntry[] {
  return Array.from({ length: FOURFRAME_MAX_NUMBER }, (_, index) => {
    const number = index + 1;
    return {
      id: number,
      number,
      title: `Frame ${number}`,
      summary: `Summary ${number}`,
      detailed_explanation: '',
      positive_aspects: '',
      caution_points: '',
      personality_traits: [],
      suitable_career: [],
      life_period_influence: '',
      special_characteristics: '',
      challenge_period: '',
      opportunity_area: '',
      lucky_level:
        FOURFRAME_LUCKY_LEVELS[index % FOURFRAME_LUCKY_LEVELS.length],
    };
  });
}

function installEngineRepositories(
  engine: SpringEngine,
  nameStatRepository: NameStatSummaryRepository,
): void {
  Object.assign(engine as any, {
    hanjaRepo: {
      init: async () => undefined,
      close: () => undefined,
    },
    fourFrameRepo: {
      init: async () => undefined,
      findAll: async (limit: number) => {
        assert.equal(limit, 82);
        return makeValidFourFrameRecords();
      },
      close: () => undefined,
    },
    nameStatRepo: nameStatRepository,
  });
}

test('loads the committed asset into an owned O(1) lookup record', async () => {
  const repository = new NameStatSummaryRepository();
  const first = await repository.findByName('기타');
  const internal = (repository as any).entriesByName as Record<string, unknown>;
  assert.equal(
    Object.keys(internal).length,
    NAME_STAT_SUMMARY_ASSET_PROVENANCE.rowCount,
  );
  assert.deepEqual(first, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  (first as any).maleBirths = 999;
  assert.deepEqual(await repository.findByName('기타'), {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.equal(await repository.findByName('존재하지않는이름'), null);

  let ownKeysCalls = 0;
  (repository as any).entriesByName = new Proxy(internal, {
    ownKeys: () => {
      ownKeysCalls += 1;
      throw new Error('lookup must not enumerate the complete dataset');
    },
  });
  assert.deepEqual(await repository.findByName('기타'), {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.equal(ownKeysCalls, 0);
  repository.close();
});

test('SpringEngine preserves 기타 as found rather than negative-caching it', async () => {
  const engine = new SpringEngine() as any;
  const result = await engine.getNameStatInfo([
    { hangul: '기' },
    { hangul: '타' },
  ]);
  assert.deepEqual(result, {
    status: 'found',
    popularityRank: null,
    maleRatio: null,
    nameGender: 'unknown',
  });
  engine.close();
});

test('init remains lazy and concurrent lookups share one verified load', async () => {
  const gate = deferred<Uint8Array>();
  let readCount = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => {
        readCount += 1;
        return gate.promise;
      },
    },
  });

  await repository.init();
  assert.equal(readCount, 0, 'SpringEngine init must not fetch NameStat bytes');

  const first = repository.findByName('기타');
  const sharedLoad = (repository as any).loadPromise;
  const second = repository.findByName('기타');
  assert.strictEqual((repository as any).loadPromise, sharedLoad);
  assert.equal(readCount, 1);
  assert.equal((repository as any).entriesByName, null);

  gate.resolve(committedBytes);
  assert.deepEqual(await first, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.deepEqual(await second, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.equal(
    Object.keys((repository as any).entriesByName).length,
    NAME_STAT_SUMMARY_ASSET_PROVENANCE.rowCount,
  );
  repository.close();
});

test('SpringEngine init keeps the compact repository lazy and retries transient reads', async () => {
  const transient = new Error('temporary compact asset read failure');
  let readCount = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => {
        readCount += 1;
        if (readCount === 1) throw transient;
        return committedBytes;
      },
    },
  });
  const engine = new SpringEngine();
  installEngineRepositories(engine, repository);
  const internalEngine = engine as any;

  await engine.init();
  assert.equal(readCount, 0, 'SpringEngine init must not fetch compact NameStat bytes');

  await assert.rejects(
    internalEngine.getNameStatInfo(compactGivenName),
    (error: unknown) => {
      assert.ok(error instanceof NameStatLookupUnavailableError);
      assert.strictEqual(error.cause, transient);
      assert.equal(error.retryable, true);
      return true;
    },
  );
  assert.equal(internalEngine.nameStatInfoCache.size, 0);

  const recovered = await internalEngine.getNameStatInfo(compactGivenName);
  assert.deepEqual(recovered, {
    status: 'found',
    popularityRank: null,
    maleRatio: null,
    nameGender: 'unknown',
  });
  assert.equal(Object.isFrozen(recovered), true);
  assert.throws(() => {
    (recovered as any).popularityRank = 999;
  }, TypeError);
  assert.strictEqual(
    await internalEngine.getNameStatInfo(compactGivenName),
    recovered,
    'the frozen successful result should be reused from the engine cache',
  );
  assert.equal(readCount, 2, 'a transient read failure must remain retryable');
  engine.close();
});

test('SpringEngine close cancels an actual compact read without stale cache publication', async () => {
  const firstRead = deferred<Uint8Array>();
  let readCount = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => {
        readCount += 1;
        return readCount === 1 ? firstRead.promise : committedBytes;
      },
    },
  });
  const engine = new SpringEngine();
  installEngineRepositories(engine, repository);
  const internalEngine = engine as any;

  await engine.init();
  const stale = internalEngine.getNameStatInfo(compactGivenName);
  await waitFor(() => readCount === 1);
  engine.close();

  await assert.rejects(
    stale,
    (error: unknown) => {
      assert.ok(error instanceof SpringEngineOperationCancelledError);
      assert.equal(error.operation, 'name-stat-lookup');
      assert.equal(error.retryable, false);
      return true;
    },
  );
  assert.equal(internalEngine.nameStatInfoCache.size, 0);
  firstRead.resolve(committedBytes);

  const current = await internalEngine.getNameStatInfo(compactGivenName);
  assert.equal(current.status, 'found');
  assert.equal(readCount, 2, 'the new engine lifecycle must start a fresh asset read');
  assert.equal(internalEngine.nameStatInfoCache.size, 1);
  engine.close();
});

test('does not retain transient read failures and retries on the next init', async () => {
  const transient = new Error('temporary asset read failure');
  let readCount = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => {
        readCount += 1;
        if (readCount === 1) throw transient;
        return committedBytes;
      },
    },
  });

  await assert.rejects(
    repository.findByName('기타'),
    (error: unknown) => error === transient,
  );
  assert.equal((repository as any).entriesByName, null);
  await repository.findByName('기타');
  assert.equal(readCount, 2);
  assert.deepEqual(await repository.findByName('기타'), {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  repository.close();
});

test('owns fetched bytes before an asynchronous digest boundary', async () => {
  const borrowed = committedBytes.slice();
  const digestGate = deferred<void>();
  let digestCalls = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => borrowed,
      sha256: async (bytes) => {
        digestCalls += 1;
        if (digestCalls === 1) await digestGate.promise;
        return sha256(bytes);
      },
    },
  });

  const lookup = repository.findByName('기타');
  await waitFor(() => digestCalls === 1);
  borrowed[0] ^= 0xff;
  digestGate.resolve();
  assert.deepEqual(await lookup, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  repository.close();
});

test('close cancels an ignored read and prevents stale publication', async () => {
  const firstRead = deferred<Uint8Array>();
  let readCount = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => {
        readCount += 1;
        return readCount === 1 ? firstRead.promise : committedBytes;
      },
    },
  });

  const stale = repository.findByName('기타');
  repository.close();
  await assert.rejects(stale, /cancelled by close/u);
  assert.equal((repository as any).entriesByName, null);
  firstRead.resolve(committedBytes);

  await repository.findByName('기타');
  assert.equal(readCount, 2);
  assert.equal(
    Object.keys((repository as any).entriesByName).length,
    NAME_STAT_SUMMARY_ASSET_PROVENANCE.rowCount,
  );
  repository.close();
});

test('close settles immediately during digest and a newer load still publishes', async () => {
  const firstDigest = deferred<string>();
  let digestCalls = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => committedBytes,
      sha256: async (bytes) => {
        digestCalls += 1;
        if (digestCalls === 1) return firstDigest.promise;
        return sha256(bytes);
      },
    },
  });

  const stale = repository.findByName('기타');
  await waitFor(() => digestCalls === 1);
  repository.close();
  await assert.rejects(stale, /cancelled by close/u);

  const current = repository.findByName('기타');
  firstDigest.resolve(NAME_STAT_SUMMARY_ASSET_PROVENANCE.compressedSha256);
  assert.deepEqual(await current, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.ok(digestCalls >= 3);
  repository.close();
});

test('close settles immediately during gunzip and cannot erase the newer flight', async () => {
  const firstGunzip = deferred<Uint8Array>();
  let gunzipCalls = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => committedBytes,
      sha256: async (bytes) => sha256(bytes),
      gunzip: async () => {
        gunzipCalls += 1;
        if (gunzipCalls === 1) return firstGunzip.promise;
        return committedCanonicalBytes;
      },
    },
  });

  const stale = repository.findByName('기타');
  await waitFor(() => gunzipCalls === 1);
  repository.close();
  await assert.rejects(stale, /cancelled by close/u);

  const current = repository.findByName('기타');
  const newerFlight = (repository as any).loadPromise;
  firstGunzip.resolve(committedCanonicalBytes);
  assert.deepEqual(await current, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.notEqual(newerFlight, null);
  assert.equal((repository as any).loadPromise, null);
  repository.close();
});

test('rejects altered compressed bytes before attempting gzip', async () => {
  const corrupted = committedBytes.slice();
  corrupted[corrupted.length - 1] ^= 0xff;
  let gunzipCalls = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => corrupted,
      gunzip: async () => {
        gunzipCalls += 1;
        return new Uint8Array();
      },
    },
  });

  await expectIntegrityReason(repository, 'compressed_sha256_mismatch');
  assert.equal(gunzipCalls, 0);
});

test('rejects truncated compressed bytes before hashing or gzip', async () => {
  let shaCalls = 0;
  let gunzipCalls = 0;
  const repository = new NameStatSummaryRepository({
    runtime: {
      readAsset: async () => committedBytes.subarray(0, committedBytes.length - 1),
      sha256: async () => {
        shaCalls += 1;
        return 'a'.repeat(64);
      },
      gunzip: async () => {
        gunzipCalls += 1;
        return new Uint8Array();
      },
    },
  });

  await expectIntegrityReason(repository, 'compressed_byte_length_mismatch');
  assert.equal(shaCalls, 0);
  assert.equal(gunzipCalls, 0);
});

test('fails closed at gzip, UTF-8, JSON, schema, and canonical-format layers', async () => {
  const compressedBytes = Uint8Array.of(1, 2, 3);

  {
    const canonicalBytes = new TextEncoder().encode('{}\n');
    const repository = new NameStatSummaryRepository({
      provenance: customProvenance(compressedBytes, canonicalBytes),
      runtime: {
        readAsset: async () => compressedBytes,
        gunzip: async () => {
          throw new Error('invalid deflate stream');
        },
      },
    });
    await expectIntegrityReason(repository, 'gzip_invalid');
  }

  for (const [reason, canonicalBytes] of [
    ['utf8_invalid', Uint8Array.of(0xff)],
    ['json_invalid', new TextEncoder().encode('not-json\n')],
    ['contract_invalid', new TextEncoder().encode('{"bad":true}\n')],
  ] as const) {
    const repository = new NameStatSummaryRepository({
      provenance: customProvenance(compressedBytes, canonicalBytes),
      runtime: injectedAsset(compressedBytes, canonicalBytes),
    });
    await expectIntegrityReason(repository, reason);
  }

  const sourceAssetSetSha256 = 'b'.repeat(64);
  const document = {
    schemaVersion: NAME_STAT_SUMMARY_SCHEMA_VERSION,
    sourceAssetSetSha256,
    rowCount: 1,
    entries: { 가: [1, 2, 3] },
  };
  const nonCanonicalBytes = new TextEncoder().encode(
    `${JSON.stringify(document, null, 2)}\n`,
  );
  const repository = new NameStatSummaryRepository({
    provenance: customProvenance(
      compressedBytes,
      nonCanonicalBytes,
      1,
      sourceAssetSetSha256,
    ),
    runtime: injectedAsset(compressedBytes, nonCanonicalBytes),
  });
  await expectIntegrityReason(repository, 'canonical_format_mismatch');
});

test('versions HTTP asset requests with the authenticated compressed digest', async () => {
  let observedUrl!: URL;
  const repository = new NameStatSummaryRepository({
    assetUrl: new URL('https://example.test/name-stat-summary.v1.bin'),
    runtime: {
      readAsset: async (url) => {
        observedUrl = new URL(url);
        return committedBytes;
      },
    },
  });

  await repository.findByName('기타');
  assert.equal(
    observedUrl.searchParams.get('v'),
    NAME_STAT_SUMMARY_ASSET_PROVENANCE.compressedSha256,
  );
  assert.equal(observedUrl.pathname, '/name-stat-summary.v1.bin');
  repository.close();
});

test('default HTTP reader rejects a mismatched declared size before acquiring a reader', async () => {
  for (const declaredLength of [
    NAME_STAT_SUMMARY_ASSET_PROVENANCE.compressedByteLength - 1,
    NAME_STAT_SUMMARY_ASSET_PROVENANCE.compressedByteLength + 1,
  ]) {
    const { response, state } = fakeHttpResponse([], String(declaredLength));
    const repository = new NameStatSummaryRepository({
      assetUrl: new URL('https://example.test/name-stat-summary.v1.bin'),
    });

    await withFetchResponse(response, async () => {
      await expectIntegrityReason(repository, 'compressed_byte_length_mismatch');
    });
    assert.equal(state.getReaderCalls, 0);
    assert.equal(state.readCalls, 0);
    assert.equal(state.cancelCalls, 1);
    repository.close();
  }
});

test('default HTTP reader cancels as soon as streamed bytes exceed provenance', async () => {
  const provenance = {
    ...NAME_STAT_SUMMARY_ASSET_PROVENANCE,
    compressedByteLength: 3,
  };
  const { response, state } = fakeHttpResponse([
    Uint8Array.of(1, 2),
    Uint8Array.of(3, 4),
    Uint8Array.of(5),
  ]);
  const repository = new NameStatSummaryRepository({
    assetUrl: new URL('https://example.test/name-stat-summary.v1.bin'),
    provenance,
  });

  await withFetchResponse(response, async () => {
    await expectIntegrityReason(repository, 'compressed_byte_length_mismatch');
  });
  assert.equal(state.getReaderCalls, 1);
  assert.equal(state.readCalls, 2, 'the reader must stop at the first oversized chunk');
  assert.equal(state.cancelCalls, 1);
  repository.close();
});

test('default HTTP reader accepts the exact committed asset size', async () => {
  const splitAt = Math.floor(committedBytes.byteLength / 2);
  const { response, state } = fakeHttpResponse(
    [committedBytes.slice(0, splitAt), committedBytes.slice(splitAt)],
    String(committedBytes.byteLength),
  );
  const repository = new NameStatSummaryRepository({
    assetUrl: new URL('https://example.test/name-stat-summary.v1.bin'),
  });

  const projection = await withFetchResponse(
    response,
    () => repository.findByName('\uAE30\uD0C0'),
  );
  assert.deepEqual(projection, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.equal(state.getReaderCalls, 1);
  assert.equal(state.readCalls, 3);
  assert.equal(state.cancelCalls, 0);
  repository.close();
});

test('close aborts the default HTTP body reader and preserves lifecycle cancellation', async () => {
  const state: FakeHttpStreamState = {
    readCalls: 0,
    getReaderCalls: 0,
    cancelCalls: 0,
  };
  let settleRead: ((value: { done: true; value: undefined }) => void) | undefined;
  const response = {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: {
      cancel: async (): Promise<void> => {
        state.cancelCalls += 1;
      },
      getReader: () => {
        state.getReaderCalls += 1;
        return {
          read: () => {
            state.readCalls += 1;
            return new Promise<{ done: true; value: undefined }>((resolve) => {
              settleRead = resolve;
            });
          },
          cancel: async (): Promise<void> => {
            state.cancelCalls += 1;
            settleRead?.({ done: true, value: undefined });
          },
          releaseLock: (): void => undefined,
        };
      },
    },
  } as unknown as Response;
  const repository = new NameStatSummaryRepository({
    assetUrl: new URL('https://example.test/name-stat-summary.v1.bin'),
  });

  await withFetchResponse(response, async () => {
    const lookup = repository.findByName('\uAE30\uD0C0');
    await waitFor(() => state.readCalls === 1);
    repository.close();
    await assert.rejects(lookup, /cancelled by close/u);
  });
  assert.equal(state.getReaderCalls, 1);
  assert.equal(state.cancelCalls, 1);
});
