import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HanjaRepository,
  LOCAL_CONTEXT_ID_PATTERN_V1,
  LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
  LOCAL_SHARE_EXPORT_ID_PATTERN_V1,
  LocalMenuContractErrorV1,
  assertLocalAnalysisContextV1,
  assertLocalBirthPreviewV1,
  assertLocalHanjaLookupV1,
  assertLocalHomeSummaryV1,
  assertLocalShareExportV1,
  buildLocalBirthPreviewV1,
  buildLocalHanjaLookupV1,
  buildLocalHomeSummaryV1,
  buildLocalShareExportV1,
  createLocalAnalysisContextV1,
  SpringEngine,
  type HanjaEntry,
  type LocalAnalysisContextInputV1,
  type SajuSummary,
} from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_MENU_SOURCE = path.resolve(__dirname, '../../src/experience/local-menu.ts');

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error('Local menu contracts must never initiate network I/O.');
};

function assertReason(
  action: () => unknown,
  reason: LocalMenuContractErrorV1['reason'],
  label: string,
): void {
  assert.throws(
    action,
    (error: unknown) => error instanceof LocalMenuContractErrorV1
      && error.reason === reason,
    label,
  );
}

async function assertRejectReason(
  action: () => Promise<unknown>,
  reason: LocalMenuContractErrorV1['reason'],
  label: string,
): Promise<void> {
  await assert.rejects(
    action,
    (error: unknown) => error instanceof LocalMenuContractErrorV1
      && error.reason === reason,
    label,
  );
}

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (value === null || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, out));
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out.add(key);
    collectKeys(child, out);
  }
  return out;
}

const contextInput: LocalAnalysisContextInputV1 = {
  birth: {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    gender: 'male',
    calendarType: 'solar',
    isLeapMonth: false,
  },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  options: {
    precisionConfig: {
      lunarConversionSource: 'builtin',
      surfaceNamingScoreVector: true,
    },
  },
};

const mutableInput = structuredClone(contextInput) as any;
const context = createLocalAnalysisContextV1(mutableInput);
assertLocalAnalysisContextV1(context);
assert.match(context.contextId, LOCAL_CONTEXT_ID_PATTERN_V1);
assert.equal(context.scope, 'device_session');
assert.equal(context.computation, 'local_only');
assert.equal(context.privacy.urlEmbedding, 'forbidden');
assert.equal(context.privacy.serverTransfer, 'premium_registration_only');
assert.ok(Object.isFrozen(context));
assert.ok(Object.isFrozen(context.birth));

mutableInput.birth.year = 2001;
mutableInput.surname[0].hangul = '김';
assert.equal(context.birth.year, 1986, 'context owns a birth snapshot');
assert.equal(context.name.surname[0]?.hangul, '최', 'context owns a name snapshot');

const contextId = context.contextId;
assert.equal(contextId.includes('최'), false, 'opaque context ID contains no name');
assert.equal(contextId.includes('1986'), false, 'opaque context ID contains no birth date');
assertReason(
  () => assertLocalAnalysisContextV1({ ...context, options: null } as any),
  'INVALID_OPTIONS',
  'persisted local context options fail through the typed contract instead of a property access error',
);

assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    birth: { ...contextInput.birth, gender: undefined },
  } as any),
  'INVALID_BIRTH',
  'gender is mandatory and is never defaulted',
);
assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    birth: { ...contextInput.birth, calendarType: undefined },
  } as any),
  'INVALID_BIRTH',
  'calendar type is explicit',
);
assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    options: { precisionConfig: { lunarConversionSource: 'kasi' } },
  } as any),
  'REMOTE_COMPUTATION_FORBIDDEN',
  'free local context forbids remote lunar conversion',
);
assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    birth: { ...contextInput.birth, year: 2023, month: 2, day: 29 },
  }),
  'INVALID_BIRTH',
  'nonexistent solar date fails closed',
);
assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수' }],
  }),
  'PARTIAL_HANJA_IDENTITY',
  'a local name segment cannot silently mix explicit-Hanja and Hangul-only identity',
);
assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    surname: [{ hangul: '남', hanja: '南' }, { hangul: '궁' }],
  }),
  'PARTIAL_HANJA_IDENTITY',
  'compound surnames preserve the same all-or-none Hanja identity rule',
);
assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    options: { pureHangulNameMode: 'on' },
  }),
  'PURE_HANGUL_MODE_CONFLICT',
  'pure-Hangul mode cannot retain explicit given-name Hanja',
);
assertReason(
  () => createLocalAnalysisContextV1({
    ...contextInput,
    givenName: [{ hangul: '하' }, { hangul: '늘' }],
    options: { pureHangulNameMode: 'off' },
  }),
  'PURE_HANGUL_MODE_DISABLED',
  'Hangul-only identity cannot bypass an explicitly disabled pure-Hangul mode',
);

