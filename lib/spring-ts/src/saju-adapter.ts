/**
 * saju-adapter.ts
 *
 * Translates raw saju-ts output into the SajuSummary format used by the rest
 * of the Spring engine.  Think of this as the "interpreter" that sits between
 * the low-level Four Pillars engine and the user-facing scoring pipeline.
 *
 * Glossary
 *  Cheongan (천간): 10 Heavenly Stems (e.g. GAP, EUL, BYEONG ...)
 *  Jiji (지지): 12 Earthly Branches (e.g. JA, CHUK, IN ...)
 *  Ohaeng (오행): Five Elements (WOOD, FIRE, EARTH, METAL, WATER)
 *  Yongshin (용신): The balancing element for the chart
 *  Heesin (희신): Supporting element for yongshin
 *  Gisin (기신): Harmful element
 *  Gusin (구신): Most harmful element
 *  Sipseong (십성): Ten-god relationships between stems
 *  Gyeokguk (격국): Structural pattern of the chart
 *  Shinsal (신살): Auspicious/inauspicious markers
 *  Gongmang (공망): Void branches
 *  Daeun (대운): 10-year luck cycles
 */
import { type ElementKey, emptyDistribution } from './core/scoring.js';
import type {
  SajuOutputSummary, SpringRequest, SajuSummary, PillarSummary, BirthInfo,
  SajuPillarPosition, SajuTenGodPositionGroup,
  SajuAxisStrengthMap, SajuJudgmentStrength, SajuInputUncertaintyAxis,
  GyeokgukCandidateSummary, JonggyeokCandidateSummary, SourceTierMetadata,
  YongshinConsensusScoreboard, LunarConversionSummary, JieProximitySummary,
  DaeunInfoSummary, SaeunPillarSummary, WolunPillarSummary,
  SajuAnalysisReasonCode, SajuAnalysisStatus, SajuSafeAnalysisResult,
  CheonganRelationScore,
} from './types.js';
import {
  assertLegacySajuOutputV1Contract,
  assertSajuModuleContract,
  assertSajuNaeumCapability,
  assertSajuPalaceCapability,
  SajuBridgeContractMismatchError,
  type LegacySajuOutputV1Contract,
  type LegacyStrengthResultContract,
  type RuntimeLegacySajuConfig,
  type SajuModule,
} from './saju-bridge-contract.js';
import { leapMonthOfLunarYear, lunarToSolar } from './calendar/korean-lunar-calendar.js';
import { kasiLunarToSolar } from './calendar/kasi-lunar-api.js';
import {
  SajuRequestValidationError,
  requiredMaxMonthsForRequest,
  requiredMaxYearsForRequest,
  validateSajuConfigFortuneHorizon,
  validateSajuRequestOptions,
} from './saju-request-policy.js';
import { isScorableSajuSummary } from './saju-analysis-contract.js';

// ---------------------------------------------------------------------------
//  Configuration loaded from JSON files
// ---------------------------------------------------------------------------
import cheonganJijiConfig from '../config/cheongan-jiji.json';
import engineConfig from '../config/engine.json';
import sajuScoringConfig from '../config/saju-scoring.json';
import { KOREA_REGION_COORDINATES, type RegionCoordinate } from './region-coordinates.js';
import { extractGyeokgukSeongpae } from './saju-seongpae-contract.js';

/** Maps uppercase element codes ("WOOD") to display keys ("Wood"). */
const ELEMENT_CODE_TO_KEY: Record<string, ElementKey> = cheonganJijiConfig.elementCodeToKey as Record<string, ElementKey>;

/** Canonical list of the five elements in order. */
const ELEMENT_CODES: readonly string[] = cheonganJijiConfig.elementCodes;

/** Heavenly Stems reference table (hangul, hanja, element, polarity). */
const CHEONGAN: Record<string, { hangul: string; hanja: string; element: string; polarity: string }> = cheonganJijiConfig.cheongan;

/** Earthly Branches reference table (hangul, hanja). */
const JIJI: Record<string, { hangul: string; hanja: string }> = cheonganJijiConfig.jiji;

/** Maps each ten-god name to its group: friend/output/wealth/authority/resource. */
const TEN_GOD_GROUP: Record<string, string> = sajuScoringConfig.tenGodGroups;

/** Maps user-facing preset names ("korean") to internal preset codes ("KOREAN_MAINSTREAM"). */
const PRESET_MAP: Record<string, string> = engineConfig.presetMapping;

/** Relative path used to dynamically import the saju-ts engine. */
/** Default coordinates (Seoul) and timezone for birth info. */
const DEFAULT_LATITUDE: number = engineConfig.defaultCoordinates.latitude;
const DEFAULT_LONGITUDE: number = engineConfig.defaultCoordinates.longitude;
const DEFAULT_TIMEZONE: string = engineConfig.defaultTimezone;
const DEFAULT_UNKNOWN_HOUR = 12;
const DEFAULT_UNKNOWN_MINUTE = 0;
const UNKNOWN_HOUR_AFFECTED_AXES: readonly SajuInputUncertaintyAxis[] = [
  'hourPillar',
  'yongshin',
  'gyeokguk',
  'strength',
  'tenGod',
  'fortuneTiming',
];
const INPUT_UNCERTAINTY_AXIS_LABELS: Record<SajuInputUncertaintyAxis, string> = {
  hourPillar: '시주',
  yongshin: '용신 후보',
  gyeokguk: '격국',
  strength: '신강약',
  tenGod: '십성 위치',
  fortuneTiming: '운세 시점',
};
const UNKNOWN_HOUR_AFFECTED_AXIS_LABELS = UNKNOWN_HOUR_AFFECTED_AXES.map(
  (axis) => INPUT_UNCERTAINTY_AXIS_LABELS[axis],
);
const DISTRIBUTION_ROUND_DIGITS = 1;
const DEFICIENT_AVERAGE_RATIO = 0.5;
const EXCESSIVE_AVERAGE_RATIO = 1.7;
const DEFAULT_REGION_CODE = 'SEOUL';
const GYEOKGUK_CANDIDATE_SOURCE_TIER: SourceTierMetadata = {
  tier: 'T2_REFERENCE_IMPLEMENTATION',
  sourceType: 'reference_implementation',
  sourceUrl: null,
  accessedAt: '2026-05-01',
  quoteShort: null,
  humanInterpretation: 'saju-ts의 월령 격국 및 격국 후보 산식에서 계산한 표시용 근거입니다. 권위 근거로 단정하지 않습니다.',
  copyrightNote: '인용 원문 없이 구현 산식에서 만든 메타데이터입니다.',
  authorityTruthEligible: false,
};

const YEAR_STEM_CODES = ['GAP', 'EUL', 'BYEONG', 'JEONG', 'MU', 'GI', 'GYEONG', 'SIN', 'IM', 'GYE'] as const;
const YEAR_BRANCH_CODES = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'] as const;
const HOUR_BRANCH_CODES = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'] as const;
const TEN_GOD_CODES = [
  'BI_GYEON', 'GYEOB_JAE', 'SIK_SIN', 'SANG_GWAN',
  'PYEON_JAE', 'JEONG_JAE', 'PYEON_GWAN', 'JEONG_GWAN',
  'PYEON_IN', 'JEONG_IN',
] as const;
const YONGSHIN_TYPE_CODES = [
  'EOKBU', 'JOHU', 'RANKING', 'GYEOKGUK', 'TONGGWAN', 'HAPWHA_YONGSHIN', 'ILHAENG',
] as const;
const GYEOKGUK_CATEGORY_CODES = ['NORMAL', 'JONGGYEOK'] as const;
const YONGSHIN_CONFLICT_LEVELS = ['none', 'low', 'medium', 'high'] as const;
const JONGGYEOK_SUBTYPE_CODES = [
  'cong_cai',
  'cong_guan',
  'cong_sha',
  'cong_er',
  'cong_yin',
  'cong_bi',
  'zhuan_wang',
  'hua_qi',
] as const;
const JONGGYEOK_STATUS_CODES = ['none', 'possible', 'candidate', 'selected', 'blocked'] as const;

/** Alias map: alternative romanizations → canonical code used in label tables. */
const CODE_ALIASES: Record<string, string> = {
  SIK_SHIN: 'SIK_SIN',
  GEOB_JAE: 'GYEOB_JAE',
};

/** Resolves code aliases to canonical form. */
function resolveCodeAlias(code: string): string {
  return CODE_ALIASES[code] ?? code;
}

const ELEMENT_KO_LABEL: Record<string, string> = {
  WOOD: '\uBAA9',
  FIRE: '\uD654',
  EARTH: '\uD1A0',
  METAL: '\uAE08',
  WATER: '\uC218',
};
const POLARITY_KO_LABEL: Record<string, string> = {
  YANG: '\uC591',
  YIN: '\uC74C',
};
const STRENGTH_LEVEL_KO_LABEL: Record<string, string> = {
  STRONG: '\uC2E0\uAC15',
  WEAK: '\uC2E0\uC57D',
  BALANCED: '\uC911\uD654',
};
const YONGSHIN_AGREEMENT_KO_LABEL: Record<string, string> = {
  RANKING: '\uC21C\uC704 \uAE30\uBC18',
  EOKBU: '\uC5B5\uBD80',
  JOHU: '\uC870\uD6C4',
  GYEOKGUK: '\uACA9\uAD6D',
};
const YONGSHIN_TYPE_KO_LABEL: Record<string, string> = {
  EOKBU: '\uC5B5\uBD80',
  JOHU: '\uC870\uD6C4',
  RANKING: '\uC21C\uC704 \uCD94\uCC9C',
  GYEOKGUK: '\uACA9\uAD6D \uAE30\uBC18',
  TONGGWAN: '\uD1B5\uAD00',
  HAPWHA_YONGSHIN: '\uD569\uD654\uC6A9\uC2E0',
  ILHAENG: '\uC77C\uD589 \uC6A9\uC2E0',
};
const TEN_GOD_KO_LABEL: Record<string, string> = {
  BI_GYEON: '비견',
  GYEOB_JAE: '겁재',
  SIK_SIN: '식신',
  SANG_GWAN: '상관',
  PYEON_JAE: '편재',
  JEONG_JAE: '정재',
  PYEON_GWAN: '편관',
  JEONG_GWAN: '정관',
  PYEON_IN: '편인',
  JEONG_IN: '정인',
};
const GYEOKGUK_CATEGORY_KO_LABEL: Record<string, string> = {
  NORMAL: '\uC77C\uBC18',
  JONGGYEOK: '\uC885\uACA9',
};
const GYEOKGUK_KO_LABEL: Record<string, string> = {
  BI_GYEON: '비견격',
  GYEOB_JAE: '겁재격',
  // 감사 B4: 월지 비겁의 주류 격명 (기본 모드). 누락 시 원시 코드 노출됨.
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
const JIJI_RELATION_NOTE_KO_LABEL: Record<string, string> = {
  CHUNG: '\uC9C0\uC9C0 \uCDA9 \uAD00\uACC4',
  HAE: '\uC9C0\uC9C0 \uD574 \uAD00\uACC4',
  PA: '\uC9C0\uC9C0 \uD30C \uAD00\uACC4',
  WONJIN: '\uC9C0\uC9C0 \uC6D0\uC9C4 \uAD00\uACC4',
  GWIMUN: '\uC9C0\uC9C0 \uADC0\uBB38 \uAD00\uACC4',
  HYEONG: '\uC9C0\uC9C0 \uD615 \uAD00\uACC4',
  JA_HYEONG: '\uC9C0\uC9C0 \uC790\uD615 \uAD00\uACC4',
  SAMHYEONG: '\uC9C0\uC9C0 \uC0BC\uD615 \uAD00\uACC4',
  HAP: '\uC9C0\uC9C0 \uD569 \uAD00\uACC4',
  YUKHAP: '\uC9C0\uC9C0 \uC721\uD569 \uAD00\uACC4',
  SAMHAP: '\uC9C0\uC9C0 \uC0BC\uD569 \uAD00\uACC4',
  BANHAP: '\uC9C0\uC9C0 \uBC18\uD569 \uAD00\uACC4',
  BANGHAP: '\uC9C0\uC9C0 \uBC29\uD569 \uAD00\uACC4',
};
const JIJI_RELATION_OUTCOME_KO_LABEL: Record<string, string> = {
  CHUNG: '\uCDA9',
  HAE: '\uD574',
  PA: '\uD30C',
  WONJIN: '\uC6D0\uC9C4',
  GWIMUN: '\uADC0\uBB38',
  HYEONG: '\uD615',
  JA_HYEONG: '\uC790\uD615',
  SAMHYEONG: '\uC0BC\uD615',
  HAP: '\uD569',
  YUKHAP: '\uC721\uD569',
  SAMHAP: '\uC0BC\uD569',
  BANHAP: '\uBC18\uD569',
  BANGHAP: '\uBC29\uD569',
};
const CHEONGAN_RELATION_NOTE_KO_LABEL: Record<string, string> = {
  HAP: '\uCC9C\uAC04 \uD569 \uAD00\uACC4',
  CHUNG: '\uCC9C\uAC04 \uCDA9 \uAD00\uACC4',
  GEUK: '\uCC9C\uAC04 \uADF9 \uAD00\uACC4',
};
const RELATION_TYPE_KO_LABEL: Record<string, string> = {
  HAP: '\uD569',
  YUKHAP: '\uC721\uD569',
  CHUNG: '\uCDA9',
  GEUK: '\uADF9',
  HAE: '\uD574',
  PA: '\uD30C',
  WONJIN: '\uC6D0\uC9C4',
  GWIMUN: '\uADC0\uBB38',
  HYEONG: '\uD615',
  JA_HYEONG: '\uC790\uD615',
  SAMHYEONG: '\uC0BC\uD615',
  SAMHAP: '\uC0BC\uD569',
  BANHAP: '\uBC18\uD569',
  BANGHAP: '\uBC29\uD569',
};
const SHINSAL_TYPE_KO_LABEL: Record<string, string> = {
  // 관계 기반 살 (relation-based)
  CHUNG_SAL: '충살',
  HYEONG_SAL: '형살',
  HAE_SAL: '해살',
  PA_SAL: '파살',
  WONJIN_SAL: '원진살',
  GWIMUN_SAL: '귀문관살',
  GOSIN_SAL: '고신살',
  GWASUK_SAL: '과숙살',
  GEOKGAK_SAL: '격각살',
  // 12신살 (twelve sal)
  JI_SAL: '지살',
  DOHWA: '도화',
  WOL_SAL: '월살',
  MANG_SHIN_SAL: '망신살',
  JANGSEONG: '장성살',
  BAN_AN_SAL: '반안살',
  YEOKMA: '역마',
  YUK_HAE_SAL: '육해살',
  HUAGAI: '화개살',
  GEOB_SAL: '겁살',
  JAESAL: '재살',
  CHEON_SAL: '천살',
  // 홍란/천희
  HONG_LUAN: '홍란',
  CHEON_HUI: '천희',
  // 공망
  GONGMANG: '공망',
  // 일간 기준 귀인/살 (day-stem based)
  CHEON_EUL_GUI_IN: '천을귀인',
  TAE_GEUK_GUI_IN: '태극귀인',
  MUN_CHANG_GUI_IN: '문창귀인',
  MUN_GOK_GUI_IN: '문곡귀인',
  HAK_DANG_GUI_IN: '학당귀인',
  BI_IN_SAL: '비인살',
  YANG_IN: '양인',
  EUM_IN: '\uC74C\uC778',
  LOK_SHIN: '록신',
  GUK_IN_GUI_IN: '국인귀인',
  CHEON_JU_GUI_IN: '천주귀인',
  CHEON_GWAN_GUI_IN: '천관귀인',
  CHEON_BOK_GUI_IN: '천복귀인',
  BOK_SEONG_GUI_IN: '복성귀인',
  GEUM_YEO_GUI_IN: '금여귀인',
  HONG_YEOM_SAL: '홍염살',
  // 월지 기준 귀인 (month-branch based)
  WOL_DEOK_GUI_IN: '월덕귀인',
  WOL_DEOK_HAP: '월덕합',
  DEOK_SU_GUI_IN: '덕수귀인',
  CHEON_DEOK_GUI_IN: '천덕귀인',
  CHEON_DEOK_HAP: '천덕합',
  CHEON_UI: '천의',
  // 복합/특수
  CHEON_WOL_DEOK: '천월덕',
  CHEON_SA: '천사일',
  // 일주 기반
  KUI_GANG: '괴강',
  BAEK_HO: '백호',
};
const SHINSAL_TYPE_COMPACT_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.keys(SHINSAL_TYPE_KO_LABEL).map((code) => [code.replace(/_/g, ''), code]),
);
const SHINSAL_POSITION_KO_LABEL: Record<string, string> = {
  YEAR: '\uB144\uC8FC',
  MONTH: '\uC6D4\uC8FC',
  DAY: '\uC77C\uC8FC',
  HOUR: '\uC2DC\uC8FC',
  OTHER: '\uAE30\uD0C0',
};

