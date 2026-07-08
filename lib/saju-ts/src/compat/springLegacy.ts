import { createEngine } from '../api/engine.js';
import { defaultConfig } from '../api/config.js';
import type { AnalysisBundle, EngineConfig, SajuRequest } from '../api/types.js';

const STEM_CODES = ['GAP', 'EUL', 'BYEONG', 'JEONG', 'MU', 'GI', 'GYEONG', 'SIN', 'IM', 'GYE'] as const;
const BRANCH_CODES = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'] as const;
const OHAENG_CODES = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;
const OHAENG_KO_LABEL: Record<string, string> = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
};
const GYEOKGUK_KO_LABEL: Record<string, string> = {
  BI_GYEON: '비견격',
  GYEOB_JAE: '겁재격',
  JEONG_GWAN: '정관격',
  PYEON_GWAN: '편관격',
  JEONG_JAE: '정재격',
  PYEON_JAE: '편재격',
  SIK_SIN: '식신격',
  SANG_GWAN: '상관격',
  JEONG_IN: '정인격',
  PYEON_IN: '편인격',
  HUA_QI: '화기격',
  ZHUAN_WANG: '전왕격',
  CONG_GE: '종격',
  CONG_CAI: '종재격',
  CONG_GUAN: '종관격',
  CONG_SHA: '종살격',
  CONG_ER: '종아격',
  CONG_YIN: '종인격',
  CONG_BI: '종비격',
};

const DEFAULT_LATITUDE = 37.5665;
const DEFAULT_LONGITUDE = 126.978;
const DEFAULT_TIMEZONE = 'Asia/Seoul';
const DISTRIBUTION_ROUND_DIGITS = 1;
const DEFICIENT_AVERAGE_RATIO = 0.5;
const EXCESSIVE_AVERAGE_RATIO = 1.7;
const MIN_GYEOKGUK_CANDIDATE_SCORE = 1e-9;
const GYEOKGUK_CANDIDATE_SOURCE_TIER = {
  tier: 'T2_REFERENCE_IMPLEMENTATION',
  sourceType: 'reference_implementation',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: 'Derived from saju-ts month-gyeok and gyeokguk ranking internals; display-only evidence, not authority truth.',
  copyrightNote: 'No quoted source text; implementation-derived metadata only.',
  authorityTruthEligible: false,
} as const;

const TEN_GOD_ALIASES: Record<string, string> = {
  GEOB_JAE: 'GYEOB_JAE',
  SIK_SHIN: 'SIK_SIN',
};
const GYEOKGUK_BASE_SIPSEONG_KEYS = new Set([
  'JEONG_GWAN', 'PYEON_GWAN',
  'JEONG_JAE', 'PYEON_JAE',
  'SIK_SIN', 'SANG_GWAN',
  'JEONG_IN', 'PYEON_IN',
  'BI_GYEON', 'GYEOB_JAE',
]);
const COMPOSITE_CLASSICAL_FEATURE_WEIGHTS = {
  monthMainMatch: 0.30,
  stemTransparency: 0.18,
  rootSupport: 0.14,
  seasonalCommand: 0.12,
  transformationSupport: 0.10,
  purityScore: 0.08,
  usefulGodAlignment: 0.08,
  sourceTierBoost: 0.05,
  stabilityAcrossModes: 0.05,
} as const;
// export: 방출 타입↔라벨 전수 일치 테스트(springLegacy.test.ts)가 소비 (감사 A3).
export const JIJI_RELATION_NOTES: Record<string, string> = {
  CHUNG: '지지 충(沖) 관계',
  HAE: '지지 해(害) 관계',
  PA: '지지 파(破) 관계',
  WONJIN: '지지 원진(怨嗔) 관계',
  GWIMUN: '지지 귀문(鬼門) 관계',
  HYEONG: '지지 형(刑) 관계',
  JA_HYEONG: '지지 자형(自刑) 관계',
  SAMHYEONG: '지지 삼형(三刑) 관계',
  HAP: '지지 합(合) 관계',
  YUKHAP: '지지 육합(六合) 관계',
  SAMHAP: '지지 삼합(三合) 관계',
  BANHAP: '지지 반합(半合) 관계',
  BANGHAP: '지지 방합(方合) 관계',
};
export const JIJI_RELATION_OUTCOMES: Record<string, string> = {
  CHUNG: '충(沖)',
  HAE: '해(害)',
  PA: '파(破)',
  WONJIN: '원진(怨嗔)',
  GWIMUN: '귀문(鬼門)',
  HYEONG: '형(刑)',
  JA_HYEONG: '자형(自刑)',
  SAMHYEONG: '삼형(三刑)',
  HAP: '합(合)',
  YUKHAP: '육합(六合)',
  SAMHAP: '삼합(三合)',
  BANHAP: '반합(半合)',
  BANGHAP: '방합(方合)',
};
/** 12운성 코드 → 만세력 표준 한글 표기 (감사 C1 — sibiUnseong 노출용). */
const LIFE_STAGE_KO: Record<string, string> = {
  JANG_SAENG: '장생',
  MOK_YOK: '목욕',
  GWAN_DAE: '관대',
  GEON_ROK: '건록',
  JE_WANG: '제왕',
  SWOE: '쇠',
  BYEONG: '병',
  SA: '사',
  MYO: '묘',
  JEOL: '절',
  TAE: '태',
  YANG: '양',
};

export const CHEONGAN_RELATION_NOTES: Record<string, string> = {
  HAP: '천간 합(合) 관계',
  CHUNG: '천간 충(沖) 관계',
  GEUK: '천간 극(剋) 관계',
};

export type LegacyGender = 'MALE' | 'FEMALE';

export interface LegacyBirthInput {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  gender?: LegacyGender;
  calendarType?: 'SOLAR' | 'LUNAR';
  isLeapMonth?: boolean;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
}

export interface LegacySajuOptions {
  daeunCount?: number;
  saeunStartYear?: number | null;
  saeunYearCount?: number;
}

export type LegacyDayCutMode =
  | 'MIDNIGHT_00'
  | 'YAZA_23_TO_01_NEXTDAY'
  | 'YAZA_23_30_TO_01_30_NEXTDAY'
  | 'JOJA_SPLIT';

export type LegacyYazaMode = Extract<
  LegacyDayCutMode,
  'YAZA_23_TO_01_NEXTDAY' | 'YAZA_23_30_TO_01_30_NEXTDAY'
>;

export interface LegacySajuConfig {
  /**
   * Master switch for true-solar-time correction.
   * Default: false
   */
  trueSolarTimeEnabled?: boolean;

  dayCutMode?: LegacyDayCutMode;

  /**
   * Legacy EoT toggle used when trueSolarTimeEnabled=true.
   * Default: true
   */
  includeEquationOfTime?: boolean;

  /**
   * Apply manseoryeok baseline-meridian correction to longitude.
   * Default: true
   */
  longitudeCorrectionEnabled?: boolean;

  /**
   * Convenience switch for YAZA day-cut behavior.
   * - false: MIDNIGHT_00
   * - true:  yazaMode/dayCutMode or default YAZA_23_30_TO_01_30_NEXTDAY
   * Default: false
   */
  yazaEnabled?: boolean;
  yazaMode?: LegacyYazaMode;

  lmtBaselineLongitude?: number;
  calendar?: Partial<EngineConfig['calendar']>;
  toggles?: Partial<EngineConfig['toggles']>;
  weights?: EngineConfig['weights'];
  strategies?: EngineConfig['strategies'];
  extensions?: EngineConfig['extensions'];
  school?: EngineConfig['school'];
  schemaVersion?: string;
}

