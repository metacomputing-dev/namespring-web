/**
 * test/integration/yaza-opt-in.test.ts
 *
 * 일주 경계 정책 테스트 — 감사 결정① (2026-07-08) 이후.
 *
 * 기본값 = 정자시설(yaza on, 23:00 모드 = 엔진 ziSplit23). 경도 보정(기본 on,
 * 서울 -32.09분)과 결합하면 시계 기준 약 23:32~00:32 출생자의 일주가 자정설
 * 대비 하루 뒤로 이동한다. 자정설은 `sajuTimePolicy.yaza='off'` 옵트아웃.
 *
 * 역사 기록: 과거 이 테스트가 관찰한 "engine wiring gap"(yaza='on'인데 일주
 * 불변)의 실체는 (a) preset(KOREAN_MAINSTREAM)의 dayCutMode가 yazaMode보다
 * 먼저 평가되어 그림자를 드리운 것 + (b) 23:30 시계 출생은 태양시 22:58로
 * 창(태양시 23:00~) 밖이라 애초에 차이가 없는 케이스였다는 것. 어댑터가
 * dayCutMode를 명시하고 창 안(23:45) 케이스로 검증하도록 재작성했다.
 *
 * What is asserted:
 *   1. 창 안(시계 23:45): 기본(정자시설) 일주 = 자정설 일주 + 1일 (다름).
 *   2. 창 안(시계 00:30, fix-03 축): 기본 일주가 자정설과 다름.
 *   3. 창 밖(05:45): 기본과 자정설 일주 동일.
 *   4. 23:30 레거시 모드(경도 보정 off 유파용) 옵트인이 유효한 일주를 산출.
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

function dayPillarOf(sj: any): string {
  return `${sj.pillars?.day?.stem?.hanja}${sj.pillars?.day?.branch?.hanja}`;
}

const MIDNIGHT_OPTS = { sajuTimePolicy: { yaza: 'off' } } as any;

console.log('일주 경계 정책 (감사 결정① — 기본 정자시설)\n');

// (1) 창 안: 시계 23:45 → 태양시 약 23:13 (>= 23:00) → 정자시설은 익일 일주.
const inWindowLate = {
  birth: { year: 2000, month: 1, day: 1, hour: 23, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '김', hanja: '金' }],
};
const lateDefault: any = await engine.getSajuReport(inWindowLate);
const lateMidnight: any = await engine.getSajuReport({ ...inWindowLate, options: MIDNIGHT_OPTS });
console.log(`  23:45 출생: 기본(정자시설)=${dayPillarOf(lateDefault)} vs 자정설=${dayPillarOf(lateMidnight)}`);
check('창 안(23:45): 기본 일주가 자정설과 다르다 (익일 이동)',
  dayPillarOf(lateDefault) !== dayPillarOf(lateMidnight) && dayPillarOf(lateDefault).length === 2,
  `default=${dayPillarOf(lateDefault)}, midnight=${dayPillarOf(lateMidnight)}`);

// (2) 창 안: 시계 00:30 (fix-03 축) → 태양시 약 전일 23:58 → 정자시설은 당일(시계 날짜) 일주.
const inWindowEarly = {
  birth: { year: 2000, month: 1, day: 1, hour: 0, minute: 30, gender: 'male' as const },
  surname: [{ hangul: '김', hanja: '金' }],
};
const earlyDefault: any = await engine.getSajuReport(inWindowEarly);
const earlyMidnight: any = await engine.getSajuReport({ ...inWindowEarly, options: MIDNIGHT_OPTS });
console.log(`  00:30 출생: 기본(정자시설)=${dayPillarOf(earlyDefault)} vs 자정설=${dayPillarOf(earlyMidnight)}`);
check('창 안(00:30): 기본 일주가 자정설과 다르다',
  dayPillarOf(earlyDefault) !== dayPillarOf(earlyMidnight) && dayPillarOf(earlyDefault).length === 2,
  `default=${dayPillarOf(earlyDefault)}, midnight=${dayPillarOf(earlyMidnight)}`);

// (3) 창 밖: 05:45 → 정책 무관 동일 일주.
const nonBoundary = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
};
const nbDefault: any = await engine.getSajuReport(nonBoundary);
const nbMidnight: any = await engine.getSajuReport({ ...nonBoundary, options: MIDNIGHT_OPTS });
check('창 밖(05:45): 기본과 자정설 일주 동일',
  dayPillarOf(nbDefault) === dayPillarOf(nbMidnight),
  `default=${dayPillarOf(nbDefault)}, midnight=${dayPillarOf(nbMidnight)}`);

// (4) 23:30 레거시 모드 옵트인 (경도 보정 off 유파용 — 감사 A11: 시프트는 경계
//     분류에만 적용되고 인스턴트는 불변이어야 한다).
const legacy2330: any = await engine.getSajuReport({
  ...inWindowLate,
  options: { sajuTimePolicy: { yaza: 'on', yazaMode: '23:30', longitudeCorrection: 'off' } } as any,
});
const day2330 = dayPillarOf(legacy2330);
console.log(`  yazaMode='23:30'+경도보정 off: 일주=${day2330}`);
check(`yazaMode='23:30' 옵트인이 유효한 일주를 산출`, !!day2330 && day2330.length === 2);

engine.close();

console.log(`\nYaza 경계 정책: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
