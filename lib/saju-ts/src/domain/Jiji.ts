import { Eumyang } from './Eumyang.js';
import { Ohaeng } from './Ohaeng.js';

export enum Jiji {
  JA   = 'JA',
  CHUK = 'CHUK',
  IN   = 'IN',
  MYO  = 'MYO',
  JIN  = 'JIN',
  SA   = 'SA',
  O    = 'O',
  MI   = 'MI',
  SIN  = 'SIN',
  YU   = 'YU',
  SUL  = 'SUL',
  HAE  = 'HAE',
}

export interface JijiInfo {
  readonly hangul: string;
  readonly hanja: string;
  readonly eumyang: Eumyang;
  readonly ohaeng: Ohaeng;
}

export const JIJI_INFO: Record<Jiji, JijiInfo> = {
  [Jiji.JA]:   { hangul: '자', hanja: '子', eumyang: Eumyang.YANG, ohaeng: Ohaeng.WATER },
  [Jiji.CHUK]: { hangul: '축', hanja: '丑', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.EARTH },
  [Jiji.IN]:   { hangul: '인', hanja: '寅', eumyang: Eumyang.YANG, ohaeng: Ohaeng.WOOD  },
  [Jiji.MYO]:  { hangul: '묘', hanja: '卯', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.WOOD  },
  [Jiji.JIN]:  { hangul: '진', hanja: '辰', eumyang: Eumyang.YANG, ohaeng: Ohaeng.EARTH },
  [Jiji.SA]:   { hangul: '사', hanja: '巳', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.FIRE  },
  [Jiji.O]:    { hangul: '오', hanja: '午', eumyang: Eumyang.YANG, ohaeng: Ohaeng.FIRE  },
  [Jiji.MI]:   { hangul: '미', hanja: '未', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.EARTH },
  [Jiji.SIN]:  { hangul: '신', hanja: '申', eumyang: Eumyang.YANG, ohaeng: Ohaeng.METAL },
  [Jiji.YU]:   { hangul: '유', hanja: '酉', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.METAL },
  [Jiji.SUL]:  { hangul: '술', hanja: '戌', eumyang: Eumyang.YANG, ohaeng: Ohaeng.EARTH },
  [Jiji.HAE]:  { hangul: '해', hanja: '亥', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.WATER },
};

export const JIJI_VALUES: readonly Jiji[] = [
  Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.SA,
  Jiji.O, Jiji.MI, Jiji.SIN, Jiji.YU, Jiji.SUL, Jiji.HAE,
] as const;

export function jijiOrdinal(j: Jiji): number {
  return JIJI_VALUES.indexOf(j);
}

