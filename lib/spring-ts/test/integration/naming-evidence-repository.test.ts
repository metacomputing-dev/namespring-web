import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import type { NamingReport, NamingScoreVector } from '../../src/types.js';
import {
  NamingEvidenceDatabaseIntegrityError,
  NamingEvidenceRepository,
  buildNamingEvidenceReport,
  type NamingEvidenceReportInput,
  type NamingEvidenceSampleCase,
} from '../../src/report/naming-evidence/index.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const DATABASE_PATH = path.resolve(REPOSITORY_ROOT, 'namespring/public/data/naming-evidence.db');
const SQL_WASM_PATH = path.resolve(PACKAGE_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

function inputOf(sample: NamingEvidenceSampleCase): NamingEvidenceReportInput {
  const vector: NamingScoreVector = {
    legal: null,
    sajuFit: sample.sajuFit,
    yongshinFit: sample.yongshinFit,
    elementBalance: sample.elementBalance,
    hanjaMeaning: null,
    phonetic: null,
    eraFit: null,
    familyFit: null,
    risk: 0,
  };
  const namingReport: NamingReport = {
    name: { surname: [], givenName: [], fullHangul: sample.name, fullHanja: '' },
    totalScore: 70,
    scores: { hangul: 70, hanja: 0, fourFrame: 70 },
    scoreVector: vector,
    analysis: {
      hangul: { blocks: [], elementScore: 70, polarityScore: 70 },
      hanja: { blocks: [], elementScore: 0, polarityScore: 0 },
      fourFrame: { frames: [], elementScore: 70, luckScore: 70 },
    },
    interpretation: '',
  };
  return {
    springReport: { scoreVector: vector, namingReport },
    sajuAxes: {
      dayMasterElement: sample.dayMasterElement,
      strength: sample.strength,
      yongshinElement: sample.yongshinElement,
      gyeokgukFamily: sample.gyeokgukFamily,
    },
  };
}

test('loads the SQLite sample catalog and renders all ten selected cases', async () => {
  const bytes = fs.readFileSync(DATABASE_PATH);
  const repository = new NamingEvidenceRepository({
    dbUrl: 'memory://naming-evidence.db',
    wasmUrl: 'memory://sql-wasm.wasm',
    initializeSqlJs: async () => initSqlJs({ locateFile: () => SQL_WASM_PATH }),
    fetch: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => bytes.slice().buffer,
    }),
  });
  try {
    await repository.init();
    const catalog = repository.loadCatalog();
    const samples = repository.findSampleCases();
    assert.equal(catalog.contentVersion, 'sample-2026-07-21');
    assert.equal(Object.keys(catalog.fragments).length, 27);
    assert.equal(samples.length, 10);

    for (const sample of samples) {
      const axisFragment = repository.findSajuAxis(sample);
      assert.ok(axisFragment, sample.caseId);
      const section = buildNamingEvidenceReport(inputOf(sample), catalog).sections[0];
      assert.equal(section.availability, 'ready', sample.caseId);
      assert.equal(section.missingFragmentKeys.length, 0, sample.caseId);
      assert.match(section.plain, new RegExp(sample.name), sample.caseId);
      assert.equal(section.plain.includes('{{name}}'), false, sample.caseId);
      assert.ok(section.plain.length > 200, sample.caseId);
      assert.ok(section.detail.length > 200, sample.caseId);
    }
    const vowelEndingName = samples.find(({ caseId }) => caseId === 'sample-003');
    assert.ok(vowelEndingName);
    const vowelEndingText = buildNamingEvidenceReport(inputOf(vowelEndingName), catalog).sections[0].plain;
    assert.match(vowelEndingText, /박지호는/);
    assert.equal(vowelEndingText.includes('박지호은'), false);
  } finally {
    repository.close();
  }
});

test('rejects database bytes that do not match the generated manifest', async () => {
  const bytes = fs.readFileSync(DATABASE_PATH);
  const tampered = Uint8Array.from(bytes);
  tampered[100] ^= 0xff;
  const repository = new NamingEvidenceRepository({
    dbUrl: 'memory://tampered-naming-evidence.db',
    wasmUrl: 'memory://sql-wasm.wasm',
    initializeSqlJs: async () => initSqlJs({ locateFile: () => SQL_WASM_PATH }),
    fetch: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => tampered.slice().buffer,
    }),
  });
  await assert.rejects(repository.init(), NamingEvidenceDatabaseIntegrityError);
  repository.close();
});
