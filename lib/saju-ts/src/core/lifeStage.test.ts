import { describe, expect, it } from 'vitest';

import type { BranchIdx, StemIdx } from './cycle.js';
import { LIFE_STAGE_VALUES, lifeStageOf, type LifeStage, type LifeStagePolicy } from './lifeStage.js';

/**
 * 12운성 120칸 조견표 전수 단정 (감사 PR-4 — 정답표 테스트 공백 해소).
 *
 * 외부 표준표(양순음역·화토동궁 — 위키백과 십이운성 조견표 등) 기준.
 * 엔진 기본 정책(facts.ts readLifeStagePolicyFromConfig)은
 * { earthRule: 'FOLLOW_FIRE', yinReversalEnabled: true } — 여기 리터럴로 고정.
 */
const DEFAULT_POLICY: LifeStagePolicy = { earthRule: 'FOLLOW_FIRE', yinReversalEnabled: true };

// 지지 순서 子丑寅卯辰巳午未申酉戌亥 (branch idx 0..11), 천간 甲..癸 (stem idx 0..9).
const EXPECTED_120: readonly (readonly LifeStage[])[] = [
  /* 甲 */ ['MOK_YOK', 'GWAN_DAE', 'GEON_ROK', 'JE_WANG', 'SWOE', 'BYEONG', 'SA', 'MYO', 'JEOL', 'TAE', 'YANG', 'JANG_SAENG'],
  /* 乙 */ ['BYEONG', 'SWOE', 'JE_WANG', 'GEON_ROK', 'GWAN_DAE', 'MOK_YOK', 'JANG_SAENG', 'YANG', 'TAE', 'JEOL', 'MYO', 'SA'],
  /* 丙 */ ['TAE', 'YANG', 'JANG_SAENG', 'MOK_YOK', 'GWAN_DAE', 'GEON_ROK', 'JE_WANG', 'SWOE', 'BYEONG', 'SA', 'MYO', 'JEOL'],
  /* 丁 */ ['JEOL', 'MYO', 'SA', 'BYEONG', 'SWOE', 'JE_WANG', 'GEON_ROK', 'GWAN_DAE', 'MOK_YOK', 'JANG_SAENG', 'YANG', 'TAE'],
  /* 戊 */ ['TAE', 'YANG', 'JANG_SAENG', 'MOK_YOK', 'GWAN_DAE', 'GEON_ROK', 'JE_WANG', 'SWOE', 'BYEONG', 'SA', 'MYO', 'JEOL'], // = 丙 (화토동궁)
  /* 己 */ ['JEOL', 'MYO', 'SA', 'BYEONG', 'SWOE', 'JE_WANG', 'GEON_ROK', 'GWAN_DAE', 'MOK_YOK', 'JANG_SAENG', 'YANG', 'TAE'], // = 丁 (화토동궁)
  /* 庚 */ ['SA', 'MYO', 'JEOL', 'TAE', 'YANG', 'JANG_SAENG', 'MOK_YOK', 'GWAN_DAE', 'GEON_ROK', 'JE_WANG', 'SWOE', 'BYEONG'],
  /* 辛 */ ['JANG_SAENG', 'YANG', 'TAE', 'JEOL', 'MYO', 'SA', 'BYEONG', 'SWOE', 'JE_WANG', 'GEON_ROK', 'GWAN_DAE', 'MOK_YOK'],
  /* 壬 */ ['JE_WANG', 'SWOE', 'BYEONG', 'SA', 'MYO', 'JEOL', 'TAE', 'YANG', 'JANG_SAENG', 'MOK_YOK', 'GWAN_DAE', 'GEON_ROK'],
  /* 癸 */ ['GEON_ROK', 'GWAN_DAE', 'MOK_YOK', 'JANG_SAENG', 'YANG', 'TAE', 'JEOL', 'MYO', 'SA', 'BYEONG', 'SWOE', 'JE_WANG'],
];

const STEM_LABEL = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCH_LABEL = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

describe('12운성 조견표 (감사 PR-4 — 화토동궁 + 음간역행)', () => {
  it('LIFE_STAGE_VALUES 순서가 표준 12단계 순환이다', () => {
    expect(LIFE_STAGE_VALUES).toEqual([
      'JANG_SAENG', 'MOK_YOK', 'GWAN_DAE', 'GEON_ROK', 'JE_WANG', 'SWOE',
      'BYEONG', 'SA', 'MYO', 'JEOL', 'TAE', 'YANG',
    ]);
  });

  it('120칸 전수: 외부 표준표와 일치한다', () => {
    for (let s = 0; s < 10; s++) {
      for (let b = 0; b < 12; b++) {
        const got = lifeStageOf(s as StemIdx, b as BranchIdx, DEFAULT_POLICY);
        expect(got.stage, `${STEM_LABEL[s]}×${BRANCH_LABEL[b]}`).toBe(EXPECTED_120[s]![b]);
      }
    }
  });

  it('장생 시작지(startBranch): 甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯', () => {
    const expectedStart = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
    for (let s = 0; s < 10; s++) {
      const got = lifeStageOf(s as StemIdx, 0 as BranchIdx, DEFAULT_POLICY);
      expect(got.startBranch, STEM_LABEL[s]).toBe(expectedStart[s]);
    }
  });

  it("수토동궁(FOLLOW_WATER)에서는 戊 행=壬 행, 己 행=癸 행이다", () => {
    const water: LifeStagePolicy = { earthRule: 'FOLLOW_WATER', yinReversalEnabled: true };
    for (let b = 0; b < 12; b++) {
      expect(lifeStageOf(4 as StemIdx, b as BranchIdx, water).stage, `戊×${BRANCH_LABEL[b]}`)
        .toBe(lifeStageOf(8 as StemIdx, b as BranchIdx, water).stage);
      expect(lifeStageOf(5 as StemIdx, b as BranchIdx, water).stage, `己×${BRANCH_LABEL[b]}`)
        .toBe(lifeStageOf(9 as StemIdx, b as BranchIdx, water).stage);
    }
  });

  it("earthRule 'INDEPENDENT'는 명시적으로 거부한다 (감사 A14)", () => {
    expect(() => lifeStageOf(4 as StemIdx, 0 as BranchIdx, { earthRule: 'INDEPENDENT' as any, yinReversalEnabled: true }))
      .toThrow(/INDEPENDENT/);
  });

  it('음간역행 off이면 음간도 순행한다 (스팟: 乙×未=MOK_YOK, 丁×戌=MOK_YOK)', () => {
    const forward: LifeStagePolicy = { earthRule: 'FOLLOW_FIRE', yinReversalEnabled: false };
    // 乙 start 午(6): 未(7)=+1=MOK_YOK. 丁 start 酉(9): 戌(10)=+1=MOK_YOK.
    expect(lifeStageOf(1 as StemIdx, 7 as BranchIdx, forward).stage).toBe('MOK_YOK');
    expect(lifeStageOf(3 as StemIdx, 10 as BranchIdx, forward).stage).toBe('MOK_YOK');
  });
});
