#!/usr/bin/env node
/**
 * tools/service_readiness_report.mjs
 *
 * Combines frontend handoff and commercial-readiness signals into one
 * machine-readable planning report. This is deliberately an observation-mode
 * report by default: it should make launch blockers explicit without turning
 * ongoing content expansion into a hard CI failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAuthorityGapReport } from './narrative_authority_gap_report.mjs';
import { buildReport as buildCoverageReport } from './narrative_coverage_report.mjs';
import {
  DEFAULT_DIR as REFERENCE_AUTHORITY_DIR,
  validateDirectory as validateReferenceAuthorityDirectory,
} from './validate_reference_authority_cases.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    json: false,
    minAuthored: 12,
    maxThinExpertAxisValues: null,
    minAuthorityTruthEligibleFragments: 0,
    minAuthorityTruthEligibleNumericalEvidence: 0,
    maxZeroAuthorityCells: null,
    maxReferenceAuthorityIntakeViolations: null,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--min-authored=')) {
      const value = Number(arg.slice('--min-authored='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthored = value;
    } else if (arg.startsWith('--max-thin-expert-axis-values=')) {
      const value = Number(arg.slice('--max-thin-expert-axis-values='.length));
      if (Number.isInteger(value) && value >= 0) args.maxThinExpertAxisValues = value;
    } else if (arg.startsWith('--min-authority-fragments=')) {
      const value = Number(arg.slice('--min-authority-fragments='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthorityTruthEligibleFragments = value;
    } else if (arg.startsWith('--min-authority-numerical-evidence=')) {
      const value = Number(arg.slice('--min-authority-numerical-evidence='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthorityTruthEligibleNumericalEvidence = value;
    } else if (arg.startsWith('--max-zero-authority-cells=')) {
      const value = Number(arg.slice('--max-zero-authority-cells='.length));
      if (Number.isInteger(value) && value >= 0) args.maxZeroAuthorityCells = value;
    } else if (arg.startsWith('--max-reference-authority-intake-violations=')) {
      const value = Number(arg.slice('--max-reference-authority-intake-violations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxReferenceAuthorityIntakeViolations = value;
    }
  }
  return args;
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function buildFrontendChecklist(coverage) {
  const docs = {
    frontendExtensions: fileExists('FRONTEND_EXTENSIONS.md'),
    tieredMatrixSpec: fileExists(path.join('docs', 'TIERED_MATRIX_SPEC.md')),
    narrativeStyleGuide: fileExists(path.join('docs', 'NARRATIVE_STYLE_GUIDE.md')),
  };
  const tests = {
    progressiveDisclosure: fileExists(path.join('test', 'integration', 'tiered-progressive-disclosure.test.ts')),
  };
  const checks = [
    {
      id: 'tiered_matrix_cells_populated',
      status: coverage.totals.cellsWithFragments === coverage.totals.expectedCells ? 'pass' : 'fail',
      evidence: `${coverage.totals.cellsWithFragments}/${coverage.totals.expectedCells}`,
    },
    {
      id: 'expert_internal_evidence_complete',
      status: coverage.totals.expertCellsWithInternalNumericalEvidenceCount === coverage.totals.expertCellCount
        ? 'pass'
        : 'fail',
      evidence: `${coverage.totals.expertCellsWithInternalNumericalEvidenceCount}/${coverage.totals.expertCellCount}`,
    },
    {
      id: 'documented_frontend_surface',
      status: Object.values(docs).every(Boolean) ? 'pass' : 'fail',
      evidence: Object.entries(docs).map(([key, value]) => `${key}:${value ? 'present' : 'missing'}`).join(','),
    },
    {
      id: 'progressive_disclosure_runtime_contract',
      status: tests.progressiveDisclosure ? 'pass' : 'fail',
      evidence: `progressiveDisclosure:${tests.progressiveDisclosure ? 'present' : 'missing'}`,
    },
    {
      id: 'known_content_density_gaps',
      status: coverage.totals.thinExpertAxisValueCount === 0 ? 'pass' : 'warning',
      evidence: `thinExpertAxisValueCount=${coverage.totals.thinExpertAxisValueCount}`,
    },
  ];
  const hardFailures = checks.filter((check) => check.status === 'fail');
  const densityWarnings = checks.filter((check) => check.status === 'warning');
  return {
    status: hardFailures.length > 0
      ? 'blocked'
      : densityWarnings.length > 0
        ? 'ready_with_known_content_gaps'
        : 'ready_for_frontend_integration',
    docs,
    tests,
    checks,
    nextFrontendSteps: [
      'Enable precisionConfig.surfaceTieredMatrix in a frontend-only branch.',
      'Render brief first, then standard, then expert details behind explicit expansion controls.',
      'Hide expert tags and numerical evidence unless the user opens expert detail.',
      'Use selectedFragments and glossary only for debug, QA, or expert-detail panels.',
    ],
  };
}

function buildCommercialChecklist(coverage, authority, authorityIntake) {
  const blockers = [];
  if (authorityIntake.violationCount > 0) {
    blockers.push({
      id: 'invalid_reference_authority_intake',
      severity: 'blocker',
      message: `${authorityIntake.violationCount} flat Reference A intake violations must be fixed before authority promotion.`,
    });
  }
  if (authority.totals.authorityTruthEligibleFragmentCount === 0) {
    blockers.push({
      id: 'no_authority_truth_fragments',
      severity: 'blocker',
      message: 'No narrative fragment is authority-truth eligible; do not market expert-verified interpretations yet.',
    });
  }
  if (authority.totals.authorityTruthEligibleNumericalEvidenceCount === 0) {
    blockers.push({
      id: 'no_authority_truth_numerical_evidence',
      severity: 'blocker',
      message: 'Expert numerical evidence is internally deterministic but not authority-truth eligible.',
    });
  }
  if (authority.totals.zeroAuthorityCellCount > 0) {
    blockers.push({
      id: 'zero_authority_cells',
      severity: 'blocker',
      message: `${authority.totals.zeroAuthorityCellCount}/${authority.totals.expectedCells} tiered cells have no authority-truth eligible backing.`,
    });
  }
  if (coverage.totals.thinExpertAxisValueCount > 0) {
    blockers.push({
      id: 'thin_expert_axis_values',
      severity: 'warning',
      message: `${coverage.totals.thinExpertAxisValueCount} expert axis values remain below the authored density floor.`,
    });
  }

  const requiredBeforePaidExpertClaims = [
    'Pass validate:reference-authority for every top-level Reference A fixture.',
    'Add Reference A or equivalent reviewed authority fixtures with sourceTier.authorityTruthEligible=true.',
    'Reduce zero-authority tiered cells or gate claims away from authority language.',
    'Run a frontend acceptance pass for brief/standard/expert progressive disclosure.',
  ];
  if (coverage.totals.thinExpertAxisValueCount > 0) {
    requiredBeforePaidExpertClaims.splice(
      2,
      0,
      'Finish remaining expert agePhase density gaps or keep those surfaces explicitly hedged.',
    );
  }

  return {
    status: blockers.some((blocker) => blocker.severity === 'blocker')
      ? 'blocked_for_authority_claims'
      : blockers.length > 0
        ? 'usable_with_content_warnings'
        : 'ready_for_product_review',
    allowedUse: [
      'Frontend integration and internal QA.',
      'User-facing entertainment or reflective reading only after product/legal copy review.',
      'Paid expert-verified claims only after authorityTruthEligible evidence thresholds are met.',
    ],
    blockers,
    requiredBeforePaidExpertClaims,
  };
}

function summarizeThinExpertFields(coverage) {
  return (coverage.thinExpertAxisFieldSummary ?? []).map((row) => ({
    field: row.field,
    thinValueCount: row.thinValueCount,
    authoredDeficitToThreshold: row.authoredDeficitToThreshold,
  }));
}

function summarizeAuthorityIntake(authorityIntake) {
  return {
    status: authorityIntake.status,
    directory: authorityIntake.directory,
    flatCaseCount: authorityIntake.flatCaseCount,
    authorityTruthEligibleCaseCount: authorityIntake.authorityTruthEligibleCaseCount,
    violationCount: authorityIntake.violationCount,
    violations: authorityIntake.violations.slice(0, 10).map((violation) => ({
      file: violation.file,
      code: violation.code,
      path: violation.path,
      message: violation.message,
    })),
  };
}

function buildReport(options = {}) {
  const minAuthored = options.minAuthored ?? 12;
  const coverage = buildCoverageReport({
    minAuthored,
    maxThinExpertAxisValues: options.maxThinExpertAxisValues ?? null,
    minAuthorityTruthEligibleFragments: options.minAuthorityTruthEligibleFragments ?? 0,
    minAuthorityTruthEligibleNumericalEvidence: options.minAuthorityTruthEligibleNumericalEvidence ?? 0,
  });
  const authority = buildAuthorityGapReport({
    minAuthored,
    maxTopCells: 5,
    minAuthorityTruthEligibleFragments: options.minAuthorityTruthEligibleFragments ?? 0,
    minAuthorityTruthEligibleNumericalEvidence: options.minAuthorityTruthEligibleNumericalEvidence ?? 0,
    maxZeroAuthorityCells: options.maxZeroAuthorityCells ?? null,
  });
  const authorityIntake = validateReferenceAuthorityDirectory(REFERENCE_AUTHORITY_DIR, true);
  return {
    schemaVersion: 'spring-ts.service-readiness-report.v1',
    generatedAt: new Date().toISOString(),
    minAuthoredThreshold: minAuthored,
    thresholds: {
      maxThinExpertAxisValues: options.maxThinExpertAxisValues ?? null,
      minAuthorityTruthEligibleFragments: options.minAuthorityTruthEligibleFragments ?? 0,
      minAuthorityTruthEligibleNumericalEvidence: options.minAuthorityTruthEligibleNumericalEvidence ?? 0,
      maxZeroAuthorityCells: options.maxZeroAuthorityCells ?? null,
      maxReferenceAuthorityIntakeViolations: options.maxReferenceAuthorityIntakeViolations ?? null,
    },
    frontendHandoff: buildFrontendChecklist(coverage),
    commercialReadiness: buildCommercialChecklist(coverage, authority, authorityIntake),
    authorityIntake: summarizeAuthorityIntake(authorityIntake),
    metrics: {
      bundleCount: coverage.totals.bundleCount,
      fragmentCount: coverage.totals.fragmentCount,
      authoredFragmentCount: coverage.totals.authoredFragmentCount,
      expectedCells: coverage.totals.expectedCells,
      populatedCells: coverage.totals.cellsWithFragments,
      expertCellCount: coverage.totals.expertCellCount,
      expertInternalEvidenceBackedCells: coverage.totals.expertCellsWithInternalNumericalEvidenceCount,
      thinExpertAxisValueCount: coverage.totals.thinExpertAxisValueCount,
      thinExpertAxisFieldSummary: summarizeThinExpertFields(coverage),
      authorityTruthEligibleFragmentCount: authority.totals.authorityTruthEligibleFragmentCount,
      authorityTruthEligibleNumericalEvidenceCount: authority.totals.authorityTruthEligibleNumericalEvidenceCount,
      zeroAuthorityCellCount: authority.totals.zeroAuthorityCellCount,
      internalNumericalEvidenceRecordCount: authority.totals.internalNumericalEvidenceRecordCount,
      referenceAuthorityFlatCaseCount: authorityIntake.flatCaseCount,
      referenceAuthorityIntakeViolationCount: authorityIntake.violationCount,
    },
    nextDensityTargets: (coverage.thinExpertAxisValues ?? []).slice(0, 20),
    nextAuthorityWork: (authority.authorityWorkBacklog ?? []).slice(0, 5),
  };
}

function getThresholdFailures(report) {
  const failures = [];
  const thresholds = report.thresholds ?? {};
  if (
    thresholds.maxThinExpertAxisValues !== null &&
    report.metrics.thinExpertAxisValueCount > thresholds.maxThinExpertAxisValues
  ) {
    failures.push(`thin expert axis values ${report.metrics.thinExpertAxisValueCount}/${thresholds.maxThinExpertAxisValues}`);
  }
  if (report.metrics.authorityTruthEligibleFragmentCount < thresholds.minAuthorityTruthEligibleFragments) {
    failures.push(`authorityTruthEligible fragments ${report.metrics.authorityTruthEligibleFragmentCount}/${thresholds.minAuthorityTruthEligibleFragments}`);
  }
  if (report.metrics.authorityTruthEligibleNumericalEvidenceCount < thresholds.minAuthorityTruthEligibleNumericalEvidence) {
    failures.push(`authorityTruthEligible numericalEvidence ${report.metrics.authorityTruthEligibleNumericalEvidenceCount}/${thresholds.minAuthorityTruthEligibleNumericalEvidence}`);
  }
  if (
    thresholds.maxZeroAuthorityCells !== null &&
    report.metrics.zeroAuthorityCellCount > thresholds.maxZeroAuthorityCells
  ) {
    failures.push(`zero-authority cells ${report.metrics.zeroAuthorityCellCount}/${thresholds.maxZeroAuthorityCells}`);
  }
  if (
    thresholds.maxReferenceAuthorityIntakeViolations !== null &&
    report.metrics.referenceAuthorityIntakeViolationCount > thresholds.maxReferenceAuthorityIntakeViolations
  ) {
    failures.push(`reference authority intake violations ${report.metrics.referenceAuthorityIntakeViolationCount}/${thresholds.maxReferenceAuthorityIntakeViolations}`);
  }
  return failures;
}

function renderHuman(report) {
  const lines = [];
  lines.push('Spring TS Service Readiness Report');
  lines.push(`Frontend handoff: ${report.frontendHandoff.status}`);
  lines.push(`Commercial readiness: ${report.commercialReadiness.status}`);
  lines.push(`Fragments: ${report.metrics.fragmentCount} total, ${report.metrics.authoredFragmentCount} authored`);
  lines.push(`Cells populated: ${report.metrics.populatedCells}/${report.metrics.expectedCells}`);
  lines.push(`Expert internal evidence cells: ${report.metrics.expertInternalEvidenceBackedCells}/${report.metrics.expertCellCount}`);
  lines.push(`Thin expert axis values: ${report.metrics.thinExpertAxisValueCount}`);
  for (const row of report.metrics.thinExpertAxisFieldSummary) {
    lines.push(`- ${row.field}: thinValues=${row.thinValueCount}, deficit=${row.authoredDeficitToThreshold}`);
  }
  lines.push(`Authority-truth eligible fragments: ${report.metrics.authorityTruthEligibleFragmentCount}`);
  lines.push(`Authority-truth eligible numericalEvidence: ${report.metrics.authorityTruthEligibleNumericalEvidenceCount}`);
  lines.push(`Zero-authority cells: ${report.metrics.zeroAuthorityCellCount}/${report.metrics.expectedCells}`);
  lines.push(`Reference authority intake: ${report.authorityIntake.status} (${report.authorityIntake.flatCaseCount} flat cases, ${report.authorityIntake.violationCount} violations)`);
  if (report.authorityIntake.violations.length > 0) {
    for (const violation of report.authorityIntake.violations.slice(0, 5)) {
      lines.push(`- ${violation.file} ${violation.path}: ${violation.code}`);
    }
  }
  if (report.commercialReadiness.blockers.length > 0) {
    lines.push('');
    lines.push('Commercial blockers and warnings:');
    for (const blocker of report.commercialReadiness.blockers) {
      lines.push(`- ${blocker.severity}: ${blocker.id} — ${blocker.message}`);
    }
  }
  if (report.nextDensityTargets.length > 0) {
    lines.push('');
    lines.push('Next density targets:');
    for (const target of report.nextDensityTargets.slice(0, 10)) {
      lines.push(`- ${target.field}=${target.value}: authored=${target.authoredFragments}`);
    }
  }
  if (report.nextAuthorityWork.length > 0) {
    lines.push('');
    lines.push('Next authority work:');
    for (const item of report.nextAuthorityWork.slice(0, 5)) {
      lines.push(`- ${item.priorityClass} ${item.category}/${item.period}/${item.depth}: ${item.neededEvidence.join(',')}`);
      for (const example of (item.reviewExamples ?? []).slice(0, 2)) {
        lines.push(`  example: ${example.fragmentId} (${example.file})`);
      }
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport(args);
  const thresholdFailures = getThresholdFailures(report);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
  if (thresholdFailures.length > 0) {
    console.error(`Service readiness thresholds failed:\n- ${thresholdFailures.join('\n- ')}`);
    process.exit(1);
  }
}

export { buildReport, getThresholdFailures, renderHuman };
