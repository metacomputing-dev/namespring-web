import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const APPROVAL_SCHEMA_VERSION = 'spring-ts.default-change-approval.v2';

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

function validateEvidenceRecords(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`at least one ${label} record is required`);
    return;
  }
  value.forEach((evidence, index) => {
    if (!nonEmptyString(evidence?.kind)) errors.push(`${label}[${index}].kind is required`);
    if (!nonEmptyString(evidence?.reference)) errors.push(`${label}[${index}].reference is required`);
    if (!nonEmptyString(evidence?.summary)) errors.push(`${label}[${index}].summary is required`);
  });
}

export function fingerprintBlockerInventory(blockers) {
  const normalized = Array.isArray(blockers)
    ? [...blockers]
      .sort((a, b) => String(a?.id).localeCompare(String(b?.id)))
      .map(normalizeFingerprintValue)
    : [];
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized), 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

export function validateBlockerInventory(inventory, { requireClosed = false } = {}) {
  const errors = [];
  if (!Array.isArray(inventory?.blockers)) {
    return ['canonical blocker inventory must contain an explicit blockers array'];
  }
  const blockerIds = new Set();
  inventory.blockers.forEach((blocker, index) => {
    const label = `blockers[${index}]`;
    if (!nonEmptyString(blocker?.id)) {
      errors.push(`${label}.id is required`);
    } else if (blockerIds.has(blocker.id)) {
      errors.push(`${label}.id duplicates ${blocker.id}`);
    } else {
      blockerIds.add(blocker.id);
    }
    if (!['P0', 'P1', 'P2'].includes(blocker?.severity)) {
      errors.push(`${label}.severity must be P0, P1, or P2`);
    }
    if (!['open', 'resolved', 'accepted'].includes(blocker?.status)) {
      errors.push(`${label}.status must be open, resolved, or accepted`);
      return;
    }
    if (requireClosed && blocker.status === 'open') {
      errors.push(`${label} (${blocker.id ?? 'unknown'}) remains unresolved`);
    }
    if (blocker.status === 'resolved') {
      if (!nonEmptyString(blocker.resolvedBy)) errors.push(`${label}.resolvedBy is required`);
      if (!isValidIsoDate(blocker.resolvedAt)) {
        errors.push(`${label}.resolvedAt must be a valid YYYY-MM-DD date`);
      }
      validateEvidenceRecords(blocker.resolutionEvidence, `${label}.resolutionEvidence`, errors);
    }
    if (blocker.status === 'accepted') {
      if (blocker.severity !== 'P2') errors.push(`${label}.accepted is allowed only for P2`);
      if (!nonEmptyString(blocker.acceptedBy)) errors.push(`${label}.acceptedBy is required`);
      if (!isValidIsoDate(blocker.acceptedAt)) {
        errors.push(`${label}.acceptedAt must be a valid YYYY-MM-DD date`);
      }
      if (!nonEmptyString(blocker.acceptanceRationale)) {
        errors.push(`${label}.acceptanceRationale is required`);
      }
      validateEvidenceRecords(blocker.acceptanceEvidence, `${label}.acceptanceEvidence`, errors);
    }
  });
  return errors;
}

export function validateApprovedEntry(entry, blockerInventory) {
  const errors = [];
  if (entry?.status !== 'approved') errors.push('status must be approved');
  if (!nonEmptyString(entry?.reviewedBy)) errors.push('reviewedBy is required');
  if (!isValidIsoDate(entry?.reviewedAt)) errors.push('reviewedAt must be a valid YYYY-MM-DD date');
  validateEvidenceRecords(entry?.evidence, 'evidence', errors);
  if (Object.prototype.hasOwnProperty.call(entry ?? {}, 'blockers')) {
    errors.push('approval entry must not self-declare blockers; use blockerInventories');
  }
  const inventoryFingerprint = fingerprintBlockerInventory(blockerInventory?.blockers);
  if (entry?.blockerInventoryFingerprint !== inventoryFingerprint) {
    errors.push(`blockerInventoryFingerprint must equal ${inventoryFingerprint}`);
  }
  errors.push(...validateBlockerInventory(blockerInventory, { requireClosed: true }));
  return errors;
}

