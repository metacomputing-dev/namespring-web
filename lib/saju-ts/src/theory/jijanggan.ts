/**
 * 지장간론(地藏干論) — 지지(地支) 속에 감춰진 천간(天干)
 *
 * 지장간(地藏干)이란 12지지 각각의 내부에 잠재되어 있는 천간의 기운을 말한다.
 * 지지는 겉으로 드러나는 하나의 글자이지만, 그 안에 여러 천간의 기운을 품고 있다.
 *
 * 역할 구분:
 * - 본기(本氣): 해당 지지의 주된 기운. 월령(月令)에서 가장 강하게 사령(司令)한다.
 * - 중기(中氣): 중간 기운. 본기 이전에 잠시 사령하는 기운.
 * - 여기(餘氣): 남은 기운. 전월(前月)에서 이어진 여운(餘韻).
 *
 * 사령(司令) 순서: 여기(餘氣) → 중기(中氣) → 본기(本氣)
 * — 절기가 바뀐 직후에는 이전 달의 기운(여기)이 먼저 남아 있다가
 *   점차 중기로, 마지막에 본기로 교체된다.
 *
 * 근거 문헌: 子平眞詮(자평진전), 三命通會(삼명통회), 命理探源(명리탐원)
 */

import type { StemIdx, BranchIdx } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 기본 타입
// ---------------------------------------------------------------------------

/**
 * 지장간 역할 구분
 *
 * - BONGI  = 本氣(본기): 지지의 주된 기운. 오행의 정기(正氣).
 * - JUNGGI = 中氣(중기): 중간 기운. 생지(生地)·묘지(墓地)에서만 나타난다.
 * - YEOGI  = 餘氣(여기): 남은 기운. 전월(前月)에서 이어진 잔류 기운.
 */
export type JijangganRole = 'BONGI' | 'JUNGGI' | 'YEOGI';

/**
 * 개별 지장간 항목
 *
 * 하나의 지지에 포함된 천간 하나의 정보를 담는다.
 */
export interface JijangganEntry {
  /** 천간 인덱스 (0=甲 ~ 9=癸) */
  stemIdx: StemIdx;
  /** 천간 로마자 표기 (예: 'GAP', 'EUL', ...) */
  stemName: string;
  /** 한자 표기 (예: '甲', '乙', ...) */
  stemHanja: string;
  /** 지장간 역할 (본기/중기/여기) */
  role: JijangganRole;
  /**
   * 사령(司令) 일수
   *
   * 한 달 30일 중 해당 기운이 주도권을 갖는 날수.
   * 모든 항목의 합이 30이 되도록 구성된다.
   */
  days: number;
}

/**
 * 지지 하나의 지장간 전체 데이터
 */
export interface JijiJijangganData {
  /** 지지 인덱스 (0=子 ~ 11=亥) */
  branchIdx: BranchIdx;
  /** 지지 로마자 표기 (예: 'JA', 'CHUK', ...) */
  branchName: string;
  /** 한자 표기 (예: '子', '丑', ...) */
  branchHanja: string;
  /**
   * 포함된 지장간 목록
   *
   * 사령 순서대로 정렬됨: 여기 → 중기 → 본기
   * (없는 항목은 생략됨)
   */
  stems: JijangganEntry[];
  /** 총 사령 일수 — 항상 30 */
  totalDays: number;
}

// ---------------------------------------------------------------------------
// 내부 상수: 천간 이름 테이블
// ---------------------------------------------------------------------------

/** 천간 로마자 이름 (인덱스 순) */
const STEM_NAMES: readonly string[] = [
  'GAP',    // 0  甲
  'EUL',    // 1  乙
  'BYEONG', // 2  丙
  'JEONG',  // 3  丁
  'MU',     // 4  戊
  'GI',     // 5  己
  'GYEONG', // 6  庚
  'SIN',    // 7  辛
  'IM',     // 8  壬
  'GYE',    // 9  癸
] as const;

/** 천간 한자 (인덱스 순) */
const STEM_HANJA_LIST: readonly string[] = [
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
] as const;

/** 지지 로마자 이름 (인덱스 순) */
const BRANCH_NAMES: readonly string[] = [
  'JA',   // 0  子
  'CHUK', // 1  丑
  'IN',   // 2  寅
  'MYO',  // 3  卯
  'JIN',  // 4  辰
  'SA',   // 5  巳
  'O',    // 6  午
  'MI',   // 7  未
  'SHIN', // 8  申
  'YU',   // 9  酉
  'SUL',  // 10 戌
  'HAE',  // 11 亥
] as const;

/** 지지 한자 (인덱스 순) */
const BRANCH_HANJA_LIST: readonly string[] = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
] as const;

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/**
 * 지장간 항목 생성 헬퍼
 *
 * @param stemIdx - 천간 인덱스
 * @param role    - 지장간 역할
 * @param days    - 사령 일수
 */
function entry(stemIdx: StemIdx, role: JijangganRole, days: number): JijangganEntry {
  return {
    stemIdx,
    stemName:  STEM_NAMES[stemIdx]      ?? '',
    stemHanja: STEM_HANJA_LIST[stemIdx] ?? '',
    role,
    days,
  };
}

/** 지지 데이터 생성 헬퍼 */
function branch(branchIdx: BranchIdx, stems: JijangganEntry[]): JijiJijangganData {
  return {
    branchIdx,
    branchName:  BRANCH_NAMES[branchIdx]      ?? '',
    branchHanja: BRANCH_HANJA_LIST[branchIdx] ?? '',
    stems,
    totalDays: 30,
  };
}

// ---------------------------------------------------------------------------
// 지장간 완전 테이블
// ---------------------------------------------------------------------------

/**
 * 완전한 지장간 테이블 (자평진전·삼명통회 기준)
 *
 * 12지지 × 최대 3개 지장간. 사령 순서: 여기 → 중기 → 본기.
 *
 * 지지 분류:
 * - 왕지(旺地) 4개: 子·卯·午·酉 — 오직 본기 하나만 있음 (순수한 기운)
 * - 생지(生地) 4개: 寅·巳·申·亥 — 여기+중기+본기 (戊는 여기로 포함, 亥는 甲 여기)
 * - 묘지(墓地/庫地) 4개: 辰·戌·丑·未 — 여기+중기+본기
 *
 * 천간 인덱스:
 * GAP=0, EUL=1, BYEONG=2, JEONG=3, MU=4, GI=5, GYEONG=6, SIN=7, IM=8, GYE=9
 *
 * @see 子平眞詮 (자평진전) — 沈孝瞻 著
 * @see 三命通會 (삼명통회) — 萬育吾 著
 */
