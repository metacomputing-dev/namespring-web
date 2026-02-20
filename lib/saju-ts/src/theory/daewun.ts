/**
 * daewun.ts — 대운론 (大運論)
 *
 * 사주명리학의 대운(大運), 세운(歲運), 월운(月運), 소운(小運) 이론 구현.
 *
 * 대운(大運): 10년 단위로 바뀌는 운의 흐름. 사주 원국(原局)과 함께
 * 삶의 큰 흐름을 결정하는 핵심 요소.
 *
 * 세운(歲運): 매년 바뀌는 태세(太歲)의 천간·지지가 원국 및 대운과
 * 상호작용하여 그해의 운을 형성함.
 *
 * 월운(月運): 매월 절기(節氣)를 기준으로 바뀌는 천간·지지의 작용.
 *
 * 소운(小運): 대운이 시작되기 전 유아기에 적용되는 1년 단위 운.
 *
 * 교운기(交運期): 대운이 바뀌는 전후 시기로, 운의 전환이 체감되는 특수한 시기.
 *
 * 근거 문헌: 子平眞詮(자평진전), 滴天髓(적천수), 窮通寶鑑(궁통보감),
 *           三命通會(삼명통회), 命理約言(명리약언)
 */

import type { StemIdx, BranchIdx } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 1. 성별 타입
// ---------------------------------------------------------------------------

/** 성별 */
export type Gender = 'MALE' | 'FEMALE';

/**
 * 대운 순행·역행 구분.
 *
 * SUNHAENG (順行): 양남(陽男) / 음녀(陰女) — 생일 이후 다음 절기 방향
 * YEOKHAENG (逆行): 음남(陰男) / 양녀(陽女) — 생일 이전 절기 방향
 */
export type DaewunDirection = 'SUNHAENG' | 'YEOKHAENG';

// ---------------------------------------------------------------------------
// 2. 대운 방향 결정
// ---------------------------------------------------------------------------

/**
 * 일간(日干) 천간 인덱스와 성별로 대운 순행·역행을 결정한다.
 *
 * 원칙:
 *   천간 짝수 인덱스(甲=0, 丙=2, 戊=4, 庚=6, 壬=8) -> 양간(陽干)
 *   천간 홀수 인덱스(乙=1, 丁=3, 己=5, 辛=7, 癸=9) -> 음간(陰干)
 *
 *   양남(陽男) / 음녀(陰女) -> 순행(順行)
 *   음남(陰男) / 양녀(陽女) -> 역행(逆行)
 *
 * 핵심 근거:
 *   양(陽)은 하늘의 도(天道)를 따라 순행하고,
 *   음(陰)은 하늘의 도를 거슬러 역행한다.
 *   남자는 양(陽)에 속하므로 양간 남자는 순행,
 *   여자는 음(陰)에 속하므로 음간 여자도 순행이다.
 *   반대의 경우는 역행한다.
 *
 * @param birthStemIdx - 연간(年干) 천간 인덱스 (甲=0 ... 癸=9)
 *   주의: 대운 방향 결정은 전통적으로 연간(年干)의 음양으로 판단한다.
 *   일부 학파는 일간(日干)을 쓰기도 하나, 다수설은 연간(年干) 기준이다.
 * @param gender       - 성별
 */
export function getDaewunDirection(
  birthStemIdx: StemIdx,
  gender: Gender,
): DaewunDirection {
  const isYangStem = birthStemIdx % 2 === 0; // 양간(陽干) 여부
  const isMale = gender === 'MALE';

  // 양남(陽男) 또는 음녀(陰女) -> 순행(順行)
  if ((isYangStem && isMale) || (!isYangStem && !isMale)) {
    return 'SUNHAENG';
  }
  // 음남(陰男) 또는 양녀(陽女) -> 역행(逆行)
  return 'YEOKHAENG';
}

/**
 * 대운 방향 결정 상세 규칙 데이터.
 *
 * 양남양녀(陽男陽女) / 음남음녀(陰男陰女) 조합별 순역행을 명시한다.
 */
export const DAEWUN_DIRECTION_RULES = [
  {
    key: 'YANG_NAM',
    label: '양남 (陽男)',
    description: '연간(年干)이 양간(甲丙戊庚壬)인 남자. 순행(順行).',
    direction: 'SUNHAENG' as DaewunDirection,
    yinYang: 'YANG',
    gender: 'MALE' as Gender,
    jeolgiDirection: '생일 이후 다음 절기(節氣)까지의 날수를 센다.',
  },
  {
    key: 'EUM_NYEO',
    label: '음녀 (陰女)',
    description: '연간(年干)이 음간(乙丁己辛癸)인 여자. 순행(順行).',
    direction: 'SUNHAENG' as DaewunDirection,
    yinYang: 'YIN',
    gender: 'FEMALE' as Gender,
    jeolgiDirection: '생일 이후 다음 절기(節氣)까지의 날수를 센다.',
  },
  {
    key: 'EUM_NAM',
    label: '음남 (陰男)',
    description: '연간(年干)이 음간(乙丁己辛癸)인 남자. 역행(逆行).',
    direction: 'YEOKHAENG' as DaewunDirection,
    yinYang: 'YIN',
    gender: 'MALE' as Gender,
    jeolgiDirection: '생일 이전 직전 절기(節氣)까지의 날수를 센다.',
  },
  {
    key: 'YANG_NYEO',
    label: '양녀 (陽女)',
    description: '연간(年干)이 양간(甲丙戊庚壬)인 여자. 역행(逆行).',
    direction: 'YEOKHAENG' as DaewunDirection,
    yinYang: 'YANG',
    gender: 'FEMALE' as Gender,
    jeolgiDirection: '생일 이전 직전 절기(節氣)까지의 날수를 센다.',
  },
] as const;

// ---------------------------------------------------------------------------
// 3. 대운 시작 나이 계산
// ---------------------------------------------------------------------------

/**
 * 대운 시작 나이 계산의 상세 규칙.
 *
 * 원칙 (삼일일세법 三日一歲法):
 *   순행(順行): 생일부터 다음 절기(節氣)까지 일수 / 3 = 대운 시작 나이(세)
 *   역행(逆行): 생일부터 이전 절기(節氣)까지 일수 / 3 = 대운 시작 나이(세)
 *
 * 상세 환산:
 *   3일 = 1년(1세)
 *   1일 = 4개월
 *   2시간(1시진) = 10일
 *
 * 잔여일 처리:
 *   나머지 1일 -> 4개월 환산
 *   나머지 2일 -> 8개월 환산
 *
 * 학파별 차이:
 *   - 정수법(整數法): 소수점 이하 반올림하여 정수 나이만 사용
 *   - 정밀법(精密法): 일/시간 단위까지 환산하여 정확한 시점 산출
 *   - 사사오입법: 0.5세 이상은 올림, 미만은 버림
 */
export const DAEWUN_START_AGE_THEORY = {
  /** 기본 원칙: 삼일일세법 (三日一歲法) */
  principle:
    '생일(生日)에서 관련 절기(節氣)까지의 날수를 3으로 나누면 대운 시작 나이가 된다. ' +
    '3일이 1년에 해당하므로, 나머지 1일은 4개월, 나머지 2일은 8개월로 환산한다.',
  /** 순행 시 절기 방향 */
  sunhaengRule:
    '순행(順行, 양남/음녀): 생일 이후 돌아오는 다음 절기(節氣)까지의 날수를 센다. ' +
    '예: 입춘(立春) 이후 태어나면 다음 절기인 경칩(驚蟄)까지의 날수.',
  /** 역행 시 절기 방향 */
  yeokhaengRule:
    '역행(逆行, 음남/양녀): 생일 이전 직전 절기(節氣)까지의 날수를 센다. ' +
    '예: 경칩 이후 태어나면 직전 절기인 입춘까지의 날수를 역으로 센다.',
  /** 최소값 */
  minimumAge: '대운 시작 나이의 최소값은 1세이다. 계산 결과가 0 이하이면 1세로 한다.',
  /** 주의 사항 */
  caution:
    '여기서 "절기"는 12절(十二節)만을 의미하며 12중기(十二中氣)는 포함하지 않는다. ' +
    '입춘, 경칩, 청명, 입하, 망종, 소서, 입추, 백로, 한로, 입동, 대설, 소한의 12절.',
} as const;

