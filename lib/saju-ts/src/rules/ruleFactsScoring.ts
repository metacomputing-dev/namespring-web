import type { PillarIdx } from '../core/cycle.js';
import type { PillarsScoringResult, ScorePolicy } from '../core/scoring.js';
import { scorePillars } from '../core/scoring.js';

export interface RuleFactsScoringResult extends PillarsScoringResult {
  readonly provenance: {
    readonly dayMasterDirectStemWeight: number;
  };
}

/**
 * Couples the generic pillar ledger with the exact contribution metadata that
 * rule facts need. Keeping both in one value prevents policy/result mismatches.
 */
export function scorePillarsForRuleFacts(
  pillars: { year: PillarIdx; month: PillarIdx; day: PillarIdx; hour: PillarIdx },
  policy: ScorePolicy,
): RuleFactsScoringResult {
  return {
    ...scorePillars(pillars, policy),
    provenance: {
      dayMasterDirectStemWeight: policy.stemWeight,
    },
  };
}
