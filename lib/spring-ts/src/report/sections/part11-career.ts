/**
 * part11-career.ts
 *
 * PART 11: 진로/직업 실전 가이드
 * - 일간(오행), 신강/신약, 십성 경향을 함께 반영
 * - 직업 스타일 + 공부 스타일을 실무형 문장으로 제시
 * - 데이터가 부족해도 기본 가이드를 제공
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
  caution,
  emphasis,
  encouraging,
  narrative,
  tip,
} from '../common/sentenceUtils.js';

const ELEMENT_CODES: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

type StrengthBand = 'strong' | 'balanced' | 'weak';
type TenGodCategory = 'friend' | 'output' | 'wealth' | 'authority' | 'resource';
type TenGodTendency = TenGodCategory | 'unknown';

type TenGodSource = 'scores' | 'analysis' | 'fallback';

interface CareerGuide {
  readonly summary: string;
  readonly workStyle: string;
  readonly studyStyle: string;
  readonly quickAction: string;
}

interface TenGodTendencyInfo {
  readonly tendency: TenGodTendency;
  readonly score: number;
  readonly source: TenGodSource;
}

type TenGodCounts = Record<TenGodCategory, number>;

const ELEMENT_LABEL: Record<ElementCode, string> = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
};

const ELEMENT_GUIDE: Record<ElementCode, CareerGuide> = {
  WOOD: {
    summary: '확장형. 시작과 기획이 빠르고, 새 프로젝트를 열 때 강점이 큽니다.',
    workStyle: '기획, 서비스 개선, 초기 세팅 역할에서 속도가 납니다.',
    studyStyle: '목표를 주간 단위로 쪼개고 진도 체크를 자주 하면 효율이 좋습니다.',
    quickAction: '오늘 할 일 3개를 먼저 쓰고, 쉬운 1개부터 바로 시작하세요.',
  },
  FIRE: {
    summary: '표현형. 사람 앞에서 설명하고 분위기를 이끄는 힘이 좋습니다.',
    workStyle: '브랜딩, 발표, 영업, 커뮤니케이션 중심 업무에서 성과가 빠릅니다.',
    studyStyle: '혼자 읽기보다 말로 설명하거나 문제 풀이를 소리 내어 정리해 보세요.',
    quickAction: '공부한 내용을 5줄 요약해 메신저 메모나 노트에 바로 남기세요.',
  },
  EARTH: {
    summary: '안정형. 운영, 관리, 누적 성과를 만드는 일에 강합니다.',
    workStyle: '운영관리, 일정관리, 품질 점검 같은 실무에서 신뢰를 얻습니다.',
    studyStyle: '정해진 루틴을 반복할수록 누적 점수가 오르는 타입입니다.',
    quickAction: '매일 같은 시간에 25분 집중 2세트부터 고정하세요.',
  },
  METAL: {
    summary: '정밀형. 분석, 기준 수립, 품질 판단에 강점이 있습니다.',
    workStyle: '데이터 분석, 법무/품질, 리스크 점검 역할이 잘 맞습니다.',
    studyStyle: '핵심 개념 정의를 먼저 잡고 문제를 통해 검증하는 방식이 효율적입니다.',
    quickAction: '핵심 개념 10개만 정리한 뒤, 관련 문제를 바로 5개 풀어보세요.',
  },
  WATER: {
    summary: '탐구형. 정보 수집과 깊이 있는 이해, 장기 전략에 강합니다.',
    workStyle: '리서치, 전략기획, 데이터/지식 기반 업무와 궁합이 좋습니다.',
    studyStyle: '긴 호흡으로 누적 학습할 때 성과가 커집니다. 복습 주기를 꼭 고정하세요.',
    quickAction: '오늘 배운 내용 중 헷갈린 1개를 찾아 10분 추가 복습하세요.',
  },
};

const STRENGTH_GUIDE: Record<StrengthBand, CareerGuide> = {
  strong: {
    summary: '신강 경향. 추진력은 충분하니 방향 관리가 핵심입니다.',
    workStyle: '의사결정이 빠른 역할에서 강합니다. 다만 독주를 막기 위해 검토 파트를 붙이세요.',
    studyStyle: '새로운 것만 쫓기보다 복습과 오답 정리를 루틴에 고정해야 점수가 안정됩니다.',
    quickAction: '중요 의사결정 전에 검토 체크리스트 3개를 반드시 확인하세요.',
  },
  balanced: {
    summary: '균형 경향. 협업과 실행의 균형이 좋아 지속 성과를 만들기 좋습니다.',
    workStyle: '기획-실행-정리 단계를 고르게 맡을 때 강점이 드러납니다.',
    studyStyle: '예습 20%, 문제풀이 50%, 복습 30% 배분이 잘 맞습니다.',
    quickAction: '하루 루틴을 고정하고, 완료 체크를 통해 리듬을 유지하세요.',
  },
  weak: {
    summary: '신약 경향. 체력·집중력 관리와 지원 환경 세팅이 성과의 핵심입니다.',
    workStyle: '단독 돌파보다 협업 구조, 명확한 역할 분리에서 실력이 안정됩니다.',
    studyStyle: '짧고 자주(20~30분) 학습하고, 어려운 과목은 멘토/스터디 도움을 붙이세요.',
    quickAction: '작은 목표 1개만 정하고, 완료 후 다음 목표로 넘어가세요.',
  },
};

const TEN_GOD_TO_CATEGORY: Record<string, TenGodCategory> = {
  BI_GYEON: 'friend',
  GEOB_JAE: 'friend',
  SIK_SHIN: 'output',
  SANG_GWAN: 'output',
  PYEON_JAE: 'wealth',
  JEONG_JAE: 'wealth',
  PYEON_GWAN: 'authority',
  JEONG_GWAN: 'authority',
  PYEON_IN: 'resource',
  JEONG_IN: 'resource',
};

const TEN_GOD_LABEL: Record<TenGodCategory, string> = {
  friend: '비겁(관계/주도)',
  output: '식상(표현/기획)',
  wealth: '재성(성과/실무)',
  authority: '관성(관리/책임)',
  resource: '인성(연구/학습)',
};

const TEN_GOD_GUIDE: Record<TenGodCategory, CareerGuide> = {
  friend: {
    summary: '사람과의 연결, 팀 플레이, 리더십 발휘에서 성과가 납니다.',
    workStyle: '영업, 커뮤니티, 팀 리딩, 파트너십 업무가 잘 맞습니다.',
    studyStyle: '스터디/질문형 학습에서 집중이 잘 되고 이해가 빠릅니다.',
    quickAction: '이번 주 1회 이상 스터디 또는 멘토 피드백 시간을 잡으세요.',
  },
  output: {
    summary: '아이디어를 결과물로 바꾸는 힘이 좋습니다.',
    workStyle: '기획, 콘텐츠, 개발, 디자인처럼 결과물을 만드는 업무가 잘 맞습니다.',
    studyStyle: '인풋만 하지 말고 반드시 요약/문제풀이/발표로 아웃풋을 만드세요.',
    quickAction: '오늘 학습 내용을 1페이지 결과물로 정리해 남기세요.',
  },
  wealth: {
    summary: '성과 지향이 뚜렷하고 실무 감각이 좋습니다.',
    workStyle: '영업관리, 운영, 재무, PM처럼 목표와 숫자가 있는 일이 맞습니다.',
    studyStyle: '점수/자격증/실적 같은 명확한 목표를 두면 추진력이 크게 올라갑니다.',
    quickAction: '월간 목표를 수치로 1개만 정하고 매주 진행률을 기록하세요.',
  },
  authority: {
    summary: '규칙, 책임, 기준을 세우는 역할에 강합니다.',
    workStyle: '관리직, 기획조정, 품질/컴플라이언스, 공공/행정 업무와 궁합이 좋습니다.',
    studyStyle: '커리큘럼을 정해 순서대로 끝내는 방식이 가장 효율적입니다.',
    quickAction: '학습 순서를 체크리스트로 만들고 순서대로 완료하세요.',
  },
  resource: {
    summary: '깊이 있는 이해와 축적형 성장에 강합니다.',
    workStyle: '연구, 데이터, 분석, 교육, 상담처럼 지식 기반 분야가 잘 맞습니다.',
    studyStyle: '개념 정리 -> 예제 적용 -> 복습의 3단 루프를 고정하면 강합니다.',
    quickAction: '복습 주기를 1일/3일/7일로 잡아 반복 학습하세요.',
  },
};

const UNKNOWN_TEN_GOD_GUIDE: CareerGuide = {
  summary: '십성 데이터가 부족해 기본 전략으로 안내합니다.',
  workStyle: '강점이 보이는 과제부터 시작하고, 주간 회고로 맞는 업무를 좁혀가세요.',
  studyStyle: '기본기는 루틴으로, 약한 과목은 피드백을 받아 빠르게 보완하세요.',
  quickAction: '한 주에 1번, 잘한 일/어려운 일/다음 실험을 각각 1개씩 기록하세요.',
};

function safeName(input: ReportInput): string {
  const trimmed = input.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '사용자';
}

function isElementCode(value: unknown): value is ElementCode {
  return typeof value === 'string' && (ELEMENT_CODES as readonly string[]).includes(value);
}

function parseElement(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const upper = trimmed.toUpperCase();
  if (isElementCode(upper)) return upper;

  const alias: Record<string, ElementCode> = {
    목: 'WOOD',
    木: 'WOOD',
    화: 'FIRE',
    火: 'FIRE',
    토: 'EARTH',
    土: 'EARTH',
    금: 'METAL',
    金: 'METAL',
    수: 'WATER',
    水: 'WATER',
  };

  return alias[trimmed] ?? null;
}

function elementLabel(element: ElementCode | null): string {
  if (!element) return '정보 부족';
  return ELEMENT_LABEL[element] ?? element;
}

function detectStrengthBand(input: ReportInput): StrengthBand {
  const strength = input.saju?.strength;
  if (!strength) return 'balanced';

  const level = typeof strength.level === 'string' ? strength.level.toUpperCase() : '';
  if (level.includes('EXTREME_STRONG') || level === 'STRONG') return 'strong';
  if (level.includes('EXTREME_WEAK') || level === 'WEAK') return 'weak';
  if (level === 'BALANCED') return 'balanced';

  const support = typeof strength.totalSupport === 'number' && Number.isFinite(strength.totalSupport)
    ? strength.totalSupport
    : 0;
  const oppose = typeof strength.totalOppose === 'number' && Number.isFinite(strength.totalOppose)
    ? strength.totalOppose
    : 0;

  if (support > oppose + 0.3) return 'strong';
  if (oppose > support + 0.3) return 'weak';

  if (typeof strength.isStrong === 'boolean') {
    return strength.isStrong ? 'strong' : 'weak';
  }

  return 'balanced';
}

function strengthLabel(strength: StrengthBand): string {
  if (strength === 'strong') return '신강 경향';
  if (strength === 'weak') return '신약 경향';
  return '균형 경향';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function createEmptyTenGodCounts(): TenGodCounts {
  return {
    friend: 0,
    output: 0,
    wealth: 0,
    authority: 0,
    resource: 0,
  };
}

function addTenGodScore(counts: TenGodCounts, tenGodCode: unknown, score: number): boolean {
  if (typeof tenGodCode !== 'string') return false;
  if (!Number.isFinite(score) || score <= 0) return false;

  const category = TEN_GOD_TO_CATEGORY[tenGodCode];
  if (!category) return false;

  counts[category] += score;
  return true;
}

function pickTopTenGodTendency(counts: TenGodCounts): { tendency: TenGodTendency; score: number } {
  const priority: readonly TenGodCategory[] = ['output', 'wealth', 'authority', 'resource', 'friend'];

  let best: TenGodCategory | null = null;
  let bestScore = 0;

  for (const key of priority) {
    const score = counts[key];
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }

  if (!best || bestScore <= 0) {
    return { tendency: 'unknown', score: 0 };
  }

  return { tendency: best, score: bestScore };
}

function collectTenGodFromScoresPath(input: ReportInput, counts: TenGodCounts): boolean {
  const saju = input.saju as Record<string, unknown>;
  const scores = asRecord(saju['scores']);
  const pillars = asRecord(scores?.['pillars']);
  const tenGodScores = asRecord(pillars?.['tenGods']);
  if (!tenGodScores) return false;

  let touched = false;
  for (const [code, raw] of Object.entries(tenGodScores)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      touched = addTenGodScore(counts, code, Math.max(0, raw)) || touched;
    }
  }
  return touched;
}

function collectTenGodFromAnalysisPath(input: ReportInput, counts: TenGodCounts): boolean {
  const analysis = input.saju.tenGodAnalysis;
  if (!analysis) return false;

  let touched = false;
  for (const position of Object.values(analysis.byPosition)) {
    touched = addTenGodScore(counts, position.cheonganTenGod, 1) || touched;
    touched = addTenGodScore(counts, position.jijiPrincipalTenGod, 1) || touched;

    for (const hidden of position.hiddenStemTenGod ?? []) {
      touched = addTenGodScore(counts, hidden.tenGod, 0.5) || touched;
    }
  }

  return touched;
}

function detectTenGodTendency(input: ReportInput): TenGodTendencyInfo {
  const counts = createEmptyTenGodCounts();

  if (collectTenGodFromScoresPath(input, counts)) {
    const top = pickTopTenGodTendency(counts);
    return {
      tendency: top.tendency,
      score: top.score,
      source: top.tendency === 'unknown' ? 'fallback' : 'scores',
    };
  }

  if (collectTenGodFromAnalysisPath(input, counts)) {
    const top = pickTopTenGodTendency(counts);
    return {
      tendency: top.tendency,
      score: top.score,
      source: top.tendency === 'unknown' ? 'fallback' : 'analysis',
    };
  }

  return { tendency: 'unknown', score: 0, source: 'fallback' };
}

function tenGodLabel(tendency: TenGodTendency): string {
  if (tendency === 'unknown') return '정보 부족';
  return TEN_GOD_LABEL[tendency] ?? tendency;
}

function buildTable(
  dayMasterGuide: CareerGuide,
  strengthGuide: CareerGuide,
  tenGodGuide: CareerGuide,
): ReportTable {
  return {
    title: '진로/학습 실전 가이드',
    headers: ['분석 축', '핵심 해석', '일할 때', '공부할 때', '바로 실천'],
    rows: [
      ['일간(기본 성향)', dayMasterGuide.summary, dayMasterGuide.workStyle, dayMasterGuide.studyStyle, dayMasterGuide.quickAction],
      ['신강/신약(에너지)', strengthGuide.summary, strengthGuide.workStyle, strengthGuide.studyStyle, strengthGuide.quickAction],
      ['십성 경향(행동 패턴)', tenGodGuide.summary, tenGodGuide.workStyle, tenGodGuide.studyStyle, tenGodGuide.quickAction],
    ],
  };
}

export function generateCareerSection(input: ReportInput): ReportSection | null {
  const name = safeName(input);

  const dayMaster = parseElement(input.saju?.dayMaster?.element);
  const dayMasterGuide = dayMaster ? ELEMENT_GUIDE[dayMaster] : {
    summary: '일간 데이터가 부족해 기본 성향 전략으로 안내합니다.',
    workStyle: '직무를 고를 때 나의 강점 과제(잘되는 일)부터 우선 배치하세요.',
    studyStyle: '기본기는 루틴으로 고정하고, 약점 과목은 짧게 반복해 보완하세요.',
    quickAction: '이번 주에 잘한 과제 1개와 어려운 과제 1개를 기록해 비교하세요.',
  };

  const strengthBand = detectStrengthBand(input);
  const strengthGuide = STRENGTH_GUIDE[strengthBand];

  const tenGodInfo = detectTenGodTendency(input);
  const tenGodGuide = tenGodInfo.tendency === 'unknown'
    ? UNKNOWN_TEN_GOD_GUIDE
    : TEN_GOD_GUIDE[tenGodInfo.tendency];

  const dayMasterText = elementLabel(dayMaster);
  const strengthText = strengthLabel(strengthBand);
  const tenGodText = tenGodLabel(tenGodInfo.tendency);

  const hasFallback = !dayMaster || tenGodInfo.tendency === 'unknown';

  const paragraphs: ReportParagraph[] = [
    narrative(
      `${name}님의 진로 방향을 일간(${dayMasterText}), 강약(${strengthText}), 십성(${tenGodText}) 기준으로 정리했습니다. `
      + '복잡한 해석보다 바로 적용할 수 있는 방식으로 안내합니다.',
    ),
    emphasis(
      `핵심 전략: ${dayMasterGuide.workStyle} `
      + `${strengthGuide.workStyle} `
      + `${tenGodGuide.workStyle}`,
    ),
    tip(
      `학습 전략: ${dayMasterGuide.studyStyle} `
      + `${strengthGuide.studyStyle} `
      + `${tenGodGuide.studyStyle}`,
    ),
  ];

  if (hasFallback) {
    paragraphs.push(
      caution(
        '일부 세부 데이터가 부족해 기본 안전 전략을 사용했습니다. '
        + '그래도 직무 선택, 학습 루틴, 실행 습관에 바로 쓸 수 있는 기준으로 구성했습니다.',
      ),
    );
  }

  paragraphs.push(
    encouraging(
      '한 번에 크게 바꾸지 말고, 표에서 마음에 드는 “바로 실천” 1개만 2주간 유지해 보세요. '
      + '진로 방향과 공부 효율이 훨씬 선명해집니다.',
    ),
  );

  const table = buildTable(dayMasterGuide, strengthGuide, tenGodGuide);

  const highlights: ReportHighlight[] = [
    {
      label: '일간 포인트',
      value: dayMaster ? `${dayMasterText}형 성향` : '일간 정보 부족(기본 전략 적용)',
      element: dayMaster ?? undefined,
      sentiment: dayMaster ? 'good' : 'caution',
    },
    {
      label: '강약 포인트',
      value: strengthText,
      sentiment: strengthBand === 'balanced' ? 'good' : 'neutral',
    },
    {
      label: '십성 경향',
      value: tenGodText,
      sentiment: tenGodInfo.tendency === 'unknown' ? 'caution' : 'neutral',
    },
    {
      label: '이번 주 실천',
      value: `${dayMasterGuide.quickAction} / ${strengthGuide.quickAction}`,
      sentiment: 'good',
    },
  ];

  if (tenGodInfo.tendency !== 'unknown') {
    highlights.push({
      label: '십성 데이터 출처',
      value: tenGodInfo.source === 'scores' ? '점수 기반 분석' : '포지션 기반 분석',
      sentiment: 'neutral',
    });
  }

  return {
    id: 'career',
    title: '진로/직업 가이드',
    subtitle: '일간 + 강약 + 십성으로 보는 실전 커리어 전략',
    paragraphs,
    tables: [table],
    highlights,
  };
}
