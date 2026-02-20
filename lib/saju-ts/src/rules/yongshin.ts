import type { EngineConfig } from '../api/types.js';
import type { Element } from '../core/cycle.js';
import { ELEMENT_ORDER, zeroElementVector } from '../core/elementVector.js';
import { controls, generates } from '../core/elements.js';
import type { RuleMatch, RuleSet } from './dsl.js';
import { evalRuleSet } from './dsl.js';
import { DEFAULT_YONGSHIN_RULESET } from './defaultRuleSets.js';
import { DEFAULT_CLIMATE_MODEL, mergeClimateModel, type ClimateModel } from './climate.js';
import { compileYongshinRuleSpec } from './spec/compileYongshinSpec.js';
import type { RuleFacts } from './facts.js';
import { compete, renormalizeScale } from '../core/competition.js';

export type YongshinRole = 'COMPANION' | 'RESOURCE' | 'OUTPUT' | 'WEALTH' | 'OFFICER';

export interface YongshinPolicy {
  weights: {
    balance: number;
    role: number;
    climate: number;
    /** Disease/medicine (病藥) style term based on excess element control. */
    medicine: number;

    /** 通關(통관) term (bridge element from controlling-pair “battle” intensity). */
    tongguan: number;

    /** 從勢/從格(종격) follow-trend term (experimental). */
    follow: number;

    /** 調候 “template” bonus term (궁통보감 계열의 간단 힌트). */
    johooTemplate: number;

    /** 合化/化气(화격) term based on `patterns.transformations.best.factor` (continuous signal). */
    transformations: number;

    /** 一行得气/专旺(전왕) term based on `patterns.elements.oneElement.(zhuanwangFactor|factor)` (continuous signal). */
    oneElement: number;
  };
  target: 'uniform';
  tieBreakOrder: Element[];
  ruleSet: RuleSet;

  climate: {
    enabled: boolean;
    model: ClimateModel;
  };

  /** Optional dynamic weighting: “调候为急” (prioritize climate when need is large). */
  climateUrgency?: {
    enabled: boolean;
    /** If |need| <= threshold, no reweighting. */
    threshold: number;
    /** Max multiplicative boost applied to climate weight at |need|≈1. */
    maxBoost: number;
    /** Fractional reduction applied to non-climate weights at |need|≈1. */
    reduceOthers: number;
  };

  /** Optional meta-selector that can dynamically blend multiple methods (调候/病药/通关/从势). */
  methodSelector?: {
    enabled: boolean;

    climate?: {
      enabled: boolean;
      threshold: number;
      maxBoost: number;
      reduceOthers: number;
    };

    medicine?: {
      enabled: boolean;
      /** Threshold is applied to maxExcessNormalized in [0,1]. */
      threshold: number;
      maxBoost: number;
      reduceOthers: number;
    };

    tongguan?: {
      enabled: boolean;
      threshold: number;
    };

    follow?: {
      enabled: boolean;
      threshold: number;
      weakThreshold: number;
      /** If omitted, defaults to -weakThreshold (symmetric). */
      strongThreshold?: number;
      minDominanceRatio: number;
    };

    johooTemplate?: {
      enabled: boolean;
      /** 'climate' → scale by climateFactor; 'always' → constant. */
      scaleBy: 'climate' | 'always';
    };

    /** 合化/化气(화격) 게이팅: best.factor가 일정 이상일 때 transformations term을 활성화 */
    transformations?: {
      enabled: boolean;
      threshold: number;
    };

    /** 一行得气/专旺(전왕) 게이팅: oneElement signal이 일정 이상일 때 oneElement term을 활성화 */
    oneElement?: {
      enabled: boolean;
      threshold: number;
      /** 'zhuanwang' → zhuanwangFactor 우선(없으면 raw), 'raw' → raw factor */
      factor?: 'zhuanwang' | 'raw';
    };

    /** Optional competition between special-pattern methods (e.g., follow vs transformations vs oneElement). */
    competition?: {
      enabled: boolean;
      methods: string[];
      power: number;
      minKeep: number;
      /** If true, preserve total |weight| mass across competed methods (default: false). */
      renormalize?: boolean;
    };
  };
}

