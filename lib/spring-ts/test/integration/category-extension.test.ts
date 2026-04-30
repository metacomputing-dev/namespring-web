/**
 * test/integration/category-extension.test.ts
 *
 * Verifies PR12 category-card extension:
 *
 *   1. The legacy 5-category report shape is unchanged when no
 *      sub-domain builder runs.
 *   2. CategoryFortuneCard.subDomains stays absent (= undefined) by
 *      default — no behavior leakage from the new type surface.
 *   3. The exported FortuneCategoryExtended union is callable as a type
 *      annotation for downstream code that surfaces sub-domain rows.
 *
 * Run: npm run test:category
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
import type {
  FortuneCategory, FortuneCategoryExtended, CategoryFortuneSubDomain,
} from '../../src/report/types.js';

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const fortune = await engine.getFortuneReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
});

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

console.log('PR12 category extension\n');

// ── (1) Legacy 5-category shape ──────────────────────────────────────────
const expected: FortuneCategory[] = ['wealth', 'health', 'academic', 'romance', 'family'];
const actual = Object.keys(fortune.categoryFortunes) as FortuneCategory[];
check('5 legacy categories present',
  expected.every(c => actual.includes(c)) && actual.length === 5,
  actual.join(', '));

for (const cat of expected) {
  const card = fortune.categoryFortunes[cat];
  check(`${cat}: title + category + stars present`,
    typeof card.title === 'string' && card.title.length > 0
      && card.category === cat
      && typeof card.stars === 'number');
}

// ── (2) subDomains absent by default ────────────────────────────────────
for (const cat of expected) {
  const card = fortune.categoryFortunes[cat];
  check(`${cat}: subDomains is undefined (default behavior preserved)`,
    card.subDomains === undefined,
    'PR12 wire-up deferred to follow-up PR');
}

// ── (3) FortuneCategoryExtended union compile-time check ─────────────────
const extendedCategories: FortuneCategoryExtended[] = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
];
check('FortuneCategoryExtended accepts all 10 union members',
  extendedCategories.length === 10);

// ── (4) CategoryFortuneSubDomain shape ───────────────────────────────────
const sampleSubDomain: CategoryFortuneSubDomain = {
  name: 'study_document',
  title: '학업 / 문서',
  stars: 4,
  narrative: '인성이 강하게 작용하는 시기 — 자격증·시험 분야에서 좋은 흐름.',
};
check('CategoryFortuneSubDomain accepts a complete row',
  sampleSubDomain.name === 'study_document' && sampleSubDomain.stars === 4);

engine.close();

console.log(`\nCategory extension: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
