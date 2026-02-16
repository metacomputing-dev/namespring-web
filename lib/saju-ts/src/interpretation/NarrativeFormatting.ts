import { Cheongan, CHEONGAN_INFO } from '../domain/Cheongan.js';
import { Jiji, JIJI_INFO } from '../domain/Jiji.js';
import { Ohaeng, OhaengRelations } from '../domain/Ohaeng.js';
import type { Pillar } from '../domain/Pillar.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import type { PillarSet } from '../domain/PillarSet.js';
import { StrengthLevel } from '../domain/StrengthResult.js';

export function formatPillar(p: Pillar): string {
  const ci = CHEONGAN_INFO[p.cheongan];
  const ji = JIJI_INFO[p.jiji];
  return `${ci.hangul}${ji.hangul}(${ci.hanja}${ji.hanja})`;
}

export function stemKorean(c: Cheongan): string {
  const NAMES: Record<Cheongan, string> = {
    [Cheongan.GAP]: '갑목(甲木)', [Cheongan.EUL]: '을목(乙木)',
    [Cheongan.BYEONG]: '병화(丙火)', [Cheongan.JEONG]: '정화(丁火)',
    [Cheongan.MU]: '무토(戊土)', [Cheongan.GI]: '기토(己土)',
    [Cheongan.GYEONG]: '경금(庚金)', [Cheongan.SIN]: '신금(辛金)',
    [Cheongan.IM]: '임수(壬水)', [Cheongan.GYE]: '계수(癸水)',
  };
  return NAMES[c];
}

export function branchKorean(j: Jiji): string {
  const NAMES: Record<Jiji, string> = {
    [Jiji.JA]: '자(子)', [Jiji.CHUK]: '축(丑)',
    [Jiji.IN]: '인(寅)', [Jiji.MYO]: '묘(卯)',
    [Jiji.JIN]: '진(辰)', [Jiji.SA]: '사(巳)',
    [Jiji.O]: '오(午)', [Jiji.MI]: '미(未)',
    [Jiji.SIN]: '신(申)', [Jiji.YU]: '유(酉)',
    [Jiji.SUL]: '술(戌)', [Jiji.HAE]: '해(亥)',
  };
  return NAMES[j];
}

export function ohaengKorean(oh: Ohaeng): string {
  const NAMES: Record<Ohaeng, string> = {
    [Ohaeng.WOOD]: '목(木)', [Ohaeng.FIRE]: '화(火)',
    [Ohaeng.EARTH]: '토(土)', [Ohaeng.METAL]: '금(金)',
    [Ohaeng.WATER]: '수(水)',
  };
  return NAMES[oh];
}

export function positionKorean(pos: PillarPosition): string {
  const NAMES: Record<PillarPosition, string> = {
    [PillarPosition.YEAR]: '년주(年柱)', [PillarPosition.MONTH]: '월주(月柱)',
    [PillarPosition.DAY]: '일주(日柱)', [PillarPosition.HOUR]: '시주(時柱)',
  };
  return NAMES[pos];
}

export function pillarAt(ps: PillarSet, pos: PillarPosition): Pillar {
  switch (pos) {
    case PillarPosition.YEAR: return ps.year;
    case PillarPosition.MONTH: return ps.month;
    case PillarPosition.DAY: return ps.day;
    case PillarPosition.HOUR: return ps.hour;
  }
}

export function strengthLevelKorean(level: StrengthLevel): string {
  const NAMES: Record<StrengthLevel, string> = {
    [StrengthLevel.VERY_STRONG]: '극신강(極身强)',
    [StrengthLevel.STRONG]: '신강(身强)',
    [StrengthLevel.SLIGHTLY_STRONG]: '중강(中强)',
    [StrengthLevel.SLIGHTLY_WEAK]: '중약(中弱)',
    [StrengthLevel.WEAK]: '신약(身弱)',
    [StrengthLevel.VERY_WEAK]: '극신약(極身弱)',
  };
  return NAMES[level];
}

export function ohaengRelationNote(source: Ohaeng, target: Ohaeng): string {
  if (source === target) return `${ohaengKorean(source)} 동일 → 비겁 부조`;
  if (OhaengRelations.generates(source) === target) return `${ohaengKorean(source)}→${ohaengKorean(target)} 상생`;
  if (OhaengRelations.controls(source) === target) return `${ohaengKorean(source)}→${ohaengKorean(target)} 상극`;
  if (OhaengRelations.generatedBy(source) === target) return `${ohaengKorean(target)}→${ohaengKorean(source)} 역생`;
  if (OhaengRelations.controlledBy(source) === target) return `${ohaengKorean(target)}→${ohaengKorean(source)} 역극`;
  return `${ohaengKorean(source)}↔${ohaengKorean(target)}`;
}

