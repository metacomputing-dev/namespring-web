import { Cheongan } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import {
  GyeokgukCategory,
  GyeokgukResult,
  gyeokgukFromSipseong,
} from '../../domain/Gyeokguk.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { StrengthResult } from '../../domain/StrengthResult.js';
import { HiddenStemRole, HiddenStemTable } from '../../domain/HiddenStem.js';
import { Sipseong } from '../../domain/Sipseong.js';
import { HapHwaEvaluation, HapState } from '../../domain/Relations.js';
import { CalculationConfig, DEFAULT_CONFIG } from '../../config/CalculationConfig.js';
import { TenGodCalculator } from './TenGodCalculator.js';
import { checkHwagyeok, checkIlhaengDeukgi, checkJongGyeok } from './GyeokgukDeterminerRules.js';
import { buildNaegyeokReasoning, buildTouchulReasoning } from './GyeokgukDeterminerReasoning.js';

















function determineNaegyeok(
  dayMaster: Cheongan,
  monthBranch: Jiji,
  pillars: PillarSet,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): GyeokgukResult {
  const hiddenStems = HiddenStemTable.getHiddenStems(monthBranch);

  const hapGeoPositions = new Set<PillarPosition>();
  for (const eval_ of hapHwaEvaluations) {
    if (eval_.state === HapState.HAPGEO) {
      hapGeoPositions.add(eval_.position1);
      hapGeoPositions.add(eval_.position2);
    }
  }

  const chartStems = new Set<Cheongan>();
  if (!hapGeoPositions.has(PillarPosition.YEAR))  chartStems.add(pillars.year.cheongan);
  if (!hapGeoPositions.has(PillarPosition.MONTH)) chartStems.add(pillars.month.cheongan);
  if (!hapGeoPositions.has(PillarPosition.HOUR))  chartStems.add(pillars.hour.cheongan);

  const priorityOrder = [HiddenStemRole.JEONGGI, HiddenStemRole.JUNGGI, HiddenStemRole.YEOGI];

  for (const role of priorityOrder) {
    const entry = hiddenStems.find(e => e.role === role);
    if (!entry) continue;
    if (chartStems.has(entry.stem)) {
      const sipseong = TenGodCalculator.calculate(dayMaster, entry.stem);
      const type = gyeokgukFromSipseong(sipseong);
      return {
        type,
        category: GyeokgukCategory.NAEGYEOK,
        baseSipseong: sipseong,
        confidence: role === HiddenStemRole.JEONGGI ? 1.0 : 0.90,
        reasoning: buildTouchulReasoning(dayMaster, monthBranch, entry.stem, role, sipseong, type),
        formation: null,
      };
    }
  }

  const principalStem = HiddenStemTable.getPrincipalStem(monthBranch);
  const sipseong = TenGodCalculator.calculate(dayMaster, principalStem);
  const type = gyeokgukFromSipseong(sipseong);

  return {
    type,
    category: GyeokgukCategory.NAEGYEOK,
    baseSipseong: sipseong,
    confidence: 1.0,
    reasoning: buildNaegyeokReasoning(dayMaster, monthBranch, sipseong, type),
    formation: null,
  };
}


export const GyeokgukDeterminer = {
    determine(
    pillars: PillarSet,
    strengthResult: StrengthResult | null = null,
    hapHwaEvaluations: readonly HapHwaEvaluation[] = [],
    config: CalculationConfig = DEFAULT_CONFIG,
  ): GyeokgukResult {
    const dayMaster = pillars.day.cheongan;
    const monthBranch = pillars.month.jiji;

    if (hapHwaEvaluations.length > 0) {
      const hwagyeok = checkHwagyeok(hapHwaEvaluations);
      if (hwagyeok != null) return hwagyeok;
    }

    if (strengthResult != null) {
      const jongResult = checkJongGyeok(pillars, dayMaster, strengthResult, config, hapHwaEvaluations);
      if (jongResult != null) return jongResult;
    }

    const ilhaeng = checkIlhaengDeukgi(pillars, dayMaster, hapHwaEvaluations);
    if (ilhaeng != null) return ilhaeng;

    return determineNaegyeok(dayMaster, monthBranch, pillars, hapHwaEvaluations);
  },

    monthBranchSipseong(dayMaster: Cheongan, monthBranch: Jiji): Sipseong {
    const principalStem = HiddenStemTable.getPrincipalStem(monthBranch);
    return TenGodCalculator.calculate(dayMaster, principalStem);
  },
} as const;

export const determineGyeokguk = GyeokgukDeterminer.determine;
export const monthBranchSipseong = GyeokgukDeterminer.monthBranchSipseong;

