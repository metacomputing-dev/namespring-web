/**
 * part5-relations.ts -- 합충형파해 관계망 섹션
 *
 * PART 5: 천간 관계(천간합, 천간충)와 지지 관계(육합, 삼합, 방합, 충, 형, 파, 해, 원진)를
 * 분석합니다.
 *
 * 페르소나: "관계 전문가 / 사회학자"
 * - 합충형파해를 인간관계·사회적 역학의 관점에서 풀어냅니다.
 * - 충/형 같은 부정적 관계도 성장의 기회로 재해석합니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportHighlight,
} from '../types.js';

import {
  elementCodeToKorean,
  lookupStemInfo,
  lookupBranchInfo,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  joinSentences,
  narrative,
  positive,
  caution,
  tip,
  emphasis,
  encouraging,
} from '../common/sentenceUtils.js';

import type { SeededRandom } from '../common/sentenceUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  상수 및 매핑
// ─────────────────────────────────────────────────────────────────────────────

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

/** 천간/지지 관계 유형의 한국어 표기 */
const RELATION_TYPE_KOREAN: Record<string, string> = {
  합: '천간합(天干合)',
  충: '천간충(天干冲)',
  HAP: '천간합(天干合)',
  CHUNG: '천간충(天干冲)',
  극: '천간극(天干剋)',
  GEUK: '천간극(天干剋)',
  육합: '육합(六合)',
  삼합: '삼합(三合)',
  방합: '방합(方合)',
  YUKHAP: '육합(六合)',
  SAMHAP: '삼합(三合)',
  BANGHAP: '방합(方合)',
  chung: '지지충(地支冲)',
  hyeong: '지지형(地支刑)',
  pa: '지지파(地支破)',
  hae: '지지해(地支害)',
  wonjin: '원진(怨嗔)',
};

/** 관계 유형별 톤 */
const RELATION_TONE: Record<string, 'positive' | 'negative' | 'neutral'> = {
  합: 'positive', 충: 'negative', 극: 'negative',
  HAP: 'positive', CHUNG: 'negative', GEUK: 'negative',
  육합: 'positive', 삼합: 'positive', 방합: 'positive',
  YUKHAP: 'positive', SAMHAP: 'positive', BANGHAP: 'positive',
  chung: 'negative', hyeong: 'negative', pa: 'negative',
  hae: 'negative', wonjin: 'negative',
};

// ─────────────────────────────────────────────────────────────────────────────
//  문장 템플릿 풀 — 관계 전문가/사회학자 페르소나
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '사주의 글자들은 하나의 사회를 이루고 있어요. 사람들 사이에 친밀한 유대가 있고, 때로는 갈등이 생기듯, 사주의 천간과 지지도 서로 복잡한 관계망을 형성하고 있이죠. 합(合)은 깊은 유대관계와 같고, 충(冲)은 의견 충돌과 같아요. 하지만 모든 충돌이 나쁜 건 아닙니다 — 혁신은 마찰에서 탄생하니까요.',
  '인간관계를 보면 가까운 사이일수록 서로 영향을 많이 주고받잖아요. 사주의 글자들도 마찬가지예요. 합은 서로를 끌어당기는 자석 같은 힘이고, 충은 건설적 토론 같은 에너지라고도 해요. 이 관계망을 살펴보면 인생의 조화 포인트와 성장 포인트를 함께 알 수 있답니다.',
  '한 팀이 잘 돌아가려면 화합도 필요하지만, 때로는 긴장감이 혁신을 이끌어내기도 하는 법이에요. 사주 속 합충형파해 관계는 바로 이런 팀 역학을 보여주는 거예요. 어떤 글자끼리 시너지를 내고, 어디서 건설적 마찰이 일어나는지 분석해 볼게요.',
  '사주의 관계망은 마치 인생이라는 무대 위의 인간관계 지도와 같아요. 합은 동맹이고, 충은 경쟁이며, 형은 시련 속 성장이에요. 파는 균열이고, 해는 거리감이죠. 이 모든 관계가 모여 {{이름}}님만의 고유한 인생 패턴을 만들어 내는 거라고 할 수 있겠네요.',
  '글자들 사이의 합충형파해를 분석하면, {{이름}}님의 인생에서 어떤 일이 자연스럽게 풀리고, 어디서 의미 있는 도전이 생길지 예측할 수 있어요. 갈등은 관계 발전의 촉매제이기도 하니까, 열린 마음으로 살펴보는 게 좋겠어요!',
  '합충형파해 분석은 사주의 "사회학"이라 할 수 있겠네요. 글자들 사이의 협력과 긴장, 시너지와 마찰을 입체적으로 파악하는 핵심 분석이거든요. 자, {{이름}}님의 관계망을 들여다볼게요.',
];

