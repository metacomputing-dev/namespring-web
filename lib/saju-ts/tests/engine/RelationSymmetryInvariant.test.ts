import { describe, it, expect } from 'vitest';
import { RelationAnalyzer } from '../../src/engine/analysis/RelationAnalyzer.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';
import { JijiRelationType } from '../../src/domain/Relations.js';

/**
 * Comprehensive mathematical symmetry and invariant verification
 * for all Jiji (ground-branch) relation types across all 144 pairs (12 x 12).
 *
 * Verifies:
 * 1. Binary relation symmetry: R(A,B) iff R(B,A) for symmetric relations
 * 2. Cardinality invariants: exact pair counts per relation type
 * 3. Self-relation (reflexive) properties
 * 4. Hyeong subtype properties
 * 5. Samhap commutativity: detection regardless of member order
 * 6. Mutual exclusivity and overlap analysis
 * 7. Graph-theory properties (perfect matchings, partitions)
 * 8. Negative tests: non-canonical pairs should not fire
 *
 * Ported from RelationSymmetryInvariantTest.kt (I-02)
 */

const analyzer = new RelationAnalyzer();
const allJiji = [...JIJI_VALUES];

// ── Canonical pair definitions (source of truth from traditional tables) ──

const YUKHAP_CANONICAL: ReadonlySet<string> = new Set([
  pairKey(Jiji.JA, Jiji.CHUK),
  pairKey(Jiji.IN, Jiji.HAE),
  pairKey(Jiji.MYO, Jiji.SUL),
  pairKey(Jiji.JIN, Jiji.YU),
  pairKey(Jiji.SA, Jiji.SIN),
  pairKey(Jiji.O, Jiji.MI),
]);

const CHUNG_CANONICAL: ReadonlySet<string> = new Set([
  pairKey(Jiji.JA, Jiji.O),
  pairKey(Jiji.CHUK, Jiji.MI),
  pairKey(Jiji.IN, Jiji.SIN),
  pairKey(Jiji.MYO, Jiji.YU),
  pairKey(Jiji.JIN, Jiji.SUL),
  pairKey(Jiji.SA, Jiji.HAE),
]);

const PA_CANONICAL: ReadonlySet<string> = new Set([
  pairKey(Jiji.JA, Jiji.YU),
  pairKey(Jiji.CHUK, Jiji.JIN),
  pairKey(Jiji.IN, Jiji.HAE),
  pairKey(Jiji.MYO, Jiji.O),
  pairKey(Jiji.SA, Jiji.SIN),
  pairKey(Jiji.MI, Jiji.SUL),
]);

const HAE_CANONICAL: ReadonlySet<string> = new Set([
  pairKey(Jiji.JA, Jiji.MI),
  pairKey(Jiji.CHUK, Jiji.O),
  pairKey(Jiji.IN, Jiji.SA),
  pairKey(Jiji.MYO, Jiji.JIN),
  pairKey(Jiji.SIN, Jiji.HAE),
  pairKey(Jiji.YU, Jiji.SUL),
]);

const WONJIN_CANONICAL: ReadonlySet<string> = new Set([
  pairKey(Jiji.JA, Jiji.MI),
  pairKey(Jiji.CHUK, Jiji.O),
  pairKey(Jiji.IN, Jiji.YU),
  pairKey(Jiji.MYO, Jiji.SIN),
  pairKey(Jiji.JIN, Jiji.HAE),
  pairKey(Jiji.SA, Jiji.SUL),
]);

const SAMHAP_GROUPS: ReadonlyArray<ReadonlySet<Jiji>> = [
  new Set([Jiji.IN, Jiji.O, Jiji.SUL]),     // fire
  new Set([Jiji.HAE, Jiji.MYO, Jiji.MI]),   // wood
  new Set([Jiji.SA, Jiji.YU, Jiji.CHUK]),   // metal
  new Set([Jiji.SIN, Jiji.JA, Jiji.JIN]),   // water
];

