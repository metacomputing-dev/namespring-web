/**
 * test/integration/phonetic-rules.test.ts
 *
 * Verifies PR-2.5 display-only Korean phonetic evidence.
 *
 * Run: npm run test:phonetic
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine, getPhoneticAnalysis } from '../../src/index.js';
import { buildNameCompatibilityCard } from '../../src/report/cards/name-compatibility-card.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  if (originalFetch) return originalFetch(url as any, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

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

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, relativePath), 'utf-8')) as T;
}

function chars(text: string): Array<{ hangul: string }> {
  return Array.from(text).map((hangul) => ({ hangul }));
}

function hasWarning(analysis: ReturnType<typeof getPhoneticAnalysis>, code: string): boolean {
  return analysis.warnings.some((warning) => warning.code === code) ||
    analysis.transitions.some((transition) => transition.signals.some((signal) => signal.code === code));
}

console.log('Phase 2 phonetic rules\n');

const sources = readJson('data/sources/phonetic.sources.json');
check('phonetic source registry schema is current',
  sources.schemaVersion === 'spring-ts.phonetic-sources.v1');
check('source registry separates official and authored records',
  sources.sourceTier?.tier === 'T3_AUTHORED_INTERPRETATION' &&
    sources.sources.some((row: any) =>
      row.id === 'unicode_hangul_decomposition_algorithm_17_0_0' &&
      row.sourceTier?.tier === 'T5_OFFICIAL' &&
      row.sourceTier?.authorityTruthEligible === true) &&
    sources.sources.some((row: any) =>
      row.id === 'phonetic_flow_display_policy' &&
      row.sourceTier?.tier === 'T3_AUTHORED_INTERPRETATION' &&
      row.sourceTier?.authorityTruthEligible === false));
check('low-tier phonetic records are not authority truth',
  sources.sources.every((row: any) =>
    !/^T[0-2]_/.test(row.sourceTier?.tier ?? '') || row.sourceTier?.authorityTruthEligible !== true));

const smooth = getPhoneticAnalysis(chars('\uCD5C'), chars('\uC11C\uC544'));
const nasal = getPhoneticAnalysis(chars('\uBC15'), chars('\uBBFC'));
const repeated = getPhoneticAnalysis(chars('\uD55C'), chars('\uB098'));
const complex = getPhoneticAnalysis(chars('\uAC12'), chars('\uC774'));
const missing = getPhoneticAnalysis([], chars('\uB098'));

check('smooth open-flow fixture has no warnings',
  smooth.phoneticScore === 100 &&
    smooth.warnings.length === 0 &&
    smooth.status === 'smooth',
  JSON.stringify(smooth));
check('batchim-to-nasal boundary is flagged',
  hasWarning(nasal, 'nasal_assimilation_boundary') &&
    Number(nasal.familyNameFitScore) < 100 &&
    nasal.sourceTier === 'T3_AUTHORED_INTERPRETATION' &&
    nasal.authorityTruthEligible === false,
  JSON.stringify(nasal));
check('repeated coda-to-onset boundary is flagged',
  hasWarning(repeated, 'same_coda_onset_repeat'),
  JSON.stringify(repeated));
check('complex batchim boundary is flagged without official severity claim',
  hasWarning(complex, 'complex_batchim_boundary') &&
    complex.evidence.some((row) => row.includes('표시용')),
  JSON.stringify(complex));
check('missing surname returns unknown display analysis',
  missing.status === 'unknown' &&
    missing.phoneticScore === null);

const baseRequest = {
  birth: { year: 2024, month: 3, day: 1, hour: 9, minute: 0, gender: 'male' as const },
  surname: chars('\uBC15'),
  givenName: chars('\uBBFC\uC900'),
  mode: 'evaluate' as const,
  options: { pureHangulNameMode: 'on' as const },
};

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  repo.wasmUrl = WASM_PATH;
}
await engine.init();

const baselineReport = await engine.getSpringReport(baseRequest);
const phoneticReport = await engine.getSpringReport({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfacePhoneticEvidence: true },
  },
});
const reportPhonetic = phoneticReport.phonetic;

check('default SpringReport omits phonetic fields',
  baselineReport.phonetic === undefined &&
    baselineReport.namingReport.phonetic === undefined);
check('phonetic opt-in leaves final score unchanged',
  phoneticReport.finalScore === baselineReport.finalScore &&
    phoneticReport.namingReport.totalScore === baselineReport.namingReport.totalScore,
  `baseline=${baselineReport.finalScore}, phonetic=${phoneticReport.finalScore}`);
check('phonetic opt-in surfaces report evidence',
  !!reportPhonetic &&
    reportPhonetic.givenHangul === '\uBBFC\uC900' &&
    phoneticReport.namingReport.phonetic?.status !== undefined &&
    hasWarning(reportPhonetic, 'nasal_assimilation_boundary'),
  JSON.stringify(reportPhonetic));

const namingReport = await engine.getNamingReport({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfacePhoneticEvidence: true },
  },
});
check('getNamingReport surfaces opt-in phonetic evidence',
  namingReport.phonetic?.fullHangul === '\uBC15\uBBFC\uC900' &&
    namingReport.phonetic?.evidence.some((row) => row.includes('표시용')));

const baselineCard = buildNameCompatibilityCard(baselineReport);
const phoneticCard = buildNameCompatibilityCard(phoneticReport);
check('name compatibility card keeps headline stars unchanged',
  baselineCard?.overallStars === phoneticCard?.overallStars &&
    phoneticCard?.phonetic?.givenHangul === '\uBBFC\uC900');

const baselineResponse = await engine.analyze(baseRequest);
const phoneticResponse = await engine.analyze({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfacePhoneticEvidence: true },
  },
});
check('default analyze response omits phonetic analysis',
  baselineResponse.candidates[0]?.analysis.phonetic === undefined);
check('phonetic opt-in leaves analyze score unchanged',
  phoneticResponse.candidates[0]?.scores.total === baselineResponse.candidates[0]?.scores.total &&
    phoneticResponse.candidates[0]?.analysis.phonetic?.givenHangul === '\uBBFC\uC900',
  JSON.stringify(phoneticResponse.candidates[0]?.analysis.phonetic));

(engine as any).getNameStatInfo = async () => ({
  status: 'found',
  popularityRank: 1,
  maleRatio: 1,
  nameGender: 'male',
});
const summaries = await engine.getNameCandidateSummaries({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfacePhoneticEvidence: true },
  },
});
check('getNameCandidateSummaries surfaces opt-in phonetic evidence',
  summaries[0]?.phonetic?.givenHangul === '\uBBFC\uC900' &&
    summaries[0]?.phonetic?.evidence.some((row) => row.includes('표시용')));

engine.close();

console.log(`\nPhonetic rules: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
