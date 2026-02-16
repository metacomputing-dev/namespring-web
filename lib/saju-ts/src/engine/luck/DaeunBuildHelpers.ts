import { DaeunBoundaryMode, DaeunInfo, DaeunPillar } from '../../domain/DaeunInfo.js';
import { Pillar } from '../../domain/Pillar.js';
import { GanjiCycle } from '../GanjiCycle.js';

const DAEUN_PERIOD_YEARS = 10;
const SEXAGENARY_CYCLE_SIZE = 60;
const FIRST_DAEUN_ORDER = 1;

const MINUTES_PER_DAEUN_MONTH = 360;  // 1 day(1440min) / 4 months = 360 min/month

export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function toTotalDaeunMonths(totalMinutes: number): number {
  return Math.floor(totalMinutes / MINUTES_PER_DAEUN_MONTH);
}

export function buildDaeunInfo(
  monthPillar: Pillar,
  isForward: boolean,
  firstDaeunStartAge: number,
  daeunCount: number,
  sexagenaryIndex: (pillar: Pillar) => number,
  boundaryMode: DaeunBoundaryMode = DaeunBoundaryMode.EXACT_TABLE,
  warnings: readonly string[] = [],
  firstDaeunStartMonths: number = 0,
): DaeunInfo {
  const monthIndex = sexagenaryIndex(monthPillar);
  const step = isForward ? 1 : -1;
  const pillars = buildDaeunPillars(monthIndex, step, firstDaeunStartAge, daeunCount);

  return {
    isForward,
    firstDaeunStartAge,
    daeunPillars: pillars,
    boundaryMode,
    warnings: [...warnings],
    firstDaeunStartMonths,
  };
}

function buildDaeunPillars(
  monthIndex: number,
  step: number,
  firstDaeunStartAge: number,
  daeunCount: number,
): DaeunPillar[] {
  return Array.from({ length: daeunCount }, (_, offset) => (
    createDaeunPillar(
      FIRST_DAEUN_ORDER + offset,
      monthIndex,
      step,
      firstDaeunStartAge,
    )
  ));
}

function daeunAgeRange(order: number, firstDaeunStartAge: number): { startAge: number; endAge: number } {
  const startAge = firstDaeunStartAge + (order - FIRST_DAEUN_ORDER) * DAEUN_PERIOD_YEARS;
  return {
    startAge,
    endAge: startAge + DAEUN_PERIOD_YEARS - 1,
  };
}

function createDaeunPillar(
  order: number,
  monthIndex: number,
  step: number,
  firstDaeunStartAge: number,
): DaeunPillar {
  const sexagenaryIdx = mod(monthIndex + step * order, SEXAGENARY_CYCLE_SIZE);
  const pillar = GanjiCycle.fromSexagenaryIndex(sexagenaryIdx);
  const { startAge, endAge } = daeunAgeRange(order, firstDaeunStartAge);
  return { pillar, startAge, endAge, order };
}