const HYEONG_PAIRS_CANONICAL: ReadonlySet<string> = new Set([
  pairKey(Jiji.IN, Jiji.SIN),
  pairKey(Jiji.IN, Jiji.SA),
  pairKey(Jiji.SA, Jiji.SIN),
  pairKey(Jiji.CHUK, Jiji.MI),
  pairKey(Jiji.CHUK, Jiji.SUL),
  pairKey(Jiji.SUL, Jiji.MI),
  pairKey(Jiji.JA, Jiji.MYO),
]);

const SELF_HYEONG_BRANCHES: ReadonlySet<Jiji> = new Set([Jiji.JIN, Jiji.O, Jiji.YU, Jiji.HAE]);

// ── Helpers ──

/** Canonical unordered pair key for set membership checks. */
function pairKey(a: Jiji, b: Jiji): string {
  return [a, b].sort().join('|');
}

/** Build a PillarSet placing specific branches at known positions. */
function pairPillars(a: Jiji, b: Jiji): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, a),
    new Pillar(Cheongan.EUL, b),
    new Pillar(Cheongan.BYEONG, a),
    new Pillar(Cheongan.JEONG, b),
  );
}

function pillars(y: Jiji, m: Jiji, d: Jiji, h: Jiji): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, y),
    new Pillar(Cheongan.EUL, m),
    new Pillar(Cheongan.BYEONG, d),
    new Pillar(Cheongan.JEONG, h),
  );
}

/** Check if a specific relation type is detected between two branches. */
function hasRelation(type: JijiRelationType, a: Jiji, b: Jiji): boolean {
  const hits = analyzer.analyze(pairPillars(a, b));
  return hits.some(
    (h) =>
      h.type === type &&
      h.members.size === new Set([a, b]).size &&
      [...new Set([a, b])].every((m) => h.members.has(m)),
  );
}

/** Check self-relation (same branch in multiple positions). */
function hasSelfRelation(type: JijiRelationType, j: Jiji): boolean {
  const ps = pillars(j, j, j, j);
  const hits = analyzer.analyze(ps);
  return hits.some(
    (h) => h.type === type && h.members.size === 1 && h.members.has(j),
  );
}

/** Generate all 144 ordered pairs. */
function allOrderedPairs(): Array<[Jiji, Jiji]> {
  const pairs: Array<[Jiji, Jiji]> = [];
  for (const a of allJiji) {
    for (const b of allJiji) {
      pairs.push([a, b]);
    }
  }
  return pairs;
}

// =========================================================================
// 1. Symmetry of Binary Relations
// =========================================================================

describe('Binary Relation Symmetry (144 pairs each)', () => {
  const pairs = allOrderedPairs();

  describe('YUKHAP is symmetric', () => {
    it.each(pairs)('YUKHAP(%s, %s)', (a, b) => {
      const forward = hasRelation(JijiRelationType.YUKHAP, a, b);
      const reverse = hasRelation(JijiRelationType.YUKHAP, b, a);
      expect(forward).toBe(reverse);
    });
  });

  describe('CHUNG is symmetric', () => {
    it.each(pairs)('CHUNG(%s, %s)', (a, b) => {
      const forward = hasRelation(JijiRelationType.CHUNG, a, b);
      const reverse = hasRelation(JijiRelationType.CHUNG, b, a);
      expect(forward).toBe(reverse);
    });
  });

  describe('PA is symmetric', () => {
    it.each(pairs)('PA(%s, %s)', (a, b) => {
      const forward = hasRelation(JijiRelationType.PA, a, b);
      const reverse = hasRelation(JijiRelationType.PA, b, a);
      expect(forward).toBe(reverse);
    });
  });

  describe('HAE is symmetric', () => {
    it.each(pairs)('HAE(%s, %s)', (a, b) => {
      const forward = hasRelation(JijiRelationType.HAE, a, b);
      const reverse = hasRelation(JijiRelationType.HAE, b, a);
      expect(forward).toBe(reverse);
    });
  });

  describe('WONJIN is symmetric', () => {
    it.each(pairs)('WONJIN(%s, %s)', (a, b) => {
      const forward = hasRelation(JijiRelationType.WONJIN, a, b);
      const reverse = hasRelation(JijiRelationType.WONJIN, b, a);
      expect(forward).toBe(reverse);
    });
  });

  describe('HYEONG pair is symmetric', () => {
    it.each(pairs.filter(([a, b]) => a !== b))('HYEONG(%s, %s)', (a, b) => {
      const forward = hasRelation(JijiRelationType.HYEONG, a, b);
      const reverse = hasRelation(JijiRelationType.HYEONG, b, a);
      expect(forward).toBe(reverse);
    });
  });
});

