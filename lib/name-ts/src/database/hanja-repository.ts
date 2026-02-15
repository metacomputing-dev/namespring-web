import initSqlJs, { type BindParams, type Database, type ParamsObject } from 'sql.js';

export abstract class SqliteRepository<T> {
  protected db: Database | null = null;

  constructor(
    protected readonly dbUrl: string,
    protected readonly wasmUrl = 'https://sql.js.org/dist/sql-wasm.wasm',
  ) {}

  async init(): Promise<void> {
    if (this.db) return;
    const SQL = await initSqlJs({ locateFile: () => this.wasmUrl });
    const res = await fetch(this.dbUrl);
    if (!res.ok) throw new Error(`Fetch DB failed: ${res.status} ${res.statusText}`);
    this.db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
  }

  protected query(sql: string, params: BindParams, mapRow: (row: ParamsObject) => T): T[] {
    if (!this.db) throw new Error('DB not initialized');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) results.push(mapRow(stmt.getAsObject()));
    stmt.free();
    return results;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
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
export class HanjaRepository extends SqliteRepository<HanjaEntry> {
  constructor() {
    super('/data/hanja.db');
  }

  async findByHanja(hanja: string): Promise<HanjaEntry | null> {
    const rows = this.query(`SELECT * FROM hanjas WHERE hanja = ? LIMIT 1`, [hanja], this.mapRow);
    return rows[0] ?? null;
  }

  async findByHangul(hangul: string): Promise<HanjaEntry[]> {
    return this.query(`SELECT * FROM hanjas WHERE hangul = ? ORDER BY strokes ASC`, [hangul], this.mapRow);
  }

  async findSurnamesByHangul(hangul: string): Promise<HanjaEntry[]> {
    return this.query(`SELECT * FROM hanjas WHERE hangul = ? AND is_surname = 1`, [hangul], this.mapRow);
  }

  async findByStrokeRange(min: number, max: number): Promise<HanjaEntry[]> {
    return this.query(`SELECT * FROM hanjas WHERE strokes BETWEEN ? AND ? ORDER BY strokes ASC`, [min, max], this.mapRow);
  }

  private mapRow = (row: ParamsObject): HanjaEntry => ({
    ...(row as unknown as HanjaEntry),
    is_surname: row.is_surname === 1,
  });
}
