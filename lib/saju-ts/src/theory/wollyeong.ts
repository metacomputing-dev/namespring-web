/**
 * 월령론(月令論) — 월지(月支)가 사주에서 갖는 특별한 의미
 *
 * 월령(月令)이란 사주(四柱)에서 월지(月支)가 갖는 특별한 권능(權能)을 가리킨다.
 * 월지는 사주 8자(年月日時 x 干支) 중에서 가장 강력한 영향력을 가지며,
 * 격국(格局)의 결정, 일간(日干) 강약(强弱) 판단, 용신(用神) 선정의
 * 근거가 되는 핵심 기준이다.
 *
 * 월령의 주요 역할:
 *   1. 격국(格局) 결정: 월지의 지장간(藏干)이 천간(天干)에 투출(透出)하면
 *      해당 십신(十神)을 격으로 취한다.
 *   2. 일간 강약 판단: 월령 득령(得令) 여부가 신강신약의 가장 큰 지표.
 *   3. 사령(司令): 월지에서 현재 사령 중인 지장간 천간이 가장 강한 힘을 가진다.
 *   4. 조후(調候): 계절에 따른 한난조습(寒暖燥濕)의 기준.
 *   5. 용사(用事): 절기 후 경과 일수에 따라 어떤 지장간이 힘을 행사하는지 결정.
 *
 * 근거 문헌: 子平眞詮(자평진전), 三命通會(삼명통회), 淵海子平(연해자평),
 *            窮通寶鑑(궁통보감)
 */

import type { StemIdx, BranchIdx } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 지지·천간 상수 (본 파일에서 사용하는 식별자)
// ---------------------------------------------------------------------------

/**
 * 지지(地支) 인덱스 상수
 *
 * 月令論에서 자주 참조하는 지지를 이름으로 접근할 수 있도록 한다.
 */
export const BRANCH = {
  JA:   0,  // 子
  CHUK: 1,  // 丑
  IN:   2,  // 寅
  MYO:  3,  // 卯
  JIN:  4,  // 辰
  SA:   5,  // 巳
  O:    6,  // 午
  MI:   7,  // 未
  SHIN: 8,  // 申
  YU:   9,  // 酉
  SUL:  10, // 戌
  HAE:  11, // 亥
} as const;

/**
 * 천간(天干) 인덱스 상수
 *
 * 月令論에서 자주 참조하는 천간을 이름으로 접근할 수 있도록 한다.
 */
export const STEM = {
  GAP:    0, // 甲
  EUL:    1, // 乙
  BYEONG: 2, // 丙
  JEONG:  3, // 丁
  MU:     4, // 戊
  GI:     5, // 己
  GYEONG: 6, // 庚
  SIN:    7, // 辛
  IM:     8, // 壬
  GYE:    9, // 癸
} as const;

/** 천간 한자 이름 (인덱스 순) */
const STEM_HANJA_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

/** 천간 로마자 이름 (인덱스 순) */
const STEM_ROMA_NAMES = [
  'GAP', 'EUL', 'BYEONG', 'JEONG', 'MU',
  'GI', 'GYEONG', 'SIN', 'IM', 'GYE',
] as const;

/** 지지 한자 이름 (인덱스 순) */
const BRANCH_HANJA_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

// ---------------------------------------------------------------------------
// 월령(月令) 정의 및 중요성
// ---------------------------------------------------------------------------

/**
 * 월령(月令)의 정의와 중요성
 *
 * 자평진전(子平眞詮)에서 월령의 지위:
 *   "用神專取月令(용신전취월령)"
 *   — 용신은 오로지 월령에서 취한다.
 *   월령은 사주의 강령(綱領)이며, 격국 결정의 제1 근거이다.
 */
export const WOLRYEONG_DEFINITION = {
  /**
   * 월령의 정의
   *
   * 월지(月支)가 사주 내에서 가지는 특별한 권한과 위치.
   * 월지는 오행의 계절적 성쇠를 반영하며,
   * 해당 달의 기운을 대표하는 지장간(藏干)을 통해 사주 전체에 영향을 미친다.
   */
  definition:
    '월령(月令)이란 월지(月支)가 사주에서 갖는 특별한 권능이다. ' +
    '월지는 현재 계절의 기운을 가장 강하게 반영하며, ' +
    '사주 8자 중 가장 강한 영향력을 가진다. ' +
    '자평진전(子平眞詮)에서는 용신(用神)을 오로지 월령에서 취한다고 하였다.',
  /**
   * 월령의 5대 역할
   */
  roles: [
    '격국(格局) 결정: 월지 지장간의 천간 투출(透出)이 격국을 결정한다.',
    '강약(强弱) 판단: 일간의 월령 득령(得令) 여부가 신강신약 판단의 핵심이다.',
    '사령(司令) 판단: 절기(節氣) 이후 경과 일수에 따라 사령 중인 지장간이 결정된다.',
    '조후(調候) 기준: 월령이 결정하는 계절의 한난조습이 조후용신의 근거가 된다.',
    '용사(用事) 판단: 현재 힘을 행사하는 지장간이 격국과 용신의 실질적 주인공이다.',
  ],
  /**
   * 월령의 중요성 — 자평진전 원문 발췌
   *
   * "月令乃提綱之府(월령내제강지부)"
   * — 월령은 사주의 제강(提綱, 벼리)이 집중된 곳이다.
   */
  importance:
    '자평진전(子平眞詮): 月令乃提綱之府(월령내제강지부). ' +
    '월령은 사주의 모든 기운이 귀결되는 핵심이다. ' +
    '月令이 같으면 비슷한 유형의 사주가 되고, ' +
    '月令이 다르면 전혀 다른 성질의 사주가 된다.',
} as const;

// ---------------------------------------------------------------------------
// 절기(節氣)와 월령의 관계
// ---------------------------------------------------------------------------

/**
 * 절기(節氣)와 월지(月支) 대응 테이블
 *
 * 사주에서 월(月)은 양력 달이 아닌 절기(節氣)를 기준으로 결정된다.
 * 각 절기의 시작(入節)부터 다음 절기 이전까지가 해당 월에 해당한다.
 *
 * 절기 번호는 1월(寅月, 입춘)을 1번으로 하여 12월(丑月, 소한)을 12번으로 한다.
 *
 * 12절(十二節) 기준 (중기 제외, 절만 사용):
 *   1월 寅(IN):   입춘(立春) — 봄의 시작
 *   2월 卯(MYO):  경칩(驚蟄) — 봄 중
 *   3월 辰(JIN):  청명(淸明) — 봄 끝
 *   4월 巳(SA):   입하(立夏) — 여름 시작
 *   5월 午(O):    망종(芒種) — 여름 중
 *   6월 未(MI):   소서(小暑) — 여름 끝
 *   7월 申(SHIN): 입추(立秋) — 가을 시작
 *   8월 酉(YU):   백로(白露) — 가을 중
 *   9월 戌(SUL):  한로(寒露) — 가을 끝
 *  10월 亥(HAE):  입동(立冬) — 겨울 시작
 *  11월 子(JA):   대설(大雪) — 겨울 중
 *  12월 丑(CHUK): 소한(小寒) — 겨울 끝
 */
export interface JeolgiWollyeong {
  /** 월 번호 (1=寅月=입춘 기준) */
  monthNum: number;
  /** 지지 인덱스 */
  branchIdx: BranchIdx;
  /** 지지 로마자 */
  branchName: string;
  /** 지지 한자 */
  branchHanja: string;
  /** 절기 이름 (한글) */
  jeolgiName: string;
  /** 절기 한자 */
  jeolgiHanja: string;
  /** 계절 */
  gyejeol: string;
  /** 이 달의 오행 특성 설명 */
  description: string;
}

