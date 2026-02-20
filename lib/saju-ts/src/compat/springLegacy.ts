import { createEngine } from '../api/engine.js';
import { defaultConfig } from '../api/config.js';
import type { AnalysisBundle, EngineConfig, SajuRequest } from '../api/types.js';

const STEM_CODES = ['GAP', 'EUL', 'BYEONG', 'JEONG', 'MU', 'GI', 'GYEONG', 'SIN', 'IM', 'GYE'] as const;
const BRANCH_CODES = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'] as const;

const DEFAULT_LATITUDE = 37.5665;
const DEFAULT_LONGITUDE = 126.978;
const DEFAULT_TIMEZONE = 'Asia/Seoul';

const TEN_GOD_ALIASES: Record<string, string> = {
  GEOB_JAE: 'GYEOB_JAE',
  SIK_SHIN: 'SIK_SIN',
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

  const m = s.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return null;

  const sign = m[1] === '-' ? -1 : 1;
  const hh = Number(m[2]);
  const mm = Number(m[3] ?? 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  return sign * (hh * 60 + mm);
}

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
    return parseOffsetToken(zoneName) ?? 540;
  } catch {
    return 540;
  }
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

function scoreDiffConfidence(top: number, second: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(second)) return 0.5;
  const diff = top - second;
  if (diff <= 0) return 0.35;
  if (diff >= 1) return 1;
  return Math.max(0.35, Math.min(1, diff));
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

  for (const code of ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']) {
    const v = Number(distribution[code] ?? 0);
    if (v === 0 || v <= avg * 0.4) deficientElements.push(code);
    else if (v >= avg * 2.0) excessiveElements.push(code);
  }

  return { deficientElements, excessiveElements };
}

function normalizePositionKey(position: 'year' | 'month' | 'day' | 'hour'): 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' {
  if (position === 'year') return 'YEAR';
  if (position === 'month') return 'MONTH';
  if (position === 'day') return 'DAY';
  return 'HOUR';
}

function normalizeLegacyOutput(
  bundle: AnalysisBundle,
  standard: CivilDateTime,
  daeunCount?: number,
  saeunStartYear?: number | null,
  saeunYearCount?: number,
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

  const gyeokguk = bundle.summary?.gyeokguk as any;
  const bestKey = String(gyeokguk?.best ?? '');
  const bestKeyCore = bestKey.replace(/^gyeokguk\./, '');
  const bestScore = Number(gyeokguk?.ranking?.[0]?.score ?? 0);
  const isJonggyeok = bestKeyCore.startsWith('CONG_') || bestKeyCore === 'ZHUAN_WANG';

  const totalDistribution = (bundle.summary?.elementDistribution as any)?.total ?? {};
  const ohaengDistribution = {
    WOOD: Number(totalDistribution.WOOD ?? 0),
    FIRE: Number(totalDistribution.FIRE ?? 0),
    EARTH: Number(totalDistribution.EARTH ?? 0),
    METAL: Number(totalDistribution.METAL ?? 0),
    WATER: Number(totalDistribution.WATER ?? 0),
  };
  const { deficientElements, excessiveElements } = extractDeficientAndExcessive(ohaengDistribution);

  const stemRelations = Array.isArray(bundle.summary?.stemRelations) ? bundle.summary.stemRelations : [];
  const cheonganRelations = stemRelations.map((relation: any) => ({
    type: String(relation?.type ?? ''),
    members: Array.isArray(relation?.members) ? relation.members.map((m: any) => stemCodeFromIdx(m?.idx)) : [],
    resultOhaeng: relation?.resultElement ? String(relation.resultElement) : null,
    note: '',
  }));

  const branchRelations = Array.isArray(bundle.summary?.relations) ? bundle.summary.relations : [];
  const jijiRelations = branchRelations.map((relation: any) => ({
    type: String(relation?.type ?? ''),
    members: Array.isArray(relation?.members) ? relation.members.map((m: any) => branchCodeFromIdx(m?.idx)) : [],
    note: '',
  }));

  const tenGods = bundle.summary?.tenGods as any;
  const hiddenStems = bundle.summary?.hiddenStems as any;
  const hiddenStemTenGods = bundle.summary?.tenGodsHiddenStems as any;
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
  const shinsalHits = shinsalHitsRaw.map((hit: any) => ({
    type: String(hit?.name ?? ''),
    position: relationPositionFromBasedOn(hit?.basedOn),
    grade: gradeFromQualityWeight(hit?.qualityWeight),
  }));
  const weightedShinsalHits = shinsalHitsRaw.map((hit: any) => {
    const qualityWeight = Number(hit?.qualityWeight ?? 0.6);
    const positionMultiplier = 1;
    const baseWeight = Math.max(0, Math.min(100, Math.round(qualityWeight * 100)));
    const weightedScore = baseWeight * positionMultiplier;
    return {
      hit: {
        type: String(hit?.name ?? ''),
        position: relationPositionFromBasedOn(hit?.basedOn),
        grade: gradeFromQualityWeight(hit?.qualityWeight),
      },
      baseWeight,
      positionMultiplier,
      weightedScore,
    };
  });

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
      dstCorrectionMinutes: 0,
      longitudeCorrectionMinutes: Number(correction.longitudeCorrectionMinutes ?? 0),
      equationOfTimeMinutes: Number(correction.equationOfTimeMinutes ?? 0),
    },
    strengthResult: {
      dayMasterElement: String((pillars as any)?.day?.stem?.element ?? ''),
      level: strengthIndex >= 0.15 ? 'STRONG' : strengthIndex <= -0.15 ? 'WEAK' : 'BALANCED',
      isStrong: strengthIndex >= 0,
      score: {
        totalSupport: support,
        totalOppose: pressure,
        deukryeong: Number(components.companions ?? 0),
        deukji: Number(components.resources ?? 0),
        deukse: Number(components.companions ?? 0) + Number(components.resources ?? 0),
      },
      details: [
        `strength.index=${strengthIndex.toFixed(3)}`,
        `strength.support=${support.toFixed(3)}`,
        `strength.pressure=${pressure.toFixed(3)}`,
      ],
    },
    yongshinResult: {
      finalYongshin: topElement,
      finalHeesin: secondElement,
      gisin: worst,
      gusin: secondWorst,
      finalConfidence: yongshinConfidence,
      agreement: 'RANKING',
      recommendations: yongshinRanking.slice(0, 3).map((entry: { element: string; score: number }, i: number) => ({
        type: i === 0 ? 'JOHU' : 'RANKING',
        primaryElement: entry.element,
        secondaryElement: yongshinRanking[i + 1]?.element ?? null,
        confidence: Math.max(0, Math.min(1, Number(entry.score))),
        reasoning: 'Derived from yongshin ranking score.',
      })),
    },
    gyeokgukResult: {
      type: bestKeyCore,
      category: isJonggyeok ? 'JONGGYEOK' : 'NORMAL',
      baseSipseong: null,
      confidence: Math.max(0, Math.min(1, bestScore)),
      reasoning: `Top candidate: ${bestKey || '-'}`,
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
    gongmangVoidBranches: [],
    daeunInfo: {
      isForward: String(fortune?.start?.direction ?? 'FORWARD') !== 'BACKWARD',
      firstDaeunStartAge: Number(fortune?.start?.startAgeYears ?? 0),
      firstDaeunStartMonths: Number(fortune?.start?.startAgeParts?.months ?? 0),
      boundaryMode: String((bundle.report?.facts as any)?.['policy.calendar']?.dayBoundary ?? ''),
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
  );
}
