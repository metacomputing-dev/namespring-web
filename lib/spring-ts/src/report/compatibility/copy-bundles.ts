/**
 * 궁합 카피 번들 레지스트리.
 *
 * 같은 검출(합·충·원진 …)이라도 관계 프레임(couple·companion·guardian·kids)에
 * 따라 완전히 다른 글이 필요하다 — 단어 몇 개를 치환하는 방식은 문장이
 * 어색해질 뿐 아니라, 돌봄·우정의 자리에 연애의 논리가 새어 들어간다.
 * 그래서 카피를 "상황 id × 프레임" 격자의 번들로 분리한다:
 *
 *  - 상황 id : 'day_stem.hap', 'day_branch.wonjin'처럼 축과 검출의 조합.
 *  - Writer  : 타입이 있는 params를 받아 headline/paragraphs/tips/cautions를
 *              돌려주는 순수 함수. 결정론 — 실행 시각·난수를 쓰지 않는다.
 *  - 해석 규칙: 프레임 전용 writer가 있으면 그것을, 없으면 default를 쓴다
 *              (resolveBundle). 새 관계 톤·상세 라벨 변형은 여기에 writer를
 *              추가하는 것만으로 끼워 넣는다 — 빌더는 손대지 않는다.
 *
 * 빌더(build-couple-compatibility.ts)는 검출과 점수만 맡고, 문장은 전부
 * 이 파일이 맡는다: 검출 → 번들 선택 → 렌더.
 */
import type { FiveElementIdV1, TenGodCodeV1 } from '../delivery/types.js';
import type {
  BranchPairFactV1,
  BranchPairRelationV1,
  CompatFramingV1,
  GanjiGlyphV1,
  StemPairFactV1,
  YongshinCrossFactV1,
} from './types.js';

/* ================================================================== */
/* 한글 카피 공용 도우미 (조사·호칭)                                       */
/* ================================================================== */

export const ELEMENT_KO: Record<FiveElementIdV1, string> = {
  wood: '목',
  fire: '화',
  earth: '토',
  metal: '금',
  water: '수',
};

export const ELEMENT_HANJA: Record<FiveElementIdV1, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
};

/**
 * 받침 유무 → 조사 선택. "경금(庚)"처럼 한자·괄호가 뒤에 붙어도
 * 실제로 읽히는 마지막 한글 음절을 기준으로 판정한다.
 */
export function hasBatchim(word: string): boolean {
  for (let index = word.length - 1; index >= 0; index -= 1) {
    const code = word.charCodeAt(index);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  }
  return false;
}

export function iGa(word: string): string {
  return `${word}${hasBatchim(word) ? '이' : '가'}`;
}

export function eunNeun(word: string): string {
  return `${word}${hasBatchim(word) ? '은' : '는'}`;
}

export function gwaWa(word: string): string {
  return `${word}${hasBatchim(word) ? '과' : '와'}`;
}

export function eulReul(word: string): string {
  return `${word}${hasBatchim(word) ? '을' : '를'}`;
}

/**
 * '(으)로' 선택. 받침이 없거나 ㄹ 받침이면 '로', 그 외 받침은 '으로'.
 * ("'엄마와 딸'"처럼 따옴표가 붙어 있어도 마지막 한글 음절로 판정한다.)
 */
export function euRo(word: string): string {
  for (let index = word.length - 1; index >= 0; index -= 1) {
    const code = word.charCodeAt(index);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const jong = (code - 0xac00) % 28;
      return jong === 0 || jong === 8 ? '로' : '으로';
    }
  }
  return '로';
}

/** 갑목(甲) 형태의 글자 호칭. */
export function stemKo(glyph: GanjiGlyphV1): string {
  return `${glyph.hangul}${ELEMENT_KO[glyph.element]}(${glyph.hanja})`;
}

export function branchKo(glyph: GanjiGlyphV1): string {
  return `${glyph.hangul}${ELEMENT_KO[glyph.element]}(${glyph.hanja})`;
}

export function elementKo(element: FiveElementIdV1): string {
  return `${ELEMENT_KO[element]}(${ELEMENT_HANJA[element]})`;
}

export function listKo(items: readonly string[]): string {
  return items.join('·');
}

/* ================================================================== */
/* 공유 서사 표 (프레임 공통 소재)                                         */
/* ================================================================== */

