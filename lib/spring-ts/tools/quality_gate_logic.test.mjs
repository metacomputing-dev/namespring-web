import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateD1,
  strengthLevelMatches,
} from './quality_gate.mjs';

function authority(expected) {
  return {
    sourceTier: {
      tier: 'T4_PRIMARY_TEXT',
      authorityTruthEligible: true,
    },
    expected,
  };
}

test('plain middle strength does not pass weak or strong authority labels', () => {
  assert.equal(strengthLevelMatches('\uC911\uD654', '\uC2E0\uC57D'), false);
  assert.equal(strengthLevelMatches('\uC911\uD654', '\uC2E0\uAC15'), false);
  assert.equal(strengthLevelMatches('\uC911\uD654', '\uC911\uD654'), true);
});

test('D1 fails when authority expects numerical output that is missing', () => {
  const result = evaluateD1(
    { allowedDiff: [] },
    { output: { sajuReport: {}, namingReport: {} } },
    authority({ scores: { hangul: 20 }, totalScore: 70 }),
    null,
  );
  assert.equal(result.status, 'FAIL');
  assert.ok(result.checks.some((check) =>
    check.field === 'namingReport.totalScore' &&
    check.reason?.includes('missing')));
  assert.ok(result.checks.some((check) =>
    check.field === 'namingReport.scores.hangul' &&
    check.reason?.includes('missing')));
});
