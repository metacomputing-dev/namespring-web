export type ShinsalCategory = '길신' | '흉살' | '중립';

export interface ShinsalEncyclopediaEntry {
  readonly koreanName: string;
  readonly category: ShinsalCategory;
  readonly shortMeaning: string;
  readonly strengthsOrRisks: readonly string[];
  readonly mitigationTips: readonly string[];
  readonly dailyHabits: readonly string[];
}

export const SHINSAL_ENCYCLOPEDIA: Record<string, ShinsalEncyclopediaEntry> = {
  CHEON_EUL_GUI_IN: {
    koreanName: '천을귀인',
    category: '길신',
    shortMeaning: '도움이 필요할 때 사람운이 붙는 대표 길신입니다.',
    strengthsOrRisks: ['위기 때 조력자를 만나기 쉽습니다.', '일 처리에서 귀인의 도움으로 속도가 납니다.'],
    mitigationTips: ['혼자 버티지 말고 도움을 요청하세요.', '받은 도움은 꼭 기록하고 감사 표시를 하세요.'],
    dailyHabits: ['하루 1번 감사 메시지 보내기', '도움받은 일과 도움준 일을 함께 적기'],
  },
  TAE_GEUK_GUI_IN: {
    koreanName: '태극귀인',
    category: '길신',
    shortMeaning: '큰 흐름을 읽고 중심을 잡는 힘이 강한 길신입니다.',
    strengthsOrRisks: ['판단이 흔들리지 않아 결정이 안정적입니다.', '복잡한 상황에서도 핵심을 잘 봅니다.'],
    mitigationTips: ['큰 방향은 유지하되 작은 실행은 유연하게 바꾸세요.', '고집으로 보이지 않게 근거를 같이 설명하세요.'],
    dailyHabits: ['아침에 오늘의 핵심 1가지 정하기', '밤에 판단 근거 1줄 정리하기'],
  },
  MUN_CHANG_GUI_IN: {
    koreanName: '문창귀인',
    category: '길신',
    shortMeaning: '학습력, 문서력, 표현력이 좋아지는 길신입니다.',
    strengthsOrRisks: ['시험, 공부, 문서 업무에 강합니다.', '아이디어를 글로 정리하는 능력이 좋습니다.'],
    mitigationTips: ['완벽주의로 시작을 늦추지 마세요.', '배운 것을 바로 써보며 감각을 유지하세요.'],
    dailyHabits: ['매일 10분 읽고 5줄 요약하기', '회의 후 핵심 문장 3개 정리하기'],
  },
  MUN_GOK_GUI_IN: {
    koreanName: '문곡귀인',
    category: '길신',
    shortMeaning: '감수성과 기획력이 함께 살아나는 길신입니다.',
    strengthsOrRisks: ['콘텐츠, 기획, 예술 감각이 좋아집니다.', '설득력 있는 스토리 구성이 됩니다.'],
    mitigationTips: ['감정 기복이 클 때는 일정 밀도를 낮추세요.', '영감만 기다리지 말고 마감 시간을 먼저 고정하세요.'],
    dailyHabits: ['아이디어 노트에 하루 3개 적기', '짧은 산책 후 작업 25분 집중하기'],
  },
  HAK_DANG_GUI_IN: {
    koreanName: '학당귀인',
    category: '길신',
    shortMeaning: '배움과 성장을 꾸준히 밀어주는 길신입니다.',
    strengthsOrRisks: ['기초를 빠르게 익히고 체계화합니다.', '멘토 운과 교육 운이 붙기 쉽습니다.'],
    mitigationTips: ['배우기만 하지 말고 바로 실전에 연결하세요.', '비교보다 누적 학습량을 점검하세요.'],
    dailyHabits: ['하루 20분 복습 루틴 만들기', '배운 내용 1개를 남에게 설명해보기'],
  },
  GUK_IN_GUI_IN: {
    koreanName: '국인귀인',
    category: '길신',
    shortMeaning: '신뢰와 책임의 힘을 키워주는 길신입니다.',
    strengthsOrRisks: ['공적인 자리에서 신용을 얻기 좋습니다.', '원칙 있는 일 처리로 평판이 쌓입니다.'],
    mitigationTips: ['원칙만 강조하지 말고 사람 사정도 들으세요.', '약속 범위를 명확히 하고 과부하를 막으세요.'],
    dailyHabits: ['하루 업무 우선순위 3개만 고정', '약속한 일의 완료 시간 미리 공유하기'],
  },
  CHEON_JU_GUI_IN: {
    koreanName: '천주귀인',
    category: '길신',
    shortMeaning: '생활 안정과 먹고사는 운을 도와주는 길신입니다.',
    strengthsOrRisks: ['생계 기반을 단단히 만들기 좋습니다.', '현실적인 복이 꾸준히 들어오기 쉽습니다.'],
    mitigationTips: ['작은 지출 누수를 방치하지 마세요.', '가족/팀과 생활 리듬을 같이 맞추세요.'],
    dailyHabits: ['지출 3항목만 간단히 체크', '주간 식사/생활 계획 미리 세우기'],
  },
  CHEON_GWAN_GUI_IN: {
    koreanName: '천관귀인',
    category: '길신',
    shortMeaning: '직책, 인정, 승진운을 돕는 길신입니다.',
    strengthsOrRisks: ['책임 있는 역할을 맡기 쉽습니다.', '공식 평가나 심사에서 강점이 드러납니다.'],
    mitigationTips: ['권위적으로 보이지 않게 소통 빈도를 늘리세요.', '성과뿐 아니라 협업 태도도 함께 관리하세요.'],
    dailyHabits: ['결정 전 이해관계자 1명 의견 듣기', '업무 결과 + 협업 메모를 같이 남기기'],
  },
  CHEON_BOK_GUI_IN: {
    koreanName: '천복귀인',
    category: '길신',
    shortMeaning: '복과 기회가 부드럽게 들어오는 길신입니다.',
    strengthsOrRisks: ['막혔던 일이 의외로 풀릴 때가 많습니다.', '운의 타이밍을 잘 타면 성과가 큽니다.'],
    mitigationTips: ['운이 좋을수록 기본기를 놓치지 마세요.', '좋은 기회는 빨리 실행으로 연결하세요.'],
    dailyHabits: ['하루 1개 빠른 실행하기', '좋은 신호가 온 일은 즉시 일정화하기'],
  },
  BOK_SEONG_GUI_IN: {
    koreanName: '복성귀인',
    category: '길신',
    shortMeaning: '전체 운의 완충 작용이 좋은 길신입니다.',
    strengthsOrRisks: ['문제가 생겨도 회복 탄력이 큽니다.', '좋은 인연과 기회가 이어지기 쉽습니다.'],
    mitigationTips: ['안심하고 방심하지는 마세요.', '복이 들어올 때 저축/투자 비율을 정해두세요.'],
    dailyHabits: ['수입의 일정 비율 자동저축', '주 1회 인간관계 정리/감사 연락'],
  },
  GEUM_YEO_GUI_IN: {
    koreanName: '금여귀인',
    category: '길신',
    shortMeaning: '품위, 생활 수준, 재물 안정에 도움을 주는 길신입니다.',
    strengthsOrRisks: ['생활 질을 높이는 기회를 잡기 쉽습니다.', '재물 운이 부드럽게 흐릅니다.'],
    mitigationTips: ['체면 소비를 줄이고 실속 소비를 늘리세요.', '큰 지출은 하루 유예 후 결정하세요.'],
    dailyHabits: ['불필요 구독 1개씩 정리', '필수/선택 지출 구분해서 기록'],
  },
  CHEON_DEOK_GUI_IN: {
    koreanName: '천덕귀인',
    category: '길신',
    shortMeaning: '위험을 줄이고 일이 좋게 풀리게 돕는 길신입니다.',
    strengthsOrRisks: ['돌발 문제의 손실을 줄이는 힘이 있습니다.', '주변 도움과 보호를 받기 쉽습니다.'],
    mitigationTips: ['무리한 승부보다 안전한 선택을 우선하세요.', '문제 발생 시 빠르게 공유하고 수습하세요.'],
    dailyHabits: ['중요 결정 전 체크리스트 3개 확인', '문제 메모를 남기고 재발 방지 1개 정하기'],
  },
  WOL_DEOK_GUI_IN: {
    koreanName: '월덕귀인',
    category: '길신',
    shortMeaning: '한 달 흐름 속에서 귀인운과 완충운이 좋아지는 길신입니다.',
    strengthsOrRisks: ['타이밍을 잘 타면 일이 쉽게 풀립니다.', '팀 협업에서 도움을 받기 좋습니다.'],
    mitigationTips: ['좋은 흐름일 때 일을 몰아 과로하지 마세요.', '협업 기회를 혼자 성과로 만들지 마세요.'],
    dailyHabits: ['월간 목표를 주간 단위로 나누기', '주 1회 협업 파트너 상태 확인'],
  },
  DEOK_SU_GUI_IN: {
    koreanName: '덕수귀인',
    category: '길신',
    shortMeaning: '지혜와 품격이 함께 드러나는 길신입니다.',
    strengthsOrRisks: ['말과 글의 신뢰도가 올라갑니다.', '학문, 상담, 기획 영역에서 강점이 큽니다.'],
    mitigationTips: ['아는 것을 과시하기보다 쉽게 설명하세요.', '정답형 태도보다 질문형 소통을 늘리세요.'],
    dailyHabits: ['어려운 내용을 쉬운 말로 3줄 정리', '하루 1번 질문으로 대화 시작하기'],
  },
  CHEON_DEOK_HAP: {
    koreanName: '천덕합',
    category: '길신',
    shortMeaning: '충돌을 완화하고 조화롭게 이어주는 길신입니다.',
    strengthsOrRisks: ['사람 사이의 마찰을 줄이는 힘이 있습니다.', '협상과 타협이 잘 되는 편입니다.'],
    mitigationTips: ['갈등을 피하기만 하지 말고 원인을 짚으세요.', '좋은 사람인 척하다가 과부하되지 않게 경계를 두세요.'],
    dailyHabits: ['갈등 상황에서 사실/감정 분리 메모', '요청받은 일은 수락 범위를 먼저 말하기'],
  },
  WOL_DEOK_HAP: {
    koreanName: '월덕합',
    category: '길신',
    shortMeaning: '월간 흐름에서 협력과 화해가 잘 되는 길신입니다.',
    strengthsOrRisks: ['관계 회복과 팀워크에 유리합니다.', '끊긴 일의 재연결이 잘 됩니다.'],
    mitigationTips: ['모두를 맞추려다 결정이 늦어지지 않게 하세요.', '합의 내용은 꼭 문서로 남기세요.'],
    dailyHabits: ['회의 후 합의사항 3줄 기록', '주 1회 미뤄둔 대화 먼저 연락하기'],
  },
  CHEON_WOL_DEOK: {
    koreanName: '천월덕',
    category: '길신',
    shortMeaning: '천덕과 월덕의 보호 성향이 함께 작동하는 길신입니다.',
    strengthsOrRisks: ['위기 완충력이 큰 편입니다.', '중요한 순간에 도움을 받기 쉽습니다.'],
    mitigationTips: ['보호운을 과신해 리스크를 키우지 마세요.', '안전장치를 먼저 두고 도전하세요.'],
    dailyHabits: ['중요 작업 전 백업/이중 확인', '하루 마감 전 리스크 1개 점검'],
  },
  CHEON_UI: {
    koreanName: '천의',
    category: '길신',
    shortMeaning: '회복, 치유, 돌봄 에너지가 강해지는 길신입니다.',
    strengthsOrRisks: ['건강 관리와 회복 루틴에 유리합니다.', '상담, 케어, 서비스 감각이 좋아집니다.'],
    mitigationTips: ['남만 돌보다 본인 체력을 놓치지 마세요.', '몸 신호를 무시하지 말고 바로 조정하세요.'],
    dailyHabits: ['수면 시간 고정하기', '물/식사/스트레칭 체크'],
  },
  HONG_LUAN: {
    koreanName: '홍란',
    category: '길신',
    shortMeaning: '인연운과 호감운이 올라가는 길신입니다.',
    strengthsOrRisks: ['대인관계에서 주목을 받기 쉽습니다.', '연애/소개/협업 연결이 잘 됩니다.'],
    mitigationTips: ['관심을 받는 만큼 경계도 분명히 하세요.', '관계 속도보다 신뢰 확인을 우선하세요.'],
    dailyHabits: ['대화에서 경청 비율 늘리기', '기대치와 경계선 미리 말하기'],
  },
  CHEON_HUI: {
    koreanName: '천희',
    category: '길신',
    shortMeaning: '기쁨, 축하, 좋은 소식이 들어오기 쉬운 길신입니다.',
    strengthsOrRisks: ['분위기를 밝게 만들고 복을 부릅니다.', '행사, 만남, 네트워킹에 유리합니다.'],
    mitigationTips: ['즐거운 흐름에서도 일정과 돈 관리가 필요합니다.', '약속을 과하게 늘려 체력을 소진하지 마세요.'],
    dailyHabits: ['주간 약속 수 상한 정하기', '행사 후 휴식 시간 미리 확보하기'],
  },
  LOK_SHIN: {
    koreanName: '록신',
    category: '길신',
    shortMeaning: '일과 재물의 기본 체력을 키워주는 길신입니다.',
    strengthsOrRisks: ['수입 기반을 안정적으로 만들기 쉽습니다.', '실무 성과가 꾸준히 나옵니다.'],
    mitigationTips: ['버는 힘과 쓰는 힘을 같이 관리하세요.', '반복 업무 자동화를 빨리 도입하세요.'],
    dailyHabits: ['오늘의 핵심 업무 1개 선완료', '소액 지출 자동 분류 확인'],
  },
  BAN_AN_SAL: {
    koreanName: '반안살',
    category: '길신',
    shortMeaning: '자리와 평판이 안정되는 쪽으로 작동하는 신살입니다.',
    strengthsOrRisks: ['승진, 자리 굳히기, 역할 안정에 유리합니다.', '기반을 차근차근 넓히기 좋습니다.'],
    mitigationTips: ['안정에 익숙해 도전을 멈추지 마세요.', '자리 유지보다 성장 지표도 함께 보세요.'],
    dailyHabits: ['주간 성장 목표 1개 추가', '기존 업무 개선점 1개 실험'],
  },
  CHEON_SA: {
    koreanName: '천사성',
    category: '길신',
    shortMeaning: '어려운 국면에서 풀림이 생기기 쉬운 특별 신호입니다.',
    strengthsOrRisks: ['막힌 일이 예상보다 부드럽게 풀릴 수 있습니다.', '타이밍 운을 받을 때가 있습니다.'],
    mitigationTips: ['좋은 흐름일수록 준비를 더 꼼꼼히 하세요.', '행운을 기준으로 무리한 일정은 잡지 마세요.'],
    dailyHabits: ['중요 일정 전 준비물 체크', '기회가 올 때 바로 실행할 1단계 정해두기'],
  },
  DOHWA: {
    koreanName: '도화살',
    category: '중립',
    shortMeaning: '매력과 주목도가 높아지지만 감정 변동도 커질 수 있습니다.',
    strengthsOrRisks: ['대중성, 표현력, 인간관계 확장에 유리합니다.', '관계 과열이나 오해가 생기기 쉽습니다.'],
    mitigationTips: ['호감 신호와 약속 신호를 분리해서 표현하세요.', '감정이 큰 날에는 큰 결정을 미루세요.'],
    dailyHabits: ['감정 점수(1~5) 기록', '중요 메시지는 1회 재검토 후 발송'],
  },
  HONG_YEOM_SAL: {
    koreanName: '홍염살',
    category: '중립',
    shortMeaning: '강한 끌림과 존재감이 생기지만 관계 피로도도 같이 올 수 있습니다.',
    strengthsOrRisks: ['매력과 몰입도가 높아 성과를 끌어올리기 좋습니다.', '집착, 질투, 오해 같은 감정 이슈가 생기기 쉽습니다.'],
    mitigationTips: ['관계 경계를 명확히 하세요.', '감정이 격할 때는 답장을 늦추세요.'],
    dailyHabits: ['관계별 경계 문장 미리 정해두기', '감정 고조 시 10분 산책 후 답장'],
  },
  YEOKMA: {
    koreanName: '역마살',
    category: '중립',
    shortMeaning: '이동과 변화가 많아지는 신살입니다.',
    strengthsOrRisks: ['새 기회 탐색, 영업, 여행, 전환에 유리합니다.', '정착 피로와 루틴 붕괴 위험이 있습니다.'],
    mitigationTips: ['움직임이 많은 날은 일정 70%만 채우세요.', '이동 전 체크리스트로 실수를 줄이세요.'],
    dailyHabits: ['외출 전 3종 체크(시간/물건/경로)', '주 2회는 고정 루틴 유지'],
  },
  HUAGAI: {
    koreanName: '화개살',
    category: '중립',
    shortMeaning: '내면 집중, 예술성, 종교성, 연구성이 커지는 신살입니다.',
    strengthsOrRisks: ['깊이 있는 몰입과 창작에 좋습니다.', '고립감이 커지고 소통이 줄 수 있습니다.'],
    mitigationTips: ['몰입 시간과 소통 시간을 분리해 잡으세요.', '감정이 가라앉는 날엔 사람 접점을 일부러 만드세요.'],
    dailyHabits: ['집중 50분 + 소통 10분 루틴', '하루 1번 짧은 안부 연락'],
  },
  JANGSEONG: {
    koreanName: '장성',
    category: '중립',
    shortMeaning: '리더십과 추진력이 강해지는 신살입니다.',
    strengthsOrRisks: ['주도권을 잡고 성과를 내기 좋습니다.', '강한 추진이 독주로 보일 수 있습니다.'],
    mitigationTips: ['결정 전에 반대 의견을 1개는 듣고 가세요.', '속도와 합의의 균형을 맞추세요.'],
    dailyHabits: ['결정 전 확인 질문 2개', '업무 지시 후 이해 확인'],
  },
  GONGMANG: {
    koreanName: '공망',
    category: '중립',
    shortMeaning: '힘이 비거나 공허감이 오는 구간을 뜻하는 신호입니다.',
    strengthsOrRisks: ['비움과 재정비에는 도움이 됩니다.', '허탈감, 계획 누수, 실행 공백이 생길 수 있습니다.'],
    mitigationTips: ['큰 목표를 잘게 쪼개서 즉시 행동하세요.', '기대치보다 루틴 유지에 집중하세요.'],
    dailyHabits: ['5분짜리 시작 행동 1개 실행', '완료한 일 체크로 자기효능감 보강'],
  },
  KUI_GANG: {
    koreanName: '괴강',
    category: '중립',
    shortMeaning: '기세와 결단이 강한 대신 강약 조절이 중요한 신살입니다.',
    strengthsOrRisks: ['위기 대응력과 돌파력이 좋습니다.', '강한 말투, 대인 마찰이 생길 수 있습니다.'],
    mitigationTips: ['강한 의견일수록 말속도를 늦추세요.', '결론 전에 상대 요약을 먼저 확인하세요.'],
    dailyHabits: ['회의 전 핵심 문장 1개만 준비', '감정 올라오면 3호흡 후 발언'],
  },
  YANG_IN: {
    koreanName: '양인',
    category: '중립',
    shortMeaning: '행동력과 생존력이 강하지만 과속 위험이 있는 신살입니다.',
    strengthsOrRisks: ['밀어붙이는 힘이 좋아 성과를 냅니다.', '공격적으로 비치거나 충돌할 수 있습니다.'],
    mitigationTips: ['승부처와 휴식처를 분리하세요.', '중요한 대화는 단정적 표현을 줄이세요.'],
    dailyHabits: ['하루 1회 의도적 휴식 시간 확보', '강한 문장을 부드러운 문장으로 수정'],
  },
  BI_IN_SAL: {
    koreanName: '비인살',
    category: '중립',
    shortMeaning: '예민하고 날카로운 집중력이 커지는 신살입니다.',
    strengthsOrRisks: ['위기 감지와 빠른 반응에 강합니다.', '긴장 과다, 예민 반응이 쌓일 수 있습니다.'],
    mitigationTips: ['자극이 큰 환경 노출 시간을 제한하세요.', '정확성 업무 후에는 완충 시간을 두세요.'],
    dailyHabits: ['집중 후 5분 이완 스트레칭', '카페인/야식 과다 섭취 줄이기'],
  },
  CHUNG_SAL: {
    koreanName: '충살',
    category: '흉살',
    shortMeaning: '충돌과 급변이 생기기 쉬운 신살입니다.',
    strengthsOrRisks: ['변화 대응력을 키우는 계기가 됩니다.', '관계/일정/계획 충돌이 잦아질 수 있습니다.'],
    mitigationTips: ['중요 일정 사이에 완충 시간을 넣으세요.', '감정이 큰 날은 확정 결정을 미루세요.'],
    dailyHabits: ['일정 사이 10분 버퍼 고정', '즉답 대신 확인 후 답변 습관'],
  },
  HYEONG_SAL: {
    koreanName: '형살',
    category: '흉살',
    shortMeaning: '압박, 갈등, 반복 스트레스가 커질 수 있는 신살입니다.',
    strengthsOrRisks: ['규칙 정비와 재정렬 계기가 됩니다.', '고집 충돌, 말싸움, 자기비난이 늘 수 있습니다.'],
    mitigationTips: ['문제보다 규칙부터 정리하세요.', '말이 세질 때는 텍스트로 먼저 정리하세요.'],
    dailyHabits: ['하루 1회 감정/사실 분리 기록', '갈등 전후 3분 호흡 정리'],
  },
  HAE_SAL: {
    koreanName: '해살',
    category: '흉살',
    shortMeaning: '오해, 뒷말, 보이지 않는 방해가 생기기 쉬운 신살입니다.',
    strengthsOrRisks: ['관계 정리를 통해 기준을 세우게 됩니다.', '사소한 말실수나 오해가 커질 수 있습니다.'],
    mitigationTips: ['추측 대신 사실 확인을 먼저 하세요.', '중요 내용은 구두보다 문서로 남기세요.'],
    dailyHabits: ['대화 후 핵심 확인 메시지 보내기', '소문성 정보는 확인 전 공유 금지'],
  },
  PA_SAL: {
    koreanName: '파살',
    category: '흉살',
    shortMeaning: '깨짐, 분리, 구조 변경이 생기기 쉬운 신살입니다.',
    strengthsOrRisks: ['낡은 구조를 바꾸는 계기가 됩니다.', '계약/관계/계획이 갑자기 틀어질 수 있습니다.'],
    mitigationTips: ['중요 합의는 대안 시나리오를 같이 두세요.', '한 번에 다 바꾸지 말고 단계적으로 바꾸세요.'],
    dailyHabits: ['플랜 A/B 두 가지로 일정 짜기', '변경 내용 즉시 공유하기'],
  },
  WONJIN_SAL: {
    koreanName: '원진살',
    category: '흉살',
    shortMeaning: '감정 앙금과 관계 피로가 쌓이기 쉬운 신살입니다.',
    strengthsOrRisks: ['관계 습관을 돌아보는 기회가 됩니다.', '말 한마디가 오래 남는 갈등으로 번질 수 있습니다.'],
    mitigationTips: ['서운함은 쌓기 전에 짧게 공유하세요.', '감정 단어보다 요청 단어를 쓰세요.'],
    dailyHabits: ['주 1회 관계 점검 대화', '불편한 일은 24시간 안에 전달'],
  },
  GEOKGAK_SAL: {
    koreanName: '격각살',
    category: '흉살',
    shortMeaning: '엇갈림과 타이밍 미스가 커질 수 있는 신살입니다.',
    strengthsOrRisks: ['점검 습관을 만들면 실수가 크게 줄어듭니다.', '한 끗 차이로 일이 틀어질 수 있습니다.'],
    mitigationTips: ['시간/장소/대상을 다시 확인하세요.', '구두 약속은 캘린더로 확정하세요.'],
    dailyHabits: ['출발 전 일정 재확인 1회', '중요 약속 캘린더 초대 보내기'],
  },
  JI_SAL: {
    koreanName: '지살',
    category: '흉살',
    shortMeaning: '움직임이 늘면서 기반이 흔들리기 쉬운 신살입니다.',
    strengthsOrRisks: ['환경 적응력을 키우는 계기가 됩니다.', '정착력 저하, 피로 누적이 생길 수 있습니다.'],
    mitigationTips: ['이동/변화가 많은 주엔 일정을 줄이세요.', '기반 루틴(수면/식사)을 먼저 고정하세요.'],
    dailyHabits: ['주 2회 고정 루틴 지키기', '이동 많은 날 저녁 일정 비우기'],
  },
  WOL_SAL: {
    koreanName: '월살',
    category: '흉살',
    shortMeaning: '월 단위 변동과 컨디션 기복이 커질 수 있는 신살입니다.',
    strengthsOrRisks: ['주기 관리 습관을 만들면 오히려 안정됩니다.', '월초/월말에 피로와 변수 체감이 커질 수 있습니다.'],
    mitigationTips: ['월간 계획에 휴식 블록을 먼저 넣으세요.', '중요 결정은 컨디션 좋은 날로 옮기세요.'],
    dailyHabits: ['주간 체력 점수 기록', '월간 일정에 회복일 2일 선배치'],
  },
  MANG_SHIN_SAL: {
    koreanName: '망신살',
    category: '흉살',
    shortMeaning: '체면 손상, 구설, 실수 노출에 주의가 필요한 신살입니다.',
    strengthsOrRisks: ['말과 행동을 다듬는 계기가 됩니다.', '작은 실수가 크게 보일 수 있습니다.'],
    mitigationTips: ['즉흥 발언을 줄이고 확인 후 말하세요.', '공개 채널 글은 한 번 더 검토하세요.'],
    dailyHabits: ['발송 전 30초 재검토', '사과/정정이 필요하면 당일 처리'],
  },
  YUK_HAE_SAL: {
    koreanName: '육해살',
    category: '흉살',
    shortMeaning: '관계 손상과 피로 누적에 주의가 필요한 신살입니다.',
    strengthsOrRisks: ['불필요한 관계를 정리하는 계기가 됩니다.', '신뢰 흔들림이나 협업 피로가 커질 수 있습니다.'],
    mitigationTips: ['불편한 신호를 초기에 말로 정리하세요.', '요청과 한계를 같이 전달하세요.'],
    dailyHabits: ['하루 1회 경계 문장 연습', '협업 전 역할/마감 재확인'],
  },
  GEOB_SAL: {
    koreanName: '겁살',
    category: '흉살',
    shortMeaning: '경쟁, 손재, 돌발 리스크에 주의가 필요한 신살입니다.',
    strengthsOrRisks: ['위험감지력을 키우면 손실을 줄일 수 있습니다.', '무리한 투자/무리수 선택이 늘 수 있습니다.'],
    mitigationTips: ['큰 돈/큰 결정은 하루 유예하세요.', '비교 심리가 강한 날엔 앱 사용 시간을 줄이세요.'],
    dailyHabits: ['지출 상한선 미리 정하기', '충동구매 후보 24시간 보류'],
  },
  JAESAL: {
    koreanName: '재살',
    category: '흉살',
    shortMeaning: '사고성 변수와 날카로운 충돌에 주의가 필요한 신살입니다.',
    strengthsOrRisks: ['안전관리 습관을 만들면 오히려 탄탄해집니다.', '급한 이동, 급한 결정에서 실수가 날 수 있습니다.'],
    mitigationTips: ['서두를수록 속도를 20% 낮추세요.', '위험 작업은 체크리스트 후 진행하세요.'],
    dailyHabits: ['이동 전 안전 확인', '작업 전 3단계 점검 습관'],
  },
  CHEON_SAL: {
    koreanName: '천살',
    category: '흉살',
    shortMeaning: '예상 밖 변수와 피로 누적에 주의가 필요한 신살입니다.',
    strengthsOrRisks: ['돌발 대응 체계를 만들 기회가 됩니다.', '외부 변수로 일정 지연이 생길 수 있습니다.'],
    mitigationTips: ['중요 일정엔 예비 시간을 꼭 두세요.', '무리한 강행보다 일정 재조정이 낫습니다.'],
    dailyHabits: ['핵심 일정 전날 준비 완료', '당일 일정 1개는 비워두기'],
  },
  BAEK_HO: {
    koreanName: '백호',
    category: '흉살',
    shortMeaning: '강한 기세와 함께 사고성 리스크 관리가 필요한 신살입니다.',
    strengthsOrRisks: ['결단력과 실행력은 매우 좋습니다.', '과속, 충돌, 부상성 변수에 주의가 필요합니다.'],
    mitigationTips: ['속도보다 정확도를 우선하세요.', '감정 고조 시 즉시 휴식 후 재개하세요.'],
    dailyHabits: ['하루 1회 강제 휴식 타이머', '운동/이동 시 보호 습관 지키기'],
  },
};

