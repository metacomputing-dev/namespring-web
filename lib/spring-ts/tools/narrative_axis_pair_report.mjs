#!/usr/bin/env node
/**
 * tools/narrative_axis_pair_report.mjs
 *
 * Reports authored narrative coverage for selected pairs of gating axes. This
 * complements the single-axis coverage report by exposing which cross-gated
 * combinations are still missing or thin as future narrative expansion targets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');
const NARRATIVE_SCHEMA_PATH = path.join(ROOT, 'test', 'baseline', 'schema', 'narrativeFragment.schema.json');

const DEFAULT_PAIRS = [
  ['agePhase', 'gender'],
  ['ageBand', 'gender'],
  ['birthSeason', 'currentSeason'],
  ['dayMasterElement', 'dayMasterStrength'],
  ['dayMasterElement', 'yongshinElement'],
  ['dayMasterStrength', 'yongshinAlignment'],
  ['gyeokguk', 'dayMasterStrength'],
  ['yongshinElement', 'yongshinAlignment'],
];

function parseArgs(argv) {
  const args = { json: false, maxMissing: 20, pairs: DEFAULT_PAIRS };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-missing=')) {
      const value = Number(arg.slice('--max-missing='.length));
      if (Number.isInteger(value) && value >= 0) args.maxMissing = value;
    } else if (arg.startsWith('--pairs=')) {
      args.pairs = arg
        .slice('--pairs='.length)
        .split(',')
        .map((pair) => pair.split(':').map((part) => part.trim()).filter(Boolean))
        .filter((pair) => pair.length === 2);
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

function comboKey(leftValue, rightValue) {
  return `${leftValue}|${rightValue}`;
}

function comboRecord(leftField, rightField, leftValue, rightValue, authoredFragments = 0) {
  return {
    [leftField]: leftValue,
    [rightField]: rightValue,
    authoredFragments,
  };
}

function buildPairReport(options = {}) {
  const allowedGatingValues = loadAllowedGatingValues();
  const pairs = options.pairs ?? DEFAULT_PAIRS;
  const maxMissing = options.maxMissing ?? 20;
  const bundles = listFragmentBundles(NARRATIVE_ROOT);
  const pairMaps = new Map();
  const observedValues = new Map();

  for (const [leftField, rightField] of pairs) {
    pairMaps.set(`${leftField}:${rightField}`, new Map());
    observedValues.set(leftField, observedValues.get(leftField) ?? new Set());
    observedValues.set(rightField, observedValues.get(rightField) ?? new Set());
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

      for (const [leftField, rightField] of pairs) {
        const leftValues = fragment?.gating?.[leftField];
        const rightValues = fragment?.gating?.[rightField];
        if (Array.isArray(leftValues)) {
          for (const value of leftValues) observedValues.get(leftField)?.add(value);
        }
        if (Array.isArray(rightValues)) {
          for (const value of rightValues) observedValues.get(rightField)?.add(value);
        }
        if (!Array.isArray(leftValues) || leftValues.length === 0) continue;
        if (!Array.isArray(rightValues) || rightValues.length === 0) continue;

        const pairMap = pairMaps.get(`${leftField}:${rightField}`);
        for (const leftValue of leftValues) {
          for (const rightValue of rightValues) {
            const key = comboKey(leftValue, rightValue);
            pairMap.set(key, (pairMap.get(key) ?? 0) + 1);
          }
        }
      }
    }
  }

  const pairReports = pairs.map(([leftField, rightField]) => {
    const leftExpected = Array.isArray(allowedGatingValues[leftField])
      ? allowedGatingValues[leftField]
      : [...(observedValues.get(leftField) ?? [])].sort();
    const rightExpected = Array.isArray(allowedGatingValues[rightField])
      ? allowedGatingValues[rightField]
      : [...(observedValues.get(rightField) ?? [])].sort();
    const pairMap = pairMaps.get(`${leftField}:${rightField}`) ?? new Map();
    const expectedCombinationCount = leftExpected.length * rightExpected.length;
    const coveredCombinations = [];
    const missingCombinations = [];

    for (const leftValue of leftExpected) {
      for (const rightValue of rightExpected) {
        const count = pairMap.get(comboKey(leftValue, rightValue)) ?? 0;
        const record = comboRecord(leftField, rightField, leftValue, rightValue, count);
        if (count > 0) {
          coveredCombinations.push(record);
        } else {
          missingCombinations.push(record);
        }
      }
    }

    coveredCombinations.sort((a, b) =>
      a.authoredFragments - b.authoredFragments ||
      String(a[leftField]).localeCompare(String(b[leftField])) ||
      String(a[rightField]).localeCompare(String(b[rightField])));
    missingCombinations.sort((a, b) =>
      String(a[leftField]).localeCompare(String(b[leftField])) ||
      String(a[rightField]).localeCompare(String(b[rightField])));

    const coveredCombinationCount = coveredCombinations.length;
    const missingCombinationCount = missingCombinations.length;
    const pairAuthoredFragmentCount = [...pairMap.values()].reduce((sum, count) => sum + count, 0);
    return {
      key: `${leftField}:${rightField}`,
      fields: [leftField, rightField],
      expectedValues: {
        [leftField]: leftExpected,
        [rightField]: rightExpected,
      },
      expectedCombinationCount,
      coveredCombinationCount,
      missingCombinationCount,
      coverageRatio: expectedCombinationCount === 0
        ? 0
        : Number((coveredCombinationCount / expectedCombinationCount).toFixed(4)),
      authoredFragmentCount: pairAuthoredFragmentCount,
      sparsestCoveredCombinations: coveredCombinations.slice(0, maxMissing),
      missingCombinations: missingCombinations.slice(0, maxMissing),
    };
  }).sort((a, b) =>
    b.missingCombinationCount - a.missingCombinationCount ||
    a.coverageRatio - b.coverageRatio ||
    a.key.localeCompare(b.key));

  return {
    schemaVersion: 'spring-ts.narrative-axis-pair-report.v1',
    generatedAt: new Date().toISOString(),
    totals: {
      bundleCount: bundles.length,
      fragmentCount,
      authoredFragmentCount,
      pairCount: pairReports.length,
      missingCombinationCount: pairReports.reduce((sum, pair) => sum + pair.missingCombinationCount, 0),
    },
    pairs: pairReports,
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push('Narrative Axis Pair Report');
  lines.push(`Bundles: ${report.totals.bundleCount}`);
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.authoredFragmentCount} authored`);
  lines.push(`Pairs: ${report.totals.pairCount}`);
  lines.push(`Missing pair combinations: ${report.totals.missingCombinationCount}`);
  lines.push('');
  for (const pair of report.pairs) {
    lines.push(`${pair.key}: ${pair.coveredCombinationCount}/${pair.expectedCombinationCount} covered (${pair.coverageRatio})`);
    lines.push(`  authored pair hits: ${pair.authoredFragmentCount}`);
    if (pair.missingCombinations.length > 0) {
      lines.push('  top missing:');
      for (const combo of pair.missingCombinations) {
        const [leftField, rightField] = pair.fields;
        lines.push(`  - ${leftField}=${combo[leftField]}, ${rightField}=${combo[rightField]}`);
      }
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildPairReport({ pairs: args.pairs, maxMissing: args.maxMissing });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
}

export { buildPairReport, renderHuman };