export interface YongshinResult {
  best: Element;
  ranking: Array<{ element: Element; score: number }>;
  scores: Record<Element, number>;
  base: {
    deficiency: Record<Element, number>;
    role: Record<Element, { role: YongshinRole; preference: number }>;
    climate?: {
      env: { temp: number; moist: number };
      need: { temp: number; moist: number };
      scores: Record<Element, number>;
    };
    medicine?: {
      excess: Record<Element, number>;
      scores: Record<Element, number>;
    };

    tongguan?: {
      threshold: number;
      factor: number;
      maxIntensity: number;
      effectiveMaxIntensity?: number;
      sumIntensity?: number;
      dominance?: number;
      dispersion?: number;
      scores: Record<Element, number>;
    };

    follow?: {
      threshold: number;
      factor: number;

      /** Final follow potential used by gating (after boosts/condition packs). */
      potential: number;
      /** Raw follow potential from strength/dominance (pre one-element boost). */
      potentialRaw?: number;
      /** Potential after one-element boost, before jonggyeok(从格) condition pack (if any). */
      potentialBoosted?: number;

      /** Concentration factor used for optional one-element boost (0..1). */
      oneElementFactor?: number;
      /** Boost coefficient applied to oneElementFactor. */
      oneElementBoost?: number;

      /** Optional: jonggyeok(从格/종격) condition factor in [0,1]. */
      jonggyeokConditionFactor?: number;

      dominanceRatio: number;
      mode?: 'PRESSURE' | 'SUPPORT' | 'NONE';
      dominantRole: YongshinRole;

      /** Optional: typed follow classification from patterns.follow.followType. */
      followType?: string;
      /** Optional: dominant ten-god inside dominantRole group (e.g., JEONG_GWAN vs PYEON_GWAN). */
      followTenGod?: string;
      /** Optional: 0..1 confidence for followTenGod split. */
      followSubtypeConfidence?: number;

      scores: Record<Element, number>;
    };

    johooTemplate?: {
      factor: number;
      bonus: Record<Element, number>;
      primary: Element;
      secondary: Element;
      reasons: string[];
    };

    transformations?: {
      threshold: number;
      factor: number;
      bestFactor: number;
      best?: { pair: string; resultElement: Element };
      scores: Record<Element, number>;
    };

    oneElement?: {
      threshold: number;
      factor: number;
      signal: number;
      element?: Element;
      scores: Record<Element, number>;
    };

    methodSelector?: {
      enabled: boolean;
      climate?: { magnitude: number; threshold: number; factor: number };
      medicine?: { maxExcess: number; maxExcessNormalized: number; threshold: number; factor: number };
      tongguan?: { maxIntensity: number; effectiveMaxIntensity?: number; dominance?: number; threshold: number; factor: number };
      follow?: {
        potential: number;
        potentialRaw?: number;
        potentialBoosted?: number;
        oneElementFactor?: number;
        oneElementBoost?: number;
        jonggyeokConditionFactor?: number;
        dominanceRatio: number;
        mode?: 'PRESSURE' | 'SUPPORT' | 'NONE';

        /** Optional: typed follow classification from patterns.follow.followType. */
        followType?: string;
        /** Optional: dominant ten-god inside dominantRole group (e.g., JEONG_GWAN vs PYEON_GWAN). */
        followTenGod?: string;
        /** Optional: 0..1 confidence for followTenGod split. */
        followSubtypeConfidence?: number;

        threshold: number;
        factor: number;
      };
      johooTemplate?: { factor: number; scaleBy: 'climate' | 'always' };
      transformations?: { bestFactor: number; threshold: number; factor: number; pair?: string; resultElement?: Element };
      oneElement?: { signal: number; threshold: number; factor: number; element?: Element };
      competition?: {
        methods: string[];
        power: number;
        minKeep: number;
        signals: Record<string, number>;
        shares: Record<string, number>;
        multipliers: Record<string, number>;
      };
    };
    /** Effective weights after optional urgency reweighting. */
    effectiveWeights: {
      balance: number;
      role: number;
      climate: number;
      medicine: number;
      tongguan: number;
      follow: number;
      johooTemplate: number;
      transformations: number;
      oneElement: number;
    };
    climateUrgency?: { magnitude: number; threshold: number; factor: number };
    strengthIndex: number;
  };
  rules: {
    matches: RuleMatch[];
    assertionsFailed: Array<{ ruleId: string; explain?: string }>;
  };
}

const DEFAULT_POLICY: YongshinPolicy = {
  weights: { balance: 1, role: 1, climate: 0, medicine: 0, tongguan: 0, follow: 0, johooTemplate: 0, transformations: 0, oneElement: 0 },
  target: 'uniform',
  tieBreakOrder: [...ELEMENT_ORDER],
  ruleSet: DEFAULT_YONGSHIN_RULESET,
  climate: {
    enabled: false,
    model: DEFAULT_CLIMATE_MODEL,
  },
  climateUrgency: {
    enabled: false,
    threshold: 0.6,
    maxBoost: 1.0,
    reduceOthers: 0.25,
  },
};

// Cache compiled policy per EngineConfig identity (engine-level immutability assumption).
// This prevents repeatedly compiling JSON ruleSpecs on every analyze() call.
const POLICY_CACHE = new WeakMap<object, YongshinPolicy>();

function getCachedPolicy(config: EngineConfig): YongshinPolicy {
  const key = config as unknown as object;
  const hit = POLICY_CACHE.get(key);
  if (hit) return hit;
  const p = buildPolicy(config);
  POLICY_CACHE.set(key, p);
  return p;
}


