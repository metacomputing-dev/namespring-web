/**
 * part7-monthlyFortune.ts -- 월운(月運) 분석 섹션
 *
 * PART 7-4: 이달의 월운 간지, 월운 십성, 12개월 간지 캘린더,
 *           월별 용신 부합도를 산출하고 친근한 해석을 제공합니다.
 *
 * 페르소나: "다정한 달력 요정"
 *   - 매달의 에너지를 계절/자연 변화에 비유
 *   - 월별 운세를 꽃/식물 성장에 비유
 *   - 초등학생~중학생도 이해할 수 있는 친근한 말투
 *
 * 월 천간 공식: monthStemIdx = ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10
 * 월 지지: 寅(1월) -> 卯(2월) -> ... -> 丑(12월)
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ElementCode,
  YongshinMatchGrade,
} from '../types.js';

import {
  STEMS,
  BRANCHES,
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_COLOR,
  ELEMENT_SEASON,
  ELEMENT_FOOD,
  ELEMENT_NATURE,
  ELEMENT_GENERATED_BY,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_CONTROLLED_BY,
  getElementRelation,
  getYongshinMatchGrade,
  YONGSHIN_GRADE_STARS,
  YONGSHIN_GRADE_DESC,
  lookupStemInfo,
  type StemInfo,
  type BranchInfo,
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
  type SeededRandom,
} from '../common/sentenceUtils.js';

// =============================================================================
//  상수 & 헬퍼
// =============================================================================

function safeName(input: ReportInput): string {
  return input.name?.trim() || '친구';
}

function elFull(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

function elShort(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

function elHanja(c: string | null | undefined): string {
  return c ? (ELEMENT_HANJA[c as ElementCode] ?? c) : '?';
}

function elColor(c: string | null | undefined): string {
  return c ? (ELEMENT_COLOR[c as ElementCode] ?? c) : '';
}

// =============================================================================
//  월 천간·지지 산출
// =============================================================================

/**
 * 월 지지: 인월(寅, 1월) 부터 축월(丑, 12월)까지.
 * BRANCHES 배열에서 인(寅)의 index=2 이므로, monthIdx 1 -> branchIndex 2, 2 -> 3, ..., 12 -> 1
 */
const MONTH_BRANCH_INDICES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
// monthIdx 0-based: 0=1월(인), 1=2월(묘), ... 11=12월(축)

/**
 * 월 천간 산출:
 *   monthStemIdx = ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10
 *
 * yearStemIdx: 해당 연도 연간(年干)의 천간 인덱스 (0=갑, 1=을, ...)
 * monthIdx: 0-based (0=1월(인월), 1=2월(묘월), ...)
 */
function getMonthStemIndex(yearStemIdx: number, monthIdx: number): number {
  return ((yearStemIdx % 5) * 2 + 2 + monthIdx) % 10;
}

/** 월 지지 인덱스 (0-based month -> BRANCHES index) */
function getMonthBranchIndex(monthIdx: number): number {
  return MONTH_BRANCH_INDICES[monthIdx % 12];
}

interface MonthPillar {
  readonly monthIdx: number;  // 0-based (0=1월)
  readonly stem: StemInfo;
  readonly branch: BranchInfo;
  readonly ganzi: string;     // "갑인" 형태
  readonly stemElement: ElementCode;
  readonly branchElement: ElementCode;
}

function computeMonthPillar(yearStemIdx: number, monthIdx: number): MonthPillar {
  const stemIdx = getMonthStemIndex(yearStemIdx, monthIdx);
  const branchIdx = getMonthBranchIndex(monthIdx);
  const stem = STEMS[stemIdx];
  const branch = BRANCHES[branchIdx];
  return {
    monthIdx,
    stem,
    branch,
    ganzi: `${stem.hangul}${branch.hangul}`,
    stemElement: stem.element,
    branchElement: branch.element,
  };
}

/** 현재 날짜에서 절기 기준 월 인덱스를 반환 (0-based, 0=1월(인월)) */
function getCurrentMonthIdx(today: Date): number {
  // 절기 기준 대략적 매핑 (실제 절기는 매년 조금씩 다르지만, 대부분 아래 날짜 전후)
  // 입춘(2/4) 경칩(3/6) 청명(4/5) 입하(5/6) 망종(6/6) 소서(7/7)
  // 입추(8/7) 백로(9/8) 한로(10/8) 입동(11/7) 대설(12/7) 소한(1/6)
  const solarMonth = today.getMonth() + 1; // 1~12
  const day = today.getDate();

  // 절기 기준 절입일 (대략치, 일반적으로 +-1일 편차)
  const JEOLIP_DAYS = [6, 4, 6, 5, 6, 6, 7, 7, 8, 8, 7, 7];
  //                  1월 2월 3월 4월 5월 6월 7월 8월 9월 10월 11월 12월

  // 절입일 이전이면 이전 달의 지지에 해당
  const jeolipDay = JEOLIP_DAYS[solarMonth - 1];
  let effectiveMonth: number;

  if (day >= jeolipDay) {
    effectiveMonth = solarMonth;
  } else {
    effectiveMonth = solarMonth - 1;
    if (effectiveMonth <= 0) effectiveMonth = 12;
  }

  // solarMonth -> monthIdx (0-based, 인월 기준) 매핑
  // 양력 2월 절입후 = 1월(인월) = idx 0
  // 양력 3월 절입후 = 2월(묘월) = idx 1
  // ...
  // 양력 1월 절입후 = 12월(축월) = idx 11
  const mapping: Record<number, number> = {
    2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5,
    8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 1: 11,
  };

  return mapping[effectiveMonth] ?? 0;
}

/** 현재 연도의 연간 천간 인덱스 구하기 */
function getYearStemIndex(year: number): number {
  // (연도 - 4) % 10 -> 갑(0) 을(1) 병(2) ... 계(9)
  return ((year - 4) % 10 + 10) % 10;
}

// =============================================================================
//  십성 산출
// =============================================================================

/**
 * 일간 오행 & 음양 vs 대상 오행 & 음양 -> 십성 코드
 *
 * 십성 판정 규칙:
 *   같은 오행 + 같은 음양 = 비견
 *   같은 오행 + 다른 음양 = 겁재
 *   내가 생하는 오행 + 같은 음양 = 식신
 *   내가 생하는 오행 + 다른 음양 = 상관
 *   내가 극하는 오행 + 같은 음양 = 편재
 *   내가 극하는 오행 + 다른 음양 = 정재
 *   나를 극하는 오행 + 같은 음양 = 편관
 *   나를 극하는 오행 + 다른 음양 = 정관
 *   나를 생하는 오행 + 같은 음양 = 편인
 *   나를 생하는 오행 + 다른 음양 = 정인
 */
function computeTenGod(
  dayElement: ElementCode,
  dayYinYang: 'YANG' | 'YIN',
  targetElement: ElementCode,
  targetYinYang: 'YANG' | 'YIN',
): { code: string; korean: string } {
  const samePolarity = dayYinYang === targetYinYang;
  const relation = getElementRelation(dayElement, targetElement);

  switch (relation) {
    case 'same':
      return samePolarity
        ? { code: 'BI_GYEON', korean: '비견' }
        : { code: 'GEOB_JAE', korean: '겁재' };
    case 'generates':
      return samePolarity
        ? { code: 'SIK_SHIN', korean: '식신' }
        : { code: 'SANG_GWAN', korean: '상관' };
    case 'controls':
      return samePolarity
        ? { code: 'PYEON_JAE', korean: '편재' }
        : { code: 'JEONG_JAE', korean: '정재' };
    case 'controlled_by':
      return samePolarity
        ? { code: 'PYEON_GWAN', korean: '편관' }
        : { code: 'JEONG_GWAN', korean: '정관' };
    case 'generated_by':
      return samePolarity
        ? { code: 'PYEON_IN', korean: '편인' }
        : { code: 'JEONG_IN', korean: '정인' };
    default:
      return { code: 'BI_GYEON', korean: '비견' };
  }
}

// =============================================================================
//  용신 체계 추출 헬퍼
// =============================================================================

function deriveHansin(
  yongEl: ElementCode | null,
  heeEl: ElementCode | null,
  giEl: ElementCode | null,
  guEl: ElementCode | null,
): ElementCode | null {
  const allElements: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
  const assigned = new Set<ElementCode | null>([yongEl, heeEl, giEl, guEl]);
  const remaining = allElements.filter(e => !assigned.has(e));
  return remaining.length === 1 ? remaining[0] : null;
}

// =============================================================================
//  절기 이름 & 월별 자연 이미지 매핑
// =============================================================================

/** 절기 기준 월 이름 (음력 기준 표현) */
const MONTH_NAMES = [
  '1월 (인월, 寅月)',   // 입춘~경칩
  '2월 (묘월, 卯月)',   // 경칩~청명
  '3월 (진월, 辰月)',   // 청명~입하
  '4월 (사월, 巳月)',   // 입하~망종
  '5월 (오월, 午月)',   // 망종~소서
  '6월 (미월, 未月)',   // 소서~입추
  '7월 (신월, 申月)',   // 입추~백로
  '8월 (유월, 酉月)',   // 백로~한로
  '9월 (술월, 戌月)',   // 한로~입동
  '10월 (해월, 亥月)',  // 입동~대설
  '11월 (자월, 子月)',  // 대설~소한
  '12월 (축월, 丑月)',  // 소한~입춘
];

