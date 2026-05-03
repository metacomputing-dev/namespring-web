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
const NARRATIVE_SCHEMA_PATH = path.join(ROOT, 'test', 'baseline', 'schema', 'narrativeFragment.schema.json');
const INTERNAL_NUMERICAL_EVIDENCE_TIER = 'T3_INTERNAL_ENGINE';

function parseArgs(argv) {
  const args = {
    json: false,
    minAuthored: 5,
    minExpertNumericalEvidence: 1,
    minAuthorityTruthEligibleFragments: 0,
    minAuthorityTruthEligibleNumericalEvidence: 0,
    maxThinExpertAxisValues: null,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--min-authored=')) {
      const value = Number(arg.slice('--min-authored='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthored = value;
    } else if (arg.startsWith('--min-expert-numerical-evidence=')) {
      const value = Number(arg.slice('--min-expert-numerical-evidence='.length));
      if (Number.isInteger(value) && value >= 0) args.minExpertNumericalEvidence = value;
    } else if (arg.startsWith('--min-authority-fragments=')) {
      const value = Number(arg.slice('--min-authority-fragments='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthorityTruthEligibleFragments = value;
    } else if (arg.startsWith('--min-authority-numerical-evidence=')) {
      const value = Number(arg.slice('--min-authority-numerical-evidence='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthorityTruthEligibleNumericalEvidence = value;
    } else if (arg.startsWith('--max-thin-expert-axis-values=')) {
      const value = Number(arg.slice('--max-thin-expert-axis-values='.length));
      if (Number.isInteger(value) && value >= 0) args.maxThinExpertAxisValues = value;
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
    expertInternalNumericalEvidenceFragments: 0,
    internalNumericalEvidenceRecords: 0,
    authorityTruthEligibleFragments: 0,
    authorityTruthEligibleNumericalEvidenceRecords: 0,
    reviewExamples: [],
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

function incrementCount(map, key) {
  const normalizedKey = key || 'UNKNOWN';
  map.set(normalizedKey, (map.get(normalizedKey) ?? 0) + 1);
}

function toSortedRecord(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function loadAllowedGatingValues() {
  const schema = readJson(NARRATIVE_SCHEMA_PATH);
  const properties = schema?.properties?.gating?.properties ?? {};
  return Object.fromEntries(Object.entries(properties).map(([field, definition]) => {
    const values = definition?.items?.enum;
    return [field, Array.isArray(values) ? [...values].sort() : null];
  }));
}

function createAxisUsage(gatingFields) {
  return Object.fromEntries(gatingFields.map((field) => [
    field,
    { fragmentCount: 0, values: new Set() },
  ]));
}

function createAxisValueCounts(gatingFields) {
  return Object.fromEntries(gatingFields.map((field) => [
    field,
    new Map(),
  ]));
}

function bumpAxisValueCounts(valueCounts, value, isPlaceholder) {
  if (!valueCounts.has(value)) {
    valueCounts.set(value, {
      fragmentCount: 0,
      authoredFragments: 0,
      placeholderFragments: 0,
    });
  }
  const bucket = valueCounts.get(value);
  bucket.fragmentCount += 1;
  if (isPlaceholder) {
    bucket.placeholderFragments += 1;
  } else {
    bucket.authoredFragments += 1;
  }
}

function serializeAxisUsage(axisUsage) {
  return Object.fromEntries(Object.entries(axisUsage).map(([field, usage]) => [
    field,
    { fragmentCount: usage.fragmentCount, values: [...usage.values].sort() },
  ]));
}

function buildAxisValueCoverage(axisUsage, allowedGatingValues) {
  return Object.fromEntries(Object.entries(axisUsage).map(([field, usage]) => {
    const coveredValues = [...usage.values].sort();
    const expectedValues = allowedGatingValues[field];
    const missingValues = Array.isArray(expectedValues)
      ? expectedValues.filter((value) => !usage.values.has(value))
      : [];
    return [field, {
      fragmentCount: usage.fragmentCount,
      expectedValues,
      coveredValues,
      missingValues,
      missingValueCount: missingValues.length,
    }];
  }));
}

function countAxisValueGaps(axisValueCoverage) {
  return Object.values(axisValueCoverage)
    .reduce((sum, coverage) => sum + coverage.missingValueCount, 0);
}

function buildAxisValueDensity(axisValueCoverage, axisValueCounts) {
  return Object.fromEntries(Object.entries(axisValueCoverage).map(([field, coverage]) => {
    const expectedOrCoveredValues = Array.isArray(coverage.expectedValues)
      ? coverage.expectedValues
      : coverage.coveredValues;
    return [field, Object.fromEntries(expectedOrCoveredValues.map((value) => [
      value,
      axisValueCounts[field].get(value) ?? {
        fragmentCount: 0,
        authoredFragments: 0,
        placeholderFragments: 0,
      },
    ]))];
  }));
}

function compactReviewExample(fragment, rel, numericalEvidenceRows, internalNumericalEvidenceRecords, authorityTruthEligibleNumericalEvidenceRecords) {
  return {
    fragmentId: fragment.fragmentId ?? null,
    file: rel,
    sourceTier: fragment?.sourceTier?.tier ?? null,
    authorityTruthEligible: fragment?.sourceTier?.authorityTruthEligible === true,
    gating: fragment.gating ?? {},
    tags: Array.isArray(fragment.tags) ? fragment.tags.slice(0, 8) : [],
    numericalEvidenceCount: numericalEvidenceRows.length,
    internalNumericalEvidenceRecords,
    authorityTruthEligibleNumericalEvidenceRecords,
    numericalEvidenceLabels: numericalEvidenceRows
      .slice(0, 5)
      .map((evidence) => evidence?.label ?? evidence?.valueExpression ?? null)
      .filter((label) => typeof label === 'string' && label.length > 0),
  };
}

function listThinAxisValues(axisValueDensity, minAuthored) {
  return Object.entries(axisValueDensity)
    .flatMap(([field, byValue]) => Object.entries(byValue).map(([value, counts]) => ({
      field,
      value,
      ...counts,
    })))
    .filter((row) => row.authoredFragments > 0 && row.authoredFragments < minAuthored)
    .sort((a, b) =>
      a.authoredFragments - b.authoredFragments ||
      a.field.localeCompare(b.field) ||
      a.value.localeCompare(b.value));
}

function summarizeThinAxisValues(thinAxisValues, minAuthored) {
  return [...thinAxisValues.reduce((map, row) => {
    if (!map.has(row.field)) {
      map.set(row.field, {
        field: row.field,
        thinValueCount: 0,
        authoredDeficitToThreshold: 0,
      });
    }
    const summary = map.get(row.field);
    summary.thinValueCount += 1;
    summary.authoredDeficitToThreshold += minAuthored - row.authoredFragments;
    return map;
  }, new Map()).values()].sort((a, b) =>
    b.authoredDeficitToThreshold - a.authoredDeficitToThreshold ||
    b.thinValueCount - a.thinValueCount ||
    a.field.localeCompare(b.field));
}

function buildReport(options = {}) {
  const minAuthored = options.minAuthored ?? 5;
  const minExpertNumericalEvidence = options.minExpertNumericalEvidence ?? 1;
  const minAuthorityTruthEligibleFragments = options.minAuthorityTruthEligibleFragments ?? 0;
  const minAuthorityTruthEligibleNumericalEvidence = options.minAuthorityTruthEligibleNumericalEvidence ?? 0;
  const maxThinExpertAxisValues = Number.isInteger(options.maxThinExpertAxisValues)
    ? options.maxThinExpertAxisValues
    : null;
  const contract = readJson(CONTRACT_PATH);
  const allowedGatingValues = loadAllowedGatingValues();
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

  const axisUsage = createAxisUsage(gatingFields);
  const axisValueCounts = createAxisValueCounts(gatingFields);
  const expertAxisUsage = createAxisUsage(gatingFields);
  const expertAxisValueCounts = createAxisValueCounts(gatingFields);
  const categoryTotals = new Map();
  const periodTotals = new Map();
  const depthTotals = new Map();
  const fragmentSourceTierCounts = new Map();
  const numericalEvidenceSourceTierCounts = new Map();

  let fragmentCount = 0;
  let authoredFragmentCount = 0;
  let placeholderFragmentCount = 0;
  let expertNumericalEvidenceFragmentCount = 0;
  let expertInternalNumericalEvidenceFragmentCount = 0;
  let numericalEvidenceRecordCount = 0;
  let internalNumericalEvidenceRecordCount = 0;
  let authorityTruthEligibleFragmentCount = 0;
  let authorityTruthEligibleNumericalEvidenceCount = 0;

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
      const numericalEvidenceRows = Array.isArray(fragment.numericalEvidence) ? fragment.numericalEvidence : [];
      const hasNumericalEvidence = numericalEvidenceRows.length > 0;
      const internalNumericalEvidenceRecords = numericalEvidenceRows
        .filter((evidence) => evidence?.sourceTier?.tier === INTERNAL_NUMERICAL_EVIDENCE_TIER).length;
      const hasInternalNumericalEvidence = internalNumericalEvidenceRecords > 0;
      const fragmentAuthorityTruthEligible = fragment?.sourceTier?.authorityTruthEligible === true;
      const authorityTruthEligibleNumericalEvidenceRecords = numericalEvidenceRows
        .filter((evidence) => evidence?.sourceTier?.authorityTruthEligible === true).length;
      const cell = cells.get(key);
      if (!isPlaceholder && cell.reviewExamples.length < 3) {
        cell.reviewExamples.push(compactReviewExample(
          fragment,
          rel,
          numericalEvidenceRows,
          internalNumericalEvidenceRecords,
          authorityTruthEligibleNumericalEvidenceRecords,
        ));
      }

      fragmentCount += 1;
      incrementCount(fragmentSourceTierCounts, fragment?.sourceTier?.tier);
      if (fragmentAuthorityTruthEligible) {
        authorityTruthEligibleFragmentCount += 1;
        cell.authorityTruthEligibleFragments += 1;
      }
      for (const evidence of numericalEvidenceRows) {
        numericalEvidenceRecordCount += 1;
        incrementCount(numericalEvidenceSourceTierCounts, evidence?.sourceTier?.tier);
        if (evidence?.sourceTier?.tier === INTERNAL_NUMERICAL_EVIDENCE_TIER) {
          internalNumericalEvidenceRecordCount += 1;
        }
        if (evidence?.sourceTier?.authorityTruthEligible === true) {
          authorityTruthEligibleNumericalEvidenceCount += 1;
          cell.authorityTruthEligibleNumericalEvidenceRecords += 1;
        }
      }
      cell.internalNumericalEvidenceRecords += internalNumericalEvidenceRecords;
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
      if (depth === 'expert' && hasInternalNumericalEvidence) {
        expertInternalNumericalEvidenceFragmentCount += 1;
        cell.expertInternalNumericalEvidenceFragments += 1;
      }

      bumpBucket(categoryTotals, category, {
        totalFragments: 1,
        authoredFragments: isPlaceholder ? 0 : 1,
        placeholderFragments: isPlaceholder ? 1 : 0,
        expertNumericalEvidenceFragments: depth === 'expert' && hasNumericalEvidence ? 1 : 0,
        expertInternalNumericalEvidenceFragments: depth === 'expert' && hasInternalNumericalEvidence ? 1 : 0,
        internalNumericalEvidenceRecords,
        authorityTruthEligibleFragments: fragmentAuthorityTruthEligible ? 1 : 0,
        authorityTruthEligibleNumericalEvidenceRecords,
      });
      bumpBucket(periodTotals, period, {
        totalFragments: 1,
        authoredFragments: isPlaceholder ? 0 : 1,
        placeholderFragments: isPlaceholder ? 1 : 0,
        expertNumericalEvidenceFragments: depth === 'expert' && hasNumericalEvidence ? 1 : 0,
        expertInternalNumericalEvidenceFragments: depth === 'expert' && hasInternalNumericalEvidence ? 1 : 0,
        internalNumericalEvidenceRecords,
        authorityTruthEligibleFragments: fragmentAuthorityTruthEligible ? 1 : 0,
        authorityTruthEligibleNumericalEvidenceRecords,
      });
      bumpBucket(depthTotals, depth, {
        totalFragments: 1,
        authoredFragments: isPlaceholder ? 0 : 1,
        placeholderFragments: isPlaceholder ? 1 : 0,
        expertNumericalEvidenceFragments: depth === 'expert' && hasNumericalEvidence ? 1 : 0,
        expertInternalNumericalEvidenceFragments: depth === 'expert' && hasInternalNumericalEvidence ? 1 : 0,
        internalNumericalEvidenceRecords,
        authorityTruthEligibleFragments: fragmentAuthorityTruthEligible ? 1 : 0,
        authorityTruthEligibleNumericalEvidenceRecords,
      });

      for (const field of gatingFields) {
        const values = fragment?.gating?.[field];
        if (!Array.isArray(values) || values.length === 0) continue;
        axisUsage[field].fragmentCount += 1;
        if (depth === 'expert') {
          expertAxisUsage[field].fragmentCount += 1;
        }
        cell.gatingUsage[field].fragmentCount += 1;
        const cellValues = new Set(cell.gatingUsage[field].values);
        for (const value of values) {
          axisUsage[field].values.add(value);
          if (depth === 'expert') {
            expertAxisUsage[field].values.add(value);
          }
          cellValues.add(value);
          bumpAxisValueCounts(axisValueCounts[field], value, isPlaceholder);
          if (depth === 'expert') {
            bumpAxisValueCounts(expertAxisValueCounts[field], value, isPlaceholder);
          }
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
  const axisValueCoverage = buildAxisValueCoverage(axisUsage, allowedGatingValues);
  const axisValueGapCount = countAxisValueGaps(axisValueCoverage);
  const axisValueDensity = buildAxisValueDensity(axisValueCoverage, axisValueCounts);
  const thinAxisValues = listThinAxisValues(axisValueDensity, minAuthored);
  const thinAxisFieldSummary = summarizeThinAxisValues(thinAxisValues, minAuthored);
  const expertAxisValueCoverage = buildAxisValueCoverage(expertAxisUsage, allowedGatingValues);
  const expertAxisValueGapCount = countAxisValueGaps(expertAxisValueCoverage);
  const expertAxisValueDensity = buildAxisValueDensity(expertAxisValueCoverage, expertAxisValueCounts);
  const thinExpertAxisValues = listThinAxisValues(expertAxisValueDensity, minAuthored);
  const thinExpertAxisFieldSummary = summarizeThinAxisValues(thinExpertAxisValues, minAuthored);
  const expertCells = cellList.filter((cell) => cell.depth === 'expert');
  const expertNumericalEvidenceGapCells = expertCells
    .filter((cell) => cell.expertNumericalEvidenceFragments < minExpertNumericalEvidence)
    .map(({ category, period, depth, authoredFragments, expertNumericalEvidenceFragments }) => ({
      category,
      period,
      depth,
      authoredFragments,
      expertNumericalEvidenceFragments,
      requiredExpertNumericalEvidenceFragments: minExpertNumericalEvidence,
      deficit: minExpertNumericalEvidence - expertNumericalEvidenceFragments,
    }))
    .sort((a, b) =>
      b.deficit - a.deficit ||
      b.authoredFragments - a.authoredFragments ||
      a.category.localeCompare(b.category) ||
      a.period.localeCompare(b.period));

  return {
    schemaVersion: 'spring-ts.narrative-coverage-report.v1',
    generatedAt: new Date().toISOString(),
    minAuthoredThreshold: minAuthored,
    minExpertNumericalEvidenceThreshold: minExpertNumericalEvidence,
    minAuthorityTruthEligibleFragmentThreshold: minAuthorityTruthEligibleFragments,
    minAuthorityTruthEligibleNumericalEvidenceThreshold: minAuthorityTruthEligibleNumericalEvidence,
    maxThinExpertAxisValueThreshold: maxThinExpertAxisValues,
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
      expertInternalNumericalEvidenceFragmentCount,
      internalNumericalEvidenceRecordCount,
      expertCellCount: expertCells.length,
      expertCellsWithNumericalEvidenceCount: expertCells
        .filter((cell) => cell.expertNumericalEvidenceFragments > 0).length,
      expertCellsWithInternalNumericalEvidenceCount: expertCells
        .filter((cell) => cell.expertInternalNumericalEvidenceFragments > 0).length,
      expertNumericalEvidenceGapCellCount: expertNumericalEvidenceGapCells.length,
      missingCellCount: missingCells.length,
      placeholderOnlyCellCount: placeholderOnlyCells.length,
      underfilledCellCount: underfilledCells.length,
      axisValueGapCount,
      thinAxisValueCount: thinAxisValues.length,
      thinAxisFieldCount: thinAxisFieldSummary.length,
      expertAxisValueGapCount,
      thinExpertAxisValueCount: thinExpertAxisValues.length,
      thinExpertAxisFieldCount: thinExpertAxisFieldSummary.length,
      thinExpertAxisValueExcessToThreshold: maxThinExpertAxisValues === null
        ? 0
        : Math.max(0, thinExpertAxisValues.length - maxThinExpertAxisValues),
    },
    axisUsage: serializeAxisUsage(axisUsage),
    expertAxisUsage: serializeAxisUsage(expertAxisUsage),
    axisValueCoverage,
    expertAxisValueCoverage,
    axisValueDensity,
    expertAxisValueDensity,
    categoryTotals: [...categoryTotals.values()].sort((a, b) => a.key.localeCompare(b.key)),
    periodTotals: [...periodTotals.values()].sort((a, b) => a.key.localeCompare(b.key)),
    depthTotals: [...depthTotals.values()].sort((a, b) => a.key.localeCompare(b.key)),
    missingCells,
    placeholderOnlyCells,
    underfilledCells,
    thinAxisValues,
    thinAxisFieldSummary,
    thinExpertAxisValues,
    thinExpertAxisFieldSummary,
    expertNumericalEvidenceGapCells,
    sourceTierSummary: {
      fragmentTierCounts: toSortedRecord(fragmentSourceTierCounts),
      numericalEvidenceTierCounts: toSortedRecord(numericalEvidenceSourceTierCounts),
      numericalEvidenceRecordCount,
      internalNumericalEvidenceRecordCount,
      authorityTruthEligibleFragmentCount,
      authorityTruthEligibleNumericalEvidenceCount,
      authorityTruthEligibleFragmentDeficitToThreshold: Math.max(
        0,
        minAuthorityTruthEligibleFragments - authorityTruthEligibleFragmentCount,
      ),
      authorityTruthEligibleNumericalEvidenceDeficitToThreshold: Math.max(
        0,
        minAuthorityTruthEligibleNumericalEvidence - authorityTruthEligibleNumericalEvidenceCount,
      ),
    },
    cells: cellList,
  };
}

function getThresholdFailures(report) {
  const sourceTierSummary = report.sourceTierSummary ?? {};
  const failures = [];
  if ((sourceTierSummary.authorityTruthEligibleFragmentDeficitToThreshold ?? 0) > 0) {
    failures.push(
      `authorityTruthEligible fragments ${sourceTierSummary.authorityTruthEligibleFragmentCount ?? 0}/${report.minAuthorityTruthEligibleFragmentThreshold}`,
    );
  }
  if ((sourceTierSummary.authorityTruthEligibleNumericalEvidenceDeficitToThreshold ?? 0) > 0) {
    failures.push(
      `authorityTruthEligible numericalEvidence ${sourceTierSummary.authorityTruthEligibleNumericalEvidenceCount ?? 0}/${report.minAuthorityTruthEligibleNumericalEvidenceThreshold}`,
    );
  }
  if (Number.isInteger(report.maxThinExpertAxisValueThreshold) &&
    (report.totals?.thinExpertAxisValueExcessToThreshold ?? 0) > 0) {
    failures.push(
      `thin expert axis values ${report.totals?.thinExpertAxisValueCount ?? 0}/${report.maxThinExpertAxisValueThreshold}`,
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
  lines.push('Narrative Coverage Report');
  lines.push(`Bundles: ${report.totals.bundleCount}`);
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.authoredFragmentCount} authored, ${report.totals.placeholderFragmentCount} placeholder`);
  lines.push(`Cells: ${report.totals.cellsWithFragments}/${report.totals.expectedCells} populated, ${report.totals.cellsWithAuthoredFragments}/${report.totals.expectedCells} authored`);
  lines.push(`Missing cells: ${report.totals.missingCellCount}`);
  lines.push(`Placeholder-only cells: ${report.totals.placeholderOnlyCellCount}`);
  lines.push(`Underfilled cells (<${report.minAuthoredThreshold} authored): ${report.totals.underfilledCellCount}`);
  lines.push(`Axis value gaps: ${report.totals.axisValueGapCount}`);
  lines.push(`Thin axis values (<${report.minAuthoredThreshold} authored): ${report.totals.thinAxisValueCount}`);
  lines.push(`Expert axis value gaps: ${report.totals.expertAxisValueGapCount}`);
  lines.push(`Thin expert axis values (<${report.minAuthoredThreshold} authored): ${report.totals.thinExpertAxisValueCount}`);
  if (Number.isInteger(report.maxThinExpertAxisValueThreshold)) {
    lines.push(`Thin expert axis value threshold: ${report.totals.thinExpertAxisValueCount}/${report.maxThinExpertAxisValueThreshold} allowed, excess=${report.totals.thinExpertAxisValueExcessToThreshold}`);
  }
  lines.push(`Expert numerical evidence fragments: ${report.totals.expertNumericalEvidenceFragmentCount}`);
  lines.push(`Expert numerical evidence cells: ${report.totals.expertCellsWithNumericalEvidenceCount}/${report.totals.expertCellCount}`);
  lines.push(`Expert numerical evidence gaps (<${report.minExpertNumericalEvidenceThreshold}): ${report.totals.expertNumericalEvidenceGapCellCount}`);
  lines.push(`Source tiers: fragments=${formatCounts(report.sourceTierSummary?.fragmentTierCounts)}; numericalEvidence=${formatCounts(report.sourceTierSummary?.numericalEvidenceTierCounts)}`);
  lines.push(`Authority-truth eligible: fragments=${report.sourceTierSummary?.authorityTruthEligibleFragmentCount ?? 0}; numericalEvidence=${report.sourceTierSummary?.authorityTruthEligibleNumericalEvidenceCount ?? 0}`);
  lines.push('');
  lines.push('Gating usage:');
  for (const [field, usage] of Object.entries(report.axisUsage)) {
    lines.push(`- ${field}: ${usage.fragmentCount} fragments; values=${usage.values.join(',') || 'none'}`);
  }
  lines.push('');
  lines.push('Expert gating usage:');
  for (const [field, usage] of Object.entries(report.expertAxisUsage)) {
    lines.push(`- ${field}: ${usage.fragmentCount} fragments; values=${usage.values.join(',') || 'none'}`);
  }
  const gapRows = Object.entries(report.axisValueCoverage)
    .filter(([, coverage]) => coverage.missingValueCount > 0)
    .sort((a, b) => b[1].missingValueCount - a[1].missingValueCount || a[0].localeCompare(b[0]));
  if (gapRows.length > 0) {
    lines.push('');
    lines.push('Axis value gaps:');
    for (const [field, coverage] of gapRows) {
      lines.push(`- ${field}: missing ${coverage.missingValueCount}/${coverage.expectedValues?.length ?? 0} -> ${coverage.missingValues.join(',')}`);
    }
  }
  const expertGapRows = Object.entries(report.expertAxisValueCoverage)
    .filter(([, coverage]) => coverage.missingValueCount > 0)
    .sort((a, b) => b[1].missingValueCount - a[1].missingValueCount || a[0].localeCompare(b[0]));
  if (expertGapRows.length > 0) {
    lines.push('');
    lines.push('Expert axis value gaps:');
    for (const [field, coverage] of expertGapRows) {
      lines.push(`- ${field}: missing ${coverage.missingValueCount}/${coverage.expectedValues?.length ?? 0} -> ${coverage.missingValues.join(',')}`);
    }
  }
  if (report.underfilledCells.length > 0) {
    lines.push('');
    lines.push('Top underfilled cells:');
    for (const cell of report.underfilledCells.slice(0, 20)) {
      lines.push(`- ${cell.category}/${cell.period}/${cell.depth}: authored=${cell.authoredFragments}, placeholder=${cell.placeholderFragments}, expertEvidence=${cell.expertNumericalEvidenceFragments}`);
    }
  }
  if (report.thinAxisValues.length > 0) {
    lines.push('');
    lines.push('Thin axis field summary:');
    for (const row of report.thinAxisFieldSummary) {
      lines.push(`- ${row.field}: thinValues=${row.thinValueCount}, authoredDeficit=${row.authoredDeficitToThreshold}`);
    }
    lines.push('');
    lines.push('Top thin axis values:');
    for (const row of report.thinAxisValues.slice(0, 20)) {
      lines.push(`- ${row.field}=${row.value}: authored=${row.authoredFragments}, total=${row.fragmentCount}, placeholder=${row.placeholderFragments}`);
    }
  }
  if (report.thinExpertAxisValues.length > 0) {
    lines.push('');
    lines.push('Thin expert axis field summary:');
    for (const row of report.thinExpertAxisFieldSummary) {
      lines.push(`- ${row.field}: thinValues=${row.thinValueCount}, authoredDeficit=${row.authoredDeficitToThreshold}`);
    }
    lines.push('');
    lines.push('Top thin expert axis values:');
    for (const row of report.thinExpertAxisValues.slice(0, 20)) {
      lines.push(`- ${row.field}=${row.value}: authored=${row.authoredFragments}, total=${row.fragmentCount}, placeholder=${row.placeholderFragments}`);
    }
  }
  if (report.expertNumericalEvidenceGapCells.length > 0) {
    lines.push('');
    lines.push('Top expert numerical evidence gaps:');
    for (const cell of report.expertNumericalEvidenceGapCells.slice(0, 20)) {
      lines.push(`- ${cell.category}/${cell.period}: expertEvidence=${cell.expertNumericalEvidenceFragments}, authored=${cell.authoredFragments}, deficit=${cell.deficit}`);
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport({
    minAuthored: args.minAuthored,
    minExpertNumericalEvidence: args.minExpertNumericalEvidence,
    minAuthorityTruthEligibleFragments: args.minAuthorityTruthEligibleFragments,
    minAuthorityTruthEligibleNumericalEvidence: args.minAuthorityTruthEligibleNumericalEvidence,
    maxThinExpertAxisValues: args.maxThinExpertAxisValues,
  });
  const thresholdFailures = getThresholdFailures(report);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
  if (thresholdFailures.length > 0) {
    console.error(`Narrative coverage thresholds failed:\n- ${thresholdFailures.join('\n- ')}`);
    process.exit(1);
  }
}

export { buildReport, getThresholdFailures, renderHuman };
