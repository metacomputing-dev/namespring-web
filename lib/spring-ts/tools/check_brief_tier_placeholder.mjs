#!/usr/bin/env node
/**
 * tools/check_brief_tier_placeholder.mjs
 *
 * Phase 24 Agent A2 -- brief-tier PLACEHOLDER lock gate.
 *
 * Locks the result of P23-A1, which closed the 8-cell brief tier
 * PLACEHOLDER residue (`overall × {today, thisWeek, thisMonth,
 * thisYear}` for minor 10-19 + `health_stress × today` for child 0-9)
 * by authoring the missing minor-band brief fragments. After P23-A1,
 * `artifacts/sample-outputs-2026-05-05-phase3/*.json` contains zero
 * occurrences of the brief PLACEHOLDER. This gate prevents any
 * future regression that would re-introduce the fallback into a
 * service-visible brief headline.
 *
 * Source of truth for the placeholder string:
 *   src/report/tiered/build-tiered-matrix.ts:49 --
 *   `const PLACEHOLDER_BRIEF: BriefFortuneText =
 *     Object.freeze({ headline: '준비 중인 흐름이에요.' });`
 *
 * Detection is exact-match (`===`) against the literal headline. The
 * standard/expert tiers use `EMPTY_PARAGRAPHS` (no string sentinel),
 * which is P24-A1's `ci:standard-paragraph-floor` territory; this
 * gate intentionally does not overlap.
 *
 * Scope: every `payload.tieredMatrix.periods.<period>.overall.brief.headline`
 * and `payload.tieredMatrix.periods.<period>.byCategory.<category>.brief.headline`
 * in the regenerated sample corpus (32 tiered fixtures × 5 periods ×
 * (1 overall + 10 categories) = 1760 cells). Fixtures that do not
 * carry a tieredMatrix payload (current-fortune, spring-report-vector,
 * candidate-summaries, diff-legacy-vs-tiered) are recorded as
 * `fixturesSkipped` and do not contribute to the cell count.
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 when
 *     violations exceed `--max-violations`.
 *   - `--json`: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate fails
 *                                (default: 0 -- any violation fails)
 *   --max-samples=N              cap printed/JSON samples (default: 50)
 *   --root=<path>                override spring-ts root (defaults to
 *                                the directory two levels above this
 *                                script)
 *   --samples-dir=<path>         override sample-output directory
 *                                (default:
 *                                artifacts/sample-outputs-2026-05-05-phase3)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAMPLES_REL = 'artifacts/sample-outputs-2026-05-05-phase3';

// Mirrors src/report/tiered/build-tiered-matrix.ts:49.
const PLACEHOLDER_BRIEF_HEADLINE = '준비 중인 흐름이에요.';

const PERIOD_ORDER = Object.freeze([
  'life',
  'today',
  'thisWeek',
  'thisMonth',
  'thisYear',
]);

const CATEGORY_ORDER = Object.freeze([
  'wealth',
  'health',
  'academic',
  'romance',
  'family',
  'career',
  'study_document',
  'expression_children',
  'health_stress',
  'movement',
]);

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    maxSamples: 50,
    root: DEFAULT_ROOT,
    samplesDir: null,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-violations=')) {
      const value = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxViolations = value;
    } else if (arg.startsWith('--max-samples=')) {
      const value = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(value) && value >= 0) args.maxSamples = value;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--samples-dir=')) {
      args.samplesDir = path.resolve(arg.slice('--samples-dir='.length));
    }
  }
  return args;
}

function listSampleFiles(samplesDir) {
  if (!fs.existsSync(samplesDir)) return [];
  return fs
    .readdirSync(samplesDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        entry.name !== 'index.json',
    )
    .map((entry) => entry.name)
    .sort();
}

function getPeriods(parsed) {
  const periods = parsed?.payload?.tieredMatrix?.periods;
  if (!periods || typeof periods !== 'object') return null;
  return periods;
}

function checkCell({ headline, file, trail, violations }) {
  if (typeof headline !== 'string') {
    // Missing or non-string headline is out-of-contract and should be
    // surfaced via the existing tiered shape tests rather than here;
    // this gate intentionally narrows to PLACEHOLDER_BRIEF only.
    return false;
  }
  if (headline !== PLACEHOLDER_BRIEF_HEADLINE) return false;
  violations.push({
    file,
    trail,
    headline,
  });
  return true;
}

function buildReport({ root, samplesDir, maxSamples }) {
  const resolvedSamplesDir =
    samplesDir ?? path.join(root, DEFAULT_SAMPLES_REL);
  const fileNames = listSampleFiles(resolvedSamplesDir);

  const violations = [];
  const fixturesSkipped = [];
  let fixturesScanned = 0;
  let cellsScanned = 0;

  for (const fileName of fileNames) {
    const fullPath = path.join(resolvedSamplesDir, fileName);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch (error) {
      fixturesSkipped.push({
        file: fileName,
        reason: `parse error: ${error?.message ?? String(error)}`,
      });
      continue;
    }
    const periods = getPeriods(parsed);
    if (!periods) {
      fixturesSkipped.push({
        file: fileName,
        reason: 'no payload.tieredMatrix.periods',
      });
      continue;
    }
    fixturesScanned += 1;

    for (const periodKind of PERIOD_ORDER) {
      const period = periods[periodKind];
      if (!period || typeof period !== 'object') continue;

      const overallBrief = period.overall?.brief;
      if (overallBrief && typeof overallBrief === 'object') {
        cellsScanned += 1;
        checkCell({
          headline: overallBrief.headline,
          file: fileName,
          trail: `payload.tieredMatrix.periods.${periodKind}.overall.brief.headline`,
          violations,
        });
      }

      const byCategory = period.byCategory;
      if (byCategory && typeof byCategory === 'object') {
        for (const categoryId of CATEGORY_ORDER) {
          const cell = byCategory[categoryId];
          const cellBrief = cell?.brief;
          if (!cellBrief || typeof cellBrief !== 'object') continue;
          cellsScanned += 1;
          checkCell({
            headline: cellBrief.headline,
            file: fileName,
            trail: `payload.tieredMatrix.periods.${periodKind}.byCategory.${categoryId}.brief.headline`,
            violations,
          });
        }
      }
    }
  }

  return {
    policy: 'spring-ts.brief-tier-placeholder.v1',
    placeholder: PLACEHOLDER_BRIEF_HEADLINE,
    samplesDir: path
      .relative(root, resolvedSamplesDir)
      .split(path.sep)
      .join('/'),
    fixturesScanned,
    fixturesSkipped,
    cellsScanned,
    totalViolations: violations.length,
    samples: violations.slice(0, maxSamples),
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push(
    `Brief tier PLACEHOLDER: fixturesScanned=${report.fixturesScanned}, cellsScanned=${report.cellsScanned}, violations=${report.totalViolations}`,
  );
  lines.push(`  samplesDir: ${report.samplesDir}`);
  lines.push(`  placeholder: ${JSON.stringify(report.placeholder)}`);
  if (report.fixturesSkipped.length > 0) {
    lines.push(`  fixturesSkipped: ${report.fixturesSkipped.length}`);
    for (const skipped of report.fixturesSkipped) {
      lines.push(`    - ${skipped.file} (${skipped.reason})`);
    }
  }
  if (report.samples.length > 0) {
    lines.push('');
    lines.push('Samples:');
    for (const sample of report.samples) {
      lines.push(`- ${sample.file} ${sample.trail}`);
      lines.push(`    headline=${JSON.stringify(sample.headline)}`);
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const report = buildReport({
  root: args.root,
  samplesDir: args.samplesDir,
  maxSamples: args.maxSamples,
});

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderHuman(report));
}

const failed = report.totalViolations > args.maxViolations;
if (failed) {
  console.error(
    `Brief tier PLACEHOLDER: ${report.totalViolations} violation(s) exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman };
