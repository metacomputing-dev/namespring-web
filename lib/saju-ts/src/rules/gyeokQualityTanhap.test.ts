import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';

/**
 * PR-5 (감사 B510) — 격국 damage의 탐합망충(貪合忘沖) 해소 단위 테스트.
 * stem 0=甲..9=癸, branch 0=子..11=亥.
 */
function qualityOf(
  pillarSpec: { year: [number, number]; month: [number, number]; day: [number, number]; hour: [number, number] },
  tanhap?: Record<string, unknown>,
) {
  const config = normalizeConfig({
    strategies: tanhap !== undefined ? { gyeokguk: { quality: { tanhap } } } : {},
  });
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
  return buildRuleFacts({ config, pillars, elementDistribution, scoring }).month.gyeok.quality;
}

describe('탐합망충 — 격국 damage 해소 (감사 B510)', () => {
  // 庚午년 壬子월 丁丑일 辛亥시 — 월지 子 연루 子午충 + 子丑육합(제3자 합).
  const YUKHAP_CASE = { year: [6, 6], month: [8, 0], day: [3, 1], hour: [7, 11] } as const;

  it('육합 해소: 충 damage가 잔존 계수 0.5로 감산되고 내역이 기록된다', () => {
    const q = qualityOf(YUKHAP_CASE);
    const d: any = q.details;
    expect(d?.damageResolved?.length).toBeGreaterThan(0);
    expect(d?.damageRaw).toBeGreaterThan(q.damage);
    const chungResolved = d.damageResolved.find((x: any) => x.relation.type === 'CHUNG');
    expect(chungResolved?.residualFactor).toBe(0.5); // YUKHAP 기본 잔존 계수
    expect(q.reasons.some((r) => r.startsWith('탐합망충해소:CHUNG'))).toBe(true);
    // 충 1건(w=1.0)이 0.5로 감산 → brokenDamageThreshold(1.0) 밑 = broken 해제 방향
    expect(q.broken).toBe(false);
  });

  it('삼합 완전체 해소: 온전한 삼합국은 충으로 깨지지 않는다 (잔존 0.0)', () => {
    // 甲午년 甲子월 壬申일 甲辰시 — 월지 子: 子午충 + 申子辰 삼합 완전체.
    const q = qualityOf({ year: [0, 6], month: [0, 0], day: [8, 8], hour: [0, 4] });
    const d: any = q.details;
    const chungResolved = d?.damageResolved?.find((x: any) => x.relation.type === 'CHUNG');
    expect(chungResolved?.residualFactor).toBe(0); // SAMHAP 완전 해소
    expect(chungResolved?.via?.some((v: any) => v.type === 'SAMHAP')).toBe(true);
  });

  it('합신 피충 무효: 해소자의 제3지가 자체 충을 맞으면 해소되지 않는다', () => {
    // 甲子년 庚午월 丁丑일 辛未시 — 월지 午: 子午충. 해소 후보 子丑합·午未합의
    // 제3지(丑·未)가 서로 丑未충 → 양쪽 다 불인정 → 미해소.
    const q = qualityOf({ year: [0, 0], month: [6, 6], day: [3, 1], hour: [7, 7] });
    const d: any = q.details;
    const chungResolved = d?.damageResolved?.find((x: any) => x.relation.type === 'CHUNG');
    expect(chungResolved).toBeUndefined();
    expect(q.broken).toBe(true); // 충 1.0 그대로 → broken 유지
  });

  it('kill switch: tanhap.enabled=false는 현행 수치와 동일(damageRaw/damageResolved 부재)', () => {
    const on = qualityOf(YUKHAP_CASE);
    const off = qualityOf(YUKHAP_CASE, { enabled: false });
    const dOn: any = on.details;
    const dOff: any = off.details;
    expect(dOff?.damageResolved).toBeUndefined();
    expect(dOff?.damageRaw).toBeUndefined();
    expect(off.damage).toBe(dOn.damageRaw); // off의 damage = on의 해소 前 값
    expect(off.damage).toBeGreaterThan(on.damage);
    // 원 카운트(damageByType)는 양쪽 동일 — 해소는 damageResolved로만 표현.
    expect(dOff?.damageByType).toEqual(dOn?.damageByType);
  });

  it.each(['HYEONG', 'SAMHYEONG'] as const)(
    '%s target은 canonical 삼형을 구성쌍별로 부분 해소하고 한 번만 점수화한다',
    (targetType) => {
      // 丑未戌 삼형 + 子丑 육합: 丑未·丑戌 residual 0.5, 未戌 residual 1.
      const q = qualityOf(
        { year: [0, 1], month: [1, 7], day: [2, 10], hour: [3, 0] },
        { enabled: true, targetTypes: [targetType] },
      );
      const details: any = q.details;
      const samhyeong = details.damageResolved.find((row: any) => row.relation.type === 'SAMHYEONG');
      expect(samhyeong).toBeDefined();
      expect(samhyeong.residualFactor).toBeCloseTo(2 / 3, 12);
      expect(samhyeong.resolutionUnits.map((unit: any) => ({
        members: unit.members,
        residual: unit.residualFactor,
      }))).toEqual([
        { members: [1, 7], residual: 0.5 },
        { members: [1, 10], residual: 0.5 },
        { members: [7, 10], residual: 1 },
      ]);
      expect(details.damageRelations.filter((row: any) => row.type === 'SAMHYEONG')).toHaveLength(1);
      expect(details.damageByType.HYEONG).toBe(1);
      expect(details.damageRaw - q.damage).toBeCloseTo(0.8 / 3, 12);
    },
  );
});
