/**
 * 십이운성론(十二運星論) 이론 모듈
 *
 * 장생(長生)에서 양(養)까지 12단계로 천간(天干)의 기운이
 * 지지(地支)에서 어떤 생명 단계에 있는지를 나타내는 이론이다.
 *
 * 출전: 자평진전(子平眞詮), 적천수(滴天髓), 명리정종(命理正宗)
 *
 * 양순음역(陽順陰逆) 원칙:
 *   - 양간(陽干): 장생지에서 순행(順行) — 지지 순서대로 진행
 *   - 음간(陰干): 장생지에서 역행(逆行) — 지지 역순으로 진행
 *
 * 지지 인덱스 (BranchIdx):
 *   子=0, 丑=1, 寅=2, 卯=3, 辰=4, 巳=5, 午=6, 未=7, 申=8, 酉=9, 戌=10, 亥=11
 *
 * 천간 인덱스 (StemIdx):
 *   甲=0, 乙=1, 丙=2, 丁=3, 戊=4, 己=5, 庚=6, 辛=7, 壬=8, 癸=9
 */

import type { StemIdx, BranchIdx } from '../core/cycle.js';
import type { LifeStage } from '../core/lifeStage.js';

export type { LifeStage };

// ---------------------------------------------------------------------------
// 십이운성 순서 상수
// ---------------------------------------------------------------------------

/**
 * 십이운성(十二運星) 순서 배열
 *
 * 0=장생(長生) → 1=목욕(沐浴) → 2=관대(冠帶) → 3=건록(建祿) →
 * 4=제왕(帝旺) → 5=쇠(衰)    → 6=병(病)     → 7=사(死)    →
 * 8=묘(墓)    → 9=절(絶)    → 10=태(胎)    → 11=양(養)
 *
 * 양간(陽干)은 이 순서대로 순행(順行),
 * 음간(陰干)은 이 순서대로이되 지지를 역방향으로 순환한다.
 */
export const SIPIUNSEONG_ORDER: readonly LifeStage[] = [
  'JANG_SAENG', // 0: 長生 (장생)
  'MOK_YOK',    // 1: 沐浴 (목욕)
  'GWAN_DAE',   // 2: 冠帶 (관대)
  'GEON_ROK',   // 3: 建祿 (건록)
  'JE_WANG',    // 4: 帝旺 (제왕)
  'SWOE',       // 5: 衰   (쇠)
  'BYEONG',     // 6: 病   (병)
  'SA',         // 7: 死   (사)
  'MYO',        // 8: 墓   (묘)
  'JEOL',       // 9: 絶   (절)
  'TAE',        // 10: 胎  (태)
  'YANG',       // 11: 養  (양)
] as const;

// ---------------------------------------------------------------------------
// 십이운성 상세 데이터 인터페이스
// ---------------------------------------------------------------------------

/**
 * 십이운성(十二運星) 각 단계의 상세 이론 데이터
 *
 * 자평진전(子平眞詮)·적천수(滴天髓)·명리정종(命理正宗) 기반으로
 * 각 운성의 강도·의미·성질을 체계화한 구조체이다.
 */
export interface SipiunseongData {
  /** 십이운성 식별자 (LifeStage) */
  stage: LifeStage;
  /** 한자 표기 — 예: 長生 */
  hanja: string;
  /** 한글 표기 — 예: 장생 */
  hangul: string;
  /** 순서 인덱스 (0=장생 ... 11=양) */
  index: number;
  /**
   * 강도(强度) 점수
   *
   * 0–20 범위. 제왕(帝旺)이 20으로 최고이며,
   * 절(絶)이 2로 최저이다. 통근(通根) 계산의 가중치로 활용된다.
   */
  strength: number;
  /** 단계의 의미 설명 (한글) */
  description: string;
  /** 인생 비유 — 생명 주기에 빗댄 표현 */
  metaphor: string;
  /**
   * 성질 분류 (왕상휴수사)
   *
   * - '왕(旺)': 기운이 왕성한 상태
   * - '상(相)': 기운이 상승 중인 상태
   * - '휴(休)': 기운이 쉬는 상태
   * - '수(囚)': 기운이 갇힌 상태
   * - '사(死)': 기운이 가장 약한 상태
   */
  nature: string;
  /**
   * 통근(通根) 가능 여부
   *
   * 일간(日干)이 해당 운성의 지지에 뿌리를 내릴 수 있는지를 나타낸다.
   * 건록·제왕이 최강, 절·태는 통근 불가.
   */
  isUsable: boolean;
}

