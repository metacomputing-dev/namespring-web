export const EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION =
  'spring-ts.external-saju-expert-signoff.v1';
export const DEFAULT_EXTERNAL_EXPERT_SIGNOFF_PATH =
  'docs/release-attestations/saju-engine-expert-signoff.json';
export const BASELINE_FIXTURE_RELATIVE_PATH =
  'test/fixtures/spring_ts_baseline_cases.json';
export const MIN_EXTERNAL_EXPERT_FIXTURES = 17;
export const REQUIRED_EXTERNAL_EXPERT_DIMENSIONS = Object.freeze([
  'D1', 'D2', 'D3', 'D4', 'D5',
]);
export const EXTERNAL_EXPERT_IDENTITY_DISCLAIMER =
  'This gate verifies repository-bound attestation completeness only. ' +
  'It does not authenticate the reviewer identity, verify the truth of qualifications, ' +
  'or constitute independent expert certification.';

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

export function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validCommit(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function validHttps(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      nonEmpty(url.hostname) &&
      url.username === '' &&
      url.password === '';
  } catch {
    return false;
  }
}

function validTimestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)
  ) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return canonical === value || canonical.replace('.000Z', 'Z') === value;
}

export function uniqueStrings(value) {
  if (!Array.isArray(value) || value.some((item) => !nonEmpty(item))) return null;
  const normalized = value.map((item) => item.trim());
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((item, index) => item === b[index]);
}

export function contractIssue(code, message, extra = {}) {
  return { code, message, ...extra };
}

export function contractResult(violations, summary = {}) {
  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    violations,
    summary,
    disclaimer: EXTERNAL_EXPERT_IDENTITY_DISCLAIMER,
  };
}

export function extractBaselineFixtureIds(document) {
  const ids = uniqueStrings(
    Array.isArray(document?.fixtures)
      ? document.fixtures.map((fixture) => fixture?.id)
      : null,
  );
  if (!ids || ids.length !== MIN_EXTERNAL_EXPERT_FIXTURES) {
    throw new Error(
      `${BASELINE_FIXTURE_RELATIVE_PATH} must contain exactly ` +
      `${MIN_EXTERNAL_EXPERT_FIXTURES} unique fixture IDs`,
    );
  }
  return ids;
}

