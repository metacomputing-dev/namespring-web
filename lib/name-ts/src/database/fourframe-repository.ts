import { SqliteRepository } from './hanja-repository.js';
import databaseConfig from '../../config/database.json';

// ---------------------------------------------------------------------------
// FourframeMeaningEntry -- one row from the `sagyeoksu_meanings` table.
//
// A "four-frame number" (사격수, sagyeoksu) is a numerological value derived
// from a person's name. Each number (1 -- 81) has an associated meaning that
// covers personality, career aptitude, life stages, and overall fortune.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FourframeRepository -- look up four-frame meanings from the database.
// ---------------------------------------------------------------------------

export class FourframeRepository extends SqliteRepository<FourframeMeaningEntry> {
  constructor() {
    super(databaseConfig.fourframe.dbUrl);
  }

  /** Find the meaning entry for a specific four-frame number. */
  async findByNumber(num: number): Promise<FourframeMeaningEntry | null> {
    const rows = this.query(
      `SELECT * FROM sagyeoksu_meanings WHERE number = ? LIMIT 1`,
      [num],
      this.mapRow,
    );
    return rows[0] ?? null;
  }

  /** Retrieve all meaning entries, ordered by number. */
  async findAll(limit = 200): Promise<FourframeMeaningEntry[]> {
    return this.query(
      `SELECT * FROM sagyeoksu_meanings ORDER BY number ASC LIMIT ?`,
      [limit],
      this.mapRow,
    );
  }

  // ---- Row mapping --------------------------------------------------------
  //
  // sql.js returns every column as a generic value. We convert each field
  // individually, handling three cases:
  //   - required strings / numbers  -->  String() or Number() with fallback
  //   - nullable text columns       -->  null when the value is empty or absent
  //   - JSON-encoded arrays         -->  parsed into string[]

  private mapRow = (row: Record<string, unknown>): FourframeMeaningEntry => ({
    id:                       this.toRequiredNumber(row.id),
    number:                   this.toRequiredNumber(row.number),
    title:                    this.toRequiredString(row.title),
    summary:                  this.toRequiredString(row.summary),
    detailed_explanation:     this.toNullableString(row.detailed_explanation),
    positive_aspects:         this.toNullableString(row.positive_aspects),
    caution_points:           this.toNullableString(row.caution_points),
    personality_traits:       this.parseJsonStringArray(row.personality_traits),
    suitable_career:          this.parseJsonStringArray(row.suitable_career),
    life_period_influence:    this.toNullableString(row.life_period_influence),
    special_characteristics:  this.toNullableString(row.special_characteristics),
    challenge_period:         this.toNullableString(row.challenge_period),
    opportunity_area:         this.toNullableString(row.opportunity_area),
    lucky_level:              this.toNullableString(row.lucky_level),
  });

  // ---- Type-conversion helpers --------------------------------------------

  /** Convert a raw database value to a number, defaulting to 0. */
  private toRequiredNumber(value: unknown): number {
    return Number(value ?? 0);
  }

  /** Convert a raw database value to a string, defaulting to ''. */
  private toRequiredString(value: unknown): string {
    return String(value ?? '');
  }

  /**
   * Convert a raw database value to a string, or null if it is missing/empty.
   *
   * Many text columns in the database are optional. SQLite stores them as
   * either NULL or an empty string. We normalise both to `null`.
   */
  private toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value);
    return text.length > 0 ? text : null;
  }

  /**
   * Parse a JSON-encoded array of strings from a database column.
   *
   * The column may contain:
   *   - a JSON string like `'["trait1","trait2"]'`  -->  parsed normally
   *   - an already-parsed array (in some sql.js modes)  -->  returned as-is
   *   - null / undefined  -->  empty array
   */
  private parseJsonStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((element) => String(element));

    try {
      const parsed = JSON.parse(String(value));
      if (Array.isArray(parsed)) return parsed.map((element) => String(element));
      return [];
    } catch {
      return [];
    }
  }
}
