import type { HanjaEntry } from './database/hanja-repository.js';
import { HangulCalculator } from './calculator/hangul.js';
import { HanjaCalculator } from './calculator/hanja.js';
import { FrameCalculator } from './calculator/frame.js';
import { evaluateName, type EvalContext } from './calculator/evaluator.js';
import { buildInterpretation } from './utils/index.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female';

export interface UserInfo {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly birthDateTime: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  readonly gender: Gender;
}

export interface NamingResult {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly totalScore: number;
  /**
   * Typed as `unknown` because NamingResult is a public API surface consumed
   * by NamingReport and other UI adapters that each interpret calculator
   * output differently. The concrete types (HangulCalculator, etc.) are
   * intentionally erased here to keep consumers decoupled from calculator
   * internals.
   */
  readonly hangul: unknown;
  readonly hanja: unknown;
  readonly fourFrames: unknown;
  readonly interpretation: string;
}

export interface NameResult {
  readonly candidates: NamingResult[];
  readonly totalCount: number;
}

// ---------------------------------------------------------------------------
// Main facade
// ---------------------------------------------------------------------------

export class NameTs {
  analyze(userInfo: UserInfo): NameResult {
    const { lastName, firstName } = userInfo;

    // Build calculators
    const hangulCalculator = new HangulCalculator(lastName, firstName);
    const hanjaCalculator  = new HanjaCalculator(lastName, firstName);
    const frameCalculator  = new FrameCalculator(lastName, firstName);

    // Prepare evaluation context
    const evalContext: EvalContext = {
      surnameLength: lastName.length,
      givenLength: firstName.length,
      luckyMap: new Map(),
      insights: {},
    };

    // Evaluate across all calculators
    const evaluationResult = evaluateName(
      [hangulCalculator, hanjaCalculator, frameCalculator],
      evalContext,
    );

    // Assemble the single-candidate result.
    // The `as unknown` casts are required because NamingResult deliberately
    // declares hangul/hanja/fourFrames as `unknown` (see interface comment).
    const candidate: NamingResult = {
      lastName,
      firstName,
      totalScore: Math.round(evaluationResult.score * 10) / 10,
      hangul: hangulCalculator as unknown,
      hanja: hanjaCalculator as unknown,
      fourFrames: frameCalculator as unknown,
      interpretation: buildInterpretation(evaluationResult),
    };

    return { candidates: [candidate], totalCount: 1 };
  }
}
