import type { Expr, Rule } from '../dsl.js';
import type { TenGod } from '../../api/types.js';

export type GyeokgukRuleSpecBase = 'default' | 'none';
export type GyeokgukRuleSpecMode = 'append' | 'prepend' | 'replace';

/**
 * Month-gyeok quality gate (legacy shape; kept for backward compatibility).
 *
 * Used to express common ZiPing-style exceptions as JSON without TS changes.
 */
export interface MonthQualityGate {
  minMultiplier?: number;
  minClarity?: number;
  minIntegrity?: number;
  requireQing?: boolean;
  excludeBroken?: boolean;
  excludeMixed?: boolean;
  excludeZhuo?: boolean;
}

/**
 * Month-gyeok quality gate (explicit alias).
 *
 * This is an alternative shape to `monthQuality` that some configs may prefer.
 * The compiler treats `qualityGate` and `monthQuality` as aliases.
 */
export interface MonthGyeokQualityGate {
  requireNotBroken?: boolean;
  requireNotMixed?: boolean;
  minMultiplier?: number;
  minIntegrity?: number;
  minClarity?: number;
  requireQingZhuo?: 'QING' | 'ZHUO';
}

export type GyeokgukMacro =
  | {
      /** Generate rules: if month.mainTenGod == X then score gyeokguk.X += bonus. */
      kind: 'monthMainTenGod';
      tenGods?: TenGod[];
      when?: Expr;
      bonus?: number;
      idPrefix?: string;
      /** Template vars: {tenGod}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * Generate rules: if month.gyeok.tenGod == X then score gyeokguk.X += bonus.
       *
       * This corresponds to ZiPing(子平) style “透干/会支” month anchor selection.
       */
      kind: 'monthGyeokTenGod';
      tenGods?: TenGod[];
      when?: Expr;
      bonus?: number;
      idPrefix?: string;

      /**
       * If true, generated score uses:
       *   bonus × {var: qualityMultiplierVar}
       * Default multiplier var: 'month.gyeok.quality.multiplier'
       */
      useQualityMultiplier?: boolean;
      qualityMultiplierVar?: string;

      /** Template vars: {tenGod}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * Generate a high-level “専旺/一行得氣” rule:
       *   if patterns.elements.oneElement.factor >= minFactor then score {key} += bonus×factor.
       *
       * Default key: 'gyeokguk.ZHUAN_WANG'
       */
      kind: 'oneElementDominance';
      when?: Expr;
      minFactor?: number;
      bonus?: number;
      /**
       * Factor selector:
       * - 'raw'(default): patterns.elements.oneElement.factor
       * - 'zhuanwang': patterns.elements.oneElement.zhuanwangFactor (fallback to raw if unavailable)
       */
      factor?: 'raw' | 'zhuanwang';
      key?: string;

      /** Optional school exceptions (avoid TS changes). */
      requireDayMasterMatch?: boolean;
      requireIsOneElement?: boolean;
      monthQuality?: MonthQualityGate;
      qualityGate?: MonthGyeokQualityGate;

      idPrefix?: string;
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * Generate a high-level “化气/合化(화격)” rule:
       *   if factorVar >= minFactor then score {key} += bonus×factorVar.
       *
       * factor selector:
       * - 'effective'(default): patterns.transformations.best.effectiveFactor
       * - 'huaqi': patterns.transformations.best.huaqiFactor (requires huaqi condition-pack enabled)
       * - 'raw': patterns.transformations.best.factor
       *
       * Default key: 'gyeokguk.HUA_QI'
       */
      kind: 'transformationsBest';
      when?: Expr;
      minFactor?: number;
      bonus?: number;
      factor?: 'effective' | 'huaqi' | 'raw';
      key?: string;

      /** Optional school exceptions. */
      requireDayMasterInvolved?: boolean;
      monthQuality?: MonthQualityGate;
      qualityGate?: MonthGyeokQualityGate;

      idPrefix?: string;
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * Generate a high-level “从格/从势(종격)” rule:
       *   if patterns.follow.{factorVar} >= minFactor then score {key} += bonus×factorVar.
       *
       * factor selector:
       * - 'jonggyeok'(default): patterns.follow.jonggyeokFactor
       * - 'potential': patterns.follow.potential
       *
       * Optional mode filter: PRESSURE | SUPPORT
       *
       * Default key: 'gyeokguk.CONG_GE'
       */
      kind: 'followJonggyeok';
      when?: Expr;
      minFactor?: number;
      bonus?: number;
      factor?: 'jonggyeok' | 'potential';
      mode?: 'PRESSURE' | 'SUPPORT' | 'ANY';
      key?: string;

      /** Optional: filter by followType (and confidence). */
      types?: Array<'CONG_CAI' | 'CONG_GUAN' | 'CONG_SHA' | 'CONG_ER' | 'CONG_YIN' | 'CONG_BI'>;
      excludeTypes?: Array<'CONG_CAI' | 'CONG_GUAN' | 'CONG_SHA' | 'CONG_ER' | 'CONG_YIN' | 'CONG_BI'>;
      minSubtypeConfidence?: number;

      monthQuality?: MonthQualityGate;
      qualityGate?: MonthGyeokQualityGate;

      idPrefix?: string;
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * Generate typed “从格/종격” rules by followType (从财/从官/从杀/从儿/从印/从比).
       */
      kind: 'followJonggyeokTyped';
      when?: Expr;
      types?: Array<'CONG_CAI' | 'CONG_GUAN' | 'CONG_SHA' | 'CONG_ER' | 'CONG_YIN' | 'CONG_BI'>;
      minFactor?: number;
      bonus?: number;
      factor?: 'jonggyeok' | 'potential';
      mode?: 'PRESSURE' | 'SUPPORT' | 'ANY';
      keyPrefix?: string;
      minSubtypeConfidence?: number;
      monthQuality?: MonthQualityGate;
      qualityGate?: MonthGyeokQualityGate;
      idPrefix?: string;
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * School-style exception: when one special frame is strong, suppress other frame keys.
       *
       * This is useful for “不并用” style schools that do not stack special frames.
       */
      kind: 'suppressOtherFrames';
      winner: 'transformations' | 'oneElement' | 'follow';
      /** Which frames to suppress. Default: all other frames. */
      targets?: Array<'transformations' | 'oneElement' | 'follow'>;
      /** Winner threshold. Default: 0.65 */
      minFactor?: number;
      /** Penalty strength. Default: 0.6 */
      penalty?: number;
      /** Optional: choose which factor of the winner to use. */
      factor?:
        | { frame: 'follow'; sel?: 'jonggyeok' | 'potential' }
        | { frame: 'transformations'; sel?: 'effective' | 'raw' | 'huaqi' }
        | { frame: 'oneElement'; sel?: 'raw' | 'zhuanwang' };
      /** Optional: explicit key lists per target frame. */
      keyMap?: Partial<Record<'transformations' | 'oneElement' | 'follow', string[]>>;
      when?: Expr;
      idPrefix?: string;
      /** Template vars: {winner}, {target}, {key}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * School-specific exception hook: apply a negative score to a key when a condition holds.
       */
      kind: 'penalizeKeyWhen';
      key: string;
      when?: Expr;
      /** Positive penalty amount; compiled as a negative score. */
      penalty: number;
      /** Optional scaling var (multiplied by penalty). */
      scaleVar?: string;
      idPrefix?: string;
      /** Template vars: {key}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | { kind: 'customRules'; rules: Rule[] };

export interface GyeokgukRuleSpec {
  id?: string;
  version?: string;
  description?: string;

  base?: GyeokgukRuleSpecBase;
  mode?: GyeokgukRuleSpecMode;

  /**
   * Optional non-rule policy overrides.
   *
   * These fields do NOT generate rules; instead they influence evaluation
   * (e.g. special-frame competition post-processing).
   */
  policy?: {
    competition?: {
      enabled?: boolean;
      methods?: string[];
      power?: number;
      minKeep?: number;
      renormalize?: boolean;

      /**
       * Optional key groups per method.
       *
       * Each group can match explicit keys and/or key prefixes.
       */
      groups?: Partial<
        Record<
          'follow' | 'transformations' | 'oneElement' | 'tenGod',
          {
            prefixes?: string[];
            keys?: string[];
            excludePrefixes?: string[];
            excludeKeys?: string[];
          }
        >
      >;

      /** Optional signal selector per method. */
      signals?: {
        follow?: 'auto' | 'jonggyeok' | 'potential' | 'raw';
        transformations?: 'auto' | 'huaqi' | 'effective' | 'raw';
        oneElement?: 'auto' | 'zhuanwang' | 'raw';
        tenGod?: 'monthQuality' | 'auto' | number;
      };
    };
  };

  macros: GyeokgukMacro[];
}

