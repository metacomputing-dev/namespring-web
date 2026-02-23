/**
 * part8-nameComparison.ts -- 추천 이름 비교 매트릭스 섹션
 *
 * PART 8-4: 추천 이름 목록을 종합적으로 비교 평가하는 매트릭스를 생성합니다.
 *
 * 페르소나: "이름 심사위원" -- 여러 이름을 공정하게 비교 평가
 * - 초등학생~중학생도 이해하는 친근한 말투
 * - 올림픽 심사위원이 점수를 매기듯 공정하고 투명하게
 * - 각 이름의 장단점을 솔직하지만 따뜻하게 알려주는 톤
 * - 어떤 이름이든 나름의 가치가 있다는 관점 유지
 *
 * Section ID: 'nameComparison'
 * RNG offset: 46
 *
 * 종합 적합도 산출 (100점):
 *   A. 자원오행 용신 부합 (40점)
 *   B. 수리오행 용신 부합 (30점)
 *   C. 결핍 보완도 (15점)
 *   D. 4격 상생 흐름 (15점)
 *
 * 등급 체계:
 *   S (90~100) / A (75~89) / B (60~74) / C (45~59) / D (0~44)
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
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_FOOD,
  ELEMENT_NATURE,
  getElementRelation,
  SURI_81_LUCK,
  SURI_LUCK_KOREAN,
  suriToElement,
  type SuriLuck,
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
  SeededRandom,
} from '../common/sentenceUtils.js';
import { scoreNameAgainstSaju } from '../common/namingScoreEngine.js';

// ---------------------------------------------------------------------------
//  상수: 등급 체계
// ---------------------------------------------------------------------------

/** 총점 등급 */
type ScoreGrade = 'S' | 'A' | 'B' | 'C' | 'D';

function classifyGrade(score: number): ScoreGrade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

const GRADE_LABEL: Record<ScoreGrade, string> = {
  S: 'S등급 (최우수)',
  A: 'A등급 (우수)',
  B: 'B등급 (양호)',
  C: 'C등급 (보통)',
  D: 'D등급 (보완 필요)',
};

const GRADE_EMOJI: Record<ScoreGrade, string> = {
  S: '🏆',
  A: '🥇',
  B: '🥈',
  C: '🥉',
  D: '📋',
};

const MAX_COMPARISON_CANDIDATES = 8;
const MAX_PER_NAME_NARRATIVE_COUNT = 6;
const MAX_GISHIN_HIGHLIGHT_NAMES = 6;

