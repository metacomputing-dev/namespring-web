import { Jiji } from '../domain/Jiji.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import { PillarSet } from '../domain/PillarSet.js';
import { JijiRelationType } from '../domain/Relations.js';
import {
  POSITION_PAIR_INFO,
  PositionPair,
  type SignificanceEntry as Significance,
  SIGNIFICANCE_TABLE,
  tableKey,
} from './RelationSignificanceData.js';
import { inferPositionPairFromMembers } from './PositionPairResolver.js';

export { POSITION_PAIR_INFO, PositionPair } from './RelationSignificanceData.js';
export type { PositionPairInfo } from './RelationSignificanceData.js';

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

export function interpretRelationSignificance(
  relationType: JijiRelationType,
  members: ReadonlySet<Jiji>,
  pillars: PillarSet,
): Significance | null {
  const posPair = inferPositionPair(members, pillars);
  if (posPair === null) return null;
  return lookupSignificance(relationType, posPair);
}

export function interpretRelationSignificanceWithPair(
  relationType: JijiRelationType,
  posPair: PositionPair,
): Significance {
  return lookupSignificance(relationType, posPair);
}

export const RelationSignificanceInterpreter = {
  interpret: interpretRelationSignificance,
  interpretWithPair: interpretRelationSignificanceWithPair,
} as const;
