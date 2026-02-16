/**
 * HangulCalculator -- Analyse the pronunciation energy of a Korean name.
 *
 * Every Korean syllable has two pronunciation properties:
 *
 *   1. ELEMENT (Oh-Haeng / Five Elements)
 *      Determined by the first consonant (onset) of the syllable.
 *      For example, "ㄱ" maps to Wood, "ㄴ" maps to Fire, etc.
 *      A good name has elements that flow in the "generating" cycle
 *      (Wood -> Fire -> Earth -> Metal -> Water -> Wood) rather than
 *      clashing in the "overcoming" cycle.
 *
 *   2. POLARITY (Yin-Yang / Positive-Negative)
 *      Determined by the vowel (nucleus) of the syllable.
 *      Bright, open vowels like "ㅏ" are Positive (Yang).
 *      Darker, closed vowels like "ㅓ" are Negative (Yin).
 *      A good name mixes both polarities rather than using all one kind.
 *
 * This calculator scores both properties and reports the results.
 *
 * All linguistic data (which vowels are Yang, which consonant maps to which
 * element, Unicode constants) is loaded from config/korean-phonetics.json.
 * All scoring thresholds and weights are loaded from config/scoring-rules.json.
 */

import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import { Energy } from '../model/energy.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { HangulAnalysis } from '../model/types.js';
import {
  type ElementKey, type PolarityValue,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  checkElementGenerating, countDominant, computePolarityResult,
} from './scoring.js';

import koreanPhonetics from '../../config/korean-phonetics.json';
import scoringRules from '../../config/scoring-rules.json';


// ---------------------------------------------------------------------------
// Configuration: Korean phonetics
// ---------------------------------------------------------------------------

/** The set of vowels classified as Yang (Positive / bright). */
const YANG_VOWELS: ReadonlySet<string> = new Set(koreanPhonetics.yangVowels);

/**
 * Mapping from onset consonant to its Five-Element classification.
 * For example: "ㄱ" -> Wood, "ㄴ" -> Fire, "ㅁ" -> Water, etc.
 */
const ONSET_TO_ELEMENT: Readonly<Record<string, string>> = koreanPhonetics.onsetToElement;

/** The ordered list of onset consonants (choseong) in Unicode order. */
const CHOSEONG_LIST: readonly string[] = koreanPhonetics.choseong;

/** Unicode constants for decomposing Hangul syllable blocks. */
const HANGUL_BASE          = koreanPhonetics.hangulUnicode.base;            // 0xAC00 = 44032
const HANGUL_END           = koreanPhonetics.hangulUnicode.end;             // 0xD7A3 = 55203
const SYLLABLES_PER_ONSET  = koreanPhonetics.hangulUnicode.syllablesPerOnset; // 588


// ---------------------------------------------------------------------------
// Configuration: Scoring thresholds and weights
// ---------------------------------------------------------------------------

const elementRules  = scoringRules.hangulElement;
const polarityRules = scoringRules.hangulPolarity;

/** Minimum adjacency score needed: higher bar for double-character surnames. */
const DOUBLE_SURNAME_ADJACENCY_THRESHOLD = elementRules.doubleSurnameThreshold; // 65
const SINGLE_SURNAME_ADJACENCY_THRESHOLD = elementRules.singleSurnameThreshold; // 60

/** The combined element score must reach this level to pass. */
const MIN_ELEMENT_PASSING_SCORE = elementRules.minPassingScore;                 // 70

/** How heavily this calculator's signals contribute to the overall score. */
const ELEMENT_SIGNAL_WEIGHT  = elementRules.signalWeight;                       // 0.6
const POLARITY_SIGNAL_WEIGHT = polarityRules.signalWeight;                      // 0.6


// ---------------------------------------------------------------------------
// Helper: Determine the polarity of a vowel
// ---------------------------------------------------------------------------

/**
 * Classify a Korean vowel as Positive (Yang) or Negative (Yin).
 *
 * Yang vowels are the bright, outward-directed sounds: ㅏ ㅐ ㅑ ㅒ ㅗ ㅘ ㅙ ㅚ ㅛ ㅣ
 * All other vowels are Yin (Negative).
 */
function polarityFromVowel(nucleus: string): Polarity {
  const isYangVowel = YANG_VOWELS.has(nucleus);
  return isYangVowel ? Polarity.Positive : Polarity.Negative;
}


// ---------------------------------------------------------------------------
// Helper: Determine the element of a syllable from its onset consonant
// ---------------------------------------------------------------------------

/**
 * Extract the onset consonant from a Hangul syllable character and look up
 * its Five-Element classification.
 *
 * How Korean Unicode works:
 *   Each composed Hangul syllable (e.g. "가", "나", "다") is stored as a
 *   single Unicode code point. The onset consonant can be recovered by:
 *     1. Subtract the Hangul base (0xAC00) to get a zero-based index.
 *     2. Divide by 588 (the number of syllables sharing one onset) to get
 *        the onset index into the choseong list.
 *     3. Look up the consonant letter and then its element.
 *
 * If the character is not a valid Hangul syllable, we default to Water.
 */
function elementFromOnset(syllableChar: string): Element {
  const codeOffset = syllableChar.charCodeAt(0) - HANGUL_BASE;

  const isValidHangulSyllable = codeOffset >= 0 && codeOffset <= (HANGUL_END - HANGUL_BASE);
  if (!isValidHangulSyllable) {
    return Element.Water;
  }

  const onsetIndex    = Math.floor(codeOffset / SYLLABLES_PER_ONSET);
  const onsetLetter   = CHOSEONG_LIST[onsetIndex] ?? 'ㅇ';
  const elementName   = ONSET_TO_ELEMENT[onsetLetter] ?? 'Water';

  return Element.get(elementName);
}


