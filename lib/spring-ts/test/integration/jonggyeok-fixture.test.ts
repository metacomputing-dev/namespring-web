/**
 * test/integration/jonggyeok-fixture.test.ts
 *
 * PR-Q-20 (Phase L-1) — 9-way 종격 (jonggyeok) fixture validation.
 *
 * Each fixture documents the **doctrinal expected** jonggyeok type per
 * classical 명리학 analysis (training-data derived, NOT citation-anchored).
 * spring-ts default chengbai_strict mode classifies all 9 charts as 정격
 * (regular forms). This test does NOT assert the engine matches the
 * doctrinal target — it documents the disagreement so future engine work
 * (e.g., precisionConfig.gyeokgukSelectionRule='classical_jonggyeok') can
 * be measured against the same fixtures.
 *
 * What is asserted:
 *   1. All 9 fixtures have non-empty doctrinal classification fields.
 *   2. Each fixture's expectedPillars matches what saju-ts computes.
 *   3. Each fixture's elementDistribution matches what saju-ts computes
 *      (within ±2% tolerance for rounding).
 *   4. Each fixture's expectedJonggyeokType is one of the 9 canonical types.
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

const VALID_TYPES = new Set([
  'HUA_QI', 'ZHUAN_WANG', 'CONG_GE', 'CONG_CAI', 'CONG_GUAN',
  'CONG_SHA', 'CONG_ER', 'CONG_YIN', 'CONG_BI',
]);

interface JonggyeokFixture {
  id: string;
  label: string;
  birth: { year: number; month: number; day: number; hour: number; minute: number; gender: 'male' | 'female' };
  surname: Array<{ hangul: string; hanja: string }>;
  givenName: Array<{ hangul: string; hanja: string }>;
  expectedPillars: string;
  elementDistribution: Record<string, number>;
  expectedJonggyeokType: string;
  expectedJonggyeokSubtype: string;
  expectedSource: string;
  expectedSourceConfidence: string;
  doctrineNote: string;
  engineCurrentType: string;
  disagreementReason: string;
}

const data = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'));
const fixtures = data.fixtures as JonggyeokFixture[];

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

console.log('PR-Q-20 (Phase L-1) jonggyeok 9-way fixture validation\n');

check(`fixture count = 9`, fixtures.length === 9, `actual=${fixtures.length}`);
check(`sourcePolicy declares training-data origin`,
  typeof data.sourcePolicy === 'string' && data.sourcePolicy.includes('training'));
check(`sourceTier marks collection as T1 hypothesis`,
  data.sourceTier?.tier === 'T1_HYPOTHESIS' &&
  data.sourceTier?.authorityTruthEligible === false);

const observedEngineTypes: Record<string, string> = {};

for (const fix of fixtures) {
  // (1) doctrinal fields present + valid
  check(`${fix.id}: expectedJonggyeokType in valid set`,
    VALID_TYPES.has(fix.expectedJonggyeokType),
    fix.expectedJonggyeokType);
  check(`${fix.id}: doctrineNote non-empty`,
    typeof fix.doctrineNote === 'string' && fix.doctrineNote.length >= 20);
  check(`${fix.id}: expectedSource cites training-data`,
    fix.expectedSource.includes('AI-derived'));

  // (2) pillar match
  const sj: any = await engine.getSajuReport({
    birth: fix.birth,
    surname: fix.surname,
  });
  const p = sj.pillars ?? {};
  const actualPillars = `${p.year?.stem?.hanja}${p.year?.branch?.hanja} ${p.month?.stem?.hanja}${p.month?.branch?.hanja} ${p.day?.stem?.hanja}${p.day?.branch?.hanja} ${p.hour?.stem?.hanja}${p.hour?.branch?.hanja}`;
  check(`${fix.id}: pillars match`,
    actualPillars === fix.expectedPillars,
    `expected=${fix.expectedPillars} / actual=${actualPillars}`);

  // (3) element distribution within tolerance
  const dist: Record<string, number> = sj.elementDistribution ?? sj.ohaengDistribution ?? {};
  const total = Object.values(dist).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  const ratios: Record<string, number> = {};
  for (const [k, v] of Object.entries(dist)) ratios[k] = (Number(v) || 0) / total;
  let allMatch = true;
  for (const [el, expectedRatio] of Object.entries(fix.elementDistribution)) {
    const actual = ratios[el] ?? 0;
    if (Math.abs(actual - expectedRatio) > 0.025) {
      allMatch = false;
      break;
    }
  }
  check(`${fix.id}: element distribution within ±2.5%`, allMatch,
    JSON.stringify(Object.fromEntries(Object.entries(ratios).map(([k, v]) => [k, v.toFixed(3)]))));

  // (4) record what engine actually outputs (no assertion — engine ≠ doctrine for these)
  const engineType = sj.gyeokgukResult?.type ?? sj.gyeokguk?.type ?? '?';
  observedEngineTypes[fix.id] = engineType;
}

console.log('\nEngine output vs doctrinal expected (informational):');
console.log('id              expected      engine_actual');
for (const fix of fixtures) {
  const engineType = observedEngineTypes[fix.id];
  const match = engineType.startsWith(fix.expectedJonggyeokType) ? '✓' : '✗';
  console.log(`${fix.id}    ${fix.expectedJonggyeokType.padEnd(13)} ${engineType}  ${match}`);
}

const matchCount = Object.entries(observedEngineTypes).filter(
  ([id, et]) => et.startsWith(fixtures.find((f) => f.id === id)!.expectedJonggyeokType),
).length;
console.log(`\nEngine matches doctrinal type: ${matchCount}/${fixtures.length} (expected 0 in chengbai_strict default mode)`);

engine.close();

console.log(`\nJonggyeok fixture: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