// ---------------------------------------------------------------------------
//  Type-safe constant: keys of the time-correction object
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
  const code = normalizeElementCode(value);
  return code ? (ELEMENT_CODE_TO_KEY[code] ?? null) : null;
}

function roundTo(value: unknown, digits: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const scale = 10 ** digits;
  return Math.round(n * scale) / scale;
}

function extractJieProximity(raw: any): JieProximitySummary | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const nearestDirection = raw.nearestDirection === 'previous' || raw.nearestDirection === 'next'
    ? raw.nearestDirection
    : undefined;
  const numeric = {
    birthUtcMs: Number(raw.birthUtcMs),
    previousUtcMs: Number(raw.previousUtcMs),
    nextUtcMs: Number(raw.nextUtcMs),
    hoursSincePrevious: Number(raw.hoursSincePrevious),
    hoursUntilNext: Number(raw.hoursUntilNext),
    daysSincePrevious: Number(raw.daysSincePrevious),
    daysUntilNext: Number(raw.daysUntilNext),
    monthLengthDays: Number(raw.monthLengthDays),
    nearestHours: Number(raw.nearestHours),
  };
  if (!nearestDirection || Object.values(numeric).some((value) => !Number.isFinite(value))) return undefined;
  const previousTermId = String(raw.previousTermId ?? '');
  const nextTermId = String(raw.nextTermId ?? '');
  const nearestTermId = String(raw.nearestTermId ?? '');
  if (!previousTermId || !nextTermId || !nearestTermId) return undefined;

  return {
    ...numeric,
    solarTermMethod: String(raw.solarTermMethod ?? ''),
    previousTermId,
    nextTermId,
    nearestTermId,
    nearestDirection,
    isNearBoundary: raw.isNearBoundary === true,
  };
}

function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, '');
}

function normalizeRegionToken(value: unknown): string {
  return stripWhitespace(String(value ?? ''))
    .toLowerCase()
    .replace(/[.,()_/-]/g, '');
}

const REGION_ALIAS_ENTRIES = KOREA_REGION_COORDINATES
  .flatMap((region) => region.aliases.map((alias) => ({
    alias: normalizeRegionToken(alias),
    region,
  })))
  .filter((entry) => entry.alias.length > 0)
  .sort((a, b) => b.alias.length - a.alias.length);

const DEFAULT_REGION_COORDINATE = KOREA_REGION_COORDINATES.find((entry) => entry.code === DEFAULT_REGION_CODE)
  ?? KOREA_REGION_COORDINATES[0]
  ?? {
    code: DEFAULT_REGION_CODE,
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
    timezone: DEFAULT_TIMEZONE,
    aliases: ['서울'],
  };

interface ResolvedBirthCoordinates {
  latitude: number;
  longitude: number;
  timezone: string;
  regionCode: string | null;
  source: 'explicit' | 'region' | 'default';
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickBirthRegionCandidates(birth: BirthInfo): string[] {
  const birthAny = birth as unknown as Record<string, unknown>;
  const rawCandidates = [
    birth.region,
    birth.city,
    birth.birthPlace,
    birthAny['location'],
    birthAny['place'],
    birthAny['regionName'],
    birthAny['cityName'],
    birthAny['address'],
    birthAny['birthRegion'],
    birthAny['birthCity'],
    birthAny['birthLocation'],
    birth.name,
  ];

  return rawCandidates
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function findRegionCoordinateFromText(text: string): RegionCoordinate | null {
  const normalized = normalizeRegionToken(text);
  if (!normalized) return null;

  for (const entry of REGION_ALIAS_ENTRIES) {
    if (normalized === entry.alias || normalized.includes(entry.alias)) {
      return entry.region;
    }
  }
  return null;
}

function resolveBirthCoordinates(birth: BirthInfo): ResolvedBirthCoordinates {
  const explicitLatitude = toFiniteNumber(birth.latitude);
  const explicitLongitude = toFiniteNumber(birth.longitude);
  const explicitTimezone = typeof birth.timezone === 'string' && birth.timezone.trim()
    ? birth.timezone.trim()
    : null;

  if (explicitLatitude != null && explicitLongitude != null) {
    return {
      latitude: explicitLatitude,
      longitude: explicitLongitude,
      timezone: explicitTimezone ?? DEFAULT_TIMEZONE,
      regionCode: null,
      source: 'explicit',
    };
  }

  const region = pickBirthRegionCandidates(birth)
    .map((candidate) => findRegionCoordinateFromText(candidate))
    .find((matched): matched is RegionCoordinate => Boolean(matched))
    ?? null;

  const base = region ?? DEFAULT_REGION_COORDINATE;
  return {
    latitude: explicitLatitude ?? base.latitude,
    longitude: explicitLongitude ?? base.longitude,
    timezone: explicitTimezone ?? base.timezone ?? DEFAULT_TIMEZONE,
    regionCode: region?.code ?? base.code,
    source: region ? 'region' : 'default',
  };
}

function normalizeCodeToken(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (/^[A-Z_]+$/.test(upper)) return resolveCodeAlias(upper);

  const bracketMatch = upper.match(/\(([A-Z_]+)\)\s*$/);
  if (bracketMatch) return resolveCodeAlias(bracketMatch[1] ?? '');

  return '';
}

function formatCodeDisplay(koreanLabel: string | null, code: string): string {
  if (koreanLabel) return koreanLabel;
  return code;
}

function hasKoreanBatchimInText(value: string): boolean | null {
  for (let i = value.length - 1; i >= 0; i -= 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;
  }
  return null;
}

function applyKoreanParticlePlaceholder(
  value: string,
  pattern: RegExp,
  withBatchim: string,
  withoutBatchim: string,
): string {
  return value.replace(pattern, (_match, prefix: string) => {
    const hasBatchim = hasKoreanBatchimInText(prefix);
    return `${prefix}${hasBatchim === false ? withoutBatchim : withBatchim}`;
  });
}

function cleanAdapterText(value: string): string {
  let out = value;
  out = applyKoreanParticlePlaceholder(out, /(\S+?)\uC774\(\uAC00\)/g, '\uC774', '\uAC00');
  out = applyKoreanParticlePlaceholder(out, /(\S+?)\uC744\(\uB97C\)/g, '\uC744', '\uB97C');
  out = applyKoreanParticlePlaceholder(out, /(\S+?)\uC740\(\uB294\)/g, '\uC740', '\uB294');
  out = applyKoreanParticlePlaceholder(out, /(\S+?)\uACFC\(\uC640\)/g, '\uACFC', '\uC640');
  out = applyKoreanParticlePlaceholder(out, /(\S+?)\uC640\(\uACFC\)/g, '\uACFC', '\uC640');
  return out;
}

function normalizeElementCode(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const codeToken = normalizeCodeToken(raw);
  if (codeToken && (ELEMENT_CODES as readonly string[]).includes(codeToken)) return codeToken;

  const upper = raw.toUpperCase();
  if ((ELEMENT_CODES as readonly string[]).includes(upper)) return upper;
  if (/\bWOOD\b/.test(upper)) return 'WOOD';
  if (/\bFIRE\b/.test(upper)) return 'FIRE';
  if (/\bEARTH\b/.test(upper)) return 'EARTH';
  if (/\bMETAL\b/.test(upper)) return 'METAL';
  if (/\bWATER\b/.test(upper)) return 'WATER';

  const compact = stripWhitespace(raw);
  if (compact.includes('목') || compact.includes('木')) return 'WOOD';
  if (compact.includes('화') || compact.includes('火')) return 'FIRE';
  if (compact.includes('토') || compact.includes('土')) return 'EARTH';
  if (compact.includes('금') || compact.includes('金')) return 'METAL';
  if (compact.includes('수') || compact.includes('水')) return 'WATER';
  return null;
}

function formatElementDisplay(value: unknown): string {
  const code = normalizeElementCode(value);
  if (!code) return String(value ?? '');
  return formatCodeDisplay(ELEMENT_KO_LABEL[code] ?? null, code);
}

function normalizePolarityCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken === 'YANG' || codeToken === 'YIN') return codeToken;

  const upper = raw.toUpperCase();
  if (upper === 'YANG' || upper === 'YIN') return upper;

  const compact = stripWhitespace(raw);
  if (compact.includes('양') || compact.includes('陽')) return 'YANG';
  if (compact.includes('음') || compact.includes('陰')) return 'YIN';
  return upper;
}

function formatPolarityDisplay(value: unknown): string {
  const code = normalizePolarityCode(value);
  if (!code) return '';
  return formatCodeDisplay(POLARITY_KO_LABEL[code] ?? null, code);
}

function normalizeStrengthLevelCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken === 'STRONG' || codeToken === 'WEAK' || codeToken === 'BALANCED') return codeToken;

  const upper = raw.toUpperCase();
  if (upper === 'STRONG' || upper === 'WEAK' || upper === 'BALANCED') return upper;

  const compact = stripWhitespace(raw);
  if (compact.includes('신강')) return 'STRONG';
  if (compact.includes('신약')) return 'WEAK';
  if (compact.includes('중화') || compact.includes('균형')) return 'BALANCED';
  return upper;
}

function formatStrengthLevelDisplay(levelCode: string, isStrong: boolean): string {
  if (!levelCode) return '';
  if (levelCode === 'BALANCED') {
    return isStrong
      ? '\uC911\uD654(\uC2E0\uAC15 \uACBD\uD5A5)'
      : '\uC911\uD654(\uC2E0\uC57D \uACBD\uD5A5)';
  }
  return formatCodeDisplay(STRENGTH_LEVEL_KO_LABEL[levelCode] ?? null, levelCode);
}

function normalizeYongshinAgreementCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken && codeToken in YONGSHIN_AGREEMENT_KO_LABEL) return codeToken;

  const upper = raw.toUpperCase();
  if (upper in YONGSHIN_AGREEMENT_KO_LABEL) return upper;

  const compact = stripWhitespace(raw);
  if (compact.includes('순위')) return 'RANKING';
  if (compact.includes('억부')) return 'EOKBU';
  if (compact.includes('조후')) return 'JOHU';
  if (compact.includes('격국')) return 'GYEOKGUK';
  return upper;
}

function formatYongshinAgreementDisplay(value: unknown): string {
  const code = normalizeYongshinAgreementCode(value);
  if (!code) return '';
  return formatCodeDisplay(YONGSHIN_AGREEMENT_KO_LABEL[code] ?? null, code);
}

function normalizeYongshinTypeCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken && (YONGSHIN_TYPE_CODES as readonly string[]).includes(codeToken)) return codeToken;

  const upper = raw.toUpperCase();
  if ((YONGSHIN_TYPE_CODES as readonly string[]).includes(upper)) return upper;

  const compact = stripWhitespace(raw);
  if (compact.includes('순위')) return 'RANKING';
  if (compact.includes('조후')) return 'JOHU';
  if (compact.includes('억부')) return 'EOKBU';
  if (compact.includes('격국')) return 'GYEOKGUK';
  if (compact.includes('통관')) return 'TONGGWAN';
  if (compact.includes('합화')) return 'HAPWHA_YONGSHIN';
  if (compact.includes('일행')) return 'ILHAENG';
  return upper;
}

function formatYongshinTypeDisplay(value: unknown): string {
  const code = normalizeYongshinTypeCode(value);
  if (!code) return '';
  return formatCodeDisplay(YONGSHIN_TYPE_KO_LABEL[code] ?? null, code);
}

function normalizeTenGodCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken && (TEN_GOD_CODES as readonly string[]).includes(codeToken)) return codeToken;

  const upper = raw.toUpperCase();
  if ((TEN_GOD_CODES as readonly string[]).includes(upper)) return upper;

  const compact = stripWhitespace(raw);
  for (const [code, label] of Object.entries(TEN_GOD_KO_LABEL)) {
    if (compact.includes(label)) return code;
  }
  return upper;
}

function formatTenGodDisplay(value: unknown): string {
  const code = normalizeTenGodCode(value);
  if (!code) return String(value ?? '');
  return formatCodeDisplay(TEN_GOD_KO_LABEL[code] ?? null, code);
}

function normalizeGyeokgukCategoryCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken && (GYEOKGUK_CATEGORY_CODES as readonly string[]).includes(codeToken)) return codeToken;

  const upper = raw.toUpperCase();
  if ((GYEOKGUK_CATEGORY_CODES as readonly string[]).includes(upper)) return upper;

  const compact = stripWhitespace(raw);
  if (compact.includes('종격')) return 'JONGGYEOK';
  if (compact.includes('일반')) return 'NORMAL';
  return upper;
}

function formatGyeokgukCategoryDisplay(value: unknown): string {
  const code = normalizeGyeokgukCategoryCode(value);
  if (!code) return '';
  return formatCodeDisplay(GYEOKGUK_CATEGORY_KO_LABEL[code] ?? null, code);
}

function normalizeGyeokgukTypeCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken) return codeToken;

  const upper = raw.toUpperCase();
  if (/^[A-Z_]+$/.test(upper)) return upper;

  const compact = stripWhitespace(raw);
  for (const [code, label] of Object.entries(GYEOKGUK_KO_LABEL)) {
    if (compact.includes(label)) return code;
  }
  return upper;
}

function formatGyeokgukTypeDisplay(value: unknown): string {
  const code = normalizeGyeokgukTypeCode(value);
  if (!code) return String(value ?? '');
  return formatCodeDisplay(GYEOKGUK_KO_LABEL[code] ?? null, code);
}

function formatStemDisplay(value: unknown): string {
  const code = String(value ?? '').trim().toUpperCase();
  const label = CHEONGAN[code]?.hangul ?? null;
  return formatCodeDisplay(label, code);
}

function formatBranchDisplay(value: unknown): string {
  const code = String(value ?? '').trim().toUpperCase();
  const label = JIJI[code]?.hangul ?? null;
  return formatCodeDisplay(label, code);
}

function normalizeRelationTypeCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const codeToken = normalizeCodeToken(raw);
  if (codeToken) return codeToken;
  return raw.toUpperCase();
}

function formatRelationTypeDisplay(value: unknown): string {
  const code = normalizeRelationTypeCode(value);
  if (!code) return '';
  return formatCodeDisplay(RELATION_TYPE_KO_LABEL[code] ?? null, code);
}

function normalizeShinsalTypeCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const codeToken = normalizeCodeToken(raw);
  if (codeToken) {
    const compact = codeToken.replace(/[^A-Z]/g, '');
    return SHINSAL_TYPE_COMPACT_TO_CODE[compact] ?? codeToken;
  }
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  const compact = upper.replace(/[^A-Z]/g, '');
  return SHINSAL_TYPE_COMPACT_TO_CODE[compact] ?? upper;
}

function formatShinsalTypeDisplay(value: unknown): string {
  const code = normalizeShinsalTypeCode(value);
  if (!code) return '';
  return formatCodeDisplay(SHINSAL_TYPE_KO_LABEL[code] ?? null, code);
}

function normalizeShinsalPositionCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const codeToken = normalizeCodeToken(raw);
  if (codeToken) return codeToken;

  const upper = raw.toUpperCase();
  if (upper in SHINSAL_POSITION_KO_LABEL) return upper;

  const compact = stripWhitespace(raw);
  if (compact.includes('년주')) return 'YEAR';
  if (compact.includes('월주')) return 'MONTH';
  if (compact.includes('일주')) return 'DAY';
  if (compact.includes('시주')) return 'HOUR';
  if (compact.includes('기타')) return 'OTHER';
  return upper;
}

function formatShinsalPositionDisplay(value: unknown): string {
  const code = normalizeShinsalPositionCode(value);
  if (!code) return '';
  return formatCodeDisplay(SHINSAL_POSITION_KO_LABEL[code] ?? null, code);
}

function normalizeElementCodeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const dedup = new Set<string>();
  for (const item of value) {
    const code = normalizeElementCode(item);
    if (code) dedup.add(code);
  }
  return [...dedup];
}

function confidenceToPoints(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const normalized = Math.max(0, Math.min(1, n <= 1 ? n : n / 100));
  return Math.round(normalized * 100);
}

function confidenceToRatio(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const normalized = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, normalized));
}

function classifyDeficientAndExcessive(distribution: Record<string, number>): {
  deficientElements: string[];
  excessiveElements: string[];
} {
  const total = ELEMENT_CODES.reduce((sum, code) => sum + Number(distribution[code] ?? 0), 0);
  if (total <= 0) return { deficientElements: [], excessiveElements: [] };

  const average = total / ELEMENT_CODES.length;
  const deficientElements: string[] = [];
  const excessiveElements: string[] = [];

  for (const elementCode of ELEMENT_CODES) {
    const count = Number(distribution[elementCode] ?? 0);
    if (count === 0 || count <= average * DEFICIENT_AVERAGE_RATIO) deficientElements.push(elementCode);
    else if (count >= average * EXCESSIVE_AVERAGE_RATIO) excessiveElements.push(elementCode);
  }

  return { deficientElements, excessiveElements };
}

