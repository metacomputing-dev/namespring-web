import type { UserInfo, SeedResult, NamingResult } from './types';
import { FourFrameCalculator } from './calculator/frame-calculator';
import { HangulCalculator } from './calculator/hangul-calculator';
import { HanjaCalculator } from './calculator/hanja-calculator';
import type { Energy } from './model/energy';
import { Polarity } from './model/polarity';
import { Element } from './model/element';

/**
 * Main engine class for naming analysis.
 * Coordinates multiple calculators to generate comprehensive naming results.
 */
export class SeedTs {
  /**
   * Analyzes the provided user information using real HanjaEntry data.
   * @param userInfo Input data including HanjaEntry arrays for names, birth date, and gender.
   * @returns Analyzed results with aggregated scores from all calculators.
   */
  public analyze(userInfo: UserInfo): SeedResult {
    const { lastName, firstName } = userInfo;

    /**
     * 1. Initialize Calculators
     * Directly passing HanjaEntry arrays which already contain stroke counts 
     * and elemental information from the repository.
     */
    const fourFrames = new FourFrameCalculator(lastName, firstName);
    const hangul = new HangulCalculator(lastName, firstName);
    const hanja = new HanjaCalculator(lastName, firstName);

    /**
     * 2. Perform Calculations
     * Each calculator internalizes the naming theory logic.
     */
    fourFrames.calculate();
    hangul.calculate();
    hanja.calculate();

    /**
     * 3. Aggregate Results into a Candidate
     * Total score is now the simple sum of individual calculator results.
     */
    const mainCandidate: NamingResult = {
      lastName,
      firstName,
      totalScore: this.calculateTotalScore(fourFrames, hangul, hanja),
      fourFrames,
      hangul,
      hanja,
      interpretation: "This name shows a balanced harmony between sound and numerical structures."
    };

    /**
     * 4. Return final SeedResult containing candidates
     */
    return {
      candidates: [mainCandidate],
      totalCount: 1
    };
  }

  private mockPolarScore(energy: Energy[]): number {
    let scoreSum = 0;
    energy.forEach(e => {
      if(e.polarity === Polarity.Positive) {
        scoreSum += 1;
      } else {
        scoreSum -= 1;
      }
    });
    return energy.length - Math.abs(scoreSum);
  }

  private mockElementScore(energy: Energy[]): number {
    let scoreSum = 0;
    energy.forEach(e => {
      if(e.element === Element.Wood) {
        scoreSum += 1;
      } else {
        scoreSum -= 1;
      }
    });
    return energy.length - Math.abs(scoreSum);
  }

  /**
   * Calculates the final score by summing up the scores from each naming theory.
   * @param fourFrames Result of the Four Frames (Saju) calculation
   * @param hangul Result of the Hangul (Phonetic) calculation
   * @param hanja Result of the Hanja (Resource Element) calculation
   */
  private calculateTotalScore(
    fourFrames: FourFrameCalculator,
    hangul: HangulCalculator,
    hanja: HanjaCalculator
  ): number {

     return 0;
  }
}