/**
 * 격국론(格局論) — 자평진전(子平眞詮) 기반 격국(格局) 이론
 *
 * 격국(格局)이란 월지(月支) 지장간(支藏干)이 천간(天干)에 투출(透出)하여
 * 형성하는 사주의 구조적 틀이다.
 *
 * 자평진전(子平眞詮) 및 명리정종(命理正宗) 이론에 근거한다.
 *
 * 격국 체계:
 *   1. 팔정격(八正格): 정관격, 편관격, 정인격, 편인격, 식신격, 상관격, 정재격, 편재격
 *   2. 외격(外格): 건록격(建祿格), 월겁격(月劫格), 양인격(羊刃格)
 *   3. 종격(從格): 종재격, 종살격, 종아격, 종강격, 종왕격
 *   4. 화기격(化氣格): 화토격, 화금격, 화수격, 화목격, 화화격
 *   5. 전왕격(專旺格 / 특수격): 곡직격, 염상격, 가색격, 종혁격, 윤하격
 *   6. 잡격(雜格): 일행득기격, 양신성상격
 *
 * 일간(日干) 로마자:
 *   GAP(甲), EUL(乙), BYEONG(丙), JEONG(丁), MU(戊),
 *   GI(己), GYEONG(庚), SIN(辛), IM(壬), GYE(癸)
 *
 * 지지(地支) 로마자:
 *   JA(子), CHUK(丑), IN(寅), MYO(卯), JIN(辰), SA(巳),
 *   O(午), MI(未), SHIN(申), YU(酉), SUL(戌), HAE(亥)
 */

import type { StemIdx, BranchIdx } from '../core/cycle.js';
import type { TenGod } from '../core/tenGod.js';
import { tenGodOf } from '../core/tenGod.js';
import { hiddenStemsOfBranch } from '../core/hiddenStems.js';
import { stemElement } from '../core/cycle.js';
import type { Ohhaeng } from './ohhaeng.js';

// -----------------------------------------------------------------------
// 기본 타입 (Cheongan, Jiji, Ohhaeng 은 다른 이론 모듈에서 정의됨)
// -----------------------------------------------------------------------

/**
 * 격국 분류
 *
 *   PALMJEONG  = 팔정격(八正格) — 월령 투출 기반 8격
 *   OEGYEOK    = 외격(外格) — 건록격, 월겁격, 양인격
 *   JONGGUK    = 종격(從格) — 종재격, 종살격, 종아격, 종강격, 종왕격
 *   HWAGI      = 화기격(化氣格) — 화토격, 화금격, 화수격, 화목격, 화화격
 *   JEONWANG   = 전왕격(專旺格) — 곡직격, 염상격, 가색격, 종혁격, 윤하격
 *   JAPGYEOK   = 잡격(雜格) — 일행득기격, 양신성상격
 */
export type GyeokGukBunryu =
  | 'PALMJEONG'
  | 'OEGYEOK'
  | 'JONGGUK'
  | 'HWAGI'
  | 'JEONWANG'
  | 'JAPGYEOK';

/** 격국 상태: SEONGGVEOK(成格), PAGYEOK(破格), BULSEONGNIP(不成立) */
export type GyeokGukSangthae = 'SEONGGVEOK' | 'PAGYEOK' | 'BULSEONGNIP';

// -----------------------------------------------------------------------
// 격국 데이터 인터페이스
// -----------------------------------------------------------------------

/** 격국(格局) 상세 이론 데이터 */
export interface GyeokGukData {
  name: string;
  /** 한자 표기 (주석 전용) -- 예: '正官格' */
  hanja: string;
  /** 한글 표기 -- 예: '정관격' */
  hangul: string;
  /** 로마자 표기 -- 예: 'Jeonggwan-gyeok' */
  romanja: string;
  bunryu: GyeokGukBunryu;
  /** 격국 성립(成立) 원칙 */
  seongnipWonchik: string;
  /** 격국 특성(特性) */
  teukcheong: string;
  /** 성격(成格) 조건 */
  seonggveokJogeon: string;
  /** 파격(破格) 조건 */
  pagyeokJogeon: string;
  /** 희신(喜神) -- 격국에 도움이 되는 오행/십신 */
  heesin: string;
  /** 기신(忌神) -- 격국을 해치는 오행/십신 */
  gisin: string;
}

// -----------------------------------------------------------------------
// 팔정격(八正格) 목록
// -----------------------------------------------------------------------

/**
 * 팔정격(八正格) 목록
 *
 * 자평진전(子平眞詮) 기반 월령(月令) 8가지 정격(正格).
 * 월지 지장간 중 천간에 투출한 글자로 격국을 정한다.
 *
 * 팔정격 분류:
 *   정관격, 편관격, 정인격, 편인격, 식신격, 상관격, 정재격, 편재격
 */
