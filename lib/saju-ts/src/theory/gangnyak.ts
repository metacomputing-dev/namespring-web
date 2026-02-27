/**
 * 강약론(强弱論) — 일간(日干) 신강신약(身强身弱) 판단 이론
 *
 * 신강신약(身强身弱)이란 사주(四柱)에서 일간(日干)의 세력이
 * 강한지(身强) 약한지(身弱)를 판단하는 핵심 이론이다.
 *
 * 강약 판단 3대 기준:
 *   1. 득령(得令): 일간이 월지(月支)에서 왕상(旺相) 기운을 얻는 경우.
 *      월지는 사주의 제왕(帝旺)이라 불릴 만큼 영향력이 크다.
 *   2. 득지(得地): 일간이 지지(地支)에 통근(通根)하는 경우.
 *      지지의 지장간(藏干)에 일간과 같은 오행이 포함되어 있으면 통근.
 *   3. 득세(得勢): 천간(天干)에 비겁(比劫)·인성(印星)이 많은 경우.
 *      비겁은 일간과 같은 오행, 인성은 일간을 생(生)하는 오행.
 *
 * 신강(身强) 조건: 득령 + 득지 + 득세 중 2개 이상 충족
 * 신약(身弱) 조건: 득령 + 득지 + 득세 중 1개 이하 충족
 *
 * 왕상휴수사(旺相休囚死) 강도 체계 (命理探原 기준):
 *   旺(왕): 월지 오행이 일간 오행과 동일. 기운이 정점. 강도 5.
 *   相(상): 월지 오행이 일간을 생(生)한다. 기운 상승. 강도 4.
 *   休(휴): 일간이 월지 오행을 생(生)한다. 기운 소모. 강도 2.
 *   囚(수): 일간이 월지 오행을 극(克)한다. 기운 갇힘. 강도 1.
 *   死(사): 월지 오행이 일간을 극(克)한다. 기운 고갈. 강도 0.
 *
 * 왕상휴수사 공식:
 *   offset = (D_element - M_element + 5) % 5
 *   offset 0 = 旺, 1 = 相, 2 = 死, 3 = 囚, 4 = 休
 *   여기서 D = 일간 오행 인덱스, M = 월지 오행 인덱스
 *   오행 인덱스: 木=0, 火=1, 土=2, 金=3, 水=4
 *
 * 통근(通根) 원칙:
 *   천간이 지지의 지장간(地藏干)에 포함되어 있으면 통근이 있다.
 *   본기(本氣) 통근이 가장 강하고, 중기·여기 통근은 약하다.
 *
 * 근거 문헌: 子平眞詮(자평진전), 滴天髓(적천수), 命理探源(명리탐원)
 */

import type { StemIdx, BranchIdx, Element } from '../core/cycle.js';
import { stemElement } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 오행(五行) 내부 상수
// ---------------------------------------------------------------------------

/**
 * 오행 인덱스: 木=0, 火=1, 土=2, 金=3, 水=4
 *
 * 생(生) 순서: 木(0)→火(1)→土(2)→金(3)→水(4)→木(0)
 * 극(克) 순서: 木(0)→土(2)→水(4)→火(1)→金(3)→木(0)
 */
const ELEMENT_IDX: Record<Element, number> = {
  WOOD: 0, FIRE: 1, EARTH: 2, METAL: 3, WATER: 4,
};

/** 천간 오행 인덱스 (0~9 → 0~4) */
const OHHAENG_OF_STEM: number[] = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
//                                  甲 乙 丙 丁 戊 己 庚 辛 壬 癸

/** 지지 오행 인덱스 (0~11 → 0~4) */
const OHHAENG_OF_BRANCH: number[] = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
//                                    子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥

// ---------------------------------------------------------------------------
// 강도(强度) 타입
// ---------------------------------------------------------------------------

/**
 * 왕상휴수사(旺相休囚死) 강도 타입
 *
 * 일간 오행이 특정 월에 놓였을 때의 강도를 다섯 단계로 나타낸다.
 */
export type WangsangHyusuSa = 'WANG' | 'SANG' | 'HYU' | 'SU' | 'SA';

/**
 * 왕상휴수사 강도 점수
 *
 *   WANG(旺): 5 — 월령에서 왕성함
 *   SANG(相): 4 — 월령에서 상승 중
 *   HYU(休):  2 — 월령에서 휴식 (기운 소모)
 *   SU(囚):   1 — 월령에서 극을 시도하나 갇힘
 *   SA(死):   0 — 월령에서 극을 당하여 가장 약함
 */
export const WANGSANG_SCORE: Record<WangsangHyusuSa, number> = {
  WANG: 5, // 旺: 최강
  SANG: 4, // 相: 강
  HYU:  2, // 休: 중간
  SU:   1, // 囚: 약
  SA:   0, // 死: 최약
};

/**
 * 왕상휴수사를 공식으로 산출한다 (命理探原 기준).
 *
 * offset = (D_element - M_element + 5) % 5
 *   0 → WANG (旺): 동일 오행 — 기운이 정점
 *   1 → SANG (相): 월지가 나를 생(生) — 기운 상승
 *   2 → SA   (死): 월지가 나를 극(克) — 기운 고갈
 *   3 → SU   (囚): 내가 월지를 극(克) — 기운 갇힘
 *   4 → HYU  (休): 내가 월지를 생(生) — 기운 소모
 *
 * @param dayOhhaeng    - 일간 오행 인덱스 (0~4)
 * @param monthOhhaeng  - 월지 오행 인덱스 (0~4)
 * @returns 왕상휴수사 타입
 */
function computeWangsang(dayOhhaeng: number, monthOhhaeng: number): WangsangHyusuSa {
  const offset = ((dayOhhaeng - monthOhhaeng) % 5 + 5) % 5;
  switch (offset) {
    case 0: return 'WANG'; // 旺: 동일 오행
    case 1: return 'SANG'; // 相: 월지 생 나 (M생D)
    case 2: return 'SA';   // 死: 월지 극 나 (M극D)
    case 3: return 'SU';   // 囚: 나 극 월지 (D극M)
    case 4: return 'HYU';  // 休: 나 생 월지 (D생M)
    default: return 'WANG';
  }
}

// ---------------------------------------------------------------------------
// 신강신약 판단 결과 타입
// ---------------------------------------------------------------------------

/**
 * 신강신약 판단 결과
 *
 *   STRONG         = 신강(身强): 일간의 세력이 전반적으로 강함
 *   WEAK           = 신약(身弱): 일간의 세력이 전반적으로 약함
 *   BALANCED       = 중화(中和): 강약이 균형을 이룸
 *   EXTREME_STRONG = 극강(極强): 전왕격 수준의 압도적 강함
 *   EXTREME_WEAK   = 극약(極弱): 종격 수준의 압도적 약함
 */
export type GangnyakResult =
  | 'STRONG'
  | 'WEAK'
  | 'BALANCED'
  | 'EXTREME_STRONG'
  | 'EXTREME_WEAK';

/**
 * 신강(身强) 유형 — 4가지 세부 분류
 *
 *   INDA_SINGANG     인다신강(印多身强): 인성 과다로 인한 신강.
 *                    인성이 일간을 과도하게 생(生)하여 일간이 강해진 경우.
 *                    학문적이나 의타적 경향이 있다.
 *
 *   BIGEOP_SINGANG   비겁신강(比劫身强): 비겁 과다로 인한 신강.
 *                    일간과 같은 오행이 많아 경쟁·다툼이 강한 신강.
 *                    자주적이나 군겁쟁재 위험이 있다.
 *
 *   WOLRYEONG_SINGANG 월령신강(月令身强): 월령 득령에 의한 신강.
 *                    월지에서 왕(旺) 또는 상(相)을 얻어 기반이 튼튼한 신강.
 *                    계절적 기운을 받은 자연스러운 강함.
 *
 *   JONGHAP_SINGANG  종합신강(綜合身强): 득령·득지·득세 종합 판단에 의한 신강.
 *                    단일 요소가 아닌 복합적 기준으로 신강.
 */
export type SingangType =
  | 'INDA_SINGANG'
  | 'BIGEOP_SINGANG'
  | 'WOLRYEONG_SINGANG'
  | 'JONGHAP_SINGANG';

