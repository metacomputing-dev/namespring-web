/**
 * test/integration/no-ai-policy.test.ts
 *
 * Verifies Phase 9.3 no-AI compliance gate.
 *
 * Run: npm run test:no-ai-policy
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

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
    humanInterpretation: 'AI-derived synthetic fixture retained for regression observation only.',
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

console.log('Phase 9.3 no-AI policy gate\n');

const currentRepo = execFileSync(process.execPath, ['tools/check_no_ai_policy.mjs', '--json'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const currentJson = JSON.parse(currentRepo);
check('current repository passes no-AI policy gate',
  currentJson.status === 'PASS' &&
    currentJson.scanned.fixtureFiles > 0 &&
    currentJson.scanned.sourceTierRecords > 0,
  JSON.stringify(currentJson.scanned));

const allowedTrainingRoot = createRoot((root) => {
  writeJson(path.join(root, 'test/training.json'), {
    source: {
      kind: 'training_derived',
      ai_model: 'review-lab-model',
    },
    expected: {
      note: 'AI-derived, not citation-anchored.',
    },
    sourceTier: sourceTier({}),
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
    codes(aiAuthority).includes('ai_authority_truth_eligible') &&
    codes(aiAuthority).includes('ai_high_tier_source'),
  JSON.stringify(aiAuthority.json.violations));

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
    codes(syntheticHighTier).includes('ai_high_tier_source'),
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
    codes(sourceRegistry).includes('ai_source_registry_entry'),
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

console.log(`\nNo-AI policy gate: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
