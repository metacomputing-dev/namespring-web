import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import type { BranchIdx, Element, StemIdx } from '../core/cycle.js';
import { STEM_HANJA, BRANCH_HANJA, stemElement, stemIdxFromHanja } from '../core/cycle.js';
import { computeJohooTemplate } from './johooTemplate.js';
import { QIONG_TONG_BAO_JIAN_TABLE } from './packs/johooQiongTongBaoJianTable.js';

/**
 * 궁통보감 120셀 배선 테스트 (감사 B12).
 * climateScores를 전부 0으로 줘 bonus 단정을 순수하게 만든다.
 */
const ZERO_CLIMATE: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };

function run(config: unknown, dayStem: number, monthBranch: number) {
  return computeJohooTemplate(normalizeConfig(config) as any, {
    dayStem: dayStem as StemIdx,
    monthBranch: monthBranch as BranchIdx,
    climateScores: ZERO_CLIMATE,
  });
}

const QTBJ = { school: { id: 'qiongTongBaoJian' } };

describe('궁통보감 조후용신표 배선 (감사 B12)', () => {
  it('기본 경로 무파급: 템플릿 자체가 null (enabled=false + weight 0 이중 가드)', () => {
    expect(run({}, 0, 2)).toBeNull();
  });

  it('기존 johoo.strict 프리셋 불변: 互不离 경로 유지 (甲→庚, monthTable 필드 없음)', () => {
    const r = run({ school: { id: 'johoo.strict' } }, 0, 2)!;
    expect(r).not.toBeNull();
    expect(r.preferredStemHanja).toEqual(['庚']);
    expect(r.bonus.METAL).toBeCloseTo(0.3, 12); // johoo.strict stemPreferenceBoost=0.3
    expect(r.monthTable).toBeUndefined();
    expect(r.reasons.join('|')).toContain('stemPreference:甲');
  });

  it('셀 적중(甲寅=丙(癸)): 주용신 0.5 + 보좌 0.25, 互不离 庚 대체 확인', () => {
    const r = run(QTBJ, 0, 2)!; // 甲 × 寅
    expect(r.monthTable?.source).toBe('qiongTongBaoJian');
    expect(r.monthTable?.primaryStemHanja).toBe('丙');
    expect(r.monthTable?.secondaryStemHanja).toEqual(['癸']);
    expect(r.bonus.FIRE).toBeCloseTo(0.5, 12);   // 丙
    expect(r.bonus.WATER).toBeCloseTo(0.25, 12); // 癸
    expect(r.bonus.METAL).toBeCloseTo(0, 12);    // 互不离 庚이 대체됐다
    expect(r.reasons.join('|')).toContain('monthTable:甲寅:丙(癸)');
  });

  it('겨울 셀(甲子=丁(庚丙)): 표 적중 시 일반 계절 힌트를 대체한다', () => {
    const r = run(QTBJ, 0, 0)!; // 甲 × 子
    // 셀: 丁(primary 0.5, FIRE) + 庚·丙(secondary 각 0.25).
    // 일반 seasonMandatory/seasonStemHelper는 표 자체의 우선순위를 뒤집지 않도록 제외한다.
    expect(r.bonus.FIRE).toBeCloseTo(0.5 + 0.25, 12);
    expect(r.bonus.METAL).toBeCloseTo(0.25, 12); // 庚
    expect(r.reasons.join('|')).not.toContain('seasonMandatory');
    expect(r.reasons.join('|')).not.toContain('seasonStemHelper');
    expect(r.monthTable?.primaryStemHanja).toBe('丁');
  });

  it('동일 오행 보좌가 여러 개여도 월표 주용신과 top-level primary가 정합한다', () => {
    const r = run(QTBJ, 0, 3)!; // 甲 × 卯 = 庚(丙丁戊己)
    expect(r.monthTable?.primaryStemHanja).toBe('庚');
    expect(r.bonus.METAL).toBeCloseTo(0.5, 12);
    expect(r.bonus.FIRE).toBeCloseTo(0.25, 12);
    expect(r.bonus.EARTH).toBeCloseTo(0.25, 12);
    expect(r.primary).toBe('METAL');
  });

  it('기후 결합 순위와 템플릿 단독 순위를 명시적으로 분리한다', () => {
    const climateScores = { WOOD: 0, FIRE: 2, EARTH: 0, METAL: 0, WATER: 0 };
    const result = computeJohooTemplate(
      normalizeConfig(QTBJ as any),
      { dayStem: 0, monthBranch: 11, climateScores },
    )!;
    expect(result.monthTable?.primaryElement).toBe('METAL');
    expect(result.templatePrimary).toBe('METAL');
    expect(result.primary).toBe('FIRE');
  });

  it('감사 앵커 셀: 丙午=壬(庚), 辛子=丙(戊壬甲), 庚寅=戊(甲壬丙丁)', () => {
    expect(run(QTBJ, 2, 6)!.monthTable?.primaryStemHanja).toBe('壬');
    expect(run(QTBJ, 2, 6)!.monthTable?.secondaryStemHanja).toEqual(['庚']);
    const sin = run(QTBJ, 7, 0)!.monthTable!;
    expect(sin.primaryStemHanja).toBe('丙');
    expect(sin.secondaryStemHanja).toEqual(['戊', '壬', '甲']);
    const gyeong = run(QTBJ, 6, 2)!.monthTable!;
    expect(gyeong.primaryStemHanja).toBe('戊');
    expect(gyeong.secondaryStemHanja).toEqual(['甲', '壬', '丙', '丁']);
  });

  it('커스텀 부분 테이블: 미수록 셀은 기존 경로 폴백 + monthTableMiss 관측', () => {
    const custom = {
      school: { id: 'johoo.strict' },
      strategies: {
        yongshin: {
          johooTemplate: {
            monthTable: { '甲': { '寅': { primary: '癸', secondary: [] } } },
          },
        },
      },
    };
    const hit = run(custom, 0, 2)!; // 甲寅 — 수록 셀
    expect(hit.monthTable?.source).toBe('custom');
    expect(hit.bonus.WATER).toBeCloseTo(0.5, 12);
    expect(hit.bonus.FIRE).toBeCloseTo(0, 12);

    const miss = run(custom, 1, 3)!; // 乙卯 — 미수록 → 기존 경로(乙→癸)
    expect(miss.monthTable).toBeUndefined();
    expect(miss.reasons.join('|')).toContain('monthTableMiss:乙卯');
    expect(miss.bonus.WATER).toBeCloseTo(0.3, 12); // 互不离 癸 (johoo.strict boost 0.3)
  });

  it('monthTableOverride: 내장 이름 위 셀 단위 패치', () => {
    const patched = {
      school: { id: 'qiongTongBaoJian' },
      strategies: {
        yongshin: {
          johooTemplate: {
            monthTableOverride: { '甲': { '寅': { primary: '庚', secondary: ['丁'] } } },
          },
        },
      },
    };
    const r = run(patched, 0, 2)!;
    expect(r.monthTable?.primaryStemHanja).toBe('庚'); // 패치 적용
    expect(r.bonus.METAL).toBeCloseTo(0.5, 12);
    // 패치 밖 셀은 내장 표 유지
    expect(run(patched, 0, 0)!.monthTable?.primaryStemHanja).toBe('丁');
  });

  it('120셀 완전성: 전 셀 존재 + primary/secondary가 유효한 천간 한자', () => {
    let count = 0;
    for (const s of STEM_HANJA) {
      for (const b of BRANCH_HANJA) {
        const cell = QIONG_TONG_BAO_JIAN_TABLE[s][b];
        expect(cell, `${s}${b}`).toBeTruthy();
        expect(stemIdxFromHanja(cell.primary), `${s}${b} primary`).not.toBeNull();
        expect(cell.secondary.length).toBeLessThanOrEqual(4);
        for (const sec of cell.secondary) {
          expect(stemIdxFromHanja(sec), `${s}${b} secondary ${sec}`).not.toBeNull();
        }
        const result = run(QTBJ, STEM_HANJA.indexOf(s), BRANCH_HANJA.indexOf(b))!;
        const primaryStem = stemIdxFromHanja(cell.primary)!;
        const primaryElement = stemElement(primaryStem);
        expect(result.monthTable?.primaryElement, `${s}${b} table primary element`).toBe(primaryElement);
        expect(result.monthTable?.secondaryElements, `${s}${b} unique secondary elements`).toEqual(
          [...new Set(cell.secondary.map((stem) => stemElement(stemIdxFromHanja(stem)!)))],
        );
        expect(result.templatePrimary, `${s}${b} template-only primary`).toBe(primaryElement);
        expect(result.primary, `${s}${b} zero-climate primary`).toBe(primaryElement);
        count += 1;
      }
    }
    expect(count).toBe(120);
  });
});
