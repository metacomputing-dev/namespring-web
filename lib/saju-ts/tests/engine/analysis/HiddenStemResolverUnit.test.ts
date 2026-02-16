/**
 * CX-P3-1: HiddenStemResolver unit tests.
 *
 * DefaultHiddenStemResolver's public API is independently verified.
 * Tests cover: resolve(), principalStem(), branch categories (wangji/saengji/goji),
 * NO_RESIDUAL_EARTH variant, allocation comparison, and well-known principal stems.
 */
import { describe, it, expect } from 'vitest';

import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../../src/domain/Jiji.js';
import {
  HiddenStemDayAllocation,
  HiddenStemRole,
  HiddenStemVariant,
} from '../../../src/domain/HiddenStem.js';
import { DefaultHiddenStemResolver } from '../../../src/engine/analysis/HiddenStemResolver.js';

const resolver = new DefaultHiddenStemResolver();
const YH = HiddenStemDayAllocation.YEONHAE_JAPYEONG;
const ST = HiddenStemDayAllocation.SAMMYEONG_TONGHOE;

describe('HiddenStemResolver unit tests (CX-P3-1)', () => {
  // -- resolve() basic behavior --

  describe('resolve() basic behavior', () => {
    it('every branch resolves to 1-3 hidden stems', () => {
      for (const branch of JIJI_VALUES) {
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        expect(stems.length).toBeGreaterThanOrEqual(1);
        expect(stems.length).toBeLessThanOrEqual(3);
      }
    });

    it('resolve always includes exactly one JEONGGI role', () => {
      for (const branch of JIJI_VALUES) {
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        const jeonggiCount = stems.filter(e => e.role === HiddenStemRole.JEONGGI).length;
        expect(jeonggiCount).toBe(1);
      }
    });

    it('hidden stem days sum to 30 for standard variant', () => {
      for (const branch of JIJI_VALUES) {
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        const totalDays = stems.reduce((acc, e) => acc + e.days, 0);
        expect(totalDays).toBe(30);
      }
    });
  });

  // -- principalStem() consistency --

  describe('principalStem() consistency', () => {
    it('principalStem matches JEONGGI from resolve', () => {
      for (const branch of JIJI_VALUES) {
        const principal = resolver.principalStem(branch, HiddenStemVariant.STANDARD, YH);
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        const jeonggi = stems.find(e => e.role === HiddenStemRole.JEONGGI)!;
        expect(principal).toBe(jeonggi.stem);
      }
    });
  });

  // -- wangji characteristics --

  describe('wangji (旺地) characteristics', () => {
    it('wangji branches have 2 hidden stems except O which has 3', () => {
      const wangji2 = [Jiji.JA, Jiji.MYO, Jiji.YU];
      for (const branch of wangji2) {
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        expect(stems.length).toBe(2);
      }
      // O exception
      const oStems = resolver.resolve(Jiji.O, HiddenStemVariant.STANDARD, YH);
      expect(oStems.length).toBe(3);
    });
  });

  // -- saengji characteristics --

  describe('saengji (生地) characteristics', () => {
    it('saengji branches have exactly 3 hidden stems', () => {
      const saengji = [Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.HAE];
      for (const branch of saengji) {
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        expect(stems.length).toBe(3);
      }
    });
  });

  // -- goji characteristics --

  describe('goji (庫地) characteristics', () => {
    it('goji branches have exactly 3 hidden stems', () => {
      const goji = [Jiji.JIN, Jiji.MI, Jiji.SUL, Jiji.CHUK];
      for (const branch of goji) {
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        expect(stems.length).toBe(3);
      }
    });
  });

  // -- NO_RESIDUAL_EARTH variant --

  describe('NO_RESIDUAL_EARTH variant', () => {
    it('reduces earth element in saengji', () => {
      const saengji = [Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.HAE];
      for (const branch of saengji) {
        const standard = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        const noEarth = resolver.resolve(branch, HiddenStemVariant.NO_RESIDUAL_EARTH, YH);

        const standardHasMuYeogi = standard.some(
          e => e.stem === Cheongan.MU && e.role === HiddenStemRole.YEOGI,
        );
        if (standardHasMuYeogi) {
          const noEarthHasMuYeogi = noEarth.some(
            e => e.stem === Cheongan.MU && e.role === HiddenStemRole.YEOGI,
          );
          expect(noEarthHasMuYeogi).toBe(false);
        }
      }
    });
  });

  // -- Allocation comparison --

  describe('allocation comparison', () => {
    it('sammyeong allocation produces different day counts for saengji', () => {
      const branch = Jiji.IN;
      const yeonhae = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
      const sammyeong = resolver.resolve(branch, HiddenStemVariant.STANDARD, ST);

      const yeonhaeDays = yeonhae.map(e => e.days);
      const sammyeongDays = sammyeong.map(e => e.days);
      const same = yeonhaeDays.length === sammyeongDays.length &&
        yeonhaeDays.every((d, i) => d === sammyeongDays[i]);
      expect(same).toBe(false);
    });

    it('sammyeong allocation also sums to 30', () => {
      for (const branch of JIJI_VALUES) {
        const stems = resolver.resolve(branch, HiddenStemVariant.STANDARD, ST);
        const totalDays = stems.reduce((acc, e) => acc + e.days, 0);
        expect(totalDays).toBe(30);
      }
    });
  });

  // -- Well-known principal stems --

  describe('well-known principal stems', () => {
    it('well-known principal stems are correct', () => {
      const expected: Record<Jiji, Cheongan> = {
        [Jiji.JA]: Cheongan.GYE,
        [Jiji.CHUK]: Cheongan.GI,
        [Jiji.IN]: Cheongan.GAP,
        [Jiji.MYO]: Cheongan.EUL,
        [Jiji.JIN]: Cheongan.MU,
        [Jiji.SA]: Cheongan.BYEONG,
        [Jiji.O]: Cheongan.JEONG,
        [Jiji.MI]: Cheongan.GI,
        [Jiji.SIN]: Cheongan.GYEONG,
        [Jiji.YU]: Cheongan.SIN,
        [Jiji.SUL]: Cheongan.MU,
        [Jiji.HAE]: Cheongan.IM,
      };
      for (const branch of JIJI_VALUES) {
        const actual = resolver.principalStem(branch, HiddenStemVariant.STANDARD, YH);
        expect(actual).toBe(expected[branch]);
      }
    });
  });
});
