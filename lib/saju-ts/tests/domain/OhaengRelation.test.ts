import { describe, it, expect } from 'vitest';
import { Ohaeng, OhaengRelation, OhaengRelations, OHAENG_VALUES } from '../../src/domain/Ohaeng.js';

const { WOOD, FIRE, EARTH, METAL, WATER } = Ohaeng;
const { SANGSAENG, SANGGEUK, BIHWA, YEOKSAENG, YEOKGEUK } = OhaengRelation;

/**
 * Ported from OhaengRelationTest.kt
 */

// ==================================================================
// Generation cycle: 목 → 화 → 토 → 금 → 수 → 목
// ==================================================================
describe('Generation cycle', () => {
  it('generates follows sangsaeng cycle', () => {
    expect(OhaengRelations.generates(WOOD)).toBe(FIRE);
    expect(OhaengRelations.generates(FIRE)).toBe(EARTH);
    expect(OhaengRelations.generates(EARTH)).toBe(METAL);
    expect(OhaengRelations.generates(METAL)).toBe(WATER);
    expect(OhaengRelations.generates(WATER)).toBe(WOOD);
  });

  it('generatedBy is inverse of generates', () => {
    for (const element of OHAENG_VALUES) {
      const child = OhaengRelations.generates(element);
      expect(OhaengRelations.generatedBy(child)).toBe(element);
    }
  });

  it('generatedBy follows reverse sangsaeng cycle', () => {
    expect(OhaengRelations.generatedBy(WOOD)).toBe(WATER);
    expect(OhaengRelations.generatedBy(FIRE)).toBe(WOOD);
    expect(OhaengRelations.generatedBy(EARTH)).toBe(FIRE);
    expect(OhaengRelations.generatedBy(METAL)).toBe(EARTH);
    expect(OhaengRelations.generatedBy(WATER)).toBe(METAL);
  });
});

// ==================================================================
// Control cycle: 목 → 토 → 수 → 화 → 금 → 목
// ==================================================================
describe('Control cycle', () => {
  it('controls follows sanggeuk cycle', () => {
    expect(OhaengRelations.controls(WOOD)).toBe(EARTH);
    expect(OhaengRelations.controls(FIRE)).toBe(METAL);
    expect(OhaengRelations.controls(EARTH)).toBe(WATER);
    expect(OhaengRelations.controls(METAL)).toBe(WOOD);
    expect(OhaengRelations.controls(WATER)).toBe(FIRE);
  });

  it('controlledBy is inverse of controls', () => {
    for (const element of OHAENG_VALUES) {
      const victim = OhaengRelations.controls(element);
      expect(OhaengRelations.controlledBy(victim)).toBe(element);
    }
  });

  it('controlledBy follows reverse sanggeuk cycle', () => {
    expect(OhaengRelations.controlledBy(WOOD)).toBe(METAL);
    expect(OhaengRelations.controlledBy(FIRE)).toBe(WATER);
    expect(OhaengRelations.controlledBy(EARTH)).toBe(WOOD);
    expect(OhaengRelations.controlledBy(METAL)).toBe(FIRE);
    expect(OhaengRelations.controlledBy(WATER)).toBe(EARTH);
  });
});

// ==================================================================
// Boolean predicates: isSangsaeng
// ==================================================================
describe('isSangsaeng', () => {
  it('true for all five generation pairs', () => {
    expect(OhaengRelations.isSangsaeng(WOOD, FIRE)).toBe(true);
    expect(OhaengRelations.isSangsaeng(FIRE, EARTH)).toBe(true);
    expect(OhaengRelations.isSangsaeng(EARTH, METAL)).toBe(true);
    expect(OhaengRelations.isSangsaeng(METAL, WATER)).toBe(true);
    expect(OhaengRelations.isSangsaeng(WATER, WOOD)).toBe(true);
  });

  it('false for non-generation pairs', () => {
    expect(OhaengRelations.isSangsaeng(WOOD, WOOD)).toBe(false);
    expect(OhaengRelations.isSangsaeng(WOOD, EARTH)).toBe(false);
    expect(OhaengRelations.isSangsaeng(FIRE, WOOD)).toBe(false);
    expect(OhaengRelations.isSangsaeng(METAL, FIRE)).toBe(false);
  });
});

