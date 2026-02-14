import { CHOSUNG_LIST, JUNGSUNG_LIST, YANG_VOWELS } from "./constants.js";

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG_DIVIDER = 21 * 28;
const JUNGSUNG_DIVIDER = 28;

function hangulOffset(char: string): number {
  const code = char.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_END) {
    return -1;
  }
  return code - HANGUL_BASE;
}

export function extractChosung(char: string): string {
  if (!char) {
    return "";
  }
  if (CHOSUNG_LIST.includes(char as (typeof CHOSUNG_LIST)[number])) {
    return char;
  }
  const offset = hangulOffset(char);
  if (offset < 0) {
    return "";
  }
  return CHOSUNG_LIST[Math.floor(offset / CHOSUNG_DIVIDER)] ?? "";
}

export function extractJungsung(char: string): string {
  if (!char) {
    return "";
  }
  const offset = hangulOffset(char);
  if (offset < 0) {
    return "";
  }
  return JUNGSUNG_LIST[Math.floor((offset % CHOSUNG_DIVIDER) / JUNGSUNG_DIVIDER)] ?? "";
}

export function isYangVowel(char: string): boolean {
  const jung = extractJungsung(char);
  return YANG_VOWELS.has(jung);
}

export function splitChars(value: string): string[] {
  return Array.from(value ?? "");
}

