import assert from 'node:assert/strict';

import {
  SPRING_NAME_REQUEST_INVALID,
  SpringNameRequestValidationError,
  NAME_STAT_LOOKUP_UNAVAILABLE,
  NAME_STAT_SUMMARY_INTEGRITY_MISMATCH,
  NameStatLookupUnavailableError,
  NameStatSummaryIntegrityError,
  NAME_ENTRY_RESOLUTION_FAILED,
  NameEntryResolutionError,
  REPOSITORY_DATABASE_INTEGRITY_MISMATCH,
  RepositoryDatabaseIntegrityError,
  RepositoryDataError,
  SPRING_ENGINE_OPERATION_CANCELLED,
  SpringEngine,
  SpringEngineOperationCancelledError,
  emptySaju,
} from '../../src/index.js';
import {
  snapshotSajuReport,
  snapshotSpringRequest,
} from '../../src/public-request-snapshot.js';

const givenName = [
  { hangul: '\uBBFC' },
  { hangul: '\uC900' },
];

function foundEntry() {
  return {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  };
}

{
  const engine = new SpringEngine() as any;
  const integrityError = new NameStatSummaryIntegrityError(
    'compressed_sha256_mismatch',
    'expected-sha256',
    'actual-sha256',
  );
  engine.nameStatRepo = {
    findByName: async () => {
      throw integrityError;
    },
  };

  await assert.rejects(
    engine.getNameStatInfo(givenName),
    (error: unknown) => {
      assert.strictEqual(error, integrityError);
      assert.equal(error.code, NAME_STAT_SUMMARY_INTEGRITY_MISMATCH);
      assert.equal(error.retryable, false);
      assert.equal(error instanceof NameStatLookupUnavailableError, false);
      assert.equal(error.message.includes('\uBBFC\uC900'), false);
      return true;
    },
    'compact-asset integrity failures must remain original and non-retryable',
  );
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

{
  const callerRequest: any = {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uBBFC' }],
    options: { precisionConfig: { tenGodMode: 'simple_count' } },
  };
  const first = snapshotSpringRequest(callerRequest);
  const repeated = snapshotSpringRequest(first);
  assert.strictEqual(repeated, first, 'trusted snapshots must be idempotent');

  const derived = snapshotSpringRequest({
    ...first,
    givenName: [{ hangul: '\uC900' }],
  });
  assert.notStrictEqual(derived, first);
  assert.strictEqual(derived.birth, first.birth);
  assert.strictEqual(derived.options, first.options);
  assert.strictEqual(derived.surname, first.surname);
  assert.notStrictEqual(derived.givenName, first.givenName);

  const externallyFrozen: any = Object.freeze({
    birth: Object.freeze({ year: 1990, gender: 'neutral' }),
    surname: Object.freeze([{ hangul: '\uAE40' }]),
  });
  const externalSnapshot = snapshotSpringRequest(externallyFrozen);
  assert.notStrictEqual(externalSnapshot, externallyFrozen);
  assert.notStrictEqual(externalSnapshot.birth, externallyFrozen.birth);
}

{
  const invalidEndpoints: readonly [
    string,
    (engine: any, request: any) => Promise<unknown>,
  ][] = [
    ['getNamingReport', (engine, request) => engine.getNamingReport(request)],
    ['getSpringReport', (engine, request) => engine.getSpringReport(request)],
    ['getNameCandidates', (engine, request) => engine.getNameCandidates(request)],
    ['getNameCandidateSummaries', (engine, request) => engine.getNameCandidateSummaries(request)],
    ['analyze', (engine, request) => engine.analyze(request)],
    ['getFortuneReport', (engine, request) => engine.getFortuneReport(request)],
  ];

  for (const [endpoint, invoke] of invalidEndpoints) {
    const engine = new SpringEngine() as any;
    let initCalls = 0;
    let nameStatCalls = 0;
    engine.init = async () => {
      initCalls += 1;
    };
    engine.nameStatRepo = {
      findByName: async () => {
        nameStatCalls += 1;
        throw new Error('NameStat must not run for invalid public identity.');
      },
    };

    const request: any = {
      birth: {
        year: 1990,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0,
        gender: 'neutral',
      },
      surname: [{ hangul: '\uAE40' }],
      givenName: [{ hangul: 'Latin' }],
      mode: 'evaluate',
    };
    await assert.rejects(
      invoke(engine, request),
      (error: unknown) => {
        assert.ok(error instanceof NameEntryResolutionError, endpoint);
        assert.equal(error.code, NAME_ENTRY_RESOLUTION_FAILED, endpoint);
        assert.equal(error.reason, 'invalid_hangul_syllable', endpoint);
        assert.equal(error.role, 'givenName', endpoint);
        assert.equal(error.characterIndex, 0, endpoint);
        assert.equal(error.retryable, false, endpoint);
        assert.equal('hangul' in error, false, endpoint);
        assert.equal('hanja' in error, false, endpoint);
        return true;
      },
      endpoint + ' must reject invalid Hangul before infrastructure work',
    );
    assert.equal(initCalls, 0, endpoint + ' must validate before its first await');
    assert.equal(nameStatCalls, 0, endpoint + ' must not classify invalid input as not-found');
  }
}

{
  const explicitEndpoints: readonly [
    string,
    (engine: any, request: any) => Promise<unknown>,
  ][] = [
    ['getNamingReport', (engine, request) => engine.getNamingReport(request)],
    ['analyze', (engine, request) => engine.analyze(request)],
    ['getFortuneReport', (engine, request) => engine.getFortuneReport(request)],
    ['getSpringReport', (engine, request) => engine.getSpringReport(request)],
    ['getNameCandidates', (engine, request) => engine.getNameCandidates(request)],
    ['getNameCandidateSummaries', (engine, request) => engine.getNameCandidateSummaries(request)],
  ];

  for (const [endpoint, invoke] of explicitEndpoints) {
    const engine = new SpringEngine() as any;
    let nameStatCalls = 0;
    let sajuCalls = 0;
    engine.init = async () => {};
    engine.hanjaRepo = {

      findSurnamesByHangul: async (hangul: string) => [
        fakeHanjaEntry({ hangul, hanja: '\u91D1', is_surname: true }),
      ],
      findByHanja: async () => ({ hangul: '\uC900', hanja: '\u73C9' }),
      findByHangul: async () => [],
    };
    engine.nameStatRepo = {
      findByName: async () => {
        nameStatCalls += 1;
        throw new Error('NameStat must not mask an explicit-pair mismatch.');
      },
    };
    engine.getSajuReport = async () => {
      sajuCalls += 1;
      throw new Error('Saju must not precede explicit identity verification.');
    };

    const request: any = {
      birth: {
        year: 1990,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0,
        gender: 'neutral',
      },
      surname: [{ hangul: '\uAE40' }],
      givenName: [{ hangul: '\uBBFC', hanja: '\u73C9' }],
      mode: 'evaluate',
    };
    await assert.rejects(
      invoke(engine, request),
      (error: unknown) => {
        assert.ok(error instanceof NameEntryResolutionError, endpoint);
        assert.equal(error.reason, 'hangul_hanja_reading_mismatch', endpoint);
        assert.equal(error.role, 'givenName', endpoint);
        assert.equal(error.characterIndex, 0, endpoint);
        return true;
      },
      endpoint + ' must preserve explicit identity error precedence',
    );
    assert.equal(nameStatCalls, 0, endpoint);
    assert.equal(sajuCalls, 0, endpoint);
  }
}

{
  const syntaxPassed = new Error('recognized jamo reached initialization');
  const engine = new SpringEngine() as any;
  engine.init = async () => {
    throw syntaxPassed;
  };
  const request: any = {
    birth: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      gender: 'neutral',
    },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\u3141' }],
    mode: 'recommend',
  };
  await assert.rejects(
    engine.getNameCandidateSummaries(request),
    (error: unknown) => error === syntaxPassed,
    'a recognized recommendation jamo filter must remain valid',
  );
}

