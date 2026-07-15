#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BASELINE_FIXTURE_RELATIVE_PATH,
  DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH,
  EXTERNAL_EXPERT_IDENTITY_DISCLAIMER,
  EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION,
  MIN_EXTERNAL_EXPERT_FIXTURES,
  REQUIRED_EXTERNAL_EXPERT_DIMENSIONS,
  contractIssue,
  contractResult,
  extractBaselineFixtureIds,
  validateExternalExpertSignoffManifest,
} from './external-expert-signoff/manifest-contract.mjs';
import {
  resolveAttestationPath,
  validateExternalExpertSignoffEvidence as validateEvidence,
} from './external-expert-signoff/evidence-contract.mjs';
import {
  resolveCurrentGitHead as resolveHead,
  validateExternalExpertSignoffGitBinding as validateGitBinding,
} from './external-expert-signoff/git-binding.mjs';

const THIS_FILE = fileURLToPath(import.meta.url);
const SPRING_TS_ROOT = path.resolve(path.dirname(THIS_FILE), '..');

export {
  BASELINE_FIXTURE_RELATIVE_PATH,
  DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH,
  EXTERNAL_EXPERT_IDENTITY_DISCLAIMER,
  EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION,
  MIN_EXTERNAL_EXPERT_FIXTURES,
  REQUIRED_EXTERNAL_EXPERT_DIMENSIONS,
  validateExternalExpertSignoffManifest,
};

export function loadBaselineFixtureIds(repositoryRoot = SPRING_TS_ROOT) {
  const fixturePath = path.resolve(repositoryRoot, BASELINE_FIXTURE_RELATIVE_PATH);
  return extractBaselineFixtureIds(JSON.parse(fs.readFileSync(fixturePath, 'utf8')));
}

export function validateExternalExpertSignoffEvidence(manifest, options = {}) {
  return validateEvidence(manifest, {
    ...options,
    repositoryRoot: options.repositoryRoot ?? SPRING_TS_ROOT,
  });
}

export function resolveCurrentGitHead(repositoryRoot = SPRING_TS_ROOT) {
  return resolveHead(repositoryRoot);
}

export function validateExternalExpertSignoffGitBinding(manifest, options = {}) {
  return validateGitBinding(manifest, {
    ...options,
    repositoryRoot: options.repositoryRoot ?? SPRING_TS_ROOT,
  });
}

export function checkExternalExpertSignoff({
  repositoryRoot = SPRING_TS_ROOT,
  manifestPath,
} = {}) {
  const root = path.resolve(repositoryRoot);
  const resolvedManifest = path.resolve(
    manifestPath ?? path.join(root, DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH),
  );
  if (!resolveAttestationPath(root, path.relative(root, resolvedManifest))) {
    return {
      ...contractResult([contractIssue(
        'invalid_manifest_path',
        'Manifest must be inside docs/release-attestations.',
      )]),
      manifestPath: resolvedManifest,
    };
  }
  if (!fs.existsSync(resolvedManifest) || !fs.lstatSync(resolvedManifest).isFile()) {
    return {
      ...contractResult([contractIssue(
        'missing_manifest',
        `A regular, non-symlink signoff manifest is required at ${resolvedManifest}.`,
      )]),
      manifestPath: resolvedManifest,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(resolvedManifest, 'utf8'));
  } catch (error) {
    return {
      ...contractResult([contractIssue(
        'malformed_manifest_json',
        'Signoff manifest must be valid JSON: ' + error.message,
      )]),
      manifestPath: resolvedManifest,
    };
  }

  let expectedFixtureIds = null;
  const loadViolations = [];
  try {
    expectedFixtureIds = loadBaselineFixtureIds(root);
  } catch (error) {
    loadViolations.push(contractIssue('baseline_fixture_ids_unavailable', error.message));
  }
  const manifestResult = validateExternalExpertSignoffManifest(manifest, {
    expectedFixtureIds,
  });
  const evidenceResult = validateExternalExpertSignoffEvidence(manifest, {
    repositoryRoot: root,
    manifestPath: resolvedManifest,
  });
  const gitResult = validateExternalExpertSignoffGitBinding(manifest, {
    repositoryRoot: root,
    manifestPath: resolvedManifest,
  });
  return {
    ...contractResult([
      ...loadViolations,
      ...manifestResult.violations,
      ...evidenceResult.violations,
      ...gitResult.violations,
    ], {
      ...manifestResult.summary,
      ...evidenceResult.summary,
      ...gitResult.summary,
    }),
    manifestPath: resolvedManifest,
  };
}

function parseArgs(argv) {
  const args = { repositoryRoot: SPRING_TS_ROOT, manifestPath: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--repository-root' && argv[index + 1]) {
      args.repositoryRoot = path.resolve(argv[++index]);
    } else if (token === '--manifest' && argv[index + 1]) {
      args.manifestPath = argv[++index];
    } else if (token === '--json') {
      args.json = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${token}`);
    }
  }
  if (args.manifestPath) {
    args.manifestPath = path.resolve(args.repositoryRoot, args.manifestPath);
  }
  return args;
}

export function runExternalExpertSignoffCli(
  argv = process.argv.slice(2),
  {
    stdout = (message) => console.log(message),
    stderr = (message) => console.error(message),
  } = {},
) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    stderr('External expert signoff gate: FAIL');
    stderr(error.message);
    stderr(EXTERNAL_EXPERT_IDENTITY_DISCLAIMER);
    return 1;
  }
  const result = checkExternalExpertSignoff(args);
  if (args.json) {
    stdout(JSON.stringify(result, null, 2));
  } else if (result.status === 'PASS') {
    stdout('External expert signoff gate: PASS');
    stdout(`Manifest: ${result.manifestPath}`);
    stdout(`Reviewed commit: ${result.summary.reviewedCommit}`);
    stdout(`Current HEAD: ${result.summary.currentHead}`);
    stdout(`Reviewed fixtures: ${result.summary.fixtureCount}`);
    stdout(`Coverage: ${result.summary.dimensions.join(', ')}`);
    stdout(EXTERNAL_EXPERT_IDENTITY_DISCLAIMER);
  } else {
    stderr('External expert signoff gate: FAIL');
    for (const violation of result.violations) {
      stderr(`- [${violation.code}] ${violation.message}`);
    }
    stderr(EXTERNAL_EXPERT_IDENTITY_DISCLAIMER);
  }
  return result.status === 'PASS' ? 0 : 1;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(THIS_FILE)) {
  process.exitCode = runExternalExpertSignoffCli();
}
