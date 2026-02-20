/**
 * ACC-3: JohuTable 120-entry exhaustive parametric verification.
 *
 * Tests cover:
 * 1. Structural invariants for every entry (primary non-null, primary != secondary, reasoning non-blank)
 * 2. Classical spot-checks against 15 specific values from the table
 * 3. Row diversity: no single Cheongan maps to the same primary element across all 12 months
 * 4. Column diversity: no single Jiji maps to the same primary element across all 10 stems
 * 5. Null-secondary catalog completeness
 * 6. Seasonal pattern invariants derived from the source text
 */
import { describe, it, expect } from 'vitest';

import { Cheongan, CHEONGAN_VALUES, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO } from '../../../src/domain/Jiji.js';
import { Ohaeng, OHAENG_VALUES } from '../../../src/domain/Ohaeng.js';
import { JohuTable } from '../../../src/engine/analysis/JohuTable.js';

const { WOOD, FIRE, EARTH, METAL, WATER } = Ohaeng;

/**
 * The 7 entries in the table where secondary is explicitly null.
 * These are cases where the source text prescribes a single element.
 */
const EXPECTED_NULL_SECONDARY: Array<[Cheongan, Jiji]> = [
  [Cheongan.EUL, Jiji.JA],        // 을목 자월: 專用丙火
  [Cheongan.EUL, Jiji.CHUK],      // 을목 축월: 專用丙火
  [Cheongan.JEONG, Jiji.IN],      // 정화 인월: 先用甲木
  [Cheongan.JEONG, Jiji.MYO],     // 정화 묘월: 先用甲木
  [Cheongan.GYEONG, Jiji.O],      // 경금 오월: 專用壬水
  [Cheongan.GYE, Jiji.MYO],       // 계수 묘월: 專以庚金
  [Cheongan.BYEONG, Jiji.MYO],    // 병화 묘월: 專用壬水
];

function isExpectedNullSecondary(stem: Cheongan, branch: Jiji): boolean {
  return EXPECTED_NULL_SECONDARY.some(([s, b]) => s === stem && b === branch);
}

// ==================================================================
// Part 1: Parametric structural verification for ALL 120 entries
// ==================================================================

