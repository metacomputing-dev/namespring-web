import type { UserInfo, SeedResult, NamingResult, SeedRequest, SeedResponse } from './types.js';
import { FourFrameCalculator } from './calculator/frame-calculator.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import { SeedEngine } from './engine.js';

/**
 * Backward-compatible wrapper for the naming analysis engine.
 * Maintains the existing UI contract (`@seed/seed` → `SeedTs`).
 */
export class SeedTs {
  private engine: SeedEngine | null = null;

  /**
   * Synchronous analysis using existing UI contract.
   * Coordinates multiple calculators to generate naming results.
   */
  public analyze(userInfo: UserInfo): SeedResult {
    const { lastName, firstName } = userInfo;

    const fourFrames = new FourFrameCalculator(lastName, firstName);
    const hangul = new HangulCalculator(lastName, firstName);
    const hanja = new HanjaCalculator(lastName, firstName);

    fourFrames.calculate();
    hangul.calculate();
    hanja.calculate();

    const totalScore = (fourFrames.getScore() + hangul.getScore() + hanja.getScore()) / 3;

    const mainCandidate: NamingResult = {
      lastName,
      firstName,
      totalScore,
      fourFrames,
      hangul,
      hanja,
      interpretation: this.buildInterpretation(totalScore),
    };

    return {
      candidates: [mainCandidate],
      totalCount: 1,
    };
  }

  /**
   * Async bridge to the new SeedEngine API.
   * Use this for full saju-integrated analysis with recommend/search capabilities.
   */
  public async analyzeAsync(request: SeedRequest): Promise<SeedResponse> {
    if (!this.engine) {
      this.engine = new SeedEngine();
    }
    return this.engine.analyze(request);
  }

  private buildInterpretation(totalScore: number): string {
    if (totalScore >= 90) return '매우 우수한 이름입니다. 음양오행의 조화가 뛰어납니다.';
    if (totalScore >= 75) return '좋은 이름입니다. 전반적인 에너지 균형이 양호합니다.';
    if (totalScore >= 60) return '보통 수준의 이름입니다. 일부 개선 여지가 있습니다.';
    if (totalScore >= 40) return '다소 아쉬운 이름입니다. 음양오행 조화를 점검해 보세요.';
    return '개선이 필요한 이름입니다. 다른 조합을 고려해 보세요.';
  }
}
