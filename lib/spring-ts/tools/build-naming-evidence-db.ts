import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SOURCE_PATH = path.resolve(
  PACKAGE_ROOT,
  'data/naming-report/evidence/naming-evidence.sample.json',
);
const DATABASE_PATH = path.resolve(
  REPOSITORY_ROOT,
  'namespring/public/data/naming-evidence.db',
);
const MANIFEST_PATH = path.resolve(
  PACKAGE_ROOT,
  'src/report/naming-evidence/database-manifest.generated.ts',
);
const SOURCE_SCHEMA_VERSION = 'namespring.naming-evidence-source/v1';
const DATABASE_SCHEMA_VERSION = 'namespring.naming-evidence-db/v1';
const DATABASE_USER_VERSION = 1;
const DATABASE_ASSET_SCHEMA_VERSION = 'namespring.naming-evidence-db-asset/v1';

const ELEMENTS = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);
const STRENGTHS = new Set(['weak', 'balanced', 'strong']);
const GYEOKGUK_FAMILIES = new Set([
  'inseong', 'siksang', 'jaeseong', 'gwanseong', 'bigeop', 'special',
]);
const SCORE_AXES = new Set(['sajuFit', 'yongshinFit', 'elementBalance']);
const BANDS = new Set(['excellent', 'good', 'mixed', 'caution']);
const ROLES = new Set(['summary', 'detail']);
const TONES = new Set([
  'allPositive', 'mostlyPositive', 'mixedButUsable', 'needsCaution', 'insufficientEvidence',
]);
const RELATIONS = new Set(['supports', 'limits', 'counterbalances', 'neutral']);

interface SajuAxisSource {
  readonly dayMasterElement: string;
  readonly strength: string;
  readonly yongshinElement: string;
  readonly gyeokgukFamily: string;
  readonly plain: string;
  readonly detail: string;
}

interface ScoreBandSource {
  readonly axis: string;
  readonly band: string;
  readonly role: string;
  readonly plain: string;
  readonly detail: string;
}

interface ConclusionSource {
  readonly tone: string;
  readonly plain: string;
  readonly detail: string;
}

interface ConnectorSource {
  readonly relation: string;
  readonly variant: number;
  readonly text: string;
}

interface SampleCaseSource {
  readonly caseId: string;
  readonly name: string;
  readonly dayMasterElement: string;
  readonly strength: string;
  readonly yongshinElement: string;
  readonly gyeokgukFamily: string;
  readonly sajuFit: number;
  readonly yongshinFit: number;
  readonly elementBalance: number;
}

interface NamingEvidenceSource {
  readonly schemaVersion: string;
  readonly contentVersion: string;
  readonly contentStatus: string;
  readonly sajuAxisExplanations: readonly SajuAxisSource[];
  readonly scoreBandExplanations: readonly ScoreBandSource[];
  readonly conclusionExplanations: readonly ConclusionSource[];
  readonly connectors: readonly ConnectorSource[];
  readonly sampleCases: readonly SampleCaseSource[];
}

