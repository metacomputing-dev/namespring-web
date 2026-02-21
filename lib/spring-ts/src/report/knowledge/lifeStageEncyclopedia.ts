/**
 * lifeStageEncyclopedia.ts
 *
 * Encyclopedia of the 12 Life Stages (Sibiunseong / 십이운성) with Korean
 * interpretations. Each entry provides energy level, theme, description,
 * advice, and per-pillar meanings for the premium saju report.
 *
 * Energy values follow the standard mapping:
 *   장생=9, 목욕=8, 관대=10, 건록=11, 제왕=12,
 *   쇠=7, 병=5, 사=3, 묘=1, 절=2, 태=4, 양=6
 */

import type { LifeStageCode } from '../types.js';

export interface LifeStageEncyclopediaEntry {
  readonly korean: string;
  readonly hanja: string;
  readonly energy: number;
  readonly theme: string;
  readonly description: readonly string[];
  readonly advice: readonly string[];
  readonly yearPillarMeaning: string;
  readonly monthPillarMeaning: string;
  readonly dayPillarMeaning: string;
  readonly hourPillarMeaning: string;
}

export const LIFE_STAGE_ENCYCLOPEDIA: Record<LifeStageCode, LifeStageEncyclopediaEntry> = {
  JANGSEONG: {
    korean: '장생',
    hanja: '長生',
    energy: 9,
    theme: '새싹처럼 시작하고 배우는 힘이 자라는 시기',
    description: [
      '새로운 것을 빠르게 배우고 흡수해요.',
      '호기심이 많아 기회를 잘 찾아요.',
      '작은 시작에도 생동감이 있어요.',
    ],
    advice: [
      '한 번에 하나의 목표만 정해 꾸준히 해보세요.',
      '배운 내용을 짧게 기록하면 성장 속도가 빨라져요.',
      '모르는 것은 바로 묻는 습관이 큰 힘이 돼요.',
    ],
    yearPillarMeaning: '어린 시절에 활발한 학습 환경과 새로운 시작의 에너지를 받아요.',
    monthPillarMeaning: '청년기에 새로운 기술이나 진로를 적극적으로 탐색하는 흐름이에요.',
    dayPillarMeaning: '본인의 내면에 성장하려는 에너지가 강하고, 배움을 즐기는 성향이에요.',
    hourPillarMeaning: '말년에도 새로운 도전과 배움에 열려 있는 기운이에요.',
  },
  MOKYOK: {
    korean: '목욕',
    hanja: '沐浴',
    energy: 8,
    theme: '감정과 매력을 다듬으며 자신을 표현하는 시기',
    description: [
      '감수성이 풍부해 사람의 마음을 잘 읽어요.',
      '매력이 자연스럽게 드러나 관계가 넓어져요.',
      '변화에 유연하게 적응할 수 있어요.',
    ],
    advice: [
      '감정이 올라올 때는 먼저 이름을 붙여보세요.',
      '관계에서 필요한 경계선을 분명히 해두세요.',
      '충분한 휴식이 매력을 오래 지켜줘요.',
    ],
    yearPillarMeaning: '어린 시절에 감수성이 일찍 발달하고, 주변 관심을 많이 받아요.',
    monthPillarMeaning: '청년기에 매력이 빛나지만, 감정 기복 관리가 성장의 열쇠예요.',
    dayPillarMeaning: '내면이 섬세하고 표현력이 좋아 대인관계에서 호감을 잘 얻어요.',
    hourPillarMeaning: '말년에 풍부한 감성을 활용한 활동이 삶에 활력을 줘요.',
  },
  GWANDAE: {
    korean: '관대',
    hanja: '冠帶',
    energy: 10,
    theme: '역할과 책임을 배우며 사회성을 키우는 시기',
    description: [
      '예의와 균형감이 좋아 신뢰를 얻기 쉬워요.',
      '팀 안에서 조율하고 연결하는 힘이 있어요.',
      '관계의 흐름을 읽고 맞추는 감각이 좋아요.',
    ],
    advice: [
      '역할은 역할대로, 나의 가치는 따로 구분해보세요.',
      '완벽한 준비보다 작은 실행을 먼저 시작해보세요.',
      '믿는 사람에게 피드백을 자주 받아보세요.',
    ],
    yearPillarMeaning: '어린 시절부터 사회적 규범과 예의를 자연스럽게 익히는 환경이에요.',
    monthPillarMeaning: '청년기에 조직 내 역할을 빠르게 잡고 신뢰를 쌓아요.',
    dayPillarMeaning: '본인이 예의 바르고 균형 잡힌 성격으로 주변에서 인정받아요.',
    hourPillarMeaning: '말년에 사회적 역할과 명예가 안정적으로 유지돼요.',
  },
  GEONROK: {
    korean: '건록',
    hanja: '建祿',
    energy: 11,
    theme: '실력을 쌓고 생활 기반을 단단히 만드는 시기',
    description: [
      '꾸준함이 강해서 성과를 안정적으로 만들어요.',
      '실행력이 좋아 계획을 현실로 바꿔요.',
      '책임감이 분명해 믿고 맡기기 좋아요.',
    ],
    advice: [
      '핵심 목표를 하나 정해 집중도를 높여보세요.',
      '주간 점검으로 우선순위를 계속 다듬어보세요.',
      '작은 변화 실험을 통해 유연성을 길러보세요.',
    ],
    yearPillarMeaning: '어린 시절부터 자립심이 강하고 실질적인 능력을 일찍 키워요.',
    monthPillarMeaning: '청년기에 안정적인 직업 기반을 빠르게 확보하는 흐름이에요.',
    dayPillarMeaning: '본인의 실행력과 자립심이 강해 독립적으로 성과를 만들어요.',
    hourPillarMeaning: '말년에 꾸준히 쌓은 실력이 안정적인 생활 기반이 돼요.',
  },
  JEWANG: {
    korean: '제왕',
    hanja: '帝旺',
    energy: 12,
    theme: '자신감과 영향력이 크게 빛나는 정점의 시기',
    description: [
      '판단이 빠르고 추진력이 강해요.',
      '주도적으로 방향을 제시하는 힘이 있어요.',
      '위기에서 중심을 잡는 리더십이 좋아요.',
    ],
    advice: [
      '결정 전에 반대 의견을 한 번 더 들어보세요.',
      '권한을 나누면 성과가 더 오래가요.',
      '겸손한 점검 루틴이 큰 실수를 막아줘요.',
    ],
    yearPillarMeaning: '어린 시절부터 존재감이 크고 주도적인 성향이 뚜렷해요.',
    monthPillarMeaning: '청년기에 리더십을 발휘하며 빠르게 두각을 나타내요.',
    dayPillarMeaning: '본인의 자신감과 추진력이 매우 강해 큰 일을 벌이는 성향이에요.',
    hourPillarMeaning: '말년에 강한 영향력을 유지하지만, 유연함을 더하면 더 좋아요.',
  },
  SWOE: {
    korean: '쇠',
    hanja: '衰',
    energy: 7,
    theme: '속도를 줄이고 균형을 되찾는 전환의 시기',
    description: [
      '돌아보는 힘이 깊어져 판단이 성숙해져요.',
      '중요한 것과 덜 중요한 것을 잘 가려내요.',
      '무리한 위험을 줄이는 감각이 좋아요.',
    ],
    advice: [
      '속도를 낮추되 방향은 분명히 유지해보세요.',
      '작게라도 성취를 확인하며 자신감을 회복하세요.',
      '몸의 피로 신호를 먼저 챙기면 운이 안정돼요.',
    ],
    yearPillarMeaning: '어린 시절에 조숙하게 성장하며 신중한 성격이 일찍 나타나요.',
    monthPillarMeaning: '청년기에 속도보다 깊이를 선택하며 내실을 다지는 흐름이에요.',
    dayPillarMeaning: '본인이 신중하고 안정적인 판단을 선호하는 차분한 성향이에요.',
    hourPillarMeaning: '말년에 무리하지 않고 균형 잡힌 생활을 통해 건강을 지켜요.',
  },
  BYEONG: {
    korean: '병',
    hanja: '病',
    energy: 5,
    theme: '몸과 마음의 신호를 들으며 회복을 배우는 시기',
    description: [
      '타인의 아픔에 공감하는 힘이 커져요.',
      '내면을 깊게 살피며 본질을 보게 돼요.',
      '불필요한 욕심을 정리하는 지혜가 생겨요.',
    ],
    advice: [
      '잠과 식사 시간을 일정하게 유지해보세요.',
      '혼자 버티기보다 도움을 요청하는 연습을 해보세요.',
      '해야 할 일을 줄이고 회복에 우선순위를 주세요.',
    ],
    yearPillarMeaning: '어린 시절에 체력이나 환경 면에서 돌봄이 더 필요한 환경이에요.',
    monthPillarMeaning: '청년기에 건강 관리와 생활 리듬 안정이 성공의 기반이 돼요.',
    dayPillarMeaning: '본인이 내면을 깊게 들여다보는 성찰형 성격이에요.',
    hourPillarMeaning: '말년에 건강을 최우선으로 챙기면 안정된 노후를 보내요.',
  },
  SA: {
    korean: '사',
    hanja: '死',
    energy: 3,
    theme: '끝맺음과 정리를 통해 다음 문을 여는 시기',
    description: [
      '놓아야 할 것을 분명히 정리할 수 있어요.',
      '관계와 일의 우선순위를 선명하게 만들어요.',
      '전환점에서 과감한 결단이 가능해요.',
    ],
    advice: [
      '고마웠던 것에는 감사 인사를 남기고 마무리하세요.',
      '가까운 사람과 감정을 나누며 정리해보세요.',
      '작은 새 시작을 바로 만들어 흐름을 잇세요.',
    ],
    yearPillarMeaning: '어린 시절에 환경 변화가 크고, 일찍 독립심이 생기는 경우가 있어요.',
    monthPillarMeaning: '청년기에 과감한 방향 전환이 이후 성장의 발판이 돼요.',
    dayPillarMeaning: '본인이 끝맺음과 결단에 강하고, 정리 능력이 뛰어나요.',
    hourPillarMeaning: '말년에 과거를 깔끔히 정리하며 새로운 의미를 찾아요.',
  },
  MYO: {
    korean: '묘',
    hanja: '墓',
    energy: 1,
    theme: '경험을 저장하고 뿌리를 정돈하는 시기',
    description: [
      '지난 경험을 지혜로 바꾸는 힘이 좋아요.',
      '조용히 깊이를 쌓아 내공이 단단해져요.',
      '복잡한 상황을 차분히 정리할 수 있어요.',
    ],
    advice: [
      '배운 점을 문서나 노트로 정리해 자산화하세요.',
      '완전히 멈추지 말고 작은 시도는 이어가세요.',
      '믿을 만한 인맥을 꾸준히 관리해두세요.',
    ],
    yearPillarMeaning: '어린 시절에 가족이나 조상의 영향이 크고, 전통을 중시하는 환경이에요.',
    monthPillarMeaning: '청년기에 축적과 저장의 에너지가 강해 내실을 다지는 시기예요.',
    dayPillarMeaning: '본인이 경험을 지혜로 바꾸는 능력이 뛰어나고, 내면이 깊어요.',
    hourPillarMeaning: '말년에 쌓아온 경험과 지혜가 후대에게 큰 자산이 돼요.',
  },
  JEOL: {
    korean: '절',
    hanja: '絶',
    energy: 2,
    theme: '낡은 흐름을 끊고 재정비하는 리셋의 시기',
    description: [
      '불필요한 습관을 정리하는 결단력이 있어요.',
      '새 판을 짜는 용기가 살아나요.',
      '경계선을 세우며 에너지를 지킬 수 있어요.',
    ],
    advice: [
      '끊을 것과 남길 것을 먼저 글로 분리해보세요.',
      '중요한 결정은 하루 쉬고 다시 확인해보세요.',
      '정리 후에는 회복 시간을 꼭 확보하세요.',
    ],
    yearPillarMeaning: '어린 시절에 환경이 크게 바뀌는 경험을 통해 자립심이 강해져요.',
    monthPillarMeaning: '청년기에 기존 틀을 깨고 새 방향을 잡는 전환점이 와요.',
    dayPillarMeaning: '본인이 과감하게 끊고 새로 시작하는 결단력이 뛰어나요.',
    hourPillarMeaning: '말년에 불필요한 것을 정리하며 가볍고 깨끗한 삶을 추구해요.',
  },
  TAE: {
    korean: '태',
    hanja: '胎',
    energy: 4,
    theme: '새 가능성을 품고 다음 성장을 준비하는 시기',
    description: [
      '상상력과 희망이 다시 자라나요.',
      '새로운 방향을 조용히 설계할 수 있어요.',
      '부드럽고 섬세한 감각이 살아나요.',
    ],
    advice: [
      '작게라도 시제품처럼 먼저 해보세요.',
      '응원해주는 환경을 가까이 두세요.',
      '느린 성장도 성장이라는 기준을 기억하세요.',
    ],
    yearPillarMeaning: '어린 시절에 잠재력이 조용히 자라며, 가능성의 씨앗이 심겨져요.',
    monthPillarMeaning: '청년기에 새로운 아이디어와 계획을 품고 준비하는 시기예요.',
    dayPillarMeaning: '본인이 가능성을 품고 천천히 키워가는 인내형 성향이에요.',
    hourPillarMeaning: '말년에 새로운 관심사나 취미가 삶에 활력을 불어넣어요.',
  },
  YANG: {
    korean: '양',
    hanja: '養',
    energy: 6,
    theme: '돌봄을 받으며 힘을 기르고 다시 시작을 준비하는 시기',
    description: [
      '주변의 도움을 받아 성장하는 힘이 있어요.',
      '배움의 흡수력이 높아 기초를 잘 다져요.',
      '서두르지 않고 차근차근 준비할 수 있어요.',
    ],
    advice: [
      '도움을 받되 최종 선택은 스스로 내려보세요.',
      '기초 체력과 생활 루틴부터 안정시켜보세요.',
      '작은 시작 날짜를 정해 행동으로 옮겨보세요.',
    ],
    yearPillarMeaning: '어린 시절에 보호와 양육을 충분히 받으며 기초가 탄탄해져요.',
    monthPillarMeaning: '청년기에 멘토나 지원 환경의 도움으로 실력이 빠르게 성장해요.',
    dayPillarMeaning: '본인이 돌봄을 주고받는 것에 자연스럽고, 관계에서 안정감을 줘요.',
    hourPillarMeaning: '말년에 후대의 돌봄을 받으며 편안하고 따뜻한 환경을 누려요.',
  },
};

export function getLifeStageEncyclopediaEntry(code: LifeStageCode): LifeStageEncyclopediaEntry {
  return LIFE_STAGE_ENCYCLOPEDIA[code];
}
