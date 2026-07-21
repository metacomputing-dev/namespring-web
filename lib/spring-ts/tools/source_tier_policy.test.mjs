import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  classifyAiProvenance,
  hasApprovedAuthorityReview,
  isAuthorityTruthEligible,
  shouldAuditEvidenceDirectory,
  validateSourceTierMetadata,
  validateSourceTierRecord,
} from './source_tier_policy.mjs';
import {
  SPRING_TS_ROOT,
  primaryTextRecord,
  tier,
} from './source-tier/test-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('T3 authority truth requires approved review metadata', () => {
  const sourceTier = tier();
  const violations = validateSourceTierMetadata(sourceTier);
  assert.ok(violations.some((row) => row.code === 'unreviewed_t3_authority_truth'));
  assert.equal(isAuthorityTruthEligible({ sourceTier }), false);
});

test('approved generic T3 metadata still stays outside the authority allowlist', () => {
  const sourceTier = tier({
    authorityReview: {
      status: 'approved',
      reviewedBy: 'independent-expert@example.test',
      reviewedAt: '2026-07-10',
    },
  });
  assert.equal(hasApprovedAuthorityReview(sourceTier), true);
  assert.deepEqual(validateSourceTierMetadata(sourceTier), []);
  const record = { sourceTier };
  assert.ok(validateSourceTierRecord(record)
    .some((row) => row.code === 'unapproved_authority_source_type'));
  assert.equal(isAuthorityTruthEligible(record), false);
});

test('malformed metadata fails even when all keys exist', () => {
  const violations = validateSourceTierMetadata(tier({
    sourceType: '',
    sourceUrl: 'not a uri',
    accessedAt: '2026-99-99',
    humanInterpretation: '',
    authorityTruthEligible: false,
  }));
  const codes = new Set(violations.map((row) => row.code));
  assert.ok(codes.has('invalid_sourceTier_field'));
  assert.ok(codes.has('invalid_source_url'));
  assert.ok(codes.has('invalid_accessed_at'));

  const impossibleDate = validateSourceTierMetadata(tier({
    accessedAt: '2026-02-31',
    authorityTruthEligible: false,
  }));
  assert.ok(impossibleDate.some((row) => row.code === 'invalid_accessed_at'));

  for (const sourceUrl of [
    'http://example.test/insecure',
    'javascript:alert(1)',
    'https://user:password@example.test/private',
  ]) {
    assert.ok(validateSourceTierMetadata(tier({
      sourceUrl,
      authorityTruthEligible: false,
    })).some((row) => row.code === 'invalid_source_url'));
  }
});

test('underscore evidence templates are excluded and default to non-authority', () => {
  assert.equal(shouldAuditEvidenceDirectory('_authority_intake_template'), false);
  assert.equal(shouldAuditEvidenceDirectory('lecture'), true);
  const template = JSON.parse(fs.readFileSync(path.resolve(
    __dirname,
    '../test/baseline/authority/_authority_intake_template/template.flat-case.json',
  ), 'utf8'));
  assert.equal(template.sourceTier.authorityTruthEligible, false);
});

test('generic AI disguise cannot enter a T4 authority denominator', () => {
  const record = {
    aiGenerated: true,
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      authorityReview: undefined,
    }),
  };
  const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
  const codes = new Set(violations.map((row) => row.code));
  assert.ok(codes.has('ai_authority_truth_eligible'));
  assert.ok(codes.has('ai_high_tier_source'));
  assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
});

test('central provenance scope catches explicit nested metadata without scanning arbitrary notes', () => {
  const record = {
    source: {
      kind: 'trainingDerived',
    },
    expected: {
      note: 'This note discusses synthetic transformations.',
    },
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      authorityReview: undefined,
    }),
  };
  const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
  const codes = new Set(violations.map((row) => row.code));
  assert.ok(codes.has('ai_authority_truth_eligible'));
  assert.ok(codes.has('ai_high_tier_source'));

  const directPrimaryText = primaryTextRecord({
    prompt: 'What is the cited passage?',
    note: 'AI-generated claims are excluded; this is direct primary text.',
  });
  assert.equal(classifyAiProvenance(directPrimaryText).isAiDerived, false);
  assert.ok(validateSourceTierRecord(directPrimaryText, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'unsupported_primary_text_authority_field'));
  assert.equal(isAuthorityTruthEligible(directPrimaryText, { root: SPRING_TS_ROOT }), false);
});

