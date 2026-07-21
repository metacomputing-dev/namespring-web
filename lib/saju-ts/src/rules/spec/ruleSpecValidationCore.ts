export type KnownRuleSpecTarget =
  | 'yongshin'
  | 'gyeokguk'
  | 'shinsal'
  | 'shinsalConditions';

/** Raised before a malformed data-driven rule specification can be compiled. */
export class InvalidRuleSpecError extends TypeError {
  readonly code = 'SAJU_INVALID_RULE_SPEC';
  readonly path: string;
  readonly target: string;
  readonly expected: string;

  constructor(target: string, path: string, expected: string) {
    super(`Invalid ${target} rule specification at ${path}: expected ${expected}.`);
    this.name = 'InvalidRuleSpecError';
    this.target = target;
    this.path = path;
    this.expected = expected;
  }
}

export type DataRecord = Record<string, unknown>;

export const KNOWN_TARGETS = new Set<KnownRuleSpecTarget>([
  'yongshin',
  'gyeokguk',
  'shinsal',
  'shinsalConditions',
]);

export const ELEMENTS = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;
export const ROLES = [
  'COMPANION',
  'RESOURCE',
  'OUTPUT',
  'WEALTH',
  'OFFICER',
] as const;
export const FOLLOW_TYPES = [
  'CONG_CAI',
  'CONG_GUAN',
  'CONG_SHA',
  'CONG_ER',
  'CONG_YIN',
  'CONG_BI',
] as const;
export const DAMAGE_KEYS = [
  'CHUNG',
  'HAE',
  'PA',
  'WONJIN',
  'HYEONG',
  'HAP',
  'GONGMANG',
] as const;

const UNSAFE_PROPERTY_NAMES = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

export function fail(target: string, path: string, expected: string): never {
  throw new InvalidRuleSpecError(target, path, expected);
}

export function hasOwn(record: DataRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function assertSafeDynamicKey(
  key: string,
  target: string,
  path: string,
): void {
  if (UNSAFE_PROPERTY_NAMES.has(key)) {
    fail(target, path, 'a key without prototype-polluting names');
  }
}

export function assertSafeDottedKey(
  key: string,
  target: string,
  path: string,
): void {
  if (key.split('.').some((segment) => UNSAFE_PROPERTY_NAMES.has(segment))) {
    fail(target, path, 'a key without prototype-polluting path segments');
  }
}

export function isPlainRecord(value: unknown): value is DataRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertDataOnly(
  value: unknown,
  target: string,
  path: string,
  visiting = new WeakSet<object>(),
  visited = new WeakSet<object>(),
  depth = 0,
): void {
  if (depth > 100) fail(target, path, 'a data graph no deeper than 100 levels');
  if (typeof value === 'number' && !Number.isFinite(value)) {
    fail(target, path, 'a finite number');
  }
  if (
    typeof value === 'undefined'
    || typeof value === 'function'
    || typeof value === 'symbol'
    || typeof value === 'bigint'
  ) {
    fail(target, path, 'data-only JSON-compatible values');
  }
  if (value === null || typeof value !== 'object') return;

  const source = value as object;
  if (visiting.has(source)) fail(target, path, 'an acyclic data graph');
  if (visited.has(source)) return;
  if (!Array.isArray(value) && !isPlainRecord(value)) {
    fail(target, path, 'a plain data object');
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!hasOwn(value as unknown as DataRecord, String(index))) {
        fail(target, `${path}[${index}]`, 'a non-sparse array entry');
      }
    }
  }

  visiting.add(source);
  for (const key of Reflect.ownKeys(source)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key === 'symbol') fail(target, path, 'string-keyed data');
    if (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) {
      fail(target, `${path}.${key}`, 'an indexed array entry');
    }
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      fail(target, `${path}.${key}`, 'an enumerable data property');
    }
    assertDataOnly(
      descriptor.value,
      target,
      Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`,
      visiting,
      visited,
      depth + 1,
    );
  }
  visiting.delete(source);
  visited.add(source);
}

export function assertRecord(
  value: unknown,
  target: string,
  path: string,
): asserts value is DataRecord {
  if (!isPlainRecord(value)) fail(target, path, 'a plain object');
}

export function assertArray(
  value: unknown,
  target: string,
  path: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(target, path, 'an array');
}

export function assertKnownKeys(
  record: DataRecord,
  target: string,
  path: string,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      fail(target, `${path}.${key}`, 'a supported field');
    }
  }
}

export function assertRequiredString(
  record: DataRecord,
  key: string,
  target: string,
  path: string,
): string {
  const value = record[key];
  if (
    typeof value !== 'string'
    || value.trim().length === 0
    || value !== value.trim()
  ) {
    fail(target, path, 'a non-empty trimmed string');
  }
  return value;
}

export function assertOptionalString(
  record: DataRecord,
  key: string,
  target: string,
  path: string,
  requireNonEmpty = false,
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  const value = record[key];
  if (typeof value !== 'string') fail(target, path, 'a string');
  if (requireNonEmpty && (value.trim().length === 0 || value !== value.trim())) {
    fail(target, path, 'a non-empty trimmed string');
  }
}

export function assertOptionalBoolean(
  record: DataRecord,
  key: string,
  target: string,
  path: string,
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  if (typeof record[key] !== 'boolean') fail(target, path, 'a boolean');
}

export function assertFiniteNumber(
  value: unknown,
  target: string,
  path: string,
  options: { min?: number; max?: number; exclusiveMin?: boolean } = {},
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(target, path, 'a finite number');
  }
  if (
    options.min !== undefined
    && (options.exclusiveMin ? value <= options.min : value < options.min)
  ) {
    const comparator = options.exclusiveMin ? 'greater than' : 'at least';
    fail(target, path, `a finite number ${comparator} ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    fail(target, path, `a finite number at most ${options.max}`);
  }
}

