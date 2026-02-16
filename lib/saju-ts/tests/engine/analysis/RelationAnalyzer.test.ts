import { describe, it, expect } from 'vitest';
import { RelationAnalyzer } from '../../../src/engine/analysis/RelationAnalyzer.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { JijiRelationType } from '../../../src/domain/Relations.js';

/**
 * Ported from DefaultRelationAnalyzerTest.kt
 *
 * Tests for:
 * 1. 충/형/해/원진 simultaneous detection
 * 2. 육합 + 삼합 detection
 * 3. 방합 detection
 * 4. 자형 (self-penalty) detection
 * 5. 반합 (semi-삼합) detection
 * 6. 형 sub-type classification
 */

const analyzer = new RelationAnalyzer();

/**
 * Creates a PillarSet with the given earthly branches and fixed heavenly stems.
 */
function pillars(year: Jiji, month: Jiji, day: Jiji, hour: Jiji): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, year),
    new Pillar(Cheongan.EUL, month),
    new Pillar(Cheongan.BYEONG, day),
    new Pillar(Cheongan.JEONG, hour),
  );
}

// ───────────────────────────────────────────────────────────────────
// Mixed relation detection
// ───────────────────────────────────────────────────────────────────

describe('mixed relation detection', () => {
  it('includes 형/파/해/충 hits', () => {
    const set = pillars(Jiji.IN, Jiji.SIN, Jiji.JA, Jiji.MI);
    const hits = analyzer.analyze(set);

    expect(hits.some(h => h.type === JijiRelationType.CHUNG && h.note === '인신충')).toBe(true);
    expect(hits.some(h => h.type === JijiRelationType.HYEONG && h.note === '인신형(무은)')).toBe(true);
    expect(hits.some(h => h.type === JijiRelationType.HAE && h.note === '자미해')).toBe(true);
    expect(hits.some(h => h.type === JijiRelationType.WONJIN && h.note === '자미원진')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// 육합 + 삼합
// ───────────────────────────────────────────────────────────────────

describe('육합 and 삼합 detection', () => {
  it('detects 육합 and 삼합', () => {
    const set = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.IN);
    const hits = analyzer.analyze(set);

    expect(hits.some(h => h.type === JijiRelationType.SAMHAP && h.note === '해묘미 목국')).toBe(true);
    expect(hits.some(h => h.type === JijiRelationType.YUKHAP && h.note === '인해합')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// 방합
// ───────────────────────────────────────────────────────────────────

describe('방합 detection', () => {
  it('detects 방합', () => {
    const set = pillars(Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.YU);
    const hits = analyzer.analyze(set);

    expect(hits.some(h => h.type === JijiRelationType.BANGHAP && h.note === '동방 목합')).toBe(true);
    expect(hits.some(h => h.type === JijiRelationType.CHUNG && h.note === '묘유충')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// 자형 (self-penalty)
// ───────────────────────────────────────────────────────────────────

describe('자형 (self-penalty) detection', () => {
  it('detects self-penalty when branch repeated', () => {
    const set = pillars(Jiji.JIN, Jiji.JIN, Jiji.O, Jiji.O);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.HYEONG
      && h.note === '자형'
      && h.members.has(Jiji.JIN)
      && h.members.size === 1
    )).toBe(true);

    expect(hits.some(h =>
      h.type === JijiRelationType.HYEONG
      && h.note === '자형'
      && h.members.has(Jiji.O)
      && h.members.size === 1
    )).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 반합 (Semi-삼합) detection
// ═════════════════════════════════════════════════════════════════════

describe('반합 (semi-삼합) detection', () => {
  it('detects 생왕반합 when third member absent', () => {
    // 인+오 present, 술 absent -> 인오 생왕반합(화)
    const set = pillars(Jiji.IN, Jiji.O, Jiji.JA, Jiji.MI);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.BANHAP && h.note.includes('인오 생왕반합')
    )).toBe(true);
  });

  it('detects 왕고반합', () => {
    // 유+축 present, 사 absent -> 유축 왕고반합(금)
    const set = pillars(Jiji.YU, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.BANHAP && h.note.includes('유축 왕고반합')
    )).toBe(true);
  });

  it('detects 생고반합', () => {
    // 해+미 present, 묘 absent -> 해미 생고반합(목)
    const set = pillars(Jiji.HAE, Jiji.MI, Jiji.IN, Jiji.O);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.BANHAP && h.note.includes('해미 생고반합')
    )).toBe(true);
  });

  it('no 반합 when all three 삼합 members present', () => {
    // 해+묘+미 all present -> 삼합 detected, NOT 반합
    const set = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.IN);
    const hits = analyzer.analyze(set);

    expect(hits.some(h => h.type === JijiRelationType.SAMHAP)).toBe(true);
    expect(hits.some(h => h.type === JijiRelationType.BANHAP)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 형 sub-type classification
// ═════════════════════════════════════════════════════════════════════

describe('형 sub-type classification', () => {
  it('인사신 triple has 무은지형 sub-type', () => {
    const set = pillars(Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.JA);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.HYEONG && h.note.includes('무은지형')
    )).toBe(true);
  });

  it('축술미 triple has 지세지형 sub-type', () => {
    const set = pillars(Jiji.CHUK, Jiji.SUL, Jiji.MI, Jiji.JA);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.HYEONG && h.note.includes('지세지형')
    )).toBe(true);
  });

  it('자묘형 has 무례지형 sub-type', () => {
    const set = pillars(Jiji.JA, Jiji.MYO, Jiji.IN, Jiji.O);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.HYEONG && h.note.includes('무례지형')
    )).toBe(true);
  });

  it('형 pairs carry sub-type', () => {
    // 인사형 should have (무은) sub-type
    const set = pillars(Jiji.IN, Jiji.SA, Jiji.JA, Jiji.O);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.HYEONG && h.note === '인사형(무은)'
    )).toBe(true);
  });

  it('축미형 has 지세 sub-type', () => {
    const set = pillars(Jiji.CHUK, Jiji.MI, Jiji.JA, Jiji.O);
    const hits = analyzer.analyze(set);

    expect(hits.some(h =>
      h.type === JijiRelationType.HYEONG && h.note === '축미형(지세)'
    )).toBe(true);
  });
});
