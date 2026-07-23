/**
 * saju-calculator.ts
 *
 * Scores how well a name's elemental makeup fits a person's saju (四柱) chart.
 * The final score blends four sub-scores, each measuring a different aspect
 * of compatibility, then subtracts penalties for harmful elements.
 *
 * ── Scoring Pipeline ────────────────────────────────────────────────────
 *
 *   1. BALANCE  — Does the name fill gaps in the chart's five-element spread?
 *   2. YONGSHIN — Does the name contain the helpful element (yongshin)?
 *   3. STRENGTH — Does the name counterbalance day-master strength/weakness?
 *   4. TEN GOD  — Does the name compensate for ten-god group imbalances?
 *
 *   finalScore = weighted(balance, yongshin, strength, tenGod)
 *                + deficiency bonus
 *                - gisin penalty        (harmful element present)
 *                - gusin penalty        (most harmful element present)
 *                - gyeokguk penalty     (breaks jonggyeok pattern)
 *
 * ── Glossary ────────────────────────────────────────────────────────────
 *  Yongshin (용신)  — the "helpful god" element the chart needs most
 *  Heesin (희신)    — the supporting element that assists yongshin
 *  Gisin (기신)     — a harmful element that weakens the chart
 *  Gusin (구신)     — the MOST harmful element (worse than gisin)
 *  Gyeokguk (격국)  — the structural pattern of the birth chart
 *  Jonggyeok (종격) — a special gyeokguk where harmful elements break it
 *  Ohaeng (오행)    — the Five Elements (Wood, Fire, Earth, Metal, Water)
 * ─────────────────────────────────────────────────────────────────────────
 */
import {
  type EvalContext,
  type AnalysisDetail,
  type CalculatorPacket,
  type CalculatorSignal,
  type EvaluableCalculator,
  putInsight,
} from './core/evaluator.js';
import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { hangulElementFromSyllable } from '../../seed-ts/src/utils/hangul-name-entry.js';
import type {
  NameElementResolutionEvidence,
  NameElementResolutionSource,
  NameElementResolutionSafety,
  NameElementStrategy,
  NameElementStrategyEvidence,
  SajuCompatibility,
  SajuNameSafetyProfile,
  SajuNameSourceEvidence,
  SajuNameEvidenceDirection,
  SajuNameSafetyStrategy,
  SajuOutputSummary,
  SajuYongshinSummary,
  TenGodPositionEvidence,
  TenGodPositionEvidenceContribution,
  YongshinConsensusAxisName,
  YongshinConsensusConflictLevel,
  YongshinConsensusScoreboard,
} from './types.js';
import { elementFromSajuCode } from './saju/element-code.js';
import { SAJU_FRAME } from './spring-evaluator.js';
import {
  type ElementKey,
  ELEMENT_KEYS,
  clamp,
  elementCount,
  totalCount,
  weightedElementAverage,
  normalizeSignedScore,
  generatedBy,
  distributionFromArrangement,
} from './core/scoring.js';

// ---------------------------------------------------------------------------
//  Configuration — loaded from JSON so non-programmers can adjust the tuning
// ---------------------------------------------------------------------------
import scoringConfig from '../config/saju-scoring.json';
import scoringRules from '../config/scoring-rules.json';
import { NAMING_EVIDENCE_WEIGHT_POLICY } from './naming-evidence-weight-policy.js';
import {
  loadPreset,
  resolveSchoolPresetName,
  type SchoolPresetData,
  type SchoolPresetName,
} from './preset-loader.js';

/** Backward-signal weight for the SAJU_FRAME — default 1.0, externalized so
 *  schoolPreset (PR4) can re-balance saju vs name signal without code change. */
const SAJU_SIGNAL_WEIGHT: number = (scoringRules as { saju?: { signalWeight?: number } }).saju?.signalWeight ?? 1.0;

/** How much weight each yongshin recommendation type carries (1.0 = strongest).
 *  The default and school overrides share naming-evidence-weights.json. When precisionConfig.useSchoolPreset is
 *  true, SajuCalculator routes through the preset's table instead. */
const DEFAULT_YONGSHIN_TYPE_WEIGHTS: Record<string, number> = NAMING_EVIDENCE_WEIGHT_POLICY.yongshinTypeWeights;

/** Fallback weight when the recommendation type is not in the table. */
const DEFAULT_TYPE_WEIGHT: number = scoringConfig.defaultTypeWeight;

/** Fallback confidence when the saju engine does not report one. */
const DEFAULT_CONFIDENCE: number = scoringConfig.defaultConfidence;

/** Recommendation types that get contextual priority (school-specific methods). */
const CONTEXTUAL_TYPES: readonly string[] = scoringConfig.contextualTypes;

/** The five ten-god groups: friend, output, wealth, authority, resource. */
const TEN_GOD_GROUPS: readonly string[] = scoringConfig.tenGodGroupNames;
const CONSENSUS_CONFLICT_WEIGHT: Record<YongshinConsensusConflictLevel, number> = {
  none: 0,
  low: 0.08,
  medium: 0.14,
  high: 0.2,
};
const CONSENSUS_CLEAR_TOP_MARGIN = 0.2;
const CONSENSUS_AGGRESSIVE_REINFORCEMENT_MAX_PENALTY = 12;

// Destructure the nested config sections for easier access
const {
  passing:          PASSING,
} = scoringConfig;
const {
  balanceScoring: BALANCE,
  yongshinScoring: YONGSHIN,
  strengthScoring: STRENGTH,
  tenGodScoring: TEN_GOD,
  adaptiveWeights: ADAPTIVE,
  penalties: PENALTY,
  bonuses: EVIDENCE_BONUSES,
} = NAMING_EVIDENCE_WEIGHT_POLICY;
const DEFICIENCY = {
  yongshinMatch: EVIDENCE_BONUSES.deficiencyYongshinMatch,
  heesinMatch: EVIDENCE_BONUSES.deficiencyHeesinMatch,
  maxBonus: EVIDENCE_BONUSES.deficiencyMaximum,
} as const;

// ---------------------------------------------------------------------------
//  Public interface — the shape of a saju name score result
// ---------------------------------------------------------------------------

export interface SajuNameScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
  breakdown: {
    balance: number; yongshin: number; strength: number; tenGod: number;
    penalties: { gisin: number; gusin: number; gyeokguk: number; total: number };
    deficiencyBonus: number;
    elementMatches: { yongshin: number; heesin: number; gisin: number; gusin: number };
    yongshinConsensus?: {
      conflictLevel: YongshinConsensusConflictLevel;
      competingElements: readonly string[];
      confidence: number;
      topMargin: number;
      normalizedTopMargin?: number;
      methodDisagreementRatio?: number;
      scoreGuardApplied: boolean;
    };
    safetyProfile?: SajuNameSafetyProfile;
    sourceEvidence: SajuNameSourceEvidence;
  };
}

/** Opt-in scoring-mode overrides forwarded to computeSajuNameScore.
 *  Each variant is documented on the matching PrecisionConfig field
 *  (see types.ts). When undefined or omitted, each sub-score uses the
 *  legacy default — guaranteeing default-mode regression 0. */
export interface ScoringPrecisionOverrides {
  readonly balanceMode?: 'mathematical' | 'yongshin_first' | 'classical_jonggyeok_aware';
  readonly yongshinMode?: 'classical_blend' | 'chengbai_strict' | 'consensus_aware';
  readonly strengthMode?: 'binary' | 'continuous';
  readonly tenGodMode?: 'simple_count' | 'positional_weighted' | 'positional_weighted_v2';
  readonly gyeokgukMode?: 'jonggyeok_only' | 'multi_special' | 'chengbai_strict';
}

export type SajuNameElementSource = 'resource' | 'hangul';
export type TenGodScoreMode = NonNullable<ScoringPrecisionOverrides['tenGodMode']>;
export type TenGodScoreNormalization =
  | 'deviation_from_average_count'
  | 'presence_visibility_expected_by_chart_shape';

type YongshinConsensusScoreDetail = NonNullable<SajuNameScoreResult['breakdown']['yongshinConsensus']>;

interface YongshinScoreResult {
  readonly score: number;
  readonly confidence: number;
  readonly contextualPriority: number;
  readonly gisinPenalty: number;
  readonly gusinPenalty: number;
  readonly gusinRatio: number;
  readonly elementMatches: { yongshin: number; heesin: number; gisin: number; gusin: number };
  readonly consensus?: YongshinConsensusScoreDetail;
  readonly safetyProfile?: SajuNameSafetyProfile;
}

type NameElementScope = NameElementResolutionEvidence['scope'];

function isElementKey(value: unknown): value is ElementKey {
  return value === 'Wood' || value === 'Fire' || value === 'Earth' || value === 'Metal' || value === 'Water';
}

function safetyStrategyFor(
  mode: ScoringPrecisionOverrides['yongshinMode'] | undefined,
  aggressiveReinforcement: number,
): SajuNameSafetyStrategy {
  if (mode !== 'consensus_aware') return 'legacy_direct_reinforcement';
  return aggressiveReinforcement >= 0.5 ? 'aggressive_reinforcement' : 'safe_balance';
}

/** Threshold (0..1) below which yongshin reinforcement is considered too thin
 *  to warrant a 'safe' posture under consensus_aware mode — even when the
 *  riskScore happens to land in the safe band. The picked threshold (0.10)
 *  matches the ~12% lower decile observed in 30-fixture sampling and is
 *  consistent with `aggressiveReinforcement` requiring ≥ 0.5 to flip the
 *  opposite direction. */
const CONSENSUS_AWARE_THIN_REINFORCEMENT_RATIO = 0.10;
/** Number of competing elements (in `final.competingElements`) at which we
 *  consider the consensus to be split across more than two majors and apply
 *  an additional score haircut on top of the existing aggressive-reinforcement
 *  penalty. Using ≥3 means we never penalise the more common high-conflict
 *  case where only two methods disagree. */
const CONSENSUS_AWARE_MULTI_COMPETING_THRESHOLD = 3;
/** Maximum extra haircut (in score points) layered on top of the aggressive
 *  reinforcement penalty when the consensus has 3+ competing elements at high
 *  conflict. Smaller than `CONSENSUS_AGGRESSIVE_REINFORCEMENT_MAX_PENALTY`
 *  (12) so the change is a refinement, not a doubling. */
