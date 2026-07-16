import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import initSqlJs from 'sql.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE_PATH = path.resolve(ROOT, '../../namespring/public/data/hanja.db');
const OUTPUT_PATH = path.resolve(ROOT, 'data/korean-surname-authority.json');
const SOURCES_PATH = path.resolve(ROOT, 'data/sources/korean-surname.sources.json');
const EVIDENCE_RELATIVE_PATH = 'data/evidence/kosis-2015-compound-surnames.json';
const EVIDENCE_PATH = path.resolve(ROOT, EVIDENCE_RELATIVE_PATH);
const EXPECTED_DATABASE_SHA256 =
  '0f78eefc23e727937714b30215464783bf93882e5636d131c7113cfc1049e449';
const EXPECTED_EVIDENCE_SHA256 =
  '22cb2c2ab65762a2074355830a5b05756d2f9c966aa4521bfc05c8a1f6ea1f97';
const EXPECTED_KOSIS_ZIP_SHA256 =
  'f2feb50a8febc09b4d193eeacfec5e7773392b0adc357e318a64095fc5a3dd7b';
const EXPECTED_KOSIS_CSV_SHA256 =
  'c61eb0d030e632184431027ba84d5f8800f9f8ad225c8d45202505073023dcaa';
const KOSIS_SOURCE_ID = 'kosis_2015_dt_1in15sc_compound_surnames';
const KOSIS_SOURCE_URL =
  'https://kosis.kr/statisticsList/mass/mass_list.jsp?list_id=&org_id=101&process=statHtml&tbl_id=DT_1IN15SC&vw_cd=';
