import { describe, it, expect } from 'vitest';
import { DefaultRelationAnalyzer } from '../../../src/engine/analysis/DefaultRelationAnalyzer.js';
import { RelationInteractionResolver } from '../../../src/engine/analysis/RelationInteractionResolver.js';
import { JijiRelationScorer } from '../../../src/engine/analysis/InteractionScoreModel.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import {
  InteractionOutcome,
  JijiRelationHit,
  JijiRelationType,
} from '../../../src/domain/Relations.js';

// ── Helper factories ──────────────────────────────────────────────

function pillars(year: Jiji, month: Jiji, day: Jiji, hour: Jiji): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, year),
    new Pillar(Cheongan.EUL, month),
    new Pillar(Cheongan.BYEONG, day),
    new Pillar(Cheongan.JEONG, hour),
  );
}

function hit(type: JijiRelationType, members: Jiji[], note: string = ''): JijiRelationHit {
  return { type, members: new Set(members), note };
}

const analyzer = new DefaultRelationAnalyzer();

// ====================================================================
// DefaultRelationAnalyzer tests (ported from DefaultRelationAnalyzerTest.kt)
// ====================================================================

describe('DefaultRelationAnalyzer', () => {
  it('includes 형/파/해/충 hits', () => {
    const ps = pillars(Jiji.IN, Jiji.SIN, Jiji.JA, Jiji.MI);
    const hits = analyzer.analyze(ps);

    expect(hits.some((h) => h.type === JijiRelationType.CHUNG && h.note === '인신충')).toBe(true);
    expect(hits.some((h) => h.type === JijiRelationType.HYEONG && h.note === '인신형(무은)')).toBe(true);
    expect(hits.some((h) => h.type === JijiRelationType.HAE && h.note === '자미해')).toBe(true);
    expect(hits.some((h) => h.type === JijiRelationType.WONJIN && h.note === '자미원진')).toBe(true);
  });

  it('detects 육합 and 삼합', () => {
    const ps = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.IN);
    const hits = analyzer.analyze(ps);

    expect(hits.some((h) => h.type === JijiRelationType.SAMHAP && h.note === '해묘미 목국')).toBe(true);
    expect(hits.some((h) => h.type === JijiRelationType.YUKHAP && h.note === '인해합')).toBe(true);
  });

  it('detects 방합', () => {
    const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.YU);
    const hits = analyzer.analyze(ps);

    expect(hits.some((h) => h.type === JijiRelationType.BANGHAP && h.note === '동방 목합')).toBe(true);
    expect(hits.some((h) => h.type === JijiRelationType.CHUNG && h.note === '묘유충')).toBe(true);
  });

  it('detects 자형 when branch is repeated', () => {
    const ps = pillars(Jiji.JIN, Jiji.JIN, Jiji.O, Jiji.O);
    const hits = analyzer.analyze(ps);

    expect(hits.some((h) =>
      h.type === JijiRelationType.HYEONG && h.note === '자형' && h.members.has(Jiji.JIN) && h.members.size === 1,
    )).toBe(true);
    expect(hits.some((h) =>
      h.type === JijiRelationType.HYEONG && h.note === '자형' && h.members.has(Jiji.O) && h.members.size === 1,
    )).toBe(true);
  });

  // -- 반합 --

  it('detects 생왕반합 when third member absent', () => {
    const ps = pillars(Jiji.IN, Jiji.O, Jiji.JA, Jiji.MI);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.BANHAP && h.note.includes('인오 생왕반합'))).toBe(true);
  });

  it('detects 왕고반합', () => {
    const ps = pillars(Jiji.YU, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.BANHAP && h.note.includes('유축 왕고반합'))).toBe(true);
  });

  it('detects 생고반합', () => {
    const ps = pillars(Jiji.HAE, Jiji.MI, Jiji.IN, Jiji.O);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.BANHAP && h.note.includes('해미 생고반합'))).toBe(true);
  });

  it('no 반합 when all three 삼합 members present', () => {
    const ps = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.IN);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.SAMHAP)).toBe(true);
    expect(hits.some((h) => h.type === JijiRelationType.BANHAP)).toBe(false);
  });

  // -- 형 sub-type classification --

  it('인사신 triple has 무은지형 subtype', () => {
    const ps = pillars(Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.JA);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.HYEONG && h.note.includes('무은지형'))).toBe(true);
  });

  it('축술미 triple has 지세지형 subtype', () => {
    const ps = pillars(Jiji.CHUK, Jiji.SUL, Jiji.MI, Jiji.JA);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.HYEONG && h.note.includes('지세지형'))).toBe(true);
  });

  it('자묘형 has 무례지형 subtype', () => {
    const ps = pillars(Jiji.JA, Jiji.MYO, Jiji.IN, Jiji.O);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.HYEONG && h.note.includes('무례지형'))).toBe(true);
  });

  it('인사형 pair carries (무은) subtype', () => {
    const ps = pillars(Jiji.IN, Jiji.SA, Jiji.JA, Jiji.O);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.HYEONG && h.note === '인사형(무은)')).toBe(true);
  });

  it('축미형 pair carries (지세) subtype', () => {
    const ps = pillars(Jiji.CHUK, Jiji.MI, Jiji.JA, Jiji.O);
    const hits = analyzer.analyze(ps);
    expect(hits.some((h) => h.type === JijiRelationType.HYEONG && h.note === '축미형(지세)')).toBe(true);
  });
});

