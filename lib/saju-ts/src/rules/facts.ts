import type { EngineConfig } from '../api/types.js';
import type { BranchIdx, Element, PillarIdx, StemIdx } from '../core/cycle.js';
import { branchElement, branchIdxFromHanja, ganzhiIndex, pillar, stemElement, stemIdxFromHanja } from '../core/cycle.js';
import type { DetectedRelation, RelationType } from '../core/branchRelations.js';
import { detectBranchRelations } from '../core/branchRelations.js';
import { controls, generates } from '../core/elements.js';
import type { ElementDistribution } from '../core/elementDistribution.js';
import type { ElementVector } from '../core/elementVector.js';
import { ELEMENT_ORDER, zeroElementVector } from '../core/elementVector.js';
import { mod } from '../core/mod.js';
import type { PillarsScoringResult, TenGodScore } from '../core/scoring.js';
import { tenGodOf } from '../core/tenGod.js';
import type { TenGod } from '../core/tenGod.js';
import type { HiddenStemRole } from '../core/hiddenStems.js';
import { hiddenStemsOfBranch } from '../core/hiddenStems.js';
import { lifeStageOf } from '../core/lifeStage.js';
import type { LifeStagePolicy } from '../core/lifeStage.js';

import type { NormalizedShinsalCatalog, RawShinsalCatalog } from './shinsalCatalog.js';
import { mergeRawShinsalCatalog, normalizeShinsalCatalog } from './shinsalCatalog.js';
import { DEFAULT_SHINSAL_CATALOG } from './packs/shinsalBaseCatalog.js';
import { DEFAULT_SHINSAL_DAMAGE_RELATIONS } from './packs/conditionsBasePack.js';
import { DEFAULT_CLIMATE_MODEL, computeClimateScores, mergeClimateModel } from './climate.js';
import type { JohooTemplateResult } from './johooTemplate.js';
import { computeJohooTemplate } from './johooTemplate.js';
import type { SeasonGroup } from './season.js';
import { seasonGroupOfMonthBranch } from './season.js';

export type DayMasterRole = 'COMPANION' | 'RESOURCE' | 'OUTPUT' | 'WEALTH' | 'OFFICER';

export type FollowType =
  | 'NONE'
  | 'CONG_CAI'
  | 'CONG_GUAN'
  | 'CONG_SHA'
  | 'CONG_ER'
  | 'CONG_YIN'
  | 'CONG_BI';


/**
 * 12신살(十二神殺) keys — 삼합군(지지 % 4) 기반 순차 표를 수학화한 표준 키 집합.
 *
 * 기준(대표 표):
 *  - 申子辰: 地(申)→桃(酉)→月(戌)→亡(亥)→将(子)→攀(丑)→驿(寅)→六(卯)→華(辰)→劫(巳)→災(午)→天(未)
 *  - 寅午戌: 地(寅)→桃(卯)→月(辰)→亡(巳)→将(午)→攀(未)→驿(申)→六(酉)→華(戌)→劫(亥)→災(子)→天(丑)
 *
 * 이 엔진은 이를 “start = (8 - 3*(branch%4)) mod 12”로 단순화하고, 각 항목을 start+offset으로 계산한다.
 */
export const TWELVE_SAL_KEYS = [
  'JI_SAL',
  'DOHWA',
  'WOL_SAL',
  'MANG_SHIN_SAL',
  'JANGSEONG',
  'BAN_AN_SAL',
  'YEOKMA',
  'YUK_HAE_SAL',
  'HUAGAI',
  'GEOB_SAL',
  'JAESAL',
  'CHEON_SAL',
] as const;

export type TwelveSalKey = (typeof TWELVE_SAL_KEYS)[number];

export interface StrengthFacts {
  /** [-1, +1] where negative = weak, positive = strong (in this model). */
  index: number;
  support: number;
  pressure: number;
  total: number;
  components: {
    companions: number;
    resources: number;
    outputs: number;
    wealth: number;
    officers: number;
  };

  /** Strength model id used for this run (e.g., 'base', 'seasonalRoots'). */
  model?: string;

  /**
   * Optional decomposition for advanced models.
   * Kept optional to preserve API stability and allow schools to evolve.
   */
  details?: {
    season?: {
      monthElement: Element;
      seasonGroup: SeasonGroup;
      dayMasterElement: Element;
      /** Signed score in [-1,+1] roughly indicating 得令/失令 for DM under month element. */
      score: number;
      /** Applied multiplicative factor for support adjustment (e.g. 0.12). */
      factor: number;
    };
    roots?: {
      /** Sum of hidden-stem weights where stem-element == DM element. */
      sameElement: number;
      /** Sum of hidden-stem weights where stem-element generates DM element. */
      resourceElement: number;
      /** Combined root support score (non-negative). */
      score: number;
      /** Applied multiplicative factor for support adjustment. */
      factor: number;
    };
    delingdiShi?: {
      deLing: { monthElement: Element; dayMasterElement: Element; score: number; factor: number };
      deDi: {
        sameElement: number;
        resourceElement: number;
        score: number;
        normalized: number;
        factor: number;
      };
      deShi: {
        sameElement: number;
        resourceElement: number;
        score: number;
        normalized: number;
        factor: number;
        positionWeights: { year: number; month: number; hour: number };
      };
      adjusted: { support: number; pressure: number; total: number };
    };

    adjusted?: {
      support: number;
      pressure: number;
      total: number;
    };
  };
}
export interface RuleFacts {
  chart: {
    pillars: {
      year: { stem: StemIdx; branch: BranchIdx };
      month: { stem: StemIdx; branch: BranchIdx };
      day: { stem: StemIdx; branch: BranchIdx };
      hour: { stem: StemIdx; branch: BranchIdx };
    };
    stems: StemIdx[];
    branches: BranchIdx[];
    relations: {
      /** Full detected relations (합/충/형/해/파/원진/삼합/방합/삼형) */
      detected: DetectedRelation[];
      /** Convenience index: relation-type → list of member arrays */
      byType: Partial<Record<RelationType, BranchIdx[][]>>;

      /** 支冲(정충) 감지: b와 (b+6) 동시 존재 시 b를 포함 */
      chungBranches: BranchIdx[];
      /** 支害 감지: b와 haePartner(b) 동시 존재 시 b를 포함 */
      haeBranches: BranchIdx[];

      /** 六合 (합) */
      yukhapBranches: BranchIdx[];
      /** 支破 (파) */
      paBranches: BranchIdx[];
      /** 怨嗔 (원진) */
      wonjinBranches: BranchIdx[];
      /** 刑 (형) + 自刑/三刑 포함 */
      hyeongBranches: BranchIdx[];

      /** Common “damage” set used for quality/attenuation. */
      damagedBranches: BranchIdx[];

      /** Relation types treated as “damage” in this run (school/policy dependent). */
      damageTypes?: RelationType[];
    };
  };

  dayMaster: {
    stem: StemIdx;
    element: Element;
  };

  dayMasterRoleByElement: Record<Element, DayMasterRole>;

  month: {
    branch: BranchIdx;
    element: Element;
    seasonGroup: SeasonGroup;
    mainHiddenStem: StemIdx;
    mainTenGod: TenGod;

    /** Month-branch hidden stems (本气/中气/余气) with ten-god + visibility. */
    hiddenStems: Array<{
      stem: StemIdx;
      element: Element;
      role: HiddenStemRole;
      weight: number;
      tenGod: TenGod;
      visibleInChart: boolean;
    }>;

    /** True if 월지 本气(본기) stem is exposed(透干) in any pillar stem. */
    mainHiddenStemVisible: boolean;

    /**
     * ZiPing-style 格局 anchor candidate derived from month hidden-stem exposure.
     * - MAIN_EXPOSED: 本气透干 → 본기를 고정
     * - VISIBLE_HIDDEN: 본기 미투간이지만 중/여기 중 노출된 것이 있어 그 stem을 채택
     * - MAIN_FALLBACK: 아무것도 노출되지 않아 본기로 fallback
     */
    gyeok: {
      stem: StemIdx;
      tenGod: TenGod;
      method: 'MAIN_EXPOSED' | 'VISIBLE_HIDDEN' | 'GROUP_SUPPORTED' | 'MAIN_FALLBACK';

      /** Optional “会支” support info (삼합/방합) used when no stem is exposed. */
      support?: { type: 'SAMHAP' | 'BANGHAP'; element: Element; members: BranchIdx[] } | null;

      /** Optional debug candidate list with scores and reasons. */
      candidates?: Array<{
        stem: StemIdx;
        element: Element;
        tenGod: TenGod;
        score: number;
        reasons: string[];
        visibleInChart: boolean;
        role: HiddenStemRole;
        weight: number;
      }>;

      /**
       * 格局 품질(청탁/파격)을 연속값으로 근사한 지표.
       *
       * - clarity: [0..1] (높을수록 “청(清)”에 가까움)
       * - integrity: [0..1] (높을수록 “파격(破格) 요인”이 적음)
       * - multiplier: [0..1] 기본 격국 점수에 곱할 수 있는 종합 가중치
       */
      quality: {
        clarity: number;
        integrity: number;
        damage: number;
        qingZhuo: 'QING' | 'ZHUO';
        broken: boolean;
        mixed: boolean;
        multiplier: number;
        reasons: string[];
        details?: {
          gap: number;
          alignmentRank: number;
          rootScore: number;
          rootNorm: number;
          damageByType: Record<string, number>;
          damageRelations: DetectedRelation[];
        };
      };
    };
  };

  elements: {
    total: ElementVector;
    totalSum: number;
    normalized: ElementVector;
    normalizedArr: number[]; // ELEMENT_ORDER
  };

  /**
   * High-level patterns derived from the element distribution.
   *
   * This is intentionally “math-first”: a small set of continuous signals
   * (dominance/entropy) that schools can interpret differently.
   */
  patterns: {
    elements: {
      top: { element: Element; value: number; second: number; dominanceRatio: number; entropy: number };
      oneElement: {
        enabled: boolean;
        isOneElement: boolean;
        element: Element;
        factor: number;
        thresholds: { topMin: number; dominanceRatioMin: number; entropyMax: number };

        /** Optional: 专旺/전왕(일행득기) 정밀 조건팩 — base factor에 추가 감쇠/강화(연속값). */
        zhuanwangConditionFactor?: number;
        /** factor × zhuanwangConditionFactor (전왕 후보에 더 적합한 최종 factor). */
        zhuanwangFactor?: number;
        /** Debug payload for zhuanwang conditions (kept optional for API stability). */
        zhuanwangDetails?: {
          enabled: boolean;
          requireDayMasterMatch: boolean;
          weights: Record<string, number>;
          thresholds: Record<string, number>;
          signals: Record<string, number>;
          flags: Record<string, boolean>;
          reasons: string[];
        };
      };
    };
    /**
     * Heavenly-stem combination → transformation element signals (合化/화격 후보).
     *
     * This is *not* a hard boolean “it transforms”, but a continuous factor.
     */
    transformations?: {
      enabled: boolean;
      threshold: number;

      /** Optional ambiguity/competition attenuation based on 2nd-best candidate. */
      competition?: {
        enabled: boolean;
        /** Start penalizing when second/best >= startRatio. */
        startRatio: number;
        /** Max penalty applied when second/best → 1. */
        maxPenalty: number;
        /** secondFactor/bestFactor in [0,1]. */
        ratio: number;
        /** Multiplicative confidence factor in [0,1] applied to best.factor. */
        factor: number;
      };

      /** Weights for blended support (normalized internally when normalizeWeights=true). */
      weightShare: number;
      weightSeason: number;
      weightRoot?: number;
      weightPosition?: number;
      normalizeWeights?: boolean;

      /** Position weights used when weightPosition>0. */
      positionWeights?: { year: number; month: number; day: number; hour: number };

      /** Root weights used when weightRoot>0 (month/day branch roots). */
      rootWeights?: { month: number; day: number };

      /** Break/attenuation (破合) policy. */
      break?: {
        enabled: boolean;
        weights?: { stemClash?: number; branchDamage?: number; interBranchDamage?: number };
      };

      candidates: Array<{
        pair: string;
        stems: { a: StemIdx; b: StemIdx };
        resultElement: Element;
        present: boolean;
        counts: { a: number; b: number };
        support: {
          elementShare: number;
          seasonScore: number;
          season01: number;
          rootScore?: number;
          root01?: number;
          pos?: { a: number; b: number; pair: number };
          /** Max(1/distance) among stem positions (adjacent=1, 2-step=0.5, 3-step≈0.33). */
          distanceFactor?: number;
          blended: number;
          weights?: { share: number; season: number; root: number; position: number; total: number };
        };
        break?: {
          stemClash: number;
          branchDamage: number;
          interBranchDamage: number;
          penalty: number;
          factor: number;
          weights?: { stemClash: number; branchDamage: number; interBranchDamage: number };
        };
        /** factor before applying break attenuation */
        rawFactor?: number;
        factor: number;
      }>;

      /** Best candidate summary (continuous signal; not a hard “it transforms”). */
      best?: {
        pair: string;
        resultElement: Element;
        /** Raw factor after support blend + break attenuation (pre-competition). */
        factor: number;
        /** Best support.blended in [0,1]. */
        blended: number;
        /** factor before applying break attenuation */
        rawFactor?: number;
        /** break attenuation in [0,1] */
        breakFactor?: number;

        /** 2nd best factor (pre-competition). */
        secondFactor?: number;
        /** Competition/ambiguity confidence in [0,1]. */
        competitionFactor?: number;
        /** factor × competitionFactor (effective factor used by downstream policies). */
        effectiveFactor?: number;

        /** Optional: 化气格(화기격) 정밀 조건팩을 적용한 추가 감쇠/강화 결과. */
        huaqiConditionFactor?: number;
        /** effectiveFactor × huaqiConditionFactor (화기격 후보에 더 적합한 최종 factor). */
        huaqiFactor?: number;
        /** Debug payload for huaqi conditions (kept optional for API stability). */
        huaqiDetails?: {
          enabled: boolean;
          requireDayMasterInvolved: boolean;
          weights: Record<string, number>;
          thresholds: Record<string, number>;
          signals: Record<string, number>;
          flags: Record<string, boolean>;
          reasons: string[];
        };
      };
    };

    /**
     * 從格/從勢(종격) follow-trend pattern signal (continuous).
     *
     * Derived from strength extremeness + dominance ratio, optionally enriched by
     * a “jonggyeok condition pack” (순수성/월령/통근/극신/파격 등).
     */
    follow?: {
      enabled: boolean;

      /** Raw follow potential from strength/dominance (pre one-element boost). */
      potentialRaw: number;
      /** Potential after optional one-element boost (pre jonggyeok conditions). */
      potential: number;

      mode: 'PRESSURE' | 'SUPPORT' | 'NONE';
      dominanceRatio: number;

      dominantRole: DayMasterRole;
      dominantElement: Element;

      /** Classified follow-type (从财/从官/从杀/从儿/从印/从比). */
      followType?: FollowType;
      /** Dominant ten-god inside the dominantRole group (e.g., JEONG_GWAN vs PYEON_GWAN). */
      followTenGod?: TenGod;
      /** Ten-god split inside dominantRole group (primary/secondary shares). */
      followTenGodSplit?: {
        primary: TenGod;
        secondary: TenGod;
        primaryScore: number;
        secondaryScore: number;
        total: number;
        primaryShare: number;
        /** 0..1, 1 means primary fully dominates secondary. */
        confidence: number;
      };

      /** Factor used for optional one-element boost (e.g., oneElement.factor or zhuanwangFactor). */
      oneElementFactor?: number;
      /** Boost coefficient applied to oneElementFactor. */
      oneElementBoost?: number;

      /** Optional: 종격 정밀 조건팩 factor in [0,1]. */
      jonggyeokConditionFactor?: number;
      /** potential × jonggyeokConditionFactor (종격 후보에 더 적합한 최종 factor). */
      jonggyeokFactor?: number;
      /** Debug payload for jonggyeok conditions (kept optional for API stability). */
      jonggyeokDetails?: {
        enabled: boolean;
        applyTo: 'BOTH' | 'PRESSURE' | 'SUPPORT';
        weights: Record<string, number>;
        thresholds: Record<string, number>;
        signals: Record<string, number>;
        flags: Record<string, boolean>;
        reasons: string[];
      };
    };
  };

  tenGodScores: TenGodScore;
  tenGodScoresRanking: Array<{ tenGod: TenGod; score: number }>;
  tenGodScoresBest: { tenGod: TenGod; score: number };

  /**
   * Seasonal climate model (조후/调候).
   *
   * This mirrors the internal climate scoring used by yongshin so that DSL rules
   * can reference `climate.need.*` or `climate.scores.*` consistently.
   */
  climate: {
    seasonGroup: SeasonGroup;
    /** Vector form: +hot/-cold, +wet/-dry (johoo scoring) */
    env: { temp: number; moist: number };
    /** Target - env */
    need: { temp: number; moist: number };
    /** Element scores (dot(effect, need)) */
    scores: Record<Element, number>;

    /** Optional 조후(調候) “template hints” (궁통보감 계열) — compact, non-table heuristic. */
    template?: JohooTemplateResult;
  };

  /**
   * 通关(tongguan) “battle” intensities between controlling element pairs.
   * DSL rules can use these to boost a bridge element.
   */
  tongguan: {
    pairs: {
      waterFire: { a: Element; b: Element; bridge: Element; intensity: number; weightedIntensity?: number };
      fireMetal: { a: Element; b: Element; bridge: Element; intensity: number; weightedIntensity?: number };
      metalWood: { a: Element; b: Element; bridge: Element; intensity: number; weightedIntensity?: number };
      woodEarth: { a: Element; b: Element; bridge: Element; intensity: number; weightedIntensity?: number };
      earthWater: { a: Element; b: Element; bridge: Element; intensity: number; weightedIntensity?: number };
    };
    maxIntensity: number;

    /** Sum of all pair intensities (0..5). Useful to detect multi-battle charts. */
    sumIntensity?: number;

    /** How dominant the max battle is among all battles: max/sum (0..1). */
    dominance?: number;

    /** Entropy-like dispersion metric of battle intensities (0..1). Higher = more dispersed. */
    dispersion?: number;

    /** Optional alternative “effective max” that accounts for dominance (max * dominance). */
    effectiveMaxIntensity?: number;
  };
  strength: StrengthFacts;

