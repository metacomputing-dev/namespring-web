/**
 * korean-char.ts -- Hangul syllable decomposition utilities.
 * Pure functions, no side-effects.
 */
import type { HanjaEntry } from '../database/hanja-repository.js';

// ── Hangul Jamo tables ──────────────────────────────────────

export const CHOSEONG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
] as const;

export const JUNGSEONG = [
  'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ',
  'ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ',
] as const;

const HANGUL_BASE = 0xAC00;
const HANGUL_END = 0xD7A3;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

// ── Decomposition ───────────────────────────────────────────

export function isHangulSyllable(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_END;
}

export interface HangulDecomposition {
  readonly onset: string;
  readonly nucleus: string;
  readonly onsetIndex: number;
  readonly nucleusIndex: number;
}

export function decomposeHangul(char: string): HangulDecomposition | null {
  const code = char.charCodeAt(0) - HANGUL_BASE;
  if (code < 0 || code > HANGUL_END - HANGUL_BASE) return null;
  const onsetIndex = Math.floor(code / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
  const nucleusIndex = Math.floor((code % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT);
  return {
    onset: CHOSEONG[onsetIndex] ?? 'ㅇ',
    nucleus: JUNGSEONG[nucleusIndex] ?? 'ㅏ',
    onsetIndex,
    nucleusIndex,
  };
}

// ── Fallback entry ──────────────────────────────────────────

export function makeFallbackEntry(hangul: string): HanjaEntry {
  const d = decomposeHangul(hangul);
  return {
    id: 0, hangul, hanja: hangul,
    onset: d?.onset ?? 'ㅇ',
    nucleus: d?.nucleus ?? 'ㅏ',
    strokes: 1, stroke_element: 'Wood', resource_element: 'Earth',
    meaning: '', radical: '', is_surname: false,
  };
}
