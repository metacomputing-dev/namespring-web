/**
 * article-registry.ts -- Static index over data/articles/**.articles.json
 *
 * The article is the atomic content unit of the tiered matrix: one
 * complete, human-reviewed piece of writing (summary + 3-4 body
 * paragraphs + expert evidence paragraphs + tips/cautions) keyed by
 * (category, period, audience, band). See docs/ARTICLE_STYLE_CONTRACT.md.
 *
 * Dual-runtime loading mirrors the glossary loader. Legacy full-matrix calls
 * can still load every bundle, but ReportDeliveryV1 asks for exact
 * category/period shards. Browser builds keep those JSON files behind lazy
 * `import.meta.glob` functions so a mobile client downloads only the shards
 * used by the requested timeline. Node keeps a synchronous full loader for
 * existing tests and uses exact file paths for the selective async API.
 */

import type { TieredCategoryId, TieredPeriodKind } from '../types.js';
import { snapshotJsonValue } from './immutable-json-snapshot.js';

type JsonModuleLoader = () => Promise<unknown>;

const browserArticleLoaders = (() => {
  try {
    return import.meta.glob('../../../data/articles/**/*.articles.json') as Record<string, JsonModuleLoader>;
  } catch {
    return {} as Record<string, JsonModuleLoader>;
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

const ARTICLE_CATEGORIES: readonly ('overall' | TieredCategoryId)[] = Object.freeze([
  'overall', 'wealth', 'health', 'academic', 'romance', 'family', 'career',
  'study_document', 'expression_children', 'health_stress', 'movement',
] as const);

const ARTICLE_PERIODS: readonly TieredPeriodKind[] = Object.freeze([
  'life', 'today', 'thisWeek', 'thisMonth', 'thisYear',
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
  readonly schemaVersion: 'spring-ts.article-bundle.v1';
  readonly bundleId: string;
  readonly sourceTier: {
    readonly tier: string;
    readonly sourceType: string;
    readonly authorityTruthEligible: boolean;
  };
  readonly articles: readonly Article[];
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const actual = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && actual.every((key) => allowed.has(key));
}

function isBoundedText(value: unknown, maxLength = 8192): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value.trim().length > 0;
}

function isBoundedTextArray(
  value: unknown,
  options: { readonly min: number; readonly max: number },
): value is readonly string[] {
  return Array.isArray(value)
    && value.length >= options.min
    && value.length <= options.max
    && value.every((item) => isBoundedText(item));
}

function articleBundleError(shard: string, detail: string): never {
  throw new Error(`Invalid article shard ${shard}: ${detail}`);
}

/**
 * Validate an authored shard as one atomic contract. A malformed row rejects
 * the complete shard; silently dropping rows could otherwise turn a requested
 * report cell into an unrelated fallback without the caller noticing.
 */
export function assertArticleBundleForShard(
  shard: string,
  moduleValue: unknown,
): readonly Article[] {
  const parts = shard.split('/');
  if (parts.length !== 2) articleBundleError(shard, 'invalid shard id');
  const [category, shardPeriod] = parts;
  if (!(ARTICLE_CATEGORIES as readonly string[]).includes(category ?? '')) {
    articleBundleError(shard, 'unknown category');
  }
  if (!(ARTICLE_PERIODS as readonly string[]).includes(shardPeriod ?? '')
    && shardPeriod !== 'stages') {
    articleBundleError(shard, 'unknown period');
  }
  const expectedPeriod = shardPeriod === 'stages' ? 'life' : shardPeriod;
  const raw = unwrapJsonModule(moduleValue);
  if (!isPlainRecord(raw)
    || !hasExactKeys(raw, ['schemaVersion', 'bundleId', 'sourceTier', 'articles'])) {
    articleBundleError(shard, 'bundle shape');
  }
  if (raw.schemaVersion !== 'spring-ts.article-bundle.v1') {
    articleBundleError(shard, 'schemaVersion');
  }
  if (raw.bundleId !== `${category}.${shardPeriod}`) {
    articleBundleError(shard, 'bundleId');
  }
  if (!isPlainRecord(raw.sourceTier)
    || !hasExactKeys(raw.sourceTier, ['tier', 'sourceType', 'authorityTruthEligible'])
    || !isBoundedText(raw.sourceTier.tier, 128)
    || !isBoundedText(raw.sourceTier.sourceType, 128)
    || typeof raw.sourceTier.authorityTruthEligible !== 'boolean') {
    articleBundleError(shard, 'sourceTier');
  }
  if (!Array.isArray(raw.articles)
    || raw.articles.length === 0
    || raw.articles.length > 256) {
    articleBundleError(shard, 'articles cardinality');
  }

  const articleIds = new Set<string>();
  const articles: Article[] = [];
  for (const [index, value] of raw.articles.entries()) {
    if (!isPlainRecord(value)
      || !hasExactKeys(
        value,
        ['schemaVersion', 'articleId', 'category', 'period', 'audience', 'band',
          'summary', 'body', 'expert', 'aiGenerated'],
        ['hook', 'livingTips', 'cautions', 'sourceNote'],
      )) {
      articleBundleError(shard, `articles[${index}] shape`);
    }
    if (value.schemaVersion !== 'spring-ts.article.v1'
      || !isBoundedText(value.articleId, 256)
      || value.category !== category
      || value.period !== expectedPeriod
      || typeof value.audience !== 'string'
      || !(ARTICLE_AUDIENCES as readonly string[]).includes(value.audience)
      || typeof value.band !== 'string'
      || !(ARTICLE_BANDS as readonly string[]).includes(value.band)
      || !isBoundedText(value.summary)
      || (value.hook !== undefined && !isBoundedText(value.hook))
      || !isBoundedTextArray(value.body, { min: 1, max: 64 })
      || !isBoundedTextArray(value.expert, { min: 1, max: 64 })
      || (value.livingTips !== undefined
        && !isBoundedTextArray(value.livingTips, { min: 1, max: 64 }))
      || (value.cautions !== undefined
        && !isBoundedTextArray(value.cautions, { min: 1, max: 64 }))
      || typeof value.aiGenerated !== 'boolean'
      || (value.sourceNote !== undefined && !isBoundedText(value.sourceNote, 1024))) {
      articleBundleError(shard, `articles[${index}] fields`);
    }
    if (articleIds.has(value.articleId)) {
      articleBundleError(shard, `duplicate articleId ${value.articleId}`);
    }
    articleIds.add(value.articleId);
    articles.push(value as unknown as Article);
  }
  if (articles.some((article) => article.aiGenerated)
    && raw.sourceTier.authorityTruthEligible !== false) {
    articleBundleError(shard, 'AI-authored content cannot claim authority truth');
  }
  return Object.freeze(articles);
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
let cachedRegistryPromise: Promise<ArticleRegistry> | null = null;
const selectiveRegistryCache = new Map<string, Promise<ArticleRegistry>>();
const MAX_SELECTIVE_REGISTRY_CACHE_ENTRIES = 4;
const EMPTY_ARTICLES: readonly Article[] = Object.freeze([]);

function buildRegistry(articles: Article[]): ArticleRegistry {
  const articleIds = new Set<string>();
  for (const article of articles) {
    if (articleIds.has(article.articleId)) {
      throw new Error(`Duplicate articleId across loaded shards: ${article.articleId}`);
    }
    articleIds.add(article.articleId);
  }
  // Deterministic pool order regardless of file-system enumeration order.
  const snapshots = articles
    .map(snapshotJsonValue)
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
      let rawBundle: unknown;
      try {
        rawBundle = JSON.parse(nodeBuiltins.fs.readFileSync(file, 'utf-8')) as unknown;
      } catch (error) {
        throw new Error(`Article bundle unavailable: ${file}`, { cause: error });
      }
      const relative = nodeBuiltins.path.relative(articlesDir, file)
        .split(nodeBuiltins.path.sep).join('/');
      const shard = relative.slice(0, -'.articles.json'.length);
      articles.push(...assertArticleBundleForShard(shard, rawBundle));
    }
  } else {
    throw new Error('Browser article loading is asynchronous; use loadArticleRegistryAsync()');
  }

  cachedRegistry = buildRegistry(articles);
  return cachedRegistry;
}

function browserArticleLoaderByShard(): ReadonlyMap<string, JsonModuleLoader> {
  const out = new Map<string, JsonModuleLoader>();
  for (const [rawPath, loader] of Object.entries(browserArticleLoaders)) {
    const normalized = rawPath.replaceAll('\\', '/');
    const marker = '/data/articles/';
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex < 0 || !normalized.endsWith('.articles.json')) continue;
    const shard = normalized.slice(markerIndex + marker.length, -'.articles.json'.length);
    out.set(shard, loader);
  }
  return out;
}

const BROWSER_ARTICLE_LOADER_BY_SHARD = browserArticleLoaderByShard();

/** Stable exact shard identifiers used by both the Node and browser loaders. */
export function articleShardIdsForSelection(
  periods: readonly TieredPeriodKind[],
  categoriesByPeriod: Readonly<Partial<Record<
    TieredPeriodKind,
    readonly (TieredCategoryId | 'overall')[]
  >>>,
): readonly string[] {
  const shards = new Set<string>();
  for (const period of periods) {
    for (const category of categoriesByPeriod[period] ?? []) {
      shards.add(`${category}/${period}`);
    }
  }
  return Object.freeze([...shards].sort());
}

function loadNodeArticleShards(shards: readonly string[]): ArticleRegistry {
  const articles: Article[] = [];
  if (!nodeBuiltins) return buildRegistry(articles);
  const here = nodeBuiltins.path.dirname(nodeBuiltins.fileURLToPath(import.meta.url));
  const articlesDir = nodeBuiltins.path.resolve(here, '../../../data/articles');
  for (const shard of shards) {
    const file = nodeBuiltins.path.resolve(articlesDir, `${shard}.articles.json`);
    // Shards are derived only from closed period/category unions, but retain a
    // containment check before touching the filesystem.
    if (!file.startsWith(`${articlesDir}${nodeBuiltins.path.sep}`)) {
      throw new Error(`Article shard escaped its root: ${shard}`);
    }
    let bundle: unknown;
    try {
      bundle = JSON.parse(nodeBuiltins.fs.readFileSync(file, 'utf-8')) as unknown;
    } catch (error) {
      throw new Error(`Article shard unavailable: ${shard}`, { cause: error });
    }
    articles.push(...assertArticleBundleForShard(shard, bundle));
  }
  return buildRegistry(articles);
}

async function loadBrowserArticleShards(shards: readonly string[]): Promise<ArticleRegistry> {
  const modules = await Promise.all(
    shards.map(async (shard) => {
      const loader = BROWSER_ARTICLE_LOADER_BY_SHARD.get(shard);
      if (!loader) throw new Error(`Article shard loader unavailable: ${shard}`);
      return { shard, moduleValue: await loader() };
    }),
  );
  const articles: Article[] = [];
  for (const { shard, moduleValue } of modules) {
    articles.push(...assertArticleBundleForShard(shard, moduleValue));
  }
  return buildRegistry(articles);
}

/** Full async registry for the legacy tiered matrix. Public report output is
 * unchanged; only browser transport changes from one eager payload to lazy
 * chunks that are awaited when the opt-in legacy matrix is requested. */
export function loadArticleRegistryAsync(): Promise<ArticleRegistry> {
  if (cachedRegistry) return Promise.resolve(cachedRegistry);
  if (cachedRegistryPromise) return cachedRegistryPromise;
  if (isNodeRuntime()) {
    cachedRegistryPromise = Promise.resolve(loadArticleRegistry());
    return cachedRegistryPromise;
  }
  cachedRegistryPromise = loadBrowserArticleShards([...BROWSER_ARTICLE_LOADER_BY_SHARD.keys()].sort())
    .then((registry) => {
      cachedRegistry = registry;
      return registry;
    })
    .catch((error: unknown) => {
      cachedRegistryPromise = null;
      throw error;
    });
  return cachedRegistryPromise;
}

/** Load only exact period/category shards for the local ReportDelivery path. */
export function loadArticleRegistrySelection(
  periods: readonly TieredPeriodKind[],
  categoriesByPeriod: Readonly<Partial<Record<
    TieredPeriodKind,
    readonly (TieredCategoryId | 'overall')[]
  >>>,
): Promise<ArticleRegistry> {
  const shards = articleShardIdsForSelection(periods, categoriesByPeriod);
  const key = shards.join('|');
  const existing = selectiveRegistryCache.get(key);
  if (existing) {
    selectiveRegistryCache.delete(key);
    selectiveRegistryCache.set(key, existing);
    return existing;
  }

  const pending = isNodeRuntime()
    ? Promise.resolve(loadNodeArticleShards(shards))
    : loadBrowserArticleShards(shards);
  let promise: Promise<ArticleRegistry>;
  promise = pending
    .catch((error: unknown) => {
      if (selectiveRegistryCache.get(key) === promise) {
        selectiveRegistryCache.delete(key);
      }
      throw error;
    });
  selectiveRegistryCache.set(key, promise);
  while (selectiveRegistryCache.size > MAX_SELECTIVE_REGISTRY_CACHE_ENTRIES) {
    const oldest = selectiveRegistryCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    selectiveRegistryCache.delete(oldest);
  }
  return promise;
}

/** Test-only — clear the memo cache so a test can re-load freshly. */
export function _clearArticleRegistryCacheForTesting(): void {
  cachedRegistry = null;
  cachedRegistryPromise = null;
  selectiveRegistryCache.clear();
}