/**
 * 신약(身弱) 유형 — 4가지 세부 분류
 *
 *   JAESEONGGWA_SINYAK  재성과다신약(財星過多身弱): 재성이 과다하여 일간 소모.
 *                       일간이 재성을 극(克)하느라 기력이 소진된 경우.
 *
 *   GWANSAL_SINYAK      관살과다신약(官殺過多身弱): 관성·편관이 과다하여 일간 억압.
 *                       관살이 일간을 극하여 일간이 억눌린 경우.
 *
 *   SIKSANG_SINYAK      식상과다신약(食傷過多身弱): 식상이 과다하여 일간 설기(泄氣).
 *                       일간이 식상을 생하느라 기운이 빠져나간 경우.
 *
 *   JONGHAP_SINYAK      종합신약(綜合身弱): 득령·득지·득세 종합 판단에 의한 신약.
 *                       여러 불리한 요소가 복합된 경우.
 */
export type SinyakType =
  | 'JAESEONGGWA_SINYAK'
  | 'GWANSAL_SINYAK'
  | 'SIKSANG_SINYAK'
  | 'JONGHAP_SINYAK';

/**
 * 종격(從格) 유형 — 극강/극약에 의한 특수 격국
 *
 *   JINJONG     진종(眞從): 일간의 통근이 완전히 없고 비겁·인성이 전무한 경우.
 *               사주의 강한 기운을 온전히 따라가므로 그 기운이 용신이 된다.
 *
 *   GAJONG      가종(假從): 일간에 미약한 통근이나 인성이 남아 있으나 전체 기세에
 *               의해 억눌린 경우. 대운에서 비겁·인성이 오면 종이 깨질 수 있다.
 *
 *   JEONWANG    전왕(專旺): 일간의 기운이 극단적으로 강하여 비겁·인성이 사주를 지배.
 *               관성·재성이 없거나 무력한 경우. 곡직·염상·가색·종혁·윤하격 등.
 */
export type JonggyeokType = 'JINJONG' | 'GAJONG' | 'JEONWANG';

/**
 * 화격(化格) 유형 — 합화(合化) 성립에 의한 특수 격국
 *
 *   JINHWA   진화(眞化): 합화 조건이 완전히 충족된 화기격. 화신이 용신.
 *   GAHWA    가화(假化): 합화 조건이 부분적으로 충족된 화기격. 불안정.
 */
export type HwagyeokType = 'JINHWA' | 'GAHWA';

/**
 * 강약 판단 상세 결과
 */
export interface GangnyakDetail {
  /** 판단 결과 */
  result: GangnyakResult;
  /** 득령(得令) 여부 — 월지에서 왕상 기운 획득 */
  deukryeong: boolean;
  /** 득지(得地) 여부 — 지지 통근 여부 */
  deukji: boolean;
  /** 득세(得勢) 여부 — 천간 비겁·인성 수 2개 이상 */
  deukse: boolean;
  /** 일간 왕상휴수사 단계 */
  wangsang: WangsangHyusuSa;
  /** 왕상휴수사 점수 */
  wangsangScore: number;
  /** 비겁·인성 개수 (천간 기준) */
  supportCount: number;
  /** 관성·재성·식상 개수 (천간 기준) */
  drainCount: number;
  /** 득령 상세: 월령에서의 왕상휴수사 판단 근거 */
  deukryeongDetail: DeukryeongDetail;
  /** 득지 상세: 지지 통근 정보 */
  deukjiDetail: DeukjiDetail;
  /** 득세 상세: 오행별 세력 분포 */
  deukseDetail: DeukseDetail;
  /** 종합 강약 점수 (0~100 범위, 50 = 중화) */
  totalScore: number;
  /** 신강 유형 (신강인 경우에만 유효) */
  singangType?: SingangType;
  /** 신약 유형 (신약인 경우에만 유효) */
  sinyakType?: SinyakType;
}

// ---------------------------------------------------------------------------
// 득령(得令) 상세 인터페이스
// ---------------------------------------------------------------------------

/**
 * 득령(得令) 상세 — 월령에서의 왕상휴수사 판단 근거
 *
 * 월지의 오행이 일간 오행에 대해 어떤 관계인지를 기록한다.
 * 왕상(旺相)이면 득령, 휴수사(休囚死)이면 실령(失令).
 */
export interface DeukryeongDetail {
  /** 일간 오행 */
  ilganElement: Element;
  /** 월지 오행 */
  woljiElement: Element;
  /** 왕상휴수사 단계 */
  wangsang: WangsangHyusuSa;
  /** 왕상휴수사 점수 (0~5) */
  score: number;
  /** 득령 여부 */
  deukryeong: boolean;
  /** 판단 근거 설명 */
  description: string;
}

// ---------------------------------------------------------------------------
// 득지(得地) 상세 인터페이스
// ---------------------------------------------------------------------------

/**
 * 개별 지지 통근 정보
 */
export interface TonggeunEntry {
  /** 지지 인덱스 (0~11) */
  branchIdx: BranchIdx;
  /** 위치 (년·월·일·시) */
  position: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR';
  /** 통근 강도 */
  strength: 'STRONG' | 'WEAK' | 'NONE';
  /**
   * 십이운성 강도 점수 (0~20)
   *
   * 일간의 지지에서의 십이운성 강도를 기반으로 산출.
   * 건록(18), 제왕(20), 장생(12), 관대(12), 쇠(12) 등.
   */
  sipiunseongScore: number;
  /** 통근 가중치 (위치별 차등) */
  weight: number;
}

/**
 * 득지(得地) 상세 — 지지 통근 종합 판단
 */
export interface DeukjiDetail {
  /** 4지지 통근 정보 배열 */
  entries: TonggeunEntry[];
  /** 통근 총점 (가중합) */
  totalScore: number;
  /** 통근 개수 (STRONG + WEAK) */
  rootCount: number;
  /** 득지 여부 */
  deukji: boolean;
}

// ---------------------------------------------------------------------------
// 득세(得勢) 상세 인터페이스
// ---------------------------------------------------------------------------

/**
 * 오행별 세력 분포
 */
export interface OhhaengSeryeok {
  /** 오행 */
  element: Element;
  /** 천간 가중 점수 */
  cheonganScore: number;
  /** 지지(지장간) 가중 점수 */
  jijiScore: number;
  /** 합산 점수 */
  totalScore: number;
}

/**
 * 득세(得勢) 상세 — 사주 전체 오행 세력 판단
 */
export interface DeukseDetail {
  /** 5오행별 세력 분포 */
  distribution: OhhaengSeryeok[];
  /** 비겁(일간과 같은 오행) 세력 */
  bigeopScore: number;
  /** 인성(일간을 생하는 오행) 세력 */
  inseongScore: number;
  /** 식상(일간이 생하는 오행) 세력 */
  siksangScore: number;
  /** 재성(일간이 극하는 오행) 세력 */
  jaeseongScore: number;
  /** 관성(일간을 극하는 오행) 세력 */
  gwanseongScore: number;
  /** 아방(我方 = 비겁 + 인성) 합산 */
  abangTotal: number;
  /** 적방(敵方 = 식상 + 재성 + 관성) 합산 */
  jeokbangTotal: number;
  /** 득세 여부 */
  deukse: boolean;
}

// ---------------------------------------------------------------------------
// 점수 가중치 체계
// ---------------------------------------------------------------------------

/**
 * 강약 판단 점수 가중치 정책
 *
 * 천간·지지·지장간 위치에 따라 다른 가중치를 부여한다.
 * 기본값은 자평진전 표준 학설 기반이며, 유파에 따라 조정 가능.
 *
 * 점수 체계 원리:
 *   - 월지(月支)의 영향력이 가장 크다 (전체의 약 40%).
 *   - 일지(日支)가 두 번째로 크다 (일간과 가장 가까운 뿌리).
 *   - 천간은 드러난 기운이므로 직접적이나, 지지보다 약하다.
 *   - 지장간 본기 > 중기 > 여기 순으로 가중치를 부여한다.
 */
export interface GangnyakScorePolicy {
  /** 천간 가중치 (기본 1.0) */
  cheonganWeight: number;
  /** 월지 가중치 (기본 3.0 — 월령의 특별한 영향력 반영) */
  woljiWeight: number;
  /** 일지 가중치 (기본 1.5 — 일간과 가장 가까운 뿌리) */
  iljiWeight: number;
  /** 년지 가중치 (기본 0.8) */
  nyeonjiWeight: number;
  /** 시지 가중치 (기본 1.0) */
  sijiWeight: number;
  /** 지장간 본기 가중치 비율 (기본 0.6) */
  bongiRatio: number;
  /** 지장간 중기 가중치 비율 (기본 0.3) */
  junggiRatio: number;
  /** 지장간 여기 가중치 비율 (기본 0.1) */
  yeogiRatio: number;
  /** 중화 판단 허용 오차 (기본 5 — 아방·적방 차이가 이 범위 내이면 중화) */
  balanceThreshold: number;
  /** 극강 판단 아방 비율 하한 (기본 0.80 — 아방이 전체의 80% 이상이면 극강) */
  extremeStrongRatio: number;
  /** 극약 판단 아방 비율 상한 (기본 0.15 — 아방이 전체의 15% 이하이면 극약) */
  extremeWeakRatio: number;
}

