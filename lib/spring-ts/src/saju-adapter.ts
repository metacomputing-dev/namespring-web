/**
 * saju-adapter.ts
 *
 * Translates raw saju-ts output into the SajuSummary format used by the rest
 * of the Spring engine.  Think of this as the "interpreter" that sits between
 * the low-level Four Pillars engine and the user-facing scoring pipeline.
 *
 * ── Glossary (사주 四柱) ──────────────────────────────────────────────────
 *  Cheongan (천간)        10 Heavenly Stems  — GAP, EUL, BYEONG ...
 *  Jiji (지지)            12 Earthly Branches — JA, CHUK, IN ...
 *  Ohaeng (오행)          Five Elements       — WOOD, FIRE, EARTH, METAL, WATER
 *  Yongshin (용신)        The "helpful god" element that balances the chart
 *  Heesin (희신)          The supporting element that assists yongshin
 *  Gisin (기신)           The harmful element that weakens the chart
 *  Gusin (구신)           The most harmful element — worse than gisin
 *  Sipseong (십성)        Ten Gods — relationships between stems
 *  Gyeokguk (격국)        Structural pattern of the chart
 *  Shinsal (신살)         Auspicious/inauspicious markers
 *  Gongmang (공망)        "Void" branches in the chart
 *  Daeun (대운)           Major luck cycles (10-year periods)
 * ─────────────────────────────────────────────────────────────────────────
 */
import { type ElementKey, emptyDistribution } from './core/scoring.js';
import type { SajuOutputSummary, SpringRequest, SajuSummary, PillarSummary, BirthInfo } from './types.js';

// ---------------------------------------------------------------------------
//  Configuration — loaded from JSON files so non-programmers can tweak them
// ---------------------------------------------------------------------------
import cheonganJijiConfig from '../config/cheongan-jiji.json';
import engineConfig from '../config/engine.json';
import sajuScoringConfig from '../config/saju-scoring.json';

/** Maps uppercase element codes ("WOOD") to display keys ("Wood"). */
const ELEMENT_CODE_TO_KEY: Record<string, ElementKey> = cheonganJijiConfig.elementCodeToKey as Record<string, ElementKey>;

/** Canonical list of the five elements in order. */
const ELEMENT_CODES: readonly string[] = cheonganJijiConfig.elementCodes;

/** Heavenly Stems reference table — hangul, hanja, element, polarity. */
const CHEONGAN: Record<string, { hangul: string; hanja: string; element: string; polarity: string }> = cheonganJijiConfig.cheongan;

/** Earthly Branches reference table — hangul, hanja. */
const JIJI: Record<string, { hangul: string; hanja: string }> = cheonganJijiConfig.jiji;

/** Maps each ten-god name to its group: friend/output/wealth/authority/resource. */
const TEN_GOD_GROUP: Record<string, string> = sajuScoringConfig.tenGodGroups;

/** Maps user-facing preset names ("korean") to internal preset codes ("KOREAN_MAINSTREAM"). */
const PRESET_MAP: Record<string, string> = engineConfig.presetMapping;

/** Relative path used to dynamically import the saju-ts engine. */
const SAJU_MODULE_PATH: string = engineConfig.sajuModulePath;

/** Default coordinates (Seoul) and timezone for birth info. */
const DEFAULT_LATITUDE: number = engineConfig.defaultCoordinates.latitude;
const DEFAULT_LONGITUDE: number = engineConfig.defaultCoordinates.longitude;
const DEFAULT_TIMEZONE: string = engineConfig.defaultTimezone;
const DEFAULT_UNKNOWN_HOUR = 12;
const DEFAULT_UNKNOWN_MINUTE = 0;

const YEAR_STEM_CODES = ['GAP', 'EUL', 'BYEONG', 'JEONG', 'MU', 'GI', 'GYEONG', 'SIN', 'IM', 'GYE'] as const;
const YEAR_BRANCH_CODES = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'] as const;
const HOUR_BRANCH_CODES = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'] as const;

// ---------------------------------------------------------------------------
//  Type-safe constant — defines the shape of the time-correction object
// ---------------------------------------------------------------------------
const TC_KEYS = [
  'standardYear', 'standardMonth', 'standardDay', 'standardHour', 'standardMinute',
  'adjustedYear', 'adjustedMonth', 'adjustedDay', 'adjustedHour', 'adjustedMinute',
  'dstCorrectionMinutes', 'longitudeCorrectionMinutes', 'equationOfTimeMinutes',
] as const;

// ---------------------------------------------------------------------------
//  Public: element code conversion
// ---------------------------------------------------------------------------

/**
 * Converts a saju element code like "WOOD" into a display key like "Wood".
 * Returns `null` when the input is missing or unrecognized.
 */
export function elementFromSajuCode(value: string | null | undefined): ElementKey | null {
  return value != null ? (ELEMENT_CODE_TO_KEY[value.toUpperCase()] ?? null) : null;
}

// ---------------------------------------------------------------------------
//  Saju module loading (lazy, singleton)
// ---------------------------------------------------------------------------
type SajuModule = {
  analyzeSaju: (input: any, config?: any, options?: any) => any;
  createBirthInput: (params: any) => any;
  configFromPreset?: (preset: string) => any;
};

let sajuModule: SajuModule | null = null;

