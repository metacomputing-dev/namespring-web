import { type CalculationConfig } from '../../config/CalculationConfig.js';
import { CHEONGAN_INFO, type CheonganInfo } from '../../domain/Cheongan.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../domain/PillarPosition.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { SIPSEONG_INFO } from '../../domain/Sipseong.js';
import { type PillarTenGodAnalysis, type TenGodAnalysis } from '../../domain/TenGodAnalysis.js';
import { ohaengKr } from './OhaengHelpers.js';
import { tracedStep } from './TraceHelpers.js';

function pillarTenGodAnalysisOf(
  tenGodAnalysis: TenGodAnalysis,
  pos: PillarPosition,
): PillarTenGodAnalysis | undefined {
  return (tenGodAnalysis.byPosition as Record<string, unknown>)[pos] as PillarTenGodAnalysis | undefined;
}

export function buildTenGodTraceStep(
  dmInfo: CheonganInfo,
  tenGodAnalysis: TenGodAnalysis,
) {
  return tracedStep(
    ANALYSIS_KEYS.TEN_GODS,
    `십성(十星) 분석 — 일간 ${dmInfo.hangul}(${dmInfo.hanja}) 기준 4주 천간·지지의 십성 배치 완료.`,
    Object.values(PillarPosition).filter((v): v is PillarPosition => typeof v === 'string').length > 0
      ? PILLAR_POSITION_VALUES.map(pos => {
        const ptga = pillarTenGodAnalysisOf(tenGodAnalysis, pos);
        if (!ptga) return '';
        return `${pos}: 천간=${SIPSEONG_INFO[ptga.cheonganSipseong].koreanName}, 지지본기=${SIPSEONG_INFO[ptga.jijiPrincipalSipseong].koreanName}`;
      }).filter(s => s.length > 0)
      : [],
    [
      `십성은 일간 ${dmInfo.hangul}(${ohaengKr(dmInfo.ohaeng)})을 기준으로 ` +
      `다른 천간·지지와의 오행 관계(생극제화)를 판별합니다.`,
    ],
  );
}

export function buildHiddenStemTraceStep(
  tenGodAnalysis: TenGodAnalysis,
  hiddenStemVariant: CalculationConfig['hiddenStemVariant'],
) {
  return tracedStep(
    ANALYSIS_KEYS.HIDDEN_STEMS,
    `지장간(支藏干) 분석 — 4주 지지의 숨은 천간 추출 완료.`,
    PILLAR_POSITION_VALUES.map(pos => {
      const ptga = pillarTenGodAnalysisOf(tenGodAnalysis, pos);
      if (!ptga) return '';
      return `${pos}: ${ptga.hiddenStems.map(h => `${CHEONGAN_INFO[h.stem].hangul}(${h.role})`).join('/')}`;
    }).filter(s => s.length > 0),
    [
      `지장간은 각 지지 속에 내포된 천간으로, 여기(餘氣)·중기(中氣)·정기(正氣)로 구분됩니다. ` +
      `정기가 가장 강한 영향력을 가지며, 격국·투출 판별의 핵심입니다.`,
      `[유파 설정] 지장간 배분: ${hiddenStemVariant}`,
    ],
  );
}

