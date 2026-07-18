import assert from 'node:assert/strict';

import { parseJamoFilter } from '../../src/core/name-utils.js';
import {
  assertExplicitNameIdentity,
  assertNameCharacterSyntax,
  resolveFixedNameCharacterPool,
  resolveNameEntries,
} from '../../src/name-entry-resolver.js';
import {
  createOperationNameEntryCache,
  createOperationNameEntryRepository,
} from '../../src/operation-name-entry-repository.js';
import {
  NAME_ENTRY_RESOLUTION_FAILED,
  NameEntryResolutionError,
  SpringEngine,
} from '../../src/spring-engine.js';

function fakeEntry(overrides: Record<string, unknown> = {}): any {
  return {
    id: 1,
    hangul: '민',
    hanja: '敏',
    onset: 'ㅁ',
    nucleus: 'ㅣ',
    strokes: 11,
    stroke_element: 'Wood',
    resource_element: 'Water',
    meaning: '민첩할 민',
    radical: '攴',
    is_surname: false,
    ...overrides,
  };
}

{
  let byHanjaCalls = 0;
  let byHangulCalls = 0;
  let surnameCalls = 0;
  let surnameRejectedCalls = 0;
  let rejectedCalls = 0;
  let concurrentCalls = 0;
  const concurrentResolvers: Array<(entry: any) => void> = [];
  const delegate = {
    findByHanja: async (hanja: string) => {
      if (hanja === '\u4E0D') {
        rejectedCalls += 1;
        if (rejectedCalls === 1) throw new Error('transient lookup failure');
        return fakeEntry({ hanja });
      }
      if (hanja === '\u4E26') {
        concurrentCalls += 1;
        return new Promise<any>((resolve) => concurrentResolvers.push(resolve));
      }
      byHanjaCalls += 1;
      return hanja === '\u7121' ? null : fakeEntry({ hanja });
    },
    findByHangul: async (hangul: string) => {
      byHangulCalls += 1;
      return hangul === '\uC5C6' ? [] : [fakeEntry({ hangul })];
    },
    findSurnamesByHangul: async (hangul: string) => {
      if (hangul === '\uC7AC') {
        surnameRejectedCalls += 1;
        if (surnameRejectedCalls === 1) throw new Error('transient surname failure');
      }
      surnameCalls += 1;
      return hangul === '\uBB34'
        ? []
        : [fakeEntry({ hangul, is_surname: true })];
    },
  };
  const repository = createOperationNameEntryRepository(
    delegate,
    createOperationNameEntryCache(),
    async <T>(work: () => Promise<T>): Promise<T> => work(),
  );

  const firstEntry = await repository.findByHanja('\u654F');
  (firstEntry as any).meaning = 'caller mutation';
  const secondEntry = await repository.findByHanja('\u654F');
  assert.equal(byHanjaCalls, 1, 'settled Hanja values must be cached by exact key');
  assert.equal(secondEntry?.meaning, '\uBBFC\uCCA9\uD560 \uBBFC');

  assert.equal(await repository.findByHanja('\u7121'), null);
  assert.equal(await repository.findByHanja('\u7121'), null);
  assert.equal(byHanjaCalls, 2, 'null must be a stable negative-cache value');

  const firstRows = await repository.findByHangul('\uBBFC');
  (firstRows[0] as any).meaning = 'caller mutation';
  firstRows.pop();
  const secondRows = await repository.findByHangul('\uBBFC');
  assert.equal(byHangulCalls, 1, 'settled Hangul rows must be cached by exact key');
  assert.equal(secondRows.length, 1);
  assert.equal(secondRows[0]?.meaning, '\uBBFC\uCCA9\uD560 \uBBFC');

  assert.deepEqual(await repository.findByHangul('\uC5C6'), []);
  assert.deepEqual(await repository.findByHangul('\uC5C6'), []);
  assert.equal(byHangulCalls, 2, 'empty row sets must be negative-cached');

  assert.ok(repository.findSurnamesByHangul);
  const firstSurnames = await repository.findSurnamesByHangul('\uCD5C');
  (firstSurnames[0] as any).meaning = 'caller mutation';
  firstSurnames.pop();
  const secondSurnames = await repository.findSurnamesByHangul('\uCD5C');
  assert.equal(surnameCalls, 1, 'settled surname rows must be cached by exact key');
  assert.equal(secondSurnames.length, 1);
  assert.equal(secondSurnames[0]?.meaning, '\uBBFC\uCCA9\uD560 \uBBFC');

  assert.deepEqual(await repository.findSurnamesByHangul('\uBB34'), []);
  assert.deepEqual(await repository.findSurnamesByHangul('\uBB34'), []);
  assert.equal(surnameCalls, 2, 'empty surname row sets must be negative-cached');

  await assert.rejects(
    repository.findSurnamesByHangul('\uC7AC'),
    /transient surname failure/,
  );
  assert.equal(
    (await repository.findSurnamesByHangul('\uC7AC'))[0]?.hangul,
    '\uC7AC',
  );
  assert.equal(surnameRejectedCalls, 2, 'rejected surname lookups must remain retryable');

  await assert.rejects(repository.findByHanja('\u4E0D'), /transient lookup failure/);
  assert.equal((await repository.findByHanja('\u4E0D'))?.hanja, '\u4E0D');
  assert.equal(rejectedCalls, 2, 'rejected lookups must remain retryable');

  const concurrentA = repository.findByHanja('\u4E26');
  const concurrentB = repository.findByHanja('\u4E26');
  await Promise.resolve();
  assert.equal(
    concurrentCalls,
    2,
    'in-flight lookups must not be coalesced or cached before settlement',
  );
  concurrentResolvers[0]?.(fakeEntry({ hanja: '\u4E26' }));
  concurrentResolvers[1]?.(fakeEntry({ hanja: '\u4E26' }));
  await Promise.all([concurrentA, concurrentB]);
}

