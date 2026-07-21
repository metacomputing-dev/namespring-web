import {
  candidateIdFromNameIdentityV1,
  canonicalizeCandidateNameIdentityV1,
} from './candidate-id.js';
import { assertNameCharacterSyntax } from '../name-entry-resolver.js';
import {
  CANDIDATE_PARETO_ORDERING_POLICY_V1,
  CANDIDATE_PRESENTATION_ORDERING_POLICY_V2,
  CANDIDATE_QUERY_ID_PATTERN_V1,
  CANDIDATE_SEARCH_SCHEMA_V1,
  CandidateSearchContractErrorV1,
  type CandidateSearchItemV1,
  type CandidateSearchNameCharacterV1,
  type CandidateSearchNameElementV1,
  type CandidateSearchOrderingV1,
  type CandidateSearchQueryV1,
  type CandidateSearchResponseV1,
} from './types.js';
import engineConfig from '../../config/engine.json';
import {
  CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2,
} from '../candidate-selection.js';
import {
  isRecognizedHanjaGlyph,
  type HanjaLegalStatus,
} from '../hanja-annotations.js';
import type {
  CandidatePresentationEvidence,
  CandidateStrengthProfile,
  NameCharInput,
  NamingScoreVector,
  SpringCandidateSummary,
} from '../types.js';
import type { NatalEvidenceAssessmentV1 } from '../natal-evidence.js';

export const MAX_CANDIDATE_SEARCH_PAGE_SIZE_V1 = 100;

function copyCandidatePresentationEvidenceOrderV2():
typeof CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2 {
  return Object.freeze([
    ...CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2,
  ]) as typeof CANDIDATE_PRESENTATION_EVIDENCE_ORDER_V2;
}

export interface BuildCandidateSearchResponseV1Input {
  /** Already ordered and ranked by SpringEngine.getNameCandidateSummaries(). */
  readonly summaries: readonly SpringCandidateSummary[];
  readonly offset: number;
  readonly requestedLimit: number;
  readonly query: CandidateSearchQueryV1;
  /** Exact generation path used for this query, supplied by SpringEngine. */
  readonly candidateRecallGeneration:
    CandidateSearchOrderingV1['rankingBasis']['candidateRecall']['generation'];
  /** Exact ordering path used by SpringEngine for this query. */
  readonly orderingMode?: CandidateSearchOrderingV1['mode'];
  /**
   * The public saju-guided endpoint requires complete surname and given-name
   * Hanja identity. Lower-level compatibility builders may omit this flag.
   */
  readonly requireCanonicalHanja?: boolean;
  /** Omission is treated as unavailable, never as implicitly trustworthy. */
  readonly natalEvidence?: NatalEvidenceAssessmentV1;
  readonly hasMore?: boolean;
  readonly totalAvailable?: number;
}

function contractError(
  reason: ConstructorParameters<typeof CandidateSearchContractErrorV1>[0],
  message: string,
): never {
  throw new CandidateSearchContractErrorV1(reason, message);
}

function requireScore(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return contractError('INVALID_SCORE', `${label} must be within 0..100.`);
  }
  return value;
}

function requireNullableScore(value: number | null, label: string): number | null {
  return value === null ? null : requireScore(value, label);
}

function copyScoreVector(vector: NamingScoreVector): NamingScoreVector {
  return {
    legal: requireNullableScore(vector.legal, 'scoreVector.legal'),
    sajuFit: requireNullableScore(vector.sajuFit, 'scoreVector.sajuFit'),
    yongshinFit: requireNullableScore(vector.yongshinFit, 'scoreVector.yongshinFit'),
    elementBalance: requireNullableScore(vector.elementBalance, 'scoreVector.elementBalance'),
    hanjaMeaning: requireNullableScore(vector.hanjaMeaning, 'scoreVector.hanjaMeaning'),
    phonetic: requireNullableScore(vector.phonetic, 'scoreVector.phonetic'),
    eraFit: requireNullableScore(vector.eraFit, 'scoreVector.eraFit'),
    familyFit: requireNullableScore(vector.familyFit, 'scoreVector.familyFit'),
    risk: requireScore(vector.risk, 'scoreVector.risk'),
  };
}

