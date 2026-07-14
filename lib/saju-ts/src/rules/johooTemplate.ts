import type { EngineConfig } from '../api/types.js';
import type { BranchIdx, Element, StemIdx } from '../core/cycle.js';
import { branchHanja, stemElement, stemHanja, stemIdxFromHanja } from '../core/cycle.js';
import { ELEMENT_ORDER } from '../core/elementVector.js';
import type { SeasonGroup } from './season.js';
import { seasonGroupOfMonthBranch } from './season.js';
import type { JohooMonthCell, JohooMonthTable } from './packs/johooQiongTongBaoJianTable.js';
import { QIONG_TONG_BAO_JIAN_TABLE } from './packs/johooQiongTongBaoJianTable.js';

export interface JohooTemplatePolicy {
  enabled: boolean;

  /** Additive bonus applied to the season-mandatory element (冬→火, 夏→水). */
  seasonMandatoryBoost: number;

  /** Additive bonus applied per preferred-stem-derived element (天干“互不离” heuristic). */
  stemPreferenceBoost: number;

  /** If true, also inject the classic “夏不离水 / 冬不离火” step rule even if seasonGroup is extended later. */
  enforceSummerWinter: boolean;

  /** Optional override mapping: stem hanja → list of preferred stem hanja(s). */
  stemPreferencesOverride?: Record<string, string[]>;

  /**
   * 감사 B12: 궁통보감 조후용신표(일간×월지 120셀) 조회.
   * 'qiongTongBaoJian'(내장 이름) 또는 인라인 부분 테이블. null = 기존 간이 경로.
   * 셀 적중 시 互不离·冬丙/夏癸 힌트를 셀의 주용신/보좌로 대체한다(이중 가산 금지).
   */
  monthTable: JohooMonthTable | null;
  monthTableSource?: 'qiongTongBaoJian' | 'custom';
  /** 주용신 원소 보너스 (기본 0.5 — 계절 필수 원소와 동급 이상). */
  monthTablePrimaryBoost: number;
  /** 보좌 원소 보너스 (기본 0.25 — 기존 보조 힌트와 동일 스케일). */
  monthTableSecondaryBoost: number;
}

export interface JohooTemplateResult {
  enabled: true;
  seasonGroup: SeasonGroup;
  dayStem: StemIdx;
  monthBranch: BranchIdx;
  dayStemHanja: string;
  monthBranchHanja: string;

  /** Preferred helper stems (indices) derived from “互不离” mapping. */
  preferredStems: StemIdx[];
  preferredStemHanja: string[];
  preferredElements: Element[];

  /** Season-mandatory element(s). */
  mandatoryElements: Element[];

  /** Pure bonus vector (does NOT include climate dot-product scores). */
  bonus: Record<Element, number>;

  /** bonus + climateScores (for convenience / explainability). */
  combinedScores: Record<Element, number>;

  ranking: Array<{ element: Element; score: number }>;
  primary: Element;
  secondary: Element;

  /**
   * 감사 B12 (additive): 궁통보감 120셀 조회가 적중한 경우의 천간 레벨 상세.
   * primary/secondary(원소 레벨, combinedScores 랭킹)와 별개 — 의미 불변 원칙.
   */
  monthTable?: {
    source: 'qiongTongBaoJian' | 'custom';
    primaryStem: StemIdx;
    primaryStemHanja: string;
    secondaryStems: StemIdx[];
    secondaryStemHanja: string[];
    note?: string;
  };

  reasons: string[];
}

const DEFAULT_STEM_PREFERENCES: Record<string, string[]> = {
  // A compact “互不离” set (config override supported).
  // See docs/20_johoo_template.md for rationale & references.
  '甲': ['庚'],
  '乙': ['癸'],
  '丙': ['壬'],
  '丁': ['甲'],
  '戊': ['甲'],
  '己': ['丙'],
  '庚': ['丁'],
  '辛': ['壬'],
  '壬': ['戊'],
  '癸': ['辛'],
};

