export * from './buildIntegratedReport.js';
export { scoreNameAgainstSaju } from './common/namingScoreEngine.js';
export type {
  ScoreNameAgainstSajuInput,
  NamingScoreCategoryResult,
  NamingScoreCategoryBreakdown,
  NamingScoreTargetProfile,
  NamingScoreDistribution,
  NamingScoreBreakdown,
} from './common/namingScoreEngine.js';
export { buildSajuNameIntegrationSignals } from './common/sajuNameIntegration.js';
export type {
  ElementCode as SajuNameIntegrationElementCode,
  SajuCoreSignalsInput,
  NamingSignalsInput,
  SajuNameIntegrationInput,
  SajuNameIntegrationSignals,
} from './common/sajuNameIntegration.js';
export * from './knowledge/branchEncyclopedia.js';
export * from './knowledge/elementRelationsEncyclopedia.js';
export * from './knowledge/gyeokgukEncyclopedia.js';
export * from './knowledge/lifeStageEncyclopedia.js';
export * from './knowledge/namingPrinciplesEncyclopedia.js';
export * from './knowledge/shinsalEncyclopedia.js';
export * from './knowledge/stemEncyclopedia.js';
export * from './knowledge/tenGodEncyclopedia.js';
export type * from './types.js';