{
  let active = true;
  const repository = createOperationNameEntryRepository(
    {
      findByHanja: async () => fakeEntry(),
      findByHangul: async () => [],
    },
    createOperationNameEntryCache(),
    async <T>(work: () => Promise<T>): Promise<T> => {
      if (!active) throw new Error('operation cancelled before lookup');
      const resolved = await work();
      if (!active) throw new Error('operation cancelled after lookup');
      return resolved;
    },
  );
  const pending = repository.findByHanja('\u654F');
  queueMicrotask(() => {
    active = false;
  });
  await assert.rejects(
    pending,
    /operation cancelled after lookup/,
    'a lifecycle cancellation queued during a resolved lookup must win before publication',
  );
}

{
  const exact = fakeEntry({ is_surname: true });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => exact,
    findByHangul: async () => [exact],
  };

  const resolved = await engine.resolveEntries([{ hangul: '민', hanja: '敏' }]);
  assert.deepEqual(
    resolved,
    [{ ...exact, hangul: '민', is_surname: false }],
    'a given-name pair must normalize a surname-flagged repository row to its request role',
  );
}

{
  const homophone = fakeEntry({ id: 2, hanja: '珉', meaning: '옥돌 민' });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => null,
    findByHangul: async () => [homophone],
  };

  await assert.rejects(
    engine.resolveEntries([{ hangul: '민', hanja: '旻' }]),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.code, NAME_ENTRY_RESOLUTION_FAILED);
      assert.equal(error.reason, 'explicit_hanja_not_found');
      assert.equal(error.role, 'givenName');
      assert.equal(error.characterIndex, 0);
      assert.equal(error.retryable, false);
      assert.equal(error.message.includes('민'), false, 'error must not expose the name');
      assert.equal(error.message.includes('旻'), false, 'error must not expose the Hanja');
      return true;
    },
    'an unverified explicit Hanja must not be replaced by a homophone',
  );
}

{
  const mismatchedReading = fakeEntry({
    hangul: '매',
    hanja: '敏',
    onset: 'ㅁ',
    nucleus: 'ㅐ',
  });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => mismatchedReading,
    findByHangul: async () => [],
  };

  await assert.rejects(
    engine.resolveEntries([{ hangul: '민', hanja: '敏' }]),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'hangul_hanja_reading_mismatch');
      assert.equal(error.role, 'givenName');
      assert.equal(error.characterIndex, 0);
      return true;
    },
    'a Hanja row with a different reading must fail closed',
  );
}

