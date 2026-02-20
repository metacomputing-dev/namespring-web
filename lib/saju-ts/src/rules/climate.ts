import type { BranchIdx } from '../core/cycle.js';
import { branchHanja, branchIdxFromHanja } from '../core/cycle.js';
import type { Element } from '../core/cycle.js';
import { ELEMENT_ORDER } from '../core/elementVector.js';

/**
 * A small, math-first "climate" (調候) model.
 *
 * We represent the seasonal environment as a 2D vector:
 * - temp: +hot / -cold
 * - moist: +wet / -dry
 *
 * A candidate element is also a 2D vector representing how it shifts those axes.
 * The "benefit" is the dot product with the needed adjustment vector.
 *
 * This intentionally stays simple so that schools can override the tables.
 */

export interface ClimateVector {
  temp: number;
  moist: number;
}

export interface ClimateModel {
  /** Environment vector per month branch (0..11). */
  envByMonthBranch: ClimateVector[]; // length 12
  /** Element effect vectors. */
  elementEffect: Record<Element, ClimateVector>;
  /** Optional scale applied to need before scoring (e.g., normalize by magnitude). */
  needScale?: 'none' | 'unit';
}

export const DEFAULT_CLIMATE_MODEL: ClimateModel = {
  // 子(0)..亥(11). Values are rough seasonal priors, not geography-specific weather.
  // +temp=hot, -temp=cold; +moist=wet, -moist=dry.
  envByMonthBranch: [
    { temp: -0.7, moist: 0.3 }, // 子: deep winter, cold & wet
    { temp: -0.6, moist: 0.2 }, // 丑
    { temp: -0.4, moist: 0.1 }, // 寅: early spring, still cool
    { temp: -0.2, moist: 0.2 }, // 卯
    { temp: 0.0, moist: 0.2 },  // 辰: damp earth
    { temp: 0.4, moist: -0.1 }, // 巳: warm & slightly dry
    { temp: 0.7, moist: -0.2 }, // 午: peak heat, tends to dryness
    { temp: 0.5, moist: 0.1 },  // 未: hot & a bit humid (late summer/长夏)
    { temp: 0.2, moist: -0.3 }, // 申: warm but dry
    { temp: 0.0, moist: -0.5 }, // 酉: cool & dry
    { temp: -0.1, moist: -0.4 }, // 戌: late autumn, dry
    { temp: -0.5, moist: 0.2 }, // 亥: early winter, cold & wet
  ],
  elementEffect: {
    WOOD: { temp: 0.2, moist: 0.1 },
    FIRE: { temp: 0.6, moist: -0.3 },
    EARTH: { temp: 0.1, moist: -0.2 },
    METAL: { temp: -0.2, moist: -0.3 },
    WATER: { temp: -0.6, moist: 0.4 },
  },
  needScale: 'none',
};

export function dot(a: ClimateVector, b: ClimateVector): number {
  return a.temp * b.temp + a.moist * b.moist;
}

export function neg(v: ClimateVector): ClimateVector {
  return { temp: -v.temp, moist: -v.moist };
}

export function norm(v: ClimateVector): number {
  return Math.sqrt(v.temp * v.temp + v.moist * v.moist);
}

export function scale(v: ClimateVector, k: number): ClimateVector {
  return { temp: v.temp * k, moist: v.moist * k };
}

export function normalizeNeed(v: ClimateVector, mode: ClimateModel['needScale']): ClimateVector {
  if (mode === 'unit') {
    const n = norm(v);
    if (n <= 1e-9) return { ...v };
    return scale(v, 1 / n);
  }
  return { ...v };
}

export function envOfMonthBranch(model: ClimateModel, monthBranch: BranchIdx): ClimateVector {
  const idx = ((monthBranch % 12) + 12) % 12;
  return model.envByMonthBranch[idx] ?? { temp: 0, moist: 0 };
}

export function computeClimateScores(model: ClimateModel, monthBranch: BranchIdx): {
  env: ClimateVector;
  need: ClimateVector;
  scores: Record<Element, number>;
} {
  const env = envOfMonthBranch(model, monthBranch);
  const rawNeed = neg(env);
  const need = normalizeNeed(rawNeed, model.needScale);

  const scores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const e of ELEMENT_ORDER) {
    scores[e] = dot(model.elementEffect[e], need);
  }
  return { env, need, scores };
}

/**
 * Parse a user-provided partial climate model.
 *
 * Supports:
 * - envByMonthBranch as an object keyed by branch hanja ("子", "丑", ...) -> {temp,moist}
 * - elementEffect as a partial object keyed by Element.
 */
export function mergeClimateModel(base: ClimateModel, override: any): ClimateModel {
  if (!override || typeof override !== 'object') return base;

  const out: ClimateModel = {
    envByMonthBranch: base.envByMonthBranch.map((v) => ({ ...v })),
    elementEffect: { ...base.elementEffect },
    needScale: override.needScale === 'unit' || override.needScale === 'none' ? override.needScale : base.needScale,
  };

  // envByMonthBranch: object by hanja
  const envByHanja = override.envByMonthBranchHanja ?? override.envByMonthBranch;
  if (envByHanja && typeof envByHanja === 'object' && !Array.isArray(envByHanja)) {
    for (const [k, v] of Object.entries(envByHanja)) {
      const idx = typeof k === 'string' ? branchIdxFromHanja(k) : null;
      if (idx == null) continue;
      if (!v || typeof v !== 'object') continue;
      const temp = typeof (v as any).temp === 'number' ? (v as any).temp : out.envByMonthBranch[idx].temp;
      const moist = typeof (v as any).moist === 'number' ? (v as any).moist : out.envByMonthBranch[idx].moist;
      out.envByMonthBranch[idx] = { temp, moist };
    }
  }

  // Also accept envByMonthBranchIndex: { "0":{...}, ... }
  const envByIdx = override.envByMonthBranchIndex;
  if (envByIdx && typeof envByIdx === 'object' && !Array.isArray(envByIdx)) {
    for (const [k, v] of Object.entries(envByIdx)) {
      const idx = Number(k);
      if (!Number.isFinite(idx)) continue;
      const i = ((idx % 12) + 12) % 12;
      if (!v || typeof v !== 'object') continue;
      const temp = typeof (v as any).temp === 'number' ? (v as any).temp : out.envByMonthBranch[i].temp;
      const moist = typeof (v as any).moist === 'number' ? (v as any).moist : out.envByMonthBranch[i].moist;
      out.envByMonthBranch[i] = { temp, moist };
    }
  }

  const eff = override.elementEffect;
  if (eff && typeof eff === 'object' && !Array.isArray(eff)) {
    for (const e of ELEMENT_ORDER) {
      const v = (eff as any)[e];
      if (!v || typeof v !== 'object') continue;
      const temp = typeof v.temp === 'number' ? v.temp : out.elementEffect[e].temp;
      const moist = typeof v.moist === 'number' ? v.moist : out.elementEffect[e].moist;
      out.elementEffect[e] = { temp, moist };
    }
  }

  return out;
}

export function debugClimateTable(model: ClimateModel): Array<{ month: string; envTemp: number; envMoist: number }> {
  return model.envByMonthBranch.map((v, idx) => ({ month: branchHanja(idx as BranchIdx), envTemp: v.temp, envMoist: v.moist }));
}
