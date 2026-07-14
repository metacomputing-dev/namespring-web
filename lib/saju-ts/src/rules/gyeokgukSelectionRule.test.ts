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
  useDefaultRuleSet = false,
) {
  const gyeokgukStrategy = { ...(selectionRule ? { selectionRule } : {}), ...gyeokgukOverrides };
  const config = normalizeConfig({
    strategies: Object.keys(gyeokgukStrategy).length > 0 ? { gyeokguk: gyeokgukStrategy } : {},
    ...(useDefaultRuleSet
      ? {}
      : {
          extensions: {
            ruleSpecs: {
              gyeokguk: {
                id: 'test.gyeokguk.month-gyeok-only',
                base: 'none',
                mode: 'replace',
                macros: [{ kind: 'monthGyeokTenGod' }],
              },
            },
          },
        }),
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
  const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring });
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
  return buildRuleFacts({ config, pillars, elementDistribution, scoring });
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

  it('enables seongpae v1 by default while preserving explicit opt-out', () => {
    const enabled = analyzeHiddenSeongpae();
    const disabled = analyzeHiddenSeongpae({ seongpae: { enabled: false } });

    expect(enabled.month.gyeok.seongpae).toMatchObject({
      verdict: 'SEONGJUNG_YUPA',
      sangshin: 'JEONG_JAE',
      sangshinSource: 'MONTH_HIDDEN',
    });
    expect(disabled.month.gyeok.seongpae?.verdict).toBe('PAGYEOK');
    expect(disabled.month.gyeok.seongpae?.sangshin).toBeNull();
    expect(disabled.month.gyeok.seongpae?.sangshinSource).toBeUndefined();
  });

  it('applies seongpaeScore by default only to the selected month-gyeok score', () => {
    const enabled = analyzeWithSelectionRule();
    const disabled = analyzeWithSelectionRule(undefined, { seongpaeScore: { enabled: false } });

    expect(enabled.facts.month.gyeok.seongpae?.verdict).toBe('UNDETERMINED');
    expect(disabled.result.scores['gyeokguk.PYEON_IN']).toBeCloseTo(1, 12);
    expect(disabled.result.basis.seongpaeScoreAdjustment).toBeUndefined();
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

  it('does not apply the same month damage through quality and seongpae score twice', () => {
    const { config, facts } = analyzeWithSelectionRule(undefined, {}, true);
    facts.month.gyeok.quality.multiplier = 0.5;
    facts.month.gyeok.seongpae = {
      ...facts.month.gyeok.seongpae!,
      verdict: 'PAGYEOK',
      verdictBeforeMonthBroken: 'UNDETERMINED',
    };

    const result = computeGyeokguk(config, facts);
    expect(result.scores['gyeokguk.PYEON_IN']).toBeCloseTo(0.5, 12);
    expect(result.basis.seongpaeScoreAdjustment).toMatchObject({
      verdict: 'PAGYEOK',
      multiplier: 1,
      before: 0.5,
      after: 0.5,
      suppressedBy: 'MONTH_DAMAGE_ALREADY_APPLIED_TO_QUALITY',
    });
  });
});
