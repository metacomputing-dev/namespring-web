#!/usr/bin/env node
/**
 * tools/narrative_authority_gap_report.mjs
 *
 * Turns source-tier metadata in the tiered narrative corpus into a focused
 * planning report for authority-backed evidence expansion.
 */
import { pathToFileURL } from 'node:url';
import { buildReport as buildCoverageReport } from './narrative_coverage_report.mjs';

function parseArgs(argv) {
  const args = {
    json: false,
    maxTopCells: 20,
    minAuthored: 15,
    minAuthorityTruthEligibleFragments: 0,
    minAuthorityTruthEligibleNumericalEvidence: 0,
    maxZeroAuthorityCells: null,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-top-cells=')) {
      const value = Number(arg.slice('--max-top-cells='.length));
      if (Number.isInteger(value) && value >= 0) args.maxTopCells = value;
    } else if (arg.startsWith('--min-authored=')) {
      const value = Number(arg.slice('--min-authored='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthored = value;
    } else if (arg.startsWith('--min-authority-fragments=')) {
      const value = Number(arg.slice('--min-authority-fragments='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthorityTruthEligibleFragments = value;
    } else if (arg.startsWith('--min-authority-numerical-evidence=')) {
      const value = Number(arg.slice('--min-authority-numerical-evidence='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthorityTruthEligibleNumericalEvidence = value;
    } else if (arg.startsWith('--max-zero-authority-cells=')) {
      const value = Number(arg.slice('--max-zero-authority-cells='.length));
      if (Number.isInteger(value) && value >= 0) args.maxZeroAuthorityCells = value;
    }
  }
  return args;
}

function cellAuthorityCount(cell) {
  return (cell.authorityTruthEligibleFragments ?? 0) +
    (cell.authorityTruthEligibleNumericalEvidenceRecords ?? 0);
}

function cellHasInternalEvidence(cell) {
  return (cell.internalNumericalEvidenceRecords ?? 0) > 0 ||
    (cell.expertInternalNumericalEvidenceFragments ?? 0) > 0;
}

function cellInternalEvidencePriority(cell) {
  return cell.internalNumericalEvidenceRecords ?? 0;
}

function cellPriority(cell) {
  let priority = cell.authoredFragments ?? 0;
  if (cell.depth === 'expert') priority += 1000;
  if ((cell.expertNumericalEvidenceFragments ?? 0) > 0) priority += 500;
  return priority;
}

function compactCell(cell) {
  return {
    category: cell.category,
    period: cell.period,
    depth: cell.depth,
    authoredFragments: cell.authoredFragments ?? 0,
    placeholderFragments: cell.placeholderFragments ?? 0,
    expertNumericalEvidenceFragments: cell.expertNumericalEvidenceFragments ?? 0,
    expertInternalNumericalEvidenceFragments: cell.expertInternalNumericalEvidenceFragments ?? 0,
    internalNumericalEvidenceRecords: cell.internalNumericalEvidenceRecords ?? 0,
    authorityTruthEligibleFragments: cell.authorityTruthEligibleFragments ?? 0,
    authorityTruthEligibleNumericalEvidenceRecords: cell.authorityTruthEligibleNumericalEvidenceRecords ?? 0,
  };
}

function authorityBacklogPriority(cell) {
  if (cell.depth === 'expert' && cellHasInternalEvidence(cell)) return 0;
  if (cell.depth === 'expert') return 1;
  if (cell.depth === 'standard') return 2;
  return 3;
}

function authorityBacklogClass(cell) {
  if (cell.depth === 'expert' && cellHasInternalEvidence(cell)) {
    return 'P0_EXPERT_INTERNAL_EVIDENCE_REVIEW';
  }
  if (cell.depth === 'expert') return 'P1_EXPERT_FRAGMENT_SOURCE_REVIEW';
  if (cell.depth === 'standard') return 'P2_STANDARD_FRAGMENT_SOURCE_REVIEW';
  return 'P3_BRIEF_FRAGMENT_SOURCE_REVIEW';
}

function authorityBacklogNeededEvidence(cell) {
  const needs = ['authority_fragment_source'];
  if (cell.depth === 'expert') {
    needs.push('authority_numerical_evidence_review');
  }
  return needs;
}

function authorityBacklogFirstAction(cell) {
  if (cell.depth === 'expert' && cellHasInternalEvidence(cell)) {
    return 'Attach a reviewed authority source to the expert interpretation and review the deterministic numericalEvidence before promoting authority truth.';
  }
  if (cell.depth === 'expert') {
    return 'Attach a reviewed authority source to the expert interpretation before considering authority-truth promotion.';
  }
  return 'Attach a reviewed authority source to representative display copy before using authority-backed product language.';
}

function buildAuthorityWorkBacklog(cells, maxTopCells) {
  return cells
    .filter((cell) => (cell.authoredFragments ?? 0) > 0 && cellAuthorityCount(cell) === 0)
    .sort((a, b) =>
      authorityBacklogPriority(a) - authorityBacklogPriority(b) ||
      cellPriority(b) - cellPriority(a) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.period).localeCompare(String(b.period)) ||
      String(a.depth).localeCompare(String(b.depth)))
    .slice(0, maxTopCells)
    .map((cell) => ({
      priorityClass: authorityBacklogClass(cell),
      category: cell.category,
      period: cell.period,
      depth: cell.depth,
      authoredFragments: cell.authoredFragments ?? 0,
      internalNumericalEvidenceRecords: cell.internalNumericalEvidenceRecords ?? 0,
      expertInternalNumericalEvidenceFragments: cell.expertInternalNumericalEvidenceFragments ?? 0,
      neededEvidence: authorityBacklogNeededEvidence(cell),
      firstAction: authorityBacklogFirstAction(cell),
      reviewExamples: (cell.reviewExamples ?? []).slice(0, 3),
    }));
}

function summarizeBy(cells, field) {
  const summaries = new Map();
  for (const cell of cells) {
    const key = cell[field] ?? 'UNKNOWN';
    if (!summaries.has(key)) {
      summaries.set(key, {
        key,
        cellCount: 0,
        zeroAuthorityCellCount: 0,
        internalEvidenceBackedCellCount: 0,
        zeroInternalEvidenceCellCount: 0,
        expertInternalEvidenceBackedCellCount: 0,
        authoredFragments: 0,
        expertNumericalEvidenceFragments: 0,
        expertInternalNumericalEvidenceFragments: 0,
        internalNumericalEvidenceRecords: 0,
        authorityTruthEligibleFragments: 0,
        authorityTruthEligibleNumericalEvidenceRecords: 0,
      });
    }
    const summary = summaries.get(key);
    summary.cellCount += 1;
    summary.zeroAuthorityCellCount += cellAuthorityCount(cell) === 0 ? 1 : 0;
    summary.internalEvidenceBackedCellCount += cellHasInternalEvidence(cell) ? 1 : 0;
    summary.zeroInternalEvidenceCellCount += cellHasInternalEvidence(cell) ? 0 : 1;
    summary.expertInternalEvidenceBackedCellCount +=
      cell.depth === 'expert' && cellHasInternalEvidence(cell) ? 1 : 0;
    summary.authoredFragments += cell.authoredFragments ?? 0;
    summary.expertNumericalEvidenceFragments += cell.expertNumericalEvidenceFragments ?? 0;
    summary.expertInternalNumericalEvidenceFragments += cell.expertInternalNumericalEvidenceFragments ?? 0;
    summary.internalNumericalEvidenceRecords += cell.internalNumericalEvidenceRecords ?? 0;
    summary.authorityTruthEligibleFragments += cell.authorityTruthEligibleFragments ?? 0;
    summary.authorityTruthEligibleNumericalEvidenceRecords += cell.authorityTruthEligibleNumericalEvidenceRecords ?? 0;
  }
  return [...summaries.values()].sort((a, b) =>
    b.zeroAuthorityCellCount - a.zeroAuthorityCellCount ||
    b.authoredFragments - a.authoredFragments ||
    String(a.key).localeCompare(String(b.key)));
}

function buildAuthorityGapReport(options = {}) {
  const maxTopCells = options.maxTopCells ?? 20;
  const maxZeroAuthorityCells = options.maxZeroAuthorityCells ?? null;
  const minAuthorityTruthEligibleFragments = options.minAuthorityTruthEligibleFragments ?? 0;
  const minAuthorityTruthEligibleNumericalEvidence = options.minAuthorityTruthEligibleNumericalEvidence ?? 0;
  const coverage = buildCoverageReport({
    minAuthored: options.minAuthored ?? 15,
    minAuthorityTruthEligibleFragments,
    minAuthorityTruthEligibleNumericalEvidence,
  });
  const cells = coverage.cells ?? [];
  const zeroAuthorityCells = cells
    .filter((cell) => (cell.authoredFragments ?? 0) > 0 && cellAuthorityCount(cell) === 0)
    .sort((a, b) =>
      cellPriority(b) - cellPriority(a) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.period).localeCompare(String(b.period)) ||
      String(a.depth).localeCompare(String(b.depth)))
    .map(compactCell);
  const expertAuthorityEvidenceGapCells = cells
    .filter((cell) =>
      cell.depth === 'expert' &&
      (cell.expertNumericalEvidenceFragments ?? 0) > 0 &&
      (cell.authorityTruthEligibleNumericalEvidenceRecords ?? 0) === 0)
    .sort((a, b) =>
      (b.expertNumericalEvidenceFragments ?? 0) - (a.expertNumericalEvidenceFragments ?? 0) ||
      (b.authoredFragments ?? 0) - (a.authoredFragments ?? 0) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.period).localeCompare(String(b.period)))
    .map(compactCell);
  const internalEvidenceBackedCells = cells
    .filter((cell) => (cell.authoredFragments ?? 0) > 0 && cellHasInternalEvidence(cell))
    .sort((a, b) =>
      cellInternalEvidencePriority(b) - cellInternalEvidencePriority(a) ||
      cellPriority(b) - cellPriority(a) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.period).localeCompare(String(b.period)) ||
      String(a.depth).localeCompare(String(b.depth)))
    .map(compactCell);
  const zeroInternalEvidenceCells = cells
    .filter((cell) => (cell.authoredFragments ?? 0) > 0 && !cellHasInternalEvidence(cell))
    .sort((a, b) =>
      cellPriority(b) - cellPriority(a) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.period).localeCompare(String(b.period)) ||
      String(a.depth).localeCompare(String(b.depth)))
    .map(compactCell);
  const expertInternalEvidenceBackedCells = cells
    .filter((cell) => cell.depth === 'expert' && cellHasInternalEvidence(cell))
    .sort((a, b) =>
      cellInternalEvidencePriority(b) - cellInternalEvidencePriority(a) ||
      (b.authoredFragments ?? 0) - (a.authoredFragments ?? 0) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.period).localeCompare(String(b.period)))
    .map(compactCell);
  const expertInternalEvidenceGapCells = cells
    .filter((cell) => cell.depth === 'expert' && (cell.authoredFragments ?? 0) > 0 && !cellHasInternalEvidence(cell))
    .sort((a, b) =>
      (b.authoredFragments ?? 0) - (a.authoredFragments ?? 0) ||
      String(a.category).localeCompare(String(b.category)) ||
      String(a.period).localeCompare(String(b.period)))
    .map(compactCell);
  const zeroAuthorityCellExcessToThreshold = maxZeroAuthorityCells === null
    ? 0
    : Math.max(0, zeroAuthorityCells.length - maxZeroAuthorityCells);

  return {
    schemaVersion: 'spring-ts.narrative-authority-gap-report.v1',
    generatedAt: new Date().toISOString(),
    minAuthoredThreshold: coverage.minAuthoredThreshold,
    minAuthorityTruthEligibleFragmentThreshold: minAuthorityTruthEligibleFragments,
    minAuthorityTruthEligibleNumericalEvidenceThreshold: minAuthorityTruthEligibleNumericalEvidence,
    maxZeroAuthorityCellThreshold: maxZeroAuthorityCells,
    totals: {
      bundleCount: coverage.totals.bundleCount,
      fragmentCount: coverage.totals.fragmentCount,
      authoredFragmentCount: coverage.totals.authoredFragmentCount,
      expectedCells: coverage.totals.expectedCells,
      zeroAuthorityCellCount: zeroAuthorityCells.length,
      expertAuthorityEvidenceGapCellCount: expertAuthorityEvidenceGapCells.length,
      internalEvidenceBackedCellCount: internalEvidenceBackedCells.length,
      zeroInternalEvidenceCellCount: zeroInternalEvidenceCells.length,
      expertInternalEvidenceBackedCellCount: expertInternalEvidenceBackedCells.length,
      expertInternalEvidenceGapCellCount: expertInternalEvidenceGapCells.length,
      expertInternalNumericalEvidenceFragmentCount:
        coverage.totals.expertInternalNumericalEvidenceFragmentCount ?? 0,
      internalNumericalEvidenceRecordCount: coverage.totals.internalNumericalEvidenceRecordCount ?? 0,
      zeroAuthorityCellExcessToThreshold,
      authorityTruthEligibleFragmentCount: coverage.sourceTierSummary.authorityTruthEligibleFragmentCount,
      authorityTruthEligibleNumericalEvidenceCount:
        coverage.sourceTierSummary.authorityTruthEligibleNumericalEvidenceCount,
      authorityTruthEligibleFragmentDeficitToThreshold:
        coverage.sourceTierSummary.authorityTruthEligibleFragmentDeficitToThreshold,
      authorityTruthEligibleNumericalEvidenceDeficitToThreshold:
        coverage.sourceTierSummary.authorityTruthEligibleNumericalEvidenceDeficitToThreshold,
    },
    sourceTierSummary: coverage.sourceTierSummary,
    byCategory: summarizeBy(cells, 'category'),
    byPeriod: summarizeBy(cells, 'period'),
    byDepth: summarizeBy(cells, 'depth'),
    zeroAuthorityCells: zeroAuthorityCells.slice(0, maxTopCells),
    expertAuthorityEvidenceGapCells: expertAuthorityEvidenceGapCells.slice(0, maxTopCells),
    internalEvidenceBackedCells: internalEvidenceBackedCells.slice(0, maxTopCells),
    zeroInternalEvidenceCells: zeroInternalEvidenceCells.slice(0, maxTopCells),
    expertInternalEvidenceBackedCells: expertInternalEvidenceBackedCells.slice(0, maxTopCells),
    expertInternalEvidenceGapCells: expertInternalEvidenceGapCells.slice(0, maxTopCells),
    authorityWorkBacklog: buildAuthorityWorkBacklog(cells, maxTopCells),
  };
}

