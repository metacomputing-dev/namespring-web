/**
 * test/integration/borderline-strength-tier.test.ts
 *
 * PR-Q-19 (Phase L-3) — borderline 신강 tier validation.
 *
 * fix-13/14/15 are borderline-strength fixtures whose expected
 * axisStrength.strength tier is encoded in `expectedAxisStrengthTier`.
 * This test verifies the multi_axis evaluator's hedge accuracy at the
 * three relevant tier values: practical / candidate / deferred.
 *
 * (definite tier 는 unambiguous 신강/신약 → 별도 검증 불필요.)
 *
 * Run: npx tsx test/integration/borderline-strength-tier.test.ts
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');

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

interface BorderlineFixture {
  id: string;
  label: string;
  birth: { year: number; month: number; day: number; hour: number | null; minute: number; gender: 'male' | 'female' | 'neutral' };
  surname: Array<{ hangul: string; hanja: string }>;
  givenName: Array<{ hangul: string; hanja: string }>;
  expectedAxisStrengthTier?: 'practical' | 'candidate' | 'deferred' | 'definite';
}

const all = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures as BorderlineFixture[];
const targets = all.filter((f) => !!f.expectedAxisStrengthTier);

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

console.log('PR-Q-19 (Phase L-3) borderline strength tier validation\n');

check(`Found ${targets.length} borderline fixtures (expected 3)`, targets.length === 3,
  targets.map((f) => f.id).join(','));

for (const fix of targets) {
  const birth = { ...fix.birth, hour: fix.birth.hour ?? 12 };
  const sj: any = await engine.getSajuReport({ birth, surname: fix.surname });
  const tier = sj.axisStrength?.strength;
  check(
    `${fix.id}: axisStrength.strength === '${fix.expectedAxisStrengthTier}'`,
    tier === fix.expectedAxisStrengthTier,
    `actual=${tier}`,
  );
  // sanity: tier should be one of the four canonical values
  check(
    `${fix.id}: tier in {definite, practical, candidate, deferred}`,
    ['definite', 'practical', 'candidate', 'deferred'].includes(tier),
    `actual=${tier}`,
  );
}

// Multi-axis priority should fall through to single mode when all tiers are
// 'deferred' (information-poor → no degradation policy per spec §4.2). Spec
// requires axisCount ≥ 2 valid tiers. fix-15 has 'deferred' strength — the
// other axes (yongshin/gyeokguk) need to also be valid for multi_axis to fire.
console.log('\nFall-through observation:');
for (const fix of targets) {
  const birth = { ...fix.birth, hour: fix.birth.hour ?? 12 };
  const sj: any = await engine.getSajuReport({ birth, surname: fix.surname });
  const axisStrength = sj.axisStrength ?? {};
  const validTiers = Object.values(axisStrength).filter(
    (t: any) => typeof t === 'string' && ['definite', 'practical', 'candidate', 'deferred'].includes(t),
  ).length;
  console.log(`  ${fix.id}: axes valid = ${validTiers}; strength tier = ${axisStrength.strength}`);
}

engine.close();

console.log(`\nBorderline tier validation: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
