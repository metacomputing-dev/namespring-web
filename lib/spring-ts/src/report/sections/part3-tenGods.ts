/**
 * part3-tenGods.ts -- 십성(十神) 분포 분석 섹션
 *
 * PART 3-1: 10개 십성별 점수, 5대 카테고리 합산, 레이더 차트 데이터를 생성합니다.
 *
 * 페르소나: "심리학 교수"
 *   MBTI나 에니어그램처럼 현대 심리학의 관점에서 십성을 해석합니다.
 *   - 성격 유형 분석하듯 체계적이고 분석적인 톤
 *   - "내면의 동기 체계", "관계 역학", "무의식적 패턴" 등 심리학 용어 활용
 *   - 학술적이면서도 이해하기 쉬운 균형
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  TenGodCode,
} from '../types.js';

import {
  TEN_GOD_BY_CODE,
  TEN_GOD_CATEGORY_KOREAN,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  tip,
  emphasis,
  encouraging,
} from '../common/sentenceUtils.js';

import {
  TEN_GOD_ENCYCLOPEDIA,
  getTenGodEncyclopediaEntry,
} from '../knowledge/tenGodEncyclopedia.js';

// ─────────────────────────────────────────────────────────────────────────────
//  상수 & 카테고리 정의
// ─────────────────────────────────────────────────────────────────────────────

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

interface StrongestTenGodInsights {
  readonly coreRole: string;
  readonly strengths: readonly string[];
  readonly cautions: readonly string[];
}

function isKnownTenGodCode(code: string): code is TenGodCode {
  return Object.prototype.hasOwnProperty.call(TEN_GOD_ENCYCLOPEDIA, code);
}

function resolveStrongestTenGodInsights(code: string | null): StrongestTenGodInsights | null {
  if (!code || !isKnownTenGodCode(code)) {
    return null;
  }

  const entry = getTenGodEncyclopediaEntry(code);
  return {
    coreRole: entry.coreRole,
    strengths: entry.strengths,
    cautions: entry.cautions,
  };
}

const CATEGORY_KEYS = ['friend', 'output', 'wealth', 'authority', 'resource'] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_PAIRS: Record<CategoryKey, TenGodCode[]> = {
  friend: ['BI_GYEON', 'GEOB_JAE'],
  output: ['SIK_SHIN', 'SANG_GWAN'],
  wealth: ['PYEON_JAE', 'JEONG_JAE'],
  authority: ['PYEON_GWAN', 'JEONG_GWAN'],
  resource: ['PYEON_IN', 'JEONG_IN'],
};

const CATEGORY_HANJA: Record<CategoryKey, string> = {
  friend: '比劫',
  output: '食傷',
  wealth: '財星',
  authority: '官星',
  resource: '印星',
};

/** 5대 카테고리의 심리학적 의미 요약 (테이블용) */
const CATEGORY_MEANING: Record<CategoryKey, string> = {
  friend: '자아 정체성, 자기효능감, 독립성',
  output: '자기표현, 창작 욕구, 감정 외현화',
  wealth: '소유 동기, 대상관계, 현실 적응',
  authority: '초자아, 규범 내면화, 책임 구조',
  resource: '인지 도식, 학습 양식, 수용성',
};

// ─────────────────────────────────────────────────────────────────────────────
//  심리학 교수 페르소나 — 도입 템플릿
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '십성(十神) 분포는 성격 유형 검사에서 프로파일 그래프를 그리는 것과 같은 원리라고 볼 수 있어요. 일간(나)을 중심으로 나머지 글자들이 어떤 심리적 역할을 하는지, 그 비중을 수치화한 것이거든요. MBTI가 네 가지 축으로 성격을 분류하듯, 십성은 다섯 가지 심리 역학 축으로 내면의 동기 체계를 파악하는 도구에 해당해요.',
  '심리학에서 성격을 분석할 때 Big Five나 MBTI 같은 도구를 사용하는 것처럼, 사주명리학에서는 십성(十神)이라는 프레임워크를 활용하거든요. 열 가지 십성을 다섯 개의 상위 카테고리로 묶으면, 내면의 동기 체계가 마치 레이더 차트처럼 한눈에 드러나는 거죠. 지금부터 {{이름}}님의 심리 프로파일을 십성을 통해 분석해 보겠습니다.',
  '성격심리학에서는 사람의 행동 패턴을 몇 가지 핵심 특질(trait)로 설명하는데, 십성 분포가 바로 그런 역할을 하는 거예요. 비겁은 자아 정체성, 식상은 표현 욕구, 재성은 대상관계, 관성은 규범 내면화, 인성은 학습 양식에 대응한다고 볼 수 있어요. {{이름}}님의 내면 구조를 체계적으로 들여다보겠습니다.',
  '현대 심리학의 관점에서 십성을 읽으면, 단순한 점술이 아니라 하나의 성격 유형론으로 작동하는 것을 알 수 있어요. 열 가지 십성은 각각 내면의 동기, 관계 역학, 무의식적 패턴을 반영하거든요. {{이름}}님의 십성 분포를 심리 프로파일링하듯 분석해 볼게요.',
  '에니어그램이 아홉 가지 유형으로 인간 심리를 매핑하듯, 십성은 열 가지 관계 역학으로 성격 구조를 포착하는 시스템이에요. 다섯 개의 상위 카테고리 — 비겁, 식상, 재성, 관성, 인성 — 는 각각 자아, 표현, 소유, 책임, 학습이라는 심리학적 차원에 해당해요. {{이름}}님의 내면 지형도를 그려 보겠습니다.',
  '십성 분포 분석은 말하자면 사주 기반의 심리 프로파일링이라 하겠습니다. 각 십성이 내면의 어떤 욕구 체계를 활성화하는지 살펴보면, MBTI 못지않게 정교한 성격 지도를 그릴 수 있거든요. {{이름}}님의 동기 구조를 다섯 가지 심리 축으로 조망해 볼게요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  5대 카테고리 심리학적 해석 — 카테고리별 다변량 템플릿
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 카테고리별 "강할 때" 심리학적 해석 템플릿.
 * 각 카테고리마다 4개 이상의 변형을 두어 다양성을 보장합니다.
 */
