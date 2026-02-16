import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Ohaeng, OhaengRelations } from '../../domain/Ohaeng.js';
import {
  GyeokgukCategory,
  GyeokgukResult,
  GyeokgukType,
  GYEOKGUK_TYPE_INFO,
  ilhaengFromOhaeng,
} from '../../domain/Gyeokguk.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { StrengthResult } from '../../domain/StrengthResult.js';
import { HapHwaEvaluation, HapState } from '../../domain/Relations.js';
import { CalculationConfig } from '../../config/CalculationConfig.js';
import { BANGHAP_GROUPS } from './GyeokgukDeterminerHelpers.js';
import { buildElementProfile, effectiveOhaeng, ohaengKorean } from './GyeokgukElementProfile.js';

export function checkHwagyeok(
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): GyeokgukResult | null {
  const hapwha = hapHwaEvaluations.find(e => e.state === HapState.HAPWHA);
  if (!hapwha) return null;

  let hwagyeokType: GyeokgukType;
  switch (hapwha.resultOhaeng) {
    case Ohaeng.EARTH: hwagyeokType = GyeokgukType.HAPWHA_EARTH; break;
    case Ohaeng.METAL: hwagyeokType = GyeokgukType.HAPWHA_METAL; break;
    case Ohaeng.WATER: hwagyeokType = GyeokgukType.HAPWHA_WATER; break;
    case Ohaeng.WOOD:  hwagyeokType = GyeokgukType.HAPWHA_WOOD; break;
    case Ohaeng.FIRE:  hwagyeokType = GyeokgukType.HAPWHA_FIRE; break;
  }

  const s1 = CHEONGAN_INFO[hapwha.stem1];
  const s2 = CHEONGAN_INFO[hapwha.stem2];

  return {
    type: hwagyeokType,
    category: GyeokgukCategory.HWAGYEOK,
    baseSipseong: null,
    confidence: hapwha.confidence,
    reasoning: `천간합 ${s1.hangul}(${s1.hanja})+${s2.hangul}(${s2.hanja})이(가) ` +
      `${ohaengKorean(hapwha.resultOhaeng)}(으)로 합화 성립하여 ${GYEOKGUK_TYPE_INFO[hwagyeokType].koreanName}으로 판단. ` +
      hapwha.reasoning,
    formation: null,
  };
}

export function checkJongGang(
  dayMaster: Cheongan,
  pillars: PillarSet,
  strength: StrengthResult,
  distanceFromThreshold: number,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): GyeokgukResult | null {
  const profile = buildElementProfile(dayMaster, pillars, hapHwaEvaluations);

  if (profile.bigyeopCount >= 4 && profile.jaeCount + profile.gwanCount === 0) {
    const confidence = Math.min(0.95, Math.max(0.85, 0.85 + (distanceFromThreshold / 18.6) * 0.10));
    return {
      type: GyeokgukType.JONGGANG,
      category: GyeokgukCategory.JONGGYEOK,
      baseSipseong: null,
      confidence,
      reasoning: `극신강 상태에서 비겁이 극도로 강하고 재관이 없어 종강격으로 판단. ` +
        `(총부조점수: ${strength.score.totalSupport})`,
      formation: null,
    };
  }

  return null;
}

export function buildJongResult(
  type: GyeokgukType,
  strength: StrengthResult,
  reasoning: string,
  distanceFromThreshold: number,
): GyeokgukResult {
  const confidence = Math.min(0.90, Math.max(0.75, 0.75 + (distanceFromThreshold / 15.0) * 0.15));
  return {
    type,
    category: GyeokgukCategory.JONGGYEOK,
    baseSipseong: null,
    confidence,
    reasoning: `${reasoning} (총부조점수: ${strength.score.totalSupport})`,
    formation: null,
  };
}

