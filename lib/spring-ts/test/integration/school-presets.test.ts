/**
 * test/integration/school-presets.test.ts
 *
 * Verifies the schoolPreset infrastructure end-to-end:
 *
 *   1. precisionConfig unset            (legacy path)            — baseline
 *   2. useSchoolPreset:true, korean     (preset, zero-op)        ≡ baseline
 *   3. useSchoolPreset:true, chinese    (격국 우선)              ≠ baseline
 *   4. useSchoolPreset:true, modern     (조후 강조)              ≠ baseline
 *   5. useSchoolPreset:false, chinese   (preset must be opt-in)  ≡ baseline
 *
 * Run: npm run test:presets
 *      (or: npx tsx test/integration/school-presets.test.ts)
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

const birth = { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const };
const surname = [{ hangul: '최', hanja: '崔' }];
const givenName = [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }];

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

async function evaluateWith(options: any): Promise<{ saju: number; total: number }> {
  const result = await engine.analyze({ birth, surname, givenName, mode: 'evaluate', options });
  const c = result.candidates[0];
  return { saju: c.scores.saju, total: c.scores.total };
}

const baseline      = await evaluateWith(undefined);                                           // default
const korean        = await evaluateWith({ precisionConfig: { useSchoolPreset: true }, schoolPreset: 'korean' });
const chinese       = await evaluateWith({ precisionConfig: { useSchoolPreset: true }, schoolPreset: 'chinese' });
const modern        = await evaluateWith({ precisionConfig: { useSchoolPreset: true }, schoolPreset: 'modern' });
const chineseOptOff = await evaluateWith({ precisionConfig: { useSchoolPreset: false }, schoolPreset: 'chinese' });

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

console.log('SchoolPreset routing — single fixture (1986-04-19 m, 최성수)\n');

console.log('Baseline   :', baseline);
console.log('Korean     :', korean);
console.log('Chinese    :', chinese);
console.log('Modern     :', modern);
console.log('Chinese off:', chineseOptOff);
console.log('');

check(
  'korean preset is zero-op (≡ baseline)',
  korean.saju === baseline.saju && korean.total === baseline.total,
  `saju ${korean.saju}=${baseline.saju}, total ${korean.total}=${baseline.total}`,
);

check(
  'chinese preset diverges from baseline',
  chinese.saju !== baseline.saju || chinese.total !== baseline.total,
  `saju Δ=${(chinese.saju - baseline.saju).toFixed(2)}, total Δ=${(chinese.total - baseline.total).toFixed(2)}`,
);

check(
  'modern preset diverges from baseline',
  modern.saju !== baseline.saju || modern.total !== baseline.total,
  `saju Δ=${(modern.saju - baseline.saju).toFixed(2)}, total Δ=${(modern.total - baseline.total).toFixed(2)}`,
);

check(
  'chinese with useSchoolPreset:false is opt-in-gated (≡ baseline)',
  chineseOptOff.saju === baseline.saju && chineseOptOff.total === baseline.total,
  'preset only effective when useSchoolPreset:true',
);

check(
  'chinese ≠ modern (different schools produce different scores)',
  chinese.saju !== modern.saju || chinese.total !== modern.total,
  'school presets are not aliases',
);

engine.close();

console.log(`\nSchoolPreset check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
