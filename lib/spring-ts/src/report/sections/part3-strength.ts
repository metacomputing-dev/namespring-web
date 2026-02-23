/**
 * part3-strength.ts -- 신강/신약 판정 섹션 (PART 3: 신강도 분석)
 *
 * 사주명리학의 핵심 개념인 일간(일주 천간)의 강약을 판정하여
 * 자연스러운 한국어 보고서로 생성합니다.
 *
 * 신강/신약 판정의 3대 기준:
 *   - 득령(得令): 월지(태어난 달)가 일간을 도와주는지 (계절 지원)
 *   - 득지(得地): 지지(특히 일지)에 일간의 뿌리가 있는지 (땅의 지원)
 *   - 득세(得勢): 사주 전체에서 인성/비겁이 많은지 (세력 지원)
 *
 * 5단계 분류:
 *   극신강 (index >= 80) → 신강 (60~79) → 중화 (41~59) → 신약 (21~40) → 극신약 (<= 20)
 *
 * 종격(從格) 고려:
 *   극신약인데 관살/재성이 압도적이면 종재격·종관격 등으로 전환 가능
 *   극신강인데 비겁/인성이 압도적이면 전왕격·종비격 등으로 전환 가능
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportChart,
  ReportHighlight,
  ElementCode,
  StrengthLevel,
} from '../types.js';

import {
  ELEMENT_KOREAN_SHORT,
  ELEMENT_KOREAN,
  ELEMENT_NATURE,
  classifyStrength,
  STRENGTH_KOREAN,
} from '../common/elementMaps.js';

import {
  SeededRandom,
  createRng,
  pickAndFill,
  fillTemplate,
  narrative,
  positive,
  encouraging,
  caution,
  tip,
  emphasis,
  joinSentences,
  eunNeun,
  iGa,
  scoreText,
} from '../common/sentenceUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  상수 & 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

/** 신강도 인덱스를 0~100 기반 정수로 정규화합니다. */
function normalizeStrengthIndex(input: ReportInput): number {
  // strength.totalSupport / totalOppose 는 -1~+1 범위의 부동소수점일 수 있으므로
  // 0~100 범위로 변환합니다. 이미 0~100이면 그대로 사용합니다.
  const s = input.saju.strength;
  const sup = s.totalSupport ?? 0;
  const opp = s.totalOppose ?? 0;
  const total = sup + opp;

  // details 문자열에서 강약 지수를 추출 시도
  for (const detail of s.details ?? []) {
    const match = detail.match(/강약\s*지수[:\s]*([+-]?\d+\.?\d*)/);
    if (match) {
      const raw = parseFloat(match[1]);
      // -1 ~ +1 범위를 0~100 으로
      if (raw >= -1 && raw <= 1) {
        return Math.round((raw + 1) * 50);
      }
      // 이미 0~100 이면
      if (raw >= 0 && raw <= 100) {
        return Math.round(raw);
      }
    }
  }

  // totalSupport, totalOppose 를 이용하여 신강도 추정
  if (total > 0) {
    return Math.round((sup / total) * 100);
  }

  // isStrong 플래그 기반 폴백
  return s.isStrong ? 65 : 35;
}

/** 오행 코드를 안전하게 한글 단문으로 변환 */
function elKo(code: string | null | undefined): string {
  if (!code) return '알 수 없는 오행';
  return ELEMENT_KOREAN_SHORT[code as ElementCode] ?? code;
}

/** 오행 코드를 한글 전문(괄호 포함)으로 변환 */
function elFull(code: string | null | undefined): string {
  if (!code) return '';
  return ELEMENT_KOREAN[code as ElementCode] ?? code;
}

/** 요소의 자연적 성질 설명 */
function elNature(code: string | null | undefined): string {
  if (!code) return '';
  return ELEMENT_NATURE[code as ElementCode] ?? '';
}

/**
 * 일간 오행에 대한 식상(食傷) 오행 반환 — 일간이 생하는 오행
 *   목→화, 화→토, 토→금, 금→수, 수→목
 */
function outputElement(dayMasterEl: string): ElementCode {
  const map: Record<string, ElementCode> = {
    WOOD: 'FIRE', FIRE: 'EARTH', EARTH: 'METAL', METAL: 'WATER', WATER: 'WOOD',
  };
  return map[dayMasterEl] ?? 'FIRE';
}

/**
 * 일간 오행에 대한 재성(財星) 오행 반환 — 일간이 극하는 오행
 *   목→토, 화→금, 토→수, 금→목, 수→화
 */
function wealthElement(dayMasterEl: string): ElementCode {
  const map: Record<string, ElementCode> = {
    WOOD: 'EARTH', FIRE: 'METAL', EARTH: 'WATER', METAL: 'WOOD', WATER: 'FIRE',
  };
  return map[dayMasterEl] ?? 'EARTH';
}

/**
 * 일간 오행에 대한 인성(印星) 오행 반환 — 일간을 생해주는 오행
 *   목←수, 화←목, 토←화, 금←토, 수←금
 */
function resourceElement(dayMasterEl: string): ElementCode {
  const map: Record<string, ElementCode> = {
    WOOD: 'WATER', FIRE: 'WOOD', EARTH: 'FIRE', METAL: 'EARTH', WATER: 'METAL',
  };
  return map[dayMasterEl] ?? 'WATER';
}

/**
 * 일간 오행에 대한 관성(官星) 오행 반환 — 일간을 극하는 오행
 *   목←금, 화←수, 토←목, 금←화, 수←토
 */
function authorityElement(dayMasterEl: string): ElementCode {
  const map: Record<string, ElementCode> = {
    WOOD: 'METAL', FIRE: 'WATER', EARTH: 'WOOD', METAL: 'FIRE', WATER: 'EARTH',
  };
  return map[dayMasterEl] ?? 'METAL';
}

/**
 * 비겁(比劫) 오행 반환 — 일간과 같은 오행
 */
function friendElement(dayMasterEl: string): ElementCode {
  return dayMasterEl as ElementCode;
}

// ─────────────────────────────────────────────────────────────────────────────
//  문장 템플릿 풀 — 극신강 (index >= 80)
// ─────────────────────────────────────────────────────────────────────────────

const EXTREME_STRONG_INTRO: readonly string[] = [
  '{{이름}}님의 사주는 에너지가 매우 강한 극신강(極身强) 사주예요! 마치 불길이 활활 타오르듯, 일간 {{일간오행}}의 기운이 넘쳐흐르고 있답니다.',
  '사주 분석 결과, {{이름}}님은 극신강(極身强)에 해당해요. {{일간오행}}의 에너지가 가득 차 있어서, 어떤 어려움도 정면 돌파할 수 있는 강인한 힘을 가지고 계세요.',
  '{{이름}}님의 일간 {{일간오행}}은 정말 강력한 기운을 받고 있어요! 극신강(極身强) 사주는 뜨거운 용광로처럼 끝없는 에너지를 품고 있는 특별한 사주랍니다.',
  '와! {{이름}}님의 사주를 살펴보니 극신강(極身强)이에요. {{일간오행}}의 기운이 마치 거센 폭포처럼 쏟아지고 있어서, 정말 대단한 에너지를 가지고 계시네요!',
  '{{이름}}님은 극신강(極身强) 사주를 가지고 계세요. 일간의 {{일간오행}} 기운이 사주팔자 전체에 꽉 차 있어서, 마치 한여름 한낮의 태양처럼 강렬한 존재감을 보여주고 있답니다.',
  '{{이름}}님의 사주를 분석해 보니, {{일간오행}} 기운이 압도적으로 강한 극신강 사주예요. 거대한 산처럼 흔들리지 않는 단단한 에너지를 가지고 계신 거죠!',
  '정말 인상적인 사주예요! {{이름}}님은 극신강(極身强)으로, {{일간오행}}의 기운이 넘치도록 가득 차 있어요. 이런 강한 에너지는 잘 활용하면 대단한 일을 해낼 수 있는 원동력이 된답니다.',
];

