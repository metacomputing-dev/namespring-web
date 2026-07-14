import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';

/**
 * 수식 파생 신살 배속 단정 (감사 PR-4) — 12신살 144칸 · 양인/비인/학당 · 공망 6순.
 * 카탈로그가 아니라 facts 파이프라인의 computed 값을 외부 표준표와 대조한다.
 */
function factsFor(pillarSpec: {
  year: [number, number]; month: [number, number]; day: [number, number]; hour: [number, number];
}, strategies: Record<string, unknown> = {}) {
  const config = normalizeConfig({ strategies });
  const pillars = {
    year: pillar(...(pillarSpec.year as [StemIdx, BranchIdx])),
    month: pillar(...(pillarSpec.month as [StemIdx, BranchIdx])),
    day: pillar(...(pillarSpec.day as [StemIdx, BranchIdx])),
    hour: pillar(...(pillarSpec.hour as [StemIdx, BranchIdx])),
  };
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  );
  const scoring = scorePillars(pillars, DEFAULT_SCORE_POLICY);
  return buildRuleFacts({ config, pillars, elementDistribution, scoring });
}

const BRANCH_LABEL = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEM_LABEL = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 12신살 표준 조견표: 삼합군 대표(지살=삼합 첫 지지) 기준 순환.
// 순서는 지살→도화→월살→망신→장성→반안→역마→육해→화개→겁살→재살→천살.
const TWELVE_SAL_ORDER = [
  'JI_SAL', 'DOHWA', 'WOL_SAL', 'MANG_SHIN_SAL', 'JANGSEONG', 'BAN_AN_SAL',
  'YEOKMA', 'YUK_HAE_SAL', 'HUAGAI', 'GEOB_SAL', 'JAESAL', 'CHEON_SAL',
] as const;

// 삼합군 → 지살 시작 지지: 申子辰→申(8), 巳酉丑→巳(5), 寅午戌→寅(2), 亥卯未→亥(11).
const JI_SAL_START: Record<number, number> = {
  0: 8, 4: 8, 8: 8,    // 申子辰
  1: 5, 5: 5, 9: 5,    // 巳酉丑
  2: 2, 6: 2, 10: 2,   // 寅午戌
  3: 11, 7: 11, 11: 11, // 亥卯未
};

describe('12신살 144칸 (년지 앵커 × 12키 — 외부 표준 조견표)', () => {
  it('년지 0..11 전수: 지살 시작 + 순행 12키가 표준표와 일치한다', () => {
    for (let yb = 0; yb < 12; yb++) {
      // 년주 홀짝 정합(갑자 유효)을 위해 stem = yb % 2 (甲 또는 乙).
      const facts = factsFor({
        year: [yb % 2, yb], month: [2, 2], day: [4, 4], hour: [6, 6],
      });
      const got = facts.shinsal.twelveSal.year;
      const start = JI_SAL_START[yb]!;
      for (let k = 0; k < 12; k++) {
        const key = TWELVE_SAL_ORDER[k]!;
        const expected = ((start + k) % 12) as BranchIdx;
        expect(got[key], `년지 ${BRANCH_LABEL[yb]} ${key}`).toBe(expected);
      }
    }
  });

  it('스팟 검산: 도화(子酉午卯)·역마(寅亥申巳)·화개(辰丑戌未) 표준 앵커', () => {
    // 申子辰→도화 酉·역마 寅·화개 辰 / 寅午戌→도화 卯·역마 申·화개 戌
    const f1 = factsFor({ year: [0, 0], month: [2, 2], day: [4, 4], hour: [6, 6] });   // 년지 子
    expect(f1.shinsal.twelveSal.year.DOHWA).toBe(9);
    expect(f1.shinsal.twelveSal.year.YEOKMA).toBe(2);
    expect(f1.shinsal.twelveSal.year.HUAGAI).toBe(4);
    const f2 = factsFor({ year: [0, 2], month: [2, 2], day: [4, 4], hour: [6, 6] });   // 년지 寅
    expect(f2.shinsal.twelveSal.year.DOHWA).toBe(3);
    expect(f2.shinsal.twelveSal.year.YEOKMA).toBe(8);
    expect(f2.shinsal.twelveSal.year.HUAGAI).toBe(10);
  });
});