test('central provenance classification catches concealed boolean markers without flagging statistical models', () => {
  const concealed = {
    generatedByAI: true,
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      authorityReview: undefined,
    }),
  };
  assert.equal(classifyAiProvenance(concealed).isAiDerived, true);
  assert.equal(isAuthorityTruthEligible(concealed, { root: SPRING_TS_ROOT }), false);

  const statisticalModel = {
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'statistical_model',
      authorityReview: undefined,
    }),
  };
  assert.equal(classifyAiProvenance(statisticalModel).isAiDerived, false);
  assert.ok(validateSourceTierRecord(statisticalModel, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'unapproved_authority_source_type'));
  assert.equal(isAuthorityTruthEligible(statisticalModel, { root: SPRING_TS_ROOT }), false);

  for (const sourceType of ['aiGenerated', 'llmGenerated', 'modelGenerated']) {
    const camelCase = {
      sourceTier: tier({
        tier: 'T4_PRIMARY_TEXT',
        sourceType,
        authorityReview: undefined,
      }),
    };
    assert.equal(classifyAiProvenance(camelCase).isAiDerived, true);
    assert.equal(isAuthorityTruthEligible(camelCase, { root: SPRING_TS_ROOT }), false);
  }

  const statusMarker = {
    status: 'ai_generated',
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      authorityReview: undefined,
    }),
  };
  assert.equal(classifyAiProvenance(statusMarker).isAiDerived, true);
  assert.equal(isAuthorityTruthEligible(statusMarker, { root: SPRING_TS_ROOT }), false);
});

test('authority allowlist rejects unknown source classes and ambiguous model metadata', () => {
  for (const sourceType of [
    'deepseek_generated',
    'trainingDerived',
    'synthetic_hypothesis',
    'internal_phonetic_rule_policy',
    'classical-primary-text',
    'ClassicalPrimaryText',
    'CLASSICAL PRIMARY TEXT',
  ]) {
    const record = {
      sourceTier: tier({
        tier: 'T4_PRIMARY_TEXT',
        sourceType,
        authorityReview: undefined,
      }),
    };
    assert.ok(validateSourceTierRecord(record, { root: SPRING_TS_ROOT })
      .some((row) => row.code === 'unapproved_authority_source_type'));
    assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
  }

  for (const metadata of [
    { model: 'o3' },
    { models: ['qwen3'] },
    { createdBy: 'unknown generator' },
    { generator: 'qwen3' },
    { modelName: 'o3' },
    { model_id: 'claude-5' },
    { generationModel: 'gpt-5' },
    { generatedWith: 'Claude' },
    { llm: 'o3' },
    { aiEngine: 'qwen3' },
    { engine: 'gpt-5' },
    { authoringSystem: 'ChatGPT' },
    { producedBy: 'Claude' },
    { writtenBy: 'ChatGPT' },
    { aiTool: 'o3' },
  ]) {
    const record = primaryTextRecord(metadata);
    assert.ok(validateSourceTierRecord(record, { root: SPRING_TS_ROOT })
      .some((row) => row.code === 'unverified_generation_metadata'));
    assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
  }

  const semanticBoolean = {
    aiAssisted: true,
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      authorityReview: undefined,
    }),
  };
  assert.equal(classifyAiProvenance(semanticBoolean).isAiDerived, true);
  assert.equal(isAuthorityTruthEligible(semanticBoolean, { root: SPRING_TS_ROOT }), false);
});

test('nested child sourceTier records do not contaminate an independent parent authority record', () => {
  const parent = primaryTextRecord({
    appendix: {
      aiGenerated: true,
      sourceTier: tier({
        tier: 'T1_HYPOTHESIS',
        sourceType: 'training_derived',
        authorityTruthEligible: false,
        authorityReview: undefined,
      }),
    },
  });
  assert.equal(classifyAiProvenance(parent).isAiDerived, false);
  assert.ok(validateSourceTierRecord(parent, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'unsupported_primary_text_authority_field'));
  assert.equal(isAuthorityTruthEligible(parent, { root: SPRING_TS_ROOT }), false);

  const hiddenInsideTruth = primaryTextRecord({
    expected: {
      totalScore: 999,
      aiGenerated: true,
      sourceTier: tier({
        tier: 'T1_HYPOTHESIS',
        sourceType: 'training_derived',
        authorityTruthEligible: false,
        authorityReview: undefined,
      }),
    },
  });
  assert.equal(classifyAiProvenance(hiddenInsideTruth).isAiDerived, true);
  assert.equal(isAuthorityTruthEligible(hiddenInsideTruth, { root: SPRING_TS_ROOT }), false);

  const concealedPayload = {
    aiGenerated: true,
    sourceTier: tier({
      tier: 'T1_HYPOTHESIS',
      sourceType: 'training_derived',
      authorityTruthEligible: false,
      authorityReview: undefined,
    }),
  };
  for (const [rootKey, payload] of [
    ['expected', [concealedPayload]],
    ['narrativeClaims', [concealedPayload]],
    ['cards', { surfacedCardTypes: [concealedPayload] }],
    ['hedgePolicy', { requireHedgedStrength: concealedPayload }],
  ]) {
    const record = primaryTextRecord({ [rootKey]: payload });
    assert.equal(
      classifyAiProvenance(record).isAiDerived,
      true,
      rootKey + ' must remain inside the parent authority provenance boundary',
    );
    assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
  }
});

