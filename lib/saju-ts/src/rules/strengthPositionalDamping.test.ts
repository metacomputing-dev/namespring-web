import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';
import type { BranchIdx } from '../core/cycle.js';
import { detectBranchRelations } from '../core/branchRelations.js';
import { computeBranchInteractionFactors } from './facts.js';

/**
 * PR-10-2 (감사 B524/B538) — 궁위 pairs 기반 인접/원격 차등 뿌리 손상.
 * 핵심 계약: positional 기본 off — 기본 감쇠는 값 매칭과 바이트 불변, 옵트인 시에만
 * 기둥 거리(d1 인접/d2 격위/d3 원격) 차등. 동일 지지 과감쇠(원격 인스턴스까지 완전
 * 감쇠) 한계를 원격 완화로 보완한다.
 */

const rootPolOf = (positionalEnabled: boolean): any => ({
  enabled: true,
  damageFactors: { CHUNG: 0.5 },
  floor: 0.3,
  resolveByHap: true,
  resolveTypes: ['YUKHAP', 'SAMHAP'],
  samePairHapResolves: true,
  positional: {
    enabled: positionalEnabled,
    distanceScales: { d1: 1.0, d2: 0.5, d3: 0.25 },
  },
});

describe('궁위 pairs 인접/원격 차등 (기본 off)', () => {
  // 酉(년0) 卯(월1) 丑(일2) 卯(시3): 卯酉충 pairs (0,1) 인접 + (0,3) 원격.
  const branches = [9, 3, 1, 3] as BranchIdx[];
  const detailed = detectBranchRelations(branches);
  const byType: any = {};
  for (const r of detailed) (byType[r.type] ??= []).push(r.members);

  it('전제: 충 record가 pairs [[0,1],[0,3]]로 접혀 있다', () => {
    const chung = detailed.find((r) => r.type === 'CHUNG');
    expect(chung).toBeTruthy();
    expect(chung!.pairs).toEqual([[0, 1], [0, 3]]);
  });

  it('off: 값 매칭 균일 감쇠 — 원격 卯(시)까지 0.5 (기존 동작 바이트 불변)', () => {
    const { factors } = computeBranchInteractionFactors(branches, byType, rootPolOf(false), undefined, detailed);
    expect(factors).toEqual([0.5, 0.5, 1, 0.5]);
  });

  it('on: 인접 쌍(酉·卯월)은 0.5, 원격 卯(시)는 0.875로 완화', () => {
    const { factors } = computeBranchInteractionFactors(branches, byType, rootPolOf(true), undefined, detailed);
    expect(factors[0]).toBe(0.5); // 酉 — 인접 인스턴스가 최강이라 완전 감쇠
    expect(factors[1]).toBe(0.5); // 卯(월) — d1
    expect(factors[2]).toBe(1); // 丑 — 비당사자
    expect(factors[3]).toBeCloseTo(1 - 0.5 * 0.25, 10); // 卯(시) — d3 원격 완화
  });

  it('폴백: pairs/pillarIndexes 없는 구형 입력은 값 매칭으로 동작', () => {
    const legacy: any = [{ type: 'CHUNG', members: [3, 9] }];
    const { factors } = computeBranchInteractionFactors(branches, byType, rootPolOf(true), undefined, legacy);
    expect(factors).toEqual([0.5, 0.5, 1, 0.5]);
  });

  it('triple(삼형)은 거리 차등 없이 완전 적용 — 현행 크기 유지', () => {
    const b2 = [2, 5, 8, 0] as BranchIdx[]; // 寅巳申 + 子
    const synthetic: any = [{ type: 'SAMHYEONG', members: [2, 5, 8], pillarIndexes: [0, 1, 2] }];
    const pol = { ...rootPolOf(true), damageFactors: { SAMHYEONG: 0.7 } };
    const { factors } = computeBranchInteractionFactors(b2, { SAMHYEONG: [[2, 5, 8]] } as any, pol, undefined, synthetic);
    expect(factors[0]).toBe(0.7); // f 그대로 (scale·mult 1 → 부동소수점 왕복 없음)
    expect(factors[1]).toBe(0.7);
    expect(factors[2]).toBe(0.7);
    expect(factors[3]).toBe(1);
  });

  it('엔진 계약: 기본 on — enabled:true 명시와 기본 설정의 강약 판정 동일', () => {
    const req: any = { birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' };
    const base = createEngine({}).analyze(req);
    const on = createEngine({
      strategies: { strength: { interaction: { root: { positional: { enabled: true } } } } },
    } as any).analyze(req);
    expect(on.summary?.strength).toEqual(base.summary?.strength);
  });

  it('엔진 계약: opt-out(enabled:false) 시 격위(d2) 형 손상 명식에서 강약 스코어가 이동한다 (寅巳형)', () => {
    const req: any = { birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' };
    const base = createEngine({}).analyze(req);
    const off = createEngine({
      strategies: { strength: { interaction: { root: { positional: { enabled: false } } } } },
    } as any).analyze(req);
    expect(off.summary?.strength).not.toEqual(base.summary?.strength);
  });
});
