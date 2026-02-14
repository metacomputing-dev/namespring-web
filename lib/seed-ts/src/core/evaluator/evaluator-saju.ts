import type { Element } from "../types.js";
import { clamp } from "../utils.js";
import { distributionFromArrangement, ELEMENT_KEYS } from "./evaluator-context.js";
import type {
  SajuCalculationOutputSummary,
  SajuTenGodGroupCountsSummary,
  SajuYongshinSummary,
} from "./saju-distribution-resolver.js";

type TenGodGroup = keyof SajuTenGodGroupCountsSummary;

const YONGSHIN_TYPE_WEIGHT: Record<string, number> = {
  EOKBU: 1,
  JOHU: 0.95,
  TONGGWAN: 0.9,
  GYEOKGUK: 0.85,
  BYEONGYAK: 0.8,
  JEONWANG: 0.75,
  HAPWHA_YONGSHIN: 0.7,
  ILHAENG_YONGSHIN: 0.7,
};

const TEN_GOD_GROUPS: TenGodGroup[] = ["friend", "output", "wealth", "authority", "resource"];

export interface SajuNameScoreBreakdown {
  balance: number;
  yongshin: number;
  strength: number;
  tenGod: number;
  weights: {
    balance: number;
    yongshin: number;
    strength: number;
    tenGod: number;
  };
  weightedBeforePenalty: number;
  penalties: {
    gisin: number;
    gusin: number;
    total: number;
  };
  elementMatches: {
    yongshin: number;
    heesin: number;
    gisin: number;
    gusin: number;
  };
}

export interface SajuNameScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<Element, number>;
  breakdown: SajuNameScoreBreakdown;
}

interface YongshinScoreResult {
  score: number;
  confidence: number;
  contextualPriority: number;
  gisinPenalty: number;
  gusinPenalty: number;
  gisinRatio: number;
  gusinRatio: number;
  elementMatches: {
    yongshin: number;
    heesin: number;
    gisin: number;
    gusin: number;
  };
}

export function computeSajuRootBalanceScore(
  sajuDistribution: Record<Element, number>,
  rootElementDistribution: Record<Element, number>,
): { score: number; isPassed: boolean; combined: Record<Element, number> } {
  const initial = ELEMENT_KEYS.map((key) => sajuDistribution[key] ?? 0);
  const rootElementCounts = ELEMENT_KEYS.map((key) => rootElementDistribution[key] ?? 0);
  const finalArr = ELEMENT_KEYS.map((_, idx) => initial[idx] + rootElementCounts[idx]);
  const r = rootElementCounts.reduce((a, b) => a + b, 0);

  const delta = finalArr.map((value, idx) => value - initial[idx]);
  if (delta.some((value) => value < 0)) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }
  if (delta.reduce((a, b) => a + b, 0) !== r) {
    return {
      score: 0,
      isPassed: false,
      combined: distributionFromArrangement([]),
    };
  }

  const optimal = computeOptimalSorted(initial, r);
  const finalSorted = [...finalArr].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((value, idx) => value === optimal[idx]);
  const finalZero = finalArr.filter((value) => value === 0).length;
  const optZero = optimal.filter((value) => value === 0).length;
  const spread = spreadOf(finalArr);
  const optSpread = spreadOf(optimal);
  const l1 = finalSorted.reduce((acc, value, idx) => acc + Math.abs(value - optimal[idx]), 0);
  const moves = Math.floor(l1 / 2);

  let score = 0;
  if (r === 0 && finalArr.every((value, idx) => value === initial[idx])) {
    score = 100;
  } else if (isOptimal) {
    score = 100;
  } else {
    score = 100 - 20 * moves - 10 * Math.max(0, finalZero - optZero) - 5 * Math.max(0, spread - optSpread);
    score = clamp(score, 0, 100);
  }

  const isPassed = isOptimal || (finalZero <= optZero && spread <= optSpread && score >= 70);
  const combined: Record<Element, number> = {
    "\u6728": finalArr[0] ?? 0,
    "\u706B": finalArr[1] ?? 0,
    "\u571F": finalArr[2] ?? 0,
    "\u91D1": finalArr[3] ?? 0,
    "\u6C34": finalArr[4] ?? 0,
  };

  return { score, isPassed, combined };
}

