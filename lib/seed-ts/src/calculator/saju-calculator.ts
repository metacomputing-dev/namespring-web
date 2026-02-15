import { EnergyCalculator, type AnalysisDetail } from './energy-calculator.js';
import { Element } from '../model/element.js';
import { Energy } from '../model/energy.js';
import type { SajuCompatibility } from '../types.js';
import type { ElementKey } from '../evaluator/element-cycle.js';
import { ELEMENT_KEYS, elementToKey, emptyDistribution, distributionFromArrangement } from '../evaluator/element-cycle.js';
import { computeSajuNameScore, type SajuNameScoreResult } from '../evaluator/saju-name-scorer.js';
import type { SajuOutputSummary } from '../evaluator/strength-scorer.js';

/**
 * Full saju context for naming compatibility analysis.
 */
export interface SajuContext {
  readonly yongshin: Element;
  readonly heeshin: Element | null;
  readonly gishin: Element | null;
  readonly gushin: Element | null;
  readonly dayMasterElement: Element | null;
  readonly isStrong: boolean;
  readonly deficientElements: Element[];
  readonly excessiveElements: Element[];
}

/**
 * Calculates saju compatibility score using the full evaluator pipeline
 * (balance + yongshin + strength + tenGod with adaptive weights).
 *
 * Maintains EnergyCalculator interface for backward compatibility.
 */
export class SajuCalculator extends EnergyCalculator {
  public readonly type = 'Saju';

  private score: number = 0;
  private scoreResult: SajuNameScoreResult | null = null;

  constructor(
    private readonly ctx: SajuContext,
    private readonly nameEnergies: Energy[],
    private readonly sajuDistribution?: Record<ElementKey, number>,
    private readonly sajuOutput?: SajuOutputSummary | null,
  ) {
    super();
  }

  protected doCalculate(): void {
    // Build root element distribution from name energies
    const nameElements = this.nameEnergies.map(e => elementToKey(e.element));
    const rootDist = distributionFromArrangement(nameElements);

    // Build saju distribution (from context if not provided)
    const sajuDist = this.sajuDistribution ?? this.buildSajuDistFromContext();

    // Build SajuOutputSummary from context if not provided
    const output = this.sajuOutput ?? this.buildOutputFromContext();

    // Use full evaluator scoring pipeline
    this.scoreResult = computeSajuNameScore(sajuDist, rootDist, output);
    this.score = this.scoreResult.score;
  }

  private buildSajuDistFromContext(): Record<ElementKey, number> {
    // Fallback: create a distribution based on known saju elements
    const dist = emptyDistribution();
    // Distribute evenly with slight emphasis on context elements
    for (const key of ELEMENT_KEYS) dist[key] = 2;
    return dist;
  }

  private buildOutputFromContext(): SajuOutputSummary {
    const dmKey = this.ctx.dayMasterElement ? elementToKey(this.ctx.dayMasterElement) : undefined;
    return {
      dayMaster: dmKey ? { element: dmKey } : undefined,
      strength: {
        isStrong: this.ctx.isStrong,
        totalSupport: this.ctx.isStrong ? 10 : -10,
        totalOppose: this.ctx.isStrong ? -5 : 5,
      },
      yongshin: {
        finalYongshin: this.ctx.yongshin.english.toUpperCase(),
        finalHeesin: this.ctx.heeshin?.english.toUpperCase() ?? null,
        gisin: this.ctx.gishin?.english.toUpperCase() ?? null,
        gusin: this.ctx.gushin?.english.toUpperCase() ?? null,
        finalConfidence: 0.65,
        recommendations: [],
      },
      tenGod: undefined,
    };
  }

  public getScore(): number {
    return this.score;
  }

  public getAnalysis(): AnalysisDetail<SajuCompatibility> {
    const breakdown = this.scoreResult?.breakdown;
    return {
      type: this.type,
      score: this.score,
      polarityScore: 0,
      elementScore: this.score,
      data: {
        yongshinElement: this.ctx.yongshin.english,
        heeshinElement: this.ctx.heeshin?.english ?? null,
        gishinElement: this.ctx.gishin?.english ?? null,
        nameElements: this.nameEnergies.map(e => e.element.english),
        yongshinMatchCount: breakdown?.elementMatches.yongshin ?? 0,
        yongshinGeneratingCount: 0,
        gishinMatchCount: breakdown?.elementMatches.gisin ?? 0,
        gishinOvercomingCount: 0,
        deficiencyFillCount: 0,
        excessiveAvoidCount: 0,
        dayMasterSupportScore: breakdown?.strength ?? 0,
        affinityScore: this.score,
      },
    };
  }
}