const KOSIS_FILE_ID = '101_DT_1IN15SC_F_2015';
const KOSIS_FILE_NO = '5838';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function fail(message) {
  throw new Error(`Surname authority generation failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(filePath, label) {
  const bytes = fs.readFileSync(filePath);
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) };
  } catch {
    fail(`invalid ${label} JSON`);
  }
}

function assertSingleCharacter(value, pattern, label) {
  if (typeof value !== 'string' || Array.from(value).length !== 1 || !pattern.test(value)) {
    fail(`invalid ${label}`);
  }
}

function assertPair(value, pattern, label) {
  const characters = typeof value === 'string' ? Array.from(value) : [];
  if (characters.length !== 2 || characters.some((character) => !pattern.test(character))) {
    fail(`invalid ${label}`);
  }
}

function loadCompoundEvidence() {
  const { bytes, value } = readJson(EVIDENCE_PATH, 'KOSIS evidence');
  const evidenceSha256 = sha256(bytes);
  if (evidenceSha256 !== EXPECTED_EVIDENCE_SHA256) {
    fail(`unexpected KOSIS evidence SHA-256 ${evidenceSha256}`);
  }
  if (!isRecord(value)
    || value.schemaVersion !== 'spring-ts.kosis-compound-surname-evidence.v1'
    || value.capturedAt !== '2026-07-16'
    || !isRecord(value.sourceTier)
    || value.sourceTier.tier !== 'T5_OFFICIAL'
    || value.sourceTier.sourceType !== 'official_kosis_statistics'
    || value.sourceTier.sourceUrl !== KOSIS_SOURCE_URL
    || value.sourceTier.authorityTruthEligible !== true
    || !isRecord(value.source)
    || value.source.tableId !== 'DT_1IN15SC'
    || value.source.year !== 2015
    || value.source.fileId !== KOSIS_FILE_ID
    || value.source.fileNo !== KOSIS_FILE_NO
    || value.source.sourceUrl !== KOSIS_SOURCE_URL
    || value.source.zipSha256 !== `sha256:${EXPECTED_KOSIS_ZIP_SHA256}`
    || value.source.csvEntry !== `${KOSIS_FILE_ID}.csv`
    || value.source.csvEntrySha256 !== `sha256:${EXPECTED_KOSIS_CSV_SHA256}`
    || value.source.csvEncoding !== 'CP949'
    || !isRecord(value.selection)
    || value.selection.geographyCode !== '00'
    || value.selection.geographyLabel !== '\uC804\uAD6D'
    || value.selection.measure !== '\uC778\uAD6C(\uB0B4\uAD6D\uC778)'
    || value.selection.surnameForm !== 'two_hangul_two_hanja'
    || value.selection.scope !== 'officially_observed_minimum_not_complete_legal_registry'
    || !Array.isArray(value.rows)
    || value.rows.length !== 6) {
    fail('KOSIS evidence contract mismatch');
  }

  const ids = new Set();
  const codes = new Set();
  const hangul = new Set();
  const hanja = new Set();
  const rows = value.rows.map((row) => {
    if (!isRecord(row)
      || typeof row.sourceCode !== 'string'
      || !/^\d{4}$/.test(row.sourceCode)
      || typeof row.id !== 'string'
      || !/^[a-z]+$/.test(row.id)) {
      fail('invalid KOSIS compound row identity');
    }
    assertPair(row.hangul, /^[\uAC00-\uD7A3]$/u, 'compound-surname Hangul');
    assertPair(row.hanja, /^\p{Script=Han}$/u, 'compound-surname Hanja');
    if (!Number.isSafeInteger(row.population)
      || !Number.isSafeInteger(row.male)
      || !Number.isSafeInteger(row.female)
      || row.population <= 0
      || row.male < 0
      || row.female < 0
      || row.male + row.female !== row.population
      || ids.has(row.id)
      || codes.has(row.sourceCode)
      || hangul.has(row.hangul)
      || hanja.has(row.hanja)) {
      fail('invalid or duplicate KOSIS compound row');
    }
    ids.add(row.id);
    codes.add(row.sourceCode);
    hangul.add(row.hangul);
    hanja.add(row.hanja);
    return Object.freeze({
      id: row.id,
      hangul: row.hangul,
      hanja: row.hanja,
      population: row.population,
    });
  });
  return Object.freeze({
    evidenceSha256,
    rows: Object.freeze(rows),
    source: value.source,
  });
}

function validateSourceRegistry(evidence) {
  const { value } = readJson(SOURCES_PATH, 'surname source registry');
  const source = isRecord(value) && Array.isArray(value.sources)
    ? value.sources.find((entry) => isRecord(entry) && entry.id === KOSIS_SOURCE_ID)
    : null;
  const artifact = isRecord(source) ? source.artifact : null;
  const tier = isRecord(source) ? source.sourceTier : null;
  const evidenceArtifact = isRecord(artifact) ? artifact.evidence : null;
  if (!isRecord(source)
    || !isRecord(tier)
    || tier.tier !== 'T5_OFFICIAL'
    || tier.sourceType !== 'official_kosis_statistics'
    || tier.sourceUrl !== KOSIS_SOURCE_URL
    || tier.authorityTruthEligible !== true
    || !isRecord(artifact)
    || artifact.tableId !== 'DT_1IN15SC'
    || artifact.year !== 2015
    || artifact.fileId !== KOSIS_FILE_ID
    || artifact.fileNo !== KOSIS_FILE_NO
    || artifact.zipSha256 !== `sha256:${EXPECTED_KOSIS_ZIP_SHA256}`
    || artifact.csvEntry !== `${KOSIS_FILE_ID}.csv`
    || artifact.csvEntrySha256 !== `sha256:${EXPECTED_KOSIS_CSV_SHA256}`
    || !isRecord(evidenceArtifact)
    || evidenceArtifact.path !== EVIDENCE_RELATIVE_PATH
    || evidenceArtifact.sha256 !== `sha256:${evidence.evidenceSha256}`) {
    fail('surname source registry does not match KOSIS evidence');
  }
}

async function loadSurnameRows() {
  const databaseBytes = fs.readFileSync(DATABASE_PATH);
  const databaseSha256 = sha256(databaseBytes);
  if (databaseSha256 !== EXPECTED_DATABASE_SHA256) {
    fail(`unexpected hanja.db SHA-256 ${databaseSha256}`);
  }

  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const database = new SQL.Database(databaseBytes);
  try {
    const result = database.exec(
      'SELECT hangul, hanja FROM hanjas WHERE is_surname = 1 '
      + 'ORDER BY hangul ASC, hanja ASC, id ASC',
    );
    const rows = result[0]?.values ?? [];
    if (rows.length !== 314) fail(`expected 314 rows, got ${rows.length}`);
    return rows.map(([hangul, hanja]) => {
      assertSingleCharacter(hangul, /^[\uAC00-\uD7A3]$/u, 'single-surname Hangul');
      assertSingleCharacter(hanja, /^\p{Script=Han}$/u, 'single-surname Hanja');
      return { hangul, hanja };
    });
  } finally {
    database.close();
  }
}

function groupSingleSurnames(rows) {
  const grouped = new Map();
  for (const { hangul, hanja } of rows) {
    const readings = grouped.get(hangul) ?? [];
    if (!readings.includes(hanja)) readings.push(hanja);
    grouped.set(hangul, readings);
  }
  if (grouped.size !== 181) fail(`expected 181 readings, got ${grouped.size}`);
  return [...grouped.entries()].map(([hangul, hanja]) => ({ hangul, hanja }));
}

function assertCompoundComponents(singleRows, compoundRows) {
  const exactPairs = new Set(singleRows.map(({ hangul, hanja }) => `${hangul}\u0000${hanja}`));
  for (const compound of compoundRows) {
    const hangul = Array.from(compound.hangul);
    const hanja = Array.from(compound.hanja);
    for (let index = 0; index < 2; index += 1) {
      if (!exactPairs.has(`${hangul[index]}\u0000${hanja[index]}`)) {
        fail(`compound component ${compound.id}:${index} is absent from canonical hanja.db`);
      }
    }
  }
}

function buildDocument(singleRows, evidence) {
  return {
    schemaVersion: 'spring-ts.korean-surname-authority.v1',
    generatedAt: '2026-07-16',
    scope: {
      singleCharacter: 'canonical_seed_database_rows',
      compound: 'officially_observed_minimum_not_complete_legal_registry',
    },
    sources: {
      singleCharacter: {
        id: 'namespring_hanja_db_surname_rows_2026_07_16',
        sha256: `sha256:${EXPECTED_DATABASE_SHA256}`,
        rowCount: singleRows.length,
        readingCount: new Set(singleRows.map(({ hangul }) => hangul)).size,
      },
      compound: {
        id: KOSIS_SOURCE_ID,
        tableId: 'DT_1IN15SC',
        year: 2015,
        sourceFileId: KOSIS_FILE_ID,
        sourceFileNo: KOSIS_FILE_NO,
        sourceUrl: KOSIS_SOURCE_URL,
        zipSha256: `sha256:${EXPECTED_KOSIS_ZIP_SHA256}`,
        csvEntrySha256: `sha256:${EXPECTED_KOSIS_CSV_SHA256}`,
        evidenceArtifactPath: EVIDENCE_RELATIVE_PATH,
        evidenceArtifactSha256: `sha256:${evidence.evidenceSha256}`,
      },
    },
    singleCharacterSurnames: groupSingleSurnames(singleRows),
    compoundSurnames: evidence.rows,
  };
}

const evidence = loadCompoundEvidence();
validateSourceRegistry(evidence);
const rows = await loadSurnameRows();
assertCompoundComponents(rows, evidence.rows);
const serialized = `${JSON.stringify(buildDocument(rows, evidence), null, 2)}\n`;
if (process.argv.includes('--check')) {
  const existing = fs.readFileSync(OUTPUT_PATH, 'utf8');
  if (existing !== serialized) fail('committed authority asset is stale');
  console.log('Surname authority asset: PASS (314 rows / 181 readings / 6 compounds)');
} else {
  fs.writeFileSync(OUTPUT_PATH, serialized, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}