/**
 * 용신론(用神論) — 사주명리학 용신(用神) 이론
 *
 * 용신(用神)이란 사주팔자에서 일간(日干)을 도와 균형을 이루게 하는
 * 핵심 오행(五行) 또는 십신(十神)이다.
 *
 * 자평진전(子平眞詮), 궁통보감(窮通寶鑑), 명리약언(命理約言) 이론에 근거한다.
 *
 * 일간(日干) 로마자: GAP 甲 | EUL 乙 | BYEONG 丙 | JEONG 丁 | MU 戊
 *                   GI 己 | GYEONG 庚 | SIN 辛 | IM 壬 | GYE 癸
 *
 * 오행(五行) 로마자: MOK(木), HWA(火), TO(土), GEUM(金), SU(水)
 *
 * 용신 추출 5법(五法):
 *   1. 억부법(抑扶法) — 강한 것을 억제, 약한 것을 부조
 *   2. 조후법(調候法) — 계절 기후 조화 (궁통보감)
 *   3. 통관법(通關法) — 두 오행 사이를 연결
 *   4. 병약법(病藥法) — 병(病) 오행에 약(藥) 오행
 *   5. 전왕법(專旺法) — 전왕하는 오행 따르기
 *
 * 용신 6신(六神) 체계:
 *   용신(用神) — 핵심 균형 오행
 *   희신(喜神) — 용신을 돕는 오행
 *   기신(忌神) — 용신을 해치는 오행
 *   한신(閑神) — 중립 오행
 *   구신(仇神) — 희신을 극하는 오행
 *   원신(原神) — 용신을 생하는 오행
 */

export type Cheongan = 'GAP'|'EUL'|'BYEONG'|'JEONG'|'MU'|'GI'|'GYEONG'|'SIN'|'IM'|'GYE';
export type Ohhaeng = 'MOK' | 'HWA' | 'TO' | 'GEUM' | 'SU';

/**
 * 용신 추출 방법(方法) 유형
 *
 * EUK_BU    : 억부법(抑扶法) — 강한 것을 억제, 약한 것을 부조
 * JO_HU     : 조후법(調候法) — 계절 기후 조화
 * TONG_GWAN : 통관법(通關法) — 두 오행 사이를 연결하여 통하게 함
 * BYEONG_YAK: 병약법(病藥法) — 병(病)이 되는 오행에 약(藥)이 되는 오행
 * JEON_WANG : 전왕법(專旺法) — 전왕(專旺)하는 오행 따르기
 */
export type YongsinBangbeop =
  | 'EUK_BU' | 'JO_HU' | 'TONG_GWAN' | 'BYEONG_YAK' | 'JEON_WANG';

/**
 * 용신 관련 신(神) 역할 분류
 *
 * YONGSIN : 용신(用神) — 핵심 균형 오행
 * HEESIN  : 희신(喜神) — 용신을 돕는 오행
 * GISIN   : 기신(忌神) — 용신을 해치는 오행
 * HANSIN  : 한신(閑神) — 중립 오행
 * GUSIN   : 구신(仇神) — 희신을 극하는 오행
 * WONSIN  : 원신(原神) — 용신을 생하는 오행
 */
export type YongsinYeokhal =
  | 'YONGSIN' | 'HEESIN' | 'GISIN' | 'HANSIN' | 'GUSIN' | 'WONSIN';

// -----------------------------------------------------------------------
// 오행 상수 및 순환 테이블 (내부용)
// -----------------------------------------------------------------------

/** 오행 전체 목록 (상생 순서) */
const OH: readonly Ohhaeng[] = ['MOK', 'HWA', 'TO', 'GEUM', 'SU'] as const;

/** 오행 인덱스 맵 */
const OH_IDX: Record<Ohhaeng, number> = { MOK: 0, HWA: 1, TO: 2, GEUM: 3, SU: 4 };

/** 천간 → 오행 매핑 */
const CHEONGAN_OHHAENG: Record<Cheongan, Ohhaeng> = {
  GAP: 'MOK', EUL: 'MOK',
  BYEONG: 'HWA', JEONG: 'HWA',
  MU: 'TO', GI: 'TO',
  GYEONG: 'GEUM', SIN: 'GEUM',
  IM: 'SU', GYE: 'SU',
};

/** 상생(相生): 내가 생(生)하는 오행 — 木→火→土→金→水→木 */
const SAENG: Record<Ohhaeng, Ohhaeng> = {
  MOK: 'HWA', HWA: 'TO', TO: 'GEUM', GEUM: 'SU', SU: 'MOK',
};

/** 역생(逆生): 나를 생(生)하는 오행 */
const SAENG_REV: Record<Ohhaeng, Ohhaeng> = {
  MOK: 'SU', HWA: 'MOK', TO: 'HWA', GEUM: 'TO', SU: 'GEUM',
};

/** 상극(相剋): 내가 극(剋)하는 오행 — 木→土→水→火→金→木 */
const GEUK: Record<Ohhaeng, Ohhaeng> = {
  MOK: 'TO', TO: 'SU', SU: 'HWA', HWA: 'GEUM', GEUM: 'MOK',
};

/** 역극(逆剋): 나를 극(剋)하는 오행 */
const GEUK_REV: Record<Ohhaeng, Ohhaeng> = {
  MOK: 'GEUM', HWA: 'SU', TO: 'MOK', GEUM: 'HWA', SU: 'TO',
};

/**
 * 통관(通關) 오행 맵
 *
 * 두 오행이 상극(相剋) 관계로 대립할 때 중간에서 생(生)의 고리를
 * 연결하는 중재 오행.
 *
 *   木↔土 충돌 → 火 통관 (木生火·火生土)
 *   火↔金 충돌 → 土 통관 (火生土·土生金)
 *   土↔水 충돌 → 金 통관 (土生金·金生水)
 *   金↔木 충돌 → 水 통관 (金生水·水生木)
 *   水↔火 충돌 → 木 통관 (水生木·木生火)
 */
const TONGGWAN: Record<string, Ohhaeng> = {
  'MOK_TO':   'HWA',
  'TO_MOK':   'HWA',
  'HWA_GEUM': 'TO',
  'GEUM_HWA': 'TO',
  'TO_SU':    'GEUM',
  'SU_TO':    'GEUM',
  'GEUM_MOK': 'SU',
  'MOK_GEUM': 'SU',
  'SU_HWA':   'MOK',
  'HWA_SU':   'MOK',
};

// -----------------------------------------------------------------------
// 용신 개념 정의 인터페이스
// -----------------------------------------------------------------------

export interface YongsinGaebyeom {
  yeokhal: YongsinYeokhal;
  hanja: string;
  hangul: string;
  romanja: string;
  seolmyeong: string;
}

export const YONGSIN_GAEBYEOM: Record<YongsinYeokhal, YongsinGaebyeom> = {
  YONGSIN: {
    yeokhal: 'YONGSIN',
    hanja: '用神',
    hangul: '용신',
    romanja: 'Yongsin',
    seolmyeong: '사주팔자에서 일간(日干)의 균형을 잡아주는 핵심 오행·십신. 대운에서 용신이 올 때 발복(發福)한다.',
  },
  HEESIN: {
    yeokhal: 'HEESIN',
    hanja: '喜神',
    hangul: '희신',
    romanja: 'Heesin',
    seolmyeong: '용신(用神)을 돕거나 생(生)하는 오행·십신. 대운에서 희신이 올 때도 발복하거나 운이 좋아진다.',
  },
  GISIN: {
    yeokhal: 'GISIN',
    hanja: '忌神',
    hangul: '기신',
    romanja: 'Gisin',
    seolmyeong: '용신(用神)을 극(克)하거나 억제하는 오행·십신. 기신이 강하면 용신의 기능이 약화되어 운이 나빠진다.',
  },
  HANSIN: {
    yeokhal: 'HANSIN',
    hanja: '閑神',
    hangul: '한신',
    romanja: 'Hansin',
    seolmyeong: '사주에서 길흉에 크게 영향을 미치지 않는 중립적인 오행·십신. 경우에 따라 통관(通關) 역할을 하기도 한다.',
  },
  GUSIN: {
    yeokhal: 'GUSIN',
    hanja: '仇神',
    hangul: '구신',
    romanja: 'Gusin',
    seolmyeong: '희신(喜神)을 극(克)하는 오행·십신. 기신과 유사하나 직접 용신을 克하지 않고 희신을 克한다.',
  },
  WONSIN: {
    yeokhal: 'WONSIN',
    hanja: '原神',
    hangul: '원신',
    romanja: 'Wonsin',
    seolmyeong: '용신(用神)을 생(生)하는 오행·십신. 원신이 강하면 용신이 기운을 공급받아 강건해진다.',
  },
};

// -----------------------------------------------------------------------
// 5가지 용신 추출법 이론 데이터
// -----------------------------------------------------------------------

export interface YongsinBangbeobData {
  name: YongsinBangbeop;
  hanja: string;
  hangul: string;
  romanja: string;
  jeongui: string;
  jeokryongSogon: string;
  uiuisaang: string;
  jeok: string;
  buje: string;
}

