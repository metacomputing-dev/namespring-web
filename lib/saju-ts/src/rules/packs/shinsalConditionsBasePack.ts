/**
 * Shinsal quality / attenuation model (조건부 약화/무효) base pack.
 *
 * Design
 * - Quality is represented as a multiplier in [0, 1].
 * - A value of 1 means “no attenuation”; 0 means “invalidated”.
 * - The model is intentionally generic: it does not enumerate each 신살.
 *   Schools can override weights / combine strategy / thresholds / exclusion list via config.
 */

export type ShinsalDamageKey =
  | 'CHUNG'
  | 'HAE'
  | 'PA'
  | 'WONJIN'
  | 'HYEONG'
  | 'GONGMANG';

/** How to combine multiple penalties into a single penalty in [0,1]. */
export type ShinsalPenaltyCombine = 'max' | 'sum' | 'prob';

export interface ShinsalQualityModel {
  /** If false, condition attenuation is disabled (qualityWeight stays 1 unless explicitly set by ruleset). */
  enabled: boolean;

  /** If non-empty, apply condition attenuation only to these shinsal names. */
  applyToNames: string[];

  /** Category-level overrides (e.g., RELATION_SAL, VOID, TWELVE_SAL, ...). */
  categories?: Record<string, ShinsalQualityModelOverride>;

  /** Name-level overrides (highest priority). */
  names?: Record<string, ShinsalQualityModelOverride>;

  /** Per-condition penalty weight in [0,1]. Penalty is converted to qualityWeight = 1 - penalty. */
  weights: Record<ShinsalDamageKey, number>;

  /** Combine strategy when multiple conditions are present. */
  combine: ShinsalPenaltyCombine;

  /** If qualityWeight < weakThreshold, label the hit as WEAK. (Default: 1) */
  weakThreshold: number;

  /** If qualityWeight <= invalidateThreshold, mark the hit as invalidated. (Default: 0) */
  invalidateThreshold: number;

  /** Detection names that should skip condition attenuation entirely. */
  excludeNames: string[];
}

/**
 * Override shape for category/name entries.
 * - `weights` is partial: omitted keys inherit.
 * - all other fields are optional: omitted fields inherit.
 */
export interface ShinsalQualityModelOverride {
  enabled?: boolean;
  applyToNames?: string[];
  weights?: Partial<Record<ShinsalDamageKey, number>>;
  combine?: ShinsalPenaltyCombine;
  weakThreshold?: number;
  invalidateThreshold?: number;
  excludeNames?: string[];
}

export const DEFAULT_SHINSAL_QUALITY_MODEL: ShinsalQualityModel = {
  enabled: true,
  applyToNames: [],
  categories: {
    // Relation/void are typically used as “conditions”, so we skip attenuating them by default.
    RELATION_SAL: { enabled: false },
    VOID: { enabled: false },
  },
  weights: {
    CHUNG: 0.5,
    HAE: 0.5,
    PA: 0.5,
    WONJIN: 0.5,
    HYEONG: 0.5,
    GONGMANG: 0.5,
  },
  combine: 'max',
  weakThreshold: 1,
  invalidateThreshold: 0,
  excludeNames: ['CHUNG_SAL', 'HYEONG_SAL', 'HAE_SAL', 'PA_SAL', 'WONJIN_SAL', 'GONGMANG_SAL', 'GONGMANG'],
};
