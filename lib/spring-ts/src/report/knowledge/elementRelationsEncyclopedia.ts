import type { ElementCode } from '../types.js';

export type ElementDirectRelation = 'generates' | 'controls';

export type ElementPairRelation = ElementDirectRelation | 'same' | 'generated_by' | 'controlled_by';

export interface ElementRelationEntry {
  readonly from: ElementCode;
  readonly to: ElementCode;
  readonly relation: ElementDirectRelation;
  readonly relationKorean: '상생' | '상극';
  readonly easyExplanation: string;
  readonly practicalUseCases: readonly string[];
  readonly cautionNotes: readonly string[];
}

export interface ElementSameRelationNote {
  readonly relation: 'same';
  readonly relationKorean: '동행';
  readonly easyExplanation: string;
  readonly practicalUseCases: readonly string[];
  readonly cautionNotes: readonly string[];
}

export type ElementPolarityNoteCode = 'same_polarity' | 'opposite_polarity';

export interface ElementPolarityNote {
  readonly code: ElementPolarityNoteCode;
  readonly title: string;
  readonly easyExplanation: string;
  readonly practicalUseCases: readonly string[];
  readonly cautionNotes: readonly string[];
}

export interface ElementPairDescription {
  readonly from: ElementCode;
  readonly to: ElementCode;
  readonly relation: ElementPairRelation;
  readonly relationKorean: '동행' | '상생' | '생받음' | '상극' | '제어받음';
  readonly easyExplanation: string;
  readonly practicalUseCases: readonly string[];
  readonly cautionNotes: readonly string[];
  readonly sameNote: ElementSameRelationNote | null;
  readonly polarityNotes: readonly ElementPolarityNote[];
}

export const ELEMENT_LABEL_KOREAN: Record<ElementCode, string> = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
};