export const YONGSIN_BANGBEOB_TABLE: Record<YongsinBangbeop, YongsinBangbeobData> = {

  /**
   * 억부법(抑扶法) — EUK_BU
   *
   * 사주에서 강한 기운을 억제(抑)하고 약한 기운을 부조(扶)하는 방법.
   * 가장 기본적이고 보편적인 용신 추출법.
   */
  EUK_BU: {
    name: 'EUK_BU',
    hanja: '抑扶法',
    hangul: '억부법',
    romanja: 'Euk-bu-beop',
    jeongui:
      '사주팔자에서 일간(日干)이 강하면 억제(抑制)하는 오행을 용신으로 삼고, '
      + '일간이 약하면 부조(扶助)하는 오행을 용신으로 삼는 방법.',
    jeokryongSogon:
      '(1) 먼저 일간의 강약(强弱)을 판단한다. '
      + '(2) 신강(身强)이면 식상·재성·관성 중 하나를 용신으로 선택한다. '
      + '(3) 신약(身弱)이면 비겁·인성 중 하나를 용신으로 선택한다. '
      + '(4) 月支(월지)와 가장 잘 조화되는 오행이 용신이다.',
    uiuisaang:
      '일간의 강약 판단 기준: 월지(月支)의 오행 지지, 득령(得令)·실령(失令), '
      + '득지(得地)·실지(失地), 득세(得勢)·실세(失勢) 등을 종합하여 판단.',
    jeok:
      '억부법은 사주 대부분에 적용할 수 있는 가장 보편적인 방법이다. '
      + '사주가 중화(中和)를 지향하는 명리학의 기본 원리에 충실하다.',
    buje:
      '일간의 강약 판단이 애매한 경우 억부법만으로는 용신 결정이 어렵다. '
      + '이 경우 조후법(調候法)을 보조적으로 활용한다.',
  },

  /**
   * 조후법(調候法) — JO_HU
   *
   * 생월(生月) 기후(氣候)의 차가움·더움·건조·습함을 조절하여 균형을 맞추는 방법.
   * 궁통보감(窮通寶鑑) 이론의 핵심. 계절과 일간의 조화에 중점을 둔다.
   */
  JO_HU: {
    name: 'JO_HU',
    hanja: '調候法',
    hangul: '조후법',
    romanja: 'Jo-hu-beop',
    jeongui:
      '생월(生月)의 기후를 조절하는 오행을 용신으로 삼는 방법. '
      + '한랭(寒冷)한 계절에 태어나면 화(火)·목(木)을 용신으로 삼고, '
      + '염열(炎熱)한 계절에 태어나면 수(水)·금(金)을 용신으로 삼는다.',
    jeokryongSogon:
      '(1) 생월(生月)의 계절과 기후를 파악한다. '
      + '(2) 일간과 생월의 오행 관계를 고려한다. '
      + '(3) 조후에 필요한 오행을 결정하고 사주에 있는지 확인한다. '
      + '(4) johuYongsin.ts의 JOHU_YONGSIN_TABLE을 참조하여 월별 용신 오행을 확인한다.',
    uiuisaang:
      '조후법은 억부법과 함께 사용하는 것이 원칙. '
      + '억부법으로 용신이 결정된 후 조후법으로 보완하는 방식이 일반적이다.',
    jeok:
      '동절(冬節) 수(水)일간이나 하절(夏節) 화(火)일간처럼 극단적 계절에 '
      + '태어난 경우에 조후법이 특히 중요하다.',
    buje:
      '봄·가을처럼 기후가 온화한 경우 조후법 적용이 어렵다. '
      + '이 경우 억부법에 더 집중하는 것이 좋다.',
  },

  /**
   * 통관법(通關法) — TONG_GWAN
   *
   * 사주에서 서로 대립하는 두 오행 사이를 통(通)하게 하는 오행을 용신으로 삼는 방법.
   * 相克(상극)하는 두 오행이 강할 때 그 중간에서 중재하는 오행이 용신이다.
   */
  TONG_GWAN: {
    name: 'TONG_GWAN',
    hanja: '通關法',
    hangul: '통관법',
    romanja: 'Tong-gwan-beop',
    jeongui:
      '사주에서 서로 극(克)하는 두 오행이 균형을 이루어 갈등을 중재하는 오행을 용신으로 삼는 방법. '
      + '예: 목(木)과 토(土)가 충돌할 때 화(火)가 목生화·화生토로 통관한다.',
    jeokryongSogon:
      '(1) 사주에서 서로 대립하는 두 오행을 파악한다. '
      + '(2) 그 두 오행 사이에서 생(生)의 고리를 연결하는 오행을 찾는다. '
      + '(3) 그 오행이 사주에 없거나 약하면 용신으로 삼는다.',
    uiuisaang:
      '통관 오행의 예:'
      + '  목(木)↔토(土) 충돌 → 화(火)가 통관 (木生火·火生土)'
      + '  화(火)↔금(金) 충돌 → 토(土)가 통관 (火生土·土生金)'
      + '  토(土)↔수(水) 충돌 → 금(金)이 통관 (土生金·金生水)'
      + '  금(金)↔목(木) 충돌 → 수(水)가 통관 (金生水·水生木)'
      + '  수(水)↔화(火) 충돌 → 목(木)이 통관 (水生木·木生火)',
    jeok: '두 오행이 강하게 대립할 때 통관법이 유효하다.',
    buje: '두 오행의 대립이 명확하지 않거나 통관 오행이 이미 사주에 강하면 적용이 어렵다.',
  },

  /**
   * 병약법(病藥法) — BYEONG_YAK
   *
   * 사주에서 병(病)이 되는 오행을 제거하는 약(藥) 오행을 용신으로 삼는 방법.
   * 사주에 특정 오행이 과도하게 많아 병(病)이 될 때 그것을 克하는 오행이 약(藥)이다.
   */
  BYEONG_YAK: {
    name: 'BYEONG_YAK',
    hanja: '病藥法',
    hangul: '병약법',
    romanja: 'Byeong-yak-beop',
    jeongui:
      '사주에서 병(病)이 되는 오행(과다하거나 방해하는 오행)에 대한 '
      + '약(藥) 오행을 용신으로 삼는 방법. '
      + '병이 있고 약이 있으면 귀하다는 원칙에 근거한다.',
    jeokryongSogon:
      '(1) 사주에서 병(病)이 되는 오행을 파악한다. '
      + '(2) 그 오행을 克하거나 억제하는 약(藥) 오행을 찾는다. '
      + '(3) 약(藥) 오행이 사주에 있으면 그것을 용신으로 삼는다. '
      + '(4) 약(藥) 오행이 없으면 대운에서 오기를 기다린다.',
    uiuisaang:
      '병약법의 핵심: 사주에 병이 있어야 적용할 수 있다. '
      + '병이 없는 사주에는 적용이 어렵다.',
    jeok: '사주에 과도한 오행이 있어 방해가 될 때 병약법이 유효하다.',
    buje: '병약법은 사주에 병(病)이 있을 때만 적용하며 병이 없으면 억부법을 따른다.',
  },

  /**
   * 전왕법(專旺法) — JEON_WANG
   *
   * 사주가 한 가지 오행으로 가득 차 전왕(專旺)할 때 그 오행을 따르는 방법.
   * 종격(從格)과 유사하며, 억부법으로 억제하지 않고 기세를 따른다.
   */
  JEON_WANG: {
    name: 'JEON_WANG',
    hanja: '專旺法',
    hangul: '전왕법',
    romanja: 'Jeon-wang-beop',
    jeongui:
      '사주 전체가 한 오행의 기운으로 가득 차 전왕(專旺)할 때 '
      + '그 오행을 따르고 강화하는 오행을 용신으로 삼는 방법. '
      + '억부법과 반대로 강한 기운에 순응하는 것이 핵심.',
    jeokryongSogon:
      '(1) 사주 전체가 한 오행의 기운으로 가득 찼는지 확인한다. '
      + '(2) 대립하는 오행이 없거나 공망(空亡)으로 무력화되어 있어야 한다. '
      + '(3) 전왕하는 오행을 강화하거나 설기(洩氣)하는 오행을 용신으로 삼는다.',
    uiuisaang:
      '전왕법은 격국론의 종격(從格)과 밀접하게 연관된다. '
      + '전왕격이 성립하면 대운에서 그 오행이 올 때 크게 발복한다.',
    jeok: '일행득기격(一行得氣格) 또는 종격에서 전왕법이 유효하다.',
    buje: '전왕 여부 판단이 어려운 경우 억부법을 우선 적용하는 것이 안전하다.',
  },
};

// -----------------------------------------------------------------------
// 용신 선택 우선순위 체계 (用神選擇優先順位)
// -----------------------------------------------------------------------

/**
 * 용신 선택 우선순위(優先順位) 체계
 *
 * 사주 분석 시 용신 추출법의 적용 우선순위를 정의한다.
 * 자평진전(子平眞詮)과 궁통보감(窮通寶鑑) 이론을 종합한 기준.
 *
 * 기본 원칙:
 *   1순위: 조후법(調候法) — 한겨울·한여름 등 극단적 기후일 때 최우선
 *   2순위: 억부법(抑扶法) — 가장 보편적인 방법, 대부분의 사주에 적용
 *   3순위: 병약법(病藥法) — 사주에 명백한 병(病)이 있을 때
 *   4순위: 통관법(通關法) — 두 오행이 강하게 대립할 때
 *   5순위: 전왕법(專旺法) — 종격(從格) 성립 시에만
 *
 * 참고: 실제 적용 시 복수의 방법이 중첩될 수 있으며,
 * 조후와 억부가 일치하면 가장 이상적이다.
 */
export interface YongsinUseonSunwi {
  /** 적용 순서 (1이 최우선) */
  sunwi: number;
  /** 용신 추출법 */
  bangbeop: YongsinBangbeop;
  /** 적용 조건 설명 */
  jogeon: string;
  /** 비고 */
  bigo: string;
}

export const YONGSIN_USEON_SUNWI: YongsinUseonSunwi[] = [
  {
    sunwi: 1,
    bangbeop: 'JO_HU',
    jogeon:
      '생월이 巳(4)·午(5)·未(6)월(한여름) 또는 亥(10)·子(11)·丑(12)월(한겨울)일 때, '
      + '기후 조절이 가장 긴급하므로 조후법을 최우선 적용한다. '
      + '궁통보감(窮通寶鑑)에서 "조후가 급(急)하면 조후를 먼저 취한다"고 했다.',
    bigo:
      '춘절(寅卯辰)·추절(申酉戌)처럼 기후가 온화한 경우에는 '
      + '조후법 우선순위가 낮아지고 억부법이 우선한다.',
  },
  {
    sunwi: 2,
    bangbeop: 'EUK_BU',
    jogeon:
      '대부분의 사주에 적용되는 가장 보편적인 방법. '
      + '일간의 신강(身强)·신약(身弱)을 판단하여 억제·부조 오행을 결정한다. '
      + '자평진전(子平眞詮)의 핵심 이론.',
    bigo:
      '조후법과 억부법이 같은 오행을 가리키면 "조후억부겸용(調候抑扶兼用)"으로 '
      + '최상의 용신이 된다.',
  },
  {
    sunwi: 3,
    bangbeop: 'BYEONG_YAK',
    jogeon:
      '사주에 특정 오행이 과도하여 병(病)이 명백히 보일 때 적용. '
      + '병이 있으면 반드시 약(藥)을 구해야 하며, '
      + '"유병유약(有病有藥)이면 귀(貴)하다"는 원칙에 따른다.',
    bigo:
      '병약법은 억부법의 세부 응용이라고 볼 수도 있다. '
      + '다만 병(病)의 진단이 뚜렷할 때 별도로 적용하면 더 정확하다.',
  },
  {
    sunwi: 4,
    bangbeop: 'TONG_GWAN',
    jogeon:
      '사주에서 두 오행이 강하게 대립(相剋)하여 팽팽한 긴장 상태일 때, '
      + '그 사이를 연결하는 통관(通關) 오행을 용신으로 삼는다.',
    bigo:
      '대립하는 두 오행의 힘이 비등할 때 통관법이 가장 효과적이다. '
      + '한 쪽이 일방적으로 강하면 억부법이나 병약법을 쓰는 것이 낫다.',
  },
  {
    sunwi: 5,
    bangbeop: 'JEON_WANG',
    jogeon:
      '사주가 전왕격(專旺格) 또는 종격(從格)으로 판별될 때에만 적용. '
      + '한 오행이 압도적이어서 억부법으로 억제하면 오히려 흉(凶)해진다. '
      + '기세를 따르는 것이 원칙.',
    bigo:
      '전왕격·종격의 판별은 매우 엄격하게 이루어져야 한다. '
      + '애매한 경우에는 억부법을 따르는 것이 안전하다.',
  },
];

