const STEM_YANG_CODES = new Set(['GAP', 'BYEONG', 'MU', 'GYEONG', 'IM']);
const STEM_YIN_CODES = new Set(['EUL', 'JEONG', 'GI', 'SIN', 'GYE']);
const BRANCH_YANG_CODES = new Set(['JA', 'IN', 'JIN', 'O', 'SIN', 'SUL']);
const BRANCH_YIN_CODES = new Set(['CHUK', 'MYO', 'SA', 'MI', 'YU', 'HAE']);

// 천간/지지 코드 → 오행 코드 (비가중치 개수 집계용)
const STEM_ELEMENT = {
  GAP: 'WOOD', EUL: 'WOOD', BYEONG: 'FIRE', JEONG: 'FIRE',
  MU: 'EARTH', GI: 'EARTH', GYEONG: 'METAL', SIN: 'METAL',
  IM: 'WATER', GYE: 'WATER',
};
const BRANCH_ELEMENT = {
  JA: 'WATER', CHUK: 'EARTH', IN: 'WOOD', MYO: 'WOOD',
  JIN: 'EARTH', SA: 'FIRE', O: 'FIRE', MI: 'EARTH',
  SIN: 'METAL', YU: 'METAL', SUL: 'EARTH', HAE: 'WATER',
};

export function normalizeElementKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'wood' || normalized === '목') return 'Wood';
  if (normalized === 'fire' || normalized === '화') return 'Fire';
  if (normalized === 'earth' || normalized === '토') return 'Earth';
  if (normalized === 'metal' || normalized === '금') return 'Metal';
  if (normalized === 'water' || normalized === '수') return 'Water';
  return '';
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function createEmptyElementCounts() {
  return { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
}

function buildDisplayHanjaFromUserInfo(entryUserInfo) {
  if (!entryUserInfo) return '';
  const lastName = Array.isArray(entryUserInfo.lastName) ? entryUserInfo.lastName : [];
  const firstName = Array.isArray(entryUserInfo.firstName) ? entryUserInfo.firstName : [];
  return [...lastName, ...firstName]
    .map((entry) => String(entry?.hanja ?? '').trim())
    .filter(Boolean)
    .join('');
}

function buildDisplayHangulFromUserInfo(entryUserInfo) {
  if (!entryUserInfo) return '';
  const lastNameText = String(entryUserInfo.lastNameText ?? '').trim();
  const firstNameText = String(entryUserInfo.firstNameText ?? '').trim();
  return `${lastNameText}${firstNameText}`.trim();
}

function getPolarityCountsFromSajuPillars(sajuReport) {
  let positiveCount = 0;
  let negativeCount = 0;
  const pillarList = ['year', 'month', 'day', 'hour'];

  for (const pillarKey of pillarList) {
    const pillar = sajuReport?.pillars?.[pillarKey];
    const stemCode = String(pillar?.stem?.code ?? '').trim().toUpperCase();
    if (STEM_YANG_CODES.has(stemCode)) positiveCount += 1;
    else if (STEM_YIN_CODES.has(stemCode)) negativeCount += 1;

    const branchCode = String(pillar?.branch?.code ?? '').trim().toUpperCase();
    if (BRANCH_YANG_CODES.has(branchCode)) positiveCount += 1;
    else if (BRANCH_YIN_CODES.has(branchCode)) negativeCount += 1;
  }

  if (positiveCount === 0 && negativeCount === 0) {
    const dayMasterPolarity = String(sajuReport?.dayMaster?.polarity ?? '').trim().toUpperCase();
    if (dayMasterPolarity === 'YANG') positiveCount += 1;
    if (dayMasterPolarity === 'YIN') negativeCount += 1;
  }

  return { positiveCount, negativeCount };
}

export function buildRenderMetricsFromNamingResult(namingResult, overrides = {}) {
  const elementCounts = createEmptyElementCounts();
  const safeResult = namingResult || {};
  const inputEntries = [
    ...(Array.isArray(safeResult?.lastName) ? safeResult.lastName : []),
    ...(Array.isArray(safeResult?.firstName) ? safeResult.firstName : []),
  ];
  for (const entry of inputEntries) {
    const key = normalizeElementKey(entry?.resource_element);
    if (key) {
      elementCounts[key] += 1;
    }
  }

  const hangulBlocks = typeof safeResult?.hangul?.getNameBlocks === 'function'
    ? safeResult.hangul.getNameBlocks()
    : [];
  let positiveCount = 0;
  let negativeCount = 0;
  for (const block of hangulBlocks) {
    const polarity = String(block?.energy?.polarity?.english ?? '').trim().toLowerCase();
    if (polarity === 'positive' || polarity === 'yang' || polarity === '양') positiveCount += 1;
    if (polarity === 'negative' || polarity === 'yin' || polarity === '음') negativeCount += 1;
  }

  const base = {
    elementCounts,
    positiveCount,
    negativeCount,
    score: Number.isFinite(Number(safeResult?.totalScore)) ? Number(safeResult.totalScore).toFixed(1) : '',
    displayHangul: inputEntries.map((entry) => String(entry?.hangul ?? '')).join(''),
    displayHanja: inputEntries.map((entry) => String(entry?.hanja ?? '')).join(''),
  };

  return {
    ...base,
    ...overrides,
    elementCounts: overrides.elementCounts || base.elementCounts,
    positiveCount: overrides.positiveCount ?? base.positiveCount,
    negativeCount: overrides.negativeCount ?? base.negativeCount,
  };
}

export function buildRenderMetricsFromSajuReport(
  sajuReport,
  options = {},
) {
  const elementCounts = createEmptyElementCounts();
  // 가중치 없이 4주(천간4 + 지지4)의 오행을 코드→오행 매핑으로 단순 개수(정수) 집계
  const pillarKeys = ['year', 'month', 'day', 'hour'];
  for (const pk of pillarKeys) {
    const pillar = sajuReport?.pillars?.[pk];
    const stemCode = String(pillar?.stem?.code ?? '').toUpperCase();
    const branchCode = String(pillar?.branch?.code ?? '').toUpperCase();
    const stemEl = normalizeElementKey(STEM_ELEMENT[stemCode]);
    if (stemEl) elementCounts[stemEl] += 1;
    const branchEl = normalizeElementKey(BRANCH_ELEMENT[branchCode]);
    if (branchEl) elementCounts[branchEl] += 1;
  }

  const { positiveCount, negativeCount } = getPolarityCountsFromSajuPillars(sajuReport);
  const displayHangul = options.displayHangul || buildDisplayHangulFromUserInfo(options.entryUserInfo);
  const displayHanja = options.displayHanja || buildDisplayHanjaFromUserInfo(options.entryUserInfo);

  return {
    elementCounts,
    positiveCount,
    negativeCount,
    score: options.score ?? '',
    displayHangul,
    displayHanja,
  };
}
