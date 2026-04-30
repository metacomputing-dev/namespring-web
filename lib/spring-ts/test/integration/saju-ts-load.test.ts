/**
 * test/integration/saju-ts-load.test.ts
 *
 * Verifies spring-ts can load saju-ts under Node ESM (PR1 / Phase 0 fix).
 *
 * Without the dual-path loader in `src/saju-adapter.ts`, `import('@saju/index')`
 * would silently fail in Node and the warning was swallowed — leaving
 * `sajuEnabled: false` undetected by `test:golden`.
 *
 * Two stages:
 *   1. saju-ts dist file resolves and exports the expected surface.
 *   2. `analyzeSajuSafe` end-to-end produces `sajuEnabled: true`.
 *
 * Run: npm run test:env  (or: npx tsx test/integration/saju-ts-load.test.ts)
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}`);
  }
}

// ── Stage 1: saju-ts dist surface ─────────────────────────────────────────
console.log('Stage 1: saju-ts dist file + exports');

const sajuTsDistPath = path.resolve(__dirname, '../../../saju-ts/dist/index.js');
check('saju-ts/dist/index.js 존재', fs.existsSync(sajuTsDistPath));

if (fs.existsSync(sajuTsDistPath)) {
  // Windows absolute paths must be file:// URLs for the default ESM loader.
  const sajuModule: any = await import(pathToFileURL(sajuTsDistPath).href);
  check('analyzeSaju is function', typeof sajuModule.analyzeSaju === 'function');
  check('createBirthInput is function', typeof sajuModule.createBirthInput === 'function');
} else {
  console.log('  SKIP saju-ts dist exports (file missing — run "cd lib/saju-ts && npm run build")');
}

// ── Stage 2: spring-ts adapter end-to-end ─────────────────────────────────
console.log('\nStage 2: analyzeSajuSafe end-to-end');

const adapter = await import('../../src/saju-adapter.js');
const result = await adapter.analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});

check('analyzeSajuSafe returned a result', result != null);
check('sajuEnabled === true', result.sajuEnabled === true);
check('summary.dayMaster.element present', !!result.summary?.dayMaster?.element);
check('summary.pillars.year exists', !!result.summary?.pillars?.year);
check('summary.yongshin.element present', !!result.summary?.yongshin?.element);

// ── Result ────────────────────────────────────────────────────────────────
console.log(`\nIntegration check: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.error('\nsaju-ts failed to load under Node ESM.');
  console.error('Check: 1) lib/saju-ts/dist/index.js exists (run "npm run build" there).');
  console.error('       2) src/saju-adapter.ts loadSajuModule has the Node ESM fallback path.');
  process.exit(1);
}
process.exit(0);