{
  let releaseInit!: () => void;
  const initGate = new Promise<void>((resolve) => {
    releaseInit = resolve;
  });
  const stopAfterResolution = new Error('stop after observing the resolved identity');
  const observedHanja: string[] = [];
  const observedNameStatKeys: string[] = [];
  let observedSajuRequest: any = null;
  let observedResolvedGivenName: any[] | null = null;

  const engine = new SpringEngine() as any;
  engine.init = () => initGate;
  engine.hanjaRepo = {

    findSurnamesByHangul: async (hangul: string) => [
      fakeHanjaEntry({ hangul, hanja: '\u91D1', is_surname: true }),
    ],
    findByHanja: async (hanja: string) => {
      observedHanja.push(hanja);
      return { hangul: '\uBBFC', hanja: '\u73C9' };
    },
    findByHangul: async () => [],
  };
  engine.getSajuReport = async (stableRequest: any) => {
    observedSajuRequest = stableRequest;
    return {
      ...emptySaju(),
      sajuEnabled: false,
    };
  };
  engine.nameStatRepo = {
    findByName: async (key: string) => {
      observedNameStatKeys.push(key);
      return foundEntry();
    },
  };
  engine.resolveEntries = async (chars: any[], options: any) => {
    if (options?.isSurname) return [];
    observedResolvedGivenName = chars.map((char) => ({ ...char }));
    throw stopAfterResolution;
  };

  const request: any = {
    birth: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      gender: 'neutral',
    },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uBBFC', hanja: '\u73C9' }],
    mode: 'evaluate',
    options: {
      precisionConfig: {
        tenGodMode: 'simple_count',
      },
    },
  };
  const originalGivenCharacter = request.givenName[0];
  const pending = engine.getSpringReport(request);

  originalGivenCharacter.hangul = '\uC900';
  originalGivenCharacter.hanja = '\u4FCA';
  request.givenName.push({ hangul: '\uD638' });
  request.givenName = [{ hangul: '\uC900', hanja: '\u4FCA' }];
  request.surname[0].hangul = '\uBC15';
  request.birth.year = 2001;
  request.options.precisionConfig.tenGodMode = 'positional_weighted_v2';
  releaseInit();

  await assert.rejects(
    pending,
    (error: unknown) => error === stopAfterResolution,
  );
  assert.deepEqual(observedHanja, ['\u73C9']);
  assert.deepEqual(observedNameStatKeys, ['\uBBFC']);
  assert.deepEqual(observedResolvedGivenName, [{ hangul: '\uBBFC', hanja: '\u73C9' }]);
  assert.equal(observedSajuRequest.birth.year, 1990);
  assert.equal(observedSajuRequest.surname[0].hangul, '\uAE40');
  assert.equal(observedSajuRequest.givenName[0].hangul, '\uBBFC');
  assert.equal(
    observedSajuRequest.options.precisionConfig.tenGodMode,
    'simple_count',
  );
  assert.equal(Object.isFrozen(observedSajuRequest), true);
  assert.equal(Object.isFrozen(observedSajuRequest.birth), true);
  assert.equal(Object.isFrozen(observedSajuRequest.givenName), true);
  assert.equal(Object.isFrozen(observedSajuRequest.givenName[0]), true);
  assert.equal(Object.isFrozen(observedSajuRequest.options.precisionConfig), true);
}

