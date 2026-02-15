// Spring engine
export { SpringEngine } from './spring-engine.js';
export { analyzeSaju, buildSajuContext, emptySaju, collectElements, elementFromSajuCode } from './saju-adapter.js';
export { SajuCalculator, computeSajuNameScore, type SajuNameScoreResult } from './saju-calculator.js';
export { springEvaluateName, SAJU_FRAME } from './spring-evaluator.js';

// Spring types
export type {
  SpringRequest, SpringResponse, SpringCandidate, SpringOptions,
  BirthInfo, NameCharInput, CharDetail, SajuSummary,
  PillarSummary, TimeCorrectionSummary, StrengthSummary,
  YongshinSummary, CheonganRelationSummary, TenGodSummary,
  SajuCompatibility, SajuOutputSummary, SajuYongshinSummary,
} from './types.js';

// name-ts re-exports (UI accesses everything through spring-ts)
export { NameTs, type UserInfo, type NamingResult, type NameResult, type Gender } from '../../name-ts/src/name.js';
export { SqliteRepository, HanjaRepository, type HanjaEntry } from '../../name-ts/src/database/hanja-repository.js';
export { NameStatRepository } from '../../name-ts/src/database/name-stat-repository.js';
export { FourframeRepository, type FourframeMeaningEntry } from '../../name-ts/src/database/fourframe-repository.js';
export { Element } from '../../name-ts/src/model/element.js';
export { Polarity } from '../../name-ts/src/model/polarity.js';
export { Energy } from '../../name-ts/src/model/energy.js';
export type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from '../../name-ts/src/model/types.js';
export {
  NameCalculator, evaluateName,
  type AnalysisDetail, type EvalContext, type EvalFrame, type FrameInsight,
  type EvaluationResult, type CalculatorSignal, type CalculatorPacket,
} from '../../name-ts/src/calculator/evaluator.js';
export { HangulCalculator } from '../../name-ts/src/calculator/hangul.js';
export { HanjaCalculator } from '../../name-ts/src/calculator/hanja.js';
export { FrameCalculator, type Frame } from '../../name-ts/src/calculator/frame.js';
export { FourFrameOptimizer } from '../../name-ts/src/calculator/search.js';
export type { ElementKey } from '../../name-ts/src/calculator/scoring.js';
export {
  CHOSEONG, JUNGSEONG, decomposeHangul, makeFallbackEntry,
  FRAME_LABELS, buildInterpretation, parseJamoFilter, type JamoFilter,
} from '../../name-ts/src/utils/index.js';
