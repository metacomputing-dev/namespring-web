import { type AnalysisTraceStep, type BirthInput } from '../domain/types.js';
import { type CalculationConfig, DEFAULT_CONFIG } from '../config/CalculationConfig.js';
import { calculatePillars } from './SajuCalculator.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { TenGodCalculator } from './analysis/TenGodCalculator.js';
import { analyzeAllPillars } from './analysis/SibiUnseongCalculator.js';
import { StrengthAnalyzer } from './analysis/StrengthAnalyzer.js';
import { GyeokgukDeterminer } from './analysis/GyeokgukDeterminer.js';
import { GyeokgukFormationAssessor } from './analysis/GyeokgukFormationAssessor.js';
import { YongshinDecider } from './analysis/YongshinDecider.js';
import { HapHwaEvaluator } from './analysis/HapHwaEvaluator.js';
import { calculateGongmang } from './analysis/GongmangCalculator.js';
import { PalaceAnalyzer } from './analysis/PalaceAnalyzer.js';
import { CheonganRelationAnalyzer } from './analysis/CheonganRelationAnalyzer.js';
import { DaeunCalculator } from './luck/DaeunCalculator.js';
import { SaeunCalculator } from './luck/SaeunCalculator.js';
import { buildOhaengDistribution } from './pipeline/OhaengHelpers.js';
import { calculateDaysSinceJeol } from './pipeline/JeolBoundaryHelpers.js';
import {
  buildDaeunReasoning,
  buildSaeunReasoning,
} from './pipeline/LuckTraceReasoningBuilders.js';
import { buildDaeunTraceStep, buildSaeunTraceStep } from './pipeline/LuckTraceBuilders.js';
import { buildTenGodTraceStep, buildHiddenStemTraceStep } from './pipeline/TenGodAndHiddenStemTraceBuilders.js';
import {
  buildCheonganRelationsTraceStep,
  buildResolvedJijiRelationsTraceStep,
  buildScoredCheonganRelationsTraceStep,
} from './pipeline/RelationTraceBuilders.js';
import { buildPalaceTraceStep } from './pipeline/PalaceTraceBuilders.js';
import {
  buildShinsalCompositesTraceStep,
  buildShinsalTraceStep,
  buildWeightedShinsalTraceStep,
} from './pipeline/ShinsalTraceBuilders.js';
import { buildHapHwaTraceStep } from './pipeline/HapHwaTraceBuilders.js';
import { buildSibiUnseongTraceStep } from './pipeline/LifeStageTraceBuilders.js';
import { buildGongmangTraceStep, buildStrengthTraceStep } from './pipeline/GongmangStrengthTraceBuilders.js';
import { buildGyeokgukTraceStep, buildYongshinTraceStep } from './pipeline/GyeokgukYongshinTraceBuilders.js';
import { detectAndTrace, tracedStep } from './pipeline/TraceHelpers.js';
import { buildSajuAnalysis } from './pipeline/SajuAnalysisAssembler.js';
import { analyzeRelationsBundle } from './pipeline/RelationAnalysisHelpers.js';
import { analyzeShinsalBundle } from './pipeline/ShinsalAnalysisHelpers.js';
export interface SajuAnalysisOptions {
  readonly daeunCount: number;
  readonly saeunStartYear: number | null;
  readonly saeunYearCount: number;
}

