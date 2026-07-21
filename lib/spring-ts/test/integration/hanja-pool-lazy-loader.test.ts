import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import {
  createFullHanjaPoolLoader,
  FullHanjaPoolIntegrityError,
  FullHanjaPoolLoadError,
  loadFullHanjaPoolEntries,
} from '../../src/full-hanja-pool-loader.js';
import {
  EXPECTED_FULL_HANJA_GLYPH_COUNT,
  EXPECTED_FULL_HANJA_READING_PAIR_COUNT,
  FULL_HANJA_GLYPHS,
  hasOfficialFullPoolHanjaReadings,
  isLocalFullPoolHanjaGlyph,
  isOfficialFullPoolHanjaReading,
  matchesOfficialFullPoolHanjaReadings,
} from '../../src/full-hanja-glyph-registry.js';
import {
  NameEntryResolutionError,
  resolveNameEntries,
  type NameEntryRepository,
} from '../../src/name-entry-resolver.js';

function entry(overrides: Partial<HanjaEntry> = {}): HanjaEntry {
  return {
    id: 1,
    hangul: '가',
    hanja: '佳',
    onset: 'ㄱ',
    nucleus: 'ㅏ',
    strokes: 8,
    stroke_element: 'Metal',
    resource_element: 'Wood',
    meaning: '아름다울',
    radical: '9',
    is_surname: false,
    ...overrides,
  };
}

function fixtureDocument() {
  return {
    schemaVersion: '1.0.0-full',
    totalCount: 1,
    entries: [{
      hanja: '佳',
      codepoint: 'U+4F73',
      readings: ['가'],
      meaning: '아름다울',
      radicalId: 9,
      strokeCount: 8,
    }],
  };
}

test('compact authority registry enforces raw glyph and designated reading pairs', () => {
  assert.equal(FULL_HANJA_GLYPHS.length, EXPECTED_FULL_HANJA_GLYPH_COUNT);
  assert.equal(EXPECTED_FULL_HANJA_READING_PAIR_COUNT, 10_381);
  assert.equal(isOfficialFullPoolHanjaReading('国', '국'), true);
  assert.equal(isOfficialFullPoolHanjaReading('國', '국'), true);
  assert.equal(isOfficialFullPoolHanjaReading('挿', '삽'), false);
  assert.equal(isOfficialFullPoolHanjaReading('插', '삽'), true);
  assert.equal(isOfficialFullPoolHanjaReading('國', '삽'), false);
  assert.equal(isLocalFullPoolHanjaGlyph('𥡴'), true);
  assert.equal(hasOfficialFullPoolHanjaReadings('𥡴'), false);
  assert.equal(isOfficialFullPoolHanjaReading('𥡴', '계'), false);
  assert.equal(matchesOfficialFullPoolHanjaReadings('㒚', ['온', '은']), true);
  assert.equal(matchesOfficialFullPoolHanjaReadings('㒚', ['은', '온']), true);
  assert.equal(matchesOfficialFullPoolHanjaReadings('㒚', ['온']), false);
});

test('production full-pool conversion preserves the exact ordered output', async () => {
  const firstAttempt = loadFullHanjaPoolEntries();
  const concurrentAttempt = loadFullHanjaPoolEntries();
  assert.strictEqual(concurrentAttempt, firstAttempt, 'concurrent callers must share one Promise');

  const entries = await firstAttempt;
  assert.equal(entries.length, 10_378);
  assert.equal(new Set(entries.map((item) => item.hanja)).size, 9_493);
  assert.ok(Object.isFrozen(entries));
  assert.ok(entries.every(Object.isFrozen));

  const digest = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  assert.equal(digest, '5e012c8589c33970ff079724dfdb286353886740a55446d5668f78b88a42eeca');
  assert.strictEqual(loadFullHanjaPoolEntries(), firstAttempt, 'successful cache must retain Promise identity');
});

test('loader is single-flight and publishes only a complete immutable cache', async () => {
  let imports = 0;
  let releaseImport!: () => void;
  const importGate = new Promise<void>((resolve) => { releaseImport = resolve; });
  const load = createFullHanjaPoolLoader({
    expectedGlyphs: ['佳'],
    importer: async () => {
      imports += 1;
      await importGate;
      return fixtureDocument();
    },
  });

  const first = load();
  const second = load();
  assert.strictEqual(first, second);
  assert.equal(imports, 0, 'the importer starts in a microtask, never during module evaluation');
  releaseImport();

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(imports, 1);
  assert.strictEqual(firstResult, secondResult);
  assert.deepEqual(firstResult.map(({ hangul, hanja }) => ({ hangul, hanja })), [
    { hangul: '가', hanja: '佳' },
  ]);
  assert.ok(Object.isFrozen(firstResult));
  assert.ok(Object.isFrozen(firstResult[0]));
});

test('transient import failure is explicit and a later call retries', async () => {
  let imports = 0;
  const load = createFullHanjaPoolLoader({
    expectedGlyphs: ['佳'],
    importer: async () => {
      imports += 1;
      if (imports === 1) throw new Error('synthetic transport failure');
      return fixtureDocument();
    },
  });

  const failedAttempt = load();
  await assert.rejects(failedAttempt, (error: unknown) => {
    assert.ok(error instanceof FullHanjaPoolLoadError);
    assert.equal(error.code, 'FULL_HANJA_POOL_LOAD_FAILED');
    assert.equal(error.retryable, true);
    assert.equal(error.message.includes('synthetic'), false, 'public message must not echo internal details');
    return true;
  });

  const retry = load();
  assert.notStrictEqual(retry, failedAttempt);
  assert.equal((await retry).length, 1);
  assert.equal(imports, 2);
});