// ---------------------------------------------------------------------------
//  Saju module loading (lazy, singleton)
// ---------------------------------------------------------------------------

let sajuModule: SajuModule | null = null;
let sajuModulePromise: Promise<SajuModule | null> | null = null;

async function importSajuModule(): Promise<SajuModule | null> {
  if (sajuModule) return sajuModule;

  // Two-stage import — order matters:
  //
  //   Stage 1 — Vite alias as a literal specifier so Vite's build-time
  //             resolver applies `@saju → lib/saju-ts/src`. The literal MUST
  //             be inline (`import('@saju/index')`); a variable would defeat
  //             Vite's static analysis and the alias would not be applied.
  //   Stage 2 — Node ESM fallback. `@vite-ignore` + variable indirection
  //             instructs Vite to skip the path at build time (so the unbuilt
  //             `../../saju-ts/dist` is not chunked into the SPA bundle).

  // Stage 1
  try {
    // @ts-expect-error — bare specifier resolved by Vite alias at build time;
    //                    invisible to tsc, and unresolvable in Node ESM
    //                    (catch handles the latter).
    const candidate: unknown = await import('@saju/index');
    assertSajuModuleContract(candidate);
    sajuModule = candidate;
    return sajuModule;
  } catch (error) {
    if (error instanceof SajuBridgeContractMismatchError) throw error;
    // Vite alias unavailable (e.g., Node CLI / tsx / vitest) — try Stage 2.
  }

  // Stage 2
  try {
    const nodeFallback = '../../saju-ts/dist/index.js';
    const candidate: unknown = await import(/* @vite-ignore */ nodeFallback);
    assertSajuModuleContract(candidate);
    sajuModule = candidate;
    return sajuModule;
  } catch (err) {
    if (err instanceof SajuBridgeContractMismatchError) throw err;
    console.warn(
      '[spring-ts] failed to load saju-ts module; saju analysis will be disabled. ' +
      'Tried Vite alias "@saju/index" and Node ESM "../../saju-ts/dist/index.js". ' +
      'Run "npm run build" in lib/saju-ts to produce dist/.',
      err,
    );
    return null;
  }
}

async function loadSajuModule(): Promise<SajuModule | null> {
  if (sajuModule) return sajuModule;
  if (sajuModulePromise) return sajuModulePromise;

  let trackedPromise: Promise<SajuModule | null>;
  trackedPromise = importSajuModule().finally(() => {
    // A failed load remains retryable, while concurrent callers share the
    // exact same attempt. Identity guarding prevents an older attempt from
    // clearing a newer retry.
    if (sajuModulePromise === trackedPromise) sajuModulePromise = null;
  });
  sajuModulePromise = trackedPromise;
  return trackedPromise;
}

// ---------------------------------------------------------------------------
//  Small utility helpers
// ---------------------------------------------------------------------------

/** Guarantees an array; returns `value` if already an array, otherwise wraps it. */
function ensureArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

/** Converts any value to a string, or `null` if the value is nullish. */
function toNullableString(value: any): string | null {
  return value != null ? cleanAdapterText(String(value)) : null;
}

/** Picks numeric fields from an object by key, defaulting to 0. */
function extractNumericFields(source: any, keys: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of keys) result[key] = Number(source?.[key]) || 0;
  return result;
}

function extractNumericRecord(source: any): Record<string, number> | undefined {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const n = Number(value);
    if (Number.isFinite(n)) result[key] = n;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Deep-serializes runtime Maps and Sets into plain JSON-safe objects/arrays.
 * This is needed because the saju-ts engine may return Map/Set instances.
 */
function deepSerialize(value: unknown): unknown {
  if (typeof value === 'string') return cleanAdapterText(value);
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

function normalizeSerializedGyeokgukResult(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = { ...(value as Record<string, unknown>) };
  for (const key of ['candidates', 'jonggyeokCandidates'] as const) {
    const rows = out[key];
    if (!Array.isArray(rows)) continue;
    out[key] = rows.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
      const item = { ...(row as Record<string, unknown>) };
      item.sourceTier = extractSourceTier(item.sourceTier);
      return item;
    });
  }
  return out;
}

/** Converts a value (Set, Array, or falsy) into a plain string[]. */
function toStringArray(value: any): string[] {
  if (!value) return [];
  if (value instanceof Set) return [...value].map((entry) => cleanAdapterText(String(entry)));
  if (Array.isArray(value)) return value.map((entry) => cleanAdapterText(String(entry)));
  return [];
}

type PolicyToggle = 'on' | 'off';

function resolvePolicyToggle(value: unknown, fallback: PolicyToggle): PolicyToggle {
  if (value === 'on' || value === 'off') return value;
  return fallback;
}

