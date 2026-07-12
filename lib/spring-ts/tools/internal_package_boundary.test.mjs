import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('spring-ts stays an internal source module until a real package contract exists', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.files, ['dist', 'README.md']);
  for (const misleadingPublishField of ['main', 'types', 'exports', 'publishConfig']) {
    assert.equal(
      Object.hasOwn(manifest, misleadingPublishField),
      false,
      `${misleadingPublishField} must not advertise the current non-importable tsc output`,
    );
  }

  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /private internal source module/);
  assert.match(readme, /Vite alias/);
  assert.match(readme, /not an/);
  assert.match(readme, /npm registry package/);
});

test('spring-ts and the browser-resolved Seed graph share one exact sql.js ABI', () => {
  const repositoryRoot = path.resolve(ROOT, '..', '..');
  const springManifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
  );
  const springLock = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'),
  );
  const seedManifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'lib', 'seed-ts', 'package.json'), 'utf8'),
  );
  const browserLock = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'namespring', 'package-lock.json'), 'utf8'),
  );

  assert.equal(springManifest.dependencies['sql.js'], '1.14.1');
  assert.equal(springLock.packages['node_modules/sql.js'].version, '1.14.1');
  assert.equal(seedManifest.dependencies['sql.js'], '1.14.1');
  assert.equal(browserLock.packages['node_modules/sql.js'].version, '1.14.1');
});