const CONSENSUS_AWARE_MULTI_COMPETING_MAX_PENALTY = 4;

const CONSENSUS_AXIS_NAMES: readonly YongshinConsensusAxisName[] = [
  'eokbu',
  'johu',
  'gyeokguk',
  'tonggwan',
  'byeongyak',
  'siksangFlow',
];

const AXIS_NAME_KO: Record<YongshinConsensusAxisName, string> = {
  eokbu: '억부',
  johu: '조후',
  gyeokguk: '격국',
  tonggwan: '통관',
  byeongyak: '병약',
  siksangFlow: '식상흐름',
};

function buildSajuNameSafetyProfile(params: {
  readonly rootDist: Record<ElementKey, number>;
  readonly yongshinElement: ElementKey | null;
  readonly heesinElement: ElementKey | null;
  readonly gisinElement: ElementKey | null;
  readonly gusinElement: ElementKey | null;
  readonly consensus?: YongshinConsensusScoreDetail;
  readonly consensusBoard?: YongshinConsensusScoreboard | null;
  readonly mode: ScoringPrecisionOverrides['yongshinMode'];
}): SajuNameSafetyProfile {
  const total = totalCount(params.rootDist);
  const yongshinRatio = total > 0 ? elementCount(params.rootDist, params.yongshinElement) / total : 0;
  const heesinRatio = total > 0 ? elementCount(params.rootDist, params.heesinElement) / total : 0;
  const gishinRatio = total > 0 ? elementCount(params.rootDist, params.gisinElement) / total : 0;
  const gusinRatio = total > 0 ? elementCount(params.rootDist, params.gusinElement) / total : 0;
  const conflictWeight = params.consensus
    ? (CONSENSUS_CONFLICT_WEIGHT[params.consensus.conflictLevel] ?? 0)
    : 0;
  const conflictSeverity = clamp(conflictWeight / CONSENSUS_CONFLICT_WEIGHT.high, 0, 1);
  const unclearFactor = params.consensus
    ? clamp(
        1 - Math.max(
          0,
          params.consensus.normalizedTopMargin ?? params.consensus.topMargin,
        ) / CONSENSUS_CLEAR_TOP_MARGIN,
        0,
        1,
      )
    : 0;
  const aggressiveReinforcement = clamp((yongshinRatio - Math.max(0.5, heesinRatio)) / 0.5, 0, 1);
  const harmfulRatio = clamp(gishinRatio * 0.6 + gusinRatio, 0, 1);
  const riskScore = Math.round(clamp(
    conflictSeverity * unclearFactor * 45
    + aggressiveReinforcement * conflictSeverity * 35
    + harmfulRatio * 35,
    0,
    100,
  ));

  const strategy = safetyStrategyFor(params.mode, aggressiveReinforcement);
  const conflictLevel = params.consensus?.conflictLevel;
  const aggressiveConflict = params.mode === 'consensus_aware'
    && conflictLevel !== undefined
    && (conflictLevel === 'medium' || conflictLevel === 'high')
    && aggressiveReinforcement >= 0.5;
  // consensus_aware refinement (informational): when reinforcement is thin
  // (yongshinRatio below the threshold) and the consensus is split across
  // 3+ competing elements at medium/high conflict, surface a dedicated
  // reason so the user can see *why* a balanced posture is being shown.
  // Medium/high conflict already prevents `safe` posture in the base
  // condition below, so this guard does not change posture itself —
  // the score haircut later in `computeYongshinScore` is what bends the
  // ranking, while this reason explains the bend in plain language.
  const competingCount = params.consensus?.competingElements.length ?? 0;
  const thinReinforcementInfo = params.mode === 'consensus_aware'
    && (conflictLevel === 'medium' || conflictLevel === 'high')
    && competingCount >= CONSENSUS_AWARE_MULTI_COMPETING_THRESHOLD
    && yongshinRatio < CONSENSUS_AWARE_THIN_REINFORCEMENT_RATIO;
  const baseSafe = riskScore <= 30
    && harmfulRatio <= 0.25
    && (!conflictLevel || conflictLevel === 'none' || conflictLevel === 'low');
  const posture: SajuNameSafetyProfile['posture'] = riskScore >= 60 || aggressiveConflict
    ? 'aggressive'
    : baseSafe
      ? 'safe'
      : 'balanced';

  const elementKo = (element: string): string => ({
    WOOD: '나무',
    FIRE: '불',
    EARTH: '흙',
    METAL: '쇠',
    WATER: '물',
  }[element] ?? element);
  const conflictKo = (level: string | undefined): string => ({
    none: '낮음',
    low: '낮음',
    medium: '중간',
    high: '높음',
  }[level ?? 'none'] ?? String(level ?? 'none'));
  const strategyKo = (value: string): string => ({
    legacy_direct_reinforcement: '기존 직접 보강 방식',
    safe_balance: '안정 균형 방식',
    aggressive_reinforcement: '강한 직접 보강 방식',
  }[value] ?? value);

  // Use colon-prefixed labels uniformly so downstream renderers can dedup
  // between this `reasons` list and the card's `supportingFeatures` list
  // via plain string equality. The risk-score line previously used a
  // space-only separator, which let the same value survive twice in the
  // rendered Set (`주의 신호: 19/100` vs `주의 신호 19/100`).
  const reasons: string[] = [
    `주의 신호: ${riskScore}/100`,
    `적용 방식: ${strategyKo(strategy)}`,
    `용신 보강 비율: ${Math.round(yongshinRatio * 100)}%`,
    `희신 보조 비율: ${Math.round(heesinRatio * 100)}%`,
    `기신 겹침 비율: ${Math.round(gishinRatio * 100)}%`,
    `구신 겹침 비율: ${Math.round(gusinRatio * 100)}%`,
  ];
  if (conflictLevel) {
    reasons.push(`용신 판단 충돌: ${conflictKo(conflictLevel)}`);
  }
  if (params.consensus?.competingElements.length) {
    reasons.push(`충돌 후보 오행: ${params.consensus.competingElements.map(elementKo).join(', ')}`);
  }
  // consensus_aware: surface per-axis recommendations so the user can see
  // exactly which methods disagreed (eokbu/johu/gyeokguk/tonggwan/byeongyak/
  // siksangFlow). We emit at most one compact line that fits within the
  // existing reasons listing — keeping output rendering bounded.
  if (params.mode === 'consensus_aware' && params.consensusBoard) {
    const axisLine = formatConsensusAxisLine(params.consensusBoard, elementKo);
    if (axisLine) {
      reasons.push(`축별 판단: ${axisLine}`);
    }
  }
  if (thinReinforcementInfo) {
    reasons.push('용신 판단이 갈리는 가운데 이름의 직접 보강 비율이 낮아 균형형으로 안내했어요.');
  }
  if (strategy === 'safe_balance') {
    reasons.push('용신 판단이 갈릴 때는 한쪽 기운만 과하게 키우지 않도록 균형을 우선했어요.');
  } else if (strategy === 'aggressive_reinforcement') {
    reasons.push('용신 판단이 갈리는 상태에서 한 오행 보강이 강하게 몰려 있어요.');
  }

  return {
    posture,
    strategy,
    riskScore,
    ...(conflictLevel ? { conflictLevel } : {}),
    competingElements: params.consensus?.competingElements ?? [],
    yongshinRatio,
    heesinRatio,
    gishinRatio,
    gusinRatio,
    reasons,
  };
}

/** Render the 6-axis recommendations as a single compact reasons line.
 *  Skips axes whose `element` is null (no recommendation produced).
 *  Returns an empty string when no axis surfaces an element so callers
 *  can no-op without emitting a stub line. */
function formatConsensusAxisLine(
  board: YongshinConsensusScoreboard,
  elementKo: (element: string) => string,
): string {
  const parts: string[] = [];
  for (const axis of CONSENSUS_AXIS_NAMES) {
    const detail = board[axis];
    if (!detail || !detail.element) continue;
    parts.push(`${AXIS_NAME_KO[axis]}=${elementKo(detail.element)}`);
  }
  return parts.join(', ');
}

export interface TenGodPositionContribution {
  readonly position: string;
  readonly source: 'cheongan' | 'jijiPrincipal' | 'hiddenStem';
  readonly group: string;
  readonly weight: number;
  readonly presence?: number;
  readonly visibility?: number;
  readonly stem?: string;
  readonly element?: ElementKey | null;
  readonly ratio?: number;
  readonly rank?: number;
}

export interface TenGodScoreDiagnostics {
  readonly requestedMode: TenGodScoreMode;
  readonly effectiveMode: TenGodScoreMode;
  readonly score: number;
  readonly normalization: TenGodScoreNormalization;
  readonly groupCounts: Record<string, number>;
  readonly totalGroups: number;
  readonly averageCount: number;
  readonly deviations: Record<string, number>;
  readonly elementWeights: Record<ElementKey, number>;
  readonly positionContributions: readonly TenGodPositionContribution[];
  readonly presenceCounts?: Record<string, number>;
  readonly visibilityCounts?: Record<string, number>;
  readonly expectedPresenceByChartShape?: number;
  readonly meanVisibilityPerPresence?: number;
  readonly visibilityDeviations?: Record<string, number>;
  readonly fallbackReason?: string;
}

// =========================================================================
//  1. BALANCE SCORE
//     Measures how evenly the five elements are distributed after
//     combining the saju chart distribution with the name's root elements.
// =========================================================================

/**
 * Computes the "optimal" sorted distribution given an initial sorted array
 * and a budget of extra counts to distribute.  The algorithm fills from the
 * bottom up: it raises the lowest values to the next level, then spreads
 * any remaining budget equally.
 */
