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
import { createConfig } from '../../../src/config/CalculationConfig.js';

/**
 * Ported from JonggyeokFalsePositivePreventionTest.kt (28 tests)
 *
 * False-positive prevention tests for jonggyeok (following pattern) detection.
 *
 * The GyeokgukDeterminer Phase 2 detects two branches of jonggyeok:
 *
 * ## JONGGANG -- requires ALL of:
 * 1. totalSupport >= jonggyeokStrongThreshold (default 62.4)
 * 2. bigyeop count >= 4 (out of 7 counted stems)
 * 3. jae + gwan == 0 (no outlet/controller)
 *
 * ## Weak jonggyeok (4 subtypes) -- requires ALL of:
 * 1. totalSupport <= jonggyeokWeakThreshold (default 15.0)
 * 2. hasSelfSupport == false (bigyeop == 0 AND inseong == 0)
 * 3. Subtype-specific dominant category conditions
 *
 * Source: jeokcheonsu (tekcheonsu) jonghwaron + myeongnijeongjong oegyeokron
 */

// ── Helper ──────────────────────────────────────────────────────

function strengthWithScore(dayMaster: Cheongan, totalSupport: number): StrengthResult {
  const isStrong = totalSupport >= 50.0;
  return {
    dayMaster,
    level: isStrong ? StrengthLevel.VERY_STRONG : StrengthLevel.VERY_WEAK,
    score: {
      deukryeong: totalSupport * 0.5,
      deukji: totalSupport * 0.25,
      deukse: totalSupport * 0.25,
      totalSupport,
      totalOppose: 100.0 - totalSupport,
    },
    isStrong,
    details: [`false-positive-prevention test: score=${totalSupport}`],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe('JonggyeokFalsePositivePrevention', () => {

  // ── 1. Score just below strong threshold (62.3 < 62.4) ────────

  describe('strong threshold boundary', () => {
    it('score 62.3 just below default strong threshold does NOT produce jonggang', () => {
      // Day master: GAP (Wood). Profile: bigyeop=7, jae=0, gwan=0.
      // Score 62.3 < 62.4 threshold.
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const strength = strengthWithScore(Cheongan.GAP, 62.3);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── 2. Bigyeop insufficient (score 80, bigyeop=3, needs >=4) ──

  describe('bigyeop count requirement', () => {
    it('score 80 but bigyeop only 3 does NOT produce jonggang', () => {
      // Day master: GAP (Wood).
      // Profile: bigyeop=3, inseong=4, jae=0, gwan=0.
      // bigyeop(3) < 4 required.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.HAE),
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.EUL, Jiji.HAE),
      );

      const strength = strengthWithScore(Cheongan.GAP, 80.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGGANG);
    });
  });

  // ── 3. Jae/gwan present blocks jonggang ────────────────────────

  describe('jae/gwan presence blocks jonggang', () => {
    it('score 80 and bigyeop 5 but jae present does NOT produce jonggang', () => {
      // Day master: GAP (Wood). Jae = Earth.
      // Profile: bigyeop=6, jae=1 (from JIN branch), gwan=0.
      // jae+gwan=1 != 0 -- blocked.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.GAP, Jiji.IN),
      );

      const strength = strengthWithScore(Cheongan.GAP, 80.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGGANG);
    });

    it('score 80 and bigyeop 5 but gwan present does NOT produce jonggang', () => {
      // Day master: GAP (Wood). Gwan = Metal.
      // Profile: bigyeop=6, gwan=1 (from YU branch).
      // jae+gwan=1 != 0 -- blocked.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.YU),
        new Pillar(Cheongan.GAP, Jiji.IN),
      );

      const strength = strengthWithScore(Cheongan.GAP, 80.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGGANG);
    });
  });

  // ── 4. Self-support blocks weak jonggyeok ──────────────────────

  describe('self-support blocks weak jonggyeok', () => {
    it('weak score but bigyeop self-support present blocks all jongyak subtypes', () => {
      // Day master: IM (Water). Score 5.0.
      // Profile: bigyeop=1 (HAE branch -> IM), siksang=2, jae=2, gwan=2.
      // hasSelfSupport = true.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.IM, Jiji.HAE),
        new Pillar(Cheongan.MU, Jiji.JIN),
      );

      const strength = strengthWithScore(Cheongan.IM, 5.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('weak score but inseong self-support present blocks all jongyak subtypes', () => {
      // Day master: IM (Water). Inseong = Metal.
      // Profile: inseong=1 (YU branch -> SIN), siksang=2, jae=2, gwan=2.
      // hasSelfSupport = true.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.IM, Jiji.YU),
        new Pillar(Cheongan.MU, Jiji.JIN),
      );

      const strength = strengthWithScore(Cheongan.IM, 5.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── 5. Tied opposition: siksang=3, gwan=3 --> jongse, not jonga ─

  describe('tied opposition fallthrough', () => {
    it('siksang tied with gwan at 3 produces jongse not jonga', () => {
      // Day master: IM (Water). Siksang=Wood, Gwan=Earth.
      // Profile: siksang=3, gwan=3, jae=1. Tied => not jonga.
      // total=7 >= 5 -> JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.IM, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
      );

      const strength = strengthWithScore(Cheongan.IM, 4.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGA);
      expect(result.type).toBe(GyeokgukType.JONGSE);
    });

    // ── 6. Tied opposition: jae=3, siksang=3 --> jongse, not jongjae ─

    it('jae tied with siksang at 3 produces jongse not jongjae', () => {
      // Day master: IM (Water). Jae=Fire, Siksang=Wood.
      // Profile: siksang=3, jae=3, gwan=1. Tied => not jongjae.
      // total=7 >= 5 -> JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.MYO),
        new Pillar(Cheongan.MU, Jiji.O),
      );

      const strength = strengthWithScore(Cheongan.IM, 3.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGJAE);
      expect(result.type).toBe(GyeokgukType.JONGSE);
    });
  });

  // ── 7. Score just above weak threshold (15.1 > 15.0) ───────────

  describe('weak threshold boundary', () => {
    it('score 15.1 just above default weak threshold does NOT produce any jongyak subtype', () => {
      // Day master: IM (Water). Profile: jae=7.
      // Score 15.1 > 15.0 threshold.
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const strength = strengthWithScore(Cheongan.IM, 15.1);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── 8. Score exactly at strong threshold (62.4) IS jonggang ────

  describe('exact threshold inclusion', () => {
    it('score exactly 62.4 at default strong threshold with qualifying profile IS jonggang', () => {
      // Day master: GAP (Wood). Profile: bigyeop=7, jae=0, gwan=0.
      // Score 62.4 >= 62.4 (threshold uses >=).
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const strength = strengthWithScore(Cheongan.GAP, 62.4);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGGANG);
      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
    });

    // ── 9. Score exactly at weak threshold (15.0) IS jongyak ──────

    it('score exactly 15.0 at default weak threshold with qualifying profile IS jongyak', () => {
      // Day master: IM (Water). Profile: jae=7.
      // Score 15.0 <= 15.0 (threshold uses <=).
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const strength = strengthWithScore(Cheongan.IM, 15.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
      expect(result.type).toBe(GyeokgukType.JONGJAE);
    });
  });

  // ── 10. Custom config thresholds alter boundaries ──────────────

  describe('custom config thresholds', () => {
    it('custom strong threshold 70 blocks jonggang at score 69.9', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const config = createConfig({
        jonggyeokStrongThreshold: 70.0,
        jonggyeokWeakThreshold: 15.0,
      });
      const strength = strengthWithScore(Cheongan.GAP, 69.9);
      const result = GyeokgukDeterminer.determine(pillars, strength, [], config);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('custom strong threshold 70 allows jonggang at score 70.0', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const config = createConfig({
        jonggyeokStrongThreshold: 70.0,
        jonggyeokWeakThreshold: 15.0,
      });
      const strength = strengthWithScore(Cheongan.GAP, 70.0);
      const result = GyeokgukDeterminer.determine(pillars, strength, [], config);

      expect(result.type).toBe(GyeokgukType.JONGGANG);
    });

    it('custom weak threshold 20 blocks jongyak at score 20.1', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const config = createConfig({
        jonggyeokStrongThreshold: 62.4,
        jonggyeokWeakThreshold: 20.0,
      });
      const strength = strengthWithScore(Cheongan.IM, 20.1);
      const result = GyeokgukDeterminer.determine(pillars, strength, [], config);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });

    it('custom weak threshold 20 allows jongyak at score 20.0', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const config = createConfig({
        jonggyeokStrongThreshold: 62.4,
        jonggyeokWeakThreshold: 20.0,
      });
      const strength = strengthWithScore(Cheongan.IM, 20.0);
      const result = GyeokgukDeterminer.determine(pillars, strength, [], config);

      expect(result.category).toBe(GyeokgukCategory.JONGGYEOK);
      expect(result.type).toBe(GyeokgukType.JONGJAE);
    });
  });

  // ── 11. Dead zone: score between thresholds never produces jonggyeok ──

  describe('dead zone', () => {
    it('score in dead zone between thresholds never produces jonggyeok', () => {
      const strongPillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const deadZoneScores = [15.1, 20.0, 30.0, 40.0, 50.0, 60.0, 62.3];

      for (const score of deadZoneScores) {
        const result = GyeokgukDeterminer.determine(
          strongPillars,
          strengthWithScore(Cheongan.GAP, score),
        );

        expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
      }
    });
  });

  // ── 12. Jongsal false positive -- gwan dominant but siksang/jae present ──

  describe('jongsal false positive prevention', () => {
    it('gwan dominant but siksang present blocks jongsal, falls to jongse', () => {
      // Day master: IM (Water). Gwan=Earth, Siksang=Wood.
      // Profile: gwan=5, siksang=2. Jongsal requires siksang==0.
      // total=7 >= 5 -> JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.SUL),
        new Pillar(Cheongan.GI, Jiji.CHUK),
      );

      const strength = strengthWithScore(Cheongan.IM, 2.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGSAL);
      expect(result.type).toBe(GyeokgukType.JONGSE);
    });

    it('gwan dominant but jae present blocks jongsal, falls to jongse', () => {
      // Day master: IM (Water). Gwan=Earth, Jae=Fire.
      // Profile: gwan=5, jae=2. Jongsal requires jae==0.
      // total=7 >= 5 -> JONGSE.
      const pillars = new PillarSet(
        new Pillar(Cheongan.MU, Jiji.JIN),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.IM, Jiji.SUL),
        new Pillar(Cheongan.GI, Jiji.CHUK),
      );

      const strength = strengthWithScore(Cheongan.IM, 2.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).not.toBe(GyeokgukType.JONGSAL);
      expect(result.type).toBe(GyeokgukType.JONGSE);
    });
  });

  // ── 13. Null strength result skips Phase 2 entirely ────────────

  describe('null strength handling', () => {
    it('null strength result skips jonggyeok phase entirely', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const result = GyeokgukDeterminer.determine(pillars, null);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── 14. Jongse requires opposing total >= 5 ────────────────────

  describe('jongse opposing total requirement', () => {
    it('opposing total below 5 cannot produce jongse even without self-support', () => {
      // Day master: IM (Water). Profile: bigyeop=2, inseong=2, jae=3.
      // hasSelfSupport = true -> no weak jonggyeok.
      // opposing total = 3 < 5 would also block jongse.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GYE, Jiji.JA),
        new Pillar(Cheongan.GYEONG, Jiji.YU),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const strength = strengthWithScore(Cheongan.IM, 5.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── 15. Confidence values for boundary-exact jonggyeok results ─

  describe('confidence at boundary', () => {
    it('jonggang at exact threshold has base confidence 0.85', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const strength = strengthWithScore(Cheongan.GAP, 62.4);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGGANG);
      expect(result.confidence).toBeCloseTo(0.85, 2);
    });

    it('jongyak at exact threshold has base confidence 0.75', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const strength = strengthWithScore(Cheongan.IM, 15.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGJAE);
      expect(result.confidence).toBeCloseTo(0.75, 2);
    });

    it('jonggang confidence increases with distance from threshold', () => {
      // Score = 81.0, distance = 18.6, confidence = 0.85 + (18.6/18.6)*0.10 = 0.95
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const strength = strengthWithScore(Cheongan.GAP, 81.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGGANG);
      expect(result.confidence).toBeCloseTo(0.95, 2);
    });

    it('jongyak confidence increases with distance from threshold', () => {
      // Score = 0.0, distance = 15.0, confidence = 0.75 + (15.0/15.0)*0.15 = 0.90
      const pillars = new PillarSet(
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.JEONG, Jiji.O),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.O),
      );

      const strength = strengthWithScore(Cheongan.IM, 0.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGJAE);
      expect(result.confidence).toBeCloseTo(0.90, 2);
    });
  });

  // ── 16. Reasoning traceability ─────────────────────────────────

  describe('reasoning traceability', () => {
    it('jonggang reasoning contains expected trace keywords', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.EUL, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.MYO),
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
      );

      const strength = strengthWithScore(Cheongan.GAP, 70.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGGANG);
      expect(result.reasoning).toContain('극신강');
      expect(result.reasoning).toContain('종강격');
      expect(result.reasoning).toContain('총부조점수');
    });

    it('jongyak reasoning contains expected trace keywords for all 4 subtypes', () => {
      const cases: { name: string; pillars: PillarSet; expectedType: GyeokgukType; expectedKeyword: string }[] = [
        // jongsal: gwan dominant
        {
          name: 'jongsal',
          pillars: new PillarSet(
            new Pillar(Cheongan.MU, Jiji.JIN),
            new Pillar(Cheongan.MU, Jiji.SUL),
            new Pillar(Cheongan.IM, Jiji.JIN),
            new Pillar(Cheongan.GI, Jiji.CHUK),
          ),
          expectedType: GyeokgukType.JONGSAL,
          expectedKeyword: '관살',
        },
        // jonga: siksang dominant
        {
          name: 'jonga',
          pillars: new PillarSet(
            new Pillar(Cheongan.GAP, Jiji.IN),
            new Pillar(Cheongan.EUL, Jiji.MYO),
            new Pillar(Cheongan.IM, Jiji.SA),
            new Pillar(Cheongan.BYEONG, Jiji.MYO),
          ),
          expectedType: GyeokgukType.JONGA,
          expectedKeyword: '식상',
        },
        // jongjae: jae dominant
        {
          name: 'jongjae',
          pillars: new PillarSet(
            new Pillar(Cheongan.BYEONG, Jiji.SA),
            new Pillar(Cheongan.JEONG, Jiji.O),
            new Pillar(Cheongan.IM, Jiji.SA),
            new Pillar(Cheongan.BYEONG, Jiji.O),
          ),
          expectedType: GyeokgukType.JONGJAE,
          expectedKeyword: '재성',
        },
        // jongse: balanced
        {
          name: 'jongse',
          pillars: new PillarSet(
            new Pillar(Cheongan.MU, Jiji.JIN),
            new Pillar(Cheongan.GAP, Jiji.MYO),
            new Pillar(Cheongan.IM, Jiji.SA),
            new Pillar(Cheongan.BYEONG, Jiji.JIN),
          ),
          expectedType: GyeokgukType.JONGSE,
          expectedKeyword: '식상/재성/관성',
        },
      ];

      for (const c of cases) {
        const strength = strengthWithScore(c.pillars.day.cheongan, 3.0);
        const result = GyeokgukDeterminer.determine(c.pillars, strength);

        expect(result.type).toBe(c.expectedType);
        expect(result.reasoning).toContain(c.expectedKeyword);
        expect(result.reasoning).toContain('총부조점수');
      }
    });
  });

  // ── 17. Multiple conditions violated simultaneously ────────────

  describe('multiple violations', () => {
    it('multiple jonggang conditions violated simultaneously -- definitely not jonggyeok', () => {
      // Day master: GAP (Wood).
      // Score = 50 (dead zone), bigyeop = 2 (< 4), jae+gwan > 0.
      // Triply blocked.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.BYEONG, Jiji.SA),
        new Pillar(Cheongan.GAP, Jiji.YU),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );

      const strength = strengthWithScore(Cheongan.GAP, 50.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.category).not.toBe(GyeokgukCategory.JONGGYEOK);
    });
  });

  // ── 18. Jonga priority over jongjae when siksang > jae ─────────

  describe('jonga priority', () => {
    it('jonga selected over jongjae when siksang strictly greater than jae', () => {
      // Day master: IM (Water). Siksang=Wood, Jae=Fire.
      // Profile: siksang=5, jae=2.
      // siksang(5) > jae(2) -> JONGA.
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.IN),
        new Pillar(Cheongan.EUL, Jiji.MYO),
        new Pillar(Cheongan.IM, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.MYO),
      );

      const strength = strengthWithScore(Cheongan.IM, 5.0);
      const result = GyeokgukDeterminer.determine(pillars, strength);

      expect(result.type).toBe(GyeokgukType.JONGA);
      expect(result.type).not.toBe(GyeokgukType.JONGJAE);
    });
  });
});
