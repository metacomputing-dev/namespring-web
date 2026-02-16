export enum Ohaeng {
  WOOD  = 'WOOD',
  FIRE  = 'FIRE',
  EARTH = 'EARTH',
  METAL = 'METAL',
  WATER = 'WATER',
}

export const OHAENG_VALUES: readonly Ohaeng[] = [
  Ohaeng.WOOD, Ohaeng.FIRE, Ohaeng.EARTH, Ohaeng.METAL, Ohaeng.WATER,
] as const;

export const OHAENG_KOREAN_LABELS: Readonly<Record<Ohaeng, string>> = {
  [Ohaeng.WOOD]: '목(木)',
  [Ohaeng.FIRE]: '화(火)',
  [Ohaeng.EARTH]: '토(土)',
  [Ohaeng.METAL]: '금(金)',
  [Ohaeng.WATER]: '수(水)',
};

export function ohaengKoreanLabel(ohaeng: Ohaeng): string {
  return OHAENG_KOREAN_LABELS[ohaeng];
}

export function ohaengOrdinal(o: Ohaeng): number {
  return OHAENG_VALUES.indexOf(o);
}

export enum OhaengRelation {
  SANGSAENG = 'SANGSAENG',
  SANGGEUK = 'SANGGEUK',
  BIHWA = 'BIHWA',
  YEOKSAENG = 'YEOKSAENG',
  YEOKGEUK = 'YEOKGEUK',
}

const CYCLE_SIZE = 5;

const OFFSET_TO_RELATION: readonly OhaengRelation[] = [
  OhaengRelation.BIHWA,      // d=0: same
  OhaengRelation.YEOKSAENG,  // d=1: I generate
  OhaengRelation.SANGGEUK,   // d=2: I control
  OhaengRelation.YEOKGEUK,   // d=3: other controls me
  OhaengRelation.SANGSAENG,  // d=4: other generates me
] as const;

export const OhaengRelations = {
  relation(from: Ohaeng, to: Ohaeng): OhaengRelation {
    const offset = ((ohaengOrdinal(to) - ohaengOrdinal(from)) + CYCLE_SIZE) % CYCLE_SIZE;
    return OFFSET_TO_RELATION[offset]!;
  },

  generates(element: Ohaeng): Ohaeng {
    return OHAENG_VALUES[(ohaengOrdinal(element) + 1) % CYCLE_SIZE]!;
  },

  generatedBy(element: Ohaeng): Ohaeng {
    return OHAENG_VALUES[(ohaengOrdinal(element) - 1 + CYCLE_SIZE) % CYCLE_SIZE]!;
  },

  controls(element: Ohaeng): Ohaeng {
    return OHAENG_VALUES[(ohaengOrdinal(element) + 2) % CYCLE_SIZE]!;
  },

  controlledBy(element: Ohaeng): Ohaeng {
    return OHAENG_VALUES[(ohaengOrdinal(element) - 2 + CYCLE_SIZE) % CYCLE_SIZE]!;
  },

  isSangsaeng(a: Ohaeng, b: Ohaeng): boolean {
    return OhaengRelations.generates(a) === b;
  },

  isSanggeuk(a: Ohaeng, b: Ohaeng): boolean {
    return OhaengRelations.controls(a) === b;
  },
} as const;