export function computeSajuNameScore(
  sajuDistribution: Record<Element, number>,
  rootElementDistribution: Record<Element, number>,
  sajuOutput: SajuCalculationOutputSummary | null,
): SajuNameScoreResult {
  const balance = computeSajuRootBalanceScore(sajuDistribution, rootElementDistribution);
  const yongshin = computeYongshinScore(rootElementDistribution, sajuOutput?.yongshin ?? null);
  const strength = computeStrengthScore(rootElementDistribution, sajuOutput);
  const tenGod = computeTenGodScore(rootElementDistribution, sajuOutput);
  const weights = resolveAdaptiveWeights(balance.score, yongshin);

  const weightedBeforePenalty = clamp(
    weights.balance * balance.score +
      weights.yongshin * yongshin.score +
      weights.strength * strength +
      weights.tenGod * tenGod,
    0,
    100,
  );
  const totalPenalty = yongshin.gisinPenalty + yongshin.gusinPenalty;
  const score = clamp(weightedBeforePenalty - totalPenalty, 0, 100);

  const hasYongshin = sajuOutput?.yongshin !== null && sajuOutput?.yongshin !== undefined;
  const severeConflict = yongshin.gusinRatio >= 0.75;
  const isPassed =
    score >= 62 &&
    balance.score >= 45 &&
    (!hasYongshin || (yongshin.score >= 35 && !severeConflict));

  return {
    score,
    isPassed,
    combined: balance.combined,
    breakdown: {
      balance: balance.score,
      yongshin: yongshin.score,
      strength,
      tenGod,
      weights,
      weightedBeforePenalty,
      penalties: {
        gisin: yongshin.gisinPenalty,
        gusin: yongshin.gusinPenalty,
        total: totalPenalty,
      },
      elementMatches: yongshin.elementMatches,
    },
  };
}

function elementCount(distribution: Record<Element, number>, element: Element | null): number {
  if (!element) {
    return 0;
  }
  return distribution[element] ?? 0;
}

function totalCount(distribution: Record<Element, number>): number {
  return ELEMENT_KEYS.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
}

function weightedElementAverage(
  distribution: Record<Element, number>,
  selector: (element: Element) => number,
): number {
  const total = totalCount(distribution);
  if (total <= 0) {
    return 0;
  }
  let weighted = 0;
  for (const element of ELEMENT_KEYS) {
    const count = distribution[element] ?? 0;
    if (count <= 0) {
      continue;
    }
    weighted += selector(element) * count;
  }
  return weighted / total;
}

function normalizeSignedScore(value: number): number {
  return clamp((value + 1) * 50, 0, 100);
}

function toElementFromCode(value: string | null | undefined): Element | null {
  switch (value) {
    case "WOOD":
      return "\u6728";
    case "FIRE":
      return "\u706B";
    case "EARTH":
      return "\u571F";
    case "METAL":
      return "\u91D1";
    case "WATER":
      return "\u6C34";
    default:
      return null;
  }
}

function cycleNext(element: Element, offset: number): Element {
  const idx = ELEMENT_KEYS.indexOf(element);
  const next = (idx + offset + ELEMENT_KEYS.length) % ELEMENT_KEYS.length;
  return ELEMENT_KEYS[next]!;
}

function generatedBy(element: Element): Element {
  return cycleNext(element, -1);
}

function generates(element: Element): Element {
  return cycleNext(element, 1);
}

function controls(element: Element): Element {
  return cycleNext(element, 2);
}

function controlledBy(element: Element): Element {
  return cycleNext(element, -2);
}

