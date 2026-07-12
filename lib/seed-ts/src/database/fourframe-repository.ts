import { type Database } from 'sql.js';
import type { DatabaseAssetManifestEntry } from './database-asset-contract.js';
import { FOURFRAME_DATABASE_ASSET } from './database-asset-registry.js';
import { openVerifiedRepositoryDatabase } from './repository-database-opener.js';
import {
  awaitActiveRepositoryStep,
  RepositoryLifecycleCoordinator,
  type RepositoryLifecycleLease,
} from './repository-lifecycle.js';
import {
  resolveRepositoryDatabaseContract,
  type RepositoryDatabaseIntegrityPolicy,
} from './repository-database-policy.js';
import {
  createRepositoryRuntime,
  resolveRepositoryWasm,
  type RepositoryRuntime,
  type RepositoryWasmOptions,
} from './repository-runtime.js';
import { resolvePublicAssetUrl } from './runtime-url.js';
import { RepositoryRowDecoder } from './row-decoder.js';
import { FOURFRAME_LUCKY_LEVELS } from '../fourframe-contract.js';
import type { FourframeMeaningEntry } from '../fourframe-catalog.js';

export type { FourframeMeaningEntry } from '../fourframe-catalog.js';

const FOURFRAME_LUCKY_LEVEL_SET = new Set(FOURFRAME_LUCKY_LEVELS);

export interface FourframeRepositoryOptions extends RepositoryWasmOptions {
  readonly dbUrl?: string;
  readonly databaseIntegrity?: RepositoryDatabaseIntegrityPolicy;
}

/**
 * Browser-compatible DAO for fourframe (사격수리) meanings.
 * Uses sql.js (WASM) and fetches DB from Vite public path.
 */
export class FourframeRepository {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly lifecycle = new RepositoryLifecycleCoordinator();
  private readonly dbUrl: string;
  private readonly wasmUrl: string;
  private readonly wasmSha256: string | null;
  private readonly runtime: RepositoryRuntime;
  private readonly databaseContract: DatabaseAssetManifestEntry;

  public constructor(options: FourframeRepositoryOptions = {}) {
    const wasm = resolveRepositoryWasm(options);
    this.dbUrl = options.dbUrl ?? resolvePublicAssetUrl('data/fourframe.db');
    this.wasmUrl = wasm.url;
    this.wasmSha256 = wasm.sha256;
    this.runtime = createRepositoryRuntime(options);
    this.databaseContract = resolveRepositoryDatabaseContract(
      options.databaseIntegrity,
      FOURFRAME_DATABASE_ASSET,
    );
  }

  private cancellationError(): Error {
    return new Error('FourframeRepository initialization was cancelled by close().');
  }

  private assertActive(generation: number): void {
    this.lifecycle.assertActive(generation, () => this.cancellationError());
  }

  public init(): Promise<void> {
    if (this.db) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    const lease = this.lifecycle.beginLease();
    const generation = lease.generation;
    let trackedPromise: Promise<void>;
    trackedPromise = this.initialize(lease)
      .then(() => {
        this.assertActive(generation);
      })
      .finally(() => {
        lease.release();
        if (this.initPromise === trackedPromise) {
          this.initPromise = null;
        }
      });
    this.initPromise = trackedPromise;
    return trackedPromise;
  }

  private async initialize(lease: RepositoryLifecycleLease): Promise<void> {
    const { generation, signal } = lease;
    const assertActive = (): void => this.assertActive(generation);
    const SQL = await awaitActiveRepositoryStep(
      () => this.runtime.initializeSqlJs(
        this.wasmUrl,
        this.wasmSha256,
        { signal },
      ),
      assertActive,
      signal,
    );

    const response = await awaitActiveRepositoryStep(
      () => this.runtime.fetch(this.dbUrl, { signal }),
      assertActive,
      signal,
    );
    if (!response.ok) {
      throw new Error(
        'Failed to fetch DB: ' + response.status + ' ' + response.statusText,
      );
    }

    const buffer = await awaitActiveRepositoryStep(
      () => response.arrayBuffer(),
      assertActive,
      signal,
    );

    let candidate: Database | null = null;
    try {
      candidate = await openVerifiedRepositoryDatabase(
        SQL,
        new Uint8Array(buffer),
        this.databaseContract,
        assertActive,
        signal,
      );
      assertActive();
    } catch (error) {
      try {
        candidate?.close();
      } catch {
        // Preserve the initialization or cancellation error that won the race.
      }
      this.assertActive(generation);
      throw error;
    }
    if (this.db) {
      candidate.close();
      return;
    }

    this.db = candidate;
  }

  public async findByNumber(number: number): Promise<FourframeMeaningEntry | null> {
    const rows = this.execute(
      `SELECT * FROM sagyeoksu_meanings WHERE number = ? LIMIT 1`,
      [number]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  public async findByLuckyLevel(luckyLevel: string): Promise<FourframeMeaningEntry[]> {
    return this.execute(
      `SELECT * FROM sagyeoksu_meanings WHERE lucky_level = ? ORDER BY number ASC`,
      [luckyLevel]
    );
  }

  public async searchByTitleOrSummary(keyword: string, limit = 100): Promise<FourframeMeaningEntry[]> {
    const normalized = `%${keyword.trim()}%`;
    return this.execute(
      `SELECT * FROM sagyeoksu_meanings
       WHERE title LIKE ? OR summary LIKE ?
       ORDER BY number ASC
       LIMIT ?`,
      [normalized, normalized, limit]
    );
  }

  public async findAll(limit = 200): Promise<FourframeMeaningEntry[]> {
    return this.execute(
      `SELECT * FROM sagyeoksu_meanings ORDER BY number ASC LIMIT ?`,
      [limit]
    );
  }

  private execute(sql: string, params: Array<string | number>): FourframeMeaningEntry[] {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }

    const stmt = this.db.prepare(sql);
    const rows: FourframeMeaningEntry[] = [];
    try {
      stmt.bind(params);
      while (stmt.step()) {
        rows.push(this.mapRow(stmt.getAsObject()));
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  private mapRow(row: Record<string, unknown>): FourframeMeaningEntry {
    const decoder = new RepositoryRowDecoder('fourframe', row);
    return {
      id: decoder.integer('id', { min: 1 }),
      number: decoder.integer('number', { min: 1, max: 81 }),
      title: decoder.string('title'),
      summary: decoder.string('summary'),
      detailed_explanation: decoder.string('detailed_explanation'),
      positive_aspects: decoder.string('positive_aspects'),
      caution_points: decoder.string('caution_points'),
      personality_traits: decoder.jsonStringArray('personality_traits'),
      suitable_career: decoder.jsonStringArray('suitable_career'),
      life_period_influence: decoder.string('life_period_influence'),
      special_characteristics: decoder.string('special_characteristics'),
      challenge_period: decoder.string('challenge_period'),
      opportunity_area: decoder.string('opportunity_area'),
      lucky_level: decoder.enumString('lucky_level', FOURFRAME_LUCKY_LEVEL_SET),
    };
  }

  public close(): void {
    const cancellation = this.lifecycle.beginCancellation();
    this.initPromise = null;

    const db = this.db;
    this.db = null;
    const closeErrors = cancellation.abortAll(this.cancellationError());
    try {
      db?.close();
    } catch (error) {
      closeErrors.push(error);
    }
    if (closeErrors.length === 1) throw closeErrors[0];
    if (closeErrors.length > 1) {
      throw new AggregateError(
        closeErrors,
        'FourframeRepository failed to cancel or close its resources.',
      );
    }
  }
}
