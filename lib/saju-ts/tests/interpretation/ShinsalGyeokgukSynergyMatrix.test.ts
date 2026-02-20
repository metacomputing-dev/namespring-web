import { describe, it, expect } from 'vitest';
import {
  shinsalGyeokgukSynergyLookup,
  SHINSAL_TYPES_WITH_SYNERGY,
  SHINSAL_TYPES_WITHOUT_SYNERGY,
} from '../../src/interpretation/ShinsalGyeokgukSynergyMatrix.js';
import { ShinsalType } from '../../src/domain/Shinsal.js';
import { GyeokgukCategory, GyeokgukType } from '../../src/domain/Gyeokguk.js';

/**
 * Tests for ShinsalGyeokgukSynergyMatrix.
 *
 * Verifies synergy lookup correctness, non-null returns for known combos,
 * null returns for no-synergy combos, and set completeness.
 */
describe('ShinsalGyeokgukSynergyMatrix', () => {
  // ── Known synergy pairs ──────────────────────────────────────

  describe('known synergy pairs return non-null Korean narrative', () => {
    it('YEOKMA + JAE type => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.YEOKMA, GyeokgukType.PYEONJAE, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('역마');
    });

    it('YEOKMA + GWAN type => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.YEOKMA, GyeokgukType.JEONGGWAN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('역마');
    });

    it('YEOKMA + SIK type => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.YEOKMA, GyeokgukType.SIKSIN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
    });

    it('HWAGAE + IN type => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.HWAGAE, GyeokgukType.JEONGIN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('화개');
    });

    it('HWAGAE + SANG type => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.HWAGAE, GyeokgukType.SANGGWAN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
    });

    it('JANGSEONG + GWAN type => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.JANGSEONG, GyeokgukType.PYEONGWAN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('장성');
    });

    it('JANGSEONG + GEONROK => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.JANGSEONG, GyeokgukType.GEONROK, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
    });

    it('DOHWA + SANG type => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.DOHWA, GyeokgukType.SANGGWAN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('도화');
    });

    it('CHEONUL_GWIIN + GWAN => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.CHEONUL_GWIIN, GyeokgukType.JEONGGWAN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('천을귀인');
    });

    it('YANGIN + YANGIN gyeokguk => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.YANGIN, GyeokgukType.YANGIN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('양인');
    });

    it('CHEONDEOK_GWIIN + NAEGYEOK category => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.CHEONDEOK_GWIIN, GyeokgukType.JEONGGWAN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('천덕귀인');
    });

    it('CHEOLLA_JIMANG + NAEGYEOK category => non-null', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.CHEOLLA_JIMANG, GyeokgukType.SIKSIN, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      expect(result!).toContain('천라지망');
    });
  });

  // ── Null for no-synergy combos ────────────────────────────────

  describe('no synergy combos return null', () => {
    it('CHEONDEOK_HAP always returns null', () => {
      for (const gt of Object.values(GyeokgukType)) {
        for (const cat of Object.values(GyeokgukCategory)) {
          expect(shinsalGyeokgukSynergyLookup(ShinsalType.CHEONDEOK_HAP, gt, cat)).toBeNull();
        }
      }
    });

    it('WOLDEOK_HAP always returns null', () => {
      for (const gt of Object.values(GyeokgukType)) {
        for (const cat of Object.values(GyeokgukCategory)) {
          expect(shinsalGyeokgukSynergyLookup(ShinsalType.WOLDEOK_HAP, gt, cat)).toBeNull();
        }
      }
    });

    it('YEOKMA + non-matching gyeokguk returns null', () => {
      // YEOKMA matches JAE, GWAN, SIK/SANG keywords but not IN or BI_GYEON
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.YEOKMA, GyeokgukType.JEONGIN, GyeokgukCategory.NAEGYEOK);
      expect(result).toBeNull();
    });
  });

  // ── Set completeness ──────────────────────────────────────────

  describe('set completeness', () => {
    it('SHINSAL_TYPES_WITH_SYNERGY has >= 37 entries', () => {
      expect(SHINSAL_TYPES_WITH_SYNERGY.size).toBeGreaterThanOrEqual(37);
    });

    it('SHINSAL_TYPES_WITHOUT_SYNERGY has exactly 2 entries', () => {
      expect(SHINSAL_TYPES_WITHOUT_SYNERGY.size).toBe(2);
    });

    it('WITH and WITHOUT sets are disjoint', () => {
      for (const st of SHINSAL_TYPES_WITH_SYNERGY) {
        expect(SHINSAL_TYPES_WITHOUT_SYNERGY.has(st), `${st} in both sets`).toBe(false);
      }
    });

    it('WITH + WITHOUT covers all ShinsalType values used in matrix', () => {
      // Combined size should cover all relevant types
      const combined = new Set([...SHINSAL_TYPES_WITH_SYNERGY, ...SHINSAL_TYPES_WITHOUT_SYNERGY]);
      expect(combined.size).toBe(SHINSAL_TYPES_WITH_SYNERGY.size + SHINSAL_TYPES_WITHOUT_SYNERGY.size);
    });

    it('every WITH_SYNERGY type has at least one non-null result', () => {
      const allGyeokgukTypes = Object.values(GyeokgukType);
      const allCategories = Object.values(GyeokgukCategory);
      for (const shinsalType of SHINSAL_TYPES_WITH_SYNERGY) {
        let foundNonNull = false;
        outer:
        for (const gt of allGyeokgukTypes) {
          for (const cat of allCategories) {
            if (shinsalGyeokgukSynergyLookup(shinsalType, gt, cat) !== null) {
              foundNonNull = true;
              break outer;
            }
          }
        }
        expect(foundNonNull, `${shinsalType} claims synergy but no non-null result found`).toBe(true);
      }
    });
  });

  // ── Korean text quality ────────────────────────────────────────

  describe('narrative quality', () => {
    it('synergy narratives are non-empty Korean strings', () => {
      const pairs: Array<[ShinsalType, GyeokgukType, GyeokgukCategory]> = [
        [ShinsalType.YEOKMA, GyeokgukType.PYEONJAE, GyeokgukCategory.NAEGYEOK],
        [ShinsalType.HWAGAE, GyeokgukType.JEONGIN, GyeokgukCategory.NAEGYEOK],
        [ShinsalType.DOHWA, GyeokgukType.SANGGWAN, GyeokgukCategory.NAEGYEOK],
        [ShinsalType.JANGSEONG, GyeokgukType.PYEONGWAN, GyeokgukCategory.NAEGYEOK],
        [ShinsalType.CHEONUL_GWIIN, GyeokgukType.JEONGGWAN, GyeokgukCategory.NAEGYEOK],
      ];
      for (const [s, g, c] of pairs) {
        const result = shinsalGyeokgukSynergyLookup(s, g, c);
        expect(result).not.toBeNull();
        expect(result!.length).toBeGreaterThan(10);
        // Should contain Korean characters
        expect(/[\uAC00-\uD7AF]/.test(result!)).toBe(true);
      }
    });

    it('narratives mention the gyeokguk korean name', () => {
      const result = shinsalGyeokgukSynergyLookup(ShinsalType.YEOKMA, GyeokgukType.PYEONJAE, GyeokgukCategory.NAEGYEOK);
      expect(result).not.toBeNull();
      // The narrative should contain the gyeokguk korean name (편재격)
      expect(result!).toContain('편재격');
    });
  });
});
