import type { EngineConfig } from '../api/types.js';
import type { BranchIdx, StemIdx } from '../core/cycle.js';
import type { RuleMatch, RuleSet, JsonValue } from './dsl.js';
import { evalRuleSet } from './dsl.js';
import { DEFAULT_SHINSAL_RULESET } from './defaultRuleSets.js';
import { compileShinsalRuleSpec } from './spec/compileShinsalSpec.js';
import { DEFAULT_SHINSAL_CONDITIONS_RULESET } from './defaultShinsalConditions.js';
import { compileShinsalConditionsRuleSpec } from './spec/compileShinsalConditionsSpec.js';
import type { RuleFacts } from './facts.js';
import type {
  ShinsalDamageKey,
  ShinsalPenaltyCombine,
  ShinsalQualityModel,
  ShinsalQualityModelOverride,
} from './packs/shinsalConditionsBasePack.js';
import { DEFAULT_SHINSAL_QUALITY_MODEL } from './packs/shinsalConditionsBasePack.js';

export type ShinsalBasedOn = 'YEAR_BRANCH' | 'DAY_BRANCH' | 'MONTH_BRANCH' | 'OTHER';
export type ShinsalTargetKind = 'BRANCH' | 'STEM' | 'NONE';

export interface ShinsalDetection {
  name: string;
  /** Optional category label for category-level scoring/attenuation (data-first, school-extensible). */
  category?: string;
  basedOn: ShinsalBasedOn;
  targetKind: ShinsalTargetKind;
  targetBranch?: BranchIdx;
  targetStem?: StemIdx;

  /** Optional multi-target provenance (e.g. 관계 기반 살: 충/형/해/파/원진) */
  targetBranches?: BranchIdx[];
  targetStems?: StemIdx[];

  /** Extra structured provenance payload from rulesets (kept as-is). */
  details?: any;
  matchedPillars?: Array<'year' | 'month' | 'day' | 'hour'>;

  /** Quality label derived from the quality model (or emitted explicitly). */
  quality?: 'FULL' | 'WEAK';

  /** Continuous quality multiplier in [0,1] (math-first). */
  qualityWeight?: number;

  /** If true, the hit is treated as fully invalidated (qualityWeight=0). */
  invalidated?: boolean;

  /** Convenience: whether this detection is included in downstream summaries (default: !invalidated). */
  active?: boolean;

  /** Reasons that affected the multiplier (e.g., CHUNG/HAE/...). */
  qualityReasons?: ShinsalDamageKey[];

  /** Convenience: final penalty in [0,1] used to compute qualityWeight = 1 - penalty. */
  conditionPenalty?: number;
}

export interface ShinsalPolicy {
  ruleSet: RuleSet;
  conditionsRuleSet: RuleSet;
  qualityModel: ShinsalQualityModel;
}

export interface ShinsalResult {
  detections: ShinsalDetection[];
  scores: Record<string, number>;
  /** Quality-adjusted scores computed from detections (forward-compatible). */
  scoresAdjusted: Record<string, number>;
  rules: {
    /** Base ruleset (existence) */
    matches: RuleMatch[];
    assertionsFailed: Array<{ ruleId: string; explain?: string }>;

    /** Optional: per-detection conditions trace */
    conditions?: Array<{
      detectionIndex: number;
      detection: Pick<ShinsalDetection, 'name' | 'targetKind' | 'targetBranch' | 'targetStem' | 'targetBranches' | 'matchedPillars'>;
      scores: Record<string, number>;
      penaltyParts: Array<{ key: ShinsalDamageKey; value: number }>;
      combinedPenalty: number;
      qualityWeight: number;
      qualityReasons: ShinsalDamageKey[];
      invalidated: boolean;
      matches: RuleMatch[];
      assertionsFailed: Array<{ ruleId: string; explain?: string }>;
    }>;
  };
}

const DEFAULT_POLICY: ShinsalPolicy = {
  ruleSet: DEFAULT_SHINSAL_RULESET,
  conditionsRuleSet: DEFAULT_SHINSAL_CONDITIONS_RULESET,
  qualityModel: DEFAULT_SHINSAL_QUALITY_MODEL,
};

