import { describe, it, expect } from 'vitest';
import {
  CompatibilityGrade,
  COMPATIBILITY_GRADE_INFO,
  type CompatibilityResult,
} from '../../src/domain/Compatibility.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Sipseong } from '../../src/domain/Sipseong.js';
import { CompatibilityNarrative } from '../../src/interpretation/CompatibilityNarrative.js';

/**
 * Test helper: create a mock CompatibilityResult with specified values.
 */
function mockResult(overrides: Partial<CompatibilityResult> = {}): CompatibilityResult {
  return {
    totalScore: 72,
    grade: CompatibilityGrade.GOOD,
    dayMaster: {
      stem1: Cheongan.GAP,
      stem2: Cheongan.GI,
      relationType: '천간합(天干合)',
      score: 95,
      interpretation: '갑(甲)과 기(己)는 천간합(天干合) 관계로, 강한 인연이 있습니다.',
    },
    dayBranch: {
      branch1: Jiji.JA,
      branch2: Jiji.CHUK,
      relationType: '육합(六合)',
      score: 90,
      interpretation: '자(子)과 축(丑)는 육합(六合) 배우자궁 궁합입니다.',
    },
    ohaengComplement: {
      score: 70,
      combinedCompleteness: 4,
      details: ['상대방이 나에게 부족한 금(金)을 보충해줍니다.'],
    },
    sipseongCross: {
      person2ToPerson1: Sipseong.JEONG_JAE,
      person1ToPerson2: Sipseong.PYEON_JAE,
      interpretation2to1: '상대가 나에게 정재(正財) — 안정적인 배우자 인연',
      interpretation1to2: '내가 상대에게 편재(偏財) — 사교적 관계',
      score: 80,
    },
    shinsalMatch: {
      score: 65,
      details: ['천을귀인(天乙貴人) 관계가 있어 서로가 서로의 귀인이 될 수 있습니다.'],
    },
    ...overrides,
  };
}

describe('CompatibilityNarrative', () => {

  describe('generate', () => {
    it('contains all 5 axis section headers', () => {
      const result = mockResult();
      const narrative = CompatibilityNarrative.generate(result, '철수', '영희');

      expect(narrative).toContain('일간(日干) 궁합');
      expect(narrative).toContain('일지(日支) 궁합');
      expect(narrative).toContain('오행(五行) 보완');
      expect(narrative).toContain('십성(十星) 교차');
    });

    it('contains overall assessment', () => {
      const narrative = CompatibilityNarrative.generate(mockResult());
      expect(narrative).toContain('종합 조언');
      expect(narrative).toContain('궁합');
    });

    it('includes scores and grade', () => {
      const result = mockResult();
      const narrative = CompatibilityNarrative.generate(result);

      expect(narrative).toContain(`${result.totalScore}점`);
      expect(narrative).toContain(COMPATIBILITY_GRADE_INFO[result.grade].koreanName);
    });

    it('includes person names when provided', () => {
      const narrative = CompatibilityNarrative.generate(mockResult(), '갑돌이', '갑순이');
      expect(narrative).toContain('갑돌이');
      expect(narrative).toContain('갑순이');
    });

    it('uses default names (본인/상대) when not provided', () => {
      const narrative = CompatibilityNarrative.generate(mockResult());
      expect(narrative).toMatch(/본인|상대/);
    });

    it('has reasonable length', () => {
      const narrative = CompatibilityNarrative.generate(mockResult(), '철수', '영희');
      expect(narrative.length).toBeGreaterThan(100);
    });

    it('contains Korean text', () => {
      const narrative = CompatibilityNarrative.generate(mockResult());
      const koreanCharCount = [...narrative].filter(
        ch => ch.charCodeAt(0) >= 0xAC00 && ch.charCodeAt(0) <= 0xD7A3,
      ).length;
      expect(koreanCharCount).toBeGreaterThan(50);
    });

    it('includes shinsal section when details present', () => {
      const result = mockResult();
      const narrative = CompatibilityNarrative.generate(result);
      expect(narrative).toContain('신살(神煞) 궁합');
    });

    it('omits shinsal section when no details', () => {
      const result = mockResult({
        shinsalMatch: { score: 60, details: [] },
      });
      const narrative = CompatibilityNarrative.generate(result);
      expect(narrative).not.toContain('신살(神煞) 궁합');
    });
  });

  describe('overall advice per grade', () => {
    const gradeExpectedWords: Record<CompatibilityGrade, string> = {
      [CompatibilityGrade.EXCELLENT]: '최상',
      [CompatibilityGrade.GOOD]: '좋은 궁합',
      [CompatibilityGrade.AVERAGE]: '무난한 궁합',
      [CompatibilityGrade.BELOW_AVERAGE]: '어려운 궁합',
      [CompatibilityGrade.POOR]: '도전적인 궁합',
    };

    for (const [grade, expectedWord] of Object.entries(gradeExpectedWords)) {
      it(`${grade} advice contains "${expectedWord}"`, () => {
        const result = mockResult({ grade: grade as CompatibilityGrade });
        const narrative = CompatibilityNarrative.generate(result);
        expect(narrative).toContain(expectedWord);
      });
    }
  });

  describe('ohaeng complement details', () => {
    it('lists ohaeng completeness', () => {
      const result = mockResult();
      const narrative = CompatibilityNarrative.generate(result);
      expect(narrative).toContain('오행 완성도: 4/5');
    });

    it('lists detail bullets', () => {
      const result = mockResult();
      const narrative = CompatibilityNarrative.generate(result);
      expect(narrative).toContain('금(金)을 보충');
    });
  });

  describe('axis scores appear in narrative', () => {
    it('shows day master score', () => {
      const result = mockResult();
      const narrative = CompatibilityNarrative.generate(result);
      expect(narrative).toContain(`${result.dayMaster.score}점`);
    });

    it('shows day branch score', () => {
      const result = mockResult();
      const narrative = CompatibilityNarrative.generate(result);
      expect(narrative).toContain(`${result.dayBranch.score}점`);
    });
  });
});
