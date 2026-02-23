/**
 * report/index.ts -- Public barrel file for the fortune report system
 */

export { buildFortuneReport } from './buildFortuneReport.js';
export type {
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
  FortuneTimeSeriesPoint,
  FortuneTimeSeries,
  PeriodFortuneCard,
  LifeStageFortuneCard,
  CategoryFortuneCard,
} from './types.js';