const EXTREME_STRONG_PERSONALITY: readonly string[] = [
  '극신강 사주를 가진 분은 보통 의지가 매우 강하고, 한 번 마음먹으면 끝까지 밀고 나가는 추진력이 있어요. 리더십이 뛰어나고, 주변에서 "카리스마가 있다"는 말을 자주 듣기도 하죠.',
  '성격적으로 보면, 극신강 사주는 독립심이 정말 강해요. 남에게 기대기보다는 자기 힘으로 해결하려는 성향이 강하고, 자기 신념에 대한 확신이 단단하답니다.',
  '극신강 사주인 분들은 에너지가 넘치다 보니 때로는 "고집이 세다"는 이야기를 듣기도 해요. 하지만 이것은 곧 "자기 소신이 확고하다"는 뜻이기도 하답니다!',
  '의지력 하나만큼은 최고예요! 극신강 사주는 어떤 시련이 와도 꿋꿋이 버틸 수 있는 회복탄력성이 정말 뛰어나요. 넘어져도 다시 일어나는 강인한 정신력의 소유자시죠.',
  '극신강 사주를 가진 분은 자기주도적이고 능동적이에요. 주변 상황에 휘둘리기보다는 스스로 환경을 만들어 가는 스타일이라, 사업가나 개척자 기질이 있다고 볼 수 있어요.',
  '에너지가 워낙 강하다 보니, 극신강 사주의 소유자는 경쟁 상황에서 빛을 발해요. 도전을 두려워하지 않고, 오히려 어려운 상황에서 더 큰 힘을 발휘하는 타입이랍니다.',
];

const EXTREME_STRONG_ADVICE: readonly string[] = [
  '다만, 이렇게 에너지가 넘칠 때는 방향을 잡아주는 것이 중요해요. {{식상오행}}(식상)이나 {{재성오행}}(재성) 기운을 통해 에너지를 생산적으로 발산하면 훨씬 좋은 결과를 얻을 수 있답니다.',
  '극신강 사주는 에너지를 밖으로 내보내는 통로가 필요해요. {{식상오행}} 기운(식상)은 표현과 창의력을, {{재성오행}} 기운(재성)은 실질적인 성취를 도와주니까, 이 두 오행을 적극 활용해 보세요!',
  '너무 강한 불은 모든 것을 태울 수 있듯이, 극신강 에너지도 적절히 분배하는 것이 좋아요. {{식상오행}}(식상 기운)으로 재능을 표현하고, {{재성오행}}(재성 기운)으로 현실적 성과를 만들어 보세요.',
  '강한 에너지를 제대로 활용하는 비결은 바로 "출구"를 만드는 거예요! {{식상오행}} 기운으로 자기표현을 하고, {{재성오행}} 기운으로 목표를 향해 달려가면, 폭발적인 에너지가 멋진 성과로 이어질 거예요.',
  '에너지가 넘치는 극신강 사주에는 {{식상오행}}(식상)과 {{재성오행}}(재성)의 균형이 핵심이에요. 마치 거대한 강물에 수로를 만들어 주는 것처럼, 에너지를 건설적인 방향으로 흘려보내야 한답니다.',
];

const EXTREME_STRONG_NAME_ADVICE: readonly string[] = [
  '이름에 {{식상오행}}이나 {{재성오행}} 기운의 한자를 넣어주면, 넘치는 에너지에 방향을 잡아주는 효과가 있어요. 이름이 일종의 "나침반" 역할을 해주는 셈이죠!',
  '작명할 때 {{식상오행}} 또는 {{재성오행}} 오행을 포함하면 극신강 에너지의 균형을 맞추는 데 도움이 돼요. 이름은 매일 불리는 것이니 그 영향력은 생각보다 크답니다.',
  '{{이름}}님처럼 에너지가 강한 분에게는, 이름에 {{식상오행}}(식상)이나 {{재성오행}}(재성) 기운을 담아주면 강한 기운을 잘 다스리는 데 큰 도움이 된답니다.',
  '극신강 사주에는 이름으로 에너지 분산 효과를 줄 수 있어요. {{식상오행}}은 표현력과 소통을, {{재성오행}}은 현실 감각과 실행력을 높여주거든요.',
  '이름 속 오행이 사주의 균형을 잡아주는 역할을 해요. {{식상오행}}과 {{재성오행}} 오행의 글자를 이름에 담으면, 마치 돛을 달아 순풍을 타듯 에너지가 올바른 방향으로 흐를 수 있답니다.',
];

