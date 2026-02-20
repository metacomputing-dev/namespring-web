export { createEngine } from './api/engine.js';
export { defaultConfig } from './api/config.js';
export { analyzeSaju, configFromPreset, createBirthInput } from './compat/springLegacy.js';
export type { LegacyBirthInput, LegacySajuConfig, LegacySajuOptions } from './compat/springLegacy.js';

export { listSchoolPresets, getSchoolPreset, applySchoolPreset } from './schools/index.js';
export type { SchoolPreset } from './schools/index.js';

export { packAnalysisBundleZip, unpackAnalysisBundleZip } from './artifacts/index.js';
export type { AnalysisZipInclude, AnalysisZipManifest, AnalysisZipOptions } from './artifacts/index.js';

export { buildNarrationArtifact } from './narration/index.js';
export type { NarrationArtifact, NarrationLanguage, NarrationOptions } from './narration/index.js';

export type {
  AnalysisBundle,
  Artifact,
  EngineConfig,
  EngineWeights,
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


export { stemHanja, branchHanja, stemElement, branchElement, stemYinYang, branchYinYang } from './core/cycle.js';
export { tenGodOf } from './core/tenGod.js';
export { detectBranchRelations } from './core/branchRelations.js';
export { hiddenStemsOfBranch, rawHiddenStemsTable } from './core/hiddenStems.js';
export { elementDistributionFromPillars } from './core/elementDistribution.js';
