import { describe, it, expect } from 'vitest';
import { Ohaeng, OHAENG_VALUES } from '../../src/domain/Ohaeng.js';
import { OhaengPracticalGuide } from '../../src/interpretation/OhaengPracticalGuide.js';

describe('OhaengPracticalGuide', () => {

  describe('guide', () => {
    it('returns a guide for every ohaeng', () => {
      for (const oh of OHAENG_VALUES) {
        const guide = OhaengPracticalGuide.guide(oh);
        expect(guide).toBeDefined();
        expect(guide.element).toBe(oh);
        expect(guide.colors.length).toBeGreaterThan(0);
        expect(guide.direction).toBeTruthy();
        expect(guide.season).toBeTruthy();
        expect(guide.numbers.length).toBeGreaterThan(0);
        expect(guide.taste).toBeTruthy();
        expect(guide.organ).toBeTruthy();
        expect(guide.careers.length).toBeGreaterThan(0);
        expect(guide.dailyTips.length).toBeGreaterThan(0);
      }
    });

    it('WOOD guide has correct color and direction', () => {
      const guide = OhaengPracticalGuide.guide(Ohaeng.WOOD);
      expect(guide.colors).toContain('초록');
      expect(guide.direction).toContain('동');
      expect(guide.season).toContain('봄');
      expect(guide.taste).toContain('신맛');
    });

    it('FIRE guide has correct color and direction', () => {
      const guide = OhaengPracticalGuide.guide(Ohaeng.FIRE);
      expect(guide.colors).toContain('빨강');
      expect(guide.direction).toContain('남');
      expect(guide.numbers).toContain(2);
      expect(guide.numbers).toContain(7);
    });

    it('EARTH guide has correct color and direction', () => {
      const guide = OhaengPracticalGuide.guide(Ohaeng.EARTH);
      expect(guide.colors).toContain('노랑');
      expect(guide.direction).toContain('중앙');
      expect(guide.numbers).toContain(5);
    });

    it('METAL guide has correct color and direction', () => {
      const guide = OhaengPracticalGuide.guide(Ohaeng.METAL);
      expect(guide.colors).toContain('흰색');
      expect(guide.direction).toContain('서');
      expect(guide.taste).toContain('매운맛');
    });

    it('WATER guide has correct color and direction', () => {
      const guide = OhaengPracticalGuide.guide(Ohaeng.WATER);
      expect(guide.colors).toContain('검정');
      expect(guide.direction).toContain('북');
      expect(guide.organ).toContain('신장');
    });
  });

  describe('avoidanceNote', () => {
    it('generates avoidance note for each ohaeng', () => {
      for (const oh of OHAENG_VALUES) {
        const note = OhaengPracticalGuide.avoidanceNote(oh);
        expect(note).toBeTruthy();
        expect(note).toContain('줄이세요');
      }
    });

    it('WOOD avoidance mentions green color', () => {
      const note = OhaengPracticalGuide.avoidanceNote(Ohaeng.WOOD);
      expect(note).toContain('초록');
    });

    it('FIRE avoidance mentions red color and south direction', () => {
      const note = OhaengPracticalGuide.avoidanceNote(Ohaeng.FIRE);
      expect(note).toContain('빨강');
      expect(note).toContain('남');
    });

    it('WATER avoidance mentions black color', () => {
      const note = OhaengPracticalGuide.avoidanceNote(Ohaeng.WATER);
      expect(note).toContain('검정');
    });
  });

  describe('guide data consistency', () => {
    it('each ohaeng has exactly 2 lucky numbers', () => {
      for (const oh of OHAENG_VALUES) {
        const guide = OhaengPracticalGuide.guide(oh);
        expect(guide.numbers).toHaveLength(2);
      }
    });

    it('each ohaeng has exactly 3 daily tips', () => {
      for (const oh of OHAENG_VALUES) {
        const guide = OhaengPracticalGuide.guide(oh);
        expect(guide.dailyTips).toHaveLength(3);
      }
    });

    it('each ohaeng has at least 3 colors', () => {
      for (const oh of OHAENG_VALUES) {
        const guide = OhaengPracticalGuide.guide(oh);
        expect(guide.colors.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('each ohaeng has at least 6 careers', () => {
      for (const oh of OHAENG_VALUES) {
        const guide = OhaengPracticalGuide.guide(oh);
        expect(guide.careers.length).toBeGreaterThanOrEqual(6);
      }
    });
  });
});
