import type { CheonganRelationHit, HapHwaEvaluation, JijiRelationHit, ResolvedRelation, ScoredCheonganRelation } from '../../domain/Relations.js';
import { JijiRelationType } from '../../domain/Relations.js';
import type { PillarSet } from '../../domain/PillarSet.js';
import { DefaultRelationAnalyzer } from '../analysis/DefaultRelationAnalyzer.js';
import { RelationInteractionResolver } from '../analysis/RelationInteractionResolver.js';
import { JijiRelationScorer, CheonganRelationScorer } from '../analysis/InteractionScoreModel.js';

const DEFAULT_RELATION_ANALYZER = new DefaultRelationAnalyzer();

export interface RelationAnalysisBundle {
  readonly rawJijiRelations: JijiRelationHit[];
  readonly resolvedJijiRelations: ResolvedRelation[];
  readonly scoredCheonganRelations: ScoredCheonganRelation[];
}

export function analyzeRelationsBundle(
  pillars: PillarSet,
  cheonganRelations: CheonganRelationHit[],
  hapHwaEvaluations: HapHwaEvaluation[],
  allowBanhap: boolean,
): RelationAnalysisBundle {
  const rawJijiRelations = DEFAULT_RELATION_ANALYZER.analyze(pillars);
  const resolvedJijiRelations = resolveAndScoreJijiRelations(pillars, rawJijiRelations, allowBanhap);
  const scoredCheonganRelations = scoreCheonganRelations(pillars, cheonganRelations, hapHwaEvaluations);

  return {
    rawJijiRelations,
    resolvedJijiRelations,
    scoredCheonganRelations,
  };
}

function resolveAndScoreJijiRelations(
  pillars: PillarSet,
  rawJijiRelations: readonly JijiRelationHit[],
  allowBanhap: boolean,
): ResolvedRelation[] {
  const branchPositions = RelationInteractionResolver.buildBranchPositionMap(pillars);
  const jijiHitsForResolution = filterBanhapIfDisabled(rawJijiRelations, allowBanhap);
  const resolvedRaw = RelationInteractionResolver.resolve(jijiHitsForResolution, pillars);
  return JijiRelationScorer.scoreAll(resolvedRaw, branchPositions);
}

function scoreCheonganRelations(
  pillars: PillarSet,
  cheonganRelations: readonly CheonganRelationHit[],
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): ScoredCheonganRelation[] {
  return CheonganRelationScorer.scoreAll(cheonganRelations, hapHwaEvaluations, pillars);
}

function filterBanhapIfDisabled(
  hits: readonly JijiRelationHit[],
  allowBanhap: boolean,
): JijiRelationHit[] {
  return allowBanhap
    ? [...hits]
    : hits.filter((hit) => hit.type !== JijiRelationType.BANHAP);
}

