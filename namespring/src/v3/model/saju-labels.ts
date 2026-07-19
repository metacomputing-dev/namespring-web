/**
 * 엔진이 주는 로마자 코드·원어 라벨을 화면용 한국어로 옮기는 표.
 * 계산값을 바꾸지 않는 순수 표기 계층이며, 모르는 값은 원문 그대로 보여준다.
 */

export interface GanjiGlyph {
  hangul: string;
  hanja: string;
  element: 'wood' | 'fire' | 'earth' | 'metal' | 'water';
}

export const STEM_GLYPHS: Record<string, GanjiGlyph> = {
  GAP: { hangul: '갑', hanja: '甲', element: 'wood' },
  EUL: { hangul: '을', hanja: '乙', element: 'wood' },
  BYEONG: { hangul: '병', hanja: '丙', element: 'fire' },
  JEONG: { hangul: '정', hanja: '丁', element: 'fire' },
  MU: { hangul: '무', hanja: '戊', element: 'earth' },
  GI: { hangul: '기', hanja: '己', element: 'earth' },
  GYEONG: { hangul: '경', hanja: '庚', element: 'metal' },
  SIN: { hangul: '신', hanja: '辛', element: 'metal' },
  IM: { hangul: '임', hanja: '壬', element: 'water' },
  GYE: { hangul: '계', hanja: '癸', element: 'water' },
};

export const BRANCH_GLYPHS: Record<string, GanjiGlyph> = {
  JA: { hangul: '자', hanja: '子', element: 'water' },
  CHUK: { hangul: '축', hanja: '丑', element: 'earth' },
  IN: { hangul: '인', hanja: '寅', element: 'wood' },
  MYO: { hangul: '묘', hanja: '卯', element: 'wood' },
  JIN: { hangul: '진', hanja: '辰', element: 'earth' },
  SA: { hangul: '사', hanja: '巳', element: 'fire' },
  O: { hangul: '오', hanja: '午', element: 'fire' },
  MI: { hangul: '미', hanja: '未', element: 'earth' },
  SIN: { hangul: '신', hanja: '申', element: 'metal' },
  YU: { hangul: '유', hanja: '酉', element: 'metal' },
  SUL: { hangul: '술', hanja: '戌', element: 'earth' },
  HAE: { hangul: '해', hanja: '亥', element: 'water' },
};

export function stemGlyph(code: string): GanjiGlyph | null {
  return STEM_GLYPHS[code.toUpperCase()] ?? null;
}

export function branchGlyph(code: string): GanjiGlyph | null {
  return BRANCH_GLYPHS[code.toUpperCase()] ?? null;
}

export const TEN_GOD_KO: Record<string, string> = {
  BI_GYEON: '비견',
  GYEOB_JAE: '겁재',
  SIK_SIN: '식신',
  SANG_GWAN: '상관',
  PYEON_JAE: '편재',
  JEONG_JAE: '정재',
  PYEON_GWAN: '편관',
  JEONG_GWAN: '정관',
  PYEON_IN: '편인',
  JEONG_IN: '정인',
};

