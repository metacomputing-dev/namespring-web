export type NamingPrincipleKey =
  | 'JAWON_OHAENG'
  | 'EUMYANG_BALANCE'
  | 'STROKE_NUMEROLOGY_81'
  | 'PRONUNCIATION_HARMONY'
  | 'DISALLOWED_HANJA'
  | 'PRACTICAL_USABILITY';

export interface NamingPrincipleEncyclopediaEntry {
  readonly key: NamingPrincipleKey;
  readonly title: string;
  readonly intent: string;
  readonly checklist: readonly string[];
}

export const NAMING_PRINCIPLES_ENCYCLOPEDIA: readonly NamingPrincipleEncyclopediaEntry[] = [
  {
    key: 'JAWON_OHAENG',
    title: '자원오행',
    intent: '한자의 오행이 사주의 부족한 기운을 보완하는지 점검한다.',
    checklist: [
      '이름에 쓰는 각 한자의 오행(목화토금수)을 먼저 확인한다.',
      '사주에서 약한 오행을 보완하는 조합인지 확인한다.',
      '특정 오행이 과하게 몰리지 않도록 균형을 맞춘다.',
    ],
  },
  {
    key: 'EUMYANG_BALANCE',
    title: '음양',
    intent: '획수의 홀짝 흐름을 보고 전체 리듬이 한쪽으로 치우치지 않게 한다.',
    checklist: [
      '성, 이름 1자, 이름 2자의 홀짝 분포를 확인한다.',
      '전부 홀수 또는 전부 짝수처럼 단조로운 패턴은 피한다.',
      '음양 흐름이 자연스럽게 이어지는 조합을 우선 검토한다.',
    ],
  },
  {
    key: 'STROKE_NUMEROLOGY_81',
    title: '획수/수리(81)',
    intent: '원획 기준으로 수리를 계산해 불안정한 수를 피하고 안정적인 수를 고른다.',
    checklist: [
      '사용할 한자의 원획을 기준으로 천격·인격·지격·외격·총격을 계산한다.',
      '핵심격(인격, 지격, 총격)의 의미를 먼저 확인한다.',
      '좋은 수리라도 다른 원리와 충돌하면 최종 후보에서 다시 조정한다.',
    ],
  },
  {
    key: 'PRONUNCIATION_HARMONY',
    title: '발음 조화',
    intent: '실제 부를 때 어색하지 않고 또렷하게 전달되는 발음을 만든다.',
    checklist: [
      '성+이름을 빠르게 여러 번 읽어 보고 발음 걸림이 없는지 확인한다.',
      '받침 충돌, 연음 어색함, 비슷한 소리 반복을 점검한다.',
      '또래와 어른이 모두 쉽게 읽고 들을 수 있는지 확인한다.',
    ],
  },
  {
    key: 'DISALLOWED_HANJA',
    title: '불용한자 주의',
    intent: '의미가 불안정하거나 관습적으로 기피되는 한자는 사전에 걸러낸다.',
    checklist: [
      '후보 한자가 불용한자 목록에 포함되는지 먼저 조회한다.',
      '뜻이 지나치게 무겁거나 부정적으로 해석될 여지가 없는지 확인한다.',
      '한자 사전 표기와 인명용 한자 등재 여부를 함께 확인한다.',
    ],
  },
  {
    key: 'PRACTICAL_USABILITY',
    title: '이름 실사용성',
    intent: '서류, 학교, 사회생활에서 불편 없이 오래 쓰기 좋은 이름인지 본다.',
    checklist: [
      '자주 오기입되거나 오독될 가능성이 큰지 점검한다.',
      '한글/한자 표기가 각종 전산 입력 환경에서 안정적으로 처리되는지 확인한다.',
      '아동기부터 성인기까지 어색하지 않게 사용할 수 있는지 검토한다.',
    ],
  },
];

export function getNamingPrincipleChecklist(): readonly string[] {
  return NAMING_PRINCIPLES_ENCYCLOPEDIA.flatMap((entry) =>
    entry.checklist.map((item) => `[${entry.title}] ${item}`),
  );
}
