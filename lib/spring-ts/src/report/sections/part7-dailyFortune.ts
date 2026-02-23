/**
 * part7-dailyFortune.ts -- 일운(日運) + 시운(時運) 분석 섹션
 *
 * PART 7-5: 오늘의 일진(日辰) 간지와 12시진별 시간운을 제공합니다.
 * 페르소나: "오늘의 운세 도우미" -- 오늘 하루와 시간대별 에너지를 가이드
 *
 * 공식:
 *   - 오늘 일진: (JulianDay) % 60  (기준: 2000-01-07 = 甲子 = index 0)
 *   - 12시진 천간: ((일간idx % 5) * 2 + 시지idx) % 10
 *   - 십성: 일간 vs 대상 천간/지지 오행의 관계 + 음양 비교
 *   - 용신부합도: 대상 오행 vs 용신/희신/한신/구신/기신
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
  TenGodCode,
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
  ELEMENT_FOOD,
  ELEMENT_NATURE,
  ELEMENT_EMOTION,
  ELEMENT_ORGAN,
  ELEMENT_GENERATES,
  ELEMENT_GENERATED_BY,
  STEMS,
  BRANCHES,
  STEM_BY_CODE,
  GANZHI_60,
  TEN_GOD_BY_CODE,
  YONGSHIN_GRADE_STARS,
  YONGSHIN_GRADE_DESC,
  getYongshinMatchGrade,
  getElementRelation,
  julianDayToGanzhiIndex,
  type StemInfo,
  type BranchInfo,
  type GanzhiEntry,
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
  type SeededRandom,
} from '../common/sentenceUtils.js';

// =============================================================================
//  상수 & 유틸리티
// =============================================================================

/** 안전하게 이름을 추출 */
function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

