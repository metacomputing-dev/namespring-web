/**
 * test/integration/tiered-matrix-determinism.test.ts
 *
 * Same input → same matrix. Asserts that the fragment-selector's
 * `selectionSeed` produces stable picks across two independent calls
 * with identical (birth, targetDate). This is load-bearing: A/B
 * experiments and user-facing trust both depend on stable fragment IDs.
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
  if (cond) { pass += 1; console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`); }
  else { fail += 1; console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`); }
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Tiered matrix determinism — same input → same fragments\n');

const fixedTargetDate = '2026-05-02T00:00:00.000Z';
const request = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  targetDate: fixedTargetDate,
  options: { precisionConfig: { surfaceTieredMatrix: true } },
};

const a: any = await engine.getFortuneReport(request);
const b: any = await engine.getFortuneReport(request);

check('both calls produced a tieredMatrix', a?.tieredMatrix && b?.tieredMatrix);
check('selectionSeed equal across calls',
  a?.tieredMatrix?.meta?.selectionSeed === b?.tieredMatrix?.meta?.selectionSeed);

const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const CATEGORIES = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
] as const;

function plainOf(cell: any): string {
  return JSON.stringify({
    brief: cell?.brief?.headline ?? '',
    standardTokens: cell?.standard?.paragraphs?.map((p: any) => p.plainText) ?? [],
    expertTokens: cell?.expert?.paragraphs?.map((p: any) => p.plainText) ?? [],
  });
}

let cellsCompared = 0;
let cellMismatches = 0;
for (const period of PERIODS) {
  const pa = a.tieredMatrix.periods[period];
  const pb = b.tieredMatrix.periods[period];
  if (plainOf(pa.overall) !== plainOf(pb.overall)) cellMismatches += 1;
  cellsCompared += 1;
  for (const cat of CATEGORIES) {
    const cellA = pa.byCategory[cat];
    const cellB = pb.byCategory[cat];
    if (plainOf(cellA) !== plainOf(cellB)) cellMismatches += 1;
    cellsCompared += 1;
  }
}
check(`all ${cellsCompared} cells deterministic across calls`,
  cellMismatches === 0,
  cellMismatches === 0 ? `${cellsCompared} cells matched` : `${cellMismatches} mismatched`);

// Different targetDate must produce a different selectionSeed (sanity).
const c: any = await engine.getFortuneReport({
  ...request,
  targetDate: '2027-01-01T00:00:00.000Z',
});
check('different targetDate yields different selectionSeed',
  a.tieredMatrix.meta.selectionSeed !== c.tieredMatrix.meta.selectionSeed);

engine.close();
console.log(`\nTiered matrix determinism: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