function toLegacySajuTimePolicyConfig(
  options: SpringRequest['options'] | undefined,
  longitudeForLmtNeutralization: number,
): Record<string, unknown> {
  const policy = options?.sajuTimePolicy;

  // Product defaults (감사 결정① 2026-07-08):
  // - true solar time: off
  // - longitude correction: on
  // - day boundary: 정자시설 — yaza 기본 'on' + 23:00 모드(엔진 ziSplit23).
  //   경도 보정과 결합하면 서울 기준 시계 약 23:32에 일주·자시가 개시된다.
  //   자정설(구 기본)은 sajuTimePolicy.yaza='off'로 복귀 가능.
  const trueSolarTimeToggle = resolvePolicyToggle(policy?.trueSolarTime, 'off');
  const longitudeCorrectionToggle = resolvePolicyToggle(policy?.longitudeCorrection, 'on');
  const yazaToggle = resolvePolicyToggle(policy?.yaza, 'on');

  const patch: Record<string, unknown> = {};

  // In legacy bridge, both longitude correction and equation-of-time are behind
  // `trueSolarTimeEnabled`. Keep the two product toggles independent by:
  // - enabling trueSolar pipeline if either toggle is on
  // - enabling equation-of-time only when trueSolarTime toggle is on
  // - neutralizing longitude shift when longitude toggle is off
  const shouldEnableTrueSolarPipeline = trueSolarTimeToggle === 'on' || longitudeCorrectionToggle === 'on';
  patch.trueSolarTimeEnabled = shouldEnableTrueSolarPipeline;
  patch.includeEquationOfTime = trueSolarTimeToggle === 'on';
  patch.longitudeCorrectionEnabled = true;
  if (longitudeCorrectionToggle === 'off') {
    // Neutralize longitude correction by aligning baseline to raw longitude.
    // In legacy bridge this yields effectiveLongitude == standardMeridian.
    patch.lmtBaselineLongitude = longitudeForLmtNeutralization;
  }

  patch.yazaEnabled = yazaToggle === 'on';
  if (yazaToggle === 'on') {
    // 23:30 모드는 경도 보정 off 유파용 레거시 옵션 — 경도 보정과 중첩하면
    // 이중 보정(-62분)이 된다 (감사 A11).
    const legacyMode =
      policy?.yazaMode === '23:30' ? 'YAZA_23_30_TO_01_30_NEXTDAY' : 'YAZA_23_TO_01_NEXTDAY';
    patch.yazaMode = legacyMode;
    // dayCutMode를 반드시 명시: resolveDayCutMode(springLegacy)가 dayCutMode를
    // yazaMode보다 먼저 평가하므로, preset(KOREAN_MAINSTREAM)의 dayCutMode가
    // 남아 있으면 여기서 고른 모드에 그림자를 드리운다.
    patch.dayCutMode = legacyMode;
  } else {
    patch.dayCutMode = 'MIDNIGHT_00'; // 자정설 옵션 (yaza:'off')
  }

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

function hasProvidedValue(value: unknown): boolean {
  return value != null && value !== '';
}

function isGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidGregorianDate(year: number, month: number, day: number): boolean {
  const daysInMonth = [
    31,
    isGregorianLeapYear(year) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function hasInvalidSolarDateInput(birth: BirthInfo, parts: KnownBirthParts): boolean {
  const providedDateValues = [birth.year, birth.month, birth.day];
  const resolvedDateValues = [parts.year, parts.month, parts.day];
  if (providedDateValues.some((value, index) =>
    hasProvidedValue(value) && resolvedDateValues[index] == null)) {
    return true;
  }
  return canRunFullSaju(parts)
    && !isValidGregorianDate(parts.year!, parts.month!, parts.day!);
}

function hasInvalidTimeInput(birth: BirthInfo, parts: KnownBirthParts): boolean {
  const fields: ReadonlyArray<readonly [unknown, number | null]> = [
    [birth.hour, parts.hour],
    [birth.minute, parts.minute],
  ];
  return fields.some(([raw, resolved]) => raw != null && (
    typeof raw !== 'number'
    || !Number.isFinite(raw)
    || !Number.isInteger(raw)
    || resolved == null
  ));
}

function seasonHintFromMonth(month: number): string {
  if (month >= 3 && month <= 5) return '봄 기운(목 기운 경향)';
  if (month >= 6 && month <= 8) return '여름 기운(화 기운 경향)';
  if (month >= 9 && month <= 11) return '가을 기운(금 기운 경향)';
  return '겨울 기운(수 기운 경향)';
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
  const summary = emptySaju('BIRTH_INPUT_INSUFFICIENT') as SajuSummary & Record<string, unknown>;
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
      `출생 연도 기준으로 연주를 추정했습니다: ${stemInfo?.hangul ?? stemCode}${branchInfo?.hangul ?? branchCode}.`,
    );
  }

  if (parts.month != null) {
    interpretation.push(`출생 월 정보로 계절 경향을 반영했습니다: ${seasonHintFromMonth(parts.month)}.`);
  }

  if (parts.day != null) {
    interpretation.push('출생 일 정보는 확인했지만 일주/용신 분석에는 연·월 정보가 함께 필요합니다.');
  }

  if (parts.hour != null) {
    const branchCode = hourBranchCode(parts.hour);
    const branchInfo = JIJI[branchCode];
    interpretation.push(`출생 시 정보로 시지 경향을 반영했습니다: ${branchInfo?.hangul ?? branchCode} 구간.`);
  }

  if (parts.minute != null) {
    interpretation.push('출생 분 정보가 있어 시간 추정 범위를 좁혀 해석했습니다.');
  }

  if (birth.gender === 'neutral') {
    interpretation.push('중성 선택으로 성별 보정 해석은 중립 기준으로 처리했습니다.');
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

/**
 * 감사 B1: 음력 입력을 변환할 수 없을 때의 비활성 요약.
 * 정상 음력 입력은 내장 테이블(KASI/KARI 표준, 제품 보장 1900-01-01~2050-11-18 음력)로 변환되어
 * 분석된다 — 이 경로는 부분 입력·범위 밖·존재하지 않는 날짜 전용이다.
 */
function buildUnsupportedLunarSajuSummary(
  birth: BirthInfo,
  parts: KnownBirthParts,
  cause: 'partial-lunar-input' | 'ambiguous-leap-month' | 'conversion-failed',
): SajuSummary {
  const summary = emptySaju(
    cause === 'partial-lunar-input' ? 'LUNAR_INPUT_INSUFFICIENT' : 'LUNAR_CONVERSION_UNAVAILABLE',
  ) as SajuSummary & Record<string, unknown>;
  const mutableSummary = summary as Record<string, any>;

  mutableSummary.partialInterpretation = [
    cause === 'partial-lunar-input'
      ? '음력 생년월일은 연·월·일이 모두 있어야 양력으로 변환해 사주를 세울 수 있습니다.'
      : cause === 'ambiguous-leap-month'
        ? '입력한 음력 달에는 평달과 윤달이 모두 있습니다. 윤달 여부를 반드시 선택해 주세요.'
        : '입력한 음력 날짜를 양력으로 변환하지 못했습니다. 지원 범위(1900년~2050년 음력 11월 18일)와 윤달 여부를 확인해 주세요.',
  ];
  mutableSummary.partialBirthInput = {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    calendarType: birth.calendarType ?? 'lunar',
    isLeapMonth: birth.isLeapMonth ?? null,
  };
  mutableSummary.disabledReason = 'lunar-conversion-unavailable';
  mutableSummary.calendarPolicy = {
    inputCalendar: 'lunar',
    conversionRequired: 'builtin korean-lunar-calendar(1900~2050-11-18 lunar) | KASI LrsrCldInfoService(opt-in)',
    conversionStatus: cause,
    leapMonth: birth.isLeapMonth ?? null,
  };

  return summary;
}

/** 제품 보장 범위 (결정③ — 내장 테이블 자체는 1000~2050이나 오라클 검증 범위로 한정). */
const PRODUCT_LUNAR_MIN_YEAR = 1900;
const PRODUCT_LUNAR_MAX_YEAR = 2050;

/**
 * 감사 B1: 음력 생년월일을 양력으로 변환한다.
 * - 기본: 내장 테이블(korean-lunar-calendar.ts — KASI/KARI 표준).
 * - precisionConfig.lunarConversionSource==='kasi' 옵트인 시 KASI API를 먼저 시도하고
 *   실패하면 내장 테이블로 폴백(kasiFallback 표기) — 결정③: 외부 호출은 옵션.
 */
async function resolveLunarConversion(
  lunar: { year: number; month: number; day: number; isLeapMonth: boolean },
  options?: SpringRequest['options'],
): Promise<LunarConversionSummary | null> {
  if (lunar.year < PRODUCT_LUNAR_MIN_YEAR || lunar.year > PRODUCT_LUNAR_MAX_YEAR) return null;

  const wantKasi = (options?.precisionConfig as any)?.lunarConversionSource === 'kasi';
  if (wantKasi) {
    const viaKasi = await kasiLunarToSolar(lunar);
    if (viaKasi) return { lunar, solar: viaKasi, source: 'kasi' };
  }

  const viaBuiltin = lunarToSolar(lunar);
  if (!viaBuiltin) return null;
  return { lunar, solar: viaBuiltin, source: 'builtin', ...(wantKasi ? { kasiFallback: true } : {}) };
}

// ---------------------------------------------------------------------------
//  Public: empty SajuSummary (fallback when analysis fails)
// ---------------------------------------------------------------------------

const SAJU_ANALYSIS_FAILURES: Readonly<Record<
  SajuAnalysisReasonCode,
  { readonly status: SajuAnalysisStatus; readonly message: string }
>> = {
  SAJU_MODULE_UNAVAILABLE: {
    status: 'unavailable',
    message: '사주 분석 모듈을 현재 사용할 수 없습니다.',
  },
  BIRTH_INPUT_INSUFFICIENT: {
    status: 'partial',
    message: '사주 분석에 필요한 출생 정보가 부족합니다.',
  },
  BIRTH_DATE_INVALID: {
    status: 'failed',
    message: '존재하지 않거나 올바르지 않은 양력 생년월일입니다.',
  },
  BIRTH_TIME_INVALID: {
    status: 'failed',
    message: '출생 시각은 0~23시와 0~59분의 정수로 입력해야 합니다.',
  },
  LUNAR_INPUT_INSUFFICIENT: {
    status: 'partial',
    message: '음력 사주 분석에는 출생 연·월·일이 모두 필요합니다.',
  },
  LUNAR_CONVERSION_UNAVAILABLE: {
    status: 'unavailable',
    message: '입력한 음력 날짜를 지원 범위에서 변환할 수 없습니다.',
  },
  NEUTRAL_GENDER_ANALYSIS_PARTIAL: {
    status: 'partial',
    message: '중성 기준 비교에서 남성·여성 계산 중 하나만 완료되었습니다.',
  },
  NEUTRAL_GENDER_NATAL_MISMATCH: {
    status: 'failed',
    message: '중성 기준의 두 원국 계산이 일치하지 않아 결과를 사용할 수 없습니다.',
  },
  NEUTRAL_GENDER_ANALYSIS_FAILED: {
    status: 'failed',
    message: '중성 기준의 남녀 사주 분석을 모두 완료하지 못했습니다.',
  },
  SAJU_INVALID_SCHOOL_PRESET_SELECTOR: {
    status: 'failed',
    message: '사주 학파 프리셋 선택 형식이 올바르지 않습니다.',
  },
  SAJU_UNKNOWN_SCHOOL_PRESET: {
    status: 'failed',
    message: '선택한 사주 학파 프리셋을 사용할 수 없습니다.',
  },
  SAJU_BRIDGE_CONTRACT_MISMATCH: {
    status: 'failed',
    message: '사주 분석 엔진의 데이터 계약이 현재 서비스와 일치하지 않습니다.',
  },
  SAJU_CALCULATION_FAILED: {
    status: 'failed',
    message: '사주 계산을 완료하지 못했습니다.',
  },
};

export function emptySaju(reasonCode?: SajuAnalysisReasonCode): SajuSummary {
  const emptyPillar: PillarSummary = {
    stem:   { code: '', hangul: '', hanja: '' },
    branch: { code: '', hangul: '', hanja: '' },
  };
  const baseSummary: SajuSummary = {
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
      element: '', heeshin: null, gishin: null, gushin: null,
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

  if (!reasonCode) return baseSummary;
  const failure = SAJU_ANALYSIS_FAILURES[reasonCode];
  return {
    ...baseSummary,
    analysisStatus: failure.status,
    diagnostics: [{ reasonCode, message: failure.message }],
  };
}

type NeutralGenderCode = 'MALE' | 'FEMALE';

export interface NeutralGenderAnalysisResolution {
  readonly summary: SajuSummary;
  readonly basis: NeutralGenderCode | null;
  readonly maleConfidence: number | null;
  readonly femaleConfidence: number | null;
  readonly completedGenders: readonly NeutralGenderCode[];
  readonly interpretationNote: string | null;
}

function withoutGenderDependentFortune(summary: SajuSummary): SajuSummary {
  const saeunPillars = summary.saeunPillars?.map(({ relationsWithDecade: _ignored, ...pillar }) => pillar);
  return {
    ...summary,
    daeunInfo: null,
    ...(saeunPillars ? { saeunPillars } : {}),
  };
}

function hasSameGenderIndependentAnalysis(
  maleSummary: SajuSummary,
  femaleSummary: SajuSummary,
): boolean {
  return JSON.stringify(withoutGenderDependentFortune(maleSummary))
    === JSON.stringify(withoutGenderDependentFortune(femaleSummary));
}

function withAnalysisDiagnostic(
  summary: SajuSummary,
  reasonCode: SajuAnalysisReasonCode,
): SajuSummary {
  const failure = SAJU_ANALYSIS_FAILURES[reasonCode];
  return {
    ...summary,
    analysisStatus: failure.status,
    diagnostics: [
      ...(summary.diagnostics ?? []),
      { reasonCode, message: failure.message },
    ],
  };
}

/**
 * Compare the two gender-dependent fortune directions used for a neutral
 * request. The callback boundary is intentionally small so the one-sided
 * failure path can be regression-tested without fabricating engine output.
 */
export function resolveNeutralGenderAnalysis(
  analyzeWithGender: (genderCode: NeutralGenderCode) => SajuSummary,
): NeutralGenderAnalysisResolution {
  let maleSummary: SajuSummary | null = null;
  let femaleSummary: SajuSummary | null = null;
  let maleError: unknown = null;
  let femaleError: unknown = null;

  try {
    maleSummary = analyzeWithGender('MALE');
  } catch (error) {
    if (isGlobalSajuFailure(error)) throw error;
    maleError = error;
    maleSummary = null;
  }
  try {
    femaleSummary = analyzeWithGender('FEMALE');
  } catch (error) {
    if (isGlobalSajuFailure(error)) throw error;
    femaleError = error;
    femaleSummary = null;
  }

  if (!maleSummary && !femaleSummary) {
    // Configuration, input and module failures are gender-independent. When
    // both paths fail for the same structured reason, preserve that root cause
    // for the outer adapter boundary instead of mislabelling it as a neutral
    // comparison failure.
    if (
      maleError != null
      && femaleError != null
      && failureReasonCode(maleError) === failureReasonCode(femaleError)
    ) {
      throw maleError;
    }
    return {
      summary: emptySaju('NEUTRAL_GENDER_ANALYSIS_FAILED'),
      basis: null,
      maleConfidence: null,
      femaleConfidence: null,
      completedGenders: [],
      interpretationNote: null,
    };
  }

  const maleConfidence = maleSummary?.yongshin?.confidence ?? null;
  const femaleConfidence = femaleSummary?.yongshin?.confidence ?? null;
  const completedGender: NeutralGenderCode =
    maleSummary && !femaleSummary
      ? 'MALE'
      : 'FEMALE';
  const completedSummary = completedGender === 'FEMALE' ? femaleSummary! : maleSummary!;
  const completedGenders: NeutralGenderCode[] = [
    ...(maleSummary ? ['MALE' as const] : []),
    ...(femaleSummary ? ['FEMALE' as const] : []),
  ];
  const maleConfidenceText = maleConfidence != null ? maleConfidence.toFixed(2) : '-';
  const femaleConfidenceText = femaleConfidence != null ? femaleConfidence.toFixed(2) : '-';

  if (maleSummary && femaleSummary) {
    if (!hasSameGenderIndependentAnalysis(maleSummary, femaleSummary)) {
      return {
        summary: emptySaju('NEUTRAL_GENDER_NATAL_MISMATCH'),
        basis: null,
        maleConfidence,
        femaleConfidence,
        completedGenders,
        interpretationNote: null,
      };
    }

    return {
      summary: withoutGenderDependentFortune(maleSummary),
      basis: null,
      maleConfidence,
      femaleConfidence,
      completedGenders,
      interpretationNote:
        '중성 선택으로 성별과 무관한 원국·세운·월운만 사용했습니다. 성별에 따라 순행·역행이 달라지는 대운과 세운-대운 관계는 임의로 선택하지 않았습니다.',
    };
  }

  const completedLabel = completedGender === 'MALE' ? '남성' : '여성';
  const failedLabel = completedGender === 'MALE' ? '여성' : '남성';
  return {
    summary: withAnalysisDiagnostic(
      withoutGenderDependentFortune(completedSummary),
      'NEUTRAL_GENDER_ANALYSIS_PARTIAL',
    ),
    basis: null,
    maleConfidence,
    femaleConfidence,
    completedGenders,
    interpretationNote:
      `중성 선택에서 ${completedLabel} 기준 계산만 완료되어 해당 결과를 사용했습니다. ${failedLabel} 기준 계산은 완료되지 않았습니다. (남성 ${maleConfidenceText}, 여성 ${femaleConfidenceText})`,
  };
}

function isGlobalSajuFailure(error: unknown): boolean {
  if (error instanceof SajuRequestValidationError || error instanceof SajuBridgeContractMismatchError) {
    return true;
  }
  const code = error && typeof error === 'object'
    ? (error as { code?: unknown }).code
    : undefined;
  return code === 'SAJU_INVALID_SCHOOL_PRESET_SELECTOR'
    || code === 'SAJU_UNKNOWN_SCHOOL_PRESET'
    || code === 'SAJU_BRIDGE_CONTRACT_MISMATCH';
}

function failureReasonCode(error: unknown): SajuAnalysisReasonCode {
  const code =
    error && typeof error === 'object'
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'SAJU_INVALID_SCHOOL_PRESET_SELECTOR') {
    return 'SAJU_INVALID_SCHOOL_PRESET_SELECTOR';
  }
  if (code === 'SAJU_UNKNOWN_SCHOOL_PRESET') {
    return 'SAJU_UNKNOWN_SCHOOL_PRESET';
  }
  if (code === 'SAJU_BRIDGE_CONTRACT_MISMATCH') {
    return 'SAJU_BRIDGE_CONTRACT_MISMATCH';
  }
  return 'SAJU_CALCULATION_FAILED';
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
  let saju: SajuModule | null;
  try {
    saju = await loadSajuModule();
  } catch (error) {
    return emptySaju(failureReasonCode(error));
  }
  if (!saju) return emptySaju('SAJU_MODULE_UNAVAILABLE');

  const parts = resolveKnownBirthParts(birth);
  if (!hasAnyKnownBirthPart(parts)) {
    return emptySaju('BIRTH_INPUT_INSUFFICIENT');
  }
  if (hasInvalidTimeInput(birth, parts)) {
    return emptySaju('BIRTH_TIME_INVALID');
  }
  if (birth.calendarType !== 'lunar' && hasInvalidSolarDateInput(birth, parts)) {
    return emptySaju('BIRTH_DATE_INVALID');
  }

  // 감사 B1: 음력 입력은 내장 테이블(기본) 또는 KASI API(옵트인)로 양력 변환 후 분석.
  // analyzeWithGender 클로저가 아래 birthYear/Month/Day를 캡처하므로 변환은 반드시 이 지점.
  let effectiveParts = parts;
  let lunarConversion: LunarConversionSummary | null = null;
  if (birth.calendarType === 'lunar') {
    if (parts.year == null || parts.month == null || parts.day == null) {
      // 음력은 연·월·일 전부 있어야 변환 가능 — 부분 입력은 비활성 경로 유지.
      return buildUnsupportedLunarSajuSummary(birth, parts, 'partial-lunar-input');
    }
    const leapMonth = leapMonthOfLunarYear(parts.year);
    if (birth.isLeapMonth === undefined && leapMonth === parts.month) {
      // 같은 월 번호의 평달·윤달이 모두 존재한다. 누락을 false로 추정하면
      // 서로 다른 양력 날짜와 사주를 조용히 만들므로 반드시 호출자에게 되묻는다.
      return buildUnsupportedLunarSajuSummary(birth, parts, 'ambiguous-leap-month');
    }
    lunarConversion = await resolveLunarConversion(
      { year: parts.year, month: parts.month, day: parts.day, isLeapMonth: birth.isLeapMonth === true },
      options,
    );
    if (!lunarConversion) {
      // 제품 보장 범위(1900-01-01~2050-11-18 음력) 밖 또는 존재하지 않는 음력 날짜(없는 윤달 등).
      return buildUnsupportedLunarSajuSummary(birth, parts, 'conversion-failed');
    }
    effectiveParts = {
      ...parts,
      year: lunarConversion.solar.year,
      month: lunarConversion.solar.month,
      day: lunarConversion.solar.day,
    };
  }

  if (!canRunFullSaju(effectiveParts)) {
    return buildPartialSajuSummary(birth, effectiveParts);
  }

  const birthYear = effectiveParts.year;
  const birthMonth = effectiveParts.month;
  const birthDay = effectiveParts.day;
  if (birthYear == null || birthMonth == null || birthDay == null) {
    return buildPartialSajuSummary(birth, effectiveParts);
  }
  validateSajuRequestOptions(options?.sajuOptions, birthYear);
  validateSajuConfigFortuneHorizon(options?.sajuConfig);
  const resolvedCoordinates = resolveBirthCoordinates(birth);

  try {
    // Always seed legacy config from a preset first.
    // Some saju-ts versions throw when only partial policy patch is provided.
    const presetKey = options?.schoolPreset ?? 'korean';
    const presetCode = PRESET_MAP[presetKey] ?? PRESET_MAP.korean ?? 'KOREAN_MAINSTREAM';
    let config: RuntimeLegacySajuConfig = { ...(saju.configFromPreset(presetCode) ?? {}) };
    const timePolicyConfig = toLegacySajuTimePolicyConfig(options, resolvedCoordinates.longitude);
    if (Object.keys(timePolicyConfig).length) config = { ...config, ...timePolicyConfig };
    // PR-H-S2 — request Newton root-finder for solar-term boundary lookup.
    // saju-ts (api/types.ts:79-89) documents that 'newton' has the same target
    // tolerance as 'bisection' so the resulting instant agrees to the chosen
    // tolerance — i.e., output-identical. Newton is ~5 iterations (vs ~20 for
    // bisection); we adopt it as default to amortise the cost of the more
    // accurate solar-term lookups that later phases will surface.
    //
    // PR-H-S3 — additionally request the IAU 1980 top-10 nutation series for
    // solar apparent longitude. saju-ts (api/types.ts:103-111) reports
    //   classical:      ±9″ residual (default in saju-ts)
    //   iau1980_top10:  ±1″ residual (9× tighter)
    //   iau1980_full:   ±0.1″ residual (90× tighter, slower)
    // We choose the middle option as the spring-ts default — it's what
    // F-A14's audit recommends as the "default-on" tier. Snapshot regression
    // empirically confirms whether the residual change shifts any fixture's
    // pillars; if so this falls under PRINCIPLES_v2.md §2.1 (controlled
    // change + DEFAULT_CHANGELOG entry).
    // PR-H-S8 — opt-in advanced precision overrides for power users who want
    // sub-second arc-second-class accuracy. Default unset → defaults from
    // PR-H-S3 ('iau1980_top10') / saju-ts ('constant') apply.
    const advancedAberration = (options?.precisionConfig as any)?.aberrationModel;
    const advancedSolarPrecision = (options?.precisionConfig as any)?.solarPrecision;
    config.calendar = {
      ...(config.calendar ?? {}),
      solarTerms: {
        ...(config.calendar?.solarTerms ?? {}),
        algorithm: 'newton',
      },
      solarPrecision: (advancedSolarPrecision === 'classical' ||
                       advancedSolarPrecision === 'iau1980_top10' ||
                       advancedSolarPrecision === 'iau1980_full')
        ? advancedSolarPrecision
        : 'iau1980_top10',
      ...(advancedAberration === 'rCorrected' || advancedAberration === 'constant'
        ? { aberrationModel: advancedAberration }
        : {}),
      // PR-H-S4 — when the caller opts into trueSolarTime, use saju-ts's
      // 'precise' Equation-of-Time model. Keep default mode longitude-only:
      // setting equationOfTime here while trueSolarTime is off would override
      // the legacy bridge's `includeEquationOfTime=false` policy.
      ...(options?.sajuTimePolicy?.trueSolarTime === 'on'
        ? {
            trueSolarTime: {
              ...(config.calendar?.trueSolarTime ?? {}),
              equationOfTime: 'precise',
            },
          }
        : {}),
    };
    // PR-H-S5 — opt-in routing of a saju-ts-side school.id when the caller
    // explicitly requests one. Default unset → preserves preset-derived
    // school selection (no behavior change for existing callers).
    const sajuSchoolId = (options?.precisionConfig as any)?.sajuSchoolId;
    if (typeof sajuSchoolId === 'string' && sajuSchoolId.length > 0) {
      config.school = { ...(config.school ?? {}), id: sajuSchoolId };
    }
    // PR-H-S6 — opt-in routing of saryeongScheme into saju-ts's
    // weights.hiddenStems policy. When unset, saju-ts uses its
    // static scheme (existing behavior).
    const saryeongScheme = (options?.precisionConfig as any)?.saryeongScheme;
    if (saryeongScheme === 'classical' || saryeongScheme === 'scaled') {
      config.weights = {
        ...(config.weights ?? {}),
        hiddenStems: {
          ...(config.weights?.hiddenStems ?? {}),
          saryeongScheme,
        },
      };
    }
    // PR-4.2 — opt-in month-gyeok selector mode. Default unset preserves the
    // existing saju-ts selector. jungki_transparent is reserved for
    // expert/internal comparative runs that intentionally use middle-qi
    // transparency.
    const gyeokgukSelectionRule = (options?.precisionConfig as any)?.gyeokgukSelectionRule;
    if (gyeokgukSelectionRule === 'monthly_main' || gyeokgukSelectionRule === 'jungki_transparent') {
      config.strategies = {
        ...(config.strategies ?? {}),
        gyeokguk: {
          ...(config.strategies?.gyeokguk ?? {}),
          selectionRule: gyeokgukSelectionRule,
        },
      };
    }
    if (options?.sajuConfig) {
      config = { ...config, ...options.sajuConfig } as RuntimeLegacySajuConfig;
    }

    const requiredMaxYears = requiredMaxYearsForRequest(options?.sajuOptions, birthYear);
    const requiredMaxMonths = requiredMaxMonthsForRequest(options?.sajuOptions, birthYear);
    if (requiredMaxYears !== null || requiredMaxMonths !== null) {
      const strategies = (config.strategies ?? {}) as Record<string, any>;
      const fortune = (strategies.fortune ?? {}) as Record<string, any>;
      const nextFortune = { ...fortune };
      if (requiredMaxYears !== null) {
        const existingMaxYears = fortune.maxYears;
        nextFortune.maxYears = typeof existingMaxYears === 'number' && Number.isFinite(existingMaxYears)
          ? Math.max(existingMaxYears, requiredMaxYears)
          : requiredMaxYears;
      }
      if (requiredMaxMonths !== null) {
        const existingMaxMonths = fortune.maxMonths;
        nextFortune.maxMonths = typeof existingMaxMonths === 'number' && Number.isFinite(existingMaxMonths)
          ? Math.max(existingMaxMonths, requiredMaxMonths)
          : requiredMaxMonths;
      }
      config.strategies = {
        ...strategies,
        fortune: nextFortune,
      };
    }

    const finalConfig = Object.keys(config).length > 0 ? config : undefined;

    const sajuOpts = options?.sajuOptions ? {
      daeunCount:      options.sajuOptions.daeunCount,
      saeunStartYear:  options.sajuOptions.saeunStartYear,
      saeunYearCount:  options.sajuOptions.saeunYearCount,
      wolunStartYear:  options.sajuOptions.wolunStartYear,
      wolunMonthCount: options.sajuOptions.wolunMonthCount,
    } : undefined;

    const analyzeWithGender = (genderCode: 'MALE' | 'FEMALE'): SajuSummary => {
      const birthInput = saju.createBirthInput({
        birthYear,
        birthMonth,
        birthDay,
        birthHour: parts.hour ?? DEFAULT_UNKNOWN_HOUR,
        birthMinute: parts.minute ?? DEFAULT_UNKNOWN_MINUTE,
        gender: genderCode,
        // 감사 B1: 음력 입력은 상단에서 양력 변환 완료 — 브리지에는 항상 SOLAR
        // (springLegacy의 LUNAR throw 가드에 도달하지 않는다).
        calendarType: 'SOLAR',
        timezone:  resolvedCoordinates.timezone,
        latitude:  resolvedCoordinates.latitude,
        longitude: resolvedCoordinates.longitude,
        name: birth.name,
      });
      return extractSaju(saju.analyzeSaju(birthInput, finalConfig, sajuOpts));
    };

    let summary: SajuSummary;
    let neutralBasis: 'MALE' | 'FEMALE' | null = null;
    let neutralInterpretationNote: string | null = null;

    if (birth.gender === 'neutral') {
      const neutral = resolveNeutralGenderAnalysis(analyzeWithGender);
      if (neutral.completedGenders.length === 0 || neutral.summary.analysisStatus === 'failed') {
        return neutral.summary;
      }
      summary = neutral.summary;
      neutralBasis = neutral.basis;
      neutralInterpretationNote = neutral.interpretationNote;
    } else {
      summary = analyzeWithGender(birth.gender === 'female' ? 'FEMALE' : 'MALE');
    }

    const notes: string[] = [];
    if (parts.hour == null || parts.minute == null) {
      notes.push(
        `출생 시/분 미상으로 ${String(DEFAULT_UNKNOWN_HOUR).padStart(2, '0')}:${String(DEFAULT_UNKNOWN_MINUTE).padStart(2, '0')} 기준 계산을 적용했습니다.`,
      );
      applyUnknownHourUncertainty(summary);
    }
    if (birth.gender === 'neutral') {
      if (neutralInterpretationNote) notes.push(neutralInterpretationNote);
      summary = {
        ...summary,
        neutralGenderBasis: neutralBasis ?? 'UNKNOWN',
        ...(!neutralBasis
          ? { genderDependentFortuneStatus: 'unavailable_neutral_gender' as const }
          : {}),
      };
    }
    // 감사 B1: 음력 변환 기록 attach + 사용자 검증 노트.
    // lunar 경로에서만 붙인다 — solar 경로에 undefined 키를 세팅하면
    // deepSerialize/스냅샷 표면에 키가 등장한다.
    if (lunarConversion) {
      summary = { ...summary, lunarConversion };
      const lc = lunarConversion;
      notes.push(
        `음력 ${lc.lunar.year}년 ${lc.lunar.isLeapMonth ? '윤' : ''}${lc.lunar.month}월 ${lc.lunar.day}일을 `
        + `양력 ${lc.solar.year}년 ${lc.solar.month}월 ${lc.solar.day}일로 변환해 분석했습니다`
        + (lc.source === 'kasi' ? ' (KASI 음양력 API 기준).' : ' (한국천문연구원 표준 음양력 테이블 기준).'),
      );
    }
    if (notes.length > 0) {
      const existing = Array.isArray(summary.partialInterpretation)
        ? summary.partialInterpretation.filter((line) => typeof line === 'string')
        : [];
      summary = { ...summary, partialInterpretation: [...existing, ...notes] };
    }
    // PR-Q-5: surface 12궁 palace analysis when precisionConfig.surfacePalace
    // is opted-in. Off by default; the field stays absent in the summary.
    const surfacePalace = (options?.precisionConfig as any)?.surfacePalace === true;
    if (surfacePalace) {
      const palace = computePalaceSummary(saju, summary.pillars);
      if (palace) summary = { ...summary, palace } as typeof summary;
    }

    // PR-Q-6: surface 60갑자 納音 when precisionConfig.surfaceNaeum is opted-in.
    const surfaceNaeum = (options?.precisionConfig as any)?.surfaceNaeum === true;
    if (surfaceNaeum) {
      const naeum = computeNaeumSummary(saju, summary.pillars);
      if (naeum) summary = { ...summary, naeum } as typeof summary;
    }

    return summary;
  } catch (error) {
    if (error instanceof SajuRequestValidationError) throw error;
    return emptySaju(failureReasonCode(error));
  }
}

// ---------------------------------------------------------------------------
//  extractSaju composed from focused extraction helpers
// ---------------------------------------------------------------------------

/**
 * Transforms the raw output from saju-ts into our clean SajuSummary shape.
 * Each piece of the summary is extracted by a dedicated helper function.
 */
export function extractSaju(rawSajuOutput: unknown): SajuSummary {
  assertLegacySajuOutputV1Contract(rawSajuOutput);
  const serializedOutput = deepSerialize(rawSajuOutput) as Record<string, unknown>;
  delete serializedOutput.bridgeSchemaVersion;
  const serializedGyeokgukResult = normalizeSerializedGyeokgukResult(serializedOutput.gyeokgukResult);
  const rawPillars       = rawSajuOutput.pillars;
  const coreResult       = rawSajuOutput.coreResult;
  const pillars = extractPillars(rawPillars);
  const dayStemCode = String(pillars.day.stem.code ?? '');
  const elementDistribution = extractElementDistribution(rawSajuOutput);

  const summary: SajuSummary = {
    ...serializedOutput,
    ...(serializedGyeokgukResult ? { gyeokgukResult: serializedGyeokgukResult } : {}),

    pillars,
    timeCorrection:       extractNumericFields(coreResult, TC_KEYS) as unknown as SajuSummary['timeCorrection'],
    jieProximity:         extractJieProximity(rawSajuOutput.jieProximity),
    dayMaster:            extractDayMaster(dayStemCode, rawSajuOutput.strengthResult),
    strength:             extractStrength(rawSajuOutput.strengthResult),
    yongshin:             extractYongshin(rawSajuOutput.yongshinResult),
    yongshinConsensus:    extractYongshinConsensus(rawSajuOutput.yongshinResult?.consensus),
    gyeokguk:             extractGyeokguk(rawSajuOutput.gyeokgukResult),
    elementDistribution:  elementDistribution.distribution,
    deficientElements:    elementDistribution.deficientElements,
    excessiveElements:    elementDistribution.excessiveElements,
    cheonganRelations:    extractCheonganRelations(rawSajuOutput),
    hapHwaEvaluations:    extractHapHwaEvaluations(rawSajuOutput),
    jijiRelations:        extractJijiRelations(rawSajuOutput),
    sibiUnseong:          extractSibiUnseong(rawSajuOutput),
    yinYangBalance:       extractYinYangBalance(rawSajuOutput),
    gongmang:             extractGongmang(rawSajuOutput),
    tenGodAnalysis:       extractTenGodAnalysis(rawSajuOutput.tenGodAnalysis, dayStemCode),
    shinsalHits:          extractShinsalHits(rawSajuOutput),
    palaceAnalysis:       extractPalaceAnalysis(rawSajuOutput),
    daeunInfo:            extractDaeunInfo(rawSajuOutput),
    saeunPillars:         extractSaeunPillars(rawSajuOutput),
    wolunPillars:         extractWolunPillars(rawSajuOutput),
    trace:                extractTrace(rawSajuOutput),
  };

  // PR9 — surface the axis strength on the SajuSummary itself so card
  // builders that receive only the summary (e.g., buildOverviewSummaryCard)
  // can apply hedge wording without re-deriving it from the raw output.
  return { ...summary, axisStrength: deriveAxisStrength(summary) };
}

/** PR-Q-5: build the SajuSummary.palace optional field by calling saju-ts's
 *  `analyzePalaces` (PR-Q-4) on the summary's four pillars. Returns undefined
 *  when day pillar is unresolvable. */
function computePalaceSummary(
  module: SajuModule,
  pillars: SajuSummary['pillars'],
): import('./types.js').PalaceSummary | undefined {
  // 캐시된 sajuModule 재사용 — 기존 require() 경로는 ESM(tsx/Vite)에서 정의되지
  // 않아 throw → analyzeSaju 외곽 catch가 전체를 emptySaju로 만들었다 (감사 A5).
  // analyzeSaju가 loadSajuModule()을 이미 await했으므로 이 시점엔 캐시가 차 있다.
  assertSajuPalaceCapability(module);
  const sajuTsCore = module;

  const day = pillars.day;
  if (!day) return undefined;
  const dayStemIdx = sajuTsCore.stemIdxFromHanja(day.stem.hanja ?? '');
  const dayBranchIdx = sajuTsCore.branchIdxFromHanja(day.branch.hanja ?? '');
  if (dayStemIdx === null || dayBranchIdx === null) return undefined;

  const palaceInput: any = { day: { stem: dayStemIdx, branch: dayBranchIdx } };
  for (const pos of ['year', 'month', 'hour'] as const) {
    const p = pillars[pos];
    if (!p) continue;
    const sIdx = sajuTsCore.stemIdxFromHanja(p.stem.hanja ?? '');
    const bIdx = sajuTsCore.branchIdxFromHanja(p.branch.hanja ?? '');
    if (sIdx === null || bIdx === null) continue;
    palaceInput[pos] = { stem: sIdx, branch: bIdx };
  }

  const report = sajuTsCore.analyzePalaces(palaceInput);
  if (!report) return undefined;

  const tenGodKo: Record<string, string> = {
    BI_GYEON: '비견', GEOB_JAE: '겁재', SIK_SHIN: '식신', SANG_GWAN: '상관',
    PYEON_JAE: '편재', JEONG_JAE: '정재', PYEON_GWAN: '편관', JEONG_GWAN: '정관',
    PYEON_IN: '편인', JEONG_IN: '정인',
  };
  const positions: any = { year: undefined, month: undefined, day: undefined, hour: undefined };
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const view = report.positions[pos];
    if (!view) continue;
    positions[pos] = {
      name: view.meta.name,
      period: view.meta.period,
      ageRange: view.meta.ageRange,
      metaphor: view.meta.metaphor,
      topic: view.meta.topic,
      mainHiddenStem: sajuTsCore.stemHanja(view.mainHiddenStem),
      mainTenGod: tenGodKo[view.mainTenGod] ?? view.mainTenGod,
      isGilshin: view.isGilshin,
      hasDayMasterRoot: view.root.hasDayMasterRoot,
      hasSupportingRoot: view.root.hasSupportingRoot,
      status: view.status,
    };
  }
  return { positions, rule: report.rule, caution: report.caution };
}

/** PR-Q-6: build the SajuSummary.naeum optional field by calling saju-ts's
 *  `analyzeNaeum` (PR-Q-6) on the summary's four pillars (using ganzhi
 *  hanja strings). Returns undefined when day pillar is unresolvable. */
function computeNaeumSummary(
  module: SajuModule,
  pillars: SajuSummary['pillars'],
): import('./types.js').NaeumSummary | undefined {
  // 캐시된 sajuModule 재사용 (감사 A5 — computePalaceSummary와 동일한 require() 붕괴 수정).
  assertSajuNaeumCapability(module);
  const sajuTsCore = module;

  const day = pillars.day;
  if (!day) return undefined;
  const naeumInput: any = {};
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = pillars[pos];
    if (!p) continue;
    const stem = p.stem.hanja ?? '';
    const branch = p.branch.hanja ?? '';
    if (!stem || !branch) continue;
    naeumInput[pos] = { ganzhi: stem + branch };
  }

  const report = sajuTsCore.analyzeNaeum(naeumInput);
  if (!report) return undefined;

  return {
    positions: report.positions,
    elementCounts: report.elementCounts,
    caution: report.caution,
  };
}

// ---------------------------------------------------------------------------
//  Pillar extraction: year / month / day / hour
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
//  Day master: the stem of the day pillar
// ---------------------------------------------------------------------------

function extractDayMaster(dayStemCode: string, strengthResult: LegacyStrengthResultContract) {
  const dayMasterInfo = CHEONGAN[dayStemCode];
  // Theory-first: day master is defined by the day stem itself.
  // Keep strengthResult as a fallback only when stem metadata is unavailable.
  const canonicalElement = normalizeElementCode(dayMasterInfo?.element) ?? '';
  const fallbackElement = normalizeElementCode(strengthResult?.dayMasterElement) ?? '';
  const polarityCode = normalizePolarityCode(dayMasterInfo?.polarity ?? '');
  return {
    stem:     formatStemDisplay(dayStemCode),
    element:  canonicalElement || fallbackElement,
    polarity: formatPolarityDisplay(polarityCode),
  };
}

// ---------------------------------------------------------------------------
//  Strength: whether the day master is strong or weak
// ---------------------------------------------------------------------------

function extractStrength(strengthResult: LegacyStrengthResultContract) {
  const isStrong = !!strengthResult?.isStrong;
  const levelCode = normalizeStrengthLevelCode(strengthResult?.level ?? '');
  return {
    level:        formatStrengthLevelDisplay(levelCode, isStrong),
    isStrong,
    totalSupport: Number(strengthResult?.score?.totalSupport) || 0,
    totalOppose:  Number(strengthResult?.score?.totalOppose)  || 0,
    deukryeong:   Number(strengthResult?.score?.deukryeong)   || 0,
    deukji:       Number(strengthResult?.score?.deukji)       || 0,
    deukse:       Number(strengthResult?.score?.deukse)       || 0,
    details:      ensureArray(strengthResult?.details).map(String),
  };
}

// ---------------------------------------------------------------------------
//  Element distribution: how many points each element has in the chart
// ---------------------------------------------------------------------------

function extractElementDistribution(rawSajuOutput: LegacySajuOutputV1Contract): {
  distribution: Record<string, number>;
  deficientElements: string[];
  excessiveElements: string[];
} {
  const distribution: Record<string, number> = {};
  const assignDistribution = (key: unknown, value: unknown) => {
    const elementCode = normalizeElementCode(key);
    if (!elementCode) return;
    distribution[elementCode] = roundTo(value, DISTRIBUTION_ROUND_DIGITS);
  };

  if (rawSajuOutput.ohaengDistribution) {
    if (rawSajuOutput.ohaengDistribution instanceof Map) {
      for (const [key, value] of rawSajuOutput.ohaengDistribution)
        assignDistribution(key, value);
    } else {
      for (const [key, value] of Object.entries(rawSajuOutput.ohaengDistribution)) {
        assignDistribution(key, value);
      }
    }
  }

  for (const code of ELEMENT_CODES) {
    if (!Number.isFinite(distribution[code])) distribution[code] = 0;
  }

  const derived = classifyDeficientAndExcessive(distribution);
  const providedDeficient = normalizeElementCodeList(rawSajuOutput?.deficientElements);
  const providedExcessive = normalizeElementCodeList(rawSajuOutput?.excessiveElements);
  const deficientElements = providedDeficient.length ? providedDeficient : derived.deficientElements;
  const excessiveElements = providedExcessive.length ? providedExcessive : derived.excessiveElements;

  return { distribution, deficientElements, excessiveElements };
}

// ---------------------------------------------------------------------------
//  Yongshin: the recommended balancing element
// ---------------------------------------------------------------------------

function extractYongshin(yongshinResult: any) {
  const element = yongshinResult?.finalYongshin;
  const heeshin = yongshinResult?.finalHeesin;
  const gishin = yongshinResult?.gisin;
  const gushin = yongshinResult?.gusin;
  const consensus = extractYongshinConsensus(yongshinResult?.consensus);
  const methodBreakdown = yongshinResult?.methodBreakdown && typeof yongshinResult.methodBreakdown === 'object'
    ? deepSerialize(yongshinResult.methodBreakdown) as Record<string, unknown>
    : undefined;
  return {
    element:    normalizeElementCode(element) ?? String(element ?? ''),
    heeshin:    normalizeElementCode(heeshin) ?? toNullableString(heeshin),
    gishin:     normalizeElementCode(gishin) ?? toNullableString(gishin),
    gushin:     normalizeElementCode(gushin) ?? toNullableString(gushin),
    confidence: confidenceToPoints(yongshinResult?.finalConfidence),
    agreement:  formatYongshinAgreementDisplay(yongshinResult?.agreement),
    consensus,
    ...(methodBreakdown ? { methodBreakdown } : {}),
    // 감사 B5 (additive): 종격 가능성 경고 + 구조화 리스크 신호 passthrough.
    warnings: ensureArray(yongshinResult?.warnings).map((w: any) => String(w)),
    jonggyeokRisk:
      yongshinResult?.jonggyeokRisk && typeof yongshinResult.jonggyeokRisk === 'object'
        ? yongshinResult.jonggyeokRisk
        : undefined,
    recommendations: ensureArray(yongshinResult?.recommendations).map(
      ({ type, primaryElement, secondaryElement, confidence, reasoning }: any) => ({
        type:             formatYongshinTypeDisplay(type),
        primaryElement:   formatElementDisplay(primaryElement),
        secondaryElement: secondaryElement == null ? null : formatElementDisplay(secondaryElement),
        confidence:       confidenceToPoints(confidence),
        reasoning:        cleanAdapterText(String(reasoning ?? '')),
      }),
    ),
  };
}

function extractYongshinConsensus(value: any): YongshinConsensusScoreboard | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const extractAxis = (axisName: string): YongshinConsensusScoreboard['eokbu'] => {
    const axis = value[axisName] && typeof value[axisName] === 'object' ? value[axisName] : {};
    const scoresRaw = axis.scores && typeof axis.scores === 'object' && !Array.isArray(axis.scores)
      ? axis.scores
      : {};
    const scores: Record<string, number> = {};
    for (const element of ELEMENT_CODES) {
      scores[element] = confidenceToRatio((scoresRaw as any)[element]);
    }
    return {
      element: normalizeElementCode(axis.element),
      score: confidenceToRatio(axis.score),
      scores,
      evidence: ensureArray(axis.evidence).map((entry) => String(entry)),
    };
  };

  const finalRaw = value.final && typeof value.final === 'object' ? value.final : {};
  const conflict = String(finalRaw.conflictLevel ?? 'none');
  const conflictLevel = (YONGSHIN_CONFLICT_LEVELS as readonly string[]).includes(conflict)
    ? conflict as YongshinConsensusScoreboard['final']['conflictLevel']
    : 'none';

  return {
    eokbu: extractAxis('eokbu'),
    johu: extractAxis('johu'),
    gyeokguk: extractAxis('gyeokguk'),
    tonggwan: extractAxis('tonggwan'),
    byeongyak: extractAxis('byeongyak'),
    siksangFlow: extractAxis('siksangFlow'),
    final: {
      element: normalizeElementCode(finalRaw.element) ?? '',
      confidence: confidenceToRatio(finalRaw.confidence),
      topMargin: Number.isFinite(Number(finalRaw.topMargin)) ? Number(finalRaw.topMargin) : 0,
      conflictLevel,
      competingElements: ensureArray(finalRaw.competingElements)
        .map((entry) => normalizeElementCode(entry))
        .filter((entry): entry is string => Boolean(entry)),
      evidence: ensureArray(finalRaw.evidence).map((entry) => String(entry)),
    },
  };
}