export const PALMJEONG_GYEOK_TABLE: Record<string, GyeokGukData> = {

  /** 정관격(正官格) -- JEONGGWAN_GYEOK
   *  일간을 克하되 음양이 다른 정관(正官)이 천간에 투출. 최귀격(最貴格). */
  JEONGGWAN_GYEOK: {
    name: 'JEONGGWAN_GYEOK',
    hanja: '正官格',
    hangul: '정관격',
    romanja: 'Jeonggwan-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 정관(正官)이 년/월/시 천간에 투출(透出)하여 성립한다. '
      + '일간과 음양이 달라 克하는 관계. 월지가 정관 오행에 해당해도 성립.',
    teukcheong:
      '법도를 중시하고 명예를 소중히 여기며 사회 질서를 따른다. '
      + '관직/공무원/법조/군인에서 두각을 나타내며 신용과 덕망이 높다. '
      + '조직 내에서 인정받고 승진이 빠르다.',
    seonggveokJogeon:
      '재성(財星)이 정관을 生하거나 인성(印星)이 일간을 생하면 성격(成格). '
      + '정관이 합(合)/형(刑)/충(沖) 없이 청순하면 귀격으로 대성한다. '
      + '정관이 하나만 투출되어 순수하면 가장 이상적이다.',
    pagyeokJogeon:
      '상관(傷官)이 정관을 克하면 파격(破格)이 되어 직업 불안, 명예 손상. '
      + '정관이 너무 많으면 혼잡(混雜)하여 오히려 편관처럼 작용한다. '
      + '정관이 합거(合去)되어 기능을 상실하면 파격.',
    heesin:
      '재성(財星) -- 정관을 生하여 格 강화. '
      + '인성(印星) -- 정관의 극을 설기하여 일간 보호. '
      + '비겁(比劫) -- 신약(身弱)할 때 일간 보강.',
    gisin:
      '상관(傷官) -- 정관을 克하여 파격의 주범. '
      + '편관(偏官) 혼재 -- 관(官)이 탁해짐. '
      + '인성 과다 -- 정관의 기운 설기.',
  },

  /** 편관격(偏官格) -- PYEONGWAN_GYEOK (칠살격 七殺格)
   *  일간을 克하되 음양이 같은 편관(偏官)이 천간에 투출. */
  PYEONGWAN_GYEOK: {
    name: 'PYEONGWAN_GYEOK',
    hanja: '偏官格',
    hangul: '편관격',
    romanja: 'Pyeongwan-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 편관(偏官 = 칠살)이 년/월/시 천간에 투출하여 성립. '
      + '일간과 음양이 같아 克하는 관계. 살(殺)이라고도 불린다.',
    teukcheong:
      '강인한 의지와 추진력, 결단력이 뛰어나다. '
      + '군인/경찰/법조/의술/무관(武官) 분야에서 두각을 나타낸다. '
      + '역경을 돌파하는 강한 정신력을 지닌다.',
    seonggveokJogeon:
      '식신(食神)이 살(殺)을 制하는 식신제살(食神制殺)이 되면 대귀(大貴)한다. '
      + '인성(印星)이 살을 化하는 살인상생(殺印相生)이 되면 관직에서 대성한다. '
      + '양인(羊刃)이 살을 합하는 살인합인(殺刃合印)도 무관으로 대성한다.',
    pagyeokJogeon:
      '편관이 너무 많아 일간이 감당하지 못하면 신약살중(身弱殺重)으로 파격. '
      + '재성이 살을 生하면 재다신약(財多身弱)으로 위험하다. '
      + '식신과 편관이 동시에 투출되었는데 편인이 식신을 도식하면 제살 실패.',
    heesin:
      '식신(食神) -- 살을 制(제)하여 파괴력 통제. '
      + '인성(印星) -- 살을 化(화)하여 일간에 유익하게 전환. '
      + '양인(羊刃) -- 살과 대립하며 균형.',
    gisin:
      '재성(財星) -- 살을 生하여 위험 가중. '
      + '상관(傷官) -- 합살(合殺) 간섭으로 제화 불완전. '
      + '비겁 과다 -- 충돌과 갈등 증폭.',
  },

  /** 정인격(正印格) -- JEONGIN_GYEOK
   *  일간을 生하되 음양이 다른 정인(正印)이 천간에 투출. 학문/명예 상징. */
  JEONGIN_GYEOK: {
    name: 'JEONGIN_GYEOK',
    hanja: '正印格',
    hangul: '정인격',
    romanja: 'Jeongin-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 정인(正印)이 년/월/시 천간에 투출하여 성립. '
      + '일간과 음양이 달라 生하는 관계.',
    teukcheong:
      '학문/문화/예술에 탁월하며 덕망과 품위가 높다. '
      + '교육/학술/문화/종교 분야에서 명성을 쌓는다.',
    seonggveokJogeon:
      '관성(官星)이 인성을 生하는 관인상생(官印相生) 구도가 되면 귀격. '
      + '재성이 없거나 약하면 인성의 기운이 온전히 일간에 전달된다. '
      + '정인이 하나만 청순하게 투출되면 학문으로 대성한다.',
    pagyeokJogeon:
      '재성(財星)이 인성을 克하면 재극인(財克印)으로 파격. '
      + '식상(食傷)이 과다하면 인성을 설기하여 약화된다.',
    heesin:
      '관성(官星) -- 인성을 生하여 관인상생. '
      + '비겁(比劫) -- 인성과 협력하여 일간 보호.',
    gisin:
      '재성(財星) -- 인성을 克하여 파격의 주범. '
      + '식신/상관 과다 -- 인성 기운 소모.',
  },

  /** 편인격(偏印格) -- PYEONIN_GYEOK
   *  일간을 生하되 음양이 같은 편인(偏印)이 투출. 도식(倒食)이라고도 함. */
  PYEONIN_GYEOK: {
    name: 'PYEONIN_GYEOK',
    hanja: '偏印格',
    hangul: '편인격',
    romanja: 'Pyeonin-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 편인(偏印)이 년/월/시 천간에 투출하여 성립. '
      + '일간과 음양이 같아 生하는 관계. 도식(倒食)이라고도 한다.',
    teukcheong:
      '독창적 사고와 특이한 재능을 지닌다. '
      + '예술/철학/의학/역술 분야에서 독보적 능력을 발휘한다.',
    seonggveokJogeon:
      '관성(官星)이 편인을 生하면 살인상생(殺印相生)으로 성격. '
      + '재성이 없거나 약하여 편인의 기운이 온전하면 성격. '
      + '식신이 없으면 도식의 위험이 없어 안정된 격이 된다.',
    pagyeokJogeon:
      '재성(財星)이 편인을 克하면 파격. '
      + '식신이 있는데 편인이 식신을 克하면 도식(倒食)이 되어 생계 위협.',
    heesin:
      '관성(官星) -- 편인을 生하여 활성화. '
      + '비겁(比劫) -- 신약할 때 일간 보호.',
    gisin:
      '재성(財星) -- 편인을 克하여 파격. '
      + '식신 동주 -- 도식 현상 발생.',
  },

  /** 식신격(食神格) -- SIKSIN_GYEOK
   *  일간이 생(生)하되 음양이 같은 식신(食神)이 투출. 의식주 풍요/생산 상징. */
  SIKSIN_GYEOK: {
    name: 'SIKSIN_GYEOK',
    hanja: '食神格',
    hangul: '식신격',
    romanja: 'Siksin-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 식신(食神)이 년/월/시 천간에 투출하여 성립. '
      + '일간이 生하되 음양이 같은 관계.',
    teukcheong:
      '의식주가 풍요롭고 생활이 넉넉하다. '
      + '예술/요리/교육/미디어/서비스업에서 두각을 나타낸다. '
      + '성품이 온화하고 낙천적이며 복록(福祿)이 두텁다.',
    seonggveokJogeon:
      '재성(財星)이 식신의 기운을 받는 식신생재(食神生財)가 되면 대부(大富)한다. '
      + '식신이 편관을 제어하는 식신제살(食神制殺)이 되면 대귀(大貴). '
      + '식신이 충파 없이 청순하고 재성이 있으면 최고 길격.',
    pagyeokJogeon:
      '편인(偏印)이 식신을 克하는 도식(倒食)이 되면 파격. '
      + '식상(食傷)이 과다하면 일간이 설기되어 신약이 된다.',
    heesin:
      '재성(財星) -- 식신이 生한 기운을 받아 富 창출. '
      + '비겁(比劫) -- 신약할 때 식신 활동의 기반 제공.',
    gisin:
      '편인(偏印) -- 식신을 克하는 도식 현상. '
      + '상관(傷官) 혼재 -- 역량 분산.',
  },

  /** 상관격(傷官格) -- SANG_GWAN_GYEOK
   *  일간이 生하되 음양이 다른 상관(傷官)이 투출. 재능/창의성 상징. */
  SANG_GWAN_GYEOK: {
    name: 'SANG_GWAN_GYEOK',
    hanja: '傷官格',
    hangul: '상관격',
    romanja: 'Sanggwan-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 상관(傷官)이 년/월/시 천간에 투출하여 성립. '
      + '일간이 生하되 음양이 다른 관계. 정관(正官)을 克하는 성질.',
    teukcheong:
      '재능/창의성/표현력이 탁월하고 기예(技藝)에 뛰어나다. '
      + '예술/연예/기술/법/의학에서 독창적 성취를 이룬다.',
    seonggveokJogeon:
      '상관생재(傷官生財)로 재성이 상관의 기운을 받으면 대부(大富). '
      + '상관패인(傷官佩印)으로 인성이 상관을 제어하면 귀격이 된다. '
      + '상관이 청순하고 재성이 잘 받아주면 사업 수완이 탁월하다.',
    pagyeokJogeon:
      '정관(正官)이 있는데 상관이 克하면 관재(官災)/명예 손상. '
      + '인성(印星)이 없으면 상관의 기운이 과도해져 일간을 설기.',
    heesin:
      '재성(財星) -- 상관이 生한 기운을 받아 富 창출. '
      + '인성(印星) -- 상관이 지나칠 때 제어하여 균형.',
    gisin:
      '정관(正官) -- 상관에 의해 克되어 관재/명예 손상. '
      + '인성 과다 -- 상관을 과도하게 억제하여 재능 발현 방해.',
  },

  /** 정재격(正財格) -- JEONGJAE_GYEOK
   *  일간이 克하되 음양이 다른 정재(正財)가 투출. 성실한 재물 축적 상징. */
  JEONGJAE_GYEOK: {
    name: 'JEONGJAE_GYEOK',
    hanja: '正財格',
    hangul: '정재격',
    romanja: 'Jeongjae-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 정재(正財)가 년/월/시 천간에 투출하여 성립. '
      + '일간이 克하되 음양이 다른 관계.',
    teukcheong:
      '성실하고 근면하며 재물을 절약하고 관리하는 능력이 뛰어나다. '
      + '경영/금융/부동산/회계 분야에서 두각을 나타낸다.',
    seonggveokJogeon:
      '비겁(比劫)이 없거나 약하여 재성을 탈취하지 않으면 성격. '
      + '관성(官星)이 재성을 통해 생기면 재관양전(財官兩全)으로 귀격.',
    pagyeokJogeon:
      '비겁(比劫)이 과다하여 군겁쟁재(群劫爭財)가 되면 파격. '
      + '인성(印星) 과다하면 재성을 克하여 재물 손실.',
    heesin:
      '식신/상관 -- 재성을 生하여 格 강화. '
      + '관성(官星) -- 재관양전(財官兩全) 구도.',
    gisin:
      '비겁(比劫) 과다 -- 군겁쟁재. '
      + '인성(印星) 과다 -- 재성 克.',
  },

  /** 편재격(偏財格) -- PYEONJAE_GYEOK
   *  일간이 克하되 음양이 같은 편재(偏財)가 투출. 사업/투자 기질 상징. */
  PYEONJAE_GYEOK: {
    name: 'PYEONJAE_GYEOK',
    hanja: '偏財格',
    hangul: '편재격',
    romanja: 'Pyeonjae-gyeok',
    bunryu: 'PALMJEONG',
    seongnipWonchik:
      '월지(月支) 지장간 중 편재(偏財)가 년/월/시 천간에 투출하여 성립. '
      + '일간이 克하되 음양이 같은 관계.',
    teukcheong:
      '사업적 수완과 투자 감각이 뛰어나고 활발하다. '
      + '무역/투자/부동산/금융/사업 분야에서 큰 재물을 모은다.',
    seonggveokJogeon:
      '식신/상관이 편재를 生하면 식재양전(食財兩全)으로 대부(大富). '
      + '비겁이 약하여 탈취하지 않으면 편재가 온전히 기능한다.',
    pagyeokJogeon:
      '비겁(比劫) 과다하면 군겁쟁재(群劫爭財)로 재물 손실. '
      + '편재가 충(沖)/공망(空亡)을 당하면 사업 실패.',
    heesin:
      '식신/상관 -- 편재를 生하여 格 강화. '
      + '관성(官星) -- 재관양전(財官兩全).',
    gisin:
      '비겁(比劫) 과다 -- 군겁쟁재. '
      + '인성(印星) 과다 -- 재성 克.',
  },
};

// -----------------------------------------------------------------------
// 외격(外格) 목록 -- 건록격, 월겁격, 양인격
// -----------------------------------------------------------------------

/**
 * 외격(外格) 목록
 *
 * 월령(月令) 투출 원칙에 따라 비견/겁재가 투출된 경우는
 * 팔정격이 성립하지 않으므로 별도의 외격으로 처리한다.
 *
 * 포함 격국:
 *   건록격(建祿格), 월겁격(月劫格), 양인격(羊刃格)
 */