// -----------------------------------------------------------------------
// 자평진전(子平眞詮) 기반 용신 이론
// -----------------------------------------------------------------------

/**
 * 자평진전(子平眞詮) 용신 이론 핵심 원칙
 *
 * 자평진전(子平眞詮)은 명(明)나라 심효첨(沈孝瞻)이 저술한
 * 사주명리의 최고 권위서로, 용신 이론의 체계를 확립하였다.
 *
 * 핵심 원칙:
 *   (1) 용신전취월령(用神專取月令) — 용신은 반드시 월령에서 취한다
 *   (2) 격국론과 용신론은 표리 관계 — 격국이 곧 용신의 기반
 *   (3) 성격(成格)과 파격(破格)의 판별이 용신의 길흉을 결정
 *   (4) 상신(相神) = 용신을 보좌하는 글자로 희신과 유사
 */
export const JAPYEONGJINJEON_YONGSIN = {
  /** 핵심 원칙: 용신전취월령(用神專取月令) */
  wonchik1:
    '용신전취월령(用神專取月令): 용신은 오로지 월령(月令)에서 취한다. '
    + '월지(月支)의 지장간(藏干)이 천간에 투출(透出)한 것이 격(格)이 되고, '
    + '이 격을 성격(成格)시키는 글자가 용신이다.',

  /** 핵심 원칙: 격용상신(格用相神) */
  wonchik2:
    '격용상신(格用相神): 격국이 정해지면 그 격을 완성·보좌하는 상신(相神)을 찾아야 한다. '
    + '상신은 희신(喜神)에 해당하며, 격국의 성패를 결정짓는 핵심 글자이다.',

  /** 핵심 원칙: 순용·역용의 구분 */
  wonchik3:
    '순용(順用)·역용(逆用)의 구분: '
    + '길신(정관·정인·정재·식신)은 보호하고 생조하는 것이 순용(順用)이다. '
    + '흉신(편관·상관·겁재·편인)은 제화(制化)하는 것이 역용(逆用)이다. '
    + '순용에서의 용신은 격을 생(生)하는 글자이고, '
    + '역용에서의 용신은 격을 제(制)하는 글자이다.',

  /** 핵심 원칙: 체용론(體用論) */
  wonchik4:
    '체용론(體用論): 일간(日干)은 체(體)이고 월령(月令)은 용(用)이다. '
    + '체가 강하면 용을 설기(洩氣)·극제(克制)하는 것이 좋고, '
    + '체가 약하면 용을 생조(生助)하는 것이 좋다.',

  /** 팔격용신(八格用神) 일람 */
  palgyeokYongsin:
    '정관격: 재성(生官)·인성(護官) / 편관격: 식신(制殺)·인성(化殺) / '
    + '정인격: 관성(生印) / 편인격: 관성(生印) / '
    + '식신격: 재성(食生財)·비겁(助食) / 상관격: 인성(制傷)·재성(傷生財) / '
    + '정재격: 식상(生財)·관성(財生官) / 편재격: 식상(生財)·관성(財生官)',
} as const;

// -----------------------------------------------------------------------
// 억부법(抑扶法) 상세 규칙
// -----------------------------------------------------------------------

/**
 * 억부법(抑扶法) 신강(身强) 억제 규칙
 *
 * 신강(身强)일 때 일간을 억제하는 오행의 우선순위와 규칙.
 *
 * 신강 억제 원칙 (자평진전):
 *   1순위: 관살(官殺) — 일간을 직접 극(克)하여 억제
 *   2순위: 재성(財星) — 일간의 기운을 소모(설기)
 *   3순위: 식상(食傷) — 일간의 기운을 빼내어(설기) 약화
 *
 * 세부 규칙:
 *   - 비겁이 과다한 신강: 관살로 비겁을 제어
 *   - 인성이 과다한 신강: 재성으로 인성을 극제
 *   - 비겁·인성 모두 강한 신강: 관살 우선, 재성 보조
 */
export interface EukBuGyuchik {
  /** 규칙 식별자 */
  id: string;
  /** 일간 상태 */
  ilganSangtae: 'SINGANG' | 'SINYAK';
  /** 용신으로 적합한 십신 그룹 */
  yongsinSipsin: string[];
  /** 해당 십신의 오행 관계 설명 */
  ohhaengGwangye: string;
  /** 우선순위 (1이 최우선) */
  useonSunwi: number;
  /** 상세 조건 */
  jogeon: string;
  /** 희신 */
  heesin: string;
}

export const EUK_BU_SINGANG_GYUCHIK: EukBuGyuchik[] = [
  {
    id: 'SINGANG_GWANSAL',
    ilganSangtae: 'SINGANG',
    yongsinSipsin: ['PYEON_GWAN', 'JEONG_GWAN'],
    ohhaengGwangye: '克我(극아) — 일간을 극하는 오행 = 관성(官星)',
    useonSunwi: 1,
    jogeon:
      '비겁(比劫)이 과다하여 신강한 경우, 관살(官殺)로 비겁을 직접 제어한다. '
      + '비겁이 강한 신강 사주에서 관살이 용신이 되면 명예와 권위를 갖출 수 있다. '
      + '단, 관살이 너무 강하면 일간이 감당하지 못하므로 인성(印星)으로 관살을 설기해야 한다.',
    heesin: '재성(財星) — 관살을 생(生)하여 용신을 강화',
  },
  {
    id: 'SINGANG_JAESEONG',
    ilganSangtae: 'SINGANG',
    yongsinSipsin: ['PYEON_JAE', 'JEONG_JAE'],
    ohhaengGwangye: '我克(아극) — 일간이 극하는 오행 = 재성(財星)',
    useonSunwi: 2,
    jogeon:
      '인성(印星)이 과다하여 신강한 경우, 재성(財星)으로 인성을 극제(克制)한다. '
      + '인성이 너무 많으면 일간이 나태해지므로 재성이 인성을 견제하면 좋다. '
      + '또한 재성은 일간의 기운을 소모(설기)시켜 균형을 맞춘다.',
    heesin: '식상(食傷) — 재성을 생(生)하여 용신을 보조',
  },
  {
    id: 'SINGANG_SIKSANG',
    ilganSangtae: 'SINGANG',
    yongsinSipsin: ['SIK_SHIN', 'SANG_GWAN'],
    ohhaengGwangye: '我生(아생) — 일간이 생하는 오행 = 식상(食傷)',
    useonSunwi: 3,
    jogeon:
      '관살이 없고 재성도 약한 신강 사주에서, 식상(食傷)으로 일간의 기운을 빼낸다. '
      + '식상은 일간을 설기(洩氣)시키고 재성을 생(生)하는 이중 효과가 있다. '
      + '식신생재(食神生財) 구조가 되면 부(富)의 명이 된다.',
    heesin: '재성(財星) — 식상이 생한 기운을 받아 실제 재물로 전환',
  },
];

export const EUK_BU_SINYAK_GYUCHIK: EukBuGyuchik[] = [
  {
    id: 'SINYAK_INSEONG',
    ilganSangtae: 'SINYAK',
    yongsinSipsin: ['JEONG_IN', 'PYEON_IN'],
    ohhaengGwangye: '生我(생아) — 일간을 생하는 오행 = 인성(印星)',
    useonSunwi: 1,
    jogeon:
      '관살(官殺)이 과다하여 신약한 경우, 인성(印星)으로 관살의 기운을 화(化)한다. '
      + '인성은 관살의 극(克)을 흡수하여 일간을 생(生)하는 이중 효과를 낸다. '
      + '살인상생(殺印相生)의 구조가 되면 학문과 권위를 겸비한 귀격이 된다.',
    heesin: '관성(官星) — 인성을 생(生)하여 관인상생(官印相生) 구도',
  },
  {
    id: 'SINYAK_BIGEOB',
    ilganSangtae: 'SINYAK',
    yongsinSipsin: ['BI_GYEON', 'GEOB_JAE'],
    ohhaengGwangye: '同(동) — 일간과 같은 오행 = 비겁(比劫)',
    useonSunwi: 2,
    jogeon:
      '식상(食傷)이나 재성(財星)이 과다하여 신약한 경우, 비겁(比劫)으로 일간을 직접 돕는다. '
      + '비겁은 일간과 같은 오행이므로 직접적인 세력 보강이 된다. '
      + '단, 비겁이 과다하면 군겁쟁재(群劫爭財)가 될 수 있으므로 주의한다.',
    heesin: '인성(印星) — 비겁을 생(生)하여 일간 세력을 더욱 강화',
  },
];

// -----------------------------------------------------------------------
// 조후법(調候法) 상세 규칙 — johuYongsin.ts 교차 참조
// -----------------------------------------------------------------------

/**
 * 조후법(調候法) 계절별 급용신(急用神) 규칙
 *
 * 조후법의 핵심은 계절의 한난조습(寒暖燥濕)을 조절하는 것이다.
 * 세부 데이터는 johuYongsin.ts의 JOHU_YONGSIN_TABLE(120개 조합)을 참조한다.
 *
 * 급용신 원칙:
 *   여름생(巳午未): 水가 급(急) — 염열(炎熱)을 식힌다
 *   겨울생(亥子丑): 火가 급(急) — 한랭(寒冷)을 따뜻하게 한다
 *   봄생(寅卯辰):  기후 온화하여 조후보다 억부 우선
 *   가을생(申酉戌): 기후 온화하여 조후보다 억부 우선
 *
 * 참고: johuYongsin.ts의 getJohuYongsin() 함수로 일간별·월별 정확한 조후용신을 조회한다.
 */
export interface JohuGyuchik {
  /** 계절 식별자 */
  gyejeol: 'CHUN' | 'HA' | 'CHU' | 'DONG';
  /** 계절 한글명 */
  gyejeolHangul: string;
  /** 해당 월지 */
  wolji: string[];
  /** 기후 특성 */
  gihu: string;
  /** 급용신 오행 */
  geubYongsin: Ohhaeng | null;
  /** 보조 용신 오행 */
  bojoYongsin: Ohhaeng | null;
  /** 조후 긴급도 */
  gingeubdo: 'HIGH' | 'MEDIUM' | 'LOW';
  /** 설명 */
  seolmyeong: string;
}

