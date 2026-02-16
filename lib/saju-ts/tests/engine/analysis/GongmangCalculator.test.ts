import { describe, it, expect } from 'vitest';
import {
  sexagenaryIndex,
  voidBranchesOf,
  calculateGongmang,
} from '../../../src/engine/analysis/GongmangCalculator.js';
import { Cheongan, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';

// =========================================================================
// sexagenaryIndex -- Verify the mapping from (stem, branch) to 0..59 index
// =========================================================================

describe('sexagenaryIndex', () => {
  it('GAP-JA is index 0', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.JA))).toBe(0);
  });

  it('EUL-CHUK is index 1', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.EUL, Jiji.CHUK))).toBe(1);
  });

  it('GYE-HAE is index 59', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.GYE, Jiji.HAE))).toBe(59);
  });

  it('GAP-SUL is index 10', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.SUL))).toBe(10);
  });

  it('GAP-SIN is index 20', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.SIN))).toBe(20);
  });

  it('GAP-O is index 30', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.O))).toBe(30);
  });

  it('GAP-JIN is index 40', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.JIN))).toBe(40);
  });

  it('GAP-IN is index 50', () => {
    expect(sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.IN))).toBe(50);
  });

  it('invalid parity throws', () => {
    // GAP (ordinal 0, even) + CHUK (ordinal 1, odd) = parity mismatch
    expect(() => sexagenaryIndex(new Pillar(Cheongan.GAP, Jiji.CHUK))).toThrow();
  });
});

// =========================================================================
// voidBranchesOf -- Verify the two void branches for each of the six 旬
// =========================================================================

describe('voidBranchesOf', () => {
  it('갑자旬 void = SUL, HAE', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.JA));
    expect(result).toEqual([Jiji.SUL, Jiji.HAE]);
  });

  it('갑술旬 void = SIN, YU', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.SUL));
    expect(result).toEqual([Jiji.SIN, Jiji.YU]);
  });

  it('갑신旬 void = O, MI', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.SIN));
    expect(result).toEqual([Jiji.O, Jiji.MI]);
  });

  it('갑오旬 void = JIN, SA', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.O));
    expect(result).toEqual([Jiji.JIN, Jiji.SA]);
  });

  it('갑진旬 void = IN, MYO', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.JIN));
    expect(result).toEqual([Jiji.IN, Jiji.MYO]);
  });

  it('갑인旬 void = JA, CHUK', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GAP, Jiji.IN));
    expect(result).toEqual([Jiji.JA, Jiji.CHUK]);
  });

  it('EUL-CHUK (same 旬 as GAP-JA) = SUL, HAE', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.EUL, Jiji.CHUK));
    expect(result).toEqual([Jiji.SUL, Jiji.HAE]);
  });

  it('GYE-YU (last in 갑자旬) = SUL, HAE', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GYE, Jiji.YU));
    expect(result).toEqual([Jiji.SUL, Jiji.HAE]);
  });

  it('BYEONG-IN (in 갑자旬) = SUL, HAE', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.BYEONG, Jiji.IN));
    expect(result).toEqual([Jiji.SUL, Jiji.HAE]);
  });

  it('GYE-MI (in 갑술旬) = SIN, YU', () => {
    const result = voidBranchesOf(new Pillar(Cheongan.GYE, Jiji.MI));
    expect(result).toEqual([Jiji.SIN, Jiji.YU]);
  });
});

// =========================================================================
// calculateGongmang -- Full analysis with PillarSet
// =========================================================================

describe('calculateGongmang', () => {
  it('year branch hits void', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),    // SUL is void
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(pillars);

    expect(result.voidBranches).toEqual([Jiji.SUL, Jiji.HAE]);
    expect(result.affectedPositions).toHaveLength(1);
    expect(result.affectedPositions[0]!.position).toBe(PillarPosition.YEAR);
    expect(result.affectedPositions[0]!.branch).toBe(Jiji.SUL);
  });

  it('multiple pillar positions hit void', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.EUL, Jiji.HAE),
    );
    const result = calculateGongmang(pillars);

    expect(result.affectedPositions).toHaveLength(2);
    expect(result.affectedPositions.some(
      h => h.position === PillarPosition.YEAR && h.branch === Jiji.SUL,
    )).toBe(true);
    expect(result.affectedPositions.some(
      h => h.position === PillarPosition.HOUR && h.branch === Jiji.HAE,
    )).toBe(true);
  });

  it('no hits when no branch is void', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.EUL, Jiji.MYO),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(pillars);

    expect(result.voidBranches).toEqual([Jiji.SUL, Jiji.HAE]);
    expect(result.affectedPositions).toHaveLength(0);
  });

  it('day pillar is never reported as hit', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.SUL),
    );
    const result = calculateGongmang(pillars);

    expect(result.affectedPositions.every(h => h.position !== PillarPosition.DAY)).toBe(true);
    expect(result.affectedPositions).toHaveLength(3);
  });
});

