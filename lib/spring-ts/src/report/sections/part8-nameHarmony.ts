/**
 * part8-nameHarmony.ts -- 이름-사주 조화 평가 섹션 (음악가/지휘자 페르소나)
 *
 * PART 8-3: 성명학 이름의 자원오행/수리오행과 사주 용신의 교차 평가를 수행합니다.
 * 종합 적합도 점수를 100점 만점으로 산출하고, 게이지 차트로 시각화합니다.
 *
 * 창의적 지침:
 * - 이름과 사주의 조화를 음악적 하모니로 비유
 * - 지휘자가 오케스트라를 이끌듯 따뜻하고 자신감 있는 톤
 * - 불협화음도 재즈에서는 아름다운 긴장이라는 관점으로 재해석
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
  ELEMENT_HANJA,
  ELEMENT_GENERATES,
  ELEMENT_GENERATED_BY,
  getElementRelation,
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
  SeededRandom,
} from '../common/sentenceUtils.js';

import {
  NAMING_PRINCIPLES_ENCYCLOPEDIA,
  type NamingPrincipleKey,
} from '../knowledge/namingPrinciplesEncyclopedia.js';

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

const PRACTICAL_HARMONY_CHECKLIST_KEYS: readonly NamingPrincipleKey[] = [
  'JAWON_OHAENG',
  'PRONUNCIATION_HARMONY',
  'PRACTICAL_USABILITY',
];

function buildPracticalChecklistRows(): string[][] {
  const entryByKey = new Map(
    NAMING_PRINCIPLES_ENCYCLOPEDIA.map((entry) => [entry.key, entry] as const),
  );

  return PRACTICAL_HARMONY_CHECKLIST_KEYS.map((key, index) => {
    const entry = entryByKey.get(key);
    return [
      entry?.title ?? `\uccb4\ud06c ${index + 1}`,
      entry?.checklist[0] ?? '\ud575\uc2ec \uccb4\ud06c\ub9ac\uc2a4\ud2b8\ub97c \ud655\uc778\ud574 \uc8fc\uc138\uc694.',
    ];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  음악 비유 문장 풀 (다양성 보장)
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '이름은 사주라는 교향곡에 더해지는 멜로디예요. 조화로운 화음이 울릴 때, 인생의 음악은 더 아름다워지죠. 지금부터 {{이름}}님의 이름과 사주가 어떤 하모니를 이루는지 분석해 볼게요!',
  '모든 사주에는 고유한 리듬이 있고, 이름은 그 리듬 위에 얹히는 선율이에요. {{이름}}님의 이름이 사주 위에서 어떤 음색을 내는지 들어볼까요?',
  '오케스트라에서 각 악기가 제 역할을 할 때 아름다운 교향곡이 완성되듯, 이름의 오행이 사주의 용신과 어우러지면 인생이라는 무대가 빛나요. {{이름}}님의 하모니를 살펴볼게요.',
  '지휘자가 오케스트라의 소리를 하나로 모으듯, 이름은 사주의 다양한 기운을 하나의 멜로디로 엮어주는 역할을 해요. {{이름}}님의 이름이 만드는 화성을 분석해 드릴게요!',
  '음악에서 도레미파솔라시가 조화를 이루듯, 이름의 오행과 사주의 용신이 아름다운 화음을 만들 수 있어요. {{이름}}님의 이름-사주 앙상블을 지금 들어볼게요.',
];

const COMPAT_HIGH_TEMPLATES: readonly string[] = [
  '완벽한 화성(和聲)이에요! {{이름}}님의 이름은 사주라는 교향곡 위에 아름다운 멜로디를 그려내고 있어요. 모든 악기가 하나로 어우러진 듯한 조화로운 울림이 느껴지죠.',
  '이 이름의 멜로디는 사주와 완벽한 듀엣을 이루고 있어요! 용신의 기운이 이름 곳곳에 스며들어 마치 피아노와 바이올린이 함께 노래하는 것과도 같답니다.',
  '{{이름}}님의 이름과 사주가 만드는 하모니는 마치 명곡의 클라이맥스 같아요. 용신 오행이 이름의 선율 속에 자연스럽게 녹아들어 풍성한 화음을 만들어내고 있죠!',
  '오케스트라의 모든 파트가 하나의 화음으로 수렴하듯, 이름과 사주가 빚어내는 하모니가 정말 훌륭해요. 인생의 교향곡이 더없이 아름답게 울려 퍼질 거예요!',
  '이름이라는 솔로 악기가 사주 오케스트라 위에서 멋진 협주곡을 연주하고 있어요. 용신과의 화성이 맞물려 듣는 이의 마음까지 울리는 선율이 완성되었답니다.',
];

const COMPAT_MID_TEMPLATES: readonly string[] = [
  '사주와 이름이 개성 있는 즉흥 연주를 펼치고 있어요. 완전한 유니즌은 아니지만, 재즈의 매력이 그렇듯 예측 못 한 하모니에서 새로운 아름다움이 피어나는 법이거든요!',
  '이 이름의 멜로디는 사주 위에서 독특한 리듬감을 만들어내고 있어요. 일부 음은 용신과 잘 어울리고, 나머지는 자신만의 색깔을 더해주고 있답니다.',
  '오케스트라의 모든 악기가 같은 음을 낼 필요는 없어요. {{이름}}님의 이름은 사주와 부분적인 화음을 이루면서도, 자기만의 멜로디 라인을 가지고 있는 거예요.',
  '완벽한 화성은 아니지만, 보사노바처럼 느슨한 조화 속에서도 충분히 매력적인 음악이 만들어지는 법이에요. 이름과 사주의 관계가 바로 그런 느낌이랍니다.',
];

const COMPAT_LOW_TEMPLATES: readonly string[] = [
  '사주와 이름 사이에 살짝 불협화음이 느껴지지만, 걱정하지 마세요. 재즈에서는 불협화음이 가장 아름다운 긴장과 해소를 만들어내거든요! 다른 악기로 보완 가능한 선율이에요.',
  '이름의 멜로디가 사주의 조성과 살짝 다른 키(key)를 연주하고 있어요. 하지만 음악에서 전조(轉調)는 새로운 감동을 만드는 기법이잖아요? 생활 속 보완으로 충분히 조율할 수 있어요.',
  '모든 교향곡에 긴장의 순간이 있듯, 이름과 사주 사이의 엇갈림은 오히려 인생 음악에 깊이를 더해줄 수 있어요. 용신 보완법이라는 "추가 악기"를 활용하면 아름다운 화음이 가능해요!',
  '이름이 사주와 다른 리듬을 타고 있지만, 폴리리듬이 현대 음악의 매력이듯 이 차이도 새로운 가능성이에요. 조금만 조율하면 멋진 앙상블이 될 수 있답니다.',
];

const YONGSHIN_MATCH_TEMPLATES: readonly string[] = [
  '이름 속 {{오행}}의 선율이 용신({{용신}})과 하나의 화음을 이루고 있어요! 마치 주선율과 반주가 완벽하게 맞물린 것과도 같죠.',
  '용신 {{용신}}의 기운이 이름의 {{오행}} 오행과 만나 아름다운 유니즌을 연주하고 있어요. 오케스트라의 주제가 울려 퍼지는 순간이랍니다!',
  '이름의 {{오행}} 파트가 용신 {{용신}}과 완벽한 화음을 만들어내고 있어요. 이 듀엣이 인생 전체에 좋은 에너지를 불어넣어 줄 거예요.',
];

const GISHIN_WARN_TEMPLATES: readonly string[] = [
  '이름에 기신({{기신}})의 음이 섞여 있지만, 오케스트라에서 단조의 음이 곡에 깊이를 더하듯, 이것도 인생 음악의 한 부분이에요. 용신으로 화성을 보강하면 돼요.',
  '기신 {{기신}}의 음이 이름 선율에 살짝 끼어 있어요. 하지만 뛰어난 지휘자는 어떤 불협화음도 아름답게 해소할 수 있는 법이거든요!',
  '이름에서 기신({{기신}})의 리듬이 감지되지만 크게 걱정할 필요는 없어요. 음악에서 긴장과 해소가 반복되어야 감동이 깊어지는 것처럼, 보완의 여지가 충분해요.',
];

const CLOSING_TEMPLATES: readonly string[] = [
  '이름은 인생 교향곡의 한 악장일 뿐이에요. 용신에 맞는 색상, 방위, 음식이라는 "추가 악기"들로 언제든 더 풍성한 하모니를 만들 수 있답니다!',
  '좋은 이름과 좋은 사주가 만나면 명곡이 탄생하지만, 어느 한 파트만으로 음악이 완성되지는 않아요. 지휘자처럼 전체의 균형을 바라보는 것이 중요하죠.',
  '사주와 이름의 하모니 분석은 인생 음악의 악보를 읽는 것과 같아요. 이 악보를 참고하여 용신 보완이라는 연주를 더하면 인생의 교향곡이 더욱 풍요로워질 거예요!',
  '지휘자가 각 악기의 소리를 조율하듯, 이름과 사주의 관계도 생활 속에서 조율해 나갈 수 있어요. 이 분석이 아름다운 인생 연주를 위한 좋은 악보가 되길 바라요.',
  '이름-사주 하모니는 끝나지 않는 교향곡이에요. 매일의 선택이 새로운 음표가 되어 더 아름다운 멜로디를 만들어 갈 수 있답니다.',
];

/** 오행을 악기로 매핑하는 음악적 비유 */
const ELEMENT_INSTRUMENT: Record<string, string> = {
  WOOD: '바이올린',
  FIRE: '트럼펫',
  EARTH: '첼로',
  METAL: '피아노',
  WATER: '플루트',
};

