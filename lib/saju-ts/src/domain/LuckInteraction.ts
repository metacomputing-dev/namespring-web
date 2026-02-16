import { DaeunPillar } from './DaeunInfo.js';
import { Pillar } from './Pillar.js';
import { SibiUnseong } from './SibiUnseong.js';
import { Sipseong } from './Sipseong.js';

export enum LuckQuality {
  VERY_FAVORABLE = 'VERY_FAVORABLE',
  FAVORABLE = 'FAVORABLE',
  NEUTRAL = 'NEUTRAL',
  UNFAVORABLE = 'UNFAVORABLE',
  VERY_UNFAVORABLE = 'VERY_UNFAVORABLE',
}

export const LUCK_QUALITY_INFO: Record<LuckQuality, { koreanName: string }> = {
  [LuckQuality.VERY_FAVORABLE]: { koreanName: '대길' },
  [LuckQuality.FAVORABLE]: { koreanName: '길' },
  [LuckQuality.NEUTRAL]: { koreanName: '평' },
  [LuckQuality.UNFAVORABLE]: { koreanName: '흉' },
  [LuckQuality.VERY_UNFAVORABLE]: { koreanName: '대흉' },
};

export interface LuckPillarAnalysis {
  readonly pillar: Pillar;
  readonly sipseong: Sipseong;
  readonly sibiUnseong: SibiUnseong;
  readonly isYongshinElement: boolean;
  readonly isGisinElement: boolean;
  readonly stemRelations: readonly string[];
  readonly branchRelations: readonly string[];
  readonly quality: LuckQuality;
  readonly summary: string;
}

export interface DaeunAnalysis {
  readonly daeunPillar: DaeunPillar;
  readonly analysis: LuckPillarAnalysis;
  readonly isTransitionPeriod: boolean;
}

