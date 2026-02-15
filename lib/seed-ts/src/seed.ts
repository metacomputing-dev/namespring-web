import type { HanjaEntry } from './database/hanja-repository.js';
import { HangulCalculator } from './calculator/hangul.js';
import { HanjaCalculator } from './calculator/hanja.js';
import { FrameCalculator } from './calculator/frame.js';
import { SajuCalculator } from './calculator/saju.js';
import { evaluateName, type EvalContext } from './calculator/evaluator.js';
import { emptyDistribution } from './calculator/scoring.js';
import { buildInterpretation } from './utils/index.js';

export type Gender = 'male' | 'female';
export interface UserInfo {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly birthDateTime: { year: number; month: number; day: number; hour: number; minute: number };
  readonly gender: Gender;
}
export interface NamingResult {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly totalScore: number;
  readonly hangul: unknown;
  readonly hanja: unknown;
  readonly fourFrames: unknown;
  readonly interpretation: string;
}
export interface SeedResult {
  readonly candidates: NamingResult[];
  readonly totalCount: number;
}

export class SeedTs {
  analyze(userInfo: UserInfo): SeedResult {
    const { lastName, firstName } = userInfo;
    const hangul = new HangulCalculator(lastName, firstName);
    const hanja = new HanjaCalculator(lastName, firstName);
    const frame = new FrameCalculator(lastName, firstName);
    const saju = new SajuCalculator(lastName, firstName);
    const ctx: EvalContext = {
      surnameLength: lastName.length, givenLength: firstName.length,
      luckyMap: new Map(), sajuDistribution: emptyDistribution(), sajuOutput: null, insights: {},
    };
    const ev = evaluateName([hangul, hanja, frame, saju], ctx);
    return { candidates: [{
      lastName, firstName, totalScore: Math.round(ev.score * 10) / 10,
      hangul: hangul as unknown, hanja: hanja as unknown, fourFrames: frame as unknown,
      interpretation: buildInterpretation(ev),
    }], totalCount: 1 };
  }
}
