import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from './evaluator.js';
import type { HanjaEntry } from '../database/hanja-repository.js';
import type { SajuCompatibility } from '../model/types.js';
import {
  type ElementKey,
  ELEMENT_KEYS,
  emptyDistribution,
  clamp,
  elementFromSajuCode,
  elementCount,
  totalCount,
  weightedElementAverage,
  normalizeSignedScore,
  generates,
  generatedBy,
  controls,
  controlledBy,
  distributionFromArrangement,
} from './scoring.js';

export interface SajuOutputSummary {
  dayMaster?: { element: ElementKey };
  strength?: {
    isStrong: boolean;
    totalSupport: number;
    totalOppose: number;
  };
  yongshin?: SajuYongshinSummary;
  tenGod?: { groupCounts: Record<string, number> };
}

export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  recommendations: Array<{
    type: string;
    primaryElement: string;
    secondaryElement: string | null;
    confidence: number;
    reasoning: string;
  }>;
}

export interface SajuNameScoreBreakdown {
  balance: number;
  yongshin: number;
  strength: number;
  tenGod: number;
  weights: {
    balance: number;
    yongshin: number;
    strength: number;
    tenGod: number;
  };
  weightedBeforePenalty: number;
  penalties: {
    gisin: number;
    gusin: number;
    total: number;
  };
  elementMatches: {
    yongshin: number;
    heesin: number;
    gisin: number;
    gusin: number;
  };
}

export interface SajuNameScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
  breakdown: SajuNameScoreBreakdown;
}

const TEN_GOD_GROUPS = ['friend', 'output', 'wealth', 'authority', 'resource'] as const;
type TenGodGroup = typeof TEN_GOD_GROUPS[number];

const YTW: Record<string, number> = {
  EOKBU: 1, JOHU: 0.95, TONGGWAN: 0.9, GYEOKGUK: 0.85,
  BYEONGYAK: 0.8, JEONWANG: 0.75, HAPWHA_YONGSHIN: 0.7, ILHAENG_YONGSHIN: 0.7,
};

const CTX_TYPES = new Set([
  'JOHU', 'TONGGWAN', 'BYEONGYAK', 'GYEOKGUK', 'HAPWHA_YONGSHIN',
]);

function spreadOf(v: number[]): number {
  return Math.max(...v) - Math.min(...v);
}

function computeOptimalSorted(initial: number[], rc: number): number[] {
  const s = [...initial].sort((a, b) => a - b);
  let rem = rc;
  let lv = 0;

  while (lv < ELEMENT_KEYS.length - 1 && rem > 0) {
    const diff = s[lv + 1] - s[lv];
    const w = lv + 1;

    if (diff === 0) { lv++; continue; }

    const cost = diff * w;
    if (rem >= cost) {
      for (let k = 0; k <= lv; k++) s[k] += diff;
      rem -= cost;
      lv++;
    } else {
      const es = Math.floor(rem / w);
      const lo = rem % w;
      for (let k = 0; k <= lv; k++) s[k] += es;
      for (let k = 0; k < lo; k++) s[k] += 1;
      rem = 0;
    }
  }

  if (rem > 0) {
    const es = Math.floor(rem / 5);
    const lo = rem % 5;
    for (let k = 0; k < 5; k++) s[k] += es;
    for (let k = 0; k < lo; k++) s[k] += 1;
  }

  return s;
}

function groupElement(dm: ElementKey, g: TenGodGroup): ElementKey {
  switch (g) {
    case 'friend':    return dm;
    case 'resource':  return generatedBy(dm);
    case 'output':    return generates(dm);
    case 'wealth':    return controls(dm);
    case 'authority': return controlledBy(dm);
  }
}

function computeBalanceScore(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
): { score: number; isPassed: boolean; combined: Record<ElementKey, number> } {
  const ini = ELEMENT_KEYS.map(k => sajuDist[k] ?? 0);
  const rc = ELEMENT_KEYS.map(k => rootDist[k] ?? 0);
  const fin = ELEMENT_KEYS.map((_, i) => ini[i] + rc[i]);
  const rt = rc.reduce((a, b) => a + b, 0);
  const deltas = fin.map((v, i) => v - ini[i]);

  if (deltas.some(v => v < 0) || deltas.reduce((a, b) => a + b, 0) !== rt) {
    return { score: 0, isPassed: false, combined: emptyDistribution() };
  }

  const opt = computeOptimalSorted(ini, rt);
  const fs = [...fin].sort((a, b) => a - b);
  const isOpt = fs.every((v, i) => v === opt[i]);
  const fz = fin.filter(v => v === 0).length;
  const oz = opt.filter(v => v === 0).length;
  const sp = spreadOf(fin);
  const os = spreadOf(opt);

  let score: number;
  if (rt === 0 && fin.every((v, i) => v === ini[i])) {
    score = 100;
  } else if (isOpt) {
    score = 100;
  } else {
    const man = fs.reduce((acc, v, i) => acc + Math.abs(v - opt[i]), 0);
    score = clamp(100 - 20 * Math.floor(man / 2) - 10 * Math.max(0, fz - oz) - 5 * Math.max(0, sp - os), 0, 100);
  }

  return {
    score,
    isPassed: isOpt || (fz <= oz && sp <= os && score >= 70),
    combined: Object.fromEntries(ELEMENT_KEYS.map((k, i) => [k, fin[i]])) as Record<ElementKey, number>,
  };
}

