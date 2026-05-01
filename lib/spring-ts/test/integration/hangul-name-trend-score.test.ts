/**
 * test/integration/hangul-name-trend-score.test.ts
 *
 * Verifies PR-2.4 Hangul name trend evidence.
 *
 * Run: npm run test:name-trend
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine, getNameTrendAnalysis } from '../../src/index.js';
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

function given(name: string): Array<{ hangul: string }> {
  return Array.from(name).map((hangul) => ({ hangul }));
}

console.log('Phase 2 Hangul name trend score\n');

const data = readJson('data/hangul-name-trends.json');
const sources = readJson('data/sources/name-trend.sources.json');

check('trend fixture schema is current',
  data.schemaVersion === 'spring-ts.hangul-name-trends.v1');
check('trend fixture has 200 official rows',
  data.rows.length === data.query.queryYears.length * 2 * data.query.maxRankPerYearGender &&
    data.rows.every((row: any) => row.sourceTier === 'T5_OFFICIAL'));
const rowKeys = new Set(data.rows.map((row: any) =>
  `${row.name}:${row.gender}:${row.year}:${row.rank}`));
check('trend fixture rows are unique',
  rowKeys.size === data.rows.length,
  `unique=${rowKeys.size}, rows=${data.rows.length}`);
check('source registry records official court statistics',
  sources.sourceTier?.tier === 'T5_OFFICIAL' &&
    sources.sources.some((row: any) => row.id === 'scourt_birth_name_rank_1811'));

const doyun2024 = getNameTrendAnalysis(given('도윤'), {
  year: 2024, month: 1, day: 1, hour: null, minute: null, gender: 'male',
});
const minjun2024 = getNameTrendAnalysis(given('민준'), {
  year: 2024, month: 1, day: 1, hour: null, minute: null, gender: 'male',
});
const minjun2008 = getNameTrendAnalysis(given('민준'), {
  year: 2008, month: 1, day: 1, hour: null, minute: null, gender: 'male',
});
const seoa2024Female = getNameTrendAnalysis(given('서아'), {
  year: 2024, month: 1, day: 1, hour: null, minute: null, gender: 'female',
});
const seoa2024Male = getNameTrendAnalysis(given('서아'), {
  year: 2024, month: 1, day: 1, hour: null, minute: null, gender: 'male',
});
const missingYear = getNameTrendAnalysis(given('도윤'), {
  year: undefined, month: 1, day: 1, hour: null, minute: null, gender: 'male',
});
const pre2008 = getNameTrendAnalysis(given('민준'), {
  year: 2007, month: 1, day: 1, hour: null, minute: null, gender: 'male',
});
const absentName = getNameTrendAnalysis(given('가온'), {
  year: 2024, month: 1, day: 1, hour: null, minute: null, gender: 'male',
});

check('current male trend scores above dated male trend',
  Number(doyun2024.trendFit) > Number(minjun2024.trendFit) &&
    Number(doyun2024.trendRisk) < Number(minjun2024.trendRisk),
  JSON.stringify({ doyun2024, minjun2024 }));
check('eraFitScore mirrors bounded trendFit',
  doyun2024.eraFitScore === doyun2024.trendFit &&
    Number(doyun2024.eraFitScore) >= 0 &&
    Number(doyun2024.eraFitScore) <= 100);
check('birth-era fit is year-sensitive',
  Number(minjun2008.trendFit) > Number(minjun2024.trendFit) &&
    minjun2008.status === 'era_fit',
  JSON.stringify({ minjun2008, minjun2024 }));
check('trend fixture is gender-separated',
  seoa2024Female.status === 'overused' &&
    seoa2024Male.status === 'unknown',
  JSON.stringify({ seoa2024Female, seoa2024Male }));
check('missing birth year is unknown',
  missingYear.status === 'unknown' &&
    missingYear.trendFit === null &&
    missingYear.trendRisk === null);
check('pre-2008 birth year is outside scope',
  pre2008.status === 'unknown' && pre2008.birthYear === 2007);
check('name absent from fixture is unknown',
  absentName.status === 'unknown' && absentName.givenHangul === '가온');

const baseRequest = {
  birth: { year: 2024, month: 3, day: 1, hour: 9, minute: 0, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: given('도윤'),
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
const trendReport = await engine.getSpringReport({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfaceNameTrend: true },
  },
});

check('default SpringReport omits trend fields',
  baselineReport.nameTrend === undefined &&
    baselineReport.namingReport.nameTrend === undefined);
check('trend opt-in leaves final score unchanged',
  trendReport.finalScore === baselineReport.finalScore &&
    trendReport.namingReport.totalScore === baselineReport.namingReport.totalScore,
  `baseline=${baselineReport.finalScore}, trend=${trendReport.finalScore}`);
check('trend opt-in surfaces report evidence',
  trendReport.nameTrend?.givenHangul === '도윤' &&
    trendReport.namingReport.nameTrend?.status === 'overused' &&
    trendReport.nameTrend?.eraFitScore === trendReport.nameTrend?.trendFit,
  JSON.stringify(trendReport.nameTrend));

const namingReport = await engine.getNamingReport({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfaceNameTrend: true },
  },
});
check('getNamingReport surfaces opt-in trend evidence',
  namingReport.nameTrend?.givenHangul === '도윤' &&
    namingReport.nameTrend?.eraFitScore === namingReport.nameTrend?.trendFit);

const baselineCard = buildNameCompatibilityCard(baselineReport);
const trendCard = buildNameCompatibilityCard(trendReport);
check('name compatibility card keeps headline stars unchanged',
  baselineCard?.overallStars === trendCard?.overallStars &&
    trendCard?.nameTrend?.givenHangul === '도윤');

const baselineResponse = await engine.analyze(baseRequest);
const trendResponse = await engine.analyze({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfaceNameTrend: true },
  },
});
check('default analyze response omits trend analysis',
  baselineResponse.candidates[0]?.analysis.nameTrend === undefined);
check('trend opt-in leaves analyze score unchanged',
  trendResponse.candidates[0]?.scores.total === baselineResponse.candidates[0]?.scores.total &&
    trendResponse.candidates[0]?.analysis.nameTrend?.givenHangul === '도윤',
  JSON.stringify(trendResponse.candidates[0]?.analysis.nameTrend));

(engine as any).getNameStatInfo = async () => ({
  exists: true,
  popularityRank: 1,
  maleRatio: 1,
  nameGender: 'male',
});
const summaries = await engine.getNameCandidateSummaries({
  ...baseRequest,
  options: {
    ...baseRequest.options,
    precisionConfig: { surfaceNameTrend: true },
  },
});
check('getNameCandidateSummaries surfaces opt-in trend evidence',
  summaries[0]?.nameTrend?.givenHangul === '도윤' &&
    summaries[0]?.nameTrend?.eraFitScore === summaries[0]?.nameTrend?.trendFit);

engine.close();

console.log(`\nHangul name trend score: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
