import type { UserInfo, SeedResult, NamingResult, PureHangulNameMode } from './types.js';
import { FourFrameCalculator } from './calculator/frame-calculator.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import type { HanjaEntry } from './database/hanja-repository.js';
import { toHangulOnlyEntry } from './utils/hangul-name-entry.js';
import { SeedCalculationError } from './errors.js';
import {
  areEntriesHangulOnly,
  assertNameEntriesForAnalysis,
  assertValidUserInfoEnvelope,
  cloneNameEntries,
} from './validation.js';
import { deepFreeze } from './utils/deep-freeze.js';

const ENABLE_HANJA_EVALUATION = true;
const ENABLE_FOURFRAME_EVALUATION = true;

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
    const includeFourFrame = ENABLE_FOURFRAME_EVALUATION && !pureHangulMode;
    const includeHanja = ENABLE_HANJA_EVALUATION && !pureHangulMode;

    /**
     * 2. Perform Calculations
     * Each calculator internalizes the naming theory logic.
     */
    if (includeFourFrame) fourFrames.calculate();
    else fourFrames.excludeFromAnalysis();
    hangul.calculate();
    if (includeHanja) hanja.calculate();
    else hanja.excludeFromAnalysis();

    /**
     * 3. Aggregate Results into a Candidate
     * Total score is the arithmetic mean of the enabled calculator results.
     */
    const mainCandidate: NamingResult = {
      lastName,
      firstName,
      totalScore: this.calculateTotalScore(
        fourFrames,
        hangul,
        hanja,
        includeFourFrame,
        includeHanja,
      ),
      fourFrames,
      fourFrameEnrichment: fourFrames.enrichment,
      hangul,
      hanja,
      pureHangulMode,
      interpretation: pureHangulMode
        ? 'Pure Hangul mode: evaluated mainly with Hangul phonetics.'
        : 'This name is evaluated with Hangul phonetics.'
    };

    /**
     * 4. Return final SeedResult containing candidates
     */
    return deepFreeze({
      candidates: [mainCandidate],
      totalCount: 1
    });
  }

  /**
   * Calculates the arithmetic mean of the enabled naming-theory scores.
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
    if (scores.some((score) => !Number.isFinite(score))) {
      throw new SeedCalculationError(
        'NON_FINITE_SCORE',
        'Every component score must be finite.',
        'scores',
        scores,
      );
    }

    const totalScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    if (!Number.isFinite(totalScore)) {
      throw new SeedCalculationError(
        'NON_FINITE_SCORE',
        'Aggregated score must be finite.',
        'totalScore',
        totalScore,
      );
    }
    return totalScore;
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
    // Validate mode-driving fields before deciding which entry fields are derived.
    assertValidUserInfoEnvelope(userInfo);

    const mode: PureHangulNameMode = userInfo.options?.pureHangulNameMode ?? 'auto';
    const useSurnameHanja = userInfo.options?.useSurnameHanjaInPureHangul ?? false;
    const givenNameHasOnlyHangul = areEntriesHangulOnly(userInfo.firstName);
    const pureHangulMode = mode === 'on' || (mode !== 'off' && givenNameHasOnlyHangul);
    const convertLastNameToHangul = pureHangulMode && !useSurnameHanja;
    const convertFirstNameToHangul = pureHangulMode;

    assertNameEntriesForAnalysis(userInfo, {
      convertLastNameToHangul,
      convertFirstNameToHangul,
    });

    const lastName = cloneNameEntries(userInfo.lastName);
    const firstName = cloneNameEntries(userInfo.firstName);
    if (!pureHangulMode) {
      return { lastName, firstName, pureHangulMode: false };
    }

    const resolvedLastName = convertLastNameToHangul
      ? lastName.map((entry) => toHangulOnlyEntry(entry, { hanja: '' }))
      : lastName;
    const resolvedFirstName = firstName.map((entry) => toHangulOnlyEntry(entry, { hanja: '' }));

    return {
      lastName: resolvedLastName,
      firstName: resolvedFirstName,
      pureHangulMode: true,
    };
  }
}
