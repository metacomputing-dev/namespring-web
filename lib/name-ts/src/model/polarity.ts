/**
 * Polarity -- the Yin/Yang value of a character, determined by its stroke count.
 *
 * In East-Asian naming tradition every character carries a polarity:
 *   - Odd  stroke count  =>  Positive (Yang / 양)
 *   - Even stroke count  =>  Negative (Yin  / 음)
 *
 * The polarity labels are loaded from config/five-elements.json so that
 * display names (English and Korean) are maintained in one central place.
 */

import fiveElementsConfig from '../../config/five-elements.json';

// ---------------------------------------------------------------------------
// Read the display labels from the config file.
// ---------------------------------------------------------------------------
const polarityLabels = fiveElementsConfig.polarity;


export class Polarity {

  // --- The two singleton instances -----------------------------------------

  static readonly Negative = new Polarity(
    polarityLabels.negative.english,
    polarityLabels.negative.korean,
  );

  static readonly Positive = new Polarity(
    polarityLabels.positive.english,
    polarityLabels.positive.korean,
  );

  // --- Constructor (private -- only the two singletons above exist) --------

  private constructor(
    public readonly english: string,
    public readonly korean: string,
  ) {}

  // --- Static lookup -------------------------------------------------------

  /**
   * Determine the polarity of a character from its stroke count.
   *
   * Rule:
   *   - Odd  number of strokes  =>  Positive (Yang)
   *   - Even number of strokes  =>  Negative (Yin)
   */
  static get(strokes: number): Polarity {
    const isOddStrokeCount = strokes % 2 === 1;

    if (isOddStrokeCount) {
      return Polarity.Positive;
    }
    return Polarity.Negative;
  }
}
