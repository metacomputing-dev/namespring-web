import assert from 'node:assert/strict';
import test from 'node:test';
import type { NamingReport, NamingScoreVector, SajuCompatibility, SajuNameSourceEvidence } from '../../src/types.js';
import {
  NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION,
  NamingEvidenceContractError,
  buildNamingEvidencePlan,
  buildNamingEvidenceReport,
  type NamingEvidenceCatalog,
  type NamingEvidenceReportInput,
} from '../../src/report/naming-evidence/index.js';
import { classifyHigherIsBetterScoreBand } from '../../src/naming-score-axis-policy.js';

function scoreVector(overrides: Partial<NamingScoreVector> = {}): NamingScoreVector {
  return {
    legal: 90,
    sajuFit: 72,
    yongshinFit: 84,
    elementBalance: 58,
    hanjaMeaning: 75,
    phonetic: 82,
    eraFit: 70,
    familyFit: 68,
    risk: 20,
    ...overrides,
  };
}

function namingReport(vector = scoreVector()): NamingReport {
  return {
    name: {
      surname: [],
      givenName: [],
      fullHangul: '김하늘',
      fullHanja: '金河訥',
    },
    totalScore: 74,
    scores: { hangul: 88, hanja: 69, fourFrame: 55 },
    scoreVector: vector,
    analysis: {
      hangul: { blocks: [], elementScore: 91, polarityScore: 84 },
      hanja: {
        blocks: [{
          hanja: '河',
          hangul: '하',
          strokes: 8,
          resourceElement: 'Water',
          strokeElement: 'Metal',
          polarity: 'Yin',
        }],
        elementScore: 72,
        polarityScore: 66,
      },
      fourFrame: { frames: [], elementScore: 51, luckScore: 55 },
    },
    interpretation: '',
  };
}

function sourceEvidence(): SajuNameSourceEvidence {
  return {
    policyVersion: 'saju-name-score/v1',
    appliedWeights: { balance: 0.6, yongshin: 0.23, strength: 0.12, tenGod: 0.05 },
    componentScores: { balance: 85, yongshin: 68, strength: 8, tenGod: 50 },
    weightedContributions: { balance: 51, yongshin: 15.64, strength: 0.96, tenGod: 2.5 },
    decisionImpacts: { balance: 42, yongshin: 8, strength: 10, tenGod: 0 },
    balance: {
      direction: 'supports',
      nameDistribution: { Wood: 0, Fire: 0, Earth: 0, Metal: 1, Water: 2 },
      combinedDistribution: { Wood: 2, Fire: 1, Earth: 1, Metal: 2, Water: 2 },
      filledDeficientElements: ['Water'],
      reinforcedExcessiveElements: [],
    },
    yongshin: {
      direction: 'supports',
      elements: { yongshin: 'Water', heesin: 'Metal', gisin: 'Fire', gusin: 'Earth' },
      matches: { yongshin: 2, heesin: 1, gisin: 0, gusin: 0 },
      confidence: 0.9,
    },
    strength: {
      direction: 'limits', alignedCount: 1, opposedCount: 2,
      alignedElements: ['Metal'], opposedElements: ['Water'],
    },
    tenGod: {
      direction: 'mixed', supportiveElements: ['Metal'], limitingElements: ['Water'],
    },
    deficiency: { matchedElements: ['Water'], bonus: 5 },
    penalties: { gisin: 0, gusin: 0, gyeokguk: 0, total: 0 },
    gyeokgukProtection: { applicable: false, broken: false },
  };
}

function compatibility(evidence: SajuNameSourceEvidence | null = sourceEvidence()): SajuCompatibility {
  return {
    yongshinElement: 'Water', heeshinElement: 'Metal', gishinElement: 'Fire',
    nameElements: ['Metal', 'Water', 'Water'], yongshinMatchCount: 2, gishinMatchCount: 0,
    dayMasterSupportScore: 40, affinityScore: 72,
    ...(evidence ? { sourceEvidence: evidence } : {}),
  };
}

function input(vector = scoreVector(), evidence: SajuNameSourceEvidence | null = sourceEvidence()): NamingEvidenceReportInput {
  return {
    springReport: { scoreVector: vector, namingReport: namingReport(vector), sajuCompatibility: compatibility(evidence) },
    sajuAxes: {
      dayMasterElement: 'WOOD',
      strength: 'weak',
      yongshinElement: 'WATER',
      gyeokgukFamily: 'inseong',
    },
  };
}

