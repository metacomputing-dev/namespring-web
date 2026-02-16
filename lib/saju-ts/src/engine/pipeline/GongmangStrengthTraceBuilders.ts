import { type CalculationConfig } from '../../config/CalculationConfig.js';
import { CHEONGAN_INFO, type CheonganInfo } from '../../domain/Cheongan.js';
import { JIJI_INFO } from '../../domain/Jiji.js';
import { type PillarSet } from '../../domain/PillarSet.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { type StrengthResult, STRENGTH_LEVEL_INFO } from '../../domain/StrengthResult.js';
import { type GongmangResult } from '../analysis/GongmangCalculator.js';
import { tracedStep } from './TraceHelpers.js';

export function buildGongmangTraceStep(
  gongmang: GongmangResult,
  pillars: PillarSet,
) {
  const gvb = gongmang.voidBranches;

  return tracedStep(
    ANALYSIS_KEYS.GONGMANG,
    `공망(空亡) 계산 — ${JIJI_INFO[gvb[0]].hangul}(${JIJI_INFO[gvb[0]].hanja})·` +
    `${JIJI_INFO[gvb[1]].hangul}(${JIJI_INFO[gvb[1]].hanja}). ` +
    `해당 기둥 ${gongmang.affectedPositions.length}개.`,
    [
      `void=${gvb[0]}/${gvb[1]}`,
      `affected=${gongmang.affectedPositions.length}`,
    ],
    [
      `일주 ${CHEONGAN_INFO[pillars.day.cheongan].hangul}${JIJI_INFO[pillars.day.jiji].hangul}의 ` +
      `육갑순(六甲旬)에서 배정되지 않는 지지 2개가 공망: ` +
      `${JIJI_INFO[gvb[0]].hangul}(${JIJI_INFO[gvb[0]].hanja})·` +
      `${JIJI_INFO[gvb[1]].hangul}(${JIJI_INFO[gvb[1]].hanja})`,
      ...gongmang.affectedPositions.map(hit => {
        const restored = hit.isRestored
          ? `해공(解空): ${hit.restorationNote}`
          : '공망 적용됨';
        return `${hit.position} ${JIJI_INFO[hit.branch].hangul}(${JIJI_INFO[hit.branch].hanja}): ${restored}`;
      }),
    ],
  );
}

export function buildStrengthTraceStep(
  strength: StrengthResult,
  dmInfo: CheonganInfo,
  strengthThreshold: CalculationConfig['strengthThreshold'],
) {
  return tracedStep(
    ANALYSIS_KEYS.STRENGTH,
    `일간 ${dmInfo.hangul}(${dmInfo.hanja}) 강약 판정 — ` +
    `${STRENGTH_LEVEL_INFO[strength.level].koreanName}(${strength.isStrong ? '신강' : '신약'}). ` +
    `총지지력=${strength.score.totalSupport.toFixed(1)}, 기준값=${strengthThreshold}.`,
    [
      `level=${strength.level}`,
      `isStrong=${strength.isStrong}`,
      `support=${strength.score.totalSupport.toFixed(1)}`,
    ],
    strength.details,
  );
}

