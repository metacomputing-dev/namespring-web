#!/usr/bin/env node
/**
 * tools/check_acceptance_completeness.mjs
 *
 * Phase 13 Agent A3 -- acceptance-gate completeness CI gate.
 *
 * Failure mode this prevents: a new `ci:*` script is added to `package.json`
 * (e.g. `ci:narrative-orphan-tags` wired by P12-A3) but a subsequent P*-A5
 * acceptance audit omits it from its acceptance list. P13-A5 found exactly
 * this -- one omitted gate masked 2 production violations across an entire
 * phase. See artifacts/phase13-agent-a5/audit-2026-05-06-phase13.md §B1.
 *
 * Contract:
 *   1. Enumerate every `ci:*` script in `package.json`.
 *   2. Read the manifest at `tools/acceptance-manifest.json`.
 *   3. Every ci:* script MUST be declared in either `accepted[]` or
 *      `exempt[]` -- a missing declaration fails the gate.
 *   4. Every name in `accepted[]` / `exempt[]` MUST correspond to a real
 *      ci:* script -- a stale declaration fails the gate (catches typos and
 *      gates removed from package.json without manifest cleanup).
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 on violations.
 *   - --json: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate fails
 *                                (default 0 -- any violation fails)
 *   --root=<path>                override spring-ts root
 *   --manifest=<path>            override manifest path
 *   --package-json=<path>        override package.json path
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    root: DEFAULT_ROOT,
    manifest: null,
    packageJson: null,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-violations=')) {
      const v = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(v) && v >= 0) args.maxViolations = v;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--manifest=')) {
      args.manifest = path.resolve(arg.slice('--manifest='.length));
    } else if (arg.startsWith('--package-json=')) {
      args.packageJson = path.resolve(arg.slice('--package-json='.length));
    }
  }
  return args;
}

function relPath(root, filePath) {
  const r = path.relative(root, filePath);
  return r && !r.startsWith('..') ? r.replaceAll(path.sep, '/') : filePath.replaceAll(path.sep, '/');
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(text);
}

function collectCiScripts(scripts) {
  const out = [];
  for (const key of Object.keys(scripts ?? {})) {
    if (key.startsWith('ci:')) out.push(key);
  }
  out.sort();
  return out;
}

function collectManifestEntries(manifest) {
  const accepted = Array.isArray(manifest.accepted) ? [...manifest.accepted] : [];
  const exemptRaw = Array.isArray(manifest.exempt) ? manifest.exempt : [];
  const exempt = exemptRaw.map((entry) => {
    if (typeof entry === 'string') return { name: entry, reason: '' };
    if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
      return { name: entry.name, reason: typeof entry.reason === 'string' ? entry.reason : '' };
    }
    return { name: '', reason: '' };
  });
  return { accepted: accepted.filter((n) => typeof n === 'string'), exempt };
}

function diffSets(actual, declared) {
  const actualSet = new Set(actual);
  const declaredSet = new Set(declared);
  const missing = actual.filter((n) => !declaredSet.has(n)).sort();
  const stale = declared.filter((n) => !actualSet.has(n)).sort();
  return { missing, stale };
}

function buildResult(args) {
  const root = args.root;
  const packageJsonPath = args.packageJson ?? path.join(root, 'package.json');
  const manifestPath = args.manifest ?? path.join(root, 'tools/acceptance-manifest.json');

  const inputErrors = [];
  let packageScripts = null;
  let manifest = null;

  try {
    packageScripts = readJson(packageJsonPath).scripts ?? {};
  } catch (err) {
    inputErrors.push({
      file: relPath(root, packageJsonPath),
      code: 'unreadable_package_json',
      message: err.message,
    });
  }
  try {
    manifest = readJson(manifestPath);
  } catch (err) {
    inputErrors.push({
      file: relPath(root, manifestPath),
      code: 'unreadable_manifest',
      message: err.message,
    });
  }

  if (inputErrors.length > 0) {
    return {
      status: 'ERROR',
      policy: 'spring-ts.acceptance-completeness.v1',
      inputErrors,
      scanned: { ciScripts: 0, accepted: 0, exempt: 0 },
      violations: [],
    };
  }

  const ciScripts = collectCiScripts(packageScripts);
  const { accepted, exempt } = collectManifestEntries(manifest);
  const exemptNames = exempt.map((e) => e.name).filter(Boolean);

  const overlap = accepted.filter((name) => exemptNames.includes(name));

  const declared = [...new Set([...accepted, ...exemptNames])];
  const { missing, stale } = diffSets(ciScripts, declared);

  const violations = [];
  for (const name of missing) {
    violations.push({
      code: 'ci_gate_undeclared',
      gate: name,
      message: `ci script "${name}" is in package.json but missing from acceptance manifest (must be in accepted[] or exempt[])`,
    });
  }
  for (const name of stale) {
    violations.push({
      code: 'manifest_entry_stale',
      gate: name,
      message: `acceptance manifest declares "${name}" but no matching ci:* script exists in package.json`,
    });
  }
  for (const name of overlap) {
    violations.push({
      code: 'manifest_entry_overlap',
      gate: name,
      message: `acceptance manifest lists "${name}" in BOTH accepted[] and exempt[] -- pick one`,
    });
  }
  for (const entry of exempt) {
    if (!entry.name) {
      violations.push({
        code: 'manifest_exempt_malformed',
        gate: '',
        message: 'acceptance manifest exempt[] entry missing "name" field',
      });
      continue;
    }
    if (!entry.reason || entry.reason.trim().length === 0) {
      violations.push({
        code: 'manifest_exempt_unjustified',
        gate: entry.name,
        message: `exempt[] entry "${entry.name}" must include a non-empty "reason" field`,
      });
    }
  }

  return {
    status: violations.length > args.maxViolations ? 'FAIL' : 'PASS',
    policy: 'spring-ts.acceptance-completeness.v1',
    inputErrors,
    scanned: {
      ciScripts: ciScripts.length,
      accepted: accepted.length,
      exempt: exempt.length,
    },
    ciScripts,
    accepted,
    exempt: exempt.map((e) => e.name),
    violations,
  };
}

function printText(result) {
  console.log(`Acceptance completeness: ${result.status}`);
  console.log(`  ciScripts=${result.scanned.ciScripts}`);
  console.log(`  accepted=${result.scanned.accepted}`);
  console.log(`  exempt=${result.scanned.exempt}`);
  console.log(`  violations=${result.violations.length}`);
  for (const err of result.inputErrors) {
    console.log(`  ERROR ${err.file}: ${err.message}`);
  }
  for (const v of result.violations) {
    console.log(`  FAIL ${v.code}${v.gate ? ` (${v.gate})` : ''}: ${v.message}`);
  }
}

const args = parseArgs(process.argv);
const result = buildResult(args);
if (args.json) console.log(JSON.stringify(result, null, 2));
else printText(result);
process.exit(result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2);
