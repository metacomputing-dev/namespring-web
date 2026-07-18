import assert from 'node:assert/strict';
import {
  CandidateSearchContractErrorV1,
  buildCandidateSearchResponseV1,
  candidateIdFromNameIdentityV1,
  isCandidateIdV1,
} from '../../src/experience/index.js';
import type { SpringCandidateSummary } from '../../src/types.js';
import { SpringEngine } from '../../src/spring-engine.js';
import {
  DefaultCandidateSummaryAccumulator,
  dedupeCandidateSummariesByHangul,
  orderCandidateSummaries,
} from '../../src/candidate-selection.js';

function summary(overrides: Partial<SpringCandidateSummary> = {}): SpringCandidateSummary {
  return {
    finalScore: 91,
    fullHangul: '최하늘',
    fullHanja: '崔河訥',
    givenHangul: '하늘',
    givenName: [
      { hangul: '하', hanja: '河', meaning: '강 하' },
      { hangul: '늘', hanja: '訥', meaning: '말 더듬을 눌' },
    ],
    popularityRank: 42,
    maleRatio: 0.35,
    nameGender: 'female',
    rank: 1,
    ...overrides,
  };
}

const query = {
  queryId: `candidate_query_v1_${'1'.repeat(32)}`,
  scope: 'engine_session' as const,
  expiresOn: 'engine_close_or_lru_eviction' as const,
  maxBrowsableCandidates: 500,
  truncated: false,
  clientInstruction: 'reuse_query_id_for_every_page' as const,
};

const baseline = summary();
const changedEvaluation = summary({
  finalScore: 67,
  popularityRank: 900,
  maleRatio: 0.8,
  rank: 73,
});

const equivalencePool = Array.from({ length: 400 }, (_, index) => {
  const hangulIndex = (index * 17) % 47;
  const given = String.fromCharCode(0xac00 + hangulIndex);
  return summary({
    fullHangul: `최${given}`,
    givenHangul: given,
    givenName: [{ hangul: given }],
    fullHanja: `崔${String.fromCharCode(0x4e00 + index)}`,
    finalScore: ((index * 29) % 1010) / 10,
    rank: index + 1,
  });
});
const expectedDefaultOrder = dedupeCandidateSummariesByHangul(
  orderCandidateSummaries(equivalencePool),
);
const defaultAccumulator = new DefaultCandidateSummaryAccumulator();
for (const candidate of equivalencePool) defaultAccumulator.add(candidate);
assert.deepEqual(
  defaultAccumulator.finish(),
  expectedDefaultOrder,
  'streaming default retention is exactly equivalent to legacy global sort then Hangul dedupe',
);
assert.ok(defaultAccumulator.retainedCount <= 47,
  'default retention memory follows distinct display names, not every Hanja spelling');
const baselineIdentity = {
  surnameHangul: '최',
  surnameHanja: '崔',
  givenHangul: '하늘',
  givenHanja: '河訥',
};
assert.equal(
  candidateIdFromNameIdentityV1(baselineIdentity),
  candidateIdFromNameIdentityV1({
    surnameHangul: '\u110E\u116C',
    surnameHanja: '崔',
    givenHangul: '\u1112\u1161\u1102\u1173\u11AF',
    givenHanja: '河訥',
  }),
  'canonically equivalent Unicode identities must share an ID',
);
assert.notEqual(
  candidateIdFromNameIdentityV1(baselineIdentity),
  candidateIdFromNameIdentityV1({ ...baselineIdentity, givenHanja: '夏訥' }),
  'same Hangul with a different Hanja identity must not share an ID',
);
assert.notEqual(
  candidateIdFromNameIdentityV1({
    surnameHangul: '남궁', surnameHanja: '南宮', givenHangul: '민', givenHanja: '珉',
  }),
  candidateIdFromNameIdentityV1({
    surnameHangul: '남', surnameHanja: '南', givenHangul: '궁민', givenHanja: '宮珉',
  }),
  'same concatenated text with a different surname boundary must not share an ID',
);

const second = summary({
  fullHangul: '최가온',
  fullHanja: '崔佳溫',
  givenHangul: '가온',
  givenName: [
    { hangul: '가', hanja: '佳', meaning: '아름다울 가' },
    { hangul: '온', hanja: '溫', meaning: '따뜻할 온' },
  ],
  finalScore: 88,
  popularityRank: null,
  maleRatio: null,
  nameGender: 'unknown',
  rank: 2,
});

