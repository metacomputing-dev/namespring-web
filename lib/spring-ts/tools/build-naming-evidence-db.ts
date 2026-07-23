import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const DEFAULT_SOURCE_PATH = path.join(
  PACKAGE_ROOT,
  'data/naming-report/evidence/generation/runs/full-v3/naming-evidence.generated-draft.json',
);
const DATABASE_PATH = path.join(REPOSITORY_ROOT, 'namespring/public/data/naming-evidence.db');
const MANIFEST_PATH = path.join(PACKAGE_ROOT, 'src/report/naming-evidence/database-manifest.generated.ts');
const SOURCE_SCHEMA_VERSION = 'namespring.naming-evidence-generated-draft/v2';
const DATABASE_SCHEMA_VERSION = 'namespring.naming-evidence-db/v2';
const DATABASE_ASSET_SCHEMA_VERSION = 'namespring.naming-evidence-db-asset/v2';
const DATABASE_USER_VERSION = 2;

interface AxisRow {
  readonly dayMasterElement: string;
  readonly strength: string;
  readonly yongshinElement: string;
  readonly gyeokgukFamily: string;
  readonly plain: string;
  readonly detail: string;
}

interface SourceRow {
  readonly sourceId: string;
  readonly state: string;
  readonly weight: string;
  readonly plain: string;
  readonly detail: string;
}

interface ConclusionRow {
  readonly tone: string;
  readonly plain: string;
  readonly detail: string;
}

interface GeneratedDraft {
  readonly schemaVersion: string;
  readonly contentVersion: string;
  readonly scope: string;
  readonly sajuAxisExplanations: readonly AxisRow[];
  readonly sourceEvidenceExplanations: readonly SourceRow[];
  readonly conclusionExplanations: readonly ConclusionRow[];
}

function option(name: string): string | undefined {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sourcePath(): string {
  return path.resolve(PACKAGE_ROOT, option('--source') ?? DEFAULT_SOURCE_PATH);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be non-empty text`);
  return value.trim();
}

function axisKey(row: AxisRow): string {
  return `saju-axis/${row.dayMasterElement}/${row.strength}/${row.yongshinElement}/${row.gyeokgukFamily}`;
}

function loadSource(file: string): GeneratedDraft {
  const source = JSON.parse(fs.readFileSync(file, 'utf8')) as GeneratedDraft;
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION) throw new Error(`Expected ${SOURCE_SCHEMA_VERSION}`);
  if (source.scope !== 'full') throw new Error('Only a complete full-scope draft can build the production database');
  if (source.sajuAxisExplanations.length !== 450) throw new Error('Expected 450 saju-axis explanations');
  if (source.sourceEvidenceExplanations.length !== 18) throw new Error('Expected 18 source-evidence explanations');
  if (source.conclusionExplanations.length !== 5) throw new Error('Expected 5 conclusion explanations');
  requiredText(source.contentVersion, 'contentVersion');
  const keys = [
    ...source.sajuAxisExplanations.map(axisKey),
    ...source.sourceEvidenceExplanations.map((row) => `source/${row.sourceId}/${row.state}`),
    ...source.conclusionExplanations.map((row) => `conclusion/sajuFit/${row.tone}`),
  ];
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate evidence fragment key');
  for (const [index, row] of [
    ...source.sajuAxisExplanations,
    ...source.sourceEvidenceExplanations,
    ...source.conclusionExplanations,
  ].entries()) {
    requiredText(row.plain, `rows[${index}].plain`);
    requiredText(row.detail, `rows[${index}].detail`);
  }
  return source;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = ${DATABASE_USER_VERSION};
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE saju_axis_explanations (
      fragment_key TEXT PRIMARY KEY,
      day_master_element TEXT NOT NULL,
      strength TEXT NOT NULL,
      yongshin_element TEXT NOT NULL,
      gyeokguk_family TEXT NOT NULL,
      plain TEXT NOT NULL,
      detail TEXT NOT NULL,
      UNIQUE (day_master_element, strength, yongshin_element, gyeokguk_family)
    ) WITHOUT ROWID;
    CREATE TABLE source_evidence_explanations (
      fragment_key TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      state TEXT NOT NULL,
      weight REAL NOT NULL,
      plain TEXT NOT NULL,
      detail TEXT NOT NULL,
      UNIQUE (source_id, state)
    ) WITHOUT ROWID;
    CREATE TABLE conclusion_explanations (
      fragment_key TEXT PRIMARY KEY,
      tone TEXT NOT NULL UNIQUE,
      plain TEXT NOT NULL,
      detail TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE evidence_connectors (
      relation TEXT NOT NULL,
      variant INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (relation, variant)
    ) WITHOUT ROWID;
    CREATE INDEX idx_saju_axis_lookup ON saju_axis_explanations (
      day_master_element, strength, yongshin_element, gyeokguk_family
    );
    CREATE INDEX idx_source_evidence_lookup ON source_evidence_explanations (source_id, state);
  `);
}