export const PILLAR_KO: Record<string, string> = {
  year: '년주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

/** 자주 만나는 신살의 한 줄 뜻풀이 (검수된 FE 카피). 목록에 없으면 이름만 보여준다. */
export const SHINSAL_MEANINGS: Record<string, string> = {
  천덕귀인: '어려울 때 주변의 도움이 자연스럽게 모이는 자리예요.',
  월덕귀인: '너그러운 기운이 함께해 사람 사이의 마찰을 부드럽게 해요.',
  천을귀인: '귀한 인연이 힘이 되어 주는, 예로부터 가장 반기는 자리예요.',
  문창귀인: '배우고 표현하는 재주에 힘이 실리는 자리예요.',
  도화살: '사람을 끌어들이는 매력이 강해지는 기운이에요. 관계의 밀도가 높아져요.',
  역마살: '움직이고 옮겨 다니며 기회를 만드는 기운이에요.',
  화개살: '홀로 깊어지는 재능이 있어 몰입과 사색에서 빛이 나요.',
  양인살: '기운이 날카롭게 몰리는 자리라, 힘 조절이 관건이에요.',
  백호살: '강한 추진력이 실리는 자리라, 속도를 다듬으면 큰 힘이 돼요.',
  괴강살: '뜻이 굳고 스케일이 큰 기운이라, 방향만 맞으면 크게 나아가요.',
  귀문관살: '감각이 예민하게 열리는 자리예요. 직관이 좋아지는 대신 쉼이 필요해요.',
  공망살: '비어 있는 자리를 채우려는 힘이 생겨, 준비를 한 번 더 하게 돼요.',
  겁살: '기운이 훅 빠져나가기 쉬운 자리라, 지키는 습관이 힘이 돼요.',
  재살: '경쟁과 긴장이 실리는 자리라, 정면 승부보다 한 걸음 우회가 유리해요.',
  천살: '내 힘만으로 되지 않는 일을 만나는 자리라, 기다림이 지혜가 돼요.',
  지살: '터전을 옮기고 넓히는 기운이에요. 움직임에서 기회가 생겨요.',
  년살: '시선을 모으는 매력이 실리는 자리예요.',
  월살: '기운이 마르기 쉬운 자리라, 재충전을 미리 챙겨 두면 좋아요.',
  망신살: '드러나는 자리라, 준비된 모습일 때 오히려 빛나요.',
  장성살: '앞장서는 기운이 실리는 자리예요. 책임과 함께 힘도 커져요.',
  반안살: '안장에 오르듯 자리가 안정되는 기운이에요.',
  육해살: '일이 얽히기 쉬운 자리라, 관계와 일정을 정리하는 힘이 필요해요.',
  충살: '부딪히며 여는 기운이라, 변화 앞에서 오히려 단단해져요.',
  격각살: '한 칸 건너 어긋나는 긴장이 있어, 완급 조절이 관건이에요.',
  고신살: '혼자 깊어지는 시간이 길어지기 쉬운 자리예요. 그 시간이 재산이 되기도 해요.',
  과숙살: '홀로 서는 힘이 강해지는 자리예요. 곁을 내어 주는 연습이 균형을 만들어요.',
  원진살: '까닭 없이 불편해지기 쉬운 관계의 기운이라, 거리 조절이 지혜예요.',
  급각살: '서두르면 발이 걸리기 쉬운 자리라, 속도를 늦추면 편안해져요.',
  단교관살: '이어지던 흐름이 끊기기 쉬운 자리라, 다리를 미리 놓아 두면 좋아요.',
  천라지망: '그물에 걸린 듯 더디게 풀리는 자리라, 서두르지 않는 쪽이 유리해요.',
  현침살: '바늘처럼 예리한 감각이 실리는 자리예요. 섬세한 일에서 빛나요.',
  홍염살: '은은하게 사람을 끌어들이는 매력의 기운이에요.',
  천의성: '돌보고 살리는 재능이 실리는 자리예요.',
  천문성: '이치를 꿰뚫어 보는 감각이 열리는 자리예요.',
  암록: '보이지 않는 곳에서 도움이 이어지는 자리예요.',
  금여: '귀한 대접을 받는 기운이 실리는 자리예요.',
};

/** 천간·지지 관계 유형의 짧은 풀이. */
export const RELATION_MEANINGS: Record<string, string> = {
  합: '서로 끌어당겨 하나의 기운으로 모이는 관계예요.',
  충: '정면으로 부딪히며 변화를 여는 관계예요.',
  형: '서로를 다듬으며 긴장을 만드는 관계예요.',
  파: '맞물린 흐름이 어긋나기 쉬운 관계예요.',
  해: '은근히 어긋나 신경이 쓰이는 관계예요.',
  원진: '까닭 없이 불편해지기 쉬운 관계예요.',
};

export const SEONGPAE_KO: Record<string, { label: string; gloss: string }> = {
  SEONGGYEOK: { label: '성격(成格)', gloss: '격이 온전히 이루어져 제 힘을 내는 구성이에요.' },
  PAGYEOK: { label: '파격(破格)', gloss: '격을 흔드는 요소가 있어 힘이 흩어지기 쉬운 구성이에요.' },
  PAJUNG_YUGU: { label: '파중유구(破中有救)', gloss: '흔들리는 자리를 구해 주는 글자가 있는 구성이에요.' },
  SEONGJUNG_YUPA: { label: '성중유파(成中有破)', gloss: '이루어진 격 안에 흔드는 요소가 함께 있는 구성이에요.' },
  UNDETERMINED: { label: '판정 보류', gloss: '이번 계산으로는 성패를 단정하지 않았어요.' },
};

export const UNSEONG_GLOSS: Record<string, string> = {
  장생: '새로 태어나 자라기 시작하는 기운',
  목욕: '씻겨 나가며 변화가 잦은 기운',
  관대: '옷을 갖춰 입고 나설 준비를 마친 기운',
  건록: '제 몫을 단단히 해내는 기운',
  제왕: '기세가 가장 왕성한 기운',
  쇠: '정점을 지나 차분해지는 기운',
  병: '기운이 안으로 잦아드는 시기',
  사: '멈추어 정리하는 기운',
  묘: '갈무리하여 간직하는 기운',
  절: '끊어진 자리에서 다시 시작을 기다리는 기운',
  태: '새 흐름이 잉태되는 기운',
  양: '보살핌 속에 자라나는 기운',
};

export const CATEGORY_META: Record<string, { label: string; sub: string }> = {
  overall: { label: '총운', sub: '하루 전체의 흐름' },
  wealth: { label: '재물운', sub: '돈과 물건 관리' },
  health: { label: '건강운', sub: '몸과 마음의 리듬' },
  academic: { label: '학업운', sub: '공부와 배움' },
  romance: { label: '연애운', sub: '관계와 마음' },
  family: { label: '가족운', sub: '가까운 사람들' },
};

export const PERIOD_META: Record<string, string> = {
  today: '오늘',
  thisWeek: '이번 주',
  thisMonth: '이번 달',
  thisYear: '올해',
};
