// ─────────────────────────────────────────────────────────────────────────────
//  1. SPRING ENGINE & EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────
export {
  FortuneSajuUnavailableError,
  SPRING_ENGINE_INIT_CANCELLED,
  SPRING_ENGINE_OPERATION_CANCELLED,
  NAME_ENTRY_RESOLUTION_FAILED,
  SPRING_NAME_REQUEST_INVALID,
  SpringEngine,
  SpringEngineInitializationCancelledError,
  SpringEngineOperationCancelledError,
  NameEntryResolutionError,
  SpringNameRequestValidationError,
  type NameEntryResolutionFailureReason,
  type NameEntryRole,
  type SpringNameRequestValidationField,
  type SpringNameRequestValidationReason,
  type SpringEngineOptions,
  type SpringEngineRepositories,
} from './spring-engine.js';
export {
  FOURFRAME_CONTRACT_INVALID,
  FOURFRAME_EXPECTED_RECORD_COUNT,
  FOURFRAME_LUCKY_LEVELS,
  FOURFRAME_MAX_NUMBER,
  FOURFRAME_MIN_NUMBER,
  FourFrameContractError,
  compileFourFrameContract,
  type CompiledFourFrameContract,
  type FourFrameContractIssue,
  type FourFrameContractRecord,
  type FourFrameLuckyLevel,
} from './fourframe-contract.js';
export {
  NAME_STAT_LOOKUP_UNAVAILABLE,
  NameStatLookupUnavailableError,
  type NameStatLookupResult,
} from './name-stat-contract.js';
export {
  NAME_STAT_SUMMARY_INTEGRITY_MISMATCH,
  NameStatSummaryIntegrityError,
  type NameStatSummaryIntegrityReason,
  type NameStatSummaryIntegrityValue,
} from './name-stat-summary-repository.js';
export {
  REPOSITORY_DATA_INVALID,
  RepositoryDataError,
} from '../../seed-ts/src/database/repository-errors.js';
export {
  REPOSITORY_DATABASE_INTEGRITY_MISMATCH,
  RepositoryDatabaseIntegrityError,
  type RepositoryDatabaseIntegrityReason,
  type RepositoryDatabaseIntegrityValue,
} from '../../seed-ts/src/database/database-integrity.js';
export {
  SAJU_ANALYSIS_UNAVAILABLE,
  SajuAnalysisUnavailableError,
  assertScorableSajuSummary,
  isScorableSajuSummary,
} from './saju-analysis-contract.js';
export {
  FORTUNE_REPORT_BUILD_FAILED,
  FORTUNE_TARGET_DATE_INVALID,
  FortuneReportBuildError,
  FortuneTargetDateInvalidError,
  resolveFortuneTargetDate,
} from './report/report-input-contract.js';
export { SajuRequestValidationError } from './saju-request-policy.js';
export { springEvaluateName, SAJU_FRAME } from './spring-evaluator.js';

