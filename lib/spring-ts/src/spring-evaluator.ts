import {
  type EvalContext, type FrameInsight, type EvaluationResult,
  type NameCalculator,
} from '../../name-ts/src/calculator/evaluator.js';
import { clamp } from '../../name-ts/src/calculator/scoring.js';

export const SAJU_FRAME = 'SAJU_ELEMENT_BALANCE';

const NAME_FRAMES = ['FOURFRAME_LUCK', 'STROKE_POLARITY', 'HANGUL_ELEMENT', 'HANGUL_POLARITY', 'FOURFRAME_ELEMENT'] as const;
const RELAXABLE = new Set<string>(NAME_FRAMES);

function getInsight(ctx: EvalContext, frame: string): FrameInsight {
  return ctx.insights[frame] ?? { frame, score: 0, isPassed: false, label: 'MISSING', details: {} };
}

function extractSajuPriority(ctx: EvalContext): number {
  const si = ctx.insights[SAJU_FRAME];
  if (!si) return 0;

  const d = si.details as Record<string, any>;
  const ss = d?.scoring as Record<string, any> | undefined;
  if (!ss) return 0;

  const bal = Number(ss.balance) || 0;
  const yv = Number(ss.yongshin) || 0;
  const pt = Number((ss.penalties as Record<string, any>)?.total) || 0;
  const ao = d?.analysisOutput as Record<string, any> | undefined;
  const confRaw = ao?.yongshin?.finalConfidence;
  const conf = clamp(typeof confRaw === 'number' ? confRaw : 0.65, 0, 1);
  const sig = ((bal + yv) / 200) * (0.55 + conf * 0.45);

  return clamp(sig - Math.min(1, pt / 20) * 0.25, 0, 1);
}

function frameWeightMultiplier(frame: string, sp: number): number {
  if (frame === SAJU_FRAME) return 1 + sp * 0.45;
  if (RELAXABLE.has(frame)) return 1 - sp * 0.3;
  return 1;
}

export function springEvaluateName(
  calculators: NameCalculator[],
  ctx: EvalContext,
): EvaluationResult {
  const signals = calculators.flatMap(c => {
    c.visit(ctx);
    return c.backward(ctx).signals;
  }).filter(s => s.weight > 0);

  const sp = extractSajuPriority(ctx);
  const adjusted = signals.map(s => {
    const aw = s.weight * frameWeightMultiplier(s.frame, sp);
    return { ...s, adjustedWeight: aw, adjustedWeighted: s.score * aw };
  });
  const totalWeight = adjusted.reduce((a, s) => a + s.adjustedWeight, 0);
  const score = totalWeight > 0
    ? adjusted.reduce((a, s) => a + s.adjustedWeighted, 0) / totalWeight
    : 0;

  const adaptive = sp >= 0.55;
  const relaxableFailures = adjusted.filter(s => RELAXABLE.has(s.frame) && !s.isPassed);
  const allowedFailures = adaptive ? (sp >= 0.78 ? 2 : 1) : 0;
  const threshold = adaptive ? 60 - 8 * sp : 60;

  let isPassed: boolean;
  if (adaptive) {
    const sI = getInsight(ctx, SAJU_FRAME);
    const fI = getInsight(ctx, 'FOURFRAME_LUCK');
    isPassed = sI.isPassed
      && fI.score >= 35
      && score >= threshold
      && !relaxableFailures.some(s => s.score < 45)
      && relaxableFailures.length <= allowedFailures;
  } else {
    const allFrames = [...NAME_FRAMES, SAJU_FRAME];
    isPassed = allFrames.every(f => getInsight(ctx, f).isPassed) && score >= 60;
  }

  const frames = [...new Set(adjusted.map(s => s.frame))];

  (ctx.insights as Record<string, FrameInsight>)['TOTAL'] = {
    frame: 'TOTAL', score, isPassed, label: 'ROOT',
    details: {
      contributions: Object.fromEntries(adjusted.map(s => [s.frame, {
        rawScore: s.score,
        weight: s.weight,
        weightMultiplier: s.weight > 0 ? s.adjustedWeight / s.weight : 1,
        adjustedWeight: s.adjustedWeight,
        weighted: s.adjustedWeighted,
        isPassed: s.isPassed,
      }])),
      failedFrames: adjusted.filter(s => !s.isPassed).map(s => s.frame),
      adaptivePolicy: {
        mode: adaptive ? 'adaptive' : 'strict',
        sajuPriority: sp,
        allowedFailures,
        threshold,
        relaxableFailures: relaxableFailures.map(s => s.frame),
      },
    },
  };

  const cm: Record<string, FrameInsight> = {};
  cm['TOTAL'] = getInsight(ctx, 'TOTAL');
  for (const f of frames) cm[f] = getInsight(ctx, f);

  return {
    score: cm['TOTAL'].score,
    isPassed: cm['TOTAL'].isPassed,
    categoryMap: cm,
    categories: frames.map(f => cm[f]),
  };
}