export const generates: Record<ElementCode, ElementRelationEntry> = {
  WOOD: {
    from: 'WOOD',
    to: 'FIRE',
    relation: 'generates',
    relationKorean: '상생',
    easyExplanation: '목이 화를 돕는 구조입니다. 아이디어와 준비(목)가 추진력과 표현력(화)으로 점화됩니다.',
    practicalUseCases: [
      '기획 문서와 문제 정의를 먼저 정리한 뒤 발표나 영업을 진행하면 설득력이 올라갑니다.',
      '관계에서 경청과 배려를 먼저 쌓으면 감정 표현과 친밀감이 자연스럽게 살아납니다.',
      '학습에서 기초 개념을 충분히 이해한 다음 실전 문제를 풀면 성과가 안정적으로 올라갑니다.',
    ],
    cautionNotes: [
      '목이 과도하게 화를 돕기만 하면 정작 본인의 체력이 소모되어 번아웃이 빨라집니다.',
      '준비만 길어지고 실행 시점을 놓치면 상생이 아니라 지연으로 바뀔 수 있습니다.',
      '감정 에너지가 과열되기 쉬우므로 휴식과 속도 조절 장치를 같이 두는 것이 좋습니다.',
    ],
  },
  FIRE: {
    from: 'FIRE',
    to: 'EARTH',
    relation: 'generates',
    relationKorean: '상생',
    easyExplanation: '화가 토를 돕는 구조입니다. 열정과 노출(화)이 신뢰, 기반, 성과 정착(토)으로 이어집니다.',
    practicalUseCases: [
      '캠페인이나 발표 후 반드시 회고 문서와 운영 프로세스를 남기면 결과가 자산이 됩니다.',
      '팀 분위기를 끌어올린 다음 역할과 책임을 명확히 정하면 조직 안정성이 높아집니다.',
      '새로운 시도를 한 뒤 반복 가능한 루틴으로 고정하면 지속 가능한 성장으로 연결됩니다.',
    ],
    cautionNotes: [
      '주목도만 높이고 정리 단계를 생략하면 금방 성과가 사라집니다.',
      '과열된 열정이 타인을 압박하면 신뢰 기반이 약해질 수 있습니다.',
      '성과를 빠르게 내려고 무리하면 체력과 관계 비용이 동시에 커질 수 있습니다.',
    ],
  },
  EARTH: {
    from: 'EARTH',
    to: 'METAL',
    relation: 'generates',
    relationKorean: '상생',
    easyExplanation: '토가 금을 돕는 구조입니다. 꾸준한 축적과 운영(토)이 기준, 품질, 결과물 완성도(금)를 만듭니다.',
    practicalUseCases: [
      '반복 업무를 표준화하면 품질 편차가 줄고 팀의 산출물이 더 정교해집니다.',
      '기본기를 충분히 쌓은 뒤 자격증, 포트폴리오, 문서화로 성과를 형태화할 수 있습니다.',
      '루틴 기반의 건강 관리가 집중력과 의사결정 정확도를 안정적으로 끌어올립니다.',
    ],
    cautionNotes: [
      '절차를 너무 강조하면 속도가 떨어지고 기회 대응이 늦어질 수 있습니다.',
      '세부 통제에 과몰입하면 유연성이 줄어 협업 피로가 커질 수 있습니다.',
      '축적만 하고 공개/검증을 미루면 실질 성과로 인정받기 어렵습니다.',
    ],
  },
  METAL: {
    from: 'METAL',
    to: 'WATER',
    relation: 'generates',
    relationKorean: '상생',
    easyExplanation: '금이 수를 돕는 구조입니다. 분석과 정리(금)가 통찰, 전략, 흐름 설계(수)를 만들어냅니다.',
    practicalUseCases: [
      '데이터를 구조화해 보면 시장/사용자 흐름을 읽는 전략적 인사이트가 선명해집니다.',
      '리뷰 기준을 명확히 두면 창의 아이디어도 실행 가능한 계획으로 정제됩니다.',
      '복잡한 문제를 분류한 뒤 우선순위를 정하면 리스크 대응이 훨씬 빨라집니다.',
    ],
    cautionNotes: [
      '분석이 과해지면 행동이 멈추고 결정 피로가 누적될 수 있습니다.',
      '정답 지향이 강해지면 다양한 가능성을 조기에 차단할 수 있습니다.',
      '차가운 피드백만 반복하면 팀 사기가 떨어질 수 있습니다.',
    ],
  },
  WATER: {
    from: 'WATER',
    to: 'WOOD',
    relation: 'generates',
    relationKorean: '상생',
    easyExplanation: '수가 목을 돕는 구조입니다. 정보, 회복, 유연성(수)이 성장, 확장, 기획력(목)을 키웁니다.',
    practicalUseCases: [
      '충분한 휴식과 리서치 시간을 확보하면 다음 실행 기획의 품질이 눈에 띄게 좋아집니다.',
      '멘토링과 피드백 루프를 운영하면 신규 인력이 빠르게 성장합니다.',
      '시장 변화 관찰을 꾸준히 하면 새로운 기회를 선제적으로 잡을 수 있습니다.',
    ],
    cautionNotes: [
      '정보 수집만 지속하면 실행력이 떨어져 의사결정이 지연될 수 있습니다.',
      '감정 공감에 과몰입하면 본인 경계가 약해져 에너지 소모가 커질 수 있습니다.',
      '유연성만 강조하면 기준이 흐려져 방향성이 약해질 수 있습니다.',
    ],
  },
};

