import { Cheongan, CHEONGAN_VALUES, cheonganOrdinal } from '../domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../domain/Jiji.js';
import { Pillar } from '../domain/Pillar.js';

const BASE_GAPJA_YEAR = 1984;
const JDN_UNIX_EPOCH = 2440588;

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

function toEpochDay(year: number, month: number, day: number): number {
  const d = Date.UTC(year, month - 1, day);
  return Math.floor(d / 86_400_000);
}

function monthBranchByIndex(monthIndex: number): Jiji {
  const branches: Record<number, Jiji> = {
    1: Jiji.IN, 2: Jiji.MYO, 3: Jiji.JIN, 4: Jiji.SA,
    5: Jiji.O, 6: Jiji.MI, 7: Jiji.SIN, 8: Jiji.YU,
    9: Jiji.SUL, 10: Jiji.HAE, 11: Jiji.JA, 12: Jiji.CHUK,
  };
  return branches[monthIndex] ?? Jiji.CHUK;
}

function monthStemStartAtIn(yearStem: Cheongan): Cheongan {
  switch (yearStem) {
    case Cheongan.GAP: case Cheongan.GI:
      return Cheongan.BYEONG;
    case Cheongan.EUL: case Cheongan.GYEONG:
      return Cheongan.MU;
    case Cheongan.BYEONG: case Cheongan.SIN:
      return Cheongan.GYEONG;
    case Cheongan.JEONG: case Cheongan.IM:
      return Cheongan.IM;
    case Cheongan.MU: case Cheongan.GYE:
      return Cheongan.GAP;
  }
}

function branchMonthIndexByGregorianMonth(month: number): number {
  return month === 1 ? 12 : month - 1;
}

function isBeforeIpchunApprox(year: number, month: number, day: number): boolean {
  if (month < 2) return true;
  if (month > 2) return false;
  return day < 4;
}

export function fromSexagenaryIndex(sexagenaryIndex: number): Pillar {
  const i = mod(sexagenaryIndex, 60);
  const stem = CHEONGAN_VALUES[i % 10]!;
  const branch = JIJI_VALUES[i % 12]!;
  return new Pillar(stem, branch);
}

export function dayPillarByJdn(year: number, month: number, day: number): Pillar {
  const jdn = toEpochDay(year, month, day) + JDN_UNIX_EPOCH;
  const index = mod(jdn + 49, 60);
  return fromSexagenaryIndex(index);
}

export function yearPillarApprox(year: number): Pillar {
  const index = mod(year - BASE_GAPJA_YEAR, 60);
  return fromSexagenaryIndex(index);
}

export function yearPillarByIpchunApprox(year: number, month: number, day: number): Pillar {
  const effectiveYear = isBeforeIpchunApprox(year, month, day) ? year - 1 : year;
  return yearPillarApprox(effectiveYear);
}

export function monthPillarApprox(yearStem: Cheongan, solarMonth: number): Pillar {
  if (solarMonth < 1 || solarMonth > 12) {
    throw new RangeError('solarMonth must be 1..12');
  }

  const monthBranch = JIJI_VALUES[(solarMonth + 1) % 12]!;
  const monthOrderFromIn = mod(solarMonth - 1, 12);
  const stemStartAtIn = monthStemStartAtIn(yearStem);
  const stem = CHEONGAN_VALUES[(cheonganOrdinal(stemStartAtIn) + monthOrderFromIn) % 10]!;
  return new Pillar(stem, monthBranch);
}

export function monthPillarBySajuMonthIndex(yearStem: Cheongan, monthIndex: number): Pillar {
  const monthBranch = monthBranchByIndex(monthIndex);
  const stemStartAtIn = monthStemStartAtIn(yearStem);
  const stem = CHEONGAN_VALUES[(cheonganOrdinal(stemStartAtIn) + (monthIndex - 1)) % 10]!;
  return new Pillar(stem, monthBranch);
}

export function monthPillarByJeolApprox(
  yearStem: Cheongan,
  year: number,
  month: number,
  day: number,
): Pillar {
  const monthIndex = sajuMonthIndexByJeolApprox(year, month, day);
  return monthPillarBySajuMonthIndex(yearStem, monthIndex);
}

export function sajuMonthIndexByJeolApprox(year: number, month: number, day: number): number {
  const jeolStartDayByMonth: Record<number, number> = {
    1: 6, 2: 4, 3: 6, 4: 5, 5: 6, 6: 6,
    7: 7, 8: 8, 9: 8, 10: 8, 11: 7, 12: 7,
  };

  const startDay = jeolStartDayByMonth[month] ?? 6;
  const currentMonthIndex = branchMonthIndexByGregorianMonth(month);
  return day >= startDay
    ? currentMonthIndex
    : (currentMonthIndex === 1 ? 12 : currentMonthIndex - 1);
}

export function hourPillar(dayStem: Cheongan, hour24: number): Pillar {
  if (hour24 < 0 || hour24 > 23) {
    throw new RangeError('hour24 must be 0..23');
  }

  const hourBranchIndex = Math.floor((hour24 + 1) / 2) % 12;
  const branch = JIJI_VALUES[hourBranchIndex]!;

  let stemStartAtJa: Cheongan;
  switch (dayStem) {
    case Cheongan.GAP: case Cheongan.GI:
      stemStartAtJa = Cheongan.GAP; break;
    case Cheongan.EUL: case Cheongan.GYEONG:
      stemStartAtJa = Cheongan.BYEONG; break;
    case Cheongan.BYEONG: case Cheongan.SIN:
      stemStartAtJa = Cheongan.MU; break;
    case Cheongan.JEONG: case Cheongan.IM:
      stemStartAtJa = Cheongan.GYEONG; break;
    case Cheongan.MU: case Cheongan.GYE:
      stemStartAtJa = Cheongan.IM; break;
  }

  const stem = CHEONGAN_VALUES[(cheonganOrdinal(stemStartAtJa) + hourBranchIndex) % 10]!;
  return new Pillar(stem, branch);
}

export const GanjiCycle = {
  fromSexagenaryIndex,
  dayPillarByJdn,
  yearPillarApprox,
  yearPillarByIpchunApprox,
  monthPillarApprox,
  monthPillarBySajuMonthIndex,
  monthPillarByJeolApprox,
  sajuMonthIndexByJeolApprox,
  hourPillar,
} as const;