describe('JohuTable exhaustive (ACC-3)', () => {
  describe('Part 1: entry structure -- all 120 combinations', () => {
    for (const stem of CHEONGAN_VALUES) {
      for (const branch of JIJI_VALUES) {
        const si = CHEONGAN_INFO[stem];
        const bi = JIJI_INFO[branch];
        const label = `${si.hangul}(${si.hanja}) ${bi.hangul}(${bi.hanja})`;
        const expectNull = isExpectedNullSecondary(stem, branch);

        it(`[${label}] primary is valid Ohaeng`, () => {
          const entry = JohuTable.lookup(stem, branch);
          expect(entry.primary).not.toBeNull();
          expect(OHAENG_VALUES).toContain(entry.primary);
        });

        it(`[${label}] secondary null = ${expectNull}`, () => {
          const entry = JohuTable.lookup(stem, branch);
          if (expectNull) {
            expect(entry.secondary).toBeNull();
          } else {
            expect(entry.secondary).not.toBeNull();
          }
        });

        it(`[${label}] primary != secondary when secondary present`, () => {
          const entry = JohuTable.lookup(stem, branch);
          if (entry.secondary != null) {
            expect(entry.primary).not.toBe(entry.secondary);
          }
        });
      }
    }
  });

  describe('Part 1b: reasoning non-blank -- all 120 combinations', () => {
    for (const stem of CHEONGAN_VALUES) {
      for (const branch of JIJI_VALUES) {
        const si = CHEONGAN_INFO[stem];
        const bi = JIJI_INFO[branch];
        const label = `${si.hangul} ${bi.hangul}`;

        it(`[${label}] reasoning is non-blank and contains Korean`, () => {
          const reasoning = JohuTable.reasoning(stem, branch);
          expect(reasoning.trim().length).toBeGreaterThan(0);
          // Must contain at least one Korean Hangul character (U+AC00..U+D7A3)
          const hasKorean = [...reasoning].some(
            ch => ch.charCodeAt(0) >= 0xAC00 && ch.charCodeAt(0) <= 0xD7A3,
          );
          expect(hasKorean).toBe(true);
        });
      }
    }
  });

  describe('Part 1c: note populated -- all 120 combinations', () => {
    for (const stem of CHEONGAN_VALUES) {
      for (const branch of JIJI_VALUES) {
        const si = CHEONGAN_INFO[stem];
        const bi = JIJI_INFO[branch];
        const label = `${si.hangul} ${bi.hangul}`;

        it(`[${label}] note is non-blank`, () => {
          const entry = JohuTable.lookup(stem, branch);
          expect(entry.note.trim().length).toBeGreaterThan(0);
        });
      }
    }
  });

  // ==================================================================
  // Part 2: Classical spot-checks against 15 specific values
  // ==================================================================

  describe('Part 2: classical spot-checks (15 cases)', () => {
    const spotChecks: Array<{
      stem: Cheongan;
      branch: Jiji;
      primary: Ohaeng;
      secondary: Ohaeng | null;
      desc: string;
    }> = [
      { stem: Cheongan.GAP, branch: Jiji.IN, primary: WATER, secondary: FIRE,
        desc: '갑목 인월: 先用癸水 次取丙火' },
      { stem: Cheongan.GAP, branch: Jiji.MYO, primary: WATER, secondary: METAL,
        desc: '갑목 묘월: 先用癸水 次取庚金' },
      { stem: Cheongan.EUL, branch: Jiji.IN, primary: FIRE, secondary: WATER,
        desc: '을목 인월: 先用丙火 次取癸水' },
      { stem: Cheongan.BYEONG, branch: Jiji.JA, primary: WOOD, secondary: FIRE,
        desc: '병화 자월: 甲木關鍵' },
      { stem: Cheongan.GYEONG, branch: Jiji.YU, primary: FIRE, secondary: WOOD,
        desc: '경금 유월: 丁甲鍛鍊' },
      { stem: Cheongan.JEONG, branch: Jiji.O, primary: WATER, secondary: WOOD,
        desc: '정화 오월: 한여름 과열 방지 임수 우선' },
      { stem: Cheongan.MU, branch: Jiji.O, primary: WATER, secondary: WOOD,
        desc: '무토 오월: 극열 임수 조후 급선무' },
      { stem: Cheongan.SIN, branch: Jiji.IN, primary: EARTH, secondary: WATER,
        desc: '신금 인월: 기토 생신 임수 도세' },
      { stem: Cheongan.IM, branch: Jiji.IN, primary: METAL, secondary: FIRE,
        desc: '임수 인월: 경금 수원 발생 병화 보좌' },
      { stem: Cheongan.GYE, branch: Jiji.IN, primary: METAL, secondary: FIRE,
        desc: '계수 인월: 신금 수원 발생 병화 조난' },
      { stem: Cheongan.GAP, branch: Jiji.SIN, primary: FIRE, secondary: WATER,
        desc: '갑목 신월: 금왕절 화로 금 제어' },
      { stem: Cheongan.EUL, branch: Jiji.SIN, primary: EARTH, secondary: FIRE,
        desc: '을목 신월: 경금 극 감당 어려움 기토 필수' },
      { stem: Cheongan.GI, branch: Jiji.JA, primary: FIRE, secondary: WOOD,
        desc: '기토 자월: 극한 전용 병화' },
      { stem: Cheongan.GYEONG, branch: Jiji.O, primary: WATER, secondary: null,
        desc: '경금 오월: 극열 경금 녹을 위험 임수 전용' },
      { stem: Cheongan.GYE, branch: Jiji.JA, primary: FIRE, secondary: METAL,
        desc: '계수 자월: 빙동지시 금온수난' },
    ];

    for (const { stem, branch, primary, secondary, desc } of spotChecks) {
      it(`Classical: ${desc}`, () => {
        const entry = JohuTable.lookup(stem, branch);
        expect(entry.primary).toBe(primary);
        expect(entry.secondary).toBe(secondary);
      });
    }
  });

  // ==================================================================
  // Part 3: Row diversity
  // ==================================================================

  describe('Part 3: row diversity -- each Cheongan', () => {
    it('each Cheongan row has diverse primary elements', () => {
      for (const stem of CHEONGAN_VALUES) {
        const primaries = new Set(
          JIJI_VALUES.map(branch => JohuTable.lookup(stem, branch).primary),
        );
        expect(primaries.size).toBeGreaterThan(1);
      }
    });

    it('each Cheongan row uses at least 2 distinct primaries', () => {
      for (const stem of CHEONGAN_VALUES) {
        const primaries = new Set(
          JIJI_VALUES.map(branch => JohuTable.lookup(stem, branch).primary),
        );
        expect(primaries.size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ==================================================================
  // Part 4: Column diversity
  // ==================================================================

  describe('Part 4: column diversity -- each Jiji', () => {
    it('each Jiji column has diverse primary elements', () => {
      for (const branch of JIJI_VALUES) {
        const primaries = new Set(
          CHEONGAN_VALUES.map(stem => JohuTable.lookup(stem, branch).primary),
        );
        expect(primaries.size).toBeGreaterThan(1);
      }
    });

    it('each Jiji column uses at least 2 distinct primaries', () => {
      for (const branch of JIJI_VALUES) {
        const primaries = new Set(
          CHEONGAN_VALUES.map(stem => JohuTable.lookup(stem, branch).primary),
        );
        expect(primaries.size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ==================================================================
  // Part 5: Table completeness and size
  // ==================================================================

  describe('Part 5: table completeness', () => {
    it('table coverage is exactly 120', () => {
      let count = 0;
      for (const stem of CHEONGAN_VALUES) {
        for (const branch of JIJI_VALUES) {
          JohuTable.lookup(stem, branch); // throws if missing
          count++;
        }
      }
      expect(count).toBe(120);
    });

    it('CHEONGAN_VALUES count is 10', () => {
      expect(CHEONGAN_VALUES.length).toBe(10);
    });

    it('JIJI_VALUES count is 12', () => {
      expect(JIJI_VALUES.length).toBe(12);
    });
  });

  // ==================================================================
  // Part 6: Null-secondary count verification
  // ==================================================================

  describe('Part 6: null-secondary catalog', () => {
    it('null-secondary count matches expected', () => {
      const nullSecondaryPairs: Array<[Cheongan, Jiji]> = [];
      for (const stem of CHEONGAN_VALUES) {
        for (const branch of JIJI_VALUES) {
          const entry = JohuTable.lookup(stem, branch);
          if (entry.secondary == null) {
            nullSecondaryPairs.push([stem, branch]);
          }
        }
      }
      expect(nullSecondaryPairs.length).toBe(EXPECTED_NULL_SECONDARY.length);

      // Verify exact set match
      for (const [stem, branch] of EXPECTED_NULL_SECONDARY) {
        const found = nullSecondaryPairs.some(([s, b]) => s === stem && b === branch);
        expect(found).toBe(true);
      }
    });
  });

  // ==================================================================
  // Part 7: Seasonal pattern invariants
  // ==================================================================

  describe('Part 7: seasonal pattern invariants', () => {
    it('wood day masters need WATER in all summer months', () => {
      for (const stem of [Cheongan.GAP, Cheongan.EUL]) {
        for (const branch of [Jiji.SA, Jiji.O, Jiji.MI]) {
          const entry = JohuTable.lookup(stem, branch);
          expect(entry.primary).toBe(WATER);
        }
      }
    });

    it('wood day masters need FIRE in all winter months', () => {
      for (const stem of [Cheongan.GAP, Cheongan.EUL]) {
        for (const branch of [Jiji.HAE, Jiji.JA, Jiji.CHUK]) {
          const entry = JohuTable.lookup(stem, branch);
          expect(entry.primary).toBe(FIRE);
        }
      }
    });

    it('BYEONG (yang fire) needs WATER in all summer months', () => {
      for (const branch of [Jiji.SA, Jiji.O, Jiji.MI]) {
        const entry = JohuTable.lookup(Cheongan.BYEONG, branch);
        expect(entry.primary).toBe(WATER);
      }
    });

    it('JEONG (yin fire) needs WOOD in all winter months', () => {
      for (const branch of [Jiji.HAE, Jiji.JA, Jiji.CHUK]) {
        const entry = JohuTable.lookup(Cheongan.JEONG, branch);
        expect(entry.primary).toBe(WOOD);
      }
    });

    it('GYEONG (yang metal) needs FIRE in spring', () => {
      for (const branch of [Jiji.IN, Jiji.MYO, Jiji.JIN]) {
        const entry = JohuTable.lookup(Cheongan.GYEONG, branch);
        expect(entry.primary).toBe(FIRE);
      }
    });

    it('earth day masters need FIRE in deep winter (JA, CHUK)', () => {
      for (const stem of [Cheongan.MU, Cheongan.GI]) {
        for (const branch of [Jiji.JA, Jiji.CHUK]) {
          const entry = JohuTable.lookup(stem, branch);
          expect(entry.primary).toBe(FIRE);
        }
      }
    });
  });
});