// ---------------------------------------------------------------------------
// 십이운성 상세 테이블
// ---------------------------------------------------------------------------

/**
 * 십이운성(十二運星) 상세 이론 데이터 테이블
 *
 * 자평진전(子平眞詮) 기반 강도 체계:
 *   제왕(20) > 건록(18) > 장생·관대·쇠(12) > 목욕·병(10) > 묘·사·양(8) > 태(4) > 절(2)
 *
 * 통근 가능 여부:
 *   가능: 장생·관대·건록·제왕·쇠·묘
 *   불가 또는 약통근: 목욕·병·사·절·태·양
 */
export const SIPIUNSEONG_TABLE: SipiunseongData[] = [
  {
    stage:       'JANG_SAENG',
    hanja:       '長生',
    hangul:      '장생',
    index:       0,
    strength:    12,
    description: '생명이 처음 세상에 나타나는 단계. 순수하고 희망에 찬 기운으로 새로운 시작을 알린다. 타고난 자질이 빛나며 귀인(貴人)의 도움을 받기 쉽다.',
    metaphor:    '갓 태어난 아이 — 탄생의 순간, 세상에 첫발을 내딛다',
    nature:      '상(相)',
    isUsable:    true,
  },
  {
    stage:       'MOK_YOK',
    hanja:       '沐浴',
    hangul:      '목욕',
    index:       1,
    strength:    10,
    description: '갓난아이가 목욕하듯 외부 세계와 접촉하기 시작하는 단계. 감수성이 예민하고 방종(放縱)하기 쉬우며, 도화(桃花)·풍류(風流)·색정(色情)의 기운이 강하다. 기복이 심하다.',
    metaphor:    '어린 시절 — 불안정한 성장기, 욕망과 유혹이 넘치다',
    nature:      '휴(休)',
    isUsable:    false,
  },
  {
    stage:       'GWAN_DAE',
    hanja:       '冠帶',
    hangul:      '관대',
    index:       2,
    strength:    12,
    description: '성인식을 치르고 갓을 쓰는 단계. 학업·수련이 완성되어 사회에 진출할 준비가 된 상태이다. 총명하고 예의 바르며 문서·학문과 인연이 깊다.',
    metaphor:    '성년식 — 갓과 예복을 갖추어 입고 사회에 나설 준비를 마치다',
    nature:      '상(相)',
    isUsable:    true,
  },
  {
    stage:       'GEON_ROK',
    hanja:       '建祿',
    hangul:      '건록',
    index:       3,
    strength:    18,
    description: '관직(官職)에 나아가 녹봉(祿俸)을 받는 단계. 기운이 왕성하여 독립적이고 자수성가(自手成家)하는 성향이 강하다. 재물과 명예를 직접 쟁취한다.',
    metaphor:    '취업과 독립 — 관직에 나아가 스스로 녹봉을 벌다',
    nature:      '왕(旺)',
    isUsable:    true,
  },
  {
    stage:       'JE_WANG',
    hanja:       '帝旺',
    hangul:      '제왕',
    index:       4,
    strength:    20,
    description: '제왕(帝王)처럼 기운이 극도로 왕성한 단계. 십이운성 중 가장 강한 기운이다. 카리스마와 지도력이 뛰어나나 지나치게 강하면 오히려 파격(破格)이 될 수 있다.',
    metaphor:    '전성기 — 제왕의 자리에서 천하를 호령하다',
    nature:      '왕(旺)',
    isUsable:    true,
  },
  {
    stage:       'SWOE',
    hanja:       '衰',
    hangul:      '쇠',
    index:       5,
    strength:    12,
    description: '전성기가 지나 서서히 하강하기 시작하는 단계. 기운은 아직 충분하나 퇴보의 방향으로 돌아선다. 경험과 지혜가 축적되어 있어 내실이 충실하다.',
    metaphor:    '장년기 — 정점을 지나 원숙함 속에서 내려오기 시작하다',
    nature:      '수(囚)',
    isUsable:    true,
  },
  {
    stage:       'BYEONG',
    hanja:       '病',
    hangul:      '병',
    index:       6,
    strength:    10,
    description: '기운이 쇠약해져 병이 드는 단계. 건강·활력이 저하되고 의타심(依他心)이 강해진다. 정신적으로는 오히려 섬세하고 예민한 감수성을 지닌다.',
    metaphor:    '노년 초기 — 병이 들어 서서히 기력을 잃다',
    nature:      '수(囚)',
    isUsable:    false,
  },
  {
    stage:       'SA',
    hanja:       '死',
    hangul:      '사',
    index:       7,
    strength:    8,
    description: '기운이 다하여 죽음에 이르는 단계. 이 세상의 끝이자 새로운 시작으로 넘어가는 전환점이다. 강한 집착이나 고집스러운 면이 있을 수 있다.',
    metaphor:    '임종 — 한 생이 끝나고 다음 생으로 넘어가는 경계에 서다',
    nature:      '사(死)',
    isUsable:    false,
  },
  {
    stage:       'MYO',
    hanja:       '墓',
    hangul:      '묘',
    index:       8,
    strength:    8,
    description: '죽은 후 묘(墓)·창고(倉庫)에 들어가는 단계. 지지(地支)에 갇혀 기운이 잠재되어 있다. 내향적이며 저장·축적 능력이 뛰어나지만 기운이 드러나지 않는다. 辰·戌·丑·未의 고(庫)에 해당한다.',
    metaphor:    '매장 — 창고에 갇혀 쉬는 기운, 잠재력이 응축되다',
    nature:      '사(死)',
    isUsable:    true,
  },
  {
    stage:       'JEOL',
    hanja:       '絶',
    hangul:      '절',
    index:       9,
    strength:    2,
    description: '기운이 완전히 끊겨 소멸하는 단계. 십이운성 중 가장 약한 기운으로 뿌리가 없다. 변화무쌍하고 기복이 심하며 새로운 기운이 시작되기 직전의 공백 상태이다.',
    metaphor:    '소멸 — 기운이 완전히 끊겨 허공에 돌아가다',
    nature:      '사(死)',
    isUsable:    false,
  },
  {
    stage:       'TAE',
    hanja:       '胎',
    hangul:      '태',
    index:       10,
    strength:    4,
    description: '새로운 생명이 수태(受胎)되어 형성되기 시작하는 단계. 새로운 기운의 씨앗이 뿌려지는 단계로, 잠재력은 있으나 아직 약하다. 창의적이고 상상력이 풍부하다.',
    metaphor:    '수태 — 새 생명의 씨앗이 자궁 속에 자리를 잡다',
    nature:      '사(死)',
    isUsable:    false,
  },
  {
    stage:       'YANG',
    hanja:       '養',
    hangul:      '양',
    index:       11,
    strength:    8,
    description: '자궁(子宮) 속에서 보호받으며 자라는 단계. 어머니의 품처럼 안정적으로 성장하는 상태이다. 온화하고 의존적이며 보호받는 환경에서 능력이 발휘된다.',
    metaphor:    '태중 성장 — 어머니 자궁 속에서 보호받으며 탄생을 준비하다',
    nature:      '휴(休)',
    isUsable:    false,
  },
];

