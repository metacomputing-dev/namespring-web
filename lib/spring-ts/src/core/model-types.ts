/**
 * Shared result interfaces returned by the three analysis calculators.
 *
 * Each interface describes the shape of the data that flows from a
 * calculator to the UI layer.  The fields are intentionally verbose
 * so that consumers never have to guess what a value represents.
 */


// ---------------------------------------------------------------------------
// Hangul (Korean alphabet) analysis
// ---------------------------------------------------------------------------

export interface HangulAnalysis {

  /** One entry per syllable block in the name. */
  readonly blocks: Array<{
    /** The Hangul syllable character (e.g. "김"). */
    hangul: string;

    /** The initial consonant (onset) of the syllable. */
    onset: string;

    /** The vowel (nucleus) of the syllable. */
    nucleus: string;

    /** The Five-Element assigned to this syllable (e.g. "Wood"). */
    element: string;

    /** The Yin/Yang polarity of this syllable (e.g. "Positive"). */
    polarity: string;
  }>;

  /** 0-100 score measuring Yin/Yang balance across all syllables. */
  readonly polarityScore: number;

  /** 0-100 score measuring element-cycle harmony across adjacent syllables. */
  readonly elementScore: number;
}


// ---------------------------------------------------------------------------
// Hanja (Chinese character) analysis
// ---------------------------------------------------------------------------

export interface HanjaAnalysis {

  /** One entry per Hanja character in the name. */
  readonly blocks: Array<{
    /** The Hanja character (e.g. "金"). */
    hanja: string;

    /** The corresponding Hangul reading (e.g. "김"). */
    hangul: string;

    /** Total number of brush strokes for the character. */
    strokes: number;

    /** The element derived from the character's radical / resource. */
    resourceElement: string;

    /** The element derived from the stroke count's last digit. */
    strokeElement: string;

    /** The Yin/Yang polarity based on odd/even stroke count. */
    polarity: string;
  }>;

  /** 0-100 score measuring Yin/Yang balance across all characters. */
  readonly polarityScore: number;

  /** 0-100 score measuring element-cycle harmony across adjacent characters. */
  readonly elementScore: number;
}


// ---------------------------------------------------------------------------
// Four-Frame (Sa-Gyeok) analysis
// ---------------------------------------------------------------------------

export interface FourFrameAnalysis {

  /** One entry per frame (won, hyung, lee, jung). */
  readonly frames: Array<{
    /** Which of the four frames this entry represents. */
    type: 'won' | 'hyung' | 'lee' | 'jung';

    /** The sum of strokes used to compute this frame's values. */
    strokeSum: number;

    /** The element derived from the stroke sum's last digit. */
    element: string;

    /** The Yin/Yang polarity based on odd/even stroke sum. */
    polarity: string;

    /** A 0-25 luck rating drawn from the fortune lookup table. */
    luckyLevel: number;
  }>;

  /** 0-100 score measuring element-cycle harmony across the four frames. */
  readonly elementScore: number;

  /** 0-100 aggregate luck score across the four frames. */
  readonly luckScore: number;
}

