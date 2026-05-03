#!/usr/bin/env node
/**
 * tools/narrative_numeric_evidence_report.mjs
 *
 * Reports which expert numericalEvidence paths are used by narrative fragments
 * and which safe numeric paths are available but still unused.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');

const SAFE_VALUE_EXPRESSION = /^(feature|cell)(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const BLOCKED_PATH_PARTS = new Set(['__proto__', 'prototype', 'constructor']);
const AVAILABLE_NUMERIC_PATHS = [
  'feature.ageYears',
  'feature.agePhaseOrdinal',
  'feature.dayMasterStrengthOrdinal',
  'feature.birthSeasonOrdinal',
  'feature.currentSeasonOrdinal',
  'cell.stars',
];

function parseArgs(argv) {
  const args = {
    json: false,
    maxTopRows: 20,
    minExpressionUsage: 1,
    maxUnknownExpressionThreshold: null,
    maxUnusedAvailablePathThreshold: null,
    maxThinAvailablePathThreshold: null,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-top-rows=')) {
      const value = Number(arg.slice('--max-top-rows='.length));
      if (Number.isInteger(value) && value >= 0) args.maxTopRows = value;
    } else if (arg.startsWith('--min-expression-usage=')) {
      const value = Number(arg.slice('--min-expression-usage='.length));
      if (Number.isInteger(value) && value >= 0) args.minExpressionUsage = value;
    } else if (arg.startsWith('--max-unknown-expressions=')) {
      const value = Number(arg.slice('--max-unknown-expressions='.length));
      if (Number.isInteger(value) && value >= 0) args.maxUnknownExpressionThreshold = value;
    } else if (arg.startsWith('--max-unused-available-paths=')) {
      const value = Number(arg.slice('--max-unused-available-paths='.length));
      if (Number.isInteger(value) && value >= 0) args.maxUnusedAvailablePathThreshold = value;
    } else if (arg.startsWith('--max-thin-available-paths=')) {
      const value = Number(arg.slice('--max-thin-available-paths='.length));
      if (Number.isInteger(value) && value >= 0) args.maxThinAvailablePathThreshold = value;
    }
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function listFragmentBundles(rootDir) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_glossary' || entry.name === '_contract') continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out.sort((a, b) => a.localeCompare(b));
}

function isSafeExpression(expression) {
  if (!SAFE_VALUE_EXPRESSION.test(expression)) return false;
  return !expression.split('.').some((part) => BLOCKED_PATH_PARTS.has(part));
}

function increment(map, key, delta = 1) {
  map.set(key, (map.get(key) ?? 0) + delta);
}

function compactCounts(map) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function sourceTierKey(sourceTier) {
  return sourceTier?.tier || 'UNKNOWN';
}

function cellKey(axis) {
  return `${axis?.category ?? 'UNKNOWN'}|${axis?.period ?? 'UNKNOWN'}|${axis?.depth ?? 'UNKNOWN'}`;
}

function buildNumericEvidenceReport(options = {}) {
  const maxTopRows = options.maxTopRows ?? 20;
  const minExpressionUsage = options.minExpressionUsage ?? 1;
  const maxUnknownExpressionThreshold = options.maxUnknownExpressionThreshold ?? null;
  const maxUnusedAvailablePathThreshold = options.maxUnusedAvailablePathThreshold ?? null;
  const maxThinAvailablePathThreshold = options.maxThinAvailablePathThreshold ?? null;
  const bundles = listFragmentBundles(NARRATIVE_ROOT);
  const expressionCounts = new Map();
  const sourceTierCounts = new Map();
  const cellCounts = new Map();
  const unknownExpressionRecords = [];
  let fragmentCount = 0;
  let expertFragmentCount = 0;
  let numericalEvidenceRecordCount = 0;
  let fragmentsWithNumericalEvidenceCount = 0;

  for (const file of bundles) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const bundle = readJson(file);
    for (const fragment of bundle.fragments ?? []) {
      fragmentCount += 1;
      if (fragment?.axis?.depth === 'expert') expertFragmentCount += 1;
      const rows = Array.isArray(fragment?.numericalEvidence) ? fragment.numericalEvidence : [];
      if (rows.length > 0) fragmentsWithNumericalEvidenceCount += 1;
      for (const row of rows) {
        const expression = String(row?.valueExpression ?? '');
        numericalEvidenceRecordCount += 1;
        increment(expressionCounts, expression);
        increment(sourceTierCounts, sourceTierKey(row?.sourceTier));
        increment(cellCounts, cellKey(fragment?.axis));
        if (!isSafeExpression(expression) || !AVAILABLE_NUMERIC_PATHS.includes(expression)) {
          unknownExpressionRecords.push({
            file: rel,
            fragmentId: fragment?.fragmentId ?? null,
            expression,
            reason: isSafeExpression(expression) ? 'not_in_available_numeric_paths' : 'unsafe_expression',
          });
        }
      }
    }
  }

  const usedAvailablePaths = AVAILABLE_NUMERIC_PATHS
    .filter((expression) => expressionCounts.has(expression));
  const unusedAvailablePaths = AVAILABLE_NUMERIC_PATHS
    .filter((expression) => !expressionCounts.has(expression));
  const thinAvailablePaths = AVAILABLE_NUMERIC_PATHS
    .map((expression) => ({
      expression,
      count: expressionCounts.get(expression) ?? 0,
      requiredCount: minExpressionUsage,
      deficit: Math.max(0, minExpressionUsage - (expressionCounts.get(expression) ?? 0)),
    }))
    .filter((row) => row.count > 0 && row.count < minExpressionUsage)
    .sort((a, b) => b.deficit - a.deficit || a.count - b.count || a.expression.localeCompare(b.expression));
  const unknownExpressionExcessToThreshold = maxUnknownExpressionThreshold === null
    ? 0
    : Math.max(0, unknownExpressionRecords.length - maxUnknownExpressionThreshold);
  const unusedAvailablePathExcessToThreshold = maxUnusedAvailablePathThreshold === null
    ? 0
    : Math.max(0, unusedAvailablePaths.length - maxUnusedAvailablePathThreshold);
  const thinAvailablePathExcessToThreshold = maxThinAvailablePathThreshold === null
    ? 0
    : Math.max(0, thinAvailablePaths.length - maxThinAvailablePathThreshold);

  return {
    schemaVersion: 'spring-ts.narrative-numeric-evidence-report.v1',
    generatedAt: new Date().toISOString(),
    availableNumericPaths: AVAILABLE_NUMERIC_PATHS,
    minExpressionUsageThreshold: minExpressionUsage,
    maxUnknownExpressionThreshold,
    maxUnusedAvailablePathThreshold,
    maxThinAvailablePathThreshold,
    totals: {
      bundleCount: bundles.length,
      fragmentCount,
      expertFragmentCount,
      fragmentsWithNumericalEvidenceCount,
      numericalEvidenceRecordCount,
      distinctExpressionCount: expressionCounts.size,
      usedAvailablePathCount: usedAvailablePaths.length,
      unusedAvailablePathCount: unusedAvailablePaths.length,
      thinAvailablePathCount: thinAvailablePaths.length,
      thinAvailablePathDeficit: thinAvailablePaths.reduce((sum, row) => sum + row.deficit, 0),
      unknownExpressionCount: unknownExpressionRecords.length,
      unknownExpressionExcessToThreshold,
      unusedAvailablePathExcessToThreshold,
      thinAvailablePathExcessToThreshold,
    },
    sourceTierCounts: Object.fromEntries([...sourceTierCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    expressions: compactCounts(expressionCounts),
    cellCounts: compactCounts(cellCounts).slice(0, maxTopRows),
    usedAvailablePaths,
    unusedAvailablePaths,
    thinAvailablePaths,
    unknownExpressionRecords: unknownExpressionRecords.slice(0, maxTopRows),
  };
}

function getThresholdFailures(report) {
  const failures = [];
  if ((report.totals?.unknownExpressionExcessToThreshold ?? 0) > 0) {
    failures.push(
      `unknown numericalEvidence expressions ${report.totals.unknownExpressionCount}/${report.maxUnknownExpressionThreshold}`,
    );
  }
  if ((report.totals?.unusedAvailablePathExcessToThreshold ?? 0) > 0) {
    failures.push(
      `unused available numeric paths ${report.totals.unusedAvailablePathCount}/${report.maxUnusedAvailablePathThreshold}`,
    );
  }
  if ((report.totals?.thinAvailablePathExcessToThreshold ?? 0) > 0) {
    failures.push(
      `thin available numeric paths ${report.totals.thinAvailablePathCount}/${report.maxThinAvailablePathThreshold}`,
    );
  }
  return failures;
}

function renderHuman(report) {
  const lines = [];
  lines.push('Narrative Numeric Evidence Report');
  lines.push(`Bundles: ${report.totals.bundleCount}`);
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.expertFragmentCount} expert`);
  lines.push(`Numerical evidence records: ${report.totals.numericalEvidenceRecordCount}`);
  lines.push(`Expressions: ${report.totals.distinctExpressionCount} distinct`);
  lines.push(`Available numeric paths used: ${report.totals.usedAvailablePathCount}/${report.availableNumericPaths.length}`);
  lines.push(`Thin available numeric paths (<${report.minExpressionUsageThreshold}): ${report.totals.thinAvailablePathCount}`);
  lines.push(`Unknown expressions: ${report.totals.unknownExpressionCount}`);
  lines.push('');
  lines.push('Expression usage:');
  for (const row of report.expressions) {
    lines.push(`- ${row.key}: ${row.count}`);
  }
  if (report.unusedAvailablePaths.length > 0) {
    lines.push('');
    lines.push('Unused available numeric paths:');
    for (const expression of report.unusedAvailablePaths) {
      lines.push(`- ${expression}`);
    }
  }
  if (report.thinAvailablePaths.length > 0) {
    lines.push('');
    lines.push('Thin available numeric paths:');
    for (const row of report.thinAvailablePaths) {
      lines.push(`- ${row.expression}: count=${row.count}, deficit=${row.deficit}`);
    }
  }
  if (report.unknownExpressionRecords.length > 0) {
    lines.push('');
    lines.push('Unknown expression records:');
    for (const record of report.unknownExpressionRecords) {
      lines.push(`- ${record.file}#${record.fragmentId}: ${record.expression} (${record.reason})`);
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildNumericEvidenceReport({
    maxTopRows: args.maxTopRows,
    minExpressionUsage: args.minExpressionUsage,
    maxUnknownExpressionThreshold: args.maxUnknownExpressionThreshold,
    maxUnusedAvailablePathThreshold: args.maxUnusedAvailablePathThreshold,
    maxThinAvailablePathThreshold: args.maxThinAvailablePathThreshold,
  });
  const thresholdFailures = getThresholdFailures(report);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
  if (thresholdFailures.length > 0) {
    console.error(`Narrative numeric evidence thresholds failed:\n- ${thresholdFailures.join('\n- ')}`);
    process.exit(1);
  }
}

export { buildNumericEvidenceReport, getThresholdFailures, renderHuman };
