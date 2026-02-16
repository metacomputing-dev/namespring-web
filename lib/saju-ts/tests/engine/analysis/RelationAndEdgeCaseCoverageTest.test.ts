import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { JijiRelationType, type JijiRelationHit } from '../../../src/domain/Relations.js';
import { RelationInteractionResolver } from '../../../src/engine/analysis/RelationInteractionResolver.js';
import { ShinsalCompositeInterpreter } from '../../../src/engine/analysis/ShinsalCompositeInterpreter.js';
import type { ShinsalHit } from '../../../src/domain/Shinsal.js';

/**
 * Relation interaction + shinsal composite + edge case coverage tests.
 *
 * Part A: 3-way interaction tests (samhap+chung+hyeong)
 * Part B: ShinsalCompositeInterpreter edge cases
 */

// ---- Helpers ----

function makePillars(year: Jiji, month: Jiji, day: Jiji, hour: Jiji): PillarSet {
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

function shinsalHit(
  type: string,
  position: PillarPosition = PillarPosition.DAY,
  branch: Jiji = Jiji.IN,
): ShinsalHit {
  return { type, position, referenceBranch: branch, note: '' } as ShinsalHit;
}

// ================================================================
// Part A: 3-way interaction tests
// ================================================================

describe('Three-Way Interaction Tests', () => {

  it('SUL in samhap plus chung -- samhap active chung weakened', () => {
    const ps = makePillars(Jiji.IN, Jiji.O, Jiji.SUL, Jiji.JIN);
    const samhap = hit(JijiRelationType.SAMHAP, [Jiji.IN, Jiji.O, Jiji.SUL], '인오술 화국');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.JIN, Jiji.SUL], '진술충');

    const resolved = RelationInteractionResolver.resolve([samhap, chung], ps);

    const resolvedSamhap = resolved.find(r => r.hit.type === JijiRelationType.SAMHAP)!;
    const resolvedChung = resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!;

    expect(resolvedSamhap.outcome).toBe('ACTIVE');
    expect(resolvedChung.outcome).toBe('WEAKENED');
  });

  it('SA in samhap plus chung -- samhap wins', () => {
    const ps = makePillars(Jiji.SA, Jiji.YU, Jiji.CHUK, Jiji.HAE);
    const samhap = hit(JijiRelationType.SAMHAP, [Jiji.SA, Jiji.YU, Jiji.CHUK], '사유축 금국');
    const chung = hit(JijiRelationType.CHUNG, [Jiji.SA, Jiji.HAE], '사해충');

    const resolved = RelationInteractionResolver.resolve([samhap, chung], ps);

    expect(resolved.find(r => r.hit.type === JijiRelationType.SAMHAP)!.outcome).toBe('ACTIVE');
    expect(resolved.find(r => r.hit.type === JijiRelationType.CHUNG)!.outcome).toBe('WEAKENED');
  });

  it('SA in samhap plus hyeong -- both active by hyeong-bul-hae-hap', () => {
    const ps = makePillars(Jiji.IN, Jiji.SA, Jiji.YU, Jiji.CHUK);
    const samhap = hit(JijiRelationType.SAMHAP, [Jiji.SA, Jiji.YU, Jiji.CHUK], '사유축 금국');
    const hyeong = hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SA], '인사형');

    const resolved = RelationInteractionResolver.resolve([samhap, hyeong], ps);

    expect(resolved.find(r => r.hit.type === JijiRelationType.SAMHAP)!.outcome).toBe('ACTIVE');
    expect(resolved.find(r => r.hit.type === JijiRelationType.HYEONG)!.outcome).toBe('ACTIVE');
  });

  it('priority ordering is consistent', () => {
    const expectedOrder = [
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
    const allTypes = Object.values(JijiRelationType);
    const sorted = [...allTypes].sort(
      (a, b) => RelationInteractionResolver.priorityOf(a) - RelationInteractionResolver.priorityOf(b),
    );
    expect(sorted).toEqual(expectedOrder);
  });

  it('three relations sharing YU resolve by priority', () => {
    const ps = makePillars(Jiji.MYO, Jiji.YU, Jiji.SUL, Jiji.JA);

    const chung = hit(JijiRelationType.CHUNG, [Jiji.MYO, Jiji.YU], '묘유충');
    const pa = hit(JijiRelationType.PA, [Jiji.JA, Jiji.YU], '자유파');
    const hae = hit(JijiRelationType.HAE, [Jiji.YU, Jiji.SUL], '유술해');

    const resolved = RelationInteractionResolver.resolve([chung, pa, hae], ps);

    const rChung = resolved.find(r => r.hit.note === '묘유충')!;
    const rPa = resolved.find(r => r.hit.note === '자유파')!;
    const rHae = resolved.find(r => r.hit.note === '유술해')!;

    expect(rChung.outcome).toBe('ACTIVE');
    expect(rPa.outcome).toBe('WEAKENED');
    expect(rHae.outcome).toBe('WEAKENED');
  });
});

// ================================================================
// Part B: ShinsalCompositeInterpreter edge cases
// ================================================================

describe('ShinsalCompositeInterpreter Edge Cases', () => {

  it('single hit produces no composites', () => {
    const hits = [shinsalHit('YEOKMA')];
    const composites = ShinsalCompositeInterpreter.detect(hits as ShinsalHit[]);
    expect(composites.length).toBe(0);
  });

  it('two non-matching hits produce no composites', () => {
    const hits = [
      shinsalHit('BAEKHO'),
      shinsalHit('GOSIN'),
    ];
    const composites = ShinsalCompositeInterpreter.detect(hits as ShinsalHit[]);
    expect(composites.length).toBe(0);
  });

  it('multiple composites detected simultaneously', () => {
    const hits = [
      shinsalHit('YEOKMA', PillarPosition.YEAR),
      shinsalHit('DOHWA', PillarPosition.MONTH),
      shinsalHit('HWAGAE', PillarPosition.DAY),
    ];
    const composites = ShinsalCompositeInterpreter.detect(hits as ShinsalHit[]);
    // Should detect at least yeokma+dohwa and dohwa+hwagae
    expect(composites.length).toBeGreaterThanOrEqual(2);
    expect(composites.some(c => c.patternName.includes('역마') && c.patternName.includes('도화'))).toBe(true);
    expect(composites.some(c => c.patternName.includes('도화') && c.patternName.includes('화개'))).toBe(true);
  });
});
