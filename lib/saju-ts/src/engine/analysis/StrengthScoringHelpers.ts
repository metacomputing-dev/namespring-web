import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji, JIJI_INFO } from '../../domain/Jiji.js';
import { Ohaeng, OhaengRelation, OhaengRelations, ohaengKoreanLabel } from '../../domain/Ohaeng.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { SIPSEONG_INFO } from '../../domain/Sipseong.js';
import {
  type HiddenStemEntry,
  HiddenStemDayAllocation,
  HiddenStemTable,
} from '../../domain/HiddenStem.js';
import { HiddenStemScope, SaryeongMode } from '../../config/CalculationConfig.js';
import { type HapHwaEvaluation, HapState } from '../../domain/Relations.js';
import { SaryeongDeterminer } from './SaryeongDeterminer.js';
import { formatScore, normalizedDaysSinceJeol } from './StrengthFormattingHelpers.js';
import {
  determineSipseong,
  isBigyeop,
  isInseong,
  isSupportingSipseong,
} from './StrengthSipseongSupport.js';

const DEUKRYEONG_FULL = 40.0;
const DEUKJI_PER_BRANCH = 5.0;
const BRANCH_TOTAL_DAYS = 30.0;
const DEUKSE_BIGYEOP = 7.0;
const DEUKSE_INSEONG = 5.0;

export function scoreDeukryeong(
  dayMaster: Cheongan,
  pillars: PillarSet,
  details: string[],
  maxScore: number = DEUKRYEONG_FULL,
  saryeongMode: SaryeongMode = SaryeongMode.ALWAYS_JEONGGI,
  daysSinceJeol: number | null = null,
  allocation: HiddenStemDayAllocation = HiddenStemDayAllocation.YEONHAE_JAPYEONG,
  proportional: boolean = false,
): number {
  const monthBranch = pillars.month.jiji;

  if (proportional) {
    return scoreDeukryeongProportional(dayMaster, monthBranch, details, maxScore, allocation);
  }

  const effectiveDaysSinceJeol = normalizedDaysSinceJeol(
    saryeongMode, daysSinceJeol, details, '득령',
  );

  let referenceStem: Cheongan;
  let modeLabel: string;

  if (saryeongMode === SaryeongMode.ALWAYS_JEONGGI) {
    referenceStem = HiddenStemTable.getPrincipalStem(monthBranch, undefined, allocation);
    modeLabel = '정기';
  } else {
    const day = effectiveDaysSinceJeol!;
    const saryeong = SaryeongDeterminer.determine(monthBranch, day, undefined, allocation);
    referenceStem = saryeong.commandingStem;
    modeLabel = `사령(${saryeong.commandingRole},${day}일째)`;
  }

  const sipseong = determineSipseong(dayMaster, referenceStem);
  const supports = isSupportingSipseong(sipseong);
  const score = supports ? maxScore : 0.0;

  const ri = CHEONGAN_INFO[referenceStem];
  const bi = JIJI_INFO[monthBranch];
  const si = SIPSEONG_INFO[sipseong];

  details.push(
    `[득령] 월지 ${bi.hangul}(${bi.hanja}) ${modeLabel}=${ri.hangul}(${ri.hanja}) ` +
    `→ ${si.koreanName} → ${supports ? '득령' : '실령'} (${formatScore(score)}점)`,
  );
  return score;
}

export function scoreDeukryeongProportional(
  dayMaster: Cheongan,
  monthBranch: Jiji,
  details: string[],
  maxScore: number,
  allocation: HiddenStemDayAllocation,
): number {
  const hiddenStems = HiddenStemTable.getHiddenStems(monthBranch, undefined, allocation);
  const totalDays = hiddenStems.reduce((sum, e) => sum + e.days, 0);
  if (totalDays === 0) return 0.0;

  const breakdown: string[] = [];
  let supportingDays = 0;

  for (const entry of hiddenStems) {
    const sipseong = determineSipseong(dayMaster, entry.stem);
    const supports = isSupportingSipseong(sipseong);
    if (supports) supportingDays += entry.days;
    const label = supports ? '지지' : '비지지';
    const si = CHEONGAN_INFO[entry.stem];
    const sipInfo = SIPSEONG_INFO[sipseong];
    breakdown.push(`${si.hangul}(${si.hanja})${entry.days}일 ${sipInfo.koreanName}→${label}`);
  }

  const ratio = supportingDays / totalDays;
  const score = maxScore * ratio;

  const bi = JIJI_INFO[monthBranch];
  details.push(
    `[득령·비례] 월지 ${bi.hangul}(${bi.hanja}) 지장간: ` +
    `${breakdown.join(' / ')} → ` +
    `지지율 ${supportingDays}/${totalDays} = ${formatScore(ratio * 100)}% → ` +
    `득령 ${formatScore(score)}점/${formatScore(maxScore)}점`,
  );
  return score;
}

