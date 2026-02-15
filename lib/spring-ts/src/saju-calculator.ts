import { NameCalculator, type EvalContext, type AnalysisDetail, type CalculatorPacket } from '../../name-ts/src/calculator/evaluator.js';
import type { HanjaEntry } from '../../name-ts/src/database/hanja-repository.js';
import type { SajuCompatibility, SajuOutputSummary, SajuYongshinSummary } from './types.js';
import { elementFromSajuCode } from './saju-adapter.js';
import { SAJU_FRAME } from './spring-evaluator.js';
import {
  type ElementKey,
  ELEMENT_KEYS,
  clamp,
  elementCount,
  totalCount,
  weightedElementAverage,
  normalizeSignedScore,
  generatedBy,
  distributionFromArrangement,
} from '../../name-ts/src/calculator/scoring.js';

export interface SajuNameScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<ElementKey, number>;
  breakdown: {
    balance: number; yongshin: number; strength: number; tenGod: number;
    penalties: { gisin: number; gusin: number; gyeokguk: number; total: number };
    deficiencyBonus: number;
    elementMatches: { yongshin: number; heesin: number; gisin: number; gusin: number };
  };
}

const TEN_GOD_GROUPS = ['friend', 'output', 'wealth', 'authority', 'resource'] as const;

const YTW: Record<string, number> = {
  EOKBU: 1, JOHU: 0.95, TONGGWAN: 0.9, GYEOKGUK: 0.85,
  BYEONGYAK: 0.8, JEONWANG: 0.75, HAPWHA_YONGSHIN: 0.7, ILHAENG_YONGSHIN: 0.7,
};

const CTX_TYPES = ['JOHU', 'TONGGWAN', 'BYEONGYAK', 'GYEOKGUK', 'HAPWHA_YONGSHIN'];

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

function computeBalanceScore(
  sajuDist: Record<ElementKey, number>,
  rootDist: Record<ElementKey, number>,
): { score: number; isPassed: boolean; combined: Record<ElementKey, number> } {
  const ini = ELEMENT_KEYS.map(k => sajuDist[k] ?? 0);
  const rc = ELEMENT_KEYS.map(k => rootDist[k] ?? 0);
  const fin = ELEMENT_KEYS.map((_, i) => ini[i] + rc[i]);
  const rt = rc.reduce((a, b) => a + b, 0);
  const opt = computeOptimalSorted(ini, rt);
  const fs = [...fin].sort((a, b) => a - b);
  const isOpt = fs.every((v, i) => v === opt[i]);
  const fz = fin.filter(v => v === 0).length;
  const oz = opt.filter(v => v === 0).length;
  const sp = Math.max(...fin) - Math.min(...fin);
  const os = Math.max(...opt) - Math.min(...opt);

  let score: number;
  if (isOpt) {
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
    if (CTX_TYPES.includes(r.type)) cw += w;
  }

  if (tw <= 0) return null;
  return { score: clamp((ws / tw) * 100, 0, 100), contextualPriority: clamp(cw / tw, 0, 1) };
}

function computeYongshinScore(
  rd: Record<ElementKey, number>,
  y: SajuYongshinSummary | null,
) {
  if (!y) return {
    score: 50, confidence: 0, contextualPriority: 0,
    gisinPenalty: 0, gusinPenalty: 0, gusinRatio: 0,
    elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
  };

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
  const gc = elementCount(rd, ge), guc = elementCount(rd, gu);
  const gr = tot > 0 ? gc / tot : 0, gur = tot > 0 ? guc / tot : 0;
  const ps = 0.4 + 0.6 * conf;

  return {
    score, confidence: conf,
    contextualPriority: rs?.contextualPriority ?? 0,
    gisinPenalty: Math.round(gr * 7 * ps),
    gusinPenalty: Math.round(gur * 14 * ps),
    gusinRatio: gur,
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
  const st = so?.strength, dm = so?.dayMaster?.element;
  if (!st || !dm) return 50;
  const b = normalizeSignedScore(
    weightedElementAverage(rd, el => ((el === dm || el === generatedBy(dm)) === st.isStrong) ? -1 : 1),
  );
  const sup = Math.abs(st.totalSupport), opp = Math.abs(st.totalOppose);
  const sm = sup + opp;
  const int = sm > 0 ? clamp(Math.abs(sup - opp) / sm, 0, 1) : 0.35;
  return clamp(50 + (b - 50) * (0.45 + int * 0.55), 0, 100);
}

function computeTenGodScore(
  rd: Record<ElementKey, number>,
  so: SajuOutputSummary | null,
): number {
  const tg = so?.tenGod, dm = so?.dayMaster?.element;
  if (!tg || !dm) return 50;
  const c = tg.groupCounts;
  const tot = TEN_GOD_GROUPS.reduce((a, g) => a + (c[g] ?? 0), 0);
  if (tot <= 0) return 50;
  const avg = tot / TEN_GOD_GROUPS.length;
  const ew: Record<ElementKey, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const g of TEN_GOD_GROUPS) {
    const d = (avg - (c[g] ?? 0)) / Math.max(avg, 1);
    ew[ELEMENT_KEYS[(ELEMENT_KEYS.indexOf(dm) + TEN_GOD_GROUPS.indexOf(g)) % 5]] += d >= 0 ? d : d * 0.35;
  }
  return clamp(50 + weightedElementAverage(rd, el => clamp(ew[el], -1, 1)) * 45, 0, 100);
}