/** 오행 전체 표기 (예: '목(木)') */
function elFull(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

/** 오행 짧은 표기 (예: '목') */
function elShort(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

/** 오행 한자 (예: '木') */
function elHanja(c: string | null | undefined): string {
  return c ? (ELEMENT_HANJA[c as ElementCode] ?? c) : '?';
}

// =============================================================================
//  일진/시진 산출 로직
// =============================================================================

/**
 * 그레고리력 날짜 -> 줄리안 일수(Julian Day Number) 변환.
 * 천문학 표준 공식 사용.
 */
function dateToJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * 오늘 날짜의 60갑자 인덱스를 구합니다.
 * 기준: 2000-01-07 = 甲子 (index 0), JD = 2451551
 */
function getDailyGanzhiIndex(today: Date): number {
  const jd = dateToJulianDay(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  return julianDayToGanzhiIndex(jd);
}

/**
 * 12시진 천간 인덱스를 계산합니다.
 * 공식: ((일간idx % 5) * 2 + 시지idx) % 10
 *
 * - 일간idx: 오늘 일진의 천간 인덱스 (0~9)
 * - 시지idx: 시진의 지지 인덱스 (0=子, 1=丑, ..., 11=亥)
 *
 * 이 공식은 전통 오호연원(五虎遁元) 또는 오서기수(五鼠起數) 규칙을
 * 수학적으로 일반화한 것입니다.
 *   甲/己일 → 子시 천간 = 甲(0)
 *   乙/庚일 → 子시 천간 = 丙(2)
 *   丙/辛일 → 子시 천간 = 戊(4)
 *   丁/壬일 → 子시 천간 = 庚(6)
 *   戊/癸일 → 子시 천간 = 壬(8)
 */
function getHourStemIndex(dayStemIndex: number, branchIndex: number): number {
  return ((dayStemIndex % 5) * 2 + branchIndex) % 10;
}

// =============================================================================
//  십성(十神) 계산
// =============================================================================

/**
 * 일간 오행+음양 vs 대상 오행+음양으로 십성 코드를 산출합니다.
 *
 * 십성 결정 규칙:
 *   same element, same yinyang   → 비견(比肩)
 *   same element, diff yinyang   → 겁재(劫財)
 *   I generate, same yinyang     → 식신(食神)
 *   I generate, diff yinyang     → 상관(傷官)
 *   I control, same yinyang      → 편재(偏財)
 *   I control, diff yinyang      → 정재(正財)
 *   controls me, same yinyang    → 편관(偏官)
 *   controls me, diff yinyang    → 정관(正官)
 *   generates me, same yinyang   → 편인(偏印)
 *   generates me, diff yinyang   → 정인(正印)
 */
function computeTenGod(
  dayMasterElement: ElementCode,
  dayMasterYinYang: 'YANG' | 'YIN',
  targetElement: ElementCode,
  targetYinYang: 'YANG' | 'YIN',
): TenGodCode {
  const sameYY = dayMasterYinYang === targetYinYang;
  const rel = getElementRelation(dayMasterElement, targetElement);

  switch (rel) {
    case 'same':
      return sameYY ? 'BI_GYEON' : 'GEOB_JAE';
    case 'generates':
      return sameYY ? 'SIK_SHIN' : 'SANG_GWAN';
    case 'controls':
      return sameYY ? 'PYEON_JAE' : 'JEONG_JAE';
    case 'controlled_by':
      return sameYY ? 'PYEON_GWAN' : 'JEONG_GWAN';
    case 'generated_by':
      return sameYY ? 'PYEON_IN' : 'JEONG_IN';
    default:
      return 'BI_GYEON';
  }
}

/** 십성 코드 -> 한국어 이름 */
function tenGodKorean(code: TenGodCode): string {
  return TEN_GOD_BY_CODE[code]?.korean ?? code;
}

/** 십성 코드 -> 한자 이름 */
function tenGodHanja(code: TenGodCode): string {
  return TEN_GOD_BY_CODE[code]?.hanja ?? code;
}

/** 십성 코드 -> 카테고리 한국어 */
function tenGodCategoryKorean(code: TenGodCode): string {
  const info = TEN_GOD_BY_CODE[code];
  if (!info) return '';
  const catMap: Record<string, string> = {
    friend: '비겁', output: '식상', wealth: '재성',
    authority: '관성', resource: '인성',
  };
  return catMap[info.category] ?? '';
}

// =============================================================================
//  용신 체계 추출
// =============================================================================

interface YongshinSystem {
  yongEl: ElementCode | null;
  heeEl: ElementCode | null;
  giEl: ElementCode | null;
  guEl: ElementCode | null;
  hanEl: ElementCode | null;
}

function extractYongshinSystem(input: ReportInput): YongshinSystem {
  const yongEl = (input.saju.yongshin?.element as ElementCode) ?? null;
  const heeEl = (input.saju.yongshin?.heeshin
    ?? (yongEl ? ELEMENT_GENERATED_BY[yongEl] : null)) as ElementCode | null;
  const giEl = (input.saju.yongshin?.gishin as ElementCode) ?? null;
  const guEl = (input.saju.yongshin?.gushin as ElementCode) ?? null;

  // 한신: 5행 중 나머지
  const allEls: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
  const assigned = new Set<ElementCode | null>([yongEl, heeEl, giEl, guEl]);
  const remaining = allEls.filter(e => !assigned.has(e));
  const hanEl = remaining.length === 1 ? remaining[0] : null;

  return { yongEl, heeEl, giEl, guEl, hanEl };
}

function gradeFor(el: ElementCode, sys: YongshinSystem): YongshinMatchGrade {
  return getYongshinMatchGrade(el, sys.yongEl, sys.heeEl, sys.hanEl, sys.guEl, sys.giEl);
}

// =============================================================================
//  일간(日干) 추출
// =============================================================================

interface DayMasterInfo {
  stemInfo: StemInfo;
  element: ElementCode;
  yinYang: 'YANG' | 'YIN';
}

function extractDayMaster(input: ReportInput): DayMasterInfo | null {
  const dm = input.saju?.dayMaster;
  if (!dm) return null;

  const stemCode = dm.stem;
  const stemInfo = STEM_BY_CODE[stemCode] ?? STEMS.find(s => s.hangul === stemCode);
  if (!stemInfo) return null;

  return {
    stemInfo,
    element: stemInfo.element,
    yinYang: stemInfo.yinYang,
  };
}

// =============================================================================
//  시진별 상세 데이터 구조
// =============================================================================

interface HourlyEntry {
  branchInfo: BranchInfo;
  stemInfo: StemInfo;
  tenGodStem: TenGodCode;
  tenGodBranch: TenGodCode;
  grade: YongshinMatchGrade;
  ganziHangul: string;
  ganziHanja: string;
}

function buildHourlyEntries(
  dayStemIndex: number,
  dayMaster: DayMasterInfo,
  sys: YongshinSystem,
): HourlyEntry[] {
  const entries: HourlyEntry[] = [];
  for (let bi = 0; bi < 12; bi++) {
    const branch = BRANCHES[bi];
    const si = getHourStemIndex(dayStemIndex, bi);
    const stem = STEMS[si];

    const tenGodStem = computeTenGod(
      dayMaster.element, dayMaster.yinYang,
      stem.element, stem.yinYang,
    );
    const tenGodBranch = computeTenGod(
      dayMaster.element, dayMaster.yinYang,
      branch.element, branch.yinYang,
    );

    // 용신부합도는 시 천간의 오행 기준
    const grade = gradeFor(stem.element, sys);

    entries.push({
      branchInfo: branch,
      stemInfo: stem,
      tenGodStem,
      tenGodBranch,
      grade,
      ganziHangul: `${stem.hangul}${branch.hangul}`,
      ganziHanja: `${stem.hanja}${branch.hanja}`,
    });
  }
  return entries;
}

// =============================================================================
//  문장 템플릿 -- "오늘의 운세 도우미" 페르소나
// =============================================================================

const SECTION_INTRO_TEMPLATES: readonly string[] = [
  '{{이름}}님, 안녕하세요! 오늘 하루를 알차게 보내기 위한 특별한 시간표를 가져왔어요. 오늘 하루의 기운과 시간대별 에너지를 함께 살펴볼게요!',
  '매일매일이 다른 기운을 담고 있다는 거 알고 있나요? 오늘 {{이름}}님에게 어떤 에너지가 흐르는지, "오늘의 운세 도우미"가 친절하게 안내해 드릴게요!',
  '하루에도 여러 번 기운이 바뀐다는 사실, 알고 계셨나요? 오늘의 일진을 확인하고, 12시진별로 가장 좋은 타이밍을 잡아볼게요!',
  '{{이름}}님의 하루를 더 빛나게 해줄 시간표가 준비되었어요! 오늘의 일진과 시간대별 기운을 분석해서 최적의 타이밍을 알려드릴게요.',
  '오늘 하루, 어떤 에너지가 {{이름}}님 곁에 머무를까요? 일진과 시진 분석으로 하루를 알차게 계획해 보는 시간이에요!',
  '{{이름}}님만을 위한 "오늘의 시간표"가 도착했어요! 하루 중 언제 에너지가 가장 높은지, 언제 쉬어야 하는지 함께 알아볼까요?',
];

const DAILY_PILLAR_INTRO_TEMPLATES: readonly string[] = [
  '오늘의 일진(日辰)은 {{간지한글}}({{간지한자}})이에요! {{천간오행}} 기운의 {{천간한글}}과 {{지지오행}} 기운의 {{지지한글}}이 만난 날이에요.',
  '자, 오늘의 간지를 공개합니다! {{간지한글}}({{간지한자}}) -- {{천간오행}}의 {{천간한글}}과 {{지지오행}}의 {{지지한글}}이 하루를 이끌어요.',
  '오늘은 60갑자 중에서 {{간지한글}}({{간지한자}})이 돌아온 날이에요. 하늘에서는 {{천간오행}}({{천간한글}}), 땅에서는 {{지지오행}}({{지지한글}})의 기운이 흐르고 있어요.',
  '오늘의 일진은 {{간지한글}}({{간지한자}})! {{천간오행}} 에너지의 {{천간한글}}(천간)과 {{지지오행}} 에너지의 {{지지한글}}(지지)이 함께하는 하루예요.',
];

/** 오행별 하루 이미지 */
const DAILY_ELEMENT_IMAGE: Record<string, string> = {
  WOOD: '나무가 쑥쑥 자라듯 성장과 시작의 에너지가 가득한 하루',
  FIRE: '불꽃처럼 뜨겁고 열정적인 에너지가 넘치는 하루',
  EARTH: '대지처럼 든든하고 안정적인 기운이 감도는 하루',
  METAL: '쇠처럼 단단하고 결단력 있는 기운이 흐르는 하루',
  WATER: '물처럼 유연하고 지혜로운 기운이 흐르는 하루',
};

/** 십성별 하루 해석 */
const TEN_GOD_DAILY_MEANING: Record<TenGodCode, string> = {
  BI_GYEON: '나와 비슷한 기운이 흐르는 날이에요. 자신감이 높아지고, 동료나 친구와 힘을 합치면 시너지가 좋아요.',
  GEOB_JAE: '경쟁 에너지가 느껴지는 날이에요. 의욕이 샘솟지만, 남과 비교하기보다 내 페이스를 유지하는 게 좋아요.',
  SIK_SHIN: '재능과 표현력이 빛나는 날이에요. 먹을 복도 좋으니 맛있는 걸 먹으면서 창의적인 활동을 해보세요!',
  SANG_GWAN: '창의력과 아이디어가 폭발하는 날이에요. 예술적 감각이 살아나지만, 말실수를 조심하세요.',
  PYEON_JAE: '뜻밖의 재물 기회가 올 수 있는 날이에요. 사교 활동이 좋고, 새로운 사람과의 만남에서 행운이 올 수 있어요.',
  JEONG_JAE: '차곡차곡 모으는 재물운이 좋은 날이에요. 알뜰하게 관리하고 계획적으로 지출하면 좋은 결과가 있어요.',
  PYEON_GWAN: '약간의 긴장감과 압박이 느껴질 수 있는 날이에요. 규칙을 잘 지키고 무리하지 않으면 오히려 성장하는 기회가 돼요.',
  JEONG_GWAN: '질서와 명예가 빛나는 날이에요. 공식적인 자리나 윗사람과의 만남에서 좋은 인상을 줄 수 있어요.',
  PYEON_IN: '직감과 영감이 살아나는 날이에요. 새로운 것을 배우거나 특별한 아이디어를 떠올리기 좋아요.',
  JEONG_IN: '학습과 성장의 에너지가 높은 날이에요. 공부나 자격증 준비, 독서에 좋은 날이에요.',
};

/** 용신부합도 등급별 하루 운세 해석 */
const GRADE_DAILY_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '용신의 기운이 가득한 최고의 날이에요! 무엇을 하든 순풍에 돛을 단 것처럼 술술 풀릴 거예요.',
    '오늘은 {{이름}}님에게 딱 맞는 기운이 흐르는 날이에요. 중요한 일을 하기에 더없이 좋답니다!',
    '하늘의 기운이 {{이름}}님 편인 날이에요! 자신감을 갖고 적극적으로 행동해 보세요.',
    '용신과 딱 맞는 에너지가 오늘 하루를 감싸고 있어요. 운이 따르는 만큼 주도적으로 움직여 보세요!',
  ],
  4: [
    '희신의 기운이 도와주는 좋은 날이에요! 계획했던 일을 추진하면 좋은 성과를 거둘 수 있어요.',
    '오늘은 기분 좋은 에너지가 흐르는 날이에요. 밝은 마음으로 하루를 시작하면 좋은 일이 생길 거예요.',
    '좋은 기운이 {{이름}}님을 응원하고 있어요. 새로운 시도나 만남에 열린 마음을 가져보세요!',
    '희신의 바람이 살랑살랑 불어오는 상쾌한 날이에요. 무난하면서도 기분 좋은 하루가 될 거예요.',
  ],
  3: [
    '보통 수준의 기운이 흐르는 무난한 날이에요. 특별히 좋지도 나쁘지도 않으니 꾸준히 노력하면 돼요.',
    '평온한 에너지의 날이에요. 무리하지 않고 자기 페이스대로 하루를 보내면 충분해요.',
    '잔잔한 기운의 하루예요. 큰 모험보다는 일상을 차분히 챙기는 게 좋겠어요.',
    '중립적인 에너지가 흐르는 날이에요. 특별한 변화보다는 루틴을 잘 지키면 알찬 하루가 돼요.',
  ],
  2: [
    '조금 주의가 필요한 날이에요. 큰 결정은 가급적 미루고, 차분하게 일상을 보내는 것이 좋아요.',
    '기운이 약간 어긋나는 느낌이 들 수 있는 날이에요. 무리하지 말고 여유를 가져보세요.',
    '약간의 역풍이 불 수 있는 하루예요. 서두르지 않고 한 발짝 물러서 생각하면 괜찮아요.',
    '조심스럽게 다뤄야 할 에너지가 흐르는 날이에요. 감정 조절에 신경 쓰면 무사히 넘길 수 있어요.',
  ],
  1: [
    '에너지가 다소 거칠 수 있는 날이에요. 건강 관리에 신경 쓰고, 중요한 약속은 가능하면 다른 날로 미루세요.',
    '오늘은 조용히 내면을 돌보는 날로 삼으면 좋겠어요. 무리한 일정은 피하고 충분히 쉬어주세요.',
    '기운이 맞지 않는 날이지만 걱정하지 마세요. 이런 날일수록 기본에 충실하고 편안히 보내면 돼요.',
    '오늘 하루가 조금 힘들게 느껴질 수도 있어요. 하지만 내일은 또 다른 기운이 오니까 오늘은 쉬어가는 날로 삼아요!',
  ],
};

/** 시진별 생활 조언 (12시진 각각에 대한 풍부한 조언) */
const HOURLY_ADVICE: Record<string, readonly string[]> = {
  JA: [
    '자시(子時)는 하루의 시작이자 가장 고요한 시간이에요. 충분히 숙면을 취하면 내일 하루가 달라져요.',
    '이 시간에는 깊은 잠으로 몸과 마음을 재충전하는 것이 가장 좋아요.',
    '밤 11시~새벽 1시는 신장과 방광이 활발히 일하는 시간이에요. 따뜻한 물 한 잔 마시고 푹 자세요.',
    '자시는 음기가 가장 강한 시간이에요. 명상이나 일기 쓰기로 하루를 마무리하면 좋아요.',
  ],
  CHUK: [
    '축시(丑時)는 간(肝)이 해독 작용을 하는 시간이에요. 이 시간에 깊은 수면을 취하면 피부도 좋아진답니다.',
    '새벽 1시~3시는 소처럼 묵묵히 몸이 회복되는 시간이에요. 잠을 잘 자는 것이 최고의 보약이에요.',
    '이 시간에 깨어 있으면 간에 무리가 가요. 되도록 숙면을 유지하세요.',
    '축시에 충분히 자면 다음 날 컨디션이 확 달라져요. 일찍 잠자리에 드는 것을 추천해요.',
  ],
  IN: [
    '인시(寅時)는 하루의 기운이 움트기 시작하는 시간이에요. 일찍 일어나는 분이라면 가벼운 스트레칭이 좋아요.',
    '새벽 3시~5시는 폐가 활발해지는 시간이에요. 깊은 호흡으로 맑은 공기를 들이마시면 활력이 생겨요.',
    '호랑이의 시간답게, 이른 아침의 싱그러운 기운을 마시며 하루를 준비해 보세요.',
    '인시에 일어나면 "호랑이 기운"을 받는다고 해요. 새벽 운동을 좋아한다면 이 시간이 최적이에요.',
  ],
  MYO: [
    '묘시(卯時)는 아침 해가 뜨는 시간이에요. 상쾌하게 일어나 아침 식사를 챙겨 먹으면 하루가 달라져요.',
    '새벽 5시~7시는 대장이 활성화되는 시간이에요. 규칙적인 배변 습관을 들이기에 좋은 때예요.',
    '토끼처럼 민첩하게 하루를 시작할 시간이에요! 아침 루틴을 만들어 활기차게 출발하세요.',
    '묘시는 양기가 올라오는 시간이에요. 간단한 아침 운동으로 몸을 깨우면 에너지가 샘솟아요.',
  ],
  JIN: [
    '진시(辰時)는 본격적인 활동이 시작되는 시간이에요. 아침 식사 후 중요한 업무를 처리하기 좋아요.',
    '오전 7시~9시는 위장이 활발한 시간이에요. 영양가 있는 아침을 먹으면 하루 종일 에너지가 넘쳐요.',
    '용의 시간이니만큼, 큰 계획을 세우고 의욕적으로 하루를 시작해 보세요!',
    '진시에 받는 아침 햇살은 비타민 D도 충전해줘요. 창문을 활짝 열고 햇빛을 맞아보세요.',
  ],
  SA: [
    '사시(巳時)는 두뇌가 가장 맑은 시간대예요. 집중력이 필요한 공부나 업무를 하기에 최적이에요.',
    '오전 9시~11시는 비장이 활발한 시간이에요. 에너지가 가장 잘 순환하는 때라 중요한 일을 처리하세요.',
    '뱀의 시간은 지혜를 상징해요. 머리가 가장 잘 돌아가는 이 시간에 핵심 업무를 끝내 보세요!',
    '사시에 커피 한 잔과 함께 집중 타임을 가져보세요. 놀라울 만큼 효율이 좋을 거예요.',
  ],
  O: [
    '오시(午時)는 태양이 가장 높이 뜬 시간이에요. 양기가 최고조에 달하니 활발한 활동이 좋아요.',
    '오전 11시~오후 1시는 심장이 활발한 시간이에요. 적당한 활동 후 점심을 잘 챙겨 먹으세요.',
    '말(午)의 시간답게 에너지가 넘쳐요! 단, 너무 무리하지 말고 점심 후 잠깐의 휴식도 챙기세요.',
    '오시는 양기의 정점이에요. 사교 활동이나 회의에 좋은 시간이에요. 밝은 에너지를 나눠보세요.',
  ],
  MI: [
    '미시(未時)는 오후의 나른함이 찾아오는 시간이에요. 무리하지 말고 가벼운 산책으로 기분 전환해 보세요.',
    '오후 1시~3시는 소장이 활발한 시간이에요. 소화가 잘 되도록 천천히 식사하고 잠깐 쉬어가세요.',
    '양의 시간은 온순함과 안정을 상징해요. 격렬한 활동보다는 차분한 업무가 어울리는 시간이에요.',
    '미시에 짧은 낮잠(15~20분)을 자면 오후 컨디션이 확 좋아져요. 파워 냅을 추천해요!',
  ],
  SIN_BRANCH: [
    '신시(申時)는 오후 활력이 다시 올라오는 시간이에요. 운동이나 활동적인 취미를 즐기기 좋아요.',
    '오후 3시~5시는 방광이 활발한 시간이에요. 충분히 수분을 섭취하고 가벼운 운동을 해보세요.',
    '원숭이의 시간답게 재치와 기민함이 살아나는 때예요. 창의적인 작업에 도전해 보세요!',
    '신시에 잠시 책상을 떠나 스트레칭이나 산책을 하면 남은 오후가 훨씬 상쾌해져요.',
  ],
  YU: [
    '유시(酉時)는 하루의 마무리를 시작할 시간이에요. 저녁 식사를 준비하고 마음을 편안히 하세요.',
    '오후 5시~7시는 신장이 활발한 시간이에요. 업무를 정리하고 퇴근 후 여유를 즐겨보세요.',
    '닭의 시간은 귀가(歸家)의 시간이에요. 하루의 성과를 돌아보며 보람을 느껴보세요.',
    '유시에 가벼운 저녁 운동이나 산책을 하면 하루의 피로가 싹 풀려요.',
  ],
  SUL: [
    '술시(戌時)는 하루를 정리하는 시간이에요. 가족이나 소중한 사람과 따뜻한 시간을 보내세요.',
    '오후 7시~9시는 심포(心包)가 활발한 시간이에요. 마음이 편안해지는 활동이 좋아요.',
    '개의 시간은 충성과 따뜻함을 상징해요. 사랑하는 사람과 대화하며 하루를 마무리하세요.',
    '술시에 따뜻한 차 한 잔과 함께 내일 할 일을 간단히 정리하면 마음이 편안해져요.',
  ],
  HAE: [
    '해시(亥時)는 하루의 끝, 다음 날을 위한 준비 시간이에요. 일찍 잠자리에 들어 충분히 쉬세요.',
    '밤 9시~11시는 삼초(三焦)가 활발한 시간이에요. 과식이나 야식을 피하고 편안히 쉬는 것이 좋아요.',
    '돼지의 시간은 풍요와 쉼을 상징해요. 하루의 긴장을 풀고 따뜻한 물로 목욕하면 숙면에 좋아요.',
    '해시에 스마트폰을 멀리하고 조용한 독서나 명상을 하면 수면의 질이 확 높아져요.',
  ],
};

/** 시간대별 추천 활동 */
const HOURLY_ACTIVITY: Record<string, string> = {
  JA: '숙면, 명상, 일기 쓰기',
  CHUK: '숙면, 피부 관리, 해독',
  IN: '새벽 운동, 스트레칭, 호흡법',
  MYO: '아침 식사, 산책, 루틴 실행',
  JIN: '중요 업무 시작, 회의, 계획 수립',
  SA: '집중 업무, 공부, 창작 활동',
  O: '사교 활동, 점심 식사, 활발한 토론',
  MI: '가벼운 산책, 낮잠, 차분한 업무',
  SIN_BRANCH: '운동, 취미 활동, 창의적 작업',
  YU: '퇴근 루틴, 저녁 식사, 여유 시간',
  SUL: '가족 시간, 독서, 내일 계획',
  HAE: '목욕, 스트레칭, 잠자리 준비',
};

/** 용신부합도별 시간대 조언 접두사 */
const HOURLY_GRADE_PREFIX: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '이 시간대는 금상첨화(錦上添花)! 최고의 에너지를 활용하세요.',
    '최고의 기운이 감도는 시간이에요. 중요한 일은 이 시간에!',
    '용신의 기운이 가득한 골든타임이에요!',
  ],
  4: [
    '좋은 에너지가 흐르는 시간이에요. 활발하게 움직여 보세요.',
    '기분 좋은 기운이 도와주는 시간대예요.',
    '긍정적인 에너지를 느낄 수 있는 시간이에요.',
  ],
  3: [
    '무난하게 보내기 좋은 시간이에요.',
    '평온한 기운의 시간대예요. 일상적인 활동이 좋아요.',
    '안정적인 에너지가 흐르는 시간이에요.',
  ],
  2: [
    '이 시간대는 조금 주의가 필요해요. 무리하지 마세요.',
    '에너지가 살짝 어긋나는 시간이에요. 여유를 가지세요.',
    '주의가 필요한 시간대예요. 감정 조절에 신경 쓰세요.',
  ],
  1: [
    '이 시간대는 조용히 쉬는 것이 가장 좋아요.',
    '무리한 활동은 피하고 마음을 편안히 가지세요.',
    '기운이 맞지 않는 시간이에요. 중요한 결정은 삼가세요.',
  ],
};

