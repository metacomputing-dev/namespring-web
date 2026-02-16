import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import databaseConfig from '../../config/database.json';
import koreanPhonetics from '../../config/korean-phonetics.json';

// ---------------------------------------------------------------------------
// Configuration loaded from JSON files
// ---------------------------------------------------------------------------

/** Ordered list of all 19 Korean initial consonants (choseong / 초성). */
const CHOSEONG_LIST: readonly string[] = koreanPhonetics.choseong;

/**
 * Maps double (tense) consonants to their base single consonant.
 * For example: "ㄲ" --> "ㄱ", "ㄸ" --> "ㄷ"
 *
 * This is used because name-stat database shards are grouped by single
 * consonants only -- names starting with "ㄲ" are stored in the "ㄱ" shard.
 */
const DOUBLE_CONSONANT_TO_BASE: Record<string, string> = koreanPhonetics.doubleConsonantToBase;

/** Mapping from each single consonant to its shard database filename. */
const SHARD_FILE_BY_CONSONANT: Record<string, string> = databaseConfig.nameStat.shardFileMapping;

/** Base URL where the shard .db files are hosted. */
const SHARD_BASE_URL: string = databaseConfig.nameStat.shardBaseUrl;

/** URL to the sql.js WebAssembly binary. */
const WASM_BINARY_URL: string = databaseConfig.sqlWasmUrl;

/** Unicode constants for decomposing Hangul syllables. */
const HANGUL_BASE_CODE  = koreanPhonetics.hangulUnicode.base;           // 0xAC00 = 44032
const HANGUL_END_CODE   = koreanPhonetics.hangulUnicode.end;            // 0xD7A3 = 55203
const SYLLABLES_PER_ONSET = koreanPhonetics.hangulUnicode.syllablesPerOnset; // 588

// ---------------------------------------------------------------------------
// NameStatEntry -- statistics about a given name.
//
// The name_stats table stores popularity data for Korean given names,
// including yearly birth rankings by gender, similar-sounding names,
// and associated Hanja (Chinese character) combinations.
// ---------------------------------------------------------------------------

export interface NameStatEntry {
  readonly name: string;
  readonly first_char: string;
  readonly first_choseong: string;
  readonly similar_names: string[];
  readonly yearly_rank: Record<string, Record<string, number>>;
  readonly yearly_birth: Record<string, Record<string, number>>;
  readonly hanja_combinations: string[];
  readonly raw_entry: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// NameGenderRatioEntry -- how many males vs. females share a given name.
// ---------------------------------------------------------------------------

export interface NameGenderRatioEntry {
  readonly maleBirths: number;
  readonly femaleBirths: number;
  readonly totalBirths: number;
  readonly maleRatio: number;
  readonly femaleRatio: number;
}

// ---------------------------------------------------------------------------
// Valid shard keys -- the 14 single consonants used as shard identifiers.
// ---------------------------------------------------------------------------

type ShardKey =
  | 'ㄱ' | 'ㄴ' | 'ㄷ' | 'ㄹ' | 'ㅁ' | 'ㅂ' | 'ㅅ'
  | 'ㅇ' | 'ㅈ' | 'ㅊ' | 'ㅋ' | 'ㅌ' | 'ㅍ' | 'ㅎ';

// ---------------------------------------------------------------------------
// NameStatRepository -- look up name statistics from sharded databases.
//
// The data is split across 14 SQLite files, one per initial consonant.
// When a name is queried, only the relevant shard is downloaded and cached.
// ---------------------------------------------------------------------------

export class NameStatRepository {
  private sqlEngine: SqlJsStatic | null = null;
  private readonly loadedShards = new Map<ShardKey, Database>();

  // ---- Public API ---------------------------------------------------------

  /** Pre-load the sql.js WebAssembly engine (shard files are loaded on demand). */
  public async init(): Promise<void> {
    await this.ensureSqlEngineReady();
  }

  /**
   * Look up statistics for a Korean given name.
   *
   * Steps:
   *   1. Figure out which shard holds this name (based on its first consonant)
   *   2. Download that shard if we have not already
   *   3. Query the shard for the name
   *   4. Convert the raw database row into a typed NameStatEntry
   */
  public async findByName(name: string): Promise<NameStatEntry | null> {
    const trimmedName = name?.trim();
    if (!trimmedName) return null;

    const shardKey = this.determineShardForName(trimmedName);
    if (!shardKey) return null;

    const shardDatabase = await this.ensureShardLoaded(shardKey);

    const statement = shardDatabase.prepare(
      `SELECT * FROM name_stats WHERE name = ? LIMIT 1`,
    );
    statement.bind([trimmedName]);

    try {
      if (!statement.step()) return null;
      return this.mapRowToEntry(statement.getAsObject());
    } finally {
      statement.free();
    }
  }

