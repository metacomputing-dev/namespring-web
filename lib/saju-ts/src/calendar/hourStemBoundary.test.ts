import { describe, expect, it } from 'vitest';
import { createEngine } from '../api/engine.js';
import type { PillarIdx } from '../core/cycle.js';
import { calcDayPillar, calcHourPillar, effectiveDayDate } from './pillars.js';

function analyze(instant: string, longitude: number, applyTo: 'hourOnly' | 'dayAndHour', calendar: Record<string, unknown> = {}) {
  const bundle = createEngine({
    calendar: {
      ...calendar,
      trueSolarTime: { enabled: true, equationOfTime: 'off', applyTo },
    },
  } as any).analyze({
    birth: { instant, calendar: 'gregorian' },
    sex: 'M',
    location: { lat: 37.5665, lon: longitude },
  });
  return bundle.report.facts as Record<string, any>;
}

describe('hour-pillar day-stem boundary', () => {
  for (const sample of [
    { instant: '2000-01-02T00:30:00+09:00', longitude: 120, shiftedDay: 1 },
    { instant: '2000-01-01T23:30:00+09:00', longitude: 150, shiftedDay: 2 },
  ]) {
    it(`keeps hourOnly on the visible day stem across midnight: ${sample.instant}`, () => {
      const facts = analyze(sample.instant, sample.longitude, 'hourOnly');
      const day = facts['pillars.day'] as PillarIdx;
      const hour = facts['pillars.hour'] as PillarIdx;
      const hourLocal = facts['time.localDateTimeForHour'];

      expect(hourLocal.date.d).toBe(sample.shiftedDay);
      expect(hour).toEqual(calcHourPillar(day.stem, hourLocal.time, 'doubleHour'));
    });
  }

  it('moves day and hour-stem basis together under dayAndHour', () => {
    const facts = analyze('2000-01-02T00:30:00+09:00', 120, 'dayAndHour');
    const day = facts['pillars.day'] as PillarIdx;
    const hour = facts['pillars.hour'] as PillarIdx;
    const hourLocal = facts['time.localDateTimeForHour'];
    expect(hour).toEqual(calcHourPillar(day.stem, hourLocal.time, 'doubleHour'));
  });

  it('allows an explicit JOJA split to use a different hour-stem day', () => {
    const facts = analyze('2000-01-01T23:30:00+09:00', 135, 'hourOnly', {
      dayBoundary: 'midnight',
      hourStemDayBoundary: 'ziSplit23',
    });
    const day = facts['pillars.day'] as PillarIdx;
    const hour = facts['pillars.hour'] as PillarIdx;
    const hourLocal = facts['time.localDateTimeForHour'];
    const splitDay = calcDayPillar(effectiveDayDate(hourLocal, 'ziSplit23'));

    expect(splitDay.stem).not.toBe(day.stem);
    expect(hour).toEqual(calcHourPillar(splitDay.stem, hourLocal.time, 'doubleHour'));
  });
});