export const controls: Record<ElementCode, ElementRelationEntry> = {
  WOOD: {
    from: 'WOOD',
    to: 'EARTH',
    relation: 'controls',
    relationKorean: '상극',
    easyExplanation: '목이 토를 제어하는 구조입니다. 확장성과 실행 의지(목)로 정체와 과중함(토)을 깨웁니다.',
    practicalUseCases: [
      '관성화된 업무에 실험 과제를 넣어 팀의 정체를 풀어낼 수 있습니다.',
      '몸이 무거울 때 가벼운 유산소나 스트레칭으로 루틴을 다시 가동할 수 있습니다.',
      '장기 프로젝트에서 의사결정 시한을 설정해 과도한 숙고를 끊어낼 수 있습니다.',
    ],
    cautionNotes: [
      '변화를 강하게 밀어붙이면 기존 체계를 지키는 사람과 충돌이 커질 수 있습니다.',
      '속도만 올리면 준비 부족으로 실수가 누적될 수 있습니다.',
      '기존 기반을 무시하면 단기 성과 뒤에 운영 리스크가 크게 남을 수 있습니다.',
    ],
  },
  FIRE: {
    from: 'FIRE',
    to: 'METAL',
    relation: 'controls',
    relationKorean: '상극',
    easyExplanation: '화가 금을 제어하는 구조입니다. 열정과 온기(화)로 지나친 경직성과 냉정함(금)을 누그러뜨립니다.',
    practicalUseCases: [
      '딱딱한 협업 분위기에 공감 대화를 먼저 열어 피드백 수용도를 높일 수 있습니다.',
      '규정 중심 회의에 사용자 스토리를 넣어 의사결정 균형을 맞출 수 있습니다.',
      '세부 오류 집착이 심할 때 우선 출시 가능한 최소 기준을 정해 진도를 낼 수 있습니다.',
    ],
    cautionNotes: [
      '감정적 설득이 과해지면 객관성과 품질 기준이 흔들릴 수 있습니다.',
      '속도전이 길어지면 디테일 누락으로 재작업 비용이 커질 수 있습니다.',
      '비판을 무시하는 분위기가 생기면 장기적으로 신뢰가 떨어질 수 있습니다.',
    ],
  },
  EARTH: {
    from: 'EARTH',
    to: 'WATER',
    relation: 'controls',
    relationKorean: '상극',
    easyExplanation: '토가 수를 제어하는 구조입니다. 경계와 구조(토)로 정보/감정의 범람(수)을 안정시킵니다.',
    practicalUseCases: [
      '업무 우선순위와 마감선을 분명히 정해 산만한 흐름을 통제할 수 있습니다.',
      '회의 아젠다를 사전 고정하면 논점 이탈을 줄이고 결정 속도를 높일 수 있습니다.',
      '예산 한도를 명확히 두면 즉흥 지출과 리스크를 줄일 수 있습니다.',
    ],
    cautionNotes: [
      '통제가 과하면 창의성과 자율성이 위축될 수 있습니다.',
      '감정 표현을 과도하게 막으면 관계 피로가 쌓일 수 있습니다.',
      '구조를 유지하려는 집착이 변화 대응을 늦출 수 있습니다.',
    ],
  },
  METAL: {
    from: 'METAL',
    to: 'WOOD',
    relation: 'controls',
    relationKorean: '상극',
    easyExplanation: '금이 목을 제어하는 구조입니다. 기준과 절제(금)로 과도한 확장과 산만함(목)을 정리합니다.',
    practicalUseCases: [
      '아이디어가 많을 때 KPI와 일정 기준으로 실행 가능한 과제만 남길 수 있습니다.',
      '프로젝트 범위가 커질 때 우선순위 컷오프로 리소스 낭비를 막을 수 있습니다.',
      '학습 계획에서 선택과 집중 규칙을 두면 완주율이 높아집니다.',
    ],
    cautionNotes: [
      '기준만 강조하면 도전 의욕과 창의성이 꺾일 수 있습니다.',
      '지적 중심 커뮤니케이션은 관계 마찰을 빠르게 키울 수 있습니다.',
      '실수 회피 성향이 강해지면 시도 자체가 줄어 성장 폭이 좁아질 수 있습니다.',
    ],
  },
  WATER: {
    from: 'WATER',
    to: 'FIRE',
    relation: 'controls',
    relationKorean: '상극',
    easyExplanation: '수가 화를 제어하는 구조입니다. 냉정함과 회복(수)으로 과열된 감정과 속도(화)를 식혀 균형을 잡습니다.',
    practicalUseCases: [
      '갈등 상황에서 감정 정리 시간을 먼저 두면 충동적 말실수를 줄일 수 있습니다.',
      '중요 의사결정 전에 사실 검증 단계를 넣어 과열된 낙관을 제어할 수 있습니다.',
      '과속 업무 주간 뒤 회복일을 넣어 번아웃을 예방할 수 있습니다.',
    ],
    cautionNotes: [
      '냉각이 과하면 동기와 팀 에너지가 급격히 떨어질 수 있습니다.',
      '거리 두기만 반복하면 신뢰와 친밀감이 약해질 수 있습니다.',
      '리스크 회피에 치우치면 필요한 도전까지 멈출 수 있습니다.',
    ],
  },
};

