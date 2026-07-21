import type { EngineConfig } from './types.js';

/**
 * Config schema migration framework.
 *
 * Goal: keep the public API stable while allowing internal config schemas to evolve.
 * - `schemaVersion` is a coarse, user-facing version tag.
 * - `strategies` / `extensions` remain open-ended (data-first), so migrations
 *   only cover known top-level fields.
 */

export const CURRENT_CONFIG_SCHEMA_VERSION = '1';

export interface ConfigMigration {
  from: string;
  to: string;
  migrate: (config: any) => any;
}

export class UnsupportedConfigSchemaVersionError extends Error {
  readonly code = 'SAJU_CONFIG_SCHEMA_VERSION_UNSUPPORTED';
  readonly schemaVersion: string;

  constructor(schemaVersion: string) {
    super(`Unsupported config schemaVersion: ${schemaVersion}`);
    this.name = 'UnsupportedConfigSchemaVersionError';
    this.schemaVersion = schemaVersion;
  }
}

function isPlainObject(x: any): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function formatInvalidSchemaVersion(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[array]';
  if (typeof v === 'object') return '[object]';
  if (typeof v === 'undefined') return 'undefined';
  return String(v);
}

function normalizeExplicitSchemaVersion(v: unknown): string {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t) return t;
  }
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)) {
    return String(v);
  }
  throw new UnsupportedConfigSchemaVersionError(formatInvalidSchemaVersion(v));
}

/**
 * Legacy schema v0 -> v1
 *
 * v0 assumptions (best-effort):
 * - `schemaVersion` missing
 * - `toggles.lifeStage` (singular) used instead of `toggles.lifeStages`
 * - `strategies.lifeStage` (singular) used instead of `strategies.lifeStages`
 *
 * NOTE: defaults are still applied later by normalizeConfig() via deepMerge(defaultConfig, migrated).
 * This migration performs structural renames only. Explicit invalid shapes are
 * preserved so the post-migration runtime validator can reject them instead of
 * silently replacing them with defaults.
 */
function migrate0to1(input: any): any {
  const cur: any = isPlainObject(input) ? { ...input } : {};

  if (cur.calendar === undefined) cur.calendar = {};
  else if (isPlainObject(cur.calendar)) cur.calendar = { ...cur.calendar };

  // toggles: rename lifeStage -> lifeStages.
  if (cur.toggles === undefined) cur.toggles = {};
  else if (isPlainObject(cur.toggles)) {
    cur.toggles = { ...cur.toggles };
    if (cur.toggles.lifeStages == null && cur.toggles.lifeStage != null) {
      cur.toggles.lifeStages = cur.toggles.lifeStage;
    }
    if ('lifeStage' in cur.toggles) delete cur.toggles.lifeStage;
  }

  // strategies: rename lifeStage -> lifeStages.
  if (isPlainObject(cur.strategies)) {
    cur.strategies = { ...cur.strategies };
    if (cur.strategies.lifeStages == null && cur.strategies.lifeStage != null) {
      cur.strategies.lifeStages = cur.strategies.lifeStage;
    }
    if ('lifeStage' in cur.strategies) delete cur.strategies.lifeStage;
  }

  return cur;
}

// Future migrations live here (ordered).
const MIGRATIONS: ConfigMigration[] = [
  {
    from: '0',
    to: '1',
    migrate: migrate0to1,
  },
];

/**
 * Apply sequential migrations until CURRENT_CONFIG_SCHEMA_VERSION.
 *
 * Missing schemaVersion is treated as legacy v0. Explicit unknown versions
 * fail closed because stamping an unrecognized contract as current would make
 * an unperformed migration indistinguishable from a valid one.
 */
export function migrateConfig(input: unknown): EngineConfig {
  const source = isPlainObject(input) ? input : {};
  const hasExplicitSchemaVersion = Object.prototype.hasOwnProperty.call(
    source,
    'schemaVersion',
  );
  const startV = hasExplicitSchemaVersion
    ? normalizeExplicitSchemaVersion(source.schemaVersion)
    : '0';
  let cur: any = { ...source, schemaVersion: startV };

  // Apply linear migrations until CURRENT_CONFIG_SCHEMA_VERSION.
  while (true) {
    const v = normalizeExplicitSchemaVersion(cur.schemaVersion);
    if (v === CURRENT_CONFIG_SCHEMA_VERSION) break;
    const m = MIGRATIONS.find((x) => x.from === v);
    if (!m) {
      throw new UnsupportedConfigSchemaVersionError(v);
    }
    cur = m.migrate(cur);
    cur.schemaVersion = m.to;
  }

  return cur as EngineConfig;
}
