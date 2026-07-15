import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';

/**
 * PR-5 (감사 B448/B510/B531) — 합충 상호작용 → 신강약 주입 단위 테스트.
 * stem 0=甲..9=癸, branch 0=子..11=亥.
 *
 * 12지 관계 조견표 밀도상 어떤 4지지 조합도 부수 관계가 따라오므로,
 * 단언은 '켬/끔 비교의 방향성 + 발동 내역(details.interaction)' 방식이다.
 */
function strengthOf(
  pillarSpec: { year: [number, number]; month: [number, number]; day: [number, number]; hour: [number, number] },
  interaction?: Record<string, unknown>,
) {
  const config = normalizeConfig({
    strategies: { strength: { model: 'deLingDiShi', ...(interaction !== undefined ? { interaction } : {}) } },
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
  return buildRuleFacts({ config, pillars, elementDistribution, scoring }).strength;
}

const OFF = { enabled: false };

describe('충 손상 → 통근 감쇠 (감사 B448)', () => {
  // 乙酉년 丁卯월 甲寅일 甲子시 — 甲 일간, 卯월 득령 + 寅 통근. 卯酉충(미해소).
  const CHART = { year: [1, 9], month: [3, 3], day: [0, 2], hour: [0, 0] } as const;

  it('충 손상 on이면 index가 off 대비 낮아진다 (월지 卯 뿌리 손상)', () => {
    const on = strengthOf(CHART);
    const off = strengthOf(CHART, OFF);
    expect(on.index).toBeLessThan(off.index);
    const inter = (on.details as any)?.delingdiShi?.interaction;
    expect(inter?.branchDamageFactors?.[1]).toBeLessThan(1); // 월지(卯) 감쇠
    expect(inter?.branchDamageFactors?.[2]).toBe(1);         // 일지(寅)는 충 무관
  });

  it('damageFactors를 완화(0.9)하면 감쇠 폭이 줄어든다 (파라미터 동작)', () => {
    const strong = strengthOf(CHART); // CHUNG 0.5 기본
    const mild = strengthOf(CHART, { root: { damageFactors: { CHUNG: 0.9 } } });
    const off = strengthOf(CHART, OFF);
    expect(mild.index).toBeGreaterThan(strong.index);
    expect(mild.index).toBeLessThan(off.index);
  });
});

describe('탐합망충 해소 (감사 B510)', () => {
  // 庚午년 壬子월 丁丑일 辛亥시 — 子午충 + 子丑육합(제3자 합) → 충 해소.
  const CHART = { year: [6, 6], month: [8, 0], day: [3, 1], hour: [7, 11] } as const;

  it('해소 on이면 충 감쇠가 취소되고 resolved에 기록된다', () => {
    const on = strengthOf(CHART);
    const inter = (on.details as any)?.delingdiShi?.interaction;
    expect(inter?.resolved?.some((r: any) => r.type === 'CHUNG')).toBe(true);
    // 해소됐으므로 子(월지)·午(년지) 감쇠 없음
    expect(inter?.branchDamageFactors?.[0]).toBe(1);
    expect(inter?.branchDamageFactors?.[1]).toBe(1);
  });

  it('해소 off(resolveByHap=false)이면 충 감쇠가 살아난다', () => {
    const resolvedRun = strengthOf(CHART);
    const unresolved = strengthOf(CHART, { root: { resolveByHap: false } });
    const interU = (unresolved.details as any)?.delingdiShi?.interaction;
    expect(interU?.branchDamageFactors?.[1]).toBeLessThan(1);
    // 丁 일간에게 子(관살) 뿌리는 pressure 축이라 index 부호 방향은 명식 의존 —
    // 발동 여부만 단언하고 값 비교는 생략(방향성은 위 충 손상 테스트가 커버).
    expect(resolvedRun.index).not.toBe(unresolved.index);
  });
});

describe('회국 보정 (감사 B448 — 삼합/반합)', () => {
  // 癸亥년 丁卯월 甲午일 辛未시 — 亥卯未 완전 삼합 목국(甲 일간과 동일 오행).
  const SAMHAP_CHART = { year: [9, 11], month: [3, 3], day: [0, 6], hour: [7, 7] } as const;

  it('완전 삼합(일간 동일 오행 국)이 support를 끌어올린다', () => {
    const on = strengthOf(SAMHAP_CHART);
    const off = strengthOf(SAMHAP_CHART, OFF);
    expect(on.index).toBeGreaterThan(off.index);
    const inter = (on.details as any)?.delingdiShi?.interaction;
    expect(inter?.hui?.supportBonus).toBeGreaterThan(0);
    expect(inter?.hui?.groups?.some((g: any) => g.type === 'SAMHAP' && g.element === 'WOOD')).toBe(true);
  });

  it('반합 멤버가 미해소 충 손상 중이면 그 반합은 파국된다', () => {
    // 甲子년 庚午월 甲申일 癸酉시 — 子午충(해소자 없음) + 子申반합(水局): 子 손상 → 파국.
    // (주의: 해소자가 있는 명식 — 예: 午未육합 보유 — 은 충이 먼저 해소되어 파국이 안 선다.)
    const s = strengthOf({ year: [0, 0], month: [6, 6], day: [0, 8], hour: [9, 9] });
    const inter = (s.details as any)?.delingdiShi?.interaction;
    expect(inter?.resolved?.length ?? 0).toBe(0); // 해소자 없음 확인
    const banhap = inter?.hui?.groups?.find((g: any) => g.type === 'BANHAP');
    expect(banhap?.reason).toBe('BROKEN_BY_DAMAGE');
    expect(banhap?.applied).toBe(0);
  });
});

describe('천간합 기반(羈絆) 감쇠 (감사 B531)', () => {
  // 甲子년 己巳월 甲戌일 丙寅시 — 甲(년간)·甲(일간)·己(월간): 쟁합 구도.
  // 일간 甲은 得势 루프에 애초에 없으므로(비겁·인성만 계상) 특례 코드 불필요 — 년간 甲만 감쇠.
  const CHART = { year: [0, 0], month: [5, 5], day: [0, 10], hour: [2, 2] } as const;

  it('묶인 년간 甲(비견)의 기여가 감쇠되어 index가 낮아진다', () => {
    const on = strengthOf(CHART);
    const off = strengthOf(CHART, { stemBind: { enabled: false } });
    expect(on.index).toBeLessThan(off.index);
    const inter = (on.details as any)?.delingdiShi?.interaction;
    const bind = inter?.stemBinds?.find((b: any) => b.pos === 'year');
    expect(bind?.factor).toBeLessThan(1);
    // 쟁합(甲2+己1) → 완화 계수(0.75) 적용
    expect(bind?.factor).toBeCloseTo(0.75, 12);
  });
});

describe('pressure 축 천간합 기반(羈絆) 감쇠 (PR-10-3)', () => {
  // 丙子년 辛丑월 甲寅일 戊辰시 — 甲 일간에게 辛은 정관, 丙辛合으로 관성 투간이 묶인다.
  const CHART = { year: [2, 0], month: [7, 1], day: [0, 2], hour: [4, 4] } as const;

  it('does not add pressure evidence keys on the default path', () => {
    const strength = strengthOf(CHART);
    const interaction = (strength.details as any)?.delingdiShi?.interaction;
    expect(Object.hasOwn(interaction ?? {}, 'pressureStemBinds')).toBe(false);
  });

  it('명시 opt-in이면 묶인 정관 辛의 pressure 기여가 감쇠되어 index가 신강 방향으로 이동한다', () => {
    const off = strengthOf(CHART);
    const on = strengthOf(CHART, { stemBind: { applyToPressure: true } });

    expect(on.pressure).toBeLessThan(off.pressure);
    expect(on.index).toBeGreaterThan(off.index);
    expect(on.components.officers).toBeCloseTo(off.components.officers, 12);

    const inter = (on.details as any)?.delingdiShi?.interaction;
    const bind = inter?.pressureStemBinds?.find((b: any) => b.pos === 'month');
    expect(bind?.stem).toBe(7);
    expect(bind?.tenGod).toBe('JEONG_GWAN');
    expect(bind?.factor).toBeCloseTo(0.5, 12);
    expect(bind?.reduction).toBeCloseTo(0.5, 12);
    expect(inter?.pressureStemBindPenalty?.score).toBeGreaterThan(0);
    expect(inter?.pressureStemBindPenalty?.normalized).toBeGreaterThan(0);
    expect(inter?.pressureStemBindPenalty?.factor).toBeGreaterThan(0);

    const basePressure = on.components.outputs + on.components.wealth + on.components.officers;
    expect(off.pressure - on.pressure).toBeCloseTo(
      basePressure * inter.pressureStemBindPenalty.factor,
      12,
    );
  });

  it('falls back to governed unit factors for values outside [0,1]', () => {
    const baseline = strengthOf(CHART, { stemBind: { applyToPressure: true } });
    const invalid = strengthOf(CHART, {
      stemBind: { applyToPressure: true, factor: -5, jaenghapFactor: 2 },
    });
    expect(invalid.index).toBeCloseTo(baseline.index, 12);
    expect(invalid.pressure).toBeCloseTo(baseline.pressure, 12);
  });
});

describe('opt-out 안정성', () => {
  it('interaction.enabled=false는 관계 유무와 무관하게 보정 전무(details.interaction 부재)', () => {
    const s = strengthOf({ year: [1, 9], month: [3, 3], day: [0, 2], hour: [0, 0] }, OFF);
    expect((s.details as any)?.delingdiShi?.interaction).toBeUndefined();
  });
});