export const TEN_GOD_KO: Record<TenGodCodeV1, string> = {
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

/** 십성이 상대를 "어떤 존재"로 만드는지 — 성인 관계(연애·우정·동료)의 언어. */
const TEN_GOD_RELATIONAL_GLOSS: Record<TenGodCodeV1, string> = {
  BI_GYEON: '어깨를 나란히 하는 동료 같은 존재',
  GYEOB_JAE: '승부욕을 자극하는 라이벌 같은 존재',
  SIK_SIN: '함께 있으면 편하게 마음을 표현하게 되는 존재',
  SANG_GWAN: '틀을 벗어나게 만들고 자유로움을 깨우는 존재',
  PYEON_JAE: '마음을 설레게 하고 움직이게 하는 존재',
  JEONG_JAE: '아끼고 책임지고 싶어지는 존재',
  PYEON_GWAN: '긴장하게 하지만 그만큼 단련시켜 주는 존재',
  JEONG_GWAN: '반듯하게 세워 주고 기대게 되는 존재',
  PYEON_IN: '색다른 시선과 영감을 건네는 존재',
  JEONG_IN: '품어 주고 든든하게 받쳐 주는 존재',
};

/** 십성을 양육의 언어로 — guardian 프레임 전용 (예: 정인 = 기대어 쉬는 그늘). */
const TEN_GOD_GUARDIAN_GLOSS: Record<TenGodCodeV1, string> = {
  BI_GYEON: '눈높이를 나란히 맞춰 주는 친구 같은 존재',
  GYEOB_JAE: '지지 않으려는 마음을 깨워 주는 존재',
  SIK_SIN: '마음껏 표현하도록 문을 열어 주는 존재',
  SANG_GWAN: '틀 밖의 생각을 꺼내게 해 주는 존재',
  PYEON_JAE: '세상을 재미있는 놀이터로 보이게 하는 존재',
  JEONG_JAE: '살뜰히 아끼고 챙기게 되는 존재',
  PYEON_GWAN: '어렵지만 그만큼 단단하게 단련시켜 주는 존재',
  JEONG_GWAN: '기준이 되어 주고 바르게 세워 주는 존재',
  PYEON_IN: '엉뚱한 질문을 반겨 주는 존재',
  JEONG_IN: '기대어 쉬는 그늘이 되어 주는 존재',
};

/** 십성을 우정의 언어로 — kids 프레임 전용. */
const TEN_GOD_KIDS_GLOSS: Record<TenGodCodeV1, string> = {
  BI_GYEON: '무엇이든 같이 하고 싶어지는 단짝 같은 존재',
  GYEOB_JAE: '이기고 싶은 마음을 깨우는 맞수 같은 존재',
  SIK_SIN: '같이 있으면 웃음이 많아지는 존재',
  SANG_GWAN: '새로운 장난을 자꾸 생각해 내게 하는 존재',
  PYEON_JAE: '마음을 들뜨게 하고 움직이게 하는 존재',
  JEONG_JAE: '아끼는 것을 나눠 주고 싶어지는 존재',
  PYEON_GWAN: '긴장하게 하지만 그만큼 씩씩해지게 하는 존재',
  JEONG_GWAN: '차례와 약속을 지키게 해 주는 존재',
  PYEON_IN: '신기한 생각을 옮겨 주는 존재',
  JEONG_IN: '기대면 받아 주는 언니·형 같은 존재',
};

export function describeElementMood(element: FiveElementIdV1): string {
  switch (element) {
    case 'wood': return '함께 자라고 계획을 세우는 분위기';
    case 'fire': return '서로를 밝히고 데우는 분위기';
    case 'earth': return '믿고 기대는 안정의 분위기';
    case 'metal': return '약속을 지키고 정돈하는 분위기';
    case 'water': return '깊이 대화하고 스며드는 분위기';
  }
}

/** 천간합 5종의 고전 명칭과 궁합 서사. 키는 정렬된 코드 쌍. */
const STEM_HAP_NAMES: Record<string, { name: string; gloss: string }> = {
  'GAP+GI': { name: '중정지합(中正之合)', gloss: '신뢰와 포용으로 맺어지는 합이에요.' },
  'EUL+GYEONG': { name: '인의지합(仁義之合)', gloss: '부드러움과 강직함이 의리로 맺어지는 합이에요.' },
  'BYEONG+SIN': { name: '위엄지합(威嚴之合)', gloss: '긴장감 있는 지적 끌림의 합이에요.' },
  'IM+JEONG': { name: '음닉지합(淫匿之合)', gloss: '깊은 정서적 교감으로 맺어지는 합이에요.' },
  'GYE+MU': { name: '무정지합(無情之合)', gloss: '열정적이지만 서로의 온도차를 헤아려야 하는 합이에요.' },
};

/** 지지충 여섯 쌍의 고유한 결. 키는 정렬된 코드 쌍. */
const CHUNG_NUANCE: Record<string, string> = {
  'JA+O': '자오충은 감정의 온도가 크게 출렁이는 왕지충이라, 정서의 파도를 함께 넘는 연습이 특히 중요해요.',
  'CHUK+MI': '축미충은 고집과 가치관이 조용히 맞서는 붕충이라, 승부를 내려 하기보다 서로의 원칙을 인정하는 쪽이 편해요.',
  'IN+SIN': '인신충은 움직임이 큰 역마의 충이라, 생활 동선과 속도가 자주 어긋날 수 있어요. 일정을 공유하는 습관이 힘이 돼요.',
  'MYO+YU': '묘유충은 예민한 감각끼리 부딪히는 충이라, 사소한 취향 차이를 농담으로 넘기는 여유가 열쇠예요.',
  'JIN+SUL': '진술충은 속마음을 감추기 쉬운 붕충이라, 침묵의 냉전 대신 짧아도 정기적인 대화가 필요해요.',
  'HAE+SA': '사해충은 방향이 서로 반대로 향하는 역마의 충이라, 각자의 길을 인정하되 돌아오는 자리를 함께 정해 두면 좋아요.',
};

export const BRANCH_RELATION_KO: Record<BranchPairRelationV1, string> = {
  yukhap: '육합(六合)',
  samhap: '삼합(三合) 반합',
  banghap: '방합(方合)',
  chung: '충(沖)',
  hyeong: '형(刑)',
  jahyeong: '자형(自刑)',
  hae: '해(害)',
  pa: '파(破)',
  wonjin: '원진(怨嗔)',
  gwimun: '귀문(鬼門)',
};

export interface BranchAxisTone {
  positives: BranchPairRelationV1[];
  negatives: BranchPairRelationV1[];
}

export function splitBranchRelations(
  relations: readonly BranchPairRelationV1[],
): BranchAxisTone {
  const positives = relations.filter(
    (relation): relation is BranchPairRelationV1 =>
      relation === 'yukhap' || relation === 'samhap' || relation === 'banghap',
  );
  const negatives = relations.filter(
    relation => relation !== 'yukhap' && relation !== 'samhap' && relation !== 'banghap',
  );
  return { positives, negatives };
}

/* ================================================================== */
/* 번들 계약                                                            */
/* ================================================================== */

/** writer가 돌려주는 카피 조각. headline이 없으면 빌더의 기본값을 쓴다. */
export interface CopyBlockV1 {
  readonly headline?: string;
  readonly paragraphs: string[];
  readonly tips?: string[];
  readonly cautions?: string[];
}

export type CopyWriterV1<P> = (params: P) => CopyBlockV1;

/** 프레임별 writer 묶음. 프레임 전용이 없으면 default로 내려앉는다. */
export interface CopyBundleV1<P> {
  readonly default: CopyWriterV1<P>;
  readonly couple?: CopyWriterV1<P>;
  readonly companion?: CopyWriterV1<P>;
  readonly guardian?: CopyWriterV1<P>;
  readonly kids?: CopyWriterV1<P>;
}

/**
 * 카피의 목소리. 프레임과, guardian 프레임에서 어른/아이를 가리키기 위한
 * 나이 위·아래 표시명을 담는다 (나이 정보가 없으면 null).
 */
export interface CopyVoiceV1 {
  readonly framing: CompatFramingV1;
  readonly elderName: string | null;
  readonly youngerName: string | null;
  /**
   * 나이 위쪽이 미성년(청소년+아이 짝의 청소년 등)인가.
   * 참이면 guardian 카피가 '어른/아이' 대신 '손위/손아래'로 부른다.
   */
  readonly elderIsMinor?: boolean;
}

/** guardian 프레임의 역할 호칭: 기본은 어른/아이, 손위가 미성년이면 손위/손아래. */
function guardianRoles(voice: CopyVoiceV1): { elder: string; younger: string } {
  return voice.elderIsMinor
    ? { elder: '손위', younger: '손아래' }
    : { elder: '어른', younger: '아이' };
}

export interface DayStemCopyParamsV1 {
  readonly aName: string;
  readonly bName: string;
  readonly fact: StemPairFactV1;
  /** 합화 오행이 그 사람의 용신일 때 그 사람 표시명. */
  readonly hapYongshinOwnerName: string | null;
  /** 합화 오행이 그 사람의 기신일 때 그 사람 표시명. */
  readonly hapGishinOwnerName: string | null;
  readonly voice: CopyVoiceV1;
}

export interface BranchPairCopyParamsV1 {
  readonly aName: string;
  readonly bName: string;
  readonly fact: BranchPairFactV1;
  /** '배우자궁(일지)'·'일지(속마음 자리)'·'띠(년지)' 같은 자리 호칭. */
  readonly seatLabel: string;
  /** "{a}님의 X과 {b}님의 Y은" 형태의 공용 주어구. */
  readonly pairLabel: string;
  /** 흉 관계 합성 경로에서 이 writer가 맡은 관계 (hae_pa 판별 등). */
  readonly relation?: BranchPairRelationV1;
  readonly voice: CopyVoiceV1;
}

export interface TenGodCopyParamsV1 {
  readonly aName: string;
  readonly bName: string;
  readonly bForA: TenGodCodeV1;
  readonly aForB: TenGodCodeV1;
  readonly aGender: 'male' | 'female' | 'unknown';
  readonly bGender: 'male' | 'female' | 'unknown';
  readonly voice: CopyVoiceV1;
}

export interface YongshinCopyParamsV1 {
  readonly giverName: string;
  readonly receiverName: string;
  readonly fact: YongshinCrossFactV1;
  readonly voice: CopyVoiceV1;
}

/** 상황 id → writer params 타입. 레지스트리와 resolveBundle의 타입 근거. */
export interface CopySituationParamsMapV1 {
  'day_stem.hap': DayStemCopyParamsV1;
  'day_stem.chung': DayStemCopyParamsV1;
  'day_stem.saeng': DayStemCopyParamsV1;
  'day_stem.geuk': DayStemCopyParamsV1;
  'day_stem.bihwa': DayStemCopyParamsV1;
  'day_branch.yukhap': BranchPairCopyParamsV1;
  'day_branch.samhap': BranchPairCopyParamsV1;
  'day_branch.banghap': BranchPairCopyParamsV1;
  'day_branch.mixed': BranchPairCopyParamsV1;
  'day_branch.none': BranchPairCopyParamsV1;
  'day_branch.chung': BranchPairCopyParamsV1;
  'day_branch.wonjin': BranchPairCopyParamsV1;
  'day_branch.hyeong': BranchPairCopyParamsV1;
  'day_branch.jahyeong': BranchPairCopyParamsV1;
  'day_branch.gwimun': BranchPairCopyParamsV1;
  'day_branch.hae_pa': BranchPairCopyParamsV1;
  'ten_god.pair': TenGodCopyParamsV1;
  'yongshin.direct': YongshinCopyParamsV1;
  'yongshin.generates': YongshinCopyParamsV1;
  'yongshin.controls': YongshinCopyParamsV1;
  'yongshin.neutral': YongshinCopyParamsV1;
}

export type CopySituationIdV1 = keyof CopySituationParamsMapV1;

/* ================================================================== */
/* 일간(day_stem) 번들                                                  */
/* ================================================================== */

/** 천간합 카피의 성인 공통 골격. coupleTone에 따라 두 번째 문단만 갈린다. */
function dayStemHapAdult(params: DayStemCopyParamsV1, coupleTone: boolean): CopyBlockV1 {
  const { aName, bName, fact } = params;
  const aStem = stemKo(fact.a);
  const bStem = stemKo(fact.b);
  const hapEl = fact.hapElement!;
  const hapName = STEM_HAP_NAMES[[fact.a.code, fact.b.code].sort().join('+')];
  const paragraphs: string[] = [];
  const cautions: string[] = [];
  paragraphs.push(
    `${aName}님의 ${iGa(aStem)} ${bName}님의 ${gwaWa(bStem)} 천간합(天干合)을 이뤄요. `
    + `명리에서 일간끼리의 합은 처음부터 이유 없이 끌리는, 궁합에서 가장 반기는 인연의 표식이에요.`
    + (hapName ? ` 고전에서는 이 합을 ${hapName.name}이라 불러요 — ${hapName.gloss}` : ''),
  );
  paragraphs.push(
    `이 합이 모이면 ${elementKo(hapEl)} 기운으로 화(化)하려 해요. 함께 있을 때 두 분 사이에 `
    + `${describeElementMood(hapEl)}가 자라나기 쉬워요. `
    + (coupleTone
      ? `또 천간합의 짝은 서로가 서로의 정재·정관 — 고전이 말하는 배우자의 별 — 이 되는 구조라, 부부 궁합에서 특히 귀하게 여겨요.`
      : `또 천간합의 짝은 서로가 서로를 아끼고 세워 주는 정재·정관의 구조라, 관계의 안정감이 깊어요.`),
  );
  if (params.hapYongshinOwnerName) {
    paragraphs.push(
      `게다가 그 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapYongshinOwnerName}님 사주가 반기는 기운이라, 합의 결과가 실제로 힘이 되는 방향이에요.`,
    );
  } else if (params.hapGishinOwnerName) {
    cautions.push(
      `합해서 생기는 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapGishinOwnerName}님 사주가 조심스러워하는 기운이기도 해요 — 함께 만드는 분위기가 넘치지 않게 살펴 주세요.`,
    );
  }
  cautions.push('합은 끌림이면서 묶임이기도 해요 — 서로의 자유를 존중할 때 이 인연이 가장 빛나요.');
  return {
    headline: '두 분의 일간이 천간합으로 서로를 끌어당겨요.',
    paragraphs,
    cautions,
  };
}

const DAY_STEM_HAP: CopyBundleV1<DayStemCopyParamsV1> = {
  default: params => dayStemHapAdult(params, false),
  couple: params => dayStemHapAdult(params, true),
  companion: params => {
    const { aName, bName, fact } = params;
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    const hapEl = fact.hapElement!;
    const hapName = STEM_HAP_NAMES[[fact.a.code, fact.b.code].sort().join('+')];
    const paragraphs: string[] = [];
    const cautions: string[] = [];
    paragraphs.push(
      `${aName}님의 ${iGa(aStem)} ${bName}님의 ${gwaWa(bStem)} 천간합(天干合)을 이뤄요. `
      + `우정의 자리에서 이 합은 오래 알아 온 사이처럼 말문이 쉽게 트이는 힘으로 나타나요 — 처음 만난 자리에서도 어느새 둘이서 다음 약속을 잡고 있기 쉬워요.`
      + (hapName ? ` 고전에서는 이 합을 ${hapName.name}이라 불러요 — ${hapName.gloss}` : ''),
    );
    paragraphs.push(
      `이 합이 모이면 ${elementKo(hapEl)} 기운으로 화(化)하려 해요. 함께 도모하는 일마다 ${describeElementMood(hapEl)}가 스며들기 쉬워요. `
      + `또 천간합의 짝은 서로를 아끼고 세워 주게 되는 구조라, 동반의 신뢰가 유난히 빨리 쌓이는 쪽이에요.`,
    );
    if (params.hapYongshinOwnerName) {
      paragraphs.push(
        `게다가 그 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapYongshinOwnerName}님 사주가 반기는 기운이에요 — 이 우정에 머무는 것만으로 채워지는 몫이 있다는 뜻이에요.`,
      );
    } else if (params.hapGishinOwnerName) {
      cautions.push(
        `합해서 생기는 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapGishinOwnerName}님 사주가 조심스러워하는 기운이기도 해요 — 어울림이 늘 같은 색으로만 흐르지 않게, 이따금 다른 결의 시간을 섞어 주세요.`,
      );
    }
    cautions.push(
      '합은 끌림이면서 묶임이기도 해요 — 둘만의 결속이 다른 동료를 밀어내지 않게 자리를 조금 열어 두면, 이 우정이 더 넓게 자라요.',
    );
    return {
      headline: '두 분의 일간이 천간합으로 이어져 있어요 — 금세 뜻이 맞는 동반의 짝이에요.',
      paragraphs,
      cautions,
    };
  },
  guardian: params => {
    const { aName, bName, fact } = params;
    const { elder, younger } = guardianRoles(params.voice);
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    const hapEl = fact.hapElement!;
    const paragraphs: string[] = [];
    const cautions: string[] = [];
    paragraphs.push(
      `${aName}님의 ${iGa(aStem)} ${bName}님의 ${gwaWa(bStem)} 천간합(天干合)을 이뤄요. `
      + `돌봄의 자리에서 이 합은, ${iGa(younger)} 유난히 이 ${elder} 곁에서 순해지고 ${elder}도 이 ${younger} 앞에서는 마음이 풀어지는 모양으로 나타나요. 애써 노력하지 않아도 품이 잘 맞는 인연이에요.`,
    );
    paragraphs.push(
      `이 합이 모이면 ${elementKo(hapEl)} 기운으로 화(化)하려 해요. 함께 보내는 시간 속에 ${describeElementMood(hapEl)}가 자라나기 쉬워요.`,
    );
    if (params.hapYongshinOwnerName) {
      paragraphs.push(
        `게다가 그 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapYongshinOwnerName}님 사주가 반기는 기운이라, 곁을 지키는 돌봄의 시간이 그대로 보약이 되는 셈이에요.`,
      );
    } else if (params.hapGishinOwnerName) {
      cautions.push(
        `합해서 생기는 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapGishinOwnerName}님 사주가 조심스러워하는 기운이기도 해요 — 둘 사이의 공기가 그 기운으로만 가득 차지 않게 이따금 환기해 주세요.`,
      );
    }
    cautions.push(
      `합은 끌림이면서 묶임이기도 해요 — ${iGa(younger)} ${elder}의 기대에 맞추려고만 하지 않도록, ${younger}의 "싫어요"도 반갑게 받아 주세요.`,
    );
    return {
      headline: `${gwaWa(elder)} ${younger}의 일간이 천간합으로 이어져 있어요.`,
      paragraphs,
      cautions,
    };
  },
  kids: params => {
    const { aName, bName, fact } = params;
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    const hapEl = fact.hapElement!;
    const paragraphs: string[] = [];
    const cautions: string[] = [];
    paragraphs.push(
      `${aName}님의 ${iGa(aStem)} ${bName}님의 ${gwaWa(bStem)} 천간합(天干合)을 이뤄요. `
      + `아이들 사이에서 이 합은 이유를 묻기도 전에 이미 친해져 있는 힘으로 나타나요 — 서로의 장난에 가장 먼저 웃어 주는 짝이에요.`,
    );
    paragraphs.push(
      `이 합이 모이면 ${elementKo(hapEl)} 기운으로 화(化)하려 해요. 둘이 어울려 노는 자리마다 ${describeElementMood(hapEl)}가 피어나기 쉬워요.`,
    );
    if (params.hapYongshinOwnerName) {
      paragraphs.push(
        `게다가 그 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapYongshinOwnerName}님 사주가 반기는 기운이라, 신나게 노는 하루하루가 그대로 좋은 영양분이 돼요.`,
      );
    } else if (params.hapGishinOwnerName) {
      cautions.push(
        `합해서 생기는 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapGishinOwnerName}님 사주가 조심스러워하는 기운이기도 해요 — 둘이 만드는 분위기가 과열되지 않게 어른이 한 번씩 들여다봐 주세요.`,
      );
    }
    cautions.push(
      '붙어 있는 시간이 길수록 둘만의 세계가 단단해져요 — 다른 친구들과도 어울릴 자리를 함께 만들어 주면 이 합이 더 건강하게 자라요.',
    );
    return {
      headline: '두 아이의 일간이 천간합으로 끌려요 — 처음 만나도 금세 친해지는 짝이에요.',
      paragraphs,
      cautions,
    };
  },
};

const DAY_STEM_CHUNG: CopyBundleV1<DayStemCopyParamsV1> = {
  default: ({ aName, bName, fact }) => {
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    return {
      headline: '두 분의 일간이 정면으로 마주 보는 충의 자리예요.',
      paragraphs: [
        `${aName}님의 ${gwaWa(aStem)} ${bName}님의 ${eunNeun(bStem)} 천간충(天干沖)의 짝이에요. `
        + `서로의 방식이 정반대라 처음에는 강하게 끌리기도 하지만, 생활에서는 부딪히는 순간이 잦을 수 있어요.`,
        `충은 나쁨의 선고가 아니라 "변화를 여는 힘"이에요. 서로의 다름을 규칙으로 다듬으면, 혼자서는 못 여는 문을 함께 여는 짝이 되기도 해요.`,
      ],
      cautions: ['의견이 갈릴 때 즉답을 피하고 하루 묵혔다 다시 이야기하면 부딪힘이 훨씬 부드러워져요.'],
    };
  },
  couple: ({ aName, bName, fact }) => {
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    return {
      headline: '두 분의 일간이 정면으로 마주 보는 충의 짝이에요 — 뜨거움과 부딪힘이 한 뿌리예요.',
      paragraphs: [
        `${aName}님의 ${gwaWa(aStem)} ${bName}님의 ${eunNeun(bStem)} 천간충(天干沖)의 짝이에요. `
        + `연인 사이의 충은 미지근함과는 거리가 먼 배치예요 — 정반대의 방식에 강하게 끌리면서도, 가까워질수록 부딪히는 순간이 잦아지기 쉬워요.`,
        `다만 충은 이별의 선고가 아니라 서로를 흔들어 깨우는 힘으로 읽어요. 다툼의 열기를 두 사람만의 규칙으로 다듬으면, 혼자서는 못 여는 문을 함께 여는 연인이 되는 쪽이에요.`,
      ],
      cautions: [
        '감정이 달아오른 날의 큰 결정은 하루 재워 두세요 — 식은 뒤에도 같은 마음이라면, 그때 움직여도 늦지 않아요.',
      ],
    };
  },
  companion: ({ aName, bName, fact }) => {
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    return {
      headline: '두 분의 일간이 마주 보는 충의 짝이에요 — 반대라서 서로의 사각을 메워요.',
      paragraphs: [
        `${aName}님의 ${gwaWa(aStem)} ${bName}님의 ${eunNeun(bStem)} 천간충(天干沖)의 짝이에요. `
        + `일하는 방식도 쉬는 방식도 정반대라, 같은 자리에 오래 있으면 부딪히는 순간이 잦기 쉬워요.`,
        `그런데 함께 무언가를 만들 때는 이 반대가 자산이 돼요 — 한쪽이 못 보는 사각을 다른 쪽이 정확히 보고 있는 짝이라, 역할만 나누면 서로의 빈틈을 메우는 동료가 되는 쪽이에요.`,
      ],
      tips: [
        '의견이 갈릴 때는 "누가 맞나" 대신 "각자 뭘 보고 있나"를 먼저 물어 주세요 — 충의 긴장이 검토의 힘으로 바뀌어요.',
      ],
    };
  },
  guardian: params => {
    const { aName, bName, fact } = params;
    const { elder, younger } = guardianRoles(params.voice);
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    return {
      headline: `${gwaWa(elder)} ${younger}의 일간이 마주 보는 충의 자리예요 — 기다림이 손잡이예요.`,
      paragraphs: [
        `${aName}님의 ${gwaWa(aStem)} ${bName}님의 ${eunNeun(bStem)} 천간충(天干沖)의 짝이에요. `
        + `돌봄의 자리에서 이 충은 ${elder}의 방식과 ${younger}의 기질이 정면으로 다른 모양으로 나타나요 — ${iGa(elder)} 옳다고 믿는 길을, ${eunNeun(younger)} 제 방식으로 다시 걸어 보고 싶어 해요.`,
        `다행히 충은 서로를 깨우는 힘이기도 해요. ${younger}의 반대 방식을 틀림이 아니라 다른 답안으로 읽어 주면, 이 배치는 ${eulReul(younger)} 일찍 단단하게 세워 주는 쪽이에요.`,
      ],
      cautions: [
        `${iGa(elder)} 답을 먼저 말하기 전에 ${younger}의 답을 끝까지 들어 봐 주세요 — 그 반 박자의 기다림이 충의 흔들림을 배움으로 바꿔요.`,
      ],
    };
  },
  kids: ({ aName, bName, fact }) => {
    const aStem = stemKo(fact.a);
    const bStem = stemKo(fact.b);
    return {
      headline: '두 아이의 일간이 마주 보는 충의 짝이에요 — 티격태격 속에 배움이 있어요.',
      paragraphs: [
        `${aName}님의 ${gwaWa(aStem)} ${bName}님의 ${eunNeun(bStem)} 천간충(天干沖)의 짝이에요. `
        + `노는 방식이 정반대라 티격태격이 잦기 쉬운 짝이에요 — 그런데 신기하게도, 함께 놀고 난 뒤에는 서로의 노는 법을 하나씩 배워 와요.`,
        `아이들 사이의 충은 미움이 아니라 "너무 달라서 자꾸 신경 쓰이는" 힘이에요. 둘이 어울리는 시간만큼 노는 법이 두 배가 되는 짝으로 읽어요.`,
      ],
      cautions: [
        '다툼이 나면 어른은 심판보다 통역이 되어 주세요 — "쟤는 이래서 그런 거래" 한마디면, 싸움의 절반이 오해였음이 드러나요.',
      ],
    };
  },
};

/** 상생: giver→receiver 역할을 fact.relation에서 푼다. */
function saengRoles(params: DayStemCopyParamsV1) {
  const { aName, bName, fact } = params;
  const aStem = stemKo(fact.a);
  const bStem = stemKo(fact.b);
  const aGives = fact.relation === 'saeng_a_to_b';
  return {
    giver: aGives ? aName : bName,
    receiver: aGives ? bName : aName,
    giverStem: aGives ? aStem : bStem,
    receiverStem: aGives ? bStem : aStem,
  };
}

const DAY_STEM_SAENG: CopyBundleV1<DayStemCopyParamsV1> = {
  default: params => {
    const { giver, receiver, giverStem, receiverStem } = saengRoles(params);
    return {
      headline: `${giver}님의 기운이 ${receiver}님을 살려 주는 상생의 짝이에요.`,
      paragraphs: [
        `${giver}님의 ${iGa(giverStem)} ${receiver}님의 ${eulReul(receiverStem)} 낳고 살리는 상생(相生) 관계예요. `
        + `한쪽이 자연스럽게 베풀고 한쪽이 편안하게 받는 흐름이라, 함께 있을 때 마음이 놓이는 조합이에요.`,
      ],
      tips: [
        `${receiver}님이 받은 만큼을 말과 마음으로 되돌려 주면, 한쪽만 소모되지 않고 흐름이 오래가요.`,
      ],
    };
  },
  couple: params => {
    const { giver, receiver, giverStem, receiverStem } = saengRoles(params);
    return {
      headline: `${giver}님의 기운이 ${receiver}님을 살려 주는, 마음이 놓이는 상생의 짝이에요.`,
      paragraphs: [
        `${giver}님의 ${iGa(giverStem)} ${receiver}님의 ${eulReul(receiverStem)} 낳고 살리는 상생(相生) 관계예요. `
        + `연인 사이에서 이 흐름은 ${giver}님이 먼저 살피고 ${receiver}님이 편안하게 기대는 그림으로 자주 나타나요 — 함께 있으면 이유 없이 마음이 놓이는 쪽이에요.`,
        `주고받음의 방향이 뚜렷한 만큼, 이 사랑이 오래가는 열쇠는 받는 쪽의 화답이에요. ${receiver}님의 "고마워" 한마디가 이 흐름의 연료가 돼요.`,
      ],
      tips: [
        `기념일이 아니어도 ${receiver}님이 먼저 준비하는 날을 가끔 만들어 보세요 — 방향이 한 번씩 뒤집힐 때 상생은 더 깊어져요.`,
      ],
    };
  },
  companion: params => {
    const { giver, receiver, giverStem, receiverStem } = saengRoles(params);
    return {
      headline: `${giver}님이 ${receiver}님의 기운을 밀어 주는, 소모 없는 동반의 짝이에요.`,
      paragraphs: [
        `${giver}님의 ${iGa(giverStem)} ${receiver}님의 ${eulReul(receiverStem)} 낳고 살리는 상생(相生) 관계예요. `
        + `동반의 자리에서 이 흐름은 ${giver}님이 판을 깔고 ${receiver}님이 그 위에서 힘을 내는 그림으로 나타나기 쉬워요.`,
        `밀어주는 쪽과 살아나는 쪽이 자연스럽게 정해져 있는 짝이라, 함께 일을 도모하면 소모전 없이 속도가 붙는 쪽이에요.`,
      ],
      tips: [
        `역할이 굳지 않게, 가끔은 ${receiver}님이 판을 까는 자리를 맡아 보세요 — 주고받음이 순환할 때 이 우정이 오래가요.`,
      ],
    };
  },
  guardian: params => {
    const { giver, receiver, giverStem, receiverStem } = saengRoles(params);
    const { elder, younger } = guardianRoles(params.voice);
    const giverIsElder = params.voice.elderName != null && giver === params.voice.elderName;
    const giverIsYounger = params.voice.youngerName != null && giver === params.voice.youngerName;
    if (giverIsYounger) {
      // 손아래의 기운이 손위를 살리는, 드물고 예쁜 방향.
      return {
        headline: `${giver}님이 ${receiver}님의 기운을 살려 주는, 조금 특별한 상생의 짝이에요.`,
        paragraphs: [
          `${giver}님의 ${iGa(giverStem)} ${receiver}님의 ${eulReul(receiverStem)} 낳고 살리는 상생(相生) 관계인데, 방향이 ${younger}에게서 ${elder} 쪽으로 흘러요. `
          + `이 ${gwaWa(younger)} 함께 있으면 ${elder}의 지친 기운이 차오르는 — ${iGa(younger)} ${elder}의 비타민이 되는 자리예요.`,
        ],
        tips: [
          `받기만 하는 쪽이 되지 않게, ${iGa(elder)} 받은 만큼을 말로 돌려주세요. "네 덕분에 힘이 났어" 한마디가 ${younger}의 뿌리를 깊게 해요.`,
        ],
      };
    }
    if (giverIsElder) {
      return {
        headline: `${giver}님의 기운이 ${receiver}님을 기르는 상생의 자리예요.`,
        paragraphs: [
          `${giver}님의 ${iGa(giverStem)} ${receiver}님의 ${eulReul(receiverStem)} 낳고 살리는 상생(相生) 관계예요. `
          + `${elder}의 기운이 ${eulReul(younger)} 살리는 방향이라, 애써 가르치려 하지 않아도 곁에 있는 시간만큼 ${younger}에게 힘이 스며드는 자리예요.`,
        ],
        tips: [
          `다만 주는 사랑에도 완급이 필요해요 — ${iGa(younger)} 스스로 해낼 몫을 남겨 두는 것까지가 상생이에요.`,
        ],
      };
    }
    // 나이 정보가 없으면 방향만 정직하게 읽는다.
    return {
      headline: `${giver}님의 기운이 ${receiver}님을 살려 주는 상생의 짝이에요.`,
      paragraphs: [
        `${giver}님의 ${iGa(giverStem)} ${receiver}님의 ${eulReul(receiverStem)} 낳고 살리는 상생(相生) 관계예요. `
        + `돌봄이 오가는 자리에서 이 흐름은, 한쪽의 기운이 다른 쪽을 조용히 길러 주는 모양으로 나타나요.`,
      ],
      tips: [
        `받는 쪽이 받은 만큼을 말로 돌려주면, 한쪽만 소모되지 않고 흐름이 오래가요.`,
      ],
    };
  },
  kids: params => {
    const { giver, receiver, giverStem, receiverStem } = saengRoles(params);
    return {
      headline: `${giver}님이 ${receiver}님을 살려 주는, 순하게 흐르는 상생의 짝이에요.`,
      paragraphs: [
        `${giver}님의 ${iGa(giverStem)} ${receiver}님의 ${eulReul(receiverStem)} 낳고 살리는 상생(相生) 관계예요. `
        + `아이들 사이에서는 ${giver}님이 놀이를 이끌고 ${receiver}님이 신나게 올라타는 그림이 자주 나와요. 주는 쪽도 받는 쪽도 자연스러워서, 어른이 끼어들 일이 적은 순한 흐름이에요.`,
      ],
      tips: [
        `다만 늘 같은 쪽이 이끌다 보면 한쪽만 목소리가 커질 수 있어요 — 가끔은 ${receiver}님이 고른 놀이를 하는 날을 만들어 주세요.`,
      ],
    };
  },
};

/** 상극: controller→controlled 역할을 fact.relation에서 푼다. */
function geukRoles(params: DayStemCopyParamsV1) {
  const { aName, bName, fact } = params;
  const aControls = fact.relation === 'geuk_a_to_b';
  return {
    controller: aControls ? aName : bName,
    controlled: aControls ? bName : aName,
  };
}

const DAY_STEM_GEUK: CopyBundleV1<DayStemCopyParamsV1> = {
  default: params => {
    const { controller, controlled } = geukRoles(params);
    return {
      headline: '한쪽이 한쪽을 다듬는 상극의 짝이에요.',
      paragraphs: [
        `${controller}님의 일간이 ${controlled}님의 일간을 극(剋)하는 방향이에요. `
        + `극은 통제와 긴장이지만, 명리에서는 "그릇을 만드는 힘"으로도 읽어요. ${controller}님이 힘을 낮추고 `
        + `${controlled}님이 선을 분명히 하면, 서로를 성장시키는 관계가 될 수 있어요.`,
      ],
      cautions: [
        `${controller}님의 조언이 잦아지면 ${controlled}님에게는 간섭으로 들릴 수 있어요 — 빈도를 줄이고 타이밍을 고르는 게 열쇠예요.`,
      ],
    };
  },
  couple: params => {
    const { controller, controlled } = geukRoles(params);
    return {
      headline: '팽팽한 긴장이 끌림이 되는 상극의 짝이에요 — 말의 세기가 열쇠예요.',
      paragraphs: [
        `${controller}님의 일간이 ${controlled}님의 일간을 극(剋)하는 방향이에요. `
        + `연인 사이의 극은 팽팽한 긴장이면서 강한 끌림이기도 해요 — ${controlled}님은 ${controller}님 앞에서 유난히 신경이 쓰이고, ${controller}님은 자꾸 ${controlled}님을 다듬어 주고 싶어지기 쉬워요.`,
        `명리는 극을 "그릇을 만드는 힘"으로도 읽어요. ${controller}님이 말의 세기를 낮추고 ${controlled}님이 자기 선을 분명히 하면, 서로를 성장시키는 연인이 되는 쪽이에요.`,
      ],
      cautions: [
        `아끼는 마음이 고치려는 말로 자주 나오면 ${controlled}님 쪽에 피로가 고이기 쉬워요 — 조언은 부탁받았을 때 아껴서 건네 주세요.`,
      ],
    };
  },
  companion: params => {
    const { controller, controlled } = geukRoles(params);
    return {
      headline: '기준과 품이 만나는 상극의 짝이에요 — 역할을 나누면 완성도가 올라가요.',
      paragraphs: [
        `${controller}님의 일간이 ${controlled}님의 일간을 극(剋)하는 방향이에요. `
        + `동반의 자리에서 극은 기준이 센 쪽과 맞춰 주는 쪽의 그림으로 나타나기 쉬워요 — ${controller}님이 기준을 세우고 ${controlled}님이 품을 넓히는 짝이에요.`,
        `함께 일을 도모하면 이 긴장이 완성도를 끌어올려요. 검토와 실행처럼 결이 다른 역할을 나눠 맡을 때 특히 손발이 맞는 쪽이에요.`,
      ],
      cautions: [
        `${controller}님의 점검이 잦아지면 ${controlled}님에게는 감시처럼 느껴질 수 있어요 — 점검의 횟수와 때를 미리 정해 두면 우정이 상하지 않아요.`,
      ],
    };
  },
  guardian: params => {
    const { controller, controlled } = geukRoles(params);
    const { elder, younger } = guardianRoles(params.voice);
    const controllerIsElder =
      params.voice.elderName != null && controller === params.voice.elderName;
    const controllerIsYounger =
      params.voice.youngerName != null && controller === params.voice.youngerName;
    if (controllerIsElder) {
      // 손위가 극하는 방향: 다듬는 손이 잔소리가 되지 않게.
      return {
        headline: `${elder}의 기운이 ${eulReul(younger)} 다듬는 방향의 극이에요 — 기다림이 열쇠예요.`,
        paragraphs: [
          `${controller}님의 일간이 ${controlled}님의 일간을 극(剋)하는 방향이에요. `
          + `${iGa(elder)} ${eulReul(younger)} 극하는 배치는 "다듬는 손"의 모양이라, ${eulReul(younger)} 반듯하게 세워 주는 힘이 분명히 있어요. 다만 다듬으려는 마음이 잦아지면, ${younger}에게는 그 손길이 잔소리로 쌓여요.`,
        ],
        cautions: [
          `가르침은 짧게, 기다림은 길게 두세요. ${younger}의 속도를 기다려 주는 만큼 극의 힘은 억누름이 아니라 조각가의 손이 돼요.`,
        ],
      };
    }
    if (controllerIsYounger) {
      return {
        headline: `${younger}의 기세가 ${eulReul(elder)} 극하는, 조금 특별한 방향이에요.`,
        paragraphs: [
          `${controller}님의 일간이 ${controlled}님의 일간을 극(剋)하는, ${iGa(younger)} ${eulReul(elder)} 극하는 방향이에요. `
          + `${younger}의 고집과 기세에 ${iGa(elder)} 자주 물러서게 되는 배치라, 귀엽다가도 문득 버겁게 느껴지는 날이 있을 수 있어요.`,
        ],
        cautions: [
          `물러설 곳과 물러서지 않을 곳을 ${iGa(elder)} 미리 정해 두세요 — 일관된 경계선 안에서라면, 그 기세는 꺾을 것이 아니라 키워 줄 재목이에요.`,
        ],
      };
    }
    return {
      headline: '한쪽이 한쪽을 다듬는 상극의 자리예요 — 완급이 열쇠예요.',
      paragraphs: [
        `${controller}님의 일간이 ${controlled}님의 일간을 극(剋)하는 방향이에요. `
        + `돌봄의 자리에서 극은 다듬는 손의 모양으로 나타나요 — 다듬으려는 마음이 잦아지지 않게, 서로의 속도를 기다려 주는 것이 지혜예요.`,
      ],
      cautions: [
        `${controller}님의 바로잡는 말이 잦아지면 ${controlled}님에게는 억누름으로 남을 수 있어요 — 가르침은 짧게, 칭찬은 길게 두세요.`,
      ],
    };
  },
  kids: params => {
    const { controller, controlled } = geukRoles(params);
    return {
      headline: '한 아이가 놀이의 키를 쥐는 상극의 짝이에요 — 역할 바꾸기가 열쇠예요.',
      paragraphs: [
        `${controller}님의 일간이 ${controlled}님의 일간을 극(剋)하는 방향이에요. `
        + `아이들 사이에서 극은 한 아이가 놀이의 규칙을 정하고 다른 아이가 따라가는 그림으로 자주 나타나요. 잘 흐르면 듬직한 리더와 든든한 친구가 되지만, 세게 흐르면 명령과 눈치가 돼요.`,
      ],
      cautions: [
        `${controller}님이 정한 규칙에 ${controlled}님이 늘 맞추고만 있지 않은지 가끔 들여다봐 주세요 — 역할을 바꿔 노는 날이 이 짝의 균형을 지켜 줘요.`,
      ],
    };
  },
};

const DAY_STEM_BIHWA: CopyBundleV1<DayStemCopyParamsV1> = {
  default: ({ fact }) => ({
    headline: '같은 오행의 일간 — 서로를 가장 잘 이해하는 동류의 짝이에요.',
    paragraphs: [
      `두 분 모두 ${ELEMENT_KO[fact.a.element]} 기운의 일간이에요. 비슷한 결로 세상을 보기에 말이 잘 통하고, `
      + `친구 같은 편안함이 오래가는 조합이에요. 다만 닮은 만큼 양보의 계기가 적을 수 있어요.`,
    ],
    tips: ['역할을 나눠 각자의 영역을 정해 두면, 닮은 기운이 경쟁이 아니라 연대가 돼요.'],
  }),
  couple: ({ fact }) => ({
    headline: '같은 오행의 일간 — 오래된 친구 같은 편안함 위에서 사랑이 자라는 짝이에요.',
    paragraphs: [
      `두 분 모두 ${ELEMENT_KO[fact.a.element]} 기운의 일간이에요. 연인으로 만나면 취향과 속도가 비슷해 말이 잘 통하고, `
      + `애쓰지 않아도 되는 편안함이 관계의 바탕이 되는 쪽이에요.`,
      `다만 닮은 만큼 설렘의 낙차가 작고 양보의 계기도 적기 쉬워요 — 비슷한 두 사람이 같은 것을 동시에 원할 때, 편안함이 문득 경쟁이 되기도 해요.`,
    ],
    tips: ['이끄는 자리를 번갈아 맡아 보세요 — 같은 기운이라도 리드가 바뀌면 관계에 새 바람이 들어요.'],
  }),
  companion: ({ fact }) => ({
    headline: '같은 오행의 일간 — 설명이 짧아도 통하는 동류의 동반자예요.',
    paragraphs: [
      `두 분 모두 ${ELEMENT_KO[fact.a.element]} 기운의 일간이에요. 같은 결로 세상을 보는 동류의 짝이라, `
      + `긴 설명 없이도 통하는 동반자예요 — 어깨를 나란히 하고 걷기에 이만한 배치가 드물어요.`,
      `다만 잘하는 것과 원하는 것까지 닮아 있어서, 같은 자리를 두고 겨루게 되는 날이 있을 수 있어요.`,
    ],
    tips: ['영역을 나눠 각자의 무대를 정해 두세요 — 닮은 기운은 같은 무대에선 경쟁이지만, 다른 무대에선 서로의 가장 좋은 관객이 돼요.'],
  }),
  guardian: params => {
    const { elder, younger } = guardianRoles(params.voice);
    return {
      headline: '같은 오행의 일간 — 마음이 잘 읽히는 만큼, 기다림이 필요한 자리예요.',
      paragraphs: [
        `두 분 모두 ${ELEMENT_KO[params.fact.a.element]} 기운의 일간이에요. 돌봄의 자리에서 동류의 짝은, `
        + `${iGa(elder)} ${younger}의 마음을 자기 일처럼 알아보는 힘으로 나타나요 — "나도 그맘때 그랬지"가 자주 진심인 사이예요.`,
        `다만 너무 잘 알아서 답을 미리 줘 버리기 쉬워요. 같은 길이라도 제 속도로 다시 걸어 보는 것까지가 ${younger}의 성장 몫이에요.`,
      ],
      tips: [
        `${elder}의 경험담은 정답이 아니라 이야기로 들려주세요 — 닮은 기운은 가르침보다 공감으로 건널 때 더 깊게 닿아요.`,
      ],
    };
  },
  kids: ({ aName, bName, fact }) => ({
    headline: '같은 오행의 일간 — 설명 없이 바로 어울리는 닮은꼴 짝이에요.',
    paragraphs: [
      `${aName}님과 ${bName}님 모두 ${ELEMENT_KO[fact.a.element]} 기운의 일간이에요. 좋아하는 놀이도 노는 속도도 닮아서, `
      + `처음 만나도 설명 없이 바로 어울리는 짝이에요 — 같은 것에 동시에 웃는 날이 많아요.`,
      `다만 닮은 만큼 같은 장난감, 같은 역할을 동시에 원하기 쉬워요. 한 번 겨루기가 시작되면 둘 다 물러서지 않는 짝이기도 해요.`,
    ],
    cautions: [
      '차례 정하기 놀이를 미리 익혀 두면 좋아요 — 순서만 정해지면, 닮은 기운은 다툼 대신 두 배의 웃음이 돼요.',
    ],
  }),
};

/* ================================================================== */
/* 일지·년지(branch pair) 번들                                           */
/* ================================================================== */

const BRANCH_NONE: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}에는 특별한 합도 충도 없어요 — 담백하게 만나는 자리예요.`,
    paragraphs: [
      `${pairLabel} 서로 합하지도 부딪히지도 않는 무난한 짝이에요. 강한 끌림 대신, 쌓아 가는 만큼 깊어지는 관계로 읽어요.`,
    ],
  }),
  couple: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}에는 특별한 합도 충도 없어요 — 쌓은 만큼 깊어지는 자리예요.`,
    paragraphs: [
      `${pairLabel} 서로 합하지도 부딪히지도 않는 담백한 짝이에요. 연인 사이에서는 운명적 끌림의 드라마 대신, 함께 보낸 시간과 주고받은 마음이 그대로 관계의 깊이가 되는 배치로 읽어요.`,
      `바꿔 말하면, 이 관계의 온도는 하늘이 아니라 두 분의 손에 쥐어져 있어요 — 들인 마음만큼 정직하게 데워지는 자리예요.`,
    ],
    tips: [
      '둘만의 의식을 하나 만들어 보세요 — 매주 같은 산책길, 같은 메뉴 같은 반복이 이 짝에게는 합을 대신해요.',
    ],
  }),
  companion: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}에는 특별한 합도 충도 없어요 — 시간이 빚는 우정의 자리예요.`,
    paragraphs: [
      `${pairLabel} 서로 합하지도 부딪히지도 않는 담백한 짝이에요. 우정의 자리에서는 오히려 실속 있는 배치예요 — 뜨겁게 붙었다 식는 소란이 없으니, 함께 겪은 일의 목록이 곧 우정의 두께가 돼요.`,
      `첫 만남의 불꽃보다 열 번째 만남의 익숙함이 좋은 짝이라, 서두르지 않아도 돼요.`,
    ],
  }),
  guardian: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}에는 특별한 합도 충도 없어요 — 쌓는 만큼 깊어지는 자리예요.`,
    paragraphs: [
      `${pairLabel} 서로 합하지도 부딪히지도 않는 담백한 짝이에요. 돌봄의 자리에서는 오히려 반가운 배치예요 — 강한 끌림도 강한 부딪힘도 없으니, 함께 보낸 시간과 몸에 밴 습관이 그대로 관계의 깊이가 돼요.`,
      `잠자리 인사, 함께 먹는 아침 같은 매일의 작은 의식이 이 짝에게는 합을 대신해요. 특별한 날보다 반복되는 하루가 이 인연을 기르는 셈이에요.`,
    ],
  }),
  kids: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}에는 특별한 합도 충도 없어요 — 천천히 친해지는 짝이에요.`,
    paragraphs: [
      `${pairLabel} 서로 합하지도 부딪히지도 않는 담백한 짝이에요. 첫날부터 단짝이 되는 유형은 아니지만, 같은 놀이를 반복하며 쌓은 시간만큼 정직하게 가까워져요. 어른이 조바심 내지 않아도 되는 순한 배치예요.`,
    ],
  }),
};

const BRANCH_YUKHAP: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, seatLabel, fact }) => {
    const paragraphs: string[] = [
      `${pairLabel} 육합의 짝이에요. 지지의 합 가운데서도 은근하고 사적인 끌림으로 읽는 합이라, `
      + (seatLabel.includes('배우자')
        ? '배우자 자리끼리 조용히 끌어당기는, 부부 궁합에서 가장 반기는 배치예요.'
        : seatLabel.includes('속마음')
          ? '두 사람의 속마음 자리가 조용히 끌어당기는, 오래 곁에 두게 되는 배치예요.'
          : '두 사람이 자연스럽게 가까워지는 배치예요.'),
    ];
    if (fact.yukhapElement) {
      paragraphs.push(`이 합은 ${elementKo(fact.yukhapElement)} 기운으로 모여요.`);
    }
    return {
      headline: `${seatLabel}가 ${BRANCH_RELATION_KO.yukhap}으로 손을 잡았어요.`,
      paragraphs,
    };
  },
  couple: ({ pairLabel, seatLabel, fact }) => {
    const paragraphs: string[] = [
      `${pairLabel} 육합(六合)의 짝이에요. 연인 사이의 육합은 소란한 불꽃보다 은근한 온기로 나타나요 — 함께 있는 게 그냥 편해서, 하루의 끝에 결국 서로의 곁을 찾게 되는 인연으로 읽어요.`,
    ];
    if (fact.yukhapElement) {
      paragraphs.push(
        `두 글자가 만나면 ${elementKo(fact.yukhapElement)} 기운으로 모여요 — 함께한 시간이 쌓일수록 그 기운의 결이 두 분 사이의 공기가 돼요.`,
      );
    }
    return {
      headline: `${seatLabel}가 육합으로 포개져 있어요 — 조용히 서로를 끌어당기는 배치예요.`,
      paragraphs,
      tips: [
        '말하지 않아도 통한다는 믿음이 이 합의 선물이자 함정이에요 — 중요한 마음일수록 소리 내어 확인해 주면, 이 끌림이 오래가요.',
      ],
    };
  },
  companion: ({ pairLabel, seatLabel, fact }) => {
    const paragraphs: string[] = [
      `${pairLabel} 육합(六合)의 짝이에요. 우정의 자리에서 이 합은 약속하지 않아도 자주 만나게 되는 힘으로 나타나요 — 함께 있으면 애쓰지 않아도 편해서, 시간이 지날수록 서로의 일상에 자연스럽게 자리 잡는 사이예요.`,
    ];
    if (fact.yukhapElement) {
      paragraphs.push(
        `두 글자가 만나면 ${elementKo(fact.yukhapElement)} 기운으로 모여요 — 어울리는 시간이 길수록 그 기운의 결이 짙어져요.`,
      );
    }
    return {
      headline: `${seatLabel}가 육합으로 이어져 있어요 — 곁에 두고 오래가는 우정의 배치예요.`,
      paragraphs,
      tips: [
        '가까움이 당연해지면 고마움이 말줄임표가 되기 쉬워요 — 가끔은 문장으로 돌려주세요.',
      ],
    };
  },
  guardian: ({ pairLabel, seatLabel, fact, voice }) => {
    const { elder, younger } = guardianRoles(voice);
    const paragraphs: string[] = [
      `${pairLabel} 육합의 짝이에요. 돌봄의 자리에서 이 합은 "품이 잘 맞는" 모양으로 나타나요 — ${iGa(younger)} 칭얼거리기 전에 ${iGa(elder)} 먼저 알아채고, ${iGa(elder)} 지친 날에는 ${iGa(younger)} 곁에 와 조용히 앉아 있는, 그런 장면이 자주 생기는 인연이에요.`,
    ];
    if (fact.yukhapElement) {
      paragraphs.push(
        `두 글자가 만나면 ${elementKo(fact.yukhapElement)} 기운으로 모여요 — 하루하루 쌓이는 돌봄의 시간에 그 기운의 온기가 배어들어요.`,
      );
    }
    return {
      headline: `${seatLabel}가 육합으로 이어져 있어요 — 말없이도 마음이 닿는 배치예요.`,
      paragraphs,
      tips: [
        '잘 맞는 만큼 서로를 당연하게 여기기 쉬워요 — 고맙다는 말을 소리 내어 주고받으면 이 합이 오래 따뜻해요.',
      ],
    };
  },
  kids: ({ pairLabel, seatLabel, fact }) => {
    const paragraphs: string[] = [
      `${pairLabel} 육합의 짝이에요. 아이들 사이에서 이 합은 "누가 시키지 않아도 옆자리에 앉는 힘"으로 나타나요. 처음 만나도 금세 어울리고, 한 명이 웃으면 따라 웃는 짝이라 함께 두면 서로의 마음이 편안해져요.`,
    ];
    if (fact.yukhapElement) {
      paragraphs.push(
        `두 글자가 만나면 ${elementKo(fact.yukhapElement)} 기운으로 모여요 — 둘의 놀이 속에 그 기운의 빛깔이 조금씩 스며들어요.`,
      );
    }
    return {
      headline: `${seatLabel}가 육합으로 손을 잡았어요 — 자연스럽게 붙어 다니는 단짝의 배치예요.`,
      paragraphs,
      tips: [
        '너무 붙어 다니다 보면 다른 친구가 끼어들 틈이 좁아질 수 있어요 — 가끔은 여럿이 함께 노는 자리를 만들어 주면 우정의 폭이 넓어져요.',
      ],
    };
  },
};

const BRANCH_SAMHAP: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, seatLabel, fact }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.samhap}으로 손을 잡았어요.`,
    paragraphs: [
      `${pairLabel} 삼합의 짝이에요. 삼합은 뜻과 목표가 같은 방향을 보는 합이라, 함께 무언가를 도모할 때 특히 힘이 나요.`
      + (fact.samhapElement ? ` 두 글자가 모이면 ${elementKo(fact.samhapElement)} 기운의 국(局)을 이루려 해요.` : ''),
    ],
  }),
  couple: ({ pairLabel, seatLabel, fact }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.samhap}으로 같은 곳을 바라봐요.`,
    paragraphs: [
      `${pairLabel} 삼합(三合) 반합의 짝이에요. 삼합은 같은 목표를 향해 뜻이 모이는 합이라, 연인 사이에서는 "함께 그리는 미래"가 유난히 잘 그려지는 배치로 읽어요 — 연애가 길어질수록 오히려 힘이 나는 쪽이에요.`
      + (fact.samhapElement ? ` 두 글자가 모이면 ${elementKo(fact.samhapElement)} 기운의 국(局)을 이루려 해요.` : ''),
    ],
    tips: [
      '두 분의 계획표를 가끔 나란히 펴 보세요 — 같은 곳을 보고 있다는 확인이, 이 합의 가장 큰 연료예요.',
    ],
  }),
  companion: ({ pairLabel, seatLabel, fact }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.samhap}으로 한 팀이 되는 배치예요.`,
    paragraphs: [
      `${pairLabel} 삼합(三合) 반합의 짝이에요. 삼합은 기질보다 뜻이 만나는 합이라, 우정의 자리에서는 같은 목표를 향해 팀이 되는 힘으로 나타나요 — 같이 도모하는 일이 생겼을 때 이 짝의 진가가 드러나요.`
      + (fact.samhapElement ? ` 두 글자가 모이면 ${elementKo(fact.samhapElement)} 기운의 국(局)을 이루려 해요.` : ''),
    ],
    tips: [
      '함께할 작은 프로젝트를 하나 정해 보세요 — 삼합의 짝은 나란히 걷기보다 같은 과녁을 겨눌 때 가까워져요.',
    ],
  }),
  guardian: params => {
    const { pairLabel, seatLabel, fact } = params;
    const { elder, younger } = guardianRoles(params.voice);
    return {
      headline: `${seatLabel}가 ${BRANCH_RELATION_KO.samhap}으로 같은 방향을 봐요.`,
      paragraphs: [
        `${pairLabel} 삼합(三合) 반합의 짝이에요. 돌봄의 자리에서 삼합은 ${gwaWa(elder)} ${iGa(younger)} 같은 방향을 바라보기 쉬운 힘이에요 — ${iGa(elder)} 마음에 둔 길을 ${younger}도 어렵지 않게 제 꿈으로 삼는 배치라, 함께 세우는 계획이 잘 자라요.`
        + (fact.samhapElement ? ` 두 글자가 모이면 ${elementKo(fact.samhapElement)} 기운의 국(局)을 이루려 해요.` : ''),
      ],
      cautions: [
        `방향이 잘 맞는 만큼, 그 꿈이 ${younger}의 것인지 ${elder}의 것인지 가끔 물어봐 주세요 — 스스로 고른 목표일 때 삼합의 힘이 온전히 ${younger}의 것이 돼요.`,
      ],
    };
  },
  kids: ({ pairLabel, seatLabel, fact }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.samhap}으로 한 팀이 되는 짝이에요.`,
    paragraphs: [
      `${pairLabel} 삼합(三合) 반합의 짝이에요. 아이들 사이에서 삼합은 "우리 이거 하자!"가 잘 통하는 힘으로 나타나요 — 블록 성 쌓기든 비밀기지 만들기든, 하나의 목표가 생기면 둘이 한 팀처럼 움직여요.`
      + (fact.samhapElement ? ` 두 글자가 모이면 ${elementKo(fact.samhapElement)} 기운의 국(局)을 이루려 해요.` : ''),
    ],
    tips: [
      '같이 완성할 거리를 쥐여 주면 이 짝은 오래 몰입해요 — 퍼즐 한 판, 그림 한 장처럼 끝이 있는 놀이가 특히 잘 맞아요.',
    ],
  }),
};

const BRANCH_BANGHAP: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.banghap}으로 손을 잡았어요.`,
    paragraphs: [
      `${pairLabel} 같은 계절의 기운이 모이는 방합의 짝이에요. 같은 풍토에서 자란 듯한 익숙함이 있어요.`,
    ],
  }),
  couple: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.banghap}으로 이어져 있어요 — 처음부터 낯설지 않은 짝이에요.`,
    paragraphs: [
      `${pairLabel} 같은 계절의 기운이 모이는 방합(方合)의 짝이에요. 연인 사이의 방합은 처음부터 낯섦이 적은 편안함으로 나타나요 — 같은 동네에서 자란 사람을 만난 듯, 설명 없이 통하는 익숙함이 사랑의 바탕이 되는 쪽이에요.`,
    ],
    tips: [
      '익숙함이 무덤덤함으로 가라앉지 않게, 가끔은 둘 다 처음인 장소로 떠나 보세요 — 같은 계절의 기운은 새 풍경 위에서 더 반짝여요.',
    ],
  }),
  companion: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.banghap}으로 이어져 있어요 — 고향 친구 같은 결의 배치예요.`,
    paragraphs: [
      `${pairLabel} 같은 계절의 기운이 모이는 방합(方合)의 짝이에요. 우정의 자리에서 방합은 말투와 정서의 밑바탕이 비슷한 편안함으로 나타나요 — 오래 알던 고향 친구 같은 결이라, 곁에 두면 소모가 적은 사이예요.`,
    ],
    tips: [
      '결이 비슷한 만큼 새로운 자극은 바깥에서 구해 오면 좋아요 — 각자 겪은 다른 세상 이야기가 이 우정의 좋은 장작이 돼요.',
    ],
  }),
  guardian: params => {
    const { pairLabel, seatLabel } = params;
    const { elder, younger } = guardianRoles(params.voice);
    return {
      headline: `${seatLabel}가 ${BRANCH_RELATION_KO.banghap}으로 이어져 있어요 — 생활의 리듬이 포개지는 자리예요.`,
      paragraphs: [
        `${pairLabel} 같은 계절의 기운이 모이는 방합(方合)의 짝이에요. 돌봄의 자리에서 이 합은 생활의 리듬이 잘 포개지는 힘이에요 — 자고 일어나는 때, 좋아하는 계절과 음식까지 닮아 있기 쉬워, 함께하는 일상이 순하게 흘러가요.`,
      ],
      tips: [
        `리듬이 잘 맞는 만큼, ${younger}의 결이 ${gwaWa(elder)} 다른 대목이 보이면 그건 개성의 싹이에요 — 고치기보다 반겨 주세요.`,
      ],
    };
  },
  kids: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.banghap}으로 이어져 있어요 — 노는 온도가 잘 맞는 짝이에요.`,
    paragraphs: [
      `${pairLabel} 같은 계절의 기운이 모이는 방합(方合)의 짝이에요. 아이들 사이에서 방합은 노는 온도가 비슷한 편안함으로 나타나요 — 뛰고 싶은 날 같이 뛰고, 조용히 그리고 싶은 날 나란히 그리는, 리듬이 잘 맞는 짝이에요.`,
    ],
    tips: [
      '잘 맞아서 조용히 오래 노는 짝이니, 어른은 끼어들기보다 간식만 챙겨 주면 돼요 — 다만 새 친구가 오면 함께 끼워 주는 연습도 시켜 주세요.',
    ],
  }),
};

const BRANCH_MIXED: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, seatLabel, fact }) => {
    const { positives, negatives } = splitBranchRelations(fact.relations);
    const main = positives[0];
    const sub = negatives[0];
    return {
      headline: `${seatLabel}에 ${BRANCH_RELATION_KO[main]}과 ${iGa(BRANCH_RELATION_KO[sub])} 함께 있어요 — 끌림과 어긋남이 공존해요.`,
      paragraphs: [
        `${pairLabel} ${BRANCH_RELATION_KO[main]}으로 가까워지면서도 ${BRANCH_RELATION_KO[sub]}의 긴장을 함께 안은 짝이에요. `
        + `금방 친해지고 깊어지지만, 가까워진 뒤에 사소한 어긋남이 도드라질 수 있는 구성이에요.`,
      ],
      cautions: ['가까울수록 예의와 거리를 조금 남겨 두면, 합의 좋은 면이 오래가요.'],
    };
  },
  couple: ({ pairLabel, seatLabel, fact }) => {
    const { positives, negatives } = splitBranchRelations(fact.relations);
    const main = positives[0];
    const sub = negatives[0];
    return {
      headline: `${seatLabel}에 ${BRANCH_RELATION_KO[main]}과 ${iGa(BRANCH_RELATION_KO[sub])} 함께 있어요 — 깊어질수록 다루는 법이 필요한 짝이에요.`,
      paragraphs: [
        `${pairLabel} ${BRANCH_RELATION_KO[main]}으로 끌어당기면서 ${BRANCH_RELATION_KO[sub]}의 어긋남도 함께 안은 짝이에요. `
        + `연인 사이에서는 금방 깊어지는데, 깊어진 뒤에야 사소한 결의 차이가 보이기 시작하는 순서로 흐르기 쉬워요.`,
        `끌림이 진짜인 만큼 어긋남도 관계의 일부로 받아들이면 돼요 — 합이 이 짝의 바탕이고, 어긋남은 다루는 법을 배우라는 각주예요.`,
      ],
      cautions: [
        '서운한 순간이 오면 "우리가 안 맞나"로 건너뛰지 말아 주세요 — 이 짝의 어긋남은 대개 크기가 아니라 타이밍의 문제라, 말할 때를 고르는 것만으로 절반이 풀려요.',
      ],
    };
  },
  companion: ({ pairLabel, seatLabel, fact }) => {
    const { positives, negatives } = splitBranchRelations(fact.relations);
    const main = positives[0];
    const sub = negatives[0];
    return {
      headline: `${seatLabel}에 ${BRANCH_RELATION_KO[main]}과 ${iGa(BRANCH_RELATION_KO[sub])} 함께 있어요 — 가까움과 어긋남을 같이 쥔 짝이에요.`,
      paragraphs: [
        `${pairLabel} ${BRANCH_RELATION_KO[main]}으로 가까워지면서 ${BRANCH_RELATION_KO[sub]}의 긴장을 함께 안은 짝이에요. `
        + `우정의 자리에서는 금세 절친이 되는데, 가까워진 뒤에 약속·물건·말버릇 같은 작은 데서 어긋남이 도드라지기 쉬워요.`,
        `멀어질 신호가 아니라 거리 조절의 신호로 읽으면 돼요 — 이 짝의 우정은 예의를 남겨 둔 가까움에서 가장 오래가요.`,
      ],
      tips: [
        '빌린 것·맡은 것 같은 작은 약속일수록 또렷하게 해 두세요 — 어긋남의 씨앗을 미리 줍는 습관이 합의 좋은 면만 남겨요.',
      ],
    };
  },
  guardian: params => {
    const { pairLabel, seatLabel, fact } = params;
    const { elder, younger } = guardianRoles(params.voice);
    const { positives, negatives } = splitBranchRelations(fact.relations);
    const main = positives[0];
    const sub = negatives[0];
    return {
      headline: `${seatLabel}에 ${BRANCH_RELATION_KO[main]}과 ${iGa(BRANCH_RELATION_KO[sub])} 함께 있어요 — 잘 맞다가 문득 어긋나는 자리예요.`,
      paragraphs: [
        `${pairLabel} ${BRANCH_RELATION_KO[main]}으로 포개지면서 ${BRANCH_RELATION_KO[sub]}의 어긋남도 함께 안은 짝이에요. `
        + `돌봄의 자리에서는 품이 잘 맞는 날과 사소한 데서 자꾸 걸리는 날이 번갈아 오기 쉬워요.`,
        `${iGa(elder)} 그 낙차를 변덕으로 읽지 않는 것이 먼저예요 — 잘 맞는 날의 모습도, 걸리는 날의 모습도 둘 다 ${younger}의 진짜예요.`,
      ],
      cautions: [
        '어긋난 날엔 그 자리에서 바로잡기보다 하루 재워 두세요 — 합이 바탕인 짝이라, 시간을 주면 스스로 제자리로 돌아오는 힘이 있어요.',
      ],
    };
  },
  kids: ({ pairLabel, seatLabel, fact }) => {
    const { positives, negatives } = splitBranchRelations(fact.relations);
    const main = positives[0];
    const sub = negatives[0];
    return {
      headline: `${seatLabel}에 ${BRANCH_RELATION_KO[main]}과 ${iGa(BRANCH_RELATION_KO[sub])} 함께 있어요 — 단짝과 투닥거림이 한 몸인 짝이에요.`,
      paragraphs: [
        `${pairLabel} ${BRANCH_RELATION_KO[main]}으로 붙어 다니면서 ${BRANCH_RELATION_KO[sub]}의 투닥거림도 함께 안은 짝이에요. `
        + `어제는 세상에 둘도 없는 단짝, 오늘은 토라져서 등을 돌린 짝 — 그 반복이 이 배치의 정상 작동이에요.`,
        `붙어 있는 시간만큼 부딪힐 거리도 생기는 것뿐이라, 크게 걱정할 그림은 아니에요.`,
      ],
      cautions: [
        '싸운 날 억지로 화해시키기보다, 간식 하나를 사이에 두고 잠시 떨어뜨려 놓아 주세요 — 합이 바탕인 짝은 금방 제 발로 다시 붙어요.',
      ],
    };
  },
};

const BRANCH_CHUNG: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, fact }) => {
    const paragraphs: string[] = [
      `${pairLabel} 정면으로 마주 보는 충의 짝이에요. 다만 충은 이별을 확정하는 글자가 아니라 서로를 흔들어 깨우는 힘이기도 해요 — 원국의 다른 글자나 대운의 합이 이 충을 눌러 줄 수도 있어요.`,
    ];
    const nuance = CHUNG_NUANCE[[fact.a.code, fact.b.code].sort().join('+')];
    if (nuance) paragraphs.push(nuance);
    return {
      paragraphs,
      cautions: ['큰 결정은 두 사람의 리듬이 겹치는 때를 골라 천천히 정하면 충의 흔들림이 줄어요.'],
    };
  },
  couple: ({ pairLabel, fact }) => {
    const paragraphs: string[] = [
      `${pairLabel} 정면으로 마주 보는 충(沖)의 짝이에요. 연인 사이의 충은 무관심의 반대말이에요 — 서로에게서 눈을 떼지 못해 흔들리는 자리라, 열정과 다툼이 한 뿌리에서 나와요. 원국의 다른 글자나 대운의 합이 이 충을 눌러 줄 수도 있으니, 선고가 아니라 살필 점으로 읽어 주세요.`,
    ];
    const nuance = CHUNG_NUANCE[[fact.a.code, fact.b.code].sort().join('+')];
    if (nuance) paragraphs.push(nuance);
    return {
      paragraphs,
      cautions: [
        '화해의 절차를 미리 정해 두면 좋아요 — 먼저 연락하는 쪽, 다시 만나는 자리까지 정해 두면, 흔들린 날에도 돌아오는 길을 잃지 않아요.',
      ],
    };
  },
  companion: ({ pairLabel, fact }) => {
    const paragraphs: string[] = [
      `${pairLabel} 정면으로 마주 보는 충(沖)의 짝이에요. 동반의 자리에서 충은 생활 리듬과 일하는 방식이 자주 엇갈리는 모양으로 나타나요 — 다만 그 반대 성향이, 함께 일을 도모할 때는 서로의 사각을 비추는 등불이 되기도 해요.`,
    ];
    const nuance = CHUNG_NUANCE[[fact.a.code, fact.b.code].sort().join('+')];
    if (nuance) paragraphs.push(nuance);
    return {
      paragraphs,
      tips: [
        '늘 붙어 있기보다 각자의 영역을 두고 만나는 우정이 이 짝에게 잘 맞아요 — 적당한 거리가 완충이 되어, 충의 좋은 면만 남아요.',
      ],
    };
  },
  guardian: ({ pairLabel, voice }) => {
    const { elder, younger } = guardianRoles(voice);
    return {
      paragraphs: [
        `${pairLabel} 정면으로 마주 보는 충(沖)의 짝이에요. ${gwaWa(elder)} ${younger} 사이의 충은 "고치려는 마음"과 "제 방식대로 하고 싶은 마음"이 정면으로 만나는 모양이에요. ${younger}의 방식이 ${elder} 눈에 위태로워 보여도, 그 방식 안에서 ${eunNeun(younger)} 자기 힘을 시험하는 중이에요.`,
      ],
      cautions: [
        `바로잡기 전에 한 번 지켜봐 주세요 — ${iGa(elder)} 반 박자 늦게 개입할수록, 충의 흔들림은 ${iGa(younger)} 스스로 크는 동력이 돼요.`,
      ],
    };
  },
  kids: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 정면으로 마주 보는 충(沖)의 짝이에요. 아이들 사이의 충은 미움이 아니라 "서로 너무 신경 쓰여서" 생기는 부딪힘이에요. 노는 방식도 고집도 반대라 자주 티격태격하지만, 그만큼 서로에게서 눈을 떼지 못하는 짝이기도 해요.`,
    ],
    cautions: [
      '승부욕이 달아오르기 전에 어른이 놀이의 규칙을 정해 주세요 — 규칙 안에서라면 충의 힘은 싸움 대신 활력이 돼요.',
    ],
  }),
};