const CATEGORY_STRONG_TEMPLATES: Record<CategoryKey, readonly string[]> = {
  friend: [
    '비겁(比劫)은 심리학에서 말하는 "자기효능감(self-efficacy)"의 핵심 축이에요. {{이름}}님은 이 에너지가 강하기 때문에, 자아 정체성이 뚜렷하고 독립적인 의사결정을 선호하는 패턴이에요. 에릭슨의 발달 단계로 보면, 정체성 확립이 매우 단단하게 이루어진 경우에 해당해요.',
    '비겁 에너지가 높다는 것은 자기 개념(self-concept)이 강하다는 의미거든요. {{이름}}님의 내면에는 "나는 나 자신의 힘으로 해낼 수 있다"는 핵심 신념이 자리 잡고 있어요. 이는 심리학에서 내적 통제 소재(internal locus of control)와 맞닿아 있는 거죠.',
    '{{이름}}님의 비겁 카테고리가 두드러진다는 것은, 자아 경계가 뚜렷하고 자기주장(assertiveness)이 강한 성격 프로파일을 보여주는 거예요. 반두라가 말한 자기효능감이 높은 사람의 전형적인 패턴이라고 볼 수 있어요.',
    '비겁이 강한 프로파일은 자기결정이론(Self-Determination Theory)에서 말하는 "자율성 욕구"가 높은 유형이에요. {{이름}}님은 타인의 지시보다 자기 주도적 판단을 선호하는, 심리적으로 자립된 구조를 가지고 있는 거죠.',
  ],
  output: [
    '식상(食傷)은 심리학에서 "자기표현 욕구"와 "창작 동기"에 대응하는 에너지거든요. {{이름}}님은 이 카테고리가 강해서, 내면의 감정과 생각을 외부로 표출하려는 무의식적 패턴이 뚜렷한 거예요. 매슬로의 자아실현 욕구와 직결되는 영역이라 하겠습니다.',
    '{{이름}}님의 식상 에너지가 높다는 것은, 표현적 자기(expressive self)가 활성화되어 있다는 뜻이에요. 감정을 억압하기보다 외현화하는 경향이 강하고, 예술적 감수성이나 언어적 유창성이 뛰어난 패턴이에요.',
    '식상이 강한 사람은 심리학에서 말하는 "개방성(Openness to Experience)"이 높은 유형에 해당해요. {{이름}}님은 새로운 아이디어를 생성하고, 감정을 창작물로 승화시키는 능력이 내면에 깊이 장착되어 있는 거죠.',
    '{{이름}}님의 식상 카테고리가 두드러진다는 것은, 내면의 창조적 충동(creative drive)이 강하다는 심리적 시그널이에요. 융(Jung)이 말한 "개성화 과정"에서 자기표현이 핵심 통로로 작용하는 구조라고 볼 수 있어요.',
  ],
  wealth: [
    '재성(財星)은 심리학적으로 "대상관계(object relations)"와 "소유 동기"를 반영하는 에너지예요. {{이름}}님은 이 카테고리가 강해서, 구체적인 목표를 설정하고 자원을 관리하는 현실 적응 능력이 뛰어난 패턴이에요.',
    '{{이름}}님의 재성이 높다는 것은, 대상관계이론에서 말하는 "외부 대상과의 건강한 연결"이 잘 형성되어 있다는 의미거든요. 물질적 자원뿐 아니라 인간관계에서도 실용적 감각이 작동하는 구조에 해당해요.',
    '재성 에너지가 강한 프로파일은 현실 원리(reality principle)가 잘 발달한 유형이에요. {{이름}}님은 추상적 이상보다 구체적 성과를 추구하며, 자원 배분과 관계 관리에서 높은 실행력을 보이는 심리적 패턴이라고 볼 수 있어요.',
    '{{이름}}님의 재성 카테고리가 두드러진다는 것은, 행동주의 심리학에서 말하는 "강화 민감성"이 높은 구조예요. 노력에 대한 보상을 빠르게 인식하고, 그것을 동기 체계에 효율적으로 연결하는 패턴인 거죠.',
  ],
  authority: [
    '관성(官星)은 프로이트가 말한 "초자아(superego)"의 사주학적 대응물이라고 볼 수 있어요. {{이름}}님은 이 에너지가 강해서, 사회적 규범과 책임을 내면화하는 능력이 뛰어나고, 질서와 구조 속에서 안정감을 느끼는 패턴이에요.',
    '{{이름}}님의 관성이 높다는 것은, 심리학에서 말하는 "성실성(Conscientiousness)"이 높은 유형에 해당하거든요. 규칙을 내면화하고, 외부의 기대에 책임감 있게 반응하며, 조직 내에서 신뢰를 구축하는 무의식적 패턴이 작동하는 거예요.',
    '관성 에너지가 강한 프로파일은 콜버그의 도덕 발달 이론에서 "후인습 수준"에 해당하는 내면 구조를 가지고 있어요. {{이름}}님은 외부 압력이 아닌 내면의 원칙에 따라 행동하려는 경향이 뚜렷한 거죠.',
    '{{이름}}님의 관성 카테고리가 두드러진다는 것은, 사회적 역할과 자기 정체성을 깊이 통합한 상태라 하겠습니다. 심리학에서 말하는 "역할 정체성(role identity)"이 단단하게 형성된 패턴이에요.',
  ],
  resource: [
    '인성(印星)은 심리학에서 "인지 도식(cognitive schema)"과 "학습 양식"에 대응하는 에너지거든요. {{이름}}님은 이 카테고리가 강해서, 새로운 정보를 흡수하고 체계화하는 지적 수용성이 매우 높은 패턴이에요.',
    '{{이름}}님의 인성 에너지가 높다는 것은, 피아제의 인지 발달 이론에서 "동화와 조절"이 활발하게 작동하는 내면 구조를 가지고 있다는 의미예요. 지식과 경험을 자기 것으로 내면화하는 능력이 뛰어난 유형이라고 볼 수 있어요.',
    '인성이 강한 프로파일은 학습심리학에서 말하는 "내재적 동기(intrinsic motivation)"가 높은 유형에 해당해요. {{이름}}님은 외부 보상이 아닌 앎 자체의 즐거움에 의해 움직이는, 깊이 있는 인지 구조를 가지고 있는 거죠.',
    '{{이름}}님의 인성 카테고리가 두드러진다는 것은, 심리학에서 말하는 "성찰적 자기(reflective self)"가 잘 발달되어 있다는 뜻이에요. 경험을 그냥 흘려보내지 않고, 의미를 추출하여 내면의 지혜로 축적하는 무의식적 패턴인 거예요.',
  ],
};