// ─────────────────────────────────────────────────────────────────────────────
//  2. SAJU ADAPTER & CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────
export { analyzeSaju, analyzeSajuSafe, buildSajuContext, emptySaju, collectElements, elementFromSajuCode } from './saju-adapter.js';
export {
  SAJU_CALCULATOR_NOT_READY,
  SajuCalculator,
  SajuCalculatorStateError,
  computeSajuNameScore,
  computeTenGodScoreDiagnostics,
  type SajuCalculatorReadOperation,
  type SajuCalculatorStateReason,
  type SajuNameScoreResult,
  type TenGodPositionContribution,
  type TenGodScoreDiagnostics,
  type TenGodScoreNormalization,
} from './saju-calculator.js';

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
  CandidateRejectionSummary,
  SpringCandidate,
  CharDetail,
  // New 3-method API types
  NamingScoreVector,
  NamingExplanation,
  NamingExplanationPhraseMode,
  NamingExplanationSignal,
  NamingExplanationSignalKind,
  CandidateStrengthProfile,
  CandidateStrengthProfileId,
  SajuNameSafetyPosture,
  SajuNameSafetyStrategy,
  SajuNameSafetyProfile,
  SajuNameEvidenceDirection,
  SajuNameSourceEvidence,
  NameElementStrategy,
  NameElementResolutionSource,
  NameElementResolutionSafety,
  NameElementResolutionEvidence,
  NameElementStrategyEvidence,
  NamingReport,
  NamingReportFrame,
  NamingReportFourFrame,
  SajuReport,
  SpringReport,
  SpringCandidateSummary,
  NameGenderTendency,
  // Saju analysis
  SajuSummary,
  SajuAnalysisStatus,
  SajuAnalysisReasonCode,
  SajuAnalysisDiagnostic,
  SajuSafeAnalysisResult,
  PillarSummary,
  TimeCorrectionSummary,
  StrengthSummary,
  YongshinSummary,
  YongshinConsensusAxisName,
  YongshinConsensusAxisScore,
  YongshinConsensusConflictLevel,
  YongshinConsensusScoreboard,
  CheonganRelationSummary,
  TenGodSummary,
  SourceTierMetadata,
  SajuJudgmentStrength,
  // Compatibility & adapter
  SajuCompatibility,
  TenGodPositionEvidence,
  TenGodPositionEvidenceContribution,
  SajuOutputSummary,
  SajuYongshinSummary,
} from './types.js';
export {
  getLegalAnnotation,
  isHanjaUsableForLegalName,
  normalizeToOrthodoxHanja,
  type HanjaLegalAnnotation,
  type HanjaLegalStatus,
  type HanjaPool,
} from './hanja-annotations.js';
export {
  getEnrichedStrokeCount,
  getRadicalElementHint,
  getUnihanMetadata,
  type HanjaUnihanMetadata,
  type RadicalElementHint,
  type RadicalElementHintSourceTier,
  type UnihanVariantLinks,
} from './hanja-unihan.js';
export {
  getNameTrendAnalysis,
  type NameTrendAnalysis,
  type NameTrendGender,
  type NameTrendPoint,
  type NameTrendStatus,
} from './name-trend.js';
export {
  getPhoneticAnalysis,
  type PhoneticAnalysis,
  type PhoneticBoundaryKind,
  type PhoneticRiskLevel,
  type PhoneticSignal,
  type PhoneticStatus,
  type PhoneticSyllable,
  type PhoneticTransition,
} from './phonetic-rules.js';

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
export { buildNamingExplanation, selectNamingPhraseMode } from './naming-explanation.js';
export {
  NAMING_EVIDENCE_WEIGHT_POLICY,
  namingEvidenceWeightPolicyForPrompt,
  resolveNamingEvidenceScoringWeights,
  type NamingEvidenceSourceId,
  type NamingEvidenceWeightPresetName,
  type ResolvedNamingEvidenceScoringWeights,
} from './naming-evidence-weight-policy.js';
export {
  SCHOOL_PRESET_ORDER,
  UnknownSpringSchoolPresetError,
  isSchoolPresetName,
  loadPreset,
  resolveSchoolPresetMetadata,
  resolveSchoolPresetName,
  type SchoolPresetData,
  type SchoolPresetMetadata,
  type SchoolPresetName,
  type SchoolPresetSelectionSource,
} from './preset-loader.js';
export {
  STRUCTURED_FEEDBACK_SCHEMA_VERSION,
  FEEDBACK_AGGREGATE_SCHEMA_VERSION,
  CARD_FEEDBACK_RESPONSES,
  CANDIDATE_NAME_REJECTION_REASONS,
  FEEDBACK_CARD_IDS,
  FEEDBACK_RULE_AXES,
  FEEDBACK_FORBIDDEN_FIELDS,
  CANDIDATE_NAME_REJECTION_REASON_AXES,
  sanitizeCardFeedback,
  sanitizeCandidateNameRejectionFeedback,
  createEmptyFeedbackAggregate,
  aggregateStructuredFeedback,
  type CardFeedbackResponse,
  type CandidateNameRejectionReason,
  type FeedbackCardId,
  type FeedbackRuleAxis,
  type FeedbackForbiddenField,
  type CardFeedbackInput,
  type CandidateNameRejectionFeedbackInput,
  type StructuredCardFeedback,
  type StructuredCandidateNameRejectionFeedback,
  type StructuredFeedbackEvent,
  type FeedbackAxisCounts,
  type CardFeedbackResponseCounts,
  type CardFeedbackAggregateBucket,
  type CandidateNameRejectionAggregateBucket,
  type CardFeedbackAggregate,
  type CandidateNameRejectionAggregate,
  type FeedbackAggregateWindow,
  type FeedbackAggregatePrivacy,
  type FeedbackAggregateRetention,
  type FeedbackAggregateTotals,
  type StructuredFeedbackAggregate,
  type FeedbackAggregateOptions,
} from './feedback.js';

