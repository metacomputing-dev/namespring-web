import type { EngineConfig } from '../api/types.js';
import type { RuleMatch, RuleSet } from './dsl.js';
import { evalRuleSet } from './dsl.js';
import { DEFAULT_GYEOKGUK_RULESET } from './defaultRuleSets.js';
import { compileGyeokgukRuleSpec } from './spec/compileGyeokgukSpec.js';
import type { RuleFacts } from './facts.js';
import { compete, renormalizeScale } from '../core/competition.js';

export type GyeokgukCompetitionMethod = 'follow' | 'transformations' | 'oneElement' | 'tenGod';

export type FollowSignalSelector = 'auto' | 'jonggyeok' | 'potential' | 'raw';
export type TransformSignalSelector = 'auto' | 'huaqi' | 'effective' | 'raw';
export type OneElementSignalSelector = 'auto' | 'zhuanwang' | 'raw';
export type TenGodSignalSelector = 'monthQuality' | 'auto';

type ResolvedCompetitionSignals = {
  follow: FollowSignalSelector;
  transformations: TransformSignalSelector;
  oneElement: OneElementSignalSelector;
  tenGod: TenGodSignalSelector | number;
};

type ResolvedCompetitionPolicy = {
  enabled: boolean;
  methods: string[];
  power: number;
  minKeep: number;
  renormalize: boolean;
  groups: Record<GyeokgukCompetitionMethod, CompetitionKeyGroupSpec>;
  signals: ResolvedCompetitionSignals;
};

export interface CompetitionKeyGroupSpec {
  /** Include keys that start with any of these prefixes. */
  prefixes?: string[];
  /** Include these exact keys (if present in the score map). */
  keys?: string[];
  /** Exclude keys that start with any of these prefixes (after inclusion). */
  excludePrefixes?: string[];
  /** Exclude these exact keys (after inclusion). */
  excludeKeys?: string[];
}

export interface CompetitionSignalSelectors {
  follow?: FollowSignalSelector;
  transformations?: TransformSignalSelector;
  oneElement?: OneElementSignalSelector;
  /** For tenGod axis: use month-gyeok quality multiplier, or a fixed 0..1 constant. */
  tenGod?: TenGodSignalSelector | number;
}

export interface GyeokgukPolicy {
  ruleSet: RuleSet;
  tieBreakOrder: string[];

  /**
   * Optional competition between “special frame” candidates.
   *
   * Motivation: when multiple high-level frames are simultaneously plausible,
   * many schools prioritize the clearer/stronger one instead of stacking.
   *
   * This operates on the *score keys* emitted by the ruleset.
   */
  competition?: {
    enabled: boolean;
    /** Names: 'follow' | 'transformations' | 'oneElement' | 'tenGod'. Unknown strings are ignored. */
    methods: string[];
    /** Softmax-like power (>=0.01). */
    power: number;
    /** Floor multiplier in [0,1]. */
    minKeep: number;
    /** If true, preserve total |score| mass across affected keys (default: true). */
    renormalize?: boolean;

    /**
     * Key grouping per method.
     *
     * Defaults:
     * - follow: prefixes ['gyeokguk.CONG_']
     * - transformations: keys ['gyeokguk.HUA_QI']
     * - oneElement: keys ['gyeokguk.ZHUAN_WANG']
     */
    groups?: Partial<Record<GyeokgukCompetitionMethod, CompetitionKeyGroupSpec>>;

    /**
     * Signal selectors per method (how shares are computed).
     *
     * Defaults are 'auto' which mirrors the engine’s built-in fallbacks:
     * - follow: jonggyeokFactor → potential → potentialRaw
     * - transformations: huaqiFactor → effectiveFactor → factor
     * - oneElement: zhuanwangFactor → factor
     */
    signals?: CompetitionSignalSelectors;
  };
}

export interface GyeokgukCompetition {
  enabled: boolean;
  /** Configured method list (after filtering unknowns). */
  methods: string[];
  /** Methods that actually had non-zero scores (and were competed). */
  activeMethods: string[];
  power: number;
  minKeep: number;
  renormalize: boolean;
  scale: number;

  /** Resolved key groups (post-merge). */
  groups: Record<GyeokgukCompetitionMethod, CompetitionKeyGroupSpec>;
  /** Resolved signal selectors (post-merge). */
  signalSelectors: CompetitionSignalSelectors;

  /** Keys used per active method. */
  methodKeys: Record<string, string[]>;