const BRANCH_WONJIN: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 원진의 짝이에요. 뚜렷한 이유 없이 서운함이 쌓이기 쉬운 배치라, 마음을 말로 옮기는 습관이 특히 중요해요.`,
    ],
    cautions: ['서운함은 쌓이기 전에 짧게라도 말로 풀어 주세요 — 원진은 침묵 속에서 자라요.'],
  }),
  couple: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 원진(怨嗔)의 짝이에요. 연인 사이의 원진은 사랑이 식어서가 아니라, 이유를 대기 어려운 서운함이 고여서 마음이 무거워지는 배치예요 — 좋아하는 마음과 서운한 마음이 한 사람 안에 나란히 있을 수 있어요.`,
    ],
    cautions: [
      '"왜 서운한지 설명해 봐"는 이 짝에게 어려운 숙제예요 — 설명을 요구하기보다 "요즘 나한테 서운한 거 있었지" 하고 먼저 알아봐 주는 쪽이 빨라요. 원진은 알아봐 주는 순간부터 얕아져요.',
    ],
  }),
  companion: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 원진(怨嗔)의 짝이에요. 우정의 자리에서 원진은 잘 지내다가도 문득 "쟤 왜 저래" 싶은 순간이 스치는 모양으로 나타나요 — 큰 사건 없이도 마음의 거리가 늘었다 줄었다 하기 쉬워요.`,
    ],
    cautions: [
      '서운함이 스치면 혼자 해석을 쌓지 말고 가볍게 물어봐 주세요 — "아까 그거 무슨 뜻이었어?" 한마디면 될 일이, 침묵 속에선 이야기가 되어 자라요.',
    ],
  }),
  guardian: ({ pairLabel, voice }) => {
    const { elder, younger } = guardianRoles(voice);
    return {
      paragraphs: [
        `${pairLabel} 원진(怨嗔)의 짝이에요. 돌봄의 자리에서 원진은 ${younger} 쪽에 말 못 할 서운함이 고이기 쉬운 모양으로 나타나요. ${eunNeun(elder)} 아무렇지 않게 지나간 한마디가, ${younger} 마음에는 오래 남아 있을 수 있어요.`,
      ],
      cautions: [
        `${iGa(younger)} 먼저 말하기를 기다리기보다, ${iGa(elder)} 먼저 "혹시 서운한 거 있었어?" 하고 물어봐 주세요. 그 물음 한 번에 원진의 그늘이 눈에 띄게 얕아져요.`,
      ],
    };
  },
  kids: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 원진(怨嗔)의 짝이에요. 같이 놀다가 뚜렷한 이유 없이 한쪽이 토라지기 쉬운 배치예요. 왜 삐졌는지 물어봐도 아이 스스로도 말로 옮기지 못할 때가 많아요 — 원진은 원래 "이유를 대기 어려운 서운함"의 글자거든요.`,
    ],
    cautions: [
      '어른이 먼저 화해의 다리를 놓아 주세요. "둘 다 이리 와서 간식 먹자" 한마디면 금방 풀리는 짝이라, 서운함이 밤을 넘기지 않게만 도와주면 돼요.',
    ],
  }),
};