export function assertOptionalFiniteNumber(
  record: DataRecord,
  key: string,
  target: string,
  path: string,
  options: { min?: number; max?: number; exclusiveMin?: boolean } = {},
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  assertFiniteNumber(record[key], target, path, options);
}

export function assertEnum(
  value: unknown,
  allowed: readonly string[],
  target: string,
  path: string,
): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(target, path, `one of ${allowed.map((item) => `"${item}"`).join(', ')}`);
  }
}

export function assertOptionalEnum(
  record: DataRecord,
  key: string,
  allowed: readonly string[],
  target: string,
  path: string,
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  assertEnum(record[key], allowed, target, path);
}

export function assertStringArrayValue(
  value: unknown,
  target: string,
  path: string,
  options: { nonEmpty?: boolean; unique?: boolean } = {},
): void {
  assertArray(value, target, path);
  if (options.nonEmpty && value.length === 0) {
    fail(target, path, 'a non-empty array of strings');
  }
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (
      typeof item !== 'string'
      || item.trim().length === 0
      || item !== item.trim()
    ) {
      fail(target, `${path}[${index}]`, 'a non-empty trimmed string');
    }
    if (options.unique && seen.has(item)) {
      fail(target, `${path}[${index}]`, 'a unique string');
    }
    seen.add(item);
  }
}

export function assertOptionalStringArray(
  record: DataRecord,
  key: string,
  target: string,
  path: string,
  options: { nonEmpty?: boolean; unique?: boolean } = {},
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  assertStringArrayValue(record[key], target, path, options);
}

export function assertEnumArrayValue(
  value: unknown,
  allowed: readonly string[],
  target: string,
  path: string,
  options: { nonEmpty?: boolean; unique?: boolean } = {},
): void {
  assertArray(value, target, path);
  if (options.nonEmpty && value.length === 0) {
    fail(target, path, 'a non-empty enum array');
  }
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    assertEnum(value[index], allowed, target, `${path}[${index}]`);
    const item = value[index] as string;
    if (options.unique && seen.has(item)) {
      fail(target, `${path}[${index}]`, 'a unique enum value');
    }
    seen.add(item);
  }
}