// ---------------------------------------------------------------------------
// The calculator
// ---------------------------------------------------------------------------

export class HangulCalculator extends NameCalculator {
  readonly id = 'hangul';

  /** Each block holds a character entry and its computed pronunciation energy. */
  private readonly blocks: { readonly entry: HanjaEntry; energy: Energy | null }[];

  /** The sequence of elements across all characters, in name order. */
  private elementArrangement: ElementKey[] = [];

  /** The sequence of polarities across all characters, in name order. */
  private polarityArrangement: PolarityValue[] = [];

  public elementScore = 0;
  public polarityScore = 0;

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super();
    this.blocks = [...surnameEntries, ...givenNameEntries].map(entry => ({ entry, energy: null }));
  }

  // -------------------------------------------------------------------------
  // visit() -- the main analysis pipeline
  // -------------------------------------------------------------------------

  visit(ctx: EvalContext): void {
    // ----- Step 1: Analyse each character's pronunciation energy ------------
    //
    // For every character in the name, determine:
    //   - which element its onset consonant belongs to
    //   - whether its vowel is Yang (Positive) or Yin (Negative)

    for (const block of this.blocks) {
      const element  = elementFromOnset(block.entry.hangul);
      const polarity = polarityFromVowel(block.entry.nucleus);

      block.energy = new Energy(polarity, element);

      this.elementArrangement.push(element.english as ElementKey);
      this.polarityArrangement.push(polarity.english as PolarityValue);
    }

    // ----- Step 2: Score the element arrangement ---------------------------
    //
    // A good element arrangement has:
    //   - Adjacent characters in a "generating" relationship
    //   - No dominant element that appears more than half the time
    //   - A balanced spread across the five elements
    //   - No "overcoming" clashes between neighbours

    const elementDistribution   = distributionFromArrangement(this.elementArrangement);
    const adjacencyScore        = calculateArrayScore(this.elementArrangement, ctx.surnameLength);
    const balanceScore          = calculateBalanceScore(elementDistribution);
    const combinedElementScore  = (balanceScore + adjacencyScore) / 2;

    const adjacencyThreshold = ctx.surnameLength === 2
      ? DOUBLE_SURNAME_ADJACENCY_THRESHOLD
      : SINGLE_SURNAME_ADJACENCY_THRESHOLD;

    const noClashingNeighbours = checkElementGenerating(this.elementArrangement, ctx.surnameLength);
    const noSingleDominant     = !countDominant(elementDistribution);
    const adjacencyIsStrong    = adjacencyScore >= adjacencyThreshold;
    const overallScoreIsHigh   = combinedElementScore >= MIN_ELEMENT_PASSING_SCORE;

    const elementPassed =
      noClashingNeighbours &&
      noSingleDominant &&
      adjacencyIsStrong &&
      overallScoreIsHigh;

    this.elementScore = combinedElementScore;

    this.putInsight(ctx, 'HANGUL_ELEMENT', combinedElementScore, elementPassed,
      this.elementArrangement.join('-'),
      { distribution: elementDistribution, adjacencyScore, balanceScore },
    );

    // ----- Step 3: Score the polarity arrangement --------------------------
    //
    // A good polarity arrangement mixes Positive and Negative characters
    // rather than using all the same kind. The detailed scoring logic lives
    // in computePolarityResult().

    const polarityResult = computePolarityResult(this.polarityArrangement, ctx.surnameLength);

    this.polarityScore = polarityResult.score;

    this.putInsight(ctx, 'HANGUL_POLARITY', polarityResult.score, polarityResult.isPassed,
      this.polarityArrangement.join(''),
      { arrangementList: this.polarityArrangement },
    );
  }

  // -------------------------------------------------------------------------
  // backward() -- emit scoring signals for the overall evaluation
  // -------------------------------------------------------------------------

  backward(ctx: EvalContext): CalculatorPacket {
    return {
      signals: [
        this.signal('HANGUL_ELEMENT',  ctx, ELEMENT_SIGNAL_WEIGHT),
        this.signal('HANGUL_POLARITY', ctx, POLARITY_SIGNAL_WEIGHT),
      ],
    };
  }

  // -------------------------------------------------------------------------
  // getAnalysis() -- build the detailed analysis report
  // -------------------------------------------------------------------------

  getAnalysis(): AnalysisDetail<HangulAnalysis> {
    const energies = this.blocks
      .map(block => block.energy)
      .filter((energy): energy is Energy => energy !== null);

    const polarityScoreValue = this.polarityScore;
    const elementScoreValue  = this.elementScore;

    return {
      type: this.id,
      score: Energy.getPolarityScore(energies) * 0.5 + Energy.getElementScore(energies) * 0.5,
      polarityScore: polarityScoreValue,
      elementScore:  elementScoreValue,
      data: {
        blocks: this.blocks.map(block => ({
          hangul:   block.entry.hangul,
          onset:    block.entry.onset,
          nucleus:  block.entry.nucleus,
          element:  block.energy?.element.english ?? '',
          polarity: block.energy?.polarity.english ?? '',
        })),
        polarityScore: polarityScoreValue,
        elementScore:  elementScoreValue,
      },
    };
  }

  // -------------------------------------------------------------------------
  // getScore() / getNameBlocks() -- simple accessors
  // -------------------------------------------------------------------------

  getScore(): number {
    return this.getAnalysis().score;
  }

  getNameBlocks(): ReadonlyArray<{ readonly entry: HanjaEntry; energy: Energy | null }> {
    return this.blocks;
  }
}