/** 절기와 월지 대응 테이블 (1월=寅月=입춘 기준) */
export const JEOLGI_WOLLYEONG: JeolgiWollyeong[] = [
  {
    monthNum: 1, branchIdx: 2, branchName: "IN",
    branchHanja: "寅", jeolgiName: "입춘", jeolgiHanja: "立春",
    gyejeol: "봄 시작",
    description: "寅月(인월): 봄이 시작되는 달. 木기운이 발생(發生)한다. 甲木이 본기.",
  },
  {
    monthNum: 2, branchIdx: 3, branchName: "MYO",
    branchHanja: "卯", jeolgiName: "경칩", jeolgiHanja: "驚蟄",
    gyejeol: "봄 중",
    description: "卯月(묘월): 목기운이 최고조에 달하는 달. 乙木 본기만 존재.",
  },
  {
    monthNum: 3, branchIdx: 4, branchName: "JIN",
    branchHanja: "辰", jeolgiName: "청명", jeolgiHanja: "淸明",
    gyejeol: "봄 끝",
    description: "辰月(진월): 봄이 마무리되는 토왕지절(土旺之節). 水의 창고.",
  },
  {
    monthNum: 4, branchIdx: 5, branchName: "SA",
    branchHanja: "巳", jeolgiName: "입하", jeolgiHanja: "立夏",
    gyejeol: "여름 시작",
    description: "巳月(사월): 여름이 시작되는 달. 火기운이 발생한다. 丙火가 본기.",
  },
  {
    monthNum: 5, branchIdx: 6, branchName: "O",
    branchHanja: "午", jeolgiName: "망종", jeolgiHanja: "芒種",
    gyejeol: "여름 중",
    description: "午月(오월): 화기운이 최고조에 달하는 달. 丁火 본기, 己土 여기.",
  },
  {
    monthNum: 6, branchIdx: 7, branchName: "MI",
    branchHanja: "未", jeolgiName: "소서", jeolgiHanja: "小暑",
    gyejeol: "여름 끝",
    description: "未月(미월): 여름이 마무리되는 토왕지절. 木의 창고.",
  },
  {
    monthNum: 7, branchIdx: 8, branchName: "SHIN",
    branchHanja: "申", jeolgiName: "입추", jeolgiHanja: "立秋",
    gyejeol: "가을 시작",
    description: "申月(신월): 가을이 시작되는 달. 金기운이 발생한다. 庚金이 본기.",
  },
  {
    monthNum: 8, branchIdx: 9, branchName: "YU",
    branchHanja: "酉", jeolgiName: "백로", jeolgiHanja: "白露",
    gyejeol: "가을 중",
    description: "酉月(유월): 금기운이 최고조에 달하는 달. 辛金 본기만 존재.",
  },
  {
    monthNum: 9, branchIdx: 10, branchName: "SUL",
    branchHanja: "戌", jeolgiName: "한로", jeolgiHanja: "寒露",
    gyejeol: "가을 끝",
    description: "戌月(술월): 가을이 마무리되는 토왕지절. 火의 창고.",
  },
  {
    monthNum: 10, branchIdx: 11, branchName: "HAE",
    branchHanja: "亥", jeolgiName: "입동", jeolgiHanja: "立冬",
    gyejeol: "겨울 시작",
    description: "亥月(해월): 겨울이 시작되는 달. 水기운이 발생한다. 壬水가 본기.",
  },
  {
    monthNum: 11, branchIdx: 0, branchName: "JA",
    branchHanja: "子", jeolgiName: "대설", jeolgiHanja: "大雪",
    gyejeol: "겨울 중",
    description: "子月(자월): 수기운이 최고조에 달하는 달. 癸水 본기만 존재.",
  },
  {
    monthNum: 12, branchIdx: 1, branchName: "CHUK",
    branchHanja: "丑", jeolgiName: "소한", jeolgiHanja: "小寒",
    gyejeol: "겨울 끝",
    description: "丑月(축월): 겨울이 마무리되는 토왕지절. 金의 창고.",
  },
];

// ---------------------------------------------------------------------------
// 24절기(二十四節氣) 완전 테이블
// ---------------------------------------------------------------------------

/**
 * 24절기 항목
 *
 * 24절기는 12절(節)과 12중(中)으로 나뉜다.
 * - 절(節): 월이 바뀌는 기준. 사주 월주(月柱) 결정에 사용.
 * - 중(中, 중기): 절과 절 사이의 절기. 월 결정에는 사용하지 않으나
 *   조후(調候) 판단과 농경력에서 중요.
 *
 * 양력 기준 대략적 날짜(연도마다 1~2일 차이 가능)를 수록한다.
 */
export interface Jeolgi24Entry {
  /** 절기 순번 (1~24, 입춘 기준) */
  order: number;
  /** 절기 이름 (한글) */
  name: string;
  /** 절기 한자 */
  hanja: string;
  /** 절(節)/중(中) 구분 */
  type: 'JEOL' | 'JUNG';
  /** 해당 월지 인덱스 (절 기준, 중기는 소속 월의 지지) */
  branchIdx: BranchIdx;
  /** 양력 대략 시작일 (월-일) */
  approxDate: string;
  /** 태양 황경(도) */
  solarLongitude: number;
  /** 설명 */
  description: string;
}

/**
 * 24절기 완전 테이블
 *
 * 입춘(立春)부터 시작하여 대한(大寒)까지 24절기를 순서대로 수록한다.
 * 절(節)은 사주 월주 교체 기준이 되고, 중(中)은 그 사이의 절기이다.
 *
 * 태양 황경(Solar Longitude):
 *   입춘=315도부터 15도 간격으로 증가하여 대한=300도.
 */
export const JEOLGI_24_TABLE: Jeolgi24Entry[] = [
  // ── 1월 寅月 (봄 시작) ─────────────────────────────────────────────────
  { order: 1,  name: '입춘', hanja: '立春', type: 'JEOL', branchIdx: 2,  approxDate: '02-04', solarLongitude: 315, description: '봄의 시작. 寅月 입절(入節). 사주 1월이 시작된다.' },
  { order: 2,  name: '우수', hanja: '雨水', type: 'JUNG', branchIdx: 2,  approxDate: '02-19', solarLongitude: 330, description: '눈이 녹아 비가 되는 시기. 寅月 중기(中氣).' },
  // ── 2월 卯月 (봄 중) ───────────────────────────────────────────────────
  { order: 3,  name: '경칩', hanja: '驚蟄', type: 'JEOL', branchIdx: 3,  approxDate: '03-06', solarLongitude: 345, description: '개구리가 겨울잠에서 깨어남. 卯月 입절.' },
  { order: 4,  name: '춘분', hanja: '春分', type: 'JUNG', branchIdx: 3,  approxDate: '03-21', solarLongitude: 0,   description: '낮과 밤의 길이가 같아짐. 卯月 중기.' },
  // ── 3월 辰月 (봄 끝) ───────────────────────────────────────────────────
  { order: 5,  name: '청명', hanja: '淸明', type: 'JEOL', branchIdx: 4,  approxDate: '04-05', solarLongitude: 15,  description: '하늘이 맑고 밝아짐. 辰月 입절.' },
  { order: 6,  name: '곡우', hanja: '穀雨', type: 'JUNG', branchIdx: 4,  approxDate: '04-20', solarLongitude: 30,  description: '곡식에 필요한 비가 내림. 辰月 중기.' },
  // ── 4월 巳月 (여름 시작) ────────────────────────────────────────────────
  { order: 7,  name: '입하', hanja: '立夏', type: 'JEOL', branchIdx: 5,  approxDate: '05-06', solarLongitude: 45,  description: '여름의 시작. 巳月 입절.' },
  { order: 8,  name: '소만', hanja: '小滿', type: 'JUNG', branchIdx: 5,  approxDate: '05-21', solarLongitude: 60,  description: '곡식이 차오르기 시작함. 巳月 중기.' },
  // ── 5월 午月 (여름 중) ──────────────────────────────────────────────────
  { order: 9,  name: '망종', hanja: '芒種', type: 'JEOL', branchIdx: 6,  approxDate: '06-06', solarLongitude: 75,  description: '까끄라기 있는 곡식을 심는 시기. 午月 입절.' },
  { order: 10, name: '하지', hanja: '夏至', type: 'JUNG', branchIdx: 6,  approxDate: '06-21', solarLongitude: 90,  description: '낮이 가장 긴 날. 午月 중기.' },
  // ── 6월 未月 (여름 끝) ──────────────────────────────────────────────────
  { order: 11, name: '소서', hanja: '小暑', type: 'JEOL', branchIdx: 7,  approxDate: '07-07', solarLongitude: 105, description: '더위가 시작됨. 未月 입절.' },
  { order: 12, name: '대서', hanja: '大暑', type: 'JUNG', branchIdx: 7,  approxDate: '07-23', solarLongitude: 120, description: '더위가 가장 심한 시기. 未月 중기.' },
  // ── 7월 申月 (가을 시작) ────────────────────────────────────────────────
  { order: 13, name: '입추', hanja: '立秋', type: 'JEOL', branchIdx: 8,  approxDate: '08-07', solarLongitude: 135, description: '가을의 시작. 申月 입절.' },
  { order: 14, name: '처서', hanja: '處暑', type: 'JUNG', branchIdx: 8,  approxDate: '08-23', solarLongitude: 150, description: '더위가 물러남. 申月 중기.' },
  // ── 8월 酉月 (가을 중) ──────────────────────────────────────────────────
  { order: 15, name: '백로', hanja: '白露', type: 'JEOL', branchIdx: 9,  approxDate: '09-08', solarLongitude: 165, description: '이슬이 내리기 시작함. 酉月 입절.' },
  { order: 16, name: '추분', hanja: '秋分', type: 'JUNG', branchIdx: 9,  approxDate: '09-23', solarLongitude: 180, description: '낮과 밤의 길이가 같아짐. 酉月 중기.' },
  // ── 9월 戌月 (가을 끝) ──────────────────────────────────────────────────
  { order: 17, name: '한로', hanja: '寒露', type: 'JEOL', branchIdx: 10, approxDate: '10-08', solarLongitude: 195, description: '찬 이슬이 내림. 戌月 입절.' },
  { order: 18, name: '상강', hanja: '霜降', type: 'JUNG', branchIdx: 10, approxDate: '10-23', solarLongitude: 210, description: '서리가 내림. 戌月 중기.' },
  // ── 10월 亥月 (겨울 시작) ───────────────────────────────────────────────
  { order: 19, name: '입동', hanja: '立冬', type: 'JEOL', branchIdx: 11, approxDate: '11-07', solarLongitude: 225, description: '겨울의 시작. 亥月 입절.' },
  { order: 20, name: '소설', hanja: '小雪', type: 'JUNG', branchIdx: 11, approxDate: '11-22', solarLongitude: 240, description: '첫눈이 내림. 亥月 중기.' },
  // ── 11월 子月 (겨울 중) ─────────────────────────────────────────────────
  { order: 21, name: '대설', hanja: '大雪', type: 'JEOL', branchIdx: 0,  approxDate: '12-07', solarLongitude: 255, description: '큰 눈이 내림. 子月 입절.' },
  { order: 22, name: '동지', hanja: '冬至', type: 'JUNG', branchIdx: 0,  approxDate: '12-22', solarLongitude: 270, description: '밤이 가장 긴 날. 子月 중기.' },
  // ── 12월 丑月 (겨울 끝) ─────────────────────────────────────────────────
  { order: 23, name: '소한', hanja: '小寒', type: 'JEOL', branchIdx: 1,  approxDate: '01-06', solarLongitude: 285, description: '추위가 시작됨. 丑月 입절.' },
  { order: 24, name: '대한', hanja: '大寒', type: 'JUNG', branchIdx: 1,  approxDate: '01-20', solarLongitude: 300, description: '추위가 가장 심한 시기. 丑月 중기.' },
];