/** 마무리 템플릿 */
const CLOSING_TEMPLATES: readonly string[] = [
  '오늘 하루도 {{이름}}님에게 최고의 날이 되길 바라요! 좋은 시간대에 힘을 모으고, 쉬어야 할 때 쉬면 하루가 훨씬 알찬 거랍니다.',
  '{{이름}}님, 시간대별 에너지를 참고하면 하루를 더 효율적으로 보낼 수 있어요. 오늘도 파이팅!',
  '일진과 시진을 안다는 건, 하루라는 바다에서 나침반을 가진 것과 같아요. {{이름}}님의 오늘이 빛나는 하루가 되길 응원해요!',
  '기운이 좋을 때 열심히, 기운이 약할 때 쉬어가는 것 -- 그것이 하루를 지혜롭게 보내는 비결이에요. {{이름}}님, 멋진 하루 보내세요!',
  '오늘의 운세는 참고일 뿐, 진짜 하루를 만드는 건 {{이름}}님의 선택과 노력이에요. 자신을 믿고 즐거운 하루 보내세요!',
  '{{이름}}님의 오늘이 용신의 기운처럼 밝고 따뜻하길 바라요. 시간대별 조언을 참고해서 최고의 하루를 만들어 보세요!',
];

/** 일진과 나(일간)의 관계 설명 */
const DAY_MASTER_RELATION_TEMPLATES: Record<string, readonly string[]> = {
  same: [
    '오늘은 일간과 같은 오행의 기운이 흐르는 날이에요. 나 자신의 에너지가 강해지는 느낌이 들 거예요.',
    '내 일간과 같은 기운이라서 자신감이 높아지고, 주체적으로 행동하기 좋은 날이에요.',
  ],
  generates: [
    '오늘의 일진 오행은 내 일간이 생(生)하는 기운이에요. 내 에너지가 밖으로 표현되기 좋은 날이에요.',
    '일간에서 에너지가 흘러나가는 관계라, 창의적인 활동이나 표현에 좋지만 체력 관리에도 신경 쓰세요.',
  ],
  generated_by: [
    '오늘의 일진은 나를 생해주는 기운이에요. 도움을 받거나 배움이 있는 하루가 될 수 있어요.',
    '나에게 힘을 실어주는 기운이 흐르는 날이에요. 자기 계발이나 학습에 특히 좋아요.',
  ],
  controls: [
    '오늘은 내 일간이 극(剋)하는 기운의 날이에요. 재물이나 성과와 관련된 일에 힘이 실릴 수 있어요.',
    '내가 통제할 수 있는 기운이 흐르는 날이에요. 적극적으로 목표를 향해 나아가 보세요.',
  ],
  controlled_by: [
    '오늘의 기운은 내 일간을 극하는 관계예요. 약간의 압박이 느껴질 수 있지만 성장의 기회이기도 해요.',
    '나를 제어하는 기운이 흐르는 날이에요. 겸손하게 받아들이고, 무리하지 않으면 좋은 배움이 있어요.',
  ],
};