// ====================================================================
// RelationInteractionResolver tests (ported from RelationInteractionResolverTest.kt)
// ====================================================================

describe('RelationInteractionResolver', () => {

  // 1. Single relation: 육합 alone remains ACTIVE
  it('육합 alone is ACTIVE', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const hits = [hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합')];
    const resolved = RelationInteractionResolver.resolve(hits, ps);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolved[0]!.interactsWith).toHaveLength(0);
    expect(resolved[0]!.reasoning.length).toBeGreaterThan(0);
  });

  // 2. Single relation: 충 alone remains ACTIVE
  it('충 alone is ACTIVE', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.IN, Jiji.MYO);
    const hits = [hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충')];
    const resolved = RelationInteractionResolver.resolve(hits, ps);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // 3. 육합 + 충 on same branch, 충 adjacent => 합 BROKEN
  it('육합 BROKEN by adjacent 충', () => {
    const ps = pillars(Jiji.CHUK, Jiji.JA, Jiji.O, Jiji.MI);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    const resolvedYukhap = resolved.find((r) => r.hit.type === JijiRelationType.YUKHAP)!;
    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.BROKEN);
    expect(resolvedYukhap.interactsWith.some((h) => h.type === JijiRelationType.CHUNG)).toBe(true);
    expect(resolvedYukhap.reasoning).toContain('파합');
  });

  // 4. 충 WEAKENED by 육합 (non-adjacent attacker)
  it('충 weakened by 육합 when non-adjacent attacker', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.O);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    const resolvedChung = resolved.find((r) => r.hit.type === JijiRelationType.CHUNG)!;
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedChung.reasoning).toContain('합해충');
  });

  // 5. Complete 삼합 + 충 => 충 WEAKENED
  it('삼합 weakens 충 on member', () => {
    const ps = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.YU);
    const samhap = hit(JijiRelationType.SAMHAP, [Jiji.HAE, Jiji.MYO, Jiji.MI], '해묘미 목국');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([samhap, chung], ps);

    const resolvedSamhap = resolved.find((r) => r.hit.type === JijiRelationType.SAMHAP)!;
    const resolvedChung = resolved.find((r) => r.hit.type === JijiRelationType.CHUNG)!;

    expect(resolvedSamhap.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedChung.reasoning).toContain('삼합');
  });

  // 6. 형 + 합 => both ACTIVE (형 persists through 합)
  it('형 persists through 합', () => {
    const ps = pillars(Jiji.IN, Jiji.HAE, Jiji.SA, Jiji.CHUK);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.IN, Jiji.HAE], '인해합');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형(무은)');

    const resolved = RelationInteractionResolver.resolve([yukhap, hyeong], ps);

    const resolvedYukhap = resolved.find((r) => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedHyeong = resolved.find((r) => r.hit.type === JijiRelationType.HYEONG)!;

    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedHyeong.interactsWith.some((h) => h.type === JijiRelationType.YUKHAP)).toBe(true);
    expect(resolvedYukhap.interactsWith.some((h) => h.type === JijiRelationType.HYEONG)).toBe(true);
  });

  // 7. No conflicts => all ACTIVE
  it('no conflicts => all ACTIVE', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.MYO, Jiji.YU);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    expect(resolved).toHaveLength(2);
    expect(resolved.every((r) => r.outcome === InteractionOutcome.ACTIVE)).toBe(true);
    expect(resolved.every((r) => r.interactsWith.length === 0)).toBe(true);
  });

  // 8. Multiple relations => correct priority ordering
  it('multiple relations: correct priority ordering', () => {
    const ps = pillars(Jiji.MYO, Jiji.YU, Jiji.SUL, Jiji.MI);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.MYO, Jiji.SUL], '묘술합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');
    const hae = hit(JijiRelationType.HAE, [Jiji.YU, Jiji.SUL], '유술해');
    const pa = hit(JijiRelationType.PA, [Jiji.MI, Jiji.SUL], '미술파');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung, hae, pa], ps);

    const resolvedYukhap = resolved.find((r) => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedChung = resolved.find((r) => r.hit.type === JijiRelationType.CHUNG)!;
    const resolvedHae = resolved.find((r) => r.hit.type === JijiRelationType.HAE)!;
    const resolvedPa = resolved.find((r) => r.hit.type === JijiRelationType.PA)!;

    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.BROKEN);
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedHae.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedPa.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // 9. Reasoning strings are non-empty and Korean
  it('reasoning strings are non-empty and contain Korean', () => {
    const ps = pillars(Jiji.CHUK, Jiji.JA, Jiji.O, Jiji.MI);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    for (const r of resolved) {
      expect(r.reasoning.length).toBeGreaterThan(0);
      // Hangul range: \uAC00-\uD7A3
      expect(/[\uAC00-\uD7A3]/.test(r.reasoning)).toBe(true);
    }
  });

  // 10. Empty input returns empty output
  it('empty input returns empty output', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const resolved = RelationInteractionResolver.resolve([], ps);
    expect(resolved).toHaveLength(0);
  });

  // 11. Priority function returns correct ordering
  it('priorityOf returns correct ordering', () => {
    const allTypes: JijiRelationType[] = [
      JijiRelationType.YUKHAP, JijiRelationType.SAMHAP, JijiRelationType.BANGHAP,
      JijiRelationType.BANHAP, JijiRelationType.CHUNG, JijiRelationType.HYEONG,
      JijiRelationType.PA, JijiRelationType.HAE, JijiRelationType.WONJIN,
    ];
    const ordered = [...allTypes].sort(
      (a, b) => RelationInteractionResolver.priorityOf(a) - RelationInteractionResolver.priorityOf(b),
    );
    expect(ordered).toEqual([
      JijiRelationType.SAMHAP,
      JijiRelationType.BANGHAP,
      JijiRelationType.YUKHAP,
      JijiRelationType.BANHAP,
      JijiRelationType.CHUNG,
      JijiRelationType.HYEONG,
      JijiRelationType.PA,
      JijiRelationType.HAE,
      JijiRelationType.WONJIN,
    ]);
  });

  // 12. Adjacency helper
  it('areAdjacent returns true for diff of 1', () => {
    expect(RelationInteractionResolver.areAdjacent(0, 1)).toBe(true);
    expect(RelationInteractionResolver.areAdjacent(1, 0)).toBe(true);
    expect(RelationInteractionResolver.areAdjacent(2, 3)).toBe(true);
  });

  it('areAdjacent returns false for diff > 1', () => {
    expect(RelationInteractionResolver.areAdjacent(0, 2)).toBe(false);
    expect(RelationInteractionResolver.areAdjacent(0, 3)).toBe(false);
    expect(RelationInteractionResolver.areAdjacent(1, 3)).toBe(false);
  });

  // 13. positionsOf helper
  it('positionsOf finds all occurrences', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.JA, Jiji.MI);
    const positions = RelationInteractionResolver.positionsOf(Jiji.JA, ps);
    expect(positions).toEqual([0, 2]);
  });

  it('positionsOf returns empty for absent branch', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.IN, Jiji.MI);
    const positions = RelationInteractionResolver.positionsOf(Jiji.YU, ps);
    expect(positions).toHaveLength(0);
  });

  // 14. Complete 삼합 stays ACTIVE against 충
  it('complete 삼합 stays ACTIVE against 충', () => {
    const ps = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.YU);
    const samhap = hit(JijiRelationType.SAMHAP, [Jiji.HAE, Jiji.MYO, Jiji.MI], '해묘미 목국');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([samhap, chung], ps);
    const resolvedSamhap = resolved.find((r) => r.hit.type === JijiRelationType.SAMHAP)!;
    expect(resolvedSamhap.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // 15. 원진 weakened by 충
  it('원진 weakened by 충', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.MI, Jiji.IN);
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');
    const wonjin = hit(JijiRelationType.WONJIN, [Jiji.JA, Jiji.MI], '자미원진');

    const resolved = RelationInteractionResolver.resolve([chung, wonjin], ps);

    const resolvedChung = resolved.find((r) => r.hit.type === JijiRelationType.CHUNG)!;
    const resolvedWonjin = resolved.find((r) => r.hit.type === JijiRelationType.WONJIN)!;

    expect(resolvedChung.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedWonjin.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // 16. 반합 broken by 충
  it('반합 broken by 충', () => {
    const ps = pillars(Jiji.IN, Jiji.O, Jiji.SIN, Jiji.MI);
    const banhap = hit(JijiRelationType.BANHAP, [Jiji.IN, Jiji.O], '인오 생왕반합(화)');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.IN, Jiji.SIN], '인신충');

    const resolved = RelationInteractionResolver.resolve([banhap, chung], ps);

    const resolvedBanhap = resolved.find((r) => r.hit.type === JijiRelationType.BANHAP)!;
    const resolvedChung = resolved.find((r) => r.hit.type === JijiRelationType.CHUNG)!;

    expect(resolvedBanhap.outcome).toBe(InteractionOutcome.BROKEN);
    expect(resolvedBanhap.reasoning).toContain('파합');
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  it('반합 alone is ACTIVE', () => {
    const ps = pillars(Jiji.IN, Jiji.O, Jiji.CHUK, Jiji.MI);
    const banhap = hit(JijiRelationType.BANHAP, [Jiji.IN, Jiji.O], '인오 생왕반합(화)');

    const resolved = RelationInteractionResolver.resolve([banhap], ps);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // 17. 형 persists through 반합 too
  it('형 persists through 반합', () => {
    const ps = pillars(Jiji.IN, Jiji.O, Jiji.SA, Jiji.MI);
    const banhap = hit(JijiRelationType.BANHAP, [Jiji.IN, Jiji.O], '인오 생왕반합(화)');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형(무은)');

    const resolved = RelationInteractionResolver.resolve([banhap, hyeong], ps);

    const resolvedBanhap = resolved.find((r) => r.hit.type === JijiRelationType.BANHAP)!;
    const resolvedHyeong = resolved.find((r) => r.hit.type === JijiRelationType.HYEONG)!;

    expect(resolvedBanhap.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // 18. 충+형 same branches => 형 STRENGTHENED
  it('충 strengthens 형 on same branches', () => {
    const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.SIN, Jiji.CHUK);
    const chung = hit(JijiRelationType.CHUNG, [Jiji.IN, Jiji.SIN], '인신충');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SIN], '인신형');

    const resolved = RelationInteractionResolver.resolve([chung, hyeong], ps);

    const resolvedChung = resolved.find((r) => r.hit.type === JijiRelationType.CHUNG)!;
    const resolvedHyeong = resolved.find((r) => r.hit.type === JijiRelationType.HYEONG)!;

    expect(resolvedChung.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.STRENGTHENED);
    expect(resolvedHyeong.reasoning).toContain('강화');
  });

  it('충+형 partial overlap => no strengthening', () => {
    const ps = pillars(Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.CHUK);
    const chung = hit(JijiRelationType.CHUNG, [Jiji.IN, Jiji.SIN], '인신충');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형');

    const resolved = RelationInteractionResolver.resolve([chung, hyeong], ps);

    const resolvedHyeong = resolved.find((r) => r.hit.type === JijiRelationType.HYEONG)!;
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // 19. 해 + 육합 => 합 WEAKENED
  it('해 weakens 육합', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.MI, Jiji.IN);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const hae = hit(JijiRelationType.HAE, [Jiji.JA, Jiji.MI], '자미해');

    const resolved = RelationInteractionResolver.resolve([yukhap, hae], ps);

    const resolvedYukhap = resolved.find((r) => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedHae = resolved.find((r) => r.hit.type === JijiRelationType.HAE)!;

    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedYukhap.reasoning).toContain('육해');
    expect(resolvedHae.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // 20. 파 + 합 same branch pair => 합 WEAKENED
  it('파 weakens 합 on same branch pair', () => {
    const ps = pillars(Jiji.IN, Jiji.HAE, Jiji.JIN, Jiji.CHUK);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.IN, Jiji.HAE], '인해합');
    const pa = hit(JijiRelationType.PA, [Jiji.IN, Jiji.HAE], '인해파');

    const resolved = RelationInteractionResolver.resolve([yukhap, pa], ps);

    const resolvedYukhap = resolved.find((r) => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedPa = resolved.find((r) => r.hit.type === JijiRelationType.PA)!;

    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedYukhap.reasoning).toContain('파');
    expect(resolvedPa.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  it('파 with single shared branch uses generic rule', () => {
    const ps = pillars(Jiji.MYO, Jiji.SUL, Jiji.MI, Jiji.IN);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.MYO, Jiji.SUL], '묘술합');
    const pa = hit(JijiRelationType.PA, [Jiji.MI, Jiji.SUL], '미술파');

    const resolved = RelationInteractionResolver.resolve([yukhap, pa], ps);

    const resolvedPa = resolved.find((r) => r.hit.type === JijiRelationType.PA)!;
    expect(resolvedPa.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // 21. 삼형 완성 => 구성 상형 강화
  it('complete 삼형 strengthens constituent pair 형', () => {
    const ps = pillars(Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.CHUK);
    const samhyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA, Jiji.SIN], '인사신 삼형');
    const sanghyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형');

    const resolved = RelationInteractionResolver.resolve([samhyeong, sanghyeong], ps);

    const resolvedSanghyeong = resolved.find((r) => r.hit.members.size === 2)!;
    expect(resolvedSanghyeong.outcome).toBe(InteractionOutcome.STRENGTHENED);
    expect(resolvedSanghyeong.reasoning).toContain('삼형');
  });

  it('축술미 삼형 strengthens 축미형', () => {
    const ps = pillars(Jiji.CHUK, Jiji.SUL, Jiji.MI, Jiji.IN);
    const samhyeong = hit(JijiRelationType.HYEONG, [Jiji.CHUK, Jiji.SUL, Jiji.MI], '축술미 삼형');
    const sanghyeong = hit(JijiRelationType.HYEONG, [Jiji.CHUK, Jiji.MI], '축미형');

    const resolved = RelationInteractionResolver.resolve([samhyeong, sanghyeong], ps);

    const resolvedSanghyeong = resolved.find((r) => r.hit.members.size === 2)!;
    expect(resolvedSanghyeong.outcome).toBe(InteractionOutcome.STRENGTHENED);
    expect(resolvedSanghyeong.reasoning).toContain('삼형');
  });

  // 22. 방합 weakens 충 on shared member
  it('방합 weakens 충 on shared member', () => {
    const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.YU);
    const banghap = hit(JijiRelationType.BANGHAP, [Jiji.IN, Jiji.MYO, Jiji.JIN], '동방 목합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([banghap, chung], ps);

    const resolvedBanghap = resolved.find((r) => r.hit.type === JijiRelationType.BANGHAP)!;
    const resolvedChung = resolved.find((r) => r.hit.type === JijiRelationType.CHUNG)!;

    expect(resolvedBanghap.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
  });
});

// ====================================================================
// InteractionScoreModel tests
// ====================================================================

describe('JijiRelationScorer', () => {

  it('baseScoreFor returns correct base scores', () => {
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANGHAP, '')).toBe(100);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.SAMHAP, '')).toBe(95);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.CHUNG, '')).toBe(70);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.YUKHAP, '')).toBe(60);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.HYEONG, '')).toBe(55);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.HAE, '')).toBe(40);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.PA, '')).toBe(35);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.WONJIN, '')).toBe(25);
  });

  it('baseScoreFor differentiates 반합 subtypes', () => {
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '인오 생왕반합(화)')).toBe(45);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '오술 왕고반합(화)')).toBe(40);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '인술 생고반합(화)')).toBe(35);
    expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, 'some generic note')).toBe(40);
  });

  it('scores ACTIVE relation with adjacency bonus', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const branchPositions = RelationInteractionResolver.buildBranchPositionMap(ps);
    const resolved: ResolvedRelation = {
      hit: { type: JijiRelationType.YUKHAP, members: new Set([Jiji.JA, Jiji.CHUK]), note: '자축합' },
      outcome: InteractionOutcome.ACTIVE,
      interactsWith: [],
      reasoning: '자축합 관계가 단독으로 성립합니다.',
      score: null,
    };

    const score = JijiRelationScorer.score(resolved, branchPositions);

    expect(score.baseScore).toBe(60);
    expect(score.adjacencyBonus).toBe(10); // JA(0) and CHUK(1) are adjacent
    expect(score.outcomeMultiplier).toBe(1.0);
    expect(score.finalScore).toBe(70); // min(100, 60+10) * 1.0
    expect(score.rationale).toContain('기본점수');
    expect(score.rationale).toContain('인접보너스');
  });

  it('scores WEAKENED relation with 0.5 multiplier', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.MI, Jiji.IN);
    const branchPositions = RelationInteractionResolver.buildBranchPositionMap(ps);
    const resolved: ResolvedRelation = {
      hit: { type: JijiRelationType.CHUNG, members: new Set([Jiji.JA, Jiji.O]), note: '자오충' },
      outcome: InteractionOutcome.WEAKENED,
      interactsWith: [],
      reasoning: '약화됨',
      score: null,
    };

    const score = JijiRelationScorer.score(resolved, branchPositions);

    expect(score.baseScore).toBe(70);
    expect(score.outcomeMultiplier).toBe(0.5);
    // JA(0) and O(1) are adjacent => +10
    expect(score.adjacencyBonus).toBe(10);
    expect(score.finalScore).toBe(40); // Math.trunc(min(100, 80) * 0.5) = 40
  });

  it('scores BROKEN relation as 0', () => {
    const ps = pillars(Jiji.CHUK, Jiji.JA, Jiji.O, Jiji.MI);
    const branchPositions = RelationInteractionResolver.buildBranchPositionMap(ps);
    const resolved: ResolvedRelation = {
      hit: { type: JijiRelationType.YUKHAP, members: new Set([Jiji.JA, Jiji.CHUK]), note: '자축합' },
      outcome: InteractionOutcome.BROKEN,
      interactsWith: [],
      reasoning: '파합됨',
      score: null,
    };

    const score = JijiRelationScorer.score(resolved, branchPositions);

    expect(score.outcomeMultiplier).toBe(0.0);
    expect(score.finalScore).toBe(0);
  });

  it('scores STRENGTHENED relation with 1.3 multiplier', () => {
    const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.SIN, Jiji.CHUK);
    const branchPositions = RelationInteractionResolver.buildBranchPositionMap(ps);
    const resolved: ResolvedRelation = {
      hit: { type: JijiRelationType.HYEONG, members: new Set([Jiji.IN, Jiji.SIN]), note: '인신형' },
      outcome: InteractionOutcome.STRENGTHENED,
      interactsWith: [],
      reasoning: '강화됨',
      score: null,
    };

    const score = JijiRelationScorer.score(resolved, branchPositions);

    expect(score.baseScore).toBe(55);
    expect(score.outcomeMultiplier).toBe(1.3);
    // IN(0) and SIN(2): |0-2|=2, not adjacent => adjBonus=0
    expect(score.adjacencyBonus).toBe(0);
    expect(score.finalScore).toBe(71); // Math.trunc(55 * 1.3) = 71
  });

  it('scoreAll applies scores to all resolved relations', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const branchPositions = RelationInteractionResolver.buildBranchPositionMap(ps);
    const resolved: ResolvedRelation[] = [
      {
        hit: { type: JijiRelationType.YUKHAP, members: new Set([Jiji.JA, Jiji.CHUK]), note: '자축합' },
        outcome: InteractionOutcome.ACTIVE,
        interactsWith: [],
        reasoning: '성립',
        score: null,
      },
    ];

    const scored = JijiRelationScorer.scoreAll(resolved, branchPositions);
    expect(scored).toHaveLength(1);
    expect(scored[0]!.score).not.toBeNull();
    expect(scored[0]!.score!.finalScore).toBeGreaterThan(0);
  });
});
