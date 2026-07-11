/**
 * Pure normalization helpers for values crossing the legacy saju boundary.
 *
 * This module deliberately contains no engine loading or calendar policy. It
 * only translates the mixed legacy code/display forms accepted by the adapter
 * into the canonical codes consumed by Spring.
 */

const CODE_ALIASES: Readonly<Record<string, string>> = {
  SIK_SHIN: 'SIK_SIN',
  GEOB_JAE: 'GYEOB_JAE',
};

const TEN_GOD_CODES = [
  'BI_GYEON', 'GYEOB_JAE', 'SIK_SIN', 'SANG_GWAN',
  'PYEON_JAE', 'JEONG_JAE', 'PYEON_GWAN', 'JEONG_GWAN',
  'PYEON_IN', 'JEONG_IN',
] as const;

const YONGSHIN_TYPE_CODES = [
  'EOKBU', 'JOHU', 'RANKING', 'GYEOKGUK', 'TONGGWAN', 'HAPWHA_YONGSHIN', 'ILHAENG',
] as const;

const GYEOKGUK_CATEGORY_CODES = ['NORMAL', 'JONGGYEOK'] as const;

export const TEN_GOD_KO_LABEL: Readonly<Record<string, string>> = {
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

export const GYEOKGUK_KO_LABEL: Readonly<Record<string, string>> = {
  BI_GYEON: '비견격',
  GYEOB_JAE: '겁재격',
  // 감사 B4: 월지 비겁의 주류 격명. 누락 시 원시 코드가 노출된다.
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

function resolveCodeAlias(code: string): string {
  return CODE_ALIASES[code] ?? code;
}

export function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, '');
}

export function normalizeCodeToken(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (/^[A-Z_]+$/.test(upper)) return resolveCodeAlias(upper);

  const bracketMatch = upper.match(/\(([A-Z_]+)\)\s*$/);
  if (bracketMatch) return resolveCodeAlias(bracketMatch[1] ?? '');

  return '';
}

export function normalizeYongshinTypeCode(value: unknown): string {
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

export function normalizeTenGodCode(value: unknown): string {
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

export function normalizeGyeokgukCategoryCode(value: unknown): string {
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

export function normalizeGyeokgukTypeCode(value: unknown): string {
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
