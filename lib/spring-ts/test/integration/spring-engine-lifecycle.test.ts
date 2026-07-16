import assert from 'node:assert/strict';

import { FourFrameContractError } from '../../src/fourframe-contract.js';
import {
  SPRING_ENGINE_OPERATION_CANCELLED,
  SPRING_ENGINE_INIT_CANCELLED,
  SpringEngine,
  SpringEngineInitializationCancelledError,
  SpringEngineOperationCancelledError,
} from '../../src/spring-engine.js';
import { emptySaju } from '../../src/saju-adapter.js';
import type { SpringRequest } from '../../src/types.js';
import { makeValidFourFrameRecords } from '../helpers/fourframe-fixtures.js';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail('Timed out waiting for async initialization checkpoint.');
}

function installRepositories(
  engine: SpringEngine,
  findAll: (limit: number) => Promise<ReturnType<typeof makeValidFourFrameRecords>>,
): { readonly closeCounts: Record<string, number> } {
  const closeCounts = { hanja: 0, fourFrame: 0, nameStat: 0 };
  Object.assign(engine as any, {
    hanjaRepo: {
      init: async () => undefined,
      close: () => { closeCounts.hanja += 1; },
    },
    fourFrameRepo: {
      init: async () => undefined,
      findAll,
      close: () => { closeCounts.fourFrame += 1; },
    },
    nameStatRepo: {
      init: async () => undefined,
      close: () => { closeCounts.nameStat += 1; },
    },
  });
  return { closeCounts };
}

async function expectOperationCancelled(
  promise: Promise<unknown>,
  operation: string,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SpringEngineOperationCancelledError);
    assert.equal(error.code, SPRING_ENGINE_OPERATION_CANCELLED);
    assert.equal(error.operation, operation);
    assert.equal(error.retryable, false);
    return true;
  });
}

async function readyEngine(): Promise<SpringEngine> {
  const engine = new SpringEngine();
  installRepositories(engine, async () => makeValidFourFrameRecords());
  await engine.init();
  return engine;
}

const lifecycleRequest: SpringRequest = {
  birth: {
    year: 1990,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    gender: 'neutral',
  },
  surname: [{ hangul: '\uAE40' }],
  givenName: [{ hangul: '\uBBFC' }, { hangul: '\uC900' }],
  mode: 'evaluate',
  options: { pureHangulNameMode: 'auto' },
};

const lifecycleRepositoryLookupRequest: SpringRequest = {
  ...lifecycleRequest,
  surname: [{ hangul: String.fromCodePoint(0xAE40), hanja: String.fromCodePoint(0x91D1) }],
};

function foundNameStatEntry() {
  return {
    name: '\uBBFC\uC900',
    first_char: '\uBBFC',
    first_choseong: '',
    similar_names: [],
    yearly_rank: {},
    yearly_birth: {},
    hanja_combinations: [],
    raw_entry: {},
  };
}

const firstLoad = deferred<ReturnType<typeof makeValidFourFrameRecords>>();
const secondLoad = deferred<ReturnType<typeof makeValidFourFrameRecords>>();
let loadCalls = 0;
const engine = new SpringEngine();
const { closeCounts } = installRepositories(engine, async (limit) => {
  assert.equal(limit, 82);
  loadCalls += 1;
  return loadCalls === 1 ? firstLoad.promise : secondLoad.promise;
});

const firstInit = engine.init();
assert.strictEqual(engine.init(), firstInit, 'concurrent callers must share the exact init promise');
await waitFor(() => loadCalls === 1);
assert.equal((engine as any).initialized, false);
assert.equal((engine as any).luckyMap.size, 0);

engine.close();
const secondInit = engine.init();
await waitFor(() => loadCalls === 2);

firstLoad.resolve(makeValidFourFrameRecords());
await assert.rejects(firstInit, (error: unknown) => {
  assert.ok(error instanceof SpringEngineInitializationCancelledError);
  assert.equal(error.code, SPRING_ENGINE_INIT_CANCELLED);
  return true;
});
assert.strictEqual(
  (engine as any).initPromise,
  secondInit,
  'late completion must not clear the newer init promise',
);
assert.equal((engine as any).initialized, false);
assert.equal((engine as any).luckyMap.size, 0);

secondLoad.resolve(makeValidFourFrameRecords());
await secondInit;
assert.equal((engine as any).initialized, true);
assert.equal((engine as any).luckyMap.size, 81);
assert.ok((engine as any).validFourFrameNumbers.size > 0);
assert.ok((engine as any).optimizer);
assert.equal((engine as any).initPromise, null);

