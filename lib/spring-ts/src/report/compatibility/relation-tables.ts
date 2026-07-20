/**
 * 궁합 계산에 쓰는 간지 쌍 관계 표.
 *
 * 두 사람의 서로 다른 원국에서 글자를 하나씩 가져와 짝짓는 용도이므로,
 * 한 원국 안의 관계를 계산하는 saju-ts의 natal 관계 로직과 별개로
 * 쌍(pair) 조회에 맞는 형태로 정리했다. 표 내용은 고전 명리의 통설을
 * 따르며, 유파에 따라 갈리는 항목(오미합의 합화 등)은 보수적으로 둔다.
 */
import type { FiveElementIdV1, TenGodCodeV1 } from '../delivery/types.js';
import type { GanjiGlyphV1, PolarityV1 } from './types.js';

/* ------------------------------------------------------------------ */
/* 간지 어휘                                                            */
/* ------------------------------------------------------------------ */

export const STEM_CODES = [
  'GAP', 'EUL', 'BYEONG', 'JEONG', 'MU', 'GI', 'GYEONG', 'SIN', 'IM', 'GYE',
] as const;
export type StemCode = (typeof STEM_CODES)[number];

export const BRANCH_CODES = [
  'JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE',
] as const;
export type BranchCode = (typeof BRANCH_CODES)[number];

interface GlyphRow {
  hangul: string;
  hanja: string;
  element: FiveElementIdV1;
  polarity: PolarityV1;
}

export const STEM_TABLE: Record<StemCode, GlyphRow> = {
  GAP: { hangul: '갑', hanja: '甲', element: 'wood', polarity: 'YANG' },
  EUL: { hangul: '을', hanja: '乙', element: 'wood', polarity: 'YIN' },
  BYEONG: { hangul: '병', hanja: '丙', element: 'fire', polarity: 'YANG' },
  JEONG: { hangul: '정', hanja: '丁', element: 'fire', polarity: 'YIN' },
  MU: { hangul: '무', hanja: '戊', element: 'earth', polarity: 'YANG' },
  GI: { hangul: '기', hanja: '己', element: 'earth', polarity: 'YIN' },
  GYEONG: { hangul: '경', hanja: '庚', element: 'metal', polarity: 'YANG' },
  SIN: { hangul: '신', hanja: '辛', element: 'metal', polarity: 'YIN' },
  IM: { hangul: '임', hanja: '壬', element: 'water', polarity: 'YANG' },
  GYE: { hangul: '계', hanja: '癸', element: 'water', polarity: 'YIN' },
};

export const BRANCH_TABLE: Record<BranchCode, GlyphRow> = {
  JA: { hangul: '자', hanja: '子', element: 'water', polarity: 'YANG' },
  CHUK: { hangul: '축', hanja: '丑', element: 'earth', polarity: 'YIN' },
  IN: { hangul: '인', hanja: '寅', element: 'wood', polarity: 'YANG' },
  MYO: { hangul: '묘', hanja: '卯', element: 'wood', polarity: 'YIN' },
  JIN: { hangul: '진', hanja: '辰', element: 'earth', polarity: 'YANG' },
  SA: { hangul: '사', hanja: '巳', element: 'fire', polarity: 'YIN' },
  O: { hangul: '오', hanja: '午', element: 'fire', polarity: 'YANG' },
  MI: { hangul: '미', hanja: '未', element: 'earth', polarity: 'YIN' },
  SIN: { hangul: '신', hanja: '申', element: 'metal', polarity: 'YANG' },
  YU: { hangul: '유', hanja: '酉', element: 'metal', polarity: 'YIN' },
  SUL: { hangul: '술', hanja: '戌', element: 'earth', polarity: 'YANG' },
  HAE: { hangul: '해', hanja: '亥', element: 'water', polarity: 'YIN' },
};

export function stemGlyphV1(code: string): GanjiGlyphV1 | null {
  const key = code.toUpperCase() as StemCode;
  const row = STEM_TABLE[key];
  return row ? { code: key, ...row } : null;
}

