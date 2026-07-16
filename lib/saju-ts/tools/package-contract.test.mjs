import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { BUILD_ASSETS, copyBuildAssets } from './copy-build-assets.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');
const STALE_SENTINEL = '__stale-package-contract.txt';
const NPM_CLI = process.env.npm_execpath;

function runNpm(args, cwd) {
  if (!NPM_CLI) {
    throw new Error('Run this contract through npm run test:package-contract.');
  }
  return execFileSync(process.execPath, [NPM_CLI, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
}

function nullTerminatedText(buffer, offset, length) {
  const field = buffer.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return field.subarray(0, end < 0 ? field.length : end).toString('utf8');
}

function tarSize(buffer, offset) {
  const value = nullTerminatedText(buffer, offset, 12).trim();
  if (!/^[0-7]+$/u.test(value)) throw new Error(`Invalid tar size field: ${JSON.stringify(value)}`);
  return Number.parseInt(value, 8);
}

function paxPath(buffer) {
  const text = buffer.toString('utf8');
  let offset = 0;
  let resolvedPath;
  while (offset < text.length) {
    const space = text.indexOf(' ', offset);
    if (space < 0) break;
    const length = Number.parseInt(text.slice(offset, space), 10);
    if (!Number.isSafeInteger(length) || length <= 0) break;
    const record = text.slice(space + 1, offset + length - 1);
    const equals = record.indexOf('=');
    if (equals > 0 && record.slice(0, equals) === 'path') {
      resolvedPath = record.slice(equals + 1);
    }
    offset += length;
  }
  return resolvedPath;
}

function tarEntries(tarballBytes) {
  const archive = gunzipSync(tarballBytes);
  const entries = [];
  let offset = 0;
  let nextPath;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = nullTerminatedText(header, 0, 100);
    const prefix = nullTerminatedText(header, 345, 155);
    const size = tarSize(header, 124);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const data = archive.subarray(dataStart, dataStart + size);
    const headerPath = prefix ? `${prefix}/${name}` : name;

    if (type === 'x') {
      nextPath = paxPath(data) ?? nextPath;
    } else if (type === 'g') {
      // Global PAX metadata does not represent a package file.
    } else if (type === 'L') {
      nextPath = nullTerminatedText(data, 0, data.length);
    } else {
      entries.push({ path: nextPath ?? headerPath, type });
      nextPath = undefined;
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

async function listFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, child));
    else if (entry.isFile()) files.push(child.split(path.sep).join('/'));
    else throw new Error(`Unexpected non-file package entry: ${child}`);
  }
  return files;
}

test('declares the Node floor required by JSON import attributes', async () => {
  const [manifest, lock, readme] = await Promise.all([
    readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8').then(JSON.parse),
    readFile(path.join(PACKAGE_ROOT, 'package-lock.json'), 'utf8').then(JSON.parse),
    readFile(path.join(PACKAGE_ROOT, 'README.md'), 'utf8'),
  ]);
  assert.equal(manifest.engines?.node, '>=20.10.0');
  assert.equal(lock.packages?.['']?.engines?.node, manifest.engines.node);
  assert.match(readme, /Node\.js \*\*>= 20\.10\.0\*\*/u);
});

test('copies declared runtime JSON assets byte-for-byte and fails closed when missing', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saju-build-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourceRoot = path.join(root, 'src');
  const distRoot = path.join(root, 'dist');
  const expected = Buffer.from('{"schemaVersion":1}\n', 'utf8');
  for (const relativePath of BUILD_ASSETS) {
    const sourcePath = path.join(sourceRoot, relativePath);
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, expected);
  }

  await copyBuildAssets({ sourceRoot, distRoot });
  for (const relativePath of BUILD_ASSETS) {
    assert.deepEqual(await readFile(path.join(distRoot, relativePath)), expected);
  }

  await assert.rejects(
    copyBuildAssets({
      sourceRoot: path.join(root, 'missing-src'),
      distRoot: path.join(root, 'missing-dist'),
    }),
    (error) => error?.code === 'ENOENT',
  );
});

