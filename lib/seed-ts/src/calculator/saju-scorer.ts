import type { ElementKey } from './element-cycle.js';
import {
  ELEMENT_KEYS,
  emptyDistribution,
  clamp,
  elementFromSajuCode,
  elementCount,
  totalCount,
  weightedElementAverage,
  normalizeSignedScore,
  generates,
  generatedBy,
  controls,
  controlledBy,
} from './element-cycle.js';
import {
  SAJU_BALANCE_MOVE_PENALTY,
  SAJU_BALANCE_ZERO_PENALTY,
  SAJU_BALANCE_SPREAD_PENALTY,
  SAJU_BALANCE_PASS_THRESHOLD,
  SAJU_GUSIN_AFFINITY,
  SAJU_GISIN_AFFINITY,
  SAJU_YONGSHIN_AFFINITY,
  SAJU_HEESIN_AFFINITY,
  SAJU_AFFINITY_WEIGHT,
  SAJU_RECOMMENDATION_WEIGHT,
  SAJU_CONFIDENCE_BASE,
  SAJU_CONFIDENCE_MULTIPLIER,
  SAJU_DEFAULT_CONFIDENCE,
  SAJU_DEFAULT_RECOMMENDATION_CONFIDENCE,
  SAJU_SECONDARY_ELEMENT_WEIGHT,
  SAJU_GISIN_PENALTY_MULTIPLIER,
  SAJU_GUSIN_PENALTY_MULTIPLIER,
  SAJU_PENALTY_BASE_FACTOR,
  SAJU_PENALTY_CONFIDENCE_FACTOR,
  YONGSHIN_TYPE_WEIGHT,
  YONGSHIN_TYPE_WEIGHT_DEFAULT,
  CONTEXTUAL_YONGSHIN_TYPES,
  SAJU_STRENGTH_DEFAULT_INTENSITY,
  SAJU_STRENGTH_SCALE_BASE,
  SAJU_STRENGTH_SCALE_INTENSITY,
  SAJU_TEN_GOD_OVERREPRESENTED_MULT,
  SAJU_TEN_GOD_SCORE_MULTIPLIER,
  SAJU_WEIGHT_BALANCE_DEFAULT,
  SAJU_WEIGHT_YONGSHIN_DEFAULT,
  SAJU_WEIGHT_STRENGTH,
  SAJU_WEIGHT_TEN_GOD,
  SAJU_WEIGHT_SHIFT_CONTRAST,
  SAJU_WEIGHT_SHIFT_CONFIDENCE_BASE,
  SAJU_WEIGHT_SHIFT_CONFIDENCE_MULT,
  SAJU_WEIGHT_SHIFT_CONTEXT,
  SAJU_WEIGHT_BALANCE_MIN,
  SAJU_WEIGHT_BALANCE_MAX,
  SAJU_WEIGHT_YONGSHIN_MIN,
  SAJU_WEIGHT_YONGSHIN_MAX,
  SAJU_WEIGHT_CONTRAST_DIVISOR,
  SAJU_PASS_MIN_SCORE,
  SAJU_PASS_MIN_BALANCE,
  SAJU_PASS_MIN_YONGSHIN,
  SAJU_SEVERE_CONFLICT_GUSIN_RATIO,
} from './constants.js';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface SajuOutputSummary {
  dayMaster?: { element: ElementKey };
  strength?: {
    isStrong: boolean;
    totalSupport: number;
    totalOppose: number;
  };
  yongshin?: SajuYongshinSummary;
  tenGod?: { groupCounts: Record<string, number> };
}

export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  recommendations: Array<{
    type: string;
    primaryElement: string;
    secondaryElement: string | null;
    confidence: number;
    reasoning: string;
  }>;
}

export interface SajuNameScoreBreakdown {
  balance: number;
  yongshin: number;
  strength: number;
  tenGod: number;
  weights: { balance: number; yongshin: number; strength: number; tenGod: number };
  weightedBeforePenalty: number;
  penalties: { gisin: number; gusin: number; total: number };
  elementMatches: { yongshin: number; heesin: number; gisin: number; gusin: number };
}

