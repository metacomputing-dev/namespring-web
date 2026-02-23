/**
 * report/index.ts -- Public barrel file for the premium report system
 *
 * Re-exports the report builder and all report-related types so that
 * consumers can import everything from a single entry point:
 *
 *   import { buildPremiumSajuReport } from './report/index.js';
 *   import type { PremiumSajuReport } from './report/index.js';
 */

export { buildPremiumSajuReport } from './buildPremiumReport.js';
export { buildFortuneReport } from './buildFortuneReport.js';
export type {
  PremiumSajuReport,
  PremiumReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ReportSubsection,
  PremiumSectionId,
  // Fortune report types
  FortuneReport,
  FortuneReportRequest,
  FortuneCategory,
  FortunePeriodKind,
  FortuneAdvice,
  FortuneWarning,
  StarRating,
  ReportMeta,
  NameCompatibilityCard,
  OverviewSummaryCard,
  LifeFortuneOverviewCard,
  PersonalityCard,
  StrengthsWeaknessesCard,
  CautionsCard,
  PeriodFortuneCard,
  LifeStageFortuneCard,
  CategoryFortuneCard,
} from './types.js';

export { computeDateFortune } from './common/dateFortune.js';
export type { PillarFortune, DateFortuneResult } from './common/dateFortune.js';

export {
  generateDetailedYearFortune,
  generateDetailedMonthFortune,
  generateDetailedDayFortune,
} from './sections/section-dateFortune.js';
export type { DetailedFortuneReport, YongshinInfo } from './sections/section-dateFortune.js';
