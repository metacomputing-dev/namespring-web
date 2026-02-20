/**
 * part7-weeklyFortune.ts -- 주운(週運) 7일 분석 섹션
 *
 * PART 7-6: input.today 기준 7일간의 일진(日辰) 간지를 연속 60갑자로 산출하고,
 * 각 일별로 십성, 용신 부합도, 원국 합충 대조를 분석합니다.
 *
 * 페르소나: "여행 가이드/탐험가"
 * - 7일을 7개 여행지/코스로 비유합니다.
 * - 요일별 고유한 여행 메타포를 사용합니다.
 *   (월=새 출발, 화=에너지, 수=중간기착, 목=성장, 금=수확, 토=정비, 일=휴식)
 * - 용신 부합도별 여행 컨디션 비유를 사용합니다.
 * - "여행 가이드" 톤: "이번 주 7일간의 여행 코스를 안내해드릴게요!"
 *
 * 분석 항목 (CLAUDE.md 7-6 준수):
 *   - 7일 일진 간지 (연속 60갑자)
 *   - 각 일별 십성 (stem/branch vs 일간)
 *   - 각 일별 용신 부합도 (오행 vs 용신)
 *   - 각 일별 원국 합충 대조 (branch vs 원국 4 branch)
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ReportSubsection,
  ElementCode,
  YongshinMatchGrade,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_TASTE,
  ELEMENT_SEASON,
  ELEMENT_TIME,
  ELEMENT_FOOD,
  ELEMENT_NATURE,
  ELEMENT_EMOTION,
  ELEMENT_GENERATED_BY,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_CONTROLLED_BY,
  STEMS,
  BRANCHES,
  GANZHI_60,
  julianDayToGanzhiIndex,
  getYongshinMatchGrade,
  YONGSHIN_GRADE_STARS,
  YONGSHIN_GRADE_DESC,
  getElementRelation,
  TEN_GOD_BY_CODE,
  BRANCH_BY_HANGUL,
  STEM_BY_CODE,
  lookupStemInfo,
  lookupBranchInfo,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  caution,
  tip,
  emphasis,
  encouraging,
  joinSentences,
  listJoin,
  withParticle,
  eunNeun,
  iGa,
  eulReul,
  type SeededRandom,
} from '../common/sentenceUtils.js';

// =============================================================================
//  상수: 요일별 여행 메타포 매핑
// =============================================================================

/** 요일 인덱스 (0=일요일, 1=월요일, ..., 6=토요일) */
interface DayOfWeekTheme {
  readonly name: string;
  readonly travelTheme: string;
  readonly travelKeyword: string;
  readonly travelDesc: string;
  readonly travelImage: string;
}

const DAY_OF_WEEK_THEMES: Record<number, DayOfWeekTheme> = {
  0: {
    name: '일요일',
    travelTheme: '휴식',
    travelKeyword: '베이스캠프',
    travelDesc: '캠프파이어 옆에서 여유롭게 쉬어가는 날',
    travelImage: '탐험가에게도 쉼은 필수예요. 따뜻한 캠프파이어 옆에서 다음 여행을 꿈꾸는 시간이에요.',
  },
  1: {
    name: '월요일',
    travelTheme: '새 출발',
    travelKeyword: '출발선',
    travelDesc: '새로운 여행지를 향해 배낭을 메고 첫 발을 내딛는 날',
    travelImage: '새 지도를 펼치고 나침반을 꺼내는 시간! 어떤 풍경이 기다리고 있을지 설렘이 가득한 출발이에요.',
  },
  2: {
    name: '화요일',
    travelTheme: '에너지',
    travelKeyword: '정상 도전',
    travelDesc: '체력이 넘치고 모험심이 불타오르는 날',
    travelImage: '화산 트레일을 오르듯 에너지가 폭발하는 날이에요! 가장 험한 코스도 거뜬히 정복할 수 있어요.',
  },
  3: {
    name: '수요일',
    travelTheme: '중간 기착',
    travelKeyword: '경유지',
    travelDesc: '여행 중간에 잠시 멈춰 풍경을 감상하는 날',
    travelImage: '여행의 중간 기착지에서 가방을 내려놓고 주변을 둘러보는 시간이에요. 지나온 길을 돌아보며 쉬어가세요.',
  },
  4: {
    name: '목요일',
    travelTheme: '성장',
    travelKeyword: '숲길 트레킹',
    travelDesc: '험한 길을 지나며 여행 실력이 부쩍 느는 날',
    travelImage: '울창한 숲길을 걸으며 한 뼘 더 성장하는 시간이에요. 어제보다 더 넓어진 세계를 만나보세요.',
  },
  5: {
    name: '금요일',
    travelTheme: '수확',
    travelKeyword: '정상 뷰',
    travelDesc: '정상에 올라 절경을 감상하며 보물을 수확하는 날',
    travelImage: '힘든 트레킹 끝에 정상에서 펼쳐지는 절경! 이번 주 여행에서 얻은 보물들을 정리할 시간이에요.',
  },
  6: {
    name: '토요일',
    travelTheme: '정비',
    travelKeyword: '장비 점검',
    travelDesc: '여행 장비를 손질하고 다음 모험을 준비하는 날',
    travelImage: '현명한 탐험가는 장비 정비를 게을리하지 않아요. 몸과 마음을 돌보며 다음 여행을 준비하는 시간이에요.',
  },
};

// =============================================================================
//  상수: 지지 합충형 매핑 (원국 대조용)
// =============================================================================

/** 지지 충(冲) 쌍: 자-오, 축-미, 인-신, 묘-유, 진-술, 사-해 */
const BRANCH_CHUNG_MAP: Record<number, number> = {
  0: 6,   // 자(子) <-> 오(午)
  1: 7,   // 축(丑) <-> 미(未)
  2: 8,   // 인(寅) <-> 신(申)
  3: 9,   // 묘(卯) <-> 유(酉)
  4: 10,  // 진(辰) <-> 술(戌)
  5: 11,  // 사(巳) <-> 해(亥)
  6: 0,   // 오(午) <-> 자(子)
  7: 1,   // 미(未) <-> 축(丑)
  8: 2,   // 신(申) <-> 인(寅)
  9: 3,   // 유(酉) <-> 묘(卯)
  10: 4,  // 술(戌) <-> 진(辰)
  11: 5,  // 해(亥) <-> 사(巳)
};

/** 지지 육합(六合) 쌍 */
const BRANCH_YUKHAP_MAP: Record<number, number> = {
  0: 1, 1: 0, 2: 11, 3: 10, 4: 9, 5: 8,
  6: 7, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2,
};

/** 지지 형(刑) 관계 (삼형살 + 자형) */
const BRANCH_HYEONG_MAP: Record<number, number[]> = {
  0: [3], 1: [10, 7], 2: [5], 3: [0],
  4: [4], 5: [8], 6: [6], 7: [1],
  8: [2], 9: [9], 10: [7], 11: [11],
};

// =============================================================================
//  상수: 십성 산출 테이블
// =============================================================================

/** 일간 오행과 대상 오행의 관계 -> 십성 결정 */
const TEN_GOD_BY_RELATION: Record<string, [string, string]> = {
  same:          ['비견(比肩)', '겁재(劫財)'],
  generates:     ['식신(食神)', '상관(傷官)'],
  generated_by:  ['편인(偏印)', '정인(正印)'],
  controls:      ['편재(偏財)', '정재(正財)'],
  controlled_by: ['편관(偏官)', '정관(正官)'],
};

/** 십성 한글 이름의 짧은 설명 */
const TEN_GOD_SHORT_MEANING: Record<string, string> = {
  '비견(比肩)': '동행자와 어깨를 나란히 하는 에너지 -- 함께 걸으면 시너지가 좋아요',
  '겁재(劫財)': '다른 탐험대와 경쟁하듯 활기찬 에너지 -- 의욕은 넘치지만 페이스 조절이 필요해요',
  '식신(食神)': '맛집 투어와 체험 활동이 빛나는 에너지 -- 먹을 복이 가득하고 창의적 감각이 살아요',
  '상관(傷官)': '예술적 영감이 터지는 에너지 -- 사진 찍기, 글쓰기에 딱인 여행이에요',
  '편재(偏財)': '뜻밖의 보물을 발견하는 행운의 에너지 -- 새로운 사람과의 만남에서 기회가 와요',
  '정재(正財)': '알뜰하고 계획적인 여행의 에너지 -- 예산 관리를 잘하면 풍성한 성과가 있어요',
  '편관(偏官)': '약간의 긴장감이 감도는 모험의 에너지 -- 규칙을 지키며 나아가면 성장의 기회예요',
  '정관(正官)': '격식 있는 공식 투어 같은 에너지 -- 예의를 갖추면 좋은 인상을 줄 수 있어요',
  '편인(偏印)': '미스터리 투어 같은 에너지 -- 직감과 영감이 살아나 뜻밖의 발견이 있어요',
  '정인(正印)': '역사 유적지 탐방의 에너지 -- 새로운 지식을 쌓기 딱 좋은 날이에요',
};

/** 십성별 하루 여행 키워드 */
const TEN_GOD_TRAVEL_KEYWORD: Record<string, string> = {
  '비견(比肩)': '동행과 협력',
  '겁재(劫財)': '경쟁과 도전',
  '식신(食神)': '맛집 탐방과 체험',
  '상관(傷官)': '예술적 영감',
  '편재(偏財)': '보물 발견',
  '정재(正財)': '알뜰한 계획',
  '편관(偏官)': '모험적 탐험',
  '정관(正官)': '질서와 명예',
  '편인(偏印)': '미스터리 발견',
  '정인(正印)': '학습과 성장',
};

// =============================================================================
//  헬퍼 함수
// =============================================================================

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
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

/** 한신(閑神) 오행 추론 */
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

/** Date -> 줄리안 일수 변환 */
function dateToJulianDay(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const yAdj = y + 4800 - a;
  const mAdj = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mAdj + 2) / 5) +
    365 * yAdj +
    Math.floor(yAdj / 4) -
    Math.floor(yAdj / 100) +
    Math.floor(yAdj / 400) -
    32045
  );
}

