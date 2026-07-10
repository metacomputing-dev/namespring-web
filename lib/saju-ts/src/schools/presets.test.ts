import { describe, expect, it } from 'vitest';

import { InvalidSchoolPresetSelectorError, normalizeConfig } from '../api/config.js';
import { createEngine } from '../api/engine.js';
import { UnknownSchoolPresetError } from './presets.js';

describe('school preset resolution', () => {
  it('rejects an explicitly selected unknown preset instead of silently using defaults', () => {
    const create = () => createEngine({ school: { id: 'ziping.strcit' } } as any);

    expect(create).toThrow(UnknownSchoolPresetError);

    try {
      create();
      throw new Error('expected createEngine to reject an unknown preset');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'UnknownSchoolPresetError',
        code: 'SAJU_UNKNOWN_SCHOOL_PRESET',
        presetId: 'ziping.strcit',
      });
      expect((error as UnknownSchoolPresetError).availablePresetIds).toContain('ziping.strict');
      expect((error as UnknownSchoolPresetError).availablePresetIds).toContain('zipingzhenquan.strict');
    }
  });

  it.each([
    { id: '' },
    { id: ' + ' },
    { id: 123 as unknown as string },
    { id: null as unknown as string },
  ])('rejects malformed explicit selector %#', (school) => {
    expect(() => normalizeConfig({ school } as any)).toThrow(InvalidSchoolPresetSelectorError);
  });

  it('rejects an explicitly null or incomplete school object', () => {
    expect(() => normalizeConfig({ school: null } as any)).toThrow(InvalidSchoolPresetSelectorError);
    expect(() => normalizeConfig({ school: {} } as any)).toThrow(InvalidSchoolPresetSelectorError);
  });

  it('keeps preset-free normalization on the default configuration path', () => {
    const config = normalizeConfig({});

    expect(config.school).toBeUndefined();
    expect(config.calendar.yearBoundary).toBe('liChun');
    expect((config.strategies as any).strength.model).toBe('deLingDiShi');
  });

  it('applies a known preset normally', () => {
    const engine = createEngine({ school: { id: 'johoo.strict' } } as any);
    const yongshin = (engine.config.strategies as any).yongshin;

    expect(engine.config.school?.id).toBe('johoo.strict');
    expect(yongshin.weights.climate).toBe(1.45);
    expect(yongshin.johooTemplate.enabled).toBe(true);
  });
});
