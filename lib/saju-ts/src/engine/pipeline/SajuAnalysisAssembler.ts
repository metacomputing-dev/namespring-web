import { type AnalysisResultKey, type SajuAnalysis, ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { type SaeunPillar } from '../../domain/SaeunInfo.js';
import { type Ohaeng } from '../../domain/Ohaeng.js';
import { type PillarPosition } from '../../domain/PillarPosition.js';
import {
  type CheonganRelationHit,
  type HapHwaEvaluation,
  type JijiRelationHit,
  type ResolvedRelation,
  type ScoredCheonganRelation,
} from '../../domain/Relations.js';
import { type StrengthResult } from '../../domain/StrengthResult.js';
import { type GyeokgukResult } from '../../domain/Gyeokguk.js';
import { type YongshinResult } from '../../domain/YongshinResult.js';
import { type ShinsalHit } from '../../domain/Shinsal.js';
import { type DaeunInfo } from '../../domain/DaeunInfo.js';
import { type PalaceAnalysis } from '../../domain/Palace.js';
import { type TenGodAnalysis } from '../../domain/TenGodAnalysis.js';
import { type SibiUnseong } from '../../domain/SibiUnseong.js';
import { type AnalysisTraceStep } from '../../domain/types.js';
import { type SajuPillarResult } from '../SajuCalculator.js';
import { type WeightedShinsalHit, type ShinsalComposite } from '../analysis/ShinsalWeightModel.js';
import { type GongmangResult } from '../analysis/GongmangCalculator.js';

export interface FinalAnalysisContext {
  coreResult: SajuPillarResult;
  rawJijiRelations: JijiRelationHit[];
  cheonganRelations: CheonganRelationHit[];
  hapHwaEvaluations: HapHwaEvaluation[];
  resolvedJijiRelations: ResolvedRelation[];
  scoredCheonganRelations: ScoredCheonganRelation[];
  sibiUnseong: Map<PillarPosition, SibiUnseong>;
  gongmang: GongmangResult;
  strength: StrengthResult;
  yongshin: YongshinResult;
  gyeokguk: GyeokgukResult;
  shinsalHits: ShinsalHit[];
  weightedShinsalHits: WeightedShinsalHit[];
  shinsalComposites: ShinsalComposite[];
  palace: Record<PillarPosition, PalaceAnalysis>;
  daeun: DaeunInfo;
  saeun: SaeunPillar[];
  ohaengDistribution: Map<Ohaeng, number>;
  trace: AnalysisTraceStep[];
  tenGodAnalysis: TenGodAnalysis;
}

type AnalysisResultMapper = readonly [AnalysisResultKey, (context: FinalAnalysisContext) => unknown];

const ANALYSIS_RESULT_MAPPERS: readonly AnalysisResultMapper[] = [
  [ANALYSIS_KEYS.STRENGTH, (context) => context.strength],
  [ANALYSIS_KEYS.YONGSHIN, (context) => context.yongshin],
  [ANALYSIS_KEYS.GYEOKGUK, (context) => context.gyeokguk],
  [ANALYSIS_KEYS.HAPWHA, (context) => context.hapHwaEvaluations],
  [ANALYSIS_KEYS.SIBI_UNSEONG, (context) => context.sibiUnseong],
  [ANALYSIS_KEYS.GONGMANG, (context) => context.gongmang],
  [ANALYSIS_KEYS.SHINSAL, (context) => context.shinsalHits],
  [ANALYSIS_KEYS.WEIGHTED_SHINSAL, (context) => context.weightedShinsalHits],
  [ANALYSIS_KEYS.SHINSAL_COMPOSITES, (context) => context.shinsalComposites],
  [ANALYSIS_KEYS.PALACE, (context) => context.palace],
  [ANALYSIS_KEYS.DAEUN, (context) => context.daeun],
  [ANALYSIS_KEYS.SAEUN, (context) => context.saeun],
  [ANALYSIS_KEYS.CHEONGAN_RELATIONS, (context) => context.cheonganRelations],
  [ANALYSIS_KEYS.RESOLVED_JIJI, (context) => context.resolvedJijiRelations],
  [ANALYSIS_KEYS.SCORED_CHEONGAN, (context) => context.scoredCheonganRelations],
  [ANALYSIS_KEYS.TRACE, (context) => context.trace],
  [ANALYSIS_KEYS.OHAENG_DISTRIBUTION, (context) => context.ohaengDistribution],
  [ANALYSIS_KEYS.TEN_GODS, (context) => context.tenGodAnalysis],
];

export function buildAnalysisResults(context: FinalAnalysisContext): Map<string, unknown> {
  return new Map<string, unknown>(
    ANALYSIS_RESULT_MAPPERS.map(([key, valueSelector]) => [key, valueSelector(context)]),
  );
}

export function buildSajuAnalysis(context: FinalAnalysisContext): SajuAnalysis {
  const analysisResults = buildAnalysisResults(context);
  return {
    coreResult: context.coreResult,
    cheonganRelations: context.cheonganRelations,
    hapHwaEvaluations: context.hapHwaEvaluations,
    resolvedJijiRelations: context.resolvedJijiRelations,
    scoredCheonganRelations: context.scoredCheonganRelations,
    sibiUnseong: context.sibiUnseong,
    gongmangVoidBranches: context.gongmang.voidBranches,
    strengthResult: context.strength,
    yongshinResult: context.yongshin,
    gyeokgukResult: context.gyeokguk,
    shinsalHits: context.shinsalHits,
    weightedShinsalHits: context.weightedShinsalHits,
    shinsalComposites: context.shinsalComposites,
    palaceAnalysis: context.palace,
    daeunInfo: context.daeun,
    saeunPillars: context.saeun,
    ohaengDistribution: context.ohaengDistribution,
    trace: context.trace,
    tenGodAnalysis: context.tenGodAnalysis,
    analysisResults,
    pillars: context.coreResult.pillars,
    input: context.coreResult.input,
    jijiRelations: context.rawJijiRelations,
  };
}