test('npm tarball is clean, allowlisted, installable, and retains runtime JSON bytes', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saju-package-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const packDir = path.join(root, 'pack');
  const consumerDir = path.join(root, 'consumer');
  const localFflateDir = path.join(root, 'fflate');
  await Promise.all([
    mkdir(packDir, { recursive: true }),
    mkdir(consumerDir, { recursive: true }),
    mkdir(DIST_ROOT, { recursive: true }),
  ]);

  const stalePath = path.join(DIST_ROOT, STALE_SENTINEL);
  await writeFile(stalePath, 'must be removed by prepack\n', 'utf8');
  t.after(() => rm(stalePath, { force: true }));

  const packStarted = performance.now();
  runNpm(['pack', '--pack-destination', packDir], PACKAGE_ROOT);
  console.log(`[package-contract] npm pack: ${(performance.now() - packStarted).toFixed(1)} ms`);
  const tarballs = (await readdir(packDir)).filter((file) => file.endsWith('.tgz'));
  assert.equal(tarballs.length, 1, 'npm pack must create exactly one tarball');
  await assert.rejects(readFile(stalePath), (error) => error?.code === 'ENOENT');

  const tarballPath = path.join(packDir, tarballs[0]);
  const tarParseStarted = performance.now();
  const archiveEntries = tarEntries(await readFile(tarballPath));
  const archiveFiles = archiveEntries
    .filter((entry) => entry.type !== '5')
    .map((entry) => {
      assert.equal(entry.type, '0', `tar entry must be a regular file: ${entry.path}`);
      return entry.path;
    })
    .sort();
  const distFiles = await listFiles(DIST_ROOT);
  const expectedArchiveFiles = [
    'package/LICENSE',
    'package/README.md',
    'package/package.json',
    ...distFiles.map((file) => `package/dist/${file}`),
  ].sort();
  assert.deepEqual(archiveFiles, expectedArchiveFiles, 'tarball files must equal the package allowlist');
  assert.ok(!archiveFiles.includes(`package/dist/${STALE_SENTINEL}`));
  console.log(`[package-contract] tar parse/allowlist: ${(performance.now() - tarParseStarted).toFixed(1)} ms`);

  await cp(path.join(PACKAGE_ROOT, 'node_modules', 'fflate'), localFflateDir, { recursive: true });
  await writeFile(path.join(consumerDir, 'package.json'), `${JSON.stringify({
    name: 'saju-package-contract-consumer',
    private: true,
    type: 'module',
    dependencies: {
      fflate: 'file:../fflate',
      'saju-math-engine': `file:../pack/${tarballs[0]}`,
    },
  }, null, 2)}\n`, 'utf8');
  const installStarted = performance.now();
  runNpm([
    'install',
    '--ignore-scripts',
    '--offline',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
  ], consumerDir);
  console.log(`[package-contract] consumer npm install: ${(performance.now() - installStarted).toFixed(1)} ms`);

  const installedRoot = path.join(consumerDir, 'node_modules', 'saju-math-engine');
  assert.equal((await lstat(installedRoot)).isSymbolicLink(), false, 'saju package must be extracted from the tarball');
  const importStarted = performance.now();
  execFileSync(process.execPath, [
    '--input-type=module',
    '--eval',
    "const api = await import('saju-math-engine'); if (typeof api.createEngine !== 'function' || api.listSchoolPresets().length === 0) process.exit(2);",
  ], {
    cwd: consumerDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
  console.log(`[package-contract] bare import: ${(performance.now() - importStarted).toFixed(1)} ms`);

  for (const relativePath of BUILD_ASSETS) {
    const [sourceBytes, installedBytes] = await Promise.all([
      readFile(path.join(PACKAGE_ROOT, 'src', relativePath)),
      readFile(path.join(installedRoot, 'dist', relativePath)),
    ]);
    assert.deepEqual(installedBytes, sourceBytes, `installed asset differs: ${relativePath}`);
  }
  await assert.rejects(
    readFile(path.join(installedRoot, 'dist', STALE_SENTINEL)),
    (error) => error?.code === 'ENOENT',
  );
});