/** 십성 산출 */
function computeTenGod(
  dayMasterElement: ElementCode,
  dayMasterYinYang: string,
  targetElement: ElementCode,
  targetYinYang: string,
): string {
  const relation = getElementRelation(dayMasterElement, targetElement);
  const samePolarity = dayMasterYinYang === targetYinYang;
  const pair = TEN_GOD_BY_RELATION[relation];
  if (!pair) return '비견(比肩)';
  return samePolarity ? pair[0] : pair[1];
}

/** 원국 4주 지지와 일진 지지의 합충형 관계를 대조 */
function checkBranchRelations(
  dailyBranchIndex: number,
  originalBranches: { index: number; pillarName: string; hangul: string }[],
): { type: string; pillarName: string; branchHangul: string; dailyBranchHangul: string }[] {
  const results: { type: string; pillarName: string; branchHangul: string; dailyBranchHangul: string }[] = [];
  const dailyBranch = BRANCHES[dailyBranchIndex];

  for (const ob of originalBranches) {
    if (BRANCH_CHUNG_MAP[dailyBranchIndex] === ob.index) {
      results.push({ type: '충(冲)', pillarName: ob.pillarName, branchHangul: ob.hangul, dailyBranchHangul: dailyBranch.hangul });
    }
    if (BRANCH_YUKHAP_MAP[dailyBranchIndex] === ob.index) {
      results.push({ type: '합(合)', pillarName: ob.pillarName, branchHangul: ob.hangul, dailyBranchHangul: dailyBranch.hangul });
    }
    const hyeongTargets = BRANCH_HYEONG_MAP[dailyBranchIndex];
    if (hyeongTargets && hyeongTargets.includes(ob.index)) {
      results.push({ type: '형(刑)', pillarName: ob.pillarName, branchHangul: ob.hangul, dailyBranchHangul: dailyBranch.hangul });
    }
  }
  return results;
}

// =============================================================================
//  일별 상세 데이터 인터페이스
// =============================================================================

interface DailyFortuneEntry {
  readonly date: Date;
  readonly dayOfWeek: number;
  readonly ganzhiIndex: number;
  readonly stemHangul: string;
  readonly branchHangul: string;
  readonly stemHanja: string;
  readonly branchHanja: string;
  readonly stemElement: ElementCode;
  readonly branchElement: ElementCode;
  readonly stemYinYang: string;
  readonly branchYinYang: string;
  readonly tenGodStem: string;
  readonly tenGodBranch: string;
  readonly yongshinGrade: YongshinMatchGrade;
  readonly relations: { type: string; pillarName: string; branchHangul: string; dailyBranchHangul: string }[];
  readonly dateStr: string;
}

// =============================================================================
//  오행별 여행지 이미지 매핑
// =============================================================================

const ELEMENT_TRAVEL_IMAGE: Record<string, readonly string[]> = {
  WOOD: [
    '울창한 숲 속 트레킹 코스처럼 싱그럽고 생기 넘치는',
    '대나무 숲길을 걷는 것처럼 맑고 상쾌한',
    '봄꽃이 만개한 수목원처럼 성장의 에너지가 가득한',
    '초록빛 계곡 탐험로처럼 활기차고 힘찬',
  ],
  FIRE: [
    '활화산 트레일처럼 뜨겁고 열정적인',
    '사막의 오아시스를 찾아가는 것처럼 화려하고 역동적인',
    '석양이 붉게 물드는 전망대처럼 감동적인',
    '축제가 열리는 광장처럼 밝고 즐거운',
  ],
  EARTH: [
    '고원 위의 목장처럼 평화롭고 안정적인',
    '옛 마을 산책로처럼 포근하고 편안한',
    '대지의 품에 안긴 온천 마을처럼 든든한',
    '황토빛 성곽 위를 걷는 것처럼 묵직하고 신뢰감 있는',
  ],
  METAL: [
    '설산 정상을 향한 등반로처럼 결단력 있는',
    '은빛 호수가 빛나는 고산 트레일처럼 서늘하고 날카로운',
    '크리스탈 동굴 탐험처럼 반짝이고 정교한',
    '가을 단풍 라이딩 코스처럼 쾌적하고 상쾌한',
  ],
  WATER: [
    '잔잔한 호수 위 카약 코스처럼 유연하고 지혜로운',
    '깊은 바다 스노클링처럼 탐구적이고 깊이 있는',
    '밤하늘 별이 비치는 강변 캠핑지처럼 고요하고 사색적인',
    '안개 낀 폭포 트레킹처럼 신비롭고 몽환적인',
  ],
};

// =============================================================================
//  문장 템플릿 -- "여행 가이드/탐험가" 페르소나
// =============================================================================

const SECTION_INTRO_TEMPLATES: readonly string[] = [
  '{{이름}}님, 여행 가이드가 이번 주 7일간의 여행 코스를 안내해드릴게요! 각각의 날이 하나의 여행지라면, 어떤 풍경이 펼쳐질지 함께 살펴볼까요?',
  '안녕하세요, {{이름}}님의 전속 여행 가이드입니다! 이번 주 7일간의 탐험 코스를 미리 보여드릴게요. 매일 다른 풍경, 다른 에너지가 기다리고 있답니다.',
  '이번 주는 어떤 여행이 펼쳐질까요? {{이름}}님, 7일간의 여행 일정표를 가져왔어요! 좋은 날에는 힘차게 전진하고, 험한 날에는 현명하게 쉬어가는 여행법을 안내해 드릴게요.',
  '{{이름}}님의 이번 주를 7개의 여행지로 안내해 드릴게요! 어떤 곳은 순탄한 평지, 어떤 곳은 가파른 언덕이에요. 미리 알고 떠나면 여행이 훨씬 즐거워진답니다.',
  '지도를 펼치고, 나침반을 꺼내세요! {{이름}}님, 이번 주 7일간의 탐험 로드맵을 공개합니다. 각 날의 기운과 컨디션을 미리 파악해서 최고의 한 주를 보내볼게요!',
  '매일이 새로운 여행지인 것처럼, 이번 주 7일 동안 어떤 풍경이 펼쳐질지 {{이름}}님의 여행 가이드가 꼼꼼히 안내해 드릴게요. 출발 준비 되셨나요?',
];

const YONGSHIN_TRAVEL_TEMPLATES: readonly string[] = [
  '{{이름}}님에게 최고의 여행 파트너(용신)는 {{용신오행}}의 기운이에요! 이 오행을 만나는 날이 여행의 하이라이트가 된답니다. 별이 많은 날이 곧 최고의 여행일이에요.',
  '여행에서 가장 힘이 되는 기운(용신)은 {{용신오행}}이에요. 이 오행이 흐르는 날에는 어디를 가든 순조로워요. 별 개수로 매일의 여행 컨디션을 한눈에 확인할 수 있어요!',
  '{{이름}}님의 여행 나침반이 가장 밝게 빛나는 기운(용신)은 {{용신오행}}이에요. 이 오행과 잘 맞는 날이 이번 주 여행의 핵심 포인트예요.',
];

const DAY_EXPLAIN_TEMPLATES: readonly string[] = [
  '일진(日辰)은 매일의 하늘 기운을 나타내는 간지(干支)예요. 60갑자가 순서대로 돌아가면서 매일 다른 에너지의 여행지를 보여주는 것이지요.',
  '매일 하늘에서는 다른 기운이 내려와요. 이걸 일진이라고 부르는데, 60개의 간지가 차례로 돌아가면서 7개의 서로 다른 여행지를 만들어주는 거예요.',
  '일진은 하루하루의 간지예요. 마치 여행 코스마다 날씨가 다르듯, 60갑자가 순환하며 매일 다른 오행 에너지를 전해주는 거랍니다.',
];

const TABLE_INTRO_TEMPLATES: readonly string[] = [
  '먼저 7일간의 여행 코스를 한눈에 볼 수 있는 노선도를 펼쳐볼게요!',
  '이번 주 여행 전체를 조감도처럼 한눈에 보여드릴게요!',
  '출발 전에 먼저 전체 여행 코스를 지도에서 확인해볼까요?',
];

/** 용신부합도 등급별 여행 컨디션 문장 */
const GRADE_TRAVEL_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '오늘은 여행의 하이라이트! 날씨도 완벽하고, 길도 탄탄하고, 모든 것이 순조로운 최고의 여행일이에요.',
    '탐험가가 꿈꾸던 바로 그 날이에요! 어디를 가든 환상적인 풍경이 펼쳐지는 최고의 코스예요.',
    '여행의 운이 최고조인 날! 예상치 못한 멋진 풍경과 행운을 만날 확률이 아주 높아요.',
    '이번 주 여행에서 가장 빛나는 하루예요. 용기를 내어 가장 가보고 싶었던 곳으로 출발하세요!',
    '순풍이 등을 밀어주는 최상의 여행일이에요. 적극적인 도전이 빛을 발할 거예요!',
  ],
  4: [
    '기분 좋은 산들바람이 부는 여행일이에요. 계획대로 순조롭게 진행될 거예요.',
    '맑은 하늘 아래 편안한 트레킹이 가능한 날이에요. 가볍고 상쾌한 여행이 될 거예요.',
    '여행 가이드가 추천하는 "좋은 날" 마크가 붙은 하루! 새로운 시도를 해보기 좋은 코스예요.',
    '따뜻한 햇살과 적당한 바람이 여행을 도와주는 날이에요. 즐거운 탐험이 될 거예요.',
    '여행 가방을 가볍게 들고 산책하듯 즐길 수 있는 순조로운 하루예요.',
  ],
  3: [
    '특별히 좋지도 나쁘지도 않은, 무난한 여행일이에요. 꾸준히 걸으면 목적지에 잘 도착할 수 있어요.',
    '잔잔한 하루예요. 큰 모험보다는 일상적인 코스를 즐기며 여유롭게 보내는 것이 좋아요.',
    '흐린 날씨에 가끔 햇살이 비추는 것 같은 하루예요. 평범하지만 나름의 풍경이 있어요.',
    '여행의 리듬을 유지하며 차분히 걸어가는 날이에요. 무리하지 않으면 충분히 좋은 하루예요.',
    '잔잔한 호수 위를 카약으로 노 저으며 나아가는 것 같은, 평온한 하루예요.',
  ],
  2: [
    '여행 경로에 약간의 험로가 예상되는 날이에요. 장비를 꼼꼼히 체크하고 신중하게 이동하세요.',
    '안개가 살짝 낀 여행길과 같아요. 서두르지 말고 한 발 한 발 조심스럽게 내딛어 보세요.',
    '여행 가이드가 "주의" 표시를 해둔 구간이에요. 무리한 모험은 자제하고 안전에 집중하세요.',
    '약간의 역풍이 부는 여행일이에요. 여유를 갖고 대처하면 무사히 지나갈 수 있어요.',
    '비가 조금 내리는 트레킹 코스와 같아요. 우산을 챙기고 발밑을 조심하면 괜찮아요.',
  ],
  1: [
    '폭풍우 예보가 있는 날에는 베이스캠프에서 쉬는 게 현명해요. 충분히 쉬어주세요.',
    '여행 중 가장 험한 구간이에요. 하지만 모든 험로에는 끝이 있으니 걱정하지 마세요.',
    '오늘은 텐트 안에서 따뜻한 차 한 잔 마시며 쉬어가는 날로 삼아보세요. 내일은 또 다른 풍경이 기다려요.',
    '거센 바람이 부는 날에는 안전한 곳에서 기다리는 것이 진짜 탐험가의 지혜예요.',
    '험한 산길에서는 무리한 전진보다 뒤로 물러서는 것이 더 용감한 선택이에요. 내일을 위해 쉬어가세요.',
  ],
};