export const JOHU_GYEJEOL_GYUCHIK: JohuGyuchik[] = [
  {
    gyejeol: 'CHUN',
    gyejeolHangul: '봄(春)',
    wolji: ['IN', 'MYO', 'JIN'],
    gihu: '온화(溫和) — 목(木)의 계절, 기후가 따뜻하고 습윤',
    geubYongsin: null,
    bojoYongsin: null,
    gingeubdo: 'LOW',
    seolmyeong:
      '봄은 기후가 온화하여 조후 필요성이 낮다. '
      + '억부법을 우선 적용하고, 조후는 보조적으로만 참고한다. '
      + '단, 인월(寅月) 초봄은 아직 한기가 남아 있으므로 丙火가 필요할 수 있다.',
  },
  {
    gyejeol: 'HA',
    gyejeolHangul: '여름(夏)',
    wolji: ['SA', 'O', 'MI'],
    gihu: '염열(炎熱) — 화(火)의 계절, 극심한 더위와 건조',
    geubYongsin: 'SU',
    bojoYongsin: 'GEUM',
    gingeubdo: 'HIGH',
    seolmyeong:
      '여름은 화(火)가 극성하여 수(水)가 급용신이다. '
      + '수(水)로 열기를 식히고, 금(金)으로 수원(水源)을 확보한다. '
      + '궁통보감: "하절(夏節)에는 수(水)가 없으면 만물이 고갈된다." '
      + '세부 조합은 johuYongsin.ts JOHU_YONGSIN_TABLE 참조.',
  },
  {
    gyejeol: 'CHU',
    gyejeolHangul: '가을(秋)',
    wolji: ['SHIN', 'YU', 'SUL'],
    gihu: '서늘(凉爽) — 금(金)의 계절, 건조하고 서늘',
    geubYongsin: null,
    bojoYongsin: null,
    gingeubdo: 'LOW',
    seolmyeong:
      '가을은 기후가 온화하여 조후 필요성이 낮다. '
      + '억부법을 우선 적용한다. '
      + '단, 술월(戌月) 늦가을은 조토(燥土)가 강하므로 수(水)가 필요할 수 있다.',
  },
  {
    gyejeol: 'DONG',
    gyejeolHangul: '겨울(冬)',
    wolji: ['HAE', 'JA', 'CHUK'],
    gihu: '한랭(寒冷) — 수(水)의 계절, 극심한 추위와 습함',
    geubYongsin: 'HWA',
    bojoYongsin: 'MOK',
    gingeubdo: 'HIGH',
    seolmyeong:
      '겨울은 수(水)가 극성하여 화(火)가 급용신이다. '
      + '화(火)로 추위를 따뜻하게 하고, 목(木)으로 화(火)의 원료를 공급한다. '
      + '궁통보감: "동절(冬節)에는 화(火)가 없으면 만물이 얼어붙는다." '
      + '세부 조합은 johuYongsin.ts JOHU_YONGSIN_TABLE 참조.',
  },
];

// -----------------------------------------------------------------------
// 통관법(通關法) 상세 규칙
// -----------------------------------------------------------------------

/**
 * 통관법(通關法) 대립 오행 → 통관 오행 테이블
 *
 * 두 오행이 상극(相剋)하여 대립할 때, 그 사이를 연결하는
 * 생(生)의 고리를 만들어주는 통관(通關) 오행을 정의한다.
 *
 * 통관 원리: A克B 관계에서, A가 생하고 B를 생하는 오행 C가 통관.
 * 즉, A → C → B 의 상생 경로가 만들어진다.
 */
export interface TonggwanGyuchik {
  /** 대립 오행 1 (극하는 쪽) */
  geukja: Ohhaeng;
  /** 대립 오행 2 (극당하는 쪽) */
  pigeukja: Ohhaeng;
  /** 통관 오행 */
  tonggwan: Ohhaeng;
  /** 상생 경로 설명 */
  sangsaengGyeongno: string;
  /** 적용 조건 */
  jogeon: string;
}

export const TONGGWAN_GYUCHIK_TABLE: TonggwanGyuchik[] = [
  {
    geukja: 'MOK',
    pigeukja: 'TO',
    tonggwan: 'HWA',
    sangsaengGyeongno: '木生火 → 火生土: 목(木)이 화(火)를 생하고, 화(火)가 토(土)를 생한다.',
    jogeon: '木과 土가 모두 강하게 대립할 때 火가 통관. 火가 사주에 약하거나 없으면 용신으로 삼는다.',
  },
  {
    geukja: 'HWA',
    pigeukja: 'GEUM',
    tonggwan: 'TO',
    sangsaengGyeongno: '火生土 → 土生金: 화(火)가 토(土)를 생하고, 토(土)가 금(金)을 생한다.',
    jogeon: '火와 金이 모두 강하게 대립할 때 土가 통관. 土가 사주에 약하거나 없으면 용신으로 삼는다.',
  },
  {
    geukja: 'TO',
    pigeukja: 'SU',
    tonggwan: 'GEUM',
    sangsaengGyeongno: '土生金 → 金生水: 토(土)가 금(金)을 생하고, 금(金)이 수(水)를 생한다.',
    jogeon: '土와 水가 모두 강하게 대립할 때 金이 통관. 金이 사주에 약하거나 없으면 용신으로 삼는다.',
  },
  {
    geukja: 'GEUM',
    pigeukja: 'MOK',
    tonggwan: 'SU',
    sangsaengGyeongno: '金生水 → 水生木: 금(金)이 수(水)를 생하고, 수(水)가 목(木)을 생한다.',
    jogeon: '金과 木이 모두 강하게 대립할 때 水가 통관. 水가 사주에 약하거나 없으면 용신으로 삼는다.',
  },
  {
    geukja: 'SU',
    pigeukja: 'HWA',
    tonggwan: 'MOK',
    sangsaengGyeongno: '水生木 → 木生火: 수(水)가 목(木)을 생하고, 목(木)이 화(火)를 생한다.',
    jogeon: '水와 火가 모두 강하게 대립할 때 木이 통관. 木이 사주에 약하거나 없으면 용신으로 삼는다.',
  },
];

// -----------------------------------------------------------------------
// 병약법(病藥法) 상세 규칙
// -----------------------------------------------------------------------

/**
 * 병약법(病藥法) 병(病)·약(藥) 관계 테이블
 *
 * 사주에 특정 오행이 과다(과왕)하여 병(病)이 될 때,
 * 그 병을 치료하는 약(藥)에 해당하는 오행을 정의한다.
 *
 * 병약법 핵심 원칙:
 *   (1) 유병유약(有病有藥): 병이 있고 약이 있으면 오히려 귀(貴)하다.
 *   (2) 유병무약(有病無藥): 병이 있는데 약이 없으면 빈천(貧賤)하다.
 *   (3) 무병무약(無病無藥): 병도 약도 없으면 평범하다.
 *   (4) 약봉병지(藥逢病地): 약(藥)이 대운·세운에서 올 때 발복한다.
 */
export interface ByeongYakGyuchik {
  /** 병(病) 오행 — 과다한 오행 */
  byeong: Ohhaeng;
  /** 약(藥) 오행 — 병을 克하는 오행 */
  yak: Ohhaeng;
  /** 보조 약(藥) — 병을 설기(洩氣)하는 오행 */
  bojoYak: Ohhaeng;
  /** 병(病)의 양상 */
  byeongYangsang: string;
  /** 약(藥)의 작용 */
  yakJagyong: string;
}

export const BYEONG_YAK_TABLE: ByeongYakGyuchik[] = [
  {
    byeong: 'MOK',
    yak: 'GEUM',
    bojoYak: 'HWA',
    byeongYangsang:
      '목(木)이 과다하면: 일간을 과도하게 생(生)하거나(인성과다), '
      + '비겁이 과다하여 재성(土)을 극하며, 토(土)가 소진된다.',
    yakJagyong:
      '금(金)으로 목(木)을 직접 극제(克制)한다. '
      + '보조적으로 화(火)로 목(木)을 설기(洩氣)시킨다.',
  },
  {
    byeong: 'HWA',
    yak: 'SU',
    bojoYak: 'TO',
    byeongYangsang:
      '화(火)가 과다하면: 금(金)을 녹이고, 수(水)를 증발시키며, '
      + '만물이 타서 고갈된다. 조열(燥熱)이 극심하다.',
    yakJagyong:
      '수(水)로 화(火)를 직접 극제한다. '
      + '보조적으로 토(土)로 화(火)를 설기시킨다.',
  },
  {
    byeong: 'TO',
    yak: 'MOK',
    bojoYak: 'GEUM',
    byeongYangsang:
      '토(土)가 과다하면: 수(水)를 막고, 금(金)을 매몰시키며, '
      + '사주가 탁하고 둔중해진다.',
    yakJagyong:
      '목(木)으로 토(土)를 직접 극제(소토疏土)한다. '
      + '보조적으로 금(金)으로 토(土)를 설기시킨다.',
  },
  {
    byeong: 'GEUM',
    yak: 'HWA',
    bojoYak: 'SU',
    byeongYangsang:
      '금(金)이 과다하면: 목(木)을 상하게 하고, '
      + '숙살(肅殺)의 기운이 극심하여 생기(生氣)가 부족하다.',
    yakJagyong:
      '화(火)로 금(金)을 직접 극제(단련鍛鍊)한다. '
      + '보조적으로 수(水)로 금(金)을 설기시킨다.',
  },
  {
    byeong: 'SU',
    yak: 'TO',
    bojoYak: 'MOK',
    byeongYangsang:
      '수(水)가 과다하면: 화(火)를 끄고, 토(土)를 무너뜨리며, '
      + '범람(泛濫)하여 기반이 불안정하다.',
    yakJagyong:
      '토(土)로 수(水)를 직접 극제(제방堤防)한다. '
      + '보조적으로 목(木)으로 수(水)를 설기시킨다.',
  },
];

/**
 * 병약법 원칙 — 유병유약 등급 판정
 *
 * 사주의 병약(病藥) 상태에 따른 등급을 판정한다.
 */
