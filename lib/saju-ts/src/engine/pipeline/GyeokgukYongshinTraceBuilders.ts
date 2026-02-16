import { type CalculationConfig } from '../../config/CalculationConfig.js';
import { type GyeokgukResult } from '../../domain/Gyeokguk.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { type YongshinResult } from '../../domain/YongshinResult.js';
import { buildYongshinReasoning } from './LuckTraceReasoningBuilders.js';
import { ohaengKr } from './OhaengHelpers.js';
import { tracedStep } from './TraceHelpers.js';

export function buildGyeokgukTraceStep(
  gyeokguk: GyeokgukResult,
) {
  const formationQualityLabel = gyeokguk.formation
    ? gyeokguk.formation.quality
    : 'NOT_ASSESSED';

  return tracedStep(
    ANALYSIS_KEYS.GYEOKGUK,
    `격국 판정 — ${gyeokguk.type}(${gyeokguk.category}). ` +
    `성격: ${formationQualityLabel}, 신뢰도=${Math.round(gyeokguk.confidence * 100)}%.`,
    [
      `type=${gyeokguk.type}`,
      `category=${gyeokguk.category}`,
      `confidence=${gyeokguk.confidence.toFixed(2)}`,
      `formation=${formationQualityLabel}`,
    ],
    [
      `격국 판별: ${gyeokguk.reasoning}`,
      ...(gyeokguk.formation ? [`격국 성격: ${gyeokguk.formation.reasoning}`] : []),
      ...(gyeokguk.formation && gyeokguk.formation.breakingFactors.length > 0
        ? [`파격 요인: ${gyeokguk.formation.breakingFactors.join(', ')}`]
        : []),
      ...(gyeokguk.formation && gyeokguk.formation.rescueFactors.length > 0
        ? [`구원 요인: ${gyeokguk.formation.rescueFactors.join(', ')}`]
        : []),
    ],
  );
}

export function buildYongshinTraceStep(
  yongshin: YongshinResult,
  yongshinPriority: CalculationConfig['yongshinPriority'],
) {
  const yongshinOhKr = ohaengKr(yongshin.finalYongshin);
  const heesinKr = yongshin.finalHeesin ? ohaengKr(yongshin.finalHeesin) : '없음';
  const yongshinReasoning: string[] = buildYongshinReasoning(yongshin, yongshinPriority);

  return tracedStep(
    ANALYSIS_KEYS.YONGSHIN,
    `용신 결정 — 최종용신: ${yongshinOhKr}, 희신: ${heesinKr}. ` +
    `억부-조후 일치도: ${yongshin.agreement}(신뢰도=${Math.round(yongshin.finalConfidence * 100)}%). ` +
    `우선순위=${yongshinPriority}, 추천수=${yongshin.recommendations.length}.`,
    [
      `finalYongshin=${yongshin.finalYongshin}`,
      `finalHeesin=${yongshin.finalHeesin ?? 'NONE'}`,
      `agreement=${yongshin.agreement}`,
      `finalConfidence=${yongshin.finalConfidence}`,
      `recommendations=${yongshin.recommendations.map(r => r.type).join(',')}`,
    ],
    yongshinReasoning,
  );
}