{
  const baseRequest = (surname: any, options: any = undefined): any => ({
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname,
    givenName: [{ hangul: '\uBBFC' }],
    ...(options === undefined ? {} : { options }),
  });

  let iteratorReads = 0;
  const iteratorArray: any[] = [{ hangul: '\uAE40' }];
  Object.defineProperty(iteratorArray, Symbol.iterator, {
    configurable: true,
    get: () => {
      iteratorReads += 1;
      throw new Error('array iterator must not be read');
    },
  });
  assert.throws(() => snapshotSpringRequest(baseRequest(iteratorArray)), TypeError);
  assert.equal(iteratorReads, 0);

  let indexGetterReads = 0;
  const accessorArray: any[] = [];
  Object.defineProperty(accessorArray, '0', {
    configurable: true,
    enumerable: true,
    get: () => {
      indexGetterReads += 1;
      return { hangul: '\uAE40' };
    },
  });
  assert.throws(() => snapshotSpringRequest(baseRequest(accessorArray)), TypeError);
  assert.equal(indexGetterReads, 0);

  const hiddenIndexArray: any[] = [];
  Object.defineProperty(hiddenIndexArray, '0', {
    configurable: true,
    enumerable: false,
    value: { hangul: '\uAE40' },
  });
  assert.throws(() => snapshotSpringRequest(baseRequest(hiddenIndexArray)), TypeError);

  const extraKeyArray: any = [{ hangul: '\uAE40' }];
  extraKeyArray.extra = true;
  assert.throws(() => snapshotSpringRequest(baseRequest(extraKeyArray)), TypeError);

  let objectGetterReads = 0;
  const accessorOptions: any = {};
  Object.defineProperty(accessorOptions, 'precisionConfig', {
    configurable: true,
    enumerable: true,
    get: () => {
      objectGetterReads += 1;
      return {};
    },
  });
  assert.throws(
    () => snapshotSpringRequest(baseRequest([{ hangul: '\uAE40' }], accessorOptions)),
    TypeError,
  );
  assert.equal(objectGetterReads, 0);

  const nonEnumerableOptions: any = {};
  Object.defineProperty(nonEnumerableOptions, 'precisionConfig', {
    configurable: true,
    enumerable: false,
    value: {},
  });
  assert.throws(
    () => snapshotSpringRequest(baseRequest([{ hangul: '\uAE40' }], nonEnumerableOptions)),
    TypeError,
  );

  let dateGetTimeCalls = 0;
  const forbiddenDate: any = new Date(0);
  Object.defineProperty(forbiddenDate, 'getTime', {
    configurable: true,
    enumerable: true,
    value: () => {
      dateGetTimeCalls += 1;
      return 0;
    },
  });
  assert.throws(
    () => snapshotSpringRequest(baseRequest(
      [{ hangul: '\uAE40' }],
      { sajuConfig: { forbiddenDate } },
    )),
    TypeError,
  );
  assert.equal(dateGetTimeCalls, 0);

  const symbolOptions: any = {};
  Object.defineProperty(symbolOptions, Symbol('hidden'), {
    configurable: true,
    enumerable: true,
    value: true,
  });
  assert.throws(
    () => snapshotSpringRequest(baseRequest([{ hangul: '\uAE40' }], symbolOptions)),
    TypeError,
  );

  const protoOptions: any = {};
  Object.defineProperty(protoOptions, '__proto__', {
    configurable: true,
    enumerable: true,
    value: { polluted: false },
  });
  const protoSnapshot: any = snapshotSpringRequest(
    baseRequest([{ hangul: '\uAE40' }], protoOptions),
  );
  assert.equal(Object.hasOwn(protoSnapshot.options, '__proto__'), true);
  assert.deepEqual(protoSnapshot.options.__proto__, { polluted: false });
  assert.equal(Object.getPrototypeOf(protoSnapshot.options), Object.prototype);
  assert.equal(({} as any).polluted, undefined);
}

