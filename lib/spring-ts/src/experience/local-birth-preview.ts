import {
  lunarToSolar,
  solarToLunar,
  type SolarDate,
} from '../calendar/korean-lunar-calendar.js';
import { snapshotCandidateSearchRequestV1 } from '../public-request-snapshot.js';
import {
  LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
  type LocalBirthInputV1,
  type LocalBirthPreviewV1,
} from './local-menu-types.js';
import {
  MAX_LOCATION_TEXT_LENGTH,
  MAX_TIMEZONE_LENGTH,
  assertLocalDataObject,
  failLocalMenu,
  formatLocalDate,
  freezeLocalOwned,
  isBoundedCanonicalText,
  isValidSolarDate,
  parseCanonicalLocalDateText,
} from './local-menu-primitives.js';

function solarEquivalentOf(birth: LocalBirthInputV1): SolarDate | null {
  if (birth.calendarType === 'solar') {
    return isValidSolarDate(birth.year, birth.month, birth.day)
      ? { year: birth.year, month: birth.month, day: birth.day }
      : null;
  }
  return lunarToSolar({
    year: birth.year,
    month: birth.month,
    day: birth.day,
    isLeapMonth: birth.isLeapMonth,
  });
}

export function assertLocalBirthInputV1(
  value: unknown,
): asserts value is LocalBirthInputV1 {
  assertLocalDataObject(value, [
    'year', 'month', 'day', 'hour', 'minute', 'gender', 'calendarType',
    'isLeapMonth', 'region', 'city', 'birthPlace', 'timezone', 'latitude', 'longitude',
  ], 'INVALID_BIRTH');
  if (!Number.isSafeInteger(value.year)
    || (value.year as number) < 1
    || (value.year as number) > 9_999
    || !Number.isSafeInteger(value.month)
    || (value.month as number) < 1
    || (value.month as number) > 12
    || !Number.isSafeInteger(value.day)
    || (value.day as number) < 1
    || (value.day as number) > 31
    || (value.hour !== null
      && (!Number.isSafeInteger(value.hour)
        || (value.hour as number) < 0
        || (value.hour as number) > 23))
    || (value.minute !== null
      && (!Number.isSafeInteger(value.minute)
        || (value.minute as number) < 0
        || (value.minute as number) > 59))
    || (value.hour === null) !== (value.minute === null)
    || (value.gender !== 'male' && value.gender !== 'female' && value.gender !== 'neutral')
    || (value.calendarType !== 'solar' && value.calendarType !== 'lunar')
    || typeof value.isLeapMonth !== 'boolean'
    || (value.calendarType === 'solar' && value.isLeapMonth)
    || (value.latitude !== undefined
      && (typeof value.latitude !== 'number'
        || !Number.isFinite(value.latitude)
        || value.latitude < -90
        || value.latitude > 90))
    || (value.longitude !== undefined
      && (typeof value.longitude !== 'number'
        || !Number.isFinite(value.longitude)
        || value.longitude < -180
        || value.longitude > 180))) {
    failLocalMenu('INVALID_BIRTH');
  }
  for (const key of ['region', 'city', 'birthPlace'] as const) {
    const raw = value[key];
    if (raw !== undefined && !isBoundedCanonicalText(raw, MAX_LOCATION_TEXT_LENGTH)) {
      failLocalMenu('INVALID_BIRTH');
    }
  }
  if (value.timezone !== undefined
    && !isBoundedCanonicalText(value.timezone, MAX_TIMEZONE_LENGTH)) {
    failLocalMenu('INVALID_BIRTH');
  }
  if (!solarEquivalentOf(value as unknown as LocalBirthInputV1)) {
    failLocalMenu('INVALID_BIRTH');
  }
}

