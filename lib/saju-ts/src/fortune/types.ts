import type { PillarIdx } from '../core/cycle.js';
import type { JieTermId } from '../calendar/solarTerms.js';

export type FortuneDirection = 'FORWARD' | 'BACKWARD';

/**
 * How to convert Δt(= |birth - boundary|) into the starting age.
 *
 * Notes:
 * - The classic "三日一歲" is equivalent to "一日四月".
 * - We keep the model math-first: convert to a floating age (years), and optionally
 *   provide an approximate Y/M/D decomposition for reporting.
 */
export type StartAgeMethodSpec =
  | 'threeDaysOneYear'
  | 'oneDayFourMonths'
  | {
      kind: 'ratioDaysPerYear';
      daysPerYear: number;
      label?: string;
    }
  | {
      kind: 'ratioMsPerYear';
      msPerYear: number;
      label?: string;
    };

export interface AgePartsApprox {
  years: number;
  months: number;
  days: number;
}

export interface FortunePolicy {
  /** Direction policy for 大運 progression (순행/역행). */
  directionRule: 'sex_yearStemYinYang' | 'fixedForward' | 'fixedBackward';

  /** Which solar-term family to use as boundary for 起運 (기산). */
  startBoundary: 'jie';

  /** How to convert boundary delta time into starting age. */
  startAgeMethod: StartAgeMethodSpec;

  /** First decade pillar offset (in stem/branch steps from natal month pillar). Usually 1. */
  firstDecadeOffsetSteps: number;

  /** Decade length in years (usually 10). */
  decadeLengthYears: number;

  /** How many decades to generate. */
  maxDecades: number;

  /** How many solar-years to generate (세운). */
  maxYears: number;

  /** How many solar-month segments (월운) to generate (0 = disabled). */
  maxMonths: number;

  /** How many day segments (일운) to generate (0 = disabled). */
  maxDays: number;

  /**
   * Timeline axis:
   * - ageOnly: report only ages; avoid pseudo precision for boundaries
   * - utcByGregorianYear: use JS Date(UTC) to add years to the 起運 instant
   */
  axis: 'ageOnly' | 'utcByGregorianYear';
}

export interface FortuneStart {
  direction: FortuneDirection;

  /** The solar-term boundary used for 起運 (기산점). */
  boundary: {
    id: JieTermId;
    utcMs: number;
  };

  /** Δt between birth and boundary (ms, always positive). */
  deltaMs: number;

  /** Starting age in years (floating), computed from delta via policy.startAgeMethod. */
  startAgeYears: number;

  /**
   * Approximate UTC instant when the first decade starts (birth + startAgeYears).
   *
   * Note: this is a derived convenience value (age→time conversion is inherently
   * a policy choice). It is mainly for UI timelines.
   */
  startUtcMsApprox?: number;

  /** Optional, approximate decomposition for human-readable reporting. */
  startAgeParts?: AgePartsApprox;

  /** Human-readable formula label for trace. */
  formula: string;
}

export interface DecadeLuck {
  kind: 'DECADE';
  index: number; // 0-based
  startAgeYears: number;
  endAgeYears: number;
  pillar: PillarIdx;
  startUtcMs?: number;
  endUtcMs?: number;
}

export interface YearLuck {
  kind: 'YEAR';
  solarYear: number; // LiChun-based year label
  pillar: PillarIdx;
  startUtcMs: number;
  endUtcMs: number;
  approxStartAgeYears: number;
  approxEndAgeYears: number;
}

export interface MonthLuck {
  kind: 'MONTH';
  /** LiChun-based solar-year label of the month segment. */
  solarYear: number;
  /** 0..11 where 0=寅월(立春..驚蟄), 11=丑월(小寒..立春). */
  monthOrder: number;
  /** The jie boundary that starts this month segment (e.g. LICHUN, JINGZHE, ...). */
  startJie: JieTermId;
  pillar: PillarIdx;
  startUtcMs: number;
  endUtcMs: number;
  approxStartAgeYears: number;
  approxEndAgeYears: number;
}

export interface DayLuck {
  kind: 'DAY';
  /** Local-date label of this day segment (effective day date by policy). */
  localDate: { y: number; m: number; d: number };
  pillar: PillarIdx;
  startUtcMs: number;
  endUtcMs: number;
  approxStartAgeYears: number;
  approxEndAgeYears: number;
}

export interface FortuneTimeline {
  policy: FortunePolicy;
  start: FortuneStart;
  decades: DecadeLuck[];
  years: YearLuck[];
  months?: MonthLuck[];
  days?: DayLuck[];
}