const BRANCH_HYEONG: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 형의 짝이에요. 서로를 다듬으려는 힘이 작용해, 잔소리와 기 싸움이 생기기 쉽지만 그만큼 서로를 성장시키기도 해요.`,
    ],
  }),
  couple: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 형(刑)의 짝이에요. 연인 사이의 형은 서로를 더 나은 모습으로 다듬고 싶은 마음으로 나타나요 — 애정과 잔소리가 한 입에서 나오기 쉬운 자리예요.`,
    ],
    cautions: [
      '고치고 싶은 점이 보이면 하나만 골라 부탁의 말로 건네 보세요 — 형의 힘은 지적이 아니라 부탁의 문장에 실릴 때, 관계를 다듬는 손이 돼요.',
    ],
  }),
  companion: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 형(刑)의 짝이에요. 우정의 자리에서 형은 서로의 방식에 자꾸 훈수를 두게 되는 모양으로 나타나요 — 아끼는 마음의 다른 얼굴이지만, 쌓이면 기 싸움이 되기 쉬워요.`,
    ],
    cautions: [
      '훈수를 두기 전에 "듣고 싶어?" 하고 한 번 물어봐 주세요 — 허락받은 조언만 건네는 것만으로도, 형의 긴장이 배움의 긴장으로 바뀌어요.',
    ],
  }),
  guardian: params => {
    const { pairLabel } = params;
    const { elder, younger } = guardianRoles(params.voice);
    return {
      paragraphs: [
        `${pairLabel} 형(刑)의 짝이에요. 돌봄의 자리에서 형은 바르게 세우려는 마음이 앞서는 모양으로 나타나요 — ${elder}의 눈에는 고쳐 줄 대목부터 들어오기 쉽고, ${eunNeun(younger)} 그 손길이 잦아질수록 어깨가 움츠러들 수 있어요.`,
      ],
      cautions: [
        '하루에 하나만 고치기로 정해 보세요 — 나머지를 눈감아 주는 여백에서, 형의 다듬는 힘이 미움 없이 스며들어요.',
      ],
    };
  },
  kids: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 형(刑)의 짝이에요. 아이들 사이에서 형은 "그게 아니야, 이렇게 하는 거야" 하고 서로의 놀이에 참견하고 싶어지는 모양으로 나타나요 — 둘 다 지려 하지 않아 목소리가 커지는 날도 있지만, 그만큼 서로에게서 배워 오는 것도 많은 짝이에요.`,
    ],
    cautions: [
      '서로 고치려 들며 자주 다투기 쉬운 짝이에요 — 어른이 각자의 잘하는 것을 짚어 주면 다툼이 배움으로 바뀌어요.',
    ],
  }),
};

