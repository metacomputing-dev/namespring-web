import { NameCalculator, type EvalContext, type AnalysisDetail } from './base.js';
import type { CalculatorPacket } from './graph.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { SajuCompatibility } from '../types.js';
import type { ElementKey } from './element-cycle.js';
import { distributionFromArrangement, elementFromSajuCode } from './element-cycle.js';
import { computeSajuNameScore, type SajuNameScoreResult, type SajuOutputSummary } from './saju-scorer.js';

/**
 * Saju (Four Pillars) calculator node.
 *
 * Owns a single evaluation frame: SAJU_JAWON_BALANCE.
 * Builds element distributions from surname + given-name hanja entries
 * and delegates composite scoring to {@link computeSajuNameScore}.
 */
export class SajuCalculator extends NameCalculator {
  readonly id = 'saju';
  private scoreResult: SajuNameScoreResult | null = null;
  private sajuOutput: SajuOutputSummary | null = null;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
  ) { super(); }

  visit(ctx: EvalContext): void {
    this.sajuOutput = ctx.sajuOutput;

    const rootArr = [...this.surnameEntries, ...this.givenNameEntries]
      .map(e => e.resource_element as ElementKey);
    const rootDist = distributionFromArrangement(rootArr);

    this.scoreResult = computeSajuNameScore(ctx.sajuDistribution, rootDist, ctx.sajuOutput);

    this.setInsight(ctx, NameCalculator.createInsight(
      'SAJU_JAWON_BALANCE',
      this.scoreResult.score,
      this.scoreResult.isPassed,
      'SAJU+JAWON',
      {
        sajuDistribution: ctx.sajuDistribution,
        sajuDistributionSource: ctx.sajuOutput ? 'saju-ts' : 'fallback',
        jawonDistribution: rootDist,
        sajuJawonDistribution: this.scoreResult.combined,
        sajuScoring: this.scoreResult.breakdown,
        sajuOutput: ctx.sajuOutput,
      },
    ));
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return {
      nodeId: this.id,
      signals: [this.signal('SAJU_JAWON_BALANCE', ctx, 1.0)],
    };
  }

  getAnalysis(): AnalysisDetail<SajuCompatibility> {
    const breakdown = this.scoreResult?.breakdown;
    const yongshin = this.sajuOutput?.yongshin;

    return {
      type: 'Saju',
      score: this.scoreResult?.score ?? 0,
      polarityScore: 0,
      elementScore: this.scoreResult?.score ?? 0,
      data: {
        yongshinElement: elementFromSajuCode(yongshin?.finalYongshin) ?? '',
        heeshinElement: elementFromSajuCode(yongshin?.finalHeesin) ?? null,
        gishinElement: elementFromSajuCode(yongshin?.gisin) ?? null,
        nameElements: this.givenNameEntries.map(e => e.resource_element),
        yongshinMatchCount: breakdown?.elementMatches?.yongshin ?? 0,
        yongshinGeneratingCount: 0,
        gishinMatchCount: breakdown?.elementMatches?.gisin ?? 0,
        gishinOvercomingCount: 0,
        deficiencyFillCount: 0,
        excessiveAvoidCount: 0,
        dayMasterSupportScore: breakdown?.strength ?? 0,
        affinityScore: this.scoreResult?.score ?? 0,
      },
    };
  }
}