// =========================================================================
// 2. Hyeong Subtype Properties
// =========================================================================

describe('Hyeong Subtype Properties', () => {
  it('muryejihyeong -- ja and myo always detected', () => {
    expect(hasRelation(JijiRelationType.HYEONG, Jiji.JA, Jiji.MYO)).toBe(true);
    expect(hasRelation(JijiRelationType.HYEONG, Jiji.MYO, Jiji.JA)).toBe(true);
  });

  it('muryejihyeong note contains murye', () => {
    const hits = analyzer.analyze(pairPillars(Jiji.JA, Jiji.MYO));
    const hyeong = hits.filter((h) => h.type === JijiRelationType.HYEONG);
    expect(hyeong.some((h) => h.note.includes('무례'))).toBe(true);
  });

  it('mueunjihyeong pairs all carry mueun note', () => {
    const mueunPairs: Array<[Jiji, Jiji]> = [
      [Jiji.IN, Jiji.SA],
      [Jiji.IN, Jiji.SIN],
      [Jiji.SA, Jiji.SIN],
    ];
    for (const [a, b] of mueunPairs) {
      const hits = analyzer.analyze(pairPillars(a, b));
      const hyeong = hits.filter((h) => h.type === JijiRelationType.HYEONG);
      expect(hyeong.some((h) => h.note.includes('무은'))).toBe(
        true,
        `${a}-${b} should have mueun annotation`,
      );
    }
  });

  it('jisejihyeong pairs all carry jise note', () => {
    const jisePairs: Array<[Jiji, Jiji]> = [
      [Jiji.CHUK, Jiji.MI],
      [Jiji.CHUK, Jiji.SUL],
      [Jiji.SUL, Jiji.MI],
    ];
    for (const [a, b] of jisePairs) {
      const hits = analyzer.analyze(pairPillars(a, b));
      const hyeong = hits.filter((h) => h.type === JijiRelationType.HYEONG);
      expect(hyeong.some((h) => h.note.includes('지세'))).toBe(
        true,
        `${a}-${b} should have jise annotation`,
      );
    }
  });

  it('jahyeong -- exactly 4 self-punishing branches', () => {
    const selfPunishing = new Set(
      allJiji.filter((j) => hasSelfRelation(JijiRelationType.HYEONG, j)),
    );
    expect(selfPunishing).toEqual(SELF_HYEONG_BRANCHES);
  });

  it.each([Jiji.JIN, Jiji.O, Jiji.YU, Jiji.HAE])(
    'self-hyeong for %s has jahyeong note',
    (j) => {
      const ps = pillars(j, j, j, j);
      const hits = analyzer.analyze(ps);
      const selfHit = hits.filter(
        (h) => h.type === JijiRelationType.HYEONG && h.members.size === 1 && h.members.has(j),
      );
      expect(selfHit.some((h) => h.note.includes('자형'))).toBe(true);
    },
  );

  it('mueun triple detected when all three present', () => {
    const ps = pillars(Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.JA);
    const hits = analyzer.analyze(ps);
    expect(
      hits.some(
        (h) =>
          h.type === JijiRelationType.HYEONG &&
          h.members.has(Jiji.IN) &&
          h.members.has(Jiji.SA) &&
          h.members.has(Jiji.SIN) &&
          h.note.includes('무은지형'),
      ),
    ).toBe(true);
  });

  it('jise triple detected when all three present', () => {
    const ps = pillars(Jiji.CHUK, Jiji.SUL, Jiji.MI, Jiji.JA);
    const hits = analyzer.analyze(ps);
    expect(
      hits.some(
        (h) =>
          h.type === JijiRelationType.HYEONG &&
          h.members.has(Jiji.CHUK) &&
          h.members.has(Jiji.SUL) &&
          h.members.has(Jiji.MI) &&
          h.note.includes('지세지형'),
      ),
    ).toBe(true);
  });
});