function locationPreview(birth: LocalBirthInputV1): LocalBirthPreviewV1['location'] {
  const hasLocation = birth.region !== undefined
    || birth.city !== undefined
    || birth.birthPlace !== undefined
    || birth.timezone !== undefined
    || birth.latitude !== undefined
    || birth.longitude !== undefined;
  if (!hasLocation) return { status: 'not_provided' };
  return {
    status: 'provided',
    ...(birth.region !== undefined ? { region: birth.region } : {}),
    ...(birth.city !== undefined ? { city: birth.city } : {}),
    ...(birth.birthPlace !== undefined ? { birthPlace: birth.birthPlace } : {}),
    ...(birth.timezone !== undefined ? { timezone: birth.timezone } : {}),
    ...(birth.latitude !== undefined ? { latitude: birth.latitude } : {}),
    ...(birth.longitude !== undefined ? { longitude: birth.longitude } : {}),
  };
}

export function buildLocalBirthPreviewV1(
  input: LocalBirthInputV1,
): LocalBirthPreviewV1 {
  const snapshot = snapshotCandidateSearchRequestV1(
    input as unknown as Parameters<typeof snapshotCandidateSearchRequestV1>[0],
  ) as unknown as LocalBirthInputV1;
  assertLocalBirthInputV1(snapshot);
  const solarEquivalent = solarEquivalentOf(snapshot)!;
  const knownTime = snapshot.hour !== null && snapshot.minute !== null;
  const preview: LocalBirthPreviewV1 = {
    schemaVersion: LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
    computation: 'local_only',
    calendar: {
      inputType: snapshot.calendarType,
      inputDate: formatLocalDate(snapshot),
      isLeapMonth: snapshot.isLeapMonth,
      ...(snapshot.calendarType === 'lunar'
        ? { solarEquivalent: formatLocalDate(solarEquivalent) }
        : {}),
      conversion: snapshot.calendarType === 'lunar'
        ? 'builtin_korean_lunar_calendar'
        : 'not_required',
    },
    time: knownTime
      ? { precision: 'exact', hour: snapshot.hour!, minute: snapshot.minute! }
      : { precision: 'unknown' },
    gender: snapshot.gender,
    location: locationPreview(snapshot),
    constraints: {
      timeSensitiveAnalysis: knownTime ? 'available' : 'limited_unknown_time',
      genderDependentFortune: snapshot.gender === 'neutral'
        ? 'unavailable_without_explicit_gender_basis'
        : 'available',
    },
    provenance: {
      input: 'user_supplied',
      lunarConversion: 'builtin_only',
      remoteLookup: 'forbidden',
    },
  };
  assertLocalBirthPreviewV1(preview);
  return freezeLocalOwned(preview);
}

