/**
 * test/integration/calendar-input-policy.test.ts
 *
 * 감사 B1 이후 — 음력 입력은 내장 KASI/KARI 표준 테이블(1900~2050)로 양력 변환되어
 * 사주 분석이 활성화된다. 이 테스트는:
 *   1. 음력 입력(2025 윤6월 1일)이 활성 분석 + lunarConversion 기록을 갖고,
 *   2. 동일 양력 입력(2025-07-25)과 4주·일간·용신이 완전히 동등하며,
 *   3. 변환 불가 입력(범위 밖·부분 입력)만 비활성으로 남는 것
 * 을 고정한다. (과거: 음력 전면 비활성 — 그 시절 단정은 감사 B1 랜딩으로 반전됨.)
 *
 * Run: npm run test:calendar-policy
 */
import { analyzeSajuSafe } from '../../src/saju-adapter.js';

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

console.log('Calendar input policy regression (감사 B1 — 음력 변환 활성)\n');

// ── 1. 음력 입력 → 변환 후 활성 분석 (KASI 오라클: 음 2025 윤6/1 = 양 2025-07-25) ──
const lunarBirth = await analyzeSajuSafe({
  year: 2025,
  month: 6,
  day: 1,
  hour: 9,
  minute: 30,
  gender: 'female',
  calendarType: 'lunar',
  isLeapMonth: true,
  timezone: 'Asia/Seoul',
});

const lunarSummary = lunarBirth.summary as Record<string, any>;
const conversion = lunarSummary.lunarConversion as Record<string, any> | undefined;
const notes = Array.isArray(lunarSummary.partialInterpretation)
  ? lunarSummary.partialInterpretation.map(String)
  : [];

check('음력 입력이 사주 분석을 활성화한다', lunarBirth.sajuEnabled === true,
  `sajuEnabled=${lunarBirth.sajuEnabled}`);
check('일간 분석이 산출된다', lunarBirth.summary.dayMaster.element !== '');
check('lunarConversion.lunar가 입력을 보존한다',
  conversion?.lunar?.year === 2025 && conversion?.lunar?.month === 6
    && conversion?.lunar?.day === 1 && conversion?.lunar?.isLeapMonth === true,
  JSON.stringify(conversion?.lunar));
check('lunarConversion.solar = 2025-07-25 (KASI 오라클 일치)',
  conversion?.solar?.year === 2025 && conversion?.solar?.month === 7 && conversion?.solar?.day === 25,
  JSON.stringify(conversion?.solar));
check('lunarConversion.source = builtin (기본 내장 테이블)', conversion?.source === 'builtin');
check('사용자 검증 노트에 변환 내역이 있다',
  notes.some((line) => line.includes('변환') && line.includes('윤6월') && line.includes('7월 25일')),
  notes.join(' | ').slice(0, 120));

// ── 2. 동일 양력 입력과 판정 동등 ──
const solarBirth = await analyzeSajuSafe({
  year: 2025,
  month: 7,
  day: 25,
  hour: 9,
  minute: 30,
  gender: 'female',
  calendarType: 'solar',
  timezone: 'Asia/Seoul',
});

const pillarsOf = (s: any) => ['year', 'month', 'day', 'hour']
  .map((p) => `${s.pillars?.[p]?.stem?.hanja}${s.pillars?.[p]?.branch?.hanja}`).join(' ');

check('양력 등가 입력도 활성', solarBirth.sajuEnabled === true);
check('음력 입력과 양력 등가 입력의 4주가 동일',
  pillarsOf(lunarBirth.summary) === pillarsOf(solarBirth.summary),
  `lunar=[${pillarsOf(lunarBirth.summary)}] solar=[${pillarsOf(solarBirth.summary)}]`);
check('일간 동일', lunarBirth.summary.dayMaster.element === solarBirth.summary.dayMaster.element);
check('용신 동일', lunarBirth.summary.yongshin.element === solarBirth.summary.yongshin.element);
check('양력 입력 리포트에는 lunarConversion 키가 없다',
  !('lunarConversion' in (solarBirth.summary as Record<string, unknown>)));

// ── 3. 윤달 여부가 모호한 입력은 추정하지 않고 fail-closed ──
const ambiguousLeapMonth = await analyzeSajuSafe({
  year: 2025, month: 6, day: 1, hour: 9, minute: 30,
  gender: 'female', calendarType: 'lunar', timezone: 'Asia/Seoul',
});
const ambiguousSummary = ambiguousLeapMonth.summary as Record<string, any>;
check('평달·윤달이 함께 있는 월에서 윤달 플래그 누락은 fail-closed',
  ambiguousLeapMonth.sajuEnabled === false
    && ambiguousSummary.disabledReason === 'lunar-conversion-unavailable'
    && ambiguousSummary.calendarPolicy?.conversionStatus === 'ambiguous-leap-month'
    && ambiguousSummary.calendarPolicy?.leapMonth === null,
  JSON.stringify(ambiguousSummary.calendarPolicy));

