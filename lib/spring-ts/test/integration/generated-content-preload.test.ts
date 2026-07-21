import {
  _clearGeneratedCacheForTesting,
  _getBrowserGeneratedArticleForTesting,
  preloadGeneratedForPersonWithRuntime,
  type GeneratedPackFetchResponse,
  type GeneratedPackPreloadEntry,
  type GeneratedPackPreloadResult,
  type GeneratedPackPreloadRuntime,
} from '../../src/report/tiered/generated-registry.js';
import type { TieredGeneratedContentIssueCode } from '../../src/report/types.js';

const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const ADULT_BANDS = ['high', 'mid', 'low'] as const;
const MINOR_AUDIENCES = {
  life: [
    'child', 'teen',
    'stage-teen', 'stage-early', 'stage-mid', 'stage-senior', 'stage-elder',
  ],
  today: ['child', 'teen'],
  thisWeek: ['child', 'teen'],
  thisMonth: ['child', 'teen'],
  thisYear: ['child', 'teen'],
} as const;
const GENDER_SCOPED = new Set(['career', 'family', 'romance']);

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function expectedClassIds(category: string, packKey: string): string[] {
  const [strength, , nameEffect, gender] = packKey.split('.');
  const includeAdult = !GENDER_SCOPED.has(category) || gender !== 'x';
  const includeMinor = gender === 'x'
    && strength !== 'balanced'
    && nameEffect !== 'adverse';
  const ids: string[] = [];
  if (includeAdult) {
    for (const period of PERIODS) {
      for (const band of ADULT_BANDS) {
        ids.push(`${category}.${period}.adult.${band}.${packKey}`);
      }
    }
  }
  if (includeMinor) {
    for (const period of PERIODS) {
      for (const audience of MINOR_AUDIENCES[period]) {
        ids.push(`${category}.${period}.${audience}.any.${packKey}`);
      }
    }
  }
  return ids;
}

function validArticle(articleId: string): Record<string, unknown> {
  const [category, period, audience, band] = articleId.split('.');
  return {
    schemaVersion: 'spring-ts.article.v1',
    articleId,
    category,
    period,
    audience,
    band,
    summary: 'summary',
    hook: 'hook',
    body: ['standard'],
    expert: ['expert'],
    livingTips: ['tip'],
    cautions: ['caution'],
    aiGenerated: true,
    sourceNote: 'regen-test',
  };
}

function validBundle(category: string, packKey: string): Record<string, unknown> {
  return Object.fromEntries(
    expectedClassIds(category, packKey).map((classId) => [classId, validArticle(classId)]),
  );
}

function cloneBundle(bundle: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(bundle);
}

function response(
  body: unknown,
  options: { readonly ok?: boolean; readonly jsonError?: unknown } = {},
): GeneratedPackFetchResponse {
  return {
    ok: options.ok ?? true,
    async json(): Promise<unknown> {
      if (options.jsonError !== undefined) throw options.jsonError;
      return body;
    },
  };
}

