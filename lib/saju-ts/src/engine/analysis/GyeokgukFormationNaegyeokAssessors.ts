import { GyeokgukType } from '../../domain/Gyeokguk.js';
import type { GyeokgukFormation } from '../../domain/Gyeokguk.js';
import {
  hasHiddenGyeobJae,
  hasHiddenPyeonIn,
  hasHiddenSangGwan,
  hasSikSinStrong,
} from './GyeokgukFormationProfile.js';
import type { FormationProfile } from './GyeokgukFormationProfile.js';
import {
  buildNotAssessedFormation,
  evaluateFormationRule,
  type FormationRuleSpec,
} from './GyeokgukFormationShared.js';

function createJaeCommonSpec(patternName: string): FormationRuleSpec {
  return {
    patternName,
    formationCondition: '재생관(財生官) 또는 식신생재(食神生財)+신강',
    breaking: [
      [(p) => p.bigyeopCount >= 2, '군겁쟁재(群劫爭財): 비겁이 과다하여 재성을 빼앗김'],
      [(p) => hasHiddenGyeobJae(p), '지장간 잠재(潛在) 겁재: 지지 정기에 겁재가 있어 운에서 투출 시 쟁재 위험'],
      [(p) => p.hasPyeonGwan, '재투칠살(財透七殺): 재성이 칠살을 생함'],
    ],
    rescue: [
      [(p) => p.bigyeopCount >= 2 && p.hasGwan, '관성이 비겁을 제어하여 재성 보호(官制劫護財)'],
      [(p) => p.bigyeopCount >= 2 && p.hasSikSin, '식신이 비겁의 기운을 설기하여 재를 생(食化劫生財)'],
      [(p) => p.hasPyeonGwan && p.hasSikSin, '식신이 칠살을 제어하여 재를 보호(食制殺護財)'],
    ],
    support: (p) => (p.hasSiksang && p.isStrong) || p.hasGwan,
  };
}

function createInCommonSpec(patternName: string): FormationRuleSpec {
  return {
    patternName,
    formationCondition: '관인상생(官印相生), 인경봉살(印輕逢殺), 또는 식상 설기(食傷泄氣)',
    breaking: [
      [(p) => !p.isStrong && p.hasJae, '인경봉재(印輕逢財): 인성이 약한데 재성이 극함'],
      [(p) => p.isStrong && p.inseongCount >= 2 && p.hasPyeonGwan && !p.hasSiksang, '신강인중투살(身強印重透殺): 일간이 강하고 인성이 과하며 칠살이 인을 기름'],
    ],
    rescue: [
      [(p) => !p.isStrong && p.hasJae && p.hasBigyeop, '비겁이 재성을 극하여 인성 보호(劫財護印)'],
    ],
    support: (p) =>
      (p.hasGwan && p.hasInseong) ||
      (p.hasPyeonGwan && !p.isStrong) ||
      (p.isStrong && p.hasSiksang),
  };
}

