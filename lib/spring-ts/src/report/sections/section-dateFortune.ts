/**
 * section-dateFortune.ts -- Detailed date-fortune report generation engine
 *
 * Produces premium-quality, long-form Korean fortune reports for year, month,
 * and day modes. Each report includes rich subsections, highlight badges,
 * charts, and tables drawn from stem/branch/element encyclopedias.
 */

import type {
  ReportParagraph,
  ReportHighlight,
  ReportSubsection,
  ReportChart,
  ReportTable,
  ElementCode,
} from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  caution,
  tip,
  emphasis,
  joinSentences,
} from '../common/sentenceUtils.js';
import { STEM_ENCYCLOPEDIA } from '../knowledge/stemEncyclopedia.js';
import { BRANCH_ENCYCLOPEDIA } from '../knowledge/branchEncyclopedia.js';
import { ELEMENT_ENCYCLOPEDIA } from '../knowledge/elementEncyclopedia.js';
import {
  ELEMENT_KOREAN,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_GENERATE_VERB,
  ELEMENT_CONTROL_VERB,
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_NATURE,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_FOOD,
  ELEMENT_HOBBY,
  ELEMENT_NUMBER,
  ELEMENT_TASTE,
} from '../common/elementMaps.js';
import type { PillarFortune } from '../common/dateFortune.js';

// ---------------------------------------------------------------------------
//  1. Exported types
// ---------------------------------------------------------------------------

export interface YongshinInfo {
  readonly element: string;
  readonly heeshin: string | null;
  readonly gushin: string | null;
  readonly gishin: string | null;
}

export interface DetailedFortuneReport {
  readonly mode: 'year' | 'month' | 'day';
  readonly title: string;
  readonly subtitle: string;
  readonly paragraphs: ReportParagraph[];
  readonly highlights: ReportHighlight[];
  readonly subsections: ReportSubsection[];
  readonly charts: ReportChart[];
  readonly tables: ReportTable[];
}

// ---------------------------------------------------------------------------
//  2. Stem / Branch hangul-to-code lookup maps
// ---------------------------------------------------------------------------

const STEM_HANGUL_TO_CODE: Record<string, string> = {
  '갑': 'GAP', '을': 'EUL', '병': 'BYEONG', '정': 'JEONG', '무': 'MU',
  '기': 'GI', '경': 'GYEONG', '신': 'SIN', '임': 'IM', '계': 'GYE',
};

const BRANCH_HANGUL_TO_CODE: Record<string, string> = {
  '자': 'JA', '축': 'CHUK', '인': 'IN', '묘': 'MYO',
  '진': 'JIN', '사': 'SA', '오': 'O', '미': 'MI',
  '신': 'SIN_BRANCH', '유': 'YU', '술': 'SUL', '해': 'HAE',
};

// ---------------------------------------------------------------------------
//  3. Element interaction helpers
// ---------------------------------------------------------------------------

function getRelation(
  fromEl: string,
  toEl: string,
): 'generates' | 'generated_by' | 'controls' | 'controlled_by' | 'same' | 'neutral' {
  if (fromEl === toEl) return 'same';
  if (ELEMENT_GENERATES[fromEl as ElementCode] === toEl) return 'generates';
  if (ELEMENT_GENERATED_BY[fromEl as ElementCode] === toEl) return 'generated_by';
  if (ELEMENT_CONTROLS[fromEl as ElementCode] === toEl) return 'controls';
  if (ELEMENT_CONTROLLED_BY[fromEl as ElementCode] === toEl) return 'controlled_by';
  return 'neutral';
}

function relationKorean(rel: string): string {
  switch (rel) {
    case 'generates': return '상생(生)';
    case 'generated_by': return '생조(生助)';
    case 'controls': return '상극(克)';
    case 'controlled_by': return '피극(被克)';
    case 'same': return '동일(同)';
    default: return '중립';
  }
}

// ---------------------------------------------------------------------------
//  4. Encyclopedia lookup helpers
// ---------------------------------------------------------------------------

function lookupStem(hangul: string) {
  const code = STEM_HANGUL_TO_CODE[hangul];
  if (!code) return null;
  return STEM_ENCYCLOPEDIA[code as keyof typeof STEM_ENCYCLOPEDIA] ?? null;
}

function lookupBranch(hangul: string) {
  const code = BRANCH_HANGUL_TO_CODE[hangul];
  if (!code) return null;
  return BRANCH_ENCYCLOPEDIA[code] ?? null;
}

function lookupElement(elCode: string) {
  return ELEMENT_ENCYCLOPEDIA[elCode] ?? null;
}

function elShort(code: string): string {
  return ELEMENT_KOREAN_SHORT[code as ElementCode] ?? code;
}

function elFull(code: string): string {
  return ELEMENT_KOREAN[code as ElementCode] ?? code;
}

// ---------------------------------------------------------------------------
//  5. Grade-to-sentiment mapping
// ---------------------------------------------------------------------------

type GradeSentiment = 'good' | 'caution' | 'neutral';

function gradeToSentiment(grade: number): GradeSentiment {
  if (grade >= 4) return 'good';
  if (grade <= 2) return 'caution';
  return 'neutral';
}

function gradeStars(grade: number): string {
  const filled = grade;
  const empty = 5 - grade;
  return '\u2605'.repeat(filled) + '\u2606'.repeat(empty);
}

// ---------------------------------------------------------------------------
//  6. Template banks
// ---------------------------------------------------------------------------

// --- 6a. Year base energy templates ---
const YEAR_BASE_ENERGY_TEMPLATES = [
  '{{year}}년은 {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})의 해입니다. {{elKo}} 기운이 중심이 되는 한 해로, {{nature}}의 에너지가 전체 흐름을 이끕니다.',
  '{{year}}년은 {{stemKo}}{{branchKo}}년({{stemHj}}{{branchHj}}년)으로, {{elKo}}의 기운이 한 해의 흐름을 좌우합니다. {{nature}}이 생활 전반에 영향을 미칩니다.',
  '{{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})로 시작되는 {{year}}년은 {{elKo}} 기운이 가득한 해입니다. {{nature}}의 흐름 속에서 한 해를 설계해 보세요.',
  '올해 {{year}}년은 {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})의 기운 아래 펼쳐집니다. {{elKo}}의 에너지, 즉 {{nature}}이 일상의 방향타가 됩니다.',
  '{{year}}년의 주인공은 {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})입니다. {{elKo}} 오행이 중심이 되어 {{nature}}이 한 해를 관통하는 핵심 에너지입니다.',
  '{{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}}) {{year}}년은 {{elKo}}의 에너지가 지배하는 해입니다. {{nature}}을 이해하면 올해의 흐름을 더욱 현명하게 활용할 수 있습니다.',
];

// --- 6b. Yongshin match templates (by grade) ---
const YONGSHIN_GRADE5_TEMPLATES = [
  '올해의 기운은 용신인 {{yongEl}}과 정확히 일치합니다. 이는 최상의 흐름을 의미하며, 적극적으로 기회를 잡아보세요.',
  '용신 {{yongEl}}과 올해 에너지가 완벽하게 부합합니다! 어떤 도전이든 자신감 있게 밀고 나가세요.',
  '용신 오행인 {{yongEl}}이 올해의 주도 에너지입니다. 가장 좋은 흐름이니 적극적으로 활용하세요.',
  '최고 등급의 부합도입니다. 용신 {{yongEl}}과 올해 기운이 하나가 되어 모든 영역에서 순풍을 기대할 수 있습니다.',
  '용신 {{yongEl}}이 올해의 하늘 기운과 정확히 맞물려 있어, 원하는 목표를 이루기에 최적의 해입니다.',
];

const YONGSHIN_GRADE4_TEMPLATES = [
  '올해의 기운은 희신인 {{heeEl}}과 부합하여 전반적으로 좋은 흐름입니다. 꾸준히 노력하면 성과가 따라옵니다.',
  '희신 오행 {{heeEl}}과 올해 기운이 잘 맞습니다. 안정적인 진전이 기대되는 해입니다.',
  '희신 {{heeEl}}의 영향으로 올해는 대체로 편안한 흐름입니다. 적극적인 활동과 함께 쥐소의 수비를 병행하세요.',
  '올해는 희신 {{heeEl}}의 기운을 받아 순탄하게 흐르는 해입니다. 무리하지 않으면서도 꾸준히 전진해 보세요.',
  '희신인 {{heeEl}}과 연결된 올해, 조급해하지 않고 착실하게 나아가면 좋은 결과가 따라옵니다.',
];

const YONGSHIN_GRADE3_TEMPLATES = [
  '올해의 기운은 용신과 직접 연결되지는 않지만, 큰 문제 없이 다룰 수 있는 보통의 흐름입니다.',
  '중립적인 에너지의 해입니다. 균형을 유지하며 안정적으로 운영하는 것이 중요합니다.',
  '올해는 특별히 좋거나 나쁜 기운이 아닌, 균형 잡힌 해입니다. 기본에 충실하면 안정적인 성과를 기대할 수 있습니다.',
  '보통의 흐름 속에서도 노력에 따라 충분히 좋은 결과를 만들 수 있습니다. 기본기를 탄탄히 해보세요.',
  '올해는 변화보다는 유지와 실력 축적에 집중하기 좋은 해입니다. 조급해하지 말고 꾸준히 나아가세요.',
];

const YONGSHIN_GRADE2_TEMPLATES = [
  '올해의 기운은 구신 {{guEl}}과 관련되어 신중한 계획이 필요합니다. 하지만 이는 위험이 아니라 주의력을 높여야 한다는 신호입니다.',
  '구신 {{guEl}}의 영향으로 올해는 계획적으로 접근해야 합니다. 철저한 준비가 좋은 결과로 이어집니다.',
  '올해는 다소 신경 쓸 부분이 있지만, 미리 대비하면 충분히 극복할 수 있습니다. 신중함이 오히려 성장의 발판이 됩니다.',
  '구신 {{guEl}} 기운이 흐르는 해이므로, 토대를 단단히 하고 한 걸음씩 전진하는 전략이 효과적입니다.',
  '주의가 필요한 해이지만, 너무 걱정하지 마세요. 인식하고 준비하는 것 자체가 가장 강력한 대비입니다.',
];

const YONGSHIN_GRADE1_TEMPLATES = [
  '올해의 기운은 기신 {{giEl}}과 관련되어 신중함이 특히 중요합니다. 하지만 이를 인식하는 것만으로도 큰 힘이 됩니다.',
  '기신 {{giEl}}의 기운이 흐르는 해이지만, 이를 잘 이해하고 대비하면 오히려 내면을 다지는 기회가 됩니다.',
  '최대한 조심하며 안정적으로 운영하는 것이 좋습니다. 기신 {{giEl}} 기운을 인식하고, 보완하는 활동에 집중해 보세요.',
  '어려운 흐름이라고 해서 나쁜 해라는 뜻은 아닙니다. 더욱 신중하게 준비하고 내면을 가꾸면 다음 해에 큰 도약이 됩니다.',
  '기신 {{giEl}} 기운이 강한 해이지만, 건강과 안정에 집중하면 충분히 잘 보낼 수 있습니다. 평소보다 자기 관리에 투자해 보세요.',
];

