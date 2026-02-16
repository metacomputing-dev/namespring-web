import { describe, it, expect } from 'vitest';
import { JeolBoundaryTable } from '../../src/calendar/solar/JeolBoundaryTable.js';
import {
  ClassicalSource,
  CLASSICAL_SOURCE_INFO,
  inlineCitation,
} from '../../src/domain/ClassicalSource.js';

/**
 * Defensive Edge Case Tests (I-04)
 *
 * Four areas of defensive testing:
 *   EDGE-004: Resource loading robustness (JeolBoundaryTable)
 *   EDGE-003: Pole + dateline coordinate combinations (structural only -- no full pipeline in TS port)
 *   GAP-2:    ClassicalSource utility method coverage
 *
 * Ported from DefensiveEdgeCaseTest.kt
 *
 * Note: EDGE-006 (all config parameters non-default) and EDGE-003 (full pipeline)
 * are omitted because the TS port does not yet have a full DefaultSajuAnalysisCalculator.
 * The ClassicalSource and JeolBoundaryTable tests are fully ported.
 */

// =========================================================================
// EDGE-004: Resource Loading Robustness
// =========================================================================

describe('EDGE-004: Resource Loading Robustness', () => {
  it('JeolBoundaryTable loads non-empty boundary data', () => {
    expect(JeolBoundaryTable.isSupportedYear(2000)).toBe(true);
  });

  it('JeolBoundaryTable has approximately 1812 entries across 151 years', () => {
    let totalBoundaries = 0;
    for (let year = 1900; year <= 2050; year++) {
      const yearBoundaries = JeolBoundaryTable.boundariesForYear(year);
      expect(yearBoundaries).toBeDefined();
      totalBoundaries += yearBoundaries!.size;
    }
    // 151 * 12 = 1812 expected
    expect(totalBoundaries).toBeGreaterThanOrEqual(1800);
  });

  it('JeolBoundaryTable covers every year from 1900 to 2050', () => {
    for (let year = 1900; year <= 2050; year++) {
      expect(JeolBoundaryTable.isSupportedYear(year)).toBe(
        true,
        `Year ${year} should be supported`,
      );
    }
  });

  it('JeolBoundaryTable does not claim support for years outside range', () => {
    expect(JeolBoundaryTable.isSupportedYear(1899)).toBe(false);
    expect(JeolBoundaryTable.isSupportedYear(2051)).toBe(false);
  });

  it('each supported year has exactly 12 jeol boundaries with distinct sajuMonthIndex', () => {
    for (let year = 1900; year <= 2050; year++) {
      const boundaries = JeolBoundaryTable.boundariesForYear(year)!;
      expect(boundaries.size).toBe(12);

      // All 12 saju month indices (1..12) should be present
      const indices = [...boundaries.keys()].sort((a, b) => a - b);
      const expected = Array.from({ length: 12 }, (_, i) => i + 1);
      expect(indices).toEqual(expected);
    }
  });

  it('ipchunOf returns a valid boundary for supported years', () => {
    for (const year of [1900, 1950, 2000, 2024, 2050]) {
      const ipchun = JeolBoundaryTable.ipchunOf(year);
      expect(ipchun).toBeDefined();
      expect(ipchun!.sajuMonthIndex).toBe(1);
      // Ipchun should fall in January or February
      expect(ipchun!.month).toBeGreaterThanOrEqual(1);
      expect(ipchun!.month).toBeLessThanOrEqual(2);
    }
  });

  it('ipchunOf returns undefined for unsupported years', () => {
    expect(JeolBoundaryTable.ipchunOf(1899)).toBeUndefined();
    expect(JeolBoundaryTable.ipchunOf(2051)).toBeUndefined();
  });

  it('sajuMonthIndexAt returns a valid index within the table range', () => {
    // Mid-year 2000: should be a valid month index
    const index = JeolBoundaryTable.sajuMonthIndexAt(2000, 6, 15, 12, 0);
    expect(index).toBeDefined();
    expect(index).toBeGreaterThanOrEqual(1);
    expect(index).toBeLessThanOrEqual(12);
  });

  it('nextBoundaryAfter returns a boundary in the future', () => {
    const boundary = JeolBoundaryTable.nextBoundaryAfter(2000, 1, 1, 0, 0);
    expect(boundary).toBeDefined();
    // Should be the first jeol of 2000 or later
    expect(boundary!.year).toBeGreaterThanOrEqual(2000);
  });

  it('previousBoundaryAtOrBefore returns a boundary in the past', () => {
    const boundary = JeolBoundaryTable.previousBoundaryAtOrBefore(2000, 12, 31, 23, 59);
    expect(boundary).toBeDefined();
    expect(boundary!.year).toBeLessThanOrEqual(2000);
  });
});

