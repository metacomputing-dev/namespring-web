import { type ShinsalHit } from '../../domain/Shinsal.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { type ShinsalComposite, type WeightedShinsalHit } from '../analysis/ShinsalWeightModel.js';
import { tracedStep } from './TraceHelpers.js';

export function buildShinsalTraceStep(
  shinsalHits: readonly ShinsalHit[],
  shinsalRefNote: string,
) {
  return tracedStep(
    ANALYSIS_KEYS.SHINSAL,
    `신살 ${shinsalHits.length}종 감지.`,
    [`hits=${shinsalHits.length}`],
    shinsalHits.length === 0
      ? [`조건을 충족하는 신살이 없습니다. 참조 기준: ${shinsalRefNote}.`]
      : [
        `참조 기준: ${shinsalRefNote}. 감지된 ${shinsalHits.length}종:`,
        ...shinsalHits.map(h => `${h.type}(${h.position}): ${h.note}`),
      ],
  );
}

export function buildWeightedShinsalTraceStep(
  weightedShinsalHits: readonly WeightedShinsalHit[],
) {
  return tracedStep(
    ANALYSIS_KEYS.WEIGHTED_SHINSAL,
    `신살 가중치 산출 — ${weightedShinsalHits.length}건, 위치 배율 적용 ` +
    `(일주1.0/월주0.85/년주0.7/시주0.6).`,
    weightedShinsalHits.length > 0
      ? weightedShinsalHits.slice(0, 5).map(w =>
        `${w.hit.type}(${w.hit.position})=${w.weightedScore}점`)
      : ['신살 없음'],
    weightedShinsalHits.length === 0
      ? ['감지된 신살이 없으므로 가중치 산출 대상이 없습니다.']
      : weightedShinsalHits.map(w =>
        `${w.hit.type}: 기본 ${w.baseWeight}점 × ${w.hit.position} 위치배율 ${w.positionMultiplier} = ${w.weightedScore}점` +
        (w.hit.note ? ` (${w.hit.note})` : '')),
  );
}

export function buildShinsalCompositesTraceStep(
  shinsalComposites: readonly ShinsalComposite[],
) {
  return tracedStep(
    ANALYSIS_KEYS.SHINSAL_COMPOSITES,
    `신살 복합 패턴 ${shinsalComposites.length}건 감지` +
    (shinsalComposites.length > 0
      ? ` — ${shinsalComposites.map(c => c.patternName).join(', ')}.`
      : '.'),
    shinsalComposites.length > 0
      ? shinsalComposites.map(c => `${c.patternName}[${c.interactionType}](bonus=${c.bonusScore})`)
      : ['복합 패턴 없음'],
    shinsalComposites.length === 0
      ? ['복합 조건을 충족하는 신살 조합이 없습니다.']
      : shinsalComposites.map(c => `${c.patternName}: ${c.interpretation} (보너스 +${c.bonusScore}점)`),
  );
}

