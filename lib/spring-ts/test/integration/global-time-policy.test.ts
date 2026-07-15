import assert from 'node:assert/strict';

import { analyzeSajuSafe } from '../../src/saju-adapter.js';
import type { BirthInfo, SpringOptions } from '../../src/types.js';

const BASE = {
  year: 2024,
  month: 1,
  day: 15,
  hour: 12,
  minute: 0,
  gender: 'male',
  calendarType: 'solar',
} as const;

const CIVIL_LONGITUDE_POLICY = {
  sajuTimePolicy: {
    trueSolarTime: 'off',
    longitudeCorrection: 'on',
    yaza: 'off',
  },
} as const;

function near(actual: number, expected: number, tolerance = 0.01): boolean {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
}

async function analyze(
  birth: BirthInfo,
  options: SpringOptions = CIVIL_LONGITUDE_POLICY,
) {
  return analyzeSajuSafe(birth, options);
}

async function expectCorrection(
  label: string,
  birth: BirthInfo,
  expected: number,
  options: SpringOptions = CIVIL_LONGITUDE_POLICY,
): Promise<void> {
  const result = await analyze(birth, options);
  assert.equal(
    result.sajuEnabled,
    true,
    label + ': ' + JSON.stringify(result.diagnostics ?? []),
  );
  const actual = Number(result.summary.timeCorrection.longitudeCorrectionMinutes);
  assert.equal(near(actual, expected), true, label + ': expected ' + expected + ', got ' + actual);
}

const globalWinterCases = [
  ['Seoul', 'Asia/Seoul', 37.5665, 126.978, -32.088],
  ['Tokyo', 'Asia/Tokyo', 35.6762, 139.6503, 18.6012],
  ['Beijing', 'Asia/Shanghai', 39.9042, 116.4074, -14.3704],
  ['Shanghai', 'Asia/Shanghai', 31.2304, 121.4737, 5.8948],
  ['New York', 'America/New_York', 40.7128, -74.006, 3.976],
  ['London', 'Europe/London', 51.5072, -0.1276, -0.5104],
  ['Los Angeles', 'America/Los_Angeles', 34.0522, -118.2437, 7.0252],
  ['Sydney', 'Australia/Sydney', -33.8688, 151.2093, -55.1628],
] as const;

for (const [label, timezone, latitude, longitude, expected] of globalWinterCases) {
  await expectCorrection(label, {
    ...BASE,
    timezone,
    latitude,
    longitude,
    birthPlace: label,
  }, expected);
}

const newYork = {
  ...BASE,
  timezone: 'America/New_York',
  latitude: 40.7128,
  longitude: -74.006,
  birthPlace: 'New York',
} satisfies BirthInfo;
for (const schoolPreset of ['korean', 'chinese', 'modern'] as const) {
  await expectCorrection(
    'New York is independent from ' + schoolPreset + ' school',
    newYork,
    3.976,
    { ...CIVIL_LONGITUDE_POLICY, schoolPreset },
  );
}
await expectCorrection('New York DST', { ...newYork, month: 7 }, -56.024);

const modernSeoul = {
  ...BASE,
  timezone: 'Asia/Seoul',
  latitude: 37.5665,
  longitude: 126.978,
  birthPlace: 'Seoul',
} satisfies BirthInfo;
await expectCorrection(
  'modern Seoul civil correction is independent from Chinese interpretation preset',
  modernSeoul,
  -32.088,
  { ...CIVIL_LONGITUDE_POLICY, schoolPreset: 'chinese' },
);
await expectCorrection(
  'Chinese legacy preset remains an explicit 120-degree compatibility option',
  modernSeoul,
  27.912,
  {
    schoolPreset: 'chinese',
    sajuTimePolicy: {
      ...CIVIL_LONGITUDE_POLICY.sajuTimePolicy,
      longitudeReference: 'legacyPreset',
    },
  },
);

const RAW_TIME_OFF_OVERRIDE = {
  trueSolarTimeEnabled: false,
  includeEquationOfTime: false,
  longitudeCorrectionPolicy: { mode: 'off' },
  calendar: {
    dayBoundary: 'midnight',
    hourStemDayBoundary: 'midnight',
    dayCutShiftMinutes: 0,
    trueSolarTime: {
      enabled: false,
      longitudeCorrectionPolicy: { mode: 'off' },
      equationOfTime: 'off',
      applyTo: 'hourOnly',
    },
  },
} as const;

for (const [schoolPreset, expected] of [
  ['korean', -32.088],
  ['modern', -32.088],
  ['chinese', 27.912],
] as const) {
  await expectCorrection(
    schoolPreset + ' legacy meridian survives raw nested-off override',
    modernSeoul,
    expected,
    {
      schoolPreset,
      sajuTimePolicy: {
        ...CIVIL_LONGITUDE_POLICY.sajuTimePolicy,
        longitudeReference: 'legacyPreset',
      },
      sajuConfig: RAW_TIME_OFF_OVERRIDE,
    },
  );
}

const historicalSeoulCases = [
  [1907, 6, 15, -0.088],
  [1954, 7, 15, -2.088],
  [1957, 7, 15, -62.088],
  [1988, 7, 15, -92.088],
  [1989, 7, 15, -32.088],
] as const;
for (const [year, month, day, expected] of historicalSeoulCases) {
  await expectCorrection('Seoul historical offset ' + year, {
    ...BASE,
    year,
    month,
    day,
    timezone: 'Asia/Seoul',
    latitude: 37.5665,
    longitude: 126.978,
    birthPlace: 'Seoul',
  }, expected);
}

