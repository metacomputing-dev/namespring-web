import type { Element } from './cycle.js';

/** 五行 相生(生成) 단일 매핑: from → to */
export const GENERATES_TO: Record<Element, Element> = {
  WOOD: 'FIRE',
  FIRE: 'EARTH',
  EARTH: 'METAL',
  METAL: 'WATER',
  WATER: 'WOOD',
};

/** 五行 相剋(극) 단일 매핑: from → to */
export const CONTROLS_TO: Record<Element, Element> = {
  WOOD: 'EARTH',
  EARTH: 'WATER',
  WATER: 'FIRE',
  FIRE: 'METAL',
  METAL: 'WOOD',
};

/** 相生 reverse: to → from */
export const GENERATED_BY: Record<Element, Element> = {
  WOOD: 'WATER',
  FIRE: 'WOOD',
  EARTH: 'FIRE',
  METAL: 'EARTH',
  WATER: 'METAL',
};

/** 相剋 reverse: to → from */
export const CONTROLLED_BY: Record<Element, Element> = {
  WOOD: 'METAL',
  FIRE: 'WATER',
  EARTH: 'WOOD',
  METAL: 'FIRE',
  WATER: 'EARTH',
};

export function nextGeneratedElement(from: Element): Element {
  return GENERATES_TO[from];
}

export function prevGeneratedElement(to: Element): Element {
  return GENERATED_BY[to];
}

export function nextControlledElement(from: Element): Element {
  return CONTROLS_TO[from];
}

export function prevControlledElement(to: Element): Element {
  return CONTROLLED_BY[to];
}

export function generates(from: Element, to: Element): boolean {
  return GENERATES_TO[from] === to;
}

export function controls(from: Element, to: Element): boolean {
  return CONTROLS_TO[from] === to;
}

export function isSameElement(a: Element, b: Element): boolean {
  return a === b;
}
