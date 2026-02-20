/**
 * part9-summary.ts -- 종합 스코어보드 섹션
 *
 * PART 9: 사주 핵심 수치 요약, 용신 기반 개운 매핑을 종합합니다.
 *
 * 페르소나: "천문학자/별자리 해설가"
 * 사주의 전체 그림을 우주와 별자리에 비유합니다.
 * 별, 행성, 궤도, 성운, 은하, 빅뱅, 중력, 빛 등의 천문학적 메타포를 활용하여
 * 사주 분석의 최종 종합을 경외감과 경이로움이 느껴지는 웅장한 톤으로 전달합니다.
 *
 * Section ID: 'summary'
 * RNG offset: 34
 * Return: ReportSection (항상 생성, null 반환 없음)
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
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_TASTE,
  ELEMENT_SEASON,
  ELEMENT_TIME,
  ELEMENT_ORGAN,
  classifyStrength,
  STRENGTH_KOREAN,
  elementCodeToKorean,
  lookupStemInfo,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  tip,
  emphasis,
  encouraging,
  joinSentences,
  eunNeun,
  iGa,
  eulReul,
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

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 오행을 천체에 비유하는 매핑 */
const ELEMENT_CELESTIAL: Record<string, string> = {
  WOOD: '목성(Jupiter)처럼 확장하고 성장하는',
  FIRE: '태양처럼 뜨겁게 빛나는',
  EARTH: '지구처럼 만물을 품는',
  METAL: '토성의 고리처럼 정교하게 다듬어진',
  WATER: '해왕성처럼 깊고 신비로운',
};

/** 오행별 별자리 비유 */
const ELEMENT_CONSTELLATION: Record<string, string> = {
  WOOD: '봄의 처녀자리',
  FIRE: '한여름의 사자자리',
  EARTH: '사계절의 중심축',
  METAL: '가을의 천칭자리',
  WATER: '겨울의 물병자리',
};

/** 신강도 분류를 천문학 비유로 표현 */
const STRENGTH_ASTRO: Record<string, string> = {
  EXTREME_STRONG: '초신성처럼 압도적인 에너지가 폭발하는 상태',
  STRONG: '항성처럼 안정되고 힘찬 에너지를 발산하는 상태',
  BALANCED: '쌍성계처럼 인력과 척력이 절묘하게 균형을 이루는 상태',
  WEAK: '성운 속 새 별이 형성되듯 외부 기운의 도움이 필요한 상태',
  EXTREME_WEAK: '암흑 성운 속 갓 태어난 원시별처럼 보호와 양분이 절실한 상태',
};

