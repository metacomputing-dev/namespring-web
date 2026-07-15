import type { EngineConfig } from '../api/types.js';
import { deepMerge } from '../utils/deepMerge.js';

import type { SchoolPreset, SchoolPresetPack, SchoolPresetDefinition, SchoolRuleSpecBlock } from './packTypes.js';

function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

export function concatRuleSpecs(baseRuleSpecs: any, overlayRuleSpecs: any): any {
  if (!baseRuleSpecs && !overlayRuleSpecs) return undefined;
  if (!baseRuleSpecs) return overlayRuleSpecs;
  if (!overlayRuleSpecs) return baseRuleSpecs;

  const out: any = { ...baseRuleSpecs };
  const keys = new Set<string>([...Object.keys(baseRuleSpecs ?? {}), ...Object.keys(overlayRuleSpecs ?? {})]);

  for (const k of keys) {
    const b = (baseRuleSpecs as any)[k];
    const o = (overlayRuleSpecs as any)[k];
    if (b == null) {
      out[k] = o;
      continue;
    }
    if (o == null) {
      out[k] = b;
      continue;
    }
    // Both present: concat as spec array (compiler already supports spec | spec[]).
    out[k] = [...asArray(b), ...asArray(o)];
  }

  return out;
}

function safeOverlayBlock(pack: SchoolPresetPack, id: string): Partial<EngineConfig> | null {
  const b = (pack as any)?.overlayBlocks?.[id];
  if (!b || typeof b !== 'object') return null;
  return b as any;
}

function safeRuleSpecBlock(pack: SchoolPresetPack, id: string): SchoolRuleSpecBlock | null {
  const b = (pack as any)?.ruleSpecBlocks?.[id];
  if (!b || typeof b !== 'object') return null;
  if (typeof (b as any).target !== 'string') return null;
  if (!('spec' in (b as any))) return null;
  return b as any;
}

function mergeInclude(parent?: SchoolPresetDefinition['include'], child?: SchoolPresetDefinition['include']): SchoolPresetDefinition['include'] {
  const p = parent ?? {};
  const c = child ?? {};
  const overlayBlocks = [...(p.overlayBlocks ?? []), ...(c.overlayBlocks ?? [])];
  const ruleSpecBlocks = [...(p.ruleSpecBlocks ?? []), ...(c.ruleSpecBlocks ?? [])];
  const out: any = {};
  if (overlayBlocks.length) out.overlayBlocks = overlayBlocks;
  if (ruleSpecBlocks.length) out.ruleSpecBlocks = ruleSpecBlocks;
  return Object.keys(out).length ? out : undefined;
}

