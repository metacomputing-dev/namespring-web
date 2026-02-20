/**
 * saju-adapter.ts
 *
 * Translates raw saju-ts output into the SajuSummary format used by the rest
 * of the Spring engine.  Think of this as the "interpreter" that sits between
 * the low-level Four Pillars engine and the user-facing scoring pipeline.
 *
 * ?? Glossary (?ъ＜ ?쎿윶) ??????????????????????????????????????????????????
 *  Cheongan (泥쒓컙)        10 Heavenly Stems  ??GAP, EUL, BYEONG ...
 *  Jiji (吏吏)            12 Earthly Branches ??JA, CHUK, IN ...
 *  Ohaeng (?ㅽ뻾)          Five Elements       ??WOOD, FIRE, EARTH, METAL, WATER
 *  Yongshin (?⑹떊)        The "helpful god" element that balances the chart
 *  Heesin (?ъ떊)          The supporting element that assists yongshin
 *  Gisin (湲곗떊)           The harmful element that weakens the chart
 *  Gusin (援ъ떊)           The most harmful element ??worse than gisin
 *  Sipseong (??꽦)        Ten Gods ??relationships between stems
 *  Gyeokguk (寃⑷뎅)        Structural pattern of the chart
 *  Shinsal (?좎궡)         Auspicious/inauspicious markers
 *  Gongmang (怨듬쭩)        "Void" branches in the chart
 *  Daeun (???           Major luck cycles (10-year periods)
 * ?????????????????????????????????????????????????????????????????????????
 */
import { type ElementKey, emptyDistribution } from './core/scoring.js';
import type { SajuOutputSummary, SpringRequest, SajuSummary, PillarSummary, BirthInfo } from './types.js';

// ---------------------------------------------------------------------------
//  Configuration ??loaded from JSON files so non-programmers can tweak them
// ---------------------------------------------------------------------------
import cheonganJijiConfig from '../config/cheongan-jiji.json';
import engineConfig from '../config/engine.json';
import sajuScoringConfig from '../config/saju-scoring.json';

/** Maps uppercase element codes ("WOOD") to display keys ("Wood"). */
const ELEMENT_CODE_TO_KEY: Record<string, ElementKey> = cheonganJijiConfig.elementCodeToKey as Record<string, ElementKey>;

/** Canonical list of the five elements in order. */
const ELEMENT_CODES: readonly string[] = cheonganJijiConfig.elementCodes;

/** Heavenly Stems reference table ??hangul, hanja, element, polarity. */
const CHEONGAN: Record<string, { hangul: string; hanja: string; element: string; polarity: string }> = cheonganJijiConfig.cheongan;

