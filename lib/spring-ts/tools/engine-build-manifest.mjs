import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ENGINE_BUILD_MANIFEST_SCHEMA_V1 =
  'namespring.engine-build-input-manifest.v1';
export const ENGINE_BUILD_IDENTITY_AUTHORITY_V1 =
  'build-time-artifact-identity-only';

const toolDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(toolDirectory, '../../..');
export const manifestPath = resolve(
  repositoryRoot,
  'lib/spring-ts/manifests/engine-build-input-manifest.v1.json',
);
export const generatedIdentityPath = resolve(
  repositoryRoot,
  'lib/spring-ts/src/engine-build-identity.generated.ts',
);

const GENERATED_IDENTITY_RELATIVE_PATH =
  'lib/spring-ts/src/engine-build-identity.generated.ts';

const BUILD_ONLY_SEED_UTILITIES = new Set([
  'lib/seed-ts/src/utils/decrypt-dict-to-db.ts',
  'lib/seed-ts/src/utils/name-stat-json-to-sharded-db.ts',
  'lib/seed-ts/src/utils/sagyeoksu-json-to-db.ts',
  'lib/seed-ts/src/utils/update-surname-db.ts',
]);

/**
 * This declaration is intentionally a conservative ReportDelivery build-input
 * source set. It is not a claim that every file executes for every request.
 * Conversely, generated narrative packs are excluded because the delivery
 * import boundary forbids that legacy registry from serving ReportDeliveryV1.
 */
