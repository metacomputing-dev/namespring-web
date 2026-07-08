/**
 * test/integration/korean-lunar-calendar.test.ts
 *
 * 감사 B1 — 내장 음양력 변환(korean-lunar-calendar.ts) 검증.
 *
 * 1. KASI 공식 픽스처 13케이스(T5_OFFICIAL) 양방향 왕복 — 1차 오라클.
 * 2. 앵커 픽스처(설날 151·윤달 56·추석 22) — 광범위 회귀 핀.
 * 3. 전 범위 왕복 스윕 — 양력 1900-01-31~2050-12-31 매일 solarToLunar→lunarToSolar 항등.
 * 4. 무효 입력(없는 윤달·범위 밖·1582-10 개력 공백).
 *
 * Run: npm run test:lunar-calendar
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lunarToSolar,
  solarToLunar,
  leapMonthOfLunarYear,
} from '../../src/calendar/korean-lunar-calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const ORACLE_PATH = path.resolve(SPRING_TS_ROOT, 'data/kasi-lunar-solar/kasi_lunar_solar_2025_2026_cases.json');
const ANCHOR_PATH = path.resolve(SPRING_TS_ROOT, 'data/kasi-lunar-solar/korean_lunar_anchor_cases.json');

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

console.log('Korean lunar-solar conversion (감사 B1)\n');

// ── 1. KASI 공식 오라클 13케이스 양방향 ──
const oracle = JSON.parse(fs.readFileSync(ORACLE_PATH, 'utf-8'));
for (const c of oracle.cases) {
  const s = c.solar;
  const l = c.lunar;
  const gotSolar = lunarToSolar({ year: l.year, month: l.month, day: l.day, isLeapMonth: l.isLeapMonth });
  check(`${c.id}: lunar→solar`,
    !!gotSolar && gotSolar.year === s.year && gotSolar.month === s.month && gotSolar.day === s.day,
    gotSolar ? `${gotSolar.year}-${gotSolar.month}-${gotSolar.day}` : 'null');
  const gotLunar = solarToLunar({ year: s.year, month: s.month, day: s.day });
  check(`${c.id}: solar→lunar`,
    !!gotLunar && gotLunar.year === l.year && gotLunar.month === l.month
      && gotLunar.day === l.day && gotLunar.isLeapMonth === l.isLeapMonth,
    gotLunar ? `${gotLunar.year}-${gotLunar.isLeapMonth ? '윤' : ''}${gotLunar.month}-${gotLunar.day}` : 'null');
}

// ── 2. 앵커 회귀 핀 ──
const anchors = JSON.parse(fs.readFileSync(ANCHOR_PATH, 'utf-8'));

let seollalOk = 0;
for (const entry of anchors.seollal) {
  const got = lunarToSolar({ year: entry.lunarYear, month: 1, day: 1, isLeapMonth: false });
  const iso = got ? `${got.year}-${String(got.month).padStart(2, '0')}-${String(got.day).padStart(2, '0')}` : 'null';
  if (iso === entry.solar) seollalOk += 1;
  else console.log(`  FAIL 설날 ${entry.lunarYear}: expected ${entry.solar}, got ${iso}`);
}
check(`설날(음 1-1) 앵커 ${anchors.seollal.length}건 전부 일치`, seollalOk === anchors.seollal.length,
  `${seollalOk}/${anchors.seollal.length}`);

let leapOk = 0;
const leapByYear = new Map<number, number>(anchors.leapMonths.map((e: any) => [e.year, e.month]));
for (let year = 1900; year <= 2050; year++) {
  const expected = leapByYear.get(year) ?? 0;
  const got = leapMonthOfLunarYear(year) ?? -1;
  if (got === expected) leapOk += 1;
  else console.log(`  FAIL 윤달 ${year}: expected ${expected || '없음'}, got ${got || '없음'}`);
}
check('윤달 배치 1900~2050 전 연도 일치(앵커 목록 = 완전 목록 전제)', leapOk === 151, `${leapOk}/151`);

let chuseokOk = 0;
for (const entry of anchors.chuseok) {
  const got = lunarToSolar({ year: entry.year, month: 8, day: 15, isLeapMonth: false });
  const iso = got ? `${got.year}-${String(got.month).padStart(2, '0')}-${String(got.day).padStart(2, '0')}` : 'null';
  if (iso === entry.solar) chuseokOk += 1;
  else console.log(`  FAIL 추석 ${entry.year}: expected ${entry.solar}, got ${iso}`);
}
check(`추석(음 8-15) 앵커 ${anchors.chuseok.length}건 전부 일치`, chuseokOk === anchors.chuseok.length,
  `${chuseokOk}/${anchors.chuseok.length}`);

// ── 3. 전 범위 왕복 스윕 (양력 1900-01-31 = 음력 1900-01-01 이후 매일) ──
const start = Date.UTC(1900, 0, 31);
const end = Date.UTC(2050, 11, 31);
let sweepCount = 0;
let sweepFail = 0;
for (let t = start; t <= end; t += 86400000) {
  const d = new Date(t);
  const solar = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  const lunar = solarToLunar(solar);
  if (!lunar) { sweepFail += 1; continue; }
  const back = lunarToSolar(lunar);
  if (!back || back.year !== solar.year || back.month !== solar.month || back.day !== solar.day) {
    sweepFail += 1;
    if (sweepFail <= 3) console.log(`  FAIL sweep ${solar.year}-${solar.month}-${solar.day} → ${JSON.stringify(lunar)} → ${JSON.stringify(back)}`);
  }
  sweepCount += 1;
}
check(`전 범위 왕복 스윕 (${sweepCount.toLocaleString()}일) 항등`, sweepFail === 0, `fail=${sweepFail}`);

// ── 4. 무효 입력 ──
check('없는 윤달(2025 윤7월) → null', lunarToSolar({ year: 2025, month: 7, day: 1, isLeapMonth: true }) === null);
check('존재하는 윤달(2025 윤6월) → 유효', lunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: true }) !== null);
check('범위 밖(2051) → null', lunarToSolar({ year: 2051, month: 1, day: 1, isLeapMonth: false }) === null);
check('leapMonthOfLunarYear(2025) === 6', leapMonthOfLunarYear(2025) === 6);
check('leapMonthOfLunarYear(2024) === 0 (윤달 없음)', leapMonthOfLunarYear(2024) === 0);
check('1582-10-10 (개력 공백) → null', solarToLunar({ year: 1582, month: 10, day: 10 }) === null);

console.log(`\nKorean lunar-solar conversion: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
