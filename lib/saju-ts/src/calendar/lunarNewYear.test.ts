import { describe, expect, it } from 'vitest';
import { computeLunarNewYearBoundary } from './lunarNewYear.js';
import { calcYearPillarFromLiChunUtc } from './pillars.js';

describe('computeLunarNewYearBoundary', () => {
  it('matches published Lunar New Year dates for 2024-2026 (KST, meeus)', () => {
    const KST = 9 * 60;
    const method = 'meeus' as const;

    expect(computeLunarNewYearBoundary(2024, KST, method).localDate).toEqual({ y: 2024, m: 2, d: 10 });
    expect(computeLunarNewYearBoundary(2025, KST, method).localDate).toEqual({ y: 2025, m: 1, d: 29 });
    expect(computeLunarNewYearBoundary(2026, KST, method).localDate).toEqual({ y: 2026, m: 2, d: 17 });
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