/** 오행을 음악 장르로 매핑하는 비유 */
const ELEMENT_GENRE: Record<string, string> = {
  WOOD: '봄의 왈츠',
  FIRE: '정열의 플라멩코',
  EARTH: '묵직한 교향곡',
  METAL: '맑은 피아노 소나타',
  WATER: '잔잔한 녹턴',
};

// ─────────────────────────────────────────────────────────────────────────────
//  조화도 진단 함수
// ─────────────────────────────────────────────────────────────────────────────

type HarmonyLevel = 'high' | 'mid' | 'low';

function classifyHarmony(score: number): HarmonyLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function harmonyLevelKorean(level: HarmonyLevel): string {
  if (level === 'high') return '높음';
  if (level === 'mid') return '보통';
  return '아쉬움';
}

function harmonyMusicalLabel(level: HarmonyLevel): string {
  if (level === 'high') return '완벽한 화성';
  if (level === 'mid') return '개성 있는 즉흥 연주';
  return '다른 악기로 보완 가능한 선율';
}

// ─────────────────────────────────────────────────────────────────────────────
//  교차 평가 로직
// ─────────────────────────────────────────────────────────────────────────────

interface CrossEvalResult {
  /** 자원오행 vs 용신 부합 결과 배열 (글자별) */
  charEvals: Array<{ char: string; element: string; match: 'yongshin' | 'heeshin' | 'gishin' | 'neutral' }>;
  /** 수리오행 vs 용신 부합 비율 (0~1) */
  suriMatchRatio: number;
  /** 수리오행 용신/희신 포함 개수 */
  suriYongshinCount: number;
  /** 4격 수리오행 총 개수 */
  suriTotal: number;
  /** 종합 적합도 점수 (0~100) */
  totalScore: number;
  /** 용신 일치 글자 수 */
  yongshinMatchCount: number;
  /** 기신 일치 글자 수 */
  gishinMatchCount: number;
}

