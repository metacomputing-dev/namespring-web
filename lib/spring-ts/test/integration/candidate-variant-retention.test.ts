import assert from 'node:assert/strict';
import {
  DefaultCandidateSummaryAccumulator,
  retainCandidateSummaryVariantsByHangul,
} from '../../src/candidate-selection.js';
import type { NamingScoreVector, SpringCandidateSummary } from '../../src/types.js';

function vector(
  risk: number,
  phonetic: number,
  meaningConfidence: number | null = 100,
): NamingScoreVector {
  return {
    legal: 100,
    sajuFit: 80,
    yongshinFit: 70,
    elementBalance: 75,
    hanjaMeaning: meaningConfidence,
    phonetic,
    eraFit: 80,
    familyFit: phonetic,
    risk,
  };
}

function candidate(
  hanja: string,
  finalScore: number,
  scoreVector?: NamingScoreVector,
  popularityRank: number | null = null,
  givenHangul = '민준',
): SpringCandidateSummary {
  const hanjas = Array.from(hanja);
  const hanguls = Array.from(givenHangul);
  return {
    finalScore,
    ...(scoreVector ? { scoreVector } : {}),
    fullHangul: `최${givenHangul}`,
    fullHanja: `崔${hanja}`,
    givenHangul,
    givenName: [
      { hangul: hanguls[0], hanja: hanjas[0] },
      { hangul: hanguls[1], hanja: hanjas[1] },
    ],
    popularityRank,
    maleRatio: null,
    nameGender: 'unknown',
    rank: 0,
  };
}

const accumulator = new DefaultCandidateSummaryAccumulator(3);
accumulator.add(candidate('旻俊', 90, vector(10, 90)));
accumulator.add(candidate('珉準', 89, vector(10, 90)));
accumulator.add(candidate('敏晙', 88, vector(10, 90)));
accumulator.add(candidate('民埈', 87, vector(10, 90)));
assert.deepEqual(
  accumulator.finish().map((item) => item.fullHanja),
  ['崔旻俊', '崔珉準', '崔敏晙'],
  'a Hangul reading keeps a bounded top-three set of distinct Hanja identities',
);

const replacement = new DefaultCandidateSummaryAccumulator(3);
replacement.add(candidate('旻俊', 80, vector(20, 80)));
replacement.add(candidate('旻俊', 91, vector(5, 95)));
assert.deepEqual(
  replacement.finish().map((item) => [item.fullHanja, item.finalScore]),
  [['崔旻俊', 91]],
  'an exact Hanja duplicate occupies one slot and retains its stronger evaluation',
);

const tieBreak = new DefaultCandidateSummaryAccumulator(3, true);
tieBreak.add(candidate('旻俊', 90, vector(20, 80)));
tieBreak.add(candidate('珉準', 90, vector(5, 95)));
assert.deepEqual(
  tieBreak.finish().map((item) => item.fullHanja),
  ['崔珉準', '崔旻俊'],
  'equal final scores use lower risk and stronger phonetic evidence before stable insertion order',
);

const presentationOrder = new DefaultCandidateSummaryAccumulator(3, true, 4);
presentationOrder.add(candidate('珽理', 78.9, vector(4.5, 95.5), 7214, '정리'));
presentationOrder.add(candidate('右乂', 77.9, vector(0, 100), 6371, '우예'));
presentationOrder.add(candidate('瓚該', 77.4, vector(8, 94.4), 4932, '찬해'));
presentationOrder.add(candidate('瀣鐵', 75.7, vector(0, 100), 3527, '해철'));
presentationOrder.add(candidate('該瓚', 75.6, vector(0, 100), 581, '해찬'));
presentationOrder.add(candidate('叡眞', 74.8, vector(0, 100), 1, '예진'));
assert.deepEqual(
  presentationOrder.finish().map((item) => item.givenHangul),
  ['해찬', '해철', '우예', '정리', '찬해', '예진'],
  'candidate-search presentation order uses evidence only inside the bounded raw-score window',
);

const practicalOrder = new DefaultCandidateSummaryAccumulator(3, true, 4);
practicalOrder.add(candidate('殷瑀', 80, vector(3, 98.8, 100), 16, '은우'));
practicalOrder.add(candidate('鐥鐵', 79, vector(3, 100, 100), 4728, '선철'));
practicalOrder.add(candidate('不了', 78, vector(1, 100, 35), 1, '부요'));
assert.deepEqual(
  practicalOrder.finish().map((item) => item.givenHangul),
  ['은우', '선철', '부요'],
  'soft-deferred meanings rank after reviewed-safe candidates, while official '
    + 'usage evidence resolves practical-name ties before small phonetic differences',
);

const missingEvidenceCandidates = [
  candidate('旻俊', 80, vector(0, 80, null), 2, '민준'),
  candidate('河潤', 80, vector(100, 80, 100), 3, '하윤'),
  candidate('瑞娥', 80, vector(0, 80, 50), 1, '서아'),
];
const permutations = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
for (const permutation of permutations) {
  const totalOrder = new DefaultCandidateSummaryAccumulator(3, true, 4);
  for (const index of permutation) totalOrder.add(missingEvidenceCandidates[index]!);
  assert.deepEqual(
    totalOrder.finish().map((item) => item.givenHangul),
    ['하윤', '서아', '민준'],
    'candidate-local missing-evidence keys keep presentation ordering '
      + 'transitive and independent from insertion order',
  );
}

const legacyStableOrder = new DefaultCandidateSummaryAccumulator(3);
legacyStableOrder.add(candidate('珽理', 90, vector(20, 80), 5000, '정리'));
legacyStableOrder.add(candidate('右乂', 90, vector(0, 100), 1, '우예'));
assert.deepEqual(
  legacyStableOrder.finish().map((item) => item.givenHangul),
  ['정리', '우예'],
  'legacy accumulation ignores surfaced vectors unless presentation ordering is opted in',
);

const ordered = retainCandidateSummaryVariantsByHangul([
  candidate('旻俊', 100),
  candidate('珉準', 99),
  candidate('旻俊', 98),
  candidate('敏晙', 97),
  candidate('民埈', 96),
], 3);
assert.deepEqual(
  ordered.map((item) => item.fullHanja),
  ['崔旻俊', '崔珉準', '崔敏晙'],
  'Pareto/output retention preserves incoming order, removes exact Hanja duplicates, and caps variants',
);

console.log('Candidate Hanja variant retention: PASS');
