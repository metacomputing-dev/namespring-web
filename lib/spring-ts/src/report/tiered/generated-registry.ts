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
import { resolvePublicAssetUrl } from '../../../../seed-ts/src/database/runtime-url.js';
import type { Article } from './article-registry.js';
import type {
  TieredGeneratedContentIssueCode,
  TieredGeneratedContentMeta,
} from '../types.js';

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

const GENERATED_CATEGORIES = new Set([
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
]);
const GENERATED_PERIODS = new Set(['life', 'today', 'thisWeek', 'thisMonth', 'thisYear']);
const GENERATED_AUDIENCES = new Set([
  'adult', 'teen', 'child',
  'stage-teen', 'stage-early', 'stage-mid', 'stage-senior', 'stage-elder',
]);
const GENERATED_BANDS = new Set(['high', 'mid', 'low', 'any']);

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTextArray(value: unknown, requireEntry: boolean): value is readonly string[] {
  return Array.isArray(value)
    && (!requireEntry || value.length > 0)
    && value.every(isNonEmptyText);
}

function isValidGenerated(value: unknown): value is Article {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return a.schemaVersion === 'spring-ts.article.v1'
    && isNonEmptyText(a.articleId)
    && typeof a.category === 'string' && GENERATED_CATEGORIES.has(a.category)
    && typeof a.period === 'string' && GENERATED_PERIODS.has(a.period)
    && typeof a.audience === 'string' && GENERATED_AUDIENCES.has(a.audience)
    && typeof a.band === 'string' && GENERATED_BANDS.has(a.band)
    && isTextArray(a.body, true)
    && isTextArray(a.expert, true)
    && isNonEmptyText(a.summary)
    && (a.hook === undefined || isNonEmptyText(a.hook))
    && (a.livingTips === undefined || isTextArray(a.livingTips, false))
    && (a.cautions === undefined || isTextArray(a.cautions, false))
    && a.aiGenerated === true
    // Provenance 게이트: LLM 재생성(3층 게이트 통과) 콘텐츠만 채택한다.
    // 2026-07-04 이전의 템플릿 스탬핑 코퍼스(sourceNote 'generation-2026-07' 등)는
    // 여기서 걸러져 베이스 풀로 폴백 — 재생성이 분야를 채울수록 자동 승격된다.
    && typeof a.sourceNote === 'string'
    && (a.sourceNote as string).startsWith('regen-');
}

const cache = new Map<string, Article | null>();       // node: per-file memo (key `cat/classId`)
const browserCache = new Map<string, Article>();       // browser: classId → article (from bundles)
const loadedBrowserPacks = new Map<string, number>();  // browser: category/packKey → article count
const browserPackFlights = new Map<string, Promise<GeneratedPackLoadOutcome>>();

export interface GeneratedPackPreloadEntry {
  readonly category: string;
  readonly packKey: string | null;
}

export interface GeneratedPackFetchResponse {
  readonly ok: boolean;
  json(): Promise<unknown>;
}

export interface GeneratedPackPreloadRuntime {
  readonly fetchAsset: (
    url: string,
    signal: AbortSignal,
  ) => Promise<GeneratedPackFetchResponse>;
  readonly resolveAssetUrl: (relativePath: string) => string;
  readonly timeoutMs?: number;
}

const DEFAULT_GENERATED_PACK_TIMEOUT_MS = 10_000;
const MAX_GENERATED_PACK_TIMEOUT_MS = 60_000;
const GENERATED_STRENGTHS = new Set(['weak', 'balanced', 'strong']);
const GENERATED_FAMILIES = new Set([
  'bigeop', 'gwanseong', 'inseong', 'jaeseong', 'siksang', 'special',
]);
const GENERATED_NAME_EFFECTS = new Set([
  'adverse', 'boost_mild', 'boost_strong', 'neutral',
]);
const GENERATED_GENDERS = new Set(['female', 'male', 'x']);
const GENDER_SCOPED_CATEGORIES = new Set(['career', 'family', 'romance']);
const GENERATED_PERIOD_ORDER = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const GENERATED_ADULT_BANDS = ['high', 'mid', 'low'] as const;
const GENERATED_MINOR_PERIOD_AUDIENCES = {
  life: [
    'child', 'teen',
    'stage-teen', 'stage-early', 'stage-mid', 'stage-senior', 'stage-elder',
  ],
  today: ['child', 'teen'],
  thisWeek: ['child', 'teen'],
  thisMonth: ['child', 'teen'],
  thisYear: ['child', 'teen'],
} as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function belongsToGeneratedPack(
  classId: string,
  category: string,
  packKey: string,
): boolean {
  const parts = classId.split('.');
  return parts.length === 8
    && parts[0] === category
    && parts.slice(4).join('.') === packKey;
}

