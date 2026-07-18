/**
 * name-saju-reading.ts -- N1 name↔saju reinforcement (plain language)
 *
 * A bounded plain-language summary of the observed name-element matches.
 * It reports both the balancing-element and caution-element counts and never
 * upgrades those counts into a timing benefit or causal promise.
 *
 * Strictly conditioned on real values: when either input is missing or the
 * balancing element is unresolved, no reading is emitted.
 */

import type { TieredNameSajuReading } from '../types.js';

export interface NameSajuReadingInput {
  /** How many name characters carry the yongshin element (engine-computed). */
  readonly yongshinMatchCount: number | null | undefined;
  /** How many name characters carry the gishin element (engine-computed). */
  readonly gishinMatchCount: number | null | undefined;
  /** Plain element name of the yongshin (물/불/…), from the report slots. */
  readonly yongshinName: string;
  /** Whether the engine actually resolved a yongshin element for this chart.
   *  When false we cannot make a grounded name↔saju claim, so return nothing. */
  readonly yongshinResolved: boolean;
}

export function buildNameSajuReading(input: NameSajuReadingInput): TieredNameSajuReading | undefined {
  if (!input.yongshinResolved) return undefined;
  const rawYongshin = input.yongshinMatchCount;
  const rawGishin = input.gishinMatchCount;
  if (
    typeof rawYongshin !== 'number'
    || !Number.isFinite(rawYongshin)
    || rawYongshin < 0
    || typeof rawGishin !== 'number'
    || !Number.isFinite(rawGishin)
    || rawGishin < 0
  ) return undefined;
  const matchCount = Math.floor(rawYongshin);
  const cautionCount = Math.floor(rawGishin);
  const y = input.yongshinName;

  const classification = cautionCount > matchCount
    ? 'caution'
    : matchCount > 0 && cautionCount > 0
      ? 'mixed'
      : matchCount > 0
        ? 'supportive'
        : 'neutral';
  const reinforces = classification === 'supportive' || classification === 'mixed';
  const sentence = classification === 'supportive'
    ? `이름 글자 중 ${matchCount}글자가 사주에서 보완이 필요하다고 본 ${y} 기운과 맞아요. 이는 글자의 일치 근거이며 특정 시기의 결과를 보장하진 않아요.`
    : classification === 'mixed'
      ? `이름에서 보완 쪽 ${matchCount}글자와 주의 쪽 ${cautionCount}글자가 함께 보여요. 한쪽 효과로 단정하지 않고 두 신호를 같이 살펴야 해요.`
      : classification === 'caution'
        ? `이름의 주의 쪽 일치가 ${cautionCount}글자로 보완 쪽 ${matchCount}글자보다 많아요. 이 수치만으로 길흉을 단정하지 말고 다른 이름 근거와 함께 보세요.`
        : `이름에 사주에서 보완이 필요하다고 본 ${y} 기운과 직접 맞는 글자는 없어요. 직접 일치가 없다는 사실 이상으로 효과를 추정하지 않아요.`;

  return {
    source: 'spring-ts.tiered.nameSajuReading',
    sentence,
    reinforces,
    classification,
    yongshinMatchCount: matchCount,
    gishinMatchCount: cautionCount,
    evidenceBasis: 'yongshin-gishin-character-count',
  };
}
