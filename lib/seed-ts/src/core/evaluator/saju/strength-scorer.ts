import type { Element } from "../../types.js";
import { clamp } from "../../utils.js";
import type { SajuCalculationOutputSummary } from "../saju-distribution-resolver.js";
import {
  SAJU_STRENGTH_DEFAULT_INTENSITY,
  SAJU_STRENGTH_SCALE_BASE,
  SAJU_STRENGTH_SCALE_INTENSITY,
} from "../scoring-constants.js";
import {
  generatedBy,
  generates,
  controls,
  controlledBy,
  weightedElementAverage,
  normalizeSignedScore,
} from "./element-cycle.js";

export function computeStrengthScore(
  rootElementDistribution: Record<Element, number>,
  sajuOutput: SajuCalculationOutputSummary | null,
): number {
  const strength = sajuOutput?.strength;
  const dayMaster = sajuOutput?.dayMaster;
  const dayMasterElement = dayMaster?.element;
  if (!strength || !dayMasterElement) {
    return 50;
  }

  const favorable = new Set<Element>();
  const unfavorable = new Set<Element>();
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
  const intensity = sum > 0 ? clamp(Math.abs(support - oppose) / sum, 0, 1) : SAJU_STRENGTH_DEFAULT_INTENSITY;
  return clamp(50 + (baseScore - 50) * (SAJU_STRENGTH_SCALE_BASE + intensity * SAJU_STRENGTH_SCALE_INTENSITY), 0, 100);
}
