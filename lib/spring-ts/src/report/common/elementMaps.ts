/**
 * elementMaps.ts — 오행 관련 고정 매핑 테이블 모음
 *
 * 사주명리학과 성명학에서 사용되는 오행↔실생활 매핑을 포함합니다.
 * 이 파일의 모든 데이터는 전통 사주 이론에 기반한 고정 규칙입니다.
 */

import type { ElementCode, YinYangCode, StemCode, BranchCode, TenGodCode, StrengthLevel } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  1. 오행 기본 속성
// ─────────────────────────────────────────────────────────────────────────────

export const ELEMENT_KOREAN: Record<ElementCode, string> = {
  WOOD: '목(木)', FIRE: '화(火)', EARTH: '토(土)', METAL: '금(金)', WATER: '수(水)',
};

export const ELEMENT_KOREAN_SHORT: Record<ElementCode, string> = {
  WOOD: '목', FIRE: '화', EARTH: '토', METAL: '금', WATER: '수',
};

export const ELEMENT_COLOR: Record<ElementCode, string> = {
  WOOD: '초록색', FIRE: '빨간색', EARTH: '노란색', METAL: '흰색', WATER: '검정색',
};

export const ELEMENT_DIRECTION: Record<ElementCode, string> = {
  WOOD: '동쪽', FIRE: '남쪽', EARTH: '중앙', METAL: '서쪽', WATER: '북쪽',
};

export const ELEMENT_SEASON: Record<ElementCode, string> = {
  WOOD: '봄', FIRE: '여름', EARTH: '환절기', METAL: '가을', WATER: '겨울',
};

export const ELEMENT_ORGAN: Record<ElementCode, { main: string; sub: string; detail: string }> = {
  WOOD:  { main: '간(肝)', sub: '담(膽)', detail: '간과 담낭, 눈, 근육, 손톱' },
  FIRE:  { main: '심장(心)', sub: '소장(小腸)', detail: '심장과 소장, 혀, 혈맥' },
  EARTH: { main: '비장(脾)', sub: '위장(胃)', detail: '비장과 위장, 입, 살(肉)' },
  METAL: { main: '폐(肺)', sub: '대장(大腸)', detail: '폐와 대장, 코, 피부' },
  WATER: { main: '신장(腎)', sub: '방광(膀胱)', detail: '신장과 방광, 귀, 뼈' },
};

export const ELEMENT_EMOTION: Record<ElementCode, { positive: string; negative: string }> = {
  WOOD:  { positive: '인자함, 너그러움', negative: '분노, 짜증' },
  FIRE:  { positive: '예의, 열정', negative: '조급함, 흥분' },
  EARTH: { positive: '믿음직함, 안정감', negative: '걱정, 집착' },
  METAL: { positive: '의리, 결단력', negative: '슬픔, 고집' },
  WATER: { positive: '지혜, 유연함', negative: '두려움, 우유부단' },
};

export const ELEMENT_NATURE: Record<ElementCode, string> = {
  WOOD: '나무처럼 위로 뻗어 자라는 성장의 기운',
  FIRE: '불꽃처럼 밝고 뜨거운 열정의 기운',
  EARTH: '땅처럼 모든 것을 품어주는 안정의 기운',
  METAL: '쇠처럼 단단하고 날카로운 결단의 기운',
  WATER: '물처럼 아래로 흘러 모이는 지혜의 기운',
};

export const ELEMENT_FOOD: Record<ElementCode, string[]> = {
  WOOD: ['시금치', '부추', '청포도', '매실', '키위', '브로콜리', '셀러리', '녹차'],
  FIRE: ['토마토', '석류', '고추', '수박', '딸기', '비트', '오미자', '쑥'],
  EARTH: ['고구마', '단호박', '옥수수', '감자', '대추', '꿀', '현미', '찹쌀'],
  METAL: ['무', '배', '양파', '마늘', '생강', '도라지', '연근', '더덕'],
  WATER: ['검은콩', '미역', '다시마', '김', '두부', '블루베리', '오징어', '해삼'],
};

