/**
 * name_to_stat_minified_with_hanja.json을 초성별 샤드 SQLite DB로 변환한다.
 * 실행: npx tsx src/utils/build-name-stat-db.ts
 */
import fs from 'fs';
import path from 'path';
import { dataPath, ensureDir, openDb, runSql, closeDb } from './db-helpers.js';

const CHOSEONG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
] as const;

const BASE_ORDER = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'] as const;

const DOUBLE_TO_BASE: Record<string, string> = {
  'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ',
};

function toShardKey(char: string): string | null {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  const cho = CHOSEONG[Math.floor((code - 0xAC00) / 588)] ?? null;
  if (!cho) return null;
  const base = DOUBLE_TO_BASE[cho] ?? cho;
  return (BASE_ORDER as readonly string[]).includes(base) ? base : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function detectStatObjects(entry: Record<string, unknown>): Record<string, unknown>[] {
  return Object.values(entry).filter(
    v => isObject(v) && Object.values(v).every(b => isObject(b)),
  ) as Record<string, unknown>[];
}

interface Row {
  name: string;
  first_char: string;
  first_choseong: string;
  similar_names_json: string;
  yearly_rank_json: string;
  yearly_birth_json: string;
  hanja_combinations_json: string;
  raw_entry_json: string;
}

function normalizeRow(name: string, entry: Record<string, unknown>): Row {
  const firstChar = name[0] ?? '';
  const shardKey = toShardKey(firstChar);
  if (!shardKey) throw new Error(`Unsupported choseong for: ${name}`);

  const stats = detectStatObjects(entry);
  return {
    name,
    first_char: firstChar,
    first_choseong: shardKey,
    similar_names_json: JSON.stringify(Array.isArray(entry.similar_names) ? entry.similar_names : []),
    yearly_rank_json: JSON.stringify(stats[0] ?? {}),
    yearly_birth_json: JSON.stringify(stats[1] ?? {}),
    hanja_combinations_json: JSON.stringify(Array.isArray(entry.hanja_combinations) ? entry.hanja_combinations : []),
    raw_entry_json: JSON.stringify(entry),
  };
}

async function createShardDb(dbPath: string, rows: Row[]): Promise<void> {
  const db = openDb(dbPath);
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await runSql(db, `
          CREATE TABLE IF NOT EXISTS name_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE, first_char TEXT NOT NULL, first_choseong TEXT NOT NULL,
            similar_names_json TEXT NOT NULL, yearly_rank_json TEXT NOT NULL,
            yearly_birth_json TEXT NOT NULL, hanja_combinations_json TEXT NOT NULL,
            raw_entry_json TEXT NOT NULL
          )`);
        await runSql(db, `CREATE INDEX IF NOT EXISTS idx_name ON name_stats(name)`);
        await runSql(db, `CREATE INDEX IF NOT EXISTS idx_choseong ON name_stats(first_choseong)`);
        await runSql(db, `DELETE FROM name_stats`);
        await runSql(db, 'BEGIN TRANSACTION');

        const stmt = db.prepare(`
          INSERT INTO name_stats (name, first_char, first_choseong,
            similar_names_json, yearly_rank_json, yearly_birth_json,
            hanja_combinations_json, raw_entry_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

        for (const r of rows) {
          stmt.run(
            r.name, r.first_char, r.first_choseong,
            r.similar_names_json, r.yearly_rank_json, r.yearly_birth_json,
            r.hanja_combinations_json, r.raw_entry_json,
          );
        }

        stmt.finalize();
        await runSql(db, 'COMMIT');
        await closeDb(db);
        resolve();
      } catch (err) {
        runSql(db, 'ROLLBACK').catch(() => {});
        closeDb(db).catch(() => {});
        reject(err);
      }
    });
  });
}

async function main() {
  const jsonPath = dataPath(import.meta.url, 'name_to_stat_minified_with_hanja.json');
  const outDir = dataPath(import.meta.url, 'name-stat-shards');

  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON not found: ${jsonPath}`);
    process.exit(1);
  }
  ensureDir(path.join(outDir, '_'));

  const root = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, Record<string, unknown>>;
  const shards: Record<string, Row[]> = {};
  for (const ch of BASE_ORDER) shards[ch] = [];

  let skipped = 0;
  for (const [name, entry] of Object.entries(root)) {
    const key = toShardKey(name[0] ?? '');
    if (!key) { skipped++; continue; }
    shards[key].push(normalizeRow(name, entry));
  }

  for (let i = 0; i < BASE_ORDER.length; i++) {
    const ch = BASE_ORDER[i];
    const filename = `${String(i + 1).padStart(2, '0')}.db`;
    const dbPath = path.join(outDir, filename);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    await createShardDb(dbPath, shards[ch]);
    console.log(`${filename}: ${shards[ch].length} rows`);
  }

  console.log(`Skipped: ${skipped}. Done.`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
