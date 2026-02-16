import { Jiji } from '../domain/Jiji.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import { PillarSet } from '../domain/PillarSet.js';
import { JijiRelationType } from '../domain/Relations.js';
import {
  POSITION_PAIR_INFO,
  PositionPair,
  SIGNIFICANCE_TABLE,
  tableKey,
} from './RelationSignificanceData.js';
import { inferPositionPairFromMembers } from './PositionPairResolver.js';

export { POSITION_PAIR_INFO, PositionPair } from './RelationSignificanceData.js';
export type { PositionPairInfo } from './RelationSignificanceData.js';

export interface Significance {
  readonly positionPairLabel: string;
  readonly affectedDomains: readonly string[];
  readonly meaning: string;
  readonly ageWindow: string;
  readonly isPositive: boolean;
}

export function inferPositionPair(members: ReadonlySet<Jiji>, pillars: PillarSet): PositionPair | null {
  return inferPositionPairFromMembers(members, [
    [PillarPosition.YEAR, pillars.year.jiji],
    [PillarPosition.MONTH, pillars.month.jiji],
    [PillarPosition.DAY, pillars.day.jiji],
    [PillarPosition.HOUR, pillars.hour.jiji],
  ] as const);
}

function lookupSignificance(type: JijiRelationType, posPair: PositionPair): Significance {
  const significance = SIGNIFICANCE_TABLE.get(tableKey(type, posPair));
  if (!significance) {
    throw new Error(`Missing RelationSignificance entry: ${type}+${posPair}`);
  }
  return significance;
}

export const RelationSignificanceInterpreter = {
  interpret(
    relationType: JijiRelationType,
    members: ReadonlySet<Jiji>,
    pillars: PillarSet,
  ): Significance | null {
    const posPair = inferPositionPair(members, pillars);
    if (posPair === null) return null;
    return lookupSignificance(relationType, posPair);
  },

  interpretWithPair(
    relationType: JijiRelationType,
    posPair: PositionPair,
  ): Significance {
    return lookupSignificance(relationType, posPair);
  },
} as const;
