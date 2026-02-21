/**
 * part7-fortune.ts -- 대운(大運) 분석 섹션
 *
 * PART 7: 대운 기본 정보와 대운별 분석을 제공합니다.
 * 페르소나: "항해사/선장" — 인생을 바다 위의 항해로, 대운을 해류와 바람으로 비유합니다.
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
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_GENERATED_BY,
  YONGSHIN_GRADE_STARS,
  YONGSHIN_GRADE_DESC,
  getYongshinMatchGrade,
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

// ─────────────────────────────────────────────────────────────────────────────
//  헬퍼 함수
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//  오행별 항해 이미지 매핑
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENT_SAILING_IMAGE: Record<string, string> = {
  WOOD:  '봄바람이 돛에 가득 차는 싱그러운 출항의 기운',
  FIRE:  '한여름 태양 아래 활기찬 순항의 기운',
  EARTH: '안정된 항구에서 보급을 채우는 든든한 기운',
  METAL: '가을 서풍을 타고 먼 바다로 나아가는 결단의 기운',
  WATER: '깊은 바다의 해류처럼 지혜롭게 흐르는 기운',
};

// ─────────────────────────────────────────────────────────────────────────────
//  문장 템플릿 — 항해사/선장 페르소나
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '대운(大運)은 인생이라는 대양에서 10년마다 바뀌는 조류와도 같아요. 선장인 {{이름}}님, 지금부터 당신의 항해 일지를 펼쳐볼게요!',
  '대운은 항해에서의 해류와 같답니다. 순풍을 만나면 돛을 높이 올리고, 역풍이 불면 닻을 내려 마음을 다잡는 것이지요. {{이름}}님의 바다를 함께 읽어보겠어요.',
  '인생이라는 대양에는 10년마다 새로운 조류가 흐르기 시작해요. 이것이 바로 대운이에요. {{이름}}님, 어떤 바람이 기다리고 있는지 나침반을 꺼내 볼게요!',
  '항해사에게 해류 지도가 있다면, 사주에는 대운이 있는 법이거든요. 10년마다 바뀌는 바다의 물길을 미리 읽어두면 항해가 한결 수월해진답니다.',
  '대운은 인생의 바다에서 만나는 크고 긴 파도예요. 어떤 파도는 배를 높이 띄워주고, 어떤 파도는 조심스럽게 건너야 하는 거랍니다. {{이름}}님의 항해를 살펴볼게요.',
  '먼 바다를 항해하는 선장에게 가장 중요한 건 해류와 바람의 방향을 아는 것이지요. 대운 분석은 바로 그 나침반 역할을 해주는 거예요.',
];

const DIRECTION_FORWARD_TEMPLATES: readonly string[] = [
  '{{이름}}님의 대운은 순행(順行)이에요. 해류를 따라 순조롭게 앞으로 나아가는 항해도와 같아요. {{시작나이}}세부터 첫 번째 항로가 열리는 셈이에요.',
  '대운이 순행으로 흐르고 있어요. 마치 바람이 뱃머리를 밀어주는 방향으로 부는 것과 같은 거랍니다. {{시작나이}}세에 첫 출항이 시작되는 거예요.',
  '순행 대운이라, 조류의 흐름에 배를 맡기면 자연스럽게 앞으로 나아가게 돼요. {{시작나이}}세부터 본격적인 항해가 시작될 때예요.',
];

const DIRECTION_REVERSE_TEMPLATES: readonly string[] = [
  '{{이름}}님의 대운은 역행(逆行)이에요. 해류를 거슬러 올라가는 항해와도 같아요. 하지만 역풍 속 항해사가 더 단련되는 법이거든요. {{시작나이}}세에 출항이에요.',
  '대운이 역행으로 흐르고 있어요. 역류를 타고 올라가는 연어처럼, 거센 물살 속에서 더 강해지는 항해가 될 거예요. {{시작나이}}세부터 시작이에요.',
  '역행 대운이라, 물살을 거슬러 나아가야 하는 항해도와 같아요. 그만큼 내면의 힘이 단단해지는 여정이 되는 거랍니다. {{시작나이}}세에 닻을 올려요.',
];

/** 용신부합도 등급별 항해 비유 문장 */
const GRADE_SAILING_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '순풍만범(順風滿帆)! 돛이 활짝 펴지고, 바다가 길을 열어주는 최상의 항해 시기이지요.',
    '등대가 환하게 빛나고, 파도마저 배를 밀어주는 최고의 순풍이에요. 돛을 높이 올릴 때예요!',
    '별자리가 선명하게 빛나고, 해류가 목적지로 이끌어주는 황금 항로가 열리는 시기도 같아요.',
    '망망대해에서 가장 완벽한 바람을 만난 것과 같아요. 용기를 내어 먼 바다로 나아갈 때이지요.',
  ],
  4: [
    '좋은 바람이 부는 항해예요. 수평선 너머로 밝은 해가 떠오르는 듯한 기운이 감돌아요.',
    '순풍이 돛을 적당히 밀어주는 시기랍니다. 등대 불빛을 따라 안정적으로 항해할 수 있어요.',
    '따뜻한 남풍이 부는 바다 위의 기분 좋은 항해와도 같아요. 새로운 항구를 향해 나아갈 때예요.',
    '해류의 방향이 우호적이에요. 큰 파도 없이 쾌적한 항해를 즐길 수 있는 시기인 셈이에요.',
  ],
  3: [
    '평온한 바다 위의 항해예요. 큰 파도도 순풍도 없지만, 꾸준히 노를 저으면 목적지에 닿을 수 있어요.',
    '잔잔한 수면 위를 미끄러지듯 나아가는 시기예요. 나침반을 잘 보며 방향을 잡으면 무난한 항해가 될 거예요.',
    '바다가 고요한 시기예요. 돛보다는 노의 힘으로, 즉 자기 노력으로 전진해야 할 때도 같아요.',
    '안개 낀 바다도 폭풍의 바다도 아닌, 잔잔한 항해 구간이에요. 차분히 방향을 잡으면 괜찮은 거랍니다.',
  ],
  2: [
    '조심해야 할 암초가 숨어 있는 해역을 지나는 시기예요. 해도를 꼼꼼히 살피며 신중하게 항해하셔야 해요.',
    '역류가 흐르는 바다를 만나는 구간이에요. 키를 단단히 잡고, 때로는 우회항로를 찾는 지혜가 필요할 때이지요.',
    '파도가 높아지는 해역에 들어서는 시기예요. 무리한 원항(遠航)보다는 가까운 항구에서 정박하며 때를 기다리는 것도 좋아요.',
    '해류가 뱃머리와 어긋나게 흐르는 시기와 비슷해요. 속도를 줄이고 조심스럽게 나아가면 무사히 지나갈 수 있어요.',
  ],
  1: [
    '폭풍우가 몰아치는 바다를 건너야 하는 시기예요. 하지만 모든 폭풍에는 끝이 있는 법이거든요. 닻을 내리고 선체를 점검하세요.',
    '거친 파도와 역풍이 부는 험난한 항해 구간이에요. 무리한 출항보다는 항구에서 배를 수리하고 다음 순풍을 기다리는 것이 현명해요.',
    '태풍이 지나가는 해역과도 같은 시기예요. 돛을 접고, 선체를 낮추고, 내면의 닻을 단단히 내려야 할 때이지요.',
    '안개와 거센 파도가 겹치는 바다를 지나는 시기와 같아요. 등대의 불빛을 잘 찾아, 안전한 항로로 우회하는 지혜가 필요해요.',
  ],
};

