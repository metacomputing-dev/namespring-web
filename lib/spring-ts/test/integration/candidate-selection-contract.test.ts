/**
 * Characterizes the full-report candidate selection boundary without DBs.
 *
 * Run: npm run test:candidate-selection-contract
 */
import assert from 'node:assert/strict';
import engineConfig from '../../config/engine.json';
import type {
  CandidateStrengthProfile,
  CandidateStrengthProfileId,
  NamingScoreVector,
  SpringReport,
} from '../../src/types.js';
import {
  describeCandidateName,
  orderCandidateSelectionProjections,
  orderSpringReports,
  sliceCandidatePage,
} from '../../src/candidate-selection.js';

function profile(
  id: CandidateStrengthProfileId,
  paretoFrontier: boolean = false,
): CandidateStrengthProfile {
  return {
    id,
    label: id,
    primaryAxis: 'balanced',
    reasons: [id],
    paretoFrontier,
  };
}

function vector(score: number): NamingScoreVector {
  return {
    legal: score,
    sajuFit: score,
    yongshinFit: score,
    elementBalance: score,
    hanjaMeaning: score,
    phonetic: score,
    eraFit: score,
    familyFit: score,
    risk: 100 - score,
  };
}

interface ReportFixture {
  readonly marker: number;
  readonly givenHangul: string;
  readonly givenHanja: string;
  readonly finalScore: number;
  readonly scoreVector?: NamingScoreVector;
  readonly outerProfile?: CandidateStrengthProfile;
  readonly namingProfile?: CandidateStrengthProfile;
}

function report(fixture: ReportFixture): SpringReport {
  const hanjas = Array.from(fixture.givenHanja);
  const givenName = Array.from(fixture.givenHangul).map((hangul, index) => ({
    hangul,
    hanja: hanjas[index] ?? '',
    meaning: '',
    strokes: 0,
    element: '',
  }));

  return {
    finalScore: fixture.finalScore,
    ...(fixture.scoreVector ? { scoreVector: fixture.scoreVector } : {}),
    ...(fixture.outerProfile ? { strengthProfile: fixture.outerProfile } : {}),
    popularityRank: fixture.marker,
    maleRatio: null,
    nameGender: 'unknown',
    namingReport: {
      name: {
        surname: [],
        givenName,
        fullHangul: `최${fixture.givenHangul}`,
        fullHanja: `崔${fixture.givenHanja}`,
      },
      totalScore: fixture.finalScore,
      scores: { hangul: 0, hanja: 0, fourFrame: 0 },
      ...(fixture.scoreVector ? { scoreVector: fixture.scoreVector } : {}),
      ...(fixture.namingProfile ? { strengthProfile: fixture.namingProfile } : {}),
      analysis: {} as SpringReport['namingReport']['analysis'],
      interpretation: '',
    },
    sajuReport: {} as SpringReport['sajuReport'],
    sajuCompatibility: {} as SpringReport['sajuCompatibility'],
    combinedDistribution: {} as SpringReport['combinedDistribution'],
    rank: 0,
  };
}

function selectionProjection(source: SpringReport) {
  const diversity = describeCandidateName(
    source.namingReport.name.givenName.map((char) => ({
      hangul: char.hangul,
      hanja: char.hanja,
    })),
  );
  return {
    source,
    score: source.finalScore,
    ...(source.scoreVector ? { vector: source.scoreVector } : {}),
    ...(source.strengthProfile ? { profile: source.strengthProfile } : {}),
    ...diversity,
  };
}

const defaultReports = [
  report({
    marker: 1,
    givenHangul: '민준',
    givenHanja: '旻俊',
    finalScore: 90,
    outerProfile: profile('saju_reinforcement', true),
    namingProfile: profile('legal_meaning', true),
  }),
  report({
    marker: 2,
    givenHangul: '민준',
    givenHanja: '珉準',
    finalScore: 90,
    outerProfile: profile('phonetic_stability'),
    namingProfile: profile('era_balance'),
  }),
  report({
    marker: 3,
    givenHangul: '민준',
    givenHanja: '旻俊',
    finalScore: 90,
    outerProfile: profile('balanced'),
    namingProfile: profile('risk_managed'),
  }),
  report({
    marker: 4,
    givenHangul: '서윤',
    givenHanja: '瑞潤',
    finalScore: 80,
    outerProfile: profile('legal_meaning'),
    namingProfile: profile('saju_reinforcement'),
  }),
];

const projectedOrder = orderCandidateSelectionProjections(
  defaultReports.map(selectionProjection),
);
const defaultOrder = orderSpringReports(defaultReports);

