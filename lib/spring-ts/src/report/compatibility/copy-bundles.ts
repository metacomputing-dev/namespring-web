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
        `게다가 그 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapYongshinOwnerName}님 사주가 반기는 기운이라, 함께 있는 시간이 실제로 힘이 되는 방향이에요.`,
      );
    } else if (params.hapGishinOwnerName) {
      cautions.push(
        `합해서 생기는 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapGishinOwnerName}님 사주가 조심스러워하는 기운이기도 해요 — 함께 만드는 분위기가 한쪽으로 짙어지지 않게 살펴 주세요.`,
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
      `이 합이 모이면 ${elementKo(hapEl)} 기운으로 화(化)하려 해요. 둘이 함께 있을 때 ${describeElementMood(hapEl)}가 자라나기 쉬워요.`,
    );
    if (params.hapYongshinOwnerName) {
      paragraphs.push(
        `게다가 그 ${ELEMENT_KO[hapEl]} 기운은 ${params.hapYongshinOwnerName}님 사주가 반기는 기운이라, 같이 노는 시간이 실제로 힘이 되는 방향이에요.`,
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
  guardian: ({ pairLabel, seatLabel, fact, voice }) => {
    const { elder, younger } = guardianRoles(voice);
    const paragraphs: string[] = [
      `${pairLabel} 육합의 짝이에요. 돌봄의 자리에서 이 합은 "품이 잘 맞는" 모양으로 나타나요 — ${iGa(younger)} 칭얼거리기 전에 ${iGa(elder)} 먼저 알아채고, ${iGa(elder)} 지친 날에는 ${iGa(younger)} 곁에 와 조용히 앉아 있는, 그런 장면이 자주 생기는 인연이에요.`,
    ];
    if (fact.yukhapElement) {
      paragraphs.push(
        `두 글자가 만나면 ${elementKo(fact.yukhapElement)} 기운으로 모여요 — 함께 보내는 시간이 길수록 그 기운의 결이 짙어져요.`,
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
        `두 글자가 만나면 ${elementKo(fact.yukhapElement)} 기운으로 모여요 — 같이 노는 시간이 길수록 그 기운의 결이 짙어져요.`,
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
};

const BRANCH_BANGHAP: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel, seatLabel }) => ({
    headline: `${seatLabel}가 ${BRANCH_RELATION_KO.banghap}으로 손을 잡았어요.`,
    paragraphs: [
      `${pairLabel} 같은 계절의 기운이 모이는 방합의 짝이에요. 같은 풍토에서 자란 듯한 익숙함이 있어요.`,
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
  guardian: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 형의 짝이에요. 서로를 다듬으려는 힘이 작용해, 잔소리와 기 싸움이 생기기 쉽지만 그만큼 서로를 성장시키기도 해요.`,
    ],
    cautions: [
      '다듬어 주려는 마음이 잔소리로 흐르기 쉬워요 — 가르침은 짧게, 칭찬은 길게 두는 것이 형의 짝을 부드럽게 해요.',
    ],
  }),
  kids: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 형의 짝이에요. 서로를 다듬으려는 힘이 작용해, 잔소리와 기 싸움이 생기기 쉽지만 그만큼 서로를 성장시키기도 해요.`,
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
};

const BRANCH_GWIMUN: CopyBundleV1<BranchPairCopyParamsV1> = {
  default: ({ pairLabel }) => ({
    paragraphs: [
      `${pairLabel} 귀문의 짝이에요. 서로에게 예민하게 반응하고 깊이 몰입하는 배치라, 애착이 강해지는 만큼 감정 기복도 함께 커질 수 있어요.`,
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
};

const YONGSHIN_CONTROLS: CopyBundleV1<YongshinCopyParamsV1> = {
  default: ({ giverName, receiverName, fact }) => ({
    paragraphs: [
      `${giverName}님의 일간은 ${receiverName}님이 반기는 ${elementKo(fact.yongshinElement)} 기운을 누르는 쪽이에요. `
      + `함께 있을 때 ${receiverName}님의 기운이 눌리지 않도록 혼자만의 회복 시간을 존중해 주는 게 좋아요.`,
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
