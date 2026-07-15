import assert from 'node:assert/strict';
import test from 'node:test';

import { FourFrameCalculator } from '../src/calculator/frame-calculator.js';
import { HanjaCalculator } from '../src/calculator/hanja-calculator.js';
import type { HanjaEntry } from '../src/database/hanja-repository.js';
import { SeedCalculationError, SeedValidationError } from '../src/errors.js';
import { FOURFRAME_CATALOG_PROVENANCE } from '../src/fourframe-catalog.js';
import { Element } from '../src/model/element.js';
import { Energy } from '../src/model/energy.js';
import { Polarity } from '../src/model/polarity.js';
import { SeedTs } from '../src/seed.js';
import type { UserInfo } from '../src/types.js';
import {
  buildHangulPseudoEntry,
  decomposeHangulSyllable,
  hangulStrokeCount,
} from '../src/utils/hangul-name-entry.js';

function entry(
  hangul: string,
  hanja: string,
  onset: string,
  nucleus: string,
  strokes: number,
  overrides: Partial<HanjaEntry> = {},
): HanjaEntry {
  return {
    id: 1,
    hangul,
    hanja,
    onset,
    nucleus,
    strokes,
    stroke_element: 'Metal',
    resource_element: 'Water',
    meaning: 'test',
    radical: '',
    is_surname: false,
    ...overrides,
  };
}

function validUserInfo(): UserInfo {
  return {
    lastName: [
      entry('\uAE40', '\u91D1', '\u3131', '\u3163', 8, { is_surname: true }),
    ],
    firstName: [
      entry('\uBBFC', '\u73C9', '\u3141', '\u3163', 9),
      entry('\uC900', '\u4FCA', '\u3148', '\u315C', 9),
    ],
    birthDateTime: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      calendarType: 'solar',
    },
    gender: 'neutral',
    options: { pureHangulNameMode: 'off' },
  };
}

function withFirstNameEntry(overrides: Partial<HanjaEntry>): UserInfo {
  const input = validUserInfo();
  return {
    ...input,
    firstName: [
      { ...input.firstName[0], ...overrides },
      ...input.firstName.slice(1),
    ],
  };
}

function nativeKoreanEntry(char: string, index: number): HanjaEntry {
  const parts = decomposeHangulSyllable(char);
  assert.ok(parts);
  return {
    id: index + 1,
    hangul: char,
    hanja: '',
    onset: parts.onset,
    nucleus: parts.nucleus,
    strokes: 0,
    stroke_element: '',
    resource_element: '',
    meaning: '',
    radical: '',
    is_surname: false,
  };
}

function expectValidationError(
  input: UserInfo,
  code: SeedValidationError['code'],
  path: string,
): void {
  assert.throws(
    () => new SeedTs().analyze(input),
    (error: unknown) => {
      assert.ok(error instanceof SeedValidationError);
      assert.equal(error.kind, 'validation');
      assert.equal(error.code, code);
      assert.equal(error.path, path);
      return true;
    },
  );
}

function assertEmbeddedFourframeEntries(
  calculator: FourFrameCalculator,
  expectedFullHangul: string,
): void {
  let personalizedEntryCount = 0;
  for (const frame of calculator.getFrames()) {
    const entry = frame.entry;
    const serializedEntry = JSON.stringify(entry);
    assert.equal(frame.enrichmentStatus, 'embedded_versioned_snapshot');
    assert.equal(entry.number, frame.strokeSum);
    assert.equal(serializedEntry.includes('[성함]'), false);
    if (serializedEntry.includes(expectedFullHangul)) personalizedEntryCount += 1;
    for (const field of [
      'title',
      'summary',
      'detailed_explanation',
      'positive_aspects',
      'caution_points',
      'life_period_influence',
      'special_characteristics',
      'challenge_period',
      'opportunity_area',
      'lucky_level',
    ] as const) {
      assert.ok(entry[field].trim().length > 0, `${frame.type}.${field}`);
    }
    assert.ok(entry.personality_traits.length > 0);
    assert.ok(entry.suitable_career.length > 0);
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.personality_traits));
    assert.ok(Object.isFrozen(entry.suitable_career));
  }
  assert.ok(personalizedEntryCount > 0);
}