export const JIJANGGAN_TABLE: JijiJijangganData[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 왕지(旺地) — 순수한 단일 기운
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 子(JA, 0) — 수왕지(水旺地)
   * 오직 癸水(GYE) 본기 하나. 순수한 水의 기운.
   * 11월(동짓달)로 水가 가장 왕성한 달.
   */
  branch(0, [
    entry(9, 'BONGI', 30), // 癸(GYE) 본기 30일
  ]),

  /**
   * 丑(CHUK, 1) — 금묘지(金墓地), 음토(陰土)
   * 여기: 癸水(GYE) 9일 — 子月 水氣의 여운
   * 중기: 辛金(SIN) 3일 — 丑에 내장된 金氣
   * 본기: 己土(GI) 18일 — 丑의 주기(主氣)
   *
   * 사고지(四庫地): 金의 창고(庫). 水의 여기(餘氣).
   */
  branch(1, [
    entry(9, 'YEOGI',  9),  // 癸(GYE) 여기  9일
    entry(7, 'JUNGGI', 3),  // 辛(SIN) 중기  3일
    entry(5, 'BONGI',  18), // 己(GI)  본기 18일
  ]),

  /**
   * 寅(IN, 2) — 목생지(木生地), 양목(陽木)
   * 여기: 戊土(MU) 7일 — 丑月 土氣의 여운
   * 중기: 丙火(BYEONG) 7일 — 寅에 내장된 火氣
   * 본기: 甲木(GAP) 16일 — 寅의 주기(主氣)
   *
   * 생지(生地): 木이 발생(發生)하는 곳. 봄의 시작.
   */
  branch(2, [
    entry(4, 'YEOGI',  7),  // 戊(MU)     여기  7일
    entry(2, 'JUNGGI', 7),  // 丙(BYEONG) 중기  7일
    entry(0, 'BONGI',  16), // 甲(GAP)    본기 16일
  ]),

  /**
   * 卯(MYO, 3) — 목왕지(木旺地), 음목(陰木)
   * 오직 乙木(EUL) 본기 하나. 순수한 木의 기운.
   * 2월(묘월)로 木이 가장 왕성한 달.
   */
  branch(3, [
    entry(1, 'BONGI', 30), // 乙(EUL) 본기 30일
  ]),

  /**
   * 辰(JIN, 4) — 수묘지(水墓地), 양토(陽土)
   * 여기: 乙木(EUL) 9일 — 卯月 木氣의 여운
   * 중기: 癸水(GYE) 3일 — 辰에 내장된 水氣
   * 본기: 戊土(MU) 18일 — 辰의 주기(主氣)
   *
   * 사고지(四庫地): 水의 창고(庫). 木의 여기(餘氣).
   */
  branch(4, [
    entry(1, 'YEOGI',  9),  // 乙(EUL) 여기  9일
    entry(9, 'JUNGGI', 3),  // 癸(GYE) 중기  3일
    entry(4, 'BONGI',  18), // 戊(MU)  본기 18일
  ]),

  /**
   * 巳(SA, 5) — 화생지(火生地), 음화(陰火)
   * 여기: 戊土(MU) 7일 — 辰月 土氣의 여운
   * 중기: 庚金(GYEONG) 7일 — 巳에 내장된 金氣
   * 본기: 丙火(BYEONG) 16일 — 巳의 주기(主氣)
   *
   * 생지(生地): 火가 발생(發生)하는 곳. 여름의 시작.
   */
  branch(5, [
    entry(4, 'YEOGI',  7),  // 戊(MU)      여기  7일
    entry(6, 'JUNGGI', 7),  // 庚(GYEONG)  중기  7일
    entry(2, 'BONGI',  16), // 丙(BYEONG)  본기 16일
  ]),

  /**
   * 午(O, 6) — 화왕지(火旺地), 양화(陽火)
   * 여기: 己土(GI) 9일 — 未를 향한 土氣의 예고
   * 본기: 丁火(JEONG) 21일 — 午의 주기(主氣)
   *
   * 주의: 午는 왕지이지만 己土 여기가 존재하는 특수한 경우.
   * 일부 문헌(삼명통회)에서는 丁21+己9=30으로, 己를 여기(餘氣) 또는
   * 공존(共存)으로 보기도 한다. 자평진전 기준으로 己9일·丁21일 적용.
   */
  branch(6, [
    entry(5, 'YEOGI', 9),  // 己(GI)    여기  9일
    entry(3, 'BONGI', 21), // 丁(JEONG) 본기 21일
  ]),

  /**
   * 未(MI, 7) — 목묘지(木墓地), 음토(陰土)
   * 여기: 丁火(JEONG) 9일 — 午月 火氣의 여운
   * 중기: 乙木(EUL) 3일 — 未에 내장된 木氣
   * 본기: 己土(GI) 18일 — 未의 주기(主氣)
   *
   * 사고지(四庫地): 木의 창고(庫). 火의 여기(餘氣).
   */
  branch(7, [
    entry(3, 'YEOGI',  9),  // 丁(JEONG) 여기  9일
    entry(1, 'JUNGGI', 3),  // 乙(EUL)   중기  3일
    entry(5, 'BONGI',  18), // 己(GI)    본기 18일
  ]),

  /**
   * 申(SHIN, 8) — 금생지(金生地), 양금(陽金)
   * 여기: 戊土(MU) 7일 — 未月 土氣의 여운
   * 중기: 壬水(IM) 7일 — 申에 내장된 水氣
   * 본기: 庚金(GYEONG) 16일 — 申의 주기(主氣)
   *
   * 생지(生地): 金이 발생(發生)하는 곳. 가을의 시작.
   */
  branch(8, [
    entry(4, 'YEOGI',  7),  // 戊(MU)     여기  7일
    entry(8, 'JUNGGI', 7),  // 壬(IM)     중기  7일
    entry(6, 'BONGI',  16), // 庚(GYEONG) 본기 16일
  ]),

  /**
   * 酉(YU, 9) — 금왕지(金旺地), 음금(陰金)
   * 오직 辛金(SIN) 본기 하나. 순수한 金의 기운.
   * 8월(유월)로 金이 가장 왕성한 달.
   */
  branch(9, [
    entry(7, 'BONGI', 30), // 辛(SIN) 본기 30일
  ]),

  /**
   * 戌(SUL, 10) — 화묘지(火墓地), 양토(陽土)
   * 여기: 辛金(SIN) 9일 — 酉月 金氣의 여운
   * 중기: 丁火(JEONG) 3일 — 戌에 내장된 火氣
   * 본기: 戊土(MU) 18일 — 戌의 주기(主氣)
   *
   * 사고지(四庫地): 火의 창고(庫). 金의 여기(餘氣).
   */
  branch(10, [
    entry(7, 'YEOGI',  9),  // 辛(SIN)   여기  9일
    entry(3, 'JUNGGI', 3),  // 丁(JEONG) 중기  3일
    entry(4, 'BONGI',  18), // 戊(MU)    본기 18일
  ]),

  /**
   * 亥(HAE, 11) — 수생지(水生地), 음수(陰水)
   * 여기: 甲木(GAP) 7일 — 亥에 내장된 木氣 (수생목의 예고)
   * 본기: 壬水(IM) 21일 — 亥의 주기(主氣)
   *
   * 생지(生地): 水가 발생(發生)하는 곳. 겨울의 시작.
   * 주의: 亥도 午처럼 2개 항목만 존재. 甲木 여기가 수생목(水生木)을 예고함.
   * 일부 문헌에서는 甲7+壬21=28, 나머지 2일은 戊로 보기도 하나,
   * 자평진전 기준 甲7·壬23 또는 甲7·壬21+戊2 등 학파마다 차이가 있다.
   * 본 구현은 자평진전 甲7·壬21 기준 적용 (총합 28일 → 실용상 壬+2일 포함 30일).
   * 실무에서는 壬23·甲7로 쓰기도 한다. 여기서는 壬21·甲7·(여백2) 방식 채택.
   */
  branch(11, [
    entry(0, 'YEOGI', 7),  // 甲(GAP) 여기  7일
    entry(8, 'BONGI', 23), // 壬(IM)  본기 23일 (21+조정 2일 포함)
  ]),
];