// ---------------------------------------------------------------------------
//  Gyeokguk: the structural pattern of the chart
// ---------------------------------------------------------------------------

function extractGyeokgukBasis(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of ['monthMainTenGod', 'monthGyeokTenGod', 'monthGyeokMethod', 'monthGyeokSelectionRule'] as const) {
    if (value[key] != null) out[key] = cleanAdapterText(String(value[key]));
  }
  if (value.monthGyeokQuality && typeof value.monthGyeokQuality === 'object') {
    out.monthGyeokQuality = deepSerialize(value.monthGyeokQuality) as Record<string, unknown>;
  }
  if (value.competition && typeof value.competition === 'object') {
    out.competition = deepSerialize(value.competition) as Record<string, unknown>;
  }
  if (value.seongpaeScoreAdjustment && typeof value.seongpaeScoreAdjustment === 'object') {
    out.seongpaeScoreAdjustment = deepSerialize(value.seongpaeScoreAdjustment) as Record<string, unknown>;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function extractGyeokguk(gyeokgukResult: any) {
  const seongpae = extractGyeokgukSeongpae(gyeokgukResult?.seongpae);
  return {
    type:          formatGyeokgukTypeDisplay(gyeokgukResult?.type),
    category:      formatGyeokgukCategoryDisplay(gyeokgukResult?.category),
    baseTenGod:    gyeokgukResult?.baseSipseong ? formatTenGodDisplay(gyeokgukResult.baseSipseong) : null,
    confidence:    Number(gyeokgukResult?.confidence) || 0,
    reasoning:     cleanAdapterText(String(gyeokgukResult?.reasoning ?? '')),
    candidates:    extractGyeokgukCandidates(gyeokgukResult?.candidates),
    jonggyeokCandidates: extractJonggyeokCandidates(gyeokgukResult?.jonggyeokCandidates),
    basis: extractGyeokgukBasis(gyeokgukResult?.basis),
    scores: extractNumericRecord(gyeokgukResult?.scores),
    // PR-6 (additive): explicitly mapped at the saju-ts -> spring-ts boundary.
    ...(seongpae
      ? { seongpae }
      : {}),
  };
}

function extractGyeokgukCandidates(value: unknown): readonly GyeokgukCandidateSummary[] | undefined {
  const candidates = ensureArray(value)
    .map((candidate): GyeokgukCandidateSummary | null => {
      const type = formatGyeokgukTypeDisplay(candidate?.type);
      if (!type) return null;
      const score = Number(candidate?.score);
      return {
        type,
        category: formatGyeokgukCategoryDisplay(candidate?.category),
        baseTenGod: candidate?.baseSipseong ? formatTenGodDisplay(candidate.baseSipseong) : null,
        score: Number.isFinite(score) ? score : 0,
        confidence: confidenceToRatio(candidate?.confidence),
        supportingRules: ensureArray(candidate?.supportingRules).map((rule) => String(rule)),
        blockingRules: ensureArray(candidate?.blockingRules).map((rule) => String(rule)),
        compositeClassical: extractCompositeClassicalScore(candidate?.compositeClassical),
        sourceTier: extractSourceTier(candidate?.sourceTier),
      };
    })
    .filter((candidate): candidate is GyeokgukCandidateSummary => candidate !== null);

  return candidates.length > 0 ? candidates : undefined;
}

function extractJonggyeokCandidates(value: unknown): readonly JonggyeokCandidateSummary[] | undefined {
  const subtypeSet = new Set<string>(JONGGYEOK_SUBTYPE_CODES);
  const statusSet = new Set<string>(JONGGYEOK_STATUS_CODES);
  const candidates = ensureArray(value)
    .map((candidate): JonggyeokCandidateSummary | null => {
      const subtype = String(candidate?.subtype ?? '');
      if (!subtypeSet.has(subtype)) return null;
      const rawStatus = String(candidate?.status ?? 'none');
      const status = statusSet.has(rawStatus) ? rawStatus : 'none';
      return {
        subtype: subtype as JonggyeokCandidateSummary['subtype'],
        status: status as JonggyeokCandidateSummary['status'],
        score: confidenceToRatio(candidate?.score),
        confidence: confidenceToRatio(candidate?.confidence),
        followPressure: confidenceToRatio(candidate?.followPressure),
        dayMasterIsolation: confidenceToRatio(candidate?.dayMasterIsolation),
        rootWeakness: confidenceToRatio(candidate?.rootWeakness),
        dominantElementShare: confidenceToRatio(candidate?.dominantElementShare),
        breakerPenalty: confidenceToRatio(candidate?.breakerPenalty),
        selectedReason: typeof candidate?.selectedReason === 'string' ? candidate.selectedReason : undefined,
        blockedReason: typeof candidate?.blockedReason === 'string' ? candidate.blockedReason : undefined,
        evidence: ensureArray(candidate?.evidence).map((entry) => String(entry)),
        sourceTier: extractSourceTier(candidate?.sourceTier),
      };
    })
    .filter((candidate): candidate is JonggyeokCandidateSummary => candidate !== null);

  return candidates.length > 0 ? candidates : undefined;
}

function extractCompositeClassicalScore(value: any): GyeokgukCandidateSummary['compositeClassical'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (value.model !== 'composite_classical') return undefined;

  const featureNames = new Set([
    'monthMainMatch',
    'stemTransparency',
    'rootSupport',
    'seasonalCommand',
    'transformationSupport',
    'purityScore',
    'usefulGodAlignment',
    'sourceTierBoost',
    'stabilityAcrossModes',
  ]);
  const status = value.status === 'candidate_evidence' ||
    value.status === 'low_confidence_evidence' ||
    value.status === 'trace_only'
    ? value.status
    : 'trace_only';

  return {
    model: 'composite_classical',
    score: confidenceToRatio(value.score),
    confidence: confidenceToRatio(value.confidence),
    status,
    selectionPolicy: 'evidence_only_never_promote',
    selectedByComposite: false,
    breakerPenalty: Number.isFinite(Number(value.breakerPenalty)) ? Number(value.breakerPenalty) : 0,
    features: ensureArray(value.features)
      .map((feature) => {
        const name = String(feature?.name ?? '');
        if (!featureNames.has(name)) return null;
        return {
          name: name as any,
          score: confidenceToRatio(feature?.score),
          weight: Number.isFinite(Number(feature?.weight)) ? Number(feature.weight) : 0,
          contribution: Number.isFinite(Number(feature?.contribution)) ? Number(feature.contribution) : 0,
          reason: String(feature?.reason ?? ''),
        };
      })
      .filter((feature): feature is any => feature !== null),
    basisRules: ensureArray(value.basisRules).map((rule) => String(rule)),
  };
}

function extractSourceTier(value: any): SourceTierMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return GYEOKGUK_CANDIDATE_SOURCE_TIER;
  }
  const review = value.authorityReview;
  const panel = value.panelAdjudication;
  const panelAdjudication =
    panel &&
    typeof panel === 'object' &&
    !Array.isArray(panel) &&
    Array.isArray(panel.models) &&
    panel.models.every((model: any) =>
      model &&
      typeof model === 'object' &&
      !Array.isArray(model) &&
      typeof model.provider === 'string' &&
      typeof model.family === 'string' &&
      typeof model.version === 'string') &&
    Array.isArray(panel.scopes) &&
    panel.scopes.length > 0 &&
    panel.scopes.every((scope: any) => scope === 'saju_doctrine') &&
    new Set(panel.scopes).size === panel.scopes.length &&
    panel.adversarialVerification === true &&
    typeof panel.dossier === 'string' &&
    typeof panel.recordId === 'string' &&
    typeof panel.contentDigest === 'string'
      ? {
          models: panel.models.map((model: any) => ({
            provider: model.provider,
            family: model.family,
            version: model.version,
          })),
          scopes: [...panel.scopes] as 'saju_doctrine'[],
          adversarialVerification: true as const,
          dossier: panel.dossier,
          recordId: panel.recordId,
          contentDigest: panel.contentDigest,
        }
      : undefined;
  const authorityReview =
    review &&
    typeof review === 'object' &&
    !Array.isArray(review) &&
    review.status === 'approved' &&
    typeof review.reviewedBy === 'string' &&
    review.reviewedBy.trim().length > 0 &&
    typeof review.reviewedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt)
      ? {
          status: 'approved' as const,
          reviewedBy: review.reviewedBy,
          reviewedAt: review.reviewedAt,
        }
      : undefined;
  return {
    tier: typeof value.tier === 'string' ? value.tier : GYEOKGUK_CANDIDATE_SOURCE_TIER.tier,
    sourceType: typeof value.sourceType === 'string' ? value.sourceType : GYEOKGUK_CANDIDATE_SOURCE_TIER.sourceType,
    sourceUrl: typeof value.sourceUrl === 'string' || value.sourceUrl === null ? value.sourceUrl : null,
    accessedAt: typeof value.accessedAt === 'string' ? value.accessedAt : GYEOKGUK_CANDIDATE_SOURCE_TIER.accessedAt,
    quoteShort: typeof value.quoteShort === 'string' || value.quoteShort === null ? value.quoteShort : null,
    humanInterpretation:
      typeof value.humanInterpretation === 'string' && value.humanInterpretation.trim().length > 0
        ? value.humanInterpretation
        : GYEOKGUK_CANDIDATE_SOURCE_TIER.humanInterpretation,
    copyrightNote:
      typeof value.copyrightNote === 'string' && value.copyrightNote.trim().length > 0
        ? value.copyrightNote
        : GYEOKGUK_CANDIDATE_SOURCE_TIER.copyrightNote,
    authorityTruthEligible: typeof value.authorityTruthEligible === 'boolean' ? value.authorityTruthEligible : false,
    ...(typeof value.aiGenerated === 'boolean' ? { aiGenerated: value.aiGenerated } : {}),
    ...(panelAdjudication ? { panelAdjudication } : {}),
    ...(authorityReview ? { authorityReview } : {}),
  };
}