// ---------------------------------------------------------------------------
// 월령 사령(月令司令) — 각 월지에서 사령하는 지장간
// ---------------------------------------------------------------------------

/**
 * 월령 사령(月令司令) 항목
 *
 * 각 절기에서 사령(司令) 중인 지장간 천간과 사령 일수를 나타낸다.
 * 사령 순서: 여기(餘氣) -> 중기(中氣) -> 본기(本氣)
 */
export interface SalyeongEntry {
  /** 사령 천간 인덱스 */
  stemIdx: StemIdx;
  /** 천간 로마자 */
  stemName: string;
  /** 천간 한자 */
  stemHanja: string;
  /** 사령 일수 (절기 시작부터 해당 천간이 사령하는 기간) */
  days: number;
  /** 지장간 역할 */
  role: "YEOGI" | "JUNGGI" | "BONGI";
}

/**
 * 월지별 월령 사령(月令司令) 테이블
 *
 * 각 월지에서 절기 시작 이후 사령하는 지장간의 순서와 일수.
 * 사주 분석 시 생일(生日)이 절기 후 몇 일째인지에 따라
 * 실제 사령 중인 지장간이 결정된다.
 *
 * 키: 지지 인덱스 (0=子 ~ 11=亥)
 *
 * 사령 일수 기준: 자평진전(子平眞詮) 인원용사(人元用事) 분야표
 *
 * 패턴:
 *   왕지(旺地) 子·卯·酉: 본기만 30일
 *   생지(生地) 寅·巳·申: 여기 7일 + 중기 7일 + 본기 16일 = 30일
 *   묘지(墓地) 丑·辰·未·戌: 여기 9일 + 중기 3일 + 본기 18일 = 30일
 *   특수 午: 여기 9일 + 본기 21일 = 30일 (중기 없음)
 *   특수 亥: 여기 7일 + 본기 23일 = 30일 (중기 없음)
 */
export const WOLRYEONG_SALYEONG: Record<BranchIdx, SalyeongEntry[]> = {
  // 子(JA, 0): 癸水 본기 30일
  // 수왕지(水旺地). 순수한 癸水의 기운만 존재.
  0: [
    { stemIdx: 9, stemName: 'GYE',    stemHanja: '癸', days: 30, role: 'BONGI' },
  ],
  // 丑(CHUK, 1): 癸水 여기 9일 -> 辛金 중기 3일 -> 己土 본기 18일
  // 금묘지(金墓地). 겨울의 끝, 金의 창고. 9+3+18=30
  1: [
    { stemIdx: 9, stemName: 'GYE',    stemHanja: '癸', days: 9,  role: 'YEOGI'  },
    { stemIdx: 7, stemName: 'SIN',    stemHanja: '辛', days: 3,  role: 'JUNGGI' },
    { stemIdx: 5, stemName: 'GI',     stemHanja: '己', days: 18, role: 'BONGI'  },
  ],
  // 寅(IN, 2): 戊土 여기 7일 -> 丙火 중기 7일 -> 甲木 본기 16일
  // 목생지(木生地). 봄의 시작. 7+7+16=30
  2: [
    { stemIdx: 4, stemName: 'MU',     stemHanja: '戊', days: 7,  role: 'YEOGI'  },
    { stemIdx: 2, stemName: 'BYEONG', stemHanja: '丙', days: 7,  role: 'JUNGGI' },
    { stemIdx: 0, stemName: 'GAP',    stemHanja: '甲', days: 16, role: 'BONGI'  },
  ],
  // 卯(MYO, 3): 乙木 본기 30일
  // 목왕지(木旺地). 순수한 乙木의 기운만 존재.
  3: [
    { stemIdx: 1, stemName: 'EUL',    stemHanja: '乙', days: 30, role: 'BONGI' },
  ],
  // 辰(JIN, 4): 乙木 여기 9일 -> 癸水 중기 3일 -> 戊土 본기 18일
  // 수묘지(水墓地). 봄의 끝, 水의 창고. 9+3+18=30
  4: [
    { stemIdx: 1, stemName: 'EUL',    stemHanja: '乙', days: 9,  role: 'YEOGI'  },
    { stemIdx: 9, stemName: 'GYE',    stemHanja: '癸', days: 3,  role: 'JUNGGI' },
    { stemIdx: 4, stemName: 'MU',     stemHanja: '戊', days: 18, role: 'BONGI'  },
  ],
  // 巳(SA, 5): 戊土 여기 7일 -> 庚金 중기 7일 -> 丙火 본기 16일
  // 화생지(火生地). 여름의 시작. 7+7+16=30
  5: [
    { stemIdx: 4, stemName: 'MU',     stemHanja: '戊', days: 7,  role: 'YEOGI'  },
    { stemIdx: 6, stemName: 'GYEONG', stemHanja: '庚', days: 7,  role: 'JUNGGI' },
    { stemIdx: 2, stemName: 'BYEONG', stemHanja: '丙', days: 16, role: 'BONGI'  },
  ],
  // 午(O, 6): 己土 여기 9일 -> 丁火 본기 21일
  // 화왕지(火旺地). 특수: 己土 여기가 공존. 9+21=30
  6: [
    { stemIdx: 5, stemName: 'GI',     stemHanja: '己', days: 9,  role: 'YEOGI' },
    { stemIdx: 3, stemName: 'JEONG',  stemHanja: '丁', days: 21, role: 'BONGI' },
  ],
  // 未(MI, 7): 丁火 여기 9일 -> 乙木 중기 3일 -> 己土 본기 18일
  // 목묘지(木墓地). 여름의 끝, 木의 창고. 9+3+18=30
  7: [
    { stemIdx: 3, stemName: 'JEONG',  stemHanja: '丁', days: 9,  role: 'YEOGI'  },
    { stemIdx: 1, stemName: 'EUL',    stemHanja: '乙', days: 3,  role: 'JUNGGI' },
    { stemIdx: 5, stemName: 'GI',     stemHanja: '己', days: 18, role: 'BONGI'  },
  ],
  // 申(SHIN, 8): 戊土 여기 7일 -> 壬水 중기 7일 -> 庚金 본기 16일
  // 금생지(金生地). 가을의 시작. 7+7+16=30
  8: [
    { stemIdx: 4, stemName: 'MU',     stemHanja: '戊', days: 7,  role: 'YEOGI'  },
    { stemIdx: 8, stemName: 'IM',     stemHanja: '壬', days: 7,  role: 'JUNGGI' },
    { stemIdx: 6, stemName: 'GYEONG', stemHanja: '庚', days: 16, role: 'BONGI'  },
  ],
  // 酉(YU, 9): 辛金 본기 30일
  // 금왕지(金旺地). 순수한 辛金의 기운만 존재.
  9: [
    { stemIdx: 7, stemName: 'SIN',    stemHanja: '辛', days: 30, role: 'BONGI' },
  ],
  // 戌(SUL, 10): 辛金 여기 9일 -> 丁火 중기 3일 -> 戊土 본기 18일
  // 화묘지(火墓地). 가을의 끝, 火의 창고. 9+3+18=30
  10: [
    { stemIdx: 7, stemName: 'SIN',    stemHanja: '辛', days: 9,  role: 'YEOGI'  },
    { stemIdx: 3, stemName: 'JEONG',  stemHanja: '丁', days: 3,  role: 'JUNGGI' },
    { stemIdx: 4, stemName: 'MU',     stemHanja: '戊', days: 18, role: 'BONGI'  },
  ],
  // 亥(HAE, 11): 甲木 여기 7일 -> 壬水 본기 23일
  // 수생지(水生地). 겨울의 시작. 7+23=30
  11: [
    { stemIdx: 0, stemName: 'GAP',    stemHanja: '甲', days: 7,  role: 'YEOGI' },
    { stemIdx: 8, stemName: 'IM',     stemHanja: '壬', days: 23, role: 'BONGI' },
  ],
};

// ---------------------------------------------------------------------------
// 용사(用事) 개념 — 어떤 지장간이 현재 힘을 행사하는가
// ---------------------------------------------------------------------------

/**
 * 용사(用事) 이론
 *
 * 용사(用事)란 특정 시점에서 월지(月支)의 지장간 중 실제로 힘을 행사하고 있는
 * 천간을 가리킨다. 절기 교체 직후에는 전월의 기운(여기)이 아직 남아 있어
 * 여기가 용사하고, 시간이 지남에 따라 중기, 본기 순으로 교체된다.
 *
 * 용사의 판단:
 *   1. 절기 입절일부터 경과한 일수를 계산한다.
 *   2. 여기 사령 일수 이내이면 여기가 용사 중이다.
 *   3. 여기+중기 일수 이내이면 중기가 용사 중이다.
 *   4. 그 이후에는 본기가 용사한다.
 *
 * 용사 천간의 중요성:
 *   - 격국 결정: 용사 중인 지장간이 천간에 투출하면 그 격이 가장 진실하다.
 *   - 통근 강도: 용사 중인 지장간에 통근한 천간이 가장 강하다.
 *   - 사령 교대: 용사 교대 시점의 생일은 두 기운의 영향을 동시에 받는다.
 */
