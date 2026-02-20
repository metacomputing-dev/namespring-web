import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../src/domain/Jiji.js';
import {
  HiddenStemTable,
  HiddenStemVariant,
  HiddenStemDayAllocation,
  HiddenStemRole,
} from '../../src/domain/HiddenStem.js';

/**
 * Ported from HiddenStemTableTest.kt
 */

// ======================================================================
// 연해자평 (YEONHAE_JAPYEONG)
// ======================================================================
describe('YEONHAE_JAPYEONG', () => {
  it('all standard branches have 30 days', () => {
    for (const branch of JIJI_VALUES) {
      const sum = HiddenStemTable.getHiddenStems(branch).reduce((s, e) => s + e.days, 0);
      expect(sum).toBe(30);
    }
  });

  it('NO_RESIDUAL_EARTH removes MU from four corner branches', () => {
    const corners = [Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.HAE];
    for (const branch of corners) {
      const stems = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.NO_RESIDUAL_EARTH);
      const hasMuYeogi = stems.some(s => s.role === HiddenStemRole.YEOGI && s.stem === Cheongan.MU);
      expect(hasMuYeogi).toBe(false);
    }
  });

  it('principal stem is always JEONGGI', () => {
    for (const branch of JIJI_VALUES) {
      const principal = HiddenStemTable.getPrincipalStem(branch);
      const jeonggi = HiddenStemTable.getHiddenStems(branch).find(s => s.role === HiddenStemRole.JEONGGI)!;
      expect(principal).toBe(jeonggi.stem);
    }
  });

  it('standard HAE includes residual MU', () => {
    const haes = HiddenStemTable.getHiddenStems(Jiji.HAE);
    const muYeogi = haes.some(s => s.role === HiddenStemRole.YEOGI && s.stem === Cheongan.MU && s.days === 7);
    expect(muYeogi).toBe(true);
  });
});

// ======================================================================
// 삼명통회 (SAMMYEONG_TONGHOE)
// ======================================================================
const ST = HiddenStemDayAllocation.SAMMYEONG_TONGHOE;

