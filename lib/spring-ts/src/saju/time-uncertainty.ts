import type {
  SajuAxisStrengthMap,
  SajuInputUncertaintyAxis,
  SajuJudgmentStrength,
  SajuSummary,
} from '../types.js';
import { deriveAxisStrength } from './context-builder.js';

export const DEFAULT_UNKNOWN_HOUR = 12;
export const DEFAULT_UNKNOWN_MINUTE = 0;

const UNKNOWN_HOUR_AFFECTED_AXES: readonly SajuInputUncertaintyAxis[] = [
  'yearPillar',
  'monthPillar',
  'dayPillar',
  'hourPillar',
  'yongshin',
  'gyeokguk',
  'strength',
  'tenGod',
  'relations',
  'shinsal',
  'fortuneTiming',
];

const INPUT_UNCERTAINTY_AXIS_LABELS: Readonly<Record<SajuInputUncertaintyAxis, string>> = {
  yearPillar: '연주',
  monthPillar: '월주',
  dayPillar: '일주',
  hourPillar: '시주',
  yongshin: '용신 후보',
  gyeokguk: '격국',
  strength: '신강약',
  tenGod: '십성 위치',
  relations: '천간·지지 관계',
  shinsal: '신살·공망',
  fortuneTiming: '운세 시점',
};

