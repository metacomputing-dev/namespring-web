import { Element } from '../model/element.js';

/** String key type for use in Record patterns */
export type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

export const ELEMENT_KEYS: readonly ElementKey[] = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const;

export function elementToKey(el: Element): ElementKey {
  return el.english as ElementKey;
}

export function keyToElement(key: ElementKey): Element {
  return Element.get(key);
}

export function elementFromSajuCode(value: string | null | undefined): ElementKey | null {
  switch (value) {
    case 'WOOD': return 'Wood';
    case 'FIRE': return 'Fire';
    case 'EARTH': return 'Earth';
    case 'METAL': return 'Metal';
    case 'WATER': return 'Water';
    case 'Wood': case 'Fire': case 'Earth': case 'Metal': case 'Water':
      return value as ElementKey;
    default: return null;
  }
}

/** Next element in generation (상생) cycle: Wood→Fire→Earth→Metal→Water→Wood */
export function generates(element: ElementKey): ElementKey {
  const idx = ELEMENT_KEYS.indexOf(element);
  return ELEMENT_KEYS[(idx + 1) % 5];
}

/** Element that generates this one */
export function generatedBy(element: ElementKey): ElementKey {
  const idx = ELEMENT_KEYS.indexOf(element);
  return ELEMENT_KEYS[(idx + 4) % 5]; // -1 mod 5
}

/** Element that this one controls (상극): Wood→Earth→Water→Fire→Metal→Wood */
export function controls(element: ElementKey): ElementKey {
  const idx = ELEMENT_KEYS.indexOf(element);
  return ELEMENT_KEYS[(idx + 2) % 5];
}

/** Element that controls this one */
export function controlledBy(element: ElementKey): ElementKey {
  const idx = ELEMENT_KEYS.indexOf(element);
  return ELEMENT_KEYS[(idx + 3) % 5]; // -2 mod 5
}

export function isSangSaeng(first: ElementKey, second: ElementKey): boolean {
  return generates(first) === second;
}

export function isSangGeuk(first: ElementKey, second: ElementKey): boolean {
  return controls(first) === second || controls(second) === first;
}

export function elementCount(distribution: Record<ElementKey, number>, element: ElementKey | null): number {
  if (!element) return 0;
  return distribution[element] ?? 0;
}

export function totalCount(distribution: Record<ElementKey, number>): number {
  return ELEMENT_KEYS.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
}

export function weightedElementAverage(
  distribution: Record<ElementKey, number>,
  selector: (element: ElementKey) => number,
): number {
  const total = totalCount(distribution);
  if (total <= 0) return 0;
  let weighted = 0;
  for (const element of ELEMENT_KEYS) {
    const count = distribution[element] ?? 0;
    if (count <= 0) continue;
    weighted += selector(element) * count;
  }
  return weighted / total;
}

export function normalizeSignedScore(value: number): number {
  return clamp((value + 1) * 50, 0, 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Create zero-initialized distribution */
export function emptyDistribution(): Record<ElementKey, number> {
  return { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
}

/** Build distribution from arrangement array */
export function distributionFromArrangement(arrangement: readonly ElementKey[]): Record<ElementKey, number> {
  const dist = emptyDistribution();
  for (const el of arrangement) {
    dist[el] = (dist[el] ?? 0) + 1;
  }
  return dist;
}
