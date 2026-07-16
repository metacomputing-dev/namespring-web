import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');

await rm(DIST_ROOT, { recursive: true, force: true });

console.log('Removed saju-ts dist directory.');
