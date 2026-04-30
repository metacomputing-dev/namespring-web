/**
 * tools/measure_regression.mjs
 *
 * Per-field diff between two refs of test/baseline/spring_ts_snapshot.json.
 *
 * Use this tool BEFORE creating a PR to verify default-mode regression is 0
 * (or the only diffs are intentional baseline shifts that the PR explicitly
 * captures into the snapshot).
 *
 * Usage:
 *   node tools/measure_regression.mjs --baseline main --branch HEAD
 *   node tools/measure_regression.mjs --baseline main --branch HEAD --json > report.json
 *
 * Exit codes:
 *   0 — no diffs (PASS)
 *   1 — diffs detected
 *   2 — refs unreadable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const SNAPSHOT_REL_PATH = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json';

// ── arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { baseline: 'main', branch: 'HEAD', json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--baseline') args.baseline = argv[i + 1];
    else if (argv[i] === '--branch') args.branch = argv[i + 1];
    else if (argv[i] === '--json') args.json = true;
  }
  return args;
}

// ── snapshot reading ──────────────────────────────────────────────────────
function readSnapshotAtRef(ref) {
  try {
    const json = execSync(`git show ${ref}:${SNAPSHOT_REL_PATH}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(json);
  } catch (err) {
    console.error(`Cannot read ${ref}:${SNAPSHOT_REL_PATH}`);
    console.error(`  reason: ${err.message.split('\n')[0]}`);
    console.error(
      `  hint: ensure the ref exists and that PR2 (which introduces the snapshot file) has been merged into it.`,
    );
    process.exit(2);
  }
}

// ── deep diff (returns flat list of {path, baseline, current}) ────────────
function deepDiff(base, current, prefix = '') {
  const diffs = [];
  const isBaseObj = base !== null && typeof base === 'object';
  const isCurrObj = current !== null && typeof current === 'object';

  if (!isBaseObj && !isCurrObj) {
    if (JSON.stringify(base) !== JSON.stringify(current)) {
      diffs.push({ path: prefix || '<root>', baseline: base, current });
    }
    return diffs;
  }
  if (isBaseObj !== isCurrObj) {
    diffs.push({ path: prefix || '<root>', baseline: base, current });
    return diffs;
  }
  if (Array.isArray(base) || Array.isArray(current)) {
    if (!Array.isArray(base) || !Array.isArray(current) || base.length !== current.length) {
      diffs.push({ path: prefix || '<root>', baseline: base, current });
      return diffs;
    }
    for (let i = 0; i < base.length; i += 1) {
      diffs.push(...deepDiff(base[i], current[i], `${prefix}[${i}]`));
    }
    return diffs;
  }
  const keys = new Set([...Object.keys(base), ...Object.keys(current)]);
  for (const k of keys) {
    diffs.push(...deepDiff(base[k], current[k], prefix ? `${prefix}.${k}` : k));
  }
  return diffs;
}

// ── main ──────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv);

if (!args.json) {
  console.log(`Comparing ${SNAPSHOT_REL_PATH}:`);
  console.log(`  baseline: ${args.baseline}`);
  console.log(`  branch:   ${args.branch}`);
}

const baselineSnapshot = readSnapshotAtRef(args.baseline);
const currentSnapshot = readSnapshotAtRef(args.branch);

const allDiffs = [];
const baseIds = new Set(baselineSnapshot.results.map((r) => r.id));
const currIds = new Set(currentSnapshot.results.map((r) => r.id));

for (const id of baseIds) {
  if (!currIds.has(id)) {
    const baseFix = baselineSnapshot.results.find((r) => r.id === id);
    allDiffs.push({
      fixture: id,
      label: baseFix.label,
      diffs: [{ path: '<fixture>', baseline: 'present', current: 'missing' }],
    });
    continue;
  }
}
for (const id of currIds) {
  if (!baseIds.has(id)) {
    const currFix = currentSnapshot.results.find((r) => r.id === id);
    allDiffs.push({
      fixture: id,
      label: currFix.label,
      diffs: [{ path: '<fixture>', baseline: 'missing', current: 'present (new)' }],
    });
  }
}
for (const baseFix of baselineSnapshot.results) {
  if (!currIds.has(baseFix.id)) continue;
  const currFix = currentSnapshot.results.find((r) => r.id === baseFix.id);
  const fixtureDiffs = deepDiff(baseFix.output, currFix.output);
  if (fixtureDiffs.length > 0) {
    allDiffs.push({ fixture: baseFix.id, label: baseFix.label, diffs: fixtureDiffs });
  }
}

if (args.json) {
  console.log(JSON.stringify({ totalDiffs: allDiffs.length, diffs: allDiffs }, null, 2));
  process.exit(allDiffs.length > 0 ? 1 : 0);
}

if (allDiffs.length === 0) {
  console.log(`\nDefault-mode regression: 0 diffs across ${baselineSnapshot.fixtureCount} fixtures (≡ baseline)`);
  console.log('PASS');
  process.exit(0);
}

let totalFieldDiffs = 0;
for (const fix of allDiffs) totalFieldDiffs += fix.diffs.length;
console.log(`\nDefault-mode regression: ${allDiffs.length} fixture(s), ${totalFieldDiffs} field diff(s):`);
for (const fix of allDiffs) {
  console.log(`\n  ${fix.fixture} — ${fix.label}`);
  for (const d of fix.diffs) {
    const baseStr = JSON.stringify(d.baseline);
    const currStr = JSON.stringify(d.current);
    console.log(`    ${d.path}`);
    console.log(`      baseline: ${baseStr.length > 100 ? baseStr.substring(0, 97) + '...' : baseStr}`);
    console.log(`      current:  ${currStr.length > 100 ? currStr.substring(0, 97) + '...' : currStr}`);
  }
}
console.log(
  `\nFAIL — ${allDiffs.length} fixture(s) diverged from ${args.baseline}.\n` +
  `If intentional: re-capture (npx tsx tools/baseline_snapshot.ts capture) and review the diff in PR description.`,
);
process.exit(1);
