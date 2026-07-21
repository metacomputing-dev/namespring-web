import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';
import type { BranchIdx } from './cycle.js';
import { pillar } from './cycle.js';
import { detectBranchRelations, samhapGroup } from './branchRelations.js';
import { detectStemRelations } from './stemRelations.js';
import { applyInteractionAdjustments } from './elementInteractionAdjust.js';
import { elementDistributionFromPillars } from './elementDistribution.js';

/**
 * PR-5 (감사 B448) — 합충 보정 오행 분포 옵션 틀 테스트.
 * 핵심 계약: 기본 off — 기본 분포는 바이트 불변, 옵트인 시에만 additive 노출.
 */
describe('합충 보정 분포 (옵션 틀 — 기본 off)', () => {
  it('충 손상: 참여 지지 지장간 기여가 감쇠되고 adjustments에 기록된다', () => {
    // 甲子년 庚午월 甲申일 癸酉시 — 子午충.
    const pillars: [any, any, any, any] = [pillar(0, 0), pillar(6, 6), pillar(0, 8), pillar(9, 9)];
    const branches = pillars.map((p) => p.branch as BranchIdx);
    const adj = applyInteractionAdjustments({
      pillars,
      branchRelations: detectBranchRelations(branches),
      stemRelations: detectStemRelations(pillars.map((p) => p.stem)),
    });
    expect(adj.adjustments.some((a) => a.kind === 'CHUNG_DAMAGE' && a.delta < 0)).toBe(true);
    // 회국(子申반합 水局)도 기록
    expect(adj.adjustments.some((a) => a.kind === 'HOEGUK_BONUS' && a.element === 'WATER')).toBe(true);
  });

  it('합거 감쇠: 일간은 특례 보호, 상대 천간만 감쇠', () => {
    // 甲子년 己巳월 甲戌일 丙寅시 — 甲(년)·己(월)·甲(일): 값 매칭 한계로 甲은 일간 값이라 보호.
    const pillars: [any, any, any, any] = [pillar(0, 0), pillar(5, 5), pillar(0, 10), pillar(2, 2)];
    const adj = applyInteractionAdjustments({
      pillars,
      branchRelations: detectBranchRelations(pillars.map((p) => p.branch as BranchIdx)),
      stemRelations: detectStemRelations(pillars.map((p) => p.stem)),
    });
    const hapgeo = adj.adjustments.filter((a) => a.kind === 'HAPGEO_DAMPING');
    // 己(월간)만 감쇠 — 甲은 일간 값이라 년간 甲도 보호(값 매칭 한계, 모듈 주석 명시)
    expect(hapgeo.length).toBe(1);
    expect(hapgeo[0]!.element).toBe('EARTH');
  });

  it('엔진 계약: 기본 off — summary에 elementDistributionAdjusted가 없다', () => {
    const engine = createEngine({});
    const bundle = engine.analyze({ birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' } as any);
    expect((bundle.summary as any).elementDistributionAdjusted).toBeUndefined();
    expect(bundle.summary?.elementDistribution).toBeTruthy();
  });

  it('엔진 계약: 옵트인 시 additive 노출 + 기본 분포 불변', () => {
    const req: any = { birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' };
    const base = createEngine({}).analyze(req);
    const opted = createEngine({ strategies: { elements: { interactionAdjusted: true } } } as any).analyze(req);
    const adjusted = (opted.summary as any).elementDistributionAdjusted;
    expect(adjusted).toBeTruthy();
    expect(Array.isArray(adjusted.adjustments)).toBe(true);
    // 기본 분포는 옵트인과 무관하게 동일 (바이트 불변 계약)
    expect(opted.summary?.elementDistribution).toEqual(base.summary?.elementDistribution);
  });

  it('uses the same base weights when position weighting and interaction adjustment are combined', () => {
    const pillars: [any, any, any, any] = [
      pillar(0, 0), pillar(2, 1), pillar(4, 2), pillar(6, 3),
    ];
    const weights = {
      heavenStemWeight: 2,
      branchTotalWeight: 3,
      positionWeights: { month: 4 },
      heavenPositionWeights: { day: 5 },
      branchPositionWeights: { hour: 6 },
    };
    const base = elementDistributionFromPillars(pillars, weights);
    const adjusted = applyInteractionAdjustments({
      pillars,
      branchRelations: [],
      stemRelations: [],
      ...weights,
    });

    expect(adjusted.heaven).toEqual(base.heaven);
    expect(adjusted.hidden).toEqual(base.hidden);
    expect(adjusted.total).toEqual(base.total);
    expect(adjusted.adjustments).toEqual([]);
  });
});