function populate(db: Database.Database, source: GeneratedDraft): void {
  const metadata = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
  const axis = db.prepare(`INSERT INTO saju_axis_explanations VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const evidence = db.prepare(`INSERT INTO source_evidence_explanations VALUES (?, ?, ?, ?, ?, ?)`);
  const conclusion = db.prepare(`INSERT INTO conclusion_explanations VALUES (?, ?, ?, ?)`);
  db.transaction(() => {
    metadata.run('schemaVersion', DATABASE_SCHEMA_VERSION);
    metadata.run('sourceSchemaVersion', source.schemaVersion);
    metadata.run('contentVersion', source.contentVersion);
    metadata.run('contentStatus', 'generated-draft');
    for (const row of source.sajuAxisExplanations) {
      axis.run(axisKey(row), row.dayMasterElement, row.strength, row.yongshinElement, row.gyeokgukFamily, row.plain, row.detail);
    }
    for (const row of source.sourceEvidenceExplanations) {
      evidence.run(`source/${row.sourceId}/${row.state}`, row.sourceId, row.state, Number(row.weight), row.plain, row.detail);
    }
    for (const row of source.conclusionExplanations) {
      conclusion.run(`conclusion/sajuFit/${row.tone}`, row.tone, row.plain, row.detail);
    }
  })();
}

function verify(db: Database.Database, source: GeneratedDraft): void {
  const expected = {
    saju_axis_explanations: source.sajuAxisExplanations.length,
    source_evidence_explanations: source.sourceEvidenceExplanations.length,
    conclusion_explanations: source.conclusionExplanations.length,
    evidence_connectors: 0,
  };
  for (const [table, count] of Object.entries(expected)) {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    if (row.count !== count) throw new Error(`${table}: expected ${count}, received ${row.count}`);
  }
}

function manifest(source: GeneratedDraft, bytes: Buffer): string {
  const value = {
    schemaVersion: DATABASE_ASSET_SCHEMA_VERSION,
    relativePath: 'namespring/public/data/naming-evidence.db',
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    userVersion: DATABASE_USER_VERSION,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    contentVersion: source.contentVersion,
    rowCounts: {
      sajuAxisExplanations: source.sajuAxisExplanations.length,
      sourceEvidenceExplanations: source.sourceEvidenceExplanations.length,
      conclusionExplanations: source.conclusionExplanations.length,
      connectors: 0,
    },
  };
  return `/* This file is generated. Run: npm run build:naming-evidence-db */\n\nexport const GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST = ${JSON.stringify(value, null, 2)} as const;\n`;
}

function main(): void {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    throw new Error('Usage: tsx tools/build-naming-evidence-db.ts --write|--check [--source FILE]');
  }
  const source = loadSource(sourcePath());
  if (mode === '--write') {
    fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
    fs.rmSync(DATABASE_PATH, { force: true });
    const db = new Database(DATABASE_PATH);
    try { createSchema(db); populate(db, source); verify(db, source); } finally { db.close(); }
    fs.writeFileSync(MANIFEST_PATH, manifest(source, fs.readFileSync(DATABASE_PATH)), 'utf8');
    process.stdout.write(`wrote ${path.relative(REPOSITORY_ROOT, DATABASE_PATH)}\n`);
    return;
  }
  const db = new Database(DATABASE_PATH, { readonly: true, fileMustExist: true });
  try { verify(db, source); } finally { db.close(); }
  const expectedManifest = manifest(source, fs.readFileSync(DATABASE_PATH));
  if (fs.readFileSync(MANIFEST_PATH, 'utf8').replaceAll('\r\n', '\n') !== expectedManifest) {
    throw new Error('Naming evidence DB manifest is stale');
  }
  process.stdout.write('naming evidence database is current\n');
}

main();
