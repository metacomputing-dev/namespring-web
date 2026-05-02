/**
 * test/integration/tiered-selector-contract.test.ts
 *
 * Keeps the authoring contract's fallback chain aligned with the runtime
 * selector. This prevents future narrative data from authoring against a
 * dimension that the selector never considers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_DIMENSIONS } from '../../src/report/tiered/fragment-selector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const CONTRACT_PATH = path.resolve(SPRING_TS_ROOT, 'data/narrative/_contract/v1.json');

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

console.log('Tiered selector contract\n');

const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf-8'));
const contractPriority = contract?.fallbackChain?.priority ?? [];
const whitelist = new Set(contract?.gatingFieldWhitelist ?? []);
const runtimePriority = [...FALLBACK_DIMENSIONS];

check('contract fallbackChain priority matches runtime selector',
  JSON.stringify(contractPriority) === JSON.stringify(runtimePriority),
  `${contractPriority.join(',')} :: ${runtimePriority.join(',')}`);
check('every runtime fallback dimension is authorable gating',
  runtimePriority.every((dim) => whitelist.has(dim)),
  runtimePriority.filter((dim) => !whitelist.has(dim)).join(','));
check('contract does not list non-gating tone in fallback priority',
  !contractPriority.includes('tone'));

console.log(`\nTiered selector contract: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