function resolveAdaptiveWeights(
  bs: number,
  y: { score: number; confidence: number; contextualPriority: number },
): { balance: number; yongshin: number; strength: number; tenGod: number } {
  const ct = clamp((y.score - bs) / 70, 0, 1);
  const cb = clamp(y.confidence, 0, 1);
  const sh = 0.22 * ct * (0.6 + 0.4 * cb) + 0.08 * cb * clamp(y.contextualPriority, 0, 1);
  return {
    balance: clamp(0.6 - sh, 0.35, 0.6),
    yongshin: clamp(0.23 + sh, 0.23, 0.48),
    strength: 0.12,
    tenGod: 0.05,
  };
}

function computeGyeokgukPenalty(
  rootDist: Record<ElementKey, number>,
  output: SajuOutputSummary | null,
): number {
  const gy = output?.gyeokguk;
  if (!gy || gy.category !== 'JONGGYEOK' || gy.confidence < 0.5) return 0;

  const ge = elementFromSajuCode(output?.yongshin?.gisin);
  const gu = elementFromSajuCode(output?.yongshin?.gusin);
  if (!ge && !gu) return 0;

  const tot = totalCount(rootDist);
  if (tot === 0) return 0;

  const gisinCount = elementCount(rootDist, ge);
  const gusinCount = elementCount(rootDist, gu);
  const harmfulRatio = (gisinCount + gusinCount) / tot;

  return Math.round(harmfulRatio * 20 * clamp(gy.confidence, 0.5, 1));
}

function computeDeficiencyBonus(
  rootDist: Record<ElementKey, number>,
  output: SajuOutputSummary | null,
): number {
  const defs = output?.deficientElements;
  if (!defs?.length) return 0;

  const ye = elementFromSajuCode(output?.yongshin?.finalYongshin);
  const he = elementFromSajuCode(output?.yongshin?.finalHeesin);

  let bonus = 0;
  for (const def of defs) {
    const key = elementFromSajuCode(def);
    if (!key || elementCount(rootDist, key) === 0) continue;

    if (key === ye) bonus += 5;
    else if (key === he) bonus += 3;
  }
  return Math.min(bonus, 8);
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
  const defBonus = computeDeficiencyBonus(rootDist, sajuOutput);
  const adjusted = clamp(wbp + defBonus, 0, 100);
  // 종격 페널티는 기신/구신 페널티와 의도적으로 중첩 적용 (종격에서 기신 사용은 파격을 유발)
  const gyPenalty = computeGyeokgukPenalty(rootDist, sajuOutput);
  const tp = yng.gisinPenalty + yng.gusinPenalty + gyPenalty;
  const score = clamp(adjusted - tp, 0, 100);
  const isPassed = score >= 62 && bal.score >= 45
    && (sajuOutput?.yongshin == null || (yng.score >= 35 && yng.gusinRatio < 0.55));
  return {
    score, isPassed, combined: bal.combined,
    breakdown: {
      balance: bal.score, yongshin: yng.score, strength: str, tenGod: tg,
      penalties: { gisin: yng.gisinPenalty, gusin: yng.gusinPenalty, gyeokguk: gyPenalty, total: tp },
      deficiencyBonus: defBonus,
      elementMatches: yng.elementMatches,
    },
  };
}

export class SajuCalculator extends NameCalculator {
  readonly id = 'saju';
  private scoreResult: SajuNameScoreResult | null = null;

  constructor(
    private surnameEntries: HanjaEntry[],
    private givenNameEntries: HanjaEntry[],
    private sajuDistribution: Record<ElementKey, number>,
    private sajuOutput: SajuOutputSummary | null,
  ) {
    super();
  }

  visit(ctx: EvalContext): void {
    const rootDist = distributionFromArrangement(
      [...this.surnameEntries, ...this.givenNameEntries].map(e => e.resource_element as ElementKey),
    );
    this.scoreResult = computeSajuNameScore(this.sajuDistribution, rootDist, this.sajuOutput);
    this.putInsight(ctx, SAJU_FRAME, this.scoreResult.score, this.scoreResult.isPassed, 'SAJU+ELEMENT', {
      sajuDistribution: this.sajuDistribution,
      distributionSource: this.sajuOutput ? 'saju-ts' : 'fallback',
      elementDistribution: rootDist,
      combinedDistribution: this.scoreResult.combined,
      scoring: this.scoreResult.breakdown,
      analysisOutput: this.sajuOutput,
    });
  }

  backward(ctx: EvalContext): CalculatorPacket {
    return { signals: [this.signal(SAJU_FRAME, ctx, 1.0)] };
  }

  getAnalysis(): AnalysisDetail<SajuCompatibility> {
    const bd = this.scoreResult?.breakdown, em = bd?.elementMatches, yg = this.sajuOutput?.yongshin;
    return {
      type: 'Saju', score: this.scoreResult?.score ?? 0, polarityScore: 0, elementScore: this.scoreResult?.score ?? 0,
      data: {
        yongshinElement: elementFromSajuCode(yg?.finalYongshin) ?? '',
        heeshinElement: elementFromSajuCode(yg?.finalHeesin) ?? null,
        gishinElement: elementFromSajuCode(yg?.gisin) ?? null,
        nameElements: this.givenNameEntries.map(e => e.resource_element),
        yongshinMatchCount: em?.yongshin ?? 0, gishinMatchCount: em?.gisin ?? 0,
        dayMasterSupportScore: bd?.strength ?? 0, affinityScore: this.scoreResult?.score ?? 0,
      },
    };
  }
}
