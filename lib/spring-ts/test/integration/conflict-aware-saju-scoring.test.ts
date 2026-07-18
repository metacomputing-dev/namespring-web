/**
 * test/integration/conflict-aware-saju-scoring.test.ts
 *
 * Verifies PR-6.3 conflict-aware saju-name scoring and report evidence with
 * synthetic fixtures only. No DB or top-level namespring data is read.
 *
 * Run: npm run test:conflict-aware-scoring
 */
import { springEvaluateName } from '../../src/spring-evaluator.js';
import { SajuCalculator, computeSajuNameScore } from '../../src/saju-calculator.js';
import type {
  SajuOutputSummary,
  SpringReport,
  YongshinConsensusScoreboard,
} from '../../src/index.js';
import { buildNameCompatibilityCard } from '../../src/report/cards/name-compatibility-card.js';
import type { ElementKey } from '../../src/core/scoring.js';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

const emptyDist: Record<ElementKey, number> = {
  Wood: 0,
  Fire: 0,
  Earth: 0,
  Metal: 0,
  Water: 0,
};

function dist(overrides: Partial<Record<ElementKey, number>>): Record<ElementKey, number> {
  return { ...emptyDist, ...overrides };
}

function consensusAxis(element: string | null, score: number) {
  return {
    element,
    score,
    scores: {
      WOOD: element === 'WOOD' ? score : 0.1,
      FIRE: element === 'FIRE' ? score : 0.1,
      EARTH: element === 'EARTH' ? score : 0.1,
      METAL: element === 'METAL' ? score : 0.1,
      WATER: element === 'WATER' ? score : 0.1,
    },
    evidence: [`axis ${element ?? 'none'}`],
  };
}

const highConflictConsensus: YongshinConsensusScoreboard = {
  eokbu: consensusAxis('WOOD', 0.82),
  johu: consensusAxis('FIRE', 0.75),
  gyeokguk: consensusAxis('WOOD', 0.7),
  tonggwan: consensusAxis('EARTH', 0.68),
  byeongyak: consensusAxis('WATER', 0.64),
  siksangFlow: consensusAxis('FIRE', 0.62),
  final: {
    element: 'WOOD',
    confidence: 0.58,
    // Raw producer units are intentionally much larger than the normalized
    // selection gap. Consumers must not compare this field to ratio thresholds.
    topMargin: 2.5,
    normalizedTopMargin: 0.02,
    methodDisagreementRatio: 0.666667,
    conflictLevel: 'high',
    competingElements: ['FIRE', 'EARTH'],
    evidence: ['synthetic high-conflict consensus'],
  },
};

const output: SajuOutputSummary = {
  yongshin: {
    finalYongshin: 'WOOD',
    finalHeesin: 'WATER',
    gisin: 'METAL',
    gusin: 'EARTH',
    finalConfidence: 0.95,
    recommendations: [],
    consensus: highConflictConsensus,
  },
  yongshinConsensus: highConflictConsensus,
};

function score(root: Record<ElementKey, number>, mode?: 'classical_blend' | 'consensus_aware') {
  return computeSajuNameScore(emptyDist, root, output, null, mode ? { yongshinMode: mode } : undefined);
}

console.log('PR-6.3 conflict-aware saju-name scoring\n');

const aggressiveRoot = dist({ Wood: 2 });
const balancedRoot = dist({ Wood: 1, Water: 1 });
const competitorRoot = dist({ Fire: 2 });

const defaultScore = score(aggressiveRoot);
const classicalAggressive = score(aggressiveRoot, 'classical_blend');
const guardedAggressive = score(aggressiveRoot, 'consensus_aware');
const classicalBalanced = score(balancedRoot, 'classical_blend');
const guardedBalanced = score(balancedRoot, 'consensus_aware');
const classicalCompetitor = score(competitorRoot, 'classical_blend');
const guardedCompetitor = score(competitorRoot, 'consensus_aware');

check('default yongshin scoring remains classical blend',
  defaultScore.score === classicalAggressive.score &&
    defaultScore.breakdown.yongshin === classicalAggressive.breakdown.yongshin,
  `default=${defaultScore.breakdown.yongshin}, classical=${classicalAggressive.breakdown.yongshin}`);

check('high conflict reduces aggressive yongshin reinforcement',
  guardedAggressive.breakdown.yongshin < classicalAggressive.breakdown.yongshin,
  `guarded=${guardedAggressive.breakdown.yongshin}, classical=${classicalAggressive.breakdown.yongshin}`);

const aggressiveDelta = classicalAggressive.breakdown.yongshin - guardedAggressive.breakdown.yongshin;
const balancedDelta = classicalBalanced.breakdown.yongshin - guardedBalanced.breakdown.yongshin;
check('safe balance is penalized less than aggressive reinforcement',
  aggressiveDelta > balancedDelta + 5,
  `aggressiveDelta=${aggressiveDelta.toFixed(3)}, balancedDelta=${balancedDelta.toFixed(3)}`);

