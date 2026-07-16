export { createEngine } from './api/engine.js';
export {
  defaultConfig,
  InvalidEngineConfigError,
  InvalidLongitudeCorrectionPolicyError,
  InvalidSchoolPresetSelectorError,
} from './api/config.js';
export { UnsupportedConfigSchemaVersionError } from './api/migrations.js';
export { InvalidIsoInstantError } from './calendar/iso.js';
export { SajuRequestValidationError } from './calendar/normalizeRequest.js';
export {
  analyzeSaju,
  configFromPreset,
  createBirthInput,
  LegacyAmbiguousTimeError,
  LegacyBirthLocationError,
  LegacyCivilTimeError,
  LegacyContractConfigError,
  LegacyContractOutputError,
  LegacyNonexistentTimeError,
  LegacyTimezoneDataUnsupportedError,
  LegacyTimezoneError,
  resolveOffsetMinutes,
} from './compat/springLegacy.js';
export type {
  LegacyBirthLocationErrorCode,
  LegacyBirthInput,
  LegacyLongitudeCorrectionPolicy,
  LegacySajuConfig,
  LegacySajuOptions,
  LegacySajuOutputV1,
  LegacyPillarV1,
  LegacyCoreResultV1,
  LegacyJieProximityV1,
  LegacyStrengthResultV1,
  LegacyYongshinResultV1,
  LegacyGyeokgukResultV1,
  LegacyDaeunInfoV1,
  LegacyDaeunPillarV1,
  LegacySaeunPillarV1,
  LegacyWolunPillarV1,
  LegacyTraceEntryV1,
} from './compat/springLegacy.js';

export {
  InvalidSchoolPresetPackError,
  UnknownSchoolPresetError,
  listSchoolPresets,
  getSchoolPreset,
  applySchoolPreset,
} from './schools/index.js';
export type { SchoolPreset, SchoolPresetPack } from './schools/index.js';

export { packAnalysisBundleZip, unpackAnalysisBundleZip } from './artifacts/index.js';
export type { AnalysisZipInclude, AnalysisZipManifest, AnalysisZipOptions } from './artifacts/index.js';

export { buildNarrationArtifact } from './narration/index.js';
export type { NarrationArtifact, NarrationLanguage, NarrationOptions } from './narration/index.js';

export type {
  AnalysisBundle,
  Artifact,
  EngineConfig,
  EngineWeights,
  LongitudeCorrectionPolicy,
  SchoolConfig,
  FullReport,
  SajuRequest,
  SummaryReport,
  TraceNode,
} from './api/types.js';

export type {
  ShinsalCatalogName,
  ShinsalMacro,
  ShinsalRuleSpec,
  ShinsalRuleSpecBase,
  ShinsalRuleSpecMode,
} from './rules/spec/shinsalSpec.js';
export { compileShinsalRuleSpec } from './rules/spec/compileShinsalSpec.js';

export type {
  YongshinMacro,
  YongshinRole,
  YongshinRuleSpec,
  YongshinRuleSpecBase,
  YongshinRuleSpecMode,
} from './rules/spec/yongshinSpec.js';
export { compileYongshinRuleSpec } from './rules/spec/compileYongshinSpec.js';

export type {
  GyeokgukMacro,
  GyeokgukRuleSpec,
  GyeokgukRuleSpecBase,
  GyeokgukRuleSpecMode,
} from './rules/spec/gyeokgukSpec.js';
export { compileGyeokgukRuleSpec } from './rules/spec/compileGyeokgukSpec.js';

export type {
  ShinsalConditionsMacro,
  ShinsalConditionsRuleSpec,
  ShinsalConditionsRuleSpecBase,
  ShinsalConditionsRuleSpecMode,
} from './rules/spec/shinsalConditionsSpec.js';
export { compileShinsalConditionsRuleSpec } from './rules/spec/compileShinsalConditionsSpec.js';
export { InvalidRuleSpecError } from './rules/spec/ruleSpecValidation.js';


export { stemHanja, branchHanja, stemElement, branchElement, stemYinYang, branchYinYang } from './core/cycle.js';
export { tenGodOf } from './core/tenGod.js';
export { stemIdxFromHanja, branchIdxFromHanja } from './core/cycle.js';
export { detectBranchRelations } from './core/branchRelations.js';
export { hiddenStemsOfBranch, rawHiddenStemsTable } from './core/hiddenStems.js';
export {
  analyzePalaces,
  PALACE_INFO,
  type PalaceMeta,
  type PalacePosition,
  type PalaceRootStatus,
  type PalaceStatus,
  type PalaceView,
  type PalaceReport,
  type PalacePillarInput,
  type PalacePillarsInput,
} from './core/palace.js';
export {
  analyzeNaeum,
  NAEUM_PAIR_TABLE,
  NAEUM_BY_GANZHI,
  type NaeumEntry,
  type NaeumPosition,
  type NaeumPillarInput,
  type NaeumPositionView,
  type NaeumReport,
} from './core/naeum.js';
export { elementDistributionFromPillars } from './core/elementDistribution.js';
