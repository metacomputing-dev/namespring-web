import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/saju_master_education_cases.json';
import { createEngine } from '../../../src/api/engine.js';

/**
 * Smoke regression for the saju_master education-casebook fixture.
 *
 * The fixture (`saju_master_education_cases.json`) bundles four named
 * cases plus several boundary samples. Some entries are direct-ganji
 * inputs without a known clock instant (1972/1966/1964 cases) — those
 * are kept as documentation only and are not exercised here.
 *
 * The cases this file actually runs:
 *  - edu-1982-11-18 ........ full four-pillar match
 *  - day-pillar-2000-01-01 . day pillar at noon KST
 *  - ipchun-2024 ........... year/month branch at safe margins around
 *                            the lichun boundary (whole-day comparison
 *                            avoids fixture-time-precision issues)
 */

const ENGINE = createEngine();

interface PillarTexts {
  year: string;
  month: string;
  day: string;
  hour: string;
}

function pillarsAt(iso: string): PillarTexts {
  const result = ENGINE.analyze({
    birth: { instant: iso },
    sex: 'U',
    location: { lat: 37.5665, lon: 126.978, name: 'Seoul' },
  });
  const p = result.summary.pillars;
  if (!p) throw new Error('summary.pillars missing');
  return {
    year: `${p.year.stem.text}${p.year.branch.text}`,
    month: `${p.month.stem.text}${p.month.branch.text}`,
    day: `${p.day.stem.text}${p.day.branch.text}`,
    hour: `${p.hour.stem.text}${p.hour.branch.text}`,
  };
}

function findCase<T extends { id: string }>(arr: T[], id: string): T {
  const found = arr.find((x) => x.id === id);
  if (!found) throw new Error(`Fixture case missing: ${id}`);
  return found;
}

describe('saju_master education casebook regression', () => {
  it('edu-1982-11-18 male 08:00 KST → 壬戌 辛亥 乙巳 庚辰', () => {
    const c = findCase(fixture.cases, 'edu-1982-11-18');
    const instant = c.birth.instant;
    if (!instant) throw new Error('expected birth.instant on edu-1982-11-18');
    const got = pillarsAt(instant);
    expect(got.year).toBe(c.expected.yearGanji);
    expect(got.month).toBe(c.expected.monthGanji);
    expect(got.day).toBe(c.expected.dayGanji);
    expect(got.hour).toBe(c.expected.hourGanji);
  });

  it('day-pillar 2000-01-01 noon KST → 戊午', () => {
    const c = findCase(fixture.additionalSamples, 'day-pillar-2000-01-01');
    const got = pillarsAt(`${c.solarDate}T12:00:00+09:00`);
    expect(got.day).toBe(c.expected.dayGanji);
  });

  // Use whole-day margins around lichun so the test does not depend on
  // the fixture knowing the exact 입춘 minute. 2024 입춘 is on Feb 4
  // (KST), so the morning of Feb 4 is safely 直前 and Feb 5 midnight
  // is safely 直後.
  it('2024 lichun boundary: 直前 癸卯年 / 直後 甲辰年', () => {
    const c = findCase(fixture.additionalSamples, 'ipchun-2024');
    const before = pillarsAt('2024-02-04T00:00:00+09:00');
    const after = pillarsAt('2024-02-05T00:00:00+09:00');
    expect(before.year).toBe(c.expected.before.yearGanji);
    expect(after.year).toBe(c.expected.after.yearGanji);
  });
});
