import type { Element } from './cycle.js';

export interface ElementVector {
  WOOD: number;
  FIRE: number;
  EARTH: number;
  METAL: number;
  WATER: number;
}

export const ELEMENT_ORDER: Element[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

export function zeroElementVector(): ElementVector {
  return { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
}

export function cloneElementVector(v: ElementVector): ElementVector {
  return { WOOD: v.WOOD, FIRE: v.FIRE, EARTH: v.EARTH, METAL: v.METAL, WATER: v.WATER };
}

export function addElement(v: ElementVector, e: Element, amount: number): ElementVector {
  v[e] += amount;
  return v;
}

export function addVectors(a: ElementVector, b: ElementVector): ElementVector {
  return {
    WOOD: a.WOOD + b.WOOD,
    FIRE: a.FIRE + b.FIRE,
    EARTH: a.EARTH + b.EARTH,
    METAL: a.METAL + b.METAL,
    WATER: a.WATER + b.WATER,
  };
}

export function scaleVector(v: ElementVector, k: number): ElementVector {
  return {
    WOOD: v.WOOD * k,
    FIRE: v.FIRE * k,
    EARTH: v.EARTH * k,
    METAL: v.METAL * k,
    WATER: v.WATER * k,
  };
}