export const ENGINE_BUILD_SCOPE_DECLARATIONS_V1 = Object.freeze([
  {
    id: 'spring-runtime-code',
    category: 'code',
    root: 'lib/spring-ts/src',
    include: ['**/*.ts'],
    exclude: [GENERATED_IDENTITY_RELATIVE_PATH],
  },
  {
    id: 'saju-runtime-code',
    category: 'code',
    root: 'lib/saju-ts/src',
    include: ['**/*.ts'],
    exclude: ['**/*.test.ts', '**/*.spec.ts'],
  },
  {
    id: 'seed-runtime-code',
    category: 'code',
    root: 'lib/seed-ts/src',
    include: ['**/*.ts'],
    exclude: [...BUILD_ONLY_SEED_UTILITIES].sort(compareText),
  },
  {
    id: 'runtime-dependency-resolution',
    category: 'code',
    files: [
      'lib/spring-ts/package.json',
      'lib/spring-ts/package-lock.json',
      'lib/spring-ts/tsconfig.json',
      'lib/saju-ts/package.json',
      'lib/saju-ts/package-lock.json',
      'lib/saju-ts/tsconfig.build.json',
      'lib/saju-ts/tsconfig.json',
      'lib/seed-ts/package.json',
      'lib/seed-ts/package-lock.json',
      'lib/seed-ts/tsconfig.build.json',
      'lib/seed-ts/tsconfig.json',
    ],
  },
  {
    id: 'spring-rule-configuration',
    category: 'rules',
    root: 'lib/spring-ts/config',
    include: ['**/*.json'],
    exclude: [],
  },
  {
    id: 'saju-school-rule-packs',
    category: 'rules',
    root: 'lib/saju-ts/src/schools/packs',
    include: ['**/*.json'],
    exclude: [],
  },
  {
    id: 'delivery-article-shards',
    category: 'data',
    root: 'lib/spring-ts/data/articles',
    include: ['**/*.json'],
    exclude: [],
  },
  {
    id: 'delivery-glossary-shards',
    category: 'data',
    root: 'lib/spring-ts/data/narrative/_glossary',
    include: ['**/*.json'],
    exclude: [],
  },
  {
    id: 'spring-runtime-static-data',
    category: 'data',
    files: [
      'lib/spring-ts/data/byeolpyo2_variants.json',
      'lib/spring-ts/data/classical-vocabulary/classical-myeongri-vocabulary.json',
      'lib/spring-ts/data/hangul-name-trends.json',
      'lib/spring-ts/data/inmyeongyong_9389_full.json',
      'lib/spring-ts/data/inmyeongyong_9389_glyphs.generated.json',
      'lib/spring-ts/data/korean-surname-authority.json',
      'lib/spring-ts/data/unihan-hanja-metadata.json',
    ],
  },
  {
    id: 'engine-binary-data',
    category: 'data',
    files: [
      'namespring/public/data/hanja.db',
      'namespring/public/data/fourframe.db',
      'lib/spring-ts/data/name-stat/name-stat-summary.v1.bin',
      'lib/seed-ts/assets/sql-wasm-1.14.1.wasm',
    ],
  },
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function posixPath(value) {
  return value.split(sep).join('/');
}

function relativePath(absolutePath) {
  const candidate = posixPath(relative(repositoryRoot, absolutePath));
  if (candidate === '..' || candidate.startsWith('../')) {
    throw new Error(`Manifest scope escaped the repository: ${absolutePath}`);
  }
  return candidate;
}

function isTestSource(path) {
  return path.endsWith('.test.ts') || path.endsWith('.spec.ts');
}

function recursivelyListFiles(root) {
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`Manifest root must be a real directory: ${relativePath(root)}`);
  }
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name))) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Manifest scope does not permit symlinks: ${relativePath(absolutePath)}`);
      }
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
    }
  };
  visit(root);
  return files;
}

function includedByDeclaration(path, declaration) {
  if (declaration.include?.includes('**/*.ts') && !path.endsWith('.ts')) return false;
  if (declaration.include?.includes('**/*.json') && !path.endsWith('.json')) return false;
  if (declaration.exclude?.includes('**/*.test.ts') && isTestSource(path)) return false;
  return !new Set(declaration.exclude ?? []).has(path);
}

function collectDeclaredFiles() {
  const categoryByPath = new Map();
  for (const declaration of ENGINE_BUILD_SCOPE_DECLARATIONS_V1) {
    const candidates = declaration.files
      ? declaration.files.map((path) => resolve(repositoryRoot, path))
      : recursivelyListFiles(resolve(repositoryRoot, declaration.root));
    for (const absolutePath of candidates) {
      const path = relativePath(absolutePath);
      if (!includedByDeclaration(path, declaration)) continue;
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error(`Manifest input must be a real file: ${path}`);
      }
      const existing = categoryByPath.get(path);
      if (existing) throw new Error(`Manifest input is declared twice: ${path}`);
      categoryByPath.set(path, declaration.category);
    }
  }
  if (categoryByPath.has(GENERATED_IDENTITY_RELATIVE_PATH)) {
    throw new Error('Generated identity constant must stay outside its own digest scope.');
  }
  return [...categoryByPath]
    .sort(([left], [right]) => compareText(left, right));
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function digestRecords(domain, records) {
  const hash = createHash('sha256');
  hash.update(`${domain}\0`, 'utf8');
  for (const record of records) {
    hash.update(`${record.category}\0${record.path}\0${record.byteLength}\0${record.sha256}\n`, 'utf8');
  }
  return `sha256:${hash.digest('hex')}`;
}

function snapshotDeclarations() {
  return ENGINE_BUILD_SCOPE_DECLARATIONS_V1.map((declaration) => ({
    id: declaration.id,
    category: declaration.category,
    ...(declaration.root ? { root: declaration.root } : {}),
    ...(declaration.include ? { include: [...declaration.include] } : {}),
    ...(declaration.files ? { files: [...declaration.files].sort(compareText) } : {}),
    exclude: [...(declaration.exclude ?? [])].sort(compareText),
  }));
}

export function buildEngineBuildManifestV1() {
  const files = collectDeclaredFiles().map(([path, category]) => {
    const bytes = readFileSync(resolve(repositoryRoot, path));
    return Object.freeze({
      path,
      category,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
    });
  });
  const code = files.filter((file) => file.category === 'code');
  const rules = files.filter((file) => file.category === 'rules');
  const data = files.filter((file) => file.category === 'data');
  const codeDigest = digestRecords('namespring.engine-code-inputs.v1', code);
  const ruleDigest = digestRecords('namespring.engine-rule-inputs.v1', rules);
  const rulesetDigest = digestRecords(
    'namespring.engine-ruleset-code-and-rules.v1',
    files.filter((file) => file.category === 'code' || file.category === 'rules'),
  );
  const dataDigest = digestRecords('namespring.engine-data-inputs.v1', data);
  const aggregateDigest = digestRecords('namespring.engine-build-inputs.v1', files);
  return {
    schemaVersion: ENGINE_BUILD_MANIFEST_SCHEMA_V1,
    authority: ENGINE_BUILD_IDENTITY_AUTHORITY_V1,
    completeness: 'declared-tracked-build-input-scope-not-execution-reproducibility',
    canonicalization: 'raw file bytes; POSIX repository-relative paths; code-unit path order; domain-separated NUL/LF SHA-256 records',
    scope: {
      declarations: snapshotDeclarations(),
      exclusions: [
        {
          path: 'lib/spring-ts/data/generated/**',
          reason: 'legacy generated packs are forbidden by the ReportDeliveryV1 import boundary',
        },
        {
          path: 'lib/*/dist/**',
          reason: 'compiler output is not tracked source input and is outside this source-set identity',
        },
        {
          path: 'runtime inputs, clocks, platform, environment, and remote API responses',
          reason: 'artifact identity is not an execution transcript or correctness authority',
        },
      ],
    },
    summary: {
      fileCount: files.length,
      byteLength: files.reduce((sum, file) => sum + file.byteLength, 0),
      codeFileCount: code.length,
      ruleFileCount: rules.length,
      dataFileCount: data.length,
    },
    digests: {
      code: codeDigest,
      rules: ruleDigest,
      ruleset: rulesetDigest,
      data: dataDigest,
      aggregate: aggregateDigest,
    },
    files,
  };
}

export function renderManifestV1(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function renderGeneratedIdentityV1(manifest) {
  const identity = {
    schemaVersion: manifest.schemaVersion,
    authority: manifest.authority,
    completeness: manifest.completeness,
    aggregateDigest: manifest.digests.aggregate,
    rulesetDigest: manifest.digests.ruleset,
    dataDigest: manifest.digests.data,
    manifestFileCount: manifest.summary.fileCount,
  };
  return `/* Generated by tools/engine-build-manifest.mjs. Do not edit. */\n\n`
    + `export const ENGINE_BUILD_IDENTITY_V1 = Object.freeze(${JSON.stringify(identity, null, 2)} as const);\n`;
}

function writeArtifacts(manifest) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, renderManifestV1(manifest), 'utf8');
  writeFileSync(generatedIdentityPath, renderGeneratedIdentityV1(manifest), 'utf8');
}

function checkArtifact(path, expected) {
  let actual;
  try {
    actual = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Missing generated engine manifest artifact: ${relativePath(path)}`);
  }
  if (actual !== expected) {
    throw new Error(
      `Stale engine manifest artifact: ${relativePath(path)}. `
      + 'Run npm run generate:engine-manifest.',
    );
  }
}

export function checkEngineBuildManifestV1(manifest = buildEngineBuildManifestV1()) {
  checkArtifact(manifestPath, renderManifestV1(manifest));
  checkArtifact(generatedIdentityPath, renderGeneratedIdentityV1(manifest));
}

function runCli() {
  const mode = process.argv[2] ?? '--check';
  if (process.argv.length > 3 || (mode !== '--check' && mode !== '--write')) {
    throw new Error('Usage: node tools/engine-build-manifest.mjs [--check|--write]');
  }
  const manifest = buildEngineBuildManifestV1();
  if (mode === '--write') writeArtifacts(manifest);
  else checkEngineBuildManifestV1(manifest);
  process.stdout.write(
    `engine-build-manifest: ${mode === '--write' ? 'wrote' : 'fresh'} `
    + `${manifest.summary.fileCount} files ${manifest.digests.aggregate}\n`,
  );
}

if (process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli();
}
