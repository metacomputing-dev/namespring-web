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

import type { DiversityHints } from './diversity-rotation.js';

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
  /** 격국 family의 그룹 십성 태그 id(비겁·식상·재성·관성·인성). 종격(special)은 없음(null). */
  readonly gyeokgukStar: string | null;
  /** 용신 축의 전략 방향(부억 골격). 오행을 단정하지 않고 '채우는/발산하는/균형' 방향만 준다. */
  readonly yongshinAxis: string;
  /** Plain + expert description of the name↔saju integration, sign-aware. */
  readonly nameEffectPlain: string;
  readonly nameEffectExpert: string;
  /** Honesty flag: is the name harmful (adverse)? Then never say "채워 준다". */
  readonly nameIsAdverse: boolean;
  readonly genderTerm: string | null;
  readonly audienceSafety: 'adult' | 'minor';
  readonly suggestedExpertTags: readonly string[];
  // ── academic-only matrix fields (docs/academic-matrix-v1.md) ──
  // Populated only for category === 'academic'; undefined elsewhere so other
  // categories' manifest JSONL stays byte-identical (JSON.stringify drops undefined).
  /** 이 격국의 학습 성향 + 리스크(생활어, 사주 용어 금지). */
  readonly studyProfile?: string;
  /** 이 (격국 × 시기) 셀의 고유 과제 — 셀 핵심 문장이 담을 활동. */
  readonly periodTask?: string;
  /** 이름이 이 격국에 더해 주는 이점(neutral/adverse는 빈 문자열). */
  readonly nameBenefit?: string;
  /** 이름이 이 격국에서 키우는 위험/살펴야 할 과잉. */
  readonly nameRisk?: string;
  // ── common anti-repetition hints (category-agnostic; opt-in per category) ──
  // Populated by a category's manifest generator via diversity-rotation.ts.
  // Undefined for categories that don't opt in → manifest bytes unchanged.
  readonly diversityHints?: DiversityHints;
}
