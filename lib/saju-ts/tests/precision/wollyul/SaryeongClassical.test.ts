import { describe, it, expect } from 'vitest';
import { createEngine } from '../../../src/api/engine.js';
import type { AnalysisBundle } from '../../../src/api/types.js';
import { findSaryeong } from '../../../src/core/wollyul.js';

/**
 * Smoke regression for the new saryeongScheme paths against the
 * saju_master v9.2 worked example for 1982-11-18 08:00 KST male:
 *
 *   - 입동 (立冬, ≈ 1982-11-08 KST) → elapsedDays ≈ 10
 *   - 亥월 司令 day-counts: 戊 7  /  甲 7  /  壬 16
 *   - elapsedDays in [7, 14) → 中氣 = 甲 commands
 *   - 일간 乙 (Z=1), 甲 (Z=0) → 劫財 (JIE_CAI / GEOPJAE)
 *
 * The fixture in tests/precision/fixtures/saju_master_education_cases
 * .json records the same expectation in the `additionalChecks.saryeong`
 * field for the edu-1982-11-18 case.
 */

interface RuleFactsLike {
  month: {
    branch: number;
    saryeong?: {
      scheme: 'classical' | 'scaled';
      stem: number;
      qi: 'CHO' | 'JUNG' | 'JEONG';
      tenGod: string;
      elapsedDays: number;
      monthLengthDays: number;
    };
  };
}

function getMonthFacts(bundle: AnalysisBundle): RuleFactsLike['month'] {
  const facts = bundle.report.facts as Record<string, unknown>;
  const ruleFacts = facts['rules.facts'] as RuleFactsLike | undefined;
  if (!ruleFacts) throw new Error("'rules.facts' missing from bundle");
  return ruleFacts.month;
}

describe('Saryeong: 1982-11-18 08:00 KST classical scheme', () => {
  const REQUEST = {
    birth: { instant: '1982-11-18T08:00:00+09:00' },
    sex: 'M' as const,
    location: { lat: 37.5665, lon: 126.978, name: 'Seoul' },
  };

  it('classical scheme picks 甲 (中氣) at elapsed≈10 in 亥월', () => {
    const engine = createEngine({
      toggles: {
        pillars: true,
        relations: true,
        tenGods: true,
        hiddenStems: true,
        elementDistribution: true,
        rules: true,
        lifeStages: true,
        stemRelations: true,
        fortune: false,
      },
      weights: {
        hiddenStems: { saryeongScheme: 'classical' },
      },
    });

    const r = engine.analyze(REQUEST);
    const month = getMonthFacts(r);

    // 亥 = branch 11
    expect(month.branch).toBe(11);
    expect(month.saryeong).toBeDefined();
    const sar = month.saryeong!;
    expect(sar.scheme).toBe('classical');
    // 甲 = stem 0
    expect(sar.stem).toBe(0);
    expect(sar.qi).toBe('JUNG');
    // 일간 乙(1) vs 甲(0) → 劫財 (project enum string is 'GEOB_JAE')
    expect(sar.tenGod).toBe('GEOB_JAE');
    // elapsed should land in [7, 14)
    expect(sar.elapsedDays).toBeGreaterThanOrEqual(7);
    expect(sar.elapsedDays).toBeLessThan(14);
  });

  it('default config (no saryeongScheme) leaves month.saryeong undefined', () => {
    const engine = createEngine({
      toggles: {
        pillars: true,
        relations: true,
        tenGods: true,
        hiddenStems: true,
        elementDistribution: true,
        rules: true,
        lifeStages: true,
        stemRelations: true,
        fortune: false,
      },
    });

    const r = engine.analyze(REQUEST);
    const month = getMonthFacts(r);
    expect(month.saryeong).toBeUndefined();
  });

  it('findSaryeong unit: 亥(11), elapsedDays=10, monthLength=30 → 甲(0)/中氣', () => {
    const r = findSaryeong(11, 10, 30, 'classical');
    expect(r.stem).toBe(0);
    expect(r.qi).toBe('JUNG');
    expect(r.scheme).toBe('classical');
  });

  it('findSaryeong unit: 亥(11), elapsedDays=3, monthLength=30 → 戊(4)/餘氣', () => {
    const r = findSaryeong(11, 3, 30, 'classical');
    expect(r.stem).toBe(4);
    expect(r.qi).toBe('CHO');
  });

  it('findSaryeong unit: 亥(11), elapsedDays=20, monthLength=30 → 壬(8)/正氣', () => {
    const r = findSaryeong(11, 20, 30, 'classical');
    expect(r.stem).toBe(8);
    expect(r.qi).toBe('JEONG');
  });
});
