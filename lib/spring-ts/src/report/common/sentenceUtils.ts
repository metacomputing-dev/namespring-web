/**
 * sentenceUtils.ts -- Sentence generation utilities
 *
 * Core utilities that ensure natural sentence variety in reports.
 * Even with the same saju data, each report uses slightly different
 * phrasing to feel human-written rather than mechanical.
 */

import type { ReportParagraph, ElementCode } from '../types.js';

// ---------------------------------------------------------------------------
//  1. Seeded pseudo-random number generator
// ---------------------------------------------------------------------------

/**
 * Deterministic PRNG (Mulberry32).
 * Given the same seed, produces the same sequence of results.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick a random element using optional weight property */
  pickWeighted<T extends { weight?: number }>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    const totalWeight = arr.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = this.next() * totalWeight;
    for (const item of arr) {
      roll -= (item.weight ?? 1);
      if (roll <= 0) return item;
    }
    return arr[arr.length - 1];
  }

  /** Fisher-Yates shuffle (returns a new array) */
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** Sample n unique elements from an array */
  sample<T>(arr: readonly T[], n: number): T[] {
    const shuffled = this.shuffle([...arr]);
    return shuffled.slice(0, Math.min(n, arr.length));
  }

  /** Random integer in [min, max] (inclusive) */
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ---------------------------------------------------------------------------
//  2. Template engine
// ---------------------------------------------------------------------------

/**
 * Replace {{variable}} placeholders in a template string.
 *
 * @example
 * fillTemplate('{{name}}님의 용신은 {{element}}입니다.', { name: '홍길동', element: '목' })
 * // => '홍길동님의 용신은 목입니다.'
 */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value != null ? String(value) : match;
  });
}

/**
 * Pick one template from an array at random and fill its variables.
 */
export function pickAndFill(
  rng: SeededRandom,
  templates: readonly string[],
  vars?: Record<string, string | number>,
): string {
  if (templates.length === 0) return '';
  const selected = rng.pick(templates);
  return vars ? fillTemplate(selected, vars) : selected;
}

// ---------------------------------------------------------------------------
//  3. Korean particle (josa) handling
// ---------------------------------------------------------------------------

/**
 * Check whether the last character of a string has a final consonant (batchim).
 */
function hasFinalConsonant(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
}

/**
 * Choose the correct particle based on whether the preceding word
 * has a final consonant.
 *
 * @example
 * particle('목', '이', '가') // => '이'  (has batchim)
 * particle('화', '이', '가') // => '가'  (no batchim)
 */
export function particle(word: string, withFinal: string, withoutFinal: string): string {
  if (!word || word.length === 0) return withoutFinal;
  const lastChar = word[word.length - 1];
  return hasFinalConsonant(lastChar) ? withFinal : withoutFinal;
}

/**
 * Append the appropriate particle to a word.
 *
 * @example
 * withParticle('목', '은/는') // => '목은'
 * withParticle('화', '은/는') // => '화는'
 */
export function withParticle(word: string, particlePair: string): string {
  const [withF, withoutF] = particlePair.split('/');
  if (!withF || !withoutF) return word + particlePair;
  return word + particle(word, withF, withoutF);
}

// Convenience particle functions
export function eunNeun(word: string): string { return withParticle(word, '은/는'); }
export function iGa(word: string): string { return withParticle(word, '이/가'); }
export function eulReul(word: string): string { return withParticle(word, '을/를'); }
export function gwaWa(word: string): string { return withParticle(word, '과/와'); }
export function euroRo(word: string): string {
  if (!word || word.length === 0) return word + '로';
  const lastChar = word[word.length - 1];
  const code = lastChar.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return word + '로';
  const jongseong = (code - 0xAC00) % 28;
  // ㄹ batchim (index 8) or no batchim => '로', otherwise => '으로'
  if (jongseong === 0 || jongseong === 8) return word + '로';
  return word + '으로';
}

// ---------------------------------------------------------------------------
//  4. Report paragraph factory helpers
// ---------------------------------------------------------------------------

/** Create a narrative paragraph */
export function narrative(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'narrative', text, element, tone: 'neutral' };
}

/** Create a positive-tone paragraph */
export function positive(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'narrative', text, element, tone: 'positive' };
}

/** Create an encouraging-tone paragraph */
export function encouraging(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'narrative', text, element, tone: 'encouraging' };
}

/** Create a caution/warning paragraph */
export function caution(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'warning', text, element, tone: 'negative' };
}

/** Create a tip/advice paragraph */
export function tip(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'tip', text, element, tone: 'neutral' };
}

/** Create an emphasis paragraph */
export function emphasis(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'emphasis', text, element, tone: 'neutral' };
}

// ---------------------------------------------------------------------------
//  5. Sentence joining utilities
// ---------------------------------------------------------------------------

/** Join multiple sentences into a single paragraph, skipping nulls/blanks */
export function joinSentences(...sentences: (string | null | undefined)[]): string {
  return sentences.filter(s => s != null && s.trim().length > 0).join(' ');
}

/** Join items as a list with a conjunction (A, B, C 그리고 D) */
export function listJoin(items: string[], conjunction: string = '그리고'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  const last = items[items.length - 1];
  const rest = items.slice(0, -1);
  return `${rest.join(', ')} ${conjunction} ${last}`;
}

/** Format a value as a percentage string */
export function pct(value: number, digits: number = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Format a numeric value as "N점" */
export function scoreText(value: number): string {
  return `${Math.round(value)}점`;
}