function requiredText(value: unknown, pathLabel: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${pathLabel} must be non-empty text`);
  }
  return value.trim();
}

function assertEnum(value: string, allowed: ReadonlySet<string>, pathLabel: string): void {
  if (!allowed.has(value)) throw new Error(`${pathLabel} has unsupported value ${value}`);
}

function assertScore(value: number, pathLabel: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
    throw new Error(`${pathLabel} must be an integer from 0 to 100`);
  }
}

function axisKey(row: SajuAxisSource | SampleCaseSource): string {
  return `saju-axis/${row.dayMasterElement}/${row.strength}/${row.yongshinElement}/${row.gyeokgukFamily}`;
}

function loadSource(): NamingEvidenceSource {
  const parsed = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8')) as NamingEvidenceSource;
  if (parsed.schemaVersion !== SOURCE_SCHEMA_VERSION) throw new Error('Unsupported source schemaVersion');
  requiredText(parsed.contentVersion, 'contentVersion');
  if (parsed.contentStatus !== 'sample') throw new Error('This builder currently expects sample content');
  if (!Array.isArray(parsed.sajuAxisExplanations) || parsed.sajuAxisExplanations.length === 0) {
    throw new Error('sajuAxisExplanations must not be empty');
  }
  if (!Array.isArray(parsed.scoreBandExplanations) || parsed.scoreBandExplanations.length === 0) {
    throw new Error('scoreBandExplanations must not be empty');
  }
  if (!Array.isArray(parsed.conclusionExplanations) || parsed.conclusionExplanations.length === 0) {
    throw new Error('conclusionExplanations must not be empty');
  }
  if (!Array.isArray(parsed.connectors) || !Array.isArray(parsed.sampleCases)) {
    throw new Error('connectors and sampleCases must be arrays');
  }

  const axisKeys = new Set<string>();
  parsed.sajuAxisExplanations.forEach((row, index) => {
    assertEnum(row.dayMasterElement, ELEMENTS, `sajuAxisExplanations[${index}].dayMasterElement`);
    assertEnum(row.strength, STRENGTHS, `sajuAxisExplanations[${index}].strength`);
    assertEnum(row.yongshinElement, ELEMENTS, `sajuAxisExplanations[${index}].yongshinElement`);
    assertEnum(row.gyeokgukFamily, GYEOKGUK_FAMILIES, `sajuAxisExplanations[${index}].gyeokgukFamily`);
    requiredText(row.plain, `sajuAxisExplanations[${index}].plain`);
    requiredText(row.detail, `sajuAxisExplanations[${index}].detail`);
    const key = axisKey(row);
    if (axisKeys.has(key)) throw new Error(`Duplicate saju axis ${key}`);
    axisKeys.add(key);
  });

  const scoreKeys = new Set<string>();
  parsed.scoreBandExplanations.forEach((row, index) => {
    assertEnum(row.axis, SCORE_AXES, `scoreBandExplanations[${index}].axis`);
    assertEnum(row.band, BANDS, `scoreBandExplanations[${index}].band`);
    assertEnum(row.role, ROLES, `scoreBandExplanations[${index}].role`);
    const expectedRole = row.axis === 'sajuFit' ? 'summary' : 'detail';
    if (row.role !== expectedRole) throw new Error(`${row.axis} must use role ${expectedRole}`);
    requiredText(row.plain, `scoreBandExplanations[${index}].plain`);
    requiredText(row.detail, `scoreBandExplanations[${index}].detail`);
    const key = `${row.axis}/${row.band}`;
    if (scoreKeys.has(key)) throw new Error(`Duplicate score band ${key}`);
    scoreKeys.add(key);
  });
  for (const axis of SCORE_AXES) {
    for (const band of BANDS) {
      if (!scoreKeys.has(`${axis}/${band}`)) throw new Error(`Missing score band ${axis}/${band}`);
    }
  }

  const tones = new Set<string>();
  parsed.conclusionExplanations.forEach((row, index) => {
    assertEnum(row.tone, TONES, `conclusionExplanations[${index}].tone`);
    requiredText(row.plain, `conclusionExplanations[${index}].plain`);
    requiredText(row.detail, `conclusionExplanations[${index}].detail`);
    if (tones.has(row.tone)) throw new Error(`Duplicate conclusion tone ${row.tone}`);
    tones.add(row.tone);
  });
  for (const tone of TONES) {
    if (!tones.has(tone)) throw new Error(`Missing conclusion tone ${tone}`);
  }

  const connectorKeys = new Set<string>();
  parsed.connectors.forEach((row, index) => {
    assertEnum(row.relation, RELATIONS, `connectors[${index}].relation`);
    if (!Number.isSafeInteger(row.variant) || row.variant < 0) {
      throw new Error(`connectors[${index}].variant must be a non-negative integer`);
    }
    requiredText(row.text, `connectors[${index}].text`);
    const key = `${row.relation}/${row.variant}`;
    if (connectorKeys.has(key)) throw new Error(`Duplicate connector ${key}`);
    connectorKeys.add(key);
  });

  if (parsed.sampleCases.length !== 10) throw new Error('Exactly 10 sample cases are required');
  const caseIds = new Set<string>();
  parsed.sampleCases.forEach((row, index) => {
    requiredText(row.caseId, `sampleCases[${index}].caseId`);
    requiredText(row.name, `sampleCases[${index}].name`);
    if (caseIds.has(row.caseId)) throw new Error(`Duplicate sample case ${row.caseId}`);
    caseIds.add(row.caseId);
    if (!axisKeys.has(axisKey(row))) throw new Error(`${row.caseId} has no matching saju explanation`);
    assertScore(row.sajuFit, `sampleCases[${index}].sajuFit`);
    assertScore(row.yongshinFit, `sampleCases[${index}].yongshinFit`);
    assertScore(row.elementBalance, `sampleCases[${index}].elementBalance`);
  });
  return parsed;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = ${DATABASE_USER_VERSION};
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE saju_axis_explanations (
      fragment_key TEXT PRIMARY KEY,
      day_master_element TEXT NOT NULL CHECK (day_master_element IN ('WOOD','FIRE','EARTH','METAL','WATER')),
      strength TEXT NOT NULL CHECK (strength IN ('weak','balanced','strong')),
      yongshin_element TEXT NOT NULL CHECK (yongshin_element IN ('WOOD','FIRE','EARTH','METAL','WATER')),
      gyeokguk_family TEXT NOT NULL CHECK (gyeokguk_family IN ('inseong','siksang','jaeseong','gwanseong','bigeop','special')),
      plain TEXT NOT NULL,
      detail TEXT NOT NULL,
      content_status TEXT NOT NULL CHECK (content_status IN ('sample','reviewed')),
      UNIQUE (day_master_element, strength, yongshin_element, gyeokguk_family)
    ) WITHOUT ROWID;
    CREATE TABLE score_band_explanations (
      fragment_key TEXT PRIMARY KEY,
      axis TEXT NOT NULL CHECK (axis IN ('sajuFit','yongshinFit','elementBalance')),
      band TEXT NOT NULL CHECK (band IN ('excellent','good','mixed','caution')),
      role TEXT NOT NULL CHECK (role IN ('summary','detail')),
      plain TEXT NOT NULL,
      detail TEXT NOT NULL,
      content_status TEXT NOT NULL CHECK (content_status IN ('sample','reviewed')),
      UNIQUE (axis, band)
    ) WITHOUT ROWID;
    CREATE TABLE conclusion_explanations (
      fragment_key TEXT PRIMARY KEY,
      tone TEXT NOT NULL UNIQUE CHECK (tone IN ('allPositive','mostlyPositive','mixedButUsable','needsCaution','insufficientEvidence')),
      plain TEXT NOT NULL,
      detail TEXT NOT NULL,
      content_status TEXT NOT NULL CHECK (content_status IN ('sample','reviewed'))
    ) WITHOUT ROWID;
    CREATE TABLE evidence_connectors (
      relation TEXT NOT NULL CHECK (relation IN ('supports','limits','counterbalances','neutral')),
      variant INTEGER NOT NULL CHECK (variant >= 0),
      text TEXT NOT NULL,
      content_status TEXT NOT NULL CHECK (content_status IN ('sample','reviewed')),
      PRIMARY KEY (relation, variant)
    ) WITHOUT ROWID;
    CREATE TABLE sample_evidence_cases (
      case_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      day_master_element TEXT NOT NULL,
      strength TEXT NOT NULL,
      yongshin_element TEXT NOT NULL,
      gyeokguk_family TEXT NOT NULL,
      saju_fit INTEGER NOT NULL CHECK (saju_fit BETWEEN 0 AND 100),
      yongshin_fit INTEGER NOT NULL CHECK (yongshin_fit BETWEEN 0 AND 100),
      element_balance INTEGER NOT NULL CHECK (element_balance BETWEEN 0 AND 100)
    ) WITHOUT ROWID;
    CREATE INDEX idx_saju_axis_lookup ON saju_axis_explanations (
      day_master_element, strength, yongshin_element, gyeokguk_family
    );
    CREATE INDEX idx_score_band_lookup ON score_band_explanations (axis, band);
  `);
}

