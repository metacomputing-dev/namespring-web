import { Cheongan } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import { Ohaeng } from '../../domain/Ohaeng.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { GyeokgukCategory } from '../../domain/Gyeokguk.js';
import type { GyeokgukResult } from '../../domain/Gyeokguk.js';
import type {
  YongshinRecommendation,
  YongshinResult,
} from '../../domain/YongshinResult.js';
import type { CalculationConfig } from '../../config/CalculationConfig.js';
import { DEFAULT_CONFIG } from '../../config/CalculationConfig.js';
import type { HapHwaEvaluation } from '../../domain/Relations.js';
import {
  assessAgreement,
  deriveGisin,
  deriveGusin,
  resolveAll,
  resolveHeesin,
} from './YongshinDecisionSupport.js';
import {
  byeongyakYongshin,
  eokbuYongshin,
  gyeokgukYongshin,
  hapwhaYongshin,
  ilhaengYongshin,
  jeonwangYongshin,
  johuYongshin,
  tongwanYongshin,
} from './YongshinDeciderStrategies.js';

function pushRecommendation(
  recommendations: YongshinRecommendation[],
  recommendation: YongshinRecommendation | null,
): void {
  if (recommendation != null) {
    recommendations.push(recommendation);
  }
}

function resolveCategoryRecommendation(
  pillars: PillarSet,
  dayMasterOhaeng: Ohaeng,
  config: CalculationConfig,
  gyeokgukResult: GyeokgukResult | null,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): YongshinRecommendation | null {
  if (gyeokgukResult == null) {
    return null;
  }

  switch (gyeokgukResult.category) {
    case GyeokgukCategory.NAEGYEOK:
      return gyeokgukYongshin(dayMasterOhaeng, gyeokgukResult);
    case GyeokgukCategory.JONGGYEOK:
      return jeonwangYongshin(pillars, dayMasterOhaeng, gyeokgukResult, config);
    case GyeokgukCategory.HWAGYEOK:
      return hapwhaYongshin(gyeokgukResult, hapHwaEvaluations);
    case GyeokgukCategory.ILHAENG:
      return ilhaengYongshin(pillars, gyeokgukResult);
  }
}

export function decide(
  pillars: PillarSet,
  isStrong: boolean,
  dayMasterOhaeng: Ohaeng,
  config: CalculationConfig = DEFAULT_CONFIG,
  gyeokgukResult: GyeokgukResult | null = null,
  hapHwaEvaluations: readonly HapHwaEvaluation[] = [],
): YongshinResult {
  const dayMaster: Cheongan = pillars.day.cheongan;
  const monthBranch: Jiji = pillars.month.jiji;

  const eokbu = eokbuYongshin(dayMasterOhaeng, isStrong);
  const johu = johuYongshin(dayMaster, monthBranch);

  const recommendations: YongshinRecommendation[] = [eokbu, johu];
  pushRecommendation(
    recommendations,
    tongwanYongshin(pillars, dayMasterOhaeng, hapHwaEvaluations),
  );
  pushRecommendation(
    recommendations,
    resolveCategoryRecommendation(
      pillars,
      dayMasterOhaeng,
      config,
      gyeokgukResult,
      hapHwaEvaluations,
    ),
  );
  pushRecommendation(
    recommendations,
    byeongyakYongshin(pillars, dayMasterOhaeng, isStrong, hapHwaEvaluations),
  );

  const [finalYongshin, resolvedConfidence] = resolveAll(
    eokbu,
    johu,
    recommendations,
    config,
    gyeokgukResult,
  );
  const finalHeesin = resolveHeesin(finalYongshin, eokbu, johu);
  const gisin = deriveGisin(finalYongshin);
  const gusin = deriveGusin(gisin);
  const agreement = assessAgreement(eokbu, johu);

  return {
    recommendations,
    finalYongshin,
    finalHeesin,
    gisin,
    gusin,
    agreement,
    finalConfidence: resolvedConfidence,
  };
}

export const YongshinDecider = {
  eokbuYongshin,
  johuYongshin,
  tongwanYongshin,
  jeonwangYongshin,
  gyeokgukYongshin,
  byeongyakYongshin,
  hapwhaYongshin,
  ilhaengYongshin,
  decide,
} as const;

