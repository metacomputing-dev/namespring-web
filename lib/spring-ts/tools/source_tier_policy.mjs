import {
  SOURCE_TIER_REQUIRED_FIELDS,
  hasApprovedAuthorityReview,
  parseTierRank,
  shouldAuditEvidenceDirectory,
  validateSourceTierMetadata,
  violation,
} from './source-tier/policy-core.mjs';
import {
  AUTHORITY_SCOPES,
  AUTHORITY_TRUTH_PAYLOAD_ROOTS,
  PANEL_ADJUDICATED_SOURCE_TYPE,
  authorityScopesForRecord,
  isApprovedAuthoritySourceType,
  isForcedNonAuthoritySourceType,
  validateAuthorityEvidenceContract,
} from './source-tier/authority-evidence.mjs';
import {
  classifyAiProvenance,
  findAmbiguousGenerationMetadata,
} from './source-tier/ai-provenance.mjs';
import {
  computePanelRecordDigest,
  validatePanelAdjudication,
} from './source-tier/panel-evidence.mjs';

export {
  AUTHORITY_SCOPES,
  AUTHORITY_TRUTH_PAYLOAD_ROOTS,
  PANEL_ADJUDICATED_SOURCE_TYPE,
  SOURCE_TIER_REQUIRED_FIELDS,
  authorityScopesForRecord,
  classifyAiProvenance,
  computePanelRecordDigest,
  hasApprovedAuthorityReview,
  parseTierRank,
  shouldAuditEvidenceDirectory,
  validateSourceTierMetadata,
};

export function isAuthorityTruthEligible(record, options = {}) {
  const sourceTier = record?.sourceTier;
  const rank = parseTierRank(sourceTier);
  if (sourceTier?.authorityTruthEligible !== true || rank === null || rank < 3) return false;
  if (validateSourceTierRecord(record, options).length > 0) return false;
  if (
    options.requiredScope &&
    !authorityScopesForRecord(record).includes(options.requiredScope)
  ) {
    return false;
  }
  return rank !== 3 || hasApprovedAuthorityReview(sourceTier);
}

export function validateSourceTierRecord(record, {
  sourceTier = record?.sourceTier ?? record,
  file = '<unknown>',
  sourceTierPath = 'sourceTier',
  root = null,
} = {}) {
  const violations = validateSourceTierMetadata(sourceTier, { file, sourceTierPath });
  if (!sourceTier || typeof sourceTier !== 'object' || Array.isArray(sourceTier)) {
    return violations;
  }

  const provenance = classifyAiProvenance({ ...record, sourceTier });
  const isAiDerived = provenance.isAiDerived;
  const rank = parseTierRank(sourceTier);
  const panelPromotionAttempt =
    provenance.isPanelAdjudicated &&
    (sourceTier.authorityTruthEligible === true || (rank !== null && rank >= 3));
  if (panelPromotionAttempt) {
    violations.push(...validatePanelAdjudication(record, sourceTier, {
      file,
      sourceTierPath,
      root,
    }));
  } else if (isAiDerived) {
    if (sourceTier.authorityTruthEligible === true) {
      violations.push(violation(
        file,
        sourceTierPath,
        'ai_authority_truth_eligible',
        'AI-derived records cannot enter authority denominators outside the complete panel contract',
      ));
    }
    if (rank !== null && rank >= 3) {
      violations.push(violation(
        file,
        sourceTierPath,
        'ai_high_tier_source',
        'AI-derived records cannot use T3+ authority tiers outside the complete panel contract',
      ));
    }
  }

  if (
    sourceTier.authorityTruthEligible === true &&
    !provenance.isPanelAdjudicated &&
    !isApprovedAuthoritySourceType(sourceTier)
  ) {
    violations.push(violation(
      file,
      sourceTierPath,
      'unapproved_authority_source_type',
      sourceTier.tier + '/' + sourceTier.sourceType + ' is not in the reviewed authority source allowlist',
    ));
  }
  if (
    sourceTier.authorityTruthEligible === true &&
    !provenance.isPanelAdjudicated &&
    isApprovedAuthoritySourceType(sourceTier)
  ) {
    violations.push(...validateAuthorityEvidenceContract(record, sourceTier, {
      file,
      sourceTierPath,
      root,
    }));
  }
  if (!provenance.isPanelAdjudicated && rank !== null && rank >= 3) {
    const ambiguousPaths = findAmbiguousGenerationMetadata({ ...record, sourceTier });
    if (ambiguousPaths.length > 0) {
      violations.push(violation(
        file,
        sourceTierPath,
        'unverified_generation_metadata',
        'T3+ records with model or generator metadata require the evidence-bound panel contract',
        { paths: ambiguousPaths },
      ));
    }
  }

  if (
    sourceTier.authorityTruthEligible === true &&
    isForcedNonAuthoritySourceType(sourceTier.sourceType)
  ) {
    violations.push(violation(
      file,
      sourceTierPath,
      'non_authority_source_type',
      sourceTier.sourceType + ' must not be authority truth',
    ));
  }
  return violations;
}
