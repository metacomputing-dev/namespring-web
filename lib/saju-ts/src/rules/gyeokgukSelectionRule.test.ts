import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts, type GyeokgukSelectionRule } from './facts.js';
import { computeGyeokguk } from './gyeokguk.js';

function analyzeWithSelectionRule(
  selectionRule?: GyeokgukSelectionRule,
  gyeokgukOverrides: Record<string, unknown> = {},
  monthGyeokBonus = 1,
  duplicateMonthGyeokRule = false,
) {
  const gyeokgukStrategy = { ...(selectionRule ? { selectionRule } : {}), ...gyeokgukOverrides };
  const monthGyeokMacros = Array.from(
    { length: duplicateMonthGyeokRule ? 2 : 1 },
    () => ({ kind: 'monthGyeokTenGod' as const, bonus: monthGyeokBonus }),
  );
  const config = normalizeConfig({
    strategies: Object.keys(gyeokgukStrategy).length > 0 ? { gyeokguk: gyeokgukStrategy } : {},
    extensions: {
      ruleSpecs: {
        gyeokguk: {
          id: 'test.gyeokguk.month-gyeok-only',
          base: 'none',
          mode: 'replace',
          macros: monthGyeokMacros,
        },
      },
    },
  });

  const pillars = {
    year: pillar(2, 0),
    month: pillar(5, 2),
    day: pillar(4, 4),
    hour: pillar(7, 9),
  };
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  );
  const scoring = scorePillars(pillars, DEFAULT_SCORE_POLICY);
  const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring, dayMasterSelfScore: 1 });
  const result = computeGyeokguk(config, facts);

  return { config, facts, result };
}

function analyzeHiddenSeongpae(gyeokgukOverrides: Record<string, unknown> = {}) {
  const config = normalizeConfig({
    strategies: { gyeokguk: gyeokgukOverrides },
  });

  const pillars = {
    year: pillar(2, 0),
    month: pillar(4, 4),
    day: pillar(6, 4),
    hour: pillar(8, 9),
  };
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  );
  const scoring = scorePillars(pillars, DEFAULT_SCORE_POLICY);
  return buildRuleFacts({ config, pillars, elementDistribution, scoring, dayMasterSelfScore: 1 });
}