// ---------------------------------------------------------------------------
// 월령(月令) 인원용사(人元用事) 분야표
// ---------------------------------------------------------------------------

/**
 * 월령(月令) 인원용사(人元用事) 분야표
 *
 * 절기 교체 직후 지장간이 사령(司令)하는 순서와 일수를 나타낸다.
 * 사주 분석에서 월지(月支)의 지장간이 어떤 천간을 투출(透出)하느냐에 따라
 * 격국(格局)이 결정된다.
 *
 * 키: 지지 로마자 이름 (JA, CHUK, ...)
 */
export const WOLRYEONG_BUNNYA: Record<string, {
  /** 월 이름 (한국식 로마자) */
  month: string;
  /** 해당 지지 이름 */
  jijiName: string;
  /** 한자 */
  jijiHanja: string;
  /** 절기 이름 (한글) */
  jeolgi: string;
  /** 사령(司令) 중인 지장간 목록 (사령 순서대로) */
  stemsActive: Array<{
    /** 천간 이름 (로마자) */
    stemName: string;
    /** 천간 한자 */
    stemHanja: string;
    /** 사령 일수 */
    days: number;
    /** 사령 시점 절기 이름 */
    saelingjeol: string;
  }>;
}> = {
  // ── 1월 (寅月) ──────────────────────────────────────────────────────────
  IN: {
    month:     '1월(正月)',
    jijiName:  'IN',
    jijiHanja: '寅',
    jeolgi:    '입춘(立春)',
    stemsActive: [
      { stemName: 'MU',     stemHanja: '戊', days: 7,  saelingjeol: '입춘 초' },
      { stemName: 'BYEONG', stemHanja: '丙', days: 7,  saelingjeol: '입춘 중' },
      { stemName: 'GAP',    stemHanja: '甲', days: 16, saelingjeol: '입춘 후' },
    ],
  },
  // ── 2월 (卯月) ──────────────────────────────────────────────────────────
  MYO: {
    month:     '2월(二月)',
    jijiName:  'MYO',
    jijiHanja: '卯',
    jeolgi:    '경칩(驚蟄)',
    stemsActive: [
      { stemName: 'EUL', stemHanja: '乙', days: 30, saelingjeol: '경칩 전후' },
    ],
  },
  // ── 3월 (辰月) ──────────────────────────────────────────────────────────
  JIN: {
    month:     '3월(三月)',
    jijiName:  'JIN',
    jijiHanja: '辰',
    jeolgi:    '청명(淸明)',
    stemsActive: [
      { stemName: 'EUL', stemHanja: '乙', days: 9,  saelingjeol: '청명 초' },
      { stemName: 'GYE', stemHanja: '癸', days: 3,  saelingjeol: '청명 중' },
      { stemName: 'MU',  stemHanja: '戊', days: 18, saelingjeol: '청명 후' },
    ],
  },
  // ── 4월 (巳月) ──────────────────────────────────────────────────────────
  SA: {
    month:     '4월(四月)',
    jijiName:  'SA',
    jijiHanja: '巳',
    jeolgi:    '입하(立夏)',
    stemsActive: [
      { stemName: 'MU',     stemHanja: '戊', days: 7,  saelingjeol: '입하 초' },
      { stemName: 'GYEONG', stemHanja: '庚', days: 7,  saelingjeol: '입하 중' },
      { stemName: 'BYEONG', stemHanja: '丙', days: 16, saelingjeol: '입하 후' },
    ],
  },
  // ── 5월 (午月) ──────────────────────────────────────────────────────────
  O: {
    month:     '5월(五月)',
    jijiName:  'O',
    jijiHanja: '午',
    jeolgi:    '망종(芒種)',
    stemsActive: [
      { stemName: 'GI',    stemHanja: '己', days: 9,  saelingjeol: '망종 초' },
      { stemName: 'JEONG', stemHanja: '丁', days: 21, saelingjeol: '망종 후' },
    ],
  },
  // ── 6월 (未月) ──────────────────────────────────────────────────────────
  MI: {
    month:     '6월(六月)',
    jijiName:  'MI',
    jijiHanja: '未',
    jeolgi:    '소서(小暑)',
    stemsActive: [
      { stemName: 'JEONG', stemHanja: '丁', days: 9,  saelingjeol: '소서 초' },
      { stemName: 'EUL',   stemHanja: '乙', days: 3,  saelingjeol: '소서 중' },
      { stemName: 'GI',    stemHanja: '己', days: 18, saelingjeol: '소서 후' },
    ],
  },
  // ── 7월 (申月) ──────────────────────────────────────────────────────────
  SHIN: {
    month:     '7월(七月)',
    jijiName:  'SHIN',
    jijiHanja: '申',
    jeolgi:    '입추(立秋)',
    stemsActive: [
      { stemName: 'MU',     stemHanja: '戊', days: 7,  saelingjeol: '입추 초' },
      { stemName: 'IM',     stemHanja: '壬', days: 7,  saelingjeol: '입추 중' },
      { stemName: 'GYEONG', stemHanja: '庚', days: 16, saelingjeol: '입추 후' },
    ],
  },
  // ── 8월 (酉月) ──────────────────────────────────────────────────────────
  YU: {
    month:     '8월(八月)',
    jijiName:  'YU',
    jijiHanja: '酉',
    jeolgi:    '백로(白露)',
    stemsActive: [
      { stemName: 'SIN', stemHanja: '辛', days: 30, saelingjeol: '백로 전후' },
    ],
  },
  // ── 9월 (戌月) ──────────────────────────────────────────────────────────
  SUL: {
    month:     '9월(九月)',
    jijiName:  'SUL',
    jijiHanja: '戌',
    jeolgi:    '한로(寒露)',
    stemsActive: [
      { stemName: 'SIN',   stemHanja: '辛', days: 9,  saelingjeol: '한로 초' },
      { stemName: 'JEONG', stemHanja: '丁', days: 3,  saelingjeol: '한로 중' },
      { stemName: 'MU',    stemHanja: '戊', days: 18, saelingjeol: '한로 후' },
    ],
  },
  // ── 10월 (亥月) ─────────────────────────────────────────────────────────
  HAE: {
    month:     '10월(十月)',
    jijiName:  'HAE',
    jijiHanja: '亥',
    jeolgi:    '입동(立冬)',
    stemsActive: [
      { stemName: 'GAP', stemHanja: '甲', days: 7,  saelingjeol: '입동 초' },
      { stemName: 'IM',  stemHanja: '壬', days: 23, saelingjeol: '입동 후' },
    ],
  },
  // ── 11월 (子月) ─────────────────────────────────────────────────────────
  JA: {
    month:     '11월(十一月)',
    jijiName:  'JA',
    jijiHanja: '子',
    jeolgi:    '대설(大雪)',
    stemsActive: [
      { stemName: 'GYE', stemHanja: '癸', days: 30, saelingjeol: '대설 전후' },
    ],
  },
  // ── 12월 (丑月) ─────────────────────────────────────────────────────────
  CHUK: {
    month:     '12월(十二月)',
    jijiName:  'CHUK',
    jijiHanja: '丑',
    jeolgi:    '소한(小寒)',
    stemsActive: [
      { stemName: 'GYE', stemHanja: '癸', days: 9,  saelingjeol: '소한 초' },
      { stemName: 'SIN', stemHanja: '辛', days: 3,  saelingjeol: '소한 중' },
      { stemName: 'GI',  stemHanja: '己', days: 18, saelingjeol: '소한 후' },
    ],
  },
};

