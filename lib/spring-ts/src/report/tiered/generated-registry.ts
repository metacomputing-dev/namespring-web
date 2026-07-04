/**
 * generated-registry.ts -- Lazy access to per-class generated articles.
 *
 * The class corpus (data/generated/<category>/<classId>.json) can reach tens of
 * thousands of files, so it is loaded LAZILY (never eager-globbed) to keep the
 * browser bundle small — the exact bloat the article-engine rewrite removed.
 *
 * Node: read the specific file on demand (memoised). Browser: returns null for
 * now (the tiered matrix is built server/offline); a future lazy import.meta.glob
 * wiring can serve the browser path. Either way, a miss falls back to the base
 * article pool, so selection degrades gracefully as generation fills in.
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

const cache = new Map<string, Article | null>();

/** Return the generated article for a classId, or null (→ base fallback). */
export function getGeneratedArticle(category: string, classId: string): Article | null {
  if (!nodeBuiltins || !GENERATED_DIR) return null; // browser: fall back to base pool
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

/** Test-only — clear the memo cache. */
export function _clearGeneratedCacheForTesting(): void {
  cache.clear();
}
