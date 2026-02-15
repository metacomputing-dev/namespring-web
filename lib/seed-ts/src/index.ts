export { SeedEngine } from './calculator/engine.js';
export { SeedTs, type UserInfo, type NamingResult, type SeedResult, type Gender } from './seed.js';

export type {
  SeedRequest, SeedResponse, SeedCandidate, SeedOptions, BirthInfo, NameCharInput,
  SajuSummary, PillarSummary, CharDetail, HangulAnalysis, HanjaAnalysis,
  FourFrameAnalysis, SajuCompatibility, TimeCorrectionSummary, StrengthSummary,
  YongshinSummary, CheonganRelationSummary, TenGodSummary,
} from './model/types.js';

export { SqliteRepository, HanjaRepository, type HanjaEntry } from './database/hanja-repository.js';
export { FourframeRepository, type FourframeMeaningEntry } from './database/fourframe-repository.js';

export { NameCalculator, evaluateName, type AnalysisDetail, type EvalContext, type EvalFrame, type FrameInsight, type EvaluationResult, type CalculatorSignal, type CalculatorPacket } from './calculator/evaluator.js';
export { HangulCalculator } from './calculator/hangul.js';
export { HanjaCalculator } from './calculator/hanja.js';
export { FrameCalculator, type Frame } from './calculator/frame.js';
export { SajuCalculator, type SajuNameScoreResult, type SajuOutputSummary } from './calculator/saju.js';
export type { ElementKey } from './calculator/scoring.js';
export { FourFrameOptimizer } from './calculator/search.js';

export { Element } from './model/element.js';
export { Polarity } from './model/polarity.js';
export { Energy } from './model/energy.js';

export {
  CHOSEONG, JUNGSEONG, decomposeHangul, makeFallbackEntry,
  FRAME_LABELS, buildInterpretation, parseJamoFilter, type JamoFilter,
} from './utils/index.js';