/** 십성 해석 보충 문장 */
const TEN_GOD_SUPPLEMENT: Record<string, readonly string[]> = {
  friend: [
    '비겁 계열의 에너지가 흐르는 날이에요. 혼자보다 여럿이 함께하면 시너지가 좋아요.',
    '동료, 친구, 형제와 관련된 일에 좋은 기운이 흐르는 날이에요.',
  ],
  output: [
    '식상 계열의 에너지가 흐르는 날이에요. 자기 표현, 창작, 발표에 좋은 기운이에요.',
    '재능이 빛을 발하는 날이에요. 먹을 복도 좋으니 맛있는 걸 챙겨 먹으세요!',
  ],
  wealth: [
    '재성 계열의 에너지가 흐르는 날이에요. 금전 관련 일에 긍정적인 기운이 있어요.',
    '재물운이 활성화되는 에너지예요. 알뜰한 소비와 합리적인 투자에 좋은 날이에요.',
  ],
  authority: [
    '관성 계열의 에너지가 흐르는 날이에요. 직장이나 공식적인 자리에서 존재감을 보일 수 있어요.',
    '질서와 규율의 기운이 흐르는 날이에요. 약속을 잘 지키고 원칙에 충실하면 좋은 결과가 있어요.',
  ],
  resource: [
    '인성 계열의 에너지가 흐르는 날이에요. 공부, 배움, 자격증 관련 일에 좋은 기운이에요.',
    '학문과 성장의 에너지가 넘치는 날이에요. 새로운 지식을 습득하기 딱 좋은 때예요.',
  ],
};

