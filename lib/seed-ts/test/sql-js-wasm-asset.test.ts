import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SQL_JS_VERSION,
  DEFAULT_SQL_JS_WASM_BYTE_LENGTH,
  DEFAULT_SQL_JS_WASM_SHA256,
  DEFAULT_SQL_JS_WASM_URL,
} from '../src/database/repository-runtime.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const EXPECTED_VERSION = '1.14.1';
const EXPECTED_BYTE_LENGTH = 659_730;
const EXPECTED_SHA256 =
  '438c88f666dc054ce4e9395f80fe9db4218b1a3c379960454880f048a7898aed';
const ASSET_PATH = path.join(PACKAGE_ROOT, 'assets', 'sql-wasm-1.14.1.wasm');
const LICENSE_PATH = path.join(PACKAGE_ROOT, 'assets', 'sql.js-LICENSE.txt');
const EXPECTED_LICENSE_SHA256 =
  '60a3f6e4d7b29b4321359e683b36cf198d24f58e24582070f56e6fa89d5ee2be';

function readJson(filePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
}

test('bundled sql.js WASM has the independently pinned byte contract', () => {
  assert.equal(DEFAULT_SQL_JS_VERSION, EXPECTED_VERSION);
  assert.equal(DEFAULT_SQL_JS_WASM_BYTE_LENGTH, EXPECTED_BYTE_LENGTH);
  assert.equal(DEFAULT_SQL_JS_WASM_SHA256, EXPECTED_SHA256);
  assert.doesNotMatch(DEFAULT_SQL_JS_WASM_URL, /^https?:/iu);
  assert.doesNotMatch(DEFAULT_SQL_JS_WASM_URL, /cdn/iu);
  assert.equal(path.resolve(fileURLToPath(DEFAULT_SQL_JS_WASM_URL)), ASSET_PATH);

  const bytes = fs.readFileSync(ASSET_PATH);
  assert.equal(bytes.byteLength, EXPECTED_BYTE_LENGTH);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_SHA256);
});

test('bundled sql.js assets contain exactly the binary and its MIT notice', () => {
  assert.deepEqual(
    fs.readdirSync(path.join(PACKAGE_ROOT, 'assets')).sort(),
    ['sql-wasm-1.14.1.wasm', 'sql.js-LICENSE.txt'],
  );
  const license = fs.readFileSync(LICENSE_PATH);
  assert.equal(license.byteLength, 2_199);
  assert.equal(
    createHash('sha256').update(license).digest('hex'),
    EXPECTED_LICENSE_SHA256,
  );
  assert.match(license.toString('utf8'), /^MIT license/mu);
  assert.match(license.toString('utf8'), /Copyright \(c\) 2017 sql\.js authors/u);
});

test('Seed, Spring, browser lock, and bundled bytes use one sql.js release', () => {
  const seedManifest = readJson(path.join(PACKAGE_ROOT, 'package.json'));
  const seedLock = readJson(path.join(PACKAGE_ROOT, 'package-lock.json'));
  const springManifest = readJson(path.join(REPOSITORY_ROOT, 'lib', 'spring-ts', 'package.json'));
  const springLock = readJson(path.join(REPOSITORY_ROOT, 'lib', 'spring-ts', 'package-lock.json'));
  const browserLock = readJson(path.join(REPOSITORY_ROOT, 'namespring', 'package-lock.json'));
  const installedManifest = readJson(
    path.join(PACKAGE_ROOT, 'node_modules', 'sql.js', 'package.json'),
  );
  const installedWasm = fs.readFileSync(
    path.join(PACKAGE_ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  );

  assert.equal(seedManifest.dependencies['sql.js'], EXPECTED_VERSION);
  assert.equal(seedLock.packages['node_modules/sql.js'].version, EXPECTED_VERSION);
  assert.equal(springManifest.dependencies['sql.js'], EXPECTED_VERSION);
  assert.equal(springLock.packages['node_modules/sql.js'].version, EXPECTED_VERSION);
  assert.equal(browserLock.packages['node_modules/sql.js'].version, EXPECTED_VERSION);
  assert.equal(installedManifest.version, EXPECTED_VERSION);
  assert.deepEqual(installedWasm, fs.readFileSync(ASSET_PATH));
});