function uniq<T>(xs: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function resolveExtends(def: SchoolPresetDefinition, pack: SchoolPresetPack, stack: string[] = []): SchoolPresetDefinition {
  const parentId = def.extends;
  if (!parentId) return def;
  if (stack.includes(def.id)) {
    // Cycle guard: return child as-is.
    return def;
  }
  const parent = (pack.presets ?? []).find((p) => p?.id === parentId);
  if (!parent) return def;

  const parentResolved = resolveExtends(parent as any, pack, [...stack, def.id]);

  const mergedOverlay = deepMerge(parentResolved.overlay ?? {}, def.overlay ?? {}) as any;
  const mergedInclude = mergeInclude(parentResolved.include, def.include);
  const mergedSources = uniq([...(parentResolved.sources ?? []), ...(def.sources ?? [])]);

  return {
    ...def,
    overlay: Object.keys(mergedOverlay ?? {}).length ? (mergedOverlay as any) : def.overlay,
    include: mergedInclude,
    // aliases는 부모에게서 상속하지 않는다(자기 것만 유지). 프리셋들이 자기 id를
    // aliases에도 넣는 관례 때문에, 부모 aliases를 상속하면 나중에 등록되는 자식이
    // 인덱스에서 부모의 id/alias 키를 가로챈다 — qiongTongBaoJian 오버레이 분화(감사
    // B12) 시 school.id='johoo.strict' 조회가 궁통보감 테이블을 받는 형태로 실제
    // 발현·검출된 잠복 버그.
    aliases: def.aliases,
    sources: mergedSources.length ? mergedSources : def.sources,
  };
}

/**
 * Expand a preset definition into a canonical SchoolPreset with a **materialized** overlay.
 *
 * - include.overlayBlocks are deep-merged (in order) into preset.overlay
 * - include.ruleSpecBlocks are attached under overlay.extensions.ruleSpecs.{target}
 */
export function materializePreset(def: SchoolPresetDefinition, pack: SchoolPresetPack): SchoolPreset {
  const resolved = resolveExtends(def, pack);

  // 1) Overlay blocks
  let overlay: Partial<EngineConfig> = {};
  for (const bid of resolved.include?.overlayBlocks ?? []) {
    const b = safeOverlayBlock(pack, bid);
    if (!b) continue;
    overlay = deepMerge(overlay, b) as any;
  }

  // 2) Preset overlay
  if (resolved.overlay) overlay = deepMerge(overlay, resolved.overlay) as any;

  // 3) RuleSpec blocks → overlay.extensions.ruleSpecs
  const blocks = resolved.include?.ruleSpecBlocks ?? [];
  if (blocks.length) {
    const ruleSpecs: any = {};
    for (const rid of blocks) {
      const b = safeRuleSpecBlock(pack, rid);
      if (!b) continue;
      const tgt = b.target;
      const prev = ruleSpecs[tgt];
      const next = b.spec;
      ruleSpecs[tgt] = prev == null ? next : [...asArray(prev), ...asArray(next)];
    }

    // Attach (and concatenate if preset.overlay already had ruleSpecs).
    const ext: any = (overlay as any).extensions ?? {};
    (overlay as any).extensions = ext;
    ext.ruleSpecs = concatRuleSpecs(ext.ruleSpecs, ruleSpecs);
  }

  return {
    id: resolved.id,
    name: resolved.name,
    description: resolved.description,
    aliases: resolved.aliases,
    sources: resolved.sources,
    overlay: overlay as any,
  };
}

export function buildPresetIndex(packs: SchoolPresetPack[]): Record<string, { preset: SchoolPreset; packId: string }> {
  const out: Record<string, { preset: SchoolPreset; packId: string }> = {};

  // Later packs override earlier ones.
  const materialized: Array<{ preset: SchoolPreset; packId: string }> = [];
  for (const pack of packs) {
    for (const def of pack.presets ?? []) {
      if (!def || typeof def.id !== 'string') continue;
      materialized.push({ preset: materializePreset(def as any, pack), packId: pack.id });
    }
  }

  // 1차: aliases (alias끼리는 나중 것이 승 — 기존 의미 유지, 예: qiongtong).
  for (const entry of materialized) {
    for (const a of entry.preset.aliases ?? []) out[a] = entry;
  }
  // 2차: ids — 정확한 id 조회는 다른 프리셋의 alias에 가로채이지 않는다.
  for (const entry of materialized) {
    out[entry.preset.id] = entry;
  }

  return out;
}

/**
 * Heuristic extraction for user-provided packs stored in config (data-first).
 *
 * Supported locations (soft, future-proof):
 * - config.extensions.presetPacks
 * - config.extensions.schoolPacks
 * - config.extensions.schools.packs
 */
export function extractUserPresetPacks(config: EngineConfig): SchoolPresetPack[] {
  const ext: any = (config.extensions as any) ?? {};
  const raw = ext.presetPacks ?? ext.schoolPacks ?? ext?.schools?.packs;
  if (!raw) return [];

  const arr = Array.isArray(raw) ? raw : [raw];
  const packs: SchoolPresetPack[] = [];
  for (const p of arr) {
    if (!p || typeof p !== 'object') continue;
    if (typeof (p as any).schemaVersion !== 'string') continue;
    if (typeof (p as any).id !== 'string') continue;
    if (!Array.isArray((p as any).presets)) continue;
    packs.push(p as any);
  }
  return packs;
}