// Cache compiled policy per EngineConfig identity (engine-level immutability assumption).
// This prevents repeatedly compiling JSON ruleSpecs on every analyze() call.
const POLICY_CACHE = new WeakMap<object, ShinsalPolicy>();

function getCachedPolicy(config: EngineConfig): ShinsalPolicy {
  const key = config as unknown as object;
  const hit = POLICY_CACHE.get(key);
  if (hit) return hit;
  const p = buildPolicy(config);
  POLICY_CACHE.set(key, p);
  return p;
}


function buildPolicy(config: EngineConfig): ShinsalPolicy {
  const compiledFromSpec: RuleSet | null = (() => {
    const spec = (config.extensions as any)?.ruleSpecs?.shinsal;
    if (!spec) return null;
    return compileShinsalRuleSpec(spec);
  })();

  const ruleSet: RuleSet =
    ((config.extensions as any)?.rulesets?.shinsal as RuleSet) ??
    ((config.extensions as any)?.rules?.shinsal as RuleSet) ??
    compiledFromSpec ??
    DEFAULT_POLICY.ruleSet;

  const conditionsRuleSet: RuleSet =
    ((config.extensions as any)?.rulesets?.shinsalConditions as RuleSet) ??
    ((config.extensions as any)?.rules?.shinsalConditions as RuleSet) ??
    (() => {
      const spec = (config.extensions as any)?.ruleSpecs?.shinsalConditions;
      if (!spec) return null;
      return compileShinsalConditionsRuleSpec(spec);
    })() ??
    DEFAULT_POLICY.conditionsRuleSet;

  const qualityModel = readQualityModelFromConfig(config);

  return { ruleSet, conditionsRuleSet, qualityModel };
}

function parseBasedOn(x: any): ShinsalBasedOn {
  return x === 'YEAR_BRANCH' || x === 'DAY_BRANCH' || x === 'MONTH_BRANCH' ? x : 'OTHER';
}

function parseMatchedPillars(x: any): Array<'year' | 'month' | 'day' | 'hour'> | undefined {
  if (!Array.isArray(x)) return undefined;
  const ok = new Set(['year', 'month', 'day', 'hour']);
  const out = x.filter((v) => typeof v === 'string' && ok.has(v)) as Array<'year' | 'month' | 'day' | 'hour'>;
  return out.length ? out : undefined;
}

function parseQuality(x: any): 'FULL' | 'WEAK' | undefined {
  return x === 'FULL' || x === 'WEAK' ? x : undefined;
}

function expandDetections(x: JsonValue): ShinsalDetection[] {
  if (!x || typeof x !== 'object') return [];
  if (Array.isArray(x)) {
    // Allow emitting an array of payloads.
    return x.flatMap((v) => expandDetections(v as any));
  }

  const o: any = x;
  if (typeof o.name !== 'string') return [];

  const basedOn = parseBasedOn(o.basedOn);
  const matchedPillars = parseMatchedPillars(o.matchedPillars);
  const quality = parseQuality(o.quality);
  const qualityWeight = typeof o.qualityWeight === 'number' && Number.isFinite(o.qualityWeight) ? o.qualityWeight : undefined;
  const category = typeof o.category === 'string' && o.category.length > 0 ? o.category : undefined;

  const base: ShinsalDetection = {
    name: o.name,
    category,
    basedOn,
    targetKind: 'NONE',
    matchedPillars,
    quality,
    qualityWeight,
  };

  // 0) explicit NONE target (composite flags)
  if (o.targetKind === 'NONE' || o.noTarget === true) {
    const det: ShinsalDetection = { ...base, targetKind: 'NONE' };
    // Preserve provenance arrays when present.
    if (Array.isArray(o.targetBranches)) det.targetBranches = o.targetBranches.filter((b: any) => typeof b === 'number') as BranchIdx[];
    if (Array.isArray(o.targetStems)) det.targetStems = o.targetStems.filter((s: any) => typeof s === 'number') as StemIdx[];
    if (o.details != null) det.details = o.details;
    return [det];
  }

  // 1) single targetStem
  if (typeof o.targetStem === 'number') {
    const det: ShinsalDetection = { ...base, targetKind: 'STEM', targetStem: o.targetStem as StemIdx };
    if (o.details != null) det.details = o.details;
    return [det];
  }

  // 2) multiple stems -> fan-out
  if (Array.isArray(o.targetStems)) {
    const stems = o.targetStems.filter((s: any) => typeof s === 'number') as StemIdx[];
    return stems.map((s) => {
      const det: ShinsalDetection = { ...base, targetKind: 'STEM', targetStem: s, targetStems: stems };
      if (o.details != null) det.details = o.details;
      return det;
    });
  }

  // 3) single targetBranch
  if (typeof o.targetBranch === 'number') {
    const det: ShinsalDetection = { ...base, targetKind: 'BRANCH', targetBranch: o.targetBranch as BranchIdx };
    if (o.details != null) det.details = o.details;
    return [det];
  }

  // 4) multiple branches -> fan-out
  if (Array.isArray(o.targetBranches)) {
    const branches = o.targetBranches.filter((b: any) => typeof b === 'number') as BranchIdx[];
    return branches.map((b) => {
      const det: ShinsalDetection = { ...base, targetKind: 'BRANCH', targetBranch: b, targetBranches: branches };
      if (o.details != null) det.details = o.details;
      return det;
    });
  }

  return [];
}

