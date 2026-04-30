/**
 * test/integration/jie-boundary.test.ts
 *
 * Verifies the PR7 jie-based monthly fortune boundary fix.
 *
 * For each of the 12 jie boundaries, we check that:
 *   - 'simple' mode (default) ignores the day component
 *   - 'jie_based' mode shifts to the previous fortune month when day < boundary
 *   - 'jie_based' mode keeps the current month when day >= boundary
 *
 * Run: npm run test:jie
 *      (or: npx tsx test/integration/jie-boundary.test.ts)
 */
import { getMonthlyFortuneSolar } from '../../src/report/common/fortuneCalculator.js';

interface BoundaryCase {
  readonly solarMonth: number;
  readonly jieDay: number;
  readonly description: string;
}

// Same table as fortuneCalculator's JIE_MONTH_BOUNDARY_DAY (kept inline so a
// drift between implementation and test surfaces immediately).
const BOUNDARIES: BoundaryCase[] = [
  { solarMonth:  1, jieDay: 6, description: '소한 → 축월' },
  { solarMonth:  2, jieDay: 4, description: '입춘 → 인월' },
  { solarMonth:  3, jieDay: 6, description: '경칩 → 묘월' },
  { solarMonth:  4, jieDay: 5, description: '청명 → 진월' },
  { solarMonth:  5, jieDay: 6, description: '입하 → 사월' },
  { solarMonth:  6, jieDay: 6, description: '망종 → 오월' },
  { solarMonth:  7, jieDay: 7, description: '소서 → 미월' },
  { solarMonth:  8, jieDay: 8, description: '입추 → 신월' },
  { solarMonth:  9, jieDay: 8, description: '백로 → 유월' },
  { solarMonth: 10, jieDay: 8, description: '한로 → 술월' },
  { solarMonth: 11, jieDay: 7, description: '입동 → 해월' },
  { solarMonth: 12, jieDay: 7, description: '대설 → 자월' },
];

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

console.log('PR7 jie-boundary — fortuneCascadeMode wiring\n');

const TEST_YEAR = 2026;

for (const { solarMonth, jieDay, description } of BOUNDARIES) {
  const dayBefore = jieDay - 1;
  const dayAfter  = jieDay + 1;

  // simple mode (default) ignores `day` — `dayBefore` and `dayAfter` produce
  // the same ganzhi, equal to the legacy approximation.
  const simpleBefore = getMonthlyFortuneSolar(TEST_YEAR, solarMonth, { day: dayBefore, mode: 'simple' });
  const simpleAfter  = getMonthlyFortuneSolar(TEST_YEAR, solarMonth, { day: dayAfter,  mode: 'simple' });
  const simpleNoDay  = getMonthlyFortuneSolar(TEST_YEAR, solarMonth);

  check(`simple mode ignores day for ${solarMonth}월 (${description})`,
    simpleBefore.ganzhiHangul === simpleAfter.ganzhiHangul && simpleBefore.ganzhiHangul === simpleNoDay.ganzhiHangul,
    `${simpleBefore.ganzhiHangul}=${simpleAfter.ganzhiHangul}=${simpleNoDay.ganzhiHangul}`);

  // jie_based mode: dayBefore should yield the PREVIOUS fortune month, while
  // dayAfter stays on the current one.
  const jieBefore = getMonthlyFortuneSolar(TEST_YEAR, solarMonth, { day: dayBefore, mode: 'jie_based' });
  const jieAfter  = getMonthlyFortuneSolar(TEST_YEAR, solarMonth, { day: dayAfter,  mode: 'jie_based' });

  check(`jie_based mode: ${solarMonth}월 ${dayAfter}일 ≡ simple ${solarMonth}월 (after boundary)`,
    jieAfter.ganzhiHangul === simpleNoDay.ganzhiHangul,
    `after-boundary day stays on current fortune month`);

  check(`jie_based mode: ${solarMonth}월 ${dayBefore}일 ≠ ${solarMonth}월 ${dayAfter}일 (boundary effect)`,
    jieBefore.ganzhiHangul !== jieAfter.ganzhiHangul,
    `${jieBefore.ganzhiHangul} vs ${jieAfter.ganzhiHangul}`);
}

// Bonus check: the year-shift edge — 1월 1-5일 → previous year's 자월
const earlyJan = getMonthlyFortuneSolar(2026, 1, { day: 3, mode: 'jie_based' });
check('1월 3일 jie_based → previous year (year shift across 소한 boundary)',
  earlyJan.year === 2025,
  `year=${earlyJan.year} (expected 2025)`);

console.log(`\nJie-boundary check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
