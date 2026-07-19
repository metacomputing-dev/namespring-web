import assert from 'node:assert/strict';
import {
  buildCandidateElementGuidanceV1,
  orderCandidatePoolByElementPreference,
} from '../../src/candidate-guidance-policy.js';
import type { SajuSummary } from '../../src/types.js';

function summary(overrides: Partial<SajuSummary> = {}): SajuSummary {
  return {
    axisStrength: {
      strength: 'definite',
      gyeokguk: 'definite',
      yongshin: 'practical',
    },
    gyeokguk: {
      type: '식신격',
      category: '일반',
      baseTenGod: '식신',
      confidence: 0.7,
      reasoning: 'fixture',
    },
    yongshin: {
      element: 'METAL',
      heeshin: 'WATER',
      gishin: 'FIRE',
      gushin: 'EARTH',
      confidence: 70,
      agreement: 'fixture',
      warnings: [],
      recommendations: [],
    },
    deficientElements: ['EARTH', 'METAL'],
    excessiveElements: ['WOOD'],
    ...overrides,
  } as SajuSummary;
}

const exactHighConflict = summary({
  axisStrength: {
    strength: 'candidate',
    gyeokguk: 'candidate',
    yongshin: 'candidate',
  },
  gyeokguk: {
    type: '식신격',
    category: '일반',
    baseTenGod: '식신',
    confidence: 0.538903743315508,
    reasoning: '1986-04-19 05:45 Seoul fixture',
  },
  yongshin: {
    element: 'METAL',
    heeshin: 'WATER',
    gishin: 'FIRE',
    gushin: 'EARTH',
    confidence: 46,
    agreement: '순위 기반',
    warnings: [],
    recommendations: [],
  },
  yongshinConsensus: {
    final: {
      element: 'METAL',
      confidence: 0.477622,
      topMargin: 0.46243,
      normalizedTopMargin: 0.477622,
      methodDisagreementRatio: 0.666667,
      conflictLevel: 'high',
      competingElements: ['FIRE', 'WOOD'],
      evidence: [],
    },
  } as SajuSummary['yongshinConsensus'],
});

const conservative = buildCandidateElementGuidanceV1(exactHighConflict);
assert.equal(conservative.posture, 'conservative');
assert.equal(conservative.natalEvidence.status, 'limited');
assert.ok(conservative.natalEvidence.reasonCodes.includes('YONGSHIN_CONSENSUS_CONFLICT'));
assert.equal(conservative.preferenceStrength, 'soft');
assert.deepEqual(conservative.preferredElements, ['METAL', 'WATER']);
assert.deepEqual(conservative.excludedElements, []);
assert.deepEqual(conservative.conflictedElements, []);
assert.deepEqual(conservative.balanceSignals, {
  deficientElements: ['EARTH', 'METAL'],
  excessiveElements: ['WOOD'],
});

const ready = buildCandidateElementGuidanceV1(summary());
assert.equal(ready.posture, 'ready');
assert.equal(ready.preferenceStrength, 'strong');
assert.deepEqual(ready.preferredElements, ['METAL', 'WATER']);
assert.deepEqual(ready.excludedElements, ['EARTH', 'FIRE']);
assert.deepEqual(ready.conflictedElements, []);
assert.deepEqual(ready.balanceSignals, {
  deficientElements: ['EARTH', 'METAL'],
  excessiveElements: ['WOOD'],
});
assert.deepEqual(
  ready.preferredElements.filter((element) => ready.excludedElements.includes(element)),
  [],
  'a role conflict must never leak into both generation sets',
);

const roleConflict = buildCandidateElementGuidanceV1(summary({
  yongshin: {
    ...summary().yongshin,
    heeshin: 'EARTH',
    gushin: 'EARTH',
  },
}));
assert.deepEqual(roleConflict.preferredElements, ['METAL']);
assert.deepEqual(roleConflict.excludedElements, ['FIRE']);
assert.deepEqual(roleConflict.conflictedElements, ['EARTH']);

const partial = buildCandidateElementGuidanceV1(summary({
  analysisStatus: 'partial',
}));
assert.equal(partial.posture, 'conservative');
assert.equal(partial.preferenceStrength, 'none');
assert.deepEqual(partial.preferredElements, []);

const jonggyeokRisk = buildCandidateElementGuidanceV1(summary({
  yongshin: {
    ...summary().yongshin,
    jonggyeokRisk: {
      level: 'HIGH',
      direction: 'PRESSURE',
      strengthIndex: -0.7,
      dominanceRatio: 2.4,
      subtypes: ['cong_weak'],
      maxCandidateScore: 0.8,
      confidenceAttenuated: true,
    },
  },
}));
assert.equal(jonggyeokRisk.posture, 'conservative');
assert.equal(jonggyeokRisk.preferenceStrength, 'none');
assert.deepEqual(jonggyeokRisk.preferredElements, []);

const unavailable = buildCandidateElementGuidanceV1(null);
assert.equal(unavailable.posture, 'unavailable');
assert.equal(unavailable.preferenceStrength, 'none');
assert.deepEqual(unavailable.preferredElements, []);
assert.deepEqual(unavailable.excludedElements, []);

const pool = [
  { id: 'neutral-1', element: 'WOOD' },
  { id: 'preferred-1', element: 'METAL' },
  { id: 'preferred-2', element: 'WATER' },
  { id: 'neutral-2', element: 'FIRE' },
  { id: 'preferred-3', element: 'METAL' },
];
const preferred = new Set(['METAL', 'WATER']);
assert.deepEqual(
  orderCandidatePoolByElementPreference(pool, preferred, 'soft', (entry) => entry.element)
    .map((entry) => entry.id),
  ['preferred-1', 'neutral-1', 'preferred-2', 'neutral-2', 'preferred-3'],
);
assert.deepEqual(
  orderCandidatePoolByElementPreference(pool, preferred, 'strong', (entry) => entry.element)
    .map((entry) => entry.id),
  ['preferred-1', 'preferred-2', 'preferred-3', 'neutral-1', 'neutral-2'],
);

console.log('Candidate guidance policy: PASS');