export const BYEONG_YAK_DEUNGGUB = {
  /** 유병유약(有病有藥) — 병이 있고 약도 있는 최상의 구조 */
  YUBYEONG_YUYAK:
    '유병유약(有病有藥): 사주에 병(病)이 있고 약(藥)도 있으면 귀(貴)하다. '
    + '병이 있어야 약의 가치가 드러나고, 대운에서 약(藥) 운이 오면 크게 발복한다. '
    + '"유병방위귀(有病方爲貴), 무상불시기(無傷不是奇)" — 병이 있어야 비로소 귀하다.',

  /** 유병무약(有病無藥) — 병이 있으나 약이 없는 흉한 구조 */
  YUBYEONG_MUYAK:
    '유병무약(有病無藥): 사주에 병(病)만 있고 약(藥)이 없으면 빈천(貧賤)하다. '
    + '대운에서 약(藥) 운이 오면 일시적으로 좋아지지만, 근본적 해결이 어렵다.',

  /** 무병무약(無病無藥) — 병도 약도 없는 평범한 구조 */
  MUBYEONG_MUYAK:
    '무병무약(無病無藥): 사주에 병(病)도 약(藥)도 없으면 평범하다. '
    + '큰 기복(起伏) 없이 무난한 삶을 살지만, 크게 발복하기도 어렵다.',

  /** 무병유약(無病有藥) — 약이 오히려 해가 되는 구조 */
  MUBYEONG_YUYAK:
    '무병유약(無病有藥): 사주에 병(病)이 없는데 약(藥) 역할의 오행이 있으면, '
    + '그 오행이 오히려 사주의 균형을 깨뜨릴 수 있다.',
} as const;

// -----------------------------------------------------------------------
// 전왕법(專旺法) 상세 규칙 — 종격(從格)과 전왕격(專旺格)
// -----------------------------------------------------------------------

/**
 * 전왕법(專旺法) 종격 유형별 용신 규칙
 *
 * 전왕격(專旺格) — 일간의 오행이 사주를 압도
 * 종격(從格) — 일간이 극약하여 강한 오행을 따라감
 *
 * 전왕격 5종 (일행득기격):
 *   곡직격(曲直格): 木 전왕 — 용신 木·水, 기신 金
 *   염상격(炎上格): 火 전왕 — 용신 火·木, 기신 水
 *   가색격(稼穡格): 土 전왕 — 용신 土·火, 기신 木
 *   종혁격(從革格): 金 전왕 — 용신 金·土, 기신 火
 *   윤하격(潤下格): 水 전왕 — 용신 水·金, 기신 土
 *
 * 종격 5종:
 *   종재격(從財格): 재성 종 — 용신 재성·식상, 기신 비겁·인성
 *   종살격(從殺格): 관살 종 — 용신 관살·재성, 기신 비겁·인성
 *   종아격(從兒格): 식상 종 — 용신 식상·재성, 기신 인성
 *   종강격(從强格): 비겁인성 종 — 용신 비겁·인성, 기신 관살·재성
 *   종왕격(從旺格): 비겁 종 — 용신 비겁, 기신 관살·재성
 */
export interface JeonwangGyuchik {
  /** 격국 식별자 */
  gyeokguk: string;
  /** 한자 */
  hanja: string;
  /** 한글 */
  hangul: string;
  /** 전왕하는 오행 또는 십신 그룹 */
  juwangOhhaeng: string;
  /** 용신(用神) 오행 */
  yongsinOhhaeng: Ohhaeng[];
  /** 희신(喜神) 오행 */
  heesinOhhaeng: Ohhaeng[];
  /** 기신(忌神) 오행 — 이 오행이 오면 파격 */
  gisinOhhaeng: Ohhaeng[];
  /** 성립 조건 */
  seongnipJogeon: string;
  /** 파격 조건 */
  pagyeokJogeon: string;
}

export const JEONWANG_GYUCHIK_TABLE: JeonwangGyuchik[] = [
  // --- 전왕격 5종 (일행득기격) ---
  {
    gyeokguk: 'GOKJIK_GYEOK',
    hanja: '曲直格',
    hangul: '곡직격',
    juwangOhhaeng: 'MOK(木)',
    yongsinOhhaeng: ['MOK', 'SU'],
    heesinOhhaeng: ['SU', 'MOK'],
    gisinOhhaeng: ['GEUM'],
    seongnipJogeon:
      '일간이 甲·乙(木)이고 지지에 寅卯辰 방합 또는 亥卯未 삼합이 있으며, '
      + '金 기운이 없거나 무력화되어 있을 때 성립.',
    pagyeokJogeon:
      '庚·辛(金)이 천간에 투출하거나, 대운에서 金 운이 올 때 파격.',
  },
  {
    gyeokguk: 'YEOMSANG_GYEOK',
    hanja: '炎上格',
    hangul: '염상격',
    juwangOhhaeng: 'HWA(火)',
    yongsinOhhaeng: ['HWA', 'MOK'],
    heesinOhhaeng: ['MOK', 'HWA'],
    gisinOhhaeng: ['SU'],
    seongnipJogeon:
      '일간이 丙·丁(火)이고 지지에 巳午未 방합 또는 寅午戌 삼합이 있으며, '
      + '水 기운이 없거나 무력화되어 있을 때 성립.',
    pagyeokJogeon:
      '壬·癸(水)가 천간에 투출하거나, 대운에서 水 운이 올 때 파격.',
  },
  {
    gyeokguk: 'GASAEK_GYEOK',
    hanja: '稼穡格',
    hangul: '가색격',
    juwangOhhaeng: 'TO(土)',
    yongsinOhhaeng: ['TO', 'HWA'],
    heesinOhhaeng: ['HWA', 'TO'],
    gisinOhhaeng: ['MOK'],
    seongnipJogeon:
      '일간이 戊·己(土)이고 지지에 辰戌丑未가 모두 있거나(사고전四庫全), '
      + '木 기운이 없거나 무력화되어 있을 때 성립.',
    pagyeokJogeon:
      '甲·乙(木)이 천간에 투출하거나, 대운에서 木 운이 올 때 파격.',
  },
  {
    gyeokguk: 'JONGHYEOK_GYEOK',
    hanja: '從革格',
    hangul: '종혁격',
    juwangOhhaeng: 'GEUM(金)',
    yongsinOhhaeng: ['GEUM', 'TO'],
    heesinOhhaeng: ['TO', 'GEUM'],
    gisinOhhaeng: ['HWA'],
    seongnipJogeon:
      '일간이 庚·辛(金)이고 지지에 申酉戌 방합 또는 巳酉丑 삼합이 있으며, '
      + '火 기운이 없거나 무력화되어 있을 때 성립.',
    pagyeokJogeon:
      '丙·丁(火)이 천간에 투출하거나, 대운에서 火 운이 올 때 파격.',
  },
  {
    gyeokguk: 'YUNHA_GYEOK',
    hanja: '潤下格',
    hangul: '윤하격',
    juwangOhhaeng: 'SU(水)',
    yongsinOhhaeng: ['SU', 'GEUM'],
    heesinOhhaeng: ['GEUM', 'SU'],
    gisinOhhaeng: ['TO'],
    seongnipJogeon:
      '일간이 壬·癸(水)이고 지지에 亥子丑 방합 또는 申子辰 삼합이 있으며, '
      + '土 기운이 없거나 무력화되어 있을 때 성립.',
    pagyeokJogeon:
      '戊·己(土)가 천간에 투출하거나, 대운에서 土 운이 올 때 파격.',
  },

  // --- 종격 5종 ---
  {
    gyeokguk: 'JONG_JAE_GYEOK',
    hanja: '從財格',
    hangul: '종재격',
    juwangOhhaeng: '재성(財星)',
    yongsinOhhaeng: ['TO', 'HWA'],  // 예시: 木일간 기준 재성=土, 식상=火
    heesinOhhaeng: ['HWA', 'TO'],
    gisinOhhaeng: ['MOK', 'SU'],
    seongnipJogeon:
      '일간이 극약하고 재성(財星)이 사주를 압도할 때 성립. '
      + '인성(印星)·비겁(比劫)이 없거나 공망으로 무력화되어야 한다. '
      + '참고: 용신/기신 오행은 일간에 따라 달라진다.',
    pagyeokJogeon:
      '인성이나 비겁이 대운에서 오면 파격. '
      + '일간에 통근(通根)이 생기면 종격이 깨진다.',
  },
  {
    gyeokguk: 'JONG_SAL_GYEOK',
    hanja: '從殺格',
    hangul: '종살격',
    juwangOhhaeng: '관살(官殺)',
    yongsinOhhaeng: ['GEUM', 'TO'],  // 예시: 木일간 기준 관살=金, 재성=土
    heesinOhhaeng: ['TO', 'GEUM'],
    gisinOhhaeng: ['MOK', 'SU'],
    seongnipJogeon:
      '일간이 극약하고 관살(官殺)이 사주를 압도할 때 성립. '
      + '인성·비겁이 없거나 무력화되어야 한다. '
      + '참고: 용신/기신 오행은 일간에 따라 달라진다.',
    pagyeokJogeon:
      '인성이나 비겁이 대운에서 오면 파격.',
  },
  {
    gyeokguk: 'JONG_A_GYEOK',
    hanja: '從兒格',
    hangul: '종아격',
    juwangOhhaeng: '식상(食傷)',
    yongsinOhhaeng: ['HWA', 'TO'],  // 예시: 木일간 기준 식상=火, 재성=土
    heesinOhhaeng: ['HWA', 'TO'],
    gisinOhhaeng: ['SU', 'GEUM'],
    seongnipJogeon:
      '일간이 극약하고 식상(食傷)이 사주를 압도할 때 성립. '
      + '인성이 없고 비겁도 약해야 한다. '
      + '참고: 용신/기신 오행은 일간에 따라 달라진다.',
    pagyeokJogeon:
      '인성이 대운에서 오면 식상을 극하여 파격.',
  },
  {
    gyeokguk: 'JONG_GANG_GYEOK',
    hanja: '從强格',
    hangul: '종강격',
    juwangOhhaeng: '비겁·인성',
    yongsinOhhaeng: ['MOK', 'SU'],  // 예시: 木일간 기준 비겁=木, 인성=水
    heesinOhhaeng: ['SU', 'MOK'],
    gisinOhhaeng: ['GEUM', 'TO', 'HWA'],
    seongnipJogeon:
      '인성과 비겁이 사주 전체를 지배하고 '
      + '관성·재성·식상이 없거나 무력화될 때 성립. '
      + '참고: 용신/기신 오행은 일간에 따라 달라진다.',
    pagyeokJogeon:
      '관성·재성·식상이 대운에서 오면 파격.',
  },
  {
    gyeokguk: 'JONG_WANG_GYEOK',
    hanja: '從旺格',
    hangul: '종왕격',
    juwangOhhaeng: '비겁',
    yongsinOhhaeng: ['MOK'],  // 예시: 木일간 기준 비겁=木
    heesinOhhaeng: ['MOK'],
    gisinOhhaeng: ['GEUM', 'TO'],
    seongnipJogeon:
      '비겁이 사주 전체를 완전히 지배하고 '
      + '관성·재성·인성·식상이 모두 없을 때 성립. '
      + '참고: 용신/기신 오행은 일간에 따라 달라진다.',
    pagyeokJogeon:
      '관성·재성이 대운에서 오면 파격하여 매우 위험.',
  },
];

