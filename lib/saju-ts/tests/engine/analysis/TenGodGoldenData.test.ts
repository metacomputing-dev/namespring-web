import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Sipseong, SIPSEONG_VALUES } from '../../../src/domain/Sipseong.js';
import { TenGodCalculator } from '../../../src/engine/analysis/TenGodCalculator.js';

/**
 * Ported from TenGodGoldenDataTest.kt.
 *
 * CC-N1: 100-combination hardcoded golden data from classical references
 * (Jaepyeongjinjeon + Yeonhaejaepyeong).
 *
 * Each row = day master, each column = target stem.
 * Order: GAP, EUL, BYEONG, JEONG, MU, GI, GYEONG, SIN, IM, GYE
 */

const goldenMatrix: Map<Cheongan, [Cheongan, Sipseong][]> = new Map([
  // GAP (yang wood)
  [Cheongan.GAP, [
    [Cheongan.GAP,    Sipseong.BI_GYEON],
    [Cheongan.EUL,    Sipseong.GYEOB_JAE],
    [Cheongan.BYEONG, Sipseong.SIK_SIN],
    [Cheongan.JEONG,  Sipseong.SANG_GWAN],
    [Cheongan.MU,     Sipseong.PYEON_JAE],
    [Cheongan.GI,     Sipseong.JEONG_JAE],
    [Cheongan.GYEONG, Sipseong.PYEON_GWAN],
    [Cheongan.SIN,    Sipseong.JEONG_GWAN],
    [Cheongan.IM,     Sipseong.PYEON_IN],
    [Cheongan.GYE,    Sipseong.JEONG_IN],
  ]],
  // EUL (yin wood)
  [Cheongan.EUL, [
    [Cheongan.GAP,    Sipseong.GYEOB_JAE],
    [Cheongan.EUL,    Sipseong.BI_GYEON],
    [Cheongan.BYEONG, Sipseong.SANG_GWAN],
    [Cheongan.JEONG,  Sipseong.SIK_SIN],
    [Cheongan.MU,     Sipseong.JEONG_JAE],
    [Cheongan.GI,     Sipseong.PYEON_JAE],
    [Cheongan.GYEONG, Sipseong.JEONG_GWAN],
    [Cheongan.SIN,    Sipseong.PYEON_GWAN],
    [Cheongan.IM,     Sipseong.JEONG_IN],
    [Cheongan.GYE,    Sipseong.PYEON_IN],
  ]],
  // BYEONG (yang fire)
  [Cheongan.BYEONG, [
    [Cheongan.GAP,    Sipseong.PYEON_IN],
    [Cheongan.EUL,    Sipseong.JEONG_IN],
    [Cheongan.BYEONG, Sipseong.BI_GYEON],
    [Cheongan.JEONG,  Sipseong.GYEOB_JAE],
    [Cheongan.MU,     Sipseong.SIK_SIN],
    [Cheongan.GI,     Sipseong.SANG_GWAN],
    [Cheongan.GYEONG, Sipseong.PYEON_JAE],
    [Cheongan.SIN,    Sipseong.JEONG_JAE],
    [Cheongan.IM,     Sipseong.PYEON_GWAN],
    [Cheongan.GYE,    Sipseong.JEONG_GWAN],
  ]],
  // JEONG (yin fire)
  [Cheongan.JEONG, [
    [Cheongan.GAP,    Sipseong.JEONG_IN],
    [Cheongan.EUL,    Sipseong.PYEON_IN],
    [Cheongan.BYEONG, Sipseong.GYEOB_JAE],
    [Cheongan.JEONG,  Sipseong.BI_GYEON],
    [Cheongan.MU,     Sipseong.SANG_GWAN],
    [Cheongan.GI,     Sipseong.SIK_SIN],
    [Cheongan.GYEONG, Sipseong.JEONG_JAE],
    [Cheongan.SIN,    Sipseong.PYEON_JAE],
    [Cheongan.IM,     Sipseong.JEONG_GWAN],
    [Cheongan.GYE,    Sipseong.PYEON_GWAN],
  ]],
  // MU (yang earth)
  [Cheongan.MU, [
    [Cheongan.GAP,    Sipseong.PYEON_GWAN],
    [Cheongan.EUL,    Sipseong.JEONG_GWAN],
    [Cheongan.BYEONG, Sipseong.PYEON_IN],
    [Cheongan.JEONG,  Sipseong.JEONG_IN],
    [Cheongan.MU,     Sipseong.BI_GYEON],
    [Cheongan.GI,     Sipseong.GYEOB_JAE],
    [Cheongan.GYEONG, Sipseong.SIK_SIN],
    [Cheongan.SIN,    Sipseong.SANG_GWAN],
    [Cheongan.IM,     Sipseong.PYEON_JAE],
    [Cheongan.GYE,    Sipseong.JEONG_JAE],
  ]],
  // GI (yin earth)
  [Cheongan.GI, [
    [Cheongan.GAP,    Sipseong.JEONG_GWAN],
    [Cheongan.EUL,    Sipseong.PYEON_GWAN],
    [Cheongan.BYEONG, Sipseong.JEONG_IN],
    [Cheongan.JEONG,  Sipseong.PYEON_IN],
    [Cheongan.MU,     Sipseong.GYEOB_JAE],
    [Cheongan.GI,     Sipseong.BI_GYEON],
    [Cheongan.GYEONG, Sipseong.SANG_GWAN],
    [Cheongan.SIN,    Sipseong.SIK_SIN],
    [Cheongan.IM,     Sipseong.JEONG_JAE],
    [Cheongan.GYE,    Sipseong.PYEON_JAE],
  ]],
  // GYEONG (yang metal)
  [Cheongan.GYEONG, [
    [Cheongan.GAP,    Sipseong.PYEON_JAE],
    [Cheongan.EUL,    Sipseong.JEONG_JAE],
    [Cheongan.BYEONG, Sipseong.PYEON_GWAN],
    [Cheongan.JEONG,  Sipseong.JEONG_GWAN],
    [Cheongan.MU,     Sipseong.PYEON_IN],
    [Cheongan.GI,     Sipseong.JEONG_IN],
    [Cheongan.GYEONG, Sipseong.BI_GYEON],
    [Cheongan.SIN,    Sipseong.GYEOB_JAE],
    [Cheongan.IM,     Sipseong.SIK_SIN],
    [Cheongan.GYE,    Sipseong.SANG_GWAN],
  ]],
  // SIN (yin metal)
  [Cheongan.SIN, [
    [Cheongan.GAP,    Sipseong.JEONG_JAE],
    [Cheongan.EUL,    Sipseong.PYEON_JAE],
    [Cheongan.BYEONG, Sipseong.JEONG_GWAN],
    [Cheongan.JEONG,  Sipseong.PYEON_GWAN],
    [Cheongan.MU,     Sipseong.JEONG_IN],
    [Cheongan.GI,     Sipseong.PYEON_IN],
    [Cheongan.GYEONG, Sipseong.GYEOB_JAE],
    [Cheongan.SIN,    Sipseong.BI_GYEON],
    [Cheongan.IM,     Sipseong.SANG_GWAN],
    [Cheongan.GYE,    Sipseong.SIK_SIN],
  ]],
  // IM (yang water)
  [Cheongan.IM, [
    [Cheongan.GAP,    Sipseong.SIK_SIN],
    [Cheongan.EUL,    Sipseong.SANG_GWAN],
    [Cheongan.BYEONG, Sipseong.PYEON_JAE],
    [Cheongan.JEONG,  Sipseong.JEONG_JAE],
    [Cheongan.MU,     Sipseong.PYEON_GWAN],
    [Cheongan.GI,     Sipseong.JEONG_GWAN],
    [Cheongan.GYEONG, Sipseong.PYEON_IN],
    [Cheongan.SIN,    Sipseong.JEONG_IN],
    [Cheongan.IM,     Sipseong.BI_GYEON],
    [Cheongan.GYE,    Sipseong.GYEOB_JAE],
  ]],
  // GYE (yin water)
  [Cheongan.GYE, [
    [Cheongan.GAP,    Sipseong.SANG_GWAN],
    [Cheongan.EUL,    Sipseong.SIK_SIN],
    [Cheongan.BYEONG, Sipseong.JEONG_JAE],
    [Cheongan.JEONG,  Sipseong.PYEON_JAE],
    [Cheongan.MU,     Sipseong.JEONG_GWAN],
    [Cheongan.GI,     Sipseong.PYEON_GWAN],
    [Cheongan.GYEONG, Sipseong.JEONG_IN],
    [Cheongan.SIN,    Sipseong.PYEON_IN],
    [Cheongan.IM,     Sipseong.GYEOB_JAE],
    [Cheongan.GYE,    Sipseong.BI_GYEON],
  ]],
]);