export const OEGYEOK_TABLE: Record<string, GyeokGukData> = {

  /** 건록격(建祿格) -- GEON_ROK_GYEOK
   *  월지(月支)가 일간의 록(祿 = 십이운성 건록)에 해당할 때 성립.
   *  재관인식상 어느 것도 투출이 없어 팔정격이 성립하지 않는 경우.
   *  비견(比肩)이 월지에 위치한 형태. */
  GEON_ROK_GYEOK: {
    name: 'GEON_ROK_GYEOK',
    hanja: '建祿格',
    hangul: '건록격',
    romanja: 'Geon-rok-gyeok',
    bunryu: 'OEGYEOK',
    seongnipWonchik:
      '월지(月支)가 일간의 십이운성 건록(建祿)에 해당할 때 성립. '
      + '자평진전에서는 팔정격의 범주에 넣지 않고 별도 처리한다. '
      + '월지 본기가 일간과 동일(비견)하여 팔정격 중 어느 것도 취할 수 없는 경우.',
    teukcheong:
      '일간이 월지의 기운을 직접 받아 신강(身强)한 경향이 있다. '
      + '자립심이 강하고 독립적이며 재능이 뛰어나다. '
      + '용신(用神)을 잘 만나면 관직이나 사업에서 성공한다.',
    seonggveokJogeon:
      '사주 내 관성/재성/식상 중 하나가 투출하여 용신이 되면 성격. '
      + '관성(官星)이 용신이 되면 귀격, 재성이 용신이 되면 부격(富格). '
      + '건록격은 별도 용신 선정이 핵심이다.',
    pagyeokJogeon:
      '사주에 용신이 없거나 용신이 충파(沖破)되면 파격. '
      + '비겁이 너무 많으면 군겁쟁재(群劫爭財)의 위험.',
    heesin:
      '관성(官星) -- 신강한 일간을 제어하여 균형. '
      + '재성(財星) -- 일간의 강한 기운을 설기하여 재물로 전환. '
      + '식신/상관 -- 일간의 기운을 표현.',
    gisin:
      '비겁(比劫) 과다 -- 군겁쟁재 위험. '
      + '인성(印星) 과다 -- 신강이 더욱 심화.',
  },

  /** 월겁격(月劫格) -- WOL_GEOP_GYEOK
   *  월지(月支)가 일간의 겁재(劫財)에 해당할 때 성립.
   *  건록격과 유사하나 양인(羊刃)의 성질을 함께 가진다. */
  WOL_GEOP_GYEOK: {
    name: 'WOL_GEOP_GYEOK',
    hanja: '月劫格',
    hangul: '월겁격',
    romanja: 'Wol-geop-gyeok',
    bunryu: 'OEGYEOK',
    seongnipWonchik:
      '월지(月支)가 일간의 겁재(劫財) 또는 양인(羊刃)에 해당할 때 성립. '
      + '건록격보다 더 강렬하고 극단적인 기운.',
    teukcheong:
      '강인한 의지와 추진력을 지닌다. '
      + '무관/군인/경찰/스포츠 분야에서 두각을 나타낸다.',
    seonggveokJogeon:
      '관성(官星)이 양인을 제어하면 살인합인(殺刃合印)으로 귀격. '
      + '재성이 용신이 되면 재물에서 성공.',
    pagyeokJogeon:
      '재성(財星)이 없고 비겁이 더 강하면 군겁쟁재 위험. '
      + '관성이 없으면 양인의 기운이 통제되지 않는다.',
    heesin:
      '관성(官星) -- 양인을 制하는 살인합인 구도. '
      + '재성(財星) -- 일간의 기운을 설기하여 재물로 전환.',
    gisin:
      '비겁(比劫) 과다 -- 기운이 치우쳐 흉격. '
      + '인성(印星) 과다 -- 신강 심화.',
  },

  /** 양인격(羊刃格) -- YANG_IN_GYEOK
   *  월지(月支)가 양간(陽干) 일간의 양인(羊刃 = 제왕지)에 해당할 때 성립.
   *  양간 전용 특수격. 음간에게는 양인격이 성립하지 않는다. */
  YANG_IN_GYEOK: {
    name: 'YANG_IN_GYEOK',
    hanja: '羊刃格',
    hangul: '양인격',
    romanja: 'Yang-in-gyeok',
    bunryu: 'OEGYEOK',
    seongnipWonchik:
      '양간(陽干) 일간일 때 월지가 제왕지(帝旺地)에 해당하면 성립한다. '
      + '양인은 일간의 힘이 극도로 강한 지점으로, 양간 전용이다. '
      + '갑(甲)=묘(卯), 병(丙)=오(午), 무(戊)=오(午), 경(庚)=유(酉), 임(壬)=자(子). '
      + '음간에게는 양인격이 성립하지 않으며 대신 월겁격으로 처리한다.',
    teukcheong:
      '극도로 강인한 기질, 군인/경찰/무관(武官)/외과 의사에 적합하다. '
      + '양인가살(羊刃駕殺)이 되면 무관으로서 최고의 귀격이 된다. '
      + '의지가 강하고 결단력이 있으나 극단적 경향이 있다.',
    seonggveokJogeon:
      '편관(偏官)이 양인을 제어하면 양인가살(羊刃駕殺)로 대귀(大貴)한다. '
      + '관성이 양인과 균형을 이루면 무관/정치/경영에서 대성한다. '
      + '인성이 관성과 양인을 중재하면 더욱 안정된 격이 된다.',
    pagyeokJogeon:
      '관성이 없이 양인만 강하면 폭력성/충동성이 나타나 위험하다. '
      + '재성이 없으면 군겁쟁재의 극단적 형태가 된다. '
      + '충(沖)을 만나면 양인이 발동하여 재앙이 크다.',
    heesin:
      '편관(偏官) -- 양인을 제어하여 양인가살 구도. '
      + '인성(印星) -- 관살과 양인을 중재.',
    gisin:
      '비겁(比劫) 과다 -- 양인 기운 과잉. '
      + '재성(財星) 약화 -- 군겁쟁재 극단화. '
      + '충(沖) -- 양인 발동으로 재앙.',
  },
};

// -----------------------------------------------------------------------
// 종격(從格) 목록
// -----------------------------------------------------------------------

/**
 * 종격(從格) 목록
 *
 * 일간이 극도로 약하여 사주의 강한 오행 기세를 따르는(從) 격국.
 * 일간의 통근이 전혀 없고 비겁/인성이 극히 미약할 때 성립한다.
 *
 * 포함 격국:
 *   종재격(從財格), 종살격(從殺格), 종아격(從兒格),
 *   종강격(從强格), 종왕격(從旺格)
 */
export const JONGGUK_TABLE: Record<string, GyeokGukData> = {

  /** 종재격(從財格) -- JONG_JAE_GYEOK */
  JONG_JAE_GYEOK: {
    name: 'JONG_JAE_GYEOK',
    hanja: '從財格',
    hangul: '종재격',
    romanja: 'Jong-jae-gyeok',
    bunryu: 'JONGGUK',
    seongnipWonchik:
      '사주 전체에 재성이 극도로 강하고 인성/비겁이 없을 때 성립. '
      + '일간이 재성의 기세를 따른다. '
      + '일간에 뿌리(통근)가 전혀 없어야 하며, 비겁/인성이 하나라도 있으면 진종(眞從)이 아니다.',
    teukcheong:
      '재물운이 강하고 사업/투자/금융에서 크게 성공한다. '
      + '진종재격이면 대부(大富)의 명이다.',
    seonggveokJogeon:
      '인성/비겁이 없거나 공망(空亡)으로 무력화되면 성격. '
      + '재성이 식상의 생부를 받으면 더욱 견고한 종격이 된다.',
    pagyeokJogeon:
      '인성(印星)이나 비겁(比劫)이 운(運)에서 오면 파격하여 위험. '
      + '일간의 뿌리가 살아나면 종격이 깨져 대흉(大凶).',
    heesin: '재성(財星), 식신/상관, 관성(官星).',
    gisin: '인성(印星), 비겁(比劫).',
  },

  /** 종살격(從殺格) -- JONG_SAL_GYEOK */
  JONG_SAL_GYEOK: {
    name: 'JONG_SAL_GYEOK',
    hanja: '從殺格',
    hangul: '종살격',
    romanja: 'Jong-sal-gyeok',
    bunryu: 'JONGGUK',
    seongnipWonchik:
      '사주 전체에 편관(殺)이 극도로 강하고 식신/비겁이 없을 때 성립. '
      + '일간이 관살의 기세를 따른다. '
      + '인성이 있으면 살인상생으로 팔정격이 되므로 종살격이 아니다.',
    teukcheong:
      '권위/지위/명예를 지향하며 군인/공무원/법조인으로 대성한다. '
      + '진종살격이면 대귀(大貴)의 명이다.',
    seonggveokJogeon:
      '식신/비겁이 없거나 공망으로 무력화되면 성격. '
      + '재성이 관살을 生하면 더욱 견고한 종격이 된다.',
    pagyeokJogeon:
      '식신이나 비겁이 운에서 오면 파격하여 위험. '
      + '인성이 운에서 와도 종격의 구조가 변질될 수 있다.',
    heesin: '관성(官星), 재성(財星).',
    gisin: '식신(食神), 비겁(比劫).',
  },

  /** 종아격(從兒格) -- JONG_A_GYEOK */
  JONG_A_GYEOK: {
    name: 'JONG_A_GYEOK',
    hanja: '從兒格',
    hangul: '종아격',
    romanja: 'Jong-a-gyeok',
    bunryu: 'JONGGUK',
    seongnipWonchik:
      '식신/상관이 사주를 지배하고 인성/관성이 없을 때 성립. '
      + '일간이 식상의 기세를 따른다. '
      + '인성이 있으면 식상을 억제하므로 종아격이 아니다.',
    teukcheong:
      '예술/창작/표현에 뛰어나고 연예/예술/요리/교육 분야에서 독보적 성취를 이룬다. '
      + '아(兒)란 자식 = 식상을 의미하며, 자식처럼 창출하는 능력이 탁월하다.',
    seonggveokJogeon:
      '인성/관성이 없거나 공망으로 무력화되면 성격. '
      + '재성이 식상의 기운을 받아주면 더욱 견고한 종격이 된다.',
    pagyeokJogeon:
      '인성이나 관성이 운에서 오면 파격. '
      + '비겁이 운에서 와도 식상의 순수한 흐름을 방해할 수 있다.',
    heesin: '식신/상관, 재성(財星).',
    gisin: '인성(印星), 관성(官星).',
  },

  /** 종강격(從强格) -- JONG_GANG_GYEOK */
  JONG_GANG_GYEOK: {
    name: 'JONG_GANG_GYEOK',
    hanja: '從强格',
    hangul: '종강격',
    romanja: 'Jong-gang-gyeok',
    bunryu: 'JONGGUK',
    seongnipWonchik:
      '인성과 비겁이 사주 전체를 지배하고 관성/재성/식상이 없을 때 성립. '
      + '일간이 극도로 강하여 그 강한 기세를 따르는 격이다.',
    teukcheong:
      '강한 자아 의식과 독립심, 학문/철학/종교/예술 분야에서 고집스럽게 성취. '
      + '인성이 포함되어 있어 학문/연구 성향이 강하다.',
    seonggveokJogeon:
      '관성/재성/식상이 없거나 무력화되면 성격. '
      + '비겁과 인성이 고루 분포하면 더욱 안정된 종강격이 된다.',
    pagyeokJogeon:
      '관성/재성/식상이 운에서 오면 파격. '
      + '특히 관성이 오면 극도로 위험하다.',
    heesin: '비겁(比劫), 인성(印星).',
    gisin: '관성(官星), 재성(財星), 식상(食傷).',
  },

  /** 종왕격(從旺格) -- JONG_WANG_GYEOK */
  JONG_WANG_GYEOK: {
    name: 'JONG_WANG_GYEOK',
    hanja: '從旺格',
    hangul: '종왕격',
    romanja: 'Jong-wang-gyeok',
    bunryu: 'JONGGUK',
    seongnipWonchik:
      '비겁이 사주 전체를 지배하고 관성/재성/인성/식상이 없을 때 성립. '
      + '종강격과 달리 인성 없이 순수하게 비겁만으로 구성된다.',
    teukcheong:
      '강렬한 자아와 독립심, 군인/스포츠/경영에서 강인한 의지로 성취. '
      + '인성이 없어 학문보다는 행동/실천 지향적이다.',
    seonggveokJogeon:
      '비겁이 사주를 완전히 지배하면 성격. '
      + '식상이 약간 있어 비겁의 기운을 표현해주면 더욱 좋다.',
    pagyeokJogeon:
      '관성/재성이 운에서 오면 파격하여 매우 위험. '
      + '특히 관성(편관)이 오면 살중(殺重)으로 대흉.',
    heesin: '비겁(比劫), 식상(食傷).',
    gisin: '관성(官星), 재성(財星).',
  },
};