/** 절입 절기 이름 */
const JEOLGI_NAMES = [
  '입춘(立春)', '경칩(驚蟄)', '청명(淸明)', '입하(立夏)',
  '망종(芒種)', '소서(小暑)', '입추(立秋)', '백로(白露)',
  '한로(寒露)', '입동(立冬)', '대설(大雪)', '소한(小寒)',
];

/** 양력 월 매핑 (각 절기가 시작되는 양력 월 근사치) */
const SOLAR_MONTH_APPROX = [
  '양력 2월 초', '양력 3월 초', '양력 4월 초', '양력 5월 초',
  '양력 6월 초', '양력 7월 초', '양력 8월 초', '양력 9월 초',
  '양력 10월 초', '양력 11월 초', '양력 12월 초', '양력 1월 초',
];

/** 계절 분류 */
const MONTH_SEASON: string[] = [
  '초봄', '봄', '늦봄', '초여름', '한여름', '늦여름',
  '초가을', '가을', '늦가을', '초겨울', '한겨울', '늦겨울',
];

/** 월별 자연 이미지: 꽃/식물 성장 비유 */
const MONTH_NATURE_IMAGE: string[] = [
  '얼어붙은 땅을 뚫고 새싹이 머리를 내미는 시기예요. 봄의 첫 소식이 전해지는 달이랍니다.',
  '매화꽃이 활짝 피고, 개구리가 잠에서 깨어나는 시기예요. 대지가 부드러워지기 시작해요.',
  '벚꽃이 만개하고, 온 세상이 분홍빛으로 물드는 시기예요. 나비들도 날아다니기 시작해요.',
  '장미가 피어나고, 나무들이 초록 잎을 풍성하게 키우는 시기예요. 에너지가 활발해져요.',
  '해바라기가 태양을 향해 고개를 드는 시기예요. 모든 식물이 최고의 성장을 보여요.',
  '열매가 맺히기 시작하고, 과일이 달콤하게 익어가는 시기예요. 노력의 결실이 보이기 시작해요.',
  '벼이삭이 고개를 숙이고, 첫 가을바람이 살랑이는 시기예요. 수확의 기운이 감돌아요.',
  '코스모스가 흔들리고, 단풍이 물들기 시작하는 시기예요. 아름다운 변화의 달이에요.',
  '낙엽이 떨어지고, 나무들이 겨울 준비를 하는 시기예요. 내면을 돌아보기 좋은 달이에요.',
  '첫 서리가 내리고, 식물들이 뿌리에 영양을 저장하는 시기예요. 내실을 다지는 달이에요.',
  '눈이 세상을 하얗게 덮고, 씨앗이 땅속에서 봄을 기다리는 시기예요. 고요한 힘을 기르는 달이에요.',
  '가장 추운 시기이지만, 땅속에서는 이미 봄의 씨앗이 싹틀 준비를 하고 있어요. 희망의 달이에요.',
];

// =============================================================================
//  오행별 꽃/식물 비유 (월운 해석용)
// =============================================================================

const ELEMENT_FLOWER_IMAGE: Record<ElementCode, string[]> = {
  WOOD: [
    '새싹이 힘차게 돋아나는 것 같은 성장의 에너지가 가득해요.',
    '대나무가 쑥쑥 자라듯, 위로 뻗어나가는 힘이 느껴지는 달이에요.',
    '푸른 잎이 바람에 흔들리듯 상쾌한 시작의 기운이 돌아요.',
    '씨앗이 껍질을 깨고 나오듯 새로운 가능성이 열리는 달이에요.',
    '봄 숲처럼 생명력 넘치는 에너지가 온 몸에 퍼지는 느낌이에요.',
  ],
  FIRE: [
    '해바라기가 태양을 향해 활짝 피듯, 밝고 뜨거운 열정의 달이에요.',
    '빨간 장미가 만개하는 것처럼, 마음속 열정이 활활 타오르는 시기예요.',
    '불꽃놀이처럼 화려하게 빛나는 순간이 가득한 달이에요.',
    '한여름 태양처럼 에너지가 최고조에 달하는 시기랍니다.',
    '모닥불처럼 따뜻하고 밝은 기운이 주위를 환하게 비춰요.',
  ],
  EARTH: [
    '풍성한 밭에 열매가 맺히듯, 안정적이고 든든한 에너지가 감돌아요.',
    '고구마가 땅속에서 포근하게 자라듯, 마음이 따뜻해지는 달이에요.',
    '넓은 초원처럼 마음이 편안하고 여유로운 시기랍니다.',
    '정원에 꽃이 다양하게 피듯, 여러 가지 일이 균형 있게 자라나는 달이에요.',
    '비옥한 흙처럼 든든하고 믿음직한 에너지가 받쳐주는 달이에요.',
  ],
  METAL: [
    '국화가 서리 속에서도 꿋꿋이 피듯, 단단하고 의지가 강해지는 달이에요.',
    '가을 단풍처럼 아름답게 정리되는 시기예요. 불필요한 것을 털어낼 용기가 생겨요.',
    '맑은 가을 하늘처럼 마음이 깨끗해지고 판단력이 날카로워지는 달이에요.',
    '이슬이 풀잎에 맺히듯, 맑고 순수한 에너지가 감도는 시기랍니다.',
    '잘 갈아진 보석처럼 빛나는 결단력과 정확한 판단의 에너지가 있어요.',
  ],
  WATER: [
    '겨울 눈 아래에서 씨앗이 조용히 꿈을 꾸듯, 깊은 지혜가 자라나는 달이에요.',
    '산속 맑은 시냇물처럼 지혜가 졸졸 흐르는 시기랍니다.',
    '연꽃이 물 위에 피듯, 고요한 가운데 아름다운 깨달음이 찾아올 수 있어요.',
    '비가 내려 대지를 촉촉하게 적시듯, 감성이 풍부해지는 달이에요.',
    '깊은 호수처럼 고요하지만 그 속에 무한한 가능성을 품고 있는 달이에요.',
  ],
};

// =============================================================================
//  십성별 꽃/식물 해석 비유
// =============================================================================

const TEN_GOD_FLOWER_DESCRIPTIONS: Record<string, string[]> = {
  비견: [
    '마치 같은 종류의 꽃이 나란히 피어 있는 것 같아요. 비슷한 생각을 가진 친구나 동료와 함께하면 더 큰 힘이 될 수 있어요.',
    '한 뿌리에서 두 줄기가 자라나는 것처럼, 나와 비슷한 에너지가 더 많이 생겨나요. 자기 자신감이 높아지는 시기예요.',
    '쌍둥이 꽃처럼 나를 닮은 에너지가 함께하니, 자신감 있게 내 길을 갈 수 있는 달이에요.',
  ],
  겁재: [
    '서로 다른 색깔의 꽃이 같은 화분에서 자라는 것 같아요. 경쟁도 있지만 함께 아름다워지는 시기예요.',
    '덩굴식물이 옆의 나무를 타고 올라가듯, 주변 사람들과의 관계에서 에너지를 주고받는 달이에요. 나눔이 중요해요.',
    '한 정원에 여러 꽃이 자리를 다투듯, 경쟁 속에서 성장하는 에너지가 있어요. 욕심은 조금 내려놓으면 좋겠어요.',
  ],
  식신: [
    '꽃이 열매를 맺기 시작하는 것 같아요. 내가 가진 재능이 자연스럽게 표현되는 달이에요!',
    '화분에서 작은 열매가 주렁주렁 열리는 것처럼, 배운 것을 나눌 수 있는 시기예요. 맛있는 간식처럼 즐거운 일이 생겨요.',
    '씨앗을 뿌린 꽃밭에서 예쁜 꽃이 피어나듯, 그동안의 노력이 보기 좋은 결과로 나타나는 달이에요.',
  ],
  상관: [
    '야생화처럼 자유분방하게 피어나는 창의력의 시기예요. 남들과 다른 나만의 개성이 빛나요!',
    '울타리 밖으로 뻗어 나가는 넝쿨처럼, 틀에 박히지 않은 새로운 아이디어가 떠오르는 달이에요.',
    '기존의 화분을 벗어나 새로운 곳에 뿌리내리는 식물처럼, 기존 방식에서 벗어나는 용기가 생기는 시기예요.',
  ],
  편재: [
    '열매가 갑자기 풍성하게 열리듯, 뜻밖의 행운이 찾아올 수 있는 달이에요.',
    '바람에 날려온 씨앗이 예상치 못한 곳에서 꽃을 피우듯, 새로운 기회가 불쑥 찾아오는 시기예요.',
    '보물찾기를 하듯 뜻밖의 곳에서 좋은 일이 생길 수 있어요. 활동적으로 움직여 보세요!',
  ],
  정재: [
    '씨앗을 정성껏 심고 물을 주어 키운 꽃처럼, 꾸준한 노력의 대가를 받는 달이에요.',
    '잘 가꾼 텃밭에서 수확하는 것처럼, 성실하게 준비한 일이 결실을 맺는 시기예요.',
    '매일 물을 주고 가꾼 화분에서 예쁜 꽃이 피듯, 정성이 보상으로 돌아오는 달이에요.',
  ],
  편관: [
    '강풍에 흔들리는 나무처럼, 바깥에서 오는 압박이 느껴질 수 있어요. 하지만 바람을 견딘 나무는 더 단단해져요!',
    '거센 비바람에도 뿌리를 단단히 내린 나무처럼, 힘든 상황을 버텨내면 훨씬 강해지는 달이에요.',
    '겨울 추위에 떨고 있지만 봄이 올 것을 아는 씨앗처럼, 잠시 인내하면 좋은 일이 찾아올 거예요.',
  ],
  정관: [
    '정원사가 가지치기를 해주는 것처럼, 규칙과 질서 안에서 더 예쁘게 자라날 수 있는 달이에요.',
    '반듯하게 정돈된 꽃밭처럼, 체계적으로 계획을 세워 실행하면 좋은 결과가 나오는 시기예요.',
    '튼튼한 지지대에 기대어 자라는 장미처럼, 규칙을 지키면 더 높이 올라갈 수 있는 달이에요.',
  ],
  편인: [
    '낯선 토양에서 새로운 영양분을 흡수하는 식물처럼, 새로운 분야의 공부나 취미에 관심이 생기는 달이에요.',
    '신기한 비료를 만난 것처럼 사고방식이 크게 바뀔 수 있는 시기예요. 새로운 것에 도전해 보세요!',
    '접붙이기를 한 나무처럼, 전혀 다른 분야의 지식이 합쳐져 멋진 아이디어가 나올 수 있어요.',
  ],
  정인: [
    '엄마 나무 아래에서 자라는 어린 나무처럼, 든든한 보호와 도움을 받을 수 있는 달이에요.',
    '햇빛과 물을 충분히 받는 묘목처럼, 배우고 성장하기에 최적의 시기예요. 공부 의욕이 샘솟아요!',
    '비옥한 토양에 뿌리내린 새싹처럼, 좋은 가르침과 도움을 받아 쑥쑥 자라나는 달이에요.',
  ],
};

