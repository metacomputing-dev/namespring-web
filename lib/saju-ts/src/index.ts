export { Eumyang, EUMYANG_INFO, EUMYANG_VALUES } from './domain/Eumyang.js';
export { Ohaeng, OhaengRelation, OHAENG_VALUES, ohaengOrdinal, OhaengRelations } from './domain/Ohaeng.js';
export { Cheongan, CHEONGAN_INFO, CHEONGAN_VALUES, cheonganOrdinal } from './domain/Cheongan.js';
export type { CheonganInfo } from './domain/Cheongan.js';
export { Jiji, JIJI_INFO, JIJI_VALUES, jijiOrdinal } from './domain/Jiji.js';
export type { JijiInfo } from './domain/Jiji.js';
export { Gender } from './domain/Gender.js';
export { PillarPosition, PILLAR_POSITION_VALUES } from './domain/PillarPosition.js';
export { SibiUnseong, SIBI_UNSEONG_INFO, SIBI_UNSEONG_VALUES } from './domain/SibiUnseong.js';
export type { SibiUnseongInfo } from './domain/SibiUnseong.js';
export { Sipseong, SIPSEONG_INFO, SIPSEONG_VALUES } from './domain/Sipseong.js';
export type { SipseongInfo } from './domain/Sipseong.js';
export { ClassicalSource, CLASSICAL_SOURCE_INFO, inlineCitation } from './domain/ClassicalSource.js';
export type { ClassicalSourceInfo } from './domain/ClassicalSource.js';
export { ShinsalGrade, ShinsalType, SHINSAL_TYPE_INFO } from './domain/Shinsal.js';
export type { ShinsalTypeInfo, ShinsalHit } from './domain/Shinsal.js';

export { Pillar } from './domain/Pillar.js';
export { PillarSet } from './domain/PillarSet.js';
export { HiddenStemRole, HiddenStemVariant, HiddenStemDayAllocation, HiddenStemTable } from './domain/HiddenStem.js';
export type { HiddenStemEntry } from './domain/HiddenStem.js';

export {
  GyeokgukType, GYEOKGUK_TYPE_INFO, gyeokgukFromSipseong, ilhaengFromOhaeng,
  GyeokgukCategory, GyeokgukQuality, GYEOKGUK_QUALITY_INFO,
} from './domain/Gyeokguk.js';
export type { GyeokgukFormation, GyeokgukResult } from './domain/Gyeokguk.js';

export { StrengthLevel, STRENGTH_LEVEL_INFO, isStrongSide } from './domain/StrengthResult.js';
export type { StrengthScore, StrengthResult } from './domain/StrengthResult.js';

export { YongshinType, YONGSHIN_TYPE_INFO, YongshinAgreement, YONGSHIN_AGREEMENT_INFO } from './domain/YongshinResult.js';
export type { YongshinRecommendation, YongshinResult } from './domain/YongshinResult.js';

export { DaeunBoundaryMode } from './domain/DaeunInfo.js';
export type { DaeunPillar, DaeunInfo } from './domain/DaeunInfo.js';

export { PalaceFavor } from './domain/Palace.js';
export type { PalaceInfo, FamilyRelation, PalaceInterpretation, PalaceAnalysis } from './domain/Palace.js';

export {
  CheonganRelationType, JijiRelationType,
  HapState, HAP_STATE_INFO, InteractionOutcome,
  CompositeInteractionType, COMPOSITE_INTERACTION_INFO,
} from './domain/Relations.js';
export type {
  CheonganRelationHit, JijiRelationHit,
  InteractionScore, ScoredCheonganRelation,
  HapHwaEvaluation, ResolvedRelation,
  WeightedShinsalHit, ShinsalComposite,
} from './domain/Relations.js';

export { CompatibilityGrade, COMPATIBILITY_GRADE_INFO } from './domain/Compatibility.js';
export type {
  DayMasterCompatibility, DayBranchCompatibility,
  OhaengComplementResult, SipseongCrossResult,
  ShinsalMatchResult, CompatibilityResult,
} from './domain/Compatibility.js';

export type { HiddenStemSipseong, PillarTenGodAnalysis, TenGodAnalysis } from './domain/TenGodAnalysis.js';

export type { IljuInterpretation } from './domain/IljuInterpretation.js';

export { createBirthInput, normalizeBirthDateByCalendar } from './domain/types.js';
export type {
  BirthInput,
  BirthInputParams,
  BirthCalendarType,
  LeapMonthInput,
  NormalizedBirthDate,
  AnalysisTraceStep,
} from './domain/types.js';

export { DayCutMode } from './calendar/time/DayCutMode.js';
export { adjustSolarTime, standardMeridianDegrees, lmtOffsetMinutes, equationOfTimeMinutes } from './calendar/time/SolarTimeAdjuster.js';
export type { SolarTimeAdjustment } from './calendar/time/SolarTimeAdjuster.js';
export { koreanDstOffsetMinutes, KOREAN_DST_RANGES } from './calendar/time/KoreanDstPeriod.js';
export { JeolBoundaryTable } from './calendar/solar/JeolBoundaryTable.js';
export type { JeolBoundary } from './calendar/solar/JeolBoundaryTable.js';
export { createLunarDate, formatLunarDate, lunarDateEquals } from './calendar/lunar/LunarDate.js';
export type { LunarDate, SolarDate } from './calendar/lunar/LunarDate.js';
export {
  KoreanLunarAlgorithmicConverter,
  lunarToSolar, solarToLunar,
  MIN_LUNAR_YEAR, MAX_LUNAR_YEAR,
} from './calendar/lunar/KoreanLunarAlgorithmicConverter.js';

