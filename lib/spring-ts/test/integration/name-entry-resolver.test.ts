import assert from 'node:assert/strict';

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
  const exact = fakeEntry();
  const engine = new SpringEngine() as any;
  engine.hanjaRepo = {
    findByHanja: async () => exact,
    findByHangul: async () => [exact],
  };

  const resolved = await engine.resolveEntries([{ hangul: '민', hanja: '敏' }]);
  assert.deepEqual(
    resolved,
    [{ ...exact, hangul: '민', is_surname: false }],
    'an exact explicit pair must preserve the existing entry shape',
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

console.log('Name-entry resolver policy: PASS');
