import { RepositoryRowDecoder } from './row-decoder.js';
import { extractRawNameStatChoseong } from '../utils/name-stat-shard.js';

export interface NameStatEntry {
  readonly name: string;
  readonly first_char: string;
  readonly first_choseong: string;
  readonly similar_names: string[];
  readonly yearly_rank: Record<string, Record<string, number>>;
  readonly yearly_birth: Record<string, Record<string, number>>;
  readonly hanja_combinations: string[];
  readonly raw_entry: Record<string, unknown>;
}

/**
 * Decodes one verified SQLite row without performing any repository I/O.
 *
 * Keeping this boundary pure lets offline asset generators and repository
 * lookups share the exact same fail-closed data contract.
 */
export function decodeNameStatRow(
  row: Record<string, unknown>,
  expectedName: string,
): NameStatEntry {
  const decoder = new RepositoryRowDecoder('name-stat', row);
  decoder.integer('id', { min: 1 });
  const name = decoder.string('name');
  if (name !== expectedName) {
    decoder.fail(decoder.path('name'), 'did not match the requested name');
  }
  const firstChar = decoder.string('first_char');
  if (firstChar !== Array.from(name)[0]) {
    decoder.fail(decoder.path('first_char'), 'did not match the first name syllable');
  }
  const firstChoseong = decoder.string('first_choseong');
  if (firstChoseong !== extractRawNameStatChoseong(firstChar)) {
    decoder.fail(decoder.path('first_choseong'), 'did not match the first name syllable');
  }

  return {
    name,
    first_char: firstChar,
    first_choseong: firstChoseong,
    similar_names: decoder.jsonStringArray('similar_names_json'),
    yearly_rank: parseNestedNumberObject(decoder, 'yearly_rank_json'),
    yearly_birth: parseNestedNumberObject(decoder, 'yearly_birth_json'),
    hanja_combinations: decoder.jsonStringArray('hanja_combinations_json'),
    raw_entry: decoder.jsonObject('raw_entry_json'),
  };
}

function parseNestedNumberObject(
  decoder: RepositoryRowDecoder,
  field: string,
): Record<string, Record<string, number>> {
  const parsed = decoder.jsonObject(field);
  const entries = Object.entries(parsed);
  const hasFlatValues = entries.some(([, value]) => typeof value === 'number');
  const hasNestedValues = entries.some(([, value]) =>
    typeof value === 'object' && value !== null && !Array.isArray(value));

  if (entries.some(([, value]) =>
    typeof value !== 'number'
    && (typeof value !== 'object' || value === null || Array.isArray(value)))) {
    decoder.fail(decoder.path(field), 'expected numeric years or nested numeric buckets');
  }
  if (hasFlatValues && hasNestedValues) {
    decoder.fail(decoder.path(field), 'mixed flat and nested statistic shapes');
  }

  if (hasFlatValues) {
    const flat: Record<string, number> = {};
    for (const [year, value] of entries) {
      flat[year] = decodeStatisticValue(decoder, field, year, value);
    }
    return { ['전체']: flat };
  }

  const out: Record<string, Record<string, number>> = {};
  for (const [bucketName, bucket] of entries) {
    if (bucketName.trim().length === 0) {
      decoder.fail(decoder.path(field), 'contained an empty bucket name');
    }
    const bucketPath = decoder.path(field) + '.' + bucketName;
    if (typeof bucket !== 'object' || bucket === null || Array.isArray(bucket)) {
      decoder.fail(bucketPath, 'expected an object bucket');
    }
    const decodedBucket: Record<string, number> = {};
    for (const [year, value] of Object.entries(bucket as Record<string, unknown>)) {
      decodedBucket[year] = decodeStatisticValue(
        decoder,
        field,
        bucketName + '.' + year,
        value,
      );
    }
    out[bucketName] = decodedBucket;
  }
  return out;
}

function decodeStatisticValue(
  decoder: RepositoryRowDecoder,
  field: string,
  keyedYear: string,
  value: unknown,
): number {
  const year = keyedYear.split('.').at(-1) ?? '';
  if (!/^\d{4}$/u.test(year)) {
    decoder.fail(decoder.path(field) + '.' + keyedYear, 'expected a four-digit year key');
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    decoder.fail(
      decoder.path(field) + '.' + keyedYear,
      'expected a finite non-negative safe integer',
    );
  }
  return value;
}
