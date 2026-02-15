// ── Evaluator public API ──
export { NameEvaluator } from './name-evaluator.js';
export type { EvaluationResult } from './name-evaluator.js';

// ── Context types ──
export type { EvalFrame, FrameInsight, EvaluationPipelineContext } from './evaluator-context.js';

// ── Saju scoring ──
export { computeSajuNameScore } from './saju-name-scorer.js';
export type { SajuNameScoreResult, SajuNameScoreBreakdown } from './saju-name-scorer.js';
export type { SajuOutputSummary } from './strength-scorer.js';
export type { SajuYongshinSummary } from './yongshin-scorer.js';

// ── Element utilities ──
export type { ElementKey } from './element-cycle.js';
export {
  ELEMENT_KEYS,
  elementToKey,
  keyToElement,
  elementFromSajuCode,
  emptyDistribution,
  distributionFromArrangement,
  clamp,
} from './element-cycle.js';

// ── Rules ──
export {
  calculateArrayScore,
  calculateBalanceScore,
  checkElementSangSaeng,
  checkFourFrameSuriElement,
  checkPolarityHarmony,
  polarityScore,
  bucketFromFortune,
  levelToFortune,
} from './rules.js';

// ── Nodes ──
export { createRootNode } from './evaluator-nodes.js';