function evaluateCrossCompatibility(
  yongshinEl: string,
  heeshinEl: string | null,
  gishinEl: string | null,
  nameElements: string[],
  affinityScore: number,
  suriElements: string[],
): CrossEvalResult {
  // 1. 자원오행 vs 용신 부합도 (글자별)
  const charEvals = nameElements.map((el, idx) => {
    let match: 'yongshin' | 'heeshin' | 'gishin' | 'neutral' = 'neutral';
    if (el === yongshinEl) match = 'yongshin';
    else if (heeshinEl && el === heeshinEl) match = 'heeshin';
    else if (gishinEl && el === gishinEl) match = 'gishin';

    return {
      char: `${idx + 1}번째 글자`,
      element: el,
      match,
    };
  });

  const yongshinMatchCount = charEvals.filter(e => e.match === 'yongshin').length;
  const heeshinMatchCount = charEvals.filter(e => e.match === 'heeshin').length;
  const gishinMatchCount = charEvals.filter(e => e.match === 'gishin').length;

  // 2. 수리오행 vs 용신 부합도
  let suriYongshinCount = 0;
  for (const se of suriElements) {
    if (se === yongshinEl || (heeshinEl && se === heeshinEl)) {
      suriYongshinCount++;
    }
  }
  const suriTotal = suriElements.length || 1;
  const suriMatchRatio = suriYongshinCount / suriTotal;

  // 3. 종합 적합도 점수 — affinityScore를 기반으로 보정
  // affinityScore가 이미 종합 점수이므로 이를 활용하되, 교차 평가 결과로 미세 보정
  let totalScore = affinityScore;

  // 용신 일치 보너스 (이미 affinityScore에 포함되어 있을 수 있으므로 소폭 보정)
  if (yongshinMatchCount > 0 && totalScore < 95) {
    totalScore = Math.min(100, totalScore + yongshinMatchCount * 2);
  }
  // 기신 일치 감점 (소폭 보정)
  if (gishinMatchCount > 0 && totalScore > 5) {
    totalScore = Math.max(0, totalScore - gishinMatchCount * 2);
  }

  totalScore = Math.round(Math.max(0, Math.min(100, totalScore)));

  return {
    charEvals,
    suriMatchRatio,
    suriYongshinCount,
    suriTotal,
    totalScore,
    yongshinMatchCount: yongshinMatchCount + heeshinMatchCount,
    gishinMatchCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  음악적 서술 생성 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function describeElementAsInstrument(el: string): string {
  const instrument = ELEMENT_INSTRUMENT[el] ?? '악기';
  const elName = elShort(el);
  return `${elName}(${instrument})`;
}

function describeElementAsGenre(el: string): string {
  return ELEMENT_GENRE[el] ?? '아름다운 선율';
}

function buildCharEvalDetail(
  rng: SeededRandom,
  charEvals: CrossEvalResult['charEvals'],
  yongshinEl: string,
  gishinEl: string | null,
): string {
  if (charEvals.length === 0) return '';

  const parts: string[] = [];
  for (const ce of charEvals) {
    const instrument = describeElementAsInstrument(ce.element);
    if (ce.match === 'yongshin') {
      parts.push(`${ce.char}의 ${instrument} 선율이 용신(${elShort(yongshinEl)})과 완벽한 화음을 이루고 있어요 ✅`);
    } else if (ce.match === 'heeshin') {
      parts.push(`${ce.char}의 ${instrument} 선율이 희신과 조화롭게 어우러지고 있어요 ✅`);
    } else if (ce.match === 'gishin') {
      parts.push(`${ce.char}의 ${instrument} 선율이 기신(${elShort(gishinEl)})과 긴장감을 만들고 있어요 ⚠️`);
    } else {
      parts.push(`${ce.char}의 ${instrument} 선율은 중립적인 반주 역할을 하고 있어요`);
    }
  }
  return parts.join(' ');
}

function buildSuriMatchNarrative(
  rng: SeededRandom,
  suriYongshinCount: number,
  suriTotal: number,
): string {
  const ratio = suriTotal > 0 ? suriYongshinCount / suriTotal : 0;

  if (ratio >= 0.75) {
    return `수리오행 분석에서도 4격 중 ${suriYongshinCount}격이 용신/희신과 같은 조(key)를 연주하고 있어요. 오케스트라 전체가 하나의 화음으로 수렴하는 멋진 장면이에요!`;
  } else if (ratio >= 0.5) {
    return `수리오행에서 ${suriTotal}격 중 ${suriYongshinCount}격이 용신/희신 오행과 어울리는 화음을 내고 있어요. 절반 이상이 조화로운 박자를 맞추고 있는 거죠.`;
  } else if (ratio > 0) {
    return `수리오행에서는 ${suriTotal}격 중 ${suriYongshinCount}격만 용신/희신과 화음이 맞아요. 나머지 파트는 자유로운 즉흥 연주를 펼치고 있는 셈이에요.`;
  }
  return `수리오행에서 용신/희신과 직접적인 화음을 이루는 격은 없지만, 다양한 악기의 음색이 모여 풍성한 사운드를 만들기도 하는 법이에요.`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  수리오행 추출 (NamingReport의 fourFrame에서)
// ─────────────────────────────────────────────────────────────────────────────

function extractSuriElements(input: ReportInput): string[] {
  const naming = input.naming;
  if (!naming) return [];

  const analysis = naming.analysis as Record<string, unknown> | undefined;
  const fourFrame = analysis?.['fourFrame'] as Record<string, unknown> | undefined;
  const frames = fourFrame?.['frames'] as Array<Record<string, unknown>> | undefined;

  if (!frames) return [];
  return frames.map(f => (f['element'] as string) ?? '').filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateNameHarmonySection(input: ReportInput): ReportSection | null {
  const spring = input.spring;
  const naming = input.naming;
  if (!spring && !naming) return null;

  const rng = createRng(input);
  for (let i = 0; i < 30; i++) rng.next();

  const name = safeName(input);
  const paragraphs: ReportParagraph[] = [];

  // ── 데이터 추출 ───────────────────────────────────────────────────────────

  // SajuCompatibility 데이터 (SpringReport에서)
  const compat = (spring as Record<string, unknown> | undefined)?.['sajuCompatibility'] as
    Record<string, unknown> | undefined;

  const affinityScore = (compat?.['affinityScore'] as number) ?? (spring?.finalScore ?? 0);
  const yongshinEl = (compat?.['yongshinElement'] as string) ?? input.saju.yongshin?.element ?? '';
  const heeshinEl = (compat?.['heeshinElement'] as string) ??
    input.saju.yongshin?.heeshin ?? null;
  const gishinEl = (compat?.['gishinElement'] as string) ??
    input.saju.yongshin?.gishin ?? null;
  const nameElements = (compat?.['nameElements'] as string[]) ?? [];
  const yongMatchFromSpring = (compat?.['yongshinMatchCount'] as number) ?? 0;
  const giMatchFromSpring = (compat?.['gishinMatchCount'] as number) ?? 0;

  // 수리오행 추출
  const suriElements = extractSuriElements(input);

  // ── 교차 평가 ─────────────────────────────────────────────────────────────

  const crossEval = evaluateCrossCompatibility(
    yongshinEl,
    heeshinEl,
    gishinEl,
    nameElements,
    affinityScore,
    suriElements,
  );

  // Spring에서 직접 제공된 값이 있으면 그것을 우선 사용
  const finalYongMatch = yongMatchFromSpring > 0 ? yongMatchFromSpring : crossEval.yongshinMatchCount;
  const finalGiMatch = giMatchFromSpring > 0 ? giMatchFromSpring : crossEval.gishinMatchCount;
  const finalScore = crossEval.totalScore;

  const harmonyLevel = classifyHarmony(finalScore);

  // ── 도입부: 음악적 비유 ────────────────────────────────────────────────────

  paragraphs.push(narrative(
    pickAndFill(rng, INTRO_TEMPLATES, { 이름: name }),
  ));

  // ── 조화도 진단 ────────────────────────────────────────────────────────────

  if (harmonyLevel === 'high') {
    paragraphs.push(positive(
      pickAndFill(rng, COMPAT_HIGH_TEMPLATES, { 이름: name }),
      yongshinEl as ElementCode,
    ));
  } else if (harmonyLevel === 'mid') {
    paragraphs.push(narrative(
      pickAndFill(rng, COMPAT_MID_TEMPLATES, { 이름: name }),
    ));
  } else {
    paragraphs.push(encouraging(
      pickAndFill(rng, COMPAT_LOW_TEMPLATES, { 이름: name }),
    ));
  }

  // ── 용신 오행 상세 ──────────────────────────────────────────────────────────

  if (yongshinEl) {
    const yongInstrument = ELEMENT_INSTRUMENT[yongshinEl] ?? '악기';
    const yongGenre = describeElementAsGenre(yongshinEl);

    paragraphs.push(narrative(
      `${name}님의 사주에서 가장 필요한 기운, 즉 용신은 ${elFull(yongshinEl)}이에요. ` +
      `이 오행은 마치 ${yongInstrument}의 음색처럼 ${yongGenre}을 연주하는 기운이죠. ` +
      `이름의 오행이 이 멜로디와 어울릴수록 인생의 교향곡은 더 아름다워진답니다.`,
      yongshinEl as ElementCode,
    ));

    // 이름 오행 목록
    if (nameElements.length > 0) {
      const elDesc = nameElements.map(e => describeElementAsInstrument(e)).join(', ');
      paragraphs.push(narrative(
        `이름을 구성하는 오행 악기는 ${elDesc}이에요. ` +
        `이 악기들이 용신(${elShort(yongshinEl)})이라는 지휘자의 지시와 얼마나 잘 맞는지 살펴볼게요.`,
      ));
    }
  }

  // ── 자원오행 vs 용신 부합도 (글자별) ──────────────────────────────────────

  if (crossEval.charEvals.length > 0 && yongshinEl) {
    const detail = buildCharEvalDetail(rng, crossEval.charEvals, yongshinEl, gishinEl);
    paragraphs.push(narrative(detail));
  }

  // ── 용신 일치 / 기신 경고 ─────────────────────────────────────────────────

  if (finalYongMatch > 0 && yongshinEl) {
    paragraphs.push(positive(
      pickAndFill(rng, YONGSHIN_MATCH_TEMPLATES, {
        오행: nameElements.filter(e => e === yongshinEl || e === heeshinEl).map(e => elShort(e)).join('/') || elShort(yongshinEl),
        용신: elShort(yongshinEl),
      }),
      yongshinEl as ElementCode,
    ));
  }

  if (finalGiMatch > 0 && gishinEl) {
    paragraphs.push(encouraging(
      pickAndFill(rng, GISHIN_WARN_TEMPLATES, { 기신: elShort(gishinEl) }),
    ));
  }

  // ── 수리오행 vs 용신 부합도 ───────────────────────────────────────────────

  if (suriElements.length > 0) {
    paragraphs.push(narrative(
      buildSuriMatchNarrative(rng, crossEval.suriYongshinCount, crossEval.suriTotal),
    ));
  }

  // ── 종합 점수 강조 ──────────────────────────────────────────────────────────

  const musicalLabel = harmonyMusicalLabel(harmonyLevel);
  paragraphs.push(emphasis(
    `이름-사주 종합 조화도: ${finalScore}점 / 100점 — "${musicalLabel}" ` +
    (harmonyLevel === 'high'
      ? '🎵 모든 파트가 완벽하게 어우러진 명연주예요!'
      : harmonyLevel === 'mid'
        ? '🎶 자유로운 선율 속에서도 충분한 매력이 느껴져요.'
        : '🎼 새로운 악기를 더해 더 풍성한 연주를 만들어 갈 수 있어요.'),
  ));

  // ── 마무리 ───────────────────────────────────────────────────────────────

  paragraphs.push(tip(
    '\uc2e4\uc804\uc5d0\uc11c\ub294 \uc544\ub798 \uccb4\ud06c\ub9ac\uc2a4\ud2b8 3\uac00\uc9c0\ub9cc \uc810\uac80\ud574\ub3c4 \uc774\ub984-\uc0ac\uc8fc \uc870\ud654\ub97c \uc548\uc815\uc801\uc73c\ub85c \ud655\uc778\ud560 \uc218 \uc788\uc5b4\uc694.',
  ));
  paragraphs.push(encouraging(pickAndFill(rng, CLOSING_TEMPLATES)));

  // ── 테이블: 교차 평가 ──────────────────────────────────────────────────────

  const tables: ReportTable[] = [];

  // 자원오행 교차 평가 테이블
  if (crossEval.charEvals.length > 0) {
    tables.push({
      title: '자원오행 vs 용신 교차 평가',
      headers: ['글자', '자원오행', '용신 부합', '판정'],
      rows: crossEval.charEvals.map(ce => {
        const matchLabel =
          ce.match === 'yongshin' ? '용신 일치 ✅'
            : ce.match === 'heeshin' ? '희신 일치 ✅'
              : ce.match === 'gishin' ? '기신 일치 ⚠️'
                : '중립';
        const sentiment =
          ce.match === 'yongshin' ? '최상'
            : ce.match === 'heeshin' ? '좋음'
              : ce.match === 'gishin' ? '주의'
                : '보통';
        return [ce.char, elFull(ce.element), matchLabel, sentiment];
      }),
    });
  }

  // 종합 교차 평가 요약 테이블
  tables.push({
    title: '이름-사주 조화 종합 평가',
    headers: ['평가 항목', '결과', '판정'],
    rows: [
      [
        '자원오행 용신 부합',
        `용신/희신 일치 ${finalYongMatch}개`,
        finalYongMatch > 0 ? '좋음 ✅' : '보완 필요',
      ],
      [
        '자원오행 기신 일치',
        `기신 일치 ${finalGiMatch}개`,
        finalGiMatch === 0 ? '좋음 ✅' : '주의 ⚠️',
      ],
      [
        '수리오행 용신 부합',
        suriElements.length > 0
          ? `${crossEval.suriTotal}격 중 ${crossEval.suriYongshinCount}격 일치`
          : '수리 데이터 없음',
        crossEval.suriYongshinCount > 0 ? '좋음 ✅' : '보완 필요',
      ],
      [
        '종합 조화도',
        `${finalScore}/100점`,
        harmonyLevel === 'high' ? '우수 ✅'
          : harmonyLevel === 'mid' ? '보통'
            : '보완 필요 ⚠️',
      ],
    ],
  });

  // ── 게이지 차트 ────────────────────────────────────────────────────────────

  tables.push({
    title: '\uc2e4\uc804 \uccb4\ud06c\ub9ac\uc2a4\ud2b8 (\uac04\ub2e8\ud310)',
    headers: ['\uc810\uac80 \uc601\uc5ed', '\ud55c \uc904 \ud655\uc778'],
    rows: buildPracticalChecklistRows(),
  });

  const gaugeChart: ReportChart = {
    type: 'gauge',
    title: '이름-사주 조화도',
    data: {
      '조화도': finalScore,
    },
    meta: {
      min: 0,
      max: 100,
      thresholds: { low: 40, mid: 70, high: 100 },
      labels: { low: '아쉬움', mid: '보통', high: '높음' },
      musicalLabels: {
        low: '다른 악기로 보완 가능한 선율',
        mid: '개성 있는 즉흥 연주',
        high: '완벽한 화성',
      },
    },
  };

  // ── 하이라이트 ─────────────────────────────────────────────────────────────

  const highlights: ReportHighlight[] = [
    {
      label: '조화도',
      value: `${finalScore}/100 (${harmonyLevelKorean(harmonyLevel)})`,
      element: yongshinEl as ElementCode || undefined,
      sentiment: harmonyLevel === 'high' ? 'good'
        : harmonyLevel === 'mid' ? 'neutral'
          : 'caution',
    },
    {
      label: '용신 일치',
      value: `${finalYongMatch}글자`,
      element: yongshinEl as ElementCode || undefined,
      sentiment: finalYongMatch > 0 ? 'good' : 'neutral',
    },
  ];

  if (finalGiMatch > 0) {
    highlights.push({
      label: '기신 일치',
      value: `${finalGiMatch}글자`,
      element: gishinEl as ElementCode || undefined,
      sentiment: 'caution',
    });
  }

  if (suriElements.length > 0) {
    highlights.push({
      label: '수리오행 용신 부합',
      value: `${crossEval.suriYongshinCount}/${crossEval.suriTotal}격`,
      sentiment: crossEval.suriYongshinCount > 0 ? 'good' : 'neutral',
    });
  }

  // ── 섹션 반환 ──────────────────────────────────────────────────────────────

  return {
    id: 'nameHarmony',
    title: '이름-사주 조화 분석',
    subtitle: '사주와 이름이 빚어내는 하모니',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    charts: [gaugeChart],
    highlights,
  };
}
