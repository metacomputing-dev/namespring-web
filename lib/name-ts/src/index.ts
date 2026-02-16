// ===========================================================================
// name-ts -- public barrel exports
// ===========================================================================

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export { Element } from './model/element.js';
export { Polarity } from './model/polarity.js';
export { Energy } from './model/energy.js';
export type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from './model/types.js';

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export { SqliteRepository, HanjaRepository, type HanjaEntry } from './database/hanja-repository.js';
export { FourframeRepository, type FourframeMeaningEntry } from './database/fourframe-repository.js';
export { NameStatRepository } from './database/name-stat-repository.js';

// ---------------------------------------------------------------------------
// Calculators
// ---------------------------------------------------------------------------

export {
  NameCalculator, evaluateName,
  type AnalysisDetail, type EvalContext, type EvalFrame, type FrameInsight,
  type EvaluationResult, type CalculatorSignal, type CalculatorPacket,
} from './calculator/evaluator.js';
export { HangulCalculator } from './calculator/hangul.js';
export { HanjaCalculator } from './calculator/hanja.js';
export { FrameCalculator, type Frame } from './calculator/frame.js';
export { FourFrameOptimizer } from './calculator/search.js';
export type { ElementKey } from './calculator/scoring.js';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export {
  CHOSEONG, JUNGSEONG, decomposeHangul, makeFallbackEntry,
  FRAME_LABELS, buildInterpretation, parseJamoFilter, type JamoFilter,
} from './utils/index.js';

// ---------------------------------------------------------------------------
// Facade
// ---------------------------------------------------------------------------

export { NameTs, type UserInfo, type NamingResult, type NameResult, type Gender } from './name.js';