engine.close();
assert.equal((engine as any).initialized, false);
assert.equal((engine as any).luckyMap.size, 0);
assert.equal((engine as any).validFourFrameNumbers.size, 0);
assert.equal((engine as any).optimizer, null);
assert.deepEqual(closeCounts, { hanja: 2, fourFrame: 2, nameStat: 2 });

let records = makeValidFourFrameRecords().slice(0, -1);
const validationEngine = new SpringEngine();
installRepositories(validationEngine, async () => records);
await assert.rejects(validationEngine.init(), FourFrameContractError);
assert.equal((validationEngine as any).initialized, false);
assert.equal((validationEngine as any).luckyMap.size, 0);
assert.equal((validationEngine as any).validFourFrameNumbers.size, 0);
assert.equal((validationEngine as any).optimizer, null);
assert.equal((validationEngine as any).initPromise, null);

records = makeValidFourFrameRecords();
await validationEngine.init();
assert.equal((validationEngine as any).initialized, true);
assert.equal((validationEngine as any).luckyMap.size, 81);
validationEngine.close();

// A public operation that crosses close() must expose the stable outer-route
// cancellation contract, even when the in-flight repository rejects with an
// unrelated low-level error after it has been closed.
{
  const operationEngine = await readyEngine() as any;
  const lookup = deferred<never>();
  const rawRepositoryError = new Error('database handle was closed');
  let lookupCalls = 0;
  operationEngine.hanjaRepo = {
    findByHangul: async () => {
      lookupCalls += 1;
      return lookup.promise;
    },
    close: () => undefined,
  };

  // Pure-Hangul evaluation deliberately avoids repository lookup. Pin an
  // explicit surname here so this cancellation test still crosses a real
  // identity-authority repository boundary before close().
  const pending = operationEngine.getNamingReport(lifecycleRepositoryLookupRequest);
  await waitFor(() => lookupCalls === 1);
  operationEngine.close();
  lookup.reject(rawRepositoryError);

  await expectOperationCancelled(pending, 'getNamingReport');
}

// Name-entry memoization belongs to one operation lease. Warm stale leases
// must still cancel, concurrent operations must stay isolated, and a lookup
// that crosses close() must not publish or leak into the next lifecycle.
{
  const cacheEngine = new SpringEngine() as any;
  const pendingLookup = deferred<any>();
  const callsByKey = new Map<string, number>();
  const entry = {
    id: 1,
    hangul: '\uBBFC',
    hanja: '\u654F',
    onset: '\u3141',
    nucleus: '\u3163',
    strokes: 11,
    stroke_element: 'Wood',
    resource_element: 'Water',
    meaning: 'verified',
    radical: '\u6534',
    is_surname: false,
  };
  cacheEngine.hanjaRepo = {
    findByHanja: async (hanja: string) => {
      const calls = (callsByKey.get(hanja) ?? 0) + 1;
      callsByKey.set(hanja, calls);
      if (hanja === '\u4E26' && calls === 1) return pendingLookup.promise;
      return { ...entry, hanja };
    },
    findByHangul: async () => [],
    close: () => undefined,
  };

  const warmLease = cacheEngine.beginOperation('getNameCandidates');
  const warmRepository = cacheEngine.operationNameEntryRepository(warmLease);
  await warmRepository.findByHanja('\u654F');
  await warmRepository.findByHanja('\u654F');
  assert.equal(callsByKey.get('\u654F'), 1);

  const parallelLease = cacheEngine.beginOperation('getNameCandidateSummaries');
  const parallelRepository = cacheEngine.operationNameEntryRepository(parallelLease);
  await parallelRepository.findByHanja('\u654F');
  assert.equal(
    callsByKey.get('\u654F'),
    2,
    'separate operation leases must not share lookup authority',
  );

  cacheEngine.close();
  await expectOperationCancelled(
    warmRepository.findByHanja('\u654F'),
    'getNameCandidates',
  );
  assert.equal(callsByKey.get('\u654F'), 2, 'a stale cache hit must not reach the delegate');

  const pendingLease = cacheEngine.beginOperation('getNameCandidates');
  const pendingRepository = cacheEngine.operationNameEntryRepository(pendingLease);
  const pending = pendingRepository.findByHanja('\u4E26');
  await waitFor(() => callsByKey.get('\u4E26') === 1);
  cacheEngine.close();
  pendingLookup.resolve({ ...entry, hanja: '\u4E26' });
  await expectOperationCancelled(pending, 'getNameCandidates');

  const currentLease = cacheEngine.beginOperation('getNameCandidates');
  const currentRepository = cacheEngine.operationNameEntryRepository(currentLease);
  assert.equal((await currentRepository.findByHanja('\u4E26'))?.hanja, '\u4E26');
  assert.equal(
    callsByKey.get('\u4E26'),
    2,
    'a cancelled pending lookup must not populate the next lifecycle cache',
  );
  cacheEngine.close();
}