{
  let releaseOverrideRead!: () => void;
  const overrideReadGate = new Promise<void>((resolve) => {
    releaseOverrideRead = resolve;
  });
  let observedOverride: any = null;
  const engine = new SpringEngine() as any;
  engine.getSpringReportFromSnapshot = async (
    _stableRequest: any,
    stableOverride: any,
  ) => {
    await overrideReadGate;
    observedOverride = stableOverride;
    return {};
  };

  const request: any = {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uBBFC' }],
  };
  const override: any = {
    ...emptySaju(),
    sajuEnabled: false,
    wrapperProbe: { value: 'A' },
    yongshin: {
      ...emptySaju().yongshin,
      jonggyeokRisk: undefined,
    },
  };
  const pending = engine.getSpringReport(request, override);
  override.wrapperProbe.value = 'B';
  releaseOverrideRead();
  await pending;
  assert.equal(observedOverride.wrapperProbe.value, 'A');
  assert.equal(Object.isFrozen(observedOverride), true);
  assert.equal(Object.isFrozen(observedOverride.wrapperProbe), true);
  assert.equal(Object.hasOwn(observedOverride.yongshin, 'jonggyeokRisk'), false);
}

{
  const engine = new SpringEngine() as any;
  const request: any = {
    birth: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      gender: 'neutral',
    },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uBBFC' }],
  };
  const producedReport = await engine.getSajuReport(request);
  let reusedReport: any = null;
  engine.getSpringReportFromSnapshot = async (
    _stableRequest: any,
    stableOverride: any,
  ) => {
    reusedReport = stableOverride;
    return {};
  };
  await engine.getSpringReport(request, producedReport);
  assert.ok(reusedReport, 'a getSajuReport result must be reusable as an override');
  assert.doesNotThrow(() => JSON.stringify(reusedReport));
}