function getThresholdFailures(report) {
  const failures = [];
  if ((report.totals?.authorityTruthEligibleFragmentDeficitToThreshold ?? 0) > 0) {
    failures.push(
      `authorityTruthEligible fragments ${report.totals.authorityTruthEligibleFragmentCount}/${report.minAuthorityTruthEligibleFragmentThreshold}`,
    );
  }
  if ((report.totals?.authorityTruthEligibleNumericalEvidenceDeficitToThreshold ?? 0) > 0) {
    failures.push(
      `authorityTruthEligible numericalEvidence ${report.totals.authorityTruthEligibleNumericalEvidenceCount}/${report.minAuthorityTruthEligibleNumericalEvidenceThreshold}`,
    );
  }
  if ((report.totals?.zeroAuthorityCellExcessToThreshold ?? 0) > 0) {
    failures.push(
      `zero-authority cells ${report.totals.zeroAuthorityCellCount}/${report.maxZeroAuthorityCellThreshold}`,
    );
  }
  return failures;
}

function formatCounts(counts) {
  const entries = Object.entries(counts ?? {});
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}:${value}`).join(',')
    : 'none';
}

function renderHuman(report) {
  const lines = [];
  lines.push('Narrative Authority Gap Report');
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.authoredFragmentCount} authored`);
  lines.push(`Authority-truth eligible fragments: ${report.totals.authorityTruthEligibleFragmentCount}`);
  lines.push(`Authority-truth eligible numericalEvidence: ${report.totals.authorityTruthEligibleNumericalEvidenceCount}`);
  lines.push(`Zero-authority cells: ${report.totals.zeroAuthorityCellCount}/${report.totals.expectedCells}`);
  lines.push(`Expert authority evidence gap cells: ${report.totals.expertAuthorityEvidenceGapCellCount}`);
  lines.push(`Internal numericalEvidence records: ${report.totals.internalNumericalEvidenceRecordCount}`);
  lines.push(`Internal-evidence backed cells: ${report.totals.internalEvidenceBackedCellCount}/${report.totals.expectedCells}`);
  lines.push(`Expert internal-evidence gaps: ${report.totals.expertInternalEvidenceGapCellCount}`);
  lines.push(`Source tiers: fragments=${formatCounts(report.sourceTierSummary?.fragmentTierCounts)}; numericalEvidence=${formatCounts(report.sourceTierSummary?.numericalEvidenceTierCounts)}`);
  lines.push('');
  lines.push('By depth:');
  for (const row of report.byDepth) {
    lines.push(`- ${row.key}: zeroAuthority=${row.zeroAuthorityCellCount}/${row.cellCount}, internalEvidenceCells=${row.internalEvidenceBackedCellCount}, authored=${row.authoredFragments}, authorityEvidence=${row.authorityTruthEligibleNumericalEvidenceRecords}`);
  }
  lines.push('');
  lines.push('Top zero-authority cells:');
  for (const cell of report.zeroAuthorityCells) {
    lines.push(`- ${cell.category}/${cell.period}/${cell.depth}: authored=${cell.authoredFragments}, expertEvidence=${cell.expertNumericalEvidenceFragments}`);
  }
  if (report.expertAuthorityEvidenceGapCells.length > 0) {
    lines.push('');
    lines.push('Top expert authority evidence gaps:');
    for (const cell of report.expertAuthorityEvidenceGapCells) {
      lines.push(`- ${cell.category}/${cell.period}: expertEvidence=${cell.expertNumericalEvidenceFragments}, authored=${cell.authoredFragments}`);
    }
  }
  if (report.authorityWorkBacklog.length > 0) {
    lines.push('');
    lines.push('Authority work backlog:');
    for (const item of report.authorityWorkBacklog) {
      lines.push(`- ${item.priorityClass} ${item.category}/${item.period}/${item.depth}: needed=${item.neededEvidence.join(',')}`);
      for (const example of item.reviewExamples.slice(0, 2)) {
        lines.push(`  example: ${example.fragmentId} (${example.file})`);
      }
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildAuthorityGapReport({
    maxTopCells: args.maxTopCells,
    minAuthored: args.minAuthored,
    minAuthorityTruthEligibleFragments: args.minAuthorityTruthEligibleFragments,
    minAuthorityTruthEligibleNumericalEvidence: args.minAuthorityTruthEligibleNumericalEvidence,
    maxZeroAuthorityCells: args.maxZeroAuthorityCells,
  });
  const thresholdFailures = getThresholdFailures(report);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
  if (thresholdFailures.length > 0) {
    console.error(`Narrative authority gap thresholds failed:\n- ${thresholdFailures.join('\n- ')}`);
    process.exit(1);
  }
}

export { buildAuthorityGapReport, getThresholdFailures, renderHuman };
