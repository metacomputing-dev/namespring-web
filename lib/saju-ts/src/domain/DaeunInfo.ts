import { Pillar } from './Pillar.js';

export interface DaeunPillar {
  readonly pillar: Pillar;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
}

export enum DaeunBoundaryMode {
  EXACT_TABLE = 'EXACT_TABLE',
  VSOP87D_CALCULATED = 'VSOP87D_CALCULATED',
  APPROXIMATE_DAY6 = 'APPROXIMATE_DAY6',
}

export interface DaeunInfo {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  readonly daeunPillars: readonly DaeunPillar[];
  readonly boundaryMode: DaeunBoundaryMode;
  readonly warnings: readonly string[];
  readonly firstDaeunStartMonths: number;
}

