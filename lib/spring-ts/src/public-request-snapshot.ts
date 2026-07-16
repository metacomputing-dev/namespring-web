import type {
  FortuneReportOptions,
  FortuneReportRequest,
} from './report/types.js';
import type {
  BirthInfo,
  SajuReport,
  SajuSummary,
  SpringReport,
  SpringRequest,
} from './types.js';

const MAX_PUBLIC_INPUT_DEPTH = 64;
const MAX_PUBLIC_INPUT_PROPERTIES = 100_000;
const MAX_PUBLIC_INPUT_ARRAY_LENGTH = 10_000;
const MAX_PUBLIC_INPUT_STRING_LENGTH = 16_384;
const MAX_PUBLIC_INPUT_STRING_CODE_UNITS = 1_048_576;

interface PublicInputMetrics {
  readonly properties: number;
  readonly stringCodeUnits: number;
}

const TRUSTED_PUBLIC_REQUEST_SNAPSHOTS = new WeakMap<object, PublicInputMetrics>();

interface PublicInputTraversalState {
  readonly seen: WeakMap<object, unknown>;
  readonly completedMetrics: WeakMap<object, PublicInputMetrics>;
  readonly active: WeakSet<object>;
  readonly omitUndefinedObjectProperties: boolean;
  totalProperties: number;
  totalStringCodeUnits: number;
}

const PUBLIC_REQUEST_DATA_ERROR =
  'Spring public request inputs must contain only bounded JSON-compatible plain data.';

function invalidPublicRequestData(): TypeError {
  return new TypeError(PUBLIC_REQUEST_DATA_ERROR);
}

function freezeTrustedSnapshot<T extends object>(
  value: T,
  metrics: PublicInputMetrics,
): T {
  Object.freeze(value);
  TRUSTED_PUBLIC_REQUEST_SNAPSHOTS.set(value, metrics);
  return value;
}

function requireDataDescriptor(
  value: object,
  key: PropertyKey,
): PropertyDescriptor & { readonly value: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) throw invalidPublicRequestData();
  return descriptor as PropertyDescriptor & { readonly value: unknown };
}

function arrayIndexFromKey(key: string): number | null {
  if (!/^(0|[1-9]\d*)$/u.test(key)) return null;
  const index = Number(key);
  return Number.isSafeInteger(index)
    && index >= 0
    && index < 0xffff_ffff
    && String(index) === key
    ? index
    : null;
}

function claimPublicInputProperties(
  state: PublicInputTraversalState,
  count: number,
): void {
  if (
    !Number.isSafeInteger(count)
    || count < 0
    || state.totalProperties + count > MAX_PUBLIC_INPUT_PROPERTIES
  ) {
    throw invalidPublicRequestData();
  }
  state.totalProperties += count;
}

function claimPublicInputStringCodeUnits(
  state: PublicInputTraversalState,
  count: number,
  enforceSingleValueLimit: boolean,
): void {
  if (
    !Number.isSafeInteger(count)
    || count < 0
    || (enforceSingleValueLimit && count > MAX_PUBLIC_INPUT_STRING_LENGTH)
    || state.totalStringCodeUnits + count > MAX_PUBLIC_INPUT_STRING_CODE_UNITS
  ) {
    throw invalidPublicRequestData();
  }
  state.totalStringCodeUnits += count;
}

function claimCompletedMetrics(
  state: PublicInputTraversalState,
  metrics: PublicInputMetrics,
): void {
  claimPublicInputProperties(state, metrics.properties);
  claimPublicInputStringCodeUnits(state, metrics.stringCodeUnits, false);
}

/**
 * Clone caller-owned request data before an endpoint performs its first await.
 *
 * Declared Spring and Fortune inputs are bounded JSON-compatible trees. Exotic
 * objects, cycles, sparse arrays, accessors, symbols, non-finite numbers, and
 * non-enumerable data fail closed. Every accepted property is read from its
 * descriptor, so cloning never executes an ordinary caller-owned getter or
 * array iterator. Completed shared aliases retain identity inside the clone.
 */
