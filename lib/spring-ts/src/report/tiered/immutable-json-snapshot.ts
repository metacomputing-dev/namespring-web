import { deepFreeze } from '../../../../seed-ts/src/utils/deep-freeze.js';

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValue(entry)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, cloneJsonValue(entry)]),
    ) as unknown as T;
  }
  return value;
}

/**
 * Copies a JSON-decoded value into a process-owned immutable snapshot.
 *
 * JSON loaders and browser fetch implementations can retain references to
 * their decoded payloads. Building an exact snapshot prevents those external
 * owners, as well as report consumers, from mutating process-global caches.
 * Unknown JSON fields are preserved so cache isolation does not also become an
 * implicit schema migration.
 */
export function snapshotJsonValue<T>(value: T): T {
  return deepFreeze(cloneJsonValue(value));
}
