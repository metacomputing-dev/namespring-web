import type { LifeStageCode } from '../types.js';

type LifeStageOrder = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface LifeStageEncyclopediaEntry {
  readonly stageOrder: LifeStageOrder;
  readonly koreanName: string;
  readonly growthTheme: string;
  readonly strengths: readonly string[];
  readonly cautions: readonly string[];
  readonly practicalAdvice: readonly string[];
}

export const LIFE_STAGE_ENCYCLOPEDIA: Record<LifeStageCode, LifeStageEncyclopediaEntry> = {
  JANGSEONG: {
    stageOrder: 1,
    koreanName: '장생',
    growthTheme: '새싹처럼 시작하고 배우는 힘이 자라는 시기',
    strengths: [
      '새로운 것을 빠르게 배우고 흡수해요.',
      '호기심이 많아 기회를 잘 찾아요.',
      '작은 시작에도 생동감이 있어요.',
    ],
    cautions: [
      '시작은 빠르지만 마무리가 약해질 수 있어요.',
      '여러 가지를 동시에 벌이면 집중이 흐려질 수 있어요.',
    ],
    practicalAdvice: [
      '한 번에 하나의 목표만 정해 꾸준히 해보세요.',
      '배운 내용을 짧게 기록하면 성장 속도가 빨라져요.',
      '모르는 것은 바로 묻는 습관이 큰 힘이 돼요.',
    ],
  },
  MOKYOK: {
    stageOrder: 2,
    koreanName: '목욕',
    growthTheme: '감정과 매력을 다듬으며 자신을 표현하는 시기',
    strengths: [
      '감수성이 풍부해 사람의 마음을 잘 읽어요.',
      '매력이 자연스럽게 드러나 관계가 넓어져요.',
      '변화에 유연하게 적응할 수 있어요.',
    ],
    cautions: [
      '감정 기복이 크면 판단이 흔들릴 수 있어요.',
      '인정받고 싶은 마음이 커져 무리할 수 있어요.',
    ],
    practicalAdvice: [
      '감정이 올라올 때는 먼저 이름을 붙여보세요.',
      '관계에서 필요한 경계선을 분명히 해두세요.',
      '충분한 휴식이 매력을 오래 지켜줘요.',
    ],
  },
  GWANDAE: {
    stageOrder: 3,
    koreanName: '관대',
    growthTheme: '역할과 책임을 배우며 사회성을 키우는 시기',
    strengths: [
      '예의와 균형감이 좋아 신뢰를 얻기 쉬워요.',
      '팀 안에서 조율하고 연결하는 힘이 있어요.',
      '관계의 흐름을 읽고 맞추는 감각이 좋아요.',
    ],
    cautions: [
      '평가를 의식해 본모습을 숨길 수 있어요.',
      '형식에 치우치면 결정이 늦어질 수 있어요.',
    ],
    practicalAdvice: [
      '역할은 역할대로, 나의 가치는 따로 구분해보세요.',
      '완벽한 준비보다 작은 실행을 먼저 시작해보세요.',
      '믿는 사람에게 피드백을 자주 받아보세요.',
    ],
  },
  GEONROK: {
    stageOrder: 4,
    koreanName: '건록',
    growthTheme: '실력을 쌓고 생활 기반을 단단히 만드는 시기',
    strengths: [
      '꾸준함이 강해서 성과를 안정적으로 만들어요.',
      '실행력이 좋아 계획을 현실로 바꿔요.',
      '책임감이 분명해 믿고 맡기기 좋아요.',
    ],
    cautions: [
      '익숙한 방식에 머물면 확장이 느려질 수 있어요.',
      '혼자 다 하려다 부담이 쌓일 수 있어요.',
    ],
    practicalAdvice: [
      '핵심 목표를 하나 정해 집중도를 높여보세요.',
      '주간 점검으로 우선순위를 계속 다듬어보세요.',
      '작은 변화 실험을 통해 유연성을 길러보세요.',
    ],
  },
  JEWANG: {
    stageOrder: 5,
    koreanName: '제왕',
    growthTheme: '자신감과 영향력이 크게 빛나는 정점의 시기',
    strengths: [
      '판단이 빠르고 추진력이 강해요.',
      '주도적으로 방향을 제시하는 힘이 있어요.',
      '위기에서 중심을 잡는 리더십이 좋아요.',
    ],
    cautions: [
      '자신감이 과해지면 고집처럼 보일 수 있어요.',
      '속도를 높이다 체력과 관계를 놓칠 수 있어요.',
    ],
    practicalAdvice: [
      '결정 전에 반대 의견을 한 번 더 들어보세요.',
      '권한을 나누면 성과가 더 오래가요.',
      '겸손한 점검 루틴이 큰 실수를 막아줘요.',
    ],
  },
  SWOE: {
    stageOrder: 6,
    koreanName: '쇠',
    growthTheme: '속도를 줄이고 균형을 되찾는 전환의 시기',
    strengths: [
      '돌아보는 힘이 깊어져 판단이 성숙해져요.',
      '중요한 것과 덜 중요한 것을 잘 가려내요.',
      '무리한 위험을 줄이는 감각이 좋아요.',
    ],
    cautions: [
      '예전의 방식만 붙잡으면 답답함이 커질 수 있어요.',
      '자신감이 떨어져 기회를 지나칠 수 있어요.',
    ],
    practicalAdvice: [
      '속도를 낮추되 방향은 분명히 유지해보세요.',
      '작게라도 성취를 확인하며 자신감을 회복하세요.',
      '몸의 피로 신호를 먼저 챙기면 운이 안정돼요.',
    ],
  },
  BYEONG: {
    stageOrder: 7,
    koreanName: '병',
    growthTheme: '몸과 마음의 신호를 들으며 회복을 배우는 시기',
    strengths: [
      '타인의 아픔에 공감하는 힘이 커져요.',
      '내면을 깊게 살피며 본질을 보게 돼요.',
      '불필요한 욕심을 정리하는 지혜가 생겨요.',
    ],
    cautions: [
      '에너지가 약해져 쉽게 지칠 수 있어요.',
      '비관적인 생각이 길어지면 회복이 늦어져요.',
    ],
    practicalAdvice: [
      '잠과 식사 시간을 일정하게 유지해보세요.',
      '혼자 버티기보다 도움을 요청하는 연습을 해보세요.',
      '해야 할 일을 줄이고 회복에 우선순위를 주세요.',
    ],
  },
  SA: {
    stageOrder: 8,
    koreanName: '사',
    growthTheme: '끝맺음과 정리를 통해 다음 문을 여는 시기',
    strengths: [
      '놓아야 할 것을 분명히 정리할 수 있어요.',
      '관계와 일의 우선순위를 선명하게 만들어요.',
      '전환점에서 과감한 결단이 가능해요.',
    ],
    cautions: [
      '끝남에 대한 불안으로 머뭇거릴 수 있어요.',
      '혼자 정리하려다 외로움이 깊어질 수 있어요.',
    ],
    practicalAdvice: [
      '고마웠던 것에는 감사 인사를 남기고 마무리하세요.',
      '가까운 사람과 감정을 나누며 정리해보세요.',
      '작은 새 시작을 바로 만들어 흐름을 잇세요.',
    ],
  },
  MYO: {
    stageOrder: 9,
    koreanName: '묘',
    growthTheme: '경험을 저장하고 뿌리를 정돈하는 시기',
    strengths: [
      '지난 경험을 지혜로 바꾸는 힘이 좋아요.',
      '조용히 깊이를 쌓아 내공이 단단해져요.',
      '복잡한 상황을 차분히 정리할 수 있어요.',
    ],
    cautions: [
      '과거에 머물면 새로운 흐름을 놓칠 수 있어요.',
      '움직임이 줄어 기회가 작아질 수 있어요.',
    ],
    practicalAdvice: [
      '배운 점을 문서나 노트로 정리해 자산화하세요.',
      '완전히 멈추지 말고 작은 시도는 이어가세요.',
      '믿을 만한 인맥을 꾸준히 관리해두세요.',
    ],
  },
  JEOL: {
    stageOrder: 10,
    koreanName: '절',
    growthTheme: '낡은 흐름을 끊고 재정비하는 리셋의 시기',
    strengths: [
      '불필요한 습관을 정리하는 결단력이 있어요.',
      '새 판을 짜는 용기가 살아나요.',
      '경계선을 세우며 에너지를 지킬 수 있어요.',
    ],
    cautions: [
      '급하게 끊어내면 관계 충돌이 생길 수 있어요.',
      '정리 과정에서 정서적 피로가 커질 수 있어요.',
    ],
    practicalAdvice: [
      '끊을 것과 남길 것을 먼저 글로 분리해보세요.',
      '중요한 결정은 하루 쉬고 다시 확인해보세요.',
      '정리 후에는 회복 시간을 꼭 확보하세요.',
    ],
  },
  TAE: {
    stageOrder: 11,
    koreanName: '태',
    growthTheme: '새 가능성을 품고 다음 성장을 준비하는 시기',
    strengths: [
      '상상력과 희망이 다시 자라나요.',
      '새로운 방향을 조용히 설계할 수 있어요.',
      '부드럽고 섬세한 감각이 살아나요.',
    ],
    cautions: [
      '불확실함 때문에 결정이 미뤄질 수 있어요.',
      '생각만 많아지고 실행이 늦어질 수 있어요.',
    ],
    practicalAdvice: [
      '작게라도 시제품처럼 먼저 해보세요.',
      '응원해주는 환경을 가까이 두세요.',
      '느린 성장도 성장이라는 기준을 기억하세요.',
    ],
  },
  YANG: {
    stageOrder: 12,
    koreanName: '양',
    growthTheme: '돌봄을 받으며 힘을 기르고 다시 시작을 준비하는 시기',
    strengths: [
      '주변의 도움을 받아 성장하는 힘이 있어요.',
      '배움의 흡수력이 높아 기초를 잘 다져요.',
      '서두르지 않고 차근차근 준비할 수 있어요.',
    ],
    cautions: [
      '의존이 길어지면 주도성이 약해질 수 있어요.',
      '실행을 미루면 기회가 멀어질 수 있어요.',
    ],
    practicalAdvice: [
      '도움을 받되 최종 선택은 스스로 내려보세요.',
      '기초 체력과 생활 루틴부터 안정시켜보세요.',
      '작은 시작 날짜를 정해 행동으로 옮겨보세요.',
    ],
  },
};

export function getLifeStageEncyclopediaEntry(code: LifeStageCode): LifeStageEncyclopediaEntry {
  return LIFE_STAGE_ENCYCLOPEDIA[code];
}