function cloneAndFreezePublicInput<T>(
  value: T,
  state: PublicInputTraversalState,
  depth: number,
): T {
  if (depth > MAX_PUBLIC_INPUT_DEPTH) throw invalidPublicRequestData();
  if (value === null) return value;

  if (typeof value === 'string') {
    claimPublicInputStringCodeUnits(state, value.length, true);
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw invalidPublicRequestData();
    return value;
  }
  if (typeof value !== 'object') throw invalidPublicRequestData();

  if (value instanceof Date) throw invalidPublicRequestData();
  if (state.active.has(value)) throw invalidPublicRequestData();

  const prior = state.seen.get(value);
  if (prior !== undefined) {
    const metrics = state.completedMetrics.get(value);
    if (!metrics) throw invalidPublicRequestData();
    claimCompletedMetrics(state, metrics);
    return prior as T;
  }

  const trustedMetrics = TRUSTED_PUBLIC_REQUEST_SNAPSHOTS.get(value);
  if (trustedMetrics) {
    claimCompletedMetrics(state, trustedMetrics);
    state.seen.set(value, value);
    state.completedMetrics.set(value, trustedMetrics);
    return value;
  }

  const propertiesBefore = state.totalProperties;
  const stringsBefore = state.totalStringCodeUnits;
  state.active.add(value);
  try {
    if (Array.isArray(value)) {
      const lengthDescriptor = requireDataDescriptor(value, 'length');
      const length = lengthDescriptor.value;
      if (
        lengthDescriptor.enumerable
        || typeof length !== 'number'
        || !Number.isSafeInteger(length)
        || length < 0
        || length > MAX_PUBLIC_INPUT_ARRAY_LENGTH
      ) {
        throw invalidPublicRequestData();
      }

      const clone: unknown[] = new Array(length);
      state.seen.set(value, clone);
      const keys = Reflect.ownKeys(value);
      let presentIndexes = 0;
      claimPublicInputProperties(state, length);
      for (let cursor = 0; cursor < keys.length; cursor += 1) {
        const key = keys[cursor];
        if (key === 'length') continue;
        if (typeof key !== 'string') throw invalidPublicRequestData();
        claimPublicInputStringCodeUnits(state, key.length, true);
        const index = arrayIndexFromKey(key);
        if (index === null || index >= length) throw invalidPublicRequestData();
        const descriptor = requireDataDescriptor(value, key);
        if (!descriptor.enumerable) throw invalidPublicRequestData();
        presentIndexes += 1;
        Object.defineProperty(clone, key, {
          value: cloneAndFreezePublicInput(descriptor.value, state, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      if (presentIndexes !== length) throw invalidPublicRequestData();
      const metrics = {
        properties: state.totalProperties - propertiesBefore,
        stringCodeUnits: state.totalStringCodeUnits - stringsBefore,
      } satisfies PublicInputMetrics;
      state.completedMetrics.set(value, metrics);
      return freezeTrustedSnapshot(clone, metrics) as T;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw invalidPublicRequestData();
    }

    const clone: Record<PropertyKey, unknown> = prototype === null
      ? Object.create(null) as Record<PropertyKey, unknown>
      : {};
    state.seen.set(value, clone);
    const keys = Reflect.ownKeys(value);
    claimPublicInputProperties(state, keys.length);
    for (let cursor = 0; cursor < keys.length; cursor += 1) {
      const key = keys[cursor];
      if (typeof key !== 'string') throw invalidPublicRequestData();
      claimPublicInputStringCodeUnits(state, key.length, true);
      const descriptor = requireDataDescriptor(value, key);
      if (!descriptor.enumerable) throw invalidPublicRequestData();
      if (descriptor.value === undefined && state.omitUndefinedObjectProperties) {
        continue;
      }
      Object.defineProperty(clone, key, {
        value: cloneAndFreezePublicInput(descriptor.value, state, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    const metrics = {
      properties: state.totalProperties - propertiesBefore,
      stringCodeUnits: state.totalStringCodeUnits - stringsBefore,
    } satisfies PublicInputMetrics;
    state.completedMetrics.set(value, metrics);
    return freezeTrustedSnapshot(clone, metrics) as T;
  } finally {
    state.active.delete(value);
  }
}

function snapshotPublicInput<T>(
  value: T,
  options: { readonly omitUndefinedObjectProperties?: boolean } = {},
): T {
  try {
    return cloneAndFreezePublicInput(value, {
      seen: new WeakMap(),
      completedMetrics: new WeakMap(),
      active: new WeakSet(),
      omitUndefinedObjectProperties: options.omitUndefinedObjectProperties === true,
      totalProperties: 0,
      totalStringCodeUnits: 0,
    }, 0);
  } catch {
    throw invalidPublicRequestData();
  }
}

export function snapshotSpringRequest(request: SpringRequest): SpringRequest {
  return snapshotPublicInput(request, { omitUndefinedObjectProperties: true });
}

export function snapshotFortuneReportRequest(
  request: FortuneReportRequest,
): FortuneReportRequest {
  return snapshotPublicInput(request, { omitUndefinedObjectProperties: true });
}

export function snapshotSajuReport(report: SajuReport): SajuReport {
  // Adapter-produced reports can own optional fields whose value is undefined.
  // Omit those object properties exactly as JSON serialization would, while
  // keeping arrays and all public request inputs strict and bounded.
  return snapshotPublicInput(report, { omitUndefinedObjectProperties: true });
}

export function snapshotSajuAnalysisInput(
  birth: BirthInfo,
  options?: SpringRequest['options'],
): {
  readonly birth: BirthInfo;
  readonly options?: SpringRequest['options'];
} {
  return snapshotPublicInput({
    birth,
    ...(options === undefined ? {} : { options }),
  }, { omitUndefinedObjectProperties: true });
}

export function snapshotFortuneReportBuildInput(
  saju: SajuSummary,
  springReport: SpringReport | null,
  options?: FortuneReportOptions,
  birth?: BirthInfo,
): {
  readonly saju: SajuSummary;
  readonly springReport: SpringReport | null;
  readonly options?: FortuneReportOptions;
  readonly birth?: BirthInfo;
} {
  return snapshotPublicInput({
    saju,
    springReport,
    ...(options === undefined ? {} : { options }),
    ...(birth === undefined ? {} : { birth }),
  }, { omitUndefinedObjectProperties: true });
}