// ── 천간합(HAP) 템플릿 ──
const STEM_HAP_TEMPLATES: readonly string[] = [
  '{{글자들}} 사이에 {{관계}}이 성립해요. 이것은 마치 오랜 친구처럼 깊은 유대를 상징하는 관계이죠. {{설명}} 서로를 끌어당기는 자석 같은 힘이 작용하고 있어요.',
  '{{관계}}: {{글자들}} — {{설명}} 이 합은 결혼이나 동맹처럼 두 기운이 하나로 모이는 관계예요. 조화와 협력의 시너지가 만들어진답니다.',
  '{{글자들}}이 {{관계}}을 이루고 있어요. {{설명}} 마치 최고의 파트너십처럼, 서로의 부족함을 채워주는 아름다운 관계인 거랍니다.',
  '{{글자들}} 사이의 {{관계}}은 깊은 우정이나 강한 팀워크를 떠올리게 해요. {{설명}} 이 유대감은 안정과 조화의 원천이 되는 법이에요.',
  '{{관계}}({{글자들}}): {{설명}} 두 글자가 서로 화합하여 새로운 기운을 만들어 내는 관계예요. 가족 간의 끈끈한 정 같은 에너지라고도 해요.',
];

// ── 천간충(CHUNG) 템플릿 ──
const STEM_CHUNG_TEMPLATES: readonly string[] = [
  '{{글자들}}이 {{관계}}을 이루고 있어요. {{설명}} 하지만 충은 단순한 갈등이 아니에요 — 정체된 상황을 깨뜨리고 새로운 가능성을 여는 혁신의 불씨이기도 하거든요.',
  '{{관계}}: {{글자들}} — {{설명}} 충은 의견 차이가 빚는 건설적 논쟁과 같아요. 이 긴장이 오히려 성장의 동력이 되기도 한답니다.',
  '{{글자들}} 사이에 {{관계}}이 있어요. {{설명}} 사회학에서는 갈등이 관계 발전의 촉매제라고 해요. 이 충도 변화와 발전의 신호라 할 수 있겠네요.',
  '{{관계}}({{글자들}}): {{설명}} 충은 마치 경쟁 관계와 같아요. 서로 밀어내지만, 그 과정에서 더 강해지는 법이에요. 긴장은 성장의 전조이기도 하거든요.',
  '{{글자들}}의 {{관계}}은 팀 내 건설적 갈등과 비슷해요. {{설명}} 충돌이 없는 조직은 혁신도 없는 법이라, 이 에너지를 잘 활용하면 큰 전환점이 될 수 있이죠.',
];

