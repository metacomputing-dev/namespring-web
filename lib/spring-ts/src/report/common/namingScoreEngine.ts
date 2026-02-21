import type { ElementCode } from '../types.js';
import {
  ELEMENT_CONTROLLED_BY,
  ELEMENT_GENERATED_BY,
  getElementRelation,
} from './elementMaps.js';

const ALL_ELEMENTS: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

export interface ScoreNameAgainstSajuInput {
  nameElements: ElementCode[];
  suriElements?: ElementCode[];
  yongshin?: ElementCode | null;
  heeshin?: ElementCode | null;
  gishin?: ElementCode | null;
  deficiency?: ElementCode[];
}

export interface NamingScoreCategoryResult {
  readonly score: number; // 0..100
  readonly raw: number;
  readonly weight: number; // normalized 0..1
  readonly reasons: string[];
}

export interface NamingScoreCategoryBreakdown {
  readonly nameElements: NamingScoreCategoryResult;
  readonly suriElements: NamingScoreCategoryResult;
  readonly deficiencyCoverage: NamingScoreCategoryResult;
  readonly balance: NamingScoreCategoryResult;
}

export interface NamingScoreTargetProfile {
  readonly yongshin: ElementCode | null;
  readonly heeshin: ElementCode | null;
  readonly gishin: ElementCode | null;
  readonly deficiency: ElementCode[];
}

export interface NamingScoreDistribution {
  readonly name: Record<ElementCode, number>;
  readonly suri: Record<ElementCode, number>;
  readonly combined: Record<ElementCode, number>;
}

export interface NamingScoreBreakdown {
  readonly total: number; // normalized 0..100
  readonly categories: NamingScoreCategoryBreakdown;
  readonly reasons: string[];
  readonly targets: NamingScoreTargetProfile;
  readonly distribution: NamingScoreDistribution;
}

type CategoryKey = keyof NamingScoreCategoryBreakdown;

interface ResolvedTargets {
  readonly yongshin: ElementCode | null;
  readonly heeshin: ElementCode | null;
  readonly gishin: ElementCode | null;
  readonly deficiency: ElementCode[];
}

const CATEGORY_ORDER: CategoryKey[] = [
  'nameElements',
  'suriElements',
  'deficiencyCoverage',
  'balance',
];

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  nameElements: 'Name element fit',
  suriElements: 'Suri element fit',
  deficiencyCoverage: 'Deficiency coverage',
  balance: 'Element balance',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function emptyElementCount(): Record<ElementCode, number> {
  return {
    WOOD: 0,
    FIRE: 0,
    EARTH: 0,
    METAL: 0,
    WATER: 0,
  };
}

function countElements(elements: readonly ElementCode[]): Record<ElementCode, number> {
  const counts = emptyElementCount();
  for (const element of elements) {
    counts[element] += 1;
  }
  return counts;
}

function uniqueElements(elements: readonly ElementCode[] | null | undefined): ElementCode[] {
  if (!elements || elements.length === 0) return [];
  const seen = new Set<ElementCode>();
  const result: ElementCode[] = [];
  for (const element of elements) {
    if (!seen.has(element)) {
      seen.add(element);
      result.push(element);
    }
  }
  return result;
}

function resolveTargets(input: ScoreNameAgainstSajuInput): ResolvedTargets {
  const yongshin = input.yongshin ?? null;
  const heeshin = input.heeshin ?? (yongshin ? ELEMENT_GENERATED_BY[yongshin] : null);
  const gishin = input.gishin ?? (yongshin ? ELEMENT_CONTROLLED_BY[yongshin] : null);
  const deficiency = uniqueElements(input.deficiency);

  return { yongshin, heeshin, gishin, deficiency };
}

function normalizeSignedAverageToScore(avg: number, min: number, max: number): number {
  if (max <= min) return 50;
  const ratio = (avg - min) / (max - min);
  return Math.round(clamp(ratio * 100, 0, 100));
}

function dominantElement(counts: Record<ElementCode, number>): ElementCode | null {
  let winner: ElementCode | null = null;
  let maxCount = -1;

  for (const element of ALL_ELEMENTS) {
    const count = counts[element];
    if (count > maxCount) {
      maxCount = count;
      winner = element;
    }
  }

  return maxCount > 0 ? winner : null;
}

function elementRuleScore(element: ElementCode, targets: ResolvedTargets): number {
  if (targets.yongshin && element === targets.yongshin) return 4;
  if (targets.gishin && element === targets.gishin) return -4;
  if (targets.heeshin && element === targets.heeshin) return 3;

  if (!targets.yongshin) return 0;

  const relation = getElementRelation(element, targets.yongshin);
  if (relation === 'generates') return 2;
  if (relation === 'generated_by') return 1;
  if (relation === 'controls') return -2;
  if (relation === 'controlled_by') return -1;
  return 0;
}

