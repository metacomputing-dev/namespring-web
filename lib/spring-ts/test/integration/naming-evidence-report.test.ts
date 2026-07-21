import assert from 'node:assert/strict';
import test from 'node:test';
import type { NamingReport, NamingScoreVector } from '../../src/types.js';
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

function input(vector = scoreVector()): NamingEvidenceReportInput {
  return {
    springReport: { scoreVector: vector, namingReport: namingReport(vector) },
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
  assert.equal(saju.verdict, 'good');
  assert.equal(saju.conclusionTone, 'mixedButUsable');
  assert.deepEqual(saju.fragments.map(({ key }) => key), [
    'saju-axis/WOOD/weak/WATER/inseong',
    'score/sajuFit/good',
    'score/yongshinFit/excellent',
    'score/elementBalance/mixed',
    'conclusion/sajuFit/mixedButUsable',
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

test('omits unavailable score axes and marks an unavailable pronunciation section', () => {
  const vector = scoreVector({ sajuFit: 79, yongshinFit: null, elementBalance: null, phonetic: null, familyFit: null });
  const plan = buildNamingEvidencePlan(input(vector));
  assert.deepEqual(plan.sections[0].fragments.map(({ key }) => key), [
    'saju-axis/WOOD/weak/WATER/inseong',
    'score/sajuFit/good',
    'conclusion/sajuFit/mostlyPositive',
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

test('renders reviewed catalog fragments and substitutes only the name placeholder', () => {
  const plan = buildNamingEvidencePlan(input());
  const sajuRefs = plan.sections[0].fragments;
  const fragments = Object.fromEntries(sajuRefs.map((reference) => [reference.key, {
    key: reference.key,
    sectionId: 'sajuFit' as const,
    slot: reference.slot,
    plain: `${reference.slot} {{name}}.`,
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
  assert.equal(report.sections[1].availability, 'content_missing');
});

test('fails closed when an unresolved saju axis reaches the planner', () => {
  const invalid = input() as NamingEvidenceReportInput & { sajuAxes: { strength: string } };
  invalid.sajuAxes.strength = 'UNKNOWN';
  assert.throws(() => buildNamingEvidencePlan(invalid), NamingEvidenceContractError);
});
