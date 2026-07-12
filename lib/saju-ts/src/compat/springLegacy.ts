import { createEngine } from '../api/engine.js';
import { defaultConfig } from '../api/config.js';
import type { AnalysisBundle, EngineConfig, SajuRequest } from '../api/types.js';
import { branchElement, stemElement } from '../core/cycle.js';
import { controls } from '../core/elements.js';
import { detectStemRelations } from '../core/stemRelations.js';
import { lifeStageOf } from '../core/lifeStage.js';
import { mod } from '../core/mod.js';
import { tenGodOf } from '../core/tenGod.js';
import { TWELVE_SAL_KEYS, twelveSalStartOf } from '../rules/facts.js';
import { baseTenGodOfStructuralMonthFrame, type BigyeopSubtype } from '../rules/gyeokgukMonthFrame.js';
import type {
  LegacyJieProximityV1,
  LegacyLongitudeCorrectionPolicy,
  LegacySajuOutputV1,
} from './springLegacyContract.js';
import {
  mapLegacyFortune,
  type LegacyFortuneMapperDependencies,
} from './springLegacyFortuneMapper.js';
import {
  addCivilMinutes,
  civilDateTimeToUtcMs,
  civilToIsoInstant,
  dstMinutesAtUtcMs,
  resolveOffsetMinutes,
  type CivilDateTime,
} from './springLegacyTimezone.js';

export {
  LegacyAmbiguousTimeError,
  LegacyCivilTimeError,
  LegacyNonexistentTimeError,
  LegacyTimezoneDataUnsupportedError,
  LegacyTimezoneError,
  dstMinutesAtUtcMs,
  parseOffsetToken,
  resolveOffsetMinutes,
} from './springLegacyTimezone.js';

export type {
  LegacyCoreResultV1,
  LegacyDaeunInfoV1,
  LegacyDaeunPillarV1,
  LegacyGyeokgukResultV1,
  LegacyJieProximityV1,
  LegacyLongitudeCorrectionPolicy,
  LegacyLuckAnnotationsV1,
  LegacyPillarV1,
  LegacySaeunPillarV1,
  LegacySajuOutputV1,
  LegacyStrengthResultV1,
  LegacyTraceEntryV1,
  LegacyWolunPillarV1,
  LegacyYongshinRecommendationV1,
  LegacyYongshinResultV1,
} from './springLegacyContract.js';

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
  // 감사 B4: 월지 비겁의 주류 격명 (기본 모드).
  GEONROK: '건록격',
  YANGIN: '양인격',
  WOLGEOB: '월겁격',
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
// [감사 A2·B6] 엔진 primaryMethod → 레거시 추천 type 코드.
// 기본 정책(억부 1.0 + 조후 0.25)에서 실제 발생 값은 EOKBU/JOHU 둘뿐이고,
// BYEONGYAK(병약)·TONGGWAN(통관)·ILHAENG(전왕/종화)은 스쿨팩 경유 방어선이다.
const LEGACY_YONGSHIN_TYPE: Record<string, string> = {
  EOKBU: 'EOKBU',
  JOHU: 'JOHU',
  BYEONGYAK: 'BYEONGYAK',
  TONGGWAN: 'TONGGWAN',
  JONGHWA: 'ILHAENG',
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
  wolunStartYear?: number | null;
  wolunMonthCount?: number;
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
   * Explicit longitude-correction policy. When present, this takes precedence
   * over longitudeCorrectionEnabled and lmtBaselineLongitude.
   */
  longitudeCorrectionPolicy?: LegacyLongitudeCorrectionPolicy;

  /**
   * Legacy compatibility switch. `false` historically meant that no synthetic
   * baseline adjustment was made, so it maps to civilOffsetMeridian (not off).
   * Use longitudeCorrectionPolicy.mode='off' for actual no-correction behavior.
   */
  longitudeCorrectionEnabled?: boolean;

  /**
   * Convenience switch for YAZA day-cut behavior.
   * - false: MIDNIGHT_00 (자정설 옵션)
   * - true:  dayCutMode/yazaMode or default YAZA_23_TO_01_NEXTDAY
   * Default: true (감사 결정① — 정자시설이 기본. 주의: resolveDayCutMode는
   * dayCutMode를 yazaMode보다 먼저 평가한다.)
   */
  yazaEnabled?: boolean;
  yazaMode?: LegacyYazaMode;

  /** Legacy fixed reference meridian retained for preset compatibility. */
  lmtBaselineLongitude?: number;
  calendar?: Partial<EngineConfig['calendar']>;
  toggles?: Partial<EngineConfig['toggles']>;
  weights?: EngineConfig['weights'];
  strategies?: EngineConfig['strategies'];
  extensions?: EngineConfig['extensions'];
  school?: EngineConfig['school'];
  schemaVersion?: string;
}

const LEGACY_REQUIRED_TOGGLES = [
  'pillars',
  'relations',
  'tenGods',
  'hiddenStems',
  'elementDistribution',
  'fortune',
  'rules',
  'lifeStages',
  'stemRelations',
] as const satisfies readonly (keyof EngineConfig['toggles'])[];

export class LegacyContractConfigError extends Error {
  readonly code = 'SAJU_LEGACY_CONTRACT_CONFIG_INVALID';
  readonly disabledToggles: readonly string[];

  constructor(disabledToggles: readonly string[]) {
    super(
      `LegacySajuOutputV1 requires these engine toggles: ${disabledToggles.join(', ')}`,
    );
    this.name = 'LegacyContractConfigError';
    this.disabledToggles = [...disabledToggles];
  }
}

export class LegacyContractOutputError extends Error {
  readonly code = 'SAJU_LEGACY_CONTRACT_OUTPUT_MISSING';
  readonly missingFields: readonly string[];

  constructor(missingFields: readonly string[]) {
    super(
      `Engine output cannot satisfy LegacySajuOutputV1; missing: ${missingFields.join(', ')}`,
    );
    this.name = 'LegacyContractOutputError';
    this.missingFields = [...missingFields];
  }
}

export type LegacyBirthLocationErrorCode =
  | 'SAJU_LEGACY_BIRTH_LOCATION_PARTIAL'
  | 'SAJU_LEGACY_BIRTH_LOCATION_INVALID';

/** Raised when legacy callers provide a non-atomic or invalid location tuple. */
export class LegacyBirthLocationError extends Error {
  readonly code: LegacyBirthLocationErrorCode;

  constructor(code: LegacyBirthLocationErrorCode) {
    super(
      code === 'SAJU_LEGACY_BIRTH_LOCATION_PARTIAL'
        ? 'Legacy birth location requires timezone, latitude, and longitude together.'
        : 'Legacy birth location contains an invalid timezone or coordinate.',
    );
    this.name = 'LegacyBirthLocationError';
    this.code = code;
  }
}

interface DayCutMapping {
  dayBoundary: EngineConfig['calendar']['dayBoundary'];
  hourStemDayBoundary?: EngineConfig['calendar']['dayBoundary'];
  dayCutShiftMinutes: number;
}

interface TrueSolarCorrectionView {
  longitudeCorrectionMinutes?: number;
  equationOfTimeMinutes?: number;
  totalCorrectionMinutes?: number;
}