// --- 6c. Element flow templates ---
const ELEMENT_FLOW_TEMPLATES = [
  '올해의 {{yearEl}} 기운과 용신의 {{yongEl}} 기운은 {{relation}} 관계입니다. {{desc}}',
  '{{yearEl}}과 {{yongEl}} 사이의 {{relation}} 흐름을 이해하면 올해의 에너지를 더 효과적으로 활용할 수 있습니다.',
  '오행의 흐름에서 {{yearEl}}과 {{yongEl}}은 {{relation}}으로 연결됩니다. 이 관계를 이해하면 올 한 해의 전략을 세울 수 있습니다.',
  '{{yearEl}} 기운이 {{yongEl}} 기운과 {{relation}} 관계에 있어, {{desc}}',
  '올해의 주도 오행인 {{yearEl}}은 용신 {{yongEl}}과 {{relation}} 관계에 놓여 있습니다. {{desc}}',
];

// --- 6d. Wealth & career templates ---
const WEALTH_CAREER_TEMPLATES_POSITIVE = [
  '재물운이 안정적이며 새로운 기회가 열릴 수 있습니다. 특히 {{workTip}}에 집중하면 성과가 더욱 닿니다.',
  '직업적으로 발전이 기대되는 해입니다. {{workTip}}을 실천하면 더욱 좋은 결과를 얻을 수 있습니다.',
  '경제적 안정을 기반으로 성장의 발판을 마련할 수 있는 해입니다. {{workTip}}',
  '재물과 직업 모두 순풍의 흐름입니다. {{workTip}}을 통해 더욱 탄탄한 기반을 만들어 보세요.',
];

const WEALTH_CAREER_TEMPLATES_CAUTIOUS = [
  '재물운은 신중하게 관리하는 것이 좋습니다. 큰 투자보다는 안정적인 저축과 실력 업그레이드에 집중해 보세요.',
  '직업적으로는 기본기를 탄탄히 하는 해입니다. {{workTip}}을 통해 내실을 다져보세요.',
  '경제적 결정은 섣불리 하지 말고 충분히 검토한 후 움직이세요. {{workTip}}',
  '재물 관리에 조금 더 신경 쓰면서, 장기적 관점으로 접근하세요. {{workTip}}',
];

// --- 6e. Relationship templates ---
const RELATIONSHIP_TEMPLATES = [
  '올해 인간관계에서는 {{relTip}}이 핵심입니다. {{branchAnimal}}의 해인 만큼, {{branchTrait}}는 점을 기억해 두세요.',
  '{{relTip}} 이 조언을 실천하면 인간관계가 한층 원활해집니다. 특히 {{branchAnimal}}띠 해에는 {{branchTrait}}',
  '사람들과의 관계에서 {{relTip}} 또한 {{branchAnimal}}의 해에는 {{branchTrait}}',
  '올해의 대인관계 핵심은 {{relTip}}입니다. {{branchAnimal}}의 기운 속에서 {{branchTrait}}',
];

// --- 6f. Health templates ---
const HEALTH_TEMPLATES = [
  '{{elKo}} 기운이 중심인 해이므로 {{organ}} 건강에 신경 쓰세요. {{supplementTip}}',
  '건강 면에서는 {{organ}}을 특히 주의하세요. {{supplementTip}} 또한 감정적으로 {{emotionNeg}}을 조절하는 것이 중요합니다.',
  '{{organ}} 건강을 중점적으로 챙겨보세요. {{supplementTip}} {{emotionPos}}을 키워나가면 모든 면에서 균형이 잡힙니다.',
  '올해 건강의 핵심은 {{organ}}입니다. {{supplementTip}} 감정 관리로는 {{emotionNeg}}을 주의하고 {{emotionPos}}을 근가에 두세요.',
];

// --- 6g. Core advice templates ---
const CORE_ADVICE_TEMPLATES = [
  '{{habit}} 이것을 실천하면 올해의 흐름을 더욱 잘 활용할 수 있습니다.',
  '{{habit}} 이 습관을 통해 한 해를 더욱 알차게 보낼 수 있습니다.',
  '핵심 실천 포인트로 {{habit}}을 추천합니다.',
  '올해의 핵심 조언: {{habit}}',
];

// --- 6h. Month/Day-specific templates ---
const MONTH_BASE_TEMPLATES = [
  '{{year}}년 {{month}}월은 {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}}) 기운이 흐릅니다. {{elKo}}의 에너지가 이 달의 주도 흐름입니다.',
  '{{month}}월의 하늘 기운은 {{stemKo}}({{stemHj}})이며, 땅 기운은 {{branchKo}}({{branchHj}})입니다. {{elKo}} 에너지가 이 달을 이끕니다.',
  '{{year}}년 {{month}}월, {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})의 달입니다. {{elKo}} 기운 속에서 한 달을 설계해 보세요.',
  '{{month}}월은 {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})의 기운 아래 펼쳐지는 달입니다. {{elKo}} 에너지를 이해하면 이 달을 더 현명하게 보낼 수 있습니다.',
  '{{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})의 {{month}}월, {{elKo}} 기운이 주도하는 한 달이 시작됩니다.',
];

const DAY_BASE_TEMPLATES = [
  '{{year}}년 {{month}}월 {{day}}일은 {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})일입니다. {{elKo}} 기운이 오늘의 흐름을 좌우합니다.',
  '오늘은 {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})일로, {{elKo}} 에너지가 중심이 되는 하루입니다.',
  '{{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}}) {{month}}월 {{day}}일, {{elKo}} 기운이 오늘 하루의 방향을 가리킵니다.',
  '오늘의 하늘 기운은 {{stemKo}}({{stemHj}}), 땅 기운은 {{branchKo}}({{branchHj}})입니다. {{elKo}} 에너지 속에서 하루를 바라보세요.',
  '{{year}}년 {{month}}월 {{day}}일, {{stemKo}}{{branchKo}}({{stemHj}}{{branchHj}})의 에너지가 오늘을 감쌉니다. {{elKo}} 기운을 이해하고 활용해 보세요.',
];

// --- 6i. Year-month interaction templates ---
const YEAR_MONTH_INTERACTION_TEMPLATES = [
  '연운의 {{yearEl}}과 이 달의 {{monthEl}}은 {{relation}} 관계입니다. {{desc}}',
  '{{yearEl}} 기운의 해 속에서 {{monthEl}} 기운의 달이 펼쳐집니다. 두 기운은 {{relation}} 관계로, {{desc}}',
  '이 달의 {{monthEl}} 기운은 연운 {{yearEl}}과 {{relation}} 관계에 놓여 있습니다. {{desc}}',
];

// --- 6j. Closing encouragement templates ---
const CLOSING_TEMPLATES = [
  '오늘 하루도 힘내세요! {{nature}}의 기운이 함께합니다.',
  '하루하루가 모여 큰 흐름이 됩니다. 오늘도 좋은 하루 되세요!',
  '당신의 하루를 응원합니다. 오늘도 의미 있는 한 걸음을 내딛어 보세요.',
  '오늘 하루, 작지만 확실한 실천 하나가 큰 변화를 만듭니다. 화이팅!',
  '오늘의 기운이 당신의 모든 순간에 좋은 에너지를 불어넣기를 바랍니다.',
];

// --- 6k. Romance/Love templates ---
const ROMANCE_TEMPLATES_POSITIVE = [
  '{{elKo}} 기운이 감싸는 이 시기, 연애운이 밝게 빛나고 있습니다. {{relTip}} 감정적으로 {{emotionPos}}이 충만해지는 흐름이니, 마음을 열고 적극적으로 다가가 보세요. 새로운 인연을 만날 가능성도 높습니다.',
  '애정 운이 상승세입니다. {{emotionPos}}의 에너지가 관계를 더욱 깊고 따뜻하게 만들어 줍니다. {{relTip}} 솔로라면 자연스러운 만남에 열린 마음을 가져보세요. 커플이라면 서로의 장점을 재발견하는 시간이 될 수 있습니다.',
  '이 시기의 {{elKo}} 에너지는 사랑과 교감을 촉진합니다. {{relTip}} {{emotionPos}}을 바탕으로 진심 어린 대화를 나누면 관계가 한 단계 성장할 수 있습니다. 감사의 마음을 표현하는 것이 행운을 부릅니다.',
  '연애와 애정 면에서 순풍이 부는 시기입니다. {{elKo}} 기운 아래 {{emotionPos}}이 자연스럽게 피어납니다. {{relTip}} 연인이 있다면 함께하는 시간의 질을 높여보세요. 혼자라면 자기 자신을 사랑하는 것에서 좋은 인연이 시작됩니다.',
  '사랑의 기운이 가득한 시기입니다. {{relTip}} {{emotionPos}}의 따뜻한 에너지가 당신의 매력을 한층 높여줍니다. 상대방에 대한 이해와 배려를 실천하면 관계의 깊이가 달라집니다. 설렘을 즐기되 진정성을 잃지 마세요.',
];

const ROMANCE_TEMPLATES_CAUTIOUS = [
  '연애 면에서는 다소 신중함이 필요한 시기입니다. {{elKo}} 기운 속에서 {{emotionNeg}}이 올라올 수 있으니 감정 조절에 유의하세요. {{relTip}} 급하게 관계를 진전시키기보다는 서로를 더 깊이 이해하는 시간으로 삼으세요.',
  '애정 면에서 약간의 파도가 있을 수 있는 시기입니다. {{emotionNeg}}을 다스리는 것이 관계의 열쇠가 됩니다. {{relTip}} 오해가 생기기 쉬운 때이므로, 대화할 때 한 번 더 생각하고 말하는 습관이 중요합니다.',
  '연애운이 조금 정체된 듯 느껴질 수 있으나, 이는 관계를 돌아보는 소중한 시간입니다. {{relTip}} {{emotionNeg}}에 휘둘리지 말고, 내면의 안정을 먼저 찾으세요. 자기 자신을 돌보는 것이 결국 더 좋은 인연을 부릅니다.',
  '감정적으로 예민해질 수 있는 시기이므로 연애에서는 한 발짝 여유를 두는 것이 좋습니다. {{relTip}} {{emotionNeg}}이 관계에 영향을 미치지 않도록 자기만의 시간을 가져보세요. 성급한 결정은 미루는 것이 현명합니다.',
  '이 시기에는 연애보다 자기 자신에게 집중하는 것이 오히려 좋은 결과를 가져옵니다. {{relTip}} {{emotionNeg}}을 인식하고 건강한 방법으로 해소하세요. 마음의 여유가 생기면 자연스럽게 좋은 인연이 찾아옵니다.',
];

