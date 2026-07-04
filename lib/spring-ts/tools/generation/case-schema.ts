/**
 * case-schema.ts -- The unit of the no-sharing generation plan.
 *
 * A GenerationCase is ONE fully-branched archetype: a base cell
 * (category, period, audience, band) crossed with the personal saju/name
 * branch axes (강약 × 용신 × 이름보완). Each case maps to exactly one complete,
 * expert-authored article (summary + 3-4 body paragraphs + 1-2 expert
 * paragraphs + tips/cautions), where the plain (general) tier and the expert
 * tier are a consistent PAIR — no discrepancy (see pairing-contract.md).
 *
 * The manifest (all cases) is the durable data structure. Parallel OPUS
 * 사주명리+성명학 expert agents consume one case's GenerationSpec and return an
 * Article that the validator checks against that spec.
 */

export type StrengthBand = 'EXTREME_WEAK' | 'WEAK' | 'BALANCED' | 'STRONG' | 'EXTREME_STRONG';
export type ElementCode = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';
/** How strongly the person's NAME (자원오행 → combinedDistribution) carries the
 *  element the chart most needs (용신). Grounded in SajuCompatibility. */
export type NameReinforce = 'strong' | 'weak' | 'none';

/** One fully-branched archetype. */
export interface GenerationCase {
  readonly caseId: string;
  // ── base cell axes (already report selection axes) ──
  readonly category: string;
  readonly period: string;
  readonly audience: string;
  readonly band: string;
  // ── personal branch axes (the no-sharing personalization) ──
  readonly gangyak: StrengthBand;
  /** Yongshin element; null when handled as a slot (minor audiences). */
  readonly yongshin: ElementCode | null;
  readonly nameReinforce: NameReinforce;
  readonly spec: GenerationSpec;
}

/** Everything the expert agent needs to write the correct paired article. */
export interface GenerationSpec {
  /** Human brief: what saju/name situation this archetype represents. */
  readonly archetype: string;
  /** 신강/신약 in orthodox term (expert tier). */
  readonly strengthTerm: string;
  /** 신강/신약 as a plain adjective (general tier translation). */
  readonly strengthPlain: string;
  /** Plain element name of the yongshin (물/불/…) or null (slot). */
  readonly yongshinKo: string | null;
  /** Plain description of the name↔saju reinforcement. */
  readonly nameReinforceKo: string;
  /** Advice DIRECTION forced by strength (신강=쓰기/발산, 신약=채우기/보강). */
  readonly adviceDirection: string;
  /** Audience safety posture. */
  readonly audienceSafety: 'adult' | 'minor';
  /** Expert tags the expert paragraph SHOULD anchor on (glossary ids), so the
   *  plain tier and the expert tier stay a consistent pair. */
  readonly suggestedExpertTags: readonly string[];
}
