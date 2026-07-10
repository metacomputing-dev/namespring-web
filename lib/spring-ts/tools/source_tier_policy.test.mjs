import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hasApprovedAuthorityReview,
  isAuthorityTruthEligible,
  shouldAuditEvidenceDirectory,
  validateSourceTierMetadata,
} from './source_tier_policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function tier(overrides = {}) {
  return {
    tier: 'T3_AUTHORED_INTERPRETATION',
    sourceType: 'expert_case',
    sourceUrl: 'https://example.test/case',
    accessedAt: '2026-07-10',
    quoteShort: null,
    humanInterpretation: 'Human-reviewed extraction.',
    copyrightNote: 'Facts and paraphrase only.',
    authorityTruthEligible: true,
    ...overrides,
  };
}

test('T3 authority truth requires approved review metadata', () => {
  const sourceTier = tier();
  const violations = validateSourceTierMetadata(sourceTier);
  assert.ok(violations.some((row) => row.code === 'unreviewed_t3_authority_truth'));
  assert.equal(isAuthorityTruthEligible({ sourceTier }), false);
});

test('approved T3 review unlocks authority denominator', () => {
  const sourceTier = tier({
    authorityReview: {
      status: 'approved',
      reviewedBy: 'independent-expert@example.test',
      reviewedAt: '2026-07-10',
    },
  });
  assert.equal(hasApprovedAuthorityReview(sourceTier), true);
  assert.deepEqual(validateSourceTierMetadata(sourceTier), []);
  assert.equal(isAuthorityTruthEligible({ sourceTier }), true);
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
});

test('T4 can be eligible without T3 review block', () => {
  const sourceTier = tier({
    tier: 'T4_PRIMARY_TEXT',
    authorityReview: undefined,
  });
  assert.deepEqual(validateSourceTierMetadata(sourceTier), []);
  assert.equal(isAuthorityTruthEligible({ sourceTier }), true);
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
