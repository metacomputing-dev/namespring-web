import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const APPROVAL_SCHEMA_VERSION = 'spring-ts.default-change-approval.v3';

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SUBJECT_FIELDS = [
  'baselineCommit',
  'reviewedCommit',
  'exactDiffFingerprint',
  'baselineFixtureSetSha256',
  'reviewedFixtureSetSha256',
  'baselineSnapshotSha256',
  'reviewedSnapshotSha256',
  'baselineCandidateSnapshotSha256',
  'reviewedCandidateSnapshotSha256',
];
const TOP_LEVEL_KEYS = new Set(['schemaVersion', 'approvals']);
const ENTRY_KEYS = new Set([
  'fingerprint',
  'status',
  'subject',
  'reviewedBy',
  'reviewedAt',
  'evidence',
  'note',
  'supersededBy',
  'supersededAt',
  'supersessionEvidence',
]);

function git(repoRoot, args, encoding = null) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function resolveRefCommit(ref, { repoRoot } = {}) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
    throw new Error('repoRoot is required');
  }
  if (typeof ref !== 'string' || ref.length === 0) throw new Error('git ref is required');
  return git(repoRoot, ['rev-parse', '--verify', `${ref}^{commit}`], 'utf8').trim();
}

export function readBufferAtRef(ref, relativePath, { repoRoot } = {}) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
    throw new Error('repoRoot is required');
  }
  if (typeof ref !== 'string' || ref.length === 0) throw new Error('git ref is required');
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error('relativePath is required');
  }
  return git(repoRoot, ['show', `${ref}:${relativePath}`]);
}

export function readSnapshotAtRef(ref, {
  repoRoot,
  snapshotRelPath = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json',
} = {}) {
  return JSON.parse(readBufferAtRef(ref, snapshotRelPath, { repoRoot }).toString('utf8'));
}

