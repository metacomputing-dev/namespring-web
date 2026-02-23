/**
 * part8-nameBasic.ts -- 추천 이름 기본 정보 섹션 (이름 연구소 소장 페르소나)
 *
 * PART 8-1: 추천 이름의 한자·한글·뜻, 각 글자 획수(원획), 자원오행(부수 기반)을 분석합니다.
 *
 * 창의적 지침:
 * - "이름 연구소 소장"이 이름의 숨겨진 에너지를 탐구하는 톤
 * - 초등학생~중학생도 이해할 수 있는 친근한 말투
 * - 글자 하나하나에 담긴 의미를 풍부하고 따뜻하게 설명
 * - 자원오행과 사주 용신의 관계를 쉽게 풀어서 해석
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_COLOR,
  ELEMENT_NATURE,
  ELEMENT_GENERATES,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLS,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_EMOTION,
  ELEMENT_ORGAN,
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_SEASON,
  ELEMENT_FOOD,
  getElementRelation,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  fillTemplate,
  narrative,
  positive,
  caution,
  tip,
  emphasis,
  encouraging,
  joinSentences,
  listJoin,
  SeededRandom,
} from '../common/sentenceUtils.js';
import { getNamingPrincipleChecklist } from '../knowledge/namingPrinciplesEncyclopedia.js';

// ─────────────────────────────────────────────────────────────────────────────
//  헬퍼: 이름 및 오행 표시
// ─────────────────────────────────────────────────────────────────────────────

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

/** Title case ("Wood") → UPPER case ("WOOD") 변환 */
function normalizeElement(el: string | null | undefined): ElementCode | null {
  if (!el) return null;
  const upper = el.toUpperCase();
  if (upper === 'WOOD' || upper === 'FIRE' || upper === 'EARTH' || upper === 'METAL' || upper === 'WATER') {
    return upper as ElementCode;
  }
  return null;
}

function elFull(c: string | null | undefined): string {
  if (!c) return '?';
  const norm = normalizeElement(c);
  return norm ? (ELEMENT_KOREAN[norm] ?? c) : c;
}

function elShort(c: string | null | undefined): string {
  if (!c) return '?';
  const norm = normalizeElement(c);
  return norm ? (ELEMENT_KOREAN_SHORT[norm] ?? c) : c;
}

function elHanja(c: string | null | undefined): string {
  if (!c) return '?';
  const norm = normalizeElement(c);
  return norm ? (ELEMENT_HANJA[norm] ?? c) : c;
}

