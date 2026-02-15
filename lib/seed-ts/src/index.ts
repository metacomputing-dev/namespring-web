// Engine
export { SeedEngine } from './engine.js';
export { SeedTs } from './seed.js';

// Types (stable API contract)
export type {
  SeedRequest, SeedResponse, SeedCandidate, SeedOptions,
  BirthInfo, NameCharInput, ScoreWeights,
  SajuSummary, PillarSummary, CharDetail,
  HangulAnalysis, HanjaAnalysis, FourFrameAnalysis, SajuCompatibility,
} from './types.js';

// Backward-compat types
export type { UserInfo, NamingResult, SeedResult, Gender, BirthDateTime } from './types.js';

// Database (used directly by UI)
export { HanjaRepository } from './database/hanja-repository.js';
export type { HanjaEntry } from './database/hanja-repository.js';
export { FourframeRepository } from './database/fourframe-repository.js';
export type { FourframeMeaningEntry } from './database/fourframe-repository.js';
export { NameStatRepository } from './database/name-stat-repository.js';
export type { NameStatEntry } from './database/name-stat-repository.js';

// Calculator (advanced usage)
export { EnergyCalculator } from './calculator/energy-calculator.js';
export type { AnalysisDetail } from './calculator/energy-calculator.js';
export { FourFrameCalculator, Frame } from './calculator/frame-calculator.js';
export { HangulCalculator, HangulNameBlock } from './calculator/hangul-calculator.js';
export { HanjaCalculator, HanjaNameBlock } from './calculator/hanja-calculator.js';
export { SajuCalculator } from './calculator/saju-calculator.js';
export type { SajuContext } from './calculator/saju-calculator.js';

// Calculator graph (DAG execution)
export { executeCalculatorNode, flattenSignals } from './calculator/calculator-graph.js';
export type { CalculatorNode, CalculatorSignal, CalculatorPacket } from './calculator/calculator-graph.js';

// Evaluator (signal-based adaptive scoring)
export { NameEvaluator } from './evaluator/name-evaluator.js';
export type { EvaluationResult } from './evaluator/name-evaluator.js';
export type { EvalFrame, FrameInsight } from './evaluator/evaluator-context.js';
export type { ElementKey } from './evaluator/element-cycle.js';
export type { SajuNameScoreResult, SajuNameScoreBreakdown } from './evaluator/saju-name-scorer.js';
export type { SajuOutputSummary } from './evaluator/strength-scorer.js';
export type { SajuYongshinSummary } from './evaluator/yongshin-scorer.js';

// Search (name generation)
export { FourFrameOptimizer } from './search/four-frame-optimizer.js';
export { MinHeap } from './search/heap.js';

// Model
export { Element } from './model/element.js';
export { Energy } from './model/energy.js';
export { Polarity } from './model/polarity.js';
