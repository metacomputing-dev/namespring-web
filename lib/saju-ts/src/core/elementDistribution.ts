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

export interface ElementDistributionOptions {
  heavenStemWeight?: number;
  branchTotalWeight?: number;
  hiddenStemWeights?: HiddenStemWeightPolicy;
}

export const DEFAULT_ELEMENT_DISTRIBUTION_OPTIONS: Required<Omit<ElementDistributionOptions, 'hiddenStemWeights'>> = {
  heavenStemWeight: 1,
  branchTotalWeight: 1,
};

export function elementDistributionFromPillars(
  pillars: [PillarIdx, PillarIdx, PillarIdx, PillarIdx],
  opts: ElementDistributionOptions = {},
): ElementDistribution {
  const heavenStemWeight = opts.heavenStemWeight ?? DEFAULT_ELEMENT_DISTRIBUTION_OPTIONS.heavenStemWeight;
  const branchTotalWeight = opts.branchTotalWeight ?? DEFAULT_ELEMENT_DISTRIBUTION_OPTIONS.branchTotalWeight;
  const hsPolicy = opts.hiddenStemWeights ?? { scheme: 'standard' };

  const heaven = zeroElementVector();
  const hidden = zeroElementVector();

  for (const p of pillars) {
    // --- Heaven stem
    addElement(heaven, stemElement(p.stem), heavenStemWeight);

    // --- Hidden stems in branch
    for (const h of hiddenStemsOfBranch(p.branch, hsPolicy)) {
      addElement(hidden, stemElement(h.stem), branchTotalWeight * h.weight);
    }
  }

  const total = addVectors(cloneElementVector(heaven), hidden);
  return { heaven, hidden, total };
}