/** 합충형 발생 시 여행 비유 코멘트 */
const RELATION_TRAVEL_TEMPLATES: Record<string, readonly string[]> = {
  '충(冲)': [
    '일진의 {{일지}} 지지가 원국 {{기둥}}의 {{원지}}와 충(冲)을 이루고 있어요. 여행 중 예상치 못한 우회로를 만난 것과 비슷해요. 유연하게 대처하면 새로운 풍경을 발견할 수도 있어요.',
    '{{일지}}-{{원지}} 충! 마치 여행길에 갑작스런 도로 공사를 만난 것 같아요. 당황하지 말고 우회로를 찾으면 돼요.',
    '일진 {{일지}}와 {{기둥}}의 {{원지}}가 충돌하는 구간이에요. 계획이 약간 틀어질 수 있지만, 새로운 루트에서 뜻밖의 명소를 발견할 수도 있답니다.',
  ],
  '합(合)': [
    '일진의 {{일지}} 지지가 원국 {{기둥}}의 {{원지}}와 합(合)을 이루고 있어요! 여행 중 멋진 현지 가이드를 만난 것처럼 좋은 기운이 더해져요.',
    '{{일지}}-{{원지}} 합! 여행지에서 의외의 동행자를 만난 것 같은 행운이에요. 사람들과의 관계가 빛나는 날이에요.',
    '일진 {{일지}}와 {{기둥}}의 {{원지}}가 합! 마치 여행 중 숨은 명소의 입장권을 선물 받은 것 같은 좋은 기운이에요.',
  ],
  '형(刑)': [
    '일진의 {{일지}} 지지가 원국 {{기둥}}의 {{원지}}와 형(刑)을 이루고 있어요. 험한 산길을 만난 것처럼 약간의 마찰이 있을 수 있지만, 이것도 성장의 기회예요.',
    '{{일지}}-{{원지}} 형! 여행 중 약간의 시련이 있을 수 있어요. 하지만 탐험가는 시련을 통해 더 강해지는 법이에요.',
    '일진 {{일지}}와 {{기둥}}의 {{원지}} 사이에 형이 작용해요. 험로를 만났을 때 인내하면 한층 성숙해질 수 있어요.',
  ],
};

/** 요일+오행 조합 여행 코멘트 */
function getWeekdayElementTravelAdvice(rng: SeededRandom, dayOfWeek: number, element: ElementCode): string {
  const theme = DAY_OF_WEEK_THEMES[dayOfWeek];
  const adviceMap: Record<number, Record<string, readonly string[]>> = {
    1: { // 월요일 - 새 출발
      WOOD:  ['목(木) 기운 + 새 출발! 봄에 새싹이 돋듯 상쾌한 여행의 시작이에요. 새 지도를 펼치고 힘차게 출발하세요!', '숲 속 새벽 산책처럼 상쾌한 월요일! 첫 발을 내딛는 설렘이 가득해요.'],
      FIRE:  ['화(火) 기운 + 새 출발! 활화산처럼 활활 타오르는 열정으로 한 주의 여행을 멋지게 여는 날이에요!', '횃불을 들고 출발하는 것처럼 에너지 넘치는 시작이에요!'],
      EARTH: ['토(土) 기운 + 새 출발! 든든한 대지 위에 베이스캠프를 세우듯 안정적인 시작이에요.', '평탄한 초원길에서 출발하는 것처럼 확실하고 차분한 시작이에요!'],
      METAL: ['금(金) 기운 + 새 출발! 날카로운 나침반으로 방향을 정하듯 명확한 목표를 세우기 좋아요.', '쇠로 만든 튼튼한 등산화를 신고 출발하는 것처럼 단단한 시작이에요!'],
      WATER: ['수(水) 기운 + 새 출발! 시냇물이 흐르기 시작하듯 부드럽게 한 주의 여행이 시작돼요.', '강에서 카약을 띄우듯 유연하게 한 주를 시작해보세요!'],
    },
    2: { // 화요일 - 에너지
      WOOD:  ['목(木) 기운 + 에너지! 나무가 하늘을 향해 뻗어나가듯 성장하려는 에너지가 폭발해요!', '정글 탐험처럼 활기찬 하루가 될 거예요!'],
      FIRE:  ['화(火) 기운 + 에너지! 두 배로 활활 타오르는 날! 화산 트레일을 정복할 만큼의 체력이 넘쳐요!', '뜨거운 사막을 건너는 용감한 탐험가처럼 힘차게 나아가세요!'],
      EARTH: ['토(土) 기운 + 에너지! 땅속 마그마처럼 내면에서 묵직한 힘이 솟아오르는 날이에요.', '고원 트레킹에 도전하기 딱 좋은 에너지예요!'],
      METAL: ['금(金) 기운 + 에너지! 달궈진 강철처럼 실력을 갈고닦기 좋은 날이에요!', '설산 등반에 도전할 수 있는 결연한 에너지가 넘쳐요!'],
      WATER: ['수(水) 기운 + 에너지! 폭포처럼 힘찬 에너지가 솟구치는 날이에요!', '급류 래프팅처럼 역동적인 하루가 될 거예요!'],
    },
    3: { // 수요일 - 중간 기착
      WOOD:  ['목(木) 기운 + 중간 기착! 숲 속 쉼터에서 잠시 쉬며 나무 그늘 아래 생각을 정리하기 좋아요.', '숲 한가운데 벤치에 앉아 여행 노트를 정리하는 것처럼 차분한 시간이에요.'],
      FIRE:  ['화(火) 기운 + 중간 기착! 캠프파이어를 피우고 여행 이야기를 나누는 따뜻한 시간이에요.', '전망대에서 석양을 바라보며 지나온 여행길을 돌아보는 시간이에요.'],
      EARTH: ['토(土) 기운 + 중간 기착! 마을 광장에서 현지 음식을 맛보며 쉬어가는 포근한 시간이에요.', '온천 마을에서 몸을 담그듯 편안하게 충전할 수 있어요.'],
      METAL: ['금(金) 기운 + 중간 기착! 장비를 점검하고 다음 루트를 냉정하게 분석하기 좋은 때예요.', '전략적으로 다음 코스를 계획하는 현명한 탐험가의 시간이에요.'],
      WATER: ['수(水) 기운 + 중간 기착! 호숫가에 앉아 잔잔한 물결을 바라보며 마음을 정리할 수 있어요.', '강변 캠핑지에서 별을 바라보며 사색하는 고요한 시간이에요.'],
    },
    4: { // 목요일 - 성장
      WOOD:  ['목(木) 기운 + 성장! 나무에 나무 에너지라니, 성장의 시너지가 최고조에요!', '밀림 속 거대한 나무를 올라가듯, 한계를 뛰어넘는 성장의 날이에요!'],
      FIRE:  ['화(火) 기운 + 성장! 햇볕을 받고 자라는 식물처럼 눈에 보이는 성장을 느낄 수 있어요.', '뜨거운 도전 속에서 실력이 쑥쑥 느는 날이에요!'],
      EARTH: ['토(土) 기운 + 성장! 비옥한 토양에서 뿌리를 내리듯 차근차근 성장하는 날이에요.', '산길을 한 걸음씩 꾸준히 오르면 어느새 높이 올라와 있을 거예요.'],
      METAL: ['금(金) 기운 + 성장! 강철을 벼리듯 자기 단련을 통해 더 강해지는 날이에요.', '암벽 등반처럼 도전적이지만, 정복 후의 성취감이 크래요!'],
      WATER: ['수(水) 기운 + 성장! 물이 나무를 키우듯, 내면의 지혜가 성장을 이끌어주는 날이에요.', '깊은 바다 다이빙처럼 내면 깊숙이 성장의 보물을 발견할 수 있어요.'],
    },
    5: { // 금요일 - 수확
      WOOD:  ['목(木) 기운 + 수확! 나무에 열매가 맺히듯, 이번 주 여행에서 얻은 보물이 빛나는 날이에요.', '풍성한 과수원을 발견한 것처럼 달콤한 성과를 거둘 수 있어요!'],
      FIRE:  ['화(火) 기운 + 수확! 태양 아래 과일이 익듯, 뜨거운 노력의 달콤한 보상이 찾아와요.', '화려한 일몰처럼 감동적인 마무리가 기다리고 있어요!'],
      EARTH: ['토(土) 기운 + 수확! 대지에서 수확하는 것처럼 안정적이고 든든한 보답이 돌아오는 날이에요.', '풍성한 로컬 마켓에서 보물을 가득 장바구니에 담는 것 같아요!'],
      METAL: ['금(金) 기운 + 수확! 금빛으로 빛나는 트로피를 받는 것 같은 날이에요.', '보석 광산에서 빛나는 보석을 발견한 것처럼 값진 성과가 있어요!'],
      WATER: ['수(水) 기운 + 수확! 시냇물이 바다에 도착하듯, 여정의 끝에서 깊은 만족감을 느끼는 날이에요.', '진주를 품은 조개를 발견한 것처럼 내면의 풍요로움을 느낄 수 있어요!'],
    },
    6: { // 토요일 - 정비
      WOOD:  ['목(木) 기운 + 정비! 숲속 오두막에서 여행 장비를 점검하는 여유로운 시간이에요.', '나무 그늘 아래서 배낭을 내려놓고 편안히 쉬어가세요.'],
      FIRE:  ['화(火) 기운 + 정비! 따뜻한 벽난로 앞에서 장비를 말리며 쉬는 것처럼 포근한 날이에요.', '캠프파이어 옆에서 다음 여행 계획을 세우기 딱 좋아요!'],
      EARTH: ['토(土) 기운 + 정비! 토요일에 토의 기운이라니, 최고의 안정감으로 충전할 수 있어요!', '든든한 산장에서 몸과 마음을 완전 충전하는 시간이에요.'],
      METAL: ['금(金) 기운 + 정비! 칼날을 갈듯 장비를 꼼꼼히 손질하면 마음까지 개운해져요.', '깔끔하게 짐을 정리하면 다음 여행이 훨씬 수월해질 거예요!'],
      WATER: ['수(水) 기운 + 정비! 온천에 몸을 담그듯 피로를 씻어내는 완벽한 충전 시간이에요.', '잔잔한 호수처럼 고요히 에너지를 채워가세요.'],
    },
    0: { // 일요일 - 휴식
      WOOD:  ['목(木) 기운 + 휴식! 숲속에서 해먹에 누워 나뭇잎 사이로 하늘을 바라보는 여유로운 시간이에요.', '공원 산책처럼 가볍게 몸을 움직이면 에너지가 되살아나요.'],
      FIRE:  ['화(火) 기운 + 휴식! 꺼지지 않는 작은 캠프파이어처럼 내면의 열정을 조용히 지키는 날이에요.', '좋아하는 취미를 즐기면 여행의 에너지가 가득 차요!'],
      EARTH: ['토(土) 기운 + 휴식! 넓은 들판에 누워 하늘을 바라보며 마음의 평화를 찾는 시간이에요.', '맛있는 현지 음식을 즐기며 몸과 마음을 돌봐주세요!'],
      METAL: ['금(金) 기운 + 휴식! 고요한 사원에서 명상하듯 내면을 가다듬는 시간이에요.', '다음 주 여행 계획을 세우면 알찬 일요일이 될 거예요!'],
      WATER: ['수(水) 기운 + 휴식! 온천에 몸을 맡기듯 천천히 에너지를 채우는 날이에요.', '물을 많이 마시고 충분히 쉬면 다음 주 여행이 훨씬 힘차질 거예요!'],
    },
  };

  const dayAdvices = adviceMap[dayOfWeek]?.[element];
  if (dayAdvices && dayAdvices.length > 0) {
    return rng.pick(dayAdvices);
  }
  return `${elFull(element)}의 기운이 함께하는 여행이에요. ${theme?.travelImage ?? '자기 페이스대로 여행을 즐겨보세요!'}`;
}

