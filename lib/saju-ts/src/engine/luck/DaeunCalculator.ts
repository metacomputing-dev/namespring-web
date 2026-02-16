import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { DaeunInfo } from '../../domain/DaeunInfo.js';
import { Eumyang } from '../../domain/Eumyang.js';
import { Gender } from '../../domain/Gender.js';
import { Pillar } from '../../domain/Pillar.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { cheonganOrdinal } from '../../domain/Cheongan.js';
import { jijiOrdinal } from '../../domain/Jiji.js';
import { boundaryDistance } from './DaeunBoundaryHelpers.js';
import { buildDaeunInfo, toTotalDaeunMonths } from './DaeunBuildHelpers.js';

const MONTHS_PER_YEAR = 12;
const MIN_DAEUN_START_AGE = 1;

function deriveDaeunStartTiming(totalDaeunMonths: number): { startAge: number; startMonths: number } {
  const startAgeRaw = Math.floor(totalDaeunMonths / MONTHS_PER_YEAR);
  return {
    startAge: Math.max(MIN_DAEUN_START_AGE, startAgeRaw),
    startMonths: startAgeRaw >= MIN_DAEUN_START_AGE ? (totalDaeunMonths % MONTHS_PER_YEAR) : 0,
  };
}

function deriveBoundaryTiming(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  birthHour: number,
  birthMinute: number,
  isForward: boolean,
): {
  boundary: ReturnType<typeof boundaryDistance>;
  startAge: number;
  startMonths: number;
} {
  const boundary = boundaryDistance(birthYear, birthMonth, birthDay, birthHour, birthMinute, isForward);
  const totalDaeunMonths = toTotalDaeunMonths(boundary.totalMinutes);
  const { startAge, startMonths } = deriveDaeunStartTiming(totalDaeunMonths);
  return { boundary, startAge, startMonths };
}

function warningsFromBoundaryWarning(warning: string | undefined): string[] {
  return warning === undefined ? [] : [warning];
}

export function isForward(yearStem: Cheongan, gender: Gender): boolean {
  const genderPolarity = gender === Gender.MALE ? Eumyang.YANG : Eumyang.YIN;
  return CHEONGAN_INFO[yearStem].eumyang === genderPolarity;
}

export function sexagenaryIndex(pillar: Pillar): number {
  const s = cheonganOrdinal(pillar.cheongan);
  const b = jijiOrdinal(pillar.jiji);
  let i = s;
  while (i < 60) {
    if (i % 12 === b) return i;
    i += 10;
  }
  throw new Error(
    `Invalid ganji combination: ${pillar.cheongan}(${s}) + ${pillar.jiji}(${b})`,
  );
}

export function calculate(
  pillars: PillarSet,
  gender: Gender,
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  birthHour: number = 0,
  birthMinute: number = 0,
  daeunCount: number = 8,
): DaeunInfo {
  const forward = isForward(pillars.year.cheongan, gender);
  const { boundary, startAge, startMonths } = deriveBoundaryTiming(
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
    forward,
  );
  const warnings = warningsFromBoundaryWarning(boundary.warning);
  return buildDaeunInfo(
    pillars.month,
    forward,
    startAge,
    daeunCount,
    sexagenaryIndex,
    boundary.mode,
    warnings,
    startMonths,
  );
}

export function calculateWithStartAge(
  pillars: PillarSet,
  gender: Gender,
  firstDaeunStartAge: number,
  daeunCount: number = 8,
): DaeunInfo {
  const forward = isForward(pillars.year.cheongan, gender);
  return buildDaeunInfo(pillars.month, forward, firstDaeunStartAge, daeunCount, sexagenaryIndex);
}

export function calculateStartAge(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  birthHour: number,
  birthMinute: number,
  isForward: boolean,
): number {
  return deriveBoundaryTiming(
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
    isForward,
  ).startAge;
}

export const DaeunCalculator = {
  isForward,
  sexagenaryIndex,
  calculate,
  calculateWithStartAge,
  calculateStartAge,
} as const;