function articleIdentityMatchesClassId(article: Article, classId: string): boolean {
  const [category, period, audience, band] = classId.split('.');
  return article.articleId === classId
    && article.category === category
    && article.period === period
    && article.audience === audience
    && article.band === band;
}

interface GeneratedPackAxes {
  readonly strength: string;
  readonly family: string;
  readonly nameEffect: string;
  readonly gender: string;
}

function parseGeneratedPackKey(packKey: string): GeneratedPackAxes | null {
  const [strength, family, nameEffect, gender, ...extra] = packKey.split('.');
  if (
    extra.length > 0
    || !GENERATED_STRENGTHS.has(strength)
    || !GENERATED_FAMILIES.has(family)
    || !GENERATED_NAME_EFFECTS.has(nameEffect)
    || !GENERATED_GENDERS.has(gender)
  ) {
    return null;
  }
  return { strength, family, nameEffect, gender };
}

function expectedGeneratedClassIds(category: string, packKey: string): ReadonlySet<string> {
  const axes = parseGeneratedPackKey(packKey);
  if (!GENERATED_CATEGORIES.has(category) || axes === null) {
    throw new TypeError('Generated pack preload received an invalid internal key');
  }

  const genderScoped = GENDER_SCOPED_CATEGORIES.has(category);
  const includeAdult = !genderScoped || axes.gender !== 'x';
  const includeMinor = axes.gender === 'x'
    && axes.strength !== 'balanced'
    && axes.nameEffect !== 'adverse';
  if (
    (!genderScoped && axes.gender !== 'x')
    || (genderScoped && axes.gender === 'x' && !includeMinor)
  ) {
    throw new TypeError('Generated pack preload received an impossible axis combination');
  }

  const ids = new Set<string>();
  if (includeAdult) {
    for (const period of GENERATED_PERIOD_ORDER) {
      for (const band of GENERATED_ADULT_BANDS) {
        ids.add(`${category}.${period}.adult.${band}.${packKey}`);
      }
    }
  }
  if (includeMinor) {
    for (const period of GENERATED_PERIOD_ORDER) {
      for (const audience of GENERATED_MINOR_PERIOD_AUDIENCES[period]) {
        ids.add(`${category}.${period}.${audience}.any.${packKey}`);
      }
    }
  }
  if (ids.size === 0) {
    throw new TypeError('Generated pack preload resolved no expected article classes');
  }
  return ids;
}

export interface GeneratedPackPreloadResult {
  readonly meta: TieredGeneratedContentMeta;
  readonly requestedPackCount: number;
  readonly loadedPackCount: number;
  readonly loadedArticleCount: number;
  readonly unavailablePackCount: number;
  readonly invalidPackCount: number;
  readonly issueCounts: Readonly<Record<TieredGeneratedContentIssueCode, number>>;
}

function buildPreloadResult(
  requestedPackCount: number,
  loadedPackCount: number,
  loadedArticleCount: number,
  unavailablePackCount: number,
  invalidPackCount: number,
  issueCounts: Readonly<Record<TieredGeneratedContentIssueCode, number>>,
): GeneratedPackPreloadResult {
  if (requestedPackCount !== loadedPackCount + unavailablePackCount + invalidPackCount) {
    throw new Error('Generated pack preload accounting invariant failed');
  }

  const issues: TieredGeneratedContentIssueCode[] = [];
  for (const code of [
    'http_unavailable',
    'network_unavailable',
    'invalid_json',
    'invalid_bundle',
  ] as const) {
    const count = issueCounts[code];
    if (count > 0) issues.push(code);
  }

  const status = requestedPackCount === 0
    ? 'not_applicable'
    : loadedPackCount === requestedPackCount
      ? 'complete'
      : loadedPackCount > 0
        ? 'partial'
        : 'unavailable';

  return {
    meta: {
      schemaVersion: 'spring-ts.tiered-generated-content.v1',
      status,
      issues,
    },
    requestedPackCount,
    loadedPackCount,
    loadedArticleCount,
    unavailablePackCount,
    invalidPackCount,
    issueCounts,
  };
}