interface CivilDateTime {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

interface DayCutMapping {
  dayBoundary: EngineConfig['calendar']['dayBoundary'];
  dayCutShiftMinutes: number;
}

interface TrueSolarCorrectionView {
  longitudeCorrectionMinutes?: number;
  equationOfTimeMinutes?: number;
  totalCorrectionMinutes?: number;
}

const PRESET_CONFIGS: Record<string, LegacySajuConfig> = {
  KOREAN_MAINSTREAM: {
    dayCutMode: 'YAZA_23_30_TO_01_30_NEXTDAY',
    includeEquationOfTime: false,
    lmtBaselineLongitude: 135,
  },
  TRADITIONAL_CHINESE: {
    dayCutMode: 'YAZA_23_30_TO_01_30_NEXTDAY',
    includeEquationOfTime: false,
    lmtBaselineLongitude: 120,
  },
  MODERN_INTEGRATED: {
    dayCutMode: 'JOJA_SPLIT',
    includeEquationOfTime: true,
    lmtBaselineLongitude: 135,
  },
};

const DEFAULT_TRUE_SOLAR_TIME_ENABLED = false;
const DEFAULT_LONGITUDE_CORRECTION_ENABLED = true;
const DEFAULT_YAZA_ENABLED = false;
const DEFAULT_YAZA_MODE: LegacyYazaMode = 'YAZA_23_30_TO_01_30_NEXTDAY';

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampHour(v: unknown): number {
  const n = toInt(v, 12);
  return Math.max(0, Math.min(23, n));
}

function clampMinute(v: unknown): number {
  const n = toInt(v, 0);
  return Math.max(0, Math.min(59, n));
}

function cloneConfig(): EngineConfig {
  return JSON.parse(JSON.stringify(defaultConfig)) as EngineConfig;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObj(base) || !isObj(patch)) return base;

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    const prev = out[k];
    if (isObj(prev) && isObj(v)) out[k] = deepMerge(prev, v);
    else out[k] = v;
  }
  return out as T;
}

function mapDayCutMode(mode: LegacyDayCutMode | undefined): DayCutMapping {
  switch (mode) {
    case 'MIDNIGHT_00':
      return { dayBoundary: 'midnight', dayCutShiftMinutes: 0 };
    case 'JOJA_SPLIT':
      return { dayBoundary: 'midnight', dayCutShiftMinutes: 0 };
    case 'YAZA_23_TO_01_NEXTDAY':
      return { dayBoundary: 'ziSplit23', dayCutShiftMinutes: 0 };
    case 'YAZA_23_30_TO_01_30_NEXTDAY':
      return { dayBoundary: 'ziSplit23', dayCutShiftMinutes: -30 };
    default:
      return { dayBoundary: 'midnight', dayCutShiftMinutes: 0 };
  }
}

function isYazaMode(mode: unknown): mode is LegacyYazaMode {
  return mode === 'YAZA_23_TO_01_NEXTDAY' || mode === 'YAZA_23_30_TO_01_30_NEXTDAY';
}

function resolveDayCutMode(legacy: LegacySajuConfig): LegacyDayCutMode {
  if (typeof legacy.yazaEnabled === 'boolean') {
    if (!legacy.yazaEnabled) return 'MIDNIGHT_00';
    if (isYazaMode(legacy.dayCutMode)) return legacy.dayCutMode;
    if (isYazaMode(legacy.yazaMode)) return legacy.yazaMode;
    return DEFAULT_YAZA_MODE;
  }

  if (legacy.dayCutMode) return legacy.dayCutMode;
  if (DEFAULT_YAZA_ENABLED) return DEFAULT_YAZA_MODE;
  return 'MIDNIGHT_00';
}

function parseOffsetToken(token: string): number | null {
  const s = token.trim().toUpperCase().replace('UTC', 'GMT');
  if (s === 'GMT' || s === 'GMT+0' || s === 'GMT+00' || s === 'GMT+00:00') return 0;

  // 초 성분까지 허용 — 1908-04 이전 서울 LMT는 'GMT+8:27:52'로 온다 (감사 A15a).
  const m = s.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?(?::(\d{2}))?$/);
  if (!m) return null;

  const sign = m[1] === '-' ? -1 : 1;
  const hh = Number(m[2]);
  const mm = Number(m[3] ?? 0);
  const ss = Number(m[4] ?? 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;

  return sign * Math.round(hh * 60 + mm + ss / 60);
}

let warnedOffsetFallback = false;

function offsetAtUtcMs(utcMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcMs));

    const zoneName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
    const parsed = parseOffsetToken(zoneName);
    if (parsed == null && !warnedOffsetFallback) {
      warnedOffsetFallback = true;
      // 무경고 +09:00 폴백은 약 32분 오차를 침묵시킨다 — 최소한 한 번은 드러낸다 (감사 A15a).
      console.warn(`[saju-ts/springLegacy] failed to parse tz offset token "${zoneName}" (${timeZone}); falling back to +09:00`);
    }
    return parsed ?? 540;
  } catch {
    if (!warnedOffsetFallback) {
      warnedOffsetFallback = true;
      console.warn(`[saju-ts/springLegacy] Intl offset lookup failed for tz "${timeZone}"; falling back to +09:00`);
    }
    return 540;
  }
}

function longZoneNameAtUtcMs(utcMs: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'long' })
      .formatToParts(new Date(utcMs));
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

const DST_SCAN_STEP_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 서머타임(DST) 보정분 실측 (감사 A9).
 *
 * 1) ICU long name이 'Standard'면 0, 'Daylight/Summer'면 DST 확정.
 * 2) 이름이 오프셋 문자열이면(한국 1961년 이전 구간은 ICU 표시명 부재) 전후
 *    각 ±270일 표본으로 판정: DST는 일시적 초과라 양쪽 모두 낮은 표준
 *    오프셋이 보이고, 표준 자오선 변경(1954/1961)은 한쪽에만 보인다.
 *    → 초과분 = offset - max(전측 최소, 후측 최소).
 */
function dstMinutesAtUtcMs(utcMs: number, timeZone: string): number {
  const name = longZoneNameAtUtcMs(utcMs, timeZone);
  if (/standard/i.test(name)) return 0;
  const isNamedDst = /daylight|summer/i.test(name);
  const offset = offsetAtUtcMs(utcMs, timeZone);
  let minBefore = offset;
  let minAfter = offset;
  for (let k = 1; k <= 9; k++) {
    minBefore = Math.min(minBefore, offsetAtUtcMs(utcMs - k * DST_SCAN_STEP_MS, timeZone));
    minAfter = Math.min(minAfter, offsetAtUtcMs(utcMs + k * DST_SCAN_STEP_MS, timeZone));
  }
  const excess = Math.max(0, offset - Math.max(minBefore, minAfter));
  return isNamedDst ? (excess || 60) : excess;
}