// =========================================================================
// Restoration (해공) detection
// =========================================================================

describe('Restoration (해공)', () => {
  it('충 restores void', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),    // void hit
      new Pillar(Cheongan.GAP, Jiji.JIN),    // JIN clashes with SUL
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(pillars);
    const hit = result.affectedPositions[0]!;

    expect(hit.position).toBe(PillarPosition.YEAR);
    expect(hit.branch).toBe(Jiji.SUL);
    expect(hit.isRestored).toBe(true);
    expect(hit.restorationNote).toBe('충으로 해공');
  });

  it('육합 restores void', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),    // void hit
      new Pillar(Cheongan.EUL, Jiji.MYO),    // MYO combines with SUL (육합)
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),  // IN does not clash/punish/combine with SUL
    );
    const result = calculateGongmang(pillars);
    const hit = result.affectedPositions[0]!;

    expect(hit.isRestored).toBe(true);
    expect(hit.restorationNote).toBe('합으로 해공');
  });

  it('형 restores void', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),     // void hit
      new Pillar(Cheongan.EUL, Jiji.CHUK),    // CHUK punishes SUL (형)
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
    );
    const result = calculateGongmang(pillars);
    const hit = result.affectedPositions[0]!;

    expect(hit.isRestored).toBe(true);
    expect(hit.restorationNote).toBe('형으로 해공');
  });

  it('충 takes priority over 형 and 합', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SUL),     // void hit
      new Pillar(Cheongan.GAP, Jiji.JIN),     // 충 (JIN-SUL clash)
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.EUL, Jiji.CHUK),    // 형 (CHUK-SUL punishment)
    );
    const result = calculateGongmang(pillars);
    const hit = result.affectedPositions[0]!;

    expect(hit.isRestored).toBe(true);
    expect(hit.restorationNote).toBe('충으로 해공');
  });

  it('no restoration when no relation present', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.EUL, Jiji.HAE),     // void hit
      new Pillar(Cheongan.EUL, Jiji.MYO),     // MYO: no relation to HAE
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.O),    // O: no relation to HAE
    );
    const result = calculateGongmang(pillars);
    const hit = result.affectedPositions[0]!;

    expect(hit.isRestored).toBe(false);
    expect(hit.restorationNote).toBe('');
  });

  it('HAE void restored by 충 with SA', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.EUL, Jiji.SA),      // SA clashes with HAE
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.EUL, Jiji.HAE),     // void hit
    );
    const result = calculateGongmang(pillars);
    const hit = result.affectedPositions[0]!;

    expect(hit.position).toBe(PillarPosition.HOUR);
    expect(hit.isRestored).toBe(true);
    expect(hit.restorationNote).toBe('충으로 해공');
  });
});

// =========================================================================
// Edge cases and cross-validation
// =========================================================================

describe('Edge cases', () => {
  it('all six 旬 starts produce distinct void pairs', () => {
    const xunStarts = [
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.GAP, Jiji.SUL),
      new Pillar(Cheongan.GAP, Jiji.SIN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.GAP, Jiji.IN),
    ];
    const voidPairs = xunStarts.map(p => voidBranchesOf(p));

    // Check 6 distinct pairs using JSON serialization
    const uniquePairs = new Set(voidPairs.map(p => JSON.stringify(p)));
    expect(uniquePairs.size).toBe(6);

    // Together, the 12 void branches should cover all 12 branches exactly once
    const allVoidBranches = new Set(voidPairs.flatMap(p => [p[0], p[1]]));
    expect(allVoidBranches).toEqual(new Set(JIJI_VALUES));
  });

  it('consecutive pillars in same 旬 share void branches', () => {
    // All pillars in the 갑자旬 (indices 0-9) should have the same void pair
    const xunPillars = Array.from({ length: 10 }, (_, i) =>
      new Pillar(CHEONGAN_VALUES[i % 10]!, JIJI_VALUES[i % 12]!),
    );
    const expected: readonly [Jiji, Jiji] = [Jiji.SUL, Jiji.HAE];
    for (const pillar of xunPillars) {
      expect(voidBranchesOf(pillar)).toEqual(expected);
    }
  });

  it('month branch can also be void', () => {
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JIN),
      new Pillar(Cheongan.EUL, Jiji.CHUK),    // CHUK is void
      new Pillar(Cheongan.GAP, Jiji.IN),
      new Pillar(Cheongan.BYEONG, Jiji.O),
    );
    const result = calculateGongmang(pillars);

    expect(result.voidBranches).toEqual([Jiji.JA, Jiji.CHUK]);
    expect(result.affectedPositions).toHaveLength(1);
    expect(result.affectedPositions[0]!.position).toBe(PillarPosition.MONTH);
    expect(result.affectedPositions[0]!.branch).toBe(Jiji.CHUK);
  });
});