describe('gyeokguk selectionRule', () => {
  it('preserves the legacy default and exposes monthly_main/jungki_transparent as explicit selectors', () => {
    const defaultResult = analyzeWithSelectionRule();
    const monthlyMain = analyzeWithSelectionRule('monthly_main');
    const jungkiTransparent = analyzeWithSelectionRule('jungki_transparent');

    expect(defaultResult.facts.month.gyeok.selectionRule).toBe('legacy_visible_hidden');
    expect(defaultResult.facts.month.gyeok.method).toBe('VISIBLE_HIDDEN');
    expect(defaultResult.facts.month.gyeok.tenGod).toBe('PYEON_IN');
    expect(defaultResult.result.best).toBe('gyeokguk.PYEON_IN');

    expect(monthlyMain.facts.month.gyeok.selectionRule).toBe('monthly_main');
    expect(monthlyMain.facts.month.gyeok.tenGod).toBe('PYEON_GWAN');
    expect(monthlyMain.result.best).toBe('gyeokguk.PYEON_GWAN');

    expect(jungkiTransparent.facts.month.gyeok.selectionRule).toBe('jungki_transparent');
    expect(jungkiTransparent.facts.month.gyeok.method).toBe('VISIBLE_HIDDEN');
    expect(jungkiTransparent.facts.month.gyeok.tenGod).toBe('PYEON_IN');
    expect(jungkiTransparent.result.best).toBe('gyeokguk.PYEON_IN');
    expect(jungkiTransparent.result.basis.monthGyeokSelectionRule).toBe('jungki_transparent');
  });

  it('keeps seongpae v1 opt-in until an authority holdout approves the policy', () => {
    const disabled = analyzeHiddenSeongpae();
    const enabled = analyzeHiddenSeongpae({ seongpae: { enabled: true } });
    const masterDisabled = analyzeHiddenSeongpae({
      seongpae: { enabled: false, v1: { enabled: true } },
    });

    expect(enabled.month.gyeok.seongpae).toMatchObject({
      verdict: 'SEONGJUNG_YUPA',
      sangshin: 'JEONG_JAE',
      sangshinSource: 'MONTH_HIDDEN',
    });
    expect(disabled.month.gyeok.seongpae?.verdict).toBe('PAGYEOK');
    expect(disabled.month.gyeok.seongpae?.sangshin).toBeNull();
    expect(disabled.month.gyeok.seongpae?.sangshinSource).toBeUndefined();
    expect(masterDisabled.month.gyeok.seongpae).toEqual(disabled.month.gyeok.seongpae);
  });

  it('keeps seongpaeScore opt-in and applies it only to the selected month-gyeok score', () => {
    const disabled = analyzeWithSelectionRule();
    const enabled = analyzeWithSelectionRule(undefined, { seongpaeScore: { enabled: true } });

    expect(enabled.facts.month.gyeok.seongpae?.verdict).toBe('UNDETERMINED');
    expect(disabled.result.scores['gyeokguk.PYEON_IN']).toBeCloseTo(1, 12);
    expect(disabled.result.basis.seongpaeScoreAdjustment).toBeUndefined();
    expect(Object.hasOwn(disabled.result, 'seongpaeScoreAdjustment')).toBe(false);
    expect(Object.hasOwn(disabled.result.basis, 'seongpaeScoreAdjustment')).toBe(false);
    expect(enabled.result.scores['gyeokguk.PYEON_IN']).toBeCloseTo(0.95, 12);
    expect(enabled.result.best).toBe(disabled.result.best);

    expect(enabled.result.basis.seongpaeScoreAdjustment).toMatchObject({
      verdict: 'UNDETERMINED',
      key: 'gyeokguk.PYEON_IN',
      multiplier: 0.95,
    });
    expect(enabled.result.basis.seongpaeScoreAdjustment?.before).toBeCloseTo(1, 12);
    expect(enabled.result.basis.seongpaeScoreAdjustment?.after).toBeCloseTo(0.95, 12);
  });

  it('falls back to the governed verdict multiplier when an override is negative', () => {
    const got = analyzeWithSelectionRule(undefined, {
      seongpaeScore: { enabled: true, multipliers: { UNDETERMINED: -5 } },
    });
    expect(got.result.scores['gyeokguk.PYEON_IN']).toBeCloseTo(0.95, 12);
    expect(got.result.best).toBe('gyeokguk.PYEON_IN');
  });

  it('falls back to the governed verdict multiplier when an override is unbounded', () => {
    const got = analyzeWithSelectionRule(undefined, {
      seongpaeScore: { enabled: true, multipliers: { UNDETERMINED: Number.MAX_VALUE } },
    });
    expect(got.result.scores['gyeokguk.PYEON_IN']).toBeCloseTo(0.95, 12);
  });

  it('does not improve a non-positive rule score through verdict multiplication', () => {
    const got = analyzeWithSelectionRule(
      undefined,
      { seongpaeScore: { enabled: true } },
      -1,
    );
    expect(got.result.scores['gyeokguk.PYEON_IN']).toBe(-1);
    expect(got.result.basis.seongpaeScoreAdjustment).toBeUndefined();
  });

  it('fails closed when a finite score and multiplier overflow', () => {
    expect(() => analyzeWithSelectionRule(
      undefined,
      { seongpaeScore: { enabled: true, multipliers: { UNDETERMINED: 10 } } },
      Number.MAX_VALUE,
    )).toThrow(RangeError);
  });

  it('fails closed when finite rule contributions overflow before adjustment', () => {
    expect(() => analyzeWithSelectionRule(
      undefined,
      { seongpaeScore: { enabled: true } },
      Number.MAX_VALUE,
      true,
    )).toThrow(RangeError);
  });

  it('uses the pre-month-damage verdict for scoring while retaining the reported verdict', () => {
    const got = analyzeWithSelectionRule(undefined, { seongpaeScore: { enabled: true } });
    const current = got.facts.month.gyeok.seongpae!;
    got.facts.month.gyeok.seongpae = {
      ...current,
      verdict: 'SEONGJUNG_YUPA',
      verdictBeforeMonthDamage: 'SEONGGYEOK',
    };
    const rescored = computeGyeokguk(got.config, got.facts);
    expect(rescored.basis.seongpaeScoreAdjustment).toMatchObject({
      verdict: 'SEONGGYEOK',
      reportedVerdict: 'SEONGJUNG_YUPA',
      multiplier: 1.08,
    });
  });
});