function computeOptimalSorted(initialCounts: number[], resourceCount: number): number[] {
  const sortedCounts = [...initialCounts].sort((a, b) => a - b);
  let remaining = resourceCount;
  let level = 0;

  // Phase 1: raise the lowest elements up to match higher ones
  while (level < ELEMENT_KEYS.length - 1 && remaining > 0) {
    const gapToNextLevel = sortedCounts[level + 1] - sortedCounts[level];
    const elementsAtThisLevel = level + 1;

    if (gapToNextLevel === 0) { level++; continue; }

    const costToLevelUp = gapToNextLevel * elementsAtThisLevel;
    if (remaining >= costToLevelUp) {
      for (let index = 0; index <= level; index++) sortedCounts[index] += gapToNextLevel;
      remaining -= costToLevelUp;
      level++;
    } else {
      const equalShare = Math.floor(remaining / elementsAtThisLevel);
      const leftover   = remaining % elementsAtThisLevel;
      for (let index = 0; index <= level; index++) sortedCounts[index] += equalShare;
      for (let index = 0; index < leftover; index++) sortedCounts[index] += 1;
      remaining = 0;
    }
  }

  // Phase 2: spread any remaining budget evenly across all 5 elements
  if (remaining > 0) {
    const equalShare = Math.floor(remaining / 5);
    const leftover   = remaining % 5;
    for (let index = 0; index < 5; index++) sortedCounts[index] += equalShare;
    for (let index = 0; index < leftover; index++) sortedCounts[index] += 1;
  }

  return sortedCounts;
}

/**
 * Balance score: how close is the combined (saju + name) distribution
 * to the mathematically optimal distribution?
 *
 * - 100 = perfectly optimal
 * - Loses points for: mismatch distance, extra zeros, extra spread
 */
type BalanceMode = 'mathematical' | 'yongshin_first' | 'classical_jonggyeok_aware';

function computeBalanceScore(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
  mode: BalanceMode = 'mathematical',
  sajuOutput?: SajuOutputSummary | null,
): { score: number; isPassed: boolean; combined: Record<ElementKey, number> } {

  const initialDistribution = ELEMENT_KEYS.map(key => sajuDist[key] ?? 0);
  const rootCounts          = ELEMENT_KEYS.map(key => rootDist[key] ?? 0);
  const finalDistribution   = ELEMENT_KEYS.map((_, index) => initialDistribution[index] + rootCounts[index]);

  const rootTotal           = rootCounts.reduce((sum, count) => sum + count, 0);
  const optimalDistribution = computeOptimalSorted(initialDistribution, rootTotal);

  const finalSorted     = [...finalDistribution].sort((a, b) => a - b);
  const isOptimal       = finalSorted.every((value, index) => value === optimalDistribution[index]);

  const finalZeroCount   = finalDistribution.filter(value => value === 0).length;
  const optimalZeroCount = optimalDistribution.filter(value => value === 0).length;
  const finalSpread      = Math.max(...finalDistribution)   - Math.min(...finalDistribution);
  const optimalSpread    = Math.max(...optimalDistribution)  - Math.min(...optimalDistribution);

  let score: number;
  if (isOptimal) {
    score = 100;
  } else {
    const manhattanDistance = finalSorted.reduce((sum, value, index) => sum + Math.abs(value - optimalDistribution[index]), 0);
    score = clamp(
      100
        - BALANCE.penaltyPerMismatch   * Math.floor(manhattanDistance / 2)
        - BALANCE.penaltyPerExtraZero  * Math.max(0, finalZeroCount - optimalZeroCount)
        - BALANCE.penaltyPerExtraSpread * Math.max(0, finalSpread - optimalSpread),
      0, 100,
    );
  }

  // ── Opt-in mode adjustments ─────────────────────────────────────────────
  // Default 'mathematical' is unchanged from the original implementation.
  // 'yongshin_first': add a small bonus for name elements that match the
  //                   chart's yongshin element (≈ 5 per matched count, capped).
  // 'classical_jonggyeok_aware': in 종격 charts, lift the score floor so
  //                              the deficiency-fill heuristic doesn't
  //                              wrongly fault concentration patterns.
  if (mode === 'yongshin_first') {
    const yongshinElement = elementFromSajuCode(sajuOutput?.yongshin?.finalYongshin);
    if (yongshinElement) {
      const yongshinNameCount = rootDist[yongshinElement] ?? 0;
      score = clamp(score + yongshinNameCount * 5, 0, 100);
    }
  } else if (mode === 'classical_jonggyeok_aware') {
    const gyeokguk = sajuOutput?.gyeokguk;
    if (gyeokguk?.category === PENALTY.jonggyeokCategory
      && (gyeokguk.confidence ?? 0) >= PENALTY.gyeokgukMinConfidence) {
      score = Math.max(score, 70);
    }
  }

  return {
    score,
    isPassed: isOptimal || (finalZeroCount <= optimalZeroCount && finalSpread <= optimalSpread && score >= BALANCE.minPassingScore),
    combined: Object.fromEntries(ELEMENT_KEYS.map((key, index) => [key, finalDistribution[index]])) as Record<ElementKey, number>,
  };
}

// =========================================================================
//  2. YONGSHIN SCORE
//     Measures how strongly the name's elements align with the recommended
//     yongshin (helpful) and heesin (supporting) elements, while penalizing
//     gisin (harmful) and gusin (most harmful).
// =========================================================================

/**
 * Scores how well the name matches the detailed recommendations from the
 * saju engine (e.g., EOKBU, JOHU, TONGGWAN — various analysis methods).
 * Each recommendation has its own confidence and method-type weight.
 */
function computeRecommendationScore(
  rootDist: Record<ElementKey, number>,
  yongshinData: SajuYongshinSummary,
  yongshinTypeWeights: Record<string, number>,
): { score: number; contextualPriority: number } | null {
  if (yongshinData.recommendations.length === 0) return null;

  let weightedSum     = 0;
  let totalWeight     = 0;
  let contextWeight   = 0;

  for (const recommendation of yongshinData.recommendations) {
    const primaryElement   = elementFromSajuCode(recommendation.primaryElement);
    const secondaryElement = elementFromSajuCode(recommendation.secondaryElement);
    if (!primaryElement && !secondaryElement) continue;

    const confidence      = Number.isFinite(recommendation.confidence)
      ? clamp(recommendation.confidence, 0, 1)
      : YONGSHIN.recommendationScoring.fallbackConfidence;
    const typeWeight      = Math.max(
      YONGSHIN.recommendationScoring.minWeight,
      confidence * (yongshinTypeWeights[recommendation.type] ?? DEFAULT_TYPE_WEIGHT),
    );

    weightedSum += weightedElementAverage(rootDist, element => {
      if (primaryElement   && element === primaryElement)   return YONGSHIN.recommendationScoring.primaryWeight;
      if (secondaryElement && element === secondaryElement) return YONGSHIN.recommendationScoring.secondaryWeight;
      return 0;
    }) * typeWeight;

    totalWeight += typeWeight;
    if (CONTEXTUAL_TYPES.includes(recommendation.type)) contextWeight += typeWeight;
  }

  if (totalWeight <= 0) return null;
  return {
    score:              clamp((weightedSum / totalWeight) * 100, 0, 100),
    contextualPriority: clamp(contextWeight / totalWeight, 0, 1),
  };
}

/**
 * Computes the full yongshin sub-score by:
 *   1. Calculating an "affinity" value — how much the name's elements lean
 *      toward helpful vs. harmful gods
 *   2. Blending with detailed recommendation scores (if available)
 *   3. Scaling the result by the saju engine's confidence
 *   4. Computing penalties for gisin/gusin presence
 */
