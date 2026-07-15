import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  AUTHORITY_SCOPES,
  PANEL_ADJUDICATED_SOURCE_TYPE,
  authorityScopesForRecord,
  classifyAiProvenance,
  isAuthorityTruthEligible,
  validateSourceTierRecord,
} from '../source_tier_policy.mjs';
import {
  CLAUDE_MODEL,
  GPT_MODEL,
  SPRING_TS_ROOT,
  approvedPanel,
  createPanelValidationRoot,
  tier,
} from './test-helpers.mjs';

test('panel sourceType is AI provenance even when disclosure fields are concealed', () => {
  const record = approvedPanel({
    aiGenerated: undefined,
    panelAdjudication: undefined,
  });
  assert.equal(classifyAiProvenance(record).isAiDerived, true);
  const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
  const codes = new Set(violations.map((row) => row.code));
  assert.ok(codes.has('missing_panel_ai_disclosure'));
  assert.ok(codes.has('missing_panel_adjudication'));
  assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
});

test('panel authority requires distinct model identities and a contained dossier directory', () => {
  const duplicateModels = approvedPanel({
    panelAdjudication: {
      models: ['Claude-5', ' claude-5 '],
      adversarialVerification: true,
      dossier: 'docs/dossiers/truth-panel-2026-07-10',
    },
  });
  assert.ok(validateSourceTierRecord(duplicateModels, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'insufficient_distinct_panel_models'));

  const providerAlias = approvedPanel({
    panelAdjudication: {
      models: ['gpt-5', 'openai/gpt-5'],
      adversarialVerification: true,
      dossier: 'docs/dossiers/truth-panel-2026-07-10',
    },
  });
  assert.ok(validateSourceTierRecord(providerAlias, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'insufficient_distinct_panel_models'));

  const spacedProviderAlias = approvedPanel({
    panelAdjudication: {
      models: ['gpt-5', 'OpenAI GPT-5'],
      adversarialVerification: true,
      dossier: 'docs/dossiers/truth-panel-2026-07-10',
    },
  });
  assert.ok(validateSourceTierRecord(spacedProviderAlias, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'insufficient_distinct_panel_models'));

  for (const models of [
    ['gpt-5', 'gpt5'],
    ['gpt-5', 'OpenAI.GPT-5'],
    ['gpt-5', 'openai--gpt-5'],
    ['claude-5', 'claude_5'],
  ]) {
    const punctuationAlias = approvedPanel({
      panelAdjudication: {
        models,
        adversarialVerification: true,
        dossier: 'docs/dossiers/truth-panel-2026-07-10',
      },
    });
    assert.ok(validateSourceTierRecord(punctuationAlias, { root: SPRING_TS_ROOT })
      .some((row) => row.code === 'insufficient_distinct_panel_models'));
  }

  const traversal = approvedPanel({
    panelAdjudication: {
      models: ['claude-5', 'gpt-5'],
      adversarialVerification: true,
      dossier: '../',
    },
  });
  assert.ok(validateSourceTierRecord(traversal, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'invalid_panel_dossier_path'));

  const dossierRoot = approvedPanel({
    panelAdjudication: {
      models: ['claude-5', 'gpt-5'],
      adversarialVerification: true,
      dossier: 'docs/dossiers',
    },
  });
  assert.ok(validateSourceTierRecord(dossierRoot, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'invalid_panel_dossier_path'));
});

test('complete panel record is eligible only with an explicit validation root', () => {
  const record = approvedPanel();
  const root = createPanelValidationRoot(record);
  assert.deepEqual(validateSourceTierRecord(record, { root }), []);
  assert.deepEqual(authorityScopesForRecord(record), [AUTHORITY_SCOPES.SAJU_DOCTRINE]);
  assert.equal(isAuthorityTruthEligible(record, { root }), true);
  assert.equal(isAuthorityTruthEligible(record, {
    root,
    requiredScope: AUTHORITY_SCOPES.SAJU_DOCTRINE,
  }), true);
  assert.equal(isAuthorityTruthEligible(record, {
    root,
    requiredScope: AUTHORITY_SCOPES.NAMING_SCORE_CALIBRATION,
  }), false);
  assert.equal(isAuthorityTruthEligible(record), false);
});