function parseNamingChecklistLine(line: string): { principle: string; item: string } {
  const trimmed = line.trim();
  const match = /^\[([^\]]+)\]\s*(.+)$/.exec(trimmed);
  if (!match) {
    return { principle: '기본 점검', item: trimmed };
  }
  return {
    principle: match[1].trim(),
    item: match[2].trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  오행 이모지/아이콘 매핑 (시각적 친근함)
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENT_EMOJI: Record<string, string> = {
  WOOD: '🌳', FIRE: '🔥', EARTH: '🏔️', METAL: '⚙️', WATER: '💧',
};

function elEmoji(c: string | null | undefined): string {
  const norm = normalizeElement(c);
  return norm ? (ELEMENT_EMOJI[norm] ?? '') : '';
}

// ─────────────────────────────────────────────────────────────────────────────
//  오행별 자연 비유 (아이 눈높이)
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENT_CHILD_METAPHOR: Record<string, string[]> = {
  WOOD: [
    '봄에 새싹이 쑥쑥 자라는 것처럼, 목(木)의 기운은 "성장"을 뜻해요.',
    '나무가 하늘을 향해 쭉쭉 뻗어가듯, 목(木)은 끊임없이 위를 향하는 에너지예요.',
    '씨앗이 땅을 뚫고 올라오는 힘! 그게 바로 목(木)의 기운이에요.',
    '숲속의 큰 나무처럼 꿋꿋하게 자라는 힘이 목(木)에 담겨 있어요.',
  ],
  FIRE: [
    '캠프파이어처럼 환하게 타오르는 것! 화(火)의 기운은 "열정"을 뜻해요.',
    '여름 태양처럼 밝고 뜨거운 에너지가 화(火)에 담겨 있어요.',
    '촛불이 어둠을 밝히듯, 화(火)는 세상을 환하게 비추는 기운이에요.',
    '불꽃이 활활 타오르는 것처럼, 화(火)에는 뜨거운 열정의 에너지가 들어 있어요.',
  ],
  EARTH: [
    '넓은 들판처럼 모든 것을 품어주는 것! 토(土)의 기운은 "안정"을 뜻해요.',
    '우리가 딛고 서 있는 땅처럼, 토(土)는 든든한 기반이 되어주는 에너지예요.',
    '가을 들녘에 곡식이 무르익듯, 토(土)는 풍요롭고 든든한 기운이에요.',
    '산이 묵묵히 제자리를 지키듯, 토(土)에는 흔들리지 않는 안정감이 있어요.',
  ],
  METAL: [
    '반짝반짝 빛나는 보석처럼, 금(金)의 기운은 "결단"을 뜻해요.',
    '가을바람처럼 선선하고 맑은 에너지가 금(金)에 담겨 있어요.',
    '날카로운 칼이 무엇이든 잘라내듯, 금(金)은 결단력 있는 기운이에요.',
    '다이아몬드처럼 단단하고 빛나는 힘이 금(金)의 에너지예요.',
  ],
  WATER: [
    '졸졸 흐르는 시냇물처럼, 수(水)의 기운은 "지혜"를 뜻해요.',
    '깊은 바다처럼 끝없는 가능성을 품고 있는 것이 수(水)의 에너지예요.',
    '물은 어떤 그릇에든 담길 수 있잖아요? 수(水)는 그만큼 유연한 기운이에요.',
    '겨울에 내린 눈이 봄에 녹아 새 생명을 키우듯, 수(水)에는 재생의 힘이 있어요.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  자원오행 설명 (부수 기반 원리)
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCE_ELEMENT_EXPLAIN: Record<string, string[]> = {
  WOOD: [
    '이 글자의 뿌리(부수)를 살펴보면 나무(木)와 관련된 형태가 숨어 있어요. 그래서 자원오행이 목(木)이 되는 거예요!',
    '한자를 쪼개서 보면, 이 글자 안에 나무나 풀과 연결된 부수가 들어 있어요. 자연스럽게 목(木)의 기운을 품고 있는 셈이죠.',
    '이 글자는 나무·식물과 관련된 부수를 가지고 있어서, 자원오행으로 목(木)에 해당해요. 성장과 생명력의 에너지가 글자 속에 깃들어 있는 거예요.',
  ],
  FIRE: [
    '이 글자의 부수를 들여다보면 불(火)이나 빛과 관련된 모양이 보여요. 그래서 자원오행이 화(火)예요!',
    '한자의 뿌리에 불꽃이나 햇빛과 연결된 부수가 숨어 있어요. 밝고 뜨거운 화(火)의 기운이 이 글자에 담겨 있는 거예요.',
    '이 글자 안에는 불·빛·열과 관련된 부수가 있어서, 자원오행으로 화(火)에 해당해요. 열정과 빛의 에너지를 가지고 있답니다.',
  ],
  EARTH: [
    '이 글자의 부수를 살펴보면 흙(土)이나 산과 관련된 형태가 보여요. 그래서 자원오행이 토(土)예요!',
    '한자의 뿌리에 땅이나 언덕과 연결된 부수가 들어 있어요. 안정감 있는 토(土)의 기운이 글자 속에 자리 잡고 있는 거예요.',
    '이 글자는 흙·산·돌과 관련된 부수를 가지고 있어서, 자원오행으로 토(土)에 해당해요. 든든한 대지의 에너지가 들어 있답니다.',
  ],
  METAL: [
    '이 글자의 부수를 들여다보면 쇠(金)나 금속과 관련된 모양이 숨어 있어요. 그래서 자원오행이 금(金)이에요!',
    '한자의 뿌리에 금속이나 칼과 연결된 부수가 보여요. 날카롭고 단단한 금(金)의 기운이 이 글자에 깃들어 있는 거예요.',
    '이 글자 안에는 쇠·금속·보석과 관련된 부수가 있어서, 자원오행으로 금(金)에 해당해요. 결단과 빛남의 에너지를 품고 있답니다.',
  ],
  WATER: [
    '이 글자의 부수를 살펴보면 물(水)이나 비와 관련된 형태가 보여요. 그래서 자원오행이 수(水)예요!',
    '한자의 뿌리에 물이나 강과 연결된 부수가 들어 있어요. 깊고 지혜로운 수(水)의 기운이 글자 속에 흐르고 있는 거예요.',
    '이 글자는 물·얼음·비와 관련된 부수를 가지고 있어서, 자원오행으로 수(水)에 해당해요. 지혜와 유연함의 에너지가 숨어 있답니다.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  원획(原劃) 설명 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const STROKE_EXPLAIN_TEMPLATES: readonly string[] = [
  '이 글자의 획수는 {{획수}}획이에요. 성명학에서는 강희자전(康熙字典)의 원획(原劃)을 기준으로 삼아요. 원획이란 부수를 원래 한자로 되돌려서 세는 방법이에요. 예를 들어 삼수변(氵)은 물 수(水) 4획으로 세고, 풀 초(艹)는 6획으로 세는 식이죠.',
  '{{획수}}획짜리 글자예요! 성명학에서 쓰는 "원획"은 약자(略字)로 줄어든 부수를 원래 글자로 돌려놓고 획수를 세는 방법이에요. 보통 필기체 획수와 다를 수 있는데, 이게 성명학의 정통 방식이랍니다.',
  '이 글자는 원획 기준으로 {{획수}}획이에요. 원획은 한자의 부수를 축약 전 본래 글자로 환원해서 세는 전통적인 방법이에요. 그래서 보통 옥편의 획수와 약간 다를 수 있어요.',
  '성명학에서 획수를 셀 때는 "원획"이라는 특별한 방법을 써요. 부수를 줄이기 전 원래 한자의 획수로 돌려서 세는 거예요. 이 글자는 원획으로 {{획수}}획이랍니다!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  도입부 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '안녕하세요, 이름 연구소 소장이에요! 오늘은 {{이름}}님의 이름에 어떤 비밀이 숨어 있는지, 한 글자 한 글자 꼼꼼히 탐구해 볼 거예요. 이름이란 그냥 부르는 말이 아니라, 글자 하나하나에 우주의 에너지가 담겨 있거든요!',
  '이름 연구소에 오신 걸 환영해요! {{이름}}님, 이름 속에 숨겨진 놀라운 에너지를 함께 발견해 볼까요? 한자 한 글자마다 고유한 뜻과 기운이 있어서, 이름은 일종의 "에너지 레시피" 같은 거예요!',
  '반가워요! 이름 연구소 소장으로서 {{이름}}님의 이름을 분석하게 되어 정말 설레요. 이름은 매일 불리면서 그 사람에게 에너지를 전해주는 마법 같은 존재거든요. 지금부터 그 마법의 비밀을 풀어볼게요!',
  '{{이름}}님, 이름 연구소 소장이 인사드려요! 혹시 이름에도 DNA가 있다는 거 알고 있었나요? 한자의 부수, 획수, 뜻 — 이 세 가지가 이름의 DNA를 이루는 핵심 요소예요. 지금부터 하나씩 분석해 드릴게요.',
  '여기는 이름의 숨겨진 에너지를 연구하는 이름 연구소예요! {{이름}}님의 이름을 돋보기로 들여다보면, 한자 한 글자마다 놀라운 이야기가 숨어 있답니다. 함께 탐험을 시작해 볼까요?',
];

// ─────────────────────────────────────────────────────────────────────────────
//  자원오행 개념 설명 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const JAWON_CONCEPT_TEMPLATES: readonly string[] = [
  '먼저 "자원오행(字源五行)"이 뭔지 알려드릴게요! 자원오행이란, 한자가 처음 만들어질 때부터 가지고 있는 고유한 오행 에너지예요. 한자의 부수(部首) — 그러니까 글자의 "뿌리" 부분 — 를 보면 그 글자가 나무(木), 불(火), 흙(土), 쇠(金), 물(水) 중 어떤 기운을 가졌는지 알 수 있어요.',
  '이름 분석의 첫 번째 열쇠는 "자원오행(字源五行)"이에요! 한자는 상형문자이자 뜻글자잖아요? 그래서 글자 속에 있는 부수(部首)를 분석하면 그 글자가 어떤 자연의 기운을 품고 있는지 파악할 수 있어요. 이것이 바로 자원오행이랍니다.',
  '"자원오행"이라는 말이 좀 어렵게 느껴질 수 있는데, 쉽게 말하면 "글자의 원래 오행 에너지"예요! 한자를 분해하면 부수(部首)라는 기본 조각이 나오는데, 이 부수가 나무·불·흙·쇠·물 중 뭐와 관련 있느냐에 따라 오행이 결정되는 거예요.',
  '자원오행(字源五行)이 뭐냐고요? 한자는 옛날 사람들이 자연을 보고 그림처럼 만든 글자예요. 그래서 글자 안에 자연의 에너지가 숨어 있어요! 부수라는 "글자의 뿌리"를 보면, 그 글자가 목·화·토·금·수 중 어떤 기운인지 알 수 있답니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  원획 개념 설명 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const WONHWAK_CONCEPT_TEMPLATES: readonly string[] = [
  '다음으로 "원획(原劃)"에 대해 알아볼게요! 성명학에서 획수를 셀 때는 보통 방식과 좀 달라요. 부수가 줄임 표기로 바뀐 경우, 원래 한자의 획수로 돌려서 세거든요. 예를 들면 삼수변(氵)은 3획이 아니라 물 수(水) 자의 4획으로 세요. 이렇게 원래대로 돌려서 세는 방법이 "원획"이에요!',
  '획수를 이야기할 때 빠질 수 없는 개념이 "원획(原劃)"이에요! 한자의 부수 중에는 쓰기 편하게 줄여 쓴 것들이 많거든요. 성명학에서는 이 줄임 부수를 원래 글자로 복원해서 획수를 계산해요. 그래서 일반 옥편의 획수와 다를 수 있는데, 이것이 성명학의 정통 방식이에요.',
  '성명학의 획수 세기는 좀 특별해요! "원획(原劃)"이라고 해서, 부수를 원래 한자로 되돌린 다음 획수를 세는 방법을 사용하거든요. 강희자전(康熙字典)이라는 아주 오래된 한자 사전의 기준을 따르는 거예요. 그래서 우리가 보통 아는 획수와 조금 다를 수 있답니다.',
  '"원획"이란 뭘까요? 한자를 쓸 때, 어떤 부수는 편의상 줄여서 쓰게 됐어요. 예를 들어 "물 수(水)" 부수는 삼수변(氵)이 되었죠. 성명학에서는 이런 줄임 부수를 원래 한자로 되돌려서 획수를 세요. 이게 바로 "원획" 방식이에요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  용신-자원오행 관계 해석 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const YONGSHIN_RELATION_SAME: readonly string[] = [
  '이 글자의 자원오행이 용신({{용신}})과 정확히 같아요! 이름 속에 사주가 가장 필요로 하는 기운이 딱 들어 있는 거예요. 마치 갈증이 날 때 시원한 물을 만난 것처럼, 사주에 꼭 맞는 에너지가 이 글자를 통해 전해지고 있어요!',
  '놀라운 발견이에요! 이 글자의 자원오행이 용신 오행({{용신}})과 일치해요! 사주가 "이런 기운이 필요해!" 하고 외치면, 이 글자가 "여기 있어!" 하고 응답하는 셈이에요. 최고의 조합이죠!',
  '이 글자는 사주의 용신({{용신}})과 같은 오행을 가지고 있어요! 이건 정말 멋진 일이에요. 이름을 부를 때마다 사주가 가장 원하는 에너지가 울려 퍼지는 거나 다름없거든요!',
];

const YONGSHIN_RELATION_HEESHIN: readonly string[] = [
  '이 글자의 자원오행이 희신({{희신}})과 같아요! 희신은 용신을 도와주는 오행이에요. 쉽게 말하면 "용신의 비타민" 같은 존재죠. 이 글자가 간접적으로 사주의 균형을 도와주고 있어요!',
  '이 글자는 희신({{희신}})의 기운을 품고 있어요! 희신이란 용신을 뒤에서 도와주는 든든한 서포터예요. 이 글자 덕분에 용신의 힘이 더 강해질 수 있어요!',
  '자원오행이 희신({{희신}})과 일치하네요! 희신은 용신을 낳아주는(생해주는) 오행이라서, 이 글자가 용신의 에너지를 간접적으로 채워주는 역할을 하고 있어요. 정말 좋은 조합이에요!',
];

const YONGSHIN_RELATION_GISHIN: readonly string[] = [
  '이 글자의 자원오행이 기신({{기신}})과 같은 오행이에요. 기신은 사주에 부담이 되는 기운이지만, 걱정하지 마세요! 이름 전체의 조합에서 다른 글자가 충분히 보완해 줄 수 있거든요. 그리고 기신이 있어야 용신의 가치가 더 빛나는 법이에요.',
  '이 글자에 기신({{기신}}) 오행이 들어 있어요. "기신"이라고 해서 무조건 나쁜 건 아니에요! 삶에 도전이 있어야 성장하듯, 기신도 삶의 균형을 맞추는 데 나름의 역할이 있거든요. 용신으로 보완하면 충분히 좋아져요.',
  '자원오행이 기신({{기신}})과 겹치지만, 너무 걱정하지 않아도 돼요. 비가 올 때 우산이 있으면 되듯이, 이름의 다른 글자나 생활 속 용신 보완으로 충분히 조율할 수 있어요!',
];

const YONGSHIN_RELATION_NEUTRAL: readonly string[] = [
  '이 글자의 자원오행은 용신·희신·기신 어디에도 해당하지 않는 중립적인 위치예요. 마치 심판처럼 어느 쪽에도 치우치지 않는 공평한 에너지를 가지고 있는 거예요.',
  '이 글자는 사주의 용신이나 기신과 직접적인 연결은 없는 중립 오행이에요. 하지만 중립이라고 해서 역할이 없는 건 아니에요! 이름 전체의 균형을 잡아주는 안정제 같은 역할을 한답니다.',
  '자원오행이 중립적인 위치에 있어요. 용신이나 기신에 직접 해당하지는 않지만, 이름 속 다른 글자들과 어울려서 전체적인 조화를 이루는 데 기여하고 있어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  상생/상극 관계 설명 (아이 눈높이)
// ─────────────────────────────────────────────────────────────────────────────

const SANGSAENG_CHILD_EXPLAIN: Record<string, string[]> = {
  WOOD_FIRE: [
    '목(木)이 화(火)를 낳아요! 나무에 불을 붙이면 활활 타오르잖아요? 그것처럼 목의 기운이 화의 기운을 키워주는 관계예요. 이걸 "목생화(木生火)"라고 해요.',
  ],
  FIRE_EARTH: [
    '화(火)가 토(土)를 만들어요! 불이 다 타고 나면 재가 남잖아요? 그 재가 흙이 되는 거예요. "화생토(火生土)"라고 부른답니다.',
  ],
  EARTH_METAL: [
    '토(土)가 금(金)을 낳아요! 땅속 깊은 곳에서 광물이 나오잖아요? 흙이 오랜 시간에 걸쳐 보석과 금속을 만들어내는 거예요. "토생금(土生金)"이라고 해요.',
  ],
  METAL_WATER: [
    '금(金)이 수(水)를 만들어요! 차가운 쇠에 물방울이 맺히는 걸 본 적 있나요? 금속이 차가워지면 이슬이 맺히듯, 금의 기운이 수의 기운을 키워줘요. "금생수(金生水)"라고 해요.',
  ],
  WATER_WOOD: [
    '수(水)가 목(木)을 키워요! 나무에 물을 주면 쑥쑥 자라잖아요? 물이 나무를 키우는 것처럼, 수의 기운이 목의 기운에 힘을 실어줘요. "수생목(水生木)"이라고 해요.',
  ],
};

const SANGGEUK_CHILD_EXPLAIN: Record<string, string[]> = {
  WOOD_EARTH: [
    '목(木)이 토(土)를 이겨요. 나무뿌리가 흙을 뚫고 자라는 것처럼, 목의 기운이 토의 기운을 눌러버려요. "목극토(木剋土)"라고 해요.',
  ],
  FIRE_METAL: [
    '화(火)가 금(金)을 이겨요. 뜨거운 불에 쇠를 넣으면 녹아버리잖아요? 화의 기운이 금의 기운을 녹여버리는 거예요. "화극금(火剋金)"이라고 해요.',
  ],
  EARTH_WATER: [
    '토(土)가 수(水)를 이겨요. 흙으로 제방을 쌓으면 물길을 막을 수 있잖아요? 토의 기운이 수의 기운을 제어하는 거예요. "토극수(土剋水)"라고 해요.',
  ],
  METAL_WOOD: [
    '금(金)이 목(木)을 이겨요. 도끼로 나무를 잘라내듯, 금의 기운이 목의 기운을 제압해요. "금극목(金剋木)"이라고 해요.',
  ],
  WATER_FIRE: [
    '수(水)가 화(火)를 이겨요. 물을 뿌리면 불이 꺼지잖아요? 수의 기운이 화의 기운을 잠재우는 거예요. "수극화(水剋火)"라고 해요.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  글자별 종합 해설 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const CHAR_INTRO_TEMPLATES: readonly string[] = [
  '자, 이제 {{순서}}번째 글자 "{{한자}}({{한글}})"을 자세히 들여다볼게요!',
  '{{순서}}번째 글자인 "{{한자}}({{한글}})"을 분석해 볼 차례예요!',
  '다음은 {{순서}}번째 글자, "{{한자}}({{한글}})"이에요. 이 글자에 어떤 에너지가 숨어 있을까요?',
  '{{순서}}번째 글자 "{{한자}}({{한글}})" — 이 글자의 비밀을 풀어볼게요!',
  '이번엔 {{순서}}번째 글자 "{{한자}}({{한글}})"의 에너지를 탐구해 볼 거예요!',
];

const CHAR_MEANING_TEMPLATES: readonly string[] = [
  '"{{한자}}"는 "{{뜻}}"이라는 뜻을 가지고 있어요. {{의미해설}}',
  '이 글자 "{{한자}}"의 뜻은 "{{뜻}}"이에요. {{의미해설}}',
  '"{{한자}}"라는 글자에는 "{{뜻}}"이라는 아름다운 뜻이 담겨 있어요. {{의미해설}}',
];

/** 뜻 기반 의미 해설 (일반적) */
const MEANING_COMMENTARY_TEMPLATES: readonly string[] = [
  '이렇게 좋은 뜻의 글자가 이름에 들어 있으면, 그 뜻처럼 되고 싶다는 바람이 이름 속에 새겨지는 거예요.',
  '이름을 부를 때마다 이 글자의 뜻이 에너지로 전해진다고 생각하면, 정말 멋진 이름이죠?',
  '좋은 뜻의 글자를 이름에 넣는 것은, 매일 좋은 주문을 외우는 것과 같아요!',
  '이 글자의 뜻이 이름 주인에게 늘 좋은 기운을 전해줄 거예요.',
  '옛 사람들은 이름에 좋은 뜻의 글자를 넣으면 그 기운이 평생 함께한다고 믿었어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  글자 간 오행 흐름 분석 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const FLOW_SANGSAENG_TEMPLATES: readonly string[] = [
  '"{{글자1}}"({{오행1}})이 "{{글자2}}"({{오행2}})을 낳아주는 상생(相生) 관계예요! 앞 글자가 뒤 글자에게 에너지를 전달해 주고 있어요. 마치 릴레이 바톤을 넘겨주는 것처럼, 기운이 자연스럽게 흘러가는 아주 좋은 구성이에요!',
  '"{{글자1}}"에서 "{{글자2}}"로 기운이 자연스럽게 흘러가요! {{오행1}}이 {{오행2}}을 살려주는 상생 관계거든요. 이런 이름은 에너지 흐름이 부드러워서 인생에도 순풍이 불 가능성이 높아요!',
  '{{오행1}}→{{오행2}}, 이건 상생 관계예요! "{{글자1}}"이 "{{글자2}}"에게 힘을 실어주고 있어요. 자연의 순환처럼 기운이 아름답게 이어지는 좋은 조합이랍니다.',
];

const FLOW_SANGGEUK_TEMPLATES: readonly string[] = [
  '"{{글자1}}"({{오행1}})과 "{{글자2}}"({{오행2}}) 사이에 상극(相剋) 관계가 있어요. 하지만 긴장이 나쁘기만 한 건 아니에요! 적당한 긴장감은 오히려 성장의 원동력이 되거든요.',
  '{{오행1}}과 {{오행2}}이 만나면 상극 관계가 생겨요. "{{글자1}}"과 "{{글자2}}" 사이에 약간의 긴장이 있지만, 이것이 오히려 삶에 활력을 불어넣을 수 있어요.',
  '"{{글자1}}"과 "{{글자2}}" 사이에 약간의 긴장감(상극)이 느껴지지만, 고무줄이 팽팽해야 멀리 날아가듯 적당한 상극은 큰 에너지를 만들어내기도 해요!',
];

const FLOW_SAME_TEMPLATES: readonly string[] = [
  '"{{글자1}}"과 "{{글자2}}"가 같은 오행({{오행1}})이에요! 같은 팀 동료처럼 힘을 합쳐서 그 오행의 에너지를 더 강하게 만들어 주고 있어요.',
  '{{오행1}}끼리 만났어요! "{{글자1}}"과 "{{글자2}}"가 같은 오행이라 에너지가 두 배로 증폭돼요. 마치 쌍둥이처럼 호흡이 척척 맞는 조합이에요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  종합 요약 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const SUMMARY_GOOD_TEMPLATES: readonly string[] = [
  '{{이름}}님의 이름을 종합해 보면, 글자의 뜻·획수·자원오행 모두 훌륭한 조합이에요! 특히 용신과의 관계가 좋아서, 이름이 사주의 부족한 에너지를 채워주는 "에너지 보충제" 역할을 톡톡히 하고 있어요.',
  '이름 연구소 소장의 종합 평가: {{이름}}님의 이름은 뜻도 좋고, 오행 구성도 사주와 잘 맞아요! 이름을 부를 때마다 좋은 기운이 전달되는 멋진 이름이에요.',
  '글자 하나하나를 분석해 본 결과, {{이름}}님의 이름은 사주의 필요한 기운을 잘 채워주는 이름이에요! 뜻도 아름답고, 오행 배치도 좋아서 이름 연구소 소장으로서 높은 점수를 드릴게요!',
];

const SUMMARY_OKAY_TEMPLATES: readonly string[] = [
  '{{이름}}님의 이름은 전체적으로 양호한 구성이에요! 일부 글자는 용신과 바로 연결되지 않지만, 다른 글자들이 보완해 주고 있어서 전체 밸런스는 괜찮아요.',
  '이름 연구소 소장의 종합 평가: {{이름}}님의 이름은 좋은 뜻의 글자로 이루어져 있고, 오행 구성도 나쁘지 않아요! 다만 용신 보완을 조금 더 해주면 금상첨화겠어요.',
  '글자별로 분석해 보니, {{이름}}님의 이름은 균형 잡힌 구성이에요. 완벽하지는 않지만, 좋은 뜻과 오행의 조합이 일상에서 긍정적인 에너지를 불러올 수 있어요!',
];

const SUMMARY_CAUTION_TEMPLATES: readonly string[] = [
  '{{이름}}님의 이름에서 기신 오행이 일부 발견되었지만, 절대 걱정하지 마세요! 이름은 퍼즐의 한 조각일 뿐이에요. 생활 속에서 용신 오행을 보완하면 충분히 좋아질 수 있어요.',
  '이름 연구소 소장의 종합 평가: {{이름}}님의 이름에 약간의 보완 포인트가 있지만, 이건 오히려 "성장 가능성"이 있다는 뜻이에요! 용신 색상이나 방위를 활용하면 멋지게 극복할 수 있어요.',
  '기신 오행이 들어 있는 글자가 있지만, 비가 올 때 무지개가 뜨듯 좋은 기운과 함께 공존하는 거예요. 생활 속 용신 보완법으로 충분히 조화를 이룰 수 있답니다!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  마무리 문장 풀
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_TEMPLATES: readonly string[] = [
  '이름 속 한자 한 글자마다 우주의 에너지가 숨어 있다는 게 참 신기하지 않나요? 이 분석을 통해 {{이름}}님의 이름이 가진 특별한 힘을 이해하는 데 도움이 되었으면 좋겠어요!',
  '이름은 매일 수백 번 불리는 마법의 주문이에요. {{이름}}님의 이름 속에 담긴 오행 에너지가 좋은 방향으로 작용하도록, 용신 보완법도 함께 참고해 보세요!',
  '이것으로 {{이름}}님의 이름 기본 분석을 마칠게요. 이름은 바꿀 수 없어도, 이름 속 에너지를 이해하면 삶을 더 지혜롭게 살아갈 수 있어요!',
  '이름 연구소 소장의 분석을 마무리합니다! {{이름}}님의 이름이 가진 에너지가 앞으로의 삶에서 좋은 나침반이 되어줄 거예요. 다음 섹션에서 더 깊은 분석을 이어가 볼게요!',
  '여기까지가 이름의 기본 DNA 분석이에요! 글자 하나하나의 뜻, 획수, 자원오행을 알면 이름이 품고 있는 에너지 지도가 보이거든요. {{이름}}님의 에너지 지도, 참 멋지네요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  오행 분포 요약 생성 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function buildElementDistSummary(elements: ElementCode[]): string {
  if (elements.length === 0) return '';

  const counts: Partial<Record<ElementCode, number>> = {};
  for (const el of elements) {
    counts[el] = (counts[el] ?? 0) + 1;
  }

  const entries = Object.entries(counts) as [ElementCode, number][];
  entries.sort((a, b) => b[1] - a[1]);

  if (entries.length === 1) {
    const [el, cnt] = entries[0];
    return `이름의 자원오행은 ${elFull(el)} 단일 오행으로 구성되어 있어요. ${cnt}개 글자 모두 같은 오행이라 그 기운이 아주 강하게 집중돼요!`;
  }

  const parts = entries.map(([el, cnt]) => `${elFull(el)} ${cnt}개`);
  return `이름의 자원오행 구성은 ${parts.join(', ')}이에요.`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  음양 판정 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function strokePolarity(strokes: number): string {
  return strokes % 2 === 0 ? '음(陰)' : '양(陽)';
}

function strokePolarityExplain(strokes: number): string {
  if (strokes % 2 === 0) {
    return `${strokes}획은 짝수이므로 음(陰)이에요. 음은 부드러움, 안정, 수용을 뜻해요.`;
  }
  return `${strokes}획은 홀수이므로 양(陽)이에요. 양은 활동성, 추진력, 밝음을 뜻해요.`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  수리오행(획수 끝자리) 설명
// ─────────────────────────────────────────────────────────────────────────────

function strokeElementExplain(strokes: number): string {
  const lastDigit = strokes % 10;
  let el: string;
  if (lastDigit === 1 || lastDigit === 2) el = '목(木)';
  else if (lastDigit === 3 || lastDigit === 4) el = '화(火)';
  else if (lastDigit === 5 || lastDigit === 6) el = '토(土)';
  else if (lastDigit === 7 || lastDigit === 8) el = '금(金)';
  else el = '수(水)';

  return `획수 끝자리가 ${lastDigit}이므로 수리오행은 ${el}이에요. (1,2=목 / 3,4=화 / 5,6=토 / 7,8=금 / 9,0=수)`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CharDetail 추출 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

interface CharInfo {
  hangul: string;
  hanja: string;
  meaning: string;
  strokes: number;
  element: string;       // Title case: "Wood", "Fire" 등
  polarity: string;
  resourceElement?: string; // HanjaAnalysis에서 가져올 수 있음
  strokeElement?: string;
}

function extractCharInfos(input: ReportInput): CharInfo[] | null {
  const naming = input.naming;
  if (!naming) return null;

  const nameData = naming.name;
  if (!nameData) return null;

  const allChars: CharInfo[] = [];

  // 성(surname) 글자들
  if (nameData.surname) {
    for (const ch of nameData.surname) {
      allChars.push({
        hangul: ch.hangul,
        hanja: ch.hanja || '',
        meaning: ch.meaning || '',
        strokes: ch.strokes || 0,
        element: ch.element || '',
        polarity: ch.polarity || '',
      });
    }
  }

  // 이름(givenName) 글자들
  if (nameData.givenName) {
    for (const ch of nameData.givenName) {
      allChars.push({
        hangul: ch.hangul,
        hanja: ch.hanja || '',
        meaning: ch.meaning || '',
        strokes: ch.strokes || 0,
        element: ch.element || '',
        polarity: ch.polarity || '',
      });
    }
  }

  if (allChars.length === 0) return null;

  // HanjaAnalysis에서 resourceElement 보강
  const analysis = naming.analysis as Record<string, unknown> | undefined;
  const hanjaAnalysis = analysis?.['hanja'] as { blocks?: Array<Record<string, unknown>> } | undefined;
  if (hanjaAnalysis?.blocks) {
    for (let i = 0; i < Math.min(allChars.length, hanjaAnalysis.blocks.length); i++) {
      const block = hanjaAnalysis.blocks[i];
      allChars[i].resourceElement = (block['resourceElement'] as string) || allChars[i].element;
      allChars[i].strokeElement = (block['strokeElement'] as string) || '';
    }
  }

  return allChars;
}

// ─────────────────────────────────────────────────────────────────────────────
//  용신/희신/기신 추출 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

interface YongshinInfo {
  yongshin: ElementCode | null;
  heeshin: ElementCode | null;
  gishin: ElementCode | null;
  gushin: ElementCode | null;
}

function extractYongshinInfo(input: ReportInput): YongshinInfo {
  const yongshin = normalizeElement(input.saju.yongshin?.element);
  const heeshin = normalizeElement(input.saju.yongshin?.heeshin);
  const gishin = normalizeElement(input.saju.yongshin?.gishin);
  const gushin = normalizeElement(input.saju.yongshin?.gushin);

  return { yongshin, heeshin, gishin, gushin };
}

// ─────────────────────────────────────────────────────────────────────────────
//  글자별 용신 관계 판정
// ─────────────────────────────────────────────────────────────────────────────

type YongshinRelation = 'yongshin' | 'heeshin' | 'gishin' | 'gushin' | 'neutral';

function classifyCharYongshinRelation(
  charElement: ElementCode,
  info: YongshinInfo,
): YongshinRelation {
  if (info.yongshin && charElement === info.yongshin) return 'yongshin';
  if (info.heeshin && charElement === info.heeshin) return 'heeshin';
  if (info.gishin && charElement === info.gishin) return 'gishin';
  if (info.gushin && charElement === info.gushin) return 'gushin';
  return 'neutral';
}

function yongshinRelationKorean(rel: YongshinRelation): string {
  switch (rel) {
    case 'yongshin': return '용신 일치';
    case 'heeshin': return '희신 일치';
    case 'gishin': return '기신 일치';
    case 'gushin': return '구신 일치';
    default: return '중립';
  }
}

function yongshinRelationSentiment(rel: YongshinRelation): 'good' | 'caution' | 'neutral' {
  switch (rel) {
    case 'yongshin': return 'good';
    case 'heeshin': return 'good';
    case 'gishin': return 'caution';
    default: return 'neutral';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  인접 글자 오행 관계 분석
// ─────────────────────────────────────────────────────────────────────────────

function describeElementFlow(
  rng: SeededRandom,
  char1: CharInfo,
  char2: CharInfo,
): string {
  const el1 = normalizeElement(char1.resourceElement || char1.element);
  const el2 = normalizeElement(char2.resourceElement || char2.element);
  if (!el1 || !el2) return '';

  const rel = getElementRelation(el1, el2);
  const vars = {
    글자1: char1.hanja || char1.hangul,
    글자2: char2.hanja || char2.hangul,
    오행1: elShort(el1),
    오행2: elShort(el2),
  };

  if (rel === 'generates') {
    return pickAndFill(rng, FLOW_SANGSAENG_TEMPLATES, vars);
  } else if (rel === 'controlled_by') {
    // el2가 el1을 극하는 경우 = el1 입장에서 controlled_by
    return pickAndFill(rng, FLOW_SANGGEUK_TEMPLATES, vars);
  } else if (rel === 'controls') {
    return pickAndFill(rng, FLOW_SANGGEUK_TEMPLATES, vars);
  } else if (rel === 'same') {
    return pickAndFill(rng, FLOW_SAME_TEMPLATES, vars);
  } else {
    // generated_by: el2가 el1을 낳아줌 (역상생)
    return pickAndFill(rng, FLOW_SANGSAENG_TEMPLATES, {
      글자1: char2.hanja || char2.hangul,
      글자2: char1.hanja || char1.hangul,
      오행1: elShort(el2),
      오행2: elShort(el1),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  보충 설명 — 자원오행과 수리오행 차이 설명
// ─────────────────────────────────────────────────────────────────────────────

const JAWON_VS_SURI_TEMPLATES: readonly string[] = [
  '여기서 잠깐! "자원오행"과 "수리오행"은 다른 개념이에요. 자원오행은 한자의 부수(뿌리)에서 나오는 오행이고, 수리오행은 획수의 끝자리에서 나오는 오행이에요. 하나의 글자가 자원오행과 수리오행이 다를 수도 있어요! 예를 들어, 부수는 나무(목)인데 획수 끝자리가 7이면 수리오행은 금이 되는 거죠.',
  '자원오행과 수리오행의 차이를 알아볼까요? 자원오행은 글자의 "뿌리(부수)"에서 나오는 오행이에요. 반면 수리오행은 "획수의 끝자리"로 결정되는 오행이에요. 같은 글자인데도 두 오행이 다를 수 있는데, 성명학에서는 자원오행을 더 중요하게 여긴답니다.',
  '성명학에는 두 가지 오행이 있어요. 하나는 자원오행 — 한자의 부수가 어떤 자연 요소와 연결되느냐로 판단해요. 또 하나는 수리오행 — 획수의 끝자리를 보고 정해요. 두 오행이 일치하면 그 기운이 더 강해지고, 다르면 복합적인 에너지를 가지게 돼요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  사주 결핍 오행 보완 분석
// ─────────────────────────────────────────────────────────────────────────────

const DEFICIENCY_COMPLEMENT_TEMPLATES: readonly string[] = [
  '{{이름}}님의 사주에서 부족한 오행은 {{결핍오행}}이에요. 이름 속 자원오행에 {{결핍오행}}이 포함되어 있으면 사주의 빈 자리를 채워주는 역할을 해요!',
  '사주 분석에 따르면 {{결핍오행}}의 기운이 부족해요. 이름에 이 오행이 들어 있다면, 이름이 "에너지 보충제" 역할을 하는 셈이에요!',
  '{{이름}}님에게 필요한 오행은 {{결핍오행}}이에요. 이름의 자원오행 중에 이 오행이 있으면 사주의 균형을 맞추는 데 큰 도움이 돼요!',
];

const DEFICIENCY_FOUND_TEMPLATES: readonly string[] = [
  '이름 속에 사주에서 부족한 {{결핍오행}}의 기운이 포함되어 있어요! 이름이 사주의 빈 자리를 채워주고 있어서 정말 좋아요!',
  '사주에 부족한 {{결핍오행}}이 이름에 들어 있어요. 이건 마치 갈증 날 때 물을 마시는 것처럼 딱 맞는 보완이에요!',
];

const DEFICIENCY_NOT_FOUND_TEMPLATES: readonly string[] = [
  '이름에는 사주에서 부족한 {{결핍오행}}이 직접 포함되어 있지 않지만, 용신이나 희신의 기운이 있다면 간접적으로 보완이 가능해요.',
  '사주에 부족한 {{결핍오행}}이 이름에 직접 들어 있지는 않지만, 생활 속에서 {{결핍오행}}의 색상이나 방위를 활용하면 충분히 보완할 수 있어요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  오행별 생활 보완 팁
// ─────────────────────────────────────────────────────────────────────────────

function buildElementTip(rng: SeededRandom, el: ElementCode): string {
  const color = ELEMENT_COLOR[el] ?? '';
  const direction = ELEMENT_DIRECTION[el] ?? '';
  const numbers = ELEMENT_NUMBER[el] ?? [0, 0];
  const season = ELEMENT_SEASON[el] ?? '';
  const foods = ELEMENT_FOOD[el] ?? [];
  const foodPick = foods.length > 0 ? rng.sample(foods, 3).join(', ') : '';

  return `${elFull(el)}의 기운을 보완하고 싶다면: ${color} 계열의 옷이나 소품을 활용하고, ` +
    `${direction} 방향이 좋아요. 행운의 숫자는 ${numbers[0]}과 ${numbers[1]}, ` +
    `좋은 계절은 ${season}이에요. ` +
    (foodPick ? `추천 음식으로는 ${foodPick} 등이 있답니다!` : '');
}

// ─────────────────────────────────────────────────────────────────────────────
//  이름 전체 오행 조합 해설
// ─────────────────────────────────────────────────────────────────────────────

const COMBO_ALL_SAME: readonly string[] = [
  '이름의 모든 글자가 같은 오행({{오행}})이에요! 하나의 기운이 아주 강력하게 집중되어 있어서, 그 오행의 특성이 이름 주인에게 아주 뚜렷하게 나타날 수 있어요.',
  '모든 글자가 {{오행}} 오행으로 통일! 이건 하나의 색으로 물든 무지개처럼, 그 기운이 매우 강렬하다는 뜻이에요.',
];

const COMBO_BALANCED: readonly string[] = [
  '이름에 다양한 오행이 골고루 들어 있어요! 마치 색색깔의 크레파스가 모두 있는 것처럼, 여러 기운이 조화롭게 어울리고 있어요.',
  '여러 오행이 고르게 분포되어 있어서, 이름이 다양한 에너지를 품고 있어요. 어떤 상황에서든 유연하게 대처할 수 있는 균형 잡힌 이름이에요!',
];

const COMBO_DOMINANT: readonly string[] = [
  '{{강오행}}이 이름에서 가장 강한 기운이에요. 나머지 오행이 이를 보조하면서, {{강오행}}의 특성이 이름 주인에게 가장 잘 드러날 거예요.',
  '이름에서 {{강오행}}의 기운이 주도적이에요! 이 오행의 에너지가 이름 주인의 성격과 운세에 가장 큰 영향을 미칠 수 있어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  순서 표현 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  switch (n) {
    case 1: return '첫';
    case 2: return '두';
    case 3: return '세';
    case 4: return '네';
    default: return `${n}`;
  }
}

function positionLabel(index: number, surnameLength: number): string {
  if (index < surnameLength) {
    return surnameLength === 1 ? '성(姓)' : `성 ${index + 1}번째`;
  }
  const givenIndex = index - surnameLength;
  if (givenIndex === 0) return '이름 첫 글자';
  if (givenIndex === 1) return '이름 둘째 글자';
  return `이름 ${givenIndex + 1}번째 글자`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateNameBasicSection(input: ReportInput): ReportSection | null {
  // naming 데이터가 없으면 null 반환
  const naming = input.naming;
  if (!naming) return null;

  const charInfos = extractCharInfos(input);
  if (!charInfos || charInfos.length === 0) return null;

  const rng = createRng(input);
  for (let i = 0; i < 44; i++) rng.next(); // RNG offset: 44

  const name = safeName(input);
  const yongInfo = extractYongshinInfo(input);
  const paragraphs: ReportParagraph[] = [];
  const tables: ReportTable[] = [];
  const highlights: ReportHighlight[] = [];

  // 성 글자 수 파악
  const surnameLength = naming.name?.surname?.length ?? 1;

  // 전체 이름 정보
  const fullHangul = naming.name?.fullHangul ?? name;
  const fullHanja = naming.name?.fullHanja ?? '';

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 1: 도입부
  // ════════════════════════════════════════════════════════════════════════════

  paragraphs.push(narrative(
    pickAndFill(rng, INTRO_TEMPLATES, { 이름: name }),
  ));

  // 이름 소개
  if (fullHanja) {
    paragraphs.push(narrative(
      `${name}님의 이름을 한자로 쓰면 "${fullHanja}"이에요. ` +
      `한글로는 "${fullHangul}", 총 ${charInfos.length}글자로 이루어져 있어요. ` +
      `이제 한 글자씩 돋보기를 들고 살펴볼게요!`,
    ));
  } else {
    paragraphs.push(narrative(
      `${name}님의 이름 "${fullHangul}"은 총 ${charInfos.length}글자로 이루어져 있어요. ` +
      `각 글자에 담긴 에너지를 하나씩 분석해 볼게요!`,
    ));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 2: 자원오행·원획 개념 설명
  // ════════════════════════════════════════════════════════════════════════════

  paragraphs.push(emphasis(rng.pick(JAWON_CONCEPT_TEMPLATES)));

  paragraphs.push(narrative(
    '오행(五行)이란 우주 만물을 이루는 다섯 가지 기본 에너지예요. ' +
    '목(木·나무), 화(火·불), 토(土·흙), 금(金·쇠), 수(水·물) — ' +
    '이 다섯 가지가 서로 돕기도 하고(상생), 견제하기도 하면서(상극) ' +
    '세상의 균형을 이루고 있어요. 사주에도, 이름에도, 자연 어디에나 이 오행이 흐르고 있답니다.',
  ));

  paragraphs.push(narrative(rng.pick(WONHWAK_CONCEPT_TEMPLATES)));

  // 자원오행 vs 수리오행 차이 설명
  paragraphs.push(tip(rng.pick(JAWON_VS_SURI_TEMPLATES)));

  // 실전 체크리스트(지식 백과 기준, 고정 순서)
  const practicalChecklist = getNamingPrincipleChecklist().slice(0, 8);
  const practicalChecklistRows = practicalChecklist.map((line, index) => {
    const parsed = parseNamingChecklistLine(line);
    return [String(index + 1), parsed.principle, parsed.item];
  });

  paragraphs.push(emphasis(
    '아래는 실제 작명에서 바로 쓰는 점검표예요. 위에서부터 순서대로 확인하면 놓치는 부분을 줄일 수 있어요.',
  ));
  paragraphs.push(tip(
    `핵심 8개만 먼저 담았어요. ` +
    `${practicalChecklistRows[0]?.[2] ?? ''} ` +
    `${practicalChecklistRows[1]?.[2] ?? ''} ` +
    `${practicalChecklistRows[2]?.[2] ?? ''}`,
  ));
  tables.push({
    title: '작명 원칙 실전 체크리스트(요약)',
    headers: ['순번', '원칙', '확인 항목'],
    rows: practicalChecklistRows,
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 3: 용신 소개
  // ════════════════════════════════════════════════════════════════════════════

  if (yongInfo.yongshin) {
    const yongNorm = yongInfo.yongshin;
    const yongNature = ELEMENT_NATURE[yongNorm] ?? '';

    paragraphs.push(narrative(
      `이름 분석에서 가장 중요한 것은 사주의 "용신(用神)"이에요! ` +
      `${name}님의 용신은 ${elFull(yongNorm)}이에요. ` +
      `용신이란, 사주에서 가장 필요한 오행 에너지를 말해요. ` +
      `${elFull(yongNorm)}은 ${yongNature} ` +
      `이 기운이 이름에 담겨 있으면, 사주가 "고마워!" 하고 기뻐하는 거예요!`,
      yongNorm,
    ));

    if (yongInfo.heeshin) {
      paragraphs.push(narrative(
        `그리고 희신(喜神)은 ${elFull(yongInfo.heeshin)}이에요. ` +
        `희신은 용신을 도와주는 "도우미 오행"이에요. ` +
        `${elFull(yongInfo.heeshin)}이 ${elFull(yongNorm)}의 기운을 키워주거든요. ` +
        `이름에 희신 오행이 들어 있어도 아주 좋아요!`,
        yongInfo.heeshin,
      ));
    }

    if (yongInfo.gishin) {
      paragraphs.push(narrative(
        `반면 기신(忌神)은 ${elFull(yongInfo.gishin)}이에요. ` +
        `기신은 사주에 부담이 되는 오행이지만, 있다고 해서 무조건 나쁜 건 아니에요. ` +
        `삶에 도전이 있어야 성장할 수 있는 것처럼, 기신도 인생의 한 부분이거든요.`,
        yongInfo.gishin,
      ));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 4: 글자별 기본 정보 테이블
  // ════════════════════════════════════════════════════════════════════════════

  // 메인 테이블
  const mainTableRows: string[][] = [];
  for (let i = 0; i < charInfos.length; i++) {
    const ch = charInfos[i];
    const pos = positionLabel(i, surnameLength);
    const resEl = normalizeElement(ch.resourceElement || ch.element);
    const resElStr = resEl ? `${elFull(resEl)} ${elEmoji(resEl)}` : '?';
    const yRel = resEl && yongInfo.yongshin
      ? yongshinRelationKorean(classifyCharYongshinRelation(resEl, yongInfo))
      : '-';
    const polarityStr = strokePolarity(ch.strokes);

    mainTableRows.push([
      pos,
      ch.hangul,
      ch.hanja || '-',
      String(ch.strokes),
      polarityStr,
      resElStr,
      yRel,
      ch.meaning || '-',
    ]);
  }

  tables.push({
    title: `${name}님의 이름 글자별 분석표`,
    headers: ['위치', '한글', '한자', '획수(원획)', '음양', '자원오행', '용신관계', '뜻'],
    rows: mainTableRows,
  });

  paragraphs.push(narrative(
    `위 표는 ${name}님 이름의 각 글자를 분석한 결과예요. ` +
    `한자, 획수(원획 기준), 음양, 자원오행, 용신과의 관계, 그리고 뜻이 정리되어 있어요. ` +
    `이제 각 글자를 하나씩 자세히 살펴볼게요!`,
  ));

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 5: 글자별 상세 분석
  // ════════════════════════════════════════════════════════════════════════════

  for (let i = 0; i < charInfos.length; i++) {
    const ch = charInfos[i];
    const charIdx = i + 1;
    const resEl = normalizeElement(ch.resourceElement || ch.element);
    const stEl = normalizeElement(ch.strokeElement);
    const pos = positionLabel(i, surnameLength);

    // ── 5-1. 글자 도입 ────────────────────────────────────────────────────

    paragraphs.push(emphasis(
      pickAndFill(rng, CHAR_INTRO_TEMPLATES, {
        순서: String(charIdx),
        한자: ch.hanja || ch.hangul,
        한글: ch.hangul,
      }),
    ));

    // ── 5-2. 위치 설명 ────────────────────────────────────────────────────

    if (i < surnameLength) {
      paragraphs.push(narrative(
        `"${ch.hanja || ch.hangul}(${ch.hangul})"은 ${pos}에 해당해요. ` +
        `성(姓)은 가문의 뿌리이자 조상으로부터 물려받은 기운이에요. ` +
        `성의 획수는 수리 사격을 계산할 때 기본이 되는 아주 중요한 숫자랍니다.`,
      ));
    } else {
      const givenIdx = i - surnameLength;
      if (givenIdx === 0) {
        paragraphs.push(narrative(
          `"${ch.hanja || ch.hangul}(${ch.hangul})"은 ${pos}에요. ` +
          `이름의 첫 글자는 그 사람의 "주된 에너지"를 대표하는 글자예요. ` +
          `마치 노래의 주제 멜로디처럼, 이 글자의 기운이 이름 전체의 느낌을 결정해요.`,
        ));
      } else {
        paragraphs.push(narrative(
          `"${ch.hanja || ch.hangul}(${ch.hangul})"은 ${pos}에요. ` +
          `두 번째 이름 글자는 첫 글자를 보조하면서 이름의 완성도를 높여주는 역할이에요. ` +
          `이 글자가 어떤 에너지를 더해주는지 살펴볼게요.`,
        ));
      }
    }

    // ── 5-3. 뜻 해설 ─────────────────────────────────────────────────────

    if (ch.meaning) {
      const meaningComment = rng.pick(MEANING_COMMENTARY_TEMPLATES);
      paragraphs.push(positive(
        pickAndFill(rng, CHAR_MEANING_TEMPLATES, {
          한자: ch.hanja || ch.hangul,
          뜻: ch.meaning,
          의미해설: meaningComment,
        }),
      ));
    }

    // ── 5-4. 획수(원획) 분석 ──────────────────────────────────────────────

    if (ch.strokes > 0) {
      paragraphs.push(narrative(
        pickAndFill(rng, STROKE_EXPLAIN_TEMPLATES, { 획수: String(ch.strokes) }),
      ));

      // 음양
      paragraphs.push(narrative(strokePolarityExplain(ch.strokes)));

      // 수리오행
      paragraphs.push(narrative(strokeElementExplain(ch.strokes)));
    }

    // ── 5-5. 자원오행 분석 ────────────────────────────────────────────────

    if (resEl) {
      // 자원오행 설명
      const resExplainPool = RESOURCE_ELEMENT_EXPLAIN[resEl];
      if (resExplainPool) {
        paragraphs.push(narrative(rng.pick(resExplainPool)));
      }

      // 아이 눈높이 비유
      const childMetaphor = ELEMENT_CHILD_METAPHOR[resEl];
      if (childMetaphor) {
        paragraphs.push(encouraging(rng.pick(childMetaphor), resEl));
      }

      // 오행의 감정/성격 연결
      const emotion = ELEMENT_EMOTION[resEl];
      if (emotion) {
        paragraphs.push(narrative(
          `${elFull(resEl)}의 기운을 가진 글자는 성격적으로 "${emotion.positive}" 같은 좋은 면이 있어요. ` +
          `다만 기운이 과하면 "${emotion.negative}" 같은 면이 나올 수도 있는데, 다른 오행이 균형을 잡아주면 괜찮아요!`,
          resEl,
        ));
      }

      // 자원오행과 수리오행 비교
      if (stEl && stEl !== resEl) {
        paragraphs.push(tip(
          `참고로 이 글자는 자원오행이 ${elFull(resEl)}이고, 수리오행(획수 기반)은 ${elFull(stEl)}이에요. ` +
          `두 오행이 다르면 글자 안에 두 가지 에너지가 공존하는 셈이에요. ` +
          `성명학에서는 자원오행을 더 중요하게 보지만, 수리오행도 부가적인 역할을 한답니다.`,
        ));
      } else if (stEl && stEl === resEl) {
        paragraphs.push(positive(
          `이 글자는 자원오행과 수리오행이 모두 ${elFull(resEl)}! ` +
          `하나의 오행으로 일치해서 그 기운이 더 강하게 발현되는 글자예요.`,
          resEl,
        ));
      }

      // ── 5-6. 용신과의 관계 ────────────────────────────────────────────

      if (yongInfo.yongshin) {
        const yRel = classifyCharYongshinRelation(resEl, yongInfo);

        if (yRel === 'yongshin') {
          paragraphs.push(positive(
            pickAndFill(rng, YONGSHIN_RELATION_SAME, { 용신: elFull(yongInfo.yongshin) }),
            yongInfo.yongshin,
          ));
        } else if (yRel === 'heeshin' && yongInfo.heeshin) {
          paragraphs.push(positive(
            pickAndFill(rng, YONGSHIN_RELATION_HEESHIN, { 희신: elFull(yongInfo.heeshin) }),
            yongInfo.heeshin,
          ));
        } else if (yRel === 'gishin' && yongInfo.gishin) {
          paragraphs.push(encouraging(
            pickAndFill(rng, YONGSHIN_RELATION_GISHIN, { 기신: elFull(yongInfo.gishin) }),
            yongInfo.gishin,
          ));
        } else {
          paragraphs.push(narrative(rng.pick(YONGSHIN_RELATION_NEUTRAL)));
        }

        // 용신↔자원오행 상생/상극 관계도 설명
        const relToYong = getElementRelation(resEl, yongInfo.yongshin);
        if (relToYong === 'generates') {
          paragraphs.push(positive(
            `이 글자의 ${elShort(resEl)}은 용신 ${elShort(yongInfo.yongshin)}을 낳아주는(생해주는) 관계예요! ` +
            `직접적인 용신은 아니지만, 용신의 힘을 키워주는 아주 좋은 관계랍니다.`,
            resEl,
          ));
        } else if (relToYong === 'generated_by') {
          paragraphs.push(narrative(
            `용신 ${elShort(yongInfo.yongshin)}이 이 글자의 ${elShort(resEl)} 기운을 낳아주는 관계예요. ` +
            `용신이 이 글자를 도와주고 있는 형상이에요.`,
          ));
        } else if (relToYong === 'controls') {
          paragraphs.push(caution(
            `이 글자의 ${elShort(resEl)}이 용신 ${elShort(yongInfo.yongshin)}을 극하는 관계가 있어요. ` +
            `하지만 상극이 있다고 무조건 나쁜 건 아니에요. ` +
            `적당한 제어는 에너지의 균형을 잡아주는 역할을 하기도 한답니다.`,
            resEl,
          ));
        }
      }
    }

    // ── 5-7. 소결: 글자 에너지 카드 ───────────────────────────────────

    if (resEl) {
      const resElKo = elShort(resEl);
      const emoji = elEmoji(resEl);
      const relLabel = yongInfo.yongshin
        ? yongshinRelationKorean(classifyCharYongshinRelation(resEl, yongInfo))
        : '';

      paragraphs.push(emphasis(
        `${emoji} "${ch.hanja || ch.hangul}(${ch.hangul})" 에너지 카드: ` +
        `뜻 = ${ch.meaning || '-'} | ` +
        `원획 = ${ch.strokes}획 (${strokePolarity(ch.strokes)}) | ` +
        `자원오행 = ${resElKo} | ` +
        (relLabel ? `용신관계 = ${relLabel}` : ''),
      ));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 6: 인접 글자 간 오행 흐름 분석
  // ════════════════════════════════════════════════════════════════════════════

  if (charInfos.length >= 2) {
    paragraphs.push(emphasis(
      '이제 글자와 글자 사이의 오행 에너지 흐름을 살펴볼게요! ' +
      '앞 글자와 뒤 글자가 상생(서로 도움) 관계인지, 상극(서로 견제) 관계인지에 따라 ' +
      '이름의 에너지 흐름이 달라져요.',
    ));

    let sangsaengCount = 0;
    const totalPairs = charInfos.length - 1;

    for (let i = 0; i < totalPairs; i++) {
      const flowDesc = describeElementFlow(rng, charInfos[i], charInfos[i + 1]);
      if (flowDesc) {
        paragraphs.push(narrative(flowDesc));
      }

      // 상생 카운트
      const el1 = normalizeElement(charInfos[i].resourceElement || charInfos[i].element);
      const el2 = normalizeElement(charInfos[i + 1].resourceElement || charInfos[i + 1].element);
      if (el1 && el2) {
        const rel = getElementRelation(el1, el2);
        if (rel === 'generates' || rel === 'generated_by' || rel === 'same') {
          sangsaengCount++;
        }
      }

      // 상생/상극 상세 설명 추가
      if (el1 && el2) {
        const key = `${el1}_${ELEMENT_GENERATES[el1] === el2 ? el2 : ''}`;
        const sangsaengExplain = SANGSAENG_CHILD_EXPLAIN[`${el1}_${el2}`];
        if (sangsaengExplain) {
          paragraphs.push(tip(rng.pick(sangsaengExplain)));
        } else {
          const sanggeukExplain = SANGGEUK_CHILD_EXPLAIN[`${el1}_${el2}`];
          if (sanggeukExplain) {
            paragraphs.push(tip(rng.pick(sanggeukExplain)));
          }
        }
      }
    }

    // 흐름 종합
    if (sangsaengCount === totalPairs) {
      paragraphs.push(positive(
        `이름의 모든 글자 사이가 상생 관계예요! 에너지가 물 흐르듯 자연스럽게 이어지는 최고의 구성이에요!`,
      ));
    } else if (sangsaengCount > 0) {
      paragraphs.push(narrative(
        `${totalPairs}쌍 중 ${sangsaengCount}쌍이 상생(우호) 관계예요. ` +
        `전체적으로 에너지 흐름이 양호한 편이에요.`,
      ));
    } else {
      paragraphs.push(encouraging(
        `글자 간 상극 관계가 있지만, 이것은 이름에 "힘"을 불어넣는 역할을 하기도 해요. ` +
        `생활 속 용신 보완으로 충분히 조화를 이룰 수 있답니다!`,
      ));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 7: 자원오행 분포 종합
  // ════════════════════════════════════════════════════════════════════════════

  const allElements: ElementCode[] = charInfos
    .map(ch => normalizeElement(ch.resourceElement || ch.element))
    .filter((el): el is ElementCode => el !== null);

  if (allElements.length > 0) {
    paragraphs.push(emphasis('이름 전체의 자원오행 구성을 종합해 볼게요!'));

    // 분포 요약
    paragraphs.push(narrative(buildElementDistSummary(allElements)));

    // 오행 조합 유형 해설
    const uniqueElements = [...new Set(allElements)];
    if (uniqueElements.length === 1) {
      paragraphs.push(narrative(
        pickAndFill(rng, COMBO_ALL_SAME, { 오행: elFull(uniqueElements[0]) }),
      ));
    } else if (uniqueElements.length >= 3) {
      paragraphs.push(positive(rng.pick(COMBO_BALANCED)));
    } else {
      // 가장 많은 오행 찾기
      const counts: Record<string, number> = {};
      for (const el of allElements) counts[el] = (counts[el] ?? 0) + 1;
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      paragraphs.push(narrative(
        pickAndFill(rng, COMBO_DOMINANT, { 강오행: elFull(dominant[0]) }),
      ));
    }

    // 오행 분포 차트
    const chartData: Record<string, number | string> = {};
    const elCounts: Record<string, number> = {};
    for (const el of allElements) elCounts[el] = (elCounts[el] ?? 0) + 1;
    for (const [el, count] of Object.entries(elCounts)) {
      chartData[elFull(el)] = count;
    }

    // 분포 테이블
    const distRows: string[][] = [];
    const allFive: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
    for (const el of allFive) {
      const count = elCounts[el] ?? 0;
      const emoji = count > 0 ? elEmoji(el) : '';
      const bar = count > 0 ? '■'.repeat(count) + '□'.repeat(Math.max(0, charInfos.length - count)) : '□'.repeat(charInfos.length);
      distRows.push([elFull(el), String(count), bar, emoji]);
    }

    tables.push({
      title: '이름 자원오행 분포',
      headers: ['오행', '글자 수', '분포', ''],
      rows: distRows,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 8: 사주 결핍 오행 보완 분석
  // ════════════════════════════════════════════════════════════════════════════

  const deficientElements = input.saju.deficientElements ?? [];
  if (deficientElements.length > 0) {
    const defElNorms = deficientElements
      .map(e => normalizeElement(e))
      .filter((e): e is ElementCode => e !== null);

    if (defElNorms.length > 0) {
      const defElStr = defElNorms.map(e => elFull(e)).join(', ');
      paragraphs.push(emphasis(
        pickAndFill(rng, DEFICIENCY_COMPLEMENT_TEMPLATES, {
          이름: name,
          결핍오행: defElStr,
        }),
      ));

      // 이름에 결핍 오행이 포함되어 있는지 체크
      const nameHasDeficient = defElNorms.some(de => allElements.includes(de));
      if (nameHasDeficient) {
        const matched = defElNorms.filter(de => allElements.includes(de));
        paragraphs.push(positive(
          pickAndFill(rng, DEFICIENCY_FOUND_TEMPLATES, {
            결핍오행: matched.map(e => elFull(e)).join(', '),
          }),
        ));
      } else {
        paragraphs.push(encouraging(
          pickAndFill(rng, DEFICIENCY_NOT_FOUND_TEMPLATES, {
            결핍오행: defElStr,
          }),
        ));
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 9: 용신 보완 생활 팁
  // ════════════════════════════════════════════════════════════════════════════

  if (yongInfo.yongshin) {
    paragraphs.push(emphasis(
      `${name}님의 용신 ${elFull(yongInfo.yongshin)}을 일상에서 보완하는 방법도 알려드릴게요!`,
    ));
    paragraphs.push(tip(buildElementTip(rng, yongInfo.yongshin)));

    if (yongInfo.heeshin) {
      paragraphs.push(tip(
        `희신 ${elFull(yongInfo.heeshin)}도 함께 챙기면 더 좋아요! ` +
        buildElementTip(rng, yongInfo.heeshin),
      ));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 10: 종합 평가
  // ════════════════════════════════════════════════════════════════════════════

  // 용신/희신 일치 수, 기신 일치 수 계산
  let yongMatchCount = 0;
  let heeMatchCount = 0;
  let giMatchCount = 0;

  for (const el of allElements) {
    if (yongInfo.yongshin && el === yongInfo.yongshin) yongMatchCount++;
    if (yongInfo.heeshin && el === yongInfo.heeshin) heeMatchCount++;
    if (yongInfo.gishin && el === yongInfo.gishin) giMatchCount++;
  }

  const goodMatchTotal = yongMatchCount + heeMatchCount;

  paragraphs.push(emphasis(
    `${name}님의 이름 기본 분석 종합 평가`,
  ));

  if (goodMatchTotal >= 2 && giMatchCount === 0) {
    paragraphs.push(positive(
      pickAndFill(rng, SUMMARY_GOOD_TEMPLATES, { 이름: name }),
    ));
  } else if (giMatchCount >= 2) {
    paragraphs.push(encouraging(
      pickAndFill(rng, SUMMARY_CAUTION_TEMPLATES, { 이름: name }),
    ));
  } else {
    paragraphs.push(narrative(
      pickAndFill(rng, SUMMARY_OKAY_TEMPLATES, { 이름: name }),
    ));
  }

  // 종합 평가 테이블
  tables.push({
    title: '이름-용신 관계 종합',
    headers: ['항목', '결과', '평가'],
    rows: [
      [
        '용신 일치 글자',
        `${yongMatchCount}개 / ${allElements.length}개`,
        yongMatchCount > 0 ? '좋음' : '보완 가능',
      ],
      [
        '희신 일치 글자',
        `${heeMatchCount}개 / ${allElements.length}개`,
        heeMatchCount > 0 ? '좋음' : '-',
      ],
      [
        '기신 일치 글자',
        `${giMatchCount}개 / ${allElements.length}개`,
        giMatchCount === 0 ? '좋음' : '주의',
      ],
      [
        '총 우호 글자',
        `${goodMatchTotal}개 / ${allElements.length}개`,
        goodMatchTotal >= Math.ceil(allElements.length / 2) ? '양호' : '보완 가능',
      ],
    ],
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  SECTION 11: 마무리
  // ════════════════════════════════════════════════════════════════════════════

  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name }),
  ));

  // ════════════════════════════════════════════════════════════════════════════
  //  하이라이트
  // ════════════════════════════════════════════════════════════════════════════

  highlights.push({
    label: '이름 구성',
    value: `${fullHangul} (${fullHanja || '한자 없음'})`,
    sentiment: 'neutral',
  });

  highlights.push({
    label: '총 획수',
    value: `${charInfos.reduce((sum, ch) => sum + ch.strokes, 0)}획`,
    sentiment: 'neutral',
  });

  if (allElements.length > 0) {
    highlights.push({
      label: '자원오행',
      value: allElements.map(e => elShort(e)).join(' · '),
      sentiment: 'neutral',
    });
  }

  if (yongInfo.yongshin) {
    highlights.push({
      label: '용신',
      value: elFull(yongInfo.yongshin),
      element: yongInfo.yongshin,
      sentiment: 'good',
    });
  }

  highlights.push({
    label: '용신/희신 일치',
    value: `${goodMatchTotal}글자`,
    sentiment: goodMatchTotal > 0 ? 'good' : 'neutral',
  });

  if (giMatchCount > 0) {
    highlights.push({
      label: '기신 일치',
      value: `${giMatchCount}글자`,
      element: yongInfo.gishin ?? undefined,
      sentiment: 'caution',
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  차트 데이터
  // ════════════════════════════════════════════════════════════════════════════

  const charts: ReportChart[] = [];

  // 자원오행 분포 바 차트
  if (allElements.length > 0) {
    const barData: Record<string, number | string> = {};
    const elCountMap: Record<string, number> = {};
    for (const el of allElements) elCountMap[el] = (elCountMap[el] ?? 0) + 1;
    for (const el of ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as ElementCode[]) {
      barData[elFull(el)] = elCountMap[el] ?? 0;
    }

    charts.push({
      type: 'bar',
      title: '이름 자원오행 분포',
      data: barData,
      meta: {
        description: '각 오행별 글자 수',
        total: allElements.length,
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  섹션 반환
  // ════════════════════════════════════════════════════════════════════════════

  return {
    id: 'nameBasic',
    title: '추천 이름 기본 분석',
    subtitle: '한자 한 글자에 숨겨진 에너지 탐구',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    charts: charts.length > 0 ? charts : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}
