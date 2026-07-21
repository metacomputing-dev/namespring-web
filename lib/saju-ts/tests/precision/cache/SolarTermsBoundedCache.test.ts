import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/calendar/utc.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/calendar/utc.js')>();
  return {
    ...actual,
    utcMsFromParts: vi.fn(actual.utcMsFromParts),
  };
});

import {
  getLiChunUtcMs,
  getSolarTerms,
  type SolarTermAlgorithm,
} from '../../../src/calendar/solarTerms.js';
import type { AberrationModel, SolarPrecision } from '../../../src/calendar/solar.js';
import { utcMsFromParts } from '../../../src/calendar/utc.js';

const CACHE_YEAR_POLICY_LIMIT = 512;
const mockedUtcMsFromParts = vi.mocked(utcMsFromParts);

const APPROX_EQUIVALENT_POLICIES: ReadonlyArray<
  readonly [SolarTermAlgorithm, AberrationModel, SolarPrecision]
> = [
  ['bisection', 'constant', 'classical'],
  ['bisection', 'constant', 'iau1980_top10'],
  ['bisection', 'constant', 'iau1980_full'],
  ['bisection', 'rCorrected', 'classical'],
  ['bisection', 'rCorrected', 'iau1980_top10'],
  ['bisection', 'rCorrected', 'iau1980_full'],
  ['newton', 'constant', 'classical'],
  ['newton', 'constant', 'iau1980_top10'],
  ['newton', 'constant', 'iau1980_full'],
  ['newton', 'rCorrected', 'classical'],
  ['newton', 'rCorrected', 'iau1980_top10'],
  ['newton', 'rCorrected', 'iau1980_full'],
];

describe('bounded solar-term cache', () => {
  beforeEach(() => {
    mockedUtcMsFromParts.mockClear();
  });

  it('canonicalizes all no-op policy variants of the approximate method', () => {
    const year = 6101;
    const expected = getSolarTerms(year, 'approx');
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(24);

    for (const [algorithm, aberrationModel, solarPrecision] of APPROX_EQUIVALENT_POLICIES) {
      expect(
        getSolarTerms(year, 'approx', algorithm, aberrationModel, solarPrecision),
      ).toEqual(expected);
    }
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(24);
  });

  it('deterministically evicts the oldest year-policy family at the bound', () => {
    const firstYear = 6200;
    getLiChunUtcMs(firstYear, 'approx');
    for (let offset = 1; offset <= CACHE_YEAR_POLICY_LIMIT; offset += 1) {
      getLiChunUtcMs(firstYear + offset, 'approx');
    }
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(CACHE_YEAR_POLICY_LIMIT + 1);

    getLiChunUtcMs(firstYear + CACHE_YEAR_POLICY_LIMIT, 'approx');
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(CACHE_YEAR_POLICY_LIMIT + 1);

    getLiChunUtcMs(firstYear, 'approx');
    expect(mockedUtcMsFromParts).toHaveBeenCalledTimes(CACHE_YEAR_POLICY_LIMIT + 2);
  });

  it('recomputes byte-identical default output after its cache entry is evicted', () => {
    const expected = JSON.stringify(getSolarTerms(2028, 'meeus'));

    for (let offset = 0; offset <= CACHE_YEAR_POLICY_LIMIT; offset += 1) {
      getLiChunUtcMs(7000 + offset, 'approx');
    }

    expect(JSON.stringify(getSolarTerms(2028, 'meeus'))).toBe(expected);
  });
});
