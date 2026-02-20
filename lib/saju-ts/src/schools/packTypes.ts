import type { EngineConfig } from '../api/types.js';

/**
 * School preset packs are **data-only** bundles that define:
 * - presets (id/aliases + config overlays)
 * - optional reusable overlay blocks
 * - optional reusable ruleSpec blocks (DSL spec fragments)
 *
 * The engine keeps the core math/logic stable while allowing “school”(유파)
 * differences to live in data.
 */

export type RuleSpecTarget = 'yongshin' | 'gyeokguk' | 'shinsal' | 'shinsalConditions' | (string & {});

/**
 * Canonical “materialized” preset used by the engine.
 *
 * NOTE: overlay is *always present* here (even if empty) to keep API stable.
 */
export interface SchoolPreset {
  id: string;
  name: string;
  description: string;
  /** A partial config overlay applied on top of defaultConfig. */
  overlay: Partial<EngineConfig>;
  /** Optional aliases (for config convenience). */
  aliases?: string[];
  /** Optional references / sources (docs links or bibliography keys). */
  sources?: string[];
}

export interface SchoolRuleSpecBlock {
  /** Which ruleSpec bucket to target (e.g. 'yongshin', 'gyeokguk'). */
  target: RuleSpecTarget;
  /** Spec payload (compiler accepts spec | spec[]). */
  spec: unknown;
}

export interface SchoolPresetInclude {
  /** Overlay blocks to merge (pack.overlayBlocks). */
  overlayBlocks?: string[];
  /** RuleSpec blocks to attach (pack.ruleSpecBlocks). */
  ruleSpecBlocks?: string[];
}

export interface SchoolPresetDefinition {
  id: string;
  name: string;
  description: string;
  /** Optional parent preset id within the same pack (simple inheritance). */
  extends?: string;
  aliases?: string[];
  sources?: string[];

  /** Partial config overlay applied on top of defaultConfig. */
  overlay?: Partial<EngineConfig>;

  /** Optional reuse hooks (macro layer for data packs). */
  include?: SchoolPresetInclude;
}

export interface SchoolPresetPack {
  /** Pack schema version (currently '1'). */
  schemaVersion: string;
  id: string;
  name?: string;
  description?: string;

  overlayBlocks?: Record<string, Partial<EngineConfig>>;
  ruleSpecBlocks?: Record<string, SchoolRuleSpecBlock>;

  presets: SchoolPresetDefinition[];
}