// -----------------------------------------------------------------------
// 화기격(化氣格) 목록
// -----------------------------------------------------------------------

/**
 * 화기격(化氣格) 목록
 *
 * 일간(日干)이 인접 천간과 천간합(天干合)을 이루어 오행이 화(化)하는 특수 격국.
 * 진화(眞化)와 가화(假化)의 구분이 중요하며
 * 화기격 성립 여부 판단은 cheonganHap.ts 천간합 이론을 기반으로 한다.
 *
 * 오합(五合):
 *   甲己合土, 乙庚合金, 丙辛合水, 丁壬合木, 戊癸合火
 */
export const HWAGI_GYEOK_TABLE: Record<string, GyeokGukData> = {

  /** 화토격(化土格) -- HWA_TO_GYEOK -- 甲己合土 */
  HWA_TO_GYEOK: {
    name: 'HWA_TO_GYEOK',
    hanja: '化土格',
    hangul: '화토격',
    romanja: 'Hwa-to-gyeok',
    bunryu: 'HWAGI',
    seongnipWonchik:
      '甲일간이 己와 합하거나 己일간이 甲과 합하여 土로 화(化)하는 격. '
      + '월지가 辰/戌/丑/未(토월)이거나 토기(土氣)가 강해야 진화(眞化).',
    teukcheong:
      '토(土)의 중화(中和)/포용/신용의 기운이 충만하다. '
      + '중정지합(中正之合)의 덕으로 인품이 후덕하고 신뢰받는다.',
    seonggveokJogeon:
      '월지가 토월이고 사주 전체가 토의 기운으로 통일되면 진화격. '
      + '목(木)이나 수(水)가 없거나 약해야 한다.',
    pagyeokJogeon:
      '목(木)이 토를 극하거나 수(水)가 토를 설기하면 파격. '
      + '일간의 본래 오행이 지지에 뿌리를 두면 가화(假化).',
    heesin: '토(土), 화(火) -- 토를 생하는 오행.',
    gisin: '목(木) -- 토를 극하는 오행. 수(水) -- 토를 설기.',
  },

  /** 화금격(化金格) -- HWA_GEUM_GYEOK -- 乙庚合金 */
  HWA_GEUM_GYEOK: {
    name: 'HWA_GEUM_GYEOK',
    hanja: '化金格',
    hangul: '화금격',
    romanja: 'Hwa-geum-gyeok',
    bunryu: 'HWAGI',
    seongnipWonchik:
      '乙일간이 庚과 합하거나 庚일간이 乙과 합하여 金으로 화하는 격. '
      + '월지가 申/酉(금월)이거나 금기(金氣)가 강해야 진화(眞化).',
    teukcheong:
      '금(金)의 결단/의리/숙살(肅殺)의 기운이 충만하다. '
      + '인의지합(仁義之合)의 덕으로 인의를 겸비한다.',
    seonggveokJogeon:
      '월지가 금월이고 사주 전체가 금의 기운으로 통일되면 진화격. '
      + '화(火)가 없거나 약해야 한다.',
    pagyeokJogeon:
      '화(火)가 금을 극하거나 수(水)가 금을 설기하면 파격. '
      + '일간의 본래 오행이 지지에 뿌리를 두면 가화(假化).',
    heesin: '금(金), 토(土) -- 금을 생하는 오행.',
    gisin: '화(火) -- 금을 극하는 오행. 수(水) -- 금을 설기.',
  },

  /** 화수격(化水格) -- HWA_SU_GYEOK -- 丙辛合水 */
  HWA_SU_GYEOK: {
    name: 'HWA_SU_GYEOK',
    hanja: '化水格',
    hangul: '화수격',
    romanja: 'Hwa-su-gyeok',
    bunryu: 'HWAGI',
    seongnipWonchik:
      '丙일간이 辛과 합하거나 辛일간이 丙과 합하여 水로 화하는 격. '
      + '월지가 亥/子(수월)이거나 수기(水氣)가 강해야 진화(眞化).',
    teukcheong:
      '수(水)의 지혜/유연/유동의 기운이 충만하다. '
      + '위제지합(威制之合)의 성질로 강한 의지와 지혜를 겸비한다.',
    seonggveokJogeon:
      '월지가 수월이고 사주 전체가 수의 기운으로 통일되면 진화격. '
      + '토(土)가 없거나 약해야 한다.',
    pagyeokJogeon:
      '토(土)가 수를 극하거나 목(木)이 수를 설기하면 파격. '
      + '일간의 본래 오행이 지지에 뿌리를 두면 가화(假化).',
    heesin: '수(水), 금(金) -- 수를 생하는 오행.',
    gisin: '토(土) -- 수를 극하는 오행. 목(木) -- 수를 설기.',
  },

  /** 화목격(化木格) -- HWA_MOK_GYEOK -- 丁壬合木 */
  HWA_MOK_GYEOK: {
    name: 'HWA_MOK_GYEOK',
    hanja: '化木格',
    hangul: '화목격',
    romanja: 'Hwa-mok-gyeok',
    bunryu: 'HWAGI',
    seongnipWonchik:
      '丁일간이 壬과 합하거나 壬일간이 丁과 합하여 木으로 화하는 격. '
      + '월지가 寅/卯(목월)이거나 목기(木氣)가 강해야 진화(眞化).',
    teukcheong:
      '목(木)의 생장(生長)/진취/인(仁)의 기운이 충만하다. '
      + '음란지합(淫亂之合)이지만 진화격이면 귀격이 될 수 있다.',
    seonggveokJogeon:
      '월지가 목월이고 사주 전체가 목의 기운으로 통일되면 진화격. '
      + '금(金)이 없거나 약해야 한다.',
    pagyeokJogeon:
      '금(金)이 목을 극하거나 화(火)가 목을 설기하면 파격. '
      + '일간의 본래 오행이 지지에 뿌리를 두면 가화(假化).',
    heesin: '목(木), 수(水) -- 목을 생하는 오행.',
    gisin: '금(金) -- 목을 극하는 오행. 화(火) -- 목을 설기.',
  },

  /** 화화격(化火格) -- HWA_HWA_GYEOK -- 戊癸合火 */
  HWA_HWA_GYEOK: {
    name: 'HWA_HWA_GYEOK',
    hanja: '化火格',
    hangul: '화화격',
    romanja: 'Hwa-hwa-gyeok',
    bunryu: 'HWAGI',
    seongnipWonchik:
      '戊일간이 癸와 합하거나 癸일간이 戊와 합하여 火로 화하는 격. '
      + '월지가 巳/午(화월)이거나 화기(火氣)가 강해야 진화(眞化).',
    teukcheong:
      '화(火)의 광명(光明)/열정/예(禮)의 기운이 충만하다. '
      + '무정지합(無情之合)이지만 진화격이면 화의 순수한 기운으로 대성한다.',
    seonggveokJogeon:
      '월지가 화월이고 사주 전체가 화의 기운으로 통일되면 진화격. '
      + '수(水)가 없거나 약해야 한다.',
    pagyeokJogeon:
      '수(水)가 화를 극하거나 토(土)가 화를 설기하면 파격. '
      + '일간의 본래 오행이 지지에 뿌리를 두면 가화(假化).',
    heesin: '화(火), 목(木) -- 화를 생하는 오행.',
    gisin: '수(水) -- 화를 극하는 오행. 토(土) -- 화를 설기.',
  },
};