/** Earthly Branches reference table ??hangul, hanja. */
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
const DISTRIBUTION_ROUND_DIGITS = 1;
const DEFICIENT_AVERAGE_RATIO = 0.5;
const EXCESSIVE_AVERAGE_RATIO = 1.7;

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
  BI_GYEON: '\uBE44\uACAC',
  GYEOB_JAE: '\uAC81\uC7AC',
  SIK_SIN: '\uC2DD\uC2E0',
  SANG_GWAN: '\uC0C1\uAD00',
  PYEON_JAE: '\uD3B8\uC7AC',
  JEONG_JAE: '\uC815\uC7AC',
  PYEON_GWAN: '\uD3B8\uAD00',
  JEONG_GWAN: '\uC815\uAD00',
  PYEON_IN: '\uD3B8\uC778',
  JEONG_IN: '\uC815\uC778',
};
const GYEOKGUK_CATEGORY_KO_LABEL: Record<string, string> = {
  NORMAL: '\uC77C\uBC18',
  JONGGYEOK: '\uC885\uACA9',
};
const GYEOKGUK_KO_LABEL: Record<string, string> = {
  BI_GYEON: '\uBE44\uACAC\uACA9',
  GYEOB_JAE: '\uAC81\uC7AC\uACA9',
  JEONG_GWAN: '\uC815\uAD00\uACA9',
  PYEON_GWAN: '\uD3B8\uAD00\uACA9',
  JEONG_JAE: '\uC815\uC7AC\uACA9',
  PYEON_JAE: '\uD3B8\uC7AC\uACA9',
  SIK_SIN: '\uC2DD\uC2E0\uACA9',
  SANG_GWAN: '\uC0C1\uAD00\uACA9',
  JEONG_IN: '\uC815\uC778\uACA9',
  PYEON_IN: '\uD3B8\uC778\uACA9',
  HUA_QI: '\uD654\uAE30\uACA9',
  ZHUAN_WANG: '\uC804\uC655\uACA9',
  CONG_GE: '\uC885\uACA9',
  CONG_CAI: '\uC885\uC7AC\uACA9',
  CONG_GUAN: '\uC885\uAD00\uACA9',
  CONG_SHA: '\uC885\uC0B4\uACA9',
  CONG_ER: '\uC885\uC544\uACA9',
  CONG_YIN: '\uC885\uC778\uACA9',
  CONG_BI: '\uC885\uBE44\uACA9',
};
const JIJI_RELATION_NOTE_KO_LABEL: Record<string, string> = {
  CHUNG: '\uC9C0\uC9C0 \uCDA9 \uAD00\uACC4',
  HAE: '\uC9C0\uC9C0 \uD574 \uAD00\uACC4',
  PA: '\uC9C0\uC9C0 \uD30C \uAD00\uACC4',
  WONJIN: '\uC9C0\uC9C0 \uC6D0\uC9C4 \uAD00\uACC4',
  HYEONG: '\uC9C0\uC9C0 \uD615 \uAD00\uACC4',
  HAP: '\uC9C0\uC9C0 \uD569 \uAD00\uACC4',
  SAMHAP: '\uC9C0\uC9C0 \uC0BC\uD569 \uAD00\uACC4',
  BANGHAP: '\uC9C0\uC9C0 \uBC29\uD569 \uAD00\uACC4',
};
const JIJI_RELATION_OUTCOME_KO_LABEL: Record<string, string> = {
  CHUNG: '\uCDA9',
  HAE: '\uD574',
  PA: '\uD30C',
  WONJIN: '\uC6D0\uC9C4',
  HYEONG: '\uD615',
  HAP: '\uD569',
  SAMHAP: '\uC0BC\uD569',
  BANGHAP: '\uBC29\uD569',
};
const CHEONGAN_RELATION_NOTE_KO_LABEL: Record<string, string> = {
  HAP: '\uCC9C\uAC04 \uD569 \uAD00\uACC4',
  CHUNG: '\uCC9C\uAC04 \uCDA9 \uAD00\uACC4',
  GEUK: '\uCC9C\uAC04 \uADF9 \uAD00\uACC4',
};
const RELATION_TYPE_KO_LABEL: Record<string, string> = {
  HAP: '\uD569',
  CHUNG: '\uCDA9',
  GEUK: '\uADF9',
  HAE: '\uD574',
  PA: '\uD30C',
  WONJIN: '\uC6D0\uC9C4',
  HYEONG: '\uD615',
  SAMHAP: '\uC0BC\uD569',
  BANGHAP: '\uBC29\uD569',
};
const SHINSAL_TYPE_KO_LABEL: Record<string, string> = {
  HAE_SAL: '\uD574\uC0B4',
  PA_SAL: '\uD30C\uC0B4',
  WONJIN_SAL: '\uC6D0\uC9C4\uC0B4',
  WOL_SAL: '\uC6D4\uC0B4',
  JANGSEONG: '\uC7A5\uC131\uC0B4',
  BAN_AN_SAL: '\uBC18\uC548\uC0B4',
  HUAGAI: '\uD654\uAC1C\uC0B4',
  JAESAL: '\uC7AC\uC0B4',
  CHEON_SAL: '\uCC9C\uC0B4',
  CHEON_EUL_GUI_IN: '\uCC9C\uC744\uADC0\uC778',
  GUK_IN_GUI_IN: '\uAD6D\uC778\uADC0\uC778',
  CHEON_BOK_GUI_IN: '\uCC9C\uBCF5\uADC0\uC778',
  BOK_SEONG_GUI_IN: '\uBCF5\uC131\uADC0\uC778',
  WOL_DEOK_GUI_IN: '\uC6D4\uB355\uADC0\uC778',
  WOL_DEOK_HAP: '\uC6D4\uB355\uD569',
  DEOK_SU_GUI_IN: '\uB355\uC218\uADC0\uC778',
  CHEON_DEOK_GUI_IN: '\uCC9C\uB355\uADC0\uC778',
  CHEON_DEOK_HAP: '\uCC9C\uB355\uD569',
  CHEON_WOL_DEOK: '\uCC9C\uC6D4\uB355',
};
const SHINSAL_POSITION_KO_LABEL: Record<string, string> = {
  YEAR: '\uB144\uC8FC',
  MONTH: '\uC6D4\uC8FC',
  DAY: '\uC77C\uC8FC',
  HOUR: '\uC2DC\uC8FC',
  OTHER: '\uAE30\uD0C0',
};