export function checkWeakJong(
  dayMaster: Cheongan,
  pillars: PillarSet,
  strength: StrengthResult,
  distanceFromThreshold: number,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): GyeokgukResult | null {
  const profile = buildElementProfile(dayMaster, pillars, hapHwaEvaluations);
  const hasSelfSupport = profile.bigyeopCount > 0 || profile.inseongCount > 0;

  if (!hasSelfSupport && profile.gwanCount >= 3 && profile.siksangCount === 0 && profile.jaeCount === 0) {
    return buildJongResult(GyeokgukType.JONGSAL, strength,
      `극신약 상태에서 관살이 지배적이고 비겁/인성이 없어 종살격으로 판단. ` +
      `(관=${profile.gwanCount}, 식상=${profile.siksangCount}, 재=${profile.jaeCount})`,
      distanceFromThreshold);
  }

  if (!hasSelfSupport && profile.siksangCount >= 3
    && profile.siksangCount > profile.gwanCount
    && profile.siksangCount > profile.jaeCount
  ) {
    return buildJongResult(GyeokgukType.JONGA, strength,
      `극신약 상태에서 식상이 지배적으로 강하여 종아격으로 판단. ` +
      `(식상=${profile.siksangCount}, 관=${profile.gwanCount}, 재=${profile.jaeCount})`,
      distanceFromThreshold);
  }

  if (!hasSelfSupport && profile.jaeCount >= 3
    && profile.jaeCount > profile.gwanCount
    && profile.jaeCount > profile.siksangCount
  ) {
    return buildJongResult(GyeokgukType.JONGJAE, strength,
      `극신약 상태에서 재성이 지배적으로 강하여 종재격으로 판단. ` +
      `(재=${profile.jaeCount}, 관=${profile.gwanCount}, 식상=${profile.siksangCount})`,
      distanceFromThreshold);
  }

  const opposingTotal = profile.siksangCount + profile.jaeCount + profile.gwanCount;
  if (!hasSelfSupport && opposingTotal >= 5) {
    return buildJongResult(GyeokgukType.JONGSE, strength,
      `극신약 상태에서 식상/재성/관성이 고루 강하고 비겁/인성이 없어 종세격으로 판단. ` +
      `(식상=${profile.siksangCount}, 재=${profile.jaeCount}, 관=${profile.gwanCount})`,
      distanceFromThreshold);
  }

  return null;
}

export function checkJongGyeok(
  pillars: PillarSet,
  dayMaster: Cheongan,
  strength: StrengthResult,
  config: CalculationConfig,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): GyeokgukResult | null {
  const score = strength.score.totalSupport;
  if (score >= config.jonggyeokStrongThreshold) {
    const distance = score - config.jonggyeokStrongThreshold;
    return checkJongGang(dayMaster, pillars, strength, distance, hapHwaEvaluations);
  }
  if (score <= config.jonggyeokWeakThreshold) {
    const distance = config.jonggyeokWeakThreshold - score;
    return checkWeakJong(dayMaster, pillars, strength, distance, hapHwaEvaluations);
  }
  return null;
}

export function checkIlhaengDeukgi(
  pillars: PillarSet,
  dayMaster: Cheongan,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): GyeokgukResult | null {
  const dayMasterElement = CHEONGAN_INFO[dayMaster].ohaeng;
  const targetBranches = BANGHAP_GROUPS.get(dayMasterElement);
  if (!targetBranches) return null;

  const branches = [
    pillars.year.jiji,
    pillars.month.jiji,
    pillars.day.jiji,
    pillars.hour.jiji,
  ];

  const matchCount = branches.filter(b => targetBranches.has(b)).length;
  if (matchCount < 3) return null;

  const controllingElement = OhaengRelations.controlledBy(dayMasterElement);
  const nonDayPositions: [PillarPosition, Cheongan][] = [
    [PillarPosition.YEAR, pillars.year.cheongan],
    [PillarPosition.MONTH, pillars.month.cheongan],
    [PillarPosition.HOUR, pillars.hour.cheongan],
  ];
  const stemsHaveController = nonDayPositions.some(([pos, stem]) =>
    effectiveOhaeng(pos, stem, hapHwaEvaluations) === controllingElement
  );
  if (stemsHaveController) return null;

  const type = ilhaengFromOhaeng(dayMasterElement);
  const typeInfo = GYEOKGUK_TYPE_INFO[type];
  const dayInfo = CHEONGAN_INFO[dayMaster];

  return {
    type,
    category: GyeokgukCategory.ILHAENG,
    baseSipseong: null,
    confidence: matchCount === 4 ? 0.90 : 0.75,
    reasoning: `일간 ${dayInfo.hangul}(${dayInfo.hanja}, ${ohaengKorean(dayMasterElement)}) 기준, ` +
      `지지 ${matchCount}개가 ${ohaengKorean(dayMasterElement)} 방합 그룹에 속하고 ` +
      `극하는 ${ohaengKorean(controllingElement)} 천간이 없으므로 ` +
      `${typeInfo.koreanName}(${typeInfo.hanja})으로 판단.`,
    formation: null,
  };
}