// -----------------------------------------------------------------------
// 전왕격(專旺格) / 특수격 목록
// -----------------------------------------------------------------------

/**
 * 전왕격(專旺格) / 특수격 목록
 *
 * 일간의 오행이 사주 전체에 극도로 왕성하여
 * 하나의 오행이 사주를 완전히 지배하는 특수 격국.
 *
 * 오행별 전왕격:
 *   곡직격(曲直格) -- 木
 *   염상격(炎上格) -- 火
 *   가색격(稼穡格) -- 土
 *   종혁격(從革格) -- 金
 *   윤하격(潤下格) -- 水
 */
export const JEONWANG_GYEOK_TABLE: Record<string, GyeokGukData> = {

  /** 곡직격(曲直格) -- GOK_JIK_GYEOK -- 木 전왕격
   *  목(木) 일간이 사주 전체에 木이 극도로 왕성할 때 성립. */
  GOK_JIK_GYEOK: {
    name: 'GOK_JIK_GYEOK',
    hanja: '曲直格',
    hangul: '곡직격',
    romanja: 'Gok-jik-gyeok',
    bunryu: 'JEONWANG',
    seongnipWonchik:
      '甲/乙(목일간)이 寅卯辰(봄 목방) 또는 亥卯未(목국 삼합)을 이루고 '
      + '사주 전체가 木의 기운으로 통일될 때 성립한다. '
      + '금(金)이 없거나 극히 약해야 한다.',
    teukcheong:
      '인자하고 곧은 성품, 학문/교육/의료/문학에서 큰 성취를 이룬다. '
      + '곡직(曲直)은 나무가 구부러지면서도 곧게 자라는 성질을 상징한다.',
    seonggveokJogeon:
      '지지에 寅卯辰 방합(方合) 또는 亥卯未 삼합이 있고 금기(金氣)가 없으면 성격. '
      + '수(水)가 목을 생하면 더욱 왕성한 곡직격이 된다.',
    pagyeokJogeon:
      '금(金)이 사주에 있거나 운에서 오면 파격. '
      + '화(火)가 과다하면 목이 설기되어 약해진다.',
    heesin: '수(水) -- 목을 생하여 격 강화. 목(木) -- 동류 보강.',
    gisin: '금(金) -- 목을 극하여 파격. 화(火) 과다 -- 목 설기.',
  },

  /** 염상격(炎上格) -- YEOM_SANG_GYEOK -- 火 전왕격
   *  화(火) 일간이 사주 전체에 火가 극도로 왕성할 때 성립. */
  YEOM_SANG_GYEOK: {
    name: 'YEOM_SANG_GYEOK',
    hanja: '炎上格',
    hangul: '염상격',
    romanja: 'Yeom-sang-gyeok',
    bunryu: 'JEONWANG',
    seongnipWonchik:
      '丙/丁(화일간)이 寅午戌(화국 삼합) 또는 巳午未(여름 화방)을 이루고 '
      + '사주 전체가 火의 기운으로 통일될 때 성립한다. '
      + '수(水)가 없거나 극히 약해야 한다.',
    teukcheong:
      '열정적이고 화려하며 예술/문화/미디어/정치에서 두각을 나타낸다. '
      + '염상(炎上)은 불꽃이 위로 치솟는 기세를 상징한다.',
    seonggveokJogeon:
      '지지에 寅午戌 삼합 또는 巳午未 방합이 있고 수기(水氣)가 없으면 성격. '
      + '목(木)이 화를 생하면 더욱 왕성한 염상격이 된다.',
    pagyeokJogeon:
      '수(水)가 사주에 있거나 운에서 오면 파격. '
      + '토(土)가 과다하면 화가 설기되어 약해진다.',
    heesin: '목(木) -- 화를 생하여 격 강화. 화(火) -- 동류 보강.',
    gisin: '수(水) -- 화를 극하여 파격. 토(土) 과다 -- 화 설기.',
  },

  /** 가색격(稼穡格) -- GA_SAEK_GYEOK -- 土 전왕격
   *  토(土) 일간이 사주 전체에 土가 극도로 왕성할 때 성립. */
  GA_SAEK_GYEOK: {
    name: 'GA_SAEK_GYEOK',
    hanja: '稼穡格',
    hangul: '가색격',
    romanja: 'Ga-saek-gyeok',
    bunryu: 'JEONWANG',
    seongnipWonchik:
      '戊/己(토일간)이 辰戌丑未(사고지, 토방) 전부 또는 대부분을 갖추고 '
      + '사주 전체가 土의 기운으로 통일될 때 성립한다. '
      + '목(木)이 없거나 극히 약해야 한다.',
    teukcheong:
      '후덕하고 포용력이 넓으며 농업/부동산/토목/건축에서 성취를 이룬다. '
      + '가색(稼穡)은 파종(稼)하고 수확(穡)하는 농사를 상징한다.',
    seonggveokJogeon:
      '지지에 辰戌丑未가 3개 이상 있고 목기(木氣)가 없으면 성격. '
      + '화(火)가 토를 생하면 더욱 왕성한 가색격이 된다.',
    pagyeokJogeon:
      '목(木)이 사주에 있거나 운에서 오면 파격. '
      + '금(金)이 과다하면 토가 설기되어 약해진다.',
    heesin: '화(火) -- 토를 생하여 격 강화. 토(土) -- 동류 보강.',
    gisin: '목(木) -- 토를 극하여 파격. 금(金) 과다 -- 토 설기.',
  },

  /** 종혁격(從革格) -- JONG_HYEOK_GYEOK -- 金 전왕격
   *  금(金) 일간이 사주 전체에 金이 극도로 왕성할 때 성립. */
  JONG_HYEOK_GYEOK: {
    name: 'JONG_HYEOK_GYEOK',
    hanja: '從革格',
    hangul: '종혁격',
    romanja: 'Jong-hyeok-gyeok',
    bunryu: 'JEONWANG',
    seongnipWonchik:
      '庚/辛(금일간)이 巳酉丑(금국 삼합) 또는 申酉戌(가을 금방)을 이루고 '
      + '사주 전체가 金의 기운으로 통일될 때 성립한다. '
      + '화(火)가 없거나 극히 약해야 한다.',
    teukcheong:
      '결단력/의리/개혁 정신이 강하며 군인/법조/금융/기술에서 두각을 나타낸다. '
      + '종혁(從革)은 가죽을 다루듯 변혁/개혁하는 금의 성질을 상징한다.',
    seonggveokJogeon:
      '지지에 巳酉丑 삼합 또는 申酉戌 방합이 있고 화기(火氣)가 없으면 성격. '
      + '토(土)가 금을 생하면 더욱 왕성한 종혁격이 된다.',
    pagyeokJogeon:
      '화(火)가 사주에 있거나 운에서 오면 파격. '
      + '수(水)가 과다하면 금이 설기되어 약해진다.',
    heesin: '토(土) -- 금을 생하여 격 강화. 금(金) -- 동류 보강.',
    gisin: '화(火) -- 금을 극하여 파격. 수(水) 과다 -- 금 설기.',
  },

  /** 윤하격(潤下格) -- YUN_HA_GYEOK -- 水 전왕격
   *  수(水) 일간이 사주 전체에 水가 극도로 왕성할 때 성립. */
  YUN_HA_GYEOK: {
    name: 'YUN_HA_GYEOK',
    hanja: '潤下格',
    hangul: '윤하격',
    romanja: 'Yun-ha-gyeok',
    bunryu: 'JEONWANG',
    seongnipWonchik:
      '壬/癸(수일간)이 申子辰(수국 삼합) 또는 亥子丑(겨울 수방)을 이루고 '
      + '사주 전체가 水의 기운으로 통일될 때 성립한다. '
      + '토(土)가 없거나 극히 약해야 한다.',
    teukcheong:
      '지혜롭고 유연하며 학문/연구/철학/수산/해운에서 성취를 이룬다. '
      + '윤하(潤下)는 물이 아래로 적시며 흐르는 성질을 상징한다.',
    seonggveokJogeon:
      '지지에 申子辰 삼합 또는 亥子丑 방합이 있고 토기(土氣)가 없으면 성격. '
      + '금(金)이 수를 생하면 더욱 왕성한 윤하격이 된다.',
    pagyeokJogeon:
      '토(土)가 사주에 있거나 운에서 오면 파격. '
      + '목(木)이 과다하면 수가 설기되어 약해진다.',
    heesin: '금(金) -- 수를 생하여 격 강화. 수(水) -- 동류 보강.',
    gisin: '토(土) -- 수를 극하여 파격. 목(木) 과다 -- 수 설기.',
  },
};

// -----------------------------------------------------------------------
// 잡격(雜格) 목록
// -----------------------------------------------------------------------

/**
 * 잡격(雜格) 목록
 *
 * 팔정격/외격/종격/화기격/전왕격에 해당하지 않는 기타 특수 격국.
 *
 * 포함 격국:
 *   일행득기격(一行得氣格), 양신성상격(兩神成象格)
 */
