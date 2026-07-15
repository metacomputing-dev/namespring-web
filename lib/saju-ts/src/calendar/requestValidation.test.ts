import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';
import { InvalidIsoInstantError, parseIsoInstant } from './iso.js';
import {
  SajuRequestValidationError,
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
    [{ ...base, sex: ['M'] }, 'sex must be'],
    [{ ...base, sex: true }, 'sex must be'],
    [{ ...base, sex: null }, 'sex must be'],
    [{ ...base, birth: { ...base.birth, calendar: 'lunar' } }, 'gregorian'],
    [{ ...base, location: { lat: 91, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: -91, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: 181 } }, 'location.lon'],
    [{ ...base, location: { lat: 37.5665, lon: -181 } }, 'location.lon'],
    [{ ...base, location: { lat: '37.5665', lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: '126.978' } }, 'location.lon'],
    [{ ...base, location: { lat: true, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: false } }, 'location.lon'],
    [{ ...base, location: { lat: null, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: null } }, 'location.lon'],
    [{ ...base, location: { lat: Number.NaN, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: Number.NaN } }, 'location.lon'],
    [{ ...base, location: { lat: Number.POSITIVE_INFINITY, lon: 126.978 } }, 'location.lat'],
    [{ ...base, location: { lat: 37.5665, lon: Number.NEGATIVE_INFINITY } }, 'location.lon'],
    [{ ...base, location: { ...base.location, altitudeM: '12' } }, 'location.altitudeM'],
    [{ ...base, location: { ...base.location, altitudeM: true } }, 'location.altitudeM'],
    [{ ...base, location: { ...base.location, altitudeM: null } }, 'location.altitudeM'],
    [{ ...base, location: { ...base.location, altitudeM: Number.NaN } }, 'location.altitudeM'],
    [{ ...base, location: { ...base.location, altitudeM: Number.POSITIVE_INFINITY } }, 'location.altitudeM'],
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

  it.each([
    { lat: -90, lon: -180 },
    { lat: -90, lon: 180 },
    { lat: 90, lon: -180 },
    { lat: 90, lon: 180 },
    { lat: 0, lon: 0 },
  ])('accepts finite numeric coordinate boundaries %#', (location) => {
    expect(() => normalizeRequest({ ...base, location })).not.toThrow();
  });

  it('accepts a finite numeric altitude', () => {
    expect(() => normalizeRequest({
      ...base,
      location: { ...base.location, altitudeM: 12.5 },
    })).not.toThrow();
  });

  it('owns normalized top-level request objects', () => {
    const input = {
      ...base,
      location: { ...base.location, name: 'Seoul' },
      meta: { requestId: 'test' },
      overrides: { source: 'contract-test' },
    };
    const normalized = normalizeRequest(input);
    expect(normalized.request.location).not.toBe(input.location);
    expect(normalized.request.meta).not.toBe(input.meta);
    expect(normalized.request.overrides).not.toBe(input.overrides);
    expect(input.location.name).toBe('Seoul');
  });
});
