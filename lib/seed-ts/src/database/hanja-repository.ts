import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate the current directory path for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Interface representing a comprehensive Hanja entry for naming analysis.
 * Matches the schema in the SQLite database.
 */
export interface HanjaEntry {
  readonly id: number;
  readonly hangul: string;
  readonly hanja: string;
  readonly onset: string;
  readonly nucleus: string;
  readonly strokes: number;
  readonly stroke_element: string;
  readonly resource_element: string;
  readonly meaning: string;
  readonly radical: string;
  readonly is_surname: boolean;
}

/**
 * Data Access Object (DAO) for interacting with the Hanja SQLite database.
 * Encapsulates SQL logic to provide domain-specific search methods.
 */
export class HanjaRepository {
  private db: sqlite3.Database;

  /**
   * Initializes the repository with a connection to the database file.
   * Path is resolved relative to this file's directory: src/database -> src/data/hanja.db
   * @param dbPath Absolute or relative path to hanja.db.
   */
  constructor(dbPath: string = path.join(__dirname, '../data/hanja.db')) {
    this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('HanjaRepository: Database connection failed.', err.message);
      }
    });
  }

  /**
   * Finds a unique Hanja entry by its specific character.
   * @param hanja The Chinese character to search for.
   */
  public findByHanja(hanja: string): Promise<HanjaEntry | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM hanjas WHERE hanja = ? LIMIT 1`;
      this.db.get(sql, [hanja], (err, row) => {
        if (err) reject(err);
        else resolve(this.mapRowToEntry(row));
      });
    });
  }

  /**
   * Retrieves all Hanja entries associated with a specific Hangul pronunciation.
   * @param hangul The Korean Hangul character (e.g., '미').
   */
  public findByHangul(hangul: string): Promise<HanjaEntry[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM hanjas WHERE hangul = ? ORDER BY strokes ASC`;
      this.db.all(sql, [hangul], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToEntry(row)!));
      });
    });
  }

  /**
   * Finds Hanja entries allowed for use as surnames.
   * @param hangul The Hangul character to filter by.
   */
  public findSurnamesByHangul(hangul: string): Promise<HanjaEntry[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM hanjas WHERE hangul = ? AND is_surname = 1`;
      this.db.all(sql, [hangul], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToEntry(row)!));
      });
    });
  }

  /**
   * Searches for Hanja candidates based on a specific Resource Five Element.
   * Useful for balancing a person's Saju (Four Pillars) energy.
   * @param element The target Five Element (Wood, Fire, Earth, Metal, Water).
   * @param hangul Optional filter by Hangul sound.
   */
  public findByResourceElement(element: string, hangul?: string): Promise<HanjaEntry[]> {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM hanjas WHERE resource_element = ?`;
      const params: any[] = [element];

      if (hangul) {
        sql += ` AND hangul = ?`;
        params.push(hangul);
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToEntry(row)!));
      });
    });
  }

  /**
   * Finds characters within a specific stroke count range.
   * Helpful for Sagyuk (Four Frames) structural optimization.
   * @param min Min stroke count.
   * @param max Max stroke count.
   */
  public findByStrokeRange(min: number, max: number): Promise<HanjaEntry[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM hanjas WHERE strokes BETWEEN ? AND ? ORDER BY strokes ASC`;
      this.db.all(sql, [min, max], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToEntry(row)!));
      });
    });
  }

  /**
   * Retrieves characters by their phonetic initial (Onset).
   * Used to check for phonetic harmony between family name and given name.
   * @param onset The Hangul initial consonant (e.g., 'ㄱ', 'ㄴ').
   */
  public findByOnset(onset: string): Promise<HanjaEntry[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM hanjas WHERE onset = ? LIMIT 200`;
      this.db.all(sql, [onset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRowToEntry(row)!));
      });
    });
  }

  /**
   * Maps a raw database row to the HanjaEntry interface.
   * @param row The raw row object from SQLite.
   */
  private mapRowToEntry(row: any): HanjaEntry | null {
    if (!row) return null;
    return {
      ...row,
      is_surname: row.is_surname === 1 // Convert integer 0/1 to boolean
    };
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    this.db.close();
  }
}