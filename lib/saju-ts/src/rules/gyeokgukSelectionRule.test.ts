import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY, scorePillars } from '../core/scoring.js';
import { buildRuleFacts, type GyeokgukSelectionRule } from './facts.js';
import { computeGyeokguk } from './gyeokguk.js';

function analyzeWithSelectionRule(selectionRule?: GyeokgukSelectionRule) {
  const config = normalizeConfig({
    strategies: selectionRule ? { gyeokguk: { selectionRule } } : {},
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

  return { facts, result };
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
});
