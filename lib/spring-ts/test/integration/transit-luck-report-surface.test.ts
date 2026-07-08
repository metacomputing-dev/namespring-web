/**
 * transit-luck-report-surface.test.ts
 *
 * PR-8 follow-up: fortune cards consume the transit luck metadata surfaced by
 * saju-ts/springLegacy without changing frontend code or star scoring.
 */
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
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

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

function evidenceFeatures(card: any): string[] {
  return (card?.evidence ?? []).flatMap((row: any) =>
    Array.isArray(row?.supportingFeatures) ? row.supportingFeatures.map(String) : [],
  );
}

console.log('PR-8 transit luck report surface\n');

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

const report: any = await engine.getFortuneReport({
  targetDate: '2025-05-04T00:00:00+09:00',
  birth: {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    gender: 'male',
    calendarType: 'solar',
    region: '서울',
    birthPlace: '서울',
  },
  surname: [{ hangul: '최', hanja: '崔' }],
});

const yearlyFeatures = evidenceFeatures(report.yearlyFortune);
const monthlyFeatures = evidenceFeatures(report.monthlyFortune);
const lifeStageFeatures = evidenceFeatures(report.lifeStageFortune);
const lifeStageHighlights = (report.lifeStageFortune?.stages ?? []).flatMap((stage: any) =>
  Array.isArray(stage?.highlights) ? stage.highlights.map(String) : [],
);

check('yearly fortune keeps target calendar label',
  report.yearlyFortune?.periodLabel === '2025년',
  String(report.yearlyFortune?.periodLabel));
check('yearly fortune evidence includes transit ten-god',
  yearlyFeatures.some((feature) => feature.startsWith('운 십성:')),
  JSON.stringify(yearlyFeatures));
check('yearly fortune evidence includes transit life stage',
  yearlyFeatures.some((feature) => feature.startsWith('12운성:')),
  JSON.stringify(yearlyFeatures));
check('yearly fortune evidence includes twelve-sal',
  yearlyFeatures.some((feature) => feature.startsWith('12신살:')),
  JSON.stringify(yearlyFeatures));
check('yearly fortune evidence includes natal relation',
  yearlyFeatures.some((feature) => feature.startsWith('원국 지지 관계:') || feature.startsWith('원국 천간 관계:')),
  JSON.stringify(yearlyFeatures));
check('yearly fortune evidence includes decade-year relation',
  yearlyFeatures.some((feature) => feature.startsWith('대운-세운 지지 관계:') || feature.startsWith('대운-세운 천간 관계:')),
  JSON.stringify(yearlyFeatures));
check('monthly fortune evidence includes wolun ten-god',
  monthlyFeatures.some((feature) => feature.startsWith('운 십성:')),
  JSON.stringify(monthlyFeatures));
check('monthly fortune evidence includes wolun life stage',
  monthlyFeatures.some((feature) => feature.startsWith('12운성:')),
  JSON.stringify(monthlyFeatures));
check('monthly fortune evidence includes natal relation',
  monthlyFeatures.some((feature) => feature.startsWith('원국 지지 관계:') || feature.startsWith('원국 천간 관계:')),
  JSON.stringify(monthlyFeatures));
check('life-stage evidence includes daewoon annotations',
  lifeStageFeatures.some((feature) => feature.startsWith('운 십성:')) &&
    lifeStageFeatures.some((feature) => feature.startsWith('12운성:')),
  JSON.stringify(lifeStageFeatures));
check('life-stage highlights include annotation guidance',
  lifeStageHighlights.some((line) => line.includes('12운성은') || line.includes('이 운의 십성은')),
  JSON.stringify(lifeStageHighlights.slice(0, 8)));
const allTransitFeatures = [...yearlyFeatures, ...monthlyFeatures, ...lifeStageFeatures];
check('transit shinsal labels are human-readable',
  !allTransitFeatures.some((feature) => /12신살: [A-Z_]+$/.test(feature)),
  JSON.stringify(allTransitFeatures));
check('transit metadata does not leak object stringification',
  !JSON.stringify(report).includes('[object Object]'));

engine.close();

console.log(`\nTransit luck report surface: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
