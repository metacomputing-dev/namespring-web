/**
 * Script to parse the Hanja dictionary file and load it into a SQLite database.
 * Based on the logic provided in the Kotlin parser implementation.
 * Handles Hangul decomposition (Onset/Nucleus) and Naming Theory mappings.
 * 
 * node .\src\database\db-loader.ts
 */



import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup environment for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for file paths
const dbPath = path.resolve(__dirname, '../data/hanja.db');
const dictPath = path.resolve(__dirname, '../data/name_hanja_dict');
const radicalPath = path.resolve(__dirname, '../data/radicals.txt'); // Boosoo data

// Hangul decomposition maps
const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const MEDIALS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];

/**
 * Mapping logic based on Kotlin 'when' block:
 * 1 -> 木 (Wood), 2 -> 火 (Fire), 3 -> 土 (Earth), 4 -> 金 (Metal), 5 -> 水 (Water)
 * Typed as Record<string, string> to avoid indexing errors (ts7053).
 * @type {Record<string, string>}
 */
const ELEMENT_MAP: Record<string, string> = {
  '1': 'Wood',
  '2': 'Fire',
  '3': 'Earth',
  '4': 'Metal',
  '5': 'Water'
};

/**
 * Decomposes a Hangul character into Onset and Nucleus.
 * @param {string} char 
 */
function decomposeHangul(char: string) {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return { onset: '', nucleus: '' };
  
  const onsetIndex = Math.floor(code / 588);
  const nucleusIndex = Math.floor((code - (onsetIndex * 588)) / 28);
  
  return {
    onset: INITIALS[onsetIndex],
    nucleus: MEDIALS[nucleusIndex]
  };
}

const startMigration = () => {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = sqlite3.verbose();
  const db = new sqlite.Database(dbPath);

  db.serialize(() => {
    // Create Table matching HanjaEntry structure
    db.run(`
      CREATE TABLE IF NOT EXISTS hanjas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hangul TEXT NOT NULL,
        hanja TEXT NOT NULL,
        onset TEXT,
        nucleus TEXT,
        strokes INTEGER,
        stroke_element TEXT,
        resource_element TEXT,
        meaning TEXT,
        radical TEXT,
        is_surname INTEGER DEFAULT 0
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_hangul ON hanjas(hangul)`);

    console.log('Database schema ready. Loading dictionary...');

    // Load radicals (rads in Kotlin) if exists
    const radicals: Record<string, string> = {};
    if (fs.existsSync(radicalPath)) {
      const radContent = fs.readFileSync(radicalPath, 'utf8');
      radContent.split(/\r?\n/).forEach(line => {
        if (!line.includes(':')) return;
        const [key, value] = line.split(':').map(s => s.trim());
        if (key) radicals[key] = value || '';
      });
    }

    if (!fs.existsSync(dictPath)) {
      console.error(`Dictionary not found: ${dictPath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(dictPath, 'utf8');
    const lines = content.split(/\r?\n/);

    db.run("BEGIN TRANSACTION");

    const stmt = db.prepare(`
      INSERT INTO hanjas (
        hangul, hanja, onset, nucleus, strokes, stroke_element, resource_element, meaning, radical, is_surname
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(';', 2);
      if (parts.length !== 2) continue;

      const info = parts[0].trim();
      const meaning = parts[1].trim();

      if (info.length < 6) continue;

      // info[0]: Hangul, info[1]: Hanja
      const hangul = info[0];
      const hanja = info[1];
      
      // info[2..3]: Strokes (Hoeksu)
      const strokes = parseInt(info.substring(2, 4), 10) || 0;
      
      // info[4]: Stroke Element (HoeksuOhaeng)
      // info[5]: Resource Element (JawonOhaeng)
      const strokeElementCode = info[4];
      const resourceElementCode = info[5];

      const strokeElement = ELEMENT_MAP[strokeElementCode] || 'Earth';
      const resourceElement = ELEMENT_MAP[resourceElementCode] || 'Earth';
      
      const { onset, nucleus } = decomposeHangul(hangul);
      const radical = radicals[hanja] || '';

      stmt.run(
        hangul,
        hanja,
        onset,
        nucleus,
        strokes,
        strokeElement,
        resourceElement,
        meaning,
        radical,
        0 // isSurname defaults to false
      );
      count++;
    }

    stmt.finalize();

    db.run("COMMIT", (err) => {
      if (err) console.error('Commit error:', err.message);
      else console.log(`Ingested ${count} entries into hanja.db`);
      db.close();
    });
  });
};

startMigration();