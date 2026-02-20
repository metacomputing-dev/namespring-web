/**
 * Q-03: 지장간 3개 배분법 비교 테스트.
 *
 * 연해자평(淵海子平)과 삼명통회(三命通會) 두 배분법의 지장간(藏干)을
 * 체계적으로 비교 검증한다. 12지지를 3개 유형으로 분류하여 각 유형별
 * 기대되는 구조적 불변식(invariant)을 확인하고, 두 배분법 간 정확한
 * 차이점을 수학적으로 검증한다.
 */
import { describe, it, expect } from 'vitest';

import { Cheongan, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Eumyang } from '../../../src/domain/Eumyang.js';
import {
  HiddenStemDayAllocation,
  HiddenStemRole,
  HiddenStemTable,
  HiddenStemVariant,
} from '../../../src/domain/HiddenStem.js';
import { DefaultHiddenStemResolver } from '../../../src/engine/analysis/HiddenStemResolver.js';

const YH = HiddenStemDayAllocation.YEONHAE_JAPYEONG;
const ST = HiddenStemDayAllocation.SAMMYEONG_TONGHOE;
const ALL_ALLOCATIONS = [YH, ST];

const SAENGJI = [Jiji.IN, Jiji.SA, Jiji.SIN, Jiji.HAE];
const WANGJI = [Jiji.JA, Jiji.MYO, Jiji.O, Jiji.YU];
const GOJI = [Jiji.JIN, Jiji.MI, Jiji.SUL, Jiji.CHUK];

