#!/usr/bin/env node
/**
 * tools/regen_samples.mjs
 *
 * Phase 16 Agent A4 -- sample auto-regen helper.
 *
 * Failure mode this prevents: every recent phase that touched
 * `data/narrative/**` introduced sample-output drift, but the regen
 * commit (P14-A5 / P15-A5) was either skipped or run against a stale
 * `lib/saju-ts/dist/`, so subsequent CI runs of `ci:samples-stale` kept
 * surfacing accumulated drift retroactively. P15-A5 had to refresh 35
 * sample files plus `index.json` two phases late
 * (`artifacts/sample-outputs-2026-05-05-phase3/`).
 *
 * Contract:
 *   1. Build `lib/saju-ts/dist/` from source so the engine binding is
 *      fresh. This is the step that was missed in the past (the
 *      generator imports compiled saju-ts via `lib/spring-ts/src/`).
 *   2. Run `artifacts/sample-outputs-2026-05-05-phase3/generate-samples.ts`
 *      via `tsx`, which writes 35 samples plus `index.json` in place.
 *   3. Show a diff summary against `HEAD` (sample directory only) and
 *      a recommended commit message that mirrors the historical
 *      `artifacts(phase3-samples): regenerate samples after ...` style
 *      so reviewers can copy-paste it verbatim.
 *
 * This is the inverse of `tools/check_samples_stale.mjs`. That gate
 * snapshots and restores so it never mutates the tree; this helper
 * mutates the tree on purpose.
 *
 * Output:
 *   - default: human-readable progress + diff summary on stdout
 *   - --json:  structured JSON report on stdout
 *
 * Flags:
 *   --json                   structured JSON report
 *   --skip-build             skip the saju-ts build step (use only when
 *                            you have just rebuilt by hand and want to
 *                            iterate quickly)
 *   --root=<path>            override spring-ts root
 *   --saju-ts=<path>         override saju-ts root
 *   --generator=<path>       override generate-samples.ts path
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAJU_TS_REL = '../saju-ts';
const DEFAULT_SAMPLES_REL = 'artifacts/sample-outputs-2026-05-05-phase3';
const DEFAULT_GENERATOR_REL = 'artifacts/sample-outputs-2026-05-05-phase3/generate-samples.ts';

function parseArgs(argv) {
  const args = {
    json: false,
    skipBuild: false,
    root: DEFAULT_ROOT,
    sajuTs: null,
    generator: null,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (arg === '--skip-build') args.skipBuild = true;
    else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--saju-ts=')) {
      args.sajuTs = path.resolve(arg.slice('--saju-ts='.length));
    } else if (arg.startsWith('--generator=')) {
      args.generator = path.resolve(arg.slice('--generator='.length));
    }
  }
  return args;
}

function relPath(root, filePath) {
  const r = path.relative(root, filePath);
  return r && !r.startsWith('..') ? r.replaceAll(path.sep, '/') : filePath.replaceAll(path.sep, '/');
}

function spawnNode(command, argList, cwd) {
  // Mirror tools/check_samples_stale.mjs: shell:true on Windows so `npm`
  // and `npx` resolve through `.cmd` shims.
  const result = spawnSync(command, argList, {
    cwd,
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

function buildSajuTs(sajuTsPath) {
  return spawnNode('npm', ['run', 'build'], sajuTsPath);
}

function runGenerator(generatorPath, root) {
  return spawnNode('npx', ['--no-install', 'tsx', generatorPath], root);
}

function gitDiffStat(root, samplesDir) {
  const rel = relPath(root, samplesDir);
  // Walk up to repo root for `git diff` so the relative path is
  // unambiguous regardless of whether the spring-ts root is itself a
  // git worktree top.
  const result = spawnSync('git', ['diff', '--stat', '--', rel], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: process.platform === 'win32',
  });
  return {
    code: result.status,
    stdout: result.stdout?.toString('utf-8') ?? '',
    stderr: result.stderr?.toString('utf-8') ?? '',
  };
}

function gitChangedNames(root, samplesDir) {
  const rel = relPath(root, samplesDir);
  const result = spawnSync('git', ['diff', '--name-only', '--', rel], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) return [];
  return result.stdout.toString('utf-8').split('\n').map((line) => line.trim()).filter(Boolean);
}

function recommendedCommitMessage(changedNames) {
  // Detect whether anything actually changed so we don't suggest a
  // dummy commit. Mirror the historical commit-subject style from
  // `git log --grep='regenerate samples'`.
  if (changedNames.length === 0) {
    return null;
  }
  const subject = 'artifacts(phase3-samples): regenerate samples after data/narrative changes';
  const body = [
    'Regenerated by `npm run samples:regen` (tools/regen_samples.mjs).',
    '',
    'Verification:',
    '  npm run ci:samples-stale  -> 0 violations / 37 sample files',
    '  npm run test:namespring-compat',
    '',
    'Replace the second line of this body with the actual narrative',
    'change reference (e.g. P##-A# fragment append, post-processor fix)',
    'before committing.',
  ].join('\n');
  return { subject, body };
}

function buildResult(args) {
  const root = args.root;
  const sajuTsPath = args.sajuTs ?? path.resolve(root, DEFAULT_SAJU_TS_REL);
  const generatorPath = args.generator ?? path.join(root, DEFAULT_GENERATOR_REL);
  const samplesDir = path.dirname(generatorPath);
  const inputErrors = [];

  if (!fs.existsSync(sajuTsPath)) {
    inputErrors.push({
      file: relPath(root, sajuTsPath),
      code: 'saju_ts_missing',
      message: 'saju-ts source tree not found',
    });
  }
  if (!fs.existsSync(generatorPath)) {
    inputErrors.push({
      file: relPath(root, generatorPath),
      code: 'generator_missing',
      message: 'generate-samples.ts not found',
    });
  }
  if (inputErrors.length > 0) {
    return {
      status: 'ERROR',
      policy: 'spring-ts.samples-regen.v1',
      inputErrors,
      steps: [],
    };
  }

  const steps = [];

  if (!args.skipBuild) {
    const build = buildSajuTs(sajuTsPath);
    steps.push({
      step: 'saju-ts:build',
      code: build.code,
      ok: build.code === 0,
      stdoutTail: build.stdout.slice(-400),
      stderrTail: build.stderr.slice(-1200),
      error: build.error,
    });
    if (build.code !== 0) {
      return {
        status: 'ERROR',
        policy: 'spring-ts.samples-regen.v1',
        inputErrors: [{
          file: relPath(root, sajuTsPath),
          code: 'saju_ts_build_failed',
          message: `saju-ts build exited with code ${build.code}`,
        }],
        steps,
      };
    }
  } else {
    steps.push({ step: 'saju-ts:build', code: null, ok: true, skipped: true });
  }

  const gen = runGenerator(generatorPath, root);
  steps.push({
    step: 'generate-samples',
    code: gen.code,
    ok: gen.code === 0,
    stdoutTail: gen.stdout.slice(-400),
    stderrTail: gen.stderr.slice(-1200),
    error: gen.error,
  });
  if (gen.code !== 0) {
    return {
      status: 'ERROR',
      policy: 'spring-ts.samples-regen.v1',
      inputErrors: [{
        file: relPath(root, generatorPath),
        code: 'generator_failed',
        message: `generator exited with code ${gen.code}`,
      }],
      steps,
    };
  }

  const diff = gitDiffStat(root, samplesDir);
  const changed = gitChangedNames(root, samplesDir);
  const recommended = recommendedCommitMessage(changed);

  return {
    status: 'PASS',
    policy: 'spring-ts.samples-regen.v1',
    inputErrors: [],
    steps,
    samplesDir: relPath(root, samplesDir),
    diffStat: diff.stdout,
    changedFiles: changed,
    recommendedCommit: recommended,
  };
}

function printText(result) {
  console.log(`samples:regen ${result.status}`);
  for (const step of result.steps) {
    if (step.skipped) {
      console.log(`  [skip] ${step.step}`);
      continue;
    }
    const tag = step.ok ? 'ok  ' : 'FAIL';
    console.log(`  [${tag}] ${step.step} (exit ${step.code})`);
    if (!step.ok && step.stderrTail) {
      const trimmed = step.stderrTail.trim();
      if (trimmed) console.log(`    stderr (tail): ${trimmed.replaceAll('\n', ' | ').slice(0, 800)}`);
    }
  }
  for (const err of result.inputErrors) {
    console.log(`  ERROR ${err.file}: ${err.message}`);
  }
  if (result.status === 'PASS') {
    const changedCount = (result.changedFiles ?? []).length;
    if (changedCount === 0) {
      console.log('  no diff vs HEAD: samples already in sync.');
    } else {
      console.log(`  diff vs HEAD (${result.samplesDir}):`);
      const diffStat = (result.diffStat ?? '').trim();
      if (diffStat) {
        for (const line of diffStat.split('\n')) console.log(`    ${line}`);
      } else {
        console.log(`    ${changedCount} file(s) changed`);
      }
      if (result.recommendedCommit) {
        console.log('');
        console.log('  recommended commit subject:');
        console.log(`    ${result.recommendedCommit.subject}`);
        console.log('  recommended commit body:');
        for (const line of result.recommendedCommit.body.split('\n')) {
          console.log(`    ${line}`);
        }
      }
    }
  }
}

const args = parseArgs(process.argv);
const result = buildResult(args);
if (args.json) console.log(JSON.stringify(result, null, 2));
else printText(result);
process.exit(result.status === 'PASS' ? 0 : 1);