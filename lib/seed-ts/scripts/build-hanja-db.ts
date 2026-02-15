import fs from 'fs';
import { dataPath, openDb, runSql, closeDb } from './db-helpers.js';

const ELEMENT_MAP: Record<string, string> = {
  '1': 'Wood', '2': 'Fire', '3': 'Earth', '4': 'Metal', '5': 'Water',
};

const INITIALS = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];
const MEDIALS = [
  'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ',
  'ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ',
];

function decomposeHangul(char: string) {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return { onset: '', nucleus: '' };
  return {
    onset: INITIALS[Math.floor(code / 588)],
    nucleus: MEDIALS[Math.floor((code % 588) / 28)],
  };
}

async function main() {
  const dbPath = dataPath(import.meta.url, 'hanja.db');
  const dictPath = dataPath(import.meta.url, 'name_hanja_dict');
  const radicals: Record<string, string> = {};
  const radicalPath = dataPath(import.meta.url, 'radicals.txt');
  if (fs.existsSync(radicalPath)) {
    for (const line of fs.readFileSync(radicalPath, 'utf8').split(/\r?\n/)) {
      if (!line.includes(':')) continue;
      const [key, value] = line.split(':').map(s => s.trim());
      if (key) radicals[key] = value || '';
    }
  }

  if (!fs.existsSync(dictPath)) {
    console.error(`Dictionary not found: ${dictPath}`);
    process.exit(1);
  }

  const db = openDb(dbPath);
  db.serialize(async () => {
    await runSql(db, `
      CREATE TABLE IF NOT EXISTS hanjas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hangul TEXT NOT NULL, hanja TEXT NOT NULL,
        onset TEXT, nucleus TEXT,
        strokes INTEGER, stroke_element TEXT, resource_element TEXT,
        meaning TEXT, radical TEXT, is_surname INTEGER DEFAULT 0
      )`);
    await runSql(db, `CREATE INDEX IF NOT EXISTS idx_hangul ON hanjas(hangul)`);
    await runSql(db, 'BEGIN TRANSACTION');

    const stmt = db.prepare(`
      INSERT INTO hanjas (hangul, hanja, onset, nucleus, strokes,
        stroke_element, resource_element, meaning, radical, is_surname)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);

    let count = 0;
    for (const line of fs.readFileSync(dictPath, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split(';', 2);
      if (parts.length !== 2) continue;
      const info = parts[0].trim();
      if (info.length < 6) continue;

      const { onset, nucleus } = decomposeHangul(info[0]);
      stmt.run(
        info[0], info[1], onset, nucleus,
        parseInt(info.substring(2, 4), 10) || 0,
        ELEMENT_MAP[info[4]] || 'Earth',
        ELEMENT_MAP[info[5]] || 'Earth',
        parts[1].trim(), radicals[info[1]] || '',
      );
      count++;
    }

    stmt.finalize();
    await runSql(db, 'COMMIT');
    await closeDb(db);
    console.log(`Ingested ${count} entries into hanja.db`);
  });
}

main();
