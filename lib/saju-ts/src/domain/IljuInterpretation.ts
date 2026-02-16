import { Pillar } from './Pillar.js';

export interface IljuInterpretation {
  readonly pillar: Pillar;
  readonly nickname: string;
  readonly personality: string;
  readonly relationships: string;
  readonly career: string;
  readonly health: string;
  readonly lifePath: string;
}