// =============================================================================
//  서브섹션 빌더
// =============================================================================

/** 오늘 일진 분석 서브섹션 */
function buildDailyPillarSubsection(
  rng: SeededRandom,
  name: string,
  dailyGanzhi: GanzhiEntry,
  dayMaster: DayMasterInfo,
  sys: YongshinSystem,
  today: Date,
): { paragraphs: ReportParagraph[]; highlights: ReportHighlight[] } {
  const paragraphs: ReportParagraph[] = [];
  const highlights: ReportHighlight[] = [];

  const dStem = dailyGanzhi.stem;
  const dBranch = dailyGanzhi.branch;
  const dailyStemEl = dStem.element;
  const dailyBranchEl = dBranch.element;
  const ganziHangul = `${dStem.hangul}${dBranch.hangul}`;
  const ganziHanja = `${dStem.hanja}${dBranch.hanja}`;

  // 날짜 포맷
  const yr = today.getFullYear();
  const mo = today.getMonth() + 1;
  const da = today.getDate();
  const dateStr = `${yr}년 ${mo}월 ${da}일`;

  // 일진 소개
  paragraphs.push(emphasis(
    pickAndFill(rng, DAILY_PILLAR_INTRO_TEMPLATES, {
      간지한글: ganziHangul,
      간지한자: ganziHanja,
      천간오행: elFull(dailyStemEl),
      천간한글: dStem.hangul,
      지지오행: elFull(dailyBranchEl),
      지지한글: dBranch.hangul,
    }),
  ));

  // 날짜 정보
  paragraphs.push(narrative(
    `오늘은 ${dateStr}이에요. 60갑자 중 ${dailyGanzhi.index + 1}번째인 ${ganziHangul}(${ganziHanja})일이에요.`,
  ));

  // 오행 이미지
  const dailyImage = DAILY_ELEMENT_IMAGE[dailyStemEl] ?? '특별한 기운이 흐르는 하루';
  paragraphs.push(narrative(
    `오늘의 천간 오행은 ${elFull(dailyStemEl)}이에요. ${dailyImage}예요.`,
    dailyStemEl,
  ));

  // 일간과의 관계 분석
  const dayMasterEl = dayMaster.element;
  const relation = getElementRelation(dayMasterEl, dailyStemEl);
  const relTemplates = DAY_MASTER_RELATION_TEMPLATES[relation] ?? DAY_MASTER_RELATION_TEMPLATES['same'];
  paragraphs.push(narrative(
    `${name}님의 일간 ${elFull(dayMasterEl)}과(와) 오늘의 일진 ${elFull(dailyStemEl)}의 관계를 볼게요. ` +
    rng.pick(relTemplates),
    dayMasterEl,
  ));

  // 십성 분석
  const tenGodStem = computeTenGod(
    dayMaster.element, dayMaster.yinYang,
    dStem.element, dStem.yinYang,
  );
  const tenGodBranch = computeTenGod(
    dayMaster.element, dayMaster.yinYang,
    dBranch.element, dBranch.yinYang,
  );

  const tgStemKo = tenGodKorean(tenGodStem);
  const tgStemHanja = tenGodHanja(tenGodStem);
  const tgBranchKo = tenGodKorean(tenGodBranch);
  const tgBranchHanja = tenGodHanja(tenGodBranch);

  paragraphs.push(narrative(
    `오늘 일진의 천간 ${dStem.hangul}(${dStem.hanja})은(는) ${name}님 기준으로 ${tgStemKo}(${tgStemHanja})에 해당해요. ` +
    `지지 ${dBranch.hangul}(${dBranch.hanja})은(는) ${tgBranchKo}(${tgBranchHanja})이에요.`,
  ));

  // 십성 상세 해석
  const tgMeaning = TEN_GOD_DAILY_MEANING[tenGodStem];
  paragraphs.push(tip(tgMeaning, dStem.element));

  // 십성 카테고리 보충
  const tgInfo = TEN_GOD_BY_CODE[tenGodStem];
  if (tgInfo) {
    const catSupp = TEN_GOD_SUPPLEMENT[tgInfo.category];
    if (catSupp) {
      paragraphs.push(narrative(rng.pick(catSupp), dStem.element));
    }
  }

  // 용신 부합도
  const dailyGrade = gradeFor(dailyStemEl, sys);
  const stars = YONGSHIN_GRADE_STARS[dailyGrade];
  const gradeDesc = YONGSHIN_GRADE_DESC[dailyGrade];

  paragraphs.push(emphasis(
    `오늘의 용신 부합도는 ${stars} (${gradeDesc})이에요!`,
    dailyStemEl,
  ));

  // 등급별 해석
  const gradeText = pickAndFill(rng, GRADE_DAILY_TEMPLATES[dailyGrade], { 이름: name });
  if (dailyGrade >= 4) {
    paragraphs.push(positive(gradeText, dailyStemEl));
  } else if (dailyGrade <= 2) {
    paragraphs.push(caution(gradeText, dailyStemEl));
  } else {
    paragraphs.push(narrative(gradeText, dailyStemEl));
  }

  // 용신 오행별 실생활 조언
  if (sys.yongEl) {
    const yongColor = ELEMENT_COLOR[sys.yongEl];
    const yongDir = ELEMENT_DIRECTION[sys.yongEl];
    const yongNums = ELEMENT_NUMBER[sys.yongEl];
    const yongTaste = ELEMENT_TASTE[sys.yongEl];
    const yongFoods = ELEMENT_FOOD[sys.yongEl];

    if (dailyGrade <= 2) {
      const foodSample = rng.sample(yongFoods, 3).join(', ');
      paragraphs.push(tip(
        `오늘처럼 기운이 맞지 않는 날에는 용신 ${elFull(sys.yongEl)}의 기운을 보충해 주세요. ` +
        `${yongColor} 계열의 옷이나 소품을 활용하고, ${yongDir} 방향이 좋아요. ` +
        `음식은 ${foodSample} 등 ${yongTaste} 계열을 추천해요. ` +
        `행운의 숫자는 ${yongNums[0]}과 ${yongNums[1]}이에요.`,
        sys.yongEl,
      ));
    } else if (dailyGrade >= 4) {
      paragraphs.push(tip(
        `오늘은 이미 좋은 기운이 흐르고 있어요! 여기에 용신 ${elFull(sys.yongEl)}의 에너지를 더하면 금상첨화예요. ` +
        `${yongColor} 계열의 악세서리를 걸치면 더 빛나는 하루가 될 거예요.`,
        sys.yongEl,
      ));
    }
  }

  // 기신 주의 사항
  if (sys.giEl && dailyStemEl === sys.giEl) {
    const giColor = ELEMENT_COLOR[sys.giEl];
    const giEmoNeg = ELEMENT_EMOTION[sys.giEl]?.negative ?? '';
    paragraphs.push(caution(
      `오늘의 일진 오행이 기신 ${elFull(sys.giEl)}과 같으니 특별히 주의해 주세요. ` +
      `${giColor} 계열은 오늘 피하는 게 좋고, ${giEmoNeg}의 감정이 올라올 수 있으니 마음을 다스려 주세요.`,
      sys.giEl,
    ));
  }

  // 하이라이트
  highlights.push(
    { label: '오늘 일진', value: `${ganziHangul}(${ganziHanja})`, element: dailyStemEl, sentiment: dailyGrade >= 4 ? 'good' : dailyGrade <= 2 ? 'caution' : 'neutral' },
    { label: '일진 천간 오행', value: elFull(dailyStemEl), element: dailyStemEl, sentiment: 'neutral' },
    { label: '일진 십성(천간)', value: `${tgStemKo}(${tgStemHanja})`, sentiment: 'neutral' },
    { label: '일진 용신부합도', value: `${stars}`, element: dailyStemEl, sentiment: dailyGrade >= 4 ? 'good' : dailyGrade <= 2 ? 'caution' : 'neutral' },
  );

  return { paragraphs, highlights };
}

