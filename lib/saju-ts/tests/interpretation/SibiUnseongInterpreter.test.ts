import { describe, it, expect } from 'vitest';
import { SibiUnseongInterpreter } from '../../src/interpretation/SibiUnseongInterpreter.js';
import { SibiUnseong, SIBI_UNSEONG_VALUES } from '../../src/domain/SibiUnseong.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../src/domain/PillarPosition.js';

/**
 * Ported from SibiUnseongInterpreterTest.kt
 *
 * 12 x 4 = 48 entries: existence, non-blank fields, valid energy, energy semantics.
 */

const VALID_ENERGIES = new Set(['상승', '정점', '하강', '잠재']);

describe('SibiUnseongInterpreter', () => {
  const allCombinations: [SibiUnseong, PillarPosition][] = [];
  for (const s of SIBI_UNSEONG_VALUES) {
    for (const p of PILLAR_POSITION_VALUES) {
      allCombinations.push([s, p]);
    }
  }

  it('has exactly 48 entries (12 x 4)', () => {
    expect(allCombinations).toHaveLength(48);
  });

  it('all 48 entries exist without throwing', () => {
    const failures: string[] = [];
    for (const [stage, position] of allCombinations) {
      try {
        SibiUnseongInterpreter.interpret(stage, position);
      } catch (e) {
        failures.push(`${stage}+${position}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('all 48 entries have non-blank keyword', () => {
    for (const [stage, position] of allCombinations) {
      const interp = SibiUnseongInterpreter.interpret(stage, position);
      expect(interp.keyword.trim().length, `${stage}+${position} keyword`).toBeGreaterThan(0);
    }
  });

  it('all 48 entries have non-blank description', () => {
    for (const [stage, position] of allCombinations) {
      const interp = SibiUnseongInterpreter.interpret(stage, position);
      expect(interp.description.trim().length, `${stage}+${position} description`).toBeGreaterThan(0);
    }
  });

  it('all 48 entries have valid energy', () => {
    for (const [stage, position] of allCombinations) {
      const interp = SibiUnseongInterpreter.interpret(stage, position);
      expect(VALID_ENERGIES.has(interp.energy), `${stage}+${position} energy '${interp.energy}' is invalid`).toBe(true);
    }
  });

  it('stage and position match returned values', () => {
    for (const [stage, position] of allCombinations) {
      const interp = SibiUnseongInterpreter.interpret(stage, position);
      expect(interp.stage).toBe(stage);
      expect(interp.position).toBe(position);
    }
  });

  it('ascending stages (장생~관대) have ascending energy', () => {
    const ascendingStages = [
      SibiUnseong.JANG_SAENG,
      SibiUnseong.MOK_YOK,
      SibiUnseong.GWAN_DAE,
      SibiUnseong.GEON_ROK,
    ];
    for (const stage of ascendingStages) {
      const interp = SibiUnseongInterpreter.interpret(stage, PillarPosition.DAY);
      expect(['상승', '정점']).toContain(interp.energy);
    }
  });

  it('제왕 (JE_WANG) at DAY has peak energy', () => {
    const interp = SibiUnseongInterpreter.interpret(SibiUnseong.JE_WANG, PillarPosition.DAY);
    expect(interp.energy).toBe('정점');
  });

  it('descending stages (쇠~사) have descending or latent energy', () => {
    const descendingStages = [
      SibiUnseong.SWOE,
      SibiUnseong.BYEONG,
      SibiUnseong.SA,
    ];
    for (const stage of descendingStages) {
      const interp = SibiUnseongInterpreter.interpret(stage, PillarPosition.DAY);
      expect(['하강', '잠재']).toContain(interp.energy);
    }
  });
});
