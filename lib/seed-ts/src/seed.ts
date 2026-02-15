import { HanjaRepository, type HanjaEntry } from './database/hanja-repository.js';
import { FourframeRepository } from './database/fourframe-repository.js';
import { FourFrameCalculator } from './calculator/frame-calculator.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import { SeedEngine } from './engine.js';
import type {
  UserInfo,
  NamingResult,
  SeedResult,
  SeedRequest,
  SeedResponse,
} from './types.js';

/**
 * SeedTs — Backward-compatible wrapper for the existing UI.
 *
 * The `analyze()` method maintains the synchronous contract expected by the UI.
 * Internally it uses the same calculators but with direct scoring.
 *
 * For the full async evaluator pipeline, use `analyzeAsync()` or SeedEngine directly.
 */
export class SeedTs {
  /**
   * Synchronous analysis for existing UI compatibility.
   * Uses calculators directly (no async DB calls for luck levels).
   */
  analyze(userInfo: UserInfo): SeedResult {
    const { lastName, firstName } = userInfo;

    const hangulCalc = new HangulCalculator(lastName, firstName);
    const hanjaCalc = new HanjaCalculator(lastName, firstName);
    const fourFrameCalc = new FourFrameCalculator(lastName, firstName);

    hangulCalc.calculate();
    hanjaCalc.calculate();
    fourFrameCalc.calculate();

    const hangulScore = hangulCalc.getScore();
    const hanjaScore = hanjaCalc.getScore();
    const fourFrameScore = fourFrameCalc.getScore();
    const totalScore = (hangulScore + hanjaScore + fourFrameScore) / 3;

    const interpretation = this.buildInterpretation(totalScore, hangulScore, hanjaScore, fourFrameScore);

    const result: NamingResult = {
      lastName,
      firstName,
      totalScore: Math.round(totalScore * 10) / 10,
      hanja: hanjaCalc,
      hangul: hangulCalc,
      fourFrames: fourFrameCalc,
      interpretation,
    };

    return {
      candidates: [result],
      totalCount: 1,
    };
  }

  /**
   * Async bridge to SeedEngine for the full evaluator pipeline.
   * Use this for proper saju integration and recommend/all modes.
   */
  async analyzeAsync(request: SeedRequest): Promise<SeedResponse> {
    const engine = new SeedEngine();
    try {
      return await engine.analyze(request);
    } finally {
      engine.close();
    }
  }

  private buildInterpretation(total: number, hangul: number, hanja: number, fourFrame: number): string {
    const parts: string[] = [];
    if (total >= 85) parts.push('종합적으로 매우 우수한 이름입니다.');
    else if (total >= 70) parts.push('종합적으로 좋은 이름입니다.');
    else if (total >= 55) parts.push('보통 수준의 이름입니다.');
    else parts.push('개선 여지가 있는 이름입니다.');

    if (hangul >= 80) parts.push('음령오행(발음) 조화가 뛰어납니다.');
    else if (hangul < 50) parts.push('음령오행의 음양 균형을 점검해 보세요.');

    if (hanja >= 80) parts.push('자원오행(한자) 배합이 우수합니다.');
    else if (hanja < 50) parts.push('자원오행의 상생/상극 관계를 확인해 보세요.');

    if (fourFrame >= 80) parts.push('사격수리 배치가 길합니다.');
    else if (fourFrame < 50) parts.push('사격수리에서 흉수가 포함되어 있습니다.');

    return parts.join(' ');
  }
}