export function sha256Content(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

export function parseJsonStrict(content, label = 'JSON') {
  const source = Buffer.isBuffer(content) ? content.toString('utf8') : String(content);
  let index = 0;
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at offset ${index}`);
  };
  const skipWhitespace = () => {
    while (index < source.length && /\s/u.test(source[index])) index += 1;
  };
  const parseString = () => {
    if (source[index] !== '"') fail('expected string');
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2;
        continue;
      }
      if (source[index] === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index));
      }
      index += 1;
    }
    fail('unterminated string');
  };
  const parseValue = () => {
    skipWhitespace();
    const token = source[index];
    if (token === '"') return parseString();
    if (token === '{') {
      index += 1;
      skipWhitespace();
      const object = {};
      const keys = new Set();
      if (source[index] === '}') {
        index += 1;
        return object;
      }
      while (index < source.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) fail(`duplicate object key ${JSON.stringify(key)}`);
        keys.add(key);
        skipWhitespace();
        if (source[index] !== ':') fail('expected colon');
        index += 1;
        object[key] = parseValue();
        skipWhitespace();
        if (source[index] === '}') {
          index += 1;
          return object;
        }
        if (source[index] !== ',') fail('expected comma or closing brace');
        index += 1;
      }
      fail('unterminated object');
    }
    if (token === '[') {
      index += 1;
      skipWhitespace();
      const array = [];
      if (source[index] === ']') {
        index += 1;
        return array;
      }
      while (index < source.length) {
        array.push(parseValue());
        skipWhitespace();
        if (source[index] === ']') {
          index += 1;
          return array;
        }
        if (source[index] !== ',') fail('expected comma or closing bracket');
        index += 1;
      }
      fail('unterminated array');
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(literal, index)) {
        index += literal.length;
        return value;
      }
    }
    const number = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number) {
      index += number.length;
      return Number(number);
    }
    fail('unexpected token');
  };

  const value = parseValue();
  skipWhitespace();
  if (index !== source.length) fail('unexpected trailing content');
  return value;
}

export function buildApprovalSubject({
  baselineRef,
  branchRef,
  reviewedRef = branchRef,
  repoRoot,
  snapshotRelPath = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json',
  fixtureRelPath = 'lib/spring-ts/test/fixtures/spring_ts_baseline_cases.json',
  candidateSnapshotRelPath = 'lib/spring-ts/test/baseline/gyeokguk_candidate_snapshot.json',
  exactDiffs = [],
} = {}) {
  return {
    baselineCommit: resolveRefCommit(baselineRef, { repoRoot }),
    reviewedCommit: resolveRefCommit(reviewedRef, { repoRoot }),
    exactDiffFingerprint: fingerprintSnapshotDiff(exactDiffs),
    baselineFixtureSetSha256: sha256Content(readBufferAtRef(
      baselineRef,
      fixtureRelPath,
      { repoRoot },
    )),
    reviewedFixtureSetSha256: sha256Content(readBufferAtRef(
      reviewedRef,
      fixtureRelPath,
      { repoRoot },
    )),
    baselineSnapshotSha256: sha256Content(readBufferAtRef(
      baselineRef,
      snapshotRelPath,
      { repoRoot },
    )),
    reviewedSnapshotSha256: sha256Content(readBufferAtRef(
      reviewedRef,
      snapshotRelPath,
      { repoRoot },
    )),
    baselineCandidateSnapshotSha256: sha256Content(readBufferAtRef(
      baselineRef,
      candidateSnapshotRelPath,
      { repoRoot },
    )),
    reviewedCandidateSnapshotSha256: sha256Content(readBufferAtRef(
      reviewedRef,
      candidateSnapshotRelPath,
      { repoRoot },
    )),
  };
}

export function verifyAttestationOnly({
  repoRoot,
  baselineRef,
  reviewedRef,
  evaluatedRef,
  manifestRelPath = 'lib/spring-ts/test/baseline/default-change-approvals.json',
  evidence = [],
} = {}) {
  const baselineCommit = resolveRefCommit(baselineRef, { repoRoot });
  const reviewedCommit = resolveRefCommit(reviewedRef, { repoRoot });
  const evaluatedCommit = resolveRefCommit(evaluatedRef, { repoRoot });
  const errors = [];
  try {
    git(repoRoot, ['merge-base', '--is-ancestor', baselineCommit, reviewedCommit]);
  } catch {
    errors.push('baselineCommit must be an ancestor of reviewedCommit');
  }
  try {
    git(repoRoot, ['merge-base', '--is-ancestor', reviewedCommit, evaluatedCommit]);
  } catch {
    errors.push('reviewedCommit must be an ancestor of the evaluated commit');
  }
  const changedPaths = git(
    repoRoot,
    ['diff', '--no-renames', '--name-only', '-z', reviewedCommit, evaluatedCommit],
  ).toString('utf8').split('\0').filter(Boolean);
  const evidencePaths = new Set();
  for (const record of evidence) {
    const reference = record?.reference;
    const safe = typeof reference === 'string'
      && !reference.includes('\\')
      && !/[\u0000-\u001f\u007f]/u.test(reference)
      && !path.posix.isAbsolute(reference)
      && !reference.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
      && (reference.endsWith('.md') || reference.endsWith('.json'))
      && (
        reference.startsWith('lib/spring-ts/docs/dossiers/default-change-')
        || reference.startsWith('lib/spring-ts/test/baseline/approval-evidence/')
      );
    if (!safe) {
      errors.push(`evidence reference is not an allowed repository path: ${String(reference)}`);
      continue;
    }
    evidencePaths.add(reference);
    try {
      const treeRow = git(
        repoRoot,
        ['ls-tree', evaluatedCommit, '--', reference],
        'utf8',
      ).trim();
      if (!treeRow.startsWith('100644 blob ')) {
        errors.push(`evidence must be a regular 100644 Git blob: ${reference}`);
        continue;
      }
      const content = readBufferAtRef(evaluatedCommit, reference, { repoRoot });
      if (content.length > 1_048_576) errors.push(`evidence exceeds 1 MiB: ${reference}`);
      if (sha256Content(content) !== record.sha256) {
        errors.push(`evidence sha256 does not match evaluated blob: ${reference}`);
      }
    } catch {
      errors.push(`evidence blob is unavailable: ${reference}`);
    }
  }
  const disallowedPaths = changedPaths.filter(
    (value) => value !== manifestRelPath && !evidencePaths.has(value),
  );
  if (disallowedPaths.length > 0) {
    errors.push(`post-review commit changes non-attestation paths: ${disallowedPaths.join(', ')}`);
  }
  if (!changedPaths.includes(manifestRelPath)) {
    errors.push('post-review attestation must commit the approval manifest');
  }
  return {
    valid: errors.length === 0,
    baselineCommit,
    reviewedCommit,
    evaluatedCommit,
    changedPaths,
    disallowedPaths,
    errors,
  };
}

export function loadApprovalManifestForEvaluation({
  repoRoot,
  branchRef,
  requestedPath = null,
  manifestRelPath = 'lib/spring-ts/test/baseline/default-change-approvals.json',
} = {}) {
  let content;
  let metadata;
  if (requestedPath) {
    const resolvedPath = path.resolve(requestedPath);
    content = fs.readFileSync(resolvedPath);
    metadata = {
      source: 'explicit-override',
      path: resolvedPath,
      ref: null,
      commit: null,
      blobOid: null,
      authoritative: false,
    };
  } else {
    content = readBufferAtRef(branchRef, manifestRelPath, { repoRoot });
    metadata = {
      source: 'evaluated-branch',
      path: manifestRelPath,
      ref: branchRef,
      commit: resolveRefCommit(branchRef, { repoRoot }),
      blobOid: git(repoRoot, ['rev-parse', `${branchRef}:${manifestRelPath}`], 'utf8').trim(),
      authoritative: true,
    };
  }
  return {
    manifest: parseJsonStrict(content, 'approval manifest'),
    metadata: { ...metadata, sha256: sha256Content(content) },
  };
}

export function deepDiff(base, current, prefix = '') {
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
  for (const key of [...keys].sort()) {
    diffs.push(...deepDiff(base[key], current[key], prefix ? `${prefix}.${key}` : key));
  }
  return diffs;
}

export function buildSnapshotDiff(baselineSnapshot, currentSnapshot) {
  const baselineResults = Array.isArray(baselineSnapshot?.results) ? baselineSnapshot.results : [];
  const currentResults = Array.isArray(currentSnapshot?.results) ? currentSnapshot.results : [];
  const baselineById = new Map(baselineResults.map((row) => [row.id, row]));
  const currentById = new Map(currentResults.map((row) => [row.id, row]));
  const ids = [...new Set([...baselineById.keys(), ...currentById.keys()])].sort();
  const allDiffs = [];

  for (const id of ids) {
    const baseline = baselineById.get(id);
    const current = currentById.get(id);
    if (!baseline) {
      allDiffs.push({
        fixture: id,
        label: current?.label,
        diffs: [{ path: '<fixture>', baseline: undefined, current: 'present (new)' }],
      });
      continue;
    }
    if (!current) {
      allDiffs.push({
        fixture: id,
        label: baseline?.label,
        diffs: [{ path: '<fixture>', baseline: 'present', current: undefined }],
      });
      continue;
    }
    const diffs = deepDiff(baseline.output, current.output);
    if (diffs.length > 0) allDiffs.push({ fixture: id, label: baseline.label, diffs });
  }
  return allDiffs;
}

function normalizeFingerprintValue(value) {
  if (value === undefined) return { $undefined: true };
  if (Array.isArray(value)) return value.map(normalizeFingerprintValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, normalizeFingerprintValue(value[key])]),
    );
  }
  return value;
}

export function fingerprintSnapshotDiff(allDiffs) {
  const normalized = [...allDiffs]
    .sort((a, b) => String(a.fixture).localeCompare(String(b.fixture)))
    .map((fixture) => ({
      fixture: fixture.fixture,
      diffs: [...fixture.diffs]
        .sort((a, b) => String(a.path).localeCompare(String(b.path)))
        .map((diff) => normalizeFingerprintValue(diff)),
    }));
  return sha256Content(JSON.stringify(normalized));
}

export function fingerprintApprovalImpact(allDiffs, subject) {
  const exactDiffFingerprint = fingerprintSnapshotDiff(allDiffs);
  const artifacts = subject ? {
    baselineFixtureSetSha256: subject.baselineFixtureSetSha256,
    reviewedFixtureSetSha256: subject.reviewedFixtureSetSha256,
    baselineSnapshotSha256: subject.baselineSnapshotSha256,
    reviewedSnapshotSha256: subject.reviewedSnapshotSha256,
    baselineCandidateSnapshotSha256: subject.baselineCandidateSnapshotSha256,
    reviewedCandidateSnapshotSha256: subject.reviewedCandidateSnapshotSha256,
  } : null;
  return sha256Content(JSON.stringify({ exactDiffFingerprint, artifacts }));
}

function hasApprovalImpact(allDiffs, subject) {
  if (allDiffs.length > 0) return true;
  if (!subject) return false;
  return subject.baselineFixtureSetSha256 !== subject.reviewedFixtureSetSha256
    || subject.baselineSnapshotSha256 !== subject.reviewedSnapshotSha256
    || subject.baselineCandidateSnapshotSha256 !== subject.reviewedCandidateSnapshotSha256;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateEvidence(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must contain at least one evidence record`);
    return;
  }
  value.forEach((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${label}[${index}] must be an object`);
      return;
    }
    if (!nonEmptyString(record.kind)) errors.push(`${label}[${index}].kind is required`);
    if (!nonEmptyString(record.reference)) errors.push(`${label}[${index}].reference is required`);
    if (!nonEmptyString(record.summary)) errors.push(`${label}[${index}].summary is required`);
    if (!SHA256_PATTERN.test(record.sha256)) errors.push(`${label}[${index}].sha256 is invalid`);
  });
}

export function validateApprovalSubject(subject, label = 'subject') {
  const errors = [];
  if (!subject || typeof subject !== 'object' || Array.isArray(subject)) {
    return [`${label} must be an object`];
  }
  for (const key of Object.keys(subject)) {
    if (!SUBJECT_FIELDS.includes(key)) errors.push(`${label}.${key} is not supported`);
  }
  for (const field of SUBJECT_FIELDS) {
    const value = subject[field];
    const valid = field.endsWith('Commit') ? COMMIT_PATTERN.test(value) : SHA256_PATTERN.test(value);
    if (!valid) errors.push(`${label}.${field} is invalid`);
  }
  return errors;
}

export function validateApprovalManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest must be an object'];
  }
  for (const key of Object.keys(manifest)) {
    if (!TOP_LEVEL_KEYS.has(key)) errors.push(`manifest.${key} is not supported`);
  }
  if (manifest.schemaVersion !== APPROVAL_SCHEMA_VERSION) {
    errors.push(`manifest.schemaVersion must be ${APPROVAL_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(manifest.approvals)) {
    errors.push('manifest.approvals must be an array');
    return errors;
  }

  const fingerprints = new Set();
  manifest.approvals.forEach((entry, index) => {
    const label = `manifest.approvals[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${label} must be an object`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.has(key)) errors.push(`${label}.${key} is not supported`);
    }
    if (!SHA256_PATTERN.test(entry.fingerprint)) {
      errors.push(`${label}.fingerprint is invalid`);
    } else if (fingerprints.has(entry.fingerprint)) {
      errors.push(`${label}.fingerprint duplicates ${entry.fingerprint}`);
    } else {
      fingerprints.add(entry.fingerprint);
    }
    if (!['pending', 'approved', 'superseded'].includes(entry.status)) {
      errors.push(`${label}.status must be pending, approved, or superseded`);
      return;
    }

    if (entry.status === 'superseded') {
      if (!nonEmptyString(entry.supersededBy)) errors.push(`${label}.supersededBy is required`);
      if (!isValidIsoDate(entry.supersededAt)) {
        errors.push(`${label}.supersededAt must be a valid YYYY-MM-DD date`);
      }
      validateEvidence(entry.supersessionEvidence, `${label}.supersessionEvidence`, errors);
      return;
    }

    errors.push(...validateApprovalSubject(entry.subject, `${label}.subject`));
    if (entry.status === 'approved') {
      if (!nonEmptyString(entry.reviewedBy)) errors.push(`${label}.reviewedBy is required`);
      if (!isValidIsoDate(entry.reviewedAt)) {
        errors.push(`${label}.reviewedAt must be a valid YYYY-MM-DD date`);
      }
      validateEvidence(entry.evidence, `${label}.evidence`, errors);
    } else if (entry.evidence !== undefined && entry.evidence !== null) {
      if (!Array.isArray(entry.evidence)) errors.push(`${label}.evidence must be an array`);
    }
  });
  return errors;
}