// Saju-only analysis deliberately does not initialize database repositories,
// but it is still a SpringEngine operation and must not publish a stale result.
{
  const sajuEngine = new SpringEngine() as any;
  let initCalls = 0;
  sajuEngine.init = async () => { initCalls += 1; };

  const pending = sajuEngine.getSajuReport(lifecycleRequest);
  sajuEngine.close();

  await expectOperationCancelled(pending, 'getSajuReport');
  assert.equal(initCalls, 0, 'getSajuReport must preserve its no-database-init contract');
}

// Every database-backed public route captures its lease before awaiting init.
// This table makes adding a guard to only some entry points a visible failure.
{
  const initBoundOperations: ReadonlyArray<readonly [
    string,
    (engine: any) => Promise<unknown>,
  ]> = [
    ['getNamingReport', engine => engine.getNamingReport(lifecycleRequest)],
    ['getSpringReport', engine => engine.getSpringReport(lifecycleRequest)],
    ['getNameCandidates', engine => engine.getNameCandidates(lifecycleRequest)],
    ['getNameCandidateSummaries', engine => engine.getNameCandidateSummaries(lifecycleRequest)],
    ['analyze', engine => engine.analyze(lifecycleRequest)],
    ['getFortuneReport', engine => engine.getFortuneReport({ birth: lifecycleRequest.birth })],
  ];

  for (const [operation, start] of initBoundOperations) {
    const routeEngine = new SpringEngine() as any;
    const initGate = deferred<void>();
    let initCalls = 0;
    routeEngine.init = () => {
      initCalls += 1;
      return initGate.promise;
    };

    const pending = start(routeEngine);
    await waitFor(() => initCalls === 1);
    routeEngine.close();
    initGate.resolve();
    await expectOperationCancelled(pending, operation);
  }
}

// A lookup from an older lifecycle must not populate the cache after close()
// and a successful reinitialization. The next lifecycle must query again.
{
  const cacheEngine = new SpringEngine() as any;
  installRepositories(cacheEngine, async () => makeValidFourFrameRecords());
  const staleLookup = deferred<ReturnType<typeof foundNameStatEntry>>();
  let lookupCalls = 0;
  cacheEngine.nameStatRepo = {
    init: async () => undefined,
    findByName: async () => {
      lookupCalls += 1;
      return lookupCalls === 1 ? staleLookup.promise : foundNameStatEntry();
    },
    close: () => undefined,
  };
  cacheEngine.getSajuReport = async () => ({
    ...emptySaju(),
    sajuEnabled: false,
  });
  await cacheEngine.init();

  const pending = cacheEngine.getSpringReport(lifecycleRequest);
  await waitFor(() => lookupCalls === 1);
  cacheEngine.close();
  await cacheEngine.init();
  staleLookup.resolve(foundNameStatEntry());

  await expectOperationCancelled(pending, 'getSpringReport');
  assert.equal(cacheEngine.nameStatInfoCache.size, 0);

  const current = await cacheEngine.getNameStatInfo(lifecycleRequest.givenName);
  assert.equal(current.status, 'found');
  assert.equal(lookupCalls, 2, 'the new lifecycle must not reuse a stale lookup result');
  cacheEngine.close();
}

// Without a lifecycle change, operation guards must preserve the original
// domain/infrastructure error rather than relabeling every rejection.
{
  const errorEngine = await readyEngine() as any;
  const rawRepositoryError = new Error('repository read failed');
  errorEngine.hanjaRepo = {
    findByHangul: async () => { throw rawRepositoryError; },
    close: () => undefined,
  };

  await assert.rejects(
    errorEngine.getNamingReport(lifecycleRepositoryLookupRequest),
    (error: unknown) => error === rawRepositoryError,
  );
  errorEngine.close();
}

console.log('SpringEngine lifecycle: init/operation generation/atomic-publish/retry PASS');
