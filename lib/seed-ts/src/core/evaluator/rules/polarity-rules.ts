import type { Polarity } from "../../types.js";
import {
  POLARITY_RATIO_BRACKETS,
  POLARITY_RATIO_FLOOR,
  POLARITY_BASE_SCORE,
} from "../scoring-constants.js";

export function checkPolarityHarmony(arrangement: readonly Polarity[], surnameLength: number): boolean {
  if (arrangement.length < 2) {
    return true;
  }
  const eum = arrangement.filter((value) => value === "\u9670").length;
  const yang = arrangement.length - eum;
  if (eum === 0 || yang === 0) {
    return false;
  }
  if (surnameLength === 1 && arrangement[0] === arrangement[arrangement.length - 1]) {
    return false;
  }
  return true;
}

export function polarityScore(eumCount: number, yangCount: number): number {
  const total = Math.max(0, eumCount + yangCount);
  if (total === 0) {
    return 0;
  }
  const minSide = Math.min(eumCount, yangCount);
  const ratio = minSide / total;
  let ratioScore = POLARITY_RATIO_FLOOR;
  for (const [threshold, score] of POLARITY_RATIO_BRACKETS) {
    if (ratio >= threshold) {
      ratioScore = score;
      break;
    }
  }
  return POLARITY_BASE_SCORE + ratioScore;
}
