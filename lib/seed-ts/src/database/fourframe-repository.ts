import initSqlJs, { type Database } from 'sql.js';

export interface FourframeMeaningEntry {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly detailed_explanation: string | null;
  readonly positive_aspects: string | null;
  readonly caution_points: string | null;
  readonly personality_traits: string[];
  readonly suitable_career: string[];
  readonly life_period_influence: string | null;
  readonly special_characteristics: string | null;
  readonly challenge_period: string | null;
  readonly opportunity_area: string | null;
  readonly lucky_level: string | null;
}

/**
 * Browser-compatible DAO for fourframe (사격수리) meanings.
 * Uses sql.js (WASM) and fetches DB from Vite public path.
 */
export class FourframeRepository {
  private db: Database | null = null;
  private readonly dbUrl: string = '/data/fourframe.db';
  private readonly wasmUrl: string = 'https://sql.js.org/dist/sql-wasm.wasm';

  public async init(): Promise<void> {
    if (this.db) return;

    const SQL = await initSqlJs({
      locateFile: () => this.wasmUrl,
    });

    const response = await fetch(this.dbUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch DB: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    this.db = new SQL.Database(new Uint8Array(buffer));
  }

  public async findByNumber(number: number): Promise<FourframeMeaningEntry | null> {
    const rows = this.execute(
      `SELECT * FROM sagyeoksu_meanings WHERE number = ? LIMIT 1`,
      [number]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  public async findByLuckyLevel(luckyLevel: string): Promise<FourframeMeaningEntry[]> {
    return this.execute(
      `SELECT * FROM sagyeoksu_meanings WHERE lucky_level = ? ORDER BY number ASC`,
      [luckyLevel]
    );
  }

  public async searchByTitleOrSummary(keyword: string, limit = 100): Promise<FourframeMeaningEntry[]> {
    const normalized = `%${keyword.trim()}%`;
    return this.execute(
      `SELECT * FROM sagyeoksu_meanings
       WHERE title LIKE ? OR summary LIKE ?
       ORDER BY number ASC
       LIMIT ?`,
      [normalized, normalized, limit]
    );
  }

  public async findAll(limit = 200): Promise<FourframeMeaningEntry[]> {
    return this.execute(
      `SELECT * FROM sagyeoksu_meanings ORDER BY number ASC LIMIT ?`,
      [limit]
    );
  }

  private execute(sql: string, params: Array<string | number>): FourframeMeaningEntry[] {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }

    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const rows: FourframeMeaningEntry[] = [];
    while (stmt.step()) {
      rows.push(this.mapRow(stmt.getAsObject()));
    }
    stmt.free();
    return rows;
  }

  private mapRow(row: Record<string, unknown>): FourframeMeaningEntry {
    return {
      id: Number(row.id ?? 0),
      number: Number(row.number ?? 0),
      title: String(row.title ?? ''),
      summary: String(row.summary ?? ''),
      detailed_explanation: this.toNullableString(row.detailed_explanation),
      positive_aspects: this.toNullableString(row.positive_aspects),
      caution_points: this.toNullableString(row.caution_points),
      personality_traits: this.parseJsonArray(row.personality_traits),
      suitable_career: this.parseJsonArray(row.suitable_career),
      life_period_influence: this.toNullableString(row.life_period_influence),
      special_characteristics: this.toNullableString(row.special_characteristics),
      challenge_period: this.toNullableString(row.challenge_period),
      opportunity_area: this.toNullableString(row.opportunity_area),
      lucky_level: this.toNullableString(row.lucky_level),
    };
  }

  private parseJsonArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v));

    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }

  private toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value);
    return str.length > 0 ? str : null;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