{
  const fakeHanjaEntry = (overrides: Record<string, unknown> = {}): any => ({
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
    ...overrides,
  });
  const stopAfterGivenResolution = new Error('stop after cached given-name resolution');
  const cachedRoutes: readonly [
    string,
    (engine: any, request: any) => Promise<unknown>,
  ][] = [
    ['getNamingReport', (engine, request) => engine.getNamingReport(request)],
    ['getSpringReport', (engine, request) => engine.getSpringReport(request)],
    ['getNameCandidates', (engine, request) => engine.getNameCandidates(request)],
  ];

  for (const [route, invoke] of cachedRoutes) {
    const engine = new SpringEngine() as any;
    let findByHanjaCalls = 0;
    let surnameFindByHangulCalls = 0;
    engine.init = async () => {};
    engine.hanjaRepo = {

      findSurnamesByHangul: async (hangul: string) => [
        fakeHanjaEntry({ hangul, hanja: '\u91D1', is_surname: true }),
      ],
      findByHanja: async () => {
        findByHanjaCalls += 1;
        return fakeHanjaEntry();
      },
      findByHangul: async (hangul: string) => {
        if (hangul === '\uAE40') surnameFindByHangulCalls += 1;
        return [
          fakeHanjaEntry({ hangul, hanja: hangul === '\uAE40' ? '\u91D1' : '\u654F' }),
        ];
      },
      close: () => {},
    };
    engine.getSajuReport = async () => ({
      ...emptySaju(),
      sajuEnabled: false,
    });
    engine.nameStatRepo = {
      findByName: async () => foundEntry(),
      close: () => {},
    };

    const resolveEntries = engine.resolveEntries.bind(engine);
    engine.resolveEntries = async (chars: any[], options: any = {}, operation?: any) => {
      const resolved = await resolveEntries(chars, options, operation);
      if (!options.isSurname) throw stopAfterGivenResolution;
      assert.ok(
        resolved.every((entry: any) => entry.is_surname === true),
        route + ' must preserve the verified surname role',
      );
      return resolved;
    };

    const request: any = {
      birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
      surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
      givenName: [{ hangul: '\uBBFC', hanja: '\u654F' }],
      mode: 'evaluate',
    };
    await assert.rejects(
      invoke(engine, request),
      (error: unknown) => error === stopAfterGivenResolution,
      route,
    );
    assert.equal(
      findByHanjaCalls,
      1,
      route + ' must reuse the given-name preflight pair during resolution',
    );
    assert.equal(
      surnameFindByHangulCalls,
      1,
      route + ' must reuse the surname preflight pair during resolution',
    );
  }

  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {

    findSurnamesByHangul: async (hangul: string) => [
      fakeHanjaEntry({ hangul, hanja: '\u91D1', is_surname: true }),
    ],
    findByHanja: async () => fakeHanjaEntry(),
    findByHangul: async () => [],
    close: () => {},
  };
  const stableRequest: any = snapshotSpringRequest({
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uBBFC', hanja: '\u654F' }],
  } as any);
  const operation = engine.beginOperation('getNamingReport');
  await engine.assertExplicitRequestNameIdentity(stableRequest, operation);
  const input = stableRequest.givenName[0];
  assert.ok(engine.preverifiedExplicitNameIdentity(input, {
    role: 'givenName',
    hanjaPool: 'curated',
  }));
  assert.equal(engine.preverifiedExplicitNameIdentity(input, {
    role: 'surname',
    hanjaPool: 'curated',
  }), undefined);
  assert.equal(engine.preverifiedExplicitNameIdentity(input, {
    role: 'givenName',
    hanjaPool: 'inmyeongyong_full',
  }), undefined);
  try {
    engine.close();
  } catch {
    // Default unused repositories may reject close in isolated fixtures.
  }
  assert.equal(engine.preverifiedExplicitNameIdentity(input, {
    role: 'givenName',
    hanjaPool: 'curated',
  }), undefined);
}

