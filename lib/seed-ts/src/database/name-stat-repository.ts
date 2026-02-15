import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

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

export interface NameGenderRatioEntry {
  readonly maleBirths: number;
  readonly femaleBirths: number;
  readonly totalBirths: number;
  readonly maleRatio: number;
  readonly femaleRatio: number;
}

type ShardKey =
  | 'ㄱ' | 'ㄴ' | 'ㄷ' | 'ㄹ' | 'ㅁ' | 'ㅂ' | 'ㅅ'
  | 'ㅇ' | 'ㅈ' | 'ㅊ' | 'ㅋ' | 'ㅌ' | 'ㅍ' | 'ㅎ';

/**
 * Browser-compatible repository for sharded name statistics DBs.
 * Loads only the shard needed by the first character's choseong.
 */
export class NameStatRepository {
  private readonly wasmUrl: string = 'https://sql.js.org/dist/sql-wasm.wasm';
  private readonly shardBaseUrl: string = '/data/name-stat-shards';
  private sqlInstance: SqlJsStatic | null = null;
  private readonly dbByShard = new Map<ShardKey, Database>();

  private readonly shardFileByKey: Record<ShardKey, string> = {
    'ㄱ': '01.db',
    'ㄴ': '02.db',
    'ㄷ': '03.db',
    'ㄹ': '04.db',
    'ㅁ': '05.db',
    'ㅂ': '06.db',
    'ㅅ': '07.db',
    'ㅇ': '08.db',
    'ㅈ': '09.db',
    'ㅊ': '10.db',
    'ㅋ': '11.db',
    'ㅌ': '12.db',
    'ㅍ': '13.db',
    'ㅎ': '14.db',
  };

  /**
   * Optional eager init. DB shards remain lazy-loaded.
   */
  public async init(): Promise<void> {
    await this.ensureSqlReady();
  }

  /**
   * Finds name statistics from the proper shard selected by first character choseong.
   */
  public async findByName(name: string): Promise<NameStatEntry | null> {
    const normalizedName = name?.trim();
    if (!normalizedName) return null;

    const shardKey = this.getShardKeyByName(normalizedName);
    if (!shardKey) return null;
    const db = await this.ensureShardLoaded(shardKey);

    const stmt = db.prepare(`SELECT * FROM name_stats WHERE name = ? LIMIT 1`);
    stmt.bind([normalizedName]);

    try {
      if (!stmt.step()) return null;
      return this.mapRowToEntry(stmt.getAsObject());
    } finally {
      stmt.free();
    }
  }

  public close(): void {
    for (const db of this.dbByShard.values()) {
      db.close();
    }
    this.dbByShard.clear();
  }

  private async ensureSqlReady(): Promise<SqlJsStatic> {
    if (this.sqlInstance) return this.sqlInstance;

    this.sqlInstance = await initSqlJs({
      locateFile: () => this.wasmUrl,
    });

    return this.sqlInstance;
  }

  private async ensureShardLoaded(shardKey: ShardKey): Promise<Database> {
    const cached = this.dbByShard.get(shardKey);
    if (cached) return cached;

    const SQL = await this.ensureSqlReady();
    const filename = this.shardFileByKey[shardKey];
    const url = `${this.shardBaseUrl}/${encodeURIComponent(filename)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch shard DB (${filename}): ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buffer));
    this.dbByShard.set(shardKey, db);
    return db;
  }

  private getShardKeyByName(name: string): ShardKey | null {
    const firstChar = name[0];
    const choseong = this.extractChoseong(firstChar);
    if (!choseong) return null;

    if (choseong === 'ㄲ') return 'ㄱ';
    if (choseong === 'ㄸ') return 'ㄷ';
    if (choseong === 'ㅃ') return 'ㅂ';
    if (choseong === 'ㅆ') return 'ㅅ';
    if (choseong === 'ㅉ') return 'ㅈ';

    const base = choseong as ShardKey;
    if (base in this.shardFileByKey) return base;
    return null;
  }

  private extractChoseong(char: string): string | null {
    if (!char) return null;
    const code = char.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return null;

    const CHOSEONG_LIST = [
      'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
      'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
    ] as const;

    const index = Math.floor((code - 0xac00) / 588);
    return CHOSEONG_LIST[index] ?? null;
  }

  private mapRowToEntry(row: Record<string, unknown>): NameStatEntry {
    return {
      name: String(row.name ?? ''),
      first_char: String(row.first_char ?? ''),
      first_choseong: String(row.first_choseong ?? ''),
      similar_names: this.parseJsonArray(row.similar_names_json),
      yearly_rank: this.parseNestedNumberObject(row.yearly_rank_json),
      yearly_birth: this.parseNestedNumberObject(row.yearly_birth_json),
      hanja_combinations: this.parseJsonArray(row.hanja_combinations_json),
      raw_entry: this.parseJsonObject(row.raw_entry_json),
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

  private parseNestedNumberObject(value: unknown): Record<string, Record<string, number>> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(String(value));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

      const out: Record<string, Record<string, number>> = {};
      const flatBucket: Record<string, number> = {};
      for (const [key, bucket] of Object.entries(parsed as Record<string, unknown>)) {
        // Handle flat map shape: { "2015": 1, "2016": 2 }
        const flatYear = Number(key);
        const flatNum = Number(bucket);
        if (!Number.isNaN(flatYear) && !Number.isNaN(flatNum)) {
          flatBucket[key] = flatNum;
          continue;
        }

        if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue;
        out[key] = {};
        for (const [year, num] of Object.entries(bucket as Record<string, unknown>)) {
          const n = Number(num);
          if (!Number.isNaN(n)) out[key][year] = n;
        }
      }

      if (Object.keys(flatBucket).length) {
        const existing = out['전체'] || {};
        out['전체'] = { ...existing, ...flatBucket };
      }

      return out;
    } catch {
      return {};
    }
  }

  public async findGenderRatioByName(name: string): Promise<NameGenderRatioEntry | null> {
    const stat = await this.findByName(name);
    if (!stat) return null;

    const maleBirths = this.sumBirthsByBucket(stat.yearly_birth, ['남자', '남']);
    const femaleBirths = this.sumBirthsByBucket(stat.yearly_birth, ['여자', '여']);
    const totalBirths = maleBirths + femaleBirths;

    if (totalBirths <= 0) {
      return {
        maleBirths: 0,
        femaleBirths: 0,
        totalBirths: 0,
        maleRatio: 0,
        femaleRatio: 0,
      };
    }

    return {
      maleBirths,
      femaleBirths,
      totalBirths,
      maleRatio: maleBirths / totalBirths,
      femaleRatio: femaleBirths / totalBirths,
    };
  }

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

  private sumBirthsByBucket(
    yearlyBirth: Record<string, Record<string, number>>,
    bucketNames: string[]
  ): number {
    let total = 0;
    for (const bucketName of bucketNames) {
      const bucket = yearlyBirth?.[bucketName];
      if (!bucket || typeof bucket !== 'object') continue;
      for (const value of Object.values(bucket)) {
        const n = Number(value);
        if (!Number.isNaN(n)) total += n;
      }
    }
    return total;
  }
}
