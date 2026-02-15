/**
 * Script to update the 'is_surname' field in the Hanja database.
 * Reads 'surname_hanja_dict' and sets is_surname = 1 for matching entries.
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
const surnameDictPath = path.resolve(__dirname, '../data/surname_hanja_dict');

/**
 * Main execution block to update the database.
 */
const updateSurnames = () => {
  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  // Check if surname dictionary file exists
  if (!fs.existsSync(surnameDictPath)) {
    console.error(`Surname dictionary not found: ${surnameDictPath}`);
    process.exit(1);
  }

  const sqlite = sqlite3.verbose();
  const db = new sqlite.Database(dbPath);

  db.serialize(() => {
    console.log('Starting surname status update...');

    // Load surname dictionary content
    const content = fs.readFileSync(surnameDictPath, 'utf8');
    const lines = content.split(/\r?\n/);

    // Track Hanja characters to be marked as surnames
    const surnameChars = new Set();

    lines.forEach(line => {
      if (!line.trim() || !line.includes(';')) return;

      const info = line.split(';')[0].trim();
      if (info.length >= 2) {
        // According to the format: Hangul(index 0), Hanja(index 1)
        const hanja = info[1];
        surnameChars.add(hanja);
      }
    });

    console.log(`Extracted ${surnameChars.size} unique Hanja characters from surname dictionary.`);

    // Execute updates within a single transaction for speed
    db.run("BEGIN TRANSACTION");

    const stmt = db.prepare(`UPDATE hanjas SET is_surname = 1 WHERE hanja = ?`);

    let updatedCount = 0;
    surnameChars.forEach(char => {
      stmt.run(char);
      updatedCount++;
    });

    stmt.finalize();

    db.run("COMMIT", (err) => {
      if (err) {
        console.error('Failed to commit transaction:', err.message);
      } else {
        console.log(`Surname update completed. Processed ${updatedCount} characters.`);
      }
      
      // Verification query to see how many rows were actually marked
      db.get("SELECT COUNT(*) as count FROM hanjas WHERE is_surname = 1", (err, row: { count: number } | undefined) => {
        if (!err && row) {
          console.log(`Current total surnames in database: ${row.count}`);
        }
        db.close();
      });
    });
  });
};

updateSurnames();