const BRANCH_JAHYEONG: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ fact }) => ({
    paragraphs: [
      `두 분이 같은 ${branchKo(fact.a)} 글자를 갖고 있어 자형이 성립해요. 서로의 약점을 거울처럼 비추는 짝이라, 닮은 부분에서 오히려 예민해질 수 있어요.`,
    ],
  }),
  couple: ({ fact }) => ({
    paragraphs: [
      `두 분이 같은 ${branchKo(fact.a)} 글자를 갖고 있어 자형(自刑)이 성립해요. 연인 사이의 자형은 서로가 서로의 거울이 되는 배치예요 — 내 안에서 마음에 안 드는 구석을 상대에게서 발견할 때, 유난히 예민해지기 쉬워요.`,
    ],
    cautions: [
      '상대의 어떤 모습에 유독 마음이 걸리면, 그게 내 모습이기도 한지 먼저 들여다봐 주세요 — 거울인 걸 아는 순간, 자형은 다툼거리가 아니라 서로를 이해하는 지름길이 돼요.',
    ],
  }),
  companion: ({ fact }) => ({
    paragraphs: [
      `두 분이 같은 ${branchKo(fact.a)} 글자를 갖고 있어 자형(自刑)이 성립해요. 닮은 약점을 나눠 가진 짝이라, 우정의 자리에서는 서로를 누구보다 잘 이해하면서도 같은 대목에서 나란히 무너지기 쉬워요.`,
    ],
    tips: [
      '둘 다 늘어지는 날엔 서로를 탓하기보다 바깥의 장치를 빌려 오세요 — 마감을 함께 정하거나 다른 친구를 끼우면, 닮은 약점이 서로를 붙드는 핑계가 되지 않아요.',
    ],
  }),
  guardian: params => {
    const { elder, younger } = guardianRoles(params.voice);
    return {
      paragraphs: [
        `${gwaWa(elder)} ${iGa(younger)} 같은 ${branchKo(params.fact.a)} 글자를 갖고 있어 자형(自刑)이 성립해요. 돌봄의 자리에서 자형은, ${iGa(elder)} 자기 안에서 익히 아는 약점을 ${younger}에게서 먼저 알아보는 모양으로 나타나요 — 그래서 더 마음이 쓰이고, 그래서 더 목소리가 커지기 쉬워요.`,
      ],
      cautions: [
        `그 대목을 나무라게 될 때 잠깐 멈춰 주세요 — ${younger}에게 필요한 건 같은 약점을 먼저 겪어 본 사람의 공감이지, 그 약점을 향한 두 배의 꾸중이 아니에요.`,
      ],
    };
  },
  kids: ({ aName, bName, fact }) => ({
    paragraphs: [
      `${aName}님과 ${bName}님이 같은 ${branchKo(fact.a)} 글자를 갖고 있어 자형(自刑)이 성립해요. 아이들 사이에서 자형은 닮은 고집이 같은 순간에 튀어나오는 모양으로 나타나요 — 평소엔 쌍둥이처럼 잘 놀다가, 한 번 뾰족해지면 둘이 동시에 뾰족해지는 짝이에요.`,
    ],
    cautions: [
      '둘이 같이 달아오르면 둘 다 멈추기 어려워요 — 어른이 잠깐 자리를 바꿔 주거나 놀이를 갈아 끼워 주면, 닮은 기운이 다시 웃음 쪽으로 흘러가요.',
    ],
  }),
};