// ---------------------------------------------------------------------------
// 양간(陽干) · 음간(陰干) 장생지(長生地) 테이블
// ---------------------------------------------------------------------------

/**
 * 양간(陽干) 장생지(長生地) 테이블
 *
 * 양간은 장생지를 기준으로 지지를 순행(順行)하며 십이운성이 배속된다.
 *
 * | 천간 | StemIdx | 장생지 | BranchIdx |
 * |------|---------|--------|-----------|
 * | 甲   | 0       | 亥     | 11        |
 * | 丙   | 2       | 寅     | 2         |
 * | 戊   | 4       | 寅     | 2         |
 * | 庚   | 6       | 巳     | 5         |
 * | 壬   | 8       | 申     | 8         |
 *
 * 甲木은 亥(水)에서 생(生)을 받고, 丙·戊火·土는 寅(木)에서,
 * 庚金은 巳(火)에서 死地가 아닌 生地 — 화극금(火剋金) 후 금이 생(生)되는 역설,
 * 壬水는 申(金)에서 생(生)을 받는다.
 */
export const YANG_STEM_JANGSEAENG: Record<string, string> = {
  GAP:    'HAE',   // 甲(甲木 양간): 亥(BranchIdx 11)에서 장생
  BYEONG: 'IN',    // 丙(丙火 양간): 寅(BranchIdx 2)에서 장생
  MU:     'IN',    // 戊(戊土 양간): 寅(BranchIdx 2)에서 장생 — 화토동행(火土同行)
  GYEONG: 'SA',    // 庚(庚金 양간): 巳(BranchIdx 5)에서 장생
  IM:     'SHIN',  // 壬(壬水 양간): 申(BranchIdx 8)에서 장생
};

