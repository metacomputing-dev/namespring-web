import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

import {
  FOURFRAME_CATALOG_PROVENANCE,
  FOURFRAME_MEANING_CATALOG,
  type FourframeMeaningEntry,
} from '../src/fourframe-catalog.js';
import {
  compileFourFrameContract,
  normalizeFourFrameNumber,
} from '../src/fourframe-contract.js';
import { FourFrameCalculator } from '../src/calculator/frame-calculator.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DB_PATH = path.resolve(
  PACKAGE_ROOT,
  '..',
  '..',
  FOURFRAME_CATALOG_PROVENANCE.sourcePath,
);
const SQL_WASM_PATH = path.resolve(
  PACKAGE_ROOT,
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm',
);

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

test('embedded four-frame catalog has exact canonical DB parity and provenance', async () => {
  const sourceBytes = fs.readFileSync(SOURCE_DB_PATH);
  assert.equal(
    sha256(sourceBytes),
    FOURFRAME_CATALOG_PROVENANCE.sourceDatabaseSha256,
  );

  const SQL = await initSqlJs({ locateFile: () => SQL_WASM_PATH });
  const db = new SQL.Database(sourceBytes);
  const statement = db.prepare('SELECT * FROM sagyeoksu_meanings ORDER BY number');
  const rows: FourframeMeaningEntry[] = [];
  try {
    while (statement.step()) {
      const row = statement.getAsObject();
      rows.push({
        id: row.id as number,
        number: row.number as number,
        title: row.title as string,
        summary: row.summary as string,
        detailed_explanation: row.detailed_explanation as string,
        positive_aspects: row.positive_aspects as string,
        caution_points: row.caution_points as string,
        personality_traits: JSON.parse(row.personality_traits as string) as string[],
        suitable_career: JSON.parse(row.suitable_career as string) as string[],
        life_period_influence: row.life_period_influence as string,
        special_characteristics: row.special_characteristics as string,
        challenge_period: row.challenge_period as string,
        opportunity_area: row.opportunity_area as string,
        lucky_level: row.lucky_level as FourframeMeaningEntry['lucky_level'],
      });
    }
  } finally {
    statement.free();
    db.close();
  }

  assert.equal(rows.length, FOURFRAME_CATALOG_PROVENANCE.rowCount);
  assert.equal(
    sha256(JSON.stringify(rows)),
    FOURFRAME_CATALOG_PROVENANCE.canonicalContentSha256,
  );
  assert.deepEqual(rows, FOURFRAME_MEANING_CATALOG);

  const compiled = compileFourFrameContract(FOURFRAME_MEANING_CATALOG);
  assert.equal(compiled.recordsByNumber.size, 81);
  assert.equal(compiled.luckyByNumber.size, 81);
  assert.ok(Object.isFrozen(FOURFRAME_CATALOG_PROVENANCE));
  assert.ok(Object.isFrozen(FOURFRAME_MEANING_CATALOG));
  assert.ok(FOURFRAME_MEANING_CATALOG.every((entry) =>
    Object.isFrozen(entry)
    && Object.isFrozen(entry.personality_traits)
    && Object.isFrozen(entry.suitable_career)));
});

test('four-frame stroke sums use an explicit 81-cycle', () => {
  assert.equal(normalizeFourFrameNumber(1), 1);
  assert.equal(normalizeFourFrameNumber(81), 81);
  assert.equal(normalizeFourFrameNumber(82), 1);
  assert.equal(normalizeFourFrameNumber(162), 81);
  assert.equal(normalizeFourFrameNumber(163), 1);
  const publicFrame = new FourFrameCalculator.Frame('won', 82);
  assert.equal(publicFrame.strokeSum, 1);
  assert.equal(publicFrame.entry.number, 1);
  assert.throws(() => normalizeFourFrameNumber(0), RangeError);
  assert.throws(() => normalizeFourFrameNumber(1.5), RangeError);
});
