import { describe, it, expect } from 'vitest';
import { IljuInterpreter } from '../../src/interpretation/IljuInterpreter.js';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { Cheongan, CHEONGAN_INFO } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_INFO } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';

/**
 * Ported from IljuInterpreterTest.kt
 *
 * Tests for all 60 valid sexagenary combinations and specific nickname checks.
 */

describe('IljuInterpreter', () => {
  // -- Completeness: 60 valid combinations --

  it('all 60 valid sexagenary combinations return non-null', () => {
    for (let i = 0; i < 60; i++) {
      const pillar = GanjiCycle.fromSexagenaryIndex(i);
      const result = IljuInterpreter.interpret(pillar);
      expect(result, `Entry missing for index ${i}: ${pillar.cheongan}${pillar.jiji}`).toBeDefined();
    }
  });

  it('all 60 entries have non-blank fields', () => {
    for (let i = 0; i < 60; i++) {
      const pillar = GanjiCycle.fromSexagenaryIndex(i);
      const result = IljuInterpreter.interpret(pillar);
      const ci = CHEONGAN_INFO[pillar.cheongan];
      const ji = JIJI_INFO[pillar.jiji];
      const label = `${ci.hangul}${ji.hangul}`;
      expect(result.nickname.trim().length, `nickname blank for ${label}`).toBeGreaterThan(0);
      expect(result.personality.trim().length, `personality blank for ${label}`).toBeGreaterThan(0);
      expect(result.relationships.trim().length, `relationships blank for ${label}`).toBeGreaterThan(0);
      expect(result.career.trim().length, `career blank for ${label}`).toBeGreaterThan(0);
      expect(result.health.trim().length, `health blank for ${label}`).toBeGreaterThan(0);
      expect(result.lifePath.trim().length, `lifePath blank for ${label}`).toBeGreaterThan(0);
    }
  });

  it('all 60 entries have matching pillar', () => {
    for (let i = 0; i < 60; i++) {
      const pillar = GanjiCycle.fromSexagenaryIndex(i);
      const result = IljuInterpreter.interpret(pillar);
      expect(result.pillar.cheongan).toBe(pillar.cheongan);
      expect(result.pillar.jiji).toBe(pillar.jiji);
    }
  });

  // -- Invalid combination --

  it('invalid combination GAP+CHUK throws', () => {
    const invalid = new Pillar(Cheongan.GAP, Jiji.CHUK);
    expect(() => IljuInterpreter.interpret(invalid)).toThrow();
  });

  it('invalid combination EUL+JA throws', () => {
    const invalid = new Pillar(Cheongan.EUL, Jiji.JA);
    expect(() => IljuInterpreter.interpret(invalid)).toThrow();
  });

  // -- Specific nickname checks --

  it('갑자 nickname is correct', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.GAP, Jiji.JA));
    expect(result.nickname).toBe('밤바다의 거목');
  });

  it('병오 nickname is correct', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.BYEONG, Jiji.O));
    expect(result.nickname).toBe('한낮의 태양');
  });

  it('정해 nickname is correct', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.JEONG, Jiji.HAE));
    expect(result.nickname).toBe('깊은 밤 바다의 등대');
  });

  it('경자 nickname is correct', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.GYEONG, Jiji.JA));
    expect(result.nickname).toBe('차가운 겨울밤의 쇠');
  });

  it('임인 nickname is correct', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.IM, Jiji.IN));
    expect(result.nickname).toBe('봄 숲의 큰 강');
  });

  // -- Personality keyword checks --

  it('GAP pillar personality mentions 나무', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.GAP, Jiji.JA));
    expect(result.personality).toContain('나무');
  });

  it('BYEONG pillar personality mentions 태양', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.BYEONG, Jiji.O));
    expect(result.personality).toContain('태양');
  });

  it('IM pillar personality mentions 바다', () => {
    const result = IljuInterpreter.interpret(new Pillar(Cheongan.IM, Jiji.JA));
    expect(result.personality).toContain('바다');
  });
});
