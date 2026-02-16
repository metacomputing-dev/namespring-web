import { InteractionOutcome, JijiRelationType } from '../../domain/Relations.js';

const JIJI_RELATION_TYPE_KOREAN: Readonly<Record<JijiRelationType, string>> = {
  [JijiRelationType.SAMHAP]: '삼합',
  [JijiRelationType.BANGHAP]: '방합',
  [JijiRelationType.YUKHAP]: '육합',
  [JijiRelationType.BANHAP]: '반합',
  [JijiRelationType.CHUNG]: '충',
  [JijiRelationType.HYEONG]: '형',
  [JijiRelationType.PA]: '파',
  [JijiRelationType.HAE]: '해',
  [JijiRelationType.WONJIN]: '원진',
};

const INTERACTION_OUTCOME_KOREAN: Readonly<Record<InteractionOutcome, string>> = {
  [InteractionOutcome.ACTIVE]: '정상',
  [InteractionOutcome.STRENGTHENED]: '강화',
  [InteractionOutcome.WEAKENED]: '약화',
  [InteractionOutcome.BROKEN]: '해소',
};

export function relationTypeKorean(type: JijiRelationType): string {
  return JIJI_RELATION_TYPE_KOREAN[type];
}

export function interactionOutcomeKorean(outcome: InteractionOutcome): string {
  return INTERACTION_OUTCOME_KOREAN[outcome];
}
