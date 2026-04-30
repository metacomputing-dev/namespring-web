import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/kasi_2026_pillars.json';
import { createEngine } from '../../../src/api/engine.js';

/**
 * Regression test for the KASI 2026-04 saju-pillar fixtures.
 *
 * Source: `tests/precision/fixtures/kasi_2026_pillars.json`
 *  (originally `saju_master/examples/kasi_fixture_2026_04_*.json`).
 *
 * Each anchor case is a (solarDate, yearGanji, monthGanji, dayGanji,
 * lunarDate) tuple. Hour ganji is intentionally absent — the fixtures
 * are whole-day so we evaluate them at noon KST where the day/month
 * pillar is unambiguous.
 *
 * The ambiguous case (2026-04-06 12:00 KST) checks that saju-ts uses
 * the 12-jieqi rule for the month pillar, which differs from the
 * lunar 月建 reported by korean_lunar_calendar — both correct, just
 * different scopes.
 */

const ENGINE = createEngine();

interface PillarTexts {
  year: string;
  month: string;
  day: string;
}

function pillarsAt(solarDate: string): PillarTexts {
  // Noon KST keeps us safely away from any saju day-boundary policy
  // (whether midnight or 23:00 zi-split) for these whole-day cases.
  const result = ENGINE.analyze({
    birth: { instant: `${solarDate}T12:00:00+09:00` },
    sex: 'U',
    location: { lat: 37.5665, lon: 126.978, name: 'Seoul' },
  });
  const p = result.summary.pillars;
  if (!p) throw new Error('summary.pillars missing');
  return {
    year: `${p.year.stem.text}${p.year.branch.text}`,
    month: `${p.month.stem.text}${p.month.branch.text}`,
    day: `${p.day.stem.text}${p.day.branch.text}`,
  };
}

describe('KASI 2026-04 pillar regression', () => {
  for (const c of fixture.fixtures) {
    it(`${c.solarDate} → ${c.yearGanji} ${c.monthGanji} ${c.dayGanji}`, () => {
      const got = pillarsAt(c.solarDate);
      expect(got.year).toBe(c.yearGanji);
      expect(got.month).toBe(c.monthGanji);
      expect(got.day).toBe(c.dayGanji);
    });
  }

  it('ambiguous 2026-04-06 12:00 KST uses 12-jieqi month pillar (壬辰), not lunar 月建 (辛卯)', () => {
    const a = fixture.ambiguousCase;
    const result = ENGINE.analyze({
      birth: { instant: a.solarDateTime },
      sex: 'U',
      location: { lat: 37.5665, lon: 126.978, name: 'Seoul' },
    });
    const month = result.summary.pillars!.month;
    const got = `${month.stem.text}${month.branch.text}`;
    expect(got).toBe(a.sajuMonthGanji_by12JieQi);
    expect(got).not.toBe(a.lunarMonthGanji_byKoreanLunarCalendar);
  });
});
