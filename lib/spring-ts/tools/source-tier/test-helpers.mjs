import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_SCOPES,
  PANEL_ADJUDICATED_SOURCE_TYPE,
  computePanelRecordDigest,
} from '../source_tier_policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
export const CLAUDE_MODEL = {
  provider: 'anthropic',
  family: 'claude',
  version: '5',
};
export const GPT_MODEL = {
  provider: 'openai',
  family: 'gpt',
  version: '5',
};

export function tier(overrides = {}) {
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

export function primaryTextRecord(extra = {}, sourceTierOverrides = {}) {
  const quote = 'The source directly classifies this case as WEAK.';
  const pageFile = 'test/fixtures/evidence/primary-text-page.txt';
  const transcriptFile = 'test/fixtures/evidence/primary-text-transcript.txt';
  const pageDigest = 'sha256:' + crypto.createHash('sha256')
    .update(fs.readFileSync(path.resolve(SPRING_TS_ROOT, pageFile)))
    .digest('hex');
  const transcriptDigest = 'sha256:' + crypto.createHash('sha256')
    .update(fs.readFileSync(path.resolve(SPRING_TS_ROOT, transcriptFile)))
    .digest('hex');
  return {
    case_id: 'policy-primary-001',
    source: {
      text: 'Public classical source',
      author: 'Historical author',
      compilation: 'Reviewed page-image compilation',
      page_in_compilation: 1,
    },
    expected: { strengthLevel: 'WEAK' },
    prose_quote: {
      verbatim: quote,
      extracted_from: 'Reviewed page image',
      page_image: pageFile,
      page_image_sha256: pageDigest,
      transcript_file: transcriptFile,
      transcript_sha256: transcriptDigest,
    },
    evidenceBindings: [{
      field: 'expected.strengthLevel',
      quoteFragment: 'WEAK',
      interpretation: 'The quoted classification is normalized as WEAK.',
    }],
    ...extra,
    sourceTier: tier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      sourceUrl: 'https://zh.wikisource.org/wiki/Test_primary_text',
      quoteShort: quote,
      authorityReview: {
        status: 'approved',
        reviewedBy: 'independent-saju-expert@example.test',
        reviewedAt: '2026-07-10',
      },
      ...sourceTierOverrides,
    }),
  };
}

export function approvedPanel(overrides = {}, recordOverrides = {}) {
  const record = {
    id: 'panel-case-001',
    expected: { strengthLevel: 'WEAK' },
    ...recordOverrides,
    sourceTier: tier({
      sourceType: PANEL_ADJUDICATED_SOURCE_TYPE,
      aiGenerated: true,
      panelAdjudication: {
        models: [CLAUDE_MODEL, GPT_MODEL],
        scopes: [AUTHORITY_SCOPES.SAJU_DOCTRINE],
        adversarialVerification: true,
        dossier: 'docs/dossiers/panel-review',
        recordId: 'panel-case-001',
        contentDigest: '',
      },
      authorityReview: {
        status: 'approved',
        reviewedBy: 'owner@example.test',
        reviewedAt: '2026-07-10',
      },
      ...overrides,
    }),
  };
  const adjudication = record.sourceTier.panelAdjudication;
  if (adjudication && typeof adjudication === 'object') {
    if (adjudication.recordId === undefined) adjudication.recordId = record.id;
    if (adjudication.contentDigest === undefined || adjudication.contentDigest === '') {
      adjudication.contentDigest = computePanelRecordDigest(record);
    }
  }
  return record;
}

export function createPanelValidationRoot(record) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-panel-policy-'));
  const dossier = path.join(root, 'docs/dossiers/panel-review');
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, 'README.md'), 'Panel evidence.\n', 'utf8');
  const evidence = [
    {
      model: CLAUDE_MODEL,
      path: 'claude-5-output.json',
      document: {
        schemaVersion: 'spring-ts.panel-evidence.v1',
        model: CLAUDE_MODEL,
        recordId: record.id,
        recordDigest: record.sourceTier.panelAdjudication.contentDigest,
        scopes: record.sourceTier.panelAdjudication.scopes,
        verdict: 'approved',
        output: {
          reasoning: 'Independent reasoning trace retained for policy regression.',
        },
      },
    },
    {
      model: GPT_MODEL,
      path: 'gpt-5-output.json',
      document: {
        schemaVersion: 'spring-ts.panel-evidence.v1',
        model: GPT_MODEL,
        recordId: record.id,
        recordDigest: record.sourceTier.panelAdjudication.contentDigest,
        scopes: record.sourceTier.panelAdjudication.scopes,
        verdict: 'approved',
        output: {
          reasoning: 'Independent counter-analysis retained for policy regression.',
        },
      },
    },
  ];
  for (const row of evidence) {
    fs.writeFileSync(
      path.join(dossier, row.path),
      JSON.stringify(row.document, null, 2),
      'utf8',
    );
  }
  const adjudication = record.sourceTier.panelAdjudication;
  fs.writeFileSync(path.join(dossier, 'panel-manifest.json'), JSON.stringify({
    schemaVersion: 'spring-ts.panel-adjudication.v1',
    records: [{
      recordId: adjudication.recordId,
      contentDigest: adjudication.contentDigest,
      models: adjudication.models,
      scopes: adjudication.scopes,
      adversarialVerification: true,
      verdict: 'approved',
      reviewedBy: record.sourceTier.authorityReview.reviewedBy,
      reviewedAt: record.sourceTier.authorityReview.reviewedAt,
      evidence: evidence.map((row) => ({
        model: row.model,
        path: row.path,
        bytes: Buffer.byteLength(JSON.stringify(row.document, null, 2)),
        fileDigest: 'sha256:' + crypto.createHash('sha256')
          .update(JSON.stringify(row.document, null, 2))
          .digest('hex'),
      })),
    }],
  }, null, 2), 'utf8');
  return root;
}