// ---------------------------------------------------------------------------
//  헬퍼 함수
// ---------------------------------------------------------------------------

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function elFull(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

function elShort(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

/** 81수리 길흉 조회 (1~81 범위로 정규화) */
function lookupSuri81(strokeSum: number): SuriLuck {
  const suri = ((strokeSum - 1) % 81) + 1;
  return SURI_81_LUCK[suri] ?? 'HALF';
}

/** 81수리 길흉 한국어 */
function suriLuckKo(luck: SuriLuck): string {
  return SURI_LUCK_KOREAN[luck] ?? '반길(半吉)';
}

/** 상생 관계 판정 (same/generates/generated_by = 우호, controls/controlled_by = 비우호) */
function isFriendlyRelation(a: ElementCode, b: ElementCode): boolean {
  const rel = getElementRelation(a, b);
  return rel === 'same' || rel === 'generates' || rel === 'generated_by';
}

function isElementCode(value: string | null | undefined): value is ElementCode {
  return value === 'WOOD' ||
    value === 'FIRE' ||
    value === 'EARTH' ||
    value === 'METAL' ||
    value === 'WATER';
}

function toElementCode(value: string | null | undefined): ElementCode | null {
  return isElementCode(value) ? value : null;
}

function toElementCodeList(values: string[] | null | undefined): ElementCode[] {
  if (!values || values.length === 0) return [];

  const result: ElementCode[] = [];
  for (const value of values) {
    const code = toElementCode(value);
    if (code) result.push(code);
  }
  return result;
}

// ---------------------------------------------------------------------------
//  다양성 문장 풀 (심사위원 페르소나)
// ---------------------------------------------------------------------------

const INTRO_TEMPLATES: readonly string[] = [
  '자, 이제 이름 심사위원석에 앉아볼 시간이에요! 추천된 이름들을 하나하나 공정하게 비교해서, 어떤 이름이 사주와 가장 잘 어울리는지 점수를 매겨볼게요.',
  '올림픽 심사위원처럼 공정하게! 추천 이름들을 자원오행, 수리오행, 용신 부합도 등 7가지 항목으로 꼼꼼히 비교 분석해 드릴게요.',
  '여러 이름 후보가 있을 때 "어떤 이름이 제일 좋을까?" 고민되시죠? 걱정 마세요! 심사위원이 되어 각 이름을 100점 만점으로 채점해 드릴게요.',
  '이름 선발대회를 열어볼게요! 각 이름 후보가 사주의 용신에 얼마나 잘 맞는지, 결핍된 오행을 얼마나 잘 보완해주는지, 격의 흐름은 좋은지... 꼼꼼히 살펴볼게요!',
  '드디어 이름 비교 심사 시간이에요! 마치 노래 대회에서 심사위원이 점수판을 들어 올리듯, 각 이름에 공정한 점수를 매겨볼게요.',
  '이름마다 저마다의 매력이 있어요. 하지만 사주와의 궁합은 제각각이죠! 심사위원석에서 각 이름의 진짜 실력을 확인해 볼게요.',
];

const MATRIX_INTRO_TEMPLATES: readonly string[] = [
  '아래 비교표를 보면 각 이름의 점수가 한눈에 들어올 거예요. 마치 성적표처럼요!',
  '비교 매트릭스를 준비했어요. 표를 보면 어떤 이름이 어디서 점수를 많이 받았는지 바로 알 수 있답니다.',
  '이름별 점수 비교표를 만들어 봤어요. 각 항목의 점수를 합치면 총점이 나온답니다!',
  '자, 심사 결과를 표로 정리했어요! 각 이름이 7가지 항목에서 얼마나 잘했는지 한눈에 볼 수 있어요.',
];

const SCORING_EXPLAIN_TEMPLATES: readonly string[] = [
  '점수를 매기는 기준을 알려드릴게요! A항목(자원오행 용신 부합)이 40점으로 가장 비중이 크고, B항목(수리오행 용신 부합)이 30점, C항목(결핍 보완)과 D항목(상생 흐름)이 각각 15점이에요.',
  '채점 기준은 이래요: 자원오행이 용신과 맞는지(40점), 수리오행이 용신과 맞는지(30점), 부족한 오행을 보완하는지(15점), 4격이 서로 상생하는지(15점). 합치면 100점이 돼요!',
  '심사 기준표를 공개할게요! 총 100점 만점에서 자원오행 용신 부합이 40점(가장 중요!), 수리오행 용신 부합이 30점, 결핍 보완도가 15점, 상생 흐름이 15점이에요.',
];

const FIRST_PLACE_TEMPLATES: readonly string[] = [
  '1등은 {{이름}}! 총점 {{점수}}점으로 당당히 1위를 차지했어요! 이 이름이 사주와 가장 잘 어울리는 이름이에요.',
  '심사 결과 최고점은 {{이름}} — {{점수}}점이에요! 사주의 용신과 가장 좋은 궁합을 보여줬답니다.',
  '{{이름}}이(가) {{점수}}점으로 1위예요! 마치 올림픽 금메달을 목에 건 것처럼 빛나는 이름이에요.',
  '대회의 우승자는 {{이름}}({{점수}}점)! 사주와의 조화가 가장 뛰어난 이름으로 선정되었어요.',
  '드럼롤~ 1등은 바로 {{이름}}이에요! {{점수}}점이라는 높은 점수로 다른 이름들을 앞질렀답니다.',
];

const NO_CLEAR_WINNER_TEMPLATES: readonly string[] = [
  '흥미롭게도 여러 이름의 점수가 비슷해요! 이런 경우에는 이름의 뜻이나 발음의 느낌도 함께 고려해보면 좋겠어요.',
  '점수 차이가 크지 않아서 어떤 이름을 골라도 괜찮아요! 마음에 드는 이름이 가장 좋은 이름이라는 말도 있잖아요.',
  '접전이에요! 여러 이름이 비슷한 점수를 받았어요. 이럴 때는 부르기 편한지, 뜻이 마음에 드는지도 중요한 선택 기준이 될 수 있어요.',
];

const S_GRADE_TEMPLATES: readonly string[] = [
  'S등급이에요! 사주와의 궁합이 거의 완벽한 수준이에요. 용신과 자원오행이 찰떡궁합이고, 수리오행도 좋고, 결핍 보완까지 되는 최고의 이름이에요!',
  'S등급! 올림픽으로 치면 금메달감이에요! 자원오행이 용신을 딱 맞추고, 수리도 길하고, 사주에 부족한 부분까지 채워주는 대단한 이름이에요.',
  'S등급 획득! 100점에 가까운 높은 점수예요. 이 이름은 사주의 용신과 완벽하게 어울리면서 결핍된 오행까지 보완해주는 "꿈의 이름"이에요.',
];

const A_GRADE_TEMPLATES: readonly string[] = [
  'A등급이에요! 사주와 아주 잘 어울리는 훌륭한 이름이에요. 대부분의 항목에서 높은 점수를 받았답니다.',
  'A등급! 충분히 좋은 이름이에요. 용신과의 조화도 좋고, 수리오행도 양호해서 안심하고 사용할 수 있어요.',
  'A등급 획득! 거의 만점에 가까운 우수한 이름이에요. 한두 가지 아쉬운 점이 있지만, 전체적으로 훌륭한 결과예요!',
];

const B_GRADE_TEMPLATES: readonly string[] = [
  'B등급이에요! 괜찮은 이름이에요. 일부 항목에서 점수를 더 받았으면 하는 아쉬움이 있지만, 충분히 좋은 수준이에요.',
  'B등급! 나쁘지 않은 이름이에요. 용신이나 수리 쪽에서 조금 더 잘 맞았으면 좋았겠지만, 기본기가 탄탄해요.',
  'B등급 획득! 평균 이상의 좋은 이름이에요. 약간의 보완점이 있지만 생활 속 개운법으로 충분히 커버할 수 있어요.',
];

const C_GRADE_TEMPLATES: readonly string[] = [
  'C등급이에요. 사주와 완벽하게 맞지는 않지만, 이름의 뜻이나 발음이 좋다면 그것도 큰 장점이에요!',
  'C등급! 보완할 점이 좀 있지만 걱정하지 마세요. 용신에 맞는 색상이나 방위를 활용하면 부족한 부분을 채울 수 있어요.',
  'C등급이지만 낙심하지 마세요! 이름만으로 인생이 결정되는 건 아니거든요. 보완책을 활용하면 충분히 좋은 에너지를 만들 수 있어요.',
];

const D_GRADE_TEMPLATES: readonly string[] = [
  'D등급이에요. 사주와의 궁합이 아쉽지만, 다른 방법으로 보완할 수 있으니 너무 걱정하지 마세요!',
  'D등급! 점수가 낮지만 이름은 점수가 전부가 아니에요. 뜻이 좋고 부르기 좋다면 그것도 중요한 가치랍니다.',
  'D등급이지만 희망은 있어요! 용신 오행에 맞는 색상, 음식, 방위 등으로 일상에서 부족한 기운을 보충하면 돼요.',
];

const GRADE_TEMPLATE_MAP: Record<ScoreGrade, readonly string[]> = {
  S: S_GRADE_TEMPLATES,
  A: A_GRADE_TEMPLATES,
  B: B_GRADE_TEMPLATES,
  C: C_GRADE_TEMPLATES,
  D: D_GRADE_TEMPLATES,
};

const CHART_INTRO_TEMPLATES: readonly string[] = [
  '바 차트로 보면 각 이름의 총점 차이가 더 확실하게 눈에 들어올 거예요!',
  '점수를 막대 그래프로 그려봤어요. 한눈에 비교할 수 있죠?',
  '이름별 점수를 시각적으로 비교해 볼게요. 막대가 길수록 높은 점수예요!',
];

const DETAIL_INTRO_TEMPLATES: readonly string[] = [
  '1등 이름을 더 자세히 분석해 볼게요! 왜 이 이름이 가장 높은 점수를 받았는지 하나하나 살펴볼게요.',
  '최고점을 받은 이름을 깊이 파헤쳐 볼게요! 어떤 점이 사주와 잘 맞았는지 구체적으로 알아볼게요.',
  '1등 이름의 비밀을 공개합니다! 각 채점 항목에서 왜 높은 점수를 받았는지 상세히 설명해 드릴게요.',
];

const CLOSING_TEMPLATES: readonly string[] = [
  '이름 비교 심사가 끝났어요! 점수가 가장 높은 이름이 사주적으로는 최적이지만, 최종 선택은 마음이 이끄는 대로 해도 괜찮아요. 좋은 이름은 부르는 사람과 불리는 사람 모두에게 기쁨을 주니까요!',
  '심사위원의 평가는 여기까지예요. 점수는 참고용이고, 진짜 좋은 이름은 부모님의 사랑이 담긴 이름이에요. 어떤 이름을 선택하든 아이에게는 세상에서 가장 특별한 선물이 될 거예요!',
  '비교 분석을 마칩니다! 높은 점수의 이름이 사주와 잘 맞는 건 사실이지만, 이름의 뜻과 소리, 그리고 거기에 담긴 사랑도 못지않게 중요해요. 어떤 선택이든 응원할게요!',
  '모든 이름이 저마다의 가치를 가지고 있어요. 점수가 높으면 사주와의 궁합이 좋다는 뜻이지만, 이름에 담긴 소망과 사랑은 어떤 점수로도 매길 수 없답니다.',
  '이름 심사위원으로서 마지막으로 한마디! 사주와의 궁합도 중요하지만, 이름에 담긴 부모님의 바람과 사랑이 아이에게 가장 큰 에너지가 될 거예요. 좋은 이름을 고르셨길 바라요!',
];

// ---------------------------------------------------------------------------
//  A항목 상세 설명 문장 풀
// ---------------------------------------------------------------------------

const ITEM_A_PERFECT_TEMPLATES: readonly string[] = [
  '자원오행이 용신과 완벽하게 일치해요! 이름 글자의 뿌리 오행이 사주에서 가장 필요한 기운이라니, 정말 잘 맞는 이름이에요.',
  '이름 글자의 자원오행이 용신을 정확히 맞추고 있어요. 마치 퍼즐 조각이 딱 맞는 것처럼요!',
  '자원오행 용신 부합도 만점이에요! 이름의 한자가 품고 있는 오행이 사주가 원하는 그 기운 바로 그거예요!',
];

const ITEM_A_GOOD_TEMPLATES: readonly string[] = [
  '자원오행이 희신(용신의 도우미)과 일치해요. 용신만큼은 아니지만, 사주에 좋은 영향을 주는 기운이에요!',
  '이름의 자원오행이 희신과 맞아요. 희신은 용신을 도와주는 든든한 아군이니까 이것도 좋은 거예요!',
];

const ITEM_A_NEUTRAL_TEMPLATES: readonly string[] = [
  '자원오행이 용신이나 희신과 직접 일치하지는 않지만, 한신(중립) 위치라 해를 끼치지는 않아요.',
  '이름의 자원오행이 중립적인 위치예요. 특별히 좋지도 나쁘지도 않은, 무해무익한 오행이에요.',
];

const ITEM_A_WARN_TEMPLATES: readonly string[] = [
  '자원오행이 기신(기피 오행)과 일치해요. 사주에 부담을 줄 수 있는 기운이지만, 다른 항목에서 보완 가능해요!',
  '이름의 자원오행에 기신이 포함되어 있어요. 하지만 심사위원 입장에서 말하자면, 한 항목이 낮아도 다른 항목에서 만회할 수 있어요!',
];

// ---------------------------------------------------------------------------
//  B항목 상세 설명 문장 풀
// ---------------------------------------------------------------------------

const ITEM_B_HIGH_TEMPLATES: readonly string[] = [
  '수리오행에서도 용신 오행이 많이 나왔어요! 4격 중 대부분이 용신이나 희신과 같은 오행이라 든든하네요.',
  '수리오행 분석도 훌륭해요! 원격, 형격, 이격, 정격의 오행이 용신과 잘 맞아서 높은 점수를 받았어요.',
];

const ITEM_B_MID_TEMPLATES: readonly string[] = [
  '수리오행에서 일부 격이 용신과 맞아요. 완벽하지는 않지만, 절반 정도가 좋은 방향이면 충분히 괜찮아요!',
  '4격 중 절반 정도가 용신/희신 오행이에요. 나쁘지 않은 결과예요!',
];

const ITEM_B_LOW_TEMPLATES: readonly string[] = [
  '수리오행에서 용신과 맞는 격이 적어요. 하지만 자원오행이 좋으면 이 부분을 충분히 커버할 수 있어요!',
  '수리오행 점수가 좀 아쉬워요. 4격의 오행이 용신과 다른 방향이지만, 다른 항목에서 만회 가능해요!',
];

// ---------------------------------------------------------------------------
//  C항목(결핍 보완) 상세 설명 문장 풀
// ---------------------------------------------------------------------------

const ITEM_C_FULL_TEMPLATES: readonly string[] = [
  '사주에서 부족한 오행을 이름이 딱 채워주고 있어요! 마치 빈 자리에 꼭 맞는 퍼즐 조각을 넣은 것처럼요.',
  '결핍 오행 보완 만점! 사주에 없거나 부족한 기운을 이름이 완벽하게 보충해주고 있어요.',
];

const ITEM_C_PARTIAL_TEMPLATES: readonly string[] = [
  '사주의 결핍 오행을 일부 보완하고 있어요. 완전하지는 않지만, 부분적으로라도 채워주니 고마운 이름이에요!',
  '결핍 오행을 약간 보완하고 있어요. 조금이라도 부족한 부분을 메워주는 건 좋은 거예요!',
];

const ITEM_C_NONE_TEMPLATES: readonly string[] = [
  '아쉽게도 이름이 사주의 결핍 오행을 직접 보완하지는 못해요. 하지만 용신 부합이 좋으면 결핍 보완은 보조적인 요소이니까요!',
  '결핍 보완 점수가 0점이에요. 사주에서 부족한 오행과 이름 오행이 다르지만, 이건 생활 속 개운법으로 보완할 수 있어요.',
];

// ---------------------------------------------------------------------------
//  D항목(상생 흐름) 상세 설명 문장 풀
// ---------------------------------------------------------------------------

const ITEM_D_PERFECT_TEMPLATES: readonly string[] = [
  '4격이 모두 상생으로 이어져요! 원격에서 정격까지 기운이 물 흐르듯 자연스럽게 연결되는 최고의 흐름이에요.',
  '상생 흐름 만점! 각 격의 오행이 다음 격에 에너지를 전달하는 완벽한 릴레이 구조예요.',
];

const ITEM_D_GOOD_TEMPLATES: readonly string[] = [
  '상생 흐름이 좋은 편이에요! 대부분의 격 사이에서 기운이 순조롭게 흘러가고 있어요.',
  '격 사이의 상생 관계가 우세해요. 에너지 흐름이 대체로 순탄한 이름이에요.',
];

const ITEM_D_MIXED_TEMPLATES: readonly string[] = [
  '상생과 상극이 섞여 있어요. 일부 구간에서 기운의 충돌이 있지만, 이것도 삶의 다이나믹한 에너지가 될 수 있어요!',
  '격 사이에 상극이 좀 있지만, 긴장감이 오히려 성장의 동력이 되기도 해요.',
];

const ITEM_D_WEAK_TEMPLATES: readonly string[] = [
  '상생 흐름이 약한 편이에요. 격 사이에 상극이 많지만, 다른 항목에서 보완되면 전체적으로 괜찮을 수 있어요.',
  '격 간 상극이 우세해요. 하지만 모든 이름에 모든 조건이 완벽할 수는 없으니까 너무 걱정하지 마세요!',
];

// ---------------------------------------------------------------------------
//  개별 이름 분석 서술 문장 풀
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
//  데이터 추출 인터페이스
// ---------------------------------------------------------------------------

/** 이름 하나에 대한 비교 분석 결과 */
interface NameEvaluation {
  /** 이름 전체 한글 */
  fullHangul: string;
  /** 이름 전체 한자 */
  fullHanja: string;
  /** 성(姓) 글자들의 CharDetail */
  surnameChars: CharDetailLike[];
  /** 이름 글자들의 CharDetail */
  givenNameChars: CharDetailLike[];
  /** 자원오행 배열 (이름 글자들의 오행 코드) */
  charElements: string[];
  /** 수리오행 배열 (4격의 오행 코드) */
  suriElements: string[];
  /** 4격 수리 합계 배열 */
  suriStrokes: number[];
  /** 4격 81수리 길흉 배열 */
  suriLucks: SuriLuck[];
  /** A항목: 자원오행 용신 부합 점수 (0~40) */
  scoreA: number;
  /** B항목: 수리오행 용신 부합 점수 (0~30) */
  scoreB: number;
  /** C항목: 결핍 보완도 점수 (0~15) */
  scoreC: number;
  /** D항목: 4격 상생 흐름 점수 (0~15) */
  scoreD: number;
  /** 총점 (0~100) */
  totalScore: number;
  /** namingScoreEngine 보조 교차검증 점수 (0~100, 산출 불가 시 null) */
  engineCrossCheckScore: number | null;
  /** 등급 */
  grade: ScoreGrade;
  /** 순위 (1부터 시작) */
  rank: number;
  /** 용신 일치 글자 수 */
  yongshinMatchCount: number;
  /** 희신 일치 글자 수 */
  heeshinMatchCount: number;
  /** 기신 일치 글자 수 */
  gishinMatchCount: number;
  /** 결핍 보완 글자 수 */
  deficiencyFillCount: number;
  /** 상생 쌍 수 */
  sangsaengPairs: number;
  /** 총 인접 쌍 수 */
  totalPairs: number;
}

function hasEngineCrossCheckScore(
  evaluation: NameEvaluation,
): evaluation is NameEvaluation & { engineCrossCheckScore: number } {
  return evaluation.engineCrossCheckScore !== null;
}

/** CharDetail-like 구조 (가볍게 접근) */
interface CharDetailLike {
  hangul: string;
  hanja: string;
  meaning: string;
  strokes: number;
  element: string;
}

// ---------------------------------------------------------------------------
//  후보 이름 데이터 추출
// ---------------------------------------------------------------------------

/**
 * ReportInput에서 비교 대상 후보 이름 목록을 추출합니다.
 *
 * 데이터 소스 우선순위:
 * 1. (input as any).candidates -- 외부에서 직접 주입된 SpringReport[] 배열
 * 2. input.spring 단일 보고서 -- 1개짜리 비교 (최소 동작 보장)
 * 3. input.naming 단일 분석 -- 사주 교차 없는 순수 성명학 분석
 */
interface CandidateRaw {
  name: {
    surname: CharDetailLike[];
    givenName: CharDetailLike[];
    fullHangul: string;
    fullHanja: string;
  };
  analysis: {
    fourFrame: {
      frames: Array<{
        type: string;
        strokeSum: number;
        element: string;
      }>;
    };
    saju?: {
      yongshinElement?: string;
      heeshinElement?: string;
      gishinElement?: string;
      nameElements?: string[];
      affinityScore?: number;
    };
  };
  scores?: Record<string, number>;
  finalScore?: number;
  sajuCompatibility?: {
    yongshinElement?: string;
    heeshinElement?: string;
    gishinElement?: string;
    nameElements?: string[];
    affinityScore?: number;
  };
}

function extractCandidates(input: ReportInput): CandidateRaw[] {
  const results: CandidateRaw[] = [];

  // 1. 직접 주입된 candidates 배열 (SpringReport[] 형태)
  const inputAny = input as unknown as Record<string, unknown>;
  const candidatesArr = inputAny['candidates'] as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(candidatesArr) && candidatesArr.length > 0) {
    for (const c of candidatesArr) {
      const raw = parseCandidateFromSpringReport(c);
      if (raw) results.push(raw);
    }
  }

  // 2. input.spring 단일
  if (results.length === 0 && input.spring) {
    const raw = parseCandidateFromSpringReport(input.spring as unknown as Record<string, unknown>);
    if (raw) results.push(raw);
  }

  // 3. input.naming 단일
  if (results.length === 0 && input.naming) {
    const raw = parseCandidateFromNaming(input.naming as unknown as Record<string, unknown>, input);
    if (raw) results.push(raw);
  }

  return results;
}

function parseCandidateFromSpringReport(obj: Record<string, unknown>): CandidateRaw | null {
  // SpringReport 구조: { namingReport, sajuCompatibility, finalScore, ... }
  const namingReport = (obj['namingReport'] ?? obj) as Record<string, unknown>;
  const name = namingReport['name'] as CandidateRaw['name'] | undefined;
  const analysis = namingReport['analysis'] as Record<string, unknown> | undefined;
  const sajuCompat = (obj['sajuCompatibility'] ?? analysis?.['saju']) as Record<string, unknown> | undefined;

  if (!name || !analysis) return null;

  const fourFrame = analysis['fourFrame'] as Record<string, unknown> | undefined;
  const frames = (fourFrame?.['frames'] ?? []) as Array<Record<string, unknown>>;

  return {
    name: {
      surname: (name.surname ?? []) as CharDetailLike[],
      givenName: (name.givenName ?? []) as CharDetailLike[],
      fullHangul: (name.fullHangul ?? '') as string,
      fullHanja: (name.fullHanja ?? '') as string,
    },
    analysis: {
      fourFrame: {
        frames: frames.map(f => ({
          type: (f['type'] as string) ?? '',
          strokeSum: (f['strokeSum'] as number) ?? 0,
          element: (f['element'] as string) ?? '',
        })),
      },
      saju: sajuCompat ? {
        yongshinElement: sajuCompat['yongshinElement'] as string | undefined,
        heeshinElement: sajuCompat['heeshinElement'] as string | undefined,
        gishinElement: sajuCompat['gishinElement'] as string | undefined,
        nameElements: sajuCompat['nameElements'] as string[] | undefined,
        affinityScore: sajuCompat['affinityScore'] as number | undefined,
      } : undefined,
    },
    scores: (obj['scores'] ?? namingReport['scores']) as Record<string, number> | undefined,
    finalScore: (obj['finalScore'] ?? namingReport['totalScore']) as number | undefined,
    sajuCompatibility: sajuCompat as CandidateRaw['sajuCompatibility'],
  };
}

function parseCandidateFromNaming(obj: Record<string, unknown>, input: ReportInput): CandidateRaw | null {
  const name = obj['name'] as CandidateRaw['name'] | undefined;
  const analysis = obj['analysis'] as Record<string, unknown> | undefined;

  if (!name || !analysis) return null;

  const fourFrame = analysis['fourFrame'] as Record<string, unknown> | undefined;
  const frames = (fourFrame?.['frames'] ?? []) as Array<Record<string, unknown>>;

  return {
    name: {
      surname: (name.surname ?? []) as CharDetailLike[],
      givenName: (name.givenName ?? []) as CharDetailLike[],
      fullHangul: (name.fullHangul ?? '') as string,
      fullHanja: (name.fullHanja ?? '') as string,
    },
    analysis: {
      fourFrame: {
        frames: frames.map(f => ({
          type: (f['type'] as string) ?? '',
          strokeSum: (f['strokeSum'] as number) ?? 0,
          element: (f['element'] as string) ?? '',
        })),
      },
    },
    scores: obj['scores'] as Record<string, number> | undefined,
    finalScore: obj['totalScore'] as number | undefined,
  };
}

// ---------------------------------------------------------------------------
//  핵심 채점 로직
// ---------------------------------------------------------------------------

/**
 * A항목: 자원오행 용신 부합 (40점 만점)
 *
 * 각 글자 오행:
 *   = 용신 → 20점/글자
 *   = 희신 → 15점/글자
 *   = 한신 → 8점/글자
 *   = 구신 → 3점/글자
 *   = 기신 → 0점/글자
 * (2글자 이름: 각 20점 만점, 3글자면 조정)
 */
function scoreA_charElementMatch(
  charElements: string[],
  yongshinEl: string,
  heeshinEl: string | null,
  gishinEl: string | null,
  gusinEl: string | null,
): { score: number; yongCount: number; heeCount: number; giCount: number } {
  if (charElements.length === 0) return { score: 0, yongCount: 0, heeCount: 0, giCount: 0 };

  // 한신 = 용신/희신/기신/구신이 아닌 오행
  const allElements: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
  const knownEls = new Set([yongshinEl, heeshinEl, gishinEl, gusinEl].filter(Boolean));
  const hansinEls = allElements.filter(e => !knownEls.has(e));

  const pointsPerChar = 40 / Math.max(charElements.length, 1);
  let total = 0;
  let yongCount = 0;
  let heeCount = 0;
  let giCount = 0;

  for (const el of charElements) {
    let ratio: number;
    if (el === yongshinEl) {
      ratio = 1.0; // 20/20
      yongCount++;
    } else if (el === heeshinEl) {
      ratio = 0.75; // 15/20
      heeCount++;
    } else if (hansinEls.includes(el as ElementCode)) {
      ratio = 0.4; // 8/20
    } else if (el === gusinEl) {
      ratio = 0.15; // 3/20
    } else if (el === gishinEl) {
      ratio = 0.0; // 0/20
      giCount++;
    } else {
      ratio = 0.4; // 기본 한신 취급
    }
    total += pointsPerChar * ratio;
  }

  return {
    score: Math.round(Math.min(40, total)),
    yongCount,
    heeCount,
    giCount,
  };
}

/**
 * B항목: 수리오행 용신 부합 (30점 만점)
 * 4격 중 용신 오행 수 x 7.5점
 */
function scoreB_suriElementMatch(
  suriElements: string[],
  yongshinEl: string,
  heeshinEl: string | null,
): { score: number; matchCount: number } {
  if (suriElements.length === 0) return { score: 0, matchCount: 0 };

  let matchCount = 0;
  for (const el of suriElements) {
    if (el === yongshinEl || (heeshinEl && el === heeshinEl)) {
      matchCount++;
    }
  }

  const score = Math.round(Math.min(30, matchCount * 7.5));
  return { score, matchCount };
}

/**
 * C항목: 결핍 보완도 (15점 만점)
 * 이름 오행이 사주 결핍 오행 포함 시 +15, 부분 +8, 미포함 0
 */
function scoreC_deficiencyFill(
  charElements: string[],
  suriElements: string[],
  deficientElements: string[],
): { score: number; fillCount: number } {
  if (deficientElements.length === 0) return { score: 15, fillCount: 0 }; // 결핍 없으면 만점

  const allNameElements = [...charElements, ...suriElements];
  const uniqueNameEls = new Set(allNameElements);

  let fillCount = 0;
  for (const defEl of deficientElements) {
    if (uniqueNameEls.has(defEl)) {
      fillCount++;
    }
  }

  if (fillCount >= deficientElements.length) return { score: 15, fillCount };
  if (fillCount > 0) return { score: 8, fillCount };
  return { score: 0, fillCount: 0 };
}

/**
 * D항목: 4격 상생 흐름 (15점 만점)
 * 연속 상생 쌍 수 / 3 x 15 (3쌍 모두 상생이면 만점)
 */
function scoreD_sangsaengFlow(
  suriElements: string[],
): { score: number; sangsaengCount: number; totalPairs: number } {
  if (suriElements.length < 2) return { score: 0, sangsaengCount: 0, totalPairs: 0 };

  const totalPairs = suriElements.length - 1;
  let sangsaengCount = 0;

  for (let i = 0; i < totalPairs; i++) {
    const a = suriElements[i] as ElementCode;
    const b = suriElements[i + 1] as ElementCode;
    if (a && b && isFriendlyRelation(a, b)) {
      sangsaengCount++;
    }
  }

  const denominator = Math.max(totalPairs, 1);
  const score = Math.round((sangsaengCount / denominator) * 15);
  return { score: Math.min(15, score), sangsaengCount, totalPairs };
}

function scoreEngineCrossCheck(
  charElements: string[],
  suriElements: string[],
  yongshinEl: string,
  heeshinEl: string | null,
  gishinEl: string | null,
  deficientElements: string[],
): number | null {
  const safeYongshin = toElementCode(yongshinEl);
  if (!safeYongshin) return null;

  const safeNameElements = toElementCodeList(charElements);
  const safeSuriElements = toElementCodeList(suriElements);
  if (safeNameElements.length === 0 && safeSuriElements.length === 0) {
    return null;
  }

  const breakdown = scoreNameAgainstSaju({
    nameElements: safeNameElements,
    suriElements: safeSuriElements,
    yongshin: safeYongshin,
    heeshin: toElementCode(heeshinEl),
    gishin: toElementCode(gishinEl),
    deficiency: toElementCodeList(deficientElements),
  });

  return breakdown.total;
}

// ---------------------------------------------------------------------------
//  종합 평가 함수
// ---------------------------------------------------------------------------

function evaluateCandidate(
  candidate: CandidateRaw,
  yongshinEl: string,
  heeshinEl: string | null,
  gishinEl: string | null,
  gusinEl: string | null,
  deficientElements: string[],
): NameEvaluation {
  // 자원오행 추출
  const allChars: CharDetailLike[] = [
    ...(candidate.name.givenName ?? []),
  ];
  const charElements: string[] = allChars
    .map(c => c.element)
    .filter(Boolean);

  // 수리 데이터 추출
  const frames = candidate.analysis.fourFrame.frames;
  const suriStrokes = frames.map(f => f.strokeSum);
  const suriElements: string[] = frames.map(f => {
    if (f.element) return f.element;
    return suriToElement(f.strokeSum);
  });
  const suriLucks: SuriLuck[] = suriStrokes.map(s => lookupSuri81(s));

  // 4개 항목 채점
  const aResult = scoreA_charElementMatch(charElements, yongshinEl, heeshinEl, gishinEl, gusinEl);
  const bResult = scoreB_suriElementMatch(suriElements, yongshinEl, heeshinEl);
  const cResult = scoreC_deficiencyFill(charElements, suriElements, deficientElements);
  const dResult = scoreD_sangsaengFlow(suriElements);

  const totalScore = Math.min(100, aResult.score + bResult.score + cResult.score + dResult.score);
  const engineCrossCheckScore = scoreEngineCrossCheck(
    charElements,
    suriElements,
    yongshinEl,
    heeshinEl,
    gishinEl,
    deficientElements,
  );

  return {
    fullHangul: candidate.name.fullHangul,
    fullHanja: candidate.name.fullHanja,
    surnameChars: candidate.name.surname ?? [],
    givenNameChars: candidate.name.givenName ?? [],
    charElements,
    suriElements,
    suriStrokes,
    suriLucks,
    scoreA: aResult.score,
    scoreB: bResult.score,
    scoreC: cResult.score,
    scoreD: dResult.score,
    totalScore,
    engineCrossCheckScore,
    grade: classifyGrade(totalScore),
    rank: 0, // 후에 설정
    yongshinMatchCount: aResult.yongCount,
    heeshinMatchCount: aResult.heeCount,
    gishinMatchCount: aResult.giCount,
    deficiencyFillCount: cResult.fillCount,
    sangsaengPairs: dResult.sangsaengCount,
    totalPairs: dResult.totalPairs,
  };
}

// ---------------------------------------------------------------------------
//  서술형 분석 생성 헬퍼
// ---------------------------------------------------------------------------

/** 1등 이름 상세 분석 단락 생성 */
function buildFirstPlaceAnalysis(
  rng: SeededRandom,
  first: NameEvaluation,
  yongshinEl: string,
  heeshinEl: string | null,
  gishinEl: string | null,
  deficientElements: string[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];
  const nameLabel = first.fullHangul || first.fullHanja || '1등 이름';

  // 1등 이름 상세 도입
  paragraphs.push(emphasis(
    pickAndFill(rng, DETAIL_INTRO_TEMPLATES),
  ));

  // --- A항목 상세 ---
  paragraphs.push(narrative(
    `[A] 자원오행 용신 부합: ${first.scoreA}/40점`,
  ));

  if (first.yongshinMatchCount > 0) {
    const matchingEls = first.charElements
      .filter(e => e === yongshinEl)
      .map(e => elShort(e));
    paragraphs.push(positive(
      pickAndFill(rng, ITEM_A_PERFECT_TEMPLATES) + ` (${matchingEls.join(', ')} = 용신 ${elShort(yongshinEl)})`,
      yongshinEl as ElementCode,
    ));
  } else if (first.heeshinMatchCount > 0) {
    paragraphs.push(positive(
      pickAndFill(rng, ITEM_A_GOOD_TEMPLATES),
    ));
  } else if (first.gishinMatchCount > 0) {
    paragraphs.push(caution(
      pickAndFill(rng, ITEM_A_WARN_TEMPLATES),
    ));
  } else {
    paragraphs.push(narrative(
      pickAndFill(rng, ITEM_A_NEUTRAL_TEMPLATES),
    ));
  }

  // 자원오행 구성 설명
  if (first.charElements.length > 0) {
    const elList = first.charElements.map((e, i) => {
      const charInfo = first.givenNameChars[i];
      const charLabel = charInfo
        ? `${charInfo.hangul}(${charInfo.hanja})`
        : `${i + 1}번째 글자`;
      return `${charLabel} = ${elFull(e)}`;
    }).join(', ');
    paragraphs.push(narrative(
      `이름 글자별 자원오행: ${elList}`,
    ));
  }

  // --- B항목 상세 ---
  paragraphs.push(narrative(
    `[B] 수리오행 용신 부합: ${first.scoreB}/30점`,
  ));

  if (first.suriElements.length > 0) {
    const frameNames = ['원격', '형격', '이격', '정격'];
    const suriDesc = first.suriElements.map((e, i) => {
      const fname = frameNames[i] ?? `${i + 1}격`;
      const stroke = first.suriStrokes[i] ?? 0;
      const luck = first.suriLucks[i] ?? 'HALF';
      const luckLabel = suriLuckKo(luck);
      const isMatch = e === yongshinEl || (heeshinEl && e === heeshinEl);
      return `${fname}(${stroke}획) = ${elShort(e)}[${luckLabel}] ${isMatch ? '(용신/희신 일치!)' : ''}`;
    }).join(', ');
    paragraphs.push(narrative(`4격 수리오행: ${suriDesc}`));
  }

  const bResult = scoreB_suriElementMatch(first.suriElements, yongshinEl, heeshinEl);
  if (bResult.matchCount >= 3) {
    paragraphs.push(positive(pickAndFill(rng, ITEM_B_HIGH_TEMPLATES)));
  } else if (bResult.matchCount >= 2) {
    paragraphs.push(narrative(pickAndFill(rng, ITEM_B_MID_TEMPLATES)));
  } else {
    paragraphs.push(narrative(pickAndFill(rng, ITEM_B_LOW_TEMPLATES)));
  }

  // --- C항목 상세 ---
  paragraphs.push(narrative(
    `[C] 결핍 보완도: ${first.scoreC}/15점`,
  ));

  if (deficientElements.length > 0) {
    const defList = deficientElements.map(e => elShort(e)).join(', ');
    paragraphs.push(narrative(
      `사주의 결핍 오행: ${defList}`,
    ));
  }

  if (first.deficiencyFillCount > 0 && first.scoreC >= 15) {
    paragraphs.push(positive(pickAndFill(rng, ITEM_C_FULL_TEMPLATES)));
  } else if (first.deficiencyFillCount > 0) {
    paragraphs.push(narrative(pickAndFill(rng, ITEM_C_PARTIAL_TEMPLATES)));
  } else {
    paragraphs.push(narrative(pickAndFill(rng, ITEM_C_NONE_TEMPLATES)));
  }

  // --- D항목 상세 ---
  paragraphs.push(narrative(
    `[D] 4격 상생 흐름: ${first.scoreD}/15점 (${first.sangsaengPairs}/${first.totalPairs}쌍 상생)`,
  ));

  if (first.sangsaengPairs === first.totalPairs && first.totalPairs > 0) {
    paragraphs.push(positive(pickAndFill(rng, ITEM_D_PERFECT_TEMPLATES)));
  } else if (first.sangsaengPairs >= Math.ceil(first.totalPairs * 0.6)) {
    paragraphs.push(narrative(pickAndFill(rng, ITEM_D_GOOD_TEMPLATES)));
  } else if (first.sangsaengPairs > 0) {
    paragraphs.push(narrative(pickAndFill(rng, ITEM_D_MIXED_TEMPLATES)));
  } else {
    paragraphs.push(narrative(pickAndFill(rng, ITEM_D_WEAK_TEMPLATES)));
  }

  // --- 상생 흐름 시각적 설명 ---
  if (first.suriElements.length >= 2) {
    const flowParts: string[] = [];
    const frameNames = ['원격', '형격', '이격', '정격'];
    for (let i = 0; i < first.suriElements.length - 1; i++) {
      const a = first.suriElements[i] as ElementCode;
      const b = first.suriElements[i + 1] as ElementCode;
      const nameA = frameNames[i] ?? `${i + 1}격`;
      const nameB = frameNames[i + 1] ?? `${i + 2}격`;
      const rel = getElementRelation(a, b);
      let relSymbol: string;
      if (rel === 'generates') relSymbol = '→(상생)→';
      else if (rel === 'generated_by') relSymbol = '←(상생)←';
      else if (rel === 'same') relSymbol = '=(비화)=';
      else if (rel === 'controls') relSymbol = '→(상극)→';
      else relSymbol = '←(상극)←';
      flowParts.push(`${nameA}(${elShort(a)}) ${relSymbol} ${nameB}(${elShort(b)})`);
    }
    paragraphs.push(tip(`상생 흐름 도식: ${flowParts.join(' | ')}`));
  }

  // --- 총점 정리 ---
  const gradeLabel = GRADE_LABEL[first.grade];
  paragraphs.push(emphasis(
    `${nameLabel}의 종합 점수: ${first.totalScore}/100점 → ${gradeLabel} ${GRADE_EMOJI[first.grade]}`,
  ));

  // 등급별 해설
  paragraphs.push(encouraging(
    pickAndFill(rng, GRADE_TEMPLATE_MAP[first.grade]),
  ));

  return paragraphs;
}

/** 각 이름별 간단 서술 생성 (1등 이외) */
function buildPerNameBrief(
  rng: SeededRandom,
  evaluation: NameEvaluation,
  yongshinEl: string,
  heeshinEl: string | null,
  gishinEl: string | null,
  deficientElements: string[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];
  const nameLabel = evaluation.fullHangul || evaluation.fullHanja || `${evaluation.rank}위 이름`;
  const gradeLabel = GRADE_LABEL[evaluation.grade];

  // 이름 도입
  paragraphs.push(narrative(
    `${GRADE_EMOJI[evaluation.grade]} ${evaluation.rank}위: ${nameLabel}(${evaluation.fullHanja}) — ${evaluation.totalScore}점 (${gradeLabel})`,
  ));

  // 간략한 항목별 점수
  paragraphs.push(narrative(
    `[A] 자원오행: ${evaluation.scoreA}/40점 | ` +
    `[B] 수리오행: ${evaluation.scoreB}/30점 | ` +
    `[C] 결핍보완: ${evaluation.scoreC}/15점 | ` +
    `[D] 상생흐름: ${evaluation.scoreD}/15점`,
  ));

  // 자원오행 구성
  if (evaluation.charElements.length > 0) {
    const elList = evaluation.charElements.map(e => elShort(e)).join(' + ');
    paragraphs.push(narrative(`자원오행: ${elList}`));
  }

  // 수리오행 구성
  if (evaluation.suriElements.length > 0) {
    const suriList = evaluation.suriElements.map(e => elShort(e)).join(' → ');
    paragraphs.push(narrative(`수리오행(4격): ${suriList}`));
  }

  // 81수리 길흉
  if (evaluation.suriLucks.length > 0) {
    const luckList = evaluation.suriLucks.map(l => suriLuckKo(l)).join(', ');
    paragraphs.push(narrative(`81수리 길흉: ${luckList}`));
  }

  // 핵심 장단점
  const pros: string[] = [];
  const cons: string[] = [];

  if (evaluation.yongshinMatchCount > 0) {
    pros.push(`용신(${elShort(yongshinEl)}) 일치 ${evaluation.yongshinMatchCount}글자`);
  }
  if (evaluation.heeshinMatchCount > 0) {
    pros.push(`희신 일치 ${evaluation.heeshinMatchCount}글자`);
  }
  if (evaluation.deficiencyFillCount > 0) {
    pros.push('결핍 오행 보완');
  }
  if (evaluation.sangsaengPairs === evaluation.totalPairs && evaluation.totalPairs > 0) {
    pros.push('전 격 상생');
  }

  if (evaluation.gishinMatchCount > 0) {
    cons.push(`기신(${elShort(gishinEl)}) 일치 ${evaluation.gishinMatchCount}글자`);
  }
  if (evaluation.scoreC === 0 && deficientElements.length > 0) {
    cons.push('결핍 오행 미보완');
  }
  if (evaluation.sangsaengPairs === 0 && evaluation.totalPairs > 0) {
    cons.push('상생 흐름 부족');
  }

  if (pros.length > 0) {
    paragraphs.push(positive(`장점: ${pros.join(', ')}`));
  }
  if (cons.length > 0) {
    paragraphs.push(caution(`보완점: ${cons.join(', ')}`));
  }

  // 등급별 한줄 해설
  paragraphs.push(encouraging(
    pickAndFill(rng, GRADE_TEMPLATE_MAP[evaluation.grade]),
  ));

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  보완 조언 생성
// ---------------------------------------------------------------------------

function buildSupplementAdvice(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
  yongshinEl: string,
  deficientElements: string[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  paragraphs.push(emphasis(
    '어떤 이름을 선택하든, 사주의 부족한 기운을 생활 속에서 보완할 수 있어요!',
  ));

  // 용신 기반 보완법
  if (yongshinEl) {
    const el = yongshinEl as ElementCode;
    const color = ELEMENT_COLOR[el] ?? '';
    const direction = ELEMENT_DIRECTION[el] ?? '';
    const numbers = ELEMENT_NUMBER[el] ?? [];
    const foods = ELEMENT_FOOD[el] ?? [];
    const nature = ELEMENT_NATURE[el] ?? '';

    paragraphs.push(tip(
      `용신 ${elFull(yongshinEl)}의 기운을 보충하는 방법:\n` +
      `  - 행운색: ${color}\n` +
      `  - 좋은 방위: ${direction}\n` +
      `  - 행운 숫자: ${numbers.join(', ')}\n` +
      `  - 추천 음식: ${foods.slice(0, 4).join(', ')}\n` +
      `  - 오행의 성질: ${nature}`,
    ));
  }

  // 결핍 오행 보완법
  if (deficientElements.length > 0) {
    for (const defEl of deficientElements.slice(0, 2)) {
      const el = defEl as ElementCode;
      const color = ELEMENT_COLOR[el] ?? '';
      const foods = ELEMENT_FOOD[el] ?? [];
      paragraphs.push(tip(
        `부족한 ${elFull(defEl)} 보완법: ${color} 계열 소품 활용, ${foods.slice(0, 3).join(' / ')} 섭취 추천`,
      ));
    }
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  등급별 분포 분석
// ---------------------------------------------------------------------------

function buildGradeDistribution(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  const gradeCounts: Record<ScoreGrade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const ev of evaluations) {
    gradeCounts[ev.grade]++;
  }

  const distributionParts: string[] = [];
  for (const grade of ['S', 'A', 'B', 'C', 'D'] as ScoreGrade[]) {
    if (gradeCounts[grade] > 0) {
      distributionParts.push(`${GRADE_EMOJI[grade]} ${grade}등급: ${gradeCounts[grade]}개`);
    }
  }

  if (distributionParts.length > 0) {
    paragraphs.push(narrative(
      `등급 분포: ${distributionParts.join(' | ')}`,
    ));
  }

  // 전체 평균 점수
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, ev) => sum + ev.totalScore, 0) / evaluations.length)
    : 0;
  const avgGrade = classifyGrade(avgScore);

  paragraphs.push(narrative(
    `추천 이름 전체 평균: ${avgScore}점 (${GRADE_LABEL[avgGrade]})`,
  ));

  // 평균에 따른 전체 평가
  if (avgScore >= 80) {
    paragraphs.push(positive(
      '전체적으로 매우 우수한 이름 후보들이에요! 어떤 이름을 골라도 사주와 잘 어울릴 거예요.',
    ));
  } else if (avgScore >= 60) {
    paragraphs.push(narrative(
      '대체로 괜찮은 이름 후보들이에요. 상위권 이름을 중심으로 고려해보면 좋겠어요.',
    ));
  } else {
    paragraphs.push(encouraging(
      '이름 후보들의 점수가 다소 낮지만 걱정하지 마세요. 높은 점수의 이름을 우선 고려하되, 생활 속 보완법도 함께 활용해보세요!',
    ));
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  점수 격차 분석
// ---------------------------------------------------------------------------

function buildScoreGapAnalysis(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  if (evaluations.length < 2) return paragraphs;

  const sorted = [...evaluations].sort((a, b) => b.totalScore - a.totalScore);
  const first = sorted[0];
  const second = sorted[1];
  const last = sorted[sorted.length - 1];
  const gap12 = first.totalScore - second.totalScore;
  const gapFirstLast = first.totalScore - last.totalScore;

  // 1위와 2위 격차 분석
  if (gap12 <= 3) {
    paragraphs.push(narrative(
      pickAndFill(rng, NO_CLEAR_WINNER_TEMPLATES) +
      ` (1위 ${first.fullHangul} ${first.totalScore}점 vs 2위 ${second.fullHangul} ${second.totalScore}점, 차이 ${gap12}점)`,
    ));
  } else if (gap12 <= 10) {
    paragraphs.push(narrative(
      `1위 ${first.fullHangul}(${first.totalScore}점)과 2위 ${second.fullHangul}(${second.totalScore}점)의 차이가 ${gap12}점이에요. ` +
      `근소한 차이이므로, 이름의 뜻이나 발음도 함께 고려해보면 좋겠어요.`,
    ));
  } else {
    paragraphs.push(narrative(
      `1위 ${first.fullHangul}(${first.totalScore}점)이(가) 2위보다 ${gap12}점 앞서 있어요. ` +
      `사주 궁합 면에서는 1위 이름이 확실한 우위를 보여주고 있어요!`,
    ));
  }

  // 1위와 꼴찌 격차
  if (sorted.length >= 3 && gapFirstLast > 20) {
    paragraphs.push(narrative(
      `1위(${first.totalScore}점)와 ${sorted.length}위(${last.totalScore}점)의 차이가 ${gapFirstLast}점으로 꽤 큰 편이에요. ` +
      `가능하면 상위권 이름을 선택하는 것이 사주와의 궁합에서 유리해요.`,
    ));
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  항목별 비교 분석 (어느 항목이 차이를 만들었는지)
// ---------------------------------------------------------------------------

function buildItemComparisonAnalysis(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  if (evaluations.length < 2) return paragraphs;

  paragraphs.push(emphasis('항목별 비교 분석'));

  // 각 항목별 최고/최저 이름 찾기
  const items: Array<{ key: keyof NameEvaluation; label: string; max: number }> = [
    { key: 'scoreA', label: 'A. 자원오행 용신 부합', max: 40 },
    { key: 'scoreB', label: 'B. 수리오행 용신 부합', max: 30 },
    { key: 'scoreC', label: 'C. 결핍 보완도', max: 15 },
    { key: 'scoreD', label: 'D. 4격 상생 흐름', max: 15 },
  ];

  for (const item of items) {
    const sorted = [...evaluations].sort(
      (a, b) => (b[item.key] as number) - (a[item.key] as number),
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const bestScore = best[item.key] as number;
    const worstScore = worst[item.key] as number;

    if (evaluations.length >= 3) {
      paragraphs.push(narrative(
        `${item.label} (${item.max}점 만점): ` +
        `최고 ${best.fullHangul}(${bestScore}점) / ` +
        `최저 ${worst.fullHangul}(${worstScore}점) / ` +
        `차이 ${bestScore - worstScore}점`,
      ));
    } else {
      paragraphs.push(narrative(
        `${item.label} (${item.max}점 만점): ` +
        `${best.fullHangul}(${bestScore}점) vs ${worst.fullHangul}(${worstScore}점)`,
      ));
    }
  }

  // 가장 큰 격차를 만든 항목
  let maxGapItem = '';
  let maxGap = 0;
  for (const item of items) {
    const scores = evaluations.map(ev => ev[item.key] as number);
    const gap = Math.max(...scores) - Math.min(...scores);
    if (gap > maxGap) {
      maxGap = gap;
      maxGapItem = item.label;
    }
  }

  if (maxGapItem && maxGap > 5) {
    paragraphs.push(tip(
      `가장 큰 점수 차이를 만든 항목은 "${maxGapItem}"이에요 (최대 ${maxGap}점 차이). ` +
      `이 항목이 이름 선택에서 핵심 변수가 될 수 있어요!`,
    ));
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  81수리 종합 비교
// ---------------------------------------------------------------------------

function buildSuri81ComparisonAnalysis(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  if (evaluations.length === 0) return paragraphs;

  paragraphs.push(emphasis('81수리 길흉 종합 비교'));

  paragraphs.push(narrative(
    '81수리 길흉은 이름의 획수로 운세의 흐름을 보는 전통 성명학의 핵심 지표예요. ' +
    '대길(大吉)이 많을수록 좋고, 흉(凶)이 적을수록 좋답니다.',
  ));

  for (const ev of evaluations) {
    const luckSummary = ev.suriLucks.map((l, i) => {
      const frameNames = ['원격', '형격', '이격', '정격'];
      return `${frameNames[i] ?? `${i + 1}격`}: ${suriLuckKo(l)}`;
    }).join(' | ');

    const greatCount = ev.suriLucks.filter(l => l === 'GREAT' || l === 'GOOD').length;
    const badCount = ev.suriLucks.filter(l => l === 'BAD').length;

    let verdict: string;
    if (greatCount === ev.suriLucks.length) {
      verdict = '전 격 길! 최고의 수리 배치예요!';
    } else if (badCount === 0) {
      verdict = '흉이 없어요! 안정적인 수리 구성이에요.';
    } else if (badCount >= 3) {
      verdict = '도전적인 수리이지만, 다른 항목으로 보완 가능해요.';
    } else {
      verdict = `길 ${greatCount}개, 흉 ${badCount}개 — 무난한 수리 구성이에요.`;
    }

    paragraphs.push(narrative(
      `${ev.fullHangul}: ${luckSummary} → ${verdict}`,
    ));
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  이름별 오행 조합 패턴 분석
// ---------------------------------------------------------------------------

function buildElementPatternAnalysis(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
  yongshinEl: string,
  deficientElements: string[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  if (evaluations.length === 0) return paragraphs;

  paragraphs.push(emphasis('이름별 오행 구성 패턴'));

  paragraphs.push(narrative(
    '각 이름이 어떤 오행 조합을 가지고 있는지, 사주의 필요와 어떻게 맞닿아 있는지 살펴볼게요.',
  ));

  for (const ev of evaluations) {
    const allEls = [...ev.charElements, ...ev.suriElements];
    const elCounts: Partial<Record<ElementCode, number>> = {};
    for (const el of allEls) {
      const key = el as ElementCode;
      elCounts[key] = (elCounts[key] ?? 0) + 1;
    }

    // 가장 많은 오행
    const sortedEls = Object.entries(elCounts).sort(([, a], [, b]) => b - a);
    const dominantEl = sortedEls[0]?.[0] ?? '';
    const dominantCount = sortedEls[0]?.[1] ?? 0;

    // 용신 포함 여부
    const hasYongshin = allEls.includes(yongshinEl);
    // 결핍 보완 여부
    const fillsDeficiency = deficientElements.some(d => allEls.includes(d));

    let pattern: string;
    if (hasYongshin && fillsDeficiency) {
      pattern = '용신 포함 + 결핍 보완 (최적 조합!)';
    } else if (hasYongshin) {
      pattern = '용신 포함 (좋은 조합)';
    } else if (fillsDeficiency) {
      pattern = '결핍 보완 (부분적 조합)';
    } else {
      pattern = '독자적 조합';
    }

    paragraphs.push(narrative(
      `${ev.fullHangul}: 자원오행 [${ev.charElements.map(e => elShort(e)).join('+')}] + ` +
      `수리오행 [${ev.suriElements.map(e => elShort(e)).join('→')}] — ` +
      `주력 오행 ${elShort(dominantEl)}(${dominantCount}회) — ${pattern}`,
    ));
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  심사위원 총평 (길게)
// ---------------------------------------------------------------------------

function buildJudgeVerdict(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
  yongshinEl: string,
  deficientElements: string[],
  name: string,
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  if (evaluations.length === 0) return paragraphs;

  paragraphs.push(emphasis(
    `${name}님을 위한 심사위원의 최종 총평`,
  ));

  const sorted = [...evaluations].sort((a, b) => b.totalScore - a.totalScore);
  const first = sorted[0];
  const avgScore = Math.round(sorted.reduce((s, ev) => s + ev.totalScore, 0) / sorted.length);

  // 1등 이름 추천 이유 종합
  paragraphs.push(positive(
    `심사위원이 추천하는 1순위 이름은 ${first.fullHangul}(${first.fullHanja})이에요! ` +
    `총점 ${first.totalScore}점으로 ${GRADE_LABEL[first.grade]}을(를) 받았어요.`,
    yongshinEl as ElementCode,
  ));

  // 1등 이름의 핵심 강점 서술
  const strengths: string[] = [];
  if (first.yongshinMatchCount > 0) {
    strengths.push(`용신 ${elShort(yongshinEl)}과(와) 일치하는 자원오행 ${first.yongshinMatchCount}글자`);
  }
  if (first.heeshinMatchCount > 0) {
    strengths.push(`희신과 일치하는 자원오행 ${first.heeshinMatchCount}글자`);
  }
  if (first.scoreB >= 22) {
    strengths.push('수리오행에서도 용신 부합도가 높음');
  }
  if (first.deficiencyFillCount > 0) {
    strengths.push(`사주 결핍 오행(${deficientElements.map(e => elShort(e)).join(',')}) 보완`);
  }
  if (first.sangsaengPairs === first.totalPairs && first.totalPairs > 0) {
    strengths.push('4격 전상생 달성');
  }

  if (strengths.length > 0) {
    paragraphs.push(positive(
      `핵심 강점: ${strengths.join(' / ')}`,
    ));
  }

  // 2등, 3등 추천 (있으면)
  if (sorted.length >= 2) {
    paragraphs.push(narrative(
      `2순위: ${sorted[1].fullHangul}(${sorted[1].totalScore}점, ${GRADE_LABEL[sorted[1].grade]})`,
    ));
  }
  if (sorted.length >= 3) {
    paragraphs.push(narrative(
      `3순위: ${sorted[2].fullHangul}(${sorted[2].totalScore}점, ${GRADE_LABEL[sorted[2].grade]})`,
    ));
  }

  // 전체 수준 요약
  paragraphs.push(narrative(
    `전체 ${sorted.length}개 이름의 평균 점수는 ${avgScore}점이에요. ` +
    (avgScore >= 70
      ? '전반적으로 훌륭한 이름 후보들이에요!'
      : avgScore >= 50
        ? '괜찮은 수준의 이름 후보들이에요. 상위권 이름을 우선 고려해보세요.'
        : '보완이 필요한 이름이 많지만, 가장 높은 점수의 이름을 중심으로 검토해보세요.'),
  ));

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  이름 선택 가이드 (등급별 조언)
// ---------------------------------------------------------------------------

function buildSelectionGuide(
  rng: SeededRandom,
  evaluations: NameEvaluation[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  paragraphs.push(emphasis('등급별 이름 선택 가이드'));

  paragraphs.push(narrative(
    '점수에 따라 S~D 등급으로 나뉘어요. 각 등급이 무엇을 의미하는지 알려드릴게요!',
  ));

  // 등급 설명 테이블은 아래 tables에서 생성하므로 여기서는 서술만
  paragraphs.push(positive(
    'S등급 (90~100점): 사주와 완벽하게 어울리는 이름이에요. 자원오행, 수리오행, 결핍 보완, 상생 흐름 모두 우수해요. 망설이지 말고 이 이름을 선택해도 좋아요!',
  ));

  paragraphs.push(positive(
    'A등급 (75~89점): 아주 좋은 이름이에요. 대부분의 항목에서 높은 점수를 받았어요. S등급과 큰 차이 없이 훌륭한 선택이 될 수 있어요.',
  ));

  paragraphs.push(narrative(
    'B등급 (60~74점): 괜찮은 이름이에요. 일부 항목에서 아쉬움이 있지만, 전체적으로 무난해요. 생활 속 보완법을 활용하면 더 좋아져요.',
  ));

  paragraphs.push(narrative(
    'C등급 (45~59점): 보통 수준이에요. 사주와의 궁합이 완벽하지는 않지만, 이름의 뜻이나 발음이 좋다면 그것도 큰 장점이에요.',
  ));

  paragraphs.push(encouraging(
    'D등급 (0~44점): 사주 궁합이 아쉬운 이름이지만, 이름은 점수가 전부가 아니에요! 뜻이 좋고 사랑이 담긴 이름이라면 충분히 가치 있어요.',
  ));

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  채점 기준 상세 설명 (교육적 내용)
// ---------------------------------------------------------------------------

function buildScoringExplanation(
  rng: SeededRandom,
  yongshinEl: string,
  heeshinEl: string | null,
  gishinEl: string | null,
  deficientElements: string[],
): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  paragraphs.push(emphasis('채점 기준 상세 설명'));

  paragraphs.push(narrative(
    pickAndFill(rng, SCORING_EXPLAIN_TEMPLATES),
  ));

  // A항목 설명
  paragraphs.push(narrative(
    '[A] 자원오행 용신 부합 (40점 만점)\n' +
    '자원오행이란 이름 한자의 뿌리(부수)에서 나오는 오행이에요. ' +
    '예를 들어 "물 수(水)" 부수가 들어간 한자는 수(水) 오행이죠. ' +
    `${safeName({} as ReportInput)}님의 사주에서 가장 필요한 용신은 ${elFull(yongshinEl)}이에요. ` +
    '이름 글자의 자원오행이 용신과 같으면 최고점(20점/글자), ' +
    '희신과 같으면 15점, 중립이면 8점, 기신이면 0점이에요.',
  ));

  // B항목 설명
  paragraphs.push(narrative(
    '[B] 수리오행 용신 부합 (30점 만점)\n' +
    '수리오행은 이름의 획수를 조합해서 나오는 오행이에요. ' +
    '원격, 형격, 이격, 정격 네 가지 격의 획수 끝자리로 오행을 정해요 ' +
    '(1,2=목, 3,4=화, 5,6=토, 7,8=금, 9,0=수). ' +
    '4격 중 용신/희신 오행과 같은 격이 많을수록 높은 점수(격당 7.5점)를 받아요.',
  ));

  // C항목 설명
  paragraphs.push(narrative(
    '[C] 결핍 보완도 (15점 만점)\n' +
    '사주에서 부족하거나 아예 없는 오행이 있는데, ' +
    (deficientElements.length > 0
      ? `현재 결핍 오행은 ${deficientElements.map(e => elFull(e)).join(', ')}이에요. `
      : '현재 사주에 결핍 오행은 없어요. ') +
    '이름의 오행(자원+수리)이 이 결핍 오행을 포함하면 만점(15점), ' +
    '일부만 포함하면 8점, 전혀 포함하지 않으면 0점이에요.',
  ));

  // D항목 설명
  paragraphs.push(narrative(
    '[D] 4격 상생 흐름 (15점 만점)\n' +
    '원격→형격→이격→정격 순서로 인접한 격의 오행이 서로 상생(도와주는 관계)이면 좋아요. ' +
    '3쌍 모두 상생이면 만점(15점), 2쌍이면 10점, 1쌍이면 5점, 0쌍이면 0점이에요. ' +
    '상생이란 목→화, 화→토, 토→금, 금→수, 수→목처럼 에너지가 자연스럽게 흐르는 관계예요.',
  ));

  return paragraphs;
}

// ---------------------------------------------------------------------------
//  메인 생성 함수
// ---------------------------------------------------------------------------

export function generateNameComparisonSection(input: ReportInput): ReportSection | null {
  // 후보 추출
  const rawCandidates = extractCandidates(input);
  if (rawCandidates.length === 0) return null;

  const candidates = rawCandidates.slice(0, MAX_COMPARISON_CANDIDATES);
  const omittedCandidateCount = Math.max(0, rawCandidates.length - candidates.length);

  const rng = createRng(input);
  for (let i = 0; i < 46; i++) rng.next();

  const name = safeName(input);

  // 용신/희신/기신/구신/결핍 추출
  const yongshinEl = input.saju?.yongshin?.element ?? '';
  const heeshinEl = input.saju?.yongshin?.heeshin ?? null;
  const gishinEl = input.saju?.yongshin?.gishin ?? null;
  const gusinEl = input.saju?.yongshin?.gushin ?? null;
  const deficientElements = input.saju?.deficientElements ?? [];

  if (!yongshinEl) return null; // 용신 없으면 비교 불가

  // ── 각 후보 평가 ──────────────────────────────────────────────────────────

  const evaluations: NameEvaluation[] = candidates.map(c =>
    evaluateCandidate(c, yongshinEl, heeshinEl, gishinEl, gusinEl, deficientElements),
  );

  // 점수 기준 내림차순 정렬 + 순위 부여
  evaluations.sort((a, b) => b.totalScore - a.totalScore);
  evaluations.forEach((ev, idx) => { ev.rank = idx + 1; });

  const engineCrossCheckEvaluations = evaluations.filter(hasEngineCrossCheckScore);
  const avgEngineCrossCheckScore = engineCrossCheckEvaluations.length > 0
    ? Math.round(
      engineCrossCheckEvaluations.reduce((sum, ev) => sum + ev.engineCrossCheckScore, 0) /
      engineCrossCheckEvaluations.length,
    )
    : null;

  // ── 본문 단락 생성 ────────────────────────────────────────────────────────

  const paragraphs: ReportParagraph[] = [];

  // --- 1. 도입부 ---
  paragraphs.push(narrative(
    pickAndFill(rng, INTRO_TEMPLATES),
  ));

  // 사주 핵심 정보 요약
  paragraphs.push(narrative(
    `먼저 ${name}님의 사주 핵심 정보를 정리할게요. ` +
    `용신(가장 필요한 오행)은 ${elFull(yongshinEl)}이에요. ` +
    (heeshinEl ? `희신(용신의 도우미)은 ${elFull(heeshinEl)}, ` : '') +
    (gishinEl ? `기신(피해야 할 오행)은 ${elFull(gishinEl)}이에요. ` : '') +
    (deficientElements.length > 0
      ? `사주에서 부족한 오행은 ${deficientElements.map(e => elFull(e)).join(', ')}이에요.`
      : '사주에 특별히 결핍된 오행은 없어요.'),
  ));

  // --- 2. 채점 기준 상세 설명 ---
  paragraphs.push(...buildScoringExplanation(
    rng, yongshinEl, heeshinEl, gishinEl, deficientElements,
  ));
  if (avgEngineCrossCheckScore !== null) {
    paragraphs.push(narrative(
      `참고로 이번 비교에서는 namingScoreEngine 교차검증 점수(평균 ${avgEngineCrossCheckScore}/100점)도 함께 확인했어요. ` +
      '다만 이 점수는 보조 지표이며, 순위와 등급은 기존 A~D 총점 기준으로만 산정했어요.',
    ));
  } else {
    paragraphs.push(narrative(
      '참고로 namingScoreEngine 교차검증 점수는 보조 지표로만 쓰이며, 이번 후보는 입력 오행 정보가 부족해 교차검증 점수를 산출하지 않았어요. ' +
      '순위와 등급은 기존 A~D 총점 기준으로만 산정했어요.',
    ));
  }

  // --- 3. 비교 매트릭스 소개 ---
  paragraphs.push(emphasis(
    `추천 이름 비교 매트릭스 (총 ${evaluations.length}개 이름)`,
  ));

  paragraphs.push(narrative(
    pickAndFill(rng, MATRIX_INTRO_TEMPLATES),
  ));

  if (omittedCandidateCount > 0) {
    paragraphs.push(tip(
      `후보가 매우 많아 핵심 비교 품질을 위해 상위 ${MAX_COMPARISON_CANDIDATES}개만 상세 비교했어요. 나머지 ${omittedCandidateCount}개는 요약 검토 대상으로 분리했어요.`,
    ));
  }

  // --- 4. 1등 발표 ---
  if (evaluations.length > 0) {
    const first = evaluations[0];
    paragraphs.push(positive(
      pickAndFill(rng, FIRST_PLACE_TEMPLATES, {
        이름: first.fullHangul || first.fullHanja,
        점수: String(first.totalScore),
      }),
      yongshinEl as ElementCode,
    ));
  }

  // --- 5. 등급 분포 분석 ---
  paragraphs.push(...buildGradeDistribution(rng, evaluations));

  // --- 6. 바 차트 소개 ---
  paragraphs.push(narrative(
    pickAndFill(rng, CHART_INTRO_TEMPLATES),
  ));

  // --- 7. 점수 격차 분석 ---
  paragraphs.push(...buildScoreGapAnalysis(rng, evaluations));

  // --- 8. 항목별 비교 분석 ---
  paragraphs.push(...buildItemComparisonAnalysis(rng, evaluations));

  // --- 9. 81수리 종합 비교 ---
  paragraphs.push(...buildSuri81ComparisonAnalysis(rng, evaluations));

  // --- 10. 오행 조합 패턴 분석 ---
  paragraphs.push(...buildElementPatternAnalysis(rng, evaluations, yongshinEl, deficientElements));

  // --- 11. 1등 이름 상세 분석 ---
  if (evaluations.length > 0) {
    paragraphs.push(emphasis(
      `1위 이름 상세 분석: ${evaluations[0].fullHangul}(${evaluations[0].fullHanja})`,
    ));
    paragraphs.push(...buildFirstPlaceAnalysis(
      rng, evaluations[0], yongshinEl, heeshinEl, gishinEl, deficientElements,
    ));
  }

  // --- 12. 개별 이름 서술 (2위부터) ---
  if (evaluations.length >= 2) {
    paragraphs.push(emphasis('나머지 이름 개별 분석'));

    const perNameNarrativeCount = Math.min(evaluations.length - 1, MAX_PER_NAME_NARRATIVE_COUNT - 1);
    for (let i = 1; i <= perNameNarrativeCount; i++) {
      paragraphs.push(...buildPerNameBrief(
        rng, evaluations[i], yongshinEl, heeshinEl, gishinEl, deficientElements,
      ));

      // 이름 간 구분선 (서술적)
      if (i < perNameNarrativeCount) {
        paragraphs.push(narrative('---'));
      }
    }

    if ((evaluations.length - 1) > perNameNarrativeCount) {
      paragraphs.push(tip(
        `개별 서술은 상위 ${MAX_PER_NAME_NARRATIVE_COUNT}개 후보까지만 표시했어요. 나머지 후보는 표와 차트에서 점수를 함께 확인해 주세요.`,
      ));
    }
  }

  // --- 13. 등급별 이름 선택 가이드 ---
  paragraphs.push(...buildSelectionGuide(rng, evaluations));

  // --- 14. 심사위원 최종 총평 ---
  paragraphs.push(...buildJudgeVerdict(
    rng, evaluations, yongshinEl, deficientElements, name,
  ));

  // --- 15. 보완 조언 ---
  paragraphs.push(...buildSupplementAdvice(
    rng, evaluations, yongshinEl, deficientElements,
  ));

  // --- 16. 마무리 ---
  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES),
  ));

  // ── 테이블 생성 ────────────────────────────────────────────────────────────

  const tables: ReportTable[] = [];

  // 비교 매트릭스 메인 테이블
  tables.push({
    title: '추천 이름 비교 매트릭스',
    headers: [
      '순위', '이름', '자원오행', '수리오행(4격)', '81수리 길흉',
      '용신부합(A)', '결핍보완(C)', '상생흐름(D)', '총점', '등급',
    ],
    rows: evaluations.map(ev => [
      `${ev.rank}위`,
      `${ev.fullHangul}(${ev.fullHanja})`,
      ev.charElements.map(e => elShort(e)).join('·') || '-',
      ev.suriElements.map(e => elShort(e)).join('→') || '-',
      ev.suriLucks.map(l => suriLuckKo(l)).join(', ') || '-',
      `${ev.scoreA}/40`,
      `${ev.scoreC}/15`,
      `${ev.scoreD}/15`,
      `${ev.totalScore}/100`,
      GRADE_LABEL[ev.grade],
    ]),
  });

  // 상세 점수 테이블
  tables.push({
    title: '항목별 상세 점수표',
    headers: [
      '이름', 'A.자원오행(40)', 'B.수리오행(30)', 'C.결핍보완(15)', 'D.상생흐름(15)', '총점(100)', '등급',
    ],
    rows: evaluations.map(ev => [
      ev.fullHangul,
      `${ev.scoreA}점`,
      `${ev.scoreB}점`,
      `${ev.scoreC}점`,
      `${ev.scoreD}점`,
      `${ev.totalScore}점`,
      `${ev.grade}등급`,
    ]),
  });

  // 용신/희신/기신 부합 상세 테이블
  tables.push({
    title: '자원오행 용신 부합 상세',
    headers: ['이름', '자원오행 구성', '용신 일치', '희신 일치', '기신 일치', 'A항목 점수'],
    rows: evaluations.map(ev => [
      ev.fullHangul,
      ev.charElements.map(e => elFull(e)).join(', ') || '-',
      `${ev.yongshinMatchCount}글자`,
      `${ev.heeshinMatchCount}글자`,
      `${ev.gishinMatchCount}글자`,
      `${ev.scoreA}/40점`,
    ]),
  });

  // 수리오행 상세 테이블
  if (evaluations.some(ev => ev.suriElements.length > 0)) {
    const frameNames = ['원격', '형격', '이격', '정격'];
    tables.push({
      title: '수리오행(4격) 상세 비교',
      headers: [
        '이름',
        ...frameNames.map((fn, i) => `${fn} (획수/오행/길흉)`),
        'B항목 점수',
      ],
      rows: evaluations.map(ev => [
        ev.fullHangul,
        ...frameNames.map((_, i) => {
          if (i >= ev.suriStrokes.length) return '-';
          const stroke = ev.suriStrokes[i];
          const el = ev.suriElements[i] ?? '';
          const luck = ev.suriLucks[i] ?? 'HALF';
          return `${stroke}획/${elShort(el)}/${suriLuckKo(luck)}`;
        }),
        `${ev.scoreB}/30점`,
      ]),
    });
  }

  // 등급 기준 테이블
  tables.push({
    title: '등급 기준표',
    headers: ['등급', '점수 범위', '의미', '추천도'],
    rows: [
      ['S등급', '90~100점', '사주와 완벽하게 어울리는 최우수 이름', '적극 추천'],
      ['A등급', '75~89점', '사주와 아주 잘 맞는 우수한 이름', '추천'],
      ['B등급', '60~74점', '무난하게 괜찮은 양호한 이름', '고려'],
      ['C등급', '45~59점', '보통 수준, 보완 필요', '조건부 고려'],
      ['D등급', '0~44점', '사주 궁합이 아쉬운 이름', '보완 필요'],
    ],
  });

  // 채점 기준 요약 테이블
  tables.push({
    title: '채점 기준 요약',
    headers: ['항목', '배점', '평가 기준'],
    rows: [
      ['A. 자원오행 용신 부합', '40점', `이름 한자의 자원오행이 용신(${elShort(yongshinEl)})과 일치하는 정도`],
      ['B. 수리오행 용신 부합', '30점', `4격 수리오행 중 용신/희신과 일치하는 격 수 (격당 7.5점)`],
      ['C. 결핍 보완도', '15점', `사주 결핍 오행(${deficientElements.map(e => elShort(e)).join(',') || '없음'})을 이름이 보완하는 정도`],
      ['D. 4격 상생 흐름', '15점', '인접 격 간 오행 상생 관계 비율 (3쌍 기준)'],
    ],
  });

  // 최종 추천 순위 테이블
  tables.push({
    title: '최종 추천 순위',
    headers: ['순위', '이름', '총점', '등급', '핵심 이유'],
    rows: evaluations.slice(0, Math.min(evaluations.length, 10)).map(ev => {
      const reasons: string[] = [];
      if (ev.yongshinMatchCount > 0) reasons.push(`용신(${elShort(yongshinEl)}) 직접 부합`);
      if (ev.heeshinMatchCount > 0) reasons.push('희신 부합');
      if (ev.deficiencyFillCount > 0) reasons.push(`결핍(${deficientElements.map(e => elShort(e)).join(',')}) 보완`);
      if (ev.sangsaengPairs === ev.totalPairs && ev.totalPairs > 0) reasons.push('4격 전상생');
      if (ev.suriLucks.every(l => l === 'GREAT' || l === 'GOOD')) reasons.push('81수리 전길');
      if (reasons.length === 0) reasons.push('무난한 조합');

      return [
        `${ev.rank}위`,
        `${ev.fullHangul}(${ev.fullHanja})`,
        `${ev.totalScore}/100`,
        `${ev.grade}등급`,
        reasons.join(', '),
      ];
    }),
  });

  // ── 차트 생성 ──────────────────────────────────────────────────────────────

  const charts: ReportChart[] = [];

  // 바 차트: 이름별 총점 비교
  const barData: Record<string, number | string> = {};
  for (const ev of evaluations) {
    barData[ev.fullHangul || `이름${ev.rank}`] = ev.totalScore;
  }
  charts.push({
    type: 'bar',
    title: '추천 이름별 종합 점수 비교',
    data: barData,
    meta: {
      max: 100,
      yLabel: '점수',
      xLabel: '이름',
      thresholds: {
        S: 90, A: 75, B: 60, C: 45,
      },
    },
  });

  // 바 차트: 항목별 점수 비교 (1등 이름)
  if (evaluations.length > 0) {
    const first = evaluations[0];
    charts.push({
      type: 'bar',
      title: `1위 ${first.fullHangul} 항목별 점수`,
      data: {
        'A.자원오행(40)': first.scoreA,
        'B.수리오행(30)': first.scoreB,
        'C.결핍보완(15)': first.scoreC,
        'D.상생흐름(15)': first.scoreD,
      },
      meta: {
        maxPerItem: { 'A.자원오행(40)': 40, 'B.수리오행(30)': 30, 'C.결핍보완(15)': 15, 'D.상생흐름(15)': 15 },
      },
    });
  }

  // 바 차트: 이름별 A항목 점수 비교
  if (evaluations.length >= 2) {
    const aData: Record<string, number | string> = {};
    for (const ev of evaluations) {
      aData[ev.fullHangul || `이름${ev.rank}`] = ev.scoreA;
    }
    charts.push({
      type: 'bar',
      title: 'A항목(자원오행) 점수 비교',
      data: aData,
      meta: { max: 40, yLabel: '점수' },
    });

    // B항목 비교
    const bData: Record<string, number | string> = {};
    for (const ev of evaluations) {
      bData[ev.fullHangul || `이름${ev.rank}`] = ev.scoreB;
    }
    charts.push({
      type: 'bar',
      title: 'B항목(수리오행) 점수 비교',
      data: bData,
      meta: { max: 30, yLabel: '점수' },
    });
  }

  // ── 하이라이트 생성 ─────────────────────────────────────────────────────────

  const highlights: ReportHighlight[] = [];

  // 1등 이름
  if (evaluations.length > 0) {
    const first = evaluations[0];
    highlights.push({
      label: '1위 추천 이름',
      value: `${first.fullHangul} (${first.totalScore}점, ${first.grade}등급)`,
      element: yongshinEl as ElementCode || undefined,
      sentiment: first.grade === 'S' || first.grade === 'A' ? 'good' : 'neutral',
    });
  }

  // 비교 이름 수
  highlights.push({
    label: '비교 이름 수',
    value: `${evaluations.length}개`,
    sentiment: 'neutral',
  });

  // 평균 점수
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((s, ev) => s + ev.totalScore, 0) / evaluations.length)
    : 0;
  highlights.push({
    label: '평균 점수',
    value: `${avgScore}/100점`,
    sentiment: avgScore >= 70 ? 'good' : avgScore >= 50 ? 'neutral' : 'caution',
  });

  if (avgEngineCrossCheckScore !== null) {
    highlights.push({
      label: '엔진 교차검증 평균',
      value: `${avgEngineCrossCheckScore}/100점 (보조)`,
      sentiment: avgEngineCrossCheckScore >= 70 ? 'good' : avgEngineCrossCheckScore >= 50 ? 'neutral' : 'caution',
    });
  } else {
    highlights.push({
      label: '엔진 교차검증',
      value: '입력 부족으로 산출 없음',
      sentiment: 'neutral',
    });
  }

  // S등급 이름 수
  const sCount = evaluations.filter(ev => ev.grade === 'S').length;
  if (sCount > 0) {
    highlights.push({
      label: 'S등급 이름',
      value: `${sCount}개`,
      sentiment: 'good',
    });
  }

  // 용신 부합 최고 이름
  const bestA = [...evaluations].sort((a, b) => b.scoreA - a.scoreA)[0];
  if (bestA) {
    highlights.push({
      label: '자원오행 최우수',
      value: `${bestA.fullHangul} (${bestA.scoreA}/40점)`,
      element: yongshinEl as ElementCode || undefined,
      sentiment: bestA.scoreA >= 30 ? 'good' : 'neutral',
    });
  }

  // 기신 일치 경고
  const gishinNames = evaluations.filter(ev => ev.gishinMatchCount > 0);
  if (gishinNames.length > 0) {
    const cappedNames = gishinNames
      .slice(0, MAX_GISHIN_HIGHLIGHT_NAMES)
      .map(n => n.fullHangul);
    const extraCount = gishinNames.length - cappedNames.length;
    highlights.push({
      label: '기신 주의 이름',
      value: extraCount > 0
        ? `${gishinNames.length}개 (${cappedNames.join(', ')} 외 ${extraCount}개)`
        : `${gishinNames.length}개 (${cappedNames.join(', ')})`,
      element: gishinEl as ElementCode || undefined,
      sentiment: 'caution',
    });
  }

  // ── 섹션 반환 ──────────────────────────────────────────────────────────────

  return {
    id: 'nameComparison',
    title: '추천 이름 비교 매트릭스',
    subtitle: '이름 심사위원의 공정한 비교 평가',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    charts: charts.length > 0 ? charts : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}
