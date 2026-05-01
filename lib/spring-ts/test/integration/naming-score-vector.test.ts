/**
 * test/integration/naming-score-vector.test.ts
 *
 * Verifies PR-6.1 display-only naming score vectors.
 *
 * Run: npm run test:naming-score-vector
 * Update snapshot: npx tsx test/integration/naming-score-vector.test.ts --update
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine, type NamingScoreVector } from '../../src/index.js';
import { buildNameCompatibilityCard } from '../../src/report/cards/name-compatibility-card.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/naming_score_vector_snapshot.json');
const UPDATE = process.argv.includes('--update');

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

function roundStable(value: number | null): number | null {
  return value == null ? null : Math.round(value * 1_000_000) / 1_000_000;
}

function stableVector(vector: NamingScoreVector | undefined): Record<keyof NamingScoreVector, number | null> | null {
  if (!vector) return null;
  return {
    legal: roundStable(vector.legal),
    sajuFit: roundStable(vector.sajuFit),
    yongshinFit: roundStable(vector.yongshinFit),
    elementBalance: roundStable(vector.elementBalance),
    hanjaMeaning: roundStable(vector.hanjaMeaning),
    phonetic: roundStable(vector.phonetic),
    eraFit: roundStable(vector.eraFit),
    familyFit: roundStable(vector.familyFit),
    risk: roundStable(vector.risk),
  };
}

function normalizeJson(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

console.log('PR-6.1 naming score vector\n');

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  repo.wasmUrl = WASM_PATH;
}
await engine.init();

const hanjaRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
  givenName: [{ hangul: '\uC131', hanja: '\u6210' }, { hangul: '\uC218', hanja: '\u79C0' }],
  mode: 'evaluate' as const,
};

const pureHangulRequest = {
  birth: { year: 2024, month: 3, day: 1, hour: 9, minute: 0, gender: 'male' as const },
  surname: [{ hangul: '\uBC15' }],
  givenName: [{ hangul: '\uBBFC' }, { hangul: '\uC900' }],
  mode: 'evaluate' as const,
  options: { pureHangulNameMode: 'on' as const },
};

const vectorOptions = {
  precisionConfig: {
    surfaceNamingScoreVector: true,
    surfaceNameTrend: true,
    surfacePhoneticEvidence: true,
  },
};

const defaultReport = await engine.getSpringReport(hanjaRequest);
const vectorReport = await engine.getSpringReport({
  ...hanjaRequest,
  options: vectorOptions,
});
const pureVectorReport = await engine.getSpringReport({
  ...pureHangulRequest,
  options: {
    ...pureHangulRequest.options,
    ...vectorOptions,
  },
});
const namingReport = await engine.getNamingReport({
  ...hanjaRequest,
  options: vectorOptions,
});
const card = buildNameCompatibilityCard(vectorReport);
const vectorRow = card?.evidence?.find((row) => row.axis === 'namingScoreVector');
const analyzeResponse = await engine.analyze({
  ...hanjaRequest,
  options: vectorOptions,
});

(engine as any).getNameStatInfo = async () => ({
  exists: true,
  popularityRank: 1,
  maleRatio: 1,
  nameGender: 'male',
});
const summaries = await engine.getNameCandidateSummaries({
  ...hanjaRequest,
  options: vectorOptions,
});

check('default report omits scoreVector',
  defaultReport.scoreVector === undefined &&
    defaultReport.strengthProfile === undefined &&
    defaultReport.namingReport.scoreVector === undefined);
check('score vector does not change final score',
  defaultReport.finalScore === vectorReport.finalScore,
  `${defaultReport.finalScore}=${vectorReport.finalScore}`);
check('SpringReport exposes all requested vector axes',
  vectorReport.scoreVector != null &&
    Object.keys(vectorReport.scoreVector).sort().join(',') ===
      'elementBalance,eraFit,familyFit,hanjaMeaning,legal,phonetic,risk,sajuFit,yongshinFit');
check('NamingReport exposes pure-name vector with null saju axes',
  namingReport.scoreVector?.sajuFit === null &&
    namingReport.scoreVector?.yongshinFit === null &&
    namingReport.scoreVector?.hanjaMeaning === 100);
check('pure Hangul vector keeps hanjaMeaning inapplicable',
  pureVectorReport.scoreVector?.hanjaMeaning === null &&
    pureVectorReport.scoreVector?.phonetic !== null);
check('NameCompatibilityCard forwards scoreVector and evidence row',
  card?.scoreVector?.risk === vectorReport.scoreVector?.risk &&
    vectorRow?.supportingFeatures.some((feature) => feature.startsWith('legal ')) === true &&
    card?.strengthProfile?.id === vectorReport.strengthProfile?.id);
check('legacy analyze candidate exposes scoreVector',
  analyzeResponse.candidates[0]?.scoreVector?.legal === vectorReport.scoreVector?.legal);
check('candidate summaries expose scoreVector',
  summaries[0]?.scoreVector?.risk === vectorReport.scoreVector?.risk &&
    summaries[0]?.strengthProfile?.id === vectorReport.strengthProfile?.id);

const snapshot = [
  {
    id: 'choi_sungsu_hanja',
    fullHangul: vectorReport.namingReport.name.fullHangul,
    fullHanja: vectorReport.namingReport.name.fullHanja,
    scores: {
      final: roundStable(vectorReport.finalScore),
      naming: roundStable(vectorReport.namingReport.totalScore),
      saju: roundStable(vectorReport.sajuCompatibility.affinityScore),
    },
    scoreVector: stableVector(vectorReport.scoreVector),
    namingScoreVector: stableVector(vectorReport.namingReport.scoreVector),
  },
  {
    id: 'park_minjun_pure_hangul',
    fullHangul: pureVectorReport.namingReport.name.fullHangul,
    fullHanja: pureVectorReport.namingReport.name.fullHanja,
    scores: {
      final: roundStable(pureVectorReport.finalScore),
      naming: roundStable(pureVectorReport.namingReport.totalScore),
      saju: roundStable(pureVectorReport.sajuCompatibility.affinityScore),
    },
    scoreVector: stableVector(pureVectorReport.scoreVector),
    namingScoreVector: stableVector(pureVectorReport.namingReport.scoreVector),
  },
];

const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
if (UPDATE) {
  fs.writeFileSync(SNAPSHOT_PATH, serialized);
  console.log(`  UPDATED ${path.relative(SPRING_TS_ROOT, SNAPSHOT_PATH)}`);
} else {
  const expected = normalizeJson(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  check('naming score vector snapshot matches',
    normalizeJson(serialized) === expected,
    UPDATE ? 'updated' : path.relative(SPRING_TS_ROOT, SNAPSHOT_PATH));
}

engine.close();

console.log(`\nNaming score vector: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
