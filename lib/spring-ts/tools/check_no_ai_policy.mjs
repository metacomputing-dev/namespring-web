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
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  classifyAiProvenance,
  shouldAuditEvidenceDirectory,
  validateSourceTierRecord,
} from './source_tier_policy.mjs';

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

function walkFiles(dir, predicate, shouldVisitDirectory = () => true) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && shouldVisitDirectory(entry.name, fullPath)) {
      files.push(...walkFiles(fullPath, predicate, shouldVisitDirectory));
    }
    else if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files;
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

function canonicalJson(value) {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, item[key]]),
    );
  });
}

function recordDigest(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
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
  const provenance = classifyAiProvenance(value);
  if (provenance.isAiDerived && !hasAnySourceTier) {
    missing.push({
      path: currentPath,
      markers: provenance.reasons.slice(0, 8).map((reason) => ({
        path: reason.startsWith('$') ? currentPath + reason.slice(1) : currentPath,
        marker: 'central_ai_provenance',
      })),
      recordDigest: recordDigest(value),
    });
    return missing;
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
    records.push({
      record: value,
      path: currentPath,
      sourceTier: value.sourceTier,
      sourceTierPath: `${currentPath}.sourceTier`,
    });
  } else if (
    typeof value.authorityTruthEligible === 'boolean' &&
    (
      typeof value.tier === 'string' ||
      typeof value.sourceTier === 'string' ||
      typeof value.sourceType === 'string'
    )
  ) {
    records.push({
      record: value,
      path: currentPath,
      sourceTier: value,
      sourceTierPath: currentPath,
    });
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'sourceTier') continue;
    records.push(...collectSourceTierRecords(item, `${currentPath}.${key}`));
  }
  return records;
}

function sourceTypeMarksAiProvenance(sourceType) {
  return classifyAiProvenance({ sourceType }).isAiDerived;
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
      recordDigest: item.recordDigest,
      message: 'AI-derived records must carry explicit non-authority sourceTier metadata',
    });
  }
  for (const item of sourceTierRecords) {
    const provenance = classifyAiProvenance(item.record);
    const markers = provenance.reasons.slice(0, 8).map((reason) => ({
      path: reason,
      marker: 'central_ai_provenance',
    }));
    const sourceType = item.sourceTier.sourceType;
    const base = {
      file: relPath(root, filePath),
      path: item.path,
      tier: item.sourceTier.tier ?? item.sourceTier.sourceTier,
      sourceType,
      markers: markers.slice(0, 8),
    };

    const policyViolations = validateSourceTierRecord(item.record, {
      sourceTier: item.sourceTier,
      file: base.file,
      sourceTierPath: item.sourceTierPath,
      root,
    });
    for (const policyViolation of policyViolations) {
      violations.push({
        ...base,
        ...policyViolation,
        path: policyViolation.sourceTierPath,
      });
    }

    const aiDerived = provenance.isAiDerived;
    if (!aiDerived) continue;

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

  for (const filePath of fixtureRoots.flatMap((dir) =>
    walkFiles(
      dir,
      (file) => file.endsWith('.json'),
      (name) => shouldAuditEvidenceDirectory(name),
    ))) {
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
