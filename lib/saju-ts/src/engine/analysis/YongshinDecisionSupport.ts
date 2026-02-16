import { CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Ohaeng, OhaengRelations, ohaengKoreanLabel } from '../../domain/Ohaeng.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { HiddenStemTable } from '../../domain/HiddenStem.js';
import {
  GyeokgukCategory,
} from '../../domain/Gyeokguk.js';
import type { GyeokgukResult } from '../../domain/Gyeokguk.js';
import {
  YongshinType,
  YongshinAgreement,
  YONGSHIN_AGREEMENT_INFO,
} from '../../domain/YongshinResult.js';
import type {
  YongshinRecommendation,
} from '../../domain/YongshinResult.js';
import {
  YongshinPriority,
} from '../../config/CalculationConfig.js';
import type { CalculationConfig } from '../../config/CalculationConfig.js';
import { HapState } from '../../domain/Relations.js';
import type { HapHwaEvaluation } from '../../domain/Relations.js';
import { SipseongCategory } from './YongshinRuleCatalog.js';

export function categoryToOhaeng(category: SipseongCategory, dayMasterOhaeng: Ohaeng): Ohaeng {
  switch (category) {
    case SipseongCategory.BIGYEOP: return dayMasterOhaeng;
    case SipseongCategory.SIKSANG: return OhaengRelations.generates(dayMasterOhaeng);
    case SipseongCategory.JAE:     return OhaengRelations.controls(dayMasterOhaeng);
    case SipseongCategory.GWAN:    return OhaengRelations.controlledBy(dayMasterOhaeng);
    case SipseongCategory.INSEONG: return OhaengRelations.generatedBy(dayMasterOhaeng);
  }
}


export function ohaengKorean(ohaeng: Ohaeng): string {
  return ohaengKoreanLabel(ohaeng);
}


