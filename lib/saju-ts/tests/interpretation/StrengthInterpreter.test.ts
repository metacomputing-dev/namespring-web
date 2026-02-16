import { describe, it, expect } from 'vitest';
import { StrengthInterpreter } from '../../src/interpretation/StrengthInterpreter.js';
import { StrengthLevel, STRENGTH_LEVEL_INFO, isStrongSide } from '../../src/domain/StrengthResult.js';

/**
 * Ported from StrengthInterpreterTest.kt
 *
 * All 6 StrengthLevel values: existence, non-blank fields, keyword correctness,
 * isStrongSide consistency.
 */

const ALL_LEVELS: StrengthLevel[] = [
  StrengthLevel.VERY_STRONG,
  StrengthLevel.STRONG,
  StrengthLevel.SLIGHTLY_STRONG,
  StrengthLevel.SLIGHTLY_WEAK,
  StrengthLevel.WEAK,
  StrengthLevel.VERY_WEAK,
];

describe('StrengthInterpreter', () => {
  // -- Exhaustive coverage --

  it.each(ALL_LEVELS)('%s produces non-null interpretation', (level) => {
    const interp = StrengthInterpreter.interpret(level);
    expect(interp).toBeDefined();
  });

  it.each(ALL_LEVELS)('%s has non-blank summary', (level) => {
    const interp = StrengthInterpreter.interpret(level);
    expect(interp.summary.trim().length).toBeGreaterThan(0);
  });

  it.each(ALL_LEVELS)('%s has non-empty personality list', (level) => {
    const interp = StrengthInterpreter.interpret(level);
    expect(interp.personality.length).toBeGreaterThan(0);
    for (const p of interp.personality) {
      expect(p.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_LEVELS)('%s has non-blank advice', (level) => {
    const interp = StrengthInterpreter.interpret(level);
    expect(interp.advice.trim().length).toBeGreaterThan(0);
  });

  it.each(ALL_LEVELS)('%s echoes input level', (level) => {
    const interp = StrengthInterpreter.interpret(level);
    expect(interp.level).toBe(level);
  });

  // -- Korean name correctness --

  it('VERY_STRONG koreanName is 극신강', () => {
    expect(STRENGTH_LEVEL_INFO[StrengthLevel.VERY_STRONG].koreanName).toBe('극신강');
  });
  it('STRONG koreanName is 신강', () => {
    expect(STRENGTH_LEVEL_INFO[StrengthLevel.STRONG].koreanName).toBe('신강');
  });
  it('SLIGHTLY_STRONG koreanName is 중강', () => {
    expect(STRENGTH_LEVEL_INFO[StrengthLevel.SLIGHTLY_STRONG].koreanName).toBe('중강');
  });
  it('SLIGHTLY_WEAK koreanName is 중약', () => {
    expect(STRENGTH_LEVEL_INFO[StrengthLevel.SLIGHTLY_WEAK].koreanName).toBe('중약');
  });
  it('WEAK koreanName is 신약', () => {
    expect(STRENGTH_LEVEL_INFO[StrengthLevel.WEAK].koreanName).toBe('신약');
  });
  it('VERY_WEAK koreanName is 극신약', () => {
    expect(STRENGTH_LEVEL_INFO[StrengthLevel.VERY_WEAK].koreanName).toBe('극신약');
  });

  // -- Keyword presence --

  it('VERY_STRONG summary contains 극신강', () => {
    expect(StrengthInterpreter.interpret(StrengthLevel.VERY_STRONG).summary).toContain('극신강');
  });

  it('VERY_STRONG personality mentions 주관 or 고집', () => {
    const p = StrengthInterpreter.interpret(StrengthLevel.VERY_STRONG).personality;
    expect(p.some(t => t.includes('주관') || t.includes('고집'))).toBe(true);
  });

  it('VERY_STRONG advice mentions 관성, 재성, or 조절', () => {
    const a = StrengthInterpreter.interpret(StrengthLevel.VERY_STRONG).advice;
    expect(a.includes('관성') || a.includes('재성') || a.includes('조절')).toBe(true);
  });

  it('STRONG summary contains 신강', () => {
    expect(StrengthInterpreter.interpret(StrengthLevel.STRONG).summary).toContain('신강');
  });

  it('STRONG personality mentions 리더십 or 주도', () => {
    const p = StrengthInterpreter.interpret(StrengthLevel.STRONG).personality;
    expect(p.some(t => t.includes('리더십') || t.includes('주도'))).toBe(true);
  });

  it('SLIGHTLY_STRONG summary contains 중강', () => {
    expect(StrengthInterpreter.interpret(StrengthLevel.SLIGHTLY_STRONG).summary).toContain('중강');
  });

  it('SLIGHTLY_STRONG personality mentions 균형 or 유연', () => {
    const p = StrengthInterpreter.interpret(StrengthLevel.SLIGHTLY_STRONG).personality;
    expect(p.some(t => t.includes('균형') || t.includes('유연'))).toBe(true);
  });

  it('SLIGHTLY_WEAK summary contains 중약', () => {
    expect(StrengthInterpreter.interpret(StrengthLevel.SLIGHTLY_WEAK).summary).toContain('중약');
  });

  it('SLIGHTLY_WEAK personality mentions 배려 or 협력', () => {
    const p = StrengthInterpreter.interpret(StrengthLevel.SLIGHTLY_WEAK).personality;
    expect(p.some(t => t.includes('배려') || t.includes('협력'))).toBe(true);
  });

  it('WEAK summary contains 신약', () => {
    expect(StrengthInterpreter.interpret(StrengthLevel.WEAK).summary).toContain('신약');
  });

  it('WEAK advice mentions 인성 or 비겁', () => {
    const a = StrengthInterpreter.interpret(StrengthLevel.WEAK).advice;
    expect(a.includes('인성') || a.includes('비겁')).toBe(true);
  });

  it('VERY_WEAK summary contains 극신약', () => {
    expect(StrengthInterpreter.interpret(StrengthLevel.VERY_WEAK).summary).toContain('극신약');
  });

  it('VERY_WEAK personality mentions 의존 or 불안', () => {
    const p = StrengthInterpreter.interpret(StrengthLevel.VERY_WEAK).personality;
    expect(p.some(t => t.includes('의존') || t.includes('불안'))).toBe(true);
  });

  it('VERY_WEAK advice mentions both 인성 and 비겁', () => {
    const a = StrengthInterpreter.interpret(StrengthLevel.VERY_WEAK).advice;
    expect(a.includes('인성') && a.includes('비겁')).toBe(true);
  });

  // -- isStrongSide consistency --

  it('strong-side levels return true', () => {
    expect(isStrongSide(StrengthLevel.VERY_STRONG)).toBe(true);
    expect(isStrongSide(StrengthLevel.STRONG)).toBe(true);
    expect(isStrongSide(StrengthLevel.SLIGHTLY_STRONG)).toBe(true);
  });

  it('weak-side levels return false', () => {
    expect(isStrongSide(StrengthLevel.SLIGHTLY_WEAK)).toBe(false);
    expect(isStrongSide(StrengthLevel.WEAK)).toBe(false);
    expect(isStrongSide(StrengthLevel.VERY_WEAK)).toBe(false);
  });

  // -- Completeness guards --

  it('all 6 levels have distinct summaries', () => {
    const summaries = new Set(ALL_LEVELS.map(l => StrengthInterpreter.interpret(l).summary));
    expect(summaries.size).toBe(6);
  });
});