// --- 6l. Academic/Self-development templates ---
const ACADEMIC_TEMPLATES_POSITIVE = [
  '학업과 자기계발에 좋은 흐름이 이어지고 있습니다. {{elKo}} 기운이 집중력과 이해력을 높여주는 시기입니다. {{studyTip}} 새로운 분야를 배우기 시작하거나 자격증에 도전하기에도 적합한 때입니다.',
  '자기계발의 의지가 빛을 발하는 시기입니다. {{studyTip}} {{elKo}} 에너지가 학습 효율을 끌어올려 줍니다. 그동안 미뤄왔던 공부나 기술 습득에 본격적으로 뛰어들어 보세요. 꾸준한 노력이 큰 성과로 돌아옵니다.',
  '학습 운이 높은 시기입니다. {{elKo}} 기운 아래 새로운 지식을 흡수하는 능력이 평소보다 향상됩니다. {{studyTip}} 독서, 온라인 강의, 세미나 참석 등 지적 활동에 적극적으로 투자하면 큰 보람을 느낄 수 있습니다.',
  '자기 성장에 최적의 에너지가 흐르고 있습니다. {{studyTip}} {{elKo}}의 기운을 활용하여 장기적인 학습 계획을 세워보세요. 한 번에 많이 하기보다 매일 조금씩 꾸준히 하는 것이 이 시기에 가장 효과적인 전략입니다.',
];

const ACADEMIC_TEMPLATES_CAUTIOUS = [
  '학업과 자기계발 면에서는 조급함을 내려놓는 것이 중요합니다. {{elKo}} 기운이 집중력을 흐트릴 수 있으니 학습 환경을 정돈하는 것부터 시작하세요. {{studyTip}} 작은 목표를 세우고 하나씩 달성해 나가면 자신감이 쌓입니다.',
  '이 시기에는 새로운 것을 시작하기보다 기존에 배운 것을 복습하고 다지는 것이 효과적입니다. {{studyTip}} {{elKo}} 에너지가 다소 산만할 수 있으니, 한 가지에 집중하는 연습을 해보세요.',
  '자기계발은 꾸준함이 핵심인 시기입니다. 당장 눈에 보이는 성과가 없더라도 포기하지 마세요. {{studyTip}} {{elKo}} 기운 속에서 인내심을 갖고 기초를 탄탄히 하면, 다음 시기에 큰 도약이 가능합니다.',
  '학업 면에서 약간의 정체감이 느껴질 수 있지만, 이는 실력이 내면에서 숙성되는 과정입니다. {{studyTip}} 무리한 계획보다는 현실적인 목표 설정이 중요합니다. {{elKo}} 기운에 맞춰 리듬을 조절하며 나아가세요.',
];

// --- 6m. Wealth-only templates ---
const WEALTH_TEMPLATES_POSITIVE = [
  '재물운이 안정적으로 상승하는 시기입니다. {{elKo}} 기운이 금전적 기회를 열어주고 있으니, 평소 관심 있던 투자나 재테크에 한 발짝 나아가 볼 수 있습니다. 다만 욕심을 부리기보다는 안정적인 수익 구조를 우선시하세요. {{direction}} 방향과 {{color}} 색상이 금전운을 더욱 높여줍니다.',
  '경제적으로 좋은 흐름이 이어지는 시기입니다. {{elKo}} 에너지가 재물의 순환을 원활하게 해줍니다. 수입이 늘어나거나 예상치 못한 이익이 생길 수 있습니다. 하지만 과소비에 주의하고, 번 만큼 저축하는 습관을 유지하세요.',
  '재물운이 밝습니다. {{elKo}} 기운 아래 새로운 수입원이 열리거나 기존 자산이 안정적으로 성장할 수 있는 시기입니다. {{color}} 계열의 지갑이나 소품이 금전 에너지를 강화해 줍니다. 계획적인 소비와 저축의 균형을 유지하면 재물이 쌓입니다.',
  '이 시기에는 재물이 자연스럽게 따라오는 흐름입니다. {{elKo}} 에너지를 활용하여 재무 계획을 점검하고, 장기적인 투자 전략을 세워보세요. {{direction}} 방향에 위치한 공간에서 중요한 금전 결정을 내리면 좋은 결과가 기대됩니다.',
];

const WEALTH_TEMPLATES_CAUTIOUS = [
  '재물 면에서는 보수적인 접근이 현명한 시기입니다. {{elKo}} 기운이 금전적 판단을 흐리게 할 수 있으니, 큰 지출이나 투자 결정은 충분히 숙고한 후에 진행하세요. 고위험 투자는 피하고, 안정적인 저축에 집중하는 것이 좋습니다.',
  '재물운이 다소 정체될 수 있는 시기입니다. {{elKo}} 에너지 속에서 충동적인 소비 욕구가 생길 수 있으니 주의하세요. 예산을 미리 세우고 계획적으로 지출하면 오히려 이 시기를 재정 건전성을 높이는 기회로 만들 수 있습니다.',
  '금전적으로 신중함이 최고의 전략인 시기입니다. {{elKo}} 기운이 예상치 못한 지출을 가져올 수 있으니 비상금을 확보해 두세요. 빌려주거나 보증서는 것은 삼가고, 자신의 재정 상태를 꼼꼼히 점검하는 시간으로 활용하세요.',
  '재물운이 주춤하는 시기이지만 걱정할 필요는 없습니다. {{elKo}} 에너지 속에서 절약하고 실속을 챙기는 것이 오히려 미래의 큰 재산이 됩니다. 불필요한 구독이나 지출을 점검하고, 꼭 필요한 곳에만 돈을 쓰는 연습을 해보세요.',
];

// --- 6n. Career-only templates ---
const CAREER_TEMPLATES_POSITIVE = [
  '직업운이 상승 기류를 타는 시기입니다. {{workTip}} 당신의 강점인 {{strength}} 능력이 빛을 발할 때입니다. 새로운 프로젝트 제안이나 이직, 승진의 기회가 찾아올 수 있으니 준비를 게을리하지 마세요.',
  '사업과 직업 면에서 발전이 기대되는 시기입니다. {{workTip}} {{strength}}을 적극 활용하면 동료와 상사의 신뢰를 얻을 수 있습니다. 리더십을 발휘하거나 창의적인 아이디어를 제시하기에 좋은 때입니다.',
  '커리어에 순풍이 부는 시기입니다. {{workTip}} 특히 {{strength}} 역량을 중심으로 업무 성과를 낼 수 있습니다. 네트워킹에도 신경 쓰면 뜻밖의 좋은 기회가 연결될 수 있습니다. 자신감을 갖고 주도적으로 움직여 보세요.',
  '직업적 성장의 발판을 마련할 수 있는 좋은 시기입니다. {{workTip}} {{strength}}을 살려 자신만의 영역을 넓혀보세요. 장기적인 커리어 비전을 세우고 그에 맞는 실천 계획을 수립하면, 이 시기의 노력이 큰 결실로 돌아옵니다.',
];

const CAREER_TEMPLATES_CAUTIOUS = [
  '직업 면에서는 안정과 내실 다지기에 집중하는 것이 좋은 시기입니다. {{workTip}} 당장의 성과보다는 실력을 쌓고 기반을 탄탄히 하세요. {{strength}} 능력을 조용히 갈고닦으면 다음 기회가 왔을 때 크게 도약할 수 있습니다.',
  '사업이나 직장에서 다소 답답함을 느낄 수 있는 시기입니다. {{workTip}} 하지만 지금의 인내가 미래의 성공을 준비하는 과정입니다. {{strength}}을 바탕으로 묵묵히 자기 역할에 충실하면, 주변의 평가가 달라질 것입니다.',
  '직업 면에서 큰 변화보다는 현 위치에서의 성장에 초점을 맞추세요. {{workTip}} {{strength}} 역량을 발전시키는 데 시간과 에너지를 투자하면, 정체기를 성장기로 바꿀 수 있습니다. 조급함을 내려놓고 한 걸음씩 전진하세요.',
  '커리어 면에서는 수비에 무게를 두는 것이 현명합니다. {{workTip}} 직장 내 갈등이나 오해가 생기기 쉬운 때이므로, 커뮤니케이션에 특히 신경 쓰세요. {{strength}}을 조용히 발휘하며 신뢰를 쌓아가는 전략이 효과적입니다.',
];

// --- 6o. Lucky point templates ---
const LUCKY_POINT_INTRO_TEMPLATES = [
  '{{elKo}} 기운에 맞춰 행운을 끌어당기는 요소들을 정리했습니다. 일상 속에서 이 포인트들을 활용하면 좋은 에너지를 더욱 가까이 느낄 수 있습니다.',
  '오행의 지혜를 바탕으로 한 행운 포인트입니다. {{elKo}} 에너지에 맞는 색상, 음식, 활동 등을 일상에 녹여보세요. 작은 실천이 큰 행운을 부릅니다.',
  '{{elKo}} 기운을 극대화하는 행운의 요소들입니다. 다음 포인트들을 참고하여 생활 속에서 자연스럽게 좋은 에너지를 끌어모아 보세요.',
];

// ---------------------------------------------------------------------------
//  7. Relation description helper
// ---------------------------------------------------------------------------

function relationDescription(fromEl: string, toEl: string, rel: string): string {
  const from = elShort(fromEl);
  const to = elShort(toEl);
  switch (rel) {
    case 'generates':
      return `${from}이 ${to}을 생하는(${ELEMENT_GENERATE_VERB[fromEl as ElementCode] ?? ''}) 상생 관계로, 에너지가 자연스럽게 흘러갑니다. 서로를 돕는 좋은 흐름입니다.`;
    case 'generated_by':
      return `${to}이 ${from}을 생해주는 상생 관계로, 지원을 받는 흐름입니다. 이 에너지를 잘 활용하면 성장에 도움이 됩니다.`;
    case 'controls':
      return `${from}이 ${to}을 극하는(${ELEMENT_CONTROL_VERB[fromEl as ElementCode] ?? ''}) 상극 관계입니다. 이 긴장감은 절제와 균형을 배우는 기회가 됩니다.`;
    case 'controlled_by':
      return `${to}이 ${from}을 극하는 상극 관계입니다. 다소 압박감이 있을 수 있지만, 이를 통해 내면이 단단해집니다.`;
    case 'same':
      return `같은 ${from} 오행으로 에너지가 강화됩니다. 이 기운을 잘 활용하면 집중력과 추진력이 극대화됩니다.`;
    default:
      return `${from}과 ${to}의 관계는 직접적인 생극이 없어 비교적 자유로운 흐름입니다.`;
  }
}

