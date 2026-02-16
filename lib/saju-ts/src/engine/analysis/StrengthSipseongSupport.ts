import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { OhaengRelation, OhaengRelations } from '../../domain/Ohaeng.js';
import { Sipseong } from '../../domain/Sipseong.js';

export function determineSipseong(dayMaster: Cheongan, target: Cheongan): Sipseong {
  const dayInfo = CHEONGAN_INFO[dayMaster];
  const targetInfo = CHEONGAN_INFO[target];
  const sameParity = dayInfo.eumyang === targetInfo.eumyang;
  const relation = OhaengRelations.relation(dayInfo.ohaeng, targetInfo.ohaeng);

  switch (relation) {
    case OhaengRelation.BIHWA:
      return sameParity ? Sipseong.BI_GYEON : Sipseong.GYEOB_JAE;
    case OhaengRelation.YEOKSAENG:
      return sameParity ? Sipseong.SIK_SIN : Sipseong.SANG_GWAN;
    case OhaengRelation.SANGGEUK:
      return sameParity ? Sipseong.PYEON_JAE : Sipseong.JEONG_JAE;
    case OhaengRelation.YEOKGEUK:
      return sameParity ? Sipseong.PYEON_GWAN : Sipseong.JEONG_GWAN;
    case OhaengRelation.SANGSAENG:
      return sameParity ? Sipseong.PYEON_IN : Sipseong.JEONG_IN;
  }
}

export function isBigyeop(sipseong: Sipseong): boolean {
  return sipseong === Sipseong.BI_GYEON || sipseong === Sipseong.GYEOB_JAE;
}

export function isInseong(sipseong: Sipseong): boolean {
  return sipseong === Sipseong.PYEON_IN || sipseong === Sipseong.JEONG_IN;
}

export function isSupportingSipseong(sipseong: Sipseong): boolean {
  return isBigyeop(sipseong) || isInseong(sipseong);
}