const solarPreview = buildLocalBirthPreviewV1(context.birth);
assertLocalBirthPreviewV1(solarPreview);
assert.deepEqual(solarPreview.calendar, {
  inputType: 'solar',
  inputDate: '1986-04-19',
  isLeapMonth: false,
  conversion: 'not_required',
});
assert.deepEqual(solarPreview.location, { status: 'not_provided' });
assert.equal(JSON.stringify(solarPreview).includes('서울'), false,
  'missing location is not silently defaulted to Seoul');

const lunarPreview = buildLocalBirthPreviewV1({
  year: 2024,
  month: 1,
  day: 1,
  hour: null,
  minute: null,
  gender: 'neutral',
  calendarType: 'lunar',
  isLeapMonth: false,
});
assert.equal(lunarPreview.calendar.solarEquivalent, '2024-02-10');
assert.deepEqual(lunarPreview.time, { precision: 'unknown' });
assert.equal(
  lunarPreview.constraints.genderDependentFortune,
  'unavailable_without_explicit_gender_basis',
  'neutral gender is preserved instead of choosing a fortune direction',
);
assert.equal(lunarPreview.constraints.timeSensitiveAnalysis, 'limited_unknown_time');
assert.equal(lunarPreview.provenance.remoteLookup, 'forbidden');

const malformedSolarPreview = structuredClone(solarPreview) as any;
malformedSolarPreview.calendar.inputDate = '2026-99-99';
assertReason(
  () => assertLocalBirthPreviewV1(malformedSolarPreview),
  'CONTRACT_INVALID',
  'birth preview rejects a date-shaped string that is not a calendar date',
);

const nonexistentSolarPreview = structuredClone(solarPreview) as any;
nonexistentSolarPreview.calendar.inputDate = '2023-02-29';
assertReason(
  () => assertLocalBirthPreviewV1(nonexistentSolarPreview),
  'CONTRACT_INVALID',
  'birth preview validates the actual Gregorian date',
);

const impossibleLunarDayPreview = structuredClone(lunarPreview) as any;
impossibleLunarDayPreview.calendar.inputDate = '2024-01-31';
assertReason(
  () => assertLocalBirthPreviewV1(impossibleLunarDayPreview),
  'CONTRACT_INVALID',
  'lunar birth preview rejects days beyond the lunar 1..30 domain',
);

const nonexistentLeapMonthPreview = structuredClone(lunarPreview) as any;
nonexistentLeapMonthPreview.calendar.isLeapMonth = true;
assertReason(
  () => assertLocalBirthPreviewV1(nonexistentLeapMonthPreview),
  'CONTRACT_INVALID',
  'lunar birth preview rejects an intercalary month not present in that year',
);

const inconsistentLunarConversionPreview = structuredClone(lunarPreview) as any;
inconsistentLunarConversionPreview.calendar.solarEquivalent = '2024-02-11';
assertReason(
  () => assertLocalBirthPreviewV1(inconsistentLunarConversionPreview),
  'CONTRACT_INVALID',
  'lunar birth preview must match the builtin conversion and reverse conversion',
);

function pillar(
  stemCode: string,
  stemHangul: string,
  stemHanja: string,
  branchCode: string,
  branchHangul: string,
  branchHanja: string,
) {
  return {
    stem: { code: stemCode, hangul: stemHangul, hanja: stemHanja },
    branch: { code: branchCode, hangul: branchHangul, hanja: branchHanja },
  };
}

const saju = {
  pillars: {
    year: pillar('BYEONG', '병', '丙', 'IN', '인', '寅'),
    month: pillar('IM', '임', '壬', 'JIN', '진', '辰'),
    day: pillar('GYE', '계', '癸', 'MYO', '묘', '卯'),
    hour: pillar('EUL', '을', '乙', 'MYO', '묘', '卯'),
  },
  dayMaster: { stem: 'GYE', element: 'WATER', polarity: 'YIN' },
  elementDistribution: { WOOD: 3, FIRE: 1, EARTH: 2, METAL: 1, WATER: 1 },
  axisStrength: { strength: 'definite', gyeokguk: 'practical', yongshin: 'practical' },
  gyeokguk: { confidence: 0.8 },
  yongshin: { element: 'WOOD', confidence: 80, warnings: [] },
} as unknown as SajuSummary;