// ---------------------------------------------------------------------------
//  8. Seasonal energy table builder
// ---------------------------------------------------------------------------

function buildSeasonalTable(yearElement: string, _rng: SeededRandom): ReportTable {
  const seasonElements: Record<string, string> = {
    '봄(2~4월)': 'WOOD',
    '여름(5~7월)': 'FIRE',
    '가을(8~10월)': 'METAL',
    '겨울(11~1월)': 'WATER',
  };
  const rows: string[][] = [];
  for (const [season, el] of Object.entries(seasonElements)) {
    const rel = getRelation(yearElement, el);
    let assessment = '';
    switch (rel) {
      case 'same': assessment = '에너지 강화 \u2191\u2191'; break;
      case 'generates': assessment = '순탄한 흐름 \u2191'; break;
      case 'generated_by': assessment = '지원 받는 시기 \u2191'; break;
      case 'controls': assessment = '긴장감 있음 \u2193'; break;
      case 'controlled_by': assessment = '주의 필요 \u2193'; break;
      default: assessment = '보통 \u2194'; break;
    }
    rows.push([season, elFull(el), relationKorean(rel), assessment]);
  }
  return {
    title: '계절별 에너지 가이드',
    headers: ['계절', '대표 오행', '연운과의 관계', '에너지 평가'],
    rows,
  };
}

// ---------------------------------------------------------------------------
//  9. generateDetailedYearFortune
// ---------------------------------------------------------------------------