  /**
   * Calculate the male/female birth ratio for a given name.
   *
   * The yearly_birth data is organised by gender category:
   *   - "남자" or "남"  =  male births per year
   *   - "여자" or "여"  =  female births per year
   *
   * We sum all yearly values for each gender to get the totals, then
   * compute the ratio of each gender relative to the combined total.
   */
  public async findGenderRatioByName(name: string): Promise<NameGenderRatioEntry | null> {
    const nameStats = await this.findByName(name);
    if (!nameStats) return null;

    const maleCategoryNames  = ['남자', '남'];  // Korean labels for "male"
    const femaleCategoryNames = ['여자', '여'];  // Korean labels for "female"

    const maleBirths  = this.sumBirthsAcrossYears(nameStats.yearly_birth, maleCategoryNames);
    const femaleBirths = this.sumBirthsAcrossYears(nameStats.yearly_birth, femaleCategoryNames);
    const totalBirths  = maleBirths + femaleBirths;

    if (totalBirths <= 0) {
      return { maleBirths: 0, femaleBirths: 0, totalBirths: 0, maleRatio: 0, femaleRatio: 0 };
    }

    return {
      maleBirths,
      femaleBirths,
      totalBirths,
      maleRatio:  maleBirths / totalBirths,
      femaleRatio: femaleBirths / totalBirths,
    };
  }

  /** Release all loaded shard databases. */
  public close(): void {
    for (const shardDatabase of this.loadedShards.values()) {
      shardDatabase.close();
    }
    this.loadedShards.clear();
  }

  // ---- sql.js engine management -------------------------------------------

  /** Initialise the sql.js WebAssembly engine (only once). */
  private async ensureSqlEngineReady(): Promise<SqlJsStatic> {
    if (this.sqlEngine) return this.sqlEngine;

    this.sqlEngine = await initSqlJs({
      locateFile: () => WASM_BINARY_URL,
    });

    return this.sqlEngine;
  }

  // ---- Shard loading ------------------------------------------------------

