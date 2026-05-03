#!/usr/bin/env node
/**
 * tools/narrative_cell_axis_report.mjs
 *
 * Reports whether every category x period x depth cell has authored fragments
 * that use important personalization axis families. Axis-pair and tuple reports
 * can show global coverage while a specific runtime cell still lacks an
 * audience branch, so this report is intentionally cell-scoped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');
const CONTRACT_PATH = path.join(NARRATIVE_ROOT, '_contract', 'v1.json');

const AXIS_FAMILIES = {
  audience: ['agePhase', 'ageBand', 'gender'],
  sajuCore: ['dayMasterElement', 'dayMasterStrength', 'yongshinElement', 'yongshinAlignment', 'gyeokguk'],
  seasonContext: ['birthSeason', 'currentSeason', 'dayMasterPolarity'],
};

function parseArgs(argv) {
  const args = {
    json: false,
    maxTop: 30,
    thresholds: {
      audience: null,
      sajuCore: null,
      seasonContext: null,
    },
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-top=')) {
      const value = Number(arg.slice('--max-top='.length));
      if (Number.isInteger(value) && value >= 0) args.maxTop = value;
    } else if (arg.startsWith('--max-missing-audience-cells=')) {
      const value = Number(arg.slice('--max-missing-audience-cells='.length));
      if (Number.isInteger(value) && value >= 0) args.thresholds.audience = value;
    } else if (arg.startsWith('--max-missing-saju-core-cells=')) {
      const value = Number(arg.slice('--max-missing-saju-core-cells='.length));
      if (Number.isInteger(value) && value >= 0) args.thresholds.sajuCore = value;
    } else if (arg.startsWith('--max-missing-season-context-cells=')) {
      const value = Number(arg.slice('--max-missing-season-context-cells='.length));
      if (Number.isInteger(value) && value >= 0) args.thresholds.seasonContext = value;
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

function isPlaceholderFragment(relPath, fragment) {
  return relPath.includes('/_seed/') || String(fragment?.fragmentId ?? '').includes('.placeholder.');
}

function createCell(category, period, depth) {
  return {
    key: `${category}|${period}|${depth}`,
    category,
    period,
    depth,
    authoredFragments: 0,
    axisCounts: Object.fromEntries(Object.keys(AXIS_FAMILIES).map((family) => [family, 0])),
    fieldCounts: {},
  };
}

function hasAnyGating(fragment, fields) {
  return fields.some((field) => {
    const values = fragment?.gating?.[field];
    return Array.isArray(values) && values.length > 0;
  });
}

function buildCellAxisReport(options = {}) {
  const maxTop = options.maxTop ?? 30;
  const contract = readJson(CONTRACT_PATH);
  const cells = new Map();
  for (const category of contract.axes.category ?? []) {
    for (const period of contract.axes.period ?? []) {
      for (const depth of contract.axes.depth ?? []) {
        const cell = createCell(category, period, depth);
        cells.set(cell.key, cell);
      }
    }
  }

  const bundles = listFragmentBundles(NARRATIVE_ROOT);
  let fragmentCount = 0;
  let authoredFragmentCount = 0;

  for (const file of bundles) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const bundle = readJson(file);
    for (const fragment of bundle.fragments ?? []) {
      fragmentCount += 1;
      if (isPlaceholderFragment(rel, fragment)) continue;
      authoredFragmentCount += 1;
      const key = `${fragment?.axis?.category}|${fragment?.axis?.period}|${fragment?.axis?.depth}`;
      const cell = cells.get(key);
      if (!cell) continue;
      cell.authoredFragments += 1;
      for (const [family, fields] of Object.entries(AXIS_FAMILIES)) {
        if (hasAnyGating(fragment, fields)) cell.axisCounts[family] += 1;
      }
      for (const [field, values] of Object.entries(fragment?.gating ?? {})) {
        if (!Array.isArray(values) || values.length === 0) continue;
        cell.fieldCounts[field] = (cell.fieldCounts[field] ?? 0) + 1;
      }
    }
  }

  const cellRows = [...cells.values()].sort((a, b) => a.key.localeCompare(b.key));
  const missingByFamily = Object.fromEntries(Object.keys(AXIS_FAMILIES).map((family) => [
    family,
    cellRows
      .filter((cell) => cell.authoredFragments > 0 && cell.axisCounts[family] === 0)
      .sort((a, b) => a.authoredFragments - b.authoredFragments || a.key.localeCompare(b.key)),
  ]));
  const missingCellCounts = Object.fromEntries(
    Object.entries(missingByFamily).map(([family, rows]) => [family, rows.length]),
  );
  const fieldTotals = {};
  for (const cell of cellRows) {
    for (const [field, count] of Object.entries(cell.fieldCounts)) {
      fieldTotals[field] = (fieldTotals[field] ?? 0) + count;
    }
  }

  return {
    schemaVersion: 'spring-ts.narrative-cell-axis-report.v1',
    generatedAt: new Date().toISOString(),
    axisFamilies: AXIS_FAMILIES,
    totals: {
      bundleCount: bundles.length,
      fragmentCount,
      authoredFragmentCount,
      cellCount: cellRows.length,
      missingCellCounts,
      fieldTotals: Object.fromEntries(Object.entries(fieldTotals).sort((a, b) => a[0].localeCompare(b[0]))),
    },
    topMissingCells: Object.fromEntries(Object.entries(missingByFamily).map(([family, rows]) => [
      family,
      rows.slice(0, maxTop).map((cell) => ({
        key: cell.key,
        category: cell.category,
        period: cell.period,
        depth: cell.depth,
        authoredFragments: cell.authoredFragments,
        fieldCounts: cell.fieldCounts,
      })),
    ])),
    cells: cellRows,
  };
}

function getThresholdFailures(report, thresholds = {}) {
  const failures = [];
  for (const family of Object.keys(AXIS_FAMILIES)) {
    const threshold = thresholds[family];
    if (threshold === null || threshold === undefined) continue;
    const actual = report.totals.missingCellCounts[family] ?? 0;
    if (actual > threshold) {
      failures.push(`${family} missing cells: ${actual}/${threshold}`);
    }
  }
  return failures;
}

function renderHuman(report) {
  const lines = [];
  lines.push('Narrative Cell Axis Report');
  lines.push(`Bundles: ${report.totals.bundleCount}`);
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.authoredFragmentCount} authored`);
  lines.push(`Cells: ${report.totals.cellCount}`);
  for (const [family, count] of Object.entries(report.totals.missingCellCounts)) {
    lines.push(`Missing ${family} cells: ${count}`);
  }
  lines.push('');
  for (const [family, rows] of Object.entries(report.topMissingCells)) {
    if (rows.length === 0) continue;
    lines.push(`Top missing ${family}:`);
    for (const row of rows) {
      lines.push(`- ${row.key}: authored=${row.authoredFragments}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildCellAxisReport({ maxTop: args.maxTop });
  const failures = getThresholdFailures(report, args.thresholds);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
  if (failures.length > 0) {
    console.error(`Narrative cell-axis thresholds failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
}

export { buildCellAxisReport, getThresholdFailures, renderHuman };
