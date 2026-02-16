import { type CalculationConfig, ShinsalReferenceBranch } from '../../config/CalculationConfig.js';
import type { PillarSet } from '../../domain/PillarSet.js';
import type { ShinsalComposite, WeightedShinsalHit } from '../../domain/Relations.js';
import type { ShinsalHit } from '../../domain/Shinsal.js';
import { ShinsalCompositeInterpreter } from '../analysis/ShinsalCompositeInterpreter.js';
import { ShinsalWeightCalculator } from '../analysis/ShinsalWeightModel.js';
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
    ? '일지(日支)만'
    : config.shinsalReferenceBranch === ShinsalReferenceBranch.YEAR_ONLY
      ? '연지(年支)만'
      : '일지+연지 모두';
  const weightedShinsalHits = ShinsalWeightCalculator.weightAll(shinsalHits);
  const shinsalComposites = ShinsalCompositeInterpreter.detect(shinsalHits);

  return {
    shinsalHits,
    weightedShinsalHits,
    shinsalComposites,
    shinsalReferenceNote,
  };
}