// =============================================================================
//  도입부 템플릿 — 달력 요정 페르소나
// =============================================================================

const INTRO_TEMPLATES: readonly string[] = [
  '안녕! 달력 요정이 찾아왔어요! 매달매달 어떤 에너지가 찾아오는지, 마치 사계절 꽃이 피고 지는 것처럼 이야기해 줄게요. {{이름}}님의 12개월 운세 꽃밭을 함께 구경해 볼까요?',
  '{{이름}}님, 만나서 반가워요! 나는 달력 요정이에요. 매달 하늘에서 내려오는 기운이 달라지는 거 알고 있었나요? 꽃이 계절마다 다르게 피는 것처럼, 매달의 운세도 달라진답니다!',
  '{{이름}}님을 위한 월별 운세 꽃밭을 가꿔 봤어요! 어떤 달에는 화려한 장미가 피고, 어떤 달에는 씩씩한 해바라기가 피고, 또 어떤 달에는 조용한 눈꽃이 내린답니다. 함께 살펴볼까요?',
  '안녕하세요, {{이름}}님! 달력 요정이에요. 1년 12개월, 매달 피어나는 운세의 꽃이 모두 다르답니다. 어떤 달이 가장 화사한 꽃밭인지, 어떤 달에 뿌리를 튼튼히 해야 하는지 알려줄게요!',
  '오늘은 {{이름}}님의 월별 운세를 꽃밭에 비유해서 설명해 드릴게요! 봄의 벚꽃부터 겨울의 매화까지, 매달 피어나는 운세의 꽃이 궁금하지 않나요? 달력 요정이 안내해 줄게요!',
  '매달의 하늘에는 서로 다른 에너지가 흐르고 있어요. 마치 정원사가 계절마다 다른 꽃을 심는 것처럼요! {{이름}}님의 12개월 운세 정원에는 어떤 꽃이 피어 있을까요? 같이 봐요!',
];

// =============================================================================
//  이달 상세 분석 도입 템플릿
// =============================================================================

const THIS_MONTH_INTRO_TEMPLATES: readonly string[] = [
  '자, 그러면 먼저 지금 이 달의 이야기부터 해 볼까요? {{이름}}님이 지금 바로 체감하고 있을 이 달의 에너지예요!',
  '가장 궁금한 건 바로 이번 달이겠죠? {{이름}}님에게 지금 흐르고 있는 달의 기운을 자세히 알려줄게요!',
  '먼저 지금 이 순간! 이번 달의 에너지부터 꼼꼼히 살펴볼게요. {{이름}}님이 요즘 느끼는 기분과 비교해 보세요!',
  '달력 요정은 언제나 "지금"이 가장 중요하다고 생각해요. 그래서 이번 달의 운세를 먼저 아주 자세하게 풀어볼게요!',
  '이번 달! 바로 지금 {{이름}}님에게 어떤 꽃이 피어 있는지 궁금하죠? 자세히 들여다볼게요!',
];

// =============================================================================
//  월별 용신 부합도별 해석 템플릿
// =============================================================================

const GRADE_FLOWER_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '이 달은 마치 5월의 장미 정원처럼 화사해요! {{이름}}님에게 딱 맞는 최고의 에너지가 흘러들어오는 때이니, 하고 싶은 일에 마음껏 도전해 보세요!',
    '꽃밭에서 가장 크고 예쁜 꽃이 활짝 핀 것 같은 달이에요! 용신의 에너지가 가득하니, 무슨 일이든 기분 좋게 풀릴 수 있어요.',
    '비옥한 토양에 따뜻한 햇살, 넉넉한 빗물까지 삼박자가 딱 맞는 달이에요! 성장의 조건이 완벽하게 갖춰진 황금의 시기랍니다.',
    '정원 전체에 꽃이 만발한 것 같아요! 용신 에너지가 최고조이니, 새로운 시작이나 중요한 결정을 내리기에 아주 좋은 달이에요.',
    '가장 좋아하는 꽃이 한가득 핀 비밀 정원에 들어간 느낌이에요! 이 달의 기운을 놓치지 말고 적극적으로 활용해 보세요!',
  ],
  4: [
    '예쁜 꽃들이 봉오리를 활짝 열기 시작하는 것 같은 달이에요. 좋은 에너지가 돌고 있으니, 계획했던 일을 슬슬 시작하면 좋겠어요!',
    '따뜻한 봄볕에 새싹이 기지개를 켜는 느낌이에요. 좋은 기운이 흐르니, 작은 노력이 큰 결실로 돌아올 수 있는 달이랍니다.',
    '꽃밭에 이슬이 맺혀 반짝반짝 빛나는 아침 같은 달이에요. 활기차고 희망적인 에너지가 {{이름}}님을 감싸고 있어요.',
    '화분의 꽃이 예쁘게 피어나기 시작하는 시기예요. 희신의 기운이 용신을 도와주니 기분 좋은 일이 많을 거예요.',
  ],
  3: [
    '잔잔한 들판에 야생화가 소박하게 피어 있는 것 같은 달이에요. 특별히 좋거나 나쁘지는 않지만, 꾸준히 물주면 예쁜 꽃이 될 거예요.',
    '평온한 초원에서 산책하는 기분이에요. 화려하지는 않지만 마음이 편안한 달이랍니다. 조용히 내 할 일에 집중하면 좋아요.',
    '평범한 듯 보이지만, 빗물을 머금은 토양처럼 보이지 않는 곳에서 힘이 자라고 있어요. 차분하게 기다리면 좋은 결과가 올 거예요.',
    '화분의 흙이 촉촉한 상태예요. 눈에 확 띄는 변화는 없지만, 뿌리가 조용히 깊어지고 있는 중요한 시기랍니다.',
  ],
  2: [
    '잎이 살짝 시들어 보이는 날이 있을 수 있어요. 하지만 걱정 마세요! 물을 충분히 주면(건강 관리를 잘 하면) 금방 다시 싱싱해질 수 있어요.',
    '찬바람이 불어서 꽃봉오리가 움츠러드는 느낌이에요. 무리하기보다는 따뜻한 실내에서 에너지를 아끼는 것이 좋은 달이에요.',
    '서리가 내려 꽃잎이 살짝 얼어붙을 수 있는 시기예요. 큰 모험보다는 내 화분을 잘 돌보는 데 집중하면 좋겠어요.',
    '흙이 조금 마른 것 같아요. 물을 자주 주고(충분히 쉬고) 영양제를 넣어주면(좋은 음식을 먹으면) 다시 건강해질 거예요.',
  ],
  1: [
    '한겨울의 꽃밭처럼 겉으로는 조용한 시기예요. 하지만 기억하세요! 겨울이 지나야 봄이 오는 법이에요. 이 시기에는 뿌리를 튼튼히 하는 데 집중하세요.',
    '태풍이 지나가는 날에는 화분을 안으로 들여놓는 게 좋듯이, 이 달에는 무리한 도전보다 안전하게 쉬어가는 것이 현명해요.',
    '눈이 내려 꽃이 보이지 않지만, 눈 밑에서 씨앗은 봄을 준비하고 있어요. 힘든 시기도 반드시 지나간답니다. 건강이 제일 중요해요!',
    '폭풍우 속에서도 뿌리 깊은 나무는 쓰러지지 않아요. 기신의 에너지가 강한 달이니, 내면을 단단히 하고 건강을 챙기세요.',
  ],
};

// =============================================================================
//  월별 조언 템플릿
// =============================================================================

