import { deepFreeze } from '../../../../seed-ts/src/utils/deep-freeze.js';
import type { Article } from './article-registry.js';

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
 * Copies an Article into a process-owned immutable value.
 *
 * JSON loaders and browser fetch implementations can retain references to
 * their decoded payloads. Building an exact snapshot prevents those external
 * owners, as well as report consumers, from mutating process-global caches.
 * Unknown JSON fields are preserved so cache isolation does not also become an
 * implicit schema migration.
 */
export function snapshotArticle(article: Article): Article {
  return deepFreeze(cloneJsonValue(article));
}