{
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => null,
    findByHangul: async () => [],
  };

  await assert.rejects(
    engine.resolveFixedCharPool({ hangul: '민', hanja: '旻' }, 'curated'),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'explicit_hanja_not_found');
      return true;
    },
    'the fixed-character path must apply the same explicit-pair policy',
  );
}

{
  const firstReading = fakeEntry({
    hangul: '매',
    hanja: '敏',
    onset: 'ㅁ',
    nucleus: 'ㅐ',
  });
  const exactAlternateReading = fakeEntry({ id: 3 });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => firstReading,
    findByHangul: async () => [exactAlternateReading],
  };

  const resolved = await engine.resolveEntries([{ hangul: '민', hanja: '敏' }]);
  assert.deepEqual(
    resolved,
    [{ ...exactAlternateReading, is_surname: false }],
    'an exact alternate reading must use the internally consistent DB row',
  );
}

{
  const exact = fakeEntry();
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => exact,
    findByHangul: async () => [exact],
  };

  const fixed = await engine.resolveFixedCharPool({ hangul: '민', hanja: '敏' }, 'curated');
  assert.deepEqual(
    fixed,
    [{ ...exact, hangul: '민', is_surname: false }],
    'a verified internally fixed candidate must retain its existing byte shape',
  );
}

{
  const canonicalPair = fakeEntry({
    id: 10,
    hangul: '김',
    hanja: '金',
    is_surname: false,
  });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => canonicalPair,
    findByHangul: async () => [canonicalPair],
    findSurnamesByHangul: async () => [],
  };

  const resolved = await engine.resolveEntries(
    [{ hangul: '김', hanja: '金' }],
    { isSurname: true },
  );
  assert.deepEqual(resolved, [{ ...canonicalPair, is_surname: true }]);
  assert.equal(
    resolved[0].is_surname,
    true,
    'the immutable surname registry must establish eligibility for an exact pair',
  );
}

{
  const firstExactRow = fakeEntry({
    id: 11,
    hangul: '김',
    hanja: '金',
    is_surname: false,
  });
  const duplicateEligibleRow = fakeEntry({
    id: 12,
    hangul: '김',
    hanja: '金',
    is_surname: true,
  });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => firstExactRow,
    findByHangul: async () => [firstExactRow],
    findSurnamesByHangul: async () => [duplicateEligibleRow],
  };

  const resolved = await engine.resolveEntries(
    [{ hangul: '김', hanja: '金' }],
    { isSurname: true },
  );
  assert.deepEqual(resolved, [{ ...firstExactRow, is_surname: true }]);
}
{
  const eligibleSurname = fakeEntry({
    id: 13,
    hangul: '\uAE40',
    hanja: '\u91D1',
    is_surname: true,
  });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => null,
    findByHangul: async () => [eligibleSurname],
    findSurnamesByHangul: async () => [eligibleSurname],
  };
  const resolved = await engine.resolveEntries(
    [{ hangul: '\uAE40' }],
    { isSurname: true },
  );
  assert.deepEqual(resolved, [eligibleSurname]);
}

{
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => null,
    findByHangul: async () => [],
    findSurnamesByHangul: async () => [
      fakeEntry({ id: 14, hangul: '\uB958', hanja: '\u67F3', is_surname: true }),
      fakeEntry({ id: 15, hangul: '\uB958', hanja: '\u5289', is_surname: true }),
    ],
  };
  await assert.rejects(
    engine.resolveEntries([{ hangul: '\uB958' }], { isSurname: true }),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'ambiguous_surname_hanja');
      return true;
    },
    'ambiguous surname readings must require explicit Hanja',
  );
}