  shinsal: {
    /** 12신살(삼합군 기반) 타깃 지지 — year/day anchors */
    twelveSal: {
      year: Record<TwelveSalKey, BranchIdx>;
      day: Record<TwelveSalKey, BranchIdx>;
    };

    peach: { year: BranchIdx; day: BranchIdx };
    horse: { year: BranchIdx; day: BranchIdx };
    huagai: { year: BranchIdx; day: BranchIdx };
    jangseong: { year: BranchIdx; day: BranchIdx };
    jaesal: { year: BranchIdx; day: BranchIdx };
    hongluan: { year: BranchIdx };
    cheonhui: { year: BranchIdx };
    gongmang: { day: [BranchIdx, BranchIdx] };

    /** Special/seasonal day markers (e.g., 天赦日). */
    specialDays?: {
      CHEON_SA?: {
        season: SeasonGroup;
        targetDayPillar: { stem: StemIdx; branch: BranchIdx };
        targetDayPillarHanja: string;
        active: boolean;
        matchedPillars: ReadonlyArray<'month' | 'day'>;
      };
    };

    /**
     * Relation-derived shinsal payloads.
     *
     * We keep these as ready-to-emit JSON arrays because the DSL intentionally has no loops.
     */
    relationSal?: Record<string, any[]>;

    /**
     * Catalog-driven shinsal facts (data-pack).
     *
     * Rulesets may reference these keys directly.
     */
    catalog: {
      /** key → { targets, present, count } derived from 日干 tables */
      dayStem: Record<
        string,
        {
          targets: BranchIdx[];
          present: BranchIdx[];
          count: number;
          matchedPillars: Array<'year' | 'month' | 'day' | 'hour'>;
        }
      >;

      /** key → { targets, present, count } derived from 年干 tables (same catalog, different anchor) */
      yearStem: Record<
        string,
        {
          targets: BranchIdx[];
          present: BranchIdx[];
          count: number;
          matchedPillars: Array<'year' | 'month' | 'day' | 'hour'>;
        }
      >;

      /** key → { targets, present, count } derived from 月支→天干 tables */
      monthBranchStem: Record<
        string,
        {
          targets: StemIdx[];
          target: StemIdx | null;
          present: StemIdx[];
          count: number;
          matchedPillars: Array<'year' | 'month' | 'day' | 'hour'>;
          scopePillars?: Array<'year' | 'month' | 'day' | 'hour'>;
        }
      >;

      /** key → { targets, present, count } derived from 月支→지지 tables */
      monthBranchBranch: Record<
        string,
        {
          targets: BranchIdx[];
          target: BranchIdx | null;
          present: BranchIdx[];
          count: number;
          matchedPillars: Array<'year' | 'month' | 'day' | 'hour'>;
          scopePillars?: Array<'year' | 'month' | 'day' | 'hour'>;
        }
      >;

      /** key → 日柱/四柱 membership results derived from 60갑자 sets */
      dayPillar: Record<
        string,
        {
          requiresDayPillar: boolean;
          isDayPillar: boolean;
          active: boolean;
          matchedPillars: Array<'year' | 'month' | 'day' | 'hour'>;
        }
      >;
    };
  };

  config: {
    schemaVersion: string;
    strategies: Record<string, unknown>;
    weights: Record<string, unknown>;
    extensions: Record<string, unknown>;
  };
}

function sumVector(v: ElementVector): number {
  return ELEMENT_ORDER.reduce((acc, e) => acc + v[e], 0);
}

function normalizeVector(v: ElementVector): { normalized: ElementVector; sum: number } {
  const s = sumVector(v);
  if (s <= 0) return { normalized: zeroElementVector(), sum: 0 };
  const out: ElementVector = {
    WOOD: v.WOOD / s,
    FIRE: v.FIRE / s,
    EARTH: v.EARTH / s,
    METAL: v.METAL / s,
    WATER: v.WATER / s,
  };
  return { normalized: out, sum: s };
}

function dayMasterRole(candidate: Element, dm: Element): DayMasterRole {
  if (candidate === dm) return 'COMPANION';
  if (generates(candidate, dm)) return 'RESOURCE';
  if (generates(dm, candidate)) return 'OUTPUT';
  if (controls(dm, candidate)) return 'WEALTH';
  if (controls(candidate, dm)) return 'OFFICER';
  return 'COMPANION';
}

function rankTenGodScores(scores: TenGodScore): Array<{ tenGod: TenGod; score: number }> {
  const entries = Object.entries(scores) as Array<[TenGod, number]>;
  return entries
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => b[1] - a[1])
    .map(([tenGod, score]) => ({ tenGod, score }));
}

function computeClimateFacts(config: EngineConfig, monthBranch: BranchIdx): RuleFacts['climate'] {
  const seasonGroup = seasonGroupOfMonthBranch(monthBranch);

  // Use the same climate model shape as yongshin policy so that rule DSL can
  // reference climate vectors consistently.
  const raw: any = (config.strategies as any)?.yongshin?.climate ?? {};
  const modelRaw = raw?.model ?? raw;
  const model = mergeClimateModel(DEFAULT_CLIMATE_MODEL, modelRaw);
  const { env, need, scores } = computeClimateScores(model, monthBranch);


  return { seasonGroup, env, need, scores };
}

function battleIntensity(normalized: ElementVector, a: Element, b: Element): number {
  const x = normalized[a];
  const y = normalized[b];
  const min = Math.min(x, y);
  const sum = x + y;
  if (sum <= 0) return 0;
  const balance = 1 - Math.abs(x - y) / sum;
  // Scale to [0..1] with max at x=y=0.5.
  return Math.max(0, Math.min(1, 2 * min * balance));
}

function computeTongguanFacts(normalized: ElementVector): RuleFacts['tongguan'] {
  const pairs: RuleFacts['tongguan']['pairs'] = {
    // 水火战 → 木通关
    waterFire: { a: 'WATER' as Element, b: 'FIRE' as Element, bridge: 'WOOD' as Element, intensity: battleIntensity(normalized, 'WATER', 'FIRE') },
    // 火金战 → 土通关
    fireMetal: { a: 'FIRE' as Element, b: 'METAL' as Element, bridge: 'EARTH' as Element, intensity: battleIntensity(normalized, 'FIRE', 'METAL') },
    // 金木战 → 水通关
    metalWood: { a: 'METAL' as Element, b: 'WOOD' as Element, bridge: 'WATER' as Element, intensity: battleIntensity(normalized, 'METAL', 'WOOD') },
    // 木土战 → 火通关
    woodEarth: { a: 'WOOD' as Element, b: 'EARTH' as Element, bridge: 'FIRE' as Element, intensity: battleIntensity(normalized, 'WOOD', 'EARTH') },
    // 土水战 → 金通关
    earthWater: { a: 'EARTH' as Element, b: 'WATER' as Element, bridge: 'METAL' as Element, intensity: battleIntensity(normalized, 'EARTH', 'WATER') },
  };
  const maxIntensity = Math.max(
    pairs.waterFire.intensity,
    pairs.fireMetal.intensity,
    pairs.metalWood.intensity,
    pairs.woodEarth.intensity,
    pairs.earthWater.intensity,
  );

  const intensities = [
    pairs.waterFire.intensity,
    pairs.fireMetal.intensity,
    pairs.metalWood.intensity,
    pairs.woodEarth.intensity,
    pairs.earthWater.intensity,
  ];
  const sumIntensity = intensities.reduce((a, b) => a + b, 0);

  // Dominance: how clearly a single “battle pair” stands out.
  const dominance = sumIntensity > 0 ? maxIntensity / sumIntensity : 0;

  // Dispersion: normalized entropy of the intensity distribution.
  // 0 → single pair dominates; 1 → evenly spread across multiple battles.
  const dispersion = (() => {
    if (sumIntensity <= 0) return 0;
    const ps = intensities.map((x) => (x <= 0 ? 0 : x / sumIntensity));
    const n = ps.length;
    const denom = Math.log(n);
    if (denom <= 0) return 0;
    let h = 0;
    for (const p of ps) if (p > 0) h += -p * Math.log(p);
    return Math.max(0, Math.min(1, h / denom));
  })();

  // Weighted intensity: bias towards a single dominant battle.
  // When battles are widely dispersed, 通关 as a single “bridge” is less decisive.
  const weight = dominance; // intentionally simple & interpretable
  pairs.waterFire.weightedIntensity = pairs.waterFire.intensity * weight;
  pairs.fireMetal.weightedIntensity = pairs.fireMetal.intensity * weight;
  pairs.metalWood.weightedIntensity = pairs.metalWood.intensity * weight;
  pairs.woodEarth.weightedIntensity = pairs.woodEarth.intensity * weight;
  pairs.earthWater.weightedIntensity = pairs.earthWater.intensity * weight;

  const effectiveMaxIntensity = maxIntensity * weight;

  return { pairs, maxIntensity, sumIntensity, dominance, dispersion, effectiveMaxIntensity };
}


function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function computeElementPatterns(config: EngineConfig, normalized: Record<Element, number>): RuleFacts['patterns'] {
  const vals = ELEMENT_ORDER.map((e) => ({ element: e, value: normalized[e] ?? 0 }));
  vals.sort((a, b) => b.value - a.value);
  const top = vals[0]!;
  const second = vals[1] ?? { element: top.element, value: 0 };

  // Normalized entropy in [0,1] (0 = single-element, 1 = uniform)
  const eps = 1e-12;
  let h = 0;
  for (const v of vals) {
    const p = Math.max(0, v.value);
    if (p > eps) h += -p * Math.log(p);
  }
  const entropy = h / Math.log(ELEMENT_ORDER.length);

  const dominanceRatio = top.value / Math.max(eps, second.value);

  const pol0 =
    (config.strategies as any)?.patterns?.elements?.oneElement ??
    (config.strategies as any)?.patterns?.oneElement ??
    (config.strategies as any)?.oneElement ??
    {};
  const enabled = (pol0 as any)?.enabled !== false;

  // Backward/forward compatible: allow thresholds to be nested under `thresholds`.
  const thr: any = (pol0 as any)?.thresholds && typeof (pol0 as any).thresholds === 'object' ? (pol0 as any).thresholds : pol0;
  const topMin = typeof thr.topMin === 'number' && Number.isFinite(thr.topMin) ? thr.topMin : 0.52;
  const dominanceRatioMin =
    typeof thr.dominanceRatioMin === 'number' && Number.isFinite(thr.dominanceRatioMin) ? thr.dominanceRatioMin : 2.2;
  const entropyMax = typeof thr.entropyMax === 'number' && Number.isFinite(thr.entropyMax) ? thr.entropyMax : 0.78;

  const isOneElement = enabled && top.value >= topMin && dominanceRatio >= dominanceRatioMin && entropy <= entropyMax;

  const fTop = clamp01((top.value - topMin) / Math.max(eps, 1 - topMin));
  const fDom = clamp01((dominanceRatio - dominanceRatioMin) / Math.max(eps, dominanceRatioMin));
  const fEnt = clamp01((entropyMax - entropy) / Math.max(eps, entropyMax));
  const factor = enabled ? clamp01(fTop * fDom * fEnt) : 0;

  return {
    elements: {
      top: { element: top.element, value: top.value, second: second.value, dominanceRatio, entropy },
      oneElement: { enabled, isOneElement, element: top.element, factor, thresholds: { topMin, dominanceRatioMin, entropyMax } },
    },
  };
}

/**
 * 专旺/전왕(일행득기) 정밀 조건팩.
 *
 * Base `patterns.elements.oneElement.factor`는 **분포 모양(편중)**만을 반영한다.
 * 이 조건팩은 전통적 논의에서 자주 요구되는 “得令/得地/得势 + 월지 격 품질/파격”을
 * 연속값(0..1)로 추가 반영하여 `zhuanwangFactor`를 만든다.
 *
 * - output location: `facts.patterns.elements.oneElement.{zhuanwangConditionFactor,zhuanwangFactor,zhuanwangDetails}`
 * - config:
 *   - `strategies.patterns.oneElement.zhuanwang.*` (canonical)
 *   - `strategies.patterns.elements.oneElement.zhuanwang.*` (compat)
 */