export function validateExternalExpertSignoffManifest(manifest, {
  expectedFixtureIds,
} = {}) {
  const violations = [];
  if (!hasExactKeys(manifest, [
    'schemaVersion', 'status', 'subject', 'reviewer', 'coverage', 'verdict', 'evidence',
  ])) {
    violations.push(contractIssue(
      'malformed_manifest',
      'Signoff manifest must use the exact reviewed top-level contract.',
    ));
  }
  if (!isPlainObject(manifest)) return contractResult(violations);

  if (manifest.schemaVersion !== EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION) {
    violations.push(contractIssue(
      'invalid_schema_version',
      `schemaVersion must be ${EXTERNAL_EXPERT_SIGNOFF_SCHEMA_VERSION}.`,
    ));
  }
  if (manifest.status !== 'approved') {
    violations.push(contractIssue(
      'signoff_not_approved',
      'External expert signoff status must be approved; pending or draft blocks release.',
    ));
  }

  const subject = manifest.subject;
  if (!hasExactKeys(subject, ['reviewedCommit', 'fixtureIds'])) {
    violations.push(contractIssue(
      'malformed_subject',
      'subject must contain exactly reviewedCommit and fixtureIds.',
    ));
  }
  if (!validCommit(subject?.reviewedCommit)) {
    violations.push(contractIssue(
      'invalid_reviewed_commit',
      'subject.reviewedCommit must be a lowercase 40-character Git commit SHA.',
    ));
  }
  const fixtureIds = uniqueStrings(subject?.fixtureIds);
  if (!fixtureIds || fixtureIds.length !== MIN_EXTERNAL_EXPERT_FIXTURES) {
    violations.push(contractIssue(
      'insufficient_fixture_coverage',
      `Signoff must contain exactly ${MIN_EXTERNAL_EXPERT_FIXTURES} unique fixture IDs.`,
    ));
  }
  if (
    !Array.isArray(expectedFixtureIds) ||
    expectedFixtureIds.length !== MIN_EXTERNAL_EXPERT_FIXTURES
  ) {
    violations.push(contractIssue(
      'baseline_fixture_ids_unavailable',
      'The canonical baseline fixture ID set could not be loaded.',
    ));
  } else if (!fixtureIds || !sameSet(fixtureIds, expectedFixtureIds)) {
    violations.push(contractIssue(
      'fixture_set_mismatch',
      `subject.fixtureIds must exactly match ${BASELINE_FIXTURE_RELATIVE_PATH}.`,
    ));
  }

  const reviewer = manifest.reviewer;
  if (!hasExactKeys(reviewer, [
    'name', 'qualification', 'qualificationEvidenceUrl',
    'independenceConfirmed', 'independenceStatement',
  ])) {
    violations.push(contractIssue('malformed_reviewer', 'reviewer contract is malformed.'));
  }
  if (!nonEmpty(reviewer?.name) || !nonEmpty(reviewer?.qualification)) {
    violations.push(contractIssue(
      'invalid_reviewer_qualification',
      'Reviewer name and qualification summary are required.',
    ));
  }
  if (!validHttps(reviewer?.qualificationEvidenceUrl)) {
    violations.push(contractIssue(
      'invalid_reviewer_qualification_evidence',
      'reviewer.qualificationEvidenceUrl must be an HTTPS URL.',
    ));
  }
  if (
    reviewer?.independenceConfirmed !== true ||
    !nonEmpty(reviewer?.independenceStatement) ||
    reviewer.independenceStatement.trim().length < 32
  ) {
    violations.push(contractIssue(
      'missing_independence_statement',
      'Reviewer independence requires explicit confirmation and a 32-character statement.',
    ));
  }

  const coverage = manifest.coverage;
  if (!hasExactKeys(coverage, REQUIRED_EXTERNAL_EXPERT_DIMENSIONS)) {
    violations.push(contractIssue(
      'insufficient_dimension_coverage',
      'coverage must contain exactly D1, D2, D3, D4, and D5.',
    ));
  }
  for (const dimension of REQUIRED_EXTERNAL_EXPERT_DIMENSIONS) {
    const entry = coverage?.[dimension];
    const covered = uniqueStrings(entry?.fixtureIds);
    if (
      !hasExactKeys(entry, ['status', 'fixtureIds']) ||
      entry?.status !== 'reviewed' ||
      !fixtureIds ||
      !covered ||
      !sameSet(fixtureIds, covered)
    ) {
      violations.push(contractIssue(
        'insufficient_dimension_coverage',
        `${dimension} must be reviewed for every canonical fixture.`,
        { dimension },
      ));
    }
  }

  const verdict = manifest.verdict;
  if (!hasExactKeys(verdict, ['decision', 'signedAt', 'statement'])) {
    violations.push(contractIssue('malformed_verdict', 'verdict contract is malformed.'));
  }
  if (verdict?.decision !== 'approve_for_release') {
    violations.push(contractIssue('release_not_approved', 'verdict must approve this release.'));
  }
  if (!validTimestamp(verdict?.signedAt)) {
    violations.push(contractIssue('invalid_signoff_timestamp', 'signedAt must be a UTC ISO timestamp.'));
  }
  if (!nonEmpty(verdict?.statement) || verdict.statement.trim().length < 32) {
    violations.push(contractIssue(
      'invalid_release_statement',
      'Expert release reasoning must contain at least 32 characters.',
    ));
  }

  const evidencePaths = [];
  if (!Array.isArray(manifest.evidence) || manifest.evidence.length === 0) {
    violations.push(contractIssue('missing_evidence_files', 'At least one evidence file is required.'));
  } else {
    manifest.evidence.forEach((entry, index) => {
      if (
        !hasExactKeys(entry, ['path', 'sha256']) ||
        !nonEmpty(entry?.path) ||
        !/^sha256:[a-f0-9]{64}$/.test(String(entry?.sha256 ?? ''))
      ) {
        violations.push(contractIssue(
          'malformed_evidence_entry',
          'Evidence entries require exactly path and lowercase SHA-256.',
          { index },
        ));
      } else {
        evidencePaths.push(entry.path.trim());
      }
    });
    if (new Set(evidencePaths).size !== evidencePaths.length) {
      violations.push(contractIssue('duplicate_evidence_path', 'Evidence paths must be unique.'));
    }
  }

  return contractResult(violations, {
    reviewedCommit: validCommit(subject?.reviewedCommit) ? subject.reviewedCommit : null,
    fixtureCount: fixtureIds?.length ?? 0,
    dimensions: [...REQUIRED_EXTERNAL_EXPERT_DIMENSIONS],
    evidenceFileCount: Array.isArray(manifest.evidence) ? manifest.evidence.length : 0,
  });
}