export const YONGSA_THEORY = {
  definition:
    '용사(用事)란 월지 지장간 중 현재 시점에서 실질적으로 힘을 행사하는 천간이다. ' +
    '절기 입절일로부터의 경과 일수에 따라 여기 -> 중기 -> 본기 순서로 교대한다.',
  principle:
    '용사 천간이 천간에 투출하면 가장 진실한 격국이 성립한다. ' +
    '용사 천간에 통근한 다른 천간은 그 힘이 가장 강하다. ' +
    '본기가 용사할 때 본기 투출이 되면 격국이 가장 순수하고 강하다.',
  /**
   * 용사 교대(交代) 시점의 처리
   *
   * 여기에서 중기로, 중기에서 본기로 교대하는 경계 일자에 태어난 경우
   * 실무에서는 양쪽 기운을 모두 고려하되, 교대 후의 기운을 우선시한다.
   */
  transition:
    '사령 교대일 전후 1~2일 이내에 태어난 경우, 두 기운의 영향을 모두 받을 수 있다. ' +
    '실무적으로는 교대 후의 기운을 우선으로 보되, 전 기운의 잔여 영향도 참고한다.',
} as const;

// ---------------------------------------------------------------------------
// 월령 십신(月令十神) — 월지 본기가 일간에 대해 어떤 십신인지
// ---------------------------------------------------------------------------

/**
 * 십신(十神) 타입
 *
 * 일간을 기준으로 한 다른 천간·지지와의 오행 생극(生剋) 및 음양 관계.
 */
export type Sipsin =
  | 'BIGYEON'   // 比肩(비견): 일간과 같은 오행, 같은 음양
  | 'GEOBJE'    // 劫財(겁재): 일간과 같은 오행, 다른 음양
  | 'SIKSHIN'   // 食神(식신): 일간이 생하는 오행, 같은 음양
  | 'SANGGWAN'  // 傷官(상관): 일간이 생하는 오행, 다른 음양
  | 'PYEONJAE'  // 偏財(편재): 일간이 극하는 오행, 같은 음양
  | 'JEONGJAE'  // 正財(정재): 일간이 극하는 오행, 다른 음양
  | 'PYEONGWAN' // 偏官(편관): 일간을 극하는 오행, 같은 음양
  | 'JEONGGWAN' // 正官(정관): 일간을 극하는 오행, 다른 음양
  | 'PYEONIN'   // 偏印(편인): 일간을 생하는 오행, 같은 음양
  | 'JEONGIN';  // 正印(정인): 일간을 생하는 오행, 다른 음양

/**
 * 월령 십신 계산에 필요한 오행·음양 정보
 *
 * 오행 생극 순서:
 *   생(生): 木->火->土->金->水->木
 *   극(剋): 木->土->水->火->金->木  (= 木克土, 土克水, 水克火, 火克金, 金克木)
 *
 * 오행 인덱스: 木=0, 火=1, 土=2, 金=3, 水=4
 * 음양: 0=양(陽), 1=음(陰) (천간 인덱스 짝수=양, 홀수=음)
 */

/** 천간 오행 배열 (인덱스 0~9) */
const STEM_OHHAENG = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4] as const;
                  // 甲 乙 丙 丁 戊 己 庚 辛 壬 癸

/** 천간 음양 배열 (인덱스 0~9, 0=양, 1=음) */
const STEM_EUMYANG = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1] as const;
                  // 甲 乙 丙 丁 戊 己 庚 辛 壬 癸

/**
 * 월지 본기(本氣) 인덱스 테이블
 *
 * 지장간에서 본기(本氣)에 해당하는 천간 인덱스.
 * 월지 인덱스 0~11 -> 본기 천간 인덱스
 *
 * 배속:
 *   子(0)=癸(9)  丑(1)=己(5)  寅(2)=甲(0)  卯(3)=乙(1)
 *   辰(4)=戊(4)  巳(5)=丙(2)  午(6)=丁(3)  未(7)=己(5)
 *   申(8)=庚(6)  酉(9)=辛(7)  戌(10)=戊(4) 亥(11)=壬(8)
 */
export const BRANCH_BONGI_STEM: StemIdx[] = [
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
];

/**
 * 일간과 천간의 십신 관계를 계산한다.
 *
 * 오행 생극 관계(生剋關係)와 음양 동이(陰陽同異)를 조합하여
 * 10가지 십신 중 하나를 결정한다.
 *
 * 판정 순서:
 *   1. 비겁(比劫): 같은 오행 -- 동음양=비견, 이음양=겁재
 *   2. 식상(食傷): 일간이 생하는 오행 -- 동음양=식신, 이음양=상관
 *   3. 재성(財星): 일간이 극하는 오행 -- 동음양=편재, 이음양=정재
 *   4. 관성(官星): 일간을 극하는 오행 -- 동음양=편관, 이음양=정관
 *   5. 인성(印星): 일간을 생하는 오행 -- 동음양=편인, 이음양=정인
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param stemIdx  - 비교할 천간 인덱스
 * @returns 십신 타입
 *
 * @example
 * getSipsin(0, 0)  // 甲일간 vs 甲 -> BIGYEON (비견)
 * getSipsin(0, 1)  // 甲일간 vs 乙 -> GEOBJE  (겁재)
 * getSipsin(0, 2)  // 甲일간 vs 丙 -> SIKSHIN (식신)
 * getSipsin(0, 9)  // 甲일간 vs 癸 -> JEONGIN (정인)
 */
export function getSipsin(ilganIdx: StemIdx, stemIdx: StemIdx): Sipsin {
  const ilOh = STEM_OHHAENG[((ilganIdx % 10) + 10) % 10];
  const stOh = STEM_OHHAENG[((stemIdx   % 10) + 10) % 10];
  const ilEy = STEM_EUMYANG[((ilganIdx  % 10) + 10) % 10];
  const stEy = STEM_EUMYANG[((stemIdx   % 10) + 10) % 10];
  const sameEy = ilEy === stEy;

  // 비겁: 같은 오행
  if (stOh === ilOh) {
    return sameEy ? 'BIGYEON' : 'GEOBJE';
  }
  // 식상: 일간이 생하는 오행 (木->火->土->金->水->木)
  if (stOh === (ilOh + 1) % 5) {
    return sameEy ? 'SIKSHIN' : 'SANGGWAN';
  }
  // 재성: 일간이 극하는 오행
  // 극 순서: 木克土 火克金 土克水 金克木 水克火 => (ilOh+2)%5
  if (stOh === (ilOh + 2) % 5) {
    return sameEy ? 'PYEONJAE' : 'JEONGJAE';
  }
  // 관성: 일간을 극하는 오행
  // 나를 극하는 오행 = (ilOh+4)%5 (= 일간에서 역으로 2칸)
  // 검증: 木(0)을 극하는 것은 金(3) = (0+4)%5=4? 아니다.
  // 정확한 극표: 木극土, 火극金, 土극水, 金극木, 水극火
  // 金(3)이 木(0)을 극 => 나를 극하는 오행: 木->金(3), 火->水(4), 土->木(0), 金->火(1), 水->土(2)
  // 패턴: (ilOh+3)%5
  // 검증: 木(0): (0+3)%5=3=金 OK, 火(1): (1+3)%5=4=水 OK, 土(2): (2+3)%5=0=木 OK
  if (stOh === (ilOh + 3) % 5) {
    return sameEy ? 'PYEONGWAN' : 'JEONGGWAN';
  }
  // 인성: 일간을 생하는 오행 (나머지)
  // 나를 생하는 오행: 木->水(4), 火->木(0), 土->火(1), 金->土(2), 水->金(3)
  // 패턴: (ilOh+4)%5
  return sameEy ? 'PYEONIN' : 'JEONGIN';
}

/**
 * 월지 본기가 일간에 대해 어떤 십신인지 반환한다.
 *
 * @param ilganIdx  - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx  - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 월령 십신
 *
 * @example
 * getWollyeongSipsin(0, 2)   // 甲일간 寅월: 寅 본기=甲 -> BIGYEON (비견)
 * getWollyeongSipsin(0, 11)  // 甲일간 亥월: 亥 본기=壬 -> PYEONIN (편인)
 * getWollyeongSipsin(0, 9)   // 甲일간 酉월: 酉 본기=辛 -> JEONGGWAN (정관)
 */
export function getWollyeongSipsin(ilganIdx: StemIdx, woljiIdx: BranchIdx): Sipsin {
  const b       = ((woljiIdx  % 12) + 12) % 12;
  const bongiSt = BRANCH_BONGI_STEM[b];
  return getSipsin(ilganIdx, bongiSt);
}

// ---------------------------------------------------------------------------
// 월령 십신 전체 테이블 (10간 x 12지 = 120 조합) -- 검증 완료
// ---------------------------------------------------------------------------

