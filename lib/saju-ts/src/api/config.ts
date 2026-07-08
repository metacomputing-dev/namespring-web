import type { EngineConfig } from './types.js';
import { migrateConfig } from './migrations.js';
import { applySchoolPreset, resolveSchoolPresetPacks } from '../schools/index.js';
import { deepMerge } from '../utils/deepMerge.js';

export const defaultConfig: EngineConfig = {
  schemaVersion: '1',
  calendar: {
    yearBoundary: 'liChun',
    monthBoundary: 'jieqi',
    dayBoundary: 'midnight',
    hourBoundary: 'doubleHour',
    solarTerms: {
      method: 'meeus',
      alwaysCompute: false,
    },
    trueSolarTime: {
      enabled: false,
      equationOfTime: 'off',
      applyTo: 'hourOnly',
    },
  },
  toggles: {
    pillars: true,
    relations: true,
    tenGods: true,
    hiddenStems: true,
    elementDistribution: true,
    fortune: true,
    rules: true,
    lifeStages: true,
    stemRelations: true,
  },
  strategies: {
    // [감사 B7] 신강약 기본 모델: 월지 가중 得令/得地/得势 (deLingDiShi).
    // 월지 무가중 'base' 모델은 어느 학파도 채택하지 않는 이설 밖 동작이라 옵션으로 강등.
    // 명시적으로 strategies.strength.model='base'를 주면 이전 동작으로 복귀한다.
    strength: { model: 'deLingDiShi' },
  },
};

function parsePresetIds(x: unknown): string[] {
  const out: string[] = [];

  const add = (v: unknown) => {
    if (typeof v !== 'string') return;
    const t = v.trim();
    if (!t) return;
    // Allow simple composition: "a+b" or "a,b".
    const parts = t.split(/[+,]/).map((s) => s.trim()).filter(Boolean);
    out.push(...parts);
  };

  if (Array.isArray(x)) {
    for (const v of x) add(v);
  } else {
    add(x);
  }

  // de-dup but keep order
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const id of out) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
  }
  return uniq;
}

/**
 * Minimal normalization:
 * - apply defaults
 * - apply school preset overlays (optional)
 * - preserve unknown fields
 *
 * In later versions, this is where schema migrations would live.
 */
export function normalizeConfig(input: Partial<EngineConfig> | unknown): EngineConfig {
  const migrated = migrateConfig(input);

  // Allow data-first extension: user can embed additional preset packs under config.extensions.
  // This keeps API stable while enabling new schools without code changes.
  const packs = resolveSchoolPresetPacks(migrated);

  const presetRef: unknown = (() => {
    const bySchool = (migrated as any)?.school?.id;
    if (bySchool != null) return bySchool;

    const ext: any = (migrated.extensions as any) ?? {};
    const byExt = ext?.presets?.school ?? ext?.preset?.school ?? ext?.school;
    if (byExt != null) return byExt;

    const st: any = (migrated.strategies as any) ?? {};
    const byStrat = st?.school ?? st?.schoolId;
    if (byStrat != null) return byStrat;

    return null;
  })();

  const presetIds = parsePresetIds(presetRef);

  let base: EngineConfig = defaultConfig;
  for (const id of presetIds) {
    base = applySchoolPreset(base as any, id, packs as any);
  }

  // Deep merge so that user overrides do not erase preset nested fields.
  return deepMerge(base, migrated) as EngineConfig;
}
