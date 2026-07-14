#!/usr/bin/env node
/**
 * tools/check_no_ai_policy.mjs
 *
 * Phase 9.3 no-AI compliance gate.
 *
 * Blocks AI-derived data from authority truth and blocks runtime LLM SDK
 * dependencies/imports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const DEFAULT_FIXTURE_ROOTS = [
  'test/baseline/authority',
  'test/baseline/oracles',
  'test/fixtures',
  'data',
];
const DEFAULT_SOURCE_ROOTS = [
  'data/sources',
];
const DEFAULT_RUNTIME_ROOTS = [
  'src',
];

const BOOLEAN_AI_KEYS = new Set([
  'aiGenerated',
  'generatedByAi',
  'generatedByAI',
  'llmGenerated',
  'modelGenerated',
  'machineGenerated',
]);

const AI_MODEL_KEYS = new Set([
  'ai_model',
  'aiModel',
  'llmModel',
  'modelOutput',
  'modelProvider',
  'prompt',
  'promptTemplate',
]);

const AI_STRING_MARKER_KEYS = new Set([
  'kind',
  'provenance',
  'sourceType',
  'status',
  'generator',
  'provider',
]);

const CANONICAL_AI_SOURCE_TYPES = new Set([
  'ai_authored_insight_text',
]);

const AI_SOURCE_PATTERNS = [
  /training[_-]?derived/i,
  /\b(ai|llm|gpt|chatgpt|openai|anthropic|claude|gemini)[_-]?(generated|derived|output|source|extract)?\b/i,
  /\b(prompt|model)[_-]?(generated|derived|output|source|extract)\b/i,
  /\b(generated|derived)[_-]?(by[_-]?)?(ai|llm|model)\b/i,
];

const AI_PROVENANCE_TEXT_PATTERNS = [
  /\bAI-derived\b/i,
  /\btraining-derived\b/i,
  /\bmodel-generated\b/i,
  /\bLLM-generated\b/i,
  /\bnot citation-anchored\b/i,
  /\bsynthetic\b/i,
];

const FORCED_NON_AUTHORITY_SOURCE_TYPES = new Set([
  ...CANONICAL_AI_SOURCE_TYPES,
  'training_derived',
  'reference_implementation',
  'internal_oracle_policy',
  'internal_rule_policy',
  'internal_scoring_policy',
]);

const FORBIDDEN_RUNTIME_PACKAGES = [
  '@ai-sdk',
  '@anthropic-ai/sdk',
  '@aws-sdk/client-bedrock-runtime',
  '@azure/openai',
  '@google/generative-ai',
  '@google-cloud/vertexai',
  '@huggingface/inference',
  '@langchain/core',
  '@langchain/openai',
  '@llamaindex/core',
  '@mistralai/mistralai',
  '@xenova/transformers',
  'ai',
  'cohere-ai',
  'groq-sdk',
  'google-genai',
  'langchain',
  'llamaindex',
  'mistralai',
  'ollama',
  'openai',
  'replicate',
  'together-ai',
  'transformers',
];

function parseArgs(argv) {
  const args = {
    root: SPRING_TS_ROOT,
    fixtureRoots: null,
    sourceRoots: null,
    runtimeRoots: null,
    packageJson: null,
    packageLock: null,
    json: false,
  };

  function pushList(key, value) {
    if (!args[key]) args[key] = [];
    args[key].push(value);
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' && argv[i + 1]) {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--fixture-root' && argv[i + 1]) {
      pushList('fixtureRoots', argv[i + 1]);
      i += 1;
    } else if (arg === '--source-root' && argv[i + 1]) {
      pushList('sourceRoots', argv[i + 1]);
      i += 1;
    } else if (arg === '--runtime-root' && argv[i + 1]) {
      pushList('runtimeRoots', argv[i + 1]);
      i += 1;
    } else if (arg === '--package-json' && argv[i + 1]) {
      args.packageJson = argv[i + 1];
      i += 1;
    } else if (arg === '--package-lock' && argv[i + 1]) {
      args.packageLock = argv[i + 1];
      i += 1;
    } else if (arg === '--json') {
      args.json = true;
    }
  }

  return args;
}

function resolvePath(root, value) {
  if (path.isAbsolute(value)) return value;
  return path.resolve(root, value);
}

function relPath(root, filePath) {
  const relative = path.relative(root, filePath);
  return relative && !relative.startsWith('..') ? relative.replaceAll(path.sep, '/') : filePath.replaceAll(path.sep, '/');
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath, predicate));
    else if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function parseTierRank(sourceTier) {
  const tier = sourceTier?.tier ?? sourceTier?.sourceTier;
  if (typeof tier !== 'string') return null;
  const match = tier.match(/^T([0-5])_[A-Z0-9_]+$/);
  return match ? Number(match[1]) : null;
}

function matchesAiSource(value) {
  if (typeof value !== 'string') return false;
  return CANONICAL_AI_SOURCE_TYPES.has(value)
    || AI_SOURCE_PATTERNS.some((pattern) => pattern.test(value));
}

function collectAiMarkers(value, currentPath = '$') {
  const markers = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      markers.push(...collectAiMarkers(item, `${currentPath}[${index}]`));
    });
    return markers;
  }
  if (!value || typeof value !== 'object') return markers;

  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${currentPath}.${key}`;
    if (BOOLEAN_AI_KEYS.has(key) && item === true) {
      markers.push({ path: itemPath, marker: `${key}=true` });
    }
    if (AI_MODEL_KEYS.has(key) && item !== null && item !== false && item !== '') {
      markers.push({ path: itemPath, marker: key });
    }
    if (AI_STRING_MARKER_KEYS.has(key) && matchesAiSource(item)) {
      markers.push({ path: itemPath, marker: `${key}=${item}` });
    }
    if (typeof item === 'string' && AI_PROVENANCE_TEXT_PATTERNS.some((pattern) => pattern.test(item))) {
      markers.push({ path: itemPath, marker: `${key}=ai_provenance_text` });
    }
    markers.push(...collectAiMarkers(item, itemPath));
  }
  return markers;
}

function collectDirectAiMarkers(value, currentPath = '$') {
  const markers = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return markers;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${currentPath}.${key}`;
    if (BOOLEAN_AI_KEYS.has(key) && item === true) {
      markers.push({ path: itemPath, marker: `${key}=true` });
    }
    if (AI_MODEL_KEYS.has(key) && item !== null && item !== false && item !== '') {
      markers.push({ path: itemPath, marker: key });
    }
    if (AI_STRING_MARKER_KEYS.has(key) && matchesAiSource(item)) {
      markers.push({ path: itemPath, marker: `${key}=${item}` });
    }
    if (typeof item === 'string' && AI_PROVENANCE_TEXT_PATTERNS.some((pattern) => pattern.test(item))) {
      markers.push({ path: itemPath, marker: `${key}=ai_provenance_text` });
    }
  }
  return markers;
}

function hasSourceTierLikeMetadata(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (
        (value.sourceTier && typeof value.sourceTier === 'object' && !Array.isArray(value.sourceTier)) ||
        (
          typeof value.authorityTruthEligible === 'boolean' &&
          (
            typeof value.tier === 'string' ||
            typeof value.sourceTier === 'string' ||
            typeof value.sourceType === 'string'
          )
        )
      ),
  );
}

function collectAiMarkedRecordsWithoutSourceTier(value, currentPath = '$', hasSourceTierAncestor = false) {
  const missing = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      missing.push(...collectAiMarkedRecordsWithoutSourceTier(item, `${currentPath}[${index}]`, hasSourceTierAncestor));
    });
    return missing;
  }
  if (!value || typeof value !== 'object') return missing;

  const hasLocalSourceTier = hasSourceTierLikeMetadata(value);
  const hasAnySourceTier = hasSourceTierAncestor || hasLocalSourceTier;
  const directMarkers = collectDirectAiMarkers(value, currentPath);
  if (directMarkers.length > 0 && !hasAnySourceTier) {
    missing.push({
      path: currentPath,
      markers: directMarkers.slice(0, 8),
    });
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === 'sourceTier') continue;
    missing.push(...collectAiMarkedRecordsWithoutSourceTier(item, `${currentPath}.${key}`, hasAnySourceTier));
  }
  return missing;
}

function collectSourceTierRecords(value, currentPath = '$') {
  const records = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      records.push(...collectSourceTierRecords(item, `${currentPath}[${index}]`));
    });
    return records;
  }
  if (!value || typeof value !== 'object') return records;

  if (value.sourceTier && typeof value.sourceTier === 'object' && !Array.isArray(value.sourceTier)) {
    records.push({ record: value, path: currentPath, sourceTier: value.sourceTier });
  } else if (
    typeof value.authorityTruthEligible === 'boolean' &&
    (
      typeof value.tier === 'string' ||
      typeof value.sourceTier === 'string' ||
      typeof value.sourceType === 'string'
    )
  ) {
    records.push({ record: value, path: currentPath, sourceTier: value });
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'sourceTier') continue;
    records.push(...collectSourceTierRecords(item, `${currentPath}.${key}`));
  }
  return records;
}

function sourceTypeMarksAiProvenance(sourceType) {
  return typeof sourceType === 'string' && matchesAiSource(sourceType);
}

function auditJsonFile(root, filePath, options) {
  const violations = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    return {
      inputErrors: [{
        file: relPath(root, filePath),
        code: 'invalid_json',
        message: err.message,
      }],
      violations,
      scannedRecords: 0,
    };
  }

  const sourceTierRecords = collectSourceTierRecords(data);
  const aiRecordsWithoutSourceTier = collectAiMarkedRecordsWithoutSourceTier(data);
  for (const item of aiRecordsWithoutSourceTier) {
    violations.push({
      file: relPath(root, filePath),
      path: item.path,
      code: 'ai_missing_sourceTier',
      markers: item.markers,
      message: 'AI-derived records must carry explicit non-authority sourceTier metadata',
    });
  }
  for (const item of sourceTierRecords) {
    const rank = parseTierRank(item.sourceTier);
    const markers = collectAiMarkers(item.record);
    const sourceType = item.sourceTier.sourceType;
    const authorityTruthEligible = item.sourceTier.authorityTruthEligible;
    const base = {
      file: relPath(root, filePath),
      path: item.path,
      tier: item.sourceTier.tier ?? item.sourceTier.sourceTier,
      sourceType,
      markers: markers.slice(0, 8),
    };
    if (authorityTruthEligible === true && rank !== null && rank < 3) {
      violations.push({
        ...base,
        code: 'low_tier_authority_truth',
        message: 'T0/T1/T2 records cannot be authority truth',
      });
    }
    if (authorityTruthEligible === true && FORCED_NON_AUTHORITY_SOURCE_TYPES.has(sourceType)) {
      violations.push({
        ...base,
        code: 'non_authority_source_type',
        message: `${sourceType} must not be authority truth`,
      });
    }
    if (markers.length === 0) continue;

    if (options.sourceRegistry) {
      violations.push({
        ...base,
        code: 'ai_source_registry_entry',
        message: 'AI-derived sources cannot be registered as source authority rows',
      });
      continue;
    }
    if (!sourceTypeMarksAiProvenance(sourceType)) {
      violations.push({
        ...base,
        code: 'ai_sourceType_not_marked',
        message: 'AI-derived records must mark sourceTier.sourceType as AI/training/model-derived provenance',
      });
    }
    if (authorityTruthEligible !== false) {
      violations.push({
        ...base,
        code: 'ai_authority_truth_eligible',
        message: 'AI-derived records must have sourceTier.authorityTruthEligible=false',
      });
    }
    if (rank !== null && rank >= 3) {
      violations.push({
        ...base,
        code: 'ai_high_tier_source',
        message: 'AI-derived records must not use T3+ authority tiers',
      });
    }
  }

  return { inputErrors: [], violations, scannedRecords: sourceTierRecords.length };
}

function packageNameMatches(name) {
  return FORBIDDEN_RUNTIME_PACKAGES.some((pkg) => name === pkg || name.startsWith(`${pkg}/`));
}

function packageNodeKey(packageName) {
  return `node_modules/${packageName}`;
}

function packageNameFromNodeKey(nodeKey) {
  const normalized = String(nodeKey).replace(/^node_modules\//, '');
  const parts = normalized.split('/node_modules/');
  return parts[parts.length - 1] ?? '';
}

function findDependencyNodeKey(packages, parentKey, dependencyName) {
  const nestedKey = parentKey ? `${parentKey}/node_modules/${dependencyName}` : packageNodeKey(dependencyName);
  if (packages[nestedKey]) return nestedKey;
  const hoistedKey = packageNodeKey(dependencyName);
  return packages[hoistedKey] ? hoistedKey : nestedKey;
}

function auditPackageJson(root, packageJsonPath) {
  const inputErrors = [];
  const violations = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  } catch (err) {
    return {
      inputErrors: [{
        file: relPath(root, packageJsonPath),
        code: 'invalid_package_json',
        message: err.message,
      }],
      violations,
      scannedDependencies: 0,
    };
  }

  const runtimeSections = ['dependencies', 'optionalDependencies', 'peerDependencies'];
  let scannedDependencies = 0;
  for (const section of runtimeSections) {
    const deps = data[section] ?? {};
    for (const name of Object.keys(deps)) {
      scannedDependencies += 1;
      if (packageNameMatches(name)) {
        violations.push({
          file: relPath(root, packageJsonPath),
          path: section,
          code: 'runtime_ai_dependency',
          packageName: name,
          message: `${name} is an LLM/AI SDK runtime dependency`,
        });
      }
    }
  }

  return { inputErrors, violations, scannedDependencies };
}

function auditPackageLock(root, packageLockPath) {
  if (!fs.existsSync(packageLockPath)) return { inputErrors: [], violations: [], scannedDependencies: 0 };
  const inputErrors = [];
  const violations = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(packageLockPath, 'utf-8'));
  } catch (err) {
    return {
      inputErrors: [{
        file: relPath(root, packageLockPath),
        code: 'invalid_package_lock',
        message: err.message,
      }],
      violations,
      scannedDependencies: 0,
    };
  }

  const packages = data.packages ?? {};
  const rootPackage = packages[''] ?? {};
  const runtimeSections = ['dependencies', 'optionalDependencies', 'peerDependencies'];
  let scannedDependencies = 0;
  const queue = [];
  const seen = new Set();
  for (const section of runtimeSections) {
    const deps = rootPackage[section] ?? {};
    for (const name of Object.keys(deps)) {
      scannedDependencies += 1;
      if (packageNameMatches(name)) {
        violations.push({
          file: relPath(root, packageLockPath),
          path: `packages[""].${section}`,
          code: 'runtime_ai_dependency_lock',
          packageName: name,
          message: `${name} is an LLM/AI SDK runtime dependency in package-lock`,
        });
      }
      queue.push(findDependencyNodeKey(packages, '', name));
    }
  }

  while (queue.length > 0) {
    const nodeKey = queue.shift();
    if (seen.has(nodeKey)) continue;
    seen.add(nodeKey);
    const node = packages[nodeKey];
    if (!node) continue;
    const name = packageNameFromNodeKey(nodeKey);
    if (packageNameMatches(name)) {
      violations.push({
        file: relPath(root, packageLockPath),
        path: nodeKey,
        code: 'runtime_ai_dependency_lock',
        packageName: name,
        message: `${name} is an LLM/AI SDK runtime dependency in package-lock`,
      });
    }
    for (const section of runtimeSections) {
      for (const depName of Object.keys(node[section] ?? {})) {
        scannedDependencies += 1;
        queue.push(findDependencyNodeKey(packages, nodeKey, depName));
      }
    }
  }

  return { inputErrors, violations, scannedDependencies };
}

function extractImportSpecifiers(text) {
  const specifiers = [];
  const importPattern = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"])/g;
  let match;
  while ((match = importPattern.exec(text)) !== null) {
    specifiers.push(match[1] ?? match[2] ?? match[3] ?? match[4]);
  }
  return specifiers;
}

function auditRuntimeImports(root, runtimeRoots) {
  const violations = [];
  const inputErrors = [];
  let scannedFiles = 0;
  const files = runtimeRoots.flatMap((runtimeRoot) =>
    walkFiles(runtimeRoot, (filePath) => /\.(cjs|js|mjs|ts|tsx)$/.test(filePath)));

  for (const filePath of files) {
    scannedFiles += 1;
    let text;
    try {
      text = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      inputErrors.push({
        file: relPath(root, filePath),
        code: 'unreadable_runtime_source',
        message: err.message,
      });
      continue;
    }
    for (const specifier of extractImportSpecifiers(text)) {
      if (packageNameMatches(specifier)) {
        violations.push({
          file: relPath(root, filePath),
          code: 'runtime_ai_import',
          packageName: specifier,
          message: `${specifier} must not be imported from runtime source`,
        });
      }
    }
  }

  return { inputErrors, violations, scannedFiles };
}

function run(args) {
  const root = path.resolve(args.root);
  const fixtureRoots = (args.fixtureRoots ?? DEFAULT_FIXTURE_ROOTS).map((item) => resolvePath(root, item));
  const sourceRoots = (args.sourceRoots ?? DEFAULT_SOURCE_ROOTS).map((item) => resolvePath(root, item));
  const runtimeRoots = (args.runtimeRoots ?? DEFAULT_RUNTIME_ROOTS).map((item) => resolvePath(root, item));
  const packageJsonPath = resolvePath(root, args.packageJson ?? 'package.json');
  const packageLockPath = resolvePath(root, args.packageLock ?? 'package-lock.json');

  const inputErrors = [];
  const violations = [];
  const scanned = {
    fixtureFiles: 0,
    sourceRegistryFiles: 0,
    sourceTierRecords: 0,
    packageDependencies: 0,
    runtimeSourceFiles: 0,
  };

  const seenJsonFiles = new Set();

  for (const filePath of sourceRoots.flatMap((dir) => walkFiles(dir, (file) => file.endsWith('.json')))) {
    const resolved = path.resolve(filePath);
    if (seenJsonFiles.has(resolved)) continue;
    seenJsonFiles.add(resolved);
    scanned.sourceRegistryFiles += 1;
    const result = auditJsonFile(root, filePath, { sourceRegistry: true });
    inputErrors.push(...result.inputErrors);
    violations.push(...result.violations);
    scanned.sourceTierRecords += result.scannedRecords;
  }

  for (const filePath of fixtureRoots.flatMap((dir) => walkFiles(dir, (file) => file.endsWith('.json')))) {
    const resolved = path.resolve(filePath);
    if (seenJsonFiles.has(resolved)) continue;
    seenJsonFiles.add(resolved);
    scanned.fixtureFiles += 1;
    const result = auditJsonFile(root, filePath, { sourceRegistry: false });
    inputErrors.push(...result.inputErrors);
    violations.push(...result.violations);
    scanned.sourceTierRecords += result.scannedRecords;
  }

  const packageJsonResult = auditPackageJson(root, packageJsonPath);
  inputErrors.push(...packageJsonResult.inputErrors);
  violations.push(...packageJsonResult.violations);
  scanned.packageDependencies += packageJsonResult.scannedDependencies;

  const packageLockResult = auditPackageLock(root, packageLockPath);
  inputErrors.push(...packageLockResult.inputErrors);
  violations.push(...packageLockResult.violations);
  scanned.packageDependencies += packageLockResult.scannedDependencies;

  const runtimeResult = auditRuntimeImports(root, runtimeRoots);
  inputErrors.push(...runtimeResult.inputErrors);
  violations.push(...runtimeResult.violations);
  scanned.runtimeSourceFiles += runtimeResult.scannedFiles;

  return {
    status: inputErrors.length > 0 ? 'ERROR' : violations.length > 0 ? 'FAIL' : 'PASS',
    policy: 'spring-ts.no-ai-compliance.v1',
    scanned,
    inputErrors,
    violations,
  };
}

function printText(result) {
  console.log(`No-AI policy: ${result.status}`);
  console.log(`  fixtureFiles=${result.scanned.fixtureFiles}`);
  console.log(`  sourceRegistryFiles=${result.scanned.sourceRegistryFiles}`);
  console.log(`  sourceTierRecords=${result.scanned.sourceTierRecords}`);
  console.log(`  packageDependencies=${result.scanned.packageDependencies}`);
  console.log(`  runtimeSourceFiles=${result.scanned.runtimeSourceFiles}`);
  for (const err of result.inputErrors) {
    console.log(`  ERROR ${err.file}: ${err.message}`);
  }
  for (const violation of result.violations) {
    console.log(`  FAIL ${violation.file}${violation.path ? ` ${violation.path}` : ''}: ${violation.message}`);
  }
}

const args = parseArgs(process.argv);
const result = run(args);
if (args.json) console.log(JSON.stringify(result, null, 2));
else printText(result);
process.exit(result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2);