export function assertLocalBirthPreviewV1(
  value: unknown,
): asserts value is LocalBirthPreviewV1 {
  assertLocalDataObject(value, [
    'schemaVersion', 'computation', 'calendar', 'time', 'gender', 'location',
    'constraints', 'provenance',
  ]);
  if (value.schemaVersion !== LOCAL_BIRTH_PREVIEW_SCHEMA_V1
    || value.computation !== 'local_only'
    || !['male', 'female', 'neutral'].includes(String(value.gender))) {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.calendar, [
    'inputType', 'inputDate', 'isLeapMonth', 'solarEquivalent', 'conversion',
  ], 'CONTRACT_INVALID');
  const inputDate = parseCanonicalLocalDateText(value.calendar.inputDate);
  if ((value.calendar.inputType !== 'solar' && value.calendar.inputType !== 'lunar')
    || inputDate === null
    || typeof value.calendar.isLeapMonth !== 'boolean'
    || (value.calendar.inputType === 'solar'
      && (!isValidSolarDate(inputDate.year, inputDate.month, inputDate.day)
        || value.calendar.isLeapMonth
        || value.calendar.solarEquivalent !== undefined
        || value.calendar.conversion !== 'not_required'))
    || (value.calendar.inputType === 'lunar'
      && (inputDate.month < 1
        || inputDate.month > 12
        || inputDate.day < 1
        || inputDate.day > 30
        || parseCanonicalLocalDateText(value.calendar.solarEquivalent) === null
        || value.calendar.conversion !== 'builtin_korean_lunar_calendar'))) {
    failLocalMenu('CONTRACT_INVALID');
  }
  if (value.calendar.inputType === 'lunar') {
    const converted = lunarToSolar({
      ...inputDate,
      isLeapMonth: value.calendar.isLeapMonth,
    });
    const convertedBack = converted === null ? null : solarToLunar(converted);
    if (converted === null
      || formatLocalDate(converted) !== value.calendar.solarEquivalent
      || convertedBack === null
      || convertedBack.year !== inputDate.year
      || convertedBack.month !== inputDate.month
      || convertedBack.day !== inputDate.day
      || convertedBack.isLeapMonth !== value.calendar.isLeapMonth) {
      failLocalMenu('CONTRACT_INVALID');
    }
  }
  assertLocalDataObject(value.time, ['precision', 'hour', 'minute'], 'CONTRACT_INVALID');
  const exactTime = value.time.precision === 'exact';
  const hour = value.time.hour;
  const minute = value.time.minute;
  if ((!exactTime && value.time.precision !== 'unknown')
    || (exactTime
      ? (typeof hour !== 'number'
        || !Number.isInteger(hour)
        || hour < 0
        || hour > 23
        || typeof minute !== 'number'
        || !Number.isInteger(minute)
        || minute < 0
        || minute > 59)
      : (hour !== undefined || minute !== undefined))) {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.location, [
    'status', 'region', 'city', 'birthPlace', 'timezone', 'latitude', 'longitude',
  ], 'CONTRACT_INVALID');
  if (value.location.status === 'not_provided') {
    if (Object.keys(value.location).length !== 1) failLocalMenu('CONTRACT_INVALID');
  } else if (value.location.status === 'provided') {
    if (Object.keys(value.location).length < 2) failLocalMenu('CONTRACT_INVALID');
    for (const key of ['region', 'city', 'birthPlace'] as const) {
      const raw = value.location[key];
      if (raw !== undefined && !isBoundedCanonicalText(raw, MAX_LOCATION_TEXT_LENGTH)) {
        failLocalMenu('CONTRACT_INVALID');
      }
    }
    if (value.location.timezone !== undefined
      && !isBoundedCanonicalText(value.location.timezone, MAX_TIMEZONE_LENGTH)) {
      failLocalMenu('CONTRACT_INVALID');
    }
    if (value.location.latitude !== undefined
      && (typeof value.location.latitude !== 'number'
        || !Number.isFinite(value.location.latitude)
        || value.location.latitude < -90
        || value.location.latitude > 90)) {
      failLocalMenu('CONTRACT_INVALID');
    }
    if (value.location.longitude !== undefined
      && (typeof value.location.longitude !== 'number'
        || !Number.isFinite(value.location.longitude)
        || value.location.longitude < -180
        || value.location.longitude > 180)) {
      failLocalMenu('CONTRACT_INVALID');
    }
  } else {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.constraints, [
    'timeSensitiveAnalysis', 'genderDependentFortune',
  ], 'CONTRACT_INVALID');
  if (value.constraints.timeSensitiveAnalysis
      !== (exactTime ? 'available' : 'limited_unknown_time')
    || value.constraints.genderDependentFortune
      !== (value.gender === 'neutral'
        ? 'unavailable_without_explicit_gender_basis'
        : 'available')) {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalDataObject(value.provenance, [
    'input', 'lunarConversion', 'remoteLookup',
  ], 'CONTRACT_INVALID');
  if (value.provenance.input !== 'user_supplied'
    || value.provenance.lunarConversion !== 'builtin_only'
    || value.provenance.remoteLookup !== 'forbidden') {
    failLocalMenu('CONTRACT_INVALID');
  }
}