function computeYongshinScore(
  rootDist: Record<ElementKey, number>,
  yongshinData: SajuYongshinSummary | null,
  yongshinTypeWeights: Record<string, number>,
  mode: 'classical_blend' | 'chengbai_strict' | 'consensus_aware' = 'classical_blend',
): YongshinScoreResult {
  if (!yongshinData) return {
    score: 50, confidence: 0, contextualPriority: 0,
    gisinPenalty: 0, gusinPenalty: 0, gusinRatio: 0,
    elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
    consensus: undefined,
    safetyProfile: undefined,
  };

  // Resolve the four key elements from the yongshin analysis
  const yongshinElement = elementFromSajuCode(yongshinData.finalYongshin);
  const heesinElement   = elementFromSajuCode(yongshinData.finalHeesin);
  const gisinElement    = elementFromSajuCode(yongshinData.gisin);
  const gusinElement    = elementFromSajuCode(yongshinData.gusin);

  const confidence = Number.isFinite(yongshinData.finalConfidence)
    ? clamp(yongshinData.finalConfidence, 0, 1)
    : DEFAULT_CONFIDENCE;
  const consensus = yongshinData.consensus
    ? {
        conflictLevel: yongshinData.consensus.final.conflictLevel,
        competingElements: yongshinData.consensus.final.competingElements,
        confidence: yongshinData.consensus.final.confidence,
        topMargin: yongshinData.consensus.final.topMargin,
        ...(yongshinData.consensus.final.normalizedTopMargin !== undefined
          ? { normalizedTopMargin: yongshinData.consensus.final.normalizedTopMargin }
          : {}),
        ...(yongshinData.consensus.final.methodDisagreementRatio !== undefined
          ? { methodDisagreementRatio: yongshinData.consensus.final.methodDisagreementRatio }
          : {}),
        scoreGuardApplied: false,
      }
    : undefined;

  // Step 1: Affinity — weighted average of how each name element aligns
  //   yongshin = +1, heesin = +0.65, gisin = -0.65, gusin = -1
  const affinityWeights = YONGSHIN.affinityWeights;
  const affinityValue = weightedElementAverage(rootDist, element => {
    if (gusinElement    && element === gusinElement)    return affinityWeights.gusin;
    if (gisinElement    && element === gisinElement)    return affinityWeights.gisin;
    if (yongshinElement && element === yongshinElement) return affinityWeights.yongshin;
    if (heesinElement   && element === heesinElement)   return affinityWeights.heesin;
    return 0;
  });

  // Step 2: Blend affinity with recommendation scores
  const recommendationResult = computeRecommendationScore(rootDist, yongshinData, yongshinTypeWeights);
  const affinityScore        = normalizeSignedScore(affinityValue);
  let blendedRawScore        = recommendationResult === null
    ? affinityScore
    : YONGSHIN.recommendationBlend.affinityRatio        * affinityScore
    + YONGSHIN.recommendationBlend.recommendationRatio  * recommendationResult.score;

  if (mode === 'consensus_aware' && consensus) {
    const conflictWeight = CONSENSUS_CONFLICT_WEIGHT[consensus.conflictLevel] ?? 0;
    const competingElements = consensus.competingElements
      .map((element) => elementFromSajuCode(element))
      .filter((element): element is ElementKey => Boolean(element));
    if (conflictWeight > 0) {
      const consensusAffinity = weightedElementAverage(rootDist, element => {
        if (yongshinElement && element === yongshinElement) return affinityWeights.yongshin;
        if (heesinElement && element === heesinElement) return affinityWeights.heesin;
        if (competingElements.includes(element)) return 0;
        return 0;
      });
      const guardedRawScore = (1 - conflictWeight) * blendedRawScore + conflictWeight * normalizeSignedScore(consensusAffinity);
      blendedRawScore = Math.min(blendedRawScore, guardedRawScore);
      consensus.scoreGuardApplied = true;
    }
  }

  // Step 3: Scale by confidence — higher confidence = more impact on the score
  const confidenceScaled = YONGSHIN.confidenceImpact.baseRatio + confidence * YONGSHIN.confidenceImpact.variableRatio;
  let score = clamp(50 + (blendedRawScore - 50) * confidenceScaled, 0, 100);

  const totalElements = totalCount(rootDist);
  const yongshinCount = elementCount(rootDist, yongshinElement);
  const heesinCount   = elementCount(rootDist, heesinElement);
  const gisinCount    = elementCount(rootDist, gisinElement);
  const gusinCount    = elementCount(rootDist, gusinElement);
  const gisinRatio    = totalElements > 0 ? gisinCount / totalElements : 0;
  const gusinRatio    = totalElements > 0 ? gusinCount / totalElements : 0;

  if (mode === 'consensus_aware' && consensus) {
    const conflictWeight = CONSENSUS_CONFLICT_WEIGHT[consensus.conflictLevel] ?? 0;
    if (conflictWeight > 0 && totalElements > 0) {
      const yongshinRatio = yongshinCount / totalElements;
      const heesinRatio = heesinCount / totalElements;
      const conflictSeverity = clamp(conflictWeight / CONSENSUS_CONFLICT_WEIGHT.high, 0, 1);
      const unclearFactor = clamp(
        1 - Math.max(0, consensus.normalizedTopMargin ?? consensus.topMargin)
          / CONSENSUS_CLEAR_TOP_MARGIN,
        0,
        1,
      );
      const aggressiveReinforcement = clamp((yongshinRatio - Math.max(0.5, heesinRatio)) / 0.5, 0, 1);
      score = clamp(
        score - CONSENSUS_AGGRESSIVE_REINFORCEMENT_MAX_PENALTY
          * conflictSeverity
          * unclearFactor
          * confidenceScaled
          * aggressiveReinforcement,
        0,
        100,
      );

      // Additional haircut when the consensus splits across 3+ competing
      // elements at high conflict — a stronger signal that even the
      // surviving recommendation is sensitive to method choice. Smaller
      // than the aggressive-reinforcement penalty above so it operates
      // as a refinement (not a doubling) and decays smoothly with
      // unclearFactor / confidence.
      if (
        consensus.conflictLevel === 'high'
        && consensus.competingElements.length >= CONSENSUS_AWARE_MULTI_COMPETING_THRESHOLD
      ) {
        score = clamp(
          score - CONSENSUS_AWARE_MULTI_COMPETING_MAX_PENALTY
            * unclearFactor
            * confidenceScaled,
          0,
          100,
        );
      }
    }
  }

  // chengbai_strict mode: low-confidence yongshin signals a likely 패격
  // pattern (until saju-ts surfaces an explicit chengbai score). Trim the
  // yongshin score by 10 below confidence 0.4 so candidates that match a
  // weak yongshin no longer rank as if it were certain.
  if ((mode === 'chengbai_strict' || mode === 'consensus_aware') && confidence < 0.4) {
    score = clamp(score - 10, 0, 100);
  }

  // Penalty scale: higher confidence = stricter penalty
  const penaltyScale = YONGSHIN.penalties.penaltyScaleBase + YONGSHIN.penalties.penaltyScaleVariable * confidence;
  const safetyProfile = buildSajuNameSafetyProfile({
    rootDist,
    yongshinElement,
    heesinElement,
    gisinElement,
    gusinElement,
    consensus,
    consensusBoard: yongshinData.consensus ?? null,
    mode,
  });

  return {
    score,
    confidence,
    contextualPriority: recommendationResult?.contextualPriority ?? 0,
    gisinPenalty: Math.round(gisinRatio * YONGSHIN.penalties.gisinMultiplier * penaltyScale),
    gusinPenalty: Math.round(gusinRatio * YONGSHIN.penalties.gusinMultiplier * penaltyScale),
    gusinRatio,
    consensus,
    safetyProfile,
    elementMatches: {
      yongshin: yongshinCount,
      heesin:   heesinCount,
      gisin:    gisinCount,
      gusin:    gusinCount,
    },
  };
}

// =========================================================================
//  3. STRENGTH SCORE
//     If the day master is "strong", the name should weaken it (and vice versa).
//     This score measures whether the name's elements push in the right direction.
// =========================================================================

function computeStrengthScore(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
  mode: 'binary' | 'continuous' = 'binary',
): { score: number; alignedCount: number; opposedCount: number; alignedElements: ElementKey[]; opposedElements: ElementKey[] } {
  const strengthData  = sajuOutput?.strength;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  if (!strengthData || !dayMasterElement) {
    return { score: 50, alignedCount: 0, opposedCount: 0, alignedElements: [], opposedElements: [] };
  }

  // 'continuous' mode replaces the binary isStrong toggle with a graded
  // strength signal derived from totalSupport / totalOppose. Charts that
  // are nearly balanced (e.g., support 3.0 / oppose 2.9) no longer commit
  // to a hard "strong" verdict; the name's contribution scales smoothly
  // across the borderline.
  const support   = Math.abs(strengthData.totalSupport);
  const oppose    = Math.abs(strengthData.totalOppose);
  const totalMagnitude = support + oppose;
  const strongness = totalMagnitude > 0 ? (support - oppose) / totalMagnitude : 0; // [-1, 1]

  let alignedCount = 0;
  let opposedCount = 0;
  const alignedElements: ElementKey[] = [];
  const opposedElements: ElementKey[] = [];
  const balanceDirection = normalizeSignedScore(
    weightedElementAverage(rootDist, element => {
      const supportsStrength = (element === dayMasterElement || element === generatedBy(dayMasterElement));
      const count = elementCount(rootDist, element);
      if (supportsStrength !== strengthData.isStrong) {
        alignedCount += count;
        if (count > 0) alignedElements.push(element);
      } else {
        opposedCount += count;
        if (count > 0) opposedElements.push(element);
      }
      if (mode === 'continuous') {
        // Continuous: ideal alignment for a name element scales with how
        // strong/weak the chart actually is. supportsStrength → -strongness
        // (oppose strong charts, support weak ones); !supportsStrength → +strongness.
        return supportsStrength ? -strongness : strongness;
      }
      return (supportsStrength === strengthData.isStrong) ? -1 : 1;
    }),
  );

  // Intensity: how lopsided is the support/oppose ratio?
  const intensity = totalMagnitude > 0
    ? clamp(Math.abs(support - oppose) / totalMagnitude, 0, 1)
    : STRENGTH.defaultIntensity;

  // Final score: centered at 50, scaled by intensity
  return {
    score: clamp(
      50 + (balanceDirection - 50) * (STRENGTH.confidenceImpact.baseRatio + intensity * STRENGTH.confidenceImpact.variableRatio),
      0, 100,
    ),
    alignedCount,
    opposedCount,
    alignedElements,
    opposedElements,
  };
}

// =========================================================================
//  4. TEN GOD SCORE
//     The ten gods form five groups (friend, output, wealth, authority, resource).
//     This score rewards names whose elements compensate for under-represented
//     groups in the chart.
// =========================================================================

function emptyTenGodGroupCounts(): Record<string, number> {
  return Object.fromEntries(TEN_GOD_GROUPS.map((group) => [group, 0]));
}

