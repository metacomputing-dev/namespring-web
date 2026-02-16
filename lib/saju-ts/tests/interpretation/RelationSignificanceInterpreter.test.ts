import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { PillarSet } from '../../src/domain/PillarSet.js';
import { JijiRelationType } from '../../src/domain/Relations.js';
import {
  RelationSignificanceInterpreter,
  PositionPair,
  POSITION_PAIR_INFO,
  inferPositionPair,
} from '../../src/interpretation/RelationSignificanceInterpreter.js';

// Helper: build a PillarSet with specified branch positions
function pillars(
  yearBranch: Jiji, monthBranch: Jiji, dayBranch: Jiji, hourBranch: Jiji,
): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, yearBranch),
    new Pillar(Cheongan.GAP, monthBranch),
    new Pillar(Cheongan.GAP, dayBranch),
    new Pillar(Cheongan.GAP, hourBranch),
  );
}

describe('RelationSignificanceInterpreter', () => {

  describe('interpret with members and pillar set', () => {
    it('returns null when fewer than 2 positions match', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      // SA is not in any pillar position
      const result = RelationSignificanceInterpreter.interpret(
        JijiRelationType.CHUNG,
        new Set([Jiji.SA]),
        ps,
      );
      expect(result).toBeNull();
    });

    it('detects YEAR_MONTH pair from year+month branches', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      const result = RelationSignificanceInterpreter.interpret(
        JijiRelationType.YUKHAP,
        new Set([Jiji.JA, Jiji.CHUK]),
        ps,
      );
      expect(result).not.toBeNull();
      expect(result!.positionPairLabel).toBe('년-월');
      expect(result!.isPositive).toBe(true);
    });

    it('detects DAY_HOUR pair from day+hour branches', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      const result = RelationSignificanceInterpreter.interpret(
        JijiRelationType.CHUNG,
        new Set([Jiji.IN, Jiji.MYO]),
        ps,
      );
      expect(result).not.toBeNull();
      expect(result!.positionPairLabel).toBe('일-시');
    });

    it('takes widest span for 3+ members (삼합)', () => {
      // Members span year(JA), month(JIN), hour(SIN) -> YEAR_HOUR
      const ps = pillars(Jiji.JA, Jiji.JIN, Jiji.IN, Jiji.SIN);
      const result = RelationSignificanceInterpreter.interpret(
        JijiRelationType.SAMHAP,
        new Set([Jiji.JA, Jiji.JIN, Jiji.SIN]),
        ps,
      );
      expect(result).not.toBeNull();
      expect(result!.positionPairLabel).toBe('년-시');
    });
  });

  describe('interpretWithPair (direct position pair)', () => {
    it('returns 육합 YEAR_MONTH from table', () => {
      const result = RelationSignificanceInterpreter.interpretWithPair(
        JijiRelationType.YUKHAP,
        PositionPair.YEAR_MONTH,
      );
      expect(result.isPositive).toBe(true);
      expect(result.affectedDomains).toContain('부모');
      expect(result.meaning).toContain('화목');
    });

    it('returns 충 MONTH_DAY from table', () => {
      const result = RelationSignificanceInterpreter.interpretWithPair(
        JijiRelationType.CHUNG,
        PositionPair.MONTH_DAY,
      );
      expect(result.isPositive).toBe(false);
      expect(result.affectedDomains).toContain('직업');
      expect(result.meaning).toContain('변화');
    });

    it('falls back to default for unmapped (type, pair)', () => {
      // SAMHAP YEAR_MONTH is not in the table
      const result = RelationSignificanceInterpreter.interpretWithPair(
        JijiRelationType.SAMHAP,
        PositionPair.YEAR_MONTH,
      );
      expect(result.isPositive).toBe(true); // SAMHAP is positive
      expect(result.meaning).toContain('삼합(三合)');
    });
  });

  describe('positive/negative classification', () => {
    const positiveTypes = [
      JijiRelationType.YUKHAP,
      JijiRelationType.SAMHAP,
      JijiRelationType.BANGHAP,
      JijiRelationType.BANHAP,
    ];
    const negativeTypes = [
      JijiRelationType.CHUNG,
      JijiRelationType.HYEONG,
      JijiRelationType.PA,
      JijiRelationType.HAE,
      JijiRelationType.WONJIN,
    ];

    for (const type of positiveTypes) {
      it(`${type} defaults to positive`, () => {
        const result = RelationSignificanceInterpreter.interpretWithPair(
          type,
          PositionPair.MONTH_DAY,
        );
        expect(result.isPositive).toBe(true);
      });
    }

    for (const type of negativeTypes) {
      it(`${type} defaults to negative`, () => {
        const result = RelationSignificanceInterpreter.interpretWithPair(
          type,
          PositionPair.MONTH_DAY,
        );
        expect(result.isPositive).toBe(false);
      });
    }
  });

  describe('inferPositionPair', () => {
    it('returns null when only one position matches', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      expect(inferPositionPair(new Set([Jiji.JA]), ps)).toBeNull();
    });

    it('maps year+day to YEAR_DAY', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      expect(inferPositionPair(new Set([Jiji.JA, Jiji.IN]), ps)).toBe(PositionPair.YEAR_DAY);
    });

    it('maps month+hour to MONTH_HOUR', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      expect(inferPositionPair(new Set([Jiji.CHUK, Jiji.MYO]), ps)).toBe(PositionPair.MONTH_HOUR);
    });
  });

  describe('all PositionPair entries have info', () => {
    for (const pp of Object.values(PositionPair)) {
      it(`${pp} has label and age window`, () => {
        const info = POSITION_PAIR_INFO[pp];
        expect(info.label).toBeTruthy();
        expect(info.ageWindow).toBeTruthy();
        expect(info.baseDomains.length).toBeGreaterThan(0);
      });
    }
  });
});
