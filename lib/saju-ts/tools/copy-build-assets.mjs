import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BUILD_ASSETS = Object.freeze([
  'schools/packs/builtin.pack.json',
]);

export async function copyBuildAssets({
  sourceRoot = path.join(PACKAGE_ROOT, 'src'),
  distRoot = path.join(PACKAGE_ROOT, 'dist'),
} = {}) {
  for (const relativePath of BUILD_ASSETS) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(distRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);

    const [sourceBytes, targetBytes] = await Promise.all([
      readFile(sourcePath),
      readFile(targetPath),
    ]);
    if (!sourceBytes.equals(targetBytes)) {
      throw new Error(`Build asset byte mismatch: ${relativePath}`);
    }
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await copyBuildAssets();
  console.log(`Copied ${BUILD_ASSETS.length} saju-ts build asset(s).`);
}
