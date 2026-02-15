import fs from 'fs';
import { dataPath, openDb, runSql, getSql, closeDb } from './db-helpers.js';

async function main() {
  const dbPath = dataPath(import.meta.url, 'hanja.db');
  const dictPath = dataPath(import.meta.url, 'surname_hanja_dict');

  if (!fs.existsSync(dbPath)) { console.error(`DB not found: ${dbPath}`); process.exit(1); }
  if (!fs.existsSync(dictPath)) { console.error(`Dict not found: ${dictPath}`); process.exit(1); }

  const surnameChars = new Set<string>();
  for (const line of fs.readFileSync(dictPath, 'utf8').split(/\r?\n/)) {
    const info = line.split(';')[0]?.trim();
    if (info && info.length >= 2) surnameChars.add(info[1]);
  }

  const db = openDb(dbPath);
  db.serialize(async () => {
    await runSql(db, 'BEGIN TRANSACTION');
    const stmt = db.prepare('UPDATE hanjas SET is_surname = 1 WHERE hanja = ?');
    for (const ch of surnameChars) stmt.run(ch);
    stmt.finalize();
    await runSql(db, 'COMMIT');

    const row = await getSql<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM hanjas WHERE is_surname = 1');
    await closeDb(db);
    console.log(`Updated ${surnameChars.size} chars (total surnames: ${row?.count ?? '?'})`);
  });
}

main();