await expectCorrection(
  'explicit legacy preset keeps the former 1988 Korean baseline',
  {
    ...BASE,
    year: 1988,
    month: 7,
    timezone: 'Asia/Seoul',
    latitude: 37.5665,
    longitude: 126.978,
  },
  -32.088,
  {
    sajuTimePolicy: {
      ...CIVIL_LONGITUDE_POLICY.sajuTimePolicy,
      longitudeReference: 'legacyPreset',
    },
    schoolPreset: 'korean',
  },
);

await expectCorrection(
  'UTC+14 dateline correction off is exactly zero',
  {
    ...BASE,
    timezone: 'Pacific/Kiritimati',
    latitude: 1.8721,
    longitude: -157.4278,
  },
  0,
  {
    sajuTimePolicy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'off',
      yaza: 'off',
    },
  },
);

async function expectFailure(
  label: string,
  birth: BirthInfo,
  reasonCode: string,
  options: SpringOptions = CIVIL_LONGITUDE_POLICY,
): Promise<void> {
  const result = await analyze(birth, options);
  assert.equal(result.sajuEnabled, false, label + ': unexpectedly enabled');
  assert.equal(
    result.diagnostics?.[0]?.reasonCode,
    reasonCode,
    label + ': ' + JSON.stringify(result.diagnostics ?? []),
  );
}

await expectFailure(
  'timezone-only input cannot borrow Seoul longitude',
  { ...BASE, timezone: 'America/New_York' },
  'BIRTH_LOCATION_PARTIAL',
);
await expectFailure(
  'coordinate-only input cannot borrow Seoul timezone',
  { ...BASE, latitude: 40.7128, longitude: -74.006 },
  'BIRTH_LOCATION_PARTIAL',
);
await expectFailure(
  'unknown place cannot silently become Seoul',
  { ...BASE, birthPlace: 'New York' },
  'BIRTH_LOCATION_UNRESOLVED',
);
await expectFailure(
  'conflicting public location fields cannot silently select the first region',
  { ...BASE, region: '서울', city: '부산' },
  'BIRTH_LOCATION_CONFLICT',
);
await expectFailure(
  'invalid runtime time-policy values cannot silently become defaults',
  BASE,
  'BIRTH_TIME_POLICY_INVALID',
  { sajuTimePolicy: { longitudeCorrection: 'maybe' } } as any,
);

const timezoneOnlyOff = await analyze(
  { ...BASE, timezone: 'America/New_York' },
  {
    sajuTimePolicy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'off',
      yaza: 'off',
    },
  },
);
assert.equal(timezoneOnlyOff.sajuEnabled, true, JSON.stringify(timezoneOnlyOff.diagnostics ?? []));
assert.equal(timezoneOnlyOff.summary.timeCorrection.longitudeCorrectionMinutes, 0);

const rawTimePolicyBypassAttempt = await analyze(
  { ...BASE, timezone: 'America/New_York' },
  {
    sajuTimePolicy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'off',
      yaza: 'off',
    },
    sajuConfig: {
      trueSolarTimeEnabled: true,
      includeEquationOfTime: true,
      longitudeCorrectionPolicy: {
        mode: 'fixedMeridian',
        meridianDeg: 135,
      },
      yazaEnabled: true,
      dayCutMode: 'YAZA_23_30_TO_01_30_NEXTDAY',
      calendar: {
        dayBoundary: 'ziSplit23',
        hourStemDayBoundary: 'ziSplit23',
        dayCutShiftMinutes: -30,
        trueSolarTime: {
          enabled: true,
          longitudeCorrectionPolicy: {
            mode: 'fixedMeridian',
            meridianDeg: 135,
          },
          equationOfTime: 'precise',
          applyTo: 'dayAndHour',
        },
      },
    },
  },
);
assert.equal(
  rawTimePolicyBypassAttempt.sajuEnabled,
  true,
  JSON.stringify(rawTimePolicyBypassAttempt.diagnostics ?? []),
);
assert.equal(
  rawTimePolicyBypassAttempt.summary.timeCorrection.longitudeCorrectionMinutes,
  0,
);
assert.equal(
  rawTimePolicyBypassAttempt.summary.timeCorrection.equationOfTimeMinutes,
  0,
);
assert.equal(rawTimePolicyBypassAttempt.summary.timeCorrection.adjustedHour, 12);
assert.equal(rawTimePolicyBypassAttempt.summary.timeCorrection.adjustedMinute, 0);

await expectCorrection(
  'product longitude-on survives raw top-level and nested off',
  newYork,
  3.976,
  {
    ...CIVIL_LONGITUDE_POLICY,
    sajuConfig: RAW_TIME_OFF_OVERRIDE,
  },
);

await expectFailure(
  'raw longitude-off cannot bypass product partial-location gate',
  { ...BASE, timezone: 'America/New_York' },
  'BIRTH_LOCATION_PARTIAL',
  {
    ...CIVIL_LONGITUDE_POLICY,
    sajuConfig: RAW_TIME_OFF_OVERRIDE,
  },
);

await expectFailure(
  'New York DST gap',
  { ...newYork, month: 3, day: 10, hour: 2, minute: 30 },
  'BIRTH_TIME_NONEXISTENT',
);
await expectFailure(
  'New York DST fold',
  { ...newYork, month: 11, day: 3, hour: 1, minute: 30 },
  'BIRTH_TIME_AMBIGUOUS',
);
await expectFailure(
  'historical Athens missing-minute range contains a DST gap',
  {
    ...BASE,
    year: 1916,
    month: 7,
    day: 28,
    hour: 0,
    minute: undefined,
    timezone: 'Europe/Athens',
    latitude: 37.9838,
    longitude: 23.7275,
    birthPlace: 'Athens',
  },
  'BIRTH_TIME_RANGE_TRANSITION',
);

console.log('PASS: global longitude, historical offset, location, and DST contracts');
