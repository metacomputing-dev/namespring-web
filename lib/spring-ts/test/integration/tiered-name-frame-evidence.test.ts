/**
 * test/integration/tiered-name-frame-evidence.test.ts
 *
 * Guards the optional seed-ts four-frame naming evidence attached to
 * `FortuneReport.tieredMatrix`. The field is present only when the tiered
 * matrix is opt-in and a concrete name was evaluated.
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

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Tiered matrix naming evidence\n');

const baseRequest = {
  birth: {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    gender: 'male' as const,
    calendarType: 'solar' as const,
    timezone: 'Asia/Seoul',
    region: 'Seoul',
  },
  options: {
    sajuTimePolicy: { trueSolarTime: 'on' as const, longitudeCorrection: 'on' as const, yaza: 'on' as const },
    precisionConfig: { surfaceTieredMatrix: true },
  },
};

const namedReport: any = await engine.getFortuneReport({
  ...baseRequest,
  surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
  givenName: [{ hangul: '\uC131', hanja: '\u6210' }, { hangul: '\uC218', hanja: '\u79C0' }],
});

const namedEvidence = namedReport?.tieredMatrix?.namingEvidence;
const stages = new Set((namedEvidence?.frames ?? []).map((frame: any) => frame.stage));
const labels = new Set((namedEvidence?.frames ?? []).map((frame: any) => frame.label));

check('namingEvidence surfaces for named opt-in report', namedEvidence != null);
check('namingEvidence source is stable',
  namedEvidence?.source === 'spring-ts.namingReport.analysis.fourFrame',
  String(namedEvidence?.source));
check('four frame scores are numeric',
  typeof namedEvidence?.fourFrameScore === 'number' &&
    typeof namedEvidence?.luckScore === 'number' &&
    typeof namedEvidence?.elementScore === 'number',
  `${namedEvidence?.fourFrameScore}/${namedEvidence?.luckScore}/${namedEvidence?.elementScore}`);
check('four seed-ts frames are attached', namedEvidence?.frames?.length === 4, String(namedEvidence?.frames?.length));
check('life-stage mapping includes early/youth/middle/late-total',
  ['earlyLife', 'youthLife', 'middleLife', 'lateAndTotal'].every((stage) => stages.has(stage)),
  Array.from(stages).join(','));
check('Korean life-stage labels are attached',
  ['\uCD08\uB144\uC6B4', '\uCCAD\uB144\uC6B4', '\uC911\uB144\uC6B4', '\uB9D0\uB144/\uCD1D\uC6B4']
    .every((label) => labels.has(label)),
  Array.from(labels).join(','));
check('each frame carries seed-ts evidence fields',
  namedEvidence?.frames?.every((frame: any) =>
    frame.source === 'seed-ts.fourframe' &&
    typeof frame.strokeSum === 'number' &&
    typeof frame.luckyLevel === 'number' &&
    typeof frame.element === 'string' &&
    typeof frame.polarity === 'string'));
check('at least one frame includes authored meaning text',
  namedEvidence?.frames?.some((frame: any) =>
    typeof frame.title === 'string' || typeof frame.summary === 'string'));

const unnamedReport: any = await engine.getFortuneReport(baseRequest);
check('namingEvidence stays absent without a concrete name',
  unnamedReport?.tieredMatrix?.namingEvidence === undefined,
  typeof unnamedReport?.tieredMatrix?.namingEvidence);

console.log(`\nTiered naming evidence check: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