const GRADE_ADVICE_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '이 달에는 새로운 일을 시작하거나, 중요한 시험을 보거나, 친구에게 먼저 말을 걸어보세요. 모든 게 잘 풀릴 확률이 높아요!',
    '이 달의 행운 꽃을 활짝 피우려면: 적극적으로 행동하세요! 움츠러들기보다 한 발 앞으로 나가는 것이 좋아요.',
    '용신의 바람이 크게 부는 달이에요! 씨앗을 뿌리면 빠르게 자라나니, 망설이지 말고 계획을 실행에 옮겨 보세요.',
    '달력 요정의 팁: 이 달에는 용기를 내보세요! 평소 도전하기 어려웠던 일을 시작하기에 딱 좋은 때예요.',
    '최고의 에너지가 흐르는 달! 이때 뿌린 씨앗은 가장 크고 아름다운 꽃으로 자라날 거예요. 기회를 잡으세요!',
  ],
  4: [
    '좋은 기운이 흐르는 달이니, 공부나 운동, 취미 활동에 조금 더 힘을 써보세요. 노력한 만큼 좋은 결과가 따라올 거예요!',
    '이 달에는 새 친구를 사귀거나, 새로운 취미를 시작하기에 좋아요. 밝은 에너지가 좋은 인연을 불러올 수 있어요.',
    '달력 요정의 팁: 작은 목표를 세우고 하나씩 이루어 보세요. 성공의 기쁨이 자신감을 더 키워줄 거예요!',
    '꽃에 물을 주듯 꾸준히 노력하면, 이 달의 좋은 기운이 예쁜 꽃을 피워줄 거예요. 화이팅!',
  ],
  3: [
    '특별히 서두를 필요는 없어요. 평소처럼 꾸준히 하던 일을 해나가면 좋은 달이에요. 조급해하지 말고 차분히!',
    '이 달에는 복습과 정리가 좋아요. 새로운 것을 시작하기보다 지금까지 해온 일을 점검하고 다듬어보세요.',
    '달력 요정의 팁: 급한 변화보다는 내 페이스를 유지하는 것이 좋아요. 규칙적인 생활이 최고의 비밀무기예요.',
    '조용한 달이지만 걱정하지 마세요. 물을 꾸준히 주면 화분의 흙이 촉촉하게 유지되듯, 꾸준함이 답이에요.',
  ],
  2: [
    '이 달에는 무리한 계획보다 충분한 휴식이 중요해요. 잠을 잘 자고, 맛있는 밥을 먹고, 가족과 시간을 보내세요.',
    '이 달에는 큰 결정을 잠시 미뤄두는 것도 좋아요. 서두르다 실수할 수 있으니, 한 발 물러서서 생각하는 시간을 가져보세요.',
    '달력 요정의 팁: 용신 오행의 색깔 물건을 가까이 두거나, 용신 오행에 좋은 음식을 먹으면 에너지를 보충할 수 있어요!',
    '살짝 힘든 달이지만, 이런 때일수록 자기 자신을 잘 돌봐주세요. 푹 쉬는 것도 실력이에요!',
  ],
  1: [
    '이 달에는 건강 관리가 제일 중요해요! 무리하지 말고, 따뜻한 차를 마시며 마음을 편히 하세요. 이것도 금방 지나가요.',
    '가만히 있는 것도 용기예요. 폭풍우가 지나갈 때까지 화분을 안으로 들여놓고 쉬세요. 다음 달에는 더 좋아질 거예요!',
    '달력 요정의 팁: 기신의 에너지를 상쇄하려면, 용신 오행에 해당하는 활동이나 음식으로 균형을 맞춰보세요.',
    '겨울이 아무리 길어도 반드시 봄은 오는 법이에요. 지금은 뿌리를 튼튼히 하는 시간이라고 생각해주세요.',
  ],
};

// =============================================================================
//  마무리 템플릿
// =============================================================================

const CLOSING_TEMPLATES: readonly string[] = [
  '12개월의 운세 꽃밭 구경이 즐거우셨나요? 매달 피어나는 꽃은 다르지만, 어떤 꽃이든 정성을 다해 가꾸면 아름다워진답니다. {{이름}}님의 1년이 풍성한 정원처럼 되길 바라요!',
  '달력 요정의 이야기는 여기까지예요! 용신의 바람이 강한 달에는 씨앗을 심고, 기신의 서리가 내리는 달에는 뿌리를 돌보고, 그렇게 계절을 타며 성장하는 {{이름}}님을 응원할게요!',
  '1년 12개월, 매달 다른 꽃이 피는 정원처럼 {{이름}}님의 삶도 다양한 색깔로 물들어 있어요. 좋은 달은 즐기고, 힘든 달은 쉬어가면서 멋진 1년을 만들어 가세요!',
  '달력 요정이 알려주는 비밀 하나! 사실 가장 중요한 건 어떤 달의 운세가 아니라, {{이름}}님이 매일 얼마나 웃는가 하는 거예요. 어떤 달이든 활짝 웃으면 좋은 기운이 찾아온답니다!',
  '12개월의 정원을 한 바퀴 둘러보았어요. 기억하세요: 봄에 피는 꽃이 있고, 겨울에 피는 꽃이 있듯이, 좋지 않은 달이라고 해서 나쁜 것만은 아니에요. 모든 계절에는 제 의미가 있답니다.',
  '달력 요정의 마지막 인사! 씨앗이 꽃이 되려면 물도 필요하고 햇볕도 필요하듯이, 좋은 달과 힘든 달을 모두 경험해야 더 강하고 아름다운 사람이 된답니다. {{이름}}님 파이팅!',
];

// =============================================================================
//  오행별 보충 조언 (용신 기반)
// =============================================================================

const YONGSHIN_SUPPLEMENT_TEMPLATES: Record<ElementCode, readonly string[]> = {
  WOOD: [
    '이 달에 목(木) 에너지를 보충하려면, 초록색 옷을 입거나 산책을 하면 좋아요. 나무가 크는 것처럼 기운이 자라나요!',
    '신선한 채소를 많이 먹고, 동쪽으로 향하면 목(木)의 기운이 가까이 와요. 숲 향기 나는 디퓨저도 좋아요!',
    '봄나물처럼 싱그러운 목(木) 에너지를 가까이 하세요. 식물 키우기, 그림 그리기, 독서 같은 활동이 도움이 돼요.',
  ],
  FIRE: [
    '이 달에 화(火) 에너지를 보충하려면, 빨간색이나 주황색 소품을 활용해 보세요. 햇볕도 충분히 쬐면 좋아요!',
    '따뜻한 차를 마시거나, 요리를 해보거나, 활기찬 음악을 들으면 화(火)의 에너지가 높아져요. 남쪽이 길방이에요!',
    '화(火) 에너지가 필요한 달이에요. 밝은 색 옷을 입고, 활동적인 운동을 하면 기운이 살아나요!',
  ],
  EARTH: [
    '이 달에 토(土) 에너지를 보충하려면, 노란색이나 베이지 톤의 옷을 입어보세요. 따뜻한 밥을 꼭꼭 씹어 먹는 것도 좋아요!',
    '텃밭 가꾸기, 도예, 흙 만지기 같은 활동이 토(土) 에너지를 높여줘요. 고구마나 감자처럼 뿌리채소도 좋아요!',
    '안정의 기운이 필요해요. 규칙적인 생활 습관과 든든한 식사가 토(土) 에너지의 핵심이에요!',
  ],
  METAL: [
    '이 달에 금(金) 에너지를 보충하려면, 흰색이나 금색, 은색 소품을 가까이 하세요. 서쪽 방향이 좋아요!',
    '악기 연주, 서예, 정리정돈 같은 활동이 금(金) 에너지를 높여줘요. 매운맛 음식도 도움이 돼요!',
    '맑고 깨끗한 금(金) 에너지가 필요해요. 방 정리를 하고 불필요한 것을 정리하면 기운이 맑아져요!',
  ],
  WATER: [
    '이 달에 수(水) 에너지를 보충하려면, 검정색이나 남색 계열 옷을 입어보세요. 물을 충분히 마시는 것도 중요해요!',
    '독서, 명상, 수영 같은 활동이 수(水) 에너지를 높여줘요. 바다나 강 근처를 산책하는 것도 좋아요!',
    '깊고 고요한 수(水) 에너지가 필요해요. 조용한 곳에서 사색하거나, 일기를 쓰거나, 음악을 감상해 보세요.',
  ],
};

// =============================================================================
//  오행 관계별 월운 해석
// =============================================================================

const ELEMENT_RELATION_MONTHLY: Record<string, readonly string[]> = {
  same: [
    '이 달의 에너지가 {{이름}}님의 일간과 같은 오행이에요! 마치 같은 종류의 꽃이 옆에 더 피어난 것 같아서, 자기 자신의 힘이 커지는 느낌이에요.',
    '나와 같은 에너지가 찾아온 달이에요. 마치 쌍둥이 꽃처럼, 자신감과 독립심이 높아질 수 있어요.',
  ],
  generates: [
    '일간이 이 달의 에너지를 생(生)해주고 있어요. 내 에너지를 나누어주는 셈이니, 표현력과 창의력이 살아나는 달이에요! 다만 너무 많이 쏟으면 지칠 수 있으니 체력 관리도 함께!',
    '내가 만들어내는 에너지의 달이에요. 꽃이 열매를 맺듯, 재능을 발휘하고 자기 표현을 하기에 좋은 시기예요.',
  ],
  generated_by: [
    '이 달의 에너지가 {{이름}}님을 생(生)해줘요! 엄마 나무가 영양분을 공급해주는 것처럼, 배우고 성장하는 데 아주 좋은 달이에요.',
    '나를 키워주는 에너지가 흐르는 달이에요. 비가 식물에게 물을 주듯, 좋은 가르침이나 도움을 받을 수 있어요.',
  ],
  controls: [
    '일간이 이 달의 에너지를 극(克)하고 있어요. 내가 이길 수 있는 에너지이니, 재물이나 성과를 얻을 기회가 있어요!',
    '내가 다스리는 에너지의 달이에요. 정원사가 잡초를 뽑듯, 환경을 내 뜻대로 조성할 수 있는 시기예요.',
  ],
  controlled_by: [
    '이 달의 에너지가 {{이름}}님을 극(克)하고 있어요. 서리가 꽃을 시들게 하듯 외부 압박이 있을 수 있지만, 이겨내면 더 단단해져요!',
    '나를 누르는 에너지가 흐르는 달이에요. 바람에 흔들리는 나무처럼 느껴질 수 있지만, 뿌리만 단단하면 괜찮아요.',
  ],
};

