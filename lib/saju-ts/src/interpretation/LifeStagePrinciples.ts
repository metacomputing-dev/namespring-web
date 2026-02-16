import { Cheongan, CHEONGAN_INFO } from '../domain/Cheongan.js';
import { Eumyang } from '../domain/Eumyang.js';
import { Jiji } from '../domain/Jiji.js';
import { Ohaeng } from '../domain/Ohaeng.js';
import { SibiUnseong, SIBI_UNSEONG_INFO } from '../domain/SibiUnseong.js';
import {
  type CalculationConfig,
  EarthLifeStageRule,
} from '../config/CalculationConfig.js';
import { branchKorean, ohaengKorean } from './NarrativeFormatting.js';

export function sibiUnseongPrinciple(
  dayMaster: Cheongan,
  branch: Jiji,
  unseong: SibiUnseong,
  config: CalculationConfig,
): string {
  const ci = CHEONGAN_INFO[dayMaster];
  const eumyang = ci.eumyang === Eumyang.YANG ? '양' : '음';
  const dmOh = ohaengKorean(ci.ohaeng);
  const jsBranch = jangSaengBranchFor(dayMaster, config);
  const reason = jangSaengReason(dayMaster, config);
  const direction = (config.yinReversalEnabled && ci.eumyang === Eumyang.YIN) ? '역행' : '순행';
  const stage = SIBI_UNSEONG_INFO[unseong].stage;
  const offset = stage - 1;

  let result = `원리: ${ci.hangul}(${eumyang}${dmOh})의 장생지=${branchKorean(jsBranch)} [${reason}]`;
  if (offset === 0) {
    result += ` → ${branchKorean(branch)}이 바로 장생지`;
  } else {
    result += ` → ${branchKorean(branch)}은 ${direction} ${offset}번째`;
  }
  return result;
}

export function jangSaengBranchFor(dayMaster: Cheongan, config: CalculationConfig): Jiji {
  const isFollowWater = config.earthLifeStageRule === EarthLifeStageRule.FOLLOW_WATER;
  const BRANCHES: Record<Cheongan, Jiji> = {
    [Cheongan.GAP]: Jiji.HAE,
    [Cheongan.EUL]: Jiji.O,
    [Cheongan.BYEONG]: Jiji.IN,
    [Cheongan.JEONG]: Jiji.YU,
    [Cheongan.MU]: isFollowWater ? Jiji.SIN : Jiji.IN,
    [Cheongan.GI]: isFollowWater ? Jiji.MYO : Jiji.YU,
    [Cheongan.GYEONG]: Jiji.SA,
    [Cheongan.SIN]: Jiji.JA,
    [Cheongan.IM]: Jiji.SIN,
    [Cheongan.GYE]: Jiji.MYO,
  };
  return BRANCHES[dayMaster];
}

export function jangSaengReason(dayMaster: Cheongan, config: CalculationConfig): string {
  if (CHEONGAN_INFO[dayMaster].ohaeng === Ohaeng.EARTH) {
    return config.earthLifeStageRule === EarthLifeStageRule.FOLLOW_WATER ? '수토동법(水土同法)' : '화토동법(火土同法)';
  }
  const REASONS: Record<Cheongan, string> = {
    [Cheongan.GAP]: '수생목(水生木)', [Cheongan.EUL]: '양순음역(陽順陰逆)',
    [Cheongan.BYEONG]: '목생화(木生火)', [Cheongan.JEONG]: '양순음역(陽順陰逆)',
    [Cheongan.MU]: '', [Cheongan.GI]: '',
    [Cheongan.GYEONG]: '토생금(土生金)', [Cheongan.SIN]: '양순음역(陽順陰逆)',
    [Cheongan.IM]: '금생수(金生水)', [Cheongan.GYE]: '양순음역(陽順陰逆)',
  };
  return REASONS[dayMaster];
}

