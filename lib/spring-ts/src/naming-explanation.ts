import type { EvaluationResult } from './core/evaluator.js';
import { buildInterpretation } from './core/name-utils.js';
import type {
  CandidateStrengthProfile,
  NamingExplanation,
  NamingExplanationPhraseMode,
  NamingExplanationSignal,
  NamingScoreVector,
  SajuJudgmentStrength,
  SourceTierMetadata,
} from './types.js';

type NamingAxis = keyof NamingScoreVector;

const DERIVED_SCORE_TIER: SourceTierMetadata = {
  tier: 'T2_REFERENCE_IMPLEMENTATION',
  sourceType: 'derived_score',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: 'Derived score vector axis; useful for product ranking but not standalone authority truth.',
  copyrightNote: 'No copied source text.',
  authorityTruthEligible: false,
};

const AUTHORED_RULE_TIER: SourceTierMetadata = {
  tier: 'T3_AUTHORED_INTERPRETATION',
  sourceType: 'authored_rule',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: 'Rule-based naming heuristic authored in spring-ts; must be worded as a suggestion, not a fact.',
  copyrightNote: 'No copied source text.',
  authorityTruthEligible: false,
};

const OFFICIAL_DATA_TIER: SourceTierMetadata = {
  tier: 'T5_OFFICIAL',
  sourceType: 'official_data',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: 'Official or legal data source used for a bounded factual check.',
  copyrightNote: 'No copied source text.',
  authorityTruthEligible: true,
};

const AXIS_LABELS: Record<NamingAxis, string> = {
  legal: 'legal registrability',
  sajuFit: 'saju-name fit',
  yongshinFit: 'yongshin alignment',
  elementBalance: 'element balance',
  hanjaMeaning: 'hanja meaning coverage',
  phonetic: 'phonetic flow',
  eraFit: 'birth-era name trend',
  familyFit: 'surname-given phonetic fit',
  risk: 'risk screen',
};

const AXIS_SOURCE_TIER: Record<NamingAxis, SourceTierMetadata> = {
  legal: OFFICIAL_DATA_TIER,
  eraFit: OFFICIAL_DATA_TIER,
  phonetic: AUTHORED_RULE_TIER,
  familyFit: AUTHORED_RULE_TIER,
  hanjaMeaning: AUTHORED_RULE_TIER,
  sajuFit: DERIVED_SCORE_TIER,
  yongshinFit: DERIVED_SCORE_TIER,
  elementBalance: DERIVED_SCORE_TIER,
  risk: DERIVED_SCORE_TIER,
};

const AXIS_ORDER: readonly NamingAxis[] = [
  'legal',
  'sajuFit',
  'yongshinFit',
  'elementBalance',
  'hanjaMeaning',
  'phonetic',
  'eraFit',
  'familyFit',
  'risk',
];

