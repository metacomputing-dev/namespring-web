/**
 * article-registry.ts -- Static index over data/articles/**.articles.json
 *
 * The article is the atomic content unit of the tiered matrix: one
 * complete, human-reviewed piece of writing (summary + 3-4 body
 * paragraphs + expert evidence paragraphs + tips/cautions) keyed by
 * (category, period, audience, band). See docs/ARTICLE_STYLE_CONTRACT.md.
 *
 * Dual-runtime loading mirrors the seed/glossary loaders: browser builds
 * inline every bundle via import.meta.glob, Node walks the directory.
 */

import type { TieredCategoryId, TieredPeriodKind } from '../types.js';
import { snapshotArticle } from './article-snapshot.js';

declare global {
  interface ImportMeta {
    glob: (pattern: string, options?: { eager?: boolean }) => Record<string, unknown>;
  }
}

const browserArticleModules = (() => {
  try {
    return import.meta.glob('../../../data/articles/**/*.articles.json', { eager: true });
  } catch {
    return {};
  }
})();

export type ArticleAudience =
  | 'adult'
  | 'teen'
  | 'child'
  | 'stage-teen'
  | 'stage-early'
  | 'stage-mid'
  | 'stage-senior'
  | 'stage-elder';

export type ArticleBand = 'high' | 'mid' | 'low' | 'any';

export const ARTICLE_AUDIENCES: readonly ArticleAudience[] = Object.freeze([
  'adult', 'teen', 'child',
  'stage-teen', 'stage-early', 'stage-mid', 'stage-senior', 'stage-elder',
] as const);

export const ARTICLE_BANDS: readonly ArticleBand[] = Object.freeze([
  'high', 'mid', 'low', 'any',
] as const);

export interface Article {
  readonly schemaVersion: 'spring-ts.article.v1';
  readonly articleId: string;
  readonly category: 'overall' | TieredCategoryId;
  readonly period: TieredPeriodKind;
  readonly audience: ArticleAudience;
  readonly band: ArticleBand;
  readonly summary: string;
  readonly hook?: string;
  readonly body: readonly string[];
  readonly expert: readonly string[];
  readonly livingTips?: readonly string[];
  readonly cautions?: readonly string[];
  readonly aiGenerated: boolean;
  readonly sourceNote?: string;
}

interface ArticleBundle {
  schemaVersion: string;
  bundleId: string;
  articles: Article[];
}

type PoolKey = string;

function poolKey(category: string, period: string, audience: string): PoolKey {
  return `${category}|${period}|${audience}`;
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isNodeRuntime(): boolean {
  return !isBrowserRuntime() && typeof process !== 'undefined' && Boolean(process.versions?.node);
}

const nodeBuiltins = isNodeRuntime()
  ? await (async () => {
    const [fsModule, pathModule, urlModule] = await Promise.all([
      import('node:fs'),
      import('node:path'),
      import('node:url'),
    ]);
    return {
      fs: fsModule,
      path: pathModule,
      fileURLToPath: urlModule.fileURLToPath,
    };
  })()
  : null;

function unwrapJsonModule(moduleValue: unknown): unknown {
  if (moduleValue && typeof moduleValue === 'object' && 'default' in moduleValue) {
    return (moduleValue as { default?: unknown }).default;
  }
  return moduleValue;
}

function isValidArticle(value: unknown): value is Article {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return a.schemaVersion === 'spring-ts.article.v1'
    && typeof a.articleId === 'string'
    && typeof a.category === 'string'
    && typeof a.period === 'string'
    && typeof a.audience === 'string'
    && (ARTICLE_AUDIENCES as readonly string[]).includes(a.audience as string)
    && (ARTICLE_BANDS as readonly string[]).includes(a.band as string)
    && typeof a.summary === 'string'
    && Array.isArray(a.body) && a.body.every((p) => typeof p === 'string')
    && Array.isArray(a.expert) && a.expert.every((p) => typeof p === 'string');
}

function listArticleBundles(rootDir: string): string[] {
  const out: string[] = [];
  const fsApi = nodeBuiltins?.fs;
  const pathApi = nodeBuiltins?.path;
  if (!fsApi || !pathApi || !fsApi.existsSync(rootDir)) return out;
  function walk(dir: string): void {
    for (const entry of fsApi!.readdirSync(dir, { withFileTypes: true })) {
      const full = pathApi!.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.articles.json')) out.push(full);
    }
  }
  walk(rootDir);
  out.sort();
  return out;
}

export interface ArticleRegistry {
  get(category: 'overall' | TieredCategoryId, period: TieredPeriodKind, audience: ArticleAudience): readonly Article[];
  readonly all: readonly Article[];
  readonly totalArticleCount: number;
  readonly aiGeneratedCount: number;
}

let cachedRegistry: ArticleRegistry | null = null;
const EMPTY_ARTICLES: readonly Article[] = Object.freeze([]);

function buildRegistry(articles: Article[]): ArticleRegistry {
  // Deterministic pool order regardless of file-system enumeration order.
  const snapshots = articles
    .map(snapshotArticle)
    .sort((a, b) => a.articleId.localeCompare(b.articleId));
  const map = new Map<PoolKey, Article[]>();
  let aiGenerated = 0;
  for (const article of snapshots) {
    const key = poolKey(article.category, article.period, article.audience);
    const list = map.get(key);
    if (list) list.push(article);
    else map.set(key, [article]);
    if (article.aiGenerated) aiGenerated += 1;
  }
  const immutablePools = new Map<PoolKey, readonly Article[]>(
    [...map.entries()].map(([key, pool]) => [key, Object.freeze(pool)]),
  );
  const all = Object.freeze(snapshots);
  return Object.freeze({
    get(category: 'overall' | TieredCategoryId, period: TieredPeriodKind, audience: ArticleAudience) {
      return immutablePools.get(poolKey(category, period, audience)) ?? EMPTY_ARTICLES;
    },
    all,
    totalArticleCount: all.length,
    aiGeneratedCount: aiGenerated,
  });
}

export function loadArticleRegistry(): ArticleRegistry {
  if (cachedRegistry) return cachedRegistry;

  const articles: Article[] = [];

  if (isNodeRuntime() && nodeBuiltins) {
    const here = nodeBuiltins.path.dirname(nodeBuiltins.fileURLToPath(import.meta.url));
    const articlesDir = nodeBuiltins.path.resolve(here, '../../../data/articles');
    for (const file of listArticleBundles(articlesDir)) {
      let bundle: ArticleBundle;
      try {
        bundle = JSON.parse(nodeBuiltins.fs.readFileSync(file, 'utf-8')) as ArticleBundle;
      } catch {
        continue;
      }
      if (!Array.isArray(bundle?.articles)) continue;
      for (const article of bundle.articles) {
        if (isValidArticle(article)) articles.push(article);
      }
    }
  } else {
    for (const moduleValue of Object.values(browserArticleModules)) {
      const bundle = unwrapJsonModule(moduleValue) as ArticleBundle;
      if (!Array.isArray(bundle?.articles)) continue;
      for (const article of bundle.articles) {
        if (isValidArticle(article)) articles.push(article);
      }
    }
  }

  cachedRegistry = buildRegistry(articles);
  return cachedRegistry;
}

/** Test-only — clear the memo cache so a test can re-load freshly. */
export function _clearArticleRegistryCacheForTesting(): void {
  cachedRegistry = null;
}