// -----------------------------------------------------------------------
// 일간별 용신·희신·기신·한신·구신·원신 관계 테이블
// -----------------------------------------------------------------------

/**
 * 일간별 6신(六神) 관계
 *
 * 용신(用神)이 결정되면 나머지 5신(喜·忌·閑·仇·原)이 자동으로 정해진다.
 *
 * 관계 법칙:
 *   용신(用神) = Y
 *   원신(原神) = Y를 생(生)하는 오행
 *   희신(喜神) = 원신과 같거나, 용신을 돕는 오행
 *   기신(忌神) = Y를 극(克)하는 오행
 *   구신(仇神) = 희신을 극하는 오행 (= 기신을 생하는 오행)
 *   한신(閑神) = 나머지 (길흉에 큰 영향 없는 오행)
 */
export interface YuksinGwangyeEntry {
  /** 용신 오행 */
  yongsin: Ohhaeng;
  /** 희신 오행 — 용신을 생(生)하는 오행 */
  heesin: Ohhaeng;
  /** 기신 오행 — 용신을 극(克)하는 오행 */
  gisin: Ohhaeng;
  /** 구신 오행 — 희신을 극(克)하는 오행 */
  gusin: Ohhaeng;
  /** 한신 오행 — 나머지 중립 오행 */
  hansin: Ohhaeng;
  /** 원신 오행 — 용신을 생(生)하는 오행 (= 희신과 동일) */
  wonsin: Ohhaeng;
}

/**
 * 용신 오행별 6신(六神) 관계 테이블
 *
 * 용신이 어떤 오행이냐에 따라 희신·기신·구신·한신·원신이 결정된다.
 *
 * 산출 공식:
 *   원신(原神) = 용신을 생하는 오행 (상생 역방향)
 *   희신(喜神) = 원신과 동일 (용신을 생하는 오행)
 *   기신(忌神) = 용신을 극하는 오행 (상극 역방향)
 *   구신(仇神) = 기신을 생하는 오행 = 희신을 극하는 오행
 *   한신(閑神) = 용신이 생하는 오행 (설기 대상, 중립)
 */
export const YUKSIN_GWANGYE_TABLE: Record<Ohhaeng, YuksinGwangyeEntry> = {
  MOK: {
    yongsin: 'MOK',
    heesin: 'SU',     // 水生木: 수(水)가 목(木)을 생한다
    gisin: 'GEUM',    // 金克木: 금(金)이 목(木)을 극한다
    gusin: 'TO',      // 土生金: 토(土)가 금(金)을 생하고, 토(土)가 수(水)를 극한다
    hansin: 'HWA',    // 木生火: 화(火)는 목(木)이 생하는 대상 (설기), 중립
    wonsin: 'SU',     // 水生木: 수(水)가 목(木)을 생한다
  },
  HWA: {
    yongsin: 'HWA',
    heesin: 'MOK',    // 木生火: 목(木)이 화(火)를 생한다
    gisin: 'SU',      // 水克火: 수(水)가 화(火)를 극한다
    gusin: 'GEUM',    // 金生水: 금(金)이 수(水)를 생하고, 금(金)이 목(木)을 극한다
    hansin: 'TO',     // 火生土: 토(土)는 화(火)가 생하는 대상, 중립
    wonsin: 'MOK',    // 木生火: 목(木)이 화(火)를 생한다
  },
  TO: {
    yongsin: 'TO',
    heesin: 'HWA',    // 火生土: 화(火)가 토(土)를 생한다
    gisin: 'MOK',     // 木克土: 목(木)이 토(土)를 극한다
    gusin: 'SU',      // 水生木: 수(水)가 목(木)을 생하고, 수(水)가 화(火)를 극한다
    hansin: 'GEUM',   // 土生金: 금(金)은 토(土)가 생하는 대상, 중립
    wonsin: 'HWA',    // 火生土: 화(火)가 토(土)를 생한다
  },
  GEUM: {
    yongsin: 'GEUM',
    heesin: 'TO',     // 土生金: 토(土)가 금(金)을 생한다
    gisin: 'HWA',     // 火克金: 화(火)가 금(金)을 극한다
    gusin: 'MOK',     // 木生火: 목(木)이 화(火)를 생하고, 목(木)이 토(土)를 극한다
    hansin: 'SU',     // 金生水: 수(水)는 금(金)이 생하는 대상, 중립
    wonsin: 'TO',     // 土生金: 토(土)가 금(金)을 생한다
  },
  SU: {
    yongsin: 'SU',
    heesin: 'GEUM',   // 金生水: 금(金)이 수(水)를 생한다
    gisin: 'TO',      // 土克水: 토(土)가 수(水)를 극한다
    gusin: 'HWA',     // 火生土: 화(火)가 토(土)를 생하고, 화(火)가 금(金)을 극한다
    hansin: 'MOK',    // 水生木: 목(木)은 수(水)가 생하는 대상, 중립
    wonsin: 'GEUM',   // 金生水: 금(金)이 수(水)를 생한다
  },
};

// -----------------------------------------------------------------------
// 일간별 억부법 용신 상세 테이블 (10천간 × 신강/신약)
// -----------------------------------------------------------------------

/**
 * 일간별 신강·신약 시 용신·희신·기신 오행 테이블
 *
 * 각 일간(10천간)에 대해 신강(身强)일 때와 신약(身弱)일 때의
 * 용신·희신·기신 오행을 구체적으로 지정한다.
 *
 * 오행 관계 기반:
 *   일간 오행 = X
 *   비겁 = X와 같은 오행
 *   인성 = X를 생하는 오행
 *   식상 = X가 생하는 오행
 *   재성 = X가 극하는 오행
 *   관살 = X를 극하는 오행
 */
export interface IlganYongsinEntry {
  /** 일간 로마자 */
  ilgan: Cheongan;
  /** 일간 한자 */
  hanja: string;
  /** 일간 오행 */
  ohhaeng: Ohhaeng;
  /** 신강(身强) 시 용신 오행 (우선순위순) */
  singangYongsin: Ohhaeng[];
  /** 신강(身强) 시 희신 오행 */
  singangHeesin: Ohhaeng[];
  /** 신강(身强) 시 기신 오행 */
  singangGisin: Ohhaeng[];
  /** 신약(身弱) 시 용신 오행 (우선순위순) */
  sinyakYongsin: Ohhaeng[];
  /** 신약(身弱) 시 희신 오행 */
  sinyakHeesin: Ohhaeng[];
  /** 신약(身弱) 시 기신 오행 */
  sinyakGisin: Ohhaeng[];
}

export const ILGAN_YONGSIN_TABLE: IlganYongsinEntry[] = [
  // 甲(GAP) — 木일간
  {
    ilgan: 'GAP', hanja: '甲', ohhaeng: 'MOK',
    singangYongsin: ['GEUM', 'TO', 'HWA'],   // 관살(金), 재성(土), 식상(火)
    singangHeesin: ['TO', 'HWA'],             // 재성·식상이 관살을 보조
    singangGisin: ['MOK', 'SU'],              // 비겁(木)·인성(水)은 기신
    sinyakYongsin: ['SU', 'MOK'],             // 인성(水), 비겁(木)
    sinyakHeesin: ['GEUM', 'SU'],             // 金生水로 인성 보조
    sinyakGisin: ['GEUM', 'TO', 'HWA'],       // 관살·재성·식상은 기신
  },
  // 乙(EUL) — 木일간
  {
    ilgan: 'EUL', hanja: '乙', ohhaeng: 'MOK',
    singangYongsin: ['GEUM', 'TO', 'HWA'],
    singangHeesin: ['TO', 'HWA'],
    singangGisin: ['MOK', 'SU'],
    sinyakYongsin: ['SU', 'MOK'],
    sinyakHeesin: ['GEUM', 'SU'],
    sinyakGisin: ['GEUM', 'TO', 'HWA'],
  },
  // 丙(BYEONG) — 火일간
  {
    ilgan: 'BYEONG', hanja: '丙', ohhaeng: 'HWA',
    singangYongsin: ['SU', 'GEUM', 'TO'],     // 관살(水), 재성(金), 식상(土)
    singangHeesin: ['GEUM', 'TO'],
    singangGisin: ['HWA', 'MOK'],
    sinyakYongsin: ['MOK', 'HWA'],            // 인성(木), 비겁(火)
    sinyakHeesin: ['SU', 'MOK'],
    sinyakGisin: ['SU', 'GEUM', 'TO'],
  },
  // 丁(JEONG) — 火일간
  {
    ilgan: 'JEONG', hanja: '丁', ohhaeng: 'HWA',
    singangYongsin: ['SU', 'GEUM', 'TO'],
    singangHeesin: ['GEUM', 'TO'],
    singangGisin: ['HWA', 'MOK'],
    sinyakYongsin: ['MOK', 'HWA'],
    sinyakHeesin: ['SU', 'MOK'],
    sinyakGisin: ['SU', 'GEUM', 'TO'],
  },
  // 戊(MU) — 土일간
  {
    ilgan: 'MU', hanja: '戊', ohhaeng: 'TO',
    singangYongsin: ['MOK', 'SU', 'GEUM'],    // 관살(木), 재성(水), 식상(金)
    singangHeesin: ['SU', 'GEUM'],
    singangGisin: ['TO', 'HWA'],
    sinyakYongsin: ['HWA', 'TO'],             // 인성(火), 비겁(土)
    sinyakHeesin: ['MOK', 'HWA'],
    sinyakGisin: ['MOK', 'SU', 'GEUM'],
  },
  // 己(GI) — 土일간
  {
    ilgan: 'GI', hanja: '己', ohhaeng: 'TO',
    singangYongsin: ['MOK', 'SU', 'GEUM'],
    singangHeesin: ['SU', 'GEUM'],
    singangGisin: ['TO', 'HWA'],
    sinyakYongsin: ['HWA', 'TO'],
    sinyakHeesin: ['MOK', 'HWA'],
    sinyakGisin: ['MOK', 'SU', 'GEUM'],
  },
  // 庚(GYEONG) — 金일간
  {
    ilgan: 'GYEONG', hanja: '庚', ohhaeng: 'GEUM',
    singangYongsin: ['HWA', 'MOK', 'SU'],     // 관살(火), 재성(木), 식상(水)
    singangHeesin: ['MOK', 'SU'],
    singangGisin: ['GEUM', 'TO'],
    sinyakYongsin: ['TO', 'GEUM'],            // 인성(土), 비겁(金)
    sinyakHeesin: ['HWA', 'TO'],
    sinyakGisin: ['HWA', 'MOK', 'SU'],
  },
  // 辛(SIN) — 金일간
  {
    ilgan: 'SIN', hanja: '辛', ohhaeng: 'GEUM',
    singangYongsin: ['HWA', 'MOK', 'SU'],
    singangHeesin: ['MOK', 'SU'],
    singangGisin: ['GEUM', 'TO'],
    sinyakYongsin: ['TO', 'GEUM'],
    sinyakHeesin: ['HWA', 'TO'],
    sinyakGisin: ['HWA', 'MOK', 'SU'],
  },
  // 壬(IM) — 水일간
  {
    ilgan: 'IM', hanja: '壬', ohhaeng: 'SU',
    singangYongsin: ['TO', 'HWA', 'MOK'],     // 관살(土), 재성(火), 식상(木)
    singangHeesin: ['HWA', 'MOK'],
    singangGisin: ['SU', 'GEUM'],
    sinyakYongsin: ['GEUM', 'SU'],            // 인성(金), 비겁(水)
    sinyakHeesin: ['TO', 'GEUM'],
    sinyakGisin: ['TO', 'HWA', 'MOK'],
  },
  // 癸(GYE) — 水일간
  {
    ilgan: 'GYE', hanja: '癸', ohhaeng: 'SU',
    singangYongsin: ['TO', 'HWA', 'MOK'],
    singangHeesin: ['HWA', 'MOK'],
    singangGisin: ['SU', 'GEUM'],
    sinyakYongsin: ['GEUM', 'SU'],
    sinyakHeesin: ['TO', 'GEUM'],
    sinyakGisin: ['TO', 'HWA', 'MOK'],
  },
];

