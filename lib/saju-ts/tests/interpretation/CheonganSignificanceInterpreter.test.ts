import { describe, it, expect } from 'vitest';
import {
  CheonganSignificanceInterpreter,
  PositionPair,
  POSITION_PAIR_INFO,
} from '../../src/interpretation/CheonganSignificanceInterpreter.js';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';
import { CheonganRelationType } from '../../src/domain/Relations.js';

/**
 * Ported from CheonganSignificanceInterpreterTest.kt
 */

function ps(
  yearC: Cheongan, yearJ: Jiji,
  monthC: Cheongan, monthJ: Jiji,
  dayC: Cheongan, dayJ: Jiji,
  hourC: Cheongan, hourJ: Jiji,
): PillarSet {
  return new PillarSet(
    new Pillar(yearC, yearJ),
    new Pillar(monthC, monthJ),
    new Pillar(dayC, dayJ),
    new Pillar(hourC, hourJ),
  );
}

const ALL_POSITION_PAIRS: PositionPair[] = [
  PositionPair.YEAR_MONTH,
  PositionPair.YEAR_DAY,
  PositionPair.YEAR_HOUR,
  PositionPair.MONTH_DAY,
  PositionPair.MONTH_HOUR,
  PositionPair.DAY_HOUR,
];

describe('CheonganSignificanceInterpreter', () => {
  // =======================================================================
  // Position pair inference
  // =======================================================================
  describe('PositionPairInference', () => {
    it('년-월 pair inferred from year and month stems', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.GI, Jiji.CHUK,
        Cheongan.BYEONG, Jiji.IN, Cheongan.JEONG, Jiji.MYO,
      );
      const pair = CheonganSignificanceInterpreter.inferPositionPair(
        new Set([Cheongan.GAP, Cheongan.GI]), pillars,
      );
      expect(pair).toBe(PositionPair.YEAR_MONTH);
    });

    it('월-일 pair inferred from month and day stems', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.EUL, Jiji.CHUK,
        Cheongan.GYEONG, Jiji.IN, Cheongan.JEONG, Jiji.MYO,
      );
      const pair = CheonganSignificanceInterpreter.inferPositionPair(
        new Set([Cheongan.EUL, Cheongan.GYEONG]), pillars,
      );
      expect(pair).toBe(PositionPair.MONTH_DAY);
    });

    it('일-시 pair inferred from day and hour stems', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.EUL, Jiji.CHUK,
        Cheongan.BYEONG, Jiji.IN, Cheongan.IM, Jiji.MYO,
      );
      const pair = CheonganSignificanceInterpreter.inferPositionPair(
        new Set([Cheongan.BYEONG, Cheongan.IM]), pillars,
      );
      expect(pair).toBe(PositionPair.DAY_HOUR);
    });

    it('년-시 pair inferred when stems in year and hour', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.EUL, Jiji.CHUK,
        Cheongan.BYEONG, Jiji.IN, Cheongan.GI, Jiji.MYO,
      );
      const pair = CheonganSignificanceInterpreter.inferPositionPair(
        new Set([Cheongan.GAP, Cheongan.GI]), pillars,
      );
      expect(pair).toBe(PositionPair.YEAR_HOUR);
    });

    it('single stem returns null', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.EUL, Jiji.CHUK,
        Cheongan.BYEONG, Jiji.IN, Cheongan.JEONG, Jiji.MYO,
      );
      const pair = CheonganSignificanceInterpreter.inferPositionPair(
        new Set([Cheongan.GAP]), pillars,
      );
      expect(pair).toBeNull();
    });

    it('no matching stem returns null', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.EUL, Jiji.CHUK,
        Cheongan.BYEONG, Jiji.IN, Cheongan.JEONG, Jiji.MYO,
      );
      const pair = CheonganSignificanceInterpreter.inferPositionPair(
        new Set([Cheongan.IM, Cheongan.GYE]), pillars,
      );
      expect(pair).toBeNull();
    });
  });

  // =======================================================================
  // Significance lookup
  // =======================================================================
  describe('SignificanceLookup', () => {
    it('합 년-월 returns positive with ancestor domain', () => {
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.HAP, PositionPair.YEAR_MONTH,
      );
      expect(sig.isPositive).toBe(true);
      expect(sig.affectedDomains.some(d => d.includes('조상') || d.includes('부모'))).toBe(true);
      expect(sig.meaning.trim().length).toBeGreaterThan(0);
      expect(sig.positionPairLabel).toBe('년간-월간');
      expect(sig.ageWindow).toBe('초년(1~20세)');
    });

    it('합 월-일 returns positive with career domain', () => {
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.HAP, PositionPair.MONTH_DAY,
      );
      expect(sig.isPositive).toBe(true);
      expect(sig.affectedDomains.some(d => d.includes('사회') || d.includes('직업'))).toBe(true);
    });

    it('합 일-시 returns positive with child domain', () => {
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.HAP, PositionPair.DAY_HOUR,
      );
      expect(sig.isPositive).toBe(true);
      expect(sig.affectedDomains.some(d => d.includes('자녀') || d.includes('자아'))).toBe(true);
    });

    it('충 년-월 returns negative with growth environment', () => {
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.CHUNG, PositionPair.YEAR_MONTH,
      );
      expect(sig.isPositive).toBe(false);
      expect(sig.meaning.includes('충돌') || sig.meaning.includes('갈등')).toBe(true);
    });

    it('충 월-일 returns negative with career conflict', () => {
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.CHUNG, PositionPair.MONTH_DAY,
      );
      expect(sig.isPositive).toBe(false);
      expect(sig.affectedDomains.some(d => d.includes('직업') || d.includes('사회'))).toBe(true);
    });

    it('충 일-시 returns negative with inner conflict', () => {
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.CHUNG, PositionPair.DAY_HOUR,
      );
      expect(sig.isPositive).toBe(false);
      expect(sig.meaning.includes('자녀') || sig.meaning.includes('미래')).toBe(true);
    });
  });

  // =======================================================================
  // Full integration with pillars
  // =======================================================================
  describe('FullIntegration', () => {
    it('interpret with pillars returns significance for valid relation', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.GI, Jiji.O,
        Cheongan.BYEONG, Jiji.IN, Cheongan.JEONG, Jiji.MYO,
      );
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.HAP,
        new Set([Cheongan.GAP, Cheongan.GI]),
        pillars,
      );
      expect(sig).not.toBeNull();
      expect(sig!.positionPairLabel).toBe('년간-월간');
      expect(sig!.isPositive).toBe(true);
    });

    it('interpret with unmatched members returns null', () => {
      const pillars = ps(
        Cheongan.GAP, Jiji.JA, Cheongan.EUL, Jiji.CHUK,
        Cheongan.BYEONG, Jiji.IN, Cheongan.JEONG, Jiji.MYO,
      );
      const sig = CheonganSignificanceInterpreter.interpret(
        CheonganRelationType.CHUNG,
        new Set([Cheongan.IM, Cheongan.GYE]),
        pillars,
      );
      expect(sig).toBeNull();
    });
  });

  // =======================================================================
  // Coverage validation
  // =======================================================================
  describe('CoverageValidation', () => {
    it('합 has explicit interpretations for all 6 position pairs', () => {
      for (const pair of ALL_POSITION_PAIRS) {
        const sig = CheonganSignificanceInterpreter.interpret(CheonganRelationType.HAP, pair);
        expect(sig.meaning).not.toContain('성립하여');
      }
    });

    it('충 has explicit interpretations for all 6 position pairs', () => {
      for (const pair of ALL_POSITION_PAIRS) {
        const sig = CheonganSignificanceInterpreter.interpret(CheonganRelationType.CHUNG, pair);
        expect(sig.meaning).not.toContain('성립하여');
      }
    });

    it('합 is always positive, 충 is always negative', () => {
      for (const pair of ALL_POSITION_PAIRS) {
        const hap = CheonganSignificanceInterpreter.interpret(CheonganRelationType.HAP, pair);
        expect(hap.isPositive, `HAP x ${pair}`).toBe(true);

        const chung = CheonganSignificanceInterpreter.interpret(CheonganRelationType.CHUNG, pair);
        expect(chung.isPositive, `CHUNG x ${pair}`).toBe(false);
      }
    });
  });
});