const BRANCH_GWIMUN: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 귀문의 짝이에요. 서로에게 예민하게 반응하고 깊이 몰입하는 배치라, 애착이 강해지는 만큼 감정 기복도 함께 커질 수 있어요.`,
    ],
  }),
  couple: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 귀문(鬼門)의 짝이에요. 연인 사이의 귀문은 깊은 몰입으로 나타나요 — 서로의 표정 하나, 말끝 하나까지 읽어 내는 예민한 안테나가 서로를 향해 켜져 있는 배치예요. 교감이 깊은 만큼, 작은 신호를 크게 해석해 마음이 출렁이는 날도 있기 쉬워요.`,
    ],
    cautions: [
      '상대의 기분을 넘겨짚었다면 정답 확인을 미루지 마세요 — "지금 나 때문에 그런 거야?" 한 번의 확인이, 귀문의 상상력이 지어내는 이야기보다 언제나 짧고 정확해요.',
    ],
  }),
  companion: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 귀문(鬼門)의 짝이에요. 우정의 자리에서 귀문은 통하는 날엔 밤새 대화가 끊이지 않는 깊은 교감으로, 어긋난 날엔 상대의 말을 오래 곱씹게 되는 예민함으로 나타나요 — 얕게 사귀기 어려운, 결이 깊은 짝이에요.`,
    ],
    tips: [
      '곱씹기 시작한 말이 있으면 사흘을 넘기지 말고 물어봐 주세요 — 이 짝의 오해는 대화 한 번이면 풀리는데, 혼자 두면 이야기가 되어 자라요.',
    ],
  }),
  guardian: params => {
    const { pairLabel } = params;
    const { elder, younger } = guardianRoles(params.voice);
    return {
      paragraphs: [
        `${pairLabel} 귀문(鬼門)의 짝이에요. 돌봄의 자리에서 귀문은 서로의 기분에 민감하게 물드는 모양으로 나타나요 — ${elder}의 한숨을 ${iGa(younger)} 제 탓으로 읽기도 하고, ${younger}의 뒤척임에 ${elder}의 마음이 밤새 따라 뒤척이기도 해요.`,
      ],
      cautions: [
        `기분이 서로에게 물드는 짝일수록 ${elder} 쪽의 날씨 관리가 먼저예요 — "오늘 내가 좀 피곤한 건 네 탓이 아니야" 한마디가 ${younger}의 안테나를 쉬게 해 줘요.`,
      ],
    };
  },
  kids: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 귀문(鬼門)의 짝이에요. 아이들 사이에서 귀문은 상상 놀이가 유난히 잘 통하는 힘으로 나타나요 — 둘만의 세계에 깊이 빠져드는 짝이라, 노는 모습이 한 편의 이야기 같아요. 다만 몰입이 깊은 만큼, 놀이가 끝나는 순간 마음이 쉽게 상하기도 해요.`,
    ],
    cautions: [
      '놀이를 끝낼 땐 미리 예고해 주세요 — "십 분 뒤에 정리하자"의 한마디가, 깊이 빠진 둘을 부드럽게 현실로 데려와요.',
    ],
  }),
};

