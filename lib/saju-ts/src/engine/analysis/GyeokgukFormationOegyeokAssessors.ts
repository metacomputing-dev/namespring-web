import { Ohaeng, OhaengRelations } from '../../domain/Ohaeng.js';
import {
  GyeokgukResult,
  GyeokgukType,
} from '../../domain/Gyeokguk.js';
import type { GyeokgukFormation } from '../../domain/Gyeokguk.js';
import type { FormationProfile } from './GyeokgukFormationProfile.js';
import {
  buildNotAssessedFormation,
  evaluateFormationRule,
  type FormationRuleSpec,
  hasElementInHidden,
  hasElementInStems,
  ohaengKorean,
} from './GyeokgukFormationShared.js';

function createHwagyeokSpec(
  hwashinElement: Ohaeng,
  patternName: string,
): FormationRuleSpec {
  const controllingElement = OhaengRelations.controlledBy(hwashinElement);
  const generatingElement = OhaengRelations.generatedBy(hwashinElement);
  const drainElement = OhaengRelations.generates(hwashinElement);

  const hwashinName = ohaengKorean(hwashinElement);
  const controllingName = ohaengKorean(controllingElement);
  const generatingName = ohaengKorean(generatingElement);
  const drainName = ohaengKorean(drainElement);

  const hasControllingElement = (p: FormationProfile): boolean =>
    hasElementInStems(p, controllingElement);

  return {
    patternName,
    formationCondition: `화신(${hwashinName})이 왕하고 극이 없음(化神旺無剋)`,
    breaking: [
      [hasControllingElement, `화신극파(化神剋破): ${controllingName}이(가) 투출하여 화신 ${hwashinName}을(를) 극함`],
      [(p) => hasElementInStems(p, drainElement) && !hasElementInStems(p, hwashinElement), `화신설기(化神洩氣): ${drainName}이(가) 화신의 기운을 설기하고 화신 자체의 보강이 부족`],
    ],
    rescue: [
      [(p) => hasControllingElement(p) && hasElementInStems(p, generatingElement), `${generatingName}이(가) 통관하여 화신 보호`],
    ],
    support: () => true,
  };
}

function createIlhaengSpec(
  dominantElement: Ohaeng,
  patternName: string,
): FormationRuleSpec {
  const controllingElement = OhaengRelations.controlledBy(dominantElement);
  const generatingElement = OhaengRelations.generatedBy(dominantElement);

  const dominantName = ohaengKorean(dominantElement);
  const controllingName = ohaengKorean(controllingElement);
  const generatingName = ohaengKorean(generatingElement);

  const hasControllingElement = (p: FormationProfile): boolean =>
    hasElementInStems(p, controllingElement);

  return {
    patternName,
    formationCondition: `${dominantName} 일행의 기가 순수(一行得氣純粹)`,
    breaking: [
      [hasControllingElement, `극기개입(剋氣介入): ${controllingName}이(가) 투출하여 ${dominantName}의 순수한 흐름을 깨뜨림`],
      [(p) => !hasControllingElement(p) && hasElementInHidden(p, controllingElement), `지장간 잠재(潛在) ${controllingName}: 운에서 투출 시 일행의 기가 깨질 위험`],
    ],
    rescue: [
      [(p) => hasControllingElement(p) && hasElementInStems(p, generatingElement), `${generatingName}이(가) 통관하여 ${dominantName} 보호`],
    ],
    support: () => true,
  };
}