const response = buildCandidateSearchResponseV1({
  query,
  summaries: [baseline, second],
  offset: 0,
  requestedLimit: 20,
  hasMore: true,
  totalAvailable: 50,
});
const changedEvaluationResponse = buildCandidateSearchResponseV1({
  query,
  summaries: [changedEvaluation],
  offset: 72,
  requestedLimit: 1,
});
assert.equal(
  response.items[0]?.candidateId,
  changedEvaluationResponse.items[0]?.candidateId,
  'candidate ID must be independent from rank, score, and popularity',
);
assert.equal(response.schemaVersion, 'spring-ts.candidate-search.v1');
assert.deepEqual(response.query, query);
assert.deepEqual(response.items.map((item) => item.rank), [1, 2]);
assert.equal(response.ordering.authority, 'spring_engine');
assert.equal(response.ordering.clientInstruction, 'preserve_order_and_rank');
assert.deepEqual(response.evaluation, {
  method: 'saju_guided_name_recommendation',
  inputs: ['birth_saju', 'naming'],
  natalSajuSemantics: 'birth_chart_invariant',
  candidateSemantics: 'name_conditioned_interaction',
  natalEvidence: {
    status: 'unavailable',
    reasonCodes: ['SAJU_ANALYSIS_LIMITED'],
  },
});
assert.equal(response.pagination.returnedCount, 2);
assert.equal(response.pagination.hasMore, true);
assert.equal(response.pagination.totalAvailable, 50);
assert.ok(response.items.every((item) => isCandidateIdV1(item.candidateId)));
assert.equal(
  JSON.stringify(response.items[0]?.popularity),
  '{"rank":42,"maleRatio":0.35,"tendency":"female"}',
  'existing 1-2 syllable popularity bytes must not gain new provenance fields',
);
assert.deepEqual(response.items[0]?.reportInput, {
  candidateId: response.items[0]?.candidateId,
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [
    { hangul: '하', hanja: '河' },
    { hangul: '늘', hanja: '訥' },
  ],
});
assert.equal(
  response.items[0]?.candidateId,
  response.items[0]?.reportInput.candidateId,
  'report continuation must carry the exact selected candidate identity',
);

const pureHangulResponse = buildCandidateSearchResponseV1({
  query,
  summaries: [summary({
    fullHanja: '',
    givenName: [{ hangul: '하', hanja: '' }, { hangul: '늘', hanja: '' }],
  })],
  offset: 0,
  requestedLimit: 20,
});
assert.deepEqual(pureHangulResponse.items[0]?.reportInput, {
  candidateId: pureHangulResponse.items[0]?.candidateId,
  surname: [{ hangul: '최' }],
  givenName: [{ hangul: '하' }, { hangul: '늘' }],
});

// The response owns a canonical continuation snapshot rather than retaining
// mutable score/display metadata from the source list.
(baseline.givenName[0] as { hangul: string }).hangul = '나';
assert.equal(response.items[0]?.reportInput.givenName[0]?.hangul, '하');