/**
 * 기본 강약 점수 가중치 정책
 */
export const DEFAULT_GANGNYAK_POLICY: GangnyakScorePolicy = {
  cheonganWeight:     1.0,
  woljiWeight:        3.0,
  iljiWeight:         1.5,
  nyeonjiWeight:      0.8,
  sijiWeight:         1.0,
  bongiRatio:         0.6,
  junggiRatio:        0.3,
  yeogiRatio:         0.1,
  balanceThreshold:   5,
  extremeStrongRatio: 0.80,
  extremeWeakRatio:   0.15,
};

// ---------------------------------------------------------------------------
// 월령 득령 테이블 (旺相休囚死) — 命理探原 기준
// ---------------------------------------------------------------------------

/**
 * 일간별 월령(月令) 왕상휴수사(旺相休囚死) 테이블
 *
 * [일간 인덱스 0~9][월지 인덱스 0~11]
 *
 * 오행 배속:
 *   甲乙(0,1)=木  丙丁(2,3)=火  戊己(4,5)=土  庚辛(6,7)=金  壬癸(8,9)=水
 *
 * 월지 오행:
 *   子(0)=水 丑(1)=土 寅(2)=木 卯(3)=木 辰(4)=土 巳(5)=火
 *   午(6)=火 未(7)=土 申(8)=金 酉(9)=金 戌(10)=土 亥(11)=水
 *
 * 왕상휴수사 관계 (命理探原 기준):
 *   같은 오행          → 旺(왕) — offset 0
 *   월지가 일간을 생    → 相(상) — offset 1
 *   월지가 일간을 극    → 死(사) — offset 2
 *   일간이 월지를 극    → 囚(수) — offset 3
 *   일간이 월지를 생    → 休(휴) — offset 4
 *
 * 공식: offset = (일간오행 - 월지오행 + 5) % 5
 *
 * 土 월(辰丑未戌)에서 土일간은 旺으로 처리한다.
 *
 * 참고: 이 테이블은 computeWangsang() 함수로도 동적 산출 가능.
 *       정적 테이블은 O(1) 조회 및 검증 용도로 유지한다.
 */
export const WOLRYEONG_WANGSANG: WangsangHyusuSa[][] = (() => {
  const table: WangsangHyusuSa[][] = [];
  for (let s = 0; s < 10; s++) {
    const row: WangsangHyusuSa[] = [];
    for (let b = 0; b < 12; b++) {
      row.push(computeWangsang(OHHAENG_OF_STEM[s]!, OHHAENG_OF_BRANCH[b]!));
    }
    table.push(row);
  }
  return table;
})();

/*
 * 테이블 검증 참고 (위 공식으로 산출된 완전 테이블):
 *
 *       子(水) 丑(土) 寅(木) 卯(木) 辰(土) 巳(火) 午(火) 未(土) 申(金) 酉(金) 戌(土) 亥(水)
 * 甲(木)  相    囚    旺    旺    囚    休    休    囚    死    死    囚    相
 * 乙(木)  相    囚    旺    旺    囚    休    休    囚    死    死    囚    相
 * 丙(火)  死    休    相    相    休    旺    旺    休    囚    囚    休    死
 * 丁(火)  死    休    相    相    休    旺    旺    休    囚    囚    休    死
 * 戊(土)  囚    旺    死    死    旺    相    相    旺    休    休    旺    囚
 * 己(土)  囚    旺    死    死    旺    相    相    旺    休    休    旺    囚
 * 庚(金)  休    相    囚    囚    相    死    死    相    旺    旺    相    休
 * 辛(金)  休    相    囚    囚    相    死    死    相    旺    旺    相    休
 * 壬(水)  旺    死    休    休    死    囚    囚    死    相    相    死    旺
 * 癸(水)  旺    死    休    休    死    囚    囚    死    相    相    死    旺
 */

// ---------------------------------------------------------------------------
// 득령(得令) 판단 함수
// ---------------------------------------------------------------------------

/**
 * 월지에서 일간의 왕상휴수사 단계를 반환한다.
 *
 * @param stemIdx   - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 왕상휴수사 단계
 *
 * @example
 * getWangsang(0, 2)  // 甲일간 寅월 → WANG
 * getWangsang(0, 5)  // 甲일간 巳월 → HYU
 * getWangsang(6, 8)  // 庚일간 申월 → WANG
 */
export function getWangsang(
  stemIdx: StemIdx,
  branchIdx: BranchIdx,
): WangsangHyusuSa {
  const s = ((stemIdx   % 10) + 10) % 10;
  const b = ((branchIdx % 12) + 12) % 12;
  return WOLRYEONG_WANGSANG[s]![b]!;
}

/**
 * 왕상휴수사를 공식으로 직접 산출한다 (테이블 조회 대신 사용 가능).
 *
 * @param stemIdx   - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 왕상휴수사 단계
 */
export function computeWangsangByIdx(
  stemIdx: StemIdx,
  branchIdx: BranchIdx,
): WangsangHyusuSa {
  const s = ((stemIdx   % 10) + 10) % 10;
  const b = ((branchIdx % 12) + 12) % 12;
  return computeWangsang(OHHAENG_OF_STEM[s]!, OHHAENG_OF_BRANCH[b]!);
}

/**
 * 일간이 월지에서 득령(得令)하는지 판단한다.
 *
 * 득령 조건: 왕상휴수사에서 旺(WANG) 또는 相(SANG)인 경우.
 *
 * @param stemIdx   - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 득령 여부
 *
 * @example
 * isDeukryeong(0, 2)  // 甲일간 寅월 → true (旺)
 * isDeukryeong(0, 11) // 甲일간 亥월 → true (相)
 * isDeukryeong(0, 8)  // 甲일간 申월 → false (死)
 */
export function isDeukryeong(
  stemIdx: StemIdx,
  branchIdx: BranchIdx,
): boolean {
  const ws = getWangsang(stemIdx, branchIdx);
  return ws === 'WANG' || ws === 'SANG';
}

/**
 * 득령 상세 정보를 산출한다.
 *
 * @param stemIdx   - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 득령 상세 정보
 */
export function getDeukryeongDetail(
  stemIdx: StemIdx,
  branchIdx: BranchIdx,
): DeukryeongDetail {
  const s = ((stemIdx   % 10) + 10) % 10;
  const b = ((branchIdx % 12) + 12) % 12;

  const ilganEl = stemElement(s);
  const woljiEl: Element = (['WATER','EARTH','WOOD','WOOD','EARTH','FIRE','FIRE','EARTH','METAL','METAL','EARTH','WATER'] as const)[b]!;

  const ws = getWangsang(s, b);
  const score = WANGSANG_SCORE[ws];
  const deukryeong = ws === 'WANG' || ws === 'SANG';

  const WANGSANG_DESC: Record<WangsangHyusuSa, string> = {
    WANG: '일간의 오행이 월지의 오행과 동일하여 기운이 최고점에 달하는 상태이다.',
    SANG: '월지의 오행이 일간의 오행을 생(生)하여 기운이 상승하는 상태이다.',
    HYU:  '일간의 오행이 월지의 오행을 생(生)하여 기운이 소모되는 상태이다.',
    SU:   '일간의 오행이 월지의 오행을 극(克)하나 월지가 강하여 갇히는 상태이다.',
    SA:   '월지의 오행이 일간의 오행을 극(克)하여 기운이 최약인 상태이다.',
  };

  return {
    ilganElement: ilganEl,
    woljiElement: woljiEl,
    wangsang: ws,
    score,
    deukryeong,
    description: WANGSANG_DESC[ws],
  };
}

// ---------------------------------------------------------------------------
// 지지 통근(通根) 테이블
// ---------------------------------------------------------------------------

/**
 * 지지 지장간 포함 천간 인덱스 테이블 (통근 판정용)
 *
 * [지지 인덱스 0~11] → 포함 천간 인덱스 배열
 *
 * 지장간 (자평진전 기준):
 *   子(0):  癸(9)
 *   丑(1):  癸(9), 辛(7), 己(5)
 *   寅(2):  戊(4), 丙(2), 甲(0)
 *   卯(3):  乙(1)
 *   辰(4):  乙(1), 癸(9), 戊(4)
 *   巳(5):  戊(4), 庚(6), 丙(2)
 *   午(6):  己(5), 丁(3)
 *   未(7):  丁(3), 乙(1), 己(5)
 *   申(8):  戊(4), 壬(8), 庚(6)
 *   酉(9):  辛(7)
 *   戌(10): 辛(7), 丁(3), 戊(4)
 *   亥(11): 甲(0), 壬(8)
 */
