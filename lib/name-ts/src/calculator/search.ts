/**
 * FourFrameOptimizer -- Exhaustive Search for Valid Stroke Combinations
 *
 * Given a surname's stroke counts and the desired given-name length, this
 * class finds every combination of per-character stroke counts (for the
 * given name) whose four-frame sums all land on "valid" (auspicious) numbers.
 *
 * The search works by brute-force depth-first enumeration:
 *   - For each character position in the given name, try every stroke count
 *     from 1 up to MAX_STROKES_PER_CHARACTER.
 *   - At each leaf of the search tree, compute the four frame sums
 *     (Won, Hyung, Lee, Jung) and check whether all of them belong to the
 *     set of valid numbers.
 *   - Collect all passing combinations.
 *
 * Results are cached by (surname strokes, name length) so repeated lookups
 * for the same surname are instant.
 *
 * The four frames computed here mirror the same logic in FrameCalculator:
 *
 *   Won   (원격) -- sum of given-name strokes (padded if single char)
 *   Hyung (형격) -- surname total + upper half of given name
 *   Lee   (이격) -- surname total + lower half of given name
 *   Jung  (정격) -- surname total + all given-name strokes
 */

import { sum, adjustTo81 } from './scoring.js';
import scoringRules from '../../config/scoring-rules.json';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Maximum stroke count to consider for any single character.
 *
 * Most Hanja characters used in Korean names have at most ~30 strokes.
 * Going higher would explode the search space without practical benefit.
 */
const MAX_STROKES_PER_CHARACTER = 30;

/**
 * Stroke sums wrap around at this boundary (the traditional 81-stroke cycle).
 * A sum of 82 is treated as 1, 83 as 2, and so on.
 * Loaded from config so the value is defined in one place.
 */
const MAX_STROKE_SUM: number = scoringRules.maxStrokeSum;

// ---------------------------------------------------------------------------
// Optimizer
// ---------------------------------------------------------------------------

export class FourFrameOptimizer {
  private readonly cache = new Map<string, Set<string>>();
  constructor(private readonly validNumbers: Set<number>) {}

  /**
   * Return every given-name stroke combination that produces four valid
   * (auspicious) frame sums for the supplied surname.
   *
   * @param surnameStrokeCounts - stroke count of each surname character
   * @param nameLength          - number of characters in the given name (1-4)
   * @returns a Set of comma-separated stroke strings, e.g. {"8,12", "9,7", ...}
   */
  getValidCombinations(surnameStrokeCounts: number[], nameLength: number): Set<string> {
    // -- Check cache first --------------------------------------------------
    const cacheKey = `${surnameStrokeCounts.join(',')}|${nameLength}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (nameLength < 1 || nameLength > 4) {
      throw new Error(`unsupported name length: ${nameLength}`);
    }

    // -- Prepare constants used throughout the search -----------------------
    const surnameStrokeTotal = sum(surnameStrokeCounts);
    const validCombinations = new Set<string>();
    const currentStrokes = new Array<number>(nameLength).fill(1);

    /**
     * Check whether the current stroke combination produces four valid
     * frame sums. If so, add it to validCombinations.
     *
     * This mirrors the frame-building logic in FrameCalculator:
     *   - Single-char given names are padded with a trailing 0.
     *   - The padded array is split at its midpoint into upper/lower halves.
     */
    const checkAndAddCombination = (): void => {
      // Pad single-character names: [strokes] -> [strokes, 0]
      const paddedStrokes = nameLength === 1
        ? [currentStrokes[0], 0]
        : currentStrokes;
      const midPoint = Math.floor(paddedStrokes.length / 2);

      // Compute the four frame stroke sums
      const wonFrame   = adjustTo81(sum(paddedStrokes));
      const hyungFrame = adjustTo81(surnameStrokeTotal + sum(paddedStrokes.slice(0, midPoint)));
      const leeFrame   = adjustTo81(surnameStrokeTotal + sum(paddedStrokes.slice(midPoint)));
      const jungFrame  = adjustTo81(surnameStrokeTotal + sum(currentStrokes));

      // Every frame must land on an auspicious number
      if (!this.validNumbers.has(wonFrame))   return;
      if (!this.validNumbers.has(hyungFrame)) return;
      if (nameLength > 1 && !this.validNumbers.has(leeFrame)) return;
      if (!this.validNumbers.has(jungFrame))  return;

      validCombinations.add(currentStrokes.join(','));
    };

    /**
     * Depth-first search: try every stroke count (1..MAX_STROKES_PER_CHARACTER)
     * for each character position, recursively.
     *
     * At depth === nameLength (all positions filled), we check the combination.
     */
    const searchAllCombinations = (depth: number): void => {
      if (depth >= nameLength) {
        checkAndAddCombination();
        return;
      }
      for (let strokeCount = 1; strokeCount <= MAX_STROKES_PER_CHARACTER; strokeCount++) {
        currentStrokes[depth] = strokeCount;
        searchAllCombinations(depth + 1);
      }
    };

    // -- Run the exhaustive search ------------------------------------------
    searchAllCombinations(0);

    this.cache.set(cacheKey, validCombinations);
    return validCombinations;
  }
}
