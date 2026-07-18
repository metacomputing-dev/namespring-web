import {
  candidateIdFromNameIdentityV1,
  canonicalizeCandidateNameIdentityV1,
} from './candidate-id.js';
import { assertNameCharacterSyntax } from '../name-entry-resolver.js';
import {
  CANDIDATE_ORDERING_POLICY_V1,
  CANDIDATE_QUERY_ID_PATTERN_V1,
  CANDIDATE_SEARCH_SCHEMA_V1,
  CandidateSearchContractErrorV1,
  type CandidateSearchItemV1,
  type CandidateSearchQueryV1,
  type CandidateSearchResponseV1,
} from './types.js';
import type {
  CandidateStrengthProfile,
  NameCharInput,
  NamingScoreVector,
  SpringCandidateSummary,
} from '../types.js';
import type { NatalEvidenceAssessmentV1 } from '../natal-evidence.js';

export const MAX_CANDIDATE_SEARCH_PAGE_SIZE_V1 = 100;

export interface BuildCandidateSearchResponseV1Input {
  /** Already ordered and ranked by SpringEngine.getNameCandidateSummaries(). */
  readonly summaries: readonly SpringCandidateSummary[];
  readonly offset: number;
  readonly requestedLimit: number;
  readonly query: CandidateSearchQueryV1;
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

  return {
    schemaVersion: CANDIDATE_SEARCH_SCHEMA_V1,
    query: { ...query },
    ordering: {
      authority: 'spring_engine',
      source: 'SpringEngine.getNameCandidateSummaries',
      policyVersion: CANDIDATE_ORDERING_POLICY_V1,
      mode: 'recommended',
      clientInstruction: 'preserve_order_and_rank',
      rankScope: 'query',
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