const BRANCH_HAE_PA: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, relation }) =>
    relation === 'pa'
      ? {
          paragraphs: [
            `${pairLabel} 파의 짝이에요. 맞물린 일이 어긋나기 쉬운 배치라, 약속과 마무리를 한 번 더 챙기면 좋아요.`,
          ],
        }
      : {
          paragraphs: [
            `${pairLabel} 해의 짝이에요. 은근히 엇갈리는 순간이 있는 배치라, 오해가 쌓이기 전에 확인하는 습관이 도움이 돼요.`,
          ],
        },
  couple: ({ pairLabel, relation }) =>
    relation === 'pa'
      ? {
          paragraphs: [
            `${pairLabel} 파(破)의 짝이에요. 연인 사이의 파는 함께 세운 계획이 마무리 앞에서 어그러지기 쉬운 모양으로 나타나요 — 마음이 어긋나는 게 아니라 일이 어긋나는 자리라, 크게 겁낼 글자는 아니에요.`,
          ],
          tips: [
            '둘의 약속에는 마침표 담당을 정해 두세요 — 예약 확인, 일정 리마인드 같은 마무리의 한 수가 파의 어긋남을 대부분 걷어 가요.',
          ],
        }
      : {
          paragraphs: [
            `${pairLabel} 해(害)의 짝이에요. 연인 사이의 해는 은근한 엇갈림으로 나타나요 — 챙겨 준다는 것이 부담이 되고, 배려한다는 것이 서운함이 되는, 마음과 전달이 어긋나는 순간이 있기 쉬워요.`,
          ],
          tips: [
            '주고 싶은 마음이 생기면 상대가 받고 싶은 방식을 먼저 물어봐 주세요 — 해의 엇갈림은 마음의 문제가 아니라 번역의 문제일 때가 많아요.',
          ],
        },
  companion: ({ pairLabel, relation }) =>
    relation === 'pa'
      ? {
          paragraphs: [
            `${pairLabel} 파(破)의 짝이에요. 우정의 자리에서 파는 같이 도모한 일이 막판에 헐거워지기 쉬운 모양으로 나타나요 — 마음이 변한 게 아니라 손발의 아귀가 어긋나는 자리예요.`,
          ],
          tips: [
            '역할과 마감을 처음에 문장으로 적어 두세요 — 적어 둔 약속은 파가 흔들어도 제자리에 남아요.',
          ],
        }
      : {
          paragraphs: [
            `${pairLabel} 해(害)의 짝이에요. 우정의 자리에서 해는 호의가 어긋나 닿는 모양으로 나타나요 — 도와준다는 것이 참견이 되고, 사양한다는 것이 거절로 들리는 순간이 있기 쉬워요.`,
          ],
          tips: [
            '어긋난 기색이 느껴지면 해석 대신 확인을 골라 주세요 — "혹시 아까 그거 불편했어?" 한마디가 해의 매듭을 미리 풀어요.',
          ],
        },
  guardian: params => {
    const { pairLabel, relation } = params;
    const { elder, younger } = guardianRoles(params.voice);
    if (relation === 'pa') {
      return {
        paragraphs: [
          `${pairLabel} 파(破)의 짝이에요. 돌봄의 자리에서 파는 세워 둔 규칙과 일과가 자꾸 흐트러지는 모양으로 나타나요 — ${younger}의 마음이 엇나가는 게 아니라 일의 아귀가 어긋나는 것이니, 의지의 문제로 읽지 않아 주세요.`,
        ],
        tips: [
          '규칙은 줄이고, 남긴 것만 단단히 지켜 주세요 — 적은 약속을 확실히 지키는 반복이, 파의 헐거움을 메우는 가장 순한 길이에요.',
        ],
      };
    }
    return {
      paragraphs: [
        `${pairLabel} 해(害)의 짝이에요. 돌봄의 자리에서 해는 위하는 마음이 어긋나 닿는 모양으로 나타나요 — ${elder}의 챙김이 ${younger}에게는 간섭으로, ${younger}의 사양이 ${elder}에게는 거리 두기로 읽히는 순간이 있기 쉬워요.`,
      ],
      cautions: [
        '챙기기 전에 한 번 물어봐 주세요 — "이거 도와줄까, 혼자 해 볼래?"의 선택지가 해의 엇갈림을 절반으로 줄여요.',
      ],
    };
  },
  kids: ({ pairLabel, relation }) =>
    relation === 'pa'
      ? {
          paragraphs: [
            `${pairLabel} 파(破)의 짝이에요. 아이들 사이에서 파는 같이 시작한 놀이가 끝까지 가지 못하고 흩어지기 쉬운 모양으로 나타나요 — 싫어져서가 아니라 손발이 안 맞아서인 날이 대부분이에요.`,
          ],
          tips: [
            '끝이 짧은 놀이를 여러 판 하는 쪽이 이 짝에게 잘 맞아요 — 한 판이 짧으면, 어긋나기 전에 완성의 기쁨이 먼저 와요.',
          ],
        }
      : {
          paragraphs: [
            `${pairLabel} 해(害)의 짝이에요. 아이들 사이에서 해는 호의가 엇갈리는 모양으로 나타나요 — 빌려준다는 것이 뺏는 것으로, 도와준다는 것이 끼어드는 것으로 보여서 토라지는 순간이 생기기 쉬워요.`,
          ],
          cautions: [
            '다툼이 나면 어른이 두 아이의 마음을 통역해 주세요 — "쟤는 너 도와주려던 거래" 한마디에, 엇갈렸던 호의가 제 이름을 찾아요.',
          ],
        },
};

/* ================================================================== */
/* 십성(ten_god) 번들                                                   */
/* ================================================================== */

/** 성인 공통 골격: 상호 십성 문장 + (couple 한정) 배우자성 문장 + 완급 주의. */
function tenGodAdult(params: TenGodCopyParamsV1, coupleTone: boolean): CopyBlockV1 {
  const { aName, bName, bForA, aForB } = params;
  const paragraphs: string[] = [
    `${aName}님에게 ${bName}님은 ${TEN_GOD_KO[bForA]}(${TEN_GOD_RELATIONAL_GLOSS[bForA]})이고, `
    + `${bName}님에게 ${aName}님은 ${TEN_GOD_KO[aForB]}(${TEN_GOD_RELATIONAL_GLOSS[aForB]})이에요.`,
  ];
  // 배우자성(재성·관성) 문장은 성인 연애·부부 프레임에서만 —
  // 우정·가족·아이의 짝에 배우자의 별을 세는 것은 명리적으로도 무리다.
  if (coupleTone) {
    if (params.aGender === 'male' && (bForA === 'JEONG_JAE' || bForA === 'PYEON_JAE')) {
      paragraphs.push(
        `고전 명리에서 남성에게 재성은 배우자의 별이에요 — ${bName}님이 바로 그 자리에 있어요.`,
      );
    }
    if (params.aGender === 'female' && (bForA === 'JEONG_GWAN' || bForA === 'PYEON_GWAN')) {
      paragraphs.push(
        `고전 명리에서 여성에게 관성은 배우자의 별이에요 — ${bName}님이 바로 그 자리에 있어요.`,
      );
    }
    if (params.bGender === 'male' && (aForB === 'JEONG_JAE' || aForB === 'PYEON_JAE')) {
      paragraphs.push(
        `고전 명리에서 남성에게 재성은 배우자의 별이에요 — ${aName}님이 바로 그 자리에 있어요.`,
      );
    }
    if (params.bGender === 'female' && (aForB === 'JEONG_GWAN' || aForB === 'PYEON_GWAN')) {
      paragraphs.push(
        `고전 명리에서 여성에게 관성은 배우자의 별이에요 — ${aName}님이 바로 그 자리에 있어요.`,
      );
    }
  }
  const cautions: string[] = [];
  if (bForA === 'GYEOB_JAE' || aForB === 'GYEOB_JAE') {
    cautions.push('겁재의 짝은 돈과 소유의 경계가 흐려지기 쉬워요 — 금전 약속은 처음부터 분명하게 정해 두세요.');
  }
  if (bForA === 'SANG_GWAN' || aForB === 'SANG_GWAN') {
    cautions.push('상관의 짝은 말이 날카로워지는 순간을 조심하면, 그 재기발랄함이 관계의 활력이 돼요.');
  }
  return { paragraphs, cautions };
}

const TEN_GOD_PAIR: CopyBundleV1<TenGodCopyParamsV1> = {
  default: params => tenGodAdult(params, false),
  couple: params => tenGodAdult(params, true),
  companion: params => {
    const { aName, bName, bForA, aForB } = params;
    const cautions: string[] = [];
    if (bForA === 'GYEOB_JAE' || aForB === 'GYEOB_JAE') {
      cautions.push(
        '겁재의 짝은 내 것과 네 것의 경계가 흐려지기 쉬워요 — 돈과 물건의 약속만 처음부터 분명히 해 두면, 승부욕은 서로를 키우는 좋은 연료가 돼요.',
      );
    }
    if (bForA === 'SANG_GWAN' || aForB === 'SANG_GWAN') {
      cautions.push(
        '상관의 짝은 농담이 정곡을 찌르는 날이 있어요 — 재치가 날이 되지 않게 놀림의 선을 서로 일러 두면, 그 입담이 우정의 활력이 돼요.',
      );
    }
    return {
      headline: '서로를 어떤 동반자로 세워 주는가 — 십성으로 읽었어요.',
      paragraphs: [
        '동반의 짝에서 십성은 점수를 매기는 잣대가 아니에요 — 서로가 서로를 어떤 자리에 세워 주는 친구인지 읽는 언어예요.',
        `${aName}님에게 ${bName}님은 ${TEN_GOD_KO[bForA]}(${TEN_GOD_RELATIONAL_GLOSS[bForA]})이고, `
        + `${bName}님에게 ${aName}님은 ${TEN_GOD_KO[aForB]}(${TEN_GOD_RELATIONAL_GLOSS[aForB]})이에요.`,
      ],
      cautions,
    };
  },
  guardian: params => {
    const { aName, bName, bForA, aForB } = params;
    const { elder, younger } = guardianRoles(params.voice);
    const cautions: string[] = [];
    if (bForA === 'GYEOB_JAE' || aForB === 'GYEOB_JAE') {
      cautions.push(
        `겹치는 자리에서 고집이 맞설 수 있어요 — ${younger}에게 양보를 가르치기 전에, ${iGa(elder)} 먼저 양보하는 모습을 보여 주는 것이 빠른 길이에요.`,
      );
    }
    if (bForA === 'SANG_GWAN' || aForB === 'SANG_GWAN') {
      cautions.push(
        `${younger}의 말이 당돌하게 들리는 날이 있어요 — 버릇없음으로 누르기보다 표현력으로 받아 주면, 상관의 날카로움이 재능이 돼요.`,
      );
    }
    return {
      headline: '서로가 서로를 기르는 십성의 자리예요.',
      paragraphs: [
        '돌봄의 짝에서 십성은 잘 맞고 안 맞고의 잣대가 아니라, 서로를 어떤 존재로 길러 주는가의 언어로 읽어요.',
        `${aName}님에게 ${bName}님은 ${TEN_GOD_KO[bForA]}(${TEN_GOD_GUARDIAN_GLOSS[bForA]})이고, `
        + `${bName}님에게 ${aName}님은 ${TEN_GOD_KO[aForB]}(${TEN_GOD_GUARDIAN_GLOSS[aForB]})이에요.`,
      ],
      cautions,
    };
  },
  kids: params => {
    const { aName, bName, bForA, aForB } = params;
    const cautions: string[] = [];
    if (bForA === 'GYEOB_JAE' || aForB === 'GYEOB_JAE') {
      cautions.push(
        '승부가 붙기 쉬운 짝이에요 — 이긴 날보다 함께 논 날을 칭찬해 주면, 맞수가 단짝이 돼요.',
      );
    }
    if (bForA === 'SANG_GWAN' || aForB === 'SANG_GWAN') {
      cautions.push(
        '말이 빨라지다 서로에게 상처 주는 순간이 올 수 있어요 — "그 말은 아팠겠다"를 먼저 헤아리게 도와주세요.',
      );
    }
    return {
      headline: '서로를 어떤 친구로 만들어 주는가 — 십성으로 읽었어요.',
      paragraphs: [
        '아이들의 짝에서 십성은 "서로를 어떤 친구로 만들어 주는가"의 언어로 읽어요.',
        `${aName}님에게 ${bName}님은 ${TEN_GOD_KO[bForA]}(${TEN_GOD_KIDS_GLOSS[bForA]})이고, `
        + `${bName}님에게 ${aName}님은 ${TEN_GOD_KO[aForB]}(${TEN_GOD_KIDS_GLOSS[aForB]})이에요.`,
      ],
      cautions,
    };
  },
};

/* ================================================================== */
/* 용신 교차(yongshin) 번들 — 방향별(주는 쪽→받는 쪽) 카피                  */
/* ================================================================== */

