/**
 * Script to parse sagyeoksu_data.json and load it into a SQLite database.
 *
 * Example:
 * node .\src\utils\sagyeoksu-json-to-db.ts
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../data/sagyeoksu.db');
const jsonPath = path.resolve(__dirname, '../data/sagyeoksu_data.json');

type SagyeoksuEntry = {
  number: number;
  title: string;
  summary: string;
  detailed_explanation: string | null;
  positive_aspects: string | null;
  caution_points: string | null;
  personality_traits: string[];
  suitable_career: string[];
  life_period_influence: string | null;
  special_characteristics: string | null;
  challenge_period: string | null;
  opportunity_area: string | null;
  lucky_level: string | null;
};

type SagyeoksuJson = {
  sagyeoksu_meanings?: Record<string, SagyeoksuEntry>;
  fourframes_meanings?: Record<string, SagyeoksuEntry>;
};

const createDatabase = () => {
  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SagyeoksuJson;
  const meanings = parsed.sagyeoksu_meanings ?? parsed.fourframes_meanings;

  if (!meanings || Object.keys(meanings).length === 0) {
    console.error('No sagyeoksu_meanings found in JSON.');
    process.exit(1);
  }

  const sqlite = sqlite3.verbose();
  const db = new sqlite.Database(dbPath);

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS sagyeoksu_meanings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        detailed_explanation TEXT,
        positive_aspects TEXT,
        caution_points TEXT,
        personality_traits TEXT,
        suitable_career TEXT,
        life_period_influence TEXT,
        special_characteristics TEXT,
        challenge_period TEXT,
        opportunity_area TEXT,
        lucky_level TEXT
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_sagyeoksu_number ON sagyeoksu_meanings(number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sagyeoksu_lucky_level ON sagyeoksu_meanings(lucky_level)`);

    db.run(`DELETE FROM sagyeoksu_meanings`);

    db.run('BEGIN TRANSACTION');

    const stmt = db.prepare(`
      INSERT INTO sagyeoksu_meanings (
        number, title, summary, detailed_explanation, positive_aspects, caution_points,
        personality_traits, suitable_career, life_period_influence, special_characteristics,
        challenge_period, opportunity_area, lucky_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    const keys = Object.keys(meanings).sort((a, b) => Number(a) - Number(b));

    for (const key of keys) {
      const item = meanings[key];
      if (!item || typeof item.number !== 'number') continue;

      stmt.run(
        item.number,
        item.title ?? '',
        item.summary ?? '',
        item.detailed_explanation ?? null,
        item.positive_aspects ?? null,
        item.caution_points ?? null,
        JSON.stringify(item.personality_traits ?? []),
        JSON.stringify(item.suitable_career ?? []),
        item.life_period_influence ?? null,
        item.special_characteristics ?? null,
        item.challenge_period ?? null,
        item.opportunity_area ?? null,
        item.lucky_level ?? null
      );

      count++;
    }

    stmt.finalize();

    db.run('COMMIT', (err) => {
      if (err) {
        console.error('Commit error:', err.message);
      } else {
        console.log(`Ingested ${count} rows into sagyeoksu.db`);
      }

      db.get('SELECT COUNT(*) AS count FROM sagyeoksu_meanings', (countErr, row: { count: number } | undefined) => {
        if (!countErr && row) {
          console.log(`Current total rows: ${row.count}`);
        }
        db.close();
      });
    });
  });
};

createDatabase();
