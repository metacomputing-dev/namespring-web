/**
 * gyeokgukEncyclopedia.ts
 *
 * 공통 19개 격국에 대한 간단 해설 사전.
 * 입력 문자열이 조금 달라도 조회할 수 있도록 퍼지 매칭 헬퍼를 제공합니다.
 */

export type GyeokgukKey =
  | '비견격'
  | '겁재격'
  | '정관격'
  | '편관격'
  | '정재격'
  | '편재격'
  | '식신격'
  | '상관격'
  | '정인격'
  | '편인격'
  | '화기격'
  | '전왕격'
  | '종격'
  | '종재격'
  | '종관격'
  | '종살격'
  | '종아격'
  | '종인격'
  | '종비격';

export interface GyeokgukEncyclopediaEntry {
  readonly coreStructure: string;
  readonly strengths: string;
  readonly cautions: string;
  readonly growthTip: string;
  readonly relationshipTip: string;
  readonly careerTip: string;
}

export const GYEOKGUK_ENCYCLOPEDIA: Record<GyeokgukKey, GyeokgukEncyclopediaEntry> = {
  비견격: {
    coreStructure: '내 기운과 같은 힘이 중심이 되는 구조예요.',
    strengths: '독립심이 강하고 자기 기준이 뚜렷해요.',
    cautions: '고집이 세지면 협업에서 마찰이 생길 수 있어요.',
    growthTip: '주장을 유지하되 타협 지점을 먼저 정해 두세요.',
    relationshipTip: '주도권 다툼보다 역할 분담을 명확히 하면 좋아요.',
    careerTip: '자율성이 큰 직무나 개인 브랜드형 일이 잘 맞아요.',
  },
  겁재격: {
    coreStructure: '경쟁과 돌파 에너지가 강하게 작동하는 구조예요.',
    strengths: '위기 대응이 빠르고 실행력이 뛰어나요.',
    cautions: '성급한 판단과 무리한 승부는 손실로 이어질 수 있어요.',
    growthTip: '중요 결정은 하루만 늦춰 재검토하는 습관이 좋아요.',
    relationshipTip: '비교보다 협력을 선택하면 관계가 오래가요.',
    careerTip: '영업, 협상, 프로젝트 리딩처럼 속도전 분야에 강해요.',
  },
  정관격: {
    coreStructure: '질서와 책임이 핵심 축이 되는 구조예요.',
    strengths: '신뢰, 성실, 규범 준수 능력이 뛰어나요.',
    cautions: '완벽주의가 심해지면 유연성이 떨어질 수 있어요.',
    growthTip: '원칙 80%에 상황 대응 20%를 더해 보세요.',
    relationshipTip: '기준을 강요하기보다 이유를 설명하면 갈등이 줄어요.',
    careerTip: '조직 관리, 공공, 법/행정 같은 체계형 업무와 잘 맞아요.',
  },
  편관격: {
    coreStructure: '압박을 동력으로 바꾸는 강한 통제 구조예요.',
    strengths: '결단력과 책임감이 강하고 위기 관리에 능해요.',
    cautions: '강한 통제 성향이 대인 긴장으로 이어질 수 있어요.',
    growthTip: '지시 전에 합의 과정을 짧게라도 넣어 보세요.',
    relationshipTip: '정답 제시보다 경청 비율을 늘리면 신뢰가 높아져요.',
    careerTip: '보안, 리스크 관리, 운영 총괄처럼 판단이 중요한 일에 유리해요.',
  },
  정재격: {
    coreStructure: '안정적 자원 관리가 중심이 되는 현실형 구조예요.',
    strengths: '꾸준함과 계획성이 좋아 재정 감각이 탄탄해요.',
    cautions: '안전 지향이 과하면 기회를 놓칠 수 있어요.',
    growthTip: '저위험 기반을 지키면서 작은 실험을 병행해 보세요.',
    relationshipTip: '표현이 담백한 편이라 감사 표현을 의식적으로 늘리세요.',
    careerTip: '재무, 회계, 운영, 자산 관리 같은 관리형 직무에 강해요.',
  },
  편재격: {
    coreStructure: '유통과 확장 흐름을 타는 외향적 재성 구조예요.',
    strengths: '사람과 기회를 연결하는 감각이 좋아요.',
    cautions: '지출 확대, 과한 확장은 변동성을 키울 수 있어요.',
    growthTip: '현금흐름 기준선과 손절 기준을 먼저 정하세요.',
    relationshipTip: '넓은 인맥 속에서도 핵심 관계를 따로 관리하세요.',
    careerTip: '사업, 투자, 세일즈, 제휴 같은 확장형 분야가 잘 맞아요.',
  },
  식신격: {
    coreStructure: '생산성과 표현력이 자연스럽게 흘러나오는 구조예요.',
    strengths: '꾸준한 산출과 실무 완성도가 높아요.',
    cautions: '편안함에 머물면 성장 속도가 느려질 수 있어요.',
    growthTip: '결과물 단위를 작게 쪼개 꾸준히 공개해 보세요.',
    relationshipTip: '돌봄 성향이 강해도 경계선은 분명히 잡아 주세요.',
    careerTip: '콘텐츠 제작, 연구개발, 전문기술직에 강점이 있어요.',
  },
  상관격: {
    coreStructure: '창의적 문제 제기와 변형 능력이 강한 구조예요.',
    strengths: '아이디어가 빠르고 표현력이 뛰어나요.',
    cautions: '직설적 표현이 오해를 부를 수 있어요.',
    growthTip: '비판 뒤에 대안을 붙이는 습관을 들이세요.',
    relationshipTip: '정확함보다 상대 감정의 타이밍을 먼저 보세요.',
    careerTip: '기획, 마케팅, 브랜딩, 콘텐츠 전략 분야에 유리해요.',
  },
  정인격: {
    coreStructure: '학습과 보호 에너지가 중심인 안정형 구조예요.',
    strengths: '이해력, 배려, 지식 축적 능력이 좋아요.',
    cautions: '생각이 많아 실행이 늦어질 수 있어요.',
    growthTip: '준비 70% 시점에서 바로 실행으로 넘어가세요.',
    relationshipTip: '상대를 챙기되 과보호는 줄이면 균형이 좋아요.',
    careerTip: '교육, 상담, 연구, 기획 지원 업무에 잘 맞아요.',
  },
  편인격: {
    coreStructure: '직관과 전문성이 강하게 응축된 탐구형 구조예요.',
    strengths: '깊이 있는 분석과 독창적 관점이 강점이에요.',
    cautions: '고립되면 실행과 소통이 약해질 수 있어요.',
    growthTip: '혼자 정리한 내용을 주 1회 외부 피드백으로 검증하세요.',
    relationshipTip: '말수가 적어도 감정 상태는 짧게 공유해 주세요.',
    careerTip: '리서치, 데이터 분석, 전문 컨설팅과 궁합이 좋아요.',
  },
  화기격: {
    coreStructure: '한쪽 기운이 선명하게 모여 추진력이 커진 구조예요.',
    strengths: '집중력과 몰입이 강해 단기간 성과를 내기 좋아요.',
    cautions: '과열되면 균형이 무너지고 소진이 빨라질 수 있어요.',
    growthTip: '휴식과 회복 루틴을 성과 루틴만큼 고정하세요.',
    relationshipTip: '강한 에너지 전달 전 상대 컨디션을 먼저 확인하세요.',
    careerTip: '집중 투입형 프로젝트, 런칭, 캠페인 업무에 유리해요.',
  },
  전왕격: {
    coreStructure: '특정 세력이 매우 강해 판을 주도하는 구조예요.',
    strengths: '리더십과 장악력이 강하고 방향 제시가 명확해요.',
    cautions: '강한 주도권이 독주로 보일 수 있어요.',
    growthTip: '결정권은 유지하되 검토권을 팀에 열어 두세요.',
    relationshipTip: '상대 의견을 반영한 흔적을 보여 주면 신뢰가 커져요.',
    careerTip: '총괄 리더, 오너십 큰 역할, 전략 책임 직무에 강해요.',
  },
  종격: {
    coreStructure: '강한 흐름에 순응해 전체 균형을 맞추는 특수 구조예요.',
    strengths: '환경 적응력이 뛰어나 큰 흐름을 잘 타요.',
    cautions: '흐름을 거스르는 선택은 부담이 크게 올 수 있어요.',
    growthTip: '내 의지와 시장 흐름이 같은 방향인지 먼저 점검하세요.',
    relationshipTip: '주도보다 조율 역할을 잡으면 관계가 편해져요.',
    careerTip: '변화가 빠른 산업에서 트렌드 추종 전략이 유리해요.',
  },
  종재격: {
    coreStructure: '재성 흐름을 따라 자원과 성과에 집중하는 구조예요.',
    strengths: '현실 감각과 수익 기회 포착 능력이 좋아요.',
    cautions: '성과 중심이 과하면 가치 기준이 흔들릴 수 있어요.',
    growthTip: '수익 목표와 함께 비수익 원칙도 같이 정하세요.',
    relationshipTip: '조건보다 신뢰를 먼저 쌓으면 관계가 안정돼요.',
    careerTip: '사업개발, 영업전략, 투자 실행 분야에 강점이 있어요.',
  },
  종관격: {
    coreStructure: '관성 질서를 따르며 역할 책임을 키우는 구조예요.',
    strengths: '조직 적응력과 책임 수행 능력이 뛰어나요.',
    cautions: '지나친 눈치 보기로 자기 목소리를 잃기 쉬워요.',
    growthTip: '기준을 따르되 핵심 의견 1개는 꼭 제시하세요.',
    relationshipTip: '맞춰 주기만 하지 말고 경계와 요청을 분명히 하세요.',
    careerTip: '조직형 커리어, 공공영역, 운영관리와 잘 맞아요.',
  },
  종살격: {
    coreStructure: '강한 압력 에너지를 통제력으로 전환하는 구조예요.',
    strengths: '극한 상황에서 판단력과 생존력이 강해요.',
    cautions: '긴장 상태가 길어지면 피로와 예민함이 커질 수 있어요.',
    growthTip: '고강도 구간 뒤에는 회복 구간을 반드시 배치하세요.',
    relationshipTip: '방어적 태도보다 상황 설명을 먼저 하면 오해가 줄어요.',
    careerTip: '위기대응, 보안, 감사, 품질관리 업무에 강해요.',
  },
  종아격: {
    coreStructure: '식상 흐름을 따라 표현과 생산으로 힘을 쓰는 구조예요.',
    strengths: '아이디어를 결과물로 바꾸는 전환 속도가 빨라요.',
    cautions: '산출은 많아도 방향이 분산될 수 있어요.',
    growthTip: '핵심 주제 1~2개를 정해 지속적으로 누적하세요.',
    relationshipTip: '말이 빠를수록 결론보다 공감 문장을 먼저 두세요.',
    careerTip: '콘텐츠, 교육, 퍼포먼스 기반 직무에 잘 맞아요.',
  },
  종인격: {
    coreStructure: '인성 흐름을 따라 학습과 지원 역량을 극대화하는 구조예요.',
    strengths: '지식 흡수와 맥락 이해가 뛰어나요.',
    cautions: '준비 과잉으로 타이밍을 놓치기 쉬워요.',
    growthTip: '배운 것을 즉시 적용하는 작은 실험을 붙이세요.',
    relationshipTip: '좋은 의도라도 간섭처럼 보이지 않게 질문형으로 말하세요.',
    careerTip: '연구, 교육, 분석, 지원 기획 분야에 강점이 있어요.',
  },
  종비격: {
    coreStructure: '비겁 흐름을 따라 자립성과 결속을 키우는 구조예요.',
    strengths: '자기 추진력과 팀 결속을 동시에 만들 수 있어요.',
    cautions: '내 편/남의 편 구도가 강해지면 확장이 막힐 수 있어요.',
    growthTip: '동료 결속과 외부 협업 비율을 균형 있게 가져가세요.',
    relationshipTip: '의리는 강점이지만 기준은 사람마다 다를 수 있음을 기억하세요.',
    careerTip: '공동창업, 파트너십, 커뮤니티 기반 업무에 유리해요.',
  },
};