function resolveOffsetMinutes(timeZone: string, civil: CivilDateTime): number {
  const parsedFromToken = parseOffsetToken(timeZone);
  if (parsedFromToken != null) return parsedFromToken;

  const utcGuess = Date.UTC(civil.y, civil.m - 1, civil.d, civil.h, civil.min, 0);
  const first = offsetAtUtcMs(utcGuess, timeZone);
  const correctedUtc = utcGuess - first * 60_000;
  const second = offsetAtUtcMs(correctedUtc, timeZone);
  return second;
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function addMinutes(civil: CivilDateTime, deltaMinutes: number): CivilDateTime {
  if (!deltaMinutes) return { ...civil };

  const utcMs = Date.UTC(civil.y, civil.m - 1, civil.d, civil.h, civil.min, 0);
  const shifted = new Date(utcMs + deltaMinutes * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    min: shifted.getUTCMinutes(),
  };
}

function toCivilFromBirthInput(input: LegacyBirthInput): CivilDateTime {
  return {
    y: toInt(input.birthYear, 0),
    m: toInt(input.birthMonth, 1),
    d: toInt(input.birthDay, 1),
    h: clampHour(input.birthHour),
    min: clampMinute(input.birthMinute),
  };
}

function civilToIsoInstant(civil: CivilDateTime, offsetMinutes: number): string {
  const y = String(civil.y).padStart(4, '0');
  const m = String(civil.m).padStart(2, '0');
  const d = String(civil.d).padStart(2, '0');
  const h = String(civil.h).padStart(2, '0');
  const min = String(civil.min).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:00${formatOffset(offsetMinutes)}`;
}

function normalizeTenGod(v: unknown): string {
  const raw = String(v ?? '');
  if (!raw) return '';
  return TEN_GOD_ALIASES[raw] ?? raw;
}

function stemCodeFromIdx(idx: unknown): string {
  const n = Number(idx);
  const normalized = Number.isFinite(n) ? ((Math.trunc(n) % 10) + 10) % 10 : 0;
  return STEM_CODES[normalized] ?? '';
}

function branchCodeFromIdx(idx: unknown): string {
  const n = Number(idx);
  const normalized = Number.isFinite(n) ? ((Math.trunc(n) % 12) + 12) % 12 : 0;
  return BRANCH_CODES[normalized] ?? '';
}

function roundTo(value: unknown, digits: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const scale = 10 ** digits;
  return Math.round(n * scale) / scale;
}

function scoreDiffConfidence(top: number, second: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(second)) return 0.5;
  const diff = top - second;
  if (diff <= 0) return 0.35;
  if (diff >= 1) return 1;
  return Math.max(0.35, Math.min(1, diff));
}

function confidenceToPoints(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  const normalized = Math.max(0, Math.min(1, confidence <= 1 ? confidence : confidence / 100));
  return Math.round(normalized * 100);
}

function ohaengKoLabel(code: unknown): string {
  const normalized = String(code ?? '').trim().toUpperCase();
  const fallback = String(code ?? '').trim();
  return OHAENG_KO_LABEL[normalized] ?? (fallback || '-');
}

function gyeokgukKoLabel(code: unknown): string {
  const normalized = String(code ?? '').trim().toUpperCase();
  const canonical = TEN_GOD_ALIASES[normalized] ?? normalized;
  return GYEOKGUK_KO_LABEL[canonical] ?? GYEOKGUK_KO_LABEL[normalized] ?? (normalized || '-');
}

function buildYongshinReasoning(
  rank: number,
  entry: { element: string; score: number },
  topElement: string,
): string {
  const primaryLabel = ohaengKoLabel(entry.element);
  const topLabel = ohaengKoLabel(topElement || '상위');
  const confidencePoint = confidenceToPoints(Number(entry.score));
  if (rank === 0) {
    return `${primaryLabel} 기운이 가장 강해 용신 1순위입니다 (신뢰도 ${confidencePoint}점).`;
  }
  if (rank === 1) {
    return `${primaryLabel} 기운은 ${topLabel} 기운을 보조하는 희신 후보입니다 (신뢰도 ${confidencePoint}점).`;
  }
  return `${primaryLabel} 기운은 후순위 균형 보완 후보입니다 (신뢰도 ${confidencePoint}점).`;
}

function relationPositionFromBasedOn(v: unknown): string {
  const raw = String(v ?? '');
  if (raw === 'YEAR_BRANCH') return 'YEAR';
  if (raw === 'MONTH_BRANCH') return 'MONTH';
  if (raw === 'DAY_BRANCH') return 'DAY';
  return 'OTHER';
}

function gradeFromQualityWeight(v: unknown): string {
  const weight = Number(v);
  if (!Number.isFinite(weight)) return 'C';
  if (weight >= 0.85) return 'A';
  if (weight >= 0.5) return 'B';
  return 'C';
}

function topTwo(values: Array<{ element: string; score: number }>): [string, string | null] {
  const first = values[0]?.element ?? '';
  const second = values[1]?.element ?? null;
  return [first, second];
}

function deriveGyeokgukBaseSipseong(bestKeyCore: string): string | null {
  const normalized = String(bestKeyCore ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (!GYEOKGUK_BASE_SIPSEONG_KEYS.has(normalized)) return null;
  return normalizeTenGod(normalized);
}

function clamp01(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeGyeokgukKey(value: unknown): string {
  const raw = String(value ?? '').replace(/^gyeokguk\./, '').trim().toUpperCase();
  return TEN_GOD_ALIASES[raw] ?? raw;
}

function isJonggyeokGyeokgukKey(value: string): boolean {
  return value.startsWith('CONG_') || value === 'ZHUAN_WANG';
}

function gyeokgukCategoryCode(value: string): string {
  return isJonggyeokGyeokgukKey(value) ? 'JONGGYEOK' : 'NORMAL';
}

function gyeokgukCandidateRuleNotes(candidate: any): { supportingRules: string[]; blockingRules: string[] } {
  if (!candidate || typeof candidate !== 'object') {
    return { supportingRules: [], blockingRules: [] };
  }

  const reasons = Array.isArray(candidate?.reasons) ? candidate.reasons.map((reason: any) => String(reason)) : [];
  const supportingRules: string[] = [];
  const blockingRules: string[] = [];

  if (candidate?.stem != null) {
    const stem = stemCodeFromIdx(candidate?.stem?.idx ?? candidate?.stem);
    if (stem) supportingRules.push(`monthHiddenStem:${stem}`);
  }

  const role = String(candidate?.role ?? '');
  if (role) supportingRules.push(`role:${role}`);

  const weight = Number(candidate?.weight);
  if (Number.isFinite(weight) && !reasons.some((reason: string) => reason.startsWith('weight:'))) {
    supportingRules.push(`weight:${roundTo(weight, 3)}`);
  }

  if (candidate?.visibleInChart === true) supportingRules.push('visibleInChart');

  for (const reason of reasons) {
    if (reason === 'MONTH_BRANCH_DAMAGED') {
      blockingRules.push(reason);
    } else if (!supportingRules.includes(reason)) {
      supportingRules.push(reason);
    }
  }

  return { supportingRules, blockingRules };
}

function compositeStatus(score: number): string {
  if (score >= 0.6) return 'candidate_evidence';
  if (score >= 0.35) return 'low_confidence_evidence';
  return 'trace_only';
}

function compositeFeature(
  name: keyof typeof COMPOSITE_CLASSICAL_FEATURE_WEIGHTS,
  scoreInput: unknown,
  reason: string,
): any {
  const score = clamp01(scoreInput);
  const weight = COMPOSITE_CLASSICAL_FEATURE_WEIGHTS[name];
  return {
    name,
    score: roundTo(score, 6),
    weight,
    contribution: roundTo(score * weight, 6),
    reason,
  };
}

function elementCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function compositeTransformSupport(ruleFacts: any, element: string): number {
  if (!element) return 0;
  const bestTransform = ruleFacts?.patterns?.transformations?.best;
  const transformElement = elementCode(bestTransform?.resultElement);
  const transformFactor = clamp01(
    bestTransform?.huaqiFactor ??
    bestTransform?.effectiveFactor ??
    bestTransform?.factor ??
    0,
  );

  const oneElement = ruleFacts?.patterns?.elements?.oneElement;
  const oneElementCode = elementCode(oneElement?.element);
  const oneElementFactor = clamp01(oneElement?.zhuanwangFactor ?? oneElement?.factor ?? 0);

  return Math.max(
    transformElement === element ? transformFactor : 0,
    oneElementCode === element ? oneElementFactor * 0.5 : 0,
  );
}

function buildCompositeClassicalScore(args: {
  type: string;
  monthCandidate: any;
  notes: { supportingRules: string[]; blockingRules: string[] };
  ruleFacts: any;
  ranking: any[];
  yongshinRanking: any[];
}): any {
  const { type, monthCandidate, notes, ruleFacts, ranking, yongshinRanking } = args;
  const monthGyeok = ruleFacts?.month?.gyeok ?? {};
  const monthCandidates = Array.isArray(monthGyeok?.candidates) ? monthGyeok.candidates : [];
  const quality = monthGyeok?.quality ?? {};
  const normalizedElements = ruleFacts?.elements?.normalized ?? {};

  const candidateElement = elementCode(monthCandidate?.element);
  const monthMainType = normalizeGyeokgukKey(ruleFacts?.month?.mainTenGod);
  const role = String(monthCandidate?.role ?? '').toUpperCase();
  const maxWeight = Math.max(1e-9, ...monthCandidates.map((candidate: any) => Number(candidate?.weight ?? 0)));
  const maxMonthScore = Math.max(1e-9, ...monthCandidates.map((candidate: any) => Number(candidate?.score ?? 0)));
  const candidateWeight = Number(monthCandidate?.weight ?? 0);
  const candidateFactScore = Number(monthCandidate?.score ?? 0);
  const elementShare = clamp01(normalizedElements?.[candidateElement] ?? 0);
  const rankingScore = clamp01(ranking.find((entry) => normalizeGyeokgukKey(entry?.key) === type)?.score ?? 0);
  const topYongshinElement = elementCode(yongshinRanking[0]?.element);
  const secondYongshinElement = elementCode(yongshinRanking[1]?.element);
  const thirdYongshinElement = elementCode(yongshinRanking[2]?.element);

  const monthMainMatch = type && type === monthMainType ? 1 : 0;
  const stemTransparency = monthCandidate?.visibleInChart === true ? 1 : 0;
  const rootSupport = Math.max(
    clamp01(candidateWeight / maxWeight),
    elementShare,
    clamp01(candidateFactScore / maxMonthScore) * 0.75,
  );
  const roleCommand = role === 'MAIN' ? 1 : role === 'MIDDLE' ? 0.72 : role === 'RESIDUAL' ? 0.45 : 0;
  const seasonalCommand = clamp01(0.65 * roleCommand + 0.35 * clamp01(candidateWeight / maxWeight));
  const transformationSupport = compositeTransformSupport(ruleFacts, candidateElement);
  const qClarity = clamp01(quality?.clarity ?? 1);
  const qIntegrity = clamp01(quality?.integrity ?? 1);
  const qMultiplier = clamp01(quality?.multiplier ?? 1);
  const purityScore = clamp01((qClarity + qIntegrity + qMultiplier) / 3);
  const usefulGodAlignment =
    candidateElement && candidateElement === topYongshinElement
      ? 1
      : candidateElement && candidateElement === secondYongshinElement
        ? 0.6
        : candidateElement && candidateElement === thirdYongshinElement
          ? 0.3
          : 0;
  const sourceTierBoost = 0;
  const stabilityAcrossModes = Math.max(
    rankingScore,
    monthMainMatch,
    stemTransparency ? 0.55 : 0,
  );

  const features = [
    compositeFeature('monthMainMatch', monthMainMatch, monthMainMatch ? 'matches month main hidden ten-god' : 'not the month main hidden ten-god'),
    compositeFeature('stemTransparency', stemTransparency, stemTransparency ? 'hidden stem is transparent in chart stems' : 'hidden stem is not transparent'),
    compositeFeature('rootSupport', rootSupport, `hidden-stem weight ${roundTo(candidateWeight, 3)} and element share ${roundTo(elementShare, 3)}`),
    compositeFeature('seasonalCommand', seasonalCommand, role ? `month hidden role ${role}` : 'no month hidden role'),
    compositeFeature('transformationSupport', transformationSupport, transformationSupport > 0 ? 'matches transformation or one-element signal' : 'no matching transformation signal'),
    compositeFeature('purityScore', purityScore, `quality clarity ${roundTo(qClarity, 3)}, integrity ${roundTo(qIntegrity, 3)}`),
    compositeFeature('usefulGodAlignment', usefulGodAlignment, usefulGodAlignment > 0 ? 'candidate element aligns with yongshin ranking' : 'candidate element does not align with yongshin ranking'),
    compositeFeature('sourceTierBoost', sourceTierBoost, 'engine-derived T2 evidence gets no authority boost'),
    compositeFeature('stabilityAcrossModes', stabilityAcrossModes, `default ranking score ${roundTo(rankingScore, 3)}`),
  ];

  const topScoreGap = clamp01(quality?.details?.gap ?? 0);
  const damagePenalty = clamp01(Number(quality?.damage ?? 0) / 3) * 0.12;
  const brokenPenalty = quality?.broken === true ? 0.12 : 0;
  const mixedPenalty = quality?.mixed === true ? 0.07 : 0;
  const ambiguityPenalty = (1 - topScoreGap) * 0.05;
  const blockingPenalty = notes.blockingRules.length > 0 ? 0.05 : 0;
  const closeCompetitors = monthCandidates.filter((candidate: any) => {
    const otherType = normalizeGyeokgukKey(candidate?.tenGod);
    if (!otherType || otherType === type) return false;
    return Math.abs(Number(candidate?.score ?? 0) - candidateFactScore) <= 0.08;
  }).length;
  const conflictPenalty = Math.min(0.06, closeCompetitors * 0.03);
  const breakerPenalty = roundTo(
    damagePenalty + brokenPenalty + mixedPenalty + ambiguityPenalty + blockingPenalty + conflictPenalty,
    6,
  );
  const rawScore = features.reduce((sum, feature) => sum + Number(feature.contribution ?? 0), 0);
  const score = roundTo(clamp01(rawScore - breakerPenalty), 6);

  return {
    model: 'composite_classical',
    score,
    confidence: score,
    status: compositeStatus(score),
    selectionPolicy: 'evidence_only_never_promote',
    selectedByComposite: false,
    breakerPenalty,
    features,
    basisRules: [
      'month_hidden_stem_candidates',
      'stem_transparency',
      'month_gyeok_quality',
      'transformation_and_one_element_signals',
      'yongshin_element_alignment',
    ],
  };
}

function buildGyeokgukCandidates(bundle: AnalysisBundle, bestKeyCore: string, bestScore: number): any[] {
  const facts = bundle.report?.facts as Record<string, unknown> | undefined;
  const ruleFacts = facts?.['rules.facts'] as any;
  const monthCandidates = Array.isArray(ruleFacts?.month?.gyeok?.candidates)
    ? ruleFacts.month.gyeok.candidates
    : [];

  const monthByType = new Map<string, any>();
  for (const candidate of monthCandidates) {
    const type = normalizeGyeokgukKey(candidate?.tenGod);
    if (!type) continue;
    const existing = monthByType.get(type);
    if (!existing || Number(candidate?.score ?? 0) > Number(existing?.score ?? 0)) {
      monthByType.set(type, candidate);
    }
  }

  const ranking = Array.isArray((bundle.summary?.gyeokguk as any)?.ranking)
    ? (bundle.summary?.gyeokguk as any).ranking
    : [];
  const candidates: any[] = [];
  const seen = new Set<string>();
  const selectedType = normalizeGyeokgukKey(bestKeyCore);

  const addCandidate = (typeInput: unknown, scoreInput: unknown, monthCandidate: any): void => {
    const type = normalizeGyeokgukKey(typeInput);
    if (!type || seen.has(type)) return;
    seen.add(type);

    const score = Number(scoreInput);
    const finalScore = Number.isFinite(score) ? score : 0;
    const notes = gyeokgukCandidateRuleNotes(monthCandidate);
    const compositeClassical = buildCompositeClassicalScore({
      type,
      monthCandidate,
      notes,
      ruleFacts,
      ranking,
      yongshinRanking: Array.isArray((bundle.summary?.yongshin as any)?.ranking)
        ? (bundle.summary?.yongshin as any).ranking
        : [],
    });
    candidates.push({
      type,
      category: gyeokgukCategoryCode(type),
      baseSipseong: deriveGyeokgukBaseSipseong(type),
      score: finalScore,
      confidence: clamp01(finalScore),
      supportingRules: notes.supportingRules,
      blockingRules: notes.blockingRules,
      compositeClassical,
      sourceTier: GYEOKGUK_CANDIDATE_SOURCE_TIER,
    });
  };

  for (const entry of ranking) {
    const type = normalizeGyeokgukKey(entry?.key);
    const score = Number(entry?.score);
    if (type !== selectedType && (!Number.isFinite(score) || score <= MIN_GYEOKGUK_CANDIDATE_SCORE)) continue;
    addCandidate(type, entry?.score, monthByType.get(type));
  }

  for (const candidate of monthCandidates) {
    const score = Number(candidate?.score);
    if (!Number.isFinite(score) || score <= MIN_GYEOKGUK_CANDIDATE_SCORE) continue;
    addCandidate(candidate?.tenGod, candidate?.score, candidate);
  }

  if (bestKeyCore && !seen.has(bestKeyCore)) {
    addCandidate(bestKeyCore, bestScore, monthByType.get(bestKeyCore));
  }

  return candidates.sort((a, b) => {
    if (a.type === selectedType && b.type !== selectedType) return -1;
    if (b.type === selectedType && a.type !== selectedType) return 1;
    return Number(b.score ?? 0) - Number(a.score ?? 0) ||
      Number(b.confidence ?? 0) - Number(a.confidence ?? 0) ||
      String(a.type).localeCompare(String(b.type));
  });
}

function extractGongmangVoidBranches(bundle: AnalysisBundle): [string, string] | [] {
  const facts = bundle.report?.facts as Record<string, unknown> | undefined;
  const ruleFacts = facts?.['rules.facts'] as any;
  const pair = Array.isArray(ruleFacts?.shinsal?.gongmang?.day)
    ? ruleFacts.shinsal.gongmang.day
    : [];

  if (pair.length < 2) return [];
  return [branchCodeFromIdx(pair[0]), branchCodeFromIdx(pair[1])];
}

function relationNoteForType(type: string, table: Record<string, string>): string {
  return table[String(type ?? '').toUpperCase()] ?? '';
}

function relationOutcomeForType(type: string): string | null {
  const normalized = String(type ?? '').toUpperCase();
  return JIJI_RELATION_OUTCOMES[normalized] ?? null;
}

function normalizeLegacyConfig(raw: unknown): LegacySajuConfig {
  if (!isObj(raw)) return {};
  return raw as LegacySajuConfig;
}

function pickEngineConfigPatch(legacy: LegacySajuConfig): Partial<EngineConfig> {
  const patch: Partial<EngineConfig> = {};
  if (legacy.schemaVersion && typeof legacy.schemaVersion === 'string') patch.schemaVersion = legacy.schemaVersion;
  if (legacy.school && isObj(legacy.school)) patch.school = legacy.school;
  if (legacy.calendar && isObj(legacy.calendar)) patch.calendar = legacy.calendar as Partial<EngineConfig['calendar']> as EngineConfig['calendar'];
  if (legacy.toggles && isObj(legacy.toggles)) patch.toggles = legacy.toggles as EngineConfig['toggles'];
  if (legacy.weights && isObj(legacy.weights)) patch.weights = legacy.weights;
  if (legacy.strategies && isObj(legacy.strategies)) patch.strategies = legacy.strategies;
  if (legacy.extensions && isObj(legacy.extensions)) patch.extensions = legacy.extensions;
  return patch;
}

function buildEngineConfig(
  legacy: LegacySajuConfig,
  timeZone: string,
): { config: EngineConfig; dayCutShiftMinutes: number } {
  const dayCut = mapDayCutMode(resolveDayCutMode(legacy));
  const trueSolarTimeEnabled = legacy.trueSolarTimeEnabled ?? DEFAULT_TRUE_SOLAR_TIME_ENABLED;
  const includeEquationOfTime = legacy.includeEquationOfTime ?? true;

  let cfg = cloneConfig();
  cfg.calendar.dayBoundary = dayCut.dayBoundary;
  cfg.calendar.trueSolarTime.enabled = trueSolarTimeEnabled;
  cfg.calendar.trueSolarTime.equationOfTime = trueSolarTimeEnabled && includeEquationOfTime ? 'approx' : 'off';
  cfg.calendar.trueSolarTime.applyTo = 'dayAndHour';
  cfg.calendar.solarTerms = {
    method: 'meeus',
    alwaysCompute: false,
  };

  cfg = deepMerge(cfg, pickEngineConfigPatch(legacy));
  return { config: cfg, dayCutShiftMinutes: dayCut.dayCutShiftMinutes };
}

function inferStandardMeridian(offsetMinutes: number): number {
  return (offsetMinutes / 60) * 15;
}

function effectiveLongitudeForLegacyLmt(
  longitude: number,
  baselineLongitude: number | undefined,
  stdMeridianDeg: number,
): number {
  if (!Number.isFinite(baselineLongitude)) return longitude;
  return longitude - ((baselineLongitude as number) - stdMeridianDeg);
}

function makeRequest(
  input: LegacyBirthInput,
  legacy: LegacySajuConfig,
  dayCutShiftMinutes: number,
): { request: SajuRequest; standard: CivilDateTime; analysisLocal: CivilDateTime } {
  const standard = toCivilFromBirthInput(input);
  const analysisLocal = addMinutes(standard, dayCutShiftMinutes);
  const timeZone = input.timezone ?? DEFAULT_TIMEZONE;
  const offsetMinutes = resolveOffsetMinutes(timeZone, analysisLocal);
  const stdMeridian = inferStandardMeridian(offsetMinutes);
  const rawLongitude = Number.isFinite(input.longitude) ? Number(input.longitude) : DEFAULT_LONGITUDE;
  const latitude = Number.isFinite(input.latitude) ? Number(input.latitude) : DEFAULT_LATITUDE;
  const longitudeCorrectionEnabled = legacy.longitudeCorrectionEnabled ?? DEFAULT_LONGITUDE_CORRECTION_ENABLED;
  const baselineLongitude = Number.isFinite(legacy.lmtBaselineLongitude)
    ? Number(legacy.lmtBaselineLongitude)
    : stdMeridian;

  const effectiveLongitude = longitudeCorrectionEnabled
    ? effectiveLongitudeForLegacyLmt(rawLongitude, baselineLongitude, stdMeridian)
    : rawLongitude;

  const instant = civilToIsoInstant(analysisLocal, offsetMinutes);
  const sex: SajuRequest['sex'] = input.gender === 'FEMALE' ? 'F' : 'M';

  return {
    request: {
      birth: { instant, calendar: 'gregorian' },
      sex,
      location: {
        lat: latitude,
        lon: effectiveLongitude,
        name: input.name,
      },
    },
    standard,
    analysisLocal,
  };
}

function getSummaryPillars(bundle: AnalysisBundle) {
  return bundle.summary?.pillars ?? {
    year: { stem: { idx: 0 }, branch: { idx: 0 } },
    month: { stem: { idx: 0 }, branch: { idx: 0 } },
    day: { stem: { idx: 0 }, branch: { idx: 0 } },
    hour: { stem: { idx: 0 }, branch: { idx: 0 } },
  };
}

function extractDeficientAndExcessive(distribution: Record<string, number>): {
  deficientElements: string[];
  excessiveElements: string[];
} {
  const entries = Object.entries(distribution);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (total <= 0) return { deficientElements: [], excessiveElements: [] };

  const avg = total / 5;
  const deficientElements: string[] = [];
  const excessiveElements: string[] = [];

  for (const code of OHAENG_CODES) {
    const v = Number(distribution[code] ?? 0);
    if (v === 0 || v <= avg * DEFICIENT_AVERAGE_RATIO) deficientElements.push(code);
    else if (v >= avg * EXCESSIVE_AVERAGE_RATIO) excessiveElements.push(code);
  }

  return { deficientElements, excessiveElements };
}

function normalizePositionKey(position: 'year' | 'month' | 'day' | 'hour'): 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' {
  if (position === 'year') return 'YEAR';
  if (position === 'month') return 'MONTH';
  if (position === 'day') return 'DAY';
  return 'HOUR';
}

// 일간을 돕는 십성 (비겁 + 인성). engine 철자 기준 (GEOB_JAE — legacy 별칭 GYEOB_JAE 아님).
const DEUK_SUPPORT_TEN_GODS = new Set(['BI_GYEON', 'GEOB_JAE', 'JEONG_IN', 'PYEON_IN']);
// 통근(같은 오행) = 비견/겁재.
const DEUK_COMPANION_TEN_GODS = new Set(['BI_GYEON', 'GEOB_JAE']);
const DEUK_ROOT_GRADE: Record<string, number> = { MAIN: 1, MIDDLE: 0.6, RESIDUAL: 0.3 };

/**
 * 실제 득령/득지/득세 판정 (감사 A1 — 기존에는 십성 점수 재라벨이었다).
 *
 * - 득령(0|1): 월지 본기 십성이 비겁·인성인가 (월령을 얻음).
 * - 득지(0~1): 일지 지장간 통근(비견·겁재) 강도 — 본기 1 > 중기 0.6 > 여기 0.3.
 * - 득세(0~7): 일간 제외 7글자(년·월·시 천간 + 4지지 본기) 중 비겁·인성 개수.
 */
function computeDeukScores(
  tenGods: any,
  hiddenStemTenGods: any,
): { deukryeong: number; deukji: number; deukse: number } {
  const listOf = (pos: string): any[] =>
    Array.isArray(hiddenStemTenGods?.[pos]) ? hiddenStemTenGods[pos] : [];
  const mainOf = (pos: string): any => {
    const list = listOf(pos);
    return list.find((e: any) => e?.role === 'MAIN') ?? list[0];
  };

  const deukryeong = DEUK_SUPPORT_TEN_GODS.has(String(mainOf('month')?.tenGod ?? '')) ? 1 : 0;

  let deukji = 0;
  for (const e of listOf('day')) {
    if (!DEUK_COMPANION_TEN_GODS.has(String(e?.tenGod ?? ''))) continue;
    deukji = Math.max(deukji, DEUK_ROOT_GRADE[String(e?.role ?? '')] ?? 0.3);
  }

  let deukse = 0;
  for (const key of ['yearStem', 'monthStem', 'hourStem'] as const) {
    if (DEUK_SUPPORT_TEN_GODS.has(String(tenGods?.[key] ?? ''))) deukse += 1;
  }
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    if (DEUK_SUPPORT_TEN_GODS.has(String(mainOf(pos)?.tenGod ?? ''))) deukse += 1;
  }

  return { deukryeong, deukji, deukse };
}

function normalizeLegacyOutput(
  bundle: AnalysisBundle,
  standard: CivilDateTime,
  daeunCount?: number,
  saeunStartYear?: number | null,
  saeunYearCount?: number,
  timeZone?: string,
) {
  const facts = bundle.report?.facts as Record<string, unknown>;
  const correction = (facts?.['time.trueSolarCorrection'] ?? {}) as TrueSolarCorrectionView;
  const adjustedFact = (facts?.['time.solarLocalDateTime'] ?? facts?.['time.localDateTimeForHour'] ?? null) as any;

  const adjusted = adjustedFact?.date && adjustedFact?.time
    ? {
        y: toInt(adjustedFact.date.y, standard.y),
        m: toInt(adjustedFact.date.m, standard.m),
        d: toInt(adjustedFact.date.d, standard.d),
        h: toInt(adjustedFact.time.h, standard.h),
        min: toInt(adjustedFact.time.min, standard.min),
      }
    : addMinutes(standard, Math.round(Number(correction.totalCorrectionMinutes ?? 0)));

  // 서머타임 보정 실측치 — 기존에는 0 하드코딩으로 미보정 서비스처럼 표기됐다 (감사 A9).
  const tz = timeZone ?? DEFAULT_TIMEZONE;
  const offsetAtBirth = resolveOffsetMinutes(tz, standard);
  const birthUtcMs = Date.UTC(standard.y, standard.m - 1, standard.d, standard.h, standard.min, 0) - offsetAtBirth * 60_000;
  const dstCorrectionMinutes = dstMinutesAtUtcMs(birthUtcMs, tz);

  const pillars = getSummaryPillars(bundle);
  const yearStemCode = stemCodeFromIdx(pillars.year.stem.idx);
  const yearBranchCode = branchCodeFromIdx(pillars.year.branch.idx);
  const monthStemCode = stemCodeFromIdx(pillars.month.stem.idx);
  const monthBranchCode = branchCodeFromIdx(pillars.month.branch.idx);
  const dayStemCode = stemCodeFromIdx(pillars.day.stem.idx);
  const dayBranchCode = branchCodeFromIdx(pillars.day.branch.idx);
  const hourStemCode = stemCodeFromIdx(pillars.hour.stem.idx);
  const hourBranchCode = branchCodeFromIdx(pillars.hour.branch.idx);

  const strength = bundle.summary?.strength as any;
  const strengthIndex = Number(strength?.index ?? 0);
  const support = Number(strength?.support ?? 0);
  const pressure = Number(strength?.pressure ?? 0);
  const components = strength?.components ?? {};
  const strengthLevelCode = strengthIndex >= 0.15 ? 'STRONG' : strengthIndex <= -0.15 ? 'WEAK' : 'BALANCED';
  const strengthLevelKo = strengthLevelCode === 'STRONG' ? '신강' : strengthLevelCode === 'WEAK' ? '신약' : '중화';

  const yongshin = bundle.summary?.yongshin as any;
  const yongshinRanking: Array<{ element: string; score: number }> = Array.isArray(yongshin?.ranking)
    ? yongshin.ranking.map((item: any) => ({
        element: String(item?.element ?? ''),
        score: Number(item?.score ?? 0),
      }))
    : [];
  const [topElement, secondElement] = topTwo(yongshinRanking);
  const worst = yongshinRanking.length ? yongshinRanking[yongshinRanking.length - 1]?.element ?? null : null;
  const secondWorst = yongshinRanking.length > 1 ? yongshinRanking[yongshinRanking.length - 2]?.element ?? null : null;
  const topScore = Number(yongshinRanking[0]?.score ?? 0);
  const secondScore = Number(yongshinRanking[1]?.score ?? 0);
  const yongshinConfidence = scoreDiffConfidence(topScore, secondScore);
  const yongshinConfidencePoints = confidenceToPoints(yongshinConfidence);
  const yongshinConsensus =
    yongshin?.consensus && typeof yongshin.consensus === 'object'
      ? yongshin.consensus
      : undefined;

  const gyeokguk = bundle.summary?.gyeokguk as any;
  const bestKey = String(gyeokguk?.best ?? '');
  const bestKeyCore = bestKey.replace(/^gyeokguk\./, '');
  const baseSipseong = deriveGyeokgukBaseSipseong(bestKeyCore);
  const bestScore = Number(gyeokguk?.ranking?.[0]?.score ?? 0);
  const isJonggyeok = bestKeyCore.startsWith('CONG_') || bestKeyCore === 'ZHUAN_WANG';
  const gyeokgukCandidates = buildGyeokgukCandidates(bundle, bestKeyCore, bestScore);
  const jonggyeokCandidates = Array.isArray(gyeokguk?.jonggyeokCandidates)
    ? gyeokguk.jonggyeokCandidates
    : [];

  const totalDistribution = (bundle.summary?.elementDistribution as any)?.total ?? {};
  const ohaengDistribution = {
    WOOD: roundTo(totalDistribution.WOOD ?? 0, DISTRIBUTION_ROUND_DIGITS),
    FIRE: roundTo(totalDistribution.FIRE ?? 0, DISTRIBUTION_ROUND_DIGITS),
    EARTH: roundTo(totalDistribution.EARTH ?? 0, DISTRIBUTION_ROUND_DIGITS),
    METAL: roundTo(totalDistribution.METAL ?? 0, DISTRIBUTION_ROUND_DIGITS),
    WATER: roundTo(totalDistribution.WATER ?? 0, DISTRIBUTION_ROUND_DIGITS),
  };
  const { deficientElements, excessiveElements } = extractDeficientAndExcessive(ohaengDistribution);

  const stemRelations = Array.isArray(bundle.summary?.stemRelations) ? bundle.summary.stemRelations : [];
  const cheonganRelations = stemRelations.map((relation: any) => ({
    type: String(relation?.type ?? ''),
    members: Array.isArray(relation?.members) ? relation.members.map((m: any) => stemCodeFromIdx(m?.idx)) : [],
    resultOhaeng: relation?.resultElement ? String(relation.resultElement) : null,
    note: relationNoteForType(String(relation?.type ?? ''), CHEONGAN_RELATION_NOTES),
  }));

  const branchRelations = Array.isArray(bundle.summary?.relations) ? bundle.summary.relations : [];
  const jijiRelations = branchRelations.map((relation: any) => {
    const type = String(relation?.type ?? '');
    const note = relationNoteForType(type, JIJI_RELATION_NOTES);
    return {
      type,
      members: Array.isArray(relation?.members) ? relation.members.map((m: any) => branchCodeFromIdx(m?.idx)) : [],
      note,
      outcome: relationOutcomeForType(type),
      reasoning: null,
    };
  });

  const tenGods = bundle.summary?.tenGods as any;
  const hiddenStems = bundle.summary?.hiddenStems as any;
  const hiddenStemTenGods = bundle.summary?.tenGodsHiddenStems as any;
  const deuk = computeDeukScores(tenGods, hiddenStemTenGods);

  // 12운성 — 엔진이 항상 계산하는데 legacy 변환에서 통째로 버려지던 것을 배선 (감사 C1).
  // adapter extractSibiUnseong이 기대하는 {기둥: 한글 운성} 형태로 방출한다.
  const lifeStages = bundle.summary?.lifeStages as any;
  const sibiUnseong = lifeStages
    ? Object.fromEntries(
        (['year', 'month', 'day', 'hour'] as const)
          .filter((pos) => lifeStages[pos] != null)
          .map((pos) => [pos, LIFE_STAGE_KO[String(lifeStages[pos])] ?? String(lifeStages[pos])]),
      )
    : null;

  const byPosition: Record<string, any> = {};

  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const key = normalizePositionKey(pos);
    const principalList = Array.isArray(hiddenStemTenGods?.[pos]) ? hiddenStemTenGods[pos] : [];
    const hiddenList = Array.isArray(hiddenStems?.[pos]) ? hiddenStems[pos] : [];

    byPosition[key] = {
      cheonganSipseong:
        pos === 'year'
          ? normalizeTenGod(tenGods?.yearStem)
          : pos === 'month'
            ? normalizeTenGod(tenGods?.monthStem)
            : pos === 'hour'
              ? normalizeTenGod(tenGods?.hourStem)
              : 'BI_GYEON',
      jijiPrincipalSipseong: normalizeTenGod(principalList[0]?.tenGod),
      hiddenStems: hiddenList.map((entry: any) => ({
        stem: stemCodeFromIdx(entry?.stem?.idx),
        ratio: Number(entry?.weight ?? 0),
      })),
      hiddenStemSipseong: principalList.map((entry: any) => ({
        entry: { stem: stemCodeFromIdx(entry?.stem?.idx) },
        sipseong: normalizeTenGod(entry?.tenGod),
      })),
    };
  }

  const shinsalHitsRaw = Array.isArray(bundle.summary?.shinsalHits) ? bundle.summary.shinsalHits : [];
  const SEAT_ORDER = ['year', 'month', 'day', 'hour'] as const;
  type SeatPillar = (typeof SEAT_ORDER)[number];
  const weightedByKey = new Map<string, {
    hit: { type: string; position: string; grade: string; basedOn: string; seatPillars: SeatPillar[] };
    baseWeight: number;
    positionMultiplier: number;
    weightedScore: number;
    count: number;
  }>();
  for (const hit of shinsalHitsRaw) {
    const type = String(hit?.name ?? '');
    // position은 산출 기준(basedOn)의 축약이지 앉은 궁위가 아니다 — 궁위는 seatPillars.
    // dedupe 키·position 의미는 소비자 하위호환을 위해 불변 유지 (감사 C2/A4).
    const position = relationPositionFromBasedOn(hit?.basedOn);
    const basedOn = String(hit?.basedOn ?? 'OTHER');
    const seatPillars = (Array.isArray(hit?.matchedPillars) ? hit.matchedPillars : [])
      .filter((p: unknown): p is SeatPillar => SEAT_ORDER.includes(p as SeatPillar));
    const grade = gradeFromQualityWeight(hit?.qualityWeight);
    const qualityWeight = Number(hit?.qualityWeight ?? 0.6);
    const positionMultiplier = 1;
    const baseWeight = Math.max(0, Math.min(100, Math.round(qualityWeight * 100)));
    const weightedScore = baseWeight * positionMultiplier;
    const payload = {
      hit: { type, position, grade, basedOn, seatPillars },
      baseWeight,
      positionMultiplier,
      weightedScore,
      count: 1,
    };
    const dedupeKey = `${type}|${position}`;
    const existing = weightedByKey.get(dedupeKey);
    if (!existing) {
      weightedByKey.set(dedupeKey, payload);
    } else {
      // 같은 키 중복 발동: 높은 점수 페이로드를 유지하되 앉은 기둥은 합집합,
      // 발동 횟수는 count로 보존 (기존에는 소거되어 소실 — 감사 C2/A15).
      const winner = weightedScore > existing.weightedScore ? payload : existing;
      winner.hit.seatPillars = SEAT_ORDER.filter(
        (p) => existing.hit.seatPillars.includes(p) || seatPillars.includes(p),
      );
      winner.count = existing.count + 1;
      weightedByKey.set(dedupeKey, winner);
    }
  }
  const weightedShinsalHits = [...weightedByKey.values()];
  const shinsalHits = weightedShinsalHits.map((item) => item.hit);
  const gongmangVoidBranches = extractGongmangVoidBranches(bundle);

  const fortune = bundle.summary?.fortune as any;
  const decades = Array.isArray(fortune?.decades) ? fortune.decades : [];
  const yearsAll = Array.isArray(fortune?.years) ? fortune.years : [];
  const yearsFiltered = typeof saeunStartYear === 'number'
    ? yearsAll.filter((y: any) => Number(y?.solarYear) >= saeunStartYear)
    : yearsAll;
  const years = typeof saeunYearCount === 'number' && saeunYearCount > 0
    ? yearsFiltered.slice(0, saeunYearCount)
    : yearsFiltered;
  const daeunPillars = (typeof daeunCount === 'number' && daeunCount > 0 ? decades.slice(0, daeunCount) : decades)
    .map((entry: any) => ({
      pillar: {
        cheongan: stemCodeFromIdx(entry?.pillar?.stem?.idx),
        jiji: branchCodeFromIdx(entry?.pillar?.branch?.idx),
      },
      startAge: Number(entry?.startAgeYears ?? 0),
      endAge: Number(entry?.endAgeYears ?? 0),
      order: Number(entry?.index ?? 0),
    }));

  const saeunPillars = years.map((entry: any) => ({
    year: Number(entry?.solarYear ?? 0),
    pillar: {
      cheongan: stemCodeFromIdx(entry?.pillar?.stem?.idx),
      jiji: branchCodeFromIdx(entry?.pillar?.branch?.idx),
    },
  }));

  const traceNodes = Array.isArray(bundle.report?.trace?.nodes) ? bundle.report.trace.nodes : [];
  const trace = traceNodes.map((node: any) => ({
    key: String(node?.id ?? ''),
    summary: String(node?.formula ?? node?.explain ?? ''),
    evidence: Array.isArray(node?.deps) ? node.deps.map(String) : [],
    citations: [],
    reasoning: node?.explain ? [String(node.explain)] : [],
    confidence: null,
  }));

  return {
    pillars: {
      year: { cheongan: yearStemCode, jiji: yearBranchCode },
      month: { cheongan: monthStemCode, jiji: monthBranchCode },
      day: { cheongan: dayStemCode, jiji: dayBranchCode },
      hour: { cheongan: hourStemCode, jiji: hourBranchCode },
    },
    coreResult: {
      standardYear: standard.y,
      standardMonth: standard.m,
      standardDay: standard.d,
      standardHour: standard.h,
      standardMinute: standard.min,
      adjustedYear: adjusted.y,
      adjustedMonth: adjusted.m,
      adjustedDay: adjusted.d,
      adjustedHour: adjusted.h,
      adjustedMinute: adjusted.min,
      dstCorrectionMinutes,
      longitudeCorrectionMinutes: Number(correction.longitudeCorrectionMinutes ?? 0),
      equationOfTimeMinutes: Number(correction.equationOfTimeMinutes ?? 0),
    },
    strengthResult: {
      dayMasterElement: String((pillars as any)?.day?.stem?.element ?? ''),
      level: strengthLevelCode,
      isStrong: strengthIndex >= 0,
      score: {
        totalSupport: support,
        totalOppose: pressure,
        deukryeong: deuk.deukryeong,
        deukji: deuk.deukji,
        deukse: deuk.deukse,
      },
      details: [
        `강약 판정: ${strengthLevelKo}`,
        `강약 지수: ${strengthIndex.toFixed(3)}`,
        `생조 합: ${support.toFixed(3)}`,
        `극설 합: ${pressure.toFixed(3)}`,
        `득령 ${deuk.deukryeong ? '○' : '×'} · 득지 ${deuk.deukji > 0 ? '○' : '×'} · 득세 ${deuk.deukse}/7`,
      ],
    },
    yongshinResult: {
      finalYongshin: topElement,
      finalHeesin: secondElement,
      gisin: worst,
      gusin: secondWorst,
      finalConfidence: yongshinConfidencePoints,
      agreement: 'RANKING',
      consensus: yongshinConsensus,
      recommendations: yongshinRanking.slice(0, 3).map((entry: { element: string; score: number }, i: number) => ({
        // 이 브리지의 기본 정책은 climate weight 0(조후 비활성) — 랭킹은 순수
        // 억부(balance+role) 산출이므로 'EOKBU'가 정직한 라벨이다 (감사 A2.
        // 설정이 다양해지면 실제 지배 방법에서 유도할 것).
        type: i === 0 ? 'EOKBU' : 'RANKING',
        primaryElement: entry.element,
        secondaryElement: yongshinRanking[i + 1]?.element ?? null,
        confidence: confidenceToPoints(Math.max(0, Math.min(1, Number(entry.score)))),
        reasoning: buildYongshinReasoning(i, entry, topElement),
      })),
    },
    gyeokgukResult: {
      type: bestKeyCore,
      category: isJonggyeok ? 'JONGGYEOK' : 'NORMAL',
      baseSipseong,
      confidence: Math.max(0, Math.min(1, bestScore)),
      reasoning: bestKeyCore
        ? `격국 후보 중 ${gyeokgukKoLabel(bestKeyCore)}이(가) 가장 유력합니다.`
        : '격국 후보를 확정하기 어려워 추가 검토가 필요합니다.',
      candidates: gyeokgukCandidates,
      jonggyeokCandidates,
    },
    ohaengDistribution,
    deficientElements,
    excessiveElements,
    cheonganRelations,
    scoredCheonganRelations: [],
    jijiRelations,
    resolvedJijiRelations: [],
    tenGodAnalysis: {
      dayMaster: dayStemCode,
      byPosition,
    },
    shinsalHits,
    weightedShinsalHits,
    shinsalComposites: [],
    sibiUnseong,
    gongmangVoidBranches,
    daeunInfo: {
      isForward: String(fortune?.start?.direction ?? 'FORWARD') !== 'BACKWARD',
      firstDaeunStartAge: Number(fortune?.start?.startAgeYears ?? 0),
      firstDaeunStartMonths: Number(fortune?.start?.startAgeParts?.months ?? 0),
      // 대운 기산 절기 id (기존에는 무관한 일경계 정책 dayBoundary가 들어갔다 — 감사 A15d).
      boundaryMode: String(fortune?.start?.boundary?.id ?? ''),
      boundaryUtcMs: fortune?.start?.boundary?.utcMs ?? null,
      deltaDays: Number.isFinite(fortune?.start?.deltaMs)
        ? roundTo(Number(fortune.start.deltaMs) / 86_400_000, 3)
        : null,
      formula: String(fortune?.start?.formula ?? ''),
      warnings: [],
      daeunPillars,
    },
    saeunPillars,
    trace,
  };
}

export function createBirthInput(params: LegacyBirthInput): LegacyBirthInput {
  return {
    birthYear: toInt(params.birthYear, 0),
    birthMonth: toInt(params.birthMonth, 1),
    birthDay: toInt(params.birthDay, 1),
    birthHour: clampHour(params.birthHour),
    birthMinute: clampMinute(params.birthMinute),
    gender: params.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
    calendarType: params.calendarType === 'LUNAR' ? 'LUNAR' : 'SOLAR',
    isLeapMonth: params.isLeapMonth,
    timezone: params.timezone ?? DEFAULT_TIMEZONE,
    latitude: Number.isFinite(params.latitude) ? Number(params.latitude) : DEFAULT_LATITUDE,
    longitude: Number.isFinite(params.longitude) ? Number(params.longitude) : DEFAULT_LONGITUDE,
    name: params.name,
  };
}

export function configFromPreset(preset: string): LegacySajuConfig {
  const key = String(preset ?? '').trim().toUpperCase();
  return { ...(PRESET_CONFIGS[key] ?? PRESET_CONFIGS.KOREAN_MAINSTREAM) };
}

export function analyzeSaju(
  birthInput: LegacyBirthInput,
  rawConfig?: unknown,
  options?: LegacySajuOptions,
) {
  const normalizedInput = createBirthInput(birthInput);
  if (normalizedInput.calendarType === 'LUNAR') {
    throw new Error('Legacy lunar input is not supported in the current engine bridge.');
  }

  const legacy = normalizeLegacyConfig(rawConfig);
  const tz = normalizedInput.timezone ?? DEFAULT_TIMEZONE;
  const { config, dayCutShiftMinutes } = buildEngineConfig(legacy, tz);
  const { request, standard } = makeRequest(normalizedInput, legacy, dayCutShiftMinutes);

  const engine = createEngine(config);
  const bundle = engine.analyze(request);
  return normalizeLegacyOutput(
    bundle,
    standard,
    options?.daeunCount,
    options?.saeunStartYear,
    options?.saeunYearCount,
    tz,
  );
}