// ---------------------------------------------------------------------------
//  Type-safe constant ??defines the shape of the time-correction object
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

function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, '');
}

function normalizeCodeToken(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (/^[A-Z_]+$/.test(upper)) return upper;

  const bracketMatch = upper.match(/\(([A-Z_]+)\)\s*$/);
  if (bracketMatch) return bracketMatch[1] ?? '';

  return '';
}

function formatCodeDisplay(koreanLabel: string | null, code: string): string {
  if (koreanLabel) return koreanLabel;
  return code;
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
  if (codeToken) return codeToken;
  return raw.toUpperCase().replace(/\s+/g, '_');
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
    '[spring-ts] saju-ts 紐⑤뱢 濡쒕뱶 ?ㅽ뙣. ?ъ＜ 遺꾩꽍??鍮꾪솢?깊솕?⑸땲??',
    `?쒕룄??寃쎈줈: ${candidates.join(', ')}`,
  );
  return null;
}

// ---------------------------------------------------------------------------
//  Small utility helpers
// ---------------------------------------------------------------------------

/** Guarantees an array ??returns `value` if it is one, otherwise wraps it. */
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
  if (month >= 3 && month <= 5) return '遊?湲곗슫(紐? 寃쏀뼢';
  if (month >= 6 && month <= 8) return '?щ쫫 湲곗슫(?? 寃쏀뼢';
  if (month >= 9 && month <= 11) return '媛??湲곗슫(湲? 寃쏀뼢';
  return '寃⑥슱 湲곗슫(?? 寃쏀뼢';
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
      `異쒖깮 ?곕룄 湲곗??쇰줈 ?곗＜瑜?異붿젙?덉뒿?덈떎: ${stemInfo?.hangul ?? stemCode}${branchInfo?.hangul ?? branchCode}??`,
    );
  }

  if (parts.month != null) {
    interpretation.push(`異쒖깮 ???뺣낫濡?怨꾩젅 寃쏀뼢??諛섏쁺?덉뒿?덈떎: ${seasonHintFromMonth(parts.month)}.`);
  }

  if (parts.day != null) {
    interpretation.push('異쒖깮 ???뺣낫???뺤씤?섏뿀吏留??쇱＜/?⑹떊 遺꾩꽍?먮뒗 ?곗썡 ?뺣낫媛 ???꾩슂?⑸땲??');
  }

  if (parts.hour != null) {
    const branchCode = hourBranchCode(parts.hour);
    const branchInfo = JIJI[branchCode];
    interpretation.push(`異쒖깮 ???뺣낫濡??쒖? 寃쏀뼢??諛섏쁺?덉뒿?덈떎: ${branchInfo?.hangul ?? branchCode}??援ш컙.`);
  }

  if (parts.minute != null) {
    interpretation.push('異쒖깮 遺??뺣낫媛 ?덉뼱 ?쒓컙 ?ㅼ감 踰붿쐞瑜?以꾩뿬 ?댁꽍?덉뒿?덈떎.');
  }

  if (birth.gender === 'neutral') {
    interpretation.push('以묒꽦 ?좏깮?쇰줈 ?깅퀎 ?섏〈 ?댁꽍 ??ぉ? 以묐┰ 湲곗??쇰줈 泥섎━?덉뒿?덈떎.');
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
        `異쒖깮 ??遺?誘몄긽?쇰줈 ${String(DEFAULT_UNKNOWN_HOUR).padStart(2, '0')}:${String(DEFAULT_UNKNOWN_MINUTE).padStart(2, '0')} 湲곗? 怨꾩궛???곸슜?덉뒿?덈떎.`,
      );
    }
    if (birth.gender === 'neutral') {
      const maleConfidenceText = neutralMaleConfidence != null ? neutralMaleConfidence.toFixed(2) : '-';
      const femaleConfidenceText = neutralFemaleConfidence != null ? neutralFemaleConfidence.toFixed(2) : '-';
      notes.push(
        `以묒꽦 ?좏깮?쇰줈 ????湲곗???紐⑤몢 怨꾩궛?덇퀬, ?좊ː??湲곗??쇰줈 ${neutralBasis ?? '以묐┰'} 寃곌낵瑜??ъ슜?덉뒿?덈떎. (?⑥꽦 ${maleConfidenceText}, ?ъ꽦 ${femaleConfidenceText})`,
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
//  extractSaju ??composed from focused extraction helpers
// ---------------------------------------------------------------------------

/**
 * Transforms the raw output from saju-ts into our clean SajuSummary shape.
 * Each piece of the summary is extracted by a dedicated helper function.
 */
export function extractSaju(rawSajuOutput: any): SajuSummary {
  const serializedOutput = deepSerialize(rawSajuOutput) as Record<string, unknown>;
  const rawPillars       = rawSajuOutput.pillars ?? rawSajuOutput.coreResult?.pillars;
  const coreResult       = rawSajuOutput.coreResult;
  const pillars = extractPillars(rawPillars);
  const dayStemCode = String(pillars.day.stem.code ?? '');
  const elementDistribution = extractElementDistribution(rawSajuOutput);

  return {
    ...serializedOutput,

    pillars,
    timeCorrection:       extractNumericFields(coreResult, TC_KEYS) as any,
    dayMaster:            extractDayMaster(dayStemCode, rawSajuOutput.strengthResult),
    strength:             extractStrength(rawSajuOutput.strengthResult),
    yongshin:             extractYongshin(rawSajuOutput.yongshinResult),
    gyeokguk:             extractGyeokguk(rawSajuOutput.gyeokgukResult),
    elementDistribution:  elementDistribution.distribution,
    deficientElements:    elementDistribution.deficientElements,
    excessiveElements:    elementDistribution.excessiveElements,
    cheonganRelations:    extractCheonganRelations(rawSajuOutput),
    hapHwaEvaluations:    extractHapHwaEvaluations(rawSajuOutput),
    jijiRelations:        extractJijiRelations(rawSajuOutput),
    sibiUnseong:          extractSibiUnseong(rawSajuOutput),
    gongmang:             extractGongmang(rawSajuOutput),
    tenGodAnalysis:       extractTenGodAnalysis(rawSajuOutput.tenGodAnalysis, dayStemCode),
    shinsalHits:          extractShinsalHits(rawSajuOutput),
    shinsalComposites:    extractShinsalComposites(rawSajuOutput),
    palaceAnalysis:       extractPalaceAnalysis(rawSajuOutput),
    daeunInfo:            extractDaeunInfo(rawSajuOutput),
    saeunPillars:         extractSaeunPillars(rawSajuOutput),
    trace:                extractTrace(rawSajuOutput),
  } as SajuSummary;
}

// ---------------------------------------------------------------------------
//  Pillar extraction ??year / month / day / hour
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
//  Day master ??the stem of the day pillar
// ---------------------------------------------------------------------------

function extractDayMaster(dayStemCode: string, strengthResult: any) {
  const dayMasterInfo = CHEONGAN[dayStemCode];
  // Theory-first: day master (?쇨컙) is defined by the day stem itself.
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
//  Strength ??is the day master strong or weak?
// ---------------------------------------------------------------------------

function extractStrength(strengthResult: any) {
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
//  Element distribution ??how many "points" each element has in the chart
// ---------------------------------------------------------------------------

function extractElementDistribution(rawSajuOutput: any): {
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
//  Yongshin ??the recommended balancing element
// ---------------------------------------------------------------------------

function extractYongshin(yongshinResult: any) {
  const element = yongshinResult?.finalYongshin;
  const heeshin = yongshinResult?.finalHeesin;
  const gishin = yongshinResult?.gisin;
  const gushin = yongshinResult?.gusin;
  return {
    element:    normalizeElementCode(element) ?? String(element ?? ''),
    heeshin:    normalizeElementCode(heeshin) ?? toNullableString(heeshin),
    gishin:     normalizeElementCode(gishin) ?? toNullableString(gishin),
    gushin:     normalizeElementCode(gushin) ?? toNullableString(gushin),
    confidence: confidenceToPoints(yongshinResult?.finalConfidence),
    agreement:  formatYongshinAgreementDisplay(yongshinResult?.agreement),
    recommendations: ensureArray(yongshinResult?.recommendations).map(
      ({ type, primaryElement, secondaryElement, confidence, reasoning }: any) => ({
        type:             formatYongshinTypeDisplay(type),
        primaryElement:   formatElementDisplay(primaryElement),
        secondaryElement: secondaryElement == null ? null : formatElementDisplay(secondaryElement),
        confidence:       confidenceToPoints(confidence),
        reasoning:        String(reasoning ?? ''),
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
//  Gyeokguk ??the structural pattern of the chart
// ---------------------------------------------------------------------------

function extractGyeokguk(gyeokgukResult: any) {
  return {
    type:          formatGyeokgukTypeDisplay(gyeokgukResult?.type),
    category:      formatGyeokgukCategoryDisplay(gyeokgukResult?.category),
    baseTenGod:    gyeokgukResult?.baseSipseong ? formatTenGodDisplay(gyeokgukResult.baseSipseong) : null,
    confidence:    Number(gyeokgukResult?.confidence) || 0,
    reasoning:     String(gyeokgukResult?.reasoning ?? ''),
  };
}

// ---------------------------------------------------------------------------
//  Ten God analysis (??꽦 遺꾩꽍)
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
//  Shinsal hits (?좎궡 ??auspicious / inauspicious markers)
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
    const gradeCode = String(hitData?.grade || '') || (isWeighted ? gradeFromWeight(baseWeight) : 'C');
    return {
      type:               formatShinsalTypeDisplay(hitData?.type),
      position:           formatShinsalPositionDisplay(hitData?.position),
      grade:              formatCodeDisplay(null, gradeCode),
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
//  Jiji relations (吏吏 愿怨???earthly branch interactions)
// ---------------------------------------------------------------------------

function extractJijiRelations(rawSajuOutput: any) {
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
//  Cheongan relations (泥쒓컙 愿怨???heavenly stem interactions)
// ---------------------------------------------------------------------------

function extractCheonganRelations(rawSajuOutput: any) {
  // Build a lookup for scored cheongan relations (if available)
  const scoredRelations = ensureArray(rawSajuOutput.scoredCheonganRelations);
  const scoreByKey = new Map<string, any>();
  for (const scored of scoredRelations) {
    const lookupKey = normalizeRelationTypeCode(scored.hit?.type ?? '') + ':' + toStringArray(scored.hit?.members).sort().join(',');
    scoreByKey.set(lookupKey, scored.score);
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
//  Hap-hwa evaluations (?⑺솕 ??stem combination transformations)
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
//  Sibi unseong (??씠?댁꽦 ??twelve stages of life cycle)
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
//  Gongmang (怨듬쭩 ??void branches)
// ---------------------------------------------------------------------------

function extractGongmang(rawSajuOutput: any): [string, string] | null {
  const branches = rawSajuOutput.gongmangVoidBranches;
  return Array.isArray(branches) && branches.length >= 2
    ? [formatBranchDisplay(branches[0]), formatBranchDisplay(branches[1])]
    : null;
}

// ---------------------------------------------------------------------------
//  Palace analysis (沅?遺꾩꽍)
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
//  Daeun info (?????major luck cycles)
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
//  Saeun pillars (?몄슫 ??yearly luck pillars)
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
  const finalYongshin = normalizeElementCode(yongshinData.element);
  const finalHeesin = normalizeElementCode(yongshinData.heeshin);
  const gisin = normalizeElementCode(yongshinData.gishin);
  const gusin = normalizeElementCode(yongshinData.gushin);

  // Count ten-god group occurrences across all pillar positions
  let tenGod: { groupCounts: Record<string, number> } | undefined;
  if (sajuSummary.tenGodAnalysis?.byPosition) {
    const groupCounts: Record<string, number> = { friend: 0, output: 0, wealth: 0, authority: 0, resource: 0 };
    for (const positionInfo of Object.values(sajuSummary.tenGodAnalysis.byPosition)) {
      const stemGroup   = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.cheonganTenGod)];
      const branchGroup = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.jijiPrincipalTenGod)];
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
        finalYongshin:   finalYongshin ?? String(yongshinData.element ?? ''),
        finalHeesin:     finalHeesin ?? null,
        gisin:           gisin ?? null,
        gusin:           gusin ?? null,
        finalConfidence: confidenceToRatio(yongshinData.confidence),
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
      tenGod,
      gyeokguk: sajuSummary.gyeokguk?.type ? {
        category:   normalizeGyeokgukCategoryCode(sajuSummary.gyeokguk.category ?? ''),
        type:       normalizeGyeokgukTypeCode(sajuSummary.gyeokguk.type ?? ''),
        confidence: Number(sajuSummary.gyeokguk.confidence) || 0,
      } : undefined,
      deficientElements: sajuSummary.deficientElements?.length
        ? normalizeElementCodeList(sajuSummary.deficientElements)
        : undefined,
      excessiveElements: sajuSummary.excessiveElements?.length
        ? normalizeElementCodeList(sajuSummary.excessiveElements)
        : undefined,
    },
  };
}
