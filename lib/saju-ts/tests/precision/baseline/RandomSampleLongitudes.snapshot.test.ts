import { describe, it, expect } from 'vitest';
import { solarApparentLongitudeDeg } from '../../../src/calendar/solar.js';
import { utcMsToJulianDay } from '../../../src/calendar/julian.js';

/**
 * Baseline snapshot — apparent solar longitude at 100 deterministic
 * random instants spread over 1900-01-01 .. 2100-12-31 UTC.
 *
 * Purpose: regression measurement for upcoming precision work
 * (Phase 4 R-aberration, Phase 5 nutation, Phase 6 EoT).
 *
 * The snapshot is the *current* (pre-improvement) output. Any commit
 * that changes the default solar longitude pipeline must update this
 * snapshot consciously and explain the delta.
 */

const MS_PER_DAY = 86_400_000;
const START_MS = Date.UTC(1900, 0, 1, 0, 0, 0);
const END_MS = Date.UTC(2100, 11, 31, 23, 59, 59);

/**
 * mulberry32 PRNG — small, deterministic, stable across Node versions.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Sample {
  utcMs: number;
  iso: string;
  longitudeDeg: string; // string for stable formatting in snapshots
}

function buildSamples(): Sample[] {
  const rng = mulberry32(0x5A1FA1A); // 0x5A1FA1A = arbitrary fixed seed
  const span = END_MS - START_MS;
  const out: Sample[] = [];

  for (let i = 0; i < 100; i++) {
    // Pick whole-second instant for deterministic readability.
    const offsetMs = Math.floor(rng() * span);
    const utcMs = START_MS + offsetMs - (offsetMs % 1000);
    const lonDeg = solarApparentLongitudeDeg(utcMsToJulianDay(utcMs));
    out.push({
      utcMs,
      iso: new Date(utcMs).toISOString(),
      // 8 decimal places ≈ 0.001″ — well below current engine precision.
      longitudeDeg: lonDeg.toFixed(8),
    });
  }
  return out;
}

describe('baseline: apparent solar longitude (100 random samples 1900-2100)', () => {
  it('matches recorded snapshot', () => {
    const samples = buildSamples();
    expect(samples.length).toBe(100);
    expect(samples).toMatchSnapshot();
  });

  it('all longitudes are in [0, 360)', () => {
    const samples = buildSamples();
    for (const s of samples) {
      const lon = Number(s.longitudeDeg);
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(360);
    }
  });
});