// ── 지지 합류 (육합, 삼합, 방합) 템플릿 ──
const BRANCH_HAP_TEMPLATES: readonly string[] = [
  '{{글자들}}이 {{관계}}을 이루고 있어요. {{설명}} 이것은 여러 사람이 한마음으로 뭉치는 강력한 네트워크와 같은 관계예요. 시너지가 대단하답니다!',
  '{{관계}}: {{글자들}} — {{설명}} 마치 뜻이 맞는 동료들이 팀을 이루는 것처럼, 자연스럽게 힘이 모이는 관계인 거랍니다.',
  '{{글자들}} 사이의 {{관계}}은 깊은 동맹 관계를 나타내요. {{설명}} 가족처럼 끈끈하게 뭉쳐서 큰 힘을 발휘하는 구조라고도 해요.',
  '{{관계}}({{글자들}}): {{설명}} 합은 인간관계에서의 깊은 신뢰와 같아요. 이 글자들이 모여 강력한 지지 기반을 만들어 주는 법이에요.',
  '{{글자들}}의 {{관계}}은 사회적 연대의 힘을 보여줘요. {{설명}} 혼자서는 어려운 일도 함께라면 가능하다는 것, 이 합이 증명해 주고 있어요.',
];

// ── 지지 충 템플릿 ──
const BRANCH_CHUNG_TEMPLATES: readonly string[] = [
  '{{글자들}}이 {{관계}} 관계에 있어요. {{설명}} 충은 급격한 변화의 에너지예요. 때로는 불편하지만, 정체된 삶에 활력을 불어넣어 주기도 한답니다.',
  '{{관계}}: {{글자들}} — {{설명}} 충은 삶의 전환점을 만들어 내는 에너지예요. 낡은 것을 허물고 새것을 세우는 힘이라 할 수 있겠네요.',
  '{{글자들}} 사이의 {{관계}}은 마치 세대 간 갈등과 비슷해요. {{설명}} 하지만 이런 긴장에서 새로운 이해와 성장이 싹트는 법이에요.',
  '{{관계}}({{글자들}}): {{설명}} 충은 "충격적 전환"을 뜻하기도 해요. 불편하지만 성장하는 사람은 대부분 이런 변화를 겪어왔이죠.',
  '{{글자들}}의 {{관계}}은 강한 대립의 에너지를 품고 있어요. {{설명}} 사회학에서 말하는 "창조적 파괴" — 부딪히며 더 나은 것을 만들어 내는 과정이라고도 해요.',
];

// ── 지지 형 템플릿 ──
const BRANCH_HYEONG_TEMPLATES: readonly string[] = [
  '{{글자들}}이 {{관계}} 관계에 있어요. {{설명}} 형은 시련과 단련을 의미해요. 마치 혹독한 훈련을 거친 운동선수가 더 강해지듯, 이 관계는 내면의 성장을 이끌어 내는 거랍니다.',
  '{{관계}}: {{글자들}} — {{설명}} 형은 마찰이지만, 다이아몬드는 다이아몬드로만 깎을 수 있잖아요. 어려움 속에서 빛나는 존재가 되는 과정이에요.',
  '{{글자들}} 사이의 {{관계}}은 성장통과 같아요. {{설명}} 지금은 불편하지만, 이 과정을 지나면 한 단계 더 성숙해진 자신을 발견하게 될 거예요.',
  '{{관계}}({{글자들}}): {{설명}} 형은 인간관계에서의 시련이에요. 하지만 진짜 깊은 관계는 시련을 함께 넘긴 후에 완성되는 법이라고도 해요.',
  '{{글자들}}의 {{관계}}은 서로를 깎아내는 듯하지만, 사실은 서로를 다듬어 주는 관계이기도 해요. {{설명}} 갈등 없는 성장은 없는 거니까요.',
];