function scoreElementCategory(
  elements: readonly ElementCode[],
  category: CategoryKey,
  targets: ResolvedTargets,
): NamingScoreCategoryResult {
  const label = CATEGORY_LABEL[category];
  if (elements.length === 0) {
    return {
      score: 50,
      raw: 0,
      weight: 0,
      reasons: [`${label}: no elements provided, kept neutral.`],
    };
  }

  const counts = countElements(elements);
  const rawTotal = elements.reduce((sum, element) => sum + elementRuleScore(element, targets), 0);
  const rawAverage = rawTotal / elements.length;
  const score = normalizeSignedAverageToScore(rawAverage, -4, 4);

  const reasons: string[] = [];
  if (targets.yongshin) {
    const yongCount = counts[targets.yongshin];
    if (yongCount > 0) {
      reasons.push(`${label}: includes yongshin ${targets.yongshin} ${yongCount} time(s).`);
    }
  }

  if (targets.heeshin) {
    const heeshinCount = counts[targets.heeshin];
    if (heeshinCount > 0) {
      reasons.push(`${label}: includes heeshin ${targets.heeshin} ${heeshinCount} time(s).`);
    }
  }

  if (targets.gishin) {
    const gishinCount = counts[targets.gishin];
    if (gishinCount > 0) {
      reasons.push(`${label}: includes gishin ${targets.gishin} ${gishinCount} time(s), which lowers score.`);
    }
  }

  if (reasons.length === 0) {
    const dominant = dominantElement(counts);
    if (dominant && targets.yongshin) {
      const relation = getElementRelation(dominant, targets.yongshin);
      reasons.push(`${label}: dominant ${dominant} is ${relation} to yongshin ${targets.yongshin}.`);
    } else {
      reasons.push(`${label}: target elements are incomplete, relation scoring is limited.`);
    }
  }

  return {
    score,
    raw: rawAverage,
    weight: 0,
    reasons,
  };
}

function scoreDeficiencyCoverage(
  combined: readonly ElementCode[],
  deficiency: readonly ElementCode[],
): NamingScoreCategoryResult {
  if (deficiency.length === 0) {
    return {
      score: 50,
      raw: 0,
      weight: 0,
      reasons: ['Deficiency coverage: no deficiency input, kept neutral.'],
    };
  }

  if (combined.length === 0) {
    return {
      score: 0,
      raw: 0,
      weight: 0,
      reasons: ['Deficiency coverage: no name/suri elements to cover deficient elements.'],
    };
  }

  const counts = countElements(combined);
  const covered = deficiency.filter(element => counts[element] > 0);
  const coveredSet = new Set<ElementCode>(covered);
  const missed = deficiency.filter(element => !coveredSet.has(element));
  const supportCount = deficiency.reduce((sum, element) => sum + counts[element], 0);

  const coverageRatio = covered.length / deficiency.length;
  const supportRatio = supportCount / combined.length;
  const rawRatio = (coverageRatio * 0.7) + (supportRatio * 0.3);
  const score = Math.round(clamp(rawRatio * 100, 0, 100));

  const reasons: string[] = [
    `Deficiency coverage: covered ${covered.length}/${deficiency.length} deficient element(s).`,
  ];

  if (supportCount > 0) {
    reasons.push(`Deficiency coverage: ${supportCount}/${combined.length} total elements reinforce deficient targets.`);
  }

  if (missed.length > 0) {
    reasons.push(`Deficiency coverage: missing ${missed.join(', ')}.`);
  }

  return {
    score,
    raw: rawRatio,
    weight: 0,
    reasons,
  };
}

function scoreBalance(
  combined: readonly ElementCode[],
  targets: ResolvedTargets,
): NamingScoreCategoryResult {
  if (combined.length === 0) {
    return {
      score: 50,
      raw: 0,
      weight: 0,
      reasons: ['Element balance: no elements provided, kept neutral.'],
    };
  }

  const counts = countElements(combined);
  const distinct = ALL_ELEMENTS.filter(element => counts[element] > 0).length;
  const dominant = dominantElement(counts);
  const maxCount = dominant ? counts[dominant] : 0;
  const maxShare = maxCount / combined.length;

  const diversityRatio = distinct / ALL_ELEMENTS.length;
  const concentrationRatio = 1 - clamp((maxShare - 0.2) / 0.8, 0, 1);
  const rawRatio = (diversityRatio * 0.6) + (concentrationRatio * 0.4);

  let score = Math.round(clamp(rawRatio * 100, 0, 100));
  let penalty = 0;

  if (targets.gishin) {
    const gishinShare = counts[targets.gishin] / combined.length;
    if (gishinShare > 0.4) {
      penalty = Math.round(((gishinShare - 0.4) / 0.6) * 20);
      score = clamp(score - penalty, 0, 100);
    }
  }

  const reasons: string[] = [
    `Element balance: uses ${distinct}/5 elements.`,
  ];

  if (dominant) {
    reasons.push(`Element balance: dominant element ${dominant} is ${Math.round(maxShare * 100)}% of composition.`);
  }

  if (penalty > 0 && targets.gishin) {
    reasons.push(`Element balance: gishin ${targets.gishin} concentration penalty -${penalty}.`);
  }

  return {
    score,
    raw: rawRatio,
    weight: 0,
    reasons,
  };
}

