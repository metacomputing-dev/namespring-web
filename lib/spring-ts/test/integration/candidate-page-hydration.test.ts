/**
 * Characterizes the paged full-report hydration boundary with a fixed pool.
 *
 * Run: npm run test:candidate-page-hydration
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import engineConfig from '../../config/engine.json';
import {
  orderSpringReports,
  sliceCandidatePage,
} from '../../src/candidate-selection.js';
import {
  NameEntryResolutionError,
  SpringEngine,
} from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlString.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlString.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlString.includes('sql-wasm.wasm') || urlString === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error(`fetch unavailable for ${urlString}`);
};

const engine = new SpringEngine();
for (const repository of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
  if (repository) repository.wasmUrl = WASM_PATH;
}
await engine.init();

const candidates = ['\uBBFC', '\uC900', '\uC11C', '\uC724', '\uD558']
  .map((hangul) => [{ hangul }]);
let collectedCandidates: Array<Array<{ hangul: string; hanja?: string }>> = candidates;
(engine as any).collectNameInputs = async () => collectedCandidates
  .map((givenName) => ({ givenName }));

let nameStatCalls = 0;
(engine as any).getNameStatInfo = async (givenName: readonly { readonly hangul?: string }[]) => {
  nameStatCalls += 1;
  return {
    status: 'found',
    popularityRank: String(givenName[0]?.hangul ?? '').codePointAt(0) ?? null,
    maleRatio: 1,
    nameGender: 'male',
  };
};

const candidateOptions = {
  pureHangulNameMode: 'on' as const,
  precisionConfig: { paretoFrontierCandidates: true },
};
const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
  givenNameLength: 1,
  mode: 'recommend' as const,
};
const selectionLimits = {
  paretoPoolLimit: engineConfig.candidateSelection.paretoPoolLimit,
};

const eagerReports = [];
for (const givenName of candidates) {
  eagerReports.push(await engine.getSpringReport({
    ...baseRequest,
    givenName,
    mode: 'evaluate',
    options: candidateOptions,
  }));
}
const eagerOrder = orderSpringReports(eagerReports, candidateOptions, selectionLimits);

const originalPrepare = (engine as any).prepareSpringReportCandidate.bind(engine);
const originalHydrate = (engine as any).hydratePreparedSpringReportCandidate.bind(engine);
const originalFullReport = (engine as any).getSpringReportFromSnapshot.bind(engine);
let prepareCalls = 0;
let hydrateCalls = 0;
let fullReportCalls = 0;

function resetCounts(): void {
  prepareCalls = 0;
  hydrateCalls = 0;
  fullReportCalls = 0;
  nameStatCalls = 0;
}

(engine as any).prepareSpringReportCandidate = async (...args: unknown[]) => {
  prepareCalls += 1;
  return originalPrepare(...args);
};
(engine as any).hydratePreparedSpringReportCandidate = async (...args: unknown[]) => {
  hydrateCalls += 1;
  return originalHydrate(...args);
};
(engine as any).getSpringReportFromSnapshot = async (...args: unknown[]) => {
  fullReportCalls += 1;
  return originalFullReport(...args);
};

resetCounts();
const paged = await engine.getNameCandidates({
  ...baseRequest,
  options: { ...candidateOptions, offset: 1, limit: 2 },
});
assert.deepEqual(
  paged,
  sliceCandidatePage(eagerOrder, 1, 2),
  'paged hydration must remain byte-for-byte equivalent to eager report ordering',
);
assert.equal(prepareCalls, candidates.length, 'every candidate must complete mandatory preparation');
assert.equal(hydrateCalls, 2, 'only the selected page may be hydrated');
assert.equal(fullReportCalls, 2, 'only the selected page may build a full report');
assert.equal(nameStatCalls, candidates.length, 'hydration must reuse candidate-bound NameStat evidence');

resetCounts();
const allReports = await engine.getNameCandidates({
  ...baseRequest,
  options: candidateOptions,
});
assert.deepEqual(allReports, eagerOrder, 'an unpaged request must preserve the eager full-pool contract');
assert.equal(prepareCalls, 0, 'the eager full-pool path must avoid a redundant preparation pass');
assert.equal(hydrateCalls, 0, 'the eager full-pool path must not use paged hydration');
assert.equal(fullReportCalls, candidates.length, 'the eager full-pool path must hydrate every candidate once');

resetCounts();
const oversizedPage = await engine.getNameCandidates({
  ...baseRequest,
  options: { ...candidateOptions, limit: 99 },
});
assert.deepEqual(oversizedPage, eagerOrder, 'a page covering the pool must keep the eager path');
assert.equal(prepareCalls, 0);
assert.equal(hydrateCalls, 0);
assert.equal(fullReportCalls, candidates.length);

resetCounts();
const offsetOnlyPage = await engine.getNameCandidates({
  ...baseRequest,
  options: { ...candidateOptions, offset: 1 },
});
assert.deepEqual(offsetOnlyPage, eagerOrder.slice(1), 'offset-only paging keeps global ranks');
assert.equal(prepareCalls, candidates.length);
assert.equal(hydrateCalls, candidates.length - 1);
assert.equal(fullReportCalls, candidates.length - 1);

resetCounts();
const emptyPage = await engine.getNameCandidates({
  ...baseRequest,
  options: { ...candidateOptions, offset: 99 },
});
assert.deepEqual(emptyPage, []);
assert.equal(prepareCalls, candidates.length, 'an empty page still validates the complete candidate pool');
assert.equal(hydrateCalls, 0, 'an empty page must not hydrate a report');
assert.equal(fullReportCalls, 0, 'an empty page must not assemble a full report');

resetCounts();
const explicitCandidates = [
  [{ hangul: '\uBBFC', hanja: '\u65FB' }],
  [{ hangul: '\uBBFC', hanja: '\u73C9' }],
  [{ hangul: '\uBBFC', hanja: '\u65FB' }],
];
const explicitOptions = {
  pureHangulNameMode: 'off' as const,
  precisionConfig: { paretoFrontierCandidates: true },
};
const explicitEagerReports = [];
for (const givenName of explicitCandidates) {
  explicitEagerReports.push(await engine.getSpringReport({
    ...baseRequest,
    givenName,
    mode: 'evaluate',
    options: explicitOptions,
  }));
}
const explicitEagerOrder = orderSpringReports(
  explicitEagerReports,
  explicitOptions,
  selectionLimits,
);
resetCounts();
collectedCandidates = explicitCandidates;
const explicitPage = await engine.getNameCandidates({
  ...baseRequest,
  options: { ...explicitOptions, offset: 1, limit: 2 },
});
assert.deepEqual(
  explicitPage,
  sliceCandidatePage(explicitEagerOrder, 1, 2),
  'same-Hangul Hanja variants and exact duplicate occurrences must survive lazy hydration',
);
assert.equal(prepareCalls, explicitCandidates.length);
assert.equal(hydrateCalls, 2);
assert.equal(fullReportCalls, 2);

resetCounts();
collectedCandidates = [
  candidates[0]!,
  candidates[1]!,
  [{ hangul: '\uBBFC', hanja: '\u91D1' }],
];
await assert.rejects(
  () => engine.getNameCandidates({
    ...baseRequest,
    options: { ...candidateOptions, pureHangulNameMode: 'auto', limit: 1 },
  }),
  (error: unknown) => error instanceof NameEntryResolutionError
    && error.reason === 'hangul_hanja_reading_mismatch',
  'a later candidate identity failure must reject before page hydration starts',
);
assert.equal(prepareCalls, collectedCandidates.length);
assert.equal(hydrateCalls, 0);
assert.equal(fullReportCalls, 0);

resetCounts();
collectedCandidates = candidates;
(engine as any).getSpringReportFromSnapshot = async (...args: unknown[]) => {
  fullReportCalls += 1;
  const report = await originalFullReport(...args);
  return { ...report, finalScore: report.finalScore + 0.1 };
};
await assert.rejects(
  () => engine.getNameCandidates({
    ...baseRequest,
    options: { ...candidateOptions, limit: 1 },
  }),
  /does not match its validated selection projection/,
  'selection and hydration drift must fail closed',
);
assert.equal(prepareCalls, candidates.length);
assert.equal(hydrateCalls, 1);
assert.equal(fullReportCalls, 1);

engine.close();
console.log('Candidate page hydration: PASS');
