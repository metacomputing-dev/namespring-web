/**
 * gyeokgukEncyclopedia.ts
 *
 * Encyclopedia of the 19 Gyeokguk (격국) types with Korean interpretations.
 * Covers all 10 normal gyeokguk types (based on ten gods) and 9 special
 * gyeokguk types (HUA_QI, ZHUAN_WANG, and 7 CONG variants).
 *
 * Each entry provides description, strengths, cautions, and career hints
 * for the premium saju report gyeokguk-yongshin section.
 */

/** Union type for all 19 gyeokguk codes used in the system */
export type GyeokgukCode =
  // Normal 10 (ten-god-based)
  | 'BI_GYEON' | 'GYEOB_JAE'
  | 'JEONG_GWAN' | 'PYEON_GWAN'
  | 'JEONG_JAE' | 'PYEON_JAE'
  | 'SIK_SIN' | 'SANG_GWAN'
  | 'JEONG_IN' | 'PYEON_IN'
  // Special 9
  | 'HUA_QI' | 'ZHUAN_WANG'
  | 'CONG_GE' | 'CONG_CAI' | 'CONG_GUAN'
  | 'CONG_SHA' | 'CONG_ER' | 'CONG_YIN' | 'CONG_BI';

export interface GyeokgukEncyclopediaEntry {
  readonly korean: string;
  readonly hanja: string;
  readonly category: string;
  readonly description: readonly string[];
  readonly strengths: readonly string[];
  readonly cautions: readonly string[];
  readonly careerHints: readonly string[];
}

