/**
 * Energy -- a (Polarity, Element) pair attached to each character in a name.
 *
 * The class also provides two static scoring functions that evaluate how well
 * a sequence of energies is balanced:
 *
 *   getPolarityScore  -- are Positive and Negative roughly equal?
 *   getElementScore   -- do adjacent elements Generate rather than Overcome?
 *
 * Scoring thresholds are loaded from config/scoring-rules.json so that tuning
 * the algorithm only requires editing that file, not this source code.
 */

import { Polarity } from './polarity.js';
import type { Element } from './element.js';
import scoringRules from '../../config/scoring-rules.json';

// ---------------------------------------------------------------------------
// Pull the scoring constants out of the config file and give them
// descriptive names.  Every "magic number" in the original code now has a
// clear, traceable origin.
// ---------------------------------------------------------------------------

const polarityWeights = scoringRules.energyScoring.polarity;
const POSITIVE_WEIGHT = polarityWeights.positiveWeight;   //  +1
const NEGATIVE_WEIGHT = polarityWeights.negativeWeight;   //  -1

const elementScoring  = scoringRules.energyScoring.element;
const BASE_SCORE              = elementScoring.baseScore;            //  70
const GENERATING_BONUS        = elementScoring.generatingBonus;      //  15
const OVERCOMING_PENALTY      = elementScoring.overcomingPenalty;     // -20
const SAME_ELEMENT_PENALTY    = elementScoring.sameElementPenalty;    //  -5
const MINIMUM_ELEMENT_SCORE   = elementScoring.minScore;             //   0
const MAXIMUM_ELEMENT_SCORE   = elementScoring.maxScore;             // 100


export class Energy {

  constructor(
    public readonly polarity: Polarity,
    public readonly element: Element,
  ) {}

  // -------------------------------------------------------------------------
  // Polarity score
  // -------------------------------------------------------------------------

  /**
   * Measure how balanced the Positive/Negative distribution is.
   *
   * Algorithm:
   *   1. Walk through every energy and accumulate a signed sum:
   *        Positive adds +1, Negative adds -1.
   *   2. The absolute value of that sum tells us how far from balance
   *      we are.  A perfectly balanced list has |sum| === 0.
   *   3. Convert to a 0-100 percentage:
   *        score = (totalCount - |imbalance|) / totalCount * 100
   */
  static getPolarityScore(energies: Energy[]): number {
    const totalCount = energies.length;

    let imbalanceSum = 0;
    for (const energy of energies) {
      if (energy.polarity === Polarity.Positive) {
        imbalanceSum += POSITIVE_WEIGHT;
      } else {
        imbalanceSum += NEGATIVE_WEIGHT;
      }
    }

    const imbalance = Math.abs(imbalanceSum);
    const balancedCount = totalCount - imbalance;
    const score = (balancedCount * 100) / totalCount;

    return score;
  }

  // -------------------------------------------------------------------------
  // Element score
  // -------------------------------------------------------------------------

  /**
   * Score the element relationships between each pair of adjacent energies.
   *
   * For every consecutive pair (current -> next):
   *   - Generating pair  (Sang-Saeng):  +15 bonus   (good)
   *   - Overcoming pair  (Sang-Geuk):   -20 penalty (bad)
   *   - Same element:                    -5 penalty  (mildly bad)
   *
   * The raw total starts at a base score of 70 and is then clamped
   * into the range [0, 100].
   */
  static getElementScore(energies: Energy[]): number {
    let generatingPairCount  = 0;
    let overcomingPairCount  = 0;
    let sameElementPairCount = 0;

    for (let index = 0; index < energies.length - 1; index++) {
      const currentEnergy = energies[index];
      const nextEnergy    = energies[index + 1];

      if (currentEnergy.element.isGenerating(nextEnergy.element)) {
        generatingPairCount++;
      } else if (currentEnergy.element.isOvercoming(nextEnergy.element)) {
        overcomingPairCount++;
      } else if (currentEnergy.element === nextEnergy.element) {
        sameElementPairCount++;
      }
    }

    const rawScore =
      BASE_SCORE
      + generatingPairCount  * GENERATING_BONUS
      + overcomingPairCount  * OVERCOMING_PENALTY
      + sameElementPairCount * SAME_ELEMENT_PENALTY;

    const clampedScore = Math.min(
      MAXIMUM_ELEMENT_SCORE,
      Math.max(MINIMUM_ELEMENT_SCORE, rawScore),
    );

    return clampedScore;
  }
}
