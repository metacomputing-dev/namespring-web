import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectDatabaseAssetManifest,
  renderDatabaseAssetManifestModule,
} from './database-asset-manifest-core.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const GENERATED_PATH = path.resolve(
  PACKAGE_ROOT,
  'src',
  'database',
  'database-asset-manifest.generated.ts',
);

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    throw new Error(
      'Usage: tsx tools/generate-database-asset-manifest.ts --check|--write',
    );
  }

  const manifest = await collectDatabaseAssetManifest(REPOSITORY_ROOT);
  const generated = renderDatabaseAssetManifestModule(manifest);
  if (mode === '--write') {
    fs.writeFileSync(GENERATED_PATH, generated, 'utf8');
    process.stdout.write(`wrote ${path.relative(PACKAGE_ROOT, GENERATED_PATH)}\n`);
    return;
  }

  const current = fs.existsSync(GENERATED_PATH)
    ? fs.readFileSync(GENERATED_PATH, 'utf8').replaceAll('\r\n', '\n')
    : '';
  if (current !== generated) {
    throw new Error(
      'Database asset manifest is stale. '
      + 'Run npm run generate:database-asset-manifest.',
    );
  }
}

await main();
