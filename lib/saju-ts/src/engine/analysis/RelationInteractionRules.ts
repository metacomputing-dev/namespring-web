import { Jiji } from '../../domain/Jiji.js';
import {
  InteractionOutcome,
  JijiRelationHit,
  JijiRelationType,
} from '../../domain/Relations.js';
import {
  anyPairAdjacent,
  containsAll,
  setDifference,
  setIntersection,
} from './RelationInteractionResolverUtils.js';
import { relationTypeKorean } from './RelationInteractionLabels.js';


interface InteractionResult {
  readonly outcomeForTarget: InteractionOutcome;
  readonly reason: string;
}

type RuleType = JijiRelationType | 'HAP';

interface StaticInteractionRule {
  readonly targetType: RuleType;
  readonly otherType: RuleType;
  readonly outcome: InteractionOutcome;
  readonly minSharedMembers?: number;
  readonly reason: (target: JijiRelationHit, other: JijiRelationHit) => string;
}

const HAP_TYPES: ReadonlySet<JijiRelationType> = new Set([
  JijiRelationType.YUKHAP,
  JijiRelationType.SAMHAP,
  JijiRelationType.BANGHAP,
  JijiRelationType.BANHAP,
]);

function isHap(type: JijiRelationType): boolean {
  return HAP_TYPES.has(type);
}

function sharedMemberCount(a: ReadonlySet<Jiji>, b: ReadonlySet<Jiji>): number {
  return setIntersection(a, b).size;
}

function interaction(outcomeForTarget: InteractionOutcome, reason: string): InteractionResult {
  return { outcomeForTarget, reason };
}

function matchesRuleType(ruleType: RuleType, actualType: JijiRelationType): boolean {
  return ruleType === 'HAP' ? isHap(actualType) : ruleType === actualType;
}

function rule(
  targetType: RuleType,
  otherType: RuleType,
  outcome: InteractionOutcome,
  reason: (target: JijiRelationHit, other: JijiRelationHit) => string,
  minSharedMembers?: number,
): StaticInteractionRule {
  return { targetType, otherType, outcome, reason, minSharedMembers };
}

const STATIC_INTERACTION_RULES: readonly StaticInteractionRule[] = [
  rule('HAP', JijiRelationType.HYEONG, InteractionOutcome.ACTIVE, (target, other) => `${other.note}(형)은 ${target.note}(합)과 공존하여 합의 효력에 영향을 주지 않습니다.`),
  rule(JijiRelationType.HYEONG, 'HAP', InteractionOutcome.ACTIVE, (target, other) => `${target.note}(형)은 ${other.note}(합)에도 불구하고 해소되지 않고 유지됩니다.`),
  rule(JijiRelationType.HYEONG, JijiRelationType.CHUNG, InteractionOutcome.STRENGTHENED, (target, other) => `${other.note}(충)이 ${target.note}(형)과 같은 지지에서 작용하여 형의 파괴력이 강화됩니다.`, 2),
  rule(JijiRelationType.CHUNG, JijiRelationType.HYEONG, InteractionOutcome.ACTIVE, (target, other) => `${target.note}(충)은 ${other.note}(형)과 같은 지지에서 공존하여 각각의 작용이 유지됩니다.`, 2),
  rule(JijiRelationType.CHUNG, JijiRelationType.SAMHAP, InteractionOutcome.WEAKENED, (target, other) => `${other.note}(삼합)이 완성되어 ${target.note}(충)의 작용이 약화됩니다.`),
  rule(JijiRelationType.SAMHAP, JijiRelationType.CHUNG, InteractionOutcome.ACTIVE, (target, other) => `${target.note}(삼합)은 ${other.note}(충)보다 우선하여 합의 효력이 유지됩니다.`),
  rule(JijiRelationType.BANGHAP, JijiRelationType.CHUNG, InteractionOutcome.ACTIVE, (target, other) => `${target.note}(방합)은 ${other.note}(충)보다 우선하여 합의 효력이 유지됩니다.`),
  rule(JijiRelationType.CHUNG, JijiRelationType.BANGHAP, InteractionOutcome.WEAKENED, (target, other) => `${other.note}(방합)이 성립하여 ${target.note}(충)의 작용이 약화됩니다.`),
  rule(JijiRelationType.BANHAP, JijiRelationType.CHUNG, InteractionOutcome.BROKEN, (target, other) => `${other.note}(충)이 ${target.note}(반합)을 파합(破合)시킵니다.`),
  rule(JijiRelationType.CHUNG, JijiRelationType.BANHAP, InteractionOutcome.WEAKENED, (target, other) => `${other.note}(반합)이 부분적으로 결합하여 ${target.note}(충)의 작용이 약화됩니다.`),
  rule(JijiRelationType.YUKHAP, JijiRelationType.HAE, InteractionOutcome.WEAKENED, (target, other) => `${other.note}(해)가 ${target.note}(육합)의 합력을 약화시킵니다(육해 관계).`),
  rule(JijiRelationType.HAE, JijiRelationType.YUKHAP, InteractionOutcome.ACTIVE, (target, other) => `${target.note}(해)는 ${other.note}(육합)을 해치는 관계로 작용이 유지됩니다.`),
  rule('HAP', JijiRelationType.PA, InteractionOutcome.WEAKENED, (target, other) => `${other.note}(파)가 ${target.note}(${relationTypeKorean(target.type)})과 동일한 지지에서 작용하여 합이 약화됩니다.`, 2),
  rule(JijiRelationType.PA, 'HAP', InteractionOutcome.ACTIVE, (target, other) => `${target.note}(파)가 ${other.note}(${relationTypeKorean(other.type)})을 직접 파하여 작용이 유지됩니다.`, 2),
];

