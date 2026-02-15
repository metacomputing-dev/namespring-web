// ---------------------------------------------------------------------------
// calculator/ barrel export
// ---------------------------------------------------------------------------

// DAG framework
export { executeCalculatorNode, flattenSignals } from './graph.js';
export type { CalculatorNode, CalculatorSignal, CalculatorPacket } from './graph.js';

// Base class and evaluation types
export { NameCalculator } from './base.js';
export type { AnalysisDetail, EvalContext, EvalFrame, FrameInsight, EvaluationResult } from './base.js';

// Calculators (DAG nodes)
export { HangulCalculator } from './hangul.js';
export { HanjaCalculator } from './hanja.js';
export { FrameCalculator, Frame } from './frame.js';
export { SajuCalculator } from './saju.js';

// Root evaluation
export { evaluateName } from './root.js';

// Scoring rules
export { calculateArrayScore, calculateBalanceScore, polarityScore, bucketFromFortune } from './rules.js';
export type { PolarityValue } from './rules.js';

// Element utilities
export type { ElementKey } from './element-cycle.js';
export {
  ELEMENT_KEYS, elementToKey, elementFromSajuCode,
  emptyDistribution, distributionFromArrangement, clamp,
} from './element-cycle.js';

// Saju scoring
export { computeSajuNameScore } from './saju-scorer.js';
export type { SajuOutputSummary, SajuNameScoreResult, SajuNameScoreBreakdown } from './saju-scorer.js';

// Search
export { FourFrameOptimizer, MinHeap, pushTopK, toStrokeKey } from './search.js';

// Constants (re-export for advanced usage)
export { FOUR_FRAME_MODULO, MAX_STROKE_COUNT_PER_CHAR } from './constants.js';
