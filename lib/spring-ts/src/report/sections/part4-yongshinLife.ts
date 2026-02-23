/**
 * part4-yongshinLife.ts
 *
 * PART 4: 용신/희신/기신을 실제 생활 루틴으로 연결하는 실전 섹션
 * - 공부/일, 인간관계, 환경/공간, 루틴 4개 도메인 고정 제공
 * - 용신 데이터가 희박해도 보수적 추정으로 섹션 생성
 */

import type {
  ElementCode,
  ReportHighlight,
  ReportInput,
  ReportParagraph,
  ReportSection,
  ReportTable,
} from '../types.js';

import {
  ELEMENT_CONTROLLED_BY,
  ELEMENT_GENERATED_BY,
} from '../common/elementMaps.js';

import {
  caution,
  emphasis,
  encouraging,
  narrative,
  tip,
} from '../common/sentenceUtils.js';

const ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const ELEMENT_LABEL: Record<ElementCode, string> = {
  WOOD: '목(木)',
  FIRE: '화(火)',
  EARTH: '토(土)',
  METAL: '금(金)',
  WATER: '수(水)',
};

type DomainKey = 'studyWork' | 'relationship' | 'space' | 'routine';

interface DomainAdvice {
  readonly studyWork: string;
  readonly relationship: string;
  readonly space: string;
  readonly routine: string;
}

interface ResolvedRoles {
  readonly yongshin: ElementCode | null;
  readonly heeshin: ElementCode | null;
  readonly gishin: ElementCode | null;
  readonly basis: 'direct' | 'dayMasterFallback' | 'distributionFallback' | 'conservativeFallback';
}

const BOOST_ADVICE: Record<ElementCode, DomainAdvice> = {
  WOOD: {
    studyWork: '큰 목표를 3단계로 쪼개서 체크리스트로 움직여요.',
    relationship: '먼저 따뜻한 한마디를 건네며 대화를 시작해요.',
    space: '책상에 초록 포인트나 작은 식물을 두어요.',
    routine: '아침에 가벼운 스트레칭 5분으로 몸을 깨워요.',
  },
  FIRE: {
    studyWork: '배운 내용을 소리 내어 설명하며 이해를 굳혀요.',
    relationship: '고마운 마음을 바로 표현해 관계 온도를 올려요.',
    space: '밝고 따뜻한 조명을 켜서 집중 에너지를 올려요.',
    routine: '낮에 햇빛 10분을 챙겨 생기를 채워요.',
  },
  EARTH: {
    studyWork: '같은 시간, 같은 자리에서 꾸준히 반복해요.',
    relationship: '상대 말을 끝까지 듣고 차분히 답해요.',
    space: '책상 위를 단순하게 정리해 안정감을 만들어요.',
    routine: '하루 시작과 끝에 5분 정리 시간을 고정해요.',
  },
  METAL: {
    studyWork: '기준을 정하고 정확한 마감 순서로 처리해요.',
    relationship: '짧고 분명한 표현으로 오해를 줄여요.',
    space: '불필요한 물건을 치우고 공기를 자주 환기해요.',
    routine: '잠들기 전에 내일 할 일 3줄을 적어요.',
  },
  WATER: {
    studyWork: '20분 집중 + 5분 휴식 리듬으로 꾸준히 가요.',
    relationship: '감정을 급히 말하기보다 한 번 정리하고 전달해요.',
    space: '조용한 자리와 물 한 컵으로 차분한 집중존을 만들어요.',
    routine: '저녁에 호흡 3분 또는 조용한 독서 시간을 가져요.',
  },
};