const EXTREME_STRONG_HEALTH: readonly string[] = [
  '건강 면에서는 에너지가 너무 뜨겁게 몰리지 않도록 주의해 주세요. 규칙적인 운동으로 에너지를 분산하고, 충분한 수분 섭취와 휴식을 챙기는 것이 좋아요.',
  '극신강 사주는 에너지가 넘치다 보니 과로에 빠지기 쉬워요. 몸이 보내는 신호에 귀 기울이고, 무리하지 않는 선에서 활동량을 조절하는 것이 건강의 비결이랍니다.',
  '에너지가 강한 만큼, 건강 관리도 적극적으로 해주세요. 격한 운동보다는 요가나 수영 같은 균형 잡힌 운동이 도움이 되고, 명상이나 심호흡으로 마음을 가라앉히는 것도 좋아요.',
  '강한 에너지를 가진 분은 스트레스가 쌓이면 갑자기 확 나타나는 경향이 있어요. 평소 걷기, 스트레칭, 취미 활동 등으로 에너지를 고르게 발산하면 건강을 오래 유지할 수 있답니다.',
  '극신강 사주는 열이 위로 몰리기 쉬우니 머리를 시원하게, 발을 따뜻하게 유지하는 습관이 좋아요. 충분한 수면과 규칙적인 식사도 잊지 마세요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  문장 템플릿 풀 — 신강 (60~79)
// ─────────────────────────────────────────────────────────────────────────────

const STRONG_INTRO: readonly string[] = [
  '{{이름}}님의 사주는 건강하게 강한 신강(身强) 사주예요! {{일간오행}} 기운이 튼튼하게 자리 잡고 있어서, 삶을 주도적으로 이끌어 나갈 수 있는 힘이 있답니다.',
  '사주를 살펴보니, {{이름}}님은 신강(身强)에 해당해요. {{일간오행}}의 에너지가 적당히 강해서, 안정감 있으면서도 추진력을 갖추고 있는 좋은 상태랍니다!',
  '{{이름}}님은 신강(身强) 사주를 가지셨어요. 일간 {{일간오행}}의 기운이 든든하게 뒷받침되어 있어, 마치 뿌리 깊은 나무처럼 흔들림 없이 성장할 수 있는 사주예요.',
  '기운이 건강하게 강한 신강 사주네요! {{이름}}님의 {{일간오행}} 에너지는 적절한 강도를 유지하고 있어서, 자기 주관이 뚜렷하면서도 유연함을 갖추고 있어요.',
  '{{이름}}님의 신강도를 분석해 보니, 건강한 신강(身强) 상태예요. {{일간오행}} 기운이 넉넉하게 공급되고 있어서, 인생에서 만나는 기회를 잘 잡을 수 있는 힘이 있답니다.',
  '분석 결과 {{이름}}님은 신강(身强) 사주예요! {{일간오행}}의 기운이 안정적으로 강한 상태라, 리더십을 발휘하면서도 주변과 잘 어울릴 수 있는 멋진 사주랍니다.',
];

const STRONG_PERSONALITY: readonly string[] = [
  '신강 사주를 가진 분은 자신감이 넘치고, 리더십이 자연스럽게 드러나요. 팀을 이끌거나 프로젝트를 주도하는 역할에서 빛을 발하는 타입이죠.',
  '성격적으로 보면, 신강 사주는 주체성이 강하면서도 균형 감각이 있어요. 자기 의견을 분명히 표현하면서도 다른 사람의 이야기에 귀 기울일 줄 아는 점이 장점이에요.',
  '신강 사주인 분들은 결단력이 뛰어나고, 중요한 순간에 흔들리지 않는 힘이 있어요. "이 사람이라면 믿을 수 있다"는 신뢰감을 주변에 주는 스타일이죠.',
  '안정감 있는 자신감이 신강 사주의 큰 매력이에요. 극신강처럼 너무 강하지도 않고, 적당히 강한 에너지가 삶의 다양한 영역에서 고르게 빛을 발한답니다.',
  '신강 사주의 소유자는 스트레스 상황에서도 침착하게 대처할 수 있는 내면의 힘이 있어요. 마치 튼튼한 배가 파도를 헤쳐 나가듯, 어려운 상황도 잘 극복해 낼 수 있어요.',
  '신강 사주는 독립적이면서도 협동심이 있어요. 혼자서도 잘 해내지만, 팀으로 일할 때 더 큰 시너지를 만들어내는 능력이 있답니다.',
];

const STRONG_ADVICE: readonly string[] = [
  '신강 사주는 에너지를 적절히 쓰는 것이 중요해요. {{식상오행}}(식상)이나 {{재성오행}}(재성) 기운을 통해 능력을 발휘하면, 좋은 성과를 거둘 수 있을 거예요.',
  '적당히 강한 에너지를 최대한 활용하려면, 표현력({{식상오행}} 기운)과 실행력({{재성오행}} 기운)의 조화가 중요해요. 꿈꾸는 것을 행동으로 옮길 때 가장 빛나는 사주랍니다!',
  '신강 사주는 약간의 구조와 규율이 도움이 돼요. {{관성오행}}(관성) 기운이 적절히 작용하면 에너지를 더 효율적으로 쓸 수 있거든요.',
  '강한 기운을 가졌으니 도전을 두려워하지 마세요! 다만 {{식상오행}}과 {{재성오행}} 기운으로 에너지를 분산시키면, 한 곳에 치우치지 않고 다방면으로 활약할 수 있답니다.',
  '신강 사주에게는 새로운 도전이 약이 돼요. 에너지가 넉넉하니까 다양한 경험을 통해 자신의 역량을 키워가세요. {{식상오행}} 기운과 관련된 활동이 특히 잘 맞을 거예요.',
];

const STRONG_NAME_ADVICE: readonly string[] = [
  '이름에는 {{식상오행}}이나 {{재성오행}} 기운을 담아주면, 신강 에너지를 생산적으로 활용하는 데 도움이 돼요.',
  '{{이름}}님처럼 건강하게 강한 분은, 이름에서 에너지를 더 강화하거나 적절히 분산하는 역할을 할 수 있어요. {{식상오행}} 또는 {{재성오행}} 오행이 좋은 선택이에요.',
  '신강 사주는 이름의 오행 선택 폭이 넓은 편이에요. 균형을 위해 {{식상오행}}·{{재성오행}}을 쓸 수도 있고, 더 강하게 밀어주는 {{비겁오행}} 오행을 쓸 수도 있답니다.',
  '이름은 평생의 동반자예요. 신강 사주에는 {{식상오행}} 또는 {{재성오행}} 기운의 글자를 넣어 에너지를 현실적 성취로 연결하는 것이 좋아요.',
  '작명 시 {{식상오행}}(표현·재능)이나 {{재성오행}}(성취·실현) 오행의 한자를 포함하면, 신강 에너지가 빛을 발하는 이름이 될 수 있어요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  문장 템플릿 풀 — 중화 (41~59)
// ─────────────────────────────────────────────────────────────────────────────

const BALANCED_INTRO: readonly string[] = [
  '{{이름}}님의 사주는 중화(中和) 상태예요! 이것은 사주명리학에서 가장 이상적인 균형 상태를 의미해요. {{일간오행}} 기운이 너무 강하지도, 너무 약하지도 않은 딱 좋은 균형이랍니다.',
  '정말 좋은 사주 구조를 가지셨네요! {{이름}}님은 중화(中和) 사주예요. 마치 봄날의 화창한 날씨처럼, {{일간오행}} 기운이 조화롭게 흐르고 있어요.',
  '{{이름}}님의 사주를 분석해 보니, 중화(中和)에 해당하는 균형 잡힌 사주예요. {{일간오행}} 기운이 안정적으로 유지되면서 모든 방면에서 고르게 힘을 발휘할 수 있는 상태랍니다.',
  '중화(中和)라니! 이건 정말 좋은 거예요. {{이름}}님의 {{일간오행}} 기운은 생조(生助)와 극설(剋洩)이 적절히 균형을 이루고 있어서, 어떤 상황에도 유연하게 대처할 수 있답니다.',
  '{{이름}}님은 중화(中和) 사주를 가지셨어요! 저울의 양쪽이 수평을 이루듯, {{일간오행}}의 에너지가 아름답게 균형 잡혀 있는 상태예요. 이건 사주에서 최고의 상태 중 하나랍니다.',
  '분석 결과, {{이름}}님의 사주는 중화(中和) 상태로 나타났어요. {{일간오행}} 기운이 지나치지도 모자라지도 않아서, 다양한 상황에서 최적의 선택을 할 수 있는 좋은 사주예요.',
  '{{이름}}님의 {{일간오행}} 에너지는 중화(中和) 상태에 있어요. 이것은 마치 사계절이 골고루 있는 온대 기후처럼, 어떤 환경에서든 적응력이 뛰어남을 의미한답니다.',
];

const BALANCED_PERSONALITY: readonly string[] = [
  '중화 사주를 가진 분은 적응력이 정말 뛰어나요! 새로운 환경이나 사람을 만나도 금세 적응하고, 다양한 분야에서 능력을 발휘할 수 있는 다재다능한 스타일이에요.',
  '성격적으로 보면, 중화 사주는 유연하면서도 주관이 있어요. 상황에 따라 리더가 되기도 하고, 팔로워가 되기도 하는 융통성이 큰 장점이랍니다.',
  '중화 사주의 매력은 균형 감각이에요. 너무 밀어붙이지도, 너무 물러서지도 않는 적절한 조화를 이루어 주변과 좋은 관계를 유지하기 쉬워요.',
  '중화 사주인 분들은 다양한 직업이나 역할에서 능력을 발휘할 수 있어요. 특정 분야에 국한되지 않고, 여러 방면에서 가능성을 열어둘 수 있는 것이 큰 장점이에요.',
  '중화 사주는 감정 조절 능력이 뛰어나고, 스트레스 관리도 잘하는 편이에요. 마음의 균형이 잡혀 있어서, 주변 사람들에게 안정감을 주는 존재랍니다.',
  '누구와도 잘 어울리는 것이 중화 사주의 강점이에요. 리더십도 있고, 배려심도 있어서, 어떤 그룹에 속해도 중요한 역할을 맡을 수 있답니다.',
];

const BALANCED_ADVICE: readonly string[] = [
  '중화 사주는 이름의 오행 선택이 가장 자유로워요! 어떤 오행의 이름이든 비교적 잘 어울리지만, 용신(用神)에 맞추면 더 좋은 시너지를 낼 수 있답니다.',
  '균형 잡힌 사주이니 어떤 방향으로든 성장할 수 있어요. 관심 있는 분야에 용기 있게 도전해 보세요! 중화 사주의 유연한 에너지가 든든하게 받쳐줄 거예요.',
  '중화 사주의 장점을 살리려면, 한쪽에 치우치지 않는 것이 핵심이에요. 일과 휴식, 이성과 감성, 독립과 협동 사이에서 균형을 유지하면 최고의 결과를 얻을 수 있어요.',
  '이미 좋은 균형을 가지고 있으니, 현재 상태를 유지하면서 자기 발전에 집중해 보세요. 다양한 경험이 중화 사주의 가능성을 더 넓혀줄 거예요.',
  '중화 사주는 극단적인 상황보다 안정적인 환경에서 더 빛나요. 꾸준히 성장하면서 내 페이스를 유지하는 것이 성공의 비결이랍니다.',
];

const BALANCED_NAME_ADVICE: readonly string[] = [
  '중화 사주는 이름 선택의 폭이 넓어요. 용신 오행에 맞추면 이미 좋은 균형을 더 튼튼하게 만들어줄 수 있답니다.',
  '{{이름}}님의 사주가 이미 균형 잡혀 있으니, 이름에서는 용신 기운을 살짝 보태주는 정도면 충분해요. 무리하게 한쪽으로 치우친 오행을 넣을 필요가 없답니다.',
  '중화 사주에는 어떤 오행의 이름이든 큰 무리가 없지만, 조후(調候)나 통관(通關) 등 세부 분석을 참고하면 최적의 이름 오행을 찾을 수 있어요.',
  '이미 최상의 균형 상태이니, 이름은 기신(忌神) 오행만 피하면 대부분 잘 어울려요. 용신과 희신 오행이면 금상첨화랍니다!',
  '중화 사주는 이름의 음운(소리)이나 의미(뜻)에 더 신경 써도 좋아요. 오행 균형은 이미 잡혀 있으니, 좋은 의미와 아름다운 소리를 가진 이름이면 딱이에요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  문장 템플릿 풀 — 신약 (21~40)
// ─────────────────────────────────────────────────────────────────────────────

const WEAK_INTRO: readonly string[] = [
  '{{이름}}님의 사주는 신약(身弱)에 해당해요. {{일간오행}} 기운이 조금 부족한 편이지만, 걱정하지 마세요! 신약 사주에는 신약 사주만의 특별한 강점이 있답니다.',
  '사주 분석 결과, {{이름}}님은 신약(身弱) 사주예요. {{일간오행}}의 에너지가 조금 약하지만, 이것은 마치 부드러운 바람처럼 유연하고 섬세한 감성을 가지고 있다는 뜻이에요.',
  '{{이름}}님의 일간 {{일간오행}}은 현재 약간 힘이 부족한 신약(身弱) 상태예요. 하지만 "가장 유연한 나무가 바람에 부러지지 않는다"는 말처럼, 유연함은 큰 힘이랍니다!',
  '{{이름}}님은 신약(身弱) 사주를 가지고 계세요. {{일간오행}} 기운이 다소 부족하지만, 이런 사주는 직감력과 공감 능력이 뛰어나 사람들에게 사랑받는 경우가 많아요.',
  '분석해 보니 {{이름}}님은 신약(身弱) 사주예요. {{일간오행}} 기운을 주변에서 도움받으면 크게 성장할 수 있는 가능성을 가지고 있답니다!',
  '{{이름}}님의 {{일간오행}} 기운은 살짝 부드러운 편인 신약(身弱) 상태예요. 하지만 이런 부드러움이야말로, 물처럼 어디든 스며들 수 있는 무한한 적응력의 원천이랍니다.',
];

const WEAK_PERSONALITY: readonly string[] = [
  '신약 사주를 가진 분은 감수성이 풍부하고, 다른 사람의 마음을 잘 이해해요. 공감 능력이 뛰어나서 상담이나 서비스 분야에서 빛을 발하기도 한답니다.',
  '신약 사주의 분들은 협동 능력이 뛰어나요. 혼자 무리하기보다 팀워크를 통해 더 큰 성과를 만들어내는 것이 이 사주의 전략이라고 할 수 있어요.',
  '성격적으로 보면, 신약 사주는 세심하고 배려심이 깊어요. 주변 사람들의 작은 변화도 잘 감지하고, 따뜻한 마음으로 도움을 줄 수 있는 분이에요.',
  '신약 사주는 직관력과 예술적 감각이 뛰어난 경우가 많아요. 에너지가 부드럽기 때문에 오히려 섬세한 영역에서 남다른 재능을 보이기도 한답니다.',
  '겸손하고 성실한 것이 신약 사주의 큰 매력이에요. 자기를 낮출 줄 알기 때문에 주변의 도움을 잘 받아들이고, 그 도움을 통해 크게 성장할 수 있어요.',
  '신약 사주인 분들은 위기 상황에서 의외의 강인함을 보여주기도 해요. 평소에는 부드럽지만, 정말 중요한 순간에는 놀라운 저력을 발휘하는 것이 이 사주의 매력이에요.',
];

const WEAK_ADVICE: readonly string[] = [
  '신약 사주에게는 {{인성오행}}(인성)과 {{비겁오행}}(비겁) 기운이 큰 도움이 돼요. 인성은 학습과 보호를, 비겁은 동료와 협력의 힘을 의미하거든요.',
  '에너지가 부족할 때는 무리하지 않는 것이 중요해요. {{인성오행}} 기운(인성)으로 내면의 에너지를 충전하고, {{비겁오행}} 기운(비겁)으로 동료의 도움을 받아보세요.',
  '신약 사주는 과도한 도전보다 준비된 도전이 더 잘 맞아요. {{인성오행}}(인성)으로 실력을 쌓고, {{비겁오행}}(비겁)의 든든한 지원을 받으면 어떤 일도 해낼 수 있답니다.',
  '자기 관리가 특히 중요한 사주예요. {{인성오행}} 기운으로 지식과 지혜를 쌓고, {{비겁오행}} 기운으로 든든한 인맥을 만들어 두면 큰 힘이 될 거예요.',
  '신약 사주의 성공 비결은 "동반 성장"이에요. 좋은 스승({{인성오행}} 기운)과 좋은 동료({{비겁오행}} 기운)를 만나면, 혼자서는 상상도 못 할 성과를 이루어낼 수 있답니다.',
];

const WEAK_NAME_ADVICE: readonly string[] = [
  '이름에 {{인성오행}}이나 {{비겁오행}} 기운의 한자를 넣어주면, 부족한 에너지를 보충하는 효과가 있어요. 이름이 매일 불리면서 자연스럽게 에너지를 채워주는 역할을 해요.',
  '{{이름}}님의 사주에는 {{인성오행}}(인성)이나 {{비겁오행}}(비겁) 오행을 이름에 담아주면 큰 도움이 돼요. 마치 든든한 후원자가 함께하는 것과 같은 효과가 있답니다.',
  '신약 사주에서 이름의 오행은 정말 중요해요! {{인성오행}}이나 {{비겁오행}} 기운을 이름에 포함하면, 부족한 기운을 보완하여 삶에 활력을 불어넣을 수 있어요.',
  '작명할 때 {{인성오행}} 오행(학문·보호)이나 {{비겁오행}} 오행(동료·협력)의 한자를 선택하면, 신약 사주의 약점을 보완하고 강점을 살리는 이름이 될 수 있어요.',
  '이름은 사주의 부족한 부분을 채워주는 보약 같은 존재예요. {{인성오행}}과 {{비겁오행}} 오행으로 구성된 이름은 {{이름}}님에게 매일 에너지를 공급해주는 역할을 할 거예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  문장 템플릿 풀 — 극신약 (index <= 20)
// ─────────────────────────────────────────────────────────────────────────────

const EXTREME_WEAK_INTRO: readonly string[] = [
  '{{이름}}님의 사주는 극신약(極身弱)에 해당해요. {{일간오행}} 기운이 매우 약하지만, 놀라운 비밀이 있어요! 극신약 사주는 특정 조건에서 오히려 아주 강력한 힘을 발휘할 수 있답니다.',
  '사주 분석 결과, {{이름}}님은 극신약(極身弱) 사주예요. {{일간오행}}의 에너지가 많이 부족하지만, 이런 사주야말로 이름과 환경의 도움을 받으면 극적으로 변할 수 있는 가능성이 큰 사주랍니다.',
  '{{이름}}님은 극신약(極身弱) 사주를 가지셨어요. {{일간오행}} 기운이 약하다고 낙심하지 마세요! 사주학에서는 이런 경우 "종격(從格)"이라는 특별한 격국이 적용될 수 있거든요.',
  '{{이름}}님의 일간 {{일간오행}}은 극신약(極身弱) 상태예요. 하지만 "가장 낮은 곳에 물이 모인다"는 말처럼, 겸손한 자세에서 오히려 큰 복을 받을 수 있는 특별한 사주랍니다.',
  '분석해 보니 {{이름}}님은 극신약(極身弱) 사주예요. {{일간오행}} 기운이 매우 약하지만, 이것은 거부하기보다 순응할 때 오히려 큰 힘이 되는 독특한 사주 구조예요.',
  '{{이름}}님의 {{일간오행}} 기운은 극신약(極身弱) 상태예요. 약해 보이지만, 사실 극신약 사주는 사주학에서 아주 특별하게 다루어지는 유형이에요. 잘 활용하면 놀라운 결과를 만들 수 있답니다!',
  '{{이름}}님의 사주는 극신약(極身弱)이에요. {{일간오행}} 기운이 미약하지만, 물은 가장 낮은 곳에서 가장 큰 호수를 이루듯이, 주변 에너지를 수용하는 능력이 탁월한 사주랍니다.',
];

const EXTREME_WEAK_PERSONALITY: readonly string[] = [
  '극신약 사주를 가진 분은 놀라운 적응력을 가지고 있어요. 자기를 낮출 줄 아는 지혜가 있어서, 어떤 환경에서든 살아남을 수 있는 유연함이 최고의 무기예요.',
  '극신약 사주의 분들은 감수성이 매우 예민하고, 직관력이 뛰어나요. 남들이 놓치는 작은 변화도 감지할 수 있어서, 예술이나 상담 분야에서 탁월한 재능을 보이기도 해요.',
  '겸손함과 수용력이 극신약 사주의 큰 강점이에요. 남들의 이야기에 진심으로 귀 기울이고, 그 마음을 이해해주는 능력이 사람들의 마음을 사로잡아요.',
  '극신약 사주인 분들은 의외로 끈질긴 면이 있어요. 포기할 것 같으면서도 다시 일어나는 회복력이 있어서, 장기적으로 보면 놀라운 성취를 이루어내기도 한답니다.',
  '극신약 사주는 자기를 가장 잘 낮출 수 있는 사람이에요. 그래서 서비스업이나 고객 응대, 영업 분야에서 큰 성공을 거두는 경우가 많답니다. 겸손함이 곧 무기가 되는 거예요.',
  '섬세하고 민감한 감성은 극신약 사주의 보물이에요. 예술, 음악, 문학 등 감성이 중요한 분야에서 남다른 재능을 발휘할 수 있어요.',
];

const EXTREME_WEAK_JONGGYEOK: readonly string[] = [
  '특별히 주목할 점은, 극신약 사주 중 종격(從格)에 해당하는 경우가 있어요. 종격이란 일간이 너무 약해서, 오히려 강한 쪽을 따라가면 더 큰 복을 받는 특수한 격국이에요.',
  '극신약 사주에서는 종격(從格) 여부를 꼭 확인해야 해요. 재성이 매우 강하면 종재격, 관성이 강하면 종관격이 될 수 있는데, 이 경우 약함이 오히려 큰 힘이 되는 역전의 사주가 돼요!',
  '사주학에서 극신약은 단순히 "약하다"는 의미가 아니에요. 종격(從格)이 성립하면, 약한 것처럼 보이지만 실제로는 외부의 강한 기운을 100% 활용할 수 있는 아주 효율적인 사주가 될 수 있어요.',
  '극신약에서 종격이 성립하면 운의 방향이 완전히 달라져요. 보통 사주와 다르게 기신(忌神)이 용신(用神)이 되고, 용신이 기신이 되는 역전 현상이 일어나거든요. 이런 부분은 전문가와 상담해 보시면 좋아요!',
  '종격 여부에 따라 이름의 오행 선정 전략도 달라질 수 있어요. 종격이 아니라면 일간을 도와주는 방향이, 종격이라면 강한 쪽을 더 밀어주는 방향이 유리할 수 있답니다.',
];

const EXTREME_WEAK_ADVICE: readonly string[] = [
  '극신약 사주에게는 {{인성오행}}(인성)과 {{비겁오행}}(비겁) 기운이 절실히 필요해요. 이 두 오행이 일간을 보살펴주는 든든한 후원자 역할을 하거든요.',
  '가장 중요한 것은 무리하지 않는 거예요. 에너지가 부족할 때는 충전의 시간이 꼭 필요해요. {{인성오행}} 기운(학습·보호)과 {{비겁오행}} 기운(동료·지원)을 적극 활용해 보세요.',
  '극신약 사주의 성공 비결은 "좋은 환경 만들기"에요. {{인성오행}} 기운이 풍부한 공간(도서관, 학교 등)이나 {{비겁오행}} 기운이 있는 환경(동료, 커뮤니티)에서 활동하면 큰 힘을 얻을 수 있어요.',
  '에너지 관리가 핵심이에요. 극신약 사주는 무리해서 에너지를 소모하면 회복이 오래 걸리니, {{인성오행}}(인성)으로 충전하고 {{비겁오행}}(비겁)으로 든든한 지지를 받는 것이 중요해요.',
  '극신약 사주는 혼자보다 함께할 때 빛나요. {{비겁오행}} 기운의 좋은 파트너나 멘토를 만나면, 부족한 에너지를 보완하면서 큰 성과를 이룰 수 있답니다.',
];

const EXTREME_WEAK_NAME_ADVICE: readonly string[] = [
  '극신약 사주에서 이름의 오행은 정말 중요해요! {{인성오행}}이나 {{비겁오행}} 기운의 한자를 이름에 넣어주면, 마치 사막에 오아시스가 생기는 것처럼 큰 힘이 될 수 있어요.',
  '이름이 사주에서 가장 큰 도움을 줄 수 있는 유형이 바로 극신약 사주예요. {{인성오행}}(인성)이나 {{비겁오행}}(비겁) 오행의 글자를 이름에 담아주세요.',
  '{{이름}}님처럼 극신약 사주인 분에게 이름은 일종의 "보약"이에요. {{인성오행}} 또는 {{비겁오행}} 오행으로 이름을 구성하면, 매일 불리면서 에너지를 채워주는 효과가 있답니다.',
  '극신약 사주는 이름 하나로 인생의 흐름이 크게 달라질 수 있어요. {{인성오행}}(보호·학문)이나 {{비겁오행}}(동료·협력) 오행을 꼭 고려해 주세요!',
  '이름의 오행이 사주를 보완해주는 효과는, 극신약 사주에서 가장 크게 나타나요. {{인성오행}}과 {{비겁오행}} 기운의 이름은 {{이름}}님에게 가장 큰 선물이 될 수 있답니다.',
];

const EXTREME_WEAK_HEALTH: readonly string[] = [
  '건강 면에서는 특히 주의가 필요해요. 에너지가 부족하니 과로를 피하고, 충분한 수면과 영양가 있는 식사를 챙기는 것이 중요해요.',
  '극신약 사주는 면역력 관리가 핵심이에요. 규칙적인 생활 습관, 적당한 운동, 그리고 마음의 안정을 위한 명상이나 산책이 건강을 지켜주는 비결이랍니다.',
  '에너지가 약한 편이니, 무리한 다이어트나 과격한 운동은 피해주세요. 가벼운 걷기, 요가, 스트레칭처럼 몸에 부담이 적은 활동이 더 좋아요.',
  '극신약 사주는 정신적 에너지 관리도 중요해요. 스트레스를 받으면 빨리 해소하고, 긍정적인 생각과 좋은 사람들과 함께하는 시간을 많이 가져보세요.',
  '건강의 기본은 규칙적인 생활이에요. 일정한 시간에 자고 일어나며, 세 끼 식사를 제때 하는 것만으로도 극신약 사주의 에너지를 크게 보충할 수 있답니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  득령(得令) 템플릿 — 계절 지원 분석
// ─────────────────────────────────────────────────────────────────────────────

const DEUKRYEONG_STRONG: readonly string[] = [
  '{{이름}}님의 일간 {{일간오행}}은 월지(태어난 달)의 도움을 받는 득령(得令) 상태예요! 계절이 {{일간오행}} 기운을 도와주고 있어서, 마치 봄에 싹이 트는 나무처럼 자연스럽게 힘을 받고 있답니다.',
  '태어난 달이 {{일간오행}} 기운을 생(生)하거나 같은 오행이라서 득령(得令)했어요. 계절의 힘을 등에 업고 있으니, 때를 잘 만난 사주라고 할 수 있어요!',
  '득령(得令)! 이것은 태어난 계절이 일간을 도와준다는 뜻이에요. {{일간오행}} 기운이 월지에서 힘을 얻고 있어서, 기본 에너지가 든든한 상태랍니다.',
  '월지가 {{일간오행}}을 지지해주는 득령(得令) 상태예요. 사주학에서 월지는 "사주의 핵심"이라고 할 만큼 중요한데, 여기서 힘을 얻고 있으니 기본기가 탄탄한 사주예요.',
  '태어난 달(월지)이 일간 {{일간오행}}에게 에너지를 공급하는 득령 상태예요! 사주명리학에서 득령은 신강/신약을 판단하는 가장 중요한 기준 중 하나랍니다.',
];

const DEUKRYEONG_WEAK: readonly string[] = [
  '월지(태어난 달)에서는 {{일간오행}} 기운을 직접 도와주지 못하는 실령(失令) 상태예요. 계절의 에너지가 일간과 다른 방향이지만, 다른 곳에서 도움을 받을 수 있어요!',
  '태어난 계절이 {{일간오행}} 기운과 맞지 않아서 실령(失令)이에요. 하지만 걱정 마세요! 사주의 다른 글자들이 도와줄 수 있고, 이름으로도 보완할 수 있답니다.',
  '월지에서 {{일간오행}} 기운을 도와주지 못하는 실령 상태예요. 마치 겨울에 태어난 꽃나무처럼 계절의 도움은 부족하지만, 온실 같은 환경을 만들어주면 아름다운 꽃을 피울 수 있어요.',
  '실령(失令) 상태라서 계절의 직접적인 지원은 받지 못하고 있어요. 하지만 사주를 전체적으로 보면 월지만으로 강약이 결정되지는 않으니, 다른 요소들도 함께 살펴봐야 해요.',
  '태어난 달이 {{일간오행}}을 직접 생해주거나 같은 오행이 아니어서 실령이에요. 다만 득령 여부는 하나의 기준일 뿐이고, 득지(得地)와 득세(得勢) 상태도 중요하답니다.',
];

const DEUKRYEONG_NEUTRAL: readonly string[] = [
  '월지(태어난 달)의 {{일간오행}} 기운 지원은 보통 수준이에요. 계절의 도움이 약간은 있지만, 압도적이지는 않은 상태랍니다.',
  '태어난 계절이 {{일간오행}} 기운과 중간 정도의 관계를 맺고 있어요. 완전한 득령은 아니지만, 실령도 아닌 중간 상태예요.',
  '월지에서 {{일간오행}} 기운에 대한 지원이 적당한 수준이에요. 다른 요인들(득지, 득세)과 함께 종합적으로 판단해야 정확한 강약을 알 수 있답니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  득지(得地) 템플릿 — 뿌리(지지) 지원 분석
// ─────────────────────────────────────────────────────────────────────────────

const DEUKJI_STRONG: readonly string[] = [
  '{{이름}}님의 사주에는 {{일간오행}} 기운의 뿌리가 지지(땅)에 단단하게 박혀 있어요! 이것을 득지(得地)라고 하는데, 나무로 치면 뿌리가 깊게 내린 거예요. 그래서 쉽게 흔들리지 않는 안정감이 있답니다.',
  '지지(특히 일지)에 {{일간오행}} 기운을 도와주는 요소가 있어서 득지(得地) 상태예요! 탄탄한 기반 위에 서 있는 것과 같아서, 실행력과 안정감이 뛰어나요.',
  '득지(得地)했어요! 이것은 지지(지지는 사주에서 "땅"에 해당해요)에 {{일간오행}}의 뿌리가 있다는 뜻이에요. 마치 건물의 튼튼한 기초처럼, 삶의 안정감을 제공해주는 요소랍니다.',
  '사주의 지지에서 {{일간오행}} 기운을 받고 있는 득지 상태예요. 특히 일지(일주의 아래 글자)에 뿌리가 있으면, 자기 자신과 배우자 궁에서 든든한 지원을 받는 것이니 더욱 좋아요!',
  '{{일간오행}}의 뿌리가 지지에 잘 자리 잡고 있어요. 득지한 사주는 현실 감각이 뛰어나고, 어떤 일이든 꾸준히 해나갈 수 있는 지구력이 있답니다.',
];

const DEUKJI_WEAK: readonly string[] = [
  '지지에서 {{일간오행}} 기운의 뿌리가 약한 실지(失地) 상태예요. 하지만 이것은 한 가지 기준일 뿐이에요! 다른 요소에서 보완이 충분히 가능하답니다.',
  '{{일간오행}} 기운의 뿌리(지지의 지원)가 부족한 실지(失地) 상태예요. 나무로 치면 뿌리가 얕은 편인데, 주변 환경의 도움을 받으면 충분히 잘 자랄 수 있어요!',
  '지지(땅)에서 {{일간오행}}을 직접 도와주는 힘이 부족한 실지 상태예요. 이름에서 일간을 도와주는 오행을 넣어주면, 부족한 뿌리를 보완하는 효과가 있답니다.',
  '실지(失地) 상태라 {{일간오행}}의 지지 기반이 약한 편이에요. 하지만 득령이나 득세 상태가 좋으면 충분히 보완될 수 있으니, 전체적인 균형을 봐야 해요.',
  '{{일간오행}} 기운의 뿌리가 지지에서 충분한 지원을 받지 못하고 있어요. 이런 경우 이름의 오행이 "추가 뿌리" 역할을 해줄 수 있어서, 작명이 더 중요해진답니다.',
];

const DEUKJI_NEUTRAL: readonly string[] = [
  '지지에서 {{일간오행}} 기운에 대한 지원이 중간 수준이에요. 완전한 득지는 아니지만, 어느 정도의 기반은 갖추고 있는 상태랍니다.',
  '{{일간오행}}의 지지 뿌리는 보통 수준이에요. 일부 도움은 받고 있지만, 압도적인 지원은 아닌 중립적인 상태예요.',
  '지지에서의 {{일간오행}} 지원은 적당한 편이에요. 득지가 강하지도 약하지도 않아서, 다른 요인들과 함께 종합적으로 판단해야 해요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  득세(得勢) 템플릿 — 세력(전체 생조) 분석
// ─────────────────────────────────────────────────────────────────────────────

const DEUKSE_STRONG: readonly string[] = [
  '사주 전체에서 {{일간오행}} 기운을 도와주는 글자가 많아요! 이것을 득세(得勢)라고 하는데, 주변에 응원단이 가득한 것과 같은 상태예요. 인성(도와주는 기운)과 비겁(같은 편 기운)이 많아서 {{일간오행}}이 든든한 지원을 받고 있답니다.',
  '득세(得勢) 상태예요! 사주팔자 전체에서 인성과 비겁 기운이 풍부해서, {{일간오행}}이 세력을 얻고 있어요. 마치 든든한 아군이 많은 장수처럼, 힘이 넘치는 상태랍니다.',
  '사주 전체에 {{일간오행}}의 세력이 강하게 형성되어 있어요. 득세한 사주는 사회적 지지가 풍부하고, 주변 사람들의 도움을 잘 받는 타입이라고 할 수 있어요.',
  '인성과 비겁 기운이 사주 곳곳에 포진해 있어서 득세(得勢) 상태예요. 세력을 얻은 {{일간오행}}은 자신감이 넘치고, 어떤 도전도 두렵지 않은 상태랍니다.',
  '{{일간오행}}을 지지하는 글자가 사주에 3글자 이상이면 득세라고 하는데, {{이름}}님의 사주가 바로 이 경우예요! 든든한 배경이 되어주는 좋은 상태에요.',
];

const DEUKSE_WEAK: readonly string[] = [
  '사주 전체에서 {{일간오행}}을 도와주는 글자가 부족한 실세(失勢) 상태예요. 인성과 비겁보다 식상, 재성, 관성이 더 많아서 에너지가 분산되는 경향이 있어요.',
  '{{일간오행}}을 도와주는 세력이 약한 실세(失勢) 상태예요. 하지만 이것은 반대로 식상, 재성, 관성이 발달해 있다는 뜻이기도 해서, 표현력이나 사교성이 뛰어날 수 있어요!',
  '실세(失勢) 상태라 {{일간오행}}을 지원하는 힘이 부족한 편이에요. 이런 경우, 이름이나 주변 환경에서 인성·비겁 기운을 보충해주면 큰 도움이 된답니다.',
  '사주 전체적으로 {{일간오행}}을 도와주는 글자보다 쓰이는 글자가 더 많아서 실세 상태예요. 에너지가 밖으로 많이 나가고 있으니, 충전을 위한 노력이 필요해요.',
  '{{일간오행}}의 세력이 약한 실세 상태지만, 이는 다양한 능력을 골고루 발휘할 수 있다는 의미이기도 해요. 부족한 부분은 이름의 오행으로 보완할 수 있답니다.',
];

const DEUKSE_NEUTRAL: readonly string[] = [
  '사주 전체에서 {{일간오행}}을 도와주는 세력은 보통 수준이에요. 아군과 적군이 비슷하게 배치되어 있어서, 균형 잡힌 상태라고 볼 수 있어요.',
  '{{일간오행}}의 세력(득세/실세)은 중간 정도예요. 인성·비겁과 식상·재성·관성이 적절히 섞여 있는 상태랍니다.',
  '사주에서 {{일간오행}}을 돕는 기운과 제압하는 기운이 비슷하게 분포되어 있어요. 세력 면에서 특별히 강하거나 약하지 않은 중립 상태예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  공통 마무리 문장
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_REMARKS: readonly string[] = [
  '신강/신약 판정은 사주 분석의 출발점이에요. 이것을 바탕으로 용신(用神)을 정하고, 이름의 오행을 결정하게 된답니다.',
  '지금까지 살펴본 신강도는 사주 해석의 기초예요. 이 결과를 바탕으로 어떤 오행이 필요한지, 이름에 어떤 기운을 담아야 하는지 결정할 수 있어요!',
  '신강/신약은 사주의 "체력"과 같은 거예요. 이것을 알아야 어떤 운동(용신)이 필요한지, 어떤 음식(이름 오행)이 좋은지 정할 수 있답니다.',
  '{{이름}}님의 신강도 분석이 끝났어요! 이 결과는 격국(격국 분석)과 용신(용신 체계) 판정의 핵심 기초가 된답니다.',
  '여기까지가 {{이름}}님의 신강/신약 분석이에요. 이 정보를 바탕으로 용신과 이름 오행을 선정하면, 사주의 균형을 잡는 데 큰 도움이 될 거예요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  게이지 시각화 데이터 생성
// ─────────────────────────────────────────────────────────────────────────────

function buildStrengthGaugeChart(index: number, level: StrengthLevel): ReportChart {
  return {
    type: 'gauge',
    title: '신강도 스펙트럼',
    data: {
      value: index,
      min: 0,
      max: 100,
      level: level,
      label: STRENGTH_KOREAN[level],
      extremeWeakEnd: 20,
      weakEnd: 40,
      balancedEnd: 60,
      strongEnd: 80,
    },
    meta: {
      description: '◄━ 극신약 ━━━ 신약 ━━━ 중화 ━━━ 신강 ━━━ 극신강 ━►',
      zones: [
        { label: '극신약', start: 0, end: 20, color: '#6366f1' },
        { label: '신약', start: 21, end: 40, color: '#3b82f6' },
        { label: '중화', start: 41, end: 59, color: '#22c55e' },
        { label: '신강', start: 60, end: 79, color: '#f97316' },
        { label: '극신강', start: 80, end: 100, color: '#ef4444' },
      ],
    },
  };
}

function buildSupportOpposeBarChart(support: number, oppose: number): ReportChart {
  const total = support + oppose;
  const supPct = total > 0 ? Math.round((support / total) * 100) : 50;
  const oppPct = total > 0 ? Math.round((oppose / total) * 100) : 50;
  return {
    type: 'bar',
    title: '아군(생조) vs 적군(극설) 비교',
    data: {
      '생조(비겁+인성)': supPct,
      '극설(식상+재성+관성)': oppPct,
    },
    meta: {
      rawSupport: support,
      rawOppose: oppose,
      description: '일간을 돕는 힘(생조)과 일간을 소모시키는 힘(극설)의 비율',
    },
  };
}

function buildDeukComponents(
  deukryeong: number,
  deukji: number,
  deukse: number,
): ReportChart {
  return {
    type: 'bar',
    title: '득령·득지·득세 구성',
    data: {
      '득령(계절 지원)': Math.round(deukryeong * 100) / 100,
      '득지(뿌리 지원)': Math.round(deukji * 100) / 100,
      '득세(세력 지원)': Math.round(deukse * 100) / 100,
    },
    meta: {
      description: '신강도를 구성하는 3가지 기준별 점수',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  하이라이트 생성
// ─────────────────────────────────────────────────────────────────────────────

function buildHighlights(
  index: number,
  level: StrengthLevel,
  support: number,
  oppose: number,
  deukryeong: number,
  deukji: number,
  deukse: number,
  dayMasterEl: string,
): ReportHighlight[] {
  const highlights: ReportHighlight[] = [];

  highlights.push({
    label: '신강도',
    value: `${index}점 (${STRENGTH_KOREAN[level]})`,
    element: dayMasterEl as ElementCode,
    sentiment: level === 'BALANCED' ? 'good' : level === 'STRONG' || level === 'WEAK' ? 'neutral' : 'caution',
  });

  highlights.push({
    label: '생조(아군)',
    value: `${Math.round(support * 1000) / 1000}`,
    sentiment: 'neutral',
  });

  highlights.push({
    label: '극설(적군)',
    value: `${Math.round(oppose * 1000) / 1000}`,
    sentiment: 'neutral',
  });

  const deukItems: Array<{ label: string; value: number; result: string }> = [
    { label: '득령', value: deukryeong, result: deukryeong > 0.5 ? '득령' : deukryeong > 0.2 ? '보통' : '실령' },
    { label: '득지', value: deukji, result: deukji > 0.5 ? '득지' : deukji > 0.2 ? '보통' : '실지' },
    { label: '득세', value: deukse, result: deukse > 0.5 ? '득세' : deukse > 0.2 ? '보통' : '실세' },
  ];

  for (const item of deukItems) {
    highlights.push({
      label: item.label,
      value: item.result,
      sentiment: item.result.startsWith('득') ? 'good' : item.result === '보통' ? 'neutral' : 'caution',
    });
  }

  return highlights;
}

// ─────────────────────────────────────────────────────────────────────────────
//  득령/득지/득세 분류 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

type DeukStatus = 'strong' | 'neutral' | 'weak';

function classifyDeuk(value: number): DeukStatus {
  if (value > 0.5) return 'strong';
  if (value > 0.2) return 'neutral';
  return 'weak';
}

function pickDeukTemplate(
  status: DeukStatus,
  strongPool: readonly string[],
  weakPool: readonly string[],
  neutralPool: readonly string[],
  rng: SeededRandom,
  vars: Record<string, string | number>,
): string {
  const pool = status === 'strong' ? strongPool : status === 'weak' ? weakPool : neutralPool;
  return pickAndFill(rng, pool, vars);
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인: 신강도 분석 섹션 생성
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 신강/신약 판정 보고서 섹션을 생성합니다.
 *
 * @param input - 보고서 생성에 필요한 전체 입력 데이터
 * @param rng - 시드 기반 의사 난수 생성기 (문장 다양성 보장)
 * @returns 신강도 분석 ReportSection 또는 데이터 부족 시 null
 */
export function generateStrengthSection(
  input: ReportInput,
): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 24; i++) rng.next(); // 고유 오프셋

  // ── 데이터 검증 ──
  const strength = input.saju?.strength;
  if (!strength) return null;

  const dayMasterEl = input.saju.dayMaster?.element ?? '';
  if (!dayMasterEl) return null;

  // ── 핵심 수치 산출 ──
  const index = normalizeStrengthIndex(input);
  const level = classifyStrength(index);
  const support = strength.totalSupport ?? 0;
  const oppose = strength.totalOppose ?? 0;
  const deukryeong = strength.deukryeong ?? 0;
  const deukji = strength.deukji ?? 0;
  const deukse = strength.deukse ?? 0;

  // ── 이름 & 오행 변수 준비 ──
  const name = input.name ?? '사용자';
  const dayElKo = elKo(dayMasterEl);
  const dayElFull = elFull(dayMasterEl);

  const sikOh = elKo(outputElement(dayMasterEl));       // 식상 오행
  const jaeOh = elKo(wealthElement(dayMasterEl));       // 재성 오행
  const inOh = elKo(resourceElement(dayMasterEl));      // 인성 오행
  const biOh = elKo(friendElement(dayMasterEl));        // 비겁 오행
  const gwanOh = elKo(authorityElement(dayMasterEl));   // 관성 오행

  const baseVars: Record<string, string> = {
    이름: name,
    일간오행: dayElKo,
    일간오행전체: dayElFull,
    식상오행: sikOh,
    재성오행: jaeOh,
    인성오행: inOh,
    비겁오행: biOh,
    관성오행: gwanOh,
  };

  // ── 단락 구성 ──
  const paragraphs: ReportParagraph[] = [];

  // --------------------------------------------------------------------------
  //  1) 강약 수준별 인트로 + 성격 + 조언 + 이름 + 건강
  // --------------------------------------------------------------------------
  switch (level) {
    case 'EXTREME_STRONG': {
      paragraphs.push(positive(pickAndFill(rng, EXTREME_STRONG_INTRO, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(narrative(pickAndFill(rng, EXTREME_STRONG_PERSONALITY, baseVars)));
      paragraphs.push(tip(pickAndFill(rng, EXTREME_STRONG_ADVICE, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(encouraging(pickAndFill(rng, EXTREME_STRONG_NAME_ADVICE, baseVars)));
      paragraphs.push(caution(pickAndFill(rng, EXTREME_STRONG_HEALTH, baseVars)));
      break;
    }
    case 'STRONG': {
      paragraphs.push(positive(pickAndFill(rng, STRONG_INTRO, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(narrative(pickAndFill(rng, STRONG_PERSONALITY, baseVars)));
      paragraphs.push(tip(pickAndFill(rng, STRONG_ADVICE, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(encouraging(pickAndFill(rng, STRONG_NAME_ADVICE, baseVars)));
      break;
    }
    case 'BALANCED': {
      paragraphs.push(positive(pickAndFill(rng, BALANCED_INTRO, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(narrative(pickAndFill(rng, BALANCED_PERSONALITY, baseVars)));
      paragraphs.push(tip(pickAndFill(rng, BALANCED_ADVICE, baseVars)));
      paragraphs.push(encouraging(pickAndFill(rng, BALANCED_NAME_ADVICE, baseVars)));
      break;
    }
    case 'WEAK': {
      paragraphs.push(encouraging(pickAndFill(rng, WEAK_INTRO, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(narrative(pickAndFill(rng, WEAK_PERSONALITY, baseVars)));
      paragraphs.push(tip(pickAndFill(rng, WEAK_ADVICE, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(encouraging(pickAndFill(rng, WEAK_NAME_ADVICE, baseVars)));
      break;
    }
    case 'EXTREME_WEAK': {
      paragraphs.push(encouraging(pickAndFill(rng, EXTREME_WEAK_INTRO, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(narrative(pickAndFill(rng, EXTREME_WEAK_PERSONALITY, baseVars)));
      paragraphs.push(emphasis(pickAndFill(rng, EXTREME_WEAK_JONGGYEOK, baseVars)));
      paragraphs.push(tip(pickAndFill(rng, EXTREME_WEAK_ADVICE, baseVars), dayMasterEl as ElementCode));
      paragraphs.push(encouraging(pickAndFill(rng, EXTREME_WEAK_NAME_ADVICE, baseVars)));
      paragraphs.push(caution(pickAndFill(rng, EXTREME_WEAK_HEALTH, baseVars)));
      break;
    }
  }

  // --------------------------------------------------------------------------
  //  2) 득령·득지·득세 세부 분석
  // --------------------------------------------------------------------------
  const deukryeongStatus = classifyDeuk(deukryeong);
  const deukjiStatus = classifyDeuk(deukji);
  const deukseStatus = classifyDeuk(deukse);

  // 득령 분석
  const deukryeongText = pickDeukTemplate(
    deukryeongStatus,
    DEUKRYEONG_STRONG,
    DEUKRYEONG_WEAK,
    DEUKRYEONG_NEUTRAL,
    rng,
    baseVars,
  );
  paragraphs.push(narrative(deukryeongText, dayMasterEl as ElementCode));

  // 득지 분석
  const deukjiText = pickDeukTemplate(
    deukjiStatus,
    DEUKJI_STRONG,
    DEUKJI_WEAK,
    DEUKJI_NEUTRAL,
    rng,
    baseVars,
  );
  paragraphs.push(narrative(deukjiText, dayMasterEl as ElementCode));

  // 득세 분석
  const deukseText = pickDeukTemplate(
    deukseStatus,
    DEUKSE_STRONG,
    DEUKSE_WEAK,
    DEUKSE_NEUTRAL,
    rng,
    baseVars,
  );
  paragraphs.push(narrative(deukseText, dayMasterEl as ElementCode));

  // --------------------------------------------------------------------------
  //  3) 득령/득지/득세 종합 평가
  // --------------------------------------------------------------------------
  const deukCount = [deukryeongStatus, deukjiStatus, deukseStatus].filter(s => s === 'strong').length;
  const silCount = [deukryeongStatus, deukjiStatus, deukseStatus].filter(s => s === 'weak').length;

  const SUMMARY_THREE_DEUK: readonly string[] = [
    '득령·득지·득세를 모두 갖추고 있어요! 3가지 기준에서 모두 도움을 받고 있으니, 기본 에너지가 정말 튼튼한 상태라고 할 수 있답니다.',
    '세 가지 기준(득령·득지·득세) 모두에서 {{일간오행}} 기운이 지원을 받고 있어요. 사주학에서 이것은 매우 든든한 상태를 의미해요!',
    '와! 득령도, 득지도, 득세도 모두 갖추고 있네요! 마치 하늘(계절), 땅(뿌리), 사람(세력) 모두에서 도움을 받는 천지인(天地人) 조화 상태예요.',
  ];

  const SUMMARY_TWO_DEUK: readonly string[] = [
    '3가지 기준 중 2가지에서 도움을 받고 있어요. 전반적으로 {{일간오행}} 기운이 건강한 편이라고 볼 수 있답니다.',
    '득령·득지·득세 중 2가지를 갖추고 있어서, 전체적으로 {{일간오행}}의 기반이 안정적인 편이에요.',
    '세 가지 기준 중 두 가지에서 지원을 받고 있으니, {{일간오행}} 기운이 적당히 건강한 상태예요!',
  ];

  const SUMMARY_ONE_DEUK: readonly string[] = [
    '3가지 기준 중 1가지에서만 도움을 받고 있어요. {{일간오행}} 기운이 부족한 편이라, 이름이나 환경으로 보완해주면 좋겠어요.',
    '득령·득지·득세 중 하나만 갖추고 있어서, {{일간오행}}의 에너지가 다소 부족한 상태예요. 하지만 이름으로 보충할 수 있어요!',
    '세 가지 기준 중 한 가지에서만 지원을 받고 있으니, 다른 방법으로 {{일간오행}} 기운을 보충하는 것이 중요해요.',
  ];

  const SUMMARY_ZERO_DEUK: readonly string[] = [
    '안타깝지만 3가지 기준 모두에서 직접적인 도움을 받지 못하고 있어요. 하지만 그래서 이름의 오행이 더욱 중요해진답니다! 이름으로 든든한 지원군을 만들어줄 수 있어요.',
    '득령·득지·득세 어느 것도 강하지 않은 상태예요. {{일간오행}} 기운이 취약하지만, 역설적으로 이름의 오행 보완 효과가 가장 크게 나타나는 사주이기도 해요.',
    '세 가지 기준 모두에서 약한 모습이에요. 하지만 걱정하지 마세요! 적절한 이름 오행 선택으로 부족한 기운을 크게 보충할 수 있답니다.',
  ];

  let summaryPool: readonly string[];
  if (deukCount >= 3) summaryPool = SUMMARY_THREE_DEUK;
  else if (deukCount === 2) summaryPool = SUMMARY_TWO_DEUK;
  else if (deukCount === 1) summaryPool = SUMMARY_ONE_DEUK;
  else summaryPool = SUMMARY_ZERO_DEUK;

  paragraphs.push(emphasis(pickAndFill(rng, summaryPool, baseVars), dayMasterEl as ElementCode));

  // --------------------------------------------------------------------------
  //  4) 아군 vs 적군 분석
  // --------------------------------------------------------------------------
  const total = support + oppose;
  if (total > 0) {
    const supPct = Math.round((support / total) * 100);
    const oppPct = 100 - supPct;

    const SUPPORT_OPPOSE_TEMPLATES: readonly string[] = [
      '아군(생조: 비겁+인성) {{생조비율}}% vs 적군(극설: 식상+재성+관성) {{극설비율}}%로, {{분석}}',
      '{{일간오행}}을 도와주는 생조 에너지가 {{생조비율}}%, 소모시키는 극설 에너지가 {{극설비율}}%예요. {{분석}}',
      '에너지 균형을 보면, 일간을 돕는 힘이 {{생조비율}}%, 제압하는 힘이 {{극설비율}}%를 차지하고 있어요. {{분석}}',
    ];

    let analysisComment: string;
    if (supPct >= 70) {
      analysisComment = '일간을 도와주는 힘이 압도적으로 강한 상태예요.';
    } else if (supPct >= 55) {
      analysisComment = '아군의 힘이 우세하여 {{일간오행}}이 건강한 상태예요.';
    } else if (supPct >= 45) {
      analysisComment = '양쪽 힘이 비슷하게 균형을 이루고 있어요.';
    } else if (supPct >= 30) {
      analysisComment = '적군의 힘이 더 강해서 {{일간오행}}이 다소 압박을 받고 있어요.';
    } else {
      analysisComment = '극설 에너지가 압도적이어서 {{일간오행}}이 많은 압박을 받고 있어요.';
    }

    const analysisText = fillTemplate(analysisComment, baseVars);
    paragraphs.push(narrative(
      pickAndFill(rng, SUPPORT_OPPOSE_TEMPLATES, {
        ...baseVars,
        생조비율: String(supPct),
        극설비율: String(oppPct),
        분석: analysisText,
      }),
    ));
  }

  // --------------------------------------------------------------------------
  //  5) 마무리 문장
  // --------------------------------------------------------------------------
  paragraphs.push(narrative(pickAndFill(rng, CLOSING_REMARKS, baseVars)));

  // --------------------------------------------------------------------------
  //  차트 & 하이라이트 생성
  // --------------------------------------------------------------------------
  const charts: ReportChart[] = [
    buildStrengthGaugeChart(index, level),
    buildSupportOpposeBarChart(support, oppose),
    buildDeukComponents(deukryeong, deukji, deukse),
  ];

  const highlights = buildHighlights(
    index, level, support, oppose,
    deukryeong, deukji, deukse,
    dayMasterEl,
  );

  // --------------------------------------------------------------------------
  //  섹션 반환
  // --------------------------------------------------------------------------
  return {
    id: 'strength',
    title: '신강/신약 판정',
    subtitle: `일간 ${dayElFull}의 에너지 강약 분석`,
    paragraphs,
    charts,
    highlights,
  };
}
