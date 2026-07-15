import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

import { resolveAttestationPath } from './evidence-contract.mjs';
import {
  BASELINE_FIXTURE_RELATIVE_PATH,
  DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH,
  contractIssue,
  contractResult,
  validCommit,
} from './manifest-contract.mjs';

function gitPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function gitResult(cwd, args) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveGitRoot(repositoryRoot) {
  return path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim());
}

function trackedFileViolation(gitRoot, filePath, untrackedCode) {
  const relative = gitPath(path.relative(gitRoot, filePath));
  if (relative.startsWith('../') || path.isAbsolute(relative)) {
    return contractIssue(untrackedCode, 'Attestation file is outside the Git repository.');
  }
  const tracked = gitResult(gitRoot, ['ls-files', '--error-unmatch', '--', relative]);
  if (tracked.status !== 0) {
    return contractIssue(
      untrackedCode,
      'Required attestation file is not tracked by Git.',
      { path: relative },
    );
  }
  const dirty = gitResult(gitRoot, [
    'status', '--porcelain', '--untracked-files=all', '--', relative,
  ]);
  if (dirty.status !== 0 || dirty.stdout.trim().length > 0) {
    return contractIssue(
      'dirty_attestation_file',
      'Tracked attestation inputs must match the current HEAD exactly.',
      { path: relative },
    );
  }
  return null;
}

export function resolveCurrentGitHead(repositoryRoot) {
  const output = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim().toLowerCase();
  if (!validCommit(output)) throw new Error('Git HEAD is not a 40-character SHA.');
  return output;
}

export function validateExternalExpertSignoffGitBinding(manifest, {
  repositoryRoot,
  manifestPath,
} = {}) {
  const violations = [];
  const root = path.resolve(repositoryRoot);
  const resolvedManifest = path.resolve(
    manifestPath ?? path.join(root, DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH),
  );
  let gitRoot;
  let currentHead;
  try {
    gitRoot = resolveGitRoot(root);
    currentHead = resolveCurrentGitHead(root);
  } catch (error) {
    return contractResult([contractIssue('current_head_unavailable', error.message)]);
  }

  const worktree = gitResult(gitRoot, [
    'status', '--porcelain=v1', '--untracked-files=all', '--',
  ]);
  const dirtyFiles = worktree.status === 0
    ? worktree.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  if (worktree.status !== 0 || dirtyFiles.length > 0) {
    violations.push(contractIssue(
      'dirty_release_worktree',
      'External signoff is valid only in a completely clean Git worktree and index.',
      { files: dirtyFiles.slice(0, 100) },
    ));
  }

  const reviewedCommit = manifest?.subject?.reviewedCommit;
  let changedFiles = [];
  if (!validCommit(reviewedCommit)) {
    violations.push(contractIssue(
      'reviewed_commit_not_ancestor',
      'A valid reviewedCommit is required before ancestry can be verified.',
    ));
  } else {
    const ancestor = gitResult(gitRoot, [
      'merge-base', '--is-ancestor', reviewedCommit, currentHead,
    ]);
    if (reviewedCommit === currentHead || ancestor.status !== 0) {
      violations.push(contractIssue(
        'reviewed_commit_not_ancestor',
        'reviewedCommit must be a strict ancestor of the current HEAD.',
        { reviewedCommit, currentHead },
      ));
    } else {
      const diff = gitResult(gitRoot, [
        'diff', '--name-only', '--no-renames', `${reviewedCommit}..${currentHead}`, '--',
      ]);
      if (diff.status !== 0) {
        violations.push(contractIssue(
          'review_diff_unavailable',
          'Reviewed commit diff cannot be read.',
        ));
      } else {
        changedFiles = diff.stdout.split(/\r?\n/).map(gitPath).filter(Boolean);
        const prefix = gitPath(path.relative(
          gitRoot,
          path.resolve(root, 'docs/release-attestations'),
        )) + '/';
        const outside = changedFiles.filter((file) => !file.startsWith(prefix));
        if (outside.length > 0) {
          violations.push(contractIssue(
            'non_attestation_change_after_review',
            'Only docs/release-attestations/** may change after reviewedCommit.',
            { files: outside },
          ));
        }
      }
    }
  }

  const requiredFiles = [{
    filePath: resolvedManifest,
    untrackedCode: 'untracked_manifest',
  }];
  for (const entry of (Array.isArray(manifest?.evidence) ? manifest.evidence : [])) {
    const filePath = resolveAttestationPath(root, entry?.path);
    if (filePath) requiredFiles.push({ filePath, untrackedCode: 'untracked_evidence_file' });
  }
  requiredFiles.push({
    filePath: path.resolve(root, BASELINE_FIXTURE_RELATIVE_PATH),
    untrackedCode: 'untracked_baseline_fixture_file',
    needNotChange: true,
  });

  const changedSet = new Set(changedFiles);
  for (const required of requiredFiles) {
    const trackedViolation = trackedFileViolation(
      gitRoot,
      required.filePath,
      required.untrackedCode,
    );
    if (trackedViolation) {
      violations.push(trackedViolation);
      continue;
    }
    const relative = gitPath(path.relative(gitRoot, required.filePath));
    if (!required.needNotChange && validCommit(reviewedCommit) && !changedSet.has(relative)) {
      violations.push(contractIssue(
        'attestation_file_not_after_review',
        'Manifest and evidence files must be committed after reviewedCommit.',
        { path: relative },
      ));
    }
  }
  return contractResult(violations, {
    currentHead,
    reviewedCommit,
    changedFiles,
    dirtyFiles,
  });
}