const ordinaryLunar = await analyzeSajuSafe({
  year: 2025, month: 6, day: 1, hour: 9, minute: 30,
  gender: 'female', calendarType: 'lunar', isLeapMonth: false, timezone: 'Asia/Seoul',
});
const ordinaryConversion = (ordinaryLunar.summary as Record<string, any>).lunarConversion;
check('명시적 평달 플래그는 2025 음력 6월 1일을 2025-06-25로 변환',
  ordinaryLunar.sajuEnabled === true
    && ordinaryConversion?.lunar?.isLeapMonth === false
    && ordinaryConversion?.solar?.year === 2025
    && ordinaryConversion?.solar?.month === 6
    && ordinaryConversion?.solar?.day === 25,
  JSON.stringify(ordinaryConversion));
check('명시적 윤달 플래그는 동일 월일의 다른 양력 날짜를 유지',
  lunarBirth.sajuEnabled === true
    && conversion?.solar?.year === 2025
    && conversion?.solar?.month === 7
    && conversion?.solar?.day === 25);

// ── 4. 존재하지 않는 양력 날짜는 Date 정규화 전에 fail-closed ──
for (const invalidDate of [
  { year: 2025, month: 2, day: 29 },
  { year: 2025, month: 4, day: 31 },
  { year: 2024, month: 2, day: 30 },
]) {
  const result = await analyzeSajuSafe({
    ...invalidDate,
    hour: 12,
    minute: 0,
    gender: 'male',
    calendarType: 'solar',
    timezone: 'Asia/Seoul',
  });
  check(`존재하지 않는 양력 ${invalidDate.year}-${invalidDate.month}-${invalidDate.day}은 비활성`,
    result.sajuEnabled === false
      && result.analysisStatus === 'failed'
      && result.diagnostics?.[0]?.reasonCode === 'BIRTH_DATE_INVALID');
}

const validLeapDay = await analyzeSajuSafe({
  year: 2024, month: 2, day: 29, hour: 12, minute: 0,
  gender: 'female', calendarType: 'solar', timezone: 'Asia/Seoul',
});
check('실제 윤일 2024-02-29는 활성', validLeapDay.sajuEnabled === true);

for (const invalidTime of [
  { hour: 24, minute: 0 },
  { hour: -1, minute: 0 },
  { hour: 12, minute: 60 },
  { hour: '12' as unknown as number, minute: 0 },
  { hour: 12, minute: '' as unknown as number },
]) {
  const result = await analyzeSajuSafe({
    year: 2025, month: 3, day: 3,
    ...invalidTime,
    gender: 'male', calendarType: 'solar', timezone: 'Asia/Seoul',
  });
  check(`명시적으로 잘못된 시각 ${JSON.stringify(invalidTime)}은 비활성`,
    result.sajuEnabled === false
      && result.analysisStatus === 'failed'
      && result.diagnostics?.[0]?.reasonCode === 'BIRTH_TIME_INVALID');
}

const unknownTime = await analyzeSajuSafe({
  year: 2025, month: 3, day: 3, hour: null, minute: null,
  gender: 'male', calendarType: 'solar', timezone: 'Asia/Seoul',
});
check('누락 또는 null인 출생 시각만 unknown-hour 경로로 허용',
  unknownTime.sajuEnabled === true
    && unknownTime.summary.inputUncertainty?.unknownHour?.fallbackHour === 12
    && unknownTime.summary.inputUncertainty?.unknownHour?.fallbackMinute === 0);

const normalizedTarget = await analyzeSajuSafe({
  year: 2025, month: 3, day: 3, hour: 12, minute: 0,
  gender: 'male', calendarType: 'solar', timezone: 'Asia/Seoul',
});
check('잘못된 2025-02-31이 2025-03-03 사주로 정규화되지 않는다',
  normalizedTarget.sajuEnabled === true
    && normalizedTarget.summary.dayMaster.element !== '');

// ── 5. 변환 불가 음력 경로만 비활성 ──
const outOfRange = await analyzeSajuSafe({
  year: 1850, month: 1, day: 1, hour: 12, minute: 0,
  gender: 'male', calendarType: 'lunar', timezone: 'Asia/Seoul',
});
const outSummary = outOfRange.summary as Record<string, any>;
check('범위 밖(1850) 음력은 비활성', outOfRange.sajuEnabled === false);
check('범위 밖 사유 = lunar-conversion-unavailable / conversion-failed',
  outSummary.disabledReason === 'lunar-conversion-unavailable'
    && outSummary.calendarPolicy?.conversionStatus === 'conversion-failed',
  `reason=${outSummary.disabledReason}, status=${outSummary.calendarPolicy?.conversionStatus}`);

const partialLunar = await analyzeSajuSafe({
  year: 1995, month: null, day: null, hour: null, minute: null,
  gender: 'female', calendarType: 'lunar', timezone: 'Asia/Seoul',
});
const partialSummary = partialLunar.summary as Record<string, any>;
check('부분 음력 입력(연도만)은 비활성 + partial-lunar-input',
  partialLunar.sajuEnabled === false
    && partialSummary.disabledReason === 'lunar-conversion-unavailable'
    && partialSummary.calendarPolicy?.conversionStatus === 'partial-lunar-input',
  `status=${partialSummary.calendarPolicy?.conversionStatus}`);

console.log(`\nCalendar input policy check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
