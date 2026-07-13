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
  fingerprintBlockerInventory,
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
  const releaseBlockers = [];
  const blockers = [];
  const blockerInventoryFingerprint = fingerprintBlockerInventory(blockers);
  return {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    releaseBlockers,
    releaseBlockerInventoryFingerprint: fingerprintBlockerInventory(releaseBlockers),
    blockerInventories: [{
      fingerprint,
      blockers,
    }],
    approvals: [{
      fingerprint,
      blockerInventoryFingerprint,
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

function bindBlockers(manifest, blockers) {
  manifest.blockerInventories[0].blockers = blockers;
  manifest.approvals[0].blockerInventoryFingerprint = fingerprintBlockerInventory(blockers);
  return manifest;
}

function bindReleaseBlockers(manifest, blockers) {
  manifest.releaseBlockers = blockers;
  manifest.releaseBlockerInventoryFingerprint = fingerprintBlockerInventory(blockers);
  return manifest;
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
  const manifest = approvedManifest(fingerprintSnapshotDiff(diffs));
  manifest.approvals[0].reviewedBy = '';
  manifest.approvals[0].reviewedAt = 'not-a-date';
  manifest.approvals[0].evidence = [];
  const approval = resolveDiffApproval(diffs, manifest);
  assert.equal(approval.status, 'INVALID_APPROVAL');
  assert.ok(approval.errors.length >= 3);
});

test('an approved fingerprint cannot bypass an unresolved P0 or P1 blocker', () => {
  const baseline = snapshot(fixture({ sajuReport: { gyeokgukType: '편재격' } }));
  const branch = snapshot(fixture({ sajuReport: { gyeokgukType: '건록격' } }));
  const diffs = buildSnapshotDiff(baseline, branch);
  const fingerprint = fingerprintSnapshotDiff(diffs);
  const manifest = approvedManifest(fingerprint);
  const blockers = [{
    id: 'QUALITY_EVIDENCE_FILTERING_CONTRADICTION',
    severity: 'P1',
    status: 'open',
  }];
  manifest.blockerInventories[0].blockers = blockers;

  const unbound = resolveDiffApproval(diffs, manifest);
  assert.equal(unbound.status, 'MANIFEST_INVALID');
  assert.ok(unbound.errors.some((error) => error.includes('not bound')));

  bindBlockers(manifest, blockers);

  const approval = resolveDiffApproval(diffs, manifest);
  assert.equal(approval.status, 'INVALID_APPROVAL');
  assert.ok(approval.errors.some((error) => error.includes('remains unresolved')));
  assert.equal(runMeasure(baseline, branch, manifest).overall, 'REVIEW_REQUIRED');
});

test('a resolved P1 blocker requires dated resolution evidence', () => {
  const baseline = snapshot(fixture({ sajuReport: { gyeokgukType: '편재격' } }));
  const branch = snapshot(fixture({ sajuReport: { gyeokgukType: '건록격' } }));
  const diffs = buildSnapshotDiff(baseline, branch);
  const fingerprint = fingerprintSnapshotDiff(diffs);
  const invalidManifest = approvedManifest(fingerprint);
  bindBlockers(invalidManifest, [{
    id: 'QUALITY_EVIDENCE_FILTERING_CONTRADICTION',
    severity: 'P1',
    status: 'resolved',
  }]);

  const invalid = resolveDiffApproval(diffs, invalidManifest);
  assert.equal(invalid.status, 'MANIFEST_INVALID');
  assert.ok(invalid.errors.some((error) => error.includes('resolvedBy is required')));
  assert.ok(invalid.errors.some((error) => error.includes('resolvedAt must be')));
  assert.ok(invalid.errors.some((error) => error.includes('resolutionEvidence')));

  const resolvedManifest = approvedManifest(fingerprint);
  bindBlockers(resolvedManifest, [{
    id: 'QUALITY_EVIDENCE_FILTERING_CONTRADICTION',
    severity: 'P1',
    status: 'resolved',
    resolvedBy: 'commit:test-fix',
    resolvedAt: '2026-07-13',
    resolutionEvidence: [{
      kind: 'regression-test',
      reference: 'lib/saju-ts/src/rules/gyeokgukStructuralMonthFrame.test.ts',
      summary: 'Selection candidates and exposure evidence are verified separately.',
    }],
  }]);

  assert.equal(resolveDiffApproval(diffs, resolvedManifest).status, 'APPROVED');
});

test('duplicate approval entries cannot hide blockers by ordering or status', () => {
  const baseline = snapshot(fixture({ sajuReport: { strengthLevel: 'weak' } }));
  const branch = snapshot(fixture({ sajuReport: { strengthLevel: 'strong' } }));
  const diffs = buildSnapshotDiff(baseline, branch);
  const fingerprint = fingerprintSnapshotDiff(diffs);
  const canonical = approvedManifest(fingerprint);
  const cleanApproved = canonical.approvals[0];
  const blockedPending = {
    ...cleanApproved,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    evidence: [],
  };

  for (const approvals of [
    [cleanApproved, blockedPending],
    [blockedPending, cleanApproved],
  ]) {
    const approval = resolveDiffApproval(diffs, {
      schemaVersion: APPROVAL_SCHEMA_VERSION,
      releaseBlockers: canonical.releaseBlockers,
      releaseBlockerInventoryFingerprint: canonical.releaseBlockerInventoryFingerprint,
      approvals,
      blockerInventories: canonical.blockerInventories,
    });
    assert.equal(approval.status, 'MANIFEST_INVALID');
    assert.ok(approval.errors.some((error) => error.includes('exactly one approval entry')));
  }
});

test('duplicate canonical blocker inventories are rejected', () => {
  const baseline = snapshot(fixture({ value: 1 }));
  const branch = snapshot(fixture({ value: 2 }));
  const diffs = buildSnapshotDiff(baseline, branch);
  const fingerprint = fingerprintSnapshotDiff(diffs);
  const manifest = approvedManifest(fingerprint);
  manifest.blockerInventories.push({ fingerprint, blockers: [] });

  const approval = resolveDiffApproval(diffs, manifest);
  assert.equal(approval.status, 'MANIFEST_INVALID');
  assert.ok(approval.errors.some((error) => error.includes('canonical blocker inventory')));
});

test('open P2 requires an explicit evidence-bound risk acceptance', () => {
  const baseline = snapshot(fixture({ value: 1 }));
  const branch = snapshot(fixture({ value: 2 }));
  const diffs = buildSnapshotDiff(baseline, branch);
  const fingerprint = fingerprintSnapshotDiff(diffs);
  const openManifest = approvedManifest(fingerprint);
  bindBlockers(openManifest, [{ id: 'PERFORMANCE_FOLLOWUP', severity: 'P2', status: 'open' }]);
  assert.equal(resolveDiffApproval(diffs, openManifest).status, 'INVALID_APPROVAL');

  const acceptedManifest = approvedManifest(fingerprint);
  bindBlockers(acceptedManifest, [{
    id: 'PERFORMANCE_FOLLOWUP',
    severity: 'P2',
    status: 'accepted',
    acceptedBy: 'release-owner@example.test',
    acceptedAt: '2026-07-13',
    acceptanceRationale: 'Measured latency remains within the current release budget.',
    acceptanceEvidence: [{
      kind: 'benchmark',
      reference: 'evidence/performance-budget.json',
      summary: 'Release-owner reviewed the measured latency and bounded follow-up.',
    }],
  }]);
  assert.equal(resolveDiffApproval(diffs, acceptedManifest).status, 'APPROVED');
});

test('zero exact diff cannot bypass an open global release blocker', () => {
  const unchanged = snapshot(fixture({ value: 1 }));
  const fingerprint = fingerprintSnapshotDiff([]);
  const manifest = approvedManifest(fingerprint);
  bindReleaseBlockers(manifest, [{
    id: 'QUALITY_EVIDENCE_DEFAULT_IMPACT_REVIEW',
    severity: 'P1',
    status: 'open',
  }]);

  const approval = resolveDiffApproval([], manifest);
  assert.equal(approval.status, 'RELEASE_BLOCKED');
  assert.ok(approval.errors.some((error) => error.includes('remains unresolved')));

  const measure = runMeasure(unchanged, unchanged, manifest);
  assert.equal(measure.rawOverall, 'UNCHANGED');
  assert.equal(measure.overall, 'RELEASE_BLOCKED');

  const regression = buildRegressionReport(unchanged, unchanged, manifest);
  assert.equal(regression.totalDiffs, 0);
  assert.equal(regression.releaseBlocked, true);
  assert.equal(regression.passed, false);
});

test('global release blocker inventory digest mismatch fails closed with zero diff', () => {
  const unchanged = snapshot(fixture({ value: 1 }));
  const manifest = approvedManifest(fingerprintSnapshotDiff([]));
  manifest.releaseBlockers = [{
    id: 'EARTH_MIXED_MONTH_STRUCTURAL_COMPATIBILITY',
    severity: 'P1',
    status: 'open',
  }];

  const approval = resolveDiffApproval([], manifest);
  assert.equal(approval.status, 'MANIFEST_INVALID');
  assert.ok(approval.errors.some((error) => error.includes('must equal')));
  assert.equal(runMeasure(unchanged, unchanged, manifest).overall, 'RELEASE_BLOCKED');
  assert.equal(buildRegressionReport(unchanged, unchanged, manifest).passed, false);
});

test('duplicate global blocker ids are rejected before no-diff approval', () => {
  const manifest = approvedManifest(fingerprintSnapshotDiff([]));
  bindReleaseBlockers(manifest, [
    { id: 'DUPLICATE', severity: 'P1', status: 'open' },
    { id: 'DUPLICATE', severity: 'P2', status: 'open' },
  ]);

  const approval = resolveDiffApproval([], manifest);
  assert.equal(approval.status, 'MANIFEST_INVALID');
  assert.ok(approval.errors.some((error) => error.includes('duplicates DUPLICATE')));
});

test('closed global registry permits NOT_REQUIRED when the exact diff is empty', () => {
  const unchanged = snapshot(fixture({ value: 1 }));
  const manifest = approvedManifest(fingerprintSnapshotDiff([]));
  bindReleaseBlockers(manifest, [
    {
      id: 'RESOLVED_POLICY_REVIEW',
      severity: 'P1',
      status: 'resolved',
      resolvedBy: 'independent-reviewer@example.test',
      resolvedAt: '2026-07-13',
      resolutionEvidence: [{
        kind: 'review-dossier',
        reference: 'docs/dossiers/resolved-policy/DOSSIER.md',
        summary: 'Independent review closed the policy question.',
      }],
    },
    {
      id: 'ACCEPTED_BOUNDED_FOLLOWUP',
      severity: 'P2',
      status: 'accepted',
      acceptedBy: 'release-owner@example.test',
      acceptedAt: '2026-07-13',
      acceptanceRationale: 'The bounded follow-up does not affect judgement correctness.',
      acceptanceEvidence: [{
        kind: 'risk-register',
        reference: 'docs/release-risk-register.md',
        summary: 'Release owner accepted the documented non-judgement follow-up.',
      }],
    },
  ]);

  assert.equal(resolveDiffApproval([], manifest).status, 'NOT_REQUIRED');
  assert.equal(runMeasure(unchanged, unchanged, manifest).overall, 'UNCHANGED');
  assert.equal(buildRegressionReport(unchanged, unchanged, manifest).passed, true);
});

test('global accepted P1 and incomplete accepted P2 remain manifest-invalid', () => {
  const acceptedP1 = approvedManifest(fingerprintSnapshotDiff([]));
  bindReleaseBlockers(acceptedP1, [{
    id: 'CANNOT_ACCEPT_P1',
    severity: 'P1',
    status: 'accepted',
    acceptedBy: 'release-owner@example.test',
    acceptedAt: '2026-07-13',
    acceptanceRationale: 'Invalid by policy.',
    acceptanceEvidence: [{ kind: 'note', reference: 'invalid', summary: 'Invalid.' }],
  }]);
  assert.equal(resolveDiffApproval([], acceptedP1).status, 'MANIFEST_INVALID');

  const incompleteP2 = approvedManifest(fingerprintSnapshotDiff([]));
  bindReleaseBlockers(incompleteP2, [{
    id: 'INCOMPLETE_P2',
    severity: 'P2',
    status: 'accepted',
  }]);
  const approval = resolveDiffApproval([], incompleteP2);
  assert.equal(approval.status, 'MANIFEST_INVALID');
  assert.ok(approval.errors.some((error) => error.includes('acceptedBy is required')));
});

test('an open global blocker blocks an otherwise approved exact change', () => {
  const baseline = snapshot(fixture({ value: 1 }));
  const branch = snapshot(fixture({ value: 2 }));
  const fingerprint = fingerprintSnapshotDiff(buildSnapshotDiff(baseline, branch));
  const manifest = approvedManifest(fingerprint);
  bindReleaseBlockers(manifest, [{
    id: 'EXTERNAL_AUTHORITY_REVIEW',
    severity: 'P1',
    status: 'open',
  }]);

  assert.equal(resolveDiffApproval(buildSnapshotDiff(baseline, branch), manifest).status, 'RELEASE_BLOCKED');
  assert.equal(runMeasure(baseline, branch, manifest).overall, 'RELEASE_BLOCKED');
  assert.equal(buildRegressionReport(baseline, branch, manifest).passed, false);
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
  const manifest = approvedManifest(fingerprint);
  const measure = runMeasure(baseline, branch, manifest);
  assert.equal(measure.rawOverall, 'REGRESSION');
  assert.equal(measure.overall, 'REGRESSION');

  const regression = buildRegressionReport(baseline, branch, manifest);
  assert.equal(regression.structuralRegression, true);
  assert.equal(regression.unapprovedDiffs, 1);
  assert.equal(regression.passed, false);

  bindReleaseBlockers(manifest, [{
    id: 'ALSO_OPEN',
    severity: 'P1',
    status: 'open',
  }]);
  assert.equal(runMeasure(baseline, branch, manifest).overall, 'REGRESSION');
  assert.equal(buildRegressionReport(baseline, branch, manifest).structuralRegression, true);
});
