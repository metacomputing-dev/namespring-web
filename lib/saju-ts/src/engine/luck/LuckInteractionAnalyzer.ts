import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import type { DaeunInfo } from '../../domain/DaeunInfo.js';
import { JIJI_INFO } from '../../domain/Jiji.js';
import type { DaeunAnalysis, LuckPillarAnalysis } from '../../domain/LuckInteraction.js';
import { Ohaeng, OhaengRelation, OhaengRelations } from '../../domain/Ohaeng.js';
import { Pillar } from '../../domain/Pillar.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { Sipseong } from '../../domain/Sipseong.js';
import type { SaeunPillar } from '../../domain/SaeunInfo.js';
import { calculateSibiUnseong } from '../analysis/SibiUnseongCalculator.js';
import {
  buildSummary,
  computeRelationFlags,
  determineLuckQualityInternal,
  findBranchRelations,
  findStemRelations,
  mergeDaeunRelations,
} from './LuckInteractionAnalyzerHelpers.js';

function determineSipseong(dayMaster: Cheongan, target: Cheongan): Sipseong {
  const dayInfo = CHEONGAN_INFO[dayMaster];
  const targetInfo = CHEONGAN_INFO[target];
  const sameParity = dayInfo.eumyang === targetInfo.eumyang;
  const relation = OhaengRelations.relation(dayInfo.ohaeng, targetInfo.ohaeng);

  switch (relation) {
    case OhaengRelation.BIHWA:
      return sameParity ? Sipseong.BI_GYEON : Sipseong.GYEOB_JAE;
    case OhaengRelation.YEOKSAENG:
      return sameParity ? Sipseong.SIK_SIN : Sipseong.SANG_GWAN;
    case OhaengRelation.SANGGEUK:
      return sameParity ? Sipseong.PYEON_JAE : Sipseong.JEONG_JAE;
    case OhaengRelation.YEOKGEUK:
      return sameParity ? Sipseong.PYEON_GWAN : Sipseong.JEONG_GWAN;
    case OhaengRelation.SANGSAENG:
      return sameParity ? Sipseong.PYEON_IN : Sipseong.JEONG_IN;
  }
}

function analyzeLuckPillar(
  luckPillar: Pillar,
  natalPillars: PillarSet,
  dayMaster: Cheongan,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
): LuckPillarAnalysis {
  const sipseong = determineSipseong(dayMaster, luckPillar.cheongan);
  const sibiUnseong = calculateSibiUnseong(dayMaster, luckPillar.jiji);

  const luckStemOhaeng = CHEONGAN_INFO[luckPillar.cheongan].ohaeng;
  const luckBranchOhaeng = JIJI_INFO[luckPillar.jiji].ohaeng;
  const luckOhaengSet = new Set([luckStemOhaeng, luckBranchOhaeng]);
  const isYongshin = yongshinElement !== null && luckOhaengSet.has(yongshinElement);
  const isGisin = gisinElement !== null && luckOhaengSet.has(gisinElement);

  const stemRelations = findStemRelations(luckPillar.cheongan, natalPillars);
  const branchRelations = findBranchRelations(luckPillar.jiji, natalPillars);
  const { hasGoodRelations, hasBadRelations } = computeRelationFlags(stemRelations, branchRelations);

  const quality = determineLuckQualityInternal(
    luckStemOhaeng,
    yongshinElement,
    gisinElement,
    hasGoodRelations,
    hasBadRelations,
    luckBranchOhaeng,
  );

  return {
    pillar: luckPillar,
    sipseong,
    sibiUnseong,
    isYongshinElement: isYongshin,
    isGisinElement: isGisin,
    stemRelations,
    branchRelations,
    quality,
    summary: buildSummary(luckPillar, sipseong, sibiUnseong, isYongshin, isGisin, quality),
  };
}

function analyzeAllDaeun(
  daeunInfo: DaeunInfo,
  natalPillars: PillarSet,
  dayMaster: Cheongan,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
): DaeunAnalysis[] {
  return daeunInfo.daeunPillars.map(daeunPillar => ({
    daeunPillar,
    analysis: analyzeLuckPillar(
      daeunPillar.pillar,
      natalPillars,
      dayMaster,
      yongshinElement,
      gisinElement,
    ),
    isTransitionPeriod: daeunPillar.order > 1,
  }));
}

function analyzeSaeun(
  saeunPillars: readonly SaeunPillar[],
  natalPillars: PillarSet,
  currentDaeunPillar: Pillar | null,
  dayMaster: Cheongan,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
): LuckPillarAnalysis[] {
  return saeunPillars.map(saeun => {
    const baseAnalysis = analyzeLuckPillar(
      saeun.pillar,
      natalPillars,
      dayMaster,
      yongshinElement,
      gisinElement,
    );

    if (currentDaeunPillar == null) {
      return baseAnalysis;
    }
    return mergeDaeunRelations(
      baseAnalysis,
      saeun.pillar,
      currentDaeunPillar,
      yongshinElement,
      gisinElement,
    );
  });
}

export const LuckInteractionAnalyzer = {
  analyzeLuckPillar,
  analyzeAllDaeun,
  analyzeSaeun,
  determineLuckQuality: determineLuckQualityInternal,
} as const;

