import { type Database } from 'sql.js';
import { deepFreeze } from '../../../../seed-ts/src/utils/deep-freeze.js';
import {
  createRepositoryRuntime,
  resolveRepositoryWasm,
  type RepositoryRuntime,
  type RepositoryWasmOptions,
} from '../../../../seed-ts/src/database/repository-runtime.js';
import { resolvePublicAssetUrl } from '../../../../seed-ts/src/database/runtime-url.js';
import { verifySha256Digest } from '../../../../seed-ts/src/database/repository-artifact-integrity.js';
import { GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST } from './database-manifest.generated.js';
import {
  NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION,
  NamingEvidenceContractError,
  type NamingEvidenceCatalog,
  type NamingEvidenceConclusionTone,
  type NamingEvidenceFragment,
  type NamingEvidenceRelation,
  type NamingEvidenceSajuAxes,
} from './types.js';

const DATABASE_SCHEMA_VERSION = 'namespring.naming-evidence-db/v2';
const DATABASE_USER_VERSION = 2;
const TONES: ReadonlySet<NamingEvidenceConclusionTone> = new Set([
  'allPositive', 'mostlyPositive', 'mixedButUsable', 'needsCaution', 'insufficientEvidence',
]);
const RELATIONS: ReadonlySet<NamingEvidenceRelation> = new Set([
  'supports', 'limits', 'counterbalances', 'neutral',
]);

export interface NamingEvidenceRepositoryOptions extends RepositoryWasmOptions {
  readonly dbUrl?: string;
}

export const NAMING_EVIDENCE_DATABASE_INTEGRITY_MISMATCH =
  'NAMING_EVIDENCE_DATABASE_INTEGRITY_MISMATCH' as const;

export class NamingEvidenceDatabaseIntegrityError extends Error {
  readonly code = NAMING_EVIDENCE_DATABASE_INTEGRITY_MISMATCH;

  constructor(
    readonly expected: string | number,
    readonly actual: string | number,
    message: string,
  ) {
    super(message);
    this.name = 'NamingEvidenceDatabaseIntegrityError';
  }
}

function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new NamingEvidenceContractError(`database.${field}`, 'expected non-empty text');
  }
  return value;
}

function requiredInteger(row: Record<string, unknown>, field: string, min: number, max: number): number {
  const value = row[field];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new NamingEvidenceContractError(`database.${field}`, `expected an integer from ${min} to ${max}`);
  }
  return value;
}

function enumValue<T extends string>(
  row: Record<string, unknown>,
  field: string,
  allowed: ReadonlySet<T>,
): T {
  const value = requiredString(row, field);
  if (!allowed.has(value as T)) {
    throw new NamingEvidenceContractError(`database.${field}`, `unsupported value ${value}`);
  }
  return value as T;
}

export class NamingEvidenceRepository {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly dbUrl: string;
  private readonly wasmUrl: string;
  private readonly wasmSha256: string | null;
  private readonly runtime: RepositoryRuntime;

  public constructor(options: NamingEvidenceRepositoryOptions = {}) {
    const wasm = resolveRepositoryWasm(options);
    this.dbUrl = options.dbUrl ?? resolvePublicAssetUrl('data/naming-evidence.db');
    this.wasmUrl = wasm.url;
    this.wasmSha256 = wasm.sha256;
    this.runtime = createRepositoryRuntime(options);
  }