function applyZhuanwangConditionPack(config: EngineConfig, facts: RuleFacts): void {
  const oneEl: any = (facts as any)?.patterns?.elements?.oneElement;
  if (!oneEl || typeof oneEl !== 'object') return;

  const pol0 =
    (config.strategies as any)?.patterns?.elements?.oneElement ??
    (config.strategies as any)?.patterns?.oneElement ??
    (config.strategies as any)?.oneElement ??
    {};

  const zwPol = ((pol0 as any)?.zhuanwang ?? (pol0 as any)?.zhuanWang ?? (pol0 as any)?.zhuan_wang ?? {}) as any;
  const enabled = zwPol?.enabled === true;
  if (!enabled) return;

  const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

  const requireDayMasterMatch = zwPol?.requireDayMasterMatch !== false;
  const dayNotMatchPenalty = num(zwPol.dayNotMatchPenalty, requireDayMasterMatch ? 0 : 0.15);

  const lingThreshold = num(zwPol.lingThreshold, 0.55);
  const diThreshold = num(zwPol.diThreshold, 0.35);
  const shiThreshold = num(zwPol.shiThreshold, 0.25);
  const qualityThreshold = num(zwPol.qualityThreshold, 0.55);
  const strongThreshold = num(zwPol.strongThreshold, 0.0);
  const harmThreshold = num(zwPol.harmThreshold, 0.18);

  // Root/shi decomposition parameters (used when strength model details are absent, or when DM != dominant element).
  const rootNorm = num(zwPol.rootNorm, 2.2);
  const shiNorm = num(zwPol.shiNorm, 1.6);
  const rootResAlpha = num(zwPol.rootResAlpha, 0.6);
  const shiResAlpha = num(zwPol.shiResAlpha, 0.7);

  const bwRaw = (zwPol.branchWeights ?? {}) as any;
  const branchWeights = {
    year: num(bwRaw.year, 0.7),
    month: num(bwRaw.month, 1.1),
    day: num(bwRaw.day, 0.9),
    hour: num(bwRaw.hour, 0.7),
  };

  const pwRaw = (zwPol.positionWeights ?? {}) as any;
  const positionWeights = {
    year: num(pwRaw.year, 0.6),
    month: num(pwRaw.month, 1.0),
    hour: num(pwRaw.hour, 0.8),
  };

  const wRaw = (zwPol.weights ?? {}) as any;
  const weights0 = {
    match: num(wRaw.match, 0.2),
    ling: num(wRaw.ling, 0.2),
    di: num(wRaw.di, 0.2),
    shi: num(wRaw.shi, 0.1),
    quality: num(wRaw.quality, 0.2),
    strong: num(wRaw.strong, 0.1),
    noHarm: num(wRaw.noHarm, 0.1),
  };
  const wSum = Object.values(weights0).reduce((a, b) => a + b, 0);
  const weights = wSum > 0 ? (Object.fromEntries(Object.entries(weights0).map(([k, v]) => [k, v / wSum])) as any) : weights0;

  const pRaw = (zwPol.penalties ?? {}) as any;
  const penalties = {
    broken: num(pRaw.broken, 0.25),
    mixed: num(pRaw.mixed, 0.1),
    zhuo: num(pRaw.zhuo, 0.08),
  };

  const controllerOf = (e: Element): Element => {
    switch (e) {
      case 'WOOD':
        return 'METAL';
      case 'FIRE':
        return 'WATER';
      case 'EARTH':
        return 'WOOD';
      case 'METAL':
        return 'FIRE';
      case 'WATER':
        return 'EARTH';
    }
  };

  const geomMean01 = (pairs: Array<{ v: number; w: number }>): number => {
    const eps = 1e-12;
    let sumW = 0;
    let acc = 0;
    for (const p of pairs) {
      const w = typeof p.w === 'number' && Number.isFinite(p.w) ? p.w : 0;
      if (w <= 0) continue;
      const v = clamp01(typeof p.v === 'number' && Number.isFinite(p.v) ? p.v : 0);
      sumW += w;
      acc += w * Math.log(v + eps);
    }
    if (sumW <= 0) return 0;
    return clamp01(Math.exp(acc / sumW));
  };

  const baseFactor = typeof oneEl.factor === 'number' && Number.isFinite(oneEl.factor) ? clamp01(oneEl.factor) : 0;
  const domEl: Element = (oneEl.element as Element) ?? 'WOOD';
  const dmEl: Element = (facts as any)?.dayMaster?.element ?? domEl;
  const dayMatch = domEl === dmEl;
  const strengthIndex = typeof (facts as any)?.strength?.index === 'number' ? (facts as any).strength.index : 0;

  const monthEl: Element = (facts as any)?.month?.element ?? domEl;
  const lingScore = seasonSupportScore(monthEl, domEl);
  const ling01 = clamp01((lingScore + 1) / 2);
  const fLing = clamp01((ling01 - lingThreshold) / Math.max(1e-9, 1 - lingThreshold));

  // --- 得地/得势 approximations for dominant element
  let diNorm = 0;
  let shiNormed = 0;

  const dd = (facts as any)?.strength?.details?.delingdiShi;
  if (dd && typeof dd === 'object' && dayMatch) {
    if (typeof dd?.deDi?.normalized === 'number' && Number.isFinite(dd.deDi.normalized)) diNorm = clamp01(dd.deDi.normalized);
    if (typeof dd?.deShi?.normalized === 'number' && Number.isFinite(dd.deShi.normalized)) shiNormed = clamp01(dd.deShi.normalized);
  } else {
    const hiddenStemPolicy = (config.weights as any)?.hiddenStems ?? {};
    const brs: Array<{ branch: BranchIdx; w: number }> = [
      { branch: (facts as any).chart.pillars.year.branch, w: branchWeights.year },
      { branch: (facts as any).chart.pillars.month.branch, w: branchWeights.month },
      { branch: (facts as any).chart.pillars.day.branch, w: branchWeights.day },
      { branch: (facts as any).chart.pillars.hour.branch, w: branchWeights.hour },
    ];

    let same = 0;
    let res = 0;
    for (const b0 of brs) {
      for (const h of hiddenStemsOfBranch(b0.branch, hiddenStemPolicy ?? {})) {
        const el = stemElement(h.stem);
        if (el === domEl) same += h.weight * b0.w;
        if (generates(el, domEl)) res += h.weight * b0.w;
      }
    }
    const diScore = Math.max(0, same + rootResAlpha * res);
    diNorm = clamp01(diScore / Math.max(1e-9, rootNorm));

    const stemsOther: Array<{ stem: StemIdx; w: number }> = [
      { stem: (facts as any).chart.pillars.year.stem, w: positionWeights.year },
      { stem: (facts as any).chart.pillars.month.stem, w: positionWeights.month },
      { stem: (facts as any).chart.pillars.hour.stem, w: positionWeights.hour },
    ];
    let shiSame = 0;
    let shiRes = 0;
    for (const s0 of stemsOther) {
      const el = stemElement(s0.stem);
      if (el === domEl) shiSame += s0.w;
      if (generates(el, domEl)) shiRes += s0.w;
    }
    const shiScore = Math.max(0, shiSame + shiResAlpha * shiRes);
    shiNormed = clamp01(shiScore / Math.max(1e-9, shiNorm));
  }

  const fDi = clamp01((diNorm - diThreshold) / Math.max(1e-9, 1 - diThreshold));
  const fShi = clamp01((shiNormed - shiThreshold) / Math.max(1e-9, 1 - shiThreshold));

  const q = (facts as any)?.month?.gyeok?.quality ?? {};
  const qMult = typeof q.multiplier === 'number' && Number.isFinite(q.multiplier) ? clamp01(q.multiplier) : 1;
  const qClarity = typeof q.clarity === 'number' && Number.isFinite(q.clarity) ? clamp01(q.clarity) : 1;
  const qIntegrity = typeof q.integrity === 'number' && Number.isFinite(q.integrity) ? clamp01(q.integrity) : 1;
  const qBroken = q.broken === true;
  const qMixed = q.mixed === true;
  const qZhuo = q.qingZhuo === 'ZHUO';

  const fQuality = clamp01((qMult - qualityThreshold) / Math.max(1e-9, 1 - qualityThreshold));

  const harmEl = controllerOf(domEl);
  const harmShare = typeof (facts as any)?.elements?.normalized?.[harmEl] === 'number' ? (facts as any).elements.normalized[harmEl] : 0;
  const fNoHarm = harmThreshold <= 0 ? 1 : clamp01((harmThreshold - harmShare) / Math.max(1e-9, harmThreshold));

  const fStrong = clamp01((strengthIndex - strongThreshold) / Math.max(1e-9, 1 - strongThreshold));
  const fMatch = dayMatch ? 1 : clamp01(dayNotMatchPenalty);

  let conditionFactor = geomMean01([
    { v: fMatch, w: (weights as any).match ?? 0 },
    { v: fLing, w: (weights as any).ling ?? 0 },
    { v: fDi, w: (weights as any).di ?? 0 },
    { v: fShi, w: (weights as any).shi ?? 0 },
    { v: fQuality, w: (weights as any).quality ?? 0 },
    { v: fStrong, w: (weights as any).strong ?? 0 },
    { v: fNoHarm, w: (weights as any).noHarm ?? 0 },
  ]);

  const reasons: string[] = [];
  if (requireDayMasterMatch && !dayMatch) reasons.push('DAY_MASTER_NOT_MATCH');
  if (qBroken) reasons.push('MONTH_GYEOK_BROKEN');
  if (qMixed) reasons.push('MONTH_GYEOK_MIXED');
  if (qZhuo) reasons.push('MONTH_GYEOK_ZHUO');
  if (fStrong <= 0.001) reasons.push('NOT_STRONG');
  if (fLing <= 0.001) reasons.push('NOT_IN_SEASON');

  // Hard gate: require day-master element == dominant element (classic 专旺/从旺 discussions), unless disabled.
  if (requireDayMasterMatch && !dayMatch) {
    conditionFactor = 0;
  }

  // Extra penalties driven by month-gyeok quality flags.
  if (qBroken) conditionFactor *= clamp01(1 - penalties.broken);
  if (qMixed) conditionFactor *= clamp01(1 - penalties.mixed);
  if (qZhuo) conditionFactor *= clamp01(1 - penalties.zhuo);

  const finalCondition = clamp01(conditionFactor);
  const finalFactor = clamp01(baseFactor * finalCondition);

  (oneEl as any).zhuanwangConditionFactor = finalCondition;
  (oneEl as any).zhuanwangFactor = finalFactor;
  (oneEl as any).zhuanwangDetails = {
    enabled: true,
    requireDayMasterMatch,
    weights: { ...(weights as any) },
    thresholds: {
      lingThreshold,
      diThreshold,
      shiThreshold,
      qualityThreshold,
      strongThreshold,
      harmThreshold,
      rootNorm,
      shiNorm,
      rootResAlpha,
      shiResAlpha,
      dayNotMatchPenalty,
    },
    signals: {
      baseFactor,
      zhuanwangCondition: finalCondition,
      zhuanwangFactor: finalFactor,
      dominantElementShare: typeof (facts as any)?.elements?.normalized?.[domEl] === 'number' ? (facts as any).elements.normalized[domEl] : 0,
      strengthIndex,
      dayMatch: dayMatch ? 1 : 0,
      lingScore,
      ling01,
      diNorm,
      shiNorm: shiNormed,
      monthQuality: qMult,
      monthClarity: qClarity,
      monthIntegrity: qIntegrity,
      harmElementShare: harmShare,
      fMatch,
      fLing,
      fDi,
      fShi,
      fQuality,
      fStrong,
      fNoHarm,
    },
    flags: {
      dayMasterMatch: dayMatch,
      monthBroken: qBroken,
      monthMixed: qMixed,
      monthZhuo: qZhuo,
    },
    reasons,
  };
}

function applyFollowPattern(config: EngineConfig, facts: RuleFacts): void {
  const pol0 =
    (config.strategies as any)?.patterns?.follow ??
    (config.strategies as any)?.patterns?.jonggyeok ??
    (config.strategies as any)?.follow ??
    {};

  // Disabled by default to preserve existing behavior unless explicitly enabled.
  const enabled = (pol0 as any)?.enabled === true;
  if (!enabled) return;

  const num = (x: unknown, fallback: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);

  // Optional: allow patterns.follow to inherit thresholds from yongshin.methodSelector.follow,
  // so presets/users don't need to duplicate the same knobs in two places.
  const yFollow: any =
    (config.strategies as any)?.yongshin?.methodSelector?.follow ?? (config.strategies as any)?.yongshin?.follow ?? {};

  const weakThreshold = num((pol0 as any).weakThreshold, num(yFollow?.weakThreshold, -0.78));
  const strongThreshold = num((pol0 as any).strongThreshold, num(yFollow?.strongThreshold, Math.abs(weakThreshold)));
  const minDom = num((pol0 as any).minDominanceRatio, num(yFollow?.minDominanceRatio, 2.2));

  // Optional: allow one-element concentration to boost follow confidence.
  // We also look at yongshin.methodSelector.follow.oneElementBoost for convenience.
  const oneElementBoost = num((pol0 as any).oneElementBoost, num(yFollow?.oneElementBoost, 0));

  const s = facts.strength.index;
  const support = facts.strength.support;
  const pressure = facts.strength.pressure;
  const eps = 1e-9;

  // --- Base follow potentials (same math as yongshin.followPotentialFromStrength)
  const weakFactor = s < weakThreshold ? clamp01((weakThreshold - s) / Math.max(eps, weakThreshold + 1)) : 0;
  const weakDomRatio = pressure / Math.max(eps, support);
  const weakDomFactor = clamp01((weakDomRatio - minDom) / Math.max(eps, minDom));
  const weakPotential = clamp01(weakFactor * weakDomFactor);

  const strongFactor = s > strongThreshold ? clamp01((s - strongThreshold) / Math.max(eps, 1 - strongThreshold)) : 0;
  const strongDomRatio = support / Math.max(eps, pressure);
  const strongDomFactor = clamp01((strongDomRatio - minDom) / Math.max(eps, minDom));
  const strongPotential = clamp01(strongFactor * strongDomFactor);

  let mode: 'PRESSURE' | 'SUPPORT' | 'NONE' = 'NONE';
  let dominanceRatio = 0;
  let potentialRaw = 0;

  if (strongPotential > weakPotential) {
    potentialRaw = strongPotential;
    mode = strongPotential > 0 ? 'SUPPORT' : 'NONE';
    dominanceRatio = strongDomRatio;
  } else {
    potentialRaw = weakPotential;
    mode = weakPotential > 0 ? 'PRESSURE' : 'NONE';
    dominanceRatio = weakDomRatio;
  }

  const comps = facts.strength.components;
  const dominantSupportRole: DayMasterRole = comps.companions >= comps.resources ? 'COMPANION' : 'RESOURCE';
  const dominantPressureRole: DayMasterRole = (() => {
    const o = comps.outputs;
    const w = comps.wealth;
    const of = comps.officers;
    let dom: DayMasterRole = 'OUTPUT';
    let best = o;
    if (w >= best) {
      best = w;
      dom = 'WEALTH';
    }
    if (of >= best) {
      best = of;
      dom = 'OFFICER';
    }
    return dom;
  })();

  const dominantRole: DayMasterRole = mode === 'SUPPORT' ? dominantSupportRole : mode === 'PRESSURE' ? dominantPressureRole : 'COMPANION';

  const elementOfRole = (role: DayMasterRole): Element => {
    for (const e of ELEMENT_ORDER) {
      if ((facts.dayMasterRoleByElement as any)[e] === role) return e;
    }
    return facts.dayMaster.element;
  };

  const dominantElement = elementOfRole(dominantRole);

  // One-element signal selection:
  // - SUPPORT mode tends to align with 专旺/从旺 → prefer zhuanwangFactor if available
  // - PRESSURE mode uses raw oneElement.factor (distribution concentration)
  const oneEl: any = (facts as any).patterns?.elements?.oneElement;
  const oneElRaw = typeof oneEl?.factor === 'number' && Number.isFinite(oneEl.factor) ? oneEl.factor : 0;
  const oneElZhuanwang =
    typeof oneEl?.zhuanwangFactor === 'number' && Number.isFinite(oneEl.zhuanwangFactor) ? oneEl.zhuanwangFactor : 0;
  const oneElementFactor = clamp01(mode === 'SUPPORT' && oneElZhuanwang > 0 ? oneElZhuanwang : oneElRaw);

  const potential = clamp01(potentialRaw * (1 + oneElementFactor * oneElementBoost));

  // --- 종격(从格) 정밀 조건팩(연속값)
  const pack0 = ((pol0 as any).jonggyeok ?? (pol0 as any).conditions ?? (pol0 as any).conditionPack ?? {}) as any;
  const packEnabled = pack0?.enabled === true;

  let conditionFactor: number = 1;
  let finalFactor: number = potential;
  let details: any = undefined;

  if (packEnabled) {
    const applyTo: 'BOTH' | 'PRESSURE' | 'SUPPORT' =
      pack0.applyTo === 'PRESSURE' || pack0.applyTo === 'SUPPORT' ? pack0.applyTo : 'BOTH';
    const applied = applyTo === 'BOTH' || applyTo === mode;

    if (!applied) {
      // Pack enabled but does not apply to this mode.
      conditionFactor = 1;
      finalFactor = potential;
      details = {
        enabled: true,
        applyTo,
        weights: {},
        thresholds: {},
        signals: { applied: 0 },
        flags: { applied: false },
        reasons: ['NOT_APPLIED'],
      };
    } else if (mode === 'NONE') {
      conditionFactor = 0;
      finalFactor = 0;
      details = {
        enabled: true,
        applyTo,
        weights: {},
        thresholds: {},
        signals: { applied: 1 },
        flags: { applied: true },
        reasons: ['MODE_NONE'],
      };
    } else {
      const thr = (pack0.thresholds ?? {}) as any;
      const wRaw = (pack0.weights ?? {}) as any;
      const pRaw = (pack0.penalties ?? {}) as any;

      const shareThreshold = num(thr.share, num(pack0.shareThreshold, 0.28));
      const seasonThreshold = num(thr.season, num(pack0.seasonThreshold, 0.45));
      const rootThreshold = num(thr.root, num(pack0.rootThreshold, 0.35));
      const purityThreshold = num(thr.purity, num(pack0.purityThreshold, 0.55));
      const qualityThreshold = num(thr.quality, num(pack0.qualityThreshold, 0.55));
      const counterThreshold = num(thr.counter, num(pack0.counterThreshold, 0.18));
      const oppositionThreshold = num(thr.opposition, num(pack0.oppositionThreshold, 0.4));

      const rootNorm = num(thr.rootNorm, num(pack0.rootNorm, 2.2));
      const rootResAlpha = num(thr.rootResAlpha, num(pack0.rootResAlpha, 0.6));
      const rootWeights = {
        month: num((thr.rootWeights ?? pack0.rootWeights)?.month, 0.65),
        day: num((thr.rootWeights ?? pack0.rootWeights)?.day, 0.35),
      };

      const weights0 = {
        share: num(wRaw.share, 0.15),
        season: num(wRaw.season, 0.15),
        root: num(wRaw.root, 0.1),
        purity: num(wRaw.purity, 0.15),
        quality: num(wRaw.quality, 0.15),
        noCounter: num(wRaw.noCounter, 0.15),
        lowOpp: num(wRaw.lowOpp, 0.15),
      };
      const wSum = Object.values(weights0).reduce((a, b) => a + b, 0);
      const weights = wSum > 0 ? Object.fromEntries(Object.entries(weights0).map(([k, v]) => [k, v / wSum])) : weights0;

      const penalties = {
        broken: num(pRaw.broken, 0.25),
        mixed: num(pRaw.mixed, 0.1),
        zhuo: num(pRaw.zhuo, 0.08),
      };

      const q = facts.month.gyeok.quality;
      const qMult = typeof q?.multiplier === 'number' && Number.isFinite(q.multiplier) ? q.multiplier : 0;
      const qBroken = q?.broken === true;
      const qMixed = q?.mixed === true;
      const qZhuo = q?.qingZhuo === 'ZHUO';

      const controllerOf = (e: Element): Element => {
        if (e === 'WOOD') return 'METAL';
        if (e === 'FIRE') return 'WATER';
        if (e === 'EARTH') return 'WOOD';
        if (e === 'METAL') return 'FIRE';
        return 'EARTH';
      };

      const domShare = typeof (facts as any)?.elements?.normalized?.[dominantElement] === 'number' ? (facts as any).elements.normalized[dominantElement] : 0;
      const fShare = clamp01((domShare - shareThreshold) / Math.max(1e-9, 1 - shareThreshold));

      const monthEl = facts.month.element;
      const lingScore = seasonSupportScore(monthEl, dominantElement);
      const ling01 = clamp01((lingScore + 1) / 2);
      const fSeason = clamp01((ling01 - seasonThreshold) / Math.max(1e-9, 1 - seasonThreshold));

      // Root support: hidden stems of month/day branches.
      const hsPolicy = (config.weights as any)?.hiddenStems ?? {};
      const monthB = facts.chart.pillars.month.branch;
      const dayB = facts.chart.pillars.day.branch;
      const hsMonth = hiddenStemsOfBranch(monthB, hsPolicy);
      const hsDay = hiddenStemsOfBranch(dayB, hsPolicy);

      let same = 0;
      let res = 0;
      for (const h of hsMonth) {
        const el = stemElement(h.stem);
        if (el === dominantElement) same += rootWeights.month * h.weight;
        else if (generates(el, dominantElement)) res += rootWeights.month * h.weight;
      }
      for (const h of hsDay) {
        const el = stemElement(h.stem);
        if (el === dominantElement) same += rootWeights.day * h.weight;
        else if (generates(el, dominantElement)) res += rootWeights.day * h.weight;
      }
      const rootScore = same + rootResAlpha * res;
      const root01 = clamp01(rootNorm <= 0 ? 0 : rootScore / rootNorm);
      const fRoot = clamp01((root01 - rootThreshold) / Math.max(1e-9, 1 - rootThreshold));

      // Role purity: how much the dominant role dominates within its group.
      const groupTotal = mode === 'SUPPORT' ? Math.max(1e-9, support) : Math.max(1e-9, pressure);
      const groupBest =
        mode === 'SUPPORT'
          ? Math.max(comps.companions, comps.resources)
          : Math.max(comps.outputs, Math.max(comps.wealth, comps.officers));
      const purity = groupBest / groupTotal;
      const fPurity = clamp01((purity - purityThreshold) / Math.max(1e-9, 1 - purityThreshold));

      // Opposition share (opposite side should be small in a “pure” follow chart).
      const total = Math.max(1e-9, facts.strength.total);
      const oppositionShare = mode === 'SUPPORT' ? pressure / total : support / total;
      const fLowOpp = oppositionThreshold <= 0 ? 1 : clamp01((oppositionThreshold - oppositionShare) / Math.max(1e-9, oppositionThreshold));

      // Counter element (克) should be small.
      const harmEl = controllerOf(dominantElement);
      const harmShare = typeof (facts as any)?.elements?.normalized?.[harmEl] === 'number' ? (facts as any).elements.normalized[harmEl] : 0;
      const fNoCounter = counterThreshold <= 0 ? 1 : clamp01((counterThreshold - harmShare) / Math.max(1e-9, counterThreshold));

      // Month-gyeok quality is treated as stability.
      const fQuality = clamp01((qMult - qualityThreshold) / Math.max(1e-9, 1 - qualityThreshold));

      const geomMean01 = (parts: Array<{ v: number; w: number }>): number => {
        const eps = 1e-9;
        let sum = 0;
        let acc = 0;
        for (const p of parts) {
          if (!(p.w > 0)) continue;
          sum += p.w;
          acc += p.w * Math.log(Math.max(eps, clamp01(p.v)));
        }
        if (sum <= 0) return 0;
        return clamp01(Math.exp(acc / sum));
      };

      let cf = geomMean01([
        { v: fShare, w: (weights as any).share ?? 0 },
        { v: fSeason, w: (weights as any).season ?? 0 },
        { v: fRoot, w: (weights as any).root ?? 0 },
        { v: fPurity, w: (weights as any).purity ?? 0 },
        { v: fQuality, w: (weights as any).quality ?? 0 },
        { v: fNoCounter, w: (weights as any).noCounter ?? 0 },
        { v: fLowOpp, w: (weights as any).lowOpp ?? 0 },
      ]);

      // Month quality penalties (破格/杂格)
      if (qBroken) cf = clamp01(cf * (1 - penalties.broken));
      if (qMixed) cf = clamp01(cf * (1 - penalties.mixed));
      if (qZhuo) cf = clamp01(cf * (1 - penalties.zhuo));

      const reasons: string[] = [];
      if (domShare < shareThreshold) reasons.push('DOM_SHARE_LOW');
      if (ling01 < seasonThreshold) reasons.push('SEASON_NOT_SUPPORT_DOM');
      if (root01 < rootThreshold) reasons.push('ROOT_WEAK');
      if (purity < purityThreshold) reasons.push('ROLE_MIXED');
      if (oppositionShare > oppositionThreshold) reasons.push('OPPOSITION_HIGH');
      if (harmShare > counterThreshold) reasons.push('COUNTER_HIGH');
      if (qBroken) reasons.push('MONTH_GYEOK_BROKEN');
      if (qMixed) reasons.push('MONTH_GYEOK_MIXED');
      if (qZhuo) reasons.push('MONTH_GYEOK_ZHUO');

      conditionFactor = cf;
      finalFactor = clamp01(potential * cf);

      details = {
        enabled: true,
        applyTo,
        weights: { ...(weights as any) },
        thresholds: {
          shareThreshold,
          seasonThreshold,
          rootThreshold,
          purityThreshold,
          qualityThreshold,
          counterThreshold,
          oppositionThreshold,
          rootNorm,
          rootResAlpha,
          rootWeights,
        },
        signals: {
          applied: 1,
          basePotential: potentialRaw,
          potentialBoosted: potential,
          jonggyeokCondition: cf,
          jonggyeokFactor: finalFactor,
          dominantElementShare: domShare,
          strengthIndex: s,
          dominanceRatio,
          modeSupport: mode === 'SUPPORT' ? 1 : 0,
          monthSupportScore: lingScore,
          monthSupport01: ling01,
          rootScore,
          root01,
          rolePurity: purity,
          oppositionShare,
          harmElementShare: harmShare,
          monthQuality: qMult,
          fShare,
          fSeason,
          fRoot,
          fPurity,
          fQuality,
          fNoCounter,
          fLowOpp,
        },
        flags: {
          applied: true,
          monthBroken: qBroken,
          monthMixed: qMixed,
          monthZhuo: qZhuo,
        },
        reasons,
      };
    }
  }

  // Follow subtype classification (从财/从官/从杀/从儿/从印/从比) via dominantRole + ten-god split.
  const tenGodScores: any = (facts as any).tenGodScores ?? {};
  const pairForRole = (role: DayMasterRole): [TenGod, TenGod] => {
    switch (role) {
      case 'COMPANION':
        return ['BI_GYEON', 'GEOB_JAE'];
      case 'RESOURCE':
        return ['JEONG_IN', 'PYEON_IN'];
      case 'OUTPUT':
        return ['SIK_SHIN', 'SANG_GWAN'];
      case 'WEALTH':
        return ['JEONG_JAE', 'PYEON_JAE'];
      case 'OFFICER':
        return ['JEONG_GWAN', 'PYEON_GWAN'];
      default:
        return ['BI_GYEON', 'GEOB_JAE'];
    }
  };

  const [tgA, tgB] = pairForRole(dominantRole);
  const scA = typeof tenGodScores[tgA] === 'number' && Number.isFinite(tenGodScores[tgA]) ? (tenGodScores[tgA] as number) : 0;
  const scB = typeof tenGodScores[tgB] === 'number' && Number.isFinite(tenGodScores[tgB]) ? (tenGodScores[tgB] as number) : 0;
  const totalTg = scA + scB;
  const primary = scA >= scB ? tgA : tgB;
  const secondary = scA >= scB ? tgB : tgA;
  const primaryScore = scA >= scB ? scA : scB;
  const secondaryScore = scA >= scB ? scB : scA;
  const primaryShare = totalTg > 0 ? primaryScore / totalTg : 0.5;
  const subtypeConfidence = totalTg > 0 ? clamp01(Math.abs(scA - scB) / totalTg) : 0;

  const followTenGod: TenGod | undefined = mode !== 'NONE' && potentialRaw > 0 ? primary : undefined;

  let followType: FollowType = 'NONE';
  if (mode !== 'NONE' && potentialRaw > 0) {
    if (dominantRole === 'WEALTH') followType = 'CONG_CAI';
    else if (dominantRole === 'OUTPUT') followType = 'CONG_ER';
    else if (dominantRole === 'RESOURCE') followType = 'CONG_YIN';
    else if (dominantRole === 'COMPANION') followType = 'CONG_BI';
    else if (dominantRole === 'OFFICER') {
      followType = primary === 'PYEON_GWAN' ? 'CONG_SHA' : 'CONG_GUAN';
    }
  }

  const followTenGodSplit =
    mode !== 'NONE' && potentialRaw > 0
      ? {
          primary,
          secondary,
          primaryScore,
          secondaryScore,
          total: totalTg,
          primaryShare,
          confidence: subtypeConfidence,
        }
      : undefined;


  // Optional: type-aware penalties (v0.33.0+)
  // Refine jonggyeokConditionFactor by considering:
  // - ten-god subtype mixing (e.g., 官杀混杂, 财混杂)
  // - direct counter ten-gods (e.g., 伤官见官, 比劫夺财)
  if (packEnabled && details && (details as any).flags?.applied === true && mode !== 'NONE' && potentialRaw > 0 && followType !== 'NONE') {
    const ta0: any = (pack0 as any)?.typeAware ?? (pack0 as any)?.type ?? {};
    const taEnabled = ta0?.enabled === true;

    if (taEnabled) {
      const thrTA: any = ta0.thresholds ?? {};
      const wTA: any = ta0.weights ?? {};

      const subtypeThrBase = num(thrTA.subtypeConfidence, 0.25);
      const directThrBase = num(thrTA.directCounterShare ?? thrTA.directCounter, 0.12);

      const perTA: any = (thrTA.perType ?? thrTA.byType ?? {})[followType] ?? {};
      const subtypeThr = num(perTA.subtypeConfidence, subtypeThrBase);
      const directThr = num(perTA.directCounterShare ?? perTA.directCounter, directThrBase);

      const wSubtype = num(wTA.subtype, 0.12);
      const wDirect = num(wTA.directCounter, 0.1);

      const fSubtype = subtypeThr <= 0 ? 1 : clamp01((subtypeConfidence - subtypeThr) / Math.max(1e-9, 1 - subtypeThr));

      const totalAll = (Object.values(tenGodScores) as any[]).reduce((a: number, b: any) => a + (typeof b === 'number' && Number.isFinite(b) ? b : 0), 0 as number);
      const shareOf = (tg: TenGod): number => (totalAll > 0 ? num((tenGodScores as any)[tg], 0) / totalAll : 0);

      const officerCounterWeights: any = ta0.officerCounterWeights ?? ta0.counters?.officer ?? {};
      const wShang = num(officerCounterWeights.SANG_GWAN, 1.0);
      const wSik = num(officerCounterWeights.SIK_SHIN, 0.6);

      const counters: Array<{ tg: TenGod; w: number }> = (() => {
        switch (followType) {
          case 'CONG_CAI':
            return [
              { tg: 'BI_GYEON', w: 1 },
              { tg: 'GEOB_JAE', w: 1 },
            ];
          case 'CONG_ER':
            return [
              { tg: 'JEONG_IN', w: 1 },
              { tg: 'PYEON_IN', w: 1 },
            ];
          case 'CONG_YIN':
            return [
              { tg: 'JEONG_JAE', w: 1 },
              { tg: 'PYEON_JAE', w: 1 },
            ];
          case 'CONG_BI':
            return [
              { tg: 'JEONG_GWAN', w: 1 },
              { tg: 'PYEON_GWAN', w: 1 },
            ];
          case 'CONG_GUAN':
          case 'CONG_SHA':
            return [
              { tg: 'SANG_GWAN', w: wShang },
              { tg: 'SIK_SHIN', w: wSik },
            ];
          default:
            return [];
        }
      })();

      let directCounterShare = 0;
      let wSumCounter = 0;
      for (const c of counters) {
        if (!(c.w > 0)) continue;
        directCounterShare += c.w * shareOf(c.tg);
        wSumCounter += c.w;
      }
      directCounterShare = clamp01(wSumCounter > 0 ? directCounterShare / wSumCounter : 0);

      const fNoDirectCounter = directThr <= 0 ? 1 : clamp01((directThr - directCounterShare) / Math.max(1e-9, directThr));

      const sumW = (wSubtype > 0 ? wSubtype : 0) + (wDirect > 0 ? wDirect : 0);
      const epsGM = 1e-12;
      const typeFactor =
        sumW <= 0
          ? 1
          : clamp01(
              Math.exp(
                ((wSubtype > 0 ? wSubtype : 0) * Math.log(Math.max(epsGM, fSubtype)) +
                  (wDirect > 0 ? wDirect : 0) * Math.log(Math.max(epsGM, fNoDirectCounter))) /
                  sumW,
              ),
            );

      const baseCondition = conditionFactor;
      const baseFactor = finalFactor;

      conditionFactor = clamp01(conditionFactor * typeFactor);
      finalFactor = clamp01(potential * conditionFactor);

      // Augment debug payload
      const det: any = details;
      det.weights = { ...(det.weights ?? {}), subtype: wSubtype, directCounter: wDirect };
      det.thresholds = { ...(det.thresholds ?? {}), subtypeConfidence: subtypeThr, directCounterShare: directThr };
      det.signals = {
        ...(det.signals ?? {}),
        jonggyeokConditionBase: typeof det.signals?.jonggyeokCondition === 'number' ? det.signals.jonggyeokCondition : baseCondition,
        jonggyeokFactorBase: typeof det.signals?.jonggyeokFactor === 'number' ? det.signals.jonggyeokFactor : baseFactor,
        subtypeConfidence,
        fSubtype,
        directCounterShare,
        fNoDirectCounter,
        typeAwareFactor: typeFactor,
        jonggyeokCondition: conditionFactor,
        jonggyeokFactor: finalFactor,
      };
      det.flags = {
        ...(det.flags ?? {}),
        typeAwareApplied: true,
        tenGodMixed: subtypeConfidence < subtypeThr,
        directCounterHigh: directCounterShare > directThr,
      };
      det.reasons = Array.isArray(det.reasons) ? det.reasons.slice() : [];
      if (subtypeConfidence < subtypeThr) det.reasons.push('TEN_GOD_MIXED');
      if (directCounterShare > directThr) det.reasons.push('DIRECT_COUNTER_HIGH');
    }
  }

  (facts.patterns as any).follow = {
    enabled: true,
    potentialRaw,
    potential,
    mode,
    dominanceRatio,
    dominantRole,
    dominantElement,
    followType,
    followTenGod,
    followTenGodSplit,
    oneElementFactor,
    oneElementBoost,
    jonggyeokConditionFactor: conditionFactor,
    jonggyeokFactor: finalFactor,
    jonggyeokDetails: details,
  };
}