export interface UnknownMinuteSensitivity {
  readonly boundarySensitive: boolean;
  readonly affectedAxes: readonly SajuInputUncertaintyAxis[];
  readonly affectedAxisLabels: readonly string[];
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const CONTINUOUS_FORTUNE_TIMING_KEYS = new Set([
  'firstDaeunStartAge',
  'firstDaeunStartAgeDisplay',
  'firstDaeunStartMonths',
  'boundaryUtcMs',
  'deltaDays',
  'startAge',
  'endAge',
  'displayStartAge',
  'displayEndAge',
  'approxStartUtcMs',
  'approxEndUtcMs',
  'startUtcMs',
  'endUtcMs',
  'approxStartAgeYears',
  'approxEndAgeYears',
]);

function discreteFortuneSignature(value: unknown): string {
  return JSON.stringify(value, (key, nestedValue) =>
    CONTINUOUS_FORTUNE_TIMING_KEYS.has(key) ? undefined : nestedValue);
}

function pushIfChanged(
  axes: SajuInputUncertaintyAxis[],
  axis: SajuInputUncertaintyAxis,
  left: unknown,
  right: unknown,
): void {
  if (!sameValue(left, right)) axes.push(axis);
}

/**
 * Compare the two ends of the known-hour minute envelope under the exact same
 * calendar, longitude, equation-of-time and yaza policy. Pillar and solar-term
 * boundaries are one-way transitions inside a single civil hour, so the
 * HH:00/HH:59 envelope detects whether any discrete normalized result boundary
 * is crossed without paying for sixty complete analyses. Continuous fortune
 * timing precision is tracked separately for every imputed-minute request.
 */
export function assessUnknownMinuteSensitivity(
  atMinuteZero: SajuSummary,
  atMinuteFiftyNine: SajuSummary,
): UnknownMinuteSensitivity {
  const axes: SajuInputUncertaintyAxis[] = [];

  pushIfChanged(axes, 'yearPillar', atMinuteZero.pillars.year, atMinuteFiftyNine.pillars.year);
  pushIfChanged(axes, 'monthPillar', atMinuteZero.pillars.month, atMinuteFiftyNine.pillars.month);
  pushIfChanged(axes, 'dayPillar', atMinuteZero.pillars.day, atMinuteFiftyNine.pillars.day);
  pushIfChanged(axes, 'hourPillar', atMinuteZero.pillars.hour, atMinuteFiftyNine.pillars.hour);
  pushIfChanged(axes, 'yongshin', atMinuteZero.yongshin, atMinuteFiftyNine.yongshin);
  pushIfChanged(axes, 'gyeokguk', atMinuteZero.gyeokguk, atMinuteFiftyNine.gyeokguk);
  pushIfChanged(axes, 'strength', atMinuteZero.strength, atMinuteFiftyNine.strength);
  pushIfChanged(axes, 'tenGod', atMinuteZero.tenGodAnalysis, atMinuteFiftyNine.tenGodAnalysis);
  pushIfChanged(
    axes,
    'relations',
    [atMinuteZero.cheonganRelations, atMinuteZero.jijiRelations],
    [atMinuteFiftyNine.cheonganRelations, atMinuteFiftyNine.jijiRelations],
  );
  pushIfChanged(
    axes,
    'shinsal',
    [atMinuteZero.shinsalHits, atMinuteZero.gongmang],
    [atMinuteFiftyNine.shinsalHits, atMinuteFiftyNine.gongmang],
  );

  const zeroAdjustedBoundary = {
    year: atMinuteZero.timeCorrection.adjustedYear,
    month: atMinuteZero.timeCorrection.adjustedMonth,
    day: atMinuteZero.timeCorrection.adjustedDay,
    hour: atMinuteZero.timeCorrection.adjustedHour,
  };
  const fiftyNineAdjustedBoundary = {
    year: atMinuteFiftyNine.timeCorrection.adjustedYear,
    month: atMinuteFiftyNine.timeCorrection.adjustedMonth,
    day: atMinuteFiftyNine.timeCorrection.adjustedDay,
    hour: atMinuteFiftyNine.timeCorrection.adjustedHour,
  };
  pushIfChanged(
    axes,
    'fortuneTiming',
    [
      zeroAdjustedBoundary,
      discreteFortuneSignature(atMinuteZero.daeunInfo),
      discreteFortuneSignature(atMinuteZero.saeunPillars),
      discreteFortuneSignature(atMinuteZero.wolunPillars),
    ],
    [
      fiftyNineAdjustedBoundary,
      discreteFortuneSignature(atMinuteFiftyNine.daeunInfo),
      discreteFortuneSignature(atMinuteFiftyNine.saeunPillars),
      discreteFortuneSignature(atMinuteFiftyNine.wolunPillars),
    ],
  );

  const affectedAxes = [...new Set(axes)];
  return {
    boundarySensitive: affectedAxes.length > 0,
    affectedAxes,
    affectedAxisLabels: affectedAxes.map((axis) => INPUT_UNCERTAINTY_AXIS_LABELS[axis]),
  };
}

function downgradeJudgmentStrength(
  value: SajuJudgmentStrength | undefined,
): SajuJudgmentStrength | undefined {
  if (value === 'definite') return 'practical';
  if (value === 'practical') return 'candidate';
  return value;
}

function applyAffectedAxisDowngrade(
  summary: SajuSummary & Record<string, unknown>,
  affectedAxes: readonly SajuInputUncertaintyAxis[],
): boolean {
  const confidenceAxes = (['yongshin', 'gyeokguk', 'strength'] as const)
    .filter((axis) => affectedAxes.includes(axis));
  if (confidenceAxes.length === 0) return false;

  const current = summary.axisStrength ?? deriveAxisStrength(summary);
  const downgraded: { -readonly [K in keyof SajuAxisStrengthMap]?: SajuJudgmentStrength } = {
    ...(current ?? {}),
  };
  let changed = false;
  for (const axis of confidenceAxes) {
    const next = downgradeJudgmentStrength(current?.[axis]);
    if (next) {
      downgraded[axis] = next;
      if (next !== current?.[axis]) changed = true;
    }
  }
  if (Object.keys(downgraded).length > 0) {
    (summary as Record<string, any>).axisStrength = downgraded as SajuAxisStrengthMap;
  }
  return changed;
}

/** Apply the existing one-tier unknown-hour downgrade in place. */
export function applyUnknownHourUncertainty(
  summary: SajuSummary & Record<string, unknown>,
  fallbackTimezone: string,
): void {
  applyAffectedAxisDowngrade(summary, UNKNOWN_HOUR_AFFECTED_AXES);
  (summary as Record<string, any>).inputUncertainty = {
    ...(summary.inputUncertainty as object | undefined),
    unknownHour: {
      fallbackHour: DEFAULT_UNKNOWN_HOUR,
      fallbackMinute: DEFAULT_UNKNOWN_MINUTE,
      fallbackTimezone,
      affectedAxes: UNKNOWN_HOUR_AFFECTED_AXES,
      affectedAxisLabels: UNKNOWN_HOUR_AFFECTED_AXES.map(
        (axis) => INPUT_UNCERTAINTY_AXIS_LABELS[axis],
      ),
      confidenceTierShift: 'downgrade-one-step',
      message: '출생 시각 정보가 없어 계산에는 낮 12시를 임시 기준으로 사용했어요. 시간에 따라 달라질 수 있는 해석은 참고용으로 보세요.',
    },
  };
}

export function applyUnknownMinuteUncertainty(
  summary: SajuSummary & Record<string, unknown>,
  fallbackHour: number,
  sensitivity: UnknownMinuteSensitivity,
  fallbackTimezone: string,
): void {
  const shifted = applyAffectedAxisDowngrade(summary, sensitivity.affectedAxes);
  const hourText = String(fallbackHour).padStart(2, '0');
  const affectedAxes = [...new Set<SajuInputUncertaintyAxis>([
    ...sensitivity.affectedAxes,
    'fortuneTiming',
  ])];
  const affectedAxisLabels = affectedAxes.map((axis) => INPUT_UNCERTAINTY_AXIS_LABELS[axis]);
  const affectedText = affectedAxisLabels.join(', ');
  const message = sensitivity.boundarySensitive
    ? shifted
      ? `출생 분이 없어 ${hourText}:00을 적용했습니다. ${hourText}:00~${hourText}:59 범위에서 ${affectedText} 결과가 달라질 수 있어 실제로 변경 가능한 판단 축의 확신도를 한 단계 낮췄습니다.`
      : `출생 분이 없어 ${hourText}:00을 적용했습니다. ${hourText}:00~${hourText}:59 범위에서 ${affectedText} 결과가 달라질 수 있습니다. 현재 판단 단계에는 추가 하향이 적용되지 않았습니다.`
    : `출생 분이 없어 ${hourText}:00을 적용했습니다. 선택한 시간 보정 정책에서 ${hourText}:00~${hourText}:59 범위의 이산 사주 결과는 동일하지만, 대운 시작 연령·UTC 같은 연속 운세 시점의 정밀도는 출생 분에 따라 달라질 수 있습니다.`;

  (summary as Record<string, any>).inputUncertainty = {
    ...(summary.inputUncertainty as object | undefined),
    unknownMinute: {
      fallbackHour,
      fallbackMinute: DEFAULT_UNKNOWN_MINUTE,
      fallbackTimezone,
      evaluatedMinuteRange: { from: 0, to: 59 },
      comparedMinutes: [0, 59],
      continuousTimingAffected: true,
      boundarySensitive: sensitivity.boundarySensitive,
      affectedAxes,
      affectedAxisLabels,
      confidenceTierShift: shifted ? 'downgrade-affected-axes-one-step' : 'none',
      message,
    },
  };
}