export const GYEOKGUK_ENCYCLOPEDIA: Record<GyeokgukCode, GyeokgukEncyclopediaEntry> = {
  // ---------------------------------------------------------------------------
  //  Normal 10: ten-god-based gyeokguk
  // ---------------------------------------------------------------------------
  BI_GYEON: {
    korean: '비견격',
    hanja: '比肩格',
    category: '비겁',
    description: [
      '내 기운과 같은 힘이 중심이 되는 구조예요.',
      '독립심이 강하고 자기 기준이 뚜렷해요.',
    ],
    strengths: [
      '독립심이 강하고 자기 기준이 뚜렷해요.',
      '주장을 유지하되 타협 지점을 먼저 정해 두면 시너지가 나요.',
    ],
    cautions: [
      '고집이 세지면 협업에서 마찰이 생길 수 있어요.',
      '주도권 다툼보다 역할 분담을 명확히 하면 좋아요.',
    ],
    careerHints: [
      '자율성이 큰 직무나 개인 브랜드형 일이 잘 맞아요.',
      '프리랜서, 공동창업, 현장 운영 등 자기 추진력이 중요한 분야가 유리해요.',
    ],
  },
  GYEOB_JAE: {
    korean: '겁재격',
    hanja: '劫財格',
    category: '비겁',
    description: [
      '경쟁과 돌파 에너지가 강하게 작동하는 구조예요.',
      '위기 대응이 빠르고 실행력이 뛰어나요.',
    ],
    strengths: [
      '위기 대응이 빠르고 실행력이 뛰어나요.',
      '중요 결정은 하루만 늦춰 재검토하는 습관이 좋아요.',
    ],
    cautions: [
      '성급한 판단과 무리한 승부는 손실로 이어질 수 있어요.',
      '비교보다 협력을 선택하면 관계가 오래가요.',
    ],
    careerHints: [
      '영업, 협상, 프로젝트 리딩처럼 속도전 분야에 강해요.',
      '사업개발, 세일즈, 신규 시장 개척 업무와 잘 맞아요.',
    ],
  },
  JEONG_GWAN: {
    korean: '정관격',
    hanja: '正官格',
    category: '관성',
    description: [
      '질서와 책임이 핵심 축이 되는 구조예요.',
      '신뢰, 성실, 규범 준수 능력이 뛰어나요.',
    ],
    strengths: [
      '신뢰, 성실, 규범 준수 능력이 뛰어나요.',
      '원칙 80%에 상황 대응 20%를 더하면 균형이 좋아요.',
    ],
    cautions: [
      '완벽주의가 심해지면 유연성이 떨어질 수 있어요.',
      '기준을 강요하기보다 이유를 설명하면 갈등이 줄어요.',
    ],
    careerHints: [
      '조직 관리, 공공, 법/행정 같은 체계형 업무와 잘 맞아요.',
      '명확한 역할 체계가 있는 대규모 조직에서 성과가 좋아요.',
    ],
  },
  PYEON_GWAN: {
    korean: '편관격',
    hanja: '偏官格',
    category: '관성',
    description: [
      '압박을 동력으로 바꾸는 강한 통제 구조예요.',
      '결단력과 책임감이 강하고 위기 관리에 능해요.',
    ],
    strengths: [
      '결단력과 책임감이 강하고 위기 관리에 능해요.',
      '지시 전에 합의 과정을 짧게라도 넣으면 효과적이에요.',
    ],
    cautions: [
      '강한 통제 성향이 대인 긴장으로 이어질 수 있어요.',
      '정답 제시보다 경청 비율을 늘리면 신뢰가 높아져요.',
    ],
    careerHints: [
      '보안, 리스크 관리, 운영 총괄처럼 판단이 중요한 일에 유리해요.',
      '긴급 대응이나 고책임 의사결정이 필요한 분야에서 강해요.',
    ],
  },
  JEONG_JAE: {
    korean: '정재격',
    hanja: '正財格',
    category: '재성',
    description: [
      '안정적 자원 관리가 중심이 되는 현실형 구조예요.',
      '꾸준함과 계획성이 좋아 재정 감각이 탄탄해요.',
    ],
    strengths: [
      '꾸준함과 계획성이 좋아 재정 감각이 탄탄해요.',
      '저위험 기반을 지키면서 작은 실험을 병행하면 좋아요.',
    ],
    cautions: [
      '안전 지향이 과하면 기회를 놓칠 수 있어요.',
      '표현이 담백한 편이라 감사 표현을 의식적으로 늘리세요.',
    ],
    careerHints: [
      '재무, 회계, 운영, 자산 관리 같은 관리형 직무에 강해요.',
      '프로세스 품질과 비용 효율이 중요한 환경이 잘 맞아요.',
    ],
  },
  PYEON_JAE: {
    korean: '편재격',
    hanja: '偏財格',
    category: '재성',
    description: [
      '유통과 확장 흐름을 타는 외향적 재성 구조예요.',
      '사람과 기회를 연결하는 감각이 좋아요.',
    ],
    strengths: [
      '사람과 기회를 연결하는 감각이 좋아요.',
      '현금흐름 기준선과 손절 기준을 먼저 정하면 안정적이에요.',
    ],
    cautions: [
      '지출 확대, 과한 확장은 변동성을 키울 수 있어요.',
      '넓은 인맥 속에서도 핵심 관계를 따로 관리하세요.',
    ],
    careerHints: [
      '사업, 투자, 세일즈, 제휴 같은 확장형 분야가 잘 맞아요.',
      '외부 네트워크와 협업이 핵심인 직무가 좋아요.',
    ],
  },
  SIK_SIN: {
    korean: '식신격',
    hanja: '食神格',
    category: '식상',
    description: [
      '생산성과 표현력이 자연스럽게 흘러나오는 구조예요.',
      '꾸준한 산출과 실무 완성도가 높아요.',
    ],
    strengths: [
      '꾸준한 산출과 실무 완성도가 높아요.',
      '결과물 단위를 작게 쪼개 꾸준히 공개하면 성장이 빨라요.',
    ],
    cautions: [
      '편안함에 머물면 성장 속도가 느려질 수 있어요.',
      '돌봄 성향이 강해도 경계선은 분명히 잡아 주세요.',
    ],
    careerHints: [
      '콘텐츠 제작, 연구개발, 전문기술직에 강점이 있어요.',
      '교육, 코칭, 제품 운영 등 반복 품질이 중요한 직군에 맞아요.',
    ],
  },
  SANG_GWAN: {
    korean: '상관격',
    hanja: '傷官格',
    category: '식상',
    description: [
      '창의적 문제 제기와 변형 능력이 강한 구조예요.',
      '아이디어가 빠르고 표현력이 뛰어나요.',
    ],
    strengths: [
      '아이디어가 빠르고 표현력이 뛰어나요.',
      '비판 뒤에 대안을 붙이는 습관을 들이면 설득력이 높아져요.',
    ],
    cautions: [
      '직설적 표현이 오해를 부를 수 있어요.',
      '정확함보다 상대 감정의 타이밍을 먼저 보세요.',
    ],
    careerHints: [
      '기획, 마케팅, 브랜딩, 콘텐츠 전략 분야에 유리해요.',
      '문제 재정의가 중요한 전략/혁신 역할에서 강해요.',
    ],
  },
  JEONG_IN: {
    korean: '정인격',
    hanja: '正印格',
    category: '인성',
    description: [
      '학습과 보호 에너지가 중심인 안정형 구조예요.',
      '이해력, 배려, 지식 축적 능력이 좋아요.',
    ],
    strengths: [
      '이해력, 배려, 지식 축적 능력이 좋아요.',
      '준비 70% 시점에서 바로 실행으로 넘어가면 효과적이에요.',
    ],
    cautions: [
      '생각이 많아 실행이 늦어질 수 있어요.',
      '상대를 챙기되 과보호는 줄이면 균형이 좋아요.',
    ],
    careerHints: [
      '교육, 상담, 연구, 기획 지원 업무에 잘 맞아요.',
      '지식 정리와 전달이 핵심인 역할에서 강점이 커요.',
    ],
  },
  PYEON_IN: {
    korean: '편인격',
    hanja: '偏印格',
    category: '인성',
    description: [
      '직관과 전문성이 강하게 응축된 탐구형 구조예요.',
      '깊이 있는 분석과 독창적 관점이 강점이에요.',
    ],
    strengths: [
      '깊이 있는 분석과 독창적 관점이 강점이에요.',
      '혼자 정리한 내용을 주 1회 외부 피드백으로 검증하면 좋아요.',
    ],
    cautions: [
      '고립되면 실행과 소통이 약해질 수 있어요.',
      '말수가 적어도 감정 상태는 짧게 공유해 주세요.',
    ],
    careerHints: [
      '리서치, 데이터 분석, 전문 컨설팅과 궁합이 좋아요.',
      '정답이 없는 문제를 푸는 환경에서 잠재력이 커요.',
    ],
  },

  // ---------------------------------------------------------------------------
  //  Special 9: non-standard gyeokguk
  // ---------------------------------------------------------------------------
  HUA_QI: {
    korean: '화기격',
    hanja: '化氣格',
    category: '특수격',
    description: [
      '한쪽 기운이 선명하게 모여 추진력이 커진 구조예요.',
      '집중력과 몰입이 강해 단기간 성과를 내기 좋아요.',
    ],
    strengths: [
      '집중력과 몰입이 강해 단기간 성과를 내기 좋아요.',
      '휴식과 회복 루틴을 성과 루틴만큼 고정하면 지속력이 높아져요.',
    ],
    cautions: [
      '과열되면 균형이 무너지고 소진이 빨라질 수 있어요.',
      '강한 에너지 전달 전 상대 컨디션을 먼저 확인하세요.',
    ],
    careerHints: [
      '집중 투입형 프로젝트, 런칭, 캠페인 업무에 유리해요.',
      '단기 몰입이 필요한 전문 기술직에서 성과가 좋아요.',
    ],
  },
  ZHUAN_WANG: {
    korean: '전왕격',
    hanja: '專旺格',
    category: '특수격',
    description: [
      '특정 세력이 매우 강해 판을 주도하는 구조예요.',
      '리더십과 장악력이 강하고 방향 제시가 명확해요.',
    ],
    strengths: [
      '리더십과 장악력이 강하고 방향 제시가 명확해요.',
      '결정권은 유지하되 검토권을 팀에 열어 두면 더 강해져요.',
    ],
    cautions: [
      '강한 주도권이 독주로 보일 수 있어요.',
      '상대 의견을 반영한 흔적을 보여 주면 신뢰가 커져요.',
    ],
    careerHints: [
      '총괄 리더, 오너십 큰 역할, 전략 책임 직무에 강해요.',
      '독립적 의사결정이 가능한 경영/창업 분야와 잘 맞아요.',
    ],
  },
  CONG_GE: {
    korean: '종격',
    hanja: '從格',
    category: '특수격',
    description: [
      '강한 흐름에 순응해 전체 균형을 맞추는 특수 구조예요.',
      '환경 적응력이 뛰어나 큰 흐름을 잘 타요.',
    ],
    strengths: [
      '환경 적응력이 뛰어나 큰 흐름을 잘 타요.',
      '내 의지와 시장 흐름이 같은 방향인지 먼저 점검하면 좋아요.',
    ],
    cautions: [
      '흐름을 거스르는 선택은 부담이 크게 올 수 있어요.',
      '주도보다 조율 역할을 잡으면 관계가 편해져요.',
    ],
    careerHints: [
      '변화가 빠른 산업에서 트렌드 추종 전략이 유리해요.',
      '환경 변화를 빠르게 읽는 컨설팅, 전략 분야와 맞아요.',
    ],
  },
  CONG_CAI: {
    korean: '종재격',
    hanja: '從財格',
    category: '특수격',
    description: [
      '재성 흐름을 따라 자원과 성과에 집중하는 구조예요.',
      '현실 감각과 수익 기회 포착 능력이 좋아요.',
    ],
    strengths: [
      '현실 감각과 수익 기회 포착 능력이 좋아요.',
      '수익 목표와 함께 비수익 원칙도 같이 정하면 안정적이에요.',
    ],
    cautions: [
      '성과 중심이 과하면 가치 기준이 흔들릴 수 있어요.',
      '조건보다 신뢰를 먼저 쌓으면 관계가 안정돼요.',
    ],
    careerHints: [
      '사업개발, 영업전략, 투자 실행 분야에 강점이 있어요.',
      '수익 창출과 자원 관리가 핵심인 직무가 잘 맞아요.',
    ],
  },
  CONG_GUAN: {
    korean: '종관격',
    hanja: '從官格',
    category: '특수격',
    description: [
      '관성 질서를 따르며 역할 책임을 키우는 구조예요.',
      '조직 적응력과 책임 수행 능력이 뛰어나요.',
    ],
    strengths: [
      '조직 적응력과 책임 수행 능력이 뛰어나요.',
      '기준을 따르되 핵심 의견 1개는 꼭 제시하면 존재감이 올라가요.',
    ],
    cautions: [
      '지나친 눈치 보기로 자기 목소리를 잃기 쉬워요.',
      '맞춰 주기만 하지 말고 경계와 요청을 분명히 하세요.',
    ],
    careerHints: [
      '조직형 커리어, 공공영역, 운영관리와 잘 맞아요.',
      '체계적인 조직에서 역할 책임을 키워가는 직무가 유리해요.',
    ],
  },
  CONG_SHA: {
    korean: '종살격',
    hanja: '從殺格',
    category: '특수격',
    description: [
      '강한 압력 에너지를 통제력으로 전환하는 구조예요.',
      '극한 상황에서 판단력과 생존력이 강해요.',
    ],
    strengths: [
      '극한 상황에서 판단력과 생존력이 강해요.',
      '고강도 구간 뒤에는 회복 구간을 반드시 배치하면 지속력이 좋아요.',
    ],
    cautions: [
      '긴장 상태가 길어지면 피로와 예민함이 커질 수 있어요.',
      '방어적 태도보다 상황 설명을 먼저 하면 오해가 줄어요.',
    ],
    careerHints: [
      '위기대응, 보안, 감사, 품질관리 업무에 강해요.',
      '고압 환경에서 실력을 발휘하는 특수 전문직에 맞아요.',
    ],
  },
  CONG_ER: {
    korean: '종아격',
    hanja: '從兒格',
    category: '특수격',
    description: [
      '식상 흐름을 따라 표현과 생산으로 힘을 쓰는 구조예요.',
      '아이디어를 결과물로 바꾸는 전환 속도가 빨라요.',
    ],
    strengths: [
      '아이디어를 결과물로 바꾸는 전환 속도가 빨라요.',
      '핵심 주제 1~2개를 정해 지속적으로 누적하면 전문성이 커요.',
    ],
    cautions: [
      '산출은 많아도 방향이 분산될 수 있어요.',
      '말이 빠를수록 결론보다 공감 문장을 먼저 두세요.',
    ],
    careerHints: [
      '콘텐츠, 교육, 퍼포먼스 기반 직무에 잘 맞아요.',
      '개인 브랜딩과 창작 활동이 가능한 환경에서 빛나요.',
    ],
  },
  CONG_YIN: {
    korean: '종인격',
    hanja: '從印格',
    category: '특수격',
    description: [
      '인성 흐름을 따라 학습과 지원 역량을 극대화하는 구조예요.',
      '지식 흡수와 맥락 이해가 뛰어나요.',
    ],
    strengths: [
      '지식 흡수와 맥락 이해가 뛰어나요.',
      '배운 것을 즉시 적용하는 작은 실험을 붙이면 성장이 빨라요.',
    ],
    cautions: [
      '준비 과잉으로 타이밍을 놓치기 쉬워요.',
      '좋은 의도라도 간섭처럼 보이지 않게 질문형으로 말하세요.',
    ],
    careerHints: [
      '연구, 교육, 분석, 지원 기획 분야에 강점이 있어요.',
      '전문 지식 축적이 중요한 학술/연구 환경에 잘 맞아요.',
    ],
  },
  CONG_BI: {
    korean: '종비격',
    hanja: '從比格',
    category: '특수격',
    description: [
      '비겁 흐름을 따라 자립성과 결속을 키우는 구조예요.',
      '자기 추진력과 팀 결속을 동시에 만들 수 있어요.',
    ],
    strengths: [
      '자기 추진력과 팀 결속을 동시에 만들 수 있어요.',
      '동료 결속과 외부 협업 비율을 균형 있게 가져가면 확장이 쉬워요.',
    ],
    cautions: [
      '내 편/남의 편 구도가 강해지면 확장이 막힐 수 있어요.',
      '의리는 강점이지만 기준은 사람마다 다를 수 있음을 기억하세요.',
    ],
    careerHints: [
      '공동창업, 파트너십, 커뮤니티 기반 업무에 유리해요.',
      '팀 결속력이 중요한 현장 운영, 조직 리딩 분야와 잘 맞아요.',
    ],
  },
};

