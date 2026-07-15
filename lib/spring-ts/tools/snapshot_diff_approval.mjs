import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const APPROVAL_SCHEMA_VERSION = 'spring-ts.default-change-approval.v1';

export function readSnapshotAtRef(ref, {
  repoRoot,
  snapshotRelPath = 'lib/spring-ts/test/baseline/spring_ts_snapshot.json',
} = {}) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
    throw new Error('repoRoot is required');
  }
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new Error('git ref is required');
  }
  const json = execFileSync('git', ['show', `${ref}:${snapshotRelPath}`], {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(json);
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
    diffs.push(...deepDiff(
      base[key],
      current[key],
      prefix ? `${prefix}.${key}` : key,
    ));
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
    if (diffs.length > 0) {
      allDiffs.push({ fixture: id, label: baseline.label, diffs });
    }
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
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized), 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateApprovedEntry(entry) {
  const errors = [];
  if (entry?.status !== 'approved') errors.push('status must be approved');
  if (!nonEmptyString(entry?.reviewedBy)) errors.push('reviewedBy is required');
  if (!isValidIsoDate(entry?.reviewedAt)) errors.push('reviewedAt must be a valid YYYY-MM-DD date');
  if (!Array.isArray(entry?.evidence) || entry.evidence.length === 0) {
    errors.push('at least one evidence record is required');
  } else {
    entry.evidence.forEach((evidence, index) => {
      if (!nonEmptyString(evidence?.kind)) errors.push(`evidence[${index}].kind is required`);
      if (!nonEmptyString(evidence?.reference)) errors.push(`evidence[${index}].reference is required`);
      if (!nonEmptyString(evidence?.summary)) errors.push(`evidence[${index}].summary is required`);
    });
  }
  return errors;
}

export function resolveDiffApproval(allDiffs, manifest) {
  const fingerprint = fingerprintSnapshotDiff(allDiffs);
  if (allDiffs.length === 0) {
    return { status: 'NOT_REQUIRED', fingerprint, errors: [] };
  }
  if (!manifest || manifest.schemaVersion !== APPROVAL_SCHEMA_VERSION || !Array.isArray(manifest.approvals)) {
    return {
      status: 'MANIFEST_INVALID',
      fingerprint,
      errors: [`manifest must use ${APPROVAL_SCHEMA_VERSION} with an approvals array`],
    };
  }
  const matches = manifest.approvals.filter((entry) => entry?.fingerprint === fingerprint);
  if (matches.length === 0) {
    return { status: 'MISSING', fingerprint, errors: [] };
  }
  const approved = matches.find((entry) => entry?.status === 'approved');
  if (approved) {
    const errors = validateApprovedEntry(approved);
    return {
      status: errors.length === 0 ? 'APPROVED' : 'INVALID_APPROVAL',
      fingerprint,
      reviewedBy: approved.reviewedBy ?? null,
      reviewedAt: approved.reviewedAt ?? null,
      evidence: approved.evidence ?? [],
      errors,
    };
  }
  return { status: 'PENDING', fingerprint, errors: [] };
}

export function loadApprovalManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function resolveManifestPath(requestedPath, defaultPath) {
  return path.resolve(requestedPath ?? defaultPath);
}