const BRAKE_ADVICE: Record<ElementCode, DomainAdvice> = {
  WOOD: {
    studyWork: '동시에 여러 일을 벌리지 말고 한 번에 한 가지만 해요.',
    relationship: '내 말만 밀어붙이지 말고 상대 속도를 맞춰요.',
    space: '자료를 과하게 펼치지 말고 오늘 쓸 것만 꺼내요.',
    routine: '시작 루틴은 1개만 고정해 과열을 막아요.',
  },
  FIRE: {
    studyWork: '흥분해서 속도만 내지 말고 검토 1회를 꼭 넣어요.',
    relationship: '목소리가 커지면 10초 숨 고르기를 먼저 해요.',
    space: '너무 밝고 시끄러운 환경은 잠시 톤을 낮춰요.',
    routine: '밤 늦은 각성 활동을 줄여 수면 리듬을 지켜요.',
  },
  EARTH: {
    studyWork: '걱정만 하며 멈추지 말고 5분 시작 버튼을 눌러요.',
    relationship: '눈치만 보며 참기보다 필요한 말은 부드럽게 해요.',
    space: '정리만 하다 끝나지 않게 행동 구역을 따로 두어요.',
    routine: '지키기 어려운 긴 계획 대신 짧은 루틴 1개만 유지해요.',
  },
  METAL: {
    studyWork: '완벽주의 100점 대신 80점 완성 후 수정으로 가요.',
    relationship: '정답만 말하려 하지 말고 공감 문장도 함께 써요.',
    space: '규칙을 너무 빡빡하게 만들지 말고 여유 칸을 둬요.',
    routine: '체크리스트를 과하게 늘리지 말고 핵심 3개만 남겨요.',
  },
  WATER: {
    studyWork: '생각만 길어지면 타이머를 켜고 바로 손부터 움직여요.',
    relationship: '혼자 속으로만 삼키지 말고 짧게라도 표현해요.',
    space: '너무 어둡고 조용한 곳에 오래 머물지 말고 가끔 자리 바꿔요.',
    routine: '미루는 신호가 오면 3분 행동으로 흐름을 다시 켜요.',
  },
};

const CONSERVATIVE_BOOST: Record<DomainKey, string> = {
  studyWork: '한 번에 한 가지, 짧게 시작하고 끝까지 마무리해요.',
  relationship: '부드러운 말 한마디와 경청 하나를 먼저 실천해요.',
  space: '오늘 쓰는 물건만 남기고 책상 한 칸을 정리해요.',
  routine: '아침/저녁 1개씩 작은 고정 루틴을 유지해요.',
};

const CONSERVATIVE_BRAKE: Record<DomainKey, string> = {
  studyWork: '과속, 완벽주의, 미루기 중 하나만 골라 줄여요.',
  relationship: '감정이 커질 때는 잠깐 멈추고 짧게 다시 말해요.',
  space: '환경을 한 번에 바꾸지 말고 작은 구역부터 고쳐요.',
  routine: '지키기 어려운 계획은 줄이고 꾸준함을 우선해요.',
};

const MISSION_BY_ELEMENT: Record<ElementCode, Record<DomainKey, string>> = {
  WOOD: {
    studyWork: '할 일 1개를 3단계로 쪼개서 체크하기.',
    relationship: '먼저 응원 한마디 보내기.',
    space: '책상에 초록 포인트 1개 두기.',
    routine: '아침 스트레칭 5분 하기.',
  },
  FIRE: {
    studyWork: '오늘 배운 내용 1개 소리 내어 설명하기.',
    relationship: '고마운 마음 1번 말하기.',
    space: '집중 자리 조명 밝기 조정하기.',
    routine: '낮 햇빛 10분 챙기기.',
  },
  EARTH: {
    studyWork: '같은 자리에서 20분 집중 1회 하기.',
    relationship: '대화에서 끼어들지 않고 끝까지 듣기.',
    space: '책상 한 칸 정리하고 시작하기.',
    routine: '하루 마무리 5분 정리하기.',
  },
  METAL: {
    studyWork: '해야 할 일 3개만 적고 순서대로 끝내기.',
    relationship: '요청을 짧고 정확하게 말하기.',
    space: '불필요한 물건 3개 치우기.',
    routine: '자기 전 내일 계획 3줄 적기.',
  },
  WATER: {
    studyWork: '20분 집중 + 5분 쉬기 1세트 실행하기.',
    relationship: '감정 문장 1개 차분히 전달하기.',
    space: '물 한 컵 준비하고 조용한 자리 앉기.',
    routine: '호흡 3분 하고 잠들기.',
  },
};