{
  const publicInputError =
    'Spring public request inputs must contain only bounded JSON-compatible plain data.';
  const requestWithConfig = (sajuConfig: unknown): any => ({
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uBBFC' }],
    options: { sajuConfig },
  });
  const assertInvalidPublicInput = (sajuConfig: unknown, label: string): void => {
    assert.throws(
      () => snapshotSpringRequest(requestWithConfig(sajuConfig)),
      (error: unknown) => {
        assert.ok(error instanceof TypeError, label);
        assert.equal(error.message, publicInputError, label);
        assert.equal('cause' in error, false, label);
        return true;
      },
      label,
    );
  };

  for (const [label, value] of [
    ['bigint', 1n],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
  ] as const) {
    assertInvalidPublicInput({ value }, label);
  }

  const requestWithOptionalUndefined: any = snapshotSpringRequest(
    requestWithConfig({ omitted: undefined }),
  );
  assert.equal(
    Object.hasOwn(requestWithOptionalUndefined.options.sajuConfig, 'omitted'),
    false,
  );
  assertInvalidPublicInput(
    { values: [undefined] },
    'undefined array element',
  );

  const reportWithOptionalUndefined: any = {
    ...emptySaju(),
    sajuEnabled: false,
    optionalProbe: undefined,
    yongshin: {
      ...emptySaju().yongshin,
      jonggyeokRisk: undefined,
    },
  };
  const stableReport: any = snapshotSajuReport(reportWithOptionalUndefined);
  assert.equal(Object.hasOwn(stableReport, 'optionalProbe'), false);
  assert.equal(Object.hasOwn(stableReport.yongshin, 'jonggyeokRisk'), false);
  assert.doesNotThrow(() => JSON.stringify(stableReport));

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assertInvalidPublicInput(cyclic, 'cyclic input');

  const shared = { value: 7 };
  const sharedSnapshot: any = snapshotSpringRequest(requestWithConfig({
    first: shared,
    second: shared,
  }));
  assert.strictEqual(
    sharedSnapshot.options.sajuConfig.first,
    sharedSnapshot.options.sajuConfig.second,
    'completed shared aliases must preserve cloned identity',
  );
  assert.equal(Object.isFrozen(sharedSnapshot.options.sajuConfig.first), true);
  assert.doesNotThrow(() => JSON.stringify(sharedSnapshot));

  const denseSnapshot: any = snapshotSpringRequest(requestWithConfig({
    values: [null, 0, 'ok', true, { nested: 1 }],
  }));
  assert.deepEqual(
    denseSnapshot.options.sajuConfig.values,
    [null, 0, 'ok', true, { nested: 1 }],
  );
  assert.doesNotThrow(() => JSON.stringify(denseSnapshot));

  const sparse = new Array(2);
  sparse[1] = null;
  assertInvalidPublicInput({ sparse }, 'sparse array');
  assertInvalidPublicInput(
    { oversized: new Array(10_001).fill(null) },
    'oversized array',
  );

  let deep: Record<string, unknown> = { leaf: true };
  for (let depth = 0; depth < 70; depth += 1) deep = { next: deep };
  assertInvalidPublicInput({ deep }, 'excessive depth');

  const tooManyProperties: Record<string, number> = {};
  for (let index = 0; index <= 100_000; index += 1) {
    tooManyProperties['key' + index] = index;
  }
  assertInvalidPublicInput({ tooManyProperties }, 'property budget');

  const rawProxyMessage = 'raw-name-PII-must-not-escape';
  const throwingProxy = new Proxy({}, {
    getPrototypeOf: () => {
      throw new Error(rawProxyMessage);
    },
  });
  assertInvalidPublicInput({ throwingProxy }, 'throwing proxy');

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assertInvalidPublicInput({ revokedProxy: revoked.proxy }, 'revoked proxy');

  try {
    snapshotSpringRequest(requestWithConfig({ throwingProxy }));
    assert.fail('throwing proxy must be rejected');
  } catch (error) {
    assert.ok(error instanceof TypeError);
    assert.equal(error.message.includes(rawProxyMessage), false);
  }
}