/**
 * 음간(陰干) 장생지(長生地) 테이블
 *
 * 음간은 장생지를 기준으로 지지를 역행(逆行)하며 십이운성이 배속된다.
 * 양순음역(陽順陰逆) 원칙에 따라 음간은 반대 방향으로 순환한다.
 *
 * | 천간 | StemIdx | 장생지 | BranchIdx |
 * |------|---------|--------|-----------|
 * | 乙   | 1       | 午     | 6         |
 * | 丁   | 3       | 酉     | 9         |
 * | 己   | 5       | 酉     | 9         |
 * | 辛   | 7       | 子     | 0         |
 * | 癸   | 9       | 卯     | 3         |
 *
 * 乙木은 午에서, 丁·己는 酉에서, 辛金은 子에서, 癸水는 卯에서
 * 각각 장생이 되며 역방향으로 순환한다.
 *
 * 논쟁: 음간 역행설은 자평진전(子平眞詮)을 따르는 유파의 정설이나,
 * 일부 유파에서는 음간도 순행(陽干과 동일 기준)으로 처리하기도 한다.
 */
export const YIN_STEM_JANGSEAENG: Record<string, string> = {
  EUL:   'O',     // 乙(乙木 음간): 午(BranchIdx 6)에서 장생
  JEONG: 'YU',    // 丁(丁火 음간): 酉(BranchIdx 9)에서 장생
  GI:    'YU',    // 己(己土 음간): 酉(BranchIdx 9)에서 장생 — 화토동행(火土同行)
  SIN:   'JA',    // 辛(辛金 음간): 子(BranchIdx 0)에서 장생
  GYE:   'MYO',   // 癸(癸水 음간): 卯(BranchIdx 3)에서 장생
};

// ---------------------------------------------------------------------------
// 천간 × 지지 → 십이운성 완전 배속 테이블
// ---------------------------------------------------------------------------

/**
 * 천간(天干) × 지지(地支) → 십이운성(十二運星) 배속 테이블
 *
 * STEM_BRANCH_LIFESTAGE[stemIdx][branchIdx] = LifeStage
 *
 * 계산 원칙:
 *   - 양간(甲·丙·戊·庚·壬): 장생지(BranchIdx)에서 시작하여 순행(+1 mod 12)
 *   - 음간(乙·丁·己·辛·癸): 장생지(BranchIdx)에서 시작하여 역행(-1 mod 12)
 *
 * 지지 인덱스:
 *   子=0, 丑=1, 寅=2, 卯=3, 辰=4, 巳=5, 午=6, 未=7, 申=8, 酉=9, 戌=10, 亥=11
 *
 * 천간 인덱스:
 *   甲=0, 乙=1, 丙=2, 丁=3, 戊=4, 己=5, 庚=6, 辛=7, 壬=8, 癸=9
 *
 * @example
 * // 甲(StemIdx 0)의 子(BranchIdx 0) 운성 조회
 * STEM_BRANCH_LIFESTAGE[0][0] // → 'SA' (甲이 子에서 사지(死地))
 *
 * @example
 * // 甲(StemIdx 0)의 亥(BranchIdx 11) 운성 조회
 * STEM_BRANCH_LIFESTAGE[0][11] // → 'JANG_SAENG' (甲의 장생지는 亥)
 */
