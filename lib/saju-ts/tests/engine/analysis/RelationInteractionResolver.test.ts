import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import {
  InteractionOutcome,
  JijiRelationHit,
  JijiRelationType,
} from '../../../src/domain/Relations.js';
import { RelationInteractionResolver } from '../../../src/engine/analysis/RelationInteractionResolver.js';

/**
 * Ported from RelationInteractionResolverTest.kt.
 *
 * 22 tests covering 합충형파해 관계 상호작용 우선순위 및 결과 판정을 검증합니다.
 */

// ── Helper factories ────────────────────────────────────────────────

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

describe('RelationInteractionResolver', () => {

  // ── 1. Single relation: 육합 alone remains ACTIVE ───────────────────

  it('yukhap alone is ACTIVE', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const hits = [hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합')];

    const resolved = RelationInteractionResolver.resolve(hits, ps);

    expect(resolved.length).toBe(1);
    expect(resolved[0]!.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolved[0]!.interactsWith.length).toBe(0);
    expect(resolved[0]!.reasoning.length).toBeGreaterThan(0);
  });

  // ── 2. Single relation: 충 alone remains ACTIVE ─────────────────────

  it('chung alone is ACTIVE', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.IN, Jiji.MYO);
    const hits = [hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충')];

    const resolved = RelationInteractionResolver.resolve(hits, ps);

    expect(resolved.length).toBe(1);
    expect(resolved[0]!.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // ── 3. 육합 + 충 on same branch, 충 stronger by adjacency -> 합 BROKEN ─

  it('yukhap broken by adjacent chung', () => {
    // year=축, month=자, day=오, hour=미
    // 자축합: 축(year=0), 자(month=1)
    // 자오충: 자(month=1), 오(day=2)  -- 충 attacker adjacent to shared
    const ps = pillars(Jiji.CHUK, Jiji.JA, Jiji.O, Jiji.MI);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    const resolvedYukhap = resolved.find(r => r.hit.type === JijiRelationType.YUKHAP)!;
    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.BROKEN);
    expect(resolvedYukhap.interactsWith.some(h => h.type === JijiRelationType.CHUNG)).toBe(true);
    expect(resolvedYukhap.reasoning).toContain('파합');
  });

  // ── 4. 육합 + 충 on same branch, 합 stronger (non-adjacent 충) -> 충 WEAKENED

  it('chung weakened by yukhap when non-adjacent attacker', () => {
    // year=자, month=축, day=인, hour=오
    // 자축합: adjacent pair
    // 자오충: 자(year=0), 오(hour=3) -- non-adjacent -> 합해충
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.O);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedChung.reasoning).toContain('합해충');
  });

  // ── 5. Complete 삼합 + 충 on member -> 충 WEAKENED ────────────────────

  it('samhap weakens chung on member', () => {
    // 해묘미 삼합 (wood) + 묘유충
    const ps = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.YU);
    const samhap = hit(JijiRelationType.SAMHAP, [Jiji.HAE, Jiji.MYO, Jiji.MI], '해묘미 목국');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([samhap, chung], ps);

    const resolvedSamhap = resolved.find(r => r.hit.type === JijiRelationType.SAMHAP)!;
    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;

    // 삼합 stays active (higher priority)
    expect(resolvedSamhap.outcome).toBe(InteractionOutcome.ACTIVE);
    // 충 is weakened by the complete 삼합
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedChung.reasoning).toContain('삼합');
  });

  // ── 6. 형 + 합 -> both remain ACTIVE (형 persists through 합) ─────────

  it('hyeong persists through hap', () => {
    // 인해합 (yukhap) and 인사형(무은) (hyeong)
    const ps = pillars(Jiji.IN, Jiji.HAE, Jiji.SA, Jiji.CHUK);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.IN, Jiji.HAE], '인해합');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형(무은)');

    const resolved = RelationInteractionResolver.resolve([yukhap, hyeong], ps);

    const resolvedYukhap = resolved.find(r => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedHyeong = resolved.find(r => r.hit.type === JijiRelationType.HYEONG)!;

    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.ACTIVE);
    // Both should reference each other in interactsWith
    expect(resolvedHyeong.interactsWith.some(h => h.type === JijiRelationType.YUKHAP)).toBe(true);
    expect(resolvedYukhap.interactsWith.some(h => h.type === JijiRelationType.HYEONG)).toBe(true);
  });

  // ── 7. No conflicts -> all ACTIVE ────────────────────────────────────

  it('no conflicts all ACTIVE', () => {
    // 자축합 and 묘유충 share no branches -> independent, both ACTIVE
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.MYO, Jiji.YU);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    expect(resolved.length).toBe(2);
    expect(resolved.every(r => r.outcome === InteractionOutcome.ACTIVE)).toBe(true);
    expect(resolved.every(r => r.interactsWith.length === 0)).toBe(true);
  });

  // ── 8. Multiple relations -> correct priority ordering ───────────────

  it('multiple relations correct priority ordering', () => {
    // Chart: year=묘, month=유, day=술, hour=미
    const ps = pillars(Jiji.MYO, Jiji.YU, Jiji.SUL, Jiji.MI);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.MYO, Jiji.SUL], '묘술합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');
    const hae = hit(JijiRelationType.HAE, [Jiji.YU, Jiji.SUL], '유술해');
    const pa = hit(JijiRelationType.PA, [Jiji.MI, Jiji.SUL], '미술파');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung, hae, pa], ps);

    const resolvedYukhap = resolved.find(r => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;
    const resolvedHae = resolved.find(r => r.hit.type === JijiRelationType.HAE)!;
    const resolvedPa = resolved.find(r => r.hit.type === JijiRelationType.PA)!;

    // 충 attacker (유, month=1) vs shared (묘, year=0): |1-0|=1 adjacent -> 합 BROKEN
    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.BROKEN);
    // 충 is weakened by 합해충
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
    // 해 and 파 are lower priority, should be WEAKENED
    expect(resolvedHae.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedPa.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // ── 9. Reasoning strings are non-empty and Korean ───────────────────

  it('reasoning strings are non-empty Korean', () => {
    const ps = pillars(Jiji.CHUK, Jiji.JA, Jiji.O, Jiji.MI);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');

    const resolved = RelationInteractionResolver.resolve([yukhap, chung], ps);

    for (const r of resolved) {
      expect(r.reasoning.length).toBeGreaterThan(0);
      // Verify Korean characters are present (Hangul range: \uAC00-\uD7A3)
      const hasKorean = [...r.reasoning].some(ch => ch >= '\uAC00' && ch <= '\uD7A3');
      expect(hasKorean).toBe(true);
    }
  });

  // ── 10. Empty input returns empty output ────────────────────────────

  it('empty input returns empty output', () => {
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
    const resolved = RelationInteractionResolver.resolve([], ps);
    expect(resolved.length).toBe(0);
  });

  // ── 11. Priority function returns correct ordering ──────────────────

  it('priority of returns correct ordering', () => {
    const allTypes: JijiRelationType[] = [
      JijiRelationType.SAMHAP,
      JijiRelationType.BANGHAP,
      JijiRelationType.YUKHAP,
      JijiRelationType.BANHAP,
      JijiRelationType.CHUNG,
      JijiRelationType.HYEONG,
      JijiRelationType.PA,
      JijiRelationType.HAE,
      JijiRelationType.WONJIN,
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

  // ── 12. Adjacency helper ────────────────────────────────────────────

  it('areAdjacent returns true for diff of one', () => {
    expect(RelationInteractionResolver.areAdjacent(0, 1)).toBe(true);
    expect(RelationInteractionResolver.areAdjacent(1, 0)).toBe(true);
    expect(RelationInteractionResolver.areAdjacent(2, 3)).toBe(true);
  });

  it('areAdjacent returns false for diff greater than one', () => {
    expect(RelationInteractionResolver.areAdjacent(0, 2)).toBe(false);
    expect(RelationInteractionResolver.areAdjacent(0, 3)).toBe(false);
    expect(RelationInteractionResolver.areAdjacent(1, 3)).toBe(false);
  });

  // ── 13. positionsOf helper ──────────────────────────────────────────

  it('positionsOf finds all occurrences', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.JA, Jiji.MI);
    const positions = RelationInteractionResolver.positionsOf(Jiji.JA, ps);
    expect(positions).toEqual([0, 2]);
  });

  it('positionsOf returns empty for absent branch', () => {
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.IN, Jiji.MI);
    const positions = RelationInteractionResolver.positionsOf(Jiji.YU, ps);
    expect(positions.length).toBe(0);
  });

  // ── 14. 삼합 stays ACTIVE when overlapping 충 ────────────────────────

  it('complete samhap stays ACTIVE against chung', () => {
    const ps = pillars(Jiji.HAE, Jiji.MYO, Jiji.MI, Jiji.YU);
    const samhap = hit(JijiRelationType.SAMHAP, [Jiji.HAE, Jiji.MYO, Jiji.MI], '해묘미 목국');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([samhap, chung], ps);

    const resolvedSamhap = resolved.find(r => r.hit.type === JijiRelationType.SAMHAP)!;
    expect(resolvedSamhap.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // ── 15. 원진 weakened by higher-priority relation ───────────────────

  it('wonjin weakened by chung', () => {
    // 자미원진 and 자오충 share 자
    const ps = pillars(Jiji.JA, Jiji.O, Jiji.MI, Jiji.IN);
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충');
    const wonjin = hit(JijiRelationType.WONJIN, [Jiji.JA, Jiji.MI], '자미원진');

    const resolved = RelationInteractionResolver.resolve([chung, wonjin], ps);

    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;
    const resolvedWonjin = resolved.find(r => r.hit.type === JijiRelationType.WONJIN)!;

    expect(resolvedChung.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedWonjin.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // ── 16. 반합 broken by 충 ─────────────────────────────────────────

  it('banhap broken by chung', () => {
    // 인오 생왕반합(화) + 인신충
    const ps = pillars(Jiji.IN, Jiji.O, Jiji.SIN, Jiji.MI);
    const banhap = hit(JijiRelationType.BANHAP, [Jiji.IN, Jiji.O], '인오 생왕반합(화)');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.IN, Jiji.SIN], '인신충');

    const resolved = RelationInteractionResolver.resolve([banhap, chung], ps);

    const resolvedBanhap = resolved.find(r => r.hit.type === JijiRelationType.BANHAP)!;
    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;

    // 반합 is broken by 충
    expect(resolvedBanhap.outcome).toBe(InteractionOutcome.BROKEN);
    expect(resolvedBanhap.reasoning).toContain('파합');
    // 충 is weakened by the partial 합 influence
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  it('banhap alone is ACTIVE', () => {
    const ps = pillars(Jiji.IN, Jiji.O, Jiji.CHUK, Jiji.MI);
    const banhap = hit(JijiRelationType.BANHAP, [Jiji.IN, Jiji.O], '인오 생왕반합(화)');

    const resolved = RelationInteractionResolver.resolve([banhap], ps);

    expect(resolved.length).toBe(1);
    expect(resolved[0]!.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // ── 17. 형 persists through 반합 too ──────────────────────────────

  it('hyeong persists through banhap', () => {
    // 인사형(무은) + 인오 생왕반합(화)
    const ps = pillars(Jiji.IN, Jiji.O, Jiji.SA, Jiji.MI);
    const banhap = hit(JijiRelationType.BANHAP, [Jiji.IN, Jiji.O], '인오 생왕반합(화)');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형(무은)');

    const resolved = RelationInteractionResolver.resolve([banhap, hyeong], ps);

    const resolvedBanhap = resolved.find(r => r.hit.type === JijiRelationType.BANHAP)!;
    const resolvedHyeong = resolved.find(r => r.hit.type === JijiRelationType.HYEONG)!;

    // 형 persists through all hap types including 반합
    expect(resolvedBanhap.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // ── 18. 충+형 동일 지지 -> 형 강화 ──────────────────────────────────

  it('chung strengthens hyeong on same branches', () => {
    // 인신충 + 인신형: same branch pair -> 형 STRENGTHENED, 충 ACTIVE
    const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.SIN, Jiji.CHUK);
    const chung = hit(JijiRelationType.CHUNG, [Jiji.IN, Jiji.SIN], '인신충');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SIN], '인신형');

    const resolved = RelationInteractionResolver.resolve([chung, hyeong], ps);

    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;
    const resolvedHyeong = resolved.find(r => r.hit.type === JijiRelationType.HYEONG)!;

    expect(resolvedChung.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.STRENGTHENED);
    expect(resolvedHyeong.reasoning).toContain('강화');
  });

  it('chung hyeong partial overlap no strengthening', () => {
    // 인신충{인,신} + 인사형{인,사}: share only 인 (1 branch) -> no strengthening
    const ps = pillars(Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.CHUK);
    const chung = hit(JijiRelationType.CHUNG, [Jiji.IN, Jiji.SIN], '인신충');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형');

    const resolved = RelationInteractionResolver.resolve([chung, hyeong], ps);

    const resolvedHyeong = resolved.find(r => r.hit.type === JijiRelationType.HYEONG)!;
    // Partial overlap: generic priority rule, 형(6) weaker than 충(5) -> WEAKENED
    expect(resolvedHyeong.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // ── 19. 해 + 육합 -> 해가 합을 약화 (육해 관계) ─────────────────────

  it('hae weakens yukhap', () => {
    // 자축합(육합) + 자미해: share 자 -> 합 WEAKENED by 해
    const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.MI, Jiji.IN);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합');
    const hae = hit(JijiRelationType.HAE, [Jiji.JA, Jiji.MI], '자미해');

    const resolved = RelationInteractionResolver.resolve([yukhap, hae], ps);

    const resolvedYukhap = resolved.find(r => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedHae = resolved.find(r => r.hit.type === JijiRelationType.HAE)!;

    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedYukhap.reasoning).toContain('육해');
    // 해 stays ACTIVE (it's performing its function of harming the 합)
    expect(resolvedHae.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  // ── 20. 파 + 합 동일 지지 2개 이상 -> 합 약화 ──────────────────────

  it('pa weakens hap on same branch pair', () => {
    // 인해합(육합) + 인해파: exact same pair -> 합 WEAKENED, 파 ACTIVE
    const ps = pillars(Jiji.IN, Jiji.HAE, Jiji.JIN, Jiji.CHUK);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.IN, Jiji.HAE], '인해합');
    const pa = hit(JijiRelationType.PA, [Jiji.IN, Jiji.HAE], '인해파');

    const resolved = RelationInteractionResolver.resolve([yukhap, pa], ps);

    const resolvedYukhap = resolved.find(r => r.hit.type === JijiRelationType.YUKHAP)!;
    const resolvedPa = resolved.find(r => r.hit.type === JijiRelationType.PA)!;

    expect(resolvedYukhap.outcome).toBe(InteractionOutcome.WEAKENED);
    expect(resolvedYukhap.reasoning).toContain('파');
    expect(resolvedPa.outcome).toBe(InteractionOutcome.ACTIVE);
  });

  it('pa with single shared branch uses generic rule', () => {
    // 미술파{미,술} + 묘술합{묘,술}: share only 술 (1 branch)
    // Generic rule: 합(3) > 파(7) -> 파 WEAKENED
    const ps = pillars(Jiji.MYO, Jiji.SUL, Jiji.MI, Jiji.IN);
    const yukhap = hit(JijiRelationType.YUKHAP, [Jiji.MYO, Jiji.SUL], '묘술합');
    const pa = hit(JijiRelationType.PA, [Jiji.MI, Jiji.SUL], '미술파');

    const resolved = RelationInteractionResolver.resolve([yukhap, pa], ps);

    const resolvedPa = resolved.find(r => r.hit.type === JijiRelationType.PA)!;
    expect(resolvedPa.outcome).toBe(InteractionOutcome.WEAKENED);
  });

  // ── 21. 삼형 완성 -> 구성 상형 강화 ────────────────────────────────

  it('complete samhyeong strengthens constituent pair hyeong', () => {
    // 인사신 삼형(무은지형) + 인사형(상형): 인사 is subset of 인사신 -> 상형 STRENGTHENED
    const ps = pillars(Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.CHUK);
    const samhyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA, Jiji.SIN], '인사신 삼형');
    const sanghyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형');

    const resolved = RelationInteractionResolver.resolve([samhyeong, sanghyeong], ps);

    const resolvedSanghyeong = resolved.find(r => r.hit.members.size === 2)!;
    expect(resolvedSanghyeong.outcome).toBe(InteractionOutcome.STRENGTHENED);
    expect(resolvedSanghyeong.reasoning).toContain('삼형');
  });

  it('chukSulMi samhyeong strengthens chukMi hyeong', () => {
    // 축술미 삼형(지세지형) + 축미형: 축미 is subset of 축술미 -> 상형 STRENGTHENED
    const ps = pillars(Jiji.CHUK, Jiji.SUL, Jiji.MI, Jiji.IN);
    const samhyeong = hit(JijiRelationType.HYEONG, [Jiji.CHUK, Jiji.SUL, Jiji.MI], '축술미 삼형');
    const sanghyeong = hit(JijiRelationType.HYEONG, [Jiji.CHUK, Jiji.MI], '축미형');

    const resolved = RelationInteractionResolver.resolve([samhyeong, sanghyeong], ps);

    const resolvedSanghyeong = resolved.find(r => r.hit.members.size === 2)!;
    expect(resolvedSanghyeong.outcome).toBe(InteractionOutcome.STRENGTHENED);
    expect(resolvedSanghyeong.reasoning).toContain('삼형');
  });

  // ── 22. 방합 weakens 충 on shared member ────────────────────────────

  it('banghap weakens chung on shared member', () => {
    // 인묘진 방합(동방 목합) + 묘유충
    const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.YU);
    const banghap = hit(JijiRelationType.BANGHAP, [Jiji.IN, Jiji.MYO, Jiji.JIN], '동방 목합');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');

    const resolved = RelationInteractionResolver.resolve([banghap, chung], ps);

    const resolvedBanghap = resolved.find(r => r.hit.type === JijiRelationType.BANGHAP)!;
    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;

    expect(resolvedBanghap.outcome).toBe(InteractionOutcome.ACTIVE);
    expect(resolvedChung.outcome).toBe(InteractionOutcome.WEAKENED);
  });
});
