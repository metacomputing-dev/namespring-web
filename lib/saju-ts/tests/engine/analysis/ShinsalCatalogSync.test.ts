import { describe, it, expect } from 'vitest';
import { ShinsalType, SHINSAL_TYPE_INFO, ShinsalGrade } from '../../../src/domain/Shinsal.js';

/**
 * Ported from ShinsalCatalogCsvSyncTest.kt (3 tests).
 *
 * The Kotlin version verifies that a CSV catalog file, a JSON catalog resource,
 * and the ShinsalType enum are all in sync. In the TypeScript codebase there is
 * no separate CSV/JSON catalog; instead SHINSAL_TYPE_INFO serves as the single
 * source of truth. These tests verify:
 *
 * 1. The catalog (SHINSAL_TYPE_INFO) contains at least 30 entries.
 * 2. Every ShinsalType enum value has a corresponding entry with valid grade.
 * 3. Every SHINSAL_TYPE_INFO key maps back to a valid ShinsalType enum value
 *    (bidirectional coverage -- no orphan entries).
 */

const ALL_SHINSAL_TYPES: ShinsalType[] = Object.values(ShinsalType) as ShinsalType[];
const VALID_GRADES: Set<string> = new Set(Object.values(ShinsalGrade));

describe('ShinsalCatalogSync', () => {

  it('catalog contains at least thirty entries', () => {
    const entryCount = Object.keys(SHINSAL_TYPE_INFO).length;
    expect(entryCount).toBeGreaterThanOrEqual(30);
  });

  it('every ShinsalType enum value has a catalog entry with a valid grade', () => {
    const missing: string[] = [];
    const invalidGrade: string[] = [];

    for (const type of ALL_SHINSAL_TYPES) {
      const info = SHINSAL_TYPE_INFO[type];
      if (!info) {
        missing.push(type);
        continue;
      }
      if (!VALID_GRADES.has(info.grade)) {
        invalidGrade.push(`${type}(grade=${info.grade})`);
      }
    }

    expect(missing).toEqual([]);
    expect(invalidGrade).toEqual([]);
  });

  it('all catalog keys correspond to valid ShinsalType enum values', () => {
    const catalogKeys = Object.keys(SHINSAL_TYPE_INFO);
    const enumValues = new Set<string>(ALL_SHINSAL_TYPES);
    const orphans: string[] = [];

    for (const key of catalogKeys) {
      if (!enumValues.has(key)) {
        orphans.push(key);
      }
    }

    expect(orphans).toEqual([]);
    // Bidirectional: enum count must equal catalog count
    expect(catalogKeys.length).toBe(ALL_SHINSAL_TYPES.length);
  });
});