export type { SaeunPillar, WolunPillar, JeolBoundaryMoment } from './domain/SaeunInfo.js';
export { LuckQuality, LUCK_QUALITY_INFO } from './domain/LuckInteraction.js';
export type { LuckPillarAnalysis, DaeunAnalysis } from './domain/LuckInteraction.js';

export type { SajuAnalysis } from './domain/SajuAnalysis.js';

export { GanjiCycle } from './engine/GanjiCycle.js';
export { calculatePillars } from './engine/SajuCalculator.js';
export type { SajuPillarResult } from './engine/SajuCalculator.js';
export { analyzeSaju, SajuAnalysisPipeline } from './engine/SajuAnalysisPipeline.js';
export type { SajuAnalysisOptions } from './engine/SajuAnalysisPipeline.js';

export { TenGodCalculator } from './engine/analysis/TenGodCalculator.js';
export { calculateSibiUnseong, analyzeAllPillars } from './engine/analysis/SibiUnseongCalculator.js';
export { StrengthAnalyzer } from './engine/analysis/StrengthAnalyzer.js';
export { GyeokgukDeterminer } from './engine/analysis/GyeokgukDeterminer.js';
export { YongshinDecider } from './engine/analysis/YongshinDecider.js';
export { HapHwaEvaluator } from './engine/analysis/HapHwaEvaluator.js';
export { ShinsalDetector } from './engine/analysis/ShinsalDetector.js';
export { DefaultRelationAnalyzer } from './engine/analysis/DefaultRelationAnalyzer.js';
export { CheonganRelationAnalyzer } from './engine/analysis/CheonganRelationAnalyzer.js';
export { RelationAnalyzer } from './engine/analysis/RelationAnalyzer.js';
export { calculateGongmang, voidBranchesOf } from './engine/analysis/GongmangCalculator.js';
export type { GongmangHit, GongmangResult } from './engine/analysis/GongmangCalculator.js';
export { PalaceAnalyzer } from './engine/analysis/PalaceAnalyzer.js';
export { JohuTable } from './engine/analysis/JohuTable.js';
export type { JohuEntry } from './engine/analysis/JohuTable.js';
export { DefaultHiddenStemResolver } from './engine/analysis/HiddenStemResolver.js';
export type { HiddenStemResolver } from './engine/analysis/HiddenStemResolver.js';
export { SaryeongDeterminer } from './engine/analysis/SaryeongDeterminer.js';

export { DaeunCalculator } from './engine/luck/DaeunCalculator.js';
export { SaeunCalculator } from './engine/luck/SaeunCalculator.js';
export { LuckInteractionAnalyzer } from './engine/luck/LuckInteractionAnalyzer.js';

export { TraceCategory, TRACE_CATEGORY_INFO, createTraceEntry, CalculationTracer } from './engine/trace/CalculationTrace.js';
export type { TraceEntry, AlternativeDecision } from './engine/trace/CalculationTrace.js';
export { TraceAwarePillarCalculator } from './engine/trace/TraceAwarePillarCalculator.js';

export { SipseongInterpreter } from './interpretation/SipseongInterpreter.js';
export { SibiUnseongInterpreter } from './interpretation/SibiUnseongInterpreter.js';
export { StrengthInterpreter } from './interpretation/StrengthInterpreter.js';
export { IljuInterpreter } from './interpretation/IljuInterpreter.js';
export { CheonganSignificanceInterpreter } from './interpretation/CheonganSignificanceInterpreter.js';
export { RelationSignificanceInterpreter } from './interpretation/RelationSignificanceInterpreter.js';
export { StrengthAwareSipseongInterpreter } from './interpretation/StrengthAwareSipseongInterpreter.js';
export { CompatibilityInterpreter } from './interpretation/CompatibilityInterpreter.js';
export { CompatibilityNarrative } from './interpretation/CompatibilityNarrative.js';
export { LuckNarrativeInterpreter } from './interpretation/LuckNarrativeInterpreter.js';
export { OhaengPracticalGuide } from './interpretation/OhaengPracticalGuide.js';
export { RuleConfidencePolicy } from './interpretation/RuleConfidencePolicy.js';
export { RuleCitationRegistry } from './interpretation/RuleCitationRegistry.js';
export { shinsalGyeokgukSynergyLookup, SHINSAL_TYPES_WITH_SYNERGY } from './interpretation/ShinsalGyeokgukSynergyMatrix.js';
export { interpretLifeDomains } from './interpretation/LifeDomainInterpreter.js';
export type { DomainReading } from './interpretation/LifeDomainInterpreter.js';
export { buildYearlyFortune, yearlyFortuneToNarrative } from './interpretation/YearlyFortuneInterpreter.js';
export type { YearlyFortune, MonthlyHighlight } from './interpretation/YearlyFortuneInterpreter.js';
export { NarrativeEngine } from './interpretation/NarrativeEngine.js';

export {
  SaryeongMode, EarthLifeStageRule, HiddenStemScope,
  YongshinPriority, JonggyeokYongshinMode, HapHwaStrictness,
  GwiiinTableVariant, ShinsalReferenceBranch, JeolgiPrecision,
  SchoolPreset, DEFAULT_CONFIG, createConfig, configFromPreset,
} from './config/CalculationConfig.js';
export type { CalculationConfig } from './config/CalculationConfig.js';
export { ConfigDocumentation } from './config/ConfigDocumentation.js';
export type { ConfigOption, ConfigDifference } from './config/ConfigDocumentation.js';

