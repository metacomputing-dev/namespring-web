import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { PalaceFavor } from '../../../src/domain/Palace.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../../src/domain/PillarPosition.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { Sipseong, SIPSEONG_VALUES } from '../../../src/domain/Sipseong.js';
import { PalaceAnalyzer } from '../../../src/engine/analysis/PalaceAnalyzer.js';

/**
 * Ported from PalaceAnalyzerTest.kt
 *
 * Tests the PalaceAnalyzer (궁성 분석기) covering:
 * - Palace metadata for each position
 * - Sipseong-to-family mapping by gender
 * - Full palace analysis for four-pillar charts
 * - Interpretation framework
 * - Edge cases and cross-validation
 */

// =========================================================================
// palaceInfo -- Verify palace metadata for each position
// =========================================================================

describe('PalaceAnalyzer', () => {
  describe('PalaceInfo', () => {
    it('year palace is 부모궁', () => {
      const info = PalaceAnalyzer.palaceInfo(PillarPosition.YEAR);
      expect(info.koreanName).toBe('부모궁');
      expect(info.position).toBe(PillarPosition.YEAR);
      expect(info.agePeriod).toBe('1~15세');
      expect(info.bodyPart).toBe('머리/두뇌');
    });

    it('month palace is 형제궁', () => {
      const info = PalaceAnalyzer.palaceInfo(PillarPosition.MONTH);
      expect(info.koreanName).toBe('형제궁');
      expect(info.position).toBe(PillarPosition.MONTH);
      expect(info.agePeriod).toBe('16~30세');
      expect(info.bodyPart).toBe('가슴/어깨');
    });

    it('day palace is 배우자궁', () => {
      const info = PalaceAnalyzer.palaceInfo(PillarPosition.DAY);
      expect(info.koreanName).toBe('배우자궁');
      expect(info.position).toBe(PillarPosition.DAY);
      expect(info.agePeriod).toBe('31~45세');
      expect(info.bodyPart).toBe('배/허리');
    });

    it('hour palace is 자녀궁', () => {
      const info = PalaceAnalyzer.palaceInfo(PillarPosition.HOUR);
      expect(info.koreanName).toBe('자녀궁');
      expect(info.position).toBe(PillarPosition.HOUR);
      expect(info.agePeriod).toBe('46세~');
      expect(info.bodyPart).toBe('다리/발');
    });

    it('day palace cheongan aspect is 나 자신 (일간)', () => {
      const info = PalaceAnalyzer.palaceInfo(PillarPosition.DAY);
      expect(info.cheonganAspect).toBe('나 자신 (일간)');
      expect(info.jijiAspect).toBe('배우자');
    });

    it('all positions have palace info', () => {
      for (const position of PILLAR_POSITION_VALUES) {
        const info = PalaceAnalyzer.palaceInfo(position);
        expect(info.position).toBe(position);
        expect(info.koreanName.length).toBeGreaterThan(0);
        expect(info.domain.length).toBeGreaterThan(0);
        expect(info.agePeriod.length).toBeGreaterThan(0);
        expect(info.bodyPart.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // familyRelation / familyMember -- Sipseong-to-family mapping by gender
  // =========================================================================

  describe('FamilyRelation', () => {
    it('male JEONG_JAE is wife (아내)', () => {
      const relation = PalaceAnalyzer.familyRelation(Sipseong.JEONG_JAE, Gender.MALE);
      expect(relation.familyMember).toBe('아내');
      expect(relation.hanja).toBe('妻');
      expect(relation.sipseong).toBe(Sipseong.JEONG_JAE);
      expect(relation.gender).toBe(Gender.MALE);
    });

    it('female PYEON_GWAN is husband (남편)', () => {
      const relation = PalaceAnalyzer.familyRelation(Sipseong.PYEON_GWAN, Gender.FEMALE);
      expect(relation.familyMember).toBe('남편');
      expect(relation.hanja).toBe('夫');
    });

    it('male JEONG_IN is mother (어머니)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.JEONG_IN, Gender.MALE);
      expect(member).toBe('어머니');
    });

    it('female JEONG_IN is also mother (어머니)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.JEONG_IN, Gender.FEMALE);
      expect(member).toBe('어머니');
    });

    it('male PYEON_JAE is father (아버지)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.PYEON_JAE, Gender.MALE);
      expect(member).toBe('아버지');
    });

    it('female JEONG_JAE is father (아버지)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.JEONG_JAE, Gender.FEMALE);
      expect(member).toBe('아버지');
    });

    it('male PYEON_GWAN is son (아들)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.PYEON_GWAN, Gender.MALE);
      expect(member).toBe('아들');
    });

    it('female SANG_GWAN is son (아들)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.SANG_GWAN, Gender.FEMALE);
      expect(member).toBe('아들');
    });

    it('male BI_GYEON is brothers (형제)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.BI_GYEON, Gender.MALE);
      expect(member).toBe('형제');
    });

    it('female BI_GYEON is sisters (자매)', () => {
      const member = PalaceAnalyzer.familyMember(Sipseong.BI_GYEON, Gender.FEMALE);
      expect(member).toBe('자매');
    });

    it('gender produces different family for JEONG_JAE', () => {
      const maleRelation = PalaceAnalyzer.familyRelation(Sipseong.JEONG_JAE, Gender.MALE);
      const femaleRelation = PalaceAnalyzer.familyRelation(Sipseong.JEONG_JAE, Gender.FEMALE);
      expect(maleRelation.familyMember).not.toBe(femaleRelation.familyMember);
    });

    it('all sipseong have family mapping for both genders', () => {
      const genders = [Gender.MALE, Gender.FEMALE];
      for (const sipseong of SIPSEONG_VALUES) {
        for (const gender of genders) {
          const relation = PalaceAnalyzer.familyRelation(sipseong, gender);
          expect(relation.sipseong).toBe(sipseong);
          expect(relation.gender).toBe(gender);
          expect(relation.familyMember.length).toBeGreaterThan(0);
          expect(relation.hanja.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // =========================================================================
  // analyze -- Full palace analysis for all four positions
  // =========================================================================

  describe('Analyze', () => {
    // A well-known test chart: day master GAP (갑), male.
    // 갑자년, 병인월, 갑오일, 경신시
    const testPillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.GYEONG, Jiji.SIN),
    );

    it('analyze returns four entries', () => {
      const result = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      const keys = Object.keys(result);
      expect(keys.length).toBe(4);
      expect(result[PillarPosition.YEAR]).toBeDefined();
      expect(result[PillarPosition.MONTH]).toBeDefined();
      expect(result[PillarPosition.DAY]).toBeDefined();
      expect(result[PillarPosition.HOUR]).toBeDefined();
    });

    it('day position has null sipseong', () => {
      const result = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      const dayAnalysis = result[PillarPosition.DAY];

      expect(dayAnalysis.sipseong).toBeNull();
      expect(dayAnalysis.familyRelation).toBeNull();
      expect(dayAnalysis.palaceInfo.koreanName).toBe('배우자궁');
    });

    it('non-day positions have non-null sipseong', () => {
      const result = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      const nonDayPositions = [PillarPosition.YEAR, PillarPosition.MONTH, PillarPosition.HOUR];

      for (const position of nonDayPositions) {
        const analysis = result[position];
        expect(analysis.sipseong).not.toBeNull();
        expect(analysis.familyRelation).not.toBeNull();
      }
    });

    it('year pillar GAP vs GAP is BI_GYEON', () => {
      // Year stem: GAP, Day master: GAP -> same element, same parity -> BI_GYEON.
      const result = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      const yearAnalysis = result[PillarPosition.YEAR];

      expect(yearAnalysis.sipseong).toBe(Sipseong.BI_GYEON);
      expect(yearAnalysis.familyRelation?.familyMember).toBe('형제');
    });

    it('month pillar BYEONG vs GAP is SIK_SIN', () => {
      // Month stem: BYEONG (Fire, Yang), Day master: GAP (Wood, Yang).
      // Wood produces Fire, same parity -> SIK_SIN.
      const result = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      const monthAnalysis = result[PillarPosition.MONTH];

      expect(monthAnalysis.sipseong).toBe(Sipseong.SIK_SIN);
      expect(monthAnalysis.familyRelation?.familyMember).toBe('장모');
    });

    it('hour pillar GYEONG vs GAP is PYEON_GWAN', () => {
      // Hour stem: GYEONG (Metal, Yang), Day master: GAP (Wood, Yang).
      // Metal controls Wood, same parity -> PYEON_GWAN.
      const result = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      const hourAnalysis = result[PillarPosition.HOUR];

      expect(hourAnalysis.sipseong).toBe(Sipseong.PYEON_GWAN);
      expect(hourAnalysis.familyRelation?.familyMember).toBe('아들');
    });

    it('different gender produces different family mappings', () => {
      const maleResult = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      const femaleResult = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.FEMALE);

      // Sipseong values should be identical (gender does not affect sipseong).
      const nonDayPositions = [PillarPosition.YEAR, PillarPosition.MONTH, PillarPosition.HOUR];
      for (const position of nonDayPositions) {
        expect(maleResult[position].sipseong).toBe(femaleResult[position].sipseong);
      }

      // But family relation should differ for sipseong values that have
      // gender-specific mappings (e.g., BI_GYEON: 형제 vs 자매).
      const maleYear = maleResult[PillarPosition.YEAR].familyRelation;
      const femaleYear = femaleResult[PillarPosition.YEAR].familyRelation;
      expect(maleYear).not.toBeNull();
      expect(femaleYear).not.toBeNull();
      expect(maleYear!.familyMember).not.toBe(femaleYear!.familyMember);
    });

    it('palace info is consistent with direct lookup', () => {
      const result = PalaceAnalyzer.analyze(testPillars, Cheongan.GAP, Gender.MALE);
      for (const position of PILLAR_POSITION_VALUES) {
        expect(result[position].palaceInfo).toEqual(PalaceAnalyzer.palaceInfo(position));
      }
    });

    it('female chart with JEONG_JAE as father', () => {
      // Day master: GAP (Wood, Yang). Target: GI (Earth, Yin).
      // Wood controls Earth, different parity -> JEONG_JAE.
      // For female: JEONG_JAE -> 아버지 (father).
      const pillars = new PillarSet(
        new Pillar(Cheongan.GI, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );
      const result = PalaceAnalyzer.analyze(pillars, Cheongan.GAP, Gender.FEMALE);
      const yearAnalysis = result[PillarPosition.YEAR];

      expect(yearAnalysis.sipseong).toBe(Sipseong.JEONG_JAE);
      expect(yearAnalysis.familyRelation?.familyMember).toBe('아버지');
    });

    it('male chart with JEONG_JAE as wife', () => {
      // Same sipseong (JEONG_JAE) but for male -> 아내 (wife).
      const pillars = new PillarSet(
        new Pillar(Cheongan.GI, Jiji.SA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );
      const result = PalaceAnalyzer.analyze(pillars, Cheongan.GAP, Gender.MALE);
      const yearAnalysis = result[PillarPosition.YEAR];

      expect(yearAnalysis.sipseong).toBe(Sipseong.JEONG_JAE);
      expect(yearAnalysis.familyRelation?.familyMember).toBe('아내');
    });
  });

  // =========================================================================
  // Interpretation Framework Tests
  // =========================================================================

  describe('Interpretation', () => {
    it('interpret returns null for DAY position', () => {
      const result = PalaceAnalyzer.interpret(Sipseong.BI_GYEON, PillarPosition.DAY);
      expect(result).toBeNull();
    });

    it('interpret returns non-null for all non-DAY positions', () => {
      const nonDayPositions = [PillarPosition.YEAR, PillarPosition.MONTH, PillarPosition.HOUR];
      for (const sipseong of SIPSEONG_VALUES) {
        for (const position of nonDayPositions) {
          const interp = PalaceAnalyzer.interpret(sipseong, position);
          expect(interp).not.toBeNull();
          expect(interp!.summary.length).toBeGreaterThan(0);
          expect(interp!.detail.length).toBeGreaterThan(0);
        }
      }
    });

    it('all interpretations contain Korean text', () => {
      const koreanRange = /[\uAC00-\uD7A3]/;
      const nonDayPositions = [PillarPosition.YEAR, PillarPosition.MONTH, PillarPosition.HOUR];
      for (const sipseong of SIPSEONG_VALUES) {
        for (const position of nonDayPositions) {
          const interp = PalaceAnalyzer.interpret(sipseong, position)!;
          expect(koreanRange.test(interp.summary)).toBe(true);
          expect(koreanRange.test(interp.detail)).toBe(true);
        }
      }
    });

    it('favorable types include expected sipseong in year', () => {
      // 식신, 정재, 정관, 정인 in 부모궁 are generally favorable
      const favorableInYear = [
        Sipseong.SIK_SIN, Sipseong.JEONG_JAE, Sipseong.JEONG_GWAN, Sipseong.JEONG_IN,
      ];
      for (const s of favorableInYear) {
        const interp = PalaceAnalyzer.interpret(s, PillarPosition.YEAR)!;
        expect(interp.favor).toBe(PalaceFavor.FAVORABLE);
      }
    });

    it('unfavorable types include expected sipseong (GYEOB_JAE in all positions)', () => {
      // 겁재 in any position is generally unfavorable
      const nonDayPositions = [PillarPosition.YEAR, PillarPosition.MONTH, PillarPosition.HOUR];
      for (const pos of nonDayPositions) {
        const interp = PalaceAnalyzer.interpret(Sipseong.GYEOB_JAE, pos)!;
        expect(interp.favor).toBe(PalaceFavor.UNFAVORABLE);
      }
    });

    it('analyze includes interpretation in results', () => {
      const pillars = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.GAP, Jiji.O),
        new Pillar(Cheongan.GYEONG, Jiji.SIN),
      );
      const result = PalaceAnalyzer.analyze(pillars, Cheongan.GAP, Gender.MALE);

      // DAY should have null interpretation
      expect(result[PillarPosition.DAY].interpretation).toBeNull();

      // Other positions should have non-null interpretation
      const nonDayPositions = [PillarPosition.YEAR, PillarPosition.MONTH, PillarPosition.HOUR];
      for (const pos of nonDayPositions) {
        expect(result[pos].interpretation).not.toBeNull();
      }
    });

    it('year BI_GYEON interpretation contains family context', () => {
      const interp = PalaceAnalyzer.interpret(Sipseong.BI_GYEON, PillarPosition.YEAR)!;
      expect(interp.summary).toContain('부모궁');
      expect(interp.detail).toContain('형제');
    });

    it('month JEONG_GWAN interpretation mentions career', () => {
      const interp = PalaceAnalyzer.interpret(Sipseong.JEONG_GWAN, PillarPosition.MONTH)!;
      expect(interp.summary).toContain('형제궁');
      // Should mention career-related terms
      expect(interp.detail.includes('직') || interp.detail.includes('사회')).toBe(true);
    });

    it('hour SIK_SIN mentions children', () => {
      const interp = PalaceAnalyzer.interpret(Sipseong.SIK_SIN, PillarPosition.HOUR)!;
      expect(interp.summary).toContain('자녀');
    });
  });

  // =========================================================================
  // Edge cases and cross-validation
  // =========================================================================

  describe('EdgeCases', () => {
    it('day master same as year stem gives BI_GYEON', () => {
      // When year stem equals day master, sipseong is always BI_GYEON.
      for (const stem of CHEONGAN_VALUES) {
        const pillars = new PillarSet(
          new Pillar(stem, Jiji.JA),
          new Pillar(stem, Jiji.IN),
          new Pillar(stem, Jiji.O),
          new Pillar(stem, Jiji.SIN),
        );
        const result = PalaceAnalyzer.analyze(pillars, stem, Gender.MALE);
        expect(result[PillarPosition.YEAR].sipseong).toBe(Sipseong.BI_GYEON);
      }
    });

    it('JEONG_IN is mother for both genders', () => {
      expect(PalaceAnalyzer.familyMember(Sipseong.JEONG_IN, Gender.MALE))
        .toBe(PalaceAnalyzer.familyMember(Sipseong.JEONG_IN, Gender.FEMALE));
      expect(PalaceAnalyzer.familyMember(Sipseong.JEONG_IN, Gender.MALE)).toBe('어머니');
    });

    it('PYEON_IN is grandfather for both genders', () => {
      expect(PalaceAnalyzer.familyMember(Sipseong.PYEON_IN, Gender.MALE))
        .toBe(PalaceAnalyzer.familyMember(Sipseong.PYEON_IN, Gender.FEMALE));
      expect(PalaceAnalyzer.familyMember(Sipseong.PYEON_IN, Gender.MALE)).toBe('할아버지');
    });
  });
});
