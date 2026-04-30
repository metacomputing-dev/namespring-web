import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/kasi_2027_24terms.json';
import { solarTermUtcMsForLongitude } from '../../../src/calendar/solarTerms.js';

/**
 * Regression test for the KASI 2027 24-term fixture.
 *
 * Source: `tests/precision/fixtures/kasi_2027_24terms.json`
 *  (originally `saju_master/saju_master/kasi_terms.py:51-76`).
 *
 * Tolerance:
 *  - Aspirational target = ±2 minutes (matches saju_master's own
 *    regression policy and KASI's published minute-level resolution).
 *  - At baseline (single-Ω nutation, R=1 aberration, VSOP87 truncated)
 *    the engine may exceed 2 minutes on a few terms. We assert a
 *    looser ±10 minute envelope here so the suite is informative
 *    rather than red-by-default; tightening to ±2 minutes is a
 *    Phase 5 deliverable (`solarPrecision='iau1980_full'`).
 *  - The per-term delta is also recorded as a snapshot so that any
 *    drift (positive or negative) is visible in code review.
 */

const ASPIRATIONAL_TOL_MIN = 2;
const BASELINE_TOL_MIN = 10;
const MS_PER_MIN = 60_000;

interface TermDelta {
  hanja: string;
  korean: string;
  degree: number;
  expectedKstIso: string;
  computedUtcIso: string;
  deltaMinutes: number;
  withinAspirational: boolean;
}

function computeAllDeltas(): TermDelta[] {
  const out: TermDelta[] = [];
  for (const term of fixture.terms) {
    const expectedMs = new Date(term.kstIso).getTime();
    const computedMs = solarTermUtcMsForLongitude(2027, term.degree, 'meeus');
    const deltaMs = computedMs - expectedMs;
    const deltaMinutes = deltaMs / MS_PER_MIN;
    out.push({
      hanja: term.hanja,
      korean: term.name,
      degree: term.degree,
      expectedKstIso: term.kstIso,
      computedUtcIso: new Date(computedMs).toISOString(),
      // 3 decimal places of a minute => sub-second readability without
      // pretending the underlying KASI fixture is sub-minute precise.
      deltaMinutes: Number(deltaMinutes.toFixed(3)),
      withinAspirational: Math.abs(deltaMinutes) <= ASPIRATIONAL_TOL_MIN,
    });
  }
  return out;
}

describe('KASI 2027 24-term boundary regression', () => {
  it('every term is within the loose baseline envelope (±10 min)', () => {
    const deltas = computeAllDeltas();
    const offenders = deltas.filter(
      (d) => Math.abs(d.deltaMinutes) > BASELINE_TOL_MIN,
    );
    expect(offenders).toEqual([]);
  });

  it('records per-term delta snapshot for review', () => {
    const deltas = computeAllDeltas();
    expect(deltas).toMatchSnapshot();
  });

  it('reports how many terms meet the ±2 min aspirational tolerance', () => {
    const deltas = computeAllDeltas();
    const meetingAspirational = deltas.filter((d) => d.withinAspirational).length;
    // Snapshot the count so future precision phases can show progress.
    expect({
      totalTerms: deltas.length,
      meetingAspirational,
      maxAbsDeltaMinutes: Number(
        Math.max(...deltas.map((d) => Math.abs(d.deltaMinutes))).toFixed(3),
      ),
    }).toMatchSnapshot();
  });
});
