import { describe, it, expect } from 'vitest';
import { ShinsalType, SHINSAL_TYPE_INFO } from '../../../src/domain/Shinsal.js';
import { ShinsalWeightCalculator } from '../../../src/engine/analysis/ShinsalWeightModel.js';

/**
 * Ported from ShinsalCatalogDataTest.kt.
 *
 * In Kotlin, this test validates a JSON catalog resource. In TypeScript, the equivalent
 * verification is performed against the SHINSAL_TYPE_INFO record and ShinsalWeightCalculator
 * table, which together serve as the TS "catalog" of implemented shinsal types.
 */

const ALL_SHINSAL_TYPES: ShinsalType[] = Object.values(ShinsalType) as ShinsalType[];

describe('ShinsalCatalogData', () => {

  it('catalog contains at least 30 entries', () => {
    const entries = Object.keys(SHINSAL_TYPE_INFO);
    expect(entries.length).toBeGreaterThanOrEqual(30);
  });

  it('catalog has unique ids matching ShinsalType enum', () => {
    const ids = Object.keys(SHINSAL_TYPE_INFO);
    // Check uniqueness
    expect(ids.length).toBe(new Set(ids).size);
    // Check all enum values are represented
    for (const type of ALL_SHINSAL_TYPES) {
      expect(SHINSAL_TYPE_INFO[type]).toBeDefined();
    }
  });

  it('all domain shinsal types have info entries with valid fields', () => {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const type of ALL_SHINSAL_TYPES) {
      const info = SHINSAL_TYPE_INFO[type];
      if (!info) {
        missing.push(type);
        continue;
      }
      if (!info.koreanName || !info.hanja || !info.grade || !info.description) {
        invalid.push(`${type}: missing fields`);
      }
    }

    expect(missing).toEqual([]);
    expect(invalid).toEqual([]);
  });

  it('all domain shinsal types have base weights in weight calculator', () => {
    const missing: string[] = [];
    const outOfRange: string[] = [];

    for (const type of ALL_SHINSAL_TYPES) {
      const weight = ShinsalWeightCalculator.baseWeightFor(type);
      if (weight === undefined || weight === null) {
        missing.push(type);
        continue;
      }
      if (weight < 1 || weight > 100) {
        outOfRange.push(`${type}(${weight})`);
      }
    }

    expect(missing).toEqual([]);
    expect(outOfRange).toEqual([]);
  });

  it('shinsal type info count matches enum count', () => {
    const infoCount = Object.keys(SHINSAL_TYPE_INFO).length;
    expect(infoCount).toBe(ALL_SHINSAL_TYPES.length);
  });
});
