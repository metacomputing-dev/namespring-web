import { type Database, type SqlJsStatic } from 'sql.js';
import {
  createRepositoryRuntime,
  resolveRepositoryWasm,
  type RepositoryRuntime,
  type RepositoryWasmOptions,
} from './repository-runtime.js';
import { resolvePublicAssetUrl } from './runtime-url.js';
import { RepositoryRowDecoder } from './row-decoder.js';

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

export interface NameStatRepositoryOptions extends RepositoryWasmOptions {
  readonly shardBaseUrl?: string;
}

type ShardKey =
  | 'ㄱ' | 'ㄴ' | 'ㄷ' | 'ㄹ' | 'ㅁ' | 'ㅂ' | 'ㅅ'
  | 'ㅇ' | 'ㅈ' | 'ㅊ' | 'ㅋ' | 'ㅌ' | 'ㅍ' | 'ㅎ';

/**
 * Browser-compatible repository for sharded name statistics DBs.
 * Loads only the shard needed by the first character's choseong.
 */
export class NameStatRepository {
  private readonly wasmUrl: string;
  private readonly wasmSha256: string | null;
  private readonly shardBaseUrl: string;
  private readonly runtime: RepositoryRuntime;
  private sqlInstance: SqlJsStatic | null = null;
  private sqlInitPromise: Promise<SqlJsStatic> | null = null;
  private readonly dbByShard = new Map<ShardKey, Database>();
  private readonly shardLoadPromiseByKey = new Map<ShardKey, Promise<Database>>();
  private lifecycleGeneration = 0;

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

  public constructor(options: NameStatRepositoryOptions = {}) {
    const wasm = resolveRepositoryWasm(options);
    this.wasmUrl = wasm.url;
    this.wasmSha256 = wasm.sha256;
    this.shardBaseUrl = options.shardBaseUrl
      ?? resolvePublicAssetUrl('data/name-stat-shards');
    this.runtime = createRepositoryRuntime(options);
  }

  /**
   * Optional eager init. DB shards remain lazy-loaded.
   */
  public async init(): Promise<void> {
    const generation = this.lifecycleGeneration;
    await this.ensureSqlReady();
    if (generation !== this.lifecycleGeneration) {
      throw new Error('NameStatRepository initialization was cancelled by close().');
    }
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
    try {
      stmt.bind([normalizedName]);
      if (!stmt.step()) return null;
      return this.mapRowToEntry(stmt.getAsObject(), normalizedName);
    } finally {
      stmt.free();
    }
  }

  public close(): void {
    this.lifecycleGeneration += 1;
    this.sqlInstance = null;
    this.sqlInitPromise = null;
    this.shardLoadPromiseByKey.clear();

    for (const db of this.dbByShard.values()) {
      db.close();
    }
    this.dbByShard.clear();
  }

  private ensureSqlReady(): Promise<SqlJsStatic> {
    if (this.sqlInstance) return Promise.resolve(this.sqlInstance);
    if (this.sqlInitPromise) return this.sqlInitPromise;

    const generation = this.lifecycleGeneration;
    let trackedPromise: Promise<SqlJsStatic>;
    trackedPromise = this.runtime.initializeSqlJs(this.wasmUrl, this.wasmSha256)
      .then((SQL) => {
        if (generation !== this.lifecycleGeneration) {
          throw new Error('NameStatRepository initialization was cancelled by close().');
        }
        this.sqlInstance = SQL;
        return SQL;
      })
      .finally(() => {
        if (this.sqlInitPromise === trackedPromise) {
          this.sqlInitPromise = null;
        }
      });
    this.sqlInitPromise = trackedPromise;
    return trackedPromise;
  }

  private ensureShardLoaded(shardKey: ShardKey): Promise<Database> {
    const cached = this.dbByShard.get(shardKey);
    if (cached) return Promise.resolve(cached);
    const loading = this.shardLoadPromiseByKey.get(shardKey);
    if (loading) return loading;

    const generation = this.lifecycleGeneration;
    let trackedPromise: Promise<Database>;
    trackedPromise = this.loadShard(shardKey, generation)
      .then((database) => {
        if (generation !== this.lifecycleGeneration) {
          throw new Error('NameStatRepository shard load was cancelled by close().');
        }
        return database;
      })
      .finally(() => {
        if (this.shardLoadPromiseByKey.get(shardKey) === trackedPromise) {
          this.shardLoadPromiseByKey.delete(shardKey);
        }
      });
    this.shardLoadPromiseByKey.set(shardKey, trackedPromise);
    return trackedPromise;
  }

