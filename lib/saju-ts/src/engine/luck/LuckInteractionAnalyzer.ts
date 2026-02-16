import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import type { DaeunInfo } from '../../domain/DaeunInfo.js';
import { JIJI_INFO } from '../../domain/Jiji.js';
import type { DaeunAnalysis, LuckPillarAnalysis } from '../../domain/LuckInteraction.js';
import { Ohaeng } from '../../domain/Ohaeng.js';
import { Pillar } from '../../domain/Pillar.js';
import { PillarSet } from '../../domain/PillarSet.js';
import type { SaeunPillar } from '../../domain/SaeunInfo.js';
import { calculateSibiUnseong } from '../analysis/SibiUnseongCalculator.js';
import { determineSipseong } from '../analysis/StrengthSipseongSupport.js';
import {
  buildSummary,
  computeRelationFlags,
  determineLuckQualityInternal,
  findBranchRelations,
  findStemRelations,
  mergeDaeunRelations,
} from './LuckInteractionAnalyzerHelpers.js';

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

function bindLuckPillarAnalyzer(
  natalPillars: PillarSet,
  dayMaster: Cheongan,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
): (pillar: Pillar) => LuckPillarAnalysis {
  return (pillar) => analyzeLuckPillar(pillar, natalPillars, dayMaster, yongshinElement, gisinElement);
}

function analyzeAllDaeun(
  daeunInfo: DaeunInfo,
  natalPillars: PillarSet,
  dayMaster: Cheongan,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
): DaeunAnalysis[] {
  const analyze = bindLuckPillarAnalyzer(natalPillars, dayMaster, yongshinElement, gisinElement);
  return daeunInfo.daeunPillars.map(daeunPillar => ({
    daeunPillar,
    analysis: analyze(daeunPillar.pillar),
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
  const analyze = bindLuckPillarAnalyzer(natalPillars, dayMaster, yongshinElement, gisinElement);
  return saeunPillars.map(saeun => {
    const baseAnalysis = analyze(saeun.pillar);

    if (currentDaeunPillar == null) return baseAnalysis;
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