function copyPresentationEvidence(
  evidence: CandidatePresentationEvidence,
): CandidatePresentationEvidence {
  const popularityRank = evidence.popularityRank;
  if (popularityRank !== null
    && (!Number.isSafeInteger(popularityRank) || popularityRank < 1)) {
    return contractError(
      'INVALID_POPULARITY',
      'presentationEvidence.popularityRank must be null or a positive safe integer.',
    );
  }
  return {
    meaningConfidence: requireNullableScore(
      evidence.meaningConfidence,
      'presentationEvidence.meaningConfidence',
    ),
    popularityRank,
    phonetic: requireNullableScore(evidence.phonetic, 'presentationEvidence.phonetic'),
    familyFit: requireNullableScore(evidence.familyFit, 'presentationEvidence.familyFit'),
    eraFit: requireNullableScore(evidence.eraFit, 'presentationEvidence.eraFit'),
    risk: requireScore(evidence.risk, 'presentationEvidence.risk'),
    meaningBasis: 'authored_gloss_safety_v1',
    popularityBasis: 'local_official_name_stat',
  };
}

function copyStrengthProfile(profile: CandidateStrengthProfile): CandidateStrengthProfile {
  return {
    id: profile.id,
    label: profile.label,
    primaryAxis: profile.primaryAxis,
    reasons: [...profile.reasons],
    ...(profile.displayReasons ? { displayReasons: [...profile.displayReasons] } : {}),
    paretoFrontier: profile.paretoFrontier,
  };
}