{
  const inferred = fakeEntry();
  const engine = new SpringEngine() as any;
  let inferenceCalls = 0;
  engine.hanjaRepo = {
    findByHanja: async () => inferred,
    findByHangul: async () => {
      inferenceCalls += 1;
      return [inferred];
    },
    findSurnamesByHangul: async () => [],
  };

  for (const [label, input] of [
    ['missing', { hangul: '\uBBFC' }],
    ['empty', { hangul: '\uBBFC', hanja: '' }],
    ['Hangul placeholder', { hangul: '\uBBFC', hanja: '\uBBFC' }],
  ] as const) {
    await assert.rejects(
      engine.resolveEntries([input]),
      (error: unknown) => {
        assert.ok(error instanceof NameEntryResolutionError, label);
        assert.equal(error.reason, 'explicit_hanja_required', label);
        assert.equal(error.role, 'givenName', label);
        assert.equal(error.characterIndex, 0, label);
        return true;
      },
      `${label} Hanja must not be inferred in a non-pure evaluation`,
    );
  }
  assert.equal(inferenceCalls, 0, 'non-pure evaluation must not choose findByHangul()[0]');

  const pure = await engine.resolveEntries(
    [{ hangul: '\uBBFC' }],
    { forceHangulOnly: true },
  );
  assert.equal(pure[0].hangul, '\uBBFC');
  assert.equal(pure[0].hanja, '');
}

{
  const expanded = fakeEntry();
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => null,
    findByHangul: async () => [expanded],
    findSurnamesByHangul: async () => [],
  };
  const pool = await engine.resolveFixedCharPool({ hangul: '\uBBFC' }, 'curated');
  assert.deepEqual(pool, [expanded], 'recommendation fixed-character expansion must remain supported');
}

{
  const malformed: readonly [string, any, 'invalid_hangul_syllable' | 'invalid_hanja_character'][] = [
    ['array Hangul', { hangul: ['\uBBFC'] }, 'invalid_hangul_syllable'],
    ['boolean Hangul', { hangul: true }, 'invalid_hangul_syllable'],
    ['array Hanja', { hangul: '\uBBFC', hanja: ['\u73C9'] }, 'invalid_hanja_character'],
    ['non-Han Hanja', { hangul: '\uBBFC', hanja: 'A' }, 'invalid_hanja_character'],
    ['multi-glyph Hanja', { hangul: '\uBBFC', hanja: '\u73C9\u654F' }, 'invalid_hanja_character'],
  ];
  for (const [label, input, reason] of malformed) {
    assert.throws(
      () => assertNameCharacterSyntax([input], { role: 'givenName' }),
      (error: unknown) => {
        assert.ok(error instanceof NameEntryResolutionError, label);
        assert.equal(error.reason, reason, label);
        assert.equal(error.role, 'givenName', label);
        assert.equal(error.characterIndex, 0, label);
        assert.equal(error.message.includes('\uBBFC'), false, label);
        assert.equal(error.message.includes('\u73C9'), false, label);
        return true;
      },
      label,
    );
  }
}

{
  assert.deepEqual(parseJamoFilter('\u3131'), { onset: '\u3131' });
  assert.deepEqual(parseJamoFilter('\u314F'), { nucleus: '\u314F' });
  assert.equal(parseJamoFilter(''), null, 'empty input must never become an empty filter');
  assert.equal(
    parseJamoFilter('\uAC00'.repeat(1_000_000)),
    null,
    'oversized input must fail in constant auxiliary space',
  );
  assert.equal(parseJamoFilter('\u3133'), null, 'unsupported compatibility jamo must fail');
  assert.equal(
    parseJamoFilter('\uAC00'),
    null,
    'a precomposed no-coda Hangul syllable is a literal reading, not a jamo filter',
  );
}

