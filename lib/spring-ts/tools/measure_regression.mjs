/**
 * Exact snapshot diff gate.
 *
 * Intentional default-output changes remain blocked until the exact diff
 * fingerprint is approved in test/baseline/default-change-approvals.json.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildApprovalSubject,
  buildSnapshotDiff,
  fingerprintApprovalImpact,
  loadApprovalManifestForEvaluation,
  readSnapshotAtRef,
  resolveDiffApproval,
  verifyAttestationOnly,
  verifyManifestEvidenceAtRef,
} from './snapshot_diff_approval.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const SNAPSHOT_REL_PATH = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json';

export function parseArgs(argv) {
  const args = {
    baseline: 'main',
    branch: 'HEAD',
    json: false,
    approvalManifest: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--baseline') args.baseline = argv[i + 1];
    else if (argv[i] === '--branch') args.branch = argv[i + 1];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--approval-manifest') args.approvalManifest = argv[i + 1];
  }
  return args;
}

function loadSnapshots(args) {
  try {
    return {
      baseline: readSnapshotAtRef(args.baseline, {
        repoRoot: REPO_ROOT,
        snapshotRelPath: SNAPSHOT_REL_PATH,
      }),
      current: readSnapshotAtRef(args.branch, {
        repoRoot: REPO_ROOT,
        snapshotRelPath: SNAPSHOT_REL_PATH,
      }),
    };
  } catch (error) {
    const wrapped = new Error(
      `Cannot read snapshot refs ${args.baseline} / ${args.branch}: ${error.message.split('\n')[0]}`,
    );
    wrapped.exitCode = 2;
    throw wrapped;
  }
}

function hasStructuralRemoval(baseline, current) {
  if (baseline === null || typeof baseline !== 'object') return false;
  if (current === null || typeof current !== 'object') return true;
  if (Array.isArray(baseline)) {
    if (!Array.isArray(current) || current.length < baseline.length) return true;
    return baseline.some((value, index) => hasStructuralRemoval(value, current[index]));
  }
  if (Array.isArray(current)) return true;
  return Object.keys(baseline).some(
    (key) => !Object.prototype.hasOwnProperty.call(current, key)
      || hasStructuralRemoval(baseline[key], current[key]),
  );
}

export function buildRegressionReport(
  baselineSnapshot,
  currentSnapshot,
  approvalManifest,
  { approvalSubject = null, approvalAttestation = null } = {},
) {
  const diffs = buildSnapshotDiff(baselineSnapshot, currentSnapshot);
  const approval = resolveDiffApproval(
    diffs,
    approvalManifest,
    approvalSubject,
    approvalAttestation,
  );
  const structuralRegression = hasStructuralRemoval(baselineSnapshot, currentSnapshot);
  const approved = diffs.length > 0
    && approval.status === 'APPROVED'
    && !structuralRegression;
  const passed = structuralRegression
    ? false
    : diffs.length === 0
      ? approval.status === 'NOT_REQUIRED'
      : approved;
  return {
    totalDiffs: diffs.length,
    unapprovedDiffs: approved ? 0 : diffs.length,
    structuralRegression,
    passed,
    approval,
    diffs,
  };
}

function formatValue(value) {
  const json = value === undefined ? '<undefined>' : JSON.stringify(value);
  return json.length > 100 ? `${json.substring(0, 97)}...` : json;
}

function renderHuman(report, args, approvalManifestPath, fixtureCount) {
  if (report.totalDiffs === 0) {
    const lines = [
      `Default-mode regression: 0 diffs across ${fixtureCount} fixtures (baseline exact)`,
      `Approval registry: ${report.approval.status}`,
    ];
    lines.push(report.passed ? 'PASS' : 'FAIL - approval registry is not release-ready');
    return lines.join('\n');
  }
  if (report.approval.status === 'APPROVED') {
    return [
      `Default-mode change: ${report.totalDiffs} fixture(s) differ from ${args.baseline}.`,
      `Approval: APPROVED (${report.approval.fingerprint})`,
      `Reviewer: ${report.approval.reviewedBy} at ${report.approval.reviewedAt}`,
      'PASS',
    ].join('\n');
  }

  const lines = [];
  let fieldDiffCount = 0;
  for (const fixture of report.diffs) fieldDiffCount += fixture.diffs.length;
  lines.push(
    `Default-mode regression: ${report.totalDiffs} fixture(s), ${fieldDiffCount} field diff(s):`,
  );
  for (const fixture of report.diffs) {
    lines.push('', `  ${fixture.fixture} - ${fixture.label ?? ''}`);
    for (const diff of fixture.diffs) {
      lines.push(
        `    ${diff.path}`,
        `      baseline: ${formatValue(diff.baseline)}`,
        `      current:  ${formatValue(diff.current)}`,
      );
    }
  }
  lines.push(
    '',
    `FAIL - ${report.totalDiffs} fixture(s) diverged from ${args.baseline}.`,
    `Approval: ${report.approval.status} (${report.approval.fingerprint}).`,
    'Intentional changes require an exact fingerprint match plus reviewer, date, and evidence in',
    approvalManifestPath,
  );
  return lines.join('\n');
}

export function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  let snapshots;
  let manifestLoad;
  let approvalSubject;
  let approvalAttestation;
  let manifestEvidence;
  try {
    snapshots = loadSnapshots(args);
    manifestLoad = loadApprovalManifestForEvaluation({
      repoRoot: REPO_ROOT,
      branchRef: args.branch,
      requestedPath: args.approvalManifest,
    });
    const allEvidence = manifestLoad.manifest.approvals.flatMap((candidate) => [
      ...(Array.isArray(candidate?.evidence) ? candidate.evidence : []),
      ...(Array.isArray(candidate?.supersessionEvidence)
        ? candidate.supersessionEvidence
        : []),
    ]);
    manifestEvidence = verifyManifestEvidenceAtRef({
      repoRoot: REPO_ROOT,
      evaluatedRef: args.branch,
      evidence: allEvidence,
    });
    if (!manifestEvidence.valid) throw new Error(manifestEvidence.errors.join('; '));
    const exactDiffs = buildSnapshotDiff(
      snapshots.baseline,
      snapshots.current,
    );
    const observedSubject = buildApprovalSubject({
      repoRoot: REPO_ROOT,
      baselineRef: args.baseline,
      branchRef: args.branch,
      exactDiffs,
    });
    const fingerprint = fingerprintApprovalImpact(exactDiffs, observedSubject);
    const entry = manifestLoad.manifest?.approvals?.find(
      (candidate) => candidate?.fingerprint === fingerprint && candidate?.status === 'approved',
    );
    if (entry?.subject?.reviewedCommit) {
      approvalSubject = buildApprovalSubject({
        repoRoot: REPO_ROOT,
        baselineRef: args.baseline,
        branchRef: args.branch,
        reviewedRef: entry.subject.reviewedCommit,
        exactDiffs,
      });
      approvalAttestation = verifyAttestationOnly({
        repoRoot: REPO_ROOT,
        baselineRef: args.baseline,
        reviewedRef: entry.subject.reviewedCommit,
        evaluatedRef: args.branch,
        evidence: allEvidence,
      });
    } else {
      approvalSubject = observedSubject;
      approvalAttestation = null;
    }
  } catch (error) {
    console.error(error.message);
    return error.exitCode ?? 2;
  }

  const report = buildRegressionReport(
    snapshots.baseline,
    snapshots.current,
    manifestLoad.manifest,
    { approvalSubject, approvalAttestation },
  );
  const rendered = {
    ...report,
    baselineRef: args.baseline,
    branchRef: args.branch,
    approvalManifest: manifestLoad.metadata,
    approvalSubject,
    approvalAttestation,
    manifestEvidence,
  };
  if (args.json) console.log(JSON.stringify(rendered, null, 2));
  else console.log(renderHuman(
    report,
    args,
    manifestLoad.metadata.path,
    snapshots.baseline.fixtureCount ?? snapshots.baseline.results?.length ?? 0,
  ));
  return report.passed && manifestLoad.metadata.authoritative ? 0 : 1;
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) process.exit(runCli());