// =========================================================================
// GAP-2: ClassicalSource Utility Methods
// =========================================================================

describe('GAP-2: ClassicalSource Utility Methods', () => {
  const allSources = Object.values(ClassicalSource);

  it('all seven ClassicalSource values are present', () => {
    expect(allSources.length).toBe(7);
  });

  it.each(allSources)('inlineCitation produces non-empty string for %s', (source) => {
    const citation = inlineCitation(source);
    expect(citation.length).toBeGreaterThan(0);
  });

  it.each(allSources)(
    'inlineCitation follows consistent bracket format for %s',
    (source) => {
      const citation = inlineCitation(source);
      expect(citation.startsWith('[출처: ')).toBe(true);
      expect(citation.endsWith(']')).toBe(true);
    },
  );

  it.each(allSources)(
    'inlineCitation includes the shortLabel for %s',
    (source) => {
      const citation = inlineCitation(source);
      const info = CLASSICAL_SOURCE_INFO[source];
      expect(citation).toContain(info.shortLabel);
    },
  );

  it.each(allSources)('shortLabel is non-empty for %s', (source) => {
    expect(CLASSICAL_SOURCE_INFO[source].shortLabel.length).toBeGreaterThan(0);
  });

  it.each(allSources)(
    'koreanName is non-empty for %s',
    (source) => {
      expect(CLASSICAL_SOURCE_INFO[source].koreanName.length).toBeGreaterThan(0);
    },
  );

  it.each(allSources)('hanja is non-empty for %s', (source) => {
    expect(CLASSICAL_SOURCE_INFO[source].hanja.length).toBeGreaterThan(0);
  });

  it.each(allSources)('era is non-empty for %s', (source) => {
    expect(CLASSICAL_SOURCE_INFO[source].era.length).toBeGreaterThan(0);
  });

  it.each(allSources)('description is non-empty for %s', (source) => {
    expect(CLASSICAL_SOURCE_INFO[source].description.length).toBeGreaterThan(0);
  });

  it.each(allSources)(
    'inlineCitation content is extractable between brackets for %s',
    (source) => {
      const citation = inlineCitation(source);
      const extracted = citation.replace('[출처: ', '').replace(']', '');
      expect(extracted).toBe(CLASSICAL_SOURCE_INFO[source].shortLabel);
    },
  );

  it('all ClassicalSource enum names match known values', () => {
    const expectedNames = [
      'JEOKCHEONSU',
      'GUNGTONGBOGAM',
      'JAPYEONGJINJEON',
      'SAMMYEONGTTONGHOE',
      'YEONHAEJAYPYEONG',
      'MYEONGLIJEONGJON',
      'KOREAN_MODERN_PRACTICE',
    ];
    for (const name of expectedNames) {
      expect(allSources).toContain(name);
    }
  });

  it('CLASSICAL_SOURCE_INFO has entries for every source', () => {
    for (const source of allSources) {
      const info = CLASSICAL_SOURCE_INFO[source];
      expect(info).toBeDefined();
      expect(info.koreanName).toBeDefined();
      expect(info.hanja).toBeDefined();
      expect(info.shortLabel).toBeDefined();
      expect(info.era).toBeDefined();
      expect(info.description).toBeDefined();
    }
  });
});