function emptyElementWeights(): Record<ElementKey, number> {
  return { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
}

const TEN_GOD_V1_HIDDEN_WEIGHTS = [1.2, 0.7, 0.45] as const;
const TEN_GOD_V2_SOURCE_VISIBILITY = {
  cheongan: 4.0,
  jijiPrincipal: 1.8,
  hiddenStemByRank: TEN_GOD_V1_HIDDEN_WEIGHTS,
} as const;
const TEN_GOD_V2_PILLAR_VISIBILITY: Record<string, number> = {
  year: 0.85,
  month: 1.35,
  day: 1.05,
  hour: 0.75,
};
const TEN_GOD_V2_VISIBILITY_DEVIATION_WEIGHT = 0.5;

function hiddenStemPresence(ratio: number | undefined): number {
  if (ratio == null || !Number.isFinite(ratio)) return 1;
  return clamp(ratio > 1 ? ratio / 100 : ratio, 0, 1);
}

export function computeTenGodScoreDiagnostics(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
  mode: TenGodScoreMode = 'simple_count',
): TenGodScoreDiagnostics {
  const tenGodData       = sajuOutput?.tenGod;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  let normalization: TenGodScoreNormalization = 'deviation_from_average_count';
  if (!tenGodData || !dayMasterElement) {
    return {
      requestedMode: mode,
      effectiveMode: mode,
      score: 50,
      normalization,
      groupCounts: emptyTenGodGroupCounts(),
      totalGroups: 0,
      averageCount: 0,
      deviations: emptyTenGodGroupCounts(),
      elementWeights: emptyElementWeights(),
      positionContributions: [],
      fallbackReason: 'missing_ten_god_or_day_master',
    };
  }

  // 'simple_count' (default): use the pre-aggregated groupCounts.
  // 'positional_weighted': re-derive groupCounts from byPosition with
  //   pillar-specific weights (saju_master/career_matrix.py:62-75):
  //     천간 (cheongan)        4.0
  //     지지 정기 (principal)   1.8
  //     지장간 (hidden) by ratio  1.2 / 0.7 / 0.45
  //   Falls through to simple_count when byPosition is unavailable.
  let groupCounts: Record<string, number>;
  let effectiveMode: TenGodScoreMode = mode;
  let fallbackReason: string | undefined;
  const positionContributions: TenGodPositionContribution[] = [];
  let presenceCounts: Record<string, number> | undefined;
  let visibilityCounts: Record<string, number> | undefined;
  if (mode === 'positional_weighted' && tenGodData.byPosition) {
    groupCounts = emptyTenGodGroupCounts();
    const addContribution = (
      contribution: TenGodPositionContribution,
    ): void => {
      groupCounts[contribution.group] = (groupCounts[contribution.group] ?? 0) + contribution.weight;
      positionContributions.push(contribution);
    };
    for (const [position, positionInfo] of Object.entries(tenGodData.byPosition)) {
      if (!positionInfo) continue;
      if (positionInfo.cheonganGroup) {
        addContribution({
          position,
          source: 'cheongan',
          group: positionInfo.cheonganGroup,
          weight: 4.0,
        });
      }
      if (positionInfo.jijiPrincipalGroup) {
        addContribution({
          position,
          source: 'jijiPrincipal',
          group: positionInfo.jijiPrincipalGroup,
          weight: 1.8,
        });
      }
      const sortedHidden = (positionInfo.hiddenStems ?? []).slice().sort((a, b) => b.ratio - a.ratio);
      sortedHidden.forEach((hs, i) => {
        if (hs.group && i < TEN_GOD_V1_HIDDEN_WEIGHTS.length) {
          addContribution({
            position,
            source: 'hiddenStem',
            stem: hs.stem,
            element: hs.element,
            ratio: hs.ratio,
            rank: i + 1,
            group: hs.group,
            weight: TEN_GOD_V1_HIDDEN_WEIGHTS[i],
          });
        }
      });
    }
  } else if (mode === 'positional_weighted_v2' && tenGodData.byPosition) {
    normalization = 'presence_visibility_expected_by_chart_shape';
    presenceCounts = emptyTenGodGroupCounts();
    visibilityCounts = emptyTenGodGroupCounts();
    groupCounts = visibilityCounts;
    const addContribution = (
      contribution: TenGodPositionContribution & { readonly presence: number; readonly visibility: number },
    ): void => {
      presenceCounts![contribution.group] = (presenceCounts![contribution.group] ?? 0) + contribution.presence;
      visibilityCounts![contribution.group] = (visibilityCounts![contribution.group] ?? 0) + contribution.visibility;
      positionContributions.push(contribution);
    };
    for (const [position, positionInfo] of Object.entries(tenGodData.byPosition)) {
      if (!positionInfo) continue;
      const pillarVisibility = TEN_GOD_V2_PILLAR_VISIBILITY[position] ?? 1;
      if (positionInfo.cheonganGroup) {
        const presence = 1;
        const visibility = presence * TEN_GOD_V2_SOURCE_VISIBILITY.cheongan * pillarVisibility;
        addContribution({
          position,
          source: 'cheongan',
          group: positionInfo.cheonganGroup,
          weight: visibility,
          presence,
          visibility,
        });
      }
      if (positionInfo.jijiPrincipalGroup) {
        const presence = 1;
        const visibility = presence * TEN_GOD_V2_SOURCE_VISIBILITY.jijiPrincipal * pillarVisibility;
        addContribution({
          position,
          source: 'jijiPrincipal',
          group: positionInfo.jijiPrincipalGroup,
          weight: visibility,
          presence,
          visibility,
        });
      }
      const sortedHidden = (positionInfo.hiddenStems ?? []).slice().sort((a, b) => b.ratio - a.ratio);
      sortedHidden.forEach((hs, i) => {
        if (hs.group && i < TEN_GOD_V2_SOURCE_VISIBILITY.hiddenStemByRank.length) {
          const presence = hiddenStemPresence(hs.ratio);
          const visibility = presence * TEN_GOD_V2_SOURCE_VISIBILITY.hiddenStemByRank[i] * pillarVisibility;
          addContribution({
            position,
            source: 'hiddenStem',
            stem: hs.stem,
            element: hs.element,
            ratio: hs.ratio,
            rank: i + 1,
            group: hs.group,
            weight: visibility,
            presence,
            visibility,
          });
        }
      });
    }
  } else {
    groupCounts = { ...tenGodData.groupCounts };
    if (mode === 'positional_weighted' || mode === 'positional_weighted_v2') {
      effectiveMode = 'simple_count';
      fallbackReason = 'byPosition_unavailable';
    }
  }

  const totalGroups = TEN_GOD_GROUPS.reduce((sum, group) => sum + (groupCounts[group] ?? 0), 0);
  if (totalGroups <= 0) {
    return {
      requestedMode: mode,
      effectiveMode,
      score: 50,
      normalization,
      groupCounts,
      totalGroups,
      averageCount: 0,
      deviations: emptyTenGodGroupCounts(),
      elementWeights: emptyElementWeights(),
      positionContributions,
      presenceCounts,
      visibilityCounts,
      fallbackReason: fallbackReason ?? 'zero_total_group_count',
    };
  }

  const averageCount = totalGroups / TEN_GOD_GROUPS.length;

  // For each ten-god group, compute how deficient it is relative to the average.
  // Map that deficiency to the corresponding element (based on cycle position).
  const elementWeights = emptyElementWeights();
  const deviations = emptyTenGodGroupCounts();
  let expectedPresenceByChartShape: number | undefined;
  let meanVisibilityPerPresence: number | undefined;
  let visibilityDeviations: Record<string, number> | undefined;
  const totalPresence = presenceCounts
    ? TEN_GOD_GROUPS.reduce((sum, group) => sum + (presenceCounts![group] ?? 0), 0)
    : 0;
  for (const group of TEN_GOD_GROUPS) {
    let deviation: number;
    if (normalization === 'presence_visibility_expected_by_chart_shape' && presenceCounts && visibilityCounts) {
      expectedPresenceByChartShape ??= totalPresence / TEN_GOD_GROUPS.length;
      meanVisibilityPerPresence ??= totalGroups / Math.max(totalPresence, 1);
      visibilityDeviations ??= emptyTenGodGroupCounts();
      const presenceCount = presenceCounts[group] ?? 0;
      const visibilityCount = visibilityCounts[group] ?? 0;
      const presenceDeviation = (
        (expectedPresenceByChartShape - presenceCount)
        / Math.max(expectedPresenceByChartShape, 1)
      );
      const expectedVisibilityForObservedPresence = presenceCount * meanVisibilityPerPresence;
      const visibilityDeviation = presenceCount > 0
        ? (
            (expectedVisibilityForObservedPresence - visibilityCount)
            / Math.max(expectedVisibilityForObservedPresence, 1)
          )
        : 0;
      visibilityDeviations[group] = visibilityDeviation;
      deviation = presenceDeviation + TEN_GOD_V2_VISIBILITY_DEVIATION_WEIGHT * visibilityDeviation;
    } else {
      deviation = (averageCount - (groupCounts[group] ?? 0)) / Math.max(averageCount, 1);
    }
    deviations[group] = deviation;
    const targetElement = ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(dayMasterElement) + TEN_GOD_GROUPS.indexOf(group)) % 5];
    // Positive deviation = group is under-represented, so its element is desirable.
    // Negative deviation (over-represented) is scaled down to avoid over-penalizing.
    elementWeights[targetElement] += deviation >= 0 ? deviation : deviation * TEN_GOD.negativeScale;
  }

  const score = clamp(
    50 + weightedElementAverage(rootDist, element => clamp(elementWeights[element], -1, 1)) * TEN_GOD.maxInfluence,
    0, 100,
  );
  return {
    requestedMode: mode,
    effectiveMode,
    score,
    normalization,
    groupCounts,
    totalGroups,
    averageCount,
    deviations,
    elementWeights,
    positionContributions,
    presenceCounts,
    visibilityCounts,
    expectedPresenceByChartShape,
    meanVisibilityPerPresence,
    visibilityDeviations,
    fallbackReason,
  };
}

function roundEvidenceNumber(value: number | undefined): number | undefined {
  return value == null || !Number.isFinite(value)
    ? undefined
    : Number(value.toFixed(6));
}

function roundRecord<T extends string>(record: Record<T, number> | undefined): Record<T, number> | undefined {
  if (!record) return undefined;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, roundEvidenceNumber(value as number) ?? 0]),
  ) as Record<T, number>;
}

function toTenGodPositionEvidence(diagnostics: TenGodScoreDiagnostics | null): TenGodPositionEvidence | undefined {
  if (!diagnostics || diagnostics.fallbackReason === 'missing_ten_god_or_day_master') return undefined;
  const topContributions = diagnostics.positionContributions
    .slice()
    .sort((a, b) => (b.visibility ?? b.weight) - (a.visibility ?? a.weight))
    .slice(0, 5)
    .map((row): TenGodPositionEvidenceContribution => ({
      position: row.position,
      source: row.source,
      group: row.group,
      weight: roundEvidenceNumber(row.weight) ?? 0,
      ...(roundEvidenceNumber(row.presence) != null ? { presence: roundEvidenceNumber(row.presence) } : {}),
      ...(roundEvidenceNumber(row.visibility) != null ? { visibility: roundEvidenceNumber(row.visibility) } : {}),
      ...(row.stem ? { stem: row.stem } : {}),
      ...(row.element != null ? { element: row.element } : {}),
      ...(roundEvidenceNumber(row.ratio) != null ? { ratio: roundEvidenceNumber(row.ratio) } : {}),
      ...(row.rank != null ? { rank: row.rank } : {}),
    }));

  return {
    requestedMode: diagnostics.requestedMode,
    effectiveMode: diagnostics.effectiveMode,
    score: roundEvidenceNumber(diagnostics.score) ?? diagnostics.score,
    normalization: diagnostics.normalization,
    topContributions,
    groupCounts: roundRecord(diagnostics.groupCounts) ?? diagnostics.groupCounts,
    deviations: roundRecord(diagnostics.deviations) ?? diagnostics.deviations,
    elementWeights: roundRecord(diagnostics.elementWeights) ?? diagnostics.elementWeights,
    ...(roundRecord(diagnostics.presenceCounts) ? { presenceCounts: roundRecord(diagnostics.presenceCounts) } : {}),
    ...(roundRecord(diagnostics.visibilityCounts) ? { visibilityCounts: roundRecord(diagnostics.visibilityCounts) } : {}),
    ...(roundEvidenceNumber(diagnostics.expectedPresenceByChartShape) != null ? { expectedPresenceByChartShape: roundEvidenceNumber(diagnostics.expectedPresenceByChartShape) } : {}),
    ...(roundEvidenceNumber(diagnostics.meanVisibilityPerPresence) != null ? { meanVisibilityPerPresence: roundEvidenceNumber(diagnostics.meanVisibilityPerPresence) } : {}),
    ...(diagnostics.fallbackReason ? { fallbackReason: diagnostics.fallbackReason } : {}),
  };
}

