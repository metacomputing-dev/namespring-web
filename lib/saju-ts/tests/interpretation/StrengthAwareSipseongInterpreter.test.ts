import { describe, it, expect } from 'vitest';
import { Sipseong, SIPSEONG_VALUES } from '../../src/domain/Sipseong.js';
import { StrengthLevel } from '../../src/domain/StrengthResult.js';
import {
  StrengthAwareSipseongInterpreter,
  Favorability,
} from '../../src/interpretation/StrengthAwareSipseongInterpreter.js';

describe('StrengthAwareSipseongInterpreter', () => {

  describe('neutral strength levels', () => {
    const neutralLevels = [StrengthLevel.SLIGHTLY_STRONG, StrengthLevel.SLIGHTLY_WEAK];

    for (const level of neutralLevels) {
      it(`${level} produces NEUTRAL favorability for any sipseong`, () => {
        for (const ss of SIPSEONG_VALUES) {
          const reading = StrengthAwareSipseongInterpreter.interpret(ss, level);
          expect(reading.favorability).toBe(Favorability.NEUTRAL);
          expect(reading.sipseong).toBe(ss);
          expect(reading.commentary).toContain('중화');
        }
      });
    }
  });

  describe('strong levels (VERY_STRONG, STRONG)', () => {
    const strongLevels = [StrengthLevel.VERY_STRONG, StrengthLevel.STRONG];

    it('비견 is UNFAVORABLE when strong', () => {
      for (const level of strongLevels) {
        const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.BI_GYEON, level);
        expect(reading.favorability).toBe(Favorability.UNFAVORABLE);
        expect(reading.isStrong).toBe(true);
      }
    });

    it('식신 is FAVORABLE when strong', () => {
      for (const level of strongLevels) {
        const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.SIK_SIN, level);
        expect(reading.favorability).toBe(Favorability.FAVORABLE);
        expect(reading.isStrong).toBe(true);
      }
    });

    it('편재 is FAVORABLE when strong', () => {
      const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.PYEON_JAE, StrengthLevel.STRONG);
      expect(reading.favorability).toBe(Favorability.FAVORABLE);
    });

    it('정인 is UNFAVORABLE when strong', () => {
      const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.JEONG_IN, StrengthLevel.STRONG);
      expect(reading.favorability).toBe(Favorability.UNFAVORABLE);
    });

    it('편관 is FAVORABLE when strong', () => {
      const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.PYEON_GWAN, StrengthLevel.STRONG);
      expect(reading.favorability).toBe(Favorability.FAVORABLE);
    });
  });

  describe('weak levels (VERY_WEAK, WEAK)', () => {
    const weakLevels = [StrengthLevel.VERY_WEAK, StrengthLevel.WEAK];

    it('비견 is FAVORABLE when weak', () => {
      for (const level of weakLevels) {
        const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.BI_GYEON, level);
        expect(reading.favorability).toBe(Favorability.FAVORABLE);
        expect(reading.isStrong).toBe(false);
      }
    });

    it('식신 is UNFAVORABLE when weak', () => {
      for (const level of weakLevels) {
        const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.SIK_SIN, level);
        expect(reading.favorability).toBe(Favorability.UNFAVORABLE);
      }
    });

    it('정인 is FAVORABLE when weak', () => {
      const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.JEONG_IN, StrengthLevel.WEAK);
      expect(reading.favorability).toBe(Favorability.FAVORABLE);
    });

    it('편관 is UNFAVORABLE when weak', () => {
      const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.PYEON_GWAN, StrengthLevel.WEAK);
      expect(reading.favorability).toBe(Favorability.UNFAVORABLE);
    });

    it('편재 is UNFAVORABLE when weak', () => {
      const reading = StrengthAwareSipseongInterpreter.interpret(Sipseong.PYEON_JAE, StrengthLevel.WEAK);
      expect(reading.favorability).toBe(Favorability.UNFAVORABLE);
    });
  });

  describe('all 10 sipseong x 2 polarities produce readings', () => {
    it('produces a reading for every sipseong at STRONG level', () => {
      for (const ss of SIPSEONG_VALUES) {
        const reading = StrengthAwareSipseongInterpreter.interpret(ss, StrengthLevel.STRONG);
        expect(reading.sipseong).toBe(ss);
        expect(reading.commentary).toBeTruthy();
        expect(reading.advice).toBeTruthy();
      }
    });

    it('produces a reading for every sipseong at WEAK level', () => {
      for (const ss of SIPSEONG_VALUES) {
        const reading = StrengthAwareSipseongInterpreter.interpret(ss, StrengthLevel.WEAK);
        expect(reading.sipseong).toBe(ss);
        expect(reading.commentary).toBeTruthy();
        expect(reading.advice).toBeTruthy();
      }
    });
  });

  describe('신강/신약 inversion principle', () => {
    /**
     * In traditional saju theory, each sipseong's favorability inverts
     * between strong and weak. This exhaustively validates that no
     * two (sipseong, strong) and (sipseong, weak) share the same
     * favorability (unless both are NEUTRAL, which doesn't occur in the table).
     */
    it('strong and weak favorability are always different for all table entries', () => {
      for (const ss of SIPSEONG_VALUES) {
        const strong = StrengthAwareSipseongInterpreter.interpret(ss, StrengthLevel.STRONG);
        const weak = StrengthAwareSipseongInterpreter.interpret(ss, StrengthLevel.WEAK);
        expect(strong.favorability).not.toBe(weak.favorability);
      }
    });
  });
});