/** 일별 여행 가이드 행동 팁 */
const DAILY_TRAVEL_TIP_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '[여행 가이드 팁] 최고의 여행일! 평소 미뤄뒀던 중요한 도전을 오늘 시작하세요. 순풍이 등을 밀어줄 거예요.',
    '[여행 가이드 팁] 가장 가보고 싶었던 목적지로 과감히 출발할 때예요. 용기를 내면 멋진 풍경이 기다려요!',
    '[여행 가이드 팁] 새로운 만남, 중요한 결정, 적극적인 행동 모두 빛을 발하는 날이에요!',
  ],
  4: [
    '[여행 가이드 팁] 좋은 바람이 부는 날이에요. 계획대로 차근차근 전진하면 좋은 성과가 있을 거예요.',
    '[여행 가이드 팁] 가벼운 마음으로 새로운 코스를 시도해보세요. 뜻밖의 즐거움을 발견할 수 있어요.',
    '[여행 가이드 팁] 동행자와 함께하면 더 좋은 결과를 얻을 수 있는 날이에요. 소통에 힘써보세요!',
  ],
  3: [
    '[여행 가이드 팁] 평소대로 꾸준히 걸으면 되는 날이에요. 자기 페이스를 유지하는 것이 최선이에요.',
    '[여행 가이드 팁] 잔잔한 여행일에는 내면을 돌보며 다음 코스를 계획하는 시간으로 활용해보세요.',
    '[여행 가이드 팁] 음악을 들으며 산책하듯 여유롭게 보내면 의외의 영감이 찾아올 수 있어요!',
  ],
  2: [
    '[여행 가이드 팁] 험로 주의! 큰 결정은 내일로 미루고, 오늘은 안전한 코스로 돌아가세요.',
    '[여행 가이드 팁] 서두르지 않는 것이 지혜예요. 한 발짝 물러서 심호흡하면 훨씬 안정될 거예요.',
    '[여행 가이드 팁] 무리한 도전보다 내실을 다지는 하루로 만들면 더 좋은 결과가 기다려요.',
  ],
  1: [
    '[여행 가이드 팁] 베이스캠프에서 쉬어가는 날이에요. 따뜻한 차 한 잔과 함께 자신을 돌봐주세요.',
    '[여행 가이드 팁] 텐트 안에서 독서를 하거나 일찍 잠들면 내일의 여행이 훨씬 상쾌해질 거예요.',
    '[여행 가이드 팁] 충전에 집중하는 것이 진짜 탐험가의 전략이에요. 내일은 또 다른 풍경이 기다려요!',
  ],
};

/** 합충 관계가 없을 때 중립 코멘트 */
const NO_RELATION_TRAVEL_TEMPLATES: readonly string[] = [
  '원국 지지와 특별한 합이나 충이 없어요. 잔잔하고 평화로운 여행 구간이에요.',
  '사주 원국과 충돌하는 기운이 없는 무난한 코스예요. 외부 변수 없이 자기 페이스대로 여행할 수 있어요.',
  '원국 지지와 특별한 관계 없이 독립적으로 흘러가는 날이에요. 자유로운 자유여행처럼 즐겨보세요!',
];

/** 주간 총평 - 좋은 주 */
const WEEKLY_SUMMARY_GOOD_TEMPLATES: readonly string[] = [
  '이번 주는 전반적으로 좋은 날씨가 계속되는 여행이에요! 특히 {{최고요일}}이 최고의 여행일이니, 중요한 탐험은 그날에 집중하세요.',
  '여행 가이드가 자신 있게 추천하는 한 주! {{최고요일}}의 기운이 특히 좋으니, 이 날을 하이라이트 코스로 삼아보세요.',
  '햇살 가득한 여행 일정이에요! {{최고요일}}이 여행의 절정이니, 이 날에 가장 하고 싶은 것을 하세요!',
];

/** 주간 총평 - 보통 주 */
const WEEKLY_SUMMARY_NORMAL_TEMPLATES: readonly string[] = [
  '이번 주는 맑은 날과 흐린 날이 골고루 섞인 여행이에요. {{최고요일}}에 가장 좋은 코스가 있고, {{최저요일}}에는 쉬어가면 좋겠어요.',
  '밸런스 잡힌 여행 코스! {{최고요일}}의 기운을 최대로 활용하고, {{최저요일}}에는 베이스캠프에서 충전하세요.',
  '다양한 풍경의 한 주예요. {{최고요일}}에 집중 탐험, {{최저요일}}에 정비하는 리듬감 있는 여행을 추천해요!',
];

/** 주간 총평 - 주의 주 */
const WEEKLY_SUMMARY_CAUTION_TEMPLATES: readonly string[] = [
  '이번 주는 험로가 좀 있는 여행 코스예요. 하지만 {{최고요일}}처럼 좋은 날도 분명 있으니, 그날을 잘 활용하면 돼요!',
  '약간 도전적인 여행 코스지만 걱정 마세요! {{최고요일}}에 좋은 기운이 오니, 그때 힘을 모아 전진하세요.',
  '무리하지 않는 것이 이번 주의 핵심 전략이에요. {{최고요일}}의 좋은 기운을 잘 활용하고, 나머지 날엔 안전 여행을 하세요.',
];

/** 마무리 문장 */
const CLOSING_TEMPLATES: readonly string[] = [
  '이번 주 7일간의 여행 코스를 모두 안내해드렸어요! 좋은 날에는 적극적으로 나아가고, 험한 날에는 현명하게 쉬어가는 {{이름}}님이 되세요. 여행 가이드가 항상 응원하고 있어요!',
  '7일간의 여행 코스를 미리 알고 떠나면, 어떤 풍경이든 더 잘 즐길 수 있어요. {{이름}}님의 이번 주가 최고의 여행이 되길 바라요!',
  '탐험가에게 가장 중요한 건 "준비"예요. 이번 주의 날씨와 지형을 미리 파악한 {{이름}}님, 이미 절반은 성공한 거예요. 즐거운 한 주 보내세요!',
  '좋은 여행이란 모든 날이 완벽한 것이 아니라, 날씨에 맞게 계획을 세우는 거예요. {{이름}}님의 이번 주 여행이 풍성한 추억으로 가득하길 바라요!',
  '지도와 나침반, 그리고 용기만 있으면 어떤 여행이든 즐길 수 있어요. {{이름}}님, 이번 주도 멋진 탐험이 되길 바랍니다!',
  '자, 이번 주 여행 안내가 끝났어요! 좋은 기운이 오는 날엔 배로 누리고, 조심해야 할 날엔 미리 대비하면 한 주가 훨씬 수월해질 거예요. {{이름}}님, 파이팅!',
];

// =============================================================================
//  메인 생성 함수
// =============================================================================