// ---------------------------------------------------------------------------
// 투출(透出) 이론
// ---------------------------------------------------------------------------

/**
 * 지장간 천간 투출(透出) 이론
 *
 * 투출(透出)이란 지지 속 지장간의 천간이 천간(天干) 자리에 그대로 나타나는 것을 말한다.
 * 투출된 천간은 지지의 기운을 더욱 강하게 발현시킨다.
 *
 * 예: 月支가 寅(IN)인데 天干에 甲(GAP)이 있으면
 *     → 甲이 寅의 본기(本氣)인 甲을 투출한 것 → 건록격(建祿格) 성립 가능
 */
export const TUCHUL_THEORY: {
  /** 투출 정의 */
  definition: string;
  /** 투출의 중요성 */
  importance: string;
  /** 투출 사례 */
  examples: Array<{
    /** 지지 이름 */
    branch: string;
    /** 투출 천간 이름 */
    stem: string;
    /** 의미 */
    meaning: string;
  }>;
} = {
  definition:
    '지장간(地藏干)의 천간이 해당 사주 구성에서 천간(天干) 자리에 동일하게 나타나는 현상. ' +
    '지지의 내기(內氣)가 겉으로 드러나 그 기운이 현실에서 작동하게 된다.',
  importance:
    '격국(格局) 성립의 핵심 조건. 월지(月支) 지장간 중 천간에 투출된 것이 있으면 ' +
    '해당 십신(十神)으로 격을 잡는다. ' +
    '투출 우선순위: 본기(本氣) > 중기(中氣) > 여기(餘氣). ' +
    '본기가 투출되면 가장 순수하고 강한 격국이 된다.',
  examples: [
    {
      branch:  'IN(寅) — 본기 甲',
      stem:    'GAP(甲)',
      meaning: '寅月에 甲이 천간에 투출 → 건록격(建祿格) 또는 비견격(比肩格) 성립',
    },
    {
      branch:  'SA(巳) — 본기 丙',
      stem:    'BYEONG(丙)',
      meaning: '巳月에 丙이 천간에 투출 → 양인격(陽刃格) 또는 정관격(正官格) 가능',
    },
    {
      branch:  'SHIN(申) — 중기 壬',
      stem:    'IM(壬)',
      meaning: '申月에 壬이 천간에 투출 → 임수(壬水) 식신(食神) 또는 편인(偏印)으로 격 성립',
    },
    {
      branch:  'HAE(亥) — 본기 壬',
      stem:    'IM(壬)',
      meaning: '亥月에 壬이 천간에 투출 → 편인격(偏印格) 또는 식신격 가능',
    },
    {
      branch:  'JIN(辰) — 중기 癸',
      stem:    'GYE(癸)',
      meaning: '辰月에 癸가 천간에 투출 → 정재격(正財格) 또는 인수격(印綬格) 가능',
    },
  ],
};

// ---------------------------------------------------------------------------
// 본기 우선 원칙
// ---------------------------------------------------------------------------

/**
 * 본기 우선(本氣優先) 원칙
 *
 * 지장간 중 본기(本氣)는 해당 지지의 주된 기운으로,
 * 격국 판단·통근 강도·오행 세력 계산에서 가장 먼저 고려된다.
 */
