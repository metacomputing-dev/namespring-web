/**
 * test/integration/candidate-pagination.test.ts
 *
 * Public candidate APIs should honor explicit SpringOptions.limit/offset.
 * The full candidate pool can be large, but list consumers need bounded
 * payloads from getNameCandidates() and getNameCandidateSummaries().
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

import { sliceCandidatePage } from '../../src/candidate-selection.js';
import { SpringEngine } from '../../src/index.js';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

for (const [offset, limit] of [
  [-1, 1],
  [0, 0],
  [0, -1],
  [0.5, 1],
  [0, 1.5],
  [Number.NaN, 1],
  [0, Number.POSITIVE_INFINITY],
  [Number.MAX_SAFE_INTEGER, 1],
] as const) {
  assert.throws(
    () => sliceCandidatePage([1, 2, 3], offset, limit),
    RangeError,
    'internal pagination must reject coercible or unbounded values',
  );
}
assert.deepEqual(sliceCandidatePage([1, 2, 3], 1, 2), [2, 3]);

console.log('Candidate API pagination\n');

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) repo.wasmUrl = WASM_PATH; }
await engine.init();

function popularityRankFor(givenName: readonly { readonly hangul?: string }[]): number {
  return givenName
    .flatMap((char) => Array.from(String(char.hangul ?? '')))
    .reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0);
}

let nameStatLookupCalls = 0;
(engine as any).getNameStatInfo = async (givenName: readonly { readonly hangul?: string }[]) => {
  nameStatLookupCalls += 1;
  return ({
  status: 'found',
  popularityRank: popularityRankFor(givenName),
  maleRatio: 1,
  nameGender: 'male',
  });
};
const originalFilterCandidatesByNameStat =
  (engine as any).enrichCandidatesWithNameStat.bind(engine);
let nameStatFilterInputCount = 0;
let nameStatDistinctInputCount = 0;
(engine as any).enrichCandidatesWithNameStat = async (
  inputs: Array<readonly { readonly hangul?: string }[]>,
  ...args: unknown[]
) => {
  nameStatFilterInputCount += inputs.length;
  nameStatDistinctInputCount += new Set(inputs.map((givenName) =>
    givenName.map((char) => String(char.hangul ?? '')).join('').trim())).size;
  return originalFilterCandidatesByNameStat(inputs, ...args);
};

const repeatedHangulEvidence = await (engine as any).enrichCandidatesWithNameStat([
  [{ hangul: '하', hanja: '河' }, { hangul: '윤', hanja: '潤' }],
  [{ hangul: '하', hanja: '夏' }, { hangul: '윤', hanja: '允' }],
]);
check('NameStat enrichment resolves one request-local lookup per Hangul name',
  nameStatLookupCalls === 1
    && repeatedHangulEvidence.length === 2
    && repeatedHangulEvidence[0].nameStat.info
      === repeatedHangulEvidence[1].nameStat.info,
  `lookups=${nameStatLookupCalls}`);
nameStatLookupCalls = 0;
nameStatFilterInputCount = 0;
nameStatDistinctInputCount = 0;

const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
  givenNameLength: 1,
  mode: 'recommend' as const,
};

const reports = await engine.getNameCandidates({
  ...baseRequest,
  options: { limit: 3 },
});
check('getNameCandidates honors explicit limit',
  reports.length === 3,
  `length=${reports.length}`);
check('getNameCandidates keeps page ranks stable',
  reports.map((row) => row.rank).join(',') === '1,2,3',
  reports.map((row) => row.rank).join(','));
check('getNameCandidates carries deduplicated NameStat results into report materialization',
  nameStatFilterInputCount > 0 && nameStatLookupCalls === nameStatDistinctInputCount,
  `lookups=${nameStatLookupCalls}, distinct=${nameStatDistinctInputCount}, inputs=${nameStatFilterInputCount}`);
check('getNameCandidates keeps each carried NameStat result bound to its candidate',
  reports.every((row) =>
    row.popularityRank === popularityRankFor(row.namingReport.name.givenName)),
  reports.map((row) => `${row.namingReport.name.fullHangul}:${row.popularityRank}`).join(','));

nameStatLookupCalls = 0;
nameStatFilterInputCount = 0;
nameStatDistinctInputCount = 0;
const summaries = await engine.getNameCandidateSummaries({
  ...baseRequest,
  options: { limit: 4, offset: 2 },
});
check('getNameCandidateSummaries honors explicit limit',
  summaries.length === 4,
  `length=${summaries.length}`);
check('getNameCandidateSummaries honors explicit offset',
  summaries[0]?.rank === 3 && summaries.map((row) => row.rank).join(',') === '3,4,5,6',
  summaries.map((row) => row.rank).join(','));
check('getNameCandidateSummaries avoids duplicate Hangul rows on a page',
  new Set(summaries.map((row) => row.fullHangul)).size === summaries.length,
  summaries.map((row) => row.fullHangul).join(','));
check('getNameCandidateSummaries includes display Hanja meanings',
  summaries.every((row) => row.givenName.every((char) =>
    typeof char.meaning === 'string' && char.meaning.length > 0)),
  summaries.map((row) => row.givenName.map((char) => char.meaning ?? '').join('/')).join(','));
check('getNameCandidateSummaries carries deduplicated NameStat results into scoring',
  nameStatFilterInputCount > 0 && nameStatLookupCalls === nameStatDistinctInputCount,
  `lookups=${nameStatLookupCalls}, distinct=${nameStatDistinctInputCount}, inputs=${nameStatFilterInputCount}`);
check('getNameCandidateSummaries keeps each carried NameStat result bound to its candidate',
  summaries.every((row) => row.popularityRank === popularityRankFor(row.givenName)),
  summaries.map((row) => `${row.fullHangul}:${row.popularityRank}`).join(','));

const collectNameInputs = (engine as any).collectNameInputs.bind(engine);
(engine as any).collectNameInputs = async () => [];
const emptyReports = await engine.getNameCandidates({
  ...baseRequest,
  options: { offset: 0 },
});
const emptySummaries = await engine.getNameCandidateSummaries({
  ...baseRequest,
  options: { offset: 0 },
});
(engine as any).collectNameInputs = collectNameInputs;
check('getNameCandidates returns an empty offset-only page',
  emptyReports.length === 0);
check('getNameCandidateSummaries returns an empty offset-only page',
  emptySummaries.length === 0);

const candidateRejections = new Map();
const generated = await (engine as any).generateCandidates({
  ...baseRequest,
  givenNameLength: 2,
}, {
  yongshin: { element: 'METAL', heeshin: null, gishin: null, gushin: null },
  deficientElements: [],
  excessiveElements: [],
}, undefined, candidateRejections);
const generatedHanja = generated.flat().map((char: any) => String(char.hanja ?? ''));
const rejectionSummary = (engine as any).candidateRejectionSummary(candidateRejections);
check('generated recommendations exclude unsafe Hanja meanings',
  !generatedHanja.includes('贓'),
  generatedHanja.slice(0, 20).join(','));
check('unsafe Hanja meaning rejection is recorded',
  rejectionSummary.some((row: any) => row.reason === 'unsafe_hanja_meaning'),
  JSON.stringify(rejectionSummary));
check('generated recommendations exclude opaque one-syllable Hanja meanings',
  !generatedHanja.some((hanja) => ['勺'].includes(hanja)),
  generatedHanja.slice(0, 20).join(','));
const authoredWeakEntry = {
  id: 9001,
  hangul: '정',
  hanja: '丁',
  onset: 'ㅈ',
  nucleus: 'ㅓ',
  strokes: 2,
  stroke_element: 'Wood',
  resource_element: 'Wood',
  meaning: '고무래 정',
  radical: '',
  is_surname: false,
};
const reviewedPositiveEntry = {
  ...authoredWeakEntry,
  id: 9002,
  hangul: '가',
  hanja: '佳',
  meaning: '아름다울 가',
};
const softMeaningRejections = new Map();
const softMeaningRetained = (engine as any).filterPresentationSafeEntries(
  [authoredWeakEntry],
  'curated',
  softMeaningRejections,
);
check('authored positive-whitelist misses do not hard-reject legal Hanja',
  softMeaningRetained.length === 1
    && !(engine as any).candidateRejectionSummary(softMeaningRejections)
      .some((row: any) => row.reason === 'weak_hanja_meaning'));
const meaningOrdered = (engine as any).orderCandidateGenerationPool(
  [authoredWeakEntry, reviewedPositiveEntry],
  new Set(),
  'none',
);
check('reviewed-positive meaning glosses receive only a soft pool preference',
  meaningOrdered.map((entry: any) => entry.hanja).join(',') === '佳,丁',
  meaningOrdered.map((entry: any) => entry.hanja).join(','));

engine.close();

console.log(`\nCandidate API pagination: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
