export { SeedTs } from './seed.js';
export type {
  AnalysisType,
  BirthCalendarType,
  BirthDateTime,
  FourFrameEnrichmentState,
  Gender,
  NamingResult,
  PureHangulNameMode,
  SeedAnalysisOptions,
  SeedResult,
  UserInfo,
} from './types.js';

export {
  SeedCalculationError,
  SeedEngineError,
  SeedValidationError,
} from './errors.js';
export type {
  SeedErrorCode,
  SeedErrorKind,
  SeedErrorPayload,
} from './errors.js';

export { SEED_SCORING_POLICY } from './scoring-policy.js';
export type { SeedScoringPolicyV1 } from './scoring-policy.js';

export { EnergyCalculator } from './calculator/energy-calculator.js';
export type {
  EnergyCalculationStatus,
  EnergyVisitor,
} from './calculator/energy-calculator.js';
export { FourFrameCalculator } from './calculator/frame-calculator.js';
export { HangulCalculator } from './calculator/hangul-calculator.js';
export { HanjaCalculator } from './calculator/hanja-calculator.js';

export { Element } from './model/element.js';
export { Energy } from './model/energy.js';
export { Polarity } from './model/polarity.js';

export {
  compileFourFrameContract,
  FOURFRAME_CONTRACT_INVALID,
  FOURFRAME_EXPECTED_RECORD_COUNT,
  FOURFRAME_LUCKY_LEVELS,
  FOURFRAME_MAX_NUMBER,
  FOURFRAME_MIN_NUMBER,
  FourFrameContractError,
  normalizeFourFrameNumber,
} from './fourframe-contract.js';
export type {
  CompiledFourFrameContract,
  FourFrameContractField,
  FourFrameContractIssue,
  FourFrameContractRecord,
  FourFrameLuckyLevel,
} from './fourframe-contract.js';
export {
  FOURFRAME_CATALOG_PROVENANCE,
  FOURFRAME_MEANING_CATALOG,
  getFourframeMeaningByNumber,
} from './fourframe-catalog.js';
export type {
  FourframeCatalogProvenance,
} from './fourframe-catalog.js';
export {
  ServiceTextPolicyError,
  assertServiceTextPolicy,
  auditServiceTextPolicy,
} from './service-text-policy.js';
export type {
  ServiceTextPolicyAssertionOptions,
  ServiceTextPolicySeverity,
  ServiceTextPolicyViolation,
} from './service-text-policy.js';

export {
  FourframeRepository,
  type FourframeMeaningEntry,
  type FourframeRepositoryOptions,
} from './database/fourframe-repository.js';
export {
  HanjaRepository,
  type HanjaEntry,
  type HanjaRepositoryOptions,
} from './database/hanja-repository.js';
export {
  NameStatRepository,
  type NameGenderRatioEntry,
  type NameStatRepositoryOptions,
  type NameStatEntry,
} from './database/name-stat-repository.js';
export {
  DEFAULT_SQL_JS_WASM_SHA256,
  DEFAULT_SQL_JS_WASM_URL,
  RepositoryConfigurationError,
  RepositoryIntegrityError,
} from './database/repository-runtime.js';
export {
  REPOSITORY_DATABASE_INTEGRITY_MISMATCH,
  RepositoryDatabaseIntegrityError,
  verifyOpenedRepositoryDatabase,
  verifyRepositoryDatabaseBytesBeforeOpen,
} from './database/database-integrity.js';
export type {
  RepositoryDatabaseIntegrityReason,
  RepositoryDatabaseIntegrityValue,
} from './database/database-integrity.js';
export type {
  DatabaseAssetManifest,
  DatabaseAssetManifestEntry,
  NormalizedDatabaseColumn,
} from './database/database-asset-contract.js';
export type {
  CanonicalRepositoryDatabaseIntegrityPolicy,
  CanonicalRepositoryDatabaseShardSetIntegrityPolicy,
  PinnedRepositoryDatabaseIntegrityPolicy,
  PinnedRepositoryDatabaseShardSetIntegrityPolicy,
  RepositoryDatabaseIntegrityPolicy,
  RepositoryDatabaseShardSetIntegrityPolicy,
} from './database/repository-database-policy.js';
export type {
  RepositoryFetch,
  RepositoryFetchResponse,
  RepositoryRuntimeOverrides,
  RepositoryWasmOptions,
  SqlJsLoader,
} from './database/repository-runtime.js';
export {
  REPOSITORY_DATA_INVALID,
  RepositoryDataError,
} from './database/repository-errors.js';
export type { RepositoryDataSource } from './database/repository-errors.js';

export {
  buildHangulPseudoEntry,
  decomposeHangulSyllable,
  hangulElementFromSyllable,
  hangulStrokeCount,
  strokeElementFromStrokeCount,
  toHangulOnlyEntry,
  type HangulPseudoEntryOptions,
  type HangulSyllableParts,
  type NameElementKey,
} from './utils/hangul-name-entry.js';