const NAEGYEOK_RULES: Readonly<Partial<Record<GyeokgukType, FormationRuleSpec>>> = {
  [GyeokgukType.JEONGGWAN]: {
    patternName: '정관격',
    formationCondition: '재생관(財生官) 또는 관인상생(官印相生))',
    breaking: [
      [(p) => p.hasSangGwan, '상관견관(傷官見官): 상관이 투출하여 정관을 극함'],
      [(p) => p.hasJeongGwan && p.hasPyeonGwan, '관살혼잡(官殺混雜): 정관과 편관이 동시 투출'],
      [(p) => hasHiddenSangGwan(p), '지장간 잠재(潛在) 상관: 지지 정기에 상관이 있어 운에서 투출 시 상관견관 위험'],
    ],
    rescue: [
      [(p) => p.hasSangGwan && p.hasInseong, '인성이 상관을 제압하여 정관 보호(印制傷官)'],
    ],
    support: (p) =>
      (p.hasJae && !p.hasSangGwan) ||
      (p.hasInseong && !p.hasJae),
  },
  [GyeokgukType.JEONGJAE]: createJaeCommonSpec('정재격'),
  [GyeokgukType.PYEONJAE]: createJaeCommonSpec('편재격'),
  [GyeokgukType.SIKSIN]: {
    patternName: '식신격',
    formationCondition: '식신생재(食神生財) 또는 식신제살(食神制殺)',
    breaking: [
      [(p) => p.hasPyeonIn, '효신탈식(梟神奪食): 편인이 투출하여 식신을 극함'],
      [(p) => hasHiddenPyeonIn(p), '지장간 잠재(潛在) 편인: 지지 정기에 편인이 있어 운에서 투출 시 효신탈식 위험'],
      [(p) => p.hasJae && p.hasPyeonGwan && !hasSikSinStrong(p), '식신생재 노살(生財露殺): 재성이 칠살을 기르나 식신이 이를 제어하기 부족'],
    ],
    rescue: [
      [(p) => p.hasPyeonIn && p.hasPyeonJae, '편재가 편인을 제압하여 식신 보호(制梟護食)'],
    ],
    // 기존 구현은 hasSupport 여부와 무관하게 "파격 요인 없음"만으로 성격을 유지했다.
    support: () => true,
  },
  [GyeokgukType.SANGGWAN]: {
    patternName: '상관격',
    formationCondition: '상관생재(傷官生財), 상관패인(傷官佩印), 또는 상관제살(傷官制殺)',
    breaking: [
      [(p) => p.hasJeongGwan, '상관견관(傷官見官): 상관격에서 정관이 투출'],
      [(p) => p.hasJae && p.hasPyeonGwan, '상관생재 대살(生財帶殺): 재성이 칠살을 기름'],
      [(p) => p.hasInseong && p.isStrong && !p.hasPyeonGwan && !p.hasJae, '상관패인 중 상경신왕(傷輕身旺): 상관이 약하고 일간이 왕하여 인성이 불필요'],
    ],
    rescue: [
      [(p) => p.hasJeongGwan && p.hasInseong, '인성이 상관을 억제하여 정관 보호(印制傷護官)'],
    ],
    support: (p) =>
      p.hasJae ||
      (p.hasInseong && !p.isStrong) ||
      (p.hasPyeonGwan && !p.hasJae),
  },
  [GyeokgukType.PYEONGWAN]: {
    patternName: '편관격(칠살격)',
    formationCondition: '식신제살(食神制殺), 살인상생(殺印相生), 또는 양인가살(羊刃駕殺)',
    breaking: [
      [(p) => !p.hasSikSin && !p.hasInseong && !p.hasGyeobJae, '칠살무제(七殺無制): 식신, 인성, 양인 모두 없어 칠살을 제어할 수단이 없음'],
      [(p) => p.hasJae && !p.hasSikSin && !p.hasInseong, '재생살무제(財生殺無制): 재성이 칠살을 기르나 제어 수단이 없음'],
      [(p) => p.hasSikSin && p.hasInseong && !p.hasJae, '인탈식(印奪食): 식신으로 칠살을 제어하나 인성이 식신을 극함'],
      [(p) => !p.isStrong && !p.hasInseong && !p.hasGyeobJae, '신약무조(身弱無助): 일간이 약하여 칠살을 감당할 수 없음'],
    ],
    rescue: [
      [(p) => p.hasSikSin && p.hasInseong && p.hasJae, '재성이 인성을 극하여 식신 보호(財去印存食)'],
    ],
    support: (p) => p.hasSikSin || p.hasInseong || p.hasGyeobJae,
  },
  [GyeokgukType.JEONGIN]: createInCommonSpec('정인격'),
  [GyeokgukType.PYEONIN]: {
    patternName: '편인격',
    formationCondition: '살인상생(殺印相生) 또는 재성 제어(財制偏印)',
    breaking: [
      [(p) => p.hasSikSin, '효신탈식(梟神奪食): 편인이 식신을 극함'],
      [(p) => !p.isStrong && p.hasJae, '인경봉재(印輕逢財): 인성이 약한데 재성이 극함'],
      [(p) => p.inseongCount >= 3 && !p.hasJae, '인과다무제(印過多無制): 편인이 과도하나 재성의 제어가 없음'],
    ],
    rescue: [
      [(p) => p.hasSikSin && p.hasPyeonJae, '편재가 편인을 제압하여 식신 보호(制梟護食)'],
      [(p) => !p.isStrong && p.hasJae && p.hasBigyeop, '비겁이 재성을 극하여 인성 보호(劫財護印)'],
    ],
    support: (p) =>
      (p.hasPyeonGwan && p.hasInseong) ||
      (p.hasJae && p.isStrong),
  },
  [GyeokgukType.GEONROK]: {
    patternName: '건록격',
    formationCondition: '투관봉재인(透官逢財印), 투재봉식상(透財逢食傷), 또는 투살봉제복(透殺逢制伏)',
    breaking: [
      [(p) => !p.hasJae && !p.hasGwan && !p.hasPyeonGwan && !p.hasSiksang, '무재관식상(無財官食傷): 재성, 관성, 식상이 모두 없어 비겁만 남음'],
      [(p) => p.hasJeongGwan && p.hasSangGwan && !p.hasInseong, '투관봉상(透官逢傷): 정관이 투출했으나 상관이 극하고 인성의 보호가 없음'],
      [(p) => p.hasPyeonGwan && p.hasInseong && !p.hasSikSin && !p.hasJae, '투살투인무식(透殺透印無食): 칠살과 인성이 있으나 식신이 없어 살을 제어 못 함'],
    ],
    rescue: [
      [(p) => p.hasJeongGwan && p.hasSangGwan && p.hasInseong, '인성이 상관을 제압하여 정관 보호(印制傷護官)'],
    ],
    support: (p) =>
      (p.hasJeongGwan && (p.hasJae || p.hasInseong)) ||
      (p.hasJae && p.hasSiksang) ||
      (p.hasPyeonGwan && p.hasSikSin),
  },
  [GyeokgukType.YANGIN]: {
    patternName: '양인격',
    formationCondition: '관살이 양인을 제어(官殺制刃)',
    breaking: [
      [(p) => !p.hasGwan && !p.hasPyeonGwan, '양인무관살(羊刃無官殺): 관살이 없어 양인(겁재)을 제어할 수 없음'],
      [(p) => p.hasSangGwan && p.hasJeongGwan && !p.hasInseong, '상관견관(傷官見官): 상관이 양인격의 관을 극하고 인성 보호가 없음'],
      [(p) => p.hasSiksang && (p.hasGwan || p.hasPyeonGwan) && !p.hasInseong, '식상제관(食傷制官): 식상이 관살을 극하여 양인 통제력 상실'],
    ],
    rescue: [
      [(p) => p.hasSangGwan && p.hasInseong, '인성이 상관을 제압하여 관 보호(印護官制傷)'],
      [(p) => p.hasSiksang && p.hasInseong, '인성이 식상을 억제하여 관살 보호(重印護官)'],
    ],
    support: (p) => (p.hasGwan || p.hasPyeonGwan) && !p.hasSangGwan,
  },
};

export function assessNaegyeok(
  type: GyeokgukType,
  profile: FormationProfile,
): GyeokgukFormation {
  const spec = NAEGYEOK_RULES[type];
  return spec
    ? evaluateFormationRule(profile, spec)
    : buildNotAssessedFormation('해당 격국 유형의 성격/파격 규칙이 정의되지 않음.');
}