// =========================================================================
//  ADAPTIVE WEIGHT RESOLUTION
//  The four sub-scores are not weighted equally.  When yongshin data is
//  highly confident and diverges from the balance score, we shift weight
//  from balance toward yongshin.
// =========================================================================

function resolveAdaptiveWeights(
  balanceScore: number,
  yongshinInfo: { score: number; confidence: number; contextualPriority: number },
  adaptiveOverride: Record<string, number> | null,
): { balance: number; yongshin: number; strength: number; tenGod: number } {

  // School-preset routing: when adaptiveOverride is null, the destructured
  // ADAPTIVE constant from saju-scoring.json is used (= default behavior).
  // When set, individual fields are overlaid on top of ADAPTIVE so the
  // preset only needs to declare values that diverge from default.
  const tuning = adaptiveOverride ? { ...ADAPTIVE, ...adaptiveOverride } : ADAPTIVE;

  // How much the yongshin score exceeds the balance score (normalized)
  const yongshinSurplusRatio = clamp((yongshinInfo.score - balanceScore) / tuning.shiftDivisor, 0, 1);
  const confidenceBound      = clamp(yongshinInfo.confidence, 0, 1);

  // The "weight shift" moves budget from balance to yongshin when warranted
  const weightShift =
    tuning.baseShiftRatio * yongshinSurplusRatio * (tuning.baseConfidenceRatio + tuning.confidenceWeight * confidenceBound)
    + tuning.confidenceBoost * confidenceBound * clamp(yongshinInfo.contextualPriority, 0, 1);

  return {
    balance:  clamp(tuning.balanceBase  - weightShift, tuning.balanceMin,  tuning.balanceMax),
    yongshin: clamp(tuning.yongshinBase + weightShift, tuning.yongshinMin, tuning.yongshinMax),
    strength: tuning.strengthFixed,
    tenGod:   tuning.tenGodFixed,
  };
}

// =========================================================================
//  PENALTIES & BONUSES
// =========================================================================

/**
 * Gyeokguk penalty: in a "jonggyeok" (종격) chart, using gisin/gusin
 * elements breaks the structural pattern and incurs an extra penalty.
 * This penalty intentionally stacks with the gisin/gusin penalties above
 * because in jonggyeok, harmful elements cause a "破格" (broken pattern).
 */
/** Per-종격 type penalty multiplier for `gyeokgukMode='multi_special'`.
 *  Captures classical doctrine that different 종격 patterns have different
 *  vulnerability to 破格 — values from saju_master/chengbai.py and
 *  spring-info/02_compatibility_scoring/05_penalties.md §4. Unknown types
 *  fall back to 1.0 (= same as the default jonggyeok_only behavior). */
const MULTI_SPECIAL_PENALTY_MULTIPLIERS: Record<string, number> = {
  CONG_SHA: 1.25,   // 종살격 — 살을 따르는 격, 강한 살 발현 시 가장 위험
  CONG_GUAN: 1.10,  // 종관격
  HUA_QI: 1.05,     // 화기격
  CONG_GE: 1.00,    // 종격 (일반)
  CONG_CAI: 1.00,   // 종재격
  CONG_YIN: 1.00,   // 종인격
  CONG_ER: 0.95,    // 종아격 — 식상이 자연 흐름
  CONG_BI: 0.90,    // 종비격 — 비겁이 동지
  ZHUAN_WANG: 0.85, // 전왕격 — dominant 자체가 매우 강해 약간의 gisin 도 흡수
};

function computeGyeokgukPenalty(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
  mode: 'jonggyeok_only' | 'multi_special' | 'chengbai_strict' = 'jonggyeok_only',
): number {
  const gyeokgukData = sajuOutput?.gyeokguk;
  if (!gyeokgukData) return 0;
  if (gyeokgukData.category !== PENALTY.jonggyeokCategory) return 0;

  // 'jonggyeok_only' (default) keeps the original cliff: penalty is 0
  // below confidence 0.5 and clamps the multiplier to [0.5, 1] above it.
  // 'chengbai_strict' replaces the cliff with a smooth tanh curve.
  // 'multi_special' keeps the cliff but applies a type-specific multiplier
  //   so 전왕격 (less vulnerable) and 종살격 (more vulnerable) no longer
  //   share an identical penalty.
  if (mode !== 'chengbai_strict' && gyeokgukData.confidence < PENALTY.gyeokgukMinConfidence) {
    return 0;
  }

  const gisinElement = elementFromSajuCode(sajuOutput?.yongshin?.gisin);
  const gusinElement = elementFromSajuCode(sajuOutput?.yongshin?.gusin);
  if (!gisinElement && !gusinElement) return 0;

  const totalElements = totalCount(rootDist);
  if (totalElements === 0) return 0;

  const gisinCount      = elementCount(rootDist, gisinElement);
  const gusinCount      = elementCount(rootDist, gusinElement);
  const harmfulRatio    = (gisinCount + gusinCount) / totalElements;

  const confidenceFactor = mode === 'chengbai_strict'
    // Smooth: 0 at confidence 0.0, 0.5 at confidence 0.5, ~1 at confidence 1.0.
    ? clamp(0.5 + 0.5 * Math.tanh((gyeokgukData.confidence - 0.5) * 4), 0, 1)
    // Default cliff: confidence ≥ 0.5 already gated above; clamp to [0.5, 1].
    : clamp(gyeokgukData.confidence, 0.5, 1);

  const typeMultiplier = mode === 'multi_special'
    ? (MULTI_SPECIAL_PENALTY_MULTIPLIERS[gyeokgukData.type] ?? 1.0)
    : 1.0;

  return Math.round(harmfulRatio * PENALTY.gyeokgukMaximum * confidenceFactor * typeMultiplier);
}

/**
 * Deficiency bonus: if the saju chart is deficient in an element and the
 * name provides it, and that element happens to be yongshin or heesin,
 * the name gets a small bonus.  This rewards names that serve double duty.
 */
function computeDeficiencyBonus(
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const deficientElements = sajuOutput?.deficientElements;
  if (!deficientElements?.length) return 0;

  const yongshinElement = elementFromSajuCode(sajuOutput?.yongshin?.finalYongshin);
  const heesinElement   = elementFromSajuCode(sajuOutput?.yongshin?.finalHeesin);

  let bonus = 0;
  for (const deficient of deficientElements) {
    const elementKey = elementFromSajuCode(deficient);
    if (!elementKey || elementCount(rootDist, elementKey) === 0) continue;

    if (elementKey === yongshinElement)    bonus += DEFICIENCY.yongshinMatch;
    else if (elementKey === heesinElement) bonus += DEFICIENCY.heesinMatch;
  }
  return Math.min(bonus, DEFICIENCY.maxBonus);
}

// =========================================================================
//  MAIN SCORING FUNCTION — composes all sub-scores into a final result
// =========================================================================

interface SajuNameScoreComputation {
  readonly scoreResult: SajuNameScoreResult;
  readonly tenGodDiagnostics: TenGodScoreDiagnostics;
}

function evidenceDirection(supporting: number, limiting: number): SajuNameEvidenceDirection {
  if (supporting > limiting) return 'supports';
  if (limiting > supporting) return 'limits';
  return 'mixed';
}

function presentElements(
  values: readonly string[] | undefined,
  rootDist: Record<ElementKey, number>,
): ElementKey[] {
  return [...new Set((values ?? [])
    .map((value) => elementFromSajuCode(value))
    .filter((value): value is ElementKey => value !== null && elementCount(rootDist, value) > 0))];
}