/**
 * Alias map for fuzzy lookup -- maps various romanization and Korean
 * variants to the canonical GyeokgukCode.
 */
const GYEOKGUK_ALIASES: Readonly<Record<string, GyeokgukCode>> = {
  // Normal 10
  '비견격': 'BI_GYEON', '비견': 'BI_GYEON', 'bi_gyeon': 'BI_GYEON', 'bigyeon': 'BI_GYEON',
  '겁재격': 'GYEOB_JAE', '겁재': 'GYEOB_JAE', 'gyeob_jae': 'GYEOB_JAE', 'geob_jae': 'GYEOB_JAE',
  'gyeobjae': 'GYEOB_JAE', 'geobjae': 'GYEOB_JAE',
  '정관격': 'JEONG_GWAN', '정관': 'JEONG_GWAN', 'jeong_gwan': 'JEONG_GWAN', 'jeonggwan': 'JEONG_GWAN',
  '편관격': 'PYEON_GWAN', '편관': 'PYEON_GWAN', 'pyeon_gwan': 'PYEON_GWAN', 'pyeongwan': 'PYEON_GWAN',
  '정재격': 'JEONG_JAE', '정재': 'JEONG_JAE', 'jeong_jae': 'JEONG_JAE', 'jeongjae': 'JEONG_JAE',
  '편재격': 'PYEON_JAE', '편재': 'PYEON_JAE', 'pyeon_jae': 'PYEON_JAE', 'pyeonjae': 'PYEON_JAE',
  '식신격': 'SIK_SIN', '식신': 'SIK_SIN', 'sik_sin': 'SIK_SIN', 'sik_shin': 'SIK_SIN',
  'siksin': 'SIK_SIN', 'sikshin': 'SIK_SIN',
  '상관격': 'SANG_GWAN', '상관': 'SANG_GWAN', 'sang_gwan': 'SANG_GWAN', 'sanggwan': 'SANG_GWAN',
  '정인격': 'JEONG_IN', '정인': 'JEONG_IN', 'jeong_in': 'JEONG_IN', 'jeongin': 'JEONG_IN',
  '편인격': 'PYEON_IN', '편인': 'PYEON_IN', 'pyeon_in': 'PYEON_IN', 'pyeonin': 'PYEON_IN',
  // Special 9
  '화기격': 'HUA_QI', '화기': 'HUA_QI', 'hua_qi': 'HUA_QI', 'huaqi': 'HUA_QI',
  '전왕격': 'ZHUAN_WANG', '전왕': 'ZHUAN_WANG', 'zhuan_wang': 'ZHUAN_WANG', 'zhuanwang': 'ZHUAN_WANG',
  '종격': 'CONG_GE', 'cong_ge': 'CONG_GE', 'congge': 'CONG_GE',
  '종재격': 'CONG_CAI', '종재': 'CONG_CAI', 'cong_cai': 'CONG_CAI', 'congcai': 'CONG_CAI',
  '종관격': 'CONG_GUAN', '종관': 'CONG_GUAN', 'cong_guan': 'CONG_GUAN', 'congguan': 'CONG_GUAN',
  '종살격': 'CONG_SHA', '종살': 'CONG_SHA', 'cong_sha': 'CONG_SHA', 'congsha': 'CONG_SHA',
  '종아격': 'CONG_ER', '종아': 'CONG_ER', 'cong_er': 'CONG_ER', 'conger': 'CONG_ER',
  '종인격': 'CONG_YIN', '종인': 'CONG_YIN', 'cong_yin': 'CONG_YIN', 'congyin': 'CONG_YIN',
  '종비격': 'CONG_BI', '종비': 'CONG_BI', 'cong_bi': 'CONG_BI', 'congbi': 'CONG_BI',
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-/]/g, '');
}