const SHINSAL_ALIASES: Partial<Record<string, readonly string[]>> = {
  CHEON_EUL_GUI_IN: ['천을', '천을귀인', '천을 귀인', 'cheon_eul_gui_in', 'cheoneulguiin'],
  TAE_GEUK_GUI_IN: ['태극', '태극귀인', '태극 귀인', 'tae_geuk_gui_in', 'taegeukguiin'],
  MUN_CHANG_GUI_IN: ['문창', '문창귀인', '문창 귀인', 'mun_chang_gui_in', 'munchangguiin'],
  MUN_GOK_GUI_IN: ['문곡', '문곡귀인', '문곡 귀인', 'mun_gok_gui_in', 'mungokguiin'],
  HAK_DANG_GUI_IN: ['학당', '학당귀인', '학당 귀인', 'hak_dang_gui_in', 'hakdangguiin'],
  GUK_IN_GUI_IN: ['국인', '국인귀인', '국인 귀인', 'guk_in_gui_in', 'gukinguiin'],
  CHEON_JU_GUI_IN: ['천주', '천주귀인', '천주 귀인', 'cheon_ju_gui_in', 'cheonjuguiin'],
  CHEON_GWAN_GUI_IN: ['천관', '천관귀인', '천관 귀인', 'cheon_gwan_gui_in', 'cheongwanguiin'],
  CHEON_BOK_GUI_IN: ['천복', '천복귀인', '천복 귀인', 'cheon_bok_gui_in', 'cheonbokguiin'],
  BOK_SEONG_GUI_IN: ['복성', '복성귀인', '복성 귀인', 'bok_seong_gui_in', 'bokseongguiin'],
  GEUM_YEO_GUI_IN: ['금여', '금여귀인', '금여 귀인', 'geum_yeo_gui_in', 'geumyeoguiin'],
  CHEON_DEOK_GUI_IN: ['천덕', '천덕귀인', '천덕 귀인', 'cheon_deok_gui_in', 'cheondeokguiin'],
  WOL_DEOK_GUI_IN: ['월덕', '월덕귀인', '월덕 귀인', 'wol_deok_gui_in', 'woldeokguiin'],
  DEOK_SU_GUI_IN: ['덕수', '덕수귀인', '덕수 귀인', 'deok_su_gui_in', 'deoksuguiin'],
  CHEON_DEOK_HAP: ['천덕합', '천덕 합', 'cheon_deok_hap', 'cheondeokhap'],
  WOL_DEOK_HAP: ['월덕합', '월덕 합', 'wol_deok_hap', 'woldeokhap'],
  CHEON_WOL_DEOK: ['천월덕', '천월덕귀인', '천월덕 귀인', 'cheon_wol_deok', 'cheonwoldeok'],
  CHEON_UI: ['천의', '천의성', 'cheon_ui', 'cheonui'],
  HONG_LUAN: ['홍란', '홍란성', 'hong_luan', 'hongluan'],
  CHEON_HUI: ['천희', '천희성', 'cheon_hui', 'cheonhui'],
  LOK_SHIN: ['록신', '녹신', '건록', '록신귀인', 'lok_shin', 'rokshin'],
  BAN_AN_SAL: ['반안', '반안살', 'ban_an_sal', 'banansal'],
  CHEON_SA: ['천사', '천사성', '천사성살', 'cheon_sa', 'cheonsa'],
  DOHWA: ['도화', '도화살', '복숭아살', '桃花', 'dohwa', 'dohwasal'],
  HONG_YEOM_SAL: ['홍염', '홍염살', '홍염성', 'hong_yeom_sal', 'hongyeomsal'],
  YEOKMA: ['역마', '역마살', '역마성', 'yeokma', 'yeokmasal', 'yeok_ma'],
  HUAGAI: ['화개', '화개살', 'huagai', 'hua_gai'],
  JANGSEONG: ['장성', '장성살', 'jangseong', 'jangseongsal'],
  GONGMANG: ['공망', '공망살', '순공', 'gongmang'],
  KUI_GANG: ['괴강', '괴강살', 'kui_gang', 'kuigang', '괴강성'],
  YANG_IN: ['양인', '양인살', 'yang_in', 'yangin'],
  BI_IN_SAL: ['비인', '비인살', 'bi_in_sal', 'biinsal'],
  CHUNG_SAL: ['충살', '충', 'chung_sal', 'chungsal'],
  HYEONG_SAL: ['형살', '형', 'hyeong_sal', 'hyeongsal'],
  HAE_SAL: ['해살', '해', 'hae_sal', 'haesal'],
  PA_SAL: ['파살', '파', 'pa_sal', 'pasal'],
  WONJIN_SAL: ['원진', '원진살', 'wonjin_sal', 'wonjinsal'],
  GEOKGAK_SAL: ['격각', '격각살', 'geokgak_sal', 'geokgaksal'],
  JI_SAL: ['지살', 'ji_sal', 'jisal'],
  WOL_SAL: ['월살', 'wol_sal', 'wolsal'],
  MANG_SHIN_SAL: ['망신', '망신살', 'mang_shin_sal', 'mangsinsal', 'mangshinsal'],
  YUK_HAE_SAL: ['육해', '육해살', 'yuk_hae_sal', 'yukhaesal'],
  GEOB_SAL: ['겁살', '겁', 'geob_sal', 'geobsal'],
  JAESAL: ['재살', '재액살', 'jaesal', 'jae_sal'],
  CHEON_SAL: ['천살', '하늘살', 'cheon_sal', 'cheonsal'],
  BAEK_HO: ['백호', '백호대살', '백호살', 'baek_ho', 'baekho'],
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[(){}\[\]'"`.,\-_/]/g, '');
}

function buildCandidates(input: string): string[] {
  const token = normalizeToken(input);
  if (!token) return [];

  const candidates = new Set<string>([token]);
  if (token.endsWith('살')) candidates.add(token.slice(0, -1));
  if (!token.endsWith('살')) candidates.add(`${token}살`);
  if (token.endsWith('귀인')) candidates.add(token.slice(0, -2));
  return Array.from(candidates).filter(Boolean);
}

const SHINSAL_LOOKUP: Record<string, string> = (() => {
  const lookup: Record<string, string> = {};

  for (const [key, entry] of Object.entries(SHINSAL_ENCYCLOPEDIA)) {
    const aliases = new Set<string>([key, entry.koreanName, ...(SHINSAL_ALIASES[key] ?? [])]);
    for (const alias of aliases) {
      const token = normalizeToken(alias);
      if (!token) continue;
      if (!lookup[token]) lookup[token] = key;
    }
  }

  return lookup;
})();

export function findShinsalEntry(name?: string | null): ShinsalEncyclopediaEntry | null {
  if (typeof name !== 'string') return null;

  const candidates = buildCandidates(name);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const key = SHINSAL_LOOKUP[candidate];
    if (key) return SHINSAL_ENCYCLOPEDIA[key];
  }

  const primary = candidates[0];
  if (!primary || primary.length < 2) return null;

  for (const [aliasToken, key] of Object.entries(SHINSAL_LOOKUP)) {
    if (primary.includes(aliasToken) || aliasToken.includes(primary)) {
      return SHINSAL_ENCYCLOPEDIA[key];
    }
  }

  return null;
}
