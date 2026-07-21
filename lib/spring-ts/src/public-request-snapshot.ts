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
import type { ReportDeliveryRequestV1 } from './report/delivery/types.js';
import type { LocalCandidateSearchRequestV1 } from './experience/types.js';
import type {
  EvaluatePremiumReportRegistrationV1Input,
  PremiumReportRegistrationRequestV1,
} from './report/premium/types.js';

const MAX_PUBLIC_INPUT_DEPTH = 64;
const MAX_PUBLIC_INPUT_PROPERTIES = 100_000;
const MAX_PUBLIC_INPUT_ARRAY_LENGTH = 10_000;
const MAX_PUBLIC_INPUT_STRING_LENGTH = 16_384;
const MAX_PUBLIC_INPUT_STRING_CODE_UNITS = 1_048_576;

interface PublicInputLimits {
  readonly maxDepth: number;
  readonly maxProperties: number;
  readonly maxArrayLength: number;
  readonly maxStringLength: number;
  readonly maxStringCodeUnits: number;
}

const DEFAULT_PUBLIC_INPUT_LIMITS: PublicInputLimits = {
  maxDepth: MAX_PUBLIC_INPUT_DEPTH,
  maxProperties: MAX_PUBLIC_INPUT_PROPERTIES,
  maxArrayLength: MAX_PUBLIC_INPUT_ARRAY_LENGTH,
  maxStringLength: MAX_PUBLIC_INPUT_STRING_LENGTH,
  maxStringCodeUnits: MAX_PUBLIC_INPUT_STRING_CODE_UNITS,
};

const LOCAL_FREE_INPUT_LIMITS: PublicInputLimits = {
  maxDepth: 32,
  maxProperties: 2_048,
  maxArrayLength: 512,
  maxStringLength: 4_096,
  maxStringCodeUnits: 65_536,
};

interface PublicInputMetrics {
  readonly properties: number;
  readonly stringCodeUnits: number;
  /** Deepest descendant relative to the object that owns these metrics. */
  readonly maxRelativeDepth: number;
  readonly maxArrayLength: number;
  /** Includes both property keys and string values. */
  readonly maxStringLength: number;
}

const TRUSTED_PUBLIC_REQUEST_SNAPSHOTS = new WeakMap<object, PublicInputMetrics>();

interface PublicInputTraversalState {
  readonly seen: WeakMap<object, unknown>;
  readonly completedMetrics: WeakMap<object, PublicInputMetrics>;
  readonly active: WeakSet<object>;
  readonly omitUndefinedObjectProperties: boolean;
  readonly limits: PublicInputLimits;
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
    || state.totalProperties + count > state.limits.maxProperties
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
    || (enforceSingleValueLimit && count > state.limits.maxStringLength)
    || state.totalStringCodeUnits + count > state.limits.maxStringCodeUnits
  ) {
    throw invalidPublicRequestData();
  }
  state.totalStringCodeUnits += count;
}

function claimCompletedMetrics(
  state: PublicInputTraversalState,
  metrics: PublicInputMetrics,
  depth: number,
): void {
  if (
    depth + metrics.maxRelativeDepth > state.limits.maxDepth
    || metrics.maxArrayLength > state.limits.maxArrayLength
    || metrics.maxStringLength > state.limits.maxStringLength
  ) {
    throw invalidPublicRequestData();
  }
  claimPublicInputProperties(state, metrics.properties);
  claimPublicInputStringCodeUnits(state, metrics.stringCodeUnits, false);
}

interface PublicInputShapeMetrics {
  maxRelativeDepth: number;
  maxArrayLength: number;
  maxStringLength: number;
}