const GYEOKGUK_KEYS: readonly GyeokgukKey[] = Object.keys(GYEOKGUK_ENCYCLOPEDIA) as GyeokgukKey[];

const GYEOKGUK_ALIASES: Record<GyeokgukKey, readonly string[]> = {
  비견격: ['비견격', '비견', 'bi_gyeon', 'bigyeon'],
  겁재격: ['겁재격', '겁재', 'gyeob_jae', 'geob_jae', 'gyeobjae', 'geobjae'],
  정관격: ['정관격', '정관', 'jeong_gwan', 'jeonggwan'],
  편관격: ['편관격', '편관', 'pyeon_gwan', 'pyeongwan'],
  정재격: ['정재격', '정재', 'jeong_jae', 'jeongjae'],
  편재격: ['편재격', '편재', 'pyeon_jae', 'pyeonjae'],
  식신격: ['식신격', '식신', 'sik_sin', 'sik_shin', 'siksin', 'sikshin'],
  상관격: ['상관격', '상관', 'sang_gwan', 'sanggwan'],
  정인격: ['정인격', '정인', 'jeong_in', 'jeongin'],
  편인격: ['편인격', '편인', 'pyeon_in', 'pyeonin'],
  화기격: ['화기격', '화기', 'hua_qi', 'huaqi'],
  전왕격: ['전왕격', '전왕', 'zhuan_wang', 'zhuanwang'],
  종격: ['종격', 'cong_ge', 'congge'],
  종재격: ['종재격', '종재', 'cong_cai', 'congcai'],
  종관격: ['종관격', '종관', 'cong_guan', 'congguan'],
  종살격: ['종살격', '종살', 'cong_sha', 'congsha'],
  종아격: ['종아격', '종아', 'cong_er', 'conger'],
  종인격: ['종인격', '종인', 'cong_yin', 'congyin'],
  종비격: ['종비격', '종비', 'cong_bi', 'congbi'],
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-_/]/g, '');
}