// ── 지지 파 템플릿 ──
const BRANCH_PA_TEMPLATES: readonly string[] = [
  '{{글자들}}이 {{관계}} 관계에 있어요. {{설명}} 파는 작은 금이 가는 것과 같아요. 큰 문제는 아니지만, 미리 알고 관리하면 더 좋은 결과를 만들 수 있이죠.',
  '{{관계}}: {{글자들}} — {{설명}} 파는 관계에 미세한 균열이 생기는 것이에요. 하지만 일본의 금선 수리 기법(킨쓰기)처럼, 균열을 메우면 오히려 더 아름다워지는 법이에요.',
  '{{글자들}} 사이의 {{관계}}은 미세한 불협화음을 나타내요. {{설명}} 완벽한 화음만으로는 음악이 지루하듯, 약간의 변주가 인생을 풍성하게 만들기도 한답니다.',
  '{{관계}}({{글자들}}): {{설명}} 파는 기존 패턴이 깨지는 것이에요. 하지만 깨진 틀에서 새로운 가능성이 열리는 거라, 너무 걱정할 필요는 없어요.',
];

// ── 지지 해 템플릿 ──
const BRANCH_HAE_TEMPLATES: readonly string[] = [
  '{{글자들}}이 {{관계}} 관계에 있어요. {{설명}} 해는 서로 간에 거리감이 생기는 에너지예요. 하지만 적절한 거리가 오히려 관계를 건강하게 유지해 주는 마련이거든요.',
  '{{관계}}: {{글자들}} — {{설명}} 해는 소원해지는 기운이지만, 모든 관계에 적당한 공간이 필요하듯 나쁘기만 한 건 아니에요.',
  '{{글자들}} 사이의 {{관계}}은 관계의 거리감을 나타내요. {{설명}} 때로는 한 발짝 물러서는 것이 더 넓은 시야를 가져다주는 법이에요.',
  '{{관계}}({{글자들}}): {{설명}} 해는 "가까이하기엔 너무 먼 당신" 같은 관계예요. 하지만 거리를 둔다고 끝나는 게 아니라, 새로운 방식으로 만나는 시작이기도 하이죠.',
];

// ── 원진 템플릿 ──
const BRANCH_WONJIN_TEMPLATES: readonly string[] = [
  '{{글자들}}이 {{관계}} 관계에 있어요. {{설명}} 원진은 깊은 오해나 미묘한 불편함을 뜻해요. 하지만 오해는 대화로 풀 수 있고, 이 과정에서 더 깊은 이해가 생기기도 한답니다.',
  '{{관계}}: {{글자들}} — {{설명}} 원진은 서로 미묘하게 어긋나는 에너지예요. 하지만 어긋남이 있어야 맞춤의 소중함을 알게 되는 법이에요.',
  '{{글자들}} 사이의 {{관계}}은 말 없는 불편함과 비슷해요. {{설명}} 이 불편함을 인식하는 것 자체가 해결의 첫걸음이라 할 수 있겠네요.',
  '{{관계}}({{글자들}}): {{설명}} 원진은 관계에서의 미묘한 긴장이에요. 다만 긴장을 의식하고 주의를 기울이면, 오히려 세심한 관계를 가꿀 수 있는 기회가 되기도 해요.',
];

// ── 관계 없음 템플릿 ──
const NO_RELATIONS_TEMPLATES: readonly string[] = [
  '{{이름}}님의 사주에는 특별히 두드러진 합충형파해 관계가 적은 편이에요. 이것은 마치 평화로운 마을처럼, 비교적 안정적인 에너지 구조를 가지고 있다는 뜻이에요. 큰 파도 없이 꾸준히 나아가는 삶의 리듬을 타고난 거랍니다.',
  '뚜렷한 합이나 충 없이 사주의 기운이 고요한 편이에요. {{이름}}님은 큰 변동보다는 꾸준한 성장의 길을 걸어가는 스타일이라 할 수 있겠네요. 조용한 물이 깊다는 말처럼, 내면의 힘이 단단한 구조예요.',
];

