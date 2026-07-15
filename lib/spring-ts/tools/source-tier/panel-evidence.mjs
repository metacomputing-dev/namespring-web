import crypto from 'node:crypto';

import {
  AUTHORITY_SCOPES,
  invalidDoctrineExpectedFields,
} from './authority-evidence.mjs';
import {
  hasApprovedAuthorityReview,
  nonEmptyString,
  violation,
} from './policy-core.mjs';
import {
  canonicalPanelModelSet,
  canonicalPanelScopeSet,
  hasExactPanelModelListShape,
  hasExactPanelScopeListShape,
  isApprovedPanelModelIdentity,
  validatePanelDossierEvidence,
} from './panel-dossier-evidence.mjs';

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = canonicalJsonValue(value[key]);
  }
  return output;
}

export function computePanelRecordDigest(record) {
  if (
    !record ||
    typeof record !== 'object' ||
    Array.isArray(record) ||
    !record.sourceTier ||
    typeof record.sourceTier !== 'object' ||
    Array.isArray(record.sourceTier)
  ) {
    return null;
  }
  try {
    const jsonSafe = JSON.parse(JSON.stringify(record));
    if (jsonSafe.sourceTier?.panelAdjudication) {
      delete jsonSafe.sourceTier.panelAdjudication.contentDigest;
    }
    const canonical = JSON.stringify(canonicalJsonValue(jsonSafe));
    return 'sha256:' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  } catch {
    return null;
  }
}

function panelRecordIdentifiers(record) {
  const identifiers = [];
  for (const key of ['id', 'fixtureId', 'caseId', 'case_id']) {
    if (nonEmptyString(record?.[key])) identifiers.push(record[key].trim());
  }
  return [...new Set(identifiers)];
}

function validatePanelRecordBinding(record, adjudication, add) {
  const identifiers = panelRecordIdentifiers(record);
  if (identifiers.length === 0) {
    add('missing_panel_record_id', 'panel authority record must expose id, fixtureId, caseId, or case_id');
  } else if (identifiers.length > 1) {
    add('ambiguous_panel_record_id', 'panel authority record exposes conflicting record identifiers');
  }
  const actualRecordId = identifiers.length === 1 ? identifiers[0] : null;
  const declaredRecordId = nonEmptyString(adjudication.recordId)
    ? adjudication.recordId.trim()
    : null;
  if (!declaredRecordId) {
    add('missing_panel_bound_record_id', 'panelAdjudication.recordId is required');
  } else if (actualRecordId && declaredRecordId !== actualRecordId) {
    add('panel_record_id_mismatch', 'panelAdjudication.recordId must match the authority record identifier');
  }

  const computedDigest = computePanelRecordDigest(record);
  if (!computedDigest) {
    add('unhashable_panel_record', 'panel authority record must be canonical JSON with a nested sourceTier');
  }
  const declaredDigest = nonEmptyString(adjudication.contentDigest)
    ? adjudication.contentDigest.trim()
    : null;
  if (!declaredDigest || !/^sha256:[a-f0-9]{64}$/.test(declaredDigest)) {
    add('invalid_panel_content_digest', 'panelAdjudication.contentDigest must be a lowercase sha256 digest');
  } else if (computedDigest && declaredDigest !== computedDigest) {
    add('panel_content_digest_mismatch', 'panelAdjudication.contentDigest does not match the authority record');
  }

  return {
    recordId: actualRecordId,
    contentDigest: computedDigest,
  };
}

