import { SaryeongMode } from '../../config/CalculationConfig.js';
import { StrengthLevel } from '../../domain/StrengthResult.js';

const DEUKJI_PER_BRANCH = 5.0;
const DEUKSE_BIGYEOP = 7.0;
const DEFAULT_SARYEONG_DAY = 15;

export function classifyLevel(
  totalSupport: number,
  threshold: number,
  deukryeongMax: number,
  deukjiMax: number = DEUKJI_PER_BRANCH,
  bigyeopMax: number = DEUKSE_BIGYEOP,
): StrengthLevel {
  const maxTheoretical = deukryeongMax + (deukjiMax * 4) + (bigyeopMax * 3);
  const veryStrongBound = threshold + (maxTheoretical - threshold) * 0.4;
  const slightlyStrongBound = threshold * 0.8;
  const slightlyWeakBound = threshold * 0.6;
  const weakBound = threshold * 0.3;

  if (totalSupport >= veryStrongBound) return StrengthLevel.VERY_STRONG;
  if (totalSupport >= threshold) return StrengthLevel.STRONG;
  if (totalSupport >= slightlyStrongBound) return StrengthLevel.SLIGHTLY_STRONG;
  if (totalSupport >= slightlyWeakBound) return StrengthLevel.SLIGHTLY_WEAK;
  if (totalSupport >= weakBound) return StrengthLevel.WEAK;
  return StrengthLevel.VERY_WEAK;
}

export function formatScore(score: number): string {
  if (score === Math.floor(score)) {
    return score.toFixed(0);
  }
  return score.toFixed(1);
}

export function normalizedDaysSinceJeol(
  saryeongMode: SaryeongMode,
  daysSinceJeol: number | null,
  details: string[],
  section: string,
): number | null {
  if (saryeongMode !== SaryeongMode.BY_DAY_IN_MONTH) {
    return daysSinceJeol;
  }
  if (daysSinceJeol !== null) {
    return daysSinceJeol;
  }
  details.push(
    `[${section}] \u26A0 BY_DAY_IN_MONTH 모드이나 절입 경과일 미제공 → ${DEFAULT_SARYEONG_DAY}일(월중 기준)로 근사`,
  );
  return DEFAULT_SARYEONG_DAY;
}