  public init(): Promise<void> {
    if (this.db) return Promise.resolve();
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    const SQL = await this.runtime.initializeSqlJs(this.wasmUrl, this.wasmSha256);
    const response = await this.runtime.fetch(this.dbUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch naming evidence DB: ${response.status} ${response.statusText}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer()).slice();
    if (bytes.byteLength !== GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST.byteLength) {
      throw new NamingEvidenceDatabaseIntegrityError(
        GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST.byteLength,
        bytes.byteLength,
        'The naming evidence database byte length does not match its manifest.',
      );
    }
    await verifySha256Digest(bytes, GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST.sha256, {
      cryptoUnavailable: () => new Error('Web Crypto SHA-256 support is required to load naming evidence.'),
      mismatch: (expected, actual) => new NamingEvidenceDatabaseIntegrityError(
        expected,
        actual,
        'The naming evidence database failed SHA-256 verification.',
      ),
    });
    const candidate = new SQL.Database(bytes);
    try {
      this.verifySchema(candidate);
    } catch (error) {
      candidate.close();
      throw error;
    }
    if (this.db) {
      candidate.close();
      return;
    }
    this.db = candidate;
  }

  private verifySchema(db: Database): void {
    const versionResult = db.exec('PRAGMA user_version');
    const userVersion = versionResult[0]?.values[0]?.[0];
    if (userVersion !== DATABASE_USER_VERSION) {
      throw new NamingEvidenceContractError('database.user_version', `expected ${DATABASE_USER_VERSION}`);
    }
    const statement = db.prepare('SELECT value FROM metadata WHERE key = ? LIMIT 1');
    try {
      statement.bind(['schemaVersion']);
      if (!statement.step()) {
        throw new NamingEvidenceContractError('database.metadata.schemaVersion', 'required value is missing');
      }
      const value = statement.getAsObject().value;
      if (value !== DATABASE_SCHEMA_VERSION) {
        throw new NamingEvidenceContractError('database.metadata.schemaVersion', 'unsupported schema version');
      }
    } finally {
      statement.free();
    }
    const contentVersion = this.scalarText(db, 'SELECT value FROM metadata WHERE key = ?', ['contentVersion']);
    if (contentVersion !== GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST.contentVersion) {
      throw new NamingEvidenceContractError('database.metadata.contentVersion', 'manifest content version mismatch');
    }
    const counts = GENERATED_NAMING_EVIDENCE_DATABASE_MANIFEST.rowCounts;
    this.assertRowCount(db, 'saju_axis_explanations', counts.sajuAxisExplanations);
    this.assertRowCount(db, 'source_evidence_explanations', counts.sourceEvidenceExplanations);
    this.assertRowCount(db, 'conclusion_explanations', counts.conclusionExplanations);
    this.assertRowCount(db, 'evidence_connectors', counts.connectors);
  }

  private scalarText(db: Database, sql: string, params: Array<string | number>): string {
    const statement = db.prepare(sql);
    try {
      statement.bind(params);
      if (!statement.step()) throw new NamingEvidenceContractError('database.query', 'required row is missing');
      return requiredString(statement.getAsObject(), 'value');
    } finally {
      statement.free();
    }
  }

  private assertRowCount(db: Database, table: string, expected: number): void {
    const result = db.exec(`SELECT COUNT(*) FROM ${table}`);
    const actual = result[0]?.values[0]?.[0];
    if (actual !== expected) {
      throw new NamingEvidenceContractError(`database.${table}`, `expected ${expected} rows`);
    }
  }

  public findSajuAxis(axes: NamingEvidenceSajuAxes): NamingEvidenceFragment | null {
    const rows = this.query(`
      SELECT fragment_key, plain, detail
      FROM saju_axis_explanations
      WHERE day_master_element = ? AND strength = ?
        AND yongshin_element = ? AND gyeokguk_family = ?
      LIMIT 1
    `, [axes.dayMasterElement, axes.strength, axes.yongshinElement, axes.gyeokgukFamily]);
    return rows.length === 0 ? null : this.axisFragment(rows[0]);
  }

  public findSourceEvidence(sourceId: string, state: string): NamingEvidenceFragment | null {
    if (!sourceId.trim() || !state.trim()) {
      throw new NamingEvidenceContractError('sourceEvidence', 'sourceId and state are required');
    }
    const rows = this.query(`
      SELECT fragment_key, source_id, state, plain, detail
      FROM source_evidence_explanations WHERE source_id = ? AND state = ? LIMIT 1
    `, [sourceId, state]);
    return rows.length === 0 ? null : this.sourceFragment(rows[0]);
  }

