/**
 * test/integration/calendar-input-policy.test.ts
 *
 * Guards user birthdate normalization when a caller submits lunar-calendar
 * input. Until a production KASI lunar-solar conversion layer is integrated,
 * the adapter must not silently treat lunar dates as Gregorian solar dates.
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

console.log('Calendar input policy regression\n');

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
const partialBirthInput = lunarSummary.partialBirthInput as Record<string, unknown> | undefined;
const calendarPolicy = lunarSummary.calendarPolicy as Record<string, unknown> | undefined;
const notes = Array.isArray(lunarSummary.partialInterpretation)
  ? lunarSummary.partialInterpretation.map(String)
  : [];

check('lunar input keeps saju disabled until conversion is integrated',
  lunarBirth.sajuEnabled === false,
  `sajuEnabled=${lunarBirth.sajuEnabled}`);
check('lunar input does not produce a day-master analysis',
  lunarBirth.summary.dayMaster.element === '');
check('disabled reason is explicit',
  lunarSummary.disabledReason === 'lunar-input-requires-kasi-conversion',
  `reason=${String(lunarSummary.disabledReason ?? 'missing')}`);
check('partial birth input preserves lunar calendar flag',
  partialBirthInput?.calendarType === 'lunar');
check('partial birth input preserves leap-month flag',
  partialBirthInput?.isLeapMonth === true);
check('calendar policy names KASI conversion dependency',
  calendarPolicy?.inputCalendar === 'lunar' &&
    calendarPolicy?.conversionRequired === 'KASI LrsrCldInfoService' &&
    calendarPolicy?.conversionStatus === 'not-integrated');
check('user-facing note explains why analysis is disabled',
  notes.some((line) => line.includes('KASI') && line.includes('음양력') && line.includes('비활성화')));

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

check('equivalent solar input still reaches saju-ts analysis',
  solarBirth.sajuEnabled === true,
  `sajuEnabled=${solarBirth.sajuEnabled}`);
check('solar input and unsupported lunar input cannot be silently confused',
  solarBirth.summary.dayMaster.element !== lunarBirth.summary.dayMaster.element);

console.log(`\nCalendar input policy check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
