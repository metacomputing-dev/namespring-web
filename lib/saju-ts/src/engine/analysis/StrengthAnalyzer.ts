import { PillarSet } from '../../domain/PillarSet.js';
import {
  type CalculationConfig,
  DEFAULT_CONFIG,
} from '../../config/CalculationConfig.js';
import {
  type StrengthResult,
  STRENGTH_LEVEL_INFO,
  isStrongSide,
} from '../../domain/StrengthResult.js';
import { type HapHwaEvaluation } from '../../domain/Relations.js';
import { classifyLevel, formatScore } from './StrengthFormattingHelpers.js';
import {
  scoreDeukji,
  scoreDeukryeong,
  scoreDeukse,
} from './StrengthScoringHelpers.js';
import {
  determineSipseong,
  isSupportingSipseong,
} from './StrengthSipseongSupport.js';

export function analyze(
  pillars: PillarSet,
  config: CalculationConfig = DEFAULT_CONFIG,
  daysSinceJeol: number | null = null,
  hapHwaEvaluations: readonly HapHwaEvaluation[] = [],
): StrengthResult {
  const dayMaster = pillars.day.cheongan;
  const details: string[] = [];
  const deukryeongMax = config.deukryeongWeight;
  const threshold = config.strengthThreshold;
  const scope = config.hiddenStemScopeForStrength;
  const deukjiMax = config.deukjiPerBranch;
  const bigyeopScore = config.deukseBigyeop;
  const inseongScore = config.deukseInseong;
  const allocation = config.hiddenStemDayAllocation;

  const deukryeong = scoreDeukryeong(
    dayMaster, pillars, details, deukryeongMax,
    config.saryeongMode, daysSinceJeol, allocation,
    config.proportionalDeukryeong,
  );
  const deukji = scoreDeukji(
    dayMaster, pillars, details, scope,
    config.saryeongMode, daysSinceJeol, allocation, deukjiMax,
  );
  const deukse = scoreDeukse(
    dayMaster, pillars, details, hapHwaEvaluations,
    bigyeopScore, inseongScore,
  );

  const totalSupport = deukryeong + deukji + deukse;
  const totalOppose = deukryeongMax + (deukjiMax * 4) + (bigyeopScore * 3) - totalSupport;
  const level = classifyLevel(totalSupport, threshold, deukryeongMax, deukjiMax, bigyeopScore);
  const isStrong = isStrongSide(level);

  details.push('---');
  details.push(
    `총 부조 점수: ${formatScore(totalSupport)} / 득령 ${formatScore(deukryeong)} + 득지 ${formatScore(deukji)} + 득세 ${formatScore(deukse)}`,
  );
  details.push(`판정: ${STRENGTH_LEVEL_INFO[level].koreanName} (${isStrong ? '신강' : '신약'})`);

  return {
    dayMaster,
    level,
    score: {
      deukryeong,
      deukji,
      deukse,
      totalSupport,
      totalOppose: Math.max(totalOppose, 0.0),
    },
    isStrong,
    details,
  };
}

export const StrengthAnalyzer = {
  analyze,
  determineSipseong,
  isSupportingSipseong,
} as const;
