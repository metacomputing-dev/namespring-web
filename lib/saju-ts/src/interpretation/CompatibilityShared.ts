import { Cheongan, CHEONGAN_INFO } from '../domain/Cheongan.js';
import { Gender } from '../domain/Gender.js';
import { Jiji, JIJI_INFO } from '../domain/Jiji.js';
import { Ohaeng, OhaengRelations, OHAENG_VALUES, ohaengKoreanLabel } from '../domain/Ohaeng.js';
import { type PillarSet } from '../domain/PillarSet.js';
import { Sipseong } from '../domain/Sipseong.js';

export function stemKr(c: Cheongan): string {
  const info = CHEONGAN_INFO[c];
  return `${info.hangul}(${info.hanja})`;
}

export function branchKr(j: Jiji): string {
  const info = JIJI_INFO[j];
  return `${info.hangul}(${info.hanja})`;
}

export function ohaengKr(oh: Ohaeng): string {
  return ohaengKoreanLabel(oh);
}

export function computeSipseong(dayMaster: Cheongan, targetStem: Cheongan): Sipseong {
  const dmOhaeng = CHEONGAN_INFO[dayMaster].ohaeng;
  const targetOhaeng = CHEONGAN_INFO[targetStem].ohaeng;
  const sameYinYang = CHEONGAN_INFO[dayMaster].eumyang === CHEONGAN_INFO[targetStem].eumyang;

  if (dmOhaeng === targetOhaeng && sameYinYang) return Sipseong.BI_GYEON;
  if (dmOhaeng === targetOhaeng && !sameYinYang) return Sipseong.GYEOB_JAE;
  if (OhaengRelations.generates(dmOhaeng) === targetOhaeng && sameYinYang) return Sipseong.SIK_SIN;
  if (OhaengRelations.generates(dmOhaeng) === targetOhaeng && !sameYinYang) return Sipseong.SANG_GWAN;
  if (OhaengRelations.controls(dmOhaeng) === targetOhaeng && sameYinYang) return Sipseong.PYEON_JAE;
  if (OhaengRelations.controls(dmOhaeng) === targetOhaeng && !sameYinYang) return Sipseong.JEONG_JAE;
  if (OhaengRelations.controlledBy(dmOhaeng) === targetOhaeng && sameYinYang) return Sipseong.PYEON_GWAN;
  if (OhaengRelations.controlledBy(dmOhaeng) === targetOhaeng && !sameYinYang) return Sipseong.JEONG_GWAN;
  if (OhaengRelations.generatedBy(dmOhaeng) === targetOhaeng && sameYinYang) return Sipseong.PYEON_IN;
  if (OhaengRelations.generatedBy(dmOhaeng) === targetOhaeng && !sameYinYang) return Sipseong.JEONG_IN;
  return Sipseong.BI_GYEON; // fallback (shouldn't happen)
}

export function countOhaeng(ps: PillarSet): Map<Ohaeng, number> {
  const elements = [
    CHEONGAN_INFO[ps.year.cheongan].ohaeng, JIJI_INFO[ps.year.jiji].ohaeng,
    CHEONGAN_INFO[ps.month.cheongan].ohaeng, JIJI_INFO[ps.month.jiji].ohaeng,
    CHEONGAN_INFO[ps.day.cheongan].ohaeng, JIJI_INFO[ps.day.jiji].ohaeng,
    CHEONGAN_INFO[ps.hour.cheongan].ohaeng, JIJI_INFO[ps.hour.jiji].ohaeng,
  ];
  const counts = new Map<Ohaeng, number>();
  for (const oh of OHAENG_VALUES) {
    counts.set(oh, 0);
  }
  for (const e of elements) {
    counts.set(e, counts.get(e)! + 1);
  }
  return counts;
}

export function sipseongPartnerMeaning(ss: Sipseong, myGender: Gender): string {
  switch (ss) {
    case Sipseong.BI_GYEON:   return '동등한 친구 같은 관계, 경쟁과 동지의식이 공존합니다.';
    case Sipseong.GYEOB_JAE:  return '자극적이지만 소모적일 수 있어 감정 관리가 필요합니다.';
    case Sipseong.SIK_SIN:    return '편안하고 풍요로운 관계, 서로를 잘 돌봐줍니다.';
    case Sipseong.SANG_GWAN:  return '창의적 자극을 주지만 때로 상처를 줄 수 있습니다.';
    case Sipseong.PYEON_JAE:  return myGender === Gender.MALE ? '연인/배우자 인연이 강한 관계입니다.' : '사교적이고 활동적인 관계입니다.';
    case Sipseong.JEONG_JAE:  return myGender === Gender.MALE ? '안정적인 배우자 인연, 현실적 돌봄이 있습니다.' : '믿음직한 재물 파트너 관계입니다.';
    case Sipseong.PYEON_GWAN: return myGender === Gender.FEMALE ? '연인/배우자 인연이 강한 관계입니다.' : '긴장감 있지만 성장을 촉진하는 관계입니다.';
    case Sipseong.JEONG_GWAN: return myGender === Gender.FEMALE ? '안정적인 배우자 인연, 사회적 성장을 돕습니다.' : '존경과 신뢰의 관계입니다.';
    case Sipseong.PYEON_IN:   return '정신적 자극과 직관적 교감이 있는 관계입니다.';
    case Sipseong.JEONG_IN:   return '지적 교감과 깊은 돌봄이 있는 관계입니다.';
  }
}

export function sipseongRelScore(ss: Sipseong): number {
  switch (ss) {
    case Sipseong.JEONG_JAE:
    case Sipseong.JEONG_GWAN: return 85;
    case Sipseong.PYEON_JAE:
    case Sipseong.PYEON_GWAN: return 75;
    case Sipseong.SIK_SIN:
    case Sipseong.JEONG_IN:   return 80;
    case Sipseong.SANG_GWAN:
    case Sipseong.PYEON_IN:   return 55;
    case Sipseong.BI_GYEON:   return 60;
    case Sipseong.GYEOB_JAE:  return 40;
  }
}
