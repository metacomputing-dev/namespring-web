import type { HanjaEntry } from '../database/hanja-repository.js';
import type { EvaluationResult, FrameInsight } from '../calculator/evaluator.js';

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
  const nucleusIndex = Math.floor(
    (code % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT,
  );
  return {
    onset: CHOSEONG[onsetIndex] ?? 'ㅇ',
    nucleus: JUNGSEONG[nucleusIndex] ?? 'ㅏ',
    onsetIndex,
    nucleusIndex,
  };
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
  SAGYEOK_SURI: '사격수리(81수리)',
  SAJU_JAWON_BALANCE: '사주 자원 균형',
  HOEKSU_EUMYANG: '획수 음양',
  BALEUM_OHAENG: '발음 오행',
  BALEUM_EUMYANG: '발음 음양',
  SAGYEOK_OHAENG: '사격 오행',
};

export function buildInterpretation(ev: EvaluationResult): string {
  const { score, isPassed, categories } = ev;
  let overall: string;
  if (isPassed) {
    overall = score >= 80 ? '종합적으로 매우 우수한 이름입니다.'
      : score >= 65 ? '종합적으로 좋은 이름입니다.'
      : '합격 기준을 충족하는 이름입니다.';
  } else {
    overall = score >= 55 ? '보통 수준의 이름입니다.' : '개선 여지가 있는 이름입니다.';
  }
  const warns = categories
    .filter((c: FrameInsight) => c.frame !== 'SEONGMYEONGHAK' && !c.isPassed && c.score < 50)
    .map((c: FrameInsight) => `${FRAME_LABELS[c.frame] ?? c.frame} 부분을 점검해 보세요.`);
  return [overall, ...warns].join(' ');
}