function rounded(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function modeRank(mode: NamingExplanationPhraseMode): number {
  return {
    assertive: 4,
    practical: 3,
    candidate: 2,
    deferred: 1,
    displayOnly: 0,
  }[mode];
}

function weakerMode(
  left: NamingExplanationPhraseMode,
  right: NamingExplanationPhraseMode,
): NamingExplanationPhraseMode {
  return modeRank(left) <= modeRank(right) ? left : right;
}

export function selectNamingPhraseMode(input: {
  readonly strength?: SajuJudgmentStrength;
  readonly sourceTier?: SourceTierMetadata;
  readonly risk?: number | null;
}): NamingExplanationPhraseMode {
  let mode: NamingExplanationPhraseMode;
  const tier = input.sourceTier?.tier;
  if (!input.sourceTier || input.sourceTier.authorityTruthEligible === false || /^T[0-2]_/.test(tier ?? '')) {
    mode = 'displayOnly';
  } else if (tier === 'T5_OFFICIAL') {
    mode = 'assertive';
  } else if (tier === 'T4_PRIMARY_TEXT' || tier === 'T3_AUTHORED_INTERPRETATION') {
    mode = 'practical';
  } else {
    mode = 'candidate';
  }

  if (input.strength === 'practical') mode = weakerMode(mode, 'practical');
  if (input.strength === 'candidate') mode = weakerMode(mode, 'candidate');
  if (input.strength === 'deferred') mode = weakerMode(mode, 'deferred');
  if (typeof input.risk === 'number' && input.risk >= 60) mode = weakerMode(mode, 'candidate');
  return mode;
}

function tierLead(sourceTier: SourceTierMetadata, phraseMode: NamingExplanationPhraseMode): string {
  if (phraseMode === 'deferred') return 'Evidence is not stable enough to treat';
  if (phraseMode === 'displayOnly') return 'Display-only scoring shows';
  if (phraseMode === 'candidate') return 'Evidence suggests';
  if (sourceTier.authorityTruthEligible && sourceTier.tier === 'T5_OFFICIAL') {
    return 'Official data supports';
  }
  return 'Rule evidence supports';
}

function signalFor(axis: NamingAxis, vector: NamingScoreVector): NamingExplanationSignal | null {
  const value = rounded(vector[axis]);
  const label = AXIS_LABELS[axis];
  const sourceTier = AXIS_SOURCE_TIER[axis];
  const phraseMode = selectNamingPhraseMode({
    sourceTier,
    risk: vector.risk,
  });

  if (value === null) {
    return {
      axis,
      kind: 'unavailable',
      phraseMode: 'deferred',
      label,
      value,
      sourceTier,
      phrase: `${label} has no usable evidence, so this explanation avoids a firm claim.`,
    };
  }

  if (axis === 'risk') {
    if (value >= 60) {
      return {
        axis,
        kind: 'caution',
        phraseMode,
        label,
        value,
        sourceTier,
        phrase: `${tierLead(sourceTier, phraseMode)} elevated risk (${value}/100); compare safer alternatives before relying on the final score.`,
      };
    }
    if (value <= 30) {
      return {
        axis,
        kind: 'strength',
        phraseMode,
        label,
        value,
        sourceTier,
        phrase: `${tierLead(sourceTier, phraseMode)} a low risk screen (${value}/100).`,
      };
    }
    return null;
  }

  if (value >= 80) {
    return {
      axis,
      kind: 'strength',
      phraseMode,
      label,
      value,
      sourceTier,
      phrase: `${tierLead(sourceTier, phraseMode)} strong ${label} (${value}/100).`,
    };
  }

  if (value <= 45) {
    return {
      axis,
      kind: 'caution',
      phraseMode,
      label,
      value,
      sourceTier,
      phrase: `${tierLead(sourceTier, phraseMode)} weak ${label} (${value}/100); treat it as a review point, not a conclusion.`,
    };
  }

  return null;
}

function orderedSignals(vector: NamingScoreVector): NamingExplanationSignal[] {
  return AXIS_ORDER
    .map(axis => signalFor(axis, vector))
    .filter((signal): signal is NamingExplanationSignal => signal !== null);
}

export function buildNamingExplanation(input: {
  readonly evaluationResult: EvaluationResult;
  readonly scoreVector?: NamingScoreVector;
  readonly strengthProfile?: CandidateStrengthProfile;
}): NamingExplanation {
  const base = buildInterpretation(input.evaluationResult);
  if (!input.scoreVector) {
    return {
      summary: `${base} Score-vector evidence is not surfaced, so the explanation is limited to category pass/fail rules.`,
      strengths: [],
      cautions: ['Score-vector evidence is unavailable; avoid treating this as a detailed naming diagnosis.'],
      signals: [],
    };
  }

  const signals = orderedSignals(input.scoreVector);
  const strengths = signals.filter(signal => signal.kind === 'strength').map(signal => signal.phrase);
  const cautions = signals.filter(signal => signal.kind !== 'strength').map(signal => signal.phrase);
  const profilePhrase = input.strengthProfile
    ? `Primary candidate profile: ${input.strengthProfile.label}.`
    : 'Primary candidate profile is not available.';
  const topStrength = strengths[0] ?? 'No single axis is strong enough to state as the main reason.';
  const topCaution = cautions[0] ?? 'No high-risk axis crossed the caution threshold.';

  return {
    summary: [base, profilePhrase, topStrength, topCaution].join(' '),
    strengths,
    cautions,
    signals,
  };
}
