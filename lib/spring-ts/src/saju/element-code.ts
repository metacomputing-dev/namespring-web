import cheonganJijiConfig from '../../config/cheongan-jiji.json';
import type { ElementKey } from '../core/scoring.js';

/** Maps uppercase saju element codes to Spring's display/scoring keys. */
const ELEMENT_CODE_TO_KEY: Readonly<Record<string, ElementKey>> =
  cheonganJijiConfig.elementCodeToKey as Record<string, ElementKey>;

/** Canonical five-element order supplied by the shared boundary config. */
export const ELEMENT_CODES: readonly string[] = cheonganJijiConfig.elementCodes;

/**
 * Exact legacy/display aliases accepted at the saju boundary.
 *
 * Do not infer elements from arbitrary surrounding text here. Korean element
 * syllables (especially 수, 화, 금) are common in unrelated words, so substring
 * matching silently turns malformed values into valid-looking engine facts.
 */
const ELEMENT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  WOOD: 'WOOD',
  '목': 'WOOD',
  '木': 'WOOD',
  '목(木)': 'WOOD',
  '목(WOOD)': 'WOOD',

  FIRE: 'FIRE',
  '화': 'FIRE',
  '火': 'FIRE',
  '화(火)': 'FIRE',
  '화(FIRE)': 'FIRE',

  EARTH: 'EARTH',
  '토': 'EARTH',
  '土': 'EARTH',
  '토(土)': 'EARTH',
  '토(EARTH)': 'EARTH',

  METAL: 'METAL',
  '금': 'METAL',
  '金': 'METAL',
  '금(金)': 'METAL',
  '금(METAL)': 'METAL',

  WATER: 'WATER',
  '수': 'WATER',
  '水': 'WATER',
  '수(水)': 'WATER',
  '수(WATER)': 'WATER',
});

/** Normalize a legacy code, English label, or Korean element label. */
export function normalizeElementCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  // Case-fold English labels/codes and normalize spacing only around the
  // parentheses of explicitly supported display forms. Embedded whitespace
  // remains invalid instead of being collapsed into a different valid token.
  const displayToken = raw.replace(/\s*([()])\s*/g, '$1');
  if (/\s/.test(displayToken)) return null;
  const normalized = displayToken.toUpperCase();
  const code = ELEMENT_ALIASES[normalized];
  return code && ELEMENT_CODES.includes(code) ? code : null;
}

/** Convert a saju element value into Spring's canonical element key. */
export function elementFromSajuCode(value: string | null | undefined): ElementKey | null {
  const code = normalizeElementCode(value);
  return code ? (ELEMENT_CODE_TO_KEY[code] ?? null) : null;
}

export function normalizeElementCodeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const dedup = new Set<string>();
  for (const item of value) {
    const code = normalizeElementCode(item);
    if (code) dedup.add(code);
  }
  return [...dedup];
}

/** Collect unique Spring element keys from mixed scalar/array inputs. */
export function collectElements(...sources: (string | null | undefined | string[])[]): Set<string> {
  const result = new Set<string>();
  for (const source of sources) {
    for (const item of (Array.isArray(source) ? source : source ? [source] : [])) {
      const elementKey = elementFromSajuCode(item);
      if (elementKey) result.add(elementKey);
    }
  }
  return result;
}