function runtime(
  fetchAsset: GeneratedPackPreloadRuntime['fetchAsset'],
  resolveAssetUrl: GeneratedPackPreloadRuntime['resolveAssetUrl'] =
    (relativePath) => `https://assets.example/${relativePath}`,
  timeoutMs?: number,
): GeneratedPackPreloadRuntime {
  return {
    fetchAsset,
    resolveAssetUrl,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

function checkAccounting(label: string, result: GeneratedPackPreloadResult): void {
  check(
    `${label}: requested packs equal all outcomes`,
    result.requestedPackCount
      === result.loadedPackCount + result.unavailablePackCount + result.invalidPackCount,
    JSON.stringify(result),
  );
}

function checkPublicPrivacy(label: string, result: GeneratedPackPreloadResult): void {
  const serialized = JSON.stringify(result.meta);
  check(`${label}: public metadata has its own schema version`,
    result.meta.schemaVersion === 'spring-ts.tiered-generated-content.v1');
  check(`${label}: public metadata omits internal counts`,
    !serialized.includes('PackCount') && !serialized.includes('ArticleCount'),
    serialized);
  check(`${label}: public metadata omits pack axes and URLs`,
    !serialized.includes('siksang')
      && !serialized.includes('assets.example')
      && !serialized.includes('generated-packed'),
    serialized);
}

const key = 'balanced.siksang.neutral.x';
const completeEntries: readonly GeneratedPackPreloadEntry[] = [
  { category: 'health', packKey: key },
  { category: 'wealth', packKey: key },
];

console.log('Generated content preload diagnostics\n');

_clearGeneratedCacheForTesting();
let completeFetches = 0;
const complete = await preloadGeneratedForPersonWithRuntime(
  completeEntries,
  runtime(async (url) => {
    completeFetches += 1;
    const category = url.includes('/health/') ? 'health' : 'wealth';
    return response(validBundle(category, key));
  }),
);
check('two complete packs report complete', complete.meta.status === 'complete', complete.meta.status);
check('two complete packs are counted internally', complete.loadedPackCount === 2, JSON.stringify(complete));
check('two complete packs contain all 30 articles', complete.loadedArticleCount === 30, JSON.stringify(complete));
check('complete public metadata has no issues', complete.meta.issues.length === 0);
check('complete packs fetch exactly once each', completeFetches === 2, String(completeFetches));
checkAccounting('complete', complete);
checkPublicPrivacy('complete', complete);

let cachedFetches = 0;
const cached = await preloadGeneratedForPersonWithRuntime(
  completeEntries,
  runtime(async () => {
    cachedFetches += 1;
    throw new Error('cached pack must not refetch');
  }),
);
check('successful packs stay process-cached', cached.meta.status === 'complete', cached.meta.status);
check('cached packs retain complete article counts', cached.loadedArticleCount === 30, JSON.stringify(cached));
check('cached packs do not refetch', cachedFetches === 0, String(cachedFetches));

_clearGeneratedCacheForTesting();
const partial = await preloadGeneratedForPersonWithRuntime(
  completeEntries,
  runtime(async (url) => {
    if (url.includes('/wealth/')) return response(null, { ok: false });
    return response(validBundle('health', key));
  }),
);
check('one valid and one HTTP miss report partial', partial.meta.status === 'partial', partial.meta.status);
check('partial result counts one loaded pack', partial.loadedPackCount === 1, JSON.stringify(partial));
check('partial result counts one unavailable pack', partial.unavailablePackCount === 1, JSON.stringify(partial));
check('HTTP issue is bounded and deduplicated',
  partial.issueCounts.http_unavailable === 1
    && partial.meta.issues.join(',') === 'http_unavailable',
  JSON.stringify(partial.meta));
checkAccounting('partial', partial);
checkPublicPrivacy('partial', partial);

_clearGeneratedCacheForTesting();
const networkSecret = 'https://private.example/generated/secret-key.json';
const network = await preloadGeneratedForPersonWithRuntime(
  [{ category: 'wealth', packKey: key }],
  runtime(async () => {
    throw new Error(`network rejected ${networkSecret}`);
  }),
);
check('fetch rejection keeps base fallback', network.meta.status === 'unavailable', network.meta.status);
check('network issue is counted internally', network.issueCounts.network_unavailable === 1);
check('network public metadata omits raw error and URL text',
  !JSON.stringify(network.meta).includes('private.example')
    && !JSON.stringify(network.meta).includes('secret-key'));
checkAccounting('network', network);
checkPublicPrivacy('network', network);

type InvalidCase = {
  readonly label: string;
  readonly fetchAsset: GeneratedPackPreloadRuntime['fetchAsset'];
  readonly expectedCode: TieredGeneratedContentIssueCode;
  readonly cachedClassId?: string;
};

const baseBundle = validBundle('wealth', key);
const baseIds = Object.keys(baseBundle);
const firstId = baseIds[0];
const secondId = baseIds[1];

_clearGeneratedCacheForTesting();
const retainedBrowserBundle = validBundle('wealth', key);
const retainedRawArticle =
  retainedBrowserBundle[firstId] as Record<string, unknown>;
retainedRawArticle.caseAxes = {
  gangyak: 'balanced',
  gyeokgukFamily: 'siksang',
};
const isolatedBrowserLoad = await preloadGeneratedForPersonWithRuntime(
  [{ category: 'wealth', packKey: key }],
  runtime(async () => response(retainedBrowserBundle)),
);
const isolatedBrowserArticle =
  _getBrowserGeneratedArticleForTesting(firstId);
check('browser cache isolation fixture loads completely',
  isolatedBrowserLoad.meta.status === 'complete');
check('browser cache stores a frozen article snapshot',
  isolatedBrowserArticle !== null
    && Object.isFrozen(isolatedBrowserArticle)
    && Object.isFrozen(isolatedBrowserArticle.body)
    && Object.isFrozen(isolatedBrowserArticle.expert)
    && Object.isFrozen(
      (isolatedBrowserArticle as unknown as Record<string, unknown>).caseAxes,
    ));
const isolatedBrowserExpected = isolatedBrowserArticle === null
  ? null
  : {
    summary: isolatedBrowserArticle.summary,
    body: [...isolatedBrowserArticle.body],
    expert: [...isolatedBrowserArticle.expert],
    caseAxes:
      (isolatedBrowserArticle as unknown as Record<string, unknown>).caseAxes,
  };
let browserMutationRejected = false;
if (isolatedBrowserArticle !== null) {
  try {
    (isolatedBrowserArticle as { summary: string }).summary = 'POISON';
  } catch (error) {
    browserMutationRejected = error instanceof TypeError;
  }
}
check('browser cache rejects consumer mutation', browserMutationRejected);
retainedRawArticle.summary = 'RAW_POISON';
(retainedRawArticle.body as string[]).push('RAW_POISON');
(retainedRawArticle.expert as string[]).splice(0);
(retainedRawArticle.caseAxes as Record<string, unknown>).gangyak = 'RAW_POISON';
const isolatedBrowserReload =
  _getBrowserGeneratedArticleForTesting(firstId);
check('browser cache is detached from the fetch payload owner',
  isolatedBrowserReload !== null
    && JSON.stringify({
      summary: isolatedBrowserReload.summary,
      body: [...isolatedBrowserReload.body],
      expert: [...isolatedBrowserReload.expert],
      caseAxes:
        (isolatedBrowserReload as unknown as Record<string, unknown>).caseAxes,
    }) === JSON.stringify(isolatedBrowserExpected));

function mutatedBundle(
  mutate: (bundle: Record<string, unknown>) => void,
): Record<string, unknown> {
  const bundle = cloneBundle(baseBundle);
  mutate(bundle);
  return bundle;
}

const invalidCases: readonly InvalidCase[] = [
  {
    label: 'JSON decode failure',
    fetchAsset: async () => response(null, { jsonError: new SyntaxError('invalid JSON secret') }),
    expectedCode: 'invalid_json',
  },
  {
    label: 'array payload',
    fetchAsset: async () => response([]),
    expectedCode: 'invalid_bundle',
  },
  {
    label: 'empty payload',
    fetchAsset: async () => response({}),
    expectedCode: 'invalid_bundle',
  },
  {
    label: 'truncated otherwise-valid bundle',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      delete bundle[firstId];
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: secondId,
  },
  {
    label: 'unexpected extra class',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      const extraId = `wealth.life.adult.any.${key}`;
      bundle[extraId] = validArticle(extraId);
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: firstId,
  },
  {
    label: 'invalid article schema inside a complete pack',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      bundle[firstId] = { ...(bundle[firstId] as object), schemaVersion: 'wrong' };
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: secondId,
  },
  {
    label: 'key and articleId mismatch',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      bundle[firstId] = { ...(bundle[firstId] as object), articleId: secondId };
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: secondId,
  },
  {
    label: 'article metadata and classId mismatch',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      bundle[firstId] = { ...(bundle[firstId] as object), category: 'health' };
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: secondId,
  },
  {
    label: 'blank summary',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      bundle[firstId] = { ...(bundle[firstId] as object), summary: '   ' };
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: secondId,
  },
  {
    label: 'empty standard body',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      bundle[firstId] = { ...(bundle[firstId] as object), body: [] };
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: secondId,
  },
  {
    label: 'empty expert body',
    fetchAsset: async () => response(mutatedBundle((bundle) => {
      bundle[firstId] = { ...(bundle[firstId] as object), expert: [] };
    })),
    expectedCode: 'invalid_bundle',
    cachedClassId: secondId,
  },
  {
    label: 'article routed from a different pack',
    fetchAsset: async () => response(validBundle('wealth', 'weak.siksang.neutral.x')),
    expectedCode: 'invalid_bundle',
  },
];

for (const invalidCase of invalidCases) {
  _clearGeneratedCacheForTesting();
  const result = await preloadGeneratedForPersonWithRuntime(
    [{ category: 'wealth', packKey: key }],
    runtime(invalidCase.fetchAsset),
  );
  check(`${invalidCase.label} reports unavailable`,
    result.meta.status === 'unavailable', result.meta.status);
  check(`${invalidCase.label} counts one invalid pack`,
    result.invalidPackCount === 1, JSON.stringify(result));
  check(`${invalidCase.label} commits no articles`,
    result.loadedArticleCount === 0, JSON.stringify(result));
  check(`${invalidCase.label} uses bounded issue code`,
    result.issueCounts[invalidCase.expectedCode] === 1
      && result.meta.issues.includes(invalidCase.expectedCode),
    JSON.stringify(result.meta));
  if (invalidCase.cachedClassId) {
    check(`${invalidCase.label} is atomically rejected before browser cache commit`,
      _getBrowserGeneratedArticleForTesting(invalidCase.cachedClassId) === null);
  }
  checkAccounting(invalidCase.label, result);
  checkPublicPrivacy(invalidCase.label, result);
}

_clearGeneratedCacheForTesting();
const snapshotFailureBundle = cloneBundle(baseBundle);
const snapshotFailureLastId = baseIds.at(-1);
if (snapshotFailureLastId === undefined) {
  throw new Error('snapshot failure fixture requires at least one article');
}
Object.defineProperty(
  snapshotFailureBundle[snapshotFailureLastId] as object,
  'snapshotFailure',
  {
    enumerable: true,
    get() {
      throw new Error('snapshot failure sentinel');
    },
  },
);
let snapshotFailure: unknown;
try {
  await preloadGeneratedForPersonWithRuntime(
    [{ category: 'wealth', packKey: key }],
    runtime(async () => response(snapshotFailureBundle)),
  );
} catch (error) {
  snapshotFailure = error;
}
check('snapshot defects reject with the original cause',
  snapshotFailure instanceof Error
    && snapshotFailure.message === 'snapshot failure sentinel');
check('snapshot defects cannot partially commit a browser pack',
  _getBrowserGeneratedArticleForTesting(firstId) === null
    && _getBrowserGeneratedArticleForTesting(secondId) === null);

_clearGeneratedCacheForTesting();
let concurrentFetches = 0;
let releaseConcurrent: ((value: GeneratedPackFetchResponse) => void) | undefined;
const concurrentRuntime = runtime(async () => {
  concurrentFetches += 1;
  return new Promise<GeneratedPackFetchResponse>((resolve) => {
    releaseConcurrent = resolve;
  });
});
const concurrentEntry = [{ category: 'wealth', packKey: key }] as const;
const concurrentA = preloadGeneratedForPersonWithRuntime(concurrentEntry, concurrentRuntime);
const concurrentB = preloadGeneratedForPersonWithRuntime(concurrentEntry, concurrentRuntime);
await Promise.resolve();
check('same-pack concurrent calls share one fetch before settlement',
  concurrentFetches === 1, String(concurrentFetches));
releaseConcurrent?.(response(validBundle('wealth', key)));
const [concurrentResultA, concurrentResultB] = await Promise.all([concurrentA, concurrentB]);
check('same-pack concurrent callers observe the same complete outcome',
  concurrentResultA.meta.status === 'complete'
    && concurrentResultB.meta.status === 'complete');
check('same-pack concurrent calls issue one total fetch',
  concurrentFetches === 1, String(concurrentFetches));

_clearGeneratedCacheForTesting();
let retryFetches = 0;
const firstAttempt = await preloadGeneratedForPersonWithRuntime(
  concurrentEntry,
  runtime(async () => {
    retryFetches += 1;
    throw new Error('temporary network failure');
  }),
);
const secondAttempt = await preloadGeneratedForPersonWithRuntime(
  concurrentEntry,
  runtime(async () => {
    retryFetches += 1;
    return response(validBundle('wealth', key));
  }),
);
check('failed pack load remains retryable',
  firstAttempt.meta.status === 'unavailable'
    && secondAttempt.meta.status === 'complete');
check('retry performs exactly one new fetch', retryFetches === 2, String(retryFetches));

_clearGeneratedCacheForTesting();
let timeoutFetches = 0;
let timeoutSignal: AbortSignal | undefined;
const timeoutStartedAt = Date.now();
const timedOut = await preloadGeneratedForPersonWithRuntime(
  concurrentEntry,
  runtime(
    async (_url, signal) => {
      timeoutFetches += 1;
      timeoutSignal = signal;
      return new Promise<GeneratedPackFetchResponse>(() => {});
    },
    (path) => `https://assets.example/${path}`,
    20,
  ),
);
const timeoutElapsedMs = Date.now() - timeoutStartedAt;
check('hung fetch resolves as bounded network unavailability',
  timedOut.meta.status === 'unavailable'
    && timedOut.issueCounts.network_unavailable === 1,
  JSON.stringify(timedOut));
check('hung fetch is aborted at the configured deadline', timeoutSignal?.aborted === true);
check('hung fetch does not wait indefinitely', timeoutElapsedMs < 2_000, String(timeoutElapsedMs));
await Promise.resolve();
const afterTimeoutRetry = await preloadGeneratedForPersonWithRuntime(
  concurrentEntry,
  runtime(async () => {
    timeoutFetches += 1;
    return response(validBundle('wealth', key));
  }),
);
check('timed-out in-flight entry is cleared for retry',
  afterTimeoutRetry.meta.status === 'complete');
check('timeout retry performs one new fetch', timeoutFetches === 2, String(timeoutFetches));

_clearGeneratedCacheForTesting();
let stalledBodySignal: AbortSignal | undefined;
const stalledBody = await preloadGeneratedForPersonWithRuntime(
  concurrentEntry,
  runtime(
    async (_url, signal) => {
      stalledBodySignal = signal;
      return {
        ok: true,
        json: async () => new Promise<unknown>(() => {}),
      };
    },
    (path) => `https://assets.example/${path}`,
    20,
  ),
);
check('stalled response body is covered by the same deadline',
  stalledBody.meta.status === 'unavailable'
    && stalledBody.issueCounts.network_unavailable === 1,
  JSON.stringify(stalledBody));
check('stalled response body aborts the shared request signal',
  stalledBodySignal?.aborted === true);
await Promise.resolve();
const afterBodyTimeoutRetry = await preloadGeneratedForPersonWithRuntime(
  concurrentEntry,
  runtime(async () => response(validBundle('wealth', key))),
);
check('stalled response body does not poison subsequent retries',
  afterBodyTimeoutRetry.meta.status === 'complete');

_clearGeneratedCacheForTesting();
let resolverFetches = 0;
const resolverError = new Error('resolver configuration sentinel');
let observedResolverError: unknown;
try {
  await preloadGeneratedForPersonWithRuntime(
    concurrentEntry,
    runtime(
      async () => {
        resolverFetches += 1;
        return response(validBundle('wealth', key));
      },
      () => {
        throw resolverError;
      },
    ),
  );
} catch (error) {
  observedResolverError = error;
}
check('resolver defects reject with the original cause', observedResolverError === resolverError);
check('resolver defects fail before network access', resolverFetches === 0, String(resolverFetches));

let missingFetchRejected = false;
try {
  await preloadGeneratedForPersonWithRuntime(
    concurrentEntry,
    { fetchAsset: undefined, resolveAssetUrl: (path) => path } as unknown as GeneratedPackPreloadRuntime,
  );
} catch (error) {
  missingFetchRejected = error instanceof TypeError;
}
check('missing fetch is a platform contract failure', missingFetchRejected);

let invalidTimeoutRejected = false;
try {
  await preloadGeneratedForPersonWithRuntime(
    concurrentEntry,
    runtime(async () => response(validBundle('wealth', key)), (path) => path, 0),
  );
} catch (error) {
  invalidTimeoutRejected = error instanceof TypeError;
}
check('invalid timeout is a platform contract failure', invalidTimeoutRejected);

let impossibleAxesRejected = false;
try {
  await preloadGeneratedForPersonWithRuntime(
    [{ category: 'wealth', packKey: 'strong.siksang.neutral.male' }],
    runtime(async () => response({})),
  );
} catch (error) {
  impossibleAxesRejected = error instanceof TypeError;
}
check('impossible category and gender axes fail before fallback', impossibleAxesRejected);

_clearGeneratedCacheForTesting();
const notApplicable = await preloadGeneratedForPersonWithRuntime(
  [{ category: 'wealth', packKey: null }],
  runtime(async () => {
    throw new Error('not-applicable preload must not fetch');
  }),
);
check('null pack keys report not_applicable', notApplicable.meta.status === 'not_applicable');
check('not_applicable requests expose zero internal counts',
  notApplicable.requestedPackCount === 0
    && notApplicable.loadedPackCount === 0
    && notApplicable.unavailablePackCount === 0
    && notApplicable.invalidPackCount === 0,
  JSON.stringify(notApplicable));
checkAccounting('not_applicable', notApplicable);
checkPublicPrivacy('not_applicable', notApplicable);

console.log(`\nGenerated content preload: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
