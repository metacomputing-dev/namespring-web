import { describe, expect, it } from 'vitest';

import {
  InvalidEngineConfigError,
  normalizeConfig,
} from './config.js';
import { createEngine } from './engine.js';
import { applySchoolPreset } from '../schools/presets.js';

function captureInvalidConfig(config: unknown): InvalidEngineConfigError {
  try {
    normalizeConfig(config);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidEngineConfigError);
    return error as InvalidEngineConfigError;
  }
  throw new Error('Expected configuration validation to fail.');
}

describe('engine config runtime validation', () => {
  it('rejects an unknown year-boundary value instead of selecting another policy', () => {
    const error = captureInvalidConfig({
      calendar: { yearBoundary: 'typo' },
    });

    expect(error.code).toBe('SAJU_INVALID_ENGINE_CONFIG');
    expect(error.path).toBe('calendar.yearBoundary');
    expect(error.message).not.toContain('typo');
  });

  it('rejects string booleans instead of enabling truthy rule execution', () => {
    const error = captureInvalidConfig({
      toggles: { rules: 'false' },
    });

    expect(error.path).toBe('toggles.rules');
  });

  it.each([
    ['calendar.yearBoundary', { calendar: { yearBoundary: 'spring' } }],
    ['calendar.monthBoundary', { calendar: { monthBoundary: 'lunarMonth' } }],
    ['calendar.dayBoundary', { calendar: { dayBoundary: 'noon' } }],
    ['calendar.hourStemDayBoundary', { calendar: { hourStemDayBoundary: 'noon' } }],
    ['calendar.hourBoundary', { calendar: { hourBoundary: 'singleHour' } }],
    ['calendar.aberrationModel', { calendar: { aberrationModel: 'variable' } }],
    ['calendar.solarPrecision', { calendar: { solarPrecision: 'latest' } }],
    ['calendar.solarTerms.method', { calendar: { solarTerms: { method: 'table' } } }],
    ['calendar.solarTerms.algorithm', { calendar: { solarTerms: { algorithm: 'secant' } } }],
    [
      'calendar.trueSolarTime.equationOfTime',
      { calendar: { trueSolarTime: { equationOfTime: 'auto' } } },
    ],
    [
      'calendar.trueSolarTime.applyTo',
      { calendar: { trueSolarTime: { applyTo: 'all' } } },
    ],
  ])('rejects an unsupported closed value at %s', (path, config) => {
    expect(captureInvalidConfig(config).path).toBe(path);
  });

  it.each([
    ['calendar.solarTerms.alwaysCompute', { calendar: { solarTerms: { alwaysCompute: 1 } } }],
    ['calendar.trueSolarTime.enabled', { calendar: { trueSolarTime: { enabled: 'yes' } } }],
    ['toggles.pillars', { toggles: { pillars: 1 } }],
    ['toggles.relations', { toggles: { relations: null } }],
    ['toggles.tenGods', { toggles: { tenGods: 'true' } }],
    ['toggles.hiddenStems', { toggles: { hiddenStems: 0 } }],
    ['toggles.elementDistribution', { toggles: { elementDistribution: 'false' } }],
    ['toggles.fortune', { toggles: { fortune: 1 } }],
    ['toggles.rules', { toggles: { rules: 'false' } }],
    ['toggles.lifeStages', { toggles: { lifeStages: 0 } }],
    ['toggles.stemRelations', { toggles: { stemRelations: 'yes' } }],
  ])('rejects a non-boolean value at %s', (path, config) => {
    expect(captureInvalidConfig(config).path).toBe(path);
  });

  it.each([
    ['weights.hiddenStems', { weights: { hiddenStems: 'standard' } }],
    ['weights.hiddenStems.scheme', { weights: { hiddenStems: { scheme: 'typo' } } }],
    [
      'weights.hiddenStems.saryeongScheme',
      { weights: { hiddenStems: { saryeongScheme: 'approx' } } },
    ],
    [
      'weights.hiddenStems.standard.one',
      { weights: { hiddenStems: { standard: { one: -1 } } } },
    ],
    [
      'weights.hiddenStems.standard.two.main',
      { weights: { hiddenStems: { standard: { two: { main: Number.NaN } } } } },
    ],
    [
      'weights.hiddenStems.standard.three.mid',
      { weights: { hiddenStems: { standard: { three: { mid: 0.3 } } } } },
    ],
    [
      'weights.elementDistribution',
      { weights: { elementDistribution: [] } },
    ],
    [
      'weights.elementDistribution.heavenStemWeight',
      { weights: { elementDistribution: { heavenStemWeight: -1 } } },
    ],
    [
      'weights.elementDistribution.branchTotalWeight',
      { weights: { elementDistribution: { branchTotalWeight: '1' } } },
    ],
    [
      'weights.elementDistribution.positionWeights.season',
      { weights: { elementDistribution: { positionWeights: { season: 1 } } } },
    ],
    [
      'weights.elementDistribution.heavenPositionWeights.month',
      {
        weights: {
          elementDistribution: {
            heavenPositionWeights: { month: Number.POSITIVE_INFINITY },
          },
        },
      },
    ],
    [
      'weights.elementDistribution.branchPositionWeights.day',
      { weights: { elementDistribution: { branchPositionWeights: { day: -0.1 } } } },
    ],
  ])('rejects an invalid known weight contract at %s', (path, config) => {
    expect(captureInvalidConfig(config).path).toBe(path);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '30'])(
    'rejects non-finite dayCutShiftMinutes %#',
    (dayCutShiftMinutes) => {
      expect(captureInvalidConfig({
        calendar: { dayCutShiftMinutes },
      }).path).toBe('calendar.dayCutShiftMinutes');
    },
  );

  it.each([
    ['config', null],
    ['config', []],
    ['config', new Date(0)],
    ['calendar', { calendar: null }],
    ['calendar.solarTerms', { calendar: { solarTerms: [] } }],
    ['calendar.trueSolarTime', { calendar: { trueSolarTime: 'on' } }],
    ['toggles', { toggles: [] }],
    ['weights', { weights: 'bad' }],
    ['strategies', { strategies: [] }],
    ['extensions', { extensions: 42 }],
  ])('rejects an invalid object shape at %s', (path, config) => {
    expect(captureInvalidConfig(config).path).toBe(path);
  });

  it.each([
    ['config.calender', { calender: { yearBoundary: 'jan1' } }],
    ['config.toggle', { toggle: { rules: false } }],
    ['config.strategys', { strategys: { strength: { model: 'base' } } }],
    ['calendar.yearBoundry', { calendar: { yearBoundry: 'jan1' } }],
    ['calendar.solarTerms.algoritm', { calendar: { solarTerms: { algoritm: 'newton' } } }],
    [
      'calendar.trueSolarTime.equationOfTimes',
      { calendar: { trueSolarTime: { equationOfTimes: 'off' } } },
    ],
    ['toggles.rule', { toggles: { rule: false } }],
  ])('rejects an unknown closed field at %s', (path, config) => {
    expect(captureInvalidConfig(config).path).toBe(path);
  });

  it('keeps the v0 lifeStage alias valid until migration renames it', () => {
    const config = normalizeConfig({ toggles: { lifeStage: false } } as any);

    expect(config.toggles.lifeStages).toBe(false);
    expect((config.toggles as any).lifeStage).toBeUndefined();
  });

  it('preserves data in the documented open extension surfaces', () => {
    const config = normalizeConfig({
      weights: {
        customWeight: { value: 3 },
        hiddenStems: {
          scheme: 'equal',
          saryeongScheme: 'scaled',
          standard: {
            one: 1,
            two: { main: 0.8, residual: 0.2 },
            three: { main: 0.6, middle: 0.3, residual: 0.1 },
          },
        },
        elementDistribution: {
          heavenStemWeight: 2,
          branchTotalWeight: 3,
          positionWeights: { year: 0.5, month: 1, day: 1, hour: 0.5 },
          heavenPositionWeights: { month: 1.2 },
          branchPositionWeights: { day: 0.8 },
        },
      },
      strategies: { customStrategy: { enabled: true } },
      extensions: { customExtension: { version: 'x' } },
    } as any);

    expect((config.weights as any).customWeight.value).toBe(3);
    expect((config.weights as any).hiddenStems.scheme).toBe('equal');
    expect((config.weights as any).elementDistribution.branchTotalWeight).toBe(3);
    expect((config.strategies as any).customStrategy.enabled).toBe(true);
    expect((config.extensions as any).customExtension.version).toBe('x');
  });

  it('keeps undefined optional values compatible with omission', () => {
    const config = normalizeConfig({
      calendar: {
        hourStemDayBoundary: undefined,
        solarTerms: { algorithm: undefined },
        trueSolarTime: { applyTo: undefined },
      },
      toggles: { rules: undefined },
    } as any);

    expect(config.calendar.hourStemDayBoundary).toBeUndefined();
    expect(config.calendar.solarTerms?.algorithm).toBeUndefined();
    expect(config.calendar.trueSolarTime.applyTo).toBe('hourOnly');
    expect(config.toggles.rules).toBe(true);
  });

  it('rejects an invalid closed value supplied by a custom school preset', () => {
    const error = captureInvalidConfig({
      school: { id: 'custom.invalid-calendar' },
      extensions: {
        presetPacks: [{
          schemaVersion: '1',
          id: 'runtime-validation-test',
          presets: [{
            id: 'custom.invalid-calendar',
            name: 'Invalid calendar test preset',
            description: 'Test-only invalid preset.',
            overlay: { calendar: { yearBoundary: null } },
          }],
        }],
      },
    });

    expect(error.path).toBe('calendar.yearBoundary');
  });

  it('rejects invalid known fields on the public preset helper base config', () => {
    expect(() => applySchoolPreset({
      calendar: { yearBoundary: 'typo' },
    } as any, 'johoo.strict')).toThrow(InvalidEngineConfigError);
  });

  it('accepts every supported non-default closed value through the public engine', () => {
    const engine = createEngine({
      calendar: {
        yearBoundary: 'jan1',
        monthBoundary: 'gregorianMonth',
        dayBoundary: 'ziSplit23',
        hourStemDayBoundary: 'midnight',
        hourBoundary: 'doubleHour',
        dayCutShiftMinutes: -30,
        solarTerms: {
          method: 'approx',
          alwaysCompute: true,
          algorithm: 'newton',
        },
        aberrationModel: 'rCorrected',
        solarPrecision: 'iau1980_full',
        trueSolarTime: {
          enabled: true,
          longitudeCorrectionPolicy: { mode: 'fixedMeridian', meridianDeg: 135 },
          equationOfTime: 'precise',
          applyTo: 'dayAndHour',
        },
      },
      toggles: {
        pillars: true,
        relations: false,
        tenGods: false,
        hiddenStems: false,
        elementDistribution: false,
        fortune: false,
        rules: false,
        lifeStages: false,
        stemRelations: false,
      },
    });

    expect(engine.config.calendar.yearBoundary).toBe('jan1');
    expect(engine.config.calendar.trueSolarTime.applyTo).toBe('dayAndHour');
    expect(engine.config.toggles.rules).toBe(false);
  });
});
