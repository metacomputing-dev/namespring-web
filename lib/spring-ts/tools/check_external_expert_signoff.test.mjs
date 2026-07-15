import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH,
  EXTERNAL_EXPERT_IDENTITY_DISCLAIMER,
  EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION,
  REQUIRED_EXTERNAL_EXPERT_DIMENSIONS,
  checkExternalExpertSignoff,
  loadBaselineFixtureIds,
  runExternalExpertSignoffCli,
  validateExternalExpertSignoffEvidence,
  validateExternalExpertSignoffGitBinding,
  validateExternalExpertSignoffManifest,
} from './check_external_expert_signoff.mjs';

function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function safeRemove(root) {
  const resolved = path.resolve(root);
  const tempRoot = path.resolve(os.tmpdir());
  if (!resolved.startsWith(tempRoot + path.sep)) {
    throw new Error(`Refusing to remove non-temporary path: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function makeRepository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'expert-signoff-git-'));
  t.after(() => safeRemove(root));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.test');
  git(root, 'config', 'user.name', 'Test Reviewer');

  const fixtureIds = Array.from({ length: 17 }, (_, index) =>
    `fix-${String(index + 1).padStart(2, '0')}`);
  const baselinePath = path.join(root, 'test/fixtures/spring_ts_baseline_cases.json');
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify({
    version: 1,
    fixtures: fixtureIds.map((id) => ({ id })),
  }, null, 2));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/engine.txt'), 'reviewed engine v1\n');
  git(root, 'add', 'test/fixtures/spring_ts_baseline_cases.json', 'src/engine.txt');
  git(root, 'commit', '-q', '-m', 'reviewed code');
  return { root, fixtureIds, reviewedCommit: git(root, 'rev-parse', 'HEAD') };
}

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function completeManifest(reviewedCommit, fixtureIds) {
  return {
    schemaVersion: EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION,
    status: 'approved',
    subject: {
      reviewedCommit,
      fixtureIds: [...fixtureIds],
    },
    reviewer: {
      name: 'Independent Myeongri Reviewer',
      qualification: 'Practising saju and myeongri reviewer with documented professional work.',
      qualificationEvidenceUrl: 'https://example.org/experts/myeongri-reviewer',
      independenceConfirmed: true,
      independenceStatement:
        'I reviewed this code independently and have no authorship or financial conflict in the engine changes.',
    },
    coverage: Object.fromEntries(REQUIRED_EXTERNAL_EXPERT_DIMENSIONS.map((dimension) => [
      dimension,
      { status: 'reviewed', fixtureIds: [...fixtureIds] },
    ])),
    verdict: {
      decision: 'approve_for_release',
      signedAt: '2026-07-11T01:02:03Z',
      statement:
        'I reviewed the declared fixtures and dimensions and recommend the reviewed commit for release.',
    },
    evidence: [],
  };
}

function addAttestation(repository, {
  manifest = completeManifest(repository.reviewedCommit, repository.fixtureIds),
  rawManifest,
  trackEvidence = true,
} = {}) {
  const evidenceRelative = 'docs/release-attestations/evidence/expert-review.txt';
  const evidencePath = path.join(repository.root, evidenceRelative);
  const evidenceBody =
    'Independent expert reviewed all canonical fixtures across D1 through D5.\n';
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, evidenceBody, 'utf8');
  if (manifest && Array.isArray(manifest.evidence)) {
    manifest.evidence = [{ path: evidenceRelative, sha256: sha256(evidenceBody) }];
  }

  const manifestPath = path.join(repository.root, DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    rawManifest ?? JSON.stringify(manifest, null, 2),
    'utf8',
  );
  git(repository.root, 'add', DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH);
  if (trackEvidence) git(repository.root, 'add', evidenceRelative);
  git(repository.root, 'commit', '-q', '-m', 'external expert attestation');
  return { manifestPath, evidencePath, evidenceRelative, manifest };
}

function runCli(root) {
  const stdout = [];
  const stderr = [];
  const exitCode = runExternalExpertSignoffCli(
    ['--repository-root', root],
    {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  );
  return { exitCode, stdout, stderr };
}

function codes(result) {
  return new Set(result.violations.map((violation) => violation.code));
}

test('signoff gate keeps an acyclic public facade and bounded production modules', async () => {
  const toolsRoot = path.dirname(fileURLToPath(import.meta.url));
  const contractRoot = path.join(toolsRoot, 'external-expert-signoff');
  const contractFiles = fs.readdirSync(contractRoot)
    .filter((name) => name.endsWith('.mjs'))
    .sort();
  assert.deepEqual(contractFiles, [
    'evidence-contract.mjs',
    'git-binding.mjs',
    'manifest-contract.mjs',
  ]);

  const files = [
    'check_external_expert_signoff.mjs',
    ...contractFiles.map((name) => `external-expert-signoff/${name}`),
  ];
  const sources = new Map(files.map((relative) => [
    relative,
    fs.readFileSync(path.join(toolsRoot, relative), 'utf8'),
  ]));
  for (const [relative, source] of sources) {
    assert.ok(
      source.split(/\r?\n/).length <= 400,
      `${relative} exceeds the 400-line production-module limit`,
    );
  }

  const graph = new Map();
  for (const [relative, source] of sources) {
    const imports = [];
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+\.mjs)['"]/g)) {
      imports.push(path.relative(
        toolsRoot,
        path.resolve(toolsRoot, path.dirname(relative), match[1]),
      ).replace(/\\/g, '/'));
    }
    graph.set(relative, imports.sort());
  }
  assert.deepEqual(graph.get('check_external_expert_signoff.mjs'), [
    'external-expert-signoff/evidence-contract.mjs',
    'external-expert-signoff/git-binding.mjs',
    'external-expert-signoff/manifest-contract.mjs',
  ]);
  assert.deepEqual(graph.get('external-expert-signoff/manifest-contract.mjs'), []);
  assert.deepEqual(graph.get('external-expert-signoff/evidence-contract.mjs'), [
    'external-expert-signoff/manifest-contract.mjs',
  ]);
  assert.deepEqual(graph.get('external-expert-signoff/git-binding.mjs'), [
    'external-expert-signoff/evidence-contract.mjs',
    'external-expert-signoff/manifest-contract.mjs',
  ]);

  const visiting = new Set();
  const visited = new Set();
  function visit(file) {
    assert.ok(!visiting.has(file), `cycle detected at ${file}`);
    if (visited.has(file)) return;
    visiting.add(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    visiting.delete(file);
    visited.add(file);
  }
  for (const file of files) visit(file);

  const allSource = [...sources.values()].join('\n');
  assert.equal(
    (allSource.match(/process\.exitCode\s*=\s*runExternalExpertSignoffCli/g) ?? []).length,
    1,
  );
  for (const [relative, source] of sources) {
    if (relative !== 'check_external_expert_signoff.mjs') {
      assert.doesNotMatch(source, /process\.argv/);
    }
  }

  const facade = await import('./check_external_expert_signoff.mjs');
  assert.deepEqual(Object.keys(facade).sort(), [
    'BASELINE_FIXTURE_RELATIVE_PATH',
    'DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH',
    'EXTERNAL_EXPERT_IDENTITY_DISCLAIMER',
    'EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION',
    'MIN_EXTERNAL_EXPERT_FIXTURES',
    'REQUIRED_EXTERNAL_EXPERT_DIMENSIONS',
    'checkExternalExpertSignoff',
    'loadBaselineFixtureIds',
    'resolveCurrentGitHead',
    'runExternalExpertSignoffCli',
    'validateExternalExpertSignoffEvidence',
    'validateExternalExpertSignoffGitBinding',
    'validateExternalExpertSignoffManifest',
  ]);
});

test('missing, malformed, and pending manifests fail closed', async (t) => {
  await t.test('missing', () => {
    const repository = makeRepository(t);
    const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
    assert.ok(codes(result).has('missing_manifest'));
    assert.equal(runCli(repository.root).exitCode, 1);
  });

  await t.test('malformed', () => {
    const repository = makeRepository(t);
    addAttestation(repository, { manifest: null, rawManifest: '{not json' });
    const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
    assert.ok(codes(result).has('malformed_manifest_json'));
    assert.equal(runCli(repository.root).exitCode, 1);
  });

  await t.test('pending', () => {
    const repository = makeRepository(t);
    const manifest = completeManifest(repository.reviewedCommit, repository.fixtureIds);
    manifest.status = 'pending';
    addAttestation(repository, { manifest });
    const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
    assert.ok(codes(result).has('signoff_not_approved'));
    assert.equal(runCli(repository.root).exitCode, 1);
  });
});

test('reviewed code commit followed by an attestation-only commit passes', (t) => {
  const repository = makeRepository(t);
  const attestation = addAttestation(repository);
  const manifest = JSON.parse(fs.readFileSync(attestation.manifestPath, 'utf8'));
  assert.equal(validateExternalExpertSignoffManifest(manifest, {
    expectedFixtureIds: loadBaselineFixtureIds(repository.root),
  }).status, 'PASS');
  assert.equal(validateExternalExpertSignoffEvidence(manifest, {
    repositoryRoot: repository.root,
    manifestPath: attestation.manifestPath,
  }).status, 'PASS');
  assert.equal(validateExternalExpertSignoffGitBinding(manifest, {
    repositoryRoot: repository.root,
    manifestPath: attestation.manifestPath,
  }).status, 'PASS');
  const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
  assert.equal(result.status, 'PASS');
  assert.equal(result.summary.reviewedCommit, repository.reviewedCommit);
  assert.equal(result.summary.fixtureCount, 17);
  assert.ok(result.summary.changedFiles.every((file) =>
    file.startsWith('docs/release-attestations/')));

  const cli = runCli(repository.root);
  assert.equal(cli.exitCode, 0);
  assert.ok(cli.stdout.includes('External expert signoff gate: PASS'));
  assert.ok(cli.stdout.includes(EXTERNAL_EXPERT_IDENTITY_DISCLAIMER));
});

test('a code change after the reviewed commit blocks release', (t) => {
  const repository = makeRepository(t);
  addAttestation(repository);
  fs.writeFileSync(path.join(repository.root, 'src/engine.txt'), 'unreviewed engine v2\n');
  git(repository.root, 'add', 'src/engine.txt');
  git(repository.root, 'commit', '-q', '-m', 'unreviewed code change');

  const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
  assert.equal(result.status, 'FAIL');
  assert.ok(codes(result).has('non_attestation_change_after_review'));
  assert.equal(runCli(repository.root).exitCode, 1);
});

test('unstaged, staged, and untracked release-worktree changes block signoff', async (t) => {
  for (const mode of ['unstaged', 'staged', 'untracked']) {
    await t.test(mode, () => {
      const repository = makeRepository(t);
      addAttestation(repository);
      if (mode === 'untracked') {
        fs.mkdirSync(path.join(repository.root, 'docs/dossiers'), { recursive: true });
        fs.writeFileSync(path.join(repository.root, 'docs/dossiers/untracked.md'), 'unreviewed\n');
      } else {
        fs.writeFileSync(path.join(repository.root, 'src/engine.txt'), `${mode} engine change\n`);
        if (mode === 'staged') git(repository.root, 'add', 'src/engine.txt');
      }
      const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
      assert.equal(result.status, 'FAIL');
      assert.ok(codes(result).has('dirty_release_worktree'));
      assert.equal(runCli(repository.root).exitCode, 1);
    });
  }
});

test('a valid but non-ancestor reviewed commit blocks release', (t) => {
  const repository = makeRepository(t);
  const tree = git(repository.root, 'rev-parse', 'HEAD^{tree}');
  const unrelatedCommit = git(repository.root, 'commit-tree', tree, '-m', 'unrelated review');
  const manifest = completeManifest(unrelatedCommit, repository.fixtureIds);
  addAttestation(repository, { manifest });

  const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
  assert.ok(codes(result).has('reviewed_commit_not_ancestor'));
  assert.equal(runCli(repository.root).exitCode, 1);
});

test('an arbitrary set of 17 IDs does not satisfy canonical fixture coverage', (t) => {
  const repository = makeRepository(t);
  const arbitrary = Array.from({ length: 17 }, (_, index) => `fake-${index + 1}`);
  const manifest = completeManifest(repository.reviewedCommit, arbitrary);
  addAttestation(repository, { manifest });

  const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
  assert.ok(codes(result).has('fixture_set_mismatch'));
  assert.equal(runCli(repository.root).exitCode, 1);
});

test('incomplete D1-D5 coverage blocks release', (t) => {
  const repository = makeRepository(t);
  const manifest = completeManifest(repository.reviewedCommit, repository.fixtureIds);
  delete manifest.coverage.D5;
  addAttestation(repository, { manifest });

  const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
  assert.ok(codes(result).has('insufficient_dimension_coverage'));
  assert.equal(runCli(repository.root).exitCode, 1);
});

test('an untracked evidence file blocks release', (t) => {
  const repository = makeRepository(t);
  addAttestation(repository, { trackEvidence: false });
  const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
  assert.equal(result.status, 'FAIL');
  assert.ok(codes(result).has('untracked_evidence_file'));
  assert.equal(runCli(repository.root).exitCode, 1);
});

test('evidence SHA mismatch and reviewer contract defects block release', async (t) => {
  await t.test('SHA mismatch', () => {
    const repository = makeRepository(t);
    const manifest = completeManifest(repository.reviewedCommit, repository.fixtureIds);
    const attestation = addAttestation(repository, { manifest });
    const document = JSON.parse(fs.readFileSync(attestation.manifestPath, 'utf8'));
    document.evidence[0].sha256 = 'sha256:' + '0'.repeat(64);
    fs.writeFileSync(attestation.manifestPath, JSON.stringify(document, null, 2));
    git(repository.root, 'add', DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH);
    git(repository.root, 'commit', '-q', '-m', 'bind incorrect digest');
    const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
    assert.ok(codes(result).has('evidence_sha_mismatch'));
    assert.equal(runCli(repository.root).exitCode, 1);
  });

  await t.test('qualification and independence', () => {
    const repository = makeRepository(t);
    const manifest = completeManifest(repository.reviewedCommit, repository.fixtureIds);
    manifest.reviewer.qualificationEvidenceUrl = 'http://example.org/unverified';
    manifest.reviewer.independenceConfirmed = false;
    manifest.reviewer.independenceStatement = 'Not independent.';
    addAttestation(repository, { manifest });
    const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
    assert.ok(codes(result).has('invalid_reviewer_qualification_evidence'));
    assert.ok(codes(result).has('missing_independence_statement'));
    assert.equal(runCli(repository.root).exitCode, 1);
  });

  await t.test('credential-bearing qualification URL', () => {
    const repository = makeRepository(t);
    const manifest = completeManifest(repository.reviewedCommit, repository.fixtureIds);
    manifest.reviewer.qualificationEvidenceUrl =
      'https://reviewer:secret@example.org/experts/myeongri-reviewer';
    addAttestation(repository, { manifest });
    const result = checkExternalExpertSignoff({ repositoryRoot: repository.root });
    assert.ok(codes(result).has('invalid_reviewer_qualification_evidence'));
    assert.equal(runCli(repository.root).exitCode, 1);
  });
});
