import { describe, expect, it } from 'vitest';

import type { StemIdx } from '../core/cycle.js';
import { computeGyeokgukSeongpae } from './gyeokgukSeongpae.js';

/**
 * PR-6 — 격국 성패(자평진전 순용/역용) 룰 테이블 단위 테스트.
 * stem 0=甲..9=癸. 일간 甲(0) 기준 십성: 庚(6)=편관, 辛(7)=정관, 戊(4)=편재,
 * 己(5)=정재, 丙(2)=식신, 丁(3)=상관, 壬(8)=편인, 癸(9)=정인, 甲(0)=비견, 乙(1)=겁재.
 */
function run(args: {
  gyeokTenGod: any;
  bigyeopSubtype?: 'GEONROK' | 'YANGIN' | 'WOLGEOB' | null;
  otherStems: number[];
  monthBroken?: boolean;
  monthHiddenStems?: any[];
  tenGodScores?: Record<string, number>;
  dayMasterSelfScore?: number;
  policy?: any;
}) {
  return computeGyeokgukSeongpae({
    gyeokTenGod: args.gyeokTenGod,
    bigyeopSubtype: args.bigyeopSubtype ?? null,
    dayStem: 0 as StemIdx, // 甲 일간
    otherStems: args.otherStems as StemIdx[],
    monthBroken: args.monthBroken ?? false,
    monthHiddenStems: args.monthHiddenStems as any,
    tenGodScores: args.tenGodScores as any,
    dayMasterSelfScore: args.dayMasterSelfScore,
    policy: args.policy,
  });
}

