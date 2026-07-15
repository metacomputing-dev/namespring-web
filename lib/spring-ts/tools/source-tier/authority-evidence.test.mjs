import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  AUTHORITY_SCOPES,
  isAuthorityTruthEligible,
  validateSourceTierMetadata,
  validateSourceTierRecord,
} from '../source_tier_policy.mjs';
import {
  SPRING_TS_ROOT,
  primaryTextRecord,
  tier,
} from './test-helpers.mjs';

test('T4 doctrine truth requires quote-bound interpretation and approved review', () => {
  const record = primaryTextRecord();
  const { sourceTier } = record;
  assert.deepEqual(validateSourceTierMetadata(sourceTier), []);
  assert.equal(isAuthorityTruthEligible(record), false);
  assert.equal(isAuthorityTruthEligible(record, {
    root: SPRING_TS_ROOT,
    requiredScope: AUTHORITY_SCOPES.SAJU_DOCTRINE,
  }), true);
  assert.equal(isAuthorityTruthEligible(record, {
    root: SPRING_TS_ROOT,
    requiredScope: AUTHORITY_SCOPES.NAMING_SCORE_CALIBRATION,
  }), false);
});

test('T4 doctrine evidence cannot launder naming, narrative, product, or safety contracts', () => {
  for (const extra of [
    { expected: { strengthLevel: 'WEAK', totalScore: 999 } },
    { narrativeClaims: [{ type: 'mustIncludeAny', patterns: ['BUY_NOW'] }] },
    { cards: { surfacedCardTypes: ['gyeokguk'] } },
    { hedgePolicy: { requireHedgedStrength: true } },
  ]) {
    const record = primaryTextRecord(extra);
    assert.ok(validateSourceTierRecord(record, { root: SPRING_TS_ROOT })
      .some((row) => row.code === 'unsupported_primary_text_authority_field'));
    assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
  }
});

test('T4 doctrine evidence rejects public-URL-only claims and nested subject fields', () => {
  const fabricatedCitation = primaryTextRecord({}, {
    sourceUrl: 'https://zh.wikisource.org/wiki/THIS_PAGE_DOES_NOT_EXIST_019f',
  });
  delete fabricatedCitation.prose_quote.page_image_sha256;
  assert.ok(validateSourceTierRecord(fabricatedCitation, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'incomplete_primary_text_evidence'));

  const nestedSubject = primaryTextRecord({
    subject: { name_hanja: 'TEST', agent: { generatedByAI: false } },
  });
  assert.ok(validateSourceTierRecord(nestedSubject, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'unsupported_primary_text_authority_field'));
});

test('T4 doctrine values must use normalized scalar contracts', () => {
  for (const expected of [
    { gyeokguk: { malformed: true } },
    { strengthLevel: '' },
    { yongshinElement: 'AETHER' },
  ]) {
    const field = Object.keys(expected)[0];
    const record = primaryTextRecord({
      expected,
      evidenceBindings: [{
        field: 'expected.' + field,
        quoteFragment: 'WEAK',
        interpretation: 'The quoted classification is mapped to the expected field.',
      }],
    });
    const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
    assert.ok(violations.some((row) => row.code === 'invalid_primary_text_expected_value'));
    assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
  }
});

test('T4 repository evidence rejects normalized temporary paths', () => {
  const record = primaryTextRecord();
  record.sourceTier.sourceUrl = 'https://example.test/not-public-authority';
  record.prose_quote.page_image = './tmp/source_tier_policy.test.mjs';
  const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
  assert.ok(violations.some((row) => row.code === 'incomplete_primary_text_evidence'));
  assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
});

test('T4 transcript must contain the exact bound quotation', () => {
  const record = primaryTextRecord();
  const unrelatedFile = 'tools/source_tier_policy.test.mjs';
  const unrelatedPath = path.resolve(SPRING_TS_ROOT, unrelatedFile);
  record.prose_quote.transcript_file = unrelatedFile;
  record.prose_quote.transcript_sha256 = 'sha256:' + crypto.createHash('sha256')
    .update(fs.readFileSync(unrelatedPath))
    .digest('hex');
  const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
  assert.ok(violations.some((row) => row.code === 'incomplete_primary_text_evidence'));
  assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
});

test('T4 page and transcript evidence must be distinct tracked artifacts', () => {
  const record = primaryTextRecord();
  record.prose_quote.transcript_file = record.prose_quote.page_image;
  record.prose_quote.transcript_sha256 = record.prose_quote.page_image_sha256;
  const violations = validateSourceTierRecord(record, { root: SPRING_TS_ROOT });
  assert.ok(violations.some((row) => row.code === 'incomplete_primary_text_evidence'));
  assert.equal(isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT }), false);
});

test('T5 official data cannot be promoted into a saju doctrine denominator', () => {
  const record = {
    expected: { strengthLevel: 'WEAK' },
    sourceTier: tier({
      tier: 'T5_OFFICIAL',
      sourceType: 'official_public_data_catalog',
      sourceUrl: 'https://www.data.go.kr/data/test',
      authorityReview: undefined,
    }),
  };
  assert.ok(validateSourceTierRecord(record, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'authority_scope_mismatch'));
  assert.equal(isAuthorityTruthEligible(record, {
    root: SPRING_TS_ROOT,
    requiredScope: AUTHORITY_SCOPES.SAJU_DOCTRINE,
  }), false);
});

test('T4 primary-text claims require case-bound quote and page provenance', () => {
  const unsupported = {
    expected: { totalScore: 999 },
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      authorityReview: undefined,
    }),
  };
  assert.ok(validateSourceTierRecord(unsupported, { root: SPRING_TS_ROOT })
    .some((row) => row.code === 'incomplete_primary_text_evidence'));
  assert.equal(isAuthorityTruthEligible(unsupported, { root: SPRING_TS_ROOT }), false);
});
