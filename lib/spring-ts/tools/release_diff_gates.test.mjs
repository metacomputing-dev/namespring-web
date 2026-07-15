import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRegressionReport } from './measure_regression.mjs';
import {
  classifyFixtureDiff,
  runMeasure,
} from './measure_default_change.mjs';
import {
  APPROVAL_SCHEMA_VERSION,
  buildSnapshotDiff,
  fingerprintSnapshotDiff,
  resolveDiffApproval,
} from './snapshot_diff_approval.mjs';

function fixture(output, id = 'fix-01') {
  return { id, label: id, output };
}

function snapshot(...results) {
  return { fixtureCount: results.length, results };
}

function approvedManifest(fingerprint) {
  return {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    approvals: [{
      fingerprint,
      status: 'approved',
      reviewedBy: 'independent-expert@example.test',
      reviewedAt: '2026-07-10',
      evidence: [{
        kind: 'blind_holdout',
        reference: 'evidence/expert-holdout-2026-07-10.json',
        summary: 'Independent adjudication of every changed judgement field.',
      }],
    }],
  };
}

test('numeric field deletion is a structural regression', () => {
  const baseline = fixture({
    namingReport: { totalScore: 70, scores: { hangul: 20, hanja: 30, fourFrame: 20 } },
  });
  const branch = fixture({
    namingReport: { scores: { hangul: 20, hanja: 30, fourFrame: 20 } },
  });
  const result = classifyFixtureDiff(baseline, branch);
  assert.equal(result.type, 'regression');
  assert.equal(result.dimensions.D1.verdict, 'regression');
});

test('direction-unknown added card requires review', () => {
  const baseline = fixture({ fortuneReport: { overview: {} } });
  const branch = fixture({ fortuneReport: { overview: {}, experimental: {} } });
  const result = classifyFixtureDiff(baseline, branch);
  assert.equal(result.type, 'review_required');
  assert.deepEqual(result.dimensions.D3.addedCards, ['experimental']);
});

test('nested field deletion is caught even outside named score fields', () => {
  const baseline = fixture({ sajuReport: { trace: { formula: 'x', value: 1 } } });
  const branch = fixture({ sajuReport: { trace: { value: 1 } } });
  const result = classifyFixtureDiff(baseline, branch);
  assert.equal(result.type, 'regression');
  assert.ok(result.dimensions.D5.checks.some((check) => check.field === 'sajuReport.trace.formula'));
});

test('exact diff fingerprint is deterministic and approval-bound', () => {
  const baseline = snapshot(fixture({ sajuReport: { strengthLevel: 'weak' } }));
  const branch = snapshot(fixture({ sajuReport: { strengthLevel: 'strong' } }));
  const diffs = buildSnapshotDiff(baseline, branch);
  const fingerprint = fingerprintSnapshotDiff(diffs);
  assert.equal(fingerprintSnapshotDiff([...diffs].reverse()), fingerprint);

  const approved = resolveDiffApproval(diffs, approvedManifest(fingerprint));
  assert.equal(approved.status, 'APPROVED');

  const changed = snapshot(fixture({ sajuReport: { strengthLevel: 'middle' } }));
  const changedApproval = resolveDiffApproval(
    buildSnapshotDiff(baseline, changed),
    approvedManifest(fingerprint),
  );
  assert.equal(changedApproval.status, 'MISSING');
});

test('approval without reviewer date and evidence is rejected', () => {
  const baseline = snapshot(fixture({ value: 1 }));
  const branch = snapshot(fixture({ value: 2 }));
  const diffs = buildSnapshotDiff(baseline, branch);
  const manifest = {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    approvals: [{
      fingerprint: fingerprintSnapshotDiff(diffs),
      status: 'approved',
      reviewedBy: '',
      reviewedAt: 'not-a-date',
      evidence: [],
    }],
  };
  const approval = resolveDiffApproval(diffs, manifest);
  assert.equal(approval.status, 'INVALID_APPROVAL');
  assert.ok(approval.errors.length >= 3);
});

test('approved review-only change passes both default and exact regression gates', () => {
  const baseline = snapshot(fixture({
    sajuReport: { strengthLevel: 'weak' },
    namingReport: { totalScore: 70 },
  }));
  const branch = snapshot(fixture({
    sajuReport: { strengthLevel: 'strong' },
    namingReport: { totalScore: 70 },
  }));
  const fingerprint = fingerprintSnapshotDiff(buildSnapshotDiff(baseline, branch));
  const manifest = approvedManifest(fingerprint);
  const measure = runMeasure(baseline, branch, manifest);
  assert.equal(measure.rawOverall, 'REVIEW_REQUIRED');
  assert.equal(measure.overall, 'APPROVED_CHANGE');

  const regression = buildRegressionReport(baseline, branch, manifest);
  assert.equal(regression.totalDiffs, 1);
  assert.equal(regression.unapprovedDiffs, 0);
});

test('approval cannot waive structural regression', () => {
  const baseline = snapshot(fixture({ namingReport: { totalScore: 70 } }));
  const branch = snapshot(fixture({ namingReport: {} }));
  const fingerprint = fingerprintSnapshotDiff(buildSnapshotDiff(baseline, branch));
  const measure = runMeasure(baseline, branch, approvedManifest(fingerprint));
  assert.equal(measure.rawOverall, 'REGRESSION');
  assert.equal(measure.overall, 'REGRESSION');
});