function asNumber(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

// 감사 B12: 내장 월별 조후용신표 레지스트리.
const BUILTIN_MONTH_TABLES: Record<string, JohooMonthTable> = {
  qiongTongBaoJian: QIONG_TONG_BAO_JIAN_TABLE,
};

/**
 * monthTableOverride 셀 단위 패치 병합. deepMerge를 쓰지 않는 이유:
 * base가 내장 이름(문자열)일 수 있고, secondary 배열은 병합이 아니라 교체가 맞다.
 */
function mergeMonthTable(
  base: JohooMonthTable,
  override: unknown,
): { table: JohooMonthTable; overridden: boolean } {
  if (!override || typeof override !== 'object') return { table: base, overridden: false };
  const out: Record<string, Record<string, JohooMonthCell>> = {};
  let overridden = false;
  for (const [stem, row] of Object.entries(base)) {
    out[stem] = { ...(row as Record<string, JohooMonthCell>) };
  }
  for (const [stem, row] of Object.entries(override as Record<string, unknown>)) {
    if (!row || typeof row !== 'object') continue;
    out[stem] = { ...(out[stem] ?? {}) };
    for (const [branch, cell] of Object.entries(row as Record<string, unknown>)) {
      if (!cell || typeof cell !== 'object') continue;
      const c = cell as { primary?: unknown; secondary?: unknown; note?: unknown };
      if (typeof c.primary !== 'string') continue;
      out[stem]![branch] = {
        primary: c.primary,
        secondary: Array.isArray(c.secondary) ? c.secondary.filter((x): x is string => typeof x === 'string') : [],
        ...(typeof c.note === 'string' ? { note: c.note } : {}),
      };
      overridden = true;
    }
  }
  return { table: out as JohooMonthTable, overridden };
}

function readMonthTable(raw: any): { table: JohooMonthTable | null; source: 'qiongTongBaoJian' | 'custom' | undefined } {
  const spec = raw?.monthTable;
  let table: JohooMonthTable | null = null;
  let source: 'qiongTongBaoJian' | 'custom' | undefined;
  if (typeof spec === 'string' && BUILTIN_MONTH_TABLES[spec]) {
    table = BUILTIN_MONTH_TABLES[spec]!;
    source = spec as 'qiongTongBaoJian';
  } else if (spec && typeof spec === 'object') {
    table = spec as JohooMonthTable;
    source = 'custom';
  }
  if (table && raw?.monthTableOverride) {
    const merged = mergeMonthTable(table, raw.monthTableOverride);
    table = merged.table;
    if (merged.overridden) source = 'custom';
  }
  return { table, source };
}

function readPolicy(config: EngineConfig): JohooTemplatePolicy {
  const raw: any = (config.strategies as any)?.yongshin?.johooTemplate ?? (config.strategies as any)?.johooTemplate ?? {};
  const { table, source } = readMonthTable(raw);
  return {
    enabled: raw?.enabled === true,
    seasonMandatoryBoost: asNumber(raw?.seasonMandatoryBoost, 0.35),
    stemPreferenceBoost: asNumber(raw?.stemPreferenceBoost, 0.25),
    enforceSummerWinter: raw?.enforceSummerWinter !== false,
    stemPreferencesOverride: raw?.stemPreferencesOverride && typeof raw?.stemPreferencesOverride === 'object' ? (raw.stemPreferencesOverride as any) : undefined,
    monthTable: table,
    monthTableSource: source,
    monthTablePrimaryBoost: asNumber(raw?.monthTablePrimaryBoost, 0.5),
    monthTableSecondaryBoost: asNumber(raw?.monthTableSecondaryBoost, 0.25),
  };
}

function mergeStemPref(policy: JohooTemplatePolicy): Record<string, string[]> {
  const base = { ...DEFAULT_STEM_PREFERENCES };
  const ov = policy.stemPreferencesOverride;
  if (!ov) return base;
  for (const [k, v] of Object.entries(ov)) {
    if (!Array.isArray(v)) continue;
    const arr = v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
    if (arr.length === 0) continue;
    base[k] = arr;
  }
  return base;
}

function mandatoryBySeason(season: SeasonGroup): Element[] {
  // Minimal step rule: winter needs fire, summer needs water.
  if (season === 'WINTER') return ['FIRE'];
  if (season === 'SUMMER') return ['WATER'];
  return [];
}

export function computeJohooTemplate(config: EngineConfig, args: {
  dayStem: StemIdx;
  monthBranch: BranchIdx;
  climateScores: Record<Element, number>;
}): JohooTemplateResult | null {
  const policy = readPolicy(config);
  if (!policy.enabled) return null;

  const seasonGroup = seasonGroupOfMonthBranch(args.monthBranch);
  const dayStemHanja = stemHanja(args.dayStem);
  const monthBranchHanja = branchHanja(args.monthBranch);

  const mandatoryElements = mandatoryBySeason(seasonGroup);

  const bonus: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  const reasons: string[] = [];

  for (const e of mandatoryElements) {
    bonus[e] += policy.seasonMandatoryBoost;
  }
  if (mandatoryElements.length > 0) reasons.push(`seasonMandatory:${seasonGroup}`);

  // 감사 B12: 궁통보감 120셀 조회. 셀 적중 시 互不离(고정 1천간)와 冬丙/夏癸
  // 힌트를 통째로 대체한다 — 겨울 셀은 이미 화 계열 천간을 수록하므로 힌트를
  // 중첩하면 FIRE가 과대 가산된다(이중 가산 금지).
  const cell = policy.monthTable
    ? (policy.monthTable as Record<string, Record<string, JohooMonthCell> | undefined>)[dayStemHanja]?.[monthBranchHanja] ?? null
    : null;
  const cellPrimary = cell ? stemIdxFromHanja(cell.primary) : null;

  let prefHanja: string[];
  let preferredStems: StemIdx[];
  let preferredElements: Element[];
  let monthTableOut: JohooTemplateResult['monthTable'];

  if (cell && typeof cellPrimary === 'number') {
    // ── 궁통보감 조회 경로 ──
    const secStems = (cell.secondary ?? [])
      .map((h) => stemIdxFromHanja(h))
      .filter((x): x is StemIdx => typeof x === 'number');
    preferredStems = [cellPrimary, ...secStems];
    prefHanja = preferredStems.map((s) => stemHanja(s));
    preferredElements = preferredStems.map((s) => stemElement(s));
    bonus[stemElement(cellPrimary)] += policy.monthTablePrimaryBoost;
    // 보좌 동일 원소가 여러 개면 단순 누적(+0.25×n) — 현 수록 데이터에서 유의미한
    // 과대는 없으며, per-element cap은 데이터 저작 확장 시 재결정 포인트.
    for (const s of secStems) bonus[stemElement(s)] += policy.monthTableSecondaryBoost;
    reasons.push(`monthTable:${dayStemHanja}${monthBranchHanja}:${cell.primary}(${(cell.secondary ?? []).join('')})`);
    monthTableOut = {
      source: policy.monthTableSource ?? 'custom',
      primaryStem: cellPrimary,
      primaryStemHanja: stemHanja(cellPrimary),
      secondaryStems: secStems,
      secondaryStemHanja: secStems.map((s) => stemHanja(s)),
      ...(cell.note ? { note: cell.note } : {}),
    };
  } else {
    if (policy.monthTable) reasons.push(`monthTableMiss:${dayStemHanja}${monthBranchHanja}`);
    // ── 기존 간이 경로 (테이블 미지정 또는 셀 부재 폴백) ──
    const prefs = mergeStemPref(policy);
    const prefHanjaBase = prefs[dayStemHanja] ?? [];
    prefHanja = [...prefHanjaBase];
    preferredStems = prefHanja.map((h) => stemIdxFromHanja(h)).filter((x): x is StemIdx => typeof x === 'number');
    preferredElements = preferredStems.map((s) => stemElement(s));

    // “互不离” stems → element bonus.
    for (const s of preferredStems) {
      const el = stemElement(s);
      bonus[el] += policy.stemPreferenceBoost;
    }
    if (preferredStems.length > 0) reasons.push(`stemPreference:${dayStemHanja}`);

    // Optional: enforce “夏不离水 / 冬不离火” even if users later extend season mapping.
    if (policy.enforceSummerWinter) {
      // Also inject the classic “冬生要丙 / 夏生要癸” stem-level hint.
      // This is intentionally minimal and uses the same stemPreferenceBoost.
      const extraStemHanja = seasonGroup === 'WINTER' ? '丙' : seasonGroup === 'SUMMER' ? '癸' : null;
      if (extraStemHanja) {
        const extraStem = stemIdxFromHanja(extraStemHanja);
        if (typeof extraStem === 'number' && preferredStems.indexOf(extraStem) === -1) {
          prefHanja.push(extraStemHanja);
          preferredStems.push(extraStem);
          preferredElements.push(stemElement(extraStem));
          bonus[stemElement(extraStem)] += policy.stemPreferenceBoost;
          reasons.push(`seasonStemHelper:${seasonGroup}:${extraStemHanja}`);
        }
      }
    }
  }

  const combinedScores: Record<Element, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const e of ELEMENT_ORDER) combinedScores[e] = (args.climateScores[e] ?? 0) + (bonus[e] ?? 0);

  const ranking = [...ELEMENT_ORDER]
    .map((e) => ({ element: e, score: combinedScores[e] }))
    .sort((a, b) => b.score - a.score);

  return {
    enabled: true,
    seasonGroup,
    dayStem: args.dayStem,
    monthBranch: args.monthBranch,
    dayStemHanja,
    monthBranchHanja,
    preferredStems,
    preferredStemHanja: prefHanja,
    preferredElements,
    mandatoryElements,
    bonus,
    combinedScores,
    ranking,
    primary: ranking[0]?.element ?? 'WOOD',
    secondary: ranking[1]?.element ?? ranking[0]?.element ?? 'WOOD',
    ...(monthTableOut ? { monthTable: monthTableOut } : {}),
    reasons,
  };
}
