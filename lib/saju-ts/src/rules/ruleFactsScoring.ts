import type { PillarIdx } from '../core/cycle.js';
import type { PillarsScoringResult, ScorePolicy } from '../core/scoring.js';
import { scorePillars } from '../core/scoring.js';

export type RuleFactsScoringResult = PillarsScoringResult;

export interface RuleFactsScoringProvenance {
  readonly dayMasterDirectStemWeight: number;
}

const provenanceByScoringResult = new WeakMap<PillarsScoringResult, RuleFactsScoringProvenance>();

/**
 * Couples the generic pillar ledger object identity with the exact contribution
 * metadata that rule facts need, without changing the public result shape.
 */
export function scorePillarsForRuleFacts(
  pillars: { year: PillarIdx; month: PillarIdx; day: PillarIdx; hour: PillarIdx },
  policy: ScorePolicy,
): RuleFactsScoringResult {
  const scoring = scorePillars(pillars, policy);
  provenanceByScoringResult.set(scoring, {
    dayMasterDirectStemWeight: policy.stemWeight,
  });
  return scoring;
}

/** Internal-only policy binding; it does not alter enumerable/public score shape. */
export function readRuleFactsScoringProvenance(
  scoring: PillarsScoringResult,
): RuleFactsScoringProvenance | undefined {
  return provenanceByScoringResult.get(scoring);
}
