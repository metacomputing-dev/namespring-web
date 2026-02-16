import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '../../lib/saju-ts/dist');
const targetDir = path.resolve(__dirname, '../public/saju-ts');

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const sourceExists = await exists(sourceDir);
  if (!sourceExists) {
    throw new Error(`[copy-saju-dist] Source not found: ${sourceDir}. Build lib/saju-ts first.`);
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`[copy-saju-dist] Copied ${sourceDir} -> ${targetDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

