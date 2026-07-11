import { describe, expect, it } from 'vitest';

import { createEngine } from '../../../src/api/engine.js';
import {
  getJieBoundaries,
  getSolarTerms,
  type SolarTermInstant,
} from '../../../src/calendar/solarTerms.js';

const DAY_MS = 86_400_000;
const METHOD = 'meeus' as const;
const ALGORITHM = 'bisection' as const;
const ABERRATION = 'constant' as const;
const PRECISION = 'classical' as const;

function solarTerms(year: number): SolarTermInstant[] {
  return getSolarTerms(year, METHOD, ALGORITHM, ABERRATION, PRECISION);
}

function jieBoundaries(year: number): SolarTermInstant[] {
  return getJieBoundaries(year, METHOD, ALGORITHM, ABERRATION, PRECISION);
}

function liChun(terms: SolarTermInstant[]): SolarTermInstant {
  const found = terms.find((term) => term.id === 'LICHUN');
  if (!found) throw new Error('LICHUN missing from solar terms');
  return found;
}

function yearPillarAt(instant: string): { stem: number; branch: number } {
  const result = createEngine().analyze({
    birth: { instant },
    sex: 'U',
    location: { lat: 37.5665, lon: 126.978, name: 'Seoul' },
  });
  const year = result.summary.pillars?.year;
  if (!year) throw new Error('summary.pillars.year missing');
  return { stem: year.stem.idx, branch: year.branch.idx };
}

describe('solar-term cache ownership', () => {
  it('returns a fresh array and fresh term objects on every call', () => {
    const firstSolar = solarTerms(2031);
    const secondSolar = solarTerms(2031);
    const firstJie = jieBoundaries(2031);
    const secondJie = jieBoundaries(2031);

    expect(firstSolar).toEqual(secondSolar);
    expect(firstSolar).not.toBe(secondSolar);
    expect(firstSolar.every((term, index) => term !== secondSolar[index])).toBe(true);
    expect(firstJie).toEqual(secondJie);
    expect(firstJie).not.toBe(secondJie);
    expect(firstJie.every((term, index) => term !== secondJie[index])).toBe(true);

    liChun(firstSolar).utcMs += 40 * DAY_MS;
    liChun(firstJie).utcMs -= 40 * DAY_MS;
    firstSolar.reverse();
    firstJie.pop();

    expect(solarTerms(2031)).toEqual(secondSolar);
    expect(jieBoundaries(2031)).toEqual(secondJie);
  });

  it('caller mutation cannot shift a later LiChun lookup or engine year pillar', () => {
    const callerOwnedTerms = solarTerms(2024);
    const canonicalLiChunUtcMs = liChun(callerOwnedTerms).utcMs;
    const afterLiChun = new Date(canonicalLiChunUtcMs + DAY_MS).toISOString();
    const expectedYearPillar = yearPillarAt(afterLiChun);

    liChun(callerOwnedTerms).utcMs += 40 * DAY_MS;

    expect(liChun(solarTerms(2024)).utcMs).toBe(canonicalLiChunUtcMs);
    expect(yearPillarAt(afterLiChun)).toEqual(expectedYearPillar);
  });
});
