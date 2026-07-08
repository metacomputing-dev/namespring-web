import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';
import { computeBranchInteractionFactors } from '../rules/facts.js';
import type { BranchIdx, Element } from './cycle.js';
import { ALL_ELEMENTS, monthCommandElement, seasonalStateOf, seasonalStatesForMonth } from './seasonalStates.js';

/**
 * PR-10-1 (감사 B434) — 왕상휴수사(旺相休囚死) 조견 핀 + 비대칭 감쇠 knob 계약.
 * 핵심 계약: seasonal 기본 off — 기본 감쇠 계수는 바이트 불변, 옵트인 시에만 비대칭.
 */

// 기대 조견표 — 구현과 독립적으로 저작한 60칸 (지지 12 × 오행 5).
// 當令者旺 · 令生者相 · 生令者休 · 克令者囚 · 令克者死.
// 지지: 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11
const EXPECTED: Record<number, Record<Element, string>> = {
  // 겨울 水令 (亥·子): 水旺 木相 金休 土囚 火死
  0: { WATER: 'WANG', WOOD: 'SANG', METAL: 'HYU', EARTH: 'SU', FIRE: 'SA' },
  11: { WATER: 'WANG', WOOD: 'SANG', METAL: 'HYU', EARTH: 'SU', FIRE: 'SA' },
  // 봄 木令 (寅·卯): 木旺 火相 水休 金囚 土死
  2: { WOOD: 'WANG', FIRE: 'SANG', WATER: 'HYU', METAL: 'SU', EARTH: 'SA' },
  3: { WOOD: 'WANG', FIRE: 'SANG', WATER: 'HYU', METAL: 'SU', EARTH: 'SA' },
  // 여름 火令 (巳·午): 火旺 土相 木休 水囚 金死
  5: { FIRE: 'WANG', EARTH: 'SANG', WOOD: 'HYU', WATER: 'SU', METAL: 'SA' },
  6: { FIRE: 'WANG', EARTH: 'SANG', WOOD: 'HYU', WATER: 'SU', METAL: 'SA' },
  // 가을 金令 (申·酉): 金旺 水相 土休 火囚 木死
  8: { METAL: 'WANG', WATER: 'SANG', EARTH: 'HYU', FIRE: 'SU', WOOD: 'SA' },
  9: { METAL: 'WANG', WATER: 'SANG', EARTH: 'HYU', FIRE: 'SU', WOOD: 'SA' },
  // 사계 土令 (辰·未·戌·丑, 본기 기준): 土旺 金相 火休 木囚 水死
  4: { EARTH: 'WANG', METAL: 'SANG', FIRE: 'HYU', WOOD: 'SU', WATER: 'SA' },
  7: { EARTH: 'WANG', METAL: 'SANG', FIRE: 'HYU', WOOD: 'SU', WATER: 'SA' },
  10: { EARTH: 'WANG', METAL: 'SANG', FIRE: 'HYU', WOOD: 'SU', WATER: 'SA' },
  1: { EARTH: 'WANG', METAL: 'SANG', FIRE: 'HYU', WOOD: 'SU', WATER: 'SA' },
};

describe('왕상휴수사 조견 (60칸 핀)', () => {
  it('12지지 × 5오행 전 칸이 통용 조견표와 일치한다', () => {
    for (let b = 0 as BranchIdx; b < 12; b++) {
      const states = seasonalStatesForMonth(b as BranchIdx);
      for (const el of ALL_ELEMENTS) {
        expect(`${b}:${el}:${states[el]}`).toBe(`${b}:${el}:${EXPECTED[b]![el]}`);
        expect(seasonalStateOf(el, b as BranchIdx)).toBe(EXPECTED[b]![el]);
      }
    }
  });

  it('당령: 사계월은 본기 土', () => {
    expect(monthCommandElement(4 as BranchIdx)).toBe('EARTH'); // 辰
    expect(monthCommandElement(2 as BranchIdx)).toBe('WOOD'); // 寅
    expect(monthCommandElement(0 as BranchIdx)).toBe('WATER'); // 子
  });
});

describe('엔진 표면 (additive)', () => {
  it('summary.seasonalStates가 기본 노출된다 — 辰월(1986-04-19) 土왕', () => {
    const bundle = createEngine({}).analyze({ birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' } as any);
    const ss: any = (bundle.summary as any).seasonalStates;
    expect(ss).toBeTruthy();
    expect(ss.command).toBe('EARTH');
    expect(ss.states.EARTH).toBe('WANG');
    expect(ss.states.METAL).toBe('SANG');
    expect(ss.states.WATER).toBe('SA');
    expect(ss.statesKo.EARTH).toBe('왕');
  });
});

describe('비대칭 뿌리 손상 knob (기본 off)', () => {
  // 子午충, 子월(겨울 水令): 子(WATER)=왕 → 경감, 午(FIRE)=사 → 가중
  const branches = [0, 6, 4, 9] as BranchIdx[];
  const byType: any = { CHUNG: [[0, 6]] };
  const rootPol: any = {
    enabled: true,
    damageFactors: { CHUNG: 0.5 },
    floor: 0.3,
    resolveByHap: false,
    resolveTypes: [],
    samePairHapResolves: true,
  };
  const seasonalPol: any = {
    enabled: true,
    multipliers: { WANG: 0.7, SANG: 0.85, HYU: 1.0, SU: 1.15, SA: 1.3 },
  };

  it('off: 충 당사자 균일 감쇠 0.5 (기존 동작 바이트 불변)', () => {
    const { factors } = computeBranchInteractionFactors(branches, byType, rootPol, {
      pol: { ...seasonalPol, enabled: false },
      monthBranch: 0 as BranchIdx,
    });
    expect(factors[0]).toBe(0.5); // 子
    expect(factors[1]).toBe(0.5); // 午
    expect(factors[2]).toBe(1); // 辰 (비당사자)
    // seasonal 인자 자체를 안 넘긴 경우와도 동일
    const { factors: bare } = computeBranchInteractionFactors(branches, byType, rootPol);
    expect(factors).toEqual(bare);
  });

  it('on: 왕(子)은 경감 0.65, 사(午)는 가중 0.35 — floor 준수', () => {
    const { factors } = computeBranchInteractionFactors(branches, byType, rootPol, {
      pol: seasonalPol,
      monthBranch: 0 as BranchIdx, // 子월 — 水令
    });
    expect(factors[0]).toBeCloseTo(1 - 0.5 * 0.7, 10); // 子 WATER 왕 → 0.65
    expect(factors[1]).toBeCloseTo(Math.max(0.3, 1 - 0.5 * 1.3), 10); // 午 FIRE 사 → 0.35
    expect(factors[2]).toBe(1);
  });

  it('엔진 계약: 기본 설정과 seasonal:{enabled:false} 명시는 강약 판정 동일', () => {
    const req: any = { birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' };
    const base = createEngine({}).analyze(req);
    const off = createEngine({
      strategies: { strength: { interaction: { seasonal: { enabled: false } } } },
    } as any).analyze(req);
    expect(off.summary?.strength).toEqual(base.summary?.strength);
  });

  it('엔진 계약: opt-in 시 뿌리 손상 명식에서 강약 스코어가 이동한다 (寅巳형, 辰월)', () => {
    const req: any = { birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' };
    const base = createEngine({}).analyze(req);
    const on = createEngine({
      strategies: { strength: { interaction: { seasonal: { enabled: true } } } },
    } as any).analyze(req);
    expect(on.summary?.strength).not.toEqual(base.summary?.strength);
  });
});