export const JAPGYEOK_TABLE: Record<string, GyeokGukData> = {

  /** 일행득기격(一行得氣格) -- IL_HAENG_DEUK_GI_GYEOK
   *  사주의 천간/지지가 모두 하나의 오행으로 통일된 격.
   *  전왕격과 유사하나 일간 오행에 한정하지 않고 어떤 오행이든 가능. */
  IL_HAENG_DEUK_GI_GYEOK: {
    name: 'IL_HAENG_DEUK_GI_GYEOK',
    hanja: '一行得氣格',
    hangul: '일행득기격',
    romanja: 'Il-haeng-deuk-gi-gyeok',
    bunryu: 'JAPGYEOK',
    seongnipWonchik:
      '사주 8자(천간 4 + 지지 4)가 모두 하나의 오행에 해당하는 극히 드문 격국. '
      + '천간과 지지 전체가 동일 오행 계열로 구성되어야 한다. '
      + '전왕격의 극단적 형태로 볼 수 있다.',
    teukcheong:
      '해당 오행의 순수한 기운이 극대화되어 그 분야에서 독보적 능력을 발휘한다. '
      + '다만 편중이 극심하여 해당 오행을 극하는 운이 오면 매우 위험하다.',
    seonggveokJogeon:
      '사주 전체가 단일 오행으로 통일되고 극하는 오행이 전무하면 성격. '
      + '해당 오행을 생하는 오행이 있으면 더욱 안정된다.',
    pagyeokJogeon:
      '해당 오행을 극하는 오행이 운에서 오면 파격하여 대흉. '
      + '설기하는 오행이 과다해도 격이 약화된다.',
    heesin: '동류 오행, 생부(生扶)하는 오행.',
    gisin: '극하는 오행, 과다한 설기 오행.',
  },

  /** 양신성상격(兩神成象格) -- YANG_SIN_SEONG_SANG_GYEOK
   *  사주에 두 가지 오행만이 균등하게 대립/조화를 이루는 격. */
  YANG_SIN_SEONG_SANG_GYEOK: {
    name: 'YANG_SIN_SEONG_SANG_GYEOK',
    hanja: '兩神成象格',
    hangul: '양신성상격',
    romanja: 'Yang-sin-seong-sang-gyeok',
    bunryu: 'JAPGYEOK',
    seongnipWonchik:
      '사주에 오직 두 가지 오행만 존재하며 그 세력이 균등할 때 성립한다. '
      + '두 오행 사이의 관계에 따라 상생(相生)형과 상극(相克)형으로 나뉜다. '
      + '상생형: 한 오행이 다른 오행을 생하는 관계 (예: 木+火). '
      + '상극형: 한 오행이 다른 오행을 극하는 관계 (예: 金+木).',
    teukcheong:
      '상생형은 조화롭고 안정적이며, 상극형은 긴장 속 균형을 이룬다. '
      + '두 오행의 특성을 모두 발휘하여 다재다능하다.',
    seonggveokJogeon:
      '두 오행의 세력이 균등(5:5 또는 4:6 이내)하고 '
      + '제3의 오행이 전혀 없거나 극히 미약하면 성격. '
      + '상생형이면 생하는 쪽이 약간 강한 것이 이상적이다.',
    pagyeokJogeon:
      '제3의 오행이 운에서 와서 균형을 깨면 파격. '
      + '두 오행의 세력 차이가 벌어지면 양신성상이 무너진다.',
    heesin: '두 오행 중 약한 쪽을 보강하는 오행.',
    gisin: '두 오행의 균형을 깨는 제3의 오행.',
  },
};

// -----------------------------------------------------------------------
// 격국 성립(成格)/파격(破格) 원칙
// -----------------------------------------------------------------------

/**
 * 격국 성립(成格) 일반 원칙
 *
 * 자평진전(子平眞詮) 기반 격국 성립의 핵심 원칙들.
 */
export const SEONGGVEOK_WONCHIK: readonly string[] = [
  // 원칙 1: 월령(月令) 투출 우선
  '월지(月支) 지장간 중 천간에 투출(透出)한 글자가 격국을 결정한다.',
  // 원칙 2: 투출 우선순위
  '여러 지장간이 투출된 경우 월령 용사(月令用事) 지장간을 우선한다.',
  // 원칙 3: 본기 우선
  '지장간 투출 우선순위: 본기(本氣) > 중기(中氣) > 여기(餘氣).',
  // 원칙 4: 투출 없으면 본기
  '어떤 지장간도 투출하지 않으면 월지 본기(本氣)의 십신으로 격을 취한다.',
  // 원칙 5: 희신이 격을 보좌
  '희신(喜神)이 格을 보좌하면 성격(成格)이 더욱 완전해진다.',
  // 원칙 6: 청탁(淸濁)
  '格이 淸(청)하면 성격이 되고 濁(탁)하면 파격에 가깝다.',
  // 원칙 7: 용신과 格의 관계
  '格과 용신(用神)이 서로 보완할 때 사주가 가장 이상적이다.',
];

/**
 * 파격(破格) 일반 원칙
 *
 * 格이 파괴되는 공통 조건들.
 */
export const PAGYEOK_WONCHIK: readonly string[] = [
  // 원칙 1: 기신의 克
  '기신(忌神)이 格의 핵심 글자를 克하거나 합(合)하여 제거하면 파격.',
  // 원칙 2: 충파(沖破)
  '格을 구성하는 지지나 천간이 충(沖)/파(破)를 당하면 파격.',
  // 원칙 3: 혼잡(混雜)
  '동일한 十神이 과다하게 혼잡하면 格이 탁해져 파격에 가까워진다.',
  // 원칙 4: 공망(空亡)
  '格을 구성하는 핵심 글자가 공망(空亡)에 해당하면 格의 기능이 약화된다.',
  // 원칙 5: 합거(合去)
  '格의 용신이 합(合)으로 묶여 본래 기능을 상실하면 파격.',
  // 원칙 6: 파격 후 구격(救格)
  '파격이 되어도 구신(救神)이 있으면 파격의 흉을 줄일 수 있다.',
];

// -----------------------------------------------------------------------
// 격국 판별 순서와 우선순위 규칙
// -----------------------------------------------------------------------

/**
 * 격국 판별 순서와 우선순위 규칙
 *
 * 자평진전(子平眞詮) 기반 격국 판정의 단계별 절차.
 * 격국 판별은 반드시 이 순서를 따라야 한다.
 */
export const GYEOKGUK_PANBYEOL_SUNSE: readonly string[] = [
  // 1단계: 종격/전왕격 판별 (극단적 강약 우선 검토)
  '1단계: 일간의 강약이 극단적인지 판별한다. '
  + '일간이 극약(極弱)이면 종격(從格) 여부를 먼저 검토하고, '
  + '극강(極强)이면 전왕격(專旺格) 여부를 검토한다.',

  // 2단계: 화기격 판별
  '2단계: 일간이 인접 천간과 천간합(天干合)을 이루는지 확인한다. '
  + '합이 있고 월지가 합화 결과 오행을 지원하면 화기격(化氣格) 여부를 검토한다.',

  // 3단계: 월지 본기 확인
  '3단계: 월지(月支)의 본기(本氣)가 일간에 대해 어떤 십신인지 확인한다. '
  + '비견이면 건록격, 겁재(양간의 경우)면 양인격으로 처리한다.',

  // 4단계: 지장간 투출 확인
  '4단계: 월지 지장간(본기/중기/여기) 중 년간/월간/시간에 투출된 것을 찾는다. '
  + '투출된 지장간의 십신이 격국을 결정한다.',

  // 5단계: 투출 우선순위
  '5단계: 여러 지장간이 동시에 투출된 경우 우선순위를 적용한다. '
  + '본기 투출 > 중기 투출 > 여기 투출 순으로 우선한다.',

  // 6단계: 투출 없음
  '6단계: 어떤 지장간도 투출하지 않으면 월지 본기의 십신으로 격을 취한다.',

  // 7단계: 잡격 검토
  '7단계: 위 단계에서 격이 결정되지 않으면 잡격(雜格) 여부를 검토한다. '
  + '양신성상격/일행득기격 등 특수 구조를 확인한다.',
];

// -----------------------------------------------------------------------
// 격국 희신(喜神)/기신(忌神) 분류 요약
// -----------------------------------------------------------------------

/**
 * 팔정격(八正格) 희신(喜神)/기신(忌神) 요약 테이블
 *
 * 각 격에 따른 핵심 희신과 기신을 빠르게 참조하기 위한 요약 테이블.
 */
export const GYEOK_HEESIN_GISIN: Record<string, { heesin: string; gisin: string }> = {
  JEONGGWAN_GYEOK:  { heesin: '재성/인성/비겁',           gisin: '상관/편관혼재/인성과다' },
  PYEONGWAN_GYEOK:  { heesin: '식신/인성/양인',           gisin: '재성/상관/비겁과다' },
  JEONGIN_GYEOK:    { heesin: '관성/비겁',                gisin: '재성/식상과다' },
  PYEONIN_GYEOK:    { heesin: '관성/비겁',                gisin: '재성/식신동주' },
  SIKSIN_GYEOK:     { heesin: '재성/비겁',                gisin: '편인/상관혼재' },
  SANG_GWAN_GYEOK:  { heesin: '재성/인성',                gisin: '정관/인성과다' },
  JEONGJAE_GYEOK:   { heesin: '식상/관성',                gisin: '비겁과다/인성과다' },
  PYEONJAE_GYEOK:   { heesin: '식상/관성',                gisin: '비겁과다/인성과다' },
};

