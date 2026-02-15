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

export function isHangulSyllable(char: string): boolean {
  const c = char.charCodeAt(0);
  return c >= HANGUL_BASE && c <= HANGUL_END;
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

export const TOTAL_BANDS: readonly [number, string][] = [
  [85, '종합적으로 매우 우수한 이름입니다.'],
  [70, '종합적으로 좋은 이름입니다.'],
  [55, '보통 수준의 이름입니다.'],
  [0, '개선 여지가 있는 이름입니다.'],
];

export const SUB_HINTS: readonly [string, number, string, number, string][] = [
  ['hangul', 80, '음양오행(발음) 조화가 뛰어납니다.', 50, '음양오행의 음양 균형을 점검해 보세요.'],
  ['hanja', 80, '자원오행(한자) 배합이 우수합니다.', 50, '자원오행의 상생/상극 관계를 확인해 보세요.'],
  ['fourFrame', 80, '사격수리 배치가 길합니다.', 50, '사격수리에서 흉수가 포함되어 있습니다.'],
];

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

export function interpretScores(scores: Record<string, number>): string {
  const parts = [TOTAL_BANDS.find(([min]) => scores.total >= min)![1]];
  for (const [key, hi, good, lo, warn] of SUB_HINTS) {
    if (scores[key] >= hi) parts.push(good);
    else if (scores[key] < lo) parts.push(warn);
  }
  return parts.join(' ');
}
