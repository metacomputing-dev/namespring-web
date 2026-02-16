import initSqlJs, { type BindParams, type Database, type ParamsObject } from 'sql.js';
import databaseConfig from '../../config/database.json';

// ---------------------------------------------------------------------------
// SqliteRepository -- a reusable base class for any single-file SQLite DB.
//
// It handles three things:
//   1. Loading the sql.js WebAssembly engine
//   2. Downloading the .db file from a URL
//   3. Running parameterised queries and mapping each row to a typed object
// ---------------------------------------------------------------------------

export abstract class SqliteRepository<T> {
  protected database: Database | null = null;

  constructor(
    protected readonly databaseUrl: string,
    protected readonly wasmBinaryUrl: string = databaseConfig.sqlWasmUrl,
  ) {}

  /** Download the database file and prepare the sql.js engine. */
  async init(): Promise<void> {
    if (this.database) return;

    const SqlEngine = await initSqlJs({ locateFile: () => this.wasmBinaryUrl });

    const response = await fetch(this.databaseUrl);
    if (!response.ok) {
      throw new Error(`Failed to download database: ${response.status} ${response.statusText}`);
    }

    const fileBytes = new Uint8Array(await response.arrayBuffer());
    this.database = new SqlEngine.Database(fileBytes);
  }

  /**
   * Run a SQL query and convert each result row into a typed object.
   *
   * @param sql        - The SQL string (use `?` for parameters)
   * @param params     - Values to bind to the `?` placeholders
   * @param mapRow     - A function that converts one raw row into type T
   * @returns            An array of mapped results
   */
  protected query(sql: string, params: BindParams, mapRow: (row: ParamsObject) => T): T[] {
    if (!this.database) throw new Error('Database not initialised -- call init() first');

    const statement = this.database.prepare(sql);
    statement.bind(params);

    const results: T[] = [];
    while (statement.step()) {
      const rawRow = statement.getAsObject();
      results.push(mapRow(rawRow));
    }
    statement.free();

    return results;
  }

  /** Release the database resources. */
  close(): void {
    this.database?.close();
    this.database = null;
  }
}

// ---------------------------------------------------------------------------
// HanjaEntry -- one row from the `hanjas` table.
//
// Each entry describes a single Hanja (Chinese character) used in Korean
// names, including its Korean reading (hangul), stroke count, the five-
// element classification, meaning, radical, and whether it is used as a
// surname character.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// HanjaRepository -- look up Hanja characters from the database.
// ---------------------------------------------------------------------------

export class HanjaRepository extends SqliteRepository<HanjaEntry> {
  constructor() {
    super(databaseConfig.hanja.dbUrl);
  }

  /** Find a single Hanja entry by its character (e.g. "韓"). */
  async findByHanja(hanja: string): Promise<HanjaEntry | null> {
    const rows = this.query(
      `SELECT * FROM hanjas WHERE hanja = ? LIMIT 1`,
      [hanja],
      this.mapRow,
    );
    return rows[0] ?? null;
  }

  /** Find all Hanja entries that share the same Korean reading (e.g. "한"). */
  async findByHangul(hangul: string): Promise<HanjaEntry[]> {
    return this.query(
      `SELECT * FROM hanjas WHERE hangul = ? ORDER BY strokes ASC`,
      [hangul],
      this.mapRow,
    );
  }

  /** Find Hanja characters that are used as surnames for a given reading. */
  async findSurnamesByHangul(hangul: string): Promise<HanjaEntry[]> {
    return this.query(
      `SELECT * FROM hanjas WHERE hangul = ? AND is_surname = 1`,
      [hangul],
      this.mapRow,
    );
  }

  /** Find all Hanja whose stroke count falls within [min, max]. */
  async findByStrokeRange(min: number, max: number): Promise<HanjaEntry[]> {
    return this.query(
      `SELECT * FROM hanjas WHERE strokes BETWEEN ? AND ? ORDER BY strokes ASC`,
      [min, max],
      this.mapRow,
    );
  }

  // ---- Row mapping --------------------------------------------------------
  //
  // sql.js returns every column as a generic value. We convert each field
  // explicitly so the types are clear and predictable.

  private mapRow = (row: ParamsObject): HanjaEntry => ({
    id:               Number(row.id),
    hangul:           String(row.hangul),
    hanja:            String(row.hanja),
    onset:            String(row.onset),
    nucleus:          String(row.nucleus),
    strokes:          Number(row.strokes),
    stroke_element:   String(row.stroke_element),
    resource_element: String(row.resource_element),
    meaning:          String(row.meaning),
    radical:          String(row.radical),
    is_surname:       row.is_surname === 1,
  });
}
