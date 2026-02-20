import { describe, it, expect } from 'vitest';
import { Jiji } from '../../../src/domain/Jiji.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { ShinsalHit, ShinsalType } from '../../../src/domain/Shinsal.js';
import { CompositeInteractionType } from '../../../src/engine/analysis/ShinsalWeightModel.js';
import {
  COMPOSITE_RULES,
  ShinsalCompositeInterpreter,
} from '../../../src/engine/analysis/ShinsalCompositeInterpreter.js';

/**
 * Ported from ShinsalCompositeInterpreterTest.kt.
 *
 * BLG-H4: ShinsalCompositeInterpreter 전용 단위 테스트.
 * 13개 복합 패턴 전수 테스트 + 근접 보너스 + 에지 케이스.
 */

// ── Helper ────────────────────────────────────────────────

function makeHit(type: ShinsalType, position: PillarPosition): ShinsalHit {
  return {
    type,
    position,
    referenceBranch: Jiji.JA,
    note: `${type} at ${position}`,
  };
}

describe('ShinsalCompositeInterpreter', () => {

  // ── 13개 패턴 전수 테스트 ──────────────────────────────────

  describe('All 13 patterns present', () => {

    it('pattern 01: 역마+도화', () => {
      const hits = [
        makeHit(ShinsalType.YEOKMA, PillarPosition.YEAR),
        makeHit(ShinsalType.DOHWA, PillarPosition.MONTH),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '역마+도화');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.SYNERGY);
      expect(match!.interpretation.length).toBeGreaterThan(0);
      expect(match!.bonusScore).toBe(15); // base 15, no proximity
    });

    it('pattern 02: 도화+화개', () => {
      const hits = [
        makeHit(ShinsalType.DOHWA, PillarPosition.DAY),
        makeHit(ShinsalType.HWAGAE, PillarPosition.HOUR),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '도화+화개');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.SYNERGY);
      expect(match!.interpretation).toContain('예술');
    });

    it('pattern 03: 역마+괴강', () => {
      const hits = [
        makeHit(ShinsalType.YEOKMA, PillarPosition.YEAR),
        makeHit(ShinsalType.GOEGANG, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.some(c => c.patternName === '역마+괴강')).toBe(true);
    });

    it('pattern 04: 양인+천을귀인', () => {
      const hits = [
        makeHit(ShinsalType.YANGIN, PillarPosition.MONTH),
        makeHit(ShinsalType.CHEONUL_GWIIN, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '양인+천을귀인');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.TEMPER);
    });

    it('pattern 05: 역마+천을귀인', () => {
      const hits = [
        makeHit(ShinsalType.YEOKMA, PillarPosition.MONTH),
        makeHit(ShinsalType.CHEONUL_GWIIN, PillarPosition.HOUR),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.some(c => c.patternName === '역마+천을귀인')).toBe(true);
    });

    it('pattern 06: 고신+과숙', () => {
      const hits = [
        makeHit(ShinsalType.GOSIN, PillarPosition.YEAR),
        makeHit(ShinsalType.GWASUK, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '고신+과숙');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.AMPLIFY);
    });

    it('pattern 07: 역마+겁살', () => {
      const hits = [
        makeHit(ShinsalType.YEOKMA, PillarPosition.DAY),
        makeHit(ShinsalType.GEOPSAL, PillarPosition.HOUR),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '역마+겁살');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.AMPLIFY_NEGATIVE);
      expect(match!.bonusScore).toBeLessThan(0); // negative amplification
    });

    it('pattern 08: 도화+홍염', () => {
      const hits = [
        makeHit(ShinsalType.DOHWA, PillarPosition.MONTH),
        makeHit(ShinsalType.HONGYEOM, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.some(c => c.patternName === '도화+홍염')).toBe(true);
    });

    it('pattern 09: 천을귀인+학당', () => {
      const hits = [
        makeHit(ShinsalType.CHEONUL_GWIIN, PillarPosition.YEAR),
        makeHit(ShinsalType.HAKDANG, PillarPosition.MONTH),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.some(c => c.patternName === '천을귀인+학당')).toBe(true);
    });

    it('pattern 10: 화개+문창', () => {
      const hits = [
        makeHit(ShinsalType.HWAGAE, PillarPosition.YEAR),
        makeHit(ShinsalType.MUNCHANG, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.some(c => c.patternName === '화개+문창')).toBe(true);
    });

    it('pattern 11: 양인+백호', () => {
      const hits = [
        makeHit(ShinsalType.YANGIN, PillarPosition.MONTH),
        makeHit(ShinsalType.BAEKHO, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '양인+백호');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.AMPLIFY_NEGATIVE);
    });

    it('pattern 12: 천덕귀인+월덕귀인', () => {
      const hits = [
        makeHit(ShinsalType.CHEONDEOK_GWIIN, PillarPosition.YEAR),
        makeHit(ShinsalType.WOLDEOK_GWIIN, PillarPosition.MONTH),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '천덕귀인+월덕귀인');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.AMPLIFY);
      expect(match!.bonusScore).toBe(20); // highest base score
    });

    it('pattern 13: 원진+도화', () => {
      const hits = [
        makeHit(ShinsalType.WONJIN, PillarPosition.DAY),
        makeHit(ShinsalType.DOHWA, PillarPosition.HOUR),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '원진+도화');
      expect(match).toBeDefined();
      expect(match!.interactionType).toBe(CompositeInteractionType.TRANSFORM);
    });
  });

  // ── 전체 13패턴 메타 검증 ──────────────────────────────────

  describe('Composite rules meta validation', () => {
    it('all rules have non-blank interpretation', () => {
      for (const rule of COMPOSITE_RULES) {
        expect(rule.interpretation.length).toBeGreaterThan(0);
        expect(rule.patternName.length).toBeGreaterThan(0);
      }
    });

    it('all rules are exactly 13', () => {
      expect(COMPOSITE_RULES.length).toBe(13);
    });
  });

  // ── 근접 보너스 (+5) ──────────────────────────────────────

  describe('Proximity bonus tests', () => {
    it('same pillar adds proximity bonus', () => {
      // 두 신살이 같은 기둥 -> +5 보너스
      const hits = [
        makeHit(ShinsalType.YEOKMA, PillarPosition.DAY),
        makeHit(ShinsalType.DOHWA, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '역마+도화');
      expect(match).toBeDefined();
      expect(match!.bonusScore).toBe(20); // base(15) + proximity(5) = 20
    });

    it('different pillar no proximity bonus', () => {
      const hits = [
        makeHit(ShinsalType.YEOKMA, PillarPosition.YEAR),
        makeHit(ShinsalType.DOHWA, PillarPosition.HOUR),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '역마+도화');
      expect(match).toBeDefined();
      expect(match!.bonusScore).toBe(15); // base(15) only, no proximity
    });
  });

  // ── 에지 케이스 ───────────────────────────────────────────

  describe('Edge cases', () => {
    it('empty hits returns empty', () => {
      const composites = ShinsalCompositeInterpreter.detect([]);
      expect(composites.length).toBe(0);
    });

    it('single hit returns empty', () => {
      const hits = [makeHit(ShinsalType.YEOKMA, PillarPosition.DAY)];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(0);
    });

    it('unrelated pair returns empty', () => {
      // 두 신살이 어떤 패턴도 구성하지 않는 조합
      const hits = [
        makeHit(ShinsalType.AMNOK, PillarPosition.YEAR),
        makeHit(ShinsalType.CHEONUI, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(0);
    });

    it('multiple overlapping patterns detected correctly', () => {
      // 도화 + 역마 + 화개 -> "역마+도화" + "도화+화개" 두 패턴 동시 감지
      const hits = [
        makeHit(ShinsalType.YEOKMA, PillarPosition.YEAR),
        makeHit(ShinsalType.DOHWA, PillarPosition.MONTH),
        makeHit(ShinsalType.HWAGAE, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.some(c => c.patternName === '역마+도화')).toBe(true);
      expect(composites.some(c => c.patternName === '도화+화개')).toBe(true);
    });

    it('involved hits contain both shinsal types', () => {
      const hits = [
        makeHit(ShinsalType.YANGIN, PillarPosition.MONTH),
        makeHit(ShinsalType.BAEKHO, PillarPosition.DAY),
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      const match = composites.find(c => c.patternName === '양인+백호');
      expect(match).toBeDefined();
      const types = new Set(match!.involvedHits.map(h => h.type));
      expect(types.has(ShinsalType.YANGIN)).toBe(true);
      expect(types.has(ShinsalType.BAEKHO)).toBe(true);
    });
  });
});