{
  const validRequest = (): any => ({
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
    givenName: [{ hangul: '\uBBFC', hanja: '\u73C9' }],
    givenNameLength: 1,
    mode: 'evaluate',
    options: {
      pureHangulNameMode: 'off',
      useSurnameHanjaInPureHangul: false,
    },
  });
  const invalidCases: readonly [
    string,
    (request: any) => void,
    string,
    string,
  ][] = [
    ['empty surname', (request) => { request.surname = []; }, 'invalid_surname_cardinality', 'surname'],
    ['long surname', (request) => {
      request.surname = [
        { hangul: '\uAE40', hanja: '\u91D1' },
        { hangul: '\uC774', hanja: '\u674E' },
        { hangul: '\uBC15', hanja: '\u6734' },
      ];
    }, 'invalid_surname_cardinality', 'surname'],
    ['non-array surname', (request) => { request.surname = '\uAE40'; }, 'invalid_surname_cardinality', 'surname'],
    ['missing evaluation name', (request) => {
      delete request.givenName;
      delete request.givenNameLength;
    }, 'given_name_required', 'givenName'],
    ['empty supplied given name', (request) => { request.givenName = []; }, 'given_name_required', 'givenName'],
    ['long supplied given name', (request) => {
      request.givenName = Array.from(
        { length: 5 },
        () => ({ hangul: '\uBBFC', hanja: '\u73C9' }),
      );
      delete request.givenNameLength;
    }, 'invalid_given_name_cardinality', 'givenName'],
    ['non-array given name', (request) => { request.givenName = '\uBBFC'; }, 'invalid_given_name_cardinality', 'givenName'],
    ['zero given-name length', (request) => {
      delete request.givenName;
      request.givenNameLength = 0;
      request.mode = 'recommend';
    }, 'invalid_given_name_length', 'givenNameLength'],
    ['fractional given-name length', (request) => {
      delete request.givenName;
      request.givenNameLength = 1.5;
      request.mode = 'recommend';
    }, 'invalid_given_name_length', 'givenNameLength'],
    ['oversized given-name length', (request) => {
      delete request.givenName;
      request.givenNameLength = 5;
      request.mode = 'recommend';
    }, 'invalid_given_name_length', 'givenNameLength'],
    ['incoherent supplied lengths', (request) => { request.givenNameLength = 2; }, 'incoherent_given_name_length', 'givenNameLength'],
    ['evaluation generation filter', (request) => {
      request.givenName = [{ hangul: '\u3131' }];
      request.givenNameLength = 1;
      request.options.pureHangulNameMode = 'auto';
    }, 'evaluation_generation_filter_not_allowed', 'givenName'],
    ['mixed evaluation identity', (request) => {
      request.givenName = [
        { hangul: '\uBBFC', hanja: '\u73C9' },
        { hangul: '\uC218' },
      ];
      request.givenNameLength = 2;
    }, 'evaluation_name_identity_incomplete', 'givenName'],
    ['pure evaluation explicitly disabled', (request) => {
      request.givenName = [{ hangul: '\uBBFC' }];
      request.givenNameLength = 1;
      request.options.pureHangulNameMode = 'off';
    }, 'evaluation_name_identity_incomplete', 'givenName'],
    ['invalid mode enum', (request) => { request.mode = 'surprise'; }, 'invalid_mode', 'mode'],
    ['invalid pure-Hangul enum', (request) => {
      request.options.pureHangulNameMode = 'sometimes';
    }, 'invalid_pure_hangul_name_mode', 'options.pureHangulNameMode'],
    ['invalid surname-Hanja boolean', (request) => {
      request.options.useSurnameHanjaInPureHangul = 'yes';
    }, 'invalid_use_surname_hanja_in_pure_hangul', 'options.useSurnameHanjaInPureHangul'],
    ['pure-Hangul explicit-Hanja conflict', (request) => {
      request.options.pureHangulNameMode = 'on';
    }, 'pure_hangul_explicit_hanja_conflict', 'givenName'],
  ];

  for (const [label, mutate, reason, field] of invalidCases) {
    const request = validRequest();
    mutate(request);
    const engine = new SpringEngine() as any;
    let initCalls = 0;
    engine.init = async () => { initCalls += 1; };
    await assert.rejects(
      engine.getNameCandidateSummaries(request),
      (error: unknown) => {
        assert.ok(error instanceof SpringNameRequestValidationError, label);
        assert.equal(error.code, SPRING_NAME_REQUEST_INVALID, label);
        assert.equal(error.reason, reason, label);
        assert.equal(error.field, field, label);
        assert.equal(error.retryable, false, label);
        assert.equal(error.message.includes('\uAE40'), false, label);
        assert.equal(error.message.includes('\uBBFC'), false, label);
        return true;
      },
      label,
    );
    assert.equal(initCalls, 0, `${label} must fail before initialization`);
  }
}