// ─────────────────────────────────────────────────────────────────────────────
//  8. EXPERIMENTS
// ─────────────────────────────────────────────────────────────────────────────
export {
  RULE_AB_TEST_SCHEMA_VERSION,
  RULE_EXPERIMENT_ASSIGNMENT_SCHEMA_VERSION,
  RULE_EXPERIMENT_BUCKET_COUNT,
  RULE_EXPERIMENT_MIN_POSITIVE_DELTA,
  RULE_EXPERIMENT_MIN_VARIANT_EXPOSURES,
  RULE_EXPERIMENT_DEFINITIONS,
  assignRuleExperiment,
  compareRuleExperimentVariants,
  hashRuleExperimentKey,
  type RuleExperimentAssignment,
  type RuleExperimentAssignmentInput,
  type RuleExperimentComparison,
  type RuleExperimentComparisonContext,
  type RuleExperimentComparisonRow,
  type RuleExperimentDecision,
  type RuleExperimentDefinition,
  type RuleExperimentId,
  type RuleExperimentPromotionCriteria,
  type RuleExperimentVariant,
  type RuleExperimentVariantFeedbackSnapshot,
  type RuleExperimentVariantRole,
} from './experiments.js';

// ─────────────────────────────────────────────────────────────────────────────
//  9. FORTUNE REPORT
// ─────────────────────────────────────────────────────────────────────────────
export { buildFortuneReport } from './report/buildFortuneReport.js';
export * from './report/naming-evidence/index.js';
export * from './report/delivery/index.js';
export * from './report/premium/index.js';
export * from './experience/index.js';
export * from './experience/local-menu.js';
export * from './experience/local-menu-types.js';
export type {
  FortuneReport,
  FortuneReportRequest,
  FortuneCategory,
  FortunePeriodKind,
  FortuneAdvice,
  FortuneWarning,
  StarRating,
  NameCompatibilityCard,
  OverviewSummaryCard,
  LifeFortuneOverviewCard,
  PersonalityCard,
  StrengthsWeaknessesCard,
  CautionsCard,
  FortuneTimeSeriesPoint,
  FortuneTimeSeries,
  PeriodFortuneCard,
  LifeStageFortuneCard,
  CategoryFortuneCard,
  // Tiered fortune matrix (opt-in via precisionConfig.surfaceTieredMatrix)
  FortuneTieredMatrix,
  TieredMatrixMeta,
  TieredGeneratedContentMeta,
  TieredGeneratedContentStatus,
  TieredGeneratedContentIssueCode,
  TieredNamingEvidence,
  TieredNameFrameEvidence,
  TieredNameFrameStage,
  TieredNameFrameType,
  PeriodScopedFortunes,
  AgeBandScopedFortunes,
  TieredFortune,
  TieredPeriodMeta,
  BriefFortuneText,
  StandardFortuneText,
  ExpertFortuneText,
  NumericalEvidenceRow,
  TaggedParagraph,
  ParagraphToken,
  TagGlossary,
  GlossaryEntry,
  TagId,
  TagCategory,
  TieredPeriodKind,
  TieredCategoryId,
  TieredDepth,
  TieredAgeBand,
  TieredLifeStageBand,
} from './report/types.js';