test('malformed metadata fails closed without publishing a partial cache', async () => {
  let imports = 0;
  const load = createFullHanjaPoolLoader({
    expectedGlyphs: ['佳'],
    importer: async () => {
      imports += 1;
      return {
        ...fixtureDocument(),
        entries: [{ ...fixtureDocument().entries[0], codepoint: 'U+4F74' }],
      };
    },
  });

  const failedAttempt = load();
  await assert.rejects(failedAttempt, (error: unknown) => {
    assert.ok(error instanceof FullHanjaPoolIntegrityError);
    assert.equal(error.code, 'FULL_HANJA_POOL_INTEGRITY_FAILED');
    assert.equal(error.retryable, false);
    return true;
  });
  assert.strictEqual(load(), failedAttempt, 'non-retryable integrity rejection must be memoized');
  await assert.rejects(load(), FullHanjaPoolIntegrityError);
  assert.equal(imports, 1, 'immutable malformed data must not be reparsed for every request');
});

test('lazy metadata readings must exactly match compact official authority', async () => {
  const load = createFullHanjaPoolLoader({
    expectedGlyphs: ['佳'],
    importer: async () => ({
      ...fixtureDocument(),
      entries: [{ ...fixtureDocument().entries[0], readings: ['나'] }],
    }),
  });

  await assert.rejects(load(), FullHanjaPoolIntegrityError);

  const partialMultiReading = createFullHanjaPoolLoader({
    expectedGlyphs: ['㒚'],
    importer: async () => ({
      schemaVersion: '1.0.0-full',
      totalCount: 1,
      entries: [{
        hanja: '㒚',
        codepoint: 'U+0349A',
        readings: ['온'],
        meaning: null,
        radicalId: 9,
        strokeCount: 14,
      }],
    }),
  });
  await assert.rejects(partialMultiReading(), FullHanjaPoolIntegrityError);
});

test('metadata glyphs must exactly match the compact registry sequence', async () => {
  const load = createFullHanjaPoolLoader({
    expectedGlyphs: ['佳'],
    importer: async () => ({
      ...fixtureDocument(),
      entries: [{ ...fixtureDocument().entries[0], hanja: 'A ', codepoint: 'U+0041' }],
    }),
  });

  await assert.rejects(load(), FullHanjaPoolIntegrityError);
});

test('loader configuration rejects lone UTF-16 surrogates as non-scalars', () => {
  assert.throws(
    () => createFullHanjaPoolLoader({
      expectedGlyphs: ['\uD800'],
      importer: async () => fixtureDocument(),
    }),
    TypeError,
  );
});

test('curated and repository-hit resolution never invoke the full-pool provider', async () => {
  const exact = entry();
  const repository: NameEntryRepository = {
    async findByHanja(hanja) {
      return hanja === exact.hanja ? exact : null;
    },
    async findByHangul(hangul) {
      return hangul === exact.hangul ? [exact] : [];
    },
  };
  let fullPoolCalls = 0;
  const fullPoolEntries = async () => {
    fullPoolCalls += 1;
    return [exact];
  };

  const curated = await resolveNameEntries(
    [{ hangul: '가', hanja: '佳' }],
    repository,
    { hanjaPool: 'curated', asyncFullPoolEntries: fullPoolEntries },
  );
  const fullRepositoryHit = await resolveNameEntries(
    [{ hangul: '가', hanja: '佳' }],
    repository,
    { hanjaPool: 'inmyeongyong_full', asyncFullPoolEntries: fullPoolEntries },
  );

  assert.equal(curated[0].hanja, '佳');
  assert.equal(fullRepositoryHit[0].hanja, '佳');
  assert.equal(fullPoolCalls, 0);
});

test('full-pool repository miss awaits an asynchronous provider exactly once', async () => {
  const fullOnly = entry({ id: 900_000, hangul: '온', hanja: '㒚' });
  const repository: NameEntryRepository = {
    async findByHanja() { return null; },
    async findByHangul() { return []; },
  };
  let fullPoolCalls = 0;

  const resolved = await resolveNameEntries(
    [{ hangul: '온', hanja: '㒚' }],
    repository,
    {
      hanjaPool: 'inmyeongyong_full',
      asyncFullPoolEntries: async () => {
        fullPoolCalls += 1;
        return [fullOnly];
      },
    },
  );

  assert.equal(resolved[0].hanja, '㒚');
  assert.equal(fullPoolCalls, 1);
});

test('recognized glyphs excluded from scoring report metadata_incomplete, not not_found', async () => {
  const repository: NameEntryRepository = {
    async findByHanja() { return null; },
    async findByHangul() { return []; },
  };
  const entries = await loadFullHanjaPoolEntries();
  const cases = [
    { hangul: '익', hanja: '𥡴' }, // no reading in the mirror
    { hangul: '귀', hanja: String.fromCodePoint(0xA0252) }, // no usable stroke count
  ];

  for (const input of cases) {
    await assert.rejects(
      resolveNameEntries([input], repository, {
        hanjaPool: 'inmyeongyong_full',
        asyncFullPoolEntries: async () => entries,
      }),
      (error: unknown) => {
        assert.ok(error instanceof NameEntryResolutionError);
        assert.equal(error.reason, 'explicit_hanja_metadata_incomplete');
        assert.equal(error.message.includes(input.hanja), false);
        return true;
      },
    );
  }
});
