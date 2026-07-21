import type { Element } from '../core/cycle.js';

export type YongshinConsensusConflictLevel = 'none' | 'low' | 'medium' | 'high';

export interface YongshinConsensusRankingEntry {
  readonly element: Element;
  readonly score: number;
}

export interface YongshinConsensusAxisVote {
  readonly element: Element | null;
}

export interface YongshinConsensusDiagnostics {
  readonly element: Element;
  /** Raw producer-score gap retained for response compatibility. */
  readonly topMargin: number;
  /** Top-two gap divided by the full ranking spread, in the closed interval 0..1. */
  readonly normalizedTopMargin: number;
  /** Selection clarity only; this is not an expert-authority probability. */
  readonly confidence: number;
  /** Share of active method axes that select an element other than the final element. */
  readonly methodDisagreementRatio: number;
  readonly conflictLevel: YongshinConsensusConflictLevel;
  readonly competingElements: Element[];
  readonly activeAxisCount: number;
  readonly disagreeAxisCount: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round6(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= Number.MAX_SAFE_INTEGER / 1_000_000) return value;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function finiteScore(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function rawNonNegativeMargin(topScore: number, secondScore: number): number {
  const difference = topScore - secondScore;
  if (Number.isFinite(difference)) return Math.max(0, difference);
  return difference === Number.POSITIVE_INFINITY ? Number.MAX_VALUE : 0;
}

/**
 * Computes a dimensionless top-two margin without mutating the ranking.
 *
 * The ratio `(top - second) / (top - bottom)` is invariant under every
 * positive affine score transform `a*x+b`. Scaling by the largest absolute
 * score before subtraction also keeps finite extreme inputs away from
 * avoidable overflow.
 */
export function normalizedTopScoreMargin(
  ranking: readonly YongshinConsensusRankingEntry[],
): number {
  if (ranking.length < 2) return 0;

  const scores = ranking.map((entry) => finiteScore(entry.score));
  const scale = Math.max(...scores.map((score) => Math.abs(score)));
  if (!(scale > 0) || !Number.isFinite(scale)) return 0;

  const top = scores[0]! / scale;
  const second = scores[1]! / scale;
  const bottom = Math.min(...scores) / scale;
  const spread = top - bottom;
  if (!(spread > 0) || !Number.isFinite(spread)) return 0;

  const margin = top - second;
  if (!(margin > 0) || !Number.isFinite(margin)) return 0;
  return round6(clamp01(margin / spread));
}

export function deriveYongshinConsensusDiagnostics(
  ranking: readonly YongshinConsensusRankingEntry[],
  axes: readonly YongshinConsensusAxisVote[],
): YongshinConsensusDiagnostics {
  const top = ranking[0] ?? { element: 'WOOD' as Element, score: 0 };
  const second = ranking[1] ?? { element: top.element, score: top.score };
  const topScore = finiteScore(top.score);
  const secondScore = finiteScore(second.score);
  const normalizedTopMargin = normalizedTopScoreMargin(ranking);

  const activeAxes = axes.filter((axis) => axis.element !== null);
  const disagreeAxes = activeAxes.filter((axis) => axis.element !== top.element);
  const methodDisagreementRatio = activeAxes.length > 0
    ? disagreeAxes.length / activeAxes.length
    : 0;
  const conflictLevel: YongshinConsensusConflictLevel =
    disagreeAxes.length === 0 ? 'none' :
      methodDisagreementRatio >= 0.6 ? 'high' :
        methodDisagreementRatio >= 0.38 ? 'medium' :
          'low';

  return {
    element: top.element,
    topMargin: round6(rawNonNegativeMargin(topScore, secondScore)),
    normalizedTopMargin,
    confidence: normalizedTopMargin,
    methodDisagreementRatio: round6(methodDisagreementRatio),
    conflictLevel,
    competingElements: Array.from(new Set(
      disagreeAxes
        .map((axis) => axis.element)
        .filter((element): element is Element => element !== null),
    )),
    activeAxisCount: activeAxes.length,
    disagreeAxisCount: disagreeAxes.length,
  };
}