export const STEM_BRANCH_LIFESTAGE: Record<number, Record<number, LifeStage>> = (() => {
  // 십이운성 순서 (index 0~11에 대응)
  const order = SIPIUNSEONG_ORDER;

  // 각 천간의 장생 시작 지지 인덱스 (BranchIdx)
  // 양간: 순행 시작점 / 음간: 역행 시작점
  // 甲=0: 亥=11, 乙=1: 午=6, 丙=2: 寅=2, 丁=3: 酉=9,
  // 戊=4: 寅=2, 己=5: 酉=9, 庚=6: 巳=5, 辛=7: 子=0, 壬=8: 申=8, 癸=9: 卯=3
  const startBranch: readonly number[] = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];

  // 양간 여부 (짝수 stemIdx = 양간, 홀수 stemIdx = 음간)
  const isYang: readonly boolean[] = [true, false, true, false, true, false, true, false, true, false];

  const result: Record<number, Record<number, LifeStage>> = {};

  for (let stemIdx = 0; stemIdx < 10; stemIdx++) {
    result[stemIdx] = {};
    const start = startBranch[stemIdx]!;
    const yang = isYang[stemIdx]!;

    for (let branchIdx = 0; branchIdx < 12; branchIdx++) {
      // 장생지를 index 0으로 하여 순행 또는 역행 계산
      let stageIndex: number;
      if (yang) {
        // 순행: (branchIdx - start + 12) mod 12
        stageIndex = ((branchIdx - start) % 12 + 12) % 12;
      } else {
        // 역행: (start - branchIdx + 12) mod 12
        stageIndex = ((start - branchIdx) % 12 + 12) % 12;
      }
      result[stemIdx]![branchIdx] = order[stageIndex]!;
    }
  }

  return result;
})();

// ---------------------------------------------------------------------------
// 유틸리티 함수
// ---------------------------------------------------------------------------

/**
 * 십이운성으로 통근(通根) 여부 판단
 *
 * 일간(日干)이 해당 운성의 지지에 뿌리를 내릴 수 있는지를 반환한다.
 *
 * 통근 가능한 운성:
 *   장생(長生)·관대(冠帶)·건록(建祿)·제왕(帝旺)·쇠(衰)·묘(墓)
 *
 * 통근 불가 또는 약통근:
 *   목욕(沐浴)·병(病)·사(死)·절(絶)·태(胎)·양(養)
 *
 * 참고: 일부 유파에서 사(死)·묘(墓)를 통근으로 인정하기도 하나,
 * 자평진전(子平眞詮) 정통 기준에서는 건록·제왕이 핵심이다.
 *
 * @param stage - 십이운성 단계
 * @returns 통근 가능 여부
 *
 * @example
 * isToongGeun('GEON_ROK') // true  (건록, 강한 통근)
 * isToongGeun('JE_WANG')  // true  (제왕, 최강 통근)
 * isToongGeun('JEOL')     // false (절, 통근 불가)
 */
export function isToongGeun(stage: LifeStage): boolean {
  switch (stage) {
    case 'JANG_SAENG': // 長生: 상(相), 통근 가능
    case 'GWAN_DAE':   // 冠帶: 상(相), 통근 가능
    case 'GEON_ROK':   // 建祿: 왕(旺), 강한 통근
    case 'JE_WANG':    // 帝旺: 왕(旺), 최강 통근
    case 'SWOE':       // 衰: 수(囚)이나 기운 잔존, 약한 통근 가능
    case 'MYO':        // 墓: 고(庫)에 잠재, 통근 가능 (갇힌 형태)
      return true;
    case 'MOK_YOK':    // 沐浴: 불안정, 통근 약
    case 'BYEONG':     // 病: 쇠약, 통근 약
    case 'SA':         // 死: 사망, 약한 통근
    case 'JEOL':       // 絶: 소멸, 통근 불가
    case 'TAE':        // 胎: 수태, 아직 미약
    case 'YANG':       // 養: 성장 중, 통근 미약
    default:
      return false;
  }
}