const YONGSHIN_DIRECT: CopyBundleV1<YongshinCopyParamsV1> = {
  default: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간이 ${receiverName}님 사주가 반기는 ${elementKo(fact.yongshinElement)} 기운 그 자체예요. `
      + `함께 있는 것만으로 ${receiverName}님의 부족한 기운이 채워지는, 용신 궁합에서 으뜸으로 치는 배치예요.`,
    ],
  }),
  couple: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간이 ${receiverName}님 사주가 반기는 ${elementKo(fact.yongshinElement)} 기운 그 자체예요. `
      + `연인 사이에서 이 배치는 "곁에 있으면 이상하게 기운이 나는 사람"으로 나타나요 — 함께 보내는 시간 자체가 ${receiverName}님의 빈 곳을 채우는, 용신 궁합에서 으뜸으로 치는 그림이에요.`,
    ],
    tips: [
      `채워 주는 쪽도 사람이라 연료가 필요해요 — ${receiverName}님이 받은 온기를 말과 표현으로 자주 돌려주면, 이 흐름이 한쪽의 소모 없이 오래가요.`,
    ],
  }),
  companion: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간이 ${receiverName}님 사주가 반기는 ${elementKo(fact.yongshinElement)} 기운 그 자체예요. `
      + `동반의 자리에서 이 배치는 "만나고 오면 이상하게 힘이 나는 친구"로 나타나요 — 특별한 일을 하지 않아도, 곁에 있는 시간만큼 ${receiverName}님의 기운이 차오르는 그림이에요.`,
    ],
    tips: [
      `지칠 때 먼저 찾게 되는 쪽이 늘 같을 수 있어요 — ${receiverName}님이 가끔 먼저 안부를 건네면, 이 우정의 흐름이 한쪽으로 기울지 않아요.`,
    ],
  }),
  guardian: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간이 ${receiverName}님 사주가 반기는 ${elementKo(fact.yongshinElement)} 기운 그 자체예요. `
      + `돌봄의 자리에서 이보다 든든한 배치는 드물어요 — 특별한 무언가를 해 주지 않아도, 곁에 있어 주는 시간 자체가 ${receiverName}님의 빈 곳을 채워요.`,
    ],
  }),
  kids: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님은 ${receiverName}님 사주가 반기는 ${elementKo(fact.yongshinElement)} 기운을 일간에 그대로 품고 있어요. `
      + `이 친구와 놀고 온 날 ${receiverName}님의 표정이 유난히 밝다면 그게 바로 이 배치의 힘이에요 — 곁에 있는 것만으로 기운이 차오르는 친구예요.`,
    ],
  }),
};

const YONGSHIN_GENERATES: CopyBundleV1<YongshinCopyParamsV1> = {
  default: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간(${fact.partnerDayElement ? elementKo(fact.partnerDayElement) : ''} 기운)이 `
      + `${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 낳아 살려 줘요.`,
    ],
  }),
  couple: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간${fact.partnerDayElement ? `(${elementKo(fact.partnerDayElement)} 기운)` : ''}이 `
      + `${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 낳아 살려 줘요. 연인 사이에서 이 흐름은 직접 채워 주기보다 살아나게 돕는 모양이에요 — ${giverName}님과 함께한 뒤에 ${receiverName}님의 일이 이상하게 잘 풀리는, 한 다리 건너 스며드는 응원의 배치예요.`,
    ],
    tips: [
      `직접 주는 사랑보다 티가 덜 나는 흐름이라, 고마움도 늦게 발견되기 쉬워요 — ${receiverName}님이 "네 덕분이야"를 소리 내어 주면 이 배치가 제 빛을 찾아요.`,
    ],
  }),
  companion: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간${fact.partnerDayElement ? `(${elementKo(fact.partnerDayElement)} 기운)` : ''}이 `
      + `${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 낳아 살려 줘요. 동반의 자리에서 이 흐름은 판을 깔아 주는 우정이에요 — ${giverName}님이 곁에 있으면 ${receiverName}님에게 좋은 기회와 좋은 컨디션이 따라오기 쉬운 배치예요.`,
    ],
    tips: [
      '이 흐름은 은은해서 당사자들도 모르고 지나가기 쉬워요 — 잘 풀린 날 "네 덕도 있다"고 짚어 주는 습관이 이 우정의 온도를 지켜 줘요.',
    ],
  }),
  guardian: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간${fact.partnerDayElement ? `(${elementKo(fact.partnerDayElement)} 기운)` : ''}이 `
      + `${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 낳아 살려 줘요. 돌봄의 자리에서 이 흐름은 조용한 뒷바라지의 모양이에요 — 눈에 띄게 해 주는 것이 없어도, ${giverName}님이 곁에 있는 시간만큼 ${receiverName}님이 반기는 기운이 은은하게 자라나요.`,
    ],
    tips: [
      '은은한 흐름일수록 꾸준함이 힘이에요 — 특별한 이벤트보다, 매일 반복되는 짧은 시간이 이 배치를 가장 잘 살려요.',
    ],
  }),
  kids: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간${fact.partnerDayElement ? `(${elementKo(fact.partnerDayElement)} 기운)` : ''}이 `
      + `${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 낳아 살려 줘요. 아이들 사이에서 이 흐름은 "같이 놀면 좋은 것들이 따라오는 친구"로 나타나요 — ${giverName}님과 어울리고 난 뒤 ${receiverName}님이 새로 배워 오는 게 하나씩 늘어나기 쉬워요.`,
    ],
    tips: [
      '어른이 억지로 붙여 주지 않아도 되는 순한 흐름이에요 — 둘이 어울릴 자리만 가끔 마련해 주면, 나머지는 기운이 알아서 해요.',
    ],
  }),
};

const YONGSHIN_CONTROLS: CopyBundleV1<YongshinCopyParamsV1> = {
  default: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 누르는 쪽이에요. `
      + `함께 있을 때 ${receiverName}님의 기운이 눌리지 않도록 혼자만의 회복 시간을 존중해 주는 게 좋아요.`,
    ],
  }),
  couple: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 누르는 쪽이에요. `
      + `마음의 문제가 아니라 기운의 결이 그런 것이니, 애정을 의심할 대목은 아니에요 — 다만 오래 붙어 있는 날 ${receiverName}님이 이유 없이 지치는 느낌을 받을 수 있어요.`,
    ],
    tips: [
      '함께 있으면서도 각자인 시간을 설계해 보세요 — 같은 공간에서 따로 책을 읽는 저녁 같은 헐거운 동행이, 이 배치의 애정을 오래 지켜 줘요.',
    ],
  }),
  companion: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 누르는 쪽이에요. `
      + `사이가 나빠서가 아니라 기운의 결이 그런 것이라, 오래 함께한 날 ${receiverName}님이 먼저 방전되기 쉬운 배치로만 읽으면 돼요.`,
    ],
    tips: [
      '길게 한 번보다 짧게 자주 만나는 쪽이 이 우정에 잘 맞아요 — 헤어진 뒤 각자 충전하는 시간까지가 이 짝의 만남이에요.',
    ],
  }),
  guardian: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 누르는 쪽이에요. `
      + `마음은 살뜰해도 기운의 결이 그런 것이니, 자책할 일도 서운해할 일도 아니에요. ${receiverName}님에게 혼자 숨 고르는 시간을 넉넉히 허락해 주는 것 — 그것이 이 배치를 살리는 돌봄이에요.`,
    ],
  }),
  kids: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 누르는 쪽이에요. `
      + `오래 붙어 논 날 ${receiverName}님이 유난히 지쳐 보일 수 있는 배치라, 노는 시간 사이사이 각자 쉬는 틈을 만들어 주면 좋아요. 짧게 자주 만나는 쪽이 이 짝에게는 더 잘 맞아요.`,
    ],
  }),
};

const YONGSHIN_NEUTRAL: CopyBundleV1<YongshinCopyParamsV1> = {
  default: ({ giverName, receiverName }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님의 용신과 직접 닿지는 않아요 — 무해하지만 특별히 채워 주지도 않는 담백한 관계예요.`,
    ],
  }),
  couple: ({ giverName, receiverName }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님의 용신과 직접 닿지는 않아요. 기운으로 채워 주는 극적인 배치는 아니지만, 눌러 버리는 부담도 없는 담백한 흐름이에요 — 연인 사이라면 기운의 도움 없이도 마음이 하는 일이 많으니, 담담한 바탕 위에 두 분의 이야기를 쌓으면 돼요.`,
    ],
  }),
  companion: ({ giverName, receiverName }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님의 용신과 직접 닿지는 않아요. 서로의 기운에 크게 관여하지 않는 담백한 흐름이라, 우정의 자리에서는 오히려 편한 배치예요 — 기운의 셈 없이, 마음이 맞는 만큼이 곧 우정의 크기가 돼요.`,
    ],
  }),
  guardian: ({ giverName, receiverName }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님의 용신과 직접 닿지는 않아요. 기운이 채워 주지도 누르지도 않는 담백한 자리라, 돌봄의 무게를 기운의 탓으로 돌릴 일도 없는 배치예요 — 함께 쌓는 습관과 말이 그대로 관계의 살이 돼요.`,
    ],
  }),
  kids: ({ giverName, receiverName }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님의 용신과 직접 닿지는 않아요. 기운이 밀어주지도 누르지도 않는 담백한 짝이라, 둘의 우정은 온전히 노는 재미가 정해요 — 어른이 기운의 셈을 얹지 않아도 되는 홀가분한 배치예요.`,
    ],
  }),
};

/* ================================================================== */
/* 레지스트리와 해석                                                     */
/* ================================================================== */

const COPY_BUNDLES: { [K in CopySituationIdV1]: CopyBundleV1<CopySituationParamsMapV1[K]> } = {
  'day_stem.hap': DAY_STEM_HAP,
  'day_stem.chung': DAY_STEM_CHUNG,
  'day_stem.saeng': DAY_STEM_SAENG,
  'day_stem.geuk': DAY_STEM_GEUK,
  'day_stem.bihwa': DAY_STEM_BIHWA,
  'day_branch.yukhap': BRANCH_YUKHAP,
  'day_branch.samhap': BRANCH_SAMHAP,
  'day_branch.banghap': BRANCH_BANGHAP,
  'day_branch.mixed': BRANCH_MIXED,
  'day_branch.none': BRANCH_NONE,
  'day_branch.chung': BRANCH_CHUNG,
  'day_branch.wonjin': BRANCH_WONJIN,
  'day_branch.hyeong': BRANCH_HYEONG,
  'day_branch.jahyeong': BRANCH_JAHYEONG,
  'day_branch.gwimun': BRANCH_GWIMUN,
  'day_branch.hae_pa': BRANCH_HAE_PA,
  'ten_god.pair': TEN_GOD_PAIR,
  'yongshin.direct': YONGSHIN_DIRECT,
  'yongshin.generates': YONGSHIN_GENERATES,
  'yongshin.controls': YONGSHIN_CONTROLS,
  'yongshin.neutral': YONGSHIN_NEUTRAL,
};

/**
 * 상황 id와 프레임으로 writer를 고른다.
 * 프레임 전용 writer가 있으면 그것을, 없으면 default를 쓴다.
 */
export function resolveBundle<K extends CopySituationIdV1>(
  situationId: K,
  framing: CompatFramingV1,
): CopyWriterV1<CopySituationParamsMapV1[K]> {
  const bundle = COPY_BUNDLES[situationId];
  return (bundle[framing] ?? bundle.default) as CopyWriterV1<CopySituationParamsMapV1[K]>;
}

/* ================================================================== */
/* 지지 쌍 카피 렌더러 (검출 → 번들 선택 → 합성)                            */
/* ================================================================== */

const NEGATIVE_SITUATION: Partial<Record<BranchPairRelationV1, CopySituationIdV1>> = {
  chung: 'day_branch.chung',
  wonjin: 'day_branch.wonjin',
  hyeong: 'day_branch.hyeong',
  jahyeong: 'day_branch.jahyeong',
  gwimun: 'day_branch.gwimun',
  hae: 'day_branch.hae_pa',
  pa: 'day_branch.hae_pa',
};

/**
 * 지지 쌍(일지·년지) 하나의 카피를 만든다. 관계 구성에 따라
 * 무관계/합/혼합/흉 번들을 골라 합성한다 — 흉이 여럿 겹치면
 * 관계별 writer의 문단을 fact.relations 순서대로 이어 붙인다.
 */
export function renderBranchPairCopy(
  fact: BranchPairFactV1,
  aName: string,
  bName: string,
  seatLabel: string,
  voice: CopyVoiceV1,
): { headline: string; paragraphs: string[]; tips: string[]; cautions: string[] } {
  const aBranch = branchKo(fact.a);
  const bBranch = branchKo(fact.b);
  const params: BranchPairCopyParamsV1 = {
    aName,
    bName,
    fact,
    seatLabel,
    pairLabel: `${aName}님의 ${gwaWa(aBranch)} ${bName}님의 ${eunNeun(bBranch)}`,
    voice,
  };
  const { positives, negatives } = splitBranchRelations(fact.relations);

  const single = (situation: CopySituationIdV1, fallback: string) => {
    const writer = resolveBundle(situation, voice.framing) as CopyWriterV1<BranchPairCopyParamsV1>;
    const block = writer(params);
    return {
      headline: block.headline ?? fallback,
      paragraphs: [...block.paragraphs],
      tips: [...(block.tips ?? [])],
      cautions: [...(block.cautions ?? [])],
    };
  };

  if (fact.relations.length === 0) {
    return single('day_branch.none', `${seatLabel}에는 특별한 합도 충도 없어요 — 담백하게 만나는 자리예요.`);
  }

  if (positives.length > 0 && negatives.length === 0) {
    const main = positives[0];
    const situation: CopySituationIdV1 =
      main === 'yukhap'
        ? 'day_branch.yukhap'
        : main === 'samhap'
          ? 'day_branch.samhap'
          : 'day_branch.banghap';
    return single(situation, `${seatLabel}가 ${BRANCH_RELATION_KO[main]}으로 손을 잡았어요.`);
  }

  if (positives.length > 0 && negatives.length > 0) {
    return single(
      'day_branch.mixed',
      `${seatLabel}에 ${BRANCH_RELATION_KO[positives[0]]}과 ${iGa(BRANCH_RELATION_KO[negatives[0]])} 함께 있어요 — 끌림과 어긋남이 공존해요.`,
    );
  }

  // 흉 관계만 있는 경우: 관계별 번들을 순서대로 이어 붙인다.
  const paragraphs: string[] = [];
  const tips: string[] = [];
  const cautions: string[] = [];
  for (const relation of negatives) {
    const situation = NEGATIVE_SITUATION[relation];
    if (!situation) continue;
    const writer = resolveBundle(situation, voice.framing) as CopyWriterV1<BranchPairCopyParamsV1>;
    const block = writer({ ...params, relation });
    paragraphs.push(...block.paragraphs);
    tips.push(...(block.tips ?? []));
    cautions.push(...(block.cautions ?? []));
  }
  const parts = negatives.map(relation => BRANCH_RELATION_KO[relation]);
  return {
    headline: `${seatLabel}에 ${listKo(parts)}의 신호가 있어요 — 완급 조절이 열쇠예요.`,
    paragraphs,
    tips,
    cautions,
  };
}

/* ================================================================== */
/* 커버리지 증명 — 레지스트리에서 직접 계산한다                              */
/* ================================================================== */

/**
 * 번들 매트릭스 커버리지. situations는 레지스트리의 상황 수,
 * fullyCovered는 couple·companion·guardian·kids 네 프레임 전용 writer가
 * 모두 존재하는 상황 수다. 테이블이 아니라 실제 레지스트리에서 센다.
 */
export const COPY_BUNDLE_COVERAGE_V1: {
  readonly situations: number;
  readonly fullyCovered: number;
} = (() => {
  const frames = ['couple', 'companion', 'guardian', 'kids'] as const;
  const bundles = Object.values(COPY_BUNDLES) as Array<CopyBundleV1<never>>;
  const fullyCovered = bundles.filter(bundle =>
    frames.every(frame => typeof bundle[frame] === 'function'),
  ).length;
  return { situations: bundles.length, fullyCovered };
})();