// -----------------------------------------------------------------------
// 건록(建祿) 매핑 테이블
// -----------------------------------------------------------------------

/**
 * 일간별 건록지(建祿地) 매핑
 *
 * 십이운성에서 건록(建祿)에 해당하는 지지(地支).
 * 월지가 이 지지에 해당하면 건록격이 성립한다.
 *
 * 인덱스: 천간 인덱스 (0=甲 ~ 9=癸)
 * 값: 지지 인덱스 (0=子 ~ 11=亥)
 *
 * 배속:
 *   甲(0)=寅(2), 乙(1)=卯(3), 丙(2)=巳(5), 丁(3)=午(6), 戊(4)=巳(5),
 *   己(5)=午(6), 庚(6)=申(8), 辛(7)=酉(9), 壬(8)=亥(11), 癸(9)=子(0)
 */
export const GEON_ROK_TABLE: readonly BranchIdx[] = [
  2,  // 甲 → 寅
  3,  // 乙 → 卯
  5,  // 丙 → 巳
  6,  // 丁 → 午
  5,  // 戊 → 巳
  6,  // 己 → 午
  8,  // 庚 → 申
  9,  // 辛 → 酉
  11, // 壬 → 亥
  0,  // 癸 → 子
] as const;

/**
 * 양간(陽干) 양인지(羊刃地) 매핑
 *
 * 양인(羊刃)은 양간 전용 개념으로, 건록의 다음 지지(제왕지)에 해당한다.
 * 음간에게는 양인이 성립하지 않으며 대신 겁재(劫財)로 처리한다.
 *
 * 인덱스: 양간 인덱스 (0=甲, 2=丙, 4=戊, 6=庚, 8=壬)
 * 값: 양인 지지 인덱스 (양간이 아닌 인덱스는 -1)
 *
 * 배속:
 *   甲(0)=卯(3), 丙(2)=午(6), 戊(4)=午(6), 庚(6)=酉(9), 壬(8)=子(0)
 */
export const YANG_IN_BRANCH_TABLE: readonly number[] = [
  3,  // 甲 → 卯
  -1, // 乙 (음간 -- 양인 해당 없음)
  6,  // 丙 → 午
  -1, // 丁 (음간)
  6,  // 戊 → 午
  -1, // 己 (음간)
  9,  // 庚 → 酉
  -1, // 辛 (음간)
  0,  // 壬 → 子
  -1, // 癸 (음간)
] as const;

// -----------------------------------------------------------------------
// 십신(十神) → 격국명 매핑
// -----------------------------------------------------------------------

/**
 * 월지 본기 십신(TenGod) → 격국 식별자 매핑
 *
 * 월지 본기가 일간에 대해 특정 십신일 때 어떤 격국을 취하는지 결정한다.
 * 비견(BI_GYEON)은 건록격, 겁재(GEOB_JAE)는 월겁격으로 처리한다.
 */
export const TENGO_TO_GYEOK: Record<TenGod, string> = {
  JEONG_GWAN: 'JEONGGWAN_GYEOK',
  PYEON_GWAN: 'PYEONGWAN_GYEOK',
  JEONG_IN:   'JEONGIN_GYEOK',
  PYEON_IN:   'PYEONIN_GYEOK',
  SIK_SHIN:   'SIKSIN_GYEOK',
  SANG_GWAN:  'SANG_GWAN_GYEOK',
  JEONG_JAE:  'JEONGJAE_GYEOK',
  PYEON_JAE:  'PYEONJAE_GYEOK',
  BI_GYEON:   'GEON_ROK_GYEOK',
  GEOB_JAE:   'WOL_GEOP_GYEOK',
};

// -----------------------------------------------------------------------
// 격국 판별 유틸리티 함수
// -----------------------------------------------------------------------

/**
 * 모든 격국 테이블을 통합하여 조회한다.
 *
 * @param gyeokName - 격국 로마자 식별자
 * @returns 격국 데이터 (없으면 undefined)
 */
export function getGyeokGukData(gyeokName: string): GyeokGukData | undefined {
  return PALMJEONG_GYEOK_TABLE[gyeokName]
    ?? OEGYEOK_TABLE[gyeokName]
    ?? JONGGUK_TABLE[gyeokName]
    ?? HWAGI_GYEOK_TABLE[gyeokName]
    ?? JEONWANG_GYEOK_TABLE[gyeokName]
    ?? JAPGYEOK_TABLE[gyeokName];
}

/**
 * 팔정격(八正格) 여부 확인
 *
 * @param gyeokName - 격국 로마자 식별자
 * @returns 팔정격이면 true
 */
export function isPalmjeongGyeok(gyeokName: string): boolean {
  return gyeokName in PALMJEONG_GYEOK_TABLE;
}

/**
 * 외격(外格) 여부 확인
 *
 * @param gyeokName - 격국 로마자 식별자
 * @returns 외격이면 true
 */
export function isOegyeok(gyeokName: string): boolean {
  return gyeokName in OEGYEOK_TABLE;
}

/**
 * 종격(從格) 여부 확인
 *
 * @param gyeokName - 격국 로마자 식별자
 * @returns 종격이면 true
 */
export function isJongguk(gyeokName: string): boolean {
  return gyeokName in JONGGUK_TABLE;
}

/**
 * 화기격(化氣格) 여부 확인
 *
 * @param gyeokName - 격국 로마자 식별자
 * @returns 화기격이면 true
 */
export function isHwagiGyeok(gyeokName: string): boolean {
  return gyeokName in HWAGI_GYEOK_TABLE;
}

/**
 * 전왕격(專旺格) 여부 확인
 *
 * @param gyeokName - 격국 로마자 식별자
 * @returns 전왕격이면 true
 */
export function isJeonwangGyeok(gyeokName: string): boolean {
  return gyeokName in JEONWANG_GYEOK_TABLE;
}

/**
 * 월지가 일간의 건록지(建祿地)인지 확인한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 건록지이면 true
 *
 * @example
 * isGeonRok(0, 2)  // 甲일간 寅월 → true
 * isGeonRok(6, 8)  // 庚일간 申월 → true
 * isGeonRok(0, 3)  // 甲일간 卯월 → false (양인지)
 */
export function isGeonRok(ilganIdx: StemIdx, woljiIdx: BranchIdx): boolean {
  const s = ((ilganIdx % 10) + 10) % 10;
  const b = ((woljiIdx % 12) + 12) % 12;
  return GEON_ROK_TABLE[s] === b;
}

/**
 * 월지가 양간(陽干) 일간의 양인지(羊刃地)인지 확인한다.
 *
 * 양인은 양간 전용 개념이다. 음간에게는 항상 false를 반환한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 양인지이면 true
 *
 * @example
 * isYangIn(0, 3)  // 甲일간(양간) 卯월 → true
 * isYangIn(1, 2)  // 乙일간(음간) 寅월 → false (음간 양인 없음)
 * isYangIn(6, 9)  // 庚일간(양간) 酉월 → true
 */
export function isYangIn(ilganIdx: StemIdx, woljiIdx: BranchIdx): boolean {
  const s = ((ilganIdx % 10) + 10) % 10;
  const b = ((woljiIdx % 12) + 12) % 12;
  const yangInBranch = YANG_IN_BRANCH_TABLE[s];
  if (yangInBranch === undefined || yangInBranch < 0) return false;
  return yangInBranch === b;
}

/**
 * 월지 지장간 중 천간에 투출(透出)된 것을 찾아 격국 후보를 반환한다.
 *
 * 투출 판정: 월지의 지장간(본기/중기/여기) 천간이 년간/월간/시간에
 * 동일하게 나타나면 투출로 판정한다.
 *
 * 반환되는 배열은 투출 우선순위순으로 정렬된다:
 *   본기(MAIN) > 중기(MIDDLE) > 여기(RESIDUAL)
 *
 * @param ilganIdx    - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx    - 월지 인덱스 (0=子 ~ 11=亥)
 * @param otherStems  - 년간/월간/시간 인덱스 배열 (일간 제외)
 * @returns 투출된 지장간의 십신(TenGod)과 해당 격국 식별자 배열 (우선순위순)
 *
 * @example
 * // 甲일간, 申월, 년간=庚, 월간=壬, 시간=丙
 * // 申의 지장간: 본기=庚(6), 중기=壬(8), 여기=戊(4)
 * // 庚(편관), 壬(편인) 투출 → [{tenGod:'PYEON_GWAN', gyeok:'PYEONGWAN_GYEOK'}, ...]
 * findTuchulGyeok(0, 8, [6, 8, 2])
 */
export function findTuchulGyeok(
  ilganIdx: StemIdx,
  woljiIdx: BranchIdx,
  otherStems: StemIdx[],
): Array<{ tenGod: TenGod; gyeok: string; role: string }> {
  const b = ((woljiIdx % 12) + 12) % 12;
  const hiddenStems = hiddenStemsOfBranch(b);
  const stemSet = new Set(otherStems.map(s => ((s % 10) + 10) % 10));

  // Collect which hidden stems are transparent (appear in otherStems)
  const candidates: Array<{ tenGod: TenGod; gyeok: string; role: string; priority: number }> = [];

  for (const hs of hiddenStems) {
    if (stemSet.has(hs.stem)) {
      const tg = tenGodOf(ilganIdx, hs.stem);
      // Skip BI_GYEON and GEOB_JAE -- these lead to 건록격/월겁격, not 팔정격
      const gyeokName = TENGO_TO_GYEOK[tg];
      const rolePriority = hs.role === 'MAIN' ? 0 : hs.role === 'MIDDLE' ? 1 : 2;
      candidates.push({ tenGod: tg, gyeok: gyeokName, role: hs.role, priority: rolePriority });
    }
  }

  // Sort by priority (MAIN first)
  candidates.sort((a, b2) => a.priority - b2.priority);

  return candidates.map(c => ({ tenGod: c.tenGod, gyeok: c.gyeok, role: c.role }));
}

