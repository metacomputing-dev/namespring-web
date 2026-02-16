import { Cheongan, CHEONGAN_INFO } from './Cheongan.js';
import { Jiji, JIJI_INFO } from './Jiji.js';

export class Pillar {
  constructor(
    public readonly cheongan: Cheongan,
    public readonly jiji: Jiji,
  ) {}

  get label(): string {
    const ci = CHEONGAN_INFO[this.cheongan];
    const ji = JIJI_INFO[this.jiji];
    return `${ci.hangul}${ci.hanja}${ji.hangul}${ji.hanja}`;
  }

  equals(other: Pillar): boolean {
    return this.cheongan === other.cheongan && this.jiji === other.jiji;
  }

  toString(): string {
    return this.label;
  }
}

