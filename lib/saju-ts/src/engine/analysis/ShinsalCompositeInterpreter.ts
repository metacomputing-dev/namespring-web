import { ShinsalHit, ShinsalType } from '../../domain/Shinsal.js';
import {
  CompositeInteractionType,
  ShinsalComposite,
} from './ShinsalWeightModel.js';



const PROXIMITY_BONUS = 5;


interface CompositeRule {
  readonly type1: ShinsalType;
  readonly type2: ShinsalType;
  readonly patternName: string;
  readonly interactionType: CompositeInteractionType;
  readonly interpretation: string;
  readonly baseBonusScore: number;
}


export const COMPOSITE_RULES: readonly CompositeRule[] = [
  {
    type1: ShinsalType.YEOKMA,
    type2: ShinsalType.DOHWA,
    patternName: '역마+도화',
    interactionType: CompositeInteractionType.SYNERGY,
    interpretation: '해외 이성 인연, 여행지 로맨스. 이동이 잦은 환경에서 매력이 빛나며, 외국인이나 먼 곳의 인연과 깊은 관계를 맺을 수 있습니다.',
    baseBonusScore: 15,
  },
  {
    type1: ShinsalType.DOHWA,
    type2: ShinsalType.HWAGAE,
    patternName: '도화+화개',
    interactionType: CompositeInteractionType.SYNERGY,
    interpretation: '예술적 매력, 연예/창작 재능. 타고난 매력에 학문적 깊이가 더해져 예술이나 창작 분야에서 두각을 나타냅니다.',
    baseBonusScore: 15,
  },
  {
    type1: ShinsalType.YEOKMA,
    type2: ShinsalType.GOEGANG,
    patternName: '역마+괴강',
    interactionType: CompositeInteractionType.SYNERGY,
    interpretation: '해외 진출, 사업가 기질. 강한 주관과 이동성이 결합되어 해외 사업이나 무역에서 성공할 기질을 갖추고 있습니다.',
    baseBonusScore: 10,
  },
  {
    type1: ShinsalType.YANGIN,
    type2: ShinsalType.CHEONUL_GWIIN,
    patternName: '양인+천을귀인',
    interactionType: CompositeInteractionType.TEMPER,
    interpretation: '절제된 결단력, 위기의 리더. 양인의 날카로운 결단력이 천을귀인의 덕성에 의해 다듬어져, 위기 상황에서 빛나는 리더십을 발휘합니다.',
    baseBonusScore: 10,
  },
  {
    type1: ShinsalType.YEOKMA,
    type2: ShinsalType.CHEONUL_GWIIN,
    patternName: '역마+천을귀인',
    interactionType: CompositeInteractionType.SYNERGY,
    interpretation: '보호받는 이동, 해외 귀인. 이동과 변화가 많지만 귀인의 도움으로 안전하게 성공을 이룹니다. 해외에서 좋은 조력자를 만날 수 있습니다.',
    baseBonusScore: 10,
  },
  {
    type1: ShinsalType.GOSIN,
    type2: ShinsalType.GWASUK,
    patternName: '고신+과숙',
    interactionType: CompositeInteractionType.AMPLIFY,
    interpretation: '이중 고독, 독립적 삶의 강화. 고신과 과숙이 함께하면 독립심이 매우 강해지며, 스스로의 길을 개척하는 성향이 두드러집니다.',
    baseBonusScore: 5,
  },
  {
    type1: ShinsalType.YEOKMA,
    type2: ShinsalType.GEOPSAL,
    patternName: '역마+겁살',
    interactionType: CompositeInteractionType.AMPLIFY_NEGATIVE,
    interpretation: '이동 중 사고/손실 주의. 이동이 잦은 상황에서 예기치 않은 손실이나 사고에 주의해야 합니다. 여행 보험과 안전에 각별한 관심이 필요합니다.',
    baseBonusScore: -10,
  },
  {
    type1: ShinsalType.DOHWA,
    type2: ShinsalType.HONGYEOM,
    patternName: '도화+홍염',
    interactionType: CompositeInteractionType.AMPLIFY,
    interpretation: '강한 이성 매력, 연애 과다 주의. 타고난 매력이 극대화되어 이성의 관심을 끌지만, 감정 관리에 주의가 필요합니다.',
    baseBonusScore: 5,
  },
  {
    type1: ShinsalType.CHEONUL_GWIIN,
    type2: ShinsalType.HAKDANG,
    patternName: '천을귀인+학당',
    interactionType: CompositeInteractionType.SYNERGY,
    interpretation: '학업의 귀인, 스승 복. 학문의 재능에 귀인의 도움이 더해져, 좋은 스승을 만나 크게 성장할 수 있습니다.',
    baseBonusScore: 10,
  },
  {
    type1: ShinsalType.HWAGAE,
    type2: ShinsalType.MUNCHANG,
    patternName: '화개+문창',
    interactionType: CompositeInteractionType.SYNERGY,
    interpretation: '학문적 성취, 종교/철학 심화. 화개의 영적 깊이와 문창의 학업 재능이 만나, 학술이나 종교/철학 분야에서 깊은 성취를 이룹니다.',
    baseBonusScore: 10,
  },
  {
    type1: ShinsalType.YANGIN,
    type2: ShinsalType.BAEKHO,
    patternName: '양인+백호',
    interactionType: CompositeInteractionType.AMPLIFY_NEGATIVE,
    interpretation: '수술/사고 위험 강화. 양인의 예리함과 백호의 사고 기운이 겹쳐 신체적 위험에 주의가 필요합니다. 정기 건강검진을 권합니다.',
    baseBonusScore: -10,
  },
  {
    type1: ShinsalType.CHEONDEOK_GWIIN,
    type2: ShinsalType.WOLDEOK_GWIIN,
    patternName: '천덕귀인+월덕귀인',
    interactionType: CompositeInteractionType.AMPLIFY,
    interpretation: '이중 해액 방어, 큰 복덕. 천덕과 월덕이 함께하면 재앙을 크게 물리치고, 위기 상황에서도 안전하게 벗어나는 큰 복을 가지고 있습니다.',
    baseBonusScore: 20,
  },
  {
    type1: ShinsalType.WONJIN,
    type2: ShinsalType.DOHWA,
    patternName: '원진+도화',
    interactionType: CompositeInteractionType.TRANSFORM,
    interpretation: '애증의 인연, 끌리면서도 갈등. 강한 매력과 내면의 불화가 공존하여, 인연에서 깊은 감정의 양면성을 경험합니다.',
    baseBonusScore: 5,
  },
] as const;


