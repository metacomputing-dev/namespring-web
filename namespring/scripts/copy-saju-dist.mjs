import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '../../lib/saju-ts/dist');
const targetDir = path.resolve(__dirname, '../public/saju-ts');
const fflateBrowserSource = path.resolve(__dirname, '../node_modules/fflate/esm/browser.js');
const fflateBrowserTarget = path.resolve(targetDir, './vendor/fflate.js');
const analysisZipTarget = path.resolve(targetDir, './artifacts/analysisZip.js');

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

  // Browser ESM cannot resolve bare specifiers in static files under public/.
  // Vendor fflate and rewrite saju-ts artifact import to a relative path.
  await mkdir(path.dirname(fflateBrowserTarget), { recursive: true });
  await cp(fflateBrowserSource, fflateBrowserTarget, { force: true });

  const analysisZipContent = await readFile(analysisZipTarget, 'utf8');
  const rewritten = analysisZipContent.replace(
    /from\s+['"]fflate['"]/g,
    "from '../vendor/fflate.js'",
  );
  await writeFile(analysisZipTarget, rewritten, 'utf8');

  console.log(`[copy-saju-dist] Copied ${sourceDir} -> ${targetDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

