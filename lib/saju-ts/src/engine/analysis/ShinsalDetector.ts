import { PillarSet } from '../../domain/PillarSet.js';
import { ShinsalGrade, ShinsalHit } from '../../domain/Shinsal.js';
import {
  type CalculationConfig,
  DEFAULT_CONFIG,
} from '../../config/CalculationConfig.js';
import { detectorsForScope } from './shinsalGradeDetectors.js';

function runDetectors(
  pillars: PillarSet,
  grade: ShinsalGrade | null = null,
  config: CalculationConfig = DEFAULT_CONFIG,
): ShinsalHit[] {
  const hits: ShinsalHit[] = [];
  const detectors = detectorsForScope(
    grade,
    config.gwiiinTable,
    config.shinsalReferenceBranch,
  );

  for (const detector of detectors) {
    detector(pillars, hits);
  }

  return hits;
}

export const ShinsalDetector = {
  detect: runDetectors,
  detectAll(
    pillars: PillarSet,
    config: CalculationConfig = DEFAULT_CONFIG,
  ): ShinsalHit[] {
    return runDetectors(pillars, null, config);
  },
} as const;
