import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildRegressionReport } from './measure_regression.mjs';
import { classifyFixtureDiff, runMeasure } from './measure_default_change.mjs';
import {
  APPROVAL_SCHEMA_VERSION,
  buildSnapshotDiff,
  fingerprintApprovalImpact,
  fingerprintSnapshotDiff,
  loadApprovalManifestForEvaluation,
  parseJsonStrict,
  resolveDiffApproval,
  verifyAttestationOnly,
  verifyManifestEvidenceAtRef,
} from './snapshot_diff_approval.mjs';

const SHA_A = `sha256:${'a'.repeat(64)}`;
const SHA_B = `sha256:${'b'.repeat(64)}`;
const VALID_ATTESTATION = { valid: true, errors: [] };
const SPRING_TS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(output, id = 'fix-01') {
  return { id, label: id, output };
}

function snapshot(...results) {
  return { fixtureCount: results.length, results };
}

function subjectFor(diffs, overrides = {}) {
  return {
    baselineCommit: '1'.repeat(40),
    reviewedCommit: '2'.repeat(40),
    exactDiffFingerprint: fingerprintSnapshotDiff(diffs),
    baselineFixtureSetSha256: SHA_A,
    reviewedFixtureSetSha256: SHA_A,
    baselineSnapshotSha256: SHA_A,
    reviewedSnapshotSha256: SHA_A,
    baselineCandidateSnapshotSha256: SHA_A,
    reviewedCandidateSnapshotSha256: SHA_A,
    ...overrides,
  };
}

function evidence(reference = 'lib/spring-ts/docs/dossiers/default-change-test/EVIDENCE.md') {
  return [{
    kind: 'self-review',
    reference,
    summary: 'Exact change was reviewed against the declared contract.',
    sha256: SHA_A,
  }];
}

function approvedManifest(diffs, subject = subjectFor(diffs)) {
  return {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    approvals: [{
      fingerprint: fingerprintApprovalImpact(diffs, subject),
      status: 'approved',
      subject,
      reviewedBy: 'repository-owner-authorized-review@example.test',
      reviewedAt: '2026-07-15',
      evidence: evidence(),
    }],
  };
}

function refs(subject) {
  return { approvalSubject: subject, approvalAttestation: VALID_ATTESTATION };
}

test('numeric field deletion is a structural regression', () => {
  const result = classifyFixtureDiff(
    fixture({ namingReport: { totalScore: 70 } }),
    fixture({ namingReport: {} }),
  );
  assert.equal(result.type, 'regression');
  assert.equal(result.dimensions.D1.verdict, 'regression');
});

test('direction-unknown added card requires review', () => {
  const result = classifyFixtureDiff(
    fixture({ fortuneReport: { overview: {} } }),
    fixture({ fortuneReport: { overview: {}, experimental: {} } }),
  );
  assert.equal(result.type, 'review_required');
  assert.deepEqual(result.dimensions.D3.addedCards, ['experimental']);
});

test('exact impact fingerprint is deterministic and subject-bound', () => {
  const baseline = snapshot(fixture({ value: 1 }));
  const current = snapshot(fixture({ value: 2 }));
  const diffs = buildSnapshotDiff(baseline, current);
  const subject = subjectFor(diffs);
  const fingerprint = fingerprintApprovalImpact(diffs, subject);
  assert.equal(fingerprintApprovalImpact([...diffs].reverse(), subject), fingerprint);

  const approval = resolveDiffApproval(
    diffs,
    approvedManifest(diffs, subject),
    subject,
    VALID_ATTESTATION,
  );
  assert.equal(approval.status, 'APPROVED');

  const changedSubject = { ...subject, reviewedCommit: '3'.repeat(40) };
  assert.equal(resolveDiffApproval(
    diffs,
    approvedManifest(diffs, subject),
    changedSubject,
    VALID_ATTESTATION,
  ).status, 'SUBJECT_MISMATCH');
});

test('candidate-only and fixture-only changes require exact approval', () => {
  const unchanged = snapshot(fixture({ value: 1 }));
  for (const changedSubject of [
    subjectFor([], { reviewedCandidateSnapshotSha256: SHA_B }),
    subjectFor([], { reviewedFixtureSetSha256: SHA_B }),
  ]) {
    const approval = resolveDiffApproval([], {
      schemaVersion: APPROVAL_SCHEMA_VERSION,
      approvals: [],
    }, changedSubject, null);
    assert.equal(approval.status, 'MISSING');
    assert.equal(approval.impactChanged, true);
    assert.equal(runMeasure(unchanged, unchanged, {
      schemaVersion: APPROVAL_SCHEMA_VERSION,
      approvals: [],
    }, { approvalSubject: changedSubject }).overall, 'REVIEW_REQUIRED');
  }
});

