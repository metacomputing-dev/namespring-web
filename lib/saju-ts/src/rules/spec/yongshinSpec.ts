import type { Expr, Rule } from '../dsl.js';
import type { Element } from '../../core/cycle.js';

export type YongshinRole = 'COMPANION' | 'RESOURCE' | 'OUTPUT' | 'WEALTH' | 'OFFICER';

export type YongshinRuleSpecBase = 'default' | 'none';
export type YongshinRuleSpecMode = 'append' | 'prepend' | 'replace';

export type YongshinMacro =
  | {
      /** Boost all elements whose day-master-relative role matches `role`. */
      kind: 'roleBoost';
      role: YongshinRole;
      /** Optional additional condition. */
      when?: Expr;
      /** Additive score contribution applied to `yongshin.<ELEMENT>`. */
      bonus: number;
      /** Optional id prefix. Default: `YONGSHIN_ROLEBOOST`. */
      idPrefix?: string;
      /** Template vars: {role}, {element}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * Month ten-god → role bias helper macro.
       *
       * Expands to a set of `roleBoost` rules based on either:
       * - `month.mainTenGod` (basis: 'main')
       * - `month.gyeok.tenGod` (basis: 'gyeok')
       *
       * Default TenGod-to-role mapping:
       * - OFFICER: JEONG_GWAN, PYEON_GWAN
       * - WEALTH: JEONG_JAE, PYEON_JAE
       * - OUTPUT: SIK_SHIN, SANG_GWAN
       * - RESOURCE: JEONG_IN, PYEON_IN
       * - COMPANION: BI_GYEON, GEOB_JAE
       *
       * This macro exists to keep “school exceptions / biases” expressible as JSON ruleSpecs
       * without repeating five roleBoost blocks.
       */
      kind: 'monthTenGodRoleBias';
      /** Month ten-god basis. Default: 'main'. */
      basis?: 'main' | 'gyeok';
      /** Bonus per role. Omitted roles are ignored. */
      bonuses: Partial<Record<YongshinRole, number>>;
      /** Optional additional condition. */
      when?: Expr;
      /** Optional id prefix. Default: `YONGSHIN_MONTH_ROLEBIAS`. */
      idPrefix?: string;
      /** Template vars: {basis}, {role}, {element}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * 일행득기/专旺(오행 편중) 신호 기반 보정.
       *
       * - uses `facts.patterns.elements.oneElement.{factor,element}`
       * - activation: factor >= minFactor
       * - score: `bonus * factor` added to the dominant element
       */
      kind: 'oneElementDominance';
      /** Minimum factor to activate. Default: 0.45 */
      minFactor?: number;
      /** Score contribution is `bonus * factor`. Default: 1.0 */
      bonus?: number;
      /**
       * Factor selector:
       * - 'raw'(default): patterns.elements.oneElement.factor
       * - 'zhuanwang': patterns.elements.oneElement.zhuanwangFactor (fallback to raw if unavailable)
       */
      factor?: 'raw' | 'zhuanwang';

      /**
       * Optional school exceptions (avoid TS changes):
       * - require day-master element == dominant element
       * - require strict one-element shape flag
       * - gate by month-gyeok quality (청탁/파격)
       */
      requireDayMasterMatch?: boolean;
      requireIsOneElement?: boolean;
      monthQuality?: {
        minMultiplier?: number;
        minClarity?: number;
        minIntegrity?: number;
        requireQing?: boolean;
        excludeBroken?: boolean;
        excludeMixed?: boolean;
        excludeZhuo?: boolean;
      };
      when?: Expr;
      /** Optional id prefix. Default: `YONGSHIN_ONEELEMENT`. */
      idPrefix?: string;
      /** Template vars: {element}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * 합화(化气)/화격 best 후보 기반 보정.
       *
       * - factor selector:
       *   - 'raw'(default): best.factor
       *   - 'effective': best.effectiveFactor
       *   - 'huaqi': best.huaqiFactor (requires huaqi condition-pack enabled)
       * - activation: selected factor >= minFactor
       * - score: `bonus * factor` added to the transformation result element
       */
      kind: 'transformationsBest';
      /** Minimum best.factor to activate. Default: 0.4 */
      minFactor?: number;
      /** Score contribution is `bonus * best.factor`. Default: 1.2 */
      bonus?: number;
      factor?: 'raw' | 'effective' | 'huaqi';

      /** Optional school exceptions: gate by huaqi day-involvement and/or month-gyeok quality. */
      requireDayMasterInvolved?: boolean;
      monthQuality?: {
        minMultiplier?: number;
        minClarity?: number;
        minIntegrity?: number;
        requireQing?: boolean;
        excludeBroken?: boolean;
        excludeMixed?: boolean;
        excludeZhuo?: boolean;
      };
      when?: Expr;
      /** Optional id prefix. Default: `YONGSHIN_TRANSFORM`. */
      idPrefix?: string;
      /** Template vars: {pair}, {element}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /** Boost specific elements. */
      kind: 'elementBoost';
      elements: Element[];
      when?: Expr;
      bonus: number;
      /** Optional id prefix. Default: `YONGSHIN_ELEMENTBOOST`. */
      idPrefix?: string;
      /** Template vars: {element}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * 通關(통관) 보정: 상극(相剋) 쌍이 “전(戰)”에 가까울 때, 해당 쌍의 브리지(通關) 오행을 가산한다.
       *
       * 매크로는 `facts.tongguan.pairs.*.intensity`(0..1)을 사용한다.
       */
      kind: 'tongguanBridge';
      pairs?: Array<'waterFire' | 'fireMetal' | 'metalWood' | 'woodEarth' | 'earthWater'>;
      /** Intensity source field. Default: 'intensity'. */
      intensityField?: 'intensity' | 'weightedIntensity';
      /** Apply only if intensity >= minIntensity. Default: 0.35 */
      minIntensity?: number;
      /** Alternative: read minIntensity from a facts/config variable. */
      minIntensityVar?: string;
      /** Score contribution is `bonus * intensity`. Default: 0.8 */
      bonus?: number;
      /** Alternative: read bonus from a facts/config variable. */
      bonusVar?: string;
      /** Optional additional condition. */
      when?: Expr;
      /** Optional id prefix. Default: `YONGSHIN_TONGGUAN`. */
      idPrefix?: string;
      /** Template vars: {pair}, {bridge}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * 從格/從勢(종격/순세) “약(弱) 순세” 보정(실험적).
       *
       * 신약이 극단이고 압력(식상/재/관)이 압도적일 때,
       * support가 아니라 pressure role(OUTPUT/WEALTH/OFFICER)을 따라가도록 가산.
       */
      kind: 'followWeakPressure';
      /** If `strength.index` < weakThreshold. Default: -0.78 */
      weakThreshold?: number;
      /** If `pressure/support` > minDominanceRatio. Default: 2.2 */
      minDominanceRatio?: number;
      /** Roles to boost. Default: OUTPUT/WEALTH/OFFICER */
      roles?: YongshinRole[];
      /** Score contribution is `bonus * elements.normalized[element]`. Default: 2.0 */
      bonus?: number;
      when?: Expr;
      idPrefix?: string;
      /** Template vars: {role}, {element}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * 從格/從勢(종격) 정밀 패턴(`patterns.follow`) 기반 보정.
       *
       * - uses `facts.patterns.follow.*`
       *   - `mode`: 'PRESSURE' | 'SUPPORT' | 'NONE'
       *   - `dominantRole`: 'OUTPUT'|'WEALTH'|'OFFICER'|'COMPANION'|'RESOURCE'
       *   - `dominantElement`: element corresponding to dominantRole
       *   - `potentialRaw`, `potential`, `jonggyeokFactor`
       * - activation: selected factor >= minFactor, and patterns.follow.enabled===true
       * - score: add `bonus × factor × scale` to the relevant element(s)
       */
      kind: 'followJonggyeok';

      /**
       * Factor selector:
       * - 'jonggyeok'(default): patterns.follow.jonggyeokFactor (fallback to potential)
       * - 'potential': patterns.follow.potential
       * - 'raw': patterns.follow.potentialRaw
       */
      factor?: 'jonggyeok' | 'potential' | 'raw';

      /** Mode filter. Default: 'ANY' */
      mode?: 'PRESSURE' | 'SUPPORT' | 'ANY';

      /** Minimum factor to activate. Default: 0.55 */
      minFactor?: number;
      /** Base score coefficient. Default: 1.8 */
      bonus?: number;

      /**
       * Target selection:
       * - 'role'(default): boost elements whose role matches patterns.follow.dominantRole
       * - 'element': boost only patterns.follow.dominantElement
       */
      target?: 'role' | 'element';

      /**
       * SUPPORT mode refinement:
       * - if true, also boosts the “other” support role (COMPANION <-> RESOURCE)
       * - score is scaled by `otherSupportScale`
       */
      includeOtherSupportRole?: boolean;
      /** Default: 0.5 */
      otherSupportScale?: number;

      /**
       * Scale within element:
       * - 'share'(default): multiply by elements.normalized[element]
       * - 'none': constant scale 1
       */
      scaleBy?: 'share' | 'none';

      /** Optional school exceptions: filter followType and/or require subtype confidence. */
      types?: Array<'CONG_CAI' | 'CONG_GUAN' | 'CONG_SHA' | 'CONG_ER' | 'CONG_YIN' | 'CONG_BI'>;
      excludeTypes?: Array<'CONG_CAI' | 'CONG_GUAN' | 'CONG_SHA' | 'CONG_ER' | 'CONG_YIN' | 'CONG_BI'>;
      /** Require patterns.follow.followTenGodSplit.confidence >= minSubtypeConfidence. */
      minSubtypeConfidence?: number;

      monthQuality?: {
        minMultiplier?: number;
        minClarity?: number;
        minIntegrity?: number;
        requireQing?: boolean;
        excludeBroken?: boolean;
        excludeMixed?: boolean;
        excludeZhuo?: boolean;
      };

      when?: Expr;
      /** Optional id prefix. Default: `YONGSHIN_FOLLOW_JONGGYEOK`. */
      idPrefix?: string;
      /** Template vars: {mode}, {role}, {element}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      /**
       * Generic helper: boost (or penalize) the element pointed by a fact variable.
       *
       * This keeps many school-specific exceptions fully data-driven in JSON without adding new TS macros
       * for each pattern.
       *
       * - elementVar: a variable path that resolves to an element string (e.g., 'patterns.transformations.best.resultElement')
       * - factorVar: a variable path that resolves to a number in [0..1] (e.g., 'patterns.transformations.best.huaqiFactor')
       * - activation: factorVar >= minFactor
       * - score: add (bonus × factorVar) to that element
       *
       * NOTE: set bonus to a negative value to express a suppression/exception rule.
       */
      kind: 'elementByVar';

      elementVar: string;
      factorVar: string;

      minFactor?: number;
      bonus?: number;
      when?: Expr;

      idPrefix?: string;
      /** Template vars: {element}, {elementVar}, {factorVar}. */
      explainTemplate?: string;
      tags?: string[];
    }

  | { kind: 'customRules'; rules: Rule[] };

export interface YongshinRuleSpec {
  id?: string;
  version?: string;
  description?: string;

  base?: YongshinRuleSpecBase;
  mode?: YongshinRuleSpecMode;

  macros: YongshinMacro[];
}