// =========================================================================
// 3. Samhap Commutativity
// =========================================================================

describe('Samhap Commutativity', () => {
  for (const group of SAMHAP_GROUPS) {
    const members = [...group];
    const [x, y, z] = members;

    it(`samhap detected in all 6 permutations: {${x}, ${y}, ${z}}`, () => {
      const filler = allJiji.find((j) => !group.has(j))!;
      const permutations = [
        [x, y, z], [x, z, y], [y, x, z],
        [y, z, x], [z, x, y], [z, y, x],
      ];
      for (const perm of permutations) {
        const ps = pillars(perm[0]!, perm[1]!, perm[2]!, filler);
        const hits = analyzer.analyze(ps);
        expect(
          hits.some(
            (h) =>
              h.type === JijiRelationType.SAMHAP &&
              members.every((m) => h.members.has(m)),
          ),
        ).toBe(true);
      }
    });
  }

  it('samhap also detected when member is in 4th pillar position', () => {
    for (const group of SAMHAP_GROUPS) {
      const list = [...group];
      const filler = allJiji.find((j) => !group.has(j))!;
      const ps = pillars(filler, list[0]!, list[1]!, list[2]!);
      const hits = analyzer.analyze(ps);
      expect(
        hits.some(
          (h) =>
            h.type === JijiRelationType.SAMHAP &&
            list.every((m) => h.members.has(m)),
        ),
      ).toBe(true);
    }
  });

  it('exactly 4 samhap groups exist', () => {
    expect(SAMHAP_GROUPS.length).toBe(4);
  });

  it('each jiji belongs to exactly one samhap group', () => {
    for (const j of allJiji) {
      const count = SAMHAP_GROUPS.filter((g) => g.has(j)).length;
      expect(count).toBe(1);
    }
  });
});

// =========================================================================
// 4. Cardinality Invariants
// =========================================================================

describe('Cardinality Invariants', () => {
  function detectAllPairs(type: JijiRelationType): Set<string> {
    const detected = new Set<string>();
    for (const a of allJiji) {
      for (const b of allJiji) {
        if (a !== b && hasRelation(type, a, b)) {
          detected.add(pairKey(a, b));
        }
      }
    }
    return detected;
  }

  it('exactly 6 yukhap pairs exist', () => {
    const detected = detectAllPairs(JijiRelationType.YUKHAP);
    expect(detected).toEqual(YUKHAP_CANONICAL);
  });

  it('exactly 6 chung pairs exist', () => {
    const detected = detectAllPairs(JijiRelationType.CHUNG);
    expect(detected).toEqual(CHUNG_CANONICAL);
  });

  it('exactly 6 pa pairs exist', () => {
    const detected = detectAllPairs(JijiRelationType.PA);
    expect(detected).toEqual(PA_CANONICAL);
  });

  it('exactly 6 hae pairs exist', () => {
    const detected = detectAllPairs(JijiRelationType.HAE);
    expect(detected).toEqual(HAE_CANONICAL);
  });

  it('exactly 6 wonjin pairs exist', () => {
    const detected = detectAllPairs(JijiRelationType.WONJIN);
    expect(detected).toEqual(WONJIN_CANONICAL);
  });

  it('exactly 7 hyeong pairs exist (excluding self-punishment)', () => {
    const detected = detectAllPairs(JijiRelationType.HYEONG);
    expect(detected).toEqual(HYEONG_PAIRS_CANONICAL);
  });

  it('each jiji participates in exactly one yukhap pair', () => {
    for (const j of allJiji) {
      const count = [...YUKHAP_CANONICAL].filter((key) => {
        const parts = key.split('|');
        return parts[0] === j || parts[1] === j;
      }).length;
      expect(count).toBe(1);
    }
  });

  it('each jiji participates in exactly one chung pair', () => {
    for (const j of allJiji) {
      const count = [...CHUNG_CANONICAL].filter((key) => {
        const parts = key.split('|');
        return parts[0] === j || parts[1] === j;
      }).length;
      expect(count).toBe(1);
    }
  });

  it('chung pairs are diametrically opposite on 12-branch circle', () => {
    for (const key of CHUNG_CANONICAL) {
      const [a, b] = key.split('|') as [Jiji, Jiji];
      const diff = Math.abs(JIJI_VALUES.indexOf(a) - JIJI_VALUES.indexOf(b));
      expect(diff).toBe(6);
    }
  });
});

