import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY } from '../core/scoring.js';
import { buildRuleFacts, type StrengthFacts } from './facts.js';
import { scorePillarsForRuleFacts } from './ruleFactsScoring.js';

const PILLARS = {
  year: pillar(1 as StemIdx, 9 as BranchIdx),
  month: pillar(3 as StemIdx, 3 as BranchIdx),
  day: pillar(0 as StemIdx, 2 as BranchIdx),
  hour: pillar(0 as StemIdx, 0 as BranchIdx),
};

function strengthFor(model: 'base' | 'deLingDiShi' | 'seasonalRoots'): StrengthFacts {
  const config = normalizeConfig({ strategies: { strength: { model } } });
  const elementDistribution = elementDistributionFromPillars(
    [PILLARS.year, PILLARS.month, PILLARS.day, PILLARS.hour],
    { hiddenStemWeights: config.weights?.hiddenStems },
  );
  const scoring = scorePillarsForRuleFacts(PILLARS, DEFAULT_SCORE_POLICY);
  return buildRuleFacts({ config, pillars: PILLARS, elementDistribution, scoring }).strength;
}

describe('strength facts model characterization', () => {
  it('captures the complete base, deLingDiShi, and seasonalRoots result contracts', () => {
    const actual = {
      base: strengthFor('base'),
      deLingDiShi: strengthFor('deLingDiShi'),
      seasonalRoots: strengthFor('seasonalRoots'),
    };

    expect(actual).toEqual({
      "base": {
        "index": 0.3999999999999999,
        "support": 5.6,
        "pressure": 2.4000000000000004,
        "total": 8,
        "components": {
          "companions": 4.6,
          "resources": 1,
          "outputs": 1.3,
          "wealth": 0.10000000000000002,
          "officers": 1
        },
        "model": "base"
      },
      "deLingDiShi": {
        "index": 0.5167334697218874,
        "support": 7.532407272727272,
        "pressure": 2.4000000000000004,
        "total": 9.932407272727271,
        "components": {
          "companions": 4.6,
          "resources": 1,
          "outputs": 1.3,
          "wealth": 0.10000000000000002,
          "officers": 1
        },
        "effectiveComponents": {
          "companions": 6.1873345454545445,
          "resources": 1.3450727272727272,
          "outputs": 1.3,
          "wealth": 0.10000000000000002,
          "officers": 1
        },
        "model": "deLingDiShi",
        "details": {
          "delingdiShi": {
            "deLing": {
              "monthElement": "WOOD",
              "dayMasterElement": "WOOD",
              "score": 1,
              "factor": 0.18
            },
            "deDi": {
              "sameElement": 0.9250000000000002,
              "resourceElement": 0.48999999999999994,
              "score": 1.219,
              "normalized": 0.5540909090909091,
              "factor": 0.14
            },
            "deShi": {
              "sameElement": 1.4,
              "resourceElement": 0,
              "score": 1.4,
              "normalized": 0.8749999999999999,
              "factor": 0.1,
              "positionWeights": {
                "year": 0.6,
                "month": 1,
                "hour": 0.8
              }
            },
            "adjusted": {
              "support": 7.532407272727272,
              "pressure": 2.4000000000000004,
              "total": 9.932407272727271
            },
            "interaction": {
              "branchDamageFactors": [
                0.5,
                0.35,
                1,
                0.7
              ],
              "resolved": [],
              "hui": {
                "supportBonus": 0,
                "pressureBonus": 0,
                "groups": []
              },
              "stemBinds": []
            }
          }
        }
      },
      "seasonalRoots": {
        "index": 0.5207667731629392,
        "support": 7.616,
        "pressure": 2.4000000000000004,
        "total": 10.016,
        "components": {
          "companions": 4.6,
          "resources": 1,
          "outputs": 1.3,
          "wealth": 0.10000000000000002,
          "officers": 1
        },
        "effectiveComponents": {
          "companions": 6.256,
          "resources": 1.36,
          "outputs": 1.3,
          "wealth": 0.10000000000000002,
          "officers": 1
        },
        "model": "seasonalRoots",
        "details": {
          "season": {
            "monthElement": "WOOD",
            "seasonGroup": "SPRING",
            "dayMasterElement": "WOOD",
            "score": 1,
            "factor": 0.14
          },
          "roots": {
            "sameElement": 1.6,
            "resourceElement": 1,
            "score": 2.2,
            "factor": 0.1
          },
          "adjusted": {
            "support": 7.616,
            "pressure": 2.4000000000000004,
            "total": 10.016
          }
        }
      }
    });
  });
});
