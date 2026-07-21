import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/calendar/utc.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/calendar/utc.js')>();
  return {
    ...actual,
    utcMsFromParts: vi.fn(actual.utcMsFromParts),
  };
});

import {
  getJieBoundaries,
  getLiChunUtcMs,
  getSolarTerms,
  isJieTermId,
  solarTermUtcMsForLongitude,
} from '../../../src/calendar/solarTerms.js';
import { utcMsFromParts } from '../../../src/calendar/utc.js';

const mockedUtcMsFromParts = vi.mocked(utcMsFromParts);

const REPRESENTATIVE_POLICIES = [
  ['approx', 'bisection', 'constant', 'classical'],
  ['meeus', 'bisection', 'constant', 'classical'],
  ['meeus', 'newton', 'rCorrected', 'iau1980_full'],
] as const;

function expectTermsMatchDirectSolver(
  year: number,
  policy: (typeof REPRESENTATIVE_POLICIES)[number],
): void {
  const [method, algorithm, aberrationModel, solarPrecision] = policy;
  const terms = getSolarTerms(
    year,
    method,
    algorithm,
    aberrationModel,
    solarPrecision,
  );

  expect(terms).toHaveLength(24);
  for (const term of terms) {
    expect(term.utcMs).toBe(
      solarTermUtcMsForLongitude(
        year,
        term.longitude,
        method,
        algorithm,
        aberrationModel,
        solarPrecision,
      ),
    );
  }
}

describe('selective solar-term boundary calculation', () => {
  beforeEach(() => {
    mockedUtcMsFromParts.mockClear();
  });

  it('solves only LiChun on a cold LiChun lookup', () => {
    getLiChunUtcMs(2081, 'approx');

    // The approx solver calls utcMsFromParts exactly once per requested term.
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(1);
  });

  it('solves only the 12 Jie boundaries on a cold Jie lookup', () => {
    const boundaries = getJieBoundaries(2082, 'approx');

    expect(boundaries).toHaveLength(12);
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(12);
  });

  it('shares individually cached terms across the LiChun, Jie, and 24-term APIs', () => {
    const year = 2083;

    getLiChunUtcMs(year, 'approx');
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(1);

    getJieBoundaries(year, 'approx');
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(12);

    getSolarTerms(year, 'approx');
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(24);

    getLiChunUtcMs(year, 'approx');
    getJieBoundaries(year, 'approx');
    getSolarTerms(year, 'approx');
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(24);
  });

  it('matches the legacy 24-term filtering result for every supported calendar year', () => {
    for (let year = 1900; year <= 2050; year++) {
      const liChunUtcMs = getLiChunUtcMs(year, 'meeus');
      const boundaries = getJieBoundaries(year, 'meeus');
      const legacyFiltered = getSolarTerms(year, 'meeus').filter((term) =>
        isJieTermId(term.id),
      );

      expect(boundaries).toEqual(legacyFiltered);
      expect(liChunUtcMs).toBe(
        legacyFiltered.find((term) => term.id === 'LICHUN')?.utcMs,
      );
    }
  });

  it.each(REPRESENTATIVE_POLICIES)(
    'preserves boundary instants for %s/%s/%s/%s',
    (method, algorithm, aberrationModel, solarPrecision) => {
      for (const year of [1900, 1954, 2000, 2024, 2050]) {
        const boundaries = getJieBoundaries(
          year,
          method,
          algorithm,
          aberrationModel,
          solarPrecision,
        );
        const legacyFiltered = getSolarTerms(
          year,
          method,
          algorithm,
          aberrationModel,
          solarPrecision,
        ).filter((term) => isJieTermId(term.id));

        expect(boundaries).toEqual(legacyFiltered);
        expect(
          getLiChunUtcMs(
            year,
            method,
            algorithm,
            aberrationModel,
            solarPrecision,
          ),
        ).toBe(legacyFiltered.find((term) => term.id === 'LICHUN')?.utcMs);
      }
    },
  );

  it.each(REPRESENTATIVE_POLICIES)(
    'matches the direct solver for every returned term under %s/%s/%s/%s',
    (...policy) => {
      for (const year of [1900, 1954, 2000, 2024, 2050]) {
        expectTermsMatchDirectSolver(year, policy);
      }
    },
  );

  it.each([
    ['24 terms -> 12 Jie -> LiChun', 2084, ['solar', 'jie', 'lichun']],
    ['LiChun -> 12 Jie -> 24 terms', 2085, ['lichun', 'jie', 'solar']],
  ] as const)(
    'keeps partial-cache assembly order independent: %s',
    (_label, year, order) => {
      let terms: ReturnType<typeof getSolarTerms> | undefined;
      let boundaries: ReturnType<typeof getJieBoundaries> | undefined;
      let liChunUtcMs: number | undefined;

      for (const api of order) {
        if (api === 'solar') terms = getSolarTerms(year, 'meeus');
        if (api === 'jie') boundaries = getJieBoundaries(year, 'meeus');
        if (api === 'lichun') liChunUtcMs = getLiChunUtcMs(year, 'meeus');
      }

      expectTermsMatchDirectSolver(
        year,
        ['meeus', 'bisection', 'constant', 'classical'],
      );
      expect(boundaries).toEqual(
        terms?.filter((term) => isJieTermId(term.id)),
      );
      expect(liChunUtcMs).toBe(
        terms?.find((term) => term.id === 'LICHUN')?.utcMs,
      );
    },
  );
});