  public findConclusion(tone: NamingEvidenceConclusionTone): NamingEvidenceFragment | null {
    if (!TONES.has(tone)) throw new NamingEvidenceContractError('tone', 'unsupported conclusion tone');
    const rows = this.query(`
      SELECT fragment_key, plain, detail
      FROM conclusion_explanations WHERE tone = ? LIMIT 1
    `, [tone]);
    return rows.length === 0 ? null : this.conclusionFragment(rows[0]);
  }

  public loadCatalog(): NamingEvidenceCatalog {
    const fragments: Record<string, NamingEvidenceFragment> = {};
    for (const row of this.query('SELECT fragment_key, plain, detail FROM saju_axis_explanations ORDER BY fragment_key')) {
      const fragment = this.axisFragment(row);
      fragments[fragment.key] = fragment;
    }
    for (const row of this.query('SELECT fragment_key, source_id, state, plain, detail FROM source_evidence_explanations ORDER BY fragment_key')) {
      const fragment = this.sourceFragment(row);
      fragments[fragment.key] = fragment;
    }
    for (const row of this.query('SELECT fragment_key, plain, detail FROM conclusion_explanations ORDER BY fragment_key')) {
      const fragment = this.conclusionFragment(row);
      fragments[fragment.key] = fragment;
    }

    const connectors: Partial<Record<NamingEvidenceRelation, string[]>> = {};
    for (const row of this.query('SELECT relation, variant, text FROM evidence_connectors ORDER BY relation, variant')) {
      const relation = enumValue(row, 'relation', RELATIONS);
      requiredInteger(row, 'variant', 0, Number.MAX_SAFE_INTEGER);
      (connectors[relation] ??= []).push(requiredString(row, 'text'));
    }
    const contentVersion = this.metadataValue('contentVersion');
    return deepFreeze({
      schemaVersion: NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION,
      contentVersion,
      fragments,
      connectors,
    });
  }

  private axisFragment(row: Record<string, unknown>): NamingEvidenceFragment {
    return deepFreeze({
      key: requiredString(row, 'fragment_key'),
      sectionId: 'sajuFit',
      slot: 'state',
      plain: requiredString(row, 'plain'),
      detail: requiredString(row, 'detail'),
    });
  }

  private sourceFragment(row: Record<string, unknown>): NamingEvidenceFragment {
    requiredString(row, 'source_id');
    requiredString(row, 'state');
    return deepFreeze({
      key: requiredString(row, 'fragment_key'),
      sectionId: 'sajuFit',
      slot: 'detail',
      plain: requiredString(row, 'plain'),
      detail: requiredString(row, 'detail'),
    });
  }

  private conclusionFragment(row: Record<string, unknown>): NamingEvidenceFragment {
    return deepFreeze({
      key: requiredString(row, 'fragment_key'),
      sectionId: 'sajuFit',
      slot: 'conclusion',
      plain: requiredString(row, 'plain'),
      detail: requiredString(row, 'detail'),
    });
  }

  private metadataValue(key: string): string {
    const rows = this.query('SELECT value FROM metadata WHERE key = ? LIMIT 1', [key]);
    if (rows.length === 0) {
      throw new NamingEvidenceContractError(`database.metadata.${key}`, 'required value is missing');
    }
    return requiredString(rows[0], 'value');
  }

  private query(sql: string, params: Array<string | number> = []): Array<Record<string, unknown>> {
    if (!this.db) throw new Error('Database not initialized. Call init() first.');
    const statement = this.db.prepare(sql);
    const rows: Array<Record<string, unknown>> = [];
    try {
      if (params.length > 0) statement.bind(params);
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }

  public close(): void {
    const db = this.db;
    this.db = null;
    this.initPromise = null;
    db?.close();
  }
}
