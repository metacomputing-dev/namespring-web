import initSqlJs, { type Database } from 'sql.js';
import { resolvePublicAssetUrl } from './runtime-url.js';

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
 * Browser-compatible Data Access Object using sql.js (WASM).
 * Maintains the same API signature as the original Node-based DAO.
 */
export class HanjaRepository {
  private db: Database | null = null;
  // Public URL for the database file
  private readonly dbUrl: string = resolvePublicAssetUrl('data/hanja.db');
  // WASM binary location (using CDN for simplicity, or can be local in public/)
  private readonly wasmUrl: string = 'https://sql.js.org/dist/sql-wasm.wasm';

  /**
   * Async initialization to load WASM and the DB file.
   * This must be called before calling any search methods.
   */
  public async init(): Promise<void> {
    if (this.db) return;

    try {
      const SQL = await initSqlJs({
        locateFile: () => this.wasmUrl
      });

      const response = await fetch(this.dbUrl);
      if (!response.ok) throw new Error(`Failed to fetch DB: ${response.statusText}`);
      
      const buffer = await response.arrayBuffer();
      this.db = new SQL.Database(new Uint8Array(buffer));
      console.log('HanjaRepository: Database loaded successfully via WASM.');
    } catch (err) {
      console.error('HanjaRepository: Initialization failed.', err);
      throw err;
    }
  }

  public async findByHanja(hanja: string): Promise<HanjaEntry | null> {
    const sql = `SELECT * FROM hanjas WHERE hanja = ? LIMIT 1`;
    const rows = this.execute(sql, [hanja]);
    return rows.length > 0 ? rows[0] : null;
  }

  public async findByHangul(hangul: string): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE hangul = ? ORDER BY strokes ASC`;
    return this.execute(sql, [hangul]);
  }

  public async findSurnamesByHangul(hangul: string): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE hangul = ? AND is_surname = 1`;
    return this.execute(sql, [hangul]);
  }

  public async findByResourceElement(element: string, hangul?: string): Promise<HanjaEntry[]> {
    let sql = `SELECT * FROM hanjas WHERE resource_element = ?`;
    const params: any[] = [element];

    if (hangul) {
      sql += ` AND hangul = ?`;
      params.push(hangul);
    }
    return this.execute(sql, params);
  }

  public async findByStrokeRange(min: number, max: number): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE strokes BETWEEN ? AND ? ORDER BY strokes ASC`;
    return this.execute(sql, [min, max]);
  }

  public async findByOnset(onset: string): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE onset = ? LIMIT 200`;
    return this.execute(sql, [onset]);
  }

  /**
   * Internal helper to execute queries and map results.
   */
  private execute(sql: string, params: any[]): HanjaEntry[] {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
    
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    
    const results: HanjaEntry[] = [];
    while (stmt.step()) {
      results.push(this.mapRowToEntry(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  private mapRowToEntry(row: any): HanjaEntry {
    return {
      ...row,
      is_surname: row.is_surname === 1
    };
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
