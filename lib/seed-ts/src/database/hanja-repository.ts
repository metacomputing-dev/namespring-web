import { type Database } from 'sql.js';
import type { DatabaseAssetManifestEntry } from './database-asset-contract.js';
import { HANJA_DATABASE_ASSET } from './database-asset-registry.js';
import { openVerifiedRepositoryDatabase } from './repository-database-opener.js';
import { awaitActiveRepositoryStep } from './repository-lifecycle.js';
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
import { decomposeHangulSyllable } from '../utils/hangul-name-entry.js';

const HANJA_ELEMENTS = new Set(['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const);

export interface HanjaEntry {
  readonly id: number;
  readonly hangul: string;
  readonly hanja: string;
  readonly onset: string;
  readonly nucleus: string;
  readonly strokes: number;
  readonly stroke_element: string;
  readonly resource_element: string;
  readonly meaning: string;
  readonly radical: string;
  readonly is_surname: boolean;
}

export interface HanjaRepositoryOptions extends RepositoryWasmOptions {
  readonly dbUrl?: string;
  readonly databaseIntegrity?: RepositoryDatabaseIntegrityPolicy;
}

/**
 * Browser-compatible Data Access Object using sql.js (WASM).
 * Maintains the same API signature as the original Node-based DAO.
 */
export class HanjaRepository {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;
  // Public URL for the database file
  private readonly dbUrl: string;
  // WASM binary location (using CDN for simplicity, or can be local in public/)
  private readonly wasmUrl: string;
  private readonly wasmSha256: string | null;
  private readonly runtime: RepositoryRuntime;
  private readonly databaseContract: DatabaseAssetManifestEntry;

  public constructor(options: HanjaRepositoryOptions = {}) {
    const wasm = resolveRepositoryWasm(options);
    this.dbUrl = options.dbUrl ?? resolvePublicAssetUrl('data/hanja.db');
    this.wasmUrl = wasm.url;
    this.wasmSha256 = wasm.sha256;
    this.runtime = createRepositoryRuntime(options);
    this.databaseContract = resolveRepositoryDatabaseContract(
      options.databaseIntegrity,
      HANJA_DATABASE_ASSET,
    );
  }

  private cancellationError(): Error {
    return new Error('HanjaRepository initialization was cancelled by close().');
  }

  private assertActive(generation: number): void {
    if (generation !== this.lifecycleGeneration) throw this.cancellationError();
  }

  /**
   * Async initialization to load WASM and the DB file.
   * This must be called before calling any search methods.
   */
  public init(): Promise<void> {
    if (this.db) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    const generation = this.lifecycleGeneration;
    let trackedPromise: Promise<void>;
    trackedPromise = this.initialize(generation)
      .then(() => {
        this.assertActive(generation);
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
    const assertActive = (): void => this.assertActive(generation);
    const SQL = await awaitActiveRepositoryStep(
      () => this.runtime.initializeSqlJs(this.wasmUrl, this.wasmSha256),
      assertActive,
    );

    const response = await awaitActiveRepositoryStep(
      () => this.runtime.fetch(this.dbUrl),
      assertActive,
    );
    if (!response.ok) {
      throw new Error('Failed to fetch DB: ' + response.statusText);
    }

    const buffer = await awaitActiveRepositoryStep(
      () => response.arrayBuffer(),
      assertActive,
    );

    let candidate: Database | null = null;
    try {
      candidate = await openVerifiedRepositoryDatabase(
        SQL,
        new Uint8Array(buffer),
        this.databaseContract,
        assertActive,
      );
      assertActive();
    } catch (error) {
      try {
        candidate?.close();
      } catch {
        // Preserve the initialization or cancellation error that won the race.
      }
      if (generation !== this.lifecycleGeneration) throw this.cancellationError();
      throw error;
    }
    if (this.db) {
      candidate.close();
      return;
    }

    this.db = candidate;
  }

  public async findByHanja(hanja: string): Promise<HanjaEntry | null> {
    const sql = `SELECT * FROM hanjas WHERE hanja = ? ORDER BY id ASC LIMIT 1`;
    const rows = this.execute(sql, [hanja]);
    return rows.length > 0 ? rows[0] : null;
  }

  public async findByHangul(hangul: string): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE hangul = ? ORDER BY strokes ASC, id ASC`;
    return this.execute(sql, [hangul]);
  }

  public async findSurnamesByHangul(hangul: string): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE hangul = ? AND is_surname = 1 ORDER BY id ASC`;
    return this.execute(sql, [hangul]);
  }

  public async findByResourceElement(element: string, hangul?: string): Promise<HanjaEntry[]> {
    let sql = `SELECT * FROM hanjas WHERE resource_element = ?`;
    const params: any[] = [element];

    if (hangul) {
      sql += ` AND hangul = ?`;
      params.push(hangul);
    }
    sql += ` ORDER BY id ASC`;
    return this.execute(sql, params);
  }

  public async findByStrokeRange(min: number, max: number): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE strokes BETWEEN ? AND ? ORDER BY strokes ASC, id ASC`;
    return this.execute(sql, [min, max]);
  }

  public async findByOnset(onset: string): Promise<HanjaEntry[]> {
    const sql = `SELECT * FROM hanjas WHERE onset = ? ORDER BY id ASC LIMIT 200`;
    return this.execute(sql, [onset]);
  }

  /**
   * Internal helper to execute queries and map results.
   */
  private execute(sql: string, params: any[]): HanjaEntry[] {
    if (!this.db) throw new Error("Database not initialized. Call init() first.");
    
    const stmt = this.db.prepare(sql);
    const results: HanjaEntry[] = [];
    try {
      stmt.bind(params);
      while (stmt.step()) {
        results.push(this.mapRowToEntry(stmt.getAsObject()));
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  private mapRowToEntry(row: Record<string, unknown>): HanjaEntry {
    const decoder = new RepositoryRowDecoder('hanja', row);
    const hangul = decoder.string('hangul');
    const hangulCharacters = Array.from(hangul);
    const hangulParts = hangulCharacters.length === 1
      ? decomposeHangulSyllable(hangulCharacters[0])
      : null;
    if (!hangulParts) {
      return decoder.fail(
        decoder.path('hangul'),
        'expected one precomposed Hangul syllable',
      );
    }
    if (!/^[\uAC00-\uD7A3]$/u.test(hangul)) {
      decoder.fail(decoder.path('hangul'), 'expected one precomposed Hangul syllable');
    }

    const hanja = decoder.string('hanja');
    if (Array.from(hanja).length !== 1 || !/^\p{Script=Han}$/u.test(hanja)) {
      decoder.fail(decoder.path('hanja'), 'expected one Han ideograph');
    }

    const onset = decoder.string('onset');
    if (onset !== hangulParts.onset) {
      decoder.fail(decoder.path('onset'), 'did not match the Hangul syllable onset');
    }
    const nucleus = decoder.string('nucleus');
    if (nucleus !== hangulParts.nucleus) {
      decoder.fail(decoder.path('nucleus'), 'did not match the Hangul syllable nucleus');
    }

    const isSurname = decoder.integer('is_surname', { min: 0, max: 1 });
    return {
      id: decoder.integer('id', { min: 1 }),
      hangul,
      hanja,
      onset,
      nucleus,
      strokes: decoder.integer('strokes', { min: 1 }),
      stroke_element: decoder.enumString('stroke_element', HANJA_ELEMENTS),
      resource_element: decoder.enumString('resource_element', HANJA_ELEMENTS),
      meaning: decoder.string('meaning'),
      radical: decoder.string('radical', { allowEmpty: true }),
      is_surname: isSurname === 1,
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
