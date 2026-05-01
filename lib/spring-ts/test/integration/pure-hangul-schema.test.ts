/**
 * test/integration/pure-hangul-schema.test.ts
 *
 * PR-Q-22 (Phase K-7) — pureHangulSchema option wiring fixture.
 *
 * pureHangulSchema 4 변형 (auto/classic_phonetic/modern_korean/expanded)
 * 의 declaration + opt-in 채널 검증. 풀 element-mapping wire-up 은
 * 별도 PR (spec spring-info/09_finalization/05_pure_hangul_schema_wireup.md).
 *
 * What's tested:
 *   1. Type declaration accepts all 4 enum values without error.
 *   2. Each option flows through getNameCandidates without crashing.
 *   3. 'auto' is the new K-4 declaration (schoolPreset 기반 routing target).
 *   4. Hangul-only name 입력에서 schema option 이 reach 가능 (정성적 검증).
 *
 * What's NOT tested (deferred to per-schema wire-up PR):
 *   - 실제 ONSET_TO_ELEMENT 표 변경 후 element-mapping 차이
 *   - chinese signal cap multiplier (K-5)
 *   - Polarity binary→ternary relax (K-6)
 *   - schoolPreset='chinese' 의 confidence 하향 효과
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
import type { PrecisionConfig } from '../../src/types.js';

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

console.log('PR-Q-22 (Phase K-7) pureHangulSchema fixture\n');

// (1) Type-level acceptance — compile-time guarantees the union
const schemas: NonNullable<PrecisionConfig['pureHangulSchema']>[] = [
  'auto', 'classic_phonetic', 'modern_korean', 'expanded',
];
check(`union accepts 4 schema values (auto + 3 base)`, schemas.length === 4);

// (2) Hangul-only givenName — stress 시 schema 분기 도착 검증
const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenNameLength: 2,
  mode: 'recommend' as const,
};

for (const schema of schemas) {
  let crashed = false;
  let scoreA: number | null = null;
  try {
    const cands = await engine.getNameCandidates({
      ...baseRequest,
      options: { limit: 1, precisionConfig: { pureHangulSchema: schema } } as any,
    });
    scoreA = cands[0]?.finalScore ?? null;
  } catch {
    crashed = true;
  }
  check(`pureHangulSchema='${schema}' → no crash`, !crashed);
  check(`pureHangulSchema='${schema}' → produces a finalScore`,
    typeof scoreA === 'number' && scoreA >= 0 && scoreA <= 100,
    `score=${scoreA}`);
}

// (3) schoolPreset routing target (K-4 'auto' declaration target)
for (const preset of ['korean', 'chinese', 'modern'] as const) {
  let crashed = false;
  try {
    const cands = await engine.getNameCandidates({
      ...baseRequest,
      options: {
        limit: 1,
        schoolPreset: preset,
        precisionConfig: { pureHangulSchema: 'auto' },
      } as any,
    });
    check(`schoolPreset='${preset}' + pureHangulSchema='auto' → no crash`,
      cands.length > 0);
  } catch (e) {
    crashed = true;
  }
  if (crashed) check(`schoolPreset='${preset}' + auto → no crash`, false);
}

// (4) Behavioral observation: 4 schemas should NOT (currently) yield
// different finalScore on a hanja name (no schema-specific code path active).
const scoresOnHanjaName: number[] = [];
for (const schema of schemas) {
  const cands = await engine.getNameCandidates({
    ...baseRequest,
    options: { limit: 1, precisionConfig: { pureHangulSchema: schema } } as any,
  });
  if (cands[0]?.finalScore != null) scoresOnHanjaName.push(cands[0].finalScore);
}
const allSame = scoresOnHanjaName.every((s) => s === scoresOnHanjaName[0]);
console.log(`\nBehavioral observation (informational):`);
console.log(`  4 schemas on hanja name → finalScores: ${scoresOnHanjaName.join(', ')}`);
console.log(`  ${allSame ? 'IDENTICAL' : 'DIVERGED'} (expected IDENTICAL until per-schema wire-up lands)`);
check(`4 schemas yield identical scores on hanja name (declaration-only stub)`,
  allSame, `scores=${scoresOnHanjaName.join(',')}`);

// (5) PR-Q-23 K-5/K-6 declaration acceptance
console.log('\nK-5/K-6 (PR-Q-23) declaration acceptance:');
const k5Cap = 0.7;
const k6Polarity: 'binary' | 'ternary' = 'ternary';
let crashedK56 = false;
try {
  const cands = await engine.getNameCandidates({
    ...baseRequest,
    options: {
      limit: 1,
      precisionConfig: {
        pureHangulSchema: 'auto',
        pureHangulSignalCap: k5Cap,
        pureHangulPolarityModel: k6Polarity,
      },
    } as any,
  });
  check(`K-5 cap + K-6 polarityModel options accepted (no crash)`,
    cands.length > 0);
} catch (e) {
  crashedK56 = true;
}
if (crashedK56) check(`K-5/K-6 acceptance`, false);

// (6) PR-Q-24 K-5 full wire — signal cap actually changes evaluation
//     on a HANJA name (mixed signal case where weighted-average changes).
//     Note: pure-hangul name only fires HANGUL_* signals, so the cap
//     cancels in numerator/denominator — no effect.  HANJA-included names
//     mix HANGUL + STROKE signals, where cap shifts the relative weight.
console.log('\nK-5 full wire — signal cap effect on hanja-included name:');
const hanjaReq = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
};
const reportFull: any = await engine.getNamingReport(hanjaReq);
const reportCapped: any = await engine.getNamingReport({
  ...hanjaReq,
  options: { precisionConfig: { pureHangulSignalCap: 0.5 } } as any,
});
console.log(`  cap=1.0 totalScore=${reportFull?.totalScore}`);
console.log(`  cap=0.5 totalScore=${reportCapped?.totalScore}`);
const totalChanged = (reportFull?.totalScore ?? 0) !== (reportCapped?.totalScore ?? 0);
check(`K-5 cap=0.5 changes totalScore on hanja-included name (wire active)`,
  totalChanged,
  `delta=${((reportFull?.totalScore ?? 0) - (reportCapped?.totalScore ?? 0)).toFixed(3)}`);

// (7) chinese schoolPreset + 'auto' schema → cap 0.7 auto-resolution
const reportAuto: any = await engine.getNamingReport({
  ...hanjaReq,
  options: {
    schoolPreset: 'chinese',
    precisionConfig: { pureHangulSchema: 'auto' },
  } as any,
});
console.log(`  schoolPreset='chinese' + auto totalScore=${reportAuto?.totalScore}`);
check(`schoolPreset='chinese' + 'auto' schema applies cap (different from baseline)`,
  (reportAuto?.totalScore ?? 0) !== (reportFull?.totalScore ?? 0),
  `auto=${reportAuto?.totalScore} vs baseline=${reportFull?.totalScore}`);

engine.close();

console.log(`\nPureHangulSchema fixture: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