export const BRANCH_JIJANGGAN: StemIdx[][] = [
  [9],         // 子: 癸
  [9, 7, 5],   // 丑: 癸辛己
  [4, 2, 0],   // 寅: 戊丙甲
  [1],         // 卯: 乙
  [1, 9, 4],   // 辰: 乙癸戊
  [4, 6, 2],   // 巳: 戊庚丙
  [5, 3],      // 午: 己丁
  [3, 1, 5],   // 未: 丁乙己
  [4, 8, 6],   // 申: 戊壬庚
  [7],         // 酉: 辛
  [7, 3, 4],   // 戌: 辛丁戊
  [0, 8],      // 亥: 甲壬
];

/**
 * 천간이 지지에 통근(通根)하는 강도를 반환한다.
 *
 * 통근 판정 기준:
 *   STRONG: 지장간에 동일 천간이 포함된 경우
 *   WEAK:   동일 오행의 음양 교차 천간이 포함된 경우 (예: 甲<->乙, 丙<->丁)
 *   NONE:   지장간에 관련 천간이 없는 경우
 *
 * @param stemIdx   - 천간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 통근 강도
 *
 * @example
 * tonggunStrength(0, 2)  // 甲이 寅에 → STRONG
 * tonggunStrength(0, 3)  // 甲이 卯에 → WEAK (乙과 교차)
 * tonggunStrength(0, 9)  // 甲이 酉에 → NONE
 */
export function tonggunStrength(
  stemIdx: StemIdx,
  branchIdx: BranchIdx,
): 'STRONG' | 'WEAK' | 'NONE' {
  const s = ((stemIdx   % 10) + 10) % 10;
  const b = ((branchIdx % 12) + 12) % 12;
  const jijanggan = BRANCH_JIJANGGAN[b]!;

  // 동일 천간 직접 통근
  if (jijanggan.includes(s)) return 'STRONG';

  // 동일 오행 음양 교차 통근 (약통근)
  const pair = s % 2 === 0 ? s + 1 : s - 1;
  if (pair >= 0 && pair <= 9 && jijanggan.includes(pair)) return 'WEAK';

  return 'NONE';
}

/**
 * 일간이 사주 지지들에 통근하여 득지(得地)하는지 판단한다.
 *
 * 득지 조건: 4개 지지 중 적어도 1개에 통근(STRONG 또는 WEAK)하면 득지.
 *
 * @param stemIdx    - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdxs - 사주 4지지 배열 (년·월·일·시 지지)
 * @returns 득지 여부
 *
 * @example
 * isDeukji(0, [2, 3, 0, 6])  // 甲일간, 寅卯子午 지지 → true
 * isDeukji(0, [8, 9, 6, 5])  // 甲일간, 申酉午巳 지지 → false
 */
export function isDeukji(
  stemIdx: StemIdx,
  branchIdxs: BranchIdx[],
): boolean {
  return branchIdxs.some((b) => tonggunStrength(stemIdx, b) !== 'NONE');
}

/**
 * 득지 상세 정보를 산출한다.
 *
 * 각 지지에 대해 통근 강도와 십이운성 기반 가중 점수를 계산한다.
 *
 * @param stemIdx    - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdxs - 사주 4지지 배열 [년지, 월지, 일지, 시지]
 * @returns 득지 상세 정보
 */
export function getDeukjiDetail(
  stemIdx: StemIdx,
  branchIdxs: BranchIdx[],
): DeukjiDetail {
  const positions: Array<'YEAR' | 'MONTH' | 'DAY' | 'HOUR'> =
    ['YEAR', 'MONTH', 'DAY', 'HOUR'];
  const positionWeights = [0.8, 1.0, 1.5, 1.0]; // 년·월·일·시 통근 위치 가중치

  const entries: TonggeunEntry[] = branchIdxs.map((b, i) => {
    const str = tonggunStrength(stemIdx, b);
    const strengthMultiplier = str === 'STRONG' ? 1.0 : str === 'WEAK' ? 0.5 : 0;
    const posWeight = positionWeights[i] ?? 1.0;
    return {
      branchIdx: b,
      position: positions[i] ?? 'YEAR',
      strength: str,
      sipiunseongScore: str !== 'NONE' ? 10 : 0, // 간이 점수 (상세는 sipiunseong 모듈 활용)
      weight: strengthMultiplier * posWeight,
    };
  });

  const totalScore = entries.reduce((sum, e) => sum + e.weight, 0);
  const rootCount = entries.filter((e) => e.strength !== 'NONE').length;

  return {
    entries,
    totalScore,
    rootCount,
    deukji: rootCount > 0,
  };
}

// ---------------------------------------------------------------------------
// 천간 득세(得勢) 판단
// ---------------------------------------------------------------------------

/**
 * 천간이 일간을 돕는지(비겁·인성) 판단한다.
 *
 * 비겁(比劫): 일간과 같은 오행
 * 인성(印星): 일간을 생하는 오행 (생 순서: 木→火→土→金→水→木)
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param stemIdx  - 판단할 천간 인덱스
 * @returns true이면 비겁 또는 인성
 *
 * @example
 * isSupportStem(0, 0)  // 甲일간 vs 甲 → true (비견)
 * isSupportStem(0, 8)  // 甲일간 vs 壬 → true (인성, 水生木)
 * isSupportStem(0, 2)  // 甲일간 vs 丙 → false (식신)
 */
export function isSupportStem(ilganIdx: StemIdx, stemIdx: StemIdx): boolean {
  const ilOh = OHHAENG_OF_STEM[((ilganIdx % 10) + 10) % 10]!;
  const stOh = OHHAENG_OF_STEM[((stemIdx  % 10) + 10) % 10]!;

  // 비겁: 같은 오행
  if (stOh === ilOh) return true;

  // 인성: 일간을 생하는 오행 = (일간 오행 인덱스 - 1 + 5) % 5
  // 생 순서: 木(0)→火(1)→土(2)→金(3)→水(4)→木(0)
  // 즉 水(4)가 木(0)을 생, 木(0)이 火(1)을 생, ...
  const inseongOh = (ilOh - 1 + 5) % 5;
  if (stOh === inseongOh) return true;

  return false;
}

/**
 * 천간이 일간을 소모시키는지(식상·재성·관성) 판단한다.
 *
 * 식상(食傷): 일간이 생하는 오행
 * 재성(財星): 일간이 극하는 오행
 * 관성(官星): 일간을 극하는 오행
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param stemIdx  - 판단할 천간 인덱스
 * @returns true이면 식상, 재성, 또는 관성
 */
export function isDrainStem(ilganIdx: StemIdx, stemIdx: StemIdx): boolean {
  return !isSupportStem(ilganIdx, stemIdx);
}

/**
 * 천간의 십신 분류를 반환한다 (간략 5분류).
 *
 * @param ilganIdx - 일간 인덱스
 * @param stemIdx  - 비교 천간 인덱스
 * @returns 'BIGEOP' | 'INSEONG' | 'SIKSANG' | 'JAESEONG' | 'GWANSEONG'
 */
export function stemRelationType(
  ilganIdx: StemIdx,
  stemIdx: StemIdx,
): 'BIGEOP' | 'INSEONG' | 'SIKSANG' | 'JAESEONG' | 'GWANSEONG' {
  const ilOh = OHHAENG_OF_STEM[((ilganIdx % 10) + 10) % 10]!;
  const stOh = OHHAENG_OF_STEM[((stemIdx  % 10) + 10) % 10]!;

  if (stOh === ilOh) return 'BIGEOP';

  const inseongOh = (ilOh - 1 + 5) % 5; // 나를 생하는
  if (stOh === inseongOh) return 'INSEONG';

  const siksangOh = (ilOh + 1) % 5; // 내가 생하는
  if (stOh === siksangOh) return 'SIKSANG';

  const jaeseongOh = (ilOh + 2) % 5; // 내가 극하는 (木→土: 0+2=2)
  if (stOh === jaeseongOh) return 'JAESEONG';

  return 'GWANSEONG'; // 나를 극하는
}

/**
 * 천간들에서 일간을 돕는 천간(비겁·인성)의 수를 계산한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param stems    - 다른 천간 인덱스 배열 (일간 제외, 최대 3개)
 * @returns 비겁·인성 수
 */
export function countSupportStems(ilganIdx: StemIdx, stems: StemIdx[]): number {
  return stems.filter((s) => isSupportStem(ilganIdx, s)).length;
}

