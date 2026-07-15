import type { PillarIdx } from './cycle.js';
import { stemElement } from './cycle.js';
import type { ElementVector } from './elementVector.js';
import { addElement, addVectors, cloneElementVector, zeroElementVector } from './elementVector.js';
import type { HiddenStemWeightPolicy } from './hiddenStems.js';
import { hiddenStemsOfBranch } from './hiddenStems.js';

export interface ElementDistribution {
  heaven: ElementVector;
  hidden: ElementVector;
  total: ElementVector;
}

export type ElementDistributionPosition = 'year' | 'month' | 'day' | 'hour';
export type ElementDistributionPositionWeights = Partial<Record<ElementDistributionPosition, number>>;

export interface ElementDistributionOptions {
  heavenStemWeight?: number;
  branchTotalWeight?: number;
  hiddenStemWeights?: HiddenStemWeightPolicy;
  positionWeights?: ElementDistributionPositionWeights;
  heavenPositionWeights?: ElementDistributionPositionWeights;
  branchPositionWeights?: ElementDistributionPositionWeights;
}

export const DEFAULT_ELEMENT_DISTRIBUTION_OPTIONS: Required<
  Pick<ElementDistributionOptions, 'heavenStemWeight' | 'branchTotalWeight'>
> = {
  heavenStemWeight: 1,
  branchTotalWeight: 1,
};

const ELEMENT_DISTRIBUTION_POSITIONS: readonly ElementDistributionPosition[] = ['year', 'month', 'day', 'hour'];

function finiteNonNegativeWeight(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readPositionWeight(
  weights: ElementDistributionPositionWeights | undefined,
  position: ElementDistributionPosition,
  fallback: number,
): number {
  return finiteNonNegativeWeight(weights?.[position], fallback);
}

function assertFiniteDistribution(label: string, vector: ElementVector): void {
  for (const value of Object.values(vector)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${label} produced a non-finite element weight`);
    }
  }
}

export function elementDistributionFromPillars(
  pillars: [PillarIdx, PillarIdx, PillarIdx, PillarIdx],
  opts: ElementDistributionOptions = {},
): ElementDistribution {
  const heavenStemWeight = finiteNonNegativeWeight(
    opts.heavenStemWeight,
    DEFAULT_ELEMENT_DISTRIBUTION_OPTIONS.heavenStemWeight,
  );
  const branchTotalWeight = finiteNonNegativeWeight(
    opts.branchTotalWeight,
    DEFAULT_ELEMENT_DISTRIBUTION_OPTIONS.branchTotalWeight,
  );
  const hsPolicy = opts.hiddenStemWeights ?? { scheme: 'standard' };

  const heaven = zeroElementVector();
  const hidden = zeroElementVector();

  for (let i = 0; i < pillars.length; i += 1) {
    const p = pillars[i]!;
    const position = ELEMENT_DISTRIBUTION_POSITIONS[i]!;
    const sharedPositionWeight = readPositionWeight(opts.positionWeights, position, 1);
    const heavenPositionWeight = readPositionWeight(opts.heavenPositionWeights, position, sharedPositionWeight);
    const branchPositionWeight = readPositionWeight(opts.branchPositionWeights, position, sharedPositionWeight);

    addElement(heaven, stemElement(p.stem), heavenStemWeight * heavenPositionWeight);

    for (const h of hiddenStemsOfBranch(p.branch, hsPolicy)) {
      addElement(hidden, stemElement(h.stem), branchTotalWeight * branchPositionWeight * h.weight);
    }
  }

  assertFiniteDistribution('heaven distribution', heaven);
  assertFiniteDistribution('hidden-stem distribution', hidden);

  const total = addVectors(cloneElementVector(heaven), hidden);
  assertFiniteDistribution('total distribution', total);
  return { heaven, hidden, total };
}
