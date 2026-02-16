import { PillarPosition } from '../../domain/PillarPosition.js';
import { type Pillar } from '../../domain/Pillar.js';
import { type PillarSet } from '../../domain/PillarSet.js';

const PILLAR_SELECTORS = {
  [PillarPosition.YEAR]: (pillars: PillarSet) => pillars.year,
  [PillarPosition.MONTH]: (pillars: PillarSet) => pillars.month,
  [PillarPosition.DAY]: (pillars: PillarSet) => pillars.day,
  [PillarPosition.HOUR]: (pillars: PillarSet) => pillars.hour,
} as const satisfies Readonly<Record<PillarPosition, (pillars: PillarSet) => Pillar>>;

export function pillarOf(pillars: PillarSet, pos: PillarPosition): Pillar {
  return PILLAR_SELECTORS[pos](pillars);
}