export const ELEMENT_HOBBY: Record<ElementCode, string[]> = {
  WOOD: ['등산', '숲 산책', '원예', '요가', '스트레칭', '독서'],
  FIRE: ['달리기', '춤', '미술', '요리', '여행', '악기 연주'],
  EARTH: ['걷기', '도예', '명상', '텃밭 가꾸기', '퍼즐', '봉사활동'],
  METAL: ['수영', '자전거', '서예', '바둑', '체스', '공예'],
  WATER: ['낚시', '수영', '독서', '명상', '음악 감상', '천체관측'],
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. 오행 상생/상극 관계
// ─────────────────────────────────────────────────────────────────────────────

/** 상생(生): A가 B를 낳는다 */
export const ELEMENT_GENERATES: Record<ElementCode, ElementCode> = {
  WOOD: 'FIRE', FIRE: 'EARTH', EARTH: 'METAL', METAL: 'WATER', WATER: 'WOOD',
};

/** 상극(剋): A가 B를 이긴다 */
export const ELEMENT_CONTROLS: Record<ElementCode, ElementCode> = {
  WOOD: 'EARTH', FIRE: 'METAL', EARTH: 'WATER', METAL: 'WOOD', WATER: 'FIRE',
};

/** 상생(生)의 역: B를 낳아주는 A */
export const ELEMENT_GENERATED_BY: Record<ElementCode, ElementCode> = {
  WOOD: 'WATER', FIRE: 'WOOD', EARTH: 'FIRE', METAL: 'EARTH', WATER: 'METAL',
};

/** 상극(剋)의 역: B를 이기는 A */
export const ELEMENT_CONTROLLED_BY: Record<ElementCode, ElementCode> = {
  WOOD: 'METAL', FIRE: 'WATER', EARTH: 'WOOD', METAL: 'FIRE', WATER: 'EARTH',
};

export function getElementRelation(a: ElementCode, b: ElementCode): 'same' | 'generates' | 'generated_by' | 'controls' | 'controlled_by' {
  if (a === b) return 'same';
  if (ELEMENT_GENERATES[a] === b) return 'generates';
  if (ELEMENT_GENERATED_BY[a] === b) return 'generated_by';
  if (ELEMENT_CONTROLS[a] === b) return 'controls';
  if (ELEMENT_CONTROLLED_BY[a] === b) return 'controlled_by';
  return 'same'; // fallback
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. 천간(十天干) 정보
// ─────────────────────────────────────────────────────────────────────────────

export interface StemInfo {
  readonly code: StemCode;
  readonly hangul: string;
  readonly hanja: string;
  readonly element: ElementCode;
  readonly yinYang: YinYangCode;
  readonly index: number;
}

export const STEMS: StemInfo[] = [
  { code: 'GAP',    hangul: '갑', hanja: '甲', element: 'WOOD',  yinYang: 'YANG', index: 0 },
  { code: 'EUL',    hangul: '을', hanja: '乙', element: 'WOOD',  yinYang: 'YIN',  index: 1 },
  { code: 'BYEONG', hangul: '병', hanja: '丙', element: 'FIRE',  yinYang: 'YANG', index: 2 },
  { code: 'JEONG',  hangul: '정', hanja: '丁', element: 'FIRE',  yinYang: 'YIN',  index: 3 },
  { code: 'MU',     hangul: '무', hanja: '戊', element: 'EARTH', yinYang: 'YANG', index: 4 },
  { code: 'GI',     hangul: '기', hanja: '己', element: 'EARTH', yinYang: 'YIN',  index: 5 },
  { code: 'GYEONG', hangul: '경', hanja: '庚', element: 'METAL', yinYang: 'YANG', index: 6 },
  { code: 'SIN',    hangul: '신', hanja: '辛', element: 'METAL', yinYang: 'YIN',  index: 7 },
  { code: 'IM',     hangul: '임', hanja: '壬', element: 'WATER', yinYang: 'YANG', index: 8 },
  { code: 'GYE',    hangul: '계', hanja: '癸', element: 'WATER', yinYang: 'YIN',  index: 9 },
];

export const STEM_BY_CODE: Record<string, StemInfo> = Object.fromEntries(
  STEMS.map(s => [s.code, s]),
);

const STEM_BY_HANGUL: Record<string, StemInfo> = Object.fromEntries(
  STEMS.map(s => [s.hangul, s]),
);

// ─────────────────────────────────────────────────────────────────────────────
//  4. 지지(十二地支) 정보
// ─────────────────────────────────────────────────────────────────────────────

export interface BranchInfo {
  readonly code: BranchCode;
  readonly hangul: string;
  readonly hanja: string;
  readonly element: ElementCode;
  readonly yinYang: YinYangCode;
  readonly animal: string;
  readonly month: number; // 1~12 (인=1, 묘=2, ...)
  readonly timeRange: string;
  readonly index: number;
}

export const BRANCHES: BranchInfo[] = [
  { code: 'JA',         hangul: '자', hanja: '子', element: 'WATER', yinYang: 'YANG', animal: '쥐',    month: 11, timeRange: '23:00~01:00', index: 0 },
  { code: 'CHUK',       hangul: '축', hanja: '丑', element: 'EARTH', yinYang: 'YIN',  animal: '소',    month: 12, timeRange: '01:00~03:00', index: 1 },
  { code: 'IN',         hangul: '인', hanja: '寅', element: 'WOOD',  yinYang: 'YANG', animal: '호랑이', month: 1,  timeRange: '03:00~05:00', index: 2 },
  { code: 'MYO',        hangul: '묘', hanja: '卯', element: 'WOOD',  yinYang: 'YIN',  animal: '토끼',  month: 2,  timeRange: '05:00~07:00', index: 3 },
  { code: 'JIN',        hangul: '진', hanja: '辰', element: 'EARTH', yinYang: 'YANG', animal: '용',    month: 3,  timeRange: '07:00~09:00', index: 4 },
  { code: 'SA',         hangul: '사', hanja: '巳', element: 'FIRE',  yinYang: 'YIN',  animal: '뱀',    month: 4,  timeRange: '09:00~11:00', index: 5 },
  { code: 'O',          hangul: '오', hanja: '午', element: 'FIRE',  yinYang: 'YANG', animal: '말',    month: 5,  timeRange: '11:00~13:00', index: 6 },
  { code: 'MI',         hangul: '미', hanja: '未', element: 'EARTH', yinYang: 'YIN',  animal: '양',    month: 6,  timeRange: '13:00~15:00', index: 7 },
  { code: 'SIN_BRANCH', hangul: '신', hanja: '申', element: 'METAL', yinYang: 'YANG', animal: '원숭이', month: 7,  timeRange: '15:00~17:00', index: 8 },
  { code: 'YU',         hangul: '유', hanja: '酉', element: 'METAL', yinYang: 'YIN',  animal: '닭',    month: 8,  timeRange: '17:00~19:00', index: 9 },
  { code: 'SUL',        hangul: '술', hanja: '戌', element: 'EARTH', yinYang: 'YANG', animal: '개',    month: 9,  timeRange: '19:00~21:00', index: 10 },
  { code: 'HAE',        hangul: '해', hanja: '亥', element: 'WATER', yinYang: 'YIN',  animal: '돼지',  month: 10, timeRange: '21:00~23:00', index: 11 },
];

export const BRANCH_BY_CODE: Record<string, BranchInfo> = Object.fromEntries(
  BRANCHES.map(b => [b.code, b]),
);

const BRANCH_BY_HANGUL: Record<string, BranchInfo> = Object.fromEntries(
  BRANCHES.map(b => [b.hangul, b]),
);

// ─────────────────────────────────────────────────────────────────────────────
//  5. 십성(十神) 정보
// ─────────────────────────────────────────────────────────────────────────────

interface TenGodInfo {
  readonly code: TenGodCode;
  readonly korean: string;
  readonly hanja: string;
  readonly category: 'friend' | 'output' | 'wealth' | 'authority' | 'resource';
  readonly yinYang: YinYangCode;
  readonly shortDesc: string;
}

const TEN_GODS: TenGodInfo[] = [
  { code: 'BI_GYEON',    korean: '비견',  hanja: '比肩',  category: 'friend',    yinYang: 'YANG', shortDesc: '나와 같은 오행, 같은 음양 — 형제, 동료, 경쟁자' },
  { code: 'GEOB_JAE',    korean: '겁재',  hanja: '劫財',  category: 'friend',    yinYang: 'YIN',  shortDesc: '나와 같은 오행, 다른 음양 — 라이벌, 도전자' },
  { code: 'SIK_SHIN',    korean: '식신',  hanja: '食神',  category: 'output',    yinYang: 'YANG', shortDesc: '내가 생하는 오행, 같은 음양 — 재능, 표현, 먹거리' },
  { code: 'SANG_GWAN',   korean: '상관',  hanja: '傷官',  category: 'output',    yinYang: 'YIN',  shortDesc: '내가 생하는 오행, 다른 음양 — 창의력, 반항, 예술' },
  { code: 'PYEON_JAE',   korean: '편재',  hanja: '偏財',  category: 'wealth',    yinYang: 'YANG', shortDesc: '내가 극하는 오행, 같은 음양 — 횡재, 사업, 투자' },
  { code: 'JEONG_JAE',   korean: '정재',  hanja: '正財',  category: 'wealth',    yinYang: 'YIN',  shortDesc: '내가 극하는 오행, 다른 음양 — 정당한 수입, 알뜰함' },
  { code: 'PYEON_GWAN',  korean: '편관',  hanja: '偏官',  category: 'authority', yinYang: 'YANG', shortDesc: '나를 극하는 오행, 같은 음양 — 권력, 압박, 칠살' },
  { code: 'JEONG_GWAN',  korean: '정관',  hanja: '正官',  category: 'authority', yinYang: 'YIN',  shortDesc: '나를 극하는 오행, 다른 음양 — 명예, 직장, 규율' },
  { code: 'PYEON_IN',    korean: '편인',  hanja: '偏印',  category: 'resource',  yinYang: 'YANG', shortDesc: '나를 생하는 오행, 같은 음양 — 특수 학문, 영감, 편모' },
  { code: 'JEONG_IN',    korean: '정인',  hanja: '正印',  category: 'resource',  yinYang: 'YIN',  shortDesc: '나를 생하는 오행, 다른 음양 — 학문, 어머니, 자격증' },
];

export const TEN_GOD_BY_CODE: Record<string, TenGodInfo> = Object.fromEntries(
  TEN_GODS.map(t => [t.code, t]),
);

// ─────────────────────────────────────────────────────────────────────────────
//  6. 신강도 관련
// ─────────────────────────────────────────────────────────────────────────────

export const STRENGTH_KOREAN: Record<StrengthLevel, string> = {
  EXTREME_STRONG: '극신강',
  STRONG: '신강',
  BALANCED: '중화',
  WEAK: '신약',
  EXTREME_WEAK: '극신약',
};

// ─────────────────────────────────────────────────────────────────────────────
//  7. 60갑자 순환
// ─────────────────────────────────────────────────────────────────────────────

interface GanzhiEntry {
  readonly index: number;
  readonly stemIndex: number;
  readonly branchIndex: number;
  readonly stem: StemInfo;
  readonly branch: BranchInfo;
}

const _GANZHI_TABLE: GanzhiEntry[] = [];
for (let i = 0; i < 60; i++) {
  _GANZHI_TABLE.push({
    index: i,
    stemIndex: i % 10,
    branchIndex: i % 12,
    stem: STEMS[i % 10],
    branch: BRANCHES[i % 12],
  });
}
export const GANZHI_60 = _GANZHI_TABLE;

/** 서기 연도 → 60갑자 인덱스 */
export function yearToGanzhiIndex(year: number): number {
  return ((year - 4) % 60 + 60) % 60;
}

/** 줄리안 일수 → 일진 60갑자 인덱스 (기준: 2000-01-07 = 甲子 = 0) */
export function julianDayToGanzhiIndex(julianDay: number): number {
  const refJD = 2451551; // 2000-01-07
  return ((julianDay - refJD) % 60 + 60) % 60;
}

// ─────────────────────────────────────────────────────────────────────────────
//  8. 유틸리티 코드-한국어 변환
// ─────────────────────────────────────────────────────────────────────────────

export function elementCodeToKorean(code: string | null | undefined): string {
  if (!code) return '';
  return ELEMENT_KOREAN_SHORT[code as ElementCode] ?? code;
}

export function lookupStemInfo(code: string): StemInfo | null {
  return STEM_BY_CODE[code] ?? STEM_BY_HANGUL[code] ?? null;
}

export function lookupBranchInfo(code: string): BranchInfo | null {
  return BRANCH_BY_CODE[code] ?? BRANCH_BY_HANGUL[code] ?? null;
}
