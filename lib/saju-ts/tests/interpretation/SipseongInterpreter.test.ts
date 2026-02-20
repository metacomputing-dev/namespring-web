import { describe, it, expect } from 'vitest';
import { SipseongInterpreter } from '../../src/interpretation/SipseongInterpreter.js';
import { Sipseong, SIPSEONG_VALUES } from '../../src/domain/Sipseong.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../src/domain/PillarPosition.js';

/**
 * Ported from SipseongInterpreterTest.kt
 *
 * 10 십성 x 4 기둥 = 40 entries: existence, non-blank fields, consistency.
 */

describe('SipseongInterpreter', () => {
  const allCombinations: [Sipseong, PillarPosition][] = [];
  for (const s of SIPSEONG_VALUES) {
    for (const p of PILLAR_POSITION_VALUES) {
      allCombinations.push([s, p]);
    }
  }

  it('has exactly 40 entries (10 x 4)', () => {
    expect(allCombinations).toHaveLength(40);
  });

  it('all 40 entries exist without throwing', () => {
    const failures: string[] = [];
    for (const [sipseong, position] of allCombinations) {
      try {
        SipseongInterpreter.interpret(sipseong, position);
      } catch (e) {
        failures.push(`${sipseong}+${position}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('all 40 entries have non-blank keyword', () => {
    for (const [sipseong, position] of allCombinations) {
      const interp = SipseongInterpreter.interpret(sipseong, position);
      expect(interp.keyword.trim().length, `${sipseong}+${position} keyword`).toBeGreaterThan(0);
    }
  });

  it('all 40 entries have non-blank shortDescription', () => {
    for (const [sipseong, position] of allCombinations) {
      const interp = SipseongInterpreter.interpret(sipseong, position);
      expect(interp.shortDescription.trim().length, `${sipseong}+${position} shortDescription`).toBeGreaterThan(0);
    }
  });

  it('all 40 entries have non-empty positiveTraits with no blank items', () => {
    for (const [sipseong, position] of allCombinations) {
      const interp = SipseongInterpreter.interpret(sipseong, position);
      expect(interp.positiveTraits.length, `${sipseong}+${position} positiveTraits count`).toBeGreaterThan(0);
      for (const trait of interp.positiveTraits) {
        expect(trait.trim().length, `${sipseong}+${position} positiveTraits item`).toBeGreaterThan(0);
      }
    }
  });

  it('all 40 entries have non-empty negativeTraits with no blank items', () => {
    for (const [sipseong, position] of allCombinations) {
      const interp = SipseongInterpreter.interpret(sipseong, position);
      expect(interp.negativeTraits.length, `${sipseong}+${position} negativeTraits count`).toBeGreaterThan(0);
      for (const trait of interp.negativeTraits) {
        expect(trait.trim().length, `${sipseong}+${position} negativeTraits item`).toBeGreaterThan(0);
      }
    }
  });

  it('all 40 entries have non-blank careerHint', () => {
    for (const [sipseong, position] of allCombinations) {
      const interp = SipseongInterpreter.interpret(sipseong, position);
      expect(interp.careerHint.trim().length, `${sipseong}+${position} careerHint`).toBeGreaterThan(0);
    }
  });

  it('sipseong and position match returned values', () => {
    for (const [sipseong, position] of allCombinations) {
      const interp = SipseongInterpreter.interpret(sipseong, position);
      expect(interp.sipseong).toBe(sipseong);
      expect(interp.position).toBe(position);
    }
  });
});
