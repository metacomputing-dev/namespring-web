import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');
const NPM_CLI = process.env.npm_execpath;
const MIGRATION_UTILITY = /(?:decrypt-dict-to-db|name-stat-json-to-sharded-db|sagyeoksu-json-to-db|update-surname-db)/u;

const EXPECTED_RUNTIME_EXPORTS = [
  'DEFAULT_SQL_JS_WASM_SHA256',
  'DEFAULT_SQL_JS_WASM_URL',
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
  'RepositoryConfigurationError',
  'RepositoryDataError',
  'RepositoryIntegrityError',
  'REPOSITORY_DATA_INVALID',
  'SeedCalculationError',
  'SeedEngineError',
  'SeedTs',
  'SeedValidationError',
  'buildHangulPseudoEntry',
  'compileFourFrameContract',
  'decomposeHangulSyllable',
  'hangulElementFromSyllable',
  'hangulStrokeCount',
  'getFourframeMeaningByNumber',
  'normalizeFourFrameNumber',
  'strokeElementFromStrokeCount',
  'toHangulOnlyEntry',
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
  assert.deepEqual(manifest.files, ['dist', 'README.md']);
  assert.equal(manifest.scripts.prebuild, 'npm run clean');
  assert.equal(manifest.scripts.build, 'tsc -p tsconfig.build.json');
  assert.equal(
    manifest.scripts.prepack,
    'npm run check:fourframe-catalog && npm run build',
  );
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

test('npm pack dry-run contains only package metadata, dist, and optional docs', () => {
  const report = JSON.parse(runNpm(['pack', '--dry-run', '--json', '--silent']));
  assert.equal(report.length, 1);
  const files = report[0].files.map((entry) => entry.path).sort();

  assert.ok(files.includes('package.json'));
  assert.ok(files.includes('dist/index.js'));
  assert.ok(files.includes('dist/index.d.ts'));
  assert.equal(files.every((file) =>
    file === 'package.json' ||
    file === 'README.md' ||
    file.startsWith('dist/')), true, files.join('\n'));
  assert.equal(files.some((file) => MIGRATION_UTILITY.test(file)), false, files.join('\n'));
});
