/**
 * shinsalEncyclopedia.ts -- Shinsal (神殺) knowledge base
 *
 * Comprehensive encyclopedia of all major shinsal types used in saju analysis.
 * Each entry provides the Korean name, category (auspicious/inauspicious/neutral),
 * core meaning, descriptive paragraphs, and actionable daily tips.
 */

export interface ShinsalEncyclopediaEntry {
  readonly korean: string;
  readonly type: 'auspicious' | 'inauspicious' | 'neutral';
  readonly importance: number;  // 0-100, saju-theoretical importance
  readonly meaning: string;
  readonly description: readonly string[];
  readonly tips: readonly string[];
}

export const SHINSAL_ENCYCLOPEDIA: Record<string, ShinsalEncyclopediaEntry> = {
  // ────────────────────────────────────────────────────────────
  //  Auspicious (길신)
  // ────────────────────────────────────────────────────────────

  CHEON_EUL_GUI_IN: {
    korean: '천을귀인',
    type: 'auspicious',
    importance: 95,
    meaning: '도움이 필요할 때 사람운이 붙는 대표 길신입니다.',
    description: [
      '위기 때 조력자를 만나기 쉽습니다.',
      '일 처리에서 귀인의 도움으로 속도가 납니다.',
    ],
    tips: [
      '혼자 버티지 말고 도움을 요청하세요.',
      '받은 도움은 꼭 기록하고 감사 표시를 하세요.',
      '하루 1번 감사 메시지를 보내보세요.',
    ],
  },

  TAE_GEUK_GUI_IN: {
    korean: '태극귀인',
    type: 'auspicious',
    importance: 80,
    meaning: '큰 흐름을 읽고 중심을 잡는 힘이 강한 길신입니다.',
    description: [
      '판단이 흔들리지 않아 결정이 안정적입니다.',
      '복잡한 상황에서도 핵심을 잘 봅니다.',
    ],
    tips: [
      '큰 방향은 유지하되 작은 실행은 유연하게 바꾸세요.',
      '고집으로 보이지 않게 근거를 같이 설명하세요.',
      '아침에 오늘의 핵심 1가지를 정해보세요.',
    ],
  },

  MUN_CHANG_GUI_IN: {
    korean: '문창귀인',
    type: 'auspicious',
    importance: 75,
    meaning: '학습력, 문서력, 표현력이 좋아지는 길신입니다.',
    description: [
      '시험, 공부, 문서 업무에 강합니다.',
      '아이디어를 글로 정리하는 능력이 좋습니다.',
    ],
    tips: [
      '완벽주의로 시작을 늦추지 마세요.',
      '배운 것을 바로 써보며 감각을 유지하세요.',
      '매일 10분 읽고 5줄 요약하는 습관을 들여보세요.',
    ],
  },

  MUN_GOK_GUI_IN: {
    korean: '문곡귀인',
    type: 'auspicious',
    importance: 65,
    meaning: '감수성과 기획력이 함께 살아나는 길신입니다.',
    description: [
      '콘텐츠, 기획, 예술 감각이 좋아집니다.',
      '설득력 있는 스토리 구성이 됩니다.',
    ],
    tips: [
      '감정 기복이 클 때는 일정 밀도를 낮추세요.',
      '영감만 기다리지 말고 마감 시간을 먼저 고정하세요.',
      '아이디어 노트에 하루 3개 적는 습관을 만들어 보세요.',
    ],
  },

  HAK_DANG_GUI_IN: {
    korean: '학당귀인',
    type: 'auspicious',
    importance: 60,
    meaning: '배움과 성장을 꾸준히 밀어주는 길신입니다.',
    description: [
      '기초를 빠르게 익히고 체계화합니다.',
      '멘토 운과 교육 운이 붙기 쉽습니다.',
    ],
    tips: [
      '배우기만 하지 말고 바로 실전에 연결하세요.',
      '비교보다 누적 학습량을 점검하세요.',
      '하루 20분 복습 루틴을 만들어 보세요.',
    ],
  },

  CHEON_DEOK_GUI_IN: {
    korean: '천덕귀인',
    type: 'auspicious',
    importance: 70,
    meaning: '위험을 줄이고 일이 좋게 풀리게 돕는 길신입니다.',
    description: [
      '돌발 문제의 손실을 줄이는 힘이 있습니다.',
      '주변 도움과 보호를 받기 쉽습니다.',
    ],
    tips: [
      '무리한 승부보다 안전한 선택을 우선하세요.',
      '문제 발생 시 빠르게 공유하고 수습하세요.',
      '중요 결정 전 체크리스트 3개를 확인해 보세요.',
    ],
  },

  WOL_DEOK_GUI_IN: {
    korean: '월덕귀인',
    type: 'auspicious',
    importance: 65,
    meaning: '한 달 흐름 속에서 귀인운과 완충운이 좋아지는 길신입니다.',
    description: [
      '타이밍을 잘 타면 일이 쉽게 풀립니다.',
      '팀 협업에서 도움을 받기 좋습니다.',
    ],
    tips: [
      '좋은 흐름일 때 일을 몰아 과로하지 마세요.',
      '협업 기회를 혼자 성과로 만들지 마세요.',
      '월간 목표를 주간 단위로 나눠보세요.',
    ],
  },

  BOK_SEONG_GUI_IN: {
    korean: '복성귀인',
    type: 'auspicious',
    importance: 60,
    meaning: '전체 운의 완충 작용이 좋은 길신입니다.',
    description: [
      '문제가 생겨도 회복 탄력이 큽니다.',
      '좋은 인연과 기회가 이어지기 쉽습니다.',
    ],
    tips: [
      '안심하고 방심하지는 마세요.',
      '복이 들어올 때 저축/투자 비율을 정해두세요.',
      '주 1회 인간관계 정리와 감사 연락을 해보세요.',
    ],
  },

  GEUM_YEO_GUI_IN: {
    korean: '금여귀인',
    type: 'auspicious',
    importance: 55,
    meaning: '품위, 생활 수준, 재물 안정에 도움을 주는 길신입니다.',
    description: [
      '생활 질을 높이는 기회를 잡기 쉽습니다.',
      '재물 운이 부드럽게 흐릅니다.',
    ],
    tips: [
      '체면 소비를 줄이고 실속 소비를 늘리세요.',
      '큰 지출은 하루 유예 후 결정하세요.',
      '불필요 구독을 하나씩 정리해 보세요.',
    ],
  },

  HONG_LUAN: {
    korean: '홍란',
    type: 'auspicious',
    importance: 65,
    meaning: '인연운과 호감운이 올라가는 길신입니다.',
    description: [
      '대인관계에서 주목을 받기 쉽습니다.',
      '연애, 소개, 협업 연결이 잘 됩니다.',
    ],
    tips: [
      '관심을 받는 만큼 경계도 분명히 하세요.',
      '관계 속도보다 신뢰 확인을 우선하세요.',
      '대화에서 경청 비율을 의식적으로 늘려보세요.',
    ],
  },

  CHEON_HUI: {
    korean: '천희',
    type: 'auspicious',
    importance: 60,
    meaning: '기쁨, 축하, 좋은 소식이 들어오기 쉬운 길신입니다.',
    description: [
      '분위기를 밝게 만들고 복을 부릅니다.',
      '행사, 만남, 네트워킹에 유리합니다.',
    ],
    tips: [
      '즐거운 흐름에서도 일정과 돈 관리가 필요합니다.',
      '약속을 과하게 늘려 체력을 소진하지 마세요.',
      '주간 약속 수 상한을 정해보세요.',
    ],
  },

  LOK_SHIN: {
    korean: '록신',
    type: 'auspicious',
    importance: 70,
    meaning: '일과 재물의 기본 체력을 키워주는 길신입니다.',
    description: [
      '수입 기반을 안정적으로 만들기 쉽습니다.',
      '실무 성과가 꾸준히 나옵니다.',
    ],
    tips: [
      '버는 힘과 쓰는 힘을 같이 관리하세요.',
      '반복 업무 자동화를 빨리 도입하세요.',
      '오늘의 핵심 업무 1개를 선완료하는 습관을 들여보세요.',
    ],
  },

  BAN_AN_SAL: {
    korean: '반안살',
    type: 'auspicious',
    importance: 55,
    meaning: '자리와 평판이 안정되는 쪽으로 작동하는 길신입니다.',
    description: [
      '승진, 자리 굳히기, 역할 안정에 유리합니다.',
      '기반을 차근차근 넓히기 좋습니다.',
    ],
    tips: [
      '안정에 익숙해져 도전을 멈추지 마세요.',
      '자리 유지보다 성장 지표도 함께 보세요.',
      '주간 성장 목표 1개를 추가해 보세요.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  //  Neutral (중립)
  // ────────────────────────────────────────────────────────────

  DOHWA: {
    korean: '도화살',
    type: 'neutral',
    importance: 80,
    meaning: '매력과 주목도가 높아지지만 감정 변동도 커질 수 있습니다.',
    description: [
      '대중성, 표현력, 인간관계 확장에 유리합니다.',
      '관계 과열이나 오해가 생기기 쉽습니다.',
    ],
    tips: [
      '호감 신호와 약속 신호를 분리해서 표현하세요.',
      '감정이 큰 날에는 큰 결정을 미루세요.',
      '중요 메시지는 1회 재검토 후 발송하세요.',
    ],
  },

  YEOKMA: {
    korean: '역마살',
    type: 'neutral',
    importance: 75,
    meaning: '이동과 변화가 많아지는 신살입니다.',
    description: [
      '새 기회 탐색, 영업, 여행, 전환에 유리합니다.',
      '정착 피로와 루틴 붕괴 위험이 있습니다.',
    ],
    tips: [
      '움직임이 많은 날은 일정 70%만 채우세요.',
      '이동 전 체크리스트로 실수를 줄이세요.',
      '주 2회는 고정 루틴을 유지해 보세요.',
    ],
  },

  HUAGAI: {
    korean: '화개살',
    type: 'neutral',
    importance: 65,
    meaning: '내면 집중, 예술성, 종교성, 연구성이 커지는 신살입니다.',
    description: [
      '깊이 있는 몰입과 창작에 좋습니다.',
      '고립감이 커지고 소통이 줄 수 있습니다.',
    ],
    tips: [
      '몰입 시간과 소통 시간을 분리해 잡으세요.',
      '감정이 가라앉는 날엔 사람 접점을 일부러 만드세요.',
      '집중 50분 + 소통 10분 루틴을 시도해 보세요.',
    ],
  },

  KUI_GANG: {
    korean: '괴강',
    type: 'neutral',
    importance: 75,
    meaning: '기세와 결단이 강한 대신 강약 조절이 중요한 신살입니다.',
    description: [
      '위기 대응력과 돌파력이 좋습니다.',
      '강한 말투, 대인 마찰이 생길 수 있습니다.',
    ],
    tips: [
      '강한 의견일수록 말속도를 늦추세요.',
      '결론 전에 상대 요약을 먼저 확인하세요.',
      '감정이 올라오면 3호흡 후 발언하세요.',
    ],
  },

  YANG_IN: {
    korean: '양인',
    type: 'neutral',
    importance: 80,
    meaning: '행동력과 생존력이 강하지만 과속 위험이 있는 신살입니다.',
    description: [
      '밀어붙이는 힘이 좋아 성과를 냅니다.',
      '공격적으로 비치거나 충돌할 수 있습니다.',
    ],
    tips: [
      '승부처와 휴식처를 분리하세요.',
      '중요한 대화는 단정적 표현을 줄이세요.',
      '하루 1회 의도적 휴식 시간을 확보하세요.',
    ],
  },

  HONG_YEOM_SAL: {
    korean: '홍염살',
    type: 'neutral',
    importance: 70,
    meaning: '강한 끌림과 존재감이 생기지만 관계 피로도도 같이 올 수 있습니다.',
    description: [
      '매력과 몰입도가 높아 성과를 끌어올리기 좋습니다.',
      '집착, 질투, 오해 같은 감정 이슈가 생기기 쉽습니다.',
    ],
    tips: [
      '관계 경계를 명확히 하세요.',
      '감정이 격할 때는 답장을 늦추세요.',
      '감정 고조 시 10분 산책 후 답장하세요.',
    ],
  },

  JANGSEONG: {
    korean: '장성',
    type: 'neutral',
    importance: 55,
    meaning: '리더십과 추진력이 강해지는 신살입니다.',
    description: [
      '주도권을 잡고 성과를 내기 좋습니다.',
      '강한 추진이 독주로 보일 수 있습니다.',
    ],
    tips: [
      '결정 전에 반대 의견을 1개는 듣고 가세요.',
      '속도와 합의의 균형을 맞추세요.',
      '업무 지시 후 이해 확인을 꼭 해보세요.',
    ],
  },

  GONGMANG: {
    korean: '공망',
    type: 'neutral',
    importance: 90,
    meaning: '힘이 비거나 공허감이 오는 구간을 뜻하는 신호입니다.',
    description: [
      '비움과 재정비에는 도움이 됩니다.',
      '허탈감, 계획 누수, 실행 공백이 생길 수 있습니다.',
    ],
    tips: [
      '큰 목표를 잘게 쪼개서 즉시 행동하세요.',
      '기대치보다 루틴 유지에 집중하세요.',
      '5분짜리 시작 행동 1개를 바로 실행하세요.',
    ],
  },

  BI_IN_SAL: {
    korean: '비인살',
    type: 'neutral',
    importance: 50,
    meaning: '예민하고 날카로운 집중력이 커지는 신살입니다.',
    description: [
      '위기 감지와 빠른 반응에 강합니다.',
      '긴장 과다, 예민 반응이 쌓일 수 있습니다.',
    ],
    tips: [
      '자극이 큰 환경 노출 시간을 제한하세요.',
      '정확성 업무 후에는 완충 시간을 두세요.',
      '집중 후 5분 이완 스트레칭을 해보세요.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  //  Inauspicious (흉살)
  // ────────────────────────────────────────────────────────────

  JI_SAL: {
    korean: '지살',
    type: 'inauspicious',
    importance: 55,
    meaning: '움직임이 늘면서 기반이 흔들리기 쉬운 신살입니다.',
    description: [
      '환경 적응력을 키우는 계기가 됩니다.',
      '정착력 저하, 피로 누적이 생길 수 있습니다.',
    ],
    tips: [
      '이동과 변화가 많은 주엔 일정을 줄이세요.',
      '기반 루틴(수면/식사)을 먼저 고정하세요.',
      '이동 많은 날 저녁 일정을 비워보세요.',
    ],
  },

  WOL_SAL: {
    korean: '월살',
    type: 'inauspicious',
    importance: 60,
    meaning: '월 단위 변동과 컨디션 기복이 커질 수 있는 신살입니다.',
    description: [
      '주기 관리 습관을 만들면 오히려 안정됩니다.',
      '월초와 월말에 피로와 변수 체감이 커질 수 있습니다.',
    ],
    tips: [
      '월간 계획에 휴식 블록을 먼저 넣으세요.',
      '중요 결정은 컨디션 좋은 날로 옮기세요.',
      '주간 체력 점수를 기록하는 습관을 들여보세요.',
    ],
  },

  MANG_SHIN_SAL: {
    korean: '망신살',
    type: 'inauspicious',
    importance: 65,
    meaning: '체면 손상, 구설, 실수 노출에 주의가 필요한 신살입니다.',
    description: [
      '말과 행동을 다듬는 계기가 됩니다.',
      '작은 실수가 크게 보일 수 있습니다.',
    ],
    tips: [
      '즉흥 발언을 줄이고 확인 후 말하세요.',
      '공개 채널 글은 한 번 더 검토하세요.',
      '발송 전 30초 재검토 습관을 들여보세요.',
    ],
  },

  YUK_HAE_SAL: {
    korean: '육해살',
    type: 'inauspicious',
    importance: 75,
    meaning: '관계 손상과 피로 누적에 주의가 필요한 신살입니다.',
    description: [
      '불필요한 관계를 정리하는 계기가 됩니다.',
      '신뢰 흔들림이나 협업 피로가 커질 수 있습니다.',
    ],
    tips: [
      '불편한 신호를 초기에 말로 정리하세요.',
      '요청과 한계를 같이 전달하세요.',
      '협업 전 역할과 마감을 재확인하세요.',
    ],
  },

  GEOB_SAL: {
    korean: '겁살',
    type: 'inauspicious',
    importance: 80,
    meaning: '경쟁, 손재, 돌발 리스크에 주의가 필요한 신살입니다.',
    description: [
      '위험감지력을 키우면 손실을 줄일 수 있습니다.',
      '무리한 투자나 무리수 선택이 늘 수 있습니다.',
    ],
    tips: [
      '큰 돈이나 큰 결정은 하루 유예하세요.',
      '비교 심리가 강한 날엔 앱 사용 시간을 줄이세요.',
      '지출 상한선을 미리 정해두세요.',
    ],
  },

  JAESAL: {
    korean: '재살',
    type: 'inauspicious',
    importance: 70,
    meaning: '사고성 변수와 날카로운 충돌에 주의가 필요한 신살입니다.',
    description: [
      '안전관리 습관을 만들면 오히려 탄탄해집니다.',
      '급한 이동, 급한 결정에서 실수가 날 수 있습니다.',
    ],
    tips: [
      '서두를수록 속도를 20% 낮추세요.',
      '위험 작업은 체크리스트 후 진행하세요.',
      '이동 전 안전 확인을 습관화하세요.',
    ],
  },

  CHEON_SAL: {
    korean: '천살',
    type: 'inauspicious',
    importance: 60,
    meaning: '예상 밖 변수와 피로 누적에 주의가 필요한 신살입니다.',
    description: [
      '돌발 대응 체계를 만들 기회가 됩니다.',
      '외부 변수로 일정 지연이 생길 수 있습니다.',
    ],
    tips: [
      '중요 일정엔 예비 시간을 꼭 두세요.',
      '무리한 강행보다 일정 재조정이 낫습니다.',
      '핵심 일정 전날 준비를 완료해 두세요.',
    ],
  },

  BAEK_HO: {
    korean: '백호',
    type: 'inauspicious',
    importance: 75,
    meaning: '강한 기세와 함께 사고성 리스크 관리가 필요한 신살입니다.',
    description: [
      '결단력과 실행력은 매우 좋습니다.',
      '과속, 충돌, 부상성 변수에 주의가 필요합니다.',
    ],
    tips: [
      '속도보다 정확도를 우선하세요.',
      '감정 고조 시 즉시 휴식 후 재개하세요.',
      '운동이나 이동 시 보호 습관을 지키세요.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  //  Relation-based inauspicious (관계성 흉살)
  // ────────────────────────────────────────────────────────────

  HYEONG_SAL: {
    korean: '형살',
    type: 'inauspicious',
    importance: 85,
    meaning: '갈등과 마찰이 생기기 쉬운 강한 기운의 신살입니다.',
    description: [
      '직설적인 표현과 강한 행동력이 갈등의 원인이 될 수 있습니다.',
      '형살의 에너지를 잘 다스리면 오히려 단호한 결단력으로 작용합니다.',
    ],
    tips: [
      '의견 충돌 시 한 박자 쉬고 말하세요.',
      '감정이 격해질 때 자리를 잠시 비우는 것도 방법입니다.',
      '주기적으로 스트레스를 해소할 루틴을 만드세요.',
    ],
  },

  CHUNG_SAL: {
    korean: '충살',
    type: 'inauspicious',
    importance: 80,
    meaning: '급격한 변화와 충돌의 에너지가 강한 신살입니다.',
    description: [
      '환경이나 관계에서 급작스러운 전환이 일어날 수 있습니다.',
      '충돌의 에너지를 변화의 동력으로 전환하면 도약의 기회가 됩니다.',
    ],
    tips: [
      '변화가 올 때 저항보다 유연한 대응을 우선하세요.',
      '중요한 계약이나 결정은 충분히 검토 후 진행하세요.',
      '예비 계획을 항상 준비해 두는 습관을 들이세요.',
    ],
  },

  HAE_SAL: {
    korean: '해살',
    type: 'inauspicious',
    importance: 65,
    meaning: '은밀한 손해와 뒤탈이 생기기 쉬운 신살입니다.',
    description: [
      '겉으로 드러나지 않는 문제가 서서히 커질 수 있습니다.',
      '세심한 점검 습관이 해살의 영향을 크게 줄여줍니다.',
    ],
    tips: [
      '계약서와 문서를 꼼꼼히 확인하세요.',
      '신뢰가 쌓이지 않은 상대와의 거래는 신중하게 진행하세요.',
      '작은 불편도 방치하지 말고 초기에 해결하세요.',
    ],
  },

  PA_SAL: {
    korean: '파살',
    type: 'inauspicious',
    importance: 60,
    meaning: '기존의 것이 깨지거나 흩어지기 쉬운 신살입니다.',
    description: [
      '완성 직전에 틀어지거나 계획이 수정되는 일이 생길 수 있습니다.',
      '파살은 낡은 틀을 깨고 새롭게 시작할 기회이기도 합니다.',
    ],
    tips: [
      '중요한 일은 마무리 점검을 반드시 하세요.',
      '완벽을 고집하기보다 유연한 수정 능력을 키우세요.',
      '백업과 대안을 미리 준비해 두세요.',
    ],
  },

  WONJIN_SAL: {
    korean: '원진살',
    type: 'inauspicious',
    importance: 70,
    meaning: '미묘한 거리감과 불화가 생기기 쉬운 신살입니다.',
    description: [
      '가까운 사이에서 오히려 미묘한 갈등이 반복될 수 있습니다.',
      '거리감을 인식하고 소통 방식을 바꾸면 관계가 개선됩니다.',
    ],
    tips: [
      '상대의 입장을 먼저 듣는 연습을 하세요.',
      '오해가 쌓이기 전에 작은 대화로 풀어가세요.',
      '관계에 기대치를 낮추고 감사를 늘리세요.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  //  Additional neutral (추가 중립)
  // ────────────────────────────────────────────────────────────

  GEOKGAK_SAL: {
    korean: '격각살',
    type: 'neutral',
    importance: 50,
    meaning: '움직임과 변화가 잦아지는 신살입니다.',
    description: [
      '거주지 이동이나 직업 변화가 생기기 쉽습니다.',
      '변화를 두려워하지 않으면 새로운 기회를 잡을 수 있습니다.',
    ],
    tips: [
      '변화가 올 때 핵심 루틴은 유지하세요.',
      '이동이 잦은 시기에는 건강관리를 우선하세요.',
      '새 환경에 적응할 시간적 여유를 미리 확보하세요.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  //  Additional auspicious (추가 길신)
  // ────────────────────────────────────────────────────────────

  GUK_IN_GUI_IN: {
    korean: '국인귀인',
    type: 'auspicious',
    importance: 55,
    meaning: '공적인 영역에서 도움을 받기 쉬운 길신입니다.',
    description: [
      '시험, 면접, 공공기관 업무에서 순조로운 흐름이 기대됩니다.',
      '공식적인 자리에서 인정을 받기 좋습니다.',
    ],
    tips: [
      '공적 기회가 올 때 준비를 미리 해두세요.',
      '문서와 서류 정리를 꼼꼼히 하세요.',
      '공식 석상에서의 매너를 챙기세요.',
    ],
  },

  CHEON_JU_GUI_IN: {
    korean: '천주귀인',
    type: 'auspicious',
    importance: 60,
    meaning: '하늘의 도움과 보이지 않는 귀인운이 따르는 길신입니다.',
    description: [
      '어려운 상황에서도 우연한 도움을 받기 쉽습니다.',
      '기도, 명상, 마음 정리를 통해 기운을 더욱 강화할 수 있습니다.',
    ],
    tips: [
      '감사하는 마음을 습관적으로 표현하세요.',
      '어려울 때 주변에 도움을 요청하는 용기를 내세요.',
      '작은 행운도 기록하며 긍정 에너지를 모으세요.',
    ],
  },

  CHEON_GWAN_GUI_IN: {
    korean: '천관귀인',
    type: 'auspicious',
    importance: 65,
    meaning: '관직과 직위에서 좋은 기운을 받는 길신입니다.',
    description: [
      '승진, 임명, 조직 내 역할 확대에 유리합니다.',
      '리더십을 발휘할 기회가 자연스럽게 찾아옵니다.',
    ],
    tips: [
      '맡은 역할에 최선을 다하면 인정이 따릅니다.',
      '팀원과의 신뢰를 쌓는 데 시간을 투자하세요.',
      '리더의 자리는 섬김으로 더 빛난다는 것을 기억하세요.',
    ],
  },

  CHEON_BOK_GUI_IN: {
    korean: '천복귀인',
    type: 'auspicious',
    importance: 60,
    meaning: '하늘이 내린 복으로 전반적 운이 안정되는 길신입니다.',
    description: [
      '큰 위기 없이 순탄한 흐름이 이어지기 쉽습니다.',
      '복의 기운이 주변 사람에게도 전해지는 타입입니다.',
    ],
    tips: [
      '안정적인 시기에 미래를 위한 투자를 하세요.',
      '복을 나누면 더 큰 복이 돌아옵니다.',
      '감사 일기를 쓰며 복의 흐름을 의식하세요.',
    ],
  },

  WOL_DEOK_HAP: {
    korean: '월덕합',
    type: 'auspicious',
    importance: 55,
    meaning: '월덕의 기운이 합으로 더욱 강화된 길신입니다.',
    description: [
      '월간 흐름 속에서 귀인과 도움의 기운이 강해집니다.',
      '협업과 팀 프로젝트에서 좋은 결과가 기대됩니다.',
    ],
    tips: [
      '팀 작업 시 적극적으로 참여하세요.',
      '도움받은 것을 기억하고 돌려주세요.',
      '월간 목표를 세우고 성취감을 쌓아가세요.',
    ],
  },

  DEOK_SU_GUI_IN: {
    korean: '덕수귀인',
    type: 'auspicious',
    importance: 50,
    meaning: '덕과 수명의 기운이 안정적으로 흐르는 길신입니다.',
    description: [
      '건강과 장수에 좋은 영향을 미칩니다.',
      '인덕이 있어 주변의 신뢰를 얻기 쉽습니다.',
    ],
    tips: [
      '건강 검진을 정기적으로 받으세요.',
      '꾸준한 운동 루틴을 유지하세요.',
      '선한 행동이 덕의 기운을 더욱 키워줍니다.',
    ],
  },

  CHEON_DEOK_HAP: {
    korean: '천덕합',
    type: 'auspicious',
    importance: 55,
    meaning: '천덕의 기운이 합으로 강화되어 보호력이 큰 길신입니다.',
    description: [
      '위험한 상황에서도 큰 탈 없이 넘기기 쉽습니다.',
      '사람과의 인연이 좋아 도움의 손길이 많습니다.',
    ],
    tips: [
      '위기 상황에서 침착함을 유지하세요.',
      '좋은 인연을 소중히 여기고 관계를 유지하세요.',
      '안전에 관한 기본 수칙을 지키세요.',
    ],
  },

  CHEON_UI: {
    korean: '천의',
    type: 'auspicious',
    importance: 50,
    meaning: '의술과 치유의 기운이 깃든 길신입니다.',
    description: [
      '건강 회복력이 좋고 의료 관련 운이 따릅니다.',
      '다른 사람을 돌보고 치유하는 능력이 있습니다.',
    ],
    tips: [
      '몸의 신호에 민감하게 반응하세요.',
      '건강 관련 지식을 꾸준히 쌓으세요.',
      '주변 사람의 건강도 챙기는 여유를 가지세요.',
    ],
  },

  CHEON_WOL_DEOK: {
    korean: '천월덕',
    type: 'auspicious',
    importance: 70,
    meaning: '천덕과 월덕이 함께하여 보호와 복의 기운이 큰 길신입니다.',
    description: [
      '하늘과 달의 복이 함께하여 전반적 운이 안정됩니다.',
      '큰 어려움이 와도 주변의 도움으로 극복하기 쉽습니다.',
    ],
    tips: [
      '좋은 운을 당연히 여기지 말고 감사하세요.',
      '복이 들어올 때 저축과 준비를 함께 하세요.',
      '주변에 베풀면 복이 더 커집니다.',
    ],
  },

  CHEON_SA: {
    korean: '천사일',
    type: 'auspicious',
    importance: 50,
    meaning: '하늘의 사면을 받아 어려움이 해소되는 길신입니다.',
    description: [
      '과거의 실수나 문제가 자연스럽게 해결되기 쉽습니다.',
      '새로운 시작에 좋은 기운이 함께합니다.',
    ],
    tips: [
      '과거에 연연하지 말고 앞을 향해 나아가세요.',
      '새 시작을 위한 작은 행동을 오늘 바로 해보세요.',
      '용서하고 놓아주는 연습이 마음을 가볍게 합니다.',
    ],
  },
} as const;

// ---------------------------------------------------------------------------
//  Fuzzy lookup helper
// ---------------------------------------------------------------------------

/**
 * Look up a shinsal entry by code (e.g. 'CHEON_EUL_GUI_IN'),
 * Korean name (e.g. '천을귀인'), or a fuzzy substring match.
 * Returns null if no match is found.
 */
export function findShinsalEntry(name?: string | null): ShinsalEncyclopediaEntry | null {
  if (typeof name !== 'string') return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  // 1. Direct code match (e.g. 'CHEON_EUL_GUI_IN')
  const upper = trimmed.toUpperCase();
  if (upper in SHINSAL_ENCYCLOPEDIA) {
    return SHINSAL_ENCYCLOPEDIA[upper];
  }

  // 2. Korean name exact match
  for (const entry of Object.values(SHINSAL_ENCYCLOPEDIA)) {
    if (entry.korean === trimmed) return entry;
  }

  // 3. Fuzzy: normalize and substring match
  const normalized = trimmed.toLowerCase().replace(/[^a-z가-힣0-9]/g, '');
  if (normalized.length < 2) return null;

  for (const [code, entry] of Object.entries(SHINSAL_ENCYCLOPEDIA)) {
    const codeNorm = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const koreanNorm = entry.korean.replace(/[^가-힣]/g, '');
    if (codeNorm.includes(normalized) || normalized.includes(codeNorm)) return entry;
    if (koreanNorm.includes(normalized) || normalized.includes(koreanNorm)) return entry;
  }

  return null;
}
