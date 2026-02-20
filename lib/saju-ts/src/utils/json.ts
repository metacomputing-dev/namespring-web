export function stableStringify(value: unknown, space?: number): string {
  return JSON.stringify(stableClone(value), null, space);
}

/**
 * Canonical JSON string used for deterministic artifacts.
 *
 * We keep a stable key ordering and a fixed indentation.
 */
export function canonicalJson(value: unknown): string {
  return stableStringify(value, 2);
}

function stableClone(value: any): any {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'number' || t === 'string' || t === 'boolean') return value;
  if (t !== 'object') return value;

  if (Array.isArray(value)) return value.map(stableClone);

  const out: Record<string, unknown> = {};
  const keys = Object.keys(value).sort();
  for (const k of keys) {
    out[k] = stableClone(value[k]);
  }
  return out;
}
