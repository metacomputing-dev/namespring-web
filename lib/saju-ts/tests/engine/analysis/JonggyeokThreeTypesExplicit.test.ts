import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { StrengthLevel } from '../../../src/domain/StrengthResult.js';
import type { StrengthResult } from '../../../src/domain/StrengthResult.js';
import {
  GyeokgukType,
  GyeokgukCategory,
} from '../../../src/domain/Gyeokguk.js';
import { GyeokgukDeterminer } from '../../../src/engine/analysis/GyeokgukDeterminer.js';

/**
 * Ported from JonggyeokThreeTypesExplicitTest.kt (21 tests)
 *
 * Comprehensive test suite for 3 jonggyeok subtypes: JONGA, JONGJAE, JONGSE.
 *
 * Each jonggyeok subtype requires:
 * 1. Extreme weakness (totalSupport <= 15.0 by default)
 * 2. Absence of self-support (bigyeop == 0 AND inseong == 0)
 * 3. Dominant category >= 3 elements
 * 4. For JONGA/JONGJAE: strict > comparison with other categories
 * 5. For JONGSE: total opposing forces >= 5, no single dominance
 *
 * Source: jeokcheonsu jonghwaron + myeongnijeongjong oegyeokron
 */

// ── Helper ──────────────────────────────────────────────────────