test('uses the shared four-band boundaries', () => {
  assert.equal(classifyHigherIsBetterScoreBand(80), 'excellent');
  assert.equal(classifyHigherIsBetterScoreBand(65), 'good');
  assert.equal(classifyHigherIsBetterScoreBand(46), 'mixed');
  assert.equal(classifyHigherIsBetterScoreBand(45), 'caution');
  assert.equal(classifyHigherIsBetterScoreBand(null), null);
});

test('plans section 2 from engine facts without generated text', () => {
  const plan = buildNamingEvidencePlan(input());
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.sections[0].facts), true);
  assert.equal(plan.sections.length, 3);

  const saju = plan.sections[0];
  assert.equal(saju.verdict, null);
  assert.equal(saju.conclusionTone, 'mostlyPositive');
  assert.deepEqual(saju.fragments.map(({ key }) => key), [
    'saju-axis/WOOD/weak/WATER/inseong',
    'source/balance/improves',
    'source/strength/opposesNeededDirection',
    'source/yongshin/yongshin',
    'conclusion/sajuFit/mostlyPositive',
  ]);

  const structure = plan.sections[1];
  assert.equal(structure.verdict, 'good');
  assert.deepEqual(structure.fragments.map(({ key }) => key), [
    'score/namingStructure/good',
    'score/fourFrameElement/mixed',
    'score/hangulStructure/excellent',
  ]);

  assert.equal(plan.sections[2].fragments[0].key, 'pronunciation/excellent/good');
});

test('omits unavailable source evidence and marks an unavailable pronunciation section', () => {
  const vector = scoreVector({ sajuFit: 79, yongshinFit: null, elementBalance: null, phonetic: null, familyFit: null });
  const plan = buildNamingEvidencePlan(input(vector, null));
  assert.deepEqual(plan.sections[0].fragments.map(({ key }) => key), [
    'saju-axis/WOOD/weak/WATER/inseong',
    'conclusion/sajuFit/insufficientEvidence',
  ]);
  assert.equal(plan.sections[2].availability, 'not_applicable');
});

test('empty production catalog exposes missing content instead of fallback prose', () => {
  const report = buildNamingEvidenceReport(input());
  assert.equal(report.contentVersion, 'unpopulated');
  assert.equal(report.sections[0].availability, 'content_missing');
  assert.equal(report.sections[0].plain, '');
  assert.equal(report.sections[0].missingFragmentKeys.length, 5);
});

test('renders reviewed catalog fragments and substitutes name, element, and user-facing function placeholders', () => {
  const plan = buildNamingEvidencePlan(input());
  const sajuRefs = plan.sections[0].fragments;
  const fragments = Object.fromEntries(sajuRefs.map((reference) => [reference.key, {
    key: reference.key,
    sectionId: 'sajuFit' as const,
    slot: reference.slot,
    plain: reference.key === 'source/balance/improves'
      ? `${reference.slot} {{filledElements}}. {{filledElementFunctions}}을 받쳐 줘요.`
      : `${reference.slot} {{name}}.`,
    detail: `${reference.slot} detail.`,
  }]));
  const catalog: NamingEvidenceCatalog = {
    schemaVersion: NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION,
    contentVersion: 'test-v1',
    fragments,
    connectors: { supports: ['support'], neutral: ['neutral'], counterbalances: ['balance'] },
  };
  const report = buildNamingEvidenceReport(input(), catalog);
  assert.equal(report.sections[0].availability, 'ready');
  assert.match(report.sections[0].plain, /김하늘/);
  assert.match(report.sections[0].plain, /수 기운/u);
  assert.match(report.sections[0].plain, /상황을 살피고 변화에 유연하게 대응하는 힘/u);
  assert.doesNotMatch(report.sections[0].plain, /\{\{filledElements\}\}/u);
  assert.doesNotMatch(report.sections[0].plain, /\{\{filledElementFunctions\}\}/u);
  assert.equal(report.sections[1].availability, 'content_missing');
});

test('fails closed when an unresolved saju axis reaches the planner', () => {
  const invalid = input() as NamingEvidenceReportInput & { sajuAxes: { strength: string } };
  invalid.sajuAxes.strength = 'UNKNOWN';
  assert.throws(() => buildNamingEvidencePlan(invalid), NamingEvidenceContractError);
});
