import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');
const NPM_CLI = process.env.npm_execpath;
const MIGRATION_UTILITY = /(?:decrypt-dict-to-db|name-stat-json-to-sharded-db|sagyeoksu-json-to-db|update-surname-db)/u;
const SQL_JS_WASM_ASSET = 'assets/sql-wasm-1.14.1.wasm';
const SQL_JS_LICENSE_ASSET = 'assets/sql.js-LICENSE.txt';

const EXPECTED_RUNTIME_EXPORTS = [
  'DEFAULT_SQL_JS_WASM_SHA256',
  'DEFAULT_SQL_JS_WASM_URL',
  'DEFAULT_SQL_JS_VERSION',
  'DEFAULT_SQL_JS_WASM_BYTE_LENGTH',
  'Element',
  'Energy',
  'EnergyCalculator',
  'FOURFRAME_CATALOG_PROVENANCE',
  'FOURFRAME_CONTRACT_INVALID',
  'FOURFRAME_EXPECTED_RECORD_COUNT',
  'FOURFRAME_LUCKY_LEVELS',
  'FOURFRAME_MAX_NUMBER',
  'FOURFRAME_MEANING_CATALOG',
  'FOURFRAME_MIN_NUMBER',
  'FourFrameCalculator',
  'FourFrameContractError',
  'FourframeRepository',
  'HangulCalculator',
  'HanjaCalculator',
  'HanjaRepository',
  'NameStatRepository',
  'Polarity',
  'REPOSITORY_DATABASE_INTEGRITY_MISMATCH',
  'REPOSITORY_QUERY_INVALID',
  'RepositoryConfigurationError',
  'RepositoryDatabaseIntegrityError',
  'RepositoryDataError',
  'RepositoryIntegrityError',
  'RepositoryQueryValidationError',
  'SEED_SCORING_POLICY',
  'REPOSITORY_DATA_INVALID',
  'SeedCalculationError',
  'SeedEngineError',
  'SeedTs',
  'SeedValidationError',
  'ServiceTextPolicyError',
  'assertServiceTextPolicy',
  'auditServiceTextPolicy',
  'buildHangulPseudoEntry',
  'compileFourFrameContract',
  'decomposeHangulSyllable',
  'hangulElementFromSyllable',
  'hangulStrokeCount',
  'getFourframeMeaningByNumber',
  'normalizeFourFrameNumber',
  'strokeElementFromStrokeCount',
  'toHangulOnlyEntry',
  'verifyOpenedRepositoryDatabase',
  'verifyRepositoryDatabaseBytesBeforeOpen',
].sort();

function runNpm(args) {
  if (!NPM_CLI) {
    throw new Error('Run this contract through npm run test:package-contract.');
  }
  return execFileSync(process.execPath, [NPM_CLI, ...args], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function walkFiles(directory, base = directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkFiles(absolute, base);
      return [path.relative(base, absolute).replaceAll(path.sep, '/')];
    })
    .sort();
}

before(() => {
  runNpm(['run', 'build']);
});

test('manifest exposes one ESM package entry and a clean prepack build', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.main, './dist/index.js');
  assert.equal(manifest.types, './dist/index.d.ts');
  assert.deepEqual(manifest.exports, {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js',
    },
  });
  assert.deepEqual(manifest.files, ['dist', 'assets', 'README.md']);
  assert.equal(manifest.scripts.prebuild, 'npm run clean');
  assert.equal(manifest.scripts.build, 'tsc -p tsconfig.build.json');
  assert.equal(
    manifest.scripts.prepack,
    'npm run check:database-asset-manifest && npm run check:fourframe-catalog && npm run test:sql-js-wasm-asset && npm run build',
  );
  assert.equal(manifest.dependencies['sql.js'], '1.14.1');
  assert.equal(manifest.dependencies.sqlite3, undefined);
  assert.equal(typeof manifest.devDependencies.sqlite3, 'string');
});

test('build emits a Node-importable ESM root with declarations', async () => {
  assert.equal(fs.existsSync(path.join(DIST_ROOT, 'index.js')), true);
  assert.equal(fs.existsSync(path.join(DIST_ROOT, 'index.d.ts')), true);

  const entry = await import(`${pathToFileURL(path.join(DIST_ROOT, 'index.js')).href}?contract=1`);
  assert.deepEqual(Object.keys(entry).sort(), EXPECTED_RUNTIME_EXPORTS);
});

