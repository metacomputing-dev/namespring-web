import { openSqliteDatabase, type SqliteDatabase } from "../core/sqlite-runtime.js";
import { mapHanjaRow, toCoreElementSymbolFromInput } from "./hanja-mapper.js";
import {
  sqlFindByHanja,
  sqlFindByHangul,
  sqlFindByOnset,
  sqlFindByResourceElement,
  sqlFindByStrokeRange,
  sqlFindSurnameByHangul,
} from "./hanja-sql.js";
import type { HanjaEntry, HanjaRow } from "./hanja-types.js";

export type { HanjaEntry } from "./hanja-types.js";

export class HanjaRepository {
  private readonly db: SqliteDatabase;

  constructor(dbPath: string) {
    this.db = openSqliteDatabase(dbPath);
  }

  // Compatibility: old adapter had async init for WASM
  public async init(): Promise<void> {}

  public async findByHanja(hanja: string): Promise<HanjaEntry | null> {
    const rows = this.query(sqlFindByHanja(), [hanja]);
    return rows[0] ?? null;
  }

  public async findByHangul(hangul: string): Promise<HanjaEntry[]> {
    return this.query(sqlFindByHangul(), [hangul]);
  }

  public async findSurnamesByHangul(hangul: string): Promise<HanjaEntry[]> {
    return this.query(sqlFindSurnameByHangul(), [hangul]);
  }

  public async findByResourceElement(element: string, hangul?: string): Promise<HanjaEntry[]> {
    const coreElementSymbol = toCoreElementSymbolFromInput(element);
    if (hangul && hangul.length > 0) {
      return this.query(sqlFindByResourceElement(true), [coreElementSymbol, hangul]);
    }
    return this.query(sqlFindByResourceElement(false), [coreElementSymbol]);
  }

  public async findByStrokeRange(min: number, max: number): Promise<HanjaEntry[]> {
    return this.query(sqlFindByStrokeRange(), [min, max]);
  }

  public async findByOnset(onset: string): Promise<HanjaEntry[]> {
    return this.query(sqlFindByOnset(), [onset]);
  }

  public close(): void {
    this.db.close?.();
  }

  private query(sql: string, params: readonly unknown[] = []): HanjaEntry[] {
    const rows = this.db.prepare(sql).all(...params) as HanjaRow[];
    return rows.map((row) => mapHanjaRow(row));
  }
}
