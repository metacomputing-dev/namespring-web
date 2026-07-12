import assert from 'node:assert/strict';

import {
  NAME_STAT_LOOKUP_UNAVAILABLE,
  NameStatLookupUnavailableError,
  REPOSITORY_DATABASE_INTEGRITY_MISMATCH,
  RepositoryDatabaseIntegrityError,
  RepositoryDataError,
  SPRING_ENGINE_OPERATION_CANCELLED,
  SpringEngine,
  SpringEngineOperationCancelledError,
  emptySaju,
} from '../../src/index.js';

const givenName = [
  { hangul: '\uBBFC' },
  { hangul: '\uC900' },
];

function foundEntry() {
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

{
  const engine = new SpringEngine() as any;
  const repositoryFailure = new Error('temporary shard fetch failure');
  let calls = 0;
  engine.nameStatRepo = {
    findByName: async () => {
      calls += 1;
      if (calls === 1) throw repositoryFailure;
      return foundEntry();
    },
  };

  await assert.rejects(
    engine.getNameStatInfo(givenName),
    (error: unknown) => {
      assert.ok(error instanceof NameStatLookupUnavailableError);
      assert.equal(error.code, NAME_STAT_LOOKUP_UNAVAILABLE);
      assert.equal(error.retryable, true);
      assert.equal('givenName' in error, false, 'errors must not expose the personal name');
      assert.equal(error.cause, repositoryFailure);
      return true;
    },
  );

  const recovered = await engine.getNameStatInfo(givenName);
  assert.equal(recovered.status, 'found');
  assert.equal(calls, 2, 'a transient failure must not be negative-cached');

  const cached = await engine.getNameStatInfo(givenName);
  assert.equal(cached.status, 'found');
  assert.equal(calls, 2, 'successful lookups should remain cacheable');
}

{
  const engine = new SpringEngine() as any;
  const integrityError = new RepositoryDatabaseIntegrityError(
    'name-stat-08',
    'sha256_mismatch',
    'expected-sha256',
    'actual-sha256',
  );
  let calls = 0;
  engine.nameStatRepo = {
    findByName: async () => {
      calls += 1;
      if (calls === 1) throw integrityError;
      return foundEntry();
    },
  };

  await assert.rejects(
    engine.getNameStatInfo(givenName),
    (error: unknown) => {
      assert.strictEqual(error, integrityError);
      assert.ok(error instanceof RepositoryDatabaseIntegrityError);
      assert.equal(error.code, REPOSITORY_DATABASE_INTEGRITY_MISMATCH);
      assert.equal(error.retryable, false);
      assert.equal(error instanceof NameStatLookupUnavailableError, false);
      return true;
    },
    'database-integrity errors must remain original and non-retryable',
  );

  const recovered = await engine.getNameStatInfo(givenName);
  assert.equal(recovered.status, 'found');
  assert.equal(calls, 2, 'an integrity failure must not publish or cache lookup data');
}

{
  const engine = new SpringEngine() as any;
  let calls = 0;
  engine.nameStatRepo = {
    findByName: async () => {
      calls += 1;
      return null;
    },
  };

  const first = await engine.getNameStatInfo(givenName);
  const second = await engine.getNameStatInfo(givenName);
  assert.equal(first.status, 'not_found');
  assert.equal(second.status, 'not_found');
  assert.equal(calls, 1, 'an authoritative not-found result may be cached');
}

{
  const engine = new SpringEngine() as any;
  engine.nameStatRepo = {
    findByName: async () => {
      throw new Error('database unavailable');
    },
  };

  await assert.rejects(
    engine.filterCandidatesByNameStat([givenName], 'neutral'),
    NameStatLookupUnavailableError,
    'candidate filtering must stop instead of silently deleting candidates',
  );
}

{
  const engine = new SpringEngine() as any;
  engine.init = async () => {};
  engine.getSajuReport = async () => ({
    ...emptySaju(),
    sajuEnabled: false,
  });
  engine.nameStatRepo = {
    findByName: async () => {
      throw new Error('database unavailable');
    },
  };

  await assert.rejects(
    engine.getSpringReport({
      birth: {
        year: 1990,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0,
        gender: 'neutral',
      },
      surname: [{ hangul: '\uAE40' }],
      givenName,
      mode: 'evaluate',
    }),
    NameStatLookupUnavailableError,
    'explicit evaluation must surface name-stat unavailability',
  );
}

{
  const engine = new SpringEngine() as any;
  const dataError = new RepositoryDataError(
    'name-stat',
    'row.yearly_birth_json.male.2020',
    'expected a finite non-negative safe integer',
  );
  engine.nameStatRepo = {
    findByName: async () => {
      throw dataError;
    },
  };

  await assert.rejects(
    engine.getNameStatInfo(givenName),
    (error: unknown) => {
      assert.strictEqual(error, dataError);
      assert.equal(error instanceof NameStatLookupUnavailableError, false);
      assert.equal(dataError.retryable, false);
      return true;
    },
    'data-integrity errors must not be relabeled as retryable infrastructure failures',
  );
}

{
  const engine = new SpringEngine() as any;
  let calls = 0;
  let resolveFirst!: (value: ReturnType<typeof foundEntry>) => void;
  const firstLookup = new Promise<ReturnType<typeof foundEntry>>((resolve) => {
    resolveFirst = resolve;
  });
  engine.nameStatRepo = {
    findByName: async () => {
      calls += 1;
      return calls === 1 ? firstLookup : foundEntry();
    },
    close: () => {},
  };

  const staleLookup = engine.getNameStatInfo(givenName);
  engine.close();
  resolveFirst(foundEntry());

  await assert.rejects(
    staleLookup,
    (error: unknown) => {
      assert.ok(error instanceof SpringEngineOperationCancelledError);
      assert.equal(error.code, SPRING_ENGINE_OPERATION_CANCELLED);
      assert.equal(error.operation, 'name-stat-lookup');
      assert.equal(error.retryable, false);
      return true;
    },
    'a lookup that crosses close() must be cancelled instead of publishing stale data',
  );
  assert.equal(engine.nameStatInfoCache.size, 0, 'a stale continuation must not resurrect the cache');

  const current = await engine.getNameStatInfo(givenName);
  assert.equal(current.status, 'found');
  assert.equal(calls, 2, 'the new lifecycle must query the repository again');
}

console.log('Name-stat fail-closed contract: PASS');