function populateDatabase(db: Database.Database, source: NamingEvidenceSource): void {
  const insertMetadata = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
  const insertAxis = db.prepare(`
    INSERT INTO saju_axis_explanations (
      fragment_key, day_master_element, strength, yongshin_element,
      gyeokguk_family, plain, detail, content_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertScore = db.prepare(`
    INSERT INTO score_band_explanations (
      fragment_key, axis, band, role, plain, detail, content_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertConclusion = db.prepare(`
    INSERT INTO conclusion_explanations (
      fragment_key, tone, plain, detail, content_status
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertConnector = db.prepare(`
    INSERT INTO evidence_connectors (relation, variant, text, content_status)
    VALUES (?, ?, ?, ?)
  `);
  const insertCase = db.prepare(`
    INSERT INTO sample_evidence_cases (
      case_id, name, day_master_element, strength, yongshin_element,
      gyeokguk_family, saju_fit, yongshin_fit, element_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertMetadata.run('schemaVersion', DATABASE_SCHEMA_VERSION);
    insertMetadata.run('sourceSchemaVersion', source.schemaVersion);
    insertMetadata.run('contentVersion', source.contentVersion);
    insertMetadata.run('contentStatus', source.contentStatus);
    for (const row of source.sajuAxisExplanations) {
      insertAxis.run(
        axisKey(row), row.dayMasterElement, row.strength, row.yongshinElement,
        row.gyeokgukFamily, row.plain, row.detail, source.contentStatus,
      );
    }
    for (const row of source.scoreBandExplanations) {
      insertScore.run(
        `score/${row.axis}/${row.band}`, row.axis, row.band, row.role,
        row.plain, row.detail, source.contentStatus,
      );
    }
    for (const row of source.conclusionExplanations) {
      insertConclusion.run(
        `conclusion/sajuFit/${row.tone}`, row.tone, row.plain,
        row.detail, source.contentStatus,
      );
    }
    for (const row of source.connectors) {
      insertConnector.run(row.relation, row.variant, row.text, source.contentStatus);
    }
    for (const row of source.sampleCases) {
      insertCase.run(
        row.caseId, row.name, row.dayMasterElement, row.strength,
        row.yongshinElement, row.gyeokgukFamily, row.sajuFit,
        row.yongshinFit, row.elementBalance,
      );
    }
  })();
}

function tableCount(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

function assertCanonicalRows(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} content does not match the source JSON`);
  }
}

function verifyDatabase(db: Database.Database, source: NamingEvidenceSource): void {
  const userVersion = (db.pragma('user_version', { simple: true }) as number);
  if (userVersion !== DATABASE_USER_VERSION) throw new Error(`Unexpected user_version ${userVersion}`);
  const metadataRows = db.prepare('SELECT key, value FROM metadata').all() as Array<{ key: string; value: string }>;
  const metadata = new Map(metadataRows.map((row) => [row.key, row.value]));
  if (metadata.get('schemaVersion') !== DATABASE_SCHEMA_VERSION) throw new Error('DB schemaVersion mismatch');
  if (metadata.get('contentVersion') !== source.contentVersion) throw new Error('DB contentVersion mismatch');
  const expectedCounts: Record<string, number> = {
    saju_axis_explanations: source.sajuAxisExplanations.length,
    score_band_explanations: source.scoreBandExplanations.length,
    conclusion_explanations: source.conclusionExplanations.length,
    evidence_connectors: source.connectors.length,
    sample_evidence_cases: source.sampleCases.length,
  };
  for (const [table, expected] of Object.entries(expectedCounts)) {
    const actual = tableCount(db, table);
    if (actual !== expected) throw new Error(`${table} expected ${expected} rows, received ${actual}`);
  }
  for (const row of source.sajuAxisExplanations) {
    const found = db.prepare(`
      SELECT plain, detail FROM saju_axis_explanations WHERE fragment_key = ?
    `).get(axisKey(row)) as { plain: string; detail: string } | undefined;
    if (!found || found.plain !== row.plain || found.detail !== row.detail) {
      throw new Error(`DB content mismatch for ${axisKey(row)}`);
    }
  }
  const scoreRows = db.prepare(`
    SELECT axis, band, role, plain, detail
    FROM score_band_explanations ORDER BY axis, band
  `).all();
  const expectedScoreRows = [...source.scoreBandExplanations]
    .map(({ axis, band, role, plain, detail }) => ({ axis, band, role, plain, detail }))
    .sort((left, right) => `${left.axis}/${left.band}`.localeCompare(`${right.axis}/${right.band}`, 'en'));
  assertCanonicalRows('score_band_explanations', scoreRows, expectedScoreRows);

  const conclusionRows = db.prepare(`
    SELECT tone, plain, detail FROM conclusion_explanations ORDER BY tone
  `).all();
  const expectedConclusionRows = [...source.conclusionExplanations]
    .map(({ tone, plain, detail }) => ({ tone, plain, detail }))
    .sort((left, right) => left.tone.localeCompare(right.tone, 'en'));
  assertCanonicalRows('conclusion_explanations', conclusionRows, expectedConclusionRows);

  const connectorRows = db.prepare(`
    SELECT relation, variant, text FROM evidence_connectors ORDER BY relation, variant
  `).all();
  const expectedConnectorRows = [...source.connectors]
    .map(({ relation, variant, text }) => ({ relation, variant, text }))
    .sort((left, right) => `${left.relation}/${left.variant}`.localeCompare(`${right.relation}/${right.variant}`, 'en'));
  assertCanonicalRows('evidence_connectors', connectorRows, expectedConnectorRows);

  const sampleRows = db.prepare(`
    SELECT case_id AS caseId, name, day_master_element AS dayMasterElement,
           strength, yongshin_element AS yongshinElement,
           gyeokguk_family AS gyeokgukFamily, saju_fit AS sajuFit,
           yongshin_fit AS yongshinFit, element_balance AS elementBalance
    FROM sample_evidence_cases ORDER BY case_id
  `).all();
  const expectedSampleRows = [...source.sampleCases]
    .map((row) => ({ ...row }))
    .sort((left, right) => left.caseId.localeCompare(right.caseId, 'en'));
  assertCanonicalRows('sample_evidence_cases', sampleRows, expectedSampleRows);
}

function renderManifest(source: NamingEvidenceSource, bytes: Buffer): string {
  const rowCounts = {
    sajuAxisExplanations: source.sajuAxisExplanations.length,
    scoreBandExplanations: source.scoreBandExplanations.length,
    conclusionExplanations: source.conclusionExplanations.length,
    connectors: source.connectors.length,
    sampleCases: source.sampleCases.length,
  };
  const manifest = {
    schemaVersion: DATABASE_ASSET_SCHEMA_VERSION,
    relativePath: 'namespring/public/data/naming-evidence.db',
    byteLength: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    userVersion: DATABASE_USER_VERSION,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    contentVersion: source.contentVersion,
    rowCounts,
  };
  return [
    '/* This file is generated. Run: npm run build:naming-evidence-db */',
    '',
    `export const GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;`,
    '',
  ].join('\n');
}

function verifyManifest(source: NamingEvidenceSource): void {
  const bytes = fs.readFileSync(DATABASE_PATH);
  const expected = renderManifest(source, bytes);
  const current = fs.existsSync(MANIFEST_PATH)
    ? fs.readFileSync(MANIFEST_PATH, 'utf8').replaceAll('\r\n', '\n')
    : '';
  if (current !== expected) {
    throw new Error('Naming evidence DB manifest is stale. Run npm run build:naming-evidence-db.');
  }
}

function main(): void {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    throw new Error('Usage: tsx tools/build-naming-evidence-db.ts --write|--check');
  }
  const source = loadSource();
  if (mode === '--write') {
    fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
    fs.rmSync(DATABASE_PATH, { force: true });
    const db = new Database(DATABASE_PATH);
    try {
      createSchema(db);
      populateDatabase(db, source);
      db.pragma('optimize');
      verifyDatabase(db, source);
    } finally {
      db.close();
    }
    const manifest = renderManifest(source, fs.readFileSync(DATABASE_PATH));
    fs.writeFileSync(MANIFEST_PATH, manifest, 'utf8');
    process.stdout.write(
      `wrote ${path.relative(REPOSITORY_ROOT, DATABASE_PATH)} and ${path.relative(PACKAGE_ROOT, MANIFEST_PATH)}\n`,
    );
    return;
  }
  if (!fs.existsSync(DATABASE_PATH)) throw new Error(`Database not found: ${DATABASE_PATH}`);
  const db = new Database(DATABASE_PATH, { readonly: true, fileMustExist: true });
  try {
    verifyDatabase(db, source);
  } finally {
    db.close();
  }
  verifyManifest(source);
  process.stdout.write('naming evidence database is current\n');
}

main();