/**
 * 십이운성 강도(强度) 점수 반환
 *
 * 자평진전(子平眞詮) 기반 강도 체계:
 *
 * | 운성   | 강도 |
 * |--------|------|
 * | 제왕   | 20   |
 * | 건록   | 18   |
 * | 장생   | 12   |
 * | 관대   | 12   |
 * | 쇠     | 12   |
 * | 목욕   | 10   |
 * | 병     | 10   |
 * | 묘     | 8    |
 * | 사     | 8    |
 * | 양     | 8    |
 * | 태     | 4    |
 * | 절     | 2    |
 *
 * @param stage - 십이운성 단계
 * @returns 강도 점수 (2–20)
 *
 * @example
 * sipiunseongStrength('JE_WANG')   // 20 (최강)
 * sipiunseongStrength('GEON_ROK')  // 18
 * sipiunseongStrength('JEOL')      // 2  (최약)
 */
export function sipiunseongStrength(stage: LifeStage): number {
  switch (stage) {
    case 'JE_WANG':    return 20; // 帝旺: 전성기, 최고 강도
    case 'GEON_ROK':   return 18; // 建祿: 왕성, 두 번째 강도
    case 'JANG_SAENG': return 12; // 長生: 희망찬 탄생
    case 'GWAN_DAE':   return 12; // 冠帶: 준비 완성
    case 'SWOE':       return 12; // 衰: 아직 기운 잔존
    case 'MOK_YOK':    return 10; // 沐浴: 불안정
    case 'BYEONG':     return 10; // 病: 쇠약
    case 'MYO':        return 8;  // 墓: 창고에 갇힘
    case 'SA':         return 8;  // 死: 기운 소진
    case 'YANG':       return 8;  // 養: 태중 보호
    case 'TAE':        return 4;  // 胎: 수태, 미약
    case 'JEOL':       return 2;  // 絶: 완전 소멸
    default:           return 0;
  }
}

/**
 * 천간(天干)·지지(地支) 인덱스로 십이운성 조회
 *
 * `STEM_BRANCH_LIFESTAGE` 테이블의 함수형 래퍼이다.
 *
 * @param stemIdx   - 천간 인덱스 (0=甲 ... 9=癸)
 * @param branchIdx - 지지 인덱스 (0=子 ... 11=亥)
 * @returns 해당 천간·지지 조합의 십이운성
 *
 * @example
 * // 甲(0)의 亥(11): 장생
 * getLifeStage(0, 11) // → 'JANG_SAENG'
 *
 * @example
 * // 庚(6)의 午(6): 목욕
 * getLifeStage(6, 6) // → 'MOK_YOK'
 */
export function getLifeStage(stemIdx: StemIdx, branchIdx: BranchIdx): LifeStage {
  const row = STEM_BRANCH_LIFESTAGE[((stemIdx % 10) + 10) % 10];
  const cell = row?.[(((branchIdx % 12) + 12) % 12)];
  // 이론상 항상 존재하지만 타입 안전을 위해 fallback 처리
  return cell ?? 'JEOL';
}

/**
 * 십이운성 데이터 조회 (단계 → SipiunseongData)
 *
 * @param stage - 십이운성 단계
 * @returns 해당 단계의 상세 데이터, 없으면 undefined
 *
 * @example
 * getSipiunseongData('JE_WANG')?.hangul // → '제왕'
 */
export function getSipiunseongData(stage: LifeStage): SipiunseongData | undefined {
  return SIPIUNSEONG_TABLE.find((d) => d.stage === stage);
}

// ---------------------------------------------------------------------------
// 양순음역(陽順陰逆) 원칙 상수
// ---------------------------------------------------------------------------

/**
 * 양순음역(陽順陰逆) 원칙 상수
 *
 * 십이운성 배속의 핵심 원칙으로,
 * 양간(陽干)은 지지를 순행(順行)하고
 * 음간(陰干)은 지지를 역행(逆行)하여 운성이 배속된다.
 *
 * 이 원칙은 자평진전(子平眞詮) 서낙오(徐樂吾) 정통 유파의 입장이며,
 * 적천수(滴天髓) 일부 해설에서는 음간 역행을 부정하는 논란이 있다.
 */