/**
 * 대운 시작 나이를 계산한다 (정수법).
 *
 * @param daysToJeolgi - 생일~해당 절기 사이의 날수 (양수)
 * @returns 대운 시작 나이 (세, 최소 1)
 */
export function calcDaewunStartAge(
  daysToJeolgi: number,
): number {
  return Math.max(1, Math.round(daysToJeolgi / 3));
}

/**
 * 대운 시작 나이를 상세하게 계산한다 (정밀법).
 *
 * 잔여일을 개월 단위로 환산하여 반환한다.
 *
 * @param daysToJeolgi - 생일~절기 사이의 날수 (양수)
 * @returns { years, months } 대운 시작 시점 (년/월)
 */
export function calcDaewunStartAgeDetailed(
  daysToJeolgi: number,
): { years: number; months: number } {
  const years = Math.floor(daysToJeolgi / 3);
  const remainder = daysToJeolgi % 3;
  const months = remainder * 4; // 1일 = 4개월
  // 최소 1세 보장
  if (years === 0 && months === 0) {
    return { years: 1, months: 0 };
  }
  return { years: Math.max(years, 0), months };
}

/**
 * 일간·성별을 함께 받아 대운 방향과 시작 나이를 한 번에 반환한다.
 *
 * @param birthStemIdx - 연간(年干) 천간 인덱스
 * @param gender       - 성별
 * @param daysToJeolgi - 생일~관련 절기까지 날수
 *   순행: 다음 절기까지 날수 / 역행: 이전 절기까지 날수
 */
export function calcDaewunInfo(
  birthStemIdx: StemIdx,
  gender: Gender,
  daysToJeolgi: number,
): { direction: DaewunDirection; startAge: number } {
  const direction = getDaewunDirection(birthStemIdx, gender);
  const startAge = calcDaewunStartAge(daysToJeolgi);
  return { direction, startAge };
}

// ---------------------------------------------------------------------------
// 4. 대운 천간·지지 목록 생성
// ---------------------------------------------------------------------------

/**
 * 한 개 대운의 천간·지지.
 */
export interface DaewunPillar {
  /** 대운 순서 (0 = 첫 번째 대운) */
  index: number;
  /** 대운 천간 인덱스 (甲=0 ... 癸=9) */
  stem: StemIdx;
  /** 대운 지지 인덱스 (子=0 ... 亥=11) */
  branch: BranchIdx;
  /** 대운 시작 나이 (세) */
  startAge: number;
  /** 대운 종료 나이 (세, startAge + 9) */
  endAge: number;
}

/**
 * 월주(月柱)를 기준으로 대운 목록을 생성한다.
 *
 * 순행(順行): 월주 다음 간지부터 순서대로
 * 역행(逆行): 월주 이전 간지부터 역순으로
 *
 * 60갑자 순환: 천간 mod 10, 지지 mod 12.
 *
 * @param monthStem   - 월간(月干) 인덱스
 * @param monthBranch - 월지(月支) 인덱스
 * @param direction   - 순행 / 역행
 * @param startAge    - 첫 대운 시작 나이
 * @param count       - 생성할 대운 개수 (기본 8개 = 80년)
 */