function computeTransformations(
  config: EngineConfig,
  args: {
    pillars: RuleFacts['chart']['pillars'];
    stems: StemIdx[];
    normalized: Record<Element, number>;
    hiddenStemPolicy: any;
    damagedBranches: BranchIdx[];
    byType: Partial<Record<RelationType, BranchIdx[][]>>;

    /** Optional: month-gyeok quality signal used by huaqi(化气格) condition pack. */
    monthGyeokQuality?: RuleFacts['month']['gyeok']['quality'];
  },
): RuleFacts['patterns']['transformations'] {
  const pol = (config.strategies as any)?.patterns?.transformations ?? {};
  const enabled = pol?.enabled !== false;

  const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

  const threshold = num(pol.threshold, 0.55);

  // Blended support weights (optionally normalized)
  const weightShare = num(pol.weightShare, 0.6);
  const weightSeason = num(pol.weightSeason, 0.4);
  const weightRoot = num(pol.weightRoot, 0.1);
  const weightPosition = num(pol.weightPosition, 0.1);
  const normalizeWeights = pol.normalizeWeights !== false;

  const posWRaw = (pol.positionWeights ?? {}) as any;
  const posW0 = {
    year: num(posWRaw.year, 0.15),
    month: num(posWRaw.month, 0.35),
    day: num(posWRaw.day, 0.35),
    hour: num(posWRaw.hour, 0.15),
  };
  const posWSum = posW0.year + posW0.month + posW0.day + posW0.hour;
  const positionWeights =
    posWSum > 0
      ? {
          year: posW0.year / posWSum,
          month: posW0.month / posWSum,
          day: posW0.day / posWSum,
          hour: posW0.hour / posWSum,
        }
      : { year: 0.25, month: 0.25, day: 0.25, hour: 0.25 };

  const rootWRaw = (pol.rootWeights ?? {}) as any;
  const rootW0 = { month: num(rootWRaw.month, 0.65), day: num(rootWRaw.day, 0.35) };
  const rootWSum = rootW0.month + rootW0.day;
  const rootWeights = rootWSum > 0 ? { month: rootW0.month / rootWSum, day: rootW0.day / rootWSum } : { month: 0.5, day: 0.5 };

  // “破合” attenuation (continuous) — stem clashes + branch damage relations
  const breakPol = (pol.break ?? {}) as any;
  const breakEnabled = breakPol?.enabled !== false;
  const breakWRaw = (breakPol.weights ?? {}) as any;
  const breakWeights = {
    stemClash: num(breakWRaw.stemClash, 0.12),
    branchDamage: num(breakWRaw.branchDamage, 0.08),
    interBranchDamage: num(breakWRaw.interBranchDamage, 0.08),
  };

  // Optional: competition/ambiguity attenuation (2nd-best candidate close to best → lower confidence)
  const compPol = (pol.competition ?? {}) as any;
  const compEnabled = compPol?.enabled === true;
  const compStartRatio = num(compPol.startRatio, 0.75);
  const compMaxPenalty = num(compPol.maxPenalty, 0.4);

  // Optional: 化气格(화기격) condition pack.
  // Motivation: classic texts often require month-qi(월령), adjacency, and “no-break/no-harm” constraints.
  // We keep this as a *continuous* factor in [0,1], so schools can tune hard/soft gates.
  const huaqiPol = (pol.huaqi ?? {}) as any;
  const huaqiEnabled = huaqiPol?.enabled === true;
  const huaqiRequireDayMasterInvolved = huaqiPol?.requireDayMasterInvolved !== false;
  const huaqiDayNotInvolvedPenalty = num(huaqiPol.dayNotInvolvedPenalty, huaqiRequireDayMasterInvolved ? 0 : 0.15);

  const huaqiShareThreshold = num(huaqiPol.shareThreshold, 0.45);
  const huaqiQualityThreshold = num(huaqiPol.qualityThreshold, 0.55);
  const huaqiRootThreshold = num(huaqiPol.rootThreshold, 0.35);
  const huaqiHarmThreshold = num(huaqiPol.harmThreshold, 0.18);
  const huaqiOrigWeakThreshold = num(huaqiPol.origWeakThreshold, 0.28);
  const huaqiDistanceExponent = num(huaqiPol.distanceExponent, 2.5);

  const hwRaw = (huaqiPol.weights ?? {}) as any;
  const huaqiWeights0 = {
    share: num(hwRaw.share, 0.2),
    season: num(hwRaw.season, 0.15),
    root: num(hwRaw.root, 0.1),
    quality: num(hwRaw.quality, 0.2),
    distance: num(hwRaw.distance, 0.15),
    day: num(hwRaw.day, 0.1),
    noHarm: num(hwRaw.noHarm, 0.1),
    origWeak: num(hwRaw.origWeak, 0.0),
  };
  const huaqiWeightSum = Object.values(huaqiWeights0).reduce((a, b) => a + b, 0);
  const huaqiWeights = huaqiWeightSum > 0
    ? Object.fromEntries(Object.entries(huaqiWeights0).map(([k, v]) => [k, v / huaqiWeightSum]))
    : { ...huaqiWeights0 };

  const hpRaw = (huaqiPol.penalties ?? {}) as any;
  const huaqiPenalties = {
    broken: num(hpRaw.broken, 0.25),
    mixed: num(hpRaw.mixed, 0.1),
    zhuo: num(hpRaw.zhuo, 0.08),
  };

  const controllerOf = (e: Element): Element => {
    switch (e) {
      case 'WOOD':
        return 'METAL';
      case 'FIRE':
        return 'WATER';
      case 'EARTH':
        return 'WOOD';
      case 'METAL':
        return 'FIRE';
      case 'WATER':
        return 'EARTH';
    }
  };

  const geomMean01 = (pairs: Array<{ v: number; w: number }>): number => {
    const eps = 1e-12;
    let sumW = 0;
    let acc = 0;
    for (const p of pairs) {
      const w = typeof p.w === 'number' && Number.isFinite(p.w) ? p.w : 0;
      if (w <= 0) continue;
      const v = clamp01(typeof p.v === 'number' && Number.isFinite(p.v) ? p.v : 0);
      sumW += w;
      acc += w * Math.log(v + eps);
    }
    if (sumW <= 0) return 0;
    return clamp01(Math.exp(acc / sumW));
  };

  const { pillars, stems, normalized, hiddenStemPolicy, damagedBranches, byType } = args;

  const monthEl = branchElement(pillars.month.branch);

  // Count stems
  const cnt: Record<number, number> = {};
  for (const s of stems) cnt[s] = (cnt[s] ?? 0) + 1;

  const pairs: Array<{ a: StemIdx; b: StemIdx; result: Element; pair: string }> = [
    { a: 0, b: 5, result: 'EARTH', pair: '甲己' },
    { a: 1, b: 6, result: 'METAL', pair: '乙庚' },
    { a: 2, b: 7, result: 'WATER', pair: '丙辛' },
    { a: 3, b: 8, result: 'WOOD', pair: '丁壬' },
    { a: 4, b: 9, result: 'FIRE', pair: '戊癸' },
  ];

  const clashPartner = (s: StemIdx): StemIdx | null => {
    // 天干冲(대표 4쌍): 甲庚, 乙辛, 丙壬, 丁癸
    if (s === 0) return 6;
    if (s === 6) return 0;
    if (s === 1) return 7;
    if (s === 7) return 1;
    if (s === 2) return 8;
    if (s === 8) return 2;
    if (s === 3) return 9;
    if (s === 9) return 3;
    return null;
  };

  const stemSet = new Set<number>(stems as any);
  const damagedSet = new Set<number>((damagedBranches ?? []) as any);

  const pillarList: Array<{ idx: number; name: 'year' | 'month' | 'day' | 'hour'; stem: StemIdx; branch: BranchIdx; w: number }> = [
    { idx: 0, name: 'year', stem: pillars.year.stem, branch: pillars.year.branch, w: positionWeights.year },
    { idx: 1, name: 'month', stem: pillars.month.stem, branch: pillars.month.branch, w: positionWeights.month },
    { idx: 2, name: 'day', stem: pillars.day.stem, branch: pillars.day.branch, w: positionWeights.day },
    { idx: 3, name: 'hour', stem: pillars.hour.stem, branch: pillars.hour.branch, w: positionWeights.hour },
  ];

  const rootsForBranch = (branch: BranchIdx, el: Element): number => {
    const hs = hiddenStemsOfBranch(branch, hiddenStemPolicy ?? { scheme: 'standard' });
    let sum = 0;
    for (const h of hs) {
      if (stemElement(h.stem) === el) sum += h.weight;
    }
    return sum;
  };

  const candidates = pairs.map((p) => {
    const ca = cnt[p.a] ?? 0;
    const cb = cnt[p.b] ?? 0;
    const present = ca > 0 && cb > 0;

    const elementShare = normalized[p.result] ?? 0;
    const seasonScore = seasonSupportScore(monthEl, p.result);
    const season01 = clamp01((seasonScore + 1) / 2);

    // Position score: emphasize month/day stems (configurable) while staying math-first.
    let posA = 0;
    let posB = 0;
    const branchesA: BranchIdx[] = [];
    const branchesB: BranchIdx[] = [];
    const idxA: number[] = [];
    const idxB: number[] = [];
    for (const pl of pillarList) {
      if (pl.stem === p.a) {
        posA += pl.w;
        branchesA.push(pl.branch);
        idxA.push(pl.idx);
      }
      if (pl.stem === p.b) {
        posB += pl.w;
        branchesB.push(pl.branch);
        idxB.push(pl.idx);
      }
    }
    posA = clamp01(posA);
    posB = clamp01(posB);
    const posPair = clamp01(Math.sqrt(posA * posB));

    // Stem-distance factor: adjacency(1 step) is strongest; 2-step weaker; 3-step weakest.
    // This is used by the huaqi(化气格) condition pack.
    let distanceFactor = 0;
    for (const ia of idxA) {
      for (const ib of idxB) {
        const d = Math.abs(ia - ib);
        if (d >= 1) distanceFactor = Math.max(distanceFactor, 1 / d);
      }
    }
    distanceFactor = clamp01(distanceFactor);

    // Root score (通根): month/day branch hidden stems supporting the result element.
    const rootMonth = rootsForBranch(pillars.month.branch, p.result);
    const rootDay = rootsForBranch(pillars.day.branch, p.result);
    const rootScore = clamp01(rootWeights.month * rootMonth + rootWeights.day * rootDay);
    const root01 = rootScore;

    const totalW = weightShare + weightSeason + weightRoot + weightPosition;
    const wShare = normalizeWeights && totalW > 0 ? weightShare / totalW : weightShare;
    const wSeason = normalizeWeights && totalW > 0 ? weightSeason / totalW : weightSeason;
    const wRoot = normalizeWeights && totalW > 0 ? weightRoot / totalW : weightRoot;
    const wPos = normalizeWeights && totalW > 0 ? weightPosition / totalW : weightPosition;

    const blended = clamp01(wShare * elementShare + wSeason * season01 + wRoot * root01 + wPos * posPair);

    const rawFactor = enabled && present ? clamp01((blended - threshold) / Math.max(1e-9, 1 - threshold)) : 0;

    // “破合” attenuation: use stem clashes + (damage relations on involved branches) as a continuous penalty.
    let stemClash = 0;
    if (present) {
      const pa = clashPartner(p.a);
      const pb = clashPartner(p.b);
      if (pa != null && stemSet.has(pa as any)) stemClash += 1;
      if (pb != null && stemSet.has(pb as any)) stemClash += 1;
    }

    // Damage on branches that host the pair stems.
    let branchDamage = 0;
    for (const b of branchesA) if (damagedSet.has(b as any)) branchDamage += 1;
    for (const b of branchesB) if (damagedSet.has(b as any)) branchDamage += 1;

    // Damage relations directly between A-branches and B-branches (counts group hits).
    let interBranchDamage = 0;
    const setA = new Set<number>(branchesA as any);
    const setB = new Set<number>(branchesB as any);
    const dmgTypes: RelationType[] = ['CHUNG', 'HAE', 'PA', 'WONJIN', 'HYEONG'];
    for (const t of dmgTypes) {
      const groups = (byType?.[t] ?? []) as any;
      for (const g of groups) {
        const hasA = (g as any[]).some((x) => setA.has(x));
        const hasB = (g as any[]).some((x) => setB.has(x));
        if (hasA && hasB) interBranchDamage += 1;
      }
    }

    const penalty = breakEnabled ? breakWeights.stemClash * stemClash + breakWeights.branchDamage * branchDamage + breakWeights.interBranchDamage * interBranchDamage : 0;
    const breakFactor = breakEnabled ? clamp01(1 / (1 + penalty)) : 1;

    const factor = rawFactor * breakFactor;

    return {
      pair: p.pair,
      stems: { a: p.a, b: p.b },
      resultElement: p.result,
      present,
      counts: { a: ca, b: cb },
      support: {
        elementShare,
        seasonScore,
        season01,
        rootScore,
        root01,
        pos: { a: posA, b: posB, pair: posPair },
        distanceFactor,
        blended,
        weights: { share: wShare, season: wSeason, root: wRoot, position: wPos, total: totalW },
      },
      break: {
        stemClash,
        branchDamage,
        interBranchDamage,
        penalty,
        factor: breakFactor,
        weights: { stemClash: breakWeights.stemClash, branchDamage: breakWeights.branchDamage, interBranchDamage: breakWeights.interBranchDamage },
      },
      rawFactor,
      factor,
    };
  });

  let bestCand: any | undefined;
  let bestFactor = -1;
  let secondFactor = -1;
  for (const c of candidates) {
    const f = typeof c.factor === 'number' ? c.factor : 0;
    if (f > bestFactor) {
      secondFactor = bestFactor;
      bestFactor = f;
      bestCand = c;
    } else if (f > secondFactor) {
      secondFactor = f;
    }
  }

  // Competition/ambiguity penalty (continuous): if 2nd-best is very close to best, confidence drops.
  const ratio = bestFactor > 0 && secondFactor > 0 ? clamp01(secondFactor / bestFactor) : 0;
  const severity = compEnabled ? clamp01((ratio - compStartRatio) / Math.max(1e-9, 1 - compStartRatio)) : 0;
  const competitionFactor = compEnabled ? clamp01(1 - compMaxPenalty * severity) : 1;

  let best:
    | {
        pair: string;
        resultElement: Element;
        factor: number;
        blended: number;
        rawFactor?: number;
        breakFactor?: number;
        secondFactor?: number;
        competitionFactor?: number;
        effectiveFactor?: number;

        huaqiConditionFactor?: number;
        huaqiFactor?: number;
        huaqiDetails?: any;
      }
    | undefined;

  if (bestCand && bestFactor > 0) {
    const effective = bestFactor * competitionFactor;
    best = {
      pair: bestCand.pair,
      resultElement: bestCand.resultElement,
      factor: bestFactor,
      blended: bestCand.support.blended,
      rawFactor: bestCand.rawFactor,
      breakFactor: bestCand.break?.factor,
      secondFactor: secondFactor > 0 ? secondFactor : 0,
      competitionFactor,
      effectiveFactor: effective,
    };

    // --- 化气格(화기격) condition pack: only if enabled.
    if (huaqiEnabled) {
      const monthQ = args.monthGyeokQuality;
      const qMult = typeof monthQ?.multiplier === 'number' && Number.isFinite(monthQ.multiplier) ? monthQ.multiplier : 1;
      const qClarity = typeof monthQ?.clarity === 'number' && Number.isFinite(monthQ.clarity) ? monthQ.clarity : 1;
      const qIntegrity = typeof monthQ?.integrity === 'number' && Number.isFinite(monthQ.integrity) ? monthQ.integrity : 1;
      const qBroken = monthQ?.broken === true;
      const qMixed = monthQ?.mixed === true;
      const qZhuo = monthQ?.qingZhuo === 'ZHUO';

      const dayInvolved = pillars.day.stem === bestCand.stems.a || pillars.day.stem === bestCand.stems.b;

      const share = bestCand.support.elementShare;
      const season01 = bestCand.support.season01;
      const root01 = typeof bestCand.support.root01 === 'number' && Number.isFinite(bestCand.support.root01) ? bestCand.support.root01 : 0;
      const distRaw = typeof bestCand.support.distanceFactor === 'number' && Number.isFinite(bestCand.support.distanceFactor) ? bestCand.support.distanceFactor : 0;
      const dist = clamp01(Math.pow(distRaw, huaqiDistanceExponent));

      const harmEl = controllerOf(bestCand.resultElement);
      const harmShare = typeof (normalized as any)[harmEl] === 'number' ? (normalized as any)[harmEl] : 0;

      const origAEl = stemElement(bestCand.stems.a);
      const origBEl = stemElement(bestCand.stems.b);
      const origShareA = typeof (normalized as any)[origAEl] === 'number' ? (normalized as any)[origAEl] : 0;
      const origShareB = typeof (normalized as any)[origBEl] === 'number' ? (normalized as any)[origBEl] : 0;
      const origShare = 0.5 * (origShareA + origShareB);

      const fShare = clamp01((share - huaqiShareThreshold) / Math.max(1e-9, 1 - huaqiShareThreshold));
      const fQuality = clamp01((qMult - huaqiQualityThreshold) / Math.max(1e-9, 1 - huaqiQualityThreshold));
      const fRoot = clamp01((root01 - huaqiRootThreshold) / Math.max(1e-9, 1 - huaqiRootThreshold));
      const fSeason = season01;
      const fDist = dist;
      const fDay = dayInvolved ? 1 : clamp01(huaqiDayNotInvolvedPenalty);
      const fNoHarm =
        huaqiHarmThreshold <= 0
          ? 1
          : clamp01((huaqiHarmThreshold - harmShare) / Math.max(1e-9, huaqiHarmThreshold));
      const fOrigWeak =
        huaqiOrigWeakThreshold <= 0
          ? 1
          : clamp01((huaqiOrigWeakThreshold - origShare) / Math.max(1e-9, huaqiOrigWeakThreshold));

      // Weighted geometric mean in [0,1] (hard-AND-ish but still continuous).
      let conditionFactor = geomMean01([
        { v: fShare, w: (huaqiWeights as any).share ?? 0 },
        { v: fSeason, w: (huaqiWeights as any).season ?? 0 },
        { v: fRoot, w: (huaqiWeights as any).root ?? 0 },
        { v: fQuality, w: (huaqiWeights as any).quality ?? 0 },
        { v: fDist, w: (huaqiWeights as any).distance ?? 0 },
        { v: fDay, w: (huaqiWeights as any).day ?? 0 },
        { v: fNoHarm, w: (huaqiWeights as any).noHarm ?? 0 },
        { v: fOrigWeak, w: (huaqiWeights as any).origWeak ?? 0 },
      ]);

      const reasons: string[] = [];
      if (huaqiRequireDayMasterInvolved && !dayInvolved) {
        reasons.push('DAY_MASTER_NOT_INVOLVED');
      }
      if (qBroken) reasons.push('MONTH_GYEOK_BROKEN');
      if (qMixed) reasons.push('MONTH_GYEOK_MIXED');
      if (qZhuo) reasons.push('MONTH_GYEOK_ZHUO');

      // Hard gate: require day-master involved (classic huaqi格 definition), unless explicitly disabled.
      if (huaqiRequireDayMasterInvolved && !dayInvolved) {
        conditionFactor = 0;
      }

      // Extra penalties driven by month-gyeok quality flags.
      if (qBroken) conditionFactor *= clamp01(1 - huaqiPenalties.broken);
      if (qMixed) conditionFactor *= clamp01(1 - huaqiPenalties.mixed);
      if (qZhuo) conditionFactor *= clamp01(1 - huaqiPenalties.zhuo);

      (best as any).huaqiConditionFactor = clamp01(conditionFactor);
      (best as any).huaqiFactor = clamp01(effective * conditionFactor);
      (best as any).huaqiDetails = {
        enabled: true,
        requireDayMasterInvolved: huaqiRequireDayMasterInvolved,
        weights: { ...(huaqiWeights as any) },
        thresholds: {
          shareThreshold: huaqiShareThreshold,
          qualityThreshold: huaqiQualityThreshold,
          rootThreshold: huaqiRootThreshold,
          harmThreshold: huaqiHarmThreshold,
          origWeakThreshold: huaqiOrigWeakThreshold,
          distanceExponent: huaqiDistanceExponent,
        },
        signals: {
          effectiveFactor: effective,
          share,
          season01,
          root01,
          distanceRaw: distRaw,
          distance: dist,
          monthQuality: qMult,
          monthClarity: qClarity,
          monthIntegrity: qIntegrity,
          harmElementShare: harmShare,
          origShare,
          fShare,
          fSeason,
          fRoot,
          fQuality,
          fDist,
          fDay,
          fNoHarm,
          fOrigWeak,
        },
        flags: {
          dayInvolved,
          monthBroken: qBroken,
          monthMixed: qMixed,
          monthZhuo: qZhuo,
        },
        reasons,
      };
    }
  }

  return {
    enabled,
    threshold,
    competition: {
      enabled: compEnabled,
      startRatio: compStartRatio,
      maxPenalty: compMaxPenalty,
      ratio,
      factor: competitionFactor,
    },
    weightShare,
    weightSeason,
    weightRoot,
    weightPosition,
    normalizeWeights,
    positionWeights,
    rootWeights,
    break: { enabled: breakEnabled, weights: breakWeights },
    candidates,
    best,
  };
}

