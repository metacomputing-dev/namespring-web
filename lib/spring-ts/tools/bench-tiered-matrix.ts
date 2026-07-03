/**
 * bench-tiered-matrix.ts -- Wall-clock budget check for the paid report path
 *
 * Regression context: the fragment-era pipeline spent 29-35s per
 * getFortuneReport call (76% inside a ~700-regex normalize pass). The
 * article engine's budget, measured 2026-07-03 on the rewrite branch:
 *   - cold call (incl. saju calc + registries): < 5s
 *   - warm call (matrix rebuild only):          < 300ms
 *
 * Run: npx tsx tools/bench-tiered-matrix.ts
 * Exits non-zero when either budget is exceeded.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const COLD_BUDGET_MS = 5000;
const WARM_BUDGET_MS = 300;

const originalFetch = globalThis.fetch;
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: unknown, options?: unknown) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/')) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url as never, options as never);
}) as typeof fetch;

const { SpringEngine } = await import('../src/index.js');

const engine = new SpringEngine() as InstanceType<typeof SpringEngine> & {
  hanjaRepo?: { wasmUrl?: string };
  fourFrameRepo?: { wasmUrl?: string };
};
for (const repo of [engine.hanjaRepo, engine.fourFrameRepo]) {
  if (repo) repo.wasmUrl = WASM_PATH;
}
await engine.init();

const request = {
  birth: { year: 1994, month: 9, day: 16, hour: 0, minute: 35, gender: 'female' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '하', hanja: '夏' }, { hangul: '윤', hanja: '潤' }],
  targetDate: '2026-05-01T00:00:00+09:00',
  options: { precisionConfig: { surfaceTieredMatrix: true } },
};

const t0 = performance.now();
const report = await engine.getFortuneReport(request as never) as { tieredMatrix?: { meta?: { fragmentCount?: number } } };
const cold = performance.now() - t0;

const warmRuns: number[] = [];
for (let i = 0; i < 3; i += 1) {
  const a = performance.now();
  await engine.getFortuneReport(request as never);
  warmRuns.push(performance.now() - a);
}
const warm = Math.min(...warmRuns);

console.log(`cold: ${cold.toFixed(0)}ms (budget ${COLD_BUDGET_MS}ms)`);
console.log(`warm: ${warm.toFixed(0)}ms (budget ${WARM_BUDGET_MS}ms)`);
console.log(`articles loaded: ${report.tieredMatrix?.meta?.fragmentCount ?? 0}`);

const coldOk = cold <= COLD_BUDGET_MS;
const warmOk = warm <= WARM_BUDGET_MS;
console.log(coldOk && warmOk ? 'BENCH PASS' : 'BENCH FAIL');
process.exit(coldOk && warmOk ? 0 : 1);
