import { describe, it, expect } from 'vitest';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { IljuInterpreter } from '../../src/interpretation/IljuInterpreter.js';
import { Cheongan, CHEONGAN_INFO } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_INFO } from '../../src/domain/Jiji.js';
import { Pillar } from '../../src/domain/Pillar.js';

/**
 * Ilju (day pillar) sexagenary readiness test.
 *
 * Verifies:
 * 1. The 60 sexagenary cycle is stable and produces unique entries.
 * 2. IljuInterpreter covers all 60 valid day pillars with non-blank fields.
 * 3. Invalid pillar combinations are rejected.
 */
describe('IljuSexagenaryReadiness', () => {

  describe('sexagenary cycle snapshot', () => {
    it('has exactly 60 entries', () => {
      const cycle = Array.from({ length: 60 }, (_, i) => GanjiCycle.fromSexagenaryIndex(i));
      expect(cycle.length).toBe(60);
    });

    it('all 60 entries are unique', () => {
      const cycle = Array.from({ length: 60 }, (_, i) => {
        const p = GanjiCycle.fromSexagenaryIndex(i);
        return `${p.cheongan}-${p.jiji}`;
      });
      const unique = new Set(cycle);
      expect(unique.size).toBe(60);
    });

    it('cycle wraps at 60', () => {
      const p0 = GanjiCycle.fromSexagenaryIndex(0);
      const p60 = GanjiCycle.fromSexagenaryIndex(60);
      expect(p0.cheongan).toBe(p60.cheongan);
      expect(p0.jiji).toBe(p60.jiji);
    });

    it('first pillar is GAP-JA', () => {
      const p = GanjiCycle.fromSexagenaryIndex(0);
      expect(p.cheongan).toBe(Cheongan.GAP);
      expect(p.jiji).toBe(Jiji.JA);
    });
  });

  describe('IljuInterpreter coverage for all 60 valid pillars', () => {
    const validPillars = Array.from({ length: 60 }, (_, i) => GanjiCycle.fromSexagenaryIndex(i));

    for (const pillar of validPillars) {
      const label = `${CHEONGAN_INFO[pillar.cheongan].hangul}${JIJI_INFO[pillar.jiji].hangul}`;

      it(`${label}: interpret returns non-null`, () => {
        const result = IljuInterpreter.interpret(pillar);
        expect(result).toBeDefined();
      });

      it(`${label}: nickname is non-blank`, () => {
        const result = IljuInterpreter.interpret(pillar);
        expect(result.nickname.length).toBeGreaterThan(0);
      });

      it(`${label}: personality is non-blank`, () => {
        const result = IljuInterpreter.interpret(pillar);
        expect(result.personality.length).toBeGreaterThan(0);
      });

      it(`${label}: relationships is non-blank`, () => {
        const result = IljuInterpreter.interpret(pillar);
        expect(result.relationships.length).toBeGreaterThan(0);
      });

      it(`${label}: career is non-blank`, () => {
        const result = IljuInterpreter.interpret(pillar);
        expect(result.career.length).toBeGreaterThan(0);
      });

      it(`${label}: health is non-blank`, () => {
        const result = IljuInterpreter.interpret(pillar);
        expect(result.health.length).toBeGreaterThan(0);
      });

      it(`${label}: lifePath is non-blank`, () => {
        const result = IljuInterpreter.interpret(pillar);
        expect(result.lifePath.length).toBeGreaterThan(0);
      });
    }
  });

  describe('invalid pillar rejection', () => {
    it('throws for an invalid day pillar (GAP-CHUK)', () => {
      // GAP-CHUK is index 1 mod 12 for branch and 0 mod 10 for stem,
      // but 0 mod 10 = GAP and 1 mod 12 = CHUK only line up at index 1
      // Actually, let's find a truly invalid combination.
      // In the 60-cycle, stem index and branch index must have the same parity.
      // GAP (index 0, even) + CHUK (index 1, odd) = different parity = invalid
      const invalidPillar = new Pillar(Cheongan.GAP, Jiji.CHUK);
      expect(() => IljuInterpreter.interpret(invalidPillar)).toThrow();
    });

    it('throws for an invalid day pillar (EUL-JIN)', () => {
      // EUL (index 1, odd) + JIN (index 4, even) = different parity = invalid
      const invalidPillar = new Pillar(Cheongan.EUL, Jiji.JIN);
      expect(() => IljuInterpreter.interpret(invalidPillar)).toThrow();
    });
  });
});
