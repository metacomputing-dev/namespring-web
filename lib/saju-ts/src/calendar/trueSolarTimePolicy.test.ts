import { describe, expect, it } from 'vitest';

import { defaultConfig, InvalidLongitudeCorrectionPolicyError } from '../api/config.js';
import { createEngine } from '../api/engine.js';
import type { EngineConfig } from '../api/types.js';
import { SajuRequestValidationError } from './normalizeRequest.js';
import {
  computeTrueSolarTimeCorrection,
  longitudeCorrectionMinutesFromMeridian,
  shortestSignedLongitudeDeltaDeg,
} from './trueSolarTime.js';

const UTC_MS = Date.UTC(2024, 0, 15, 12, 0, 0);

function correction(
  longitude: number | undefined,
  offsetMinutes: number,
  longitudeCorrectionPolicy: EngineConfig['calendar']['trueSolarTime']['longitudeCorrectionPolicy'],
) {
  return computeTrueSolarTimeCorrection({
    utcMs: UTC_MS,
    offsetMinutes,
    location: longitude === undefined
      ? undefined
      : { lat: 0, lon: longitude },
    policy: {
      enabled: true,
      longitudeCorrectionPolicy,
      equationOfTime: 'off',
    },
  });
}

describe('longitude correction policy', () => {
  it('uses the shortest signed dateline delta', () => {
    expect(shortestSignedLongitudeDeltaDeg(-157.4, 210)).toBeCloseTo(-7.4, 10);
    expect(shortestSignedLongitudeDeltaDeg(179, -179)).toBe(-2);
    expect(shortestSignedLongitudeDeltaDeg(-179, 179)).toBe(2);
    expect(longitudeCorrectionMinutesFromMeridian(-157.4, 210)).toBeCloseTo(-29.6, 10);
  });

  it('keeps the physical request longitude unchanged for UTC+14', () => {
    const location = { lat: 1.8721, lon: -157.4 };
    const result = computeTrueSolarTimeCorrection({
      utcMs: UTC_MS,
      offsetMinutes: 14 * 60,
      location,
      policy: {
        enabled: true,
        longitudeCorrectionPolicy: { mode: 'civilOffsetMeridian' },
        equationOfTime: 'off',
      },
    });

    expect(location.lon).toBe(-157.4);
    expect(result.longitudeDeg).toBe(-157.4);
    expect(result.standardMeridianDeg).toBe(210);
    expect(result.longitudeCorrectionMinutes).toBeCloseTo(-29.6, 10);
  });

  it('supports fixed school meridians without changing longitude', () => {
    expect(correction(126.978, 9 * 60, { mode: 'fixedMeridian', meridianDeg: 135 })
      .longitudeCorrectionMinutes).toBeCloseTo(-32.088, 10);
    expect(correction(126.978, 9 * 60, { mode: 'fixedMeridian', meridianDeg: 120 })
      .longitudeCorrectionMinutes).toBeCloseTo(27.912, 10);
  });

  it('provides an actual longitude-off mode independently of EoT', () => {
    const fullyOff = correction(126.978, 9 * 60, { mode: 'off' });
    expect(fullyOff.longitudeCorrectionMinutes).toBe(0);
    expect(fullyOff.totalCorrectionMinutes).toBe(0);

    const eotOnly = computeTrueSolarTimeCorrection({
      utcMs: UTC_MS,
      offsetMinutes: 9 * 60,
      location: undefined,
      policy: {
        enabled: true,
        longitudeCorrectionPolicy: { mode: 'off' },
        equationOfTime: 'approx',
      },
    });
    expect(eotOnly.applied).toBe(true);
    expect(eotOnly.longitudeCorrectionMinutes).toBe(0);
    expect(eotOnly.equationOfTimeMinutes).not.toBe(0);
  });

  it('defaults to the civil offset meridian and rejects malformed explicit policies', () => {
    expect(defaultConfig.calendar.trueSolarTime.longitudeCorrectionPolicy)
      .toEqual({ mode: 'civilOffsetMeridian' });

    expect(() => createEngine({
      calendar: {
        trueSolarTime: {
          longitudeCorrectionPolicy: { mode: 'fixedMeridian', meridianDeg: Number.NaN },
        },
      },
    } as any)).toThrow(InvalidLongitudeCorrectionPolicyError);

    expect(() => createEngine({
      calendar: {
        trueSolarTime: { longitudeCorrectionPolicy: { mode: 'unknown' } },
      },
    } as any)).toThrow(InvalidLongitudeCorrectionPolicyError);
  });

  it('keeps the new longitude policy source-compatible with a full legacy config', () => {
    const {
      longitudeCorrectionPolicy: _newPolicy,
      ...legacyTrueSolarTime
    } = defaultConfig.calendar.trueSolarTime;
    const legacyConfig: EngineConfig = {
      ...defaultConfig,
      calendar: {
        ...defaultConfig.calendar,
        trueSolarTime: legacyTrueSolarTime,
      },
    };

    expect(createEngine(legacyConfig).config.calendar.trueSolarTime.longitudeCorrectionPolicy)
      .toEqual({ mode: 'civilOffsetMeridian' });
  });

  it.each([
    { mode: 'civilOffsetMeridian' as const },
    { mode: 'fixedMeridian' as const, meridianDeg: 135 },
  ])('fails closed without longitude when $mode correction is enabled', (longitudeCorrectionPolicy) => {
    const engine = createEngine({
      calendar: {
        trueSolarTime: {
          enabled: true,
          longitudeCorrectionPolicy,
          equationOfTime: 'off',
          applyTo: 'dayAndHour',
        },
      },
    } as any);

    let caught: unknown;
    try {
      engine.analyze({
        birth: {
          instant: '2024-01-15T12:00:00+09:00',
          calendar: 'gregorian',
        },
        sex: 'M',
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SajuRequestValidationError);
    expect((caught as SajuRequestValidationError).issues)
      .toContain('location.lon is required when true-solar longitude correction is enabled');
  });

  it('allows location-free EoT-only analysis when longitude correction is off', () => {
    const engine = createEngine({
      calendar: {
        trueSolarTime: {
          enabled: true,
          longitudeCorrectionPolicy: { mode: 'off' },
          equationOfTime: 'approx',
          applyTo: 'dayAndHour',
        },
      },
    } as any);
    const bundle = engine.analyze({
      birth: {
        instant: '2024-01-15T12:00:00+09:00',
        calendar: 'gregorian',
      },
      sex: 'M',
    });
    const correction = bundle.report.facts['time.trueSolarCorrection'] as any;

    expect(correction.applied).toBe(true);
    expect(correction.longitudeCorrectionMinutes).toBe(0);
    expect(correction.equationOfTimeMinutes).not.toBe(0);

    const traceNode = bundle.report.trace.nodes.find(
      (node) => node.id === 'time.trueSolarCorrection',
    );
    expect(traceNode?.formula).toContain('shortestDelta');
    expect(traceNode?.explain).toContain('경도 정책이 off이면 위치 없이 EoT만 적용');
    expect(traceNode?.explain).not.toContain('location.lon이 없으면 적용하지 않는다');
  });
});