export const YANG_SUN_EUM_YEOK: {
  /** 원칙 이름 */
  principle: string;
  /** 양간 순행(順行) 십이운성 순서 (장생 → ... → 양) */
  yangOrder: LifeStage[];
  /** 음간 역행(逆行) — 실제 운성 배속은 지지 방향이 반대이므로 동일 순서 사용 */
  yinOrder: LifeStage[];
  /**
   * 음간 역행 논쟁 설명
   *
   * 자평진전 정통 유파와 일부 적천수 해설 간의 이견을 정리한다.
   */
  controversy: string;
} = {
  principle:
    '양간(陽干)은 장생지에서 지지 순서대로 순행(順行)하여 십이운성이 배속되고, ' +
    '음간(陰干)은 장생지에서 지지 역순으로 역행(逆行)하여 배속된다.',

  yangOrder: [
    'JANG_SAENG', // 0: 長生 — 양간 장생지(亥·寅·巳·申)에서 시작
    'MOK_YOK',    // 1: 沐浴
    'GWAN_DAE',   // 2: 冠帶
    'GEON_ROK',   // 3: 建祿
    'JE_WANG',    // 4: 帝旺
    'SWOE',       // 5: 衰
    'BYEONG',     // 6: 病
    'SA',         // 7: 死
    'MYO',        // 8: 墓
    'JEOL',       // 9: 絶
    'TAE',        // 10: 胎
    'YANG',       // 11: 養
  ],

  yinOrder: [
    'JANG_SAENG', // 0: 長生 — 음간 장생지(午·酉·子·卯)에서 시작, 이후 역행
    'MOK_YOK',    // 1: 沐浴
    'GWAN_DAE',   // 2: 冠帶
    'GEON_ROK',   // 3: 建祿
    'JE_WANG',    // 4: 帝旺
    'SWOE',       // 5: 衰
    'BYEONG',     // 6: 病
    'SA',         // 7: 死
    'MYO',        // 8: 墓
    'JEOL',       // 9: 絶
    'TAE',        // 10: 胎
    'YANG',       // 11: 養
  ],

  controversy:
    '음간 역행(陰逆)에 대한 논쟁: ' +
    '자평진전(子平眞詮) 정통 유파는 양간 순행·음간 역행을 엄격히 적용한다. ' +
    '그러나 일부 적천수(滴天髓) 해설가 및 현대 명리학자는 ' +
    '"음간이 역행하면 乙木의 장생지가 午(火)가 되어 극(剋) 받는 지지가 장생이 된다"는 ' +
    '모순을 지적하며 음양 모두 양간 기준 순행을 주장하기도 한다. ' +
    '이 모듈은 자평진전 정통설인 양순음역을 기본으로 구현한다.',
};

// ---------------------------------------------------------------------------
// 지지 왕쇠(旺衰) 분류 상수
// ---------------------------------------------------------------------------

/**
 * 지지(地支) 왕쇠(旺衰) 분류 상수
 *
 * 십이운성론에서 지지를 성질에 따라 분류한 체계이다.
 *
 * - 왕지(旺地): 해당 오행이 제왕(帝旺) 또는 건록(建祿)으로 가장 강한 지지
 * - 생지(生地): 장생(長生)이 되는 지지 — 申·亥·寅·巳
 * - 묘지(墓地): 고(庫)·창고로 기운이 저장·갇히는 지지 — 辰·戌·丑·未
 */