// ==================================================================
// Boolean predicates: isSanggeuk
// ==================================================================
describe('isSanggeuk', () => {
  it('true for all five control pairs', () => {
    expect(OhaengRelations.isSanggeuk(WOOD, EARTH)).toBe(true);
    expect(OhaengRelations.isSanggeuk(FIRE, METAL)).toBe(true);
    expect(OhaengRelations.isSanggeuk(EARTH, WATER)).toBe(true);
    expect(OhaengRelations.isSanggeuk(METAL, WOOD)).toBe(true);
    expect(OhaengRelations.isSanggeuk(WATER, FIRE)).toBe(true);
  });

  it('false for non-control pairs', () => {
    expect(OhaengRelations.isSanggeuk(WOOD, WOOD)).toBe(false);
    expect(OhaengRelations.isSanggeuk(WOOD, FIRE)).toBe(false);
    expect(OhaengRelations.isSanggeuk(EARTH, METAL)).toBe(false);
    expect(OhaengRelations.isSanggeuk(WATER, WOOD)).toBe(false);
  });
});

// ==================================================================
// relation() -- exhaustive 5x5 matrix
// ==================================================================
describe('relation()', () => {
  it('BIHWA for all same-element pairs', () => {
    for (const element of OHAENG_VALUES) {
      expect(OhaengRelations.relation(element, element)).toBe(BIHWA);
    }
  });

  it('YEOKSAENG when from generates to', () => {
    expect(OhaengRelations.relation(WOOD, FIRE)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(FIRE, EARTH)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(EARTH, METAL)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(METAL, WATER)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(WATER, WOOD)).toBe(YEOKSAENG);
  });

  it('SANGSAENG when to generates from', () => {
    expect(OhaengRelations.relation(FIRE, WOOD)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(EARTH, FIRE)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(METAL, EARTH)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(WATER, METAL)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(WOOD, WATER)).toBe(SANGSAENG);
  });

  it('SANGGEUK when from controls to', () => {
    expect(OhaengRelations.relation(WOOD, EARTH)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(FIRE, METAL)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(EARTH, WATER)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(METAL, WOOD)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(WATER, FIRE)).toBe(SANGGEUK);
  });

  it('YEOKGEUK when to controls from', () => {
    expect(OhaengRelations.relation(EARTH, WOOD)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(METAL, FIRE)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(WATER, EARTH)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(WOOD, METAL)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(FIRE, WATER)).toBe(YEOKGEUK);
  });

  it('covers all 25 combinations with 5 of each relation', () => {
    const counts = new Map<OhaengRelation, number>();
    for (const from of OHAENG_VALUES) {
      for (const to of OHAENG_VALUES) {
        const r = OhaengRelations.relation(from, to);
        counts.set(r, (counts.get(r) ?? 0) + 1);
      }
    }
    expect(counts.get(BIHWA)).toBe(5);
    expect(counts.get(SANGSAENG)).toBe(5);
    expect(counts.get(SANGGEUK)).toBe(5);
    expect(counts.get(YEOKSAENG)).toBe(5);
    expect(counts.get(YEOKGEUK)).toBe(5);
  });
});