export const BONGI_PRIORITY: {
  /** 원칙 설명 */
  rule: string;
  /** 예외 사항 목록 */
  exceptions: string[];
} = {
  rule:
    '지장간의 본기(本氣)는 항상 우선적으로 고려한다. ' +
    '격국(格局) 결정 시 월지(月支)의 본기가 천간에 투출되었을 때 ' +
    '가장 강한 격국이 성립한다. ' +
    '통근(通根) 판단 시 본기에 통근한 경우가 가장 강한 뿌리(根)가 된다.',
  exceptions: [
    '본기가 합(合)으로 변질된 경우: 본기 천간이 합화(合化)되어 다른 오행으로 변하면 ' +
    '본기의 기능이 약해진다.',
    '월령(月令)에서 절기 진입 직후: 여기(餘氣)가 먼저 사령하므로 초기에는 ' +
    '여기를 우선 고려할 수 있다.',
    '왕지(旺地) 외에 격국이 없는 경우: 子·卯·午·酉의 왕지는 본기만 존재하므로 ' +
    '별도의 우선순위 판단이 불필요하다.',
    '특수격(從格·化格)의 경우: 사주 전체의 세력이 한쪽으로 치우쳐 있을 때는 ' +
    '본기 우선 원칙보다 전체 세력의 방향이 우선한다.',
  ],
};

// ---------------------------------------------------------------------------
// 통근(通根) 원칙
// ---------------------------------------------------------------------------

/**
 * 지장간 통근(通根) 원칙
 *
 * 통근(通根)이란 천간(天干)의 기운이 지지(地支) 속 지장간에 같은 오행이 있어
 * 뿌리를 내린 상태를 말한다. 통근한 천간은 힘이 강해진다.
 *
 * 통근 강도:
 * - 강(强): 본기(本氣)에 통근 — 지지의 주된 기운과 일치
 * - 약(弱): 중기(中氣) 또는 여기(餘氣)에 통근 — 보조적 뿌리
 * - 무근(無根): 지장간에 해당 천간 없음
 */
export const TOONGGEUN_RULES: {
  /** 통근 정의 */
  definition: string;
  /** 통근이 강한 경우 */
  strongRoots: string[];
  /** 통근이 약한 경우 */
  weakRoots: string[];
  /** 통근이 없는 경우 */
  noRoot: string[];
} = {
  definition:
    '천간(天干)이 지지(地支)의 지장간(地藏干) 중 동일한 오행의 천간을 만나 ' +
    '기운의 뿌리를 확보하는 것. 통근한 천간은 실질적인 힘을 갖는다.',
  strongRoots: [
    '본기(本氣) 통근: 천간이 지지의 본기와 동일한 경우 — 가장 강한 통근. ' +
    '예) 甲이 寅(甲본기)을 만나면 건록(建祿)으로 통근 최강.',
    '왕지(旺地) 통근: 子에 壬·癸, 卯에 甲·乙, 午에 丙·丁, 酉에 庚·辛 통근. ' +
    '왕지는 단일 기운이므로 통근이 순수하고 강하다.',
    '득지(得地): 일지(日支) 지장간에 일간(日干)이 통근한 경우. ' +
    '가장 가까운 뿌리로 힘이 강하다.',
  ],
  weakRoots: [
    '중기(中氣) 통근: 천간이 지지의 중기와 동일한 경우. ' +
    '본기보다 약하나 유효한 뿌리. 예) 壬이 申(壬중기)에 통근.',
    '여기(餘氣) 통근: 천간이 지지의 여기와 동일한 경우. ' +
    '가장 약한 통근이지만 없는 것보다는 낫다. 예) 乙이 辰(乙여기)에 통근.',
    '묘지(墓地) 통근: 천간이 辰·戌·丑·未의 지장간에 통근한 경우. ' +
    '기운이 창고 속에 갇혀 있어 발현이 약하다.',
  ],
  noRoot: [
    '해당 지지의 지장간 어디에도 동일하거나 같은 오행의 천간이 없는 경우.',
    '예) 甲木이 酉(辛본기)·子(癸본기)에서는 통근하지 못한다.',
    '합(合)으로 지장간이 변질된 경우: 지지합(地支合)으로 지장간의 오행이 ' +
    '다른 오행으로 화(化)하면 통근이 사라질 수 있다.',
  ],
};

// ---------------------------------------------------------------------------
// 사묘(四墓)지 설명
// ---------------------------------------------------------------------------

/**
 * 사묘(四墓)지 — 辰·戌·丑·未 (사고지/四庫地)
 *
 * 사묘지는 각 오행의 창고(庫)이자 무덤(墓)으로,
 * 戊·己 양토(陽土)·음토(陰土)가 본기를 점유하며
 * 각 오행의 에너지를 저장한다.
 *
 * 여기(餘氣)와 중기(中氣)를 통해 전 계절의 기운을 담고 있어
 * 매우 복잡한 성질을 지닌다.
 */
export const SAMU_BRANCHES: {
  /** 辰(JIN) — 수묘(水墓): 水를 저장. 木의 여기(乙)와 水의 중기(癸)를 품음 */
  JIN: string;
  /** 戌(SUL) — 화묘(火墓): 火를 저장. 金의 여기(辛)와 火의 중기(丁)를 품음 */
  SUL: string;
  /** 丑(CHUK) — 금묘(金墓): 金을 저장. 水의 여기(癸)와 金의 중기(辛)를 품음 */
  CHUK: string;
  /** 未(MI) — 목묘(木墓): 木을 저장. 火의 여기(丁)와 木의 중기(乙)를 품음 */
  MI: string;
} = {
  JIN:
    '辰(JIN) = 水墓(수묘). 봄의 끝에 위치하며 戊土 본기, 癸水 중기, 乙木 여기를 품는다. ' +
    '水가 辰에서 입묘(入墓)하여 창고에 저장된다. ' +
    '습토(濕土)로서 水氣를 함유하고 있어 水의 고(庫)라 한다.',
  SUL:
    '戌(SUL) = 火墓(화묘). 가을의 끝에 위치하며 戊土 본기, 丁火 중기, 辛金 여기를 품는다. ' +
    '火가 戌에서 입묘(入墓)하여 창고에 저장된다. ' +
    '조토(燥土)로서 火氣를 함유하고 있어 火의 고(庫)라 한다.',
  CHUK:
    '丑(CHUK) = 金墓(금묘). 겨울의 끝에 위치하며 己土 본기, 辛金 중기, 癸水 여기를 품는다. ' +
    '金이 丑에서 입묘(入墓)하여 창고에 저장된다. ' +
    '습토(濕土)로서 金氣를 함유하고 있어 金의 고(庫)라 한다.',
  MI:
    '未(MI) = 木墓(목묘). 여름의 끝에 위치하며 己土 본기, 乙木 중기, 丁火 여기를 품는다. ' +
    '木이 未에서 입묘(入墓)하여 창고에 저장된다. ' +
    '조토(燥土)로서 木氣를 함유하고 있어 木의 고(庫)라 한다.',
};