function computeSajuNameScoreWithDiagnostics(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
  presetOverride?: SchoolPresetData | null,
  scoringOverrides?: ScoringPrecisionOverrides,
): SajuNameScoreComputation {

  // School preset routing — null preset (the default for legacy callers)
  // means "use the saju-scoring.json defaults", which equals the 'korean'
  // preset's values exactly. Default-mode regression is therefore zero.
  const yongshinTypeWeights = presetOverride?.yongshinTypeWeights ?? DEFAULT_YONGSHIN_TYPE_WEIGHTS;
  const adaptiveOverride    = presetOverride?.adaptiveWeights ?? null;

  // --- Compute the four sub-scores ---
  const balanceResult   = computeBalanceScore(
    sajuDist, rootDist,
    scoringOverrides?.balanceMode ?? 'mathematical',
    sajuOutput,
  );
  const yongshinResult  = computeYongshinScore(
    rootDist, sajuOutput?.yongshin ?? null, yongshinTypeWeights,
    scoringOverrides?.yongshinMode ?? 'classical_blend',
  );
  const strengthResult  = computeStrengthScore(
    rootDist, sajuOutput,
    scoringOverrides?.strengthMode ?? 'binary',
  );
  const tenGodDiagnostics = computeTenGodScoreDiagnostics(
    rootDist, sajuOutput,
    scoringOverrides?.tenGodMode ?? 'simple_count',
  );
  const tenGodScore = tenGodDiagnostics.score;

  // --- Resolve adaptive weights (balance vs. yongshin trade-off) ---
  const weight = resolveAdaptiveWeights(balanceResult.score, yongshinResult, adaptiveOverride);

  // --- Weighted blend of all four sub-scores ---
  const weightedBaseScore = clamp(
    weight.balance  * balanceResult.score
    + weight.yongshin * yongshinResult.score
    + weight.strength * strengthResult.score
    + weight.tenGod   * tenGodScore,
    0, 100,
  );

  // --- Add deficiency bonus ---
  const deficiencyBonus = computeDeficiencyBonus(rootDist, sajuOutput);
  const adjustedScore   = clamp(weightedBaseScore + deficiencyBonus, 0, 100);

  // --- Subtract penalties ---
  // Note: gyeokguk penalty intentionally stacks with gisin/gusin penalties.
  // In jonggyeok charts, using gisin triggers a "破格" (broken pattern).
  const gyeokgukPenalty = computeGyeokgukPenalty(
    rootDist, sajuOutput,
    scoringOverrides?.gyeokgukMode ?? 'jonggyeok_only',
  );
  const totalPenalty    = yongshinResult.gisinPenalty + yongshinResult.gusinPenalty + gyeokgukPenalty;
  const score           = clamp(adjustedScore - totalPenalty, 0, 100);
  const filledDeficientElements = presentElements(sajuOutput?.deficientElements, rootDist);
  const reinforcedExcessiveElements = presentElements(sajuOutput?.excessiveElements, rootDist);
  const yongshinElements = {
    yongshin: elementFromSajuCode(sajuOutput?.yongshin?.finalYongshin),
    heesin: elementFromSajuCode(sajuOutput?.yongshin?.finalHeesin),
    gisin: elementFromSajuCode(sajuOutput?.yongshin?.gisin),
    gusin: elementFromSajuCode(sajuOutput?.yongshin?.gusin),
  };
  const deficiencyMatchedElements = filledDeficientElements.filter(
    (element) => element === yongshinElements.yongshin || element === yongshinElements.heesin,
  );
  const supportiveTenGodElements = ELEMENT_KEYS.filter(
    (element) => elementCount(rootDist, element) > 0 && (tenGodDiagnostics.elementWeights[element] ?? 0) > 0,
  );
  const limitingTenGodElements = ELEMENT_KEYS.filter(
    (element) => elementCount(rootDist, element) > 0 && (tenGodDiagnostics.elementWeights[element] ?? 0) < 0,
  );
  const sourceEvidence: SajuNameSourceEvidence = {
    policyVersion: NAMING_EVIDENCE_WEIGHT_POLICY.modelVersion,
    appliedWeights: { ...weight },
    componentScores: {
      balance: balanceResult.score,
      yongshin: yongshinResult.score,
      strength: strengthResult.score,
      tenGod: tenGodScore,
    },
    weightedContributions: {
      balance: weight.balance * balanceResult.score,
      yongshin: weight.yongshin * yongshinResult.score,
      strength: weight.strength * strengthResult.score,
      tenGod: weight.tenGod * tenGodScore,
    },
    decisionImpacts: {
      balance: weight.balance * Math.abs(balanceResult.score - 50) * 2,
      yongshin: weight.yongshin * Math.abs(yongshinResult.score - 50) * 2,
      strength: weight.strength * Math.abs(strengthResult.score - 50) * 2,
      tenGod: weight.tenGod * Math.abs(tenGodScore - 50) * 2,
    },
    balance: {
      direction: evidenceDirection(filledDeficientElements.length, reinforcedExcessiveElements.length),
      nameDistribution: { ...rootDist },
      combinedDistribution: { ...balanceResult.combined },
      filledDeficientElements,
      reinforcedExcessiveElements,
    },
    yongshin: {
      direction: evidenceDirection(
        yongshinResult.elementMatches.yongshin + yongshinResult.elementMatches.heesin,
        yongshinResult.elementMatches.gisin + yongshinResult.elementMatches.gusin,
      ),
      elements: yongshinElements,
      matches: { ...yongshinResult.elementMatches },
      confidence: yongshinResult.confidence,
    },
    strength: {
      direction: evidenceDirection(strengthResult.alignedCount, strengthResult.opposedCount),
      alignedCount: strengthResult.alignedCount,
      opposedCount: strengthResult.opposedCount,
      alignedElements: strengthResult.alignedElements,
      opposedElements: strengthResult.opposedElements,
    },
    tenGod: {
      direction: evidenceDirection(supportiveTenGodElements.length, limitingTenGodElements.length),
      supportiveElements: supportiveTenGodElements,
      limitingElements: limitingTenGodElements,
    },
    deficiency: {
      matchedElements: deficiencyMatchedElements,
      bonus: deficiencyBonus,
    },
    penalties: {
      gisin: yongshinResult.gisinPenalty,
      gusin: yongshinResult.gusinPenalty,
      gyeokguk: gyeokgukPenalty,
      total: totalPenalty,
    },
    gyeokgukProtection: {
      applicable: sajuOutput?.gyeokguk?.category === PENALTY.jonggyeokCategory,
      broken: gyeokgukPenalty > 0,
    },
  };

  // --- Pass/fail determination ---
  const isPassed =
    score >= PASSING.minScore
    && balanceResult.score >= PASSING.minBalanceScore
    && (sajuOutput?.yongshin == null || (yongshinResult.score >= PASSING.minYongshinScore && yongshinResult.gusinRatio < PASSING.maxGusinRatio));

  return {
    scoreResult: {
      score,
      isPassed,
      combined: balanceResult.combined,
      breakdown: {
        balance:  balanceResult.score,
        yongshin: yongshinResult.score,
        strength: strengthResult.score,
        tenGod:   tenGodScore,
        penalties: {
          gisin:    yongshinResult.gisinPenalty,
          gusin:    yongshinResult.gusinPenalty,
          gyeokguk: gyeokgukPenalty,
          total:    totalPenalty,
        },
        deficiencyBonus,
        elementMatches: yongshinResult.elementMatches,
        yongshinConsensus: yongshinResult.consensus,
        safetyProfile: yongshinResult.safetyProfile,
        sourceEvidence,
      },
    },
    tenGodDiagnostics,
  };
}

export function computeSajuNameScore(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
  presetOverride?: SchoolPresetData | null,
  scoringOverrides?: ScoringPrecisionOverrides,
): SajuNameScoreResult {
  return computeSajuNameScoreWithDiagnostics(
    sajuDist,
    rootDist,
    sajuOutput,
    presetOverride,
    scoringOverrides,
  ).scoreResult;
}

// =========================================================================
//  SajuCalculator — plugs into the name-ts evaluator framework
// =========================================================================

/** Hints surfaced from SajuCalculator into ctx.insights[SAJU_FRAME].details
 *  for spring-evaluator's `extractSajuPriority` to consume. PR8 introduces
 *  these so the evaluator's priority curve and unknown-hour guard can stay
 *  driven by precisionConfig without changing springEvaluateName's signature. */
export interface SajuEvaluatorHints {
  readonly sajuPriorityCurve?: 'linear' | 'tanh';
  readonly unknownHourGuard?: boolean;
  /** Multiplier applied when the normalized input-time uncertainty guard fires. */
  readonly unknownTimeSajuDamp?: number;
  /** Compatibility name: true for unknown hour or boundary-sensitive minute. */
  readonly isHourUnknown?: boolean;
  /** Evaluator priority extraction mode (PR-Q-7).
   *  - 'single' (default): existing balance + yongshin × confidence path.
   *  - 'multi_axis': replaces signal-strength priority with the
   *    `axisStrength` (PR9) weighted blend when ≥2 axes are present.
   *    Falls back to single-mode priority when axisStrength is unset
   *    or carries < 2 axes (information-poor → no degradation). */
  readonly evaluatorMode?: 'single' | 'multi_axis';
}

export const SAJU_CALCULATOR_NOT_READY = 'SAJU_CALCULATOR_NOT_READY' as const;

export type SajuCalculatorReadOperation =
  | 'backward'
  | 'getAnalysis'
  | 'getCombinedDistribution';

export type SajuCalculatorStateReason =
  | 'visit_required'
  | 'context_mismatch'
  | 'published_insight_mismatch';

export class SajuCalculatorStateError extends Error {
  readonly code = SAJU_CALCULATOR_NOT_READY;
  readonly retryable = false;

  constructor(
    readonly operation: SajuCalculatorReadOperation,
    readonly reason: SajuCalculatorStateReason,
  ) {
    super(
      reason === 'context_mismatch'
        ? `SajuCalculator.${operation}() requires the EvalContext used by the latest successful visit().`
        : reason === 'published_insight_mismatch'
          ? `SajuCalculator.${operation}() requires the SAJU_FRAME signal fields published by the latest successful visit().`
          : `SajuCalculator.${operation}() requires a successful visit() call when enabled.`,
    );
    this.name = 'SajuCalculatorStateError';
  }
}

