import type { EngineConfig } from './types.js';
import { migrateConfig } from './migrations.js';
import { applySchoolPreset, resolveSchoolPresetPacks } from '../schools/index.js';
import { deepFreeze, deepMerge } from '../utils/deepMerge.js';

export const defaultConfig: EngineConfig = deepFreeze({
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
    // [PR-5] strength.interaction.* (합충→신강약 주입, 기본 on)의 세부 기본값은
    // rules/facts.ts readStrengthInteractionPolicy에 있다 — enabled:false로 완전 opt-out.
    strength: { model: 'deLingDiShi' },
    // [감사 B448 · PR-5 옵션 틀] 합충 보정 오행 분포 — 기본 off.
    // true로 켜면 summary.elementDistributionAdjusted가 additive로 산출될 뿐,
    // 기본 분포·부족/과다 판정·작명 풀·κ nameEffect는 불변이다. 소비 전환은
    // validate:default-change + κ 코퍼스 재생성 계획과 세트인 별도 결정.
    elements: { interactionAdjusted: false },
  },
} satisfies EngineConfig);

/** Raised when an explicit school selector cannot be parsed into preset ids. */
export class InvalidSchoolPresetSelectorError extends Error {
  readonly code = 'SAJU_INVALID_SCHOOL_PRESET_SELECTOR';

  constructor() {
    super('School preset selector must contain one or more non-empty string ids.');
    this.name = 'InvalidSchoolPresetSelectorError';
  }
}

function parsePresetIds(x: unknown): string[] {
  if (x === undefined) return [];
  const out: string[] = [];

  const add = (v: unknown) => {
    if (typeof v !== 'string') throw new InvalidSchoolPresetSelectorError();
    const t = v.trim();
    if (!t) throw new InvalidSchoolPresetSelectorError();
    // Allow simple composition: "a+b" or "a,b".
    const parts = t.split(/[+,]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new InvalidSchoolPresetSelectorError();
    out.push(...parts);
  };

  if (Array.isArray(x)) {
    if (x.length === 0) throw new InvalidSchoolPresetSelectorError();
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
    if (Object.prototype.hasOwnProperty.call(migrated as object, 'school')) {
      const school = (migrated as any).school;
      if (
        !school ||
        typeof school !== 'object' ||
        Array.isArray(school) ||
        !Object.prototype.hasOwnProperty.call(school, 'id')
      ) {
        throw new InvalidSchoolPresetSelectorError();
      }
      return school.id;
    }

    const ext: any = (migrated.extensions as any) ?? {};
    const byExt = ext?.presets?.school ?? ext?.preset?.school ?? ext?.school;
    if (byExt != null) return byExt;

    const st: any = (migrated.strategies as any) ?? {};
    const byStrat = st?.school ?? st?.schoolId;
    if (byStrat != null) return byStrat;

    return undefined;
  })();

  const presetIds = parsePresetIds(presetRef);

  let base: EngineConfig = defaultConfig;
  for (const id of presetIds) {
    base = applySchoolPreset(base as any, id, packs as any);
  }

  // Deep merge so that user overrides do not erase preset nested fields.
  return deepMerge(base, migrated) as EngineConfig;
}