const PRESET_CONFIGS: Record<string, LegacySajuConfig> = {
  KOREAN_MAINSTREAM: {
    // 감사 결정①+A11: 경도 보정(기본 on)과 결합하는 정자시설은 23:00 모드(ziSplit23).
    // 23:30 모드는 경도 보정 off 유파용 — 중첩 시 이중 보정(-62분)이 된다.
    dayCutMode: 'YAZA_23_TO_01_NEXTDAY',
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
// 감사 결정① (2026-07-08): 기본 = 정자시설(ziSplit23, 23:00 모드).
// 실무 약 80% 주류 정렬 — 자정설은 yazaEnabled=false 명시로 복귀.
const DEFAULT_YAZA_ENABLED = true;
const DEFAULT_YAZA_MODE: LegacyYazaMode = 'YAZA_23_TO_01_NEXTDAY';

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
      return { dayBoundary: 'midnight', hourStemDayBoundary: 'ziSplit23', dayCutShiftMinutes: 0 };
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

function toCivilFromBirthInput(input: LegacyBirthInput): CivilDateTime {
  return {
    y: toInt(input.birthYear, 0),
    m: toInt(input.birthMonth, 1),
    d: toInt(input.birthDay, 1),
    h: clampHour(input.birthHour),
    min: clampMinute(input.birthMinute),
  };
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

const DEFAULT_TRANSIT_LIFE_STAGE_POLICY = { earthRule: 'FOLLOW_FIRE', yinReversalEnabled: true } as const;
const SAMJAE_PHASES = ['DEUL', 'NUL', 'NAL'] as const;

function stemIdxFromUnknown(idx: unknown): number {
  const n = Number(idx);
  return Number.isFinite(n) ? mod(Math.trunc(n), 10) : 0;
}

function branchIdxFromUnknown(idx: unknown): number {
  const n = Number(idx);
  return Number.isFinite(n) ? mod(Math.trunc(n), 12) : 0;
}

function buildStemBranchInteraction(stemIdxInput: unknown, branchIdxInput: unknown) {
  const stemIdx = stemIdxFromUnknown(stemIdxInput);
  const branchIdx = branchIdxFromUnknown(branchIdxInput);
  const stemEl = stemElement(stemIdx);
  const branchEl = branchElement(branchIdx);
  const gaedoo = controls(stemEl, branchEl);
  const geogak = controls(branchEl, stemEl);
  if (!gaedoo && !geogak) return undefined;

  return {
    gaedoo,
    geogak,
    labels: [
      ...(gaedoo ? ['개두'] : []),
      ...(geogak ? ['절각'] : []),
    ],
    stemElement: stemEl,
    branchElement: branchEl,
  };
}

function orderedBanghapGroup(branchIdx: number): number[] {
  const d = mod(branchIdx - 2, 12);
  const start = 2 + 3 * Math.floor(d / 3);
  return [mod(start, 12), mod(start + 1, 12), mod(start + 2, 12)];
}

function entryStemIdx(entry: any): unknown {
  return entry?.pillar?.stem?.idx ?? entry?.pillar?.stem;
}

function entryBranchIdx(entry: any): unknown {
  return entry?.pillar?.branch?.idx ?? entry?.pillar?.branch;
}

export function buildTransitShinsalForBranch(anchorBranchIdx: unknown, targetBranchIdx: unknown) {
  const anchor = branchIdxFromUnknown(anchorBranchIdx);
  const target = branchIdxFromUnknown(targetBranchIdx);
  const start = twelveSalStartOf(anchor as any);
  const twelveSal = TWELVE_SAL_KEYS[mod(target - start, 12)] ?? '';
  const yeokmaBranch = mod(start + 6, 12);
  const samjaeGroup = orderedBanghapGroup(yeokmaBranch);
  const samjaePhaseIndex = samjaeGroup.indexOf(target);

  return {
    anchor: 'YEAR_BRANCH',
    anchorBranch: branchCodeFromIdx(anchor),
    targetBranch: branchCodeFromIdx(target),
    twelveSal,
    samjae: {
      active: samjaePhaseIndex >= 0,
      phase: samjaePhaseIndex >= 0 ? SAMJAE_PHASES[samjaePhaseIndex] : null,
      group: samjaeGroup.map((branch) => branchCodeFromIdx(branch)),
    },
    sangmun: target === mod(anchor + 2, 12),
    jogaek: target === mod(anchor - 2, 12),
  };
}

function luckPillarAnnotations(entry: any, dayStemIdx: number, yearBranchIdx: number, lifeStagePolicy: any) {
  const stemIdx = stemIdxFromUnknown(entryStemIdx(entry));
  const branchIdx = branchIdxFromUnknown(entryBranchIdx(entry));
  const lifeStage = lifeStageOf(dayStemIdx as any, branchIdx as any, lifeStagePolicy ?? DEFAULT_TRANSIT_LIFE_STAGE_POLICY).stage;
  const stemBranchInteraction = buildStemBranchInteraction(stemIdx, branchIdx);

  return {
    tenGod: normalizeTenGod(tenGodOf(dayStemIdx as any, stemIdx as any)),
    lifeStage,
    lifeStageKo: LIFE_STAGE_KO[String(lifeStage)] ?? String(lifeStage),
    transitShinsal: buildTransitShinsalForBranch(yearBranchIdx, branchIdx),
    ...(stemBranchInteraction ? { stemBranchInteraction } : {}),
  };
}

function relationMemberCode(axis: 'STEM' | 'BRANCH', member: any): string {
  const idx = member && typeof member === 'object' ? member.idx : member;
  return axis === 'STEM' ? stemCodeFromIdx(idx) : branchCodeFromIdx(idx);
}

function pillarCodesFromUnknown(pillar: any) {
  return {
    cheongan: stemCodeFromIdx(pillar?.stem?.idx ?? pillar?.stem),
    jiji: branchCodeFromIdx(pillar?.branch?.idx ?? pillar?.branch),
  };
}

function formatFortuneRelationHit(axis: 'STEM' | 'BRANCH', relation: any) {
  const members = Array.isArray(relation?.members)
    ? relation.members.map((member: any) => relationMemberCode(axis, member)).filter(Boolean)
    : [];
  const natalPositions = Array.isArray(relation?.natalPositions)
    ? relation.natalPositions.map((pos: any) => String(pos)).filter(Boolean)
    : [];
  if (!relation?.type || members.length === 0 || natalPositions.length === 0) return null;
  return {
    type: String(relation.type),
    members,
    natalPositions,
    luckPosition: 'luck',
    ...(axis === 'STEM' && relation.resultElement ? { resultOhaeng: String(relation.resultElement) } : {}),
  };
}

function formatLuckPairRelationHit(axis: 'STEM' | 'BRANCH', relation: any) {
  const members = Array.isArray(relation?.members)
    ? relation.members.map((member: any) => relationMemberCode(axis, member)).filter(Boolean)
    : [];
  const luckPositions = Array.isArray(relation?.luckPositions)
    ? relation.luckPositions.map((pos: any) => String(pos)).filter(Boolean)
    : ['decade', 'year'];
  if (!relation?.type || members.length === 0) return null;
  return {
    type: String(relation.type),
    members,
    luckPositions,
    ...(axis === 'STEM' && relation.resultElement ? { resultOhaeng: String(relation.resultElement) } : {}),
  };
}

function formatLuckRelationsWithNatal(entry: any) {
  if (!entry || typeof entry !== 'object') return undefined;
  const stemRelations = Array.isArray(entry.stemRelations)
    ? entry.stemRelations.map((rel: any) => formatFortuneRelationHit('STEM', rel)).filter(Boolean)
    : [];
  const branchRelations = Array.isArray(entry.branchRelations)
    ? entry.branchRelations.map((rel: any) => formatFortuneRelationHit('BRANCH', rel)).filter(Boolean)
    : [];
  // Preserve an evaluated-empty result. Downstream consumers must be able to
  // distinguish “the engine found no relation” from “this period was never
  // evaluated by the canonical relation engine”.
  return { stemRelations, branchRelations };
}

function formatLuckRelationsWithDecade(entries: any[] | undefined) {
  const decadeRelations = (Array.isArray(entries) ? entries : [])
    .map((entry: any) => {
      if (!entry || typeof entry !== 'object') return null;
      const stemRelations = Array.isArray(entry.stemRelations)
        ? entry.stemRelations.map((rel: any) => formatLuckPairRelationHit('STEM', rel)).filter(Boolean)
        : [];
      const branchRelations = Array.isArray(entry.branchRelations)
        ? entry.branchRelations.map((rel: any) => formatLuckPairRelationHit('BRANCH', rel)).filter(Boolean)
        : [];
      if (stemRelations.length === 0 && branchRelations.length === 0) return null;
      return {
        decadeIndex: Number(entry.decadeIndex ?? 0),
        decadePillar: pillarCodesFromUnknown(entry.decadePillar),
        stemRelations,
        branchRelations,
      };
    })
    .filter(Boolean);
  if (decadeRelations.length === 0) return undefined;
  return { decadeRelations };
}

function roundTo(value: unknown, digits: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const scale = 10 ** digits;
  return Math.round(n * scale) / scale;
}

function finiteNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function addYearsUtcApprox(utcMs: number, years: number): number {
  const d = new Date(utcMs);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.getTime();
}

function approxDaeunUtcMs(entry: any, firstStartUtcMsApprox: number | null, decadeLengthYears: number, edge: 'start' | 'end'): number | null {
  const direct = finiteNumberOrNull(edge === 'start' ? entry?.startUtcMs : entry?.endUtcMs);
  if (direct !== null) return direct;
  if (firstStartUtcMsApprox === null) return null;
  const index = Number(entry?.index ?? 0);
  if (!Number.isFinite(index)) return null;
  const length = Number.isFinite(decadeLengthYears) && decadeLengthYears > 0 ? decadeLengthYears : 10;
  return addYearsUtcApprox(firstStartUtcMsApprox, (edge === 'start' ? index : index + 1) * length);
}

const LEGACY_FORTUNE_MAPPER_DEPENDENCIES: LegacyFortuneMapperDependencies = {
  stemCodeFromIdx,
  branchCodeFromIdx,
  annotateLuckPillar: luckPillarAnnotations,
  formatRelationsWithNatal: formatLuckRelationsWithNatal,
  formatRelationsWithDecade: formatLuckRelationsWithDecade,
  approxDaeunUtcMs,
  roundTo,
};

function scoreDiffConfidence(top: number, second: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(second)) return 0.5;
  const diff = top - second;
  if (diff <= 0) return 0.35;
  if (diff >= 1) return 1;
  return Math.max(0.35, Math.min(1, diff));
}

/** Convert a contractually ratio-based confidence to rounded 0..100 points. */
export function ratioToPoints(confidence: unknown): number {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 0;
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
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

function methodScore(record: any, element: string): number | null {
  if (!record || typeof record !== 'object') return null;
  return finiteNumberOrNull(record[element]);
}

function formatMethodScore(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}

function firstReason(value: any): string | null {
  if (!Array.isArray(value)) return null;
  const found = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return found ? String(found) : null;
}

function buildYongshinMethodEvidence(entry: { element: string; score: number }, primaryMethod: unknown, methodBreakdown: any): string | null {
  if (!methodBreakdown || typeof methodBreakdown !== 'object') return null;
  const element = String(entry.element ?? '').toUpperCase();
  const method = String(primaryMethod ?? '').toUpperCase();

  if (method === 'JOHU') {
    const template = methodBreakdown.johooTemplate;
    const reason = firstReason(template?.reasons);
    if (String(template?.primary ?? '').toUpperCase() === element && reason) return `조후: ${reason}`;
    const climateScore = formatMethodScore(methodScore(methodBreakdown.climate?.scores, element));
    return climateScore ? `조후: 계절·한난조습 점수 ${climateScore} 반영` : null;
  }

  if (method === 'BYEONGYAK') {
    const medicineScore = formatMethodScore(methodScore(methodBreakdown.medicine?.scores, element));
    return medicineScore ? `병약: 과다한 오행을 덜어내는 점수 ${medicineScore} 반영` : null;
  }

  if (method === 'TONGGWAN') {
    const intensity = formatMethodScore(finiteNumberOrNull(methodBreakdown.tongguan?.effectiveMaxIntensity ?? methodBreakdown.tongguan?.maxIntensity));
    return intensity ? `통관: 충돌을 이어 주는 강도 ${intensity} 반영` : null;
  }

  if (method === 'JONGHWA') {
    const follow = methodBreakdown.follow;
    const potential = formatMethodScore(finiteNumberOrNull(follow?.potential ?? follow?.potentialRaw));
    if (potential) return `종화: 한쪽 세력으로 따르는 잠재도 ${potential} 반영`;
    const transformation = methodBreakdown.transformations?.best;
    if (transformation?.pair && transformation?.resultElement) return `종화: ${transformation.pair} 합화 후보 반영`;
    const oneElement = methodBreakdown.oneElement?.element;
    return oneElement ? `종화: ${ohaengKoLabel(oneElement)} 단일 세력 신호 반영` : null;
  }

  const deficiency = formatMethodScore(methodScore(methodBreakdown.balance?.deficiency, element));
  const preference = formatMethodScore(finiteNumberOrNull(methodBreakdown.balance?.role?.[element]?.preference));
  if (deficiency && preference) return `억부: 부족도 ${deficiency}, 십신 선호 ${preference} 반영`;
  if (deficiency) return `억부: 부족도 ${deficiency} 반영`;
  if (preference) return `억부: 십신 선호 ${preference} 반영`;
  return null;
}

function buildYongshinReasoning(
  rank: number,
  entry: { element: string; score: number },
  topElement: string,
  confidencePoint: number,
  methodBreakdown?: any,
  primaryMethod?: unknown,
): string {
  const primaryLabel = ohaengKoLabel(entry.element);
  const topLabel = ohaengKoLabel(topElement || '상위');
  const evidence = rank === 0 ? buildYongshinMethodEvidence(entry, primaryMethod, methodBreakdown) : null;
  const evidenceText = evidence ? ` ${evidence}.` : '';
  if (rank === 0) {
    return `${primaryLabel} 기운이 가장 강해 용신 1순위입니다.${evidenceText} (신뢰도 ${confidencePoint}점).`;
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

const SHINSAL_SEAT_ORDER = ['year', 'month', 'day', 'hour'] as const;
type ShinsalSeatPillar = (typeof SHINSAL_SEAT_ORDER)[number];
const SHINSAL_SEAT_MULTIPLIER: Record<ShinsalSeatPillar, number> = {
  day: 1,
  month: 0.85,
  year: 0.7,
  hour: 0.6,
};

function shinsalPositionMultiplier(seatPillars: readonly ShinsalSeatPillar[], position: string): number {
  const seatMultipliers = seatPillars
    .map((seat) => SHINSAL_SEAT_MULTIPLIER[seat])
    .filter((value) => Number.isFinite(value));
  if (seatMultipliers.length > 0) return Math.max(...seatMultipliers);
  if (position === 'DAY') return SHINSAL_SEAT_MULTIPLIER.day;
  if (position === 'MONTH') return SHINSAL_SEAT_MULTIPLIER.month;
  if (position === 'YEAR') return SHINSAL_SEAT_MULTIPLIER.year;
  if (position === 'HOUR') return SHINSAL_SEAT_MULTIPLIER.hour;
  return 1;
}

const JIE_TERM_IDS = new Set([
  'XIAOHAN', 'LICHUN', 'JINGZHE', 'QINGMING', 'LIXIA', 'MANGZHONG',
  'XIAOSHU', 'LIQIU', 'BAILU', 'HANLU', 'LIDONG', 'DAXUE',
]);
const JIE_PROXIMITY_NEAR_HOURS = 24;

function buildJieProximity(
  facts: Record<string, unknown> | undefined,
): LegacyJieProximityV1 | null {
  const birthUtcMs = Number(facts?.['time.utcMs']);
  const around = facts?.['calendar.solarTermsAround'] as any;
  const terms = Array.isArray(around?.terms) ? around.terms : [];
  if (!Number.isFinite(birthUtcMs) || terms.length === 0) return null;

  const jieTerms = terms
    .filter((term: any) => JIE_TERM_IDS.has(String(term?.id)) && Number.isFinite(Number(term?.utcMs)))
    .map((term: any) => ({ id: String(term.id), utcMs: Number(term.utcMs) }))
    .sort((a: { utcMs: number }, b: { utcMs: number }) => a.utcMs - b.utcMs);

  let previous: { id: string; utcMs: number } | null = null;
  let next: { id: string; utcMs: number } | null = null;
  for (const term of jieTerms) {
    if (term.utcMs <= birthUtcMs) {
      previous = term;
    } else {
      next = term;
      break;
    }
  }
  if (!previous || !next) return null;

  const hoursSincePrevious = roundTo((birthUtcMs - previous.utcMs) / 3_600_000, 3);
  const hoursUntilNext = roundTo((next.utcMs - birthUtcMs) / 3_600_000, 3);
  const nearestDirection = hoursSincePrevious <= hoursUntilNext ? 'previous' : 'next';
  const nearestHours = nearestDirection === 'previous' ? hoursSincePrevious : hoursUntilNext;
  const nearestTerm = nearestDirection === 'previous' ? previous : next;

  return {
    birthUtcMs,
    solarTermMethod: String(around?.method ?? ''),
    previousTermId: previous.id,
    previousUtcMs: previous.utcMs,
    nextTermId: next.id,
    nextUtcMs: next.utcMs,
    hoursSincePrevious,
    hoursUntilNext,
    daysSincePrevious: roundTo(hoursSincePrevious / 24, 3),
    daysUntilNext: roundTo(hoursUntilNext / 24, 3),
    monthLengthDays: roundTo((next.utcMs - previous.utcMs) / 86_400_000, 3),
    nearestTermId: nearestTerm.id,
    nearestDirection,
    nearestHours,
    isNearBoundary: nearestHours <= JIE_PROXIMITY_NEAR_HOURS,
  };
}

function topTwo(values: Array<{ element: string; score: number }>): [string, string | null] {
  const first = values[0]?.element ?? '';
  const second = values[1]?.element ?? null;
  return [first, second];
}

// 감사 B4: 건록/양인/월겁의 기반 십성 유지 (건록=비견, 양인/월겁=겁재).
function readStructuralMonthFrameSubtype(value: unknown): BigyeopSubtype | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  switch (normalized) {
    case 'GEONROK':
    case 'YANGIN':
    case 'WOLGEOB':
      return normalized;
    default:
      return null;
  }
}

function structuralBaseSipseongKey(value: unknown): string {
  const subtype = readStructuralMonthFrameSubtype(value);
  const engineKey = subtype
    ? baseTenGodOfStructuralMonthFrame(subtype)
    : String(value ?? '').trim().toUpperCase();
  return normalizeTenGod(engineKey);
}

function deriveGyeokgukBaseSipseong(bestKeyCore: string): string | null {
  const normalized = String(bestKeyCore ?? '').trim().toUpperCase();
  if (!normalized) return null;
  const resolved = structuralBaseSipseongKey(normalized);
  if (!GYEOKGUK_BASE_SIPSEONG_KEYS.has(resolved)) return null;
  return normalizeTenGod(resolved);
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

function isSelectableMonthGyeokCandidate(candidate: any): boolean {
  return candidate?.eligibleForGyeokSelection !== false;
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
  const monthCandidates = Array.isArray(monthGyeok?.candidates)
    ? monthGyeok.candidates.filter(isSelectableMonthGyeokCandidate)
    : [];
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
  const structuralSubtype = readStructuralMonthFrameSubtype(ruleFacts?.month?.gyeok?.bigyeopSubtype);
  const structuralBaseCandidateType = structuralSubtype
    ? structuralBaseSipseongKey(structuralSubtype)
    : null;
  const monthCandidates = Array.isArray(ruleFacts?.month?.gyeok?.candidates)
    ? ruleFacts.month.gyeok.candidates.filter(isSelectableMonthGyeokCandidate)
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

  // 감사 B4: 건록/양인/월겁 키는 십성 인덱스(monthByType)에서 기반 십성으로 조회.
  const monthCandidateForType = (type: string): any =>
    monthByType.get(type) ?? monthByType.get(structuralBaseSipseongKey(type));

  for (const entry of ranking) {
    const type = normalizeGyeokgukKey(entry?.key);
    const score = Number(entry?.score);
    if (type !== selectedType && (!Number.isFinite(score) || score <= MIN_GYEOKGUK_CANDIDATE_SCORE)) continue;
    addCandidate(type, entry?.score, monthCandidateForType(type));
  }

  for (const candidate of monthCandidates) {
    const candidateType = normalizeGyeokgukKey(candidate?.tenGod);
    // A structural frame already represents this same month-command evidence.
    // Do not re-publish it as a contradictory BI/GEOB frame.
    if (structuralBaseCandidateType && candidateType === structuralBaseCandidateType) continue;
    const score = Number(candidate?.score);
    if (!Number.isFinite(score) || score <= MIN_GYEOKGUK_CANDIDATE_SCORE) continue;
    addCandidate(candidateType, candidate?.score, candidate);
  }

  if (bestKeyCore && !seen.has(bestKeyCore)) {
    addCandidate(bestKeyCore, bestScore, monthCandidateForType(bestKeyCore));
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

function resolveLegacyLongitudeCorrectionPolicy(
  legacy: LegacySajuConfig,
): LegacyLongitudeCorrectionPolicy {
  if (legacy.longitudeCorrectionPolicy !== undefined) {
    return legacy.longitudeCorrectionPolicy;
  }

  // Preserve the old switch's real behavior: false skipped the synthetic
  // preset-baseline transform and therefore let the core use the civil offset.
  if (legacy.longitudeCorrectionEnabled === false) {
    return { mode: 'civilOffsetMeridian' };
  }

  if (Number.isFinite(legacy.lmtBaselineLongitude)) {
    return {
      mode: 'fixedMeridian',
      meridianDeg: Number(legacy.lmtBaselineLongitude),
    };
  }

  return { mode: 'civilOffsetMeridian' };
}

function buildEngineConfig(
  legacy: LegacySajuConfig,
): { config: EngineConfig } {
  const dayCut = mapDayCutMode(resolveDayCutMode(legacy));
  const trueSolarTimeEnabled = legacy.trueSolarTimeEnabled ?? DEFAULT_TRUE_SOLAR_TIME_ENABLED;
  const includeEquationOfTime = legacy.includeEquationOfTime ?? true;

  let cfg = cloneConfig();
  cfg.calendar.dayBoundary = dayCut.dayBoundary;
  cfg.calendar.hourStemDayBoundary = dayCut.hourStemDayBoundary ?? dayCut.dayBoundary;
  // 감사 A11: YAZA_23_30의 -30분은 인스턴트가 아니라 일/시 경계 분류용 시프트로
  // 엔진에 전달한다(graphFactory ForDay/ForHour). deepMerge 이전에 세팅해야
  // legacy.calendar.dayCutShiftMinutes 수동 오버라이드가 살아있다.
  cfg.calendar.dayCutShiftMinutes = dayCut.dayCutShiftMinutes;
  cfg.calendar.trueSolarTime.enabled = trueSolarTimeEnabled;
  cfg.calendar.trueSolarTime.longitudeCorrectionPolicy = resolveLegacyLongitudeCorrectionPolicy(legacy);
  cfg.calendar.trueSolarTime.equationOfTime = trueSolarTimeEnabled && includeEquationOfTime ? 'approx' : 'off';
  cfg.calendar.trueSolarTime.applyTo = 'dayAndHour';
  cfg.calendar.solarTerms = {
    method: 'meeus',
    alwaysCompute: false,
  };

  cfg = deepMerge(cfg, pickEngineConfigPatch(legacy));
  // The dedicated legacy policy is the unambiguous public override even when
  // a caller also supplies a nested calendar patch.
  if (legacy.longitudeCorrectionPolicy !== undefined) {
    cfg.calendar.trueSolarTime.longitudeCorrectionPolicy = legacy.longitudeCorrectionPolicy;
  }
  const disabledToggles = LEGACY_REQUIRED_TOGGLES
    .filter((toggle) => cfg.toggles[toggle] !== true);
  if (disabledToggles.length > 0) {
    throw new LegacyContractConfigError(disabledToggles);
  }
  return { config: cfg };
}

function makeRequest(
  input: LegacyBirthInput,
): { request: SajuRequest; standard: CivilDateTime } {
  const standard = toCivilFromBirthInput(input);
  // 감사 A11: 과거에는 YAZA_23_30의 -30분을 여기(민간시→인스턴트)에 적용해
  // 입춘·절입 비교와 대운 기산까지 30분 당겨졌다. 시프트는 이제
  // config.calendar.dayCutShiftMinutes로 엔진의 경계 분류 노드만 이동한다.
  const timeZone = input.timezone ?? DEFAULT_TIMEZONE;
  const offsetMinutes = resolveOffsetMinutes(timeZone, standard);
  const rawLongitude = Number.isFinite(input.longitude) ? Number(input.longitude) : DEFAULT_LONGITUDE;
  const latitude = Number.isFinite(input.latitude) ? Number(input.latitude) : DEFAULT_LATITUDE;

  const instant = civilToIsoInstant(standard, offsetMinutes);
  const sex: SajuRequest['sex'] = input.gender === 'FEMALE' ? 'F' : 'M';

  return {
    request: {
      birth: { instant, calendar: 'gregorian' },
      sex,
      location: {
        lat: latitude,
        lon: rawLongitude,
        name: input.name,
      },
    },
    standard,
  };
}

function getSummaryPillars(bundle: AnalysisBundle) {
  const pillars = bundle.summary?.pillars;
  if (!pillars) throw new LegacyContractOutputError(['summary.pillars']);
  return pillars;
}

function assertLegacyBundleContract(bundle: AnalysisBundle): void {
  const summary = bundle.summary as Record<string, unknown> | undefined;
  const missing: string[] = [];
  const requireObject = (path: string, value: unknown): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      missing.push(path);
    }
  };
  const requireArray = (path: string, value: unknown): void => {
    if (!Array.isArray(value)) missing.push(path);
  };
  const requireFinite = (path: string, value: unknown): void => {
    if (!Number.isFinite(Number(value))) missing.push(path);
  };

  requireObject('summary', summary);
  requireObject('summary.pillars', summary?.pillars);
  requireObject('summary.strength', summary?.strength);
  requireFinite('summary.strength.index', (summary?.strength as any)?.index);
  requireFinite('summary.strength.support', (summary?.strength as any)?.support);
  requireFinite('summary.strength.pressure', (summary?.strength as any)?.pressure);
  requireObject('summary.yongshin', summary?.yongshin);
  requireArray('summary.yongshin.ranking', (summary?.yongshin as any)?.ranking);
  requireObject('summary.gyeokguk', summary?.gyeokguk);
  requireArray('summary.gyeokguk.ranking', (summary?.gyeokguk as any)?.ranking);
  requireObject('summary.elementDistribution', summary?.elementDistribution);
  requireObject(
    'summary.elementDistribution.total',
    (summary?.elementDistribution as any)?.total,
  );
  requireObject('summary.tenGods', summary?.tenGods);
  requireObject('summary.hiddenStems', summary?.hiddenStems);
  requireObject('summary.tenGodsHiddenStems', summary?.tenGodsHiddenStems);
  requireArray('summary.relations', summary?.relations);
  requireArray('summary.stemRelations', summary?.stemRelations);
  requireObject('summary.lifeStages', summary?.lifeStages);
  requireArray('summary.shinsalHits', summary?.shinsalHits);
  requireObject('summary.fortune', summary?.fortune);
  requireObject('summary.fortune.start', (summary?.fortune as any)?.start);
  requireArray('summary.fortune.decades', (summary?.fortune as any)?.decades);
  requireArray('summary.fortune.years', (summary?.fortune as any)?.years);
  requireObject('report.facts', bundle.report?.facts);

  if (missing.length > 0) throw new LegacyContractOutputError(missing);
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
  wolunStartYear?: number | null,
  wolunMonthCount?: number,
  timeZone?: string,
): LegacySajuOutputV1 {
  assertLegacyBundleContract(bundle);
  const facts = bundle.report?.facts as Record<string, unknown>;
  const correction = (facts?.['time.trueSolarCorrection'] ?? {}) as TrueSolarCorrectionView;
  const jieProximity = buildJieProximity(facts);
  const adjustedFact = (facts?.['time.solarLocalDateTime'] ?? facts?.['time.localDateTimeForHour'] ?? null) as any;

  const adjusted = adjustedFact?.date && adjustedFact?.time
    ? {
        y: toInt(adjustedFact.date.y, standard.y),
        m: toInt(adjustedFact.date.m, standard.m),
        d: toInt(adjustedFact.date.d, standard.d),
        h: toInt(adjustedFact.time.h, standard.h),
        min: toInt(adjustedFact.time.min, standard.min),
      }
    : addCivilMinutes(standard, Math.round(Number(correction.totalCorrectionMinutes ?? 0)));

  // 서머타임 보정 실측치 — 기존에는 0 하드코딩으로 미보정 서비스처럼 표기됐다 (감사 A9).
  const tz = timeZone ?? DEFAULT_TIMEZONE;
  const offsetAtBirth = resolveOffsetMinutes(tz, standard);
  const birthUtcMs = civilDateTimeToUtcMs(standard) - offsetAtBirth * 60_000;
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
        score: typeof item?.score === 'number' && Number.isFinite(item.score) ? item.score : 0,
      }))
    : [];
  const [topElement, secondElement] = topTwo(yongshinRanking);
  const worst = yongshinRanking.length ? yongshinRanking[yongshinRanking.length - 1]?.element ?? null : null;
  const secondWorst = yongshinRanking.length > 1 ? yongshinRanking[yongshinRanking.length - 2]?.element ?? null : null;
  const topScore = yongshinRanking[0]?.score ?? 0;
  const secondScore = yongshinRanking[1]?.score ?? 0;
  const yongshinConfidence = scoreDiffConfidence(topScore, secondScore);
  const yongshinConfidencePoints = ratioToPoints(yongshinConfidence);
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

  // --- 감사 B5: 종격(從格) 가능성 신호 — 억부 용신 신뢰도 게이트 ---
  // 기본 경로는 patterns.follow 옵트인 꺼짐 + weights.follow=0이라 CONG_* 격이
  // 구조적으로 발화하지 않는다. 극단 편중 명식에서 억부 용신을 무경고 확신
  // 표기하지 않도록 리스크를 파생한다. 트리거 2갈래:
  //  (1) jonggyeokCandidates에 candidate/selected 존재 (엔진 증거 표면)
  //  (2) 강약 극단(|index|>=0.5) + 우세비>=2.2 (yongshin follow의 minDominanceRatio 기본 재사용)
  //     - PRESSURE(극신약) 방향: 억부가 정반대(인성/비겁) 용신을 내는 대표 위해 → HIGH
  //     - SUPPORT(극신강) 방향: 억부 설기 용신이 순세와 부분 호환 → INFO
  // 상수 0.5/2.2는 base·deLingDiShi 두 강약 모델의 교리 종격 실측 대역(0.575~0.798)을
  // 모두 커버하도록 보정됨(감사 B5 프로브). support-side는 candidates 표면이 침묵하므로
  // (rootWeakness/dayMasterIsolation이 pressure-follow용 설계) 트리거 (2)가 본체다.
  const PRESSURE_CONG_SUBTYPES = new Set(['cong_cai', 'cong_guan', 'cong_sha', 'cong_er']);
  const SUPPORT_CONG_SUBTYPES = new Set(['cong_bi', 'cong_yin', 'zhuan_wang']);
  const jonggyeokRisk = (() => {
    const eps = 1e-9;
    const cands = jonggyeokCandidates.filter((c: any) => c && typeof c.subtype === 'string');
    const strong = cands.filter((c: any) => c.status === 'candidate' || c.status === 'selected');
    const pressureDom = pressure / Math.max(eps, support);
    const supportDom = support / Math.max(eps, pressure);
    const pressureSignals = cands.filter(
      (c: any) => PRESSURE_CONG_SUBTYPES.has(c.subtype) && c.status !== 'none',
    );
    const pressureExtreme = strengthIndex <= -0.5 && pressureDom >= 2.2 && pressureSignals.length > 0;
    const supportExtreme = strengthIndex >= 0.5 && supportDom >= 2.2;
    if (strong.length === 0 && !pressureExtreme && !supportExtreme) return undefined;

    const level: 'HIGH' | 'INFO' = strong.length > 0 || pressureExtreme ? 'HIGH' : 'INFO';
    const direction: 'PRESSURE' | 'SUPPORT' = strengthIndex < 0 ? 'PRESSURE' : 'SUPPORT';
    const related =
      strong.length > 0
        ? strong
        : direction === 'PRESSURE'
          ? pressureSignals
          : cands.filter((c: any) => SUPPORT_CONG_SUBTYPES.has(c.subtype) && c.status !== 'none');
    return {
      level,
      direction,
      strengthIndex: roundTo(strengthIndex, 3),
      dominanceRatio: roundTo(direction === 'PRESSURE' ? pressureDom : supportDom, 2),
      subtypes: related.map((c: any) => String(c.subtype)),
      maxCandidateScore: roundTo(Math.max(0, ...cands.map((c: any) => Number(c.score) || 0)), 6),
      // b-2: HIGH 리스크 시 finalConfidence를 동률 바닥(35점)으로 강등했는지 여부.
      confidenceAttenuated: false,
    };
  })();
  const yongshinWarnings: string[] =
    jonggyeokRisk?.level === 'HIGH'
      ? ['종격(從格) 가능성 — 억부 용신 신뢰도 낮음: 세력이 한쪽으로 크게 쏠린 명식으로, 종격 판정 시 용신이 달라질 수 있습니다.']
      : jonggyeokRisk
        ? ['전왕(專旺)·종왕 계열 가능성 — 극신강 편중 명식으로, 유파에 따라 순세(順勢) 용신이 우선될 수 있습니다.']
        : [];
  if (jonggyeokRisk?.level === 'HIGH' && yongshinConfidencePoints > 35) {
    // b-2 실적용 여부: cap(35)이 실제로 값을 낮춘 경우만 true.
    jonggyeokRisk.confidenceAttenuated = true;
  }

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

  // PR-5 (감사 B531): 천간합 상태 판정 — 합화(化) 성립/기반(합이불화)/쟁합/요합.
  // summary.stemRelations는 궁위가 없으므로 4천간에서 재탐지(detectStemRelations의
  // pairs/pillarIndexes)해 인스턴스별 상태를 만든다. 판정 재료는 transformations
  // (합화 factor — 격국 HUA_QI와 동일 소스라 자기모순 없음).
  const summaryPillarsForHap = getSummaryPillars(bundle);
  const chartStems = (['year', 'month', 'day', 'hour'] as const).map(
    (pos) => Number((summaryPillarsForHap as any)[pos]?.stem?.idx ?? 0),
  );
  const ruleFactsForHap = (bundle.report?.facts?.['rules.facts'] as any) ?? {};
  const tfCandidates: any[] = Array.isArray(ruleFactsForHap?.patterns?.transformations?.candidates)
    ? ruleFactsForHap.patterns.transformations.candidates
    : [];
  const tfBest = ruleFactsForHap?.patterns?.transformations?.best ?? null;
  const POS_NAMES = ['year', 'month', 'day', 'hour'] as const;
  const HAP_STATE_KO: Record<string, string> = {
    HUA: '합화(化) 성립',
    HAPGEO: '합이불화 — 기반(묶임)',
    JAENGHAP: '쟁합 — 합화 불성립',
    YOHAP: '원격 요합 — 약화',
  };
  const stemHapEvaluations: Array<{
    stems: [number, number];
    positions: [(typeof POS_NAMES)[number], (typeof POS_NAMES)[number]];
    state: 'HUA' | 'HAPGEO' | 'JAENGHAP' | 'YOHAP';
    resultElement: string | null;
    huaSignal: number;
    dayMasterInvolved: boolean;
  }> = [];
  const hapStateByPair = new Map<string, string>();
  for (const rel of detectStemRelations(chartStems as any)) {
    if (rel.type !== 'HAP' || !rel.pairs?.length) continue;
    const [lo, hi] = rel.members;
    const cand = tfCandidates.find(
      (c: any) => (c?.stems?.a === lo && c?.stems?.b === hi) || (c?.stems?.a === hi && c?.stems?.b === lo),
    );
    const huaSignal = clamp01(Number(cand?.factor ?? 0));
    // best 외 쌍에 HUA를 주면 격국 HUA_QI(단일 best)와 모순 — 후보 중 최대 factor
    // 쌍만 HUA 후보로 인정한다 (tfBest.pair 표기 형식에 의존하지 않는 판정).
    const maxFactor = tfCandidates.reduce((mx: number, c: any) => Math.max(mx, Number(c?.factor ?? 0)), 0);
    const isBestPair = huaSignal > 0 && huaSignal >= maxFactor - 1e-9 && !!tfBest;
    const jaenghap = rel.pairs.length >= 2; // 쟁합·투합 (甲2+己1 등) — pairs가 중복도
    for (const [i, j] of rel.pairs) {
      const gap = Math.abs(i - j);
      let state: 'HUA' | 'HAPGEO' | 'JAENGHAP' | 'YOHAP';
      if (jaenghap) state = 'JAENGHAP'; // 쟁합 시 합화 불성립 (주류)
      else if (huaSignal > 0 && isBestPair && gap === 1) state = 'HUA'; // 인접 + 합화 신호
      else if (gap >= 2) state = 'YOHAP'; // 원격 요합 — 약화
      else state = 'HAPGEO'; // 합이불화 = 기반 (현대 주류 다수)
      stemHapEvaluations.push({
        stems: [chartStems[i]!, chartStems[j]!] as [number, number],
        positions: [POS_NAMES[i]!, POS_NAMES[j]!],
        state,
        resultElement: rel.resultElement ? String(rel.resultElement) : null,
        huaSignal,
        dayMasterInvolved: i === 2 || j === 2,
      });
    }
    // 표시 축(cheonganRelations)은 쌍 타입당 1건이므로 대표 state를 붙인다
    // (쟁합이면 전체가 JAENGHAP이라 well-defined, 그 외엔 첫 인스턴스 state).
    const repState = jaenghap ? 'JAENGHAP' : stemHapEvaluations[stemHapEvaluations.length - rel.pairs.length]!.state;
    hapStateByPair.set(`${lo}-${hi}`, repState);
  }

  const cheonganRelations = stemRelations.map((relation: any) => {
    const type = String(relation?.type ?? '');
    const memberIdxs: number[] = Array.isArray(relation?.members)
      ? relation.members.map((m: any) => Number(m?.idx)).filter((n: number) => Number.isFinite(n))
      : [];
    const pairKey = [...memberIdxs].sort((a, b) => a - b).join('-');
    const hapState = type === 'HAP' ? hapStateByPair.get(pairKey) : undefined;
    return {
      type,
      members: memberIdxs.map((m) => stemCodeFromIdx(m)),
      resultOhaeng: relation?.resultElement ? String(relation.resultElement) : null,
      note: relationNoteForType(type, CHEONGAN_RELATION_NOTES),
      ...(hapState
        ? {
            hapState,
            hapStateKo: HAP_STATE_KO[hapState] ?? hapState,
            resultConfirmed: hapState === 'HUA',
          }
        : {}),
    };
  });

  const chartStemCodes = chartStems.map((stem) => stemCodeFromIdx(stem));
  const minStemPositionGap = (members: string[]): number | null => {
    const positions = members.map((member) => chartStemCodes
      .map((stem, index) => stem === member ? index : -1)
      .filter((index) => index >= 0));
    if (positions.length < 2 || positions.some((items) => items.length === 0)) return null;
    let min = Number.POSITIVE_INFINITY;
    for (const a of positions[0]!) {
      for (const b of positions[1]!) min = Math.min(min, Math.abs(a - b));
    }
    return Number.isFinite(min) ? min : null;
  };
  const scoredCheonganRelations = cheonganRelations.map((relation: any) => {
    const type = String(relation?.type ?? '').toUpperCase();
    const members = Array.isArray(relation?.members) ? relation.members.map(String) : [];
    const gap = minStemPositionGap(members);
    const state = String(relation?.hapState ?? '');
    const baseScore = type === 'CHUNG' ? 70 : type === 'HAP' ? 60 : 40;
    const outcomeMultiplier = type === 'HAP'
      ? state === 'HUA' ? 1 : state === 'HAPGEO' ? 0.62 : state === 'JAENGHAP' ? 0.42 : state === 'YOHAP' ? 0.3 : 0.5
      : type === 'CHUNG' ? 0.75 : 0.5;
    const adjacencyBonus = gap === 1 ? 15 : gap === 2 ? 5 : 0;
    const finalScore = roundTo(Math.min(100, baseScore * outcomeMultiplier + adjacencyBonus), 3);
    return {
      hit: { type, members },
      score: {
        baseScore,
        adjacencyBonus,
        outcomeMultiplier,
        finalScore,
        rationale: `type=${type};state=${state || 'NA'};positionGap=${gap ?? 'NA'}`,
      },
    };
  });

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

  // PR-5 (감사 B510): resolvedJijiRelations 죽은 배관 소생 — 하드코딩 [] 대체.
  // 어댑터는 이 목록이 비어있지 않으면 jijiRelations 대신 '전체 목록'으로 쓰므로
  // (saju-adapter extractJijiRelations), 해소 부분집합이 아니라 전 관계에 해소
  // 여부를 부착해 방출한다. 해소 판정 소스는 신강약 상호작용의 chart-wide 해소
  // 목록(details.delingdiShi.interaction.resolved — 충/형만 해당).
  const strengthInteraction = (bundle.report?.facts?.['rules.facts'] as any)?.strength?.details?.delingdiShi?.interaction;
  const resolvedKeys = new Set<string>(
    Array.isArray(strengthInteraction?.resolved)
      ? strengthInteraction.resolved.map(
          (r: any) => `${r?.type}:${(Array.isArray(r?.members) ? [...r.members] : []).sort((a: number, b: number) => a - b).join('-')}`,
        )
      : [],
  );
  const resolvedJijiRelations = resolvedKeys.size > 0
    ? branchRelations.map((relation: any) => {
        const type = String(relation?.type ?? '');
        const memberIdxs = Array.isArray(relation?.members)
          ? relation.members.map((m: any) => Number(m?.idx)).filter((n: number) => Number.isFinite(n))
          : [];
        const key = `${type}:${[...memberIdxs].sort((a, b) => a - b).join('-')}`;
        const isResolved = resolvedKeys.has(key);
        return {
          hit: {
            type,
            members: memberIdxs.map((m: number) => branchCodeFromIdx(m)),
            note: relationNoteForType(type, JIJI_RELATION_NOTES),
          },
          outcome: isResolved ? '해소' : relationOutcomeForType(type),
          reasoning: isResolved
            ? '탐합망충(貪合忘沖) — 당사자가 유효한 합에 묶여 손상이 해소되었습니다.'
            : null,
        };
      })
    : [];

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
  const SEAT_ORDER = SHINSAL_SEAT_ORDER;
  type SeatPillar = ShinsalSeatPillar;
  const weightedByKey = new Map<string, {
    hit: { type: string; position: string; grade: string; basedOn: string; seatPillars: SeatPillar[]; qualityReasons?: string[]; conditionPenalty?: number };
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
    const qualityReasons = (Array.isArray(hit?.qualityReasons) ? hit.qualityReasons : [])
      .map((reason: unknown) => String(reason))
      .filter(Boolean);
    const rawConditionPenalty = Number(hit?.conditionPenalty);
    const conditionPenalty = Number.isFinite(rawConditionPenalty) ? roundTo(rawConditionPenalty, 3) : null;
    const positionMultiplier = shinsalPositionMultiplier(seatPillars, position);
    const baseWeight = Math.max(0, Math.min(100, Math.round(qualityWeight * 100)));
    const weightedScore = Math.round(baseWeight * positionMultiplier);
    const payload = {
      hit: {
        type,
        position,
        grade,
        basedOn,
        seatPillars,
        ...(qualityReasons.length ? { qualityReasons } : {}),
        ...(conditionPenalty !== null ? { conditionPenalty } : {}),
      },
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
      const mergedQualityReasons = [
        ...new Set([...(existing.hit.qualityReasons ?? []), ...(payload.hit.qualityReasons ?? [])]),
      ];
      if (mergedQualityReasons.length) {
        winner.hit.qualityReasons = mergedQualityReasons;
      }
      const mergedConditionPenalties = [existing.hit.conditionPenalty, payload.hit.conditionPenalty]
        .filter((value): value is number => Number.isFinite(value));
      if (mergedConditionPenalties.length) {
        winner.hit.conditionPenalty = Math.max(...mergedConditionPenalties);
      }
      winner.count = existing.count + 1;
      weightedByKey.set(dedupeKey, winner);
    }
  }
  const weightedShinsalHits = [...weightedByKey.values()];
  const shinsalHits = weightedShinsalHits.map((item) => item.hit);
  const gongmangVoidBranches = extractGongmangVoidBranches(bundle);

  const fortunePayload = mapLegacyFortune({
    fortune: bundle.summary?.fortune as any,
    timeline: (facts?.['fortune.timeline'] ?? null) as any,
    relationTimeline: (facts?.['fortune.relations'] ?? (bundle.summary?.fortune as any)?.relations ?? null) as any,
    dayStemIdx: stemIdxFromUnknown(pillars.day.stem.idx),
    yearBranchIdx: branchIdxFromUnknown(pillars.year.branch.idx),
    lifeStagePolicy: (facts?.['policy.lifeStages'] ?? DEFAULT_TRANSIT_LIFE_STAGE_POLICY) as any,
    selection: {
      daeunCount,
      saeunStartYear,
      saeunYearCount,
      wolunStartYear,
      wolunMonthCount,
    },
    dependencies: LEGACY_FORTUNE_MAPPER_DEPENDENCIES,
  });
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
    jieProximity,
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
      // 감사 B5(b-2): HIGH 리스크(종격 가능성) 명식에서 억부 확신을
      // 동률 바닥(scoreDiffConfidence 하한 35점)으로 강등.
      finalConfidence:
        jonggyeokRisk?.level === 'HIGH'
          ? Math.min(yongshinConfidencePoints, 35)
          : yongshinConfidencePoints,
      agreement: 'RANKING',
      consensus: yongshinConsensus,
      methodBreakdown: yongshin?.methodBreakdown ?? null,
      // 감사 B5 (additive): 종격 가능성 신호. daeunInfo.warnings 선례를 따른다.
      warnings: yongshinWarnings,
      jonggyeokRisk,
      recommendations: yongshinRanking.slice(0, 3).map((entry: { element: string; score: number }, i: number) => {
        const confidence = ratioToPoints(entry.score);
        return {
          // 1위 type은 엔진이 산출한 실제 지배 방법(primaryMethod)에서 유도한다 (감사 A2·B6).
          // 기본 정책(억부 1.0 + 조후 0.25)에서는 EOKBU 또는 JOHU만 나온다.
          // primaryMethod 부재(구 dist 등) 시 EOKBU 폴백 — 기본 정책 최빈값.
          type: i === 0 ? (LEGACY_YONGSHIN_TYPE[String(yongshin?.primaryMethod ?? '')] ?? 'EOKBU') : 'RANKING',
          primaryElement: entry.element,
          secondaryElement: yongshinRanking[i + 1]?.element ?? null,
          confidence,
          reasoning: buildYongshinReasoning(
            i,
            entry,
            topElement,
            confidence,
            yongshin?.methodBreakdown,
            i === 0 ? yongshin?.primaryMethod : undefined,
          ),
        };
      }),
    },
    gyeokgukResult: {
      type: bestKeyCore,
      category: isJonggyeok ? 'JONGGYEOK' : 'NORMAL',
      baseSipseong,
      confidence: Math.max(0, Math.min(1, bestScore)),
      basis: (bundle.summary?.gyeokguk as any)?.basis ?? null,
      scores: (bundle.summary?.gyeokguk as any)?.scores ?? {},
      reasoning: bestKeyCore
        ? `격국 후보 중 ${gyeokgukKoLabel(bestKeyCore)}이(가) 가장 유력합니다.`
        : '격국 후보를 확정하기 어려워 추가 검토가 필요합니다.',
      candidates: gyeokgukCandidates,
      jonggyeokCandidates,
      // PR-6 (additive): 격국 성패 — 상신·순용/역용·성격/파격 (rules.facts에서 통과).
      seongpae: (bundle.report?.facts?.['rules.facts'] as any)?.month?.gyeok?.seongpae ?? null,
    },
    ohaengDistribution,
    deficientElements,
    excessiveElements,
    cheonganRelations,
    scoredCheonganRelations,
    // PR-5 (감사 B531): 합화 평가 죽은 배관 소생 — 어댑터 extractHapHwaEvaluations가
    // 대기 중이던 스키마(stem1/2, position1/2, resultOhaeng, state, confidence,
    // reasoning, dayMasterInvolved)에 맞춰 인스턴스(궁위) 단위로 방출.
    hapHwaEvaluations: stemHapEvaluations.map((ev) => ({
      stem1: stemCodeFromIdx(ev.stems[0]),
      stem2: stemCodeFromIdx(ev.stems[1]),
      position1: normalizePositionKey(ev.positions[0]),
      position2: normalizePositionKey(ev.positions[1]),
      resultOhaeng: ev.resultElement ?? '',
      state: ev.state,
      confidence: roundTo(ev.state === 'HUA' ? ev.huaSignal : clamp01(1 - ev.huaSignal), 3),
      reasoning:
        ev.state === 'HUA'
          ? `천간합이 화(化) 조건을 충족해 ${OHAENG_KO_LABEL[ev.resultElement ?? ''] ?? ev.resultElement}(으)로 화합니다.`
          : ev.state === 'JAENGHAP'
            ? '같은 천간이 둘 이상 합을 다투는 쟁합(爭合)이라 합화가 성립하지 않습니다.'
            : ev.state === 'YOHAP'
              ? '떨어진 기둥끼리의 요합(遙合)이라 합의 작용이 약합니다.'
              : '합이불화(合而不化) — 화 조건 미충족으로 두 천간이 서로 묶입니다(기반).',
      dayMasterInvolved: ev.dayMasterInvolved,
    })),
    jijiRelations,
    resolvedJijiRelations,
    tenGodAnalysis: {
      dayMaster: dayStemCode,
      byPosition,
    },
    shinsalHits,
    weightedShinsalHits,
    sibiUnseong,
    // PR-12-4 (감사 C6): 음양 균형 — summary 집계를 additive로 재방출 (만세력 기본 표기 축).
    yinYangBalance: (bundle.summary as any)?.yinYangBalance ?? null,
    gongmangVoidBranches,
    ...fortunePayload,
    trace,
  };
}