  signals: Record<string, number>;
  shares: Record<string, number>;
  multipliers: Record<string, number>;

  /** Winner info (largest share among active methods). */
  winner?: { method: string; share: number; signal: number; multiplier: number; keys: string[] };

  totalBefore: number;
  totalAfter: number;

  /** Method-wise totals (sum of |scores| in the method key-group). */
  methodTotals: Record<string, { before: number; after: number }>;

  /** Only keys that had non-zero scores before scaling are included. */
  affected: Record<string, { before: number; after: number }>;
}

export interface GyeokgukResult {
  best: string | null;
  ranking: Array<{ key: string; score: number }>;
  scores: Record<string, number>;
  /** Optional debug payload for special-frame competition (alias of basis.competition). */
  competition?: GyeokgukCompetition;
  basis: {
    /** 월지 본기 십성 */
    monthMainTenGod: string;
    /** 월지 “격”(透干/会支 기반) 십성 */
    monthGyeokTenGod: string;
    /** 월지 격 선정 방법 */
    monthGyeokMethod: string;
    /** 청탁/파격 품질 지표 */
    monthGyeokQuality?: RuleFacts['month']['gyeok']['quality'];

    /** Optional debug payload for special-frame competition. */
    competition?: GyeokgukCompetition;
  };
  rules: {
    matches: RuleMatch[];
    assertionsFailed: Array<{ ruleId: string; explain?: string }>;
  };
}

const TEN_GOD_GROUP_KEYS: string[] = [
  'gyeokguk.JEONG_GWAN',
  'gyeokguk.PYEON_GWAN',
  'gyeokguk.JEONG_JAE',
  'gyeokguk.PYEON_JAE',
  'gyeokguk.SIK_SHIN',
  'gyeokguk.SANG_GWAN',
  'gyeokguk.JEONG_IN',
  'gyeokguk.PYEON_IN',
  'gyeokguk.BI_GYEON',
  'gyeokguk.GEOB_JAE',
];

const DEFAULT_COMP_GROUPS: Record<GyeokgukCompetitionMethod, CompetitionKeyGroupSpec> = {
  follow: { prefixes: ['gyeokguk.CONG_'] },
  transformations: { keys: ['gyeokguk.HUA_QI'] },
  oneElement: { keys: ['gyeokguk.ZHUAN_WANG'] },
  tenGod: { keys: TEN_GOD_GROUP_KEYS },
};

const DEFAULT_COMP_SIGNALS: ResolvedCompetitionSignals = {
  follow: 'auto',
  transformations: 'auto',
  oneElement: 'auto',
  tenGod: 'monthQuality',
};

const DEFAULT_POLICY: GyeokgukPolicy = {
  ruleSet: DEFAULT_GYEOKGUK_RULESET,
  tieBreakOrder: [
    'gyeokguk.JEONG_GWAN',
    'gyeokguk.PYEON_GWAN',
    'gyeokguk.JEONG_JAE',
    'gyeokguk.PYEON_JAE',
    'gyeokguk.SIK_SHIN',
    'gyeokguk.SANG_GWAN',
    'gyeokguk.JEONG_IN',
    'gyeokguk.PYEON_IN',
    'gyeokguk.BI_GYEON',
    'gyeokguk.GEOB_JAE',

    // Advanced/high-level pattern keys (kept last by default so ten-god 格局 remains primary)
    'gyeokguk.HUA_QI',
    'gyeokguk.ZHUAN_WANG',
    'gyeokguk.CONG_CAI',
    'gyeokguk.CONG_GUAN',
    'gyeokguk.CONG_SHA',
    'gyeokguk.CONG_ER',
    'gyeokguk.CONG_YIN',
    'gyeokguk.CONG_BI',
    'gyeokguk.CONG_GE',
  ],
  competition: {
    enabled: false,
    methods: ['follow', 'transformations', 'oneElement'],
    power: 2.0,
    minKeep: 0.2,
    renormalize: true,
    groups: DEFAULT_COMP_GROUPS,
    signals: { ...DEFAULT_COMP_SIGNALS },
  },
};

// Cache compiled policy per EngineConfig identity (engine-level immutability assumption).
// This prevents repeatedly compiling JSON ruleSpecs on every analyze() call.
const POLICY_CACHE = new WeakMap<object, GyeokgukPolicy>();

