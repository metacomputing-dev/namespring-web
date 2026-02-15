import type { ParamsObject, SqlValue } from 'sql.js';
import { SqliteRepository } from './hanja-repository.js';

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

export class FourframeRepository extends SqliteRepository<FourframeMeaningEntry> {
  constructor() {
    super('/data/fourframe.db');
  }

  async findByNumber(num: number): Promise<FourframeMeaningEntry | null> {
    const rows = this.query(`SELECT * FROM sagyeoksu_meanings WHERE number = ? LIMIT 1`, [num], this.mapRow);
    return rows[0] ?? null;
  }

  async findByLuckyLevel(luckyLevel: string): Promise<FourframeMeaningEntry[]> {
    return this.query(`SELECT * FROM sagyeoksu_meanings WHERE lucky_level = ? ORDER BY number ASC`, [luckyLevel], this.mapRow);
  }

  async searchByTitleOrSummary(keyword: string, limit = 100): Promise<FourframeMeaningEntry[]> {
    const p = `%${keyword.trim()}%`;
    return this.query(`SELECT * FROM sagyeoksu_meanings WHERE title LIKE ? OR summary LIKE ? ORDER BY number ASC LIMIT ?`, [p, p, limit], this.mapRow);
  }

  async findAll(limit = 200): Promise<FourframeMeaningEntry[]> {
    return this.query(`SELECT * FROM sagyeoksu_meanings ORDER BY number ASC LIMIT ?`, [limit], this.mapRow);
  }

  private mapRow = (row: ParamsObject): FourframeMeaningEntry => ({
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
  });

  private parseJsonArray(value: SqlValue): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v));
    try {
      const p = JSON.parse(String(value));
      return Array.isArray(p) ? p.map((v: unknown) => String(v)) : [];
    } catch {
      return [];
    }
  }

  private toNullableString(value: SqlValue): string | null {
    if (value == null) return null;
    const s = String(value);
    return s.length > 0 ? s : null;
  }
}