function canonicalGivenName(
  givenName: readonly NameCharInput[],
): readonly NameCharInput[] {
  if (givenName.length < 1 || givenName.length > 2) {
    return contractError(
      'UNSUPPORTED_RECOMMENDATION_NAME_LENGTH',
      'Candidate recommendation output supports only one- or two-syllable given names.',
    );
  }

  return givenName.map((character, index) => {
    if (typeof character.hangul !== 'string') {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Candidate givenName[${index}].hangul must be a string.`,
      );
    }
    const hangul = character.hangul.normalize('NFC');
    if (hangul.length === 0 || hangul !== hangul.trim()) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Candidate givenName[${index}].hangul is invalid.`,
      );
    }

    const normalizedHanja = character.hanja?.normalize('NFC');
    const hanja = normalizedHanja === '' ? undefined : normalizedHanja;
    if (hanja !== undefined && (hanja.length === 0 || hanja !== hanja.trim())) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Candidate givenName[${index}].hanja is invalid.`,
      );
    }

    // Report continuation needs canonical character identity only. Mutable
    // display/scoring metadata is intentionally not trusted across the hop.
    return {
      hangul,
      ...(hanja === undefined ? {} : { hanja }),
    };
  });
}

const CANDIDATE_NAME_ELEMENTS = new Set<CandidateSearchNameElementV1>([
  'Wood',
  'Fire',
  'Earth',
  'Metal',
  'Water',
]);
const CANDIDATE_LEGAL_STATUSES = new Set<HanjaLegalStatus>([
  'allowed',
  'variantAllowed',
  'hangulOnly',
  'unknown',
  'notAllowed',
]);

function optionalDisplayText(
  value: unknown,
  label: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    return contractError('INVALID_NAME_PAYLOAD', `${label} must be a string when supplied.`);
  }
  const normalized = value.normalize('NFC');
  if (normalized !== normalized.trim()
    || normalized.length === 0
    || Array.from(normalized).length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    return contractError('INVALID_NAME_PAYLOAD', `${label} is not safe display text.`);
  }
  return normalized;
}

function projectGivenCharacter(
  source: NameCharInput,
  canonical: NameCharInput,
  index: number,
): CandidateSearchNameCharacterV1 {
  const hanja = canonical.hanja ?? '';
  const meaning = optionalDisplayText(source.meaning, `givenName[${index}].meaning`, 120);
  const elementLabel = optionalDisplayText(
    source.elementLabel,
    `givenName[${index}].elementLabel`,
    24,
  );
  const isVariantOf = optionalDisplayText(
    source.isVariantOf,
    `givenName[${index}].isVariantOf`,
    1,
  );

  let strokes: number | undefined;
  if (source.strokes !== undefined) {
    if (!Number.isSafeInteger(source.strokes) || source.strokes < 1 || source.strokes > 128) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `givenName[${index}].strokes must be a positive safe Hanja stroke count.`,
      );
    }
    strokes = source.strokes;
  }

  let element: CandidateSearchNameElementV1 | undefined;
  if (source.element !== undefined) {
    if (typeof source.element !== 'string'
      || !CANDIDATE_NAME_ELEMENTS.has(source.element as CandidateSearchNameElementV1)) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `givenName[${index}].element is not a supported five-element value.`,
      );
    }
    element = source.element as CandidateSearchNameElementV1;
  }
  if (elementLabel !== undefined && element === undefined) {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      `givenName[${index}].elementLabel requires an element key.`,
    );
  }

  let legalStatus: HanjaLegalStatus | undefined;
  if (source.legalStatus !== undefined) {
    if (!CANDIDATE_LEGAL_STATUSES.has(source.legalStatus)) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `givenName[${index}].legalStatus is invalid.`,
      );
    }
    legalStatus = source.legalStatus;
  }
  if (source.legalRegistrable !== undefined
    && typeof source.legalRegistrable !== 'boolean') {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      `givenName[${index}].legalRegistrable must be boolean when supplied.`,
    );
  }
  const legalRegistrable = source.legalRegistrable;

  if (hanja.length === 0) {
    if (meaning !== undefined
      || strokes !== undefined
      || element !== undefined
      || legalRegistrable !== undefined
      || isVariantOf !== undefined
      || (legalStatus !== undefined && legalStatus !== 'hangulOnly')) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Hangul-only givenName[${index}] cannot carry Hanja evidence.`,
      );
    }
  } else {
    if (legalStatus === 'hangulOnly') {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Hanja givenName[${index}] cannot be marked hangulOnly.`,
      );
    }
    if ((legalStatus === 'allowed' || legalStatus === 'variantAllowed')
      && legalRegistrable !== true) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Registrable givenName[${index}] requires matching legal evidence.`,
      );
    }
    if (legalStatus === 'notAllowed' && legalRegistrable !== false) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Non-registrable givenName[${index}] requires matching legal evidence.`,
      );
    }
    if (legalStatus === 'unknown' && legalRegistrable !== undefined) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `Unknown legal status for givenName[${index}] cannot claim registrability.`,
      );
    }
    if (legalRegistrable !== undefined && legalStatus === undefined) {
      return contractError(
        'INVALID_NAME_PAYLOAD',
        `givenName[${index}].legalRegistrable requires legalStatus.`,
      );
    }
  }
  if (isVariantOf !== undefined
    && (legalStatus !== 'variantAllowed'
      || !isRecognizedHanjaGlyph(isVariantOf)
      || isVariantOf === hanja)) {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      `givenName[${index}].isVariantOf is inconsistent with its legal status.`,
    );
  }

  return {
    hangul: canonical.hangul,
    hanja,
    ...(meaning === undefined ? {} : { meaning }),
    ...(strokes === undefined ? {} : { strokes }),
    ...(element === undefined ? {} : { element }),
    ...(elementLabel === undefined ? {} : { elementLabel }),
    ...(legalStatus === undefined ? {} : { legalStatus }),
    ...(legalRegistrable === undefined ? {} : { legalRegistrable }),
    ...(isVariantOf === undefined ? {} : { isVariantOf }),
  };
}

function canonicalResolvedSurname(
  fullHangul: string,
  fullHanja: string,
  givenHangul: string,
  givenHanja: string,
): readonly NameCharInput[] {
  const surnameHangul = Array.from(fullHangul).slice(
    0,
    Array.from(fullHangul).length - Array.from(givenHangul).length,
  );
  const surnameHanjaText = givenHanja.length > 0
    ? Array.from(fullHanja).slice(0, Array.from(fullHanja).length - Array.from(givenHanja).length).join('')
    : fullHanja;
  const surnameHanja = Array.from(surnameHanjaText);
  if (surnameHangul.length < 1
    || surnameHangul.length > 2
    || (surnameHanja.length !== 0 && surnameHanja.length !== surnameHangul.length)) {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      'Candidate surname cannot be reconstructed from its resolved identity.',
    );
  }
  return surnameHangul.map((hangul, index) => ({
    hangul,
    ...(surnameHanja.length === 0 ? {} : { hanja: surnameHanja[index] }),
  }));
}

function projectCandidate(summary: SpringCandidateSummary): CandidateSearchItemV1 {
  if (!Number.isSafeInteger(summary.rank) || summary.rank < 1) {
    return contractError('INVALID_RANK', 'Candidate rank must be a positive safe integer.');
  }

  const givenName = canonicalGivenName(summary.givenName);
  const givenCharacters = summary.givenName.map((character, index) =>
    projectGivenCharacter(character, givenName[index]!, index));
  const givenHangul = givenName.map((character) => character.hangul).join('');
  const expectedGivenHangul = summary.givenHangul.normalize('NFC');
  const fullHangul = summary.fullHangul.normalize('NFC');
  const fullHanja = summary.fullHanja.normalize('NFC');
  if (givenHangul !== expectedGivenHangul || !fullHangul.endsWith(givenHangul)) {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      'Candidate givenName does not match its resolved display identity.',
    );
  }

  const givenHanja = givenName.map((character) => character.hanja ?? '').join('');
  if (givenHanja.length > 0 && !fullHanja.endsWith(givenHanja)) {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      'Candidate givenName Hanja does not match its resolved display identity.',
    );
  }
  const surname = canonicalResolvedSurname(
    fullHangul,
    fullHanja,
    givenHangul,
    givenHanja,
  );
  try {
    assertNameCharacterSyntax(surname, { role: 'surname' });
    assertNameCharacterSyntax(givenName, { role: 'givenName' });
  } catch {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      'Candidate name contains an invalid Hangul or Hanja character.',
    );
  }
  const surnameHangul = surname.map((character) => character.hangul).join('');
  const surnameHanja = surname.map((character) => character.hanja ?? '').join('');
  let identity: ReturnType<typeof canonicalizeCandidateNameIdentityV1>;
  try {
    identity = canonicalizeCandidateNameIdentityV1({
      surnameHangul,
      surnameHanja,
      givenHangul,
      givenHanja,
    });
  } catch {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      'Candidate name identity is not canonical.',
    );
  }
  if (identity.fullHangul !== fullHangul || identity.fullHanja !== fullHanja) {
    return contractError(
      'INVALID_NAME_PAYLOAD',
      'Candidate segmented identity does not match its display identity.',
    );
  }
  const candidateId = candidateIdFromNameIdentityV1(identity);
  const popularityRank = summary.popularityRank;
  if (popularityRank !== null
    && (!Number.isSafeInteger(popularityRank) || popularityRank < 1)) {
    return contractError(
      'INVALID_POPULARITY',
      'Candidate popularity rank must be null or a positive safe integer.',
    );
  }
  const maleRatio = summary.maleRatio;
  if (maleRatio !== null
    && (!Number.isFinite(maleRatio) || maleRatio < 0 || maleRatio > 1)) {
    return contractError(
      'INVALID_POPULARITY',
      'Candidate maleRatio must be null or within 0..1.',
    );
  }
  if (!['male', 'female', 'unknown'].includes(summary.nameGender)) {
    return contractError(
      'INVALID_POPULARITY',
      'Candidate nameGender must be male, female, or unknown.',
    );
  }
  return {
    candidateId,
    rank: summary.rank,
    name: {
      fullHangul: identity.fullHangul,
      fullHanja: identity.fullHanja,
      givenHangul,
      givenHanja,
      givenCharacters,
    },
    score: {
      final: requireScore(summary.finalScore, 'finalScore'),
      ...(summary.scoreVector ? { vector: copyScoreVector(summary.scoreVector) } : {}),
      ...(summary.strengthProfile
        ? { strengthProfile: copyStrengthProfile(summary.strengthProfile) }
        : {}),
    },
    popularity: {
      rank: popularityRank,
      maleRatio,
      tendency: summary.nameGender,
    },
    ...(summary.presentationEvidence
      ? { presentationEvidence: copyPresentationEvidence(summary.presentationEvidence) }
      : {}),
    reportInput: {
      candidateId,
      surname,
      givenName,
    },
  };
}

export function buildCandidateSearchResponseV1(
  input: BuildCandidateSearchResponseV1Input,
): CandidateSearchResponseV1 {
  const { offset, requestedLimit, summaries } = input;
  if (!Number.isSafeInteger(offset)
    || offset < 0
    || !Number.isSafeInteger(requestedLimit)
    || requestedLimit < 1) {
    return contractError(
      'INVALID_PAGINATION',
      'Candidate search pagination requires a non-negative offset and positive limit.',
    );
  }
  const query = input.query;
  if (!CANDIDATE_QUERY_ID_PATTERN_V1.test(query.queryId)) {
    return contractError('INVALID_QUERY_ID', 'Candidate queryId is invalid.');
  }
  if (query.scope !== 'engine_session'
    || query.expiresOn !== 'engine_close_or_lru_eviction'
    || query.clientInstruction !== 'reuse_query_id_for_every_page'
    || !Number.isSafeInteger(query.maxBrowsableCandidates)
    || query.maxBrowsableCandidates < 1
    || offset > query.maxBrowsableCandidates
    || typeof query.truncated !== 'boolean') {
    return contractError('INVALID_PAGINATION', 'Candidate query snapshot metadata is invalid.');
  }
  if (requestedLimit > MAX_CANDIDATE_SEARCH_PAGE_SIZE_V1
    || summaries.length > requestedLimit
    || summaries.length > MAX_CANDIDATE_SEARCH_PAGE_SIZE_V1) {
    return contractError(
      'PAGE_TOO_LARGE',
      `Candidate search pages are limited to ${MAX_CANDIDATE_SEARCH_PAGE_SIZE_V1} items.`,
    );
  }

  if (input.totalAvailable !== undefined
    && (!Number.isSafeInteger(input.totalAvailable)
      || input.totalAvailable < 0
      || (summaries.length > 0 && input.totalAvailable < offset + summaries.length))) {
    return contractError(
      'INVALID_PAGINATION',
      'Candidate totalAvailable is inconsistent with the returned page.',
    );
  }
  if (input.hasMore !== undefined && typeof input.hasMore !== 'boolean') {
    return contractError(
      'INVALID_PAGINATION',
      'Candidate hasMore must be a boolean when supplied.',
    );
  }
  const natalEvidence = input.natalEvidence ?? {
    status: 'unavailable' as const,
    reasonCodes: ['SAJU_ANALYSIS_LIMITED'] as const,
  };
  if (natalEvidence === null
    || typeof natalEvidence !== 'object'
    || Array.isArray(natalEvidence)
    || !['ready', 'limited', 'unavailable'].includes(natalEvidence.status)
    || !Array.isArray(natalEvidence.reasonCodes)
    || natalEvidence.reasonCodes.some((reason) => ![
      'SAJU_ANALYSIS_LIMITED',
      'SAJU_JUDGMENT_LOW_CONFIDENCE',
      'YONGSHIN_JONGGYEOK_RISK',
      'YONGSHIN_CONSENSUS_CONFLICT',
    ].includes(reason))
    || new Set(natalEvidence.reasonCodes).size !== natalEvidence.reasonCodes.length
    || (natalEvidence.status === 'ready') !== (natalEvidence.reasonCodes.length === 0)) {
    return contractError('SAJU_ANALYSIS_UNAVAILABLE', 'Candidate natal evidence metadata is invalid.');
  }
  if (input.hasMore === true
    && input.totalAvailable !== undefined
    && input.totalAvailable <= offset + summaries.length) {
    return contractError(
      'INVALID_PAGINATION',
      'Candidate hasMore conflicts with totalAvailable.',
    );
  }
  if (input.hasMore === false
    && input.totalAvailable !== undefined
    && input.totalAvailable > offset + summaries.length) {
    return contractError(
      'INVALID_PAGINATION',
      'Candidate hasMore conflicts with totalAvailable.',
    );
  }

  const items = summaries.map(projectCandidate);
  if (input.requireCanonicalHanja === true
    && items.some((item) =>
      [...item.reportInput.surname, ...item.reportInput.givenName]
        .some((character) => !character.hanja))) {
    return contractError(
      'HANJA_REQUIRED_FOR_SAJU_GUIDED_RECOMMENDATION',
      'Saju-guided candidate search requires canonical Hanja for every name character.',
    );
  }
  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const expectedRank = offset + index + 1;
    if (item.rank !== expectedRank || seenRanks.has(item.rank)) {
      return contractError(
        'INVALID_RANK',
        'Candidate page must preserve contiguous engine ranks in response order.',
      );
    }
    if (seenIds.has(item.candidateId)) {
      return contractError(
        'DUPLICATE_CANDIDATE',
        'Candidate page contains a duplicate canonical name identity.',
      );
    }
    seenRanks.add(item.rank);
    seenIds.add(item.candidateId);
  }

  const paretoOrdering = input.orderingMode === 'pareto_frontier';
  const evidenceOrder = paretoOrdering
    ? Object.freeze([]) as readonly []
    : copyCandidatePresentationEvidenceOrderV2();
  return {
    schemaVersion: CANDIDATE_SEARCH_SCHEMA_V1,
    query: { ...query },
    ordering: {
      authority: 'spring_engine',
      source: 'SpringEngine.getNameCandidateSummaries',
      policyVersion: paretoOrdering
        ? CANDIDATE_PARETO_ORDERING_POLICY_V1
        : CANDIDATE_PRESENTATION_ORDERING_POLICY_V2,
      mode: paretoOrdering ? 'pareto_frontier' : 'recommended',
      clientInstruction: 'preserve_order_and_rank',
      rankScope: 'query',
      rankingBasis: {
        rawScore: 'engine_score_unchanged',
        presentationScope: paretoOrdering
          ? 'bounded_pareto_pool_with_diversity'
          : 'bounded_equivalent_score_window',
        rawScoreWindow: paretoOrdering
          ? 8
          : engineConfig.candidateSelection.presentationScoreWindow,
        evidenceOrder,
        missingEvidence: {
          scoreAxes: paretoOrdering ? 'pairwise_axis_omission' : 'fixed_midpoint_50',
          popularityRank: paretoOrdering ? 'not_used' : 'no_usage_bonus',
        },
        rarityPolicy: 'never_hard_reject',
        ...(paretoOrdering ? {
          paretoFrontier: {
            poolLimit: engineConfig.candidateSelection.paretoPoolLimit,
            objectives: [
              'legal',
              'sajuFit',
              'yongshinFit',
              'elementBalance',
              'hanjaMeaning',
              'phonetic',
              'eraFit',
              'familyFit',
              'riskQuality',
            ],
            dominance: 'non_dominated_available_axes_v1',
            frontierBonus: 3,
            diversityWindow: 8,
            diversityBasis: 'profile_hangul_hanja_syllable_v1',
            overflowOrder: 'engine_score_desc_stable_input',
          } as const,
        } : {}),
        candidateRecall: {
          generation: input.candidateRecallGeneration,
          hanjaVariantsPerHangul:
            engineConfig.candidateSelection.hanjaVariantsPerHangul,
          variantRetentionBasis: 'engine_raw_score_then_stable_input',
        },
      },
    },
    evaluation: {
      method: 'saju_guided_name_recommendation',
      inputs: ['birth_saju', 'naming'],
      natalSajuSemantics: 'birth_chart_invariant',
      candidateSemantics: 'name_conditioned_interaction',
      natalEvidence: {
        status: natalEvidence.status,
        reasonCodes: [...natalEvidence.reasonCodes],
      },
    },
    pagination: {
      offset,
      requestedLimit,
      returnedCount: items.length,
      ...(input.hasMore === undefined ? {} : { hasMore: input.hasMore }),
      ...(input.totalAvailable === undefined
        ? {}
        : { totalAvailable: input.totalAvailable }),
    },
    items,
  };
}