check('competing consensus elements are not rewarded',
  guardedCompetitor.breakdown.yongshin <= classicalCompetitor.breakdown.yongshin,
  `guarded=${guardedCompetitor.breakdown.yongshin}, classical=${classicalCompetitor.breakdown.yongshin}`);

check('aggressive reinforcement exposes aggressive safety profile',
  guardedAggressive.breakdown.safetyProfile?.posture === 'aggressive' &&
    guardedAggressive.breakdown.safetyProfile?.strategy === 'aggressive_reinforcement',
  JSON.stringify(guardedAggressive.breakdown.safetyProfile));

check('normalized margin drives uncertainty independently of raw producer scale',
  guardedAggressive.breakdown.yongshinConsensus?.topMargin === 2.5 &&
    guardedAggressive.breakdown.yongshinConsensus?.normalizedTopMargin === 0.02 &&
    (guardedAggressive.breakdown.safetyProfile?.riskScore ?? 0) >= 60,
  JSON.stringify({
    consensus: guardedAggressive.breakdown.yongshinConsensus,
    riskScore: guardedAggressive.breakdown.safetyProfile?.riskScore,
  }));

check('balanced root exposes safe_balance strategy',
  guardedBalanced.breakdown.safetyProfile?.strategy === 'safe_balance',
  JSON.stringify(guardedBalanced.breakdown.safetyProfile));

const surname = [{ hangul: '\uCD5C', hanja: 'C', resource_element: 'Metal' }];
const givenName = [{ hangul: '\uAC00', hanja: 'G', resource_element: '' }];
const fallbackCalc = new SajuCalculator(
  surname as any,
  givenName as any,
  emptyDist,
  output,
  { elementStrategy: 'safeFallback', scoringOverrides: { yongshinMode: 'consensus_aware' } },
);
springEvaluateName([fallbackCalc], {
  surnameLength: 1,
  givenLength: 1,
  luckyMap: {} as any,
  insights: {},
});
const fallbackAnalysis = fallbackCalc.getAnalysis().data;
check('safeFallback surfaces conservative element provenance',
  fallbackAnalysis.elementStrategyEvidence?.fallbackCount === 1 &&
    fallbackAnalysis.elementStrategyEvidence?.decisions[1]?.source === 'hangulPhonetic' &&
    fallbackAnalysis.elementStrategyEvidence?.aggressiveCount === 0,
  JSON.stringify(fallbackAnalysis.elementStrategyEvidence));

const report = {
  finalScore: 88,
  scoreVector: {
    legal: 90,
    sajuFit: guardedAggressive.score,
    yongshinFit: guardedAggressive.breakdown.yongshin,
    elementBalance: guardedAggressive.breakdown.balance,
    hanjaMeaning: 80,
    phonetic: 75,
    eraFit: 70,
    familyFit: 78,
    risk: 72,
  },
  namingReport: {
    totalScore: 82,
    scores: { hangul: 80, hanja: 82, fourFrame: 84 },
  },
  sajuCompatibility: {
    yongshinElement: 'Wood',
    heeshinElement: 'Water',
    gishinElement: 'Metal',
    nameElements: ['Wood', 'Wood'],
    yongshinMatchCount: 2,
    gishinMatchCount: 0,
    dayMasterSupportScore: guardedAggressive.breakdown.strength,
    affinityScore: guardedAggressive.score,
    yongshinConsensusConflictLevel: 'high',
    yongshinConsensusCompetingElements: ['FIRE', 'EARTH'],
    safetyProfile: guardedAggressive.breakdown.safetyProfile,
    elementStrategyEvidence: fallbackAnalysis.elementStrategyEvidence,
  },
  sajuReport: {},
  combinedDistribution: dist({ Wood: 2 }),
  popularityRank: null,
  maleRatio: null,
  nameGender: 'unknown',
  rank: 0,
} as unknown as SpringReport;

const card = buildNameCompatibilityCard(report);
check('report card forwards safety profile',
  card?.safetyProfile?.posture === 'aggressive' &&
    card.evidence?.some((row) => row.axis === 'candidateSafetyProfile') === true,
  JSON.stringify(card?.safetyProfile));

check('report card forwards element strategy evidence',
  card?.elementStrategyEvidence?.fallbackCount === 1 &&
    card.evidence?.some((row) => row.axis === 'nameElementStrategy') === true,
  JSON.stringify(card?.elementStrategyEvidence));

check('report card safety evidence includes competing elements',
  card?.evidence?.some((row) =>
    row.axis === 'candidateSafetyProfile' &&
    row.supportingFeatures.some((feature) => feature.includes('충돌 후보 오행'))) === true);

console.log(`\nConflict-aware scoring check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
