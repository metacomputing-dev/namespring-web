/**
 * part1-hiddenStems.ts -- 지장간(Hidden Stems) 분석 섹션
 *
 * 각 지지(地支) 안에 숨어 있는 천간(天干)들을 분석하여
 * 겉으로 보이지 않는 내면의 성격과 잠재력을 설명합니다.
 *
 * 본기(本氣) / 중기(中氣) / 여기(餘氣) 개념을 학생 눈높이에서
 * 친절한 존댓말로 풀어냅니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportTable,
  ReportParagraph,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  STEMS,
  BRANCHES,
  STEM_BY_CODE,
  BRANCH_BY_CODE,
  STEM_BY_HANGUL,
  BRANCH_BY_HANGUL,
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  TEN_GOD_BY_CODE,
  TEN_GOD_CATEGORY_KOREAN,
  elementCodeToKorean,
  lookupStemInfo,
  lookupBranchInfo,
} from '../common/elementMaps.js';

import {
  SeededRandom,
  createRng,
  pickAndFill,
  narrative,
  positive,
  tip,
  emphasis,
  joinSentences,
  eunNeun,
  iGa,
  eulReul,
} from '../common/sentenceUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Position helpers
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_KEYS = ['year', 'month', 'day', 'hour'] as const;
type PositionKey = (typeof POSITION_KEYS)[number];

const POSITION_KOREAN: Record<PositionKey, string> = {
  year: '연주(年柱)',
  month: '월주(月柱)',
  day: '일주(日柱)',
  hour: '시주(時柱)',
};

const POSITION_SHORT: Record<PositionKey, string> = {
  year: '연주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

const POSITION_MEANING: Record<PositionKey, string> = {
  year: '조상과 어린 시절',
  month: '부모와 사회생활',
  day: '자기 자신과 배우자',
  hour: '자녀와 말년',
};

const POSITION_LIFE_STAGE: Record<PositionKey, string> = {
  year: '유년기(0~15세)',
  month: '청년기(15~30세)',
  day: '장년기(30~50세)',
  hour: '노년기(50세~)',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Hidden stem role labels
// ─────────────────────────────────────────────────────────────────────────────

function hiddenStemRole(index: number, total: number): string {
  if (total === 1) return '본기(本氣)';
  if (index === 0) return '본기(本氣)';
  if (index === 1 && total === 2) return '중기(中氣)';
  if (index === 1 && total === 3) return '중기(中氣)';
  return '여기(餘氣)';
}

function hiddenStemRoleShort(index: number, total: number): string {
  if (total === 1) return '본기';
  if (index === 0) return '본기';
  if (index === 1) return '중기';
  return '여기';
}

function ratioToPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ten god display helpers
// ─────────────────────────────────────────────────────────────────────────────

function tenGodKorean(code: string): string {
  const info = TEN_GOD_BY_CODE[code];
  return info ? `${info.korean}(${info.hanja})` : code;
}

function tenGodShort(code: string): string {
  const info = TEN_GOD_BY_CODE[code];
  return info ? info.korean : code;
}

function tenGodCategory(code: string): string {
  const info = TEN_GOD_BY_CODE[code];
  if (!info) return '';
  return TEN_GOD_CATEGORY_KOREAN[info.category] ?? '';
}

function tenGodCategoryDesc(code: string): string {
  const info = TEN_GOD_BY_CODE[code];
  if (!info) return '';
  return info.shortDesc;
}

function stemDisplay(stemStr: string): string {
  const info = lookupStemInfo(stemStr);
  if (!info) return stemStr;
  return `${info.hangul}(${info.hanja})`;
}

function stemElement(stemStr: string): string {
  const info = lookupStemInfo(stemStr);
  if (!info) return '';
  return elementCodeToKorean(info.element);
}

function stemElementFull(stemStr: string): string {
  const info = lookupStemInfo(stemStr);
  if (!info) return '';
  return ELEMENT_KOREAN[info.element] ?? '';
}

function branchDisplay(branchStr: string): string {
  const info = lookupBranchInfo(branchStr);
  if (!info) return branchStr;
  return `${info.hangul}(${info.hanja})`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. Concept explanation templates (20+)
// ─────────────────────────────────────────────────────────────────────────────

const CONCEPT_INTRO_TEMPLATES: readonly string[] = [
  '사주에서 지지(地支)는 겉으로 보이는 성격이에요. 그런데 그 안에는 또 다른 천간(天干)이 숨어 있답니다! 이것을 지장간(支藏干)이라고 불러요.',
  '지장간(支藏干)이란, 12지지 각각의 안에 감춰져 있는 천간을 말해요. 겉으로 드러나는 성격 말고도 속마음이 따로 있는 것과 비슷하답니다.',
  '사주팔자에서 지지는 눈에 보이는 부분이에요. 하지만 지지 안에는 보이지 않는 천간이 숨어 있는데, 이것이 바로 지장간이에요!',
  '지장간이란 땅(地支) 속에 숨어 있는 하늘의 기운(天干)을 뜻해요. 마치 땅속에 보물이 묻혀 있는 것처럼, 지지 안에도 숨겨진 에너지가 있답니다.',
  '여러분이 겉으로 보여주는 모습과 마음속 진짜 모습이 다를 때가 있죠? 사주에서도 마찬가지예요. 지지 안에 숨어 있는 천간, 즉 지장간이 바로 그 숨겨진 내면이에요.',
  '지장간(支藏干)은 사주의 숨은 보석 같은 존재예요. 겉으로 보이는 지지 아래에 천간이 하나에서 셋까지 숨어 있는데, 이 숨겨진 기운이 여러분의 진짜 잠재력을 보여준답니다.',
  '사주를 집에 비유하면, 천간은 지붕이고 지지는 1층이에요. 그런데 지지 안에 지하실이 있는 것처럼 숨겨진 천간이 있답니다. 그게 바로 지장간이에요!',
  '지장간은 "땅 속에 감춰진 하늘"이라는 뜻이에요. 마치 씨앗 속에 큰 나무의 가능성이 담겨 있는 것처럼, 지지 안에도 강력한 천간의 힘이 숨어 있어요.',
  '사주 분석에서 지장간은 정말 중요한 부분이에요. 겉모습만으로는 사람을 완전히 알 수 없듯이, 지지만 보고는 사주를 다 파악할 수 없거든요. 지장간까지 살펴봐야 진짜 모습이 보인답니다!',
  '지장간(支藏干)이라고 하면 어렵게 느껴질 수 있지만, 쉽게 말하면 "지지 안에 숨어 있는 에너지"예요. 이 숨은 에너지가 여러분의 성격, 재능, 인간관계에 은근한 영향을 준답니다.',
  '여러분은 혹시 러시아 인형(마트료시카)을 아시나요? 인형 안에 또 인형이 들어 있는 것처럼, 사주의 지지 안에도 천간이라는 또 다른 존재가 숨어 있어요. 이것이 바로 지장간이에요!',
  '사주에서 천간과 지지를 합쳐 팔자라고 부르는데요, 사실 지지 안에도 천간이 숨어 있어서 실제로는 더 많은 정보가 담겨 있답니다. 이 숨겨진 천간을 지장간이라고 해요.',
  '음식의 겉모습만 보면 재료를 다 알 수 없잖아요? 속에 어떤 재료가 들어갔는지 까봐야 하죠. 사주의 지지도 마찬가지예요. 안을 들여다보면 지장간이라는 숨겨진 천간이 있답니다!',
  '스마트폰 겉면만 보면 화면과 케이스만 보이지만, 안에는 정교한 부품이 가득하잖아요? 사주의 지지도 겉으로는 하나처럼 보이지만, 그 안에 지장간이라는 중요한 요소들이 들어 있어요.',
  '만화 속 변신 로봇처럼, 사주의 지지도 하나로 보이지만 안에 여러 가지 힘을 품고 있어요. 이 힘의 정체가 바로 지장간이랍니다!',
  '지장간을 이해하면 사주 분석의 깊이가 완전히 달라져요. 마치 흑백 사진에서 컬러 사진으로 바뀌는 것처럼, 숨겨진 색깔들이 드러나기 시작하거든요.',
  '지장간은 여러분의 "숨은 카드" 같은 거예요. 평소에는 드러나지 않지만, 특정 시기나 상황에서 그 힘이 발휘된답니다. 어떤 카드가 숨어 있는지 함께 확인해 볼까요?',
  '사주에서 지지는 단순한 글자 하나가 아니에요. 그 안에 천간이 겹겹이 숨어 있어서, 하나의 지지에서도 여러 가지 성격과 에너지를 읽어낼 수 있답니다. 이 겹겹의 존재를 지장간이라고 불러요.',
  '사주를 바다에 비유하면, 천간은 바다 위의 파도이고 지지는 바다 표면이에요. 그런데 바다 깊은 곳에도 해류가 흐르고 있죠? 그 깊은 곳의 해류가 바로 지장간이랍니다.',
  '지장간(支藏干)은 한마디로 "지지의 DNA"라고 할 수 있어요. 겉으로 보이는 특징뿐 아니라 잠재된 가능성까지 담고 있는 유전자 같은 존재랍니다.',
  '우리가 빙산을 볼 때 물 위에 보이는 부분은 전체의 10%에 불과하다고 하잖아요? 사주의 지지도 마찬가지예요. 겉으로 보이는 지지 아래에 지장간이라는 거대한 내면이 숨어 있답니다.',
  '지장간을 공부하면 사주 해석이 훨씬 풍부해져요. 같은 지지라도 안에 숨어 있는 천간에 따라 의미가 달라지거든요. 마치 같은 상자라도 안에 뭐가 들어 있느냐에 따라 가치가 달라지는 것처럼요!',
  '선생님이 학생의 겉모습만 보고 판단하면 안 되는 것처럼, 사주도 천간과 지지의 겉모습만으로는 부족해요. 지장간이라는 숨겨진 층까지 봐야 비로소 완전한 분석이 가능하답니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  2. 본기/중기/여기 metaphor templates (20+)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_METAPHOR_TEMPLATES: readonly string[] = [
  '지장간에는 본기(本氣), 중기(中氣), 여기(餘氣)라는 세 종류가 있어요. 본기는 그 지지의 "주인공"이고, 중기는 "조연", 여기는 "단역 배우"라고 생각하면 돼요.',
  '본기(本氣)는 가장 힘이 센 주인장이에요. 중기(中氣)는 두 번째로 영향을 주는 존재이고, 여기(餘氣)는 은은하게 뒤에서 도와주는 조력자예요.',
  '마치 러시아 인형처럼 안에 또 다른 성격이 숨어있어요! 가장 큰 인형이 본기, 중간 인형이 중기, 가장 작은 인형이 여기랍니다.',
  '지장간의 본기는 메인 요리, 중기는 반찬, 여기는 양념 같은 거예요. 메인 요리(본기)가 가장 큰 영향을 주지만, 반찬(중기)과 양념(여기)이 있어야 맛이 완성되는 것처럼요!',
  '학교에 비유하면 본기는 반장, 중기는 부반장, 여기는 서기 같은 역할이에요. 모두 반(지지)에 소속되어 있지만, 영향력의 크기가 다르답니다.',
  '본기(本氣)는 지지의 핵심 에너지로 전체의 절반 이상을 차지해요. 중기(中氣)는 보조적인 힘이고, 여기(餘氣)는 미세하지만 분명히 존재하는 잔여 에너지예요.',
  '밴드에 비유하면, 본기는 보컬(메인), 중기는 기타(서브), 여기는 베이스(리듬)와 같아요. 각자의 역할이 모여서 하나의 멋진 음악(지지)을 만들어 내는 거예요!',
  '가족으로 치면, 본기는 집안의 가장 같은 존재예요. 중기는 살림을 돕는 식구이고, 여기는 조용하지만 꼭 필요한 막내 같은 존재랍니다.',
  '스포츠팀으로 비유하면 본기는 에이스 선수, 중기는 주전 선수, 여기는 후보 선수예요. 에이스가 가장 큰 활약을 하지만, 팀이 강해지려면 모든 선수가 중요하답니다.',
  '나무에 비유하면 본기는 굵은 줄기, 중기는 가지, 여기는 잔가지예요. 줄기(본기)가 가장 든든하지만, 가지(중기)와 잔가지(여기)가 있어야 나무가 풍성해지는 거예요!',
  '본기는 태양처럼 강렬한 빛을 내는 존재예요. 중기는 달빛처럼 부드러운 영향을 주고, 여기는 별빛처럼 은은하지만 밤하늘을 아름답게 만드는 존재랍니다.',
  '케이크를 만들 때, 본기는 빵 시트(가장 기본), 중기는 크림(풍미를 더하는), 여기는 장식(마무리 터치)이라고 생각해 보세요!',
  '본기는 집의 기둥과 같아요. 가장 튼튼하고 핵심적인 역할을 하죠. 중기는 벽이고, 여기는 창문이에요. 각각이 조화를 이루어야 살기 좋은 집이 된답니다.',
  '지장간의 세 등급을 비율로 보면, 본기가 보통 50~70%, 중기가 20~30%, 여기가 10~20% 정도의 영향력을 가져요. 숫자로 보면 본기의 힘이 확실히 크죠?',
  '컴퓨터에 비유하면 본기는 CPU(두뇌), 중기는 메모리(보조 처리), 여기는 캐시(빠른 지원)와 같아요. 모두 함께 작동해야 컴퓨터가 제대로 돌아가는 것처럼, 지장간도 함께 작용한답니다.',
  '드라마에 비유하면 본기는 주인공, 중기는 주인공의 절친, 여기는 가끔 등장하지만 중요한 순간에 빛나는 조연이에요. 모든 캐릭터가 모여야 드라마가 완성되듯, 지장간도 그래요!',
  '피자에 비유하면, 본기는 도우(기본 바탕), 중기는 소스(맛의 핵심), 여기는 토핑(개성을 더해주는 것)이에요. 도우가 없으면 피자가 안 되지만, 소스와 토핑이 있어야 더 맛있어지죠!',
  '본기(本氣)는 지지가 가진 본래의 성질이에요. 중기(中氣)는 지지의 숨겨진 두 번째 얼굴이고, 여기(餘氣)는 이전 계절의 잔여 에너지가 아직 남아 있는 거예요. 계절이 갑자기 바뀌지 않는 것처럼요!',
  '지장간의 본기/중기/여기는 아침/점심/저녁 같은 거예요. 아침(본기)이 하루의 가장 큰 방향을 정하지만, 점심(중기)과 저녁(여기)도 하루를 완성하는 데 빠질 수 없는 부분이에요.',
  '무지개에 비유하면 본기는 가장 선명한 빨강, 중기는 중간의 초록, 여기는 끝의 보라예요. 모든 색이 있어야 완전한 무지개가 되는 것처럼, 지장간도 모든 요소가 함께 작용해요.',
  '지장간의 비율을 잘 보면, 그 사람의 진짜 내면이 보여요. 본기가 강한 사람은 한결같은 성격이고, 중기나 여기가 강한 사람은 다양한 면을 가진 복합적인 성격이랍니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  3. Per-pillar interpretation templates (15+ per variant set)
// ─────────────────────────────────────────────────────────────────────────────

const PILLAR_INTRO_TEMPLATES: readonly string[] = [
  '{{위치}}의 지지 {{지지}} 안에는 다음과 같은 지장간이 숨어 있어요.',
  '{{위치}}를 살펴볼까요? {{지지}} 안에 숨어 있는 천간은 이렇답니다.',
  '이번에는 {{위치}}의 숨겨진 내면을 들여다볼게요. {{지지}} 속의 지장간이에요.',
  '{{위치}}의 {{지지}}를 열어보면, 그 안에 이런 천간들이 숨어 있어요.',
  '{{위치}} 분석이에요. {{지지}} 속에 감춰진 에너지를 함께 확인해 봐요!',
  '{{위치}}의 지지 {{지지}}에는 어떤 보물이 숨어 있을까요? 함께 알아봐요!',
  '자, 이제 {{위치}}를 살펴볼 차례예요. {{지지}} 안에 어떤 천간이 있는지 확인해 봐요.',
  '{{위치}}에 위치한 {{지지}}의 내면을 들여다보면 이런 모습이에요.',
  '{{위치}}의 {{지지}}, 겉으로는 하나지만 안에는 여러 에너지가 공존하고 있어요.',
  '{{위치}} 차례예요! {{지지}} 안에 어떤 성격들이 숨어있는지 확인해 볼까요?',
  '{{위치}}의 지지 {{지지}}를 분석해 보면, 흥미로운 지장간이 발견돼요.',
  '이제 {{위치}}를 볼 시간이에요. {{지지}} 내부에는 이런 천간들이 자리하고 있답니다.',
  '{{위치}}의 {{지지}}에는 특별한 지장간이 있어요. 하나씩 살펴볼게요!',
  '{{위치}}의 숨은 이야기를 들어볼까요? {{지지}} 안에는 이런 기운들이 있어요.',
  '{{위치}}를 깊이 파고들면, {{지지}} 안에서 흥미로운 천간들을 만날 수 있어요.',
  '{{위치}}의 {{지지}} 속으로 들어가 볼게요. 어떤 지장간이 기다리고 있을까요?',
];

const HIDDEN_STEM_DETAIL_TEMPLATES: readonly string[] = [
  '{{역할}} {{천간}}은(는) {{오행}} 기운으로, 십성으로는 {{십성}}에 해당해요. {{비율}}의 영향력을 가지고 있답니다.',
  '{{역할}}인 {{천간}}({{오행}})은(는) {{십성}}의 에너지를 가지고 있어요. 영향력은 약 {{비율}}이에요.',
  '{{천간}}({{오행}})은(는) {{역할}}로서 {{비율}}의 힘을 가져요. 이것은 {{십성}}의 성질을 띠고 있어요.',
  '{{비율}}의 비중을 차지하는 {{역할}} {{천간}}! {{오행}} 기운이며, 십성으로 보면 {{십성}}이에요.',
  '{{역할}}에 해당하는 {{천간}}({{오행}})이 있어요. {{십성}}의 성격을 가지며, 영향력은 {{비율}}이랍니다.',
  '{{역할}}: {{천간}} - {{오행}} 기운, {{십성}} 성향 (영향력 {{비율}})',
  '{{천간}}은(는) {{오행}} 기운의 {{역할}}이에요. 십성 {{십성}}의 특성을 품고 있고, {{비율}} 정도의 힘을 발휘해요.',
  '{{역할}}으로 자리한 {{천간}}({{오행}})은(는) {{비율}}의 존재감을 가진 {{십성}}이에요.',
  '이 자리의 {{역할}}은 {{천간}}이에요. {{오행}} 기운을 가졌고, {{십성}}으로 작용하며 약 {{비율}}의 영향을 줘요.',
  '{{천간}}이(가) {{역할}}으로 {{비율}} 비중을 차지하고 있어요. {{오행}} 기운의 {{십성}}이랍니다.',
  '{{역할}}에는 {{천간}}({{오행}})이 있고, {{십성}}으로 작용해요. 전체에서 {{비율}}을 차지하는 존재예요.',
  '{{비율}} 비중의 {{역할}} {{천간}} - {{오행}} 에너지와 {{십성}} 성질을 동시에 품고 있어요.',
  '{{역할}}: {{천간}}이(가) {{오행}} 오행으로 {{십성}} 역할을 해요. 영향력은 {{비율}}이에요.',
  '{{역할}}인 {{천간}}({{오행}})은(는) 약 {{비율}} 정도의 힘으로 {{십성}}의 에너지를 내뿜고 있어요.',
  '{{천간}} - {{오행}}의 {{역할}} ({{비율}}), 십성은 {{십성}}으로 분류돼요.',
  '{{역할}} {{천간}}({{오행}}, {{비율}})은(는) {{십성}} 계열의 숨겨진 에너지예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  4. Ten god category personality templates (per category)
// ─────────────────────────────────────────────────────────────────────────────

const TEN_GOD_CATEGORY_PERSONALITY: Record<string, readonly string[]> = {
  friend: [
    '{{십성}}은(는) 나와 같은 기운이에요. 자립심이 강하고, 독립적으로 무언가를 해내는 힘이 숨어 있다는 뜻이에요.',
    '비겁 계열인 {{십성}}이 숨어 있어서, 내면 깊은 곳에 "내 힘으로 해내고 싶다"는 의지가 있어요.',
    '{{십성}}의 에너지가 지장간에 있으면, 겉으로 드러나진 않지만 경쟁심과 자존심이 강한 편이에요.',
    '숨겨진 {{십성}}은 동료와 함께할 때 더 빛나는 에너지예요. 팀워크 속에서 내면의 힘이 발현될 수 있어요.',
  ],
  output: [
    '{{십성}}은(는) 표현력과 관련된 에너지예요. 숨겨진 재능이나 예술적 감각이 내면에 잠들어 있을 수 있어요!',
    '식상 계열인 {{십성}}이 지장간에 있으면, 마음속에 창의적인 아이디어가 풍부하다는 의미예요.',
    '{{십성}}의 힘이 숨어 있어서, 적절한 기회가 오면 놀라운 표현력을 발휘할 수 있어요.',
    '내면에 숨겨진 {{십성}}은 먹거리 복이나 재능 발현과 관련이 있어요. 특별한 시기에 빛을 발할 수 있답니다.',
  ],
  wealth: [
    '{{십성}}은(는) 재물 에너지예요. 지장간에 있으면 숨겨진 재물운이나 경제 감각이 있다는 뜻이에요.',
    '재성 계열인 {{십성}}이 숨어 있어서, 돈을 다루는 감각이 내면에 잠재되어 있어요.',
    '{{십성}}의 에너지가 안에 있으면, 때가 되면 재물 관련 기회를 잘 잡을 수 있는 눈이 있어요.',
    '숨겨진 {{십성}}은 실질적인 이익을 추구하는 내면의 힘이에요. 알뜰하고 현실적인 면이 있다는 뜻이에요.',
  ],
  authority: [
    '{{십성}}은(는) 권위와 질서의 에너지예요. 내면 깊은 곳에 리더십이나 책임감이 자리하고 있어요.',
    '관성 계열인 {{십성}}이 지장간에 있으면, 겉으로는 자유로워 보여도 속으로는 규칙을 중시하는 면이 있어요.',
    '{{십성}}의 힘이 숨어 있어서, 중요한 순간에 결단력과 통솔력을 발휘할 수 있답니다.',
    '내면에 숨겨진 {{십성}}은 명예를 소중히 여기는 마음이에요. 사회적 인정에 대한 욕구가 있을 수 있어요.',
  ],
  resource: [
    '{{십성}}은(는) 학문과 지식의 에너지예요. 내면에 배움에 대한 열정이 숨어 있다는 뜻이에요!',
    '인성 계열인 {{십성}}이 지장간에 있으면, 마음 깊은 곳에서 공부나 자기계발에 대한 욕구가 있어요.',
    '{{십성}}의 에너지가 안에 있어서, 새로운 지식을 받아들이는 능력이 잠재되어 있어요.',
    '숨겨진 {{십성}}은 어머니의 사랑처럼 따뜻한 에너지예요. 누군가를 돌보고 싶은 마음이 있을 수 있어요.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. Position-specific interpretation templates (15+ per position)
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_INTERPRETATION_TEMPLATES: Record<PositionKey, readonly string[]> = {
  year: [
    '연주의 지장간은 조상으로부터 물려받은 숨겨진 기질을 보여줘요. {{요약}}',
    '어린 시절에 형성된 무의식적인 성향이 연주 지장간에 담겨 있어요. {{요약}}',
    '연주에 숨어 있는 지장간은 가문의 분위기와 유전적 성향을 반영해요. {{요약}}',
    '조부모님께서 물려주신 숨은 재능이 연주 지장간에 있을 수 있어요. {{요약}}',
    '연주의 지장간은 어릴 때부터 자연스럽게 몸에 밴 습관이나 성향을 나타내요. {{요약}}',
    '태어날 때부터 갖고 있던 근본적인 기질이 연주 지장간에서 드러나요. {{요약}}',
    '연주 지장간은 사회적 배경이나 가정환경에서 비롯된 내면의 힘이에요. {{요약}}',
    '유년기의 경험이 만든 잠재의식이 연주 지장간에 반영되어 있어요. {{요약}}',
    '연주의 숨은 에너지는 0세부터 15세 사이에 가장 큰 영향을 미쳐요. {{요약}}',
    '연주 지장간은 가족으로부터 받은 정서적 유산과 같아요. {{요약}}',
    '조상의 기운이 녹아든 연주 지장간은 무의식 중에 작용하는 힘이에요. {{요약}}',
    '어릴 적 환경이 심어준 씨앗이 연주 지장간에 담겨 있답니다. {{요약}}',
    '연주의 지장간은 뿌리와 같아요. 보이지 않지만 든든하게 받쳐주는 힘이에요. {{요약}}',
    '연주에 숨겨진 기운은 평소에는 드러나지 않지만, 어려운 상황에서 힘을 발휘해요. {{요약}}',
    '가문의 DNA처럼 연주 지장간은 자연스럽게 여러분에게 흐르는 에너지예요. {{요약}}',
  ],
  month: [
    '월주의 지장간은 사회생활에서 드러나는 숨겨진 능력을 보여줘요. {{요약}}',
    '직업이나 진로에서 발휘되는 잠재적 역량이 월주 지장간에 있어요. {{요약}}',
    '월주에 숨어 있는 지장간은 부모님의 영향과 사회적 성향을 반영해요. {{요약}}',
    '청년기에 꽃피우는 숨겨진 재능이 월주 지장간에 담겨 있답니다. {{요약}}',
    '월주의 지장간은 학교나 직장에서 무의식적으로 발휘하는 능력이에요. {{요약}}',
    '사회적 관계에서 은근히 드러나는 내면의 성향이 월주 지장간이에요. {{요약}}',
    '월주 지장간은 15~30세 사이에 가장 강하게 작용하는 숨겨진 힘이에요. {{요약}}',
    '직업 선택이나 진로 결정에 무의식적으로 영향을 주는 것이 월주 지장간이에요. {{요약}}',
    '월주에 숨겨진 에너지는 사회에서의 성공 방식에 영향을 준답니다. {{요약}}',
    '부모님의 가르침이 녹아든 월주 지장간은 사회생활의 기반이 되어요. {{요약}}',
    '월주의 지장간은 여러분의 "사회적 잠재력"을 보여주는 지표예요. {{요약}}',
    '월주 지장간에 담긴 에너지는 진로를 선택할 때 은근한 나침반 역할을 해요. {{요약}}',
    '학업과 커리어에서 빛을 발하는 숨겨진 힘이 월주 지장간에 있어요. {{요약}}',
    '월주의 숨은 천간들은 사회적 성향과 직업적 적성을 암시해요. {{요약}}',
    '월주 지장간은 외부 세계와 소통하는 방식에 영향을 미치는 내면의 코드예요. {{요약}}',
  ],
  day: [
    '일주의 지장간은 가장 깊은 내면, 진짜 자아를 보여줘요. {{요약}}',
    '자기 자신의 본질적인 성격이 일주 지장간에 담겨 있어요. {{요약}}',
    '배우자와의 관계에서 드러나는 숨겨진 면이 일주 지장간에 있답니다. {{요약}}',
    '일주의 지장간은 혼자 있을 때 나오는 진짜 모습을 반영해요. {{요약}}',
    '장년기(30~50세)에 가장 강하게 작용하는 내면의 힘이 일주 지장간이에요. {{요약}}',
    '일주 지장간은 가장 가까운 사람에게만 보여주는 숨겨진 성격이에요. {{요약}}',
    '자아 정체성의 핵심이 담긴 곳이 바로 일주의 지장간이에요. {{요약}}',
    '일주의 숨은 천간은 결혼 생활이나 동반자 관계에 영향을 주는 에너지예요. {{요약}}',
    '일주 지장간은 나 자신을 깊이 이해하는 열쇠와 같아요. {{요약}}',
    '진정한 자아와 가장 가까운 에너지가 일주 지장간에 있어요. {{요약}}',
    '일주의 지장간은 마음의 가장 깊은 곳에서 작용하는 힘이에요. {{요약}}',
    '스스로를 돌아보면 발견하게 되는 숨겨진 성향이 일주 지장간에 있답니다. {{요약}}',
    '일주 지장간은 "진짜 나"를 알려주는 소중한 정보예요. {{요약}}',
    '가장 솔직한 내 모습이 담긴 곳, 그것이 일주의 지장간이에요. {{요약}}',
    '일주의 숨은 에너지는 인생의 중반기에 가장 강하게 발현돼요. {{요약}}',
  ],
  hour: [
    '시주의 지장간은 말년에 드러나는 숨겨진 잠재력을 보여줘요. {{요약}}',
    '자녀운이나 노후의 모습이 시주 지장간에 암시되어 있어요. {{요약}}',
    '인생의 마무리에서 빛을 발하는 에너지가 시주 지장간에 있답니다. {{요약}}',
    '시주의 지장간은 미래에 꽃피울 가능성을 품고 있어요. {{요약}}',
    '50세 이후에 강하게 작용하는 숨은 힘이 시주 지장간이에요. {{요약}}',
    '시주 지장간은 자녀와의 관계에서 무의식적으로 작용하는 에너지예요. {{요약}}',
    '인생의 결실과 관련된 숨겨진 에너지가 시주 지장간에 담겨 있어요. {{요약}}',
    '노년에 드러나는 지혜와 여유가 시주 지장간에 암시되어 있답니다. {{요약}}',
    '시주의 숨은 천간은 꿈과 이상, 그리고 후대에 남길 유산과 관련돼요. {{요약}}',
    '시주 지장간은 아직 발현되지 않은 미래의 가능성이에요. {{요약}}',
    '시주의 지장간은 씨앗처럼, 나중에 크게 자라날 잠재력을 품고 있어요. {{요약}}',
    '시주 지장간에 담긴 에너지는 인생 후반부의 방향을 보여주는 힌트예요. {{요약}}',
    '자녀에게 물려줄 기질이나 성향이 시주 지장간에 반영되어 있어요. {{요약}}',
    '시주의 숨은 에너지는 은퇴 후에도 활력을 유지하는 원동력이 될 수 있어요. {{요약}}',
    '인생의 후반전에서 빛나는 숨겨진 보석이 시주 지장간에 있답니다. {{요약}}',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  6. Pillar summary sentence templates
// ─────────────────────────────────────────────────────────────────────────────

const PILLAR_SUMMARY_TEMPLATES: readonly string[] = [
  '본기 {{본기십성}}, 중기 {{중기십성}}, 여기 {{여기십성}}의 조합이에요.',
  '핵심은 {{본기십성}}이고, {{중기십성}}과 {{여기십성}}이 뒤에서 도와줘요.',
  '{{본기십성}}을(를) 중심으로 {{중기십성}}, {{여기십성}}이 함께 작용해요.',
  '{{본기십성}} 에너지가 가장 강하고, {{중기십성}}과 {{여기십성}}이 보조해요.',
  '주된 에너지는 {{본기십성}}이며, {{중기십성}}과 {{여기십성}}이 곁에 있어요.',
];

const PILLAR_SUMMARY_TWO_STEMS: readonly string[] = [
  '본기 {{본기십성}}과 중기 {{중기십성}}의 조합이에요.',
  '{{본기십성}}이 핵심이고, {{중기십성}}이 보조 역할을 해요.',
  '주된 힘은 {{본기십성}}에 있고, {{중기십성}}이 함께 어우러져요.',
  '{{본기십성}}과 {{중기십성}}이 함께 작용하는 구조예요.',
  '{{본기십성}}을(를) 중심으로 {{중기십성}}이 뒤에서 지원해요.',
];

const PILLAR_SUMMARY_ONE_STEM: readonly string[] = [
  '본기 {{본기십성}} 하나만 있어서, 에너지가 매우 집중되어 있어요.',
  '{{본기십성}} 에너지 하나에 온전히 집중된 구조예요.',
  '오직 {{본기십성}}만 있어서 그 힘이 더욱 순수하고 강해요.',
  '단일 {{본기십성}} 에너지로, 방향이 뚜렷하고 명확해요.',
  '{{본기십성}} 하나에 모든 에너지가 모여 있어 집중력이 대단해요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  7. Concluding / tip templates (15+)
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_TIP_TEMPLATES: readonly string[] = [
  '지장간은 평소에는 잘 드러나지 않지만, 대운이나 세운에서 같은 천간이 올 때 활성화돼요. 그때 숨겨진 능력이 갑자기 발현될 수 있답니다!',
  '지장간의 에너지는 특정 시기(대운/세운)에 "깨어나는" 특성이 있어요. 자신의 지장간을 알아두면 기회를 미리 준비할 수 있어요.',
  '지장간은 눈에 보이지 않는 잠재력이에요. 지금 당장 느끼지 못하더라도, 때가 되면 반드시 빛을 발한답니다. 자신을 믿어주세요!',
  '지장간을 이해하면 "왜 나는 이런 면이 있을까?"라는 의문이 풀릴 수 있어요. 숨겨진 내면의 힘을 알아가는 것이 사주 공부의 매력이랍니다.',
  '지장간의 십성이 용신(필요한 오행)과 같다면 더욱 좋은 의미예요. 숨겨진 곳에 도움이 되는 에너지가 있다는 뜻이거든요!',
  '지장간에 같은 종류의 십성이 여러 개 있으면, 그 에너지가 특히 강해요. 해당 분야에서 뛰어난 잠재력을 발휘할 수 있답니다.',
  '지장간의 숨겨진 에너지를 잘 활용하려면, 자기 내면의 목소리에 귀를 기울여 보세요. "나도 모르게 끌리는 것"이 바로 지장간의 영향일 수 있어요.',
  '지장간은 사주의 "조미료" 같은 역할을 해요. 천간과 지지만으로는 부족한 설명을 지장간이 채워준답니다.',
  '합(合)이나 충(冲) 같은 관계가 생길 때, 지장간이 변화할 수 있어요. 이런 변화가 인생의 전환점이 되기도 한답니다.',
  '지장간 분석은 사주의 고급 단계예요. 이것까지 이해하면 자신과 타인을 더 깊이 이해할 수 있게 된답니다!',
  '여러분의 지장간에 다양한 오행이 있다면, 그만큼 다재다능한 잠재력을 가지고 있다는 뜻이에요. 여러 분야에서 가능성이 열려 있답니다!',
  '지장간에 인성(학문)이 숨어 있는 분은 공부에 대한 숨겨진 열정이 있어요. 때가 되면 학업에서 좋은 성과를 낼 수 있답니다.',
  '지장간의 에너지는 명상이나 자기성찰을 통해 더 잘 느낄 수 있어요. 가끔 조용히 자신을 돌아보는 시간을 가져보세요.',
  '사주에서 겉으로 드러난 것과 지장간이 다른 경우가 많아요. 이런 차이가 "겉과 속이 다른 모습"으로 나타날 수 있는데, 그게 바로 여러분의 풍부한 내면이에요!',
  '지장간을 모르고 사주를 보는 것은, 물 위의 빙산만 보는 것과 같아요. 지장간까지 알아야 진짜 내 사주를 이해할 수 있답니다.',
  '앞으로 대운이나 세운에서 지장간의 천간과 같은 글자가 올 때, "아, 이 시기에 내 숨겨진 에너지가 깨어나는구나!"라고 생각해 보세요.',
  '지장간에 재성이 숨어 있으면 숨겨진 재물운이, 관성이 숨어 있으면 숨겨진 리더십이, 식상이 숨어 있으면 숨겨진 창의력이 있다는 뜻이에요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  8. Comprehensive overview templates
// ─────────────────────────────────────────────────────────────────────────────

const OVERVIEW_TEMPLATES: readonly string[] = [
  '전체적으로 살펴보면, 지장간에 {{카테고리들}}의 에너지가 골고루 분포되어 있어요.',
  '지장간을 종합해 보면, {{카테고리들}}이 주된 숨겨진 에너지예요.',
  '모든 기둥의 지장간을 합쳐 보면, {{카테고리들}} 계열의 에너지가 눈에 띄어요.',
  '지장간 전체를 조망하면, {{카테고리들}}이 여러분의 주요 잠재 에너지랍니다.',
  '4개 기둥의 지장간을 모두 살펴보니, {{카테고리들}} 쪽 에너지가 풍부해요.',
];

const OVERVIEW_DOMINANT_TEMPLATES: readonly string[] = [
  '특히 {{카테고리}} 계열의 에너지가 강해서, 숨겨진 {{특성}}이 돋보여요.',
  '지장간에서 {{카테고리}} 에너지가 두드러져요. 내면에 {{특성}}이 강하다는 의미예요.',
  '{{카테고리}} 계열이 지장간에서 가장 많이 나타나는데, 이는 {{특성}}이 잠재되어 있다는 뜻이에요.',
  '숨겨진 에너지 중 {{카테고리}}이 가장 강해요. {{특성}}에 대한 잠재력이 크답니다.',
  '내면 깊은 곳에서 {{카테고리}}의 기운이 가장 강하게 흘러요. {{특성}}이 여러분의 숨은 강점이에요.',
];

const CATEGORY_TRAIT: Record<string, string> = {
  friend: '자립심과 독립성',
  output: '창의력과 표현력',
  wealth: '재물 감각과 현실감',
  authority: '리더십과 책임감',
  resource: '학문적 열정과 지적 호기심',
};

// ─────────────────────────────────────────────────────────────────────────────
//  9. Additional depth: element interaction in hidden stems
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENT_INTERACTION_TEMPLATES: readonly string[] = [
  '지장간에 {{오행1}}과 {{오행2}}이 함께 있는데, 이 둘은 서로 상생 관계예요. 내면의 에너지가 자연스럽게 흘러간다는 좋은 신호랍니다!',
  '{{오행1}}과 {{오행2}}이 지장간에서 만났는데, 이 조합은 서로 돕는 관계(상생)예요. 내면의 조화가 잘 이루어져 있어요.',
  '지장간 안에서 {{오행1}}과 {{오행2}}이 상극 관계를 이루고 있어요. 내면에서 약간의 갈등이 있을 수 있지만, 이것이 오히려 성장의 동력이 되기도 해요.',
  '{{오행1}}과 {{오행2}}이 지장간에서 만나 긴장 관계를 만들어요. 하지만 걱정하지 마세요! 이런 긴장이 오히려 강한 에너지를 만들어 내기도 한답니다.',
  '지장간 내부에서 {{오행1}}과 {{오행2}}이 공존하고 있어요. 서로 다른 기운이 균형을 이루며 여러분의 내면을 풍요롭게 만들어 주고 있어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  10. Fun-fact / encouragement templates
// ─────────────────────────────────────────────────────────────────────────────

const FUN_FACT_TEMPLATES: readonly string[] = [
  '재미있는 사실! 지장간은 계절의 변화와도 관련이 있어요. 여기(餘氣)는 이전 계절의 잔여 기운이고, 본기(本氣)는 현재 계절의 핵심 기운이랍니다.',
  '알고 계셨나요? 지장간은 한 달 안에서도 시간에 따라 강도가 변해요. 월초에는 여기가, 월중에는 중기가, 월말에는 본기가 가장 강하답니다!',
  '지장간의 "장(藏)"은 "숨기다, 감추다"라는 뜻이에요. 말 그대로 땅(地) 속에 감춰진(藏) 하늘(干)의 기운이라는 아름다운 이름이에요.',
  '옛 사주학자들은 지장간을 "내면의 거울"이라고 불렀어요. 겉으로 보이는 모습이 아닌 진짜 마음을 비추는 거울이라는 뜻이에요.',
  '지장간은 동양 철학에서 "음중양(陰中陽)" 개념과 통해요. 음(땅/지지) 안에도 양(하늘/천간)이 있다는 깊은 의미를 담고 있답니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN GENERATOR FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function generateHiddenStemsSection(input: ReportInput): ReportSection | null {
  // ── Guard: tenGodAnalysis must exist ───────────────────────────────────────
  const tenGodAnalysis = input.saju.tenGodAnalysis;
  if (!tenGodAnalysis) return null;

  const byPosition = tenGodAnalysis.byPosition;
  if (!byPosition) return null;

  const rng = createRng(input);
  // Offset the seed so this section has its own variation space
  for (let i = 0; i < 7; i++) rng.next();

  const paragraphs: ReportParagraph[] = [];
  const tables: ReportTable[] = [];
  const highlights: ReportHighlight[] = [];
  const subsections: ReportSection['subsections'] = [];

  // ── 1. Concept Introduction ───────────────────────────────────────────────
  const conceptIntro = rng.pick(CONCEPT_INTRO_TEMPLATES);
  paragraphs.push(narrative(conceptIntro));

  // ── 2. Fun fact ───────────────────────────────────────────────────────────
  const funFact = rng.pick(FUN_FACT_TEMPLATES);
  paragraphs.push(tip(funFact));

  // ── 3. 본기/중기/여기 metaphor explanation ────────────────────────────────
  const roleMetaphor = rng.pick(ROLE_METAPHOR_TEMPLATES);
  paragraphs.push(narrative(roleMetaphor));

  // ── 4. Overview Table: all 4 pillars' hidden stems ────────────────────────
  const overviewTable = buildOverviewTable(input, byPosition);
  if (overviewTable) {
    tables.push(overviewTable);
  }

  // ── 5. Per-pillar detailed analysis ───────────────────────────────────────
  const categoryCounts: Record<string, number> = {
    friend: 0, output: 0, wealth: 0, authority: 0, resource: 0,
  };

  for (const posKey of POSITION_KEYS) {
    const posData = byPosition[posKey];
    if (!posData) continue;

    const hiddenStems = posData.hiddenStems;
    const hiddenTenGods = posData.hiddenStemTenGod;
    if (!hiddenStems || hiddenStems.length === 0) continue;

    const pillar = input.saju.pillars[posKey];
    if (!pillar) continue;

    const branchStr = branchDisplay(pillar.branch.code || pillar.branch.hangul);

    // Pillar intro
    const pillarIntro = pickAndFill(rng, PILLAR_INTRO_TEMPLATES, {
      '위치': POSITION_KOREAN[posKey],
      '지지': branchStr,
    });

    const pillarParagraphs: ReportParagraph[] = [];
    pillarParagraphs.push(emphasis(pillarIntro));

    // Detail per hidden stem
    for (let idx = 0; idx < hiddenStems.length; idx++) {
      const hs = hiddenStems[idx];
      const tenGodEntry = hiddenTenGods[idx] ?? hiddenTenGods[0];
      const role = hiddenStemRole(idx, hiddenStems.length);
      const roleShort = hiddenStemRoleShort(idx, hiddenStems.length);
      const stemDisp = stemDisplay(hs.stem);
      const elemKor = elementCodeToKorean(hs.element);
      const elemFull = hs.element ? (ELEMENT_KOREAN[hs.element as ElementCode] ?? elemKor) : elemKor;
      const tenGodCode = tenGodEntry?.tenGod ?? '';
      const tenGodDisp = tenGodKorean(tenGodCode);
      const tenGodShortStr = tenGodShort(tenGodCode);
      const ratio = ratioToPercent(hs.ratio);

      const detail = pickAndFill(rng, HIDDEN_STEM_DETAIL_TEMPLATES, {
        '역할': role,
        '천간': stemDisp,
        '오행': elemKor,
        '십성': tenGodDisp,
        '비율': ratio,
      });
      pillarParagraphs.push(narrative(detail, hs.element as ElementCode | undefined));

      // Category personality comment for 본기 (strongest) only
      if (idx === 0) {
        const tenGodInfo = TEN_GOD_BY_CODE[tenGodCode];
        if (tenGodInfo) {
          const catTemplates = TEN_GOD_CATEGORY_PERSONALITY[tenGodInfo.category];
          if (catTemplates && catTemplates.length > 0) {
            const personalityComment = pickAndFill(rng, catTemplates, {
              '십성': tenGodDisp,
            });
            pillarParagraphs.push(positive(personalityComment, hs.element as ElementCode | undefined));
          }
        }
      }

      // Track category counts
      if (tenGodCode) {
        const info = TEN_GOD_BY_CODE[tenGodCode];
        if (info && categoryCounts[info.category] !== undefined) {
          categoryCounts[info.category] += hs.ratio;
        }
      }
    }

    // Pillar summary sentence
    const summaryVars = buildPillarSummaryVars(hiddenStems, hiddenTenGods);
    let pillarSummary: string;
    if (hiddenStems.length === 1) {
      pillarSummary = pickAndFill(rng, PILLAR_SUMMARY_ONE_STEM, summaryVars);
    } else if (hiddenStems.length === 2) {
      pillarSummary = pickAndFill(rng, PILLAR_SUMMARY_TWO_STEMS, summaryVars);
    } else {
      pillarSummary = pickAndFill(rng, PILLAR_SUMMARY_TEMPLATES, summaryVars);
    }

    // Position-specific interpretation
    const posInterpVars = { '요약': pillarSummary };
    const posInterp = pickAndFill(rng, POSITION_INTERPRETATION_TEMPLATES[posKey], posInterpVars);
    pillarParagraphs.push(narrative(posInterp));

    // Element interaction comment (if 2+ hidden stems)
    if (hiddenStems.length >= 2) {
      const elem1 = elementCodeToKorean(hiddenStems[0].element);
      const elem2 = elementCodeToKorean(hiddenStems[1].element);
      if (elem1 && elem2 && elem1 !== elem2) {
        const interaction = pickAndFill(rng, ELEMENT_INTERACTION_TEMPLATES, {
          '오행1': elem1,
          '오행2': elem2,
        });
        pillarParagraphs.push(narrative(interaction));
      }
    }

    // Build highlight for this pillar
    const mainTenGod = hiddenTenGods[0];
    if (mainTenGod) {
      highlights.push({
        label: `${POSITION_SHORT[posKey]} 본기 십성`,
        value: tenGodShort(mainTenGod.tenGod),
        element: (hiddenStems[0]?.element as ElementCode) ?? undefined,
        sentiment: 'neutral',
      });
    }

    subsections!.push({
      title: `${POSITION_SHORT[posKey]} 지장간 (${branchStr})`,
      paragraphs: pillarParagraphs,
    });
  }

  // ── 6. Comprehensive overview ─────────────────────────────────────────────
  const sortedCategories = Object.entries(categoryCounts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sortedCategories.length > 0) {
    const categoryNames = sortedCategories
      .slice(0, 3)
      .map(([cat]) => TEN_GOD_CATEGORY_KOREAN[cat] ?? cat);

    const overviewText = pickAndFill(rng, OVERVIEW_TEMPLATES, {
      '카테고리들': categoryNames.join(', '),
    });
    paragraphs.push(narrative(overviewText));

    // Dominant category
    const [dominantCat] = sortedCategories[0];
    const dominantTrait = CATEGORY_TRAIT[dominantCat] ?? '';
    const dominantName = TEN_GOD_CATEGORY_KOREAN[dominantCat] ?? dominantCat;
    if (dominantTrait) {
      const dominantText = pickAndFill(rng, OVERVIEW_DOMINANT_TEMPLATES, {
        '카테고리': dominantName,
        '특성': dominantTrait,
      });
      paragraphs.push(positive(dominantText));
    }
  }

  // ── 7. Detailed ten god table ─────────────────────────────────────────────
  const tenGodTable = buildTenGodTable(byPosition);
  if (tenGodTable) {
    tables.push(tenGodTable);
  }

  // ── 8. Closing tips ───────────────────────────────────────────────────────
  const closingTips = rng.sample(CLOSING_TIP_TEMPLATES, 2);
  for (const tipText of closingTips) {
    paragraphs.push(tip(tipText));
  }

  // ── Assemble section ──────────────────────────────────────────────────────
  return {
    id: 'hiddenStems',
    title: '지장간(支藏干) 분석',
    subtitle: '지지 속에 숨어 있는 천간의 비밀',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
    subsections: subsections!.length > 0 ? subsections : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Build overview table
// ─────────────────────────────────────────────────────────────────────────────

function buildOverviewTable(
  input: ReportInput,
  byPosition: Record<string, { hiddenStems: { stem: string; element: string; ratio: number }[]; hiddenStemTenGod: { stem: string; tenGod: string }[] }>,
): ReportTable | null {
  const headers = ['기둥', '지지', '본기', '중기', '여기'];
  const rows: string[][] = [];

  for (const posKey of POSITION_KEYS) {
    const posData = byPosition[posKey];
    if (!posData) continue;
    const pillar = input.saju.pillars[posKey];
    if (!pillar) continue;

    const branchStr = `${pillar.branch.hangul}(${pillar.branch.hanja})`;
    const hiddenStems = posData.hiddenStems ?? [];

    const cellForIndex = (idx: number): string => {
      if (idx >= hiddenStems.length) return '-';
      const hs = hiddenStems[idx];
      const sInfo = lookupStemInfo(hs.stem);
      const name = sInfo ? `${sInfo.hangul}(${sInfo.hanja})` : hs.stem;
      const elem = elementCodeToKorean(hs.element);
      return `${name} ${elem} ${ratioToPercent(hs.ratio)}`;
    };

    rows.push([
      POSITION_SHORT[posKey],
      branchStr,
      cellForIndex(0),
      cellForIndex(1),
      cellForIndex(2),
    ]);
  }

  if (rows.length === 0) return null;

  return {
    title: '4주 지장간 일람표',
    headers,
    rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Build ten god detail table
// ─────────────────────────────────────────────────────────────────────────────

function buildTenGodTable(
  byPosition: Record<string, { hiddenStems: { stem: string; element: string; ratio: number }[]; hiddenStemTenGod: { stem: string; tenGod: string }[] }>,
): ReportTable | null {
  const headers = ['기둥', '역할', '천간', '오행', '십성', '카테고리', '비율'];
  const rows: string[][] = [];

  for (const posKey of POSITION_KEYS) {
    const posData = byPosition[posKey];
    if (!posData) continue;
    const hiddenStems = posData.hiddenStems ?? [];
    const hiddenTenGods = posData.hiddenStemTenGod ?? [];

    for (let idx = 0; idx < hiddenStems.length; idx++) {
      const hs = hiddenStems[idx];
      const tg = hiddenTenGods[idx];
      const role = hiddenStemRoleShort(idx, hiddenStems.length);
      const sInfo = lookupStemInfo(hs.stem);
      const stemName = sInfo ? `${sInfo.hangul}(${sInfo.hanja})` : hs.stem;
      const elemName = elementCodeToKorean(hs.element);
      const tgName = tg ? tenGodShort(tg.tenGod) : '-';
      const tgCat = tg ? tenGodCategory(tg.tenGod) : '-';

      rows.push([
        POSITION_SHORT[posKey],
        role,
        stemName,
        elemName,
        tgName,
        tgCat,
        ratioToPercent(hs.ratio),
      ]);
    }
  }

  if (rows.length === 0) return null;

  return {
    title: '지장간 십성 상세표',
    headers,
    rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Build summary vars for pillar summary sentence
// ─────────────────────────────────────────────────────────────────────────────

function buildPillarSummaryVars(
  hiddenStems: { stem: string; element: string; ratio: number }[],
  hiddenTenGods: { stem: string; tenGod: string }[],
): Record<string, string> {
  const getTenGodLabel = (idx: number): string => {
    const tg = hiddenTenGods[idx];
    return tg ? tenGodShort(tg.tenGod) : '(불명)';
  };

  const vars: Record<string, string> = {
    '본기십성': getTenGodLabel(0),
  };

  if (hiddenStems.length >= 2) {
    vars['중기십성'] = getTenGodLabel(1);
  }
  if (hiddenStems.length >= 3) {
    vars['여기십성'] = getTenGodLabel(2);
  }

  return vars;
}
