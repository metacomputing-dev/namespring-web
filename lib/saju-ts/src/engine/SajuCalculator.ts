import { Pillar } from '../domain/Pillar.js';
import { PillarSet } from '../domain/PillarSet.js';
import { BirthInput } from '../domain/types.js';
import { DayCutMode } from '../calendar/time/DayCutMode.js';
import { adjustSolarTime, standardMeridianDegrees, SolarTimeAdjustment } from '../calendar/time/SolarTimeAdjuster.js';
import { JeolBoundaryTable } from '../calendar/solar/JeolBoundaryTable.js';
import { GanjiCycle } from './GanjiCycle.js';
import { CalculationConfig, DEFAULT_CONFIG } from '../config/CalculationConfig.js';
import { type Cheongan } from '../domain/Cheongan.js';

export interface SajuPillarResult {
  readonly input: BirthInput;
  readonly pillars: PillarSet;
    readonly standardYear: number;
  readonly standardMonth: number;
  readonly standardDay: number;
  readonly standardHour: number;
  readonly standardMinute: number;
    readonly adjustedYear: number;
  readonly adjustedMonth: number;
  readonly adjustedDay: number;
  readonly adjustedHour: number;
  readonly adjustedMinute: number;
  readonly dstCorrectionMinutes: number;
  readonly longitudeCorrectionMinutes: number;
  readonly equationOfTimeMinutes: number;
}

interface YmdDate {
  year: number;
  month: number;
  day: number;
}

interface MinuteMoment extends YmdDate {
  hour: number;
  minute: number;
}

function nextUtcDate(year: number, month: number, day: number): YmdDate {
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function shouldShiftDayByCut(mode: DayCutMode, hour: number, minute: number): boolean {
  switch (mode) {
    case DayCutMode.MIDNIGHT_00:
      return false;
    case DayCutMode.YAZA_23_TO_01_NEXTDAY:
      return hour === 23;
    case DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY:
      return hour === 23 && minute >= 30;
    case DayCutMode.JOJA_SPLIT:
      return false;
  }
}

function buildMinuteMomentKey(
  moment: MinuteMoment,
): number {
  return moment.year * 100_000_000
    + moment.month * 1_000_000
    + moment.day * 10_000
    + moment.hour * 100
    + moment.minute;
}

function applyDayCut(
  adjustedMoment: MinuteMoment,
  mode: DayCutMode,
): YmdDate {
  if (!shouldShiftDayByCut(mode, adjustedMoment.hour, adjustedMoment.minute)) {
    return {
      year: adjustedMoment.year,
      month: adjustedMoment.month,
      day: adjustedMoment.day,
    };
  }
  return nextUtcDate(adjustedMoment.year, adjustedMoment.month, adjustedMoment.day);
}

type AdjustmentMomentKind = 'standard' | 'adjusted';

function adjustmentMoment(adjusted: SolarTimeAdjustment, kind: AdjustmentMomentKind): MinuteMoment {
  if (kind === 'standard') {
    return {
      year: adjusted.standardYear,
      month: adjusted.standardMonth,
      day: adjusted.standardDay,
      hour: adjusted.standardHour,
      minute: adjusted.standardMinute,
    };
  }
  return {
    year: adjusted.adjustedYear,
    month: adjusted.adjustedMonth,
    day: adjusted.adjustedDay,
    hour: adjusted.adjustedHour,
    minute: adjusted.adjustedMinute,
  };
}

export function calculatePillars(
  input: BirthInput,
  config: CalculationConfig = DEFAULT_CONFIG,
): SajuPillarResult {
  const lmtOverride = config.lmtBaselineLongitude !== standardMeridianDegrees(input.timezone)
    ? config.lmtBaselineLongitude
    : undefined;

  const adjusted: SolarTimeAdjustment = adjustSolarTime({
    year: input.birthYear,
    month: input.birthMonth,
    day: input.birthDay,
    hour: input.birthHour,
    minute: input.birthMinute,
    timezone: input.timezone,
    longitudeDeg: input.longitude,
    applyDstHistory: config.applyDstHistory,
    includeEquationOfTime: config.includeEquationOfTime,
    lmtBaselineOverride: lmtOverride,
  });

  const standard = adjustmentMoment(adjusted, 'standard');
  const adjustedSolar = adjustmentMoment(adjusted, 'adjusted');

  const yearPillar = calculateYearPillar(standard);

  const monthPillar = calculateMonthPillar(yearPillar.cheongan, standard);

  const dayBase = applyDayCut(adjustedSolar, config.dayCutMode);
  const dayPillar = GanjiCycle.dayPillarByJdn(dayBase.year, dayBase.month, dayBase.day);

  const hourPillar = GanjiCycle.hourPillar(dayPillar.cheongan, adjustedSolar.hour);

  return {
    input,
    pillars: new PillarSet(yearPillar, monthPillar, dayPillar, hourPillar),
    ...adjusted,
  };
}

function calculateYearPillar(
  standardMoment: MinuteMoment,
): Pillar {
  const ipchun = JeolBoundaryTable.ipchunOf(standardMoment.year);
  if (ipchun) {
    const momentKey = buildMinuteMomentKey(standardMoment);
    const ipchunKey = buildMinuteMomentKey(ipchun);
    const effectiveYear = momentKey <= ipchunKey
      ? standardMoment.year - 1
      : standardMoment.year;
    return GanjiCycle.yearPillarApprox(effectiveYear);
  }
  return GanjiCycle.yearPillarByIpchunApprox(
    standardMoment.year,
    standardMoment.month,
    standardMoment.day,
  );
}

function calculateMonthPillar(
  yearStem: Cheongan,
  standardMoment: MinuteMoment,
): Pillar {
  const monthIndex = JeolBoundaryTable.sajuMonthIndexAt(
    standardMoment.year,
    standardMoment.month,
    standardMoment.day,
    standardMoment.hour,
    standardMoment.minute,
  );
  if (monthIndex !== undefined) {
    return GanjiCycle.monthPillarBySajuMonthIndex(yearStem, monthIndex);
  }
  return GanjiCycle.monthPillarByJeolApprox(
    yearStem,
    standardMoment.year,
    standardMoment.month,
    standardMoment.day,
  );
}

