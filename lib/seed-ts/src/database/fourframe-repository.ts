import type { ParamsObject } from 'sql.js';
import { SqliteRepository } from './hanja-repository.js';

export interface FourframeMeaningEntry {
  readonly number: number;
  readonly lucky_level: string | null;
}

export class FourframeRepository extends SqliteRepository<FourframeMeaningEntry> {
  constructor() {
    super('/data/fourframe.db');
  }

  async findAll(limit = 200): Promise<FourframeMeaningEntry[]> {
    return this.query(`SELECT number, lucky_level FROM sagyeoksu_meanings ORDER BY number ASC LIMIT ?`, [limit], (row: ParamsObject) => ({
      number: Number(row.number ?? 0),
      lucky_level: row.lucky_level != null ? String(row.lucky_level) : null,
    }));
  }
}
