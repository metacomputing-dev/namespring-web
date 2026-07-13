import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';
import { InvalidIsoInstantError, parseIsoInstant } from './iso.js';
import {
  SajuRequestValidationError,
  assertRequestMeetsCalendarPolicy,
  normalizeRequest,
} from './normalizeRequest.js';

describe('ISO instant validation', () => {
  it('accepts a real leap day', () => {
    expect(parseIsoInstant('2024-02-29T23:59:59+09:00').localDateTime)
      .toEqual({
        date: { y: 2024, m: 2, d: 29 },
        time: { h: 23, min: 59 },
        offsetMinutes: 540,
      });
  });

  it('preserves literal years 1..99 and fractional seconds', () => {
    const parsed = parseIsoInstant('0050-01-02T03:04:05.1+00:00');
    const date = new Date(parsed.utcMs);
    expect(date.getUTCFullYear()).toBe(50);
    expect(date.getUTCMilliseconds()).toBe(100);
    expect(parsed.localDateTime.date).toEqual({ y: 50, m: 1, d: 2 });
  });

  it.each([
    '2023-02-29T12:00+09:00',
    '2024-02-31T12:00+09:00',
    '2024-04-31T12:00+09:00',
    '2024-01-01T24:00+09:00',
    '2024-01-01T12:60+09:00',
    '2024-01-01T12:00+14:01',
  ])('rejects impossible date, time, or offset %s', (instant) => {
    expect(() => parseIsoInstant(instant)).toThrow(InvalidIsoInstantError);
  });
});

describe('SajuRequest runtime validation', () => {
  const base = {
    birth: { instant: '2024-02-29T12:00:00+09:00' },
    sex: 'M',
    location: { lat: 37.5665, lon: 126.978 },
  } as const;

  it.each([
    [{ ...base, sex: 'X' }, 'sex must be'],
    [{ ...base, birth: { ...base.birth, calendar: 'lunar' } }, 'gregorian'],
    [{ ...base, sex: new String('M') }, 'sex must be'],
    [{ ...base, sex: { toString: () => 'M' } }, 'sex must be'],
    [{ ...base, location: { lat: 91, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: 181 } }, 'location.lon'],
    [{ ...base, location: { lat: 37.5665 } }, 'location.lon'],
    [{ ...base, location: { lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: '37.5665', lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: '126.978' } }, 'location.lon'],
    [{ ...base, location: { lat: null, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: null } }, 'location.lon'],
    [{
      ...base,
      location: { ...base.location, altitudeM: '12' },
    }, 'location.altitudeM'],
    [{ ...base, meta: [] }, 'meta must be'],
  ])('rejects invalid runtime request fields', (request, issue) => {
    let caught: unknown;
    try {
      createEngine().analyze(request as any);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SajuRequestValidationError);
    expect((caught as SajuRequestValidationError).issues.join(' '))
      .toContain(issue);
  });

  it('owns normalized top-level request objects', () => {
    const input = {
      ...base,
      location: {
        ...base.location,
        name: 'Seoul',
        altitudeM: 12,
      },
      meta: { requestId: 'test' },
      overrides: { source: 'contract-test' },
    };
    const normalized = normalizeRequest(input);
    expect(normalized.request.location).not.toBe(input.location);
    expect(normalized.request.meta).not.toBe(input.meta);
    expect(normalized.request.overrides).not.toBe(input.overrides);
    expect(normalized.request.location).toEqual({
      lat: 37.5665,
      lon: 126.978,
      name: 'Seoul',
      altitudeM: 12,
    });
    expect(input.location.name).toBe('Seoul');
  });

  it('keeps policy-dependent longitude validation separate and structured', () => {
    const normalized = normalizeRequest({
      birth: base.birth,
      sex: base.sex,
    });
    expect(() => assertRequestMeetsCalendarPolicy(
      normalized.request,
      createEngine().config,
    )).not.toThrow();
  });

  describe.each([
    ['true solar time off', false],
    ['true solar time on', true],
  ] as const)('%s', (_label, trueSolarTimeEnabled) => {
    const engine = createEngine({
      calendar: {
        trueSolarTime: { enabled: trueSolarTimeEnabled },
      },
      toggles: {
        pillars: false,
        relations: false,
        tenGods: false,
        hiddenStems: false,
        elementDistribution: false,
        fortune: false,
        rules: false,
        lifeStages: false,
        stemRelations: false,
      },
    } as any);

    it.each([
      ['numeric string', '0'],
      ['true', true],
      ['false', false],
      ['null', null],
      ['NaN', Number.NaN],
      ['positive infinity', Number.POSITIVE_INFINITY],
      ['negative infinity', Number.NEGATIVE_INFINITY],
    ])('rejects %s coordinates at the public engine boundary', (_case, coordinate) => {
      for (const axis of ['lat', 'lon'] as const) {
        const location = { ...base.location, [axis]: coordinate };
        expect(
          () => engine.analyze({ ...base, location } as any),
          `${axis}=${String(coordinate)}`,
        ).toThrow(SajuRequestValidationError);
      }
    });

    it.each([
      ['latitude below minimum', { lat: -90.000001, lon: 0 }],
      ['latitude above maximum', { lat: 90.000001, lon: 0 }],
      ['longitude below minimum', { lat: 0, lon: -180.000001 }],
      ['longitude above maximum', { lat: 0, lon: 180.000001 }],
    ])('rejects %s at the public engine boundary', (_case, location) => {
      expect(() => engine.analyze({ ...base, location } as any))
        .toThrow(SajuRequestValidationError);
    });

    it.each([
      ['negative bounds', { lat: -90, lon: -180 }],
      ['zero coordinates', { lat: 0, lon: 0 }],
      ['positive bounds', { lat: 90, lon: 180 }],
    ])('accepts %s at the public engine boundary', (_case, location) => {
      expect(() => engine.analyze({ ...base, location } as any)).not.toThrow();
    });
  });
});
