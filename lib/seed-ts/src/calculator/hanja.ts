import { NameCalculator, type EvalContext, type AnalysisDetail } from './base.js';
import type { CalculatorPacket } from './graph.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HanjaAnalysis } from '../types.js';
import type { ElementKey } from './element-cycle.js';
import { distributionFromArrangement } from './element-cycle.js';
import {
  calculateArrayScore, calculateBalanceScore,
  checkPolarityHarmony, polarityScore, type PolarityValue,
} from './rules.js';
import { NODE_STROKE_ELEMENT_PASS } from './constants.js';

// ── HanjaCalculator ─────────────────────────────────────────────

export class HanjaCalculator extends NameCalculator {
  readonly id = 'hanja';

  private readonly entries: HanjaEntry[];
  private energies: Energy[] = [];
  private ohaengScore = 0;
  private eumyangScore = 0;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
  ) {
    super();
    this.entries = [...surnameEntries, ...givenNameEntries];
  }

  // ── Forward pass ────────────────────────────────────────────

  visit(ctx: EvalContext): void {
    // 1. Build per-character energies (polarity from strokes, element from resource_element)
    this.energies = this.entries.map(e =>
      new Energy(Polarity.get(e.strokes), Element.get(e.resource_element)),
    );

    // 2. Stroke-element (HOEKSU_OHAENG) -- uses stroke_element, not resource_element
    const elArr = this.getStrokeElementArrangement() as ElementKey[];
    const distribution = distributionFromArrangement(elArr);
    const adjacencyScore = calculateArrayScore(elArr, ctx.surnameLength);
    const balanceScore = calculateBalanceScore(distribution);
    this.ohaengScore = (balanceScore + adjacencyScore) / 2;
    const ohaengPassed = balanceScore >= NODE_STROKE_ELEMENT_PASS;

    this.setInsight(ctx, NameCalculator.createInsight(
      'HOEKSU_OHAENG', this.ohaengScore, ohaengPassed,
      elArr.join('-'),
      { distribution, adjacencyScore, balanceScore },
    ));

    // 3. Stroke-polarity (HOEKSU_EUMYANG)
    const polArr = this.getStrokePolarityArrangement() as PolarityValue[];
    const negCount = polArr.filter(v => v === 'Negative').length;
    const posCount = polArr.length - negCount;
    this.eumyangScore = polarityScore(negCount, posCount);
    const eumyangPassed = checkPolarityHarmony(polArr, ctx.surnameLength);

    this.setInsight(ctx, NameCalculator.createInsight(
      'HOEKSU_EUMYANG', this.eumyangScore, eumyangPassed,
      polArr.join(''),
      { arrangementList: polArr },
    ));
  }

  // ── Backward pass ───────────────────────────────────────────

  backward(ctx: EvalContext): CalculatorPacket {
    // HOEKSU_OHAENG has weight 0 -- supplementary frame, no signal emitted.
    // Only HOEKSU_EUMYANG emits a signal.
    return {
      nodeId: this.id,
      signals: [
        this.signal('HOEKSU_EUMYANG', ctx, 0.6),
      ],
    };
  }

  // ── Analysis ────────────────────────────────────────────────

  getAnalysis(): AnalysisDetail<HanjaAnalysis> {
    return {
      type: 'Hanja',
      score: (this.ohaengScore + this.eumyangScore) / 2,
      polarityScore: this.eumyangScore,
      elementScore: this.ohaengScore,
      data: {
        blocks: this.entries.map((e, i) => ({
          hanja: e.hanja,
          hangul: e.hangul,
          strokes: e.strokes,
          resourceElement: e.resource_element,
          strokeElement: e.stroke_element,
          polarity: this.energies[i]?.polarity.english ?? '',
        })),
        polarityScore: this.eumyangScore,
        elementScore: this.ohaengScore,
      },
    };
  }

  // ── Public getters ──────────────────────────────────────────

  getStrokeElementArrangement(): string[] {
    return this.entries.map(e => e.stroke_element);
  }

  getRootElementArrangement(): string[] {
    return this.entries.map(e => e.resource_element);
  }

  getStrokePolarityArrangement(): string[] {
    return this.entries.map(e => Polarity.get(e.strokes).english);
  }
}
