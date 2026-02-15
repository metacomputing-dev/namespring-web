import { SeedEngine } from './calculator/engine.js';
import { HangulCalculator } from './calculator/hangul.js';
import { HanjaCalculator } from './calculator/hanja.js';
import { FrameCalculator } from './calculator/frame.js';
import { SajuCalculator } from './calculator/saju.js';
import { evaluateName, type EvalContext } from './calculator/evaluator.js';
import { emptyDistribution } from './calculator/scoring.js';
import { interpretScores } from './utils/index.js';
import type { SeedRequest, SeedResponse, UserInfo, NamingResult, SeedResult } from './model/types.js';

export class SeedTs {
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
      insights: {}
    };

    const ev = evaluateName([hangul, hanja, frame, saju], ctx);
    const cm = ev.categoryMap;

    const hangulScore = ((cm.BALEUM_OHAENG?.score ?? 0) + (cm.BALEUM_EUMYANG?.score ?? 0)) / 2;
    const hanjaScore = ((cm.HOEKSU_EUMYANG?.score ?? 0) + (cm.SAGYEOK_OHAENG?.score ?? 0)) / 2;
    const fourFrameScore = cm.SAGYEOK_SURI?.score ?? 0;

    const result: NamingResult = {
      lastName,
      firstName,
      totalScore: Math.round(ev.score * 10) / 10,
      hangul: hangul as unknown,
      hanja: hanja as unknown,
      fourFrames: frame as unknown,
      interpretation: interpretScores({
        total: ev.score,
        hangul: hangulScore,
        hanja: hanjaScore,
        fourFrame: fourFrameScore
      })
    };

    return { candidates: [result], totalCount: 1 };
  }

  async analyzeAsync(request: SeedRequest): Promise<SeedResponse> {
    const engine = new SeedEngine();
    try {
      return await engine.analyze(request);
    } finally {
      engine.close();
    }
  }
}
