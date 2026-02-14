/**
 * Script to parse name_to_stat_minified_with_hanja.json and create sharded SQLite DB files
 * based on the first character's choseong (ㄱ ~ ㅎ).
 *
 * Example:
 * npx tsx src/utils/name-stat-json-to-sharded-db.ts
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceJsonPath = path.resolve(__dirname, '../data/name_to_stat_minified_with_hanja.json');
const outputDir = path.resolve(__dirname, '../data/name-stat-shards');

const CHOSEONG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const BASE_CHOSEONG_ORDER = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;

const CHOSEONG_SHARD_MAP: Record<string, (typeof BASE_CHOSEONG_ORDER)[number]> = {
  'ㄱ': 'ㄱ',
  'ㄲ': 'ㄱ',
  'ㄴ': 'ㄴ',
  'ㄷ': 'ㄷ',
  'ㄸ': 'ㄷ',
  'ㄹ': 'ㄹ',
  'ㅁ': 'ㅁ',
  'ㅂ': 'ㅂ',
  'ㅃ': 'ㅂ',
  'ㅅ': 'ㅅ',
  'ㅆ': 'ㅅ',
  'ㅇ': 'ㅇ',
  'ㅈ': 'ㅈ',
  'ㅉ': 'ㅈ',
  'ㅊ': 'ㅊ',
  'ㅋ': 'ㅋ',
  'ㅌ': 'ㅌ',
  'ㅍ': 'ㅍ',
  'ㅎ': 'ㅎ',
};

type NameStatEntry = {
  similar_names?: unknown;
  hanja_combinations?: unknown;
  [key: string]: unknown;
};

type JsonRoot = Record<string, NameStatEntry>;

type Row = {
  name: string;
  first_char: string;
  first_choseong: string;
  similar_names_json: string;
  yearly_rank_json: string;
  yearly_birth_json: string;
  hanja_combinations_json: string;
  raw_entry_json: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractChoseong(char: string): string | null {
  if (!char) return null;
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;

  const choseongIndex = Math.floor((code - 0xac00) / 588);
  return CHOSEONG_LIST[choseongIndex] ?? null;
}

function detectStatObjects(entry: NameStatEntry): Record<string, unknown>[] {
  const statObjects: Record<string, unknown>[] = [];

  for (const value of Object.values(entry)) {
    if (!isObject(value)) continue;

    const buckets = Object.values(value);
    if (buckets.length === 0) continue;
    if (buckets.every((bucket) => isObject(bucket))) {
      statObjects.push(value);
    }
  }

  return statObjects;
}

function normalizeRow(name: string, entry: NameStatEntry): Row {
  const firstChar = name[0] ?? '';
  const rawChoseong = extractChoseong(firstChar);
  const firstChoseong = rawChoseong ? CHOSEONG_SHARD_MAP[rawChoseong] : undefined;
  if (!firstChoseong) {
    throw new Error(`Unsupported first choseong for name: ${name}`);
  }

  const similarNames = Array.isArray(entry.similar_names) ? entry.similar_names : [];
  const hanjaCombinations = Array.isArray(entry.hanja_combinations) ? entry.hanja_combinations : [];

  const statObjects = detectStatObjects(entry);
  const yearlyRank = statObjects[0] ?? {};
  const yearlyBirth = statObjects[1] ?? {};

  return {
    name,
    first_char: firstChar,
    first_choseong: firstChoseong,
    similar_names_json: JSON.stringify(similarNames),
    yearly_rank_json: JSON.stringify(yearlyRank),
    yearly_birth_json: JSON.stringify(yearlyBirth),
    hanja_combinations_json: JSON.stringify(hanjaCombinations),
    raw_entry_json: JSON.stringify(entry),
  };
}

function run(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function createShardDb(dbPath: string, rows: Row[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const sqlite = sqlite3.verbose();
    const db = new sqlite.Database(dbPath);

    db.serialize(async () => {
      try {
        await run(db, `
          CREATE TABLE IF NOT EXISTS name_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            first_char TEXT NOT NULL,
            first_choseong TEXT NOT NULL,
            similar_names_json TEXT NOT NULL,
            yearly_rank_json TEXT NOT NULL,
            yearly_birth_json TEXT NOT NULL,
            hanja_combinations_json TEXT NOT NULL,
            raw_entry_json TEXT NOT NULL
          )
        `);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_name_stats_name ON name_stats(name)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_name_stats_choseong ON name_stats(first_choseong)`);
        await run(db, `DELETE FROM name_stats`);
        await run(db, `BEGIN TRANSACTION`);

        const stmt = db.prepare(`
          INSERT INTO name_stats (
            name, first_char, first_choseong,
            similar_names_json, yearly_rank_json, yearly_birth_json,
            hanja_combinations_json, raw_entry_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of rows) {
          stmt.run(
            row.name,
            row.first_char,
            row.first_choseong,
            row.similar_names_json,
            row.yearly_rank_json,
            row.yearly_birth_json,
            row.hanja_combinations_json,
            row.raw_entry_json
          );
        }

        stmt.finalize();
        await run(db, `COMMIT`);
        db.close();
        resolve();
      } catch (error) {
        run(db, `ROLLBACK`).catch(() => undefined).finally(() => {
          db.close();
          reject(error);
        });
      }
    });
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(sourceJsonPath)) {
    console.error(`Source JSON not found: ${sourceJsonPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const root = JSON.parse(fs.readFileSync(sourceJsonPath, 'utf8')) as JsonRoot;
  const shards: Record<string, Row[]> = {};
  let skippedCount = 0;

  for (const choseong of BASE_CHOSEONG_ORDER) shards[choseong] = [];

  for (const [name, entry] of Object.entries(root)) {
    const firstChar = name[0] ?? '';
    const rawChoseong = extractChoseong(firstChar);
    const shardKey = rawChoseong ? CHOSEONG_SHARD_MAP[rawChoseong] : undefined;

    if (!shardKey) {
      skippedCount++;
      continue;
    }

    const row = normalizeRow(name, entry);
    shards[shardKey].push(row);
  }

  let shardIndex = 1;
  for (const choseong of BASE_CHOSEONG_ORDER) {
    const rows = shards[choseong];
    const dbFilename = `${String(shardIndex).padStart(2, '0')}.db`;
    const dbPath = path.join(outputDir, dbFilename);

    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    await createShardDb(dbPath, rows);
    console.log(`${dbFilename}: ${rows.length} rows`);
    shardIndex++;
  }

  console.log(`Skipped non-Hangul-first names: ${skippedCount}`);

  console.log('Shard DB generation completed.');
}

main().catch((error: unknown) => {
  console.error('Failed to build shard DBs:', error);
  process.exit(1);
});
