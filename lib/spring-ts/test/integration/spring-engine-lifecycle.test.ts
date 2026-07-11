import assert from 'node:assert/strict';

import { FourFrameContractError } from '../../src/fourframe-contract.js';
import {
  SPRING_ENGINE_INIT_CANCELLED,
  SpringEngine,
  SpringEngineInitializationCancelledError,
} from '../../src/spring-engine.js';
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
assert.equal((engine as any).fourFrameMeaningByNumber.size, 81);
assert.ok((engine as any).validFourFrameNumbers.size > 0);
assert.ok((engine as any).optimizer);
assert.equal((engine as any).initPromise, null);

engine.close();
assert.equal((engine as any).initialized, false);
assert.equal((engine as any).luckyMap.size, 0);
assert.equal((engine as any).fourFrameMeaningByNumber.size, 0);
assert.equal((engine as any).validFourFrameNumbers.size, 0);
assert.equal((engine as any).optimizer, null);
assert.deepEqual(closeCounts, { hanja: 2, fourFrame: 2, nameStat: 2 });

let records = makeValidFourFrameRecords().slice(0, -1);
const validationEngine = new SpringEngine();
installRepositories(validationEngine, async () => records);
await assert.rejects(validationEngine.init(), FourFrameContractError);
assert.equal((validationEngine as any).initialized, false);
assert.equal((validationEngine as any).luckyMap.size, 0);
assert.equal((validationEngine as any).fourFrameMeaningByNumber.size, 0);
assert.equal((validationEngine as any).validFourFrameNumbers.size, 0);
assert.equal((validationEngine as any).optimizer, null);
assert.equal((validationEngine as any).initPromise, null);

records = makeValidFourFrameRecords();
await validationEngine.init();
assert.equal((validationEngine as any).initialized, true);
assert.equal((validationEngine as any).luckyMap.size, 81);
validationEngine.close();

console.log('SpringEngine lifecycle: identity/generation/atomic-publish/retry PASS');