{
  const surname = fakeEntry({
    id: 20,
    hangul: '\uAE40',
    hanja: '\u91D1',
    is_surname: true,
  });
  const fixedGivenName = fakeEntry({
    id: 21,
    hangul: '\uBBFC',
    hanja: '\u73C9',
    meaning: '\uBC1D\uC744 \uBBFC',
    is_surname: false,
  });
  const engine = new SpringEngine() as any;
  let optimizerCalls = 0;
  engine.optimizer = {
    getValidCombinations: () => {
      optimizerCalls += 1;
      return ['11'];
    },
  };
  engine.hanjaRepo = {
    findByHanja: async (hanja: string) => hanja === '\u91D1' ? surname : null,
    findByHangul: async (hangul: string) => hangul === '\uBBFC' ? [fixedGivenName] : [],
    findSurnamesByHangul: async () => [surname],
    findByStrokeRange: async () => [fixedGivenName],
  };
  const request: any = {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
    givenName: [{ hangul: '\uBBFC' }],
    givenNameLength: 1,
    mode: 'recommend',
  };
  const sajuSummary: any = {
    yongshin: { element: 'WOOD', heeshin: null, gishin: null, gushin: null },
    deficientElements: [],
    excessiveElements: [],
  };
  const positionFilters = [parseJamoFilter('\uBBFC')];
  assert.deepEqual(positionFilters, [null]);
  const generated = await engine.generateCandidates(
    request,
    sajuSummary,
    positionFilters,
  );
  assert.equal(optimizerCalls, 0, 'a literal Hangul position must not enter stroke optimization');
  assert.ok(generated.length > 0);
  assert.ok(generated.every(
    (candidate: any[]) => candidate.length === 1 && candidate[0].hangul === '\uBBFC',
  ));

  let forwardedFilters: unknown;
  engine.generateCandidates = async (
    _request: unknown,
    _summary: unknown,
    filters: unknown,
  ) => {
    forwardedFilters = filters;
    return [];
  };
  engine.filterCandidatesByNameStat = async (candidates: unknown[]) => candidates;
  const operation = engine.beginOperation('getNameCandidates');
  const defaultPlan = engine.buildNameInputPlan(request);
  const collectedDefault = await engine.collectNameInputs(
    request,
    defaultPlan,
    sajuSummary,
    new Map(),
    operation,
  );
  assert.deepEqual(
    forwardedFilters,
    [null],
    'literal Hangul constraints must reach the position-pool generator',
  );
  assert.deepEqual(
    collectedDefault,
    [],
    'default literal constraints must not be prepended as a pure-Hangul candidate',
  );

  const pureRequest = {
    ...request,
    options: { pureHangulNameMode: 'on' },
  };
  const collectedPure = await engine.collectNameInputs(
    pureRequest,
    engine.buildNameInputPlan(pureRequest),
    sajuSummary,
    new Map(),
    operation,
  );
  assert.deepEqual(
    collectedPure,
    [pureRequest.givenName],
    'explicit pure-Hangul recommendation mode may retain the caller name',
  );

  const mixedRequest = {
    ...request,
    givenName: [
      { hangul: '\uBBFC', hanja: '\u73C9' },
      { hangul: '\uC218' },
    ],
    givenNameLength: 2,
  };
  const generatedMixed = [[
    { hangul: '\uBBFC', hanja: '\u73C9' },
    { hangul: '\uC218', hanja: '\u79C0' },
  ]];
  engine.generateCandidates = async () => generatedMixed;
  const collectedMixed = await engine.collectNameInputs(
    mixedRequest,
    engine.buildNameInputPlan(mixedRequest),
    sajuSummary,
    new Map(),
    operation,
  );
  assert.deepEqual(collectedMixed, generatedMixed);
  assert.equal(collectedMixed.includes(mixedRequest.givenName), false);
}