test('analyze is deterministic, I/O-free, finite, and immutable after return', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('analyze must not fetch');
  }) as typeof globalThis.fetch;
  process.on('unhandledRejection', onUnhandled);

  try {
    const input = validUserInfo();
    const result = new SeedTs().analyze(input);
    const candidate = result.candidates[0];
    const fourFrames = candidate.fourFrames as FourFrameCalculator;
    const framesBefore = fourFrames.getFrames();

    assert.ok(Number.isFinite(candidate.totalScore));
    assert.ok(Number.isFinite(candidate.hangul.getScore()));
    assert.ok(Number.isFinite(candidate.hanja.getScore()));
    assert.ok(Number.isFinite(fourFrames.getScore()));
    assert.equal(candidate.hangul.calculationStatus, 'ready');
    assert.equal(candidate.hanja.calculationStatus, 'ready');
    assert.equal(fourFrames.calculationStatus, 'ready');
    assert.equal(fourFrames.luckScore, null);
    assert.deepEqual(framesBefore.map((frame) => frame.strokeSum), [18, 17, 17, 26]);
    assert.equal(framesBefore.length, 4);
    assert.equal(Object.hasOwn(FourFrameCalculator.Frame, 'repository'), false);
    assert.equal(Object.hasOwn(FourFrameCalculator.Frame, 'repositoryInitPromise'), false);

    assert.deepEqual(candidate.fourFrameEnrichment, {
      status: 'embedded_versioned_snapshot',
      source: 'embedded_fourframe_catalog',
      includedInScore: false,
      mutableAfterReturn: false,
      schemaVersion: FOURFRAME_CATALOG_PROVENANCE.schemaVersion,
      snapshotVersion: FOURFRAME_CATALOG_PROVENANCE.snapshotVersion,
      contentSha256: FOURFRAME_CATALOG_PROVENANCE.canonicalContentSha256,
      sourceDatabaseSha256: FOURFRAME_CATALOG_PROVENANCE.sourceDatabaseSha256,
      rowCount: FOURFRAME_CATALOG_PROVENANCE.rowCount,
      reason: 'Versioned four-frame meanings are embedded for display and do not alter scoring.',
    });
    assert.ok(Object.isFrozen(candidate.fourFrameEnrichment));
    assert.ok(framesBefore.every((frame) => frame.luckLevel === null));
    assertEmbeddedFourframeEntries(fourFrames, '김민준');
    assert.equal('getLuckLevel' in framesBefore[0], false);

    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.candidates));
    assert.ok(Object.isFrozen(candidate));
    assert.ok(Object.isFrozen(candidate.lastName));
    assert.ok(Object.isFrozen(candidate.lastName[0]));
    assert.ok(Object.isFrozen(fourFrames));
    assert.ok(Object.isFrozen(framesBefore));
    assert.ok(framesBefore.every((frame) => Object.isFrozen(frame) && Object.isFrozen(frame.energy)));
    assert.equal(Object.isFrozen(input.lastName[0]), false, 'caller-owned input must not be frozen');

    const serializedBefore = JSON.stringify(result);
    (input.lastName[0] as unknown as { strokes: number }).strokes = 99;
    assert.equal(candidate.lastName[0].strokes, 8, 'result must not alias caller-owned entries');
    fourFrames.calculate();
    assert.strictEqual(fourFrames.getFrames(), framesBefore);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(JSON.stringify(result), serializedBefore);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(unhandled, []);
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
    globalThis.fetch = originalFetch;
  }
});