describe('양인·비인·학당 (일간 파생 — 기본 luNext 모드)', () => {
  // 기본(luNext, KR 주류): 양인 = 록+1 (음간도 산출). 甲..癸 = 卯辰午未午未酉戌子丑.
  const YANGIN_LUNEXT = [[3], [4], [6], [7], [6], [7], [9], [10], [0], [1]];
  // 이설(diWang): 음간은 록-1(제왕지). 乙→寅, 丁己→巳, 辛→申, 癸→亥.
  const YANGIN_DIWANG = [[3], [2], [6], [5], [6], [5], [9], [8], [0], [11]];
  // 비인 = 양인의 충(+6).
  const BIIN_LUNEXT = [[9], [10], [0], [1], [0], [1], [3], [4], [6], [7]];
  // 학당 = 일간 장생지 (FOLLOW_FIRE): 亥午寅酉寅酉巳子申卯.
  const HAKDANG = [[11], [6], [2], [9], [2], [9], [5], [0], [8], [3]];

  it('일간 10종 전수: 양인(luNext)·비인·학당', () => {
    for (let s = 0; s < 10; s++) {
      const facts = factsFor({ year: [2, 2], month: [4, 4], day: [s, s % 2], hour: [6, 6] });
      expect(facts.shinsal.catalog.dayStem.YANG_IN?.targets, `양인 ${STEM_LABEL[s]}`).toEqual(YANGIN_LUNEXT[s]);
      expect(facts.shinsal.catalog.dayStem.BI_IN_SAL?.targets, `비인 ${STEM_LABEL[s]}`).toEqual(BIIN_LUNEXT[s]);
      expect(facts.shinsal.catalog.dayStem.HAK_DANG_GUI_IN?.targets, `학당 ${STEM_LABEL[s]}`).toEqual(HAKDANG[s]);
    }
  });

  it("yanginMode 'diWang' 이설: 음간은 제왕지(록-1)로 이동", () => {
    for (let s = 0; s < 10; s++) {
      const facts = factsFor(
        { year: [2, 2], month: [4, 4], day: [s, s % 2], hour: [6, 6] },
        { shinsal: { yanginMode: 'diWang' } },
      );
      expect(facts.shinsal.catalog.dayStem.YANG_IN?.targets, `양인(diWang) ${STEM_LABEL[s]}`).toEqual(YANGIN_DIWANG[s]);
    }
  });
});

describe('공망 6순 표 (일주 기준 — 표준 旬空亡表)', () => {
  // 각 순(甲子旬..甲寅旬)의 첫 일주와 끝 일주로 12케이스.
  // 甲子旬→戌亥, 甲戌旬→申酉, 甲申旬→午未, 甲午旬→辰巳, 甲辰旬→寅卯, 甲寅旬→子丑.
  const CASES: Array<{ label: string; day: [number, number]; pair: [number, number] }> = [
    { label: '甲子旬 첫(甲子)', day: [0, 0], pair: [10, 11] },
    { label: '甲子旬 끝(癸酉)', day: [9, 9], pair: [10, 11] },
    { label: '甲戌旬 첫(甲戌)', day: [0, 10], pair: [8, 9] },
    { label: '甲戌旬 끝(癸未)', day: [9, 7], pair: [8, 9] },
    { label: '甲申旬 첫(甲申)', day: [0, 8], pair: [6, 7] },
    { label: '甲申旬 끝(癸巳)', day: [9, 5], pair: [6, 7] },
    { label: '甲午旬 첫(甲午)', day: [0, 6], pair: [4, 5] },
    { label: '甲午旬 끝(癸卯)', day: [9, 3], pair: [4, 5] },
    { label: '甲辰旬 첫(甲辰)', day: [0, 4], pair: [2, 3] },
    { label: '甲辰旬 끝(癸丑)', day: [9, 1], pair: [2, 3] },
    { label: '甲寅旬 첫(甲寅)', day: [0, 2], pair: [0, 1] },
    { label: '甲寅旬 끝(癸亥)', day: [9, 11], pair: [0, 1] },
  ];

  it('6순 × 첫/끝 일주 12케이스 전부 표준표와 일치', () => {
    for (const c of CASES) {
      const facts = factsFor({ year: [2, 2], month: [4, 4], day: c.day, hour: [6, 6] });
      expect(facts.shinsal.gongmang.day, c.label).toEqual(c.pair);
    }
  });
});
