import type { PrecisionConfig } from '../types.js';

/** Closed V1 projection of the intentionally extensible legacy PrecisionConfig. */
export type AnalysisPrecisionConfigV1 = Pick<PrecisionConfig,
  | 'useSchoolPreset'
  | 'balanceMode'
  | 'yongshinMode'
  | 'strengthMode'
  | 'tenGodMode'
  | 'gyeokgukMode'
  | 'gyeokgukSelectionRule'
  | 'fortuneCascadeMode'
  | 'sajuPriorityCurve'
  | 'unknownHourGuard'
  | 'unknownTimeSajuDamp'
  | 'hanjaPool'
  | 'pureHangulSchema'
  | 'pureHangulSignalCap'
  | 'pureHangulPolarityModel'
  | 'nameElementStrategy'
  | 'surfaceNameTrend'
  | 'surfacePhoneticEvidence'
  | 'surfaceNamingScoreVector'
  | 'paretoFrontierCandidates'
  | 'surfacePalace'
  | 'surfaceNaeum'
  | 'lunarConversionSource'
  | 'surfaceJohu'
  | 'narrativeStyle'
  | 'readingFocus'
  | 'sajuSchoolId'
  | 'saryeongScheme'
  | 'aberrationModel'
  | 'solarPrecision'
  | 'surfaceSubDomains'
  | 'surfaceTieredMatrix'
  | 'surfaceInsightFacts'
  | 'evaluatorMode'
>;

export type LocalAnalysisPrecisionConfigV1 = Omit<
  AnalysisPrecisionConfigV1,
  'lunarConversionSource'
> & {
  readonly lunarConversionSource?: 'builtin';
};

/** Registration clients supply analysis choices, never server infrastructure. */
export type PremiumRegistrationPrecisionConfigV1 = Omit<
  AnalysisPrecisionConfigV1,
  'lunarConversionSource'
>;