export const JIJI_WANGSWOE: {
  /**
   * 왕지(旺地) — 제왕(帝旺)·건록(建祿)이 되는 강한 지지
   *
   * 각 오행의 건록·제왕에 해당하는 지지들:
   * - 甲·乙의 건록/제왕: 寅(IN), 卯(MYO)
   * - 丙·丁의 건록/제왕: 巳(SA), 午(O)
   * - 庚·辛의 건록/제왕: 申(SHIN), 酉(YU)
   * - 壬·癸의 건록/제왕: 亥(HAE), 子(JA)
   */
  wang: string[];
  /**
   * 생지(生地) — 장생(長生)이 되는 지지
   *
   * 四生地(사생지): 申·亥·寅·巳
   * - 申(SHIN): 壬水의 장생지
   * - 亥(HAE):  甲木의 장생지
   * - 寅(IN):   丙·戊火·土의 장생지
   * - 巳(SA):   庚金의 장생지
   */
  saengji: string[];
  /**
   * 묘지(墓地) — 고(庫), 창고(倉庫)에 해당하는 지지
   *
   * 四庫地(사고지): 辰·戌·丑·未
   * - 辰(JIN): 水庫 (壬·癸의 묘지)
   * - 戌(SUL): 火庫 (丙·丁의 묘지)
   * - 丑(CHUK): 金庫 (庚·辛의 묘지)
   * - 未(MI):  木庫 (甲·乙의 묘지)
   */
  myoji: string[];
} = {
  wang: [
    'IN',   // 寅: 甲木 건록지
    'MYO',  // 卯: 甲木 제왕지 / 乙木 건록지
    'SA',   // 巳: 丙·戊火 건록지
    'O',    // 午: 丙·戊火 제왕지 / 丁·己火 건록지
    'SHIN', // 申: 庚金 건록지
    'YU',   // 酉: 庚金 제왕지 / 辛金 건록지
    'HAE',  // 亥: 壬水 건록지
    'JA',   // 子: 壬水 제왕지 / 癸水 건록지
  ],
  saengji: [
    'SHIN', // 申: 壬水의 장생지 — 金生水
    'HAE',  // 亥: 甲木의 장생지 — 水生木
    'IN',   // 寅: 丙·戊의 장생지 — 木生火
    'SA',   // 巳: 庚金의 장생지 — 火(가 되고 나서 金을 생)
  ],
  myoji: [
    'JIN',  // 辰: 水庫 — 壬·癸 및 乙木의 묘지
    'SUL',  // 戌: 火庫 — 丙·丁 및 辛金의 묘지
    'CHUK', // 丑: 金庫 — 庚·辛 및 癸水의 묘지
    'MI',   // 未: 木庫 — 甲·乙 및 丁火의 묘지
  ],
};

// ---------------------------------------------------------------------------
// 천간별 전체 운성 배속 미리보기 (참고용 문자열 테이블)
// ---------------------------------------------------------------------------

/**
 * 천간(天干)별 12지지 운성 배속 참고 테이블 (문자열 형식)
 *
 * 이 테이블은 STEM_BRANCH_LIFESTAGE를 인간이 읽기 쉬운 형식으로 정리한 것이다.
 * 실제 계산에는 STEM_BRANCH_LIFESTAGE를 사용할 것.
 *
 * 형식: stemHanja → [子,丑,寅,卯,辰,巳,午,未,申,酉,戌,亥] 순서의 운성
 *
 * 甲(GAP, 양간, 亥 기준 순행):
 *   亥=장생 子=목욕 丑=관대 寅=건록 卯=제왕 辰=쇠 巳=병 午=사 未=묘 申=절 酉=태 戌=양
 *   ※ 亥=장생(0), 子=목욕(1), 丑=관대(2) ... 戌=양(11) 순행
 *
 * 위 설명의 오류를 방지하기 위해 실제 배속은 STEM_BRANCH_LIFESTAGE 사용
 */
export const STEM_LIFESTAGE_REFERENCE: Record<string, readonly string[]> = (() => {
  const stemNames = ['甲(GAP)', '乙(EUL)', '丙(BYEONG)', '丁(JEONG)', '戊(MU)', '己(GI)', '庚(GYEONG)', '辛(SIN)', '壬(IM)', '癸(GYE)'];
  const branchNames = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const hangulMap: Record<LifeStage, string> = {
    JANG_SAENG: '장생', MOK_YOK: '목욕', GWAN_DAE: '관대', GEON_ROK: '건록',
    JE_WANG: '제왕', SWOE: '쇠', BYEONG: '병', SA: '사',
    MYO: '묘', JEOL: '절', TAE: '태', YANG: '양',
  };

  const result: Record<string, readonly string[]> = {};
  for (let s = 0; s < 10; s++) {
    const row: string[] = [];
    for (let b = 0; b < 12; b++) {
      const stage = STEM_BRANCH_LIFESTAGE[s]![b]!;
      row.push(`${branchNames[b]}=${hangulMap[stage]}`);
    }
    result[stemNames[s]!] = row;
  }
  return result;
})();
