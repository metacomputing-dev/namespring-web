export const NAME_STAT_SUMMARY_SCHEMA_VERSION =
  'namespring.spring-name-stat-summary/v1' as const;

export const NAME_STAT_SOURCE_ASSET_SET_SCHEMA_VERSION =
  'namespring.name-stat-source-asset-set/v1' as const;

export const NAME_STAT_SUMMARY_EXPECTED_ROW_COUNT = 50_194;

export const NAME_STAT_SUMMARY_CANONICALIZATION =
  'UTF-8 JSON.stringify with fixed root-field order, code-unit-sorted entry keys, compact tuples, and one trailing LF' as const;

export type NameStatSummaryTuple = readonly [
  popularityRank: number | null,
  maleBirths: number,
  femaleBirths: number,
];

export interface NameStatSummaryDocument {
  readonly schemaVersion: typeof NAME_STAT_SUMMARY_SCHEMA_VERSION;
  readonly sourceAssetSetSha256: string;
  readonly rowCount: number;
  readonly entries: Readonly<Record<string, NameStatSummaryTuple>>;
}

export interface NameStatSummaryAssetProvenance {
  readonly schemaVersion: typeof NAME_STAT_SUMMARY_SCHEMA_VERSION;
  readonly assetSourceRelativePath: string;
  readonly sourceAssetSetSha256: string;
  readonly rowCount: number;
  readonly canonicalJsonByteLength: number;
  readonly canonicalJsonSha256: string;
  readonly compressedByteLength: number;
  readonly compressedSha256: string;
  readonly canonicalization: typeof NAME_STAT_SUMMARY_CANONICALIZATION;
  readonly gzipCanonicalization: string;
}

export interface NameStatSummaryValidationOptions {
  readonly expectedRowCount?: number;
  readonly expectedSourceAssetSetSha256?: string;
}

export const NAME_STAT_SUMMARY_CONTRACT_INVALID =
  'NAME_STAT_SUMMARY_CONTRACT_INVALID' as const;

export class NameStatSummaryContractError extends Error {
  public readonly code = NAME_STAT_SUMMARY_CONTRACT_INVALID;
  public readonly retryable = false;

  public constructor(
    public readonly path: string,
    reason: string,
  ) {
    super(`NameStat summary ${path} ${reason}.`);
    this.name = 'NameStatSummaryContractError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function fail(path: string, reason: string): never {
  throw new NameStatSummaryContractError(path, reason);
}

function requireRecord(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, 'must be an object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'must be a plain object');
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(record);
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    fail(path, `must contain fields in canonical order ${expected.join(', ')}`);
  }
}

function requireSha256(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    return fail(path, 'must be 64 lowercase hexadecimal characters');
  }
  return value;
}

function requireExpectedRowCount(value: unknown, expected: number): number {
  if (!Number.isSafeInteger(value) || value !== expected) {
    return fail('rowCount', `must equal ${expected}`);
  }
  return value as number;
}

function requireBirthCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return fail(path, 'must be a non-negative safe integer');
  }
  return value;
}

function requirePopularityRank(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value <= 0
    || value > Number.MAX_SAFE_INTEGER
  ) {
    return fail(path, 'must be null or a positive finite safe-range number');
  }
  return value;
}

export function validateNameStatSummaryTuple(
  value: unknown,
  path: string,
): NameStatSummaryTuple {
  if (!Array.isArray(value) || value.length !== 3) {
    return fail(path, 'must be a dense three-item tuple');
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      return fail(`${path}[${index}]`, 'must not be sparse');
    }
  }
  const popularityRank = requirePopularityRank(value[0], `${path}[0]`);
  const maleBirths = requireBirthCount(value[1], `${path}[1]`);
  const femaleBirths = requireBirthCount(value[2], `${path}[2]`);
  if (!Number.isSafeInteger(maleBirths + femaleBirths)) {
    return fail(path, 'must have a safe-integer male and female total');
  }
  return [popularityRank, maleBirths, femaleBirths];
}

export function validateNameStatSummaryDocument(
  value: unknown,
  options: NameStatSummaryValidationOptions = {},
): NameStatSummaryDocument {
  const expectedRowCount =
    options.expectedRowCount ?? NAME_STAT_SUMMARY_EXPECTED_ROW_COUNT;
  if (!Number.isSafeInteger(expectedRowCount) || expectedRowCount < 0) {
    throw new TypeError('expectedRowCount must be a non-negative safe integer.');
  }

  const document = requireRecord(value, 'document');
  assertExactKeys(
    document,
    ['schemaVersion', 'sourceAssetSetSha256', 'rowCount', 'entries'],
    'document',
  );
  if (document.schemaVersion !== NAME_STAT_SUMMARY_SCHEMA_VERSION) {
    fail('schemaVersion', `must equal ${NAME_STAT_SUMMARY_SCHEMA_VERSION}`);
  }
  const sourceAssetSetSha256 = requireSha256(
    document.sourceAssetSetSha256,
    'sourceAssetSetSha256',
  );
  if (
    options.expectedSourceAssetSetSha256 !== undefined
    && sourceAssetSetSha256 !== options.expectedSourceAssetSetSha256
  ) {
    fail('sourceAssetSetSha256', 'does not match the current source asset set');
  }
  const rowCount = requireExpectedRowCount(document.rowCount, expectedRowCount);
  const entries = requireRecord(document.entries, 'entries');
  const names = Object.keys(entries);
  if (names.length !== rowCount) {
    fail('entries', `must contain exactly ${rowCount} names`);
  }

  const sortedNames = [...names].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0);
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    if (name !== sortedNames[index]) {
      fail('entries', 'must use code-unit-sorted keys');
    }
    if (name.length === 0 || name.normalize('NFC') !== name) {
      fail(`entries.${name}`, 'must use a non-empty NFC name');
    }
    const firstCodePoint = name.codePointAt(0);
    if (
      firstCodePoint === undefined
      || firstCodePoint < 0xac00
      || firstCodePoint > 0xd7a3
    ) {
      fail(`entries.${name}`, 'must begin with a precomposed Hangul syllable');
    }
    validateNameStatSummaryTuple(entries[name], `entries.${name}`);
  }

  return document as unknown as NameStatSummaryDocument;
}
