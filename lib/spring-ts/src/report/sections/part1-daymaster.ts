/**
 * part1-daymaster.ts -- 일간(나) 기본 정보 섹션 생성기
 *
 * PART 1-2에 해당하며, 일간 천간의 성격 프로필, 오행 역할 매핑표,
 * 일지 12운성을 매거진 에디터 톤으로 서술합니다.
 *
 * - 세련된 잡지 에디터 페르소나: 깊이 있고 감각적인 문장
 * - SeededRandom으로 결정론적 다양성 보장 (RNG offset: 8)
 * - 10개 천간 각각의 입체적 성격 프로필 (STEM_PROFILES)
 * - dayMasterRoleByElement 기반 오행→역할 매핑 테이블
 * - 일지 12운성 언급
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportHighlight,
  ElementCode,
  StemCode,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_NATURE,
  ELEMENT_COLOR,
  ELEMENT_SEASON,
  ELEMENT_EMOTION,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLLED_BY,
  LIFE_STAGE_BY_CODE,
  lookupStemInfo,
  elementCodeToKorean,
  yinYangToKorean,
  type StemInfo,
  type LifeStageInfo,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  emphasis,
  tip,
  joinSentences,
  eunNeun,
  iGa,
  eulReul,
} from '../common/sentenceUtils.js';

import {
  getStemEncyclopediaEntry,
  type StemEncyclopediaEntry,
} from '../knowledge/stemEncyclopedia.js';

// ─────────────────────────────────────────────────────────────────────────────
//  DayMasterRole 매핑 상수
// ─────────────────────────────────────────────────────────────────────────────

type DayMasterRole = 'COMPANION' | 'RESOURCE' | 'OUTPUT' | 'WEALTH' | 'OFFICER';

const ROLE_KOREAN: Record<DayMasterRole, string> = {
  COMPANION: '비겁(比劫)',
  RESOURCE: '인성(印星)',
  OUTPUT: '식상(食傷)',
  WEALTH: '재성(財星)',
  OFFICER: '관성(官星)',
};

const ROLE_DESC: Record<DayMasterRole, string> = {
  COMPANION: '나와 같은 기운 -- 동료, 형제, 경쟁자',
  RESOURCE: '나를 낳아주는 기운 -- 학문, 어머니, 지혜',
  OUTPUT: '내가 낳는 기운 -- 재능, 표현, 창의력',
  WEALTH: '내가 다스리는 기운 -- 재물, 실리, 사업',
  OFFICER: '나를 다스리는 기운 -- 명예, 직장, 규율',
};

// ─────────────────────────────────────────────────────────────────────────────
//  STEM_PROFILES: 10개 천간별 입체적 성격 프로필
// ─────────────────────────────────────────────────────────────────────────────

interface StemProfile {
  /** 핵심 성격 서술 */
  readonly personality: string;
  /** 강점 서술 */
  readonly strengths: string;
  /** 주의사항 서술 */
  readonly cautions: string;
  /** 한 줄 아키타입 */
  readonly archetype: string;
  /** 내면 세계 */
  readonly innerWorld: string;
  /** 사회적 스타일 */
  readonly socialStyle: string;
}