// ---------------------------------------------------------------------------
// 개고(開庫) 이론 — 사고지(四庫地) 특수 작용
// ---------------------------------------------------------------------------

/**
 * 개고(開庫) 이론
 *
 * 사고지(四庫地: 辰·戌·丑·未)는 오행의 창고(庫)이자 무덤(墓)으로,
 * 그 안에 저장된 기운은 특정 조건이 충족되어야 밖으로 나온다.
 * 이 조건을 개고(開庫, 창고를 여는 것)라 한다.
 *
 * 묘(墓)와 고(庫)의 구분:
 * - 묘(墓): 기운이 쇠약하여 묻힌 상태. 해당 오행이 약할 때 입묘하면 힘을 잃는다.
 * - 고(庫): 기운이 저장되어 있는 상태. 해당 오행이 강할 때 입고하면 보관의 의미.
 *
 * 같은 辰·戌·丑·未이지만 사주 전체의 세력 방향에 따라
 * 묘(갇힘)로 작용하기도 하고 고(저장)로 작용하기도 한다.
 */
export const GAEGO_THEORY: {
  /** 개고(開庫) 정의 */
  definition: string;
  /** 개고 조건 목록 */
  conditions: Array<{
    method: string;
    description: string;
    example: string;
  }>;
  /** 묘(墓) vs 고(庫) 구분 원칙 */
  myoVsGo: {
    myo: string;
    go: string;
  };
  /** 사고지별 개고 상세 */
  details: Array<{
    branch: string;
    hanja: string;
    storedElement: string;
    openedBy: string;
    effect: string;
  }>;
} = {
  definition:
    '개고(開庫)란 사고지(辰·戌·丑·未)에 저장된 오행의 기운이 ' +
    '특정 조건에 의해 밖으로 방출되는 현상이다. ' +
    '창고의 문이 열려야 안에 있는 기운이 사주에서 실질적으로 작용할 수 있다.',

  conditions: [
    {
      method: '충(沖)에 의한 개고',
      description:
        '사고지의 충(沖) 상대가 오면 창고가 열린다. 가장 강력한 개고 방법이다.',
      example:
        '辰과 戌이 충하면 辰의 水庫와 戌의 火庫가 모두 열려 저장된 기운이 발산된다. ' +
        '丑과 未가 충하면 丑의 金庫와 未의 木庫가 열린다.',
    },
    {
      method: '형(刑)에 의한 개고',
      description:
        '丑戌未 삼형(持勢之刑)이 모이면 세 토(土)가 서로 형하여 창고가 열린다.',
      example:
        '丑·戌·未 삼형이 성립하면 金庫(丑)·火庫(戌)·木庫(未)가 모두 개고되어 ' +
        '저장된 기운이 쏟아져 나온다. 매우 강력한 변동을 일으킨다.',
    },
    {
      method: '합(合)에 의한 개고',
      description:
        '삼합(三合)이 성립하면 해당 오행의 묘지(庫地)가 자연스럽게 열린다.',
      example:
        '申子辰 삼합 수국(水局)이 성립하면 辰(水庫)이 열려 水의 기운이 극대화된다. ' +
        '巳酉丑 금국(金局)이 성립하면 丑(金庫)이 열린다.',
    },
    {
      method: '투출(透出)에 의한 부분 개고',
      description:
        '사고지의 지장간 중기(中氣)가 천간에 투출되면 해당 기운이 부분적으로 발현된다.',
      example:
        '辰의 중기 癸가 천간에 투출되면 辰 속의 水氣가 부분적으로 작용한다. ' +
        '완전한 개고는 아니지만 해당 기운의 발현을 돕는다.',
    },
  ],

  myoVsGo: {
    myo:
      '묘(墓)의 경우: 해당 오행의 천간이 신약(身弱)하고 사고지에 들어가면 ' +
      '기운이 갇혀 더욱 약해진다. ' +
      '예) 壬水 일간이 신약한데 辰(水墓)을 만나면 水 기운이 묻혀 힘을 잃는다. ' +
      '이를 "입묘(入墓)하여 발동하지 못한다"고 한다.',
    go:
      '고(庫)의 경우: 해당 오행의 천간이 신강(身强)하고 사고지를 만나면 ' +
      '풍부한 기운을 저장하는 창고로 작용한다. ' +
      '예) 壬水 일간이 신강한데 辰(水庫)을 만나면 水의 기운이 풍부하게 비축된다. ' +
      '개고 조건이 충족되면 저장된 기운이 폭발적으로 발산된다.',
  },

  details: [
    {
      branch: 'JIN',
      hanja: '辰',
      storedElement: 'SU(水)',
      openedBy: '戌(SUL)과의 충, 또는 申子辰 삼합, 또는 丑戌未와 함께 형',
      effect: '水庫가 열리면 水의 기운이 대량 방출되어 水 오행이 매우 강해진다. ' +
              '壬·癸 천간의 힘이 급격히 증가하며 水 관련 십신의 작용이 극대화된다.',
    },
    {
      branch: 'SUL',
      hanja: '戌',
      storedElement: 'HWA(火)',
      openedBy: '辰(JIN)과의 충, 또는 寅午戌 삼합, 또는 丑未와 함께 형',
      effect: '火庫가 열리면 火의 기운이 대량 방출되어 火 오행이 매우 강해진다. ' +
              '丙·丁 천간의 힘이 급격히 증가하며 火 관련 십신의 작용이 극대화된다.',
    },
    {
      branch: 'CHUK',
      hanja: '丑',
      storedElement: 'GEUM(金)',
      openedBy: '未(MI)와의 충, 또는 巳酉丑 삼합, 또는 戌未와 함께 형',
      effect: '金庫가 열리면 金의 기운이 대량 방출되어 金 오행이 매우 강해진다. ' +
              '庚·辛 천간의 힘이 급격히 증가하며 金 관련 십신의 작용이 극대화된다.',
    },
    {
      branch: 'MI',
      hanja: '未',
      storedElement: 'MOK(木)',
      openedBy: '丑(CHUK)과의 충, 또는 亥卯未 삼합, 또는 丑戌과 함께 형',
      effect: '木庫가 열리면 木의 기운이 대량 방출되어 木 오행이 매우 강해진다. ' +
              '甲·乙 천간의 힘이 급격히 증가하며 木 관련 십신의 작용이 극대화된다.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 지장간의 십신(十神) 변환 이론
// ---------------------------------------------------------------------------

/**
 * 지장간의 십신(十神) 변환 이론
 *
 * 지장간을 십신(十神)으로 변환하면 사주의 내면적 성향과
 * 잠재된 인간관계·역량을 파악할 수 있다.
 *
 * 변환 방법:
 * 일간(日干)을 기준으로 지장간의 각 천간을 십신으로 변환한다.
 * 예) 일간이 甲(GAP)일 때:
 * - 寅의 지장간: 甲(비견)·丙(식신)·戊(편재)
 * - 子의 지장간: 癸(정인)
 * - 酉의 지장간: 辛(정관)
 */
export const JIJANGGAN_SIPSIN_THEORY: {
  /** 변환 원칙 */
  principle: string;
  /** 격국(格局) 판단에서의 역할 */
  gyeokgukRole: string;
  /** 월지 지장간의 특별한 의미 */
  woljiSignificance: string;
  /** 일지 지장간의 특별한 의미 */
  iljiSignificance: string;
  /** 변환 시 주의사항 */
  caveats: string[];
} = {
  principle:
    '지장간의 십신 변환은 일간(日干)을 "나"로 놓고, 지장간의 각 천간이 ' +
    '일간에 대해 어떤 십신(比肩·劫財·食神·傷官·偏財·正財·偏官·正官·偏印·正印)에 ' +
    '해당하는지를 판단하는 것이다. ' +
    '이를 통해 지지 속에 감춰진 인간관계, 재능, 성향을 읽을 수 있다.',

  gyeokgukRole:
    '격국(格局) 결정에서 월지(月支)의 지장간을 십신으로 변환하는 것이 핵심이다. ' +
    '월지 본기(本氣)의 십신이 천간에 투출(透出)되면 해당 십신으로 격국을 잡는다. ' +
    '본기가 투출되지 않으면 중기(中氣), 그다음 여기(餘氣) 순으로 격을 잡는다. ' +
    '투출된 십신이 없으면 월지 본기(本氣) 자체로 격을 잡는다.',

  woljiSignificance:
    '월지(月支)는 월령(月令)이라 하여 사주에서 가장 강한 기운의 원천이다. ' +
    '월지 지장간의 십신이 사주 전체의 격국과 용신(用神)을 좌우한다. ' +
    '월지 본기에 통근한 천간은 득령(得令)하여 매우 강한 힘을 갖는다.',

  iljiSignificance:
    '일지(日支)는 일간(日干) 바로 아래에 있어 가장 가까운 지지이다. ' +
    '일지 지장간의 십신은 배우자·가정·내면 성향을 나타낸다. ' +
    '일지의 본기 십신이 정재(正財)면 아내 복이 있고, ' +
    '정관(正官)이면 자녀·명예 복이 있는 식으로 해석한다.',

  caveats: [
    '지장간의 십신은 천간에 드러난 십신보다 잠재적(潛在的)이다. ' +
    '투출(透出)되지 않은 지장간의 십신은 속으로만 작용하며 겉으로 드러나지 않을 수 있다.',
    '합(合)·충(沖)·형(刑) 등 지지 관계에 의해 지장간의 십신이 변질되거나 ' +
    '약화될 수 있다. 특히 지지합(合)이 성립하면 지장간의 오행이 합화 결과 오행으로 ' +
    '변할 수 있어 십신도 달라진다.',
    '사고지(辰·戌·丑·未)의 지장간은 여러 오행을 품고 있어 ' +
    '복수의 십신이 내재한다. 어떤 십신이 우선하느냐는 투출·사령·격국 판단에 달려 있다.',
    '묘지(庫地)에 입묘(入墓)한 십신은 활동이 제한된다. ' +
    '예를 들어 정관(正官)이 묘지에 입묘하면 관직이 묻히는 형상으로 ' +
    '사회적 활동이 제약받을 수 있다.',
  ],
};

// ---------------------------------------------------------------------------
// 투출(透出) 판정 함수
// ---------------------------------------------------------------------------

/**
 * 특정 천간이 지지에서 투출(透出)되었는지 판정한다.
 *
 * 투출이란 지지의 지장간에 있는 천간이 사주의 천간(天干) 자리에
 * 동일하게 나타나는 것을 말한다. 투출된 천간은 지지의 기운을
 * 겉으로 발현시키며, 격국 판단의 핵심 근거가 된다.
 *
 * @param stemIdx   - 천간 인덱스 (0=甲 ~ 9=癸) — 사주 천간에 있는 간
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥) — 검사 대상 지지
 * @returns 투출 여부와 역할 정보. 투출이면 해당 JijangganEntry, 아니면 null
 *
 * @example
 * checkTuchul(0, 2)  // 甲(GAP)이 寅(IN)에서 투출? → { stemIdx: 0, role: 'BONGI', days: 16, ... }
 * checkTuchul(0, 9)  // 甲(GAP)이 酉(YU)에서 투출? → null (酉의 지장간에 甲 없음)
 */
export function checkTuchul(stemIdx: StemIdx, branchIdx: BranchIdx): JijangganEntry | null {
  const data = getJijanggan(branchIdx);
  return data.stems.find((s) => s.stemIdx === stemIdx) ?? null;
}

/**
 * 특정 지지의 지장간 중 사주 천간 배열에 투출된 항목들을 모두 반환한다.
 *
 * 사주의 네 천간(연간·월간·일간·시간) 중 해당 지지의 지장간에 있는 천간이
 * 하나라도 있으면 투출된 것이다.
 *
 * @param branchIdx     - 지지 인덱스 (0=子 ~ 11=亥)
 * @param cheonganArray - 사주의 천간 인덱스 배열 (예: [0, 5, 2, 9] = 甲·己·丙·癸)
 * @returns 투출된 지장간 항목 배열 (없으면 빈 배열)
 *
 * @example
 * findTuchulStems(2, [0, 5, 2, 9])
 * // 寅(IN)의 지장간: 甲(0)·丙(2)·戊(4)
 * // 천간 배열에 甲(0)과 丙(2)이 있으므로:
 * // → [{ stemIdx: 0, role: 'BONGI', ... }, { stemIdx: 2, role: 'JUNGGI', ... }]
 */
export function findTuchulStems(
  branchIdx: BranchIdx,
  cheonganArray: readonly StemIdx[],
): JijangganEntry[] {
  const data = getJijanggan(branchIdx);
  const cheonganSet = new Set(cheonganArray);
  return data.stems.filter((s) => cheonganSet.has(s.stemIdx));
}

// ---------------------------------------------------------------------------
// 조회 함수
// ---------------------------------------------------------------------------

/**
 * 지지 인덱스로 지장간 전체 데이터를 조회한다.
 *
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 해당 지지의 지장간 데이터
 * @throws Error 유효하지 않은 branchIdx인 경우
 *
 * @example
 * getJijanggan(2) // 寅(IN)의 지장간 데이터: 戊여기7·丙중기7·甲본기16
 */
export function getJijanggan(branchIdx: BranchIdx): JijiJijangganData {
  const idx = ((branchIdx % 12) + 12) % 12;
  const data = JIJANGGAN_TABLE[idx];
  if (data === undefined) {
    throw new Error(`유효하지 않은 지지 인덱스: ${branchIdx}`);
  }
  return data;
}

/**
 * 본기(本氣) 지장간 항목을 반환한다.
 *
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 본기 JijangganEntry
 * @throws Error 본기가 없는 경우 (이론상 모든 지지에 본기는 반드시 존재)
 *
 * @example
 * getBongi(0)  // 子의 본기: 癸(GYE) 30일
 * getBongi(2)  // 寅의 본기: 甲(GAP) 16일
 */
export function getBongi(branchIdx: BranchIdx): JijangganEntry {
  const data = getJijanggan(branchIdx);
  const bongi = data.stems.find((s) => s.role === 'BONGI');
  if (bongi === undefined) {
    throw new Error(`본기를 찾을 수 없음 — 지지: ${data.branchHanja}(${data.branchName})`);
  }
  return bongi;
}

/**
 * 중기(中氣) 지장간 항목을 반환한다.
 *
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 중기 JijangganEntry, 없으면 null
 *
 * @example
 * getJunggi(2)  // 寅의 중기: 丙(BYEONG) 7일
 * getJunggi(0)  // 子는 중기 없음 → null
 */
export function getJunggi(branchIdx: BranchIdx): JijangganEntry | null {
  const data = getJijanggan(branchIdx);
  return data.stems.find((s) => s.role === 'JUNGGI') ?? null;
}

/**
 * 여기(餘氣) 지장간 항목을 반환한다.
 *
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 여기 JijangganEntry, 없으면 null
 *
 * @example
 * getYeogi(2)   // 寅의 여기: 戊(MU) 7일
 * getYeogi(0)   // 子는 여기 없음 → null
 * getYeogi(3)   // 卯는 여기 없음 → null
 */
export function getYeogi(branchIdx: BranchIdx): JijangganEntry | null {
  const data = getJijanggan(branchIdx);
  return data.stems.find((s) => s.role === 'YEOGI') ?? null;
}

/**
 * 지지에 포함된 모든 지장간 항목을 반환한다.
 *
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 지장간 항목 배열 (사령 순서: 여기 → 중기 → 본기)
 *
 * @example
 * getAllStems(2)
 * // [
 * //   { stemIdx: 4, stemName: 'MU',     role: 'YEOGI',  days: 7  },
 * //   { stemIdx: 2, stemName: 'BYEONG', role: 'JUNGGI', days: 7  },
 * //   { stemIdx: 0, stemName: 'GAP',    role: 'BONGI',  days: 16 },
 * // ]
 */
export function getAllStems(branchIdx: BranchIdx): JijangganEntry[] {
  return getJijanggan(branchIdx).stems;
}

// ---------------------------------------------------------------------------
// 통근 판단 함수
// ---------------------------------------------------------------------------

/**
 * 천간이 특정 지지에 통근(通根)하는지 확인한다.
 *
 * 동일한 천간이 지장간에 포함되어 있으면 통근으로 판정한다.
 * (같은 오행의 음양이 다른 경우도 포함 — 예: 甲과 乙 모두 木으로 통근 가능)
 *
 * @param stemIdx   - 천간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 통근 여부 (true: 통근 있음)
 *
 * @example
 * hasRoot(0, 2)  // 甲(GAP)이 寅(IN)에 통근? → true (甲이 본기)
 * hasRoot(0, 3)  // 甲(GAP)이 卯(MYO)에 통근? → true (乙은 음목, 甲은 양목 — 동일 오행)
 * hasRoot(0, 9)  // 甲(GAP)이 酉(YU)에 통근? → false
 */
export function hasRoot(stemIdx: StemIdx, branchIdx: BranchIdx): boolean {
  return rootStrength(stemIdx, branchIdx) !== 'NONE';
}

/**
 * 천간이 특정 지지에 통근하는 강도를 반환한다.
 *
 * 판정 기준:
 * - STRONG: 지장간 본기(本氣)와 동일한 천간인 경우
 * - WEAK:   지장간 중기(中氣) 또는 여기(餘氣)와 동일한 천간인 경우
 * - NONE:   지장간 어디에도 동일한 천간이 없는 경우
 *
 * 주의: 동일 천간(예: 甲=甲) 기준으로 판정하며,
 *       음양 교차(甲↔乙, 丙↔丁 등)는 약통근(弱通根)으로 처리한다.
 *       음양 무관 동일 오행 통근은 아래 로직에 포함되어 있다.
 *
 * @param stemIdx   - 천간 인덱스 (0=甲 ~ 9=癸)
 * @param branchIdx - 지지 인덱스 (0=子 ~ 11=亥)
 * @returns 'STRONG' | 'WEAK' | 'NONE'
 *
 * @example
 * rootStrength(0, 2)  // 甲이 寅(甲본기) → 'STRONG'
 * rootStrength(0, 11) // 甲이 亥(甲여기) → 'WEAK'
 * rootStrength(0, 9)  // 甲이 酉 → 'NONE'
 * rootStrength(2, 5)  // 丙이 巳(丙본기) → 'STRONG'
 * rootStrength(8, 8)  // 壬이 申(壬중기) → 'WEAK'
 */
export function rootStrength(
  stemIdx: StemIdx,
  branchIdx: BranchIdx,
): 'STRONG' | 'WEAK' | 'NONE' {
  const data = getJijanggan(branchIdx);

  // 완전 동일 천간 기준 우선 검색
  for (const s of data.stems) {
    if (s.stemIdx === stemIdx) {
      return s.role === 'BONGI' ? 'STRONG' : 'WEAK';
    }
  }

  // 동일 오행 음양 교차 통근 (약통근)
  // 천간 오행 쌍: (甲0↔乙1), (丙2↔丁3), (戊4↔己5), (庚6↔辛7), (壬8↔癸9)
  const pairIdx = stemIdx % 2 === 0 ? stemIdx + 1 : stemIdx - 1;
  for (const s of data.stems) {
    if (s.stemIdx === pairIdx) {
      // 같은 오행 이종(異種) 음양 통근 → 약통근(WEAK)
      return 'WEAK';
    }
  }

  return 'NONE';
}
