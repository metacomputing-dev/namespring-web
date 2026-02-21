// ─────────────────────────────────────────────────────────────────────────────
//  통합 보고서 상수 & 유틸
// ─────────────────────────────────────────────────────────────────────────────

export const ELEMENT_LABEL = { Wood: '목', Fire: '화', Earth: '토', Metal: '금', Water: '수' };
export const ELEMENT_KEYS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
export const ELEMENT_CODE_TO_KEY = { WOOD: 'Wood', FIRE: 'Fire', EARTH: 'Earth', METAL: 'Metal', WATER: 'Water' };
export const ELEMENT_CODE_TO_LABEL = { WOOD: '목(木)', FIRE: '화(火)', EARTH: '토(土)', METAL: '금(金)', WATER: '수(水)' };
export const ELEMENT_CODE_TO_SHORT = { WOOD: '목', FIRE: '화', EARTH: '토', METAL: '금', WATER: '수' };

export const ELEMENT_GENERATES = { WOOD: 'FIRE', FIRE: 'EARTH', EARTH: 'METAL', METAL: 'WATER', WATER: 'WOOD' };
export const ELEMENT_CONTROLS = { WOOD: 'EARTH', FIRE: 'METAL', EARTH: 'WATER', METAL: 'WOOD', WATER: 'FIRE' };

export const ELEMENT_HANJA = { WOOD: '木', FIRE: '火', EARTH: '土', METAL: '金', WATER: '水' };

export const STEM_YANG_CODES = new Set(['GAP', 'BYEONG', 'MU', 'GYEONG', 'IM']);
export const STEM_YIN_CODES = new Set(['EUL', 'JEONG', 'GI', 'SIN', 'GYE']);
export const BRANCH_YANG_CODES = new Set(['JA', 'IN', 'JIN', 'O', 'SIN', 'SUL']);
export const BRANCH_YIN_CODES = new Set(['CHUK', 'MYO', 'SA', 'MI', 'YU', 'HAE']);

// 천간 코드 → 오행 코드
export const STEM_ELEMENT = {
  GAP: 'WOOD', EUL: 'WOOD', BYEONG: 'FIRE', JEONG: 'FIRE',
  MU: 'EARTH', GI: 'EARTH', GYEONG: 'METAL', SIN: 'METAL',
  IM: 'WATER', GYE: 'WATER',
};
// 지지 코드 → 오행 코드
export const BRANCH_ELEMENT = {
  JA: 'WATER', CHUK: 'EARTH', IN: 'WOOD', MYO: 'WOOD',
  JIN: 'EARTH', SA: 'FIRE', O: 'FIRE', MI: 'EARTH',
  SIN: 'METAL', YU: 'METAL', SUL: 'EARTH', HAE: 'WATER',
};

export const FRAME_TYPE_LABEL = {
  won: '원격', hyung: '형격', lee: '이격', jung: '정격',
};
export const FRAME_PERIOD_LABEL = {
  won: '초년운', hyung: '청년운', lee: '중년운', jung: '말년운',
};
export const LUCKY_LEVEL_LABEL = {
  25: '대길', 20: '길', 15: '반길반흉', 10: '흉', 5: '대흉', 0: '흉',
};

export const GYEOKGUK_LABEL = {
  식신격: '식신격 — 재능과 표현력의 구조',
  상관격: '상관격 — 창의와 변혁의 구조',
  정재격: '정재격 — 안정적인 재물 구조',
  편재격: '편재격 — 역동적인 재물 구조',
  정관격: '정관격 — 관성이 일간을 규율하는 구조',
  편관격: '편관격 — 권위와 추진력의 구조',
  정인격: '정인격 — 학문과 지혜의 구조',
  편인격: '편인격 — 독창적 사고의 구조',
  건록격: '건록격 — 자립적 주체의 구조',
  양인격: '양인격 — 강한 의지와 행동의 구조',
};

// ── 유틸 함수 ────────────────────────────────────────────────────────────────

export function normalizeElement(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'wood' || raw === '목') return 'Wood';
  if (raw === 'fire' || raw === '화') return 'Fire';
  if (raw === 'earth' || raw === '토') return 'Earth';
  if (raw === 'metal' || raw === '금') return 'Metal';
  if (raw === 'water' || raw === '수') return 'Water';
  return '';
}

export function normalizeElementCode(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'].includes(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === '목' || lower === 'wood') return 'WOOD';
  if (lower === '화' || lower === 'fire') return 'FIRE';
  if (lower === '토' || lower === 'earth') return 'EARTH';
  if (lower === '금' || lower === 'metal') return 'METAL';
  if (lower === '수' || lower === 'water') return 'WATER';
  return null;
}

export function elShort(code) {
  return ELEMENT_CODE_TO_SHORT[code] ?? code ?? '?';
}

export function elFull(code) {
  return ELEMENT_CODE_TO_LABEL[code] ?? code ?? '?';
}

export function elementBadgeClass(element) {
  if (element === 'Wood' || element === 'WOOD') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (element === 'Fire' || element === 'FIRE') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (element === 'Earth' || element === 'EARTH') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (element === 'Metal' || element === 'METAL') return 'border-slate-200 bg-slate-100 text-slate-700';
  if (element === 'Water' || element === 'WATER') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)]';
}

export function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '0.0';
  return score.toFixed(1);
}

export function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function scoreVerdict(score) {
  if (score >= 85) return '이름과 사주의 조화가 매우 안정적이에요.';
  if (score >= 70) return '균형이 잘 잡혀 실제 사용성이 높은 이름이에요.';
  if (score >= 55) return '무난하지만, 몇 가지 보완 포인트가 있어요.';
  return '보완할 부분이 있지만, 생활 전략으로 충분히 채울 수 있어요.';
}

export function scoreColor(score) {
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-blue-700';
  if (score >= 55) return 'text-amber-700';
  return 'text-rose-700';
}

export function scoreBgColor(score) {
  if (score >= 85) return 'border-emerald-200 bg-emerald-50';
  if (score >= 70) return 'border-blue-200 bg-blue-50';
  if (score >= 55) return 'border-amber-200 bg-amber-50';
  return 'border-rose-200 bg-rose-50';
}

export function scoreBadgeColor(score) {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (score >= 65) return 'border-blue-200 bg-blue-50 text-blue-700';
  if (score >= 50) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

export function luckyLevelLabel(level) {
  const num = Number(level);
  if (num >= 25) return '대길';
  if (num >= 20) return '길';
  if (num >= 15) return '반길반흉';
  if (num >= 10) return '흉';
  return '대흉';
}

export function luckyLevelColor(level) {
  const num = Number(level);
  if (num >= 25) return 'text-emerald-700';
  if (num >= 20) return 'text-blue-700';
  if (num >= 15) return 'text-amber-700';
  return 'text-rose-700';
}

export function luckyLevelBgColor(level) {
  const num = Number(level);
  if (num >= 25) return 'border-emerald-200 bg-emerald-50';
  if (num >= 20) return 'border-blue-200 bg-blue-50';
  if (num >= 15) return 'border-amber-200 bg-amber-50';
  return 'border-rose-200 bg-rose-50';
}
