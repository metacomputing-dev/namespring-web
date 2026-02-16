import { Cheongan } from './Cheongan.js';

export enum StrengthLevel {
  VERY_STRONG = 'VERY_STRONG',
  STRONG = 'STRONG',
  SLIGHTLY_STRONG = 'SLIGHTLY_STRONG',
  SLIGHTLY_WEAK = 'SLIGHTLY_WEAK',
  WEAK = 'WEAK',
  VERY_WEAK = 'VERY_WEAK',
}

export const STRENGTH_LEVEL_INFO: Record<StrengthLevel, { koreanName: string }> = {
  [StrengthLevel.VERY_STRONG]:    { koreanName: '극신강' },
  [StrengthLevel.STRONG]:         { koreanName: '신강' },
  [StrengthLevel.SLIGHTLY_STRONG]:{ koreanName: '중강' },
  [StrengthLevel.SLIGHTLY_WEAK]:  { koreanName: '중약' },
  [StrengthLevel.WEAK]:           { koreanName: '신약' },
  [StrengthLevel.VERY_WEAK]:      { koreanName: '극신약' },
};

export function isStrongSide(level: StrengthLevel): boolean {
  return level === StrengthLevel.VERY_STRONG ||
         level === StrengthLevel.STRONG ||
         level === StrengthLevel.SLIGHTLY_STRONG;
}

export interface StrengthScore {
  readonly deukryeong: number;
  readonly deukji: number;
  readonly deukse: number;
  readonly totalSupport: number;
  readonly totalOppose: number;
}

export interface StrengthResult {
  readonly dayMaster: Cheongan;
  readonly level: StrengthLevel;
  readonly score: StrengthScore;
  readonly isStrong: boolean;
  readonly details: readonly string[];
}

