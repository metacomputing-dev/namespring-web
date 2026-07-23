import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import {
  NamingEvidenceDatabaseIntegrityError,
  NamingEvidenceRepository,
} from '../../src/report/naming-evidence/index.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SQL_WASM_PATH = path.resolve(PACKAGE_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

test('loads source-evidence fragments from the v2 schema', async () => {
  const SQL = await initSqlJs({ locateFile: () => SQL_WASM_PATH });
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE saju_axis_explanations (
      fragment_key TEXT PRIMARY KEY, day_master_element TEXT, strength TEXT,
      yongshin_element TEXT, gyeokguk_family TEXT, plain TEXT, detail TEXT
    ) WITHOUT ROWID;
    CREATE TABLE source_evidence_explanations (
      fragment_key TEXT PRIMARY KEY, source_id TEXT, state TEXT, weight REAL, plain TEXT, detail TEXT
    ) WITHOUT ROWID;
    CREATE TABLE conclusion_explanations (
      fragment_key TEXT PRIMARY KEY, tone TEXT, plain TEXT, detail TEXT
    ) WITHOUT ROWID;
    CREATE TABLE evidence_connectors (
      relation TEXT, variant INTEGER, text TEXT, PRIMARY KEY (relation, variant)
    ) WITHOUT ROWID;
    INSERT INTO metadata VALUES ('contentVersion', 'test-v2');
    INSERT INTO saju_axis_explanations VALUES (
      'saju-axis/WOOD/weak/WATER/inseong', 'WOOD', 'weak', 'WATER', 'inseong', '상태 설명', '상세 상태 설명'
    );
    INSERT INTO source_evidence_explanations VALUES (
      'source/balance/improves', 'balance', 'improves', 0.6, '균형 근거', '상세 균형 근거'
    );
    INSERT INTO conclusion_explanations VALUES (
      'conclusion/sajuFit/mostlyPositive', 'mostlyPositive', '결론', '상세 결론'
    );
  `);
  const repository = new NamingEvidenceRepository();
  (repository as unknown as { db: InstanceType<typeof SQL.Database> }).db = db;
  try {
    assert.equal(repository.findSourceEvidence('balance', 'improves')?.plain, '균형 근거');
    assert.equal(repository.findSajuAxis({
      dayMasterElement: 'WOOD', strength: 'weak', yongshinElement: 'WATER', gyeokgukFamily: 'inseong',
    })?.plain, '상태 설명');
    const catalog = repository.loadCatalog();
    assert.equal(catalog.contentVersion, 'test-v2');
    assert.deepEqual(Object.keys(catalog.fragments).sort(), [
      'conclusion/sajuFit/mostlyPositive',
      'saju-axis/WOOD/weak/WATER/inseong',
      'source/balance/improves',
    ]);
  } finally {
    repository.close();
  }
});

test('rejects database bytes that do not match the generated manifest', async () => {
  const repository = new NamingEvidenceRepository({
    dbUrl: 'memory://tampered-naming-evidence.db',
    wasmUrl: 'memory://sql-wasm.wasm',
    initializeSqlJs: async () => initSqlJs({ locateFile: () => SQL_WASM_PATH }),
    fetch: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => Uint8Array.from([1]).buffer,
    }),
  });
  await assert.rejects(repository.init(), NamingEvidenceDatabaseIntegrityError);
  repository.close();
});