const STEM_PROFILES: Record<string, StemProfile> = {
  GAP: {
    personality:
      '거대한 참나무처럼 흔들림 없는 중심을 가진 사람이에요. 한번 뿌리내린 신념은 쉽게 바뀌지 않고, 그 안에서 조용한 위엄이 자연스럽게 흘러나오죠.',
    strengths:
      '리더십과 추진력이 뛰어나서 주변에 자연스레 사람들이 모여드는 법이에요. 위기 상황에서도 의연하게 판단하는 직관력이야말로 갑목의 가장 큰 자산이랍니다.',
    cautions:
      '다만 고집이 지나치면 유연성을 잃을 수 있어요. 큰 나무일수록 바람에 부러지지 않으려면 가끔은 가지를 낮추는 지혜가 필요하거든요.',
    archetype: '고목(古木)의 개척자',
    innerWorld: '속으로는 누구보다 따뜻한 온정을 품고 있지만, 그걸 먼저 드러내는 데에는 서툰 편이에요.',
    socialStyle: '처음엔 다소 무뚝뚝해 보여도, 한번 마음을 연 상대에게는 한없이 의리 있는 동료가 되어주죠.',
  },
  EUL: {
    personality:
      '담쟁이덩굴이 어떤 벽이든 타고 오르듯, 환경에 맞춰 유연하게 길을 찾아가는 천재적 적응력을 지녔어요. 부드러움 속에 끈질긴 생명력이 숨어 있는 셈이에요.',
    strengths:
      '섬세한 감성과 뛰어난 공감능력으로 사람의 마음을 꿰뚫는 통찰력이 돋보여요. 예술적 감각이 일상 곳곳에 배어 나오는 것도 을목의 매력이죠.',
    cautions:
      '때로는 남의 눈치를 너무 살피다가 정작 자신의 목소리를 놓칠 수 있어요. 부드러움이 강점이지만, 중심을 잡는 연습도 꼭 필요하답니다.',
    archetype: '유연한 공감의 예술가',
    innerWorld: '겉으로는 순한 풀처럼 보여도, 내면에는 누구도 꺾지 못하는 단단한 의지가 뿌리처럼 뻗어 있어요.',
    socialStyle: '사교적이고 친화력이 뛰어나 어디서든 분위기 메이커 역할을 자연스럽게 해내는 편이에요.',
  },
  BYEONG: {
    personality:
      '한낮의 태양처럼 강렬한 존재감을 내뿜는 사람이에요. 방에 들어서는 것만으로도 공기의 온도가 달라진다는 이야기를 들을 만큼, 타고난 카리스마의 소유자이죠.',
    strengths:
      '열정과 추진력이 남달라서 목표를 향해 거침없이 나아가요. 공정함에 대한 본능적 감각이 있어서, 주변 사람들의 신뢰를 자연스럽게 얻는 편이랍니다.',
    cautions:
      '열정이 과하면 자기 페이스에 주변을 끌고 가려는 성향이 나올 수 있어요. 태양도 저녁에는 지평선 아래로 쉬러 가듯, 적절한 휴식의 타이밍을 아는 것이 중요하거든요.',
    archetype: '뜨거운 열정의 태양',
    innerWorld: '겉의 화려함과 달리, 속으로는 끊임없이 자신의 영향력에 대해 책임감을 느끼며 고민하는 면이 있어요.',
    socialStyle: '사람을 끌어당기는 자석 같은 매력이 있어서, 자연스럽게 그룹의 중심에 서게 되는 타입이에요.',
  },
  JEONG: {
    personality:
      '촛불처럼 은은하면서도 꺼지지 않는 빛을 가진 사람이에요. 화려하지 않지만 어둠 속에서 가장 먼저 찾게 되는 존재, 그것이 바로 정화의 본질이랍니다.',
    strengths:
      '디테일을 놓치지 않는 섬세함과 집중력이 탁월해요. 예리한 분석력에 따뜻한 배려심까지 겸비하고 있어서, 전문 분야에서 빛을 발하는 경우가 많죠.',
    cautions:
      '완벽을 추구하다 보면 결정을 미루는 순간이 올 수 있어요. 모든 것을 밝힐 필요 없이, 때로는 어둠 속에서도 한 걸음을 내딛는 용기가 필요한 법이에요.',
    archetype: '섬세한 빛의 탐구자',
    innerWorld: '감성이 풍부하고 내면의 세계가 넓어서, 혼자만의 시간에서 창조적 에너지를 충전하는 경향이 있어요.',
    socialStyle: '소수의 깊은 관계를 선호하며, 한번 맺은 인연에는 놀라울 정도로 헌신적인 모습을 보여주죠.',
  },
  MU: {
    personality:
      '거대한 산맥처럼 묵직한 존재감과 신뢰를 내뿜는 사람이에요. 주변이 아무리 흔들려도 무토는 중심축처럼 꿋꿋이 버텨내는 힘이 DNA에 새겨져 있죠.',
    strengths:
      '사람과 일 모두에서 균형 잡힌 시각을 유지할 줄 알아요. 포용력이 넓어서 다양한 성향의 사람들을 하나로 모으는 통합의 리더십이 빛나는 타입이에요.',
    cautions:
      '변화보다 안정을 선호하다 보면 새로운 기회를 놓칠 때가 있어요. 산은 움직이지 않지만, 산 위의 바람은 끊임없이 변한다는 사실도 기억해 두면 좋겠어요.',
    archetype: '듬직한 대지의 수호자',
    innerWorld: '겉은 무심해 보여도, 내면에는 주변 사람들의 안위에 대한 깊은 걱정이 늘 흐르고 있어요.',
    socialStyle: '신뢰와 의리로 관계를 쌓아가며, 한번 맡은 역할에는 끝까지 책임을 다하는 든든한 존재이죠.',
  },
  GI: {
    personality:
      '비 온 뒤의 기름진 토양처럼, 조용히 모든 것을 키워내는 숨은 힘을 가진 사람이에요. 기토는 드러나지 않는 곳에서 가장 큰 변화를 일으키는 자양분과도 같아요.',
    strengths:
      '세심한 관찰력과 실용적 지혜가 뛰어나요. 이론보다 현실에서 답을 찾는 능력이 출중해서, 실무에서 진가를 발휘하는 타입이랍니다.',
    cautions:
      '너무 현실에만 매몰되면 꿈과 비전의 크기가 줄어들 수 있어요. 가끔은 씨앗을 심듯, 먼 미래를 향한 상상의 나래를 펼쳐보는 것도 좋겠어요.',
    archetype: '실용적 지혜의 농부',
    innerWorld: '말수는 적지만 생각의 깊이가 놀라울 정도로 깊어서, 대화할수록 지적 매력이 빛나는 사람이에요.',
    socialStyle: '진심을 다해 돌보는 스타일로, 함께하는 사람들에게 편안한 안식처 같은 느낌을 주는 편이죠.',
  },
  GYEONG: {
    personality:
      '정련되지 않은 원석 같은 잠재력을 가진 사람이에요. 경금은 거친 광석이 단련을 거쳐 명검이 되듯, 시련 속에서 가장 빛나는 날을 세우는 강철 같은 존재이죠.',
    strengths:
      '결단력과 실행력이 발군이에요. 한번 마음먹으면 주저 없이 행동으로 옮기는 추진력, 그리고 불의에 타협하지 않는 곧은 기질이 주변의 존경을 받는 이유랍니다.',
    cautions:
      '칼날이 너무 날카로우면 자기 자신도 베이는 법이에요. 강경한 태도가 때로는 인간관계에서 마찰을 일으킬 수 있으니, 부드러운 소통의 기술도 함께 갈고닦으면 좋겠어요.',
    archetype: '불굴의 강철 전사',
    innerWorld: '투박한 겉모습 뒤에는 의외로 섬세한 감수성이 숨어 있어서, 가까운 사람 앞에서는 순수한 면모를 드러내기도 해요.',
    socialStyle: '의리 하나만큼은 타의 추종을 불허해서, 주변에 두터운 인간관계를 오래 유지하는 편이에요.',
  },
  SIN: {
    personality:
      '세공된 보석처럼 섬세하고 아름다운 감성을 가진 사람이에요. 신금은 날카로운 감각과 고급스러운 미적 기준을 타고나서, 사소한 것에서도 특별함을 발견하죠.',
    strengths:
      '예리한 직관과 심미안이 뛰어나서 남들이 보지 못하는 가치를 알아보는 눈이 있어요. 표현력이 풍부하고 언어를 다루는 솜씨가 감각적이라, 글이나 말로 사람의 마음을 움직이는 힘이 있죠.',
    cautions:
      '예민한 감성이 장점이지만, 때로는 상처를 쉽게 받는 원인이 되기도 해요. 보석이 단단해지려면 연마의 과정이 필요하듯, 마음의 근육을 기르는 시간도 중요하답니다.',
    archetype: '예리한 감성의 보석',
    innerWorld: '겉으로는 쿨하고 도도해 보이지만, 내면에는 깊은 감정의 바다가 출렁이고 있는 낭만주의자예요.',
    socialStyle: '취향과 기준이 뚜렷해서, 마음이 통하는 소수의 사람들과 깊고 진한 교류를 나누는 것을 선호해요.',
  },
  IM: {
    personality:
      '도도하게 흐르는 큰 강처럼, 방향이 정해지면 어떤 장애물도 돌아서 나아가는 지혜로운 사람이에요. 임수에게는 세상의 모든 길이 연결되어 있는 것처럼 보이죠.',
    strengths:
      '포용력이 넓고 지적 호기심이 무한대에 가까워요. 큰 그림을 보는 전략적 사고와 다양한 분야를 아우르는 통섭 능력이야말로 임수의 최고 무기랍니다.',
    cautions:
      '물은 깊으면 깊을수록 바닥을 보이지 않듯, 속마음을 너무 감추면 주변에서 "알 수 없는 사람"이라는 인상을 줄 수 있어요. 가끔은 속내를 솔직하게 드러내는 것도 소통의 지름길이에요.',
    archetype: '도도한 지혜의 대하(大河)',
    innerWorld: '끊임없이 사유하는 철학자 기질이 있어서, 혼자 있는 시간에 가장 창의적인 아이디어가 떠오르는 편이에요.',
    socialStyle: '스케일이 큰 프로젝트에 본능적으로 끌리며, 함께하는 사람들에게 영감과 방향성을 제시하는 리더 기질이 있어요.',
  },
  GYE: {
    personality:
      '안개 낀 새벽의 이슬처럼, 조용하지만 빈틈없이 세상을 적시는 사람이에요. 계수는 눈에 보이지 않는 곳에서 세계를 움직이는 잔잔한 물의 지혜를 간직하고 있죠.',
    strengths:
      '직관력과 학습능력이 놀라울 만큼 빠르고, 복잡한 상황을 명쾌하게 꿰뚫는 통찰력이 있어요. 조용한 관찰 속에서 핵심을 짚어내는 능력이야말로 계수의 빛나는 무기이죠.',
    cautions:
      '너무 많은 것을 머릿속에서 처리하다 보면 우유부단해 보일 때가 있어요. 이슬도 모이면 개울이 되듯, 작은 결정부터 과감하게 실행에 옮기는 습관이 큰 힘이 될 거예요.',
    archetype: '고요한 직관의 이슬',
    innerWorld: '겉으로 표현하는 것의 몇 배에 달하는 깊은 사색을 늘 안고 있어서, 가까이 갈수록 지적 깊이에 놀라게 되는 사람이에요.',
    socialStyle: '잔잔하지만 깊은 공감능력으로, 대화 후에 "이 사람과 더 이야기하고 싶다"는 여운을 남기는 타입이에요.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  템플릿 풀: 섹션 도입부 — "일간이란 무엇인가"
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '사주에서 "일간"은 당신 그 자체를 의미해요. 이름이나 직함이 아닌, 당신의 내면에 깊이 새겨진 DNA 같은 존재이죠.',
  '"나"라는 존재의 가장 원초적인 코드. 사주명리학에서는 그것을 일간이라 부릅니다. 태어난 날의 천간, 바로 그 한 글자가 당신의 모든 이야기의 시작점이에요.',
  '사주의 여덟 글자 중 단 하나만 고를 수 있다면, 명리학자들은 주저 없이 일간을 선택할 거예요. 그만큼 일간은 나 자신을 대변하는 핵심 코드랍니다.',
  '생년월일시의 네 기둥 중, 태어난 "날"의 천간이 바로 당신의 정체성을 규정하는 글자예요. 이것을 일간(日干)이라 하죠.',
  '만약 사주팔자를 한 편의 영화에 비유한다면, 일간은 주인공이에요. 나머지 일곱 글자는 무대이자 조연이며 시나리오이지만, 중심에는 언제나 일간이 서 있답니다.',
  '일간이란 태어난 날의 하늘 기운, 즉 천간을 말해요. 사주 분석에서 모든 관계와 운의 흐름은 이 일간을 기준으로 펼쳐지거든요.',
  '세상 모든 사주 해석의 출발점은 일간이에요. 지도에서 "현재 위치"에 해당하는 것처럼, 일간이 있어야 비로소 사주의 전체 그림이 보이기 시작하죠.',
  '일간은 당신이라는 존재의 원형(原型)이에요. 마치 나침반의 바늘처럼 모든 방향을 측정하는 기준점이 되는 것, 그것이 일간의 역할이랍니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  템플릿 풀: 일간 천간 소개
// ─────────────────────────────────────────────────────────────────────────────

const STEM_INTRO_TEMPLATES: readonly string[] = [
  '{{이름}}님의 일간은 {{일간한글}}({{일간한자}})이에요. {{오행이름}}의 기운 중에서도 {{음양한글}} 에너지를 머금고 있는, 깊이 있는 성격의 소유자이죠.',
  '{{이름}}님은 {{일간한글}}({{일간한자}}) 일간, 즉 {{음양한글}} {{오행이름}}의 기운을 타고난 분이에요. {{자연비유}} -- 바로 당신의 본질이랍니다.',
  '태어난 날 하늘에 새겨진 글자, {{일간한글}}({{일간한자}}). {{이름}}님의 근원적 에너지는 {{음양한글}} {{오행이름}}이에요.',
  '{{이름}}님의 사주 속 주인공, 일간 {{일간한글}}({{일간한자}})은 {{오행이름}} 오행에 속하면서 {{음양한글}}의 기질을 가지고 있어요.',
  '{{일간한글}}({{일간한자}}) -- 이 한 글자가 바로 {{이름}}님이에요. {{음양한글}} {{오행이름}}, {{자연비유}}의 에너지가 당신 안에 흐르고 있죠.',
  '{{이름}}님의 핵심 코드, {{일간한글}}({{일간한자}}). 오행으로는 {{오행이름}}, 음양으로는 {{음양한글}}에 해당해요. 이 조합이 만들어내는 이야기를 함께 살펴볼까요?',
  '{{이름}}님을 한 글자로 표현한다면? 바로 {{일간한글}}({{일간한자}})이에요. {{음양한글}}의 기운을 품은 {{오행이름}} 오행이 당신의 근원적 에너지 서명이랍니다.',
  '사주의 무대 한가운데, {{이름}}님의 일간 {{일간한글}}({{일간한자}})이 서 있어요. {{오행이름}}의 기운 중에서도 {{음양한글}} 계열에 해당하는 독특한 에너지이죠.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  템플릿 풀: 성격 프로필 도입
// ─────────────────────────────────────────────────────────────────────────────

const PERSONALITY_INTRO_TEMPLATES: readonly string[] = [
  '{{일간한글}} 일간이 가진 고유한 캐릭터를 자세히 들여다볼까요?',
  '그렇다면 {{일간한글}}({{일간한자}}) 일간만의 캐릭터는 어떤 모습일까요?',
  '{{일간한글}} 일간의 내면 지도를 펼쳐 볼게요.',
  '이제 {{일간한글}} 일간이 품고 있는 성격의 결을 하나하나 살펴보겠습니다.',
  '{{일간한글}}({{일간한자}}) 일간의 프로필을 들여다보면, 흥미로운 발견들이 가득해요.',
  '{{일간한글}} 일간의 캐릭터 프로필, 지금부터 깊이 있게 풀어 드릴게요.',
  '{{일간한글}}의 세계를 탐험해 볼 시간이에요. 이 천간이 그려내는 인물상이 무척 매력적이거든요.',
  '자, {{일간한글}}({{일간한자}}) 일간의 이야기를 시작합니다. 놀라운 발견이 기다리고 있을 거예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  템플릿 풀: 오행 역할 매핑표 설명
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_TABLE_INTRO_TEMPLATES: readonly string[] = [
  '일간을 중심으로 오행 사이의 관계가 다섯 가지 역할로 나뉘어요. 아래 표는 {{이름}}님의 일간 {{일간한글}}을 기준으로 각 오행이 어떤 역할을 하는지 보여준답니다.',
  '모든 사주 해석은 일간과 다른 오행의 관계에서 출발해요. {{이름}}님의 일간 {{일간한글}}을 기준으로 보면, 목/화/토/금/수가 각각 다른 역할을 맡게 되죠.',
  '사주에서 오행은 단순한 원소가 아니라, 일간을 중심으로 한 "관계의 이름"이에요. {{이름}}님의 {{일간한글}} 일간 기준 오행별 역할을 정리했어요.',
  '일간이 정해지면 나머지 오행은 저마다의 역할을 부여받아요. 비겁, 식상, 재성, 관성, 인성 -- 이 다섯 카테고리가 {{이름}}님의 사주를 읽는 열쇠이죠.',
  '오행이 일간과 맺는 관계에 따라 비겁(동료), 식상(표현), 재성(재물), 관성(규율), 인성(학문) 다섯 가지로 분류돼요. {{이름}}님의 매핑표를 확인해 보세요.',
  '{{이름}}님의 일간 {{일간한글}}을 중심에 놓으면, 다섯 가지 오행이 각각 의미 있는 역할을 담당하게 됩니다. 그 관계도를 아래 표에 담았어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  템플릿 풀: 12운성 언급
// ─────────────────────────────────────────────────────────────────────────────

const LIFE_STAGE_TEMPLATES: readonly string[] = [
  '{{이름}}님의 일지(태어난 날의 지지) 12운성은 "{{운성이름}}({{운성한자}})"이에요. {{운성설명}} 이 에너지가 일간의 기본 체력을 결정하는 바탕이 되죠.',
  '일간이 앉아 있는 자리, 일지의 12운성은 "{{운성이름}}"이에요. {{운성의미}}의 시기를 뜻하며, {{운성설명}}',
  '{{이름}}님의 일주에서 일간 아래 깔린 12운성은 "{{운성이름}}({{운성한자}})"이랍니다. 이는 {{운성의미}}을 상징하는데, {{운성설명}}',
  '12운성으로 보면 {{이름}}님의 일간은 "{{운성이름}}" 단계에 위치해 있어요. {{운성설명}} 이것이 당신의 타고난 에너지 레벨을 결정하는 기초 체력이에요.',
  '일간의 에너지 상태를 알려주는 12운성에서, {{이름}}님은 "{{운성이름}}({{운성한자}})" 단계에요. {{운성의미}} -- {{운성설명}}',
  '{{이름}}님의 일지 12운성은 "{{운성이름}}"이에요. 에너지 지수로 보면 12점 만점에 {{에너지}}점에 해당하죠. {{운성설명}}',
  '"{{운성이름}}({{운성한자}})" -- {{이름}}님의 일간이 자리한 에너지 스테이지예요. 이 단계는 {{운성의미}}을 의미하며, {{운성설명}}',
  '사주에서 일간의 기본 컨디션을 보여주는 12운성. {{이름}}님의 일지 12운성은 "{{운성이름}}"으로, {{운성설명}}',
];

// ─────────────────────────────────────────────────────────────────────────────
//  템플릿 풀: 마무리
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_TEMPLATES: readonly string[] = [
  '지금까지 살펴본 일간의 프로필이 {{이름}}님 자신을 이해하는 첫 번째 열쇠가 되길 바라요. 이 기본 성향 위에 오행의 분포, 십성의 배치, 운의 흐름이 더해지면 훨씬 입체적인 그림이 완성된답니다.',
  '일간은 시작일 뿐이에요. 이 뿌리 위에 어떤 가지가 뻗고 어떤 꽃이 피는지는 앞으로 이어지는 분석에서 하나씩 밝혀질 거예요.',
  '{{이름}}님의 일간을 알았으니, 이제 사주라는 퍼즐의 첫 번째 조각이 맞춰진 셈이에요. 나머지 조각들을 하나씩 채워가는 여정이 기대되지 않나요?',
  '모든 사주 해석의 출발점, 일간. 이 한 글자에서 시작해 {{이름}}님만의 인생 내비게이션이 펼쳐집니다. 다음 섹션에서 더 깊은 이야기를 이어갈게요.',
  '일간을 안다는 것은 자기 자신의 운전대를 잡는 것과 같아요. {{이름}}님의 {{일간한글}} 일간이 앞으로의 모든 분석에서 나침반이 되어줄 거예요.',
  '여기까지가 {{이름}}님의 일간 프로필이었어요. 일간이라는 렌즈를 통해 사주의 다른 요소들을 바라보면, 전혀 다른 풍경이 보이기 시작할 거예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  유틸리티
// ─────────────────────────────────────────────────────────────────────────────

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function elShort(code: string | undefined): string {
  if (!code) return '?';
  return ELEMENT_KOREAN_SHORT[code as ElementCode] ?? code;
}

function elFull(code: string | undefined): string {
  if (!code) return '?';
  return ELEMENT_KOREAN[code as ElementCode] ?? code;
}

const STEM_CODE_SET: ReadonlySet<StemCode> = new Set<StemCode>([
  'GAP',
  'EUL',
  'BYEONG',
  'JEONG',
  'MU',
  'GI',
  'GYEONG',
  'SIN',
  'IM',
  'GYE',
]);

function isStemCode(code: string): code is StemCode {
  return STEM_CODE_SET.has(code as StemCode);
}

function summarizeStemTraits(items: readonly string[], limit: number): string {
  return items
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .slice(0, limit)
    .join(', ');
}

function buildStemEncyclopediaParagraph(
  dmHangul: string,
  dmHanja: string,
  entry: StemEncyclopediaEntry | null,
): string | null {
  if (!entry) return null;

  const keywords = summarizeStemTraits(entry.coreKeywords, 4);
  const strengths = summarizeStemTraits(entry.strengths, 2);
  const cautions = summarizeStemTraits(entry.cautions, 2);
  const habits = summarizeStemTraits(entry.recommendedHabits, 2);

  if (!keywords && !strengths && !cautions && !habits) return null;

  return joinSentences(
    `${dmHangul}(${dmHanja}) 천간 백과 요약입니다.`,
    keywords ? `핵심 키워드: ${keywords}.` : null,
    strengths ? `강점 포인트: ${strengths}.` : null,
    cautions ? `주의 포인트: ${cautions}.` : null,
    habits ? `추천 습관: ${habits}.` : null,
  );
}

/**
 * SajuSummary에서 dayMasterRoleByElement를 안전하게 추출합니다.
 * saju 객체가 AnalysisBundle 기반일 경우 rules.facts 경로를 탐색합니다.
 */
function extractDayMasterRoles(input: ReportInput): Record<string, string> | null {
  const saju = input.saju as Record<string, unknown>;

  // 1순위: saju에 직접 dayMasterRoleByElement가 있는 경우
  const direct = saju['dayMasterRoleByElement'] as Record<string, string> | undefined;
  if (direct) return direct;

  // 2순위: rules.facts.dayMasterRoleByElement 경로
  const rules = saju['rules'] as Record<string, unknown> | undefined;
  const facts = (rules?.['facts'] ?? saju['facts']) as Record<string, unknown> | undefined;
  const rolesFromFacts = facts?.['dayMasterRoleByElement'] as Record<string, string> | undefined;
  if (rolesFromFacts) return rolesFromFacts;

  return null;
}

/**
 * SajuSummary에서 일지 12운성을 안전하게 추출합니다.
 */
function extractDayLifeStage(input: ReportInput): LifeStageInfo | null {
  const saju = input.saju as Record<string, unknown>;
  const lifeStages = saju['lifeStages'] as Record<string, string> | undefined;
  const dayStageCode = lifeStages?.['day'];
  if (dayStageCode) {
    return LIFE_STAGE_BY_CODE[dayStageCode] ?? null;
  }
  return null;
}

/**
 * 일간의 오행 기준으로 오행-역할 매핑 테이블 행을 생성합니다.
 * dayMasterRoleByElement가 있으면 그 데이터를 사용하고,
 * 없으면 오행 상생/상극 규칙으로 추론합니다.
 */
function buildRoleRows(
  dayElement: ElementCode,
  roles: Record<string, string> | null,
): string[][] {
  const ELEMENTS: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

  const inferRole = (el: ElementCode): DayMasterRole => {
    if (el === dayElement) return 'COMPANION';
    if (el === ELEMENT_GENERATED_BY[dayElement]) return 'RESOURCE';
    if (el === ELEMENT_GENERATES[dayElement]) return 'OUTPUT';
    if (el === ELEMENT_CONTROLS[dayElement]) return 'WEALTH';
    if (el === ELEMENT_CONTROLLED_BY[dayElement]) return 'OFFICER';
    return 'COMPANION';
  };

  return ELEMENTS.map(el => {
    const roleCode = (roles?.[el] ?? inferRole(el)) as DayMasterRole;
    const roleLabel = ROLE_KOREAN[roleCode] ?? roleCode;
    const roleDesc = ROLE_DESC[roleCode] ?? '';
    return [elFull(el), roleLabel, roleDesc];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateDayMasterSection(input: ReportInput): ReportSection {
  const rng = createRng(input);
  for (let i = 0; i < 8; i++) rng.next(); // 고유 오프셋 8

  const name = safeName(input);
  const { pillars, dayMaster } = input.saju;

  // 일간 StemInfo 해석
  const dmStem = lookupStemInfo(dayMaster.stem) ?? lookupStemInfo(pillars.day.stem.hangul);
  const dmElement = (dmStem?.element ?? dayMaster.element ?? 'WOOD') as ElementCode;
  const dmYinYang = dmStem?.yinYang ?? dayMaster.polarity ?? 'YANG';
  const dmHangul = dmStem?.hangul ?? pillars.day.stem.hangul ?? '?';
  const dmHanja = dmStem?.hanja ?? pillars.day.stem.hanja ?? '?';
  const dmCode = dmStem?.code ?? dayMaster.stem ?? 'GAP';
  const encyclopediaEntry = isStemCode(dmCode) ? getStemEncyclopediaEntry(dmCode) : null;

  // 오행 역할 매핑
  const roles = extractDayMasterRoles(input);

  // 12운성
  const dayLifeStage = extractDayLifeStage(input);

  // 프로필
  const profile = STEM_PROFILES[dmCode] ?? STEM_PROFILES['GAP'];
  const stemEncyclopediaParagraph = buildStemEncyclopediaParagraph(
    dmHangul,
    dmHanja,
    encyclopediaEntry,
  );

  // 공통 템플릿 변수
  const vars: Record<string, string | number> = {
    이름: name,
    일간한글: dmHangul,
    일간한자: dmHanja,
    오행이름: elFull(dmElement),
    오행짧은: elShort(dmElement),
    음양한글: yinYangToKorean(dmYinYang),
    자연비유: ELEMENT_NATURE[dmElement] ?? '',
    계절: ELEMENT_SEASON[dmElement] ?? '',
    색상: ELEMENT_COLOR[dmElement] ?? '',
    감정긍정: ELEMENT_EMOTION[dmElement]?.positive ?? '',
    감정부정: ELEMENT_EMOTION[dmElement]?.negative ?? '',
  };

  // ── 단락 구성 ──
  const paragraphs: ReportParagraph[] = [];

  // 1) 도입: 일간이란?
  paragraphs.push(narrative(rng.pick(INTRO_TEMPLATES), dmElement));

  // 2) 일간 소개 (천간·오행·음양)
  paragraphs.push(emphasis(
    pickAndFill(rng, STEM_INTRO_TEMPLATES, vars),
    dmElement,
  ));

  // 3) 성격 프로필 도입
  paragraphs.push(narrative(
    pickAndFill(rng, PERSONALITY_INTRO_TEMPLATES, vars),
    dmElement,
  ));

  // 4) 본질·성격
  paragraphs.push(positive(profile.personality, dmElement));

  // 5) 아키타입
  paragraphs.push(emphasis(
    `${dmHangul}(${dmHanja}) 일간의 아키타입: "${profile.archetype}".`,
    dmElement,
  ));

  // 6) 내면 세계
  paragraphs.push(narrative(profile.innerWorld, dmElement));

  // 7) 강점
  paragraphs.push(positive(profile.strengths, dmElement));

  // 8) 사회적 스타일
  paragraphs.push(narrative(profile.socialStyle, dmElement));

  // 9) 주의사항
  paragraphs.push({ type: 'warning', text: profile.cautions, element: dmElement, tone: 'negative' });
  if (stemEncyclopediaParagraph) {
    paragraphs.push(tip(stemEncyclopediaParagraph, dmElement));
  }

  // 10) 오행-역할 매핑표 설명
  paragraphs.push(narrative(
    pickAndFill(rng, ROLE_TABLE_INTRO_TEMPLATES, vars),
    dmElement,
  ));

  // 11) 12운성 언급
  if (dayLifeStage) {
    const lsVars: Record<string, string | number> = {
      ...vars,
      운성이름: dayLifeStage.korean,
      운성한자: dayLifeStage.hanja,
      운성의미: dayLifeStage.meaning,
      운성설명: dayLifeStage.shortDesc,
      에너지: dayLifeStage.energy,
    };
    paragraphs.push(narrative(
      pickAndFill(rng, LIFE_STAGE_TEMPLATES, lsVars),
      dmElement,
    ));
  }

  // 12) 마무리
  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, vars),
    dmElement,
  ));

  // ── 테이블: 오행 → 역할 매핑표 ──
  const roleRows = buildRoleRows(dmElement, roles);
  const tables: ReportTable[] = [
    {
      title: `${dmHangul}(${dmHanja}) 일간 기준 오행별 역할 매핑`,
      headers: ['오행', '역할 (십성 카테고리)', '의미'],
      rows: roleRows,
    },
  ];

  // ── 하이라이트 ──
  const highlights: ReportHighlight[] = [
    {
      label: '일간',
      value: `${dmHangul}(${dmHanja})`,
      element: dmElement,
      sentiment: 'neutral',
    },
    {
      label: '오행',
      value: elFull(dmElement),
      element: dmElement,
      sentiment: 'neutral',
    },
    {
      label: '음양',
      value: yinYangToKorean(dmYinYang),
      element: dmElement,
      sentiment: 'neutral',
    },
    {
      label: '아키타입',
      value: profile.archetype,
      element: dmElement,
      sentiment: 'good',
    },
  ];

  if (dayLifeStage) {
    highlights.push({
      label: '일지 12운성',
      value: `${dayLifeStage.korean}(${dayLifeStage.hanja}) — 에너지 ${dayLifeStage.energy}/12`,
      element: dmElement,
      sentiment: dayLifeStage.energy >= 9 ? 'good' : dayLifeStage.energy >= 5 ? 'neutral' : 'caution',
    });
  }

  return {
    id: 'dayMaster',
    title: '일간(나) 기본 정보',
    subtitle: '당신이라는 존재의 원형을 읽다',
    paragraphs,
    tables,
    highlights,
  };
}
