import { describe, expect, it } from 'vitest';

import { createEngine } from './engine.js';

const REQUEST = {
  birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' },
  sex: 'M',
} as const;

function analyze(config: Record<string, unknown> = {}) {
  return createEngine(config as any).analyze(REQUEST as any);
}

describe('public non-default policy contracts', () => {
  it("rejects the explicitly selected, unimplemented earthRule 'INDEPENDENT'", () => {
    expect(() => analyze({
      strategies: {
        lifeStages: { earthRule: 'INDEPENDENT', yinReversalEnabled: true },
      },
    })).toThrowError(
      "LifeStagePolicy.earthRule 'INDEPENDENT' is not implemented — use 'FOLLOW_FIRE' (화토동궁, 주류) or 'FOLLOW_WATER' (수토동궁).",
    );
  });

  it('surfaces exact deLing/deDi/deShi ledgers and reproduces the public strength totals', () => {
    const strength = analyze({ strategies: { strength: { model: 'deLingDiShi' } } })
      .summary.strength as any;
    const details = strength.details?.delingdiShi;

    expect(details).toBeDefined();
    expect(details.deLing).toMatchObject({
      monthElement: 'EARTH',
      dayMasterElement: 'WATER',
      factor: 0.18,
    });
    expect(details.deLing.score).toBeLessThan(0);
    expect(details.deLing.score).toBeGreaterThanOrEqual(-1);
    expect(details.deDi).toMatchObject({
      factor: 0.14,
    });
    expect(details.deShi).toMatchObject({
      factor: 0.1,
      positionWeights: { year: 0.6, month: 1, hour: 0.8 },
    });
    for (const ledger of [details.deDi, details.deShi]) {
      for (const field of ['sameElement', 'resourceElement', 'score', 'normalized']) {
        expect(Number.isFinite(ledger[field])).toBe(true);
      }
      expect(ledger.sameElement).toBeGreaterThanOrEqual(0);
      expect(ledger.resourceElement).toBeGreaterThanOrEqual(0);
      expect(ledger.normalized).toBeGreaterThanOrEqual(0);
      expect(ledger.normalized).toBeLessThanOrEqual(1);
    }

    // Pin the public ledger identities while leaving calibration magnitudes to
    // the dedicated authority/cross-fixture suite.
    expect(details.deDi.score).toBeCloseTo(
      details.deDi.sameElement + 0.6 * details.deDi.resourceElement,
      12,
    );
    expect(details.deDi.normalized).toBeCloseTo(details.deDi.score / 2.2, 12);
    expect(details.deShi.score).toBeCloseTo(
      details.deShi.sameElement + 0.7 * details.deShi.resourceElement,
      12,
    );
    expect(details.deShi.normalized).toBeCloseTo(details.deShi.score / 1.6, 12);

    const baseSupport = strength.components.companions + strength.components.resources;
    const supportMultiplier = 1
      + details.deLing.score * details.deLing.factor
      + details.deDi.normalized * details.deDi.factor
      + details.deShi.normalized * details.deShi.factor
      + details.interaction.hui.supportBonus;
    const basePressure = strength.components.outputs
      + strength.components.wealth
      + strength.components.officers;
    const pressureMultiplier = 1 + details.interaction.hui.pressureBonus;

    expect(strength.support).toBeGreaterThan(0);
    expect(strength.pressure).toBeGreaterThan(0);
    expect(strength.total).toBeGreaterThan(strength.support);
    expect(strength.support).toBeCloseTo(baseSupport * supportMultiplier, 12);
    expect(strength.pressure).toBeCloseTo(basePressure * pressureMultiplier, 12);
    expect(strength.total).toBeCloseTo(strength.support + strength.pressure, 12);
    expect(strength.index).toBeCloseTo(
      (strength.support - strength.pressure) / strength.total,
      12,
    );
  });
});
