import { Cheongan } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import { PillarSet } from '../../domain/PillarSet.js';
import {
  CheonganRelationHit,
  CheonganRelationType,
  HapHwaEvaluation,
  HapState,
  HAP_STATE_INFO,
  InteractionOutcome,
  InteractionScore,
  JijiRelationHit,
  JijiRelationType,
  ResolvedRelation,
  ScoredCheonganRelation,
} from '../../domain/Relations.js';
import { anyPairAdjacent } from './RelationInteractionResolverUtils.js';
import { interactionOutcomeKorean, relationTypeKorean } from './RelationInteractionLabels.js';


export function scoreJijiRelation(
  resolved: ResolvedRelation,
  branchPositions: ReadonlyMap<Jiji, readonly number[]>,
): InteractionScore {
  const hit = resolved.hit;
  const baseScore = baseScoreFor(hit.type, hit.note);

  const adjBonus = hasAdjacentMembers(hit.members, branchPositions) ? ADJACENCY_BONUS : 0;
  const multiplier = OUTCOME_MULTIPLIERS.get(resolved.outcome) ?? 1.0;
  const raw = Math.min(100, baseScore + adjBonus);
  const finalScore = Math.max(0, Math.min(100, Math.trunc(raw * multiplier)));

  return {
    baseScore,
    adjacencyBonus: adjBonus,
    outcomeMultiplier: multiplier,
    finalScore,
    rationale: buildJijiRationale(hit, baseScore, adjBonus, multiplier, finalScore, resolved.outcome),
  };
}

export function scoreAllJijiRelations(
  resolvedRelations: readonly ResolvedRelation[],
  branchPositions: ReadonlyMap<Jiji, readonly number[]>,
): ResolvedRelation[] {
  return resolvedRelations.map((resolved) => ({
    ...resolved,
    score: scoreJijiRelation(resolved, branchPositions),
  }));
}

export const JijiRelationScorer = {
  score: scoreJijiRelation,
  scoreAll: scoreAllJijiRelations,
  baseScoreFor,
} as const;


const BASE_SCORES: ReadonlyMap<JijiRelationType, number> = new Map([
  [JijiRelationType.BANGHAP, 100],
  [JijiRelationType.SAMHAP, 95],
  [JijiRelationType.CHUNG, 70],
  [JijiRelationType.YUKHAP, 60],
  [JijiRelationType.HYEONG, 55],
  [JijiRelationType.BANHAP, 40],
  [JijiRelationType.HAE, 40],
  [JijiRelationType.PA, 35],
  [JijiRelationType.WONJIN, 25],
]);

const BANHAP_SAENGWANG_SCORE = 45;
const BANHAP_WANGGO_SCORE = 40;
const BANHAP_SAENGGO_SCORE = 35;

const ADJACENCY_BONUS = 10;

const OUTCOME_MULTIPLIERS: ReadonlyMap<InteractionOutcome, number> = new Map([
  [InteractionOutcome.ACTIVE, 1.0],
  [InteractionOutcome.STRENGTHENED, 1.3],
  [InteractionOutcome.WEAKENED, 0.5],
  [InteractionOutcome.BROKEN, 0.0],
]);


function baseScoreFor(type: JijiRelationType, note: string): number {
  if (type === JijiRelationType.BANHAP) {
    if (note.includes('생왕반합')) return BANHAP_SAENGWANG_SCORE;
    if (note.includes('왕고반합')) return BANHAP_WANGGO_SCORE;
    if (note.includes('생고반합')) return BANHAP_SAENGGO_SCORE;
    return BASE_SCORES.get(JijiRelationType.BANHAP)!;
  }
  return BASE_SCORES.get(type)!;
}

function hasAdjacentMembers(
  members: ReadonlySet<Jiji>,
  branchPositions: ReadonlyMap<Jiji, readonly number[]>,
): boolean {
  return anyPairAdjacent(members, members, branchPositions);
}