assert.throws(
  () => buildCandidateSearchResponseV1({
    query,
    summaries: [summary({ rank: 2 })],
    offset: 0,
    requestedLimit: 20,
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'INVALID_RANK',
  'client-visible order must match contiguous backend ranks',
);

assert.throws(
  () => buildCandidateSearchResponseV1({
    query,
    summaries: [summary(), summary({ rank: 2 })],
    offset: 0,
    requestedLimit: 20,
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'DUPLICATE_CANDIDATE',
  'duplicate canonical candidates must fail closed',
);

assert.throws(
  () => buildCandidateSearchResponseV1({
    query,
    summaries: [summary({ givenHangul: '다른이름' })],
    offset: 0,
    requestedLimit: 20,
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'INVALID_NAME_PAYLOAD',
  'report continuation characters must agree with the display identity',
);

assert.throws(
  () => buildCandidateSearchResponseV1({
    query,
    summaries: [summary({
      fullHangul: 'KAB',
      fullHanja: '',
      givenHangul: 'AB',
      givenName: [{ hangul: 'A' }, { hangul: 'B' }],
    })],
    offset: 0,
    requestedLimit: 20,
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'INVALID_NAME_PAYLOAD',
  'candidate continuation must reject non-Hangul name characters',
);

assert.throws(
  () => buildCandidateSearchResponseV1({
    query,
    summaries: [summary({ fullHanja: '崔夏訥' })],
    offset: 0,
    requestedLimit: 20,
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'INVALID_NAME_PAYLOAD',
  'report continuation Hanja must agree with the resolved identity',
);

assert.throws(
  () => buildCandidateSearchResponseV1({
    query,
    summaries: [summary({
      fullHangul: '최민준서',
      fullHanja: '崔珉俊瑞',
      givenHangul: '민준서',
      givenName: [
        { hangul: '민', hanja: '珉' },
        { hangul: '준', hanja: '俊' },
        { hangul: '서', hanja: '瑞' },
      ],
    })],
    offset: 0,
    requestedLimit: 20,
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'UNSUPPORTED_RECOMMENDATION_NAME_LENGTH',
  'the public recommendation response builder cannot bypass the 1-2 syllable gate',
);

function pureHangulSummary(rank: number): SpringCandidateSummary {
  const given = String.fromCharCode(0xac00 + rank);
  return summary({
    fullHangul: `최${given}`,
    fullHanja: '',
    givenHangul: given,
    givenName: [{ hangul: given }],
    rank,
  });
}

const snapshotEngine = new SpringEngine() as any;
let snapshotBuilds = 0;
snapshotEngine.getNameCandidateSummariesInternal = async () => {
  snapshotBuilds += 1;
  return [pureHangulSummary(1), pureHangulSummary(2), pureHangulSummary(3)];
};
const snapshotRequest = {
  birth: { year: 1986, month: 4, day: 19, gender: 'male' as const },
  surname: [{ hangul: '최' }],
  mode: 'recommend' as const,
};
const lengthGateEngine = new SpringEngine() as any;
let unsupportedLengthBuilds = 0;
lengthGateEngine.getNameCandidateSummariesInternal = async () => {
  unsupportedLengthBuilds += 1;
  return [];
};
for (const givenNameLength of [0, -1, 1.5, 3, 4]) {
  await assert.rejects(
    lengthGateEngine.getCandidateSearch({
      ...snapshotRequest,
      givenNameLength,
      options: { limit: 1 },
    }),
    (error: unknown) => error instanceof CandidateSearchContractErrorV1
      && error.reason === 'UNSUPPORTED_RECOMMENDATION_NAME_LENGTH',
    `automatic ${givenNameLength}-syllable recommendation must fail closed`,
  );
}
await assert.rejects(
  lengthGateEngine.getCandidateSearch({
    ...snapshotRequest,
    givenName: [],
    options: { limit: 1 },
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'UNSUPPORTED_RECOMMENDATION_NAME_LENGTH',
  'an explicitly empty recommendation name must fail closed',
);
await assert.rejects(
  lengthGateEngine.getCandidateSearch({
    ...snapshotRequest,
    givenNameLength: 2,
    givenName: [
      { hangul: '\uAC00' },
      { hangul: '\uB098' },
      { hangul: '\uB2E4' },
    ],
    options: { limit: 1 },
  }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'UNSUPPORTED_RECOMMENDATION_NAME_LENGTH',
  'a longer supplied filter cannot hide behind a shorter declared length',
);
assert.equal(unsupportedLengthBuilds, 0,
  'unsupported recommendation lengths must fail before analysis or candidate generation');
lengthGateEngine.close();

const snapshotPage1 = await snapshotEngine.getCandidateSearch({
  ...snapshotRequest,
  options: { offset: 0, limit: 1 },
});
const snapshotPage2 = await snapshotEngine.getCandidateSearch({
  ...snapshotRequest,
  options: { offset: 1, limit: 1 },
}, { queryId: snapshotPage1.query.queryId });
assert.equal(snapshotBuilds, 1, 'page 2 must not rescore the candidate pool');
assert.deepEqual(snapshotPage2.items.map((item: { rank: number }) => item.rank), [2]);
await assert.rejects(
  snapshotEngine.getCandidateSearch({
    ...snapshotRequest,
    birth: { ...snapshotRequest.birth, day: 20 },
    options: { offset: 1, limit: 1 },
  }, { queryId: snapshotPage1.query.queryId }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'QUERY_ID_MISMATCH',
  'queryId must be bound to the exact analysis request',
);
snapshotEngine.close();
await assert.rejects(
  snapshotEngine.getCandidateSearch({
    ...snapshotRequest,
    options: { offset: 1, limit: 1 },
  }, { queryId: snapshotPage1.query.queryId }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'QUERY_SNAPSHOT_EXPIRED',
  'close must invalidate every local candidate snapshot',
);

const limitedEvidenceEngine = new SpringEngine() as any;
limitedEvidenceEngine.getNameCandidateSummariesInternal = async (
  _request: unknown,
  _requireRecommendation: boolean,
  onSajuReport?: (report: unknown) => void,
) => {
  onSajuReport?.({
    axisStrength: { strength: 'candidate', gyeokguk: 'deferred', yongshin: 'deferred' },
    gyeokguk: { confidence: 0.3 },
    yongshin: {
      element: 'WOOD',
      confidence: 35,
      warnings: [],
      jonggyeokRisk: {
        level: 'HIGH',
        direction: 'PRESSURE',
        strengthIndex: -0.7,
        dominanceRatio: 2.5,
        subtypes: ['cong_weak'],
        maxCandidateScore: 0.8,
        confidenceAttenuated: true,
      },
    },
    yongshinConsensus: { final: { conflictLevel: 'high' } },
  });
  return [pureHangulSummary(1), pureHangulSummary(2)];
};
const limitedEvidencePage1 = await limitedEvidenceEngine.getCandidateSearch({
  ...snapshotRequest,
  options: { offset: 0, limit: 1 },
});
assert.equal(limitedEvidencePage1.evaluation.natalEvidence.status, 'limited');
assert.ok(limitedEvidencePage1.evaluation.natalEvidence.reasonCodes.includes(
  'SAJU_JUDGMENT_LOW_CONFIDENCE',
));
assert.ok(limitedEvidencePage1.evaluation.natalEvidence.reasonCodes.includes(
  'YONGSHIN_JONGGYEOK_RISK',
));
const limitedEvidencePage2 = await limitedEvidenceEngine.getCandidateSearch({
  ...snapshotRequest,
  options: { offset: 1, limit: 1 },
}, { queryId: limitedEvidencePage1.query.queryId });
assert.deepEqual(
  limitedEvidencePage2.evaluation.natalEvidence,
  limitedEvidencePage1.evaluation.natalEvidence,
  'later pages preserve the original natal-evidence posture without recomputation',
);
limitedEvidenceEngine.close();

const lruEngine = new SpringEngine() as any;
lruEngine.getNameCandidateSummariesInternal = async () => [pureHangulSummary(1)];
const lruPages = [];
for (let day = 1; day <= 5; day += 1) {
  lruPages.push(await lruEngine.getCandidateSearch({
    ...snapshotRequest,
    birth: { ...snapshotRequest.birth, day },
    options: { limit: 1 },
  }));
}
await assert.rejects(
  lruEngine.getCandidateSearch({
    ...snapshotRequest,
    birth: { ...snapshotRequest.birth, day: 1 },
    options: { offset: 1, limit: 1 },
  }, { queryId: lruPages[0].query.queryId }),
  (error: unknown) => error instanceof CandidateSearchContractErrorV1
    && error.reason === 'QUERY_SNAPSHOT_EXPIRED',
  'the fifth query evicts the oldest bounded snapshot',
);
lruEngine.close();

const truncatedEngine = new SpringEngine() as any;
let truncatedBuilds = 0;
truncatedEngine.getNameCandidateSummariesInternal = async () => {
  truncatedBuilds += 1;
  return Array.from({ length: 501 }, (_, index) => pureHangulSummary(index + 1));
};
const truncatedPage1 = await truncatedEngine.getCandidateSearch({
  ...snapshotRequest,
  options: { limit: 1 },
});
assert.equal(truncatedPage1.query.truncated, true);
assert.equal(truncatedPage1.query.maxBrowsableCandidates, 500);
const truncatedLastPage = await truncatedEngine.getCandidateSearch({
  ...snapshotRequest,
  options: { offset: 499, limit: 1 },
}, { queryId: truncatedPage1.query.queryId });
assert.equal(truncatedLastPage.items[0]?.rank, 500);
assert.equal(truncatedLastPage.pagination.hasMore, false);
assert.equal(truncatedBuilds, 1);
truncatedEngine.close();

console.log('candidate-search-delivery-v1: PASS');