  /**
   * Make sure a particular shard database is downloaded and cached.
   *
   * If the shard has already been loaded into memory, return the cached copy.
   * Otherwise, download the .db file and open it with sql.js.
   */
  private async ensureShardLoaded(shardKey: ShardKey): Promise<Database> {
    const cachedDatabase = this.loadedShards.get(shardKey);
    if (cachedDatabase) return cachedDatabase;

    const sqlEngine = await this.ensureSqlEngineReady();

    const shardFilename = SHARD_FILE_BY_CONSONANT[shardKey];
    const shardUrl = `${SHARD_BASE_URL}/${encodeURIComponent(shardFilename)}`;

    const response = await fetch(shardUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download shard database (${shardFilename}): ${response.status} ${response.statusText}`,
      );
    }

    const fileBytes = new Uint8Array(await response.arrayBuffer());
    const shardDatabase = new sqlEngine.Database(fileBytes);

    this.loadedShards.set(shardKey, shardDatabase);
    return shardDatabase;
  }

  // ---- Consonant / shard resolution ---------------------------------------

  /**
   * Determine which shard holds a given name.
   *
   * Steps:
   *   1. Take the first character of the name (e.g. "민" from "민수")
   *   2. Extract its initial consonant (choseong), e.g. "민" --> "ㅁ"
   *   3. If the consonant is a double (tense) consonant like "ㄲ",
   *      map it to its base single consonant "ㄱ"
   *   4. Return the consonant as a ShardKey, or null if unrecognised
   */
  private determineShardForName(name: string): ShardKey | null {
    const firstCharacter = name[0];
    const initialConsonant = this.extractInitialConsonant(firstCharacter);
    if (!initialConsonant) return null;

    // Double consonants share a shard with their single-consonant base
    const baseConsonant = DOUBLE_CONSONANT_TO_BASE[initialConsonant] ?? initialConsonant;

    if (baseConsonant in SHARD_FILE_BY_CONSONANT) return baseConsonant as ShardKey;
    return null;
  }

  /**
   * Extract the initial consonant (choseong) from a single Hangul syllable.
   *
   * Korean syllables in Unicode are arranged in a mathematical pattern:
   *   syllable code = base (0xAC00) + (onset * 588) + (nucleus * 28) + coda
   *
   * So to get the onset index, we reverse the formula:
   *   onset index = floor( (syllable code - base) / 588 )
   *
   * Then we look up the consonant character from the ordered CHOSEONG_LIST.
   */
  private extractInitialConsonant(character: string): string | null {
    if (!character) return null;

    const unicodeValue = character.charCodeAt(0);
    const isHangulSyllable = unicodeValue >= HANGUL_BASE_CODE && unicodeValue <= HANGUL_END_CODE;
    if (!isHangulSyllable) return null;

    const onsetIndex = Math.floor((unicodeValue - HANGUL_BASE_CODE) / SYLLABLES_PER_ONSET);
    return CHOSEONG_LIST[onsetIndex] ?? null;
  }

  // ---- Row mapping --------------------------------------------------------

  /** Convert a raw database row into a typed NameStatEntry. */
  private mapRowToEntry(row: Record<string, unknown>): NameStatEntry {
    return {
      name:               String(row.name ?? ''),
      first_char:         String(row.first_char ?? ''),
      first_choseong:     String(row.first_choseong ?? ''),
      similar_names:      this.parseJsonStringArray(row.similar_names_json),
      yearly_rank:        this.parseGenderYearData(row.yearly_rank_json),
      yearly_birth:       this.parseGenderYearData(row.yearly_birth_json),
      hanja_combinations: this.parseJsonStringArray(row.hanja_combinations_json),
      raw_entry:          this.parseJsonObject(row.raw_entry_json),
    };
  }

  // ---- JSON parsing helpers -----------------------------------------------

  /**
   * Parse a JSON-encoded array of strings from a database column.
   *
   * Handles three cases:
   *   - Already an array (some sql.js modes auto-parse)  -->  convert items to strings
   *   - A JSON string like '["name1","name2"]'           -->  parse then convert
   *   - null / undefined / invalid                       -->  empty array
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

  /** Parse a JSON string into a plain key-value object. Returns {} on failure. */
  private parseJsonObject(value: unknown): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(String(value));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Parse yearly data that may be stored in two different JSON shapes.
   *
   * Shape A -- nested by gender category:
   *   { "남자": { "2020": 150, "2021": 130 }, "여자": { "2020": 80 } }
   *
   * Shape B -- flat (no gender breakdown, just year -> count):
   *   { "2020": 230, "2021": 190 }
   *
   * Some entries mix both shapes. We handle this by:
   *   1. Walking through every top-level key.
   *   2. If the value is an object  -->  it is a gender category (Shape A).
   *      We store it as-is under that category key.
   *   3. If the value is a number   -->  it is a flat year entry (Shape B).
   *      We collect all such entries and store them under the "전체" (total)
   *      category, merging with any existing "전체" data.
   */
  private parseGenderYearData(value: unknown): Record<string, Record<string, number>> {
    if (!value) return {};

    let parsedJson: Record<string, unknown>;
    try {
      parsedJson = JSON.parse(String(value));
    } catch {
      return {};
    }

    if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) return {};

    const genderCategories: Record<string, Record<string, number>> = {};
    const flatYearEntries: Record<string, number> = {};

    for (const [key, value] of Object.entries(parsedJson)) {
      // --- Case 1: the value is a plain number --> flat year entry -----------
      const numericValue = Number(value);
      const keyIsYear = !Number.isNaN(Number(key));

      if (keyIsYear && !Number.isNaN(numericValue) && (typeof value === 'number' || typeof value === 'string')) {
        flatYearEntries[key] = numericValue;
        continue;
      }

      // --- Case 2: the value is an object --> gender category ----------------
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

      const yearlyCountsForCategory: Record<string, number> = {};
      for (const [year, count] of Object.entries(value as Record<string, unknown>)) {
        const numericCount = Number(count);
        if (!Number.isNaN(numericCount)) {
          yearlyCountsForCategory[year] = numericCount;
        }
      }
      genderCategories[key] = yearlyCountsForCategory;
    }

    // Merge any flat year entries into the "전체" (total) category
    if (Object.keys(flatYearEntries).length > 0) {
      const existingTotal = genderCategories['전체'] ?? {};
      genderCategories['전체'] = { ...existingTotal, ...flatYearEntries };
    }

    return genderCategories;
  }

  // ---- Birth-count summation ----------------------------------------------

  /**
   * Sum all birth counts across every year for the given gender categories.
   *
   * The yearly_birth data is structured as:
   *   { "남자": { "2020": 150, "2021": 130, ... }, "여자": { ... }, ... }
   *
   * Given genderCategoryNames = ["남자", "남"], this method adds up every
   * yearly count under those categories and returns the grand total.
   *
   * @param yearlyBirthData      - The full yearly_birth record from a NameStatEntry
   * @param genderCategoryNames  - Which categories to include (e.g. ["남자", "남"])
   * @returns                      The sum of all birth counts across all years
   */
  private sumBirthsAcrossYears(
    yearlyBirthData: Record<string, Record<string, number>>,
    genderCategoryNames: string[],
  ): number {
    let grandTotal = 0;

    for (const categoryName of genderCategoryNames) {
      const yearlyCounts = yearlyBirthData?.[categoryName];
      if (!yearlyCounts || typeof yearlyCounts !== 'object') continue;

      for (const birthCount of Object.values(yearlyCounts)) {
        const numericCount = Number(birthCount);
        if (!Number.isNaN(numericCount)) {
          grandTotal += numericCount;
        }
      }
    }

    return grandTotal;
  }
}
