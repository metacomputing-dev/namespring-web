/**
 * Fail-closed default-output change classifier.
 *
 * Engine-produced score movement and added output are direction-unknown.
 * They require an exact diff approval backed by reviewer/date/evidence.
 * Structural field deletion is always a regression and cannot be waived.
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
} from './snapshot_diff_approval.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const SNAPSHOT_REL_PATH = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json';
const EPS_TOTAL_SCORE = 0.5;
const EPS_INDIVIDUAL_SCORE = 0.5;

export function parseArgs(argv) {
  const args = {
    baseline: 'main',
    branch: 'HEAD',
    json: false,
    verbose: false,
    approvalManifest: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--baseline') args.baseline = argv[i + 1];
    else if (argv[i] === '--branch') args.branch = argv[i + 1];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--verbose') args.verbose = true;
    else if (argv[i] === '--approval-manifest') args.approvalManifest = argv[i + 1];
  }
  return args;
}

function summarizeDimensionChecks(checks) {
  if (checks.length === 0) return { verdict: 'unchanged', checks: [] };
  if (checks.some((check) => check.verdict === 'regression')) {
    return { verdict: 'regression', checks };
  }
  if (checks.some((check) => check.verdict === 'review_required')) {
    return { verdict: 'review_required', checks };
  }
  return { verdict: 'unchanged', checks };
}

function compareNumeric(field, baseline, branch, epsilon) {
  const baselineFinite = Number.isFinite(baseline);
  const branchFinite = Number.isFinite(branch);
  if (baselineFinite && !branchFinite) {
    return { field, baseline, branch, delta: null, verdict: 'regression', reason: 'field removed or non-finite' };
  }
  if (!baselineFinite && branchFinite) {
    return { field, baseline, branch, delta: null, verdict: 'review_required', reason: 'new score has no authority direction' };
  }
  if (!baselineFinite && !branchFinite) {
    if (baseline === branch) return null;
    return { field, baseline, branch, delta: null, verdict: 'review_required', reason: 'non-numeric shape changed' };
  }
  const delta = branch - baseline;
  return {
    field,
    baseline,
    branch,
    delta,
    verdict: Math.abs(delta) <= epsilon ? 'unchanged' : 'review_required',
  };
}

export function collectDroppedPaths(baseline, branch, prefix = '') {
  if (baseline === null || typeof baseline !== 'object') return [];
  if (branch === null || typeof branch !== 'object') return [prefix || '<root>'];
  if (Array.isArray(baseline)) {
    if (!Array.isArray(branch)) return [prefix || '<root>'];
    const dropped = [];
    for (let i = branch.length; i < baseline.length; i += 1) {
      dropped.push(`${prefix}[${i}]`);
    }
    for (let i = 0; i < Math.min(baseline.length, branch.length); i += 1) {
      dropped.push(...collectDroppedPaths(baseline[i], branch[i], `${prefix}[${i}]`));
    }
    return dropped;
  }
  if (Array.isArray(branch)) return [prefix || '<root>'];
  const dropped = [];
  for (const key of Object.keys(baseline)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (!Object.prototype.hasOwnProperty.call(branch, key)) {
      dropped.push(childPath);
    } else {
      dropped.push(...collectDroppedPaths(baseline[key], branch[key], childPath));
    }
  }
  return dropped;
}

export function classifyFixtureDiff(baseFix, branchFix) {
  if (!baseFix && branchFix) {
    return {
      type: 'review_required',
      fixtureId: branchFix.id,
      label: branchFix.label,
      dimensions: {},
      reason: 'new fixture requires review and exact diff approval',
    };
  }
  if (baseFix && !branchFix) {
    return {
      type: 'missing',
      fixtureId: baseFix.id,
      label: baseFix.label,
      dimensions: {},
      reason: 'fixture removed',
    };
  }

  const baseOut = baseFix?.output ?? {};
  const branchOut = branchFix?.output ?? {};
  const dimensions = {};
  const d1Checks = [];
  const numericFields = [
    ['namingReport.totalScore', baseOut.namingReport?.totalScore, branchOut.namingReport?.totalScore, EPS_TOTAL_SCORE],
    ['namingReport.scores.hangul', baseOut.namingReport?.scores?.hangul, branchOut.namingReport?.scores?.hangul, EPS_INDIVIDUAL_SCORE],
    ['namingReport.scores.hanja', baseOut.namingReport?.scores?.hanja, branchOut.namingReport?.scores?.hanja, EPS_INDIVIDUAL_SCORE],
    ['namingReport.scores.fourFrame', baseOut.namingReport?.scores?.fourFrame, branchOut.namingReport?.scores?.fourFrame, EPS_INDIVIDUAL_SCORE],
  ];
  for (const args of numericFields) {
    const check = compareNumeric(...args);
    if (check) d1Checks.push(check);
  }
  for (const key of ['gyeokgukType', 'yongshinElement', 'strengthLevel']) {
    const baseline = baseOut.sajuReport?.[key];
    const branch = branchOut.sajuReport?.[key];
    if (baseline !== branch) {
      d1Checks.push({
        field: `sajuReport.${key}`,
        baseline,
        branch,
        delta: null,
        verdict: branch === undefined ? 'regression' : 'review_required',
      });
    }
  }
  dimensions.D1 = summarizeDimensionChecks(d1Checks);

  const baselineCards = new Set(Object.keys(baseOut.fortuneReport ?? {}));
  const branchCards = new Set(Object.keys(branchOut.fortuneReport ?? {}));
  const droppedCards = [...baselineCards].filter((card) => !branchCards.has(card));
  const addedCards = [...branchCards].filter((card) => !baselineCards.has(card));
  dimensions.D3 = {
    verdict: droppedCards.length > 0
      ? 'regression'
      : addedCards.length > 0
        ? 'review_required'
        : 'unchanged',
    droppedCards,
    addedCards,
    baseCount: baselineCards.size,
    branchCount: branchCards.size,
  };

  const d5Checks = collectDroppedPaths(baseOut, branchOut).map((field) => ({
    field,
    baseline: 'present',
    branch: 'absent',
    verdict: 'regression',
  }));
  if (baseOut.sajuReport?.sajuEnabled === true && branchOut.sajuReport?.sajuEnabled !== true) {
    d5Checks.push({
      field: 'sajuReport.sajuEnabled',
      baseline: true,
      branch: branchOut.sajuReport?.sajuEnabled,
      verdict: 'regression',
    });
  }
  dimensions.D5 = summarizeDimensionChecks(d5Checks);

  const verdicts = Object.values(dimensions).map((dimension) => dimension.verdict);
  const type = verdicts.includes('regression')
    ? 'regression'
    : verdicts.includes('review_required')
      ? 'review_required'
      : 'unchanged';
  return {
    type,
    fixtureId: baseFix.id,
    label: baseFix.label,
    dimensions,
  };
}

export function runMeasure(baselineSnapshot, branchSnapshot, approvalManifest, refs = {}) {
  const baselineResults = Array.isArray(baselineSnapshot?.results) ? baselineSnapshot.results : [];
  const branchResults = Array.isArray(branchSnapshot?.results) ? branchSnapshot.results : [];
  const baselineById = new Map(baselineResults.map((row) => [row.id, row]));
  const branchById = new Map(branchResults.map((row) => [row.id, row]));
  const ids = [...new Set([...baselineById.keys(), ...branchById.keys()])].sort();
  const fixtures = ids.map((id) => classifyFixtureDiff(baselineById.get(id), branchById.get(id)));
  const totals = {
    reviewRequired: fixtures.filter((row) => row.type === 'review_required').length,
    regression: fixtures.filter((row) => row.type === 'regression').length,
    unchanged: fixtures.filter((row) => row.type === 'unchanged').length,
    added: fixtures.filter((row) => !baselineById.has(row.fixtureId)).length,
    missing: fixtures.filter((row) => !branchById.has(row.fixtureId)).length,
  };
  const exactDiffs = buildSnapshotDiff(baselineSnapshot, branchSnapshot);
  const approval = resolveDiffApproval(
    exactDiffs,
    approvalManifest,
    refs.approvalSubject ?? null,
    refs.approvalAttestation ?? null,
  );

  let rawOverall;
  if (totals.regression > 0 || totals.missing > 0) rawOverall = 'REGRESSION';
  else if (totals.reviewRequired > 0 || approval.impactChanged) rawOverall = 'REVIEW_REQUIRED';
  else rawOverall = 'UNCHANGED';
  const approvalBlocked = [
    'MANIFEST_INVALID',
    'REGISTRY_PENDING',
    'SUBJECT_MISMATCH',
    'ATTESTATION_INVALID',
  ]
    .includes(approval.status);
  const overall = rawOverall === 'REGRESSION'
    ? 'REGRESSION'
    : approvalBlocked
      ? 'DEFAULT_CHANGE_BLOCKED'
      : rawOverall === 'REVIEW_REQUIRED' && approval.status === 'APPROVED'
        ? 'APPROVED_CHANGE'
        : rawOverall;

  const dimensions = {};
  for (const dimension of ['D1', 'D3', 'D5']) {
    const verdicts = fixtures.map((row) => row.dimensions?.[dimension]?.verdict).filter(Boolean);
    dimensions[dimension] = {
      reviewRequired: verdicts.filter((value) => value === 'review_required').length,
      regression: verdicts.filter((value) => value === 'regression').length,
      unchanged: verdicts.filter((value) => value === 'unchanged').length,
    };
  }

  return {
    overall,
    rawOverall,
    baselineRef: refs.baseline ?? null,
    branchRef: refs.branch ?? null,
    totals,
    dimensions,
    approval,
    exactDiffCount: exactDiffs.length,
    fixtures,
  };
}

function renderHuman(report, verbose) {
  const lines = [
    `Default Change Report (${report.baselineRef} -> ${report.branchRef})`,
    `Overall: ${report.overall}`,
    `Raw classification: ${report.rawOverall}`,
    `Approval: ${report.approval.status} (${report.approval.fingerprint})`,
    `Approval manifest: ${report.approvalManifest?.source ?? 'unknown'} (${report.approvalManifest?.sha256 ?? 'unknown'})`,
    `Fixtures: ${report.totals.reviewRequired} review required / ${report.totals.regression} regression / ${report.totals.unchanged} unchanged`,
  ];
  if (report.totals.added) lines.push(`Added fixtures: ${report.totals.added}`);
  if (report.totals.missing) lines.push(`Missing fixtures: ${report.totals.missing}`);
  if (verbose) {
    for (const fixture of report.fixtures) {
      if (fixture.type === 'unchanged') continue;
      lines.push(`  ${fixture.fixtureId}: ${fixture.type}`);
      for (const [dimension, result] of Object.entries(fixture.dimensions ?? {})) {
        if (result.verdict !== 'unchanged') lines.push(`    ${dimension}: ${result.verdict}`);
      }
    }
  }
  return lines.join('\n');
}

export function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  let baseline;
  let branch;
  let manifestLoad;
  let approvalSubject;
  let approvalAttestation;
  try {
    baseline = readSnapshotAtRef(args.baseline, { repoRoot: REPO_ROOT, snapshotRelPath: SNAPSHOT_REL_PATH });
    branch = readSnapshotAtRef(args.branch, { repoRoot: REPO_ROOT, snapshotRelPath: SNAPSHOT_REL_PATH });
    manifestLoad = loadApprovalManifestForEvaluation({
      repoRoot: REPO_ROOT,
      branchRef: args.branch,
      requestedPath: args.approvalManifest,
    });
    const exactDiffs = buildSnapshotDiff(baseline, branch);
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
        evidence: manifestLoad.manifest.approvals.flatMap((candidate) => [
          ...(Array.isArray(candidate?.evidence) ? candidate.evidence : []),
          ...(Array.isArray(candidate?.supersessionEvidence)
            ? candidate.supersessionEvidence
            : []),
        ]),
      });
    } else {
      approvalSubject = observedSubject;
      approvalAttestation = null;
    }
  } catch (error) {
    console.error(`Cannot read refs or approval manifest: ${error.message.split('\n')[0]}`);
    return 2;
  }
  const report = {
    ...runMeasure(baseline, branch, manifestLoad.manifest, {
      ...args,
      approvalSubject,
      approvalAttestation,
    }),
    approvalManifest: manifestLoad.metadata,
    approvalSubject,
    approvalAttestation,
  };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(renderHuman(report, args.verbose));
  return manifestLoad.metadata.authoritative
    && ['UNCHANGED', 'APPROVED_CHANGE'].includes(report.overall)
    ? 0
    : 1;
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) process.exit(runCli());