// =============================================================================
//  메인 생성 함수
// =============================================================================

export function generateMonthlyFortuneSection(input: ReportInput): ReportSection | null {
  // 일간(Day Master) 정보 추출
  const dayMasterStem = input.saju?.dayMaster?.stem;
  if (!dayMasterStem) return null;

  const dayMasterInfo = lookupStemInfo(dayMasterStem);
  if (!dayMasterInfo) return null;

  const dayElement = dayMasterInfo.element;
  const dayYinYang = dayMasterInfo.yinYang;

  // RNG 초기화 (오프셋 38)
  const rng = createRng(input);
  for (let i = 0; i < 38; i++) rng.next();

  const name = safeName(input);

  // 용신 체계 추출
  const yongEl = (input.saju.yongshin?.element ?? null) as ElementCode | null;
  const heeEl = (input.saju.yongshin?.heeshin
    ?? (yongEl ? ELEMENT_GENERATED_BY[yongEl] : null)) as ElementCode | null;
  const giEl = (input.saju.yongshin?.gishin ?? null) as ElementCode | null;
  const guEl = (input.saju.yongshin as unknown as Record<string, unknown> | undefined)?.['gushin'] as ElementCode | null ?? null;
  const hanEl = deriveHansin(yongEl, heeEl, giEl, guEl);

  // 오늘 날짜 기반 정보
  const today = input.today ?? new Date();
  const currentYear = today.getFullYear();
  const yearStemIdx = getYearStemIndex(currentYear);
  const currentMonthIdx = getCurrentMonthIdx(today);
  const currentPillar = computeMonthPillar(yearStemIdx, currentMonthIdx);

  // 12개월 간지 계산
  const allMonths: MonthPillar[] = [];
  for (let m = 0; m < 12; m++) {
    allMonths.push(computeMonthPillar(yearStemIdx, m));
  }

  const paragraphs: ReportParagraph[] = [];

  // =========================================================================
  //  SECTION 1: 도입부
  // =========================================================================

  paragraphs.push(positive(
    pickAndFill(rng, INTRO_TEMPLATES, { 이름: name }),
  ));

  // 월운 개념 설명
  const monthlyConceptVariants: readonly string[] = [
    '월운(月運)이란, 매달매달 하늘에서 내려오는 에너지의 흐름을 말해요. 마치 계절이 바뀌면 피는 꽃이 달라지는 것처럼, 매월의 기운도 달라진답니다. 한 해를 12칸으로 나누면, 각 칸마다 서로 다른 천간(하늘의 기운)과 지지(땅의 기운)가 들어가요.',
    '1년에는 12개의 달이 있고, 각 달마다 고유한 간지(干支)가 정해져 있어요. 이것을 월운(月運)이라고 해요. 봄에는 목(木)의 기운이, 여름에는 화(火)의 기운이, 가을에는 금(金)의 기운이, 겨울에는 수(水)의 기운이 강해지는 것이 자연의 이치예요.',
    '월운(月運)은 매달의 에너지 성적표 같은 거예요! 각 달에는 천간(하늘 글자)과 지지(땅 글자)가 하나씩 배정되어 있는데, 이 글자와 {{이름}}님의 사주가 어떻게 만나느냐에 따라 그 달의 분위기가 달라진답니다.',
    '정원에 사계절이 있듯이, 사주에도 매달매달 찾아오는 에너지의 파도가 있어요. 이걸 월운(月運)이라고 부르는데, 절기를 기준으로 달이 바뀐답니다. 양력 날짜와 조금 다르니 헷갈리지 마세요!',
  ];
  paragraphs.push(narrative(rng.pick(monthlyConceptVariants)));

  // 절기 설명
  const jeolgiExplanation: readonly string[] = [
    '참, 여기서 중요한 점 하나! 월운은 양력 1일에 바뀌는 게 아니라, 절기(節氣)를 기준으로 바뀌어요. 예를 들어 1월(인월)은 입춘(양력 2월 4일경)부터 시작하고, 2월(묘월)은 경칩(양력 3월 6일경)부터 시작해요. 자연의 계절 변화에 맞추는 거랍니다!',
    '잠깐! 알아두면 좋은 상식이 있어요. 사주의 달은 양력 날짜로 바뀌는 게 아니라, 절기를 기준으로 바뀌어요. 입춘, 경칩, 청명... 이런 절기일에 새 달이 시작되는 거예요. 자연의 리듬에 따르는 달력인 셈이에요.',
    '사주에서 말하는 "1월"은 양력 1월이 아니에요! 입춘(대략 양력 2월 4일) 이후부터가 사주의 1월이에요. 이것은 자연의 진짜 봄이 시작되는 때를 기준으로 한 거랍니다. 절기 기준이라 매년 날짜가 하루 정도 차이가 날 수 있어요.',
  ];
  paragraphs.push(tip(rng.pick(jeolgiExplanation)));

  // 월 천간 공식 설명
  const formulaExplanation: readonly string[] = [
    '매달의 천간은 그 해 연간(年干)에 따라 정해져요. 마치 나무의 기둥(연간)에서 가지(월간)가 뻗어나오는 것처럼요! 지지(땅 글자)는 1월부터 인(寅)-묘(卯)-진(辰)-사(巳)-오(午)-미(未)-신(申)-유(酉)-술(戌)-해(亥)-자(子)-축(丑) 순서로 고정돼 있어요.',
    '월 천간을 구하는 비밀 공식이 있어요! 연간이 갑(甲)이나 기(己)이면 1월 천간이 병(丙)에서 시작하고, 을(乙)이나 경(庚)이면 무(戊)에서, 병(丙)이나 신(辛)이면 경(庚)에서, 정(丁)이나 임(壬)이면 임(壬)에서, 무(戊)나 계(癸)이면 갑(甲)에서 시작해요.',
    '매달의 하늘 글자(천간)는 연간에 따라 자동으로 결정되고, 땅 글자(지지)는 항상 인월(寅月)부터 축월(丑月)까지 순서대로예요. 마치 정원의 1번 화분부터 12번 화분까지 이름표가 붙어 있는 것과 같아요!',
  ];
  paragraphs.push(narrative(rng.pick(formulaExplanation)));

  // 일간 설명
  const dayMasterIntro: readonly string[] = [
    `${name}님의 일간은 ${dayMasterInfo.hangul}(${dayMasterInfo.hanja})이에요. ${elFull(dayElement)}의 기운을 가지고 있고, ${dayYinYang === 'YANG' ? '양(陽)' : '음(陰)'}의 성질이에요. 이 일간을 기준으로 매달의 에너지가 나에게 어떤 영향을 주는지 십성(十神)을 통해 알 수 있어요!`,
    `${name}님의 사주 중심, 즉 일간은 ${dayMasterInfo.hangul}(${dayMasterInfo.hanja})이에요. ${ELEMENT_NATURE[dayElement]}이 바로 ${name}님의 본래 모습이에요. 매달의 간지가 이 일간과 어떻게 만나느냐에 따라 그 달의 분위기가 결정된답니다!`,
    `정원의 중심에는 ${name}님을 상징하는 ${elFull(dayElement)} 나무가 서 있어요. 일간 ${dayMasterInfo.hangul}(${dayMasterInfo.hanja}), ${dayYinYang === 'YANG' ? '양(陽)' : '음(陰)'}의 성질을 가진 나무예요. 매달 어떤 바람이 불고, 어떤 비가 내리느냐에 따라 이 나무가 어떻게 자라는지 살펴볼게요!`,
  ];
  paragraphs.push(emphasis(rng.pick(dayMasterIntro)));

  // 용신 설명
  if (yongEl) {
    const yongIntros: readonly string[] = [
      `그리고 ${name}님에게 가장 필요한 에너지, 즉 용신은 ${elFull(yongEl)}이에요! 매달의 에너지가 이 ${elShort(yongEl)}의 기운에 가까울수록 꽃밭이 더 화사해지고, 멀어질수록 조용해진다고 이해하면 쉬워요.`,
      `${name}님의 정원에 가장 필요한 영양분은 ${elFull(yongEl)}이에요! 이 에너지가 많은 달은 꽃이 활짝 피고, 부족한 달은 좀 더 정성을 들여 가꿔야 하는 거랍니다.`,
      `용신 ${elFull(yongEl)}은(는) ${name}님의 정원을 가장 아름답게 만들어주는 마법의 비료 같은 거예요. 매달의 에너지가 이 비료와 얼마나 잘 맞느냐를 별점으로 표시해 놓았으니 참고하세요!`,
    ];
    paragraphs.push(tip(rng.pick(yongIntros), yongEl));
  }

  // =========================================================================
  //  SECTION 2: 이번 달 상세 분석
  // =========================================================================

  paragraphs.push(emphasis(
    pickAndFill(rng, THIS_MONTH_INTRO_TEMPLATES, { 이름: name }),
  ));

  // 이번 달 기본 정보
  const thisMonthName = MONTH_NAMES[currentMonthIdx];
  const thisGanzi = currentPillar.ganzi;
  const thisStemEl = currentPillar.stemElement;
  const thisBranchEl = currentPillar.branchElement;
  const thisJeolgi = JEOLGI_NAMES[currentMonthIdx];
  const thisSeason = MONTH_SEASON[currentMonthIdx];
  const thisSolarApprox = SOLAR_MONTH_APPROX[currentMonthIdx];

  paragraphs.push(narrative(
    `이번 달은 ${thisMonthName}이에요. 절기로는 ${thisJeolgi}부터 시작하는 달이고, ${thisSolarApprox}에 해당해요. 계절로 따지면 ${thisSeason}의 기운이 흐르고 있어요.`,
  ));

  paragraphs.push(narrative(
    `이번 달의 간지는 ${thisGanzi}(${currentPillar.stem.hanja}${currentPillar.branch.hanja})이에요. ` +
    `천간은 ${currentPillar.stem.hangul}(${currentPillar.stem.hanja}) — ${elFull(thisStemEl)}, ` +
    `지지는 ${currentPillar.branch.hangul}(${currentPillar.branch.hanja}) — ${elFull(thisBranchEl)}이에요.`,
  ));

  // 자연 이미지
  paragraphs.push(narrative(MONTH_NATURE_IMAGE[currentMonthIdx]));

  // 이번 달 십성 분석
  const thisStemTenGod = computeTenGod(dayElement, dayYinYang, thisStemEl, currentPillar.stem.yinYang);
  const thisBranchTenGod = computeTenGod(dayElement, dayYinYang, thisBranchEl, currentPillar.branch.yinYang);

  paragraphs.push(narrative(
    `${name}님의 일간 ${dayMasterInfo.hangul}(${elShort(dayElement)}) 기준으로, ` +
    `이번 달 천간 ${currentPillar.stem.hangul}은(는) "${thisStemTenGod.korean}"에 해당하고, ` +
    `지지 ${currentPillar.branch.hangul}은(는) "${thisBranchTenGod.korean}"에 해당해요.`,
  ));

  // 천간 십성 꽃 비유 해석
  const stemTenGodDescriptions = TEN_GOD_FLOWER_DESCRIPTIONS[thisStemTenGod.korean];
  if (stemTenGodDescriptions && stemTenGodDescriptions.length > 0) {
    paragraphs.push(narrative(
      `천간의 ${thisStemTenGod.korean} 에너지: ${rng.pick(stemTenGodDescriptions)}`,
    ));
  }

  // 지지 십성 꽃 비유 해석
  const branchTenGodDescriptions = TEN_GOD_FLOWER_DESCRIPTIONS[thisBranchTenGod.korean];
  if (branchTenGodDescriptions && branchTenGodDescriptions.length > 0) {
    paragraphs.push(narrative(
      `지지의 ${thisBranchTenGod.korean} 에너지: ${rng.pick(branchTenGodDescriptions)}`,
    ));
  }

  // 오행 관계 분석
  const stemRelation = getElementRelation(dayElement, thisStemEl);
  const relationTemplates = ELEMENT_RELATION_MONTHLY[stemRelation];
  if (relationTemplates && relationTemplates.length > 0) {
    paragraphs.push(narrative(
      fillTemplate(rng.pick(relationTemplates), { 이름: name }),
    ));
  }

  // 용신 부합도
  const thisGrade = yongEl
    ? getYongshinMatchGrade(thisStemEl, yongEl, heeEl, hanEl, guEl, giEl)
    : (3 as YongshinMatchGrade);
  const thisStars = YONGSHIN_GRADE_STARS[thisGrade];
  const thisGradeDesc = YONGSHIN_GRADE_DESC[thisGrade];

  paragraphs.push(emphasis(
    `이번 달의 용신 부합도: ${thisStars} (${thisGradeDesc})`,
  ));

  // 등급별 꽃 비유 해석
  const flowerTemplate = rng.pick(GRADE_FLOWER_TEMPLATES[thisGrade]);
  const flowerText = fillTemplate(flowerTemplate, { 이름: name });
  if (thisGrade >= 4) {
    paragraphs.push(positive(flowerText, thisStemEl));
  } else if (thisGrade <= 2) {
    paragraphs.push(caution(flowerText, thisStemEl));
  } else {
    paragraphs.push(narrative(flowerText, thisStemEl));
  }

  // 오행 꽃 이미지
  const flowerImages = ELEMENT_FLOWER_IMAGE[thisStemEl];
  if (flowerImages && flowerImages.length > 0) {
    paragraphs.push(narrative(
      `${elFull(thisStemEl)}의 에너지가 감도는 이 달: ${rng.pick(flowerImages)}`,
    ));
  }

  // 등급별 조언
  const advice = rng.pick(GRADE_ADVICE_TEMPLATES[thisGrade]);
  paragraphs.push(tip(advice));

  // 용신 보충 조언 (부합도 낮을 경우)
  if (thisGrade <= 3 && yongEl) {
    const supplements = YONGSHIN_SUPPLEMENT_TEMPLATES[yongEl];
    if (supplements && supplements.length > 0) {
      paragraphs.push(tip(rng.pick(supplements), yongEl));
    }
  }

  // 용신 오행 음식 추천
  if (yongEl) {
    const foods = ELEMENT_FOOD[yongEl];
    if (foods && foods.length > 0) {
      const selectedFoods = rng.sample(foods, 4);
      paragraphs.push(tip(
        `달력 요정의 이 달 추천 음식: ${selectedFoods.join(', ')} - ${elFull(yongEl)}의 기운을 보충해주는 음식들이에요!`,
        yongEl,
      ));
    }
  }

  // 이번 달 종합 한 줄 요약
  const thisMonthSummaryVariants: readonly string[] = [
    `정리하면, 이번 달은 ${thisSeason}의 기운 속에서 ${thisGanzi}(${elShort(thisStemEl)}/${elShort(thisBranchEl)})의 에너지가 흐르고, ${name}님에게 ${thisStemTenGod.korean}(천간)과 ${thisBranchTenGod.korean}(지지)의 기운을 가져다주는 달이에요. 용신 부합도 ${thisStars}!`,
    `이번 달 ${thisGanzi}에는 ${thisStemTenGod.korean}과 ${thisBranchTenGod.korean}의 에너지가 함께해요. ${thisGrade >= 4 ? '아주 좋은 달이니 자신 있게 행동하세요!' : thisGrade <= 2 ? '조심하되 너무 걱정하지는 마세요!' : '평온하게 내 할 일을 하면 되는 달이에요!'}`,
  ];
  paragraphs.push(emphasis(rng.pick(thisMonthSummaryVariants)));

  // =========================================================================
  //  SECTION 3: 12개월 간지 캘린더 설명
  // =========================================================================

  const calendarIntro: readonly string[] = [
    `자, 이제 ${currentYear}년 12개월의 전체 운세 꽃밭을 한눈에 살펴볼게요! 매달 어떤 간지가 배정되어 있고, 어떤 십성이 작용하는지, 그리고 용신에 얼마나 가까운지를 모두 정리해 놓았어요.`,
    `다음은 ${currentYear}년 12개월 운세 캘린더예요! 매달의 간지와 오행, 십성, 용신 부합도를 표로 정리했어요. ${name}님의 1년을 한 바퀴 미리 둘러보세요!`,
    `${currentYear}년 12개월의 운세 정원 지도를 그려볼게요! 어느 달에 가장 화사한 꽃이 피고, 어느 달에 겨울잠을 자야 하는지 미리 알면 훨씬 준비가 잘 된답니다.`,
  ];
  paragraphs.push(emphasis(rng.pick(calendarIntro)));

  // =========================================================================
  //  SECTION 4: 12개월 각월 상세 해석
  // =========================================================================

  let bestMonth = 0;
  let bestGrade = 0;
  let worstMonth = 0;
  let worstGrade = 6;

  const calendarRows: string[][] = [];
  const gradeData: Record<string, number | string> = {};

  for (let m = 0; m < 12; m++) {
    const mp = allMonths[m];
    const monthLabel = `${m + 1}월`;
    const mStemTenGod = computeTenGod(dayElement, dayYinYang, mp.stemElement, mp.stem.yinYang);
    const mBranchTenGod = computeTenGod(dayElement, dayYinYang, mp.branchElement, mp.branch.yinYang);
    const mGrade = yongEl
      ? getYongshinMatchGrade(mp.stemElement, yongEl, heeEl, hanEl, guEl, giEl)
      : (3 as YongshinMatchGrade);
    const mStars = YONGSHIN_GRADE_STARS[mGrade];

    // 최고/최악 월 추적
    if (mGrade > bestGrade) { bestGrade = mGrade; bestMonth = m; }
    if (mGrade < worstGrade) { worstGrade = mGrade; worstMonth = m; }

    // 테이블 행
    calendarRows.push([
      monthLabel,
      MONTH_NAMES[m],
      mp.ganzi,
      `${mp.stem.hanja}${mp.branch.hanja}`,
      `${elShort(mp.stemElement)}(${elHanja(mp.stemElement)})`,
      `${elShort(mp.branchElement)}(${elHanja(mp.branchElement)})`,
      mStemTenGod.korean,
      mBranchTenGod.korean,
      mStars,
      m === currentMonthIdx ? '*** 이번 달 ***' : '',
    ]);

    // 차트 데이터
    gradeData[`${monthLabel} ${mp.ganzi}`] = mGrade;

    // 각 월 해석 문단 (현재 달은 이미 상세 분석했으므로 요약만)
    if (m === currentMonthIdx) {
      paragraphs.push(emphasis(
        `[${monthLabel}] ${mp.ganzi}(${mp.stem.hanja}${mp.branch.hanja}) — ${thisSeason} — ${mStars} *** 이번 달이에요! (위에서 자세히 설명했어요) ***`,
      ));
      continue;
    }

    const season = MONTH_SEASON[m];
    const monthNatureImg = MONTH_NATURE_IMAGE[m];
    const flowerImg = rng.pick(ELEMENT_FLOWER_IMAGE[mp.stemElement]);
    const gradeFlower = rng.pick(GRADE_FLOWER_TEMPLATES[mGrade]);
    const gradeAdvice = rng.pick(GRADE_ADVICE_TEMPLATES[mGrade]);
    const stemTgDesc = TEN_GOD_FLOWER_DESCRIPTIONS[mStemTenGod.korean];
    const stemTgText = stemTgDesc && stemTgDesc.length > 0 ? rng.pick(stemTgDesc) : '';

    // 월별 해석 블록 구성
    const monthHeader = `[${monthLabel}] ${mp.ganzi}(${mp.stem.hanja}${mp.branch.hanja}) — ${season} — ${mStars}`;

    const monthBody = joinSentences(
      monthNatureImg,
      `${elFull(mp.stemElement)}의 에너지가 감도는 달이에요.`,
      flowerImg,
      `천간 ${mp.stem.hangul}은(는) ${mStemTenGod.korean}, 지지 ${mp.branch.hangul}은(는) ${mBranchTenGod.korean}이에요.`,
      stemTgText,
      fillTemplate(gradeFlower, { 이름: name }),
      gradeAdvice,
    );

    const paragraphTone = mGrade >= 4 ? 'positive' : mGrade <= 2 ? 'negative' : 'neutral';

    paragraphs.push({ type: 'narrative', text: monthHeader, element: mp.stemElement, tone: 'neutral' });

    if (paragraphTone === 'positive') {
      paragraphs.push(positive(monthBody, mp.stemElement));
    } else if (paragraphTone === 'negative') {
      paragraphs.push(caution(monthBody, mp.stemElement));
    } else {
      paragraphs.push(narrative(monthBody, mp.stemElement));
    }
  }

  // =========================================================================
  //  SECTION 5: 최고/최악 월 요약
  // =========================================================================

  const bestPillar = allMonths[bestMonth];
  const worstPillar = allMonths[worstMonth];

  const summaryVariants: readonly string[] = [
    `12개월 정원을 한 바퀴 돌아보았어요! ${name}님에게 가장 화사한 꽃밭은 ${bestMonth + 1}월(${bestPillar.ganzi}, ${elShort(bestPillar.stemElement)})이에요. 이 달에는 마음껏 뛰어놀아도 좋아요! 반면 ${worstMonth + 1}월(${worstPillar.ganzi}, ${elShort(worstPillar.stemElement)})은 조금 조용히 쉬어가면 좋을 달이에요.`,
    `전체적으로 보면, ${bestMonth + 1}월이 가장 빛나는 달이고 ${worstMonth + 1}월이 가장 조심해야 할 달이에요. 좋은 달에는 적극적으로, 힘든 달에는 건강을 챙기며 보내면 1년이 아름다운 정원이 될 거예요!`,
    `정원사의 눈으로 보면, ${bestMonth + 1}월(${bestPillar.ganzi})에는 과감하게 새 꽃을 심고, ${worstMonth + 1}월(${worstPillar.ganzi})에는 기존 화분을 잘 돌보는 게 좋겠어요. 이렇게 완급 조절을 하면 1년 내내 정원이 아름다워요!`,
  ];
  paragraphs.push(emphasis(rng.pick(summaryVariants)));

  // 각 용신 부합도별 해당 월 분류
  const gradeMonths: Record<number, number[]> = { 5: [], 4: [], 3: [], 2: [], 1: [] };
  for (let m = 0; m < 12; m++) {
    const mp = allMonths[m];
    const mGrade = yongEl
      ? getYongshinMatchGrade(mp.stemElement, yongEl, heeEl, hanEl, guEl, giEl)
      : 3;
    gradeMonths[mGrade]?.push(m + 1);
  }

  // 등급별 월 분류 설명
  const classificationIntro: readonly string[] = [
    '12개월을 꽃밭 상태별로 분류하면 이렇게 돼요:',
    '1년의 달을 정원 컨디션별로 나누어 보면:',
    '달력 요정이 12개월을 색깔별로 구분해 보았어요:',
  ];
  paragraphs.push(narrative(rng.pick(classificationIntro)));

  if (gradeMonths[5].length > 0) {
    paragraphs.push(positive(
      `만발 꽃밭 (${YONGSHIN_GRADE_STARS[5]}): ${gradeMonths[5].map(m => `${m}월`).join(', ')} ` +
      `— 가장 화사하게 꽃이 피는 달이에요! 이때 씨앗을 심으면 가장 잘 자라요.`,
    ));
  }
  if (gradeMonths[4].length > 0) {
    paragraphs.push(positive(
      `봄 꽃밭 (${YONGSHIN_GRADE_STARS[4]}): ${gradeMonths[4].map(m => `${m}월`).join(', ')} ` +
      `— 꽃봉오리가 예쁘게 열리는 좋은 달이에요.`,
    ));
  }
  if (gradeMonths[3].length > 0) {
    paragraphs.push(narrative(
      `평화로운 초원 (${YONGSHIN_GRADE_STARS[3]}): ${gradeMonths[3].map(m => `${m}월`).join(', ')} ` +
      `— 잔잔하고 평온한 달이에요. 꾸준히 물을 주면 돼요.`,
    ));
  }
  if (gradeMonths[2].length > 0) {
    paragraphs.push(caution(
      `서리 조심 (${YONGSHIN_GRADE_STARS[2]}): ${gradeMonths[2].map(m => `${m}월`).join(', ')} ` +
      `— 꽃이 살짝 움츠러들 수 있는 달이에요. 따뜻하게 감싸주세요.`,
    ));
  }
  if (gradeMonths[1].length > 0) {
    paragraphs.push(caution(
      `겨울 준비 (${YONGSHIN_GRADE_STARS[1]}): ${gradeMonths[1].map(m => `${m}월`).join(', ')} ` +
      `— 뿌리를 돌보는 데 집중하는 달이에요. 건강이 최우선!`,
    ));
  }

  // =========================================================================
  //  SECTION 6: 연간 에너지 흐름 서술
  // =========================================================================

  const yearFlowIntro: readonly string[] = [
    `${currentYear}년 전체의 에너지 흐름을 계절로 느껴볼게요:`,
    `${currentYear}년 1년간의 운세 흐름을 사계절의 변화처럼 읽어볼게요:`,
    `정원을 한 바퀴 돌며 느낀 ${currentYear}년의 사계절 에너지 흐름이에요:`,
  ];
  paragraphs.push(emphasis(rng.pick(yearFlowIntro)));

  // 봄 (1~3월, idx 0~2)
  const springMonths = allMonths.slice(0, 3);
  const springAvgGrade = springMonths.reduce((sum, mp) => {
    const g = yongEl ? getYongshinMatchGrade(mp.stemElement, yongEl, heeEl, hanEl, guEl, giEl) : 3;
    return sum + g;
  }, 0) / 3;

  const springDesc: readonly string[] = [
    `봄 (1~3월, 인묘진월): 새싹이 돋는 목(木)의 계절이에요. ${springAvgGrade >= 3.5 ? '올봄은 에너지가 좋으니 새로운 시작을 하기에 딱이에요!' : springAvgGrade >= 2.5 ? '올봄은 보통 수준의 에너지예요. 차분히 준비하면 좋아요.' : '올봄은 조금 조심스러운 에너지이니, 무리하지 말고 천천히 시작하세요.'}`,
  ];
  paragraphs.push(narrative(rng.pick(springDesc), 'WOOD'));

  // 여름 (4~6월, idx 3~5)
  const summerMonths = allMonths.slice(3, 6);
  const summerAvgGrade = summerMonths.reduce((sum, mp) => {
    const g = yongEl ? getYongshinMatchGrade(mp.stemElement, yongEl, heeEl, hanEl, guEl, giEl) : 3;
    return sum + g;
  }, 0) / 3;

  const summerDesc: readonly string[] = [
    `여름 (4~6월, 사오미월): 태양이 뜨거운 화(火)의 계절이에요. ${summerAvgGrade >= 3.5 ? '올여름은 열정적인 에너지가 넘치니, 활동적으로 보내면 좋은 결과가 올 거예요!' : summerAvgGrade >= 2.5 ? '올여름은 무난한 에너지예요. 너무 달리지 말고 적당히 쉬어가며 활동하세요.' : '올여름은 무더위처럼 조금 힘든 에너지이니, 건강 관리에 특히 신경 쓰세요.'}`,
  ];
  paragraphs.push(narrative(rng.pick(summerDesc), 'FIRE'));

  // 가을 (7~9월, idx 6~8)
  const autumnMonths = allMonths.slice(6, 9);
  const autumnAvgGrade = autumnMonths.reduce((sum, mp) => {
    const g = yongEl ? getYongshinMatchGrade(mp.stemElement, yongEl, heeEl, hanEl, guEl, giEl) : 3;
    return sum + g;
  }, 0) / 3;

  const autumnDesc: readonly string[] = [
    `가을 (7~9월, 신유술월): 열매를 수확하는 금(金)의 계절이에요. ${autumnAvgGrade >= 3.5 ? '올가을은 그동안의 노력이 결실을 맺는 좋은 시기예요! 수확의 기쁨을 누리세요.' : autumnAvgGrade >= 2.5 ? '올가을은 차분한 에너지예요. 정리와 마무리에 집중하면 좋아요.' : '올가을은 조금 쌀쌀한 에너지이니, 몸과 마음을 따뜻하게 챙기세요.'}`,
  ];
  paragraphs.push(narrative(rng.pick(autumnDesc), 'METAL'));

  // 겨울 (10~12월, idx 9~11)
  const winterMonths = allMonths.slice(9, 12);
  const winterAvgGrade = winterMonths.reduce((sum, mp) => {
    const g = yongEl ? getYongshinMatchGrade(mp.stemElement, yongEl, heeEl, hanEl, guEl, giEl) : 3;
    return sum + g;
  }, 0) / 3;

  const winterDesc: readonly string[] = [
    `겨울 (10~12월, 해자축월): 씨앗이 봄을 기다리는 수(水)의 계절이에요. ${winterAvgGrade >= 3.5 ? '올겨울은 생각보다 따뜻한 에너지가 흐르니, 내면의 성장에 좋은 시기예요!' : winterAvgGrade >= 2.5 ? '올겨울은 평범한 에너지예요. 따뜻한 실내에서 공부나 계획 세우기가 좋아요.' : '올겨울은 좀 추운 에너지이니, 몸과 마음 모두 따뜻하게 감싸주세요. 다음 봄이 올 거예요!'}`,
  ];
  paragraphs.push(narrative(rng.pick(winterDesc), 'WATER'));

  // =========================================================================
  //  SECTION 7: 월별 주의사항 & 팁
  // =========================================================================

  const tipsIntro: readonly string[] = [
    `마지막으로 달력 요정이 ${name}님에게 드리는 월운 활용 꿀팁이에요!`,
    `달력 요정의 비밀 노트를 공개할게요! 월운을 잘 활용하는 방법이에요.`,
    `${name}님이 1년을 더 알차게 보낼 수 있도록, 달력 요정의 특별 팁을 정리해 놓았어요!`,
  ];
  paragraphs.push(emphasis(rng.pick(tipsIntro)));

  // 월운 활용법 팁들
  const usageTips: readonly string[] = [
    '용신 부합도가 높은 달(4~5점)에는 중요한 시험, 면접, 새 시작을 계획해보세요. 바람이 순풍일 때 돛을 올리는 것처럼 더 좋은 결과를 얻을 수 있어요!',
    '용신 부합도가 낮은 달(1~2점)에는 무리한 도전보다 건강 관리와 자기 계발에 집중하세요. 겨울에 뿌리를 튼튼히 하면 봄에 더 크게 자라나요.',
    '용신 부합도가 보통인 달(3점)에는 꾸준히 하던 일을 성실히 해나가면 돼요. 잔잔한 물에 배를 띄우듯, 차분하게 노를 저으세요.',
    '월운은 대운이나 세운보다 작은 흐름이에요. 대운이 "인생의 큰 파도"라면 월운은 "매일의 날씨" 같은 거예요. 큰 흐름과 작은 흐름을 함께 보면 더 정확한 판단을 할 수 있어요!',
  ];

  for (const tipText of usageTips) {
    paragraphs.push(tip(tipText));
  }

  // 용신 오행 활용법
  if (yongEl) {
    const yongTips: readonly string[] = [
      `${name}님의 용신은 ${elFull(yongEl)}이에요. 이 오행의 에너지를 일상에서 가까이 하면 힘든 달도 더 수월하게 보낼 수 있어요.`,
      `${elFull(yongEl)}의 색상(${elColor(yongEl)})을 가까이 하고, ${ELEMENT_SEASON[yongEl]}에 더 적극적으로 활동하면 용신 에너지를 보충할 수 있어요.`,
    ];
    paragraphs.push(tip(rng.pick(yongTips), yongEl));

    // 구체적 활동 추천
    const seasonActivities: Record<ElementCode, string> = {
      WOOD: '숲 산책, 원예, 스트레칭, 초록색 소품 활용',
      FIRE: '운동, 남향 방에서 일하기, 빨간색 아이템 활용',
      EARTH: '규칙적 식사, 걷기, 노란색 소품, 도자기 공예',
      METAL: '음악 감상, 서쪽 산책, 흰색 인테리어, 정리정돈',
      WATER: '독서, 수영, 검정/남색 옷, 충분한 수분 섭취',
    };
    paragraphs.push(tip(
      `${name}님에게 추천하는 용신 활동: ${seasonActivities[yongEl]}`,
      yongEl,
    ));
  }

  // =========================================================================
  //  SECTION 8: 마무리
  // =========================================================================

  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name }),
  ));

  // =========================================================================
  //  테이블: 12개월 운세 캘린더
  // =========================================================================

  const calendarTable: ReportTable = {
    title: `${currentYear}년 12개월 운세 캘린더`,
    headers: ['월', '월명', '간지', '한자', '천간 오행', '지지 오행', '천간 십성', '지지 십성', '용신부합', '비고'],
    rows: calendarRows,
  };

  // 이번 달 상세 테이블
  const thisMonthTable: ReportTable = {
    title: '이번 달 상세 정보',
    headers: ['항목', '내용'],
    rows: [
      ['이번 달', thisMonthName],
      ['절기', thisJeolgi],
      ['양력 기간', thisSolarApprox],
      ['간지', `${thisGanzi} (${currentPillar.stem.hanja}${currentPillar.branch.hanja})`],
      ['천간 오행', `${elFull(thisStemEl)} (${currentPillar.stem.hangul})`],
      ['지지 오행', `${elFull(thisBranchEl)} (${currentPillar.branch.hangul})`],
      ['천간 십성', thisStemTenGod.korean],
      ['지지 십성', thisBranchTenGod.korean],
      ['용신 부합도', `${thisStars} (${thisGradeDesc})`],
      ['계절', thisSeason],
    ],
  };

  // 절기 참조 테이블
  const jeolgiTable: ReportTable = {
    title: '절기 기준 월 대조표',
    headers: ['사주 월', '절입 절기', '양력 시작', '지지'],
    rows: Array.from({ length: 12 }, (_, i) => [
      `${i + 1}월`,
      JEOLGI_NAMES[i],
      SOLAR_MONTH_APPROX[i],
      `${BRANCHES[MONTH_BRANCH_INDICES[i]].hangul}(${BRANCHES[MONTH_BRANCH_INDICES[i]].hanja})`,
    ]),
  };

  // =========================================================================
  //  차트: 12개월 용신 부합도 라인 차트
  // =========================================================================

  const lineChart: ReportChart = {
    type: 'line',
    title: '12개월 용신 부합도 추이',
    data: gradeData,
    meta: {
      description: '각 월의 용신 부합도를 라인 차트로 표시합니다. 5=만발꽃밭, 1=겨울준비.',
      gradeLabels: {
        5: '만발 꽃밭',
        4: '봄 꽃밭',
        3: '평화로운 초원',
        2: '서리 조심',
        1: '겨울 준비',
      },
    },
  };

  // 오행 분포 바 차트 (12개월 천간 오행)
  const elementCounts: Record<ElementCode, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const mp of allMonths) {
    elementCounts[mp.stemElement]++;
  }
  const elementBarData: Record<string, number | string> = {};
  for (const el of ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as ElementCode[]) {
    elementBarData[`${elShort(el)}(${elHanja(el)})`] = elementCounts[el];
  }

  const barChart: ReportChart = {
    type: 'bar',
    title: '12개월 천간 오행 분포',
    data: elementBarData,
    meta: {
      description: '올해 12개월의 천간 오행이 어떻게 분포되어 있는지 보여줍니다.',
    },
  };

  // =========================================================================
  //  하이라이트
  // =========================================================================

  const highlights: ReportHighlight[] = [
    {
      label: '이번 달 간지',
      value: `${thisGanzi} (${currentPillar.stem.hanja}${currentPillar.branch.hanja})`,
      element: thisStemEl,
      sentiment: thisGrade >= 4 ? 'good' : thisGrade <= 2 ? 'caution' : 'neutral',
    },
    {
      label: '이번 달 용신부합도',
      value: `${thisStars} (${thisGradeDesc})`,
      sentiment: thisGrade >= 4 ? 'good' : thisGrade <= 2 ? 'caution' : 'neutral',
    },
    {
      label: '이번 달 천간 십성',
      value: thisStemTenGod.korean,
      sentiment: 'neutral',
    },
    {
      label: '이번 달 지지 십성',
      value: thisBranchTenGod.korean,
      sentiment: 'neutral',
    },
    {
      label: '최고의 달',
      value: `${bestMonth + 1}월 (${bestPillar.ganzi})`,
      element: bestPillar.stemElement,
      sentiment: 'good',
    },
    {
      label: '조심할 달',
      value: `${worstMonth + 1}월 (${worstPillar.ganzi})`,
      element: worstPillar.stemElement,
      sentiment: 'caution',
    },
  ];

  if (yongEl) {
    highlights.push({
      label: '용신',
      value: elFull(yongEl),
      element: yongEl,
      sentiment: 'good',
    });
  }

  // =========================================================================
  //  반환
  // =========================================================================

  return {
    id: 'monthlyFortune',
    title: '월운(月運) 분석',
    subtitle: '매달 피어나는 운세의 꽃밭 — 달력 요정의 12개월 안내서',
    paragraphs,
    tables: [thisMonthTable, calendarTable, jeolgiTable],
    charts: [lineChart, barChart],
    highlights,
  };
}
