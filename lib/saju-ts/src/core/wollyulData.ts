import type { StemIdx } from './cycle.js';

/**
 * 月律分野 (월률분야) — classical "司令" (commanding-stem) day counts
 * inside each branch.
 *
 * Each branch's 30-day window after the 節氣 entry is divided into
 * 餘氣 (residual qi) / 中氣 (middle qi) / 正氣 (proper qi). The
 * commanding hidden stem walks through these segments as elapsed days
 * since the 節 grow, which is the basis of the upcoming
 * 'classical-saryeong' / 'scaled-saryeong' weight schemes.
 *
 * Data source: saju_master v9.2 (constants.py:HIDDEN_STEMS), which
 * matches the 月令人元司令分野表 transcribed in 三命通會 / 淵海子平.
 * See saju-info/04_classical_rules/zanggan_wollyul_bunya.md.
 *
 * Stem indices follow the project-wide convention:
 *   0 甲, 1 乙, 2 丙, 3 丁, 4 戊, 5 己, 6 庚, 7 辛, 8 壬, 9 癸
 *
 * NOTE: This data is parallel to (not a replacement for) the existing
 * `rawHiddenStemsTable` in `core/hiddenStems.ts`. Keeping them
 * separate lets default `'standard'` weights stay byte-stable while
 * the new opt-in saryeong schemes consume `WOLLYUL_SEGMENTS`.
 */

export type Qi = 'CHO' | 'JUNG' | 'JEONG';

export interface WollyulSegment {
  stem: StemIdx;
  days: number;
  qi: Qi;
}

export const WOLLYUL_SEGMENTS: ReadonlyArray<readonly WollyulSegment[]> = [
  /* 0 子 */ [
    { stem: 8, days: 10, qi: 'CHO' },   // 壬 餘氣
    { stem: 9, days: 20, qi: 'JEONG' }, // 癸 正氣
  ],
  /* 1 丑 */ [
    { stem: 9, days: 9, qi: 'CHO' },    // 癸 餘氣
    { stem: 7, days: 3, qi: 'JUNG' },   // 辛 中氣
    { stem: 5, days: 18, qi: 'JEONG' }, // 己 正氣
  ],
  /* 2 寅 */ [
    { stem: 4, days: 7, qi: 'CHO' },    // 戊 餘氣
    { stem: 2, days: 7, qi: 'JUNG' },   // 丙 中氣
    { stem: 0, days: 16, qi: 'JEONG' }, // 甲 正氣
  ],
  /* 3 卯 */ [
    { stem: 0, days: 10, qi: 'CHO' },   // 甲 餘氣
    { stem: 1, days: 20, qi: 'JEONG' }, // 乙 正氣
  ],
  /* 4 辰 */ [
    { stem: 1, days: 9, qi: 'CHO' },    // 乙 餘氣
    { stem: 9, days: 3, qi: 'JUNG' },   // 癸 中氣
    { stem: 4, days: 18, qi: 'JEONG' }, // 戊 正氣
  ],
  /* 5 巳 */ [
    { stem: 4, days: 7, qi: 'CHO' },    // 戊 餘氣
    { stem: 6, days: 7, qi: 'JUNG' },   // 庚 中氣
    { stem: 2, days: 16, qi: 'JEONG' }, // 丙 正氣
  ],
  /* 6 午 */ [
    { stem: 2, days: 10, qi: 'CHO' },   // 丙 餘氣
    { stem: 5, days: 10, qi: 'JUNG' },  // 己 中氣
    // ⚠ 午는 丙10+己10+丁11=31일로 12지지 중 유일하게 nominal 합 30일 초과 (saju_master v9.2 채택값.
    // 주류 이설은 10-9-11 합30 또는 10-10-10 합30 — 감사 A15e). classical 스킴의 午월 경계일에만
    // 영향, scaled 스킴은 실제 월 길이로 정규화되므로 무영향.
    { stem: 3, days: 11, qi: 'JEONG' }, // 丁 正氣
  ],
  /* 7 未 */ [
    { stem: 3, days: 9, qi: 'CHO' },    // 丁 餘氣
    { stem: 1, days: 3, qi: 'JUNG' },   // 乙 中氣
    { stem: 5, days: 18, qi: 'JEONG' }, // 己 正氣
  ],
  /* 8 申 */ [
    { stem: 4, days: 7, qi: 'CHO' },    // 戊 餘氣
    { stem: 8, days: 7, qi: 'JUNG' },   // 壬 中氣
    { stem: 6, days: 16, qi: 'JEONG' }, // 庚 正氣
  ],
  /* 9 酉 */ [
    { stem: 6, days: 10, qi: 'CHO' },   // 庚 餘氣
    { stem: 7, days: 20, qi: 'JEONG' }, // 辛 正氣
  ],
  /* 10 戌 */ [
    { stem: 7, days: 9, qi: 'CHO' },    // 辛 餘氣
    { stem: 3, days: 3, qi: 'JUNG' },   // 丁 中氣
    { stem: 4, days: 18, qi: 'JEONG' }, // 戊 正氣
  ],
  /* 11 亥 */ [
    { stem: 4, days: 7, qi: 'CHO' },    // 戊 餘氣
    { stem: 0, days: 7, qi: 'JUNG' },   // 甲 中氣
    { stem: 8, days: 16, qi: 'JEONG' }, // 壬 正氣
  ],
];
