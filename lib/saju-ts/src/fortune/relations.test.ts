import { describe, expect, it } from 'vitest';

import type { PillarIdx } from '../core/cycle.js';
import { buildFortuneRelations } from './relations.js';
import type { FortuneTimeline } from './types.js';

function pillar(stem: number, branch: number): PillarIdx {
  return { stem, branch } as PillarIdx;
}

describe('fortune.relations', () => {
  it('surfaces only relations where the luck pillar participates', () => {
    const natal = [
      pillar(0, 0), // Jia-Zi
      pillar(1, 1), // Yi-Chou
      pillar(2, 2), // Bing-Yin
      pillar(3, 3), // Ding-Mao
    ] as const;
    const timeline = {
      policy: {} as any,
      start: {} as any,
      decades: [{
        kind: 'DECADE',
        index: 0,
        startAgeYears: 1,
        endAgeYears: 10,
        pillar: pillar(5, 6), // Ji-Wu: Jia-Ji stem combination + Zi-Wu branch clash
      }],
      years: [],
    } as FortuneTimeline;

    const got = buildFortuneRelations(natal, timeline);
    const first = got.decades[0]!;

    expect(first.stemRelations).toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'HAP',
      natalPositions: ['year'],
      members: [0, 5],
    })]));
    expect(first.branchRelations).toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'CHUNG',
      natalPositions: ['year'],
      members: [0, 6],
    })]));
  });

  it('keeps natal-only relations out of the transit relation surface', () => {
    const natal = [
      pillar(0, 0), // Jia-Zi
      pillar(5, 6), // Ji-Wu: natal Jia-Ji combination + Zi-Wu clash already exists
      pillar(2, 2),
      pillar(3, 3),
    ] as const;
    const timeline = {
      policy: {} as any,
      start: {} as any,
      decades: [{
        kind: 'DECADE',
        index: 0,
        startAgeYears: 1,
        endAgeYears: 10,
        pillar: pillar(4, 4), // Wu-Chen: no relation with the natal sample above
      }],
      years: [],
    } as FortuneTimeline;

    const first = buildFortuneRelations(natal, timeline).decades[0]!;

    expect(first.stemRelations).not.toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'HAP',
      members: [0, 5],
    })]));
    expect(first.branchRelations).not.toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'CHUNG',
      members: [0, 6],
    })]));
  });
});