function getCachedPolicy(config: EngineConfig): GyeokgukPolicy {
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

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function absSum(scores: Record<string, number>, keys: string[]): number {
  let s = 0;
  for (const k of keys) {
    const v = scores[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) continue;
    s += Math.abs(v);
  }
  return s;
}

function safeTieIndex(tieBreakOrder: string[], key: string): number {
  const idx = tieBreakOrder.indexOf(key);
  return idx >= 0 ? idx : 1_000_000;
}

function readTransformSignal(facts: RuleFacts, selector: TransformSignalSelector = 'auto'): number {
  const t: any = (facts as any).patterns?.transformations;
  const b: any = t?.best;

  const huaqi = b?.huaqiFactor;
  const eff = b?.effectiveFactor;
  const raw = b?.factor;

  if (selector === 'raw') {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  if (selector === 'effective') {
    if (typeof eff === 'number' && Number.isFinite(eff) && eff > 0) return clamp01(eff);
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  if (selector === 'huaqi') {
    if (typeof huaqi === 'number' && Number.isFinite(huaqi) && huaqi > 0) return clamp01(huaqi);
    if (typeof eff === 'number' && Number.isFinite(eff) && eff > 0) return clamp01(eff);
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  // auto: huaqiFactor → effectiveFactor → factor
  if (typeof huaqi === 'number' && Number.isFinite(huaqi) && huaqi > 0) return clamp01(huaqi);
  if (typeof eff === 'number' && Number.isFinite(eff) && eff > 0) return clamp01(eff);
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
  return 0;
}

function readOneElementSignal(facts: RuleFacts, selector: OneElementSignalSelector = 'auto'): number {
  const oe: any = (facts as any).patterns?.elements?.oneElement;

  const zw = oe?.zhuanwangFactor;
  const raw = oe?.factor;

  if (selector === 'raw') {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  if (selector === 'zhuanwang') {
    if (typeof zw === 'number' && Number.isFinite(zw) && zw > 0) return clamp01(zw);
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  // auto: zhuanwangFactor → factor
  if (typeof zw === 'number' && Number.isFinite(zw) && zw > 0) return clamp01(zw);
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
  return 0;
}

function readFollowSignal(facts: RuleFacts, selector: FollowSignalSelector = 'auto'): number {
  const f: any = (facts as any).patterns?.follow;

  const jong = f?.jonggyeokFactor;
  const pot = f?.potential;
  const raw = f?.potentialRaw;

  if (selector === 'raw') {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  if (selector === 'potential') {
    if (typeof pot === 'number' && Number.isFinite(pot) && pot > 0) return clamp01(pot);
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  if (selector === 'jonggyeok') {
    if (typeof jong === 'number' && Number.isFinite(jong) && jong > 0) return clamp01(jong);
    if (typeof pot === 'number' && Number.isFinite(pot) && pot > 0) return clamp01(pot);
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
    return 0;
  }

  // auto: jonggyeokFactor → potential → potentialRaw
  if (typeof jong === 'number' && Number.isFinite(jong) && jong > 0) return clamp01(jong);
  if (typeof pot === 'number' && Number.isFinite(pot) && pot > 0) return clamp01(pot);
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return clamp01(raw);
  return 0;
}

function readTenGodSignal(facts: RuleFacts, selector: TenGodSignalSelector | number = 'monthQuality'): number {
  if (typeof selector === 'number') {
    return Number.isFinite(selector) ? clamp01(selector) : 0.5;
  }

  const sel: TenGodSignalSelector = selector === 'auto' ? 'monthQuality' : selector;

  if (sel === 'monthQuality') {
    // Use month-gyeok quality multiplier as the “tenGod axis” signal.
    // If anything is missing, fall back to 0.5 (neutral).
    const q: any = (facts as any).month?.gyeok?.quality;
    const m = q?.multiplier;
    if (typeof m === 'number' && Number.isFinite(m)) return clamp01(m);
    return 0.5;
  }

  return 0.5;
}

function normalizeMethods(methods: unknown, fallback: string[]): string[] {
  const xs = Array.isArray(methods) ? (methods as any[]).map(String) : fallback;
  const allowed = new Set(['follow', 'transformations', 'oneElement', 'tenGod']);
  return xs.filter((m) => allowed.has(m));
}

function normalizeKeyGroupSpec(raw: any, fallback: CompetitionKeyGroupSpec): CompetitionKeyGroupSpec {
  const arr = (x: any, fb: string[] | undefined): string[] | undefined =>
    Array.isArray(x) ? (x as any[]).map(String).filter((s) => s && s.trim()) : fb;

  return {
    prefixes: arr(raw?.prefixes, fallback.prefixes),
    keys: arr(raw?.keys, fallback.keys),
    excludePrefixes: arr(raw?.excludePrefixes, fallback.excludePrefixes),
    excludeKeys: arr(raw?.excludeKeys, fallback.excludeKeys),
  };
}

function mergeGroupMap(
  base: Record<GyeokgukCompetitionMethod, CompetitionKeyGroupSpec>,
  override: any,
): Record<GyeokgukCompetitionMethod, CompetitionKeyGroupSpec> {
  const out: Record<GyeokgukCompetitionMethod, CompetitionKeyGroupSpec> = {
    follow: { ...base.follow },
    transformations: { ...base.transformations },
    oneElement: { ...base.oneElement },
    tenGod: { ...base.tenGod },
  };

  if (!override || typeof override !== 'object') return out;

  for (const m of ['follow', 'transformations', 'oneElement', 'tenGod'] as GyeokgukCompetitionMethod[]) {
    if (m in override) {
      out[m] = normalizeKeyGroupSpec((override as any)[m], base[m]);
    }
  }
  return out;
}

function normalizeSelector<T extends string>(value: any, allowed: Set<T>, fallback: T): T {
  const v = typeof value === 'string' ? (value as T) : fallback;
  return allowed.has(v) ? v : fallback;
}

function mergeSignalSelectors(
  base: ResolvedCompetitionSignals,
  override: any,
): ResolvedCompetitionSignals {
  const out: ResolvedCompetitionSignals = { ...base };
  if (!override || typeof override !== 'object') return out;

  // follow
  out.follow = normalizeSelector(
    (override as any).follow,
    new Set<FollowSignalSelector>(['auto', 'jonggyeok', 'potential', 'raw']),
    (typeof out.follow === 'string' ? out.follow : 'auto') as FollowSignalSelector,
  );

  // transformations
  out.transformations = normalizeSelector(
    (override as any).transformations,
    new Set<TransformSignalSelector>(['auto', 'huaqi', 'effective', 'raw']),
    (typeof out.transformations === 'string' ? out.transformations : 'auto') as TransformSignalSelector,
  );

  // oneElement
  out.oneElement = normalizeSelector(
    (override as any).oneElement,
    new Set<OneElementSignalSelector>(['auto', 'zhuanwang', 'raw']),
    (typeof out.oneElement === 'string' ? out.oneElement : 'auto') as OneElementSignalSelector,
  );

  // tenGod: allow either a selector string or a fixed constant in [0,1]
  const tg = (override as any).tenGod;
  if (typeof tg === 'number') {
    if (Number.isFinite(tg)) out.tenGod = clamp01(tg);
  } else if (typeof tg === 'string') {
    const fb = (typeof out.tenGod === 'string' ? out.tenGod : 'monthQuality') as TenGodSignalSelector;
    out.tenGod = normalizeSelector(tg, new Set<TenGodSignalSelector>(['auto', 'monthQuality']), fb);
  }
  return out;
}

function mergeCompetition(base: NonNullable<GyeokgukPolicy['competition']>, override: any): NonNullable<GyeokgukPolicy['competition']> {
  if (!override || typeof override !== 'object') return base;

  // Always merge through defaults to guarantee all methods get stable fallbacks.
  const mergedGroups = mergeGroupMap(mergeGroupMap(DEFAULT_COMP_GROUPS, (base as any).groups ?? {}), (override as any).groups);
  const mergedSignals = mergeSignalSelectors(mergeSignalSelectors(DEFAULT_COMP_SIGNALS, (base as any).signals ?? {}), (override as any).signals);

  return {
    enabled: typeof (override as any).enabled === 'boolean' ? (override as any).enabled : base.enabled,
    methods: normalizeMethods((override as any).methods, base.methods),
    power: asNumber((override as any).power, base.power),
    minKeep: asNumber((override as any).minKeep, base.minKeep),
    renormalize: typeof (override as any).renormalize === 'boolean' ? (override as any).renormalize : base.renormalize,
    groups: mergedGroups,
    signals: mergedSignals as any,
  };
}

function buildKeysFromGroup(scores: Record<string, number>, group: CompetitionKeyGroupSpec): string[] {
  const inc = new Set<string>();

  for (const k of group.keys ?? []) {
    if (k in scores) inc.add(k);
  }

  const prefixes = group.prefixes ?? [];
  if (prefixes.length) {
    for (const k of Object.keys(scores)) {
      for (const p of prefixes) {
        if (k.startsWith(p)) {
          inc.add(k);
          break;
        }
      }
    }
  }

  // Exclusions
  for (const k of group.excludeKeys ?? []) {
    inc.delete(k);
  }

  const exPrefixes = group.excludePrefixes ?? [];
  if (exPrefixes.length) {
    for (const k of Array.from(inc)) {
      for (const p of exPrefixes) {
        if (k.startsWith(p)) {
          inc.delete(k);
          break;
        }
      }
    }
  }

  // Final: keep only non-zero numeric scores
  return Array.from(inc).filter((k) => {
    const v = scores[k];
    return typeof v === 'number' && Number.isFinite(v) && v !== 0;
  });
}

function applySpecialCompetition(scores: Record<string, number>, facts: RuleFacts, policy: GyeokgukPolicy): GyeokgukCompetition | null {
  const compPol = policy.competition;
  if (!compPol || compPol.enabled !== true) return null;

  const power = Math.max(0.01, asNumber(compPol.power, 2.0));
  const minKeep = clamp01(asNumber(compPol.minKeep, 0.2));
  const renormalize = compPol.renormalize !== false;

  const methods = normalizeMethods(compPol.methods, ['follow', 'transformations', 'oneElement']);
  if (methods.length < 2) return null;

  const groups = mergeGroupMap(DEFAULT_COMP_GROUPS, (compPol as any).groups ?? {});
  const signalSelectors = mergeSignalSelectors(DEFAULT_COMP_SIGNALS, (compPol as any).signals ?? {});

  const groupKeys: Record<GyeokgukCompetitionMethod, string[]> = {
    follow: buildKeysFromGroup(scores, groups.follow),
    transformations: buildKeysFromGroup(scores, groups.transformations),
    oneElement: buildKeysFromGroup(scores, groups.oneElement),
    tenGod: buildKeysFromGroup(scores, groups.tenGod),
  };

  const groupBefore: Record<GyeokgukCompetitionMethod, number> = {
    follow: absSum(scores, groupKeys.follow),
    transformations: absSum(scores, groupKeys.transformations),
    oneElement: absSum(scores, groupKeys.oneElement),
    tenGod: absSum(scores, groupKeys.tenGod),
  };

  const items = (methods as GyeokgukCompetitionMethod[])
    .map((name) => {
      const keys = groupKeys[name] ?? [];
      const before = groupBefore[name] ?? 0;
      const sel = (signalSelectors as any)[name] as any;
      const signal =
        name === 'follow'
          ? readFollowSignal(facts, sel)
          : name === 'transformations'
            ? readTransformSignal(facts, sel)
            : name === 'oneElement'
              ? readOneElementSignal(facts, sel)
              : readTenGodSignal(facts, sel);

      return { name, keys, before, signal };
    })
    .filter((it) => it.before > 0 && it.keys.length > 0);

  if (items.length < 2) return null;

  const totalBefore = items.reduce((a, b) => a + b.before, 0);
  if (!(totalBefore > 0)) return null;

  // Compute shares + multipliers (softmax-like); if all signals are 0, fallback to uniform.
  const sigMap: Record<string, number> = {};
  for (const it of items) sigMap[it.name] = it.signal;
  const comp = compete(
    items.map((x) => x.name),
    sigMap,
    { power, minKeep },
  );

  const signalsOut: Record<string, number> = {};
  const sharesOut: Record<string, number> = {};
  const multOut: Record<string, number> = {};
  const methodTotals: Record<string, { before: number; after: number }> = {};

  const affectedKeys = new Set<string>();
  const beforeMap: Record<string, number> = {};

  // Winner tracking
  let winnerMethod: string | null = null;
  let winnerShare = -1;
  for (const it of items) {
    const sh = comp.shares[it.name] ?? 0;
    if (sh > winnerShare) {
      winnerShare = sh;
      winnerMethod = it.name;
    }
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const share = comp.shares[it.name] ?? 0;
    const mul = comp.multipliers[it.name] ?? minKeep;

    signalsOut[it.name] = it.signal;
    sharesOut[it.name] = share;
    multOut[it.name] = mul;

    methodTotals[it.name] = { before: it.before, after: 0 };

    for (const k of it.keys) {
      const v = scores[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) continue;
      affectedKeys.add(k);
      if (!(k in beforeMap)) beforeMap[k] = v;
      scores[k] = v * mul;
    }
  }

  // Renormalize to preserve total |score| mass (optional).
  let scale = 1;
  if (renormalize) {
    const totalAfterRaw = absSum(scores, Array.from(affectedKeys));
    if (totalAfterRaw > 1e-12) {
      scale = renormalizeScale(totalBefore, totalAfterRaw);
      for (const k of affectedKeys) {
        const v = scores[k];
        if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) continue;
        scores[k] = v * scale;
      }
    }
  }

  const affected: Record<string, { before: number; after: number }> = {};
  for (const k of affectedKeys) {
    affected[k] = { before: beforeMap[k]!, after: scores[k]! };
  }

  // Method-wise after totals
  for (const it of items) {
    methodTotals[it.name] = { before: methodTotals[it.name]?.before ?? it.before, after: absSum(scores, it.keys) };
  }

  const totalAfter = absSum(scores, Array.from(affectedKeys));

  const methodKeysOut: Record<string, string[]> = {};
  for (const it of items) methodKeysOut[it.name] = [...it.keys];

  const win = winnerMethod ? items.find((x) => x.name === winnerMethod) : undefined;
  const winner = win
    ? {
        method: win.name,
        share: comp.shares[win.name] ?? 0,
        signal: win.signal,
        multiplier: comp.multipliers[win.name] ?? minKeep,
        keys: [...win.keys],
      }
    : undefined;

  return {
    enabled: true,
    methods,
    activeMethods: items.map((x) => x.name),
    power,
    minKeep,
    renormalize,
    scale,
    groups,
    signalSelectors,
    methodKeys: methodKeysOut,
    signals: signalsOut,
    shares: sharesOut,
    multipliers: multOut,
    winner,
    totalBefore,
    totalAfter,
    methodTotals,
    affected,
  };
}

function buildPolicy(config: EngineConfig): GyeokgukPolicy {
  const raw: any = (config.strategies as any)?.gyeokguk ?? {};

  const specInput = (config.extensions as any)?.ruleSpecs?.gyeokguk;
  const specArr = Array.isArray(specInput) ? specInput : specInput ? [specInput] : [];

  const compiledFromSpec: RuleSet | null = specInput ? compileGyeokgukRuleSpec(specInput) : null;

  const rs: RuleSet =
    ((config.extensions as any)?.rulesets?.gyeokguk as RuleSet) ??
    ((config.extensions as any)?.rules?.gyeokguk as RuleSet) ??
    compiledFromSpec ??
    DEFAULT_POLICY.ruleSet;

  const tieBreakOrder: string[] = Array.isArray(raw.tieBreakOrder) ? raw.tieBreakOrder : DEFAULT_POLICY.tieBreakOrder;

  // Competition: default → spec.policy → strategies.gyeokguk.competition
  let comp = { ...(DEFAULT_POLICY.competition as NonNullable<GyeokgukPolicy['competition']>) };

  for (const s of specArr) {
    const ov = (s as any)?.policy?.competition;
    if (ov && typeof ov === 'object') comp = mergeCompetition(comp, ov);
  }

  comp = mergeCompetition(comp, raw.competition ?? {});

  return { ...DEFAULT_POLICY, ruleSet: rs, tieBreakOrder, competition: comp };
}

export function computeGyeokguk(config: EngineConfig, facts: RuleFacts): GyeokgukResult {
  const policy = getCachedPolicy(config);

  const init: Record<string, number> = {};
  for (const k of policy.tieBreakOrder) init[k] = 0;

  const evalRes = evalRuleSet(policy.ruleSet, facts, init);

  // NOTE: we *mutate* the score map in-place for competition to keep allocations small.
  const scores = evalRes.scores;
  const comp = applySpecialCompetition(scores, facts, policy);

  const ranking = [...Object.entries(scores)]
    .filter(([k]) => k.startsWith('gyeokguk.'))
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return safeTieIndex(policy.tieBreakOrder, a[0]) - safeTieIndex(policy.tieBreakOrder, b[0]);
    })
    .map(([key, score]) => ({ key, score }));

  const best = ranking.length && ranking[0]!.score > 0 ? ranking[0]!.key : null;

  return {
    best,
    ranking,
    scores,
    competition: comp ?? undefined,
    basis: {
      monthMainTenGod: facts.month.mainTenGod,
      monthGyeokTenGod: facts.month.gyeok.tenGod,
      monthGyeokMethod: facts.month.gyeok.method,
      monthGyeokQuality: facts.month.gyeok.quality,
      competition: comp ?? undefined,
    },
    rules: { matches: evalRes.matches, assertionsFailed: evalRes.assertionsFailed },
  };
}