const CONSERVATIVE_MISSION: Record<DomainKey, string> = {
  studyWork: '15분 타이머로 할 일 1개 시작하기.',
  relationship: '고맙거나 미안한 말 1번 전하기.',
  space: '책상 위 한 칸만 비우기.',
  routine: '아침 또는 저녁 루틴 1개 지키기.',
};

function safeName(input: ReportInput): string {
  const trimmed = input.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '우리 친구';
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeElement(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper === 'WOOD') return 'WOOD';
  if (upper === 'FIRE') return 'FIRE';
  if (upper === 'EARTH') return 'EARTH';
  if (upper === 'METAL') return 'METAL';
  if (upper === 'WATER') return 'WATER';

  if (raw.includes('목') || raw.includes('木')) return 'WOOD';
  if (raw.includes('화') || raw.includes('火')) return 'FIRE';
  if (raw.includes('토') || raw.includes('土')) return 'EARTH';
  if (raw.includes('금') || raw.includes('金')) return 'METAL';
  if (raw.includes('수') || raw.includes('水')) return 'WATER';
  return null;
}

function extractRecommendationElements(raw: unknown): ElementCode[] {
  if (!Array.isArray(raw)) return [];

  const out: ElementCode[] = [];
  for (const item of raw) {
    const row = toRecord(item);
    if (!row) continue;

    const primary = normalizeElement(row['primaryElement']);
    const secondary = normalizeElement(row['secondaryElement']);
    if (primary && !out.includes(primary)) out.push(primary);
    if (secondary && !out.includes(secondary)) out.push(secondary);
  }
  return out;
}

function readDistribution(raw: unknown): Partial<Record<ElementCode, number>> {
  const obj = toRecord(raw);
  if (!obj) return {};

  const result: Partial<Record<ElementCode, number>> = {};
  for (const [key, value] of Object.entries(obj)) {
    const element = normalizeElement(key);
    const score = toFiniteNumber(value);
    if (!element || score == null) continue;
    result[element] = Math.max(0, score);
  }
  return result;
}

function distributionTotal(dist: Partial<Record<ElementCode, number>>): number {
  return ELEMENTS.reduce((sum, el) => sum + Math.max(0, dist[el] ?? 0), 0);
}

function extractDistribution(input: ReportInput): Partial<Record<ElementCode, number>> {
  const root = toRecord(input.saju.elementDistribution as unknown);
  const candidates: unknown[] = [
    root?.['total'],
    root?.['overall'],
    root?.['distribution'],
    input.saju.elementDistribution,
  ];

  for (const candidate of candidates) {
    const parsed = readDistribution(candidate);
    if (distributionTotal(parsed) > 0) return parsed;
  }

  const heaven = readDistribution(root?.['heaven']);
  const hidden = readDistribution(root?.['hidden']);
  if (distributionTotal(heaven) > 0 || distributionTotal(hidden) > 0) {
    const merged: Partial<Record<ElementCode, number>> = {};
    for (const el of ELEMENTS) {
      const value = Math.max(0, heaven[el] ?? 0) + Math.max(0, hidden[el] ?? 0);
      if (value > 0) merged[el] = value;
    }
    return merged;
  }

  return {};
}

function resolveFromDistribution(
  dist: Partial<Record<ElementCode, number>>,
): Pick<ResolvedRoles, 'yongshin' | 'heeshin' | 'gishin'> {
  if (distributionTotal(dist) <= 0) {
    return { yongshin: null, heeshin: null, gishin: null };
  }

  const sorted = ELEMENTS
    .map((el) => ({ element: el, value: dist[el] ?? 0 }))
    .sort((a, b) => a.value - b.value);

  const yongshin = sorted[0]?.element ?? null;
  const heeshin = sorted[1]?.element ?? (yongshin ? ELEMENT_GENERATED_BY[yongshin] : null);
  const gishin = sorted[sorted.length - 1]?.element ?? (yongshin ? ELEMENT_CONTROLLED_BY[yongshin] : null);
  return { yongshin, heeshin, gishin };
}