const homeEngine = new SpringEngine();
let sajuPreviewCalls = 0;
let fullReportCalls = 0;
(homeEngine as any).getSajuReport = async (request: any) => {
  sajuPreviewCalls += 1;
  assert.deepEqual(request.birth, context.birth,
    'home calculation receives the exact context birth snapshot');
  assert.deepEqual(request.surname, [],
    'the legacy request carrier never injects the selected name into natal calculation');
  assert.equal(Object.hasOwn(request, 'givenName'), false,
    'home natal facts remain birth-derived when the selected candidate changes');
  return saju;
};
(homeEngine as any).getFortuneReport = async () => {
  fullReportCalls += 1;
  throw new Error('home must not compute a full report');
};

const home = await buildLocalHomeSummaryV1(homeEngine, context);
assertLocalHomeSummaryV1(home);
assert.equal(home.computation.source, 'SpringEngine.getSajuReport');
assert.equal(home.computation.scope, 'natal_preview');
assert.equal(home.computation.fullReportComputed, false);
assert.equal(home.computation.remoteLookup, 'forbidden');
assert.equal(home.computation.natalSaju, 'birth_derived_invariant');
assert.equal(home.availability.status, 'ready');
assert.ok(home.facts);
assert.equal(
  home.facts!.elementDistribution.reduce((sum, row) => sum + row.sharePercent, 0),
  100,
  'largest-remainder normalization has an exact 100 percent total',
);
assert.deepEqual(
  home.capabilities.map((entry) => entry.id),
  [
    'birth_preview',
    'integrated_report',
    'saju_report',
    'naming_report',
    'candidate_search',
    'hanja_lookup',
    'share_export',
    'premium_story_entry',
  ],
);
assert.deepEqual(home.capabilities.slice(1, 4), [
  {
    id: 'integrated_report',
    execution: 'local_device',
    contract: 'spring-ts.report-delivery.v1',
    requestHint: { surface: 'integrated', depth: 'standard' },
  },
  {
    id: 'saju_report',
    execution: 'local_device',
    contract: 'spring-ts.report-delivery.v1',
    requestHint: { surface: 'saju', depth: 'expert' },
  },
  {
    id: 'naming_report',
    execution: 'local_device',
    contract: 'spring-ts.report-delivery.v1',
    requestHint: { surface: 'naming', depth: 'expert' },
  },
]);
assert.deepEqual(home.capabilities[7], {
  id: 'premium_story_entry',
  execution: 'server_after_explicit_intent',
  contract: 'namespring.service-catalog.v1',
  catalog: 'not_prefetched',
  productId: 'report.story-completion.v1',
});
for (const forbiddenKey of ['url', 'href', 'price', 'amount', 'currency', 'entitlement']) {
  assert.equal(collectKeys(home.capabilities).has(forbiddenKey), false,
    `home capability semantics exclude ${forbiddenKey}`);
}
const prefetchedCatalogCapabilities = structuredClone(home.capabilities) as any[];
prefetchedCatalogCapabilities[7].catalog = 'prefetched';
assertReason(
  () => assertLocalHomeSummaryV1({ ...home, capabilities: prefetchedCatalogCapabilities }),
  'CONTRACT_INVALID',
  'home cannot imply that the paid catalog was fetched before explicit intent',
);
const pricedPremiumCapabilities = structuredClone(home.capabilities) as any[];
pricedPremiumCapabilities[7].price = 1_000;
assertReason(
  () => assertLocalHomeSummaryV1({ ...home, capabilities: pricedPremiumCapabilities }),
  'UNKNOWN_FIELD',
  'home premium entry cannot embed a price or other server-owned catalog field',
);

const alternateNameContext = createLocalAnalysisContextV1({
  ...contextInput,
  surname: [{ hangul: '김', hanja: '金' }],
  givenName: [{ hangul: '하', hanja: '河' }, { hangul: '늘', hanja: '訥' }],
});
const alternateNameHome = await buildLocalHomeSummaryV1(homeEngine, alternateNameContext);
assert.deepEqual(
  alternateNameHome.facts,
  home.facts,
  'changing a name never changes the birth-derived home saju facts',
);

(homeEngine as any).getSajuReport = async () => {
  sajuPreviewCalls += 1;
  return { ...saju, yongshin: { ...saju.yongshin, confidence: Number.NaN } };
};
const invalidConfidenceHome = await buildLocalHomeSummaryV1(homeEngine, context);
assert.equal(invalidConfidenceHome.availability.status, 'limited');
assert.ok(invalidConfidenceHome.availability.reasonCodes.includes('SAJU_ANALYSIS_LIMITED'),
  'non-finite judgment confidence must fail closed instead of enabling paid-grade evidence');

