/**
 * generated-registry.ts -- Access to per-class generated articles.
 *
 * The class corpus (21,060 files) is NEVER eager-globbed — that would recreate
 * the bundle bloat the article-engine rewrite removed.
 *
 * - Node: read the specific file on demand (memoised) from data/generated/.
 * - Browser: `preloadGeneratedForPerson()` fetches ONE packed bundle per
 *   category (the person's fixed 강약·격국·nameEffect·성별 axes) from the static
 *   `/generated-packed/` assets, populating a cache; `getGeneratedArticle()`
 *   then reads that cache synchronously (so buildTieredMatrix stays sync).
 *
 * A miss falls back to the base article pool, so selection degrades gracefully.
 */
import type { Article } from './article-registry.js';

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
function isNodeRuntime(): boolean {
  return !isBrowserRuntime() && typeof process !== 'undefined' && Boolean(process.versions?.node);
}

const nodeBuiltins = isNodeRuntime()
  ? await (async () => {
    const [fs, path, url] = await Promise.all([import('node:fs'), import('node:path'), import('node:url')]);
    return { fs, path, fileURLToPath: url.fileURLToPath };
  })()
  : null;

const GENERATED_DIR = nodeBuiltins
  ? nodeBuiltins.path.resolve(
    nodeBuiltins.path.dirname(nodeBuiltins.fileURLToPath(import.meta.url)),
    '../../../data/generated',
  )
  : null;

function isValidGenerated(value: unknown): value is Article {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return a.schemaVersion === 'spring-ts.article.v1'
    && typeof a.articleId === 'string'
    && Array.isArray(a.body) && a.body.every((p) => typeof p === 'string')
    && Array.isArray(a.expert) && a.expert.every((p) => typeof p === 'string')
    && typeof a.summary === 'string';
}

const cache = new Map<string, Article | null>();       // node: per-file memo (key `cat/classId`)
const browserCache = new Map<string, Article>();       // browser: classId → article (from bundles)

/**
 * Browser only — fetch one packed bundle per category (keyed by the person's
 * fixed axes) into the cache. Node is a no-op (getGeneratedArticle reads fs).
 * Never rejects: a failed fetch just leaves that category on base fallback.
 */
export async function preloadGeneratedForPerson(
  entries: ReadonlyArray<{ category: string; packKey: string | null }>,
): Promise<void> {
  if (nodeBuiltins) return; // node: fs path handles it
  if (typeof fetch !== 'function') return;
  await Promise.all(entries.map(async ({ category, packKey }) => {
    if (!packKey) return;
    try {
      const res = await fetch(`/generated-packed/${category}/${packKey}.json`);
      if (!res.ok) return;
      const bundle = (await res.json()) as Record<string, unknown>;
      for (const [classId, article] of Object.entries(bundle)) {
        if (isValidGenerated(article)) browserCache.set(classId, article);
      }
    } catch {
      // leave this category on base fallback
    }
  }));
}

/** Return the generated article for a classId, or null (→ base fallback). */
export function getGeneratedArticle(category: string, classId: string): Article | null {
  if (!nodeBuiltins || !GENERATED_DIR) {
    return browserCache.get(classId) ?? null; // browser: from preloaded bundles
  }
  const key = `${category}/${classId}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const file = nodeBuiltins.path.join(GENERATED_DIR, category, `${classId}.json`);
  let article: Article | null = null;
  try {
    if (nodeBuiltins.fs.existsSync(file)) {
      const parsed: unknown = JSON.parse(nodeBuiltins.fs.readFileSync(file, 'utf-8'));
      if (isValidGenerated(parsed)) article = parsed;
    }
  } catch {
    article = null;
  }
  cache.set(key, article);
  return article;
}

/** Test-only — clear the memo caches. */
export function _clearGeneratedCacheForTesting(): void {
  cache.clear();
  browserCache.clear();
}