// ── 마무리 템플릿 ──
const CLOSING_TEMPLATES: readonly string[] = [
  '합충형파해는 고정된 운명이 아니에요. 대운이나 세운에서 새로운 글자가 들어오면 기존 관계가 변하기도 하거든요. 마치 새 팀원이 합류하면 팀 역학이 바뀌듯, 인생의 전환점마다 새로운 관계가 만들어진답니다.',
  '이 관계망은 원국의 기본 설계도와 같아요. 대운과 세운이라는 "외부 인연"이 들어올 때마다 관계망이 역동적으로 변하게 돼요. 합이 충으로, 충이 합으로 바뀌기도 하는 법이에요.',
  '합은 조화, 충은 변화, 형은 단련, 파는 재구성, 해는 재조정의 에너지예요. 어떤 관계든 잘 이해하고 활용하면, 인생이라는 팀 프로젝트를 더 지혜롭게 운영할 수 있이죠!',
  '결국 중요한 것은 관계의 종류가 아니라, 그 관계를 어떻게 활용하느냐예요. 합은 감사하게, 충은 성장의 기회로, 형은 내면의 단련으로 받아들이면 모든 관계가 인생의 자산이 될 수 있답니다.',
  '관계망 분석이 끝났어요. 이 정보는 대운·세운 흐름을 읽을 때도 핵심적으로 활용돼요. 새로운 대운이 올 때마다 이 관계망이 어떻게 변하는지 주목해 보세요!',
];

// ── 합 긍정 재해석 보충 ──
const HAP_POSITIVE_ADDONS: readonly string[] = [
  '이 합의 에너지는 대인관계에서 자연스러운 매력으로 발현되기도 해요.',
  '합이 있으면 주변 사람들과의 조화가 잘 이루어지는 경향이 있어요.',
  '이 유대감은 어려운 시기에 든든한 지지 기반이 되어 준답니다.',
  '합의 기운은 협업이나 파트너십에서 특히 좋은 결과를 만들어 내요.',
];

// ── 충/형 긍정 재해석 보충 ──
const CONFLICT_REFRAME_ADDONS: readonly string[] = [
  '이 긴장감이 오히려 삶에 활력을 불어넣어 줄 수 있어요.',
  '갈등 에너지를 잘 활용하면 큰 도약의 발판이 되기도 한답니다.',
  '심리학에서는 "적절한 스트레스가 최고의 성과를 만든다"고 해요.',
  '이 에너지는 변화를 두려워하지 않는 용기의 원천이기도 해요.',
  '위기는 곧 기회라는 말이 있듯, 이 관계 에너지가 전환의 계기가 될 수 있어요.',
];