/**
 * 일간이 득세(得勢)하는지 판단한다.
 *
 * 득세 조건: 년간·월간·시간 중 비겁·인성이 2개 이상인 경우.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param stems    - 다른 천간 배열 (년간·월간·시간, 일간 제외)
 * @returns 득세 여부
 *
 * @example
 * isDeukse(0, [1, 8, 9]) // 甲일간, 乙壬癸 천간 → true
 * isDeukse(0, [2, 3, 6]) // 甲일간, 丙丁庚 천간 → false
 */
export function isDeukse(ilganIdx: StemIdx, stems: StemIdx[]): boolean {
  return countSupportStems(ilganIdx, stems) >= 2;
}

// ---------------------------------------------------------------------------
// 일간별 특수 강약 판단
// ---------------------------------------------------------------------------

/**
 * 일간별 건록지(建祿地) 테이블
 *
 * 각 일간이 건록(建祿) — 즉 자기 오행이 가장 강한 지지 — 에 해당하는
 * 월지를 만나면 월령에서 자동으로 신강의 근거가 된다.
 *
 * 甲木은 寅月에 건록: 寅의 본기가 甲이므로 甲이 제 자리에 있는 것.
 * 乙木은 卯月에 건록: 卯의 본기가 乙이므로 乙이 왕지에 있는 것.
 * 丙火은 巳月에 건록: 巳의 본기가 丙.
 * 丁火은 午月에 건록: 午의 본기가 丁.
 * 戊土은 巳月에 건록: 火土同行 원칙에 의해 丙과 동일.
 * 己土은 午月에 건록: 火土同行 원칙에 의해 丁과 동일.
 * 庚金은 申月에 건록: 申의 본기가 庚.
 * 辛金은 酉月에 건록: 酉의 본기가 辛.
 * 壬水은 亥月에 건록: 亥의 본기가 壬.
 * 癸水은 子月에 건록: 子의 본기가 癸.
 */
export const ILGAN_GEONROK: Record<number, BranchIdx> = {
  0: 2,   // 甲 → 寅
  1: 3,   // 乙 → 卯
  2: 5,   // 丙 → 巳
  3: 6,   // 丁 → 午
  4: 5,   // 戊 → 巳 (화토동행)
  5: 6,   // 己 → 午 (화토동행)
  6: 8,   // 庚 → 申
  7: 9,   // 辛 → 酉
  8: 11,  // 壬 → 亥
  9: 0,   // 癸 → 子
};

/**
 * 일간별 양인지(羊刃地) 테이블
 *
 * 양인(羊刃)은 건록의 다음 지지로, 제왕(帝旺)에 해당한다.
 * 양인은 기운이 극에 달한 상태로, 과도한 강함의 위험을 내포한다.
 */
export const ILGAN_YANGIN: Record<number, BranchIdx> = {
  0: 3,   // 甲 → 卯 (건록 寅의 다음 지지에서 제왕)
  1: 2,   // 乙 → 寅 (음간 역행 기준)
  2: 6,   // 丙 → 午
  3: 5,   // 丁 → 巳
  4: 6,   // 戊 → 午 (화토동행)
  5: 5,   // 己 → 巳 (화토동행)
  6: 9,   // 庚 → 酉
  7: 8,   // 辛 → 申
  8: 0,   // 壬 → 子
  9: 11,  // 癸 → 亥
};

/**
 * 일간이 건록지(建祿地)에 있는지 확인한다.
 *
 * @param stemIdx   - 일간 인덱스
 * @param branchIdx - 지지 인덱스
 * @returns 건록지 여부
 */
export function isGeonrok(stemIdx: StemIdx, branchIdx: BranchIdx): boolean {
  const s = ((stemIdx % 10) + 10) % 10;
  const b = ((branchIdx % 12) + 12) % 12;
  return ILGAN_GEONROK[s] === b;
}

/**
 * 일간이 양인지(羊刃地)에 있는지 확인한다.
 *
 * @param stemIdx   - 일간 인덱스
 * @param branchIdx - 지지 인덱스
 * @returns 양인지 여부
 */
export function isYangin(stemIdx: StemIdx, branchIdx: BranchIdx): boolean {
  const s = ((stemIdx % 10) + 10) % 10;
  const b = ((branchIdx % 12) + 12) % 12;
  return ILGAN_YANGIN[s] === b;
}

// ---------------------------------------------------------------------------
// 전왕격·종격 이론 설명
// ---------------------------------------------------------------------------

/** 특수 격국(格局) 이론 설명 */
export const TEUKSU_GEOKGUK_THEORY = {
  /**
   * 전왕격(專旺格)
   *
   * 일간의 기운이 극단적으로 강하여 더 이상 극(剋)이 불필요한 격.
   * 사주에 비겁·인성이 압도적이고 관성·재성이 없거나 무력한 경우.
   *
   * 종류:
   *   - 곡직격(曲直格): 木일간 + 寅卯辰 또는 亥卯未
   *   - 염상격(炎上格): 火일간 + 寅午戌 또는 巳午未
   *   - 가색격(稼穡格): 土일간 + 辰戌丑未
   *   - 종혁격(從革格): 金일간 + 巳酉丑 또는 申酉戌
   *   - 윤하격(潤下格): 水일간 + 申子辰 또는 亥子丑
   */
  jeonwang:
    '전왕격(專旺格): 일간의 기운이 극단적으로 강하여 종(從)의 방향이 불필요한 격. ' +
    '비겁과 인성이 압도적이며, 관성·재성이 없거나 무력화된 경우. ' +
    '용신(用神)으로 비겁·인성을 쓰며, 관성·재성을 기(忌)한다.',
  /**
   * 종격(從格)
   *
   * 일간이 너무 약하여 사주의 강한 기운을 따라가는(從) 격.
   * 일간의 오행이 거의 없고, 하나의 오행이 압도적인 경우 성립한다.
   *
   * 종류:
   *   - 종재격(從財格): 財星이 압도적으로 강한 경우
   *   - 종살격(從殺格): 官殺이 압도적으로 강한 경우
   *   - 종아격(從兒格): 食傷이 압도적으로 강한 경우
   *   - 종강격(從强格): 비겁이 압도적이나 인성이 없는 경우
   *   - 종세격(從勢格): 여러 오행이 균등하게 강한 경우
   */
  jonggyeok:
    '종격(從格): 일간이 너무 약하여 사주의 강한 오행을 따라가는 격. ' +
    '일간의 통근이 전혀 없고, 비겁·인성이 극히 미약하며, ' +
    '종재격·종살격·종아격·종강격·종세격으로 세분된다. ' +
    '따라가는 오행을 용신으로 삼고, 일간 오행을 기한다.',
} as const;

// ---------------------------------------------------------------------------
// 종격(從格) 판단
// ---------------------------------------------------------------------------

/**
 * 종격(從格) 판단 조건
 *
 * 극강(極强) / 극약(極弱) 판단 기준과 진종(眞從) / 가종(假從) 구분.
 */
export const JONGGYEOK_CONDITIONS = {
  /**
   * 극약(極弱) → 종격 성립 조건
   *
   * 1. 일간이 월지에서 실령(失令)해야 한다 (왕상이 아닌 휴수사).
   * 2. 일간이 사주 4지지 어디에도 통근(通根)하지 않아야 한다.
   * 3. 천간에 비겁·인성이 없거나 있어도 합(合)으로 무력화되어야 한다.
   * 4. 사주의 한 가지 오행이 압도적으로 강해야 한다.
   */
  conditions: [
    '일간이 월령에서 실령(失令)해야 한다 — 왕(旺)·상(相)이 아닌 휴(休)·수(囚)·사(死).',
    '일간이 4지지 어디에도 통근(通根)하지 않아야 한다.',
    '천간에 비겁(比劫)이 없어야 한다 — 있어도 합거(合去)로 무력화.',
    '천간에 인성(印星)이 없어야 한다 — 있어도 합거로 무력화.',
    '사주 내 하나의 오행(또는 연관 오행)이 압도적으로 강해야 한다.',
  ],

  /**
   * 진종(眞從) 판단 기준
   *
   * 진종은 일간의 뿌리가 완전히 없는 경우로, 대운에서 비겁·인성이
   * 와도 종이 유지되는 안정적인 종격이다.
   */
  jinjongCriteria: [
    '일간과 같은 오행의 천간·지지가 사주에 완전히 없음.',
    '일간을 생하는 오행(인성)도 사주에 완전히 없음.',
    '지장간 여기(餘氣)에도 일간 오행의 흔적이 없음.',
    '일간이 공망(空亡)에 해당하면 종의 기세가 더 강해진다.',
  ],

  /**
   * 가종(假從) 판단 기준
   *
   * 가종은 일간에 미약한 뿌리가 남아 있으나, 사주 전체의 기세에
   * 의해 억눌려 종의 형태를 취하는 경우이다.
   * 대운에서 비겁·인성이 오면 종이 깨질 위험이 있다.
   */
  gajongCriteria: [
    '일간이 지장간 여기(餘氣)에 미약한 통근이 남아 있음.',
    '천간에 인성이 있으나 합거(合去)로 무력화된 상태.',
    '일간의 오행이 지지에 미약하게나마 존재하나 세력이 압도적으로 열세.',
    '대운에서 비겁·인성이 오면 종이 깨져 파격이 될 수 있음.',
  ],

  /**
   * 극강(極强) → 전왕격 성립 조건
   *
   * 전왕격(從旺格/專旺格)은 일간의 기운이 극도로 강하여
   * 오히려 강한 쪽을 따라가는 특수한 종격이다.
   */
  extremeStrongCriteria: [
    '일간이 월령에서 득령(得令)해야 한다 — 旺 또는 相.',
    '사주 4지지에 비겁·인성의 통근이 3개 이상.',
    '천간에 비겁·인성이 2개 이상.',
    '관성·재성·식상이 없거나 1개 이하이며 무력화되어 있음.',
    '지지에 방합(方合) 또는 삼합(三合)이 일간 오행으로 성립.',
  ],
} as const;