describe('TenGodGoldenData', () => {
  it('all 100 combinations match hardcoded golden data from classical references', () => {
    let passed = 0;
    const failures: string[] = [];

    for (const [dayMaster, pairs] of goldenMatrix) {
      for (const [target, expected] of pairs) {
        const actual = TenGodCalculator.calculate(dayMaster, target);
        if (actual === expected) {
          passed++;
        } else {
          failures.push(
            `${dayMaster} vs ${target}: expected=${expected}, actual=${actual}`,
          );
        }
      }
    }

    expect(passed + failures.length).toBe(100);
    expect(failures).toEqual([]);
  });

  it('golden matrix covers all 10 day masters', () => {
    expect(goldenMatrix.size).toBe(10);
    for (const stem of CHEONGAN_VALUES) {
      expect(goldenMatrix.has(stem)).toBe(true);
    }
  });

  it('golden matrix covers all 10 targets per day master', () => {
    for (const [dayMaster, pairs] of goldenMatrix) {
      expect(pairs.length).toBe(10);
      const targets = new Set(pairs.map(([t]) => t));
      expect(targets).toEqual(new Set(CHEONGAN_VALUES));
    }
  });

  it('diagonal entries are all BI_GYEON', () => {
    for (const stem of CHEONGAN_VALUES) {
      expect(TenGodCalculator.calculate(stem, stem)).toBe(Sipseong.BI_GYEON);
    }
  });

  it('each day master produces exactly all 10 sipseong types', () => {
    for (const dayMaster of CHEONGAN_VALUES) {
      const sipseongs = new Set(CHEONGAN_VALUES.map(t => TenGodCalculator.calculate(dayMaster, t)));
      expect(sipseongs).toEqual(new Set(SIPSEONG_VALUES));
    }
  });

  it('symmetry - control/generate pairs are symmetric', () => {
    for (const a of CHEONGAN_VALUES) {
      for (const b of CHEONGAN_VALUES) {
        const ab = TenGodCalculator.calculate(a, b);
        const ba = TenGodCalculator.calculate(b, a);

        switch (ab) {
          case Sipseong.PYEON_JAE:  expect(ba).toBe(Sipseong.PYEON_GWAN); break;
          case Sipseong.JEONG_JAE:  expect(ba).toBe(Sipseong.JEONG_GWAN); break;
          case Sipseong.PYEON_GWAN: expect(ba).toBe(Sipseong.PYEON_JAE); break;
          case Sipseong.JEONG_GWAN: expect(ba).toBe(Sipseong.JEONG_JAE); break;
          case Sipseong.SIK_SIN:    expect(ba).toBe(Sipseong.PYEON_IN); break;
          case Sipseong.SANG_GWAN:  expect(ba).toBe(Sipseong.JEONG_IN); break;
          case Sipseong.PYEON_IN:   expect(ba).toBe(Sipseong.SIK_SIN); break;
          case Sipseong.JEONG_IN:   expect(ba).toBe(Sipseong.SANG_GWAN); break;
          case Sipseong.BI_GYEON:   expect(ba).toBe(Sipseong.BI_GYEON); break;
          case Sipseong.GYEOB_JAE:  expect(ba).toBe(Sipseong.GYEOB_JAE); break;
        }
      }
    }
  });
});