// ---------------------------------------------------------------------------
//  Ten God analysis
// ---------------------------------------------------------------------------

function extractTenGodAnalysis(tenGodResult: any, dayStemCode: string) {
  if (!tenGodResult?.byPosition) return null;

  return {
    dayMaster: formatStemDisplay(dayStemCode || tenGodResult.dayMaster),
    byPosition: Object.fromEntries(
      Object.entries(tenGodResult.byPosition).map(([position, positionInfo]) => {
        const info = positionInfo as any;
        return [position, {
          cheonganTenGod:      formatTenGodDisplay(info.cheonganSipseong),
          jijiPrincipalTenGod: formatTenGodDisplay(info.jijiPrincipalSipseong),
          hiddenStems: ensureArray(info.hiddenStems).map((hidden: any) => {
            const stemCode = String(hidden.stem ?? '');
            return {
              stem:    formatStemDisplay(stemCode),
              element: formatElementDisplay(CHEONGAN[stemCode]?.element ?? ''),
              ratio:   Number(hidden.ratio ?? (hidden.days ? hidden.days / 30 : 0)) || 0,
            };
          }),
          hiddenStemTenGod: ensureArray(info.hiddenStemSipseong).map((hidden: any) => ({
            stem:   formatStemDisplay(hidden.entry?.stem ?? hidden.stem ?? ''),
            tenGod: formatTenGodDisplay(hidden.sipseong),
          })),
        }];
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
//  Shinsal hits (auspicious / inauspicious markers)
// ---------------------------------------------------------------------------

function extractShinsalHits(rawSajuOutput: LegacySajuOutputV1Contract) {
  /** Mirrors the producer contract: 85+ = A, 50+ = B, else C. */
  const gradeFromWeight = (weight: number) => weight >= 85 ? 'A' : weight >= 50 ? 'B' : 'C';
  const gradeMatchesRoundedWeight = (grade: string, weight: number): boolean => {
    if (weight === 85) return grade === 'A' || grade === 'B';
    if (weight === 50) return grade === 'B' || grade === 'C';
    return grade === gradeFromWeight(weight);
  };

  const weightedHits = ensureArray(rawSajuOutput.weightedShinsalHits);
  const sourceHits   = weightedHits.length > 0 ? weightedHits : ensureArray(rawSajuOutput.shinsalHits);
  const isWeighted   = weightedHits.length > 0;

  const SEAT_VALUES = new Set(['year', 'month', 'day', 'hour']);

  return sourceHits.map((item: any) => {
    const hitData    = isWeighted ? item.hit : item;
    if (!hitData || typeof hitData !== 'object' || Array.isArray(hitData)) return null;
    const rawBaseWeight = item?.baseWeight;
    const rawPositionMultiplier = item?.positionMultiplier;
    const rawWeightedScore = item?.weightedScore;
    const rawCount = item?.count;
    const validWeightedContract = !isWeighted || (
      typeof rawBaseWeight === 'number' && Number.isFinite(rawBaseWeight) && rawBaseWeight >= 0 && rawBaseWeight <= 100
      && Number.isInteger(rawBaseWeight)
      && typeof rawPositionMultiplier === 'number' && Number.isFinite(rawPositionMultiplier)
      && rawPositionMultiplier >= 0 && rawPositionMultiplier <= 1
      && typeof rawWeightedScore === 'number' && Number.isFinite(rawWeightedScore)
      && rawWeightedScore >= 0 && rawWeightedScore <= 100
      && Number.isInteger(rawWeightedScore)
      && rawWeightedScore === Math.round(rawBaseWeight * rawPositionMultiplier)
      && (rawCount == null || (Number.isInteger(rawCount) && rawCount >= 1))
    );
    if (!validWeightedContract) return null;
    const baseWeight = isWeighted ? rawBaseWeight : 0;
    if (typeof hitData.type !== 'string' || hitData.type.trim() === '') return null;
    if (typeof hitData.position !== 'string' || hitData.position.trim() === '') return null;
    const gradeCode = hitData.grade;
    if (typeof gradeCode !== 'string' || (isWeighted && !gradeMatchesRoundedWeight(gradeCode, baseWeight))) return null;
    const rawSeatPillars = hitData.seatPillars;
    if (rawSeatPillars != null && (
      !Array.isArray(rawSeatPillars)
      || !rawSeatPillars.every((p: unknown) => typeof p === 'string' && SEAT_VALUES.has(p))
    )) return null;
    const seatPillars = (rawSeatPillars ?? []) as ('year' | 'month' | 'day' | 'hour')[];
    if (isWeighted) {
      const expectedEnabledMultiplier = seatPillars.length > 0
        ? Math.max(...seatPillars.map((seat) => ({ day: 1, month: 0.85, year: 0.7, hour: 0.6 })[seat]))
        : 1;
      if (rawPositionMultiplier !== 1 && rawPositionMultiplier !== expectedEnabledMultiplier) return null;
    }
    const rawQualityReasons = hitData.qualityReasons;
    if (rawQualityReasons != null && (
      !Array.isArray(rawQualityReasons)
      || !rawQualityReasons.every((reason: unknown) => typeof reason === 'string' && reason.trim() !== '')
    )) return null;
    const qualityReasons = (rawQualityReasons ?? []).map((reason: string) => reason.trim());
    const conditionPenalty = hitData?.conditionPenalty;
    const validConditionPenalty = conditionPenalty == null || (
      typeof conditionPenalty === 'number'
      && Number.isFinite(conditionPenalty)
      && conditionPenalty >= 0
      && conditionPenalty <= 1
    );
    if (!validConditionPenalty) return null;
    if ((conditionPenalty == null) !== (qualityReasons.length === 0)) return null;
    if (conditionPenalty != null && conditionPenalty <= 0) return null;
    if (conditionPenalty != null) {
      const expectedBaseWeight = Math.round((1 - conditionPenalty) * 100);
      if (Math.abs(baseWeight - expectedBaseWeight) > 1) return null;
    }
    if (hitData.basedOn != null && typeof hitData.basedOn !== 'string') return null;
    return {
      type:               formatShinsalTypeDisplay(hitData?.type),
      position:           formatShinsalPositionDisplay(hitData?.position),
      grade:              formatCodeDisplay(null, gradeCode),
      baseWeight,
      positionMultiplier: isWeighted ? rawPositionMultiplier : 0,
      weightedScore:      isWeighted ? rawWeightedScore : 0,
      basedOn:            typeof hitData?.basedOn === 'string' ? hitData.basedOn : undefined,
      seatPillars,
      count:              isWeighted && rawCount != null ? rawCount : undefined,
      qualityReasons:     qualityReasons.length ? qualityReasons : undefined,
      conditionPenalty:   conditionPenalty ?? undefined,
    };
  }).filter((hit): hit is NonNullable<typeof hit> => hit !== null);
}


// ---------------------------------------------------------------------------
//  Jiji relations (earthly branch interactions)
// ---------------------------------------------------------------------------

function extractJijiRelations(rawSajuOutput: LegacySajuOutputV1Contract) {
  const resolvedRelations = ensureArray(rawSajuOutput.resolvedJijiRelations);
  const sourceRelations   = resolvedRelations.length > 0 ? resolvedRelations : ensureArray(rawSajuOutput.jijiRelations);
  const isResolved        = resolvedRelations.length > 0;

  return sourceRelations.map((item: any) => {
    const hitData = isResolved ? item.hit : item;
    const typeCode = normalizeRelationTypeCode(hitData?.type ?? item.type ?? '');
    const rawOutcome = isResolved ? item.outcome : (item.outcome ?? hitData?.outcome);
    const rawReasoning = isResolved ? item.reasoning : (item.reasoning ?? hitData?.reasoning);
    const note = String(hitData?.note ?? (item.note ?? JIJI_RELATION_NOTE_KO_LABEL[typeCode] ?? ''));
    const outcome = toNullableString(rawOutcome ?? JIJI_RELATION_OUTCOME_KO_LABEL[typeCode] ?? null);
    let reasoning = toNullableString(rawReasoning);
    if (reasoning) {
      const normalizedReasoning = stripWhitespace(reasoning);
      if (normalizedReasoning === stripWhitespace(note) || (outcome && normalizedReasoning === stripWhitespace(outcome))) {
        reasoning = null;
      }
    }
    return {
      type:      formatRelationTypeDisplay(typeCode),
      branches:  toStringArray(hitData?.members ?? item.members).map(formatBranchDisplay),
      note,
      outcome,
      reasoning,
    };
  });
}

// ---------------------------------------------------------------------------
//  Cheongan relations (heavenly stem interactions)
// ---------------------------------------------------------------------------

function extractCheonganRelationScore(value: unknown): CheonganRelationScore | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const numericKeys = ['baseScore', 'adjacencyBonus', 'outcomeMultiplier', 'finalScore'] as const;
  if (numericKeys.some((key) => typeof raw[key] !== 'number' || !Number.isFinite(raw[key]))) return null;
  const numbers = raw as Record<(typeof numericKeys)[number], number> & Record<string, unknown>;
  const pairCount = raw.pairCount;
  const positionGap = raw.positionGap;
  const positionGaps = raw.positionGaps;
  if (!Number.isInteger(pairCount) || (pairCount as number) < 1) return null;
  if (positionGap !== null && (!Number.isInteger(positionGap) || (positionGap as number) < 0 || (positionGap as number) > 3)) return null;
  if (!Array.isArray(positionGaps) || positionGaps.length !== pairCount) return null;
  if (positionGaps.some((gap) => !Number.isInteger(gap) || gap < 0 || gap > 3)) return null;
  if (positionGaps.some((gap, index) => index > 0 && gap < positionGaps[index - 1])) return null;
  if ((positionGaps[0] ?? null) !== positionGap) return null;
  if (
    numbers.baseScore < 0 || numbers.baseScore > 100
    || numbers.adjacencyBonus < 0 || numbers.adjacencyBonus > 100
    || numbers.outcomeMultiplier < 0 || numbers.outcomeMultiplier > 1
    || numbers.finalScore < 0 || numbers.finalScore > 100
  ) return null;
  if (typeof raw.rationale !== 'string' || raw.rationale.trim() === '') return null;
  const expectedFinalScore = Math.round(Math.min(
    100,
    numbers.baseScore * numbers.outcomeMultiplier + numbers.adjacencyBonus,
  ) * 1_000) / 1_000;
  if (numbers.finalScore !== expectedFinalScore) return null;
  if (
    raw.model !== 'legacy_heuristic_v1'
    || raw.unit !== '0_100'
    || raw.status !== 'provisional'
    || raw.evidenceOnly !== true
    || raw.authorityTruthEligible !== false
    || raw.provisional !== true
  ) return null;

  return {
    model: 'legacy_heuristic_v1',
    unit: '0_100',
    status: 'provisional',
    evidenceOnly: true,
    authorityTruthEligible: false,
    provisional: true,
    pairCount: pairCount as number,
    positionGap: positionGap as number | null,
    positionGaps: [...positionGaps],
    baseScore: numbers.baseScore,
    adjacencyBonus: numbers.adjacencyBonus,
    outcomeMultiplier: numbers.outcomeMultiplier,
    finalScore: numbers.finalScore,
    rationale: cleanAdapterText(typeof raw.rationale === 'string' ? raw.rationale : ''),
  };
}

function extractCheonganRelations(rawSajuOutput: LegacySajuOutputV1Contract) {
  // Build a lookup for scored cheongan relations (if available)
  const scoredRelations = ensureArray(rawSajuOutput.scoredCheonganRelations);
  const scoreByKey = new Map<string, any>();
  const ambiguousKeys = new Set<string>();
  for (const scored of scoredRelations) {
    if (!scored?.hit || typeof scored.hit !== 'object' || Array.isArray(scored.hit)) continue;
    if (typeof scored.hit.type !== 'string' || !Array.isArray(scored.hit.members)) continue;
    if (!scored.hit.members.every((member: unknown) => typeof member === 'string' && member.length > 0)) continue;
    const lookupKey = normalizeRelationTypeCode(scored.hit?.type ?? '') + ':' + toStringArray(scored.hit?.members).sort().join(',');
    const score = extractCheonganRelationScore(scored.score);
    if (!score) continue;
    if (scoreByKey.has(lookupKey) || ambiguousKeys.has(lookupKey)) {
      scoreByKey.delete(lookupKey);
      ambiguousKeys.add(lookupKey);
      continue;
    }
    scoreByKey.set(lookupKey, score);
  }

  return ensureArray(rawSajuOutput.cheonganRelations).map((relation: any) => {
    const typeCode = normalizeRelationTypeCode(relation.type ?? '');
    const lookupKey    = String(typeCode) + ':' + toStringArray(relation.members).sort().join(',');
    const scoreData    = scoreByKey.get(lookupKey);
    return {
      type:          formatRelationTypeDisplay(typeCode),
      stems:         toStringArray(relation.members).map(formatStemDisplay),
      resultElement: relation.resultOhaeng != null ? formatElementDisplay(relation.resultOhaeng) : null,
      note:          String(relation.note ?? CHEONGAN_RELATION_NOTE_KO_LABEL[typeCode] ?? ''),
      // PR-5 (감사 B531) additive: 합 상태 — 합화 성립/기반/쟁합/요합 표기 정직성.
      ...(relation.hapState
        ? {
            hapState: String(relation.hapState),
            hapStateKo: String(relation.hapStateKo ?? relation.hapState),
            resultConfirmed: relation.resultConfirmed === true,
          }
        : {}),
      score: scoreData ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
//  Hap-hwa evaluations (stem combination transformations)
// ---------------------------------------------------------------------------

function extractHapHwaEvaluations(rawSajuOutput: LegacySajuOutputV1Contract) {
  return ensureArray(rawSajuOutput.hapHwaEvaluations).map((evaluation: any) => ({
    stem1:             String(evaluation.stem1     ?? ''),
    stem2:             String(evaluation.stem2     ?? ''),
    position1:         String(evaluation.position1 ?? ''),
    position2:         String(evaluation.position2 ?? ''),
    resultElement:     String(evaluation.resultOhaeng ?? ''),
    state:             String(evaluation.state     ?? ''),
    confidence:        Number(evaluation.confidence) || 0,
    reasoning:         cleanAdapterText(String(evaluation.reasoning ?? '')),
    dayMasterInvolved: !!evaluation.dayMasterInvolved,
  }));
}

// ---------------------------------------------------------------------------
//  Sibi unseong (twelve stages of life cycle)
// ---------------------------------------------------------------------------

function extractSibiUnseong(rawSajuOutput: LegacySajuOutputV1Contract) {
  if (!rawSajuOutput.sibiUnseong) return null;
  return Object.fromEntries(
    (rawSajuOutput.sibiUnseong instanceof Map
      ? [...rawSajuOutput.sibiUnseong]
      : Object.entries(rawSajuOutput.sibiUnseong)
    ).map(([key, value]: [any, any]) => [String(key), String(value)]),
  );
}

// ---------------------------------------------------------------------------
//  YinYang balance (PR-12-4 / 감사 C6)
// ---------------------------------------------------------------------------

function extractYinYangBalance(
  rawSajuOutput: LegacySajuOutputV1Contract,
): SajuSummary['yinYangBalance'] {
  const raw = rawSajuOutput.yinYangBalance;
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const num = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const pair = (v: any) => ({ yang: num(v?.yang), yin: num(v?.yin) });
  const dominant = value.dominant === 'YANG' || value.dominant === 'YIN' ? value.dominant : 'EVEN';
  return {
    yang: num(value.yang),
    yin: num(value.yin),
    stems: pair(value.stems),
    branches: pair(value.branches),
    dominant,
  };
}

// ---------------------------------------------------------------------------
//  Gongmang (void branches)
// ---------------------------------------------------------------------------

function extractGongmang(rawSajuOutput: LegacySajuOutputV1Contract): [string, string] | null {
  const branches = rawSajuOutput.gongmangVoidBranches;
  return Array.isArray(branches) && branches.length >= 2
    ? [formatBranchDisplay(branches[0]), formatBranchDisplay(branches[1])]
    : null;
}

// ---------------------------------------------------------------------------
//  Palace analysis
// ---------------------------------------------------------------------------

function extractPalaceAnalysis(rawSajuOutput: LegacySajuOutputV1Contract) {
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
//  Daeun info (major luck cycles)
// ---------------------------------------------------------------------------

function extractLuckRelationsWithNatal(raw: any) {
  const source = raw?.relationsWithNatal;
  if (!source || typeof source !== 'object') return undefined;
  const normalizeHit = (hit: any) => {
    const members = ensureArray(hit?.members).map(String).filter(Boolean);
    const natalPositions = ensureArray(hit?.natalPositions).map(String).filter(Boolean);
    if (!hit?.type || members.length === 0 || natalPositions.length === 0) return null;
    return {
      type: String(hit.type),
      members,
      natalPositions,
      luckPosition: String(hit.luckPosition ?? 'luck'),
      ...(hit.resultElement || hit.resultOhaeng ? { resultElement: String(hit.resultElement ?? hit.resultOhaeng) } : {}),
    };
  };
  const stemRelations = ensureArray(source.stemRelations).map(normalizeHit).filter(Boolean);
  const branchRelations = ensureArray(source.branchRelations).map(normalizeHit).filter(Boolean);
  // Keep evaluated-empty annotations so report builders do not confuse
  // “no relation found” with a fallback period that was never evaluated.
  return { stemRelations, branchRelations };
}
function extractLuckRelationsWithDecade(raw: any) {
  const source = raw?.relationsWithDecade;
  if (!source || typeof source !== 'object') return undefined;
  const normalizeHit = (hit: any) => {
    const members = ensureArray(hit?.members).map(String).filter(Boolean);
    const luckPositions = ensureArray(hit?.luckPositions).map(String).filter(Boolean);
    if (!hit?.type || members.length === 0) return null;
    return {
      type: String(hit.type),
      members,
      luckPositions: luckPositions.length ? luckPositions : ['decade', 'year'],
      ...(hit.resultElement || hit.resultOhaeng ? { resultElement: String(hit.resultElement ?? hit.resultOhaeng) } : {}),
    };
  };
  const decadeRelations = ensureArray(source.decadeRelations).map((entry: any) => {
    const stemRelations = ensureArray(entry?.stemRelations).map(normalizeHit).filter(Boolean);
    const branchRelations = ensureArray(entry?.branchRelations).map(normalizeHit).filter(Boolean);
    if (stemRelations.length === 0 && branchRelations.length === 0) return null;
    return {
      decadeIndex: Number(entry?.decadeIndex ?? 0),
      decadePillar: {
        cheongan: String(entry?.decadePillar?.cheongan ?? ''),
        jiji: String(entry?.decadePillar?.jiji ?? ''),
      },
      stemRelations,
      branchRelations,
    };
  }).filter(Boolean);
  if (decadeRelations.length === 0) return undefined;
  return { decadeRelations };
}
function withLuckPillarAnnotations<T extends Record<string, unknown>>(out: T, raw: any): T {
  const tenGod = toNullableString(raw?.tenGod);
  const lifeStage = toNullableString(raw?.lifeStage);
  const lifeStageKo = toNullableString(raw?.lifeStageKo);
  const transitShinsal = raw?.transitShinsal ? deepSerialize(raw.transitShinsal) : null;
  const relationsWithNatal = extractLuckRelationsWithNatal(raw);
  const relationsWithDecade = extractLuckRelationsWithDecade(raw);
  const stemBranchInteraction = raw?.stemBranchInteraction ? deepSerialize(raw.stemBranchInteraction) : null;

  return {
    ...out,
    ...(tenGod ? { tenGod } : {}),
    ...(lifeStage ? { lifeStage } : {}),
    ...(lifeStageKo ? { lifeStageKo } : {}),
    ...(transitShinsal ? { transitShinsal } : {}),
    ...(relationsWithNatal ? { relationsWithNatal } : {}),
    ...(relationsWithDecade ? { relationsWithDecade } : {}),
    ...(stemBranchInteraction ? { stemBranchInteraction } : {}),
  };
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value : null;
}

function extractDaeunInfo(rawSajuOutput: LegacySajuOutputV1Contract): DaeunInfoSummary | null {
  const daeunInfoRaw = rawSajuOutput.daeunInfo;
  if (!daeunInfoRaw) return null;

  return {
    isForward:              !!daeunInfoRaw.isForward,
    firstDaeunStartAge:     Number(daeunInfoRaw.firstDaeunStartAge)    || 0,
    firstDaeunStartAgeDisplay: Number.isFinite(daeunInfoRaw.firstDaeunStartAgeDisplay)
      ? Number(daeunInfoRaw.firstDaeunStartAgeDisplay)
      : null,
    ageDisplayMode:        toNullableString(daeunInfoRaw.ageDisplayMode),
    ageDisplayLabel:       toNullableString(daeunInfoRaw.ageDisplayLabel),
    firstDaeunStartMonths:  Number(daeunInfoRaw.firstDaeunStartMonths) || 0,
    boundaryMode:           String(daeunInfoRaw.boundaryMode ?? ''),
    boundaryUtcMs:          Number.isFinite(daeunInfoRaw.boundaryUtcMs) ? Number(daeunInfoRaw.boundaryUtcMs) : null,
    deltaDays:              Number.isFinite(daeunInfoRaw.deltaDays) ? Number(daeunInfoRaw.deltaDays) : null,
    formula:                toNullableString(daeunInfoRaw.formula),
    warnings:               ensureArray(daeunInfoRaw.warnings).map((warning) => cleanAdapterText(String(warning))),
    pillars: ensureArray(daeunInfoRaw.daeunPillars).map((pillarData: any) => withLuckPillarAnnotations({
      stem:     String(pillarData.pillar?.cheongan ?? ''),
      branch:   String(pillarData.pillar?.jiji     ?? ''),
      startAge: Number(pillarData.startAge)        || 0,
      endAge:   Number(pillarData.endAge)          || 0,
      order:    Number(pillarData.order)           || 0,
      displayStartAge: nullableNumber(pillarData.displayStartAge),
      displayEndAge: nullableNumber(pillarData.displayEndAge),
      approxStartUtcMs: nullableNumber(pillarData.approxStartUtcMs),
      approxEndUtcMs: nullableNumber(pillarData.approxEndUtcMs),
    }, pillarData)),
  };
}

// ---------------------------------------------------------------------------
//  Saeun pillars (yearly luck pillars)
// ---------------------------------------------------------------------------

function extractSaeunPillars(rawSajuOutput: LegacySajuOutputV1Contract): SaeunPillarSummary[] {
  return ensureArray(rawSajuOutput.saeunPillars).map((saeun: any) => withLuckPillarAnnotations({
    year:   Number(saeun.year) || 0,
    stem:   String(saeun.pillar?.cheongan ?? ''),
    branch: String(saeun.pillar?.jiji     ?? ''),
    startUtcMs: nullableNumber(saeun.startUtcMs),
    endUtcMs: nullableNumber(saeun.endUtcMs),
    approxStartAgeYears: nullableNumber(saeun.approxStartAgeYears),
    approxEndAgeYears: nullableNumber(saeun.approxEndAgeYears),
  }, saeun));
}

function extractWolunPillars(rawSajuOutput: LegacySajuOutputV1Contract): WolunPillarSummary[] {
  return ensureArray(rawSajuOutput.wolunPillars).map((wolun: any) => withLuckPillarAnnotations({
    year: Number(wolun.year) || 0,
    monthOrder: Number(wolun.monthOrder) || 0,
    startJie: String(wolun.startJie ?? ''),
    stem: String(wolun.pillar?.cheongan ?? ''),
    branch: String(wolun.pillar?.jiji ?? ''),
    startUtcMs: nullableNumber(wolun.startUtcMs),
    endUtcMs: nullableNumber(wolun.endUtcMs),
    approxStartAgeYears: nullableNumber(wolun.approxStartAgeYears),
    approxEndAgeYears: nullableNumber(wolun.approxEndAgeYears),
  }, wolun));
}

// ---------------------------------------------------------------------------
//  Trace / audit log
// ---------------------------------------------------------------------------

function extractTrace(rawSajuOutput: LegacySajuOutputV1Contract) {
  return ensureArray(rawSajuOutput.trace).map((traceEntry: any) => ({
    key:        String(traceEntry.key     ?? ''),
    summary:    cleanAdapterText(String(traceEntry.summary ?? '')),
    evidence:   ensureArray(traceEntry.evidence).map((entry) => cleanAdapterText(String(entry))),
    citations:  ensureArray(traceEntry.citations).map((entry) => cleanAdapterText(String(entry))),
    reasoning:  ensureArray(traceEntry.reasoning).map((entry) => cleanAdapterText(String(entry))),
    confidence: typeof traceEntry.confidence === 'number' ? traceEntry.confidence : null,
  }));
}

// ---------------------------------------------------------------------------
//  Public: safe saju analysis with sajuEnabled flag (PR #7 review)
// ---------------------------------------------------------------------------

export async function analyzeSajuSafe(
  birth: BirthInfo, options?: SpringRequest['options'],
): Promise<SajuSafeAnalysisResult> {
  try {
    const summary = await analyzeSaju(birth, options);
    const isRealAnalysis = isScorableSajuSummary(summary);
    return {
      summary,
      sajuEnabled: isRealAnalysis,
      ...(summary.analysisStatus ? { analysisStatus: summary.analysisStatus } : {}),
      ...(summary.diagnostics?.length ? { diagnostics: summary.diagnostics } : {}),
    };
  } catch (error) {
    if (error instanceof SajuRequestValidationError) throw error;
    const summary = emptySaju(failureReasonCode(error));
    return {
      summary,
      sajuEnabled: false,
      analysisStatus: summary.analysisStatus,
      diagnostics: summary.diagnostics,
    };
  }
}

// ---------------------------------------------------------------------------
//  Public: build a condensed saju context for the name-scoring pipeline
// ---------------------------------------------------------------------------

export function buildSajuContext(
  sajuSummary: SajuSummary,
  options: { readonly includeTenGodByPosition?: boolean } = {},
): { dist: Record<ElementKey, number>; output: SajuOutputSummary | null } {
  const dist = emptyDistribution();
  if (!isScorableSajuSummary(sajuSummary)) return { dist, output: null };

  for (const [code, count] of Object.entries(sajuSummary.elementDistribution)) {
    const key = elementFromSajuCode(code);
    if (key) dist[key] += count;
  }

  const dayMasterKey = elementFromSajuCode(sajuSummary.dayMaster.element);
  const yongshinData = sajuSummary.yongshin;
  const yongshinConsensus = sajuSummary.yongshinConsensus ?? yongshinData.consensus;
  const finalYongshin = normalizeElementCode(yongshinData.element);
  const finalHeesin = normalizeElementCode(yongshinData.heeshin);
  const gisin = normalizeElementCode(yongshinData.gishin);
  const gusin = normalizeElementCode(yongshinData.gushin);

  // Count ten-god group occurrences across all pillar positions, AND surface
  // the per-pillar detail so callers (e.g., precisionConfig.tenGodMode=
  // 'positional_weighted') can apply pillar-specific weights without
  // re-deriving them from the raw saju summary.
  let tenGod: SajuOutputSummary['tenGod'];
  if (sajuSummary.tenGodAnalysis?.byPosition) {
    const groupCounts: Record<string, number> = { friend: 0, output: 0, wealth: 0, authority: 0, resource: 0 };
    const byPosition: Partial<Record<SajuPillarPosition, SajuTenGodPositionGroup>> = {};

    // First pass — replicate the original groupCounts logic exactly so the
    // existing aggregate value is preserved bit-for-bit. The byPosition
    // detail is built in a separate pass that only enumerates the four
    // canonical pillar positions.
    for (const positionInfo of Object.values(sajuSummary.tenGodAnalysis.byPosition)) {
      const stemGroup   = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.cheonganTenGod)];
      const branchGroup = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.jijiPrincipalTenGod)];
      if (stemGroup)   groupCounts[stemGroup]++;
      if (branchGroup) groupCounts[branchGroup]++;
    }

    // Second pass — surface the per-pillar detail (year/month/day/hour) for
    // precisionConfig.tenGodMode='positional_weighted_v2'. Pillars outside the
    // four canonical positions are intentionally skipped here; they still
    // contribute to groupCounts above.
    const canonicalPositions: ReadonlyArray<{ readonly out: SajuPillarPosition; readonly aliases: readonly string[] }> = [
      { out: 'year', aliases: ['year', 'YEAR'] },
      { out: 'month', aliases: ['month', 'MONTH'] },
      { out: 'day', aliases: ['day', 'DAY'] },
      { out: 'hour', aliases: ['hour', 'HOUR'] },
    ];
    for (const { out, aliases } of canonicalPositions) {
      const allowedAliases = options.includeTenGodByPosition ? aliases : [out];
      const positionInfo = allowedAliases
        .map((alias) => sajuSummary.tenGodAnalysis?.byPosition[alias])
        .find(Boolean);
      if (!positionInfo) continue;

      const cheonganGroup        = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.cheonganTenGod)];
      const jijiPrincipalGroup   = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.jijiPrincipalTenGod)];

      const hiddenStemTenGodMap = new Map<string, string>();
      for (const hs of positionInfo.hiddenStemTenGod ?? []) {
        if (hs.stem) hiddenStemTenGodMap.set(hs.stem, hs.tenGod);
      }
      const hiddenStems = (positionInfo.hiddenStems ?? []).map((hs) => ({
        stem: hs.stem,
        element: elementFromSajuCode(hs.element) ?? null,
        ratio: Number(hs.ratio) || 0,
        group: TEN_GOD_GROUP[normalizeTenGodCode(hiddenStemTenGodMap.get(hs.stem) ?? '')],
      }));

      byPosition[out] = {
        cheonganGroup,
        jijiPrincipalGroup,
        hiddenStems: hiddenStems.length > 0 ? hiddenStems : undefined,
      };
    }

    tenGod = {
      groupCounts,
      byPosition: Object.keys(byPosition).length > 0
        ? byPosition as Record<SajuPillarPosition, SajuTenGodPositionGroup>
        : undefined,
    };
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
        finalYongshin:   finalYongshin ?? String(yongshinData.element ?? ''),
        finalHeesin:     finalHeesin ?? null,
        gisin:           gisin ?? null,
        gusin:           gusin ?? null,
        finalConfidence: confidenceToRatio(yongshinData.confidence),
        consensus:        yongshinConsensus,
        methodBreakdown:  yongshinData.methodBreakdown,
        recommendations: yongshinData.recommendations.map(
          ({ type, primaryElement, secondaryElement, confidence, reasoning }) => ({
            type: normalizeYongshinTypeCode(type),
            primaryElement: normalizeElementCode(primaryElement) ?? String(primaryElement ?? ''),
            secondaryElement: normalizeElementCode(secondaryElement),
            confidence: confidenceToRatio(confidence),
            reasoning,
          }),
        ),
      },
      yongshinConsensus,
      tenGod,
      gyeokguk: sajuSummary.gyeokguk?.type ? {
        category:   normalizeGyeokgukCategoryCode(sajuSummary.gyeokguk.category ?? ''),
        type:       normalizeGyeokgukTypeCode(sajuSummary.gyeokguk.type ?? ''),
        confidence: Number(sajuSummary.gyeokguk.confidence) || 0,
        basis:      sajuSummary.gyeokguk.basis,
        scores:     sajuSummary.gyeokguk.scores,
      } : undefined,
      deficientElements: sajuSummary.deficientElements?.length
        ? normalizeElementCodeList(sajuSummary.deficientElements)
        : undefined,
      excessiveElements: sajuSummary.excessiveElements?.length
        ? normalizeElementCodeList(sajuSummary.excessiveElements)
        : undefined,
      axisStrength: sajuSummary.axisStrength ?? deriveAxisStrength(sajuSummary),
      inputUncertainty: sajuSummary.inputUncertainty,
      jieProximity: sajuSummary.jieProximity,
      // PR-H-A: surface the 천간/지지 relation arrays that SajuSummary already
      // carries. Adapter passthrough — the upstream engine is the source of
      // truth; we do not re-derive. When the source is empty/absent we leave
      // the field undefined (rather than emit []) so downstream consumers can
      // distinguish "no relations on this chart" from "absent in the summary".
      cheonganRelations: sajuSummary.cheonganRelations?.length
        ? sajuSummary.cheonganRelations
        : undefined,
      jijiRelations: sajuSummary.jijiRelations?.length
        ? sajuSummary.jijiRelations
        : undefined,
      // PR-H-B: surface 신살 hits + 공망 with the same additive-passthrough
      // policy as PR-H-A. shinsalHits arrives already weighted (qualityWeight
      // × positionMultiplier) from the upstream summary; we do not re-derive.
      shinsalHits: sajuSummary.shinsalHits?.length
        ? sajuSummary.shinsalHits
        : undefined,
      gongmang: sajuSummary.gongmang ?? undefined,
      // PR-H-D: surface 대운 / 세운 richness so the LifeStageFortuneCard +
      // PeriodFortuneCard builders can read transitions without re-fetching
      // the full SajuSummary. Both are already produced by extractDaeunInfo
      // / extractSaeunPillars; we just lift them into the output path.
      daeunInfo: sajuSummary.daeunInfo ?? undefined,
      saeunPillars: sajuSummary.saeunPillars?.length
        ? sajuSummary.saeunPillars
        : undefined,
      wolunPillars: sajuSummary.wolunPillars?.length
        ? sajuSummary.wolunPillars
        : undefined,
      // PR-Q-5: forward palace summary when the adapter populated it
      // (precisionConfig.surfacePalace=true). undefined otherwise.
      palace: sajuSummary.palace ?? undefined,
      // PR-Q-6: forward naeum summary when surfaceNaeum=true. undefined otherwise.
      naeum: sajuSummary.naeum ?? undefined,
    },
  };
}