test('pure-Hangul calculators expose an excluded zero-score contract after freezing', () => {
  const input = validUserInfo();
  const result = new SeedTs().analyze({
    ...input,
    firstName: input.firstName.map((nameEntry) => ({
      ...nameEntry,
      hanja: nameEntry.hangul,
    })),
    options: { pureHangulNameMode: 'on' },
  });
  const candidate = result.candidates[0];
  const fourFrames = candidate.fourFrames as FourFrameCalculator;

  assert.equal(candidate.pureHangulMode, true);
  assert.equal(candidate.hangul.calculationStatus, 'ready');
  assert.equal(candidate.hanja.calculationStatus, 'excluded');
  assert.equal(fourFrames.calculationStatus, 'excluded');
  assert.equal(fourFrames.luckScore, null);
  assert.equal(candidate.hanja.getScore(), 0);
  assert.equal(fourFrames.getScore(), 0);
  assertEmbeddedFourframeEntries(fourFrames, '김민준');
  assert.ok(Number.isFinite(candidate.hangul.getScore()));
  assert.ok(Number.isFinite(candidate.totalScore));

  const serializedBefore = JSON.stringify(result);
  assert.doesNotThrow(() => candidate.hangul.calculate());
  assert.doesNotThrow(() => candidate.hanja.calculate());
  assert.doesNotThrow(() => fourFrames.calculate());
  assert.equal(candidate.hanja.getScore(), 0);
  assert.equal(fourFrames.getScore(), 0);
  assertEmbeddedFourframeEntries(fourFrames, '김민준');
  assert.equal(JSON.stringify(result), serializedBefore);
});

test('InputForm native-Korean placeholder shape is normalized before strict scoring', () => {
  const base = validUserInfo();
  const nativeFirstName = Array.from('\uBBFC\uC900').map(nativeKoreanEntry);
  const input: UserInfo = {
    ...base,
    firstName: nativeFirstName,
    birthDateTime: {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    },
    gender: 'male',
    options: undefined,
  };

  const result = new SeedTs().analyze(input);
  const candidate = result.candidates[0];
  const fourFrames = candidate.fourFrames as FourFrameCalculator;

  assert.equal(candidate.pureHangulMode, true);
  assert.equal(candidate.hanja.calculationStatus, 'excluded');
  assert.equal(fourFrames.calculationStatus, 'excluded');
  assert.equal(candidate.hanja.getScore(), 0);
  assert.equal(fourFrames.getScore(), 0);
  assert.ok(Number.isFinite(candidate.totalScore));
  assert.ok(candidate.firstName.every((nameEntry) =>
    Number.isSafeInteger(nameEntry.strokes)
    && nameEntry.strokes > 0
    && ['Wood', 'Fire', 'Earth', 'Metal', 'Water'].includes(nameEntry.stroke_element)
    && ['Wood', 'Fire', 'Earth', 'Metal', 'Water'].includes(nameEntry.resource_element)));

  assert.deepEqual(
    nativeFirstName.map((nameEntry) => ({
      strokes: nameEntry.strokes,
      strokeElement: nameEntry.stroke_element,
      resourceElement: nameEntry.resource_element,
    })),
    [
      { strokes: 0, strokeElement: '', resourceElement: '' },
      { strokes: 0, strokeElement: '', resourceElement: '' },
    ],
    'normalization must not mutate caller-owned InputForm entries',
  );
  assert.equal(Object.isFrozen(nativeFirstName[0]), false);

  expectValidationError(
    {
      ...input,
      options: { pureHangulNameMode: 'off' },
    },
    'INVALID_HANJA_CHARACTER',
    'firstName[0].hanja',
  );
});

test('pending calculators still fail closed instead of manufacturing an empty score', () => {
  const input = validUserInfo();
  const calculator = new HanjaCalculator(input.lastName, input.firstName);

  assert.equal(calculator.calculationStatus, 'pending');
  assert.throws(
    () => calculator.getScore(),
    (error: unknown) => error instanceof SeedCalculationError
      && error.code === 'EMPTY_ENERGY_SET'
      && error.path === 'hanja.nameBlocks',
  );
});

