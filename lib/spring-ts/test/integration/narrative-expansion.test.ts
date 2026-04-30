/**
 * test/integration/narrative-expansion.test.ts
 *
 * Verifies PR10 narrative-expansion modes on OverviewSummaryCard:
 *
 *   1. narrativeStyle missing       → no variant texts populated
 *   2. narrativeStyle='plain'       → plainText populated, expert/counselor not
 *   3. narrativeStyle='expert'      → expertText populated, others not
 *   4. narrativeStyle='counselor'   → counselorText populated, others not
 *   5. narrativeStyle='sideBySide'  → expertText + plainText both populated
 *   6. counterexamples              → present iff yongshin is candidate/deferred
 *
 * Run: npm run test:narrative-expansion
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

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
};

async function fortuneWith(narrativeStyle?: 'expert' | 'plain' | 'counselor' | 'sideBySide') {
  return engine.getFortuneReport({
    ...baseRequest,
    options: narrativeStyle ? { precisionConfig: { narrativeStyle } } : undefined,
  });
}

const noStyle    = await fortuneWith();
const plain      = await fortuneWith('plain');
const expert     = await fortuneWith('expert');
const counselor  = await fortuneWith('counselor');
const sideBySide = await fortuneWith('sideBySide');

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

console.log('PR10 narrative expansion — OverviewSummaryCard variants\n');
console.log('noStyle    text fields :', { expert: !!noStyle.overviewSummary.expertText, plain: !!noStyle.overviewSummary.plainText, counselor: !!noStyle.overviewSummary.counselorText });
console.log('plain      text fields :', { expert: !!plain.overviewSummary.expertText, plain: !!plain.overviewSummary.plainText, counselor: !!plain.overviewSummary.counselorText });
console.log('expert     text fields :', { expert: !!expert.overviewSummary.expertText, plain: !!expert.overviewSummary.plainText, counselor: !!expert.overviewSummary.counselorText });
console.log('counselor  text fields :', { expert: !!counselor.overviewSummary.expertText, plain: !!counselor.overviewSummary.plainText, counselor: !!counselor.overviewSummary.counselorText });
console.log('sideBySide text fields :', { expert: !!sideBySide.overviewSummary.expertText, plain: !!sideBySide.overviewSummary.plainText, counselor: !!sideBySide.overviewSummary.counselorText });
console.log('expert sample          :', expert.overviewSummary.expertText);
console.log('counselor sample       :', counselor.overviewSummary.counselorText);
console.log('counterexamples        :', noStyle.overviewSummary.counterexamples?.length ?? 0, 'rows');
console.log('');

// (1) narrativeStyle missing — no variant texts
check('noStyle: expertText undefined',     noStyle.overviewSummary.expertText    === undefined);
check('noStyle: plainText undefined',      noStyle.overviewSummary.plainText     === undefined);
check('noStyle: counselorText undefined',  noStyle.overviewSummary.counselorText === undefined);

// (2) plain
check('plain: plainText populated',        typeof plain.overviewSummary.plainText === 'string' && plain.overviewSummary.plainText!.length > 0);
check('plain: expertText absent',          plain.overviewSummary.expertText    === undefined);
check('plain: counselorText absent',       plain.overviewSummary.counselorText === undefined);

// (3) expert
check('expert: expertText populated',      typeof expert.overviewSummary.expertText === 'string' && expert.overviewSummary.expertText!.length > 0);
check('expert: contains 일간 keyword',     (expert.overviewSummary.expertText ?? '').includes('일간'));
check('expert: plainText absent',          expert.overviewSummary.plainText     === undefined);
check('expert: counselorText absent',      expert.overviewSummary.counselorText === undefined);

// (4) counselor
check('counselor: counselorText populated', typeof counselor.overviewSummary.counselorText === 'string' && counselor.overviewSummary.counselorText!.length > 0);
check('counselor: expertText absent',       counselor.overviewSummary.expertText === undefined);
check('counselor: plainText absent',        counselor.overviewSummary.plainText  === undefined);

// (5) sideBySide
check('sideBySide: both expert + plain populated',
  typeof sideBySide.overviewSummary.expertText === 'string' && sideBySide.overviewSummary.expertText!.length > 0
  && typeof sideBySide.overviewSummary.plainText === 'string' && sideBySide.overviewSummary.plainText!.length > 0);
check('sideBySide: counselorText absent', sideBySide.overviewSummary.counselorText === undefined);

// (6) Counterexamples — current fixture (1986-04-19) has yongshin=deferred, so
//     counterexamples MUST be present.
const cxs = noStyle.overviewSummary.counterexamples;
check('counterexamples surfaced for low-confidence yongshin',
  Array.isArray(cxs) && cxs.length >= 2,
  `${cxs?.length ?? 0} rows`);
if (Array.isArray(cxs)) {
  check('every counterexample row has condition + revisedClaim',
    cxs.every(r =>
      typeof r.condition === 'string' && r.condition.length > 0
      && typeof r.revisedClaim === 'string' && r.revisedClaim.length > 0));
}

engine.close();

console.log(`\nNarrative expansion: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