export interface SajuNameScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
  breakdown: SajuNameScoreBreakdown;
}

interface BalanceScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
}

interface YongshinScoreResult {
  score: number;
  confidence: number;
  contextualPriority: number;
  gisinPenalty: number;
  gusinPenalty: number;
  gisinRatio: number;
  gusinRatio: number;
  elementMatches: { yongshin: number; heesin: number; gisin: number; gusin: number };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

type TenGodGroup = 'friend' | 'output' | 'wealth' | 'authority' | 'resource';
const TEN_GOD_GROUPS: TenGodGroup[] = ['friend', 'output', 'wealth', 'authority', 'resource'];

function spreadOf(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function computeOptimalSorted(initial: number[], resourceCount: number): number[] {
  const sorted = [...initial].sort((a, b) => a - b);
  let remaining = resourceCount;
  let level = 0;

  while (level < ELEMENT_KEYS.length - 1 && remaining > 0) {
    const curr = sorted[level] ?? 0;
    const next = sorted[level + 1] ?? curr;
    const width = level + 1;
    const diff = next - curr;
    if (diff === 0) { level++; continue; }
    const cost = diff * width;
    if (remaining >= cost) {
      for (let k = 0; k <= level; k++) sorted[k] = (sorted[k] ?? 0) + diff;
      remaining -= cost;
      level++;
    } else {
      const evenShare = Math.floor(remaining / width);
      const leftover = remaining % width;
      for (let k = 0; k <= level; k++) sorted[k] = (sorted[k] ?? 0) + evenShare;
      for (let k = 0; k < leftover; k++) sorted[k] = (sorted[k] ?? 0) + 1;
      remaining = 0;
    }
  }

  if (remaining > 0) {
    const evenShare = Math.floor(remaining / 5);
    const leftover = remaining % 5;
    for (let k = 0; k < 5; k++) sorted[k] = (sorted[k] ?? 0) + evenShare;
    for (let k = 0; k < leftover; k++) sorted[k] = (sorted[k] ?? 0) + 1;
  }
  return sorted;
}

function groupElement(dayMaster: ElementKey, group: TenGodGroup): ElementKey {
  switch (group) {
    case 'friend':   return dayMaster;
    case 'resource':  return generatedBy(dayMaster);
    case 'output':    return generates(dayMaster);
    case 'wealth':    return controls(dayMaster);
    case 'authority': return controlledBy(dayMaster);
  }
}

// ────────────────────────────────────────────────────────────────
// Balance scorer
// ────────────────────────────────────────────────────────────────

function computeBalanceScore(
  sajuDistribution: Record<ElementKey, number>,
  rootElementDistribution: Record<ElementKey, number>,
): BalanceScoreResult {
  const initial = ELEMENT_KEYS.map(k => sajuDistribution[k] ?? 0);
  const rootCounts = ELEMENT_KEYS.map(k => rootElementDistribution[k] ?? 0);
  const finalArr = ELEMENT_KEYS.map((_, i) => initial[i] + rootCounts[i]);
  const rootTotal = rootCounts.reduce((a, b) => a + b, 0);

  const deltas = finalArr.map((v, i) => v - initial[i]);
  if (deltas.some(v => v < 0) || deltas.reduce((a, b) => a + b, 0) !== rootTotal) {
    return { score: 0, isPassed: false, combined: emptyDistribution() };
  }

  const optimal = computeOptimalSorted(initial, rootTotal);
  const finalSorted = [...finalArr].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((v, i) => v === optimal[i]);
  const finalZero = finalArr.filter(v => v === 0).length;
  const optZero = optimal.filter(v => v === 0).length;
  const spread = spreadOf(finalArr);
  const optSpread = spreadOf(optimal);
  const manhattan = finalSorted.reduce((acc, v, i) => acc + Math.abs(v - optimal[i]), 0);
  const moves = Math.floor(manhattan / 2);

  let score: number;
  if (rootTotal === 0 && finalArr.every((v, i) => v === initial[i])) {
    score = 100;
  } else if (isOptimal) {
    score = 100;
  } else {
    score = clamp(
      100
        - SAJU_BALANCE_MOVE_PENALTY * moves
        - SAJU_BALANCE_ZERO_PENALTY * Math.max(0, finalZero - optZero)
        - SAJU_BALANCE_SPREAD_PENALTY * Math.max(0, spread - optSpread),
      0, 100,
    );
  }

  const isPassed = isOptimal || (finalZero <= optZero && spread <= optSpread && score >= SAJU_BALANCE_PASS_THRESHOLD);
  const combined = Object.fromEntries(
    ELEMENT_KEYS.map((k, i) => [k, finalArr[i] ?? 0]),
  ) as Record<ElementKey, number>;

  return { score, isPassed, combined };
}

// ────────────────────────────────────────────────────────────────
// Yongshin scorer
// ────────────────────────────────────────────────────────────────

function computeRecommendationScore(
  rootDist: Record<ElementKey, number>,
  yongshin: SajuYongshinSummary,
): { score: number; contextualPriority: number } | null {
  if (yongshin.recommendations.length === 0) return null;

  let weightedScore = 0;
  let totalWeight = 0;
  let contextualWeight = 0;

  for (const rec of yongshin.recommendations) {
    const primary = elementFromSajuCode(rec.primaryElement);
    const secondary = elementFromSajuCode(rec.secondaryElement);
    if (!primary && !secondary) continue;

    const recConf = Number.isFinite(rec.confidence)
      ? clamp(rec.confidence, 0, 1)
      : SAJU_DEFAULT_RECOMMENDATION_CONFIDENCE;
    const typeW = YONGSHIN_TYPE_WEIGHT[rec.type] ?? YONGSHIN_TYPE_WEIGHT_DEFAULT;
    const w = Math.max(0.1, recConf * typeW);
    const match = weightedElementAverage(rootDist, (el) => {
      if (primary && el === primary) return 1;
      if (secondary && el === secondary) return SAJU_SECONDARY_ELEMENT_WEIGHT;
      return 0;
    });

    weightedScore += match * w;
    totalWeight += w;
    if (CONTEXTUAL_YONGSHIN_TYPES.has(rec.type)) contextualWeight += w;
  }

  if (totalWeight <= 0) return null;
  return {
    score: clamp((weightedScore / totalWeight) * 100, 0, 100),
    contextualPriority: clamp(contextualWeight / totalWeight, 0, 1),
  };
}

function computeYongshinScore(
  rootDist: Record<ElementKey, number>,
  yongshin: SajuYongshinSummary | null,
): YongshinScoreResult {
  if (!yongshin) {
    return {
      score: 50, confidence: 0, contextualPriority: 0,
      gisinPenalty: 0, gusinPenalty: 0, gisinRatio: 0, gusinRatio: 0,
      elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
    };
  }

  const yongshinEl = elementFromSajuCode(yongshin.finalYongshin);
  const heesinEl = elementFromSajuCode(yongshin.finalHeesin);
  const gisinEl = elementFromSajuCode(yongshin.gisin);
  const gusinEl = elementFromSajuCode(yongshin.gusin);
  const confidence = Number.isFinite(yongshin.finalConfidence)
    ? clamp(yongshin.finalConfidence, 0, 1)
    : SAJU_DEFAULT_CONFIDENCE;

  const affinity = weightedElementAverage(rootDist, (el) => {
    if (gusinEl && el === gusinEl) return SAJU_GUSIN_AFFINITY;
    if (gisinEl && el === gisinEl) return SAJU_GISIN_AFFINITY;
    if (yongshinEl && el === yongshinEl) return SAJU_YONGSHIN_AFFINITY;
    if (heesinEl && el === heesinEl) return SAJU_HEESIN_AFFINITY;
    return 0;
  });

  const affinityScore = normalizeSignedScore(affinity);
  const recScore = computeRecommendationScore(rootDist, yongshin);
  const raw = recScore === null
    ? affinityScore
    : SAJU_AFFINITY_WEIGHT * affinityScore + SAJU_RECOMMENDATION_WEIGHT * recScore.score;
  const score = clamp(
    50 + (raw - 50) * (SAJU_CONFIDENCE_BASE + confidence * SAJU_CONFIDENCE_MULTIPLIER),
    0, 100,
  );

  const total = totalCount(rootDist);
  const gisinCount = elementCount(rootDist, gisinEl);
  const gusinCount = elementCount(rootDist, gusinEl);
  const gisinRatio = total > 0 ? gisinCount / total : 0;
  const gusinRatio = total > 0 ? gusinCount / total : 0;
  const penaltyScale = SAJU_PENALTY_BASE_FACTOR + SAJU_PENALTY_CONFIDENCE_FACTOR * confidence;
  const gisinPenalty = Math.round(gisinRatio * SAJU_GISIN_PENALTY_MULTIPLIER * penaltyScale);
  const gusinPenalty = Math.round(gusinRatio * SAJU_GUSIN_PENALTY_MULTIPLIER * penaltyScale);

  return {
    score, confidence,
    contextualPriority: recScore?.contextualPriority ?? 0,
    gisinPenalty, gusinPenalty, gisinRatio, gusinRatio,
    elementMatches: {
      yongshin: elementCount(rootDist, yongshinEl),
      heesin: elementCount(rootDist, heesinEl),
      gisin: gisinCount,
      gusin: gusinCount,
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Strength scorer
// ────────────────────────────────────────────────────────────────

function computeStrengthScore(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const strength = sajuOutput?.strength;
  const dm = sajuOutput?.dayMaster?.element;
  if (!strength || !dm) return 50;

  const favorable = new Set<ElementKey>();
  const unfavorable = new Set<ElementKey>();

  if (strength.isStrong) {
    favorable.add(generates(dm));
    favorable.add(controls(dm));
    favorable.add(controlledBy(dm));
    unfavorable.add(dm);
    unfavorable.add(generatedBy(dm));
  } else {
    favorable.add(dm);
    favorable.add(generatedBy(dm));
    unfavorable.add(generates(dm));
    unfavorable.add(controls(dm));
    unfavorable.add(controlledBy(dm));
  }

  const aff = weightedElementAverage(rootDist, (el) => {
    if (favorable.has(el)) return 1;
    if (unfavorable.has(el)) return -1;
    return 0;
  });

  const base = normalizeSignedScore(aff);
  const support = Math.abs(strength.totalSupport);
  const oppose = Math.abs(strength.totalOppose);
  const sum = support + oppose;
  const intensity = sum > 0
    ? clamp(Math.abs(support - oppose) / sum, 0, 1)
    : SAJU_STRENGTH_DEFAULT_INTENSITY;

  return clamp(50 + (base - 50) * (SAJU_STRENGTH_SCALE_BASE + intensity * SAJU_STRENGTH_SCALE_INTENSITY), 0, 100);
}

// ────────────────────────────────────────────────────────────────
// Ten God scorer
// ────────────────────────────────────────────────────────────────

function computeTenGodScore(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const tenGod = sajuOutput?.tenGod;
  const dm = sajuOutput?.dayMaster?.element;
  if (!tenGod || !dm) return 50;

  const counts = tenGod.groupCounts;
  const total = TEN_GOD_GROUPS.reduce((acc, g) => acc + (counts[g] ?? 0), 0);
  if (total <= 0) return 50;

  const avg = total / TEN_GOD_GROUPS.length;
  const elWeight: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };

  for (const group of TEN_GOD_GROUPS) {
    const count = counts[group] ?? 0;
    const delta = (avg - count) / Math.max(avg, 1);
    const target = groupElement(dm, group);
    elWeight[target] += delta >= 0 ? delta : delta * SAJU_TEN_GOD_OVERREPRESENTED_MULT;
  }

  const aff = weightedElementAverage(rootDist, (el) => clamp(elWeight[el], -1, 1));
  return clamp(50 + aff * SAJU_TEN_GOD_SCORE_MULTIPLIER, 0, 100);
}

// ────────────────────────────────────────────────────────────────
// Adaptive weight resolution
// ────────────────────────────────────────────────────────────────

function resolveAdaptiveWeights(
  balanceScore: number,
  yongshin: Pick<YongshinScoreResult, 'score' | 'confidence' | 'contextualPriority'>,
): { balance: number; yongshin: number; strength: number; tenGod: number } {
  let bw = SAJU_WEIGHT_BALANCE_DEFAULT;
  let yw = SAJU_WEIGHT_YONGSHIN_DEFAULT;
  const sw = SAJU_WEIGHT_STRENGTH;
  const tw = SAJU_WEIGHT_TEN_GOD;

  const contrast = clamp((yongshin.score - balanceScore) / SAJU_WEIGHT_CONTRAST_DIVISOR, 0, 1);
  const confBoost = clamp(yongshin.confidence, 0, 1);
  const ctxBoost = clamp(yongshin.contextualPriority, 0, 1);
  const shift =
    SAJU_WEIGHT_SHIFT_CONTRAST * contrast
      * (SAJU_WEIGHT_SHIFT_CONFIDENCE_BASE + SAJU_WEIGHT_SHIFT_CONFIDENCE_MULT * confBoost)
    + SAJU_WEIGHT_SHIFT_CONTEXT * confBoost * ctxBoost;

  bw = clamp(bw - shift, SAJU_WEIGHT_BALANCE_MIN, SAJU_WEIGHT_BALANCE_MAX);
  yw = clamp(yw + shift, SAJU_WEIGHT_YONGSHIN_MIN, SAJU_WEIGHT_YONGSHIN_MAX);

  const sum = bw + yw + sw + tw;
  return { balance: bw / sum, yongshin: yw / sum, strength: sw / sum, tenGod: tw / sum };
}

// ────────────────────────────────────────────────────────────────
// Composite scorer (public API)
// ────────────────────────────────────────────────────────────────

export function computeSajuNameScore(
  sajuDistribution: Record<ElementKey, number>,
  rootElementDistribution: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): SajuNameScoreResult {
  const balance = computeBalanceScore(sajuDistribution, rootElementDistribution);
  const yongshinSummary: SajuYongshinSummary | null = sajuOutput?.yongshin ?? null;
  const yongshin = computeYongshinScore(rootElementDistribution, yongshinSummary);
  const strength = computeStrengthScore(rootElementDistribution, sajuOutput);
  const tenGod = computeTenGodScore(rootElementDistribution, sajuOutput);
  const weights = resolveAdaptiveWeights(balance.score, yongshin);

  const weightedBeforePenalty = clamp(
    weights.balance * balance.score
      + weights.yongshin * yongshin.score
      + weights.strength * strength
      + weights.tenGod * tenGod,
    0, 100,
  );
  const totalPenalty = yongshin.gisinPenalty + yongshin.gusinPenalty;
  const score = clamp(weightedBeforePenalty - totalPenalty, 0, 100);

  const hasYongshin = sajuOutput?.yongshin != null;
  const severeConflict = yongshin.gusinRatio >= SAJU_SEVERE_CONFLICT_GUSIN_RATIO;
  const isPassed =
    score >= SAJU_PASS_MIN_SCORE
    && balance.score >= SAJU_PASS_MIN_BALANCE
    && (!hasYongshin || (yongshin.score >= SAJU_PASS_MIN_YONGSHIN && !severeConflict));

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
      penalties: { gisin: yongshin.gisinPenalty, gusin: yongshin.gusinPenalty, total: totalPenalty },
      elementMatches: yongshin.elementMatches,
    },
  };
}
