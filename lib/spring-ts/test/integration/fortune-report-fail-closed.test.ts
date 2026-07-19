import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FortuneSajuUnavailableError, SpringEngine } from '../../src/spring-engine.js';
import {
  RepositoryDataError,
  SpringNameRequestValidationError,
} from '../../src/index.js';
import { analyzeSajuSafe, emptySaju } from '../../src/saju-adapter.js';
import {
  SajuAnalysisUnavailableError,
} from '../../src/saju-analysis-contract.js';
import { buildFortuneReport } from '../../src/report/buildFortuneReport.js';
import {
  FortuneReportBuildError,
  FortuneTargetDateInvalidError,
  resolveFortuneTargetDate,
} from '../../src/report/report-input-contract.js';
import { SajuRequestValidationError } from '../../src/saju-request-policy.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const springRoot = path.resolve(testDir, '../..');
const namespringData = path.resolve(springRoot, '../../namespring/public/data');
const wasmPath = path.resolve(springRoot, 'node_modules/sql.js/dist/sql-wasm.wasm');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  const urlString = typeof url === 'string'
    ? url
    : url instanceof URL
      ? url.toString()
      : url.url;
  if (urlString.startsWith('/data/')) {
    const filePath = path.join(namespringData, urlString.slice('/data/'.length));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlString.includes('sql-wasm.wasm') || urlString === wasmPath) {
    return new Response(fs.readFileSync(wasmPath), { status: 200 });
  }
  return originalFetch(url, options);
};

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}`);
    return;
  }
  fail += 1;
  console.error(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
    return null;
  } catch (error) {
    return error;
  }
}

console.log('Fortune report fail-closed contract\n');

const missingSummary = emptySaju('BIRTH_INPUT_INSUFFICIENT');
const directError = await captureError(() =>
  buildFortuneReport(missingSummary, new Date('2026-07-11T00:00:00+09:00'), null));
check('direct report builder rejects an unavailable natal analysis',
  directError instanceof SajuAnalysisUnavailableError);
check('unavailable report error preserves the structured reason',
  directError instanceof SajuAnalysisUnavailableError
    && directError.diagnostics[0]?.reasonCode === 'BIRTH_INPUT_INSUFFICIENT');

let targetDateError: unknown = null;
try {
  resolveFortuneTargetDate('not-a-date');
} catch (error) {
  targetDateError = error;
}
check('an explicit invalid target date fails closed',
  targetDateError instanceof FortuneTargetDateInvalidError);
for (const invalidTarget of [
  '2025-02-30',
  '2025/02/28',
  '2025-02-28T12:00:00',
  '2025-02-28T24:00:00Z',
  '2025-02-28T12:00:00+14:30',
]) {
  const error = await captureError(async () => {
    resolveFortuneTargetDate(invalidTarget);
  });
  check(`non-canonical target date fails closed: ${invalidTarget}`,
    error instanceof FortuneTargetDateInvalidError);
}
check('an omitted target date is the only current-time fallback',
  Number.isFinite(resolveFortuneTargetDate(undefined).getTime()));

const secretTargetDate = `private-${'x'.repeat(256)}`;
const oversizedTargetError = await captureError(() => Promise.resolve(
  resolveFortuneTargetDate(secretTargetDate),
));
check('oversized target dates fail with the typed boundary error',
  oversizedTargetError instanceof FortuneTargetDateInvalidError);
check('target-date errors never retain or serialize the raw input',
  oversizedTargetError instanceof FortuneTargetDateInvalidError
    && !('input' in oversizedTargetError)
    && !JSON.stringify(oversizedTargetError).includes(secretTargetDate));

const boundaryProbe = new SpringEngine() as any;
let boundaryInitCalls = 0;
boundaryProbe.init = async () => { boundaryInitCalls += 1; };
const malformedNameError = await captureError(() => boundaryProbe.getFortuneReport({
  birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
  surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
  givenName: {} as never,
  targetDate: '2026-07-11T00:00:00+09:00',
}));
check('malformed optional fortune names fail at the public boundary',
  malformedNameError instanceof SpringNameRequestValidationError);
check('malformed fortune names fail before repository initialization',
  boundaryInitCalls === 0);

const emptyArrayProbe = new SpringEngine() as any;
let emptyArrayInitCalls = 0;
const emptyArrayInitSentinel = new Error('empty-array compatibility sentinel');
emptyArrayProbe.init = async () => {
  emptyArrayInitCalls += 1;
  throw emptyArrayInitSentinel;
};
const emptyArrayError = await captureError(() => emptyArrayProbe.getFortuneReport({
  birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
  surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
  givenName: [],
  targetDate: '2026-07-11T00:00:00+09:00',
}));
check('an empty given-name array preserves the legacy nameless route',
  emptyArrayError === emptyArrayInitSentinel && emptyArrayInitCalls === 1);

const generationProbe = new SpringEngine() as any;
let capturedTargetElements: Set<string> | null = null;
let capturedPreferenceStrength: string | null = null;
generationProbe.resolveEntries = async () => [];
generationProbe.buildPositionPools = async (
  _request: unknown,
  _nameLength: unknown,
  _jamoFilters: unknown,
  _hasJamoFilter: unknown,
  _surnameEntries: unknown,
  targetElements: Set<string>,
  preferenceStrength: string,
) => {
  capturedTargetElements = targetElements;
  capturedPreferenceStrength = preferenceStrength;
  return new Map();
};
generationProbe.generateViaStrokeOptimizer = () => [];
generationProbe.filterInternallyRepeatedCandidates = (rows: unknown) => rows;
generationProbe.filterGeneratedCandidatesByLegalStatus = (rows: unknown) => rows;
await generationProbe.generateCandidates({
  birth: { gender: 'neutral' },
  surname: [],
  givenNameLength: 1,
  mode: 'recommend',
}, missingSummary);
check('unavailable saju recommendation has no fabricated target element',
  capturedTargetElements?.size === 0);
check('unavailable saju recommendation has neutral element preference',
  capturedPreferenceStrength === 'none');
const nameOnlyResponse = generationProbe.buildResponse(
  {
    birth: { gender: 'neutral' },
    surname: [],
    mode: 'recommend',
  },
  'recommend',
  missingSummary,
  [],
);
check('response metadata exposes explicit name-only generation',
  nameOnlyResponse.meta.sajuAnalysis?.enabled === false
    && nameOnlyResponse.meta.sajuAnalysis?.generationMode === 'name_only'
    && nameOnlyResponse.meta.sajuAnalysis?.status === 'partial');

const engine = new SpringEngine();
for (const repository of [
  (engine as any).hanjaRepo,
  (engine as any).fourFrameRepo,
  (engine as any).nameStatRepo,
]) {
  if (repository) repository.wasmUrl = wasmPath;
}
try {
  const invalidBirthError = await captureError(() => engine.getFortuneReport({
    birth: {
      year: 2025, month: 2, day: 31, hour: 12, minute: 0,
      gender: 'male', calendarType: 'solar',
    },
    targetDate: '2026-07-11T00:00:00+09:00',
  }));
  check('engine rejects an invalid birth before producing fortune cards',
    invalidBirthError instanceof SajuRequestValidationError);
  check('engine error preserves invalid-date diagnostics',
    invalidBirthError instanceof SajuRequestValidationError
      && invalidBirthError.reasonCode === 'BIRTH_DATE_INVALID');

  const unknownPresetError = await captureError(() => engine.getFortuneReport({
    birth: {
      year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
    },
    targetDate: '2026-07-11T00:00:00+09:00',
    options: {
      precisionConfig: { sajuSchoolId: 'missing.school.for-fortune-fail-closed' },
    } as never,
  }));
  check('engine rejects an unknown school instead of fabricating a fortune',
    unknownPresetError instanceof FortuneSajuUnavailableError);
  check('engine error preserves unknown-school diagnostics',
    unknownPresetError instanceof FortuneSajuUnavailableError
      && unknownPresetError.reasonCode === 'SAJU_UNKNOWN_SCHOOL_PRESET');
} finally {
  await engine.close();
  globalThis.fetch = originalFetch;
}

const valid = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});
const namedFortuneProbe = new SpringEngine() as any;
const nameDataError = new RepositoryDataError(
  'name-stat',
  'row.yearly_birth_json.male.2020',
  'expected a finite non-negative safe integer',
);
namedFortuneProbe.init = async () => {};
namedFortuneProbe.getSajuReport = async () => ({ ...valid.summary, sajuEnabled: true });
// getFortuneReport deliberately calls the private, already-snapshotted seam so
// that validation cannot be bypassed through a mutable public request.  Stub
// that actual seam here: mocking getSpringReport would let this regression
// test pass without exercising the production call path.
namedFortuneProbe.getSpringReportFromSnapshot = async () => { throw nameDataError; };
const namedFortuneError = await captureError(() => namedFortuneProbe.getFortuneReport({
  birth: {
    year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
  },
  surname: [{ hangul: '\uCD5C' }],
  givenName: [{ hangul: '\uC131' }, { hangul: '\uC218' }],
  targetDate: '2026-07-11T00:00:00+09:00',
}));
check('named fortune reports preserve name-data integrity failures',
  namedFortuneError === nameDataError);

const brokenSummary = {
  ...valid.summary,
  // Keep the fixture inside the plain-data public input contract so it reaches
  // the required-card boundary rather than failing earlier during snapshotting.
  elementDistribution: null as any,
};
const buildError = await captureError(() =>
  buildFortuneReport(brokenSummary, new Date('2026-07-11T00:00:00+09:00'), null));
check('required card failures reject instead of returning neutral three-star fallbacks',
  buildError instanceof FortuneReportBuildError);

console.log(`\nFortune report fail-closed: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