/** 카테고리별 "약할 때" 심리학적 해석 템플릿 */
const CATEGORY_WEAK_TEMPLATES: Record<CategoryKey, readonly string[]> = {
  friend: [
    '비겁 에너지가 상대적으로 낮다는 것은, 자기주장보다 협조를 우선시하는 무의식적 패턴이라고 볼 수 있어요. 이것이 반드시 약점은 아니거든요 — 오히려 공감 능력과 관계 지향성이 높은 프로파일에 해당해요. 다만, 심리학에서 말하는 "건강한 자기애"를 의식적으로 보충해 주면 더 균형 잡힌 내면 구조가 형성된다 하겠습니다.',
    '비겁이 약한 구조는 타인과의 경계 설정에서 유연성이 큰 유형이에요. 심리학적으로는 자기 돌봄(self-care) 루틴을 강화하면, 자아 에너지의 균형이 훨씬 나아지는 패턴이거든요.',
  ],
  output: [
    '식상 에너지가 낮다는 것은, 표현 양식이 내향적이거나 비언어적인 채널을 선호한다는 뜻이에요. 심리학에서 말하는 "억제적 대처(suppressive coping)"와는 다른 개념이거든요 — 단지 표현의 경로가 다를 뿐이에요. 글쓰기, 음악, 운동 등 자기표현 통로를 의식적으로 만들어 주면 심리적 환기 효과가 뛰어나다 하겠습니다.',
    '{{이름}}님의 식상이 약한 것은, 감정 표현보다 내면 성찰을 선호하는 인지 스타일이라고 볼 수 있어요. 창의적 아웃풋을 의식적으로 연습하면 숨겨진 표현력이 발현되는 패턴이거든요.',
  ],
  wealth: [
    '재성 에너지가 상대적으로 낮다는 것은, 물질적 보상보다 내면의 가치를 우선시하는 동기 구조라고 볼 수 있어요. 이상주의적 성향이 강한 프로파일이거든요. 실용적 목표 설정 훈련을 통해 현실 적응력을 보완하면, 이상과 현실 사이의 균형이 한층 좋아진다 하겠습니다.',
    '재성이 약한 것은 물질적 집착이 적다는 긍정적 면도 있어요. 다만, 행동 활성화(behavioral activation) 전략으로 구체적 목표를 설정하는 습관을 들이면, 잠재된 실행력이 강화되는 패턴이에요.',
  ],
  authority: [
    '관성 에너지가 낮다는 것은, 외부의 구조나 규칙에 얽매이기보다 자유롭게 사고하는 패턴이에요. 심리학적으로 "자율성(autonomy)"이 높은 유형이지만, 때로는 자기규율의 프레임을 의식적으로 구축해 주면 목표 달성 효율이 훨씬 높아진다 하겠습니다.',
    '{{이름}}님의 관성이 약한 것은, 권위에 순응하기보다 자기만의 기준을 세우는 내면 구조에 해당해요. 작은 루틴부터 자기규율을 연습하면 외부 구조 없이도 일관성이 유지되는 패턴이거든요.',
  ],
  resource: [
    '인성 에너지가 상대적으로 낮다는 것은, 이론적 학습보다 경험적 학습을 선호하는 인지 양식이에요. 심리학에서 말하는 "체화된 인지(embodied cognition)"에 강한 유형이거든요. 독서나 명상 같은 성찰적 활동을 의식적으로 추가하면, 인지 도식의 깊이가 한층 풍부해진다 하겠습니다.',
    '인성이 약한 프로파일은 직접 부딪히며 배우는 "경험 학습자" 유형이에요. {{이름}}님의 경우, 정기적인 배움의 시간을 의식적으로 확보하면 잠재된 지적 호기심이 활성화되는 패턴이거든요.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  십성별 심리학적 프로파일 (개별 십성 강조 시 사용)
// ─────────────────────────────────────────────────────────────────────────────

const TEN_GOD_PSYCH: Record<string, readonly string[]> = {
  BI_GYEON: [
    '비견(比肩)이 가장 강하다는 것은, 심리학에서 말하는 "동일시(identification)" 경향이 뚜렷한 거예요. 자기와 비슷한 사람에게 끌리고, 동등한 관계 속에서 자아를 확인하려는 내면의 동기 체계가 활성화되어 있는 패턴이에요.',
    '비견이 최강 십성이라는 것은, 자기 참조 효과(self-reference effect)가 강하게 작동하는 인지 구조를 가지고 있다는 뜻이거든요. "나는 나다"라는 핵심 신념이 행동 패턴 전반에 스며들어 있는 유형이에요.',
  ],
  GEOB_JAE: [
    '겁재(劫財)가 가장 강하다는 것은, 경쟁 동기(competitive motivation)가 높은 심리 프로파일이에요. 도전적 상황에서 각성 수준이 올라가고, 라이벌 의식이 성취의 원동력으로 작용하는 패턴이거든요.',
    '겁재가 최강이라는 것은, 심리학의 "사회적 비교 이론"에서 상향 비교를 통해 동기를 얻는 유형에 해당해요. 경쟁을 두려워하기보다 자기 성장의 자극으로 활용하는 내면 구조인 거죠.',
  ],
  SIK_SHIN: [
    '식신(食神)이 가장 강하다는 것은, 만족 지연(delay of gratification)보다 현재의 즐거움에 가치를 두는 심리 패턴이에요. 낙관성 편향이 높고, 감각적 경험을 통해 정서적 안정을 얻는 구조라고 볼 수 있어요.',
    '식신이 최강이라는 것은, 긍정심리학에서 말하는 "몰입(flow)" 경험을 잘 하는 유형이거든요. 자기가 좋아하는 일에 빠져들면 시간 감각을 잃을 만큼 집중하는 내면 동기가 강한 패턴이에요.',
  ],
  SANG_GWAN: [
    '상관(傷官)이 가장 강하다는 것은, 기존 질서에 대한 비판적 사고력과 창의적 파괴 본능이 뛰어난 프로파일이에요. 심리학에서 말하는 "확산적 사고(divergent thinking)"가 높은 유형에 해당하거든요.',
    '상관이 최강이라는 것은, 심리학적으로 "인지적 유연성(cognitive flexibility)"이 매우 높은 구조예요. 틀에 갇히지 않고, 새로운 관점에서 문제를 재구성하는 능력이 내면에 장착되어 있는 패턴이라고 볼 수 있어요.',
  ],
  PYEON_JAE: [
    '편재(偏財)가 가장 강하다는 것은, 위험 감수 성향(risk-taking propensity)이 높은 심리 프로파일이에요. 불확실한 상황에서 기회를 포착하는 감각이 뛰어나고, 모험적 투자에 끌리는 내면의 동기 패턴이거든요.',
    '편재가 최강이라는 것은, 행동경제학에서 말하는 "전망 이론"의 이익 민감성이 높은 유형에 해당해요. 손실보다 기회에 주목하고, 능동적으로 자원을 운용하려는 심리적 에너지가 강한 구조인 거죠.',
  ],
  JEONG_JAE: [
    '정재(正財)가 가장 강하다는 것은, 심리학에서 말하는 "계획적 행동 이론(TPB)"의 모범적 실행자 유형이에요. 목표를 세우고 단계적으로 달성하는 체계적 동기 구조가 내면에 단단하게 자리 잡고 있는 패턴이거든요.',
    '정재가 최강이라는 것은, 안정적 애착 유형과 유사한 심리 구조를 가지고 있다는 의미예요. 관계든 재물이든 꾸준하고 성실하게 쌓아가는 것에서 심리적 만족을 느끼는 패턴이에요.',
  ],
  PYEON_GWAN: [
    '편관(偏官)이 가장 강하다는 것은, 심리학에서 말하는 "권력 동기(power motive)"가 높은 프로파일이에요. 위기 상황에서 리더십을 발휘하고, 강한 추진력으로 조직을 이끄는 무의식적 패턴이 작동하는 거예요.',
    '편관이 최강이라는 것은, 투쟁-도피 반응(fight-or-flight)에서 "투쟁" 쪽이 압도적으로 활성화되는 유형이거든요. 위기를 기회로 전환하는 심리적 레질리언스가 뛰어난 패턴이라고 볼 수 있어요.',
  ],
  JEONG_GWAN: [
    '정관(正官)이 가장 강하다는 것은, 사회적 바람직성(social desirability)과 자기통제력이 높은 심리 프로파일이에요. 규칙과 질서를 내면화하여 자기규율로 승화시키는 성숙한 내면 구조라 하겠습니다.',
    '정관이 최강이라는 것은, 심리학에서 말하는 "자기조절(self-regulation)" 능력이 뛰어난 유형이거든요. 감정과 충동을 잘 관리하고, 장기적 목표에 집중하는 인지적 제어력이 높은 패턴이에요.',
  ],
  PYEON_IN: [
    '편인(偏印)이 가장 강하다는 것은, 비정형적 학습 양식과 직관적 사고력이 뛰어난 프로파일이에요. 심리학에서 말하는 "암묵지(tacit knowledge)"의 영역이 발달한 유형에 해당하거든요.',
    '편인이 최강이라는 것은, 융(Jung)이 말한 "직관(intuition)" 기능이 강하게 작동하는 내면 구조예요. 논리적 추론보다 통찰과 영감에 의해 문제를 해결하는 무의식적 패턴이라고 볼 수 있어요.',
  ],
  JEONG_IN: [
    '정인(正印)이 가장 강하다는 것은, 체계적 학습과 지적 성장에 대한 내재적 동기가 매우 높은 프로파일이에요. 심리학에서 말하는 "성장 마인드셋(growth mindset)"이 내면에 깊이 자리 잡고 있는 패턴이거든요.',
    '정인이 최강이라는 것은, 비고츠키의 "근접 발달 영역" 이론처럼, 끊임없이 배움의 경계를 확장하려는 심리적 동기가 강한 유형에 해당해요. 멘토나 스승과의 관계를 통해 크게 성장하는 내면 구조인 거죠.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  마무리 템플릿
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_TEMPLATES: readonly string[] = [
  '이 십성 분포는 {{이름}}님만의 고유한 심리 프로파일이에요. 심리학에서 강조하듯이 "완벽한 균형"보다 "자기 이해"가 중요하거든요. 자신의 강점을 인식하고 약점을 의식적으로 보완할 때, 비로소 통합된 자아(integrated self)가 완성되는 거죠.',
  '성격심리학에서는 어떤 프로파일이든 고유의 강점이 있다고 말해요. {{이름}}님의 십성 분포 역시 마찬가지예요. 높은 카테고리는 타고난 재능이고, 낮은 카테고리는 의식적 성장의 여지라고 볼 수 있어요. 자기 인식이 변화의 첫걸음이라 하겠습니다.',
  '십성 레이더 차트의 모양이 원에 가까울 필요는 없어요. 오히려 뚜렷한 돌출과 함몰이 있을수록 개성이 강한 거예요. 심리학에서 말하는 "성격적 강점(character strengths)"은 바로 이 돌출된 부분에서 나오거든요. {{이름}}님의 고유한 내면 지형을 자랑스러워하셔도 좋아요!',
  '이 분석이 {{이름}}님의 내면을 이해하는 하나의 거울이 되길 바라요. 심리학에서도 자기 이해(self-awareness)가 심리적 웰빙의 핵심이라고 하거든요. 십성 분포를 통해 자신의 동기 체계를 객관적으로 조망할 수 있게 된 것, 그 자체가 큰 의미라 하겠습니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  5대 카테고리 전반 조망 (균형/편중 판단)
// ─────────────────────────────────────────────────────────────────────────────

const BALANCE_EVEN: readonly string[] = [
  '다섯 카테고리가 비교적 고르게 분포되어 있어서, 심리학에서 말하는 "다면적 성격(multifaceted personality)" 프로파일에 해당해요. 어느 한쪽에 치우치지 않은 유연한 동기 구조를 가지고 있는 거죠.',
  '흥미로운 점은, {{이름}}님의 십성 분포가 상당히 균형 잡혀 있다는 거예요. 이런 프로파일은 다양한 상황에 유연하게 적응하는 심리적 레퍼토리가 넓은 유형에 해당하거든요.',
];

const BALANCE_SKEWED: readonly string[] = [
  '다섯 카테고리 간의 편차가 뚜렷하여, 특정 심리 역학이 강하게 작동하는 "전문가형(specialist)" 프로파일이에요. 강한 카테고리에 집중하면 탁월한 성과를 낼 수 있는 구조거든요.',
  '{{이름}}님의 십성 분포는 특정 축이 두드러지게 높은 "첨탑형(spire)" 프로파일이에요. 심리학적으로 이런 구조는 해당 영역에서 깊은 전문성을 발휘할 잠재력이 크다는 뜻이라고 볼 수 있어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  십성 점수 추출
// ─────────────────────────────────────────────────────────────────────────────

function extractTenGodScores(input: ReportInput): Record<string, number> {
  const saju = input.saju as Record<string, unknown>;

  // scores.pillars.tenGods 경로 탐색
  const scores = saju['scores'] as Record<string, unknown> | undefined;
  const pillarsScores = scores?.['pillars'] as Record<string, unknown> | undefined;
  const tenGodScores = pillarsScores?.['tenGods'] as Record<string, number> | undefined;

  if (tenGodScores && typeof tenGodScores === 'object') {
    return tenGodScores;
  }

  // 폴백: tenGodAnalysis에서 추정
  const tga = input.saju.tenGodAnalysis;
  if (!tga) return {};

  const result: Record<string, number> = {};
  const byPos = tga.byPosition;
  if (byPos) {
    for (const pos of Object.values(byPos)) {
      const p = pos as { cheonganTenGod?: string; jijiPrincipalTenGod?: string };
      if (p.cheonganTenGod) {
        result[p.cheonganTenGod] = (result[p.cheonganTenGod] ?? 0) + 1;
      }
      if (p.jijiPrincipalTenGod) {
        result[p.jijiPrincipalTenGod] = (result[p.jijiPrincipalTenGod] ?? 0) + 1;
      }
    }
  }
  return result;
}

/** rules.facts 경로에서 랭킹/최강 십성 추출 (있으면 사용) */
function extractRanking(input: ReportInput): { ranking: Array<{ tenGod: string; score: number }>; best: { tenGod: string; score: number } | null } {
  const saju = input.saju as Record<string, unknown>;
  const rules = saju['rules'] as Record<string, unknown> | undefined;
  const facts = rules?.['facts'] as Record<string, unknown> | undefined;

  const ranking = facts?.['tenGodScoresRanking'] as Array<{ tenGod: string; score: number }> | undefined;
  const best = facts?.['tenGodScoresBest'] as { tenGod: string; score: number } | undefined;

  return {
    ranking: ranking ?? [],
    best: best ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateTenGodsSection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 18; i++) rng.next();

  const name = safeName(input);
  const tenGodScores = extractTenGodScores(input);
  if (Object.keys(tenGodScores).length === 0) return null;

  const { ranking, best } = extractRanking(input);
  const paragraphs: ReportParagraph[] = [];

  // ── 5대 카테고리 합산 ──────────────────────────────────────────────────
  const categoryScores: Record<CategoryKey, number> = {
    friend: 0, output: 0, wealth: 0, authority: 0, resource: 0,
  };

  for (const cat of CATEGORY_KEYS) {
    for (const tg of CATEGORY_PAIRS[cat]) {
      categoryScores[cat] += tenGodScores[tg] ?? 0;
    }
  }

  const totalScore = CATEGORY_KEYS.reduce((sum, cat) => sum + categoryScores[cat], 0);
  const sortedCategories = CATEGORY_KEYS.slice().sort((a, b) => categoryScores[b] - categoryScores[a]);
  const strongest = sortedCategories[0];
  const weakest = sortedCategories[sortedCategories.length - 1];

  // ── 편차 계산 (균형/편중 판단용) ──────────────────────────────────────
  const catValues = CATEGORY_KEYS.map(c => categoryScores[c]);
  const catMean = totalScore / 5;
  const catStdDev = Math.sqrt(catValues.reduce((s, v) => s + (v - catMean) ** 2, 0) / 5);
  const isBalanced = catMean > 0 ? (catStdDev / catMean) < 0.35 : false;

  // ── 10개 십성 정렬 ────────────────────────────────────────────────────
  const sortedTenGods = ranking.length > 0
    ? ranking.map(r => [r.tenGod, r.score] as [string, number])
    : Object.entries(tenGodScores).sort((a, b) => b[1] - a[1]);

  const strongestTenGod = best?.tenGod ?? (sortedTenGods.length > 0 ? sortedTenGods[0][0] : null);
  const weakestTenGod = sortedTenGods.length > 0 ? sortedTenGods[sortedTenGods.length - 1][0] : null;
  const strongestTenGodInsights = resolveStrongestTenGodInsights(strongestTenGod);

  // ── 1. 도입 (심리학적 프레이밍) ───────────────────────────────────────
  const introText = pickAndFill(rng, INTRO_TEMPLATES, { 이름: name });
  paragraphs.push(narrative(introText));

  // ── 2. 전반 균형/편중 조망 ────────────────────────────────────────────
  if (isBalanced) {
    paragraphs.push(narrative(pickAndFill(rng, BALANCE_EVEN, { 이름: name })));
  } else {
    paragraphs.push(narrative(pickAndFill(rng, BALANCE_SKEWED, { 이름: name })));
  }

  // ── 3. 최강 카테고리 심리학적 해석 ────────────────────────────────────
  const strongCatText = pickAndFill(rng, CATEGORY_STRONG_TEMPLATES[strongest], { 이름: name });
  paragraphs.push(emphasis(strongCatText));

  // ── 4. 최약 카테고리 심리학적 해석 ────────────────────────────────────
  const weakCatText = pickAndFill(rng, CATEGORY_WEAK_TEMPLATES[weakest], { 이름: name });
  paragraphs.push(narrative(weakCatText));

  // ── 5. 최강 개별 십성 프로파일 ────────────────────────────────────────
  if (strongestTenGod && TEN_GOD_PSYCH[strongestTenGod]) {
    const tgInfo = TEN_GOD_BY_CODE[strongestTenGod];
    if (tgInfo) {
      const psychText = rng.pick(TEN_GOD_PSYCH[strongestTenGod]);
      paragraphs.push(positive(psychText));
    }
  } else if (strongestTenGod) {
    const tgInfo = TEN_GOD_BY_CODE[strongestTenGod];
    if (tgInfo) {
      paragraphs.push(positive(
        `개별 십성 중에서는 ${tgInfo.korean}(${tgInfo.hanja})이 가장 강하게 나타나요. ${tgInfo.shortDesc} — 이 에너지가 {{이름}}님의 행동 패턴 전반에 깊이 스며들어 있는 거죠.`.replace('{{이름}}', name),
      ));
    }
  }
  if (strongestTenGod) {
    const tgInfo = TEN_GOD_BY_CODE[strongestTenGod];
    const tgLabel = tgInfo ? `${tgInfo.korean}(${tgInfo.hanja})` : strongestTenGod;
    const coreRoleText = strongestTenGodInsights?.coreRole
      ?? (tgInfo
        ? `${tgInfo.shortDesc}의 방향으로 심리 에너지를 조직하는 역할이에요.`
        : '핵심 역할 정보는 확인되지 않았지만, 최강 축이 현재 행동 패턴의 중심으로 작동해요.');
    const strengthsText = strongestTenGodInsights?.strengths.length
      ? strongestTenGodInsights.strengths.slice(0, 2).join(' · ')
      : (tgInfo
        ? `${tgInfo.shortDesc}을(를) 일상 루틴에서 반복 재현하면 강점이 커져요.`
        : '강점이 발휘되는 상황을 기록해 반복 재현해 보세요.');
    const cautionsText = strongestTenGodInsights?.cautions.length
      ? strongestTenGodInsights.cautions.slice(0, 2).join(' · ')
      : '강점이 과열되지 않도록 속도 조절과 점검 루틴을 함께 유지해 주세요.';

    paragraphs.push(narrative(`${tgLabel}의 핵심 역할은 ${coreRoleText}`));
    paragraphs.push(tip(`강점/주의 포인트: ${strengthsText} / ${cautionsText}`));
  }

  // ── 6. 중간 카테고리 간략 해석 (2위~4위) ──────────────────────────────
  if (sortedCategories.length >= 3) {
    const midCats = sortedCategories.slice(1, -1);
    const midDescParts = midCats.map(cat => {
      const catKo = TEN_GOD_CATEGORY_KOREAN[cat] ?? cat;
      const score = categoryScores[cat];
      const pctValue = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
      return `${catKo}(${pctValue}%)`;
    });
    const midText = `중간 영역을 차지하는 ${midDescParts.join(', ')}도 {{이름}}님의 심리 프로파일에서 보조적 역할을 수행하고 있어요. 이 영역들은 상황에 따라 유연하게 활성화되는 잠재적 동기 체계에 해당하거든요.`.replace('{{이름}}', name);
    paragraphs.push(narrative(midText));
  }

  // ── 7. 조언 (팁) ──────────────────────────────────────────────────────
  const strongestKo = TEN_GOD_CATEGORY_KOREAN[strongest] ?? strongest;
  const weakestKo = TEN_GOD_CATEGORY_KOREAN[weakest] ?? weakest;
  const adviceTemplates: readonly string[] = [
    `심리학에서는 강점을 극대화하는 것이 약점 보완보다 효과적이라고 하거든요. ${strongestKo}의 에너지를 적극 활용하면서, ${weakestKo} 영역은 의식적인 작은 실천으로 서서히 강화해 나가는 전략을 추천드려요.`,
    `긍정심리학의 "강점 기반 접근(strengths-based approach)"에 따르면, ${strongestKo} 에너지를 핵심 동력으로 삼고, ${weakestKo} 영역은 일상 속 미니 습관으로 보완하는 것이 가장 효율적인 성장 전략이에요.`,
    `자기 이해가 깊어질수록 심리적 웰빙이 높아진다는 것은 많은 연구에서 입증된 사실이거든요. ${strongestKo}라는 강점을 인식하고, ${weakestKo}라는 성장 영역을 의식적으로 탐색해 보시길 추천드려요.`,
  ];
  paragraphs.push(tip(rng.pick(adviceTemplates)));

  // ── 8. 마무리 ─────────────────────────────────────────────────────────
  const closingText = pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name });
  paragraphs.push(encouraging(closingText));

  // ── 테이블 1: 10개 십성 점수 분포 ─────────────────────────────────────
  const tenGodsTable: ReportTable = {
    title: '10개 십성 점수 분포',
    headers: ['십성', '한자', '카테고리', '점수', '비중'],
    rows: sortedTenGods.map(([code, score]) => {
      const info = TEN_GOD_BY_CODE[code];
      const catKey = info?.category ?? '';
      const catKo = TEN_GOD_CATEGORY_KOREAN[catKey] ?? catKey;
      const pctVal = totalScore > 0 ? `${Math.round((score / totalScore) * 100)}%` : '-';
      return [
        info?.korean ?? code,
        info?.hanja ?? '',
        catKo,
        String(Math.round(score * 100) / 100),
        pctVal,
      ];
    }),
  };

  // ── 테이블 2: 5대 카테고리 합산 ───────────────────────────────────────
  const catTable: ReportTable = {
    title: '5대 심리 역학 카테고리',
    headers: ['카테고리', '한자', '포함 십성', '합산 점수', '비중', '심리학적 의미'],
    rows: sortedCategories.map(cat => {
      const score = categoryScores[cat];
      const pctVal = totalScore > 0 ? `${Math.round((score / totalScore) * 100)}%` : '-';
      return [
        TEN_GOD_CATEGORY_KOREAN[cat] ?? cat,
        CATEGORY_HANJA[cat],
        CATEGORY_PAIRS[cat].map(tg => TEN_GOD_BY_CODE[tg]?.korean ?? tg).join(' + '),
        String(Math.round(score * 100) / 100),
        pctVal,
        CATEGORY_MEANING[cat],
      ];
    }),
  };

  const strongestTenGodGuideTable: ReportTable | null = strongestTenGod
    ? (() => {
      const tgInfo = TEN_GOD_BY_CODE[strongestTenGod];
      const tgLabel = tgInfo ? `${tgInfo.korean}(${tgInfo.hanja})` : strongestTenGod;
      const coreRoleText = strongestTenGodInsights?.coreRole
        ?? (tgInfo
          ? `${tgInfo.shortDesc}의 방향으로 동기를 모으는 축`
          : '정보 없음');
      const strengthsText = strongestTenGodInsights?.strengths.length
        ? strongestTenGodInsights.strengths.slice(0, 3).join(' / ')
        : (tgInfo
          ? `${tgInfo.shortDesc}을(를) 강점으로 활용`
          : '강점 정보 없음');
      const cautionsText = strongestTenGodInsights?.cautions.length
        ? strongestTenGodInsights.cautions.slice(0, 3).join(' / ')
        : '과열 방지를 위한 페이스 조절이 필요해요.';

      return {
        title: '최강 십성 핵심 가이드',
        headers: ['십성', '핵심 역할', '강점', '주의점'],
        rows: [[tgLabel, coreRoleText, strengthsText, cautionsText]],
      };
    })()
    : null;

  // ── 레이더 차트 데이터 ────────────────────────────────────────────────
  const radarData: Record<string, number> = {};
  for (const cat of CATEGORY_KEYS) {
    radarData[TEN_GOD_CATEGORY_KOREAN[cat] ?? cat] = Math.round(categoryScores[cat] * 100) / 100;
  }
  const radarChart: ReportChart = {
    type: 'radar',
    title: '심리 역학 5각형 레이더 차트',
    data: radarData,
    meta: {
      axes: ['비겁(자아)', '식상(표현)', '재성(소유)', '관성(책임)', '인성(학습)'],
      description: '5대 십성 카테고리의 상대적 강도를 시각화한 심리 프로파일 차트',
    },
  };

  // ── 하이라이트 ────────────────────────────────────────────────────────
  const highlights: ReportHighlight[] = [
    {
      label: '최강 카테고리',
      value: `${TEN_GOD_CATEGORY_KOREAN[strongest] ?? strongest} (${totalScore > 0 ? Math.round((categoryScores[strongest] / totalScore) * 100) : 0}%)`,
      sentiment: 'good',
    },
    {
      label: '최약 카테고리',
      value: `${TEN_GOD_CATEGORY_KOREAN[weakest] ?? weakest} (${totalScore > 0 ? Math.round((categoryScores[weakest] / totalScore) * 100) : 0}%)`,
      sentiment: 'caution',
    },
  ];

  if (strongestTenGod) {
    const topInfo = TEN_GOD_BY_CODE[strongestTenGod];
    if (topInfo) {
      highlights.push({ label: '최강 십성', value: topInfo.korean, sentiment: 'good' });
    }
  }

  if (weakestTenGod && weakestTenGod !== strongestTenGod) {
    const bottomInfo = TEN_GOD_BY_CODE[weakestTenGod];
    if (bottomInfo) {
      highlights.push({ label: '최약 십성', value: bottomInfo.korean, sentiment: 'caution' });
    }
  }

  highlights.push({
    label: '프로파일 유형',
    value: isBalanced ? '균형형 (다면적 성격)' : '집중형 (전문가형)',
    sentiment: 'neutral',
  });

  return {
    id: 'tenGods',
    title: '십성(十神) 분포 분석',
    subtitle: '심리학적 관점에서 읽는 내면의 동기 체계',
    paragraphs,
    tables: strongestTenGodGuideTable ? [tenGodsTable, catTable, strongestTenGodGuideTable] : [tenGodsTable, catTable],
    charts: [radarChart],
    highlights,
  };
}
