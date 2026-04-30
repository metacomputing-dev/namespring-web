/**
 * test/integration/adapter-daewoon.test.ts
 *
 * PR-H-D — verifies the saju-adapter surfaces daeunInfo and saeunPillars
 * through SajuOutputSummary.
 *
 *   1. buildSajuContext lifts daeunInfo when source has the structure.
 *   2. buildSajuContext lifts saeunPillars when source has rows.
 *   3. Empty / null sources coerce to undefined.
 *   4. Pre-existing PR-H-A/B surfaces unaffected.
 *
 * Run: npm run test:adapter-daewoon
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

import { buildSajuContext, analyzeSaju } from '../../src/saju-adapter.js';
import type { SajuSummary } from '../../src/types.js';

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

console.log('PR-H-D adapter daewoon richness surface\n');

const summary: SajuSummary = await analyzeSaju({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});

const daeunSource = (summary as any).daeunInfo;
const saeunSource = (summary as any).saeunPillars;

check('SajuSummary.daeunInfo present (existing)', daeunSource !== undefined,
  daeunSource ? `pillars=${daeunSource.pillars?.length}` : 'null');
check('SajuSummary.saeunPillars present (existing)', Array.isArray(saeunSource),
  `length=${saeunSource?.length}`);

const ctx = buildSajuContext(summary);
check('buildSajuContext returns an output object', ctx.output !== null);

if (ctx.output) {
  // — daeunInfo surface —
  if (daeunSource) {
    check('SajuOutputSummary.daeunInfo is set when source has structure',
      ctx.output.daeunInfo !== undefined && ctx.output.daeunInfo !== null,
      `pillars=${ctx.output.daeunInfo?.pillars?.length}`);
    if (ctx.output.daeunInfo) {
      check('daeunInfo has isForward boolean',
        typeof ctx.output.daeunInfo.isForward === 'boolean');
      check('daeunInfo has firstDaeunStartAge number',
        typeof ctx.output.daeunInfo.firstDaeunStartAge === 'number');
      check('daeunInfo has pillars array',
        Array.isArray(ctx.output.daeunInfo.pillars));
      const firstPillar = ctx.output.daeunInfo.pillars?.[0];
      if (firstPillar) {
        check('daeunInfo.pillars[0] has stem/branch/startAge/endAge',
          typeof firstPillar.stem === 'string' &&
          typeof firstPillar.branch === 'string' &&
          typeof firstPillar.startAge === 'number' &&
          typeof firstPillar.endAge === 'number');
      }
    }
  } else {
    check('SajuOutputSummary.daeunInfo is undefined when source is null',
      ctx.output.daeunInfo === undefined);
  }

  // — saeunPillars surface —
  if (Array.isArray(saeunSource) && saeunSource.length > 0) {
    check('SajuOutputSummary.saeunPillars is set when source has rows',
      Array.isArray(ctx.output.saeunPillars) &&
      ctx.output.saeunPillars.length === saeunSource.length,
      `lifted ${ctx.output.saeunPillars?.length} entries`);
    const firstSaeun = ctx.output.saeunPillars![0];
    check('saeunPillars[0] has year/stem/branch shape',
      typeof firstSaeun.year === 'number' &&
      typeof firstSaeun.stem === 'string' &&
      typeof firstSaeun.branch === 'string');
  } else {
    check('SajuOutputSummary.saeunPillars is undefined when source is empty',
      ctx.output.saeunPillars === undefined);
  }

  // — PR-H-A/B regression guards —
  check('cheonganRelations regression guard',
    Array.isArray(ctx.output.cheonganRelations) || ctx.output.cheonganRelations === undefined);
  check('shinsalHits regression guard',
    Array.isArray(ctx.output.shinsalHits) || ctx.output.shinsalHits === undefined);
  check('gongmang regression guard',
    Array.isArray(ctx.output.gongmang) || ctx.output.gongmang === undefined);
}

// — Empty-source coercion —
const emptySummary: SajuSummary = {
  ...summary,
  daeunInfo: null,
  saeunPillars: [],
} as any as SajuSummary;
const emptyCtx = buildSajuContext(emptySummary);
check('null daeunInfo → output undefined', emptyCtx.output?.daeunInfo === undefined);
check('empty saeunPillars → output undefined', emptyCtx.output?.saeunPillars === undefined);

console.log(`\nadapter-daewoon: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
