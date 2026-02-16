/**
 * HanjaCalculator -- Chinese character stroke analysis for Korean names.
 *
 * Each Chinese character (Hanja) has a known stroke count. From that stroke
 * count two properties are derived:
 *
 *   1. **Polarity** (Yin / Yang)
 *      - Odd  stroke count  =>  Positive (Yang)
 *      - Even stroke count  =>  Negative (Yin)
 *      A good name alternates between Yin and Yang across its characters.
 *
 *   2. **Five-Element** (Wood, Fire, Earth, Metal, Water)
 *      Each character maps to one of the five classical elements based on its
 *      stroke count modulo 10. A good name has a balanced distribution of
 *      elements and avoids destructive (Sang-Geuk) adjacencies.
 *
 * The calculator scores both dimensions independently, then averages them
 * into a single overall score.
 */

import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import { Energy } from '../model/energy.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HanjaAnalysis } from '../model/types.js';
import {
  type ElementKey, type PolarityValue,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  computePolarityResult,
} from './scoring.js';
import scoringRules from '../../config/scoring-rules.json';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** How heavily the stroke-polarity signal weighs in the final evaluation. */
const STROKE_POLARITY_SIGNAL_WEIGHT = scoringRules.strokePolarity.signalWeight;

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export class HanjaCalculator extends NameCalculator {
  readonly id = 'hanja';
  private readonly entries: HanjaEntry[];
  private energies: Energy[] = [];
  public elementScore = 0;
  public polarityScore = 0;

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super();
    this.entries = [...surnameEntries, ...givenNameEntries];
  }

  // -------------------------------------------------------------------------
  // visit -- the main scoring pipeline
  // -------------------------------------------------------------------------

  visit(ctx: EvalContext): void {

    // Step 1: Convert each Hanja entry into an Energy object.
    //         Energy combines polarity (Yin/Yang from stroke count)
    //         with the character's resource element (Wood, Fire, etc.).
    this.energies = this.entries.map(
      (entry) => new Energy(
        Polarity.get(entry.strokes),
        Element.get(entry.resource_element),
      ),
    );

    // Step 2: Build the element arrangement -- the sequence of five-element
    //         values across all characters in the name.
    const elementArrangement = this.entries.map(
      (entry) => entry.stroke_element,
    ) as ElementKey[];

    // Step 3: Score element distribution and adjacency.
    //         - "balance" measures whether the five elements are evenly spread.
    //         - "adjacency" rewards generating cycles (Wood->Fire) and
    //           penalizes destructive cycles (Wood->Earth).
    //         The element score is the average of the two.
    const elementDistribution = distributionFromArrangement(elementArrangement);
    const adjacencyScore      = calculateArrayScore(elementArrangement, ctx.surnameLength);
    const balanceScore        = calculateBalanceScore(elementDistribution);
    this.elementScore         = (balanceScore + adjacencyScore) / 2;

    const elementPassed = balanceScore >= 60;

    this.putInsight(ctx, 'STROKE_ELEMENT', this.elementScore, elementPassed,
      elementArrangement.join('-'),
      { distribution: elementDistribution, adjacencyScore, balanceScore },
    );

    // Step 4: Build the polarity arrangement -- the sequence of Yin/Yang
    //         values across all characters in the name.
    const polarityArrangement = this.entries.map(
      (entry) => Polarity.get(entry.strokes).english,
    ) as PolarityValue[];

    // Step 5: Score polarity balance.
    //         A name scores highest when Yin and Yang alternate evenly.
    //         Pure-Yin or pure-Yang names receive the lowest scores.
    const polarityResult = computePolarityResult(polarityArrangement, ctx.surnameLength);
    this.polarityScore   = polarityResult.score;

    this.putInsight(ctx, 'STROKE_POLARITY', polarityResult.score, polarityResult.isPassed,
      polarityArrangement.join(''),
      { arrangementList: polarityArrangement },
    );
  }

  // -------------------------------------------------------------------------
  // backward -- emit scoring signals for the evaluation aggregator
  // -------------------------------------------------------------------------

  backward(ctx: EvalContext): CalculatorPacket {
    return {
      signals: [
        this.signal('STROKE_POLARITY', ctx, STROKE_POLARITY_SIGNAL_WEIGHT),
      ],
    };
  }

  // -------------------------------------------------------------------------
  // getAnalysis -- build the structured analysis report
  // -------------------------------------------------------------------------

  getAnalysis(): AnalysisDetail<HanjaAnalysis> {
    const polarityScoreValue = this.polarityScore;
    const elementScoreValue  = this.elementScore;
    const overallScore       = (elementScoreValue + polarityScoreValue) / 2;

    const blocks = this.entries.map((entry, index) => ({
      hanja:           entry.hanja,
      hangul:          entry.hangul,
      strokes:         entry.strokes,
      resourceElement: entry.resource_element,
      strokeElement:   entry.stroke_element,
      polarity:        this.energies[index]?.polarity.english ?? '',
    }));

    return {
      type: 'Hanja',
      score: overallScore,
      polarityScore: polarityScoreValue,
      elementScore: elementScoreValue,
      data: {
        blocks,
        polarityScore: polarityScoreValue,
        elementScore: elementScoreValue,
      },
    };
  }

  // -------------------------------------------------------------------------
  // getScore / getNameBlocks -- convenience accessors
  // -------------------------------------------------------------------------

  getScore(): number {
    return this.getAnalysis().score;
  }

  getNameBlocks(): ReadonlyArray<{ readonly entry: HanjaEntry; energy: Energy | null }> {
    return this.entries.map((entry, index) => ({
      entry,
      energy: this.energies[index] ?? null,
    }));
  }
}