export const same: ElementSameRelationNote = {
  relation: 'same',
  relationKorean: '동행',
  easyExplanation: '같은 오행끼리는 같은 언어를 써서 빠르게 공감하고 결속합니다. 반대로 약점도 동시에 증폭되기 쉽습니다.',
  practicalUseCases: [
    '초기 프로젝트에서 비슷한 성향을 묶으면 실행 속도를 빠르게 끌어올릴 수 있습니다.',
    '학습/운동 루틴을 같은 성향 파트너와 맞추면 지속률이 크게 올라갑니다.',
    '팀 내 유사 성향끼리는 의사소통 비용이 낮아 빠른 실험에 유리합니다.',
  ],
  cautionNotes: [
    '같은 관점만 강화되면 집단사고가 생겨 리스크를 놓치기 쉽습니다.',
    '동일한 자원을 놓고 경쟁 구도가 생기면 갈등이 커질 수 있습니다.',
    '견제 장치가 없으면 강점이 과잉 행동으로 변질될 수 있습니다.',
  ],
};

export const polarityNotes: Record<ElementPolarityNoteCode, ElementPolarityNote> = {
  same_polarity: {
    code: 'same_polarity',
    title: '동극성 조합',
    easyExplanation: '같은 극성(예: 양-양, 음-음)은 속도와 추진 축이 맞아 빠르게 움직입니다.',
    practicalUseCases: [
      '런칭, 마감 대응, 위기 처리처럼 빠른 실행이 필요한 상황에 적합합니다.',
      '의사결정자와 실행자가 같은 템포로 움직여 초반 가속이 좋습니다.',
      '짧은 스프린트 단위 실험에서 성과 체감이 빠르게 나타납니다.',
    ],
    cautionNotes: [
      '브레이크가 약해 과속, 번아웃, 충돌이 동시에 생길 수 있습니다.',
      '의견 충돌 시 양보 없이 정면 대립으로 커질 가능성이 큽니다.',
      '속도에 치우치면 품질 검증 단계를 놓치기 쉽습니다.',
    ],
  },
  opposite_polarity: {
    code: 'opposite_polarity',
    title: '상보극성 조합',
    easyExplanation: '반대 극성(예: 양-음, 음-양)은 역할 분담과 균형이 좋아 지속 가능한 성과에 유리합니다.',
    practicalUseCases: [
      '기획-실행, 창의-검증처럼 상보 역할이 필요한 협업 구조에 적합합니다.',
      '장기 프로젝트에서 속도와 안정성을 함께 확보하기 좋습니다.',
      '멘토-실행자, 리더-운영자 조합에서 리스크 관리력이 높아집니다.',
    ],
    cautionNotes: [
      '초반 템포 차이로 답답함이 생길 수 있어 합의된 작업 리듬이 필요합니다.',
      '역할 경계가 모호하면 책임 전가가 발생할 수 있습니다.',
      '의사결정 루프를 길게 만들면 실행력이 급격히 떨어질 수 있습니다.',
    ],
  },
};

const generatedBy: Record<ElementCode, ElementRelationEntry> = {
  WOOD: generates.WATER,
  FIRE: generates.WOOD,
  EARTH: generates.FIRE,
  METAL: generates.EARTH,
  WATER: generates.METAL,
};

const controlledBy: Record<ElementCode, ElementRelationEntry> = {
  WOOD: controls.METAL,
  FIRE: controls.WATER,
  EARTH: controls.WOOD,
  METAL: controls.FIRE,
  WATER: controls.EARTH,
};

const allPolarityNotes: readonly ElementPolarityNote[] = [
  polarityNotes.same_polarity,
  polarityNotes.opposite_polarity,
];

