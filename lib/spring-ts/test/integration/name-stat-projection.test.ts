import assert from 'node:assert/strict';
import test from 'node:test';

import type { NameStatEntry } from '../../../seed-ts/src/database/name-stat-row.js';
import {
  projectNameStatEntry,
  toFoundNameStatLookupResult,
} from '../../src/name-stat-projection.js';
import { SpringEngine } from '../../src/spring-engine.js';

function entry(overrides: Partial<NameStatEntry> = {}): NameStatEntry {
  return {
    name: '가나',
    first_char: '가',
    first_choseong: 'ㄱ',
    similar_names: [],
    yearly_rank: {},
    yearly_birth: {},
    hanja_combinations: [],
    raw_entry: {},
    ...overrides,
  };
}

test('uses each name own latest 전체 year and ignores other rank buckets', () => {
  const projection = projectNameStatEntry(entry({
    yearly_rank: {
      전체: { 2008: 20, 2012: 7 },
      남자: { 2025: 1 },
      여자: { 2025: 2 },
    },
  }));

  assert.equal(projection.popularityRank, 7);
});

test('averages the latest observed year across buckets only when 전체 is absent', () => {
  const projection = projectNameStatEntry(entry({
    yearly_rank: {
      남자: { 2023: 20, 2024: 8 },
      여자: { 2024: 12 },
    },
  }));

  assert.equal(projection.popularityRank, 10);
});

test('does not fall back to an older positive rank when the latest 전체 rank is zero', () => {
  const projection = projectNameStatEntry(entry({
    yearly_rank: { 전체: { 2023: 5, 2024: 0 } },
  }));

  assert.equal(projection.popularityRank, null);
});

test('sums male and female aliases independently without deriving them from 전체', () => {
  const projection = projectNameStatEntry(entry({
    yearly_birth: {
      전체: { 2024: 999 },
      남자: { 2023: 3, 2024: 4 },
      남: { 2024: 5 },
      여자: { 2023: 6 },
      여: { 2024: 7 },
    },
  }));

  assert.deepEqual(projection, {
    popularityRank: null,
    maleBirths: 12,
    femaleBirths: 13,
  });
});

test('preserves the current male classification for an exact 0.5 tie', () => {
  const result = toFoundNameStatLookupResult({
    popularityRank: 3,
    maleBirths: 5,
    femaleBirths: 5,
  });

  assert.deepEqual(result, {
    status: 'found',
    popularityRank: 3,
    maleRatio: 0.5,
    nameGender: 'male',
  });
});

test('keeps an existing row with empty statistics distinct from not-found', () => {
  const projection = projectNameStatEntry(entry({ name: '기타' }));
  const result = toFoundNameStatLookupResult(projection);

  assert.deepEqual(projection, {
    popularityRank: null,
    maleBirths: 0,
    femaleBirths: 0,
  });
  assert.deepEqual(result, {
    status: 'found',
    popularityRank: null,
    maleRatio: null,
    nameGender: 'unknown',
  });
});

test('does not mutate the decoded repository entry', () => {
  const source = entry({
    yearly_rank: { 전체: { 2024: 4 } },
    yearly_birth: {
      남자: { 2024: 2 },
      여자: { 2024: 6 },
    },
  });
  const before = structuredClone(source);

  const result = toFoundNameStatLookupResult(projectNameStatEntry(source));

  assert.deepEqual(source, before);
  assert.deepEqual(result, {
    status: 'found',
    popularityRank: 4,
    maleRatio: 0.25,
    nameGender: 'female',
  });
});

test('SpringEngine publishes the same pure projection without a second policy path', async () => {
  const source = entry({
    yearly_rank: {
      전체: { 2023: 9, 2024: 4 },
      남자: { 2025: 1 },
    },
    yearly_birth: {
      남자: { 2024: 2 },
      여자: { 2024: 6 },
    },
  });
  const engine = new SpringEngine() as any;
  let lookupCount = 0;
  engine.nameStatRepo = {
    findByName: async (name: string) => {
      lookupCount += 1;
      assert.equal(name, '가나');
      return source;
    },
  };

  const result = await engine.getNameStatInfo([
    { hangul: '가' },
    { hangul: '나' },
  ]);

  assert.deepEqual(result, {
    status: 'found',
    popularityRank: 4,
    maleRatio: 0.25,
    nameGender: 'female',
  });
  assert.equal(lookupCount, 1);
});
