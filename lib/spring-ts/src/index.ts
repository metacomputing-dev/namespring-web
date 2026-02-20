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
  SajuTimePolicyOptions,
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
  SpringCandidateSummary,
  NameGenderTendency,
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
export { SeedTs as NameTs } from '../../seed-ts/src/seed.js';
export type { UserInfo, NamingResult, SeedResult as NameResult, Gender } from '../../seed-ts/src/types.js';
export { Element } from '../../seed-ts/src/model/element.js';
export { Polarity } from '../../seed-ts/src/model/polarity.js';
export { Energy } from '../../seed-ts/src/model/energy.js';
export type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from './core/model-types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  5. RE-EXPORTED NAME-TS DATABASE
// ─────────────────────────────────────────────────────────────────────────────
export { HanjaRepository, HanjaRepository as SqliteRepository, type HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
export { NameStatRepository } from '../../seed-ts/src/database/name-stat-repository.js';
export { FourframeRepository, type FourframeMeaningEntry } from '../../seed-ts/src/database/fourframe-repository.js';

// ─────────────────────────────────────────────────────────────────────────────
//  6. RE-EXPORTED NAME-TS CALCULATORS
// ─────────────────────────────────────────────────────────────────────────────
export {
  evaluateName,
  createSignal, putInsight,
  type EvaluableCalculator, type NameCalculator,
  type AnalysisDetail, type EvalContext, type EvalFrame, type FrameInsight,
  type EvaluationResult, type CalculatorSignal, type CalculatorPacket,
} from './core/evaluator.js';
export { HangulCalculator } from './calculator/hangul-calculator.js';
export { HanjaCalculator } from './calculator/hanja-calculator.js';
export { FrameCalculator, type Frame } from './calculator/frame-calculator.js';
export { FourFrameOptimizer } from './calculator/search.js';
export type { ElementKey } from './core/scoring.js';

// ─────────────────────────────────────────────────────────────────────────────
//  7. RE-EXPORTED NAME-TS UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
export {
  CHOSEONG, JUNGSEONG, decomposeHangul, makeFallbackEntry,
  FRAME_LABELS, buildInterpretation, parseJamoFilter, type JamoFilter,
} from './core/name-utils.js';
