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

  it('surfaces decade-year relations for the active decade of each year', () => {
    const natal = [pillar(1, 1), pillar(2, 2), pillar(3, 3), pillar(4, 4)] as const;
    const timeline = {
      policy: {} as any,
      start: {} as any,
      decades: [{
        kind: 'DECADE',
        index: 2,
        startAgeYears: 21,
        endAgeYears: 31,
        pillar: pillar(0, 0), // Jia-Zi
      }],
      years: [{
        kind: 'YEAR',
        solarYear: 2030,
        pillar: pillar(5, 6), // Ji-Wu
        startUtcMs: 0,
        endUtcMs: 1,
        approxStartAgeYears: 24,
        approxEndAgeYears: 25,
      }],
    } as FortuneTimeline;

    const entry = buildFortuneRelations(natal, timeline).decadeYears[0]!;

    expect(entry).toEqual(expect.objectContaining({
      luckKind: 'DECADE_YEAR',
      solarYear: 2030,
      decadeIndex: 2,
    }));
    expect(entry.stemRelations).toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'HAP',
      members: [0, 5],
      luckPositions: ['decade', 'year'],
    })]));
    expect(entry.branchRelations).toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'CHUNG',
      members: [0, 6],
      luckPositions: ['decade', 'year'],
    })]));
  });

  it('omits decade-year relations before the first decade is active', () => {
    const natal = [pillar(1, 1), pillar(2, 2), pillar(3, 3), pillar(4, 4)] as const;
    const timeline = {
      policy: {} as any,
      start: {} as any,
      decades: [{
        kind: 'DECADE',
        index: 0,
        startAgeYears: 3,
        endAgeYears: 13,
        pillar: pillar(0, 0),
      }],
      years: [{
        kind: 'YEAR',
        solarYear: 2000,
        pillar: pillar(5, 6),
        startUtcMs: 0,
        endUtcMs: 1,
        approxStartAgeYears: 0,
        approxEndAgeYears: 1,
      }],
    } as FortuneTimeline;

    expect(buildFortuneRelations(natal, timeline).decadeYears).toEqual([]);
  });

  it('keeps relations for every decade that overlaps a transition year', () => {
    const natal = [pillar(1, 1), pillar(2, 2), pillar(3, 3), pillar(4, 4)] as const;
    const timeline = {
      policy: {} as any,
      start: {} as any,
      decades: [
        {
          kind: 'DECADE',
          index: 0,
          startAgeYears: 1,
          endAgeYears: 11,
          pillar: pillar(0, 0), // Jia-Zi: Ji-Wu와 합·충
        },
        {
          kind: 'DECADE',
          index: 1,
          startAgeYears: 11,
          endAgeYears: 21,
          pillar: pillar(4, 0), // Wu-Zi: Ji-Wu와 지지 충
        },
      ],
      years: [{
        kind: 'YEAR',
        solarYear: 2010,
        pillar: pillar(5, 6), // Ji-Wu
        startUtcMs: 0,
        endUtcMs: 1,
        approxStartAgeYears: 10.8,
        approxEndAgeYears: 11.8,
      }],
    } as FortuneTimeline;

    const entries = buildFortuneRelations(natal, timeline).decadeYears;
    expect(entries.map((entry) => entry.decadeIndex)).toEqual([0, 1]);
  });

  it('does not discard a relation that exists only in the shorter overlap', () => {
    const natal = [pillar(1, 1), pillar(2, 2), pillar(3, 3), pillar(4, 4)] as const;
    const timeline = {
      policy: {} as any,
      start: {} as any,
      decades: [
        {
          kind: 'DECADE',
          index: 0,
          startAgeYears: 1,
          endAgeYears: 11,
          pillar: pillar(0, 0), // relation-bearing short overlap
        },
        {
          kind: 'DECADE',
          index: 1,
          startAgeYears: 11,
          endAgeYears: 21,
          pillar: pillar(2, 4), // no relation with Ji-Wu
        },
      ],
      years: [{
        kind: 'YEAR',
        solarYear: 2010,
        pillar: pillar(5, 6),
        startUtcMs: 0,
        endUtcMs: 1,
        approxStartAgeYears: 10.8,
        approxEndAgeYears: 11.8,
      }],
    } as FortuneTimeline;

    expect(buildFortuneRelations(natal, timeline).decadeYears.map((entry) => entry.decadeIndex)).toEqual([0]);
  });

  it('uses half-open decade boundaries when a year starts exactly at transition', () => {
    const natal = [pillar(1, 1), pillar(2, 2), pillar(3, 3), pillar(4, 4)] as const;
    const timeline = {
      policy: {} as any,
      start: {} as any,
      decades: [
        {
          kind: 'DECADE',
          index: 0,
          startAgeYears: 1,
          endAgeYears: 11,
          pillar: pillar(0, 0),
        },
        {
          kind: 'DECADE',
          index: 1,
          startAgeYears: 11,
          endAgeYears: 21,
          pillar: pillar(4, 0),
        },
      ],
      years: [{
        kind: 'YEAR',
        solarYear: 2011,
        pillar: pillar(5, 6),
        startUtcMs: 0,
        endUtcMs: 1,
        approxStartAgeYears: 11,
        approxEndAgeYears: 12,
      }],
    } as FortuneTimeline;

    expect(buildFortuneRelations(natal, timeline).decadeYears.map((entry) => entry.decadeIndex)).toEqual([1]);
  });
});