// ---------------------------------------------------------------------------
// 화격(化格) 판단
// ---------------------------------------------------------------------------

/**
 * 화격(化格) 판단 조건
 *
 * 합화(合化) 성립 여부와 진화(眞化) / 가화(假化) 구분.
 * 상세 합화 이론은 cheonganHap.ts를 참조한다.
 */
export const HWAGYEOK_CONDITIONS = {
  /**
   * 화격 성립 기본 조건
   */
  conditions: [
    '일간(日干)이 인접 천간과 천간합(天干合)을 이루어야 한다.',
    '월지(月支)가 합화 결과 오행의 기운을 강하게 지원해야 한다.',
    '사주 내에 합화 결과 오행을 극(克)하는 간지가 없어야 한다.',
    '일간의 본래 오행이 지지에 강한 통근을 갖고 있지 않아야 한다.',
    '합을 깨는 충(沖)이나 별도의 합이 개입하지 않아야 한다.',
  ],

  /**
   * 진화(眞化) 기준
   */
  jinhwaCriteria: [
    '합화 결과 오행이 월지에서 왕(旺) 또는 상(相)으로 지원받음.',
    '사주 전체가 화신(化神) 오행 중심으로 통일됨.',
    '일간의 본래 오행이 지지에 통근이 없음.',
    '화신을 극하는 오행이 사주에 없거나 무력화됨.',
  ],

  /**
   * 가화(假化) 기준
   */
  gahwaCriteria: [
    '합화 조건이 부분적으로 충족되었으나 완전하지 않음.',
    '일간의 본래 오행이 지지에 미약한 통근이 남아 있음.',
    '화신을 극하는 오행이 미약하게나마 존재.',
    '대운에서 본래 오행이 강해지면 합화가 깨질 수 있음.',
  ],
} as const;

// ---------------------------------------------------------------------------
// 격국과 강약의 관계
// ---------------------------------------------------------------------------

/**
 * 격국(格局)과 강약(强弱)의 관계
 *
 * 내격(內格 = 팔정격)과 외격(外格 = 종격·화격)에서
 * 강약이 갖는 의미가 다르다.
 */
export const GYEOKGUK_GANGNYAK_RELATION = {
  /**
   * 내격(內格)에서의 강약
   *
   * 팔정격(八正格)에서는 강약이 용신 선정의 핵심 근거이다.
   * 신강이면 설기·극하는 용신, 신약이면 생·비겁의 용신을 쓴다.
   */
  naegyeok:
    '내격(內格/八正格)에서 강약은 용신(用神) 선정의 핵심 근거이다. ' +
    '신강(身强)이면 식상(食傷)으로 설기하거나 관성(官星)으로 극하는 용신을 쓰고, ' +
    '신약(身弱)이면 인성(印星)으로 생하거나 비겁(比劫)으로 보강하는 용신을 쓴다. ' +
    '중화(中和)에 가까울수록 격국이 이상적이며 용신의 역할이 미세 조정이 된다.',

  /**
   * 외격(外格)에서의 강약
   *
   * 종격·화격 등 외격에서는 강약보다 기세(氣勢)가 더 중요하다.
   * 사주의 기운이 한 방향으로 흐르는 것을 순응(順應)하는 것이 핵심.
   */
  oegyeok:
    '외격(外格/從格·化格)에서는 강약(强弱)보다 기세(氣勢)가 핵심이다. ' +
    '사주의 기운이 한 방향으로 치우쳐 있을 때 그 흐름을 따라가는 것이 용신이다. ' +
    '종격에서는 종하는 대상 오행이 용신이며, 일간을 강화하는 오행은 오히려 기신이 된다. ' +
    '화격에서는 화신(化神)이 용신이며, 합화를 깨는 오행이 기신이다.',

  /**
   * 중화(中和) 상태의 판단 기준
   *
   * 중화(中和)란 신강도 신약도 아닌 균형 잡힌 상태를 말한다.
   * 사주 분석에서 가장 이상적인 상태로, 용신의 역할이 미세 조정이 된다.
   */
  junghwa:
    '중화(中和)란 득령·득지·득세의 총합 점수가 균형 범위 내에 있는 상태이다. ' +
    '아방(我方 = 비겁+인성)과 적방(敵方 = 식상+재성+관성)의 세력이 비슷할 때 성립. ' +
    '중화 사주는 격국이 맑고(淸) 용신의 역할이 정교하다. ' +
    '다만 완전한 중화는 극히 드물며, 대부분 약간의 편향이 있다. ' +
    '판단 기준: 아방과 적방의 세력 차이가 전체의 10% 이내일 때 중화로 본다.',
} as const;

// ---------------------------------------------------------------------------
// 종합 강약 판단 함수
// ---------------------------------------------------------------------------

/**
 * 일간의 종합 강약(强弱)을 판단한다.
 *
 * 판단 기준:
 *   득령·득지·득세 3항목 점수 합산:
 *   - 3항목 모두 충족 + 왕상 점수 4 이상 → EXTREME_STRONG (극강)
 *   - 3항목 모두 미충족 + 왕상 점수 0    → EXTREME_WEAK   (극약)
 *   - 2항목 이상 충족                    → STRONG         (신강)
 *   - 0항목 충족                         → WEAK           (신약)
 *   - 1항목 충족                         → BALANCED       (중화)
 *
 * @param ilganIdx    - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx    - 월지 인덱스 (0=子 ~ 11=亥)
 * @param allBranches - 사주 4지지 배열 (년·월·일·시 지지)
 * @param otherStems  - 일간 제외 천간 배열 (년간·월간·시간)
 * @returns GangnyakDetail
 *
 * @example
 * judgeGangnyak(0, 2, [2, 2, 3, 0], [1, 8, 9])
 * // 甲일간, 寅월, 지지=[寅寅卯子], 천간=[乙壬癸]
 * // 득령=true(旺), 득지=true(寅·卯통근), 득세=true → EXTREME_STRONG
 */
export function judgeGangnyak(
  ilganIdx:    StemIdx,
  woljiIdx:    BranchIdx,
  allBranches: BranchIdx[],
  otherStems:  StemIdx[],
): GangnyakDetail {
  // --- 득령 ---
  const wangsang    = getWangsang(ilganIdx, woljiIdx);
  const wsScore     = WANGSANG_SCORE[wangsang];
  const deukryeong  = isDeukryeong(ilganIdx, woljiIdx);
  const deukryeongDetail = getDeukryeongDetail(ilganIdx, woljiIdx);

  // --- 득지 ---
  const deukjiDetail = getDeukjiDetail(ilganIdx, allBranches);
  const deukji       = deukjiDetail.deukji;

  // --- 득세 ---
  const support     = countSupportStems(ilganIdx, otherStems);
  const deukse      = support >= 2;
  const drain       = otherStems.length - support;

  // --- 오행 세력 분포 ---
  const deukseDetail = computeDeukseDetail(ilganIdx, otherStems, allBranches);

  // --- 종합 점수 ---
  const score = (deukryeong ? 1 : 0) + (deukji ? 1 : 0) + (deukse ? 1 : 0);

  // --- 종합 강약 점수 (0~100, 50=중화) ---
  const total = deukseDetail.abangTotal + deukseDetail.jeokbangTotal;
  const totalScore = total > 0
    ? Math.round((deukseDetail.abangTotal / total) * 100)
    : 50;

  // --- 판단 ---
  let result: GangnyakResult;
  if (score === 3 && wsScore >= 4) {
    result = 'EXTREME_STRONG';
  } else if (score === 0 && wsScore === 0) {
    result = 'EXTREME_WEAK';
  } else if (score >= 2) {
    result = 'STRONG';
  } else if (score === 0) {
    result = 'WEAK';
  } else {
    result = 'BALANCED';
  }

  // --- 세부 유형 판단 ---
  let singangType: SingangType | undefined;
  let sinyakType: SinyakType | undefined;

  if (result === 'STRONG' || result === 'EXTREME_STRONG') {
    singangType = classifySingang(
      deukryeong, deukji, deukse, deukseDetail,
    );
  }
  if (result === 'WEAK' || result === 'EXTREME_WEAK') {
    sinyakType = classifySinyak(deukseDetail);
  }

  return {
    result,
    deukryeong,
    deukji,
    deukse,
    wangsang,
    wangsangScore: wsScore,
    supportCount:  support,
    drainCount:    drain,
    deukryeongDetail,
    deukjiDetail,
    deukseDetail,
    totalScore,
    singangType,
    sinyakType,
  };
}

