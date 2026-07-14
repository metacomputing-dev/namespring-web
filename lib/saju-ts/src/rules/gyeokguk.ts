import type { EngineConfig } from '../api/types.js';
import type { RuleMatch, RuleSet } from './dsl.js';
import { evalRuleSet } from './dsl.js';
import { DEFAULT_GYEOKGUK_RULESET } from './defaultRuleSets.js';
import { compileGyeokgukRuleSpec } from './spec/compileGyeokgukSpec.js';
import type { DayMasterRole, RuleFacts } from './facts.js';
import { strengthDecisionComponents } from './strengthComponents.js';
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

type SeongpaeVerdictKey = NonNullable<RuleFacts['month']['gyeok']['seongpae']>['verdict'];

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
  seongpaeScore?: {
    enabled: boolean;
    multipliers: Record<SeongpaeVerdictKey, number>;
  };

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

export interface GyeokgukSeongpaeScoreAdjustment {
  verdict: SeongpaeVerdictKey;
  key: string;
  multiplier: number;
  before: number;
  after: number;
  /** 같은 월지 손상이 quality.multiplier에 이미 반영되어 성패 재곱을 억제한 경우. */
  suppressedBy?: 'MONTH_DAMAGE_ALREADY_APPLIED_TO_QUALITY';
  multiplierBreakdown?: {
    qualityContribution: number;
    qualityVerdict: SeongpaeVerdictKey;
    qualityMultiplier: number;
    otherContribution: number;
    otherVerdict: SeongpaeVerdictKey;
    otherMultiplier: number;
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

export type JonggyeokStatus = 'none' | 'possible' | 'candidate' | 'selected' | 'blocked';

export type JonggyeokSubtype =
  | 'cong_cai'
  | 'cong_guan'
  | 'cong_sha'
  | 'cong_er'
  | 'cong_yin'
  | 'cong_bi'
  | 'zhuan_wang'
  | 'hua_qi';

export interface JonggyeokCandidate {
  subtype: JonggyeokSubtype;
  status: JonggyeokStatus;
  score: number;
  confidence: number;
  followPressure: number;
  dayMasterIsolation: number;
  rootWeakness: number;
  dominantElementShare: number;
  breakerPenalty: number;
  selectedReason?: string;
  blockedReason?: string;
  evidence: string[];
}

export interface GyeokgukResult {
  best: string | null;
  ranking: Array<{ key: string; score: number }>;
  scores: Record<string, number>;
  /** Optional debug payload for special-frame competition (alias of basis.competition). */
  competition?: GyeokgukCompetition;
  /** Optional debug payload for PR-10-4 seongpae verdict score integration. */
  seongpaeScoreAdjustment?: GyeokgukSeongpaeScoreAdjustment;
  /** Evidence-only jonggyeok candidates. This never promotes the selected gyeokguk. */
  jonggyeokCandidates: JonggyeokCandidate[];
  basis: {
    /** 월지 본기 십성 */
    monthMainTenGod: string;
    /** 월지 “격”(透干/会支 기반) 십성 */
    monthGyeokTenGod: string;
    /** 월지 격 선정 방법 */
    monthGyeokMethod: string;
    /** Month-gyeok selector policy used to choose monthGyeokTenGod. */
    monthGyeokSelectionRule: string;
    /** 청탁/파격 품질 지표 */
    monthGyeokQuality?: RuleFacts['month']['gyeok']['quality'];

    /** Optional debug payload for special-frame competition. */
    competition?: GyeokgukCompetition;
    /** Optional debug payload for PR-10-4 seongpae verdict score integration. */
    seongpaeScoreAdjustment?: GyeokgukSeongpaeScoreAdjustment;
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
  // 감사 B4: 건록/양인/월겁 — 월지 비겁의 주류 격명 (tenGod 경쟁축 질량에 포함).
  'gyeokguk.GEONROK',
  'gyeokguk.YANGIN',
  'gyeokguk.WOLGEOB',
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

const DEFAULT_SEONGPAE_SCORE_MULTIPLIERS: Record<SeongpaeVerdictKey, number> = {
  SEONGGYEOK: 1.08,
  PAJUNG_YUGU: 1.0,
  SEONGJUNG_YUPA: 0.9,
  PAGYEOK: 0.75,
  UNDETERMINED: 0.95,
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
    // 감사 B4: 건록/양인/월겁 (월지 비겁의 주류 격명 — 레거시 비견/겁재보다 앞)
    'gyeokguk.GEONROK',
    'gyeokguk.YANGIN',
    'gyeokguk.WOLGEOB',
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
  seongpaeScore: {
    enabled: true,
    multipliers: { ...DEFAULT_SEONGPAE_SCORE_MULTIPLIERS },
  },
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

function round6(x: number): number {
  return Math.round(x * 1_000_000) / 1_000_000;
}

function finite01(x: unknown, fallback = 0): number {
  return clamp01(asNumber(x, fallback));
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

function monthGyeokScoreKey(facts: RuleFacts): string | null {
  const key = facts.month.gyeok.bigyeopSubtype ?? facts.month.gyeok.tenGod;
  return typeof key === 'string' && key.length > 0 ? `gyeokguk.${key}` : null;
}

function expressionReferencesVariable(value: unknown, variable: string): boolean {
  if (value == null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => expressionReferencesVariable(item, variable));

  const record = value as Record<string, unknown>;
  if (record.var === variable) return true;
  return Object.values(record).some((item) => expressionReferencesVariable(item, variable));
}

function expressionIsProportionalToVariable(value: unknown, variable: string): boolean {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  if (record.var === variable) return true;
  if (record.op !== 'mul' || !Array.isArray(record.args)) return false;

  let proportionalFactors = 0;
  for (const factor of record.args) {
    if (expressionIsProportionalToVariable(factor, variable)) {
      proportionalFactors += 1;
    } else if (expressionReferencesVariable(factor, variable)) {
      return false;
    }
  }
  return proportionalFactors === 1;
}

function matchedMonthScoreQualityContribution(ruleSet: RuleSet, matches: RuleMatch[], key: string): number {
  const rulesById = new Map<string, RuleSet['rules'][number] | null>();
  for (const rule of ruleSet.rules) {
    const existing = rulesById.get(rule.id);
    rulesById.set(rule.id, existing === undefined ? rule : null);
  }

  let qualityContribution = 0;
  for (const match of matches) {
    const contribution = match.scores?.[key];
    if (typeof contribution !== 'number' || !Number.isFinite(contribution) || contribution === 0) continue;

    const rule = rulesById.get(match.ruleId);
    if (rule && expressionIsProportionalToVariable(rule.score?.[key], 'month.gyeok.quality.multiplier')) {
      qualityContribution += contribution;
    }
  }
  return qualityContribution;
}

function applySeongpaeScoreAdjustment(
  scores: Record<string, number>,
  facts: RuleFacts,
  policy: GyeokgukPolicy,
  matches: RuleMatch[],
): GyeokgukSeongpaeScoreAdjustment | null {
  const pol = policy.seongpaeScore;
  const seongpae = facts.month.gyeok.seongpae;
  if (!pol?.enabled || !seongpae?.verdict) return null;

  const key = monthGyeokScoreKey(facts);
  if (!key) return null;

  const before = scores[key];
  if (typeof before !== 'number' || !Number.isFinite(before) || before === 0) return null;

  // 월지 손상은 month.gyeok.quality.multiplier의 integrity에 이미 반영된다.
  // 손상만으로 성패 verdict가 강등된 경우 같은 증거로 다시 점수를 깎지 않는다.
  const verdictBeforeMonthBroken = seongpae.verdictBeforeMonthBroken;
  const verdictChangedByMonthDamage =
    verdictBeforeMonthBroken != null && verdictBeforeMonthBroken !== seongpae.verdict;
  const qualityContribution = verdictChangedByMonthDamage
    ? matchedMonthScoreQualityContribution(policy.ruleSet, matches, key)
    : 0;
  const monthDamageAlreadyApplied = verdictChangedByMonthDamage && qualityContribution !== 0;
  const finalMultiplier = asNumber(pol.multipliers[seongpae.verdict], 1);
  const qualityMultiplier =
    monthDamageAlreadyApplied && verdictBeforeMonthBroken != null
      ? asNumber(pol.multipliers[verdictBeforeMonthBroken], 1)
      : finalMultiplier;
  const otherContribution = before - qualityContribution;
  const after =
    qualityContribution * qualityMultiplier +
    otherContribution * finalMultiplier;
  const multiplier = after / before;
  scores[key] = after;

  return {
    verdict: seongpae.verdict,
    key,
    multiplier,
    before,
    after,
    ...(monthDamageAlreadyApplied && verdictBeforeMonthBroken != null
      ? {
          suppressedBy: 'MONTH_DAMAGE_ALREADY_APPLIED_TO_QUALITY' as const,
          multiplierBreakdown: {
            qualityContribution,
            qualityVerdict: verdictBeforeMonthBroken,
            qualityMultiplier,
            otherContribution,
            otherVerdict: seongpae.verdict,
            otherMultiplier: finalMultiplier,
          },
        }
      : {}),
  };
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

const JONGGYEOK_SUBTYPES: JonggyeokSubtype[] = [
  'cong_cai',
  'cong_guan',
  'cong_sha',
  'cong_er',
  'cong_yin',
  'cong_bi',
  'zhuan_wang',
  'hua_qi',
];

const CONG_SUBTYPE_ROLES: Record<Exclude<JonggyeokSubtype, 'zhuan_wang' | 'hua_qi'>, DayMasterRole> = {
  cong_cai: 'WEALTH',
  cong_guan: 'OFFICER',
  cong_sha: 'OFFICER',
  cong_er: 'OUTPUT',
  cong_yin: 'RESOURCE',
  cong_bi: 'COMPANION',
};

const CONG_SUBTYPE_TEN_GODS: Record<Exclude<JonggyeokSubtype, 'zhuan_wang' | 'hua_qi'>, string[]> = {
  cong_cai: ['PYEON_JAE', 'JEONG_JAE'],
  cong_guan: ['JEONG_GWAN'],
  cong_sha: ['PYEON_GWAN'],
  cong_er: ['SIK_SHIN', 'SANG_GWAN'],
  cong_yin: ['PYEON_IN', 'JEONG_IN'],
  cong_bi: ['BI_GYEON', 'GEOB_JAE'],
};

function keyCore(key: string | null | undefined): string {
  return String(key ?? '').replace(/^gyeokguk\./, '').toUpperCase();
}

function selectedJonggyeokSubtype(best: string | null): JonggyeokSubtype | null {
  const core = keyCore(best);
  if (core === 'HUA_QI') return 'hua_qi';
  if (core === 'ZHUAN_WANG') return 'zhuan_wang';
  if (core === 'CONG_CAI') return 'cong_cai';
  if (core === 'CONG_GUAN') return 'cong_guan';
  if (core === 'CONG_SHA') return 'cong_sha';
  if (core === 'CONG_ER') return 'cong_er';
  if (core === 'CONG_YIN') return 'cong_yin';
  if (core === 'CONG_BI') return 'cong_bi';
  return null;
}

function componentShare(facts: RuleFacts, name: keyof RuleFacts['strength']['components'], total: number): number {
  return total > 0 ? finite01(strengthDecisionComponents(facts.strength)[name] / total) : 0;
}

function elementShare(facts: RuleFacts, element: string | null | undefined): number {
  if (!element) return 0;
  return finite01((facts.elements.normalized as any)[element]);
}

function strongestElementForRole(facts: RuleFacts, role: DayMasterRole): { element: string | null; share: number } {
  let bestElement: string | null = null;
  let bestShare = 0;
  for (const [element, rawShare] of Object.entries(facts.elements.normalized as unknown as Record<string, number>)) {
    if ((facts.dayMasterRoleByElement as any)[element] !== role) continue;
    const share = finite01(rawShare);
    if (share > bestShare) {
      bestElement = element;
      bestShare = share;
    }
  }
  return { element: bestElement, share: bestShare };
}

function tenGodGroupShare(facts: RuleFacts, tenGods: string[]): number {
  const scores = (facts as any).tenGodScores ?? {};
  const total = Object.values(scores).reduce((sum: number, raw: unknown) => sum + Math.max(0, asNumber(raw, 0)), 0);
  if (total <= 0) return 0;
  return finite01(tenGods.reduce((sum, key) => sum + Math.max(0, asNumber(scores[key], 0)), 0) / total);
}

function rolePressureShare(role: DayMasterRole, shares: Record<DayMasterRole, number>): number {
  return finite01(shares[role]);
}

function statusFromScore(score: number, blockedReason: string | undefined, selectedReason: string | undefined): JonggyeokStatus {
  if (selectedReason) return 'selected';
  if (blockedReason && score >= 0.18) return 'blocked';
  if (score >= 0.68) return 'candidate';
  if (score >= 0.28) return 'possible';
  return 'none';
}

function buildJonggyeokCandidates(facts: RuleFacts, best: string | null): JonggyeokCandidate[] {
  const c = strengthDecisionComponents(facts.strength);
  const total = Math.max(
    1e-9,
    asNumber(c.companions, 0) + asNumber(c.resources, 0) + asNumber(c.outputs, 0) + asNumber(c.wealth, 0) + asNumber(c.officers, 0),
  );
  const shares: Record<DayMasterRole, number> = {
    COMPANION: componentShare(facts, 'companions', total),
    RESOURCE: componentShare(facts, 'resources', total),
    OUTPUT: componentShare(facts, 'outputs', total),
    WEALTH: componentShare(facts, 'wealth', total),
    OFFICER: componentShare(facts, 'officers', total),
  };
  const supportShare = finite01(shares.COMPANION + shares.RESOURCE);
  const pressureShare = finite01(shares.OUTPUT + shares.WEALTH + shares.OFFICER);
  const rootWeakness = finite01(1 - supportShare / 0.46);
  const dayMasterIsolation = finite01((pressureShare - supportShare + 0.5) / 1.35);
  const followSignal = readFollowSignal(facts, 'auto');
  const selectedSubtype = selectedJonggyeokSubtype(best);

  const q = (facts as any).month?.gyeok?.quality ?? {};
  const qualityPenalty =
    (q?.broken === true ? 0.18 : 0) +
    (q?.mixed === true ? 0.08 : 0) +
    (q?.qingZhuo === 'ZHUO' ? 0.05 : 0) +
    finite01(asNumber(q?.damage, 0) / 3) * 0.12;

  const candidates: JonggyeokCandidate[] = [];

  for (const subtype of JONGGYEOK_SUBTYPES) {
    if (subtype === 'zhuan_wang' || subtype === 'hua_qi') continue;

    const role = CONG_SUBTYPE_ROLES[subtype];
    const roleShare = rolePressureShare(role, shares);
    const tgShare = tenGodGroupShare(facts, CONG_SUBTYPE_TEN_GODS[subtype]);
    const roleElement = strongestElementForRole(facts, role);
    const dominantElementShare = Math.max(roleElement.share, tgShare * 0.85);
    const followPressure = finite01(Math.max(followSignal, roleShare, tgShare));
    const supportRole = role === 'RESOURCE' || role === 'COMPANION';
    const blockerReasons: string[] = [];
    if (!supportRole && supportShare >= 0.52) blockerReasons.push('day_master_support_too_visible');
    if (supportRole && pressureShare >= 0.58) blockerReasons.push('opposing_pressure_too_visible');
    if (q?.broken === true && roleShare < 0.4) blockerReasons.push('month_gyeok_broken');
    if (dominantElementShare < 0.18 && followPressure < 0.28) blockerReasons.push('dominant_target_weak');

    const blockerPenalty =
      (blockerReasons.includes('day_master_support_too_visible') ? 0.2 : 0) +
      (blockerReasons.includes('opposing_pressure_too_visible') ? 0.14 : 0) +
      (blockerReasons.includes('month_gyeok_broken') ? 0.1 : 0) +
      (blockerReasons.includes('dominant_target_weak') ? 0.08 : 0);
    const breakerPenalty = finite01(qualityPenalty + blockerPenalty);
    const baseScore =
      0.28 * followPressure +
      0.2 * roleShare +
      0.18 * tgShare +
      0.16 * dayMasterIsolation +
      0.12 * rootWeakness +
      0.12 * dominantElementShare;
    const score = finite01(baseScore - breakerPenalty);
    const selectedReason = selectedSubtype === subtype ? `${keyCore(best)} already selected by gyeokguk ranking` : undefined;
    const blockedReason = blockerReasons.length > 0 ? blockerReasons.join(';') : undefined;
    const status = statusFromScore(score, blockedReason, selectedReason);
    const evidence = [
      `role=${role}`,
      `roleShare=${round6(roleShare)}`,
      `tenGodShare=${round6(tgShare)}`,
      `supportShare=${round6(supportShare)}`,
      `pressureShare=${round6(pressureShare)}`,
      `dominantElement=${roleElement.element ?? 'NONE'}`,
    ];

    candidates.push({
      subtype,
      status,
      score: round6(score),
      confidence: round6(score),
      followPressure: round6(followPressure),
      dayMasterIsolation: round6(dayMasterIsolation),
      rootWeakness: round6(rootWeakness),
      dominantElementShare: round6(dominantElementShare),
      breakerPenalty: round6(breakerPenalty),
      selectedReason,
      blockedReason,
      evidence,
    });
  }

  const oneEl: any = (facts as any).patterns?.elements?.oneElement ?? {};
  const oneElementFactor = readOneElementSignal(facts, 'auto');
  const oneElementShare = elementShare(facts, oneEl?.element);
  const oneElementDayMatch = oneEl?.element === facts.dayMaster.element;
  const zhuanBlockers: string[] = [];
  if (oneElementFactor > 0.2 && !oneElementDayMatch) zhuanBlockers.push('dominant_element_not_day_master');
  if (q?.broken === true && oneElementFactor < 0.45) zhuanBlockers.push('month_gyeok_broken');
  const zhuanBreaker = finite01(qualityPenalty + (zhuanBlockers.length ? 0.18 : 0));
  const zhuanScore = finite01(
    0.58 * oneElementFactor +
    0.24 * oneElementShare +
    0.18 * (oneElementDayMatch ? 1 : 0) -
    zhuanBreaker,
  );
  const zhuanSelected = selectedSubtype === 'zhuan_wang'
    ? `${keyCore(best)} already selected by gyeokguk ranking`
    : undefined;
  candidates.push({
    subtype: 'zhuan_wang',
    status: statusFromScore(zhuanScore, zhuanBlockers.join(';') || undefined, zhuanSelected),
    score: round6(zhuanScore),
    confidence: round6(zhuanScore),
    followPressure: round6(oneElementFactor),
    dayMasterIsolation: round6(oneElementDayMatch ? 0 : dayMasterIsolation),
    rootWeakness: round6(oneElementDayMatch ? 0 : rootWeakness),
    dominantElementShare: round6(oneElementShare),
    breakerPenalty: round6(zhuanBreaker),
    selectedReason: zhuanSelected,
    blockedReason: zhuanBlockers.join(';') || undefined,
    evidence: [
      `oneElement=${String(oneEl?.element ?? 'NONE')}`,
      `oneElementFactor=${round6(oneElementFactor)}`,
      `dayMasterMatch=${oneElementDayMatch ? 1 : 0}`,
    ],
  });

  const transform: any = (facts as any).patterns?.transformations?.best ?? {};
  const huaqiFactor = readTransformSignal(facts, 'auto');
  const huaqiShare = elementShare(facts, transform?.resultElement);
  const dayInvolved = transform?.huaqiDetails?.flags?.dayInvolved === true;
  const huaqiBlockers: string[] = [];
  if (huaqiFactor > 0.2 && !dayInvolved) huaqiBlockers.push('day_master_not_involved');
  if (q?.broken === true && huaqiFactor < 0.45) huaqiBlockers.push('month_gyeok_broken');
  const huaqiBreaker = finite01(qualityPenalty + (huaqiBlockers.length ? 0.18 : 0));
  const huaqiScore = finite01(
    0.62 * huaqiFactor +
    0.2 * huaqiShare +
    0.18 * (dayInvolved ? 1 : 0) -
    huaqiBreaker,
  );
  const huaqiSelected = selectedSubtype === 'hua_qi'
    ? `${keyCore(best)} already selected by gyeokguk ranking`
    : undefined;
  candidates.push({
    subtype: 'hua_qi',
    status: statusFromScore(huaqiScore, huaqiBlockers.join(';') || undefined, huaqiSelected),
    score: round6(huaqiScore),
    confidence: round6(huaqiScore),
    followPressure: round6(huaqiFactor),
    dayMasterIsolation: round6(dayInvolved ? dayMasterIsolation : finite01(dayMasterIsolation * 0.7)),
    rootWeakness: round6(rootWeakness),
    dominantElementShare: round6(huaqiShare),
    breakerPenalty: round6(huaqiBreaker),
    selectedReason: huaqiSelected,
    blockedReason: huaqiBlockers.join(';') || undefined,
    evidence: [
      `pair=${String(transform?.pair ?? 'NONE')}`,
      `resultElement=${String(transform?.resultElement ?? 'NONE')}`,
      `huaqiFactor=${round6(huaqiFactor)}`,
      `dayInvolved=${dayInvolved ? 1 : 0}`,
    ],
  });

  return candidates;
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

  const seongpaeRaw: any = raw.seongpaeScore ?? {};
  const seongpaeMultipliers = {
    ...DEFAULT_SEONGPAE_SCORE_MULTIPLIERS,
    ...(seongpaeRaw.multipliers && typeof seongpaeRaw.multipliers === 'object' ? seongpaeRaw.multipliers : {}),
  };

  return {
    ...DEFAULT_POLICY,
    ruleSet: rs,
    tieBreakOrder,
    competition: comp,
    seongpaeScore: {
      enabled: seongpaeRaw.enabled !== false,
      multipliers: seongpaeMultipliers,
    },
  };
}

export function computeGyeokguk(config: EngineConfig, facts: RuleFacts): GyeokgukResult {
  const policy = getCachedPolicy(config);

  const init: Record<string, number> = {};
  for (const k of policy.tieBreakOrder) init[k] = 0;

  const evalRes = evalRuleSet(policy.ruleSet, facts, init);

  // NOTE: we *mutate* the score map in-place for competition to keep allocations small.
  const scores = evalRes.scores;
  const seongpaeScoreAdjustment = applySeongpaeScoreAdjustment(scores, facts, policy, evalRes.matches);
  const comp = applySpecialCompetition(scores, facts, policy);

  const ranking = [...Object.entries(scores)]
    .filter(([k]) => k.startsWith('gyeokguk.'))
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return safeTieIndex(policy.tieBreakOrder, a[0]) - safeTieIndex(policy.tieBreakOrder, b[0]);
    })
    .map(([key, score]) => ({ key, score }));

  const best = ranking.length && ranking[0]!.score > 0 ? ranking[0]!.key : null;
  const jonggyeokCandidates = buildJonggyeokCandidates(facts, best);

  return {
    best,
    ranking,
    scores,
    competition: comp ?? undefined,
    seongpaeScoreAdjustment: seongpaeScoreAdjustment ?? undefined,
    jonggyeokCandidates,
    basis: {
      monthMainTenGod: facts.month.mainTenGod,
      monthGyeokTenGod: facts.month.gyeok.tenGod,
      monthGyeokMethod: facts.month.gyeok.method,
      monthGyeokSelectionRule: facts.month.gyeok.selectionRule,
      monthGyeokQuality: facts.month.gyeok.quality,
      competition: comp ?? undefined,
      seongpaeScoreAdjustment: seongpaeScoreAdjustment ?? undefined,
    },
    rules: { matches: evalRes.matches, assertionsFailed: evalRes.assertionsFailed },
  };
}
