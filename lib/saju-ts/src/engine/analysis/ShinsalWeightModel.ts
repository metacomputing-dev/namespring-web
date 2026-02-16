import { PillarPosition } from '../../domain/PillarPosition.js';
import { ShinsalHit, ShinsalType } from '../../domain/Shinsal.js';
import rawWeightTable from './data/shinsalWeightTable.json';

export enum CompositeInteractionType {
    SYNERGY = 'SYNERGY',
    AMPLIFY = 'AMPLIFY',
    AMPLIFY_NEGATIVE = 'AMPLIFY_NEGATIVE',
    TEMPER = 'TEMPER',
    TRANSFORM = 'TRANSFORM',
}

export const COMPOSITE_INTERACTION_KOREAN: Record<CompositeInteractionType, string> = {
  [CompositeInteractionType.SYNERGY]: '시너지',
  [CompositeInteractionType.AMPLIFY]: '증폭',
  [CompositeInteractionType.AMPLIFY_NEGATIVE]: '부정증폭',
  [CompositeInteractionType.TEMPER]: '완화',
  [CompositeInteractionType.TRANSFORM]: '변환',
};

export interface WeightedShinsalHit {
  readonly hit: ShinsalHit;
  readonly baseWeight: number;
  readonly positionMultiplier: number;
  readonly weightedScore: number;
}

export interface ShinsalComposite {
  readonly patternName: string;
  readonly interactionType: CompositeInteractionType;
  readonly involvedHits: readonly ShinsalHit[];
  readonly interpretation: string;
  readonly bonusScore: number;
}


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
      .map((h) => weightShinsalHit(h))
      .sort((a, b) => b.weightedScore - a.weightedScore);
  },

    baseWeightFor(type: ShinsalType): number {
    return BASE_WEIGHT_TABLE[type];
  },

    positionMultiplierFor(position: PillarPosition): number {
    switch (position) {
      case PillarPosition.DAY:   return 1.0;
      case PillarPosition.MONTH: return 0.85;
      case PillarPosition.YEAR:  return 0.7;
      case PillarPosition.HOUR:  return 0.6;
    }
  },
} as const;

export const weightShinsalHit = ShinsalWeightCalculator.weight;
export const weightAllShinsalHits = ShinsalWeightCalculator.weightAll;
export const baseShinsalWeightFor = ShinsalWeightCalculator.baseWeightFor;
export const shinsalPositionMultiplierFor = ShinsalWeightCalculator.positionMultiplierFor;
