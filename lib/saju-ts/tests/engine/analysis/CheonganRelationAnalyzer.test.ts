import { describe, it, expect } from 'vitest';
import { CheonganRelationAnalyzer } from '../../../src/engine/analysis/CheonganRelationAnalyzer.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { CheonganRelationType } from '../../../src/domain/Relations.js';

/**
 * Ported from CheonganRelationAnalyzerTest.kt
 *
 * Tests for:
 * 1. 천간합 (HAP) detection -- 5 pairs
 * 2. 천간충 (CHUNG) detection -- 4 pairs
 * 3. No false positives
 * 4. Multiple simultaneous relations
 * 5. Deduplication
 * 6. Non-adjacent position detection
 */

const analyzer = new CheonganRelationAnalyzer();

/**
 * Creates a PillarSet with the given heavenly stems and a fixed earthly branch.
 * The 지지 is irrelevant for 천간 relation analysis so we use a constant.
 */
function pillars(year: Cheongan, month: Cheongan, day: Cheongan, hour: Cheongan): PillarSet {
  const branch = Jiji.JA;
  return new PillarSet(
    new Pillar(year, branch),
    new Pillar(month, branch),
    new Pillar(day, branch),
    new Pillar(hour, branch),
  );
}

// ───────────────────────────────────────────────────────────────────
// 천간합 (HAP) detection
// ───────────────────────────────────────────────────────────────────

describe('천간합 (HAP) detection', () => {
  it('detects 갑기합화토', () => {
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.GI, Cheongan.BYEONG, Cheongan.JEONG));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP
      && h.members.has(Cheongan.GAP) && h.members.has(Cheongan.GI)
      && h.resultOhaeng === Ohaeng.EARTH
      && h.note === '갑기합화토'
    )).toBe(true);
  });

  it('detects 을경합화금', () => {
    const hits = analyzer.analyze(pillars(Cheongan.EUL, Cheongan.GYEONG, Cheongan.MU, Cheongan.IM));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP
      && h.members.has(Cheongan.EUL) && h.members.has(Cheongan.GYEONG)
      && h.resultOhaeng === Ohaeng.METAL
      && h.note === '을경합화금'
    )).toBe(true);
  });

  it('detects 병신합화수', () => {
    const hits = analyzer.analyze(pillars(Cheongan.BYEONG, Cheongan.SIN, Cheongan.GAP, Cheongan.MU));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP
      && h.members.has(Cheongan.BYEONG) && h.members.has(Cheongan.SIN)
      && h.resultOhaeng === Ohaeng.WATER
      && h.note === '병신합화수'
    )).toBe(true);
  });

  it('detects 정임합화목', () => {
    const hits = analyzer.analyze(pillars(Cheongan.JEONG, Cheongan.IM, Cheongan.EUL, Cheongan.GYE));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP
      && h.members.has(Cheongan.JEONG) && h.members.has(Cheongan.IM)
      && h.resultOhaeng === Ohaeng.WOOD
      && h.note === '정임합화목'
    )).toBe(true);
  });

  it('detects 무계합화화', () => {
    const hits = analyzer.analyze(pillars(Cheongan.MU, Cheongan.GYE, Cheongan.GAP, Cheongan.BYEONG));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP
      && h.members.has(Cheongan.MU) && h.members.has(Cheongan.GYE)
      && h.resultOhaeng === Ohaeng.FIRE
      && h.note === '무계합화화'
    )).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// 천간충 (CHUNG) detection
// ───────────────────────────────────────────────────────────────────

