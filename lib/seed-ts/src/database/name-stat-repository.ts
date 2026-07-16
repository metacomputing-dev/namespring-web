import { type Database, type SqlJsStatic } from 'sql.js';
import type { DatabaseAssetManifestEntry } from './database-asset-contract.js';
import { NAME_STAT_DATABASE_ASSETS } from './database-asset-registry.js';
import { openVerifiedRepositoryDatabase } from './repository-database-opener.js';
import {
  awaitActiveRepositoryStep,
  RepositoryLifecycleCoordinator,
  type RepositoryLifecycleLease,
} from './repository-lifecycle.js';
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
import {
  decodeNameStatRow,
  type NameStatEntry,
} from './name-stat-row.js';
import {
  nameStatShardFilename,
  resolveNameStatShardKey,
  type NameStatShardKey,
} from '../utils/name-stat-shard.js';
import { assertRepositoryString } from './repository-query-validation.js';

export type { NameStatEntry } from './name-stat-row.js';

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
  private readonly lifecycle = new RepositoryLifecycleCoordinator();

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
    this.lifecycle.assertActive(generation, () => this.cancellationError());
  }

  /**
   * Optional eager init. DB shards remain lazy-loaded.
   */
  public async init(): Promise<void> {
    const generation = this.lifecycle.currentGeneration;
    await this.ensureSqlReady();
    this.assertActive(generation);
  }

  /**
   * Finds name statistics from the proper shard selected by first character choseong.
   */
  public async findByName(name: string): Promise<NameStatEntry | null> {
    const generation = this.lifecycle.currentGeneration;
    const normalizedName = assertRepositoryString(name, {
      repository: 'name-stat', path: 'name', maximumLength: 64,
    });

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
    const cancellation = this.lifecycle.beginCancellation();
    this.sqlInstance = null;
    this.sqlInitPromise = null;
    this.shardLoadPromiseByKey.clear();

    const databases = [...this.dbByShard.values()];
    this.dbByShard.clear();
    const closeErrors = cancellation.abortAll(this.cancellationError());
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
        'NameStatRepository failed to cancel or close one or more shard resources.',
      );
    }
  }

  private ensureSqlReady(): Promise<SqlJsStatic> {
    if (this.sqlInstance) return Promise.resolve(this.sqlInstance);
    if (this.sqlInitPromise) return this.sqlInitPromise;

    const lease = this.lifecycle.beginLease();
    const { generation, signal } = lease;
    const assertActive = (): void => this.assertActive(generation);
    let trackedPromise: Promise<SqlJsStatic>;
    trackedPromise = awaitActiveRepositoryStep(
      () => this.runtime.initializeSqlJs(
        this.wasmUrl,
        this.wasmSha256,
        { signal },
      ),
      assertActive,
      signal,
    )
      .then((SQL) => {
        assertActive();
        this.sqlInstance = SQL;
        return SQL;
      })
      .finally(() => {
        lease.release();
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

    const lease = this.lifecycle.beginLease();
    const generation = lease.generation;
    let trackedPromise: Promise<Database>;
    trackedPromise = this.loadShard(shardKey, lease)
      .then((database) => {
        this.assertActive(generation);
        return database;
      })
      .finally(() => {
        lease.release();
        if (this.shardLoadPromiseByKey.get(shardKey) === trackedPromise) {
          this.shardLoadPromiseByKey.delete(shardKey);
        }
      });
    this.shardLoadPromiseByKey.set(shardKey, trackedPromise);
    return trackedPromise;
  }

  private async loadShard(
    shardKey: NameStatShardKey,
    lease: RepositoryLifecycleLease,
  ): Promise<Database> {
    const { generation, signal } = lease;
    const assertActive = (): void => this.assertActive(generation);
    const SQL = await awaitActiveRepositoryStep(
      () => this.ensureSqlReady(),
      assertActive,
      signal,
    );

    const filename = nameStatShardFilename(shardKey);
    const url = this.shardBaseUrl + '/' + encodeURIComponent(filename);

    const response = await awaitActiveRepositoryStep(
      () => this.runtime.fetch(url, { signal }),
      assertActive,
      signal,
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
      signal,
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
        signal,
      );
      assertActive();
    } catch (error) {
      try {
        candidate?.close();
      } catch {
        // Preserve the integrity or cancellation error that won the race.
      }
      this.assertActive(generation);
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
    return decodeNameStatRow(row, expectedName);
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
