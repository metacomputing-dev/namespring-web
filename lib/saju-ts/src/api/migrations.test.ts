import { describe, expect, it } from 'vitest';

import {
  migrateConfig,
  CURRENT_CONFIG_SCHEMA_VERSION,
  UnsupportedConfigSchemaVersionError,
} from './migrations.js';

describe('config migrations', () => {
  it('treats missing schemaVersion as legacy v0 and migrates to current', () => {
    const legacy: any = {
      // schemaVersion missing
      calendar: {
        yearBoundary: 'liChun',
        monthBoundary: 'jieqi',
        dayBoundary: 'midnight',
        hourBoundary: 'doubleHour',
        // invalid legacy values remain visible for post-migration validation
        solarTerms: 'meeus',
        trueSolarTime: { enabled: true, equationOfTime: 'approx' },
      },
      toggles: {
        pillars: true,
        lifeStage: false,
      },
      strategies: {
        lifeStage: { earthRule: 'FOLLOW_FIRE', yinReversalEnabled: true },
      },
      extensions: { foo: 1 },
    };

    const migrated = migrateConfig(legacy);

    expect(migrated.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION);

    const t: any = migrated.toggles;
    expect(t.lifeStages).toBe(false);
    expect(t.lifeStage).toBeUndefined();

    const s: any = migrated.strategies;
    expect(s.lifeStages).toEqual({ earthRule: 'FOLLOW_FIRE', yinReversalEnabled: true });
    expect(s.lifeStage).toBeUndefined();

    // Invalid shapes are not erased into defaults. normalizeConfig owns
    // fail-closed semantic validation after aliases have migrated.
    const c: any = migrated.calendar;
    expect(c.solarTerms).toBe('meeus');
    expect(c.trueSolarTime).toEqual({ enabled: true, equationOfTime: 'approx' });

    expect((migrated as any).extensions.foo).toBe(1);
  });

  it.each([
    { calendar: null },
    { calendar: { trueSolarTime: 'on' } },
    { toggles: [] },
    { strategies: 'base' },
  ])('preserves explicit invalid legacy shapes for the runtime validator %#', (input) => {
    const migrated = migrateConfig(input) as any;

    for (const key of ['calendar', 'toggles', 'strategies'] as const) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        expect(migrated[key]).toEqual((input as any)[key]);
      }
    }
  });

  it('rejects unknown versions instead of falsely stamping them current', () => {
    const weird: any = { schemaVersion: '999', calendar: { yearBoundary: 'liChun' } };
    expect(() => migrateConfig(weird))
      .toThrow(UnsupportedConfigSchemaVersionError);
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
    true,
    false,
    {},
    [],
    1.9,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects an explicitly invalid schemaVersion %#', (schemaVersion) => {
    expect(() => migrateConfig({ schemaVersion }))
      .toThrow(UnsupportedConfigSchemaVersionError);
  });

  it.each([0, 1])('accepts finite integer schemaVersion compatibility value %s', (schemaVersion) => {
    expect(migrateConfig({ schemaVersion }).schemaVersion)
      .toBe(CURRENT_CONFIG_SCHEMA_VERSION);
  });
});