/** Bins each axis's saju-engine confidence into the 4-tier rhetoric model
 *  (PR9). Returns undefined when no axis carries usable confidence so the
 *  optional field stays absent rather than empty.
 *
 *  Thresholds match saju_master/judgment_expression_engine.py:_score_to_mode
 *  (≥0.85 definite / ≥0.65 practical / ≥0.45 candidate / else deferred). */
function deriveAxisStrength(sajuSummary: SajuSummary): SajuAxisStrengthMap | undefined {
  const out: { -readonly [K in keyof SajuAxisStrengthMap]?: SajuJudgmentStrength } = {};

  // yongshin axis — direct confidence from the engine.
  const yongshinConf = sajuSummary.yongshin?.confidence;
  if (typeof yongshinConf === 'number' && Number.isFinite(yongshinConf)) {
    out.yongshin = toJudgmentStrength(confidenceToRatio(yongshinConf));
  }

  // gyeokguk axis — direct confidence on `sajuSummary.gyeokguk.confidence`.
  const gyeokgukConf = sajuSummary.gyeokguk?.confidence;
  if (typeof gyeokgukConf === 'number' && Number.isFinite(gyeokgukConf)) {
    out.gyeokguk = toJudgmentStrength(gyeokgukConf);
  }

  // strength axis — derive a confidence from the support / oppose lopsidedness.
  const support = Number(sajuSummary.strength?.totalSupport) || 0;
  const oppose  = Number(sajuSummary.strength?.totalOppose)  || 0;
  const total   = Math.abs(support) + Math.abs(oppose);
  if (total > 0) {
    const lopsidedness = Math.abs(Math.abs(support) - Math.abs(oppose)) / total;
    out.strength = toJudgmentStrength(lopsidedness);
  }

  // chengbai / johu / fortuneHierarchy / rectification — saju-ts does not yet
  // surface explicit confidences for these. Future PR can populate.

  return Object.keys(out).length > 0 ? (out as SajuAxisStrengthMap) : undefined;
}

