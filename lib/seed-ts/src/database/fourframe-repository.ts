import { type Database } from 'sql.js';
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
}

/**
 * Browser-compatible DAO for fourframe (사격수리) meanings.
 * Uses sql.js (WASM) and fetches DB from Vite public path.
 */
export class FourframeRepository {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;
  private readonly dbUrl: string;
  private readonly wasmUrl: string;
  private readonly wasmSha256: string | null;
  private readonly runtime: RepositoryRuntime;

  public constructor(options: FourframeRepositoryOptions = {}) {
    const wasm = resolveRepositoryWasm(options);
    this.dbUrl = options.dbUrl ?? resolvePublicAssetUrl('data/fourframe.db');
    this.wasmUrl = wasm.url;
    this.wasmSha256 = wasm.sha256;
    this.runtime = createRepositoryRuntime(options);
  }

  public init(): Promise<void> {
    if (this.db) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    const generation = this.lifecycleGeneration;
    let trackedPromise: Promise<void>;
    trackedPromise = this.initialize(generation)
      .then(() => {
        if (generation !== this.lifecycleGeneration) {
          throw new Error('FourframeRepository initialization was cancelled by close().');
        }
      })
      .finally(() => {
        if (this.initPromise === trackedPromise) {
          this.initPromise = null;
        }
      });
    this.initPromise = trackedPromise;
    return trackedPromise;
  }

  private async initialize(generation: number): Promise<void> {
    const SQL = await this.runtime.initializeSqlJs(this.wasmUrl, this.wasmSha256);
    if (generation !== this.lifecycleGeneration) {
      throw new Error('FourframeRepository initialization was cancelled by close().');
    }

    const response = await this.runtime.fetch(this.dbUrl);
    if (!response.ok) {
      throw new Error(
        'Failed to fetch DB: ' + response.status + ' ' + response.statusText,
      );
    }
    if (generation !== this.lifecycleGeneration) {
      throw new Error('FourframeRepository initialization was cancelled by close().');
    }

    const buffer = await response.arrayBuffer();
    const candidate = new SQL.Database(new Uint8Array(buffer));
    if (generation !== this.lifecycleGeneration) {
      candidate.close();
      throw new Error('FourframeRepository initialization was cancelled by close().');
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
    this.lifecycleGeneration += 1;
    this.initPromise = null;

    const db = this.db;
    this.db = null;
    db?.close();
  }
}
