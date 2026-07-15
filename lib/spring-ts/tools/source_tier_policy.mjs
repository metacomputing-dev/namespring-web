export const SOURCE_TIER_REQUIRED_FIELDS = [
  'tier',
  'sourceType',
  'sourceUrl',
  'accessedAt',
  'quoteShort',
  'humanInterpretation',
  'copyrightNote',
  'authorityTruthEligible',
];

export function shouldAuditEvidenceDirectory(name) {
  return typeof name === 'string' && !name.startsWith('_');
}

export function parseTierRank(sourceTier) {
  const tier = sourceTier?.tier;
  if (typeof tier !== 'string') return null;
  const match = tier.match(/^T([0-5])_[A-Z0-9_]+$/);
  return match ? Number(match[1]) : null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validIsoDateOrTimestamp(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(value)) return false;
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isFinite(parsed.getTime());
}

export function hasApprovedAuthorityReview(sourceTier) {
  const review = sourceTier?.authorityReview;
  return review?.status === 'approved' &&
    nonEmptyString(review?.reviewedBy) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(review?.reviewedAt ?? '')) &&
    validIsoDateOrTimestamp(review.reviewedAt);
}

export function isAuthorityTruthEligible(record) {
  const sourceTier = record?.sourceTier;
  const rank = parseTierRank(sourceTier);
  if (sourceTier?.authorityTruthEligible !== true || rank === null || rank < 3) return false;
  return rank !== 3 || hasApprovedAuthorityReview(sourceTier);
}

function violation(file, sourceTierPath, code, message, extra = {}) {
  return { file, sourceTierPath, code, message, ...extra };
}

export function validateSourceTierMetadata(sourceTier, {
  file = '<unknown>',
  sourceTierPath = 'sourceTier',
} = {}) {
  if (!sourceTier || typeof sourceTier !== 'object' || Array.isArray(sourceTier)) {
    return [violation(file, sourceTierPath, 'missing_sourceTier', `${sourceTierPath} object is required`)];
  }

  const violations = [];
  for (const field of SOURCE_TIER_REQUIRED_FIELDS) {
    if (!(field in sourceTier)) {
      violations.push(violation(
        file,
        sourceTierPath,
        'missing_sourceTier_field',
        `${sourceTierPath}.${field} is required`,
        { field },
      ));
    }
  }

  const rank = parseTierRank(sourceTier);
  if (rank === null) {
    violations.push(violation(
      file,
      sourceTierPath,
      'invalid_sourceTier_tier',
      `invalid tier: ${sourceTier.tier}`,
    ));
  }
  for (const field of ['sourceType', 'humanInterpretation', 'copyrightNote']) {
    if (!nonEmptyString(sourceTier[field])) {
      violations.push(violation(
        file,
        sourceTierPath,
        'invalid_sourceTier_field',
        `${sourceTierPath}.${field} must be a non-empty string`,
        { field },
      ));
    }
  }
  if (sourceTier.sourceUrl !== null && sourceTier.sourceUrl !== undefined) {
    let validUrl = typeof sourceTier.sourceUrl === 'string';
    if (validUrl) {
      try {
        new URL(sourceTier.sourceUrl);
      } catch {
        validUrl = false;
      }
    }
    if (!validUrl) {
      violations.push(violation(
        file,
        sourceTierPath,
        'invalid_source_url',
        `${sourceTierPath}.sourceUrl must be null or an absolute URI`,
      ));
    }
  }
  if (!validIsoDateOrTimestamp(sourceTier.accessedAt)) {
    violations.push(violation(
      file,
      sourceTierPath,
      'invalid_accessed_at',
      `${sourceTierPath}.accessedAt must be a valid ISO date or UTC timestamp`,
    ));
  }
  if (
    sourceTier.quoteShort !== null &&
    sourceTier.quoteShort !== undefined &&
    (typeof sourceTier.quoteShort !== 'string' || [...sourceTier.quoteShort].length > 240)
  ) {
    violations.push(violation(
      file,
      sourceTierPath,
      'invalid_quote_short',
      `${sourceTierPath}.quoteShort must be null or at most 240 Unicode characters`,
    ));
  }
  if (typeof sourceTier.authorityTruthEligible !== 'boolean') {
    violations.push(violation(
      file,
      sourceTierPath,
      'invalid_authorityTruthEligible',
      `${sourceTierPath}.authorityTruthEligible must be boolean`,
    ));
  }
  if (sourceTier.authorityReview !== undefined && !hasApprovedAuthorityReview(sourceTier)) {
    violations.push(violation(
      file,
      sourceTierPath,
      'invalid_authority_review',
      `${sourceTierPath}.authorityReview must contain approved status, reviewer, and valid date`,
    ));
  }
  if (sourceTier.authorityTruthEligible === true && rank !== null && rank < 3) {
    violations.push(violation(
      file,
      sourceTierPath,
      'low_tier_authority_truth',
      `${sourceTier.tier} cannot be used as authority truth`,
      { tier: sourceTier.tier },
    ));
  }
  if (
    sourceTier.authorityTruthEligible === true &&
    rank === 3 &&
    !hasApprovedAuthorityReview(sourceTier)
  ) {
    violations.push(violation(
      file,
      sourceTierPath,
      'unreviewed_t3_authority_truth',
      `${sourceTier.tier} requires an approved authorityReview before entering authority denominators`,
      { tier: sourceTier.tier },
    ));
  }
  return violations;
}