export function branchGlyphV1(code: string): GanjiGlyphV1 | null {
  // spring-ts report 레이어는 지지 申을 SIN_BRANCH로 부르기도 한다.
  const normalized = code.toUpperCase() === 'SIN_BRANCH' ? 'SIN' : code.toUpperCase();
  const key = normalized as BranchCode;
  const row = BRANCH_TABLE[key];
  return row ? { code: key, ...row } : null;
}

/* ------------------------------------------------------------------ */
/* 오행 생극                                                            */
/* ------------------------------------------------------------------ */

/** 상생: wood→fire→earth→metal→water→wood */
export const GENERATES: Record<FiveElementIdV1, FiveElementIdV1> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
};

/** 상극: wood→earth→water→fire→metal→wood */
export const CONTROLS: Record<FiveElementIdV1, FiveElementIdV1> = {
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  metal: 'wood',
};

export type ElementRelation =
  | 'same'
  | 'generates'   // x가 y를 생한다
  | 'generated'   // x가 y에게서 생을 받는다
  | 'controls'    // x가 y를 극한다
  | 'controlled'; // x가 y에게 극을 받는다

export function elementRelation(
  x: FiveElementIdV1,
  y: FiveElementIdV1,
): ElementRelation {
  if (x === y) return 'same';
  if (GENERATES[x] === y) return 'generates';
  if (GENERATES[y] === x) return 'generated';
  if (CONTROLS[x] === y) return 'controls';
  return 'controlled';
}

/* ------------------------------------------------------------------ */
/* 십성 — 일간 기준으로 다른 천간을 분류                                  */
/* ------------------------------------------------------------------ */

/** dayStem을 기준(일간)으로 other가 갖는 십성. */
export function tenGodOf(dayStem: StemCode, other: StemCode): TenGodCodeV1 {
  const me = STEM_TABLE[dayStem];
  const target = STEM_TABLE[other];
  const samePolarity = me.polarity === target.polarity;
  switch (elementRelation(me.element, target.element)) {
    case 'same':
      return samePolarity ? 'BI_GYEON' : 'GYEOB_JAE';
    case 'generates':
      return samePolarity ? 'SIK_SIN' : 'SANG_GWAN';
    case 'controls':
      return samePolarity ? 'PYEON_JAE' : 'JEONG_JAE';
    case 'controlled':
      return samePolarity ? 'PYEON_GWAN' : 'JEONG_GWAN';
    case 'generated':
      return samePolarity ? 'PYEON_IN' : 'JEONG_IN';
  }
}

/* ------------------------------------------------------------------ */
/* 천간 쌍 관계                                                         */
/* ------------------------------------------------------------------ */

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

/** 천간합 5종: 갑기합토 을경합금 병신합수 정임합목 무계합화 */
const STEM_HAP: ReadonlyMap<string, FiveElementIdV1> = new Map([
  [pairKey('GAP', 'GI'), 'earth'],
  [pairKey('EUL', 'GYEONG'), 'metal'],
  [pairKey('BYEONG', 'SIN'), 'water'],
  [pairKey('JEONG', 'IM'), 'wood'],
  [pairKey('MU', 'GYE'), 'fire'],
]);

/** 천간충 4종: 갑경 을신 병임 정계 */
const STEM_CHUNG: ReadonlySet<string> = new Set([
  pairKey('GAP', 'GYEONG'),
  pairKey('EUL', 'SIN'),
  pairKey('BYEONG', 'IM'),
  pairKey('JEONG', 'GYE'),
]);

export function stemHapElement(a: StemCode, b: StemCode): FiveElementIdV1 | null {
  return STEM_HAP.get(pairKey(a, b)) ?? null;
}

export function isStemChung(a: StemCode, b: StemCode): boolean {
  return STEM_CHUNG.has(pairKey(a, b));
}

/* ------------------------------------------------------------------ */
/* 지지 쌍 관계                                                         */
/* ------------------------------------------------------------------ */

/** 지지육합: 자축합토 인해합목 묘술합화 진유합금 사신합수 오미합(합화 유보) */
const BRANCH_YUKHAP: ReadonlyMap<string, FiveElementIdV1 | null> = new Map<
  string,
  FiveElementIdV1 | null
