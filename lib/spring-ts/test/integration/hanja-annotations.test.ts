/**
 * test/integration/hanja-annotations.test.ts
 *
 * Verifies PR11 hanja-annotations module + opt-in flag declarations:
 *
 *   1. normalizeToOrthodoxHanja remains a search/deduplication helper
 *      and is identity for orthodox / unknown forms.
 *   2. getLegalAnnotation separates legalStatus buckets while preserving
 *      legacy boolean semantics.
 *   3. isHanjaUsableForLegalName applies one official raw-pair authority to
 *      both curated and full candidate pools.
 *   4. requireLegalRegistrable: true accepts only authority-pinned pairs.
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

// ── (1) Search/deduplication alias normalization ────────────────────────
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

// ── (2) Legal annotation — outside the seed list returns undefined ───────
//        (PR-I-1 ships with a 50-char seed; the full 9,389 import is later)
const dummyEntry = {
  id: 1, hangul: '최', hanja: '崔', onset: 'ㅊ', nucleus: 'ㅚ',
  strokes: 11, stroke_element: 'Earth', resource_element: 'Earth',
  meaning: '성씨 최', radical: '山', is_surname: true,
};
const annotation = getLegalAnnotation(dummyEntry);
check('getLegalAnnotation.legalStatus === hangulOnly for non-Han input',
  getLegalAnnotation({ ...dummyEntry, hanja: 'ㅁ' }).legalStatus === 'hangulOnly');
check('getLegalAnnotation.legalRegistrable === true (崔 official pair)',
  annotation.legalRegistrable === true);
check('getLegalAnnotation.legalStatus === allowed (崔 official pair)',
  annotation.legalStatus === 'allowed');
check('getLegalAnnotation.isVariantOf === undefined',
  annotation.isVariantOf === undefined);

// ── (2b) Legal annotation — inside the PR-I-1 seed returns true ──────────
const seedEntry = {
  id: 2, hangul: '가', hanja: '佳', onset: 'ㄱ', nucleus: 'ㅏ',
  strokes: 8, stroke_element: 'Earth', resource_element: 'Earth',
  meaning: '아름다울 가', radical: '人', is_surname: false,
};
const seedAnno = getLegalAnnotation(seedEntry);
check('getLegalAnnotation.legalRegistrable === true (佳 in PR-I-1 seed)',
  seedAnno.legalRegistrable === true);
check('getLegalAnnotation.legalStatus === allowed (佳 in PR-I-1 seed)',
  seedAnno.legalStatus === 'allowed');

// ── (2c) Legal annotation — variant resolves to its 정자 ────────────────
const variantEntry = {
  id: 3, hangul: '국', hanja: '国', onset: 'ㄱ', nucleus: 'ㅜ',
  strokes: 8, stroke_element: 'Wood', resource_element: 'Wood',
  meaning: '나라 국', radical: '囗', is_surname: false,
};
const variantAnno = getLegalAnnotation(variantEntry);
check('search aliases do not populate authority-only isVariantOf',
  variantAnno.isVariantOf === undefined);

const fullPoolAnno = getLegalAnnotation(dummyEntry, { pool: 'inmyeongyong_full' });
check('full pool: 崔 is allowed',
  fullPoolAnno.legalRegistrable === true && fullPoolAnno.legalStatus === 'allowed');
const fullPoolVariantAnno = getLegalAnnotation(variantEntry, { pool: 'inmyeongyong_full' });
check('full pool: official raw pair 国/국 is allowed',
  fullPoolVariantAnno.legalRegistrable === true
    && fullPoolVariantAnno.legalStatus === 'allowed'
    && fullPoolVariantAnno.isVariantOf === undefined);
const aliasOnlyEntry = {
  ...variantEntry,
  hangul: '삽',
  hanja: '挿',
};
const aliasOnlyAnno = getLegalAnnotation(aliasOnlyEntry, { pool: 'inmyeongyong_full' });
check('full pool: off-list search alias 挿 is notAllowed',
  normalizeToOrthodoxHanja(aliasOnlyEntry.hanja) === '插'
    && aliasOnlyAnno.legalRegistrable === false
    && aliasOnlyAnno.legalStatus === 'notAllowed');
check('full pool: listed glyph with an unlisted reading is notAllowed',
  getLegalAnnotation({ ...variantEntry, hangul: '삽', hanja: '國' }, {
    pool: 'inmyeongyong_full',
  }).legalStatus === 'notAllowed');
const notAllowedEntry = {
  id: 4, hangul: '답', hanja: '龘', onset: 'ㄷ', nucleus: 'ㅏ',
  strokes: 48, stroke_element: 'Water', resource_element: 'Water',
  meaning: '용이 가는 모양', radical: '龍', is_surname: false,
};
const notAllowedAnno = getLegalAnnotation(notAllowedEntry, { pool: 'inmyeongyong_full' });
check('full pool: non-list Hanja is notAllowed',
  notAllowedAnno.legalRegistrable === false && notAllowedAnno.legalStatus === 'notAllowed');

// ── (3) Default legal filtering uses official raw-pair authority ─────────
check('isHanjaUsableForLegalName(entry) default — accept official pair',
  isHanjaUsableForLegalName(dummyEntry) === true,
  'candidate pool and legal authority are separate');
check('isHanjaUsableForLegalName(seedEntry) default — accept known-true',
  isHanjaUsableForLegalName(seedEntry) === true);

// ── (4) requireLegalRegistrable accepts authority-pinned pairs ───────────
check('requireLegalRegistrable:true accepts 崔 (official pair)',
  isHanjaUsableForLegalName(dummyEntry, { requireLegalRegistrable: true }) === true);
check('requireLegalRegistrable:true accepts 佳 (in seed)',
  isHanjaUsableForLegalName(seedEntry, { requireLegalRegistrable: true }) === true);

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

// Explicit evaluate mode should still produce a valid finite score equal to
// baseline; PR-2.2 wires the full pool only into recommendation generation.
check('hanjaPool="inmyeongyong_full" returns finite score',
  Number.isFinite(hanjaPoolInmyeongyongFull.scores.total));
check('hanjaPool="inmyeongyong_full" ≡ baseline for explicit evaluate',
  hanjaPoolInmyeongyongFull.scores.total === baseline.scores.total,
  '명시 한자 평가는 후보 생성 풀 변경과 독립');
const fullPoolChars = [
  ...hanjaPoolInmyeongyongFull.name.surname,
  ...hanjaPoolInmyeongyongFull.name.givenName,
];
check('candidate CharDetail surfaces legalStatus for every char',
  fullPoolChars.every((char: any) => typeof char.legalStatus === 'string'),
  fullPoolChars.map((char: any) => `${char.hanja}:${char.legalStatus}`).join(', '));
check('inmyeongyong_full candidate chars are allowed',
  fullPoolChars.every((char: any) => char.legalStatus === 'allowed'));

check('pureHangulSchema="classic_phonetic" ≡ baseline (default)',
  pureHangulClassic.scores.total === baseline.scores.total);
check('pureHangulSchema="modern_korean" ≡ baseline (declared, not wired yet)',
  pureHangulModern.scores.total === baseline.scores.total);

engine.close();

console.log(`\nHanja annotations: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
