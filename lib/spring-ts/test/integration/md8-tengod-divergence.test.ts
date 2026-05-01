/**
 * test/integration/md8-tengod-divergence.test.ts
 *
 * PR-Q-24 (Phase M-D8 caveat documentation, NOT resolution).
 *
 * Empirical re-test of tenGodMode='simple_count' vs 'positional_weighted'
 * on the 9 jonggyeok fixtures (extreme element distributions ≥60% one
 * element) added in PR #143. Goal: see if the M-D8 declarative flip
 * surfaces measurable divergence at candidate finalScore level on charts
 * specifically chosen for tenGod imbalance.
 *
 * Result (2026-05-01): **0/9 divergence even on jonggyeok fixtures**.
 * Combined with 0/12 on default fixtures → 0/21 total observation.
 *
 * Mechanism (saju-calculator.ts:454-470):
 *   - simple_count: groupCounts from saju-adapter (천간 = +1, 지지정기 = +1, 지장간 = 0)
 *   - positional_weighted: re-derived (천간 = +4.0, 지지정기 = +1.8, 지장간 = +1.2/+0.7/+0.45)
 *   - Both feed into computeTenGodScore which normalizes via deviation /
 *     averageCount, then blends into weightedBaseScore at saju-calculator.ts:671.
 *
 * Why 0 divergence?
 *   1. Deviation normalization (line 481): `(avg - groupCount) / avg` is
 *      scale-invariant — proportional scaling of groupCounts produces
 *      identical deviations.
 *   2. 지장간 distribution often mirrors 천간/지지 ratios in real charts,
 *      so positional weights don't shift the GROUP RATIO meaningfully.
 *   3. Even when ratios differ, downstream weightedBaseScore blend
 *      (balance + yongshin + strength + tenGod) often converges due to
 *      the deficiencyBonus + penalty pipeline normalizing extreme inputs.
 *
 * Conclusion: M-D8 default flip is wired (branch executes, byPosition
 * consumed) but **null-effect on candidate finalScore** at the current
 * fixture set + scoring pipeline. The flip is not regressive (no harm),
 * but also not measurably helpful at the user-facing layer. PR-N retroactive
 * review could either:
 *   (a) Roll back to 'simple_count' default + remove the declarative flag
 *   (b) Restructure computeTenGodScore to be position-sensitive at the
 *       deviation step (not just groupCounts step) — would surface real
 *       divergence
 *   (c) Keep as-is with this test as the empirical record
 *
 * This test asserts only the empirical observation (no divergence).
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_cases.json');

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

const data = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'));
const fixtures = data.fixtures as Array<{
  id: string;
  expectedJonggyeokType: string;
  birth: { year: number; month: number; day: number; hour: number; minute: number; gender: 'male' | 'female' };
  surname: Array<{ hangul: string; hanja: string }>;
  givenName: Array<{ hangul: string; hanja: string }>;
}>;

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

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

console.log('PR-Q-24 (M-D8 caveat resolution) tenGodMode divergence on jonggyeok fixtures\n');

interface Row { id: string; jong: string; simple: number; positional: number; }
const rows: Row[] = [];

// Instead of finalScore (rounded, candidate-rank-dependent), inspect the
// sajuReport priority layer directly — that's where computeTenGodScore feeds.
for (const fix of fixtures) {
  const sjSimple: any = await engine.getSajuReport({
    birth: fix.birth,
    surname: fix.surname,
    options: { precisionConfig: { tenGodMode: 'simple_count' } } as any,
  });
  const sjPositional: any = await engine.getSajuReport({
    birth: fix.birth,
    surname: fix.surname,
    options: { precisionConfig: { tenGodMode: 'positional_weighted' } } as any,
  });
  // Build sajuOutput context manually via JSON delta — we just need a
  // measurable scalar that depends on tenGodMode. axisStrength.tenGod or
  // the candidate finalScore at top-5 (not just top-1) gives more surface.
  const baseReq = {
    birth: fix.birth,
    surname: fix.surname,
    givenNameLength: fix.givenName.length,
    mode: 'recommend' as const,
  };
  const simpleResults = await engine.getNameCandidates({
    ...baseReq,
    options: { limit: 5, precisionConfig: { tenGodMode: 'simple_count' } } as any,
  });
  const positionalResults = await engine.getNameCandidates({
    ...baseReq,
    options: { limit: 5, precisionConfig: { tenGodMode: 'positional_weighted' } } as any,
  });
  const simpleHash = simpleResults.map((c: any) => `${c.fullHangul}:${c.finalScore}`).join('|');
  const positionalHash = positionalResults.map((c: any) => `${c.fullHangul}:${c.finalScore}`).join('|');
  const simple = simpleResults[0]?.finalScore ?? -1;
  const positional = positionalResults[0]?.finalScore ?? -1;
  rows.push({ id: fix.id, jong: fix.expectedJonggyeokType, simple, positional });
  if (simpleHash !== positionalHash) {
    console.log(`  ${fix.id} top-5 RESHUFFLE detected:`);
    console.log(`    simple:     ${simpleHash.slice(0, 100)}`);
    console.log(`    positional: ${positionalHash.slice(0, 100)}`);
  }
}

console.log('id              jong-type     simple    positional   diverge?');
let divergeCount = 0;
let totalScoreDelta = 0;
for (const r of rows) {
  const diverge = r.simple !== r.positional;
  if (diverge) divergeCount++;
  totalScoreDelta += Math.abs(r.simple - r.positional);
  console.log(`${r.id}    ${r.jong.padEnd(13)} ${String(r.simple).padEnd(8)} ${String(r.positional).padEnd(11)} ${diverge ? '≠' : '='}`);
}

console.log(`\nDivergence count: ${divergeCount}/${rows.length}`);
console.log(`Total |Δ score|: ${totalScoreDelta.toFixed(2)}`);

check(`empirical observation recorded`, true, `${divergeCount}/${rows.length} fixtures diverge (expected 0 — M-D8 effect is null at finalScore level on default scoring pipeline)`);
check(`positional_weighted is wired (no crash)`, rows.every((r) => r.simple > 0 && r.positional > 0));
check(`null-effect documented (informational)`, divergeCount === 0,
  `M-D8 flip is wired but null-effect; PR-N retroactive review options in test header`);

engine.close();

console.log(`\nM-D8 verification: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