function computeYongshinScore(
  rootElementDistribution: Record<Element, number>,
  yongshin: SajuYongshinSummary | null,
): YongshinScoreResult {
  if (!yongshin) {
    return {
      score: 50,
      confidence: 0,
      contextualPriority: 0,
      gisinPenalty: 0,
      gusinPenalty: 0,
      gisinRatio: 0,
      gusinRatio: 0,
      elementMatches: {
        yongshin: 0,
        heesin: 0,
        gisin: 0,
        gusin: 0,
      },
    };
  }

  const yongshinElement = toElementFromCode(yongshin.finalYongshin);
  const heesinElement = toElementFromCode(yongshin.finalHeesin);
  const gisinElement = toElementFromCode(yongshin.gisin);
  const gusinElement = toElementFromCode(yongshin.gusin);
  const confidence = Number.isFinite(yongshin.finalConfidence)
    ? clamp(yongshin.finalConfidence, 0, 1)
    : 0.65;

  const affinity = weightedElementAverage(rootElementDistribution, (element) => {
    if (gusinElement && element === gusinElement) {
      return -1;
    }
    if (gisinElement && element === gisinElement) {
      return -0.65;
    }
    if (yongshinElement && element === yongshinElement) {
      return 1;
    }
    if (heesinElement && element === heesinElement) {
      return 0.65;
    }
    return 0;
  });

  const affinityScore = normalizeSignedScore(affinity);
  const recommendationScore = computeRecommendationScore(rootElementDistribution, yongshin);
  const raw =
    recommendationScore === null
      ? affinityScore
      : 0.55 * affinityScore + 0.45 * recommendationScore.score;
  const score = clamp(50 + (raw - 50) * (0.55 + confidence * 0.45), 0, 100);

  const total = totalCount(rootElementDistribution);
  const gisinCount = elementCount(rootElementDistribution, gisinElement);
  const gusinCount = elementCount(rootElementDistribution, gusinElement);
  const gisinRatio = total > 0 ? gisinCount / total : 0;
  const gusinRatio = total > 0 ? gusinCount / total : 0;
  const gisinPenalty = Math.round(gisinRatio * 7 * (0.4 + 0.6 * confidence));
  const gusinPenalty = Math.round(gusinRatio * 14 * (0.4 + 0.6 * confidence));

  return {
    score,
    confidence,
    contextualPriority: recommendationScore?.contextualPriority ?? 0,
    gisinPenalty,
    gusinPenalty,
    gisinRatio,
    gusinRatio,
    elementMatches: {
      yongshin: elementCount(rootElementDistribution, yongshinElement),
      heesin: elementCount(rootElementDistribution, heesinElement),
      gisin: gisinCount,
      gusin: gusinCount,
    },
  };
}

function computeRecommendationScore(
  rootElementDistribution: Record<Element, number>,
  yongshin: SajuYongshinSummary,
): { score: number; contextualPriority: number } | null {
  if (yongshin.recommendations.length === 0) {
    return null;
  }

  let weightedScore = 0;
  let totalWeight = 0;
  let contextualWeight = 0;
  for (const recommendation of yongshin.recommendations) {
    const primary = toElementFromCode(recommendation.primaryElement);
    const secondary = toElementFromCode(recommendation.secondaryElement);
    if (!primary && !secondary) {
      continue;
    }

    const confidence = Number.isFinite(recommendation.confidence)
      ? clamp(recommendation.confidence, 0, 1)
      : 0.6;
    const typeWeight = YONGSHIN_TYPE_WEIGHT[recommendation.type] ?? 0.75;
    const weight = Math.max(0.1, confidence * typeWeight);
    const match = weightedElementAverage(rootElementDistribution, (element) => {
      if (primary && element === primary) {
        return 1;
      }
      if (secondary && element === secondary) {
        return 0.6;
      }
      return 0;
    });

    weightedScore += match * weight;
    totalWeight += weight;
    if (
      recommendation.type === "JOHU" ||
      recommendation.type === "TONGGWAN" ||
      recommendation.type === "BYEONGYAK" ||
      recommendation.type === "GYEOKGUK" ||
      recommendation.type === "HAPWHA_YONGSHIN"
    ) {
      contextualWeight += weight;
    }
  }

  if (totalWeight <= 0) {
    return null;
  }
  return {
    score: clamp((weightedScore / totalWeight) * 100, 0, 100),
    contextualPriority: clamp(contextualWeight / totalWeight, 0, 1),
  };
}

function resolveAdaptiveWeights(
  balanceScore: number,
  yongshin: Pick<YongshinScoreResult, "score" | "confidence" | "contextualPriority">,
): {
  balance: number;
  yongshin: number;
  strength: number;
  tenGod: number;
} {
  let balanceWeight = 0.6;
  let yongshinWeight = 0.23;
  const strengthWeight = 0.12;
  const tenGodWeight = 0.05;

  const contrast = clamp((yongshin.score - balanceScore) / 70, 0, 1);
  const confidenceBoost = clamp(yongshin.confidence, 0, 1);
  const contextBoost = clamp(yongshin.contextualPriority, 0, 1);
  const shift = 0.22 * contrast * (0.6 + 0.4 * confidenceBoost) + 0.08 * confidenceBoost * contextBoost;

  balanceWeight = clamp(balanceWeight - shift, 0.35, 0.6);
  yongshinWeight = clamp(yongshinWeight + shift, 0.23, 0.48);

  const total = balanceWeight + yongshinWeight + strengthWeight + tenGodWeight;
  return {
    balance: balanceWeight / total,
    yongshin: yongshinWeight / total,
    strength: strengthWeight / total,
    tenGod: tenGodWeight / total,
  };
}