function applyStaticInteractionRule(
  target: JijiRelationHit,
  other: JijiRelationHit,
): InteractionResult | null {
  for (const rule of STATIC_INTERACTION_RULES) {
    if (!matchesRuleType(rule.targetType, target.type)) continue;
    if (!matchesRuleType(rule.otherType, other.type)) continue;
    if (rule.minSharedMembers != null && sharedMemberCount(target.members, other.members) < rule.minSharedMembers) {
      continue;
    }
    return interaction(rule.outcome, rule.reason(target, other));
  }
  return null;
}

export function evaluateInteraction(
  target: JijiRelationHit,
  other: JijiRelationHit,
  branchPositions: ReadonlyMap<Jiji, readonly number[]>,
  priorityOf: (type: JijiRelationType) => number,
): InteractionResult | null {
  const tType = target.type;
  const oType = other.type;

  if (tType === JijiRelationType.YUKHAP && oType === JijiRelationType.CHUNG) {
    return resolveYukhapVsChung(target, other, branchPositions);
  }
  if (tType === JijiRelationType.CHUNG && oType === JijiRelationType.YUKHAP) {
    return resolveChungVsYukhap(target, other, branchPositions);
  }

  const staticRuleResult = applyStaticInteractionRule(target, other);
  if (staticRuleResult) return staticRuleResult;

  if (tType === JijiRelationType.HYEONG && oType === JijiRelationType.HYEONG) {
    if (target.members.size === 2 && other.members.size === 3 &&
        containsAll(other.members, target.members)) {
      return interaction(
        InteractionOutcome.STRENGTHENED,
        `${other.note}(삼형)이 완성되어 ${target.note}(형)의 형살이 강화됩니다.`,
      );
    }
  }

  const tPrio = priorityOf(tType);
  const oPrio = priorityOf(oType);

  if (tPrio > oPrio) {
    return interaction(
      InteractionOutcome.WEAKENED,
      `${other.note}(${relationTypeKorean(oType)})이(가) 우선하여 ${target.note}(${relationTypeKorean(tType)})의 작용이 약화됩니다.`,
    );
  }

  return null;
}


function resolveYukhapVsChung(
  yukhap: JijiRelationHit,
  chung: JijiRelationHit,
  branchPositions: ReadonlyMap<Jiji, readonly number[]>,
): InteractionResult {
  const shared = setIntersection(yukhap.members, chung.members);
  const chungOnly = setDifference(chung.members, yukhap.members);

  if (chungOnly.size > 0 && shared.size > 0) {
    const adjacent = anyPairAdjacent(chungOnly, shared, branchPositions);
    return adjacent
      ? {
          outcomeForTarget: InteractionOutcome.BROKEN,
          reason: `${chung.note}(충)이 인접 기둥에서 작용하여 ${yukhap.note}(육합)이 파합(破合)됩니다.`,
        }
      : {
          outcomeForTarget: InteractionOutcome.WEAKENED,
          reason: `${chung.note}(충)이 원거리에서 작용하여 ${yukhap.note}(육합)이 약화됩니다.`,
        };
  }

  return {
    outcomeForTarget: InteractionOutcome.WEAKENED,
    reason: `${chung.note}(충)의 영향으로 ${yukhap.note}(육합)이 약화됩니다.`,
  };
}

function resolveChungVsYukhap(
  chung: JijiRelationHit,
  yukhap: JijiRelationHit,
  branchPositions: ReadonlyMap<Jiji, readonly number[]>,
): InteractionResult {
  const shared = setIntersection(chung.members, yukhap.members);
  const hapOnly = setDifference(yukhap.members, chung.members);

  if (hapOnly.size > 0 && shared.size > 0) {
    const adjacent = anyPairAdjacent(hapOnly, shared, branchPositions);
    return adjacent
      ? {
          outcomeForTarget: InteractionOutcome.WEAKENED,
          reason: `${yukhap.note}(육합)이 인접하여 ${chung.note}(충)의 작용을 약화시킵니다(합해충).`,
        }
      : {
          outcomeForTarget: InteractionOutcome.WEAKENED,
          reason: `${yukhap.note}(육합)의 영향으로 ${chung.note}(충)의 작용이 약화됩니다(합해충).`,
        };
  }

  return {
    outcomeForTarget: InteractionOutcome.WEAKENED,
    reason: `${yukhap.note}(육합)의 영향으로 ${chung.note}(충)의 작용이 약화됩니다(합해충).`,
  };
}