const DEFAULT_GYEOK_QUALITY_POLICY = {
  // Damage weights (파격 요인) — count of relations involving 月支
  damageWeights: { CHUNG: 1.0, HAE: 0.7, PA: 0.7, WONJIN: 0.5, HYEONG: 0.8 },
  // Clarity aggregation weights (청탁) — normalized internally
  clarityWeights: { gap: 0.25, alignment: 0.2, method: 0.2, purity: 0.2, root: 0.15 },
  // Thresholds for classification flags
  qingThreshold: 0.66,
  integrityThreshold: 0.6,
  brokenDamageThreshold: 1.0,
  rootNorm: 1.0,
  enabled: true,
};

type GyeokQualityMethod = RuleFacts['month']['gyeok']['method'];

function computeMonthGyeokQuality(args: {
  config: EngineConfig;
  monthBranch: BranchIdx;
  gyeokStem: StemIdx;
  gyeokTenGod: TenGod;
  gyeokMethod: GyeokQualityMethod;
  monthGyeokCandidates: Array<{ score: number; tenGod: TenGod; visibleInChart: boolean }>;
  branches: BranchIdx[];
  hiddenStemPolicy: any;
  tenGodScoresRanking: Array<{ tenGod: TenGod; score: number }>;
  detectedRelations: DetectedRelation[];
  byType: Partial<Record<RelationType, BranchIdx[][]>>;
}): RuleFacts['month']['gyeok']['quality'] {
  const { config, monthBranch, gyeokStem, gyeokTenGod, gyeokMethod, monthGyeokCandidates, branches, hiddenStemPolicy, tenGodScoresRanking, detectedRelations, byType } = args;

  const raw: any = (config.strategies as any)?.gyeokguk?.quality ?? {};
  const policy = {
    enabled: raw.enabled ?? DEFAULT_GYEOK_QUALITY_POLICY.enabled,
    damageWeights: { ...DEFAULT_GYEOK_QUALITY_POLICY.damageWeights, ...(raw.damageWeights ?? {}) },
    clarityWeights: { ...DEFAULT_GYEOK_QUALITY_POLICY.clarityWeights, ...(raw.weights ?? raw.clarityWeights ?? {}) },
    qingThreshold: typeof raw.qingThreshold === 'number' ? raw.qingThreshold : DEFAULT_GYEOK_QUALITY_POLICY.qingThreshold,
    integrityThreshold: typeof raw.integrityThreshold === 'number' ? raw.integrityThreshold : DEFAULT_GYEOK_QUALITY_POLICY.integrityThreshold,
    brokenDamageThreshold: typeof raw.brokenDamageThreshold === 'number' ? raw.brokenDamageThreshold : DEFAULT_GYEOK_QUALITY_POLICY.brokenDamageThreshold,
    rootNorm: typeof raw.rootNorm === 'number' ? raw.rootNorm : DEFAULT_GYEOK_QUALITY_POLICY.rootNorm,
  };

  if (policy.enabled === false) {
    return {
      clarity: 1,
      integrity: 1,
      damage: 0,
      qingZhuo: 'QING',
      broken: false,
      mixed: false,
      multiplier: 1,
      reasons: ['quality:disabled'],
      details: {
        gap: 1,
        alignmentRank: 0,
        rootScore: 0,
        rootNorm: policy.rootNorm,
        damageByType: {},
        damageRelations: [],
      },
    };
  }

  // --- Gap (候选差距): top vs 2nd
  const top = monthGyeokCandidates[0]?.score ?? 0;
  const second = monthGyeokCandidates[1]?.score ?? 0;
  const gap = top > 0 ? clamp01((top - second) / top) : 0;

  // --- Alignment: month-gyeok ten-god rank within overall ten-god scores
  const alignmentRank = tenGodScoresRanking.findIndex((x) => x.tenGod === gyeokTenGod);
  const alignment = alignmentRank < 0 ? 0 : clamp01(1 - 0.25 * alignmentRank);

  // --- Method: 透干/会支 availability affects “清”
  const methodScore = (() => {
    switch (gyeokMethod) {
      case 'MAIN_EXPOSED':
        return 1.0;
      case 'VISIBLE_HIDDEN':
        return 0.9;
      case 'GROUP_SUPPORTED':
        return 0.85;
      case 'MAIN_FALLBACK':
      default:
        return 0.7;
    }
  })();

  // --- Purity: how many distinct ten-gods are exposed among month hidden stems?
  const visibleTenGods = new Set(monthGyeokCandidates.filter((c) => c.visibleInChart).map((c) => c.tenGod));
  const visibleKinds = visibleTenGods.size;
  const mixed = visibleKinds > 1;
  const purity = visibleKinds <= 1 ? 1 : clamp01(1 - 0.3 * (visibleKinds - 1));

  // --- Root(通根) depth for the anchor element (approx by hidden-stem weights)
  const gyeokEl = stemElement(gyeokStem);
  let rootScore = 0;
  for (const br of branches) {
    for (const h of hiddenStemsOfBranch(br, hiddenStemPolicy)) {
      if (stemElement(h.stem) === gyeokEl) rootScore += h.weight;
    }
  }
  const rootFactor = policy.rootNorm > 0 ? clamp01(rootScore / policy.rootNorm) : 0;

  // --- Damage: relations involving month branch (破格 요인)
  const countInvolving = (t: RelationType): number => (byType[t] ?? []).filter((m) => (m as BranchIdx[]).includes(monthBranch)).length;
  const cnt = {
    CHUNG: countInvolving('CHUNG'),
    HAE: countInvolving('HAE'),
    PA: countInvolving('PA'),
    WONJIN: countInvolving('WONJIN'),
    HYEONG: (['HYEONG', 'JA_HYEONG', 'SAMHYEONG'] as RelationType[]).reduce((acc, t) => acc + countInvolving(t), 0),
  };
  const w = policy.damageWeights as any;
  const damage = (cnt.CHUNG * (typeof w.CHUNG === 'number' ? w.CHUNG : 0)) +
    (cnt.HAE * (typeof w.HAE === 'number' ? w.HAE : 0)) +
    (cnt.PA * (typeof w.PA === 'number' ? w.PA : 0)) +
    (cnt.WONJIN * (typeof w.WONJIN === 'number' ? w.WONJIN : 0)) +
    (cnt.HYEONG * (typeof w.HYEONG === 'number' ? w.HYEONG : 0));
  const integrity = clamp01(1 / (1 + Math.max(0, damage)));
  const broken = damage >= policy.brokenDamageThreshold;

  // --- clarity aggregation
  const cwRaw: any = policy.clarityWeights ?? {};
  const cw = {
    gap: typeof cwRaw.gap === 'number' ? cwRaw.gap : DEFAULT_GYEOK_QUALITY_POLICY.clarityWeights.gap,
    alignment: typeof cwRaw.alignment === 'number' ? cwRaw.alignment : DEFAULT_GYEOK_QUALITY_POLICY.clarityWeights.alignment,
    method: typeof cwRaw.method === 'number' ? cwRaw.method : DEFAULT_GYEOK_QUALITY_POLICY.clarityWeights.method,
    purity: typeof cwRaw.purity === 'number' ? cwRaw.purity : DEFAULT_GYEOK_QUALITY_POLICY.clarityWeights.purity,
    root: typeof cwRaw.root === 'number' ? cwRaw.root : DEFAULT_GYEOK_QUALITY_POLICY.clarityWeights.root,
  };
  const cwSum = cw.gap + cw.alignment + cw.method + cw.purity + cw.root;
  const n = cwSum > 0 ? (1 / cwSum) : 1;
  const clarity = clamp01(
    (cw.gap * gap + cw.alignment * alignment + cw.method * methodScore + cw.purity * purity + cw.root * rootFactor) * n,
  );

  const qingZhuo: 'QING' | 'ZHUO' =
    clarity >= policy.qingThreshold && integrity >= policy.integrityThreshold && !mixed ? 'QING' : 'ZHUO';

  const multiplier = clamp01(integrity * (0.5 + 0.5 * clarity));

  const damageRelations = detectedRelations.filter(
    (r) =>
      (r.members as BranchIdx[]).includes(monthBranch) &&
      (r.type === 'CHUNG' || r.type === 'HAE' || r.type === 'PA' || r.type === 'WONJIN' || r.type === 'HYEONG' || r.type === 'JA_HYEONG' || r.type === 'SAMHYEONG'),
  );

  const reasons: string[] = [];
  reasons.push(`method:${gyeokMethod}`);
  if (mixed) reasons.push(`mixedVisible:${visibleKinds}`);
  if (gap < 0.2) reasons.push('gap:low');
  if (alignmentRank > 1) reasons.push(`alignmentRank:${alignmentRank}`);
  if (rootFactor >= 0.7) reasons.push('root:strong');
  if (damage > 0) reasons.push(`damage:${damage.toFixed(2)}`);
  reasons.push(`qingZhuo:${qingZhuo}`);

  return {
    clarity,
    integrity,
    damage,
    qingZhuo,
    broken,
    mixed,
    multiplier,
    reasons,
    details: {
      gap,
      alignmentRank,
      rootScore,
      rootNorm: policy.rootNorm,
      damageByType: cnt as any,
      damageRelations,
    },
  };
}


