import type { HanjaEntry } from '../database/hanja-repository.js';
import type { EvaluationResult } from '../calculator/evaluator.js';

export const CHOSEONG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
] as const;

export const JUNGSEONG = [
  'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ',
  'ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ',
] as const;

const HANGUL_BASE = 0xAC00;

export function decomposeHangul(char: string): { onset: string; nucleus: string } | null {
  const code = char.charCodeAt(0) - HANGUL_BASE;
  if (code < 0 || code > 0xD7A3 - HANGUL_BASE) return null;
  const onset = CHOSEONG[Math.floor(code / 588)] ?? 'ㅇ';
  const nucleus = JUNGSEONG[Math.floor((code % 588) / 28)] ?? 'ㅏ';
  return { onset, nucleus };
}

export interface JamoFilter { readonly onset?: string; readonly nucleus?: string }

export function parseJamoFilter(char: string): JamoFilter | null {
  if (!char) return {};
  const code = char.charCodeAt(0);
  if (code >= 0x3131 && code <= 0x314E)
    return (CHOSEONG as readonly string[]).includes(char) ? { onset: char } : {};
  if (code >= 0x314F && code <= 0x3163) return { nucleus: char };
  const sc = code - HANGUL_BASE;
  if (sc >= 0 && sc <= 0xD7A3 - HANGUL_BASE && sc % 28 === 0)
    return { onset: CHOSEONG[Math.floor(sc / 588)], nucleus: JUNGSEONG[Math.floor((sc % 588) / 28)] };
  return null;
}

export function makeFallbackEntry(hangul: string): HanjaEntry {
  const d = decomposeHangul(hangul);
  return {
    id: 0,
    hangul,
    hanja: hangul,
    onset: d?.onset ?? 'ㅇ',
    nucleus: d?.nucleus ?? 'ㅏ',
    strokes: 1,
    stroke_element: 'Wood',
    resource_element: 'Earth',
    meaning: '',
    radical: '',
    is_surname: false,
  };
}

export const FRAME_LABELS: Readonly<Record<string, string>> = {
  FOURFRAME_LUCK: '사격수리(81수리)',
  SAJU_ELEMENT_BALANCE: '사주 자원 균형',
  STROKE_POLARITY: '획수 음양',
  HANGUL_ELEMENT: '발음 오행',
  HANGUL_POLARITY: '발음 음양',
  FOURFRAME_ELEMENT: '사격 오행',
};

export function buildInterpretation(ev: EvaluationResult): string {
  const { score, isPassed, categories } = ev;
  const overall = isPassed
    ? (score >= 80 ? '종합적으로 매우 우수한 이름입니다.' : score >= 65 ? '종합적으로 좋은 이름입니다.' : '합격 기준을 충족하는 이름입니다.')
    : (score >= 55 ? '보통 수준의 이름입니다.' : '개선 여지가 있는 이름입니다.');
  const warns = categories
    .filter((c) => c.frame !== 'TOTAL' && !c.isPassed && c.score < 50)
    .map((c) => `${FRAME_LABELS[c.frame] ?? c.frame} 부분을 점검해 보세요.`);
  return [overall, ...warns].join(' ');
}