const OEGYEOK_RULES: Readonly<Partial<Record<GyeokgukType, FormationRuleSpec>>> = {
  [GyeokgukType.JONGGANG]: {
    patternName: '종강격',
    formationCondition: '비겁+인성 장악, 재관 부재(比印從強)',
    breaking: [
      [(p) => p.hasJae, '재성 투출(財星透出): 비겁의 순수한 흐름을 재성이 분산시킴'],
      [(p) => p.hasGwan, '관성 투출(官星透出): 강한 비겁을 관성이 극하여 종의 흐름을 깨뜨림'],
      [(p) => p.hasSiksang && p.siksangCount >= 2, '식상 과다(食傷過多): 비겁의 기운이 식상으로 설기되어 종강의 순수성 감소'],
    ],
    rescue: [
      [(p) => p.hasJae && p.bigyeopCount >= 2, '비겁 과다로 재성을 제어(比劫制財)'],
      [(p) => p.hasGwan && p.hasInseong, '인성이 관살을 화해시켜 비겁 보호(印化官護比)'],
    ],
    support: (p) => p.hasBigyeop || p.hasInseong,
  },
  [GyeokgukType.JONGA]: {
    patternName: '종아격',
    formationCondition: '식상 지배, 인성 부재(食傷從兒)',
    breaking: [
      [(p) => p.hasInseong, '인성 투출(印星透出): 인성이 식상을 극하여 종아의 흐름을 깨뜨림(梟奪食)'],
      [(p) => p.hasBigyeop, '비겁 투출(比劫透出): 일간을 부조하여 \'종(從)\'의 전제가 무너짐'],
    ],
    rescue: [
      [(p) => p.hasInseong && p.hasJae, '재성이 인성을 제어하여 식상 보호(財制印護食)'],
    ],
    support: (p) => p.hasSiksang,
  },
  [GyeokgukType.JONGJAE]: {
    patternName: '종재격',
    formationCondition: '재성 지배, 비겁 부재(財星從財)',
    breaking: [
      [(p) => p.hasBigyeop, '비겁 투출(比劫透出): 비겁이 재성을 빼앗아 종재의 흐름을 깨뜨림(劫爭財)'],
      [(p) => p.hasInseong, '인성 투출(印星透出): 인성이 일간을 부조하여 \'종(從)\'의 전제가 무너짐'],
    ],
    rescue: [
      [(p) => p.hasBigyeop && p.hasGwan, '관성이 비겁을 제어하여 재성 보호(官制劫護財)'],
    ],
    support: (p) => p.hasJae,
  },
  [GyeokgukType.JONGSAL]: {
    patternName: '종살격',
    formationCondition: '관살 지배, 식상 부재(官殺從殺)',
    breaking: [
      [(p) => p.hasSiksang, '식상 투출(食傷透出): 식상이 관살을 제어하여 종살의 흐름을 깨뜨림(食制殺)'],
      [(p) => p.hasBigyeop, '비겁 투출(比劫透出): 일간을 부조하여 \'종(從)\'의 전제가 무너짐'],
    ],
    rescue: [
      [(p) => p.hasSiksang && p.hasInseong, '인성이 식상을 극하여 관살 보호(印制食護殺)'],
    ],
    support: (p) => p.hasGwan,
  },
  [GyeokgukType.JONGSE]: {
    patternName: '종세격',
    formationCondition: '식상/재/관 고른 분포, 비겁/인성 부재(從勢)',
    breaking: [
      [(p) => p.hasBigyeop, '비겁 투출(比劫透出): 대세를 거스르는 비겁이 종세의 흐름을 깨뜨림'],
      [(p) => p.hasInseong, '인성 투출(印星透出): 인성이 일간을 부조하여 \'종(從)\'의 전제가 무너짐'],
    ],
    support: () => true,
  },
  [GyeokgukType.HAPWHA_EARTH]: createHwagyeokSpec(Ohaeng.EARTH, '합화토격'),
  [GyeokgukType.HAPWHA_METAL]: createHwagyeokSpec(Ohaeng.METAL, '합화금격'),
  [GyeokgukType.HAPWHA_WATER]: createHwagyeokSpec(Ohaeng.WATER, '합화수격'),
  [GyeokgukType.HAPWHA_WOOD]: createHwagyeokSpec(Ohaeng.WOOD, '합화목격'),
  [GyeokgukType.HAPWHA_FIRE]: createHwagyeokSpec(Ohaeng.FIRE, '합화화격'),
  [GyeokgukType.GOKJIK]: createIlhaengSpec(Ohaeng.WOOD, '곡직격'),
  [GyeokgukType.YEOMSANG]: createIlhaengSpec(Ohaeng.FIRE, '염상격'),
  [GyeokgukType.GASAEK]: createIlhaengSpec(Ohaeng.EARTH, '가색격'),
  [GyeokgukType.JONGHYEOK]: createIlhaengSpec(Ohaeng.METAL, '종혁격'),
  [GyeokgukType.YUNHA]: createIlhaengSpec(Ohaeng.WATER, '윤하격'),
};

export function assessOegyeok(
  gyeokguk: GyeokgukResult,
  profile: FormationProfile,
): GyeokgukFormation {
  const spec = OEGYEOK_RULES[gyeokguk.type];
  return spec
    ? evaluateFormationRule(profile, spec)
    : buildNotAssessedFormation('미지원 격국 유형.');
}