function normalizeWeights(
  categories: NamingScoreCategoryBreakdown,
  input: {
    readonly nameCount: number;
    readonly suriCount: number;
    readonly deficiencyCount: number;
    readonly combinedCount: number;
  },
): NamingScoreCategoryBreakdown {
  const baseWeight: Record<CategoryKey, number> = {
    nameElements: input.nameCount > 0 ? 0.45 : 0,
    suriElements: input.suriCount > 0 ? 0.25 : 0,
    deficiencyCoverage: input.deficiencyCount > 0 ? 0.15 : 0,
    balance: input.combinedCount > 0 ? 0.15 : 0,
  };

  const sum = CATEGORY_ORDER.reduce((acc, key) => acc + baseWeight[key], 0);
  const weightFactor = sum > 0 ? 1 / sum : 0;

  return {
    nameElements: {
      ...categories.nameElements,
      weight: baseWeight.nameElements * weightFactor,
    },
    suriElements: {
      ...categories.suriElements,
      weight: baseWeight.suriElements * weightFactor,
    },
    deficiencyCoverage: {
      ...categories.deficiencyCoverage,
      weight: baseWeight.deficiencyCoverage * weightFactor,
    },
    balance: {
      ...categories.balance,
      weight: baseWeight.balance * weightFactor,
    },
  };
}

function buildTopLevelReasons(
  categories: NamingScoreCategoryBreakdown,
  targets: ResolvedTargets,
): string[] {
  const reasons: string[] = [];
  for (const key of CATEGORY_ORDER) {
    const category = categories[key];
    if (category.weight > 0 && category.reasons.length > 0) {
      reasons.push(category.reasons[0]);
    }
  }

  const active = CATEGORY_ORDER.filter(key => categories[key].weight > 0);
  if (active.length > 1) {
    const sorted = [...active].sort((a, b) => {
      const scoreDiff = categories[b].score - categories[a].score;
      if (scoreDiff !== 0) return scoreDiff;
      return CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b);
    });

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    reasons.push(`Strongest category: ${CATEGORY_LABEL[best]} (${categories[best].score}).`);
    reasons.push(`Weakest category: ${CATEGORY_LABEL[worst]} (${categories[worst].score}).`);
  }

  const targetText = [
    `yongshin=${targets.yongshin ?? 'none'}`,
    `heeshin=${targets.heeshin ?? 'none'}`,
    `gishin=${targets.gishin ?? 'none'}`,
  ].join(', ');
  reasons.push(`Resolved targets: ${targetText}.`);

  return reasons;
}

export function scoreNameAgainstSaju(input: ScoreNameAgainstSajuInput): NamingScoreBreakdown {
  const nameElements = input.nameElements ?? [];
  const suriElements = input.suriElements ?? [];
  const combinedElements = [...nameElements, ...suriElements];

  const targets = resolveTargets(input);

  const categoriesUnweighted: NamingScoreCategoryBreakdown = {
    nameElements: scoreElementCategory(nameElements, 'nameElements', targets),
    suriElements: scoreElementCategory(suriElements, 'suriElements', targets),
    deficiencyCoverage: scoreDeficiencyCoverage(combinedElements, targets.deficiency),
    balance: scoreBalance(combinedElements, targets),
  };

  const categories = normalizeWeights(categoriesUnweighted, {
    nameCount: nameElements.length,
    suriCount: suriElements.length,
    deficiencyCount: targets.deficiency.length,
    combinedCount: combinedElements.length,
  });

  const weightedSum = CATEGORY_ORDER.reduce(
    (sum, key) => sum + (categories[key].score * categories[key].weight),
    0,
  );
  const hasActiveCategory = CATEGORY_ORDER.some(key => categories[key].weight > 0);
  const total = hasActiveCategory ? Math.round(clamp(weightedSum, 0, 100)) : 50;

  return {
    total,
    categories,
    reasons: buildTopLevelReasons(categories, targets),
    targets: {
      yongshin: targets.yongshin,
      heeshin: targets.heeshin,
      gishin: targets.gishin,
      deficiency: [...targets.deficiency],
    },
    distribution: {
      name: countElements(nameElements),
      suri: countElements(suriElements),
      combined: countElements(combinedElements),
    },
  };
}