{
  const safe = fakeEntry({ id: 30, hangul: '\uBBFC', hanja: '\u73C9', meaning: '\uBC1D\uC744 \uBBFC' });
  const surnameOnly = fakeEntry({ id: 31, hangul: '\uBBFC', hanja: '\u9594', meaning: '\uBC1D\uC744 \uBBFC', is_surname: true });
  const unsafe = fakeEntry({ id: 32, hangul: '\uBBFC', hanja: '\u65FB', meaning: '\uC8FD\uC744 \uBBFC' });
  const opaque = fakeEntry({ id: 33, hangul: '\uBBFC', hanja: '\u6C11', meaning: '\uBBFC' });
  const weak = fakeEntry({ id: 34, hangul: '\uBBFC', hanja: '\u654F', meaning: '\uBBFC\uCCA9\uD560 \uBBFC' });
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHangul: async () => [surnameOnly, unsafe, opaque, weak, safe],
    findByStrokeRange: async () => [],
  };
  const request: any = {
    givenName: [{ hangul: '\uBBFC' }],
    options: { pureHangulNameMode: 'auto' },
  };
  const rejections = new Map();
  const pools = await engine.buildJamoBasedPools(
    request, 1, [null], new Set(), new Set(), 'curated', rejections,
  );
  assert.deepEqual(pools.get(0), [surnameOnly, safe]);
  assert.equal(rejections.get('unsafe_hanja_meaning')?.count, 1);
  assert.equal(rejections.get('opaque_hanja_meaning')?.count, 1);
  assert.equal(rejections.get('weak_hanja_meaning')?.count, 1);

  engine.hanjaRepo.findByHangul = async () => [];
  const noFallbackPools = await engine.buildJamoBasedPools(
    request, 1, [null], new Set(), new Set(), 'curated', new Map(),
  );
  assert.deepEqual(noFallbackPools.get(0), []);

  const pureRequest = {
    ...request,
    options: { pureHangulNameMode: 'on' },
  };
  const purePools = await engine.buildJamoBasedPools(
    pureRequest, 1, [null], new Set(), new Set(), 'curated', new Map(),
  );
  assert.equal(purePools.get(0)?.length, 1);
  assert.equal(purePools.get(0)?.[0]?.hangul, '\uBBFC');
  assert.equal(purePools.get(0)?.[0]?.hanja, '');
}

{
  const safe = fakeEntry({
    id: 90, hangul: '\uBBFC', hanja: '\u73C9', meaning: '\uBC1D\uC744 \uBBFC',
  });
  const unsafeRows = Array.from({ length: 8 }, (_, index) => fakeEntry({
    id: 100 + index,
    hangul: '\uBBFC',
    hanja: String.fromCodePoint(0x4E20 + index),
    meaning: '\uC8FD\uC744 \uBBFC',
  }));
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHangul: async () => [...unsafeRows, safe],
    findByStrokeRange: async () => [],
  };
  const request: any = {
    givenName: [{ hangul: '\uBBFC' }],
    options: { pureHangulNameMode: 'auto' },
  };
  const pools = await engine.buildJamoBasedPools(
    request, 1, [null], new Set(), new Set(), 'curated', new Map(),
  );
  assert.deepEqual(pools.get(0), [safe], 'safe rows after the first eight must backfill');

  engine.hanjaRepo.findByHangul = async () => [safe];
  request.options.pureHangulNameMode = 'on';
  const purePools = await engine.buildJamoBasedPools(
    request, 1, [null], new Set(), new Set(), 'curated', new Map(),
  );
  assert.deepEqual(
    purePools.get(0)?.map(({ hangul, hanja }: any) => ({ hangul, hanja })),
    [{ hangul: '\uBBFC', hanja: '' }],
    'pure-Hangul on must not prefer a registered Hanja row',
  );
}

