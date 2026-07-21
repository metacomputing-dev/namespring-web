/**
 * test/integration/no-ai-policy.test.ts
 *
 * Verifies Phase 9.3 no-AI compliance gate.
 *
 * Run: npm run test:no-ai-policy
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePanelRecordDigest } from '../../tools/source_tier_policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const CLAUDE_MODEL = { provider: 'anthropic', family: 'claude', version: '5' };
const GPT_MODEL = { provider: 'openai', family: 'gpt', version: '5' };

// Existing generated corpora predate the centralized source-tier schema.
// Count-by-code and content digest make this debt monotonic and non-replaceable.
const ACKNOWLEDGED_SOURCE_TIER_DEBT_COUNTS = Object.freeze({
  ai_missing_sourceTier: 23_220,
  invalid_accessed_at: 1_816,
  invalid_sourceTier_field: 5_380,
  invalid_sourceTier_tier: 1_749,
  missing_sourceTier_field: 12_577,
});
const ACKNOWLEDGED_SOURCE_TIER_DEBT_COUNT = 44_742;
const ACKNOWLEDGED_SOURCE_TIER_DEBT_FINGERPRINT =
  '9826df7b9a41b5d9fe84b8a6a65147411e8c21a85197189b4f8e626552d83884';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function writeText(filePath: string, data: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data, 'utf-8');
}

function sourceTier(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    tier: 'T1_HYPOTHESIS',
    sourceType: 'training_derived',
    sourceUrl: null,
    accessedAt: '2026-05-02',
    quoteShort: null,
    humanInterpretation: 'Policy fixture retained for regression observation only.',
    copyrightNote: 'No quoted source text.',
    authorityTruthEligible: false,
    ...overrides,
  };
}

function createRoot(setup: (root: string) => void): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-no-ai-policy-'));
  writeJson(path.join(root, 'package.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    type: 'module',
    dependencies: {},
    devDependencies: {},
  });
  writeJson(path.join(root, 'package-lock.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'tmp-spring-ts',
        version: '0.0.0',
        dependencies: {},
        devDependencies: {},
      },
    },
  });
  writeText(path.join(root, 'src/index.ts'), 'export const ok = true;\n');
  setup(root);
  return root;
}

function runGate(root: string): { code: number; json: any; stderr: string } {
  const args = [
    'tools/check_no_ai_policy.mjs',
    '--root', root,
    '--fixture-root', 'test',
    '--source-root', 'data/sources',
    '--runtime-root', 'src',
    '--package-json', 'package.json',
    '--package-lock', 'package-lock.json',
    '--json',
  ];
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd: SPRING_TS_ROOT,
      encoding: 'utf-8',
    });
    return { code: 0, json: JSON.parse(stdout), stderr: '' };
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() ?? '{}';
    return {
      code: Number(error?.status ?? 1),
      json: JSON.parse(stdout),
      stderr: error?.stderr?.toString?.() ?? '',
    };
  }
}

function codes(result: { json: any }): string[] {
  return (result.json.violations ?? []).map((violation: any) => violation.code).sort();
}

function markerPaths(result: { json: any }): string[] {
  return (result.json.violations ?? [])
    .flatMap((violation: any) => violation.markers ?? [])
    .map((marker: any) => marker.path)
    .sort();
}

function violationFingerprint(violations: any[]): string {
  const rows = violations
    .map((violation) => [
      violation.code,
      violation.file,
      violation.path ?? '',
      violation.recordDigest ?? '',
      JSON.stringify(violation.markers ?? []),
    ].join('\u0000'))
    .sort();
  return crypto.createHash('sha256').update(rows.join('\n')).digest('hex');
}

console.log('Phase 9.3 no-AI policy gate\n');

let currentJson: any;
try {
  const stdout = execFileSync(process.execPath, ['tools/check_no_ai_policy.mjs', '--json'], {
    cwd: SPRING_TS_ROOT,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  currentJson = JSON.parse(stdout);
} catch (error: any) {
  const stdout = error?.stdout?.toString?.();
  if (!stdout) throw error;
  currentJson = JSON.parse(stdout);
}
const currentViolations = currentJson.violations ?? [];
const currentInputErrors = currentJson.inputErrors ?? [];
const currentDebtFingerprint = violationFingerprint(currentViolations);
const currentDebtCounts = Object.fromEntries(
  Object.keys(ACKNOWLEDGED_SOURCE_TIER_DEBT_COUNTS).map((code) => [
    code,
    currentViolations.filter((violation: any) => violation.code === code).length,
  ]),
);
check('current repository does not exceed acknowledged sourceTier metadata debt',
  currentInputErrors.length === 0 &&
    currentJson.scanned.fixtureFiles > 0 &&
    currentJson.scanned.sourceRegistryFiles > 0 &&
    currentJson.scanned.sourceTierRecords > 0 &&
    currentJson.scanned.packageDependencies > 0 &&
    currentJson.scanned.runtimeSourceFiles > 0 &&
    currentViolations.length === ACKNOWLEDGED_SOURCE_TIER_DEBT_COUNT &&
    JSON.stringify(currentDebtCounts) === JSON.stringify(ACKNOWLEDGED_SOURCE_TIER_DEBT_COUNTS) &&
    currentDebtFingerprint === ACKNOWLEDGED_SOURCE_TIER_DEBT_FINGERPRINT,
  JSON.stringify({
    ...currentJson.scanned,
    status: currentJson.status,
    acknowledgedSourceTierDebt: currentViolations.length,
    acknowledgedSourceTierDebtByCode: currentDebtCounts,
    acknowledgedDebtFingerprint: currentDebtFingerprint,
  }));

const samePathDebtA = createRoot((root) => {
  writeJson(path.join(root, 'test/same-path-debt.json'), {
    aiGenerated: true,
    interpretation: 'original acknowledged content',
  });
});
const samePathDebtB = createRoot((root) => {
  writeJson(path.join(root, 'test/same-path-debt.json'), {
    aiGenerated: true,
    interpretation: 'replacement at the same file and JSON path',
  });
});
const samePathResultA = runGate(samePathDebtA);
const samePathResultB = runGate(samePathDebtB);
check('same-path legacy debt replacement changes the content-bound fingerprint',
  samePathResultA.code === 1 &&
    samePathResultB.code === 1 &&
    violationFingerprint(samePathResultA.json.violations) !==
      violationFingerprint(samePathResultB.json.violations),
  JSON.stringify({
    original: samePathResultA.json.violations,
    replacement: samePathResultB.json.violations,
  }));

const allowedTrainingRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/training.json'), {
    source: {
      kind: 'training_derived',
      ai_model: 'review-lab-model',
    },
    expected: {
      note: 'AI-derived, not citation-anchored.',
    },
    sourceTier: sourceTier({
      humanInterpretation: 'AI-derived synthetic fixture retained for regression observation only.',
    }),
  });
});
const allowedTraining = runGate(allowedTrainingRoot);
check('T1 training-derived fixture remains allowed when not authority truth',
  allowedTraining.code === 0 &&
    allowedTraining.json.status === 'PASS',
  JSON.stringify(allowedTraining.json));

const aiAuthorityRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/ai-authority.json'), {
    aiGenerated: true,
    sourceTier: sourceTier({
      tier: 'T3_AUTHORED_INTERPRETATION',
      sourceType: 'lecture_casebook',
      authorityTruthEligible: true,
    }),
  });
});
const aiAuthority = runGate(aiAuthorityRoot);
check('aiGenerated authority truth is blocked',
  aiAuthority.code === 1 &&
    aiAuthority.json.status === 'FAIL' &&
    codes(aiAuthority).includes('ai_sourceType_not_marked') &&
    codes(aiAuthority).includes('ai_authority_truth_eligible') &&
    codes(aiAuthority).includes('ai_high_tier_source') &&
    markerPaths(aiAuthority).includes('$.aiGenerated'),
  JSON.stringify(aiAuthority.json.violations));

const concealedPanelRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/concealed-panel.json'), {
    sourceTier: sourceTier({
      tier: 'T3_AUTHORED_INTERPRETATION',
      sourceType: 'ai_panel_adjudicated_interpretation',
      authorityTruthEligible: true,
      authorityReview: {
        status: 'approved',
        reviewedBy: 'owner@example.test',
        reviewedAt: '2026-07-10',
      },
    }),
  });
});
const concealedPanel = runGate(concealedPanelRoot);
check('panel sourceType cannot conceal AI disclosure or adjudication evidence',
  concealedPanel.code === 1 &&
    concealedPanel.json.status === 'FAIL' &&
    codes(concealedPanel).includes('missing_panel_ai_disclosure') &&
    codes(concealedPanel).includes('missing_panel_adjudication'),
  JSON.stringify(concealedPanel.json.violations));

const completePanelRoot = createRoot((root) => {
  writeText(path.join(root, 'docs/dossiers/panel-review/README.md'), 'Adversarial panel evidence.\n');
  const record: any = {
    id: 'complete-panel-case',
    expected: { strengthLevel: 'WEAK' },
    sourceTier: sourceTier({
      tier: 'T3_AUTHORED_INTERPRETATION',
      sourceType: 'ai_panel_adjudicated_interpretation',
      aiGenerated: true,
      authorityTruthEligible: true,
      panelAdjudication: {
        models: [CLAUDE_MODEL, GPT_MODEL],
        scopes: ['saju_doctrine'],
        adversarialVerification: true,
        dossier: 'docs/dossiers/panel-review',
        recordId: 'complete-panel-case',
        contentDigest: '',
      },
      authorityReview: {
        status: 'approved',
        reviewedBy: 'owner@example.test',
        reviewedAt: '2026-07-10',
      },
    }),
  };
  record.sourceTier.panelAdjudication.contentDigest = computePanelRecordDigest(record);
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
          reasoning: 'Adversarial evidence retained for the integration contract.',
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
          reasoning: 'Independent evidence retained for the integration contract.',
        },
      },
    },
  ];
  for (const row of evidence) {
    writeText(
      path.join(root, 'docs/dossiers/panel-review', row.path),
      JSON.stringify(row.document, null, 2),
    );
  }
  writeJson(path.join(root, 'docs/dossiers/panel-review/panel-manifest.json'), {
    schemaVersion: 'spring-ts.panel-adjudication.v1',
    records: [{
      recordId: 'complete-panel-case',
      contentDigest: record.sourceTier.panelAdjudication.contentDigest,
      models: [CLAUDE_MODEL, GPT_MODEL],
      scopes: record.sourceTier.panelAdjudication.scopes,
      adversarialVerification: true,
      verdict: 'approved',
      reviewedBy: 'owner@example.test',
      reviewedAt: '2026-07-10',
      evidence: evidence.map((row) => ({
        model: row.model,
        path: row.path,
        bytes: Buffer.byteLength(JSON.stringify(row.document, null, 2)),
        fileDigest: 'sha256:' + crypto.createHash('sha256')
          .update(JSON.stringify(row.document, null, 2))
          .digest('hex'),
      })),
    }],
  });
  writeJson(path.join(root, 'test/complete-panel.json'), record);
});
const completePanel = runGate(completePanelRoot);
check('fully disclosed panel evidence passes the machine-verifiable provenance contract',
  completePanel.code === 0 &&
    completePanel.json.status === 'PASS',
  JSON.stringify(completePanel.json));

const missingSourceTierRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/missing-source-tier.json'), {
    aiGenerated: true,
    expected: {
      note: 'candidate generated by AI review only',
    },
  });
});
const missingSourceTier = runGate(missingSourceTierRoot);
check('AI-marked records without sourceTier are blocked',
  missingSourceTier.code === 1 &&
    missingSourceTier.json.status === 'FAIL' &&
    codes(missingSourceTier).includes('ai_missing_sourceTier') &&
    markerPaths(missingSourceTier).includes('$.aiGenerated'),
  JSON.stringify(missingSourceTier.json.violations));

const unclearSourceTypeRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/unclear-source-type.json'), {
    aiGenerated: true,
    sourceTier: sourceTier({
      tier: 'T1_HYPOTHESIS',
      sourceType: 'manual_review',
      authorityTruthEligible: false,
    }),
  });
});
const unclearSourceType = runGate(unclearSourceTypeRoot);
check('AI-marked records require AI provenance in sourceType',
  unclearSourceType.code === 1 &&
    unclearSourceType.json.status === 'FAIL' &&
    codes(unclearSourceType).includes('ai_sourceType_not_marked') &&
    markerPaths(unclearSourceType).includes('$.aiGenerated'),
  JSON.stringify(unclearSourceType.json.violations));

const syntheticHighTierRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/synthetic-high-tier.json'), {
    source: {
      kind: 'trainingDerived',
    },
    sourceTier: sourceTier({
      tier: 'T4_PRIMARY_TEXT',
      sourceType: 'classical_primary_text',
      authorityTruthEligible: false,
    }),
  });
});
const syntheticHighTier = runGate(syntheticHighTierRoot);
check('model-generated records cannot use T3+ tiers even when non-authority',
  syntheticHighTier.code === 1 &&
    syntheticHighTier.json.status === 'FAIL' &&
    codes(syntheticHighTier).includes('ai_sourceType_not_marked') &&
    codes(syntheticHighTier).includes('ai_high_tier_source') &&
    markerPaths(syntheticHighTier).includes('$.source.kind'),
  JSON.stringify(syntheticHighTier.json.violations));

const sourceRegistryRoot = createRoot((root) => {
  writeJson(path.join(root, 'data/sources/generated.sources.json'), {
    sources: [{
      id: 'generated_blog',
      sourceTier: sourceTier({
        tier: 'T1_HYPOTHESIS',
        sourceType: 'training_derived',
        authorityTruthEligible: false,
      }),
    }],
  });
});
const sourceRegistry = runGate(sourceRegistryRoot);
check('AI-derived source registry rows are blocked',
    sourceRegistry.code === 1 &&
    sourceRegistry.json.status === 'FAIL' &&
    codes(sourceRegistry).includes('ai_source_registry_entry') &&
    markerPaths(sourceRegistry).includes('$.sourceTier.sourceType'),
  JSON.stringify(sourceRegistry.json.violations));

const lowTierAuthorityRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/low-tier-authority.json'), {
    sourceTier: sourceTier({
      tier: 'T2_REFERENCE_IMPLEMENTATION',
      sourceType: 'reference_implementation',
      humanInterpretation: 'Reference implementation output, not AI.',
      authorityTruthEligible: true,
    }),
  });
});
const lowTierAuthority = runGate(lowTierAuthorityRoot);
check('low-tier authority truth is blocked recursively',
  lowTierAuthority.code === 1 &&
    lowTierAuthority.json.status === 'FAIL' &&
    codes(lowTierAuthority).includes('low_tier_authority_truth') &&
    codes(lowTierAuthority).includes('non_authority_source_type'),
  JSON.stringify(lowTierAuthority.json.violations));

const runtimeDependencyRoot = createRoot((root) => {
  writeJson(path.join(root, 'package.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    dependencies: {
      openai: '^5.0.0',
    },
    devDependencies: {},
  });
  writeJson(path.join(root, 'package-lock.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'tmp-spring-ts',
        version: '0.0.0',
        dependencies: {
          openai: '^5.0.0',
        },
      },
      'node_modules/openai': {
        version: '5.0.0',
        dependencies: {},
      },
    },
  });
});
const runtimeDependency = runGate(runtimeDependencyRoot);
check('runtime LLM dependency is blocked in package files',
  runtimeDependency.code === 1 &&
    runtimeDependency.json.status === 'FAIL' &&
    codes(runtimeDependency).includes('runtime_ai_dependency') &&
    codes(runtimeDependency).includes('runtime_ai_dependency_lock'),
  JSON.stringify(runtimeDependency.json.violations));

const transitiveOptionalDependencyRoot = createRoot((root) => {
  writeJson(path.join(root, 'package.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    dependencies: {
      'normal-runtime': '^1.0.0',
    },
    devDependencies: {},
  });
  writeJson(path.join(root, 'package-lock.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'tmp-spring-ts',
        version: '0.0.0',
        dependencies: {
          'normal-runtime': '^1.0.0',
        },
      },
      'node_modules/normal-runtime': {
        version: '1.0.0',
        optionalDependencies: {
          openai: '^5.0.0',
        },
        peerDependencies: {
          '@anthropic-ai/sdk': '^1.0.0',
        },
      },
      'node_modules/normal-runtime/node_modules/openai': {
        version: '5.0.0',
      },
      'node_modules/normal-runtime/node_modules/@anthropic-ai/sdk': {
        version: '1.0.0',
      },
    },
  });
});
const transitiveOptionalDependency = runGate(transitiveOptionalDependencyRoot);
check('transitive optional and peer LLM dependencies are blocked in package-lock',
  transitiveOptionalDependency.code === 1 &&
    transitiveOptionalDependency.json.status === 'FAIL' &&
    (transitiveOptionalDependency.json.violations ?? []).some((violation: any) =>
      violation.packageName === 'openai' && violation.path === 'node_modules/normal-runtime/node_modules/openai') &&
    (transitiveOptionalDependency.json.violations ?? []).some((violation: any) =>
      violation.packageName === '@anthropic-ai/sdk' &&
        violation.path === 'node_modules/normal-runtime/node_modules/@anthropic-ai/sdk'),
  JSON.stringify(transitiveOptionalDependency.json.violations));

const hoistedTransitiveDependencyRoot = createRoot((root) => {
  writeJson(path.join(root, 'package.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    dependencies: {
      'normal-runtime': '^1.0.0',
    },
    devDependencies: {},
  });
  writeJson(path.join(root, 'package-lock.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'tmp-spring-ts',
        version: '0.0.0',
        dependencies: {
          'normal-runtime': '^1.0.0',
        },
      },
      'node_modules/normal-runtime': {
        version: '1.0.0',
        optionalDependencies: {
          openai: '^5.0.0',
        },
      },
      'node_modules/openai': {
        version: '5.0.0',
      },
    },
  });
});
const hoistedTransitiveDependency = runGate(hoistedTransitiveDependencyRoot);
check('hoisted transitive LLM dependencies are blocked in package-lock',
  hoistedTransitiveDependency.code === 1 &&
    hoistedTransitiveDependency.json.status === 'FAIL' &&
    (hoistedTransitiveDependency.json.violations ?? []).some((violation: any) =>
      violation.packageName === 'openai' && violation.path === 'node_modules/openai'),
  JSON.stringify(hoistedTransitiveDependency.json.violations));

const devDependencyRoot = createRoot((root) => {
  writeJson(path.join(root, 'package.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    dependencies: {},
    devDependencies: {
      openai: '^5.0.0',
    },
  });
  writeJson(path.join(root, 'package-lock.json'), {
    name: 'tmp-spring-ts',
    version: '0.0.0',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'tmp-spring-ts',
        version: '0.0.0',
        dependencies: {},
        devDependencies: {
          openai: '^5.0.0',
        },
      },
      'node_modules/openai': {
        version: '5.0.0',
        dev: true,
      },
    },
  });
});
const devDependency = runGate(devDependencyRoot);
check('devDependency LLM package is allowed when runtime does not import it',
  devDependency.code === 0 &&
    devDependency.json.status === 'PASS',
  JSON.stringify(devDependency.json));

const runtimeImportRoot = createRoot((root) => {
  writeText(path.join(root, 'src/index.ts'), "import OpenAI from 'openai';\nexport const client = OpenAI;\n");
});
const runtimeImport = runGate(runtimeImportRoot);
check('runtime source imports of LLM packages are blocked',
  runtimeImport.code === 1 &&
    runtimeImport.json.status === 'FAIL' &&
    codes(runtimeImport).includes('runtime_ai_import'),
  JSON.stringify(runtimeImport.json.violations));

const sideEffectImportRoot = createRoot((root) => {
  writeText(path.join(root, 'src/index.ts'), "import 'openai';\nexport const ok = true;\n");
});
const sideEffectImport = runGate(sideEffectImportRoot);
check('runtime side-effect imports of LLM packages are blocked',
  sideEffectImport.code === 1 &&
    sideEffectImport.json.status === 'FAIL' &&
    codes(sideEffectImport).includes('runtime_ai_import'),
  JSON.stringify(sideEffectImport.json.violations));

console.log(`\nNo-AI policy gate: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
