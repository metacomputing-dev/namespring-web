import { Gender } from './Gender.js';
import { createLunarDate } from '../calendar/lunar/LunarDate.js';
import { lunarToSolar } from '../calendar/lunar/KoreanLunarAlgorithmicConverter.js';

export type BirthCalendarType = 'SOLAR' | 'LUNAR';
export type LeapMonthInput = boolean | 'auto';

type BirthCalendarInput = BirthCalendarType | Lowercase<BirthCalendarType>;

export interface BirthInputParams {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  birthMinute: number;
  gender: Gender;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  calendarType?: BirthCalendarInput;
  isLeapMonth?: LeapMonthInput;
}

export interface NormalizedBirthDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly sourceCalendarType: BirthCalendarType;
  readonly isLeapMonth: boolean;
}

export interface BirthInput {
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly birthDay: number;
  readonly birthHour: number;
  readonly birthMinute: number;
  readonly gender: Gender;
  readonly timezone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
  readonly calendarType?: BirthCalendarType;
  readonly sourceCalendarType?: BirthCalendarType;
  readonly isLeapMonth?: boolean;
}

function normalizeCalendarType(value: BirthCalendarInput | undefined): BirthCalendarType {
  if (!value) return 'SOLAR';
  return String(value).toUpperCase() === 'LUNAR' ? 'LUNAR' : 'SOLAR';
}

export function normalizeBirthDateByCalendar(params: {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  calendarType?: BirthCalendarInput;
  isLeapMonth?: LeapMonthInput;
}): NormalizedBirthDate {
  const sourceCalendarType = normalizeCalendarType(params.calendarType);

  if (sourceCalendarType === 'SOLAR') {
    return {
      year: params.birthYear,
      month: params.birthMonth,
      day: params.birthDay,
      sourceCalendarType,
      isLeapMonth: false,
    };
  }

  const convertLunarToSolar = (isLeapMonth: boolean) => {
    const lunarDate = createLunarDate(
      params.birthYear,
      params.birthMonth,
      params.birthDay,
      isLeapMonth,
    );
    return lunarToSolar(lunarDate);
  };

  if (params.isLeapMonth === true || params.isLeapMonth === false) {
    const solarDate = convertLunarToSolar(params.isLeapMonth);
    if (!solarDate) {
      throw new RangeError(
        `Failed to convert lunar birth date to solar date: ${params.birthYear}-${params.birthMonth}-${params.birthDay} (leap=${params.isLeapMonth})`,
      );
    }

    return {
      year: solarDate.year,
      month: solarDate.month,
      day: solarDate.day,
      sourceCalendarType,
      isLeapMonth: params.isLeapMonth,
    };
  }

  // Auto mode: try 평달 first, then 윤달 if needed.
  const normalSolar = convertLunarToSolar(false);
  if (normalSolar) {
    return {
      year: normalSolar.year,
      month: normalSolar.month,
      day: normalSolar.day,
      sourceCalendarType,
      isLeapMonth: false,
    };
  }

  const leapSolar = convertLunarToSolar(true);
  if (leapSolar) {
    return {
      year: leapSolar.year,
      month: leapSolar.month,
      day: leapSolar.day,
      sourceCalendarType,
      isLeapMonth: true,
    };
  }

  throw new RangeError(
    `Failed to convert lunar birth date to solar date: ${params.birthYear}-${params.birthMonth}-${params.birthDay} (leap=auto)`,
  );
}

export function createBirthInput(params: BirthInputParams): BirthInput {
  const normalizedDate = normalizeBirthDateByCalendar(params);

  return {
    birthYear: normalizedDate.year,
    birthMonth: normalizedDate.month,
    birthDay: normalizedDate.day,
    birthHour: params.birthHour,
    birthMinute: params.birthMinute,
    gender: params.gender,
    timezone: params.timezone ?? 'Asia/Seoul',
    latitude: params.latitude ?? 37.5665,
    longitude: params.longitude ?? 126.978,
    name: params.name,
    calendarType: 'SOLAR',
    sourceCalendarType: normalizedDate.sourceCalendarType,
    isLeapMonth: normalizedDate.sourceCalendarType === 'LUNAR' ? normalizedDate.isLeapMonth : false,
  };
}

export interface AnalysisTraceStep {
  readonly key: string;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly citations: readonly string[];
  readonly reasoning: readonly string[];
  readonly confidence: number | null;
}

