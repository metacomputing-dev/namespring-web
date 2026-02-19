import type { HanjaEntry } from '../database/hanja-repository';

export type NameElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const COMPATIBILITY_JAMO_START = 0x3131;
const COMPATIBILITY_JAMO_END = 0x3163;

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const;

const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ',
  'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ',
  'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const JAMO_STROKES: Readonly<Record<string, number>> = {
  'ㄱ': 2, 'ㄲ': 4, 'ㄳ': 4, 'ㄴ': 2, 'ㄵ': 5, 'ㄶ': 5, 'ㄷ': 3, 'ㄸ': 6, 'ㄹ': 5,
  'ㄺ': 7, 'ㄻ': 9, 'ㄼ': 9, 'ㄽ': 7, 'ㄾ': 9, 'ㄿ': 9, 'ㅀ': 8, 'ㅁ': 4, 'ㅂ': 4,
  'ㅃ': 8, 'ㅄ': 6, 'ㅅ': 2, 'ㅆ': 4, 'ㅇ': 1, 'ㅈ': 3, 'ㅉ': 6, 'ㅊ': 4, 'ㅋ': 3,
  'ㅌ': 4, 'ㅍ': 4, 'ㅎ': 3,
  'ㅏ': 2, 'ㅐ': 3, 'ㅑ': 3, 'ㅒ': 4, 'ㅓ': 2, 'ㅔ': 3, 'ㅕ': 3, 'ㅖ': 4, 'ㅗ': 2,
  'ㅘ': 4, 'ㅙ': 5, 'ㅚ': 3, 'ㅛ': 3, 'ㅜ': 2, 'ㅝ': 4, 'ㅞ': 5, 'ㅟ': 3, 'ㅠ': 3,
  'ㅡ': 1, 'ㅢ': 2, 'ㅣ': 1,
};

const ONSET_TO_ELEMENT: Readonly<Record<string, NameElementKey>> = {
  'ㄱ': 'Wood', 'ㄲ': 'Wood', 'ㅋ': 'Wood',
  'ㄴ': 'Fire', 'ㄷ': 'Fire', 'ㄸ': 'Fire', 'ㄹ': 'Fire', 'ㅌ': 'Fire',
  'ㅇ': 'Earth', 'ㅎ': 'Earth',
  'ㅅ': 'Metal', 'ㅆ': 'Metal', 'ㅈ': 'Metal', 'ㅉ': 'Metal', 'ㅊ': 'Metal',
  'ㅁ': 'Water', 'ㅂ': 'Water', 'ㅃ': 'Water', 'ㅍ': 'Water',
};

const DEFAULT_ONSET = 'ㅇ';
const DEFAULT_NUCLEUS = 'ㅏ';

export interface HangulSyllableParts {
  readonly onset: string;
  readonly nucleus: string;
  readonly coda: string;
}

export interface HangulPseudoEntryOptions {
  readonly hanja?: string;
  readonly meaning?: string;
  readonly radical?: string;
  readonly id?: number;
  readonly isSurname?: boolean;
}

function firstChar(value: string): string {
  const chars = Array.from(String(value ?? ''));
  return chars[0] ?? '';
}

function strokeCountOf(jamo: string): number {
  return JAMO_STROKES[jamo] ?? 1;
}

export function decomposeHangulSyllable(char: string): HangulSyllableParts | null {
  const syllable = firstChar(char);
  if (!syllable) return null;

  const codePoint = syllable.codePointAt(0);
  if (!codePoint) return null;

  if (codePoint >= HANGUL_SYLLABLE_START && codePoint <= HANGUL_SYLLABLE_END) {
    const offset = codePoint - HANGUL_SYLLABLE_START;
    const onsetIndex = Math.floor(offset / 588);
    const nucleusIndex = Math.floor((offset % 588) / 28);
    const codaIndex = offset % 28;

    return {
      onset: CHOSEONG[onsetIndex] ?? DEFAULT_ONSET,
      nucleus: JUNGSEONG[nucleusIndex] ?? DEFAULT_NUCLEUS,
      coda: JONGSEONG[codaIndex] ?? '',
    };
  }

  if (codePoint >= COMPATIBILITY_JAMO_START && codePoint <= COMPATIBILITY_JAMO_END) {
    if (CHOSEONG.includes(syllable as (typeof CHOSEONG)[number])) {
      return { onset: syllable, nucleus: DEFAULT_NUCLEUS, coda: '' };
    }
    if (JUNGSEONG.includes(syllable as (typeof JUNGSEONG)[number])) {
      return { onset: DEFAULT_ONSET, nucleus: syllable, coda: '' };
    }
  }

  return null;
}

export function hangulElementFromSyllable(char: string): NameElementKey {
  const parts = decomposeHangulSyllable(char);
  if (!parts) return 'Water';
  return ONSET_TO_ELEMENT[parts.onset] ?? 'Water';
}

export function hangulStrokeCount(char: string): number {
  const parts = decomposeHangulSyllable(char);
  if (!parts) return 1;
  return Math.max(
    1,
    strokeCountOf(parts.onset) + strokeCountOf(parts.nucleus) + strokeCountOf(parts.coda),
  );
}

export function strokeElementFromStrokeCount(strokes: number): NameElementKey {
  const digit = ((strokes % 10) + 10) % 10;
  if (digit === 1 || digit === 2) return 'Wood';
  if (digit === 3 || digit === 4) return 'Fire';
  if (digit === 5 || digit === 6) return 'Earth';
  if (digit === 7 || digit === 8) return 'Metal';
  return 'Water';
}

export function buildHangulPseudoEntry(
  hangulInput: string,
  options: HangulPseudoEntryOptions = {},
): HanjaEntry {
  const hangul = firstChar(hangulInput) || String(hangulInput ?? '');
  const parts = decomposeHangulSyllable(hangul);
  const strokes = hangulStrokeCount(hangul);

  return {
    id: options.id ?? 0,
    hangul,
    hanja: options.hanja ?? hangul,
    onset: parts?.onset ?? DEFAULT_ONSET,
    nucleus: parts?.nucleus ?? DEFAULT_NUCLEUS,
    strokes,
    stroke_element: strokeElementFromStrokeCount(strokes),
    resource_element: hangulElementFromSyllable(hangul),
    meaning: options.meaning ?? '',
    radical: options.radical ?? '',
    is_surname: options.isSurname ?? false,
  };
}

export function toHangulOnlyEntry(
  entry: HanjaEntry,
  options: { readonly hanja?: string } = {},
): HanjaEntry {
  return buildHangulPseudoEntry(entry.hangul, {
    hanja: options.hanja ?? '',
    meaning: entry.meaning,
    radical: entry.radical,
    id: entry.id,
    isSurname: entry.is_surname,
  });
}