// ---------------------------------------------------------------------------
// 내부 헬퍼: 득세 상세 산출
// ---------------------------------------------------------------------------

/**
 * 득세 상세 정보를 산출한다.
 *
 * 천간 + 지지(지장간 포함)의 오행별 세력을 합산하여
 * 아방(비겁+인성)과 적방(식상+재성+관성)의 세력을 비교한다.
 */
function computeDeukseDetail(
  ilganIdx: StemIdx,
  otherStems: StemIdx[],
  allBranches: BranchIdx[],
): DeukseDetail {
  const ilOh = OHHAENG_OF_STEM[((ilganIdx % 10) + 10) % 10]!;
  const inseongOh = (ilOh - 1 + 5) % 5;
  const siksangOh = (ilOh + 1) % 5;
  const jaeseongOh = (ilOh + 2) % 5;
  const gwanseongOh = (ilOh + 3) % 5;

  // 오행별 점수 누적
  const ohScores: number[] = [0, 0, 0, 0, 0]; // 木火土金水

  // 천간 점수 (일간 제외)
  for (const s of otherStems) {
    const oh = OHHAENG_OF_STEM[((s % 10) + 10) % 10]!;
    ohScores[oh] += 1.0;
  }

  // 지지 점수 (지장간 기반)
  for (const b of allBranches) {
    const idx = ((b % 12) + 12) % 12;
    const jj = BRANCH_JIJANGGAN[idx]!;
    const weights = jj.length === 1
      ? [1.0]
      : jj.length === 2
        ? [0.7, 0.3]
        : [0.6, 0.3, 0.1];

    for (let i = 0; i < jj.length; i++) {
      const stemOh = OHHAENG_OF_STEM[jj[i]!]!;
      ohScores[stemOh] += weights[i]!;
    }
  }

  const ELEMENTS: Element[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
  const distribution: OhhaengSeryeok[] = ELEMENTS.map((el, i) => ({
    element: el,
    cheonganScore: 0,
    jijiScore: 0,
    totalScore: ohScores[i]!,
  }));

  const bigeopScore = ohScores[ilOh]!;
  const inseongScore = ohScores[inseongOh]!;
  const siksangScore = ohScores[siksangOh]!;
  const jaeseongScore = ohScores[jaeseongOh]!;
  const gwanseongScore = ohScores[gwanseongOh]!;

  const abangTotal = bigeopScore + inseongScore;
  const jeokbangTotal = siksangScore + jaeseongScore + gwanseongScore;
  const deukse = abangTotal > jeokbangTotal;

  return {
    distribution,
    bigeopScore,
    inseongScore,
    siksangScore,
    jaeseongScore,
    gwanseongScore,
    abangTotal,
    jeokbangTotal,
    deukse,
  };
}

// ---------------------------------------------------------------------------
// 내부 헬퍼: 신강·신약 유형 분류
// ---------------------------------------------------------------------------

/**
 * 신강 유형을 분류한다.
 */
function classifySingang(
  deukryeong: boolean,
  deukji: boolean,
  deukse: boolean,
  detail: DeukseDetail,
): SingangType {
  // 인성이 비겁보다 강하면 인다신강
  if (detail.inseongScore > detail.bigeopScore) {
    return 'INDA_SINGANG';
  }

  // 비겁이 인성보다 강하면 비겁신강
  if (detail.bigeopScore > detail.inseongScore) {
    return 'BIGEOP_SINGANG';
  }

  // 월령 득령만으로 신강이면 월령신강
  if (deukryeong && !deukji && !deukse) {
    return 'WOLRYEONG_SINGANG';
  }

  return 'JONGHAP_SINGANG';
}

/**
 * 신약 유형을 분류한다.
 */
function classifySinyak(detail: DeukseDetail): SinyakType {
  const { jaeseongScore, gwanseongScore, siksangScore } = detail;

  // 가장 강한 적방 요소로 분류
  if (jaeseongScore >= gwanseongScore && jaeseongScore >= siksangScore) {
    return 'JAESEONGGWA_SINYAK';
  }
  if (gwanseongScore >= jaeseongScore && gwanseongScore >= siksangScore) {
    return 'GWANSAL_SINYAK';
  }
  if (siksangScore > jaeseongScore && siksangScore > gwanseongScore) {
    return 'SIKSANG_SINYAK';
  }

  return 'JONGHAP_SINYAK';
}

// ---------------------------------------------------------------------------
// 종격(從格) 판단 함수
// ---------------------------------------------------------------------------

/**
 * 종격(從格) 성립 여부를 판단한다.
 *
 * @param ilganIdx    - 일간 인덱스
 * @param woljiIdx    - 월지 인덱스
 * @param allBranches - 4지지 배열
 * @param otherStems  - 일간 제외 3천간 배열
 * @returns 종격 유형 또는 null (종격이 아닌 경우)
 */
export function judgeJonggyeok(
  ilganIdx:    StemIdx,
  woljiIdx:    BranchIdx,
  allBranches: BranchIdx[],
  otherStems:  StemIdx[],
): JonggyeokType | null {
  const gangnyak = judgeGangnyak(ilganIdx, woljiIdx, allBranches, otherStems);

  // --- 극강 → 전왕격 ---
  if (gangnyak.result === 'EXTREME_STRONG') {
    return 'JEONWANG';
  }

  // --- 극약 → 종격 (진종 또는 가종) ---
  if (gangnyak.result === 'EXTREME_WEAK') {
    // 진종: 통근이 완전히 없고 비겁·인성이 0개
    if (
      gangnyak.deukjiDetail.rootCount === 0 &&
      gangnyak.supportCount === 0
    ) {
      return 'JINJONG';
    }
    return 'GAJONG';
  }

  // --- 신약이나 통근이 극히 미약한 경우 ---
  if (
    gangnyak.result === 'WEAK' &&
    gangnyak.wangsangScore === 0 &&
    gangnyak.supportCount === 0 &&
    gangnyak.deukjiDetail.rootCount <= 1
  ) {
    // 가종 가능성 검토
    return 'GAJONG';
  }

  return null;
}

// ---------------------------------------------------------------------------
// 화격(化格) 판단 함수
// ---------------------------------------------------------------------------

/**
 * 화격(化格) 성립 가능성을 판단한다.
 *
 * 두 천간이 합(合) 관계이고, 합화 결과 오행이 월지에서 지원받는지 확인.
 * 상세 합화 판단은 cheonganHap.ts의 getHapResult()와 연계한다.
 *
 * @param ilganIdx     - 일간 인덱스
 * @param partnerIdx   - 합 상대 천간 인덱스 (월간 또는 시간)
 * @param woljiIdx     - 월지 인덱스
 * @param allBranches  - 4지지 배열
 * @param otherStems   - 일간 제외 3천간 배열
 * @returns 화격 유형 또는 null (화격이 아닌 경우)
 */
export function judgeHwagyeok(
  ilganIdx:    StemIdx,
  partnerIdx:  StemIdx,
  woljiIdx:    BranchIdx,
  allBranches: BranchIdx[],
  otherStems:  StemIdx[],
): HwagyeokType | null {
  // 합(合) 여부 확인: 두 천간의 인덱스 차이가 5이면 합
  const a = ((ilganIdx   % 10) + 10) % 10;
  const b = ((partnerIdx % 10) + 10) % 10;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo !== 5) return null; // 합이 아님

  // 합화 결과 오행 인덱스
  const hapResultOh = [2, 3, 4, 0, 1][lo]; // 甲己→土, 乙庚→金, 丙辛→水, 丁壬→木, 戊癸→火
  if (hapResultOh === undefined) return null;

  // 월지에서 합화 결과 오행의 왕상 확인
  const woljiOh = OHHAENG_OF_BRANCH[((woljiIdx % 12) + 12) % 12]!;
  const offset = ((hapResultOh - woljiOh) % 5 + 5) % 5;

  // 합화 오행이 월지에서 旺 또는 相이면 진화 가능
  if (offset === 0 || offset === 1) {
    // 추가 조건: 일간의 본래 오행이 통근 없는지 확인
    const ilganOh = OHHAENG_OF_STEM[a]!;
    const hasStrongRoot = allBranches.some((br) => {
      const brOh = OHHAENG_OF_BRANCH[((br % 12) + 12) % 12]!;
      return brOh === ilganOh;
    });

    // 원래 오행에 강한 통근이 없으면 진화, 있으면 가화
    return hasStrongRoot ? 'GAHWA' : 'JINHWA';
  }

  // 월지에서 休 이하이면 화격 불성립이나, 가화 가능성은 열어둠
  const gangnyak = judgeGangnyak(ilganIdx, woljiIdx, allBranches, otherStems);
  if (gangnyak.result === 'EXTREME_WEAK' || gangnyak.result === 'WEAK') {
    return 'GAHWA'; // 일간이 매우 약하면 가화 가능
  }

  return null;
}

