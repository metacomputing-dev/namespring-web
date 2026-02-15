// Engine
export { SeedEngine } from './engine.js';
export { SeedTs } from './seed.js';

// Stable API types
export type {
  SeedRequest, SeedResponse, SeedCandidate, SeedOptions,
  BirthInfo, NameCharInput, ScoreWeights,
  SajuSummary, PillarSummary, CharDetail,
  HangulAnalysis, HanjaAnalysis, FourFrameAnalysis, SajuCompatibility,
} from './types.js';

// Backward-compat types
export type { UserInfo, NamingResult, SeedResult, Gender, BirthDateTime } from './types.js';

// Database
export { HanjaRepository } from './database/hanja-repository.js';
export type { HanjaEntry } from './database/hanja-repository.js';
export { FourframeRepository } from './database/fourframe-repository.js';
export type { FourframeMeaningEntry } from './database/fourframe-repository.js';
export { NameStatRepository } from './database/name-stat-repository.js';
export type { NameStatEntry } from './database/name-stat-repository.js';

// Calculator (the core evaluation framework)
export { NameCalculator } from './calculator/base.js';
export type { AnalysisDetail, EvalContext, EvalFrame, FrameInsight, EvaluationResult } from './calculator/base.js';
export { HangulCalculator } from './calculator/hangul.js';
export { HanjaCalculator } from './calculator/hanja.js';
export { FrameCalculator, Frame } from './calculator/frame.js';
export { SajuCalculator } from './calculator/saju.js';
export { evaluateName } from './calculator/root.js';
export { executeCalculatorNode, flattenSignals } from './calculator/graph.js';
export type { CalculatorNode, CalculatorSignal, CalculatorPacket } from './calculator/graph.js';
export type { ElementKey } from './calculator/element-cycle.js';
export type { SajuNameScoreResult, SajuOutputSummary } from './calculator/saju-scorer.js';
export { FourFrameOptimizer, MinHeap } from './calculator/search.js';

// Model
export { Element } from './model/element.js';
export { Energy } from './model/energy.js';
export { Polarity } from './model/polarity.js';

// Utils
export {
  CHOSEONG, JUNGSEONG, isHangulSyllable, decomposeHangul, makeFallbackEntry,
  FRAME_LABELS, TOTAL_BANDS, SUB_HINTS, buildInterpretation, interpretScores,
} from './utils/index.js';
export type { HangulDecomposition } from './utils/index.js';
