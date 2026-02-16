/**
 * FrameCalculator -- Four Pillar Frame (사격) Analysis
 *
 * In Korean naming tradition, each name is evaluated through four numerical
 * "frames" (격). Each frame is a sum of specific stroke counts drawn from the
 * surname and given-name characters:
 *
 *   Won   (원격) -- "Source Frame"    -- sum of given-name strokes only
 *   Hyung (형격) -- "Form Frame"      -- surname + upper half of given name
 *   Lee   (이격) -- "Benefit Frame"   -- surname + lower half of given name
 *   Jung  (정격) -- "Settling Frame"  -- surname + entire given name
 *
 * From these four stroke sums we derive two independent scores:
 *
 *   1. Luck Score (수리 길흉)
 *      Each stroke sum maps to a fortune level (최상, 상, 양, 흉, 최흉).
 *      A higher overall luck score means the name carries more auspicious
 *      numerical energy.
 *
 *   2. Element Score (오행 배치)
 *      The last digit of each stroke sum determines a Five-Element (오행).
 *      The three key frames (Lee, Hyung, Won) form an element arrangement
 *      that is checked for harmony -- no clashing (상극) pairs, good balance,
 *      and sufficient variety.
 */

import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import { Element } from '../model/element.js';
import { Polarity } from '../model/polarity.js';
import { Energy } from '../model/energy.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import { FourframeRepository, type FourframeMeaningEntry } from '../database/fourframe-repository.js';
import type { FourFrameAnalysis } from '../model/types.js';
import {
  type ElementKey, sum, adjustTo81,
  distributionFromArrangement, calculateArrayScore, calculateBalanceScore,
  checkFourFrameSuriElement, countDominant, bucketFromFortune,
} from './scoring.js';

// ---------------------------------------------------------------------------
// Configuration -- loaded from JSON so tuning values live in one place
// ---------------------------------------------------------------------------

import fiveElementsConfig from '../../config/five-elements.json';
import scoringRules from '../../config/scoring-rules.json';

/**
 * Maps a digit (0-9) to its Five Element.
 *
 * Example: digit 1 -> Wood, digit 3 -> Fire, digit 5 -> Earth
 *
 * The last digit of a stroke sum determines that frame's element.
 */
const DIGIT_TO_ELEMENT: readonly Element[] =
  (fiveElementsConfig.digitToElement as string[]).map(name => Element.get(name));

/** Signal weight for the four-frame luck score (primary importance). */
const LUCK_SIGNAL_WEIGHT: number = scoringRules.fourframeLuck.signalWeight;

/** Signal weight for the four-frame element score (secondary importance). */
const ELEMENT_SIGNAL_WEIGHT: number = scoringRules.fourframeElement.signalWeight;

/** Minimum adjacency score for double-surname names to pass element check. */
const DOUBLE_SURNAME_ADJACENCY_THRESHOLD: number = scoringRules.fourframeElement.doubleSurnameThreshold;

/** Minimum adjacency score for single-surname names to pass element check. */
const SINGLE_SURNAME_ADJACENCY_THRESHOLD: number = scoringRules.fourframeElement.singleSurnameThreshold;

/** Minimum combined element score to pass the element check. */
const MIN_ELEMENT_PASSING_SCORE: number = scoringRules.fourframeElement.minPassingScore;

// ---------------------------------------------------------------------------
// Element lookup
// ---------------------------------------------------------------------------

/**
 * Determine the Five Element for a given stroke sum.
 *
 * Only the last digit matters:
 *   0 -> Water, 1 -> Wood, 2 -> Wood, 3 -> Fire, 4 -> Fire,
 *   5 -> Earth, 6 -> Earth, 7 -> Metal, 8 -> Metal, 9 -> Water
 */
