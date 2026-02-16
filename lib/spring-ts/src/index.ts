// ─────────────────────────────────────────────────────────────────────────────
//  1. SPRING ENGINE & EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────
export { SpringEngine } from './spring-engine.js';
export { evaluateCandidate, type ScoreInputs, type EvaluationResult } from './evaluator.js';

// ─────────────────────────────────────────────────────────────────────────────
//  2. SAJU ADAPTER & SCORER
// ─────────────────────────────────────────────────────────────────────────────
export { analyzeSaju, analyzeSajuSafe, buildSajuContext, emptySaju, collectElements, elementFromSajuCode } from './saju-adapter.js';
export { computeSajuNameScore, type SajuNameScoreResult } from './saju-scorer.js';

// ─────────────────────────────────────────────────────────────────────────────
//  3. NAME SCORER
// ─────────────────────────────────────────────────────────────────────────────
export { scoreName, type NameScoreResult } from './name-scorer.js';

// ─────────────────────────────────────────────────────────────────────────────
//  4. CANDIDATE GENERATION
// ─────────────────────────────────────────────────────────────────────────────
export { FourFrameOptimizer, generateCandidates, type CandidateGeneratorOptions } from './candidate-generator.js';

// ─────────────────────────────────────────────────────────────────────────────
//  5. SPRING TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type {
  // Input
  BirthInfo,
  NameCharInput,
  SpringRequest,
  SpringOptions,
  SajuRequestOptions,
  // Output
  SpringResponse,
  SpringCandidate,
  CharDetail,
  CandidateAnalysis,
  CandidateName,
  ResponseMeta,
  // New 3-method API types
  NamingReport,
  NamingReportFrame,
  NamingReportFourFrame,
  SajuReport,
  SpringReport,
  // Analysis result types
  HangulAnalysisResult,
  HanjaAnalysisResult,
  FourFrameAnalysisResult,
  // Saju analysis
  SajuSummary,
  PillarSummary,
  PillarCode,
  TimeCorrectionSummary,
  DayMasterSummary,
  StrengthSummary,
  YongshinSummary,
  YongshinRecommendation,
  GyeokgukSummary,
  CheonganRelationSummary,
  CheonganRelationScore,
  JijiRelationSummary,
  TenGodSummary,
  TenGodPosition,
  HiddenStem,
  HiddenStemTenGod,
  ShinsalHitSummary,
  // Compatibility & adapter
  SajuCompatibility,
  SajuOutputSummary,
  SajuYongshinSummary,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  6. SCORING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
export {
  type ElementKey,
  ELEMENT_KEYS,
  clamp,
  emptyDistribution,
  distributionFromArrangement,
  adjustTo81,
  bucketFromFortune,
} from './scoring.js';

// ─────────────────────────────────────────────────────────────────────────────
//  7. UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
export {
  CHOSEONG, JUNGSEONG, decomposeHangul, makeFallbackEntry,
  buildInterpretation, parseJamoFilter, type JamoFilter,
} from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  8. RE-EXPORTED SEED-TS DATABASE & MODELS
// ─────────────────────────────────────────────────────────────────────────────
export { HanjaRepository, type HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
export { FourframeRepository, type FourframeMeaningEntry } from '../../seed-ts/src/database/fourframe-repository.js';
export { Element } from '../../seed-ts/src/model/element.js';
export { Polarity } from '../../seed-ts/src/model/polarity.js';
export { Energy } from '../../seed-ts/src/model/energy.js';