// =========================================================================
// 5. Self-relation (Reflexive) Properties
// =========================================================================

describe('Self-relation Properties', () => {
  it.each(allJiji)('no self-clash for %s', (j) => {
    expect(hasSelfRelation(JijiRelationType.CHUNG, j)).toBe(false);
  });

  it.each(allJiji)('no self-yukhap for %s', (j) => {
    expect(hasSelfRelation(JijiRelationType.YUKHAP, j)).toBe(false);
  });

  it.each(allJiji)('no self-pa for %s', (j) => {
    expect(hasSelfRelation(JijiRelationType.PA, j)).toBe(false);
  });

  it.each(allJiji)('no self-hae for %s', (j) => {
    expect(hasSelfRelation(JijiRelationType.HAE, j)).toBe(false);
  });

  it.each(allJiji)(
    'self-hyeong for %s matches SELF_HYEONG_BRANCHES',
    (j) => {
      const expected = SELF_HYEONG_BRANCHES.has(j);
      const actual = hasSelfRelation(JijiRelationType.HYEONG, j);
      expect(actual).toBe(expected);
    },
  );
});

// =========================================================================
// 6. Mutual Exclusivity and Overlap Analysis
// =========================================================================

describe('Relation Overlap Properties', () => {
  it('yukhap and chung are mutually exclusive -- no pair has both', () => {
    const overlap = [...YUKHAP_CANONICAL].filter((k) => CHUNG_CANONICAL.has(k));
    expect(overlap.length).toBe(0);
  });

  it('chung and yukhap never co-occur on same pair in analysis', () => {
    for (const a of allJiji) {
      for (const b of allJiji) {
        if (a === b) continue;
        const hasYukhap = hasRelation(JijiRelationType.YUKHAP, a, b);
        const hasChung = hasRelation(JijiRelationType.CHUNG, a, b);
        expect(hasYukhap && hasChung).toBe(false);
      }
    }
  });

  it('in-hae is both yukhap and pa (known overlap)', () => {
    const key = pairKey(Jiji.IN, Jiji.HAE);
    expect(YUKHAP_CANONICAL.has(key)).toBe(true);
    expect(PA_CANONICAL.has(key)).toBe(true);
  });

  it('sa-sin is both yukhap and pa (known overlap)', () => {
    const key = pairKey(Jiji.SA, Jiji.SIN);
    expect(YUKHAP_CANONICAL.has(key)).toBe(true);
    expect(PA_CANONICAL.has(key)).toBe(true);
  });

  it('hae and wonjin share exactly 2 pairs (ja-mi, chuk-o)', () => {
    const overlap = [...HAE_CANONICAL].filter((k) => WONJIN_CANONICAL.has(k));
    const expected = new Set([pairKey(Jiji.JA, Jiji.MI), pairKey(Jiji.CHUK, Jiji.O)]);
    expect(new Set(overlap)).toEqual(expected);
  });
});

// =========================================================================
// 7. Completeness -- every canonical pair is actually detected
// =========================================================================

describe('Completeness Verification', () => {
  function canonicalPairsAsArgs(canonical: ReadonlySet<string>): Array<[Jiji, Jiji]> {
    return [...canonical].map((key) => {
      const [a, b] = key.split('|') as [Jiji, Jiji];
      return [a, b];
    });
  }

  it.each(canonicalPairsAsArgs(YUKHAP_CANONICAL))(
    'yukhap detected: %s + %s',
    (a, b) => {
      expect(hasRelation(JijiRelationType.YUKHAP, a, b)).toBe(true);
    },
  );

  it.each(canonicalPairsAsArgs(CHUNG_CANONICAL))(
    'chung detected: %s + %s',
    (a, b) => {
      expect(hasRelation(JijiRelationType.CHUNG, a, b)).toBe(true);
    },
  );

  it.each(canonicalPairsAsArgs(PA_CANONICAL))(
    'pa detected: %s + %s',
    (a, b) => {
      expect(hasRelation(JijiRelationType.PA, a, b)).toBe(true);
    },
  );

  it.each(canonicalPairsAsArgs(HAE_CANONICAL))(
    'hae detected: %s + %s',
    (a, b) => {
      expect(hasRelation(JijiRelationType.HAE, a, b)).toBe(true);
    },
  );
});