export function generateDetailedYearFortune(
  pillar: PillarFortune,
  yongshinInfo: YongshinInfo,
  targetYear: number,
  rng: SeededRandom,
): DetailedFortuneReport {
  const stemEntry = lookupStem(pillar.stemHangul);
  const branchEntry = lookupBranch(pillar.branchHangul);
  const elEntry = lookupElement(pillar.element);
  const yearEl = pillar.element as ElementCode;
  const yongEl = yongshinInfo.element as ElementCode;

  const baseVars = {
    year: String(targetYear),
    stemKo: pillar.stemHangul,
    branchKo: pillar.branchHangul,
    stemHj: pillar.stemHanja,
    branchHj: pillar.branchHanja,
    elKo: elFull(yearEl),
    nature: ELEMENT_NATURE[yearEl] ?? '',
  };

  const subsections: ReportSubsection[] = [];

  // --- Subsection 1: Year Base Energy ---
  {
    const paras: ReportParagraph[] = [];
    paras.push(narrative(pickAndFill(rng, YEAR_BASE_ENERGY_TEMPLATES, baseVars), yearEl));

    if (stemEntry) {
      const personality = rng.pick(stemEntry.personality);
      const keyword = stemEntry.coreKeywords.join(', ');
      paras.push(positive(
        joinSentences(
          `${pillar.stemHangul}(${pillar.stemHanja})의 핵심 키워드는 '${keyword}'입니다.`,
          personality,
          `이 에너지가 ${targetYear}년 한 해의 성격을 형성합니다.`,
        ),
        yearEl,
      ));
    }

    if (branchEntry) {
      const trait = rng.pick(branchEntry.traits);
      paras.push(encouraging(
        joinSentences(
          `지지 ${pillar.branchHangul}(${pillar.branchHanja})는 ${branchEntry.animal}의 기운을 담고 있습니다.`,
          trait,
          `${branchEntry.animal}띠의 해답게 이 에너지를 잘 활용해 보세요.`,
        ),
        yearEl,
      ));
    }

    if (elEntry) {
      paras.push(tip(
        joinSentences(
          `${elFull(yearEl)} 기운을 효과적으로 활용하려면 ${elEntry.color} 계열의 옷이나 소품을 가까이 두는 것이 좋습니다.`,
          `${elEntry.direction} 방향을 의식하면 에너지 활용에 도움이 됩니다.`,
          rng.pick(elEntry.supplementTips),
        ),
        yearEl,
      ));
    }

    subsections.push({ title: '올해의 기본 기운', paragraphs: paras });
  }

  // --- Subsection 2: Yongshin Match ---
  {
    const paras: ReportParagraph[] = [];
    const grade = pillar.grade;
    const yongVars = {
      yongEl: elFull(yongEl),
      heeEl: yongshinInfo.heeshin ? elFull(yongshinInfo.heeshin) : '',
      guEl: yongshinInfo.gushin ? elFull(yongshinInfo.gushin) : '',
      giEl: yongshinInfo.gishin ? elFull(yongshinInfo.gishin) : '',
    };

    let gradeTemplates: string[];
    switch (grade) {
      case 5: gradeTemplates = YONGSHIN_GRADE5_TEMPLATES; break;
      case 4: gradeTemplates = YONGSHIN_GRADE4_TEMPLATES; break;
      case 3: gradeTemplates = YONGSHIN_GRADE3_TEMPLATES; break;
      case 2: gradeTemplates = YONGSHIN_GRADE2_TEMPLATES; break;
      default: gradeTemplates = YONGSHIN_GRADE1_TEMPLATES; break;
    }

    paras.push(narrative(
      joinSentences(
        `${targetYear}년의 용신 부합도는 ${gradeStars(grade)} (${grade}등급)입니다.`,
        pickAndFill(rng, gradeTemplates, yongVars),
      ),
      yearEl,
    ));

    if (grade >= 4) {
      paras.push(positive(
        '이 흐름을 적극적으로 활용하세요. 새로운 도전, 중요한 결정, 장기 계획의 시작에 좋은 시기입니다. 자신감을 갖고 앞으로 나아가세요.',
        yearEl,
      ));
    } else if (grade <= 2) {
      paras.push(encouraging(
        '등급이 낮다고 해서 나쁜 해라는 뜻은 아닙니다. 오히려 내면을 돌아보고, 기반을 다지며, 실력을 쌓기에 최적의 시기입니다. 준비하는 자에게 기회가 찾아옵니다.',
        yearEl,
      ));
    } else {
      paras.push(tip(
        '보통 흐름의 해에는 기본에 충실하며 꾸준히 나아가는 것이 최선입니다. 급격한 변화보다는 안정적인 성장에 초점을 맞추세요.',
        yearEl,
      ));
    }

    if (stemEntry) {
      const cautionText = rng.pick(stemEntry.cautions);
      paras.push(caution(
        joinSentences(
          '올해 주의할 점으로는,',
          cautionText,
          '이 부분을 인식하고 조절하면 더욱 균형 잡힌 한 해를 보낼 수 있습니다.',
        ),
        yearEl,
      ));
    }

    subsections.push({ title: '용신 부합도 해석', paragraphs: paras });
  }

  // --- Subsection 3: Element Flow ---
  {
    const paras: ReportParagraph[] = [];
    const rel = getRelation(yearEl, yongEl);
    const relDesc = relationDescription(yearEl, yongEl, rel);
    const flowVars = {
      yearEl: elFull(yearEl),
      yongEl: elFull(yongEl),
      relation: relationKorean(rel),
      desc: relDesc,
    };

    paras.push(narrative(pickAndFill(rng, ELEMENT_FLOW_TEMPLATES, flowVars), yearEl));

    if (elEntry) {
      paras.push(positive(
        joinSentences(
          `${elFull(yearEl)}의 본성은 '${elEntry.nature}'입니다.`,
          `이 기운은 ${elEntry.season}의 에너지와 연결되며, ${elEntry.direction}에서 힘을 얻습니다.`,
          `행운의 숫자는 ${elEntry.numbers[0]}과 ${elEntry.numbers[1]}이며, ${elEntry.color}이 올해의 행운색입니다.`,
        ),
        yearEl,
      ));
    }

    const yongEntry = lookupElement(yongEl);
    if (yongEntry && yearEl !== yongEl) {
      paras.push(tip(
        joinSentences(
          `용신 ${elFull(yongEl)}의 에너지를 보충하기 위해서는 다음을 실천해 보세요.`,
          rng.pick(yongEntry.supplementTips),
          `${yongEntry.color} 계열의 색상을 일상에 활용하면 도움이 됩니다.`,
        ),
        yongEl,
      ));
    }

    subsections.push({ title: '오행 에너지 흐름', paragraphs: paras });
  }

  // --- Subsection 4: Wealth (split from combined) ---
  {
    const paras: ReportParagraph[] = [];
    const wealthTemplates = pillar.grade >= 3 ? WEALTH_TEMPLATES_POSITIVE : WEALTH_TEMPLATES_CAUTIOUS;
    const direction = ELEMENT_DIRECTION[yearEl] ?? '';
    const color = ELEMENT_COLOR[yearEl] ?? '';

    paras.push(narrative(
      pickAndFill(rng, wealthTemplates, { elKo: elFull(yearEl), direction, color }),
      yearEl,
    ));

    if (elEntry) {
      const taste = ELEMENT_TASTE[yearEl] ?? '';
      paras.push(tip(
        joinSentences(
          `재물운을 높이려면 ${color} 계열의 지갑이나 통장 커버를 활용해 보세요.`,
          `${direction} 방향에 재물 관련 물건을 배치하는 것도 도움이 됩니다.`,
          `식사에서는 ${taste} 계열의 음식이 금전 에너지의 순환을 돕습니다.`,
        ),
        yearEl,
      ));
    }

    if (pillar.grade >= 4) {
      paras.push(positive(
        '올해는 재물이 들어오는 문이 넓게 열려 있습니다. 기회를 놓치지 않되, 건전한 재무 습관을 유지하는 것이 장기적인 부의 기반이 됩니다.',
        yearEl,
      ));
    } else if (pillar.grade <= 2) {
      paras.push(caution(
        '올해는 재물을 불리기보다 지키는 데 집중하세요. 보증, 대출, 고위험 투자는 가급적 피하고, 비상금 확보에 우선순위를 두세요.',
        yearEl,
      ));
    }

    subsections.push({ title: '재물운', paragraphs: paras });
  }

  // --- Subsection 5: Career/Business (split from combined) ---
  {
    const paras: ReportParagraph[] = [];
    const workTip = stemEntry ? rng.pick(stemEntry.studyWorkTips) : '';
    const strength = stemEntry ? rng.pick(stemEntry.strengths) : '';
    const careerTemplates = pillar.grade >= 3 ? CAREER_TEMPLATES_POSITIVE : CAREER_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, careerTemplates, { workTip, strength }),
      yearEl,
    ));

    if (stemEntry) {
      const anotherWorkTip = rng.pick(stemEntry.studyWorkTips.filter(t => t !== workTip)) || workTip;
      paras.push(tip(
        joinSentences(
          '올해 직업적으로 실천할 핵심 포인트:',
          anotherWorkTip,
        ),
        yearEl,
      ));
    }

    if (elEntry) {
      paras.push(tip(
        joinSentences(
          `${elFull(yearEl)} 기운에 맞는 최적의 업무 시간대는 ${elEntry.timeOfDay}입니다.`,
          '이 시간대에 중요한 회의나 결정을 배치하면 성과가 높아집니다.',
          `${elEntry.taste} 음식을 점심에 곁들이면 오후 집중력 유지에 도움이 됩니다.`,
        ),
        yearEl,
      ));
    }

    subsections.push({ title: '직업운/사업운', paragraphs: paras });
  }

  // --- Subsection 6: Romance/Love (NEW) ---
  {
    const paras: ReportParagraph[] = [];
    const relTip = stemEntry ? rng.pick(stemEntry.relationshipTips) : '상대방의 마음에 귀 기울여 보세요.';
    const emotionPos = elEntry ? elEntry.emotion.positive : '';
    const emotionNeg = elEntry ? elEntry.emotion.negative : '';
    const romanceTemplates = pillar.grade >= 3 ? ROMANCE_TEMPLATES_POSITIVE : ROMANCE_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, romanceTemplates, {
        relTip,
        emotionPos,
        emotionNeg,
        elKo: elFull(yearEl),
      }),
      yearEl,
    ));

    if (branchEntry) {
      const branchAnimal = branchEntry.animal;
      paras.push(encouraging(
        joinSentences(
          `${branchAnimal}띠의 해에는 연애에서도 ${branchAnimal}의 기질이 반영됩니다.`,
          rng.pick(branchEntry.traits),
          '이 에너지를 연애에 긍정적으로 활용해 보세요.',
        ),
        yearEl,
      ));
    }

    if (pillar.grade >= 4) {
      paras.push(positive(
        '올해는 사랑의 기운이 강하게 흐르는 해입니다. 솔로라면 적극적으로 만남의 장에 나가보세요. 커플이라면 함께하는 특별한 추억을 만들기에 최적의 시기입니다.',
        yearEl,
      ));
    } else if (pillar.grade <= 2) {
      paras.push(tip(
        '올해 연애에서는 속도보다 방향이 중요합니다. 자기 자신을 먼저 사랑하고 돌보는 연습이, 결국 더 좋은 인연을 끌어당기는 비결입니다.',
        yearEl,
      ));
    }

    subsections.push({ title: '연애운', paragraphs: paras });
  }

  // --- Subsection 7: Academic/Self-development (NEW) ---
  {
    const paras: ReportParagraph[] = [];
    const studyTip = stemEntry ? rng.pick(stemEntry.studyWorkTips) : '';
    const academicTemplates = pillar.grade >= 3 ? ACADEMIC_TEMPLATES_POSITIVE : ACADEMIC_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, academicTemplates, { studyTip, elKo: elFull(yearEl) }),
      yearEl,
    ));

    if (stemEntry) {
      const strength = rng.pick(stemEntry.strengths);
      paras.push(positive(
        joinSentences(
          '학업과 자기계발에서 활용할 수 있는 당신의 강점:',
          strength,
          '이 강점을 올해 공부와 성장에 적극 활용해 보세요.',
        ),
        yearEl,
      ));
    }

    if (elEntry) {
      paras.push(tip(
        joinSentences(
          `${elFull(yearEl)} 기운에 맞는 학습 시간대는 ${elEntry.timeOfDay}입니다.`,
          '이 시간에 집중 학습을 배치하면 효율이 극대화됩니다.',
          rng.pick(elEntry.supplementTips),
        ),
        yearEl,
      ));
    }

    subsections.push({ title: '학업운/자기계발', paragraphs: paras });
  }

  // --- Subsection 8: Relationships (renamed from 인간관계운) ---
  {
    const paras: ReportParagraph[] = [];
    const relTip = stemEntry ? rng.pick(stemEntry.relationshipTips) : '상대방의 입장에서 생각해 보세요.';
    const branchTrait = branchEntry ? rng.pick(branchEntry.traits) : '';
    const branchAnimal = branchEntry?.animal ?? pillar.animal ?? '';

    paras.push(narrative(
      pickAndFill(rng, RELATIONSHIP_TEMPLATES, { relTip, branchAnimal, branchTrait }),
      yearEl,
    ));

    if (stemEntry) {
      const anotherTip = rng.pick(stemEntry.relationshipTips.filter(t => t !== relTip));
      paras.push(encouraging(
        joinSentences(
          '대인관계에서 추가적으로 기억할 점은,',
          anotherTip || relTip,
          '이 조언을 일상 속에서 의식하면 관계가 한결 부드러워집니다.',
        ),
        yearEl,
      ));
    }

    if (branchEntry) {
      const branchTip = rng.pick(branchEntry.tips);
      paras.push(tip(
        joinSentences(
          `${branchAnimal}띠의 해에 특히 도움이 되는 팁으로는,`,
          branchTip,
          '이 작은 실천이 관계의 질을 높여줍니다.',
        ),
        yearEl,
      ));
    }

    subsections.push({ title: '대인관계운', paragraphs: paras });
  }

  // --- Subsection 9: Health (renamed from 건강 포인트) ---
  {
    const paras: ReportParagraph[] = [];
    const organ = elEntry ? elEntry.organ.main : '';
    const supplementTip = elEntry ? rng.pick(elEntry.supplementTips) : '';
    const emotionPos = elEntry ? elEntry.emotion.positive : '';
    const emotionNeg = elEntry ? elEntry.emotion.negative : '';

    paras.push(narrative(
      pickAndFill(rng, HEALTH_TEMPLATES, {
        elKo: elFull(yearEl),
        organ,
        supplementTip,
        emotionPos,
        emotionNeg,
      }),
      yearEl,
    ));

    if (elEntry) {
      paras.push(positive(
        joinSentences(
          `${elFull(yearEl)} 기운이 부족해지면 ${elEntry.deficientMeaning}`,
          `반대로 과다해지면 ${elEntry.excessiveMeaning}`,
          '적정 수준의 균형을 유지하는 것이 올해 건강의 핵심입니다.',
        ),
        yearEl,
      ));
    }

    if (elEntry) {
      const extraTips = rng.sample(elEntry.supplementTips.filter(t => t !== supplementTip), 2);
      paras.push(tip(
        joinSentences(
          '일상에서 실천할 수 있는 건강 팁:',
          ...extraTips,
          `감정적으로는 ${emotionPos}을 키우고 ${emotionNeg}을 조절하는 연습을 해보세요.`,
        ),
        yearEl,
      ));
    }

    subsections.push({ title: '건강운', paragraphs: paras });
  }

  // --- Subsection 10: Lucky Points (NEW) ---
  {
    const paras: ReportParagraph[] = [];
    paras.push(narrative(
      pickAndFill(rng, LUCKY_POINT_INTRO_TEMPLATES, { elKo: elFull(yearEl) }),
      yearEl,
    ));

    const numbers = ELEMENT_NUMBER[yearEl] ?? [0, 0];
    const color = ELEMENT_COLOR[yearEl] ?? '';
    const direction = ELEMENT_DIRECTION[yearEl] ?? '';
    const foods = ELEMENT_FOOD[yearEl] ?? [];
    const hobbies = ELEMENT_HOBBY[yearEl] ?? [];
    const taste = ELEMENT_TASTE[yearEl] ?? '';

    const luckyFoods = rng.sample(foods, Math.min(3, foods.length));
    const luckyHobbies = rng.sample(hobbies, Math.min(3, hobbies.length));

    paras.push(emphasis(
      joinSentences(
        `행운의 숫자는 ${numbers[0]}과 ${numbers[1]}입니다. 중요한 날짜나 번호 선택 시 참고하세요.`,
        `행운의 색상은 ${color}이며, 의상이나 소품에 활용하면 좋은 기운을 끌어당깁니다.`,
        `행운의 방향은 ${direction}입니다. 중요한 약속이나 여행의 방향으로 참고해 보세요.`,
      ),
      yearEl,
    ));

    paras.push(tip(
      joinSentences(
        `행운을 부르는 음식: ${luckyFoods.join(', ')}. ${taste} 계열의 음식이 오행 에너지를 보충해 줍니다.`,
        `추천 취미 활동: ${luckyHobbies.join(', ')}. 이 활동들이 ${elFull(yearEl)} 기운과 조화를 이루어 마음의 안정과 활력을 선사합니다.`,
      ),
      yearEl,
    ));

    // Lucky point highlights for this subsection
    const luckyHighlights: ReportHighlight[] = [
      { label: '행운의 숫자', value: `${numbers[0]}, ${numbers[1]}`, element: yearEl, sentiment: 'good' },
      { label: '행운의 색상', value: color, element: yearEl, sentiment: 'good' },
      { label: '행운의 방향', value: direction, element: yearEl, sentiment: 'good' },
      { label: '행운의 맛', value: taste, element: yearEl, sentiment: 'good' },
    ];

    // Lucky point table
    const luckyTable: ReportTable = {
      title: '행운 포인트 요약',
      headers: ['항목', '내용'],
      rows: [
        ['행운의 숫자', `${numbers[0]}, ${numbers[1]}`],
        ['행운의 색상', color],
        ['행운의 방향', direction],
        ['행운의 맛', taste],
        ['추천 음식', luckyFoods.join(', ')],
        ['추천 취미', luckyHobbies.join(', ')],
      ],
    };

    subsections.push({
      title: '행운 포인트',
      paragraphs: paras,
      highlights: luckyHighlights,
      tables: [luckyTable],
    });
  }

  // --- Subsection 11: Core Advice ---
  {
    const paras: ReportParagraph[] = [];

    if (stemEntry) {
      const habits = rng.sample(stemEntry.recommendedHabits, 3);
      for (const h of habits) {
        paras.push(tip(pickAndFill(rng, CORE_ADVICE_TEMPLATES, { habit: h }), yearEl));
      }
    }

    if (stemEntry) {
      const cautionText = rng.pick(stemEntry.cautions);
      paras.push(caution(
        joinSentences(
          '올해 특히 주의할 점:',
          cautionText,
          '이 부분을 의식적으로 관리하면 더 좋은 결과를 얻을 수 있습니다.',
        ),
        yearEl,
      ));
    }

    subsections.push({ title: '올해의 핵심 조언', paragraphs: paras });
  }

  // --- Subsection 12: Seasonal Energy Guide (TABLE) ---
  {
    const seasonTable = buildSeasonalTable(yearEl, rng);
    const paras: ReportParagraph[] = [];
    paras.push(narrative(
      joinSentences(
        `${targetYear}년의 계절별 에너지 흐름을 살펴보겠습니다.`,
        `올해의 주도 오행인 ${elFull(yearEl)}가 각 계절의 에너지와 어떻게 상호작용하는지 이해하면, 시기별로 전략을 달리할 수 있습니다.`,
      ),
      yearEl,
    ));

    paras.push(tip(
      joinSentences(
        '상생 관계인 계절에는 적극적인 활동과 새로운 시도가 유리합니다.',
        '상극 관계인 계절에는 내면 충전과 기반 다지기에 집중하세요.',
        '같은 오행의 계절에는 에너지가 극대화되므로 핵심 목표를 밀어붙이기 좋습니다.',
      ),
      yearEl,
    ));

    subsections.push({
      title: '계절별 에너지 가이드',
      paragraphs: paras,
      tables: [seasonTable],
    });
  }

  // --- Highlights ---
  const yearNumbers = ELEMENT_NUMBER[yearEl] ?? [0, 0];
  const highlights: ReportHighlight[] = [
    { label: '주도 오행', value: elFull(yearEl), element: yearEl, sentiment: 'neutral' },
    { label: '용신 부합도', value: `${gradeStars(pillar.grade)} (${pillar.grade}등급)`, sentiment: gradeToSentiment(pillar.grade) },
    { label: '핵심 테마', value: stemEntry?.coreKeywords[0] ?? elShort(yearEl), element: yearEl, sentiment: 'neutral' },
    { label: '건강 주의 장기', value: elEntry?.organ.main ?? '', element: yearEl, sentiment: 'caution' },
    { label: '행운의 색', value: ELEMENT_COLOR[yearEl] ?? '', element: yearEl, sentiment: 'good' },
    { label: '행운의 방향', value: ELEMENT_DIRECTION[yearEl] ?? '', element: yearEl, sentiment: 'good' },
    { label: '행운의 숫자', value: `${yearNumbers[0]}, ${yearNumbers[1]}`, element: yearEl, sentiment: 'good' },
    { label: '행운의 맛', value: ELEMENT_TASTE[yearEl] ?? '', element: yearEl, sentiment: 'good' },
  ];

  // --- Charts ---
  const charts: ReportChart[] = [
    {
      type: 'bar',
      title: `${targetYear}년 용신 부합도`,
      data: { '부합도': pillar.grade, '최대': 5 },
      meta: { unit: '등급' },
    },
  ];

  // --- Top-level paragraphs ---
  const topParagraphs: ReportParagraph[] = [
    narrative(
      `${targetYear}년 ${pillar.stemHangul}${pillar.branchHangul}(${pillar.stemHanja}${pillar.branchHanja})년의 상세 운세 리포트입니다. ${elFull(yearEl)} 기운이 한 해를 이끌며, 용신 부합도는 ${gradeStars(pillar.grade)}입니다.`,
      yearEl,
    ),
  ];

  return {
    mode: 'year',
    title: `${targetYear}년 상세 운세`,
    subtitle: `${pillar.stemHangul}${pillar.branchHangul}(${pillar.stemHanja}${pillar.branchHanja})년 | ${elFull(yearEl)} | ${gradeStars(pillar.grade)}`,
    paragraphs: topParagraphs,
    highlights,
    subsections,
    charts,
    tables: [],
  };
}

