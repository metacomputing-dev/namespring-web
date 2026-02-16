import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import { Ohaeng, OhaengRelations } from '../../domain/Ohaeng.js';
import { HiddenStemTable, HiddenStemVariant } from '../../domain/HiddenStem.js';
import { Pillar } from '../../domain/Pillar.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { Sipseong } from '../../domain/Sipseong.js';
import type { HiddenStemSipseong, PillarTenGodAnalysis, TenGodAnalysis } from '../../domain/TenGodAnalysis.js';

export const TenGodCalculator = {
    calculate(dayMaster: Cheongan, target: Cheongan): Sipseong {
    const dayInfo = CHEONGAN_INFO[dayMaster];
    const targetInfo = CHEONGAN_INFO[target];
    const sameParity = dayInfo.eumyang === targetInfo.eumyang;
    const dayElement = dayInfo.ohaeng;
    const targetElement = targetInfo.ohaeng;

    if (dayElement === targetElement) {
      return sameParity ? Sipseong.BI_GYEON : Sipseong.GYEOB_JAE;
    }
    if (isProducing(dayElement, targetElement)) {
      return sameParity ? Sipseong.SIK_SIN : Sipseong.SANG_GWAN;
    }
    if (isControlling(dayElement, targetElement)) {
      return sameParity ? Sipseong.PYEON_JAE : Sipseong.JEONG_JAE;
    }
    if (isControlling(targetElement, dayElement)) {
      return sameParity ? Sipseong.PYEON_GWAN : Sipseong.JEONG_GWAN;
    }
    return sameParity ? Sipseong.PYEON_IN : Sipseong.JEONG_IN;
  },

    calculateForBranch(
    dayMaster: Cheongan,
    branch: Jiji,
    variant: HiddenStemVariant = HiddenStemVariant.STANDARD,
  ): Sipseong {
    const principalStem = HiddenStemTable.getPrincipalStem(branch, variant);
    return calculateTenGod(dayMaster, principalStem);
  },

    analyzePillars(
    dayMaster: Cheongan,
    pillars: PillarSet,
    variant: HiddenStemVariant = HiddenStemVariant.STANDARD,
  ): TenGodAnalysis {
    const byPosition: Partial<Record<PillarPosition, PillarTenGodAnalysis>> = {
      [PillarPosition.YEAR]: analyzeSingle(dayMaster, pillars.year, variant),
      [PillarPosition.MONTH]: analyzeSingle(dayMaster, pillars.month, variant),
      [PillarPosition.DAY]: analyzeSingle(dayMaster, pillars.day, variant),
      [PillarPosition.HOUR]: analyzeSingle(dayMaster, pillars.hour, variant),
    };

    return { dayMaster, byPosition };
  },
} as const;

export const calculateTenGod = TenGodCalculator.calculate;
export const calculateTenGodForBranch = TenGodCalculator.calculateForBranch;
export const analyzeTenGodPillars = TenGodCalculator.analyzePillars;


function analyzeSingle(
  dayMaster: Cheongan,
  pillar: Pillar,
  variant: HiddenStemVariant,
): PillarTenGodAnalysis {
  const hiddenStems = HiddenStemTable.getHiddenStems(pillar.jiji, variant);
  const principalSipseong = calculateTenGodForBranch(dayMaster, pillar.jiji, variant);
  const hiddenStemSipseong: HiddenStemSipseong[] = hiddenStems.map(entry => ({
    entry,
    sipseong: calculateTenGod(dayMaster, entry.stem),
  }));

  return {
    cheonganSipseong: calculateTenGod(dayMaster, pillar.cheongan),
    jijiPrincipalSipseong: principalSipseong,
    hiddenStems,
    hiddenStemSipseong,
  };
}

function isProducing(from: Ohaeng, to: Ohaeng): boolean {
  return OhaengRelations.generates(from) === to;
}

function isControlling(from: Ohaeng, to: Ohaeng): boolean {
  return OhaengRelations.controls(from) === to;
}