function elementFromStrokeSum(strokeSum: number): Element {
  return DIGIT_TO_ELEMENT[strokeSum % 10];
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Descriptive labels for the four frame types, for reference. */
// won  = 원격 (Source Frame)   -- given-name strokes only
// hyung = 형격 (Form Frame)    -- surname + upper given name
// lee  = 이격 (Benefit Frame)  -- surname + lower given name
// jung = 정격 (Settling Frame) -- surname + full given name

export interface Frame {
  readonly type: 'won' | 'hyung' | 'lee' | 'jung';
  readonly strokeSum: number;
  energy: Energy | null;
  entry: FourframeMeaningEntry | null;
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export class FrameCalculator extends NameCalculator {
  readonly id = 'frame';
  public readonly frames: Frame[];

  private static repo: FourframeRepository | null = null;
  private static repoInitPromise: Promise<void> | null = null;

  constructor(surnameEntries: HanjaEntry[], givenNameEntries: HanjaEntry[]) {
    super();

    // -- Extract raw stroke counts from Hanja entries -----------------------
    const surnameStrokes = surnameEntries.map(entry => entry.strokes);
    const givenNameStrokes = givenNameEntries.map(entry => entry.strokes);

    // -- Pad single-character given names with a zero -----------------------
    //    A single given-name character is treated as occupying the "upper"
    //    slot, with the "lower" slot empty (0 strokes).
    const paddedStrokes = [...givenNameStrokes];
    if (paddedStrokes.length === 1) paddedStrokes.push(0);

    // -- Split given name into upper and lower halves -----------------------
    const midPoint = Math.floor(paddedStrokes.length / 2);
    const upperGivenSum = sum(paddedStrokes.slice(0, midPoint));
    const lowerGivenSum = sum(paddedStrokes.slice(midPoint));

    // -- Compute surname and given-name totals ------------------------------
    const surnameTotal = sum(surnameStrokes);
    const givenNameTotal = sum(givenNameStrokes);

    // -- Build the four frames ----------------------------------------------
    this.frames = [
      { type: 'won',   strokeSum: sum(paddedStrokes),                         energy: null, entry: null },
      { type: 'hyung', strokeSum: adjustTo81(surnameTotal + upperGivenSum),   energy: null, entry: null },
      { type: 'lee',   strokeSum: adjustTo81(surnameTotal + lowerGivenSum),   energy: null, entry: null },
      { type: 'jung',  strokeSum: adjustTo81(surnameTotal + givenNameTotal),  energy: null, entry: null },
    ];

    // Fire-and-forget: load fortune/meaning entries from the database
    void this.loadEntries();
  }

  // -------------------------------------------------------------------------
  // Core lifecycle methods (called by the evaluation pipeline)
  // -------------------------------------------------------------------------

  visit(ctx: EvalContext): void {
    // Assign an Energy (polarity + element) to each frame
    for (const frame of this.frames) {
      frame.energy = new Energy(
        Polarity.get(frame.strokeSum),
        elementFromStrokeSum(frame.strokeSum),
      );
    }

    this.scoreFourframeLuck(ctx);
    this.scoreFourframeElement(ctx);
  }

  backward(_ctx: EvalContext): CalculatorPacket {
    return {
      signals: [
        this.signal('FOURFRAME_LUCK',    _ctx, LUCK_SIGNAL_WEIGHT),
        this.signal('FOURFRAME_ELEMENT', _ctx, ELEMENT_SIGNAL_WEIGHT),
      ],
    };
  }

  getAnalysis(): AnalysisDetail<FourFrameAnalysis> {
    const energies = this.frames
      .map(frame => frame.energy)
      .filter((energy): energy is Energy => energy !== null);

    const polScore = Energy.getPolarityScore(energies);
    const elScore = Energy.getElementScore(energies);

    return {
      type: this.id,
      score: (polScore + elScore) / 2,
      polarityScore: polScore,
      elementScore: elScore,
      data: {
        frames: this.frames.map(frame => ({
          type: frame.type,
          strokeSum: frame.strokeSum,
          element: frame.energy?.element.english ?? '',
          polarity: frame.energy?.polarity.english ?? '',
          luckyLevel: 0,
        })),
        elementScore: elScore,
        luckScore: 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // UI adapter methods (consumed by NamingReport.jsx)
  // -------------------------------------------------------------------------

  getFrames(): Frame[] {
    return this.frames;
  }

  getScore(): number {
    return this.getAnalysis().score;
  }

  /**
   * Average luck score across all four frames, scaled to 0-100.
   *
   * Each frame's fortune entry has a lucky_level (1-10). We average those
   * values and multiply by 10 to produce a percentage-like score.
   */
  get luckScore(): number {
    let luckyLevelSum = 0;
    let frameCount = 0;

    for (const frame of this.frames) {
      const luckyLevelNumber = Number.parseInt(frame.entry?.lucky_level ?? '0', 10);
      luckyLevelSum += Number.isNaN(luckyLevelNumber) ? 0 : luckyLevelNumber;
      frameCount += 1;
    }

    return frameCount > 0 ? (luckyLevelSum / frameCount) * 10 : 0;
  }

  get polarityScore(): number {
    return this.getAnalysis().polarityScore;
  }

  get elementScore(): number {
    return this.getAnalysis().elementScore;
  }

  // -------------------------------------------------------------------------
  // Async entry loading (fire-and-forget from constructor)
  // -------------------------------------------------------------------------

  /**
   * Load fortune/meaning entries for each frame's stroke sum from the
   * database. This is best-effort: if the database is unavailable, the
   * UI falls back to showing the raw stroke sums without descriptions.
   */
  private async loadEntries(): Promise<void> {
    try {
      if (!FrameCalculator.repo) {
        FrameCalculator.repo = new FourframeRepository();
      }
      if (!FrameCalculator.repoInitPromise) {
        FrameCalculator.repoInitPromise = FrameCalculator.repo.init();
      }
      await FrameCalculator.repoInitPromise;

      for (const frame of this.frames) {
        frame.entry = await FrameCalculator.repo.findByNumber(frame.strokeSum);
      }
    } catch (_error: unknown) {
      // Entry loading is best-effort; the UI shows fallback text when
      // frame.entry is null. We intentionally swallow this error so that
      // a missing or corrupt database never breaks the scoring pipeline.
    }
  }

  // -------------------------------------------------------------------------
  // Scoring: Four-Frame Luck (수리 길흉)
  // -------------------------------------------------------------------------

  /**
   * Score how "lucky" the four stroke sums are.
   *
   * Each frame's stroke sum is looked up in a fortune table (luckyMap).
   * The fortune string contains a keyword (최상, 상, 양, 흉, 최흉) that
   * maps to a numeric bucket score. The sum of all bucket scores becomes
   * the overall luck score.
   *
   * A name passes the luck check only when every single frame scores at
   * least 15 (i.e. "양" or better).
   */
  private scoreFourframeLuck(ctx: EvalContext): void {
    const [wonFrame, hyungFrame, leeFrame, jungFrame] = this.frames;

    // Look up the fortune text for each frame
    const fortuneLabels = this.frames.map(
      frame => ctx.luckyMap.get(frame.strokeSum) ?? '',
    );

    // Convert fortune text to numeric bucket scores
    const luckBuckets = [
      bucketFromFortune(fortuneLabels[0]),  // Won   (원격)
      bucketFromFortune(fortuneLabels[1]),  // Hyung (형격)
    ];
    if (ctx.givenLength > 1) {
      luckBuckets.push(bucketFromFortune(fortuneLabels[2]));  // Lee (이격) -- only for multi-char given names
    }
    luckBuckets.push(bucketFromFortune(fortuneLabels[3]));    // Jung (정격)

    const score = luckBuckets.reduce((total, bucket) => total + bucket, 0);

    // A name passes only if every frame is at least "양" level (bucket >= 15)
    const allFramesLucky = luckBuckets.length > 0 && luckBuckets.every(bucket => bucket >= 15);

    this.putInsight(ctx, 'FOURFRAME_LUCK', score, allFramesLucky,
      this.frames.map((frame, i) => `${frame.strokeSum}/${fortuneLabels[i]}`).join('-'),
      { won: wonFrame.strokeSum, hyeong: hyungFrame.strokeSum, i: leeFrame.strokeSum, jeong: jungFrame.strokeSum });
  }

  // -------------------------------------------------------------------------
  // Scoring: Four-Frame Element Harmony (오행 배치)
  // -------------------------------------------------------------------------

  /**
   * Score how well the elements of the three key frames harmonise.
   *
   * The element arrangement is read bottom-to-top:
   *   [ Lee element,  Hyung element,  Won element ]
   *
   * This ordering reflects the traditional top-down reading of a name.
   * Two sub-scores are computed:
   *   - Adjacency score: do neighbouring elements generate each other?
   *   - Balance score:   are the elements diverse, not dominated by one?
   *
   * The final score is the average of these two. The name passes only if:
   *   - No clashing (상극) pairs exist,
   *   - No single element dominates,
   *   - The adjacency score meets the surname-length-dependent threshold, and
   *   - The combined score meets the minimum passing score.
   */
  private scoreFourframeElement(ctx: EvalContext): void {
    // Step 1: Build the element arrangement from the three key frames
    //         Order: Lee (이격) -> Hyung (형격) -> Won (원격)
    const leeFrame  = this.frames[2];
    const hyungFrame = this.frames[1];
    const wonFrame  = this.frames[0];

    const arrangement: ElementKey[] = [
      elementFromStrokeSum(leeFrame.strokeSum).english   as ElementKey,
      elementFromStrokeSum(hyungFrame.strokeSum).english  as ElementKey,
      elementFromStrokeSum(wonFrame.strokeSum).english    as ElementKey,
    ];

    // Step 2: Compute the element distribution (how many of each element)
    const distribution = distributionFromArrangement(arrangement);

    // Step 3: Score adjacency (do neighbours generate each other?)
    const adjacencyScore = calculateArrayScore(arrangement, ctx.surnameLength);

    // Step 4: Score balance (is any one element overly dominant?)
    const balanceScore = calculateBalanceScore(distribution);

    // Step 5: Combine into a final score
    const score = (balanceScore + adjacencyScore) / 2;

    // Step 6: Determine pass/fail
    const adjacencyThreshold = ctx.surnameLength === 2
      ? DOUBLE_SURNAME_ADJACENCY_THRESHOLD
      : SINGLE_SURNAME_ADJACENCY_THRESHOLD;

    const isPassed =
      checkFourFrameSuriElement(arrangement, ctx.givenLength) &&
      !countDominant(distribution) &&
      adjacencyScore >= adjacencyThreshold &&
      score >= MIN_ELEMENT_PASSING_SCORE;

    this.putInsight(ctx, 'FOURFRAME_ELEMENT', score, isPassed,
      arrangement.join('-'), { distribution, adjacencyScore, balanceScore });
  }
}
