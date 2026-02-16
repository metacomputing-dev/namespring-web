import { type CalculationConfig, EarthLifeStageRule } from '../../config/CalculationConfig.js';
import { type CheonganInfo } from '../../domain/Cheongan.js';
import { Eumyang, EUMYANG_INFO } from '../../domain/Eumyang.js';
import { JIJI_INFO } from '../../domain/Jiji.js';
import { type PillarPosition, PILLAR_POSITION_VALUES } from '../../domain/PillarPosition.js';
import { type PillarSet } from '../../domain/PillarSet.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { type SibiUnseong, SIBI_UNSEONG_INFO } from '../../domain/SibiUnseong.js';
import { ohaengKr } from './OhaengHelpers.js';
import { pillarOf } from './PillarHelpers.js';
import { tracedStep } from './TraceHelpers.js';

export function buildSibiUnseongTraceStep(
  sibiUnseong: ReadonlyMap<PillarPosition, SibiUnseong>,
  pillars: PillarSet,
  dmInfo: CheonganInfo,
  config: CalculationConfig,
) {
  const sibiSummary = PILLAR_POSITION_VALUES.map(pos => {
    const stage = sibiUnseong.get(pos);
    return stage ? `${pos}=${SIBI_UNSEONG_INFO[stage].koreanName}` : '';
  }).filter(s => s.length > 0).join(', ');

  const eumyangRule = config.yinReversalEnabled ? '양순음역(陽順陰逆)' : '음양개순(陰陽皆順)';
  const earthRule = config.earthLifeStageRule === EarthLifeStageRule.FOLLOW_FIRE
    ? '화토동법(火土同法)'
    : config.earthLifeStageRule === EarthLifeStageRule.FOLLOW_WATER
      ? '수토동법(水土同法)'
      : '토독립설(→화토동법으로 계산)';

  return tracedStep(
    ANALYSIS_KEYS.SIBI_UNSEONG,
    `십이운성 산출 — ${sibiSummary}. ` +
    `토오행규칙=${config.earthLifeStageRule}, 음간역행=${config.yinReversalEnabled}.`,
    [`entries=${sibiUnseong.size}`],
    [
      `일간 ${dmInfo.hangul}(${dmInfo.hanja})은 ` +
      `${ohaengKr(dmInfo.ohaeng)}·${EUMYANG_INFO[dmInfo.eumyang].hangul} → ` +
      `${eumyangRule} 적용, ${earthRule}`,
      ...PILLAR_POSITION_VALUES.map(pos => {
        const stage = sibiUnseong.get(pos);
        if (!stage) return '';
        const branch = pillarOf(pillars, pos).jiji;
        const bi = JIJI_INFO[branch];
        const dirText = dmInfo.eumyang === Eumyang.YANG
          ? '순행(→)'
          : (config.yinReversalEnabled ? '역행(←)' : '순행(→)');
        return `${pos}: 일간 ${dmInfo.hangul} → 지지 ${bi.hangul}(${bi.hanja}) ` +
          `${dirText} = ${SIBI_UNSEONG_INFO[stage].koreanName}(${SIBI_UNSEONG_INFO[stage].hanja})`;
      }).filter(s => s.length > 0),
      `[유파 설정] 12운성 토 규칙: ${config.earthLifeStageRule}` +
      ` — FOLLOW_FIRE(화토동법, 주류), FOLLOW_WATER(수토동법), INDEPENDENT(토독립설→화토동법)`,
    ],
  );
}

