import { describe, it, expect } from 'vitest';
import { Jiji } from '../../../src/domain/Jiji.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { ShinsalHit, ShinsalType } from '../../../src/domain/Shinsal.js';
import {
  CompositeInteractionType,
  ShinsalWeightCalculator,
} from '../../../src/engine/analysis/ShinsalWeightModel.js';
import {
  COMPOSITE_RULES,
  ShinsalCompositeInterpreter,
} from '../../../src/engine/analysis/ShinsalCompositeInterpreter.js';

/**
 * Ported from ShinsalWeightModelTest.kt.
 *
 * 신살 가중치 모델 테스트: 기본 가중치 테이블 완전성, 기둥 위치 배율,
 * 복합 패턴 감지, 정렬 순서, 등급 범위를 검증합니다.
 */

// ── Helper to get all ShinsalType values ──────────────────────
const ALL_SHINSAL_TYPES: ShinsalType[] = Object.values(ShinsalType) as ShinsalType[];

describe('ShinsalWeightModel', () => {

  // ═══════════════════════════════════════════════════════════
  // 1. 기본 가중치 테이블 완전성
  // ═══════════════════════════════════════════════════════════

  describe('1. 기본 가중치 테이블 완전성', () => {
    it('all shinsal types have base weight in 1..100', () => {
      for (const type of ALL_SHINSAL_TYPES) {
        const weight = ShinsalWeightCalculator.baseWeightFor(type);
        expect(weight).toBeGreaterThanOrEqual(1);
        expect(weight).toBeLessThanOrEqual(100);
      }
    });

    it('S-tier weights are in range 90-100', () => {
      const sTier: ShinsalType[] = [
        ShinsalType.CHEONUL_GWIIN,
        ShinsalType.CHEONDEOK_GWIIN,
        ShinsalType.WOLDEOK_GWIIN,
      ];
      for (const type of sTier) {
        const weight = ShinsalWeightCalculator.baseWeightFor(type);
        expect(weight).toBeGreaterThanOrEqual(90);
        expect(weight).toBeLessThanOrEqual(100);
      }
    });

    it('A-tier weights are in range 70-85', () => {
      const aTier: ShinsalType[] = [
        ShinsalType.YEOKMA, ShinsalType.DOHWA, ShinsalType.HWAGAE,
        ShinsalType.YANGIN, ShinsalType.GOEGANG, ShinsalType.TAEGUK_GWIIN,
        ShinsalType.JANGSEONG, ShinsalType.WONJIN,
      ];
      for (const type of aTier) {
        const weight = ShinsalWeightCalculator.baseWeightFor(type);
        expect(weight).toBeGreaterThanOrEqual(70);
        expect(weight).toBeLessThanOrEqual(85);
      }
    });

    it('B-tier weights are in range 45-65', () => {
      const bTier: ShinsalType[] = [
        ShinsalType.MUNCHANG, ShinsalType.HAKDANG, ShinsalType.GEUMYEO,
        ShinsalType.GEOPSAL, ShinsalType.GOSIN, ShinsalType.GWASUK,
        ShinsalType.CHEONDEOK_HAP, ShinsalType.WOLDEOK_HAP,
        ShinsalType.CHEONGWAN_GWIIN, ShinsalType.BOKSEONG_GWIIN,
        ShinsalType.MUNGOK_GWIIN, ShinsalType.GUGIN_GWIIN, ShinsalType.HONGYEOM,
      ];
      for (const type of bTier) {
        const weight = ShinsalWeightCalculator.baseWeightFor(type);
        expect(weight).toBeGreaterThanOrEqual(45);
        expect(weight).toBeLessThanOrEqual(65);
      }
    });

    it('C-tier weights are in range 20-40', () => {
      const cTier: ShinsalType[] = [
        ShinsalType.BAEKHO, ShinsalType.AMNOK, ShinsalType.CHEONUI,
        ShinsalType.CHEOLLA_JIMANG, ShinsalType.JAESAL, ShinsalType.GYEOKGAK,
        ShinsalType.CHEONBOK_GWIIN, ShinsalType.YUKHAESAL,
        ShinsalType.HYEOLINSAL, ShinsalType.GWANBUSAL, ShinsalType.SANGMUNSAL,
        ShinsalType.CHEONSAL, ShinsalType.JISAL, ShinsalType.MANGSINSAL,
        ShinsalType.BANANSAL, ShinsalType.CHEONJU_GWIIN, ShinsalType.GORANSAL,
      ];
      for (const type of cTier) {
        const weight = ShinsalWeightCalculator.baseWeightFor(type);
        expect(weight).toBeGreaterThanOrEqual(20);
        expect(weight).toBeLessThanOrEqual(40);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 기둥 위치 배율
  // ═══════════════════════════════════════════════════════════

  describe('2. 기둥 위치 배율', () => {
    it('position multipliers match expected values', () => {
      expect(ShinsalWeightCalculator.positionMultiplierFor(PillarPosition.DAY)).toBe(1.0);
      expect(ShinsalWeightCalculator.positionMultiplierFor(PillarPosition.MONTH)).toBe(0.85);
      expect(ShinsalWeightCalculator.positionMultiplierFor(PillarPosition.YEAR)).toBe(0.7);
      expect(ShinsalWeightCalculator.positionMultiplierFor(PillarPosition.HOUR)).toBe(0.6);
    });

    it('day position gives highest score', () => {
      const h: ShinsalHit = { type: ShinsalType.YEOKMA, position: PillarPosition.DAY, referenceBranch: Jiji.IN, note: '' };
      const weighted = ShinsalWeightCalculator.weight(h);
      expect(weighted.weightedScore).toBe(85); // 85 * 1.0 = 85
    });

    it('hour position gives lowest score', () => {
      const h: ShinsalHit = { type: ShinsalType.YEOKMA, position: PillarPosition.HOUR, referenceBranch: Jiji.IN, note: '' };
      const weighted = ShinsalWeightCalculator.weight(h);
      expect(weighted.weightedScore).toBe(51); // 85 * 0.6 = 51
    });

    it('weighted score calculation: cheonul gwiin at month', () => {
      // 천을귀인(95) at 월주(0.85) = round(80.75) = 81
      const h: ShinsalHit = { type: ShinsalType.CHEONUL_GWIIN, position: PillarPosition.MONTH, referenceBranch: Jiji.CHUK, note: '' };
      const weighted = ShinsalWeightCalculator.weight(h);
      expect(weighted.baseWeight).toBe(95);
      expect(weighted.positionMultiplier).toBe(0.85);
      expect(weighted.weightedScore).toBe(81);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. weightAll 정렬
  // ═══════════════════════════════════════════════════════════

  describe('3. weightAll 정렬', () => {
    it('weightAll sorts by descending score', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.GYEOKGAK, position: PillarPosition.HOUR, referenceBranch: Jiji.JA, note: '' },       // 20 * 0.6 = 12
        { type: ShinsalType.CHEONUL_GWIIN, position: PillarPosition.DAY, referenceBranch: Jiji.CHUK, note: '' },  // 95 * 1.0 = 95
        { type: ShinsalType.YEOKMA, position: PillarPosition.MONTH, referenceBranch: Jiji.IN, note: '' },         // 85 * 0.85 = 72
      ];
      const weighted = ShinsalWeightCalculator.weightAll(hits);
      expect(weighted.length).toBe(3);
      expect(weighted[0]!.weightedScore).toBeGreaterThanOrEqual(weighted[1]!.weightedScore);
      expect(weighted[1]!.weightedScore).toBeGreaterThanOrEqual(weighted[2]!.weightedScore);
      expect(weighted[0]!.hit.type).toBe(ShinsalType.CHEONUL_GWIIN);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 복합 패턴 감지
  // ═══════════════════════════════════════════════════════════

  describe('4. 복합 패턴 감지', () => {
    it('detects yeokma + dohwa synergy', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.YEOKMA, position: PillarPosition.DAY, referenceBranch: Jiji.SIN, note: '' },
        { type: ShinsalType.DOHWA, position: PillarPosition.MONTH, referenceBranch: Jiji.MYO, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(1);
      expect(composites[0]!.patternName).toBe('역마+도화');
      expect(composites[0]!.interactionType).toBe(CompositeInteractionType.SYNERGY);
      expect(composites[0]!.bonusScore).toBe(15); // no same-pillar bonus
      expect(composites[0]!.interpretation).toContain('해외');
    });

    it('detects gosin + gwasuk amplify', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.GOSIN, position: PillarPosition.YEAR, referenceBranch: Jiji.SA, note: '' },
        { type: ShinsalType.GWASUK, position: PillarPosition.HOUR, referenceBranch: Jiji.CHUK, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(1);
      expect(composites[0]!.patternName).toBe('고신+과숙');
      expect(composites[0]!.interactionType).toBe(CompositeInteractionType.AMPLIFY);
    });

    it('detects yangin + baekho negative amplify', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.YANGIN, position: PillarPosition.DAY, referenceBranch: Jiji.MYO, note: '' },
        { type: ShinsalType.BAEKHO, position: PillarPosition.MONTH, referenceBranch: Jiji.JIN, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(1);
      expect(composites[0]!.patternName).toBe('양인+백호');
      expect(composites[0]!.interactionType).toBe(CompositeInteractionType.AMPLIFY_NEGATIVE);
      expect(composites[0]!.bonusScore).toBe(-10);
    });

    it('detects cheondeok + woldeok double defense', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.CHEONDEOK_GWIIN, position: PillarPosition.YEAR, referenceBranch: Jiji.IN, note: '' },
        { type: ShinsalType.WOLDEOK_GWIIN, position: PillarPosition.MONTH, referenceBranch: Jiji.O, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(1);
      expect(composites[0]!.patternName).toBe('천덕귀인+월덕귀인');
      expect(composites[0]!.bonusScore).toBe(20);
    });

    it('detects yangin + cheonul gwiin temper', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.YANGIN, position: PillarPosition.DAY, referenceBranch: Jiji.MYO, note: '' },
        { type: ShinsalType.CHEONUL_GWIIN, position: PillarPosition.MONTH, referenceBranch: Jiji.CHUK, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(1);
      expect(composites[0]!.interactionType).toBe(CompositeInteractionType.TEMPER);
    });

    it('detects wonjin + dohwa transform', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.WONJIN, position: PillarPosition.YEAR, referenceBranch: Jiji.MI, note: '' },
        { type: ShinsalType.DOHWA, position: PillarPosition.MONTH, referenceBranch: Jiji.MYO, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(1);
      expect(composites[0]!.patternName).toBe('원진+도화');
      expect(composites[0]!.interactionType).toBe(CompositeInteractionType.TRANSFORM);
    });

    it('no pattern when only one shinsal', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.YEOKMA, position: PillarPosition.DAY, referenceBranch: Jiji.SIN, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(0);
    });

    it('no pattern when no matching composite', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.AMNOK, position: PillarPosition.DAY, referenceBranch: Jiji.SIN, note: '' },
        { type: ShinsalType.CHEONUI, position: PillarPosition.MONTH, referenceBranch: Jiji.CHUK, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(0);
    });

    it('same pillar proximity bonus', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.YEOKMA, position: PillarPosition.DAY, referenceBranch: Jiji.SIN, note: '' },
        { type: ShinsalType.DOHWA, position: PillarPosition.DAY, referenceBranch: Jiji.MYO, note: '' }, // same pillar
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      expect(composites.length).toBe(1);
      expect(composites[0]!.bonusScore).toBe(20); // 15 base + 5 proximity
    });

    it('multiple composite patterns detected', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.YEOKMA, position: PillarPosition.DAY, referenceBranch: Jiji.SIN, note: '' },
        { type: ShinsalType.DOHWA, position: PillarPosition.MONTH, referenceBranch: Jiji.MYO, note: '' },
        { type: ShinsalType.HWAGAE, position: PillarPosition.YEAR, referenceBranch: Jiji.SUL, note: '' },
      ];
      const composites = ShinsalCompositeInterpreter.detect(hits);
      // 역마+도화, 도화+화개 both detected
      expect(composites.length).toBe(2);
      const names = new Set(composites.map(c => c.patternName));
      expect(names.has('역마+도화')).toBe(true);
      expect(names.has('도화+화개')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 13개 패턴 테이블 완전성
  // ═══════════════════════════════════════════════════════════

  describe('5. 13개 패턴 테이블 완전성', () => {
    it('all composite rules have valid types and interpretation', () => {
      for (const rule of COMPOSITE_RULES) {
        expect(rule.type1).toBeDefined();
        expect(rule.type2).toBeDefined();
        expect(rule.interpretation.length).toBeGreaterThan(0);
        expect(rule.patternName).toContain('+');
      }
      expect(COMPOSITE_RULES.length).toBe(13);
    });

    it('composite rule types are all distinct pairs', () => {
      const pairs = COMPOSITE_RULES.map(r => {
        const sorted = [r.type1, r.type2].sort();
        return `${sorted[0]}:${sorted[1]}`;
      });
      expect(pairs.length).toBe(new Set(pairs).size);
    });
  });
});
