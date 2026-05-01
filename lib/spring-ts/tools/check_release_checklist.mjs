#!/usr/bin/env node
/**
 * tools/check_release_checklist.mjs
 *
 * Local CI helper for Phase 9.1. It fails when a rule-affecting PR body does
 * not include the checked rule/source-tier/wording release checklist.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');

const REQUIRED_CHECKS = [
  {
    id: 'rule-change-impact',
    label: 'Rule change impact reviewed',
    pattern: /-\s*\[[xX]\]\s+Rule change impact reviewed\b/,
  },
  {
    id: 'source-tier-impact',
    label: 'Source-tier impact reviewed',
    pattern: /-\s*\[[xX]\]\s+Source-tier impact reviewed\b/,
  },
  {
    id: 'user-facing-wording',
    label: 'User-facing wording reviewed',
    pattern: /-\s*\[[xX]\]\s+User-facing wording reviewed\b/,
  },
];
const NOT_RULE_AFFECTING_PATTERN = /\bNot rule-affecting\b/i;

const RULE_AFFECTING_PATTERNS = [
  /^lib\/spring-ts\/src\//,
  /^lib\/spring-ts\/config\//,
  /^lib\/spring-ts\/data\//,
  /^lib\/spring-ts\/metrics\//,
  /^lib\/spring-ts\/scripts\//,
  /^lib\/spring-ts\/tools\//,
  /^lib\/spring-ts\/test\/baseline\//,
  /^lib\/spring-ts\/test\/fixtures\//,
  /^lib\/spring-ts\/test\/integration\//,
  /^\.github\/pull_request_template\.md$/,
];

function parseArgs(argv) {
  const args = {
    bodyPath: process.env.PR_BODY_PATH ?? '',
    changedFilesPath: process.env.CHANGED_FILES_PATH ?? '',
    baseRef: process.env.RELEASE_CHECKLIST_BASE_REF ?? 'main',
    headRef: process.env.RELEASE_CHECKLIST_HEAD_REF ?? 'HEAD',
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--body' && argv[i + 1]) {
      args.bodyPath = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--changed-files' && argv[i + 1]) {
      args.changedFilesPath = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--base' && argv[i + 1]) {
      args.baseRef = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--head' && argv[i + 1]) {
      args.headRef = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--json') {
      args.json = true;
    }
  }
  return args;
}

function normalizePath(filePath) {
  return filePath.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function readChangedFiles(args) {
  if (args.changedFilesPath) {
    if (!fs.existsSync(args.changedFilesPath)) {
      throw Object.assign(new Error(`Changed files list not found: ${args.changedFilesPath}`), { exitCode: 2 });
    }
    return fs.readFileSync(args.changedFilesPath, 'utf-8')
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean);
  }
  const stdout = execFileSync('git', ['diff', '--name-only', `${args.baseRef}...${args.headRef}`], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  return stdout.split(/\r?\n/).map(normalizePath).filter(Boolean);
}

function readBody(args) {
  if (args.bodyPath) {
    if (!fs.existsSync(args.bodyPath)) {
      throw Object.assign(new Error(`PR body file not found: ${args.bodyPath}`), { exitCode: 2 });
    }
    return fs.readFileSync(args.bodyPath, 'utf-8');
  }
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
    return String(event.pull_request?.body ?? '');
  }
  throw Object.assign(
    new Error('PR body is required. Pass --body <path> or set GITHUB_EVENT_PATH.'),
    { exitCode: 2 },
  );
}

export function isRuleAffectingPath(filePath) {
  const normalized = normalizePath(filePath);
  return RULE_AFFECTING_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function validateReleaseChecklist(body, changedFiles) {
  const ruleAffectingFiles = changedFiles.map(normalizePath).filter(isRuleAffectingPath);
  if (ruleAffectingFiles.length === 0) {
    return {
      status: 'PASS',
      ruleAffecting: false,
      ruleAffectingFiles,
      missingChecks: [],
    };
  }

  const missingChecks = REQUIRED_CHECKS
    .filter((check) => !check.pattern.test(body))
    .map((check) => check.id);
  if (NOT_RULE_AFFECTING_PATTERN.test(body)) {
    missingChecks.push('not-rule-affecting-claim');
  }
  return {
    status: missingChecks.length === 0 ? 'PASS' : 'FAIL',
    ruleAffecting: true,
    ruleAffectingFiles,
    missingChecks,
  };
}

function main() {
  const args = parseArgs(process.argv);
  try {
    const changedFiles = readChangedFiles(args);
    const body = readBody(args);
    const result = validateReleaseChecklist(body, changedFiles);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.status === 'PASS') {
      const scope = result.ruleAffecting ? 'rule-affecting' : 'not rule-affecting';
      console.log(`Release checklist: PASS (${scope})`);
    } else {
      console.error('Release checklist: FAIL');
      console.error(`Rule-affecting files: ${result.ruleAffectingFiles.join(', ')}`);
      console.error(`Missing checked items: ${result.missingChecks.join(', ')}`);
    }
    process.exit(result.status === 'PASS' ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exitCode = typeof error === 'object' && error !== null && 'exitCode' in error
      ? Number(error.exitCode)
      : 2;
    if (args.json) {
      console.log(JSON.stringify({ status: 'ERROR', message }, null, 2));
    } else {
      console.error(`Release checklist: ERROR ${message}`);
    }
    process.exit(Number.isFinite(exitCode) ? exitCode : 2);
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '')) {
  main();
}