function validatePanelScopeContract(record, adjudication, add) {
  const rawScopes = adjudication?.scopes;
  const scopes = canonicalPanelScopeSet(rawScopes);
  if (!hasExactPanelScopeListShape(rawScopes)) {
    add(
      'invalid_panel_authority_scopes',
      'panelAdjudication.scopes must be a non-empty, duplicate-free list of reviewed authority scopes',
    );
  }

  const payloadScopes = new Set();
  const expected = record?.expected;
  if (expected !== undefined) {
    if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
      add('invalid_panel_truth_payload', 'panel expected truth must be an object');
    } else {
      const doctrineFields = new Set(['gyeokguk', 'strengthLevel', 'yongshinElement']);
      const namingFields = new Set(['totalScore', 'scores']);
      const unknownFields = Object.keys(expected)
        .filter((field) => !doctrineFields.has(field) && !namingFields.has(field));
      if (unknownFields.length > 0) {
        add(
          'unsupported_panel_truth_field',
          'panel expected truth contains fields outside the reviewed scope contract',
          { fields: unknownFields },
        );
      }
      if (Object.keys(expected).some((field) => doctrineFields.has(field))) {
        payloadScopes.add(AUTHORITY_SCOPES.SAJU_DOCTRINE);
      }
      const invalidDoctrineFields = invalidDoctrineExpectedFields(
        Object.fromEntries(
          Object.entries(expected).filter(([field]) => doctrineFields.has(field)),
        ),
      );
      if (invalidDoctrineFields.length > 0) {
        add(
          'invalid_panel_doctrine_expected_value',
          'panel doctrine expected values must use non-empty normalized strings and a known element code',
          { fields: invalidDoctrineFields },
        );
      }
      if (Object.keys(expected).some((field) => namingFields.has(field))) {
        payloadScopes.add(AUTHORITY_SCOPES.NAMING_SCORE_CALIBRATION);
      }
      if ('totalScore' in expected && !Number.isFinite(expected.totalScore)) {
        add('invalid_panel_naming_score', 'expected.totalScore must be a finite number');
      }
      if ('scores' in expected) {
        const scores = expected.scores;
        if (
          !scores ||
          typeof scores !== 'object' ||
          Array.isArray(scores) ||
          Object.keys(scores).length === 0 ||
          Object.keys(scores).some((field) => !['hangul', 'hanja', 'fourFrame'].includes(field)) ||
          Object.values(scores).some((value) => !Number.isFinite(value))
        ) {
          add(
            'invalid_panel_naming_scores',
            'expected.scores must contain only finite hangul, hanja, or fourFrame values',
          );
        }
      }
    }
  }

  if (record?.narrativeClaims !== undefined) {
    payloadScopes.add(AUTHORITY_SCOPES.NARRATIVE_SEMANTIC_CONTRACT);
    const claims = record.narrativeClaims;
    if (
      !Array.isArray(claims) ||
      claims.length === 0 ||
      claims.some((claim) =>
        !claim ||
        typeof claim !== 'object' ||
        Array.isArray(claim) ||
        Object.keys(claim).some((key) => !['type', 'patterns', 'pattern'].includes(key)) ||
        !['mustIncludeAny', 'mustNotMatch'].includes(claim.type))
    ) {
      add('invalid_panel_narrative_claims', 'narrativeClaims must use the reviewed semantic-claim schema');
    }
  }

  if (record?.cards !== undefined) {
    payloadScopes.add(AUTHORITY_SCOPES.PRODUCT_SURFACE_CONTRACT);
    const cards = record.cards;
    if (
      !cards ||
      typeof cards !== 'object' ||
      Array.isArray(cards) ||
      Object.keys(cards).some((key) => key !== 'surfacedCardTypes') ||
      !Array.isArray(cards.surfacedCardTypes) ||
      cards.surfacedCardTypes.length === 0 ||
      cards.surfacedCardTypes.some((value) => !nonEmptyString(value))
    ) {
      add('invalid_panel_product_surface', 'cards must contain a non-empty surfacedCardTypes string list');
    }
  }

  if (record?.hedgePolicy !== undefined) {
    payloadScopes.add(AUTHORITY_SCOPES.SAFETY_COPY_POLICY);
    const hedgePolicy = record.hedgePolicy;
    if (
      !hedgePolicy ||
      typeof hedgePolicy !== 'object' ||
      Array.isArray(hedgePolicy) ||
      Object.keys(hedgePolicy).length === 0 ||
      Object.keys(hedgePolicy).some((key) =>
        !['requireHedgedStrength', 'requireHourUncertaintyNote'].includes(key)) ||
      Object.values(hedgePolicy).some((value) => typeof value !== 'boolean')
    ) {
      add('invalid_panel_safety_policy', 'hedgePolicy must use the reviewed boolean safety schema');
    }
  }

  const payloadScopeList = [...payloadScopes].sort();
  if (
    scopes.length !== payloadScopeList.length ||
    scopes.some((scope, index) => scope !== payloadScopeList[index])
  ) {
    add(
      'panel_scope_payload_mismatch',
      'panelAdjudication.scopes must exactly match the truth payloads present in the record',
      { declaredScopes: scopes, payloadScopes: payloadScopeList },
    );
  }
  return scopes;
}

export function validatePanelAdjudication(record, sourceTier, {
  file,
  sourceTierPath,
  root,
}) {
  const violations = [];
  const add = (code, message, extra = {}) => {
    violations.push(violation(file, sourceTierPath, code, message, extra));
  };

  if (sourceTier.tier !== 'T3_AUTHORED_INTERPRETATION') {
    add(
      'invalid_panel_tier',
      sourceTierPath + '.tier must be T3_AUTHORED_INTERPRETATION for panel adjudication',
    );
  }
  if (sourceTier.authorityTruthEligible !== true) {
    add(
      'invalid_panel_authority_flag',
      sourceTierPath + '.authorityTruthEligible must be true for panel adjudication',
    );
  }
  if (sourceTier.aiGenerated !== true) {
    add(
      'missing_panel_ai_disclosure',
      sourceTierPath + '.aiGenerated=true is required for panel adjudication',
    );
  }

  const adjudication = sourceTier.panelAdjudication;
  if (!adjudication || typeof adjudication !== 'object' || Array.isArray(adjudication)) {
    add(
      'missing_panel_adjudication',
      sourceTierPath + '.panelAdjudication object is required',
    );
    return violations;
  }

  const modelIds = canonicalPanelModelSet(adjudication.models);
  if (!hasExactPanelModelListShape(adjudication.models)) {
    add(
      'invalid_panel_models',
      sourceTierPath + '.panelAdjudication.models must contain only unique structured model identities',
    );
  }
  if (modelIds.length < 2) {
    add(
      'insufficient_distinct_panel_models',
      sourceTierPath + '.panelAdjudication.models requires at least two distinct model identities',
    );
  }
  const unapprovedModels = modelIds.filter((model) => !isApprovedPanelModelIdentity(model));
  if (unapprovedModels.length > 0) {
    add(
      'unapproved_panel_model_identity',
      sourceTierPath + '.panelAdjudication.models contains a model outside the reviewed catalog',
      { models: unapprovedModels },
    );
  }
  if (adjudication.adversarialVerification !== true) {
    add(
      'missing_panel_adversarial_verification',
      sourceTierPath + '.panelAdjudication.adversarialVerification=true is required',
    );
  }
  const panelScopes = validatePanelScopeContract(record, adjudication, add);
  const binding = validatePanelRecordBinding(record, adjudication, add);

  validatePanelDossierEvidence({
    dossier: adjudication.dossier,
    root,
    binding,
    modelIds,
    panelScopes,
    sourceTier,
    sourceTierPath,
    add,
  });

  if (!hasApprovedAuthorityReview(sourceTier)) {
    add(
      'missing_panel_authority_review',
      sourceTierPath + '.authorityReview must be approved before panel authority promotion',
    );
  }
  return violations;
}
