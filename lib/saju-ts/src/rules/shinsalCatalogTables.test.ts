import { describe, expect, it } from 'vitest';

import { DEFAULT_SHINSAL_CATALOG } from './packs/shinsalBaseCatalog.js';
import { normalizeShinsalCatalog } from './shinsalCatalog.js';

/**
 * 신살 배속표 단정 (감사 PR-4 — 정답표 테스트 공백 해소).
 *
 * 카탈로그 데이터(DEFAULT_SHINSAL_CATALOG)를 외부 표준표와 대조해 고정한다.
 * - 천을귀인: 고전 구결 「甲戊庚牛羊, 乙己鼠猴鄉, 丙丁豬雞位, 壬癸兔蛇藏, 六辛逢馬虎」
 *   (甲戊庚→丑未 유파)과 정확 일치. 辛=[寅,午]은 카탈로그 삽입 순서 보존.
 * - 록신: 甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子 (화토동궁 록표 —
 *   facts.ts lokFallback·격국 GYEOKGUK_LOK_BRANCH와 동일 값).
 * - 월덕(삼합국→旺干)·월덕합(五合 파트너)·천덕(월별 stem/branch 이원)·괴강·백호.
 */
const norm = normalizeShinsalCatalog(DEFAULT_SHINSAL_CATALOG as any);

describe('신살 배속표 (감사 PR-4)', () => {
  it('천을귀인: 고전 구결과 전량 일치 (10일간 × 2지지)', () => {
    expect(norm.dayStem.CHEON_EUL_GUI_IN!.byStem).toEqual([
      [1, 7],   // 甲 → 丑未
      [0, 8],   // 乙 → 子申
      [11, 9],  // 丙 → 亥酉
      [11, 9],  // 丁 → 亥酉
      [1, 7],   // 戊 → 丑未
      [0, 8],   // 己 → 子申
      [1, 7],   // 庚 → 丑未
      [2, 6],   // 辛 → 寅午 (六辛逢馬虎 — 카탈로그 표기 순서)
      [5, 3],   // 壬 → 巳卯
      [5, 3],   // 癸 → 巳卯
    ]);
  });

  it('록신: 甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子', () => {
    expect(norm.dayStem.LOK_SHIN!.byStem).toEqual([
      [2], [3], [5], [6], [5], [6], [8], [9], [11], [0],
    ]);
  });

  it('문창귀인: 甲巳 乙午 丙申 丁酉 戊申 己酉 庚亥 辛子 壬寅 癸卯', () => {
    expect(norm.dayStem.MUN_CHANG_GUI_IN!.byStem).toEqual([
      [5], [6], [8], [9], [8], [9], [11], [0], [2], [3],
    ]);
  });

  it('월덕귀인: 삼합국→旺干 (寅午戌→丙, 申子辰→壬, 亥卯未→甲, 巳酉丑→庚) 12지지 전량', () => {
    // byBranch는 지지 인덱스(子0..亥11) 순. 천간 인덱스: 甲0 丙2 庚6 壬8.
    expect(norm.monthBranchStem.WOL_DEOK_GUI_IN!.byBranch).toEqual([
      [8], // 子 → 壬
      [6], // 丑 → 庚
      [2], // 寅 → 丙
      [0], // 卯 → 甲
      [8], // 辰 → 壬
      [6], // 巳 → 庚
      [2], // 午 → 丙
      [0], // 未 → 甲
      [8], // 申 → 壬
      [6], // 酉 → 庚
      [2], // 戌 → 丙
      [0], // 亥 → 甲
    ]);
  });

  it('월덕합: 월덕의 五合 파트너 (丙↔辛, 壬↔丁, 甲↔己, 庚↔乙)', () => {
    expect(norm.monthBranchStem.WOL_DEOK_HAP!.byBranch).toEqual([
      [3], // 子 → 丁
      [1], // 丑 → 乙
      [7], // 寅 → 辛
      [5], // 卯 → 己
      [3], // 辰 → 丁
      [1], // 巳 → 乙
      [7], // 午 → 辛
      [5], // 未 → 己
      [3], // 申 → 丁
      [1], // 酉 → 乙
      [7], // 戌 → 辛
      [5], // 亥 → 己
    ]);
  });

  it('천덕: stem판 8개월 + branch판 4개월(卯申·午亥·酉寅·子巳) 이원 구조', () => {
    const stemPart = norm.monthBranchStem.CHEON_DEOK_GUI_IN_STEM!.byBranch;
    // stem판에 없는 4개월(子卯午酉)은 빈 배열이어야 한다 — branch판이 담당.
    expect(stemPart[0]).toEqual([]); // 子
    expect(stemPart[3]).toEqual([]); // 卯
    expect(stemPart[6]).toEqual([]); // 午
    expect(stemPart[9]).toEqual([]); // 酉
    expect(stemPart[2]).toEqual([3]);  // 寅 → 丁
    expect(stemPart[4]).toEqual([8]);  // 辰 → 壬
    expect(stemPart[5]).toEqual([7]);  // 巳 → 辛
    expect(stemPart[7]).toEqual([0]);  // 未 → 甲
    expect(stemPart[8]).toEqual([9]);  // 申 → 癸
    expect(stemPart[10]).toEqual([2]); // 戌 → 丙
    expect(stemPart[11]).toEqual([1]); // 亥 → 乙
    expect(stemPart[1]).toEqual([6]);  // 丑 → 庚

    const branchPart = norm.monthBranchBranch.CHEON_DEOK_GUI_IN_BRANCH!.byBranch;
    expect(branchPart[3]).toEqual([8]);  // 卯 → 申
    expect(branchPart[6]).toEqual([11]); // 午 → 亥
    expect(branchPart[9]).toEqual([2]);  // 酉 → 寅
    expect(branchPart[0]).toEqual([5]);  // 子 → 巳
  });

  it('괴강: primary 庚辰·壬辰·庚戌·戊戌 + extended 戊辰·壬戌 (60갑자 인덱스)', () => {
    const kg = norm.dayPillar.KUI_GANG!;
    expect(kg.requiresDayPillar).toBe(true);
    expect([...kg.primary].sort((a, b) => a - b)).toEqual([16, 28, 34, 46]);
    expect([...kg.extended].sort((a, b) => a - b)).toEqual([4, 58]);
  });

  it('백호: 甲辰 乙未 丙戌 丁丑 戊辰 壬戌 癸丑 7일주 (60갑자 인덱스)', () => {
    const bh = norm.dayPillar.BAEK_HO!;
    expect(bh.requiresDayPillar).toBe(true);
    expect([...bh.primary].sort((a, b) => a - b)).toEqual([4, 13, 22, 31, 40, 49, 58]);
  });
});
