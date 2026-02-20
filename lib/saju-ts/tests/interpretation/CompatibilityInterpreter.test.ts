import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { CompatibilityInterpreter } from '../../src/interpretation/CompatibilityInterpreter.js';
import { CompatibilityNarrative } from '../../src/interpretation/CompatibilityNarrative.js';
import {
  CompatibilityGrade,
} from '../../src/domain/Compatibility.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';

/**
 * Tests for CompatibilityInterpreter -- 궁합(宮合) 분석기.
 */
describe('CompatibilityInterpreter', () => {

  // Person A: 1986-04-19 05:45 Male (day master: 계 GYE)
  const personA = analyzeSaju(createBirthInput({
    birthYear: 1986, birthMonth: 4, birthDay: 19,
    birthHour: 5, birthMinute: 45,
    gender: Gender.MALE,
    longitude: 126.978,
  }));

  // Person B: 1990-07-15 14:00 Female (day master: 신 SIN)
  const personB = analyzeSaju(createBirthInput({
    birthYear: 1990, birthMonth: 7, birthDay: 15,
    birthHour: 14, birthMinute: 0,
    gender: Gender.FEMALE,
    longitude: 126.978,
  }));

  // Person C: 1989-01-10 01:30 Male (day master: 경 GYEONG)
  const personC = analyzeSaju(createBirthInput({
    birthYear: 1989, birthMonth: 1, birthDay: 10,
    birthHour: 1, birthMinute: 30,
    gender: Gender.MALE,
    longitude: 126.978,
  }));

  // -- Basic contract --

  describe('basic contract', () => {
    it('analyze returns result with all sections', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);

      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.dayMaster.score).toBeGreaterThanOrEqual(0);
      expect(result.dayMaster.score).toBeLessThanOrEqual(100);
      expect(result.dayBranch.score).toBeGreaterThanOrEqual(0);
      expect(result.dayBranch.score).toBeLessThanOrEqual(100);
      expect(result.ohaengComplement.score).toBeGreaterThanOrEqual(0);
      expect(result.ohaengComplement.score).toBeLessThanOrEqual(100);
      expect(result.sipseongCross.score).toBeGreaterThanOrEqual(0);
      expect(result.sipseongCross.score).toBeLessThanOrEqual(100);
      expect(result.shinsalMatch.score).toBeGreaterThanOrEqual(0);
      expect(result.shinsalMatch.score).toBeLessThanOrEqual(100);
    });

    it('grade maps correctly to score ranges', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      if (result.totalScore >= 85) expect(result.grade).toBe(CompatibilityGrade.EXCELLENT);
      else if (result.totalScore >= 70) expect(result.grade).toBe(CompatibilityGrade.GOOD);
      else if (result.totalScore >= 55) expect(result.grade).toBe(CompatibilityGrade.AVERAGE);
      else if (result.totalScore >= 40) expect(result.grade).toBe(CompatibilityGrade.BELOW_AVERAGE);
      else expect(result.grade).toBe(CompatibilityGrade.POOR);
    });
  });

  // -- Day master relation --

  describe('day master relation', () => {
    it('GAP-GI pair is detected as cheongan hap', () => {
      const dmA = personA.pillars.day.cheongan;
      const dmB = personB.pillars.day.cheongan;

      if (dmA === Cheongan.GAP && dmB === Cheongan.GI) {
        const result = CompatibilityInterpreter.analyze(personA, personB);
        expect(result.dayMaster.relationType).toBe('천간합(天干合)');
        expect(result.dayMaster.score).toBeGreaterThanOrEqual(90);
      }
    });

    it('day master interpretation is non-blank', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      expect(result.dayMaster.interpretation.length).toBeGreaterThan(0);
    });
  });

  // -- Day branch relation --

  describe('day branch relation', () => {
    it('day branch is detected with non-blank interpretation', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      expect(result.dayBranch.interpretation.length).toBeGreaterThan(0);
      expect(result.dayBranch.relationType.length).toBeGreaterThan(0);
    });
  });

  // -- Ohaeng complement --

  describe('ohaeng complement', () => {
    it('combined completeness is 1-5', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      expect(result.ohaengComplement.combinedCompleteness).toBeGreaterThanOrEqual(1);
      expect(result.ohaengComplement.combinedCompleteness).toBeLessThanOrEqual(5);
    });

    it('ohaeng complement score is positive', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      expect(result.ohaengComplement.score).toBeGreaterThan(0);
    });
  });

  // -- Sipseong cross --

  describe('sipseong cross', () => {
    it('sipseong cross analysis is non-blank', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      expect(result.sipseongCross.interpretation2to1.length).toBeGreaterThan(0);
      expect(result.sipseongCross.interpretation1to2.length).toBeGreaterThan(0);
    });
  });

  // -- Shinsal match --

  describe('shinsal match', () => {
    it('shinsal match score is at least 50', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      expect(result.shinsalMatch.score).toBeGreaterThanOrEqual(50);
    });
  });

  // -- Symmetry --

  describe('symmetry', () => {
    it('A-B and B-A have same day master relation type', () => {
      const ab = CompatibilityInterpreter.analyze(personA, personB);
      const ba = CompatibilityInterpreter.analyze(personB, personA);
      expect(ab.dayMaster.relationType).toBe(ba.dayMaster.relationType);
    });

    it('A-B and B-A have same day branch relation type', () => {
      const ab = CompatibilityInterpreter.analyze(personA, personB);
      const ba = CompatibilityInterpreter.analyze(personB, personA);
      expect(ab.dayBranch.relationType).toBe(ba.dayBranch.relationType);
    });
  });

  // -- Different pair --

  describe('different pair', () => {
    it('A-C produces valid result', () => {
      const result = CompatibilityInterpreter.analyze(personA, personC);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.dayMaster.interpretation.length).toBeGreaterThan(0);
    });
  });

  // -- Narrative generation --

  describe('narrative report', () => {
    it('contains all sections', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      const report = CompatibilityNarrative.generate(result);

      expect(report).toContain('\u25A0 궁합(宮合) 분석 보고서');
      expect(report).toContain('종합 점수:');
      expect(report).toContain('\u3010일간(日干) 궁합');
      expect(report).toContain('\u3010일지(日支) 궁합');
      expect(report).toContain('\u3010오행(五行) 보완');
      expect(report).toContain('\u3010십성(十星) 교차');
      expect(report).toContain('\u3010종합 조언\u3011');
    });

    it('narrative with custom names', () => {
      const result = CompatibilityInterpreter.analyze(personA, personB);
      const report = CompatibilityNarrative.generate(result, '철수', '영희');
      expect(report).toContain('철수');
      expect(report).toContain('영희');
    });
  });

  // -- Pinned score verification (BLG-M8) --

  describe('pinned score verification', () => {
    it('AB pair component scores are pinned', () => {
      const r = CompatibilityInterpreter.analyze(personA, personB);

      expect(r.dayMaster.stem1).toBe(Cheongan.GYE);
      expect(r.dayMaster.stem2).toBe(Cheongan.SIN);
      expect(r.dayMaster.relationType).toBe('상생(相生)');
      expect(r.dayMaster.score).toBe(80);

      expect(r.dayBranch.relationType).toBe('삼합(三合)');
      expect(r.dayBranch.score).toBe(80);

      expect(r.ohaengComplement.score).toBe(95);
      expect(r.sipseongCross.score).toBe(67);
      expect(r.shinsalMatch.score).toBe(68);
      expect(r.totalScore).toBe(79);
      expect(r.grade).toBe(CompatibilityGrade.GOOD);
    });

    it('AC pair component scores are pinned', () => {
      const r = CompatibilityInterpreter.analyze(personA, personC);

      expect(r.dayMaster.stem1).toBe(Cheongan.GYE);
      expect(r.dayMaster.stem2).toBe(Cheongan.GYEONG);
      expect(r.dayMaster.relationType).toBe('상생(相生)');
      expect(r.dayMaster.score).toBe(80);

      expect(r.dayBranch.relationType).toBe('중립(中立)');
      expect(r.dayBranch.score).toBe(60);

      expect(r.ohaengComplement.score).toBe(95);
      expect(r.sipseongCross.score).toBe(67);
      expect(r.shinsalMatch.score).toBe(67);
      expect(r.totalScore).toBe(74);
      expect(r.grade).toBe(CompatibilityGrade.GOOD);
    });

    it('BC pair component scores are pinned', () => {
      const r = CompatibilityInterpreter.analyze(personB, personC);

      expect(r.dayMaster.stem1).toBe(Cheongan.SIN);
      expect(r.dayMaster.stem2).toBe(Cheongan.GYEONG);
      expect(r.dayMaster.relationType).toBe('동일 오행(同一五行)');
      expect(r.dayMaster.score).toBe(55);

      expect(r.dayBranch.relationType).toBe('중립(中立)');
      expect(r.dayBranch.score).toBe(60);

      expect(r.ohaengComplement.score).toBe(70);
      expect(r.sipseongCross.score).toBe(40);
      expect(r.shinsalMatch.score).toBe(67);
      expect(r.totalScore).toBe(57);
      expect(r.grade).toBe(CompatibilityGrade.AVERAGE);
    });
  });

  // -- Self-compatibility --

  describe('self-compatibility', () => {
    it('self-compatibility produces valid result', () => {
      const result = CompatibilityInterpreter.analyze(personA, personA);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      const hasSelf = result.dayMaster.relationType.includes('동일') ||
                      result.dayMaster.relationType.includes('비견') ||
                      result.dayMaster.relationType.includes('自');
      expect(hasSelf).toBe(true);
    });
  });
});