function applyUnknownHourUncertainty(summary: SajuSummary & Record<string, unknown>): void {
  const mutableSummary = summary as Record<string, any>;
  const current = summary.axisStrength ?? deriveAxisStrength(summary);
  const downgraded: { -readonly [K in keyof SajuAxisStrengthMap]?: SajuJudgmentStrength } = { ...(current ?? {}) };

  for (const axis of ['yongshin', 'gyeokguk', 'strength'] as const) {
    const next = downgradeJudgmentStrength(current?.[axis]);
    if (next) downgraded[axis] = next;
  }

  if (Object.keys(downgraded).length > 0) {
    mutableSummary.axisStrength = downgraded as SajuAxisStrengthMap;
  }

  mutableSummary.inputUncertainty = {
    ...(summary.inputUncertainty as object | undefined),
    unknownHour: {
      fallbackHour: DEFAULT_UNKNOWN_HOUR,
      fallbackMinute: DEFAULT_UNKNOWN_MINUTE,
      affectedAxes: UNKNOWN_HOUR_AFFECTED_AXES,
      affectedAxisLabels: UNKNOWN_HOUR_AFFECTED_AXIS_LABELS,
      confidenceTierShift: 'downgrade-one-step',
      message: '출생 시각 정보가 없어 계산에는 낮 12시를 임시 기준으로 사용했어요. 시간에 따라 달라질 수 있는 해석은 참고용으로 보세요.',
    },
  };
}

function downgradeJudgmentStrength(value: SajuJudgmentStrength | undefined): SajuJudgmentStrength | undefined {
  if (value === 'definite') return 'practical';
  if (value === 'practical') return 'candidate';
  return value;
}

function toJudgmentStrength(confidence: number): SajuJudgmentStrength {
  if (confidence >= 0.85) return 'definite';
  if (confidence >= 0.65) return 'practical';
  if (confidence >= 0.45) return 'candidate';
  return 'deferred';
}
