/**
 * 두 사람 궁합 빌더.
 *
 * 각 사람의 ReportDeliveryV1(이미 계산된 facts)만 입력으로 받아,
 * 고전 명리의 쌍 관계(합·충·형·해·파·원진·귀문)와 오행·용신·십성 상보를
 * 결정론적으로 계산하고, 축별 점수와 해석 문장을 만든다.
 *
 * 원칙:
 *  - 새로운 사주·성명 판단을 돌리지 않는다 (facts 재사용).
 *  - 값이 없으면 그 축을 limited/unavailable로 표시하고 지어내지 않는다.
 *  - 모든 점수는 근거 fact를 가리키고, 가중치는 provenance에 공개한다.
 */
import type {
  ElementBalanceFactV1,
  ElementDistributionFactV1,
  FiveElementIdV1,
  NameCharacterFactV1,
  NameSajuInteractionFactV1,
  NamingFrameFactV1,
  PillarsFactV1,
  ReportDeliveryV1,
  ReportFactV1,
  SajuPillarPositionV1,
  StrengthFactV1,
  TenGodCodeV1,
  YinYangBalanceFactV1,
  YongshinFactV1,
} from '../delivery/types.js';
import { buildContextNotes, derivePairContext } from './context.js';
import type { CopyVoiceV1 } from './copy-bundles.js';
import {
  ELEMENT_KO,
  elementKo,
  hasBatchim,
  listKo,
  renderBranchPairCopy,
  resolveBundle,
  splitBranchRelations,
} from './copy-bundles.js';
import type { BranchCode, StemCode } from './relation-tables.js';
import {
  branchGlyphV1,
  elementRelation,
  isStemChung,
  lookupBranchPair,
  phoneticElementOfHangul,
  stemGlyphV1,
  stemHapElement,
  tenGodOf,
} from './relation-tables.js';
import type {
  BranchPairFactV1,
  BranchPairRelationV1,
  CompatibilityAvailabilityV1,
  CompatibilityAxisIdV1,
  CompatibilityAxisV1,
  CompatibilityDomainV1,
  CompatibilityFactV1,
  CompatFramingV1,
  CompatibilityGradeV1,
  CompatibilityPersonEchoV1,
  CompatibilityPersonKeyV1,
  CompatibilityReasonV1,
  CompatibilitySummaryV1,
  CoupleCompatibilityRequestV1,
  CoupleCompatibilitySectionV1,
  CoupleCompatibilityV1,
  ElementComplementFactV1,
  FramePairFactV1,
  GanjiGlyphV1,
  NameElementComplementFactV1,
  NameFlowFactV1,
  NamePolarityPairFactV1,
  NameToSajuCrossFactV1,
  StemPairFactV1,
  StrengthPairFactV1,
  YinYangPairFactV1,
  YongshinCrossFactV1,
} from './types.js';
import { COUPLE_COMPATIBILITY_SCHEMA_V1 } from './types.js';

/* ================================================================== */
/* 공용 도우미                                                          */
/* ================================================================== */

// 한글 조사·호칭 도우미와 서사 표는 copy-bundles.ts로 옮겼다 —
// 카피(문장)와 검출(점수)의 소유를 파일 단위로 가르기 위해서다.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 실무 관행 등급 구간(80+ 천생연분 / 65 좋음 / 50 무난 / 38 노력 / 그 밑 신중). */
function gradeOf(score: number): CompatibilityGradeV1 {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'balanced';
  if (score >= 38) return 'watch';
  return 'challenging';
}

const READY: CompatibilityAvailabilityV1 = { status: 'ready', reasons: [] };

function limited(...reasons: CompatibilityReasonV1[]): CompatibilityAvailabilityV1 {
  return { status: 'limited', reasons };
}

function unavailable(...reasons: CompatibilityReasonV1[]): CompatibilityAvailabilityV1 {
  return { status: 'unavailable', reasons };
}

/* ================================================================== */
/* delivery fact 접근                                                   */
/* ================================================================== */

function factsOfKind<K extends ReportFactV1['kind']>(
  delivery: ReportDeliveryV1,
  kind: K,
): Extract<ReportFactV1, { kind: K }>[] {
  return delivery.facts.filter(
    (fact): fact is Extract<ReportFactV1, { kind: K }> => fact.kind === kind,
  );
}

function factOfKind<K extends ReportFactV1['kind']>(
  delivery: ReportDeliveryV1,
  kind: K,
): Extract<ReportFactV1, { kind: K }> | null {
  return factsOfKind(delivery, kind)[0] ?? null;
}

/* ================================================================== */
/* 사람별 컨텍스트                                                       */
/* ================================================================== */

interface PersonContext {
  key: CompatibilityPersonKeyV1;
  displayName: string;
  fullHangul: string | null;
  fullHanja: string | null;
  gender: 'male' | 'female' | 'unknown';
  analysisId: string;
  pillars: Partial<
    Record<SajuPillarPositionV1, { stem: GanjiGlyphV1 | null; branch: GanjiGlyphV1 | null }>
  >;
  dayStem: GanjiGlyphV1 | null;
  dayBranch: GanjiGlyphV1 | null;
  yearBranch: GanjiGlyphV1 | null;
  strengthCode: StrengthFactV1['levelCode'] | null;
  strengthLevel: string | null;
  yongshin: FiveElementIdV1 | null;
  gishin: FiveElementIdV1 | null;
  /** 원국 오행 분포 (%). */
  sajuShare: Map<FiveElementIdV1, number> | null;
  /** 분포 fact의 값 배열 echo (저장 순서 그대로). 프론트 막대 렌더용. */
  sajuElementsEcho:
    | readonly { readonly element: FiveElementIdV1; readonly sharePercent: number }[]
    | null;
  deficient: readonly FiveElementIdV1[] | null;
  excessive: readonly FiveElementIdV1[] | null;
  yinYangDominant: 'YANG' | 'YIN' | 'EVEN' | null;
  /** 성+이름 전체 글자의 오행 (fact 순서 = 성→이름). 자원오행 계열 — 교차 보완 축에 쓴다. */
  nameElements: FiveElementIdV1[] | null;
  /** 성+이름 전체 글자의 발음오행(초성). 이름 대 이름 흐름 축에 쓴다. */
  namePhoneticElements: FiveElementIdV1[] | null;
  namePolarity: { yang: number; yin: number } | null;
  frames: { frameType: string; luckyLevel: number }[] | null;
}

function orderedNameCharacters(delivery: ReportDeliveryV1): NameCharacterFactV1[] {
  const characters = factsOfKind(delivery, 'name_character');
  const rank = (fact: NameCharacterFactV1) =>
    (fact.position === 'surname' ? 0 : 100) + fact.index;
  return [...characters].sort((left, right) => rank(left) - rank(right));
}

function buildPersonContext(
  key: CompatibilityPersonKeyV1,
  input: CoupleCompatibilityRequestV1['a'],
): PersonContext {
  const { delivery } = input;

  const characters = orderedNameCharacters(delivery);
  const fullHangul =
    characters.length > 0
      ? characters.map(fact => fact.hangul).join('')
      : (input.fullHangulName ?? null);
  const fullHanja =
    characters.length > 0 && characters.every(fact => fact.hanja)
      ? characters.map(fact => fact.hanja).join('')
      : null;
  const fallbackName = key === 'a' ? '첫 번째 분' : '두 번째 분';
  const displayName = input.displayName?.trim() || fullHangul || fallbackName;

  const pillarsFact: PillarsFactV1 | null = factOfKind(delivery, 'pillars');
  const pillars: PersonContext['pillars'] = {};
  for (const value of pillarsFact?.values ?? []) {
    pillars[value.position] = {
      stem: stemGlyphV1(value.stem.code),
      branch: branchGlyphV1(value.branch.code),
    };
  }

  const strength: StrengthFactV1 | null = factOfKind(delivery, 'strength');
  const yongshinFact: YongshinFactV1 | null = factOfKind(delivery, 'yongshin');
  const interaction: NameSajuInteractionFactV1 | null = factOfKind(
    delivery,
    'name_saju_interaction',
  );
  const balance: ElementBalanceFactV1 | null = factOfKind(delivery, 'element_balance');
  const yinYang: YinYangBalanceFactV1 | null = factOfKind(delivery, 'yin_yang_balance');

  const distributions: ElementDistributionFactV1[] = factsOfKind(
    delivery,
    'element_distribution',
  );
  const sajuDistribution = distributions.find(fact => fact.source === 'saju') ?? null;
  const sajuShare = sajuDistribution
    ? new Map(sajuDistribution.values.map(value => [value.element, value.sharePercent]))
    : null;
  const sajuElementsEcho = sajuDistribution
    ? sajuDistribution.values.map(value => ({
        element: value.element,
        sharePercent: value.sharePercent,
      }))
    : null;

  const characterElements = characters
    .map(fact => fact.element)
    .filter((element): element is FiveElementIdV1 => element != null);
  const nameElements =
    characterElements.length > 0
      ? characterElements
      : interaction && interaction.classification !== 'unavailable'
        ? [...interaction.nameElements]
        : null;

  const phoneticSource =
    characters.length > 0
      ? characters.map(fact => fact.hangul)
      : input.fullHangulName
        ? Array.from(input.fullHangulName)
        : [];
  const phoneticElements = phoneticSource
    .map(phoneticElementOfHangul)
    .filter((element): element is FiveElementIdV1 => element != null);

  const polarityMarks = characters
    .map(fact => fact.polarity)
    .filter((polarity): polarity is string => polarity != null);
  const namePolarity =
    polarityMarks.length > 0
      ? {
          yang: polarityMarks.filter(mark => /양|YANG/iu.test(mark)).length,
          yin: polarityMarks.filter(mark => /음|YIN/iu.test(mark)).length,
        }
      : null;

  const frameFacts: NamingFrameFactV1[] = factsOfKind(delivery, 'naming_frame');
  const frames =
    frameFacts.length > 0
      ? frameFacts.map(fact => ({ frameType: fact.frameType, luckyLevel: fact.luckyLevel }))
      : null;

  return {
    key,
    displayName,
    fullHangul,
    fullHanja,
    gender: input.gender === 'male' || input.gender === 'female' ? input.gender : 'unknown',
    analysisId: delivery.analysisId,
    pillars,
    dayStem: pillars.day?.stem ?? null,
    dayBranch: pillars.day?.branch ?? null,
    yearBranch: pillars.year?.branch ?? null,
    strengthCode: strength?.levelCode ?? null,
    strengthLevel: strength?.level ?? null,
    yongshin: yongshinFact?.element ?? null,
    gishin:
      interaction && interaction.classification !== 'unavailable'
        ? interaction.gishinElement
        : null,
    sajuShare,
    sajuElementsEcho,
    deficient: balance ? balance.deficient : null,
    excessive: balance ? balance.excessive : null,
    yinYangDominant: yinYang?.dominant ?? null,
    nameElements,
    namePhoneticElements: phoneticElements.length > 0 ? phoneticElements : null,
    namePolarity,
    frames,
  };
}