/**
 * 격국 판별 결과 인터페이스
 */
export interface GyeokGukResult {
  /** 격국 식별자 (로마자) */
  gyeokName: string;
  /** 격국 분류 */
  bunryu: GyeokGukBunryu;
  /** 판별 근거 설명 */
  geungeo: string;
  /** 해당 격국의 상세 데이터 */
  data: GyeokGukData | undefined;
}

/**
 * 월령(月令) 기반 정격(正格) 판별
 *
 * 자평진전(子平眞詮) 기반 격국 판별의 핵심 로직.
 * 종격/전왕격/화기격은 별도 판단이 필요하며, 이 함수는
 * 팔정격(八正格)과 외격(건록격/월겁격/양인격)만을 판별한다.
 *
 * 판별 순서:
 *   1. 월지가 건록지이면 → 건록격
 *   2. 월지가 양인지이면(양간 전용) → 양인격
 *   3. 월지 본기가 겁재이면(음간 포함) → 월겁격
 *   4. 월지 지장간 중 투출된 것이 있으면 → 해당 팔정격
 *   5. 투출이 없으면 → 월지 본기의 십신으로 격을 결정
 *
 * @param ilganIdx   - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx   - 월지 인덱스 (0=子 ~ 11=亥)
 * @param otherStems - 년간/월간/시간 인덱스 배열 (일간 제외)
 * @returns 격국 판별 결과
 *
 * @example
 * // 甲일간, 酉월(辛본기=정관), 년간=壬, 월간=辛, 시간=丙
 * determineJeongGyeok(0, 9, [8, 7, 2])
 * // → { gyeokName: 'JEONGGWAN_GYEOK', bunryu: 'PALMJEONG', ... }
 */
export function determineJeongGyeok(
  ilganIdx: StemIdx,
  woljiIdx: BranchIdx,
  otherStems: StemIdx[],
): GyeokGukResult {
  const s = ((ilganIdx % 10) + 10) % 10;
  const b = ((woljiIdx % 12) + 12) % 12;

  // 1. 건록격 확인
  if (isGeonRok(s, b)) {
    // Check if there are tuchul that override -- per 자평진전, 건록격은 투출 격이 아닌
    // 별도 격이므로 건록격으로 처리
    return {
      gyeokName: 'GEON_ROK_GYEOK',
      bunryu: 'OEGYEOK',
      geungeo: '월지가 일간의 건록지(建祿地)에 해당한다.',
      data: OEGYEOK_TABLE['GEON_ROK_GYEOK'],
    };
  }

  // 2. 양인격 확인 (양간 전용)
  if (isYangIn(s, b)) {
    return {
      gyeokName: 'YANG_IN_GYEOK',
      bunryu: 'OEGYEOK',
      geungeo: '월지가 양간 일간의 양인지(羊刃地)에 해당한다.',
      data: OEGYEOK_TABLE['YANG_IN_GYEOK'],
    };
  }

  // 3. 월겁격 확인 (음간의 겁재 위치)
  const bongiTenGod = getBongiTenGod(s, b);
  if (bongiTenGod === 'GEOB_JAE') {
    return {
      gyeokName: 'WOL_GEOP_GYEOK',
      bunryu: 'OEGYEOK',
      geungeo: '월지 본기가 일간에 대해 겁재(劫財)에 해당한다.',
      data: OEGYEOK_TABLE['WOL_GEOP_GYEOK'],
    };
  }

  // 4. 지장간 투출 확인
  const tuchul = findTuchulGyeok(s, b, otherStems);
  // Filter out BI_GYEON/GEOB_JAE tuchul (already handled above)
  const validTuchul = tuchul.filter(
    t => t.tenGod !== 'BI_GYEON' && t.tenGod !== 'GEOB_JAE',
  );

  if (validTuchul.length > 0) {
    const best = validTuchul[0]!;
    return {
      gyeokName: best.gyeok,
      bunryu: 'PALMJEONG',
      geungeo: `월지 지장간(${best.role}) 투출: ${best.tenGod}.`,
      data: PALMJEONG_GYEOK_TABLE[best.gyeok],
    };
  }

  // 5. 투출 없음 -- 월지 본기의 십신으로 격을 결정
  // Note: GEOB_JAE is already handled by the early return above (step 3).
  // BI_GYEON may still reach here if isGeonRok returned false for edge cases.
  const gyeokName = TENGO_TO_GYEOK[bongiTenGod];
  const bunryu: GyeokGukBunryu =
    bongiTenGod === 'BI_GYEON'
      ? 'OEGYEOK'
      : 'PALMJEONG';

  return {
    gyeokName,
    bunryu,
    geungeo: `지장간 투출 없음. 월지 본기 십신(${bongiTenGod})으로 격을 취한다.`,
    data: getGyeokGukData(gyeokName),
  };
}

// -----------------------------------------------------------------------
// 내부 헬퍼 함수
// -----------------------------------------------------------------------

/**
 * 월지 본기(本氣)의 십신(TenGod)을 반환한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @param woljiIdx - 월지 인덱스 (0=子 ~ 11=亥)
 * @returns 월지 본기의 십신
 */
function getBongiTenGod(ilganIdx: StemIdx, woljiIdx: BranchIdx): TenGod {
  const b = ((woljiIdx % 12) + 12) % 12;
  const hiddenStems = hiddenStemsOfBranch(b);
  // Find the MAIN (bongi) hidden stem
  const bongi = hiddenStems.find(hs => hs.role === 'MAIN');
  if (!bongi) {
    // Fallback: use first hidden stem (should not happen)
    return tenGodOf(ilganIdx, hiddenStems[0]?.stem ?? 0);
  }
  return tenGodOf(ilganIdx, bongi.stem);
}

/**
 * 격국 분류(bunryu)별 전체 격국 목록을 반환한다.
 *
 * @param bunryu - 격국 분류
 * @returns 해당 분류의 격국 데이터 배열
 */
export function getGyeokGukByBunryu(bunryu: GyeokGukBunryu): GyeokGukData[] {
  const tables: Record<GyeokGukBunryu, Record<string, GyeokGukData>> = {
    PALMJEONG: PALMJEONG_GYEOK_TABLE,
    OEGYEOK:   OEGYEOK_TABLE,
    JONGGUK:   JONGGUK_TABLE,
    HWAGI:     HWAGI_GYEOK_TABLE,
    JEONWANG:  JEONWANG_GYEOK_TABLE,
    JAPGYEOK:  JAPGYEOK_TABLE,
  };
  const table = tables[bunryu];
  return Object.values(table);
}

/**
 * 모든 격국 데이터를 하나의 배열로 반환한다.
 *
 * @returns 전체 격국 데이터 배열
 */
export function getAllGyeokGukData(): GyeokGukData[] {
  return [
    ...Object.values(PALMJEONG_GYEOK_TABLE),
    ...Object.values(OEGYEOK_TABLE),
    ...Object.values(JONGGUK_TABLE),
    ...Object.values(HWAGI_GYEOK_TABLE),
    ...Object.values(JEONWANG_GYEOK_TABLE),
    ...Object.values(JAPGYEOK_TABLE),
  ];
}

/**
 * 격국 이름(한글)으로 격국 데이터를 검색한다.
 *
 * @param hangul - 격국 한글 이름 (예: '정관격', '종재격')
 * @returns 격국 데이터 (없으면 undefined)
 */
export function findGyeokGukByHangul(hangul: string): GyeokGukData | undefined {
  return getAllGyeokGukData().find(d => d.hangul === hangul);
}

/**
 * 화기격(化氣格) 합화 오행별 격국 식별자 매핑
 *
 * 천간합의 결과 오행에 따라 해당하는 화기격 식별자를 반환한다.
 *
 * @param resultOhhaeng - 합화 결과 오행 ('MOK' | 'HWA' | 'TO' | 'GEUM' | 'SU')
 * @returns 화기격 식별자 (없으면 undefined)
 */
export function getHwagiGyeokByOhhaeng(resultOhhaeng: Ohhaeng): string | undefined {
  const mapping: Record<Ohhaeng, string> = {
    TO:   'HWA_TO_GYEOK',
    GEUM: 'HWA_GEUM_GYEOK',
    SU:   'HWA_SU_GYEOK',
    MOK:  'HWA_MOK_GYEOK',
    HWA:  'HWA_HWA_GYEOK',
  };
  return mapping[resultOhhaeng];
}

/**
 * 전왕격(專旺格) 일간 오행별 격국 식별자 매핑
 *
 * 일간의 오행에 따라 해당하는 전왕격 식별자를 반환한다.
 *
 * @param ilganIdx - 일간 인덱스 (0=甲 ~ 9=癸)
 * @returns 전왕격 식별자 (없으면 undefined)
 */
export function getJeonwangGyeokByIlgan(ilganIdx: StemIdx): string | undefined {
  const s = ((ilganIdx % 10) + 10) % 10;
  const element = stemElement(s);
  const mapping: Record<string, string> = {
    WOOD:  'GOK_JIK_GYEOK',
    FIRE:  'YEOM_SANG_GYEOK',
    EARTH: 'GA_SAEK_GYEOK',
    METAL: 'JONG_HYEOK_GYEOK',
    WATER: 'YUN_HA_GYEOK',
  };
  return mapping[element];
}
