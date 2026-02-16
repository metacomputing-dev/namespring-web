import { Cheongan } from '../domain/Cheongan.js';
import { Jiji } from '../domain/Jiji.js';
import { Pillar } from '../domain/Pillar.js';
import { IljuInterpretation } from '../domain/IljuInterpretation.js';
import { registerIljuCatalog } from './IljuInterpretationCatalog.js';

function key(c: Cheongan, j: Jiji): string {
  return `${c}:${j}`;
}

const TABLE = new Map<string, IljuInterpretation>();

function add(
  c: Cheongan, j: Jiji, nickname: string,
  personality: string, relationships: string,
  career: string, health: string, lifePath: string,
): void {
  TABLE.set(key(c, j), {
    pillar: new Pillar(c, j),
    nickname, personality, relationships, career, health, lifePath,
  });
}

registerIljuCatalog(add);

export function interpretIlju(pillar: Pillar): IljuInterpretation {
  const result = TABLE.get(key(pillar.cheongan, pillar.jiji));
  if (!result) {
    throw new Error(`Invalid day pillar: ${pillar.cheongan}${pillar.jiji} -- not one of 60 valid combinations`);
  }
  return result;
}

export const IljuInterpreter = {
  interpret: interpretIlju,
} as const;

