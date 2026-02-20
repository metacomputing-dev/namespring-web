import type { StemIdx } from './cycle.js';
import { stemElement, stemYinYang } from './cycle.js';
import { controls, generates, isSameElement } from './elements.js';

export type TenGod =
  | 'BI_GYEON'
  | 'GEOB_JAE'
  | 'SIK_SHIN'
  | 'SANG_GWAN'
  | 'PYEON_JAE'
  | 'JEONG_JAE'
  | 'PYEON_GWAN'
  | 'JEONG_GWAN'
  | 'PYEON_IN'
  | 'JEONG_IN';

/**
 * Compute Ten Gods (십성) of `otherStem` relative to `dayStem`.
 *
 * Rule: relationship is determined by 5-element 生/剋 + Yin/Yang parity.
 */
export function tenGodOf(dayStem: StemIdx, otherStem: StemIdx): TenGod {
  const aE = stemElement(dayStem);
  const bE = stemElement(otherStem);
  const samePolarity = stemYinYang(dayStem) === stemYinYang(otherStem);

  if (isSameElement(aE, bE)) {
    return samePolarity ? 'BI_GYEON' : 'GEOB_JAE';
  }

  // self generates other => 식상
  if (generates(aE, bE)) {
    return samePolarity ? 'SIK_SHIN' : 'SANG_GWAN';
  }

  // other generates self => 인성
  if (generates(bE, aE)) {
    return samePolarity ? 'PYEON_IN' : 'JEONG_IN';
  }

  // self controls other => 재성
  if (controls(aE, bE)) {
    return samePolarity ? 'PYEON_JAE' : 'JEONG_JAE';
  }

  // other controls self => 관성
  if (controls(bE, aE)) {
    return samePolarity ? 'PYEON_GWAN' : 'JEONG_GWAN';
  }

  // With 5 elements, we should have matched one of above.
  return samePolarity ? 'BI_GYEON' : 'GEOB_JAE';
}