export function countChartElements(
  pillars: PillarSet,
  hapHwaEvaluations: readonly HapHwaEvaluation[] = [],
): Map<Ohaeng, number> {
  const elements: Ohaeng[] = [];

  const activeHapByPosition = new Map<PillarPosition, HapHwaEvaluation>();
  for (const evalItem of hapHwaEvaluations) {
    if (evalItem.state !== HapState.NOT_ESTABLISHED) {
      activeHapByPosition.set(evalItem.position1, evalItem);
      activeHapByPosition.set(evalItem.position2, evalItem);
    }
  }

  const stemPositions: Array<[PillarPosition, { ohaeng: Ohaeng }]> = [
    [PillarPosition.YEAR, { ohaeng: CHEONGAN_INFO[pillars.year.cheongan].ohaeng }],
    [PillarPosition.MONTH, { ohaeng: CHEONGAN_INFO[pillars.month.cheongan].ohaeng }],
    [PillarPosition.HOUR, { ohaeng: CHEONGAN_INFO[pillars.hour.cheongan].ohaeng }],
  ];

  for (const [pos, stemInfo] of stemPositions) {
    const activeHap = activeHapByPosition.get(pos);
    if (activeHap?.state === HapState.HAPWHA) {
      elements.push(activeHap.resultOhaeng);
    } else if (activeHap?.state === HapState.HAPGEO) {
    } else {
      elements.push(stemInfo.ohaeng);
    }
  }

  elements.push(CHEONGAN_INFO[HiddenStemTable.getPrincipalStem(pillars.year.jiji)].ohaeng);
  elements.push(CHEONGAN_INFO[HiddenStemTable.getPrincipalStem(pillars.month.jiji)].ohaeng);
  elements.push(CHEONGAN_INFO[HiddenStemTable.getPrincipalStem(pillars.day.jiji)].ohaeng);
  elements.push(CHEONGAN_INFO[HiddenStemTable.getPrincipalStem(pillars.hour.jiji)].ohaeng);

  const counts = new Map<Ohaeng, number>();
  for (const el of elements) {
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  return counts;
}


export function assessAgreement(
  eokbu: YongshinRecommendation,
  johu: YongshinRecommendation,
): YongshinAgreement {
  if (eokbu.primaryElement === johu.primaryElement) {
    return YongshinAgreement.FULL_AGREE;
  }
  if (
    eokbu.secondaryElement === johu.primaryElement ||
    johu.secondaryElement === eokbu.primaryElement
  ) {
    return YongshinAgreement.PARTIAL_AGREE;
  }
  return YongshinAgreement.DISAGREE;
}


export function resolveFinal(
  eokbu: YongshinRecommendation,
  johu: YongshinRecommendation,
  priority: YongshinPriority = YongshinPriority.JOHU_FIRST,
): Ohaeng {
  if (eokbu.primaryElement === johu.primaryElement) {
    return eokbu.primaryElement;
  }

  if (eokbu.secondaryElement === johu.primaryElement) {
    return johu.primaryElement;
  }
  if (johu.secondaryElement === eokbu.primaryElement) {
    return eokbu.primaryElement;
  }

  switch (priority) {
    case YongshinPriority.JOHU_FIRST:
      return johu.primaryElement;
    case YongshinPriority.EOKBU_FIRST:
      return eokbu.primaryElement;
    case YongshinPriority.EQUAL_WEIGHT:
      return johu.confidence >= eokbu.confidence
        ? johu.primaryElement
        : eokbu.primaryElement;
  }
}

function agreementBonus(
  specialElement: Ohaeng,
  eokbu: YongshinRecommendation,
  johu: YongshinRecommendation,
): number {
  if (specialElement === eokbu.primaryElement || specialElement === johu.primaryElement) return 0.15;
  if (specialElement === eokbu.secondaryElement || specialElement === johu.secondaryElement) return 0.05;
  return 0.0;
}

const GYEOKGUK_OVERRIDE_RULES = [
  [YongshinType.HAPWHA_YONGSHIN, GyeokgukCategory.HWAGYEOK],
  [YongshinType.ILHAENG_YONGSHIN, GyeokgukCategory.ILHAENG],
  [YongshinType.JEONWANG, GyeokgukCategory.JONGGYEOK],
] as const;

export function resolveAll(
  eokbu: YongshinRecommendation,
  johu: YongshinRecommendation,
  recommendations: readonly YongshinRecommendation[],
  config: CalculationConfig,
  gyeokgukResult: GyeokgukResult | null,
): [Ohaeng, number] {
  const recommendationsByType = new Map<YongshinType, YongshinRecommendation>();
  for (const recommendation of recommendations) {
    if (!recommendationsByType.has(recommendation.type)) recommendationsByType.set(recommendation.type, recommendation);
  }

  if (gyeokgukResult) {
    for (const [recommendationType, category] of GYEOKGUK_OVERRIDE_RULES) {
      if (category !== gyeokgukResult.category) continue;

      const recommendation = recommendationsByType.get(recommendationType);
      if (!recommendation) continue;

      const bonus = agreementBonus(recommendation.primaryElement, eokbu, johu);
      return [recommendation.primaryElement, Math.min(recommendation.confidence + bonus, 0.95)];
    }
  }

  const tongwanRec = recommendationsByType.get(YongshinType.TONGGWAN);
  if (tongwanRec && eokbu.primaryElement !== johu.primaryElement) {
    return [tongwanRec.primaryElement, tongwanRec.confidence];
  }

  const baseAgreement = assessAgreement(eokbu, johu);

  const gyeokgukRec = recommendationsByType.get(YongshinType.GYEOKGUK);
  if (gyeokgukRec && eokbu.primaryElement !== johu.primaryElement) {
    if (gyeokgukRec.primaryElement === eokbu.primaryElement) {
      return [eokbu.primaryElement, 0.70];
    }
    if (gyeokgukRec.primaryElement === johu.primaryElement) {
      return [johu.primaryElement, 0.70];
    }
  }

  const baseResult = resolveFinal(eokbu, johu, config.yongshinPriority);
  return [baseResult, YONGSHIN_AGREEMENT_INFO[baseAgreement].confidence];
}


export function resolveHeesin(
  finalYongshin: Ohaeng,
  eokbu: YongshinRecommendation,
  johu: YongshinRecommendation,
): Ohaeng | null {
  for (const candidate of new Set([johu.secondaryElement, eokbu.secondaryElement])) {
    if (candidate != null && candidate !== finalYongshin) return candidate;
  }

  const otherPrimary = finalYongshin === johu.primaryElement
    ? eokbu.primaryElement
    : johu.primaryElement;

  if (otherPrimary !== finalYongshin) {
    return otherPrimary;
  }

  return OhaengRelations.generatedBy(finalYongshin);
}


export function deriveGisin(yongshin: Ohaeng): Ohaeng {
  return OhaengRelations.controlledBy(yongshin);
}

export function deriveGusin(gisin: Ohaeng): Ohaeng {
  return OhaengRelations.generatedBy(gisin);
}