>([
  [pairKey('JA', 'CHUK'), 'earth'],
  [pairKey('IN', 'HAE'), 'wood'],
  [pairKey('MYO', 'SUL'), 'fire'],
  [pairKey('JIN', 'YU'), 'metal'],
  [pairKey('SA', 'SIN'), 'water'],
  // 오미합은 유파에 따라 화(火) 또는 합이불화로 갈린다 — 합 자체만 인정.
  [pairKey('O', 'MI'), null],
]);

interface SamhapGroup {
  members: readonly [BranchCode, BranchCode, BranchCode];
  /** 왕지(가운데 글자). 반합 성립 판정에 쓴다. */
  pivot: BranchCode;
  element: FiveElementIdV1;
}

/** 삼합국: 신자진(수) 해묘미(목) 인오술(화) 사유축(금) */
export const SAMHAP_GROUPS: readonly SamhapGroup[] = [
  { members: ['SIN', 'JA', 'JIN'], pivot: 'JA', element: 'water' },
  { members: ['HAE', 'MYO', 'MI'], pivot: 'MYO', element: 'wood' },
  { members: ['IN', 'O', 'SUL'], pivot: 'O', element: 'fire' },
  { members: ['SA', 'YU', 'CHUK'], pivot: 'YU', element: 'metal' },
];

interface BanghapGroup {
  members: readonly [BranchCode, BranchCode, BranchCode];
  pivot: BranchCode;
  element: FiveElementIdV1;
}

/** 방합: 인묘진(목) 사오미(화) 신유술(금) 해자축(수) */
export const BANGHAP_GROUPS: readonly BanghapGroup[] = [
  { members: ['IN', 'MYO', 'JIN'], pivot: 'MYO', element: 'wood' },
  { members: ['SA', 'O', 'MI'], pivot: 'O', element: 'fire' },
  { members: ['SIN', 'YU', 'SUL'], pivot: 'YU', element: 'metal' },
  { members: ['HAE', 'JA', 'CHUK'], pivot: 'JA', element: 'water' },
];

/** 지지충 6종: 자오 축미 인신 묘유 진술 사해 */
const BRANCH_CHUNG: ReadonlySet<string> = new Set([
  pairKey('JA', 'O'),
  pairKey('CHUK', 'MI'),
  pairKey('IN', 'SIN'),
  pairKey('MYO', 'YU'),
  pairKey('JIN', 'SUL'),
  pairKey('SA', 'HAE'),
]);

/**
 * 형: 인사신 삼형(인사·사신·인신), 축술미 삼형(축술·술미·축미), 자묘 상형.
 * 자형(진진·오오·유유·해해)은 두 사람이 같은 글자를 가질 때 성립한다.
 */
const BRANCH_HYEONG: ReadonlySet<string> = new Set([
  pairKey('IN', 'SA'),
  pairKey('SA', 'SIN'),
  pairKey('IN', 'SIN'),
  pairKey('CHUK', 'SUL'),
  pairKey('SUL', 'MI'),
  pairKey('CHUK', 'MI'),
  pairKey('JA', 'MYO'),
]);

const BRANCH_JAHYEONG: ReadonlySet<BranchCode> = new Set(['JIN', 'O', 'YU', 'HAE']);

/** 해(육해): 자미 축오 인사 묘진 신해 유술 */
const BRANCH_HAE: ReadonlySet<string> = new Set([
  pairKey('JA', 'MI'),
  pairKey('CHUK', 'O'),
  pairKey('IN', 'SA'),
  pairKey('MYO', 'JIN'),
  pairKey('SIN', 'HAE'),
  pairKey('YU', 'SUL'),
]);

/** 파: 자유 축진 인해 묘오 사신 술미 */
const BRANCH_PA: ReadonlySet<string> = new Set([
  pairKey('JA', 'YU'),
  pairKey('CHUK', 'JIN'),
  pairKey('IN', 'HAE'),
  pairKey('MYO', 'O'),
  pairKey('SA', 'SIN'),
  pairKey('SUL', 'MI'),
]);

/** 원진: 자미 축오 인유 묘신 진해 사술 */
const BRANCH_WONJIN: ReadonlySet<string> = new Set([
  pairKey('JA', 'MI'),
  pairKey('CHUK', 'O'),
  pairKey('IN', 'YU'),
  pairKey('MYO', 'SIN'),
  pairKey('JIN', 'HAE'),
  pairKey('SA', 'SUL'),
]);

