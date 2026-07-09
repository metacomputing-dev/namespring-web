/**
 * test/integration/adapter-shinsal-gongmang.test.ts
 *
 * PR-H-B — verifies the saju-adapter surfaces shinsalHits and gongmang
 * through SajuOutputSummary as additive optional readonly fields.
 *
 *   1. buildSajuContext lifts shinsalHits when source has rows.
 *   2. buildSajuContext lifts gongmang when the source has a tuple.
 *   3. Empty / null sources coerce to undefined.
 *   4. Pre-existing surfaces (PR-H-A relations + dayMaster/strength/...) are still present.
 *
 * Run: npm run test:adapter-shinsal-gongmang
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

console.log('PR-H-B adapter shinsal + gongmang surface\n');

// Real fixture path
const summary: SajuSummary = await analyzeSaju({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});

check('SajuSummary.shinsalHits is an array (existing surface)',
  Array.isArray(summary.shinsalHits),
  `length=${summary.shinsalHits?.length}`);
check('SajuSummary.gongmang is null or [string,string] (existing surface)',
  summary.gongmang === null ||
    (Array.isArray(summary.gongmang) && summary.gongmang.length === 2));

const ctx = buildSajuContext(summary);
check('buildSajuContext returns an output object', ctx.output !== null);

if (ctx.output) {
  // — shinsalHits surface —
  if (summary.shinsalHits.length > 0) {
    check('SajuOutputSummary.shinsalHits is set when source has rows',
      Array.isArray(ctx.output.shinsalHits) &&
      ctx.output.shinsalHits.length === summary.shinsalHits.length,
      `lifted ${ctx.output.shinsalHits?.length} entries`);
    const first = ctx.output.shinsalHits![0];
    check('shinsalHits[0] has type/position/grade shape',
      typeof first.type === 'string' &&
      typeof first.position === 'string' &&
      typeof first.grade === 'string');
    check('shinsalHits[0] has weighted score number',
      typeof first.weightedScore === 'number' && Number.isFinite(first.weightedScore));
  } else {
    check('SajuOutputSummary.shinsalHits is undefined when source is empty',
      ctx.output.shinsalHits === undefined);
  }
  check('unsupported shinsalComposites is not surfaced',
    !Object.prototype.hasOwnProperty.call(summary as any, 'shinsalComposites') &&
      !Object.prototype.hasOwnProperty.call(ctx.output as any, 'shinsalComposites'));

  // — gongmang surface —
  if (summary.gongmang) {
    check('SajuOutputSummary.gongmang is set when source has a tuple',
      Array.isArray(ctx.output.gongmang) && ctx.output.gongmang.length === 2,
      `gongmang=${JSON.stringify(ctx.output.gongmang)}`);
  } else {
    check('SajuOutputSummary.gongmang is undefined when source is null',
      ctx.output.gongmang === undefined);
  }

  // — PR-H-A regression guard —
  check('SajuOutputSummary.cheonganRelations still surfaced (PR-H-A regression guard)',
    Array.isArray(ctx.output.cheonganRelations) || ctx.output.cheonganRelations === undefined);
  check('SajuOutputSummary.jijiRelations still surfaced (PR-H-A regression guard)',
    Array.isArray(ctx.output.jijiRelations) || ctx.output.jijiRelations === undefined);

  // — Pre-existing surface guard —
  check('SajuOutputSummary.dayMaster still surfaced', ctx.output.dayMaster !== undefined);
  check('SajuOutputSummary.strength still surfaced', ctx.output.strength !== undefined);
  check('SajuOutputSummary.yongshin still surfaced', ctx.output.yongshin !== undefined);
}

// — Empty-source coercion —
const emptySummary: SajuSummary = {
  ...summary,
  shinsalHits: [],
  gongmang: null,
} as SajuSummary;
const emptyCtx = buildSajuContext(emptySummary);
check('empty shinsalHits → output undefined', emptyCtx.output?.shinsalHits === undefined);
check('null gongmang → output undefined', emptyCtx.output?.gongmang === undefined);

console.log(`\nadapter-shinsal-gongmang: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
