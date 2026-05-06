#!/usr/bin/env node
/**
 * tools/check_samples_stale.mjs
 *
 * Phase 13 Agent A3 -- samples-stale CI gate.
 *
 * Failure mode this prevents: a `data(narrative)` change crosses fragment
 * boundaries (e.g. P12-A1's `의 결과` → `의 흐름과` rewrite touching 68
 * files) but `artifacts/sample-outputs-2026-05-05-phase3/{01..35}-*.json`
 * is not regenerated. Subsequent "regen" commits update only timestamps,
 * leaving the bulk drift in place. P13-A5 found ~3.6K line-equivalents of
 * accumulated drift this way. See artifacts/phase13-agent-a5/audit-2026-05-06-phase13.md §B2.
 *
 * Contract:
 *   1. Snapshot the 36 committed sample artifacts in-memory.
 *   2. Run `generate-samples.ts` in-place (it hardcodes OUT_DIR = __dirname).
 *   3. Compare each newly-written file against the snapshot, masking
 *      `generatedAt` (envelope, payload.meta, payload.tieredMatrix.meta,
 *      and any nested `meta.generatedAt`) and `outputDirectory`.
 *   4. Restore originals from the snapshot in a try/finally so a crash
 *      mid-restore cannot corrupt artifacts.
 *   5. Fail if any file differs after masking.
 *
 * Empirically verified before authoring: P13-A3 ran the script twice on a
 * clean tree at HEAD with saju-ts/dist linked. Only `generatedAt` (top
 * level + nested `meta.generatedAt` × N) and `outputDirectory` (in
 * index.json) varied. CRLF-vs-LF normalization is also handled because
 * Windows checkouts may have either.
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on violations.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate fails
 *                                (default 0 -- any drift fails)
 *   --root=<path>                override spring-ts root
 *   --samples-dir=<path>         override samples directory
 *   --generator=<path>           override generate-samples.ts path
 *   --max-sample-bytes=N         cap printed/JSON drift sample size
 *                                per file (default 600)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAMPLES_REL = 'artifacts/sample-outputs-2026-05-05-phase3';
const DEFAULT_GENERATOR_REL = 'artifacts/sample-outputs-2026-05-05-phase3/generate-samples.ts';

const TIMESTAMP_KEY = 'generatedAt';
const PATH_KEY = 'outputDirectory';
const TIMESTAMP_PLACEHOLDER = '<<MASKED_TIMESTAMP>>';
const PATH_PLACEHOLDER = '<<MASKED_PATH>>';

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    root: DEFAULT_ROOT,
    samplesDir: null,
    generator: null,
    maxSampleBytes: 600,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-violations=')) {
      const v = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(v) && v >= 0) args.maxViolations = v;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--samples-dir=')) {
      args.samplesDir = path.resolve(arg.slice('--samples-dir='.length));
    } else if (arg.startsWith('--generator=')) {
      args.generator = path.resolve(arg.slice('--generator='.length));
    } else if (arg.startsWith('--max-sample-bytes=')) {
      const v = Number(arg.slice('--max-sample-bytes='.length));
      if (Number.isInteger(v) && v >= 0) args.maxSampleBytes = v;
    }
  }
  return args;
}

function relPath(root, filePath) {
  const r = path.relative(root, filePath);
  return r && !r.startsWith('..') ? r.replaceAll(path.sep, '/') : filePath.replaceAll(path.sep, '/');
}

function listSampleFiles(samplesDir) {
  if (!fs.existsSync(samplesDir)) return [];
  return fs.readdirSync(samplesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(samplesDir, entry.name))
    .sort();
}

function snapshot(files) {
  const snap = new Map();
  for (const file of files) {
    snap.set(file, fs.readFileSync(file));
  }
  return snap;
}

function restoreSnapshot(snap) {
  for (const [file, buffer] of snap.entries()) {
    fs.writeFileSync(file, buffer);
  }
}

function normalizeNewlines(text) {
  // Strip BOM defensively (committed JSON shouldn't have one but be safe).
  let normalized = text.startsWith('﻿') ? text.slice(1) : text;
  // Collapse CRLF/CR to LF so checkouts under autocrlf=true match the
  // Node-written LF output.
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized;
}

/**
 * Walk the parsed JSON tree and replace masked keys' values with stable
 * placeholders. Preserves byte-offset alignment in the resulting JSON
 * (every diff line context still points to the same logical key).
 */
function maskValue(value) {
  if (Array.isArray(value)) {
    return value.map(maskValue);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === TIMESTAMP_KEY && typeof v === 'string') {
        out[k] = TIMESTAMP_PLACEHOLDER;
      } else if (k === PATH_KEY && typeof v === 'string') {
        out[k] = PATH_PLACEHOLDER;
      } else {
        out[k] = maskValue(v);
      }
    }
    return out;
  }
  return value;
}

function maskJsonText(text) {
  let parsed;
  try {
    parsed = JSON.parse(normalizeNewlines(text));
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true, masked: `${JSON.stringify(maskValue(parsed), null, 2)}\n` };
}