export function assertOptionalEnumArray(
  record: DataRecord,
  key: string,
  allowed: readonly string[],
  target: string,
  path: string,
  options: { nonEmpty?: boolean; unique?: boolean } = {},
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  assertEnumArrayValue(record[key], allowed, target, path, options);
}

function expectedScorePrefix(target: KnownRuleSpecTarget): string {
  if (target === 'shinsalConditions') return 'cond.penalty.';
  return `${target}.`;
}

export function assertGenericScoreKey(
  value: unknown,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  if (
    typeof value !== 'string'
    || value.trim().length === 0
    || value !== value.trim()
  ) {
    fail(target, path, 'a non-empty trimmed score key');
  }
  assertSafeDottedKey(value, target, path);
}

export function assertTargetMacroScoreKey(
  value: unknown,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  const exactKeys = target === 'yongshin'
    ? ELEMENTS.map((element) => `yongshin.${element}`)
    : target === 'shinsalConditions'
      ? DAMAGE_KEYS.map((key) => `cond.penalty.${key}`)
      : null;
  if (
    typeof value !== 'string'
    || value.trim().length === 0
    || value !== value.trim()
    || !value.startsWith(expectedScorePrefix(target))
    || value.length === expectedScorePrefix(target).length
    || (exactKeys !== null && !exactKeys.includes(value))
  ) {
    const expected = exactKeys === null
      ? `a non-empty score key under "${expectedScorePrefix(target)}"`
      : `one of ${exactKeys.map((key) => `"${key}"`).join(', ')}`;
    fail(target, path, expected);
  }
  assertSafeDottedKey(value, target, path);
}

export function assertOptionalTargetScoreKey(
  record: DataRecord,
  key: string,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  assertTargetMacroScoreKey(record[key], target, path);
}

export function assertOptionalGenericScoreKey(
  record: DataRecord,
  key: string,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  assertGenericScoreKey(record[key], target, path);
}

function assertMonthQuality(
  value: unknown,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  assertRecord(value, target, path);
  assertKnownKeys(
    value,
    target,
    path,
    [
      'minMultiplier',
      'minClarity',
      'minIntegrity',
      'requireQing',
      'excludeBroken',
      'excludeMixed',
      'excludeZhuo',
    ],
  );
  for (const key of ['minMultiplier', 'minClarity', 'minIntegrity']) {
    assertOptionalFiniteNumber(
      value,
      key,
      target,
      `${path}.${key}`,
      { min: 0, max: 1 },
    );
  }
  for (const key of [
    'requireQing',
    'excludeBroken',
    'excludeMixed',
    'excludeZhuo',
  ]) {
    assertOptionalBoolean(value, key, target, `${path}.${key}`);
  }
}

export function assertOptionalMonthQuality(
  record: DataRecord,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  if (!hasOwn(record, 'monthQuality') || record.monthQuality === undefined) return;
  assertMonthQuality(record.monthQuality, target, path);
}

function assertMonthQualityGate(
  value: unknown,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  assertRecord(value, target, path);
  assertKnownKeys(
    value,
    target,
    path,
    [
      'requireNotBroken',
      'requireNotMixed',
      'minMultiplier',
      'minIntegrity',
      'minClarity',
      'requireQingZhuo',
    ],
  );
  assertOptionalBoolean(
    value,
    'requireNotBroken',
    target,
    `${path}.requireNotBroken`,
  );
  assertOptionalBoolean(
    value,
    'requireNotMixed',
    target,
    `${path}.requireNotMixed`,
  );
  for (const key of ['minMultiplier', 'minIntegrity', 'minClarity']) {
    assertOptionalFiniteNumber(
      value,
      key,
      target,
      `${path}.${key}`,
      { min: 0, max: 1 },
    );
  }
  assertOptionalEnum(
    value,
    'requireQingZhuo',
    ['QING', 'ZHUO'],
    target,
    `${path}.requireQingZhuo`,
  );
}

export function assertOptionalQualityGate(
  record: DataRecord,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  if (!hasOwn(record, 'qualityGate') || record.qualityGate === undefined) return;
  assertMonthQualityGate(record.qualityGate, target, path);
}