describe('격국 성패 룰 테이블 (PR-6 — 자평진전 순용/역용)', () => {
  it('정관격 + 재 투출 → 성격 (재생관 상신)', () => {
    const r = run({ gyeokTenGod: 'JEONG_GWAN', otherStems: [5, 8, 6] })!; // 己(정재)·壬·庚
    expect(r.verdict).toBe('SEONGGYEOK');
    expect(r.usage).toBe('SUNYONG');
    expect(r.sangshin).toBe('JEONG_JAE');
  });

  it('정관격 + 상관 투출·구응 무 → 파격 (상관견관)', () => {
    const r = run({ gyeokTenGod: 'JEONG_GWAN', otherStems: [3, 6, 4] })!; // 丁(상관)·庚·戊 — 戊는 편재(상신)지만 파격요인 공존
    // 상관 파격요인 + 인성 구응 무 + 재 상신 공존 → 성중유패
    expect(r.verdict).toBe('SEONGJUNG_YUPA');
    expect(r.pagyeokFactor).toBe('SANG_GWAN');
  });

  it('정관격 + 상관 투출 + 인성 구응 → 패중유구', () => {
    const r = run({ gyeokTenGod: 'JEONG_GWAN', otherStems: [3, 9, 6] })!; // 丁(상관)·癸(정인)
    expect(r.verdict).toBe('PAJUNG_YUGU');
    expect(r.gueung).toBe('JEONG_IN');
  });

  it('칠살격 + 식신 투출 → 성격 (식신제살)', () => {
    const r = run({ gyeokTenGod: 'PYEON_GWAN', otherStems: [2, 6, 8] })!; // 丙(식신)
    expect(r.verdict).toBe('SEONGGYEOK');
    expect(r.usage).toBe('YEOKYONG');
    expect(r.sangshin).toBe('SIK_SHIN');
  });

  it('식신격 + 편인 투출·재 무 → 파격 (효신탈식)', () => {
    const r = run({ gyeokTenGod: 'SIK_SHIN', otherStems: [8, 6, 0] })!; // 壬(편인)
    expect(r.verdict).toBe('PAGYEOK');
    expect(r.pagyeokFactor).toBe('PYEON_IN');
  });

  it('식신격 + 편인 투출 + 재 구응 → 패중유구', () => {
    const r = run({ gyeokTenGod: 'SIK_SHIN', otherStems: [8, 5, 0] })!; // 壬(편인)+己(정재)
    expect(r.verdict).toBe('PAJUNG_YUGU');
    expect(r.gueung).toBe('JEONG_JAE');
  });

  it('양인격 + 관살 무 → 파격 (양인가살 부재)', () => {
    const r = run({ gyeokTenGod: 'GEOB_JAE', bigyeopSubtype: 'YANGIN', otherStems: [2, 5, 9] })!;
    expect(r.verdict).toBe('PAGYEOK');
  });

  it('양인격 + 칠살 투출 → 성격 (양인가살)', () => {
    const r = run({ gyeokTenGod: 'GEOB_JAE', bigyeopSubtype: 'YANGIN', otherStems: [6, 5, 9] })!; // 庚(편관)
    expect(r.verdict).toBe('SEONGGYEOK');
    expect(r.sangshin).toBe('PYEON_GWAN');
  });

  it('건록격 + 재·관·식 전무 → 파격 (외구 부재)', () => {
    const r = run({ gyeokTenGod: 'BI_GYEON', bigyeopSubtype: 'GEONROK', otherStems: [0, 1, 9] })!; // 비견·겁재·정인만
    expect(r.verdict).toBe('PAGYEOK');
  });

  it('월지 손상: 성격이 성중유패로 강등된다', () => {
    const r = run({ gyeokTenGod: 'JEONG_GWAN', otherStems: [5, 8, 6], monthBroken: true })!;
    expect(r.verdict).toBe('SEONGJUNG_YUPA');
    expect(r.reasons.some((x) => x.includes('월지 손상'))).toBe(true);
  });

  it('상신·파격 요인 모두 무 → 미확정 (지장간·운 판정은 후속)', () => {
    const r = run({ gyeokTenGod: 'JEONG_IN', otherStems: [2, 2, 2] })!; // 식신만 — 정인격 상신(관살)·파격(재) 무
    expect(r.verdict).toBe('UNDETERMINED');
  });
  it('v1 hiddenSangshin is opt-in and leaves v0 hidden evidence ignored', () => {
    const r = run({
      gyeokTenGod: 'JEONG_IN',
      otherStems: [2, 2, 2],
      monthHiddenStems: [{ stem: 7, tenGod: 'JEONG_GWAN', role: 'MAIN', weight: 0.6 }],
    })!;
    expect(r.verdict).toBe('UNDETERMINED');
    expect(r.sangshin).toBeNull();
    expect(r.sangshinSource).toBeUndefined();
  });
  it('v1 hiddenSangshin recognizes a month hidden stem as secondary sangshin evidence', () => {
    const r = run({
      gyeokTenGod: 'JEONG_IN',
      otherStems: [2, 2, 2],
      monthHiddenStems: [{ stem: 7, tenGod: 'JEONG_GWAN', role: 'MAIN', weight: 0.6 }],
      policy: { hiddenSangshin: { enabled: true } },
    })!;
    expect(r.verdict).toBe('SEONGGYEOK');
    expect(r.sangshin).toBe('JEONG_GWAN');
    expect(r.sangshinSource).toBe('MONTH_HIDDEN');
    expect(r.sangshinHiddenRole).toBe('MAIN');
  });

  it('keeps every transparent candidate ahead of secondary month-hidden evidence', () => {
    const r = run({
      gyeokTenGod: 'JEONG_GWAN',
      otherStems: [4, 2, 2], // transparent PYEON_JAE; JEONG_JAE is absent from stems
      monthHiddenStems: [{ stem: 5, tenGod: 'JEONG_JAE', role: 'MAIN', weight: 0.6 }],
      policy: { hiddenSangshin: { enabled: true } },
    })!;
    expect(r.verdict).toBe('SEONGGYEOK');
    expect(r.sangshin).toBe('PYEON_JAE');
    expect(r.sangshinSource).toBe('TRANSPARENT');
  });

  it('v1 hiddenSangshin ignores residual month hidden stems by default', () => {
    const r = run({
      gyeokTenGod: 'JEONG_IN',
      otherStems: [2, 2, 2],
      monthHiddenStems: [{ stem: 7, tenGod: 'JEONG_GWAN', role: 'RESIDUAL', weight: 0.1 }],
      policy: { hiddenSangshin: { enabled: true } },
    })!;
    expect(r.verdict).toBe('UNDETERMINED');
    expect(r.sangshin).toBeNull();
  });

  it('v1 strengthCompare is opt-in and leaves v0 mixed verdict unchanged', () => {
    const r = run({
      gyeokTenGod: 'JEONG_GWAN',
      otherStems: [3, 5, 6],
      tenGodScores: { SANG_GWAN: 3, JEONG_JAE: 0.4 },
    })!;
    expect(r.verdict).toBe('SEONGJUNG_YUPA');
    expect(r.strengthComparison).toBeUndefined();
  });
  it('v1 strengthCompare downgrades when the breaker is decisively stronger than sangshin', () => {
    const r = run({
      gyeokTenGod: 'JEONG_GWAN',
      otherStems: [3, 5, 6],
      tenGodScores: { SANG_GWAN: 3, JEONG_JAE: 0.4 },
      policy: { strengthCompare: { enabled: true, decisiveMargin: 0.4 } },
    })!;
    expect(r.verdict).toBe('PAGYEOK');
    expect(r.pagyeokFactor).toBe('SANG_GWAN');
    expect(r.strengthComparison).toMatchObject({
      sangshin: 'JEONG_JAE',
      breaker: 'SANG_GWAN',
      decisive: true,
    });
  });

  it('does not label an exact tie decisive when decisiveMargin is zero', () => {
    const r = run({
      gyeokTenGod: 'JEONG_GWAN',
      otherStems: [3, 5, 6],
      tenGodScores: { SANG_GWAN: 1, JEONG_JAE: 1 },
      policy: { strengthCompare: { enabled: true, decisiveMargin: 0 } },
    })!;
    expect(r.verdict).toBe('SEONGJUNG_YUPA');
    expect(r.strengthComparison).toMatchObject({ margin: 0, decisive: false });
  });

  it('captures the pre-month verdict after the strength comparison', () => {
    const r = run({
      gyeokTenGod: 'JEONG_GWAN',
      otherStems: [3, 5, 6],
      monthBroken: true,
      tenGodScores: { SANG_GWAN: 3, JEONG_JAE: 0.4 },
      policy: { strengthCompare: { enabled: true, decisiveMargin: 0.4 } },
    })!;
    expect(r.verdict).toBe('PAGYEOK');
    // Month damage cannot further lower PAGYEOK. A value here would prove
    // the pre-month verdict was captured before strengthCompare completed.
    expect(r.verdictBeforeMonthDamage).toBeUndefined();
  });

  it('excludes the day stem itself from BI_GYEON breaker strength', () => {
    const r = run({
      gyeokTenGod: 'JEONG_JAE',
      otherStems: [0, 8, 8],
      monthHiddenStems: [
        { stem: 2, tenGod: 'SIK_SHIN', role: 'MAIN', weight: 0.6 },
      ],
      tenGodScores: { BI_GYEON: 2, SIK_SHIN: 1.5 },
      dayMasterSelfScore: 1,
      policy: {
        hiddenSangshin: { enabled: true },
        strengthCompare: { enabled: true, decisiveMargin: 0.4 },
      },
    })!;
    expect(r.verdict).toBe('SEONGJUNG_YUPA');
    expect(r.strengthComparison).toMatchObject({
      sangshinScore: 1.5,
      breakerScore: 1,
      margin: 0.5,
      decisive: true,
    });
  });

  it('fails closed when BI_GYEON comparison lacks self provenance', () => {
    expect(() => run({
      gyeokTenGod: 'JEONG_JAE',
      otherStems: [0, 8, 8],
      monthHiddenStems: [
        { stem: 2, tenGod: 'SIK_SHIN', role: 'MAIN', weight: 0.6 },
      ],
      tenGodScores: { BI_GYEON: 2, SIK_SHIN: 1.5 },
      policy: {
        hiddenSangshin: { enabled: true },
        strengthCompare: { enabled: true, decisiveMargin: 0.4 },
      },
    })).toThrow(RangeError);
  });

  it('retains the verdict before month damage so scoring does not count the same damage twice', () => {
    const r = run({
      gyeokTenGod: 'JEONG_GWAN',
      otherStems: [5, 8, 6],
      monthBroken: true,
      policy: { retainPreMonthVerdict: true },
    })!;
    expect(r.verdict).toBe('SEONGJUNG_YUPA');
    expect(r.verdictBeforeMonthDamage).toBe('SEONGGYEOK');
  });
});
