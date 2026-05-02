#!/usr/bin/env node
/**
 * tools/narrative_axis_tuple_report.mjs
 *
 * Reports authored narrative coverage for selected 3-axis combinations. Pair
 * density can be complete while important triple intersections remain sparse,
 * so this report is intended as an observation/planning tool for the next
 * narrative expansion pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');
const NARRATIVE_SCHEMA_PATH = path.join(ROOT, 'test', 'baseline', 'schema', 'narrativeFragment.schema.json');

const DEFAULT_TUPLES = [
  ['dayMasterElement', 'yongshinElement', 'dayMasterStrength'],
  ['gyeokguk', 'dayMasterStrength', 'dayMasterElement'],
  ['birthSeason', 'currentSeason', 'yongshinAlignment'],
];

function parseArgs(argv) {
  const args = {
    json: false,
    maxMissing: 20,
    maxThin: 20,
    maxTop: 20,
    minAuthored: 1,
    maxMissingCombinationThreshold: null,
    maxThinCombinationThreshold: null,
    tuples: DEFAULT_TUPLES,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-missing=')) {
      const value = Number(arg.slice('--max-missing='.length));
      if (Number.isInteger(value) && value >= 0) args.maxMissing = value;
    } else if (arg.startsWith('--max-thin=')) {
      const value = Number(arg.slice('--max-thin='.length));
      if (Number.isInteger(value) && value >= 0) args.maxThin = value;
    } else if (arg.startsWith('--max-top=')) {
      const value = Number(arg.slice('--max-top='.length));
      if (Number.isInteger(value) && value >= 0) args.maxTop = value;
    } else if (arg.startsWith('--min-authored=')) {
      const value = Number(arg.slice('--min-authored='.length));
      if (Number.isInteger(value) && value >= 0) args.minAuthored = value;
    } else if (arg.startsWith('--max-missing-combinations=')) {
      const value = Number(arg.slice('--max-missing-combinations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxMissingCombinationThreshold = value;
    } else if (arg.startsWith('--max-thin-combinations=')) {
      const value = Number(arg.slice('--max-thin-combinations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxThinCombinationThreshold = value;
    } else if (arg.startsWith('--tuples=')) {
      args.tuples = arg
        .slice('--tuples='.length)
        .split(',')
        .map((tuple) => tuple.split(':').map((part) => part.trim()).filter(Boolean))
        .filter((tuple) => tuple.length >= 3);
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

function loadAllowedGatingValues() {
  const schema = readJson(NARRATIVE_SCHEMA_PATH);
  const properties = schema?.properties?.gating?.properties ?? {};
  return Object.fromEntries(Object.entries(properties).map(([field, definition]) => {
    const values = definition?.items?.enum;
    return [field, Array.isArray(values) ? [...values].sort() : null];
  }));
}

function isPlaceholderFragment(relPath, fragment) {
  return relPath.includes('/_seed/') || String(fragment?.fragmentId ?? '').includes('.placeholder.');
}

function combinationKey(values) {
  return values.join('|');
}

function combinationRecord(fields, values, authoredFragments = 0) {
  return {
    values: Object.fromEntries(fields.map((field, index) => [field, values[index]])),
    authoredFragments,
  };
}

function cartesian(valuesByField) {
  return valuesByField.reduce((acc, values) => {
    const next = [];
    for (const prefix of acc) {
      for (const value of values) {
        next.push([...prefix, value]);
      }
    }
    return next;
  }, [[]]);
}

function compareRecord(a, b) {
  return JSON.stringify(a.values).localeCompare(JSON.stringify(b.values));
}

function buildTupleReport(options = {}) {
  const allowedGatingValues = loadAllowedGatingValues();
  const tuples = options.tuples ?? DEFAULT_TUPLES;
  const maxMissing = options.maxMissing ?? 20;
  const maxThin = options.maxThin ?? 20;
  const maxTop = options.maxTop ?? 20;
  const minAuthored = options.minAuthored ?? 1;
  const maxMissingCombinationThreshold = options.maxMissingCombinationThreshold ?? null;
  const maxThinCombinationThreshold = options.maxThinCombinationThreshold ?? null;
  const bundles = listFragmentBundles(NARRATIVE_ROOT);
  const tupleMaps = new Map();
  const observedValues = new Map();

  for (const fields of tuples) {
    tupleMaps.set(fields.join(':'), new Map());
    for (const field of fields) {
      observedValues.set(field, observedValues.get(field) ?? new Set());
    }
  }

  let authoredFragmentCount = 0;
  let fragmentCount = 0;

  for (const file of bundles) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const bundle = readJson(file);
    for (const fragment of bundle.fragments ?? []) {
      fragmentCount += 1;
      if (isPlaceholderFragment(rel, fragment)) continue;
      authoredFragmentCount += 1;

      for (const fields of tuples) {
        const valueLists = fields.map((field) => fragment?.gating?.[field]);
        for (let index = 0; index < fields.length; index += 1) {
          const values = valueLists[index];
          if (Array.isArray(values)) {
            for (const value of values) observedValues.get(fields[index])?.add(value);
          }
        }
        if (valueLists.some((values) => !Array.isArray(values) || values.length === 0)) continue;

        const tupleMap = tupleMaps.get(fields.join(':'));
        for (const values of cartesian(valueLists)) {
          const key = combinationKey(values);
          tupleMap.set(key, (tupleMap.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const tupleReportsWithInternal = tuples.map((fields) => {
    const expectedValues = Object.fromEntries(fields.map((field) => {
      const allowed = allowedGatingValues[field];
      const values = Array.isArray(allowed)
        ? allowed
        : [...(observedValues.get(field) ?? [])].sort();
      return [field, values];
    }));
    const expectedCombinations = cartesian(fields.map((field) => expectedValues[field]));
    const tupleMap = tupleMaps.get(fields.join(':')) ?? new Map();
    const coveredCombinations = [];
    const missingCombinations = [];
    const thinCombinations = [];

    for (const values of expectedCombinations) {
      const count = tupleMap.get(combinationKey(values)) ?? 0;
      const record = combinationRecord(fields, values, count);
      if (count > 0) {
        coveredCombinations.push(record);
        if (count < minAuthored) {
          thinCombinations.push({
            ...record,
            requiredAuthoredFragments: minAuthored,
            deficit: minAuthored - count,
          });
        }
      } else {
        missingCombinations.push(record);
      }
    }

    coveredCombinations.sort((a, b) => a.authoredFragments - b.authoredFragments || compareRecord(a, b));
    missingCombinations.sort(compareRecord);
    thinCombinations.sort((a, b) =>
      b.deficit - a.deficit ||
      a.authoredFragments - b.authoredFragments ||
      compareRecord(a, b));

    const expectedCombinationCount = expectedCombinations.length;
    const coveredCombinationCount = coveredCombinations.length;
    const missingCombinationCount = missingCombinations.length;
    const thinCombinationCount = thinCombinations.length;
    const authoredDeficitToThreshold = thinCombinations.reduce((sum, combo) => sum + combo.deficit, 0);
    const tupleAuthoredFragmentCount = [...tupleMap.values()].reduce((sum, count) => sum + count, 0);
    const key = fields.join(':');
    const allThinCombinations = thinCombinations.map((combo) => ({ tupleKey: key, fields, ...combo }));
    const allMissingCombinations = missingCombinations.map((combo) => ({ tupleKey: key, fields, ...combo }));

    return {
      key,
      fields,
      expectedValues,
      expectedCombinationCount,
      coveredCombinationCount,
      missingCombinationCount,
      thinCombinationCount,
      coverageRatio: expectedCombinationCount === 0
        ? 0
        : Number((coveredCombinationCount / expectedCombinationCount).toFixed(4)),
      authoredFragmentCount: tupleAuthoredFragmentCount,
      authoredDeficitToThreshold,
      sparsestCoveredCombinations: coveredCombinations.slice(0, maxMissing),
      missingCombinations: missingCombinations.slice(0, maxMissing),
      thinCombinations: thinCombinations.slice(0, maxThin),
      allMissingCombinations,
      allThinCombinations,
    };
  }).sort((a, b) =>
    b.missingCombinationCount - a.missingCombinationCount ||
    b.authoredDeficitToThreshold - a.authoredDeficitToThreshold ||
    a.coverageRatio - b.coverageRatio ||
    a.key.localeCompare(b.key));

  const missingCombinationCount = tupleReportsWithInternal.reduce((sum, tuple) => sum + tuple.missingCombinationCount, 0);
  const thinCombinationCount = tupleReportsWithInternal.reduce((sum, tuple) => sum + tuple.thinCombinationCount, 0);
  const thinCombinationDeficit = tupleReportsWithInternal.reduce((sum, tuple) => sum + tuple.authoredDeficitToThreshold, 0);
  const missingCombinationExcessToThreshold = maxMissingCombinationThreshold === null
    ? 0
    : Math.max(0, missingCombinationCount - maxMissingCombinationThreshold);
  const thinCombinationExcessToThreshold = maxThinCombinationThreshold === null
    ? 0
    : Math.max(0, thinCombinationCount - maxThinCombinationThreshold);
  const topMissingCombinations = tupleReportsWithInternal
    .flatMap((tuple) => tuple.allMissingCombinations)
    .sort((a, b) => a.tupleKey.localeCompare(b.tupleKey) || compareRecord(a, b))
    .slice(0, maxTop);
  const topThinCombinations = tupleReportsWithInternal
    .flatMap((tuple) => tuple.allThinCombinations)
    .sort((a, b) =>
      b.deficit - a.deficit ||
      a.authoredFragments - b.authoredFragments ||
      a.tupleKey.localeCompare(b.tupleKey) ||
      compareRecord(a, b))
    .slice(0, maxTop);
  const tupleReports = tupleReportsWithInternal.map(({ allMissingCombinations, allThinCombinations, ...tuple }) => tuple);

  return {
    schemaVersion: 'spring-ts.narrative-axis-tuple-report.v1',
    generatedAt: new Date().toISOString(),
    minAuthoredThreshold: minAuthored,
    maxMissingCombinationThreshold,
    maxThinCombinationThreshold,
    totals: {
      bundleCount: bundles.length,
      fragmentCount,
      authoredFragmentCount,
      tupleCount: tupleReports.length,
      missingCombinationCount,
      thinCombinationCount,
      thinCombinationDeficit,
      missingCombinationExcessToThreshold,
      thinCombinationExcessToThreshold,
    },
    topMissingCombinations,
    topThinCombinations,
    tuples: tupleReports,
  };
}

function getThresholdFailures(report) {
  const failures = [];
  if ((report.totals?.missingCombinationExcessToThreshold ?? 0) > 0) {
    failures.push(
      `missing tuple combinations ${report.totals.missingCombinationCount}/${report.maxMissingCombinationThreshold}`,
    );
  }
  if ((report.totals?.thinCombinationExcessToThreshold ?? 0) > 0) {
    failures.push(
      `thin tuple combinations ${report.totals.thinCombinationCount}/${report.maxThinCombinationThreshold}`,
    );
  }
  return failures;
}

function formatCombination(combo) {
  return combo.fields.map((field) => `${field}=${combo.values[field]}`).join(', ');
}

function renderHuman(report) {
  const lines = [];
  lines.push('Narrative Axis Tuple Report');
  lines.push(`Bundles: ${report.totals.bundleCount}`);
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.authoredFragmentCount} authored`);
  lines.push(`Tuples: ${report.totals.tupleCount}`);
  lines.push(`Missing tuple combinations: ${report.totals.missingCombinationCount}`);
  lines.push(`Thin tuple combinations (<${report.minAuthoredThreshold} authored): ${report.totals.thinCombinationCount}, deficit=${report.totals.thinCombinationDeficit}`);
  lines.push('');
  if (report.topMissingCombinations.length > 0) {
    lines.push('Top missing combinations:');
    for (const combo of report.topMissingCombinations) {
      lines.push(`- ${combo.tupleKey}: ${formatCombination(combo)}`);
    }
    lines.push('');
  }
  if (report.topThinCombinations.length > 0) {
    lines.push('Top thin combinations:');
    for (const combo of report.topThinCombinations) {
      lines.push(`- ${combo.tupleKey}: ${formatCombination(combo)}; authored=${combo.authoredFragments}, deficit=${combo.deficit}`);
    }
    lines.push('');
  }
  for (const tuple of report.tuples) {
    lines.push(`${tuple.key}: ${tuple.coveredCombinationCount}/${tuple.expectedCombinationCount} covered (${tuple.coverageRatio})`);
    lines.push(`  authored tuple hits: ${tuple.authoredFragmentCount}; missing=${tuple.missingCombinationCount}; thin=${tuple.thinCombinationCount}; deficit=${tuple.authoredDeficitToThreshold}`);
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildTupleReport({
    tuples: args.tuples,
    maxMissing: args.maxMissing,
    maxThin: args.maxThin,
    maxTop: args.maxTop,
    minAuthored: args.minAuthored,
    maxMissingCombinationThreshold: args.maxMissingCombinationThreshold,
    maxThinCombinationThreshold: args.maxThinCombinationThreshold,
  });
  const thresholdFailures = getThresholdFailures(report);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
  if (thresholdFailures.length > 0) {
    console.error(`Narrative axis-tuple thresholds failed:\n- ${thresholdFailures.join('\n- ')}`);
    process.exit(1);
  }
}

export { buildTupleReport, getThresholdFailures, renderHuman };
