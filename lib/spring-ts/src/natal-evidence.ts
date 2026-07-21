import type { SajuSummary } from './types.js';

const CANONICAL_ELEMENTS = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);

export type NatalEvidenceReasonCodeV1 =
  | 'SAJU_ANALYSIS_LIMITED'
  | 'SAJU_JUDGMENT_LOW_CONFIDENCE'
  | 'YONGSHIN_JONGGYEOK_RISK'
  | 'YONGSHIN_CONSENSUS_CONFLICT';

export interface NatalEvidenceAssessmentV1 {
  readonly status: 'ready' | 'limited' | 'unavailable';
  readonly reasonCodes: readonly NatalEvidenceReasonCodeV1[];
}

function hasCanonicalElement(value: unknown): boolean {
  return typeof value === 'string'
    && CANONICAL_ELEMENTS.has(value.toUpperCase());
}

/** One shared fail-closed policy for report, candidate, and paid-entry gating. */
export function assessNatalEvidenceV1(
  saju: SajuSummary | null | undefined,
): NatalEvidenceAssessmentV1 {
  if (!saju) {
    return { status: 'unavailable', reasonCodes: ['SAJU_ANALYSIS_LIMITED'] };
  }
  // A successful analysis is represented by the absence of analysisStatus.
  // Failed/unavailable (and any future or malformed non-partial status) must
  // never be downgraded to merely limited evidence and reused for interaction
  // or paid-entry decisions.
  if (saju.analysisStatus !== undefined && saju.analysisStatus !== 'partial') {
    return { status: 'unavailable', reasonCodes: ['SAJU_ANALYSIS_LIMITED'] };
  }
  const reasons = new Set<NatalEvidenceReasonCodeV1>();
  if (saju.analysisStatus === 'partial' || saju.inputUncertainty) {
    reasons.add('SAJU_ANALYSIS_LIMITED');
  }
  if (!saju.yongshin || !saju.gyeokguk) {
    reasons.add('SAJU_ANALYSIS_LIMITED');
  } else {
    const gyeokgukConfidence = saju.gyeokguk.confidence;
    const yongshinConfidence = saju.yongshin.confidence;
    const confidenceShapeValid = Number.isFinite(gyeokgukConfidence)
      && gyeokgukConfidence >= 0
      && gyeokgukConfidence <= 1
      && Number.isFinite(yongshinConfidence)
      && yongshinConfidence >= 0
      && yongshinConfidence <= 100;
    if (!confidenceShapeValid) reasons.add('SAJU_ANALYSIS_LIMITED');
    const lowConfidenceAxes = [
      saju.axisStrength?.strength,
      saju.axisStrength?.gyeokguk,
      saju.axisStrength?.yongshin,
    ].some((strength) => strength === 'candidate' || strength === 'deferred');
    if (confidenceShapeValid && (lowConfidenceAxes
      || gyeokgukConfidence < 0.45
      || yongshinConfidence < 45)) {
      reasons.add('SAJU_JUDGMENT_LOW_CONFIDENCE');
    }
    if (!hasCanonicalElement(saju.yongshin.element)
      || (saju.yongshin.warnings?.length ?? 0) > 0) {
      reasons.add('SAJU_ANALYSIS_LIMITED');
    }
    if (saju.yongshin.jonggyeokRisk?.level === 'HIGH') {
      reasons.add('YONGSHIN_JONGGYEOK_RISK');
    }
    const consensus = saju.yongshinConsensus ?? saju.yongshin.consensus;
    if (consensus?.final.conflictLevel === 'medium'
      || consensus?.final.conflictLevel === 'high') {
      reasons.add('YONGSHIN_CONSENSUS_CONFLICT');
    }
  }
  return reasons.size > 0
    ? { status: 'limited', reasonCodes: [...reasons] }
    : { status: 'ready', reasonCodes: [] };
}