function buildSajuModuleCandidates(): string[] {
  const configuredDistPath = SAJU_MODULE_PATH.replace('/src/', '/dist/').replace(/\.ts$/i, '.js');
  const compiledDistPath = '../../../../saju-ts/dist/index.js';
  const staticPublicPath = 'saju-ts/index.js';
  const raw = [staticPublicPath, SAJU_MODULE_PATH, configuredDistPath, compiledDistPath];

  if (typeof document === 'undefined' || !document.baseURI) {
    return Array.from(new Set(raw));
  }

  const withAbsolute = raw.flatMap((modulePath) => {
    try {
      return [modulePath, new URL(modulePath, document.baseURI).toString()];
    } catch {
      return [modulePath];
    }
  });
  return Array.from(new Set(withAbsolute));
}

async function loadSajuModule(): Promise<SajuModule | null> {
  if (sajuModule) return sajuModule;

  // Prefer bundled local dist import so saju works in app dev/build without public copy step.
  try {
    const bundled = await import('../../saju-ts/dist/index.js');
    if (typeof bundled?.analyzeSaju === 'function' && typeof bundled?.createBirthInput === 'function') {
      sajuModule = {
        analyzeSaju: bundled.analyzeSaju as SajuModule['analyzeSaju'],
        createBirthInput: bundled.createBirthInput as SajuModule['createBirthInput'],
        configFromPreset: typeof bundled.configFromPreset === 'function'
          ? (bundled.configFromPreset as SajuModule['configFromPreset'])
          : undefined,
      };
      return sajuModule;
    }
  } catch {
    // fallback to runtime path probing below
  }

  // 1) public/saju-ts/index.js (for static deploy), 2) configured dev path.
  const candidates = buildSajuModuleCandidates();

  for (const modulePath of candidates) {
    try {
      sajuModule = await (Function('p', 'return import(p)')(modulePath)) as SajuModule;
      return sajuModule;
    } catch {
      // try next candidate
    }
  }

  console.warn(
    '[spring-ts] saju-ts 모듈 로드 실패. 사주 분석이 비활성화됩니다.',
    `시도한 경로: ${candidates.join(', ')}`,
  );
  return null;
}

// ---------------------------------------------------------------------------
//  Small utility helpers
// ---------------------------------------------------------------------------

/** Guarantees an array — returns `value` if it is one, otherwise wraps it. */
function ensureArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

/** Converts any value to a string, or `null` if the value is nullish. */
function toNullableString(value: any): string | null {
  return value != null ? String(value) : null;
}

/** Picks numeric fields from an object by key, defaulting to 0. */
function extractNumericFields(source: any, keys: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of keys) result[key] = Number(source?.[key]) || 0;
  return result;
}

/**
 * Deep-serializes runtime Maps and Sets into plain JSON-safe objects/arrays.
 * This is needed because the saju-ts engine may return Map/Set instances.
 */
function deepSerialize(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Map) {
    const plain: Record<string, unknown> = {};
    for (const [key, val] of value) plain[String(key)] = deepSerialize(val);
    return plain;
  }
  if (value instanceof Set) return [...value].map(item => deepSerialize(item));
  if (Array.isArray(value)) return value.map(item => deepSerialize(item));

  const plain: Record<string, unknown> = {};
  for (const key of Object.keys(value as any)) plain[key] = deepSerialize((value as any)[key]);
  return plain;
}

/** Converts a value (Set, Array, or falsy) into a plain string[]. */
function toStringArray(value: any): string[] {
  if (!value) return [];
  if (value instanceof Set) return [...value].map(String);
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function toLegacySajuTimePolicyConfig(options?: SpringRequest['options']): Record<string, unknown> {
  const policy = options?.sajuTimePolicy;
  if (!policy) return {};

  const patch: Record<string, unknown> = {};

  if (policy.trueSolarTime === 'on') patch.trueSolarTimeEnabled = true;
  else if (policy.trueSolarTime === 'off') patch.trueSolarTimeEnabled = false;

  if (policy.longitudeCorrection === 'on') patch.longitudeCorrectionEnabled = true;
  else if (policy.longitudeCorrection === 'off') patch.longitudeCorrectionEnabled = false;

  if (policy.yaza === 'on') patch.yazaEnabled = true;
  else if (policy.yaza === 'off') patch.yazaEnabled = false;

  if (policy.yazaMode === '23:00') patch.yazaMode = 'YAZA_23_TO_01_NEXTDAY';
  else if (policy.yazaMode === '23:30') patch.yazaMode = 'YAZA_23_30_TO_01_30_NEXTDAY';

  return patch;
}

function toOptionalInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

interface KnownBirthParts {
  readonly year: number | null;
  readonly month: number | null;
  readonly day: number | null;
  readonly hour: number | null;
  readonly minute: number | null;
}

function resolveKnownBirthParts(birth: BirthInfo): KnownBirthParts {
  const year = toOptionalInt(birth.year);
  const month = toOptionalInt(birth.month);
  const day = toOptionalInt(birth.day);
  const hour = toOptionalInt(birth.hour);
  const minute = toOptionalInt(birth.minute);

  return {
    year: year && year >= 1 && year <= 9999 ? year : null,
    month: month && month >= 1 && month <= 12 ? month : null,
    day: day && day >= 1 && day <= 31 ? day : null,
    hour: hour != null && hour >= 0 && hour <= 23 ? hour : null,
    minute: minute != null && minute >= 0 && minute <= 59 ? minute : null,
  };
}

function hasAnyKnownBirthPart(parts: KnownBirthParts): boolean {
  return Object.values(parts).some((value) => value != null);
}

function canRunFullSaju(parts: KnownBirthParts): boolean {
  return parts.year != null && parts.month != null && parts.day != null;
}

function seasonHintFromMonth(month: number): string {
  if (month >= 3 && month <= 5) return '봄 기운(목) 경향';
  if (month >= 6 && month <= 8) return '여름 기운(화) 경향';
  if (month >= 9 && month <= 11) return '가을 기운(금) 경향';
  return '겨울 기운(수) 경향';
}

function hourBranchCode(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 23 || normalized === 0) return 'JA';
  const index = Math.floor((normalized + 1) / 2) % 12;
  return HOUR_BRANCH_CODES[index] ?? '';
}