function readWeakQualityWeightLegacy(config: EngineConfig): number {
  const raw = (config.strategies as any)?.shinsal?.weakQualityWeight ?? (config.strategies as any)?.shinsal?.weakWeight;
  const v = typeof raw === 'number' ? raw : 0.5;
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}

function readQualityModelFromConfig(config: EngineConfig): ShinsalQualityModel {
  const base: ShinsalQualityModel = {
    ...DEFAULT_SHINSAL_QUALITY_MODEL,
    weights: { ...DEFAULT_SHINSAL_QUALITY_MODEL.weights },
    applyToNames: [...DEFAULT_SHINSAL_QUALITY_MODEL.applyToNames],
    excludeNames: [...DEFAULT_SHINSAL_QUALITY_MODEL.excludeNames],
  };

  const raw = (config.strategies as any)?.shinsal?.conditions;

  if (raw && typeof raw === 'object') {
    const enabled = (raw as any).enabled;
    if (typeof enabled === 'boolean') base.enabled = enabled;

    const combineRaw = (raw as any).combine;
    if (combineRaw === 'max' || combineRaw === 'sum' || combineRaw === 'prob') base.combine = combineRaw;

    const wt = (raw as any).weights;
    if (wt && typeof wt === 'object') {
      for (const k of Object.keys(base.weights) as ShinsalDamageKey[]) {
        const v = (wt as any)[k];
        if (typeof v === 'number' && Number.isFinite(v)) {
          base.weights[k] = Math.min(1, Math.max(0, v));
        }
      }
    }

    const weakThreshold = (raw as any).weakThreshold;
    if (typeof weakThreshold === 'number' && Number.isFinite(weakThreshold)) {
      base.weakThreshold = Math.min(1, Math.max(0, weakThreshold));
    }

    const invalidateThreshold = (raw as any).invalidateThreshold;
    if (typeof invalidateThreshold === 'number' && Number.isFinite(invalidateThreshold)) {
      base.invalidateThreshold = Math.min(1, Math.max(0, invalidateThreshold));
    }

    const applyToNames = (raw as any).applyToNames ?? (raw as any).applyTo ?? (raw as any).onlyNames;
    if (Array.isArray(applyToNames)) {
      base.applyToNames = applyToNames.map(String);
    }

    const exclude = (raw as any).excludeNames ?? (raw as any).exclude ?? (raw as any).excludeShinsal;
    if (Array.isArray(exclude)) {
      base.excludeNames = exclude.map(String);
    }

    return base;
  }

  // Backward-compatible fallback:
  // - v0.11 used a binary damagedBranches → weakQualityWeight multiplier.
  // - We emulate this by setting all penalties to (1 - weakQualityWeight) and using combine=max.
  const weakW = readWeakQualityWeightLegacy(config);
  const penalty = Math.min(1, Math.max(0, 1 - weakW));
  for (const k of Object.keys(base.weights) as ShinsalDamageKey[]) base.weights[k] = penalty;
  base.combine = 'max';
  base.weakThreshold = 1;
  base.invalidateThreshold = 0;

  return base;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function combinePenalty(parts: number[], combine: ShinsalPenaltyCombine): number {
  if (!parts || parts.length === 0) return 0;

  if (combine === 'max') {
    return clamp01(Math.max(...parts.map(clamp01)));
  }

  if (combine === 'sum') {
    return clamp01(parts.reduce((acc, v) => acc + clamp01(v), 0));
  }

  // 'prob': union-probability style: 1 - Π(1 - p_i)
  let prod = 1;
  for (const p of parts) prod *= 1 - clamp01(p);
  return clamp01(1 - prod);
}

type ResolvedQualityModel = {
  weights: Record<ShinsalDamageKey, number>;
  combine: ShinsalPenaltyCombine;
  weakThreshold: number;
  invalidateThreshold: number;
};

function isWhitelisted(list: string[] | undefined, name: string): boolean {
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(name);
}

function mergeQualityModelInto(base: ResolvedQualityModel, ov: ShinsalQualityModelOverride | undefined): void {
  if (!ov) return;

  if (ov.weights && typeof ov.weights === 'object') {
    for (const [k, v] of Object.entries(ov.weights)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      base.weights[k as ShinsalDamageKey] = clamp01(v);
    }
  }

  if (ov.combine === 'max' || ov.combine === 'sum' || ov.combine === 'prob') {
    base.combine = ov.combine;
  }

  if (typeof ov.weakThreshold === 'number' && Number.isFinite(ov.weakThreshold)) {
    base.weakThreshold = clamp01(ov.weakThreshold);
  }

  if (typeof ov.invalidateThreshold === 'number' && Number.isFinite(ov.invalidateThreshold)) {
    base.invalidateThreshold = clamp01(ov.invalidateThreshold);
  }
}

function resolveQualityModelForDetection(qm: ShinsalQualityModel, det: ShinsalDetection): { model: ResolvedQualityModel; applyConditions: boolean } {
  const model: ResolvedQualityModel = {
    weights: { ...qm.weights },
    combine: qm.combine,
    weakThreshold: qm.weakThreshold,
    invalidateThreshold: qm.invalidateThreshold,
  };

  // Merge category/name overrides into the *model parameters*.
  const catOv = det.category ? qm.categories?.[det.category] : undefined;
  mergeQualityModelInto(model, catOv);
  const nameOv = qm.names?.[det.name];
  mergeQualityModelInto(model, nameOv);

  // Decide whether to run condition evaluation.
  // Note: explicit qualityWeight on the detection always bypasses condition evaluation.
  let apply = qm.enabled !== false;

  // Global filters
  if (Array.isArray(qm.excludeNames) && qm.excludeNames.includes(det.name)) apply = false;
  if (!isWhitelisted(qm.applyToNames, det.name)) apply = false;

  // Category-level filters
  if (catOv) {
    if (typeof catOv.enabled === 'boolean') apply = apply && catOv.enabled;
    if (Array.isArray(catOv.excludeNames) && catOv.excludeNames.includes(det.name)) apply = false;
    if (!isWhitelisted(catOv.applyToNames, det.name)) apply = false;
  }

  // Name-level filters
  if (nameOv) {
    if (typeof nameOv.enabled === 'boolean') apply = apply && nameOv.enabled;
    if (Array.isArray(nameOv.excludeNames) && nameOv.excludeNames.includes(det.name)) apply = false;
    if (!isWhitelisted(nameOv.applyToNames, det.name)) apply = false;
  }

  if (typeof det.qualityWeight === 'number' && Number.isFinite(det.qualityWeight)) {
    apply = false;
  }

  return { model, applyConditions: apply };
}

function detectionBaseWeight(d: ShinsalDetection): number {
  // Composite (targetKind=NONE) flags should contribute a constant unit weight.
  if (d.targetKind === 'NONE') return 1;
  if (d.matchedPillars && d.matchedPillars.length > 0) return d.matchedPillars.length;
  return 1;
}

function inferTargetBranches(facts: RuleFacts, d: ShinsalDetection): BranchIdx[] {
  // Prefer explicit grouped targets (e.g., relation-based sal payloads)
  if (Array.isArray(d.targetBranches) && d.targetBranches.length) {
    const out = d.targetBranches.filter((b) => typeof b === 'number') as BranchIdx[];
    return Array.from(new Set(out));
  }

  // Single BRANCH target
  if (d.targetKind === 'BRANCH' && typeof d.targetBranch === 'number') {
    return [d.targetBranch as BranchIdx];
  }

  // For STEM/NONE targets, use matched pillars as the “seat branch” context
  if (Array.isArray(d.matchedPillars) && d.matchedPillars.length) {
    const out: BranchIdx[] = [];
    for (const p of d.matchedPillars) {
      const pillar: any = (facts.chart.pillars as any)?.[p];
      const b = pillar?.branch;
      if (typeof b === 'number') out.push(b as BranchIdx);
    }
    return Array.from(new Set(out));
  }

  return [];
}



function matchedPillarsForBranchTarget(facts: RuleFacts, b: BranchIdx): Array<'year' | 'month' | 'day' | 'hour'> {
  const out: Array<'year' | 'month' | 'day' | 'hour'> = [];
  const pb = facts.chart.pillars;
  if (pb.year.branch === b) out.push('year');
  if (pb.month.branch === b) out.push('month');
  if (pb.day.branch === b) out.push('day');
  if (pb.hour.branch === b) out.push('hour');
  return out;
}

function matchedPillarsForStemTarget(facts: RuleFacts, s: StemIdx): Array<'year' | 'month' | 'day' | 'hour'> {
  const out: Array<'year' | 'month' | 'day' | 'hour'> = [];
  const pb = facts.chart.pillars;
  if (pb.year.stem === s) out.push('year');
  if (pb.month.stem === s) out.push('month');
  if (pb.day.stem === s) out.push('day');
  if (pb.hour.stem === s) out.push('hour');
  return out;
}

/**
 * Canonicalize matchedPillars after fan-out.
 *
 * Facts-side catalogs often compute matchedPillars for a *set* of candidate targets.
 * After we split into per-target detections, we re-bind matchedPillars to the specific target.
 */
function normalizeMatchedPillarsByTarget(facts: RuleFacts, dets: ShinsalDetection[]): ShinsalDetection[] {
  return dets.map((d) => {
    if (d.targetKind === 'BRANCH' && typeof d.targetBranch === 'number') {
      return { ...d, matchedPillars: matchedPillarsForBranchTarget(facts, d.targetBranch) };
    }
    if (d.targetKind === 'STEM' && typeof d.targetStem === 'number') {
      return { ...d, matchedPillars: matchedPillarsForStemTarget(facts, d.targetStem) };
    }
    return d;
  });
}
function applyQualityModel(args: {
  facts: RuleFacts;
  policy: ShinsalPolicy;
  detections: ShinsalDetection[];
}): { detections: ShinsalDetection[]; scoresAdjusted: Record<string, number>; conditionsTrace: ShinsalResult['rules']['conditions'] } {
  const { facts, policy, detections } = args;

  const qm = policy.qualityModel;
  const exclude = new Set(qm.excludeNames ?? []);

  const scoresAdjusted: Record<string, number> = {};
  const conditionsTrace: NonNullable<ShinsalResult['rules']['conditions']> = [];

  for (let i = 0; i < detections.length; i++) {
    const d0 = detections[i]!;

    // If ruleset explicitly emitted a qualityWeight, respect it.
    // Conditions are applied only if qualityWeight is undefined.
    let d: ShinsalDetection = d0;
    let penaltyParts: Array<{ key: ShinsalDamageKey; value: number }> = [];
    let combinedPenalty = 0;
    let qualityReasons: ShinsalDamageKey[] = [];
    let qualityWeight = typeof d.qualityWeight === 'number' ? clamp01(d.qualityWeight) : 1;
    let invalidated = false;
    let condMatches: RuleMatch[] = [];
    let condAssertionsFailed: Array<{ ruleId: string; explain?: string }> = [];
    let condScores: Record<string, number> = {};

    if (typeof d.qualityWeight !== 'number' && !exclude.has(d.name)) {
      const targetBranches = inferTargetBranches(facts, d);

      const det = {
        name: d.name,
        basedOn: d.basedOn,
        targetKind: d.targetKind,
        targetBranch: d.targetBranch,
        targetStem: d.targetStem,
        targetBranches,
        matchedPillars: d.matchedPillars,
      };

      const condFacts: any = {
        ...facts,
        det,
        policy: {
          shinsal: {
            conditions: {
              weights: qm.weights,
              combine: qm.combine,
              weakThreshold: qm.weakThreshold,
              invalidateThreshold: qm.invalidateThreshold,
            },
          },
        },
      };

      const evalRes = evalRuleSet(policy.conditionsRuleSet, condFacts, {});
      condMatches = evalRes.matches;
      condAssertionsFailed = evalRes.assertionsFailed;
      condScores = evalRes.scores;

      // Extract penalty parts
      for (const [k, v] of Object.entries(evalRes.scores)) {
        if (!k.startsWith('cond.penalty.')) continue;
        const kk = k.slice('cond.penalty.'.length);
        if (
          kk === 'CHUNG' ||
          kk === 'HAE' ||
          kk === 'PA' ||
          kk === 'WONJIN' ||
          kk === 'HYEONG' ||
          kk === 'GONGMANG'
        ) {
          const n = typeof v === 'number' ? v : Number(v);
          if (Number.isFinite(n) && n !== 0) penaltyParts.push({ key: kk as ShinsalDamageKey, value: n });
        }
      }

      qualityReasons = penaltyParts.map((p) => p.key);
      combinedPenalty = combinePenalty(penaltyParts.map((p) => p.value), qm.combine);
      qualityWeight = clamp01(1 - combinedPenalty);
      invalidated = qualityWeight <= (qm.invalidateThreshold ?? 0);
    }

    // Label quality
    const weakThreshold = qm.weakThreshold ?? 1;
    const quality: 'FULL' | 'WEAK' = qualityWeight < weakThreshold ? 'WEAK' : 'FULL';

    // Normalize invalidation in one place (also covers excluded / explicit qualityWeight cases)
    const invT = qm.invalidateThreshold ?? 0;
    invalidated = invalidated || qualityWeight <= invT;

    d = {
      ...d,
      // Ensure targetBranches context is always available for conditions/debug (incl. STEM seat branches).
      targetBranches: inferTargetBranches(facts, d),
      quality,
      qualityWeight,
      invalidated,
      active: !invalidated,
      qualityReasons: qualityReasons.length ? qualityReasons : undefined,
      conditionPenalty: combinedPenalty || undefined,
    };

    // Accumulate adjusted scores
    const base = detectionBaseWeight(d);
    const key = `shinsal.${d.name}`;
    const contrib = base * qualityWeight;
    scoresAdjusted[key] = (scoresAdjusted[key] ?? 0) + contrib;

    // Trace
    if (!exclude.has(d.name)) {
      conditionsTrace.push({
        detectionIndex: i,
        detection: {
          name: d.name,
          targetKind: d.targetKind,
          targetBranch: d.targetBranch,
          targetStem: d.targetStem,
          targetBranches: d.targetBranches,
          matchedPillars: d.matchedPillars,
        },
        scores: condScores,
        penaltyParts,
        combinedPenalty,
        qualityWeight,
        qualityReasons,
        invalidated,
        matches: condMatches,
        assertionsFailed: condAssertionsFailed,
      });
    }

    detections[i] = d;
  }

  return { detections, scoresAdjusted, conditionsTrace };
}

export function computeShinsal(config: EngineConfig, facts: RuleFacts): ShinsalResult {
  const policy = getCachedPolicy(config);

  const evalRes = evalRuleSet(policy.ruleSet, facts, {});
  const detectionsRaw = evalRes.emits.flatMap(expandDetections);
  const detectionsNorm = normalizeMatchedPillarsByTarget(facts, detectionsRaw);

  const { detections, scoresAdjusted, conditionsTrace } = applyQualityModel({ facts, policy, detections: detectionsNorm });

  return {
    detections,
    scores: evalRes.scores,
    scoresAdjusted,
    rules: {
      matches: evalRes.matches,
      assertionsFailed: evalRes.assertionsFailed,
      conditions: conditionsTrace,
    },
  };
}
