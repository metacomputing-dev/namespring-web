/**
 * name-saju-reading.ts -- N1 name↔saju reinforcement (plain language)
 *
 * One grounded, plain-language sentence about how the person's NAME supports
 * their chart: does the name carry the element the chart most needs
 * (`yongshinMatchCount`)? This is the "내 이름이 내 운에 이렇게 작용하는구나"
 * moment — computed entirely from `SajuCompatibility`, no jargon, no overclaim.
 *
 * Strictly conditioned on the real value: when the name carries zero of the
 * needed element we say so honestly (never "채워 준다"). Kept to a single
 * sentence about TIMING benefit so it does not duplicate the naming card,
 * which scores the name itself (see PLAN_PERSONALIZATION_PLAIN §3 S3 guard).
 */

import type { TieredNameSajuReading } from '../types.js';

export interface NameSajuReadingInput {
  /** How many name characters carry the yongshin element (engine-computed). */
  readonly yongshinMatchCount: number | null | undefined;
  /** Plain element name of the yongshin (물/불/…), from the report slots. */
  readonly yongshinName: string;
  /** Whether the engine actually resolved a yongshin element for this chart.
   *  When false we cannot make a grounded name↔saju claim, so return nothing. */
  readonly yongshinResolved: boolean;
}

export function buildNameSajuReading(input: NameSajuReadingInput): TieredNameSajuReading | undefined {
  if (!input.yongshinResolved) return undefined;
  const raw = input.yongshinMatchCount;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return undefined;
  const matchCount = Math.floor(raw);
  const y = input.yongshinName;

  const reinforces = matchCount >= 1;
  const sentence = reinforces
    ? `당신 이름은 채움이 필요한 ${y} 기운을 ${matchCount}글자 담고 있어서, `
      + `${y} 기운이 힘을 받는 시기에는 그 덕을 남들보다 크게 봐요.`
    : `당신 이름은 ${y} 기운을 직접 담고 있진 않아서, `
      + `${y} 기운이 도와주는 시기에는 생활 습관 쪽으로 그 기운을 조금 더 챙기면 좋아요.`;

  return {
    source: 'spring-ts.tiered.nameSajuReading',
    sentence,
    reinforces,
    yongshinMatchCount: matchCount,
  };
}
