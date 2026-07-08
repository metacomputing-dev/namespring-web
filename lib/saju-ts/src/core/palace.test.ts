import { describe, expect, it } from 'vitest';
import { analyzePalaces } from './palace.js';
import { rawHiddenStemsTable } from './hiddenStems.js';
import type { BranchIdx, StemIdx } from './cycle.js';

// 12지지 본기(정기) 조견표: 子癸 丑己 寅甲 卯乙 辰戊 巳丙 午丁 未己 申庚 酉辛 戌戊 亥壬
const MAIN_HIDDEN_STEM_BY_BRANCH: readonly StemIdx[] = [
  /* 子 */ 9, /* 丑 */ 5, /* 寅 */ 0, /* 卯 */ 1, /* 辰 */ 4, /* 巳 */ 2,
  /* 午 */ 3, /* 未 */ 5, /* 申 */ 6, /* 酉 */ 7, /* 戌 */ 4, /* 亥 */ 8,
];

describe('analyzePalaces mainHiddenStem', () => {
  it('picks the 정기(MAIN) hidden stem for all 12 branches', () => {
    for (let b = 0 as BranchIdx; b < 12; b++) {
      const report = analyzePalaces({ day: { stem: 0, branch: b } });
      expect(report.positions.day.mainHiddenStem, `branch ${b}`).toBe(MAIN_HIDDEN_STEM_BY_BRANCH[b]);
    }
  });

  it('rawHiddenStemsTable keeps MAIN as the first entry (order contract)', () => {
    for (let b = 0; b < 12; b++) {
      expect(rawHiddenStemsTable[b]![0]!.role, `branch ${b}`).toBe('MAIN');
    }
  });

  it('寅궁 본기 甲 기준 십신: 갑 일간이면 비견 (여기 戊 기준 편재가 아니어야 함)', () => {
    // regression for the hidden[last] bug which picked 여기(RESIDUAL) 戊
    const report = analyzePalaces({ day: { stem: 0, branch: 2 } });
    expect(report.positions.day.mainHiddenStem).toBe(0); // 甲
    expect(report.positions.day.mainTenGod).toBe('BI_GYEON');
  });
});