function computeStrengthScore(
  rootElementDistribution: Record<Element, number>,
  sajuOutput: SajuCalculationOutputSummary | null,
): number {
  const strength = sajuOutput?.strength;
  const dayMaster = sajuOutput?.dayMaster;
  const dayMasterElement = dayMaster?.element;
  if (!strength || !dayMasterElement) {
    return 50;
  }

  const favorable = new Set<Element>();
  const unfavorable = new Set<Element>();
  if (strength.isStrong) {
    favorable.add(generates(dayMasterElement));
    favorable.add(controls(dayMasterElement));
    favorable.add(controlledBy(dayMasterElement));
    unfavorable.add(dayMasterElement);
    unfavorable.add(generatedBy(dayMasterElement));
  } else {
    favorable.add(dayMasterElement);
    favorable.add(generatedBy(dayMasterElement));
    unfavorable.add(generates(dayMasterElement));
    unfavorable.add(controls(dayMasterElement));
    unfavorable.add(controlledBy(dayMasterElement));
  }

  const affinity = weightedElementAverage(rootElementDistribution, (element) => {
    if (favorable.has(element)) {
      return 1;
    }
    if (unfavorable.has(element)) {
      return -1;
    }
    return 0;
  });

  const baseScore = normalizeSignedScore(affinity);
  const support = Math.abs(strength.totalSupport);
  const oppose = Math.abs(strength.totalOppose);
  const sum = support + oppose;
  const intensity = sum > 0 ? clamp(Math.abs(support - oppose) / sum, 0, 1) : 0.35;
  return clamp(50 + (baseScore - 50) * (0.45 + intensity * 0.55), 0, 100);
}

function groupElement(dayMasterElement: Element, group: TenGodGroup): Element {
  switch (group) {
    case "friend":
      return dayMasterElement;
    case "resource":
      return generatedBy(dayMasterElement);
    case "output":
      return generates(dayMasterElement);
    case "wealth":
      return controls(dayMasterElement);
    case "authority":
      return controlledBy(dayMasterElement);
  }
}

function computeTenGodScore(
  rootElementDistribution: Record<Element, number>,
  sajuOutput: SajuCalculationOutputSummary | null,
): number {
  const tenGod = sajuOutput?.tenGod;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  if (!tenGod || !dayMasterElement) {
    return 50;
  }

  const counts = tenGod.groupCounts;
  const total = TEN_GOD_GROUPS.reduce((acc, group) => acc + (counts[group] ?? 0), 0);
  if (total <= 0) {
    return 50;
  }

  const avg = total / TEN_GOD_GROUPS.length;
  const elementWeight: Record<Element, number> = {
    "\u6728": 0,
    "\u706B": 0,
    "\u571F": 0,
    "\u91D1": 0,
    "\u6C34": 0,
  };

  for (const group of TEN_GOD_GROUPS) {
    const count = counts[group] ?? 0;
    const normalizedDelta = (avg - count) / Math.max(avg, 1);
    const targetElement = groupElement(dayMasterElement, group);
    if (normalizedDelta >= 0) {
      elementWeight[targetElement] += normalizedDelta;
    } else {
      elementWeight[targetElement] += normalizedDelta * 0.35;
    }
  }

  const affinity = weightedElementAverage(
    rootElementDistribution,
    (element) => clamp(elementWeight[element], -1, 1),
  );
  return clamp(50 + affinity * 45, 0, 100);
}

function computeOptimalSorted(initial: number[], resourceCount: number): number[] {
  const s = [...initial].sort((a, b) => a - b);
  let rem = resourceCount;
  let i = 0;
  while (i < 4 && rem > 0) {
    const curr = s[i] ?? 0;
    const next = s[i + 1] ?? curr;
    const width = i + 1;
    const diff = next - curr;
    if (diff === 0) {
      i += 1;
      continue;
    }
    const cost = diff * width;
    if (rem >= cost) {
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + diff;
      }
      rem -= cost;
      i += 1;
    } else {
      const q = Math.floor(rem / width);
      const r = rem % width;
      for (let k = 0; k <= i; k += 1) {
        s[k] = (s[k] ?? 0) + q;
      }
      for (let k = 0; k < r; k += 1) {
        s[k] = (s[k] ?? 0) + 1;
      }
      rem = 0;
    }
  }
  if (rem > 0) {
    const q = Math.floor(rem / 5);
    const r = rem % 5;
    for (let k = 0; k < 5; k += 1) {
      s[k] = (s[k] ?? 0) + q;
    }
    for (let k = 0; k < r; k += 1) {
      s[k] = (s[k] ?? 0) + 1;
    }
  }
  return s;
}

function spreadOf(values: number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min;
}
