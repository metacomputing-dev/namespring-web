import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

import {
  compileFourFrameContract,
  FOURFRAME_EXPECTED_RECORD_COUNT,
  type FourFrameLuckyLevel,
} from '../src/fourframe-contract.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SOURCE_RELATIVE_PATH = 'namespring/public/data/fourframe.db';
const SOURCE_DB_PATH = path.resolve(REPOSITORY_ROOT, SOURCE_RELATIVE_PATH);
const GENERATED_PATH = path.resolve(
  PACKAGE_ROOT,
  'src',
  'fourframe-catalog.generated.ts',
);
const SQL_WASM_PATH = path.resolve(
  PACKAGE_ROOT,
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm',
);
const SCHEMA_VERSION = 'namespring.fourframe-meaning-catalog/v1';
const CANONICALIZATION =
  'UTF-8 JSON.stringify of rows ordered by number with personality_traits and suitable_career parsed as JSON arrays';
const JSON_CHUNK_SIZE = 6000;

interface GeneratedFourframeEntry {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly detailed_explanation: string;
  readonly positive_aspects: string;
  readonly caution_points: string;
  readonly personality_traits: readonly string[];
  readonly suitable_career: readonly string[];
  readonly life_period_influence: string;
  readonly special_characteristics: string;
  readonly challenge_period: string;
  readonly opportunity_area: string;
  readonly lucky_level: FourFrameLuckyLevel;
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requiredText(
  row: Record<string, unknown>,
  field: string,
  rowIndex: number,
): string {
  const value = row[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`row ${rowIndex} field ${field} must be non-empty text`);
  }
  return value;
}

function requiredInteger(
  row: Record<string, unknown>,
  field: string,
  rowIndex: number,
): number {
  const value = row[field];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`row ${rowIndex} field ${field} must be a positive safe integer`);
  }
  return value;
}

function requiredStringArray(
  row: Record<string, unknown>,
  field: string,
  rowIndex: number,
): string[] {
  const source = requiredText(row, field, rowIndex);
  const parsed = JSON.parse(source) as unknown;
  if (
    !Array.isArray(parsed)
    || parsed.length === 0
    || parsed.some((value) => typeof value !== 'string' || value.trim().length === 0)
  ) {
    throw new Error(`row ${rowIndex} field ${field} must be a non-empty string array`);
  }
  return [...parsed] as string[];
}

async function readCanonicalRows(sourceBytes: Uint8Array): Promise<GeneratedFourframeEntry[]> {
  const SQL = await initSqlJs({ locateFile: () => SQL_WASM_PATH });
  const db = new SQL.Database(sourceBytes);
  const statement = db.prepare('SELECT * FROM sagyeoksu_meanings ORDER BY number');
  const rows: Array<Omit<GeneratedFourframeEntry, 'lucky_level'> & {
    readonly lucky_level: string;
  }> = [];
  try {
    let rowIndex = 0;
    while (statement.step()) {
      const row = statement.getAsObject();
      rows.push({
        id: requiredInteger(row, 'id', rowIndex),
        number: requiredInteger(row, 'number', rowIndex),
        title: requiredText(row, 'title', rowIndex),
        summary: requiredText(row, 'summary', rowIndex),
        detailed_explanation: requiredText(row, 'detailed_explanation', rowIndex),
        positive_aspects: requiredText(row, 'positive_aspects', rowIndex),
        caution_points: requiredText(row, 'caution_points', rowIndex),
        personality_traits: requiredStringArray(row, 'personality_traits', rowIndex),
        suitable_career: requiredStringArray(row, 'suitable_career', rowIndex),
        life_period_influence: requiredText(row, 'life_period_influence', rowIndex),
        special_characteristics: requiredText(row, 'special_characteristics', rowIndex),
        challenge_period: requiredText(row, 'challenge_period', rowIndex),
        opportunity_area: requiredText(row, 'opportunity_area', rowIndex),
        lucky_level: requiredText(row, 'lucky_level', rowIndex),
      });
      rowIndex += 1;
    }
  } finally {
    statement.free();
    db.close();
  }

  const contract = compileFourFrameContract(rows);
  return rows.map((row) => ({
    ...row,
    lucky_level: contract.luckyByNumber.get(row.number) as FourFrameLuckyLevel,
  }));
}

function renderGeneratedModule(
  rows: readonly GeneratedFourframeEntry[],
  sourceDatabaseSha256: string,
): string {
  const canonicalJson = JSON.stringify(rows);
  const contentSha256 = sha256(canonicalJson);
  const snapshotVersion = `fourframe-db-${contentSha256.slice(0, 12)}`;
  const chunks: string[] = [];
  for (let offset = 0; offset < canonicalJson.length; offset += JSON_CHUNK_SIZE) {
    chunks.push(`  ${JSON.stringify(canonicalJson.slice(offset, offset + JSON_CHUNK_SIZE))},`);
  }

  return [
    '/* This file is generated. Run: npm run generate:fourframe-catalog */',
    '',
    'export const GENERATED_FOURFRAME_CATALOG_PROVENANCE = {',
    `  schemaVersion: ${JSON.stringify(SCHEMA_VERSION)},`,
    `  snapshotVersion: ${JSON.stringify(snapshotVersion)},`,
    `  sourcePath: ${JSON.stringify(SOURCE_RELATIVE_PATH)},`,
    `  sourceDatabaseSha256: ${JSON.stringify(sourceDatabaseSha256)},`,
    `  canonicalContentSha256: ${JSON.stringify(contentSha256)},`,
    `  canonicalization: ${JSON.stringify(CANONICALIZATION)},`,
    `  rowCount: ${rows.length},`,
    '} as const;',
    '',
    'export const GENERATED_FOURFRAME_CATALOG_JSON_PARTS = [',
    ...chunks,
    '] as const;',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') {
    throw new Error('Usage: tsx tools/generate-fourframe-catalog.ts --check|--write');
  }

  const sourceBytes = fs.readFileSync(SOURCE_DB_PATH);
  const rows = await readCanonicalRows(sourceBytes);
  if (rows.length !== FOURFRAME_EXPECTED_RECORD_COUNT) {
    throw new Error(
      `Expected ${FOURFRAME_EXPECTED_RECORD_COUNT} rows, received ${rows.length}`,
    );
  }
  const generated = renderGeneratedModule(rows, sha256(sourceBytes));

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
      'Embedded four-frame catalog is stale. Run npm run generate:fourframe-catalog.',
    );
  }
}

await main();
