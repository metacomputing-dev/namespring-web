#!/usr/bin/env node
/**
 * tools/narrative_coverage_report.mjs
 *
 * Reports where the tiered narrative corpus is broad, shallow, or still using
 * placeholder fallback content. This is a planning aid for future authored
 * fragment expansion; it does not change runtime scoring or report selection.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');
const CONTRACT_PATH = path.join(NARRATIVE_ROOT, '_contract', 'v1.json');

function parseArgs(argv) {
  const args = { json: false, minAuthored: 5 };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--min-authored=')) {
      const value = Number(arg.slice('--min-authored='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthored = value;
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

function createCell(category, period, depth, gatingFields) {
  return {
    category,
    period,
    depth,
    totalFragments: 0,
    authoredFragments: 0,
    placeholderFragments: 0,
    expertNumericalEvidenceFragments: 0,
    gatingUsage: Object.fromEntries(gatingFields.map((field) => [
      field,
      { fragmentCount: 0, values: [] },
    ])),
  };
}

function bumpBucket(map, key, patch) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      totalFragments: 0,
      authoredFragments: 0,
      placeholderFragments: 0,
      expertNumericalEvidenceFragments: 0,
    });
  }
  const bucket = map.get(key);
  for (const [field, delta] of Object.entries(patch)) {
    bucket[field] = (bucket[field] ?? 0) + delta;
  }
}

function buildReport(options = {}) {
  const minAuthored = options.minAuthored ?? 5;
  const contract = readJson(CONTRACT_PATH);
  const categories = contract.axes.category;
  const periods = contract.axes.period;
  const depths = contract.axes.depth;
  const gatingFields = contract.gatingFieldWhitelist;

  const cells = new Map();
  for (const category of categories) {
    for (const period of periods) {
      for (const depth of depths) {
        const key = `${category}|${period}|${depth}`;
        cells.set(key, createCell(category, period, depth, gatingFields));
      }
    }
  }

  const axisUsage = Object.fromEntries(gatingFields.map((field) => [
    field,
    { fragmentCount: 0, values: new Set() },
  ]));
  const categoryTotals = new Map();
  const periodTotals = new Map();
  const depthTotals = new Map();

  let fragmentCount = 0;
  let authoredFragmentCount = 0;
  let placeholderFragmentCount = 0;
  let expertNumericalEvidenceFragmentCount = 0;

  const bundles = listFragmentBundles(NARRATIVE_ROOT);
  for (const file of bundles) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const bundle = readJson(file);
    for (const fragment of bundle.fragments ?? []) {
      const category = fragment?.axis?.category;
      const period = fragment?.axis?.period;
      const depth = fragment?.axis?.depth;
      const key = `${category}|${period}|${depth}`;
      if (!cells.has(key)) continue;

      const isPlaceholder = rel.includes('/_seed/') || String(fragment.fragmentId ?? '').includes('.placeholder.');
      const hasNumericalEvidence = Array.isArray(fragment.numericalEvidence) && fragment.numericalEvidence.length > 0;
      const cell = cells.get(key);

      fragmentCount += 1;
      cell.totalFragments += 1;
      if (isPlaceholder) {
        placeholderFragmentCount += 1;
        cell.placeholderFragments += 1;
      } else {
        authoredFragmentCount += 1;
        cell.authoredFragments += 1;
      }
      if (depth === 'expert' && hasNumericalEvidence) {
        expertNumericalEvidenceFragmentCount += 1;
        cell.expertNumericalEvidenceFragments += 1;
      }

      bumpBucket(categoryTotals, category, {
        totalFragments: 1,
        authoredFragments: isPlaceholder ? 0 : 1,
        placeholderFragments: isPlaceholder ? 1 : 0,
        expertNumericalEvidenceFragments: depth === 'expert' && hasNumericalEvidence ? 1 : 0,
      });
      bumpBucket(periodTotals, period, {
        totalFragments: 1,
        authoredFragments: isPlaceholder ? 0 : 1,
        placeholderFragments: isPlaceholder ? 1 : 0,
        expertNumericalEvidenceFragments: depth === 'expert' && hasNumericalEvidence ? 1 : 0,
      });
      bumpBucket(depthTotals, depth, {
        totalFragments: 1,
        authoredFragments: isPlaceholder ? 0 : 1,
        placeholderFragments: isPlaceholder ? 1 : 0,
        expertNumericalEvidenceFragments: depth === 'expert' && hasNumericalEvidence ? 1 : 0,
      });

      for (const field of gatingFields) {
        const values = fragment?.gating?.[field];
        if (!Array.isArray(values) || values.length === 0) continue;
        axisUsage[field].fragmentCount += 1;
        cell.gatingUsage[field].fragmentCount += 1;
        const cellValues = new Set(cell.gatingUsage[field].values);
        for (const value of values) {
          axisUsage[field].values.add(value);
          cellValues.add(value);
        }
        cell.gatingUsage[field].values = [...cellValues].sort();
      }
    }
  }

  const cellList = [...cells.values()].map((cell) => ({
    ...cell,
    gatingUsage: Object.fromEntries(Object.entries(cell.gatingUsage).map(([field, usage]) => [
      field,
      { ...usage, values: [...usage.values].sort() },
    ])),
  }));

  const missingCells = cellList.filter((cell) => cell.totalFragments === 0);
  const placeholderOnlyCells = cellList.filter((cell) => cell.totalFragments > 0 && cell.authoredFragments === 0);
  const underfilledCells = cellList
    .filter((cell) => cell.authoredFragments < minAuthored)
    .map(({ category, period, depth, authoredFragments, placeholderFragments, expertNumericalEvidenceFragments }) => ({
      category,
      period,
      depth,
      authoredFragments,
      placeholderFragments,
      expertNumericalEvidenceFragments,
    }))
    .sort((a, b) =>
      a.authoredFragments - b.authoredFragments ||
      a.category.localeCompare(b.category) ||
      a.period.localeCompare(b.period) ||
      a.depth.localeCompare(b.depth));

  return {
    schemaVersion: 'spring-ts.narrative-coverage-report.v1',
    generatedAt: new Date().toISOString(),
    minAuthoredThreshold: minAuthored,
    axes: { categories, periods, depths },
    gatingFields,
    totals: {
      bundleCount: bundles.length,
      expectedCells: categories.length * periods.length * depths.length,
      cellsWithFragments: cellList.filter((cell) => cell.totalFragments > 0).length,
      cellsWithAuthoredFragments: cellList.filter((cell) => cell.authoredFragments > 0).length,
      fragmentCount,
      authoredFragmentCount,
      placeholderFragmentCount,
      expertNumericalEvidenceFragmentCount,
      missingCellCount: missingCells.length,
      placeholderOnlyCellCount: placeholderOnlyCells.length,
      underfilledCellCount: underfilledCells.length,
    },
    axisUsage: Object.fromEntries(Object.entries(axisUsage).map(([field, usage]) => [
      field,
      { fragmentCount: usage.fragmentCount, values: [...usage.values].sort() },
    ])),
    categoryTotals: [...categoryTotals.values()].sort((a, b) => a.key.localeCompare(b.key)),
    periodTotals: [...periodTotals.values()].sort((a, b) => a.key.localeCompare(b.key)),
    depthTotals: [...depthTotals.values()].sort((a, b) => a.key.localeCompare(b.key)),
    missingCells,
    placeholderOnlyCells,
    underfilledCells,
    cells: cellList,
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push('Narrative Coverage Report');
  lines.push(`Bundles: ${report.totals.bundleCount}`);
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.authoredFragmentCount} authored, ${report.totals.placeholderFragmentCount} placeholder`);
  lines.push(`Cells: ${report.totals.cellsWithFragments}/${report.totals.expectedCells} populated, ${report.totals.cellsWithAuthoredFragments}/${report.totals.expectedCells} authored`);
  lines.push(`Missing cells: ${report.totals.missingCellCount}`);
  lines.push(`Placeholder-only cells: ${report.totals.placeholderOnlyCellCount}`);
  lines.push(`Underfilled cells (<${report.minAuthoredThreshold} authored): ${report.totals.underfilledCellCount}`);
  lines.push(`Expert numerical evidence fragments: ${report.totals.expertNumericalEvidenceFragmentCount}`);
  lines.push('');
  lines.push('Gating usage:');
  for (const [field, usage] of Object.entries(report.axisUsage)) {
    lines.push(`- ${field}: ${usage.fragmentCount} fragments; values=${usage.values.join(',') || 'none'}`);
  }
  if (report.underfilledCells.length > 0) {
    lines.push('');
    lines.push('Top underfilled cells:');
    for (const cell of report.underfilledCells.slice(0, 20)) {
      lines.push(`- ${cell.category}/${cell.period}/${cell.depth}: authored=${cell.authoredFragments}, placeholder=${cell.placeholderFragments}, expertEvidence=${cell.expertNumericalEvidenceFragments}`);
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport({ minAuthored: args.minAuthored });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
}

export { buildReport, renderHuman };
