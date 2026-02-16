import { Cheongan } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import { Ohaeng, ohaengKoreanLabel } from '../../domain/Ohaeng.js';
import { PillarPosition } from '../../domain/PillarPosition.js';

export interface HapTableEntry {
  readonly resultOhaeng: Ohaeng;
  readonly hapName: string;
}

export function stemPairKey(a: Cheongan, b: Cheongan): string {
  return [a, b].sort().join('-');
}

export const HAP_TABLE: ReadonlyMap<string, HapTableEntry> = new Map([
  [stemPairKey(Cheongan.GAP, Cheongan.GI),       { resultOhaeng: Ohaeng.EARTH, hapName: '갑기합화토' }],
  [stemPairKey(Cheongan.EUL, Cheongan.GYEONG),   { resultOhaeng: Ohaeng.METAL, hapName: '을경합화금' }],
  [stemPairKey(Cheongan.BYEONG, Cheongan.SIN),   { resultOhaeng: Ohaeng.WATER, hapName: '병신합화수' }],
  [stemPairKey(Cheongan.JEONG, Cheongan.IM),     { resultOhaeng: Ohaeng.WOOD, hapName: '정임합화목' }],
  [stemPairKey(Cheongan.MU, Cheongan.GYE),       { resultOhaeng: Ohaeng.FIRE, hapName: '무계합화화' }],
]);

export const SEASON_SUPPORT: ReadonlyMap<Ohaeng, ReadonlySet<Jiji>> = new Map<Ohaeng, Set<Jiji>>([
  [Ohaeng.WOOD, new Set<Jiji>([Jiji.IN, Jiji.MYO])],
  [Ohaeng.FIRE, new Set<Jiji>([Jiji.SA, Jiji.O])],
  [Ohaeng.EARTH, new Set<Jiji>([Jiji.JIN, Jiji.SUL, Jiji.CHUK, Jiji.MI])],
  [Ohaeng.METAL, new Set<Jiji>([Jiji.SIN, Jiji.YU])],
  [Ohaeng.WATER, new Set<Jiji>([Jiji.HAE, Jiji.JA])],
]);

export function pillarKoreanLabel(pos: PillarPosition): string {
  switch (pos) {
    case PillarPosition.YEAR: return '년간';
    case PillarPosition.MONTH: return '월간';
    case PillarPosition.DAY: return '일간';
    case PillarPosition.HOUR: return '시간';
  }
}

export function ohaengKoreanName(o: Ohaeng): string {
  return ohaengKoreanLabel(o);
}