  private async loadShard(shardKey: ShardKey, generation: number): Promise<Database> {
    const SQL = await this.ensureSqlReady();
    if (generation !== this.lifecycleGeneration) {
      throw new Error('NameStatRepository shard load was cancelled by close().');
    }

    const filename = this.shardFileByKey[shardKey];
    const url = this.shardBaseUrl + '/' + encodeURIComponent(filename);

    const response = await this.runtime.fetch(url);
    if (!response.ok) {
      throw new Error(
        'Failed to fetch shard DB (' + filename + '): '
        + response.status + ' ' + response.statusText,
      );
    }

    const buffer = await response.arrayBuffer();
    const candidate = new SQL.Database(new Uint8Array(buffer));
    if (generation !== this.lifecycleGeneration) {
      candidate.close();
      throw new Error('NameStatRepository shard load was cancelled by close().');
    }

    const existing = this.dbByShard.get(shardKey);
    if (existing) {
      candidate.close();
      return existing;
    }

    this.dbByShard.set(shardKey, candidate);
    return candidate;
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

  private mapRowToEntry(row: Record<string, unknown>, expectedName: string): NameStatEntry {
    const decoder = new RepositoryRowDecoder('name-stat', row);
    decoder.integer('id', { min: 1 });
    const name = decoder.string('name');
    if (name !== expectedName) {
      decoder.fail(decoder.path('name'), 'did not match the requested name');
    }
    const firstChar = decoder.string('first_char');
    if (firstChar !== Array.from(name)[0]) {
      decoder.fail(decoder.path('first_char'), 'did not match the first name syllable');
    }
    const firstChoseong = decoder.string('first_choseong');
    if (firstChoseong !== this.extractChoseong(firstChar)) {
      decoder.fail(decoder.path('first_choseong'), 'did not match the first name syllable');
    }

    return {
      name,
      first_char: firstChar,
      first_choseong: firstChoseong,
      similar_names: decoder.jsonStringArray('similar_names_json'),
      yearly_rank: this.parseNestedNumberObject(decoder, 'yearly_rank_json'),
      yearly_birth: this.parseNestedNumberObject(decoder, 'yearly_birth_json'),
      hanja_combinations: decoder.jsonStringArray('hanja_combinations_json'),
      raw_entry: decoder.jsonObject('raw_entry_json'),
    };
  }

  private parseNestedNumberObject(
    decoder: RepositoryRowDecoder,
    field: string,
  ): Record<string, Record<string, number>> {
    const parsed = decoder.jsonObject(field);
    const entries = Object.entries(parsed);
    const hasFlatValues = entries.some(([, value]) => typeof value === 'number');
    const hasNestedValues = entries.some(([, value]) =>
      typeof value === 'object' && value !== null && !Array.isArray(value));

    if (entries.some(([, value]) =>
      typeof value !== 'number'
      && (typeof value !== 'object' || value === null || Array.isArray(value)))) {
      decoder.fail(decoder.path(field), 'expected numeric years or nested numeric buckets');
    }
    if (hasFlatValues && hasNestedValues) {
      decoder.fail(decoder.path(field), 'mixed flat and nested statistic shapes');
    }

    if (hasFlatValues) {
      const flat: Record<string, number> = {};
      for (const [year, value] of entries) {
        flat[year] = this.decodeStatisticValue(decoder, field, year, value);
      }
      return { ['전체']: flat };
    }

    const out: Record<string, Record<string, number>> = {};
    for (const [bucketName, bucket] of entries) {
      if (bucketName.trim().length === 0) {
        decoder.fail(decoder.path(field), 'contained an empty bucket name');
      }
      const bucketPath = decoder.path(field) + '.' + bucketName;
      if (typeof bucket !== 'object' || bucket === null || Array.isArray(bucket)) {
        decoder.fail(bucketPath, 'expected an object bucket');
      }
      const decodedBucket: Record<string, number> = {};
      for (const [year, value] of Object.entries(bucket as Record<string, unknown>)) {
        decodedBucket[year] = this.decodeStatisticValue(
          decoder,
          field,
          bucketName + '.' + year,
          value,
        );
      }
      out[bucketName] = decodedBucket;
    }
    return out;
  }

  private decodeStatisticValue(
    decoder: RepositoryRowDecoder,
    field: string,
    keyedYear: string,
    value: unknown,
  ): number {
    const year = keyedYear.split('.').at(-1) ?? '';
    if (!/^\d{4}$/u.test(year)) {
      decoder.fail(decoder.path(field) + '.' + keyedYear, 'expected a four-digit year key');
    }
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      decoder.fail(
        decoder.path(field) + '.' + keyedYear,
        'expected a finite non-negative safe integer',
      );
    }
    return value;
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