test('invalid names, strokes, elements, onset, and nucleus fail closed', () => {
  const emptySurname: UserInfo = { ...validUserInfo(), lastName: [] };
  expectValidationError(emptySurname, 'EMPTY_SURNAME', 'lastName');

  const emptyGivenName: UserInfo = { ...validUserInfo(), firstName: [] };
  expectValidationError(emptyGivenName, 'EMPTY_GIVEN_NAME', 'firstName');

  const nonHangul = withFirstNameEntry({ hangul: 'A' });
  expectValidationError(nonHangul, 'INVALID_HANGUL_SYLLABLE', 'firstName[0].hangul');

  for (const badStrokes of [0, Number.NaN, 1.5]) {
    const invalidStroke = withFirstNameEntry({ strokes: badStrokes });
    expectValidationError(invalidStroke, 'INVALID_STROKE_COUNT', 'firstName[0].strokes');
  }

  const invalidStrokeElement = withFirstNameEntry({ stroke_element: 'Void' });
  expectValidationError(invalidStrokeElement, 'INVALID_ELEMENT', 'firstName[0].stroke_element');

  const invalidResourceElement = withFirstNameEntry({ resource_element: 'Void' });
  expectValidationError(invalidResourceElement, 'INVALID_ELEMENT', 'firstName[0].resource_element');

  const invalidOnset = withFirstNameEntry({ onset: '\u3147' });
  expectValidationError(invalidOnset, 'INVALID_ONSET', 'firstName[0].onset');

  const invalidNucleus = withFirstNameEntry({ nucleus: '\u314F' });
  expectValidationError(invalidNucleus, 'INVALID_NUCLEUS', 'firstName[0].nucleus');
});

test('non-Hangul analysis rejects invalid Han characters and positional surname flags', () => {
  for (const invalidHanja of ['', 'NOT-HAN', '\u73C9\u4FCA']) {
    expectValidationError(
      withFirstNameEntry({ hanja: invalidHanja }),
      'INVALID_HANJA_CHARACTER',
      'firstName[0].hanja',
    );
  }

  const surnameFlagMismatch = validUserInfo();
  expectValidationError(
    {
      ...surnameFlagMismatch,
      lastName: [{ ...surnameFlagMismatch.lastName[0], is_surname: false }],
    },
    'INVALID_SURNAME_FLAG',
    'lastName[0].is_surname',
  );

  const surnameEligibleGivenName = validUserInfo();
  assert.doesNotThrow(() => new SeedTs().analyze({
    ...surnameEligibleGivenName,
    firstName: [
      { ...surnameEligibleGivenName.firstName[0], is_surname: true },
      ...surnameEligibleGivenName.firstName.slice(1),
    ],
  }));

  assert.doesNotThrow(() => new SeedTs().analyze(
    withFirstNameEntry({ hanja: '\u{20000}' }),
  ));
});

