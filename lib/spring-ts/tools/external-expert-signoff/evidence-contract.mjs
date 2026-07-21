import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH,
  contractIssue,
  contractResult,
  hasExactKeys,
  nonEmpty,
} from './manifest-contract.mjs';

function pathIsWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function digestFile(filePath) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

export function resolveAttestationPath(repositoryRoot, input) {
  if (!nonEmpty(input) || path.isAbsolute(input)) return null;
  const root = path.resolve(repositoryRoot);
  const attestationRoot = path.resolve(root, 'docs/release-attestations');
  const candidate = path.resolve(root, input.trim());
  return pathIsWithin(root, candidate) && pathIsWithin(attestationRoot, candidate)
    ? candidate
    : null;
}

export function validateExternalExpertSignoffEvidence(manifest, {
  repositoryRoot,
  manifestPath,
} = {}) {
  const violations = [];
  const root = path.resolve(repositoryRoot);
  const resolvedManifest = path.resolve(
    manifestPath ?? path.join(root, DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH),
  );
  const realPaths = new Set();
  for (const [index, entry] of (Array.isArray(manifest?.evidence) ? manifest.evidence : []).entries()) {
    if (
      !hasExactKeys(entry, ['path', 'sha256']) ||
      !nonEmpty(entry.path) ||
      !/^sha256:[a-f0-9]{64}$/.test(String(entry.sha256 ?? ''))
    ) continue;
    const candidate = resolveAttestationPath(root, entry.path);
    if (!candidate) {
      violations.push(contractIssue(
        'invalid_evidence_path',
        'Evidence must be repository-relative and inside docs/release-attestations.',
        { index, path: entry.path },
      ));
      continue;
    }
    if (candidate === resolvedManifest) {
      violations.push(contractIssue(
        'evidence_manifest_self_reference',
        'The signoff manifest cannot be its own evidence.',
        { index, path: entry.path },
      ));
      continue;
    }
    if (!fs.existsSync(candidate) || !fs.lstatSync(candidate).isFile()) {
      violations.push(contractIssue(
        'missing_evidence_file',
        'Evidence file must exist as a regular, non-symlink file.',
        { index, path: entry.path },
      ));
      continue;
    }
    const real = fs.realpathSync(candidate);
    const realRoot = fs.realpathSync(root);
    const realAttestationRoot = fs.realpathSync(
      path.resolve(root, 'docs/release-attestations'),
    );
    if (!pathIsWithin(realRoot, real) || !pathIsWithin(realAttestationRoot, real)) {
      violations.push(contractIssue(
        'invalid_evidence_path',
        'Evidence resolves outside docs/release-attestations.',
      ));
      continue;
    }
    const normalized = process.platform === 'win32' ? real.toLowerCase() : real;
    if (realPaths.has(normalized)) {
      violations.push(contractIssue('duplicate_evidence_path', 'Evidence resolves to a duplicate file.'));
      continue;
    }
    realPaths.add(normalized);
    const actual = digestFile(real);
    if (actual !== entry.sha256) {
      violations.push(contractIssue(
        'evidence_sha_mismatch',
        'Evidence file SHA-256 does not match the manifest.',
        { index, path: entry.path, expected: entry.sha256, actual },
      ));
    }
  }
  return contractResult(violations, { verifiedEvidenceFiles: realPaths.size });
}