function buildJijiRationale(
  hit: JijiRelationHit,
  baseScore: number,
  adjBonus: number,
  multiplier: number,
  finalScore: number,
  outcome: InteractionOutcome,
): string {
  const typeKr = relationTypeKorean(hit.type);
  let s = `${hit.note}(${typeKr}): 기본점수 ${baseScore}점`;
  if (adjBonus > 0) s += ` + 인접보너스 ${adjBonus}점`;
  if (multiplier !== 1.0) {
    const outcomeKr = interactionOutcomeKorean(outcome);
    s += ` \u00D7 ${outcomeKr}배율(${multiplier})`;
  }
  s += ` = 최종 ${finalScore}점`;
  return s;
}


export function scoreCheonganRelation(
  hit: CheonganRelationHit,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
  pillars: PillarSet,
): ScoredCheonganRelation {
  const matchingEval = hit.type === CheonganRelationType.HAP
    ? hapHwaEvaluations.find((eval_) => {
        const evalSet = new Set([eval_.stem1, eval_.stem2]);
        return setsEqual(evalSet, hit.members);
      }) ?? null
    : null;

  let baseScore: number;
  if (hit.type === CheonganRelationType.HAP) {
    switch (matchingEval?.state) {
      case HapState.HAPWHA:          baseScore = HAP_HAPWHA_SCORE; break;
      case HapState.HAPGEO:          baseScore = HAP_HAPGEO_SCORE; break;
      case HapState.NOT_ESTABLISHED: baseScore = HAP_NOT_ESTABLISHED_SCORE; break;
      default:                       baseScore = HAP_DEFAULT_SCORE; break;
    }
  } else {
    baseScore = CHUNG_SCORE;
  }

  const adjBonus = hasStemAdjacency(hit.members, pillars) ? CG_ADJACENCY_BONUS : 0;
  const finalScore = Math.min(100, baseScore + adjBonus);

  return {
    hit,
    hapHwaEvaluation: matchingEval,
    score: {
      baseScore,
      adjacencyBonus: adjBonus,
      outcomeMultiplier: 1.0, // 천간 관계에는 상호작용 배율 없음
      finalScore,
      rationale: buildCheonganRationale(hit, matchingEval, baseScore, adjBonus, finalScore),
    },
  };
}

export function scoreAllCheonganRelations(
  hits: readonly CheonganRelationHit[],
  hapHwaEvaluations: readonly HapHwaEvaluation[],
  pillars: PillarSet,
): ScoredCheonganRelation[] {
  return hits.map((hit) => scoreCheonganRelation(hit, hapHwaEvaluations, pillars));
}

export const CheonganRelationScorer = {
  score: scoreCheonganRelation,
  scoreAll: scoreAllCheonganRelations,
} as const;


const HAP_HAPWHA_SCORE = 90;
const HAP_HAPGEO_SCORE = 70;
const HAP_NOT_ESTABLISHED_SCORE = 30;
const HAP_DEFAULT_SCORE = 50;
const CHUNG_SCORE = 65;
const CG_ADJACENCY_BONUS = 10;


function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function hasStemAdjacency(members: ReadonlySet<Cheongan>, pillars: PillarSet): boolean {
  const memberList = [...members];
  if (memberList.length < 2) return false;

  const allStems = [
    pillars.year.cheongan,
    pillars.month.cheongan,
    pillars.day.cheongan,
    pillars.hour.cheongan,
  ] as const;

  const positions0 = findStemPositions(allStems, memberList[0]!);
  const positions1 = findStemPositions(allStems, memberList[1]!);
  return positions0.some(position0 => positions1.some(position1 => Math.abs(position0 - position1) === 1));
}

function findStemPositions(stems: readonly Cheongan[], targetStem: Cheongan): number[] {
  return stems
    .map((stem, index) => stem === targetStem ? index : -1)
    .filter((index) => index >= 0);
}

function buildCheonganRationale(
  hit: CheonganRelationHit,
  eval_: HapHwaEvaluation | null,
  baseScore: number,
  adjBonus: number,
  finalScore: number,
): string {
  const typeKr = hit.type === CheonganRelationType.HAP ? '천간합' : '천간충';
  let s = `${hit.note}(${typeKr}): 기본점수 ${baseScore}점`;
  if (eval_ != null) {
    const stateKr = HAP_STATE_INFO[eval_.state].koreanName;
    s += `(${stateKr})`;
  }
  if (adjBonus > 0) s += ` + 인접보너스 ${adjBonus}점`;
  s += ` = 최종 ${finalScore}점`;
  return s;
}