function diffSubject(expected, actual) {
  if (!actual) return ['runtime approval subject is required'];
  return SUBJECT_FIELDS
    .filter((field) => expected?.[field] !== actual?.[field])
    .map((field) => `subject.${field} does not match the evaluated refs`);
}

export function resolveDiffApproval(
  allDiffs,
  manifest,
  approvalSubject = null,
  approvalAttestation = null,
) {
  const fingerprint = fingerprintApprovalImpact(allDiffs, approvalSubject);
  const impactChanged = hasApprovalImpact(allDiffs, approvalSubject);
  const manifestErrors = validateApprovalManifest(manifest);
  if (manifestErrors.length > 0) {
    return { status: 'MANIFEST_INVALID', fingerprint, impactChanged, errors: manifestErrors };
  }

  const pending = manifest.approvals.filter((entry) => entry.status === 'pending');
  if (pending.length > 0) {
    return {
      status: 'REGISTRY_PENDING',
      fingerprint,
      impactChanged,
      pendingFingerprints: pending.map((entry) => entry.fingerprint),
      errors: pending.map((entry) => `pending approval remains for ${entry.fingerprint}`),
    };
  }
  if (!impactChanged) return { status: 'NOT_REQUIRED', fingerprint, impactChanged, errors: [] };

  const entry = manifest.approvals.find(
    (candidate) => candidate.fingerprint === fingerprint && candidate.status === 'approved',
  );
  if (!entry) return { status: 'MISSING', fingerprint, impactChanged, errors: [] };

  const subjectErrors = diffSubject(entry.subject, approvalSubject);
  if (subjectErrors.length > 0) {
    return { status: 'SUBJECT_MISMATCH', fingerprint, impactChanged, errors: subjectErrors };
  }
  if (!approvalAttestation?.valid) {
    return {
      status: 'ATTESTATION_INVALID',
      fingerprint,
      impactChanged,
      errors: approvalAttestation?.errors ?? ['post-review attestation is required'],
    };
  }
  return {
    status: 'APPROVED',
    fingerprint,
    impactChanged,
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt,
    evidence: entry.evidence,
    subject: entry.subject,
    attestation: approvalAttestation,
    errors: [],
  };
}

export function loadApprovalManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return parseJsonStrict(fs.readFileSync(manifestPath), 'approval manifest');
}

export function resolveManifestPath(requestedPath, defaultPath) {
  return path.resolve(requestedPath ?? defaultPath);
}