// -----------------------------------------------------------------------
// 용신 활용법 — 대운(大運)·세운(歲運) 길흉 판단
// -----------------------------------------------------------------------

/**
 * 용신 대운·세운 활용법
 *
 * 용신(用神)이 결정되면, 대운(大運)·세운(歲運)에서 해당 오행을 만날 때의
 * 길흉(吉凶)을 판단할 수 있다.
 *
 * 기본 원칙:
 *   - 대운·세운에서 용신(用神)을 만나면 = 길(吉), 발복(發福)
 *   - 대운·세운에서 희신(喜神)을 만나면 = 소길(小吉), 순탄
 *   - 대운·세운에서 기신(忌神)을 만나면 = 흉(凶), 재난·질병·손재
 *   - 대운·세운에서 구신(仇神)을 만나면 = 소흉(小凶), 방해
 *   - 대운·세운에서 한신(閑神)을 만나면 = 평(平), 큰 변동 없음
 *   - 대운·세운에서 원신(原神)을 만나면 = 길(吉), 용신에 힘을 보탬
 */
export interface UnseYongsinHwalyong {
  /** 만나는 신(神)의 역할 */
  yuksin: YongsinYeokhal;
  /** 길흉 판단 */
  gilhyung: 'DAEGIL' | 'GIL' | 'SOGIL' | 'PYEONG' | 'SOHYUNG' | 'HYUNG' | 'DAEHYUNG';
  /** 길흉 한글 */
  gilhyungHangul: string;
  /** 상세 설명 */
  seolmyeong: string;
  /** 구체적 발현 */
  balhyeon: string[];
}

export const UNSE_YONGSIN_HWALYONG: UnseYongsinHwalyong[] = [
  {
    yuksin: 'YONGSIN',
    gilhyung: 'DAEGIL',
    gilhyungHangul: '대길(大吉)',
    seolmyeong:
      '대운·세운에서 용신(用神)을 만나면 사주의 균형이 완성되어 최고의 운세가 발현된다. '
      + '10년 대운에서 용신을 만나면 그 기간 동안 크게 발복한다.',
    balhyeon: [
      '승진·합격·명예 획득',
      '사업 성공·재물 증가',
      '건강 회복·장수',
      '좋은 인연·결혼·출산',
      '학업 성취·자격 취득',
    ],
  },
  {
    yuksin: 'HEESIN',
    gilhyung: 'GIL',
    gilhyungHangul: '길(吉)',
    seolmyeong:
      '대운·세운에서 희신(喜神)을 만나면 용신을 돕는 기운이 더해져 운세가 좋아진다. '
      + '용신만큼 극적이지는 않지만 전반적으로 순탄하다.',
    balhyeon: [
      '꾸준한 발전과 성장',
      '안정적인 재물 운',
      '건강 유지·정서 안정',
      '대인관계 원만',
    ],
  },
  {
    yuksin: 'WONSIN',
    gilhyung: 'GIL',
    gilhyungHangul: '길(吉)',
    seolmyeong:
      '대운·세운에서 원신(原神)을 만나면 용신에 기운을 공급하여 간접적으로 길하다. '
      + '원신이 강해지면 용신도 자연히 강해진다.',
    balhyeon: [
      '용신의 기운이 강화됨',
      '잠재력 발현·기회 포착',
      '귀인(貴人)의 도움',
    ],
  },
  {
    yuksin: 'HANSIN',
    gilhyung: 'PYEONG',
    gilhyungHangul: '평(平)',
    seolmyeong:
      '대운·세운에서 한신(閑神)을 만나면 길흉에 큰 영향이 없다. '
      + '무난하게 지나가는 시기이다.',
    balhyeon: [
      '큰 변동 없는 평온한 시기',
      '현상 유지',
    ],
  },
  {
    yuksin: 'GUSIN',
    gilhyung: 'SOHYUNG',
    gilhyungHangul: '소흉(小凶)',
    seolmyeong:
      '대운·세운에서 구신(仇神)을 만나면 희신을 극하여 용신의 보조가 약화된다. '
      + '직접적 흉은 아니지만 방해와 지연이 생긴다.',
    balhyeon: [
      '계획 지연·방해',
      '소소한 구설·다툼',
      '기대에 미치지 못하는 결과',
    ],
  },
  {
    yuksin: 'GISIN',
    gilhyung: 'HYUNG',
    gilhyungHangul: '흉(凶)',
    seolmyeong:
      '대운·세운에서 기신(忌神)을 만나면 용신이 직접 극(克)을 당하여 운세가 크게 나빠진다. '
      + '10년 대운에서 기신을 만나면 그 기간 동안 고난이 따른다.',
    balhyeon: [
      '질병·사고·건강 악화',
      '사업 실패·재물 손실',
      '직업 불안·명예 손상',
      '인간관계 파탄·이별',
      '관재구설·법적 분쟁',
    ],
  },
];

// -----------------------------------------------------------------------
// 유틸리티 함수
// -----------------------------------------------------------------------

/**
 * 천간(天干) 로마자에서 오행을 반환한다.
 *
 * @param cheongan - 천간 로마자
 * @returns 해당 오행
 *
 * @example
 * cheonganToOhhaeng('GAP')   // 'MOK'
 * cheonganToOhhaeng('BYEONG') // 'HWA'
 */
export function cheonganToOhhaeng(cheongan: Cheongan): Ohhaeng {
  return CHEONGAN_OHHAENG[cheongan];
}

/**
 * 용신 오행으로부터 6신(六神) 관계를 조회한다.
 *
 * @param yongsinOhhaeng - 용신으로 결정된 오행
 * @returns 6신 관계 (용신·희신·기신·구신·한신·원신)
 *
 * @example
 * getYuksinGwangye('MOK')
 * // { yongsin:'MOK', heesin:'SU', gisin:'GEUM', gusin:'TO', hansin:'HWA', wonsin:'SU' }
 */
export function getYuksinGwangye(yongsinOhhaeng: Ohhaeng): YuksinGwangyeEntry {
  return YUKSIN_GWANGYE_TABLE[yongsinOhhaeng];
}

/**
 * 두 대립 오행 사이의 통관(通關) 오행을 반환한다.
 *
 * 상극 관계에 있는 두 오행을 인자로 받아, 그 사이를 연결하는
 * 통관 오행을 반환한다. 상극 관계가 아니면 undefined.
 *
 * @param oh1 - 오행 1
 * @param oh2 - 오행 2
 * @returns 통관 오행 (상극이 아니면 undefined)
 *
 * @example
 * getTonggwanOhhaeng('MOK', 'TO')   // 'HWA'
 * getTonggwanOhhaeng('SU', 'HWA')   // 'MOK'
 * getTonggwanOhhaeng('MOK', 'HWA')  // undefined (상생 관계)
 */
export function getTonggwanOhhaeng(oh1: Ohhaeng, oh2: Ohhaeng): Ohhaeng | undefined {
  return TONGGWAN[`${oh1}_${oh2}`];
}

/**
 * 병(病) 오행에 대한 약(藥) 오행을 반환한다.
 *
 * @param byeongOhhaeng - 병(病)이 되는 과다 오행
 * @returns 약(藥) 오행과 보조약 오행
 *
 * @example
 * getYakOhhaeng('HWA')
 * // { yak: 'SU', bojoYak: 'TO' }
 */
export function getYakOhhaeng(byeongOhhaeng: Ohhaeng): { yak: Ohhaeng; bojoYak: Ohhaeng } {
  const entry = BYEONG_YAK_TABLE.find(e => e.byeong === byeongOhhaeng);
  if (!entry) {
    // 이론적으로 모든 오행이 테이블에 있으므로 도달 불가
    return { yak: GEUK_REV[byeongOhhaeng], bojoYak: SAENG[byeongOhhaeng] };
  }
  return { yak: entry.yak, bojoYak: entry.bojoYak };
}

/**
 * 일간의 오행을 기준으로 억부법 용신 후보 오행을 반환한다.
 *
 * @param ilganOhhaeng - 일간의 오행
 * @param gangnyak - 강약 판단 결과 ('SINGANG' | 'SINYAK')
 * @returns 용신 후보 오행 배열 (우선순위순)
 *
 * @example
 * getEukbuYongsinHubo('MOK', 'SINGANG')  // ['GEUM', 'TO', 'HWA']
 * getEukbuYongsinHubo('MOK', 'SINYAK')   // ['SU', 'MOK']
 */