{
  const recognizedPua = String.fromCodePoint(0xF04C4);
  assert.doesNotThrow(() => assertNameCharacterSyntax([
    { hangul: '\uC9D1', hanja: String.fromCodePoint(0xA022D) },
    { hangul: '\uB839', hanja: recognizedPua },
  ], { role: 'givenName' }));

  let puaFindByHanjaCalls = 0;
  let puaFindByHangulCalls = 0;
  const puaEngine = new SpringEngine() as any;
  puaEngine.hanjaRepo = {
    findByHanja: async () => {
      puaFindByHanjaCalls += 1;
      throw new Error('recognized PUA must not cross the Seed Hanja query boundary');
    },
    findByHangul: async () => {
      puaFindByHangulCalls += 1;
      throw new Error('recognized PUA must resolve from the active full pool');
    },
  };

  for (const hangul of ['\uB839', '\uC601']) {
    const [resolved] = await puaEngine.resolveEntries(
      [{ hangul, hanja: recognizedPua }],
      { hanjaPool: 'inmyeongyong_full' },
    );
    assert.equal(resolved.hangul, hangul);
    assert.equal(resolved.hanja, recognizedPua);
    assert.equal(resolved.is_surname, false);
  }

  await assert.rejects(
    puaEngine.resolveEntries(
      [{ hangul: '\uB839', hanja: recognizedPua }],
      { hanjaPool: 'curated' },
    ),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'explicit_hanja_not_found');
      return true;
    },
    'a recognized PUA glyph must remain unavailable outside the active full pool',
  );

  await assert.rejects(
    puaEngine.resolveEntries(
      [{ hangul: '\uB155', hanja: recognizedPua }],
      { hanjaPool: 'inmyeongyong_full' },
    ),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'hangul_hanja_reading_mismatch');
      return true;
    },
    'a recognized PUA glyph with an unsupported reading must fail as a mismatch',
  );

  await assert.rejects(
    puaEngine.resolveEntries(
      [{ hangul: '\uC9D1', hanja: String.fromCodePoint(0xE000) }],
      { hanjaPool: 'inmyeongyong_full' },
    ),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'invalid_hanja_character');
      return true;
    },
    'an arbitrary PUA glyph must fail before any repository query',
  );
  assert.equal(puaFindByHanjaCalls, 0);
  assert.equal(puaFindByHangulCalls, 0);

  let surnameRepositoryCalls = 0;
  const surnamePuaEngine = new SpringEngine() as any;
  surnamePuaEngine.hanjaRepo = {
    findByHanja: async () => {
      surnameRepositoryCalls += 1;
      throw new Error('unverified surname PUA must not reach findByHanja');
    },
    findByHangul: async () => {
      surnameRepositoryCalls += 1;
      throw new Error('unverified surname PUA must not reach findByHangul');
    },
  };
  await assert.rejects(
    surnamePuaEngine.resolveEntries(
      [{ hangul: '\uAE40', hanja: recognizedPua }],
      { isSurname: true, hanjaPool: 'inmyeongyong_full' },
    ),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'unverified_single_surname');
      assert.equal(error.role, 'surname');
      return true;
    },
    'a PUA surname outside the static authority registry must fail before repository lookup',
  );
  assert.equal(surnameRepositoryCalls, 0);

  let ordinaryFindByHanjaCalls = 0;
  const ordinary = fakeEntry({ hangul: '\uBBFC', hanja: '\u654F' });
  puaEngine.hanjaRepo = {
    findByHanja: async (hanja: string) => {
      ordinaryFindByHanjaCalls += 1;
      assert.equal(hanja, '\u654F');
      return ordinary;
    },
    findByHangul: async () => {
      throw new Error('exact ordinary Han lookup should not need a Hangul fallback');
    },
  };
  const [resolvedOrdinary] = await puaEngine.resolveEntries([
    { hangul: '\uBBFC', hanja: '\u654F' },
  ]);
  assert.equal(resolvedOrdinary.hanja, '\u654F');
  assert.equal(ordinaryFindByHanjaCalls, 1, 'ordinary Han must retain repository verification');
}


{
  const engine = new SpringEngine() as any;
  const partialRequest: any = {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
    givenName: [{ hangul: '\uBBFC', hanja: '\u73C9' }],
    givenNameLength: 2,
    mode: 'auto',
    options: { pureHangulNameMode: 'auto' },
  };
  assert.doesNotThrow(() => engine.assertRequestNameSyntax(partialRequest, true));
  const partialPlan = engine.buildNameInputPlan(partialRequest);
  assert.equal(partialPlan.mode, 'recommend');
  assert.equal(partialPlan.hasGenerationConstraints, true);
  assert.equal(partialPlan.includeOriginalName, false);

  const pureRequest: any = {
    ...partialRequest,
    givenName: [{ hangul: '\uBBFC' }],
    givenNameLength: 1,
    mode: 'recommend',
    options: { pureHangulNameMode: 'on' },
  };
  engine.generateCandidates = async () => [
    [{ hangul: '\uBBFC', hanja: '\u73C9' }],
    [{ hangul: '\uBBFC', hanja: '\u654F' }],
  ];
  engine.filterCandidatesByNameStat = async (rows: unknown[]) => rows;
  const canonical = await engine.collectNameInputs(
    pureRequest,
    engine.buildNameInputPlan(pureRequest),
    {} as any,
    new Map(),
    engine.beginOperation('getNameCandidates'),
  );
  assert.deepEqual(canonical, [[{ hangul: '\uBBFC' }]]);
}