function computeRecommendationScore(
  rd: Record<ElementKey, number>,
  y: SajuYongshinSummary,
): { score: number; contextualPriority: number } | null {
  if (y.recommendations.length === 0) return null;

  let ws = 0, tw = 0, cw = 0;

  for (const r of y.recommendations) {
    const p = elementFromSajuCode(r.primaryElement);
    const s = elementFromSajuCode(r.secondaryElement);
    if (!p && !s) continue;

    const rc = Number.isFinite(r.confidence) ? clamp(r.confidence, 0, 1) : 0.6;
    const w = Math.max(0.1, rc * (YTW[r.type] ?? 0.75));

    ws += weightedElementAverage(rd, el => {
      if (p && el === p) return 1;
      if (s && el === s) return 0.6;
      return 0;
    }) * w;

    tw += w;
    if (CTX_TYPES.has(r.type)) cw += w;
  }

  if (tw <= 0) return null;
  return { score: clamp((ws / tw) * 100, 0, 100), contextualPriority: clamp(cw / tw, 0, 1) };
}

interface YongshinScoreResult {
  score: number;
  confidence: number;
  contextualPriority: number;
  gisinPenalty: number;
  gusinPenalty: number;
  gisinRatio: number;
  gusinRatio: number;
  elementMatches: { yongshin: number; heesin: number; gisin: number; gusin: number };
}

function computeYongshinScore(
  rd: Record<ElementKey, number>,
  y: SajuYongshinSummary | null,
): YongshinScoreResult {
  if (!y) {
    return {
      score: 50, confidence: 0, contextualPriority: 0,
      gisinPenalty: 0, gusinPenalty: 0, gisinRatio: 0, gusinRatio: 0,
      elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
    };
  }

  const ye = elementFromSajuCode(y.finalYongshin);
  const he = elementFromSajuCode(y.finalHeesin);
  const ge = elementFromSajuCode(y.gisin);
  const gu = elementFromSajuCode(y.gusin);
  const conf = Number.isFinite(y.finalConfidence) ? clamp(y.finalConfidence, 0, 1) : 0.65;

  const aff = weightedElementAverage(rd, el => {
    if (gu && el === gu) return -1;
    if (ge && el === ge) return -0.65;
    if (ye && el === ye) return 1;
    if (he && el === he) return 0.65;
    return 0;
  });

  const rs = computeRecommendationScore(rd, y);
  const as_ = normalizeSignedScore(aff);
  const raw = rs === null ? as_ : 0.55 * as_ + 0.45 * rs.score;
  const score = clamp(50 + (raw - 50) * (0.55 + conf * 0.45), 0, 100);

  const tot = totalCount(rd);
  const gc = elementCount(rd, ge);
  const guc = elementCount(rd, gu);
  const gr = tot > 0 ? gc / tot : 0;
  const gur = tot > 0 ? guc / tot : 0;
  const ps = 0.4 + 0.6 * conf;

  return {
    score, confidence: conf,
    contextualPriority: rs?.contextualPriority ?? 0,
    gisinPenalty: Math.round(gr * 7 * ps),
    gusinPenalty: Math.round(gur * 14 * ps),
    gisinRatio: gr, gusinRatio: gur,
    elementMatches: {
      yongshin: elementCount(rd, ye),
      heesin: elementCount(rd, he),
      gisin: gc, gusin: guc,
    },
  };
}

function computeStrengthScore(
  rd: Record<ElementKey, number>,
  so: SajuOutputSummary | null,
): number {
  const st = so?.strength;
  const dm = so?.dayMaster?.element;
  if (!st || !dm) return 50;

  const fav = new Set<ElementKey>();
  const unf = new Set<ElementKey>();

  if (st.isStrong) {
    fav.add(generates(dm)).add(controls(dm)).add(controlledBy(dm));
    unf.add(dm).add(generatedBy(dm));
  } else {
    fav.add(dm).add(generatedBy(dm));
    unf.add(generates(dm)).add(controls(dm)).add(controlledBy(dm));
  }

  const b = normalizeSignedScore(
    weightedElementAverage(rd, el => fav.has(el) ? 1 : unf.has(el) ? -1 : 0),
  );
  const sup = Math.abs(st.totalSupport);
  const opp = Math.abs(st.totalOppose);
  const sm = sup + opp;
  const int = sm > 0 ? clamp(Math.abs(sup - opp) / sm, 0, 1) : 0.35;

  return clamp(50 + (b - 50) * (0.45 + int * 0.55), 0, 100);
}