test('gender, options, and birth date-time values fail closed at runtime', () => {
  expectValidationError(
    { ...validUserInfo(), gender: 'unknown' } as unknown as UserInfo,
    'INVALID_GENDER',
    'gender',
  );
  expectValidationError(
    { ...validUserInfo(), birthDateTime: null } as unknown as UserInfo,
    'INVALID_BIRTH_DATE_TIME',
    'birthDateTime',
  );
  expectValidationError(
    {
      ...validUserInfo(),
      birthDateTime: {
        year: 2023,
        month: 2,
        day: 29,
        calendarType: 'solar',
      },
    },
    'INVALID_BIRTH_DATE_TIME',
    'birthDateTime.day',
  );
  expectValidationError(
    {
      ...validUserInfo(),
      birthDateTime: {
        month: 2,
        day: 31,
        calendarType: 'lunar',
      },
    },
    'INVALID_BIRTH_DATE_TIME',
    'birthDateTime.day',
  );
  expectValidationError(
    {
      ...validUserInfo(),
      birthDateTime: {
        year: 1990,
        month: 1,
        day: 1,
        calendarType: 'solar',
        isLeapMonth: true,
      },
    },
    'INVALID_BIRTH_DATE_TIME',
    'birthDateTime.isLeapMonth',
  );
  expectValidationError(
    { ...validUserInfo(), options: null } as unknown as UserInfo,
    'INVALID_ANALYSIS_OPTIONS',
    'options',
  );
  expectValidationError(
    {
      ...validUserInfo(),
      options: { pureHangulNameMode: 'sometimes' },
    } as unknown as UserInfo,
    'INVALID_ANALYSIS_OPTIONS',
    'options.pureHangulNameMode',
  );
  expectValidationError(
    {
      ...validUserInfo(),
      options: { useSurnameHanjaInPureHangul: 'yes' },
    } as unknown as UserInfo,
    'INVALID_ANALYSIS_OPTIONS',
    'options.useSurnameHanjaInPureHangul',
  );
  expectValidationError(
    {
      ...validUserInfo(),
      birthDateTime: {
        year: 1990,
        month: 1,
        day: 1,
        timezone: 'Asia/Seoul',
      },
    } as unknown as UserInfo,
    'INVALID_BIRTH_DATE_TIME',
    'birthDateTime.timezone',
  );
  expectValidationError(
    {
      ...validUserInfo(),
      options: { pureHangulMode: 'on' },
    } as unknown as UserInfo,
    'INVALID_ANALYSIS_OPTIONS',
    'options.pureHangulMode',
  );
});

test('caller-owned nested extras are not retained or frozen by the result DTO', () => {
  const input = validUserInfo();
  const nestedExtra = {
    provenance: {
      source: 'caller',
    },
  };
  const firstEntry = {
    ...input.firstName[0],
    metadata: nestedExtra,
  } as HanjaEntry;
  const result = new SeedTs().analyze({
    ...input,
    firstName: [firstEntry, ...input.firstName.slice(1)],
  });
  const returnedEntry = result.candidates[0].firstName[0] as HanjaEntry & {
    metadata?: unknown;
  };

  assert.equal(Object.hasOwn(returnedEntry, 'metadata'), false);
  assert.equal(Object.isFrozen(nestedExtra), false);
  assert.equal(Object.isFrozen(nestedExtra.provenance), false);
  nestedExtra.provenance.source = 'caller-mutated';
  assert.equal(nestedExtra.provenance.source, 'caller-mutated');
});

test('low-level score and pseudo-entry fallbacks also fail closed', () => {
  assert.equal(hangulStrokeCount('\uAC00'), 4, 'an absent coda contributes zero strokes');
  assert.throws(
    () => Energy.getScore([]),
    (error: unknown) => error instanceof SeedCalculationError
      && error.code === 'EMPTY_ENERGY_SET'
      && error.path === 'energies',
  );
  assert.throws(
    () => buildHangulPseudoEntry('A'),
    (error: unknown) => error instanceof SeedValidationError
      && error.code === 'INVALID_HANGUL_SYLLABLE',
  );
  assert.throws(
    () => Element.get('Void'),
    (error: unknown) => error instanceof SeedValidationError
      && error.code === 'INVALID_ELEMENT',
  );
  assert.throws(
    () => Polarity.get(Number.NaN),
    (error: unknown) => error instanceof SeedValidationError
      && error.code === 'INVALID_STROKE_COUNT',
  );
});

test('Element and Polarity singleton graphs are runtime-frozen', () => {
  assert.ok(Element.values().every((value) => Object.isFrozen(value)));
  assert.ok(Polarity.values().every((value) => Object.isFrozen(value)));
  assert.ok(Object.isFrozen(Element.Relation));
  assert.ok(Object.values(Element.Relation).every((value) => Object.isFrozen(value)));
  assert.ok(Object.isFrozen(Polarity.Relation));
  assert.ok(Object.values(Polarity.Relation).every((value) => Object.isFrozen(value)));

  assert.throws(() => {
    (Element.Wood as unknown as { english: string }).english = 'Corrupted';
  }, TypeError);
  assert.throws(() => {
    (Polarity.Positive as unknown as { english: string }).english = 'Corrupted';
  }, TypeError);
});
