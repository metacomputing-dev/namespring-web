/**
 * interpretation.ts -- Score-to-text interpretation utilities.
 * Pure functions, no side-effects.
 */
import type { EvaluationResult, FrameInsight } from '../calculator/base.js';

// ── Constants ───────────────────────────────────────────────

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
  [0,  '개선 여지가 있는 이름입니다.'],
];

export const SUB_HINTS: readonly [string, number, string, number, string][] = [
  ['hangul',    80, '음령오행(발음) 조화가 뛰어납니다.',  50, '음령오행의 음양 균형을 점검해 보세요.'],
  ['hanja',     80, '자원오행(한자) 배합이 우수합니다.',  50, '자원오행의 상생/상극 관계를 확인해 보세요.'],
  ['fourFrame', 80, '사격수리 배치가 길합니다.',          50, '사격수리에서 흉수가 포함되어 있습니다.'],
];

// ── Interpretation functions ────────────────────────────────

/** Full interpretation from EvaluationResult (used by SeedEngine). */
export function buildInterpretation(ev: EvaluationResult): string {
  const { score, isPassed, categories } = ev;
  const overall = isPassed
    ? (score >= 80 ? '종합적으로 매우 우수한 이름입니다.'
      : score >= 65 ? '종합적으로 좋은 이름입니다.'
      : '합격 기준을 충족하는 이름입니다.')
    : (score >= 55 ? '보통 수준의 이름입니다.' : '개선 여지가 있는 이름입니다.');
  const warns = categories
    .filter((c: FrameInsight) => c.frame !== 'SEONGMYEONGHAK' && !c.isPassed && c.score < 50)
    .map((c: FrameInsight) => `${FRAME_LABELS[c.frame] ?? c.frame} 부분을 점검해 보세요.`);
  return [overall, ...warns].join(' ');
}

/** Simple interpretation from sub-scores (used by SeedTs backward-compat). */
export function interpretScores(scores: Record<string, number>): string {
  const parts = [TOTAL_BANDS.find(([min]) => scores.total >= min)![1]];
  for (const [key, hi, good, lo, warn] of SUB_HINTS) {
    if (scores[key] >= hi) parts.push(good);
    else if (scores[key] < lo) parts.push(warn);
  }
  return parts.join(' ');
}
