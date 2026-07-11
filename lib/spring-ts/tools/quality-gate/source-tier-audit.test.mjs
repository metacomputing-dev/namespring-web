import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_CLASSICAL_QUOTE_MAX_CHARS,
  auditSourceTierEvidence,
} from './source-tier-audit.mjs';

function sourceTier(overrides = {}) {
  return {
    tier: 'T1_HYPOTHESIS',
    sourceType: 'hypothesis',
    sourceUrl: null,
    accessedAt: '2026-07-11',
    quoteShort: null,
    humanInterpretation: 'Synthetic source-tier audit test record.',
    copyrightNote: 'Synthetic test data only.',
    authorityTruthEligible: false,
    ...overrides,
  };
}

test('preserves scan and violation order across evidence directories and extra files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-gate-source-tier-audit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const authorityDir = path.join(root, 'test/baseline/authority');
  const classicalDir = path.join(authorityDir, 'classical');
  fs.mkdirSync(classicalDir, { recursive: true });
  const evidencePath = path.join(classicalDir, 'record.json');
  fs.writeFileSync(evidencePath, JSON.stringify({
    source: { tradition: 'classical' },
    sourceTier: sourceTier({ quoteShort: 'x'.repeat(DEFAULT_CLASSICAL_QUOTE_MAX_CHARS + 1) }),
    snippets: [{
      sourceTier: sourceTier({ quoteShort: 'y'.repeat(DEFAULT_CLASSICAL_QUOTE_MAX_CHARS + 1) }),
    }],
  }), 'utf-8');

  const invalidJsonPath = path.join(root, 'invalid.json');
  fs.writeFileSync(invalidJsonPath, '{', 'utf-8');

  const report = auditSourceTierEvidence({
    root,
    evidenceDirs: [authorityDir, path.join(root, 'missing-directory')],
    extraJsonFiles: [invalidJsonPath, path.join(root, 'missing.json')],
  });

  assert.equal(report.status, 'FAIL');
  assert.equal(report.scanned, 2);
  assert.deepEqual(
    report.violations.map((violation) => violation.code),
    ['classical_quote_too_long', 'classical_quote_too_long', 'invalid_json'],
  );
  assert.deepEqual(
    report.violations.slice(0, 2).map((violation) => violation.quotePath),
    ['sourceTier.quoteShort', 'snippets[0].sourceTier.quoteShort'],
  );
  assert.equal(report.violations[0].file, 'test/baseline/authority/classical/record.json');
  assert.equal(report.violations[2].file, 'invalid.json');
});