/** 대운별 구체적 해석 — 등급에 따라 선택 */
const GRADE_ADVICE_TEMPLATES: Record<YongshinMatchGrade, readonly string[]> = {
  5: [
    '이 시기에는 새로운 도전, 사업 확장, 큰 결단에 과감히 돛을 올려도 좋아요.',
    '수평선 너머 새로운 대륙을 향해 출항하기에 더없이 좋은 바람이에요.',
    '기회의 파도가 밀려오는 시기이니, 망설이지 말고 배에 올라타세요.',
  ],
  4: [
    '좋은 해류를 만난 만큼, 계획했던 일들을 차근차근 추진해 보세요.',
    '순풍의 도움을 받아 원하는 항구에 한 걸음 더 가까이 다가갈 수 있는 시기예요.',
    '별자리가 밝은 밤, 항해사가 미래를 내다보듯 장기적인 계획을 세우기 좋아요.',
  ],
  3: [
    '잔잔한 바다에서는 자기 계발과 내면의 나침반을 점검하는 게 최선이에요.',
    '특별히 좋지도 나쁘지도 않은 시기, 꾸준히 노를 젓는 성실함이 빛을 발해요.',
    '파도가 잔잔할 때 배를 정비하고 다음 항해를 준비하는 현명한 선장이 되세요.',
  ],
  2: [
    '이 해역에서는 무리한 모험보다 안전 항해를 택하는 것이 지혜로운 법이에요.',
    '암초를 피하듯, 큰 투자나 급격한 변화는 자제하고 내실을 다지는 게 좋아요.',
    '역풍이 불 때 항구에 정박하며 힘을 비축해두면, 다음 순풍 때 더 멀리 갈 수 있어요.',
  ],
  1: [
    '폭풍이 지나갈 때까지 닻을 내리세요. 내면을 단련하고 건강을 챙기는 시기로 삼으면 좋아요.',
    '거친 바다에서도 배가 부서지지 않으면 언젠가 항구에 도착하는 법이에요. 인내가 최고의 전략이에요.',
    '선장은 폭풍 속에서 단련됩니다. 이 시기를 잘 버텨내면 훨씬 강해진 모습으로 새 항로를 열 수 있어요.',
  ],
};