export function buildDaewunList(
  monthStem: StemIdx,
  monthBranch: BranchIdx,
  direction: DaewunDirection,
  startAge: number,
  count = 8,
): DaewunPillar[] {
  const step = direction === 'SUNHAENG' ? 1 : -1;
  const result: DaewunPillar[] = [];

  for (let i = 0; i < count; i++) {
    const offset = (i + 1) * step;
    const stem: StemIdx = ((monthStem + offset) % 10 + 10) % 10;
    const branch: BranchIdx = ((monthBranch + offset) % 12 + 12) % 12;
    const age = startAge + i * 10;
    result.push({ index: i, stem, branch, startAge: age, endAge: age + 9 });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 5. 대운 전반5년·후반5년 원칙 상세
// ---------------------------------------------------------------------------

/**
 * 대운 10년 내 천간·지지 작용 시기.
 *
 * 전통적 원칙:
 *   전반(前半) 5년 -- 대운 천간(天干)이 주도적으로 작용
 *   후반(後半) 5년 -- 대운 지지(地支)가 주도적으로 작용
 *
 * 단, 일부 학파는 천간이 표면·지지가 내면으로 동시에 작용한다고 본다.
 */
export interface DaewunHalfPeriod {
  /** 전반/후반 구분 */
  period: 'JEONBAN' | 'HUBAN';
  /** 주도 주체: STEM = 천간(天干), BRANCH = 지지(地支) */
  dominant: 'STEM' | 'BRANCH';
  /** 설명 */
  description: string;
}

export const DAEWUN_HALF_PERIODS: DaewunHalfPeriod[] = [
  {
    period: 'JEONBAN',
    dominant: 'STEM',
    // 전반(前半) 5년: 천간 주도 -- 사회적·외적 사건에 영향
    description: '전반(前半) 5년: 천간(天干)이 주도. 사회적·외적 사건에 영향이 크다.',
  },
  {
    period: 'HUBAN',
    dominant: 'BRANCH',
    // 후반(後半) 5년: 지지 주도 -- 내면·건강·환경 변화에 영향
    description: '후반(後半) 5년: 지지(地支)가 주도. 내면·건강·환경 변화에 영향이 크다.',
  },
];

/**
 * 대운 전반·후반 5년의 상세 해석 원칙.
 *
 * 전반 5년 (천간 위주):
 *   - 천간은 드러나는 것(表)이므로 사회적 활동, 직업, 외적 환경의 변화를 주도한다.
 *   - 천간의 십신이 일간에게 어떤 작용을 하는지가 핵심 판단 기준이다.
 *   - 천간끼리의 합(合)·충(沖)도 이 시기에 강하게 발현된다.
 *
 * 후반 5년 (지지 위주):
 *   - 지지는 숨어있는 것(裏)이므로 내면 심리, 건강, 가정환경의 변화를 주도한다.
 *   - 지지의 지장간(藏干)이 일간에 미치는 영향을 본다.
 *   - 지지끼리의 합(合)·충(沖)·형(刑)·파(破)·해(害)가 강하게 발현된다.
 *   - 지지가 원국 지지와 삼합(三合)·방합(方合)을 이루는지도 확인한다.
 */
export const DAEWUN_HALF_PERIOD_DETAIL = {
  jeonban: {
    label: '전반(前半) 5년',
    dominant: 'STEM' as const,
    principles: [
      '천간(天干)은 表(표, 겉)에 해당하며, 사회적·외적 환경을 주도한다.',
      '대운 천간이 일간(日干)에 대해 어떤 십신(十神)인지를 먼저 판단한다.',
      '대운 천간과 원국(原局) 천간 사이의 합(天干合)·충(天干沖)을 확인한다.',
      '합이 이루어지면 오행 변화가 발생하여 운의 성질이 바뀔 수 있다.',
      '천간의 작용은 비교적 빠르게 나타나며, 외부에서 감지하기 쉽다.',
      '직업 변동, 사회적 지위 변화, 대인관계 변화 등이 이 시기에 두드러진다.',
    ],
  },
  huban: {
    label: '후반(後半) 5년',
    dominant: 'BRANCH' as const,
    principles: [
      '지지(地支)는 裏(리, 속)에 해당하며, 내면·건강·환경을 주도한다.',
      '대운 지지가 원국 지지와 충(沖)·형(刑)·합(合)·파(破)·해(害)를 이루는지 확인한다.',
      '대운 지지의 지장간(藏干)이 일간에 대해 어떤 십신인지를 판단한다.',
      '지지의 작용은 천간보다 느리게 나타나지만, 영향은 더 깊고 지속적이다.',
      '건강 문제, 거주지 변동, 가족관계 변화, 내면 심리 변화가 이 시기에 두드러진다.',
      '삼합(三合)·방합(方合)·육합(六合) 등 지지 합국이 형성되면 강력한 기운 변화가 발생한다.',
    ],
  },
  hakpaByeonhwa: {
    label: '학파별 견해 차이',
    views: [
      '다수설(多數說): 전반 5년은 천간, 후반 5년은 지지가 주도한다.',
      '동시작용설(同時作用說): 천간과 지지는 10년 내내 동시에 작용하되, 천간은 외면, 지지는 내면에 영향한다.',
      '비율설(比率說): 전반에 천간 70%·지지 30%, 후반에 천간 30%·지지 70%로 작용한다.',
      '점진전환설(漸進轉換說): 천간에서 지지로 서서히 주도권이 이전되며, 경계가 명확하지 않다.',
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// 6. 소운 (小運)
// ---------------------------------------------------------------------------

/**
 * 소운(小運) -- 대운이 아직 시작되지 않은 유년기(幼年期)에 적용하는 1년 단위 운.
 *
 * 소운 이론 상세:
 *   - 대운이 시작되기 전(기운수 起運數 이전)의 유아기에 적용한다.
 *   - 대운과 동일한 순행/역행 방향으로 월주(月柱)에서 1간지씩 진행한다.
 *   - 소운은 대운이 본격적으로 시작되면 그 역할이 끝난다.
 *   - 일부 학파는 소운을 중시하지 않고, 대운 미시작 기간은 월주(月柱)의
 *     영향 아래 있다고 보기도 한다.
 *
 * 소운의 해석:
 *   - 소운의 천간·지지도 일간에 대한 십신으로 해석한다.
 *   - 유아기의 건강, 양육 환경, 성장 조건 등을 판단하는 보조 지표.
 *   - 소운 기간 중 세운(歲運)과의 상호작용도 함께 본다.
 */
export interface SoWunPillar {
  /** 나이 (세) */
  age: number;
  /** 천간 인덱스 */
  stem: StemIdx;
  /** 지지 인덱스 */
  branch: BranchIdx;
}

/**
 * 소운 목록을 생성한다.
 *
 * @param monthStem      - 월간 인덱스
 * @param monthBranch    - 월지 인덱스
 * @param direction      - 순행 / 역행
 * @param daewunStartAge - 대운 시작 나이 (소운은 그 이전까지 적용)
 */
export function buildSoWunList(
  monthStem: StemIdx,
  monthBranch: BranchIdx,
  direction: DaewunDirection,
  daewunStartAge: number,
): SoWunPillar[] {
  const step = direction === 'SUNHAENG' ? 1 : -1;
  const result: SoWunPillar[] = [];

  for (let i = 0; i < daewunStartAge; i++) {
    const offset = (i + 1) * step;
    const stem: StemIdx = ((monthStem + offset) % 10 + 10) % 10;
    const branch: BranchIdx = ((monthBranch + offset) % 12 + 12) % 12;
    result.push({ age: i + 1, stem, branch });
  }

  return result;
}

/**
 * 소운(小運) 이론 상세 해설.
 */
export const SOWUN_THEORY = {
  definition:
    '소운(小運)이란 대운(大運)이 시작되기 전 유아기에 적용하는 1년 단위의 운이다. ' +
    '대운 방향(순행/역행)과 동일한 방향으로 월주(月柱)에서 간지를 진행한다.',
  significance:
    '소운은 유아기의 양육 환경, 건강 상태, 가정 환경을 보여주는 지표이다. ' +
    '대운에 비해 영향력은 약하나, 대운 시작 전의 초년 운을 판단하는 데 참고한다.',
  hakpaChai: [
    '중시설: 소운도 대운과 유사한 방식으로 해석하며, 유아기 흉사를 판단하는 데 활용.',
    '경시설: 소운의 영향력이 미약하여 대운 시작 전은 월주(月柱)로 대체 판단.',
    '절충설: 소운은 참고 사항으로만 활용하되, 세운과의 조합에서만 의미를 부여.',
  ],
  gijunChai: [
    '월주 기준설(다수설): 월주에서 순행/역행하여 간지를 배정한다.',
    '시주 기준설(소수설): 시주에서 순행/역행하여 간지를 배정한다.',
  ],
} as const;

// ---------------------------------------------------------------------------
// 7. 세운 (歲運)
// ---------------------------------------------------------------------------

/**
 * 세운(歲運) -- 매년 태세(太歲)의 천간·지지.
 *
 * 기준: 서기 4년 = 甲子(갑자, stemIdx=0, branchIdx=0)
 *   천간 인덱스 = (연도 - 4) mod 10
 *   지지 인덱스 = (연도 - 4) mod 12
 */
export interface SeWunPillar {
  /** 서기 연도 */
  year: number;
  /** 태세 천간 인덱스 */
  stem: StemIdx;
  /** 태세 지지 인덱스 */
  branch: BranchIdx;
}

/**
 * 특정 서기 연도의 태세(太歲) 천간·지지를 반환한다.
 *
 * @param year - 서기 연도 (예: 2026)
 */
export function getSeWun(year: number): SeWunPillar {
  const stem: StemIdx = ((year - 4) % 10 + 10) % 10;
  const branch: BranchIdx = ((year - 4) % 12 + 12) % 12;
  return { year, stem, branch };
}

/**
 * 연속된 세운 목록을 생성한다.
 *
 * @param startYear - 시작 연도
 * @param count     - 연도 수
 */
export function buildSeWunList(startYear: number, count: number): SeWunPillar[] {
  return Array.from({ length: count }, (_, i) => getSeWun(startYear + i));
}

/**
 * 세운(歲運) 이론 상세.
 *
 * 세운은 매년 돌아오는 간지(干支)의 영향으로, 그해의 길흉화복을 판단한다.
 * 원국(原局)과 대운(大運)이 삶의 큰 틀이라면, 세운은 그 틀 안에서
 * 매년 구체적으로 발현되는 사건의 성격을 결정한다.
 */
export const SEWUN_THEORY = {
  definition:
    '세운(歲運)이란 매년 태세(太歲)의 천간·지지가 원국(原局) 및 대운(大運)과 ' +
    '상호작용하여 형성하는 1년 단위의 운이다.',
  importance: [
    '세운은 원국과 대운의 관계 속에서 구체적 사건의 발현 시점을 결정한다.',
    '길한 대운이라도 흉한 세운이 오면 그해에 어려움이 발생할 수 있다.',
    '흉한 대운이라도 길한 세운이 오면 그해에 호전이 있을 수 있다.',
    '세운은 태세(太歲)라 하여 1년의 군주(君主)로 비유하며 그 위세가 크다.',
  ],
  cheonganJiji: {
    cheongan:
      '세운 천간(天干)은 그해의 외적 환경, 사회적 사건, 직업 변동 등에 영향한다. ' +
      '원국·대운 천간과의 합(合)·충(沖) 여부를 반드시 확인한다.',
    jiji:
      '세운 지지(地支)는 그해의 내면적 변화, 건강, 가정 환경 등에 영향한다. ' +
      '원국·대운 지지와의 합(合)·충(沖)·형(刑)·파(破)·해(害) 여부를 확인한다.',
  },
  haesekSunseo: [
    '1단계: 세운 천간이 일간에 대해 어떤 십신(十神)인지 확인한다.',
    '2단계: 세운 지지가 일간에 대해 어떤 십신인지 확인한다.',
    '3단계: 세운과 대운 천간·지지 사이의 합충형파해를 확인한다.',
    '4단계: 세운과 원국 천간·지지 사이의 합충형파해를 확인한다.',
    '5단계: 용신(用神)·기신(忌神)과의 관계를 종합하여 길흉을 판단한다.',
  ],
} as const;

// ---------------------------------------------------------------------------
// 8. 월운 (月運)
// ---------------------------------------------------------------------------

/**
 * 월운(月運) -- 매월 절기(節氣)를 기준으로 바뀌는 천간·지지.
 *
 * 월운의 천간·지지 계산:
 *   월지(月支)는 절기에 의해 고정: 寅(1월)~丑(12월)
 *   월간(月干)은 연간(年干)에 의해 결정 (년상기월법 年上起月法)
 */
export interface WolWunPillar {
  /** 서기 연도 */
  year: number;
  /** 월 번호 (1=寅月~12=丑月) */
  month: number;
  /** 월간 인덱스 */
  stem: StemIdx;
  /** 월지 인덱스 */
  branch: BranchIdx;
}

/**
 * 년상기월법(年上起月法)으로 월간(月干)을 계산한다.
 *
 * 연간(年干)에 따른 1월(寅月) 월간:
 *   甲·己년 -> 丙(2)   (甲己之年丙作首)
 *   乙·庚년 -> 戊(4)   (乙庚之年戊為頭)
 *   丙·辛년 -> 庚(6)   (丙辛之年庚為始)
 *   丁·壬년 -> 壬(8)   (丁壬之年壬為初)
 *   戊·癸년 -> 甲(0)   (戊癸之年甲爲先)
 *
 * @param yearStem  - 연간 인덱스 (0=甲 ... 9=癸)
 * @param monthNum  - 월 번호 (1=寅月 ... 12=丑月)
 * @returns 월간 인덱스
 */
export function calcWolGan(yearStem: StemIdx, monthNum: number): StemIdx {
  // 연간의 오행 그룹(0~4)에서 1월(寅月) 시작 천간 인덱스를 도출
  // 甲己(0,5)->丙(2), 乙庚(1,6)->戊(4), 丙辛(2,7)->庚(6), 丁壬(3,8)->壬(8), 戊癸(4,9)->甲(0)
  const base = (yearStem % 5) * 2 + 2;
  // monthNum 1~12 -> offset 0~11
  const offset = monthNum - 1;
  return ((base + offset) % 10 + 10) % 10;
}

/**
 * 월지(月支)를 월 번호에서 구한다.
 *
 * 1월(寅月)=2, 2월(卯月)=3, ... 11월(子月)=0, 12월(丑月)=1
 *
 * @param monthNum - 월 번호 (1=寅月 ... 12=丑月)
 * @returns 월지 인덱스
 */
export function getWolJi(monthNum: number): BranchIdx {
  return ((monthNum + 1) % 12 + 12) % 12;
}

/**
 * 특정 연도·월의 월운 간지를 반환한다.
 *
 * @param year     - 서기 연도
 * @param monthNum - 월 번호 (1=寅月 ... 12=丑月)
 */
export function getWolWun(year: number, monthNum: number): WolWunPillar {
  const yearSeWun = getSeWun(year);
  const stem = calcWolGan(yearSeWun.stem, monthNum);
  const branch = getWolJi(monthNum);
  return { year, month: monthNum, stem, branch };
}

/**
 * 특정 연도의 12개월 월운 목록을 생성한다.
 *
 * @param year - 서기 연도
 */
export function buildWolWunList(year: number): WolWunPillar[] {
  return Array.from({ length: 12 }, (_, i) => getWolWun(year, i + 1));
}

/**
 * 월운(月運) 이론 상세.
 */
export const WOLWUN_THEORY = {
  definition:
    '월운(月運)이란 매월 절기(節氣)를 기준으로 변화하는 천간·지지의 영향이다. ' +
    '세운(歲運)보다 더 세밀한 시간 단위의 운으로, 한 달간의 길흉을 판단한다.',
  significance: [
    '월운은 세운의 영향을 한 달 단위로 세분화하여 사건의 구체적 시점을 좁힌다.',
    '대운·세운이 모두 길해도 월운이 흉하면 그 달에 어려움이 생길 수 있다.',
    '특히 사업·이사·결혼 등 중요 결정의 시기를 판단하는 데 월운을 참고한다.',
  ],
  calculation:
    '월간(月干)은 년상기월법(年上起月法)에 따라 연간으로부터 도출한다. ' +
    '월지(月支)는 절기에 의해 고정된다 (1월=寅 ... 12월=丑).',
  haesekWonchik: [
    '월운 천간·지지가 일간에 대해 어떤 십신인지 확인.',
    '월운과 대운·세운 간의 합충형파해 확인.',
    '월운과 원국 간의 합충형파해 확인.',
    '용신·기신 관점에서 길흉 판단.',
  ],
} as const;

// ---------------------------------------------------------------------------
// 9. 대운·세운 상호 작용 원칙
// ---------------------------------------------------------------------------

/**
 * 대운(大運)과 세운(歲運)의 상호 작용 원칙.
 *
 * 대운과 세운은 원국(原局)과 함께 삼자(三者)가 복합적으로 작용한다.
 *
 * 1. 생부(生扶): 세운이 대운·원국을 생(生)하거나 부조(扶助)하면 길운 강화.
 * 2. 극설(剋洩): 세운이 대운·원국을 극(剋)하거나 설기(洩氣)시키면 흉운 강화.
 * 3. 합화(合化): 세운 천간이 합(合)을 이루어 새 오행으로 변화하면 운 성질 변화.
 * 4. 충형(沖刑): 세운 지지가 충(沖)·형(刑)을 이루면 변동·충격 발생.
 * 5. 천간 전반(前半) 5년 / 지지 후반(後半) 5년이 각각 주도적으로 작용.
 */
export const DAEWUN_SEWUN_INTERACTION_PRINCIPLES = [
  {
    key: 'SAENGBU',           // 생부(生扶)
    label: '생부 (生扶)',
    description: '세운이 대운·원국을 생(生)하거나 부조(扶助)하면 길운이 강화된다.',
  },
  {
    key: 'GEUKSEOL',          // 극설(剋洩)
    label: '극설 (剋洩)',
    description: '세운이 대운·원국을 극(剋)하거나 설기(洩氣)시키면 흉운이 강화된다.',
  },
  {
    key: 'HAPWA',             // 합화(合化)
    label: '합화 (合化)',
    description: '세운 천간이 합(合)을 이루어 새로운 오행으로 변화하면 운의 성질이 바뀐다.',
  },
  {
    key: 'CHUNGHYEONG',       // 충형(沖刑)
    label: '충형 (沖刑)',
    description: '세운 지지가 충(沖)·형(刑)을 이루면 변동·충격이 발생한다.',
  },
] as const;

// ---------------------------------------------------------------------------
// 10. 대운과 원국의 관계: 합·충·형·파·해의 영향
// ---------------------------------------------------------------------------

/**
 * 지지 관계(合沖刑破害) 유형.
 *
 * 대운 지지가 원국 지지와 이루는 관계 유형별 의미와 영향을 기술한다.
 */
export type JijiGwangyeType =
  | 'YUKHAP'    // 육합(六合)
  | 'SAMHAP'    // 삼합(三合)
  | 'BANGHAP'   // 방합(方合)
  | 'CHUNG'     // 충(沖, 六沖)
  | 'HYEONG'    // 형(刑, 三刑)
  | 'PA'        // 파(破)
  | 'HAE';      // 해(害, 六害)

/**
 * 대운과 원국 간의 지지 관계 영향 데이터.
 */
export interface DaewunWongukGwangye {
  type: JijiGwangyeType;
  hanja: string;
  hangul: string;
  description: string;
  gilhyung: 'GIL' | 'HYUNG' | 'GIL_HYUNG';
  daewunYeonghyang: string;
}

/**
 * 대운과 원국의 관계: 합·충·형·파·해 영향 테이블.
 *
 * 대운 지지가 원국(사주) 지지와 이루는 관계에 따른 영향을 정리한다.
 */
export const DAEWUN_WONGUK_GWANGYE_TABLE: DaewunWongukGwangye[] = [
  {
    type: 'YUKHAP',
    hanja: '六合',
    hangul: '육합',
    description:
      '대운 지지와 원국 지지가 육합(六合)을 이루는 경우. ' +
      '子丑合土, 寅亥合木, 卯戌合火, 辰酉合金, 巳申合水, 午未合土/火.',
    gilhyung: 'GIL',
    daewunYeonghyang:
      '합은 화합·결합을 뜻하므로 인연이 맺어지고 관계가 형성된다. ' +
      '합이 용신(用神) 오행으로 변하면 대길(大吉)하고, ' +
      '기신(忌神) 오행으로 변하면 겉은 좋으나 속은 해롭다. ' +
      '원국의 충을 해소하는 합이면 위기가 해결된다.',
  },
  {
    type: 'SAMHAP',
    hanja: '三合',
    hangul: '삼합',
    description:
      '대운 지지가 원국 두 지지와 삼합(三合)을 완성하는 경우. ' +
      '申子辰 水局, 寅午戌 火局, 巳酉丑 金局, 亥卯未 木局.',
    gilhyung: 'GIL_HYUNG',
    daewunYeonghyang:
      '삼합은 강력한 오행 기운의 결합이다. ' +
      '합국이 용신 오행이면 큰 발복, 기신 오행이면 큰 재앙이 된다. ' +
      '삼합이 완성되면 해당 오행의 힘이 매우 강해져 사주 전체에 영향을 미친다.',
  },
  {
    type: 'BANGHAP',
    hanja: '方合',
    hangul: '방합',
    description:
      '대운 지지가 원국 지지와 방합(方合)을 이루는 경우. ' +
      '寅卯辰 東方木局, 巳午未 南方火局, 申酉戌 西方金局, 亥子丑 北方水局.',
    gilhyung: 'GIL_HYUNG',
    daewunYeonghyang:
      '방합은 같은 방위(方位)의 계절적 결합으로 삼합보다 더 순수한 오행력을 갖는다. ' +
      '용신 방합이면 극길(極吉), 기신 방합이면 극흉(極凶)이 된다.',
  },
  {
    type: 'CHUNG',
    hanja: '六沖',
    hangul: '충',
    description:
      '대운 지지와 원국 지지가 충(沖)을 이루는 경우. ' +
      '子午沖, 丑未沖, 寅申沖, 卯酉沖, 辰戌沖, 巳亥沖.',
    gilhyung: 'HYUNG',
    daewunYeonghyang:
      '충은 파괴·분리·변동을 의미한다. ' +
      '대운이 원국의 년지(年支)를 충하면 조상·부모 관련 변동. ' +
      '월지(月支)를 충하면 직업·사업 관련 변동. ' +
      '일지(日支)를 충하면 배우자·건강 관련 변동. ' +
      '시지(時支)를 충하면 자녀·말년 관련 변동. ' +
      '다만, 기신(忌神)을 충하면 오히려 길하게 작용할 수 있다.',
  },
  {
    type: 'HYEONG',
    hanja: '三刑',
    hangul: '형',
    description:
      '대운 지지가 원국 지지와 형(刑)을 이루는 경우. ' +
      '寅巳申 무은지형(無恩之刑), 丑未戌 무례지형(無禮之刑), 子卯 무례지형.',
    gilhyung: 'HYUNG',
    daewunYeonghyang:
      '형은 형벌·구속·질병·수술을 암시한다. ' +
      '삼형(三刑)이 완성되면 관재(官災), 송사(訟事), 질병 등 큰 흉사가 발생한다. ' +
      '형은 충보다 느리게 오지만 더 깊고 지속적인 고통을 수반한다. ' +
      '용신이 형을 당하면 흉작용이 극대화된다.',
  },
  {
    type: 'PA',
    hanja: '破',
    hangul: '파',
    description:
      '대운 지지와 원국 지지가 파(破)를 이루는 경우. ' +
      '子酉破, 寅亥破, 卯午破, 辰丑破, 巳申破, 未戌破.',
    gilhyung: 'HYUNG',
    daewunYeonghyang:
      '파는 깨어짐·손상·약화를 의미한다. ' +
      '충(沖)보다 작용이 약하나 합(合)이나 귀인(貴人)의 효과를 감쇄시킨다. ' +
      '좋은 관계나 기회가 파로 인해 완성되지 못하고 무너진다.',
  },
  {
    type: 'HAE',
    hanja: '六害',
    hangul: '해',
    description:
      '대운 지지와 원국 지지가 해(害)를 이루는 경우. ' +
      '子未害, 丑午害, 寅巳害, 卯辰害, 申亥害, 酉戌害.',
    gilhyung: 'HYUNG',
    daewunYeonghyang:
      '해는 방해·저해·원한을 의미한다. ' +
      '육합(六合)을 깨뜨리는 관계이므로, 인간관계의 배신·이간질이 발생한다. ' +
      '충(沖)보다 표면적이지 않으나 내면적으로 더 깊은 상처를 준다. ' +
      '일지(日支)가 해를 당하면 부부 갈등, 건강 악화 등이 발생한다.',
  },
];

/**
 * 대운과 원국 천간의 관계 (천간합/천간충).
 */
export const DAEWUN_WONGUK_CHEONGAN_GWANGYE = {
  cheonganHap: {
    label: '천간합 (天干合)',
    description:
      '대운 천간이 원국 천간과 합(合)을 이루는 경우. ' +
      '甲己合土, 乙庚合金, 丙辛合水, 丁壬合木, 戊癸合火. ' +
      '합이 되면 본래의 오행 성질이 변하여 새로운 오행으로 화(化)할 수 있다.',
    effect:
      '합화(合化)가 이루어지면 원국의 오행 균형이 크게 변한다. ' +
      '용신이 합으로 묶이면(合去, 합거) 용신의 기능이 상실되어 흉하다. ' +
      '기신이 합으로 묶이면 기신의 폐해가 줄어 길하다. ' +
      '화(化)한 오행이 용신이면 대길, 기신이면 대흉이다.',
  },
  cheonganChung: {
    label: '천간충 (天干沖)',
    description:
      '대운 천간이 원국 천간과 충(沖)을 이루는 경우. ' +
      '甲庚沖, 乙辛沖, 丙壬沖, 丁癸沖. ' +
      '같은 오행의 양간끼리 또는 음간끼리 극을 이루는 관계.',
    effect:
      '천간 충은 직접적인 갈등·대립·충돌을 의미한다. ' +
      '일간이 충을 당하면 신체적·정신적 스트레스가 크다. ' +
      '용신 천간이 충을 당하면 운의 흐름이 크게 꺾인다. ' +
      '기신 천간이 충을 당하면 오히려 기신이 약화되어 길할 수 있다.',
  },
} as const;

// ---------------------------------------------------------------------------
// 11. 대운의 십신(十神) 분석
// ---------------------------------------------------------------------------

/**
 * 십신(十神) 타입.
 *
 * 일간을 기준으로 대운 천간·지지의 오행 관계를 십신으로 분류한다.
 *
 * 비겁(比劫): BIGYEON(비견), GEOBJE(겁재)
 * 식상(食傷): SIKSHIN(식신), SANGGWAN(상관)
 * 재성(財星): PYEONJAE(편재), JEONGJAE(정재)
 * 관성(官星): PYEONGWAN(편관), JEONGGWAN(정관)
 * 인성(印星): PYEONIN(편인), JEONGIN(정인)
 */
export type DaewunSipsin =
  | 'BIGYEON' | 'GEOBJE'
  | 'SIKSHIN' | 'SANGGWAN'
  | 'PYEONJAE' | 'JEONGJAE'
  | 'PYEONGWAN' | 'JEONGGWAN'
  | 'PYEONIN' | 'JEONGIN';

/** 천간 오행 배열 (인덱스 0~9): 木=0, 火=1, 土=2, 金=3, 水=4 */
const STEM_OHHAENG = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4] as const;
//                    甲 乙 丙 丁 戊 己 庚 辛 壬 癸

/**
 * 일간과 다른 천간의 십신 관계를 계산한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ... 9=癸)
 * @param stemIdx  - 비교할 천간 인덱스
 * @returns 십신 타입
 *
 * @example
 * getDaewunSipsin(0, 0)  // 甲일간 vs 甲 -> BIGYEON (비견)
 * getDaewunSipsin(0, 6)  // 甲일간 vs 庚 -> PYEONGWAN (편관)
 * getDaewunSipsin(0, 9)  // 甲일간 vs 癸 -> JEONGIN (정인)
 */
export function getDaewunSipsin(ilganIdx: StemIdx, stemIdx: StemIdx): DaewunSipsin {
  const ilOh = STEM_OHHAENG[((ilganIdx % 10) + 10) % 10];
  const stOh = STEM_OHHAENG[((stemIdx % 10) + 10) % 10];
  const sameEy = (ilganIdx % 2) === (stemIdx % 2);

  // 비겁: 같은 오행
  if (stOh === ilOh) {
    return sameEy ? 'BIGYEON' : 'GEOBJE';
  }
  // 식상: 일간이 생하는 오행 (생 순서: 木->火->土->金->水->木)
  if (stOh === (ilOh + 1) % 5) {
    return sameEy ? 'SIKSHIN' : 'SANGGWAN';
  }
  // 재성: 일간이 극하는 오행 (극 순서: 木->土, 火->金, 土->水, 金->木, 水->火)
  if (stOh === (ilOh + 2) % 5) {
    return sameEy ? 'PYEONJAE' : 'JEONGJAE';
  }
  // 관성: 일간을 극하는 오행
  if (stOh === (ilOh + 3) % 5) {
    return sameEy ? 'PYEONGWAN' : 'JEONGGWAN';
  }
  // 인성: 일간을 생하는 오행
  return sameEy ? 'PYEONIN' : 'JEONGIN';
}

/** 지지 본기(本氣) 천간 인덱스 (지지 인덱스 0~11 -> 본기 천간 인덱스) */
const BRANCH_BONGI_STEM = [
  9, // 子: 癸
  5, // 丑: 己
  0, // 寅: 甲
  1, // 卯: 乙
  4, // 辰: 戊
  2, // 巳: 丙
  3, // 午: 丁
  5, // 未: 己
  6, // 申: 庚
  7, // 酉: 辛
  4, // 戌: 戊
  8, // 亥: 壬
] as const;

/**
 * 대운 지지의 본기(本氣)가 일간에 대해 어떤 십신인지 반환한다.
 *
 * @param ilganIdx  - 일간 인덱스
 * @param branchIdx - 대운 지지 인덱스
 * @returns 대운 지지 본기의 십신
 */
export function getDaewunBranchSipsin(ilganIdx: StemIdx, branchIdx: BranchIdx): DaewunSipsin {
  const b = ((branchIdx % 12) + 12) % 12;
  const bongiStem = BRANCH_BONGI_STEM[b];
  return getDaewunSipsin(ilganIdx, bongiStem);
}

/**
 * 대운 천간·지지의 십신 분석 결과.
 */
export interface DaewunSipsinBunseok {
  /** 대운 천간이 일간에 대해 어떤 십신인지 */
  stemSipsin: DaewunSipsin;
  /** 대운 지지 본기가 일간에 대해 어떤 십신인지 */
  branchSipsin: DaewunSipsin;
  /** 십신 분류 (비겁/식상/재성/관성/인성) */
  stemCategory: SipsinCategory;
  /** 지지 본기 십신 분류 */
  branchCategory: SipsinCategory;
}

/** 십신 대분류 */
export type SipsinCategory =
  | 'BIGEOP'    // 비겁(比劫)
  | 'SIKSANG'   // 식상(食傷)
  | 'JAESEONG'  // 재성(財星)
  | 'GWANSEONG' // 관성(官星)
  | 'INSEONG';  // 인성(印星)

/**
 * 십신을 대분류로 환산한다.
 */
export function sipsinToCategory(sipsin: DaewunSipsin): SipsinCategory {
  switch (sipsin) {
    case 'BIGYEON': case 'GEOBJE': return 'BIGEOP';
    case 'SIKSHIN': case 'SANGGWAN': return 'SIKSANG';
    case 'PYEONJAE': case 'JEONGJAE': return 'JAESEONG';
    case 'PYEONGWAN': case 'JEONGGWAN': return 'GWANSEONG';
    case 'PYEONIN': case 'JEONGIN': return 'INSEONG';
  }
}

/**
 * 대운 간지의 십신을 분석한다.
 *
 * @param ilganIdx    - 일간 인덱스
 * @param daewunStem  - 대운 천간 인덱스
 * @param daewunBranch - 대운 지지 인덱스
 */
export function analyzeDaewunSipsin(
  ilganIdx: StemIdx,
  daewunStem: StemIdx,
  daewunBranch: BranchIdx,
): DaewunSipsinBunseok {
  const stemSipsin = getDaewunSipsin(ilganIdx, daewunStem);
  const branchSipsin = getDaewunBranchSipsin(ilganIdx, daewunBranch);
  return {
    stemSipsin,
    branchSipsin,
    stemCategory: sipsinToCategory(stemSipsin),
    branchCategory: sipsinToCategory(branchSipsin),
  };
}

/**
 * 대운 십신별 의미와 해석 원칙.
 */
export const DAEWUN_SIPSIN_HAESEK = {
  BIGEOP: {
    label: '비겁운 (比劫運)',
    hangul: '비겁',
    description:
      '비견·겁재 대운. 일간과 같은 오행의 운이 오는 시기.',
    gilhyungWonchik:
      '신약(身弱)한 사주에게는 길운: 일간의 힘이 보강되어 자신감, 독립, 동업 성공. ' +
      '신강(身强)한 사주에게는 흉운: 경쟁·다툼·재물 손실(군겁쟁재). ' +
      '겁재운은 비견운보다 변동성이 크고, 재물 손실과 인간관계 갈등이 더 심하다.',
  },
  SIKSANG: {
    label: '식상운 (食傷運)',
    hangul: '식상',
    description:
      '식신·상관 대운. 일간이 생(生)하는 오행의 운이 오는 시기.',
    gilhyungWonchik:
      '신강한 사주에게는 길운: 재능 발휘, 창작, 사업 확장, 자녀 관련 경사. ' +
      '신약한 사주에게는 흉운: 기운이 설기(洩氣)되어 체력 저하, 과로, 건강 악화. ' +
      '식신운은 안정적 수입과 풍요, 상관운은 창의적이나 관재·구설의 위험이 있다.',
  },
  JAESEONG: {
    label: '재성운 (財星運)',
    hangul: '재성',
    description:
      '편재·정재 대운. 일간이 극(克)하는 오행의 운이 오는 시기.',
    gilhyungWonchik:
      '신강한 사주에게는 길운: 재물운 상승, 사업 성공, 배우자 인연. ' +
      '신약한 사주에게는 흉운: 재다신약(財多身弱)으로 감당하지 못해 오히려 재물 손실. ' +
      '편재운은 투자·사업·횡재, 정재운은 봉급·저축·안정적 수입과 관련된다.',
  },
  GWANSEONG: {
    label: '관성운 (官星運)',
    hangul: '관성',
    description:
      '편관·정관 대운. 일간을 극(克)하는 오행의 운이 오는 시기.',
    gilhyungWonchik:
      '신강한 사주에게는 길운: 승진, 관직, 명예, 사회적 인정. ' +
      '신약한 사주에게는 흉운: 압박, 구속, 관재(官災), 건강 악화. ' +
      '정관운은 안정적 승진과 명예, 편관운은 권력 획득이나 시련·역경을 동반한다.',
  },
  INSEONG: {
    label: '인성운 (印星運)',
    hangul: '인성',
    description:
      '편인·정인 대운. 일간을 생(生)하는 오행의 운이 오는 시기.',
    gilhyungWonchik:
      '신약한 사주에게는 길운: 학업 성취, 자격 취득, 부모 도움, 귀인의 도움. ' +
      '신강한 사주에게는 흉운: 인다신강(印多身强)으로 게으름, 의존, 우유부단. ' +
      '정인운은 학문·교육·문서 관련 길사, 편인운은 독창적 재능이나 도식(倒食) 위험이 있다.',
  },
} as const;

// ---------------------------------------------------------------------------
// 12. 교운기 (交運期)
// ---------------------------------------------------------------------------

/**
 * 교운기(交運期) -- 대운이 바뀌는 시기의 특수성.
 *
 * 대운은 10년마다 바뀌며, 전후 약 1~2년간은 이전 대운과 새 대운이
 * 교차하는 전환기로서 특수한 의미를 갖는다.
 */
export const GYOWUNGI_THEORY = {
  definition:
    '교운기(交運期)란 대운이 바뀌는 전후 약 1~2년의 전환 시기를 말한다. ' +
    '이전 대운의 영향이 서서히 사라지고 새 대운의 영향이 서서히 나타나는 과도기이다.',
  teukcheong: [
    '교운기에는 삶의 큰 변화가 집중적으로 나타나는 경우가 많다.',
    '이직, 이사, 결혼, 이혼, 건강 변화 등 중대 사건이 교운기에 발생하기 쉽다.',
    '이전 대운과 새 대운의 성격이 크게 다를수록 변화의 폭이 크다.',
    '교운기에는 방향을 잡지 못하고 혼란을 느끼는 경우가 있다.',
  ],
  gigan: {
    label: '교운기 기간',
    description:
      '학파에 따라 교운기의 범위가 다르다. ' +
      '일반적으로 대운 교체 시점 전후 1년(총 2년)을 교운기로 본다. ' +
      '일부 학파는 전후 6개월만 인정하기도 하고, 전후 2년을 보기도 한다.',
  },
  haesekWonchik: [
    '이전 대운의 천간·지지 영향이 점차 약해진다.',
    '새 대운의 천간·지지 영향이 점차 강해진다.',
    '이전 대운과 새 대운의 십신(十神)이 정반대(예: 인성->재성)이면 변동이 극심하다.',
    '이전 대운과 새 대운의 지지가 충(沖)이면 급격한 환경 변화가 발생한다.',
    '교운기에 세운(歲運)까지 흉하면 각별한 주의가 필요하다.',
  ],
  juui: [
    '교운기에는 중대한 결정(사업 시작, 부동산 투자 등)을 삼가는 것이 좋다.',
    '교운기가 지나고 새 대운의 성격이 명확해진 후 결정하는 것이 안전하다.',
    '교운기에 발생한 사건은 이전 대운의 결산이자 새 대운의 서막으로 해석한다.',
  ],
} as const;

/**
 * 특정 나이가 교운기(대운 전환 전후)에 해당하는지 판단한다.
 *
 * @param age            - 판단할 나이 (세)
 * @param daewunStartAge - 첫 대운 시작 나이
 * @param range          - 교운기 전후 범위 (기본 1년)
 * @returns 교운기 여부
 */
export function isGyowungi(
  age: number,
  daewunStartAge: number,
  range = 1,
): boolean {
  // 대운은 startAge, startAge+10, startAge+20, ... 에서 바뀐다.
  // 첫 대운 시작도 교운기에 해당
  if (age < daewunStartAge) return false;
  const yearsInDaewun = age - daewunStartAge;
  const positionInDecade = yearsInDaewun % 10;
  // 대운 시작 직후(0~range) 또는 대운 종료 직전(10-range ~ 9)
  return positionInDecade < range || positionInDecade >= (10 - range);
}

// ---------------------------------------------------------------------------
// 13. 운의 길흉 판단: 용신운·기신운·희신운
// ---------------------------------------------------------------------------

/**
 * 운의 길흉 유형.
 *
 * YONGSINWUN : 용신운(用神運) -- 용신 오행이 오는 운. 발복(發福)의 시기.
 * HEESINWUN  : 희신운(喜神運) -- 희신 오행이 오는 운. 용신을 돕는 길운.
 * GISINWUN   : 기신운(忌神運) -- 기신 오행이 오는 운. 용신을 해치는 흉운.
 * GUSINWUN   : 구신운(仇神運) -- 구신 오행이 오는 운. 희신을 해치는 흉운.
 * HANSINWUN  : 한신운(閑神運) -- 한신 오행이 오는 운. 길흉이 약한 중립운.
 */
export type UnGilhyungType =
  | 'YONGSINWUN'
  | 'HEESINWUN'
  | 'GISINWUN'
  | 'GUSINWUN'
  | 'HANSINWUN';

/**
 * 운의 길흉 판단 결과.
 */
export interface UnGilhyungResult {
  type: UnGilhyungType;
  label: string;
  gilhyung: 'GIL' | 'HYUNG' | 'JUNGNIP';
  description: string;
}

/**
 * 운의 길흉 판단 원칙 (용신/기신/희신/구신/한신 관점).
 */
export const UN_GILHYUNG_WONCHIK = {
  yongsinwun: {
    type: 'YONGSINWUN' as UnGilhyungType,
    label: '용신운 (用神運)',
    gilhyung: 'GIL' as const,
    description:
      '용신(用神) 오행이 대운에 오는 시기. 사주의 핵심 균형을 바로잡아 ' +
      '발복(發福)하는 가장 좋은 운이다. ' +
      '직업적 성공, 재물 획득, 명예 상승, 건강 회복 등 전반적 길사가 발생한다.',
    sangseHaesek: [
      '용신이 천간에 투출(透出)하여 오면 효과가 빠르고 강하다.',
      '용신이 지지에 숨어(藏干) 있으면 효과가 천천히 나타나지만 지속적이다.',
      '용신운이라도 합(合)으로 묶이거나 충(沖)으로 파괴되면 효과가 감소한다.',
      '용신운에 세운까지 길하면 그해가 인생 최고의 해가 될 수 있다.',
    ],
  },
  heesinwun: {
    type: 'HEESINWUN' as UnGilhyungType,
    label: '희신운 (喜神運)',
    gilhyung: 'GIL' as const,
    description:
      '희신(喜神) 오행이 대운에 오는 시기. 용신을 생(生)하거나 돕는 운으로, ' +
      '용신운 다음으로 좋은 운이다. ' +
      '용신의 기능을 강화하여 간접적으로 길사가 발생한다.',
    sangseHaesek: [
      '희신운은 용신이 활동할 기반을 마련해 주는 역할을 한다.',
      '용신이 약할 때 희신운이 오면 용신을 살려내어 발복의 계기가 된다.',
      '희신운과 용신운이 연속으로 오면 장기적 성공의 시기이다.',
    ],
  },
  gisinwun: {
    type: 'GISINWUN' as UnGilhyungType,
    label: '기신운 (忌神運)',
    gilhyung: 'HYUNG' as const,
    description:
      '기신(忌神) 오행이 대운에 오는 시기. 용신을 극(克)하거나 억제하여 ' +
      '운이 나빠지는 흉운이다. ' +
      '직업 불안, 재물 손실, 건강 악화, 인간관계 갈등 등이 발생한다.',
    sangseHaesek: [
      '기신이 천간에 투출하여 오면 흉작용이 빠르고 강하게 나타난다.',
      '기신이 지지에 있으면 내면적 고통, 만성 질환, 지속적 불안이 발생한다.',
      '기신운이라도 세운에서 용신이 오면 그해는 다소 호전된다.',
      '기신운이 10년간 지속되면 인내와 자기 관리가 중요하다.',
    ],
  },
  gusinwun: {
    type: 'GUSINWUN' as UnGilhyungType,
    label: '구신운 (仇神運)',
    gilhyung: 'HYUNG' as const,
    description:
      '구신(仇神) 오행이 대운에 오는 시기. 희신을 극(克)하여 간접적으로 ' +
      '용신의 기반을 무너뜨리는 흉운이다. ' +
      '기신운보다 직접적 피해는 적으나 점진적으로 운이 약화된다.',
    sangseHaesek: [
      '구신운은 기신운보다 체감이 덜하지만 장기적으로 불리하다.',
      '희신이 약해지면서 용신까지 힘을 잃게 되는 연쇄 효과가 발생한다.',
      '구신운에는 새로운 인간관계나 사업을 시작하지 않는 것이 좋다.',
    ],
  },
  hansinwun: {
    type: 'HANSINWUN' as UnGilhyungType,
    label: '한신운 (閑神運)',
    gilhyung: 'JUNGNIP' as const,
    description:
      '한신(閑神) 오행이 대운에 오는 시기. 길흉 어느 쪽에도 크게 치우치지 않는 ' +
      '중립적인 운이다. ' +
      '무난하게 흘러가지만 큰 발전이나 큰 위기도 없는 평온한 시기.',
    sangseHaesek: [
      '한신운에는 현상 유지에 집중하고 내실을 다지는 것이 좋다.',
      '세운에 따라 길흉이 결정되므로, 세운 분석이 더 중요해진다.',
      '한신이 통관(通關) 역할을 하는 경우에는 오히려 길하게 작용할 수 있다.',
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// 14. 대운 흐름 해석 원칙 (전체적 운의 흐름 판단)
// ---------------------------------------------------------------------------

/**
 * 대운 흐름(流) 해석의 종합 원칙.
 *
 * 대운은 단순히 한 대운씩 개별적으로 보는 것이 아니라,
 * 전체적인 흐름 속에서 연속성·전환점·패턴을 읽어야 한다.
 */
export const DAEWUN_HEUREUM_WONCHIK = {
  /** 대운 흐름 해석의 기본 원칙 */
  gibon: [
    '대운은 연속된 흐름이므로 개별 대운만이 아닌 전후 대운의 연결성을 본다.',
    '오행이 순환하는 흐름(木->火->土->金->水)인지, 오행이 역행하는 흐름인지를 파악한다.',
    '같은 오행이 연속되면 해당 오행의 영향이 20~30년간 지속되어 인생의 기조가 된다.',
    '오행이 급변(예: 金운에서 바로 木운)하면 삶의 방향이 크게 바뀌는 전환점이 된다.',
  ],
  /** 상승운과 하강운의 판단 */
  sangseungHagang: {
    sangseung:
      '용신운·희신운이 연속되거나, 기신운에서 용신운으로 전환되는 흐름은 상승운이다. ' +
      '상승운 시기에는 적극적 도전과 확장이 유리하다.',
    hagang:
      '기신운·구신운이 연속되거나, 용신운에서 기신운으로 전환되는 흐름은 하강운이다. ' +
      '하강운 시기에는 수성(守成)과 축소가 안전하다.',
    pyeongyun:
      '한신운이 계속되거나, 길흉이 교차하는 흐름은 평운(平運)이다. ' +
      '평운에서는 세운(歲運)의 영향이 상대적으로 더 크게 작용한다.',
  },
  /** 인생 4기(期) 분석법 */
  insaengSagi: [
    '초년운(初年運, 1~30세 전후): 성장기. 학업·진로의 방향이 결정되는 시기.',
    '청장년운(靑壯年運, 30~50세 전후): 활동기. 직업·결혼·사업의 핵심 시기.',
    '중년운(中年運, 50~70세 전후): 안정기. 사회적 지위의 정점과 건강 관리 시기.',
    '노년운(老年運, 70세 이후): 수확기. 일생의 결실을 거두고 건강을 유지하는 시기.',
  ],
  /** 대운 전환의 신호 */
  jeonhwanSinho: [
    '교운기(交運期)에 세운이 새 대운과 같은 오행이면 전환이 빠르고 강하다.',
    '교운기에 세운이 새 대운과 충(沖)이면 전환 과정에서 큰 충격이 발생한다.',
    '이전 대운의 천간과 새 대운의 천간이 합(合)이면 과거와 미래가 연결되는 매끄러운 전환.',
    '이전 대운의 지지와 새 대운의 지지가 충(沖)이면 환경이 급변하는 격렬한 전환.',
  ],
  /** 대운과 원국의 종합 판단 원칙 */
  jonghapPandanWonchik: [
    '원국(原局)이 좋으면(격국 성립, 용신 유력) 흉운에도 기본 복이 있어 큰 재앙은 면한다.',
    '원국이 나쁘면(격국 파격, 용신 무력) 길운에도 완전한 발복이 어렵다.',
    '대운이 좋으면 10년간 전반적으로 순조롭고, 세운이 흉해도 충격이 완화된다.',
    '대운이 나쁘면 10년간 전반적으로 불리하고, 세운이 길해도 효과가 제한적이다.',
    '원국 + 대운 + 세운 삼자의 종합이 최종 길흉을 결정한다.',
    '어떤 한 요소만으로 길흉을 단정하지 않는다.',
  ],
} as const;

// ---------------------------------------------------------------------------
// 15. 통합 대운 계산 결과
// ---------------------------------------------------------------------------

/** 대운 계산의 전체 결과. */
export interface DaewunResult {
  direction: DaewunDirection;
  startAge: number;
  soWunList: SoWunPillar[];
  daewunList: DaewunPillar[];
}

/**
 * 출생 정보로부터 대운 전체 결과를 계산한다.
 *
 * @param birthStemIdx - 연간(年干) 천간 인덱스
 * @param gender       - 성별
 * @param monthStem    - 월간 인덱스
 * @param monthBranch  - 월지 인덱스
 * @param daysToJeolgi - 생일~관련 절기 날수
 * @param daewunCount  - 생성할 대운 개수 (기본 8)
 */
export function calcDaewunResult(
  birthStemIdx: StemIdx,
  gender: Gender,
  monthStem: StemIdx,
  monthBranch: BranchIdx,
  daysToJeolgi: number,
  daewunCount = 8,
): DaewunResult {
  const direction = getDaewunDirection(birthStemIdx, gender);
  const startAge = calcDaewunStartAge(daysToJeolgi);
  const soWunList = buildSoWunList(monthStem, monthBranch, direction, startAge);
  const daewunList = buildDaewunList(
    monthStem,
    monthBranch,
    direction,
    startAge,
    daewunCount,
  );
  return { direction, startAge, soWunList, daewunList };
}

// ---------------------------------------------------------------------------
// 16. 대운 십신 분석이 포함된 확장 결과
// ---------------------------------------------------------------------------

/** 십신 분석이 포함된 대운 주. */
export interface DaewunPillarWithSipsin extends DaewunPillar {
  /** 대운 천간이 일간에 대해 어떤 십신인지 */
  stemSipsin: DaewunSipsin;
  /** 대운 지지 본기가 일간에 대해 어떤 십신인지 */
  branchSipsin: DaewunSipsin;
  /** 십신 대분류 (천간) */
  stemCategory: SipsinCategory;
  /** 십신 대분류 (지지) */
  branchCategory: SipsinCategory;
}

/** 확장된 대운 계산 결과 (십신 분석 포함). */
export interface DaewunResultWithSipsin extends DaewunResult {
  /** 일간 인덱스 (분석 기준) */
  ilganIdx: StemIdx;
  /** 십신 분석이 포함된 대운 목록 */
  daewunListWithSipsin: DaewunPillarWithSipsin[];
}

/**
 * 출생 정보로부터 대운 결과를 계산하고, 십신 분석을 포함한 확장 결과를 반환한다.
 *
 * @param birthStemIdx - 연간(年干) 천간 인덱스 (대운 방향 결정용)
 * @param gender       - 성별
 * @param ilganIdx     - 일간(日干) 천간 인덱스 (십신 분석 기준)
 * @param monthStem    - 월간 인덱스
 * @param monthBranch  - 월지 인덱스
 * @param daysToJeolgi - 생일~관련 절기 날수
 * @param daewunCount  - 생성할 대운 개수 (기본 8)
 */
export function calcDaewunResultWithSipsin(
  birthStemIdx: StemIdx,
  gender: Gender,
  ilganIdx: StemIdx,
  monthStem: StemIdx,
  monthBranch: BranchIdx,
  daysToJeolgi: number,
  daewunCount = 8,
): DaewunResultWithSipsin {
  const base = calcDaewunResult(
    birthStemIdx,
    gender,
    monthStem,
    monthBranch,
    daysToJeolgi,
    daewunCount,
  );

  const daewunListWithSipsin: DaewunPillarWithSipsin[] = base.daewunList.map((pillar) => {
    const analysis = analyzeDaewunSipsin(ilganIdx, pillar.stem, pillar.branch);
    return { ...pillar, ...analysis };
  });

  return {
    ...base,
    ilganIdx,
    daewunListWithSipsin,
  };
}

// ---------------------------------------------------------------------------
// 17. 대운 내 현재 반기(半期) 판별
// ---------------------------------------------------------------------------

/**
 * 특정 나이가 대운 전반 5년(천간 위주)인지 후반 5년(지지 위주)인지 판별한다.
 *
 * @param age            - 현재 나이 (세)
 * @param daewunStartAge - 해당 대운의 시작 나이
 * @returns 'JEONBAN' | 'HUBAN'
 */
export function getDaewunHalfPeriod(
  age: number,
  daewunStartAge: number,
): 'JEONBAN' | 'HUBAN' {
  const offset = age - daewunStartAge;
  return offset < 5 ? 'JEONBAN' : 'HUBAN';
}

/**
 * 특정 나이에 해당하는 대운 주를 찾아 반환한다.
 *
 * @param age        - 현재 나이 (세)
 * @param daewunList - 대운 목록
 * @returns 해당 대운 또는 undefined (대운 시작 전이면)
 */
export function findDaewunAtAge(
  age: number,
  daewunList: DaewunPillar[],
): DaewunPillar | undefined {
  return daewunList.find((d) => age >= d.startAge && age <= d.endAge);
}
