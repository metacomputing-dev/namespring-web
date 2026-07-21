import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import type { NamingReport, NamingScoreVector } from '../src/types.js';
import {
  NamingEvidenceRepository,
  buildNamingEvidenceReport,
  type NamingEvidenceReportInput,
  type NamingEvidenceSampleCase,
} from '../src/report/naming-evidence/index.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const DATABASE_PATH = path.resolve(REPOSITORY_ROOT, 'namespring/public/data/naming-evidence.db');
const SQL_WASM_PATH = path.resolve(PACKAGE_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const OUTPUT_PATH = path.resolve(
  PACKAGE_ROOT,
  'data/naming-report/evidence/naming-evidence.rendered-samples.json',
);

function vectorOf(sample: NamingEvidenceSampleCase): NamingScoreVector {
  return {
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
}

function namingReportOf(sample: NamingEvidenceSampleCase, vector: NamingScoreVector): NamingReport {
  return {
    name: {
      surname: [],
      givenName: [],
      fullHangul: sample.name,
      fullHanja: '',
    },
    totalScore: sample.sajuFit,
    scores: { hangul: 70, hanja: 0, fourFrame: 70 },
    scoreVector: vector,
    analysis: {
      hangul: { blocks: [], elementScore: 70, polarityScore: 70 },
      hanja: { blocks: [], elementScore: 0, polarityScore: 0 },
      fourFrame: { frames: [], elementScore: 70, luckScore: 70 },
    },
    interpretation: '',
  };
}

function inputOf(sample: NamingEvidenceSampleCase): NamingEvidenceReportInput {
  const vector = vectorOf(sample);
  return {
    springReport: { scoreVector: vector, namingReport: namingReportOf(sample, vector) },
    sajuAxes: {
      dayMasterElement: sample.dayMasterElement,
      strength: sample.strength,
      yongshinElement: sample.yongshinElement,
      gyeokgukFamily: sample.gyeokgukFamily,
    },
  };
}

async function buildOutput(): Promise<string> {
  const databaseBytes = fs.readFileSync(DATABASE_PATH);
  const repository = new NamingEvidenceRepository({
    dbUrl: 'memory://naming-evidence.db',
    wasmUrl: 'memory://sql-wasm.wasm',
    initializeSqlJs: async () => initSqlJs({ locateFile: () => SQL_WASM_PATH }),
    fetch: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => databaseBytes.slice().buffer,
    }),
  });
  try {
    await repository.init();
    const catalog = repository.loadCatalog();
    const samples = repository.findSampleCases().map((sample) => {
      const section = buildNamingEvidenceReport(inputOf(sample), catalog).sections[0];
      if (section.availability !== 'ready') {
        throw new Error(`${sample.caseId} did not render completely: ${section.availability}`);
      }
      return {
        caseId: sample.caseId,
        name: sample.name,
        axes: {
          dayMasterElement: sample.dayMasterElement,
          strength: sample.strength,
          yongshinElement: sample.yongshinElement,
          gyeokgukFamily: sample.gyeokgukFamily,
        },
        scores: {
          sajuFit: sample.sajuFit,
          yongshinFit: sample.yongshinFit,
          elementBalance: sample.elementBalance,
        },
        verdict: section.verdict,
        conclusionTone: section.conclusionTone,
        plain: section.plain,
        detail: section.detail,
        fragmentKeys: section.fragmentKeys,
      };
    });
    return `${JSON.stringify({
      schemaVersion: 'namespring.naming-evidence-rendered-samples/v1',
      contentVersion: catalog.contentVersion,
      sampleCount: samples.length,
      samples,
    }, null, 2)}\n`;
  } finally {
    repository.close();
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    throw new Error('Usage: tsx tools/generate-naming-evidence-samples.ts --write|--check');
  }
  const output = await buildOutput();
  if (mode === '--write') {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
    process.stdout.write(`wrote ${path.relative(PACKAGE_ROOT, OUTPUT_PATH)}\n`);
    return;
  }
  const current = fs.existsSync(OUTPUT_PATH)
    ? fs.readFileSync(OUTPUT_PATH, 'utf8').replaceAll('\r\n', '\n')
    : '';
  if (current !== output) {
    throw new Error('Rendered samples are stale. Run npm run generate:naming-evidence-samples.');
  }
  process.stdout.write('rendered naming evidence samples are current\n');
}

await main();
