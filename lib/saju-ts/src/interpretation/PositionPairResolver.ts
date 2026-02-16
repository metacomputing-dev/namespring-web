import { PillarPosition } from '../domain/PillarPosition.js';
import { PositionPair } from './RelationSignificanceData.js';

const PILLAR_POSITION_ORDINALS: Record<PillarPosition, number> = {
  [PillarPosition.YEAR]: 0,
  [PillarPosition.MONTH]: 1,
  [PillarPosition.DAY]: 2,
  [PillarPosition.HOUR]: 3,
};

const POSITION_PAIR_BY_KEY: Readonly<Record<string, PositionPair>> = {
  [`${PillarPosition.YEAR}:${PillarPosition.MONTH}`]: PositionPair.YEAR_MONTH,
  [`${PillarPosition.YEAR}:${PillarPosition.DAY}`]: PositionPair.YEAR_DAY,
  [`${PillarPosition.YEAR}:${PillarPosition.HOUR}`]: PositionPair.YEAR_HOUR,
  [`${PillarPosition.MONTH}:${PillarPosition.DAY}`]: PositionPair.MONTH_DAY,
  [`${PillarPosition.MONTH}:${PillarPosition.HOUR}`]: PositionPair.MONTH_HOUR,
  [`${PillarPosition.DAY}:${PillarPosition.HOUR}`]: PositionPair.DAY_HOUR,
};

export function pairFromPositions(first: PillarPosition, last: PillarPosition): PositionPair | null {
  return POSITION_PAIR_BY_KEY[`${first}:${last}`] ?? null;
}

export function inferPositionPairFromMembers<T>(
  members: ReadonlySet<T>,
  positionedValues: readonly (readonly [PillarPosition, T])[],
): PositionPair | null {
  const matchedPositions = new Set<PillarPosition>();

  for (const [position, value] of positionedValues) {
    if (members.has(value)) {
      matchedPositions.add(position);
    }
  }

  if (matchedPositions.size < 2) {
    return null;
  }

  const sorted = [...matchedPositions].sort(
    (a, b) => PILLAR_POSITION_ORDINALS[a] - PILLAR_POSITION_ORDINALS[b],
  );

  return pairFromPositions(sorted[0]!, sorted[sorted.length - 1]!);
}