export function createBirthInput(params: LegacyBirthInput): LegacyBirthInput {
  const timezoneProvided = params.timezone !== undefined;
  const latitudeProvided = params.latitude !== undefined;
  const longitudeProvided = params.longitude !== undefined;
  const anyLocationProvided = timezoneProvided || latitudeProvided || longitudeProvided;
  const completeLocationProvided = timezoneProvided && latitudeProvided && longitudeProvided;

  if (anyLocationProvided && !completeLocationProvided) {
    throw new LegacyBirthLocationError('SAJU_LEGACY_BIRTH_LOCATION_PARTIAL');
  }

  let timezone = DEFAULT_TIMEZONE;
  let latitude = DEFAULT_LATITUDE;
  let longitude = DEFAULT_LONGITUDE;
  if (completeLocationProvided) {
    const rawTimezone = params.timezone;
    const rawLatitude = params.latitude;
    const rawLongitude = params.longitude;
    if (
      typeof rawTimezone !== 'string'
      || rawTimezone.trim().length === 0
      || typeof rawLatitude !== 'number'
      || !Number.isFinite(rawLatitude)
      || rawLatitude < -90
      || rawLatitude > 90
      || typeof rawLongitude !== 'number'
      || !Number.isFinite(rawLongitude)
      || rawLongitude < -180
      || rawLongitude > 180
    ) {
      throw new LegacyBirthLocationError('SAJU_LEGACY_BIRTH_LOCATION_INVALID');
    }
    timezone = rawTimezone.trim();
    latitude = rawLatitude;
    longitude = rawLongitude;
  }

  return {
    birthYear: toInt(params.birthYear, 0),
    birthMonth: toInt(params.birthMonth, 1),
    birthDay: toInt(params.birthDay, 1),
    birthHour: clampHour(params.birthHour),
    birthMinute: clampMinute(params.birthMinute),
    gender: params.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
    calendarType: params.calendarType === 'LUNAR' ? 'LUNAR' : 'SOLAR',
    isLeapMonth: params.isLeapMonth,
    timezone,
    latitude,
    longitude,
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
): LegacySajuOutputV1 {
  const normalizedInput = createBirthInput(birthInput);
  if (normalizedInput.calendarType === 'LUNAR') {
    throw new Error('Legacy lunar input is not supported in the current engine bridge.');
  }

  const legacy = normalizeLegacyConfig(rawConfig);
  const tz = normalizedInput.timezone ?? DEFAULT_TIMEZONE;
  const { config } = buildEngineConfig(legacy);
  const { request, standard } = makeRequest(normalizedInput);

  const engine = createEngine(config);
  const bundle = engine.analyze(request);
  return normalizeLegacyOutput(
    bundle,
    standard,
    options?.daeunCount,
    options?.saeunStartYear,
    options?.saeunYearCount,
    options?.wolunStartYear,
    options?.wolunMonthCount,
    tz,
  );
}