function makeDistinctRoles(
  yongshin: ElementCode | null,
  heeshin: ElementCode | null,
  gishin: ElementCode | null,
): Pick<ResolvedRoles, 'heeshin' | 'gishin'> {
  const used = new Set<ElementCode>();
  if (yongshin) used.add(yongshin);

  let hee = heeshin;
  if (hee && used.has(hee)) hee = null;
  if (!hee && yongshin) {
    const candidate = ELEMENT_GENERATED_BY[yongshin];
    if (!used.has(candidate)) hee = candidate;
  }
  if (hee) used.add(hee);

  let gi = gishin;
  if (gi && used.has(gi)) gi = null;
  if (!gi && yongshin) {
    const candidate = ELEMENT_CONTROLLED_BY[yongshin];
    if (!used.has(candidate)) gi = candidate;
  }

  return { heeshin: hee, gishin: gi };
}

function resolveRoles(input: ReportInput): ResolvedRoles {
  const yongRoot = toRecord(input.saju.yongshin as unknown);

  let yongshin = normalizeElement(input.saju.yongshin?.element)
    ?? normalizeElement(yongRoot?.['finalYongshin']);
  let heeshin = normalizeElement(input.saju.yongshin?.heeshin)
    ?? normalizeElement(yongRoot?.['finalHeesin'])
    ?? normalizeElement(yongRoot?.['heesin']);
  let gishin = normalizeElement(input.saju.yongshin?.gishin)
    ?? normalizeElement(yongRoot?.['gisin'])
    ?? normalizeElement(yongRoot?.['gishin']);

  const recommendationElements = extractRecommendationElements(
    yongRoot?.['recommendations'] ?? input.saju.yongshin?.recommendations,
  );
  if (!yongshin) yongshin = recommendationElements[0] ?? null;
  if (!heeshin) heeshin = recommendationElements.find((el) => el !== yongshin) ?? null;

  if (yongshin) {
    const normalized = makeDistinctRoles(yongshin, heeshin, gishin);
    return {
      yongshin,
      heeshin: normalized.heeshin,
      gishin: normalized.gishin,
      basis: 'direct',
    };
  }

  const dayMaster = normalizeElement(input.saju.dayMaster?.element);
  if (dayMaster) {
    const fallbackYongshin = ELEMENT_GENERATED_BY[dayMaster];
    const normalized = makeDistinctRoles(
      fallbackYongshin,
      dayMaster,
      ELEMENT_CONTROLLED_BY[fallbackYongshin],
    );
    return {
      yongshin: fallbackYongshin,
      heeshin: normalized.heeshin,
      gishin: normalized.gishin,
      basis: 'dayMasterFallback',
    };
  }

  const byDistribution = resolveFromDistribution(extractDistribution(input));
  if (byDistribution.yongshin) {
    const normalized = makeDistinctRoles(
      byDistribution.yongshin,
      byDistribution.heeshin,
      byDistribution.gishin,
    );
    return {
      yongshin: byDistribution.yongshin,
      heeshin: normalized.heeshin,
      gishin: normalized.gishin,
      basis: 'distributionFallback',
    };
  }

  return {
    yongshin: null,
    heeshin: null,
    gishin: null,
    basis: 'conservativeFallback',
  };
}

function roleText(element: ElementCode | null): string {
  return element ? ELEMENT_LABEL[element] : '미확정';
}

function boostText(domain: DomainKey, yongshin: ElementCode | null, heeshin: ElementCode | null): string {
  const parts: string[] = [];
  if (yongshin) {
    parts.push(`용신 ${ELEMENT_LABEL[yongshin]}: ${BOOST_ADVICE[yongshin][domain]}`);
  }
  if (heeshin && heeshin !== yongshin) {
    parts.push(`희신 ${ELEMENT_LABEL[heeshin]}: ${BOOST_ADVICE[heeshin][domain]}`);
  }
  return parts.length > 0 ? parts.join(' / ') : CONSERVATIVE_BOOST[domain];
}

function brakeText(domain: DomainKey, gishin: ElementCode | null): string {
  if (!gishin) return CONSERVATIVE_BRAKE[domain];
  return `기신 ${ELEMENT_LABEL[gishin]} 과열 주의: ${BRAKE_ADVICE[gishin][domain]}`;
}

function missionText(domain: DomainKey, yongshin: ElementCode | null): string {
  if (!yongshin) return CONSERVATIVE_MISSION[domain];
  return MISSION_BY_ELEMENT[yongshin][domain];
}