/**
 * 월령 십신 테이블
 *
 * [일간 인덱스 0~9][월지 인덱스 0~11] -- 월지 본기 기준 십신
 *
 * 월지 본기:
 *   子=癸(9) 丑=己(5) 寅=甲(0) 卯=乙(1) 辰=戊(4) 巳=丙(2)
 *   午=丁(3) 未=己(5) 申=庚(6) 酉=辛(7) 戌=戊(4) 亥=壬(8)
 *
 * 행: 일간(甲乙丙丁戊己庚辛壬癸), 열: 월지(子丑寅卯辰巳午未申酉戌亥)
 *
 * 도출 공식: getSipsin(ilganIdx, BRANCH_BONGI_STEM[woljiIdx])
 *
 * 검증: 120개 전 조합이 getSipsin() 함수의 계산 결과와 일치함을 확인.
 */
export const WOLLYEONG_SIPSIN_TABLE: Sipsin[][] = [
  // 甲(0) 일간 -- 子  丑       寅       卯       辰       巳       午       未       申        酉        戌       亥
  // 본기:          癸  己       甲       乙       戊       丙       丁       己       庚        辛        戊       壬
  ['JEONGIN', 'JEONGJAE', 'BIGYEON', 'GEOBJE', 'PYEONJAE', 'SIKSHIN', 'SANGGWAN', 'JEONGJAE', 'PYEONGWAN', 'JEONGGWAN', 'PYEONJAE', 'PYEONIN'],
  // 乙(1) 일간
  ['PYEONIN', 'PYEONJAE', 'GEOBJE', 'BIGYEON', 'JEONGJAE', 'SANGGWAN', 'SIKSHIN', 'PYEONJAE', 'JEONGGWAN', 'PYEONGWAN', 'JEONGJAE', 'JEONGIN'],
  // 丙(2) 일간
  ['JEONGGWAN', 'SANGGWAN', 'PYEONIN', 'JEONGIN', 'SIKSHIN', 'BIGYEON', 'GEOBJE', 'SANGGWAN', 'PYEONJAE', 'JEONGJAE', 'SIKSHIN', 'PYEONGWAN'],
  // 丁(3) 일간
  ['PYEONGWAN', 'SIKSHIN', 'JEONGIN', 'PYEONIN', 'SANGGWAN', 'GEOBJE', 'BIGYEON', 'SIKSHIN', 'JEONGJAE', 'PYEONJAE', 'SANGGWAN', 'JEONGGWAN'],
  // 戊(4) 일간
  ['JEONGJAE', 'GEOBJE', 'PYEONGWAN', 'JEONGGWAN', 'BIGYEON', 'PYEONIN', 'JEONGIN', 'GEOBJE', 'SIKSHIN', 'SANGGWAN', 'BIGYEON', 'PYEONJAE'],
  // 己(5) 일간
  ['PYEONJAE', 'BIGYEON', 'JEONGGWAN', 'PYEONGWAN', 'GEOBJE', 'JEONGIN', 'PYEONIN', 'BIGYEON', 'SANGGWAN', 'SIKSHIN', 'GEOBJE', 'JEONGJAE'],
  // 庚(6) 일간
  ['SANGGWAN', 'JEONGIN', 'PYEONJAE', 'JEONGJAE', 'PYEONIN', 'PYEONGWAN', 'JEONGGWAN', 'JEONGIN', 'BIGYEON', 'GEOBJE', 'PYEONIN', 'SIKSHIN'],
  // 辛(7) 일간
  ['SIKSHIN', 'PYEONIN', 'JEONGJAE', 'PYEONJAE', 'JEONGIN', 'JEONGGWAN', 'PYEONGWAN', 'PYEONIN', 'GEOBJE', 'BIGYEON', 'JEONGIN', 'SANGGWAN'],
  // 壬(8) 일간
  ['GEOBJE', 'JEONGGWAN', 'SIKSHIN', 'SANGGWAN', 'PYEONGWAN', 'PYEONJAE', 'JEONGJAE', 'JEONGGWAN', 'PYEONIN', 'JEONGIN', 'PYEONGWAN', 'BIGYEON'],
  // 癸(9) 일간
  ['BIGYEON', 'PYEONGWAN', 'SANGGWAN', 'SIKSHIN', 'JEONGGWAN', 'JEONGJAE', 'PYEONJAE', 'PYEONGWAN', 'JEONGIN', 'PYEONIN', 'JEONGGWAN', 'GEOBJE'],
];

// ---------------------------------------------------------------------------
// 투출(透出) 이론 — 지장간이 천간에 드러나는 것의 중요성
// ---------------------------------------------------------------------------

/**
 * 투출(透出) 이론 상세
 *
 * 투출(透出)이란 지지(地支) 속에 감춰진 지장간(地藏干)의 천간이
 * 사주 천간(天干) 자리에 동일하게 나타나는 현상을 말한다.
 *
 * 투출은 격국(格局) 결정의 핵심 메커니즘이다:
 *   - 월지 지장간 중 천간에 투출된 것이 격을 결정한다.
 *   - 투출되지 않으면 지장간의 기운은 잠복(潛伏) 상태로,
 *     현실에서의 발현이 제한적이다.
 *   - 투출된 기운은 '통로가 열린' 것과 같아 실질적인 영향력을 발휘한다.
 *
 * 투출 판단 시 고려사항:
 *   1. 월지 지장간 중 어떤 것이 천간에 나왔는가?
 *   2. 복수 투출 시, 사령 중인(용사 중인) 지장간의 투출을 우선한다.
 *   3. 본기 투출 > 중기 투출 > 여기 투출 순서로 격의 순도가 높다.
 *   4. 천간합(天干合)으로 투출 천간이 합거(合去)되면 투출의 효력이 약해진다.
 */
