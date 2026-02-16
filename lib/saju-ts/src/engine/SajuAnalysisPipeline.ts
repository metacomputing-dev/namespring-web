import { type AnalysisTraceStep, type BirthInput } from '../domain/types.js';
import { type CalculationConfig, DEFAULT_CONFIG } from '../config/CalculationConfig.js';
import { calculatePillars } from './SajuCalculator.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { type SaeunPillar } from '../domain/SaeunInfo.js';
import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import { type StrengthResult } from '../domain/StrengthResult.js';
import { type GyeokgukResult, type GyeokgukFormation } from '../domain/Gyeokguk.js';
import { type YongshinResult } from '../domain/YongshinResult.js';
import { type DaeunInfo } from '../domain/DaeunInfo.js';
import { type PalaceAnalysis } from '../domain/Palace.js';
import { type TenGodAnalysis } from '../domain/TenGodAnalysis.js';
import { type GongmangResult } from './analysis/GongmangCalculator.js';

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

  trace.push(tracedStep(
    'core',
    `?�주 ?�국 계산 ?�료 ???�간 ${dmInfo.hangul}(${dmInfo.hanja}), ` +
    `?��? ${JIJI_INFO[pillars.month.jiji].hangul}(${JIJI_INFO[pillars.month.jiji].hanja}). ` +
    `?�입 ??${daysSinceJeol ?? '?'}?�차.`,
    [`daysSinceJeol=${daysSinceJeol ?? 'N/A'}`],
    [
      `?�주: ${CHEONGAN_INFO[pillars.year.cheongan].hangul}${JIJI_INFO[pillars.year.jiji].hangul}, ` +
      `?�주: ${CHEONGAN_INFO[pillars.month.cheongan].hangul}${JIJI_INFO[pillars.month.jiji].hangul}, ` +
      `?�주: ${CHEONGAN_INFO[pillars.day.cheongan].hangul}${JIJI_INFO[pillars.day.jiji].hangul}, ` +
      `?�주: ${CHEONGAN_INFO[pillars.hour.cheongan].hangul}${JIJI_INFO[pillars.hour.jiji].hangul}`,
    ],
  ));

  const tenGodAnalysis: TenGodAnalysis = TenGodCalculator.analyzePillars(
    dayMaster, pillars, config.hiddenStemVariant,
  );

  trace.push(buildTenGodTraceStep(dmInfo, tenGodAnalysis));

  trace.push(buildHiddenStemTraceStep(tenGodAnalysis, config.hiddenStemVariant));

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

  trace.push(buildResolvedJijiRelationsTraceStep(resolvedJijiRelations, config.allowBanhap));
  trace.push(buildScoredCheonganRelationsTraceStep(scoredCheonganRelations));

  const sibiUnseong = analyzeAllPillars(dayMaster, pillars, config);

  trace.push(buildSibiUnseongTraceStep(sibiUnseong, pillars, dmInfo, config));

  const gongmang: GongmangResult = calculateGongmang(pillars);

  trace.push(buildGongmangTraceStep(gongmang, pillars));

  const strength: StrengthResult = StrengthAnalyzer.analyze(
    pillars, config, daysSinceJeol, hapHwaEvaluations,
  );

  trace.push(buildStrengthTraceStep(strength, dmInfo, config.strengthThreshold));

  const gyeokgukRaw = GyeokgukDeterminer.determine(
    pillars, strength, hapHwaEvaluations, config,
  );
  const formation: GyeokgukFormation | null = GyeokgukFormationAssessor.assess(
    gyeokgukRaw, pillars, strength,
  );
  const gyeokguk: GyeokgukResult = { ...gyeokgukRaw, formation };

  trace.push(buildGyeokgukTraceStep(gyeokguk));

  const yongshin: YongshinResult = YongshinDecider.decide(
    pillars, strength.isStrong, dmInfo.ohaeng, config, gyeokguk, hapHwaEvaluations,
  );

  trace.push(buildYongshinTraceStep(yongshin, config.yongshinPriority));

  const {
    shinsalHits,
    weightedShinsalHits,
    shinsalComposites,
    shinsalReferenceNote,
  } = analyzeShinsalBundle(pillars, config);

  detectAndTrace(trace, () => shinsalHits, shinsalHits =>
    buildShinsalTraceStep(shinsalHits, shinsalReferenceNote));

  trace.push(buildWeightedShinsalTraceStep(weightedShinsalHits));

  trace.push(buildShinsalCompositesTraceStep(shinsalComposites));

  const palace: Record<PillarPosition, PalaceAnalysis> = PalaceAnalyzer.analyze(
    pillars, dayMaster, input.gender,
  );

  trace.push(buildPalaceTraceStep(palace));

  const daeun: DaeunInfo = DaeunCalculator.calculate(
    pillars, input.gender,
    input.birthYear, input.birthMonth, input.birthDay,
    input.birthHour, input.birthMinute,
    opts.daeunCount,
  );

  const daeunReasoning: string[] = buildDaeunReasoning(
    input.gender,
    pillars.year.cheongan,
    daeun,
    yongshin,
    dmInfo.ohaeng,
  );

  trace.push(buildDaeunTraceStep(daeun, daeunReasoning));

  const saeunStartYear = opts.saeunStartYear ?? input.birthYear;
  const saeun: SaeunPillar[] = SaeunCalculator.calculate(saeunStartYear, opts.saeunYearCount);

  const saeunReasoning: string[] = buildSaeunReasoning(saeun, pillars, yongshin);

  trace.push(buildSaeunTraceStep(saeunStartYear, saeun, saeunReasoning));

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


