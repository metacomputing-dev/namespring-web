import { describe, it, expect } from 'vitest';
import { getJieBoundaries } from '../../../src/calendar/solarTerms.js';

/**
 * Baseline snapshot — UTC instants of the 12 saju month boundaries
 * (節, jie) for 51 years 1980..2030 inclusive.
 *
 * Purpose: high-leverage regression target for the precision work.
 * Saju month/year pillars depend on these boundaries, so any drift in
 * the underlying solar pipeline (Phase 4/5/6) shows up here first.
 *
 * Method is fixed to 'meeus' (the engine's analytic root finder) so
 * that the snapshot reflects pure pipeline behavior, not the cheaper
 * 'approx' calendar lookup.
 */

const YEAR_FROM = 1980;
const YEAR_TO = 2030; // inclusive
const TERMS_PER_YEAR = 12;

interface JieRow {
  year: number;
  id: string;
  longitude: number;
  utcMs: number;
  iso: string;
}

function buildBaseline(): JieRow[] {
  const out: JieRow[] = [];
  for (let year = YEAR_FROM; year <= YEAR_TO; year++) {
    const terms = getJieBoundaries(year, 'meeus');
    for (const t of terms) {
      out.push({
        year: t.year,
        id: t.id,
        longitude: t.longitude,
        utcMs: t.utcMs,
        iso: new Date(t.utcMs).toISOString(),
      });
    }
  }
  return out;
}

describe('baseline: 12 jie boundaries 1980-2030 (meeus)', () => {
  it('matches recorded snapshot', () => {
    const rows = buildBaseline();
    const expectedCount = (YEAR_TO - YEAR_FROM + 1) * TERMS_PER_YEAR;
    expect(rows.length).toBe(expectedCount);
    expect(rows).toMatchSnapshot();
  });

  it('boundaries are strictly increasing in time', () => {
    const rows = buildBaseline();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].utcMs).toBeGreaterThan(rows[i - 1].utcMs);
    }
  });

  it('every year reports exactly 12 jie terms', () => {
    const rows = buildBaseline();
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.year, (counts.get(r.year) ?? 0) + 1);
    for (const [, c] of counts) {
      expect(c).toBe(TERMS_PER_YEAR);
    }
  });
});