assert.deepEqual(
  projectedOrder.map(({ source, rank }) => [source.popularityRank, rank]),
  [[1, 1], [2, 2], [3, 3], [4, 4]],
  'projection ordering must preserve same-Hangul variants, exact duplicates, and tie ordinals',
);
assert.deepEqual(
  defaultOrder.map(({ popularityRank, rank }) => [popularityRank, rank]),
  [[1, 1], [2, 2], [3, 3], [4, 4]],
  'full-report ordering must match the lightweight projection contract',
);
assert.equal(
  defaultOrder[0]?.namingReport,
  defaultReports[0]?.namingReport,
  'default ordering must not clone or rewrite the nested report',
);
assert.equal(defaultOrder[0]?.strengthProfile?.paretoFrontier, true);
assert.equal(defaultOrder[0]?.namingReport.strengthProfile?.paretoFrontier, true);

const repeatedReference = defaultReports[0]!;
const repeatedReferenceOrder = orderCandidateSelectionProjections([
  selectionProjection(repeatedReference),
  selectionProjection(repeatedReference),
]);
assert.equal(repeatedReferenceOrder.length, 2);
assert.equal(repeatedReferenceOrder[0]?.source, repeatedReference);
assert.equal(repeatedReferenceOrder[1]?.source, repeatedReference);
assert.deepEqual(repeatedReferenceOrder.map(({ rank }) => rank), [1, 2]);

const page = sliceCandidatePage(defaultOrder, 2, 2);
assert.deepEqual(
  page.map(({ popularityRank, rank }) => [popularityRank, rank]),
  [[3, 3], [4, 4]],
  'page slicing must preserve globally assigned ranks',
);

const dominant = report({
  marker: 10,
  givenHangul: '서윤',
  givenHanja: '瑞潤',
  finalScore: 90,
  scoreVector: vector(90),
  outerProfile: profile('saju_reinforcement'),
  namingProfile: profile('legal_meaning'),
});
const dominated = report({
  marker: 11,
  givenHangul: '하린',
  givenHanja: '夏潾',
  finalScore: 89,
  scoreVector: vector(70),
  outerProfile: profile('phonetic_stability'),
  namingProfile: profile('era_balance'),
});
const paretoOrder = orderSpringReports(
  [dominant, dominated],
  { precisionConfig: { paretoFrontierCandidates: true } },
  { paretoPoolLimit: 2 },
);

assert.equal(paretoOrder[0]?.strengthProfile?.id, 'saju_reinforcement');
assert.equal(paretoOrder[0]?.namingReport.strengthProfile?.id, 'legal_meaning');
assert.equal(paretoOrder[0]?.strengthProfile?.paretoFrontier, true);
assert.equal(paretoOrder[0]?.namingReport.strengthProfile?.paretoFrontier, true);
assert.equal(paretoOrder[1]?.strengthProfile?.paretoFrontier, false);
assert.equal(paretoOrder[1]?.namingReport.strengthProfile?.paretoFrontier, false);
assert.equal(dominant.strengthProfile?.paretoFrontier, false);
assert.equal(dominant.namingReport.strengthProfile?.paretoFrontier, false);

const productionPoolLimit = engineConfig.candidateSelection.paretoPoolLimit;
assert.ok(Number.isInteger(productionPoolLimit) && productionPoolLimit >= 2);
const leadingReports = Array.from({ length: productionPoolLimit - 2 }, (_, index) => report({
  marker: index + 1,
  givenHangul: '가나',
  givenHanja: '',
  finalScore: 10_000 - index * 10,
  outerProfile: profile('balanced'),
  namingProfile: profile('balanced'),
}));
const boundaryReports = Array.from({ length: 4 }, (_, index) => report({
  marker: 10_000 + index,
  givenHangul: '가나',
  givenHanja: '',
  finalScore: 0,
  scoreVector: vector([90, 70, 95, 50][index]!),
  outerProfile: profile('balanced'),
  namingProfile: profile('balanced'),
}));
const boundedOrder = orderSpringReports(
  [...leadingReports, ...boundaryReports],
  { precisionConfig: { paretoFrontierCandidates: true } },
  { paretoPoolLimit: productionPoolLimit },
);
const overflow = boundedOrder.slice(-2);
const insideFrontier = boundedOrder.find(({ popularityRank }) => popularityRank === 10_000);
const insideDominated = boundedOrder.find(({ popularityRank }) => popularityRank === 10_001);

assert.equal(insideFrontier?.strengthProfile?.paretoFrontier, true);
assert.equal(insideFrontier?.namingReport.strengthProfile?.paretoFrontier, true);
assert.equal(insideDominated?.strengthProfile?.paretoFrontier, false);
assert.equal(insideDominated?.namingReport.strengthProfile?.paretoFrontier, false);
assert.deepEqual(
  overflow.map(({ popularityRank, rank }) => [popularityRank, rank]),
  [
    [10_002, productionPoolLimit + 1],
    [10_003, productionPoolLimit + 2],
  ],
  'equal-score rows outside the production Pareto pool must remain stable overflow',
);
assert.ok(overflow.every((item) =>
  item.strengthProfile?.paretoFrontier === false
  && item.namingReport.strengthProfile?.paretoFrontier === false));

console.log(
  `Candidate selection contract: PASS (production Pareto pool ${productionPoolLimit})`,
);