test('explicit authorship disclosures block authority while negated disclosures do not', () => {
  for (const humanInterpretation of [
    'This extraction was AI-generated.',
    'Written by ChatGPT after source review.',
    '\uC774 \uD574\uC11D\uC740 AI\uAC00 \uC791\uC131\uD55C \uCD08\uC548\uC785\uB2C8\uB2E4.',
  ]) {
    const record = primaryTextRecord({}, { humanInterpretation });
    assert.equal(classifyAiProvenance(record).isAiDerived, true);
    assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
  }

  for (const humanInterpretation of [
    'This extraction was not generated by AI.',
    'This was not drafted with Claude.',
    'AI-generated claims are excluded; this is direct primary text.',
  ]) {
    const record = primaryTextRecord({}, { humanInterpretation });
    assert.equal(classifyAiProvenance(record).isAiDerived, false);
    assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), true);
  }
});

test('source-tier policy keeps an immutable facade and an acyclic internal boundary', async () => {
  const facadePath = path.resolve(__dirname, 'source_tier_policy.mjs');
  const facade = fs.readFileSync(facadePath, 'utf8');
  assert.ok(facade.split(/\r?\n/).length <= 200, 'policy facade must remain thin');

  const sourceTierDir = path.resolve(__dirname, 'source-tier');
  const productionFiles = fs.readdirSync(sourceTierDir)
    .filter((fileName) =>
      fileName.endsWith('.mjs') &&
      !fileName.endsWith('.test.mjs') &&
      fileName !== 'test-helpers.mjs')
    .sort();
  assert.deepEqual(productionFiles, [
    'ai-provenance.mjs',
    'authority-evidence.mjs',
    'panel-dossier-evidence.mjs',
    'panel-evidence.mjs',
    'policy-core.mjs',
  ]);

  const allowedEdges = new Map([
    ['policy-core.mjs', []],
    ['authority-evidence.mjs', ['policy-core.mjs']],
    ['ai-provenance.mjs', ['authority-evidence.mjs', 'policy-core.mjs']],
    ['panel-dossier-evidence.mjs', ['authority-evidence.mjs', 'policy-core.mjs']],
    ['panel-evidence.mjs', [
      'authority-evidence.mjs',
      'panel-dossier-evidence.mjs',
      'policy-core.mjs',
    ]],
  ]);
  const graph = new Map();
  for (const fileName of productionFiles) {
    const filePath = path.resolve(sourceTierDir, fileName);
    const source = fs.readFileSync(filePath, 'utf8');
    assert.ok(source.split(/\r?\n/).length <= 600, fileName + ' exceeds the module size guard');
    assert.doesNotMatch(source, /source_tier_policy\.mjs/, fileName + ' must not import the facade');
    assert.doesNotMatch(source, /\bimport\s*\(/, fileName + ' must not use dynamic imports');

    const edges = [];
    const importPattern = /from\s+['"]\.\/([^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) edges.push(match[1]);
    edges.sort();
    assert.deepEqual(edges, [...(allowedEdges.get(fileName) ?? [])].sort());
    graph.set(fileName, edges);
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (fileName) => {
    assert.equal(visiting.has(fileName), false, 'source-tier import cycle at ' + fileName);
    if (visited.has(fileName)) return;
    visiting.add(fileName);
    for (const dependency of graph.get(fileName) ?? []) visit(dependency);
    visiting.delete(fileName);
    visited.add(fileName);
  };
  for (const fileName of productionFiles) visit(fileName);

  const policy = await import('./source_tier_policy.mjs');
  assert.deepEqual(Object.keys(policy).sort(), [
    'AUTHORITY_SCOPES',
    'AUTHORITY_TRUTH_PAYLOAD_ROOTS',
    'PANEL_ADJUDICATED_SOURCE_TYPE',
    'SOURCE_TIER_REQUIRED_FIELDS',
    'authorityScopesForRecord',
    'classifyAiProvenance',
    'computePanelRecordDigest',
    'hasApprovedAuthorityReview',
    'isAuthorityTruthEligible',
    'parseTierRank',
    'shouldAuditEvidenceDirectory',
    'validateSourceTierMetadata',
    'validateSourceTierRecord',
  ].sort());
  const authorityPolicy = await import('./source-tier/authority-evidence.mjs');
  assert.equal(Object.isFrozen(policy.AUTHORITY_SCOPES), true);
  assert.equal(Object.isFrozen(policy.AUTHORITY_TRUTH_PAYLOAD_ROOTS), true);
  assert.equal(Object.isFrozen(policy.SOURCE_TIER_REQUIRED_FIELDS), true);
  assert.equal(Object.isFrozen(authorityPolicy.PANEL_AUTHORITY_SCOPES), true);
});
