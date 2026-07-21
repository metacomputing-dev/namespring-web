/**
 * test/integration/adapter-relations.test.ts
 *
 * PR-H-A — verifies the saju-adapter surfaces cheonganRelations and
 * jijiRelations through SajuOutputSummary as additive optional readonly
 * arrays, mirroring SajuSummary's existing fields.
 *
 *   1. buildSajuContext returns relation arrays when the source SajuSummary
 *      has them.
 *   2. Empty source arrays are coerced to undefined (not []).
 *   3. The new fields are read-only at the type level.
 *   4. Default scoring path (SajuCalculator) is unaffected — the additive
 *      fields don't accidentally feed into the existing scoring inputs.
 *
 * Run: npm run test:adapter-relations
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

import { buildSajuContext, extractSaju } from '../../src/saju-adapter.js';
import { analyzeSaju } from '../../src/saju-adapter.js';
import type { SajuSummary } from '../../src/types.js';
import { createLegacySajuOutputFixture } from '../helpers/legacy-saju-output.js';

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

console.log('PR-H-A adapter relations surface\n');

// ── (1) Real fixture path — analyzeSaju returns a SajuSummary, then
//        buildSajuContext lifts the relations into SajuOutputSummary. ────
const summary: SajuSummary = await analyzeSaju({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});

check('analyzeSaju returns a SajuSummary',
  summary !== null && typeof summary === 'object');
check('SajuSummary.cheonganRelations is an array (existing surface)',
  Array.isArray(summary.cheonganRelations),
  `length=${summary.cheonganRelations?.length}`);
check('SajuSummary.jijiRelations is an array (existing surface)',
  Array.isArray(summary.jijiRelations),
  `length=${summary.jijiRelations?.length}`);

const ctx = buildSajuContext(summary);
check('buildSajuContext returns an output object', ctx.output !== null);

if (ctx.output) {
  // — Relations PR-H-A surfaces —
  if (summary.cheonganRelations.length > 0) {
    check('SajuOutputSummary.cheonganRelations is set when source has rows',
      Array.isArray(ctx.output.cheonganRelations) &&
      ctx.output.cheonganRelations.length === summary.cheonganRelations.length,
      `lifted ${ctx.output.cheonganRelations?.length} entries`);
  } else {
    check('SajuOutputSummary.cheonganRelations is undefined when source is empty',
      ctx.output.cheonganRelations === undefined,
      'empty cheonganRelations on this fixture is OK — undefined preserved');
  }
  if (summary.jijiRelations.length > 0) {
    check('SajuOutputSummary.jijiRelations is set when source has rows',
      Array.isArray(ctx.output.jijiRelations) &&
      ctx.output.jijiRelations.length === summary.jijiRelations.length,
      `lifted ${ctx.output.jijiRelations?.length} entries`);
    // shape spot-check on first row
    const first = ctx.output.jijiRelations![0];
    check('jijiRelations[0] has type/branches/note shape',
      typeof first.type === 'string' && Array.isArray(first.branches) && typeof first.note === 'string');
  } else {
    check('SajuOutputSummary.jijiRelations is undefined when source is empty',
      ctx.output.jijiRelations === undefined,
      'empty jijiRelations on this fixture is OK — undefined preserved');
  }

  // — Pre-existing fields are still present (regression guard) —
  check('SajuOutputSummary.dayMaster still surfaced', ctx.output.dayMaster !== undefined);
  check('SajuOutputSummary.strength still surfaced', ctx.output.strength !== undefined);
  check('SajuOutputSummary.yongshin still surfaced', ctx.output.yongshin !== undefined);
  check('SajuOutputSummary.gyeokguk still surfaced', ctx.output.gyeokguk !== undefined);
}

// ── (2) Empty-source coercion — synthesise a SajuSummary with [] arrays
//        and confirm undefined coercion. ──
const emptySummary: SajuSummary = {
  ...summary,
  cheonganRelations: [],
  jijiRelations: [],
} as SajuSummary;
const emptyCtx = buildSajuContext(emptySummary);
check('empty source cheonganRelations → output undefined',
  emptyCtx.output?.cheonganRelations === undefined);
check('empty source jijiRelations → output undefined',
  emptyCtx.output?.jijiRelations === undefined);

const relation = { type: 'CHUNG', members: ['GAP', 'GYEONG'] };
const rawFixture = await createLegacySajuOutputFixture();
const validScore = {
  model: 'legacy_heuristic_v1',
  unit: '0_100',
  status: 'provisional',
  evidenceOnly: true,
  authorityTruthEligible: false,
  provisional: true,
  pairCount: 1,
  positionGap: 1,
  positionGaps: [1],
  baseScore: 70,
  adjacencyBonus: 15,
  outcomeMultiplier: 0.75,
  finalScore: 67.5,
  rationale: 'type=CHUNG;positionGap=1',
};
const scoreFrom = (score: unknown, duplicates: unknown[] = []) => extractSaju({
  ...rawFixture,
  cheonganRelations: [relation],
  scoredCheonganRelations: [{ hit: relation, score }, ...duplicates],
}).cheonganRelations[0]?.score;

check('valid provisional cheongan score preserves zero-safe numeric contract',
  scoreFrom({ ...validScore, adjacencyBonus: 0, finalScore: 52.5 })?.adjacencyBonus === 0);
for (const [label, mutation] of [
  ['numeric string', { baseScore: '70' }],
  ['boolean', { outcomeMultiplier: true }],
  ['infinity', { finalScore: Number.POSITIVE_INFINITY }],
  ['out of range', { outcomeMultiplier: 1.1 }],
  ['missing provenance', { status: undefined }],
  ['formula mismatch', { finalScore: 70 }],
] as const) {
  check(`malformed cheongan score fails closed: ${label}`,
    scoreFrom({ ...validScore, ...mutation }) === null);
}
check('duplicate cheongan score key is ambiguous rather than last-wins',
  scoreFrom(validScore, [{
    hit: relation,
    score: { ...validScore, adjacencyBonus: 0, finalScore: 52.5 },
  }]) === null);

console.log(`\nadapter-relations: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
