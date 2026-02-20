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

function isPlainObject(x: any): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function normalizeSchemaVersion(v: any): string {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : '0';
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.floor(v);
    return String(n);
  }
  // Legacy configs may not have schemaVersion at all.
  return '0';
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
 * This migration focuses on structural renames and invalid-shape cleanup.
 */
function migrate0to1(input: any): any {
  const cur: any = isPlainObject(input) ? { ...input } : {};

  // calendar shape sanity.
  if (!isPlainObject(cur.calendar)) cur.calendar = {};
  else cur.calendar = { ...cur.calendar };

  if (cur.calendar.solarTerms != null && !isPlainObject(cur.calendar.solarTerms)) {
    delete cur.calendar.solarTerms;
  }
  if (cur.calendar.trueSolarTime != null && !isPlainObject(cur.calendar.trueSolarTime)) {
    delete cur.calendar.trueSolarTime;
  }

  // toggles: rename lifeStage -> lifeStages.
  if (!isPlainObject(cur.toggles)) cur.toggles = {};
  else cur.toggles = { ...cur.toggles };

  if (cur.toggles.lifeStages == null && cur.toggles.lifeStage != null) {
    cur.toggles.lifeStages = cur.toggles.lifeStage;
  }
  if ('lifeStage' in cur.toggles) delete cur.toggles.lifeStage;

  // strategies: rename lifeStage -> lifeStages.
  if (cur.strategies != null) {
    if (!isPlainObject(cur.strategies)) {
      // Bad shape: drop and let defaults handle.
      delete cur.strategies;
    } else {
      cur.strategies = { ...cur.strategies };
      if (cur.strategies.lifeStages == null && cur.strategies.lifeStage != null) {
        cur.strategies.lifeStages = cur.strategies.lifeStage;
      }
      if ('lifeStage' in cur.strategies) delete cur.strategies.lifeStage;
    }
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
 * The engine is intentionally tolerant:
 * - Missing/invalid schemaVersion is treated as legacy '0'.
 * - Unknown older versions are "best-effort" stamped to current (without throwing).
 */
export function migrateConfig(input: unknown): EngineConfig {
  const startV = normalizeSchemaVersion((input as any)?.schemaVersion);
  let cur: any = isPlainObject(input)
    ? { ...(input as any), schemaVersion: startV }
    : { schemaVersion: startV };

  // Apply linear migrations until CURRENT_CONFIG_SCHEMA_VERSION.
  while (true) {
    const v = normalizeSchemaVersion(cur.schemaVersion);
    if (v === CURRENT_CONFIG_SCHEMA_VERSION) break;
    const m = MIGRATIONS.find((x) => x.from === v);
    if (!m) {
      // Unknown/unsupported older version: keep as-is but stamp current.
      cur.schemaVersion = CURRENT_CONFIG_SCHEMA_VERSION;
      break;
    }
    cur = m.migrate(cur);
    cur.schemaVersion = m.to;
  }

  return cur as EngineConfig;
}
