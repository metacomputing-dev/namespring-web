import assert from 'node:assert/strict';
import test from 'node:test';

import { RepositoryDataError } from '../src/database/repository-errors.js';
import { decodeNameStatRow } from '../src/database/name-stat-row.js';

const BASE_ROW: Readonly<Record<string, unknown>> = Object.freeze({
  id: 1,
  name: '가나',
  first_char: '가',
  first_choseong: 'ㄱ',
  similar_names_json: JSON.stringify(['가람']),
  yearly_rank_json: JSON.stringify({
    전체: { 2023: 12, 2024: 9 },
    남자: { 2024: 10 },
  }),
  yearly_birth_json: JSON.stringify({
    남자: { 2023: 3, 2024: 4 },
    여자: { 2023: 5, 2024: 6 },
  }),
  hanja_combinations_json: JSON.stringify(['佳娜']),
  raw_entry_json: JSON.stringify({ source: 'fixture' }),
});

test('decodes the complete nested NameStat row without mutating its source', () => {
  const before = structuredClone(BASE_ROW);
  const decoded = decodeNameStatRow({ ...BASE_ROW }, '가나');

  assert.deepEqual(decoded, {
    name: '가나',
    first_char: '가',
    first_choseong: 'ㄱ',
    similar_names: ['가람'],
    yearly_rank: {
      전체: { 2023: 12, 2024: 9 },
      남자: { 2024: 10 },
    },
    yearly_birth: {
      남자: { 2023: 3, 2024: 4 },
      여자: { 2023: 5, 2024: 6 },
    },
    hanja_combinations: ['佳娜'],
    raw_entry: { source: 'fixture' },
  });
  assert.deepEqual(BASE_ROW, before);
});

test('normalizes a legacy flat statistic object into the 전체 bucket', () => {
  const decoded = decodeNameStatRow({
    ...BASE_ROW,
    yearly_rank_json: JSON.stringify({ 2022: 20, 2024: 8 }),
    yearly_birth_json: JSON.stringify({ 2022: 2, 2024: 4 }),
  }, '가나');

  assert.deepEqual(decoded.yearly_rank, { 전체: { 2022: 20, 2024: 8 } });
  assert.deepEqual(decoded.yearly_birth, { 전체: { 2022: 2, 2024: 4 } });
});

test('preserves the raw 19-way choseong identity rather than the folded shard key', () => {
  const decoded = decodeNameStatRow({
    ...BASE_ROW,
    name: '까나',
    first_char: '까',
    first_choseong: 'ㄲ',
  }, '까나');

  assert.equal(decoded.first_choseong, 'ㄲ');
});

test('rejects identity and statistic contract violations with stable data errors', () => {
  const cases: ReadonlyArray<readonly [
    Record<string, unknown>,
    string,
  ]> = [
    [{ ...BASE_ROW, name: '다라' }, 'row.name'],
    [{ ...BASE_ROW, first_char: '나' }, 'row.first_char'],
    [{ ...BASE_ROW, first_choseong: 'ㄴ' }, 'row.first_choseong'],
    [{
      ...BASE_ROW,
      yearly_rank_json: JSON.stringify({ 전체: { 2024: 1 }, 2023: 2 }),
    }, 'row.yearly_rank_json'],
    [{
      ...BASE_ROW,
      yearly_birth_json: JSON.stringify({ 남자: { '24': 1 } }),
    }, 'row.yearly_birth_json.남자.24'],
    [{
      ...BASE_ROW,
      yearly_birth_json: JSON.stringify({ 남자: { 2024: 1.5 } }),
    }, 'row.yearly_birth_json.남자.2024'],
  ];

  for (const [row, expectedPath] of cases) {
    assert.throws(
      () => decodeNameStatRow(row, '가나'),
      (error: unknown) => {
        assert.ok(error instanceof RepositoryDataError);
        assert.equal(error.repository, 'name-stat');
        assert.equal(error.code, 'REPOSITORY_DATA_INVALID');
        assert.equal(error.retryable, false);
        assert.equal(error.path, expectedPath);
        return true;
      },
      expectedPath,
    );
  }
});

test('rejects malformed or unsafe JSON before returning a partial row', () => {
  for (const [field, value] of [
    ['similar_names_json', '{broken'],
    ['raw_entry_json', '{"__proto__":{"polluted":true}}'],
    ['hanja_combinations_json', '[""]'],
  ] as const) {
    assert.throws(
      () => decodeNameStatRow({ ...BASE_ROW, [field]: value }, '가나'),
      (error: unknown) =>
        error instanceof RepositoryDataError
        && error.path.startsWith(`row.${field}`),
      field,
    );
  }
});