function findByMatcher(
  normalizedInput: string,
  matcher: (inputToken: string, aliasToken: string) => boolean,
): GyeokgukKey | null {
  for (const key of GYEOKGUK_KEYS) {
    const aliasCandidates = [key, ...GYEOKGUK_ALIASES[key]];
    for (const alias of aliasCandidates) {
      const aliasToken = normalizeToken(alias);
      if (!aliasToken) continue;
      if (matcher(normalizedInput, aliasToken)) return key;
    }
  }
  return null;
}

export function findGyeokgukEntry(name?: string | null): GyeokgukEncyclopediaEntry | null {
  if (typeof name !== 'string') return null;

  const normalizedInput = normalizeToken(name);
  if (!normalizedInput) return null;

  const exactMatch = findByMatcher(normalizedInput, (inputToken, aliasToken) => inputToken === aliasToken);
  if (exactMatch) return GYEOKGUK_ENCYCLOPEDIA[exactMatch];

  if (normalizedInput.length < 2) return null;

  const fuzzyMatch = findByMatcher(
    normalizedInput,
    (inputToken, aliasToken) => inputToken.includes(aliasToken) || aliasToken.includes(inputToken),
  );
  return fuzzyMatch ? GYEOKGUK_ENCYCLOPEDIA[fuzzyMatch] : null;
}
