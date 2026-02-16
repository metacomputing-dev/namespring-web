import { type PalaceAnalysis } from '../../domain/Palace.js';
import { type PillarPosition, PILLAR_POSITION_VALUES } from '../../domain/PillarPosition.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { SIPSEONG_INFO } from '../../domain/Sipseong.js';
import { tracedStep } from './TraceHelpers.js';

export function buildPalaceTraceStep(
  palace: Readonly<Record<PillarPosition, PalaceAnalysis>>,
) {
  return tracedStep(
    ANALYSIS_KEYS.PALACE,
    `궁성(宮星) 분석 완료.`,
    PILLAR_POSITION_VALUES
      .filter(pos => palace[pos]?.sipseong != null)
      .map(pos => `${pos}=${palace[pos]!.palaceInfo.koreanName}: ${SIPSEONG_INFO[palace[pos]!.sipseong!].koreanName}`),
    PILLAR_POSITION_VALUES
      .filter(pos => palace[pos]?.interpretation != null)
      .map(pos => {
        const pa = palace[pos]!;
        const interp = pa.interpretation!;
        return `${pa.palaceInfo.koreanName}(${pa.palaceInfo.domain}): ` +
          `${pa.sipseong ? SIPSEONG_INFO[pa.sipseong].koreanName : '-'} → ${interp.favor} — ${interp.summary}`;
      }),
  );
}