export class SajuCalculator implements EvaluableCalculator {
  readonly id = 'saju';
  private scoreResult: SajuNameScoreResult | null = null;
  private tenGodDiagnostics: TenGodScoreDiagnostics | null = null;
  private completedContext: EvalContext | null = null;
  private publishedInsight: EvalContext['insights'][string] | null = null;
  private committedSignal: Readonly<CalculatorSignal> | null = null;
  private readonly elementSource: SajuNameElementSource;
  private readonly enabled: boolean;
  private readonly presetData: SchoolPresetData | null;
  private readonly scoringOverrides: ScoringPrecisionOverrides | undefined;
  private readonly evaluatorHints: SajuEvaluatorHints | undefined;
  private readonly elementStrategy: NameElementStrategy;
  private nameElements: ElementKey[] = [];
  private elementStrategyEvidence: NameElementStrategyEvidence | undefined;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
    private sajuDistribution: Record<ElementKey, number>,
    private sajuOutput: SajuOutputSummary | null,
    options: {
      readonly elementSource?: SajuNameElementSource;
      readonly enabled?: boolean;
      /** When true, route school-dependent weights through
       *  config/presets/<schoolPreset>.json instead of the saju-scoring.json
       *  defaults. Default false → no behavior change. */
      readonly useSchoolPreset?: boolean;
      readonly schoolPreset?: SchoolPresetName;
      /** Per-sub-score opt-in mode flags (PR5). Each unspecified field
       *  falls through to legacy default in computeSajuNameScore. */
      readonly scoringOverrides?: ScoringPrecisionOverrides;
      /** Conservative fallback for missing/invalid resource_element rows. */
      readonly elementStrategy?: NameElementStrategy;
      /** Hints forwarded to spring-evaluator via ctx.insights details (PR8). */
      readonly evaluatorHints?: SajuEvaluatorHints;
    } = {},
  ) {
    const schoolPreset = resolveSchoolPresetName(options.schoolPreset);
    this.elementSource = options.elementSource ?? 'resource';
    this.enabled = options.enabled ?? true;
    this.presetData = options.useSchoolPreset === true
      ? loadPreset(schoolPreset)
      : null;
    this.scoringOverrides = options.scoringOverrides;
    this.evaluatorHints = options.evaluatorHints;
    this.elementStrategy = options.elementStrategy ?? 'legacy';
  }

  private legacyElementOf(entry: HanjaEntry): ElementKey {
    if (this.elementSource === 'hangul') {
      return hangulElementFromSyllable(entry.hangul);
    }
    // The HanjaEntry.resource_element column can be empty or carry a non-
    // canonical string in older DB rows. Without this guard, the bare cast
    // would propagate `undefined` through distributionFromArrangement and
    // produce NaN scores. Fallback to Earth (neutral) and warn once.
    const raw = entry.resource_element;
    if (raw === 'Wood' || raw === 'Fire' || raw === 'Earth' || raw === 'Metal' || raw === 'Water') {
      return raw;
    }
    console.warn(
      `[spring-ts] Unknown resource_element ${JSON.stringify(raw)} for ` +
      `${entry.hangul}/${entry.hanja}; falling back to Earth.`,
    );
    return 'Earth';
  }

  private resolveElement(
    entry: HanjaEntry,
    scope: NameElementScope,
    index: number,
  ): NameElementResolutionEvidence {
    if (this.elementSource === 'hangul') {
      const selectedElement = hangulElementFromSyllable(entry.hangul);
      return {
        scope,
        index,
        hangul: entry.hangul,
        hanja: entry.hanja,
        selectedElement,
        source: 'hangulPhonetic',
        safety: 'safe',
        reason: 'Pure-Hangul mode uses the established Hangul phonetic element mapping.',
      };
    }

    const raw = entry.resource_element;
    if (isElementKey(raw)) {
      return {
        scope,
        index,
        hangul: entry.hangul,
        hanja: entry.hanja,
        selectedElement: raw,
        source: 'resourceElement',
        safety: 'safe',
        reason: 'Canonical resource_element was available on the Hanja row.',
      };
    }

    if (this.elementStrategy === 'safeFallback') {
      return {
        scope,
        index,
        hangul: entry.hangul,
        hanja: entry.hanja,
        selectedElement: hangulElementFromSyllable(entry.hangul),
        source: 'hangulPhonetic',
        safety: 'fallback',
        reason: 'Missing or invalid resource_element fell back to conservative Hangul phonetic evidence.',
      };
    }

    console.warn(
      `[spring-ts] Unknown resource_element ${JSON.stringify(raw)} for ` +
      `${entry.hangul}/${entry.hanja}; falling back to Earth.`,
    );
    return {
      scope,
      index,
      hangul: entry.hangul,
      hanja: entry.hanja,
      selectedElement: 'Earth',
      source: 'neutralEarth',
      safety: 'fallback',
      reason: 'Legacy fallback uses neutral Earth when resource_element is missing or invalid.',
    };
  }

  private buildElementStrategyEvidence(
    decisions: readonly NameElementResolutionEvidence[],
  ): NameElementStrategyEvidence | undefined {
    if (this.elementStrategy !== 'safeFallback') return undefined;
    const fallbackCount = decisions.filter((decision) => decision.safety === 'fallback').length;
    const aggressiveCount = decisions.filter((decision) => decision.safety === 'aggressive').length;
    return {
      requestedStrategy: this.elementStrategy,
      effectiveStrategy: 'safeFallback',
      safe: aggressiveCount === 0,
      fallbackCount,
      aggressiveCount,
      decisions,
    };
  }

  private resetComputedState(): void {
    this.scoreResult = null;
    this.tenGodDiagnostics = null;
    this.completedContext = null;
    this.publishedInsight = null;
    this.committedSignal = null;
    this.nameElements = [];
    this.elementStrategyEvidence = undefined;
  }

  private assertReady(
    operation: SajuCalculatorReadOperation,
    context?: EvalContext,
  ): void {
    if (!this.enabled) return;
    if (this.completedContext === null || this.scoreResult === null) {
      throw new SajuCalculatorStateError(operation, 'visit_required');
    }
    if (context !== undefined && context !== this.completedContext) {
      throw new SajuCalculatorStateError(operation, 'context_mismatch');
    }
  }

  private assertPublishedInsight(context: EvalContext): void {
    const currentInsight = context.insights[SAJU_FRAME];
    if (
      this.publishedInsight === null
      || this.committedSignal === null
      || currentInsight !== this.publishedInsight
      || currentInsight.frame !== this.committedSignal.frame
      || currentInsight.score !== this.committedSignal.score
      || currentInsight.isPassed !== this.committedSignal.isPassed
    ) {
      throw new SajuCalculatorStateError('backward', 'published_insight_mismatch');
    }
  }

  visit(ctx: EvalContext): void {
    this.resetComputedState();

    if (!this.enabled) {
      putInsight(ctx, SAJU_FRAME, 100, true, 'DISABLED_NO_SAJU_CONTEXT', {
        disabled: true,
        reason: 'missing-or-partial-birth-context',
      });
      return;
    }

    delete (ctx.insights as Record<string, unknown>)[SAJU_FRAME];

    const surnameDecisions = this.surnameEntries.map((entry, index) => this.resolveElement(entry, 'surname', index));
    const givenNameDecisions = this.givenNameEntries.map((entry, index) => this.resolveElement(entry, 'givenName', index));
    const allDecisions = [...surnameDecisions, ...givenNameDecisions];
    const arrangement = allDecisions.map(decision => decision.selectedElement);
    // Element match counts are computed from the full Korean name, including
    // the fixed surname. Publish the same scope so counts and evidence cannot
    // disagree when the surname carries a yongshin/gishin element.
    const nameElements = allDecisions.map(decision => decision.selectedElement);
    const elementStrategyEvidence = this.buildElementStrategyEvidence(allDecisions);
    const rootDist = distributionFromArrangement(
      arrangement,
    );
    const { scoreResult, tenGodDiagnostics } = computeSajuNameScoreWithDiagnostics(
      this.sajuDistribution, rootDist, this.sajuOutput,
      this.presetData,
      this.scoringOverrides,
    );
    putInsight(ctx, SAJU_FRAME, scoreResult.score, scoreResult.isPassed, 'SAJU+ELEMENT', {
      sajuDistribution: this.sajuDistribution,
      distributionSource: this.sajuOutput ? 'saju-ts' : 'fallback',
      elementDistribution: rootDist,
      combinedDistribution: scoreResult.combined,
      scoring: scoreResult.breakdown,
      tenGodPositionEvidence: toTenGodPositionEvidence(tenGodDiagnostics),
      elementStrategyEvidence,
      analysisOutput: this.sajuOutput,
      // PR8: surface evaluator hints so spring-evaluator's extractSajuPriority
      // can apply the curve / guard without changing springEvaluateName's signature.
      evaluatorHints: this.evaluatorHints,
    });
    const publishedInsight = ctx.insights[SAJU_FRAME];
    if (
      publishedInsight === undefined
      || publishedInsight.frame !== SAJU_FRAME
      || publishedInsight.score !== scoreResult.score
      || publishedInsight.isPassed !== scoreResult.isPassed
    ) {
      throw new Error('SajuCalculator.visit() could not verify its published SAJU_FRAME insight.');
    }
    const committedSignal: Readonly<CalculatorSignal> = Object.freeze({
      frame: SAJU_FRAME,
      score: scoreResult.score,
      isPassed: scoreResult.isPassed,
      weight: SAJU_SIGNAL_WEIGHT,
    });
    this.scoreResult = scoreResult;
    this.tenGodDiagnostics = tenGodDiagnostics;
    this.nameElements = nameElements;
    this.elementStrategyEvidence = elementStrategyEvidence;
    this.publishedInsight = publishedInsight;
    this.committedSignal = committedSignal;
    this.completedContext = ctx;
  }

  backward(ctx: EvalContext): CalculatorPacket {
    if (!this.enabled) {
      return { signals: [] };
    }
    this.assertReady('backward', ctx);
    this.assertPublishedInsight(ctx);
    return { signals: [{ ...this.committedSignal! }] };
  }

  getCombinedDistribution(): Record<ElementKey, number> {
    if (this.enabled) {
      this.assertReady('getCombinedDistribution');
      return this.scoreResult!.combined;
    }
    return Object.fromEntries(
      ELEMENT_KEYS.map((key) => [key, 0]),
    ) as Record<ElementKey, number>;
  }

  getAnalysis(): AnalysisDetail<SajuCompatibility> {
    if (!this.enabled) {
      return {
        type: 'Saju',
        score: 0,
        polarityScore: 0,
        elementScore: 0,
        data: {
          yongshinElement: '',
          heeshinElement: null,
          gishinElement: null,
          nameElements: [...this.surnameEntries, ...this.givenNameEntries]
            .map(entry => this.legacyElementOf(entry)),
          yongshinMatchCount: 0,
          gishinMatchCount: 0,
          dayMasterSupportScore: 0,
          affinityScore: 0,
        },
      };
    }

    this.assertReady('getAnalysis');
    const breakdown     = this.scoreResult!.breakdown;
    const elementMatches = breakdown?.elementMatches;
    const yongshinData  = this.sajuOutput?.yongshin;
    const tenGodPositionEvidence = toTenGodPositionEvidence(this.tenGodDiagnostics);
    return {
      type: 'Saju',
      score: this.scoreResult!.score,
      polarityScore: 0,
      elementScore: this.scoreResult!.score,
      data: {
        yongshinElement:       elementFromSajuCode(yongshinData?.finalYongshin) ?? '',
        heeshinElement:        elementFromSajuCode(yongshinData?.finalHeesin) ?? null,
        gishinElement:         elementFromSajuCode(yongshinData?.gisin) ?? null,
        nameElements:          this.nameElements.length > 0
          ? this.nameElements
          : [...this.surnameEntries, ...this.givenNameEntries]
            .map(entry => this.legacyElementOf(entry)),
        yongshinMatchCount:    elementMatches?.yongshin ?? 0,
        gishinMatchCount:      elementMatches?.gisin ?? 0,
        dayMasterSupportScore: breakdown?.strength ?? 0,
        affinityScore:         this.scoreResult!.score,
        yongshinConsensusConflictLevel: breakdown?.yongshinConsensus?.conflictLevel,
        yongshinConsensusCompetingElements: breakdown?.yongshinConsensus?.competingElements,
        safetyProfile: breakdown?.safetyProfile,
        sourceEvidence: breakdown?.sourceEvidence,
        elementStrategyEvidence: this.elementStrategyEvidence,
        tenGodPositionEvidence,
      },
    };
  }
}