(homeEngine as any).getSajuReport = async () => {
  sajuPreviewCalls += 1;
  return { analysisStatus: 'partial' } as SajuSummary;
};
const unavailableHome = await buildLocalHomeSummaryV1(homeEngine, context);
assert.equal(unavailableHome.availability.status, 'unavailable');
assert.ok(unavailableHome.availability.reasonCodes.includes('CORE_NATAL_FACTS_UNAVAILABLE'));
assert.equal(unavailableHome.facts, null);
for (const analysisStatus of ['failed', 'unavailable'] as const) {
  (homeEngine as any).getSajuReport = async () => {
    sajuPreviewCalls += 1;
    return { analysisStatus } as SajuSummary;
  };
  const failedHome = await buildLocalHomeSummaryV1(homeEngine, context);
  assert.equal(failedHome.availability.status, 'unavailable');
  assert.ok(failedHome.availability.reasonCodes.includes('SAJU_ANALYSIS_LIMITED'));
  assert.ok(failedHome.availability.reasonCodes.includes('CORE_NATAL_FACTS_UNAVAILABLE'));
  assert.equal(failedHome.facts, null,
    `${analysisStatus} adapter placeholders must never become home natal facts`);
}
(homeEngine as any).getSajuReport = async () => {
  sajuPreviewCalls += 1;
  return {
    ...saju,
    elementDistribution: { ...saju.elementDistribution, WATER: -1 },
  };
};
await assertRejectReason(
  () => buildLocalHomeSummaryV1(homeEngine, context),
  'CORE_NATAL_FACTS_INVALID',
  'invalid engine facts are not clamped into a home preview',
);
assert.equal(sajuPreviewCalls, 7, 'each home request recomputes natal facts from its exact context');
assert.equal(fullReportCalls, 0, 'home summary never invokes the full report path');
await assertRejectReason(
  () => buildLocalHomeSummaryV1(context as any, saju as any),
  'SPRING_ENGINE_REQUIRED',
  'detached saju summaries cannot be paired with a different local context',
);

const realHomeEngine = new SpringEngine();
const realHome = await buildLocalHomeSummaryV1(realHomeEngine, context);
assertLocalHomeSummaryV1(realHome);
assert.ok(realHome.facts,
  'the production SpringEngine accepts the birth-only carrier and returns natal home facts');
assert.equal(realHome.computation.natalSaju, 'birth_derived_invariant');
realHomeEngine.close();

function hanjaRow(overrides: Partial<HanjaEntry> = {}): HanjaEntry {
  return {
    id: 1,
    hangul: '수',
    hanja: '秀',
    onset: 'ㅅ',
    nucleus: 'ㅜ',
    strokes: 7,
    stroke_element: 'Metal',
    resource_element: 'Wood',
    meaning: '빼어날 수',
    radical: '禾',
    is_surname: false,
    ...overrides,
  };
}

const hanjaRows: HanjaEntry[] = [
  hanjaRow({ id: 3, hanja: '壽', strokes: 14, meaning: '목숨 수', radical: '士' }),
  hanjaRow({ id: 1, hanja: '秀', strokes: 7, meaning: '빼어날 수', radical: '禾' }),
  hanjaRow({ id: 2, hanja: '洙', strokes: 9, meaning: '물가 수', radical: '水' }),
];
const repository = new HanjaRepository();
let queryCount = 0;
(repository as any).findByHangul = async () => {
  queryCount += 1;
  return queryCount % 2 === 1 ? [...hanjaRows] : [...hanjaRows].reverse();
};

const page1 = await buildLocalHanjaLookupV1(repository, {
  schemaVersion: LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
  reading: '수',
  role: 'given_name',
  offset: 0,
  limit: 2,
});
const page2 = await buildLocalHanjaLookupV1(repository, {
  schemaVersion: LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
  reading: '수',
  role: 'given_name',
  offset: 2,
  limit: 2,
});
assertLocalHanjaLookupV1(page1);
assertLocalHanjaLookupV1(page2);
assert.deepEqual(page1.items.map((item) => item.hanja), ['秀', '洙']);
assert.deepEqual(page2.items.map((item) => item.hanja), ['壽']);
assert.equal(page1.pagination.totalAvailable, 3);
assert.equal(page1.pagination.hasMore, true);
assert.equal(page2.pagination.hasMore, false);
assert.equal(page1.ordering.clientInstruction, 'preserve_order');
assert.match(page1.provenance.databaseSha256, /^[0-9a-f]{64}$/u);
assert.equal(page1.provenance.legalValidation, 'exact_glyph_reading_pair');
assert.equal(page1.provenance.remoteLookup, 'forbidden');
assertReason(
  () => assertLocalHanjaLookupV1({
    ...page1,
    items: [{ ...page1.items[0]!, radical: ` ${page1.items[0]!.radical}` }, ...page1.items.slice(1)],
  }),
  'CONTRACT_INVALID',
  'lookup responses preserve canonical radical text from the verified repository',
);

