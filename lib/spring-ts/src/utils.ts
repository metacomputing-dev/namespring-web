/**
 * utils.ts -- Hangul decomposition and utility functions for spring-ts.
 *
 * Ported from name-ts/utils/index.ts for standalone use.
 */

import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';

// ---------------------------------------------------------------------------
// Korean phonetic constants
// ---------------------------------------------------------------------------

export const CHOSEONG: readonly string[] = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

export const JUNGSEONG: readonly string[] = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

const HANGUL_BLOCK_START = 0xAC00;
const HANGUL_BLOCK_END   = 0xD7A3;
const SYLLABLES_PER_ONSET   = 588;
const SYLLABLES_PER_NUCLEUS = 28;

// Unicode ranges for Hangul Compatibility Jamo block
const JAMO_CONSONANT_START = 0x3131;
const JAMO_CONSONANT_END   = 0x314E;
const JAMO_VOWEL_START     = 0x314F;
const JAMO_VOWEL_END       = 0x3163;

// ---------------------------------------------------------------------------
// Hangul decomposition
// ---------------------------------------------------------------------------

export function decomposeHangul(char: string): { onset: string; nucleus: string } | null {
  const charCode = char.charCodeAt(0);
  const offset = charCode - HANGUL_BLOCK_START;

  if (offset < 0 || charCode > HANGUL_BLOCK_END) return null;

  const onset   = CHOSEONG[Math.floor(offset / SYLLABLES_PER_ONSET)]   ?? 'ㅇ';
  const nucleus = JUNGSEONG[Math.floor((offset % SYLLABLES_PER_ONSET) / SYLLABLES_PER_NUCLEUS)] ?? 'ㅏ';

  return { onset, nucleus };
}

// ---------------------------------------------------------------------------
// Jamo filter parsing
// ---------------------------------------------------------------------------

export interface JamoFilter { readonly onset?: string; readonly nucleus?: string }

export function parseJamoFilter(char: string): JamoFilter | null {
  if (!char) return {};

  const charCode = char.charCodeAt(0);

  // Case 1: Hangul Compatibility Jamo -- consonant range
  if (charCode >= JAMO_CONSONANT_START && charCode <= JAMO_CONSONANT_END) {
    return CHOSEONG.includes(char) ? { onset: char } : {};
  }

  // Case 2: Hangul Compatibility Jamo -- vowel range
  if (charCode >= JAMO_VOWEL_START && charCode <= JAMO_VOWEL_END) {
    return { nucleus: char };
  }

  // Case 3: Full Hangul syllable with no coda
  const syllableOffset = charCode - HANGUL_BLOCK_START;
  const isHangulSyllable = syllableOffset >= 0 && charCode <= HANGUL_BLOCK_END;
  const hasNoCoda = syllableOffset % SYLLABLES_PER_NUCLEUS === 0;

  if (isHangulSyllable && hasNoCoda) {
    const onset   = CHOSEONG[Math.floor(syllableOffset / SYLLABLES_PER_ONSET)];
    const nucleus = JUNGSEONG[Math.floor((syllableOffset % SYLLABLES_PER_ONSET) / SYLLABLES_PER_NUCLEUS)];
    return { onset, nucleus };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fallback HanjaEntry construction
// ---------------------------------------------------------------------------

export function makeFallbackEntry(hangul: string): HanjaEntry {
  const decomposed = decomposeHangul(hangul);
  return {
    id: 0,
    hangul,
    hanja: hangul,
    onset: decomposed?.onset ?? 'ㅇ',
    nucleus: decomposed?.nucleus ?? 'ㅏ',
    strokes: 1,
    stroke_element: 'Wood',
    resource_element: 'Earth',
    meaning: '',
    radical: '',
    is_surname: false,
  };
}

// ---------------------------------------------------------------------------
// Interpretation builder
// ---------------------------------------------------------------------------

export function buildInterpretation(scores: {
  total: number;
  hangul: number;
  hanja: number;
  fourFrame: number;
  saju?: number;
}): string {
  const { total, hangul, hanja, fourFrame, saju } = scores;

  let overall: string;
  if (total >= 85) overall = '매우 우수한 이름입니다.';
  else if (total >= 70) overall = '좋은 이름입니다.';
  else if (total >= 55) overall = '무난한 이름입니다.';
  else overall = '개선의 여지가 있는 이름입니다.';

  const warnings: string[] = [];
  if (hangul < 40) warnings.push('발음 오행의 조화가 부족합니다.');
  if (hanja < 40) warnings.push('한자 자원 오행의 균형이 필요합니다.');
  if (fourFrame < 40) warnings.push('사격 수리의 길흉이 좋지 않습니다.');
  if (saju != null && saju < 40) warnings.push('사주와의 궁합이 부족합니다.');

  return [overall, ...warnings].join(' ');
}
