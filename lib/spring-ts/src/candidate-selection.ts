/**
 * Pure candidate-selection policy for SpringEngine.
 *
 * This module deliberately owns no repositories, candidate generation,
 * rejection accounting, or request defaults.  It receives fully evaluated
 * candidates and applies deterministic score formatting, Pareto selection,
 * diversity ordering, de-duplication, and page slicing.
 *
 * It is an internal module, not part of the package-root public API.
 */
import {
  isRecognizedHanjaGlyph,
  normalizeToOrthodoxHanja,
} from './hanja-annotations.js';
import { NAMING_SCORE_AXIS_POLICIES } from './naming-score-axis-policy.js';
import type {
  CandidateStrengthProfile,
  NameCharInput,
  NamingScoreVector,
  SpringCandidate,
  SpringCandidateSummary,
  SpringOptions,
  SpringReport,
} from './types.js';

/** Round a score to one decimal place. */
export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, roundScore(value)));
}

export function finiteScore(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clampScore(numeric) : null;
}

export function averageScores(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number =>
    typeof value === 'number' && Number.isFinite(value));
  if (!finite.length) return null;
  return clampScore(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}

function formatCandidateScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${roundScore(value)}점`
    : '자료 없음';
}

export function deriveCandidateStrengthProfile(
  vector: NamingScoreVector,
  paretoFrontier: boolean = false,
): CandidateStrengthProfile {
  const riskQuality = clampScore(100 - vector.risk);
  const profileRows: Array<{
    readonly id: CandidateStrengthProfile['id'];
    readonly label: string;
    readonly primaryAxis: CandidateStrengthProfile['primaryAxis'];
    readonly score: number | null;
    readonly axes: Array<keyof NamingScoreVector | 'riskQuality'>;
  }> = [
    {
      id: 'saju_reinforcement',
      label: '사주 보완형',
      primaryAxis: 'sajuFit',
      score: averageScores([vector.sajuFit, vector.yongshinFit, vector.elementBalance]),
      axes: ['sajuFit', 'yongshinFit', 'elementBalance'],
    },
    {
      id: 'phonetic_stability',
      label: '발음 안정형',
      primaryAxis: 'phonetic',
      score: averageScores([vector.phonetic, vector.familyFit, riskQuality]),
      axes: ['phonetic', 'familyFit', 'riskQuality'],
    },
    {
      id: 'era_balance',
      label: '시대 조화형',
      primaryAxis: 'eraFit',
      score: averageScores([vector.eraFit, riskQuality]),
      axes: ['eraFit', 'riskQuality'],
    },
    {
      id: 'legal_meaning',
      label: '법적·뜻풀이 확인형',
      primaryAxis: 'legal',
      score: averageScores([vector.legal, vector.hanjaMeaning, riskQuality]),
      axes: ['legal', 'hanjaMeaning', 'riskQuality'],
    },
    {
      id: 'risk_managed',
      label: '위험 관리형',
      primaryAxis: 'risk',
      score: riskQuality,
      axes: ['riskQuality'],
    },
    {
      id: 'balanced',
      label: '균형형',
      primaryAxis: 'balanced',
      score: averageScores([
        vector.legal,
        vector.sajuFit,
        vector.yongshinFit,
        vector.elementBalance,
        vector.hanjaMeaning,
        vector.phonetic,
        vector.eraFit,
        vector.familyFit,
        riskQuality,
      ]),
      axes: [
        'legal',
        'sajuFit',
        'yongshinFit',
        'elementBalance',
        'hanjaMeaning',
        'phonetic',
        'eraFit',
        'familyFit',
        'riskQuality',
      ],
    },
  ];
  const selected = profileRows
    .filter((row): row is typeof profileRows[number] & { readonly score: number } =>
      row.score !== null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0];

  if (!selected) {
    return {
      id: 'balanced',
      label: '균형형',
      primaryAxis: 'balanced',
      reasons: ['비교할 수 있는 점수 벡터 축이 아직 없어요.'],
      displayReasons: ['비교할 수 있는 점수 정보가 아직 없어요.'],
      paretoFrontier,
    };
  }

  const displayReasons = selected.axes.map((axis) => {
    const value = axis === 'riskQuality' ? riskQuality : vector[axis];
    const label = axis === 'riskQuality'
      ? '주의 신호 안정도'
      : NAMING_SCORE_AXIS_POLICIES[axis].profileLabel;
    return `${label} ${formatCandidateScore(value)}`;
  });

  return {
    id: selected.id,
    label: selected.label,
    primaryAxis: selected.primaryAxis,
    reasons: displayReasons,
    displayReasons,
    paretoFrontier,
  };
}

interface CandidateSelectionInfo {
  readonly score: number;
  readonly vector?: NamingScoreVector;
  readonly profile?: CandidateStrengthProfile;
  readonly popularityRank?: number | null;
  readonly givenHangul: string;
  readonly givenHanja: string;
  readonly syllables: readonly string[];
  readonly orthodoxHanjas: readonly string[];
}

/**
 * Canonical public presentation evidence order. API metadata imports this
 * exact tuple so runtime ranking and its disclosed contract cannot drift.
 */
export const CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2 = Object.freeze([
  'meaningConfidence',
  'risk',
  'popularityRank',
  'phonetic',
  'familyFit',
  'eraFit',
] as const);

type CandidatePresentationEvidenceAxis =
  typeof CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2[number];

const MISSING_SCORE_EVIDENCE_NEUTRAL_V2 = 50;

function candidatePresentationEvidenceValue(
  candidate: CandidateSelectionInfo,
  axis: CandidatePresentationEvidenceAxis,
): number {
  if (!candidate.vector) {
    return axis === 'popularityRank'
      ? Number.POSITIVE_INFINITY
      : MISSING_SCORE_EVIDENCE_NEUTRAL_V2;
  }
  const value = axis === 'meaningConfidence'
    ? candidate.vector.hanjaMeaning
    : axis === 'popularityRank'
      ? candidate.popularityRank
      : candidate.vector[axis];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // Missing usage statistics provide no popularity bonus but never remove a
  // candidate. Other bounded score axes use their disclosed neutral midpoint.
  return axis === 'popularityRank'
    ? Number.POSITIVE_INFINITY
    : MISSING_SCORE_EVIDENCE_NEUTRAL_V2;
}

/**
 * Presentation-only order inside a bounded raw-score window. It does not
 * mutate the spring-ts saju/naming score and does not reject rare names.
 * Practical naming evidence leads; the engine score remains visible.
 */
function compareCandidatePresentationEvidence(
  left: CandidateSelectionInfo,
  right: CandidateSelectionInfo,
): number {
  for (const axis of CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2) {
    const leftValue = candidatePresentationEvidenceValue(left, axis);
    const rightValue = candidatePresentationEvidenceValue(right, axis);
    const difference = axis === 'risk' || axis === 'popularityRank'
      ? leftValue - rightValue
      : rightValue - leftValue;
    if (difference !== 0) return difference;
  }

  return right.score - left.score;
}

/**
 * Minimal selection state paired with the original candidate payload.
 *
 * Keeping this projection independent from a hydrated report lets callers
 * order and rank validated candidates before materializing presentation DTOs.
 * This module is internal and the type is not re-exported from the package
 * root.
 */
export interface CandidateSelectionProjection<T> extends CandidateSelectionInfo {
  readonly source: T;
}

export interface RankedCandidateSelectionProjection<T>
  extends CandidateSelectionProjection<T> {
  /** Present only when Pareto mode explicitly classified the projection. */
  readonly paretoFrontier?: boolean;
  readonly rank: number;
}

interface CandidateSelectionProjectionResult<T>
  extends CandidateSelectionProjection<T> {
  readonly paretoFrontier?: boolean;
}

interface CandidateDiversityState {
  readonly profileCounts: Map<string, number>;
  readonly syllableCounts: Map<string, number>;
  readonly hanjaCounts: Map<string, number>;
  readonly hangulCounts: Map<string, number>;
  readonly hanjaNameCounts: Map<string, number>;
}

/**
 * Runtime limits for the opt-in candidate selection policy.
 *
 * Pareto dominance and diversity ordering are quadratic, so callers must
 * provide a finite, positive pool limit. Candidates outside that score-sorted
 * pool retain their stable score order and are not marked as frontier rows.
 */
export interface CandidateSelectionLimits {
  readonly paretoPoolLimit: number;
}

export interface CandidateNameDiversityInfo {
  readonly givenHangul: string;
  readonly givenHanja: string;
  readonly syllables: readonly string[];
  readonly orthodoxHanjas: readonly string[];
  readonly hasRepeatedSyllable: boolean;
  readonly hasRepeatedOrthodoxHanja: boolean;
}

function normalizedHanjaKey(hanja: string | undefined): string {
  const value = String(hanja ?? '').trim();
  return isRecognizedHanjaGlyph(value) ? normalizeToOrthodoxHanja(value) : '';
}

export function describeCandidateName(
  chars: readonly NameCharInput[],
): CandidateNameDiversityInfo {
  const syllables = chars.map((char) => String(char.hangul ?? '').trim()).filter(Boolean);
  const orthodoxHanjas = chars.map((char) => normalizedHanjaKey(char.hanja)).filter(Boolean);
  return {
    givenHangul: syllables.join(''),
    givenHanja: orthodoxHanjas.join(''),
    syllables,
    orthodoxHanjas,
    hasRepeatedSyllable: new Set(syllables).size < syllables.length,
    hasRepeatedOrthodoxHanja: new Set(orthodoxHanjas).size < orthodoxHanjas.length,
  };
}

function vectorDominates(a: NamingScoreVector, b: NamingScoreVector): boolean {
  const axisValues = (vector: NamingScoreVector): Array<number | null> => [
    vector.legal,
    vector.sajuFit,
    vector.yongshinFit,
    vector.elementBalance,
    vector.hanjaMeaning,
    vector.phonetic,
    vector.eraFit,
    vector.familyFit,
    100 - vector.risk,
  ];
  const aValues = axisValues(a);
  const bValues = axisValues(b);
  let comparable = 0;
  let strictlyBetter = false;
  for (let index = 0; index < aValues.length; index += 1) {
    const left = aValues[index];
    const right = bValues[index];
    if (left == null || right == null) continue;
    comparable += 1;
    if (left < right - 0.000001) return false;
    if (left > right + 0.000001) strictlyBetter = true;
  }
  return comparable >= 2 && strictlyBetter;
}

function emptyDiversityState(): CandidateDiversityState {
  return {
    profileCounts: new Map(),
    syllableCounts: new Map(),
    hanjaCounts: new Map(),
    hangulCounts: new Map(),
    hanjaNameCounts: new Map(),
  };
}

function diversityPenalty(info: CandidateSelectionInfo, state: CandidateDiversityState): number {
  let penalty = 0;
  penalty += (state.profileCounts.get(info.profile?.id ?? '') ?? 0) * 4;
  penalty += (state.hangulCounts.get(info.givenHangul) ?? 0) * 8;
  if (info.givenHanja) penalty += (state.hanjaNameCounts.get(info.givenHanja) ?? 0) * 8;
  for (const syllable of info.syllables) {
    penalty += Math.min(5, (state.syllableCounts.get(syllable) ?? 0) * 2.5);
  }
  for (const hanja of info.orthodoxHanjas) {
    penalty += Math.min(5, (state.hanjaCounts.get(hanja) ?? 0) * 2.5);
  }
  return penalty;
}

function recordDiversitySelection(
  info: CandidateSelectionInfo,
  state: CandidateDiversityState,
): void {
  const add = (map: Map<string, number>, key: string): void => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  };
  add(state.profileCounts, info.profile?.id ?? '');
  add(state.hangulCounts, info.givenHangul);
  add(state.hanjaNameCounts, info.givenHanja);
  for (const syllable of info.syllables) add(state.syllableCounts, syllable);
  for (const hanja of info.orthodoxHanjas) add(state.hanjaCounts, hanja);
}

function orderParetoCandidates<T>(
  items: readonly T[],
  useParetoFrontier: boolean,
  getInfo: (item: T) => CandidateSelectionInfo,
  withParetoFrontier: (item: T, paretoFrontier: boolean) => T,
  limits?: CandidateSelectionLimits,
): T[] {
  const sorted = items
    .map((item, originalIndex) => ({ item, originalIndex, info: getInfo(item) }))
    .sort((a, b) => b.info.score - a.info.score || a.originalIndex - b.originalIndex);
  if (!useParetoFrontier) return sorted.map((row) => row.item);

  if (!limits) {
    throw new RangeError('candidate selection limits are required in Pareto mode');
  }
  if (!Number.isInteger(limits.paretoPoolLimit) || limits.paretoPoolLimit <= 0) {
    throw new RangeError('paretoPoolLimit must be a positive integer');
  }

  const paretoPoolSize = Math.min(sorted.length, limits.paretoPoolLimit);
  const rows = sorted
    .slice(0, paretoPoolSize)
    .map((row, index) => ({ item: row.item, index, info: row.info }));
  const overflow = sorted.slice(paretoPoolSize);

  const frontier = new Set<number>();
  for (const row of rows) {
    const rowVector = row.info.vector;
    if (!rowVector) continue;
    const dominated = rows.some((other) =>
      other.index !== row.index
      && other.info.vector
      && vectorDominates(other.info.vector, rowVector));
    if (!dominated) frontier.add(row.index);
  }

  const state = emptyDiversityState();
  const remaining = [...rows];
  const ordered: T[] = [];

  while (remaining.length > 0) {
    const bestScore = Math.max(...remaining.map((row) => row.info.score));
    const window = remaining.filter((row) => row.info.score >= bestScore - 8);
    const selected = window
      .map((row) => {
        const frontierBonus = frontier.has(row.index) ? 3 : 0;
        const diversity = diversityPenalty(row.info, state);
        const profileNovelty =
          (state.profileCounts.get(row.info.profile?.id ?? '') ?? 0) === 0 ? 2 : 0;
        return {
          row,
          selectorScore: row.info.score + frontierBonus + profileNovelty - diversity,
        };
      })
      .sort((a, b) =>
        b.selectorScore - a.selectorScore
        || b.row.info.score - a.row.info.score
        || a.row.index - b.row.index)[0];

    const selectedIndex = remaining.findIndex((row) => row.index === selected.row.index);
    remaining.splice(selectedIndex, 1);
    recordDiversitySelection(selected.row.info, state);
    ordered.push(withParetoFrontier(selected.row.item, frontier.has(selected.row.index)));
  }

  return [
    ...ordered,
    ...overflow.map((row) => withParetoFrontier(row.item, false)),
  ];
}

function withParetoFlag(
  profile: CandidateStrengthProfile | undefined,
  paretoFrontier: boolean,
): CandidateStrengthProfile | undefined {
  return profile ? { ...profile, paretoFrontier } : undefined;
}

export function shouldUseParetoFrontier(options?: SpringOptions): boolean {
  return options?.precisionConfig?.paretoFrontierCandidates === true;
}

/**
 * Orders lightweight candidate projections without hydrating or de-duplicating
 * their source payloads. Ranking is global and therefore intentionally happens
 * before any caller-owned page slicing.
 */
export function orderCandidateSelectionProjections<T>(
  projections: readonly CandidateSelectionProjection<T>[],
  options?: SpringOptions,
  limits?: CandidateSelectionLimits,
): RankedCandidateSelectionProjection<T>[] {
  return orderParetoCandidates<CandidateSelectionProjectionResult<T>>(
    projections,
    shouldUseParetoFrontier(options),
    (projection) => projection,
    (projection, paretoFrontier) => ({ ...projection, paretoFrontier }),
    limits,
  ).map((projection, index) => ({ ...projection, rank: index + 1 }));
}

function selectionInfoForSpringReport(report: SpringReport): CandidateSelectionInfo {
  const diversity = describeCandidateName(
    report.namingReport.name.givenName.map((char) => ({
      hangul: char.hangul,
      hanja: char.hanja,
    })),
  );
  return {
    score: report.finalScore,
    vector: report.scoreVector,
    profile: report.strengthProfile,
    ...diversity,
  };
}

function selectionInfoForCandidateSummary(
  summary: SpringCandidateSummary,
): CandidateSelectionInfo {
  const diversity = describeCandidateName(summary.givenName);
  return {
    score: summary.finalScore,
    vector: summary.scoreVector,
    profile: summary.strengthProfile,
    popularityRank: summary.popularityRank,
    ...diversity,
  };
}

function selectionInfoForSpringCandidate(candidate: SpringCandidate): CandidateSelectionInfo {
  const diversity = describeCandidateName(
    candidate.name.givenName.map((char) => ({
      hangul: char.hangul,
      hanja: char.hanja,
    })),
  );
  return {
    score: candidate.scores.total,
    vector: candidate.scoreVector,
    profile: candidate.strengthProfile,
    ...diversity,
  };
}

export function orderSpringReports(
  results: readonly SpringReport[],
  options?: SpringOptions,
  limits?: CandidateSelectionLimits,
): SpringReport[] {
  const projections = results.map((report) => ({
    source: report,
    ...selectionInfoForSpringReport(report),
  }));
  return orderCandidateSelectionProjections(projections, options, limits)
    .map(({ source, ...selection }) => applySpringReportSelectionRanking(source, selection));
}

/**
 * Applies an already-computed global rank and optional Pareto classification
 * to a hydrated report. Keeping this decoration separate lets callers rank a
 * lightweight projection before constructing the presentation-heavy report.
 */
export function applySpringReportSelectionRanking(
  report: SpringReport,
  selection: Pick<RankedCandidateSelectionProjection<unknown>, 'rank' | 'paretoFrontier'>,
): SpringReport {
  const { paretoFrontier, rank } = selection;
  if (paretoFrontier === undefined) return { ...report, rank };

  const strengthProfile = withParetoFlag(report.strengthProfile, paretoFrontier);
  const namingStrengthProfile = withParetoFlag(
    report.namingReport.strengthProfile,
    paretoFrontier,
  );
  return {
    ...report,
    ...(strengthProfile ? { strengthProfile } : {}),
    namingReport: {
      ...report.namingReport,
      ...(namingStrengthProfile ? { strengthProfile: namingStrengthProfile } : {}),
    },
    rank,
  };
}

export function orderCandidateSummaries(
  results: readonly SpringCandidateSummary[],
  options?: SpringOptions,
  limits?: CandidateSelectionLimits,
): SpringCandidateSummary[] {
  const useParetoFrontier = shouldUseParetoFrontier(options);
  return orderParetoCandidates(
    results,
    useParetoFrontier,
    selectionInfoForCandidateSummary,
    (summary, paretoFrontier) => ({
      ...summary,
      ...(summary.strengthProfile
        ? { strengthProfile: withParetoFlag(summary.strengthProfile, paretoFrontier) }
        : {}),
    }),
    limits,
  ).map((summary, index) => ({ ...summary, rank: index + 1 }));
}

export function dedupeCandidateSummariesByHangul(
  results: readonly SpringCandidateSummary[],
): SpringCandidateSummary[] {
  return retainCandidateSummaryVariantsByHangul(results, 1);
}

/**
 * Keeps a bounded number of distinct Hanja identities for each Hangul reading
 * while preserving the caller's already-computed order (including Pareto
 * ordering). Exact Hanja duplicates never consume another variant slot.
 */
export function retainCandidateSummaryVariantsByHangul(
  results: readonly SpringCandidateSummary[],
  maxVariantsPerHangul: number,
): SpringCandidateSummary[] {
  if (!Number.isSafeInteger(maxVariantsPerHangul) || maxVariantsPerHangul <= 0) {
    throw new RangeError('maxVariantsPerHangul must be a positive safe integer');
  }
  const retainedHanjas = new Map<string, Set<string>>();
  const deduped: SpringCandidateSummary[] = [];
  for (const summary of results) {
    const hangulKey = summary.fullHangul || summary.givenHangul;
    const hanjaKey = describeCandidateName(summary.givenName).givenHanja || '__hangul_only__';
    const variants = retainedHanjas.get(hangulKey) ?? new Set<string>();
    if (variants.has(hanjaKey) || variants.size >= maxVariantsPerHangul) continue;
    variants.add(hanjaKey);
    retainedHanjas.set(hangulKey, variants);
    deduped.push(summary);
  }
  return deduped.map((summary, index) => ({ ...summary, rank: index + 1 }));
}

interface RetainedCandidateSummary {
  readonly summary: SpringCandidateSummary;
  readonly originalIndex: number;
  readonly orderingVector?: NamingScoreVector;
  readonly hanjaKey: string;
}

/**
 * Exact non-Pareto equivalent of score-sort -> Hangul de-duplication.
 *
 * Recommendation pools commonly contain many Hanja spellings for the same
 * Hangul name. Retaining only the winning spelling per Hangul key keeps mobile
 * memory proportional to distinct display rows while preserving the legacy
 * stable score order byte-for-byte. Pareto mode deliberately uses the full
 * pool because duplicate spellings participate in its frontier/diversity pass.
 */
export class DefaultCandidateSummaryAccumulator {
  private readonly winners = new Map<string, RetainedCandidateSummary[]>();
  private nextOriginalIndex = 0;

  constructor(
    private readonly maxVariantsPerHangul: number = 1,
    private readonly usePresentationEvidenceTieBreak: boolean = false,
    private readonly presentationScoreWindow: number = 0,
  ) {
    if (!Number.isSafeInteger(maxVariantsPerHangul) || maxVariantsPerHangul <= 0) {
      throw new RangeError('maxVariantsPerHangul must be a positive safe integer');
    }
    if (!Number.isFinite(presentationScoreWindow)
      || presentationScoreWindow < 0
      || presentationScoreWindow > 100) {
      throw new RangeError('presentationScoreWindow must be a finite score from 0 to 100');
    }
  }

  add(
    summary: SpringCandidateSummary,
    orderingVector: NamingScoreVector | undefined = summary.scoreVector,
  ): void {
    const originalIndex = this.nextOriginalIndex;
    this.nextOriginalIndex += 1;
    const hangulKey = summary.fullHangul || summary.givenHangul;
    const hanjaKey = describeCandidateName(summary.givenName).givenHanja || '__hangul_only__';
    const variants = this.winners.get(hangulKey) ?? [];
    const candidate: RetainedCandidateSummary = {
      summary,
      originalIndex,
      ...(this.usePresentationEvidenceTieBreak && orderingVector ? { orderingVector } : {}),
      hanjaKey,
    };
    const priorIndex = variants.findIndex((variant) => variant.hanjaKey === hanjaKey);
    if (priorIndex >= 0) {
      const prior = variants[priorIndex]!;
      if (this.compareRetained(candidate, prior) < 0) variants[priorIndex] = candidate;
    } else {
      variants.push(candidate);
    }
    variants.sort((left, right) => this.compareRetained(left, right));
    this.winners.set(hangulKey, variants.slice(0, this.maxVariantsPerHangul));
  }

  get retainedCount(): number {
    return [...this.winners.values()].reduce((total, variants) => total + variants.length, 0);
  }

  finish(): SpringCandidateSummary[] {
    const scoreOrdered = [...this.winners.values()]
      .flat()
      .sort((left, right) => this.compareRetained(left, right));
    const ordered = this.usePresentationEvidenceTieBreak
      ? this.orderPresentationWindows(scoreOrdered)
      : scoreOrdered;
    return ordered
      .map(({ summary }, index) => ({ ...summary, rank: index + 1 }));
  }

  private compareRetained(
    left: RetainedCandidateSummary,
    right: RetainedCandidateSummary,
  ): number {
    return right.summary.finalScore - left.summary.finalScore
      || left.originalIndex - right.originalIndex;
  }

  private comparePresentation(
    left: RetainedCandidateSummary,
    right: RetainedCandidateSummary,
  ): number {
    const leftInfo = {
      ...selectionInfoForCandidateSummary(left.summary),
      vector: left.orderingVector,
    };
    const rightInfo = {
      ...selectionInfoForCandidateSummary(right.summary),
      vector: right.orderingVector,
    };
    return compareCandidatePresentationEvidence(leftInfo, rightInfo)
      || left.originalIndex - right.originalIndex;
  }

  private orderPresentationWindows(
    scoreOrdered: readonly RetainedCandidateSummary[],
  ): RetainedCandidateSummary[] {
    const result: RetainedCandidateSummary[] = [];
    let start = 0;
    while (start < scoreOrdered.length) {
      const anchorScore = scoreOrdered[start]!.summary.finalScore;
      let end = start + 1;
      while (
        end < scoreOrdered.length
        && anchorScore - scoreOrdered[end]!.summary.finalScore <= this.presentationScoreWindow
      ) {
        end += 1;
      }
      const window = scoreOrdered.slice(start, end);
      result.push(...window
        .sort((left, right) => this.comparePresentation(left, right)));
      start = end;
    }
    return result;
  }
}

export function sliceCandidatePage<T>(
  results: readonly T[],
  offset: number,
  limit: number,
): T[] {
  if (
    !Number.isSafeInteger(offset)
    || offset < 0
    || !Number.isSafeInteger(limit)
    || limit <= 0
    || !Number.isSafeInteger(offset + limit)
  ) {
    throw new RangeError('Candidate pagination requires bounded integer offset and limit values.');
  }
  return results.slice(offset, offset + limit);
}

export function sliceAndRankCandidatePage<T extends { readonly rank: number }>(
  results: readonly T[],
  offset: number,
  limit: number,
): T[] {
  return sliceCandidatePage(results, offset, limit)
    .map((candidate, index) => ({ ...candidate, rank: offset + index + 1 }));
}

export function orderSpringCandidates(
  results: readonly SpringCandidate[],
  options?: SpringOptions,
  limits?: CandidateSelectionLimits,
): SpringCandidate[] {
  const useParetoFrontier = shouldUseParetoFrontier(options);
  return orderParetoCandidates(
    results,
    useParetoFrontier,
    selectionInfoForSpringCandidate,
    (candidate, paretoFrontier) => ({
      ...candidate,
      ...(candidate.strengthProfile
        ? { strengthProfile: withParetoFlag(candidate.strengthProfile, paretoFrontier) }
        : {}),
    }),
    limits,
  );
}