test('dist contains runtime graph only and excludes executable DB migrations', () => {
  const files = walkFiles(DIST_ROOT);
  assert.ok(files.length > 2);
  assert.equal(files.some((file) => MIGRATION_UTILITY.test(file)), false, files.join('\n'));
  assert.equal(files.some((file) => file.endsWith('.ts') && !file.endsWith('.d.ts')), false);
  assert.equal(files.every((file) => file.endsWith('.js') || file.endsWith('.d.ts')), true);
});

test('npm pack dry-run contains only package metadata, runtime, and the pinned WASM', () => {
  const report = JSON.parse(
    runNpm(['pack', '--dry-run', '--json', '--silent', '--ignore-scripts']),
  );
  assert.equal(report.length, 1);
  const files = report[0].files.map((entry) => entry.path).sort();

  assert.ok(files.includes('package.json'));
  assert.ok(files.includes('dist/index.js'));
  assert.ok(files.includes('dist/index.d.ts'));
  assert.deepEqual(files.filter((file) => file.endsWith('.wasm')), [SQL_JS_WASM_ASSET]);
  assert.deepEqual(
    files.filter((file) => file.startsWith('assets/')),
    [SQL_JS_WASM_ASSET, SQL_JS_LICENSE_ASSET].sort(),
  );
  const wasmEntry = report[0].files.find((entry) => entry.path === SQL_JS_WASM_ASSET);
  assert.equal(wasmEntry?.size, 659_730);
  const licenseEntry = report[0].files.find((entry) => entry.path === SQL_JS_LICENSE_ASSET);
  assert.equal(licenseEntry?.size, 2_199);
  assert.equal(files.every((file) =>
    file === 'package.json' ||
    file === 'README.md' ||
    file === SQL_JS_WASM_ASSET ||
    file === SQL_JS_LICENSE_ASSET ||
    file.startsWith('dist/')), true, files.join('\n'));
  assert.equal(files.some((file) => MIGRATION_UTILITY.test(file)), false, files.join('\n'));
});

test('actual packed package initializes its bundled WASM without a transport mock', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-ts-package-contract-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const packDestination = path.join(temporaryRoot, 'pack');
  const extractDestination = path.join(temporaryRoot, 'extract');
  fs.mkdirSync(packDestination, { recursive: true });
  fs.mkdirSync(extractDestination, { recursive: true });

  const packReport = JSON.parse(runNpm([
    'pack',
    '--json',
    '--silent',
    '--ignore-scripts',
    '--pack-destination',
    packDestination,
  ]));
  assert.equal(packReport.length, 1);
  const tarballPath = path.join(packDestination, packReport[0].filename);
  assert.equal(fs.existsSync(tarballPath), true);

  execFileSync('tar', ['-xf', tarballPath, '-C', extractDestination], {
    cwd: temporaryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const extractedPackageRoot = path.join(extractDestination, 'package');
  const extractedSqlJsRoot = path.join(extractedPackageRoot, 'node_modules', 'sql.js');
  const sourceSqlJsRoot = path.join(PACKAGE_ROOT, 'node_modules', 'sql.js');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(extractedPackageRoot, 'package.json'), 'utf8'),
  );
  const installedSqlJsManifest = JSON.parse(
    fs.readFileSync(path.join(sourceSqlJsRoot, 'package.json'), 'utf8'),
  );
  assert.equal(installedSqlJsManifest.version, manifest.dependencies['sql.js']);
  fs.mkdirSync(path.dirname(extractedSqlJsRoot), { recursive: true });
  fs.cpSync(sourceSqlJsRoot, extractedSqlJsRoot, { recursive: true });

  const runtimeModulePath = path.join(
    extractedPackageRoot,
    'dist',
    'database',
    'repository-runtime.js',
  );
  const runtimeModule = await import(pathToFileURL(runtimeModulePath).href);
  const expectedWasmPath = path.join(extractedPackageRoot, SQL_JS_WASM_ASSET);
  assert.equal(
    path.resolve(fileURLToPath(runtimeModule.DEFAULT_SQL_JS_WASM_URL)),
    path.resolve(expectedWasmPath),
  );
  assert.equal(fs.existsSync(expectedWasmPath), true);

  const runtime = runtimeModule.createRepositoryRuntime();
  const SQL = await runtime.initializeSqlJs(
    runtimeModule.DEFAULT_SQL_JS_WASM_URL,
    runtimeModule.DEFAULT_SQL_JS_WASM_SHA256,
  );
  const database = new SQL.Database();
  try {
    database.run('CREATE TABLE package_smoke (value INTEGER NOT NULL)');
    database.run('INSERT INTO package_smoke VALUES (7)');
    assert.deepEqual(database.exec('SELECT value FROM package_smoke'), [{
      columns: ['value'],
      values: [[7]],
    }]);
  } finally {
    database.close();
  }
});
