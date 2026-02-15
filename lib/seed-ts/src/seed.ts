import { HangulCalculator } from './calculator/hangul.js';
import { HanjaCalculator } from './calculator/hanja.js';
import { FrameCalculator } from './calculator/frame.js';
import { SajuCalculator } from './calculator/saju.js';
import { evaluateName } from './calculator/root.js';
import type { EvalContext } from './calculator/base.js';
import { emptyDistribution } from './calculator/element-cycle.js';
import { SeedEngine } from './engine.js';
import type { UserInfo, NamingResult, SeedResult, SeedRequest, SeedResponse } from './types.js';

/** Score-to-interpretation thresholds (descending). */
const TOTAL_BANDS: [number, string][] = [
  [85, '종합적으로 매우 우수한 이름입니다.'],
  [70, '종합적으로 좋은 이름입니다.'],
  [55, '보통 수준의 이름입니다.'],
  [0,  '개선 여지가 있는 이름입니다.'],
];

const SUB_HINTS: [string, number, string, number, string][] = [
  ['hangul',    80, '음령오행(발음) 조화가 뛰어납니다.',           50, '음령오행의 음양 균형을 점검해 보세요.'],
  ['hanja',     80, '자원오행(한자) 배합이 우수합니다.',           50, '자원오행의 상생/상극 관계를 확인해 보세요.'],
  ['fourFrame', 80, '사격수리 배치가 길합니다.',                   50, '사격수리에서 흉수가 포함되어 있습니다.'],
];

function interpret(scores: Record<string, number>): string {
  const parts = [TOTAL_BANDS.find(([min]) => scores.total >= min)![1]];
  for (const [key, hi, good, lo, warn] of SUB_HINTS) {
    if (scores[key] >= hi) parts.push(good);
    else if (scores[key] < lo) parts.push(warn);
  }
  return parts.join(' ');
}

/**
 * SeedTs -- Backward-compatible wrapper for the existing UI.
 *
 * - analyze()      : synchronous, uses the DAG evaluation pipeline with
 *                    a minimal EvalContext (no luckyMap, no saju output).
 * - analyzeAsync() : async bridge to the full SeedEngine evaluator pipeline.
 */
export class SeedTs {
  /** Synchronous analysis for existing UI compatibility. */
  analyze(userInfo: UserInfo): SeedResult {
    const { lastName, firstName } = userInfo;

    const hangul = new HangulCalculator(lastName, firstName);
    const hanja = new HanjaCalculator(lastName, firstName);
    const frame = new FrameCalculator(lastName, firstName);
    const saju = new SajuCalculator(lastName, firstName);

    const ctx: EvalContext = {
      surnameLength: lastName.length,
      givenLength: firstName.length,
      luckyMap: new Map(),
      sajuDistribution: emptyDistribution(),
      sajuOutput: null,
      insights: {},
    };

    const ev = evaluateName([hangul, hanja, frame, saju], ctx);
    const cm = ev.categoryMap;

    const hangulScore = ((cm.BALEUM_OHAENG?.score ?? 0) + (cm.BALEUM_EUMYANG?.score ?? 0)) / 2;
    const hanjaScore = ((cm.HOEKSU_EUMYANG?.score ?? 0) + (cm.SAGYEOK_OHAENG?.score ?? 0)) / 2;
    const fourFrameScore = cm.SAGYEOK_SURI?.score ?? 0;
    const total = ev.score;

    const result: NamingResult = {
      lastName,
      firstName,
      totalScore: Math.round(total * 10) / 10,
      hangul: hangul as unknown,
      hanja: hanja as unknown,
      fourFrames: frame as unknown,
      interpretation: interpret({ total, hangul: hangulScore, hanja: hanjaScore, fourFrame: fourFrameScore }),
    };

    return { candidates: [result], totalCount: 1 };
  }

  /** Async bridge to SeedEngine for the full evaluator pipeline. */
  async analyzeAsync(request: SeedRequest): Promise<SeedResponse> {
    const engine = new SeedEngine();
    try { return await engine.analyze(request); }
    finally { engine.close(); }
  }
}
