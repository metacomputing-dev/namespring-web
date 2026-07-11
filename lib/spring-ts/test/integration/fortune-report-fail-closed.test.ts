import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpringEngine } from '../../src/spring-engine.js';
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
check('an omitted target date is the only current-time fallback',
  Number.isFinite(resolveFortuneTargetDate(undefined).getTime()));

const generationProbe = new SpringEngine() as any;
let capturedTargetElements: Set<string> | null = null;
let capturedAvoidElements: Set<string> | null = null;
generationProbe.resolveEntries = async () => [];
generationProbe.buildPositionPools = async (
  _request: unknown,
  _nameLength: unknown,
  _jamoFilters: unknown,
  _hasJamoFilter: unknown,
  _surnameEntries: unknown,
  targetElements: Set<string>,
  avoidElements: Set<string>,
) => {
  capturedTargetElements = targetElements;
  capturedAvoidElements = avoidElements;
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
check('unavailable saju recommendation has no fabricated avoid element',
  capturedAvoidElements?.size === 0);
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
    invalidBirthError instanceof SajuAnalysisUnavailableError);
  check('engine error preserves invalid-date diagnostics',
    invalidBirthError instanceof SajuAnalysisUnavailableError
      && invalidBirthError.diagnostics[0]?.reasonCode === 'BIRTH_DATE_INVALID');

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
    unknownPresetError instanceof SajuAnalysisUnavailableError);
  check('engine error preserves unknown-school diagnostics',
    unknownPresetError instanceof SajuAnalysisUnavailableError
      && unknownPresetError.diagnostics[0]?.reasonCode === 'SAJU_UNKNOWN_SCHOOL_PRESET');
} finally {
  await engine.close();
  globalThis.fetch = originalFetch;
}

const valid = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});
const throwingDistribution = new Proxy<Record<string, number>>({}, {
  ownKeys() {
    throw new Error('synthetic required-card failure');
  },
});
const brokenSummary = {
  ...valid.summary,
  elementDistribution: throwingDistribution,
};
const buildError = await captureError(() =>
  buildFortuneReport(brokenSummary, new Date('2026-07-11T00:00:00+09:00'), null));
check('required card failures reject instead of returning neutral three-star fallbacks',
  buildError instanceof FortuneReportBuildError);

console.log(`\nFortune report fail-closed: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