function strengthFromTenGodScoresBase(tg: TenGodScore): StrengthFacts {
  const companions = (tg.BI_GYEON ?? 0) + (tg.GEOB_JAE ?? 0);
  const resources = (tg.PYEON_IN ?? 0) + (tg.JEONG_IN ?? 0);
  const outputs = (tg.SIK_SHIN ?? 0) + (tg.SANG_GWAN ?? 0);
  const wealth = (tg.PYEON_JAE ?? 0) + (tg.JEONG_JAE ?? 0);
  const officers = (tg.PYEON_GWAN ?? 0) + (tg.JEONG_GWAN ?? 0);

  const support = companions + resources;
  const pressure = outputs + wealth + officers;
  const total = support + pressure;
  const index = total <= 0 ? 0 : (support - pressure) / total;

  return { index, support, pressure, total, components: { companions, resources, outputs, wealth, officers } };
}

function seasonSupportScore(monthEl: Element, dmEl: Element): number {
  // Rough "득령/실령" score in [-1,+1] based on 生/克 관계.
  if (monthEl === dmEl) return 1.0;
  if (generates(monthEl, dmEl)) return 0.6; // month supports DM
  if (generates(dmEl, monthEl)) return -0.6; // DM drains to season
  if (controls(monthEl, dmEl)) return -0.8; // season controls DM
  if (controls(dmEl, monthEl)) return -0.3; // DM controls season (mixed)
  return 0.0;
}

function computeStrengthFacts(args: {
  config: EngineConfig;
  tenGods: TenGodScore;
  dayMasterStem: StemIdx;
  monthBranch: BranchIdx;
  stems: StemIdx[];
  branches: BranchIdx[];
  hiddenStemPolicy: any;
  seasonGroup: SeasonGroup;
}): StrengthFacts {
  const base = strengthFromTenGodScoresBase(args.tenGods);

  const model = ((args.config.strategies as any)?.strength?.model ?? 'base') as string;

  // --- Model: deLingDiShi (得令/得地/得势)
  if (model === 'deLingDiShi' || model === 'delingdiShi' || model === 'delingsh' || model === 'deLing') {
    const dmEl = stemElement(args.dayMasterStem);
    const monthEl = branchElement(args.monthBranch);

    const pol: any = (args.config.strategies as any)?.strength ?? {};
    const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

    const lingScale = num(pol.lingScale, 0.18);
    const diScale = num(pol.diScale, 0.14);
    const shiScale = num(pol.shiScale, 0.10);

    const rootNorm = num(pol.rootNorm, 2.2);
    const shiNorm = num(pol.shiNorm, 1.6);

    const rootResAlpha = num(pol.rootResAlpha, 0.6);
    const shiResAlpha = num(pol.shiResAlpha, 0.7);

    const posW = {
      year: num(pol.positionWeights?.year, 0.6),
      month: num(pol.positionWeights?.month, 1.0),
      hour: num(pol.positionWeights?.hour, 0.8),
    };

    // 得令: month element relative to DM element (signed)
    const lingScore = seasonSupportScore(monthEl, dmEl);
    const lingFactor = lingScore * lingScale;

    // 得地/通根: weighted hidden-stem roots across 4 branches (year,month,day,hour)
    const branchWeights = [
      num(pol.branchWeights?.year, 0.7),
      num(pol.branchWeights?.month, 1.1),
      num(pol.branchWeights?.day, 0.9),
      num(pol.branchWeights?.hour, 0.7),
    ];

    let same = 0;
    let res = 0;
    for (let i = 0; i < args.branches.length; i++) {
      const b = args.branches[i]!;
      const bw = branchWeights[i] ?? 1;
      for (const h of hiddenStemsOfBranch(b, args.hiddenStemPolicy ?? {})) {
        const el = stemElement(h.stem);
        if (el === dmEl) same += h.weight * bw;
        if (generates(el, dmEl)) res += h.weight * bw;
      }
    }
    const diScore = Math.max(0, same + rootResAlpha * res);
    const diNormed = clamp01(diScore / Math.max(1e-9, rootNorm));
    const diFactor = diNormed * diScale;

    // 得势/透干: supportive stems on heaven (year/month/hour; excluding day stem)
    const stemsOther: Array<{ pos: 'year' | 'month' | 'hour'; stem: StemIdx; w: number }> = [
      { pos: 'year', stem: args.stems[0]!, w: posW.year },
      { pos: 'month', stem: args.stems[1]!, w: posW.month },
      { pos: 'hour', stem: args.stems[3]!, w: posW.hour },
    ];

    let shiSame = 0;
    let shiRes = 0;
    for (const s0 of stemsOther) {
      const el = stemElement(s0.stem);
      if (el === dmEl) shiSame += s0.w;
      if (generates(el, dmEl)) shiRes += s0.w;
    }
    const shiScore = Math.max(0, shiSame + shiResAlpha * shiRes);
    const shiNormed = clamp01(shiScore / Math.max(1e-9, shiNorm));
    const shiFactor = shiNormed * shiScale;

    const supportAdj = Math.max(0, base.support * (1 + lingFactor + diFactor + shiFactor));
    const pressureAdj = base.pressure;
    const totalAdj = supportAdj + pressureAdj;
    const indexAdj = totalAdj <= 0 ? 0 : (supportAdj - pressureAdj) / totalAdj;

    return {
      index: indexAdj,
      support: supportAdj,
      pressure: pressureAdj,
      total: totalAdj,
      components: base.components,
      model: 'deLingDiShi',
      details: {
        delingdiShi: {
          deLing: { monthElement: monthEl, dayMasterElement: dmEl, score: lingScore, factor: lingScale },
          deDi: { sameElement: same, resourceElement: res, score: diScore, normalized: diNormed, factor: diScale },
          deShi: { sameElement: shiSame, resourceElement: shiRes, score: shiScore, normalized: shiNormed, factor: shiScale, positionWeights: posW },
          adjusted: { support: supportAdj, pressure: pressureAdj, total: totalAdj },
        },
      },
    };
  }

  // --- Model: seasonalRoots (legacy advanced)
  if (model !== 'seasonalRoots') {
    return { ...base, model: 'base' };
  }

  const dmEl = stemElement(args.dayMasterStem);
  const monthEl = branchElement(args.monthBranch);

  const seasonScaleRaw = (args.config.strategies as any)?.strength?.seasonScale;
  const rootScaleRaw = (args.config.strategies as any)?.strength?.rootScale;
  const seasonScale = typeof seasonScaleRaw === 'number' && Number.isFinite(seasonScaleRaw) ? seasonScaleRaw : 0.14;
  const rootScale = typeof rootScaleRaw === 'number' && Number.isFinite(rootScaleRaw) ? rootScaleRaw : 0.1;

  const seasonScore = seasonSupportScore(monthEl, dmEl);
  const seasonFactor = seasonScore * seasonScale;

  // Rooting (通根) proxy: sum hidden-stem weights across all 4 branches.
  let same = 0;
  let res = 0;
  for (const b of args.branches) {
    for (const h of hiddenStemsOfBranch(b, args.hiddenStemPolicy ?? {})) {
      const el = stemElement(h.stem);
      if (el === dmEl) same += h.weight;
      if (generates(el, dmEl)) res += h.weight;
    }
  }

  const rootScore = Math.max(0, same + 0.6 * res);
  const rootFactor = rootScore * rootScale;

  const supportAdj = Math.max(0, base.support * (1 + seasonFactor + rootFactor));
  const pressureAdj = base.pressure;
  const totalAdj = supportAdj + pressureAdj;
  const indexAdj = totalAdj <= 0 ? 0 : (supportAdj - pressureAdj) / totalAdj;

  return {
    index: indexAdj,
    support: supportAdj,
    pressure: pressureAdj,
    total: totalAdj,
    components: base.components,
    model: 'seasonalRoots',
    details: {
      season: {
        monthElement: monthEl,
        seasonGroup: args.seasonGroup,
        dayMasterElement: dmEl,
        score: seasonScore,
        factor: seasonScale,
      },
      roots: {
        sameElement: same,
        resourceElement: res,
        score: rootScore,
        factor: rootScale,
      },
      adjusted: { support: supportAdj, pressure: pressureAdj, total: totalAdj },
    },
  };
}

function monthMainHiddenStem(monthBranch: BranchIdx, hiddenStemPolicy: any): StemIdx {
  const hs = hiddenStemsOfBranch(monthBranch, hiddenStemPolicy ?? {});
  const main = hs.find((h) => h.role === 'MAIN') ?? hs[0];
  if (!main) throw new Error('Invariant: hidden stems table empty for branch');
  return main.stem;
}

const TWELVE_SAL_OFFSET: Record<TwelveSalKey, number> = {
  JI_SAL: 0,
  DOHWA: 1,
  WOL_SAL: 2,
  MANG_SHIN_SAL: 3,
  JANGSEONG: 4,
  BAN_AN_SAL: 5,
  YEOKMA: 6,
  YUK_HAE_SAL: 7,
  HUAGAI: 8,
  GEOB_SAL: 9,
  JAESAL: 10,
  CHEON_SAL: 11,
};

function twelveSalStartOf(anchorBranch: BranchIdx): BranchIdx {
  // start = 地살(地殺) 지지
  // base = (branch % 4):
  //  0(申子辰군)→申(8), 1(巳酉丑군)→巳(5), 2(寅午戌군)→寅(2), 3(亥卯未군)→亥(11)
  const base = mod(anchorBranch, 12) % 4;
  return mod(8 - 3 * base, 12) as BranchIdx;
}

function twelveSalOf(anchorBranch: BranchIdx): Record<TwelveSalKey, BranchIdx> {
  const start = twelveSalStartOf(anchorBranch);
  const out = {} as Record<TwelveSalKey, BranchIdx>;
  for (const k of TWELVE_SAL_KEYS) {
    out[k] = mod(start + TWELVE_SAL_OFFSET[k], 12) as BranchIdx;
  }
  return out;
}

function shinsalPeachOf(branch: BranchIdx): BranchIdx {
  // 桃花(年살/도화)
  return twelveSalOf(branch).DOHWA;
}

function shinsalHorseOf(branch: BranchIdx): BranchIdx {
  // 驛馬
  return twelveSalOf(branch).YEOKMA;
}

function shinsalHuagaiOf(branch: BranchIdx): BranchIdx {
  // 華蓋
  return twelveSalOf(branch).HUAGAI;
}

function shinsalJangseongOf(branch: BranchIdx): BranchIdx {
  // 將星
  return twelveSalOf(branch).JANGSEONG;
}

function shinsalJaesalOf(branch: BranchIdx): BranchIdx {
  // 災煞
  return twelveSalOf(branch).JAESAL;
}

function shinsalHongluanOf(yearBranch: BranchIdx): BranchIdx {
  // 紅鸞: year-branch anchored mapping. Pattern is a simple reverse sequence: 0(子)→3(卯), 1(丑)→2(寅), ...
  return mod(3 - yearBranch, 12) as BranchIdx;
}

function shinsalCheonhuiOf(yearBranch: BranchIdx): BranchIdx {
  // 天喜: 紅鸞의 對宮(충).
  return branchChungPartner(shinsalHongluanOf(yearBranch));
}

function shinsalGongmangOfDayPillar(day: PillarIdx): [BranchIdx, BranchIdx] {
  // 空亡(旬空): derived from the day pillar's 10-day xun.
  // Let i be the 60-index. xun = floor(i/10). voidStart = (10 - 2*xun) mod 12. Pair = {voidStart, voidStart+1}.
  const idx = ganzhiIndex(day) ?? 0;
  const xun = Math.floor(mod(idx, 60) / 10);
  const start = mod(10 - 2 * xun, 12) as BranchIdx;
  return [start, mod(start + 1, 12) as BranchIdx];
}