function asNumber(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

function roleOf(candidate: Element, dm: Element): YongshinRole {
  if (candidate === dm) return 'COMPANION';
  if (generates(candidate, dm)) return 'RESOURCE';
  if (generates(dm, candidate)) return 'OUTPUT';
  if (controls(dm, candidate)) return 'WEALTH';
  if (controls(candidate, dm)) return 'OFFICER';
  // Should be exhaustive in 5-element system
  return 'COMPANION';
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function maxValue(v: Record<string, number>): number {
  let m = -Infinity;
  for (const x of Object.values(v)) if (typeof x === 'number' && Number.isFinite(x)) m = Math.max(m, x);
  return Number.isFinite(m) ? m : 0;
}

function dominantPressureRole(components: { outputs: number; wealth: number; officers: number }): YongshinRole {
  const a = components.outputs;
  const b = components.wealth;
  const c = components.officers;
  if (a >= b && a >= c) return 'OUTPUT';
  if (b >= a && b >= c) return 'WEALTH';
  return 'OFFICER';
}

function dominantSupportRole(components: { companions: number; resources: number }): YongshinRole {
  return components.companions >= components.resources ? 'COMPANION' : 'RESOURCE';
}

function followPotentialFromStrength(args: {
  strengthIndex: number;
  support: number;
  pressure: number;
  weakThreshold: number;
  strongThreshold: number;
  minDominanceRatio: number;
}): {
  potential: number;
  dominanceRatio: number;
  mode: 'PRESSURE' | 'SUPPORT' | 'NONE';
  weakPotential: number;
  strongPotential: number;
  weakDominanceRatio: number;
  strongDominanceRatio: number;
} {
  const { strengthIndex, support, pressure, weakThreshold, strongThreshold, minDominanceRatio } = args;

  // --- Weak-follow (从弱/从势): follow external pressure (官杀/财/食伤) when DM is very weak.
  const denomWeak = Math.max(1e-9, weakThreshold + 1); // since -1 is the minimum
  const weakFactor = strengthIndex < weakThreshold ? clamp01((weakThreshold - strengthIndex) / denomWeak) : 0;
  const weakDominanceRatio = pressure / Math.max(1e-9, support);
  const weakDomFactor = clamp01((weakDominanceRatio - minDominanceRatio) / Math.max(1e-9, minDominanceRatio));
  const weakPotential = clamp01(weakFactor * weakDomFactor);

  // --- Strong-follow (从旺/专旺): follow internal support (比劫/印) when DM is extremely strong.
  const denomStrong = Math.max(1e-9, 1 - strongThreshold);
  const strongFactor = strengthIndex > strongThreshold ? clamp01((strengthIndex - strongThreshold) / denomStrong) : 0;
  const strongDominanceRatio = support / Math.max(1e-9, pressure);
  const strongDomFactor = clamp01((strongDominanceRatio - minDominanceRatio) / Math.max(1e-9, minDominanceRatio));
  const strongPotential = clamp01(strongFactor * strongDomFactor);

  if (strongPotential > weakPotential) {
    return {
      potential: strongPotential,
      dominanceRatio: strongDominanceRatio,
      mode: strongPotential > 0 ? 'SUPPORT' : 'NONE',
      weakPotential,
      strongPotential,
      weakDominanceRatio,
      strongDominanceRatio,
    };
  }
  return {
    potential: weakPotential,
    dominanceRatio: weakDominanceRatio,
    mode: weakPotential > 0 ? 'PRESSURE' : 'NONE',
    weakPotential,
    strongPotential,
    weakDominanceRatio,
    strongDominanceRatio,
  };
}

function buildPolicy(config: EngineConfig): YongshinPolicy {
  const raw: any = (config.strategies as any)?.yongshin ?? {};
  const weightsRaw: any = raw.weights ?? {};

  const compiledFromSpec: RuleSet | null = (() => {
    const spec = (config.extensions as any)?.ruleSpecs?.yongshin;
    if (!spec) return null;
    return compileYongshinRuleSpec(spec);
  })();

  // Allow ruleSet override via config.extensions.rulesets.{yongshin}
  const rs: RuleSet =
    ((config.extensions as any)?.rulesets?.yongshin as RuleSet) ??
    ((config.extensions as any)?.rules?.yongshin as RuleSet) ??
    compiledFromSpec ??
    DEFAULT_POLICY.ruleSet;

  const tieBreak: Element[] = Array.isArray(raw.tieBreakOrder)
    ? raw.tieBreakOrder.filter((x: any) => ELEMENT_ORDER.includes(x)).concat(ELEMENT_ORDER).filter((v: any, i: number, a: any[]) => a.indexOf(v) === i)
    : DEFAULT_POLICY.tieBreakOrder;

  const climateRaw = raw.climate ?? {};
  const climateEnabled = typeof climateRaw.enabled === 'boolean' ? climateRaw.enabled : DEFAULT_POLICY.climate.enabled;
  const climateModel = mergeClimateModel(DEFAULT_CLIMATE_MODEL, climateRaw.model ?? climateRaw);

  const urgentRaw = raw.climateUrgency ?? {};
  const urgencyEnabled = typeof urgentRaw.enabled === 'boolean' ? urgentRaw.enabled : (DEFAULT_POLICY as any).climateUrgency.enabled;
  const urgencyThreshold = asNumber(urgentRaw.threshold, (DEFAULT_POLICY as any).climateUrgency.threshold);
  const urgencyMaxBoost = asNumber(urgentRaw.maxBoost, (DEFAULT_POLICY as any).climateUrgency.maxBoost);
  const urgencyReduceOthers = asNumber(urgentRaw.reduceOthers, (DEFAULT_POLICY as any).climateUrgency.reduceOthers);

  const followRaw = raw.follow ?? {};
  const followWeakThreshold = asNumber(followRaw.weakThreshold, -0.78);
  const followStrongThreshold = asNumber(followRaw.strongThreshold, Math.abs(followWeakThreshold));
  const followMinDom = asNumber(followRaw.minDominanceRatio, 2.2);

  // Meta-selector (optional): auto-blend methods based on chart signals.
  const selRaw: any = raw.methodSelector ?? raw.selector ?? {};
  const selEnabled = selRaw?.enabled === true;
  const sel = {
    enabled: selEnabled,
    climate: {
      enabled: selRaw?.climate?.enabled !== false,
      threshold: asNumber(selRaw?.climate?.threshold, urgencyThreshold),
      maxBoost: asNumber(selRaw?.climate?.maxBoost, urgencyMaxBoost),
      reduceOthers: asNumber(selRaw?.climate?.reduceOthers, urgencyReduceOthers),
    },
    medicine: {
      enabled: selRaw?.medicine?.enabled !== false,
      threshold: asNumber(selRaw?.medicine?.threshold, 0.18),
      maxBoost: asNumber(selRaw?.medicine?.maxBoost, 0.9),
      reduceOthers: asNumber(selRaw?.medicine?.reduceOthers, 0.15),
    },
    tongguan: {
      enabled: selRaw?.tongguan?.enabled !== false,
      threshold: asNumber(selRaw?.tongguan?.threshold, 0.25),
    },
    follow: {
      enabled: selRaw?.follow?.enabled !== false,
      threshold: asNumber(selRaw?.follow?.threshold, 0.55),
      weakThreshold: asNumber(selRaw?.follow?.weakThreshold, followWeakThreshold),
      strongThreshold: asNumber(selRaw?.follow?.strongThreshold, followStrongThreshold),
      minDominanceRatio: asNumber(selRaw?.follow?.minDominanceRatio, followMinDom),
    },
    johooTemplate: {
      enabled: selRaw?.johooTemplate?.enabled !== false,
      scaleBy: selRaw?.johooTemplate?.scaleBy === 'always' ? 'always' : 'climate',
    },

    transformations: {
      enabled: selRaw?.transformations?.enabled !== false,
      threshold: asNumber(selRaw?.transformations?.threshold, 0.55),
    },

    oneElement: {
      enabled: selRaw?.oneElement?.enabled !== false,
      threshold: asNumber(selRaw?.oneElement?.threshold, 0.62),
      factor: selRaw?.oneElement?.factor === 'raw' ? 'raw' : 'zhuanwang',
    },

    competition: {
      enabled: selRaw?.competition?.enabled === true,
      methods: Array.isArray(selRaw?.competition?.methods) ? (selRaw.competition.methods as string[]) : ['follow', 'transformations', 'oneElement'],
      power: asNumber(selRaw?.competition?.power, 2.0),
      minKeep: asNumber(selRaw?.competition?.minKeep, 0.2),
      renormalize: selRaw?.competition?.renormalize === true,
    },
  } as YongshinPolicy['methodSelector'];

  return {
    ...DEFAULT_POLICY,
    weights: {
      balance: asNumber(weightsRaw.balance, DEFAULT_POLICY.weights.balance),
      role: asNumber(weightsRaw.role, DEFAULT_POLICY.weights.role),
      climate: asNumber(weightsRaw.climate, DEFAULT_POLICY.weights.climate),
      medicine: asNumber(weightsRaw.medicine, (DEFAULT_POLICY as any).weights.medicine),
      tongguan: asNumber(weightsRaw.tongguan, (DEFAULT_POLICY as any).weights.tongguan),
      follow: asNumber(weightsRaw.follow, (DEFAULT_POLICY as any).weights.follow),
      johooTemplate: asNumber(weightsRaw.johooTemplate, (DEFAULT_POLICY as any).weights.johooTemplate),
      transformations: asNumber(weightsRaw.transformations, (DEFAULT_POLICY as any).weights.transformations),
      oneElement: asNumber(weightsRaw.oneElement, (DEFAULT_POLICY as any).weights.oneElement),
    },
    ruleSet: rs,
    tieBreakOrder: tieBreak,
    climate: {
      enabled: climateEnabled,
      model: climateModel,
    },
    climateUrgency: {
      enabled: urgencyEnabled,
      threshold: urgencyThreshold,
      maxBoost: urgencyMaxBoost,
      reduceOthers: urgencyReduceOthers,
    },

    methodSelector: sel,
  };
}

function uniformTarget(): Record<Element, number> {
  return { WOOD: 0.2, FIRE: 0.2, EARTH: 0.2, METAL: 0.2, WATER: 0.2 };
}

export function computeYongshin(config: EngineConfig, facts: RuleFacts): YongshinResult {
  const policy = getCachedPolicy(config);

  const target = policy.target === 'uniform' ? uniformTarget() : uniformTarget();
  const deficiency: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };

  for (const e of ELEMENT_ORDER) {
    const d = (target as any)[e] - (facts.elements.normalized as any)[e];
    deficiency[e] = Math.max(0, d); // only deficiency contributes
  }

  // Strength index drives role preference blending.
  const s = facts.strength.index;
  const t = clamp01((s + 1) / 2);

  // Weak vs Strong preference profile (math-first baseline).
  const weakPref: Record<YongshinRole, number> = {
    RESOURCE: 1.0,
    COMPANION: 0.6,
    OUTPUT: -0.2,
    WEALTH: -0.4,
    OFFICER: -0.4,
  };

  const strongPref: Record<YongshinRole, number> = {
    RESOURCE: -0.2,
    COMPANION: -0.1,
    OUTPUT: 0.8,
    WEALTH: 0.6,
    OFFICER: 0.6,
  };

  const roleInfo: Record<Element, { role: YongshinRole; preference: number }> = {
    WOOD: { role: 'COMPANION', preference: 0 },
    FIRE: { role: 'COMPANION', preference: 0 },
    EARTH: { role: 'COMPANION', preference: 0 },
    METAL: { role: 'COMPANION', preference: 0 },
    WATER: { role: 'COMPANION', preference: 0 },
  };

  const baseScores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };

  // --- Base signals (facts-based)
  const climateFacts: any = (facts as any).climate ?? { env: { temp: 0, moist: 0 }, need: { temp: 0, moist: 0 }, scores: {} };
  const climateEnabled = !!policy.climate.enabled;
  const needVec = climateEnabled ? (climateFacts.need ?? { temp: 0, moist: 0 }) : { temp: 0, moist: 0 };
  const climateMagnitude = Math.sqrt((needVec.temp ?? 0) * (needVec.temp ?? 0) + (needVec.moist ?? 0) * (needVec.moist ?? 0));

  // --- Disease/medicine (病藥) proxy: reward elements that control excessive elements.
  const excess: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const e of ELEMENT_ORDER) {
    const x = (facts.elements.normalized as any)[e];
    const t0 = (target as any)[e];
    excess[e] = Math.max(0, x - t0);
  }

  const maxExcess = maxValue(excess);
  // Max theoretical excess is 0.8 when one element is 1.0 and target is 0.2.
  const maxExcessNormalized = clamp01(maxExcess / 0.8);

  const medicineScores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const cand of ELEMENT_ORDER) {
    let s0 = 0;
    for (const over of ELEMENT_ORDER) {
      if (controls(cand, over)) s0 += excess[over];
    }
    medicineScores[cand] = s0;
  }

  // --- 通關(통관) bridge scores (facts.tongguan is already computed from normalized).
  const tg: any = (facts as any).tongguan ?? {};
  const tgPairs: any = tg.pairs ?? {};
  const tongguanScores: Record<Element, number> = {
    WOOD: tgPairs?.waterFire?.weightedIntensity ?? tgPairs?.waterFire?.intensity ?? 0,
    EARTH: tgPairs?.fireMetal?.weightedIntensity ?? tgPairs?.fireMetal?.intensity ?? 0,
    WATER: tgPairs?.metalWood?.weightedIntensity ?? tgPairs?.metalWood?.intensity ?? 0,
    FIRE: tgPairs?.woodEarth?.weightedIntensity ?? tgPairs?.woodEarth?.intensity ?? 0,
    METAL: tgPairs?.earthWater?.weightedIntensity ?? tgPairs?.earthWater?.intensity ?? 0,
  };
  const tongguanRawMaxIntensity = typeof tg.maxIntensity === 'number' ? tg.maxIntensity : maxValue(tongguanScores as any);
  const tongguanEffectiveMaxIntensity =
    typeof tg.effectiveMaxIntensity === 'number' ? tg.effectiveMaxIntensity : tongguanRawMaxIntensity;
  const tongguanMaxIntensity = tongguanEffectiveMaxIntensity;

  // --- 從勢(종격) follow potential + dominant role
  const selPol = (policy as any).methodSelector ?? ({ enabled: false } as any);
  const followPol = selPol?.follow ?? ({ enabled: false, weakThreshold: -0.78, strongThreshold: 0.78, minDominanceRatio: 2.2, threshold: 0.55 } as any);

  // Optional: if patterns.follow is explicitly enabled, reuse it (so that schools/presets can
  // inject a “jonggyeok condition pack” without changing yongshin internals).
  const followPat: any = (facts as any).patterns?.follow;
  const followPatEnabled = !!(followPat && typeof followPat === 'object' && followPat.enabled === true);

  const followInfo = followPatEnabled
    ? {
        mode: (followPat.mode ?? 'NONE') as 'PRESSURE' | 'SUPPORT' | 'NONE',
        dominanceRatio:
          typeof followPat.dominanceRatio === 'number' && Number.isFinite(followPat.dominanceRatio) ? followPat.dominanceRatio : 0,
        potential:
          typeof followPat.potentialRaw === 'number' && Number.isFinite(followPat.potentialRaw) ? followPat.potentialRaw : 0,
      }
    : followPotentialFromStrength({
        strengthIndex: s,
        support: facts.strength.support,
        pressure: facts.strength.pressure,
        weakThreshold: followPol.weakThreshold,
        strongThreshold: typeof followPol.strongThreshold === 'number' ? followPol.strongThreshold : Math.abs(followPol.weakThreshold),
        minDominanceRatio: followPol.minDominanceRatio,
      });

  // Optional: “일행득기/专旺” style concentration can boost follow confidence.
  const oneEl = (facts as any).patterns?.elements?.oneElement;
  const oneElRaw = typeof oneEl?.factor === 'number' && Number.isFinite(oneEl.factor) ? oneEl.factor : 0;
  const oneElZhuanwang =
    typeof oneEl?.zhuanwangFactor === 'number' && Number.isFinite(oneEl.zhuanwangFactor) ? oneEl.zhuanwangFactor : 0;

  const oneElFactor = followPatEnabled
    ? (typeof followPat.oneElementFactor === 'number' && Number.isFinite(followPat.oneElementFactor) ? followPat.oneElementFactor : 0)
    : oneElZhuanwang > 0
      ? oneElZhuanwang
      : oneElRaw;

  const oneElBoost = followPatEnabled
    ? (typeof followPat.oneElementBoost === 'number' && Number.isFinite(followPat.oneElementBoost) ? followPat.oneElementBoost : 0)
    : typeof (followPol as any).oneElementBoost === 'number' && Number.isFinite((followPol as any).oneElementBoost)
      ? (followPol as any).oneElementBoost
      : 0.35;

  const followPotentialBoosted = followPatEnabled
    ? (typeof followPat.potential === 'number' && Number.isFinite(followPat.potential) ? followPat.potential : 0)
    : clamp01(followInfo.potential * (1 + oneElFactor * oneElBoost));

  const jonggyeokConditionFactor =
    followPatEnabled && typeof followPat.jonggyeokConditionFactor === 'number' && Number.isFinite(followPat.jonggyeokConditionFactor)
      ? followPat.jonggyeokConditionFactor
      : undefined;

  const followPotential =
    followPatEnabled && typeof followPat.jonggyeokFactor === 'number' && Number.isFinite(followPat.jonggyeokFactor)
      ? followPat.jonggyeokFactor
      : followPotentialBoosted;

  const followMode: 'PRESSURE' | 'SUPPORT' | 'NONE' = followPatEnabled
    ? ((followPat.mode ?? 'NONE') as any)
    : (followInfo.mode as any);

  const domRole: YongshinRole = followPatEnabled && typeof followPat.dominantRole === 'string'
    ? (followPat.dominantRole as YongshinRole)
    : followMode === 'SUPPORT'
      ? dominantSupportRole(facts.strength.components)
      : followMode === 'PRESSURE'
        ? dominantPressureRole(facts.strength.components)
        : 'COMPANION';

  const followScores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const e of ELEMENT_ORDER) {
    const r = roleOf(e, facts.dayMaster.element);
    if (followMode === 'SUPPORT') {
      const other = domRole === 'COMPANION' ? 'RESOURCE' : 'COMPANION';
      followScores[e] =
        r === domRole ? (facts.elements.normalized as any)[e] : r === other ? 0.5 * (facts.elements.normalized as any)[e] : 0;
    } else if (followMode === 'PRESSURE') {
      followScores[e] = r === domRole ? (facts.elements.normalized as any)[e] : 0;
    } else {
      followScores[e] = 0;
    }
  }


  // --- 調候 템플릿(궁통보감 힌트) bonus
  const tpl: any = climateFacts?.template;
  const templateBonus: Record<Element, number> = tpl?.bonus ?? { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };

  // --- 合化/化气(화격) transformation best signal
  const tf: any = (facts as any).patterns?.transformations;
  const tfBest: any = tf && typeof tf === 'object' ? (tf as any).best : null;
  const tfBestFactor: number =
    tfBest && typeof (tfBest as any).huaqiFactor === 'number' && Number.isFinite((tfBest as any).huaqiFactor)
      ? (tfBest as any).huaqiFactor
      : tfBest && typeof (tfBest as any).effectiveFactor === 'number' && Number.isFinite((tfBest as any).effectiveFactor)
        ? (tfBest as any).effectiveFactor
        : tfBest && typeof tfBest.factor === 'number' && Number.isFinite(tfBest.factor)
          ? tfBest.factor
          : 0;
  const tfBestElement: Element | null =
    tfBest && typeof tfBest.resultElement === 'string' && (ELEMENT_ORDER as any).includes(tfBest.resultElement)
      ? (tfBest.resultElement as Element)
      : null;
  const transformationScores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  if (tfBestElement) transformationScores[tfBestElement] = tfBestFactor;

  // --- 一行得气/专旺(전왕) one-element dominance signal
  const oneElElement: Element | null =
    oneEl && typeof oneEl.element === 'string' && (ELEMENT_ORDER as any).includes(oneEl.element) ? (oneEl.element as Element) : null;
  const oneElSignalForTerm =
    (selPol as any)?.oneElement?.factor === 'raw' ? oneElRaw : oneElZhuanwang > 0 ? oneElZhuanwang : oneElRaw;
  const oneElementScores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  if (oneElElement) oneElementScores[oneElElement] = clamp01(oneElSignalForTerm);

  // --- Effective weights (legacy urgency OR meta-selector)
  const effectiveWeights = { ...policy.weights };

  let climateUrgencyOut: YongshinResult['base']['climateUrgency'] | undefined = undefined;
  let methodSelectorOut: YongshinResult['base']['methodSelector'] | undefined = undefined;
  let tongguanOut: YongshinResult['base']['tongguan'] | undefined = undefined;
  let followOut: YongshinResult['base']['follow'] | undefined = undefined;
  let templateOut: YongshinResult['base']['johooTemplate'] | undefined = undefined;
  let transformationsOut: YongshinResult['base']['transformations'] | undefined = undefined;
  let oneElementOut: YongshinResult['base']['oneElement'] | undefined = undefined;

  if (selPol?.enabled) {
    const out: any = { enabled: true };

    // --- climate weighting (调候为急)
    if (selPol?.climate?.enabled && climateEnabled && effectiveWeights.climate !== 0) {
      const thr = typeof selPol.climate.threshold === 'number' ? selPol.climate.threshold : 0.6;
      const factor = clamp01((climateMagnitude - thr) / Math.max(1e-9, 1 - thr));
      if (factor > 0) {
        const boost = typeof selPol.climate.maxBoost === 'number' ? selPol.climate.maxBoost : 1.0;
        const reduceOthers = typeof selPol.climate.reduceOthers === 'number' ? selPol.climate.reduceOthers : 0.25;

        effectiveWeights.climate = effectiveWeights.climate * (1 + boost * factor);
        const k = 1 - reduceOthers * factor;
        effectiveWeights.balance *= k;
        effectiveWeights.role *= k;
        effectiveWeights.medicine *= k;
        effectiveWeights.tongguan *= k;
        effectiveWeights.follow *= k;
        effectiveWeights.johooTemplate *= k;
      }
      out.climate = { magnitude: climateMagnitude, threshold: thr, factor };
    }

    // --- medicine weighting (病藥)
    if (selPol?.medicine?.enabled && effectiveWeights.medicine !== 0) {
      const thr = typeof selPol.medicine.threshold === 'number' ? selPol.medicine.threshold : 0.18;
      const factor = clamp01((maxExcessNormalized - thr) / Math.max(1e-9, 1 - thr));
      if (factor > 0) {
        const boost = typeof selPol.medicine.maxBoost === 'number' ? selPol.medicine.maxBoost : 0.9;
        const reduceOthers = typeof selPol.medicine.reduceOthers === 'number' ? selPol.medicine.reduceOthers : 0.15;

        effectiveWeights.medicine = effectiveWeights.medicine * (1 + boost * factor);
        const k = 1 - reduceOthers * factor;
        effectiveWeights.balance *= k;
        effectiveWeights.role *= k;
        effectiveWeights.climate *= k;
        effectiveWeights.tongguan *= k;
        effectiveWeights.follow *= k;
        effectiveWeights.johooTemplate *= k;
      }
      out.medicine = { maxExcess, maxExcessNormalized, threshold: thr, factor };
    }

    // --- tongguan gating
    if (selPol?.tongguan?.enabled && effectiveWeights.tongguan !== 0) {
      const thr = typeof selPol.tongguan.threshold === 'number' ? selPol.tongguan.threshold : 0.25;
      const factor = clamp01((tongguanMaxIntensity - thr) / Math.max(1e-9, 1 - thr));
      effectiveWeights.tongguan = effectiveWeights.tongguan * factor;
      tongguanOut = {
        threshold: thr,
        factor,
        maxIntensity: tongguanRawMaxIntensity,
        effectiveMaxIntensity: tongguanEffectiveMaxIntensity,
        sumIntensity: typeof tg.sumIntensity === 'number' ? tg.sumIntensity : undefined,
        dominance: typeof tg.dominance === 'number' ? tg.dominance : undefined,
        dispersion: typeof tg.dispersion === 'number' ? tg.dispersion : undefined,
        scores: tongguanScores,
      };
      out.tongguan = {
        maxIntensity: tongguanRawMaxIntensity,
        effectiveMaxIntensity: tongguanEffectiveMaxIntensity,
        dominance: typeof tg.dominance === 'number' ? tg.dominance : undefined,
        threshold: thr,
        factor,
      };
    }

    // --- follow gating
    if (selPol?.follow?.enabled && effectiveWeights.follow !== 0) {
      const thr = typeof selPol.follow.threshold === 'number' ? selPol.follow.threshold : 0.55;
      const factor = clamp01((followPotential - thr) / Math.max(1e-9, 1 - thr));

      const followTypeHint = followPatEnabled && typeof (followPat as any)?.followType === 'string' ? String((followPat as any).followType) : undefined;
      const followTenGodHint = followPatEnabled && typeof (followPat as any)?.followTenGod === 'string' ? String((followPat as any).followTenGod) : undefined;
      const followSubtypeConfidenceHint =
        followPatEnabled && (followPat as any)?.followTenGodSplit && typeof (followPat as any).followTenGodSplit.confidence === 'number'
          ? ((followPat as any).followTenGodSplit.confidence as number)
          : undefined;

      effectiveWeights.follow = effectiveWeights.follow * factor;
      followOut = {
        threshold: thr,
        factor,
        potential: followPotential,
        potentialRaw: followInfo.potential,
        potentialBoosted: followPotentialBoosted,
        oneElementFactor: oneElFactor,
        oneElementBoost: oneElBoost,
        jonggyeokConditionFactor,
        dominanceRatio: followInfo.dominanceRatio,
        mode: followInfo.mode,
        dominantRole: domRole,
        followType: followTypeHint,
        followTenGod: followTenGodHint,
        followSubtypeConfidence: followSubtypeConfidenceHint,
        scores: followScores,
      };
      out.follow = {
        potential: followPotential,
        potentialRaw: followInfo.potential,
        potentialBoosted: followPotentialBoosted,
        oneElementFactor: oneElFactor,
        oneElementBoost: oneElBoost,
        jonggyeokConditionFactor,
        dominanceRatio: followInfo.dominanceRatio,
        mode: followInfo.mode,
        followType: followTypeHint,
        followTenGod: followTenGodHint,
        followSubtypeConfidence: followSubtypeConfidenceHint,
        threshold: thr,
        factor,
      };
    }

    // --- johoo template scaling
    if (selPol?.johooTemplate?.enabled && effectiveWeights.johooTemplate !== 0 && tpl?.enabled) {
      const scaleBy = selPol.johooTemplate.scaleBy === 'always' ? 'always' : 'climate';
      const factor = scaleBy === 'always' ? 1 : (out.climate?.factor ?? 0);
      effectiveWeights.johooTemplate = effectiveWeights.johooTemplate * factor;
      templateOut = {
        factor,
        bonus: templateBonus,
        primary: tpl.primary,
        secondary: tpl.secondary,
        reasons: tpl.reasons ?? [],
      };
      out.johooTemplate = { factor, scaleBy };
    }

    // --- transformations gating (合化/化气/화격)
    if (selPol?.transformations?.enabled && effectiveWeights.transformations !== 0) {
      const thr = typeof selPol.transformations.threshold === 'number' ? selPol.transformations.threshold : 0.55;
      const factor = clamp01((tfBestFactor - thr) / Math.max(1e-9, 1 - thr));
      effectiveWeights.transformations = effectiveWeights.transformations * factor;

      transformationsOut = {
        threshold: thr,
        factor,
        bestFactor: tfBestFactor,
        best: tfBestElement && tfBest && typeof tfBest.pair === 'string' ? { pair: tfBest.pair, resultElement: tfBestElement } : undefined,
        scores: transformationScores,
      };
      out.transformations = {
        bestFactor: tfBestFactor,
        threshold: thr,
        factor,
        pair: tfBest && typeof tfBest.pair === 'string' ? tfBest.pair : undefined,
        resultElement: tfBestElement ?? undefined,
      };
    }



    

    // --- one-element dominance gating (一行得气/专旺)
    if (selPol?.oneElement?.enabled && (effectiveWeights as any).oneElement !== 0) {
      const thr = typeof selPol.oneElement.threshold === 'number' ? selPol.oneElement.threshold : 0.62;
      const signal = clamp01(oneElSignalForTerm);
      const factor = clamp01((signal - thr) / Math.max(1e-9, 1 - thr));
      (effectiveWeights as any).oneElement = (effectiveWeights as any).oneElement * factor;
      oneElementOut = {
        threshold: thr,
        factor,
        signal,
        element: oneElElement ?? undefined,
        scores: oneElementScores,
      };
      (out as any).oneElement = { signal, threshold: thr, factor, element: oneElElement ?? undefined };
    }
    // --- Optional competition between special-pattern methods (mutual attenuation).
    // Motivation: when multiple “special pattern” signals are simultaneously strong,
    // many schools prioritize the clearer/stronger pattern instead of stacking all bonuses.
    const compPol: any = selPol?.competition ?? {};
    if (compPol?.enabled === true) {
      const power = asNumber(compPol.power, 2.0);
      const minKeep = clamp01(asNumber(compPol.minKeep, 0.2));
      const renormalize = compPol.renormalize === true;
      const methods = Array.isArray(compPol.methods) ? (compPol.methods as string[]) : ['follow', 'transformations', 'oneElement'];

      const items: Array<{
        name: string;
        signal: number;
        get: () => number;
        set: (v: number) => void;
      }> = [];

      if (methods.includes('follow') && effectiveWeights.follow !== 0) {
        items.push({
          name: 'follow',
          signal: clamp01(followPotential),
          get: () => effectiveWeights.follow,
          set: (v) => {
            effectiveWeights.follow = v;
          },
        });
      }

      if (methods.includes('transformations') && effectiveWeights.transformations !== 0) {
        items.push({
          name: 'transformations',
          signal: clamp01(tfBestFactor),
          get: () => effectiveWeights.transformations,
          set: (v) => {
            effectiveWeights.transformations = v;
          },
        });
      }

      if (methods.includes('oneElement') && (effectiveWeights as any).oneElement !== 0) {
        items.push({
          name: 'oneElement',
          signal: clamp01(oneElSignalForTerm),
          get: () => (effectiveWeights as any).oneElement,
          set: (v) => {
            (effectiveWeights as any).oneElement = v;
          },
        });
      }

      if (items.length >= 2) {
        const sigMap: Record<string, number> = {};
        for (const it of items) sigMap[it.name] = it.signal;

        const comp = compete(
          items.map((x) => x.name),
          sigMap,
          { power, minKeep },
        );

        const totalBefore = items.reduce((s, it) => s + Math.abs(it.get()), 0);

        const methodTotals: Record<string, { before: number; after: number }> = {};
        for (const it of items) {
          methodTotals[it.name] = { before: Math.abs(it.get()), after: 0 };
          const mul = comp.multipliers[it.name] ?? minKeep;
          it.set(it.get() * mul);
        }

        // Optional renormalization: preserve total |weight| mass across competed methods.
        let scale = 1;
        if (renormalize) {
          const totalAfterRaw = items.reduce((s, it) => s + Math.abs(it.get()), 0);
          scale = renormalizeScale(totalBefore, totalAfterRaw);
          if (scale !== 1) {
            for (const it of items) it.set(it.get() * scale);
          }
        }

        const totalAfter = items.reduce((s, it) => s + Math.abs(it.get()), 0);

        for (const it of items) {
          methodTotals[it.name] = { before: methodTotals[it.name]!.before, after: Math.abs(it.get()) };
        }

        // Winner tracking (largest share)
        let winnerMethod: string | null = null;
        let winnerShare = -1;
        for (const it of items) {
          const sh = comp.shares[it.name] ?? 0;
          if (sh > winnerShare) {
            winnerShare = sh;
            winnerMethod = it.name;
          }
        }

        const winner =
          winnerMethod != null
            ? {
                method: winnerMethod,
                share: comp.shares[winnerMethod] ?? 0,
                signal: sigMap[winnerMethod] ?? 0,
                multiplier: comp.multipliers[winnerMethod] ?? minKeep,
              }
            : undefined;

        (out as any).competition = {
          enabled: true,
          methods: items.map((x) => x.name),
          activeMethods: items.map((x) => x.name),
          power,
          minKeep,
          renormalize,
          scale,
          signals: { ...sigMap },
          shares: { ...comp.shares },
          multipliers: { ...comp.multipliers },
          winner,
          totalBefore,
          totalAfter,
          methodTotals,
        };
      }
    }
methodSelectorOut = out;
  } else {
    // --- Legacy climateUrgency (“调候为急”) preserved for backward compatibility.
    const urgPolicy =
      (policy as any).climateUrgency ?? ({ enabled: false, threshold: 0.6, maxBoost: 1.0, reduceOthers: 0.25 } as any);
    const urgencyThreshold = typeof urgPolicy.threshold === 'number' ? urgPolicy.threshold : 0.6;
    const urgencyFactor = urgPolicy.enabled
      ? clamp01((climateMagnitude - urgencyThreshold) / Math.max(1e-9, 1 - urgencyThreshold))
      : 0;

    if (urgPolicy.enabled && urgencyFactor > 0) {
      const boost = typeof urgPolicy.maxBoost === 'number' ? urgPolicy.maxBoost : 1.0;
      const reduceOthers = typeof urgPolicy.reduceOthers === 'number' ? urgPolicy.reduceOthers : 0.25;

      effectiveWeights.climate = effectiveWeights.climate * (1 + boost * urgencyFactor);

      const k = 1 - reduceOthers * urgencyFactor;
      effectiveWeights.balance = effectiveWeights.balance * k;
      effectiveWeights.role = effectiveWeights.role * k;
      effectiveWeights.medicine = effectiveWeights.medicine * k;
      effectiveWeights.tongguan = effectiveWeights.tongguan * k;
      effectiveWeights.follow = effectiveWeights.follow * k;
      effectiveWeights.johooTemplate = effectiveWeights.johooTemplate * k;
    }

    climateUrgencyOut = urgPolicy.enabled ? { magnitude: climateMagnitude, threshold: urgencyThreshold, factor: urgencyFactor } : undefined;
  }

  for (const e of ELEMENT_ORDER) {
    const r = roleOf(e, facts.dayMaster.element);
    const pref = lerp(weakPref[r], strongPref[r], t);
    roleInfo[e] = { role: r, preference: pref };

    const balanceTerm = effectiveWeights.balance * deficiency[e];
    const roleTerm = effectiveWeights.role * pref;
    const climateTerm = climateEnabled ? effectiveWeights.climate * ((climateFacts.scores as any)?.[e] ?? 0) : 0;
    const medicineTerm = effectiveWeights.medicine * (medicineScores[e] ?? 0);
    const tongguanTerm = effectiveWeights.tongguan * (tongguanScores[e] ?? 0);
    const followTerm = effectiveWeights.follow * (followScores[e] ?? 0);
    const templateTerm = effectiveWeights.johooTemplate * (templateBonus[e] ?? 0);
    const transformationTerm = effectiveWeights.transformations * (transformationScores[e] ?? 0);
    const oneElementTerm = (effectiveWeights as any).oneElement * (oneElementScores[e] ?? 0);

    baseScores[e] = balanceTerm + roleTerm + climateTerm + medicineTerm + tongguanTerm + followTerm + templateTerm + transformationTerm + oneElementTerm;
  }

  // Apply DSL adjustments (optional)
  const init: Record<string, number> = {};
  for (const e of ELEMENT_ORDER) init[`yongshin.${e}`] = baseScores[e];

  const evalRes = evalRuleSet(policy.ruleSet, facts, init);

  // Extract final scores back to Element keys
  const finalScores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const e of ELEMENT_ORDER) finalScores[e] = evalRes.scores[`yongshin.${e}`] ?? baseScores[e];

  // Ranking + tie-break
  const order = [...ELEMENT_ORDER].sort((a, b) => {
    const da = finalScores[a];
    const db = finalScores[b];
    if (db !== da) return db - da;
    return policy.tieBreakOrder.indexOf(a) - policy.tieBreakOrder.indexOf(b);
  });

  const ranking = order.map((e) => ({ element: e, score: finalScores[e] }));
  const best = ranking[0]?.element ?? 'WOOD';

  return {
    best,
    ranking,
    scores: finalScores,
    base: {
      deficiency,
      role: roleInfo,
      climate: climateEnabled
        ? {
            env: { ...(climateFacts.env ?? { temp: 0, moist: 0 }) },
            need: { ...(climateFacts.need ?? { temp: 0, moist: 0 }) },
            scores: { ...(climateFacts.scores ?? {}) },
          }
        : undefined,
      medicine: effectiveWeights.medicine !== 0 ? { excess, scores: medicineScores } : undefined,
      tongguan:
        tongguanOut ??
        (effectiveWeights.tongguan !== 0
          ? {
              threshold: 0,
              factor: 1,
              maxIntensity: tongguanRawMaxIntensity,
              effectiveMaxIntensity: tongguanEffectiveMaxIntensity,
              sumIntensity: typeof tg.sumIntensity === 'number' ? tg.sumIntensity : undefined,
              dominance: typeof tg.dominance === 'number' ? tg.dominance : undefined,
              dispersion: typeof tg.dispersion === 'number' ? tg.dispersion : undefined,
              scores: tongguanScores,
            }
          : undefined),
      follow:
        followOut ??
        (effectiveWeights.follow !== 0
          ? {
              threshold: 0,
              factor: 1,
              potential: followPotential,
              potentialRaw: followInfo.potential,
              potentialBoosted: followPotentialBoosted,
              oneElementFactor: oneElFactor,
              oneElementBoost: oneElBoost,
              jonggyeokConditionFactor,
              dominanceRatio: followInfo.dominanceRatio,
              mode: followInfo.mode,
              dominantRole: domRole,
              scores: followScores,
            }
          : undefined),
      johooTemplate:
        templateOut ??
        (effectiveWeights.johooTemplate !== 0 && tpl?.enabled
          ? { factor: 1, bonus: templateBonus, primary: tpl.primary, secondary: tpl.secondary, reasons: tpl.reasons ?? [] }
          : undefined),
      transformations:
        transformationsOut ??
        (effectiveWeights.transformations !== 0
          ? {
              threshold: 0,
              factor: 1,
              bestFactor: tfBestFactor,
              best: tfBestElement && tfBest && typeof tfBest.pair === 'string' ? { pair: tfBest.pair, resultElement: tfBestElement } : undefined,
              scores: transformationScores,
            }
          : undefined),
      oneElement:
        oneElementOut ??
        ((effectiveWeights as any).oneElement !== 0
          ? {
              threshold: 0,
              factor: 1,
              signal: clamp01(oneElSignalForTerm),
              element: oneElElement ?? undefined,
              scores: oneElementScores,
            }
          : undefined),
      methodSelector: methodSelectorOut,
      effectiveWeights,
      climateUrgency: climateUrgencyOut,
      strengthIndex: s,
    },
    rules: { matches: evalRes.matches, assertionsFailed: evalRes.assertionsFailed },
  };
}
