import type { Element, StemIdx, YinYang } from './cycle.js';
import { stemElement, stemYinYang } from './cycle.js';
import type { HiddenStem } from './hiddenStems.js';

export interface ElementTally {
  WOOD: number;
  FIRE: number;
  EARTH: number;
  METAL: number;
  WATER: number;
}

export interface YinYangTally {
  YANG: number;
  YIN: number;
}

export function emptyElementTally(): ElementTally {
  return { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
}

export function emptyYinYangTally(): YinYangTally {
  return { YANG: 0, YIN: 0 };
}

export function addElement(t: ElementTally, e: Element, w: number): void {
  t[e] += w;
}

export function addYinYang(t: YinYangTally, y: YinYang, w: number): void {
  t[y] += w;
}

export function mergeElementTallies(a: ElementTally, b: ElementTally): ElementTally {
  return {
    WOOD: a.WOOD + b.WOOD,
    FIRE: a.FIRE + b.FIRE,
    EARTH: a.EARTH + b.EARTH,
    METAL: a.METAL + b.METAL,
    WATER: a.WATER + b.WATER,
  };
}

export function tallyStems(stems: StemIdx[], stemWeight = 1): { elements: ElementTally; yinYang: YinYangTally } {
  const el = emptyElementTally();
  const yy = emptyYinYangTally();
  for (const s of stems) {
    addElement(el, stemElement(s), stemWeight);
    addYinYang(yy, stemYinYang(s), stemWeight);
  }
  return { elements: el, yinYang: yy };
}

export function tallyHiddenStems(
  branchHidden: HiddenStem[],
  branchTotalWeight = 1,
): { elements: ElementTally; yinYang: YinYangTally } {
  const el = emptyElementTally();
  const yy = emptyYinYangTally();
  for (const hs of branchHidden) {
    const w = hs.weight * branchTotalWeight;
    addElement(el, stemElement(hs.stem), w);
    addYinYang(yy, stemYinYang(hs.stem), w);
  }
  return { elements: el, yinYang: yy };
}
