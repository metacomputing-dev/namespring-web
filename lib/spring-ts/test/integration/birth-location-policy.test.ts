import assert from 'node:assert/strict';

import {
  KOREA_REGION_COORDINATES,
  KOREA_REGION_PRIMARY_ALIASES,
} from '../../src/region-coordinates.js';
import { resolveBirthLocation } from '../../src/saju/birth-location.js';
import {
  isLongitudeCorrectionEnabled,
  isValidSajuTimePolicy,
  legacyTimeFailureReasonCode,
  preflightKnownHourCivilTimeRange,
  requiresExplicitBirthLocationForTimePolicy,
  resolveEffectiveSajuTimePolicy,
  toLegacySajuTimePolicyConfig,
} from '../../src/saju/time-policy.js';

const defaults = {
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
  regionCode: 'SEOUL',
} as const;

function resolve(birth: any, requireLongitude = true) {
  return resolveBirthLocation(birth, defaults, { requireLongitude });
}

const seoulRegistryEntry = KOREA_REGION_COORDINATES
  .find((region) => region.code === 'SEOUL');
assert.ok(seoulRegistryEntry);
assert.equal(Object.isFrozen(KOREA_REGION_COORDINATES), true);
assert.equal(Object.isFrozen(seoulRegistryEntry), true);
assert.equal(Object.isFrozen(seoulRegistryEntry.aliases), true);
assert.equal(Object.isFrozen(KOREA_REGION_PRIMARY_ALIASES), true);
assert.throws(() => {
  (seoulRegistryEntry as { longitude: number }).longitude = 0;
}, TypeError);
assert.throws(() => {
  (seoulRegistryEntry.aliases as string[]).push('POISON');
}, TypeError);
assert.throws(() => {
  (KOREA_REGION_COORDINATES as unknown as Array<{ code: string }>).splice(0, 1);
}, TypeError);
assert.throws(() => {
  (KOREA_REGION_PRIMARY_ALIASES as string[]).push('POISON');
}, TypeError);

const defaultLocation = resolve({ gender: 'male' });
assert.equal(defaultLocation.ok, true);
assert.deepEqual(defaultLocation.ok ? defaultLocation.value : null, {
  ...defaults,
  source: 'default',
});
assert.deepEqual(
  resolveBirthLocation(
    { gender: 'male' },
    defaults,
    { requireLongitude: true, requireExplicitLocation: true },
  ),
  { ok: false, reasonCode: 'BIRTH_LOCATION_REQUIRED' },
);
assert.deepEqual(
  resolveBirthLocation(
    { gender: 'male', timezone: 'Asia/Seoul' },
    defaults,
    { requireLongitude: true, requireExplicitLocation: true },
  ),
  { ok: false, reasonCode: 'BIRTH_LOCATION_REQUIRED' },
);

const daegu = resolve({ gender: 'female', birthPlace: '대구 수성구' });
assert.equal(daegu.ok, true);
assert.equal(daegu.ok ? daegu.value.regionCode : null, 'DAEGU');
assert.equal(daegu.ok ? daegu.value.timezone : null, 'Asia/Seoul');

const seoulCode = resolve({ gender: 'male', region: 'Seoul' });
assert.equal(seoulCode.ok ? seoulCode.value.regionCode : null, 'SEOUL');
assert.equal(seoulCode.ok ? seoulCode.value.longitude : null, defaults.longitude);
const explicitPolicySeoul = resolveBirthLocation(
  { gender: 'male', region: '서울' },
  defaults,
  { requireLongitude: true, requireExplicitLocation: true },
);
assert.equal(explicitPolicySeoul.ok ? explicitPolicySeoul.value.source : null, 'region');

const duplicateSeoulFields = resolve({
  gender: 'male',
  region: '서울',
  city: '서울특별시',
});
assert.equal(duplicateSeoulFields.ok ? duplicateSeoulFields.value.regionCode : null, 'SEOUL');