/** Classical principal stems -- universally agreed across all schools. */
const CLASSICAL_PRINCIPAL_STEMS: Record<Jiji, Cheongan> = {
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

/** 연해자평 complete stem identities. */
const YEONHAE_STEM_IDENTITIES: Record<Jiji, Cheongan[]> = {
  [Jiji.JA]: [Cheongan.IM, Cheongan.GYE],
  [Jiji.CHUK]: [Cheongan.GYE, Cheongan.SIN, Cheongan.GI],
  [Jiji.IN]: [Cheongan.MU, Cheongan.BYEONG, Cheongan.GAP],
  [Jiji.MYO]: [Cheongan.GAP, Cheongan.EUL],
  [Jiji.JIN]: [Cheongan.EUL, Cheongan.GYE, Cheongan.MU],
  [Jiji.SA]: [Cheongan.MU, Cheongan.GYEONG, Cheongan.BYEONG],
  [Jiji.O]: [Cheongan.BYEONG, Cheongan.GI, Cheongan.JEONG],
  [Jiji.MI]: [Cheongan.JEONG, Cheongan.EUL, Cheongan.GI],
  [Jiji.SIN]: [Cheongan.MU, Cheongan.IM, Cheongan.GYEONG],
  [Jiji.YU]: [Cheongan.GYEONG, Cheongan.SIN],
  [Jiji.SUL]: [Cheongan.SIN, Cheongan.JEONG, Cheongan.MU],
  [Jiji.HAE]: [Cheongan.MU, Cheongan.GAP, Cheongan.IM],
};

/** 삼명통회 complete stem identities. */
const SAMMYEONG_STEM_IDENTITIES: Record<Jiji, Cheongan[]> = {
  [Jiji.JA]: [Cheongan.IM, Cheongan.GYE],
  [Jiji.CHUK]: [Cheongan.GYE, Cheongan.GYEONG, Cheongan.GI],
  [Jiji.IN]: [Cheongan.MU, Cheongan.BYEONG, Cheongan.GAP],
  [Jiji.MYO]: [Cheongan.GAP, Cheongan.EUL],
  [Jiji.JIN]: [Cheongan.EUL, Cheongan.IM, Cheongan.MU],
  [Jiji.SA]: [Cheongan.MU, Cheongan.GYEONG, Cheongan.BYEONG],
  [Jiji.O]: [Cheongan.BYEONG, Cheongan.JEONG],
  [Jiji.MI]: [Cheongan.JEONG, Cheongan.GAP, Cheongan.GI],
  [Jiji.SIN]: [Cheongan.GI, Cheongan.IM, Cheongan.GYEONG],
  [Jiji.YU]: [Cheongan.GYEONG, Cheongan.SIN],
  [Jiji.SUL]: [Cheongan.SIN, Cheongan.BYEONG, Cheongan.MU],
  [Jiji.HAE]: [Cheongan.MU, Cheongan.GAP, Cheongan.IM],
};

const resolver = new DefaultHiddenStemResolver();

describe('HiddenStem distribution comparison (Q-03)', () => {
  // =========================================================================
  // Section 1: Structural invariants -- stem count per branch category
  // =========================================================================

  describe('Section 1: stem count per branch category', () => {
    it('all 12 branches have correct stem count in yeonhae', () => {
      for (const branch of JIJI_VALUES) {
        const stemList = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH);
        let expectedCount: number;
        if (branch === Jiji.JA || branch === Jiji.MYO || branch === Jiji.YU) {
          expectedCount = 2; // wangji except O
        } else {
          expectedCount = 3; // saengji + goji + O exception
        }
        expect(stemList.length).toBe(expectedCount);
      }
    });

    it('all 12 branches have correct stem count in sammyeong', () => {
      for (const branch of JIJI_VALUES) {
        const stemList = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST);
        let expectedCount: number;
        if (branch === Jiji.JA || branch === Jiji.MYO || branch === Jiji.O || branch === Jiji.YU) {
          expectedCount = 2; // ALL wangji are 2-stem in sammyeong
        } else {
          expectedCount = 3;
        }
        expect(stemList.length).toBe(expectedCount);
      }
    });

    it('stem count ranges are 2 or 3 for all allocations', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const count = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, allocation).length;
          expect(count).toBeGreaterThanOrEqual(2);
          expect(count).toBeLessThanOrEqual(3);
        }
      }
    });
  });

  // =========================================================================
  // Section 2: Principal stem universality
  // =========================================================================

  describe('Section 2: principal stem universality', () => {
    it('principal stem matches classical reference for yeonhae', () => {
      for (const branch of JIJI_VALUES) {
        const actual = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, YH);
        expect(actual).toBe(CLASSICAL_PRINCIPAL_STEMS[branch]);
      }
    });

    it('principal stem matches classical reference for sammyeong', () => {
      for (const branch of JIJI_VALUES) {
        const actual = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, ST);
        expect(actual).toBe(CLASSICAL_PRINCIPAL_STEMS[branch]);
      }
    });

    it('principal stem is identical across both allocations for all 12 branches', () => {
      for (const branch of JIJI_VALUES) {
        const yh = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, YH);
        const st = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, ST);
        expect(yh).toBe(st);
      }
    });
  });

  // =========================================================================
  // Section 3: Hidden stem identities
  // =========================================================================

  describe('Section 3: hidden stem identities', () => {
    it('yeonhae stem identities match classical reference for all 12 branches', () => {
      for (const branch of JIJI_VALUES) {
        const actual = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .map(e => e.stem);
        expect(actual).toEqual(YEONHAE_STEM_IDENTITIES[branch]);
      }
    });

    it('sammyeong stem identities match classical reference for all 12 branches', () => {
      for (const branch of JIJI_VALUES) {
        const actual = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .map(e => e.stem);
        expect(actual).toEqual(SAMMYEONG_STEM_IDENTITIES[branch]);
      }
    });
  });

  // =========================================================================
  // Section 4: Weight distribution sums and patterns
  // =========================================================================

  describe('Section 4: weight distribution patterns', () => {
    it('every branch sums to 30 days in yeonhae', () => {
      for (const branch of JIJI_VALUES) {
        const sum = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .reduce((acc, e) => acc + e.days, 0);
        expect(sum).toBe(30);
      }
    });

    it('every branch sums to 30 days in sammyeong', () => {
      for (const branch of JIJI_VALUES) {
        const sum = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .reduce((acc, e) => acc + e.days, 0);
        expect(sum).toBe(30);
      }
    });

    it('yeonhae saengji follows 7-7-16 pattern', () => {
      for (const branch of SAENGJI) {
        const days = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .map(e => e.days);
        expect(days).toEqual([7, 7, 16]);
      }
    });

    it('yeonhae wangji (except O) follows 10-20 pattern', () => {
      for (const branch of [Jiji.JA, Jiji.MYO, Jiji.YU]) {
        const days = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .map(e => e.days);
        expect(days).toEqual([10, 20]);
      }
    });

    it('yeonhae O (午) exception follows 10-9-11 pattern', () => {
      const days = HiddenStemTable.getHiddenStems(Jiji.O, HiddenStemVariant.STANDARD, YH)
        .map(e => e.days);
      expect(days).toEqual([10, 9, 11]);
    });

    it('yeonhae goji follows 9-3-18 pattern', () => {
      for (const branch of GOJI) {
        const days = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .map(e => e.days);
        expect(days).toEqual([9, 3, 18]);
      }
    });

    it('sammyeong saengji (except SA) follows 5-5-20 pattern', () => {
      for (const branch of [Jiji.IN, Jiji.SIN, Jiji.HAE]) {
        const days = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .map(e => e.days);
        expect(days).toEqual([5, 5, 20]);
      }
    });

    it('sammyeong SA (巳) exception follows 7-5-18 pattern', () => {
      const days = HiddenStemTable.getHiddenStems(Jiji.SA, HiddenStemVariant.STANDARD, ST)
        .map(e => e.days);
      expect(days).toEqual([7, 5, 18]);
    });

    it('sammyeong wangji follows 7-23 pattern', () => {
      for (const branch of WANGJI) {
        const days = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .map(e => e.days);
        expect(days).toEqual([7, 23]);
      }
    });

    it('sammyeong goji follows 7-5-18 pattern', () => {
      for (const branch of GOJI) {
        const days = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .map(e => e.days);
        expect(days).toEqual([7, 5, 18]);
      }
    });
  });

  // =========================================================================
  // Section 5: Cross-allocation comparison -- systematic divergences
  // =========================================================================

  describe('Section 5: cross-allocation divergences', () => {
    it('sammyeong gives equal or higher weight to jeonggi than yeonhae', () => {
      for (const branch of JIJI_VALUES) {
        const yhJeonggi = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .find(e => e.role === HiddenStemRole.JEONGGI)!.days;
        const stJeonggi = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .find(e => e.role === HiddenStemRole.JEONGGI)!.days;
        expect(stJeonggi).toBeGreaterThanOrEqual(yhJeonggi);
      }
    });

    it('exactly 6 branches differ in stem identity between allocations', () => {
      const differingBranches: Jiji[] = [];
      for (const branch of JIJI_VALUES) {
        const yhStems = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .map(e => e.stem);
        const stStems = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .map(e => e.stem);
        const same = yhStems.length === stStems.length &&
          yhStems.every((s, i) => s === stStems[i]);
        if (!same) {
          differingBranches.push(branch);
        }
      }
      const expectedDiffers = new Set([Jiji.JIN, Jiji.MI, Jiji.SUL, Jiji.CHUK, Jiji.SIN, Jiji.O]);
      expect(new Set(differingBranches)).toEqual(expectedDiffers);
    });

    it('goji junggi divergence follows yin-yang flip pattern', () => {
      for (const branch of GOJI) {
        const yhJunggi = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .find(e => e.role === HiddenStemRole.JUNGGI)!.stem;
        const stJunggi = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .find(e => e.role === HiddenStemRole.JUNGGI)!.stem;

        // Same ohaeng
        expect(CHEONGAN_INFO[yhJunggi].ohaeng).toBe(CHEONGAN_INFO[stJunggi].ohaeng);
        // YH = yin, ST = yang (the flip)
        expect(CHEONGAN_INFO[yhJunggi].eumyang).toBe(Eumyang.YIN);
        expect(CHEONGAN_INFO[stJunggi].eumyang).toBe(Eumyang.YANG);
      }
    });

    it('SIN yeogi diverges from MU to GI between allocations', () => {
      const yhYeogi = HiddenStemTable.getHiddenStems(Jiji.SIN, HiddenStemVariant.STANDARD, YH)
        .find(e => e.role === HiddenStemRole.YEOGI)!;
      const stYeogi = HiddenStemTable.getHiddenStems(Jiji.SIN, HiddenStemVariant.STANDARD, ST)
        .find(e => e.role === HiddenStemRole.YEOGI)!;

      expect(yhYeogi.stem).toBe(Cheongan.MU);
      expect(stYeogi.stem).toBe(Cheongan.GI);
      // Both are earth element
      expect(CHEONGAN_INFO[yhYeogi.stem].ohaeng).toBe(Ohaeng.EARTH);
      expect(CHEONGAN_INFO[stYeogi.stem].ohaeng).toBe(Ohaeng.EARTH);
      // Opposite yin-yang polarity
      expect(CHEONGAN_INFO[yhYeogi.stem].eumyang).not.toBe(CHEONGAN_INFO[stYeogi.stem].eumyang);
    });

    it('O structural divergence -- yeonhae 3 stems vs sammyeong 2 stems', () => {
      const yhStems = HiddenStemTable.getHiddenStems(Jiji.O, HiddenStemVariant.STANDARD, YH);
      const stStems = HiddenStemTable.getHiddenStems(Jiji.O, HiddenStemVariant.STANDARD, ST);

      expect(yhStems.length).toBe(3);
      expect(stStems.length).toBe(2);

      // YH has GI junggi; ST does not
      expect(yhStems.some(e => e.stem === Cheongan.GI && e.role === HiddenStemRole.JUNGGI))
        .toBe(true);
      expect(stStems.some(e => e.stem === Cheongan.GI)).toBe(false);
    });

    it('6 branches share identical stem identities across allocations', () => {
      const identicalBranches = JIJI_VALUES.filter(branch => {
        const yhStems = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .map(e => e.stem);
        const stStems = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .map(e => e.stem);
        return yhStems.length === stStems.length &&
          yhStems.every((s, i) => s === stStems[i]);
      });

      const expected = new Set([Jiji.JA, Jiji.IN, Jiji.MYO, Jiji.SA, Jiji.YU, Jiji.HAE]);
      expect(new Set(identicalBranches)).toEqual(expected);
    });

    it('all 12 branches have different day distributions between allocations', () => {
      for (const branch of JIJI_VALUES) {
        const yhDays = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH)
          .map(e => e.days);
        const stDays = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST)
          .map(e => e.days);
        const same = yhDays.length === stDays.length &&
          yhDays.every((d, i) => d === stDays[i]);
        expect(same).toBe(false);
      }
    });
  });

  // =========================================================================
  // Section 6: HiddenStemResolver integration
  // =========================================================================

  describe('Section 6: resolver integration', () => {
    it('resolver produces same results as direct table access for yeonhae', () => {
      for (const branch of JIJI_VALUES) {
        const tableResult = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, YH);
        const resolverResult = resolver.resolve(branch, HiddenStemVariant.STANDARD, YH);
        expect(resolverResult).toEqual(tableResult);
      }
    });

    it('resolver produces same results as direct table access for sammyeong', () => {
      for (const branch of JIJI_VALUES) {
        const tableResult = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, ST);
        const resolverResult = resolver.resolve(branch, HiddenStemVariant.STANDARD, ST);
        expect(resolverResult).toEqual(tableResult);
      }
    });

    it('resolver principalStem matches table getPrincipalStem for both allocations', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const tableResult = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, allocation);
          const resolverResult = resolver.principalStem(branch, HiddenStemVariant.STANDARD, allocation);
          expect(resolverResult).toBe(tableResult);
        }
      }
    });

    it('resolver handles NO_RESIDUAL_EARTH variant for both allocations', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of SAENGJI) {
          const standard = resolver.resolve(branch, HiddenStemVariant.STANDARD, allocation);
          const noEarth = resolver.resolve(branch, HiddenStemVariant.NO_RESIDUAL_EARTH, allocation);

          const hadMuYeogi = standard.some(
            e => e.stem === Cheongan.MU && e.role === HiddenStemRole.YEOGI,
          );
          if (hadMuYeogi) {
            expect(noEarth.some(
              e => e.stem === Cheongan.MU && e.role === HiddenStemRole.YEOGI,
            )).toBe(false);
            expect(noEarth.length).toBeLessThan(standard.length);
          }
        }
      }
    });
  });

  // =========================================================================
  // Section 7: Role ordering invariant
  // =========================================================================

  describe('Section 7: role ordering invariant', () => {
    it('role ordering is always YEOGI then optionally JUNGGI then JEONGGI', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const roles = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, allocation)
            .map(e => e.role);
          expect(roles[0]).toBe(HiddenStemRole.YEOGI);
          expect(roles[roles.length - 1]).toBe(HiddenStemRole.JEONGGI);
          if (roles.length === 3) {
            expect(roles[1]).toBe(HiddenStemRole.JUNGGI);
          }
        }
      }
    });

    it('role multiplicity -- one YEOGI, zero or one JUNGGI, one JEONGGI', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const stemList = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, allocation);
          const yeogiCount = stemList.filter(e => e.role === HiddenStemRole.YEOGI).length;
          const junggiCount = stemList.filter(e => e.role === HiddenStemRole.JUNGGI).length;
          const jeonggiCount = stemList.filter(e => e.role === HiddenStemRole.JEONGGI).length;

          expect(yeogiCount).toBe(1);
          expect(junggiCount).toBeGreaterThanOrEqual(0);
          expect(junggiCount).toBeLessThanOrEqual(1);
          expect(jeonggiCount).toBe(1);
          expect(stemList.length).toBe(yeogiCount + junggiCount + jeonggiCount);
        }
      }
    });
  });

  // =========================================================================
  // Section 8: Ohaeng coherence
  // =========================================================================

  describe('Section 8: principal stem ohaeng matches branch ohaeng', () => {
    it('principal stem ohaeng matches branch ohaeng for all 12 branches', () => {
      for (const branch of JIJI_VALUES) {
        const principal = HiddenStemTable.getPrincipalStem(branch, HiddenStemVariant.STANDARD, YH);
        expect(CHEONGAN_INFO[principal].ohaeng).toBe(JIJI_INFO[branch].ohaeng);
      }
    });
  });

  // =========================================================================
  // Section 9: Weight monotonicity
  // =========================================================================

  describe('Section 9: weight monotonicity', () => {
    it('jeonggi always has the highest day count for both allocations', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const stemList = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, allocation);
          const jeonggiDays = stemList.find(e => e.role === HiddenStemRole.JEONGGI)!.days;
          const maxDays = Math.max(...stemList.map(e => e.days));
          expect(jeonggiDays).toBe(maxDays);
        }
      }
    });

    it('jeonggi weight is strictly greater than yeogi and junggi weights', () => {
      for (const allocation of ALL_ALLOCATIONS) {
        for (const branch of JIJI_VALUES) {
          const stemList = HiddenStemTable.getHiddenStems(branch, HiddenStemVariant.STANDARD, allocation);
          const jeonggi = stemList.find(e => e.role === HiddenStemRole.JEONGGI)!;
          const yeogi = stemList.find(e => e.role === HiddenStemRole.YEOGI)!;
          expect(jeonggi.days).toBeGreaterThan(yeogi.days);

          const junggi = stemList.find(e => e.role === HiddenStemRole.JUNGGI);
          if (junggi) {
            expect(jeonggi.days).toBeGreaterThan(junggi.days);
          }
        }
      }
    });
  });
});