export function getEukbuYongsinHubo(
  ilganOhhaeng: Ohhaeng,
  gangnyak: 'SINGANG' | 'SINYAK',
): Ohhaeng[] {
  if (gangnyak === 'SINGANG') {
    // 신강: 관살(克我), 재성(我克), 식상(我生) 순
    return [GEUK_REV[ilganOhhaeng], GEUK[ilganOhhaeng], SAENG[ilganOhhaeng]];
  } else {
    // 신약: 인성(生我), 비겁(同) 순
    return [SAENG_REV[ilganOhhaeng], ilganOhhaeng];
  }
}

/**
 * 일간 천간과 강약 결과로 상세 억부법 용신 정보를 반환한다.
 *
 * @param ilgan - 일간 천간 로마자
 * @param gangnyak - 강약 판단 결과
 * @returns 해당 일간의 용신·희신·기신 오행 정보
 *
 * @example
 * getIlganYongsinInfo('GAP', 'SINGANG')
 * // { yongsin: ['GEUM','TO','HWA'], heesin: ['TO','HWA'], gisin: ['MOK','SU'] }
 */
export function getIlganYongsinInfo(
  ilgan: Cheongan,
  gangnyak: 'SINGANG' | 'SINYAK',
): { yongsin: Ohhaeng[]; heesin: Ohhaeng[]; gisin: Ohhaeng[] } {
  const entry = ILGAN_YONGSIN_TABLE.find(e => e.ilgan === ilgan);
  if (!entry) {
    // fallback: 오행 기반 계산
    const oh = CHEONGAN_OHHAENG[ilgan];
    const hubo = getEukbuYongsinHubo(oh, gangnyak);
    return { yongsin: hubo, heesin: [], gisin: [] };
  }
  if (gangnyak === 'SINGANG') {
    return {
      yongsin: entry.singangYongsin,
      heesin: entry.singangHeesin,
      gisin: entry.singangGisin,
    };
  } else {
    return {
      yongsin: entry.sinyakYongsin,
      heesin: entry.sinyakHeesin,
      gisin: entry.sinyakGisin,
    };
  }
}

/**
 * 조후법 급용신 판단 — 계절별 급용신 오행을 반환한다.
 *
 * 생월 지지 로마자를 받아 해당 계절의 급용신 오행을 반환한다.
 * 봄·가을에는 조후 급용신이 없으므로 null을 반환한다.
 *
 * 세부 일간별 조후용신은 johuYongsin.ts의 getJohuYongsin()을 사용한다.
 *
 * @param wolji - 월지 로마자 (예: 'JA', 'O', 'IN' 등)
 * @returns 급용신 오행 (조후가 불필요하면 null)
 *
 * @example
 * getJohuGeubYongsin('O')    // 'SU' (한여름 → 水가 급)
 * getJohuGeubYongsin('JA')   // 'HWA' (한겨울 → 火가 급)
 * getJohuGeubYongsin('MYO')  // null (봄 → 조후 불급)
 */
export function getJohuGeubYongsin(wolji: string): Ohhaeng | null {
  const gyuchik = JOHU_GYEJEOL_GYUCHIK.find(g => g.wolji.includes(wolji));
  return gyuchik?.geubYongsin ?? null;
}

/**
 * 대운·세운 오행의 길흉(吉凶)을 판단한다.
 *
 * 용신 오행이 결정된 상태에서, 대운·세운의 오행이 6신 중 어느 역할인지
 * 판별하고 그에 따른 길흉을 반환한다.
 *
 * @param yongsinOhhaeng - 용신 오행
 * @param unseOhhaeng - 대운·세운의 오행
 * @returns 해당 운의 역할과 길흉 정보
 *
 * @example
 * judgeUnseGilhyung('MOK', 'SU')
 * // { yuksin: 'HEESIN', gilhyung: 'GIL', ... }
 * judgeUnseGilhyung('MOK', 'GEUM')
 * // { yuksin: 'GISIN', gilhyung: 'HYUNG', ... }
 */
export function judgeUnseGilhyung(
  yongsinOhhaeng: Ohhaeng,
  unseOhhaeng: Ohhaeng,
): UnseYongsinHwalyong | undefined {
  const gwangye = YUKSIN_GWANGYE_TABLE[yongsinOhhaeng];

  let yuksin: YongsinYeokhal;
  if (unseOhhaeng === gwangye.yongsin) {
    yuksin = 'YONGSIN';
  } else if (unseOhhaeng === gwangye.heesin) {
    yuksin = 'HEESIN';
  } else if (unseOhhaeng === gwangye.gisin) {
    yuksin = 'GISIN';
  } else if (unseOhhaeng === gwangye.gusin) {
    yuksin = 'GUSIN';
  } else if (unseOhhaeng === gwangye.hansin) {
    yuksin = 'HANSIN';
  } else {
    yuksin = 'WONSIN';
  }

  return UNSE_YONGSIN_HWALYONG.find(h => h.yuksin === yuksin);
}

/**
 * 전왕격(專旺格) 해당 여부 및 용신을 반환한다.
 *
 * @param gyeokgukName - 격국 식별자 (예: 'GOKJIK_GYEOK')
 * @returns 전왕격 규칙 정보 (해당 없으면 undefined)
 */
export function getJeonwangGyuchik(gyeokgukName: string): JeonwangGyuchik | undefined {
  return JEONWANG_GYUCHIK_TABLE.find(g => g.gyeokguk === gyeokgukName);
}

/**
 * 용신 추출법(五法) 중 적합한 방법을 추천한다.
 *
 * 사주 상황에 따라 적합한 용신 추출법을 우선순위로 반환한다.
 *
 * @param params.gyejeolGingeub - 계절 조후 긴급도 (HIGH/MEDIUM/LOW)
 * @param params.gangnyak - 강약 결과
 * @param params.daelibOhhaeng - 대립하는 두 오행 (통관용, 없으면 null)
 * @param params.byeongOhhaeng - 병(病) 오행 (병약용, 없으면 null)
 * @param params.isJonggyeok - 종격(從格) 여부
 * @returns 추천 용신 추출법 배열 (우선순위순)
 */
export function chucheonYongsinBeop(params: {
  gyejeolGingeub: 'HIGH' | 'MEDIUM' | 'LOW';
  gangnyak: 'SINGANG' | 'SINYAK' | 'BALANCED' | 'EXTREME_STRONG' | 'EXTREME_WEAK';
  daelibOhhaeng: [Ohhaeng, Ohhaeng] | null;
  byeongOhhaeng: Ohhaeng | null;
  isJonggyeok: boolean;
}): YongsinBangbeop[] {
  const result: YongsinBangbeop[] = [];

  // 종격이면 전왕법 최우선
  if (params.isJonggyeok ||
      params.gangnyak === 'EXTREME_STRONG' ||
      params.gangnyak === 'EXTREME_WEAK') {
    result.push('JEON_WANG');
    return result;
  }

  // 극단적 계절이면 조후법 우선
  if (params.gyejeolGingeub === 'HIGH') {
    result.push('JO_HU');
  }

  // 억부법은 거의 항상 적용
  result.push('EUK_BU');

  // 병이 있으면 병약법 추가
  if (params.byeongOhhaeng !== null) {
    result.push('BYEONG_YAK');
  }

  // 대립 오행이 있으면 통관법 추가
  if (params.daelibOhhaeng !== null) {
    result.push('TONG_GWAN');
  }

  // 온화한 계절에서 조후법은 보조
  if (params.gyejeolGingeub !== 'HIGH' && !result.includes('JO_HU')) {
    result.push('JO_HU');
  }

  return result;
}

// -----------------------------------------------------------------------
// 용신론 종합 이론 해설
// -----------------------------------------------------------------------

/**
 * 용신론(用神論) 종합 이론 해설
 *
 * 사주명리학에서 용신(用神)의 의의와 실제 적용에 대한 종합 해설.
 */
export const YONGSIN_JONGHAP_HAESOL = {
  /** 용신의 정의 */
  jeongui:
    '용신(用神)이란 사주(四柱)에서 일간(日干)의 균형을 잡아주는 가장 중요한 오행이다. '
    + '용신은 사주의 핵심이며, 용신이 없거나 파(破)되면 사주의 격(格)이 무너진다. '
    + '용신이 강하고 건재하면 좋은 명(命)이고, 용신이 약하거나 극을 당하면 나쁜 명이다.',

  /** 용신과 격국의 관계 */
  gyeokgukGwangye:
    '자평진전에서는 격국(格局)과 용신(用神)을 표리(表裏) 관계로 본다. '
    + '격국이 체(體)라면 용신은 용(用)이다. '
    + '격국이 성격(成格)되려면 반드시 용신이 격을 보좌해야 하며, '
    + '용신이 파격(破格)되면 격국의 가치가 떨어진다.',

  /** 용신과 대운의 관계 */
  daewunGwangye:
    '대운(大運)은 10년 단위로 바뀌는 운세의 큰 흐름이다. '
    + '대운의 천간·지지가 용신과 같은 오행이면 그 10년간 크게 발복(發福)한다. '
    + '반대로 대운이 기신(忌神) 오행이면 그 10년간 고난이 따른다. '
    + '세운(歲運 = 해마다의 운)도 같은 원리로 판단한다.',

  /** 용신과 세운의 관계 */
  sewunGwangye:
    '세운(歲運)은 매년 바뀌는 1년 단위의 운세이다. '
    + '대운이 좋아도 세운이 기신이면 그 해는 어렵고, '
    + '대운이 나빠도 세운이 용신이면 그 해는 비교적 좋아진다. '
    + '대운과 세운이 모두 용신·희신이면 최고의 운이고, '
    + '모두 기신·구신이면 최악의 운이다.',

  /** 용신이 복수인 경우 */
  boksuyongsin:
    '사주에 따라 용신이 하나가 아닌 복수(複數)인 경우가 있다. '
    + '조후용신과 억부용신이 다를 때, 두 가지를 모두 용신으로 보는 경우도 있다. '
    + '이때 조후용신을 제1용신, 억부용신을 제2용신으로 구분하기도 한다. '
    + '두 용신이 같은 오행이면 "조후억부겸용(調候抑扶兼用)"으로 최상의 용신이 된다.',

  /** 용신 변화(변통) */
  byeonhwa:
    '사주 원국(原局)의 용신이 대운·세운의 영향으로 변할 수 있다. '
    + '대운에서 사주의 균형이 크게 달라지면 용신이 바뀌는 경우도 있으나, '
    + '일반적으로 원국의 용신은 평생 변하지 않는 것을 원칙으로 한다. '
    + '희용신(喜用神)의 힘이 대운에 의해 강해지거나 약해지는 것이지, '
    + '용신 자체가 바뀌는 것은 아니다.',
} as const;