test('an unrelated pending approval blocks even an exact zero diff', () => {
  const unchanged = snapshot(fixture({ value: 1 }));
  const subject = subjectFor([]);
  const manifest = {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    approvals: [{
      fingerprint: fingerprintApprovalImpact([], subject),
      status: 'pending',
      subject,
      reviewedBy: null,
      reviewedAt: null,
      evidence: [],
    }],
  };
  assert.equal(resolveDiffApproval([], manifest, subject).status, 'REGISTRY_PENDING');
  assert.equal(runMeasure(unchanged, unchanged, manifest, refs(subject)).overall, 'DEFAULT_CHANGE_BLOCKED');
  assert.equal(buildRegressionReport(unchanged, unchanged, manifest, refs(subject)).passed, false);
});

test('a fully evidenced superseded entry does not block zero diff', () => {
  const subject = subjectFor([]);
  const manifest = {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    approvals: [{
      fingerprint: fingerprintApprovalImpact([], subject),
      status: 'superseded',
      supersededBy: 'merged-stack-review/pr-654',
      supersededAt: '2026-07-15',
      supersessionEvidence: evidence(),
      note: 'The cumulative comparison was replaced by incremental stack review.',
    }],
  };
  assert.equal(resolveDiffApproval([], manifest, subject).status, 'NOT_REQUIRED');

  delete manifest.approvals[0].supersessionEvidence;
  assert.equal(resolveDiffApproval([], manifest, subject).status, 'MANIFEST_INVALID');
});

test('the whole manifest is validated before matching or no-diff shortcuts', () => {
  const diffs = buildSnapshotDiff(snapshot(fixture({ value: 1 })), snapshot(fixture({ value: 2 })));
  const subject = subjectFor(diffs);
  const manifest = approvedManifest(diffs, subject);
  manifest.approvals.push({ fingerprint: 'not-a-sha', status: 'superseded' });
  const result = resolveDiffApproval(diffs, manifest, subject, VALID_ATTESTATION);
  assert.equal(result.status, 'MANIFEST_INVALID');
  assert.ok(result.errors.some((error) => error.includes('fingerprint is invalid')));
});

test('duplicate fingerprints and unknown keys fail closed', () => {
  const diffs = [];
  const subject = subjectFor(diffs);
  const entry = {
    fingerprint: fingerprintApprovalImpact(diffs, subject),
    status: 'superseded',
    supersededBy: 'review/pr-1',
    supersededAt: '2026-07-15',
    supersessionEvidence: evidence(),
  };
  const duplicate = {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    approvals: [entry, { ...entry }],
  };
  assert.equal(resolveDiffApproval([], duplicate, subject).status, 'MANIFEST_INVALID');

  const unknown = { schemaVersion: APPROVAL_SCHEMA_VERSION, approvals: [], typo: true };
  assert.equal(resolveDiffApproval([], unknown, subject).status, 'MANIFEST_INVALID');
});

test('approved metadata and attestation are both mandatory', () => {
  const diffs = buildSnapshotDiff(snapshot(fixture({ value: 1 })), snapshot(fixture({ value: 2 })));
  const subject = subjectFor(diffs);
  const manifest = approvedManifest(diffs, subject);
  manifest.approvals[0].reviewedBy = '';
  manifest.approvals[0].evidence = [];
  assert.equal(resolveDiffApproval(diffs, manifest, subject, VALID_ATTESTATION).status, 'MANIFEST_INVALID');

  const valid = approvedManifest(diffs, subject);
  assert.equal(resolveDiffApproval(diffs, valid, subject, null).status, 'ATTESTATION_INVALID');
});

test('approval cannot waive structural regression', () => {
  const baseline = snapshot(fixture({ namingReport: { totalScore: 70 } }));
  const current = snapshot(fixture({ namingReport: {} }));
  const diffs = buildSnapshotDiff(baseline, current);
  const subject = subjectFor(diffs);
  const manifest = approvedManifest(diffs, subject);
  const measure = runMeasure(baseline, current, manifest, refs(subject));
  assert.equal(measure.overall, 'REGRESSION');

  const regression = buildRegressionReport(baseline, current, manifest, refs(subject));
  assert.equal(regression.structuralRegression, true);
  assert.equal(regression.passed, false);
});

