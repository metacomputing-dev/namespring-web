import { PillarPosition } from '../../domain/PillarPosition.js';
import {
  CompositeInteractionType,
  COMPOSITE_INTERACTION_INFO,
  type ShinsalComposite,
  type WeightedShinsalHit,
} from '../../domain/Relations.js';
import { ShinsalHit, ShinsalType } from '../../domain/Shinsal.js';
import rawWeightTable from './data/shinsalWeightTable.json';

export { CompositeInteractionType };
export type { ShinsalComposite, WeightedShinsalHit };

export const COMPOSITE_INTERACTION_KOREAN: Record<CompositeInteractionType, string> =
  Object.fromEntries(Object.entries(COMPOSITE_INTERACTION_INFO).map(([type, info]) => [type, info.koreanName])) as
  Record<CompositeInteractionType, string>;

function loadBaseWeightTable(): Record<ShinsalType, number> {
  const raw = rawWeightTable as Readonly<Record<string, number>>;
  const table: Partial<Record<ShinsalType, number>> = {};
  for (const shinsalType of Object.values(ShinsalType)) {
    const weight = raw[shinsalType];
    if (weight == null) {
      throw new Error(`Missing shinsal base weight: ${shinsalType}`);
    }
    table[shinsalType] = weight;
  }
  return table as Record<ShinsalType, number>;
}

const BASE_WEIGHT_TABLE: Record<ShinsalType, number> = loadBaseWeightTable();

function positionMultiplierFor(position: PillarPosition): number {
  switch (position) {
    case PillarPosition.DAY:   return 1.0;
    case PillarPosition.MONTH: return 0.85;
    case PillarPosition.YEAR:  return 0.7;
    case PillarPosition.HOUR:  return 0.6;
  }
}

export const ShinsalWeightCalculator = {
  weight(hit: ShinsalHit): WeightedShinsalHit {
    const base = baseShinsalWeightFor(hit.type);
    const multiplier = shinsalPositionMultiplierFor(hit.position);
    return {
      hit,
      baseWeight: base,
      positionMultiplier: multiplier,
      weightedScore: Math.round(base * multiplier),
    };
  },

  weightAll(hits: readonly ShinsalHit[]): WeightedShinsalHit[] {
    return hits
      .map((hit) => weightShinsalHit(hit))
      .sort((left, right) => right.weightedScore - left.weightedScore);
  },

  baseWeightFor(type: ShinsalType): number {
    return BASE_WEIGHT_TABLE[type];
  },

  positionMultiplierFor,
} as const;

export const weightShinsalHit = ShinsalWeightCalculator.weight;
export const weightAllShinsalHits = ShinsalWeightCalculator.weightAll;
export const baseShinsalWeightFor = ShinsalWeightCalculator.baseWeightFor;
export const shinsalPositionMultiplierFor = ShinsalWeightCalculator.positionMultiplierFor;