// ==================================================================
// Symmetry / structural properties
// ==================================================================
describe('Symmetry', () => {
  it('SANGSAENG and YEOKSAENG are symmetric', () => {
    for (const from of OHAENG_VALUES) {
      for (const to of OHAENG_VALUES) {
        if (OhaengRelations.relation(from, to) === YEOKSAENG) {
          expect(OhaengRelations.relation(to, from)).toBe(SANGSAENG);
        }
      }
    }
  });

  it('SANGGEUK and YEOKGEUK are symmetric', () => {
    for (const from of OHAENG_VALUES) {
      for (const to of OHAENG_VALUES) {
        if (OhaengRelations.relation(from, to) === SANGGEUK) {
          expect(OhaengRelations.relation(to, from)).toBe(YEOKGEUK);
        }
      }
    }
  });

  it('BIHWA only occurs for same elements', () => {
    for (const from of OHAENG_VALUES) {
      for (const to of OHAENG_VALUES) {
        if (OhaengRelations.relation(from, to) === BIHWA) {
          expect(from).toBe(to);
        }
      }
    }
  });
});

// ==================================================================
// Cycle closure
// ==================================================================
describe('Cycle closure', () => {
  it('generation cycle returns to origin after 5 steps', () => {
    for (const start of OHAENG_VALUES) {
      let current = start;
      for (let i = 0; i < 5; i++) {
        current = OhaengRelations.generates(current);
      }
      expect(current).toBe(start);
    }
  });

  it('control cycle returns to origin after 5 steps', () => {
    for (const start of OHAENG_VALUES) {
      let current = start;
      for (let i = 0; i < 5; i++) {
        current = OhaengRelations.controls(current);
      }
      expect(current).toBe(start);
    }
  });
});

// ==================================================================
// Consistency: boolean predicates agree with relation()
// ==================================================================
describe('Boolean-relation consistency', () => {
  it('isSangsaeng consistent with relation', () => {
    for (const a of OHAENG_VALUES) {
      for (const b of OHAENG_VALUES) {
        expect(OhaengRelations.isSangsaeng(a, b)).toBe(OhaengRelations.relation(a, b) === YEOKSAENG);
      }
    }
  });

  it('isSanggeuk consistent with relation', () => {
    for (const a of OHAENG_VALUES) {
      for (const b of OHAENG_VALUES) {
        expect(OhaengRelations.isSanggeuk(a, b)).toBe(OhaengRelations.relation(a, b) === SANGGEUK);
      }
    }
  });
});

// ==================================================================
// Cross-validation: row-by-row
// ==================================================================
describe('Row cross-validation', () => {
  it('WOOD row matches traditional reference', () => {
    expect(OhaengRelations.relation(WOOD, WOOD)).toBe(BIHWA);
    expect(OhaengRelations.relation(WOOD, FIRE)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(WOOD, EARTH)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(WOOD, METAL)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(WOOD, WATER)).toBe(SANGSAENG);
  });

  it('FIRE row matches traditional reference', () => {
    expect(OhaengRelations.relation(FIRE, WOOD)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(FIRE, FIRE)).toBe(BIHWA);
    expect(OhaengRelations.relation(FIRE, EARTH)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(FIRE, METAL)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(FIRE, WATER)).toBe(YEOKGEUK);
  });

  it('EARTH row matches traditional reference', () => {
    expect(OhaengRelations.relation(EARTH, WOOD)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(EARTH, FIRE)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(EARTH, EARTH)).toBe(BIHWA);
    expect(OhaengRelations.relation(EARTH, METAL)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(EARTH, WATER)).toBe(SANGGEUK);
  });

  it('METAL row matches traditional reference', () => {
    expect(OhaengRelations.relation(METAL, WOOD)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(METAL, FIRE)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(METAL, EARTH)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(METAL, METAL)).toBe(BIHWA);
    expect(OhaengRelations.relation(METAL, WATER)).toBe(YEOKSAENG);
  });

  it('WATER row matches traditional reference', () => {
    expect(OhaengRelations.relation(WATER, WOOD)).toBe(YEOKSAENG);
    expect(OhaengRelations.relation(WATER, FIRE)).toBe(SANGGEUK);
    expect(OhaengRelations.relation(WATER, EARTH)).toBe(YEOKGEUK);
    expect(OhaengRelations.relation(WATER, METAL)).toBe(SANGSAENG);
    expect(OhaengRelations.relation(WATER, WATER)).toBe(BIHWA);
  });
});