function yearPillarApprox(year: number): { stemCode: string; branchCode: string } {
  const stemCode = YEAR_STEM_CODES[((year - 4) % 10 + 10) % 10] ?? '';
  const branchCode = YEAR_BRANCH_CODES[((year - 4) % 12 + 12) % 12] ?? '';
  return { stemCode, branchCode };
}

function buildPartialSajuSummary(birth: BirthInfo, parts: KnownBirthParts): SajuSummary {
  const summary = emptySaju() as SajuSummary & Record<string, unknown>;
  const mutableSummary = summary as Record<string, any>;
  const interpretation: string[] = [];

  if (parts.year != null) {
    const { stemCode, branchCode } = yearPillarApprox(parts.year);
    const stemInfo = CHEONGAN[stemCode];
    const branchInfo = JIJI[branchCode];

    mutableSummary.pillars = {
      ...summary.pillars,
      year: {
        stem: {
          code: stemCode,
          hangul: stemInfo?.hangul ?? stemCode,
          hanja: stemInfo?.hanja ?? '',
        },
        branch: {
          code: branchCode,
          hangul: branchInfo?.hangul ?? branchCode,
          hanja: branchInfo?.hanja ?? '',
        },
      },
    };

    interpretation.push(
      `출생 연도 기준으로 연주를 추정했습니다: ${stemInfo?.hangul ?? stemCode}${branchInfo?.hangul ?? branchCode}년.`,
    );
  }

  if (parts.month != null) {
    interpretation.push(`출생 월 정보로 계절 경향을 반영했습니다: ${seasonHintFromMonth(parts.month)}.`);
  }

  if (parts.day != null) {
    interpretation.push('출생 일 정보는 확인되었지만 일주/용신 분석에는 연월 정보가 더 필요합니다.');
  }

  if (parts.hour != null) {
    const branchCode = hourBranchCode(parts.hour);
    const branchInfo = JIJI[branchCode];
    interpretation.push(`출생 시 정보로 시지 경향을 반영했습니다: ${branchInfo?.hangul ?? branchCode}시 구간.`);
  }

  if (parts.minute != null) {
    interpretation.push('출생 분 정보가 있어 시간 오차 범위를 줄여 해석했습니다.');
  }

  if (birth.gender === 'neutral') {
    interpretation.push('중성 선택으로 성별 의존 해석 항목은 중립 기준으로 처리했습니다.');
  }

  mutableSummary.partialInterpretation = interpretation;
  mutableSummary.partialBirthInput = {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    calendarType: birth.calendarType ?? 'solar',
  };

  return summary;
}

// ---------------------------------------------------------------------------
//  Public: empty SajuSummary (fallback when analysis fails)
// ---------------------------------------------------------------------------

export function emptySaju(): SajuSummary {
  const emptyPillar: PillarSummary = {
    stem:   { code: '', hangul: '', hanja: '' },
    branch: { code: '', hangul: '', hanja: '' },
  };
  return {
    pillars: { year: emptyPillar, month: emptyPillar, day: emptyPillar, hour: emptyPillar },
    timeCorrection: extractNumericFields(null, TC_KEYS) as any,
    dayMaster: { stem: '', element: '', polarity: '' },
    strength: {
      level: '', isStrong: false,
      totalSupport: 0, totalOppose: 0,
      deukryeong: 0, deukji: 0, deukse: 0,
      details: [],
    },
    yongshin: {
      element: 'WOOD', heeshin: null, gishin: null, gushin: null,
      confidence: 0, agreement: '', recommendations: [],
    },
    gyeokguk: { type: '', category: '', baseTenGod: null, confidence: 0, reasoning: '' },
    elementDistribution: {},
    deficientElements: [],
    excessiveElements: [],
    cheonganRelations: [],
    jijiRelations: [],
    gongmang: null,
    tenGodAnalysis: null,
    shinsalHits: [],
  } as SajuSummary;
}

// ---------------------------------------------------------------------------
//  Public: collect element keys from mixed sources
// ---------------------------------------------------------------------------