const CLOSING_TEMPLATES: readonly string[] = [
  '대운이라는 바다의 조류를 미리 읽어두면, 인생의 항해가 한결 수월해져요. 순풍일 때 멀리 나아가고, 역풍일 때 내면을 다지는 지혜로운 선장이 되시길 바라요!',
  '인생의 바다에서 어떤 파도를 만나든, 나침반을 잘 보고 방향을 잃지 않으면 반드시 원하는 항구에 도착할 수 있어요. {{이름}}님의 항해를 응원합니다!',
  '모든 바다에는 때가 있어요. 순풍이 불 때 돛을 올리고, 잔잔할 때 배를 수리하고, 폭풍이 올 때 닻을 내리는 — 그것이 현명한 선장의 비결이에요.',
  '항해는 계속됩니다. 대운의 흐름을 알고 있는 것만으로도 {{이름}}님은 이미 훌륭한 항해사인 셈이에요. 수평선 너머의 밝은 미래를 향해 나아가세요!',
  '별이 빛나는 밤바다에서도, 안개 낀 새벽 바다에서도, 나침반만 있으면 길을 잃지 않는 법이에요. 이 대운 분석이 {{이름}}님의 나침반이 되길 바랍니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  대운 데이터 추출
// ─────────────────────────────────────────────────────────────────────────────

interface DaeunEntry {
  stemHangul: string;
  branchHangul: string;
  stemElement: string;
  branchElement: string;
  startAge: number;
  endAge: number;
}

function extractDaeunData(input: ReportInput): { direction: string; startAge: number; decades: DaeunEntry[] } | null {
  const saju = input.saju as Record<string, unknown>;
  const fortune = (saju['fortune'] ?? saju['daeun']) as Record<string, unknown> | undefined;
  if (!fortune) return null;

  const start = fortune['start'] as Record<string, unknown> | undefined;
  const decades = fortune['decades'] as Array<Record<string, unknown>> | undefined;

  if (!decades || decades.length === 0) return null;

  const direction = (start?.['direction'] as string) ?? 'forward';
  const startAge = (start?.['age'] as number) ?? 3;

  const entries: DaeunEntry[] = decades.map(d => {
    const pillar = d['pillar'] as Record<string, Record<string, string>> | undefined;
    const stem = pillar?.['stem'] ?? {};
    const branch = pillar?.['branch'] ?? {};
    return {
      stemHangul: stem['hangul'] ?? '?',
      branchHangul: branch['hangul'] ?? '?',
      stemElement: stem['element'] ?? '',
      branchElement: branch['element'] ?? '',
      startAge: (d['startAgeYears'] as number) ?? 0,
      endAge: (d['endAgeYears'] as number) ?? 0,
    };
  });

  return { direction, startAge, decades: entries };
}

/**
 * 한신(閑神) 오행 추론: 용신/희신/기신/구신에 해당하지 않는 나머지 오행.
 * 5행 중 4개가 지정되면 남은 1개가 한신. 불완전할 경우 null.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
//  대운 개별 해석 문장 생성
// ─────────────────────────────────────────────────────────────────────────────

function buildDecadeNarrative(
  rng: SeededRandom,
  d: DaeunEntry,
  index: number,
  grade: YongshinMatchGrade,
  birthYear: number,
): string {
  const ganzi = `${d.stemHangul}${d.branchHangul}`;
  const mainEl = d.stemElement as ElementCode;
  const startYear = birthYear + d.startAge;
  const endYear = birthYear + d.endAge;

  const sailingImage = ELEMENT_SAILING_IMAGE[mainEl] ?? '새로운 바람';
  const gradeDesc = rng.pick(GRADE_SAILING_TEMPLATES[grade]);
  const advice = rng.pick(GRADE_ADVICE_TEMPLATES[grade]);

  const orderNames = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째', '일곱 번째', '여덟 번째'];
  const orderName = orderNames[index] ?? `${index + 1}번째`;

  const headerVariants: readonly string[] = [
    `${orderName} 항로 — ${ganzi}(${elShort(mainEl)}${elHanja(mainEl)}) 대운 [${d.startAge}~${d.endAge}세, ${startYear}~${endYear}년]`,
    `[${d.startAge}~${d.endAge}세] ${ganzi} 대운 (${elFull(mainEl)}) — ${orderName} 항해 구간`,
    `${orderName} 바다 — ${d.startAge}~${d.endAge}세(${startYear}~${endYear}): ${ganzi}(${elShort(mainEl)})`,
  ];

  const header = rng.pick(headerVariants);

  return joinSentences(
    header + '.',
    `이 시기의 바다에는 ${sailingImage}이(가) 감돌아요.`,
    `용신 부합도는 ${YONGSHIN_GRADE_STARS[grade]}(${YONGSHIN_GRADE_DESC[grade]})이에요.`,
    gradeDesc,
    advice,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateFortuneSection(input: ReportInput): ReportSection | null {
  const daeunData = extractDaeunData(input);
  if (!daeunData || daeunData.decades.length === 0) return null;

  const rng = createRng(input);
  for (let i = 0; i < 28; i++) rng.next();

  const name = safeName(input);

  // 용신 체계 추출
  const yongEl = input.saju.yongshin?.element as ElementCode | null ?? null;
  const heeEl = (input.saju.yongshin?.heeshin
    ?? (yongEl ? ELEMENT_GENERATED_BY[yongEl] : null)) as ElementCode | null;
  const giEl = input.saju.yongshin?.gishin as ElementCode | null ?? null;
  const guEl = (input.saju.yongshin as unknown as Record<string, unknown> | undefined)?.['gushin'] as ElementCode | null ?? null;
  const hanEl = deriveHansin(yongEl, heeEl, giEl, guEl);

  const paragraphs: ReportParagraph[] = [];

  // ── 7-1. 도입부 ──────────────────────────────────────────────────────────

  paragraphs.push(narrative(
    pickAndFill(rng, INTRO_TEMPLATES, { 이름: name }),
  ));

  // ── 대운 방향 & 시작 나이 ────────────────────────────────────────────────

  const isForward = daeunData.direction === 'forward';
  const directionKo = isForward ? '순행(順行)' : '역행(逆行)';
  const dirTemplates = isForward ? DIRECTION_FORWARD_TEMPLATES : DIRECTION_REVERSE_TEMPLATES;

  paragraphs.push(narrative(
    pickAndFill(rng, dirTemplates, {
      이름: name,
      시작나이: String(daeunData.startAge),
    }),
  ));

  // 용신 정보 안내
  if (yongEl) {
    const yongGuide = rng.pick([
      `참고로 ${name}님의 용신은 ${elFull(yongEl)}이에요. 대운의 오행이 용신에 가까울수록 순풍이 강해지고, 멀어질수록 파도가 거세지는 셈이에요.`,
      `${name}님에게 가장 필요한 바람, 즉 용신은 ${elFull(yongEl)}이에요. 이 오행의 기운이 대운에 실릴 때 항해가 가장 순조로워진답니다.`,
      `용신 ${elFull(yongEl)}은(는) ${name}님의 항해에서 나침반의 북극성과도 같아요. 대운이 이 방향을 가리킬 때가 최고의 순풍이 되는 거랍니다.`,
    ]);
    paragraphs.push(tip(yongGuide, yongEl));
  }

  // ── 7-2. 대운별 상세 분석 ────────────────────────────────────────────────

  const count = Math.min(daeunData.decades.length, input.options?.daeunCount ?? 8);
  const birthYear = input.birthInfo?.year ?? 2000;

  const timelineData: Record<string, number | string> = {};
  const tableRows: string[][] = [];

  // 등급별 통계
  let bestGrade = 0;
  let worstGrade = 6;
  let bestIdx = 0;
  let worstIdx = 0;

  for (let i = 0; i < count; i++) {
    const d = daeunData.decades[i];
    const mainEl = d.stemElement as ElementCode;
    const grade = yongEl
      ? getYongshinMatchGrade(mainEl, yongEl, heeEl, hanEl, guEl, giEl)
      : (3 as YongshinMatchGrade);
    const stars = YONGSHIN_GRADE_STARS[grade];

    // 최고/최악 대운 추적
    if (grade > bestGrade) { bestGrade = grade; bestIdx = i; }
    if (grade < worstGrade) { worstGrade = grade; worstIdx = i; }

    // 대운별 서술 문단
    const decadeText = buildDecadeNarrative(rng, d, i, grade, birthYear);
    const tone: 'positive' | 'negative' | 'neutral' =
      grade >= 4 ? 'positive' : grade <= 2 ? 'negative' : 'neutral';

    if (tone === 'positive') {
      paragraphs.push(positive(decadeText, mainEl));
    } else if (tone === 'negative') {
      paragraphs.push(caution(decadeText, mainEl));
    } else {
      paragraphs.push(narrative(decadeText, mainEl));
    }

    // 타임라인 데이터
    const ganzi = `${d.stemHangul}${d.branchHangul}`;
    timelineData[`${d.startAge}세 ${ganzi}`] = grade;

    // 테이블 행
    const startYear = birthYear + d.startAge;
    const endYear = birthYear + d.endAge;
    tableRows.push([
      String(i + 1),
      `${d.startAge}~${d.endAge}세`,
      `${startYear}~${endYear}년`,
      ganzi,
      `${elShort(d.stemElement)}(${elHanja(d.stemElement)}) / ${elShort(d.branchElement)}(${elHanja(d.branchElement)})`,
      stars,
    ]);
  }

  // ── 최고/최악 대운 요약 ──────────────────────────────────────────────────

  if (count >= 2) {
    const bestD = daeunData.decades[bestIdx];
    const worstD = daeunData.decades[worstIdx];
    const bestGanzi = `${bestD.stemHangul}${bestD.branchHangul}`;
    const worstGanzi = `${worstD.stemHangul}${worstD.branchHangul}`;

    const summaryVariants: readonly string[] = [
      `전체 항해를 조망해보면, ${bestD.startAge}~${bestD.endAge}세의 ${bestGanzi} 대운이 가장 순풍이 강한 구간이에요. 반면 ${worstD.startAge}~${worstD.endAge}세의 ${worstGanzi} 대운은 파도가 다소 거세질 수 있으니 미리 대비해두면 좋겠어요.`,
      `항해 지도를 펼쳐 보면, ${bestGanzi} 대운(${bestD.startAge}~${bestD.endAge}세)이 황금 항로이고, ${worstGanzi} 대운(${worstD.startAge}~${worstD.endAge}세)은 조심스럽게 건너야 할 해역이에요.`,
      `${bestGanzi} 대운(${bestD.startAge}~${bestD.endAge}세)에 가장 밝은 등대가 빛나고, ${worstGanzi} 대운(${worstD.startAge}~${worstD.endAge}세)에는 안개가 짙어질 수 있어요. 미리 아는 것만으로도 큰 힘이 된답니다.`,
    ];
    paragraphs.push(emphasis(rng.pick(summaryVariants)));
  }

  // ── 마무리 ────────────────────────────────────────────────────────────────

  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name }),
  ));

  // ── 테이블 ────────────────────────────────────────────────────────────────

  const table: ReportTable = {
    title: '대운 항해 일지',
    headers: ['순서', '나이 구간', '서기 구간', '간지', '천간/지지 오행', '용신부합도'],
    rows: tableRows,
  };

  // ── 타임라인 차트 ─────────────────────────────────────────────────────────

  const chart: ReportChart = {
    type: 'timeline',
    title: '대운 용신부합도 타임라인',
    data: timelineData,
    meta: {
      description: '각 대운의 용신 부합도를 시간 축 위에 표시합니다. 5=순풍만범, 1=폭풍우.',
      gradeLabels: {
        5: '순풍만범',
        4: '좋은 바람',
        3: '평온한 바다',
        2: '암초 주의',
        1: '폭풍우',
      },
    },
  };

  // ── 하이라이트 ────────────────────────────────────────────────────────────

  const highlights: ReportHighlight[] = [
    {
      label: '대운 방향',
      value: directionKo,
      sentiment: 'neutral',
    },
    {
      label: '시작 나이',
      value: `${daeunData.startAge}세`,
      sentiment: 'neutral',
    },
    {
      label: '대운 수',
      value: `${daeunData.decades.length}개`,
      sentiment: 'neutral',
    },
  ];

  if (count >= 1) {
    const bestD = daeunData.decades[bestIdx];
    highlights.push({
      label: '최고 순풍 대운',
      value: `${bestD.stemHangul}${bestD.branchHangul}(${bestD.startAge}~${bestD.endAge}세)`,
      element: bestD.stemElement as ElementCode,
      sentiment: 'good',
    });
  }

  // ── 반환 ──────────────────────────────────────────────────────────────────

  return {
    id: 'daeun',
    title: '대운(大運) 분석',
    subtitle: '인생이라는 대양에서 10년마다 바뀌는 조류 — 항해 일지',
    paragraphs,
    tables: [table],
    charts: [chart],
    highlights,
  };
}