{
  let repositoryCalls = 0;
  const repository = {
    findByHanja: async () => {
      repositoryCalls += 1;
      return fakeEntry({ hangul: '삽', hanja: '挿' });
    },
    findByHangul: async () => {
      repositoryCalls += 1;
      return [fakeEntry({ hangul: '삽', hanja: '挿' })];
    },
  };
  const forgedPreverified = () => fakeEntry({ hangul: '삽', hanja: '挿' });

  await assert.rejects(
    resolveNameEntries(
      [{ hangul: '삽', hanja: '挿' }],
      repository,
      {
        hanjaPool: 'curated',
        requireLegalRegistrable: true,
        preverifiedExplicitPair: forgedPreverified,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'explicit_hanja_not_found');
      return true;
    },
    'an off-list input alias must fail before repository or preverified-cache acceptance',
  );
  assert.equal(repositoryCalls, 0);

  await assert.rejects(
    resolveNameEntries(
      [{ hangul: '삽', hanja: '國' }],
      repository,
      {
        hanjaPool: 'inmyeongyong_full',
        requireLegalRegistrable: true,
        preverifiedExplicitPair: () => fakeEntry({ hangul: '삽', hanja: '國' }),
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'hangul_hanja_reading_mismatch');
      return true;
    },
    'an official glyph with an unsupported reading must fail before cache acceptance',
  );

  const officialPair = fakeEntry({ hangul: '삽', hanja: '插' });
  const [resolved] = await resolveNameEntries(
    [{ hangul: '삽', hanja: '插' }],
    repository,
    {
      hanjaPool: 'curated',
      requireLegalRegistrable: true,
      preverifiedExplicitPair: () => officialPair,
    },
  );
  assert.equal(resolved.hanja, '插');
  assert.equal(resolved.hangul, '삽');

  await assert.rejects(
    resolveFixedNameCharacterPool(
      { hangul: '앵', hanja: '桜' },
      repository,
      {
        hanjaPool: 'inmyeongyong_full',
        poolLimit: 1,
        preverifiedEntry: fakeEntry({ hangul: '앵', hanja: '桜' }),
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof NameEntryResolutionError);
      assert.equal(error.reason, 'explicit_hanja_not_found');
      return true;
    },
    'fixed-pool preverification must not bypass raw official membership',
  );
}

{
  const input = { hangul: '\uAD6D', hanja: '\u570B' };
  const official = fakeEntry({ hangul: input.hangul, hanja: input.hanja });
  const staleOffList = fakeEntry({ hangul: '\uC0BD', hanja: '\u633F' });
  let repositoryCalls = 0;
  const repository = {
    findByHanja: async (hanja: string) => {
      repositoryCalls += 1;
      return hanja === input.hanja ? official : null;
    },
    findByHangul: async (hangul: string) => {
      repositoryCalls += 1;
      return hangul === input.hangul ? [official] : [];
    },
  };
  const staleCache = () => staleOffList;

  const [resolved] = await resolveNameEntries([input], repository, {
    hanjaPool: 'curated',
    preverifiedExplicitPair: staleCache,
  });
  assert.equal(resolved.hangul, input.hangul);
  assert.equal(resolved.hanja, input.hanja);

  const verified = await assertExplicitNameIdentity([input], repository, {
    hanjaPool: 'curated',
    preverifiedExplicitPair: staleCache,
  });
  assert.equal(verified.get(input)?.hanja, input.hanja);

  const fixed = await resolveFixedNameCharacterPool(input, repository, {
    hanjaPool: 'curated',
    poolLimit: 1,
    preverifiedEntry: staleOffList,
  });
  assert.equal(fixed[0].hanja, input.hanja);
  assert.ok(repositoryCalls >= 3, 'stale preverified entries must fall back to exact repository verification');
}

console.log('Name-entry resolver policy: PASS');