function shinsalCheonSaTargetDayPillar(monthBranch: BranchIdx): { season: SeasonGroup; target: PillarIdx; targetHanja: string } {
  // 天赦日(천사일) ... per season: 春戊寅 夏甲午 秋戊申 冬甲子
  const season = seasonGroupOfMonthBranch(monthBranch);
  const stemH = season === 'SPRING' || season === 'AUTUMN' ? '戊' : '甲';
  const branchH = season === 'SPRING' ? '寅' : season === 'SUMMER' ? '午' : season === 'AUTUMN' ? '申' : '子';
  const stem = stemIdxFromHanja(stemH);
  const branch = branchIdxFromHanja(branchH);
  if (stem == null || branch == null) throw new Error('Invariant: invalid hanja for cheonSa target pillar');
  return { season, target: pillar(stem, branch), targetHanja: `${stemH}${branchH}` };
}

function readLifeStagePolicyFromConfig(config: EngineConfig): LifeStagePolicy {
  const raw: any = (config.strategies as any)?.lifeStages ?? (config.strategies as any)?.lifeStage ?? {};

  const earthRuleRaw = raw.earthRule ?? 'FOLLOW_FIRE';
  const earthRule =
    earthRuleRaw === 'FOLLOW_WATER' || earthRuleRaw === 'INDEPENDENT' || earthRuleRaw === 'FOLLOW_FIRE'
      ? earthRuleRaw
      : 'FOLLOW_FIRE';

  const yinReversalEnabled = raw.yinReversalEnabled ?? true;

  return { earthRule, yinReversalEnabled } as LifeStagePolicy;
}

function readShinsalCatalogFromConfig(config: EngineConfig): NormalizedShinsalCatalog {
  const ext = (config.extensions as any) ?? {};
  const rawOverride: RawShinsalCatalog | undefined =
    (ext.catalogs?.shinsal as RawShinsalCatalog) ??
    (ext.catalog?.shinsal as RawShinsalCatalog) ??
    (ext.shinsalCatalog as RawShinsalCatalog);

  const raw: RawShinsalCatalog = rawOverride
    ? mergeRawShinsalCatalog(DEFAULT_SHINSAL_CATALOG as any, rawOverride)
    : (DEFAULT_SHINSAL_CATALOG as any);
  return normalizeShinsalCatalog(raw);
}

function uniqueBranches(xs: BranchIdx[]): BranchIdx[] {
  return Array.from(new Set(xs.map((x) => mod(x, 12) as BranchIdx)));
}

function uniqueStems(xs: StemIdx[]): StemIdx[] {
  return Array.from(new Set(xs.map((x) => mod(x, 10) as StemIdx)));
}

function presentBranchesAndCount(targets: BranchIdx[], chartBranches: BranchIdx[]): { present: BranchIdx[]; count: number } {
  if (!targets || targets.length === 0) return { present: [], count: 0 };
  const tset = new Set(targets.map((x) => mod(x, 12)));
  const hits = chartBranches.filter((b) => tset.has(mod(b, 12)));
  return { present: uniqueBranches(hits as BranchIdx[]), count: hits.length };
}

function presentStemsAndCount(targets: StemIdx[], chartStems: StemIdx[]): { present: StemIdx[]; count: number } {
  if (!targets || targets.length === 0) return { present: [], count: 0 };
  const tset = new Set(targets.map((x) => mod(x, 10)));
  const hits = chartStems.filter((s) => tset.has(mod(s, 10)));
  return { present: uniqueStems(hits as StemIdx[]), count: hits.length };
}

function matchedPillarsForBranchTargets(
  targets: BranchIdx[],
  pillars: { year: PillarIdx; month: PillarIdx; day: PillarIdx; hour: PillarIdx },
): Array<'year' | 'month' | 'day' | 'hour'> {
  if (!targets || targets.length === 0) return [];
  const tset = new Set(targets.map((x) => mod(x, 12)));
  const out: Array<'year' | 'month' | 'day' | 'hour'> = [];
  if (tset.has(mod(pillars.year.branch, 12))) out.push('year');
  if (tset.has(mod(pillars.month.branch, 12))) out.push('month');
  if (tset.has(mod(pillars.day.branch, 12))) out.push('day');
  if (tset.has(mod(pillars.hour.branch, 12))) out.push('hour');
  return out;
}

function matchedPillarsForStemTargets(
  targets: StemIdx[],
  pillars: { year: PillarIdx; month: PillarIdx; day: PillarIdx; hour: PillarIdx },
): Array<'year' | 'month' | 'day' | 'hour'> {
  if (!targets || targets.length === 0) return [];
  const tset = new Set(targets.map((x) => mod(x, 10)));
  const out: Array<'year' | 'month' | 'day' | 'hour'> = [];
  if (tset.has(mod(pillars.year.stem, 10))) out.push('year');
  if (tset.has(mod(pillars.month.stem, 10))) out.push('month');
  if (tset.has(mod(pillars.day.stem, 10))) out.push('day');
  if (tset.has(mod(pillars.hour.stem, 10))) out.push('hour');
  return out;
}

function branchChungPartner(b: BranchIdx): BranchIdx {
  return mod(b + 6, 12) as BranchIdx;
}

function branchHaePartner(b: BranchIdx): BranchIdx {
  return mod(7 - b, 12) as BranchIdx;
}

function isGeokgakPair(a: BranchIdx, b: BranchIdx): boolean {
  // 隔角(격각): 지지 12순환에서 '한 칸 건너' 관계.
  // distance = 2 (양방향) ⇔ (a-b) mod 12 ∈ {2,10}
  const d = mod(mod(a, 12) - mod(b, 12), 12);
  return d === 2 || d === 10;
}

function buildCatalogFacts(args: {
  config: EngineConfig;
  catalog: NormalizedShinsalCatalog;
  dayStem: StemIdx;
  pillars: { year: PillarIdx; month: PillarIdx; day: PillarIdx; hour: PillarIdx };
  chartBranches: BranchIdx[];
  chartStems: StemIdx[];
}): RuleFacts['shinsal']['catalog'] {
  const { config, catalog, dayStem, pillars, chartBranches, chartStems } = args;

  // --- day-stem tables
  const dayStemFacts: Record<
    string,
    { targets: BranchIdx[]; present: BranchIdx[]; count: number; matchedPillars: Array<'year' | 'month' | 'day' | 'hour'> }
  > = {};
  for (const [k, spec] of Object.entries(catalog.dayStem)) {
    const targets = (spec.byStem[mod(dayStem, 10)] ?? []) as BranchIdx[];
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    dayStemFacts[k] = { targets, present, count, matchedPillars };
  }

  // --- year-stem tables (same lookup tables, different anchor)
  const yearStem = mod(pillars.year.stem, 10) as StemIdx;
  const yearStemFacts: Record<
    string,
    { targets: BranchIdx[]; present: BranchIdx[]; count: number; matchedPillars: Array<'year' | 'month' | 'day' | 'hour'> }
  > = {};
  for (const [k, spec] of Object.entries(catalog.dayStem)) {
    const targets = (spec.byStem[yearStem] ?? []) as BranchIdx[];
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    yearStemFacts[k] = { targets, present, count, matchedPillars };
  }

  // Add one computed entry (학당=일간의 장생지) to keep the rule surface stable.
  // Users may override by providing the same key in extensions.catalogs.shinsal.dayStem.
  if (!dayStemFacts.HAK_DANG_GUI_IN) {
    const lsPolicy = readLifeStagePolicyFromConfig(config);
    const startBranch = lifeStageOf(dayStem, 0 as BranchIdx, lsPolicy).startBranch as BranchIdx;
    const targets = [startBranch] as BranchIdx[];
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    dayStemFacts.HAK_DANG_GUI_IN = { targets, present, count, matchedPillars };
  }

  // Computed: 羊刃(양인살) — 유파별 정의가 존재하므로 "전략"으로 분기한다.
  //
  // Two common modes:
  // - 'luNext' (default, KR-mainstream): 羊刃 = (禄神 지지) + 1 (지지 순환 기준)
  // - 'diWang' (classic, many CN sources): 羊刃 = 帝旺 (양간:+1, 음간:-1) (禄신 기준)
  //
  // Users can still override explicitly by providing YANG_IN in the catalog.
  if (!dayStemFacts.YANG_IN) {
    const modeRaw = (config.strategies as any)?.shinsal?.yanginMode;
    const mode: 'luNext' | 'diWang' = modeRaw === 'diWang' ? 'diWang' : 'luNext';

    const lok = dayStemFacts.LOK_SHIN?.targets?.[0] as BranchIdx | undefined;
    // Fallback: canonical 建禄/禄神 table (kept tiny; can be overridden by catalog anyway).
    const lokFallback: BranchIdx[] = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0] as BranchIdx[]; // 寅卯巳午巳午申酉亥子
    const lokBranch = (lok ?? lokFallback[mod(dayStem, 10)]) as BranchIdx;

    const isYinStem = mod(dayStem, 2) === 1;
    const delta = mode === 'diWang' && isYinStem ? -1 : 1;
    const yangBranch = mod(lokBranch + delta, 12) as BranchIdx;
    const targets = [yangBranch] as BranchIdx[];
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    dayStemFacts.YANG_IN = { targets, present, count, matchedPillars };
  }

  if (!yearStemFacts.YANG_IN) {
    const modeRaw = (config.strategies as any)?.shinsal?.yanginMode;
    const mode: 'luNext' | 'diWang' = modeRaw === 'diWang' ? 'diWang' : 'luNext';

    const lok = yearStemFacts.LOK_SHIN?.targets?.[0] as BranchIdx | undefined;
    const lokFallback: BranchIdx[] = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0] as BranchIdx[];
    const lokBranch = (lok ?? lokFallback[yearStem]) as BranchIdx;

    const isYinStem = mod(yearStem, 2) === 1;
    const delta = mode === 'diWang' && isYinStem ? -1 : 1;
    const yangBranch = mod(lokBranch + delta, 12) as BranchIdx;
    const targets = [yangBranch] as BranchIdx[];
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    yearStemFacts.YANG_IN = { targets, present, count, matchedPillars };
  }

  // Computed: 飛刃(비인살) — 통용 정의: "冲羊刃".
  // 즉, (日干의 羊刃 지지)와 정충(沖) 관계인 지지를 타깃으로 본다.
  // Users may override by providing the same key in extensions.catalogs.shinsal.dayStem.
  if (!dayStemFacts.BI_IN_SAL) {
    const yangTargets = dayStemFacts.YANG_IN?.targets ?? [];
    const targets = uniqueBranches(yangTargets.map((b) => branchChungPartner(mod(b, 12) as BranchIdx)) as BranchIdx[]);
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    dayStemFacts.BI_IN_SAL = { targets, present, count, matchedPillars };
  }

  if (!yearStemFacts.BI_IN_SAL) {
    const yangTargets = yearStemFacts.YANG_IN?.targets ?? [];
    const targets = uniqueBranches(yangTargets.map((b) => branchChungPartner(mod(b, 12) as BranchIdx)) as BranchIdx[]);
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    yearStemFacts.BI_IN_SAL = { targets, present, count, matchedPillars };
  }

  // --- month-branch → stem tables
  const monthBranch = mod(pillars.month.branch, 12) as BranchIdx;

 // --- scope helpers (유파) for month-based lookups (천덕/월덕 등)
  type PillarName = 'year' | 'month' | 'day' | 'hour';
  const ALL_PILLARS: PillarName[] = ['year', 'month', 'day', 'hour'];

  const shinsalStrat: any = (config.strategies as any)?.shinsal ?? {};
  const catalogScopes: any = shinsalStrat.catalogScopes ?? shinsalStrat.scopes ?? {};
  const monthBranchStemScopes: any = catalogScopes.monthBranchStem ?? catalogScopes.monthStem ?? {};
  const monthBranchBranchScopes: any = catalogScopes.monthBranchBranch ?? catalogScopes.monthBranch ?? {};
  const monthDeokScopeRaw: any = shinsalStrat.monthDeokScope ?? shinsalStrat.deokScope;

  const DEOK_MONTH_STEM_KEYS = new Set<string>(['WOL_DEOK_GUI_IN', 'WOL_DEOK_HAP', 'CHEON_DEOK_GUI_IN_STEM', 'CHEON_DEOK_HAP']);
  const DEOK_MONTH_BRANCH_KEYS = new Set<string>(['CHEON_DEOK_GUI_IN_BRANCH']);

  function isPillarName(x: unknown): x is PillarName {
    return x === 'year' || x === 'month' || x === 'day' || x === 'hour';
  }

  function parsePillarScope(raw: unknown): PillarName[] {
    if (raw == null) return ALL_PILLARS;
    if (Array.isArray(raw)) {
      const picked = raw.filter(isPillarName);
      return picked.length > 0 ? Array.from(new Set(picked)) : ALL_PILLARS;
    }
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return ALL_PILLARS;

      if (['all', 'any', 'anyPillar', 'allPillars'].includes(s)) return ALL_PILLARS;
      if (['day', 'dayOnly', 'dayStemOnly', 'dayBranchOnly', '일', '일간', '日', '日干'].includes(s)) return ['day'];
      if (['month', 'monthOnly', '월', '月'].includes(s)) return ['month'];
      if (['year', 'yearOnly', '년', '年'].includes(s)) return ['year'];
      if (['hour', 'hourOnly', '시', '時'].includes(s)) return ['hour'];

      const tokens = s
        .split(/[,+\s]+/g)
        .map((t) => t.trim())
        .filter(Boolean);

      const mapped: PillarName[] = [];
      for (const t of tokens) {
        if (['year', 'y', '년', '年'].includes(t)) mapped.push('year');
        else if (['month', 'm', '월', '月'].includes(t)) mapped.push('month');
        else if (['day', 'd', '일', '日'].includes(t)) mapped.push('day');
        else if (['hour', 'h', '시', '時'].includes(t)) mapped.push('hour');
      }
      return mapped.length > 0 ? Array.from(new Set(mapped)) : ALL_PILLARS;
    }
    return ALL_PILLARS;
  }

  function scopeForMonthBranchStemKey(key: string): PillarName[] {
    const raw = monthBranchStemScopes?.[key] ?? (monthDeokScopeRaw != null && DEOK_MONTH_STEM_KEYS.has(key) ? monthDeokScopeRaw : undefined);
    return parsePillarScope(raw);
  }

  function scopeForMonthBranchBranchKey(key: string): PillarName[] {
    const raw = monthBranchBranchScopes?.[key] ?? (monthDeokScopeRaw != null && DEOK_MONTH_BRANCH_KEYS.has(key) ? monthDeokScopeRaw : undefined);
    return parsePillarScope(raw);
  }

  function stemsOf(scope: PillarName[]): StemIdx[] {
    return scope.map((p) => pillars[p].stem) as StemIdx[];
  }

  function branchesOf(scope: PillarName[]): BranchIdx[] {
    return scope.map((p) => pillars[p].branch) as BranchIdx[];
  }

  function intersectScope(scope: PillarName[], matched: Array<PillarName>): Array<PillarName> {
    const set = new Set(scope);
    return matched.filter((p) => set.has(p));
  }

  const monthBranchStemFacts: Record<
    string,
    { targets: StemIdx[]; target: StemIdx | null; present: StemIdx[]; count: number; matchedPillars: Array<'year' | 'month' | 'day' | 'hour'> }
  > = {};

  for (const [k, spec] of Object.entries(catalog.monthBranchStem)) {
    const targets = (spec.byBranch[monthBranch] ?? []) as StemIdx[];
    const { present, count } = presentStemsAndCount(targets, chartStems);
    const matchedPillars = matchedPillarsForStemTargets(targets, pillars);
    monthBranchStemFacts[k] = { targets, target: (targets[0] ?? null) as StemIdx | null, present, count, matchedPillars };
  }

  // Computed: 德秀贵人(덕수귀인) — month-group based stems.
  // Users may override by providing the same key in extensions.catalogs.shinsal.monthBranchStem.
  if (!monthBranchStemFacts.DEOK_SU_GUI_IN) {
    // Groups by (monthBranch % 4):
    // 0: 申子辰月 → 壬癸丙辛戊己甲
    // 1: 巳酉丑月 → 庚辛乙
    // 2: 寅午戌月 → 丙丁戊癸
    // 3: 亥卯未月 → 甲乙丁壬
    const base = monthBranch % 4;
    const hanjaByBase: Record<number, string[]> = {
      0: ['壬', '癸', '丙', '辛', '戊', '己', '甲'],
      1: ['庚', '辛', '乙'],
      2: ['丙', '丁', '戊', '癸'],
      3: ['甲', '乙', '丁', '壬'],
    };

    const targets = uniqueStems(
      (hanjaByBase[base] ?? [])
        .map((h) => stemIdxFromHanja(h))
        .filter((x): x is StemIdx => x != null),
    );
    const { present, count } = presentStemsAndCount(targets, chartStems);
    const matchedPillars = matchedPillarsForStemTargets(targets, pillars);
    monthBranchStemFacts.DEOK_SU_GUI_IN = {
      targets,
      target: (targets[0] ?? null) as StemIdx | null,
      present,
      count,
      matchedPillars,
    };
  }

  // --- month-branch → branch tables
  const monthBranchBranchFacts: Record<
    string,
    { targets: BranchIdx[]; target: BranchIdx | null; present: BranchIdx[]; count: number; matchedPillars: Array<'year' | 'month' | 'day' | 'hour'> }
  > = {};

  for (const [k, spec] of Object.entries(catalog.monthBranchBranch)) {
    const targets = (spec.byBranch[monthBranch] ?? []) as BranchIdx[];
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    monthBranchBranchFacts[k] = {
      targets,
      target: (targets[0] ?? null) as BranchIdx | null,
      present,
      count,
      matchedPillars,
    };
  }

  // Computed: 天醫(천의) — often expressed as "以月支查...月支前一位".
  // Users may override by providing the same key in extensions.catalogs.shinsal.monthBranchBranch.
  if (!monthBranchBranchFacts.CHEON_UI) {
    const target = mod(monthBranch - 1, 12) as BranchIdx;
    const targets = [target] as BranchIdx[];
    const { present, count } = presentBranchesAndCount(targets, chartBranches);
    const matchedPillars = matchedPillarsForBranchTargets(targets, pillars);
    monthBranchBranchFacts.CHEON_UI = {
      targets,
      target,
      present,
      count,
      matchedPillars,
    };
  }

  // --- day-pillar sets
  const includeExtended: string[] =
    ((config.strategies as any)?.shinsal?.includeExtendedPillarSets as string[]) ??
    ((config.strategies as any)?.shinsal?.includeExtended as string[]) ??
    [];
  const includeExtSet = new Set(includeExtended.map(String));

  const pillarNames: Array<'year' | 'month' | 'day' | 'hour'> = ['year', 'month', 'day', 'hour'];
  const pillarIdxs: Record<'year' | 'month' | 'day' | 'hour', number | null> = {
    year: ganzhiIndex(pillars.year),
    month: ganzhiIndex(pillars.month),
    day: ganzhiIndex(pillars.day),
    hour: ganzhiIndex(pillars.hour),
  };

  const dayPillarFacts: Record<
    string,
    { requiresDayPillar: boolean; isDayPillar: boolean; active: boolean; matchedPillars: Array<'year' | 'month' | 'day' | 'hour'> }
  > = {};

  for (const [k, spec] of Object.entries(catalog.dayPillar)) {
    const set = new Set<number>(spec.primary);
    if (includeExtSet.has(k)) {
      for (const x of spec.extended) set.add(x);
    }

    const matchedPillars = pillarNames.filter((p) => {
      const idx = pillarIdxs[p];
      return idx != null && set.has(mod(idx, 60));
    });
    const isDayPillar = matchedPillars.includes('day');
    const active = spec.requiresDayPillar ? isDayPillar : matchedPillars.length > 0;

    dayPillarFacts[k] = {
      requiresDayPillar: spec.requiresDayPillar,
      isDayPillar,
      active,
      matchedPillars,
    };
  }

  return {
    dayStem: dayStemFacts,
    yearStem: yearStemFacts,
    monthBranchStem: monthBranchStemFacts,
    monthBranchBranch: monthBranchBranchFacts,
    dayPillar: dayPillarFacts,
  };
}