function createVeryWeakStrength(dayMaster: Cheongan, score: number = 5.0): StrengthResult {
  return {
    dayMaster,
    level: StrengthLevel.VERY_WEAK,
    score: {
      deukryeong: score * 0.5,
      deukji: score * 0.25,
      deukse: score * 0.25,
      totalSupport: score,
      totalOppose: 100.0 - score,
    },
    isStrong: false,
    details: [`weak jonggyeok test: score=${score}`],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe('JonggyeokThreeTypesExplicit', () => {

  // ── JONGA (siksang dominant) ───────────────────────────────────

  describe('JONGA detection', () => {
    it('minimal JONGA case - siksang=5, gwan and jae below siksang', () => {
      // Day master: IM (Water). Siksang = Wood.
      // Profile: siksang=5, jae=2, gwan=0, bigyeop=0, inseong=0.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.MYO),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 5.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGA);
      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning).toContain('식상');
    });

    it('JONGA requires siksang strictly greater than both gwan and jae', () => {
      // Day master: IM (Water). Siksang = Wood.
      // Profile: siksang=6, jae=1, gwan=0.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.SA),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 3.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGA);
    });

    it('JONGA rejected when siksang and gwan are equal', () => {
      // Day master: IM (Water). Siksang=Wood, Gwan=Earth.
      // Profile: siksang=3, gwan=3, jae=1 -- tied, falls through to JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 4.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGSE);
    });

    it('JONGA blocked when chart contains bigyeop self-support', () => {
      // Day master: IM (Water). Year stem IM = bigyeop -> hasSelfSupport = true.
      // Profile: siksang=6, bigyeop=1.
      const pillars = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 5.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('JONGA blocked when chart contains inseong self-support', () => {
      // Day master: IM (Water). Year stem SIN = Metal = inseong -> hasSelfSupport = true.
      // Profile: siksang=6, inseong=1.
      const pillars = new PillarSet(
        new Pillar(Cheongan.SIN, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 5.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── JONGJAE (jae dominant) ─────────────────────────────────────

  describe('JONGJAE detection', () => {
    it('minimal JONGJAE case - jae=7, gwan and siksang at 0', () => {
      // Day master: IM (Water). Jae = Fire.
      // Profile: jae=7, siksang=0, gwan=0.
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 6.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGJAE);
      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
      expect(result.reasoning).toBeDefined();
    });

    it('JONGJAE requires jae strictly greater than both gwan and siksang', () => {
      // Day master: IM (Water). Jae = Fire.
      // Profile: jae=7, siksang=0, gwan=0.
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 7.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGJAE);
    });

    it('JONGJAE rejected when jae and siksang are equal', () => {
      // Day master: IM (Water). Jae=Fire, Siksang=Wood.
      // Profile: jae=3, siksang=3, gwan=1 -- tied, falls to JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.MU, Jiji.O),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 8.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGSE);
    });

    it('JONGJAE blocked when chart contains bigyeop self-support', () => {
      // Day master: IM (Water). Year stem IM = bigyeop -> hasSelfSupport = true.
      const pillars = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 6.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('JONGJAE blocked when chart contains inseong self-support', () => {
      // Day master: IM (Water). Year stem SIN = Metal = inseong -> hasSelfSupport = true.
      const pillars = new PillarSet(
        new Pillar(Cheongan.SIN, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 6.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── JONGSE (balanced opposition) ───────────────────────────────

  describe('JONGSE detection', () => {
    it('minimal JONGSE case - opposing total=7 with no single dominance', () => {
      // Day master: IM (Water). Siksang=Wood, Jae=Fire, Gwan=Earth.
      // Profile: siksang=2, jae=2, gwan=3 -- no single category qualifies for jongsal/jonga/jongjae.
      // total = 7 >= 5 -> JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 9.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGSE);
      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
      expect(result.reasoning).toBeDefined();
    });

    it('JONGSE with higher opposing total shows balanced opposition', () => {
      // Day master: IM (Water).
      // Profile: siksang=2, jae=2, gwan=3. total=7 >= 5 -> JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.SUL),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 10.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGSE);
    });

    it('JONGSE rejected when opposing total is below 5 (self-support present)', () => {
      // With 7 counted stems and bigyeop+inseong=0, opposing total would be 7.
      // So opposing < 5 necessarily means self-support > 0, blocking weak jonggyeok.
      const pillars = new PillarSet(
        new Pillar(Cheongan.IM, Jiji.HAE),
        new Pillar(Cheongan.GYE, Jiji.JA),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 8.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('JONGSE rejected when siksang reaches 3 - promotes to JONGA', () => {
      // Day master: IM (Water). Siksang = Wood.
      // Profile: siksang=5, jae=2 -- siksang >= 3 AND siksang > gwan AND > jae -> JONGA.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.MYO),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 11.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGA);
    });

    it('JONGSE rejected when jae reaches 3 - promotes to JONGJAE', () => {
      // Day master: IM (Water). Jae = Fire.
      // Profile: jae=7 -- jae >= 3 AND jae > gwan AND > siksang -> JONGJAE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 12.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGJAE);
    });

    it('JONGSE blocked when chart contains bigyeop self-support', () => {
      // Day master: IM (Water). Year stem GYE = Water = bigyeop.
      // hasSelfSupport = true -> no jonggyeok.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYE, Jiji.MYO),
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 9.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('JONGSE blocked when chart contains inseong self-support', () => {
      // Day master: IM (Water). Year stem GYEONG = Metal = inseong.
      // hasSelfSupport = true -> no jonggyeok.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYEONG, Jiji.MYO),
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.JIN),
      );

      const strength = createVeryWeakStrength(Cheongan.IM, 9.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── Negative tests -- balanced/strong charts ───────────────────

  describe('negative tests - non-jonggyeok charts', () => {
    it('balanced strength chart should not be jonggyeok', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.EUL, Jiji.IN),
      );

      const strength: StrengthResult = {
        dayMaster: Cheongan.GAP,
        level: StrengthLevel.SLIGHTLY_STRONG,
        score: {
          deukryeong: 25.0,
          deukji: 12.5,
          deukse: 12.5,
          totalSupport: 50.0,
          totalOppose: 50.0,
        },
        isStrong: true,
        details: ['balanced'],
      };

      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('strong day master should not produce weak jonggyeok types', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.BYEONG, Jiji.MI),
        new Pillar(Cheongan.JEONG, Jiji.SA),
      );

      const strength: StrengthResult = {
        dayMaster: Cheongan.BYEONG,
        level: StrengthLevel.STRONG,
        score: {
          deukryeong: 30.0,
          deukji: 10.0,
          deukse: 10.0,
          totalSupport: 50.0,
          totalOppose: 50.0,
        },
        isStrong: true,
        details: ['strong'],
      };

      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGA);
      expect(result.type).not.toBe(GyeokgukType.JONGJAE);
      expect(result.type).not.toBe(GyeokgukType.JONGSE);
    });

    it('chart without strength info defaults to naegyeok', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.JIN),
        new Pillar(Cheongan.MU, Jiji.SUL),
      );

      const result = GyeokgukDeterminer.determine(pillars, null);

      expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    });
  });

  // ── Comprehensive: all three types distinctly detectable ───────

  describe('all three jonggyeok types detectable', () => {
    it('all three jonggyeok types are distinctly detectable', () => {
      const cases: { name: string; pillars: PillarSet; dayMaster: Cheongan; expectedType: GyeokgukType }[] = [
        // JONGA: day master IM, siksang=5(Wood), jae=2(Fire)
        {
          name: 'JONGA',
          pillars: new PillarSet(
            new Pillar(Cheongan.GAP, Jiji.IN),
            new Pillar(Cheongan.EUL, Jiji.MYO),
            new Pillar(Cheongan.IM, Jiji.SA),
            new Pillar(Cheongan.BYEONG, Jiji.MYO),
          ),
          dayMaster: Cheongan.IM,
          expectedType: GyeokgukType.JONGA,
        },
        // JONGJAE: day master IM, jae=7(Fire)
        {
          name: 'JONGJAE',
          pillars: new PillarSet(
            new Pillar(Cheongan.BYEONG, Jiji.SA),
            new Pillar(Cheongan.JEONG, Jiji.O),
            new Pillar(Cheongan.IM, Jiji.SA),
            new Pillar(Cheongan.BYEONG, Jiji.O),
          ),
          dayMaster: Cheongan.IM,
          expectedType: GyeokgukType.JONGJAE,
        },
        // JONGSE: day master IM, siksang=2, jae=2, gwan=3
        {
          name: 'JONGSE',
          pillars: new PillarSet(
            new Pillar(Cheongan.MU, Jiji.JIN),
            new Pillar(Cheongan.GAP, Jiji.MYO),
            new Pillar(Cheongan.IM, Jiji.SA),
            new Pillar(Cheongan.BYEONG, Jiji.JIN),
          ),
          dayMaster: Cheongan.IM,
          expectedType: GyeokgukType.JONGSE,
        },
      ];

      for (const c of cases) {
        const strength = createVeryWeakStrength(c.dayMaster, 8.0);
        const result = GyeokgukDeterminer.determine(c.pillars, strength);

        expect(result.type).toBe(c.expectedType);
        expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
        expect(result.reasoning).toBeDefined();
        expect(result.reasoning.length).toBeGreaterThan(0);
      }
    });
  });
});
