import { Pillar } from './Pillar.js';

export interface SaeunPillar {
  readonly year: number;
  readonly pillar: Pillar;
}

export interface WolunPillar {
  readonly year: number;
  readonly sajuMonthIndex: number;
  readonly pillar: Pillar;
  readonly boundaryMoment?: JeolBoundaryMoment;
}

export interface JeolBoundaryMoment {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

