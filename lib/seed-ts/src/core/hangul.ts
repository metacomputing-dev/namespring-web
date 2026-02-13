import { CHOSUNG_LIST, JUNGSUNG_LIST, YANG_VOWELS } from "./constants.js";

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG_DIVIDER = 21 * 28;
const JUNGSUNG_DIVIDER = 28;

export function extractChosung(char: string): string {
  if (!char) {
    return "";
  }
  if (CHOSUNG_LIST.includes(char as (typeof CHOSUNG_LIST)[number])) {
    return char;
  }
  const code = char.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_END) {
    return "";
  }
  const idx = Math.floor((code - HANGUL_BASE) / CHOSUNG_DIVIDER);
  return CHOSUNG_LIST[idx] ?? "";
}

export function extractJungsung(char: string): string {
  if (!char) {
    return "";
  }
  const code = char.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_END) {
    return "";
  }
  const idx = Math.floor(((code - HANGUL_BASE) % CHOSUNG_DIVIDER) / JUNGSUNG_DIVIDER);
  return JUNGSUNG_LIST[idx] ?? "";
}

export function isYangVowel(char: string): boolean {
  const jung = extractJungsung(char);
  return YANG_VOWELS.has(jung);
}

export function splitChars(value: string): string[] {
  return Array.from(value ?? "");
}