function hasSamePillarHits(
  hits1: readonly ShinsalHit[],
  hits2: readonly ShinsalHit[],
): boolean {
  const positions1 = new Set(hits1.map((h) => h.position));
  return hits2.some((h) => positions1.has(h.position));
}


export const ShinsalCompositeInterpreter = {
    detect(hits: readonly ShinsalHit[]): ShinsalComposite[] {
    if (hits.length < 2) return [];

    const typeToHits = new Map<ShinsalType, ShinsalHit[]>();
    for (const hit of hits) {
      let group = typeToHits.get(hit.type);
      if (!group) {
        group = [];
        typeToHits.set(hit.type, group);
      }
      group.push(hit);
    }

    const composites: ShinsalComposite[] = [];

    for (const rule of COMPOSITE_RULES) {
      const hits1 = typeToHits.get(rule.type1);
      if (!hits1) continue;
      const hits2 = typeToHits.get(rule.type2);
      if (!hits2) continue;

      const involvedHits = [...hits1, ...hits2];

      const samePillarBonus = hasSamePillarHits(hits1, hits2) ? PROXIMITY_BONUS : 0;
      const totalBonus = rule.baseBonusScore + samePillarBonus;

      composites.push({
        patternName: rule.patternName,
        interactionType: rule.interactionType,
        involvedHits,
        interpretation: rule.interpretation,
        bonusScore: totalBonus,
      });
    }

    return composites;
  },
} as const;