// ─────────────────────────────────────────────────────────────────────────────
//  도입 템플릿 (천문학 비유, 8개)
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES: readonly string[] = [
  '사주는 탄생 순간의 별자리 지도예요. 지금부터 이 우주적 설계도를 한눈에 볼 수 있는 스코어보드를 펼쳐볼게요!',
  '지금까지 분석한 모든 데이터가 하나의 은하로 수렴하는 순간이에요. {{이름}}님의 사주 우주를 총정리한 별자리 지도를 보여드릴게요.',
  '밤하늘의 별들이 하나의 성좌를 이루듯, 사주의 모든 요소가 하나의 그림으로 모이는 시간이에요. 우주가 {{이름}}님에게 보낸 메시지를 읽어볼게요!',
  '빅뱅의 순간 우주가 모든 원소를 만들어냈듯, 탄생의 순간 사주는 {{이름}}님만의 고유한 에너지 패턴을 새겼어요. 그 패턴의 종합 설계도를 펼쳐봅니다.',
  '천문학자가 수천 개의 관측 데이터를 하나의 별 목록으로 정리하듯, {{이름}}님의 사주 분석 전체를 하나의 스코어보드에 담았어요.',
  '무수한 별들의 배치가 만들어내는 고유한 패턴이 있듯이, {{이름}}님의 사주에도 세상에 단 하나뿐인 우주적 서명이 담겨 있어요. 그 전체 그림을 종합해 볼게요.',
  '광활한 우주에서 각 행성이 제 궤도를 돌며 하나의 태양계를 이루듯, 사주의 모든 요소가 하나의 운명 체계를 구성하고 있어요. 최종 종합을 보여드릴게요!',
  '망원경으로 처음 은하를 본 천문학자의 경이로움처럼, 모든 분석을 하나로 모으면 사주의 진정한 모습이 드러나요. {{이름}}님의 우주적 설계도를 공개합니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  일간 해설 템플릿 (별/행성 비유)
// ─────────────────────────────────────────────────────────────────────────────

const DAYMASTER_ASTRO_TEMPLATES: readonly string[] = [
  '{{이름}}님의 일간 {{일간}}은 사주 우주의 중심별이에요. {{오행설명}} 기운이 이 우주의 핵심 에너지원인 거예요.',
  '사주 태양계의 한가운데에 {{일간}}이라는 항성이 놓여 있어요. {{오행}} 오행의 빛이 사주 전체를 비추고 있는 셈이죠.',
  '별자리 지도의 정중앙, 가장 밝은 별 — 그것이 바로 {{이름}}님의 일간 {{일간}}이에요. {{오행설명}} 에너지가 모든 궤도의 기준점이 되는 법이랍니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  신강도 해설 템플릿 (중력/에너지 비유)
// ─────────────────────────────────────────────────────────────────────────────

const STRENGTH_ASTRO_TEMPLATES: readonly string[] = [
  '신강도 {{수치}}/100, {{판정}} — {{이름}}님의 중심별은 {{비유}}이죠.',
  '중심별의 에너지 밀도는 {{수치}}/100({{판정}})이에요. 이 별은 {{비유}}이라 할 수 있어요.',
  '사주 우주의 중력장 세기를 측정하면 {{수치}}/100, 즉 {{판정}}이에요. {{비유}}인 거예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  격국 해설 템플릿 (성좌/궤도 비유)
// ─────────────────────────────────────────────────────────────────────────────

const GYEOKGUK_ASTRO_TEMPLATES: readonly string[] = [
  '격국 "{{격국}}"은 이 사주 은하의 구조 유형이에요. 마치 나선 은하, 타원 은하가 다르듯, 사주의 구조도 고유한 형태를 갖고 있는 거예요.',
  '사주 태양계의 궤도 패턴이 바로 격국 "{{격국}}"이에요. 행성들의 배치가 만들어낸 고유한 궤도 설계도와도 같습니다.',
  '"{{격국}}" — 이것은 {{이름}}님의 사주 별자리가 그리는 고유한 성좌 패턴이에요. 이 패턴이 삶의 기본 구조를 결정짓는 거예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  용신 해설 템플릿 (빛/에너지 보충 비유)
// ─────────────────────────────────────────────────────────────────────────────

const YONGSHIN_ASTRO_TEMPLATES: readonly string[] = [
  '용신 {{용신}}은 이 우주에 가장 필요한 빛의 파장이에요. {{색상}} 빛이 사주의 어둠을 밝혀주는 셈이죠.',
  '{{용신}} — 마치 별이 핵융합에 수소를 필요로 하듯, {{이름}}님의 사주 우주는 이 오행의 에너지를 가장 필요로 해요.',
  '우주가 {{이름}}님에게 보낸 메시지의 핵심은 "{{용신}}의 빛을 따르라"는 것이에요. {{방위}}의 별빛이 길을 밝혀줄 거예요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  과다/결핍 해설 템플릿 (행성 밀도 비유)
// ─────────────────────────────────────────────────────────────────────────────

const EXCESS_ASTRO_TEMPLATES: readonly string[] = [
  '{{오행}} 오행이 과다해요 — 마치 하나의 궤도에 행성이 너무 밀집한 것과 같아요. 에너지가 한곳에 쏠린 상태이죠.',
  '과다 오행 {{오행}}은 특정 파장의 빛이 지나치게 강한 것과 같아요. 균형 조절이 필요한 영역이에요.',
];

const DEFICIENT_ASTRO_TEMPLATES: readonly string[] = [
  '{{오행}} 오행이 결핍되어 있어요 — 우주의 한 영역이 암흑 성운에 가려진 것과도 같아요. 이 빈 궤도를 채워줄 에너지가 필요하거든요.',
  '결핍 오행 {{오행}}은 별빛이 닿지 않는 영역이에요. 용신과 개운법으로 이 어둠에 빛을 비추면 균형이 회복되는 법이랍니다.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  길흉 해설 템플릿 (명암 비유)
// ─────────────────────────────────────────────────────────────────────────────

const SHINSAL_ASTRO_TEMPLATES: readonly string[] = [
  '길신 점수 {{길신}}점은 밤하늘에 빛나는 밝은 별들이에요. 흉살 점수 {{흉살}}점은 주의가 필요한 유성우와 같아요.',
  '사주 하늘의 밝은 별(길신 {{길신}}점)과 경계해야 할 유성(흉살 {{흉살}}점)의 균형을 살펴보면 전체적인 운의 명암이 보여요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  개운 매핑 해설 템플릿 (별빛/파장 비유)
// ─────────────────────────────────────────────────────────────────────────────

const FORTUNE_MAP_TEMPLATES: readonly string[] = [
  '아래 오행별 개운 매핑표는 우주의 다섯 가지 에너지 파장을 실생활로 번역한 것이에요. 용신 {{용신}}에 해당하는 열을 특히 주목해 주세요!',
  '다섯 행성이 각각 고유한 주파수를 가지듯, 오행도 각각의 색상, 방위, 숫자, 맛, 계절을 품고 있어요. 용신 {{용신}}의 파장이 {{이름}}님에게 가장 잘 어울리는 빛이에요.',
  '이 매핑표는 우주의 다섯 가지 기본 에너지를 일상의 언어로 바꾼 항성 카탈로그예요. {{용신}} 오행 열이 {{이름}}님의 개운 핵심이에요!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  마무리 템플릿 (우주적 격려, 6개)
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_TEMPLATES: readonly string[] = [
  '사주는 탄생 순간 우주가 {{이름}}님에게 선물한 별자리 지도일 뿐이에요. 진짜 은하를 만들어가는 것은 {{이름}}님 자신의 선택과 노력이랍니다. 별처럼 빛나는 미래를 향해 나아가세요!',
  '광활한 우주에서 각 별은 자기만의 빛으로 빛나요. {{이름}}님의 사주 역시 세상에 단 하나뿐인 빛을 담고 있어요. 그 빛을 믿고, 자신만의 궤도를 당당하게 그려 나가세요!',
  '빅뱅 이후 138억 년, 우주는 아직도 팽창하고 있어요. {{이름}}님의 가능성 역시 무한하게 펼쳐져 있답니다. 오늘의 별 지도가 내일의 빛나는 항해를 인도할 거예요.',
  '밤하늘의 모든 별은 한때 성운의 먼지였어요. 작은 시작도 언젠가 찬란한 빛이 되는 법이죠. {{이름}}님의 사주에 담긴 에너지가 아름다운 빛으로 만개하길 바라요!',
  '우주에는 우리가 아직 발견하지 못한 별이 수천억 개 더 있어요. {{이름}}님의 인생에도 아직 펼쳐지지 않은 무한한 가능성이 기다리고 있답니다. 별을 향해 걸어가세요!',
  '천문학자는 말해요 — "우리는 모두 별의 먼지로 만들어졌다"고. {{이름}}님도 우주의 일부이며, 그 안에 은하수만큼의 빛을 품고 있어요. 그 빛을 세상에 나누어 주세요.',
];

// ─────────────────────────────────────────────────────────────────────────────
//  메인 생성 함수
// ─────────────────────────────────────────────────────────────────────────────

export function generateSummarySection(input: ReportInput): ReportSection {
  const rng = createRng(input);
  for (let i = 0; i < 34; i++) rng.next();

  const name = safeName(input);
  const sajuLike = input.saju as Record<string, unknown>;
  const dayMaster = (sajuLike.dayMaster ?? null) as Record<string, unknown> | null;
  const strength = (sajuLike.strength ?? null) as Record<string, unknown> | null;
  const gyeokguk = (sajuLike.gyeokguk ?? null) as Record<string, unknown> | null;
  const yongshin = (sajuLike.yongshin ?? null) as Record<string, unknown> | null;

  const paragraphs: ReportParagraph[] = [];

  // ── 1) 도입: 천문학적 은유로 종합 스코어보드 소개 ─────────────────────

  const introText = pickAndFill(rng, INTRO_TEMPLATES, { 이름: name });
  paragraphs.push(narrative(introText));

  // ── 2) 핵심 데이터 산출 ────────────────────────────────────────────────

  // 일간
  const dmElement = dayMaster?.element as ElementCode | undefined;
  const dmStem = (dayMaster?.stem as string | undefined) ?? '?';
  const dmPolarity = (dayMaster?.polarity as string | undefined) ?? '';
  const stemInfo = lookupStemInfo(dmStem);
  const dmHanja = stemInfo?.hanja ?? dmStem;
  const dmYinYangKo = dmPolarity === 'YANG' ? '양(陽)' : dmPolarity === 'YIN' ? '음(陰)' : '';

  // 신강도
  const sup = toFiniteNumber(strength?.totalSupport);
  const opp = toFiniteNumber(strength?.totalOppose);
  const total = sup + opp || 1;
  const indexedStrength = toFiniteNumber(strength?.index, NaN);
  const strengthIndex = Number.isFinite(indexedStrength)
    ? Math.max(0, Math.min(100, Math.round(indexedStrength)))
    : Math.round((sup / total) * 100);
  const strengthLevel = classifyStrength(strengthIndex);
  const strengthKo = STRENGTH_KOREAN[strengthLevel];

  // 격국
  const gyeokType = (gyeokguk?.type as string | undefined) ?? '미정';

  // 용신 체계
  const yongEl = (yongshin?.element as ElementCode | undefined) ?? null;
  const heeEl = (yongshin?.heeshin as ElementCode | undefined) ?? null;
  const giEl = (yongshin?.gishin as ElementCode | undefined) ?? null;

  // 과다/결핍
  const excessive = (input.saju.excessiveElements ?? []) as string[];
  const deficient = (input.saju.deficientElements ?? []) as string[];

  // 길신/흉살 점수
  const rawHits = sajuLike.shinsalHits;
  const hits = Array.isArray(rawHits) ? rawHits as Array<Record<string, unknown>> : [];
  const goodScore = hits
    .filter((h) => toFiniteNumber(h.baseWeight) > 0)
    .reduce((s, h) => s + Math.abs(toFiniteNumber(h.weightedScore, toFiniteNumber(h.baseWeight))), 0);
  const badScore = hits
    .filter((h) => toFiniteNumber(h.baseWeight) < 0)
    .reduce((s, h) => s + Math.abs(toFiniteNumber(h.weightedScore, toFiniteNumber(h.baseWeight))), 0);
  const goodScoreRounded = Math.round(goodScore * 100) / 100;
  const badScoreRounded = Math.round(badScore * 100) / 100;

  // ── 3) 일간 별 해설 ────────────────────────────────────────────────────

  const celestialDesc = dmElement ? (ELEMENT_CELESTIAL[dmElement] ?? '') : '';
  const dmAstroText = pickAndFill(rng, DAYMASTER_ASTRO_TEMPLATES, {
    이름: name,
    일간: `${dmStem}(${dmHanja})`,
    오행: elFull(dmElement),
    오행설명: celestialDesc,
  });
  paragraphs.push(emphasis(dmAstroText));

  // ── 4) 신강도 해설 (중력/에너지 비유) ─────────────────────────────────

  const strengthAstroDesc = STRENGTH_ASTRO[strengthLevel] ?? '';
  const strengthAstroText = pickAndFill(rng, STRENGTH_ASTRO_TEMPLATES, {
    이름: name,
    수치: String(strengthIndex),
    판정: strengthKo,
    비유: strengthAstroDesc,
  });
  paragraphs.push(narrative(strengthAstroText));

  // ── 5) 격국 해설 (성좌/궤도 비유) ─────────────────────────────────────

  if (gyeokguk) {
    const gyeokAstroText = pickAndFill(rng, GYEOKGUK_ASTRO_TEMPLATES, {
      이름: name,
      격국: gyeokType,
    });
    paragraphs.push(narrative(gyeokAstroText));
  }

  // ── 6) 용신 해설 (빛/에너지 보충 비유) ────────────────────────────────

  if (yongEl) {
    const yongAstroText = pickAndFill(rng, YONGSHIN_ASTRO_TEMPLATES, {
      이름: name,
      용신: elFull(yongEl),
      색상: ELEMENT_COLOR[yongEl] ?? '',
      방위: ELEMENT_DIRECTION[yongEl] ?? '',
    });
    paragraphs.push(positive(yongAstroText, yongEl));
  }

  // ── 7) 과다/결핍 해설 (행성 밀도 비유) ────────────────────────────────

  if (excessive.length > 0) {
    const exEl = excessive[0];
    const exText = pickAndFill(rng, EXCESS_ASTRO_TEMPLATES, {
      오행: elFull(exEl),
    });
    paragraphs.push(narrative(exText));
  }

  if (deficient.length > 0) {
    const defEl = deficient[0];
    const defText = pickAndFill(rng, DEFICIENT_ASTRO_TEMPLATES, {
      오행: elFull(defEl),
    });
    paragraphs.push(narrative(defText));
  }

  // ── 8) 길흉 해설 (명암 비유) ──────────────────────────────────────────

  if (hits.length > 0) {
    const shinsalText = pickAndFill(rng, SHINSAL_ASTRO_TEMPLATES, {
      길신: String(goodScoreRounded),
      흉살: String(badScoreRounded),
    });
    paragraphs.push(narrative(shinsalText));
  }

  // ── 9) 개운 매핑 해설 (용신이 있을 때) ────────────────────────────────

  if (yongEl) {
    const fortuneMapText = pickAndFill(rng, FORTUNE_MAP_TEMPLATES, {
      이름: name,
      용신: elShort(yongEl),
    });
    paragraphs.push(tip(fortuneMapText));
  }

  // ── 10) 마무리 격려 (우주적 경이로움) ─────────────────────────────────

  const closingText = pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name });
  paragraphs.push(encouraging(closingText));

  // ── 11) 핵심 수치 요약 테이블 (9-1) ───────────────────────────────────

  const yongRow = yongEl
    ? `${elFull(yongEl)} → 색상: ${ELEMENT_COLOR[yongEl] ?? ''}, 방위: ${ELEMENT_DIRECTION[yongEl] ?? ''}, 숫자: ${(ELEMENT_NUMBER[yongEl] ?? []).join('·')}`
    : '미정';

  const summaryTable: ReportTable = {
    title: '사주 핵심 수치 요약',
    headers: ['항목', '값'],
    rows: [
      ['일간', `${dmStem}(${dmHanja}) — ${elFull(dmElement)} / ${dmYinYangKo}`],
      ['신강도', `${strengthIndex}/100 → ${strengthKo}`],
      ['격국', gyeokType],
      ['용신', yongRow],
      ['희신', heeEl ? elFull(heeEl) : '미정'],
      ['기신', giEl ? elFull(giEl) : '미정'],
      ['과다 오행', excessive.length > 0 ? excessive.map(e => elFull(e)).join(', ') : '없음'],
      ['결핍 오행', deficient.length > 0 ? deficient.map(e => elFull(e)).join(', ') : '없음'],
      ['길신 점수 합', String(goodScoreRounded)],
      ['흉살 점수 합', String(badScoreRounded)],
    ],
  };

  // ── 12) 용신 기반 개운 매핑표 (9-3) ───────────────────────────────────

  const tables: ReportTable[] = [summaryTable];

  if (yongEl) {
    const ELEMENTS: ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

    // 용신 열을 강조 표시 (★ 마크)
    const headerLabels = ELEMENTS.map(e => {
      const label = `${elShort(e)}(${elHanja(e)})`;
      return e === yongEl ? `${label} ★` : label;
    });

    tables.push({
      title: '오행별 개운 매핑표 (★ = 용신)',
      headers: ['영역', ...headerLabels],
      rows: [
        ['색상', ...ELEMENTS.map(e => ELEMENT_COLOR[e] ?? '')],
        ['방위', ...ELEMENTS.map(e => ELEMENT_DIRECTION[e] ?? '')],
        ['숫자', ...ELEMENTS.map(e => (ELEMENT_NUMBER[e] ?? []).join(', '))],
        ['맛', ...ELEMENTS.map(e => ELEMENT_TASTE[e] ?? '')],
        ['계절', ...ELEMENTS.map(e => ELEMENT_SEASON[e] ?? '')],
        ['시간', ...ELEMENTS.map(e => ELEMENT_TIME[e] ?? '')],
        ['취약장기 보호', ...ELEMENTS.map(e => ELEMENT_ORGAN[e]?.main ?? '')],
      ],
    });
  }

  // ── 13) 하이라이트 ─────────────────────────────────────────────────────

  const highlights: ReportHighlight[] = [
    {
      label: '일간 (중심별)',
      value: `${dmStem}(${dmHanja}) — ${elFull(dmElement)}`,
      element: dmElement,
      sentiment: 'neutral',
    },
    {
      label: '신강도 (중력장)',
      value: `${strengthIndex}/100 (${strengthKo})`,
      sentiment: strengthLevel === 'BALANCED' ? 'good' : 'neutral',
    },
    {
      label: '격국 (궤도 패턴)',
      value: gyeokType,
      sentiment: 'neutral',
    },
    {
      label: '용신 (필요한 빛)',
      value: yongEl ? `${elFull(yongEl)} → ${ELEMENT_COLOR[yongEl] ?? ''}, ${ELEMENT_DIRECTION[yongEl] ?? ''}` : '미정',
      element: yongEl ?? undefined,
      sentiment: yongEl ? 'good' : 'neutral',
    },
  ];

  // 희신/기신 하이라이트 추가
  if (heeEl) {
    highlights.push({
      label: '희신 (보조 별빛)',
      value: elFull(heeEl),
      element: heeEl,
      sentiment: 'good',
    });
  }
  if (giEl) {
    highlights.push({
      label: '기신 (경계 유성)',
      value: elFull(giEl),
      element: giEl,
      sentiment: 'caution',
    });
  }

  // 길흉 하이라이트
  if (hits.length > 0) {
    highlights.push({
      label: '길신 점수',
      value: `${goodScoreRounded}점`,
      sentiment: 'good',
    });
    highlights.push({
      label: '흉살 점수',
      value: `${badScoreRounded}점`,
      sentiment: badScoreRounded > goodScoreRounded ? 'caution' : 'neutral',
    });
  }

  // ── 반환 ───────────────────────────────────────────────────────────────

  return {
    id: 'summary',
    title: '종합 스코어보드',
    subtitle: '별자리 지도로 읽는 사주의 전체 그림',
    paragraphs,
    tables,
    highlights,
  };
}
