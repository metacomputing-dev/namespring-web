#!/usr/bin/env tsx
/**
 * Generate diverse tieredMatrix standard-copy samples and summarize the actual
 * sentences that backend returns for commercial-reader QA.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpringEngine } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

type FocusCategory = 'overall' | 'wealth' | 'health' | 'academic' | 'romance' | 'family' | 'career';
type FocusPeriod = 'life' | 'today' | 'thisWeek' | 'thisMonth' | 'thisYear';

interface CopyCase {
  readonly id: string;
  readonly label: string;
  readonly audience: 'child' | 'minor' | 'youngAdult' | 'adult' | 'olderAdult';
  readonly request: any;
  readonly focus: ReadonlyArray<{ readonly period: FocusPeriod; readonly category: FocusCategory; readonly ageBand?: string }>;
}

const targetDate = '2026-06-29T00:00:00+09:00';

const CASES: readonly CopyCase[] = [
  {
    id: 'adult-male-known-hour-seoul',
    label: '성인 남성·출생시각 있음·서울·최성수',
    audience: 'adult',
    request: {
      targetDate,
      birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male', calendarType: 'solar', region: '서울', birthPlace: '서울' },
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
    focus: [
      { period: 'today', category: 'overall' },
      { period: 'today', category: 'wealth' },
      { period: 'thisWeek', category: 'career' },
      { period: 'thisMonth', category: 'romance' },
      { period: 'thisYear', category: 'health' },
      { period: 'life', category: 'career', ageBand: '40-49' },
    ],
  },
  {
    id: 'adult-female-known-hour-daegu',
    label: '성인 여성·출생시각 있음·대구·최지수',
    audience: 'adult',
    request: {
      targetDate,
      birth: { year: 1992, month: 10, day: 8, hour: 22, minute: 10, gender: 'female', calendarType: 'solar', region: '대구', birthPlace: '대구' },
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [{ hangul: '지', hanja: '智' }, { hangul: '수', hanja: '秀' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
    focus: [
      { period: 'today', category: 'health' },
      { period: 'thisWeek', category: 'family' },
      { period: 'thisMonth', category: 'wealth' },
      { period: 'thisYear', category: 'career' },
      { period: 'life', category: 'romance', ageBand: '30-39' },
    ],
  },
  {
    id: 'minor-female-known-hour-busan',
    label: '미성년 여성·출생시각 있음·부산·김서윤',
    audience: 'minor',
    request: {
      targetDate,
      birth: { year: 2013, month: 7, day: 21, hour: 14, minute: 20, gender: 'female', calendarType: 'solar', region: '부산', birthPlace: '부산' },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [{ hangul: '서', hanja: '瑞' }, { hangul: '윤', hanja: '潤' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
    focus: [
      { period: 'today', category: 'academic' },
      { period: 'today', category: 'romance' },
      { period: 'thisWeek', category: 'wealth' },
      { period: 'thisMonth', category: 'health' },
      { period: 'life', category: 'academic', ageBand: '10-19' },
    ],
  },
  {
    id: 'child-male-unknown-hour-seoul',
    label: '아동 남성·출생시각 미상·서울·이하준',
    audience: 'child',
    request: {
      targetDate,
      birth: { year: 2017, month: 6, day: 15, hour: null, minute: null, gender: 'male', calendarType: 'solar', region: '서울', birthPlace: '서울' },
      surname: [{ hangul: '이', hanja: '李' }],
      givenName: [{ hangul: '하', hanja: '河' }, { hangul: '준', hanja: '俊' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
    focus: [
      { period: 'today', category: 'overall' },
      { period: 'today', category: 'academic' },
      { period: 'today', category: 'romance' },
      { period: 'thisYear', category: 'family' },
      { period: 'life', category: 'health', ageBand: '10-19' },
    ],
  },
  {
    id: 'young-adult-neutral-unknown-hour',
    label: '청년 중립성별·출생시각 미상·서울·이하준',
    audience: 'youngAdult',
    request: {
      targetDate,
      birth: { year: 2001, month: 1, day: 15, hour: null, minute: null, gender: 'neutral', calendarType: 'solar', region: '서울', birthPlace: '서울' },
      surname: [{ hangul: '이', hanja: '李' }],
      givenName: [{ hangul: '하', hanja: '河' }, { hangul: '준', hanja: '俊' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
    focus: [
      { period: 'today', category: 'career' },
      { period: 'thisWeek', category: 'romance' },
      { period: 'thisMonth', category: 'academic' },
      { period: 'thisYear', category: 'wealth' },
      { period: 'life', category: 'overall', ageBand: '20-29' },
    ],
  },
  {
    id: 'older-female-known-hour-gwangju',
    label: '장년 여성·출생시각 있음·광주·최성수',
    audience: 'olderAdult',
    request: {
      targetDate,
      birth: { year: 1964, month: 12, day: 2, hour: 8, minute: 10, gender: 'female', calendarType: 'solar', region: '광주', birthPlace: '광주' },
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
    focus: [
      { period: 'today', category: 'family' },
      { period: 'thisWeek', category: 'health' },
      { period: 'thisMonth', category: 'career' },
      { period: 'thisYear', category: 'romance' },
      { period: 'life', category: 'wealth', ageBand: '60-69' },
    ],
  },
];

const RANDOM_SURNAME_POOL = [
  { hangul: '김', hanja: '金' },
  { hangul: '이', hanja: '李' },
  { hangul: '박', hanja: '朴' },
  { hangul: '최', hanja: '崔' },
  { hangul: '정', hanja: '鄭' },
  { hangul: '강', hanja: '姜' },
  { hangul: '윤', hanja: '尹' },
  { hangul: '한', hanja: '韓' },
] as const;

const RANDOM_GIVEN_NAME_POOL = [
  [{ hangul: '서', hanja: '瑞' }, { hangul: '윤', hanja: '潤' }],
  [{ hangul: '지', hanja: '智' }, { hangul: '우', hanja: '祐' }],
  [{ hangul: '하', hanja: '河' }, { hangul: '준', hanja: '俊' }],
  [{ hangul: '민', hanja: '旻' }, { hangul: '재', hanja: '宰' }],
  [{ hangul: '유', hanja: '柔' }, { hangul: '진', hanja: '珍' }],
  [{ hangul: '도', hanja: '度' }, { hangul: '현', hanja: '賢' }],
  [{ hangul: '아', hanja: '雅' }, { hangul: '린', hanja: '潾' }],
  [{ hangul: '태', hanja: '泰' }, { hangul: '오', hanja: '旿' }],
  [{ hangul: '예', hanja: '睿' }, { hangul: '준', hanja: '俊' }],
  [{ hangul: '수', hanja: '秀' }, { hangul: '빈', hanja: '彬' }],
] as const;

const RANDOM_REGIONS = ['서울', '부산', '대구', '광주', '대전', '인천', '울산', '제주'] as const;
const RANDOM_GENDERS = ['male', 'female', 'neutral'] as const;
const RANDOM_AGE_BUCKETS = [
  { audience: 'child' as const, minYear: 2017, maxYear: 2023 },
  { audience: 'minor' as const, minYear: 2008, maxYear: 2016 },
  { audience: 'youngAdult' as const, minYear: 1997, maxYear: 2005 },
  { audience: 'adult' as const, minYear: 1977, maxYear: 1996 },
  { audience: 'olderAdult' as const, minYear: 1944, maxYear: 1971 },
] as const;
const RANDOM_FOCUS_CATEGORIES = ['overall', 'wealth', 'health', 'academic', 'romance', 'family', 'career'] as const;
const RANDOM_FOCUS_PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const RANDOM_LIFE_BANDS = ['10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79'] as const;

const CATEGORIES = ['wealth', 'health', 'academic', 'romance', 'family', 'career', 'study_document', 'expression_children', 'health_stress', 'movement'] as const;
const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const EXPERT_TERMS_RE = /극신강|극신약|신강|신약|천을귀인|천덕귀인|월덕귀인|공망|용신|희신|기신|구신|일간|격국|십성|식상|재성|관성|인성|비겁|천간|오행|음양|신살|대운|세운|정관|편관|정인|편인|상관|식신|비견|겁재/;
const MINOR_ADULT_RE = /연애|결혼|배우자궁|처궁|투자|보증|큰 계약|전성기|자녀·손주|손주/;
const AWKWARD_RE = /적어 두는 자리예요|호수처럼 잔잔한|짧고 잔잔한 이동|확인하는 자리를|가족과의 자리가|학업·친구 자리|같은 자리·같은 한 끼|자리를 잡는 시기|함께 쓰는 자리|함께 쓰는 리듬이 자리를|권유받은 자리를|자기 자리에서 누리는|정리와 나눔의 호흡이 가장 자연스러운 자리|정리하고 나누는 자리에서|약속과 컨디션을 한 번 더 확인하면 좋은 기운|오늘 가장 자주 마주치는 부분|도는 자리예요|좋아하는 자리를|익숙한 자리와 새로운 자리가|잠자리 자리가|자기 자리가 단단|한 해 끝의 자기 자리가|나눠 두는 자리가|이어 가는 자리가 평생|자기 자리에서 또렷이|다음 분기의 자리를|한 주 시작에 짧게 적어 두는 자리가|이어 가는 자리가 자기 색|자기 자리가 비어|한 주의 시작 자리에서|같은 자리에 쌓아 두면|마음이 답답한 자리가|자기를 챙기는 자리가|자기 자리가 단단하게|할 일을 작게 나누면|작게 정리할 일부터|다음 10년 자리의 폭|한 자리에서 뿌리내린|다음 세대와의 자리는|자녀와의 결|정돈하는 자리예요|주위에 자리를 만들고|빛깔이 진해지는 자리예요|방향정|친구와의 자리가|친구와의 일상적인 자리를|자기 자리에서 가장 또렷한 건강 지도|자기 자리를 오래|지나온 자리의 실마리|회복의 자리가|받은 자리에 책임|자기 자리의 중심|다음 자리의 디딤돌|작은 흐름을 알아채기 좋은 자리|가족·후배·이웃과 함께 쓰는 리듬이 자리를|자녀·후배·이웃과 함께 쓰는 리듬이 자리를|안정적으요|받쳐주요|[가-힣]+하요(?=[.!?]|$)|성과와 인정를|방향로|시기이에요|방향실|실마리을|흐름을 다듬는 흐름|한 학기 한 자리|자기 평생의 단단한 자리|가까운 어른에게 짧게라도 나눠 두는 자리|일상의 작은 자리들이|평생 갈 자산|흐름실|자격 어휘|천천히 차오르는 자리|작은 자리가 평생을|한 점씩 더해 두는 작은 자리가|받쳐 주는 나중에 다시 볼 자료|함께 챙기는 흐름을 자연스럽게 받아들이는 흐름|한 박자 늦추는 자리를|잔잔한 자리에서 가까운|익숙한 자리의 작은 변화|잔잔한 (?:결|흐름)의 이동을 권해 드려요|정리하고 나누는 자리가|여행과 머무름의 흐름이 함께하는 흐름|가까운 자리에서 풍요로운 풍경|마음 편한 자리에서 회복이|말를|기억로|평생 흐름|큰 해예요|힘이 좋아 활동량을 받아 낼 힘|정기 휴식 자리를|다듬는 자리를|누적된 자리가|책임 자리가|한 달이라는 자리|강한 결일수록|한 결 가벼워져요|가족과의 자리는|한 끼·한 안부의 작은 온기가 자기 자리|작은 자리 하나가 가족과의 거리|짧은 대화 자리를|흐르는 흐름|한 흐름으로 이어진 흐름|좋은 흐름이에요|단정 없이 흐르는|한 자리가 길게 남는 흐름|관심사 자리를|다음 주의 첫 자리|권유받은 흐름|인연 자리가 넉넉하면|자리가 비어 있던|쌓아 온 흐름은|마음의 흐름을 호수|마음·몸이 [^.!?]*자리 ?잡는|마음과 몸이 [^.!?]*자리 ?잡는|자녀 세대와의 흐름|새 인연이 들어올 자리|인연 한 줄|동료의 자리가 든든하게|도예가가 손에 쥔 흙|큰 무리수 없이 흘러가는 흐름|자연스럽게 자리 잡는 흐름|자리의 중심|첫 자리의 방향|한 자리에서 1년|무리한 자리|무리한 자리를|시작의 중심이|첫 자리에서의 작은 인정|한 자리에서의 마무리|다음 자리를 고를|시작 자리를|자기 기준에 흘러요|새로운 변화를 한꺼번에 받는|디딤돌을 놓는 자리|자기 자리의 빛|짝과 관련한|체감\||자기 기준를|사주에 가장 필요한|물\(水\)|쇠\(金\)|인연 자리는|인연운|친구·가족과 어울리는 자리|한참 노는 흐름 위|시험·발표 같은 자리에|정해진 식사 자리|사람과 사람 사이의 따뜻한 자리|호수의 깊이|한 자리에서 천천히 자라나|자기 자리를 만들어 줘요|한 마디의 자리도 자기 자리|관리을|관리이|관리은|관계을|관계이|작은 실천 흐름|작은 자문 한 번이 후배의 결정 한 번|누군가의 큰 자리|오늘 한 자리에서는|자리로 모이는 자리|한쪽 어른 자리|산책 한 자리|첫 자리를|푹 빠지는 자리|펼쳐 보는 자리|채워 가는 자리|12월 자리|익숙한 자리에서 작은 발견|버는 자리와 지키는 자리|본가와 자기 자리|본가 자리|모종을 옮겨 심는 자리|새 친구를 만나거나 함께 무언가를 만드는 자리|새로운 도구·이야기·노래를 만나는 자리가|인생 전체의 전체 생활 영역|도움을 받는 자리|받는 자리에서 자기|평생 가족 자리|평생 자리에서|흐름이 고른 흐름|익숙한 자리들이|받쳐 주는 자리가|자기 자신을 위한 자리|가마솥 한 솥|잠 자리를|한 가지 운동·취미를 꾸준히 갈고 닦는 모양|좋아하는 활동에 시간을 들이는 자리|답을 찾는 자리가|재워 주는 자리가|학습 자리|외우던 자리가|새 환경은 [^.!?]*자리가 좋아요|새 자리는 [^.!?]*자리가 좋아요|좋아하는 (?:결|흐름)을 깊게|작은 실천 결로는|사주에서|사주라|사주예요|사주이니|창의을|큰 관계 말|가족과 가까운 사람을|친구·가족과의 자리|따뜻하게 챙겨 주는 자리|새 친구를 만나는 자리|놀이 자리|그 자리에서 사이가|작은 안부 자리가|새로운 자리가 생긴다면|보호자가 옆에 함께 있는 자리|어른의 어휘|친구·가족의 자리를|인연 자산|자기 흙|그릇이 묵직|친구에게 줄 작은 선물|작은 비용|자기 우선순위|좋아하는 책 열 권 사기|작은 외식|평생 갈 자리가|큰 한 방을 좇는 권유|맡은 역할을 단단히 받쳐|페이스를 한 번 늦추는 자리를|즐기는 자리가 보약|풀어 주는 자리가|한꺼번에 잡고 가는 자리|새 가정의 흐름은 [^.!?]*자리라|같은 자리에 오래 앉아|책상의 자리가|햇볕이 잘 드는 자리를|표현해 보는 자리가|마음 자리를|자리를 키워 가는 흐름|강·약 자리가|한 해의 작은 자리에서|오늘의 작은 자리가|긴 흐름 [가-힣 ]+ 영역|인생 전체에서 [가-힣 ]+ 영역에서|결재하지 말고|후배의 길잡이가 되는 자리|작은 여행·짧은 출장|환기 자리|환기 자리가|마음 편한 자리|잠자리·식사 자리|잠 자리·식사 자리|가까운 사람의 손길|가까운 사람의 손길이|중요한 내용은 한 줄로|확인한 내용과 고친 내용을|표현과 창의에서는 완벽하게 보이려|내 자리를 자주 받쳐 주는|내 자리를 부드럽게 받쳐 주는|긴 설명보다 작은 확인|안부 한마디, 집안일 하나|어느 자리에 무게|한 자리에서 무리하면|어깨에 자리가|자라나는 나무에 가지치기|장기 관점이 등장|재물운은 가족·일·자기 사이에서 흐름|긴 설명보다 오늘|긴 설명보다 서로|만들어집니다\.|만들어 줍니다\.|지칩니다\.|줄어듭니다\.|얻습니다\.|이어 줍니다\.|자랍니다\.|살아납니다\.|납니다\.|넓어집니다\.|좋아집니다\.|가벼워집니다\.|단순해집니다\.|분명해집니다\.|또렷해집니다\.|쉬워집니다\.|커집니다\.|이어집니다\.|깊어집니다\.|강해집니다\.|[가-힣]+해집니다\.|[가-힣]+워집니다\.|어렵습니다\.|괜찮습니다\.|쉽습니다\.|중요합니다\.|필요합니다\.|[가-힣]+니다\.|좋습니다\.|도움이 됩니다\.|안정됩니다\.|필요합니다\.|[가-힣]+니다\.|됩니다\.|합니다\.|콘텐츠 한 자락|가르치며 배우는 자리|40·50대 학습자|학업운은 익힌 것을|자리가 자주 열리는 시기|한 해 끝의 한 자락|오늘 유지할 기준|오늘 바로 줄일 부담|오늘 바로 쓸 수 있는 말|공부와 배움에서는 오늘 확인|실제 하루에 붙여|세 달에 한 번씩씩|오늘 덜 지치는 선택|오늘 편했던 시간대|오늘은 편했던 순간|오늘 다시 볼|오늘 가장 부담|오늘의 점검표|바로 줄일 부담/;
const AWKWARD_MATCH_RE = new RegExp(AWKWARD_RE.source, 'g');
const ROLE_PATTERNS = {
  scoreBridge: /숫자와 별점|이 점수는|별점은|숫자는 전체 분위기|점수는 크게/,
  scorePacing: /점수가 좋게 보일 때|좋은 흐름이 보이면|마음을 크게 밀어붙이기보다|지금 서로 편한 장면|결론을 서두르지 말고 말투|관계가 애매하다는 뜻|편했던 순간 하나|말의 속도를 늦추라는 표시|안부 한마디나 고마움|서로 예민한 장면|작은 배려가 관계의 안정감|좋게 보이는 흐름|보통으로 보이는 흐름|낮게 보이는 흐름|흐름이 좋게 보일 때|흐름이 좋게 보이더라도|흐름이 보통으로 보일 때|흐름이 보통으로 보인다는 말|흐름이 보통으로 보인다면|흐름이 낮게 보일 때|흐름이 낮게 보이더라도|흐름이 낮게 보이면|결과보다 관찰|점수보다 더 분명한 체감|무난하게 보인다는 말|아주 강한 신호|보통으로 보이는 흐름|좋은 분위기일수록|편한 말투 하나|좋은 신호가 보일수록|지금 편한 방식|분위기가 괜찮게 느껴질 때|좋은 흐름은 더 많이 벌리는 신호라기보다|가장 효과가 좋았던 한 가지|자신감을 생활의 리듬으로|낮게 보이는 흐름은|먼저 들을 시간과 쉬어 갈 시간|분위기가 무겁게 느껴질 때|작게 말하고 충분히 쉬면|마음이 잘 맞지 않는 날|결론보다 회복|몸이 보내는 작은 신호|무리한 약속을 줄이고|컨디션 신호가 약하게|보통으로 보이는 흐름은 마음이 식었다는 뜻|반복되는 말투와 시간을|관계가 중간처럼 느껴질 때|좋은 흐름은 더 많이 밀어붙이라는 신호|점수가 높게 느껴질 때|좋은 기세가 있을수록|이미 이해한 내용을 자기 말로|몸이 보내는 신호를 먼저 알아차리는|쉬는 시간을 먼저 잡아|컨디션이 약하게 느껴질 때|대화의 크기를 줄이는|서로 덜 날카로울 시간|모든 이유를 한 번에 풀려고|모든 이유를 그 자리에서 다 풀지 않아도|대화를 쉬어 갈 시간/,
  periodScope: /오늘 안에서는|한 번에 풀려고 하지 않아도|짧게 안부를 전할 시간|눈앞의 대화를 편하게|이번 주에는|이번 달에는|올해에는|긴 흐름에서는/,
  selfCheck: /읽고 난 뒤에는|다 읽은 뒤에는|해석을 덮기 전에|마지막으로 .* 내가 이미 잘하고 있는 부분|마지막으로 인생 전체 흐름에서|마지막으로 인생 전체의 표현과 창의(?: 영역)?에서/,
};

const EXPERT_TERM_SCAN_RE = new RegExp(EXPERT_TERMS_RE.source, 'g');
const BALANCE_EXPERT_RE = /극신강|극신약|신강|신약|용신|희신|기신|구신|일간|오행|음양|조후|목|화|토|금|수|yongshin|heeshin|gishin|element|dayMaster/i;
const MOVEMENT_EXPERT_RE = /역마|역마살|지살|이동|여행|원행|출장|동선|전학|이사|학원 변경|환경 변화|생활권 변화|활동 반경|외부 자리|새 환경|먼 길|yeokma|jisal|movement/i;
const HELPER_EXPERT_RE = /천을귀인|천덕귀인|월덕귀인|문창귀인|귀인|덕성|도움|조력|gwiin|cheondeokgwiin|woldeokgwiin|cheonleulgwiin|munchanggwiin|cheondeok|woldeok/i;
const FRICTION_EXPERT_RE = /공망|충돌|자묘형|삼형|형살|형해|육해|해살|원진|귀문|간섭|불안정|흔들|어긋|부딪|gongmang|chung|hyeong|yukhae|jamyohyeong|paehae/i;
const TEN_GOD_EXPERT_RE = /십성|식상|재성|관성|인성|비겁|정관|편관|정인|편인|상관|식신|비견|겁재|정재|편재|격국|jeongin|pyeonin|sikshin|sanggwan|jeonggwan|pyeongwan|jeongjae|pyeonjae|bigyeon|geobjae|gyeok/i;
const TIMING_EXPERT_RE = /대운|세운|월운|일진|운로|시기|세월|daewoon|sewoon/i;

const PAIRING_ANCHOR_RULES = [
  {
    id: 'balance',
    label: '오행·용신 균형',
    expert: BALANCE_EXPERT_RE,
    public: /균형|조절|속도|덜어|채우|부담|기준|힘을 줄|쉬어|보완|맞는|편해|무리|정리|나누|페이스/,
  },
  {
    id: 'movement',
    label: '역마·이동 변화',
    expert: MOVEMENT_EXPERT_RE,
    public: /이동|움직|변화|길|동선|출발|돌아올|장소|낯선|준비|바꿀|그대로 둘|멀리|가까운 곳|걷기|산책|외출|환기|활동|놀이|이사|이동 비용/,
  },
  {
    id: 'helper',
    label: '귀인·도움',
    expert: HELPER_EXPERT_RE,
    public: /도움|도와|곁|사람|조언|고마움|받아들이|함께|기대|손길|나누|부탁|믿을 만한|확인받|보여 주|검토|피드백/,
  },
  {
    id: 'friction',
    label: '충·형·공망 조심',
    expert: FRICTION_EXPERT_RE,
    public: /부딪|흔들|엇갈|간격|천천히|확인|한 박자|조심|비워|비어|쉬어|쉬는|줄이|늦추|덜어|부담|풀어|회복|속도|불편|불안|무리|작게/,
  },
  {
    id: 'timing',
    label: '운의 시간 범위',
    expert: TIMING_EXPERT_RE,
    public: /오늘|이번 주|이번 달|올해|긴 흐름|인생 전체|오래|지금|나중|계절|월말|주말|하루|시간/,
  },
] as const;
interface CliArgs {
  readonly outDir?: string;
  readonly randomCases: number;
  readonly seed: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let outDir: string | undefined;
  let randomCases = 0;
  let seed = 'tiered-copy-random-v1';
  for (const arg of argv) {
    if (arg.startsWith('--out=')) outDir = path.resolve(arg.slice('--out='.length));
    else if (arg.startsWith('--random-cases=')) {
      const value = Number(arg.slice('--random-cases='.length));
      if (Number.isInteger(value) && value >= 0) randomCases = value;
    } else if (arg.startsWith('--seed=')) {
      const value = arg.slice('--seed='.length).trim();
      if (value) seed = value;
    }
  }
  return { outDir, randomCases, seed };
}

function createRng(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6D2B79F5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)] ?? values[0];
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function uniqueFocusItems(rng: () => number): CopyCase['focus'] {
  const out: Array<{ period: FocusPeriod; category: FocusCategory; ageBand?: string }> = [];
  const seen = new Set<string>();
  while (out.length < 6) {
    const period = pick(rng, RANDOM_FOCUS_PERIODS) as FocusPeriod;
    const category = pick(rng, RANDOM_FOCUS_CATEGORIES) as FocusCategory;
    const ageBand = period === 'life' ? pick(rng, RANDOM_LIFE_BANDS) : undefined;
    const key = `${period}.${ageBand ?? ''}.${category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ period, category, ...(ageBand ? { ageBand } : {}) });
  }
  return out;
}

function buildRandomCases(count: number, seed: string): CopyCase[] {
  const rng = createRng(seed);
  const cases: CopyCase[] = [];
  for (let i = 0; i < count; i += 1) {
    const bucket = pick(rng, RANDOM_AGE_BUCKETS);
    const surname = pick(rng, RANDOM_SURNAME_POOL);
    const givenName = pick(rng, RANDOM_GIVEN_NAME_POOL);
    const region = pick(rng, RANDOM_REGIONS);
    const gender = pick(rng, RANDOM_GENDERS);
    const year = randomInt(rng, bucket.minYear, bucket.maxYear);
    const month = randomInt(rng, 1, 12);
    const day = randomInt(rng, 1, 28);
    const hasKnownHour = rng() >= 0.22;
    const hour = hasKnownHour ? randomInt(rng, 0, 23) : null;
    const minute = hasKnownHour ? pick(rng, [0, 5, 10, 15, 20, 30, 40, 45, 50]) : null;
    const name = [surname, ...givenName].map((char) => char.hangul).join('');
    cases.push({
      id: `random-${seed.replace(/[^a-zA-Z0-9_-]/g, '-')}-${String(i + 1).padStart(2, '0')}`,
      label: `랜덤 ${i + 1} · ${bucket.audience} · ${region} · ${name}`,
      audience: bucket.audience,
      request: {
        targetDate,
        birth: { year, month, day, hour, minute, gender, calendarType: 'solar', region, birthPlace: region },
        surname: [surname],
        givenName,
        options: { precisionConfig: { surfaceTieredMatrix: true } },
      },
      focus: uniqueFocusItems(rng),
    });
  }
  return cases;
}

const cliArgs = parseArgs(process.argv.slice(2));
const ANALYSIS_CASES: readonly CopyCase[] = [
  ...CASES,
  ...buildRandomCases(cliArgs.randomCases, cliArgs.seed),
];

function sentenceCount(text: string): number {
  const punctuation = text.match(/[.!?]/g)?.length ?? 0;
  if (punctuation > 0) return punctuation;
  return text.trim().length > 0 ? 1 : 0;
}

function getCell(tm: any, focus: { period: FocusPeriod; category: FocusCategory; ageBand?: string }): any {
  const period = tm?.periods?.[focus.period];
  const scoped = focus.period === 'life' && focus.ageBand
    ? period?.byAgeBand?.[focus.ageBand]
    : period;
  if (focus.category === 'overall') return scoped?.overall;
  return scoped?.byCategory?.[focus.category];
}

function cellRows(tm: any): Array<{ key: string; cell: any }> {
  const rows: Array<{ key: string; cell: any }> = [];
  for (const periodKey of PERIODS) {
    const p = tm?.periods?.[periodKey];
    rows.push({ key: `${periodKey}.overall`, cell: p?.overall });
    for (const category of CATEGORIES) rows.push({ key: `${periodKey}.${category}`, cell: p?.byCategory?.[category] });
    if (periodKey === 'life') {
      for (const [band, scoped] of Object.entries(p?.byAgeBand ?? {})) {
        rows.push({ key: `life.${band}.overall`, cell: (scoped as any)?.overall });
        for (const category of CATEGORIES) rows.push({ key: `life.${band}.${category}`, cell: (scoped as any)?.byCategory?.[category] });
      }
    }
  }
  return rows.filter((row) => row.cell);
}

function textParagraphsOf(cell: any, depth: 'standard' | 'expert'): string[] {
  return (cell?.[depth]?.paragraphs ?? []).map((paragraph: any) => String(paragraph?.plainText ?? '').trim()).filter(Boolean);
}

function paragraphsOf(cell: any): string[] {
  return textParagraphsOf(cell, 'standard');
}

function expertParagraphsOf(cell: any): string[] {
  return textParagraphsOf(cell, 'expert');
}

function paragraphTagLabelsOf(cell: any): string[] {
  const labels: string[] = [];
  for (const paragraph of cell?.expert?.paragraphs ?? []) {
    for (const token of paragraph?.tokens ?? []) {
      if (token?.kind === 'tag' && token.label) labels.push(String(token.label));
    }
  }
  return uniqueStrings(labels);
}

function selectedExpertTagsOf(cell: any): string[] {
  return uniqueStrings((cell?.selectedFragments?.expert?.tags ?? []).map((tag: unknown) => String(tag)).filter(Boolean));
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function categoryFromKey(key: string): string {
  return key.split('.').pop() ?? 'overall';
}

function categoryRolePublicPattern(category: string): RegExp {
  switch (category) {
    case 'wealth':
      return /돈|지출|저축|자산|물건|용돈|필요한 것|나가는 곳|기준/;
    case 'career':
      return /일|책임|역할|마감|회의|신뢰|맡은 일|확인할 일|진로/;
    case 'academic':
    case 'study_document':
      return /공부|기록|배움|문서|노트|다시 볼|정리|표시|확인받|보여 주|검토|믿을 만한/;
    case 'romance':
    case 'family':
      return /관계|마음|말|안부|고마움|가까운 사람|서로|대화/;
    case 'expression_children':
      return /표현|창의|아이디어|기록|꺼내|생각|말|사진/;
    case 'health':
    case 'health_stress':
      return /몸|마음|휴식|긴장|회복|잠|식사|움직임/;
    case 'movement':
      return /이동|변화|동선|길|준비|움직|바꿀|돌아올/;
    default:
      return /생활|일정|관계|몸|마음|부담|습관|선택|기준|조절/;
  }
}

function expertTermsOf(cell: any, expertParagraphs: readonly string[]): string[] {
  const textTerms = uniqueStrings(expertParagraphs.join('\n').match(EXPERT_TERM_SCAN_RE) ?? []);
  const tagLabels = paragraphTagLabelsOf(cell);
  const selectedTags = selectedExpertTagsOf(cell).map((tag) => `tag:${tag}`);
  return uniqueStrings([...textTerms, ...tagLabels, ...selectedTags]).slice(0, 18);
}

function summarizePairing(key: string, cell: any, standardText: string, expertText: string) {
  const tagSignal = [
    ...paragraphTagLabelsOf(cell),
    ...selectedExpertTagsOf(cell),
  ].join(' ');
  const expertSignal = `${expertText}\n${tagSignal}`;
  const category = categoryFromKey(key);
  const matchedAnchors: Array<{ id: string; label: string; publicCovered: boolean }> = PAIRING_ANCHOR_RULES
    .filter((rule) => rule.expert.test(expertSignal))
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      publicCovered: rule.public.test(standardText),
    }));
  if (TEN_GOD_EXPERT_RE.test(expertSignal)) {
    const publicCovered = categoryRolePublicPattern(category).test(standardText);
    matchedAnchors.push({ id: 'tenGodRole', label: '십성·격국 역할', publicCovered });
  }
  const missingAnchors = matchedAnchors.filter((anchor) => !anchor.publicCovered);
  return {
    category,
    expertTagCount: selectedExpertTagsOf(cell).length,
    matchedAnchors,
    missingAnchors,
  };
}

function countTerm(text: string, term: string): number {
  return (text.match(new RegExp(term, 'g')) ?? []).length;
}

function summarizeCell(key: string, cell: any) {
  const paragraphs = paragraphsOf(cell);
  const expertParagraphs = expertParagraphsOf(cell);
  const joined = paragraphs.join('\n');
  const expertJoined = expertParagraphs.join('\n');
  const pairing = summarizePairing(key, cell, joined, expertJoined);
  const awkwardMatches = paragraphs.flatMap((text, index) =>
    Array.from(text.matchAll(AWKWARD_MATCH_RE), (match) => ({
      index: index + 1,
      match: match[0],
      text: compactParagraph(text).slice(0, 320),
    })),
  );
  return {
    key,
    meaningfulness: cell?.meaningfulness,
    stars: cell?.stars,
    paragraphCount: paragraphs.length,
    sentenceCounts: paragraphs.map(sentenceCount),
    charCounts: paragraphs.map((text) => [...text].length),
    expertParagraphCount: expertParagraphs.length,
    expertTerms: expertTermsOf(cell, expertParagraphs),
    selectedExpertTags: selectedExpertTagsOf(cell),
    pairing,
    roleCoverage: Object.fromEntries(Object.entries(ROLE_PATTERNS).map(([id, pattern]) => [id, pattern.test(joined)])),
    flags: {
      expertTermLeak: EXPERT_TERMS_RE.test(joined),
      adultMinorTerm: MINOR_ADULT_RE.test(joined),
      awkward: awkwardMatches.length > 0,
      awkwardMatches,
      pairingGaps: pairing.missingAnchors,
      veryLongParagraphs: paragraphs.map((text, index) => ({ index: index + 1, length: [...text].length })).filter((row) => row.length > 260),
      flowOveruse: paragraphs.map((text, index) => ({ index: index + 1, count: countTerm(text, '흐름') })).filter((row) => row.count >= 4),
      placeOveruse: paragraphs.map((text, index) => ({ index: index + 1, count: countTerm(text, '자리') })).filter((row) => row.count >= 4),
    },
    paragraphs,
    expertParagraphs,
  };
}

function compactParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function renderMarkdown(result: any): string {
  const lines: string[] = [];
  lines.push('# Tiered Standard Copy Case Analysis');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Target date: ${targetDate}`);
  lines.push('');
  lines.push('## Overall Metrics');
  lines.push('');
  lines.push(`- Cases: ${result.summary.caseCount}`);
  lines.push(`- Cells scanned: ${result.summary.cellsScanned}`);
  lines.push(`- Focus cells sampled: ${result.summary.focusCells}`);
  lines.push(`- Min/avg/max standard paragraphs: ${result.summary.paragraphs.min} / ${result.summary.paragraphs.avg.toFixed(2)} / ${result.summary.paragraphs.max}`);
  lines.push(`- Min/avg/max paragraph chars: ${result.summary.paragraphChars.min} / ${result.summary.paragraphChars.avg.toFixed(1)} / ${result.summary.paragraphChars.max}`);
  lines.push(`- Expert term leaks in standard: ${result.summary.flags.expertTermLeaks}`);
  lines.push(`- Minor adult wording leaks in standard: ${result.summary.flags.minorAdultLeaks}`);
  lines.push(`- Awkward public-copy hits: ${result.summary.flags.awkwardHits}`);
  lines.push(`- Very long paragraph hits (>260 chars): ${result.summary.flags.veryLongParagraphHits}`);
  lines.push(`- Flow/place overuse hits: ${result.summary.flags.flowOveruseHits}/${result.summary.flags.placeOveruseHits}`);
  lines.push(`- Expert/standard pairing gaps: ${result.summary.flags.pairingGapHits}`);
  lines.push('');
  lines.push('## Case Samples');
  for (const caseResult of result.cases) {
    lines.push('');
    lines.push(`### ${caseResult.label}`);
    lines.push('');
    lines.push(`- Audience: ${caseResult.audience}`);
    lines.push(`- Name: ${caseResult.name}`);
    lines.push(`- Birth: ${caseResult.birth}`);
    lines.push(`- Overall role coverage: ${Object.entries(caseResult.roleCoverage).map(([k, v]) => `${k}=${v ? 'Y' : 'N'}`).join(', ')}`);
    for (const sample of caseResult.focusSamples) {
      lines.push('');
      lines.push(`#### ${sample.key} · stars=${sample.stars ?? 'null'} · ${sample.meaningfulness}`);
      sample.paragraphs.slice(0, 6).forEach((paragraph: string, index: number) => {
        lines.push(`${index + 1}. ${compactParagraph(paragraph)}`);
      });
      if (sample.expertTerms?.length) lines.push(`- Expert terms/tags: ${sample.expertTerms.join(', ')}`);
      if (sample.pairing?.matchedAnchors?.length) {
        const matched = sample.pairing.matchedAnchors.map((anchor: any) => `${anchor.label}=${anchor.publicCovered ? 'OK' : 'GAP'}`).join(', ');
        lines.push(`- Pairing check: ${matched}`);
      }
      if (sample.expertParagraphs?.length) {
        lines.push('- Expert basis excerpts:');
        sample.expertParagraphs.slice(0, 2).forEach((paragraph: string, index: number) => {
          lines.push(`  - E${index + 1}. ${compactParagraph(paragraph).slice(0, 260)}`);
        });
      }
      const flagSummary = Object.entries(sample.flags)
        .filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value))
        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.length : value}`)
        .join(', ');
      if (flagSummary) lines.push(`- Flags: ${flagSummary}`);
    }
  }
  lines.push('');
  lines.push('## Flag Examples');
  const flagEntries = Object.entries(result.flagExamples ?? {}) as Array<[string, any[]]>;
  for (const [flagName, rows] of flagEntries) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    lines.push('');
    lines.push(`### ${flagName}`);
    for (const row of rows.slice(0, 8)) {
      const matchLabel = row.match ? ` [${row.match}]` : '';
      lines.push(`- ${row.caseId} ${row.key}${row.paragraphIndex ? ` #${row.paragraphIndex}` : ''}${matchLabel}: ${compactParagraph(String(row.text ?? ''))}`);
    }
  }
  lines.push('');
  lines.push('## Repeated Paragraphs');
  for (const row of result.repeatedParagraphs.slice(0, 20)) {
    lines.push(`- ${row.count}x: ${compactParagraph(row.text).slice(0, 220)}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

const paragraphFrequency = new Map<string, number>();
const caseResults: any[] = [];
let cellsScanned = 0;
const allCellSummaries: any[] = [];

for (const testCase of ANALYSIS_CASES) {
  const report: any = await engine.getFortuneReport(testCase.request);
  const tm = report?.tieredMatrix;
  const rows = cellRows(tm);
  cellsScanned += rows.length;
  const rowSummaries = rows.map((row) => summarizeCell(row.key, row.cell));
  allCellSummaries.push(...rowSummaries.map((row) => ({ ...row, caseId: testCase.id, audience: testCase.audience })));
  for (const row of rowSummaries) {
    for (const paragraph of row.paragraphs) {
      const normalized = compactParagraph(paragraph);
      paragraphFrequency.set(normalized, (paragraphFrequency.get(normalized) ?? 0) + 1);
    }
  }

  const focusSamples = testCase.focus.map((focus) => {
    const key = focus.period === 'life' && focus.ageBand
      ? `life.${focus.ageBand}.${focus.category}`
      : `${focus.period}.${focus.category}`;
    return summarizeCell(key, getCell(tm, focus));
  });
  const allText = rowSummaries.flatMap((row) => row.paragraphs).join('\n');
  caseResults.push({
    id: testCase.id,
    label: testCase.label,
    audience: testCase.audience,
    name: [
      ...(testCase.request.surname ?? []),
      ...(testCase.request.givenName ?? []),
    ].map((char: any) => char.hangul).join(''),
    birth: `${testCase.request.birth.year}-${String(testCase.request.birth.month).padStart(2, '0')}-${String(testCase.request.birth.day).padStart(2, '0')} ${testCase.request.birth.hour ?? '??'}:${testCase.request.birth.minute ?? '??'} ${testCase.request.birth.gender}`,
    meta: report?.meta,
    roleCoverage: Object.fromEntries(Object.entries(ROLE_PATTERNS).map(([id, pattern]) => [id, pattern.test(allText)])),
    focusSamples,
  });
}

engine.close();

const paragraphCounts = allCellSummaries.map((row) => row.paragraphCount);
const paragraphChars = allCellSummaries.flatMap((row) => row.charCounts);
const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
const repeatedParagraphs = Array.from(paragraphFrequency.entries())
  .map(([text, count]) => ({ text, count }))
  .filter((row) => row.count >= 3)
  .sort((a, b) => b.count - a.count || b.text.length - a.text.length);

function flagRow(row: any, reason: string, paragraphIndex?: number, count?: number, match?: string): any {
  const paragraph = typeof paragraphIndex === 'number' ? row.paragraphs[paragraphIndex - 1] : row.paragraphs.find(Boolean);
  return {
    caseId: row.caseId,
    audience: row.audience,
    key: row.key,
    reason,
    ...(typeof paragraphIndex === 'number' ? { paragraphIndex } : {}),
    ...(typeof count === 'number' ? { count } : {}),
    ...(match ? { match } : {}),
    text: compactParagraph(String(paragraph ?? '')).slice(0, 320),
    paragraphs: row.paragraphs,
    expertParagraphs: row.expertParagraphs,
    pairing: row.pairing,
  };
}

const flagExamples = {
  expertTermLeaks: allCellSummaries.filter((row) => row.flags.expertTermLeak).slice(0, 12).map((row) => flagRow(row, 'expertTermLeak')),
  minorAdultLeaks: allCellSummaries
    .filter((row) => (row.audience === 'minor' || row.audience === 'child') && row.flags.adultMinorTerm)
    .slice(0, 12)
    .map((row) => flagRow(row, 'minorAdultTerm')),
  awkward: allCellSummaries.filter((row) => row.flags.awkward).slice(0, 12).map((row) => {
    const first = row.flags.awkwardMatches?.[0];
    return flagRow(row, 'awkward', first?.index, undefined, first?.match);
  }),
  veryLongParagraphs: allCellSummaries.flatMap((row) =>
    row.flags.veryLongParagraphs.map((item: any) => flagRow(row, 'veryLongParagraph', item.index, item.length))).slice(0, 12),
  flowOveruse: allCellSummaries.flatMap((row) =>
    row.flags.flowOveruse.map((item: any) => flagRow(row, 'flowOveruse', item.index, item.count))).slice(0, 12),
  placeOveruse: allCellSummaries.flatMap((row) =>
    row.flags.placeOveruse.map((item: any) => flagRow(row, 'placeOveruse', item.index, item.count))).slice(0, 12),
  pairingGaps: allCellSummaries
    .filter((row) => row.flags.pairingGaps.length > 0)
    .slice(0, 12)
    .map((row) => flagRow(
      row,
      'pairingGap',
      undefined,
      row.flags.pairingGaps.length,
      row.flags.pairingGaps.map((anchor: any) => anchor.label).join(', '),
    )),
};

const result = {
  summary: {
    seed: cliArgs.seed,
    randomCases: cliArgs.randomCases,
    caseCount: ANALYSIS_CASES.length,
    cellsScanned,
    focusCells: ANALYSIS_CASES.reduce((acc, item) => acc + item.focus.length, 0),
    paragraphs: {
      min: Math.min(...paragraphCounts),
      avg: sum(paragraphCounts) / paragraphCounts.length,
      max: Math.max(...paragraphCounts),
    },
    paragraphChars: {
      min: Math.min(...paragraphChars),
      avg: sum(paragraphChars) / paragraphChars.length,
      max: Math.max(...paragraphChars),
    },
    flags: {
      expertTermLeaks: allCellSummaries.filter((row) => row.flags.expertTermLeak).length,
      minorAdultLeaks: allCellSummaries.filter((row) => (row.audience === 'minor' || row.audience === 'child') && row.flags.adultMinorTerm).length,
      awkwardHits: allCellSummaries.filter((row) => row.flags.awkward).length,
      veryLongParagraphHits: allCellSummaries.reduce((acc, row) => acc + row.flags.veryLongParagraphs.length, 0),
      flowOveruseHits: allCellSummaries.reduce((acc, row) => acc + row.flags.flowOveruse.length, 0),
      placeOveruseHits: allCellSummaries.reduce((acc, row) => acc + row.flags.placeOveruse.length, 0),
      pairingGapHits: allCellSummaries.reduce((acc, row) => acc + row.flags.pairingGaps.length, 0),
    },
  },
  cases: caseResults,
  repeatedParagraphs,
  flagExamples,
  allCellSummaries: allCellSummaries.map((row) => ({
    caseId: row.caseId,
    audience: row.audience,
    key: row.key,
    meaningfulness: row.meaningfulness,
    stars: row.stars,
    paragraphCount: row.paragraphCount,
    sentenceCounts: row.sentenceCounts,
    charCounts: row.charCounts,
    expertParagraphCount: row.expertParagraphCount,
    expertTerms: row.expertTerms,
    selectedExpertTags: row.selectedExpertTags,
    pairing: row.pairing,
    roleCoverage: row.roleCoverage,
    flags: row.flags,
  })),
};

const outDir = cliArgs.outDir
  ? cliArgs.outDir
  : path.resolve(REPO_ROOT, 'artifacts', `tiered-copy-analysis-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'samples.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(outDir, 'analysis.md'), renderMarkdown(result));
console.log(JSON.stringify({ outDir, summary: result.summary }, null, 2));