// ---------------------------------------------------------------------------
// 일간별 특수 강약 판단 이론
// ---------------------------------------------------------------------------

/**
 * 일간별 특수 강약 특성 이론
 *
 * 각 일간은 오행 속성에 따라 강약 판단 시 특수한 고려가 필요하다.
 */
export const ILGAN_GANGNYAK_THEORY: Record<number, {
  /** 일간 한자 + 로마자 */
  name: string;
  /** 일간 오행 */
  element: Element;
  /** 건록지 설명 */
  geonrokDescription: string;
  /** 특수 강약 판단 기준 */
  specialCriteria: string[];
}> = {
  0: {
    name: '甲(GAP)',
    element: 'WOOD',
    geonrokDescription: '甲木은 寅月에 건록(建祿). 寅의 본기가 甲이므로 甲이 가장 강한 자리.',
    specialCriteria: [
      '甲木은 봄(寅卯月)에 가장 강하고, 가을(申酉月)에 가장 약하다.',
      '亥月(水月)에 장생(長生)하여 생(生)의 기운을 받으므로 신강 경향.',
      '甲木이 寅月에 있으면 자동으로 건록격(建祿格)이 된다.',
      '甲木이 卯月에 있으면 양인(羊刃)이 되어 기운이 극에 달한다.',
      '辰·戌·丑·未(土月)에서는 囚(수)의 상태로, 극을 시도하나 힘이 갇힌다.',
    ],
  },
  1: {
    name: '乙(EUL)',
    element: 'WOOD',
    geonrokDescription: '乙木은 卯月에 건록(建祿). 卯의 본기가 乙이므로 乙이 왕지(旺地)에 있는 것.',
    specialCriteria: [
      '乙木은 봄(寅卯月)에 가장 강하고, 가을(申酉月)에 가장 약하다.',
      '乙木은 음목(陰木)으로 갑목보다 유연하여 극에 대한 저항력이 다소 있다.',
      '乙木이 卯月에 있으면 건록격이 되고, 寅月에 있으면 양인이 된다.',
      '음간(陰干) 역행설에 의해 午에서 장생, 酉에서 건록 등 별도 운성 체계가 적용될 수 있다.',
    ],
  },
  2: {
    name: '丙(BYEONG)',
    element: 'FIRE',
    geonrokDescription: '丙火은 巳月에 건록. 巳의 본기가 丙이므로 丙이 건록지에 있는 것.',
    specialCriteria: [
      '丙火은 여름(巳午月)에 가장 강하고, 겨울(亥子月)에 가장 약하다.',
      '寅月(木月)에 장생하여 봄에도 상당한 기운을 유지한다.',
      '丙火이 巳月에 있으면 건록격, 午月에 있으면 양인이 된다.',
      '丙火은 태양의 불이므로 양(陽)의 기운이 강하여 음수(陰水)에 잘 꺼지지 않는다.',
    ],
  },
  3: {
    name: '丁(JEONG)',
    element: 'FIRE',
    geonrokDescription: '丁火은 午月에 건록. 午의 본기가 丁이므로 丁이 왕지에 있는 것.',
    specialCriteria: [
      '丁火은 여름(巳午月)에 가장 강하고, 겨울(亥子月)에 가장 약하다.',
      '丁火은 촛불의 불이므로 甲木(양목)을 만나면 빛이 빛나는(문명지상) 조합이 된다.',
      '丁火이 午月에 있으면 건록격, 巳月에 있으면 양인이 된다.',
    ],
  },
  4: {
    name: '戊(MU)',
    element: 'EARTH',
    geonrokDescription: '戊土은 巳月에 건록. 화토동행(火土同行) 원칙에 의해 丙과 동일한 건록지.',
    specialCriteria: [
      '戊土은 辰·戌·丑·未 土月에서 旺하고, 寅卯 木月에서 가장 약하다.',
      '화토동행(火土同行) 원칙: 戊土은 火와 같은 장생지(寅)를 사용한다.',
      '戊土은 큰 산(大山)의 흙이므로 두껍고 무겁다. 木의 극을 잘 받는다.',
      '巳月에 건록, 午月에 양인. 火氣가 강한 월에 유리하다.',
      '土는 四季(사계) 끝 辰戌丑未에서 왕하는 특수 오행이다.',
    ],
  },
  5: {
    name: '己(GI)',
    element: 'EARTH',
    geonrokDescription: '己土은 午月에 건록. 화토동행 원칙에 의해 丁과 동일한 건록지.',
    specialCriteria: [
      '己土은 辰·戌·丑·未 土月에서 旺하고, 寅卯 木月에서 가장 약하다.',
      '己土은 논밭의 흙(田園之土)이므로 부드럽고 가벼워 木의 극에 취약하다.',
      '午月에 건록, 巳月에 양인.',
      '己土은 음토(陰土)로서 습기(濕氣)를 함유하기 쉽다.',
    ],
  },
  6: {
    name: '庚(GYEONG)',
    element: 'METAL',
    geonrokDescription: '庚金은 申月에 건록. 申의 본기가 庚이므로 庚이 건록지에 있는 것.',
    specialCriteria: [
      '庚金은 가을(申酉月)에 가장 강하고, 여름(巳午月)에 가장 약하다.',
      '巳月에 장생하여 여름 초에도 일정한 기운이 있으나, 火의 극을 직접 받는다.',
      '庚金이 申月에 있으면 건록격, 酉月에 있으면 양인이 된다.',
      '庚金은 검(劍)·도끼의 금속이므로 강직하고 火로 단련(제련)을 거쳐야 쓸모가 있다.',
    ],
  },
  7: {
    name: '辛(SIN)',
    element: 'METAL',
    geonrokDescription: '辛金은 酉月에 건록. 酉의 본기가 辛이므로 辛이 왕지에 있는 것.',
    specialCriteria: [
      '辛金은 가을(申酉月)에 가장 강하고, 여름(巳午月)에 가장 약하다.',
      '辛金은 보석·장신구의 금속이므로 세밀하고 예리하다.',
      '辛金이 酉月에 있으면 건록격, 申月에 있으면 양인이 된다.',
      '辛金은 壬水를 만나면 금백수청(金白水淸)의 귀한 구조를 이룬다.',
    ],
  },
  8: {
    name: '壬(IM)',
    element: 'WATER',
    geonrokDescription: '壬水은 亥月에 건록. 亥의 본기가 壬이므로 壬이 건록지에 있는 것.',
    specialCriteria: [
      '壬水은 겨울(亥子月)에 가장 강하고, 여름 토월(辰戌丑未月)에서 가장 약하다.',
      '申月(金月)에 장생하여 가을에도 상당한 기운을 유지한다.',
      '壬水이 亥月에 있으면 건록격, 子月에 있으면 양인이 된다.',
      '壬水은 큰 강·바다의 물이므로 기세가 웅장하고 넓다.',
    ],
  },
  9: {
    name: '癸(GYE)',
    element: 'WATER',
    geonrokDescription: '癸水은 子月에 건록. 子의 본기가 癸이므로 癸가 왕지에 있는 것.',
    specialCriteria: [
      '癸水은 겨울(亥子月)에 가장 강하고, 여름 토월(辰戌丑未月)에서 가장 약하다.',
      '癸水은 이슬·빗물의 물이므로 양이 작고 고요하다.',
      '癸水이 子月에 있으면 건록격, 亥月에 있으면 양인이 된다.',
      '癸水은 음수(陰水)로서 인내력이 강하나 직접적 힘은 壬水보다 약하다.',
    ],
  },
};
