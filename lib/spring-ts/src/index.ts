// ─────────────────────────────────────────────────────────────────────────────
//  1. SPRING ENGINE & EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────
export { SpringEngine } from './spring-engine.js';
export { springEvaluateName, SAJU_FRAME } from './spring-evaluator.js';

// ─────────────────────────────────────────────────────────────────────────────
//  2. SAJU ADAPTER & CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────
export { analyzeSaju, analyzeSajuSafe, buildSajuContext, emptySaju, collectElements, elementFromSajuCode } from './saju-adapter.js';
export { SajuCalculator, computeSajuNameScore, type SajuNameScoreResult } from './saju-calculator.js';

// ─────────────────────────────────────────────────────────────────────────────
//  3. SPRING TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type {
  // Input
  BirthInfo,
  NameCharInput,
  SpringRequest,
  SpringOptions,
  // Output
  SpringResponse,
  SpringCandidate,
  CharDetail,
  // New 3-method API types
  NamingReport,
  NamingReportFrame,
  NamingReportFourFrame,
  SajuReport,
  SpringReport,
  // Saju analysis
  SajuSummary,
  PillarSummary,
  TimeCorrectionSummary,
  StrengthSummary,
  YongshinSummary,
  CheonganRelationSummary,
  TenGodSummary,
  // Compatibility & adapter
  SajuCompatibility,
  SajuOutputSummary,
  SajuYongshinSummary,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  4. RE-EXPORTED NAME-TS MODELS
// ─────────────────────────────────────────────────────────────────────────────
export { NameTs, type UserInfo, type NamingResult, type NameResult, type Gender } from '../../name-ts/src/name.js';
export { Element } from '../../name-ts/src/model/element.js';
export { Polarity } from '../../name-ts/src/model/polarity.js';
export { Energy } from '../../name-ts/src/model/energy.js';
export type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from '../../name-ts/src/model/types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  5. RE-EXPORTED NAME-TS DATABASE
// ─────────────────────────────────────────────────────────────────────────────
export { SqliteRepository, HanjaRepository, type HanjaEntry } from '../../name-ts/src/database/hanja-repository.js';
export { NameStatRepository } from '../../name-ts/src/database/name-stat-repository.js';
export { FourframeRepository, type FourframeMeaningEntry } from '../../name-ts/src/database/fourframe-repository.js';

// ─────────────────────────────────────────────────────────────────────────────
//  6. RE-EXPORTED NAME-TS CALCULATORS
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
//  7. RE-EXPORTED NAME-TS UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
export {
  CHOSEONG, JUNGSEONG, decomposeHangul, makeFallbackEntry,
  FRAME_LABELS, buildInterpretation, parseJamoFilter, type JamoFilter,
} from '../../name-ts/src/utils/index.js';