export function buildRuleFacts(args: {
  config: EngineConfig;
  pillars: { year: PillarIdx; month: PillarIdx; day: PillarIdx; hour: PillarIdx };
  elementDistribution: ElementDistribution;
  scoring: PillarsScoringResult;
}): RuleFacts {
  const { config, pillars, elementDistribution, scoring } = args;

  const stems: StemIdx[] = [pillars.year.stem, pillars.month.stem, pillars.day.stem, pillars.hour.stem];
  const branches: BranchIdx[] = [pillars.year.branch, pillars.month.branch, pillars.day.branch, pillars.hour.branch];

  // --- Branch relations (합/충/형/해/파/원진/삼합/방합/삼형)
  const detectedRelations = detectBranchRelations(branches);
  const byType: Partial<Record<RelationType, BranchIdx[][]>> = {};
  for (const r of detectedRelations) {
    const list = (byType[r.type] ??= []);
    list.push(r.members);
  }

  const gatherBranches = (t: RelationType): BranchIdx[] =>
    uniqueBranches(((byType[t] ?? []).flatMap((m) => m) as BranchIdx[]) ?? []);

  const chungBranches = gatherBranches('CHUNG');
  const haeBranches = gatherBranches('HAE');
  const yukhapBranches = gatherBranches('YUKHAP');
  const paBranches = gatherBranches('PA');
  const wonjinBranches = gatherBranches('WONJIN');
  const hyeongBranches = uniqueBranches(
    (['HYEONG', 'JA_HYEONG', 'SAMHYEONG'] as RelationType[]).flatMap((t) => (byType[t] ?? []).flatMap((m) => m)) as BranchIdx[],
  );

  // Configurable “damage” relation types used for shinsal attenuation/quality.
  const rawDamageTypes = (config.strategies as any)?.shinsal?.damageRelations ?? (config.strategies as any)?.shinsal?.damageTypes;
  const validTypes = new Set<RelationType>([
    'YUKHAP',
    'CHUNG',
    'HYEONG',
    'JA_HYEONG',
    'SAMHYEONG',
    'HAE',
    'PA',
    'WONJIN',
    'SAMHAP',
    'BANGHAP',
  ]);
  const damageTypes: RelationType[] = Array.isArray(rawDamageTypes)
    ? (rawDamageTypes.filter((t: any) => typeof t === 'string' && validTypes.has(t as RelationType)) as RelationType[])
    : DEFAULT_SHINSAL_DAMAGE_RELATIONS;

  const damagedBranches = uniqueBranches(
    damageTypes.flatMap((t) => (byType[t] ?? []).flatMap((m) => m)) as BranchIdx[],
  );

  // Relation-derived shinsal payloads: ready-to-emit arrays.
  // NOTE: `type` is kept as a string so we can also attach relation-like shinsal
  // that are not part of the core RelationType union (API-stability).
  const relPayload = (name: string, type: string, members: BranchIdx[]) => ({
    name,
    basedOn: 'OTHER',
    targetKind: 'NONE',
    targetBranches: members,
    matchedPillars: matchedPillarsForBranchTargets(members, pillars),
    details: { relationType: type, members },
  });

  // 隔角(격각): 지지 12순환에서 '한 칸 건너'(distance=2) 관계.
  // Mode:
  //  - 'dayHour'(default): 일지-시지 조합만 본다(전통적 정의: "日支与生时同看").
  //  - 'anyPair': 명식 내 모든 지지쌍을 탐색한다(확장형).
  const geokgakModeRaw = (config.strategies as any)?.shinsal?.geokgakMode;
  const geokgakMode: 'dayHour' | 'anyPair' = geokgakModeRaw === 'anyPair' ? 'anyPair' : 'dayHour';

  const geokgakPairs: BranchIdx[][] = [];
  if (geokgakMode === 'anyPair') {
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const a = mod(branches[i]!, 12) as BranchIdx;
        const b = mod(branches[j]!, 12) as BranchIdx;
        if (isGeokgakPair(a, b)) {
          const m = [a, b].sort((x, y) => x - y) as BranchIdx[];
          geokgakPairs.push(m);
        }
      }
    }
  } else {
    const a = mod(pillars.day.branch, 12) as BranchIdx;
    const b = mod(pillars.hour.branch, 12) as BranchIdx;
    if (isGeokgakPair(a, b)) {
      geokgakPairs.push([a, b].sort((x, y) => x - y) as BranchIdx[]);
    }
  }
  const geokgakSeen = new Set<string>();
  const geokgakUnique = geokgakPairs.filter((m) => {
    const k = `${m[0]}-${m[1]}`;
    if (geokgakSeen.has(k)) return false;
    geokgakSeen.add(k);
    return true;
  });
  const relationSal: Record<string, any[]> = {
    CHUNG_SAL: (byType.CHUNG ?? []).map((m) => relPayload('CHUNG_SAL', 'CHUNG', m as BranchIdx[])),
    HAE_SAL: (byType.HAE ?? []).map((m) => relPayload('HAE_SAL', 'HAE', m as BranchIdx[])),
    PA_SAL: (byType.PA ?? []).map((m) => relPayload('PA_SAL', 'PA', m as BranchIdx[])),
    WONJIN_SAL: (byType.WONJIN ?? []).map((m) => relPayload('WONJIN_SAL', 'WONJIN', m as BranchIdx[])),
    GEOKGAK_SAL: geokgakUnique.map((m) =>
      relPayload('GEOKGAK_SAL', geokgakMode === 'anyPair' ? 'GEOKGAK_ANY_PAIR' : 'GEOKGAK_DAY_HOUR', m as BranchIdx[]),
    ),
    HYEONG_SAL: ([] as any[])
      .concat((byType.HYEONG ?? []).map((m) => relPayload('HYEONG_SAL', 'HYEONG', m as BranchIdx[])))
      .concat((byType.JA_HYEONG ?? []).map((m) => relPayload('HYEONG_SAL', 'JA_HYEONG', m as BranchIdx[])))
      .concat((byType.SAMHYEONG ?? []).map((m) => relPayload('HYEONG_SAL', 'SAMHYEONG', m as BranchIdx[]))),
  };

  // 旬空살(공망살): day pillar's gongmang branches exist in the chart.
  // We emit a single payload if at least one void branch is present.
  const gongmangPair = shinsalGongmangOfDayPillar(pillars.day);
  const gongmangHits = gongmangPair.filter((b) => branches.includes(b));
  relationSal.GONGMANG_SAL = gongmangHits.length > 0 ? [relPayload('GONGMANG_SAL', 'GONGMANG', gongmangPair)] : [];

  const dayStem = pillars.day.stem;
  const dmElement = stemElement(dayStem);

  const hiddenStemPolicy = (config.weights as any)?.hiddenStems ?? {};
  const monthMain = monthMainHiddenStem(pillars.month.branch, hiddenStemPolicy);
  const monthMainTG = tenGodOf(dayStem, monthMain);

  const monthHiddenStems = hiddenStemsOfBranch(pillars.month.branch, hiddenStemPolicy).map((h) => ({
    stem: h.stem,
    element: stemElement(h.stem),
    role: h.role,
    weight: h.weight,
    tenGod: tenGodOf(dayStem, h.stem),
    visibleInChart: stems.includes(h.stem),
  }));

  // --- ZiPing-style “干透支会” (透干 + 会支) for month.gyeok
  const samhapElementOf = (members: BranchIdx[]): Element | null => {
    const key = [...members].sort((a, b) => a - b).join(',');
    // 申子辰(水), 巳酉丑(金), 寅午戌(火), 亥卯未(木)
    if (key === '0,4,8') return 'WATER';
    if (key === '1,5,9') return 'METAL';
    if (key === '2,6,10') return 'FIRE';
    if (key === '3,7,11') return 'WOOD';
    return null;
  };

  const banghapElementOf = (members: BranchIdx[]): Element | null => {
    const key = [...members].sort((a, b) => a - b).join(',');
    // 寅卯辰(木), 巳午未(火), 申酉戌(金), 亥子丑(水)
    if (key === '2,3,4') return 'WOOD';
    if (key === '5,6,7') return 'FIRE';
    if (key === '8,9,10') return 'METAL';
    if (key === '0,1,11') return 'WATER';
    return null;
  };

  const groupSupport: { type: 'SAMHAP' | 'BANGHAP'; element: Element; members: BranchIdx[] } | null = (() => {
    const sam = (byType.SAMHAP ?? []).find((m) => m.includes(pillars.month.branch));
    if (sam) {
      const el = samhapElementOf(sam);
      if (el) return { type: 'SAMHAP', element: el, members: sam };
    }
    const ban = (byType.BANGHAP ?? []).find((m) => m.includes(pillars.month.branch));
    if (ban) {
      const el = banghapElementOf(ban);
      if (el) return { type: 'BANGHAP', element: el, members: ban };
    }
    return null;
  })();

  const monthBranchDamaged = damagedBranches.includes(pillars.month.branch);
  const groupEl = groupSupport?.element ?? null;

  const monthGyeokCandidates = monthHiddenStems
    .map((h) => {
      const reasons: string[] = [];
      let score = h.weight;
      reasons.push(`weight:${h.weight.toFixed(2)}`);

      if (h.role === 'MAIN') {
        score += 0.15;
        reasons.push('MAIN');
      }
      if (h.visibleInChart) {
        score += 0.55;
        reasons.push('VISIBLE');
      }
      if (groupEl && h.element === groupEl) {
        score += 0.35;
        reasons.push(`${groupSupport?.type}_ELEMENT`);
      }
      if (monthBranchDamaged) {
        score -= 0.1;
        reasons.push('MONTH_BRANCH_DAMAGED');
      }

      return { ...h, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const monthMainVisible = stems.includes(monthMain);
  const bestVisible = monthGyeokCandidates.find((c) => c.visibleInChart);
  const bestGroup = groupEl ? monthGyeokCandidates.find((c) => c.element === groupEl) : null;

  const gyeokStem = monthMainVisible ? monthMain : (bestVisible?.stem ?? bestGroup?.stem ?? monthMain);
  const gyeokTenGod = tenGodOf(dayStem, gyeokStem);
  const gyeokMethod = monthMainVisible ? 'MAIN_EXPOSED' : (bestVisible ? 'VISIBLE_HIDDEN' : (bestGroup ? 'GROUP_SUPPORTED' : 'MAIN_FALLBACK'));

  const { normalized, sum } = normalizeVector(elementDistribution.total);

  const tenGodScoresRanking = rankTenGodScores(scoring.tenGods);
  const tenGodScoresBest = tenGodScoresRanking[0] ?? { tenGod: 'BI_GYEON' as TenGod, score: 0 };

  const monthGyeokQuality = computeMonthGyeokQuality({
    config,
    monthBranch: pillars.month.branch,
    gyeokStem,
    gyeokTenGod,
    gyeokMethod,
    monthGyeokCandidates,
    branches,
    hiddenStemPolicy,
    tenGodScoresRanking,
    detectedRelations,
    byType,
  });

  const climateBase = computeClimateFacts(config, pillars.month.branch);
  const johooTemplate = computeJohooTemplate(config, {
    dayStem,
    monthBranch: pillars.month.branch,
    climateScores: climateBase.scores,
  });
  const climate = johooTemplate ? { ...climateBase, template: johooTemplate } : climateBase;
  const tongguan = computeTongguanFacts(normalized);

  const transformations = computeTransformations(config, { pillars, stems, normalized, hiddenStemPolicy, damagedBranches, byType, monthGyeokQuality });

  // 12신살(十二神殺) — year/day anchors (삼합군 기반 순차표)
  const twelveSalYear = twelveSalOf(pillars.year.branch);
  const twelveSalDay = twelveSalOf(pillars.day.branch);

  // 天赦日(천사일): season(month branch) → specific day pillar
  const cheonSaTarget = shinsalCheonSaTargetDayPillar(pillars.month.branch);
  const cheonSaActive = pillars.day.stem === cheonSaTarget.target.stem && pillars.day.branch === cheonSaTarget.target.branch;

  const facts: RuleFacts = {
    chart: {
      pillars: {
        year: { stem: pillars.year.stem, branch: pillars.year.branch },
        month: { stem: pillars.month.stem, branch: pillars.month.branch },
        day: { stem: pillars.day.stem, branch: pillars.day.branch },
        hour: { stem: pillars.hour.stem, branch: pillars.hour.branch },
      },
      stems,
      branches,
      relations: {
        detected: detectedRelations,
        byType,

        chungBranches,
        haeBranches,
        yukhapBranches,
        paBranches,
        wonjinBranches,
        hyeongBranches,
        damagedBranches,
        damageTypes,
      },
    },

    dayMaster: {
      stem: dayStem,
      element: dmElement,
    },

    dayMasterRoleByElement: {
      WOOD: dayMasterRole('WOOD', dmElement),
      FIRE: dayMasterRole('FIRE', dmElement),
      EARTH: dayMasterRole('EARTH', dmElement),
      METAL: dayMasterRole('METAL', dmElement),
      WATER: dayMasterRole('WATER', dmElement),
    },

    month: {
      branch: pillars.month.branch,
      element: branchElement(pillars.month.branch),
      seasonGroup: seasonGroupOfMonthBranch(pillars.month.branch),
      mainHiddenStem: monthMain,
      mainTenGod: monthMainTG,
      hiddenStems: monthHiddenStems,
      mainHiddenStemVisible: monthMainVisible,
      gyeok: { stem: gyeokStem, tenGod: gyeokTenGod, method: gyeokMethod, support: groupSupport, candidates: monthGyeokCandidates, quality: monthGyeokQuality },
    },

    elements: {
      total: elementDistribution.total,
      totalSum: sum,
      normalized,
      normalizedArr: ELEMENT_ORDER.map((e) => normalized[e]),
    },

    patterns: { ...computeElementPatterns(config, normalized), transformations },

    tenGodScores: scoring.tenGods,
    tenGodScoresRanking,
    tenGodScoresBest,
    climate,
    tongguan,
    strength: computeStrengthFacts({ config, tenGods: scoring.tenGods, dayMasterStem: pillars.day.stem, monthBranch: pillars.month.branch, stems, branches, hiddenStemPolicy, seasonGroup: seasonGroupOfMonthBranch(pillars.month.branch) }),

    shinsal: {
      twelveSal: { year: twelveSalYear, day: twelveSalDay },

      // Backward-compatible shortcuts (pre-existing fields)
      peach: { year: twelveSalYear.DOHWA, day: twelveSalDay.DOHWA },
      horse: { year: twelveSalYear.YEOKMA, day: twelveSalDay.YEOKMA },
      huagai: { year: twelveSalYear.HUAGAI, day: twelveSalDay.HUAGAI },
      jangseong: { year: twelveSalYear.JANGSEONG, day: twelveSalDay.JANGSEONG },
      jaesal: { year: twelveSalYear.JAESAL, day: twelveSalDay.JAESAL },
      hongluan: { year: shinsalHongluanOf(pillars.year.branch) },
      cheonhui: { year: shinsalCheonhuiOf(pillars.year.branch) },
      gongmang: { day: shinsalGongmangOfDayPillar(pillars.day) },

      specialDays: {
        CHEON_SA: {
          season: cheonSaTarget.season,
          targetDayPillar: { stem: cheonSaTarget.target.stem, branch: cheonSaTarget.target.branch },
          targetDayPillarHanja: cheonSaTarget.targetHanja,
          active: cheonSaActive,
          matchedPillars: cheonSaActive ? (['month', 'day'] as const) : (['month'] as const),
        },
      },

      relationSal,

      catalog: buildCatalogFacts({
        config,
        catalog: readShinsalCatalogFromConfig(config),
        dayStem,
        pillars,
        chartBranches: branches,
        chartStems: stems,
      }),
    },

    config: {
      schemaVersion: config.schemaVersion,
      strategies: (config.strategies as any) ?? {},
      weights: (config.weights as any) ?? {},
      extensions: (config.extensions as any) ?? {},
    },
  };

  // Optional: 专旺/전왕(일행득기) 정밀 조건팩 (post-pass enrichment)
  // Uses strength/month-gyeok facts, so it must run after the main object is constructed.
  applyZhuanwangConditionPack(config, facts);
  applyFollowPattern(config, facts);

  return facts;
}