function mergeCompletedChildShape(
  shape: PublicInputShapeMetrics,
  child: unknown,
  state: PublicInputTraversalState,
): void {
  shape.maxRelativeDepth = Math.max(shape.maxRelativeDepth, 1);
  if (typeof child === 'string') {
    shape.maxStringLength = Math.max(shape.maxStringLength, child.length);
    return;
  }
  if (child === null || typeof child !== 'object') return;
  const childMetrics = state.completedMetrics.get(child);
  if (!childMetrics) throw invalidPublicRequestData();
  shape.maxRelativeDepth = Math.max(
    shape.maxRelativeDepth,
    1 + childMetrics.maxRelativeDepth,
  );
  shape.maxArrayLength = Math.max(shape.maxArrayLength, childMetrics.maxArrayLength);
  shape.maxStringLength = Math.max(shape.maxStringLength, childMetrics.maxStringLength);
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
  if (depth > state.limits.maxDepth) throw invalidPublicRequestData();
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
    claimCompletedMetrics(state, metrics, depth);
    return prior as T;
  }

  const trustedMetrics = TRUSTED_PUBLIC_REQUEST_SNAPSHOTS.get(value);
  if (trustedMetrics) {
    claimCompletedMetrics(state, trustedMetrics, depth);
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
        || length > state.limits.maxArrayLength
      ) {
        throw invalidPublicRequestData();
      }

      const clone: unknown[] = new Array(length);
      state.seen.set(value, clone);
      const keys = Reflect.ownKeys(value);
      let presentIndexes = 0;
      const shape: PublicInputShapeMetrics = {
        maxRelativeDepth: 0,
        maxArrayLength: length,
        maxStringLength: 0,
      };
      claimPublicInputProperties(state, length);
      for (let cursor = 0; cursor < keys.length; cursor += 1) {
        const key = keys[cursor];
        if (key === 'length') continue;
        if (typeof key !== 'string') throw invalidPublicRequestData();
        claimPublicInputStringCodeUnits(state, key.length, true);
        shape.maxStringLength = Math.max(shape.maxStringLength, key.length);
        const index = arrayIndexFromKey(key);
        if (index === null || index >= length) throw invalidPublicRequestData();
        const descriptor = requireDataDescriptor(value, key);
        if (!descriptor.enumerable) throw invalidPublicRequestData();
        presentIndexes += 1;
        const child = cloneAndFreezePublicInput(descriptor.value, state, depth + 1);
        mergeCompletedChildShape(shape, descriptor.value, state);
        Object.defineProperty(clone, key, {
          value: child,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      if (presentIndexes !== length) throw invalidPublicRequestData();
      const metrics = {
        properties: state.totalProperties - propertiesBefore,
        stringCodeUnits: state.totalStringCodeUnits - stringsBefore,
        ...shape,
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
    const shape: PublicInputShapeMetrics = {
      maxRelativeDepth: 0,
      maxArrayLength: 0,
      maxStringLength: 0,
    };
    claimPublicInputProperties(state, keys.length);
    for (let cursor = 0; cursor < keys.length; cursor += 1) {
      const key = keys[cursor];
      if (typeof key !== 'string') throw invalidPublicRequestData();
      claimPublicInputStringCodeUnits(state, key.length, true);
      shape.maxStringLength = Math.max(shape.maxStringLength, key.length);
      const descriptor = requireDataDescriptor(value, key);
      if (!descriptor.enumerable) throw invalidPublicRequestData();
      if (descriptor.value === undefined && state.omitUndefinedObjectProperties) {
        continue;
      }
      const child = cloneAndFreezePublicInput(descriptor.value, state, depth + 1);
      mergeCompletedChildShape(shape, descriptor.value, state);
      Object.defineProperty(clone, key, {
        value: child,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    const metrics = {
      properties: state.totalProperties - propertiesBefore,
      stringCodeUnits: state.totalStringCodeUnits - stringsBefore,
      ...shape,
    } satisfies PublicInputMetrics;
    state.completedMetrics.set(value, metrics);
    return freezeTrustedSnapshot(clone, metrics) as T;
  } finally {
    state.active.delete(value);
  }
}

function snapshotPublicInput<T>(
  value: T,
  options: {
    readonly omitUndefinedObjectProperties?: boolean;
    readonly limits?: PublicInputLimits;
  } = {},
): T {
  try {
    return cloneAndFreezePublicInput(value, {
      seen: new WeakMap(),
      completedMetrics: new WeakMap(),
      active: new WeakSet(),
      omitUndefinedObjectProperties: options.omitUndefinedObjectProperties === true,
      limits: options.limits ?? DEFAULT_PUBLIC_INPUT_LIMITS,
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

export function snapshotReportDeliveryRequestV1(
  request: ReportDeliveryRequestV1,
): ReportDeliveryRequestV1 {
  return snapshotPublicInput(request, {
    omitUndefinedObjectProperties: true,
    limits: LOCAL_FREE_INPUT_LIMITS,
  });
}

export function snapshotCandidateSearchRequestV1(
  request: LocalCandidateSearchRequestV1,
): LocalCandidateSearchRequestV1 {
  return snapshotPublicInput(request, {
    omitUndefinedObjectProperties: true,
    limits: LOCAL_FREE_INPUT_LIMITS,
  });
}

export function snapshotPremiumReportRegistrationRequestV1(
  request: PremiumReportRegistrationRequestV1,
): PremiumReportRegistrationRequestV1 {
  return snapshotPublicInput(request, {
    omitUndefinedObjectProperties: true,
    limits: LOCAL_FREE_INPUT_LIMITS,
  });
}

export function snapshotPremiumReportRegistrationEvaluationInputV1(
  input: EvaluatePremiumReportRegistrationV1Input,
): EvaluatePremiumReportRegistrationV1Input {
  return snapshotPublicInput(input, {
    omitUndefinedObjectProperties: true,
    limits: LOCAL_FREE_INPUT_LIMITS,
  });
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