function createGeneratedByDescription(from: ElementCode, to: ElementCode): ElementPairDescription {
  return {
    from,
    to,
    relation: 'generated_by',
    relationKorean: '생받음',
    easyExplanation: `${ELEMENT_LABEL_KOREAN[from]} 입장에서는 ${ELEMENT_LABEL_KOREAN[to]}의 지원을 받을 때 힘이 살아나는 구조입니다.`,
    practicalUseCases: [
      `${ELEMENT_LABEL_KOREAN[to]}의 강점을 먼저 확보한 뒤 ${ELEMENT_LABEL_KOREAN[from]}의 실행을 붙이면 성과가 더 안정적으로 납니다.`,
      `${ELEMENT_LABEL_KOREAN[from]}이 약한 시기에는 ${ELEMENT_LABEL_KOREAN[to]} 관련 사람, 환경, 습관을 보강해 회복 속도를 높일 수 있습니다.`,
      `중요 과제 시작 전에 ${ELEMENT_LABEL_KOREAN[to]} 단계(지원, 인풋, 기반)를 체크하면 실패 확률을 줄일 수 있습니다.`,
    ],
    cautionNotes: [
      `${ELEMENT_LABEL_KOREAN[to]}에만 의존하면 ${ELEMENT_LABEL_KOREAN[from]}의 주도성이 약해질 수 있습니다.`,
      `지원이 끊겼을 때 흔들리지 않도록 독립 루틴도 함께 설계해야 합니다.`,
      `둘의 템포 차이를 조정하지 않으면 답답함과 오해가 쌓이기 쉽습니다.`,
    ],
    sameNote: null,
    polarityNotes: allPolarityNotes,
  };
}

function createControlledByDescription(from: ElementCode, to: ElementCode): ElementPairDescription {
  return {
    from,
    to,
    relation: 'controlled_by',
    relationKorean: '제어받음',
    easyExplanation: `${ELEMENT_LABEL_KOREAN[from]}은(는) ${ELEMENT_LABEL_KOREAN[to]}에 의해 속도와 범위가 조절되는 구조입니다.`,
    practicalUseCases: [
      `과속이나 과열 신호가 있을 때 ${ELEMENT_LABEL_KOREAN[to]} 관점의 기준을 적용하면 리스크를 빠르게 낮출 수 있습니다.`,
      `${ELEMENT_LABEL_KOREAN[from]}의 강점이 과도하게 커질 때 ${ELEMENT_LABEL_KOREAN[to]}를 브레이크로 써서 균형을 회복할 수 있습니다.`,
      `중요 의사결정에서 ${ELEMENT_LABEL_KOREAN[to]} 체크리스트를 넣으면 실수 비용을 줄일 수 있습니다.`,
    ],
    cautionNotes: [
      `제어가 과하면 ${ELEMENT_LABEL_KOREAN[from]}의 장점까지 눌려 동기 저하가 생길 수 있습니다.`,
      `통제의 목적을 공유하지 않으면 억압으로 받아들여 관계 갈등이 커질 수 있습니다.`,
      `지속적으로 눌리는 구조가 되지 않도록 주기적인 역할 재조정이 필요합니다.`,
    ],
    sameNote: null,
    polarityNotes: allPolarityNotes,
  };
}

export function describeElementPair(from: ElementCode, to: ElementCode): ElementPairDescription {
  if (from === to) {
    return {
      from,
      to,
      relation: 'same',
      relationKorean: same.relationKorean,
      easyExplanation: same.easyExplanation,
      practicalUseCases: same.practicalUseCases,
      cautionNotes: same.cautionNotes,
      sameNote: same,
      polarityNotes: allPolarityNotes,
    };
  }

  const generated = generates[from];
  if (generated.to === to) {
    return {
      from,
      to,
      relation: 'generates',
      relationKorean: generated.relationKorean,
      easyExplanation: generated.easyExplanation,
      practicalUseCases: generated.practicalUseCases,
      cautionNotes: generated.cautionNotes,
      sameNote: null,
      polarityNotes: allPolarityNotes,
    };
  }

  const controlled = controls[from];
  if (controlled.to === to) {
    return {
      from,
      to,
      relation: 'controls',
      relationKorean: controlled.relationKorean,
      easyExplanation: controlled.easyExplanation,
      practicalUseCases: controlled.practicalUseCases,
      cautionNotes: controlled.cautionNotes,
      sameNote: null,
      polarityNotes: allPolarityNotes,
    };
  }

  const generatedSource = generatedBy[from];
  if (generatedSource.from === to) {
    return createGeneratedByDescription(from, to);
  }

  return createControlledByDescription(from, controlledBy[from].from);
}
