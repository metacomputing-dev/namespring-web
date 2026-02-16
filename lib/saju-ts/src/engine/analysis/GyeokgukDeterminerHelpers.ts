import { Jiji } from '../../domain/Jiji.js';
import { Ohaeng, OhaengRelation, OhaengRelations } from '../../domain/Ohaeng.js';
import { Sipseong } from '../../domain/Sipseong.js';

export enum SipseongCategory {
  BIGYEOP  = 'BIGYEOP',
  SIKSANG  = 'SIKSANG',
  JAE      = 'JAE',
  GWAN     = 'GWAN',
  INSEONG  = 'INSEONG',
}

export const BANGHAP_GROUPS: ReadonlyMap<Ohaeng, ReadonlySet<Jiji>> = new Map<Ohaeng, Set<Jiji>>([
  [Ohaeng.WOOD,  new Set<Jiji>([Jiji.IN, Jiji.MYO, Jiji.JIN])],
  [Ohaeng.FIRE,  new Set<Jiji>([Jiji.SA, Jiji.O, Jiji.MI])],
  [Ohaeng.EARTH, new Set<Jiji>([Jiji.JIN, Jiji.SUL, Jiji.CHUK, Jiji.MI])],
  [Ohaeng.METAL, new Set<Jiji>([Jiji.SIN, Jiji.YU, Jiji.SUL])],
  [Ohaeng.WATER, new Set<Jiji>([Jiji.HAE, Jiji.JA, Jiji.CHUK])],
]);

export function categorize(sipseong: Sipseong): SipseongCategory {
  switch (sipseong) {
    case Sipseong.BI_GYEON:
    case Sipseong.GYEOB_JAE:   return SipseongCategory.BIGYEOP;
    case Sipseong.SIK_SIN:
    case Sipseong.SANG_GWAN:   return SipseongCategory.SIKSANG;
    case Sipseong.PYEON_JAE:
    case Sipseong.JEONG_JAE:   return SipseongCategory.JAE;
    case Sipseong.PYEON_GWAN:
    case Sipseong.JEONG_GWAN:  return SipseongCategory.GWAN;
    case Sipseong.PYEON_IN:
    case Sipseong.JEONG_IN:    return SipseongCategory.INSEONG;
  }
}

export function categorizeByOhaeng(dayMasterOhaeng: Ohaeng, targetOhaeng: Ohaeng): SipseongCategory {
  const relation = OhaengRelations.relation(dayMasterOhaeng, targetOhaeng);
  switch (relation) {
    case OhaengRelation.BIHWA:     return SipseongCategory.BIGYEOP;
    case OhaengRelation.YEOKSAENG: return SipseongCategory.SIKSANG;
    case OhaengRelation.SANGGEUK:  return SipseongCategory.JAE;
    case OhaengRelation.YEOKGEUK:  return SipseongCategory.GWAN;
    case OhaengRelation.SANGSAENG: return SipseongCategory.INSEONG;
  }
}

