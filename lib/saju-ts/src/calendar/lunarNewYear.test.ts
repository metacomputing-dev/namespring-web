import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeLunarNewYearBoundary } from './lunarNewYear.js';
import { calcYearPillarFromLiChunUtc } from './pillars.js';

interface SeollalAnchor {
  lunarYear: number;
  solar: string;
}

const anchorPath = new URL(
  '../../../spring-ts/data/kasi-lunar-solar/korean_lunar_anchor_cases.json',
  import.meta.url,
);
const regressionAnchors = JSON.parse(fs.readFileSync(anchorPath, 'utf8')) as {
  seollal: SeollalAnchor[];
};

describe('computeLunarNewYearBoundary', () => {
  it('matches published Lunar New Year dates for 2024-2026 (KST, meeus)', () => {
    const KST = 9 * 60;
    const method = 'meeus' as const;

    expect(computeLunarNewYearBoundary(2024, KST, method).localDate).toEqual({ y: 2024, m: 2, d: 10 });
    expect(computeLunarNewYearBoundary(2025, KST, method).localDate).toEqual({ y: 2025, m: 1, d: 29 });
    expect(computeLunarNewYearBoundary(2026, KST, method).localDate).toEqual({ y: 2026, m: 2, d: 17 });
  });

  it('matches all 1900-2050 Korean lunar regression anchors', () => {
    const KST = 9 * 60;
    const anchors = regressionAnchors.seollal;
    expect(anchors).toHaveLength(151);
    expect(anchors.map((anchor) => anchor.lunarYear)).toEqual(
      Array.from({ length: 151 }, (_, index) => 1900 + index),
    );

    for (const anchor of anchors) {
      const [y, m, d] = anchor.solar.split('-').map(Number);
      expect(computeLunarNewYearBoundary(anchor.lunarYear, KST, 'meeus').localDate).toEqual({
        y,
        m,
        d,
      });
    }
  });

  it.each([
    [1985, 2, 20],
    [2015, 2, 19],
    [2034, 2, 19],
  ])('uses the verified third-new-moon exception and switches exactly at midnight in %i', (year, month, day) => {
    const KST = 9 * 60;
    const boundary = computeLunarNewYearBoundary(year, KST, 'meeus');
    expect(boundary.localDate).toEqual({ y: year, m: month, d: day });
    expect(boundary.algorithm).toBe('thirdNewMoonAfterWinterSolstice');

    const before = calcYearPillarFromLiChunUtc(
      year,
      boundary.boundaryUtcMs - 1,
      null,
      'lunarNewYear',
      KST,
      'meeus',
    );
    const atBoundary = calcYearPillarFromLiChunUtc(
      year,
      boundary.boundaryUtcMs,
      null,
      'lunarNewYear',
      KST,
      'meeus',
    );
    expect(before).toEqual({ stem: (year - 5) % 10, branch: (year - 5) % 12 });
    expect(atBoundary).toEqual({ stem: (year - 4) % 10, branch: (year - 4) % 12 });
  });

  it('keeps the heuristic available outside the regression-anchor range', () => {
    expect(() => computeLunarNewYearBoundary(2125, 9 * 60, 'meeus')).not.toThrow();
  });

  it('switches year pillar at local midnight of lunar new year day', () => {
    const KST = 9 * 60;
    const method = 'meeus' as const;

    // 2024 Lunar New Year: 2024-02-10 (KST).
    const beforeUtcMs = Date.parse('2024-02-09T23:59:00+09:00');
    const afterUtcMs = Date.parse('2024-02-10T00:01:00+09:00');

    const before = calcYearPillarFromLiChunUtc(2024, beforeUtcMs, null, 'lunarNewYear', KST, method);
    const after = calcYearPillarFromLiChunUtc(2024, afterUtcMs, null, 'lunarNewYear', KST, method);

    // Before boundary: 2023 = 癸卯 (stem=9, branch=3)
    expect(before).toEqual({ stem: 9, branch: 3 });

    // After boundary: 2024 = 甲辰 (stem=0, branch=4)
    expect(after).toEqual({ stem: 0, branch: 4 });
  });
});