/** 12시진 분석 서브섹션 */
function buildHourlySubsection(
  rng: SeededRandom,
  name: string,
  hourlyEntries: HourlyEntry[],
  sys: YongshinSystem,
): { paragraphs: ReportParagraph[]; table: ReportTable; chart: ReportChart; highlights: ReportHighlight[] } {
  const paragraphs: ReportParagraph[] = [];
  const highlights: ReportHighlight[] = [];

  // 테이블
  const tableRows: string[][] = [];
  const chartData: Record<string, number | string> = {};

  // 최고/최저 시간대 추적
  let bestGrade = 0;
  let worstGrade = 6;
  let bestIdx = 0;
  let worstIdx = 0;

  paragraphs.push(emphasis(
    '이제 12시진별 시간표를 살펴볼게요! 하루 중 어떤 시간대에 어떤 기운이 흐르는지 알면, 일정을 더 효율적으로 짤 수 있답니다.',
  ));

  paragraphs.push(narrative(
    '하루는 12시진(時辰)으로 나뉘어요. 각 시진마다 2시간씩, 각기 다른 간지와 오행이 배정돼요. ' +
    '시진의 천간은 오늘의 일간에 따라 정해지는데, 이것이 바로 "오서기수(五鼠起數)" 법칙이에요.',
  ));

  for (let i = 0; i < 12; i++) {
    const entry = hourlyEntries[i];
    const { branchInfo, stemInfo, tenGodStem, tenGodBranch, grade, ganziHangul, ganziHanja } = entry;

    // 최고/최악 추적
    if (grade > bestGrade) { bestGrade = grade; bestIdx = i; }
    if (grade < worstGrade) { worstGrade = grade; worstIdx = i; }

    // 테이블 행
    const tgStemKo = tenGodKorean(tenGodStem);
    const tgBranchKo = tenGodKorean(tenGodBranch);
    const stars = YONGSHIN_GRADE_STARS[grade];
    const activity = HOURLY_ACTIVITY[branchInfo.code] ?? '-';

    tableRows.push([
      `${branchInfo.hangul}시(${branchInfo.hanja}時)`,
      branchInfo.timeRange,
      `${ganziHangul}(${ganziHanja})`,
      `${elShort(stemInfo.element)}(${elHanja(stemInfo.element)}) / ${elShort(branchInfo.element)}(${elHanja(branchInfo.element)})`,
      `${tgStemKo} / ${tgBranchKo}`,
      stars,
      activity,
    ]);

    // 차트 데이터
    chartData[`${branchInfo.hangul}시 ${branchInfo.timeRange}`] = grade;

    // 각 시진별 상세 문단
    const hourAdvice = HOURLY_ADVICE[branchInfo.code];
    const gradePrefix = rng.pick(HOURLY_GRADE_PREFIX[grade]);
    const specificAdvice = hourAdvice ? rng.pick(hourAdvice) : '';

    const hourNarrative = joinSentences(
      `[${branchInfo.hangul}시(${branchInfo.hanja}時) ${branchInfo.timeRange}] ${ganziHangul}(${ganziHanja}) -- ${elFull(stemInfo.element)}/${elFull(branchInfo.element)}.`,
      `십성: 천간 ${tgStemKo}, 지지 ${tgBranchKo}. 용신부합도: ${stars}.`,
      gradePrefix,
      specificAdvice,
    );

    if (grade >= 4) {
      paragraphs.push(positive(hourNarrative, stemInfo.element));
    } else if (grade <= 2) {
      paragraphs.push(caution(hourNarrative, stemInfo.element));
    } else {
      paragraphs.push(narrative(hourNarrative, stemInfo.element));
    }
  }

  // 최고/최저 시간대 요약
  const bestEntry = hourlyEntries[bestIdx];
  const worstEntry = hourlyEntries[worstIdx];

  paragraphs.push(emphasis(
    `오늘의 골든타임은 ${bestEntry.branchInfo.hangul}시(${bestEntry.branchInfo.timeRange})예요! ` +
    `${bestEntry.ganziHangul}(${bestEntry.ganziHanja})의 ${elFull(bestEntry.stemInfo.element)} 기운이 ${name}님에게 가장 잘 맞아요. ` +
    `중요한 일은 이 시간대에 집중하면 좋겠어요.`,
  ));

  if (worstIdx !== bestIdx) {
    paragraphs.push(caution(
      `반면 ${worstEntry.branchInfo.hangul}시(${worstEntry.branchInfo.timeRange})는 에너지가 다소 약한 시간대예요. ` +
      `이 시간에는 무리하지 말고 휴식을 취하거나 가벼운 일을 하는 것이 좋아요.`,
    ));
  }

  // 하이라이트
  highlights.push(
    {
      label: '오늘의 골든타임',
      value: `${bestEntry.branchInfo.hangul}시 (${bestEntry.branchInfo.timeRange})`,
      element: bestEntry.stemInfo.element,
      sentiment: 'good',
    },
    {
      label: '주의 시간대',
      value: `${worstEntry.branchInfo.hangul}시 (${worstEntry.branchInfo.timeRange})`,
      element: worstEntry.stemInfo.element,
      sentiment: 'caution',
    },
  );

  // 테이블
  const table: ReportTable = {
    title: '12시진 시간표 -- 오늘의 시간별 에너지 맵',
    headers: ['시진', '시간대', '간지', '오행(천간/지지)', '십성(천간/지지)', '용신부합도', '추천 활동'],
    rows: tableRows,
  };

  // 차트
  const chart: ReportChart = {
    type: 'bar',
    title: '12시진 용신부합도',
    data: chartData,
    meta: {
      description: '각 시진의 용신 부합도를 시각적으로 보여줍니다. 5=최고, 1=주의.',
      gradeLabels: { 5: '최고', 4: '좋음', 3: '보통', 2: '주의', 1: '경계' },
    },
  };

  return { paragraphs, table, chart, highlights };
}

// =============================================================================
//  오행별 하루 활용 가이드
// =============================================================================

function buildElementGuideSubsection(
  rng: SeededRandom,
  name: string,
  dailyStemEl: ElementCode,
  sys: YongshinSystem,
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  paragraphs.push(emphasis(
    '오늘의 오행 에너지를 실생활에 활용하는 방법을 알려드릴게요!',
  ));

  // 오늘의 오행 특성
  const nature = ELEMENT_NATURE[dailyStemEl];
  const emotion = ELEMENT_EMOTION[dailyStemEl];
  const color = ELEMENT_COLOR[dailyStemEl];
  const direction = ELEMENT_DIRECTION[dailyStemEl];
  const numbers = ELEMENT_NUMBER[dailyStemEl];
  const taste = ELEMENT_TASTE[dailyStemEl];
  const foods = ELEMENT_FOOD[dailyStemEl];
  paragraphs.push(narrative(
    `오늘의 주요 에너지인 ${elFull(dailyStemEl)}은(는) "${nature}"을(를) 의미해요. ` +
    `긍정적으로 발현되면 ${emotion.positive}의 감정으로, 과하면 ${emotion.negative}으로 나타날 수 있어요.`,
    dailyStemEl,
  ));

  // 실생활 팁
  const foodSample = rng.sample(foods, 4).join(', ');
  paragraphs.push(tip(
    `[오늘의 컬러] ${color} 계열의 옷이나 소품을 활용하면 오늘의 에너지와 조화로워요. ` +
    `[행운의 방위] ${direction}. [행운의 숫자] ${numbers[0]}, ${numbers[1]}. ` +
    `[추천 음식] ${foodSample} (${taste} 계열).`,
    dailyStemEl,
  ));

  // 용신 보충 팁
  if (sys.yongEl && sys.yongEl !== dailyStemEl) {
    const yongColor = ELEMENT_COLOR[sys.yongEl];
    const yongFoods = ELEMENT_FOOD[sys.yongEl];
    const yongFoodSample = rng.sample(yongFoods, 3).join(', ');
    const yongDir = ELEMENT_DIRECTION[sys.yongEl];

    paragraphs.push(tip(
      `오늘의 일진 오행과 별개로, ${name}님의 용신 ${elFull(sys.yongEl)} 에너지도 함께 챙기면 더 좋아요! ` +
      `${yongColor} 계열 아이템, ${yongDir} 방향, ${yongFoodSample} 등을 활용해 보세요.`,
      sys.yongEl,
    ));
  }

  // 기신 주의 팁
  if (sys.giEl) {
    const giColor = ELEMENT_COLOR[sys.giEl];
    const giEmo = ELEMENT_EMOTION[sys.giEl];
    paragraphs.push(caution(
      `[기신 주의] ${elFull(sys.giEl)} 계열의 과도한 에너지는 조심하세요. ` +
      `${giColor} 일색의 환경은 피하고, ${giEmo.negative}의 감정이 올라올 때는 한 발짝 물러서 심호흡해 주세요.`,
      sys.giEl,
    ));
  }

  // 오행 상생 활용
  const generatedByEl = ELEMENT_GENERATED_BY[dailyStemEl];
  const generatesEl = ELEMENT_GENERATES[dailyStemEl];
  paragraphs.push(narrative(
    `오행의 흐름을 활용한 팁도 하나 알려드릴게요! ` +
    `오늘의 ${elFull(dailyStemEl)} 에너지를 강화하려면 ${elFull(generatedByEl)}의 도움을 받으세요 (${elShort(generatedByEl)} -> ${elShort(dailyStemEl)} 상생). ` +
    `오늘의 에너지를 생산적으로 흘려보내려면 ${elFull(generatesEl)} 방면의 활동이 좋아요 (${elShort(dailyStemEl)} -> ${elShort(generatesEl)} 상생).`,
    dailyStemEl,
  ));

  return paragraphs;
}

