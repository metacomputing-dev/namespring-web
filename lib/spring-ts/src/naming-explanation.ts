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

const DERIVED_SCORE_TIER: SourceTierMetadata = Object.freeze({
  tier: 'T2_REFERENCE_IMPLEMENTATION',
  sourceType: 'derived_score',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: '점수 벡터에서 계산한 표시용 축이에요. 후보 정렬에는 쓸 수 있지만 단독 권위 근거로 삼지는 않아요.',
  copyrightNote: '외부 원문을 복사하지 않았습니다.',
  authorityTruthEligible: false,
});

const AUTHORED_RULE_TIER: SourceTierMetadata = Object.freeze({
  tier: 'T3_AUTHORED_INTERPRETATION',
  sourceType: 'authored_rule',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: 'spring-ts 안에서 작성한 규칙 기반 이름 해석이에요. 사실로 단정하기보다 제안으로 표현하는 편이 좋아요.',
  copyrightNote: '외부 원문을 복사하지 않았습니다.',
  authorityTruthEligible: false,
});

const OFFICIAL_DATA_TIER: SourceTierMetadata = Object.freeze({
  tier: 'T5_OFFICIAL',
  sourceType: 'official_data',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: '법령 또는 공식 데이터에 근거한, 제한된 범위의 사실 확인이에요.',
  copyrightNote: '외부 원문을 복사하지 않았습니다.',
  authorityTruthEligible: true,
});

const AXIS_LABELS: Record<NamingAxis, string> = {
  legal: '인명용 한자 적합도',
  sajuFit: '사주와 이름의 조화',
  yongshinFit: '보완 기운 일치도',
  elementBalance: '오행 균형',
  hanjaMeaning: '한자 뜻풀이 확인도(뜻의 우열 아님)',
  phonetic: '발음 흐름',
  eraFit: '출생 시대 이름 흐름',
  familyFit: '성과 이름의 발음 연결',
  risk: '위험 신호 점검',
};

const AXIS_SOURCE_TIER: Readonly<Record<NamingAxis, SourceTierMetadata>> = Object.freeze({
  legal: OFFICIAL_DATA_TIER,
  eraFit: OFFICIAL_DATA_TIER,
  phonetic: AUTHORED_RULE_TIER,
  familyFit: AUTHORED_RULE_TIER,
  hanjaMeaning: DERIVED_SCORE_TIER,
  sajuFit: DERIVED_SCORE_TIER,
  yongshinFit: DERIVED_SCORE_TIER,
  elementBalance: DERIVED_SCORE_TIER,
  risk: DERIVED_SCORE_TIER,
});

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
  if (phraseMode === 'deferred') return '근거가 충분히 안정적이지 않아';
  if (phraseMode === 'displayOnly') return '표시용 점수 기준으로는';
  if (phraseMode === 'candidate') return '근거상';
  if (sourceTier.authorityTruthEligible && sourceTier.tier === 'T5_OFFICIAL') {
    return '공식 자료 기준으로는';
  }
  return '규칙 근거 기준으로는';
}

function signalFor(axis: NamingAxis, vector: NamingScoreVector): NamingExplanationSignal | null {
  const value = rounded(vector[axis]);
  const label = AXIS_LABELS[axis];
  const sourceTier = { ...AXIS_SOURCE_TIER[axis] };
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
      phrase: `${label} 항목은 사용할 수 있는 근거가 부족해서 단정하지 않았어요.`,
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
        phrase: `${tierLead(sourceTier, phraseMode)} 위험 신호가 높은 편이에요(${value}/100). 최종 점수만 보지 말고 더 안전한 후보와 비교하세요.`,
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
        phrase: `${tierLead(sourceTier, phraseMode)} 위험 신호가 낮은 편이에요(${value}/100).`,
      };
    }
    return null;
  }

  if (axis === 'hanjaMeaning') {
    if (value >= 80) {
      return {
        axis,
        kind: 'strength',
        phraseMode,
        label,
        value,
        sourceTier,
        phrase: `${tierLead(sourceTier, phraseMode)} 한자 뜻풀이 데이터가 ${value}/100 범위로 확인돼요. 이 값은 뜻의 우열이나 길흉을 평가한 점수가 아니에요.`,
      };
    }
    return {
      axis,
      kind: 'caution',
      phraseMode,
      label,
      value,
      sourceTier,
      phrase: `${tierLead(sourceTier, phraseMode)} 한자 뜻풀이 데이터 확인 범위가 ${value}/100이에요. 뜻의 우열을 뜻하지 않으며, 누락된 풀이를 먼저 확인해 주세요.`,
    };
  }

  if (value >= 80) {
    return {
      axis,
      kind: 'strength',
      phraseMode,
      label,
      value,
      sourceTier,
        phrase: `${tierLead(sourceTier, phraseMode)} ${label} 항목이 강점으로 보여요(${value}/100).`,
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
      phrase: `${tierLead(sourceTier, phraseMode)} ${label} 항목이 약한 편이에요(${value}/100). 결론이 아니라 검토 포인트로 보세요.`,
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
      summary: base,
      strengths: [],
      cautions: [],
      signals: [],
    };
  }

  const signals = orderedSignals(input.scoreVector);
  const narrativeSignals = signals.filter((signal) =>
    signal.kind !== 'unavailable'
    && signal.axis !== 'legal'
    && signal.axis !== 'hanjaMeaning'
    && !(signal.axis === 'risk' && signal.kind === 'strength'));
  const strengths = narrativeSignals
    .filter(signal => signal.kind === 'strength')
    .map(signal => signal.phrase);
  const cautions = narrativeSignals
    .filter(signal => signal.kind === 'caution')
    .map(signal => signal.phrase);

  return {
    summary: base,
    strengths,
    cautions,
    signals,
  };
}