export function resolveReleaseBlockers(manifest) {
  if (
    !manifest
    || manifest.schemaVersion !== APPROVAL_SCHEMA_VERSION
    || !Array.isArray(manifest.approvals)
    || !Array.isArray(manifest.blockerInventories)
    || !Array.isArray(manifest.releaseBlockers)
  ) {
    return {
      status: 'MANIFEST_INVALID',
      releaseBlockerInventoryFingerprint: null,
      errors: [
        `manifest must use ${APPROVAL_SCHEMA_VERSION} with approvals, blockerInventories, and releaseBlockers arrays`,
      ],
    };
  }

  const releaseInventory = { blockers: manifest.releaseBlockers };
  const inventoryErrors = validateBlockerInventory(releaseInventory);
  const expectedFingerprint = fingerprintBlockerInventory(manifest.releaseBlockers);
  if (!nonEmptyString(manifest.releaseBlockerInventoryFingerprint)) {
    inventoryErrors.push('releaseBlockerInventoryFingerprint is required');
  } else if (manifest.releaseBlockerInventoryFingerprint !== expectedFingerprint) {
    inventoryErrors.push(
      `releaseBlockerInventoryFingerprint must equal ${expectedFingerprint}`,
    );
  }
  if (inventoryErrors.length > 0) {
    return {
      status: 'MANIFEST_INVALID',
      releaseBlockerInventoryFingerprint: expectedFingerprint,
      errors: inventoryErrors,
    };
  }

  const readinessErrors = validateBlockerInventory(releaseInventory, { requireClosed: true });
  return {
    status: readinessErrors.length === 0 ? 'READY' : 'BLOCKED',
    releaseBlockerInventoryFingerprint: expectedFingerprint,
    blockers: manifest.releaseBlockers,
    errors: readinessErrors,
  };
}

export function resolveDiffApproval(allDiffs, manifest) {
  const fingerprint = fingerprintSnapshotDiff(allDiffs);
  const releaseReadiness = resolveReleaseBlockers(manifest);
  if (releaseReadiness.status === 'MANIFEST_INVALID') {
    return {
      status: 'MANIFEST_INVALID',
      fingerprint,
      releaseBlockerInventoryFingerprint:
        releaseReadiness.releaseBlockerInventoryFingerprint,
      errors: releaseReadiness.errors,
    };
  }
  if (releaseReadiness.status === 'BLOCKED') {
    return {
      status: 'RELEASE_BLOCKED',
      fingerprint,
      releaseBlockerInventoryFingerprint:
        releaseReadiness.releaseBlockerInventoryFingerprint,
      blockers: releaseReadiness.blockers,
      errors: releaseReadiness.errors,
    };
  }
  if (allDiffs.length === 0) {
    return {
      status: 'NOT_REQUIRED',
      fingerprint,
      releaseBlockerInventoryFingerprint:
        releaseReadiness.releaseBlockerInventoryFingerprint,
      errors: [],
    };
  }
  const matches = manifest.approvals.filter((entry) => entry?.fingerprint === fingerprint);
  if (matches.length > 1) {
    return {
      status: 'MANIFEST_INVALID',
      fingerprint,
      errors: [`fingerprint must have exactly one approval entry; found ${matches.length}`],
    };
  }
  if (matches.length === 0) {
    return { status: 'MISSING', fingerprint, errors: [] };
  }
  const inventoryMatches = manifest.blockerInventories.filter(
    (inventory) => inventory?.fingerprint === fingerprint,
  );
  if (inventoryMatches.length !== 1) {
    return {
      status: 'MANIFEST_INVALID',
      fingerprint,
      errors: [`fingerprint must have exactly one canonical blocker inventory; found ${inventoryMatches.length}`],
    };
  }

  const entry = matches[0];
  const blockerInventory = inventoryMatches[0];
  const inventoryErrors = validateBlockerInventory(blockerInventory);
  if (inventoryErrors.length > 0) {
    return { status: 'MANIFEST_INVALID', fingerprint, errors: inventoryErrors };
  }
  const blockerInventoryFingerprint = fingerprintBlockerInventory(blockerInventory.blockers);
  if (entry?.blockerInventoryFingerprint !== blockerInventoryFingerprint) {
    return {
      status: 'MANIFEST_INVALID',
      fingerprint,
      blockerInventoryFingerprint,
      errors: [`approval entry is not bound to canonical blocker inventory ${blockerInventoryFingerprint}`],
    };
  }

  if (entry?.status === 'approved') {
    const errors = validateApprovedEntry(entry, blockerInventory);
    return {
      status: errors.length === 0 ? 'APPROVED' : 'INVALID_APPROVAL',
      fingerprint,
      blockerInventoryFingerprint,
      reviewedBy: entry.reviewedBy ?? null,
      reviewedAt: entry.reviewedAt ?? null,
      evidence: entry.evidence ?? [],
      errors,
    };
  }
  if (entry?.status !== 'pending') {
    return {
      status: 'MANIFEST_INVALID',
      fingerprint,
      blockerInventoryFingerprint,
      errors: ['approval entry status must be pending or approved'],
    };
  }
  return { status: 'PENDING', fingerprint, blockerInventoryFingerprint, errors: [] };
}

export function loadApprovalManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function resolveManifestPath(requestedPath, defaultPath) {
  return path.resolve(requestedPath ?? defaultPath);
}
