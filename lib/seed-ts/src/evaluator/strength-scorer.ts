import type { ElementKey } from './element-cycle.js';
import {
  generates,
  generatedBy,
  controls,
  controlledBy,
  weightedElementAverage,
  normalizeSignedScore,
  clamp,
} from './element-cycle.js';
import {
  SAJU_STRENGTH_DEFAULT_INTENSITY,
  SAJU_STRENGTH_SCALE_BASE,
  SAJU_STRENGTH_SCALE_INTENSITY,
} from './scoring-constants.js';

/** Saju output summary for strength/day master info */
export interface SajuOutputSummary {
  dayMaster?: {
    element: ElementKey;
  };
  strength?: {
    isStrong: boolean;
    totalSupport: number;
    totalOppose: number;
  };
  yongshin?: {
    finalYongshin: string;
    finalHeesin: string | null;
    gisin: string | null;
    gusin: string | null;
    finalConfidence: number;
    recommendations: Array<{
      type: string;
      primaryElement: string;
      secondaryElement: string | null;
      confidence: number;
      reasoning: string;
    }>;
  };
  tenGod?: {
    groupCounts: Record<string, number>;
  };
}

export function computeStrengthScore(
  rootElementDistribution: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const strength = sajuOutput?.strength;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  if (!strength || !dayMasterElement) return 50;

  const favorable = new Set<ElementKey>();
  const unfavorable = new Set<ElementKey>();

  if (strength.isStrong) {
    favorable.add(generates(dayMasterElement));
    favorable.add(controls(dayMasterElement));
    favorable.add(controlledBy(dayMasterElement));
    unfavorable.add(dayMasterElement);
    unfavorable.add(generatedBy(dayMasterElement));
  } else {
    favorable.add(dayMasterElement);
    favorable.add(generatedBy(dayMasterElement));
    unfavorable.add(generates(dayMasterElement));
    unfavorable.add(controls(dayMasterElement));
    unfavorable.add(controlledBy(dayMasterElement));
  }

  const affinity = weightedElementAverage(rootElementDistribution, (element) => {
    if (favorable.has(element)) return 1;
    if (unfavorable.has(element)) return -1;
    return 0;
  });

  const baseScore = normalizeSignedScore(affinity);
  const support = Math.abs(strength.totalSupport);
  const oppose = Math.abs(strength.totalOppose);
  const sum = support + oppose;
  const intensity = sum > 0
    ? clamp(Math.abs(support - oppose) / sum, 0, 1)
    : SAJU_STRENGTH_DEFAULT_INTENSITY;
  return clamp(
    50 + (baseScore - 50) * (SAJU_STRENGTH_SCALE_BASE + intensity * SAJU_STRENGTH_SCALE_INTENSITY),
    0, 100,
  );
}