// ── 관계 유형별 사회학적 통찰 ──
const SOCIOLOGICAL_INSIGHTS: Record<string, readonly string[]> = {
  hap: [
    '사회학에서는 강한 유대(strong tie)가 안정감과 지지를 제공한다고 해요.',
    '네트워크 이론에서 합은 "허브 연결" — 핵심 인맥의 중심이 되는 에너지예요.',
    '집단 심리학에서 합의 에너지는 "소속감"의 원천이라 할 수 있어요.',
  ],
  chung: [
    '갈등 이론에서는 적절한 충돌이 조직의 혁신을 이끈다고 봐요.',
    '사회학자 짐멜은 "갈등은 사회적 유대의 한 형태"라고 했어요.',
    '변증법적으로 충은 "반(反)" — 새로운 합(合)을 위한 전 단계이기도 해요.',
  ],
  hyeong: [
    '심리학에서 성장은 "불편 영역(discomfort zone)"을 통과할 때 일어난다고 해요.',
    '형의 에너지는 "연마"와 같아요. 다이아몬드도 원석을 깎아야 빛나는 법이에요.',
  ],
  pa: [
    '조직학에서는 "창조적 파괴"가 혁신의 핵심 동력이라고 해요.',
    '기존 패턴이 깨질 때 새로운 가능성의 문이 열리는 법이에요.',
  ],
  hae: [
    '건강한 관계에는 적절한 "경계(boundary)"가 필요하다고 심리학에서 말해요.',
    '거리감은 때로 객관적 시야를 확보하는 데 도움이 되기도 해요.',
  ],
  wonjin: [
    '오해는 대화의 부족에서 비롯되는 경우가 많아요. 인식이 첫 번째 해결책이에요.',
    '미묘한 불편함을 알아차리는 것 자체가 성숙한 관계의 시작이라 할 수 있어요.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  관계 유형 분류 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/** 지지 관계 유형을 광역 카테고리로 매핑 */
function branchRelationCategory(type: string): 'hap' | 'chung' | 'hyeong' | 'pa' | 'hae' | 'wonjin' | 'unknown' {
  const t = type.toLowerCase().replace(/\s/g, '');
  if (t.includes('육합') || t.includes('삼합') || t.includes('방합')
    || t === 'yukhap' || t === 'samhap' || t === 'banghap'
    || t === '합' || t === 'hap') return 'hap';
  if (t.includes('충') || t === 'chung') return 'chung';
  if (t.includes('형') || t === 'hyeong') return 'hyeong';
  if (t.includes('파') || t === 'pa') return 'pa';
  if (t.includes('해') || t === 'hae') return 'hae';
  if (t.includes('원진') || t === 'wonjin') return 'wonjin';
  return 'unknown';
}

/** 천간 관계 유형의 광역 카테고리 */
function stemRelationCategory(type: string): 'hap' | 'chung' | 'geuk' | 'unknown' {
  const t = type.toLowerCase().replace(/\s/g, '');
  if (t.includes('합') || t === 'hap') return 'hap';
  if (t.includes('충') || t === 'chung') return 'chung';
  if (t.includes('극') || t === 'geuk') return 'geuk';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
//  단락 생성 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function pickBranchTemplates(category: string): readonly string[] {
  switch (category) {
    case 'hap': return BRANCH_HAP_TEMPLATES;
    case 'chung': return BRANCH_CHUNG_TEMPLATES;
    case 'hyeong': return BRANCH_HYEONG_TEMPLATES;
    case 'pa': return BRANCH_PA_TEMPLATES;
    case 'hae': return BRANCH_HAE_TEMPLATES;
    case 'wonjin': return BRANCH_WONJIN_TEMPLATES;
    default: return BRANCH_CHUNG_TEMPLATES;
  }
}

/** 보충 문장(addon)을 선택적으로 덧붙여 다양성을 높인다. */
function maybeAddon(rng: SeededRandom, category: string): string {
  // 약 60% 확률로 addon을 추가
  if (rng.next() > 0.6) return '';

  if (category === 'hap') {
    return ' ' + rng.pick(HAP_POSITIVE_ADDONS);
  }
  if (category === 'chung' || category === 'hyeong' || category === 'pa') {
    return ' ' + rng.pick(CONFLICT_REFRAME_ADDONS);
  }
  return '';
}

/** 사회학적 통찰을 선택적으로 덧붙인다 (약 45% 확률). */
function maybeSociologicalInsight(rng: SeededRandom, category: string): string {
  if (rng.next() > 0.45) return '';
  const pool = SOCIOLOGICAL_INSIGHTS[category];
  if (!pool || pool.length === 0) return '';
  return ' ' + rng.pick(pool);
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateRelationsSection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 24; i++) rng.next();

  const name = safeName(input);
  const { cheonganRelations, jijiRelations } = input.saju;

  const paragraphs: ReportParagraph[] = [];
  let relationCount = 0;
  const tableRows: string[][] = [];

  // ── 도입 ──
  const introText = pickAndFill(rng, INTRO_TEMPLATES, { 이름: name });
  paragraphs.push(narrative(introText));

  // ─── 천간 관계 ───
  if (cheonganRelations && cheonganRelations.length > 0) {
    paragraphs.push(emphasis('천간(天干) 관계'));

    for (const rel of cheonganRelations) {
      relationCount++;
      const typeKo = RELATION_TYPE_KOREAN[rel.type] ?? rel.type;
      const stemNames = rel.stems.map(s => {
        const info = lookupStemInfo(s);
        return info ? `${info.hangul}(${info.hanja})` : s;
      }).join(', ');

      const cat = stemRelationCategory(rel.type);
      const isHap = cat === 'hap';
      const templates = isHap ? STEM_HAP_TEMPLATES : STEM_CHUNG_TEMPLATES;

      const defaultDesc = isHap
        ? '서로 합하여 새로운 기운을 만들어 내요.'
        : '서로 부딪히며 변화의 에너지를 일으켜요.';

      const baseText = pickAndFill(rng, templates, {
        글자들: stemNames,
        관계: typeKo,
        설명: rel.note || defaultDesc,
      });

      const addon = maybeAddon(rng, isHap ? 'hap' : 'chung');
      const insight = maybeSociologicalInsight(rng, isHap ? 'hap' : 'chung');
      const fullText = joinSentences(baseText, addon, insight);

      paragraphs.push(isHap ? positive(fullText) : caution(fullText));

      tableRows.push([
        '천간',
        typeKo,
        stemNames,
        rel.resultElement ? elementCodeToKorean(rel.resultElement) : '-',
        rel.note || '',
      ]);
    }
  }

  // ─── 지지 관계 ───
  if (jijiRelations && jijiRelations.length > 0) {
    paragraphs.push(emphasis('지지(地支) 관계'));

    for (const rel of jijiRelations) {
      relationCount++;
      const typeKo = RELATION_TYPE_KOREAN[rel.type] ?? rel.type;
      const branchNames = rel.branches.map(b => {
        const info = lookupBranchInfo(b);
        return info ? `${info.hangul}(${info.hanja})` : b;
      }).join(', ');

      const cat = branchRelationCategory(rel.type);
      const tone = RELATION_TONE[rel.type] ?? (cat === 'hap' ? 'positive' : cat === 'unknown' ? 'neutral' : 'negative');
      const templates = pickBranchTemplates(cat);

      const defaultDesc = tone === 'positive'
        ? '글자들이 서로 힘을 합쳐요.'
        : '변화를 일으키는 에너지가 있어요.';

      const baseText = pickAndFill(rng, templates, {
        글자들: branchNames,
        관계: typeKo,
        설명: rel.note || rel.reasoning || defaultDesc,
      });

      const addon = maybeAddon(rng, cat);
      const insight = maybeSociologicalInsight(rng, cat);
      const fullText = joinSentences(baseText, addon, insight);

      if (tone === 'positive') {
        paragraphs.push(positive(fullText));
      } else if (tone === 'negative') {
        paragraphs.push(caution(fullText));
      } else {
        paragraphs.push(narrative(fullText));
      }

      tableRows.push([
        '지지',
        typeKo,
        branchNames,
        rel.outcome ?? '-',
        rel.note || rel.reasoning || '',
      ]);
    }
  }

  // ─── 관계가 하나도 없는 경우 ───
  if (relationCount === 0) {
    const noRelText = pickAndFill(rng, NO_RELATIONS_TEMPLATES, { 이름: name });
    paragraphs.push(narrative(noRelText));
  }

  // ─── 관계망 요약 팁 ───
  if (relationCount > 0) {
    const hapTotal = countHap(cheonganRelations, jijiRelations);
    const conflictTotal = countConflicts(cheonganRelations, jijiRelations);

    if (hapTotal > conflictTotal) {
      paragraphs.push(tip(
        `전체적으로 합(合)이 ${hapTotal}개로 충돌 관계(${conflictTotal}개)보다 많아요. ` +
        '조화와 협력의 기운이 풍부한 사주 구조인 거랍니다. 대인관계에서 자연스러운 친화력이 빛을 발할 거예요.',
      ));
    } else if (conflictTotal > hapTotal) {
      paragraphs.push(tip(
        `충돌 관계(${conflictTotal}개)가 합(${hapTotal}개)보다 많지만, 이것은 변화와 도전이 풍부한 역동적 사주라는 뜻이에요. ` +
        '정체 없이 끊임없이 발전하는 인생을 살게 될 가능성이 높답니다!',
      ));
    } else if (hapTotal > 0) {
      paragraphs.push(tip(
        `합과 충이 ${hapTotal}개씩 균형을 이루고 있어요. 조화와 변화가 교차하는 균형 잡힌 관계망이에요. ` +
        '안정 속에서도 적절한 변화가 성장을 이끌어 줄 거예요.',
      ));
    }
  }

  // ─── 마무리 ───
  paragraphs.push(encouraging(rng.pick(CLOSING_TEMPLATES)));

  // ─── 테이블: 관계망 요약 ───
  const tables: ReportTable[] = [];
  if (tableRows.length > 0) {
    tables.push({
      title: '합충형파해 관계 일람표',
      headers: ['구분', '관계 유형', '관련 글자', '결과/산출', '설명'],
      rows: tableRows,
    });
  }

  // ─── 하이라이트 ───
  const hapCount = countHap(cheonganRelations, jijiRelations);
  const chungCount = countChung(cheonganRelations, jijiRelations);
  const otherNegCount = countOtherNegatives(jijiRelations);

  const highlights: ReportHighlight[] = [
    {
      label: '합(合) 관계',
      value: `${hapCount}개`,
      sentiment: hapCount > 0 ? 'good' : 'neutral',
    },
    {
      label: '충(冲) 관계',
      value: `${chungCount}개`,
      sentiment: chungCount > 0 ? 'caution' : 'good',
    },
  ];

  if (otherNegCount > 0) {
    highlights.push({
      label: '형/파/해/원진',
      value: `${otherNegCount}개`,
      sentiment: 'caution',
    });
  }

  highlights.push({
    label: '총 관계',
    value: `${relationCount}개`,
    sentiment: 'neutral',
  });

  return {
    id: 'stemRelations',
    title: '합충형파해 관계망',
    subtitle: '글자들의 동맹과 갈등, 시너지와 성장의 지도',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    highlights,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  집계 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function countHap(
  cheongan: ReportInput['saju']['cheonganRelations'],
  jiji: ReportInput['saju']['jijiRelations'],
): number {
  const stemHap = (cheongan ?? []).filter(r => stemRelationCategory(r.type) === 'hap').length;
  const branchHap = (jiji ?? []).filter(r => branchRelationCategory(r.type) === 'hap').length;
  return stemHap + branchHap;
}

function countChung(
  cheongan: ReportInput['saju']['cheonganRelations'],
  jiji: ReportInput['saju']['jijiRelations'],
): number {
  const stemChung = (cheongan ?? []).filter(r => {
    const cat = stemRelationCategory(r.type);
    return cat === 'chung' || cat === 'geuk';
  }).length;
  const branchChung = (jiji ?? []).filter(r => branchRelationCategory(r.type) === 'chung').length;
  return stemChung + branchChung;
}

function countConflicts(
  cheongan: ReportInput['saju']['cheonganRelations'],
  jiji: ReportInput['saju']['jijiRelations'],
): number {
  const stemConflict = (cheongan ?? []).filter(r => {
    const cat = stemRelationCategory(r.type);
    return cat === 'chung' || cat === 'geuk';
  }).length;
  const branchConflict = (jiji ?? []).filter(r => {
    const cat = branchRelationCategory(r.type);
    return cat !== 'hap' && cat !== 'unknown';
  }).length;
  return stemConflict + branchConflict;
}

function countOtherNegatives(
  jiji: ReportInput['saju']['jijiRelations'],
): number {
  return (jiji ?? []).filter(r => {
    const cat = branchRelationCategory(r.type);
    return cat === 'hyeong' || cat === 'pa' || cat === 'hae' || cat === 'wonjin';
  }).length;
}