const invalidLegalRepository = new HanjaRepository();
(invalidLegalRepository as any).findByHangul = async () => [
  hanjaRow({ hanja: '﨑', meaning: '검증되지 않은 별자' }),
];
await assertRejectReason(
  () => buildLocalHanjaLookupV1(invalidLegalRepository, {
    schemaVersion: LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
    reading: '수',
    role: 'given_name',
  }),
  'HANJA_LEGAL_AUTHORITY_MISMATCH',
  'an unverified glyph-reading pair fails closed',
);

const duplicateRepository = new HanjaRepository();
(duplicateRepository as any).findByHangul = async () => [hanjaRow(), hanjaRow({ id: 2 })];
await assertRejectReason(
  () => buildLocalHanjaLookupV1(duplicateRepository, {
    schemaVersion: LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
    reading: '수',
    role: 'given_name',
  }),
  'DUPLICATE_HANJA_ENTRY',
  'duplicates cannot destabilize pages',
);

const surnameRepository = new HanjaRepository();
(surnameRepository as any).findSurnamesByHangul = async () => [hanjaRow()];
await assertRejectReason(
  () => buildLocalHanjaLookupV1(surnameRepository, {
    schemaVersion: LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
    reading: '수',
    role: 'surname',
  }),
  'HANJA_SOURCE_ROW_INVALID',
  'surname lookup accepts only surname-authority rows',
);

const share = buildLocalShareExportV1(home);
assertLocalShareExportV1(share);
assert.match(share.exportId, LOCAL_SHARE_EXPORT_ID_PATTERN_V1);
assert.equal(share.transport, 'native_share_or_file');
assert.equal(share.privacy.urlEmbedding, 'forbidden');
assert.equal('contextId' in share, false);
assert.equal('birthPreview' in share.summary, false);
assert.equal('pillars' in share.summary, false);
const shareJson = JSON.stringify(share);
for (const personalValue of ['최', '성수', '1986-04-19', context.contextId]) {
  assert.equal(shareJson.includes(personalValue), false, `share omits ${personalValue}`);
}
const shareKeys = collectKeys(share);
for (const forbiddenKey of [
  'url', 'href', 'price', 'amount', 'currency', 'payment', 'paid',
  'entitlement', 'entitlementId', 'birth', 'name', 'contextId',
]) {
  assert.equal(shareKeys.has(forbiddenKey), false, `share forbids ${forbiddenKey}`);
}
assertReason(
  () => assertLocalShareExportV1({ ...share, url: 'https://example.test/?s=private' }),
  'UNKNOWN_FIELD',
  'share export cannot grow a URL field',
);
assertReason(
  () => assertLocalShareExportV1({
    ...share,
    summary: { availability: share.summary.availability },
  }),
  'CONTRACT_INVALID',
  'ready and limited share summaries require their core facts',
);
assertReason(
  () => assertLocalShareExportV1({
    ...share,
    summary: {
      ...share.summary,
      availability: {
        status: 'unavailable',
        reasonCodes: ['CORE_NATAL_FACTS_UNAVAILABLE'],
      },
    },
  }),
  'CONTRACT_INVALID',
  'unavailable share summaries cannot retain contradictory core facts',
);
assertReason(
  () => assertLocalHomeSummaryV1({ ...home, price: 1000 }),
  'UNKNOWN_FIELD',
  'free home summary cannot carry pricing',
);

const sourceText = fs.readFileSync(LOCAL_MENU_SOURCE, 'utf8');
for (const forbiddenSourceText of [
  'fetch(', 'getFortuneReport', 'buildFortuneReport', '/api/', 'http://', 'https://',
]) {
  assert.equal(
    sourceText.includes(forbiddenSourceText),
    false,
    `local menu module excludes ${forbiddenSourceText}`,
  );
}
assert.equal(fetchCalls, 0, 'all local menu builders complete without network I/O');

repository.close();
invalidLegalRepository.close();
duplicateRepository.close();
surnameRepository.close();
homeEngine.close();
globalThis.fetch = originalFetch;

console.log('local-menu-contract-v1: PASS');
