/**
 * Exact snapshot diff gate.
 *
 * Intentional default-output changes remain blocked until the exact diff
 * fingerprint is approved in test/baseline/default-change-approvals.json.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSnapshotDiff,
  loadApprovalManifest,
  readSnapshotAtRef,
  resolveManifestPath,
} from './snapshot_diff_approval.mjs';
import { runMeasure } from './measure_default_change.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const SNAPSHOT_REL_PATH = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json';
const DEFAULT_APPROVAL_MANIFEST = path.resolve(
  SPRING_TS_ROOT,
  'test/baseline/default-change-approvals.json',
);

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

export function buildRegressionReport(baselineSnapshot, currentSnapshot, approvalManifest) {
  const diffs = buildSnapshotDiff(baselineSnapshot, currentSnapshot);
  const measure = runMeasure(baselineSnapshot, currentSnapshot, approvalManifest);
  const approval = measure.approval;
  const structuralRegression = measure.rawOverall === 'REGRESSION';
  const approved = diffs.length > 0 && approval.status === 'APPROVED' && !structuralRegression;
  const releaseBlocked = measure.overall === 'RELEASE_BLOCKED';
  const passed = ['UNCHANGED', 'APPROVED_CHANGE'].includes(measure.overall);
  return {
    totalDiffs: diffs.length,
    unapprovedDiffs: approved ? 0 : diffs.length,
    approved,
    structuralRegression,
    releaseBlocked,
    passed,
    overall: measure.overall,
    rawOverall: measure.rawOverall,
    approval,
    diffs,
  };
}

function formatValue(value) {
  const json = value === undefined ? '<undefined>' : JSON.stringify(value);
  return json.length > 100 ? `${json.substring(0, 97)}...` : json;
}

function renderHuman(report, args, approvalManifestPath, fixtureCount) {
  if (report.releaseBlocked && !report.structuralRegression) {
    return [
      `Release readiness: ${report.approval.status}`,
      `Default-mode exact diffs: ${report.totalDiffs} across ${fixtureCount} fixtures`,
      ...report.approval.errors.map((error) => `- ${error}`),
      'FAIL - release blockers and manifest integrity are evaluated even when the exact diff is empty.',
      'Resolve the canonical release blocker registry before treating this gate as passing.',
      approvalManifestPath,
    ].join('\n');
  }

  if (report.totalDiffs === 0) {
    return [
      `Default-mode regression: 0 diffs across ${fixtureCount} fixtures (baseline exact)`,
      'PASS',
    ].join('\n');
  }
  if (report.approved) {
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
  const approvalManifestPath = resolveManifestPath(
    args.approvalManifest,
    DEFAULT_APPROVAL_MANIFEST,
  );
  let snapshots;
  let manifest;
  try {
    snapshots = loadSnapshots(args);
    manifest = loadApprovalManifest(approvalManifestPath);
  } catch (error) {
    console.error(error.message);
    return error.exitCode ?? 2;
  }

  const report = buildRegressionReport(snapshots.baseline, snapshots.current, manifest);
  const rendered = {
    ...report,
    baselineRef: args.baseline,
    branchRef: args.branch,
    approvalManifestPath,
  };
  if (args.json) console.log(JSON.stringify(rendered, null, 2));
  else console.log(renderHuman(
    report,
    args,
    approvalManifestPath,
    snapshots.baseline.fixtureCount ?? snapshots.baseline.results?.length ?? 0,
  ));
  return report.passed ? 0 : 1;
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) process.exit(runCli());