describe('SAMMYEONG_TONGHOE', () => {
  it('all branches have 30 days', () => {
    for (const branch of JIJI_VALUES) {
      const sum = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
        .reduce((s, e) => s + e.days, 0);
      expect(sum).toBe(30);
    }
  });

  it('principal stem is always JEONGGI', () => {
    for (const branch of JIJI_VALUES) {
      const principal = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, ST);
      const jeonggi = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
        .find(s => s.role === HiddenStemRole.JEONGGI)!;
      expect(principal).toBe(jeonggi.stem);
    }
  });

  it('every branch has JEONGGI', () => {
    for (const branch of JIJI_VALUES) {
      const stems = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST);
      expect(stems.some(s => s.role === HiddenStemRole.JEONGGI)).toBe(true);
    }
  });

  // 왕지: 여기7 + 정기23
  it('JA has 2 stems (왕지 pattern)', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.JA, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(2);
    expect(stems[0]!.stem).toBe(Cheongan.IM);
    expect(stems[0]!.days).toBe(7);
    expect(stems[0]!.role).toBe(HiddenStemRole.YEOGI);
    expect(stems[1]!.stem).toBe(Cheongan.GYE);
    expect(stems[1]!.days).toBe(23);
    expect(stems[1]!.role).toBe(HiddenStemRole.JEONGGI);
  });

  it('MYO has 2 stems', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.MYO, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(2);
    expect(stems[0]!.stem).toBe(Cheongan.GAP);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.stem).toBe(Cheongan.EUL);
    expect(stems[1]!.days).toBe(23);
  });

  it('O has 2 stems (no GI)', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.O, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(2);
    expect(stems[0]!.stem).toBe(Cheongan.BYEONG);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.stem).toBe(Cheongan.JEONG);
    expect(stems[1]!.days).toBe(23);
    expect(stems.some(s => s.stem === Cheongan.GI)).toBe(false);
  });

  it('YU has 2 stems', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.YU, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(2);
    expect(stems[0]!.stem).toBe(Cheongan.GYEONG);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.stem).toBe(Cheongan.SIN);
    expect(stems[1]!.days).toBe(23);
  });

  // 생지: 여기5 + 중기5 + 정기20
  it('IN has 5+5+20 day pattern', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.IN, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(5);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(20);
    expect(stems[0]!.stem).toBe(Cheongan.MU);
    expect(stems[1]!.stem).toBe(Cheongan.BYEONG);
    expect(stems[2]!.stem).toBe(Cheongan.GAP);
  });

  it('SIN has 5+5+20 with GI yeogi', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.SIN, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(5);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(20);
    expect(stems[0]!.stem).toBe(Cheongan.GI);
    expect(stems[1]!.stem).toBe(Cheongan.IM);
    expect(stems[2]!.stem).toBe(Cheongan.GYEONG);
  });

  it('HAE has 5+5+20 day pattern', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.HAE, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(5);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(20);
    expect(stems[0]!.stem).toBe(Cheongan.MU);
    expect(stems[1]!.stem).toBe(Cheongan.GAP);
    expect(stems[2]!.stem).toBe(Cheongan.IM);
  });

  // 巳 예외: 7+5+18
  it('SA has 7+5+18 day pattern', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.SA, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(18);
    expect(stems[0]!.stem).toBe(Cheongan.MU);
    expect(stems[1]!.stem).toBe(Cheongan.GYEONG);
    expect(stems[2]!.stem).toBe(Cheongan.BYEONG);
  });

  // 고지 중기 = 양간
  it('JIN has yang water (壬) junggi', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.JIN, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(18);
    expect(stems[1]!.stem).toBe(Cheongan.IM);
  });

  it('SUL has yang fire (丙) junggi', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.SUL, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(18);
    expect(stems[1]!.stem).toBe(Cheongan.BYEONG);
  });

  it('CHUK has yang metal (庚) junggi', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.CHUK, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(18);
    expect(stems[1]!.stem).toBe(Cheongan.GYEONG);
  });

  it('MI has yang wood (甲) junggi', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.MI, HiddenStemVariant.STANDARD, ST);
    expect(stems).toHaveLength(3);
    expect(stems[0]!.days).toBe(7);
    expect(stems[1]!.days).toBe(5);
    expect(stems[2]!.days).toBe(18);
    expect(stems[1]!.stem).toBe(Cheongan.GAP);
  });
});

// ======================================================================
// 정기(正氣) 동일성 확인
// ======================================================================
describe('Principal stem cross-check', () => {
  it('SAMMYEONG and YEONHAE share the same principal stems', () => {
    for (const branch of JIJI_VALUES) {
      const std = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, HiddenStemDayAllocation.YEONHAE_JAPYEONG);
      const st = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, HiddenStemDayAllocation.SAMMYEONG_TONGHOE);
      expect(st).toBe(std);
    }
  });
});

// ======================================================================
// 삼명통회 + NO_RESIDUAL_EARTH
// ======================================================================
describe('SAMMYEONG + NO_RESIDUAL_EARTH', () => {
  it('removes MU from IN, SA, HAE', () => {
    for (const branch of [Jiji.IN, Jiji.SA, Jiji.HAE]) {
      const stems = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.NO_RESIDUAL_EARTH, ST);
      const hasMuYeogi = stems.some(s => s.role === HiddenStemRole.YEOGI && s.stem === Cheongan.MU);
      expect(hasMuYeogi).toBe(false);
    }
  });

  it('keeps GI in SIN', () => {
    const stems = HiddenStemTable.getHiddenStems(Jiji.SIN, HiddenStemVariant.NO_RESIDUAL_EARTH, ST);
    const hasGiYeogi = stems.some(s => s.role === HiddenStemRole.YEOGI && s.stem === Cheongan.GI);
    expect(hasGiYeogi).toBe(true);
  });
});

// ======================================================================
// Default allocation
// ======================================================================
describe('Default allocation', () => {
  it('default is YEONHAE_JAPYEONG', () => {
    for (const branch of JIJI_VALUES) {
      const defaultStems = HiddenStemTable.getHiddenStems(branch);
      const explicit = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, HiddenStemDayAllocation.YEONHAE_JAPYEONG);
      expect(defaultStems).toEqual(explicit);
    }
  });
});
