import { Eumyang } from './Eumyang.js';
import { Ohaeng } from './Ohaeng.js';

export enum Cheongan {
  GAP    = 'GAP',
  EUL    = 'EUL',
  BYEONG = 'BYEONG',
  JEONG  = 'JEONG',
  MU     = 'MU',
  GI     = 'GI',
  GYEONG = 'GYEONG',
  SIN    = 'SIN',
  IM     = 'IM',
  GYE    = 'GYE',
}

export interface CheonganInfo {
  readonly hangul: string;
  readonly hanja: string;
  readonly eumyang: Eumyang;
  readonly ohaeng: Ohaeng;
}

export const CHEONGAN_INFO: Record<Cheongan, CheonganInfo> = {
  [Cheongan.GAP]:    { hangul: '갑', hanja: '甲', eumyang: Eumyang.YANG, ohaeng: Ohaeng.WOOD  },
  [Cheongan.EUL]:    { hangul: '을', hanja: '乙', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.WOOD  },
  [Cheongan.BYEONG]: { hangul: '병', hanja: '丙', eumyang: Eumyang.YANG, ohaeng: Ohaeng.FIRE  },
  [Cheongan.JEONG]:  { hangul: '정', hanja: '丁', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.FIRE  },
  [Cheongan.MU]:     { hangul: '무', hanja: '戊', eumyang: Eumyang.YANG, ohaeng: Ohaeng.EARTH },
  [Cheongan.GI]:     { hangul: '기', hanja: '己', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.EARTH },
  [Cheongan.GYEONG]: { hangul: '경', hanja: '庚', eumyang: Eumyang.YANG, ohaeng: Ohaeng.METAL },
  [Cheongan.SIN]:    { hangul: '신', hanja: '辛', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.METAL },
  [Cheongan.IM]:     { hangul: '임', hanja: '壬', eumyang: Eumyang.YANG, ohaeng: Ohaeng.WATER },
  [Cheongan.GYE]:    { hangul: '계', hanja: '癸', eumyang: Eumyang.YIN,  ohaeng: Ohaeng.WATER },
};

export const CHEONGAN_VALUES: readonly Cheongan[] = [
  Cheongan.GAP, Cheongan.EUL, Cheongan.BYEONG, Cheongan.JEONG, Cheongan.MU,
  Cheongan.GI, Cheongan.GYEONG, Cheongan.SIN, Cheongan.IM, Cheongan.GYE,
] as const;

export function cheonganOrdinal(c: Cheongan): number {
  return CHEONGAN_VALUES.indexOf(c);
}

