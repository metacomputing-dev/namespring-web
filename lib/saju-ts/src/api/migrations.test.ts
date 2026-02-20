import { describe, expect, it } from 'vitest';

import { migrateConfig, CURRENT_CONFIG_SCHEMA_VERSION } from './migrations.js';

describe('config migrations', () => {
  it('treats missing schemaVersion as legacy v0 and migrates to current', () => {
    const legacy: any = {
      // schemaVersion missing
      calendar: {
        yearBoundary: 'liChun',
        monthBoundary: 'jieqi',
        dayBoundary: 'midnight',
        hourBoundary: 'doubleHour',
        // legacy callers sometimes put invalid shapes here
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

    // invalid shapes are removed so that defaults can be applied later
    const c: any = migrated.calendar;
    expect(c.solarTerms).toBeUndefined();
    expect(c.trueSolarTime).toEqual({ enabled: true, equationOfTime: 'approx' });

    expect((migrated as any).extensions.foo).toBe(1);
  });

  it('stamps unknown versions to current without throwing (best-effort)', () => {
    const weird: any = { schemaVersion: '999', calendar: { yearBoundary: 'liChun' } };
    const migrated = migrateConfig(weird);
    expect(migrated.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION);
    expect((migrated as any).calendar.yearBoundary).toBe('liChun');
  });
});