// =========================================================================
// 8. Graph Theory Properties
// =========================================================================

describe('Graph Theory Properties', () => {
  function degreeMap(canonical: ReadonlySet<string>): Map<string, number> {
    const degree = new Map<string, number>();
    for (const key of canonical) {
      const [a, b] = key.split('|') as [string, string];
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    return degree;
  }

  it('yukhap is a perfect matching on 12 vertices', () => {
    const degree = degreeMap(YUKHAP_CANONICAL);
    for (const j of allJiji) {
      expect(degree.get(j)).toBe(1);
    }
  });

  it('chung is a perfect matching on 12 vertices', () => {
    const degree = degreeMap(CHUNG_CANONICAL);
    for (const j of allJiji) {
      expect(degree.get(j)).toBe(1);
    }
  });

  it('pa is a perfect matching on 12 vertices', () => {
    const degree = degreeMap(PA_CANONICAL);
    for (const j of allJiji) {
      expect(degree.get(j)).toBe(1);
    }
  });

  it('hae is a perfect matching on 12 vertices', () => {
    const degree = degreeMap(HAE_CANONICAL);
    for (const j of allJiji) {
      expect(degree.get(j)).toBe(1);
    }
  });

  it('wonjin is a perfect matching on 12 vertices', () => {
    const degree = degreeMap(WONJIN_CANONICAL);
    for (const j of allJiji) {
      expect(degree.get(j)).toBe(1);
    }
  });

  it('samhap partitions all 12 branches into 4 groups of 3', () => {
    const allBranches = new Set(SAMHAP_GROUPS.flatMap((g) => [...g]));
    expect(allBranches).toEqual(new Set(allJiji));

    // No overlap: total member count = 12
    const totalMembers = SAMHAP_GROUPS.reduce((sum, g) => sum + g.size, 0);
    expect(totalMembers).toBe(12);
  });
});

// =========================================================================
// 9. Negative Tests -- non-canonical pairs should NOT be detected
// =========================================================================

describe('Negative Tests', () => {
  const pairs = allOrderedPairs().filter(([a, b]) => a !== b);

  describe('non-canonical yukhap not detected', () => {
    const nonCanonical = pairs.filter(
      ([a, b]) => !YUKHAP_CANONICAL.has(pairKey(a, b)),
    );
    it.each(nonCanonical)('no YUKHAP for %s-%s', (a, b) => {
      expect(hasRelation(JijiRelationType.YUKHAP, a, b)).toBe(false);
    });
  });

  describe('non-canonical chung not detected', () => {
    const nonCanonical = pairs.filter(
      ([a, b]) => !CHUNG_CANONICAL.has(pairKey(a, b)),
    );
    it.each(nonCanonical)('no CHUNG for %s-%s', (a, b) => {
      expect(hasRelation(JijiRelationType.CHUNG, a, b)).toBe(false);
    });
  });

  describe('non-canonical pa not detected', () => {
    const nonCanonical = pairs.filter(
      ([a, b]) => !PA_CANONICAL.has(pairKey(a, b)),
    );
    it.each(nonCanonical)('no PA for %s-%s', (a, b) => {
      expect(hasRelation(JijiRelationType.PA, a, b)).toBe(false);
    });
  });

  describe('non-canonical hae not detected', () => {
    const nonCanonical = pairs.filter(
      ([a, b]) => !HAE_CANONICAL.has(pairKey(a, b)),
    );
    it.each(nonCanonical)('no HAE for %s-%s', (a, b) => {
      expect(hasRelation(JijiRelationType.HAE, a, b)).toBe(false);
    });
  });
});
