/**
 * test/integration/hanja-annotations.test.ts
 *
 * Verifies PR11 hanja-annotations module + opt-in flag declarations:
 *
 *   1. normalizeToOrthodoxHanja maps 약자 → 정자 for the seeded list
 *      and is identity for orthodox / unknown forms.
 *   2. getLegalAnnotation returns { undefined, undefined } today
 *      (= status unknown until the 9,389-character data fixture imports).
 *   3. isHanjaUsableForLegalName defaults to "accept unknown" so the
 *      existing curated pool keeps flowing through unchanged.
 *   4. requireLegalRegistrable: true tightens the filter to "must be
 *      explicitly true" (rejects unknown).
 *   5. precisionConfig.hanjaPool / pureHangulSchema declarations are
 *      callable end-to-end without breaking baseline.
 *
 * Run: npm run test:hanja
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

import {
  normalizeToOrthodoxHanja,
  getLegalAnnotation,
  isHanjaUsableForLegalName,
} from '../../src/hanja-annotations.js';
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

console.log('PR11 hanja-annotations + opt-in flag declarations\n');

// ── (1) 異體字 normalization ─────────────────────────────────────────────
check('normalizeToOrthodoxHanja: 国 → 國',
  normalizeToOrthodoxHanja('国') === '國',
  '약자 → 정자');
check('normalizeToOrthodoxHanja: 会 → 會',
  normalizeToOrthodoxHanja('会') === '會');
check('normalizeToOrthodoxHanja: 崔 → 崔 (orthodox already)',
  normalizeToOrthodoxHanja('崔') === '崔',
  '정자 identity');
check('normalizeToOrthodoxHanja: ㅁ → ㅁ (unknown identity)',
  normalizeToOrthodoxHanja('ㅁ') === 'ㅁ');

// ── (2) Legal annotation (still undefined until data import) ─────────────
const dummyEntry = {
  id: 1, hangul: '최', hanja: '崔', onset: 'ㅊ', nucleus: 'ㅚ',
  strokes: 11, stroke_element: 'Earth', resource_element: 'Earth',
  meaning: '성씨 최', radical: '山', is_surname: true,
};
const annotation = getLegalAnnotation(dummyEntry);
check('getLegalAnnotation.legalRegistrable === undefined (data not imported)',
  annotation.legalRegistrable === undefined);
check('getLegalAnnotation.isVariantOf === undefined',
  annotation.isVariantOf === undefined);

// ── (3) Default isHanjaUsableForLegalName: accept unknown ────────────────
check('isHanjaUsableForLegalName(entry) default — accept unknown',
  isHanjaUsableForLegalName(dummyEntry) === true,
  'curated pool 보존');

// ── (4) requireLegalRegistrable: true rejects unknown ────────────────────
check('requireLegalRegistrable:true rejects unknown',
  isHanjaUsableForLegalName(dummyEntry, { requireLegalRegistrable: true }) === false,
  '데이터 import 전 strict mode 동작');

// ── (5) End-to-end: declared flags do not break baseline ─────────────────
const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

async function evalWith(precisionConfig?: any) {
  const result = await engine.analyze({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    mode: 'evaluate',
    options: precisionConfig ? { precisionConfig } : undefined,
  });
  return result.candidates[0];
}

const baseline                = await evalWith();
const hanjaPoolCurated         = await evalWith({ hanjaPool: 'curated' });
const hanjaPoolInmyeongyongFull = await evalWith({ hanjaPool: 'inmyeongyong_full' });
const pureHangulClassic        = await evalWith({ pureHangulSchema: 'classic_phonetic' });
const pureHangulModern         = await evalWith({ pureHangulSchema: 'modern_korean' });

check('hanjaPool="curated" ≡ baseline (default)',
  hanjaPoolCurated.scores.total === baseline.scores.total,
  `${hanjaPoolCurated.scores.total}=${baseline.scores.total}`);

// inmyeongyong_full not yet wired to candidate generator; should still
// produce a valid finite score equal to baseline (no behavior change).
check('hanjaPool="inmyeongyong_full" returns finite score',
  Number.isFinite(hanjaPoolInmyeongyongFull.scores.total));
check('hanjaPool="inmyeongyong_full" ≡ baseline (declared, not wired yet)',
  hanjaPoolInmyeongyongFull.scores.total === baseline.scores.total,
  'data fixture 도입 전까지 동작 동일');

check('pureHangulSchema="classic_phonetic" ≡ baseline (default)',
  pureHangulClassic.scores.total === baseline.scores.total);
check('pureHangulSchema="modern_korean" ≡ baseline (declared, not wired yet)',
  pureHangulModern.scores.total === baseline.scores.total);

engine.close();

console.log(`\nHanja annotations: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