// ---------------------------------------------------------------------------
//  10. generateDetailedMonthFortune
// ---------------------------------------------------------------------------

export function generateDetailedMonthFortune(
  yearPillar: PillarFortune,
  monthPillar: PillarFortune,
  yongshinInfo: YongshinInfo,
  year: number,
  month: number,
  rng: SeededRandom,
): DetailedFortuneReport {
  const stemEntry = lookupStem(monthPillar.stemHangul);
  const branchEntry = lookupBranch(monthPillar.branchHangul);
  const elEntry = lookupElement(monthPillar.element);
  const monthEl = monthPillar.element as ElementCode;
  const yearEl = yearPillar.element as ElementCode;
  const yongEl = yongshinInfo.element as ElementCode;

  const baseVars = {
    year: String(year),
    month: String(month),
    stemKo: monthPillar.stemHangul,
    branchKo: monthPillar.branchHangul,
    stemHj: monthPillar.stemHanja,
    branchHj: monthPillar.branchHanja,
    elKo: elFull(monthEl),
    nature: ELEMENT_NATURE[monthEl] ?? '',
  };

  const subsections: ReportSubsection[] = [];

  // --- Subsection 1: Month Base Energy ---
  {
    const paras: ReportParagraph[] = [];
    paras.push(narrative(pickAndFill(rng, MONTH_BASE_TEMPLATES, baseVars), monthEl));

    if (stemEntry) {
      const personality = rng.pick(stemEntry.personality);
      paras.push(positive(
        joinSentences(
          `이 달의 천간 ${monthPillar.stemHangul}(${monthPillar.stemHanja})는 '${stemEntry.coreKeywords.join(', ')}'의 에너지를 담고 있습니다.`,
          personality,
        ),
        monthEl,
      ));
    }

    if (branchEntry) {
      const trait = rng.pick(branchEntry.traits);
      paras.push(encouraging(
        joinSentences(
          `지지 ${monthPillar.branchHangul}(${monthPillar.branchHanja})는 ${branchEntry.animal}의 기운입니다.`,
          trait,
        ),
        monthEl,
      ));
    }

    subsections.push({ title: '이 달의 기본 기운', paragraphs: paras });
  }

  // --- Subsection 2: Year-Month Interaction ---
  {
    const paras: ReportParagraph[] = [];
    const rel = getRelation(yearEl, monthEl);
    const desc = relationDescription(yearEl, monthEl, rel);

    paras.push(narrative(
      pickAndFill(rng, YEAR_MONTH_INTERACTION_TEMPLATES, {
        yearEl: elFull(yearEl),
        monthEl: elFull(monthEl),
        relation: relationKorean(rel),
        desc,
      }),
      monthEl,
    ));

    if (rel === 'generates' || rel === 'generated_by') {
      paras.push(positive(
        '연운과 월운이 상생 관계에 있어, 이 달은 전반적으로 순탄한 흐름이 기대됩니다. 연초부터 준비해 온 일들이 결실을 맺기 좋은 시기입니다.',
        monthEl,
      ));
    } else if (rel === 'controls' || rel === 'controlled_by') {
      paras.push(encouraging(
        '연운과 월운 사이에 긴장감이 있지만, 이는 성장의 기회이기도 합니다. 신중하게 행동하되, 필요한 변화를 두려워하지 마세요.',
        monthEl,
      ));
    } else {
      paras.push(tip(
        '연운과 동일한 에너지가 이 달에도 이어지므로, 올해의 전체 전략과 일관성 있게 행동하면 좋습니다.',
        monthEl,
      ));
    }

    subsections.push({ title: '연운과의 관계', paragraphs: paras });
  }

  // --- Subsection 3: Core Energy Flow ---
  {
    const paras: ReportParagraph[] = [];
    const relToYong = getRelation(monthEl, yongEl);
    const relDesc = relationDescription(monthEl, yongEl, relToYong);

    paras.push(narrative(
      joinSentences(
        `이 달의 ${elFull(monthEl)} 기운과 용신 ${elFull(yongEl)}의 관계는 ${relationKorean(relToYong)}입니다.`,
        relDesc,
      ),
      monthEl,
    ));

    if (elEntry) {
      paras.push(tip(
        joinSentences(
          `${elFull(monthEl)} 에너지를 활용하려면:`,
          rng.pick(elEntry.supplementTips),
          `${elEntry.timeOfDay}에 중요한 활동을 배치하면 효율이 높아집니다.`,
        ),
        monthEl,
      ));
    }

    subsections.push({ title: '핵심 에너지 흐름', paragraphs: paras });
  }

  // --- Subsection 4: Monthly Wealth ---
  {
    const paras: ReportParagraph[] = [];
    const direction = ELEMENT_DIRECTION[monthEl] ?? '';
    const color = ELEMENT_COLOR[monthEl] ?? '';
    const wealthTemplates = monthPillar.grade >= 3 ? WEALTH_TEMPLATES_POSITIVE : WEALTH_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, wealthTemplates, { elKo: elFull(monthEl), direction, color }),
      monthEl,
    ));

    if (monthPillar.grade >= 4) {
      paras.push(positive(
        joinSentences(
          '이 달은 재물운이 좋은 편입니다.',
          '적극적인 재테크 활동이 긍정적 결과를 가져올 수 있습니다.',
          `${color} 계열의 소품을 활용하면 금전 기운이 강화됩니다.`,
        ),
        monthEl,
      ));
    } else if (monthPillar.grade <= 2) {
      paras.push(caution(
        '이 달은 재물 관리에 특히 주의가 필요합니다. 충동구매를 자제하고, 지출 내역을 꼼꼼히 점검해 보세요.',
        monthEl,
      ));
    }

    subsections.push({ title: '재물운', paragraphs: paras });
  }

  // --- Subsection 5: Monthly Career ---
  {
    const paras: ReportParagraph[] = [];
    const workTip = stemEntry ? rng.pick(stemEntry.studyWorkTips) : '';
    const strength = stemEntry ? rng.pick(stemEntry.strengths) : '';
    const careerTemplates = monthPillar.grade >= 3 ? CAREER_TEMPLATES_POSITIVE : CAREER_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, careerTemplates, { workTip, strength }),
      monthEl,
    ));

    if (stemEntry) {
      paras.push(tip(
        joinSentences(
          '이 달의 업무 핵심 팁:',
          rng.pick(stemEntry.studyWorkTips.filter(t => t !== workTip)) || workTip,
        ),
        monthEl,
      ));
    }

    subsections.push({ title: '직업운', paragraphs: paras });
  }

  // --- Subsection 6: Monthly Romance ---
  {
    const paras: ReportParagraph[] = [];
    const relTip = stemEntry ? rng.pick(stemEntry.relationshipTips) : '진심을 담아 소통해 보세요.';
    const emotionPos = elEntry ? elEntry.emotion.positive : '';
    const emotionNeg = elEntry ? elEntry.emotion.negative : '';
    const romanceTemplates = monthPillar.grade >= 3 ? ROMANCE_TEMPLATES_POSITIVE : ROMANCE_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, romanceTemplates, {
        relTip,
        emotionPos,
        emotionNeg,
        elKo: elFull(monthEl),
      }),
      monthEl,
    ));

    if (branchEntry) {
      paras.push(tip(
        joinSentences(
          `${branchEntry.animal}의 기운이 흐르는 이 달, 연애에서는`,
          rng.pick(branchEntry.traits),
          '이 에너지를 사랑에 활용하면 관계가 풍요로워집니다.',
        ),
        monthEl,
      ));
    }

    subsections.push({ title: '연애운', paragraphs: paras });
  }

  // --- Subsection 7: Monthly Relationships ---
  {
    const paras: ReportParagraph[] = [];
    const relTip = stemEntry ? rng.pick(stemEntry.relationshipTips) : '상대방의 입장을 한 번 더 들어보세요.';

    paras.push(narrative(
      joinSentences(
        `${month}월 대인관계의 핵심 포인트:`,
        relTip,
      ),
      monthEl,
    ));

    if (branchEntry) {
      paras.push(tip(
        joinSentences(
          `${branchEntry.animal}의 기운 아래에서는,`,
          rng.pick(branchEntry.tips),
          '이 팁을 의식하면 이 달의 관계가 한결 편안해집니다.',
        ),
        monthEl,
      ));
    }

    subsections.push({ title: '대인관계', paragraphs: paras });
  }

  // --- Subsection 8: Monthly Health ---
  {
    const paras: ReportParagraph[] = [];
    if (elEntry) {
      paras.push(narrative(
        joinSentences(
          `이 달에는 ${elEntry.organ.main} 건강에 특히 신경 쓰세요.`,
          rng.pick(elEntry.supplementTips),
          `감정적으로 ${elEntry.emotion.negative}이 커질 수 있으니, ${elEntry.emotion.positive}을 의식적으로 키워보세요.`,
        ),
        monthEl,
      ));
    }

    if (stemEntry) {
      paras.push(tip(
        joinSentences(
          '이 달의 건강 습관 추천:',
          rng.pick(stemEntry.recommendedHabits),
        ),
        monthEl,
      ));
    }

    subsections.push({ title: '건강운', paragraphs: paras });
  }

  // --- Subsection 9: Monthly Lucky Points ---
  {
    const paras: ReportParagraph[] = [];
    paras.push(narrative(
      pickAndFill(rng, LUCKY_POINT_INTRO_TEMPLATES, { elKo: elFull(monthEl) }),
      monthEl,
    ));

    const mNumbers = ELEMENT_NUMBER[monthEl] ?? [0, 0];
    const mColor = ELEMENT_COLOR[monthEl] ?? '';
    const mDirection = ELEMENT_DIRECTION[monthEl] ?? '';
    const mFoods = ELEMENT_FOOD[monthEl] ?? [];
    const mHobbies = ELEMENT_HOBBY[monthEl] ?? [];
    const mTaste = ELEMENT_TASTE[monthEl] ?? '';

    const mLuckyFoods = rng.sample(mFoods, Math.min(3, mFoods.length));
    const mLuckyHobbies = rng.sample(mHobbies, Math.min(2, mHobbies.length));

    paras.push(emphasis(
      joinSentences(
        `이 달의 행운 숫자: ${mNumbers[0]}, ${mNumbers[1]}.`,
        `행운 색상: ${mColor}. 행운 방향: ${mDirection}.`,
        `추천 음식: ${mLuckyFoods.join(', ')}(${mTaste} 계열).`,
        `추천 활동: ${mLuckyHobbies.join(', ')}.`,
      ),
      monthEl,
    ));

    const mLuckyHighlights: ReportHighlight[] = [
      { label: '행운의 숫자', value: `${mNumbers[0]}, ${mNumbers[1]}`, element: monthEl, sentiment: 'good' },
      { label: '행운의 색상', value: mColor, element: monthEl, sentiment: 'good' },
      { label: '행운의 방향', value: mDirection, element: monthEl, sentiment: 'good' },
    ];

    const mLuckyTable: ReportTable = {
      title: '이 달의 행운 포인트',
      headers: ['항목', '내용'],
      rows: [
        ['행운의 숫자', `${mNumbers[0]}, ${mNumbers[1]}`],
        ['행운의 색상', mColor],
        ['행운의 방향', mDirection],
        ['행운의 맛', mTaste],
        ['추천 음식', mLuckyFoods.join(', ')],
        ['추천 활동', mLuckyHobbies.join(', ')],
      ],
    };

    subsections.push({
      title: '행운 포인트',
      paragraphs: paras,
      highlights: mLuckyHighlights,
      tables: [mLuckyTable],
    });
  }

  // --- Subsection 10: Monthly Core Advice ---
  {
    const paras: ReportParagraph[] = [];
    if (stemEntry) {
      const habits = rng.sample(stemEntry.recommendedHabits, 2);
      for (const h of habits) {
        paras.push(tip(
          joinSentences(
            `${month}월 핵심 실천:`,
            h,
          ),
          monthEl,
        ));
      }
    }

    paras.push(encouraging(
      joinSentences(
        `${month}월도 당신의 노력이 빛을 발할 달입니다.`,
        '하루하루 작은 실천이 모여 큰 변화를 만듭니다. 이 달도 화이팅하세요!',
      ),
      monthEl,
    ));

    subsections.push({ title: '이 달의 핵심 조언', paragraphs: paras });
  }

  // --- Highlights ---
  const monthNumbers = ELEMENT_NUMBER[monthEl] ?? [0, 0];
  const highlights: ReportHighlight[] = [
    { label: '월운 오행', value: elFull(monthEl), element: monthEl, sentiment: 'neutral' },
    { label: '용신 부합도', value: `${gradeStars(monthPillar.grade)} (${monthPillar.grade}등급)`, sentiment: gradeToSentiment(monthPillar.grade) },
    { label: '연운과의 관계', value: relationKorean(getRelation(yearEl, monthEl)), sentiment: 'neutral' },
    { label: '건강 주의', value: elEntry?.organ.main ?? '', element: monthEl, sentiment: 'caution' },
    { label: '행운의 색', value: ELEMENT_COLOR[monthEl] ?? '', element: monthEl, sentiment: 'good' },
    { label: '행운의 방향', value: ELEMENT_DIRECTION[monthEl] ?? '', element: monthEl, sentiment: 'good' },
    { label: '행운의 숫자', value: `${monthNumbers[0]}, ${monthNumbers[1]}`, element: monthEl, sentiment: 'good' },
  ];

  // --- Charts ---
  const charts: ReportChart[] = [
    {
      type: 'bar',
      title: `${year}년 ${month}월 용신 부합도`,
      data: { '부합도': monthPillar.grade, '최대': 5 },
      meta: { unit: '등급' },
    },
  ];

  const topParagraphs: ReportParagraph[] = [
    narrative(
      `${year}년 ${month}월 ${monthPillar.stemHangul}${monthPillar.branchHangul}(${monthPillar.stemHanja}${monthPillar.branchHanja})월의 상세 운세 리포트입니다. ${elFull(monthEl)} 기운이 이 달을 이끌며, 용신 부합도는 ${gradeStars(monthPillar.grade)}입니다.`,
      monthEl,
    ),
  ];

  return {
    mode: 'month',
    title: `${year}년 ${month}월 상세 운세`,
    subtitle: `${monthPillar.stemHangul}${monthPillar.branchHangul}(${monthPillar.stemHanja}${monthPillar.branchHanja})월 | ${elFull(monthEl)} | ${gradeStars(monthPillar.grade)}`,
    paragraphs: topParagraphs,
    highlights,
    subsections,
    charts,
    tables: [],
  };
}

