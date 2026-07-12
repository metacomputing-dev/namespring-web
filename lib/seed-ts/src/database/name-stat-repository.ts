import { type Database, type SqlJsStatic } from 'sql.js';
import type { DatabaseAssetManifestEntry } from './database-asset-contract.js';
import { NAME_STAT_DATABASE_ASSETS } from './database-asset-registry.js';
import { openVerifiedRepositoryDatabase } from './repository-database-opener.js';
import { awaitActiveRepositoryStep } from './repository-lifecycle.js';
import {
  resolveRepositoryDatabaseShardSet,
  type RepositoryDatabaseShardSetIntegrityPolicy,
} from './repository-database-policy.js';
import {
  createRepositoryRuntime,
  resolveRepositoryWasm,
  type RepositoryRuntime,
  type RepositoryWasmOptions,
} from './repository-runtime.js';
import { resolvePublicAssetUrl } from './runtime-url.js';
import { RepositoryRowDecoder } from './row-decoder.js';
import {
  extractRawNameStatChoseong,
  nameStatShardFilename,
  resolveNameStatShardKey,
  type NameStatShardKey,
} from '../utils/name-stat-shard.js';

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
  readonly databaseIntegrity?: RepositoryDatabaseShardSetIntegrityPolicy;
}

/**
 * Browser-compatible repository for sharded name statistics DBs.
 * Loads only the shard needed by the first character's choseong.
 */
export class NameStatRepository {
  private readonly wasmUrl: string;
  private readonly wasmSha256: string | null;
  private readonly shardBaseUrl: string;
  private readonly runtime: RepositoryRuntime;
  private readonly databaseContractByShard: ReadonlyMap<
    NameStatShardKey,
    DatabaseAssetManifestEntry
  >;
  private sqlInstance: SqlJsStatic | null = null;
  private sqlInitPromise: Promise<SqlJsStatic> | null = null;
  private readonly dbByShard = new Map<NameStatShardKey, Database>();
  private readonly shardLoadPromiseByKey =
    new Map<NameStatShardKey, Promise<Database>>();
  private lifecycleGeneration = 0;

  public constructor(options: NameStatRepositoryOptions = {}) {
    const wasm = resolveRepositoryWasm(options);
    this.wasmUrl = wasm.url;
    this.wasmSha256 = wasm.sha256;
    this.shardBaseUrl = options.shardBaseUrl
      ?? resolvePublicAssetUrl('data/name-stat-shards');
    this.runtime = createRepositoryRuntime(options);
    const contracts = resolveRepositoryDatabaseShardSet(
      options.databaseIntegrity,
      NAME_STAT_DATABASE_ASSETS,
    );
    this.databaseContractByShard = new Map(contracts.map((contract) => [
      contract.shardKey as NameStatShardKey,
      contract,
    ]));
  }

  private cancellationError(): Error {
    return new Error('NameStatRepository initialization was cancelled by close().');
  }

  private assertActive(generation: number): void {
    if (generation !== this.lifecycleGeneration) throw this.cancellationError();
  }

  /**
   * Optional eager init. DB shards remain lazy-loaded.
   */
  public async init(): Promise<void> {
    const generation = this.lifecycleGeneration;
    await this.ensureSqlReady();
    this.assertActive(generation);
  }

  /**
   * Finds name statistics from the proper shard selected by first character choseong.
   */
  public async findByName(name: string): Promise<NameStatEntry | null> {
    const generation = this.lifecycleGeneration;
    const normalizedName = name?.trim();
    if (!normalizedName) return null;

    const shardKey = resolveNameStatShardKey(normalizedName);
    if (!shardKey) return null;
    const db = await this.ensureShardLoaded(shardKey);
    this.assertActive(generation);

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

    const databases = [...this.dbByShard.values()];
    this.dbByShard.clear();
    const closeErrors: unknown[] = [];
    for (const db of databases) {
      try {
        db.close();
      } catch (error) {
        closeErrors.push(error);
      }
    }
    if (closeErrors.length > 0) {
      throw new AggregateError(
        closeErrors,
        'NameStatRepository failed to close one or more shard databases.',
      );
    }
  }

  private ensureSqlReady(): Promise<SqlJsStatic> {
    if (this.sqlInstance) return Promise.resolve(this.sqlInstance);
    if (this.sqlInitPromise) return this.sqlInitPromise;

    const generation = this.lifecycleGeneration;
    const assertActive = (): void => this.assertActive(generation);
    let trackedPromise: Promise<SqlJsStatic>;
    trackedPromise = awaitActiveRepositoryStep(
      () => this.runtime.initializeSqlJs(this.wasmUrl, this.wasmSha256),
      assertActive,
    )
      .then((SQL) => {
        assertActive();
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

  private ensureShardLoaded(shardKey: NameStatShardKey): Promise<Database> {
    const cached = this.dbByShard.get(shardKey);
    if (cached) return Promise.resolve(cached);
    const loading = this.shardLoadPromiseByKey.get(shardKey);
    if (loading) return loading;

    const generation = this.lifecycleGeneration;
    let trackedPromise: Promise<Database>;
    trackedPromise = this.loadShard(shardKey, generation)
      .then((database) => {
        this.assertActive(generation);
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

  private async loadShard(
    shardKey: NameStatShardKey,
    generation: number,
  ): Promise<Database> {
    const assertActive = (): void => this.assertActive(generation);
    const SQL = await awaitActiveRepositoryStep(
      () => this.ensureSqlReady(),
      assertActive,
    );

    const filename = nameStatShardFilename(shardKey);
    const url = this.shardBaseUrl + '/' + encodeURIComponent(filename);

    const response = await awaitActiveRepositoryStep(
      () => this.runtime.fetch(url),
      assertActive,
    );
    if (!response.ok) {
      throw new Error(
        'Failed to fetch shard DB (' + filename + '): '
        + response.status + ' ' + response.statusText,
      );
    }

    const buffer = await awaitActiveRepositoryStep(
      () => response.arrayBuffer(),
      assertActive,
    );
    const contract = this.databaseContractByShard.get(shardKey);
    if (!contract) {
      throw new Error(`NameStatRepository has no integrity contract for shard ${shardKey}.`);
    }

    let candidate: Database | null = null;
    try {
      candidate = await openVerifiedRepositoryDatabase(
        SQL,
        new Uint8Array(buffer),
        contract,
        assertActive,
      );
      assertActive();
    } catch (error) {
      try {
        candidate?.close();
      } catch {
        // Preserve the integrity or cancellation error that won the race.
      }
      if (generation !== this.lifecycleGeneration) throw this.cancellationError();
      throw error;
    }
    if (!candidate) {
      throw new Error(`NameStatRepository failed to open shard ${shardKey}.`);
    }

    const existing = this.dbByShard.get(shardKey);
    if (existing) {
      candidate.close();
      return existing;
    }

    this.dbByShard.set(shardKey, candidate);
    return candidate;
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
    if (firstChoseong !== extractRawNameStatChoseong(firstChar)) {
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
