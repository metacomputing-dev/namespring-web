import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { StrengthLevel } from '../../../src/domain/StrengthResult.js';
import { StrengthAnalyzer } from '../../../src/engine/analysis/StrengthAnalyzer.js';

/**
 * MU (earth) and IM (water) day master coverage tests.
 *
 * Supplements the main StrengthAnalyzer tests with strong, weak, and
 * boundary cases for the two elements that historically had less coverage.
 *
 * Ported from StrengthAnalyzerMuImCoverageTest.kt.
 */
describe('StrengthAnalyzerMuImCoverageTest', () => {
  it('MU day master strong case', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.MU, Jiji.JIN),
      new Pillar(Cheongan.BYEONG, Jiji.CHUK),
      new Pillar(Cheongan.MU, Jiji.MI),
      new Pillar(Cheongan.JEONG, Jiji.SUL),
    );

    const result = StrengthAnalyzer.analyze(pillars);
    expect(result.dayMaster).toBe(Cheongan.MU);
    expect(result.isStrong).toBe(true);
    expect(result.score.totalSupport).toBeGreaterThanOrEqual(50.0);
  });

  it('MU day master weak case', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.MU, Jiji.O),
      new Pillar(Cheongan.IM, Jiji.JA),
    );

    const result = StrengthAnalyzer.analyze(pillars);
    expect(result.dayMaster).toBe(Cheongan.MU);
    expect(result.isStrong).toBe(false);
    expect(result.score.totalSupport).toBeLessThan(50.0);
  });

  it('MU day master boundary case', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYEONG, Jiji.YU),
      new Pillar(Cheongan.EUL, Jiji.CHUK),
      new Pillar(Cheongan.MU, Jiji.O),
      new Pillar(Cheongan.IM, Jiji.JA),
    );

    const result = StrengthAnalyzer.analyze(pillars);
    expect(result.dayMaster).toBe(Cheongan.MU);
    expect(Math.abs(result.score.totalSupport - 50.0)).toBeLessThanOrEqual(10.0);
    expect([
      StrengthLevel.SLIGHTLY_STRONG,
      StrengthLevel.STRONG,
      StrengthLevel.SLIGHTLY_WEAK,
    ]).toContain(result.level);
  });

  it('IM day master strong case', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
      new Pillar(Cheongan.IM, Jiji.HAE),
      new Pillar(Cheongan.IM, Jiji.JA),
      new Pillar(Cheongan.SIN, Jiji.YU),
    );

    const result = StrengthAnalyzer.analyze(pillars);
    expect(result.dayMaster).toBe(Cheongan.IM);
    expect(result.isStrong).toBe(true);
    expect(result.score.totalSupport).toBeGreaterThanOrEqual(50.0);
  });

  it('IM day master weak case', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.MU, Jiji.O),
      new Pillar(Cheongan.BYEONG, Jiji.SA),
      new Pillar(Cheongan.IM, Jiji.MI),
      new Pillar(Cheongan.GI, Jiji.SUL),
    );

    const result = StrengthAnalyzer.analyze(pillars);
    expect(result.dayMaster).toBe(Cheongan.IM);
    expect(result.isStrong).toBe(false);
    expect(result.score.totalSupport).toBeLessThan(50.0);
  });

  it('IM day master boundary case', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
      new Pillar(Cheongan.IM, Jiji.JIN),
      new Pillar(Cheongan.BYEONG, Jiji.O),
    );

    const result = StrengthAnalyzer.analyze(pillars);
    expect(result.dayMaster).toBe(Cheongan.IM);
    expect(Math.abs(result.score.totalSupport - 50.0)).toBeLessThanOrEqual(10.0);
    expect([
      StrengthLevel.SLIGHTLY_STRONG,
      StrengthLevel.STRONG,
      StrengthLevel.SLIGHTLY_WEAK,
    ]).toContain(result.level);
  });
});
