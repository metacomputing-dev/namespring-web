/**
 * test/integration/kasi-lunar-solar.test.ts
 *
 * Verifies the KASI lunar-solar conversion fixture used for leap-month and
 * calendar-boundary regression coverage.
 *
 * Run: npm run test:kasi-lunar
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface LunarSolarFixture {
  readonly _meta: {
    readonly schemaVersion: string;
    readonly totalCases: number;
    readonly requiredTags: readonly string[];
    readonly dataGoKrCrossCheck?: { readonly status?: string };
    readonly sourceTier?: {
      readonly tier?: string;
      readonly authorityTruthEligible?: boolean;
    };
  };
  readonly cases: readonly LunarSolarCase[];
}

interface LunarSolarCase {
  readonly id: string;
  readonly tags: readonly string[];
  readonly solar: { readonly year: number; readonly month: number; readonly day: number; readonly iso: string };
  readonly lunar: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly isLeapMonth: boolean;
    readonly label: string;
  };
  readonly raw: {
    readonly lunLeapmonth: '평' | '윤';
    readonly solWeekKo: string;
    readonly solJd: string;
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'data/kasi-lunar-solar/kasi_lunar_solar_2025_2026_cases.json');
const MS_PER_DAY = 86_400_000;

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

function readFixture(): LunarSolarFixture {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as LunarSolarFixture;
}

function solarUtcMs(row: LunarSolarCase): number {
  return Date.parse(`${row.solar.iso}T00:00:00Z`);
}

function daysBetween(a: LunarSolarCase, b: LunarSolarCase): number {
  return (solarUtcMs(b) - solarUtcMs(a)) / MS_PER_DAY;
}

function solarIso(row: LunarSolarCase): string {
  return `${row.solar.year}-${String(row.solar.month).padStart(2, '0')}-${String(row.solar.day).padStart(2, '0')}`;
}

function lunarKey(row: LunarSolarCase): string {
  const month = String(row.lunar.month).padStart(2, '0');
  const day = String(row.lunar.day).padStart(2, '0');
  return `${row.lunar.year}-${row.lunar.isLeapMonth ? 'leap-' : ''}${month}-${day}`;
}

console.log('KASI lunar-solar fixture regression\n');

const fixture = readFixture();
const cases = fixture.cases;
const bySolar = new Map(cases.map((row) => [row.solar.iso, row]));
const byLunar = new Map(cases.map((row) => [lunarKey(row), row]));
const allTags = new Set(cases.flatMap((row) => row.tags));

check('fixture schema version is current',
  fixture._meta.schemaVersion === 'spring-ts.kasi-lunar-solar-fixture.v1');
check('fixture count matches metadata',
  cases.length === fixture._meta.totalCases && cases.length >= 13,
  `cases=${cases.length}`);
check('fixture source is authority-truth eligible for direct date facts',
  fixture._meta.sourceTier?.tier === 'T5_OFFICIAL' &&
    fixture._meta.sourceTier?.authorityTruthEligible === true);
check('data.go.kr cross-check status is explicit',
  typeof fixture._meta.dataGoKrCrossCheck?.status === 'string',
  `status=${fixture._meta.dataGoKrCrossCheck?.status ?? 'missing'}`);
check('all required boundary tags are represented',
  fixture._meta.requiredTags.every((tag) => allTags.has(tag)),
  `tags=${[...allTags].sort().join(',')}`);
check('solar ISO fields are canonical',
  cases.every((row) => row.solar.iso === solarIso(row)));
check('lunar leap raw flag matches boolean field',
  cases.every((row) => row.raw.lunLeapmonth === (row.lunar.isLeapMonth ? '윤' : '평')));
check('solar and lunar lookup keys are unique',
  bySolar.size === cases.length && byLunar.size === cases.length);

const ordinarySixEnd = bySolar.get('2025-07-24');
const leapSixStart = bySolar.get('2025-07-25');
const leapSixEnd = bySolar.get('2025-08-22');
const postLeapStart = bySolar.get('2025-08-23');
const solarYearEnd = bySolar.get('2025-12-31');
const solarYearStart = bySolar.get('2026-01-01');
const lunarYearEnd = bySolar.get('2026-02-16');
const lunarYearStart = bySolar.get('2026-02-17');
const monthEnd30 = bySolar.get('2026-05-16');
const monthStart = bySolar.get('2026-05-17');
const monthEnd29 = bySolar.get('2026-07-13');
const nextMonthStart = bySolar.get('2026-07-14');

check('ordinary month 6 end and leap month 6 start are adjacent',
  !!ordinarySixEnd && !!leapSixStart &&
    ordinarySixEnd.lunar.month === 6 &&
    ordinarySixEnd.lunar.day === 30 &&
    ordinarySixEnd.lunar.isLeapMonth === false &&
    leapSixStart.lunar.month === 6 &&
    leapSixStart.lunar.day === 1 &&
    leapSixStart.lunar.isLeapMonth === true &&
    daysBetween(ordinarySixEnd, leapSixStart) === 1);
check('leap month 6 end and ordinary month 7 start are adjacent',
  !!leapSixEnd && !!postLeapStart &&
    leapSixEnd.lunar.month === 6 &&
    leapSixEnd.lunar.day === 29 &&
    leapSixEnd.lunar.isLeapMonth === true &&
    postLeapStart.lunar.month === 7 &&
    postLeapStart.lunar.day === 1 &&
    postLeapStart.lunar.isLeapMonth === false &&
    daysBetween(leapSixEnd, postLeapStart) === 1);
check('solar year rollover preserves lunar year continuity',
  !!solarYearEnd && !!solarYearStart &&
    solarYearEnd.lunar.year === 2025 &&
    solarYearEnd.lunar.month === 11 &&
    solarYearEnd.lunar.day === 12 &&
    solarYearStart.lunar.year === 2025 &&
    solarYearStart.lunar.month === 11 &&
    solarYearStart.lunar.day === 13 &&
    daysBetween(solarYearEnd, solarYearStart) === 1);
check('lunar new year boundary is represented',
  !!lunarYearEnd && !!lunarYearStart &&
    lunarYearEnd.lunar.year === 2025 &&
    lunarYearEnd.lunar.month === 12 &&
    lunarYearEnd.lunar.day === 29 &&
    lunarYearStart.lunar.year === 2026 &&
    lunarYearStart.lunar.month === 1 &&
    lunarYearStart.lunar.day === 1 &&
    daysBetween(lunarYearEnd, lunarYearStart) === 1);
check('30-day lunar month end rolls to next month start',
  !!monthEnd30 && !!monthStart &&
    monthEnd30.lunar.day === 30 &&
    monthStart.lunar.day === 1 &&
    daysBetween(monthEnd30, monthStart) === 1);
check('29-day lunar month end rolls to next month start',
  !!monthEnd29 && !!nextMonthStart &&
    monthEnd29.lunar.day === 29 &&
    nextMonthStart.lunar.day === 1 &&
    daysBetween(monthEnd29, nextMonthStart) === 1);
check('leap and ordinary lunar keys disambiguate the same month number',
  byLunar.get('2025-leap-06-01')?.solar.iso === '2025-07-25' &&
    byLunar.get('2026-06-01')?.solar.iso === '2026-07-14');

console.log(`\nKASI lunar-solar check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