/* ================================================================== */
/* 쌍 fact 생성                                                         */
/* ================================================================== */

const PILLAR_ORDER: readonly SajuPillarPositionV1[] = ['year', 'month', 'day', 'hour'];

const PILLAR_KO: Record<SajuPillarPositionV1, string> = {
  year: '년주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

function buildStemPairFact(
  id: string,
  aPosition: SajuPillarPositionV1,
  bPosition: SajuPillarPositionV1,
  a: GanjiGlyphV1,
  b: GanjiGlyphV1,
): StemPairFactV1 {
  const aCode = a.code as StemCode;
  const bCode = b.code as StemCode;
  const hapElement = stemHapElement(aCode, bCode);
  const relation: StemPairFactV1['relation'] = hapElement
    ? 'hap'
    : isStemChung(aCode, bCode)
      ? 'chung'
      : (() => {
          switch (elementRelation(a.element, b.element)) {
            case 'same':
              return 'bihwa' as const;
            case 'generates':
              return 'saeng_a_to_b' as const;
            case 'generated':
              return 'saeng_b_to_a' as const;
            case 'controls':
              return 'geuk_a_to_b' as const;
            case 'controlled':
              return 'geuk_b_to_a' as const;
          }
        })();
  return {
    id,
    kind: 'stem_pair',
    domain: 'saju',
    method: 'spring-ts.couple-stem-pair.v1',
    aPosition,
    bPosition,
    a,
    b,
    relation,
    hapElement,
    tenGodOfBForA: tenGodOf(aCode, bCode),
    tenGodOfAForB: tenGodOf(bCode, aCode),
  };
}

function buildBranchPairFact(
  id: string,
  aPosition: SajuPillarPositionV1,
  bPosition: SajuPillarPositionV1,
  a: GanjiGlyphV1,
  b: GanjiGlyphV1,
): BranchPairFactV1 {
  const lookup = lookupBranchPair(a.code as BranchCode, b.code as BranchCode);
  const relations: BranchPairRelationV1[] = [];
  if (lookup.yukhap) relations.push('yukhap');
  if (lookup.samhapElement) relations.push('samhap');
  if (lookup.banghapElement) relations.push('banghap');
  if (lookup.chung) relations.push('chung');
  if (lookup.hyeong) relations.push('hyeong');
  if (lookup.jahyeong) relations.push('jahyeong');
  if (lookup.hae) relations.push('hae');
  if (lookup.pa) relations.push('pa');
  if (lookup.wonjin) relations.push('wonjin');
  if (lookup.gwimun) relations.push('gwimun');
  return {
    id,
    kind: 'branch_pair',
    domain: 'saju',
    method: 'spring-ts.couple-branch-pair.v1',
    aPosition,
    bPosition,
    a,
    b,
    relations,
    yukhapElement: lookup.yukhapElement,
    samhapElement: lookup.samhapElement,
    banghapElement: lookup.banghapElement,
  };
}

/* ================================================================== */
/* 축 만들기 도우미                                                      */
/* ================================================================== */

interface AxisDraft {
  id: CompatibilityAxisIdV1;
  domain: CompatibilityDomainV1;
  label: string;
  score: number;
  availability: CompatibilityAvailabilityV1;
  factRefs: string[];
  headline: string;
  paragraphs: string[];
  tips: string[];
  cautions: string[];
}

function finishAxis(draft: AxisDraft, weight: number): CompatibilityAxisV1 {
  const score = Math.round(clamp(draft.score, 0, 100));
  return {
    id: draft.id,
    domain: draft.domain,
    label: draft.label,
    score,
    weight,
    grade: gradeOf(score),
    availability: draft.availability,
    factRefs: draft.factRefs,
    headline: draft.headline,
    paragraphs: draft.paragraphs,
    tips: draft.tips,
    cautions: draft.cautions,
  };
}

/* ================================================================== */
/* 사주 축들                                                            */
/* ================================================================== */

function dayStemAxis(
  a: PersonContext,
  b: PersonContext,
  fact: StemPairFactV1 | null,
  voice: CopyVoiceV1,
): AxisDraft {
  if (!fact) {
    return {
      id: 'saju_day_stem',
      domain: 'saju',
      label: '일간의 만남',
      score: 0,
      availability: unavailable({ code: 'DAY_PILLAR_MISSING' }),
      factRefs: [],
      headline: '일간 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }

  // 점수는 관계 검출로 결정하고, 문장은 카피 번들이 맡는다.
  let score: number;
  let situation:
    | 'day_stem.hap'
    | 'day_stem.chung'
    | 'day_stem.saeng'
    | 'day_stem.geuk'
    | 'day_stem.bihwa';
  switch (fact.relation) {
    case 'hap':
      score = 88;
      situation = 'day_stem.hap';
      break;
    case 'chung':
      score = 36;
      situation = 'day_stem.chung';
      break;
    case 'saeng_a_to_b':
    case 'saeng_b_to_a':
      score = 76;
      situation = 'day_stem.saeng';
      break;
    case 'bihwa':
      score = 66;
      situation = 'day_stem.bihwa';
      break;
    case 'geuk_a_to_b':
    case 'geuk_b_to_a':
      score = 46;
      situation = 'day_stem.geuk';
      break;
  }

  // 합화 오행이 용신/기신에 닿으면 점수에 반영하고, 그 사실은 서사 재료로 넘긴다.
  let hapYongshinOwnerName: string | null = null;
  let hapGishinOwnerName: string | null = null;
  if (fact.relation === 'hap' && fact.hapElement) {
    const hapEl = fact.hapElement;
    if (a.yongshin === hapEl || b.yongshin === hapEl) {
      score += 4;
      hapYongshinOwnerName = a.yongshin === hapEl ? a.displayName : b.displayName;
    } else if (a.gishin === hapEl || b.gishin === hapEl) {
      score -= 4;
      hapGishinOwnerName = a.gishin === hapEl ? a.displayName : b.displayName;
    }
  }

  const copy = resolveBundle(situation, voice.framing)({
    aName: a.displayName,
    bName: b.displayName,
    fact,
    hapYongshinOwnerName,
    hapGishinOwnerName,
    voice,
  });

  return {
    id: 'saju_day_stem',
    domain: 'saju',
    label: '일간의 만남',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline: copy.headline ?? '',
    paragraphs: [...copy.paragraphs],
    tips: [...(copy.tips ?? [])],
    cautions: [...(copy.cautions ?? [])],
  };
}

const NEGATIVE_MAGNITUDE: Record<string, number> = {
  chung: 30,
  wonjin: 18,
  hyeong: 15,
  gwimun: 14,
  jahyeong: 10,
  hae: 9,
  pa: 7,
};

function branchPairScore(relations: readonly BranchPairRelationV1[]): number {
  let score = 60;
  const { positives, negatives } = splitBranchRelations(relations);
  // 합은 겹쳐도 가장 강한 하나만 값을 준다 (중복 과금 방지).
  const positiveBonus = positives.reduce((best, relation) => {
    const bonus = relation === 'yukhap' ? 28 : relation === 'samhap' ? 21 : 10;
    return Math.max(best, bonus);
  }, 0);
  score += positiveBonus;
  // 흉의 겹침(축오=원진+귀문+해 등)은 이중 감점하지 않는다:
  // 가장 강한 하나만 온전히 반영하고, 나머지는 40%로 부기한다.
  const magnitudes = negatives
    .map(relation => NEGATIVE_MAGNITUDE[relation] ?? 7)
    .sort((left, right) => right - left);
  const negativeSum = magnitudes.reduce(
    (sum, magnitude, index) => sum + (index === 0 ? magnitude : magnitude * 0.4),
    0,
  );
  score -= Math.min(negativeSum, 38);
  return clamp(score, 6, 96);
}

function dayBranchAxis(
  a: PersonContext,
  b: PersonContext,
  fact: BranchPairFactV1 | null,
  voice: CopyVoiceV1,
): AxisDraft {
  // 일지를 "배우자궁"으로 부르는 것은 성인 연애·부부 프레임에서만.
  // 그 외의 관계에서는 속마음 자리(내면의 궁)라는 본래 의미로 읽는다.
  const label = voice.framing === 'couple' ? '배우자궁(일지)의 만남' : '일지(속마음 자리)의 만남';
  const seatLabel = voice.framing === 'couple' ? '배우자궁(일지)' : '일지(속마음 자리)';
  if (!fact) {
    return {
      id: 'saju_day_branch',
      domain: 'saju',
      label,
      score: 0,
      availability: unavailable({ code: 'DAY_PILLAR_MISSING' }),
      factRefs: [],
      headline: '일지 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const text = renderBranchPairCopy(fact, a.displayName, b.displayName, seatLabel, voice);
  return {
    id: 'saju_day_branch',
    domain: 'saju',
    label,
    score: branchPairScore(fact.relations),
    availability: READY,
    factRefs: [fact.id],
    ...text,
  };
}

function yearBranchAxis(
  a: PersonContext,
  b: PersonContext,
  fact: BranchPairFactV1 | null,
  voice: CopyVoiceV1,
): AxisDraft {
  if (!fact) {
    return {
      id: 'saju_year_branch',
      domain: 'saju',
      label: '띠(년지)의 어울림',
      score: 0,
      availability: unavailable({ code: 'SAJU_FACTS_MISSING' }),
      factRefs: [],
      headline: '년지 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const text = renderBranchPairCopy(fact, a.displayName, b.displayName, '띠(년지)', voice);
  text.paragraphs.push(
    '띠끼리의 관계는 전통 궁합에서 가장 널리 알려진 잣대지만, 실제 명리 궁합에서는 일간·일지보다 가벼운 참고 신호로 읽어요.',
  );
  return {
    id: 'saju_year_branch',
    domain: 'saju',
    label: '띠(년지)의 어울림',
    score: branchPairScore(fact.relations),
    availability: READY,
    factRefs: [fact.id],
    ...text,
  };
}

const TEN_GOD_PAIR_SCORE: Record<TenGodCodeV1, number> = {
  JEONG_GWAN: 78,
  JEONG_JAE: 78,
  JEONG_IN: 76,
  SIK_SIN: 74,
  BI_GYEON: 66,
  PYEON_JAE: 64,
  PYEON_IN: 60,
  PYEON_GWAN: 58,
  SANG_GWAN: 50,
  GYEOB_JAE: 46,
};

function tenGodAxis(
  a: PersonContext,
  b: PersonContext,
  fact: StemPairFactV1 | null,
  voice: CopyVoiceV1,
): AxisDraft {
  if (!fact || !fact.tenGodOfBForA || !fact.tenGodOfAForB) {
    return {
      id: 'saju_ten_god',
      domain: 'saju',
      label: '서로에게 어떤 존재인가 (십성)',
      score: 0,
      availability: unavailable({ code: 'DAY_PILLAR_MISSING' }),
      factRefs: [],
      headline: '십성 관계를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const bForA = fact.tenGodOfBForA;
  const aForB = fact.tenGodOfAForB;
  let scoreA = TEN_GOD_PAIR_SCORE[bForA];
  let scoreB = TEN_GOD_PAIR_SCORE[aForB];

  // 배우자성(재성·관성) 보너스는 성인 연애·부부 프레임에서만 —
  // 우정·가족·아이의 짝에 배우자의 별을 세는 것은 명리적으로도 무리다.
  // (해당 문장은 couple 번들 writer가 같은 조건으로 함께 쓴다.)
  if (voice.framing === 'couple') {
    if (a.gender === 'male' && (bForA === 'JEONG_JAE' || bForA === 'PYEON_JAE')) scoreA += 8;
    if (a.gender === 'female' && (bForA === 'JEONG_GWAN' || bForA === 'PYEON_GWAN')) scoreA += 8;
    if (b.gender === 'male' && (aForB === 'JEONG_JAE' || aForB === 'PYEON_JAE')) scoreB += 8;
    if (b.gender === 'female' && (aForB === 'JEONG_GWAN' || aForB === 'PYEON_GWAN')) scoreB += 8;
  }

  const copy = resolveBundle('ten_god.pair', voice.framing)({
    aName: a.displayName,
    bName: b.displayName,
    bForA,
    aForB,
    aGender: a.gender,
    bGender: b.gender,
    voice,
  });

  const score = (scoreA + scoreB) / 2;
  const headline =
    copy.headline
    ?? (score >= 74
      ? '서로가 서로에게 힘이 되는 십성의 짝이에요.'
      : score >= 58
        ? '서로 다른 방식으로 자극을 주고받는 십성의 짝이에요.'
        : '긴장을 품은 십성의 짝 — 규칙이 관계를 지켜 줘요.');

  return {
    id: 'saju_ten_god',
    domain: 'saju',
    label: '서로에게 어떤 존재인가 (십성)',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline,
    paragraphs: [...copy.paragraphs],
    tips: [...(copy.tips ?? [])],
    cautions: [...(copy.cautions ?? [])],
  };
}

function yongshinCrossFacts(
  a: PersonContext,
  b: PersonContext,
): YongshinCrossFactV1[] {
  const facts: YongshinCrossFactV1[] = [];
  const build = (
    receiver: PersonContext,
    giver: PersonContext,
    direction: YongshinCrossFactV1['direction'],
  ) => {
    if (!receiver.yongshin) return;
    const yongshin = receiver.yongshin;
    const giverDayElement = giver.dayStem?.element ?? null;
    let match: YongshinCrossFactV1['match'] = 'neutral';
    if (giverDayElement) {
      if (giverDayElement === yongshin) match = 'direct';
      else {
        const relation = elementRelation(giverDayElement, yongshin);
        if (relation === 'generates') match = 'generates';
        else if (relation === 'controls') match = 'controls';
      }
    }
    facts.push({
      id: `compat.yongshin-cross.${direction}`,
      kind: 'yongshin_cross',
      domain: 'saju',
      method: 'spring-ts.couple-yongshin-cross.v1',
      direction,
      yongshinElement: yongshin,
      partnerDayElement: giverDayElement,
      match,
      partnerSharePercent: giver.sajuShare?.get(yongshin) ?? null,
      gishinElement: receiver.gishin,
      partnerGishinSharePercent:
        receiver.gishin != null ? (giver.sajuShare?.get(receiver.gishin) ?? null) : null,
    });
  };
  build(a, b, 'b_supports_a');
  build(b, a, 'a_supports_b');
  return facts;
}

function yongshinAxis(
  a: PersonContext,
  b: PersonContext,
  facts: readonly YongshinCrossFactV1[],
  voice: CopyVoiceV1,
): AxisDraft {
  if (facts.length === 0) {
    return {
      id: 'saju_yongshin_cross',
      domain: 'saju',
      label: '서로의 용신을 채워 주는가',
      score: 0,
      availability: unavailable(
        { code: 'YONGSHIN_MISSING', person: 'a' },
        { code: 'YONGSHIN_MISSING', person: 'b' },
      ),
      factRefs: [],
      headline: '용신 판단이 없어 이 축은 계산하지 않았어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }

  const paragraphs: string[] = [];
  const cautions: string[] = [];
  const scores: number[] = [];

  for (const fact of facts) {
    const receiver = fact.direction === 'b_supports_a' ? a : b;
    const giver = fact.direction === 'b_supports_a' ? b : a;
    // 점수는 교차 검출로 결정하고, 방향별 문장은 카피 번들이 맡는다.
    let score: number;
    let situation:
      | 'yongshin.direct'
      | 'yongshin.generates'
      | 'yongshin.controls'
      | 'yongshin.neutral';
    switch (fact.match) {
      case 'direct':
        score = 90;
        situation = 'yongshin.direct';
        break;
      case 'generates':
        score = 78;
        situation = 'yongshin.generates';
        break;
      case 'controls':
        score = 40;
        situation = 'yongshin.controls';
        break;
      default:
        score = 58;
        situation = 'yongshin.neutral';
        break;
    }
    const copy = resolveBundle(situation, voice.framing)({
      giverName: giver.displayName,
      receiverName: receiver.displayName,
      fact,
      voice,
    });
    paragraphs.push(...copy.paragraphs);
    cautions.push(...(copy.cautions ?? []));
    if (fact.partnerSharePercent != null && fact.partnerSharePercent >= 30) {
      score += 6;
      paragraphs.push(
        `${giver.displayName}님 원국에는 그 ${ELEMENT_KO[fact.yongshinElement]} 기운이 ${Math.round(fact.partnerSharePercent)}%나 돼서, 채워 주는 힘이 실제로 넉넉해요.`,
      );
    }
    if (fact.partnerGishinSharePercent != null && fact.gishinElement && fact.partnerGishinSharePercent >= 35) {
      score -= 8;
      cautions.push(
        `${giver.displayName}님 원국에는 ${receiver.displayName}님이 조심스러워하는 ${ELEMENT_KO[fact.gishinElement]} 기운도 ${Math.round(fact.partnerGishinSharePercent)}%로 많은 편이에요 — 함께 있는 시간의 밀도를 조절하는 게 지혜예요.`,
      );
    }
    scores.push(score);
  }

  const availability =
    facts.length === 2
      ? READY
      : limited({
          code: 'YONGSHIN_MISSING',
          person: facts[0].direction === 'b_supports_a' ? 'b' : 'a',
        });

  let score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  if (a.yongshin && b.yongshin && a.yongshin === b.yongshin) {
    score += 4;
    paragraphs.push(
      `두 분은 반기는 기운(${elementKo(a.yongshin)})이 같아요. 같은 결핍을 공유하는 사이는 말이 깊이 통하는 유형의 좋은 궁합으로 읽어요 — 서로를 채워 주는 궁합과는 결이 다른, 또 하나의 인연이에요.`,
    );
  }
  const headline =
    score >= 80
      ? '서로가 서로의 용신 — 함께 있을수록 채워지는 짝이에요.'
      : score >= 65
        ? '서로의 부족한 기운을 살려 주는 흐름이 있어요.'
        : score >= 50
          ? '용신의 관점에서는 담백한, 무해한 짝이에요.'
          : '서로의 반기는 기운을 누르기 쉬운 배치 — 거리 조절이 지혜예요.';

  return {
    id: 'saju_yongshin_cross',
    domain: 'saju',
    label: '서로의 용신을 채워 주는가',
    score,
    availability,
    factRefs: facts.map(fact => fact.id),
    headline,
    paragraphs,
    tips: [],
    cautions,
  };
}

function elementComplementFacts(
  a: PersonContext,
  b: PersonContext,
): ElementComplementFactV1[] {
  const facts: ElementComplementFactV1[] = [];
  const build = (
    receiver: PersonContext,
    giver: PersonContext,
    direction: ElementComplementFactV1['direction'],
  ) => {
    if (!receiver.deficient) return;
    const deficient = receiver.deficient;
    const giverStrong = new Set<FiveElementIdV1>([
      ...(giver.excessive ?? []),
    ]);
    // 과다 판정이 없어도, 분포에서 25% 이상이면 "넉넉한" 오행으로 본다.
    if (giver.sajuShare) {
      for (const [element, share] of giver.sajuShare) {
        if (share >= 25) giverStrong.add(element);
      }
    }
    const filled = deficient.filter(element => giverStrong.has(element));
    facts.push({
      id: `compat.element-complement.${direction}`,
      kind: 'element_complement',
      domain: 'saju',
      method: 'spring-ts.couple-element-complement.v1',
      direction,
      deficient,
      filled,
      unmet: deficient.filter(element => !giverStrong.has(element)),
    });
  };
  build(b, a, 'a_fills_b');
  build(a, b, 'b_fills_a');
  return facts;
}

function elementComplementAxis(
  a: PersonContext,
  b: PersonContext,
  facts: readonly ElementComplementFactV1[],
): AxisDraft {
  if (facts.length === 0) {
    return {
      id: 'saju_element_complement',
      domain: 'saju',
      label: '오행 상호 보완',
      score: 0,
      availability: unavailable({ code: 'ELEMENT_BALANCE_MISSING' }),
      factRefs: [],
      headline: '오행 균형 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const paragraphs: string[] = [];
  const scores: number[] = [];
  for (const fact of facts) {
    const giver = fact.direction === 'a_fills_b' ? a : b;
    const receiver = fact.direction === 'a_fills_b' ? b : a;
    if (fact.deficient.length === 0) {
      scores.push(68);
      paragraphs.push(
        `${receiver.displayName}님의 사주는 오행이 크게 비지 않아, 상대가 채워 줄 몫 자체가 적은 자립형이에요.`,
      );
      continue;
    }
    const ratio = fact.filled.length / fact.deficient.length;
    scores.push(50 + 45 * ratio);
    if (fact.filled.length > 0) {
      paragraphs.push(
        `${receiver.displayName}님 사주에 부족한 ${listKo(fact.deficient.map(elementKo))} 기운 가운데 `
        + `${listKo(fact.filled.map(elementKo))}${fact.filled.length === fact.deficient.length ? ' 전부를' : '를'} `
        + `${giver.displayName}님이 넉넉하게 갖고 있어요. 곁에 있는 것만으로 빈 곳이 메워지는 조합이에요.`,
      );
    } else {
      paragraphs.push(
        `${receiver.displayName}님 사주에 부족한 ${listKo(fact.deficient.map(elementKo))} 기운은 `
        + `${giver.displayName}님 사주에서도 넉넉하지 않아, 이 부분은 서로 채워 주기 어려워요.`,
      );
    }
  }
  let score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const cautions: string[] = [];
  const sharedExcess = (a.excessive ?? []).filter(element =>
    (b.excessive ?? []).includes(element),
  );
  if (sharedExcess.length > 0) {
    score -= 6;
    cautions.push(
      `두 분 모두 ${listKo(sharedExcess.map(elementKo))} 기운이 넘치는 편이에요. 같은 기운이 겹치면 공감은 빠르지만 권태와 경쟁도 함께 자랄 수 있어, 서로 다른 취미 하나씩을 지켜 두면 좋아요.`,
    );
  }
  return {
    id: 'saju_element_complement',
    domain: 'saju',
    label: '오행 상호 보완',
    score,
    availability: facts.length === 2 ? READY : limited({ code: 'ELEMENT_BALANCE_MISSING' }),
    factRefs: facts.map(fact => fact.id),
    headline:
      score >= 75
        ? '서로의 빈 오행을 채워 주는 좋은 보완 관계예요.'
        : score >= 58
          ? '부분적으로 서로의 빈 곳을 채워 줘요.'
          : '오행 보완의 관점에서는 서로 채워 주기 어려운 짝이에요.',
    paragraphs,
    tips: [],
    cautions,
  };
}

function yinYangAxis(
  a: PersonContext,
  b: PersonContext,
  fact: YinYangPairFactV1,
  framing: CompatFramingV1,
): AxisDraft {
  if (fact.aDayPolarity === null || fact.bDayPolarity === null) {
    return {
      id: 'saju_yin_yang',
      domain: 'saju',
      label: '음양의 조화',
      score: 0,
      availability: unavailable({ code: 'YIN_YANG_MISSING' }),
      factRefs: [fact.id],
      headline: '음양 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  let score: number;
  const paragraphs: string[] = [];
  if (fact.dayComplement) {
    score = 74;
    paragraphs.push(
      `한 분은 양간, 한 분은 음간이에요. 드러내며 이끄는 힘과 머금으며 받치는 힘이 짝을 이뤄, `
      + (framing === 'couple'
        ? '명리에서 부부의 기본 조화로 치는 배열이에요.'
        : '명리에서 관계의 기본 조화로 치는 배열이에요.'),
    );
  } else {
    score = 58;
    const polarity = fact.aDayPolarity === 'YANG' ? '양간' : '음간';
    paragraphs.push(
      `두 분 모두 ${polarity}이에요. ${polarity === '양간' ? '둘 다 드러내고 이끄는 쪽이라 활기차지만, 양보의 순간을 정해 두면 좋아요.' : '둘 다 머금고 살피는 쪽이라 편안하지만, 먼저 나서는 역할을 번갈아 맡으면 좋아요.'}`,
    );
  }
  if (fact.chartComplement) {
    score += 8;
    paragraphs.push(
      '원국 전체로도 한 분은 양이, 한 분은 음이 우세해 서로의 밀도를 채워 줘요.',
    );
  } else if (fact.aDominant === 'EVEN' && fact.bDominant === 'EVEN') {
    score += 6;
    paragraphs.push('두 분 모두 원국의 음양이 고르게 갖춰져 있어, 어느 쪽으로도 치우치지 않는 잔잔한 균형이 있어요.');
  }
  return {
    id: 'saju_yin_yang',
    domain: 'saju',
    label: '음양의 조화',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline: fact.dayComplement
      ? '음과 양이 짝을 이루는 조화로운 배열이에요.'
      : '같은 극의 만남 — 닮아서 편하고, 닮아서 겹쳐요.',
    paragraphs,
    tips: [],
    cautions: [],
  };
}

function strengthAxis(
  a: PersonContext,
  b: PersonContext,
  fact: StrengthPairFactV1,
): AxisDraft {
  if (fact.pattern === 'unknown') {
    return {
      id: 'saju_strength',
      domain: 'saju',
      label: '기운 세기의 짝',
      score: 0,
      availability: unavailable({ code: 'STRENGTH_MISSING' }),
      factRefs: [fact.id],
      headline: '기운 세기 판단이 없어 이 축은 계산하지 않았어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  let score: number;
  let headline: string;
  const paragraphs: string[] = [];
  switch (fact.pattern) {
    case 'complementary':
      score = 78;
      headline = '미는 힘과 받는 힘이 서로를 채우는 짝이에요.';
      paragraphs.push(
        '한 분은 스스로 밀고 나가는 힘이 넉넉하고, 한 분은 주변을 받아들이는 힘이 좋은 쪽이에요. 신강한 쪽이 방향을 내고 신약한 쪽이 결을 다듬는, 명리에서 무난히 반기는 조합이에요.',
      );
      break;
    case 'balanced_pair':
      score = 72;
      headline = '둘 다 균형 잡힌 기운 — 잔잔하고 안정적인 짝이에요.';
      paragraphs.push('두 분 모두 기운의 세기가 중용에 가까워, 어느 한쪽이 기울지 않는 안정적인 관계를 만들기 쉬워요.');
      break;
    case 'balanced_mix':
      score = 68;
      headline = '한쪽의 균형이 다른 쪽의 치우침을 받아 주는 짝이에요.';
      paragraphs.push('한 분의 기운이 중용에 가까워, 다른 분의 강하거나 여린 기운을 무리 없이 받아 줄 수 있는 조합이에요.');
      break;
    case 'both_strong':
      score = 52;
      headline = '강한 기운끼리의 만남 — 활기차지만 양보가 숙제예요.';
      paragraphs.push(
        '두 분 모두 스스로 밀고 나가는 힘이 강해요. 함께 큰일을 도모하기엔 더없이 좋지만, 사소한 주도권에서 부딪히기 쉬워요. 영역을 나누는 것이 지혜예요.',
      );
      break;
    case 'both_weak':
    default:
      score = 56;
      headline = '섬세한 기운끼리의 만남 — 다정하지만 결정이 느려질 수 있어요.';
      paragraphs.push(
        '두 분 모두 주변의 도움이 힘이 되는 쪽이라 서로를 잘 헤아려요. 다만 큰 결정 앞에서 둘 다 미루기 쉬우니, 결정의 규칙을 미리 정해 두면 좋아요.',
      );
      break;
  }
  return {
    id: 'saju_strength',
    domain: 'saju',
    label: '기운 세기의 짝',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline,
    paragraphs,
    tips: [],
    cautions: [],
  };
}

/* ================================================================== */
/* 이름 축들                                                            */
/* ================================================================== */

function nameFlowAxis(
  a: PersonContext,
  b: PersonContext,
  fact: NameFlowFactV1 | null,
): AxisDraft {
  if (!fact || fact.totalPairs === 0) {
    return {
      id: 'name_flow',
      domain: 'name',
      label: '이름 소리(발음오행)의 흐름',
      score: 0,
      availability: unavailable({ code: 'NAME_ELEMENTS_MISSING' }),
      factRefs: fact ? [fact.id] : [],
      headline: '이름 오행 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const gen = fact.generatingPairs / fact.totalPairs;
  const ctrl = fact.controllingPairs / fact.totalPairs;
  const same = fact.comparablePairs / fact.totalPairs;
  const score = clamp(58 + 38 * gen - 30 * ctrl + 8 * same, 20, 95);
  const paragraphs: string[] = [
    `이름을 부르는 소리의 오행(발음오행)으로 읽어요. ${a.displayName}님 이름은 ${listKo(fact.aElements.map(el => ELEMENT_KO[el]))}, `
    + `${b.displayName}님 이름은 ${listKo(fact.bElements.map(el => ELEMENT_KO[el]))}의 소리 기운이에요. 글자끼리 짝지어 보면 `
    + `전체 ${fact.totalPairs}쌍 가운데 서로 살리는 상생이 ${fact.generatingPairs}쌍, 부딪히는 상극이 ${fact.controllingPairs}쌍, 같은 기운(비화)이 ${fact.comparablePairs}쌍이에요.`,
  ];
  if (gen >= 0.5) {
    paragraphs.push(
      fact.aGeneratesB > fact.bGeneratesA
        ? `두 이름을 나란히 부를 때 기운이 서로를 살리는 쪽으로 흘러요. 특히 ${a.displayName}님 이름이 ${b.displayName}님 이름을 살려 주는, "주는 인연"의 소리예요.`
        : fact.bGeneratesA > fact.aGeneratesB
          ? `두 이름을 나란히 부를 때 기운이 서로를 살리는 쪽으로 흘러요. 특히 ${b.displayName}님 이름이 ${a.displayName}님 이름을 살려 주는 소리라, ${a.displayName}님이 "받는 인연"이에요.`
          : '두 이름이 서로를 번갈아 살리는, 주고받음이 고른 상생의 소리예요 — 발음오행 궁합에서 으뜸으로 치는 흐름이에요.',
    );
  } else if (ctrl >= 0.5) {
    paragraphs.push('두 이름의 소리가 서로 누르는 쌍이 많은 편이에요. 이름의 어울림은 참고 신호일 뿐이니, 부르는 애칭을 부드럽게 두는 것도 성명학의 지혜예요.');
  } else {
    paragraphs.push('살리는 소리와 누르는 소리가 섞여 있는, 무난한 어울림이에요.');
  }
  return {
    id: 'name_flow',
    domain: 'name',
    label: '이름 소리(발음오행)의 흐름',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline:
      score >= 75
        ? '두 이름의 소리가 서로를 살리며 흘러요.'
        : score >= 55
          ? '두 이름의 소리가 무난하게 어우러져요.'
          : '두 이름의 소리가 서로 누르는 편 — 부드러운 호칭이 도움이 돼요.',
    paragraphs,
    tips: [],
    cautions: [],
  };
}

function nameElementComplementAxis(
  a: PersonContext,
  b: PersonContext,
  fact: NameElementComplementFactV1 | null,
): AxisDraft {
  if (!fact) {
    return {
      id: 'name_element_complement',
      domain: 'name',
      label: '두 이름의 오행 상보',
      score: 0,
      availability: unavailable({ code: 'NAME_ELEMENTS_MISSING' }),
      factRefs: [],
      headline: '이름 오행 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const score = clamp(40 + 11 * fact.combinedCoverage + 2 * Math.min(fact.mutualFill.length, 3), 0, 95);
  const paragraphs: string[] = [];
  paragraphs.push(
    `두 이름을 합치면 오행 다섯 가지 가운데 ${fact.combinedCoverage}가지가 갖춰져요.`
    + (fact.mutualFill.length > 0
      ? ` 특히 ${listKo(fact.mutualFill.map(elementKo))} 기운은 한쪽 이름에만 있어, 서로의 이름이 빈 기운을 채워 주는 셈이에요.`
      : ''),
  );
  if (fact.missingTogether.length > 0) {
    paragraphs.push(
      `두 이름 모두에 없는 기운은 ${listKo(fact.missingTogether.map(elementKo))}이에요. 함께 쓰는 물건이나 공간의 색으로 그 기운을 빌려 오는 것이 전통적인 보완법이에요.`,
    );
  }
  return {
    id: 'name_element_complement',
    domain: 'name',
    label: '두 이름의 오행 상보',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline:
      fact.combinedCoverage >= 4
        ? '두 이름이 모이면 오행이 고루 갖춰져요.'
        : fact.combinedCoverage >= 3
          ? '두 이름이 서로의 기운을 어느 정도 채워 줘요.'
          : '두 이름의 오행이 비슷한 쪽으로 몰려 있어요.',
    paragraphs,
    tips: [],
    cautions: [],
  };
}

function frameAxis(
  a: PersonContext,
  b: PersonContext,
  fact: FramePairFactV1 | null,
): AxisDraft {
  if (!fact || fact.a.length === 0 || fact.b.length === 0) {
    const reasons: CompatibilityReasonV1[] = [];
    if (!a.frames) reasons.push({ code: 'NAME_FRAMES_MISSING', person: 'a' });
    if (!b.frames) reasons.push({ code: 'NAME_FRAMES_MISSING', person: 'b' });
    return {
      id: 'name_frames',
      domain: 'name',
      label: '수리 기운 나란히 보기',
      score: 0,
      availability: unavailable(...(reasons.length > 0 ? reasons : [{ code: 'NAME_FRAMES_MISSING' as const }])),
      factRefs: fact ? [fact.id] : [],
      headline: '수리(획수) 정보가 없어 이 축은 계산하지 않았어요.',
      paragraphs: ['한자가 없는 순우리말 이름은 획수 수리를 셈하지 않아요.'],
      tips: [],
      cautions: [],
    };
  }
  const avg = (frames: FramePairFactV1['a']) =>
    frames.reduce((sum, frame) => sum + frame.luckyLevel, 0) / frames.length;
  const aRatio = avg(fact.a) / fact.luckyLevelMax;
  const bRatio = avg(fact.b) / fact.luckyLevelMax;
  const score = clamp(30 + 60 * ((aRatio + bRatio) / 2), 0, 95);
  const describe = (name: string, ratio: number) =>
    `${name}님 이름의 수리는 ${ratio >= 0.7 ? '길한 흐름이 뚜렷한' : ratio >= 0.45 ? '무난한' : '보완이 필요한'} 편`;
  return {
    id: 'name_frames',
    domain: 'name',
    label: '수리 기운 나란히 보기',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline: '수리는 합산하지 않고, 각자의 흐름을 나란히 읽어요.',
    paragraphs: [
      '수리(원형이정)는 이름마다 따로 흐르는 기운이라 둘을 합쳐 점수 내지 않아요. 대신 두 흐름이 나란히 갈 때의 모습을 읽어요.',
      `${describe(a.displayName, aRatio)}이고, ${describe(b.displayName, bRatio)}이에요. `
      + (aRatio >= 0.6 && bRatio >= 0.6
        ? '둘 다 흐름이 순해서 생활의 밑바탕이 잘 받쳐 줘요.'
        : Math.abs(aRatio - bRatio) >= 0.3
          ? '흐름의 높낮이가 달라, 잘 풀리는 쪽이 더딘 쪽을 기다려 주는 마음이 필요해요.'
          : '두 흐름이 비슷한 높이로 가서, 서로의 속도를 이해하기 쉬워요.'),
    ],
    tips: [],
    cautions: [],
  };
}

function namePolarityAxis(
  a: PersonContext,
  b: PersonContext,
  fact: NamePolarityPairFactV1 | null,
): AxisDraft {
  if (!fact) {
    return {
      id: 'name_polarity',
      domain: 'name',
      label: '이름 음양의 배열',
      score: 0,
      availability: unavailable({ code: 'NAME_POLARITY_MISSING' }),
      factRefs: [],
      headline: '이름 음양 정보를 확인하지 못했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const aMixed = fact.aYang > 0 && fact.aYin > 0;
  const bMixed = fact.bYang > 0 && fact.bYin > 0;
  const aUniform: 'YANG' | 'YIN' | null = aMixed ? null : fact.aYang > 0 ? 'YANG' : 'YIN';
  const bUniform: 'YANG' | 'YIN' | null = bMixed ? null : fact.bYang > 0 ? 'YANG' : 'YIN';
  let score: number;
  let sentence: string;
  if (aMixed && bMixed) {
    score = 76;
    sentence = '두 이름 모두 음과 양이 섞여 있어, 부를 때의 리듬이 서로 잘 맞물려요.';
  } else if (aMixed || bMixed) {
    score = 62;
    sentence = '한 이름은 음양이 섞여 있고 한 이름은 한쪽으로 쏠려 있어요. 섞인 쪽이 리듬을 받아 주는 모양새예요.';
  } else if (aUniform !== bUniform) {
    score = 66;
    sentence = '두 이름이 각각 음과 양으로 나뉘어, 이름끼리는 서로의 극을 채워 줘요.';
  } else {
    score = 48;
    sentence = `두 이름 모두 ${aUniform === 'YANG' ? '양' : '음'}으로 쏠려 있어, 부를 때의 기운이 한쪽으로 몰리는 편이에요.`;
  }
  return {
    id: 'name_polarity',
    domain: 'name',
    label: '이름 음양의 배열',
    score,
    availability: READY,
    factRefs: [fact.id],
    headline: score >= 70 ? '이름의 음양 리듬이 잘 맞물려요.' : score >= 55 ? '이름의 음양이 무난하게 어울려요.' : '이름의 음양이 한쪽으로 몰려 있어요.',
    paragraphs: [sentence],
    tips: [],
    cautions: [],
  };
}

/* ================================================================== */
/* 교차 축                                                              */
/* ================================================================== */

function nameToSajuCrossFacts(
  a: PersonContext,
  b: PersonContext,
): NameToSajuCrossFactV1[] {
  const facts: NameToSajuCrossFactV1[] = [];
  const build = (
    nameOwner: PersonContext,
    sajuOwner: PersonContext,
    direction: NameToSajuCrossFactV1['direction'],
  ) => {
    if (!nameOwner.nameElements || nameOwner.nameElements.length === 0) return;
    if (!sajuOwner.yongshin && !sajuOwner.gishin) return;
    const yongshin = sajuOwner.yongshin;
    const gishin = sajuOwner.gishin;
    facts.push({
      id: `compat.name-saju-cross.${direction}`,
      kind: 'name_to_saju_cross',
      domain: 'cross',
      method: 'spring-ts.couple-name-saju-cross.v1',
      direction,
      nameElements: nameOwner.nameElements,
      partnerYongshin: yongshin,
      partnerGishin: gishin,
      yongshinMatchCount: yongshin
        ? nameOwner.nameElements.filter(element => element === yongshin).length
        : 0,
      gishinMatchCount: gishin
        ? nameOwner.nameElements.filter(element => element === gishin).length
        : 0,
    });
  };
  build(a, b, 'a_name_to_b_saju');
  build(b, a, 'b_name_to_a_saju');
  return facts;
}

function crossAxis(
  a: PersonContext,
  b: PersonContext,
  facts: readonly NameToSajuCrossFactV1[],
): AxisDraft {
  if (facts.length === 0) {
    return {
      id: 'cross_name_saju',
      domain: 'cross',
      label: '이름이 상대 사주에 주는 기운',
      score: 0,
      availability: unavailable({ code: 'NAME_FACTS_MISSING' }),
      factRefs: [],
      headline: '이름과 사주를 교차해 볼 정보가 부족했어요.',
      paragraphs: [],
      tips: [],
      cautions: [],
    };
  }
  const paragraphs: string[] = [];
  const cautions: string[] = [];
  const scores: number[] = [];
  for (const fact of facts) {
    const nameOwner = fact.direction === 'a_name_to_b_saju' ? a : b;
    const sajuOwner = fact.direction === 'a_name_to_b_saju' ? b : a;
    const total = fact.nameElements.length;
    let score: number;
    if (fact.yongshinMatchCount > 0 && fact.partnerYongshin) {
      score = 80 + Math.min(8, 4 * (fact.yongshinMatchCount - 1));
      paragraphs.push(
        `${nameOwner.displayName}님 이름 ${total}글자 가운데 ${fact.yongshinMatchCount}글자가 `
        + `${sajuOwner.displayName}님 사주가 반기는 ${elementKo(fact.partnerYongshin)} 기운이에요. `
        + `이름을 불러 주는 것만으로 서로에게 힘이 되는 셈이에요.`,
      );
      if (fact.gishinMatchCount > 0 && fact.partnerGishin) {
        score -= 10;
        cautions.push(
          `${nameOwner.displayName}님 이름에는 ${sajuOwner.displayName}님이 조심스러워하는 ${ELEMENT_KO[fact.partnerGishin]} 기운 글자도 ${fact.gishinMatchCount}개 있어요.`,
        );
      }
    } else if (fact.gishinMatchCount > 0 && fact.partnerGishin) {
      score = 44;
      paragraphs.push(
        `${nameOwner.displayName}님 이름에는 ${sajuOwner.displayName}님이 조심스러워하는 ${elementKo(fact.partnerGishin)} 기운 글자가 ${fact.gishinMatchCount}개 있어요. `
        + `이름의 영향은 은은한 수준이니 걱정할 일은 아니지만, 참고할 지점이에요.`,
      );
    } else {
      score = 58;
      paragraphs.push(
        `${nameOwner.displayName}님 이름의 기운은 ${sajuOwner.displayName}님의 용신·기신 어느 쪽에도 직접 닿지 않는 담백한 관계예요.`,
      );
    }
    scores.push(score);
  }
  const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return {
    id: 'cross_name_saju',
    domain: 'cross',
    label: '이름이 상대 사주에 주는 기운',
    score,
    availability: facts.length === 2 ? READY : limited({ code: 'NAME_FACTS_MISSING' }),
    factRefs: facts.map(fact => fact.id),
    headline:
      score >= 75
        ? '서로의 이름이 서로의 사주를 살려 주는, 드물게 좋은 교차예요.'
        : score >= 55
          ? '이름과 사주의 교차는 무난한 편이에요.'
          : '이름의 기운이 상대 사주와 결이 다른 편이에요.',
    paragraphs,
    tips: [],
    cautions,
  };
}

/* ================================================================== */
/* 합산                                                                 */
/* ================================================================== */

/**
 * 축별 기본 가중치. 실무 관행(일지 > 일간 > 용신·오행 > 보조 > 띠)을 따른다.
 * 이름 도메인은 발음오행 흐름이 중심이고, 수리는 커플 궁합의 정통 실무가
 * 아니어서 낮은 비중으로만 참고한다.
 */
const AXIS_BASE_WEIGHTS: Record<CompatibilityAxisIdV1, number> = {
  saju_day_stem: 0.2,
  saju_day_branch: 0.26,
  saju_year_branch: 0.05,
  saju_ten_god: 0.1,
  saju_yongshin_cross: 0.15,
  saju_element_complement: 0.12,
  saju_yin_yang: 0.05,
  saju_strength: 0.07,
  name_flow: 0.5,
  name_element_complement: 0.2,
  name_frames: 0.15,
  name_polarity: 0.15,
  cross_name_saju: 1,
};

const DOMAIN_WEIGHTS: Record<CompatibilityDomainV1, number> = {
  saju: 0.55,
  name: 0.3,
  cross: 0.15,
};

interface DomainAggregate {
  score: number | null;
  axes: CompatibilityAxisV1[];
}

function aggregateDomain(
  drafts: readonly AxisDraft[],
  domain: CompatibilityDomainV1,
): DomainAggregate {
  const domainDrafts = drafts.filter(draft => draft.domain === domain);
  const usable = domainDrafts.filter(draft => draft.availability.status !== 'unavailable');
  const totalBase = usable.reduce(
    (sum, draft) => sum + AXIS_BASE_WEIGHTS[draft.id],
    0,
  );
  const axes = domainDrafts.map(draft => {
    const weight =
      draft.availability.status === 'unavailable' || totalBase === 0
        ? 0
        : AXIS_BASE_WEIGHTS[draft.id] / totalBase;
    return finishAxis(draft, Math.round(weight * 1000) / 1000);
  });
  if (usable.length === 0 || totalBase === 0) return { score: null, axes };
  const score = axes.reduce((sum, axis) => sum + axis.score * axis.weight, 0);
  return { score, axes };
}

function summarize(
  domainLabel: string,
  score: number | null,
  axes: readonly CompatibilityAxisV1[],
  weightsNote: string,
  reasons: readonly CompatibilityReasonV1[],
): CompatibilitySummaryV1 {
  if (score === null) {
    return {
      score: 0,
      grade: 'balanced',
      headline: `${domainLabel} 궁합을 계산할 정보가 부족했어요.`,
      paragraphs: [],
      cautions: [],
      weightsNote,
      availability: { status: 'unavailable', reasons },
    };
  }
  const rounded = Math.round(score);
  const grade = gradeOf(rounded);
  const usable = axes.filter(axis => axis.availability.status !== 'unavailable');
  const best = [...usable].sort((left, right) => right.score - left.score)[0] ?? null;
  const worst = [...usable].sort((left, right) => left.score - right.score)[0] ?? null;
  const paragraphs: string[] = [];
  const yeyo = (label: string) => (hasBatchim(label.replace(/[^가-힣]/gu, '')) ? '이에요' : '예요');
  if (best && best.score >= 70) {
    paragraphs.push(`가장 빛나는 대목은 「${best.label}」${yeyo(best.label)}. ${best.headline}`);
  }
  if (worst && worst.score < 55 && worst !== best) {
    paragraphs.push(`함께 살펴 둘 대목은 「${worst.label}」${yeyo(worst.label)}. ${worst.headline}`);
  }
  const cautions = usable
    .filter(axis => axis.grade === 'watch' || axis.grade === 'challenging')
    .flatMap(axis => axis.cautions.slice(0, 1));
  return {
    score: rounded,
    grade,
    headline: headlineForGrade(domainLabel, grade),
    paragraphs,
    cautions,
    weightsNote,
    availability:
      reasons.length > 0 ? { status: 'limited', reasons } : { status: 'ready', reasons: [] },
  };
}

function headlineForGrade(domainLabel: string, grade: CompatibilityGradeV1): string {
  switch (grade) {
    case 'excellent':
      return `${domainLabel}에서 서로의 빈 곳을 채워 주는, 보기 드물게 잘 맞는 짝이에요.`;
    case 'good':
      return `${domainLabel}의 결이 잘 맞아, 서로에게 힘이 되는 조합이에요.`;
    case 'balanced':
      return `${domainLabel}은 무난히 어울리는 편 — 서로 다른 결을 이해하는 만큼 깊어져요.`;
    case 'watch':
      return `${domainLabel}에 끌림과 긴장이 함께 있어요 — 완급 조절이 관계의 열쇠예요.`;
    case 'challenging':
      return `${domainLabel}의 기운이 부딪히기 쉬운 짝이지만, 그 다름이 배움이 되기도 해요.`;
  }
}

/* ================================================================== */
/* 메인 빌더                                                            */
/* ================================================================== */

export function buildCoupleCompatibilityV1(
  request: CoupleCompatibilityRequestV1,
): CoupleCompatibilityV1 {
  const a = buildPersonContext('a', request.a);
  const b = buildPersonContext('b', request.b);

  // 짝의 맥락(관계·나이)을 먼저 정한다 — 모든 카피의 프레임이 여기서 갈린다.
  // context fact는 CompatibilityFactV1 합집합이 아니므로 facts[]에는 싣지 않는다.
  const contextFact = derivePairContext(request);
  const framing = contextFact.framing;

  // 카피의 목소리: 프레임 + (guardian 서사용) 나이 위·아래의 표시명.
  const voice: CopyVoiceV1 = {
    framing,
    elderName:
      contextFact.olderPerson === 'a'
        ? a.displayName
        : contextFact.olderPerson === 'b'
          ? b.displayName
          : null,
    youngerName:
      contextFact.olderPerson === 'a'
        ? b.displayName
        : contextFact.olderPerson === 'b'
          ? a.displayName
          : null,
  };

  const facts: CompatibilityFactV1[] = [];

  /* --- 간지 쌍 facts --- */
  let dayStemPair: StemPairFactV1 | null = null;
  let dayBranchPair: BranchPairFactV1 | null = null;
  let yearBranchPair: BranchPairFactV1 | null = null;

  for (const aPos of PILLAR_ORDER) {
    for (const bPos of PILLAR_ORDER) {
      const aPillar = a.pillars[aPos];
      const bPillar = b.pillars[bPos];
      if (!aPillar || !bPillar) continue;
      const isDayDay = aPos === 'day' && bPos === 'day';
      const isYearYear = aPos === 'year' && bPos === 'year';
      if (aPillar.stem && bPillar.stem) {
        const stemFact = buildStemPairFact(
          `compat.stem-pair.${aPos}-${bPos}`,
          aPos,
          bPos,
          aPillar.stem,
          bPillar.stem,
        );
        // 일간 쌍은 항상 싣고, 그 외 기둥은 합·충일 때만 신호로 싣는다.
        if (isDayDay) {
          dayStemPair = stemFact;
          facts.push(stemFact);
        } else if (stemFact.relation === 'hap' || stemFact.relation === 'chung') {
          facts.push(stemFact);
        }
      }
      if (aPillar.branch && bPillar.branch) {
        const branchFact = buildBranchPairFact(
          `compat.branch-pair.${aPos}-${bPos}`,
          aPos,
          bPos,
          aPillar.branch,
          bPillar.branch,
        );
        if (isDayDay) {
          dayBranchPair = branchFact;
          facts.push(branchFact);
        } else if (isYearYear) {
          yearBranchPair = branchFact;
          facts.push(branchFact);
        } else if (branchFact.relations.length > 0) {
          facts.push(branchFact);
        }
      }
    }
  }

  /* --- 상보/교차 facts --- */
  const yongshinFacts = yongshinCrossFacts(a, b);
  facts.push(...yongshinFacts);

  const complementFacts = elementComplementFacts(a, b);
  facts.push(...complementFacts);

  const yinYangFact: YinYangPairFactV1 = {
    id: 'compat.yin-yang-pair',
    kind: 'yin_yang_pair',
    domain: 'saju',
    method: 'spring-ts.couple-yin-yang-pair.v1',
    aDayPolarity: a.dayStem?.polarity ?? null,
    bDayPolarity: b.dayStem?.polarity ?? null,
    aDominant: a.yinYangDominant,
    bDominant: b.yinYangDominant,
    dayComplement:
      a.dayStem && b.dayStem ? a.dayStem.polarity !== b.dayStem.polarity : null,
    chartComplement:
      a.yinYangDominant && b.yinYangDominant
        ? (a.yinYangDominant === 'YANG' && b.yinYangDominant === 'YIN')
          || (a.yinYangDominant === 'YIN' && b.yinYangDominant === 'YANG')
        : null,
  };
  facts.push(yinYangFact);

  const strengthFact: StrengthPairFactV1 = (() => {
    const aCode = a.strengthCode ?? 'UNKNOWN';
    const bCode = b.strengthCode ?? 'UNKNOWN';
    let pattern: StrengthPairFactV1['pattern'];
    if (aCode === 'UNKNOWN' || bCode === 'UNKNOWN') pattern = 'unknown';
    else if (
      (aCode === 'STRONG' && bCode === 'WEAK')
      || (aCode === 'WEAK' && bCode === 'STRONG')
    ) pattern = 'complementary';
    else if (aCode === 'STRONG' && bCode === 'STRONG') pattern = 'both_strong';
    else if (aCode === 'WEAK' && bCode === 'WEAK') pattern = 'both_weak';
    else if (aCode === 'BALANCED' && bCode === 'BALANCED') pattern = 'balanced_pair';
    else pattern = 'balanced_mix';
    return {
      id: 'compat.strength-pair',
      kind: 'strength_pair' as const,
      domain: 'saju' as const,
      method: 'spring-ts.couple-strength-pair.v1',
      a: aCode,
      b: bCode,
      pattern,
    };
  })();
  facts.push(strengthFact);

  /* --- 이름 facts --- */
  let nameFlowFact: NameFlowFactV1 | null = null;
  let nameComplementFact: NameElementComplementFactV1 | null = null;
  if (
    a.namePhoneticElements && b.namePhoneticElements
    && a.namePhoneticElements.length > 0 && b.namePhoneticElements.length > 0
  ) {
    let generating = 0;
    let aGeneratesB = 0;
    let bGeneratesA = 0;
    let controlling = 0;
    let comparable = 0;
    for (const aElement of a.namePhoneticElements) {
      for (const bElement of b.namePhoneticElements) {
        const relation = elementRelation(aElement, bElement);
        if (relation === 'same') comparable += 1;
        else if (relation === 'generates') { generating += 1; aGeneratesB += 1; }
        else if (relation === 'generated') { generating += 1; bGeneratesA += 1; }
        else controlling += 1;
      }
    }
    nameFlowFact = {
      id: 'compat.name-flow',
      kind: 'name_flow',
      domain: 'name',
      method: 'spring-ts.couple-name-flow.v1',
      basis: 'phonetic_initial_mainstream',
      aElements: a.namePhoneticElements,
      bElements: b.namePhoneticElements,
      generatingPairs: generating,
      aGeneratesB,
      bGeneratesA,
      controllingPairs: controlling,
      comparablePairs: comparable,
      totalPairs: a.namePhoneticElements.length * b.namePhoneticElements.length,
    };
    facts.push(nameFlowFact);
  }
  if (a.nameElements && b.nameElements && a.nameElements.length > 0 && b.nameElements.length > 0) {
    const combined = new Set<FiveElementIdV1>([...a.nameElements, ...b.nameElements]);
    const aSet = new Set(a.nameElements);
    const bSet = new Set(b.nameElements);
    const ALL_ELEMENTS: FiveElementIdV1[] = ['wood', 'fire', 'earth', 'metal', 'water'];
    nameComplementFact = {
      id: 'compat.name-element-complement',
      kind: 'name_element_complement',
      domain: 'name',
      method: 'spring-ts.couple-name-element-complement.v1',
      aElements: a.nameElements,
      bElements: b.nameElements,
      combinedCoverage: combined.size,
      mutualFill: ALL_ELEMENTS.filter(
        element => (aSet.has(element) && !bSet.has(element)) || (!aSet.has(element) && bSet.has(element)),
      ),
      missingTogether: ALL_ELEMENTS.filter(element => !combined.has(element)),
    };
    facts.push(nameComplementFact);
  }

  let framePairFact: FramePairFactV1 | null = null;
  if (a.frames && b.frames && a.frames.length > 0 && b.frames.length > 0) {
    framePairFact = {
      id: 'compat.frame-pair',
      kind: 'frame_pair',
      domain: 'name',
      method: 'spring-ts.couple-frame-pair.v1',
      a: a.frames,
      b: b.frames,
      luckyLevelMax: 25,
    };
    facts.push(framePairFact);
  }

  let namePolarityFact: NamePolarityPairFactV1 | null = null;
  if (a.namePolarity && b.namePolarity) {
    namePolarityFact = {
      id: 'compat.name-polarity-pair',
      kind: 'name_polarity_pair',
      domain: 'name',
      method: 'spring-ts.couple-name-polarity-pair.v1',
      aYang: a.namePolarity.yang,
      aYin: a.namePolarity.yin,
      bYang: b.namePolarity.yang,
      bYin: b.namePolarity.yin,
    };
    facts.push(namePolarityFact);
  }

  const crossFacts = nameToSajuCrossFacts(a, b);
  facts.push(...crossFacts);

  /* --- 축 --- */
  const drafts: AxisDraft[] = [
    dayStemAxis(a, b, dayStemPair, voice),
    dayBranchAxis(a, b, dayBranchPair, voice),
    yearBranchAxis(a, b, yearBranchPair, voice),
    tenGodAxis(a, b, dayStemPair, voice),
    yongshinAxis(a, b, yongshinFacts, voice),
    elementComplementAxis(a, b, complementFacts),
    yinYangAxis(a, b, yinYangFact, framing),
    strengthAxis(a, b, strengthFact),
    nameFlowAxis(a, b, nameFlowFact),
    nameElementComplementAxis(a, b, nameComplementFact),
    frameAxis(a, b, framePairFact),
    namePolarityAxis(a, b, namePolarityFact),
    crossAxis(a, b, crossFacts),
  ];

  const sajuAggregate = aggregateDomain(drafts, 'saju');
  const nameAggregate = aggregateDomain(drafts, 'name');
  const crossAggregate = aggregateDomain(drafts, 'cross');
  const axes = [...sajuAggregate.axes, ...nameAggregate.axes, ...crossAggregate.axes];

  /* --- 통합 점수: 가용한 도메인만 재정규화 --- */
  const domainScores: [CompatibilityDomainV1, number | null][] = [
    ['saju', sajuAggregate.score],
    ['name', nameAggregate.score],
    ['cross', crossAggregate.score],
  ];
  const usableDomains = domainScores.filter(([, score]) => score !== null) as [
    CompatibilityDomainV1,
    number,
  ][];
  const domainTotal = usableDomains.reduce((sum, [domain]) => sum + DOMAIN_WEIGHTS[domain], 0);
  const integratedScore =
    usableDomains.length === 0 || domainTotal === 0
      ? null
      : usableDomains.reduce(
          (sum, [domain, score]) => sum + score * (DOMAIN_WEIGHTS[domain] / domainTotal),
          0,
        );

  /* --- 가용성 사유 수집 --- */
  const collectReasons = (domain: CompatibilityDomainV1 | null): CompatibilityReasonV1[] => {
    const seen = new Set<string>();
    const reasons: CompatibilityReasonV1[] = [];
    for (const axis of axes) {
      if (domain && axis.domain !== domain) continue;
      for (const reason of axis.availability.reasons) {
        const key = `${reason.code}:${reason.person ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        reasons.push(reason);
      }
    }
    return reasons;
  };

  const sajuWeightsNote =
    `사주 궁합은 ${framing === 'couple' ? '일지(배우자궁)' : '일지(속마음 자리)'} 26%·일간 20%·용신 교차 15%·오행 보완 12%·십성 10%·기운 세기 7%·음양 5%·띠 5%의 가중 평균이에요. 계산할 수 없는 축은 빼고 나머지를 같은 비율로 다시 나눠요.`;
  const nameWeightsNote =
    '이름 궁합은 발음오행 흐름 50%·오행 상보 20%·수리 나란히 보기 15%·음양 배열 15%의 가중 평균이에요. 수리를 합산하는 이름 궁합은 민속 놀이에 가까워, 여기서는 각자의 흐름을 나란히 읽는 방식만 써요.';
  const integratedWeightsNote =
    '통합 점수는 사주 55%·이름 30%·이름↔사주 교차 15%의 가중 평균이에요. 축별 가중치와 근거는 각 축 카드에서 그대로 확인할 수 있어요.';

  const sajuSummary = summarize(
    '사주 궁합',
    sajuAggregate.score,
    sajuAggregate.axes,
    sajuWeightsNote,
    collectReasons('saju'),
  );
  const nameSummary = summarize(
    '이름 궁합',
    nameAggregate.score,
    nameAggregate.axes,
    nameWeightsNote,
    collectReasons('name'),
  );
  const integratedSummary = summarize(
    '두 분의 인연',
    integratedScore,
    axes,
    integratedWeightsNote,
    collectReasons(null),
  );

  const echo = (person: PersonContext): CompatibilityPersonEchoV1 => ({
    displayName: person.displayName,
    fullHangul: person.fullHangul,
    fullHanja: person.fullHanja,
    dayStem: person.dayStem,
    dayBranch: person.dayBranch,
    strengthLevelCode: person.strengthCode,
    yongshinElement: person.yongshin,
    gender: person.gender,
    analysisId: person.analysisId,
    sajuElements: person.sajuElementsEcho,
  });

  const overallReasons = collectReasons(null);

  // 맥락 읽기: 년지 쌍의 관계(삼합·충 등)를 나이 속설과 대조해 문장을 만든다.
  const contextNotes = buildContextNotes(
    contextFact,
    a.displayName,
    b.displayName,
    yearBranchPair?.relations ?? null,
  );

  return {
    schemaVersion: COUPLE_COMPATIBILITY_SCHEMA_V1,
    persons: { a: echo(a), b: echo(b) },
    context: { fact: contextFact, notes: contextNotes },
    availability:
      integratedScore === null
        ? { status: 'unavailable', reasons: overallReasons }
        : overallReasons.length > 0
          ? { status: 'limited', reasons: overallReasons }
          : { status: 'ready', reasons: [] },
    facts,
    axes,
    sections: {
      integrated: {
        summary: integratedSummary,
        axisIds: [
          'saju_day_stem',
          'saju_day_branch',
          'saju_yongshin_cross',
          'cross_name_saju',
        ],
      } satisfies CoupleCompatibilitySectionV1,
      saju: {
        summary: sajuSummary,
        axisIds: [
          'saju_day_stem',
          'saju_day_branch',
          'saju_year_branch',
          'saju_ten_god',
          'saju_yongshin_cross',
          'saju_element_complement',
          'saju_yin_yang',
          'saju_strength',
        ],
      },
      name: {
        summary: nameSummary,
        axisIds: ['name_flow', 'name_element_complement', 'name_frames', 'name_polarity'],
      },
    },
    provenance: {
      engine: 'spring-ts',
      method: COUPLE_COMPATIBILITY_SCHEMA_V1,
      computation: 'derived-from-two-person-deliveries',
      inputs: { aAnalysisId: a.analysisId, bAnalysisId: b.analysisId },
      axisBaseWeights: AXIS_BASE_WEIGHTS,
      domainWeights: DOMAIN_WEIGHTS,
    },
  };
}