const DEFAULT_OPTIONS: SajuAnalysisOptions = {
  daeunCount: 8,
  saeunStartYear: null,
  saeunYearCount: 10,
};
export function analyzeSaju(
  input: BirthInput,
  config: CalculationConfig = DEFAULT_CONFIG,
  options: Partial<SajuAnalysisOptions> = {},
): SajuAnalysis {
  const opts: SajuAnalysisOptions = { ...DEFAULT_OPTIONS, ...options };
  const { birthYear, birthMonth, birthDay, birthHour, birthMinute, gender } = input;

  const coreResult = calculatePillars(input, config);
  const pillars = coreResult.pillars;
  const dayMaster = pillars.day.cheongan;
  const dmInfo = CHEONGAN_INFO[dayMaster];

  const ohaengDistribution = buildOhaengDistribution(pillars);

  const daysSinceJeol = calculateDaysSinceJeol(
    coreResult.standardYear, coreResult.standardMonth, coreResult.standardDay,
    coreResult.standardHour, coreResult.standardMinute,
  );

  const trace: AnalysisTraceStep[] = [];
  const appendTrace = (...steps: AnalysisTraceStep[]): void => {
    trace.push(...steps);
  };

  appendTrace(tracedStep(
    'core',
    `사주 원국 계산 완료 -- 일간 ${dmInfo.hangul}(${dmInfo.hanja}), ` +
    `월지 ${JIJI_INFO[pillars.month.jiji].hangul}(${JIJI_INFO[pillars.month.jiji].hanja}). ` +
    `입절 차 ${daysSinceJeol ?? '?'}일차.`,
    [`daysSinceJeol=${daysSinceJeol ?? 'N/A'}`],
    [
      `년주: ${CHEONGAN_INFO[pillars.year.cheongan].hangul}${JIJI_INFO[pillars.year.jiji].hangul}, ` +
      `월주: ${CHEONGAN_INFO[pillars.month.cheongan].hangul}${JIJI_INFO[pillars.month.jiji].hangul}, ` +
      `일주: ${CHEONGAN_INFO[pillars.day.cheongan].hangul}${JIJI_INFO[pillars.day.jiji].hangul}, ` +
      `시주: ${CHEONGAN_INFO[pillars.hour.cheongan].hangul}${JIJI_INFO[pillars.hour.jiji].hangul}`,
    ],
  ));

  const tenGodAnalysis = TenGodCalculator.analyzePillars(
    dayMaster, pillars, config.hiddenStemVariant,
  );

  appendTrace(
    buildTenGodTraceStep(dmInfo, tenGodAnalysis),
    buildHiddenStemTraceStep(tenGodAnalysis, config.hiddenStemVariant),
  );

  const cheonganRelationAnalyzer = new CheonganRelationAnalyzer();
  const cheonganRelations = detectAndTrace(
    trace,
    () => cheonganRelationAnalyzer.analyze(pillars),
    buildCheonganRelationsTraceStep,
  );

  const hapHwaEvaluations = HapHwaEvaluator.evaluate(
    pillars,
    config.hapHwaStrictness,
    config.dayMasterNeverHapGeo,
  );

  detectAndTrace(
    trace,
    () => hapHwaEvaluations,
    hapHwaEvaluations => buildHapHwaTraceStep(
      hapHwaEvaluations,
      config.hapHwaStrictness,
      config.dayMasterNeverHapGeo,
    ),
  );

  const {
    rawJijiRelations,
    resolvedJijiRelations,
    scoredCheonganRelations,
  } = analyzeRelationsBundle(
    pillars,
    cheonganRelations,
    hapHwaEvaluations,
    config.allowBanhap,
  );

  appendTrace(
    buildResolvedJijiRelationsTraceStep(resolvedJijiRelations, config.allowBanhap),
    buildScoredCheonganRelationsTraceStep(scoredCheonganRelations),
  );

  const sibiUnseong = analyzeAllPillars(dayMaster, pillars, config);
  appendTrace(buildSibiUnseongTraceStep(sibiUnseong, pillars, dmInfo, config));

  const gongmang = calculateGongmang(pillars);
  appendTrace(buildGongmangTraceStep(gongmang, pillars));

  const strength = StrengthAnalyzer.analyze(
    pillars, config, daysSinceJeol, hapHwaEvaluations,
  );

  appendTrace(buildStrengthTraceStep(strength, dmInfo, config.strengthThreshold));

  const gyeokgukRaw = GyeokgukDeterminer.determine(
    pillars, strength, hapHwaEvaluations, config,
  );
  const formation = GyeokgukFormationAssessor.assess(
    gyeokgukRaw, pillars, strength,
  );
  const gyeokguk = { ...gyeokgukRaw, formation };

  appendTrace(buildGyeokgukTraceStep(gyeokguk));

  const yongshin = YongshinDecider.decide(
    pillars, strength.isStrong, dmInfo.ohaeng, config, gyeokguk, hapHwaEvaluations,
  );

  appendTrace(buildYongshinTraceStep(yongshin, config.yongshinPriority));

  const {
    shinsalHits,
    weightedShinsalHits,
    shinsalComposites,
    shinsalReferenceNote,
  } = analyzeShinsalBundle(pillars, config);

  detectAndTrace(trace, () => shinsalHits, shinsalHits =>
    buildShinsalTraceStep(shinsalHits, shinsalReferenceNote));

  appendTrace(
    buildWeightedShinsalTraceStep(weightedShinsalHits),
    buildShinsalCompositesTraceStep(shinsalComposites),
  );

  const palace = PalaceAnalyzer.analyze(
    pillars, dayMaster, gender,
  );

  appendTrace(buildPalaceTraceStep(palace));

  const daeun = DaeunCalculator.calculate(
    pillars, gender,
    birthYear, birthMonth, birthDay,
    birthHour, birthMinute,
    opts.daeunCount,
  );

  const daeunReasoning = buildDaeunReasoning(
    gender,
    pillars.year.cheongan,
    daeun,
    yongshin,
    dmInfo.ohaeng,
  );

  appendTrace(buildDaeunTraceStep(daeun, daeunReasoning));

  const saeunStartYear = opts.saeunStartYear ?? birthYear;
  const saeun = SaeunCalculator.calculate(saeunStartYear, opts.saeunYearCount);

  const saeunReasoning = buildSaeunReasoning(saeun, pillars, yongshin);

  appendTrace(buildSaeunTraceStep(saeunStartYear, saeun, saeunReasoning));

  return buildSajuAnalysis({
    coreResult,
    rawJijiRelations,
    cheonganRelations,
    hapHwaEvaluations,
    resolvedJijiRelations,
    scoredCheonganRelations,
    sibiUnseong,
    gongmang,
    strength,
    yongshin,
    gyeokguk,
    shinsalHits,
    weightedShinsalHits,
    shinsalComposites,
    palace,
    daeun,
    saeun,
    ohaengDistribution,
    trace,
    tenGodAnalysis,
  });
}
export class SajuAnalysisPipeline {
  private readonly config: CalculationConfig;

  constructor(config: CalculationConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  analyze(
    input: BirthInput,
    saeunStartYear: number | null = null,
    saeunCount: number = 10,
    daeunCount: number = 8,
  ): SajuAnalysis {
    return analyzeSaju(input, this.config, {
      daeunCount,
      saeunStartYear,
      saeunYearCount: saeunCount,
    });
  }
}