function basisGuideText(basis: ResolvedRoles['basis']): string {
  if (basis === 'dayMasterFallback') {
    return '용신 원본값이 약해 일간 기준으로 안전 추정했어요.';
  }
  if (basis === 'distributionFallback') {
    return '용신 원본값이 약해 오행 분포로 보수 추정했어요.';
  }
  if (basis === 'conservativeFallback') {
    return '데이터가 적어 기본 균형 루틴 중심으로 안내해요.';
  }
  return '용신 데이터가 비교적 선명해요.';
}

export function generateYongshinLifeSection(input: ReportInput): ReportSection | null {
  const name = safeName(input);
  const roles = resolveRoles(input);

  const paragraphs: ReportParagraph[] = [];
  paragraphs.push(narrative(
    `${name}의 하루를 게임처럼 보면, 용신은 파워업 버튼이고 희신은 도와주는 팀원, 기신은 과열 경고등이에요.`,
  ));
  paragraphs.push(emphasis(
    `이번 생활 가이드의 중심은 용신 ${roleText(roles.yongshin)}, 희신 ${roleText(roles.heeshin)}, 기신 ${roleText(roles.gishin)}이에요.`,
    roles.yongshin ?? undefined,
  ));
  paragraphs.push(tip(
    '아래 표는 공부/일, 인간관계, 환경/공간, 루틴 네 칸으로 정리했어요. 하루에 한 칸만 실천해도 충분해요.',
    roles.yongshin ?? undefined,
  ));

  if (roles.basis !== 'direct') {
    paragraphs.push(caution(
      `${basisGuideText(roles.basis)} 그래서 강한 단정 대신, 작은 습관으로 천천히 맞춰 보는 안전 모드예요.`,
      roles.gishin ?? undefined,
    ));
  }

  paragraphs.push(encouraging('완벽하게 하려다 멈추지 말고, 오늘 한 가지 미션만 해도 운의 흐름은 좋아져요.'));

  const rows: string[][] = [
    [
      '공부/일',
      boostText('studyWork', roles.yongshin, roles.heeshin),
      brakeText('studyWork', roles.gishin),
      missionText('studyWork', roles.yongshin),
    ],
    [
      '인간관계',
      boostText('relationship', roles.yongshin, roles.heeshin),
      brakeText('relationship', roles.gishin),
      missionText('relationship', roles.yongshin),
    ],
    [
      '환경/공간',
      boostText('space', roles.yongshin, roles.heeshin),
      brakeText('space', roles.gishin),
      missionText('space', roles.yongshin),
    ],
    [
      '루틴',
      boostText('routine', roles.yongshin, roles.heeshin),
      brakeText('routine', roles.gishin),
      missionText('routine', roles.yongshin),
    ],
  ];

  const tables: ReportTable[] = [
    {
      title: '용신 4칸 생활 실천표',
      headers: ['분야', '용신·희신 활용', '기신 브레이크', '오늘 한 가지'],
      rows,
    },
  ];

  const highlights: ReportHighlight[] = [
    {
      label: '주인공 용신',
      value: roleText(roles.yongshin),
      element: roles.yongshin ?? undefined,
      sentiment: roles.yongshin ? 'good' : 'neutral',
    },
    {
      label: '응원 희신',
      value: roleText(roles.heeshin),
      element: roles.heeshin ?? undefined,
      sentiment: roles.heeshin ? 'good' : 'neutral',
    },
    {
      label: '브레이크 기신',
      value: roles.gishin
        ? `${roleText(roles.gishin)} 과열만 조심`
        : '과속·완벽주의·미루기만 먼저 줄이기',
      element: roles.gishin ?? undefined,
      sentiment: 'caution',
    },
    {
      label: '오늘의 첫 미션',
      value: missionText('routine', roles.yongshin),
      sentiment: 'neutral',
    },
  ];

  return {
    id: 'yongshinLife',
    title: '용신 생활 가이드',
    subtitle: '공부/일, 인간관계, 환경/공간, 루틴 실전 안내',
    paragraphs,
    tables,
    highlights,
  };
}