export function generateWeeklyFortuneSection(input: ReportInput): ReportSection | null {
  // RNG 초기화 (offset 42)
  const rng = createRng(input);
  for (let i = 0; i < 42; i++) rng.next();

  const name = safeName(input);

  // ── 용신 체계 추출 ─────────────────────────────────────────────────────
  const yongEl = (input.saju.yongshin?.element as ElementCode) ?? null;
  const heeEl = (input.saju.yongshin?.heeshin
    ?? (yongEl ? ELEMENT_GENERATED_BY[yongEl] : null)) as ElementCode | null;
  const giEl = (input.saju.yongshin?.gishin as ElementCode) ?? null;
  const guEl = (input.saju.yongshin as unknown as Record<string, unknown> | undefined)?.['gushin'] as ElementCode | null ?? null;
  const hanEl = deriveHansin(yongEl, heeEl, giEl, guEl);

  // ── 일간(日干) 정보 추출 ───────────────────────────────────────────────
  const dayMasterStem = input.saju.dayMaster?.stem ?? '';
  const dayMasterElement = (input.saju.dayMaster?.element ?? 'WOOD') as ElementCode;
  const dayMasterPolarity = input.saju.dayMaster?.polarity ?? 'YANG';
  const dmStemInfo = lookupStemInfo(dayMasterStem);
  const dmYinYang = dmStemInfo?.yinYang ?? dayMasterPolarity;

  // ── 원국 4주 지지 추출 ──────────────────────────────────────────────────
  const pillarNames = ['연주', '월주', '일주', '시주'] as const;
  const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
  const originalBranches: { index: number; pillarName: string; hangul: string }[] = [];

  for (let pi = 0; pi < 4; pi++) {
    const pillar = input.saju.pillars?.[pillarKeys[pi]];
    if (pillar?.branch) {
      const branchInfo = lookupBranchInfo(pillar.branch.code) ?? lookupBranchInfo(pillar.branch.hangul);
      if (branchInfo) {
        originalBranches.push({ index: branchInfo.index, pillarName: pillarNames[pi], hangul: branchInfo.hangul });
      }
    }
  }

  // ── 오늘 날짜 결정 & 7일 일진 산출 ─────────────────────────────────────
  const today = input.today ?? new Date();
  const dailyEntries: DailyFortuneEntry[] = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + dayOffset);

    const jd = dateToJulianDay(targetDate);
    const ganzhiIdx = julianDayToGanzhiIndex(jd);
    const ganzhi = GANZHI_60[ganzhiIdx];

    const stemEl = ganzhi.stem.element;
    const branchEl = ganzhi.branch.element;
    const stemYY = ganzhi.stem.yinYang;
    const branchYY = ganzhi.branch.yinYang;

    const tenGodStem = computeTenGod(dayMasterElement, dmYinYang, stemEl, stemYY);
    const tenGodBranch = computeTenGod(dayMasterElement, dmYinYang, branchEl, branchYY);
    const grade = yongEl
      ? getYongshinMatchGrade(stemEl, yongEl, heeEl, hanEl, guEl, giEl)
      : (3 as YongshinMatchGrade);
    const relations = checkBranchRelations(ganzhi.branchIndex, originalBranches);

    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');

    dailyEntries.push({
      date: targetDate,
      dayOfWeek: targetDate.getDay(),
      ganzhiIndex: ganzhiIdx,
      stemHangul: ganzhi.stem.hangul,
      branchHangul: ganzhi.branch.hangul,
      stemHanja: ganzhi.stem.hanja,
      branchHanja: ganzhi.branch.hanja,
      stemElement: stemEl,
      branchElement: branchEl,
      stemYinYang: stemYY,
      branchYinYang: branchYY,
      tenGodStem,
      tenGodBranch,
      yongshinGrade: grade,
      relations,
      dateStr: `${yyyy}-${mm}-${dd}`,
    });
  }

  // ── 통계 산출 ──────────────────────────────────────────────────────────
  let bestGrade = 0;
  let worstGrade = 6;
  let bestIdx = 0;
  let worstIdx = 0;
  let gradeSum = 0;

  for (let i = 0; i < dailyEntries.length; i++) {
    const g = dailyEntries[i].yongshinGrade;
    gradeSum += g;
    if (g > bestGrade) { bestGrade = g; bestIdx = i; }
    if (g < worstGrade) { worstGrade = g; worstIdx = i; }
  }
  const avgGrade = gradeSum / 7;

  // ── 보고서 구성 시작 ──────────────────────────────────────────────────

  const paragraphs: ReportParagraph[] = [];
  const tables: ReportTable[] = [];
  const charts: ReportChart[] = [];
  const highlights: ReportHighlight[] = [];
  const subsections: ReportSubsection[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 1: 도입부 -- 여행 가이드 인사
  // ─────────────────────────────────────────────────────────────────────────

  paragraphs.push(positive(
    pickAndFill(rng, SECTION_INTRO_TEMPLATES, { 이름: name }),
  ));

  // 일진 개념 설명 (여행 비유)
  paragraphs.push(narrative(rng.pick(DAY_EXPLAIN_TEMPLATES)));

  // 용신 안내 (여행 동반자 비유)
  if (yongEl) {
    paragraphs.push(tip(
      pickAndFill(rng, YONGSHIN_TRAVEL_TEMPLATES, { 이름: name, 용신오행: elFull(yongEl) }),
      yongEl,
    ));
  }

  // 일간 정보 안내 (여행자 DNA 비유)
  const dayMasterDesc = rng.pick([
    `${name}님의 일간(사주에서 "나"를 나타내는 나침반)은 ${dmStemInfo?.hangul ?? dayMasterStem}${dmStemInfo?.hanja ? `(${dmStemInfo.hanja})` : ''}, ${elFull(dayMasterElement)}의 기운이에요. 매일의 일진이 이 나침반과 만나면서 여행의 십성(나와 세상의 관계)이 결정되는 거예요.`,
    `탐험가에게는 자신만의 나침반이 있는 법이에요. ${name}님의 나침반은 ${dmStemInfo?.hangul ?? dayMasterStem}${dmStemInfo?.hanja ? `(${dmStemInfo.hanja})` : ''} -- ${elFull(dayMasterElement)} 기운이에요. 7일간의 여행에서 이 나침반이 가리키는 방향을 따라가 볼게요.`,
    `${name}님의 여행자 DNA(일간)는 ${dmStemInfo?.hangul ?? dayMasterStem}${dmStemInfo?.hanja ? `(${dmStemInfo.hanja})` : ''}, ${elFull(dayMasterElement)} 기운이에요. 이 일간을 기준으로 매일의 여행지가 어떤 의미를 가지는지 알려드릴게요.`,
  ]);
  paragraphs.push(narrative(dayMasterDesc, dayMasterElement));

  // 원국 지지 안내 (합충 대조 설명)
  if (originalBranches.length > 0) {
    const branchList = originalBranches.map(ob => `${ob.pillarName}: ${ob.hangul}`).join(', ');
    const branchDesc = rng.pick([
      `원국의 4개 지지(${branchList})는 여행 중 만나는 교차로와도 같아요. 매일의 일진 지지가 이 교차로에서 합(合)을 이루면 좋은 동행자를, 충(冲)을 이루면 우회로를 만나는 거예요.`,
      `${name}님의 사주 원국 지지(${branchList})와 매일의 일진 지지가 어떻게 반응하는지도 살펴볼 거예요. 합이면 여행에 든든한 동행자가, 충이면 예상 밖의 우회로가 생기는 셈이에요.`,
      `원국에 있는 지지(${branchList})는 여행의 거점 같은 존재예요. 매일의 일진 지지가 이 거점들과 화합하는지, 충돌하는지에 따라 여행의 분위기가 달라진답니다.`,
    ]);
    paragraphs.push(narrative(branchDesc));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 2: 7일 요약 테이블 -- 여행 노선도
  // ─────────────────────────────────────────────────────────────────────────

  paragraphs.push(emphasis(rng.pick(TABLE_INTRO_TEMPLATES)));

  const summaryTableRows: string[][] = [];
  for (let idx = 0; idx < dailyEntries.length; idx++) {
    const entry = dailyEntries[idx];
    const theme = DAY_OF_WEEK_THEMES[entry.dayOfWeek];
    const ganzi = `${entry.stemHangul}${entry.branchHangul}`;
    const ganziHanja = `${entry.stemHanja}${entry.branchHanja}`;
    const stemElStr = `${elShort(entry.stemElement)}(${elHanja(entry.stemElement)})`;
    const branchElStr = `${elShort(entry.branchElement)}(${elHanja(entry.branchElement)})`;
    const stars = YONGSHIN_GRADE_STARS[entry.yongshinGrade];

    let relationStr = '-';
    if (entry.relations.length > 0) {
      relationStr = entry.relations.map(r => `${r.type}(${r.pillarName})`).join(', ');
    }

    summaryTableRows.push([
      `${idx + 1}코스`,
      `${entry.dateStr} ${theme?.name ?? ''}`,
      `${ganzi}(${ganziHanja})`,
      `${stemElStr} / ${branchElStr}`,
      entry.tenGodStem,
      stars,
      relationStr,
      theme?.travelTheme ?? '',
    ]);
  }

  const summaryTable: ReportTable = {
    title: '이번 주 7일간 여행 노선도',
    headers: ['코스', '날짜', '일진 간지', '천간/지지 오행', '천간 십성', '용신부합도', '원국 합충', '여행 테마'],
    rows: summaryTableRows,
  };
  tables.push(summaryTable);

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 3: 주간 전체 총평 -- 여행 코스 개요
  // ─────────────────────────────────────────────────────────────────────────

  const bestEntry = dailyEntries[bestIdx];
  const worstEntry = dailyEntries[worstIdx];
  const bestTheme = DAY_OF_WEEK_THEMES[bestEntry.dayOfWeek];
  const worstTheme = DAY_OF_WEEK_THEMES[worstEntry.dayOfWeek];
  const bestDayLabel = `${bestEntry.dateStr}(${bestTheme?.name ?? ''})`;
  const worstDayLabel = `${worstEntry.dateStr}(${worstTheme?.name ?? ''})`;

  let weeklySummaryTemplates: readonly string[];
  if (avgGrade >= 3.5) {
    weeklySummaryTemplates = WEEKLY_SUMMARY_GOOD_TEMPLATES;
  } else if (avgGrade >= 2.5) {
    weeklySummaryTemplates = WEEKLY_SUMMARY_NORMAL_TEMPLATES;
  } else {
    weeklySummaryTemplates = WEEKLY_SUMMARY_CAUTION_TEMPLATES;
  }

  paragraphs.push(emphasis(
    pickAndFill(rng, weeklySummaryTemplates, { 최고요일: bestDayLabel, 최저요일: worstDayLabel }),
  ));

  highlights.push({
    label: '이번 주 최고의 여행일',
    value: `${bestDayLabel} ${YONGSHIN_GRADE_STARS[bestEntry.yongshinGrade]}`,
    element: bestEntry.stemElement,
    sentiment: 'good',
  });

  highlights.push({
    label: '이번 주 주의할 날',
    value: `${worstDayLabel} ${YONGSHIN_GRADE_STARS[worstEntry.yongshinGrade]}`,
    element: worstEntry.stemElement,
    sentiment: worstEntry.yongshinGrade <= 2 ? 'caution' : 'neutral',
  });

  const avgGradeText = avgGrade >= 4 ? '최고의 여행 주간' : avgGrade >= 3 ? '좋은 여행 주간' : avgGrade >= 2 ? '보통 여행 주간' : '주의가 필요한 주간';
  highlights.push({
    label: '주간 여행 컨디션',
    value: avgGradeText,
    sentiment: avgGrade >= 3.5 ? 'good' : avgGrade >= 2.5 ? 'neutral' : 'caution',
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 4: 일별 상세 분석 -- 7개 여행 코스 (서브섹션)
  // ─────────────────────────────────────────────────────────────────────────

  paragraphs.push(narrative(
    rng.pick([
      '자, 이제 7개의 여행 코스를 하나씩 자세히 살펴볼게요! 매일의 풍경과 에너지를 미리 알면 여행이 훨씬 알차질 거예요.',
      '이제 각 코스의 상세 가이드를 시작합니다! 7일간의 여행지마다 어떤 풍경과 기운이 기다리고 있는지, 꼼꼼히 안내해 드릴게요.',
      '전체 노선도를 봤으니, 이번엔 코스 하나하나를 자세히 들여다볼 시간이에요. 매일이 하나의 새로운 여행지랍니다!',
      '여행 가이드가 각 코스의 현지 정보를 알려드릴게요. 날씨, 난이도, 추천 활동까지 꼼꼼히 준비했어요!',
    ]),
  ));

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const entry = dailyEntries[dayIdx];
    const theme = DAY_OF_WEEK_THEMES[entry.dayOfWeek];
    const ganzi = `${entry.stemHangul}${entry.branchHangul}`;
    const ganziHanja = `${entry.stemHanja}${entry.branchHanja}`;
    const dayLabel = dayIdx === 0 ? '오늘' : dayIdx === 1 ? '내일' : `${dayIdx}일 후`;

    const subParagraphs: ReportParagraph[] = [];

    // ── 4-1. 코스 헤더 (여행지 소개) ──────────────────────────────────────

    const travelImages = ELEMENT_TRAVEL_IMAGE[entry.stemElement] ?? ELEMENT_TRAVEL_IMAGE['EARTH'];
    const travelImage = rng.pick(travelImages);

    const headerTemplates: readonly string[] = [
      `[${dayIdx + 1}코스] ${entry.dateStr} ${theme?.name ?? ''} -- ${dayLabel}의 여행지는 ${ganzi}(${ganziHanja}), ${travelImage} 코스예요!`,
      `${dayIdx + 1}번째 여행지: ${entry.dateStr} ${theme?.name ?? ''}. 일진 ${ganzi}(${ganziHanja}) -- ${elFull(entry.stemElement)} 기운이 감도는, ${travelImage} 풍경이에요.`,
      `[코스 ${dayIdx + 1}] ${entry.dateStr} ${theme?.name ?? ''} -- ${ganzi}(${ganziHanja}). ${travelImage} 여행이 시작됩니다!`,
    ];
    subParagraphs.push(emphasis(rng.pick(headerTemplates)));

    // ── 4-2. 요일 테마 (여행 메타포) ───────────────────────────────────────

    subParagraphs.push(narrative(
      `${theme?.name ?? '오늘'}의 여행 테마는 "${theme?.travelTheme ?? '탐험'}"이에요. ${theme?.travelImage ?? '새로운 풍경이 기다리고 있어요.'}`,
    ));

    // ── 4-3. 용신 부합도 (여행 컨디션) ─────────────────────────────────────

    const gradeStars = YONGSHIN_GRADE_STARS[entry.yongshinGrade];
    const gradeDesc = YONGSHIN_GRADE_DESC[entry.yongshinGrade];

    const gradeIntroTemplates: readonly string[] = [
      `여행 컨디션: ${gradeStars} (${gradeDesc})`,
      `오늘의 여행 날씨: ${gradeStars} -- ${gradeDesc}!`,
      `코스 난이도: ${gradeStars} (${gradeDesc})`,
    ];

    if (entry.yongshinGrade >= 4) {
      subParagraphs.push(positive(rng.pick(gradeIntroTemplates), entry.stemElement));
    } else if (entry.yongshinGrade <= 2) {
      subParagraphs.push(caution(rng.pick(gradeIntroTemplates), entry.stemElement));
    } else {
      subParagraphs.push(narrative(rng.pick(gradeIntroTemplates), entry.stemElement));
    }

    // 등급별 상세 해석 (여행 컨디션 비유)
    const dailyFortune = rng.pick(GRADE_TRAVEL_TEMPLATES[entry.yongshinGrade]);
    if (entry.yongshinGrade >= 4) {
      subParagraphs.push(positive(dailyFortune, entry.stemElement));
    } else if (entry.yongshinGrade <= 2) {
      subParagraphs.push(caution(dailyFortune, entry.stemElement));
    } else {
      subParagraphs.push(narrative(dailyFortune, entry.stemElement));
    }

    // ── 4-4. 십성 해석 (여행 스타일) ───────────────────────────────────────

    const tenGodMeaning = TEN_GOD_SHORT_MEANING[entry.tenGodStem] ?? '';
    const tenGodKeyword = TEN_GOD_TRAVEL_KEYWORD[entry.tenGodStem] ?? '';

    const tenGodTemplates: readonly string[] = [
      `오늘의 여행 스타일(천간 십성): ${entry.tenGodStem}. ${tenGodMeaning} 오늘의 여행 키워드는 "${tenGodKeyword}"!`,
      `탐험가의 나침반이 가리키는 십성은 ${entry.tenGodStem}이에요. ${tenGodMeaning}`,
      `${entry.tenGodStem} -- ${tenGodMeaning} 오늘은 "${tenGodKeyword}" 테마의 여행이에요.`,
    ];
    subParagraphs.push(narrative(rng.pick(tenGodTemplates)));

    if (entry.tenGodBranch !== entry.tenGodStem) {
      const branchTenGodMeaning = TEN_GOD_SHORT_MEANING[entry.tenGodBranch] ?? '';
      const branchTemplates: readonly string[] = [
        `한편 지지(땅의 기운) 쪽에서는 ${entry.tenGodBranch}의 에너지가 발밑에 흐르고 있어요. ${branchTenGodMeaning}`,
        `여행지의 지형(지지)에서는 ${entry.tenGodBranch}의 기운이 은은하게 깔려 있어요. ${branchTenGodMeaning}`,
        `코스의 지반에서는 ${entry.tenGodBranch}의 에너지가 조용히 작용하고 있어요. ${branchTenGodMeaning}`,
      ];
      subParagraphs.push(narrative(rng.pick(branchTemplates)));
    }

    // ── 4-5. 요일 테마 + 오행 조합 (여행 조언) ────────────────────────────

    const weekdayAdvice = getWeekdayElementTravelAdvice(rng, entry.dayOfWeek, entry.stemElement);

    subParagraphs.push(tip(
      `${theme?.name ?? '오늘'}의 여행 테마 "${theme?.travelTheme ?? '탐험'}" + ${elFull(entry.stemElement)} 기운의 조합: ${weekdayAdvice}`,
    ));

    // ── 4-6. 원국 합충 대조 (여행 이벤트) ──────────────────────────────────

    if (entry.relations.length > 0) {
      for (const rel of entry.relations) {
        const relTemplates = RELATION_TRAVEL_TEMPLATES[rel.type] ?? RELATION_TRAVEL_TEMPLATES['충(冲)'];
        const relComment = rng.pick(relTemplates);
        const filledComment = pickAndFill(rng, [relComment], {
          일지: rel.dailyBranchHangul,
          기둥: rel.pillarName,
          원지: rel.branchHangul,
        });

        if (rel.type === '충(冲)' || rel.type === '형(刑)') {
          subParagraphs.push(caution(filledComment));
        } else {
          subParagraphs.push(positive(filledComment));
        }
      }
    } else {
      subParagraphs.push(narrative(rng.pick(NO_RELATION_TRAVEL_TEMPLATES)));
    }

    // ── 4-7. 오행별 여행 장비 팁 ──────────────────────────────────────────

    const stemEl = entry.stemElement;
    const elColor = ELEMENT_COLOR[stemEl];
    const elDirection = ELEMENT_DIRECTION[stemEl];
    const elNumbers = ELEMENT_NUMBER[stemEl];
    const elTaste = ELEMENT_TASTE[stemEl];
    const elFoods = ELEMENT_FOOD[stemEl];
    const elTime = ELEMENT_TIME[stemEl];
    const foodPick = rng.sample(elFoods ?? [], 2);

    const lifeTipTemplates: readonly string[] = [
      `오늘의 여행 장비: ${elColor} 계열의 옷이나 소품이 행운을 불러와요. 여행 방향은 ${elDirection}, 행운 숫자는 ${elNumbers?.[0]}과(와) ${elNumbers?.[1]}이에요. ${foodPick.length > 0 ? `간식으로 ${foodPick.join('이나 ')}을(를) 챙기면 여행 에너지가 UP!` : ''}`,
      `여행 가이드의 장비 추천: ${elColor} 아이템, ${elDirection} 방향, 숫자 ${elNumbers?.[0]}/${elNumbers?.[1]}. ${elTaste} 계열의 음식이 오늘의 여행 에너지를 보충해줘요!`,
      `오늘의 행운 아이템: ${elColor} 소품, 행운 방향 ${elDirection}, 행운 숫자 ${elNumbers?.[0]}과(와) ${elNumbers?.[1]}. ${foodPick.length > 0 ? `${foodPick.join('이나 ')} 같은 간식도 추천해요!` : ''}`,
    ];
    subParagraphs.push(tip(rng.pick(lifeTipTemplates), stemEl));

    // ── 4-8. 행동 팁 (여행 가이드 조언) ────────────────────────────────────

    const actionTip = rng.pick(DAILY_TRAVEL_TIP_TEMPLATES[entry.yongshinGrade]);
    if (entry.yongshinGrade >= 4) {
      subParagraphs.push(encouraging(actionTip));
    } else if (entry.yongshinGrade <= 2) {
      subParagraphs.push(tip(actionTip));
    } else {
      subParagraphs.push(narrative(actionTip));
    }

    // ── 4-9. 골든타임 (해당 오행의 좋은 시간) ─────────────────────────────

    const bestTimeDesc = rng.pick([
      `오늘의 골든타임은 ${elTime}예요. 중요한 일이 있다면 이 시간대에 여행의 하이라이트를 배치하세요!`,
      `${elFull(stemEl)} 기운이 가장 강한 시간은 ${elTime}이에요. 핵심 활동은 이 시간에 집중하면 좋아요.`,
      `여행 중 가장 빛나는 시간대는 ${elTime}! 이 시간에 가장 중요한 여행 계획을 실행하세요.`,
    ]);
    subParagraphs.push(narrative(bestTimeDesc));

    // ── 4-10. 기신 주의 (해당 날인 경우) ──────────────────────────────────

    if (giEl && entry.stemElement === giEl) {
      const giColor = ELEMENT_COLOR[giEl];
      const giEmoNeg = ELEMENT_EMOTION[giEl]?.negative ?? '';
      subParagraphs.push(caution(
        `[주의] 오늘의 일진 오행이 기신 ${elFull(giEl)}과 같아요! ` +
        `${giColor} 계열은 오늘 여행 장비에서 빼고, ${giEmoNeg}의 감정이 올라올 때는 ` +
        `잠시 멈춰서 깊은 호흡을 하세요.`,
        giEl,
      ));
    }

    // ── 서브섹션 등록 ─────────────────────────────────────────────────────

    const subTitle = `${dayIdx + 1}코스: ${entry.dateStr} ${theme?.name ?? ''} -- ${ganzi}(${ganziHanja}) ${gradeStars}`;
    subsections.push({ title: subTitle, paragraphs: subParagraphs });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 5: 용신 부합도 차트 -- 여행 컨디션 그래프
  // ─────────────────────────────────────────────────────────────────────────

  const chartData: Record<string, number | string> = {};
  for (const entry of dailyEntries) {
    const theme = DAY_OF_WEEK_THEMES[entry.dayOfWeek];
    const label = `${entry.dateStr.slice(5)} ${theme?.name?.slice(0, 1) ?? ''}`;
    chartData[label] = entry.yongshinGrade;
  }

  charts.push({
    type: 'bar',
    title: '7일간 여행 컨디션 (용신 부합도)',
    data: chartData,
    meta: {
      description: '7일간의 일진 용신 부합도를 막대그래프로 표시합니다. 5=최고의 여행일, 1=쉬어가는 날.',
      yAxis: '여행 컨디션',
      maxValue: 5,
      gradeLabels: {
        5: '최고의 여행일',
        4: '좋은 여행일',
        3: '무난한 여행일',
        2: '주의가 필요한 날',
        1: '쉬어가는 날',
      },
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 6: 오행 분포 도넛 차트 -- 여행 풍경 분포
  // ─────────────────────────────────────────────────────────────────────────

  const elementCount: Record<string, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const entry of dailyEntries) {
    elementCount[entry.stemElement] = (elementCount[entry.stemElement] ?? 0) + 1;
  }

  const elementChartData: Record<string, number | string> = {};
  for (const [key, count] of Object.entries(elementCount)) {
    if (count > 0) {
      elementChartData[elFull(key)] = count;
    }
  }

  charts.push({
    type: 'donut',
    title: '7일간 여행 풍경 분포 (천간 오행)',
    data: elementChartData,
    meta: {
      description: '7일 동안의 일진 천간 오행이 어떻게 분포되는지 보여줍니다. 어떤 풍경의 여행지가 많은지 한눈에 알 수 있어요.',
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 7: 십성 분포 테이블 -- 여행 스타일 분석
  // ─────────────────────────────────────────────────────────────────────────

  const tenGodCount: Record<string, number> = {};
  for (const entry of dailyEntries) {
    tenGodCount[entry.tenGodStem] = (tenGodCount[entry.tenGodStem] ?? 0) + 1;
  }

  const tenGodTableRows: string[][] = [];
  for (const [tg, count] of Object.entries(tenGodCount).sort((a, b) => b[1] - a[1])) {
    const meaning = TEN_GOD_SHORT_MEANING[tg] ?? '';
    const keyword = TEN_GOD_TRAVEL_KEYWORD[tg] ?? '';
    tenGodTableRows.push([tg, String(count) + '일', keyword, meaning]);
  }

  if (tenGodTableRows.length > 0) {
    tables.push({
      title: '7일간 여행 스타일 분포 (천간 십성)',
      headers: ['십성', '일수', '여행 키워드', '여행 스타일'],
      rows: tenGodTableRows,
    });
  }

  // 십성 분포 해석
  const mostFreqTenGod = Object.entries(tenGodCount).sort((a, b) => b[1] - a[1])[0];
  if (mostFreqTenGod) {
    const [tg, count] = mostFreqTenGod;
    const tgKeyword = TEN_GOD_TRAVEL_KEYWORD[tg] ?? '';
    const tenGodSummaryTemplates: readonly string[] = [
      `이번 주에 가장 많이 만나는 여행 스타일은 ${tg}(${count}일)이에요! "${tgKeyword}"가 이번 주 여행의 메인 테마라고 볼 수 있어요.`,
      `7일 중 ${count}일이나 ${tg}의 기운이 찾아와요! 이번 주는 "${tgKeyword}" 중심의 여행이 될 거예요.`,
      `이번 주의 주된 여행 에너지는 ${tg}(${count}일 등장)! "${tgKeyword}" 관련해서 좋은 경험을 할 확률이 높아요.`,
    ];
    paragraphs.push(narrative(rng.pick(tenGodSummaryTemplates)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 8: 합충 발생 일자 요약 -- 여행 이벤트 정리
  // ─────────────────────────────────────────────────────────────────────────

  const daysWithRelations = dailyEntries.filter(e => e.relations.length > 0);
  if (daysWithRelations.length > 0) {
    const hapDays = daysWithRelations.filter(e => e.relations.some(r => r.type === '합(合)'));
    const chungDays = daysWithRelations.filter(e => e.relations.some(r => r.type === '충(冲)'));
    const hyeongDays = daysWithRelations.filter(e => e.relations.some(r => r.type === '형(刑)'));

    const relationSummaryParts: string[] = [];

    if (hapDays.length > 0) {
      const hapDates = hapDays.map(d => {
        const th = DAY_OF_WEEK_THEMES[d.dayOfWeek];
        return `${d.dateStr}(${th?.name ?? ''})`;
      }).join(', ');
      relationSummaryParts.push(`합(合) 발생일: ${hapDates} -- 현지 가이드를 만난 것처럼 좋은 동행의 기운이 흘러요!`);
    }

    if (chungDays.length > 0) {
      const chungDates = chungDays.map(d => {
        const th = DAY_OF_WEEK_THEMES[d.dayOfWeek];
        return `${d.dateStr}(${th?.name ?? ''})`;
      }).join(', ');
      relationSummaryParts.push(`충(冲) 발생일: ${chungDates} -- 우회로를 만날 수 있는 날이에요. 유연하게 대처하세요!`);
    }

    if (hyeongDays.length > 0) {
      const hyeongDates = hyeongDays.map(d => {
        const th = DAY_OF_WEEK_THEMES[d.dayOfWeek];
        return `${d.dateStr}(${th?.name ?? ''})`;
      }).join(', ');
      relationSummaryParts.push(`형(刑) 발생일: ${hyeongDates} -- 험로 구간이에요. 인내하면 성장의 기회가 돼요!`);
    }

    if (relationSummaryParts.length > 0) {
      paragraphs.push(emphasis(rng.pick([
        '이번 주 여행 중 원국과의 특별한 이벤트가 발생하는 날을 정리해볼게요!',
        '사주 원국과 합하거나 충돌하는 여행 이벤트가 있는 날이에요!',
        '여행 중 만나는 특별 이벤트! 원국 합충 발생 날짜를 정리했어요:',
      ])));

      for (const part of relationSummaryParts) {
        if (part.includes('충') || part.includes('형')) {
          paragraphs.push(caution(part));
        } else {
          paragraphs.push(positive(part));
        }
      }
    }
  } else {
    paragraphs.push(narrative(rng.pick([
      '이번 주 7일 동안은 원국 지지와 특별한 합충 관계가 없어요! 평화로운 여행 코스가 이어지는 한 주예요.',
      '원국과 충돌하거나 합하는 날이 이번 주에는 없네요! 외부 변수 없이 자기 페이스대로 여행하기 좋은 한 주예요.',
      '이번 주는 원국과의 특별한 합충이 없는 무난한 코스예요. 안정적인 에너지 속에서 자유 여행을 즐기세요!',
    ])));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 9: 오행 에너지 흐름 분석 -- 여행 코스 연결
  // ─────────────────────────────────────────────────────────────────────────

  const elementFlowParts: string[] = [];
  for (let i = 0; i < dailyEntries.length - 1; i++) {
    const curr = dailyEntries[i];
    const next = dailyEntries[i + 1];
    const relation = getElementRelation(curr.stemElement, next.stemElement);
    const currTheme = DAY_OF_WEEK_THEMES[curr.dayOfWeek];
    const nextTheme = DAY_OF_WEEK_THEMES[next.dayOfWeek];

    let flowDesc: string;
    if (relation === 'same') {
      flowDesc = `같은 ${elFull(curr.stemElement)} 풍경이 이어져요`;
    } else if (relation === 'generates') {
      flowDesc = `${elShort(curr.stemElement)}가 ${elShort(next.stemElement)}을 키워주는 순조로운 코스 연결이에요`;
    } else if (relation === 'generated_by') {
      flowDesc = `${elShort(next.stemElement)}가 ${elShort(curr.stemElement)}을 뒷받침해주는 흐름이에요`;
    } else if (relation === 'controls') {
      flowDesc = `${elShort(curr.stemElement)}에서 ${elShort(next.stemElement)}로 급격한 풍경 전환이 있어요`;
    } else {
      flowDesc = `${elShort(next.stemElement)}에서 ${elShort(curr.stemElement)}로의 역동적인 변화가 있어요`;
    }

    elementFlowParts.push(
      `${currTheme?.name ?? ''}(${elShort(curr.stemElement)}) -> ${nextTheme?.name ?? ''}(${elShort(next.stemElement)}): ${flowDesc}`,
    );
  }

  if (elementFlowParts.length > 0) {
    paragraphs.push(emphasis(rng.pick([
      '7일간의 여행 코스가 어떻게 연결되는지 살펴볼게요! 코스 간 흐름이 상생(순조)인지 상극(변화)인지 알면 전체 여행의 리듬을 잡을 수 있어요.',
      '여행 코스 간의 연결을 분석해볼게요. 상생 흐름이면 순조로운 여행이, 상극 흐름이면 역동적인 모험이 될 거예요!',
      '매일의 여행지가 어떻게 이어지는지 오행 릴레이를 살펴보면 이번 주의 전체적인 여행 분위기를 느낄 수 있어요.',
    ])));

    for (const flow of elementFlowParts) {
      paragraphs.push(narrative(flow));
    }

    // 상생 비율 산출
    let sangSaengCount = 0;
    for (let i = 0; i < dailyEntries.length - 1; i++) {
      const rel = getElementRelation(dailyEntries[i].stemElement, dailyEntries[i + 1].stemElement);
      if (rel === 'generates' || rel === 'generated_by' || rel === 'same') {
        sangSaengCount++;
      }
    }
    const sangSaengRatio = sangSaengCount / 6;

    if (sangSaengRatio >= 0.7) {
      paragraphs.push(positive(rng.pick([
        '이번 주는 여행 코스 간 연결이 매우 순조로워요! 마치 잘 설계된 패키지 투어처럼 자연스럽게 흘러가는 한 주예요.',
        '코스 간 흐름이 상생으로 이어지고 있어요! 하루하루가 자연스럽게 다음 날로 연결되는 최상의 여행 일정이에요.',
        '여행 가이드도 감탄하는 상생 코스! 이번 주는 흐름에 몸을 맡기면 자연스럽게 좋은 방향으로 갈 거예요.',
      ])));
    } else if (sangSaengRatio <= 0.3) {
      paragraphs.push(caution(rng.pick([
        '이번 주는 코스 간 풍경 전환이 좀 급격해요. 하지만 다양한 풍경을 경험할 수 있다는 뜻이기도 해요! 유연하게 대처하면 더 풍성한 여행이 될 거예요.',
        '여행 코스 간에 변화가 큰 편이에요. 하지만 진짜 탐험가는 변화 속에서 더 강해지는 법! 차분하게 하루하루를 즐겨보세요.',
        '상극의 에너지가 있지만, 이건 마치 산에서 바다로 이동하는 것처럼 다채로운 경험을 의미해요. 변화를 즐기면 최고의 여행이 될 거예요!',
      ])));
    } else {
      paragraphs.push(narrative(rng.pick([
        '상생과 상극이 적절히 섞인 밸런스 잡힌 여행 코스예요! 순조로운 날과 도전적인 날이 번갈아 오니까 리듬감 있는 여행을 즐길 수 있어요.',
        '이번 주는 평탄한 길과 오르막이 번갈아 나오는 트레킹 코스와 같아요. 다양한 에너지를 경험할 수 있는 알찬 한 주예요!',
        '여행 코스가 다채롭게 구성되어 있어요. 편안한 날엔 즐기고, 도전적인 날엔 성장하는 멋진 여행 주간이 될 거예요.',
      ])));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 10: 종합 여행 전략 가이드
  // ─────────────────────────────────────────────────────────────────────────

  paragraphs.push(emphasis(rng.pick([
    '마지막으로, 이번 주를 알차게 보내기 위한 여행 가이드의 종합 전략을 안내해드릴게요!',
    '이번 주의 여행 에너지를 최대로 활용하는 탐험가 전략을 정리했어요!',
    '7일간의 코스 분석을 바탕으로 한 이번 주 여행 전략이에요!',
  ])));

  // 최고의 날 활용법
  const bestDayGuideTemplates: readonly string[] = [
    `이번 주 최고의 여행일인 ${bestDayLabel}에는 중요한 일을 배치하면 좋겠어요. 면접, 시험, 고백, 새로운 시작 등 큰 이벤트가 있다면 이 날이 최적이에요!`,
    `${bestDayLabel}이 가장 기운이 좋으니, 평소에 도전하기 어려웠던 일을 이 날에 시도해보세요! 순풍이 등을 밀어줄 거예요.`,
    `가장 빛나는 여행일인 ${bestDayLabel}! 새로운 출발이나 큰 결심을 하기에 딱 좋은 타이밍이에요.`,
  ];
  paragraphs.push(positive(rng.pick(bestDayGuideTemplates)));

  // 주의할 날 대비법
  if (worstEntry.yongshinGrade <= 2) {
    const worstDayGuideTemplates: readonly string[] = [
      `${worstDayLabel}에는 무리하지 말고 베이스캠프에서 충전하는 날로 삼으세요. 중요한 결정이나 약속은 다른 날로 옮기는 게 현명해요.`,
      `${worstDayLabel}은 여행 정비의 날로 생각하면 좋겠어요. 충분히 쉬면서 다음 좋은 코스를 준비하세요!`,
      `${worstDayLabel}에는 과격한 활동이나 위험한 도전은 피하고, 안전하고 편안하게 보내는 것을 추천해요.`,
    ];
    paragraphs.push(tip(rng.pick(worstDayGuideTemplates)));
  }

  // 용신 오행 기반 주간 여행 장비 추천
  if (yongEl) {
    const yongColor = ELEMENT_COLOR[yongEl];
    const yongDirection = ELEMENT_DIRECTION[yongEl];
    const yongNumbers = ELEMENT_NUMBER[yongEl];
    const yongFoods = ELEMENT_FOOD[yongEl] ?? [];
    const yongFoodPicks = rng.sample(yongFoods, 3);

    const yongGuideTemplates: readonly string[] = [
      `이번 주 여행 필수 장비: ${yongColor} 계열 옷이나 소품을 배낭에 넣으세요. 행운 방향은 ${yongDirection}, ${yongFoodPicks.length > 0 ? `추천 간식은 ${yongFoodPicks.join(', ')}!` : ''} 행운 숫자는 ${yongNumbers?.[0]}과(와) ${yongNumbers?.[1]}이에요.`,
      `여행 가이드가 추천하는 이번 주 행운 아이템: ${yongColor} 아이템을 가까이 하고, ${yongDirection} 방향이 행운을 불러요. ${yongFoodPicks.length > 0 ? `${yongFoodPicks.join(', ')}을(를) 먹으면 에너지 보충!` : ''} 숫자 ${yongNumbers?.[0]}, ${yongNumbers?.[1]}도 기억하세요!`,
      `한 주 내내 용신 ${elFull(yongEl)}의 기운을 품고 다니면 여행이 더 좋아질 거예요. ${yongColor} 색상, ${yongDirection}, 숫자 ${yongNumbers?.[0]}/${yongNumbers?.[1]}을 생활 속에 녹여보세요!`,
    ];
    paragraphs.push(tip(rng.pick(yongGuideTemplates), yongEl));
  }

  // 기신 주의사항
  if (giEl) {
    const giColor = ELEMENT_COLOR[giEl];
    const giDirection = ELEMENT_DIRECTION[giEl];

    const giGuideTemplates: readonly string[] = [
      `반대로 기신 ${elFull(giEl)}의 기운은 줄이면 좋겠어요. ${giColor} 계열은 좀 줄이고, ${giDirection}에서 오래 머무는 건 피하는 게 좋아요.`,
      `기신 ${elFull(giEl)} 기운이 강한 날(별이 적은 날)에는 특히 ${giColor} 아이템은 배낭에서 빼고, ${giDirection}보다는 다른 방향으로 여행하세요.`,
      `주의할 기운인 기신 ${elFull(giEl)}: ${giColor} 톤은 줄이고, ${giDirection}은 피하면 이번 주 여행이 한결 편안해질 거예요.`,
    ];
    paragraphs.push(caution(rng.pick(giGuideTemplates), giEl));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  섹션 11: 마무리 -- 여행 가이드 인사
  // ─────────────────────────────────────────────────────────────────────────

  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name }),
  ));

  // 면책
  paragraphs.push(narrative(
    '* 주운 분석은 전통 사주명리학의 일진(日辰) 이론에 기반한 참고 자료예요. '
    + '매일의 운세는 수많은 요인이 복합적으로 작용하니, '
    + '여행 가이드의 조언을 참고하면서 주체적인 선택과 노력으로 멋진 한 주를 만들어가세요!',
  ));

  // ─────────────────────────────────────────────────────────────────────────
  //  최종 섹션 반환
  // ─────────────────────────────────────────────────────────────────────────

  return {
    id: 'weeklyFortune',
    title: '주운(週運) -- 이번 주 7일간의 여행',
    subtitle: '7개의 여행 코스로 안내하는 이번 주의 에너지 예보 -- 여행 가이드가 함께해요!',
    paragraphs,
    tables,
    charts,
    highlights,
    subsections,
  };
}