/**
 * Look up a gyeokguk entry by code, Korean name, or romanization.
 * Returns null if no match is found.
 */
export function findGyeokgukEntry(name?: string | null): GyeokgukEncyclopediaEntry | null {
  if (typeof name !== 'string') return null;

  const normalized = normalizeToken(name);
  if (!normalized) return null;

  // 1. Direct code match (e.g. 'BI_GYEON')
  const upperName = name.trim().toUpperCase() as GyeokgukCode;
  if (upperName in GYEOKGUK_ENCYCLOPEDIA) {
    return GYEOKGUK_ENCYCLOPEDIA[upperName];
  }

  // 2. Alias exact match
  const aliasCode = GYEOKGUK_ALIASES[normalized];
  if (aliasCode) return GYEOKGUK_ENCYCLOPEDIA[aliasCode];

  // 3. Fuzzy substring match (only if input is long enough)
  if (normalized.length < 2) return null;

  const aliasKeys = Object.keys(GYEOKGUK_ALIASES);
  for (let i = 0; i < aliasKeys.length; i++) {
    const alias = aliasKeys[i];
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return GYEOKGUK_ENCYCLOPEDIA[GYEOKGUK_ALIASES[alias]];
    }
  }

  return null;
}

/**
 * Direct code-based lookup. Throws if code is invalid.
 */
export function getGyeokgukEncyclopediaEntry(code: GyeokgukCode): GyeokgukEncyclopediaEntry {
  return GYEOKGUK_ENCYCLOPEDIA[code];
}
