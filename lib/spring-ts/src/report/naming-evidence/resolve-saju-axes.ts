import type { BirthInfo, SajuSummary } from '../../types.js';
import { buildFeatureVector } from '../tiered/feature-selector.js';
import { gyeokgukToFamily } from '../tiered/class-axes.js';
import {
  NamingEvidenceContractError,
  type NamingEvidenceSajuAxes,
  type NamingEvidenceStrength,
} from './types.js';

function strengthOf(value: ReturnType<typeof buildFeatureVector>['dayMasterStrength']): NamingEvidenceStrength {
  if (value === 'WEAK' || value === 'EXTREME_WEAK') return 'weak';
  if (value === 'STRONG' || value === 'EXTREME_STRONG') return 'strong';
  return 'balanced';
}

export function resolveNamingEvidenceSajuAxes(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
): NamingEvidenceSajuAxes {
  const feature = buildFeatureVector(saju, birth, targetDate);
  const gyeokgukFamily = gyeokgukToFamily(feature.gyeokguk);
  if (!feature.dayMasterElement) {
    throw new NamingEvidenceContractError('sajuAxes.dayMasterElement', 'engine did not resolve the day-master element');
  }
  if (!feature.yongshinElement) {
    throw new NamingEvidenceContractError('sajuAxes.yongshinElement', 'engine did not resolve the yongshin element');
  }
  if (!gyeokgukFamily) {
    throw new NamingEvidenceContractError('sajuAxes.gyeokgukFamily', 'engine did not resolve the gyeokguk family');
  }
  return {
    dayMasterElement: feature.dayMasterElement,
    strength: strengthOf(feature.dayMasterStrength),
    yongshinElement: feature.yongshinElement,
    gyeokgukFamily,
  };
}
