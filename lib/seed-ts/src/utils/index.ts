// Korean character utilities
export {
  CHOSEONG, JUNGSEONG,
  isHangulSyllable, decomposeHangul, makeFallbackEntry,
} from './korean-char.js';
export type { HangulDecomposition } from './korean-char.js';

// Interpretation utilities
export {
  FRAME_LABELS, TOTAL_BANDS, SUB_HINTS,
  buildInterpretation, interpretScores,
} from './interpretation.js';