// ---------------------------------------------------------------------------
//  11. generateDetailedDayFortune
// ---------------------------------------------------------------------------

export function generateDetailedDayFortune(
  yearPillar: PillarFortune,
  monthPillar: PillarFortune,
  dayPillar: PillarFortune,
  yongshinInfo: YongshinInfo,
  year: number,
  month: number,
  day: number,
  rng: SeededRandom,
): DetailedFortuneReport {
  const stemEntry = lookupStem(dayPillar.stemHangul);
  const branchEntry = lookupBranch(dayPillar.branchHangul);
  const elEntry = lookupElement(dayPillar.element);
  const dayEl = dayPillar.element as ElementCode;
  const monthEl = monthPillar.element as ElementCode;
  const yearEl = yearPillar.element as ElementCode;
  const yongEl = yongshinInfo.element as ElementCode;

  const baseVars = {
    year: String(year),
    month: String(month),
    day: String(day),
    stemKo: dayPillar.stemHangul,
    branchKo: dayPillar.branchHangul,
    stemHj: dayPillar.stemHanja,
    branchHj: dayPillar.branchHanja,
    elKo: elFull(dayEl),
    nature: ELEMENT_NATURE[dayEl] ?? '',
  };

  const subsections: ReportSubsection[] = [];

  // --- Subsection 1: Day Base Energy ---
  {
    const paras: ReportParagraph[] = [];
    paras.push(narrative(pickAndFill(rng, DAY_BASE_TEMPLATES, baseVars), dayEl));

    if (stemEntry) {
      const personality = rng.pick(stemEntry.personality);
      paras.push(positive(
        joinSentences(
          `오늘의 천간 ${dayPillar.stemHangul}(${dayPillar.stemHanja})는 '${stemEntry.coreKeywords.join(', ')}'의 기운을 품고 있습니다.`,
          personality,
          '이 에너지를 오늘 하루에 녹여보세요.',
        ),
        dayEl,
      ));
    }

    if (branchEntry) {
      paras.push(encouraging(
        joinSentences(
          `지지 ${dayPillar.branchHangul}(${dayPillar.branchHanja})는 ${branchEntry.animal}의 기운입니다.`,
          rng.pick(branchEntry.traits),
        ),
        dayEl,
      ));
    }

    subsections.push({ title: '오늘의 기본 기운', paragraphs: paras });
  }

  // --- Subsection 2: Three-way Interaction ---
  {
    const paras: ReportParagraph[] = [];
    const dayToMonth = getRelation(dayEl, monthEl);
    const dayToYear = getRelation(dayEl, yearEl);

    paras.push(narrative(
      joinSentences(
        `오늘의 ${elFull(dayEl)} 기운은 월운 ${elFull(monthEl)}과 ${relationKorean(dayToMonth)} 관계,`,
        `연운 ${elFull(yearEl)}과는 ${relationKorean(dayToYear)} 관계에 있습니다.`,
        relationDescription(dayEl, monthEl, dayToMonth),
      ),
      dayEl,
    ));

    if (dayToMonth === 'generates' || dayToMonth === 'generated_by') {
      paras.push(positive(
        '오늘의 기운과 이 달의 기운이 서로 돕는 관계에 있어, 하루가 순탄하게 흘러갈 가능성이 높습니다.',
        dayEl,
      ));
    } else if (dayToMonth === 'controls' || dayToMonth === 'controlled_by') {
      paras.push(encouraging(
        '월운과 약간의 긴장감이 있는 날입니다. 평소보다 한 박자 여유를 두고 행동하면 좋겠습니다.',
        dayEl,
      ));
    }

    subsections.push({ title: '월운/연운과의 관계', paragraphs: paras });
  }

  // --- Subsection 3: Today's Energy ---
  {
    const paras: ReportParagraph[] = [];
    const dayToYong = getRelation(dayEl, yongEl);

    paras.push(narrative(
      joinSentences(
        `오늘의 주도 에너지인 ${elFull(dayEl)}는 용신 ${elFull(yongEl)}과 ${relationKorean(dayToYong)} 관계에 있습니다.`,
        relationDescription(dayEl, yongEl, dayToYong),
      ),
      dayEl,
    ));

    if (elEntry) {
      paras.push(tip(
        joinSentences(
          '오늘의 에너지를 활용하기 위한 팁:',
          rng.pick(elEntry.supplementTips),
          `행운의 색상은 ${elEntry.color}, 방향은 ${elEntry.direction}입니다.`,
        ),
        dayEl,
      ));
    }

    subsections.push({ title: '오늘의 에너지', paragraphs: paras });
  }

  // --- Subsection 4: Daily Wealth ---
  {
    const paras: ReportParagraph[] = [];
    const direction = ELEMENT_DIRECTION[dayEl] ?? '';
    const color = ELEMENT_COLOR[dayEl] ?? '';
    const wealthTemplates = dayPillar.grade >= 3 ? WEALTH_TEMPLATES_POSITIVE : WEALTH_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, wealthTemplates, { elKo: elFull(dayEl), direction, color }),
      dayEl,
    ));

    if (dayPillar.grade >= 4) {
      paras.push(positive(
        '오늘은 재물에 관한 긍정적인 소식이나 기회가 있을 수 있습니다. 열린 마음으로 받아들이되 신중하게 판단하세요.',
        dayEl,
      ));
    } else if (dayPillar.grade <= 2) {
      paras.push(caution(
        '오늘은 불필요한 지출을 삼가고, 큰 금전 결정은 다른 날로 미루는 것이 현명합니다.',
        dayEl,
      ));
    }

    subsections.push({ title: '재물운', paragraphs: paras });
  }

  // --- Subsection 5: Daily Career/Activities ---
  {
    const paras: ReportParagraph[] = [];
    if (stemEntry) {
      const workTips = rng.sample(stemEntry.studyWorkTips, 2);
      paras.push(narrative(
        joinSentences(
          '오늘 추천하는 업무와 활동:',
          ...workTips,
        ),
        dayEl,
      ));
    }

    if (elEntry) {
      paras.push(tip(
        joinSentences(
          `${elFull(dayEl)} 기운에 맞는 활동 시간대는 ${elEntry.timeOfDay}입니다.`,
          '이 시간대에 가장 중요한 일을 배치해 보세요.',
          `${elEntry.taste} 음식을 적절히 챙기면 에너지 밸런스에 도움이 됩니다.`,
        ),
        dayEl,
      ));
    }

    if (stemEntry) {
      const strength = rng.pick(stemEntry.strengths);
      paras.push(positive(
        joinSentences(
          '오늘 발휘할 수 있는 강점:',
          strength,
          '이 강점을 의식하고 활용하면 하루가 더욱 알찹니다.',
        ),
        dayEl,
      ));
    }

    subsections.push({ title: '직업/활동 추천', paragraphs: paras });
  }

  // --- Subsection 6: Daily Romance ---
  {
    const paras: ReportParagraph[] = [];
    const relTip = stemEntry ? rng.pick(stemEntry.relationshipTips) : '상대방에게 따뜻한 한마디를 건네보세요.';
    const emotionPos = elEntry ? elEntry.emotion.positive : '';
    const emotionNeg = elEntry ? elEntry.emotion.negative : '';
    const romanceTemplates = dayPillar.grade >= 3 ? ROMANCE_TEMPLATES_POSITIVE : ROMANCE_TEMPLATES_CAUTIOUS;

    paras.push(narrative(
      pickAndFill(rng, romanceTemplates, {
        relTip,
        emotionPos,
        emotionNeg,
        elKo: elFull(dayEl),
      }),
      dayEl,
    ));

    if (dayPillar.grade >= 4) {
      paras.push(tip(
        '오늘은 사랑하는 사람에게 감사의 마음을 전하기 좋은 날입니다. 작은 선물이나 따뜻한 메시지가 관계를 빛나게 합니다.',
        dayEl,
      ));
    } else {
      paras.push(tip(
        '오늘 연애에서는 조용히 상대방의 이야기에 귀 기울이는 것이 가장 좋은 표현입니다.',
        dayEl,
      ));
    }

    subsections.push({ title: '연애운', paragraphs: paras });
  }

  // --- Subsection 7: Daily Relationship Tips ---
  {
    const paras: ReportParagraph[] = [];
    if (stemEntry) {
      paras.push(narrative(
        joinSentences(
          '오늘의 대인관계 팁:',
          rng.pick(stemEntry.relationshipTips),
        ),
        dayEl,
      ));
    }

    if (branchEntry) {
      paras.push(tip(
        joinSentences(
          `${branchEntry.animal}의 기운 아래 관계 팁:`,
          rng.pick(branchEntry.tips),
        ),
        dayEl,
      ));
    }

    subsections.push({ title: '대인관계 팁', paragraphs: paras });
  }

  // --- Subsection 8: Daily Health ---
  {
    const paras: ReportParagraph[] = [];
    if (elEntry) {
      paras.push(narrative(
        joinSentences(
          `오늘은 ${elEntry.organ.main} 건강에 신경 쓰세요.`,
          rng.pick(elEntry.supplementTips),
        ),
        dayEl,
      ));

      paras.push(tip(
        joinSentences(
          `감정적으로 ${elEntry.emotion.positive}을 키우고,`,
          `${elEntry.emotion.negative}이 올라올 때는 깊게 심호흡하며 조절해 보세요.`,
        ),
        dayEl,
      ));
    }

    if (stemEntry) {
      paras.push(tip(
        joinSentences(
          '오늘의 컨디션 관리 팁:',
          rng.pick(stemEntry.recommendedHabits),
        ),
        dayEl,
      ));
    }

    subsections.push({ title: '건강과 컨디션', paragraphs: paras });
  }

  // --- Subsection 9: Daily Lucky Points ---
  {
    const paras: ReportParagraph[] = [];
    paras.push(narrative(
      pickAndFill(rng, LUCKY_POINT_INTRO_TEMPLATES, { elKo: elFull(dayEl) }),
      dayEl,
    ));

    const dNumbers = ELEMENT_NUMBER[dayEl] ?? [0, 0];
    const dColor = ELEMENT_COLOR[dayEl] ?? '';
    const dDirection = ELEMENT_DIRECTION[dayEl] ?? '';
    const dFoods = ELEMENT_FOOD[dayEl] ?? [];
    const dHobbies = ELEMENT_HOBBY[dayEl] ?? [];
    const dTaste = ELEMENT_TASTE[dayEl] ?? '';

    const dLuckyFoods = rng.sample(dFoods, Math.min(2, dFoods.length));
    const dLuckyHobby = rng.pick(dHobbies);

    paras.push(emphasis(
      joinSentences(
        `오늘의 행운 숫자: ${dNumbers[0]}, ${dNumbers[1]}.`,
        `행운 색상: ${dColor}. 행운 방향: ${dDirection}.`,
        `추천 음식: ${dLuckyFoods.join(', ')}(${dTaste} 계열).`,
        `오늘의 추천 활동: ${dLuckyHobby}.`,
      ),
      dayEl,
    ));

    const dLuckyHighlights: ReportHighlight[] = [
      { label: '행운의 숫자', value: `${dNumbers[0]}, ${dNumbers[1]}`, element: dayEl, sentiment: 'good' },
      { label: '행운의 색상', value: dColor, element: dayEl, sentiment: 'good' },
      { label: '행운의 방향', value: dDirection, element: dayEl, sentiment: 'good' },
    ];

    const dLuckyTable: ReportTable = {
      title: '오늘의 행운 포인트',
      headers: ['항목', '내용'],
      rows: [
        ['행운의 숫자', `${dNumbers[0]}, ${dNumbers[1]}`],
        ['행운의 색상', dColor],
        ['행운의 방향', dDirection],
        ['행운의 맛', dTaste],
        ['추천 음식', dLuckyFoods.join(', ')],
        ['추천 활동', dLuckyHobby],
      ],
    };

    subsections.push({
      title: '행운 포인트',
      paragraphs: paras,
      highlights: dLuckyHighlights,
      tables: [dLuckyTable],
    });
  }

  // --- Subsection 10: Today's Closing Message ---
  {
    const paras: ReportParagraph[] = [];
    paras.push(encouraging(
      pickAndFill(rng, CLOSING_TEMPLATES, { nature: ELEMENT_NATURE[dayEl] ?? '' }),
      dayEl,
    ));

    if (stemEntry) {
      const habit = rng.pick(stemEntry.recommendedHabits);
      paras.push(tip(
        joinSentences(
          '오늘 딱 한 가지만 실천한다면:',
          habit,
        ),
        dayEl,
      ));
    }

    subsections.push({ title: '오늘의 한마디', paragraphs: paras });
  }

  // --- Highlights ---
  const dayNumbers = ELEMENT_NUMBER[dayEl] ?? [0, 0];
  const highlights: ReportHighlight[] = [
    { label: '오늘의 오행', value: elFull(dayEl), element: dayEl, sentiment: 'neutral' },
    { label: '용신 부합도', value: `${gradeStars(dayPillar.grade)} (${dayPillar.grade}등급)`, sentiment: gradeToSentiment(dayPillar.grade) },
    { label: '행운의 색', value: ELEMENT_COLOR[dayEl] ?? '', element: dayEl, sentiment: 'good' },
    { label: '행운의 방향', value: ELEMENT_DIRECTION[dayEl] ?? '', element: dayEl, sentiment: 'good' },
    { label: '행운의 숫자', value: `${dayNumbers[0]}, ${dayNumbers[1]}`, element: dayEl, sentiment: 'good' },
    { label: '건강 주의', value: elEntry?.organ.main ?? '', element: dayEl, sentiment: 'caution' },
  ];

  // --- Charts ---
  const charts: ReportChart[] = [
    {
      type: 'bar',
      title: `${year}년 ${month}월 ${day}일 용신 부합도`,
      data: { '부합도': dayPillar.grade, '최대': 5 },
      meta: { unit: '등급' },
    },
  ];

  const topParagraphs: ReportParagraph[] = [
    narrative(
      `${year}년 ${month}월 ${day}일 ${dayPillar.stemHangul}${dayPillar.branchHangul}(${dayPillar.stemHanja}${dayPillar.branchHanja})일의 상세 운세 리포트입니다. ${elFull(dayEl)} 기운이 오늘 하루를 이끌며, 용신 부합도는 ${gradeStars(dayPillar.grade)}입니다.`,
      dayEl,
    ),
  ];

  return {
    mode: 'day',
    title: `${year}년 ${month}월 ${day}일 상세 운세`,
    subtitle: `${dayPillar.stemHangul}${dayPillar.branchHangul}(${dayPillar.stemHanja}${dayPillar.branchHanja})일 | ${elFull(dayEl)} | ${gradeStars(dayPillar.grade)}`,
    paragraphs: topParagraphs,
    highlights,
    subsections,
    charts,
    tables: [],
  };
}
