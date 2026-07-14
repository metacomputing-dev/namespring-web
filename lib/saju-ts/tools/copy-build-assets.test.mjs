import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { BUILD_ASSETS, copyBuildAssets } from './copy-build-assets.mjs';

test('copies every runtime JSON asset byte-for-byte into dist', async (t) => {
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
});

test('fails closed when a declared runtime asset is missing', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'saju-build-assets-missing-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    copyBuildAssets({
      sourceRoot: path.join(root, 'src'),
      distRoot: path.join(root, 'dist'),
    }),
    (error) => error?.code === 'ENOENT',
  );
});
