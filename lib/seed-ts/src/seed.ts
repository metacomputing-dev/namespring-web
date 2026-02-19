import type { UserInfo, SeedResult, NamingResult, PureHangulNameMode } from './types';
import { FourFrameCalculator } from './calculator/frame-calculator';
import { HangulCalculator } from './calculator/hangul-calculator';
import { HanjaCalculator } from './calculator/hanja-calculator';
import type { HanjaEntry } from './database/hanja-repository';
import { toHangulOnlyEntry } from './utils/hangul-name-entry';
import type { Energy } from './model/energy';
import { Polarity } from './model/polarity';
import { Element } from './model/element';

const ENABLE_HANJA_EVALUATION = false;
const ENABLE_FOURFRAME_EVALUATION = false;

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
    const {
      lastName,
      firstName,
      pureHangulMode,
    } = this.resolveEntriesForAnalysis(userInfo);

    /**
     * 1. Initialize Calculators
     * Directly passing HanjaEntry arrays which already contain stroke counts 
     * and elemental information from the repository.
     */
    const fourFrames = this.createFourFrameCalculator(lastName, firstName);
    const hangul = this.createHangulCalculator(lastName, firstName);
    const hanja = this.createHanjaCalculator(lastName, firstName);

    /**
     * 2. Perform Calculations
     * Each calculator internalizes the naming theory logic.
     */
    if (ENABLE_FOURFRAME_EVALUATION) {
      fourFrames.calculate();
    }
    hangul.calculate();
    if (ENABLE_HANJA_EVALUATION) {
      hanja.calculate();
    }

    /**
     * 3. Aggregate Results into a Candidate
     * Total score is now the simple sum of individual calculator results.
     */
    const mainCandidate: NamingResult = {
      lastName,
      firstName,
      totalScore: this.calculateTotalScore(
        fourFrames,
        hangul,
        hanja,
        ENABLE_FOURFRAME_EVALUATION,
        ENABLE_HANJA_EVALUATION && !pureHangulMode,
      ),
      fourFrames,
      hangul,
      hanja,
      interpretation: pureHangulMode
        ? 'Pure Hangul mode: evaluated mainly with Hangul phonetics.'
        : 'This name is evaluated with Hangul phonetics.'
    };

    /**
     * 4. Return final SeedResult containing candidates
     */
    return {
      candidates: [mainCandidate],
      totalCount: 1
    };
  }

  /**
   * Calculates the final score by summing up the scores from each naming theory.
   * @param fourFrames Result of the Four Frames (Saju) calculation
   * @param hangul Result of the Hangul (Phonetic) calculation
   * @param hanja Result of the Hanja (Resource Element) calculation
   */
  protected calculateTotalScore(
    fourFrames: FourFrameCalculator,
    hangul: HangulCalculator,
    hanja: HanjaCalculator,
    includeFourFrame: boolean = false,
    includeHanja: boolean = true,
  ): number {
    // TODO Currently a simple average, but can be weighted by theory confidence in the future.
    const scores = [hangul.getScore()];
    if (includeFourFrame) {
      scores.push(fourFrames.getScore());
    }
    if (includeHanja) {
      scores.push(hanja.getScore());
    }
    return scores.reduce((sum, value) => sum + value, 0) / scores.length;
  }

  protected createFourFrameCalculator(lastName: UserInfo['lastName'], firstName: UserInfo['firstName']): FourFrameCalculator {
    return new FourFrameCalculator(lastName, firstName);
  }

  protected createHangulCalculator(lastName: UserInfo['lastName'], firstName: UserInfo['firstName']): HangulCalculator {
    return new HangulCalculator(lastName, firstName);
  }

  protected createHanjaCalculator(lastName: UserInfo['lastName'], firstName: UserInfo['firstName']): HanjaCalculator {
    return new HanjaCalculator(lastName, firstName);
  }

  private resolveEntriesForAnalysis(userInfo: UserInfo): {
    lastName: HanjaEntry[];
    firstName: HanjaEntry[];
    pureHangulMode: boolean;
  } {
    const { lastName, firstName } = userInfo;

    const mode: PureHangulNameMode = userInfo.options?.pureHangulNameMode ?? 'auto';
    const useSurnameHanja = userInfo.options?.useSurnameHanjaInPureHangul ?? false;

    const givenNameHasOnlyHangul = firstName.length > 0 && firstName.every((entry) => {
      const hanja = String(entry.hanja ?? '').trim();
      return hanja.length === 0 || hanja === entry.hangul;
    });

    const pureHangulMode = mode === 'on' || (mode !== 'off' && givenNameHasOnlyHangul);
    if (!pureHangulMode) {
      return { lastName, firstName, pureHangulMode: false };
    }

    const resolvedLastName = useSurnameHanja
      ? lastName
      : lastName.map((entry) => toHangulOnlyEntry(entry, { hanja: '' }));
    const resolvedFirstName = firstName.map((entry) => toHangulOnlyEntry(entry, { hanja: '' }));

    return {
      lastName: resolvedLastName,
      firstName: resolvedFirstName,
      pureHangulMode: true,
    };
  }
}
