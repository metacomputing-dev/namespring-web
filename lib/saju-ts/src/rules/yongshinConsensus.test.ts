import { describe, expect, it } from 'vitest';

import type { Element } from '../core/cycle.js';
import {
  deriveYongshinConsensusDiagnostics,
  normalizedTopScoreMargin,
  type YongshinConsensusAxisVote,
  type YongshinConsensusRankingEntry,
} from './yongshinConsensus.js';

const ELEMENTS: readonly Element[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

function ranking(scores: readonly number[]): readonly YongshinConsensusRankingEntry[] {
  return scores.map((score, index) => ({
    element: ELEMENTS[index % ELEMENTS.length]!,
    score,
  }));
}

function axes(disagreeCount: number): readonly YongshinConsensusAxisVote[] {
  return Object.freeze(Array.from({ length: 6 }, (_, index) => Object.freeze({
    element: index < disagreeCount ? 'FIRE' as Element : 'WOOD' as Element,
  })));
}

describe('normalizedTopScoreMargin', () => {
  it('is invariant under positive scaling and translation', () => {
    const base = normalizedTopScoreMargin(ranking([2, 1.9, 1, 0.5, 0]));
    const scaled = normalizedTopScoreMargin(ranking([20, 19, 10, 5, 0]));
    const translated = normalizedTopScoreMargin(ranking([102, 101.9, 101, 100.5, 100]));

    expect(base).toBe(0.05);
    expect(scaled).toBe(base);
    expect(translated).toBe(base);
  });

  it('returns zero for a tie or a ranking without a measurable spread', () => {
    expect(normalizedTopScoreMargin(ranking([1, 1, 0, -1, -2]))).toBe(0);
    expect(normalizedTopScoreMargin(ranking([3, 3, 3, 3, 3]))).toBe(0);
    expect(normalizedTopScoreMargin(ranking([1]))).toBe(0);
  });

  it('stays finite for extreme finite scores', () => {
    expect(normalizedTopScoreMargin(ranking([
      Number.MAX_VALUE,
      0,
      -Number.MAX_VALUE,
    ]))).toBe(0.5);
    expect(normalizedTopScoreMargin(ranking([Number.MIN_VALUE, 0, 0]))).toBe(1);
  });
});

describe('deriveYongshinConsensusDiagnostics', () => {
  it('keeps selection clarity separate from unanimous method agreement', () => {
    const diagnostics = deriveYongshinConsensusDiagnostics(
      Object.freeze(ranking([1.0001, 1, 0.5, 0.25, 0])),
      axes(0),
    );

    expect(diagnostics.confidence).toBeLessThan(0.001);
    expect(diagnostics.methodDisagreementRatio).toBe(0);
    expect(diagnostics.conflictLevel).toBe('none');
    expect(diagnostics.competingElements).toEqual([]);
  });

  it.each([
    [1, 'low'],
    [2, 'low'],
    [3, 'medium'],
    [4, 'high'],
    [6, 'high'],
  ] as const)('classifies %i of 6 disagreeing axes as %s', (count, expected) => {
    const diagnostics = deriveYongshinConsensusDiagnostics(
      ranking([5, 4, 3, 2, 1]),
      axes(count),
    );

    expect(diagnostics.conflictLevel).toBe(expected);
    expect(diagnostics.disagreeAxisCount).toBe(count);
    expect(diagnostics.activeAxisCount).toBe(6);
  });

  it('ignores inactive axes and keeps competing elements unique', () => {
    const diagnostics = deriveYongshinConsensusDiagnostics(
      ranking([5, 4, 3, 2, 1]),
      [
        { element: 'WOOD' },
        { element: 'FIRE' },
        { element: 'FIRE' },
        { element: null },
        { element: null },
        { element: null },
      ],
    );

    expect(diagnostics.methodDisagreementRatio).toBe(0.666667);
    expect(diagnostics.conflictLevel).toBe('high');
    expect(diagnostics.competingElements).toEqual(['FIRE']);
  });

  it('does not mutate frozen ranking or axes', () => {
    const frozenRanking = Object.freeze(ranking([5, 4, 3, 2, 1]));
    const frozenAxes = axes(3);

    expect(() => deriveYongshinConsensusDiagnostics(frozenRanking, frozenAxes)).not.toThrow();
    expect(frozenRanking.map((entry) => entry.score)).toEqual([5, 4, 3, 2, 1]);
  });
});
