/**
 * artifacts/phase3-agent-a8/generate-expression-children-sample.ts
 *
 * Regression sample generator for Phase 3 Agent A8 (expression_children polish).
 * Reproduces the 1986-04-19 male choi-seongsoo fixture and writes the
 * `tieredMatrix.periods.<period>.byCategory.expression_children` cell to a
 * caller-specified JSON file (after-sample.json or before-sample.json).
 *
 * Run via:
 *   npx tsx artifacts/phase3-agent-a8/generate-expression-children-sample.ts <output-file>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../../src/index.js';

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
  if (originalFetch) return originalFetch(url, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

const TARGET_DATE = '2026-05-04T00:00:00+09:00';
const outputArg = process.argv[2] ?? path.join(__dirname, 'after-sample.json');
const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(__dirname, outputArg);

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo].filter(Boolean);
for (const repo of repos) (repo as any).wasmUrl = WASM_PATH;
await engine.init();

const request = {
  targetDate: TARGET_DATE,
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const, calendarType: 'solar' as const, region: '서울', birthPlace: '서울' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  options: {
    sajuTimePolicy: { yaza: 'on' as const, yazaMode: '23:00' as const, trueSolarTime: 'on' as const, longitudeCorrection: 'on' as const },
    precisionConfig: { surfaceTieredMatrix: true },
  },
};

const fr: any = await engine.getFortuneReport(request);
const periods = fr?.tieredMatrix?.periods ?? {};
const out: Record<string, any> = {
  generatedAt: new Date().toISOString(),
  fixture: '1986-04-19 male choi-seongsoo (Seoul)',
  scope: 'tieredMatrix.periods.<period>.byCategory.expression_children',
  cells: {} as Record<string, any>,
};

function findExpressionChildren(node: any): any {
  if (!node || typeof node !== 'object') return null;
  if (node.byCategory?.expression_children) return node.byCategory.expression_children;
  if (node.expression_children) return node.expression_children;
  return null;
}

for (const period of ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear']) {
  out.cells[period] = findExpressionChildren(periods?.[period]);
}
fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
console.log(`Saved sample to ${outputPath}`);
engine.close();