// =============================================================================
//  시간대별 맞춤 조언 상세 가이드
// =============================================================================

function buildDetailedHourlyGuide(
  rng: SeededRandom,
  name: string,
  hourlyEntries: HourlyEntry[],
  sys: YongshinSystem,
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  paragraphs.push(emphasis(
    '각 시간대에 대한 더 자세한 맞춤 조언이에요. 시간 관리에 참고해 보세요!',
  ));

  // 오전 / 오후 / 저녁 / 밤 그룹으로 나눠서 서술
  const groups = [
    { name: '밤~새벽 (23:00~07:00)', indices: [0, 1, 2, 3], emoji: '' },
    { name: '오전 (07:00~13:00)', indices: [4, 5, 6], emoji: '' },
    { name: '오후 (13:00~19:00)', indices: [7, 8, 9], emoji: '' },
    { name: '저녁~밤 (19:00~23:00)', indices: [10, 11], emoji: '' },
  ];

  for (const group of groups) {
    const groupEntries = group.indices.map(i => hourlyEntries[i]);
    const avgGrade = groupEntries.reduce((s, e) => s + e.grade, 0) / groupEntries.length;
    const avgGradeRound = Math.round(avgGrade) as YongshinMatchGrade;
    const groupStars = YONGSHIN_GRADE_STARS[avgGradeRound > 5 ? 5 : avgGradeRound < 1 ? 1 : avgGradeRound];

    paragraphs.push(emphasis(
      `${group.name} -- 평균 에너지: ${groupStars}`,
    ));

    // 그룹 종합 분석
    const bestInGroup = groupEntries.reduce((best, e) => e.grade > best.grade ? e : best, groupEntries[0]);
    const worstInGroup = groupEntries.reduce((worst, e) => e.grade < worst.grade ? e : worst, groupEntries[0]);

    if (avgGrade >= 3.5) {
      paragraphs.push(positive(
        `이 시간대는 전반적으로 좋은 기운이 흐르고 있어요. ` +
        `특히 ${bestInGroup.branchInfo.hangul}시(${bestInGroup.branchInfo.timeRange})가 이 구간에서 가장 빛나는 시간이에요. ` +
        `적극적인 활동을 계획해 보세요!`,
        bestInGroup.stemInfo.element,
      ));
    } else if (avgGrade <= 2.5) {
      paragraphs.push(caution(
        `이 시간대는 에너지가 다소 약해요. 무리한 일정은 피하고 편안하게 보내는 것이 좋아요. ` +
        `그 중에서도 ${worstInGroup.branchInfo.hangul}시(${worstInGroup.branchInfo.timeRange})는 특히 조심하세요.`,
        worstInGroup.stemInfo.element,
      ));
    } else {
      paragraphs.push(narrative(
        `이 시간대는 무난한 에너지가 흐르고 있어요. ` +
        `${bestInGroup.branchInfo.hangul}시(${bestInGroup.branchInfo.timeRange})가 상대적으로 가장 좋은 시간이니 ` +
        `중요한 일은 그때 집중해 보세요.`,
        bestInGroup.stemInfo.element,
      ));
    }

    // 각 시진별 한 줄 요약
    for (const entry of groupEntries) {
      const stars = YONGSHIN_GRADE_STARS[entry.grade];
      const tgKo = tenGodKorean(entry.tenGodStem);
      paragraphs.push(narrative(
        `  - ${entry.branchInfo.hangul}시(${entry.branchInfo.timeRange}): ${entry.ganziHangul} -- ${elShort(entry.stemInfo.element)}/${elShort(entry.branchInfo.element)} -- ${tgKo} -- ${stars}`,
        entry.stemInfo.element,
      ));
    }
  }

  return paragraphs;
}

// =============================================================================
//  오늘 하루 종합 점수 산출
// =============================================================================

function computeDailyScore(
  dailyGrade: YongshinMatchGrade,
  hourlyEntries: HourlyEntry[],
): number {
  // 일진 가중치 50%, 12시진 평균 50%
  const hourAvg = hourlyEntries.reduce((s, e) => s + e.grade, 0) / hourlyEntries.length;
  const raw = (dailyGrade * 0.5 + hourAvg * 0.5);
  // 1~5 -> 20~100 스케일
  return Math.round((raw - 1) * 20 + 20);
}

// =============================================================================
//  메인 생성 함수
// =============================================================================

