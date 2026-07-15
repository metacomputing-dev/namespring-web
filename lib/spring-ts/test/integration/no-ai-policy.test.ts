/**
 * test/integration/no-ai-policy.test.ts
 *
 * Verifies Phase 9.3 no-AI compliance gate.
 *
 * Run: npm run test:no-ai-policy
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

// Existing generated corpora predate this gate and still lack sourceTier metadata.
// Keep the integration test monotonic while ci:no-ai-policy remains fail-closed.
const ACKNOWLEDGED_MISSING_SOURCE_TIER_COUNT = 23_220;
const ACKNOWLEDGED_MISSING_SOURCE_TIER_FINGERPRINT =
  '1935fff70828a900cb22759219ce8d6e51d7b2288f0592045761f70402f1ee90';
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

function panelAuthority(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return sourceTier({
    tier: 'T3_AUTHORED_INTERPRETATION',
    sourceType: 'ai_panel_adjudicated_interpretation',
    aiGenerated: true,
    authorityTruthEligible: true,
    panelAdjudication: {
      models: ['independent-model-a', 'independent-model-b'],
      adversarialVerification: true,
      dossier: 'docs/panel-dossier.md',
    },
    authorityReview: {
      status: 'approved',
      reviewedBy: 'project-owner',
      reviewedAt: '2026-07-10',
    },
    ...overrides,
  });
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
  return createHash('sha256').update(rows.join('\n')).digest('hex');
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
check('current repository does not exceed acknowledged sourceTier metadata debt',
  currentInputErrors.length === 0 &&
    currentJson.scanned.fixtureFiles > 0 &&
    currentJson.scanned.sourceRegistryFiles > 0 &&
    currentJson.scanned.sourceTierRecords > 0 &&
    currentJson.scanned.packageDependencies > 0 &&
    currentJson.scanned.runtimeSourceFiles > 0 &&
    currentViolations.length === ACKNOWLEDGED_MISSING_SOURCE_TIER_COUNT &&
    currentViolations.every((violation: any) => violation.code === 'ai_missing_sourceTier') &&
    currentDebtFingerprint === ACKNOWLEDGED_MISSING_SOURCE_TIER_FINGERPRINT,
  JSON.stringify({
    ...currentJson.scanned,
    status: currentJson.status,
    acknowledgedMissingSourceTier: currentViolations.length,
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

const authoredInsightRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/ai-authored-insight.json'), {
    aiGenerated: true,
    sourceTier: sourceTier({
      sourceType: 'ai_authored_insight_text',
      authorityTruthEligible: false,
    }),
  });
});
const authoredInsight = runGate(authoredInsightRoot);
check('canonical ai_authored_insight_text provenance remains non-authority and valid',
  authoredInsight.code === 0 && authoredInsight.json.status === 'PASS',
  JSON.stringify(authoredInsight.json));

const validPanelRoot = createRoot((root) => {
  writeText(path.join(root, 'docs/panel-dossier.md'), '# adversarial panel evidence\n');
  writeJson(path.join(root, 'test/panel-authority.json'), {
    sourceTier: panelAuthority(),
  });
});
const validPanel = runGate(validPanelRoot);
check('complete panel authority requires distinct models and an in-root regular dossier file',
  validPanel.code === 0 && validPanel.json.status === 'PASS',
  JSON.stringify(validPanel.json));

const duplicatePanelModelRoot = createRoot((root) => {
  writeText(path.join(root, 'docs/panel-dossier.md'), '# adversarial panel evidence\n');
  writeJson(path.join(root, 'test/panel-authority.json'), {
    sourceTier: panelAuthority({
      panelAdjudication: {
        models: ['Same Model', ' same model '],
        adversarialVerification: true,
        dossier: 'docs/panel-dossier.md',
      },
    }),
  });
});
const duplicatePanelModel = runGate(duplicatePanelModelRoot);
check('duplicate panel model labels do not satisfy independent cross-model review',
  duplicatePanelModel.code === 1 &&
    duplicatePanelModel.json.status === 'FAIL' &&
    codes(duplicatePanelModel).includes('ai_authority_truth_eligible'),
  JSON.stringify(duplicatePanelModel.json.violations));

const escapedDossierRoot = createRoot((root) => {
  writeText(path.resolve(root, '../outside-panel-dossier.md'), '# outside evidence\n');
  writeJson(path.join(root, 'test/panel-authority.json'), {
    sourceTier: panelAuthority({
      panelAdjudication: {
        models: ['independent-model-a', 'independent-model-b'],
        adversarialVerification: true,
        dossier: '../outside-panel-dossier.md',
      },
    }),
  });
});
const escapedDossier = runGate(escapedDossierRoot);
check('panel dossier traversal outside the audited root is blocked even when the target exists',
  escapedDossier.code === 1 &&
    escapedDossier.json.status === 'FAIL' &&
    codes(escapedDossier).includes('ai_authority_truth_eligible'),
  JSON.stringify(escapedDossier.json.violations));

const directoryDossierRoot = createRoot((root) => {
  fs.mkdirSync(path.join(root, 'docs/panel-directory'), { recursive: true });
  writeJson(path.join(root, 'test/panel-authority.json'), {
    sourceTier: panelAuthority({
      panelAdjudication: {
        models: ['independent-model-a', 'independent-model-b'],
        adversarialVerification: true,
        dossier: 'docs/panel-directory',
      },
    }),
  });
});
const directoryDossier = runGate(directoryDossierRoot);
check('a directory cannot masquerade as a panel dossier',
  directoryDossier.code === 1 &&
    directoryDossier.json.status === 'FAIL' &&
    codes(directoryDossier).includes('ai_authority_truth_eligible'),
  JSON.stringify(directoryDossier.json.violations));

const impossibleReviewDateRoot = createRoot((root) => {
  writeText(path.join(root, 'docs/panel-dossier.md'), '# adversarial panel evidence\n');
  writeJson(path.join(root, 'test/panel-authority.json'), {
    sourceTier: panelAuthority({
      authorityReview: {
        status: 'approved',
        reviewedBy: 'project-owner',
        reviewedAt: '2026-02-31',
      },
    }),
  });
});
const impossibleReviewDate = runGate(impossibleReviewDateRoot);
check('an impossible calendar date cannot approve panel authority',
  impossibleReviewDate.code === 1 &&
    impossibleReviewDate.json.status === 'FAIL' &&
    codes(impossibleReviewDate).includes('ai_authority_truth_eligible'),
  JSON.stringify(impossibleReviewDate.json.violations));

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
    expected: {
      note: 'Synthetic model-generated doctrine candidate.',
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
    markerPaths(syntheticHighTier).includes('$.expected.note'),
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
