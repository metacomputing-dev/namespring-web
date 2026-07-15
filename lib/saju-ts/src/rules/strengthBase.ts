import type { TenGodScore } from '../core/scoring.js';
import type { StrengthComponents } from './strengthComponents.js';

export interface StrengthBase {
  index: number;
  support: number;
  pressure: number;
  total: number;
  components: StrengthComponents;
}

export interface StrengthBasePolicy {
  excludedDayMasterDirectStemWeight: number;
}

/**
 * Builds the unadjusted external support/pressure ledger used by strength models.
 *
 * The generic ten-god ledger includes the day master's own stem because it describes
 * all eight chart positions. Callers explicitly choose how much of that direct
 * BI_GYEON contribution to exclude from the strength ledger.
 */
export function computeStrengthBase(
  tenGods: TenGodScore,
  policy: StrengthBasePolicy,
): StrengthBase {
  const selfWeight = policy.excludedDayMasterDirectStemWeight;
  if (!Number.isFinite(selfWeight) || selfWeight < 0) {
    throw new Error('Invariant: day-master direct-stem weight must be finite and non-negative');
  }

  const biGyeon = tenGods.BI_GYEON ?? 0;
  if (biGyeon + 1e-12 < selfWeight) {
    throw new Error('Invariant: ten-god ledger lacks the declared day-master stem contribution');
  }

  const companions = Math.max(0, biGyeon - selfWeight) + (tenGods.GEOB_JAE ?? 0);
  const resources = (tenGods.PYEON_IN ?? 0) + (tenGods.JEONG_IN ?? 0);
  const outputs = (tenGods.SIK_SHIN ?? 0) + (tenGods.SANG_GWAN ?? 0);
  const wealth = (tenGods.PYEON_JAE ?? 0) + (tenGods.JEONG_JAE ?? 0);
  const officers = (tenGods.PYEON_GWAN ?? 0) + (tenGods.JEONG_GWAN ?? 0);

  const support = companions + resources;
  const pressure = outputs + wealth + officers;
  const total = support + pressure;
  const index = total <= 0 ? 0 : (support - pressure) / total;

  return {
    index,
    support,
    pressure,
    total,
    components: { companions, resources, outputs, wealth, officers },
  };
}
