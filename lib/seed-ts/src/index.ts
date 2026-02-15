export { SeedEngine } from './calculator/engine.js';
export { SeedTs } from './seed.js';

export type {
  SeedRequest, SeedResponse, SeedCandidate, SeedOptions,
  BirthInfo, NameCharInput, ScoreWeights,
  SajuSummary, PillarSummary, CharDetail,
  HangulAnalysis, HanjaAnalysis, FourFrameAnalysis, SajuCompatibility,
} from './model/types.js';

export type { UserInfo, NamingResult, SeedResult, Gender, BirthDateTime } from './model/types.js';

export { SqliteRepository, HanjaRepository } from './database/hanja-repository.js';
export type { HanjaEntry } from './database/hanja-repository.js';
export { FourframeRepository } from './database/fourframe-repository.js';
export type { FourframeMeaningEntry } from './database/fourframe-repository.js';
export { NameStatRepository } from './database/name-stat-repository.js';
export type { NameStatEntry } from './database/name-stat-repository.js';

export { NameCalculator } from './calculator/evaluator.js';
export type { AnalysisDetail, EvalContext, EvalFrame, FrameInsight, EvaluationResult } from './calculator/evaluator.js';
export { HangulCalculator } from './calculator/hangul.js';
export { HanjaCalculator } from './calculator/hanja.js';
export { FrameCalculator, Frame } from './calculator/frame.js';
export { SajuCalculator } from './calculator/saju.js';
export { evaluateName } from './calculator/evaluator.js';
export { executeCalculatorNode, flattenSignals } from './calculator/evaluator.js';
export type { CalculatorNode, CalculatorSignal, CalculatorPacket } from './calculator/evaluator.js';
export type { ElementKey } from './calculator/scoring.js';
export type { SajuNameScoreResult, SajuOutputSummary } from './calculator/saju.js';
export { FourFrameOptimizer, MinHeap } from './calculator/search.js';

export { Element } from './model/element.js';
export { Polarity } from './model/polarity.js';
export { Energy } from './model/energy.js';

export {
  CHOSEONG, JUNGSEONG, isHangulSyllable, decomposeHangul, makeFallbackEntry,
  FRAME_LABELS, TOTAL_BANDS, SUB_HINTS, buildInterpretation, interpretScores,
} from './utils/index.js';
export type { HangulDecomposition } from './utils/index.js';