function compareFile(name, originalBuffer, currentBuffer, maxSampleBytes) {
  const originalText = originalBuffer.toString('utf-8');
  const currentText = currentBuffer.toString('utf-8');
  const originalMask = maskJsonText(originalText);
  const currentMask = maskJsonText(currentText);
  if (!originalMask.ok) {
    return {
      file: name,
      code: 'invalid_committed_json',
      message: `committed sample is not valid JSON: ${originalMask.error}`,
      drift: false,
    };
  }
  if (!currentMask.ok) {
    return {
      file: name,
      code: 'invalid_regenerated_json',
      message: `regenerated sample is not valid JSON: ${currentMask.error}`,
      drift: false,
    };
  }
  if (originalMask.masked === currentMask.masked) {
    return null;
  }
  // Find first divergence offset for a focused sample preview.
  const a = originalMask.masked;
  const b = currentMask.masked;
  let firstDiff = 0;
  const minLen = Math.min(a.length, b.length);
  while (firstDiff < minLen && a[firstDiff] === b[firstDiff]) firstDiff += 1;
  const previewStart = Math.max(0, firstDiff - 80);
  const expected = a.slice(previewStart, previewStart + maxSampleBytes);
  const actual = b.slice(previewStart, previewStart + maxSampleBytes);
  return {
    file: name,
    code: 'samples_stale',
    message: 'regenerated sample differs from committed sample after masking generatedAt/outputDirectory',
    drift: true,
    firstDivergenceOffset: firstDiff,
    expectedSlice: expected,
    actualSlice: actual,
  };
}

function runGenerator(generatorPath, root) {
  const result = spawnSync('npx', ['--no-install', 'tsx', generatorPath], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: process.platform === 'win32',
  });
  return {
    code: result.status,
    signal: result.signal,
    stdout: result.stdout?.toString('utf-8') ?? '',
    stderr: result.stderr?.toString('utf-8') ?? '',
    error: result.error ? result.error.message : null,
  };
}

function buildResult(args) {
  const root = args.root;
  const samplesDir = args.samplesDir ?? path.join(root, DEFAULT_SAMPLES_REL);
  const generatorPath = args.generator ?? path.join(root, DEFAULT_GENERATOR_REL);
  const inputErrors = [];

  if (!fs.existsSync(samplesDir)) {
    inputErrors.push({
      file: relPath(root, samplesDir),
      code: 'samples_dir_missing',
      message: `samples directory does not exist`,
    });
  }
  if (!fs.existsSync(generatorPath)) {
    inputErrors.push({
      file: relPath(root, generatorPath),
      code: 'generator_missing',
      message: `generate-samples.ts not found`,
    });
  }
  if (inputErrors.length > 0) {
    return {
      status: 'ERROR',
      policy: 'spring-ts.samples-stale.v1',
      inputErrors,
      scanned: { sampleFiles: 0 },
      violations: [],
    };
  }

  const files = listSampleFiles(samplesDir);
  if (files.length === 0) {
    return {
      status: 'ERROR',
      policy: 'spring-ts.samples-stale.v1',
      inputErrors: [{
        file: relPath(root, samplesDir),
        code: 'samples_empty',
        message: 'no .json files found in samples directory',
      }],
      scanned: { sampleFiles: 0 },
      violations: [],
    };
  }

  const snap = snapshot(files);
  let runOutcome;
  try {
    runOutcome = runGenerator(generatorPath, root);
    if (runOutcome.error) {
      return {
        status: 'ERROR',
        policy: 'spring-ts.samples-stale.v1',
        inputErrors: [{
          file: relPath(root, generatorPath),
          code: 'generator_spawn_error',
          message: runOutcome.error,
        }],
        scanned: { sampleFiles: files.length },
        violations: [],
      };
    }
    if (runOutcome.code !== 0) {
      return {
        status: 'ERROR',
        policy: 'spring-ts.samples-stale.v1',
        inputErrors: [{
          file: relPath(root, generatorPath),
          code: 'generator_failed',
          message: `generator exited with code ${runOutcome.code}`,
          stderr: runOutcome.stderr.slice(-2000),
        }],
        scanned: { sampleFiles: files.length },
        violations: [],
      };
    }

    const violations = [];
    for (const file of files) {
      const original = snap.get(file);
      let current;
      try {
        current = fs.readFileSync(file);
      } catch (err) {
        violations.push({
          file: relPath(root, file),
          code: 'unreadable_regenerated',
          message: err.message,
          drift: false,
        });
        continue;
      }
      const v = compareFile(relPath(root, file), original, current, args.maxSampleBytes);
      if (v !== null) violations.push(v);
    }

    return {
      status: violations.length > args.maxViolations ? 'FAIL' : 'PASS',
      policy: 'spring-ts.samples-stale.v1',
      inputErrors: [],
      scanned: { sampleFiles: files.length },
      generatorStdoutTail: runOutcome.stdout.slice(-400),
      violations,
    };
  } finally {
    try {
      restoreSnapshot(snap);
    } catch (err) {
      // Best-effort restore; surface via stderr but don't mask the primary
      // result. A full crash mid-restore is the documented residual risk.
      console.error(`check_samples_stale: WARN restore failed: ${err.message}`);
    }
  }
}

function printText(result) {
  console.log(`Samples stale: ${result.status}`);
  console.log(`  sampleFiles=${result.scanned.sampleFiles}`);
  console.log(`  violations=${result.violations.length}`);
  for (const err of result.inputErrors) {
    console.log(`  ERROR ${err.file}: ${err.message}`);
    if (err.stderr) console.log(`    stderr: ${err.stderr.replaceAll('\n', ' | ')}`);
  }
  for (const v of result.violations) {
    console.log(`  FAIL ${v.file}: ${v.message}`);
    if (typeof v.firstDivergenceOffset === 'number') {
      console.log(`    firstDivergenceOffset=${v.firstDivergenceOffset}`);
    }
  }
}

const args = parseArgs(process.argv);
const result = buildResult(args);
if (args.json) console.log(JSON.stringify(result, null, 2));
else printText(result);
process.exit(result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2);