export const TUCHUL_THEORY = {
  definition:
    '투출(透出)이란 지지(地支) 속 지장간(地藏干)의 천간이 ' +
    '사주의 천간(天干) 자리에 동일하게 나타나는 현상이다. ' +
    '지지의 내기(內氣)가 겉으로 드러나 그 기운이 현실에서 작동하게 된다.',
  importance:
    '격국(格局) 성립의 핵심 조건. 월지(月支) 지장간 중 천간에 투출된 것이 있으면 ' +
    '해당 십신(十神)으로 격을 잡는다. ' +
    '투출 우선순위: 본기(本氣) > 중기(中氣) > 여기(餘氣). ' +
    '본기가 투출되면 가장 순수하고 강한 격국이 된다.',
  /**
   * 투출과 비투출의 차이
   *
   * 투출된 천간: 지지의 기운이 현실에서 발현된다. 격국·용신·기신이 분명해진다.
   * 비투출 지장간: 잠복 상태. 대운·세운에서 투출될 때 비로소 작용한다.
   */
  difference:
    '투출된 지장간은 격국과 용신으로 작동하며 현실에서 즉시 발현된다. ' +
    '투출되지 않은 지장간은 잠복 상태로, 대운이나 세운에서 동일 천간이 올 때 비로소 작동한다.',
  /**
   * 복수 투출(複數透出) 처리
   *
   * 월지의 지장간 중 2개 이상이 천간에 투출된 경우의 처리 원칙.
   */
  multipleTransparency:
    '월지 지장간 중 복수의 천간이 투출된 경우, 현재 용사(用事) 중인 지장간의 투출을 우선한다. ' +
    '용사 천간이 투출되지 않았으면, 본기 > 중기 > 여기 순서로 격을 결정한다.',
  examples: [
    {
      branch:  'IN(寅) -- 본기 甲, 중기 丙, 여기 戊',
      stem:    'GAP(甲)',
      meaning: '寅月에 甲이 천간에 투출 -> 비견 투출이므로 건록격(建祿格) 성립',
    },
    {
      branch:  'IN(寅) -- 본기 甲, 중기 丙, 여기 戊',
      stem:    'BYEONG(丙)',
      meaning: '寅月에 丙이 천간에 투출 (중기 투출) -> 甲 비견이 아닌 丙 식신으로 격을 잡을 수 있음',
    },
    {
      branch:  'SA(巳) -- 본기 丙, 중기 庚, 여기 戊',
      stem:    'GYEONG(庚)',
      meaning: '巳月에 庚이 천간에 투출 (중기 투출) -> 庚 관련 십신이 격이 될 수 있음',
    },
    {
      branch:  'SHIN(申) -- 본기 庚, 중기 壬, 여기 戊',
      stem:    'IM(壬)',
      meaning: '申月에 壬이 천간에 투출 -> 壬水 관련 십신으로 격 성립 가능',
    },
    {
      branch:  'HAE(亥) -- 본기 壬, 여기 甲',
      stem:    'IM(壬)',
      meaning: '亥月에 壬이 천간에 투출 -> 본기 직접 투출로 가장 순수한 격',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// 월령의 왕쇠(旺衰) 판단 — 월령이 일간을 생하는지/극하는지
// ---------------------------------------------------------------------------

/**
 * 월령 왕쇠(旺衰) 관계 타입
 *
 * 월지 본기 오행이 일간 오행에 대해 어떤 생극 관계인지를 나타낸다.
 */
export type WollyeongWangSoe =
  | 'DEUKRYEONG'    // 得令(득령): 월령이 일간을 돕는 관계 (비겁·인성)
  | 'SILRYEONG';    // 失令(실령): 월령이 일간을 돕지 않는 관계 (식상·재성·관성)

/**
 * 월령 왕쇠(旺衰) 판단 이론
 *
 * 월령이 일간을 생(生)하거나 같은 오행이면 득령(得令),
 * 월령이 일간을 극(剋)하거나 일간이 월령을 생/극하면 실령(失令).
 *
 * 득령(得令) 조건:
 *   - 월지 본기가 일간과 같은 오행 (비겁 관계)
 *   - 월지 본기가 일간을 생하는 오행 (인성 관계)
 *
 * 실령(失令) 조건:
 *   - 월지 본기가 일간이 생하는 오행 (식상 관계)
 *   - 월지 본기가 일간이 극하는 오행 (재성 관계)
 *   - 월지 본기가 일간을 극하는 오행 (관성 관계)
 *
 * 득령은 신강신약 판단에서 가장 비중이 큰 지표이다.
 * 자평진전: "月令이 일간을 돕는 것은 모든 것의 근본이다."
 */
export const WANGSOE_THEORY = {
  definition:
    '월령 왕쇠란 월지(月支) 본기의 오행이 일간(日干) 오행에 대해 생(生)하거나 ' +
    '동일한지, 아니면 극(剋)하거나 설기(洩氣)시키는지를 판단하는 것이다.',
  deukryeong:
    '득령(得令): 월지 본기가 일간과 같은 오행(비겁)이거나 일간을 생하는 오행(인성)일 때. ' +
    '일간이 계절의 기운을 얻어 강해진다. 신강(身强) 판단의 핵심 근거.',
  silryeong:
    '실령(失令): 월지 본기가 일간이 생하는 오행(식상), 극하는 오행(재성), ' +
    '또는 일간을 극하는 오행(관성)일 때. 일간이 계절의 기운을 얻지 못해 약해진다.',
  /**
   * 월령 왕쇠와 왕상휴수사(旺相休囚死)의 관계
   *
   * 왕(旺): 월지와 일간이 같은 오행 -> 가장 강함 -> 득령
   * 상(相): 월지가 일간을 생하는 오행 -> 강함 -> 득령
   * 휴(休): 일간이 월지를 생하는 오행 -> 보통 -> 실령
   * 수(囚): 월지가 일간을 극하는 오행 -> 약함 -> 실령
   * 사(死): 일간이 월지를 극하는 오행 -> 가장 약함 -> 실령
   */
  relationship:
    '왕상(旺相)이면 득령, 휴수사(休囚死)이면 실령으로 단순화할 수 있다. ' +
    '그러나 실무에서는 왕상휴수사 5단계를 세밀하게 적용하여 강약 정도를 판단한다.',
} as const;

/**
 * 일간이 월지에서 득령(得令)하는지 판단한다.
 *
 * 월지 본기 오행이 일간 오행을 생하거나 같으면 득령(DEUKRYEONG),
 * 그렇지 않으면 실령(SILRYEONG).
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 득령/실령 판단
 *
 * @example
 * judgeWollyeongWangSoe(0, 2)   // 甲일간 寅월(본기=甲=木) -> 같은 오행 -> DEUKRYEONG
 * judgeWollyeongWangSoe(0, 11)  // 甲일간 亥월(본기=壬=水) -> 水生木 -> DEUKRYEONG
 * judgeWollyeongWangSoe(0, 8)   // 甲일간 申월(본기=庚=金) -> 金克木 -> SILRYEONG
 * judgeWollyeongWangSoe(0, 5)   // 甲일간 巳월(본기=丙=火) -> 木生火 -> SILRYEONG
 */
export function judgeWollyeongWangSoe(
  ilganIdx: StemIdx,
  woljiIdx: BranchIdx,
): WollyeongWangSoe {
  const sipsin = getWollyeongSipsin(ilganIdx, woljiIdx);
  // 비겁(BIGYEON, GEOBJE)과 인성(PYEONIN, JEONGIN)이면 득령
  if (
    sipsin === 'BIGYEON' || sipsin === 'GEOBJE' ||
    sipsin === 'PYEONIN' || sipsin === 'JEONGIN'
  ) {
    return 'DEUKRYEONG';
  }
  return 'SILRYEONG';
}

// ---------------------------------------------------------------------------
// 월령과 조후(調候)의 관계 — 계절에 따른 한난조습
// ---------------------------------------------------------------------------

/**
 * 조후 기후 타입
 *
 * 한(寒): 차가움, 난(暖): 따뜻함, 조(燥): 건조함, 습(濕): 습함
 */
export type JohuGihu = 'HAN' | 'NAN' | 'JO' | 'SEUP';

/**
 * 월령별 조후(調候) 특성
 *
 * 각 월지가 가진 계절적 기후 특성과 그에 따른 조후 필요성.
 * 조후(調候)란 사주의 기후를 조절하여 일간이 최적의 환경에서
 * 기능할 수 있도록 하는 것이다.
 *
 * 기후 특성:
 *   봄(寅卯辰): 따뜻하고 습한 기운 -> 대체로 온화
 *   여름(巳午未): 뜨겁고 건조한 기운 -> 水로 조후
 *   가을(申酉戌): 서늘하고 건조한 기운 -> 대체로 온화
 *   겨울(亥子丑): 차갑고 습한 기운 -> 火로 조후
 *
 * 궁통보감(窮通寶鑑) 기반.
 */
export interface WollyeongJohu {
  /** 월지 인덱스 */
  branchIdx: BranchIdx;
  /** 월지 한자 */
  branchHanja: string;
  /** 계절 */
  gyejeol: string;
  /** 주된 기후 특성 */
  gihuTeukseong: JohuGihu[];
  /** 조후가 급한 정도 (1=약 ~ 5=절실) */
  johuGeupcheong: number;
  /** 필요한 조후 오행 (천간 인덱스 배열) -- 1순위부터 */
  johuYongsin: StemIdx[];
  /** 설명 */
  description: string;
}

/**
 * 월령별 조후 특성 테이블
 *
 * 12월지 각각의 기후 특성과 필요 조후를 수록한다.
 */
export const WOLLYEONG_JOHU_TABLE: WollyeongJohu[] = [
  // 子月(11월) -- 한겨울, 극한(極寒)
  {
    branchIdx: 0, branchHanja: '子', gyejeol: '한겨울',
    gihuTeukseong: ['HAN', 'SEUP'], johuGeupcheong: 5,
    johuYongsin: [STEM.BYEONG, STEM.JEONG],
    description: '子月은 수기(水氣)가 최고조. 극한(極寒)의 계절로 丙丁火 조후가 절실하다.',
  },
  // 丑月(12월) -- 늦겨울, 한습(寒濕)
  {
    branchIdx: 1, branchHanja: '丑', gyejeol: '늦겨울',
    gihuTeukseong: ['HAN', 'SEUP'], johuGeupcheong: 4,
    johuYongsin: [STEM.BYEONG, STEM.JEONG],
    description: '丑月은 겨울의 끝. 한기(寒氣)가 여전히 강하며 습토(濕土). 丙丁火 조후 필요.',
  },
  // 寅月(1월) -- 초봄, 한기 잔존
  {
    branchIdx: 2, branchHanja: '寅', gyejeol: '초봄',
    gihuTeukseong: ['HAN'], johuGeupcheong: 3,
    johuYongsin: [STEM.BYEONG],
    description: '寅月은 봄의 시작이나 아직 한기가 남아 있다. 丙火로 따뜻하게 해야 만물이 소생.',
  },
  // 卯月(2월) -- 한봄, 온화
  {
    branchIdx: 3, branchHanja: '卯', gyejeol: '한봄',
    gihuTeukseong: ['NAN'], johuGeupcheong: 1,
    johuYongsin: [],
    description: '卯月은 봄이 무르익는 시기. 기후가 온화하여 조후보다 억부(抑扶)를 우선한다.',
  },
  // 辰月(3월) -- 늦봄, 온습
  {
    branchIdx: 4, branchHanja: '辰', gyejeol: '늦봄',
    gihuTeukseong: ['NAN', 'SEUP'], johuGeupcheong: 1,
    johuYongsin: [],
    description: '辰月은 봄의 끝. 습토(濕土)의 성질. 기후가 온화하여 조후 필요 적음.',
  },
  // 巳月(4월) -- 초여름, 화기 발생
  {
    branchIdx: 5, branchHanja: '巳', gyejeol: '초여름',
    gihuTeukseong: ['NAN', 'JO'], johuGeupcheong: 3,
    johuYongsin: [STEM.IM, STEM.GYE],
    description: '巳月은 여름의 시작. 화기(火氣)가 강해지기 시작. 壬癸水로 조절 필요.',
  },
  // 午月(5월) -- 한여름, 극열(極熱)
  {
    branchIdx: 6, branchHanja: '午', gyejeol: '한여름',
    gihuTeukseong: ['NAN', 'JO'], johuGeupcheong: 5,
    johuYongsin: [STEM.IM, STEM.GYE],
    description: '午月은 화기(火氣)가 최고조. 극열(極熱)의 계절로 壬癸水 조후가 절실하다.',
  },
  // 未月(6월) -- 늦여름, 조열
  {
    branchIdx: 7, branchHanja: '未', gyejeol: '늦여름',
    gihuTeukseong: ['NAN', 'JO'], johuGeupcheong: 4,
    johuYongsin: [STEM.IM, STEM.GYE],
    description: '未月은 여름의 끝. 조토(燥土)로서 건조하고 뜨겁다. 壬癸水 조후 필요.',
  },
  // 申月(7월) -- 초가을, 서늘
  {
    branchIdx: 8, branchHanja: '申', gyejeol: '초가을',
    gihuTeukseong: ['NAN'], johuGeupcheong: 1,
    johuYongsin: [],
    description: '申月은 가을의 시작. 기후가 서늘해지며 조후보다 억부를 우선한다.',
  },
  // 酉月(8월) -- 한가을, 온화
  {
    branchIdx: 9, branchHanja: '酉', gyejeol: '한가을',
    gihuTeukseong: ['NAN'], johuGeupcheong: 1,
    johuYongsin: [],
    description: '酉月은 가을이 무르익는 시기. 기후가 온화하여 조후 필요 적음.',
  },
  // 戌月(9월) -- 늦가을, 조냉
  {
    branchIdx: 10, branchHanja: '戌', gyejeol: '늦가을',
    gihuTeukseong: ['JO'], johuGeupcheong: 2,
    johuYongsin: [STEM.IM],
    description: '戌月은 가을의 끝. 조토(燥土)로서 건조. 壬水로 윤토(潤土) 보조.',
  },
  // 亥月(10월) -- 초겨울, 한기 시작
  {
    branchIdx: 11, branchHanja: '亥', gyejeol: '초겨울',
    gihuTeukseong: ['HAN', 'SEUP'], johuGeupcheong: 3,
    johuYongsin: [STEM.BYEONG, STEM.JEONG],
    description: '亥月은 겨울의 시작. 수기(水氣)가 강해지며 한기가 증가. 丙丁火 조후 필요.',
  },
];

// ---------------------------------------------------------------------------
// 격국(格局) 결정에서의 월령 역할
// ---------------------------------------------------------------------------

/**
 * 격국(格局) 결정에서 월령의 역할
 *
 * 자평진전(子平眞詮) 격국론의 핵심 원칙을 상세히 기술한다.
 *
 * 자평진전 격국 결정의 3단계:
 *   1단계: 월지 지장간 투출(透出) 확인
 *   2단계: 투출 천간의 십신 확인 -> 격국 결정
 *   3단계: 투출이 없으면 월지 본기(本氣)의 십신으로 격 결정
 *
 * "월령을 먼저 보라(先看月令)" -- 자평진전 제1원칙
 */
export const GEOKGUK_THEORY = {
  /**
   * 격국 결정 원칙 -- 자평진전 제1원칙
   */
  principle:
    '격국(格局) 결정 원칙: 월지(月支) 지장간(藏干)이 천간에 투출(透出)하면 ' +
    '그 십신(十神)이 격이 된다. 투출된 천간이 없으면 본기(本氣)의 십신을 격으로 취한다. ' +
    '사령(司令) 중인 지장간이 투출하면 그 격이 더 순수하고 강하다.',

  /**
   * "월령을 먼저 보라" -- 자평진전의 핵심 원리
   *
   * 원문: "八字用神 專求月令(팔자용신 전구월령)"
   * 해석: 팔자의 용신은 오로지 월령에서 구한다.
   *
   * 이것이 자평명리의 제1원칙이며, 모든 분석의 출발점이다.
   * 월령을 먼저 확인하지 않고 다른 것을 분석하는 것은
   * 근본을 잃은 분석이 된다.
   */
  firstPrinciple:
    '자평진전: "八字用神 專求月令(팔자용신 전구월령)". ' +
    '팔자의 용신은 오로지 월령에서 구한다. ' +
    '월령을 먼저 확인하는 것이 사주 분석의 제1원칙이다. ' +
    '월령이 격국의 기초를 결정하고, 격국이 용신·기신의 방향을 결정하며, ' +
    '용신·기신이 길흉(吉凶)을 결정한다.',

  /**
   * 격국 결정 상세 절차
   */
  procedure: [
    '1단계: 월지(月支)를 확인하고, 해당 월지의 지장간(藏干) 3개(여기·중기·본기)를 파악한다.',
    '2단계: 사주의 년간·월간·시간에 월지 지장간과 동일한 천간이 있는지 확인한다 (투출 확인).',
    '3단계: 투출된 천간이 있으면, 그 천간이 일간에 대해 어떤 십신인지 계산한다.',
    '4단계: 해당 십신이 곧 격국이 된다 (예: 정관이면 정관격, 식신이면 식신격).',
    '5단계: 투출이 복수이면, 현재 사령(용사) 중인 지장간의 투출을 우선한다.',
    '6단계: 투출이 전혀 없으면, 월지 본기(本氣)의 십신으로 격을 정한다.',
    '7단계: 비겁(비견·겁재)은 팔정격이 아니므로 건록격·양인격(월겁격)으로 별도 처리한다.',
  ],

  /**
   * 격국 종류 목록 (월령 본기 기준)
   *
   * 팔정격(八正格): 정관격·편관격·정재격·편재격·정인격·편인격·식신격·상관격
   * 외격: 건록격·양인격(월겁격)·종격·화기격 등
   */
  types: [
    '정관격(正官格): 월령 본기가 일간의 정관(正官)인 경우.',
    '편관격(偏官格): 월령 본기가 일간의 편관(偏官, 칠살)인 경우.',
    '정재격(正財格): 월령 본기가 일간의 정재(正財)인 경우.',
    '편재격(偏財格): 월령 본기가 일간의 편재(偏財)인 경우.',
    '정인격(正印格): 월령 본기가 일간의 정인(正印)인 경우.',
    '편인격(偏印格): 월령 본기가 일간의 편인(偏印)인 경우.',
    '식신격(食神格): 월령 본기가 일간의 식신(食神)인 경우.',
    '상관격(傷官格): 월령 본기가 일간의 상관(傷官)인 경우.',
    '건록격(建祿格): 월령 본기가 비견(比肩)인 경우.',
    '양인격(羊刃格): 월령 본기가 겁재(劫財)인 경우.',
  ],
} as const;

// ---------------------------------------------------------------------------
// 월령 관련 유틸리티 함수
// ---------------------------------------------------------------------------

/**
 * 현재 절기 후 경과 일수에 따라 월지에서 사령 중인 지장간을 반환한다.
 *
 * 절기가 바뀐 직후에는 여기(餘氣)가 사령하고,
 * 일수가 경과함에 따라 중기, 본기 순서로 교체된다.
 *
 * @param branchIdx        - 월지 인덱스 (0=子 ~ 11=亥)
 * @param daysAfterJeolgi  - 절기 후 경과 일수 (1부터 시작)
 * @returns 현재 사령 중인 SalyeongEntry
 *
 * @example
 * getCurrentSalyeong(2, 5)   // 寅月 절기 후 5일  -> 戊土 여기 사령
 * getCurrentSalyeong(2, 10)  // 寅月 절기 후 10일 -> 丙火 중기 사령
 * getCurrentSalyeong(2, 20)  // 寅月 절기 후 20일 -> 甲木 본기 사령
 */
export function getCurrentSalyeong(
  branchIdx: BranchIdx,
  daysAfterJeolgi: number,
): SalyeongEntry {
  const b       = ((branchIdx % 12) + 12) % 12;
  const entries = WOLRYEONG_SALYEONG[b as keyof typeof WOLRYEONG_SALYEONG];
  let cumDays   = 0;
  for (const entry of entries) {
    cumDays += entry.days;
    if (daysAfterJeolgi <= cumDays) return entry;
  }
  return entries[entries.length - 1];
}

/**
 * 월지의 본기(本氣) 사령 항목을 반환한다.
 *
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 본기 SalyeongEntry
 *
 * @example
 * getBongiSalyeong(2)   // 寅 -> 甲木 본기 (16일)
 * getBongiSalyeong(0)   // 子 -> 癸水 본기 (30일)
 */
export function getBongiSalyeong(branchIdx: BranchIdx): SalyeongEntry {
  const b       = ((branchIdx % 12) + 12) % 12;
  const entries = WOLRYEONG_SALYEONG[b as keyof typeof WOLRYEONG_SALYEONG];
  return entries.find((e) => e.role === 'BONGI') ?? entries[entries.length - 1];
}

/**
 * 월지에 해당하는 절기 정보를 반환한다.
 *
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns JeolgiWollyeong 또는 undefined
 *
 * @example
 * getJeolgiInfo(2)   // 寅 -> 입춘(立春) 정보
 * getJeolgiInfo(0)   // 子 -> 대설(大雪) 정보
 */
export function getJeolgiInfo(branchIdx: BranchIdx): JeolgiWollyeong | undefined {
  const b = ((branchIdx % 12) + 12) % 12;
  return JEOLGI_WOLLYEONG.find((j) => j.branchIdx === b);
}

/**
 * 월지 기준 격국명(格局名)을 한글로 반환한다.
 *
 * 월지 본기의 십신을 기준으로 격국 이름을 도출한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 격국 이름 (한글)
 *
 * @example
 * getGeokgukName(0, 9)   // 甲일간 酉월 -> 정관격
 * getGeokgukName(0, 2)   // 甲일간 寅월 -> 건록격
 */
export function getGeokgukName(ilganIdx: StemIdx, woljiIdx: BranchIdx): string {
  const sipsin = getWollyeongSipsin(ilganIdx, woljiIdx);
  const names: Record<Sipsin, string> = {
    BIGYEON:   '건록격(建祿格)',
    GEOBJE:    '양인격(羊刃格)',
    SIKSHIN:   '식신격(食神格)',
    SANGGWAN:  '상관격(傷官格)',
    PYEONJAE:  '편재격(偏財格)',
    JEONGJAE:  '정재격(正財格)',
    PYEONGWAN: '편관격(偏官格)',
    JEONGGWAN: '정관격(正官格)',
    PYEONIN:   '편인격(偏印格)',
    JEONGIN:   '정인격(正印格)',
  };
  return names[sipsin];
}

/**
 * 월지의 모든 지장간에 대해 일간 기준 십신을 계산한다.
 *
 * 격국 결정 시 투출 여부를 확인하기 위해,
 * 월지의 여기·중기·본기 각각에 대한 십신을 모두 반환한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 각 지장간의 십신과 역할 정보 배열
 *
 * @example
 * getWollyeongAllSipsin(0, 2)
 * // 甲일간 寅월:
 * //   [{ stemIdx: 4, role: 'YEOGI',  sipsin: 'PYEONJAE' },    // 戊: 편재
 * //    { stemIdx: 2, role: 'JUNGGI', sipsin: 'SIKSHIN'  },    // 丙: 식신
 * //    { stemIdx: 0, role: 'BONGI',  sipsin: 'BIGYEON'  }]    // 甲: 비견
 */
export function getWollyeongAllSipsin(
  ilganIdx: StemIdx,
  woljiIdx: BranchIdx,
): Array<{
  stemIdx: StemIdx;
  stemHanja: string;
  role: 'YEOGI' | 'JUNGGI' | 'BONGI';
  sipsin: Sipsin;
  days: number;
}> {
  const b       = ((woljiIdx % 12) + 12) % 12;
  const entries = WOLRYEONG_SALYEONG[b as keyof typeof WOLRYEONG_SALYEONG];
  return entries.map((entry) => ({
    stemIdx:   entry.stemIdx,
    stemHanja: entry.stemHanja,
    role:      entry.role,
    sipsin:    getSipsin(ilganIdx, entry.stemIdx),
    days:      entry.days,
  }));
}

/**
 * 투출(透出) 여부를 판단한다.
 *
 * 월지의 지장간 중 사주 천간에 동일한 천간이 있는지 확인한다.
 *
 * @param woljiIdx  - 월지 인덱스 (0=子 ~ 11=亥)
 * @param cheonganStemIdxs - 사주 4천간 인덱스 배열 (년간·월간·일간·시간)
 * @returns 투출된 지장간 항목들 (투출 우선순위: 본기>중기>여기 순으로 정렬)
 *
 * @example
 * getTuchulEntries(2, [0, 4, 3, 2])
 * // 寅月, 천간=[甲, 戊, 丁, 丙]
 * // 寅의 지장간: 戊(여기), 丙(중기), 甲(본기)
 * // -> 甲(본기), 丙(중기), 戊(여기) 모두 투출 -- 본기 우선으로 정렬
 */
export function getTuchulEntries(
  woljiIdx: BranchIdx,
  cheonganStemIdxs: StemIdx[],
): SalyeongEntry[] {
  const b       = ((woljiIdx % 12) + 12) % 12;
  const entries = WOLRYEONG_SALYEONG[b as keyof typeof WOLRYEONG_SALYEONG];
  const roleOrder: Record<string, number> = { BONGI: 0, JUNGGI: 1, YEOGI: 2 };

  return entries
    .filter((entry) => cheonganStemIdxs.includes(entry.stemIdx))
    .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
}

/**
 * 월령 격국을 투출 기반으로 결정한다.
 *
 * 자평진전 원칙에 따라:
 *   1. 투출된 지장간이 있으면 가장 우선순위 높은 투출의 십신이 격
 *   2. 투출이 없으면 본기의 십신이 격
 *   3. 비견·겁재는 건록격·양인격으로 별도 처리
 *
 * @param ilganIdx          - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx          - 월지 인덱스 (0=子 ~ 11=亥)
 * @param cheonganStemIdxs  - 사주 4천간 인덱스 배열
 * @returns 격국명 (한글)과 근거 십신
 *
 * @example
 * determineGeokguk(0, 2, [0, 4, 0, 2])
 * // 甲일간, 寅월, 천간=[甲, 戊, 甲, 丙]
 * // 寅의 지장간: 戊(여기투출), 丙(중기투출), 甲(본기투출)
 * // 본기 투출 우선 -> 甲 비견 -> 건록격
 */
export function determineGeokguk(
  ilganIdx: StemIdx,
  woljiIdx: BranchIdx,
  cheonganStemIdxs: StemIdx[],
): { geokgukName: string; sipsin: Sipsin; basis: 'TUCHUL' | 'BONGI' } {
  const tuchul = getTuchulEntries(woljiIdx, cheonganStemIdxs);

  if (tuchul.length > 0) {
    // 투출 기반 격국 결정 (본기 투출 우선)
    const primary = tuchul[0];
    const sipsin = getSipsin(ilganIdx, primary.stemIdx);
    return {
      geokgukName: formatGeokgukName(sipsin),
      sipsin,
      basis: 'TUCHUL',
    };
  }

  // 투출이 없으면 본기 기준
  const sipsin = getWollyeongSipsin(ilganIdx, woljiIdx);
  return {
    geokgukName: formatGeokgukName(sipsin),
    sipsin,
    basis: 'BONGI',
  };
}

/** 십신에서 격국명 문자열을 반환하는 내부 헬퍼 */
function formatGeokgukName(sipsin: Sipsin): string {
  const names: Record<Sipsin, string> = {
    BIGYEON:   '건록격(建祿格)',
    GEOBJE:    '양인격(羊刃格)',
    SIKSHIN:   '식신격(食神格)',
    SANGGWAN:  '상관격(傷官格)',
    PYEONJAE:  '편재격(偏財格)',
    JEONGJAE:  '정재격(正財格)',
    PYEONGWAN: '편관격(偏官格)',
    JEONGGWAN: '정관격(正官格)',
    PYEONIN:   '편인격(偏印格)',
    JEONGIN:   '정인격(正印格)',
  };
  return names[sipsin];
}

/**
 * 24절기 중 절(節)만 추출하여 반환한다.
 *
 * 사주 월주 결정에 사용되는 12절만 필터링한다.
 *
 * @returns 12절 배열
 */
export function getJeolOnly(): Jeolgi24Entry[] {
  return JEOLGI_24_TABLE.filter((e) => e.type === 'JEOL');
}

/**
 * 24절기 중 중기(中)만 추출하여 반환한다.
 *
 * @returns 12중기 배열
 */
export function getJunggiOnly(): Jeolgi24Entry[] {
  return JEOLGI_24_TABLE.filter((e) => e.type === 'JUNG');
}

/**
 * 월지 인덱스에 해당하는 24절기 2개(절+중기)를 반환한다.
 *
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 절과 중기 2개 항목
 */
export function get24JeolgiByBranch(branchIdx: BranchIdx): Jeolgi24Entry[] {
  const b = ((branchIdx % 12) + 12) % 12;
  return JEOLGI_24_TABLE.filter((e) => e.branchIdx === b);
}

/**
 * 월지의 조후 특성을 반환한다.
 *
 * @param branchIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 조후 특성 또는 undefined
 */
export function getWollyeongJohu(branchIdx: BranchIdx): WollyeongJohu | undefined {
  const b = ((branchIdx % 12) + 12) % 12;
  return WOLLYEONG_JOHU_TABLE.find((j) => j.branchIdx === b);
}

/**
 * 월령 분석 종합 리포트를 생성한다.
 *
 * 일간과 월지를 받아 월령론에서 도출할 수 있는 모든 정보를 종합한다.
 *
 * @param ilganIdx         - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx         - 월지 인덱스 (0=子 ~ 11=亥)
 * @param daysAfterJeolgi  - 절기 후 경과 일수 (1부터 시작, 미상이면 undefined)
 * @returns 월령 분석 결과
 */
export function analyzeWollyeong(
  ilganIdx: StemIdx,
  woljiIdx: BranchIdx,
  daysAfterJeolgi?: number,
): {
  /** 월지 한자 */
  branchHanja: string;
  /** 절기 정보 */
  jeolgi: JeolgiWollyeong | undefined;
  /** 월지 본기 천간 한자 */
  bongiStemHanja: string;
  /** 월령 십신 (본기 기준) */
  wollyeongSipsin: Sipsin;
  /** 격국명 (본기 기준) */
  geokgukName: string;
  /** 왕쇠 판단 */
  wangSoe: WollyeongWangSoe;
  /** 현재 용사 중인 지장간 (daysAfterJeolgi 제공 시) */
  currentYongsa: SalyeongEntry | undefined;
  /** 조후 특성 */
  johu: WollyeongJohu | undefined;
  /** 모든 지장간 십신 */
  allSipsin: Array<{
    stemIdx: StemIdx;
    stemHanja: string;
    role: 'YEOGI' | 'JUNGGI' | 'BONGI';
    sipsin: Sipsin;
    days: number;
  }>;
} {
  const b = ((woljiIdx % 12) + 12) % 12;
  const bongiStemIdx = BRANCH_BONGI_STEM[b];

  return {
    branchHanja:     BRANCH_HANJA_NAMES[b],
    jeolgi:          getJeolgiInfo(woljiIdx),
    bongiStemHanja:  STEM_HANJA_NAMES[bongiStemIdx],
    wollyeongSipsin: getWollyeongSipsin(ilganIdx, woljiIdx),
    geokgukName:     getGeokgukName(ilganIdx, woljiIdx),
    wangSoe:         judgeWollyeongWangSoe(ilganIdx, woljiIdx),
    currentYongsa:   daysAfterJeolgi != null
      ? getCurrentSalyeong(woljiIdx, daysAfterJeolgi)
      : undefined,
    johu:            getWollyeongJohu(woljiIdx),
    allSipsin:       getWollyeongAllSipsin(ilganIdx, woljiIdx),
  };
}
