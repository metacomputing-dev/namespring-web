import { HangulCalculator } from './calculator/hangul.js';
import { HanjaCalculator } from './calculator/hanja.js';
import { FrameCalculator } from './calculator/frame.js';
import { SajuCalculator } from './calculator/saju.js';
import { evaluateName } from './calculator/root.js';
import type { EvalContext } from './calculator/base.js';
import { emptyDistribution } from './calculator/element-cycle.js';
import { SeedEngine } from './engine.js';
import { interpretScores } from './utils/interpretation.js';
import type { UserInfo, NamingResult, SeedResult, SeedRequest, SeedResponse } from './types.js';

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
      interpretation: interpretScores({ total, hangul: hangulScore, hanja: hanjaScore, fourFrame: fourFrameScore }),
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
