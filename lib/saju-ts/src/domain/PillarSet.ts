import { Pillar } from './Pillar.js';

export class PillarSet {
  constructor(
    public readonly year: Pillar,
    public readonly month: Pillar,
    public readonly day: Pillar,
    public readonly hour: Pillar,
  ) {}
}

