import { type CalculationConfig, ShinsalReferenceBranch } from '../../config/CalculationConfig.js';
import type { PillarSet } from '../../domain/PillarSet.js';
import type { ShinsalHit } from '../../domain/Shinsal.js';
import { ShinsalCompositeInterpreter } from '../analysis/ShinsalCompositeInterpreter.js';
import { type ShinsalComposite, ShinsalWeightCalculator, type WeightedShinsalHit } from '../analysis/ShinsalWeightModel.js';
import { ShinsalDetector } from '../analysis/ShinsalDetector.js';

export interface ShinsalAnalysisBundle {
  readonly shinsalHits: ShinsalHit[];
  readonly weightedShinsalHits: WeightedShinsalHit[];
  readonly shinsalComposites: ShinsalComposite[];
  readonly shinsalReferenceNote: string;
}

export function analyzeShinsalBundle(
  pillars: PillarSet,
  config: CalculationConfig,
): ShinsalAnalysisBundle {
  const shinsalHits = ShinsalDetector.detectAll(pillars, config);
  const shinsalReferenceNote = config.shinsalReferenceBranch === ShinsalReferenceBranch.DAY_ONLY
    ? '?쇱?(?ζ뵱)留?'
    : config.shinsalReferenceBranch === ShinsalReferenceBranch.YEAR_ONLY
      ? '?꾩?(亮닸뵱)留?'
      : '?쇱?+?꾩? 紐⑤몢';
  const weightedShinsalHits = ShinsalWeightCalculator.weightAll(shinsalHits);
  const shinsalComposites = ShinsalCompositeInterpreter.detect(shinsalHits);

  return {
    shinsalHits,
    weightedShinsalHits,
    shinsalComposites,
    shinsalReferenceNote,
  };
}

