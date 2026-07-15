/**
 * A tiny deep-merge utility for config overlays.
 *
 * - Objects: merged recursively
 * - Arrays: replaced (overlay wins)
 * - Primitives: replaced (overlay wins)
 */

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== 'object') return false;
  if (Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

export class UnsupportedDeepDataError extends TypeError {
  readonly code = 'SAJU_UNSUPPORTED_CONFIG_DATA';

  constructor(value: unknown) {
    const tag = Object.prototype.toString.call(value);
    super(`Engine configuration must be data-only; unsupported value: ${tag}`);
    this.name = 'UnsupportedDeepDataError';
  }
}

function assertSupportedPrimitive(value: unknown): void {
  if (
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    throw new UnsupportedDeepDataError(value);
  }
}

/**
 * Clone configuration/data objects without retaining caller-owned references.
 *
 * Engine configuration is JSON-shaped in normal use, but Date/Map/Set and
 * custom object prototypes are handled defensively so callers cannot mutate an
 * untouched branch of a merge and thereby alter a previously-created engine.
 */
export function deepClone<T>(value: T, seen: WeakMap<object, unknown> = new WeakMap()): T {
  if (value === null || typeof value !== 'object') {
    assertSupportedPrimitive(value);
    return value;
  }

  const source = value as object;
  const cached = seen.get(source);
  if (cached !== undefined) return cached as T;

  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new UnsupportedDeepDataError(value);
  }

  const out: any = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  seen.set(source, out);

  for (const key of Reflect.ownKeys(source)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key === 'symbol') throw new UnsupportedDeepDataError(key);
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor) continue;
    if ('value' in descriptor) {
      Object.defineProperty(out, key, {
        value: deepClone(descriptor.value, seen),
        enumerable: descriptor.enumerable,
        writable: true,
        configurable: true,
      });
    } else throw new UnsupportedDeepDataError(value);
  }

  return out as T;
}

/** Recursively freeze an engine-owned snapshot. */
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== 'object') {
    assertSupportedPrimitive(value);
    return value;
  }

  const source = value as object;
  if (seen.has(source)) return value;
  seen.add(source);

  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new UnsupportedDeepDataError(value);
  }
  for (const key of Reflect.ownKeys(source)) {
    if (typeof key === 'symbol') throw new UnsupportedDeepDataError(key);
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !('value' in descriptor)) {
      throw new UnsupportedDeepDataError(value);
    }
    deepFreeze(descriptor.value, seen);
  }

  return Object.freeze(value);
}

export function deepMerge<T>(base: T, overlay: any): T {
  if (overlay == null) return deepClone(base);

  // Array replacement
  if (Array.isArray(base) || Array.isArray(overlay)) {
    return deepClone(Array.isArray(overlay) ? overlay : base) as any;
  }

  // Object merge
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const out = deepClone(base) as Record<string, unknown>;
    for (const [k, v] of Object.entries(overlay)) {
      if (k in out) {
        out[k] = deepMerge((out as any)[k], v);
      } else {
        out[k] = deepClone(v);
      }
    }
    return out as any;
  }

  // Primitive replacement
  return deepClone(overlay) as any;
}