{
  const validBase = (): any => ({
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
    givenNameLength: 1,
    mode: 'recommend',
  });
  const malformedCharacters: readonly [string, unknown][] = [
    ['null character', null],
    ['empty object', {}],
    ['boolean character', true],
    ['array Hangul', { hangul: ['\uBBFC'] }],
  ];

  for (const [label, character] of malformedCharacters) {
    const engine = new SpringEngine() as any;
    let initCalls = 0;
    engine.init = async () => { initCalls += 1; };
    await assert.rejects(
      engine.getNameCandidateSummaries({
        ...validBase(),
        givenName: [character],
      }),
      (error: unknown) => {
        assert.ok(error instanceof NameEntryResolutionError, label);
        assert.equal(error.reason, 'invalid_hangul_syllable', label);
        assert.equal(error.message.includes('\uBBFC'), false, label);
        return true;
      },
      label,
    );
    assert.equal(initCalls, 0, `${label} must fail before initialization`);
  }

  const oversizedHanja = '\u73C9'.repeat(9);
  const oversizedEngine = new SpringEngine() as any;
  let oversizedInitCalls = 0;
  oversizedEngine.init = async () => { oversizedInitCalls += 1; };
  await assert.rejects(
    oversizedEngine.getNameCandidateSummaries({
      ...validBase(),
      givenName: [{ hangul: '\uBBFC', hanja: oversizedHanja }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'invalid_hanja_character');
      assert.equal(error.message.includes('\u73C9'), false);
      return true;
    },
    'oversized Hanja must fail without trimming or retaining the raw value',
  );
  assert.equal(oversizedInitCalls, 0);
}

{
  const engine = new SpringEngine() as any;
  const pureAutoEvaluation = {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
    givenName: [{ hangul: '\uBBFC' }],
    givenNameLength: 1,
    mode: 'evaluate',
    options: { pureHangulNameMode: 'auto' },
  };
  assert.doesNotThrow(
    () => engine.assertRequestNameSyntax(pureAutoEvaluation, true),
    'the frontend native-Korean evaluate request must remain compatible',
  );
  const explicitEvaluation = {
    ...pureAutoEvaluation,
    givenName: [{ hangul: '\uBBFC', hanja: '\u73C9' }],
    options: { pureHangulNameMode: 'off' },
  };
  assert.doesNotThrow(
    () => engine.assertRequestNameSyntax(explicitEvaluation, true),
    'a fully explicit Hanja evaluation must remain compatible',
  );
}

{
  for (const [label, suppliedGivenName] of [
    ['missing', undefined],
    ['empty', []],
  ] as const) {
    const engine = new SpringEngine() as any;
    let initCalls = 0;
    engine.init = async () => { initCalls += 1; };
    const request: any = {
      birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
      surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
      ...(suppliedGivenName === undefined ? {} : { givenName: suppliedGivenName }),
      mode: 'evaluate',
      options: { pureHangulNameMode: 'off' },
    };
    await assert.rejects(
      engine.getNamingReport(request),
      (error: unknown) => {
        assert.ok(error instanceof SpringNameRequestValidationError, label);
        assert.equal(error.code, SPRING_NAME_REQUEST_INVALID, label);
        assert.equal(error.reason, 'given_name_required', label);
        assert.equal(error.field, 'givenName', label);
        return true;
      },
      `getNamingReport ${label} givenName`,
    );
    assert.equal(initCalls, 0, `getNamingReport ${label} givenName must fail before init`);
  }
}

console.log('Name-stat fail-closed contract: PASS');
