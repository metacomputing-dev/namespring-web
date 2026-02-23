/**
 * part2-deficiency.ts -- 과다/결핍 오행 진단 섹션
 *
 * PART 2-2: 사주에서 과다하거나 결핍된 오행을 진단하고
 * 대응 장기/색상/방위/음식 등을 한의학적 관점으로 제안합니다.
 *
 * 페르소나: "따뜻한 한의사"
 * - 기(氣), 보(補)와 사(瀉), 체질, 양생, 음양 조화 등 한의학 비유 사용
 * - 처방전을 내리듯 세심하고 배려 깊은 어조
 * - 다양한 어미: ~이지요, ~랍니다, ~는 거예요, ~하는 셈이에요, ~마련이거든요, ~입니다만
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportHighlight,
  ElementCode,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_COLOR,
  ELEMENT_COLOR_DETAIL,
  ELEMENT_DIRECTION,
  ELEMENT_ORGAN,
  ELEMENT_FOOD,
  ELEMENT_HOBBY,
  ELEMENT_SEASON,
  ELEMENT_TASTE,
  ELEMENT_NUMBER,
  ELEMENT_EMOTION,
  ELEMENT_NATURE,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_GENERATED_BY,
  elementCodeToKorean,
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
  eunNeun,
  iGa,
  eulReul,
  listJoin,
  type SeededRandom,
} from '../common/sentenceUtils.js';

// ---------------------------------------------------------------------------
//  헬퍼 함수
// ---------------------------------------------------------------------------

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

/** 오행 코드 → '목(木)' 형식 */
function elFull(c: string | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

/** 오행 코드 → '목' 형식 */
function elShort(c: string | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

/** 오행 코드 → '木' 한자 형식 */
function elHanja(c: string | undefined): string {
  return c ? (ELEMENT_HANJA[c as ElementCode] ?? c) : '?';
}

// ---------------------------------------------------------------------------
//  도입부 템플릿 — 한의학 비유 기반
// ---------------------------------------------------------------------------

const INTRO_TEMPLATES: readonly string[] = [
  '한의학에서는 "기운이 한쪽으로 치우치면 몸도 마음도 균형을 잃는 법"이라 하지요. {{이름}}님의 사주 오행을 진맥하듯 살펴보겠습니다.',
  '옛 한의서에 이르기를, 오장육부의 기운은 오행의 균형에서 비롯된다 했습니다. {{이름}}님의 오행 균형 상태를 찬찬히 살펴볼게요.',
  '한의학에서 가장 중요하게 여기는 것이 바로 "중용(中庸)"과 "조화(調和)"랍니다. 넘치면 덜어 내고, 부족하면 채워 넣는 것이 양생의 기본이지요. {{이름}}님의 오행 균형을 진단해 보겠습니다.',
  '체질에 따라 보(補)해야 할 것과 사(瀉)해야 할 것이 다른 법이에요. {{이름}}님의 사주 오행을 한의학적으로 진단하여, 어떤 기운을 보충하고 어떤 기운을 다스려야 하는지 알려드리겠습니다.',
  '좋은 한의사는 병이 나기 전에 몸의 균형을 살핀다고 하지요. 오행의 과다와 결핍을 아는 것은 바로 그 "미병(未病)"을 다스리는 첫걸음이랍니다. {{이름}}님의 기운 균형을 진맥해 볼게요.',
  '사주의 오행은 우리 몸의 오장(五臟)과 깊이 연결되어 있습니다. 어떤 기운이 넘치고 어떤 기운이 부족한지를 알면, 체질에 맞는 양생법을 찾을 수 있는 거예요. {{이름}}님의 오행 균형표를 함께 살펴볼까요?',
  '음양이 조화를 이루고 오행이 고르게 흐를 때 사람의 기(氣)가 가장 건강하다고 합니다. {{이름}}님의 사주에서 기운의 편차를 살펴, 보(補)하고 사(瀉)하는 지혜를 나눠 드리겠습니다.',
  '옛 명의(名醫)들은 "상의(上醫)는 미병(未病)을 치료한다"라고 했어요. 사주 오행의 균형을 미리 아는 것이 바로 그런 지혜에 해당하는 셈이지요. {{이름}}님의 오행 상태를 점검해 보겠습니다.',
];

// ---------------------------------------------------------------------------
//  과다 오행 해석 템플릿 — 사(瀉)적 관점
// ---------------------------------------------------------------------------

const EXCESS_INTRO_TEMPLATES: readonly string[] = [
  '{{이름}}님의 사주에서 {{오행Full}} 기운이 과다하게 차올라 있습니다. 한의학에서는 이처럼 한 기운이 지나치게 성(盛)한 상태를 "실증(實證)"이라 부르지요.',
  '진맥 결과, {{오행Full}}의 기운이 상당히 왕성하군요. 마치 봄비가 너무 많이 내려 물이 넘치는 것처럼, {{오행Short}}의 기세가 다른 오행을 압도하고 있는 셈이에요.',
  '{{이름}}님의 사주에는 {{오행Full}} 기운이 넉넉하다 못해 넘치는 상태랍니다. 기운이 풍부한 것은 좋지만, 한쪽으로 치우치면 다른 기운이 위축되기 마련이거든요.',
  '사주를 살펴보니 {{오행Full}}의 기(氣)가 매우 충만합니다. 이 기운이 왕성하다는 것은 {{오행Short}} 특유의 강점이 두드러진다는 뜻이지만, 과유불급(過猶不及)이라는 말도 있지요.',
  '{{오행Full}} 기운이 유난히 강하게 흐르고 있어요. 한의학에서는 지나친 기운을 "사(瀉)"하여 조절하라고 권하는데, 이는 억누르는 것이 아니라 자연스럽게 흘려보내는 것이랍니다.',
  '{{이름}}님에게는 {{오행Full}}의 기운이 풍성하게 타고났습니다만, 한 오행이 지나치면 그에 대응하는 장부에 부담이 갈 수 있는 법이에요.',
];

const EXCESS_EMOTION_TEMPLATES: readonly string[] = [
  '{{오행Short}} 기운이 왕성한 분은 {{긍정감정}}의 미덕을 타고났지만, 기운이 과할 때에는 {{부정감정}}이 고개를 들 수 있으니 마음 양생에도 신경 써 주세요.',
  '이 기운이 강하면 {{긍정감정}}이라는 훌륭한 자질로 발현되지요. 다만 과잉되면 {{부정감정}}으로 흐를 수 있으므로, 평소 감정의 기복을 잘 살피는 것이 양생의 지름길이에요.',
  '{{긍정감정}} — 이것이 {{오행Short}} 기운이 선물하는 타고난 성품이랍니다. 하지만 기운이 넘칠 때는 {{부정감정}}이 동반될 수 있으니, 이를 자각하는 것만으로도 큰 도움이 되는 거예요.',
  '한의학에서 {{오행Short}} 기운과 연결된 감정은 {{긍정감정}}과 {{부정감정}}이에요. 기운이 조화로우면 전자가, 기운이 치우치면 후자가 드러나는 법이지요.',
  '{{오행Short}}의 기운이 충만할 때는 {{긍정감정}}이 빛을 발하지만, 과하면 {{부정감정}}의 그림자가 드리우기도 합니다. 마음도 몸과 마찬가지로 보(補)하고 사(瀉)하는 지혜가 필요한 거예요.',
];

const EXCESS_ORGAN_TEMPLATES: readonly string[] = [
  '{{오행Short}} 기운이 과다하면 {{주장기}}와 {{부장기}}에 열(熱)이 몰리기 쉽습니다. {{장기상세}} 부위의 건강에 좀 더 관심을 기울여 주세요.',
  '한의학적으로 {{오행Short}} 과다는 {{주장기}}·{{부장기}} 계통의 기(氣)가 울체(鬱滯)될 수 있음을 뜻해요. 무리하지 않고, 해당 장부를 편안히 쉬게 해 주는 것이 상책이랍니다.',
  '{{오행Short}}과 연결된 {{주장기}}, {{부장기}} 그리고 {{장기상세}}를 잘 보살펴 주세요. 과한 기운은 해당 장부에 부담을 줄 수 있기 때문이에요.',
  '{{주장기}}와 {{부장기}}가 바로 {{오행Short}} 기운의 집이라 할 수 있어요. 기운이 넘칠 때는 이 "집"에 열과 스트레스가 쌓이기 쉬우므로, 주기적인 양생이 필요합니다.',
];

const EXCESS_TIP_TEMPLATES: readonly string[] = [
  '{{오행Short}} 기운을 자연스럽게 흘려보내려면 {{사오행}}의 기운을 빌려 보세요. {{사오행색상}} 계열의 색상을 생활에 활용하거나, {{사오행방위}} 방향에서 바람을 쐬는 것도 좋은 방법이랍니다.',
  '과한 {{오행Short}} 기운을 다스리는 처방은 의외로 간단해요. {{사오행}}의 기운이 {{오행Short}}을 자연스레 설기(泄氣)해 주거든요. {{사오행음식}} 같은 음식을 식단에 더해 보시는 건 어떨까요?',
  '{{오행Short}} 기운의 과다를 조절하는 양생법으로, {{사오행취미}} 같은 활동을 추천드려요. {{사오행}}의 기운이 {{오행Short}}의 열기를 부드럽게 식혀 줄 거예요.',
  '지나친 {{오행Short}} 기운은 억지로 누르기보다, {{사오행}}의 기운으로 자연스럽게 흘려보내는 것이 현명하지요. 생활 속에서 {{사오행색상}} 색상과 {{사오행방위}} 방향을 의식해 보세요.',
];

// ---------------------------------------------------------------------------
//  결핍 오행 해석 템플릿 — 보(補)적 관점
// ---------------------------------------------------------------------------

const DEFICIENT_INTRO_TEMPLATES: readonly string[] = [
  '{{이름}}님의 사주에서 {{오행Full}} 기운이 부족한 편이에요. 한의학에서는 이를 "허증(虛證)"이라 하여, 모자란 기운을 보(補)해 주는 것을 우선으로 삼지요.',
  '{{오행Full}}의 기운이 약하게 흐르고 있군요. 마치 가뭄에 물이 부족한 논처럼, 이 기운을 보충해 주면 전체 균형이 한결 나아질 수 있답니다.',
  '진맥 결과 {{오행Full}} 기운이 결핍 상태에요. 걱정하실 필요는 없습니다 — 체질에 맞는 양생법을 알려드릴 테니, 일상에서 차근차근 보(補)해 나가시면 되는 거예요.',
  '{{이름}}님에게는 {{오행Full}}의 기운이 좀 더 필요해 보여요. 한의학에서는 부족한 것을 "보(補)"하는 처방을 가장 먼저 생각하지요. 자연의 기운을 빌려 균형을 되찾아 봐요.',
  '사주의 {{오행Full}} 기운이 다소 약합니다. 하지만 이것은 약점이 아니라, 어디를 보충하면 좋을지 알려주는 나침반 같은 것이랍니다. 체질에 맞는 보양법을 안내해 드릴게요.',
  '{{오행Full}}의 기(氣)가 미약하게 흐르고 있어요. 한의학에는 "허즉보지(虛則補之)"라는 원칙이 있습니다 — 부족하면 채워 주라는 뜻이지요. 어떻게 보충할 수 있는지 함께 살펴봐요.',
];

const DEFICIENT_ORGAN_TEMPLATES: readonly string[] = [
  '{{오행Short}} 기운이 약하면 {{주장기}}와 {{부장기}}의 기능이 저하되기 쉽습니다. {{장기상세}} 부위를 평소에 따뜻하게 보호하고, 무리하지 않는 것이 좋겠어요.',
  '한의학에서 {{오행Short}}이 관장하는 장부는 {{주장기}}·{{부장기}}예요. 이 기운이 부족하면 해당 장부가 쉬이 피로해질 수 있으므로, 꾸준한 관리가 양생의 핵심이랍니다.',
  '{{오행Short}} 기운과 연결된 {{장기상세}} — 이 부위의 건강에 좀 더 마음을 써 주세요. 보(補)하는 음식과 생활 습관이 큰 힘이 되어 줄 거예요.',
  '{{주장기}}와 {{부장기}}는 {{오행Short}} 기운의 터전이에요. 이 기운이 모자라면 장부의 기(氣)도 허약해지기 쉬운 법이지요. 따뜻하게 보양하는 습관을 권해 드립니다.',
];

const DEFICIENT_SUPPLEMENT_TEMPLATES: readonly string[] = [
  '{{오행Short}} 기운을 보(補)하는 가장 손쉬운 방법은 생활 속에서 해당 기운을 불러오는 것이에요. {{색상}} 계열의 옷이나 소품을 가까이하고, {{방위}} 방향에서 좋은 기운을 받아 보세요.',
  '체질에 맞는 양생법을 알려드릴게요. {{색상}} 색상은 {{오행Short}} 기운을 끌어올리는 데 도움이 되고, 식탁에 {{음식추천}} 같은 음식을 자주 올리면 부족한 기운이 보충된답니다.',
  '{{오행Short}} 기운을 보충하는 처방이에요: {{색상}} 계열 색상을 생활에 활용하시고, {{방위}} 방향이 유리합니다. {{맛}} 음식을 즐기시면 자연의 기운을 빌려 균형을 맞출 수 있어요.',
  '부족한 {{오행Short}} 기운을 채우는 양생 처방을 내려 드릴게요. {{음식추천}} 등을 식단에 넣고, {{색상}} 계통 색상과 {{방위}} 방향을 의식하면 기(氣)의 흐름이 한결 좋아질 거예요.',
  '{{오행Short}} 기운을 높이는 데에는 {{보오행}}의 기운이 큰 도움이 돼요. {{보오행}}이 {{오행Short}}을 낳아 주는 어머니 오행이거든요. {{보오행색상}} 색상과 {{보오행음식}} 같은 음식도 함께 활용해 보세요.',
];

const DEFICIENT_NUMBER_TEMPLATES: readonly string[] = [
  '{{오행Short}} 기운과 어울리는 숫자는 {{숫자1}}과 {{숫자2}}이에요. 전화번호, 비밀번호, 방 번호 등에 이 숫자를 활용하면 은은하게 기운이 보충되는 효과가 있답니다.',
  '행운의 숫자도 알려드릴게요. {{숫자1}}과 {{숫자2}}가 {{오행Short}} 기운의 숫자인데, 일상에서 이 숫자를 의식적으로 가까이하는 것도 양생의 한 방법이에요.',
  '{{오행Short}} 기운의 숫자는 {{숫자1}}·{{숫자2}}이지요. 사소해 보여도, 이런 작은 변화가 기(氣)의 흐름에 조용한 변화를 만들어 준답니다.',
];

// ---------------------------------------------------------------------------
//  마무리 템플릿 — 종합 양생 조언
// ---------------------------------------------------------------------------

const CLOSING_TEMPLATES: readonly string[] = [
  '오행의 과다와 결핍을 아는 것은 체질을 이해하는 첫걸음이에요. 한의학에서 말하는 "치미병(治未病)" — 병이 되기 전에 다스리는 지혜를 일상에서 실천해 보세요.',
  '보(補)하고 사(瀉)하는 원리를 알았으니, 이제 생활 속 작은 변화부터 시작해 보시는 건 어떨까요? 큰 처방이 아니라 작은 양생이 건강한 기(氣)를 만든답니다.',
  '모든 체질에 완벽한 균형이란 없습니다. 다만, 자신의 기운 편차를 알고 조절하려 노력하는 것 자체가 훌륭한 양생이지요. {{이름}}님의 건강한 균형을 응원합니다.',
  '한 가지 기억해 두세요 — 과다한 기운은 약점이 아니라 넘치는 재능이고, 결핍된 기운은 부족이 아니라 보충해야 할 숙제에요. 음양의 조화 속에서 {{이름}}님만의 균형점을 찾아가시길 바랍니다.',
  '동의보감(東醫寶鑑)에 이르기를, "양생은 특별한 것이 아니라 일상의 작은 습관"이라 했어요. 오늘 알게 된 오행 처방을 하나씩 실천해 보시면, 기(氣)의 흐름이 달라지는 것을 느끼실 거예요.',
  '이 진단이 {{이름}}님의 몸과 마음을 보살피는 작은 나침반이 되었으면 합니다. 체질을 알면 양생이 쉬워지고, 양생이 쉬우면 삶이 한결 편안해지는 법이지요.',
];

// ---------------------------------------------------------------------------
//  과다 오행 → 설기(泄氣) 오행 안내용 헬퍼
// ---------------------------------------------------------------------------

/**
 * 과다 오행의 기운을 빼 주는(설기) 오행을 구합니다.
 * 상생 관계에서 "과다 오행이 생하는 오행"이 설기 오행입니다.
 * 예: 木 과다 → 木이 생하는 火로 기운을 흘려보냄
 */
function getDrainingElement(excessive: ElementCode): ElementCode {
  return ELEMENT_GENERATES[excessive];
}

// ---------------------------------------------------------------------------
//  메인 생성 함수
// ---------------------------------------------------------------------------

export function generateDeficiencySection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 12; i++) rng.next();

  const name = safeName(input);
  const excessive = (input.saju.excessiveElements ?? []) as string[];
  const deficient = (input.saju.deficientElements ?? []) as string[];

  // 과다/결핍 데이터가 모두 비어 있으면 null 반환
  if (excessive.length === 0 && deficient.length === 0) return null;

  const paragraphs: ReportParagraph[] = [];
  const tables: ReportTable[] = [];
  const highlights: ReportHighlight[] = [];

  // ── 1. 도입부 ─────────────────────────────────────────────────────────────
  paragraphs.push(
    narrative(pickAndFill(rng, INTRO_TEMPLATES, { 이름: name })),
  );

  // ── 2. 과다 오행 분석 (사瀉적 관점) ───────────────────────────────────────
  for (const el of excessive) {
    const elCode = el as ElementCode;
    const emotion = ELEMENT_EMOTION[elCode];
    const organ = ELEMENT_ORGAN[elCode];
    const drainingEl = getDrainingElement(elCode);
    const drainingFoods = ELEMENT_FOOD[drainingEl] ?? [];
    const drainingHobbies = ELEMENT_HOBBY[drainingEl] ?? [];

    // 과다 오행 개요
    const introText = pickAndFill(rng, EXCESS_INTRO_TEMPLATES, {
      이름: name,
      오행Full: elFull(el),
      오행Short: elShort(el),
      오행Hanja: elHanja(el),
    });
    paragraphs.push(caution(introText, elCode));

    // 감정 해석
    const emotionText = pickAndFill(rng, EXCESS_EMOTION_TEMPLATES, {
      오행Short: elShort(el),
      긍정감정: emotion?.positive ?? '긍정적 에너지',
      부정감정: emotion?.negative ?? '주의할 감정',
    });
    paragraphs.push(narrative(emotionText, elCode));

    // 장기 주의
    const organText = pickAndFill(rng, EXCESS_ORGAN_TEMPLATES, {
      오행Short: elShort(el),
      주장기: organ?.main ?? '',
      부장기: organ?.sub ?? '',
      장기상세: organ?.detail ?? '',
    });
    paragraphs.push(caution(organText, elCode));

    // 사(瀉) 처방 팁
    const tipText = pickAndFill(rng, EXCESS_TIP_TEMPLATES, {
      오행Short: elShort(el),
      사오행: elFull(drainingEl),
      사오행색상: ELEMENT_COLOR[drainingEl] ?? '',
      사오행방위: ELEMENT_DIRECTION[drainingEl] ?? '',
      사오행음식: (drainingFoods.length > 0 ? rng.sample(drainingFoods, 3).join(', ') : '관련 음식'),
      사오행취미: (drainingHobbies.length > 0 ? rng.sample(drainingHobbies, 2).join('이나 ') : '가벼운 활동'),
    });
    paragraphs.push(tip(tipText, drainingEl));
  }

  // ── 3. 결핍 오행 분석 (보補적 관점) ───────────────────────────────────────
  for (const el of deficient) {
    const elCode = el as ElementCode;
    const organ = ELEMENT_ORGAN[elCode];
    const foods = ELEMENT_FOOD[elCode] ?? [];
    const numbers = ELEMENT_NUMBER[elCode] ?? [0, 0];
    const color = ELEMENT_COLOR[elCode] ?? '';
    const direction = ELEMENT_DIRECTION[elCode] ?? '';
    const taste = ELEMENT_TASTE[elCode] ?? '';
    const feedingEl = ELEMENT_GENERATED_BY[elCode]; // 결핍 오행을 낳아주는 오행
    const feedingFoods = ELEMENT_FOOD[feedingEl] ?? [];

    // 결핍 오행 개요
    const introText = pickAndFill(rng, DEFICIENT_INTRO_TEMPLATES, {
      이름: name,
      오행Full: elFull(el),
      오행Short: elShort(el),
    });
    paragraphs.push(emphasis(introText, elCode));

    // 장부 건강 안내
    const organText = pickAndFill(rng, DEFICIENT_ORGAN_TEMPLATES, {
      오행Short: elShort(el),
      주장기: organ?.main ?? '',
      부장기: organ?.sub ?? '',
      장기상세: organ?.detail ?? '',
    });
    paragraphs.push(caution(organText, elCode));

    // 보(補) 처방 — 색상/방위/음식
    const foodSample = foods.length > 0 ? rng.sample(foods, 4).join(', ') : '관련 음식';
    const feedingFoodSample = feedingFoods.length > 0 ? rng.sample(feedingFoods, 2).join(', ') : '';
    const supplementText = pickAndFill(rng, DEFICIENT_SUPPLEMENT_TEMPLATES, {
      오행Short: elShort(el),
      색상: color,
      방위: direction,
      맛: taste,
      음식추천: foodSample,
      보오행: elFull(feedingEl),
      보오행색상: ELEMENT_COLOR[feedingEl] ?? '',
      보오행음식: feedingFoodSample,
    });
    paragraphs.push(encouraging(supplementText, elCode));

    // 숫자 안내
    const numberText = pickAndFill(rng, DEFICIENT_NUMBER_TEMPLATES, {
      오행Short: elShort(el),
      숫자1: String(numbers[0]),
      숫자2: String(numbers[1]),
    });
    paragraphs.push(tip(numberText, elCode));
  }

  // ── 4. 보완 가이드 테이블 (결핍 오행) ─────────────────────────────────────
  if (deficient.length > 0) {
    tables.push({
      title: '결핍 오행 보(補) 양생 가이드',
      headers: ['오행', '보양 색상', '유리한 방위', '행운 숫자', '보양 음식', '맛', '관리 장기'],
      rows: deficient.map(el => {
        const c = el as ElementCode;
        const foods = ELEMENT_FOOD[c] ?? [];
        return [
          elFull(c),
          ELEMENT_COLOR[c] ?? '',
          ELEMENT_DIRECTION[c] ?? '',
          (ELEMENT_NUMBER[c] ?? []).join(' · '),
          rng.sample(foods, 4).join(', '),
          ELEMENT_TASTE[c] ?? '',
          ELEMENT_ORGAN[c]?.detail ?? '',
        ];
      }),
    });
  }

  // ── 5. 과다 오행 사(瀉) 가이드 테이블 ─────────────────────────────────────
  if (excessive.length > 0) {
    tables.push({
      title: '과다 오행 사(瀉) 조절 가이드',
      headers: ['과다 오행', '설기 오행', '활용 색상', '활용 방위', '추천 음식', '주의 장기'],
      rows: excessive.map(el => {
        const c = el as ElementCode;
        const drainingEl = getDrainingElement(c);
        const drainingFoods = ELEMENT_FOOD[drainingEl] ?? [];
        return [
          elFull(c),
          elFull(drainingEl),
          ELEMENT_COLOR[drainingEl] ?? '',
          ELEMENT_DIRECTION[drainingEl] ?? '',
          rng.sample(drainingFoods, 4).join(', '),
          ELEMENT_ORGAN[c]?.detail ?? '',
        ];
      }),
    });
  }

  // ── 6. 마무리 ─────────────────────────────────────────────────────────────
  paragraphs.push(
    encouraging(pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name })),
  );

  // ── 7. 하이라이트 ─────────────────────────────────────────────────────────
  if (excessive.length > 0) {
    highlights.push({
      label: '과다 오행 (實)',
      value: excessive.map(e => `${elFull(e)} — ${ELEMENT_ORGAN[e as ElementCode]?.main ?? ''} 주의`).join(' / '),
      sentiment: 'caution',
    });
  }
  if (deficient.length > 0) {
    highlights.push({
      label: '결핍 오행 (虛)',
      value: deficient.map(e => `${elFull(e)} — ${ELEMENT_COLOR[e as ElementCode] ?? ''}·${ELEMENT_DIRECTION[e as ElementCode] ?? ''}으로 보(補)`).join(' / '),
      sentiment: 'caution',
    });
  }

  return {
    id: 'deficiency',
    title: '오행 과다·결핍 진단',
    subtitle: '보(補)하고 사(瀉)하는 양생의 지혜',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}
