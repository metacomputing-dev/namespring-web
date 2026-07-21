import { buildSajuContext } from '../../src/saju/context-builder.js';
import {
  clampPoints,
  clampRatio,
  pointsToRatio,
} from '../../src/saju/confidence-units.js';
import { analyzeSajuSafe } from '../../src/saju-adapter.js';

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}`);
    return;
  }
  fail += 1;
  console.error(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
}

function equals(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= Number.EPSILON * 4;
}

function isRatio(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1;
}

function isIntegerPoints(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= 100;
}

console.log('Saju confidence unit contracts\n');

const boundaries = [
  { input: 0, points: 0, ratioFromPoints: 0, clampedRatio: 0 },
  { input: 1, points: 1, ratioFromPoints: 0.01, clampedRatio: 1 },
  { input: 1.0001, points: 1.0001, ratioFromPoints: 0.010001, clampedRatio: 1 },
  { input: 100, points: 100, ratioFromPoints: 1, clampedRatio: 1 },
] as const;

for (const boundary of boundaries) {
  check(`clampPoints preserves ${boundary.input} as points`,
    equals(clampPoints(boundary.input), boundary.points));
  check(`pointsToRatio converts ${boundary.input} points explicitly`,
    equals(pointsToRatio(boundary.input), boundary.ratioFromPoints),
    `actual=${pointsToRatio(boundary.input)}`);
  check(`clampRatio treats ${boundary.input} as an upstream ratio`,
    equals(clampRatio(boundary.input), boundary.clampedRatio),
    `actual=${clampRatio(boundary.input)}`);
}

for (const invalid of [
  '1',
  [1],
  { valueOf: () => 1 },
] as const) {
  check(`clampPoints rejects non-number ${JSON.stringify(invalid)}`,
    clampPoints(invalid) === 0);
  check(`pointsToRatio rejects non-number ${JSON.stringify(invalid)}`,
    pointsToRatio(invalid) === 0);
  check(`clampRatio rejects non-number ${JSON.stringify(invalid)}`,
    clampRatio(invalid) === 0);
}

const analyzed = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male',
});
const actualConsensus = analyzed.summary.yongshinConsensus
  ?? analyzed.summary.yongshin.consensus;
const actualConsensusRatios = actualConsensus
  ? [
      actualConsensus.final.confidence,
      actualConsensus.final.normalizedTopMargin,
      actualConsensus.final.methodDisagreementRatio,
      ...[
        actualConsensus.eokbu,
        actualConsensus.johu,
        actualConsensus.gyeokguk,
        actualConsensus.tonggwan,
        actualConsensus.byeongyak,
        actualConsensus.siksangFlow,
      ].flatMap((axis) => [axis.score, ...Object.values(axis.scores)]),
    ]
  : [];
const actualGyeokgukRatios = [
  analyzed.summary.gyeokguk.confidence,
  ...(analyzed.summary.gyeokguk.candidates ?? [])
    .flatMap((candidate) => [candidate.score, candidate.confidence]),
];

check('analyzeSajuSafe exposes public yongshin confidence as integer points',
  isIntegerPoints(analyzed.summary.yongshin.confidence)
    && analyzed.summary.yongshin.confidence > 1,
  `actual=${analyzed.summary.yongshin.confidence}`);
check('analyzeSajuSafe exposes recommendation confidence as integer points',
  analyzed.summary.yongshin.recommendations.length > 0
    && analyzed.summary.yongshin.recommendations.every(
      (entry) => isIntegerPoints(entry.confidence),
    )
    && analyzed.summary.yongshin.recommendations.some(
      (entry) => entry.confidence > 1,
    ),
  `actual=${JSON.stringify(analyzed.summary.yongshin.recommendations.map((entry) => entry.confidence))}`);
check('analyzeSajuSafe keeps consensus diagnostics and scores as ratios',
  actualConsensusRatios.length > 0
    && actualConsensusRatios.every(isRatio),
  `actual=${JSON.stringify(actualConsensusRatios)}`);
check('analyzeSajuSafe keeps raw consensus top margin as a finite score-unit delta',
  actualConsensus != null
    && Number.isFinite(actualConsensus.final.topMargin)
    && actualConsensus.final.topMargin >= 0,
  `actual=${actualConsensus?.final.topMargin}`);
check('analyzeSajuSafe keeps gyeokguk confidence and candidate scores as ratios',
  actualGyeokgukRatios.every(isRatio),
  `actual=${JSON.stringify(actualGyeokgukRatios)}`);

const recommendation = analyzed.summary.yongshin.recommendations[0];
for (const boundary of boundaries) {
  const summary = {
    ...analyzed.summary,
    yongshin: {
      ...analyzed.summary.yongshin,
      confidence: boundary.input,
      recommendations: recommendation
        ? [{ ...recommendation, confidence: boundary.input }]
        : [],
    },
  };
  const context = buildSajuContext(summary).output;

  check(`SajuSummary yongshin ${boundary.input} points crosses as a ratio`,
    equals(context?.yongshin?.finalConfidence ?? Number.NaN, boundary.ratioFromPoints),
    `actual=${context?.yongshin?.finalConfidence}`);
  check(`SajuSummary recommendation ${boundary.input} points crosses as a ratio`,
    recommendation == null || equals(
      context?.yongshin?.recommendations[0]?.confidence ?? Number.NaN,
      boundary.ratioFromPoints,
    ),
    `actual=${context?.yongshin?.recommendations[0]?.confidence}`);
}

console.log(`\nSaju confidence contracts: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