export function collectElements(...sources: (string | null | undefined | string[])[]): Set<string> {
  const result = new Set<string>();
  for (const source of sources) {
    for (const item of (Array.isArray(source) ? source : source ? [source] : [])) {
      const elementKey = elementFromSajuCode(item);
      if (elementKey) result.add(elementKey);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Public: run the saju analysis
// ---------------------------------------------------------------------------

export async function analyzeSaju(birth: BirthInfo, options?: SpringRequest['options']): Promise<SajuSummary> {
  const saju = await loadSajuModule();
  if (!saju) return emptySaju();

  const parts = resolveKnownBirthParts(birth);
  if (!hasAnyKnownBirthPart(parts)) {
    return emptySaju();
  }

  if (!canRunFullSaju(parts)) {
    return buildPartialSajuSummary(birth, parts);
  }

  const birthYear = parts.year;
  const birthMonth = parts.month;
  const birthDay = parts.day;
  if (birthYear == null || birthMonth == null || birthDay == null) {
    return buildPartialSajuSummary(birth, parts);
  }

  try {
    let config: any;
    if (options?.schoolPreset && saju.configFromPreset)
      config = saju.configFromPreset(PRESET_MAP[options.schoolPreset] ?? 'KOREAN_MAINSTREAM');
    const timePolicyConfig = toLegacySajuTimePolicyConfig(options);
    if (Object.keys(timePolicyConfig).length) config = { ...config, ...timePolicyConfig };
    if (options?.sajuConfig) config = { ...config, ...options.sajuConfig };

    const sajuOpts = options?.sajuOptions ? {
      daeunCount:     options.sajuOptions.daeunCount,
      saeunStartYear: options.sajuOptions.saeunStartYear,
      saeunYearCount: options.sajuOptions.saeunYearCount,
    } : undefined;

    const analyzeWithGender = (genderCode: 'MALE' | 'FEMALE'): SajuSummary & Record<string, unknown> => {
      const birthInput = saju.createBirthInput({
        birthYear,
        birthMonth,
        birthDay,
        birthHour: parts.hour ?? DEFAULT_UNKNOWN_HOUR,
        birthMinute: parts.minute ?? DEFAULT_UNKNOWN_MINUTE,
        gender: genderCode,
        calendarType: birth.calendarType === 'lunar' ? 'LUNAR' : 'SOLAR',
        isLeapMonth: typeof birth.isLeapMonth === 'boolean' ? birth.isLeapMonth : undefined,
        timezone:  birth.timezone  ?? DEFAULT_TIMEZONE,
        latitude:  birth.latitude  ?? DEFAULT_LATITUDE,
        longitude: birth.longitude ?? DEFAULT_LONGITUDE,
        name: birth.name,
      });
      return extractSaju(saju.analyzeSaju(birthInput, config, sajuOpts)) as SajuSummary & Record<string, unknown>;
    };

    let summary: SajuSummary & Record<string, unknown>;
    let neutralBasis: 'MALE' | 'FEMALE' | null = null;
    let neutralMaleConfidence: number | null = null;
    let neutralFemaleConfidence: number | null = null;

    if (birth.gender === 'neutral') {
      let maleSummary: (SajuSummary & Record<string, unknown>) | null = null;
      let femaleSummary: (SajuSummary & Record<string, unknown>) | null = null;

      try { maleSummary = analyzeWithGender('MALE'); } catch {}
      try { femaleSummary = analyzeWithGender('FEMALE'); } catch {}

      if (!maleSummary && !femaleSummary) {
        return emptySaju();
      }

      neutralMaleConfidence = maleSummary?.yongshin?.confidence ?? null;
      neutralFemaleConfidence = femaleSummary?.yongshin?.confidence ?? null;

      if (maleSummary && !femaleSummary) {
        summary = maleSummary;
        neutralBasis = 'MALE';
      } else if (!maleSummary && femaleSummary) {
        summary = femaleSummary;
        neutralBasis = 'FEMALE';
      } else if ((neutralFemaleConfidence ?? -1) > (neutralMaleConfidence ?? -1)) {
        summary = femaleSummary as SajuSummary & Record<string, unknown>;
        neutralBasis = 'FEMALE';
      } else {
        summary = maleSummary as SajuSummary & Record<string, unknown>;
        neutralBasis = 'MALE';
      }
    } else {
      summary = analyzeWithGender(birth.gender === 'female' ? 'FEMALE' : 'MALE');
    }

    const notes: string[] = [];
    if (parts.hour == null || parts.minute == null) {
      notes.push(
        `출생 시/분 미상으로 ${String(DEFAULT_UNKNOWN_HOUR).padStart(2, '0')}:${String(DEFAULT_UNKNOWN_MINUTE).padStart(2, '0')} 기준 계산을 적용했습니다.`,
      );
    }
    if (birth.gender === 'neutral') {
      const maleConfidenceText = neutralMaleConfidence != null ? neutralMaleConfidence.toFixed(2) : '-';
      const femaleConfidenceText = neutralFemaleConfidence != null ? neutralFemaleConfidence.toFixed(2) : '-';
      notes.push(
        `중성 선택으로 남/여 기준을 모두 계산했고, 신뢰도 기준으로 ${neutralBasis ?? '중립'} 결과를 사용했습니다. (남성 ${maleConfidenceText}, 여성 ${femaleConfidenceText})`,
      );
      summary.neutralGenderBasis = neutralBasis ?? 'UNKNOWN';
    }
    if (notes.length > 0) {
      const existing = Array.isArray(summary.partialInterpretation)
        ? summary.partialInterpretation.filter((line) => typeof line === 'string')
        : [];
      summary.partialInterpretation = [...existing, ...notes];
    }
    return summary;
  } catch { return emptySaju(); }
}

// ---------------------------------------------------------------------------
//  extractSaju — composed from focused extraction helpers
// ---------------------------------------------------------------------------

/**
 * Transforms the raw output from saju-ts into our clean SajuSummary shape.
 * Each piece of the summary is extracted by a dedicated helper function.
 */
export function extractSaju(rawSajuOutput: any): SajuSummary {
  const serializedOutput = deepSerialize(rawSajuOutput) as Record<string, unknown>;
  const rawPillars       = rawSajuOutput.pillars ?? rawSajuOutput.coreResult?.pillars;
  const coreResult       = rawSajuOutput.coreResult;

  return {
    ...serializedOutput,

    pillars:              extractPillars(rawPillars),
    timeCorrection:       extractNumericFields(coreResult, TC_KEYS) as any,
    dayMaster:            extractDayMaster(rawPillars, rawSajuOutput.strengthResult),
    strength:             extractStrength(rawSajuOutput.strengthResult),
    yongshin:             extractYongshin(rawSajuOutput.yongshinResult),
    gyeokguk:             extractGyeokguk(rawSajuOutput.gyeokgukResult),
    elementDistribution:   extractElementDistribution(rawSajuOutput).distribution,
    deficientElements:    extractElementDistribution(rawSajuOutput).deficientElements,
    excessiveElements:    extractElementDistribution(rawSajuOutput).excessiveElements,
    cheonganRelations:    extractCheonganRelations(rawSajuOutput),
    hapHwaEvaluations:    extractHapHwaEvaluations(rawSajuOutput),
    jijiRelations:        extractJijiRelations(rawSajuOutput),
    sibiUnseong:          extractSibiUnseong(rawSajuOutput),
    gongmang:             extractGongmang(rawSajuOutput),
    tenGodAnalysis:       extractTenGodAnalysis(rawSajuOutput.tenGodAnalysis),
    shinsalHits:          extractShinsalHits(rawSajuOutput),
    shinsalComposites:    extractShinsalComposites(rawSajuOutput),
    palaceAnalysis:       extractPalaceAnalysis(rawSajuOutput),
    daeunInfo:            extractDaeunInfo(rawSajuOutput),
    saeunPillars:         extractSaeunPillars(rawSajuOutput),
    trace:                extractTrace(rawSajuOutput),
  } as SajuSummary;
}

// ---------------------------------------------------------------------------
//  Pillar extraction — year / month / day / hour
// ---------------------------------------------------------------------------

/** Converts a single raw pillar into our PillarSummary shape (stem + branch). */
function formatPillar(pillarData: any): PillarSummary {
  const stemCode   = String(pillarData?.cheongan ?? '');
  const branchCode = String(pillarData?.jiji ?? '');
  const stemInfo   = CHEONGAN[stemCode];
  const branchInfo = JIJI[branchCode];
  return {
    stem:   { code: stemCode,   hangul: stemInfo?.hangul   ?? stemCode,   hanja: stemInfo?.hanja   ?? '' },
    branch: { code: branchCode, hangul: branchInfo?.hangul ?? branchCode, hanja: branchInfo?.hanja ?? '' },
  };
}

function extractPillars(rawPillars: any): Record<'year' | 'month' | 'day' | 'hour', PillarSummary> {
  return {
    year:  formatPillar(rawPillars?.year),
    month: formatPillar(rawPillars?.month),
    day:   formatPillar(rawPillars?.day),
    hour:  formatPillar(rawPillars?.hour),
  };
}

// ---------------------------------------------------------------------------
//  Day master — the stem of the day pillar
// ---------------------------------------------------------------------------

function extractDayMaster(rawPillars: any, strengthResult: any) {
  const dayMasterCode = String(rawPillars?.day?.cheongan ?? '');
  const dayMasterInfo = CHEONGAN[dayMasterCode];
  return {
    stem:     dayMasterCode,
    element:  strengthResult?.dayMasterElement ? String(strengthResult.dayMasterElement) : (dayMasterInfo?.element ?? ''),
    polarity: dayMasterInfo?.polarity ?? '',
  };
}

// ---------------------------------------------------------------------------
//  Strength — is the day master strong or weak?
// ---------------------------------------------------------------------------

function extractStrength(strengthResult: any) {
  return {
    level:        String(strengthResult?.level ?? ''),
    isStrong:     !!strengthResult?.isStrong,
    totalSupport: Number(strengthResult?.score?.totalSupport) || 0,
    totalOppose:  Number(strengthResult?.score?.totalOppose)  || 0,
    deukryeong:   Number(strengthResult?.score?.deukryeong)   || 0,
    deukji:       Number(strengthResult?.score?.deukji)       || 0,
    deukse:       Number(strengthResult?.score?.deukse)       || 0,
    details:      ensureArray(strengthResult?.details).map(String),
  };
}

// ---------------------------------------------------------------------------
//  Element distribution — how many "points" each element has in the chart
// ---------------------------------------------------------------------------

function extractElementDistribution(rawSajuOutput: any): {
  distribution: Record<string, number>;
  deficientElements: string[];
  excessiveElements: string[];
} {
  const distribution: Record<string, number> = {};

  if (rawSajuOutput.ohaengDistribution) {
    if (rawSajuOutput.ohaengDistribution instanceof Map) {
      for (const [key, value] of rawSajuOutput.ohaengDistribution)
        distribution[String(key)] = Number(value);
    } else {
      Object.assign(distribution, rawSajuOutput.ohaengDistribution);
    }
  }

  const total   = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const average = total / 5;

  const deficientElements: string[] = [];
  const excessiveElements: string[] = [];

  if (total > 0) {
    for (const elementCode of ELEMENT_CODES) {
      const count = distribution[elementCode] ?? 0;
      if (count === 0 || count <= average * 0.4) deficientElements.push(elementCode);
      else if (count >= average * 2.0)           excessiveElements.push(elementCode);
    }
  }

  return { distribution, deficientElements, excessiveElements };
}

// ---------------------------------------------------------------------------
//  Yongshin — the recommended balancing element
// ---------------------------------------------------------------------------

function extractYongshin(yongshinResult: any) {
  return {
    element:    String(yongshinResult?.finalYongshin ?? ''),
    heeshin:    toNullableString(yongshinResult?.finalHeesin),
    gishin:     toNullableString(yongshinResult?.gisin),
    gushin:     toNullableString(yongshinResult?.gusin),
    confidence: Number(yongshinResult?.finalConfidence) || 0,
    agreement:  String(yongshinResult?.agreement ?? ''),
    recommendations: ensureArray(yongshinResult?.recommendations).map(
      ({ type, primaryElement, secondaryElement, confidence, reasoning }: any) => ({
        type:             String(type ?? ''),
        primaryElement:   String(primaryElement ?? ''),
        secondaryElement: toNullableString(secondaryElement),
        confidence:       Number(confidence) || 0,
        reasoning:        String(reasoning ?? ''),
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
//  Gyeokguk — the structural pattern of the chart
// ---------------------------------------------------------------------------

function extractGyeokguk(gyeokgukResult: any) {
  return {
    type:          String(gyeokgukResult?.type ?? ''),
    category:      String(gyeokgukResult?.category ?? ''),
    baseTenGod:  toNullableString(gyeokgukResult?.baseSipseong),
    confidence:    Number(gyeokgukResult?.confidence) || 0,
    reasoning:     String(gyeokgukResult?.reasoning ?? ''),
  };
}

// ---------------------------------------------------------------------------
//  Ten God analysis (십성 분석)
// ---------------------------------------------------------------------------

function extractTenGodAnalysis(tenGodResult: any) {
  if (!tenGodResult?.byPosition) return null;

  return {
    dayMaster: String(tenGodResult.dayMaster ?? ''),
    byPosition: Object.fromEntries(
      Object.entries(tenGodResult.byPosition).map(([position, positionInfo]) => {
        const info = positionInfo as any;
        return [position, {
          cheonganTenGod:      String(info.cheonganSipseong ?? ''),
          jijiPrincipalTenGod: String(info.jijiPrincipalSipseong ?? ''),
          hiddenStems: ensureArray(info.hiddenStems).map((hidden: any) => {
            const stemCode = String(hidden.stem ?? '');
            return {
              stem:    stemCode,
              element: CHEONGAN[stemCode]?.element ?? '',
              ratio:   Number(hidden.ratio ?? (hidden.days ? hidden.days / 30 : 0)) || 0,
            };
          }),
          hiddenStemTenGod: ensureArray(info.hiddenStemSipseong).map((hidden: any) => ({
            stem:   String(hidden.entry?.stem ?? hidden.stem ?? ''),
            tenGod: String(hidden.sipseong ?? ''),
          })),
        }];
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
//  Shinsal hits (신살 — auspicious / inauspicious markers)
// ---------------------------------------------------------------------------

function extractShinsalHits(rawSajuOutput: any) {
  /** Assigns a letter grade based on weight: 80+ = A, 50+ = B, else C. */
  const gradeFromWeight = (weight: number) => weight >= 80 ? 'A' : weight >= 50 ? 'B' : 'C';

  const weightedHits = ensureArray(rawSajuOutput.weightedShinsalHits);
  const sourceHits   = weightedHits.length > 0 ? weightedHits : ensureArray(rawSajuOutput.shinsalHits);
  const isWeighted   = weightedHits.length > 0;

  return sourceHits.map((item: any) => {
    const hitData    = isWeighted ? item.hit : item;
    const baseWeight = isWeighted ? Number(item.baseWeight) || 0 : 0;
    return {
      type:               String(hitData?.type     ?? ''),
      position:           String(hitData?.position ?? ''),
      grade:              String(hitData?.grade || '') || (isWeighted ? gradeFromWeight(baseWeight) : 'C'),
      baseWeight,
      positionMultiplier: isWeighted ? Number(item.positionMultiplier) || 0 : 0,
      weightedScore:      isWeighted ? Number(item.weightedScore)      || 0 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
//  Shinsal composites
// ---------------------------------------------------------------------------

function extractShinsalComposites(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.shinsalComposites).map((composite: any) => ({
    patternName:     String(composite.patternName     ?? ''),
    interactionType: String(composite.interactionType ?? ''),
    interpretation:  String(composite.interpretation  ?? ''),
    bonusScore:      Number(composite.bonusScore)     || 0,
  }));
}

// ---------------------------------------------------------------------------
//  Jiji relations (지지 관계 — earthly branch interactions)
// ---------------------------------------------------------------------------

function extractJijiRelations(rawSajuOutput: any) {
  const resolvedRelations = ensureArray(rawSajuOutput.resolvedJijiRelations);
  const sourceRelations   = resolvedRelations.length > 0 ? resolvedRelations : ensureArray(rawSajuOutput.jijiRelations);
  const isResolved        = resolvedRelations.length > 0;

  return sourceRelations.map((item: any) => {
    const hitData = isResolved ? item.hit : item;
    return {
      type:      String(hitData?.type ?? (item.type ?? '')),
      branches:  toStringArray(hitData?.members ?? item.members),
      note:      String(hitData?.note ?? (item.note ?? '')),
      outcome:   isResolved ? toNullableString(item.outcome)   : null,
      reasoning: isResolved ? toNullableString(item.reasoning) : null,
    };
  });
}

// ---------------------------------------------------------------------------
//  Cheongan relations (천간 관계 — heavenly stem interactions)
// ---------------------------------------------------------------------------

function extractCheonganRelations(rawSajuOutput: any) {
  // Build a lookup for scored cheongan relations (if available)
  const scoredRelations = ensureArray(rawSajuOutput.scoredCheonganRelations);
  const scoreByKey = new Map<string, any>();
  for (const scored of scoredRelations) {
    const lookupKey = String(scored.hit?.type ?? '') + ':' + toStringArray(scored.hit?.members).sort().join(',');
    scoreByKey.set(lookupKey, scored.score);
  }

  return ensureArray(rawSajuOutput.cheonganRelations).map((relation: any) => {
    const lookupKey    = String(relation.type ?? '') + ':' + toStringArray(relation.members).sort().join(',');
    const scoreData    = scoreByKey.get(lookupKey);
    return {
      type:          String(relation.type ?? ''),
      stems:         toStringArray(relation.members),
      resultElement: toNullableString(relation.resultOhaeng),
      note:          String(relation.note ?? ''),
      score: scoreData ? {
        baseScore:          Number(scoreData.baseScore)          || 0,
        adjacencyBonus:     Number(scoreData.adjacencyBonus)     || 0,
        outcomeMultiplier:  Number(scoreData.outcomeMultiplier)  || 0,
        finalScore:         Number(scoreData.finalScore)         || 0,
        rationale:          String(scoreData.rationale ?? ''),
      } : null,
    };
  });
}

// ---------------------------------------------------------------------------
//  Hap-hwa evaluations (합화 — stem combination transformations)
// ---------------------------------------------------------------------------

function extractHapHwaEvaluations(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.hapHwaEvaluations).map((evaluation: any) => ({
    stem1:             String(evaluation.stem1     ?? ''),
    stem2:             String(evaluation.stem2     ?? ''),
    position1:         String(evaluation.position1 ?? ''),
    position2:         String(evaluation.position2 ?? ''),
    resultElement:     String(evaluation.resultOhaeng ?? ''),
    state:             String(evaluation.state     ?? ''),
    confidence:        Number(evaluation.confidence) || 0,
    reasoning:         String(evaluation.reasoning ?? ''),
    dayMasterInvolved: !!evaluation.dayMasterInvolved,
  }));
}

// ---------------------------------------------------------------------------
//  Sibi unseong (십이운성 — twelve stages of life cycle)
// ---------------------------------------------------------------------------

function extractSibiUnseong(rawSajuOutput: any) {
  if (!rawSajuOutput.sibiUnseong) return null;
  return Object.fromEntries(
    (rawSajuOutput.sibiUnseong instanceof Map
      ? [...rawSajuOutput.sibiUnseong]
      : Object.entries(rawSajuOutput.sibiUnseong)
    ).map(([key, value]: [any, any]) => [String(key), String(value)]),
  );
}

// ---------------------------------------------------------------------------
//  Gongmang (공망 — void branches)
// ---------------------------------------------------------------------------

function extractGongmang(rawSajuOutput: any): [string, string] | null {
  const branches = rawSajuOutput.gongmangVoidBranches;
  return Array.isArray(branches) && branches.length >= 2
    ? [String(branches[0]), String(branches[1])]
    : null;
}

// ---------------------------------------------------------------------------
//  Palace analysis (궁 분석)
// ---------------------------------------------------------------------------

function extractPalaceAnalysis(rawSajuOutput: any) {
  if (!rawSajuOutput.palaceAnalysis) return null;
  return Object.fromEntries(
    Object.entries(rawSajuOutput.palaceAnalysis).map(([position, palaceData]) => {
      const palace      = palaceData as any;
      const palaceInfo  = palace.palaceInfo;
      return [position, {
        position,
        koreanName:     String(palaceInfo?.koreanName ?? ''),
        domain:         String(palaceInfo?.domain     ?? ''),
        agePeriod:      String(palaceInfo?.agePeriod  ?? ''),
        bodyPart:       String(palaceInfo?.bodyPart   ?? ''),
        tenGod:         toNullableString(palace.sipseong),
        familyRelation: toNullableString(palace.familyRelation),
      }];
    }),
  );
}

// ---------------------------------------------------------------------------
//  Daeun info (대운 — major luck cycles)
// ---------------------------------------------------------------------------

function extractDaeunInfo(rawSajuOutput: any) {
  const daeunInfoRaw = rawSajuOutput.daeunInfo;
  if (!daeunInfoRaw) return null;

  return {
    isForward:              !!daeunInfoRaw.isForward,
    firstDaeunStartAge:     Number(daeunInfoRaw.firstDaeunStartAge)    || 0,
    firstDaeunStartMonths:  Number(daeunInfoRaw.firstDaeunStartMonths) || 0,
    boundaryMode:           String(daeunInfoRaw.boundaryMode ?? ''),
    warnings:               ensureArray(daeunInfoRaw.warnings).map(String),
    pillars: ensureArray(daeunInfoRaw.daeunPillars).map((pillarData: any) => ({
      stem:     String(pillarData.pillar?.cheongan ?? ''),
      branch:   String(pillarData.pillar?.jiji     ?? ''),
      startAge: Number(pillarData.startAge)        || 0,
      endAge:   Number(pillarData.endAge)          || 0,
      order:    Number(pillarData.order)           || 0,
    })),
  };
}

// ---------------------------------------------------------------------------
//  Saeun pillars (세운 — yearly luck pillars)
// ---------------------------------------------------------------------------

function extractSaeunPillars(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.saeunPillars).map((saeun: any) => ({
    year:   Number(saeun.year) || 0,
    stem:   String(saeun.pillar?.cheongan ?? ''),
    branch: String(saeun.pillar?.jiji     ?? ''),
  }));
}

// ---------------------------------------------------------------------------
//  Trace / audit log
// ---------------------------------------------------------------------------

function extractTrace(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.trace).map((traceEntry: any) => ({
    key:        String(traceEntry.key     ?? ''),
    summary:    String(traceEntry.summary ?? ''),
    evidence:   ensureArray(traceEntry.evidence).map(String),
    citations:  ensureArray(traceEntry.citations).map(String),
    reasoning:  ensureArray(traceEntry.reasoning).map(String),
    confidence: typeof traceEntry.confidence === 'number' ? traceEntry.confidence : null,
  }));
}

// ---------------------------------------------------------------------------
//  Public: safe saju analysis with sajuEnabled flag (PR #7 review)
// ---------------------------------------------------------------------------

export async function analyzeSajuSafe(
  birth: BirthInfo, options?: SpringRequest['options'],
): Promise<{ summary: SajuSummary; sajuEnabled: boolean }> {
  try {
    const summary = await analyzeSaju(birth, options);
    // If analyzeSaju returned an empty saju (module missing), detect via dayMaster
    const isRealAnalysis = !!summary.dayMaster?.element;
    return { summary, sajuEnabled: isRealAnalysis };
  } catch {
    return { summary: emptySaju(), sajuEnabled: false };
  }
}

// ---------------------------------------------------------------------------
//  Public: build a condensed saju context for the name-scoring pipeline
// ---------------------------------------------------------------------------

export function buildSajuContext(sajuSummary: SajuSummary): { dist: Record<ElementKey, number>; output: SajuOutputSummary | null } {
  const dist = emptyDistribution();
  for (const [code, count] of Object.entries(sajuSummary.elementDistribution)) {
    const key = elementFromSajuCode(code);
    if (key) dist[key] += count;
  }

  if (!sajuSummary.dayMaster.element && !sajuSummary.yongshin.element) return { dist, output: null };

  const dayMasterKey = elementFromSajuCode(sajuSummary.dayMaster.element);
  const yongshinData = sajuSummary.yongshin;

  // Count ten-god group occurrences across all pillar positions
  let tenGod: { groupCounts: Record<string, number> } | undefined;
  if (sajuSummary.tenGodAnalysis?.byPosition) {
    const groupCounts: Record<string, number> = { friend: 0, output: 0, wealth: 0, authority: 0, resource: 0 };
    for (const positionInfo of Object.values(sajuSummary.tenGodAnalysis.byPosition)) {
      const stemGroup   = TEN_GOD_GROUP[positionInfo.cheonganTenGod];
      const branchGroup = TEN_GOD_GROUP[positionInfo.jijiPrincipalTenGod];
      if (stemGroup)   groupCounts[stemGroup]++;
      if (branchGroup) groupCounts[branchGroup]++;
    }
    tenGod = { groupCounts };
  }

  return {
    dist,
    output: {
      dayMaster: dayMasterKey ? { element: dayMasterKey } : undefined,
      strength: {
        isStrong:     sajuSummary.strength.isStrong,
        totalSupport: sajuSummary.strength.totalSupport,
        totalOppose:  sajuSummary.strength.totalOppose,
      },
      yongshin: {
        finalYongshin:   yongshinData.element,
        finalHeesin:     yongshinData.heeshin,
        gisin:           yongshinData.gishin,
        gusin:           yongshinData.gushin,
        finalConfidence: yongshinData.confidence,
        recommendations: yongshinData.recommendations.map(
          ({ type, primaryElement, secondaryElement, confidence, reasoning }) => ({
            type, primaryElement, secondaryElement, confidence, reasoning,
          }),
        ),
      },
      tenGod,
      gyeokguk: sajuSummary.gyeokguk?.type ? {
        category:   String(sajuSummary.gyeokguk.category   ?? ''),
        type:       String(sajuSummary.gyeokguk.type        ?? ''),
        confidence: Number(sajuSummary.gyeokguk.confidence) || 0,
      } : undefined,
      deficientElements: sajuSummary.deficientElements?.length ? sajuSummary.deficientElements : undefined,
      excessiveElements: sajuSummary.excessiveElements?.length ? sajuSummary.excessiveElements : undefined,
    },
  };
}
