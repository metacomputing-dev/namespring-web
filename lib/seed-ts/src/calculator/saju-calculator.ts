import { EnergyCalculator, type AnalysisDetail } from './energy-calculator.js';
import { Energy } from '../model/energy.js';
import { Element } from '../model/element.js';
import type { SajuCompatibility } from '../types.js';

/**
 * Calculates saju (four pillars) compatibility score for a name.
 * Scores how well the name's five-element energies align with
 * the yongshin (favorable element) from saju analysis.
 */
export class SajuCalculator extends EnergyCalculator {
  public readonly type = 'Saju';

  private score: number = 0;
  private matchCount: number = 0;
  private generatingCount: number = 0;
  private overcomingCount: number = 0;

  constructor(
    private readonly yongshin: Element,
    private readonly heeshin: Element | null,
    private readonly nameEnergies: Energy[],
  ) {
    super();
  }

  protected doCalculate(): void {
    let baseScore = 50;
    this.matchCount = 0;
    this.generatingCount = 0;
    this.overcomingCount = 0;

    for (const energy of this.nameEnergies) {
      const el = energy.element;

      if (el.isSameAs(this.yongshin)) {
        // Direct match with yongshin: strong bonus
        baseScore += 15;
        this.matchCount++;
      } else if (el.isGenerating(this.yongshin) || this.yongshin.isGenerating(el)) {
        // Generating relationship (either direction): moderate bonus
        baseScore += 10;
        this.generatingCount++;
      } else if (el.isOvercoming(this.yongshin) || this.yongshin.isOvercoming(el)) {
        // Overcoming relationship: penalty
        baseScore -= 12;
        this.overcomingCount++;
      }

      // Heeshin bonus (smaller)
      if (this.heeshin) {
        if (el.isSameAs(this.heeshin)) {
          baseScore += 8;
          this.matchCount++;
        } else if (el.isGenerating(this.heeshin) || this.heeshin.isGenerating(el)) {
          baseScore += 5;
          this.generatingCount++;
        }
      }
    }

    this.score = Math.min(100, Math.max(0, baseScore));
  }

  public getScore(): number {
    return this.score;
  }

  public getAnalysis(): AnalysisDetail<SajuCompatibility> {
    return {
      type: this.type,
      score: this.score,
      polarityScore: 0,
      elementScore: this.score,
      data: {
        yongshinElement: this.yongshin.english,
        nameElements: this.nameEnergies.map(e => e.element.english),
        matchCount: this.matchCount,
        generatingCount: this.generatingCount,
        overcomingCount: this.overcomingCount,
        affinityScore: this.score,
      },
    };
  }
}