type GeneratedPackLoadOutcome =
  | { readonly kind: 'loaded'; readonly articleCount: number }
  | {
      readonly kind: 'unavailable';
      readonly issueCode: 'http_unavailable' | 'network_unavailable';
    }
  | {
      readonly kind: 'invalid';
      readonly issueCode: 'invalid_json' | 'invalid_bundle';
    };

const GENERATED_PACK_TIMEOUT = Symbol('generated-pack-timeout');

async function loadGeneratedPack(
  cacheKey: string,
  category: string,
  packKey: string,
  expectedClassIds: ReadonlySet<string>,
  url: string,
  runtime: GeneratedPackPreloadRuntime,
  timeoutMs: number,
): Promise<GeneratedPackLoadOutcome> {
  const controller = new AbortController();
  const operation = (async (): Promise<GeneratedPackLoadOutcome> => {
    let response: GeneratedPackFetchResponse;
    try {
      response = await runtime.fetchAsset(url, controller.signal);
    } catch {
      return { kind: 'unavailable', issueCode: 'network_unavailable' };
    }
    if (
      response === null
      || typeof response !== 'object'
      || typeof response.ok !== 'boolean'
      || typeof response.json !== 'function'
    ) {
      throw new TypeError('Generated pack fetch returned an invalid response');
    }
    if (!response.ok) {
      return { kind: 'unavailable', issueCode: 'http_unavailable' };
    }

    let rawBundle: unknown;
    try {
      rawBundle = await response.json();
    } catch {
      return { kind: 'invalid', issueCode: 'invalid_json' };
    }
    if (controller.signal.aborted) {
      return { kind: 'unavailable', issueCode: 'network_unavailable' };
    }

    if (!isPlainRecord(rawBundle)) {
      return { kind: 'invalid', issueCode: 'invalid_bundle' };
    }
    const articles = Object.entries(rawBundle);
    if (
      articles.length !== expectedClassIds.size
      || articles.some(([classId, article]) =>
        !expectedClassIds.has(classId)
        || !belongsToGeneratedPack(classId, category, packKey)
        || !isValidGenerated(article)
        || !articleIdentityMatchesClassId(article, classId))
    ) {
      return { kind: 'invalid', issueCode: 'invalid_bundle' };
    }

    for (const [classId, article] of articles) {
      browserCache.set(classId, article as Article);
    }
    loadedBrowserPacks.set(cacheKey, articles.length);
    return { kind: 'loaded', articleCount: articles.length };
  })();

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(GENERATED_PACK_TIMEOUT);
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (error === GENERATED_PACK_TIMEOUT) {
      return { kind: 'unavailable', issueCode: 'network_unavailable' };
    }
    throw error;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

function startGeneratedPackFlight(
  cacheKey: string,
  category: string,
  packKey: string,
  expectedClassIds: ReadonlySet<string>,
  url: string,
  runtime: GeneratedPackPreloadRuntime,
  timeoutMs: number,
): Promise<GeneratedPackLoadOutcome> {
  const flight = loadGeneratedPack(
    cacheKey,
    category,
    packKey,
    expectedClassIds,
    url,
    runtime,
    timeoutMs,
  );
  browserPackFlights.set(cacheKey, flight);
  const clear = (): void => {
    if (browserPackFlights.get(cacheKey) === flight) {
      browserPackFlights.delete(cacheKey);
    }
  };
  void flight.then(clear, clear);
  return flight;
}

/**
 * Dependency-injected browser preload core. Operational asset failures are
 * returned as aggregate diagnostics; resolver, platform, and invariant defects
 * reject so the report boundary can fail closed.
 */
export async function preloadGeneratedForPersonWithRuntime(
  entries: ReadonlyArray<GeneratedPackPreloadEntry>,
  runtime: GeneratedPackPreloadRuntime,
): Promise<GeneratedPackPreloadResult> {
  if (typeof runtime?.fetchAsset !== 'function') {
    throw new TypeError('Generated pack preload requires a fetch implementation');
  }
  if (typeof runtime.resolveAssetUrl !== 'function') {
    throw new TypeError('Generated pack preload requires an asset URL resolver');
  }
  if (typeof AbortController !== 'function') {
    throw new TypeError('Generated pack preload requires AbortController');
  }
  const timeoutMs = runtime.timeoutMs ?? DEFAULT_GENERATED_PACK_TIMEOUT_MS;
  if (
    !Number.isInteger(timeoutMs)
    || timeoutMs < 1
    || timeoutMs > MAX_GENERATED_PACK_TIMEOUT_MS
  ) {
    throw new TypeError('Generated pack preload timeout is outside the supported range');
  }

  const uniqueRequests = new Map<string, { category: string; packKey: string }>();
  for (const { category, packKey } of entries) {
    if (packKey === null) continue;
    if (!GENERATED_CATEGORIES.has(category) || parseGeneratedPackKey(packKey) === null) {
      throw new TypeError('Generated pack preload received an invalid internal key');
    }
    const cacheKey = `${category}/${packKey}`;
    uniqueRequests.set(cacheKey, { category, packKey });
  }

  const requests = [...uniqueRequests.entries()].map(([cacheKey, request]) => {
    const expectedClassIds = expectedGeneratedClassIds(request.category, request.packKey);
    if (loadedBrowserPacks.has(cacheKey) || browserPackFlights.has(cacheKey)) {
      return { cacheKey, ...request, expectedClassIds, url: null };
    }
    const url = runtime.resolveAssetUrl(
      `generated-packed/${request.category}/${request.packKey}.json`,
    );
    if (typeof url !== 'string' || url.length === 0) {
      throw new TypeError('Generated pack asset resolver returned an invalid URL');
    }
    return { cacheKey, ...request, expectedClassIds, url };
  });

  let loadedPackCount = 0;
  let loadedArticleCount = 0;
  let unavailablePackCount = 0;
  let invalidPackCount = 0;
  const issueCounts: Record<TieredGeneratedContentIssueCode, number> = {
    http_unavailable: 0,
    network_unavailable: 0,
    invalid_json: 0,
    invalid_bundle: 0,
  };

  await Promise.all(requests.map(async ({
    cacheKey,
    category,
    packKey,
    expectedClassIds,
    url,
  }) => {
    const cachedArticleCount = loadedBrowserPacks.get(cacheKey);
    if (cachedArticleCount !== undefined) {
      loadedPackCount += 1;
      loadedArticleCount += cachedArticleCount;
      return;
    }
    const existingFlight = browserPackFlights.get(cacheKey);
    const flight = existingFlight ?? (
      url === null
        ? null
        : startGeneratedPackFlight(
            cacheKey,
            category,
            packKey,
            expectedClassIds,
            url,
            runtime,
            timeoutMs,
          )
    );
    if (flight === null) {
      throw new Error('Generated pack preload cache invariant failed');
    }

    const outcome = await flight;
    if (outcome.kind === 'loaded') {
      loadedPackCount += 1;
      loadedArticleCount += outcome.articleCount;
      return;
    }
    if (outcome.kind === 'unavailable') {
      unavailablePackCount += 1;
      issueCounts[outcome.issueCode] += 1;
      return;
    }
    invalidPackCount += 1;
    issueCounts[outcome.issueCode] += 1;
  }));

  return buildPreloadResult(
    requests.length,
    loadedPackCount,
    loadedArticleCount,
    unavailablePackCount,
    invalidPackCount,
    issueCounts,
  );
}

/**
 * Browser only — fetch one packed bundle per category (keyed by the person's
 * fixed axes) into the cache. Node is a no-op (getGeneratedArticle reads fs).
 * Asset availability and validity failures keep the base fallback and return
 * bounded diagnostics. Platform and configuration defects reject.
 */
export async function preloadGeneratedForPerson(
  entries: ReadonlyArray<GeneratedPackPreloadEntry>,
): Promise<TieredGeneratedContentMeta | undefined> {
  if (nodeBuiltins) return undefined; // node: fs path handles it
  if (typeof globalThis.fetch !== 'function') {
    throw new TypeError('Generated pack preload requires browser fetch');
  }
  const result = await preloadGeneratedForPersonWithRuntime(entries, {
    fetchAsset: (url, signal) => globalThis.fetch(url, { signal }),
    resolveAssetUrl: resolvePublicAssetUrl,
  });
  return result.meta;
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
      if (
        isValidGenerated(parsed)
        && articleIdentityMatchesClassId(parsed, classId)
        && parsed.category === category
      ) {
        article = parsed;
      }
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
  loadedBrowserPacks.clear();
  browserPackFlights.clear();
}

/** Test-only visibility for atomic browser pack commit assertions. */
export function _getBrowserGeneratedArticleForTesting(classId: string): Article | null {
  return browserCache.get(classId) ?? null;
}