assert.deepEqual(
  resolve({ gender: 'male', region: '서울', city: '부산' }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_CONFLICT' },
);

const nameIsNotLocation = resolve({ gender: 'male', name: '부산' });
assert.equal(nameIsNotLocation.ok ? nameIsNotLocation.value.regionCode : null, 'SEOUL');

assert.deepEqual(
  resolve({ gender: 'male', longitude: 127 }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_PARTIAL' },
);
assert.deepEqual(
  resolve({
    gender: 'male',
    region: '서울',
    latitude: 40.7128,
    longitude: -74.006,
  }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_PARTIAL' },
);
assert.deepEqual(
  resolve({
    gender: 'male',
    region: 'Seoul',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'Asia/Seoul',
  }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_CONFLICT' },
  'a supported Korean region label cannot be combined with unmistakably overseas coordinates',
);
const explicitCanonicalSeoul = resolve({
  gender: 'male',
  region: 'Seoul',
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
});
assert.equal(explicitCanonicalSeoul.ok ? explicitCanonicalSeoul.value.source : null, 'explicit');
assert.deepEqual(
  resolve({
    gender: 'male',
    region: 'Seoul',
    latitude: 37.57,
    longitude: 126.99,
    timezone: 'Asia/Seoul',
  }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_CONFLICT' },
  'a region label selects its canonical registry tuple; arbitrary GPS input must omit the label',
);
assert.deepEqual(
  resolve({
    gender: 'male',
    region: 'Seoul',
    latitude: 36.3504,
    longitude: 127.3845,
    timezone: 'Asia/Seoul',
  }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_CONFLICT' },
  'the registered center of another supported region cannot retain a Seoul region code',
);
assert.deepEqual(
  resolve({ gender: 'male', latitude: '37.5', longitude: 127 } as any),
  { ok: false, reasonCode: 'BIRTH_LOCATION_INVALID' },
);
assert.deepEqual(
  resolve({ gender: 'male', latitude: 91, longitude: 127 }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_INVALID' },
);
assert.deepEqual(
  resolve({ gender: 'male', timezone: 'America/New_York' }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_PARTIAL' },
);
assert.deepEqual(
  resolve({ gender: 'male', birthPlace: 'New York' }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_UNRESOLVED' },
);
assert.deepEqual(
  resolve({ gender: 'male', region: '서울', timezone: 'Europe/London' }),
  { ok: false, reasonCode: 'BIRTH_LOCATION_TIMEZONE_MISMATCH' },
);

const fullNewYork = resolve({
  gender: 'male',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
  birthPlace: 'New York',
});
assert.equal(fullNewYork.ok, true);
assert.equal(fullNewYork.ok ? fullNewYork.value.source : null, 'explicit');
const explicitPolicyNewYork = resolveBirthLocation({
  gender: 'male',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
}, defaults, { requireLongitude: true, requireExplicitLocation: true });
assert.equal(explicitPolicyNewYork.ok ? explicitPolicyNewYork.value.source : null, 'explicit');

const timezoneOnlyWhenLongitudeOff = resolve({
  gender: 'male',
  timezone: 'America/New_York',
}, false);
assert.equal(timezoneOnlyWhenLongitudeOff.ok, true);
assert.equal(
  timezoneOnlyWhenLongitudeOff.ok ? timezoneOnlyWhenLongitudeOff.value.source : null,
  'timezone',
);

assert.equal(isLongitudeCorrectionEnabled(undefined), true);
assert.equal(isLongitudeCorrectionEnabled({ sajuTimePolicy: { longitudeCorrection: 'off' } } as any), false);
assert.equal(isValidSajuTimePolicy(undefined), true);
assert.equal(isValidSajuTimePolicy({ sajuTimePolicy: { longitudeReference: 'legacyPreset' } } as any), true);
assert.equal(isValidSajuTimePolicy({ sajuTimePolicy: { longitudeCorrection: 'maybe' } } as any), false);
assert.equal(isValidSajuTimePolicy({ sajuTimePolicy: { longitudeReference: 'raw' } } as any), false);
assert.equal(isValidSajuTimePolicy({ sajuTimePolicy: null } as any), false);
assert.equal(requiresExplicitBirthLocationForTimePolicy(undefined), false);
assert.equal(requiresExplicitBirthLocationForTimePolicy({
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off' },
} as any), false);
assert.equal(requiresExplicitBirthLocationForTimePolicy({
  sajuTimePolicy: { trueSolarTime: 'on', longitudeCorrection: 'off' },
} as any), false);
assert.equal(requiresExplicitBirthLocationForTimePolicy({
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'on' },
} as any), true);
assert.equal(requiresExplicitBirthLocationForTimePolicy({
  sajuTimePolicy: { longitudeReference: 'legacyPreset' },
} as any), true);
assert.equal(requiresExplicitBirthLocationForTimePolicy({
  sajuTimePolicy: { longitudeReference: 'civilOffsetMeridian' },
} as any), true);
assert.equal(requiresExplicitBirthLocationForTimePolicy({
  sajuTimePolicy: {
    longitudeCorrection: 'off',
    longitudeReference: 'legacyPreset',
  },
} as any), false);
assert.deepEqual(resolveEffectiveSajuTimePolicy(undefined), {
  trueSolarTime: 'off',
  longitudeCorrection: 'on',
  longitudeReference: 'civilOffsetMeridian',
  explicitLocationRequired: false,
  yaza: 'on',
  yazaMode: '23:00',
});
assert.deepEqual(resolveEffectiveSajuTimePolicy({
  sajuTimePolicy: {
    trueSolarTime: 'on',
    longitudeCorrection: 'off',
    longitudeReference: 'legacyPreset',
    yaza: 'off',
    yazaMode: '23:30',
  },
} as any), {
  trueSolarTime: 'on',
  longitudeCorrection: 'off',
  longitudeReference: 'off',
  explicitLocationRequired: false,
  yaza: 'off',
  yazaMode: '23:30',
});

assert.deepEqual(toLegacySajuTimePolicyConfig(undefined), {
  trueSolarTimeEnabled: true,
  includeEquationOfTime: false,
  longitudeCorrectionPolicy: { mode: 'civilOffsetMeridian' },
  yazaEnabled: true,
  yazaMode: 'YAZA_23_TO_01_NEXTDAY',
  dayCutMode: 'YAZA_23_TO_01_NEXTDAY',
});

const legacyPreset = toLegacySajuTimePolicyConfig({
  sajuTimePolicy: { longitudeReference: 'legacyPreset' },
} as any, 135);
assert.deepEqual(
  legacyPreset.longitudeCorrectionPolicy,
  { mode: 'fixedMeridian', meridianDeg: 135 },
);

assert.deepEqual(toLegacySajuTimePolicyConfig({
  sajuTimePolicy: {
    trueSolarTime: 'on',
    longitudeCorrection: 'off',
    yaza: 'off',
  },
} as any), {
  trueSolarTimeEnabled: true,
  includeEquationOfTime: true,
  longitudeCorrectionPolicy: { mode: 'off' },
  yazaEnabled: false,
  dayCutMode: 'MIDNIGHT_00',
});

const visitedMinutes: number[] = [];
assert.deepEqual(preflightKnownHourCivilTimeRange({
  year: 2024,
  month: 1,
  day: 15,
  hour: 12,
  timeZone: 'Asia/Seoul',
  resolveOffsetMinutes: (_timeZone, civil) => {
    visitedMinutes.push(civil.min);
    return 540;
  },
}), { ok: true });
assert.deepEqual(visitedMinutes, Array.from({ length: 60 }, (_unused, minute) => minute));

function codedError(code: string): Error & { readonly code: string } {
  return Object.assign(new Error(code), { code });
}

assert.deepEqual(preflightKnownHourCivilTimeRange({
  year: 1916,
  month: 7,
  day: 28,
  hour: 0,
  timeZone: 'Europe/Athens',
  resolveOffsetMinutes: (_timeZone, civil) => {
    if (civil.min === 10) throw codedError('SAJU_LEGACY_TIME_NONEXISTENT');
    return civil.min < 10 ? 95 : 120;
  },
}), { ok: false, reasonCode: 'BIRTH_TIME_RANGE_TRANSITION' });

assert.deepEqual(preflightKnownHourCivilTimeRange({
  year: 2024,
  month: 11,
  day: 3,
  hour: 1,
  timeZone: 'America/New_York',
  resolveOffsetMinutes: (_timeZone, civil) => {
    if (civil.min === 30) throw codedError('SAJU_LEGACY_TIME_AMBIGUOUS');
    return -300;
  },
}), { ok: false, reasonCode: 'BIRTH_TIME_RANGE_TRANSITION' });

assert.equal(
  legacyTimeFailureReasonCode(codedError('SAJU_LEGACY_TIMEZONE_DATA_UNSUPPORTED')),
  'BIRTH_TIMEZONE_DATA_UNSUPPORTED',
);

console.log('PASS: atomic birth-location and Spring time-policy contracts');