export function generateDailyFortuneSection(input: ReportInput): ReportSection | null {
  // 일간 정보 필수
  const dayMaster = extractDayMaster(input);
  if (!dayMaster) return null;

  // RNG 초기화 + 오프셋 40
  const rng = createRng(input);
  for (let i = 0; i < 40; i++) rng.next();

  const name = safeName(input);
  const today = input.today ?? new Date();

  // 용신 체계
  const sys = extractYongshinSystem(input);

  // ─── 오늘 일진 산출 ──────────────────────────────────────────────────────
  const dailyGanzhiIndex = getDailyGanzhiIndex(today);
  const dailyGanzhi = GANZHI_60[dailyGanzhiIndex];
  const dailyStemEl = dailyGanzhi.stem.element;
  const dailyGrade = gradeFor(dailyStemEl, sys);

  // ─── 12시진 산출 ─────────────────────────────────────────────────────────
  const hourlyEntries = buildHourlyEntries(
    dailyGanzhi.stemIndex,
    dayMaster,
    sys,
  );

  // ─── 종합 점수 ──────────────────────────────────────────────────────────
  const dailyScore = computeDailyScore(dailyGrade, hourlyEntries);

  // ═══════════════════════════════════════════════════════════════════════════
  //  문단 조립
  // ═══════════════════════════════════════════════════════════════════════════

  const paragraphs: ReportParagraph[] = [];
  const allHighlights: ReportHighlight[] = [];
  const subsections: ReportSubsection[] = [];

  // ── 0. 도입부 ─────────────────────────────────────────────────────────────
  paragraphs.push(positive(
    pickAndFill(rng, SECTION_INTRO_TEMPLATES, { 이름: name }),
  ));

  // 종합 점수 안내
  const scoreEmoji = dailyScore >= 80 ? '아주 좋은' : dailyScore >= 60 ? '좋은' : dailyScore >= 40 ? '보통' : '주의가 필요한';
  paragraphs.push(emphasis(
    `오늘의 종합 에너지 점수는 ${dailyScore}점 (100점 만점)이에요! ${scoreEmoji} 하루가 예상됩니다.`,
    dailyStemEl,
  ));

  allHighlights.push({
    label: '오늘의 종합 점수',
    value: `${dailyScore}/100점`,
    element: dailyStemEl,
    sentiment: dailyScore >= 60 ? 'good' : dailyScore >= 40 ? 'neutral' : 'caution',
  });

  // ── 1. 오늘 일진 분석 서브섹션 ────────────────────────────────────────────
  const dailyResult = buildDailyPillarSubsection(rng, name, dailyGanzhi, dayMaster, sys, today);
  subsections.push({
    title: '오늘의 일진(日辰) 분석',
    paragraphs: dailyResult.paragraphs,
  });
  allHighlights.push(...dailyResult.highlights);

  // ── 2. 오행 활용 가이드 ──────────────────────────────────────────────────
  const elementGuide = buildElementGuideSubsection(rng, name, dailyStemEl, sys);
  subsections.push({
    title: '오늘의 오행 활용 가이드',
    paragraphs: elementGuide,
  });

  // ── 3. 12시진 시간표 분석 ─────────────────────────────────────────────────
  const hourlyResult = buildHourlySubsection(rng, name, hourlyEntries, sys);
  subsections.push({
    title: '12시진 시간표 -- 시간대별 에너지 분석',
    paragraphs: hourlyResult.paragraphs,
    tables: [hourlyResult.table],
    charts: [hourlyResult.chart],
  });
  allHighlights.push(...hourlyResult.highlights);

  // ── 4. 시간대별 맞춤 상세 가이드 ──────────────────────────────────────────
  const detailedGuide = buildDetailedHourlyGuide(rng, name, hourlyEntries, sys);
  subsections.push({
    title: '시간대별 맞춤 상세 가이드',
    paragraphs: detailedGuide,
  });

  // ── 5. 오늘의 핵심 체크리스트 ──────────────────────────────────────────────
  const checklistParagraphs: ReportParagraph[] = [];
  checklistParagraphs.push(emphasis(
    '오늘 하루를 위한 핵심 체크리스트를 정리해 드릴게요!',
  ));

  // 골든타임 안내
  const bestHour = hourlyEntries.reduce((best, e) => e.grade > best.grade ? e : best, hourlyEntries[0]);
  const worstHour = hourlyEntries.reduce((worst, e) => e.grade < worst.grade ? e : worst, hourlyEntries[0]);

  checklistParagraphs.push(positive(
    `1. [골든타임] ${bestHour.branchInfo.hangul}시(${bestHour.branchInfo.timeRange}) -- ` +
    `가장 좋은 에너지가 흐르는 시간이에요. 중요한 일, 큰 결정, 새로운 시도는 이 시간에!`,
    bestHour.stemInfo.element,
  ));

  checklistParagraphs.push(caution(
    `2. [주의 시간] ${worstHour.branchInfo.hangul}시(${worstHour.branchInfo.timeRange}) -- ` +
    `에너지가 약한 시간이에요. 무리한 약속이나 감정적 대화는 피하세요.`,
    worstHour.stemInfo.element,
  ));

  // 오행 활용
  if (sys.yongEl) {
    const yongColor = ELEMENT_COLOR[sys.yongEl];
    const yongFoods = ELEMENT_FOOD[sys.yongEl];
    const yongFoodSample = rng.sample(yongFoods, 2).join(', ');
    checklistParagraphs.push(tip(
      `3. [용신 보충] 오늘의 행운 컬러는 ${yongColor}, 추천 간식은 ${yongFoodSample}!`,
      sys.yongEl,
    ));
  }

  // 감정 관리
  const dailyElEmotion = ELEMENT_EMOTION[dailyStemEl];
  checklistParagraphs.push(tip(
    `4. [감정 관리] 오늘은 ${dailyElEmotion.positive}의 감정을 키우고, ${dailyElEmotion.negative}은(는) 조심하세요.`,
    dailyStemEl,
  ));

  // 건강 팁
  const organInfo = ELEMENT_ORGAN[dailyStemEl];
  const organText = organInfo ? `${organInfo.main}, ${organInfo.sub}` : ELEMENT_ORGAN_FALLBACK[dailyStemEl];
  checklistParagraphs.push(tip(
    `5. [건강] ${elFull(dailyStemEl)} 기운이 흐르는 날이니 관련 장기(${organText})를 특별히 챙겨주세요.`,
    dailyStemEl,
  ));

  subsections.push({
    title: '오늘의 핵심 체크리스트',
    paragraphs: checklistParagraphs,
  });

  // ── 6. 마무리 ──────────────────────────────────────────────────────────────
  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name }),
  ));

  paragraphs.push(narrative(
    '※ 일운과 시운은 사주명리학의 전통 이론에 기반한 참고 자료예요. ' +
    '매일의 기운은 참고로만 활용하시고, 항상 긍정적인 마음이 최고의 운세랍니다!',
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  //  테이블·차트·하이라이트 조립
  // ═══════════════════════════════════════════════════════════════════════════

  // 일진 요약 테이블
  const ganziH = `${dailyGanzhi.stem.hangul}${dailyGanzhi.branch.hangul}`;
  const ganziHj = `${dailyGanzhi.stem.hanja}${dailyGanzhi.branch.hanja}`;
  const tgStemKo = tenGodKorean(computeTenGod(
    dayMaster.element, dayMaster.yinYang,
    dailyGanzhi.stem.element, dailyGanzhi.stem.yinYang,
  ));
  const tgBranchKo = tenGodKorean(computeTenGod(
    dayMaster.element, dayMaster.yinYang,
    dailyGanzhi.branch.element, dailyGanzhi.branch.yinYang,
  ));

  const summaryTable: ReportTable = {
    title: '오늘의 일진 요약',
    headers: ['항목', '값'],
    rows: [
      ['날짜', `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`],
      ['일진 간지', `${ganziH} (${ganziHj})`],
      ['60갑자 순번', `${dailyGanzhiIndex + 1}/60`],
      ['천간', `${dailyGanzhi.stem.hangul}(${dailyGanzhi.stem.hanja}) -- ${elFull(dailyStemEl)}`],
      ['지지', `${dailyGanzhi.branch.hangul}(${dailyGanzhi.branch.hanja}) -- ${elFull(dailyGanzhi.branch.element)}`],
      ['천간 십성', tgStemKo],
      ['지지 십성', tgBranchKo],
      ['용신 부합도', `${YONGSHIN_GRADE_STARS[dailyGrade]} (${YONGSHIN_GRADE_DESC[dailyGrade]})`],
      ['종합 점수', `${dailyScore}/100점`],
    ],
  };

  // 게이지 차트
  const gaugeChart: ReportChart = {
    type: 'gauge',
    title: '오늘의 종합 에너지',
    data: { score: dailyScore, max: 100 },
    meta: {
      description: '오늘의 일진과 12시진 기운을 종합한 에너지 점수',
      ranges: {
        excellent: '80~100',
        good: '60~79',
        normal: '40~59',
        caution: '20~39',
        warning: '0~19',
      },
    },
  };

  // ── 반환 ──────────────────────────────────────────────────────────────────
  return {
    id: 'dailyFortune',
    title: '오늘의 일운(日運) + 시운(時運)',
    subtitle: `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 -- 하루의 에너지 시간표`,
    paragraphs,
    tables: [summaryTable],
    charts: [gaugeChart],
    highlights: allHighlights,
    subsections,
  };
}

// 장기 이름 폴백 (dynamic import 대비)
const ELEMENT_ORGAN_FALLBACK: Record<string, string> = {
  WOOD: '간/담낭',
  FIRE: '심장/소장',
  EARTH: '비장/위장',
  METAL: '폐/대장',
  WATER: '신장/방광',
};
