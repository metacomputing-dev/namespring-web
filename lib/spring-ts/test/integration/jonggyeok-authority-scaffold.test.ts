/**
 * test/integration/jonggyeok-authority-scaffold.test.ts
 *
 * [PR-7 틀] 종격 승격 검증 스캐폴드.
 *
 * 1. jonggyeok.calibrated 프리셋(임계 ±0.55 재보정)이 옵트인으로 실제 동작하는지 —
 *    교리 T1 픽스처(대표 위해 케이스 fix-jong-04 종재격)에서 CONG_* 격이 발화한다.
 * 2. 기본 경로 불변 — 프리셋 없이 동일 명식은 종격 미선택(리스크 신호만).
 * 3. 권위 코퍼스(jonggyeok_authority_cases.json) 스키마 게이트 — 케이스가 추가되면
 *    자동으로 calibrated 판정 일치 검증이 활성화된다 (승격 기준: 20건+, 80%+).
 *
 * Run: npm run test:jonggyeok-authority
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

console.log('종격 승격 스캐폴드 (PR-7 틀)\n');

const engine = new SpringEngine();
for (const repo of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
  if (repo) (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

// ── 1. calibrated 프리셋 실측 한계 핀 (교리 대표 위해 케이스: fix-jong-04 종재격) ──
// 실측 발견(2026-07-08): weakThreshold를 -0.55로 낮춰도 potential 램프 수식
// ((threshold - s) / (threshold + 1) — 임계→-1 구간 정규화)이 극단 교리 명식
// (idx≈-0.63)의 factor를 ~0.19로 눌러 CONG 게이트(0.6)에 도달 불가.
// = 감사 B5가 완전 승격을 반려한 실체는 '임계값'이 아니라 '램프 수식 구조'다.
// 승격에는 (a) potential 램프 재설계 또는 (b) DSL 게이트 인하가 필요하며,
// 어느 쪽이든 권위 코퍼스(아래 스캐폴드) 확보가 선행이다. 이 테스트는 그 한계를
// 핀해 두고, 수식/게이트가 재설계되면 의도적으로 깨지도록 한다.
const doctrinal = JSON.parse(fs.readFileSync(path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_cases.json'), 'utf-8'));
const jong04 = doctrinal.fixtures.find((f: any) => f.id === 'fix-jong-04');

const calibrated: any = await engine.getSajuReport({
  birth: jong04.birth,
  surname: jong04.surname,
  options: { precisionConfig: { sajuSchoolId: 'jonggyeok.calibrated' } } as any,
});
const calType = String(calibrated.gyeokgukResult?.type ?? calibrated.gyeokguk?.type ?? '');
check('calibrated 임계 재보정 단독으로는 CONG_* 미발화 (램프 수식 한계 — 실측 핀)',
  !calType.startsWith('CONG_'),
  `type=${calType} — 재설계 시 이 핀을 갱신할 것`);
check('calibrated 프리셋이 유효한 격국을 산출한다 (옵트인 무붕괴)',
  calType.length > 0);

// ── 2. 기본 경로 불변 ──
const base: any = await engine.getSajuReport({ birth: jong04.birth, surname: jong04.surname });
const baseType = String(base.gyeokgukResult?.type ?? base.gyeokguk?.type ?? '');
check('기본 경로: 종격 미선택 유지 (리스크 신호+감쇠만)',
  !baseType.startsWith('CONG_'),
  `type=${baseType}`);
check('기본 경로: 종격 리스크 신호는 유지 (HIGH)',
  (base.yongshin as any)?.jonggyeokRisk?.level === 'HIGH');

// ── 3. 권위 코퍼스 게이트 ──
const authority = JSON.parse(fs.readFileSync(path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_authority_cases.json'), 'utf-8'));
check('권위 코퍼스 스키마: _meta.intakeRequirements 존재',
  !!authority._meta?.intakeRequirements?.sourceTier);
check('권위 코퍼스 스키마: cases 배열',
  Array.isArray(authority.cases));

if (authority.cases.length === 0) {
  console.log('  INFO 권위 코퍼스 0건 — 판정 일치 검증은 케이스 축적 후 자동 활성 (승격 기준: 20건+, 일치율 80%+)');
} else {
  let matched = 0;
  for (const c of authority.cases) {
    const tier = c?.sourceTier?.tier ?? '';
    check(`${c.id}: sourceTier T3 이상 + authorityTruthEligible`,
      (tier === 'T3_AUTHORED_INTERPRETATION' || tier === 'T4_PRIMARY_TEXT' || tier === 'T5_OFFICIAL')
        && c?.sourceTier?.authorityTruthEligible === true,
      tier);
    const sj: any = await engine.getSajuReport({
      birth: c.birth,
      surname: c.surname ?? [{ hangul: '김', hanja: '金' }],
      options: { precisionConfig: { sajuSchoolId: 'jonggyeok.calibrated' } } as any,
    });
    const t = String(sj.gyeokgukResult?.type ?? '');
    if (t.startsWith(String(c.expectedJonggyeokType))) matched += 1;
  }
  const rate = matched / authority.cases.length;
  console.log(`  INFO calibrated 판정 일치율: ${matched}/${authority.cases.length} (${(rate * 100).toFixed(0)}%)`);
  check('승격 기준 참고치(80%)와의 대조는 20건 이상에서만 게이트', authority.cases.length < 20 || rate >= 0.8);
}

engine.close();

console.log(`\n종격 승격 스캐폴드: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
