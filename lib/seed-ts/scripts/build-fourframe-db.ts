import fs from 'fs';
import { dataPath, openDb, runSql, getSql, closeDb } from './db-helpers.js';

interface SagyeoksuEntry {
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
}

async function main() {
  const dbPath = dataPath(import.meta.url, 'sagyeoksu.db');
  const jsonPath = dataPath(import.meta.url, 'sagyeoksu_data.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON not found: ${jsonPath}`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const meanings: Record<string, SagyeoksuEntry> =
    parsed.sagyeoksu_meanings ?? parsed.fourframes_meanings;

  if (!meanings || Object.keys(meanings).length === 0) {
    console.error('No sagyeoksu_meanings found in JSON.');
    process.exit(1);
  }

  const db = openDb(dbPath);
  db.serialize(async () => {
    await runSql(db, `
      CREATE TABLE IF NOT EXISTS sagyeoksu_meanings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL,
        detailed_explanation TEXT, positive_aspects TEXT, caution_points TEXT,
        personality_traits TEXT, suitable_career TEXT, life_period_influence TEXT,
        special_characteristics TEXT, challenge_period TEXT, opportunity_area TEXT,
        lucky_level TEXT
      )`);
    await runSql(db, `CREATE INDEX IF NOT EXISTS idx_number ON sagyeoksu_meanings(number)`);
    await runSql(db, `CREATE INDEX IF NOT EXISTS idx_lucky ON sagyeoksu_meanings(lucky_level)`);
    await runSql(db, `DELETE FROM sagyeoksu_meanings`);
    await runSql(db, 'BEGIN TRANSACTION');

    const stmt = db.prepare(`
      INSERT INTO sagyeoksu_meanings (
        number, title, summary, detailed_explanation, positive_aspects, caution_points,
        personality_traits, suitable_career, life_period_influence,
        special_characteristics, challenge_period, opportunity_area, lucky_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    let count = 0;
    for (const key of Object.keys(meanings).sort((a, b) => +a - +b)) {
      const e = meanings[key];
      if (!e || typeof e.number !== 'number') continue;
      stmt.run(
        e.number, e.title ?? '', e.summary ?? '',
        e.detailed_explanation, e.positive_aspects, e.caution_points,
        JSON.stringify(e.personality_traits ?? []),
        JSON.stringify(e.suitable_career ?? []),
        e.life_period_influence, e.special_characteristics,
        e.challenge_period, e.opportunity_area, e.lucky_level,
      );
      count++;
    }

    stmt.finalize();
    await runSql(db, 'COMMIT');
    const row = await getSql<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM sagyeoksu_meanings');
    await closeDb(db);
    console.log(`Ingested ${count} rows (total: ${row?.count ?? '?'})`);
  });
}

main();
