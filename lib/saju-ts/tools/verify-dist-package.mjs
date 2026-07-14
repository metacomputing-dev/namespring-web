import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { BUILD_ASSETS } from './copy-build-assets.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const relativePath of BUILD_ASSETS) {
  const [sourceBytes, targetBytes] = await Promise.all([
    readFile(path.join(PACKAGE_ROOT, 'src', relativePath)),
    readFile(path.join(PACKAGE_ROOT, 'dist', relativePath)),
  ]);
  if (!sourceBytes.equals(targetBytes)) {
    throw new Error(`Packaged build asset differs from source: ${relativePath}`);
  }
}

const distEntryUrl = pathToFileURL(path.join(PACKAGE_ROOT, 'dist', 'index.js'));
distEntryUrl.searchParams.set('verify', `${Date.now()}`);
await import(distEntryUrl.href);

console.log(`Verified dist entry and ${BUILD_ASSETS.length} build asset(s).`);