/** 귀문: 자유 축오 인미 묘신 진해 사술 */
const BRANCH_GWIMUN: ReadonlySet<string> = new Set([
  pairKey('JA', 'YU'),
  pairKey('CHUK', 'O'),
  pairKey('IN', 'MI'),
  pairKey('MYO', 'SIN'),
  pairKey('JIN', 'HAE'),
  pairKey('SA', 'SUL'),
]);

export interface BranchPairLookup {
  yukhap: boolean;
  yukhapElement: FiveElementIdV1 | null;
  /** 왕지를 낀 반합일 때만 성립. */
  samhapElement: FiveElementIdV1 | null;
  /** 왕지를 낀 방합 짝일 때만 성립. */
  banghapElement: FiveElementIdV1 | null;
  chung: boolean;
  hyeong: boolean;
  jahyeong: boolean;
  hae: boolean;
  pa: boolean;
  wonjin: boolean;
  gwimun: boolean;
}

/* ------------------------------------------------------------------ */
/* 발음오행 — 초성의 오행 배속 (주류 작명 배속: ㅇ·ㅎ=토)                    */
/* ------------------------------------------------------------------ */

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

/**
 * 아음(ㄱㅋ)=목, 설음(ㄴㄷㄹㅌ)=화, 후음(ㅇㅎ)=토, 치음(ㅅㅈㅊ)=금,
 * 순음(ㅁㅂㅍ)=수. 훈민정음 해례 배속(ㅇㅎ=수, ㅁㅂㅍ=토)을 따르는
 * 소수파가 있으나, 현행 작명 실무의 주류 배속을 기본값으로 쓴다.
 */
const CHOSEONG_ELEMENT: Record<string, FiveElementIdV1> = {
  'ㄱ': 'wood', 'ㄲ': 'wood', 'ㅋ': 'wood',
  'ㄴ': 'fire', 'ㄷ': 'fire', 'ㄸ': 'fire', 'ㄹ': 'fire', 'ㅌ': 'fire',
  'ㅇ': 'earth', 'ㅎ': 'earth',
  'ㅅ': 'metal', 'ㅆ': 'metal', 'ㅈ': 'metal', 'ㅉ': 'metal', 'ㅊ': 'metal',
  'ㅁ': 'water', 'ㅂ': 'water', 'ㅃ': 'water', 'ㅍ': 'water',
};

/** 한글 음절의 초성 발음오행. 한글 음절이 아니면 null. */
export function phoneticElementOfHangul(syllable: string): FiveElementIdV1 | null {
  const code = syllable.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const choseong = CHOSEONG[Math.floor((code - 0xac00) / 588)];
  return CHOSEONG_ELEMENT[choseong] ?? null;
}

export function lookupBranchPair(a: BranchCode, b: BranchCode): BranchPairLookup {
  const key = pairKey(a, b);
  const yukhap = BRANCH_YUKHAP.has(key);

  let samhapElement: FiveElementIdV1 | null = null;
  if (a !== b) {
    for (const group of SAMHAP_GROUPS) {
      if (
        group.members.includes(a)
        && group.members.includes(b)
        && (a === group.pivot || b === group.pivot)
      ) {
        samhapElement = group.element;
        break;
      }
    }
  }

  let banghapElement: FiveElementIdV1 | null = null;
  if (a !== b && samhapElement === null) {
    for (const group of BANGHAP_GROUPS) {
      if (
        group.members.includes(a)
        && group.members.includes(b)
        && (a === group.pivot || b === group.pivot)
      ) {
        banghapElement = group.element;
        break;
      }
    }
  }

  return {
    yukhap,
    yukhapElement: yukhap ? (BRANCH_YUKHAP.get(key) ?? null) : null,
    samhapElement,
    banghapElement,
    chung: BRANCH_CHUNG.has(key),
    hyeong: a !== b && BRANCH_HYEONG.has(key),
    jahyeong: a === b && BRANCH_JAHYEONG.has(a),
    hae: BRANCH_HAE.has(key),
    pa: BRANCH_PA.has(key),
    wonjin: BRANCH_WONJIN.has(key),
    gwimun: BRANCH_GWIMUN.has(key),
  };
}