test('strict manifest parser rejects duplicate JSON object keys', () => {
  assert.throws(
    () => parseJsonStrict('{"schemaVersion":"a","schemaVersion":"b","approvals":[]}'),
    /duplicate object key/,
  );
});

test('release suite runs candidate snapshot and calculator state gates', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, 'package.json'), 'utf8'));
  const releaseSuite = packageJson.scripts['test:saju-engine-release'];
  for (const script of [
    'test:gyeokguk-candidates',
    'test:saju-disabled',
    'test:saju-calculator-state',
  ]) {
    assert.match(
      releaseSuite,
      new RegExp(`(?:^|&&\\s*)npm run ${script}(?:\\s*&&|$)`, 'u'),
    );
  }
});

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function commitAll(root, message) {
  git(root, 'add', '-A');
  git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

test('manifest defaults to the evaluated ref and ignores dirty working-tree content', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'default-change-ref-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.email', 'gate@example.test');
  git(root, 'config', 'user.name', 'Gate Test');
  const rel = 'lib/spring-ts/test/baseline/default-change-approvals.json';
  const full = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    approvals: [],
  }));
  commitAll(root, 'baseline');
  fs.writeFileSync(full, '{"schemaVersion":"tampered","approvals":[]}');

  const fromRef = loadApprovalManifestForEvaluation({ repoRoot: root, branchRef: 'HEAD' });
  assert.equal(fromRef.manifest.schemaVersion, APPROVAL_SCHEMA_VERSION);
  assert.equal(fromRef.metadata.source, 'evaluated-branch');
  assert.equal(fromRef.metadata.authoritative, true);

  const override = loadApprovalManifestForEvaluation({
    repoRoot: root,
    branchRef: 'HEAD',
    requestedPath: full,
  });
  assert.equal(override.manifest.schemaVersion, 'tampered');
  assert.equal(override.metadata.source, 'explicit-override');
  assert.equal(override.metadata.authoritative, false);
});

test('post-review attestation allows only exact evidence blobs and manifest', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'default-change-attest-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.email', 'gate@example.test');
  git(root, 'config', 'user.name', 'Gate Test');
  fs.writeFileSync(path.join(root, 'engine.txt'), 'reviewed code');
  const baseline = commitAll(root, 'baseline');
  fs.writeFileSync(path.join(root, 'engine.txt'), 'reviewed code freeze');
  const reviewed = commitAll(root, 'reviewed');

  const manifestRel = 'lib/spring-ts/test/baseline/default-change-approvals.json';
  const evidenceRel = 'lib/spring-ts/docs/dossiers/default-change-test/EVIDENCE.md';
  const manifestPath = path.join(root, ...manifestRel.split('/'));
  const evidencePath = path.join(root, ...evidenceRel.split('/'));
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(manifestPath, '{}');
  fs.writeFileSync(evidencePath, 'review evidence');
  const evaluated = commitAll(root, 'attestation');
  const record = {
    reference: evidenceRel,
    sha256: `sha256:${crypto.createHash('sha256')
      .update(fs.readFileSync(evidencePath)).digest('hex')}`,
  };

  const valid = verifyAttestationOnly({
    repoRoot: root,
    baselineRef: baseline,
    reviewedRef: reviewed,
    evaluatedRef: evaluated,
    evidence: [record],
  });
  assert.equal(valid.valid, true, valid.errors.join('; '));

  const wrongDigest = verifyManifestEvidenceAtRef({
    repoRoot: root,
    evaluatedRef: evaluated,
    evidence: [{ ...record, sha256: SHA_B }],
  });
  assert.equal(wrongDigest.valid, false);
  assert.ok(wrongDigest.errors.some((error) => error.includes('sha256 does not match')));

  fs.writeFileSync(path.join(root, 'engine.txt'), 'post-review mutation');
  const mutated = commitAll(root, 'mutate source');
  const invalid = verifyAttestationOnly({
    repoRoot: root,
    baselineRef: baseline,
    reviewedRef: reviewed,
    evaluatedRef: mutated,
    evidence: [record],
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('non-attestation paths')));
});