test('panel scopes are explicit, payload-bound, and repeated in manifest evidence', () => {
  const namingLaundering = approvedPanel({}, {
    expected: { totalScore: 99 },
  });
  const namingRoot = createPanelValidationRoot(namingLaundering);
  assert.ok(validateSourceTierRecord(namingLaundering, { root: namingRoot })
    .some((row) => row.code === 'panel_scope_payload_mismatch'));
  assert.equal(isAuthorityTruthEligible(namingLaundering, { root: namingRoot }), false);

  const unknownScope = approvedPanel({
    panelAdjudication: {
      models: [CLAUDE_MODEL, GPT_MODEL],
      scopes: ['all_authority'],
      adversarialVerification: true,
      dossier: 'docs/dossiers/panel-review',
    },
  });
  const unknownRoot = createPanelValidationRoot(unknownScope);
  assert.ok(validateSourceTierRecord(unknownScope, { root: unknownRoot })
    .some((row) => row.code === 'invalid_panel_authority_scopes'));

  const manifestMismatch = approvedPanel();
  const manifestRoot = createPanelValidationRoot(manifestMismatch);
  const manifestPath = path.join(
    manifestRoot,
    'docs/dossiers/panel-review/panel-manifest.json',
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.records[0].scopes = [];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  assert.ok(validateSourceTierRecord(manifestMismatch, { root: manifestRoot })
    .some((row) => row.code === 'panel_manifest_scopes_mismatch'));

  const evidenceMismatch = approvedPanel();
  const evidenceRoot = createPanelValidationRoot(evidenceMismatch);
  const evidencePath = path.join(
    evidenceRoot,
    'docs/dossiers/panel-review/claude-5-output.json',
  );
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  evidence.scopes = [];
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
  assert.ok(validateSourceTierRecord(evidenceMismatch, { root: evidenceRoot })
    .some((row) => row.code === 'panel_evidence_scopes_mismatch'));
});

test('non-authority panel drafts remain AI-marked without invoking promotion requirements', () => {
  const record = {
    sourceTier: tier({
      tier: 'T1_HYPOTHESIS',
      sourceType: PANEL_ADJUDICATED_SOURCE_TYPE,
      aiGenerated: true,
      authorityTruthEligible: false,
      authorityReview: undefined,
    }),
  };
  assert.deepEqual(validateSourceTierRecord(record, { root: SPRING_TS_ROOT }), []);
  assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
});

test('panel sourceType must match exactly before the authority exception applies', () => {
  const record = approvedPanel({
    sourceType: ' ' + PANEL_ADJUDICATED_SOURCE_TYPE + ' ',
  });
  const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
  const codes = new Set(violations.map((row) => row.code));
  assert.ok(codes.has('ai_authority_truth_eligible'));
  assert.ok(codes.has('ai_high_tier_source'));
  assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
});

test('panel manifest binds approval to the exact adjudicated record content', () => {
  const record = approvedPanel();
  const root = createPanelValidationRoot(record);
  assert.equal(isAuthorityTruthEligible(record, { root }), true);

  const copiedMetadata = JSON.parse(JSON.stringify(record));
  copiedMetadata.expected.strengthLevel = 'STRONG';
  const violations = validateSourceTierRecord(copiedMetadata, { root });
  assert.ok(violations.some((row) => row.code === 'panel_content_digest_mismatch'));
  assert.ok(violations.some((row) => row.code === 'panel_manifest_digest_mismatch'));
  assert.equal(isAuthorityTruthEligible(copiedMetadata, { root }), false);

  const changedProvenance = JSON.parse(JSON.stringify(record));
  changedProvenance.sourceTier.sourceUrl = 'https://example.test/unreviewed-copy';
  assert.ok(validateSourceTierRecord(changedProvenance, { root })
    .some((row) => row.code === 'panel_content_digest_mismatch'));
  assert.equal(isAuthorityTruthEligible(changedProvenance, { root }), false);
});

test('panel promotion rejects unknown model identities even with a self-authored manifest', () => {
  const record = approvedPanel({
    panelAdjudication: {
      models: [
        { provider: 'unknown', family: 'foo', version: '1' },
        { provider: 'unknown', family: 'bar', version: '1' },
      ],
      adversarialVerification: true,
      dossier: 'docs/dossiers/panel-review',
    },
  });
  const root = createPanelValidationRoot(record);
  assert.ok(validateSourceTierRecord(record, { root })
    .some((row) => row.code === 'unapproved_panel_model_identity'));
  assert.equal(isAuthorityTruthEligible(record, { root }), false);
});

test('panel promotion rejects malformed or duplicate raw model entries before canonicalization', () => {
  for (const models of [
    [CLAUDE_MODEL, GPT_MODEL, 'bogus-shape'],
    [CLAUDE_MODEL, GPT_MODEL, GPT_MODEL],
  ]) {
    const record = approvedPanel({
      panelAdjudication: {
        models,
        scopes: [AUTHORITY_SCOPES.SAJU_DOCTRINE],
        adversarialVerification: true,
        dossier: 'docs/dossiers/panel-review',
      },
    });
    const root = createPanelValidationRoot(record);
    assert.ok(validateSourceTierRecord(record, { root })
      .some((row) => row.code === 'invalid_panel_models'));
    assert.equal(isAuthorityTruthEligible(record, { root }), false);
  }
});

test('panel manifest and evidence preserve exact raw model and scope arrays', () => {
  const manifestModelRecord = approvedPanel();
  const manifestModelRoot = createPanelValidationRoot(manifestModelRecord);
  const manifestModelPath = path.join(
    manifestModelRoot,
    'docs/dossiers/panel-review/panel-manifest.json',
  );
  const manifestModel = JSON.parse(fs.readFileSync(manifestModelPath, 'utf8'));
  manifestModel.records[0].models.push('bogus-shape');
  fs.writeFileSync(manifestModelPath, JSON.stringify(manifestModel, null, 2), 'utf8');
  assert.ok(validateSourceTierRecord(manifestModelRecord, { root: manifestModelRoot })
    .some((row) => row.code === 'panel_manifest_models_mismatch'));

  const manifestScopeRecord = approvedPanel();
  const manifestScopeRoot = createPanelValidationRoot(manifestScopeRecord);
  const manifestScopePath = path.join(
    manifestScopeRoot,
    'docs/dossiers/panel-review/panel-manifest.json',
  );
  const manifestScope = JSON.parse(fs.readFileSync(manifestScopePath, 'utf8'));
  manifestScope.records[0].scopes.push('naming_score_calibration');
  fs.writeFileSync(manifestScopePath, JSON.stringify(manifestScope, null, 2), 'utf8');
  assert.ok(validateSourceTierRecord(manifestScopeRecord, { root: manifestScopeRoot })
    .some((row) => row.code === 'panel_manifest_scopes_mismatch'));

  const evidenceScopeRecord = approvedPanel();
  const evidenceScopeRoot = createPanelValidationRoot(evidenceScopeRecord);
  const evidenceScopePath = path.join(
    evidenceScopeRoot,
    'docs/dossiers/panel-review/claude-5-output.json',
  );
  const evidenceScope = JSON.parse(fs.readFileSync(evidenceScopePath, 'utf8'));
  evidenceScope.scopes.push('naming_score_calibration');
  fs.writeFileSync(evidenceScopePath, JSON.stringify(evidenceScope, null, 2), 'utf8');
  assert.ok(validateSourceTierRecord(evidenceScopeRecord, { root: evidenceScopeRoot })
    .some((row) => row.code === 'panel_evidence_scopes_mismatch'));
});

test('panel doctrine truth rejects malformed expected values', () => {
  const record = approvedPanel({}, {
    expected: { gyeokguk: { malformed: true } },
  });
  const root = createPanelValidationRoot(record);
  assert.ok(validateSourceTierRecord(record, { root })
    .some((row) => row.code === 'invalid_panel_doctrine_expected_value'));
  assert.equal(isAuthorityTruthEligible(record, { root }), false);
});
