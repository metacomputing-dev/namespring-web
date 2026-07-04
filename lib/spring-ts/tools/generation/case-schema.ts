/**
 * case-schema.ts -- The unit of the clustered generation plan (v2).
 *
 * A GenerationCase is ONE equivalence CLASS (canonical archetype), not a raw
 * full-case: the reduction formula (docs/REDUCTION_FORMULA.md) maps the full
 * dimension product F → K via role(x) ∈ {class, slot, callout}. Only class
 * dimensions vary between cases; slots/callouts are filled at runtime.
 *
 * Class dimensions: category, period, audience, band (base cell) × 강약(coarse3)
 * × 격국family(6) × nameEffect(4: 자원오행 통합의 부호까지) × gender(민감분야만).
 * Each class → one complete, expert-authored article, plain↔expert paired
 * (pairing-contract.md).
 */

export type StrengthCoarse = 'weak' | 'balanced' | 'strong';
export type GyeokgukFamily = 'inseong' | 'siksang' | 'jaeseong' | 'gwanseong' | 'bigeop' | 'special';
/** 자원오행이 사주 오행에 합산된 결과의 부호까지 담는 통합 축(감사 반영). */
export type NameEffect = 'boost_strong' | 'boost_mild' | 'neutral' | 'adverse';
export type Gender = 'male' | 'female';

export interface GenerationCase {
  readonly caseId: string;
  // ── base cell (already report selection axes) ──
  readonly category: string;
  readonly period: string;
  readonly audience: string;
  readonly band: string;
  // ── class branch axes (the clustered personalization) ──
  readonly gangyak: StrengthCoarse;
  readonly gyeokgukFamily: GyeokgukFamily;
  readonly nameEffect: NameEffect;
  /** Only set for gender-sensitive categories (romance/family/career); else null. */
  readonly gender: Gender | null;
  readonly spec: GenerationSpec;
}

/** Everything the OPUS expert needs to write the correct paired article. */
export interface GenerationSpec {
  readonly archetype: string;
  /** 강약 orthodox term + plain adjective. */
  readonly strengthTerm: string;
  readonly strengthPlain: string;
  readonly adviceDirection: string;
  /** 격국 family term + what it means for life strategy. */
  readonly gyeokgukTerm: string;
  readonly gyeokgukMeaning: string;
  /** Plain + expert description of the name↔saju integration, sign-aware. */
  readonly nameEffectPlain: string;
  readonly nameEffectExpert: string;
  /** Honesty flag: is the name harmful (adverse)? Then never say "채워 준다". */
  readonly nameIsAdverse: boolean;
  readonly genderTerm: string | null;
  readonly audienceSafety: 'adult' | 'minor';
  readonly suggestedExpertTags: readonly string[];
}