describe('천간충 (CHUNG) detection', () => {
  it('detects 갑경충', () => {
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.GYEONG, Cheongan.BYEONG, Cheongan.JEONG));

    expect(hits.some(h =>
      h.type === CheonganRelationType.CHUNG
      && h.members.has(Cheongan.GAP) && h.members.has(Cheongan.GYEONG)
      && h.resultOhaeng === null
      && h.note === '갑경충'
    )).toBe(true);
  });

  it('detects 을신충', () => {
    const hits = analyzer.analyze(pillars(Cheongan.EUL, Cheongan.SIN, Cheongan.MU, Cheongan.GI));

    expect(hits.some(h =>
      h.type === CheonganRelationType.CHUNG
      && h.members.has(Cheongan.EUL) && h.members.has(Cheongan.SIN)
      && h.note === '을신충'
    )).toBe(true);
  });

  it('detects 병임충', () => {
    const hits = analyzer.analyze(pillars(Cheongan.BYEONG, Cheongan.IM, Cheongan.GAP, Cheongan.EUL));

    expect(hits.some(h =>
      h.type === CheonganRelationType.CHUNG
      && h.members.has(Cheongan.BYEONG) && h.members.has(Cheongan.IM)
      && h.note === '병임충'
    )).toBe(true);
  });

  it('detects 정계충', () => {
    const hits = analyzer.analyze(pillars(Cheongan.JEONG, Cheongan.GYE, Cheongan.MU, Cheongan.GI));

    expect(hits.some(h =>
      h.type === CheonganRelationType.CHUNG
      && h.members.has(Cheongan.JEONG) && h.members.has(Cheongan.GYE)
      && h.note === '정계충'
    )).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// No false positives
// ───────────────────────────────────────────────────────────────────

describe('no false positives', () => {
  it('returns empty when no pairs match', () => {
    // GAP(0), BYEONG(2), JEONG(3), MU(4) -- no pair has ordinal difference 5 (HAP) or 6 (CHUNG)
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.BYEONG, Cheongan.JEONG, Cheongan.MU));
    expect(hits).toHaveLength(0);
  });

  it('no CHUNG for MU or GI', () => {
    // MU and GI have no 충 counterpart
    const hits = analyzer.analyze(pillars(Cheongan.MU, Cheongan.GI, Cheongan.MU, Cheongan.GI));

    const chungHits = hits.filter(h => h.type === CheonganRelationType.CHUNG);
    expect(chungHits).toHaveLength(0);
  });

  it('identical stems produce no relation', () => {
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.GAP, Cheongan.GAP, Cheongan.GAP));
    expect(hits).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────────
// Multiple simultaneous relations
// ───────────────────────────────────────────────────────────────────

describe('multiple simultaneous relations', () => {
  it('detects multiple HAP simultaneously', () => {
    // GAP+GI = 갑기합, MU+GYE = 무계합
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.GI, Cheongan.MU, Cheongan.GYE));

    const hapHits = hits.filter(h => h.type === CheonganRelationType.HAP);
    expect(hapHits).toHaveLength(2);
    expect(hapHits.some(h => h.note === '갑기합화토')).toBe(true);
    expect(hapHits.some(h => h.note === '무계합화화')).toBe(true);
  });

  it('detects HAP and CHUNG simultaneously', () => {
    // GAP+GI = 갑기합, BYEONG+IM = 병임충
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.GI, Cheongan.BYEONG, Cheongan.IM));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP && h.note === '갑기합화토'
    )).toBe(true);
    expect(hits.some(h =>
      h.type === CheonganRelationType.CHUNG && h.note === '병임충'
    )).toBe(true);
  });

  it('detects multiple CHUNG simultaneously', () => {
    // GAP+GYEONG = 갑경충, EUL+SIN = 을신충
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.EUL, Cheongan.GYEONG, Cheongan.SIN));

    const chungHits = hits.filter(h => h.type === CheonganRelationType.CHUNG);
    expect(chungHits).toHaveLength(2);
    expect(chungHits.some(h => h.note === '갑경충')).toBe(true);
    expect(chungHits.some(h => h.note === '을신충')).toBe(true);
  });

  it('detects both HAP and CHUNG for overlapping stems', () => {
    // EUL+GYEONG = 을경합, EUL+SIN = 을신충 (EUL participates in both)
    const hits = analyzer.analyze(pillars(Cheongan.EUL, Cheongan.GYEONG, Cheongan.SIN, Cheongan.MU));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP && h.note === '을경합화금'
    )).toBe(true);
    expect(hits.some(h =>
      h.type === CheonganRelationType.CHUNG && h.note === '을신충'
    )).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// Deduplication: same pair detected across multiple pillar positions
// ───────────────────────────────────────────────────────────────────

describe('deduplication', () => {
  it('deduplicates same pair across multiple positions', () => {
    // GAP appears at year and day, GI appears at month -- two position-pairs
    // (year-month and day-month) would match GAP+GI, but only one hit expected.
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.GI, Cheongan.GAP, Cheongan.BYEONG));

    const hapHits = hits.filter(h => h.type === CheonganRelationType.HAP && h.note === '갑기합화토');
    expect(hapHits).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────
// Non-adjacent positions can form relations
// ───────────────────────────────────────────────────────────────────

describe('non-adjacent positions', () => {
  it('detects relation between non-adjacent positions', () => {
    // GAP at year, GI at hour (positions 0 and 3) -- non-adjacent but valid
    const hits = analyzer.analyze(pillars(Cheongan.GAP, Cheongan.BYEONG, Cheongan.JEONG, Cheongan.GI));

    expect(hits.some(h =>
      h.type === CheonganRelationType.HAP && h.note === '갑기합화토'
    )).toBe(true);
  });
});
