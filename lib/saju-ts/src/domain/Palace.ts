import { Gender } from './Gender.js';
import { PillarPosition } from './PillarPosition.js';
import { Sipseong } from './Sipseong.js';

export interface PalaceInfo {
  readonly position: PillarPosition;
  readonly koreanName: string;
  readonly domain: string;
  readonly agePeriod: string;
  readonly bodyPart: string;
  readonly cheonganAspect: string;
  readonly jijiAspect: string;
}

export interface FamilyRelation {
  readonly sipseong: Sipseong;
  readonly gender: Gender;
  readonly familyMember: string;
  readonly hanja: string;
}

export enum PalaceFavor {
  FAVORABLE = 'FAVORABLE',
  NEUTRAL = 'NEUTRAL',
  UNFAVORABLE = 'UNFAVORABLE',
}

export interface PalaceInterpretation {
  readonly favor: PalaceFavor;
  readonly summary: string;
  readonly detail: string;
}

export interface PalaceAnalysis {
  readonly palaceInfo: PalaceInfo;
  readonly sipseong: Sipseong | null;
  readonly familyRelation: FamilyRelation | null;
  readonly interpretation: PalaceInterpretation | null;
}