export function scoreDeukji(
  dayMaster: Cheongan,
  pillars: PillarSet,
  details: string[],
  scope: HiddenStemScope = HiddenStemScope.ALL_THREE,
  saryeongMode: SaryeongMode = SaryeongMode.ALWAYS_JEONGGI,
  daysSinceJeol: number | null = null,
  allocation: HiddenStemDayAllocation = HiddenStemDayAllocation.YEONHAE_JAPYEONG,
  perBranch: number = DEUKJI_PER_BRANCH,
): number {
  const effectiveDaysSinceJeol = normalizedDaysSinceJeol(
    saryeongMode, daysSinceJeol, details, '득지',
  );
  const branches: [string, Jiji][] = [['년지', pillars.year.jiji], ['월지', pillars.month.jiji], ['일지', pillars.day.jiji], ['시지', pillars.hour.jiji]];

  let total = 0.0;
  for (const [label, branch] of branches) {
    const hiddenStems = HiddenStemTable.getHiddenStems(branch, undefined, allocation);
    const filteredStems: readonly HiddenStemEntry[] =
      scope === HiddenStemScope.ALL_THREE ? hiddenStems
        : scope === HiddenStemScope.SARYEONG_BASED && label === '월지' && effectiveDaysSinceJeol !== null
          ? [hiddenStems.find(e => e.stem === SaryeongDeterminer.determine(
              branch, effectiveDaysSinceJeol, undefined, allocation,
            ).commandingStem)!]
          : [hiddenStems[hiddenStems.length - 1]!];

    let branchScore = 0.0;
    const stemDetails: string[] = [];

    for (const entry of filteredStems) {
      const sipseong = determineSipseong(dayMaster, entry.stem);
      if (isSupportingSipseong(sipseong)) {
        const contribution = (entry.days / BRANCH_TOTAL_DAYS) * perBranch;
        branchScore += contribution;
        const sipInfo = SIPSEONG_INFO[sipseong];
        stemDetails.push(
          `${CHEONGAN_INFO[entry.stem].hangul}(${sipInfo.koreanName},${entry.days}일)=${formatScore(contribution)}`,
        );
      }
    }

    total += branchScore;
    const bi = JIJI_INFO[branch];
    if (stemDetails.length > 0) {
      details.push(
        `[득지] ${label} ${bi.hangul}(${bi.hanja}): ${stemDetails.join(' + ')} = ${formatScore(branchScore)}점`,
      );
    } else {
      details.push(`[득지] ${label} ${bi.hangul}(${bi.hanja}): 부조 없음`);
    }
  }

  details.push(`[득지] 합계: ${formatScore(total)}점`);
  return total;
}

export function scoreDeukse(
  dayMaster: Cheongan,
  pillars: PillarSet,
  details: string[],
  hapHwaEvaluations: readonly HapHwaEvaluation[] = [],
  bigyeop: number = DEUKSE_BIGYEOP,
  inseong: number = DEUKSE_INSEONG,
): number {
  const stems: [string, Cheongan, PillarPosition][] = [['년간', pillars.year.cheongan, PillarPosition.YEAR], ['월간', pillars.month.cheongan, PillarPosition.MONTH], ['시간', pillars.hour.cheongan, PillarPosition.HOUR]];

  let total = 0.0;
  for (const [label, stem, pos] of stems) {
    const activeHap = hapHwaEvaluations.find(
      eval_ =>
        eval_.state !== HapState.NOT_ESTABLISHED &&
        (eval_.position1 === pos || eval_.position2 === pos),
    ) ?? null;

    let score: number;
    let supportDesc: string;

    const ci = CHEONGAN_INFO[stem];

    if (activeHap?.state === HapState.HAPGEO) {
      score = 0.0;
      supportDesc = `${ci.hangul} → 합거(合去)로 기능 상실, 부조 불가`;
    } else if (activeHap?.state === HapState.HAPWHA) {
      const effectiveOhaeng = activeHap.resultOhaeng;
      const effectiveScore = scoreOhaengSupport(
        CHEONGAN_INFO[dayMaster].ohaeng, effectiveOhaeng, bigyeop, inseong,
      );
      const oLabel = ohaengLabel(effectiveOhaeng);
      supportDesc = `${ci.hangul} → 합화(合化)로 ${oLabel}으로 변환` +
        (effectiveScore > 0 ? ` → +${formatScore(effectiveScore)}점` : ' → 부조 아님');
      score = effectiveScore;
    } else {
      const sipseong = determineSipseong(dayMaster, stem);
      const sipInfo = SIPSEONG_INFO[sipseong];
      score = isBigyeop(sipseong) ? bigyeop : isInseong(sipseong) ? inseong : 0.0;
      supportDesc = score > 0 ? `${sipInfo.koreanName} → +${formatScore(score)}점` : `${sipInfo.koreanName} → 부조 아님`;
    }

    total += score;
    details.push(`[득세] ${label} ${ci.hangul}(${ci.hanja}): ${supportDesc}`);
  }

  details.push(`[득세] 합계: ${formatScore(total)}점`);
  return total;
}

export function scoreOhaengSupport(
  dayMasterOhaeng: Ohaeng,
  targetOhaeng: Ohaeng,
  bigyeop: number = DEUKSE_BIGYEOP,
  inseong: number = DEUKSE_INSEONG,
): number {
  const relation = OhaengRelations.relation(dayMasterOhaeng, targetOhaeng);
  return relation === OhaengRelation.BIHWA ? bigyeop
    : relation === OhaengRelation.SANGSAENG ? inseong
      : 0.0;
}

export function ohaengLabel(ohaeng: Ohaeng): string {
  return ohaengKoreanLabel(ohaeng);
}

