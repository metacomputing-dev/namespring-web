/**
 * test/integration/classical-source-registry.test.ts
 *
 * Verifies Phase 7.1 public classical source registry shape and usage policy.
 *
 * Run: npm run test:classical-source-registry
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

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

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, relativePath), 'utf-8')) as T;
}

console.log('Phase 7.1 classical source registry\n');

const registry = readJson('data/sources/classical-myeongri.sources.json');
const schema = readJson('test/baseline/schema/classicalSourceRegistry.schema.json');

const requiredIds = ['ditian_sui_chanwei', 'sanming_tonghui', 'yuanhai_ziping'];
const rows = Array.isArray(registry.sources) ? registry.sources : [];
const byId = new Map(rows.map((row: any) => [row.id, row]));
const rowQuoteLimits = rows.map((row: any) => row.usageLimit?.maxQuoteChars);

check('schema file describes the registry version',
  schema.properties?.schemaVersion?.const === 'spring-ts.classical-myeongri-sources.v1');
check('registry uses expected schemaVersion',
  registry.schemaVersion === 'spring-ts.classical-myeongri-sources.v1');
check('registry contains required public source IDs',
  requiredIds.every((id) => byId.has(id)),
  `ids=${rows.map((row: any) => row.id).sort().join(',')}`);
check('registry source IDs are unique',
  byId.size === rows.length,
  `unique=${byId.size}, rows=${rows.length}`);
check('top-level registry is not authority truth by itself',
  registry.sourceTier?.tier === 'T4_PRIMARY_TEXT' &&
    registry.sourceTier?.authorityTruthEligible === false);
check('top-level usage policy forbids bulk copied source text',
  registry.usagePolicy?.noBulkCopy === true &&
    registry.usagePolicy?.prohibited?.includes('bulk OCR text') &&
    registry.usagePolicy?.prohibited?.includes('chapter copy'));
check('top-level max quote limit is 80 chars',
  registry.usagePolicy?.maxQuoteChars === 80);

for (const id of requiredIds) {
  const row = byId.get(id) as any;
  check(`${id} has required bibliographic fields`,
    typeof row?.title === 'string' &&
      typeof row?.titleOriginal === 'string' &&
      typeof row?.dynasty === 'string' &&
      typeof row?.author === 'string' &&
      typeof row?.sourceUrl === 'string' &&
      typeof row?.accessedAt === 'string');
  check(`${id} is a T4 primary-text source row`,
    row?.tier === 'T4_PRIMARY_TEXT' &&
      row?.sourceTier?.tier === row?.tier &&
      row?.sourceTier?.sourceType === 'classical_primary_text_registry');
  check(`${id} has URL-aligned sourceTier`,
    row?.sourceTier?.sourceUrl === row?.sourceUrl &&
      row?.sourceTier?.accessedAt === row?.accessedAt);
  check(`${id} forbids bulk copying`,
    row?.usageLimit?.noBulkCopy === true &&
      row?.usageLimit?.prohibited?.includes('long continuous excerpts'));
  check(`${id} enforces short quote limit`,
    row?.usageLimit?.maxQuoteChars === 80);
}

check('every registered source uses a finite short quote limit',
  rowQuoteLimits.every((limit: any) => Number.isInteger(limit) && limit > 0 && limit <= 80),
  `limits=${rowQuoteLimits.join(',')}`);
check('low-tier source rows cannot be authority truth',
  rows.every((row: any) =>
    !/^T[0-2]_/.test(row.sourceTier?.tier ?? '') ||
      row.sourceTier?.authorityTruthEligible !== true));
check('registry stores no verbatim source text fields',
  JSON.stringify(registry).includes('prose_quote') === false &&
    JSON.stringify(registry).includes('prose_quotes') === false);

console.log(`\nClassical source registry: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
