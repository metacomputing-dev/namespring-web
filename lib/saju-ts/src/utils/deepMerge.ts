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

export function deepMerge<T>(base: T, overlay: any): T {
  if (overlay == null) return base;

  // Array replacement
  if (Array.isArray(base) || Array.isArray(overlay)) {
    return (Array.isArray(overlay) ? overlay : base) as any;
  }

  // Object merge
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const out: Record<string, unknown> = { ...(base as any) };
    for (const [k, v] of Object.entries(overlay)) {
      if (k in out) {
        out[k] = deepMerge((out as any)[k], v);
      } else {
        out[k] = v;
      }
    }
    return out as any;
  }

  // Primitive replacement
  return overlay as any;
}
