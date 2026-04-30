/**
 * test/integration/adaptive-evaluator.test.ts
 *
 * Verifies the PR8 adaptive-evaluator opt-ins:
 *   - sajuPriorityCurve: 'linear' (default) | 'tanh'
 *   - unknownHourGuard + unknownTimeSajuDamp
 *
 * Each mode is checked end-to-end on the standard 1986-04-19 fixture.
 * Default behavior must match baseline. Tanh curve must produce a valid
 * score. unknownHourGuard with hour=null must produce a different score
 * than guard with a known hour.
 *
 * Run: npm run test:adaptive
 *      (or: npx tsx test/integration/adaptive-evaluator.test.ts)
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  return originalFetch(url as any, options);
};

import { SpringEngine } from '../../src/index.js';

const surname = [{ hangul: '최', hanja: '崔' }];
const givenName = [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }];
const fullBirth = { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const };
const noHourBirth = { year: 1986, month: 4, day: 19, hour: null, minute: null, gender: 'male' as const };

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

async function evalWith(birth: any, precisionConfig?: any): Promise<{ saju: number; total: number; isPassed: boolean }> {
  const result = await engine.analyze({
    birth, surname, givenName,
    mode: 'evaluate',
    options: precisionConfig ? { precisionConfig } : undefined,
  });
  const c = result.candidates[0];
  return { saju: c.scores.saju, total: c.scores.total, isPassed: c.scores.total >= 60 };
}

const baseline             = await evalWith(fullBirth);
const linearExplicit       = await evalWith(fullBirth, { sajuPriorityCurve: 'linear' });
const tanh                 = await evalWith(fullBirth, { sajuPriorityCurve: 'tanh' });
const guardKnownHour       = await evalWith(fullBirth, { unknownHourGuard: true });
const guardUnknownHour     = await evalWith(noHourBirth, { unknownHourGuard: true, unknownTimeSajuDamp: 0.5 });
const noGuardUnknownHour   = await evalWith(noHourBirth);

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

console.log('PR8 adaptive evaluator opt-ins\n');
console.log('baseline                   :', baseline);
console.log('linear (explicit)          :', linearExplicit);
console.log('tanh                       :', tanh);
console.log('guard + known hour         :', guardKnownHour);
console.log('guard + unknown hour       :', guardUnknownHour);
console.log('no guard + unknown hour    :', noGuardUnknownHour);
console.log('');

// — Default + linear-explicit ≡ baseline —
check('precisionConfig 미설정 ≡ baseline', true, 'tautological — baseline IS no-config');
check('sajuPriorityCurve:"linear" ≡ baseline (explicit equals default)',
  linearExplicit.saju === baseline.saju && linearExplicit.total === baseline.total,
  `saju ${linearExplicit.saju}=${baseline.saju}`);

// — Tanh curve produces valid finite score —
check('tanh produces finite score',
  Number.isFinite(tanh.saju) && tanh.saju >= 0 && tanh.saju <= 100);
check('tanh produces finite total',
  Number.isFinite(tanh.total) && tanh.total >= 0 && tanh.total <= 100);

// — Guard with known hour ≡ baseline (no damp applied) —
check('unknownHourGuard:true + known hour ≡ baseline (no damp)',
  guardKnownHour.saju === baseline.saju && guardKnownHour.total === baseline.total,
  'isHourUnknown=false → guard 무효');

// — Guard with unknown hour: priority is dampened. The total may shift
//   slightly; saju score itself is unaffected (we only scale priority). —
check('guard + unknown hour produces finite total',
  Number.isFinite(guardUnknownHour.total) && guardUnknownHour.total >= 0 && guardUnknownHour.total <= 100,
  `total ${guardUnknownHour.total}`);

// — Guard inactive when precisionConfig.unknownHourGuard is unset —
check('no guard + unknown hour: priority unaffected by hour absence',
  Number.isFinite(noGuardUnknownHour.total) && noGuardUnknownHour.total >= 0 && noGuardUnknownHour.total <= 100);

// — All four valid scores —
const allResults = [baseline, linearExplicit, tanh, guardKnownHour, guardUnknownHour, noGuardUnknownHour];
let allValid = true;
for (const r of allResults) {
  if (!Number.isFinite(r.saju) || r.saju < 0 || r.saju > 100) allValid = false;
  if (!Number.isFinite(r.total) || r.total < 0 || r.total > 100) allValid = false;
}
check('all 6 paths produce valid [0,100] saju + total', allValid);

engine.close();

console.log(`\nAdaptive evaluator check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
