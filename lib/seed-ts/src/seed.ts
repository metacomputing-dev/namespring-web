import { HangulCalculator } from './calculator/hangul.js';
import { HanjaCalculator } from './calculator/hanja.js';
import { FrameCalculator } from './calculator/frame.js';
import { SajuCalculator } from './calculator/saju.js';
import { evaluateName, type EvalContext } from './calculator/evaluator.js';
import { emptyDistribution } from './calculator/scoring.js';
import { buildInterpretation } from './utils/index.js';
import type { UserInfo, NamingResult, SeedResult } from './model/types.js';

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

    const result: NamingResult = {
      lastName,
      firstName,
      totalScore: Math.round(ev.score * 10) / 10,
      hangul: hangul as unknown,
      hanja: hanja as unknown,
      fourFrames: frame as unknown,
      interpretation: buildInterpretation(ev)
    };

    return { candidates: [result], totalCount: 1 };
  }
}