function computeTenGodScore(
  rd: Record<ElementKey, number>,
  so: SajuOutputSummary | null,
): number {
  const tg = so?.tenGod;
  const dm = so?.dayMaster?.element;
  if (!tg || !dm) return 50;

  const c = tg.groupCounts;
  const tot = TEN_GOD_GROUPS.reduce((a, g) => a + (c[g] ?? 0), 0);
  if (tot <= 0) return 50;

  const avg = tot / TEN_GOD_GROUPS.length;
  const ew: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };

  for (const g of TEN_GOD_GROUPS) {
    const d = (avg - (c[g] ?? 0)) / Math.max(avg, 1);
    ew[groupElement(dm, g)] += d >= 0 ? d : d * 0.35;
  }

  return clamp(50 + weightedElementAverage(rd, el => clamp(ew[el], -1, 1)) * 45, 0, 100);
}

function resolveAdaptiveWeights(
  bs: number,
  y: Pick<YongshinScoreResult, 'score' | 'confidence' | 'contextualPriority'>,
): { balance: number; yongshin: number; strength: number; tenGod: number } {
  const sw = 0.12, tw = 0.05;
  const ct = clamp((y.score - bs) / 70, 0, 1);
  const cb = clamp(y.confidence, 0, 1);
  const cx = clamp(y.contextualPriority, 0, 1);
  const sh = 0.22 * ct * (0.6 + 0.4 * cb) + 0.08 * cb * cx;

  const bw = clamp(0.6 - sh, 0.35, 0.6);
  const yw = clamp(0.23 + sh, 0.23, 0.48);
  const s = bw + yw + sw + tw;

  return { balance: bw / s, yongshin: yw / s, strength: sw / s, tenGod: tw / s };
}

export function computeSajuNameScore(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): SajuNameScoreResult {
  const bal = computeBalanceScore(sajuDist, rootDist);
  const yng = computeYongshinScore(rootDist, sajuOutput?.yongshin ?? null);
  const str = computeStrengthScore(rootDist, sajuOutput);
  const tg = computeTenGodScore(rootDist, sajuOutput);
  const w = resolveAdaptiveWeights(bal.score, yng);

  const wbp = clamp(
    w.balance * bal.score + w.yongshin * yng.score + w.strength * str + w.tenGod * tg,
    0, 100,
  );

  const tp = yng.gisinPenalty + yng.gusinPenalty;
  const score = clamp(wbp - tp, 0, 100);
  const hasY = sajuOutput?.yongshin != null;
  const severe = yng.gusinRatio >= 0.75;
  const isPassed = score >= 62 && bal.score >= 45 && (!hasY || (yng.score >= 35 && !severe));

  return {
    score, isPassed, combined: bal.combined,
    breakdown: {
      balance: bal.score, yongshin: yng.score, strength: str, tenGod: tg,
      weights: w, weightedBeforePenalty: wbp,
      penalties: { gisin: yng.gisinPenalty, gusin: yng.gusinPenalty, total: tp },
      elementMatches: yng.elementMatches,
    },
  };
}

export class SajuCalculator extends NameCalculator {
  readonly id = 'saju';
  private scoreResult: SajuNameScoreResult | null = null;
  private sajuOutput: SajuOutputSummary | null = null;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
  ) {
    super();
  }

  visit(ctx: EvalContext): void {
    this.sajuOutput = ctx.sajuOutput;

    const rootArr = [...this.surnameEntries, ...this.givenNameEntries]
      .map(e => e.resource_element as ElementKey);
    const rootDist = distributionFromArrangement(rootArr);

    this.scoreResult = computeSajuNameScore(ctx.sajuDistribution, rootDist, ctx.sajuOutput);

    this.putInsight(ctx, 'SAJU_JAWON_BALANCE', this.scoreResult.score, this.scoreResult.isPassed, 'SAJU+JAWON', {
      sajuDistribution: ctx.sajuDistribution,
      sajuDistributionSource: ctx.sajuOutput ? 'saju-ts' : 'fallback',
      jawonDistribution: rootDist,
      sajuJawonDistribution: this.scoreResult.combined,
      sajuScoring: this.scoreResult.breakdown,
      sajuOutput: ctx.sajuOutput,
    });
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return { nodeId: this.id, signals: [this.signal('SAJU_JAWON_BALANCE', ctx, 1.0)] };
  }

  getAnalysis(): AnalysisDetail<SajuCompatibility> {
    const bd = this.scoreResult?.breakdown;
    const em = bd?.elementMatches;
    const yg = this.sajuOutput?.yongshin;

    return {
      type: 'Saju',
      score: this.scoreResult?.score ?? 0,
      polarityScore: 0,
      elementScore: this.scoreResult?.score ?? 0,
      data: {
        yongshinElement: elementFromSajuCode(yg?.finalYongshin) ?? '',
        heeshinElement: elementFromSajuCode(yg?.finalHeesin) ?? null,
        gishinElement: elementFromSajuCode(yg?.gisin) ?? null,
        nameElements: this.givenNameEntries.map(e => e.resource_element),
        yongshinMatchCount: em?.yongshin ?? 0,
        yongshinGeneratingCount: 0,
        gishinMatchCount: em?.gisin ?? 0,
        gishinOvercomingCount: 0,
        deficiencyFillCount: 0,
        excessiveAvoidCount: 0,
        dayMasterSupportScore: bd?.strength ?? 0,
        affinityScore: this.scoreResult?.score ?? 0,
      },
    };
  }
}
