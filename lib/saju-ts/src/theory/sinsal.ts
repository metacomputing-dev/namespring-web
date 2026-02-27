/**
 * 신살론(神殺論) — 주요 신살(神殺)의 정의와 계산 테이블
 *
 * 신살(神殺)이란 사주팔자(四柱八字) 내 특정 간지(干支) 조합에서
 * 발생하는 길신(吉神)·흉살(凶殺)의 총칭이다.
 *
 * 자평진전(子平眞詮), 명리정종(命理正宗), 삼명통회(三命通會) 이론에
 * 근거하여 주요 신살을 구현한다.
 *
 * 일간(日干) 로마자:
 *   GAP(甲), EUL(乙), BYEONG(丙), JEONG(丁), MU(戊),
 *   GI(己), GYEONG(庚), SIN(辛), IM(壬), GYE(癸)
 *
 * 지지(地支) 로마자:
 *   JA(子), CHUK(丑), IN(寅), MYO(卯), JIN(辰), SA(巳),
 *   O(午), MI(未), SHIN(申), YU(酉), SUL(戌), HAE(亥)
 *
 * 공망(空亡)은 별도 모듈에서 다루므로 이 파일에서는 제외한다.
 */

// -------------------------------------------------------------------------
// 기본 타입
// -------------------------------------------------------------------------

export type Cheongan =
  | 'GAP' | 'EUL' | 'BYEONG' | 'JEONG' | 'MU'
  | 'GI' | 'GYEONG' | 'SIN' | 'IM' | 'GYE';

export type Jiji =
  | 'JA' | 'CHUK' | 'IN' | 'MYO' | 'JIN' | 'SA'
  | 'O' | 'MI' | 'SHIN' | 'YU' | 'SUL' | 'HAE';

/** 신살(神殺) 분류: GILSIN(吉神), HYUNGSAL(凶殺), JUNGNIP(中立) */
export type SinsalBunryu = 'GILSIN' | 'HYUNGSAL' | 'JUNGNIP';

/** 길흉(吉凶) 등급: GIL(吉), HYUNG(凶), GIL_HYUNG(길흉혼재) */
export type GilhyungDeunggup = 'GIL' | 'HYUNG' | 'GIL_HYUNG';

export type SinsalGyesan =
  | 'ILGAN' | 'NYEONJI' | 'ILJI' | 'WOLJI' | 'NYEONJI_ILJI' | 'JIJI_SSANG'
  | 'ILJU' | 'GANJI_JOGEON';

// -------------------------------------------------------------------------
// 신살 데이터 인터페이스
// -------------------------------------------------------------------------

export interface SinsalData {
  name: string;
  /** 한자 표기 (주석 전용) — 예: '天乙貴人' */
  hanja: string;
  /** 한글 표기 — 예: '천을귀인' */
  hangul: string;
  /** 로마자 표기 — 예: 'Cheon-eul Gwiin' */
  romanja: string;
  bunryu: SinsalBunryu;
  gyesanGijun: SinsalGyesan;
  seongjil: string;
  gilhyung: GilhyungDeunggup;
  gilhyungSeolmyeong: string;
}

// -------------------------------------------------------------------------
// 주요 신살 테이블 (SINSAL_TABLE)
// -------------------------------------------------------------------------

export const SINSAL_TABLE: Record<string, SinsalData> = {

  /** 천을귀인(天乙貴人) — CHEON_EUL_GWIIN
   *  일간(日干)을 기준으로 해당하는 두 지지(地支)가 사주에 있으면 성립.
   *  삼명통회(三命通會): 귀인이 가는 곳마다 재화가 없어진다. */
  CHEON_EUL_GWIIN: {
    name: 'CHEON_EUL_GWIIN',
    hanja: '天乙貴人',
    hangul: '천을귀인',
    romanja: 'Cheon-eul Gwiin',
    bunryu: 'GILSIN',
    gyesanGijun: 'ILGAN',
    seongjil:
      '귀인(貴人)의 도움을 받으며 총명하고 덕망이 높다. '
      + '관직·학문·사업에서 윗사람의 후원을 받으며 위기 상황에서 구원을 얻는다. '
      + '성품이 온화하고 인자하여 대인 관계가 원만하다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '사주에 천을귀인이 있으면 귀인의 도움으로 위기를 면하고 복록이 두텁다. '
      + '형충(刑沖)을 당하면 작용이 감소하나 완전히 소멸하지는 않는다.',
  },

  /** 문창귀인(文昌貴人) — MUN_CHANG_GWIIN
   *  장생지(長生支)에서 순행 4번째 지지. 학문·총명·문장을 상징. */
  MUN_CHANG_GWIIN: {
    name: 'MUN_CHANG_GWIIN',
    hanja: '文昌貴人',
    hangul: '문창귀인',
    romanja: 'Mun-chang Gwiin',
    bunryu: 'GILSIN',
    gyesanGijun: 'ILGAN',
    seongjil:
      '총명하고 학문·예술에 재능이 뛰어나다. '
      + '문장력이 우수하고 창의적이며 시험 운이 좋다. '
      + '학자·문인·예술가·교육자로서 두각을 나타낸다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '시험·고시·자격증 취득에 유리하고 학업 성취가 높다. '
      + '명예와 지식으로 사회에서 인정받으며 문화·예술 분야에서 성공한다. '
      + '공망(空亡)이나 형충(刑沖)이 있으면 효력이 약화된다.',
  },

  /** 학당귀인(學堂貴人) — HAK_DANG_GWIIN
   *  장생지(長生支)와 동일한 지지. 배움의 전당(學堂)을 상징. */
  HAK_DANG_GWIIN: {
    name: 'HAK_DANG_GWIIN',
    hanja: '學堂貴人',
    hangul: '학당귀인',
    romanja: 'Hak-dang Gwiin',
    bunryu: 'GILSIN',
    gyesanGijun: 'ILGAN',
    seongjil:
      '학문을 즐기고 배움에 대한 열정이 강하다. '
      + '지식을 쌓아 사회에서 인정받으며 교육·연구·학문 분야에서 성공한다. '
      + '장생지(長生支)의 특성처럼 호기심과 적응력이 뛰어나다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '학업·자격증·고시에서 탁월한 성과를 거두며 학자·교수로 대성한다. '
      + '문창귀인과 함께 있으면 학문적 성취가 더욱 높아진다.',
  },

  /** 양인(羊刃) — YANG_IN
   *  제왕지(帝旺支). 극단적 강기(强氣). 양간(陽干)에만 성립. */
  YANG_IN: {
    name: 'YANG_IN',
    hanja: '羊刃',
    hangul: '양인',
    romanja: 'Yang-in',
    bunryu: 'JUNGNIP',
    gyesanGijun: 'ILGAN',
    seongjil:
      '일간의 기운이 극도로 강하여 패기와 추진력이 넘친다. '
      + '의지가 강하지만 고집이 세고 타협을 거부하는 경향이 있다. '
      + '군인·경찰·의사·외과의 등 강인한 직업에 유리하다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '신강(身强)할 때 양인이 있으면 형제·부부 갈등, 관재·사고·부상의 위험이 따른다. '
      + '신약(身弱)할 때는 오히려 일간을 돕는 긍정적 작용을 한다. '
      + '편관(偏官)이 양인을 다스리는 살인상생(殺刃相生)이 되면 무관·장군으로 대성한다.',
  },

  /** 도화살(桃花煞) — DO_HWA_SAL
   *  삼합 욕지(浴支). 년지·일지 기준. 이성 매력·예술 감각을 상징. */
  DO_HWA_SAL: {
    name: 'DO_HWA_SAL',
    hanja: '桃花煞',
    hangul: '도화살',
    romanja: 'Do-hwa Sal',
    bunryu: 'JUNGNIP',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '이성적 매력이 넘치고 예술적 감각이 뛰어나다. '
      + '사교적이며 인기가 많고 연예·예술·서비스업에서 두각을 나타낸다. '
      + '감수성이 풍부하고 낭만적이며 이성에게 호감을 준다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '길신과 함께하면 예술·연예·미디어 분야에서 명성을 얻는다. '
      + '흉살과 동주(同柱)하거나 여러 개 있으면 색정·주색으로 인한 재물 손실이 발생한다. '
      + '년지 도화는 대외적 인기, 일지 도화는 배우자의 도화기운을 나타낸다.',
  },

  /** 역마살(驛馬煞) — YEOK_MA_SAL
   *  삼합 생지(生支)를 충(沖). 년지·일지 기준. 이동·변화를 상징. */
  YEOK_MA_SAL: {
    name: 'YEOK_MA_SAL',
    hanja: '驛馬煞',
    hangul: '역마살',
    romanja: 'Yeok-ma Sal',
    bunryu: 'JUNGNIP',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '이동·여행·변화가 많고 활동적이며 한 곳에 정착하기 어렵다. '
      + '무역·외교·운송·여행업 등 이동이 잦은 직업에 적합하다. '
      + '새로운 환경에 빠르게 적응하는 유연성이 있다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '길신과 함께하면 해외 진출·무역·외교관으로 성공한다. '
      + '흉살과 함께하면 잦은 이사, 교통사고, 객지 고생의 위험이 있다. '
      + '공망(空亡)을 만나면 이동은 하나 성과가 없다.',
  },

  /** 화개살(華蓋煞) — HWA_GAE_SAL
   *  삼합 묘지(墓支). 년지·일지 기준. 고독·예술·종교를 상징. */
  HWA_GAE_SAL: {
    name: 'HWA_GAE_SAL',
    hanja: '華蓋煞',
    hangul: '화개살',
    romanja: 'Hwa-gae Sal',
    bunryu: 'JUNGNIP',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '예술적·종교적·철학적 감수성이 높고 신비적인 면을 지닌다. '
      + '고독을 즐기며 내면 세계가 풍부하다. '
      + '예술·철학·종교·역학(易學) 분야에서 뛰어난 능력을 발휘한다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '길신과 함께하면 예술가·종교인·철학자로서 명성을 떨친다. '
      + '흉살과 함께하거나 고립되면 고독, 은둔, 사회적 고립의 위험이 있다. '
      + '화개가 많으면 종교에 귀의하거나 독신(獨身)으로 살 가능성이 높다.',
  },

  /** 원진살(怨嗔煞) — WON_JIN_SAL
   *  지지 쌍. 원(怨)은 원한, 진(嗔)은 성냄. 육충과 다른 상호 반목. */
  WON_JIN_SAL: {
    name: 'WON_JIN_SAL',
    hanja: '怨嗔煞',
    hangul: '원진살',
    romanja: 'Won-jin Sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'JIJI_SSANG',
    seongjil:
      '서로 원한을 품고 반목·불화하는 기운. '
      + '처음에는 끌리나 시간이 지날수록 갈등과 반목으로 이어진다. '
      + '부부·동업자·직장 동료 사이에 원진살이 있으면 지속적인 불화가 발생한다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '원진살이 있는 두 지지가 사주에 함께 있거나 대운·세운에서 만나면 '
      + '인간관계의 갈등, 이별, 배신, 소송 등이 발생한다. '
      + '일지와 년지·월지가 원진이면 가족·부부간 불화가 심하다.',
  },

  /** 귀문관살(鬼門關煞) — GWIMUN_GWAN_SAL
   *  지지 쌍. 귀문(鬼門)은 귀신이 드나드는 문. 신기(神氣)·예민함을 상징. */
  GWIMUN_GWAN_SAL: {
    name: 'GWIMUN_GWAN_SAL',
    hanja: '鬼門關煞',
    hangul: '귀문관살',
    romanja: 'Gwimun-gwan Sal',
    bunryu: 'JUNGNIP',
    gyesanGijun: 'JIJI_SSANG',
    seongjil:
      '직감력·예지력·신기(神氣)가 강하고 예술적 영감과 창의력이 뛰어나다. '
      + '내면 세계가 풍부하고 영적 감수성이 높다. '
      + '신경이 예민하고 정신적 기복이 심한 경향이 있다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '길하게 작용하면 예술·영성·역학 분야에서 두각을 나타낸다. '
      + '흉하게 작용하면 신경쇠약, 정신적 불안정, 환청·환각 등이 나타날 수 있다. '
      + '사주가 균형 잡혀 있으면 흉작용이 약화되고 영적 감수성만 남는다.',
  },

  // -----------------------------------------------------------------------
  // 이하 추가 신살
  // -----------------------------------------------------------------------

  /** 천덕귀인(天德貴人) — CHEON_DEOK_GWIIN
   *  월지(月支)를 기준으로 해당 천간 또는 지지가 사주에 있으면 성립.
   *  하늘의 덕(德)으로 재난을 물리치고 복을 가져오는 길신. */
  CHEON_DEOK_GWIIN: {
    name: 'CHEON_DEOK_GWIIN',
    hanja: '天德貴人',
    hangul: '천덕귀인',
    romanja: 'Cheon-deok Gwiin',
    bunryu: 'GILSIN',
    gyesanGijun: 'WOLJI',
    seongjil:
      '하늘의 덕(德)이 임하여 재앙을 물리치고 흉살을 해소한다. '
      + '덕망이 높고 주변의 존경을 받으며 위기에서 구원을 얻는다. '
      + '성품이 너그럽고 자비로우며 사회에 덕을 베푸는 일에 적합하다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '천덕귀인이 있으면 형벌·재앙·질병을 면하고 일생이 평안하다. '
      + '월덕귀인과 함께 있으면 길한 작용이 배가된다. '
      + '형충(刑沖)을 당하면 효력이 감소하나 완전히 사라지지는 않는다.',
  },

  /** 월덕귀인(月德貴人) — WOL_DEOK_GWIIN
   *  월지(月支)를 기준으로 해당 천간이 사주에 있으면 성립.
   *  달의 덕(德)으로 재난을 피하고 복을 받는 길신. */
  WOL_DEOK_GWIIN: {
    name: 'WOL_DEOK_GWIIN',
    hanja: '月德貴人',
    hangul: '월덕귀인',
    romanja: 'Wol-deok Gwiin',
    bunryu: 'GILSIN',
    gyesanGijun: 'WOLJI',
    seongjil:
      '월(月)의 덕(德)이 임하여 재앙을 피하고 복록이 두텁다. '
      + '인품이 온화하고 덕이 높아 주위의 존경을 받는다. '
      + '관직·사업에서 순탄하고 질병·재난에서 벗어나는 힘이 있다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '월덕귀인이 있으면 관재·형벌을 면하고 질병에서 회복이 빠르다. '
      + '천덕귀인과 함께 있으면 천월이덕(天月二德)이라 하여 길한 작용이 극대화된다. '
      + '공망(空亡)이나 형충(刑沖)이 있으면 효력이 약화된다.',
  },

  /** 천관귀인(天官貴人) — CHEON_GWAN_GWIIN
   *  일간(日干) 기준으로 정관(正官)에 해당하는 지지가 녹(祿)이 되는 지지.
   *  관직·명예·승진을 상징하는 길신. */
  CHEON_GWAN_GWIIN: {
    name: 'CHEON_GWAN_GWIIN',
    hanja: '天官貴人',
    hangul: '천관귀인',
    romanja: 'Cheon-gwan Gwiin',
    bunryu: 'GILSIN',
    gyesanGijun: 'ILGAN',
    seongjil:
      '관직·명예·승진에 유리하며 사회적 지위를 얻는다. '
      + '학문과 벼슬에 두루 능하며 관료·공직자·법관으로 대성할 수 있다. '
      + '총명하고 품행이 단정하여 윗사람의 신임을 받는다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '천관귀인이 있으면 관직 운이 좋고 공직에서 승진이 빠르다. '
      + '정관(正官)이 용신(用神)일 때 더욱 강하게 작용한다. '
      + '형충(刑沖)이나 공망(空亡)을 만나면 관직 운에 장애가 생긴다.',
  },

  /** 비인(飛刃) — BI_IN
   *  양인(羊刃)을 충(沖)하는 지지. 양인의 기운이 날아드는 살. */
  BI_IN: {
    name: 'BI_IN',
    hanja: '飛刃',
    hangul: '비인',
    romanja: 'Bi-in',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'ILGAN',
    seongjil:
      '양인의 강기(强氣)가 밖으로 날아가 뜻밖의 재앙을 초래한다. '
      + '외부로부터의 돌발 사고·부상·수술의 위험이 있다. '
      + '충동적이고 예측불허의 사건이 발생하기 쉬운 기운이다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '비인이 있으면 교통사고·수술·부상 등 외부 충격에 주의해야 한다. '
      + '양인과 비인이 동시에 사주에 있으면 흉한 작용이 더욱 강화된다. '
      + '길신과 함께하면 흉작용이 약화되나 완전히 소멸하지는 않는다.',
  },

  /** 홍염살(紅艷殺) — HONG_YEOM_SAL
   *  일간(日干)을 기준으로 해당 지지. 도화살보다 더 강한 색정의 기운. */
  HONG_YEOM_SAL: {
    name: 'HONG_YEOM_SAL',
    hanja: '紅艷殺',
    hangul: '홍염살',
    romanja: 'Hong-yeom Sal',
    bunryu: 'JUNGNIP',
    gyesanGijun: 'ILGAN',
    seongjil:
      '이성에 대한 매력이 극도로 강하고 성적 매력이 넘친다. '
      + '연예·예술·미용·패션 분야에서 두각을 나타낸다. '
      + '도화살보다 더 강렬한 이성 유인력을 지닌다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '길하게 작용하면 연예인·모델·예술가로서 큰 인기를 얻는다. '
      + '흉하게 작용하면 색정·음란으로 인한 구설과 재물 손실이 있다. '
      + '도화살과 함께 있으면 이성 문제가 더욱 복잡해진다.',
  },

  /** 함지살(咸池殺) — HAM_JI_SAL
   *  년지/일지 기준. 도화살과 동의어로 쓰이기도 하나,
   *  전통적으로 함지(咸池)는 욕지(浴支)의 또 다른 이름이며
   *  색정·주색·방탕의 의미가 더 강하다. */
  HAM_JI_SAL: {
    name: 'HAM_JI_SAL',
    hanja: '咸池殺',
    hangul: '함지살',
    romanja: 'Ham-ji Sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '이성관계가 복잡하고 색정·주색에 빠지기 쉬운 기운이다. '
      + '감각적 쾌락을 추구하며 육체적 매력이 넘친다. '
      + '목욕·수영·물과 관련된 직업에 인연이 있다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '길하게 작용하면 예술·연예·미용 분야에서 성공한다. '
      + '흉하게 작용하면 주색잡기(酒色雜技)로 인한 파산·이혼·건강 악화가 있다. '
      + '도화살·홍염살과 중복되면 색정 문제가 더욱 심각해진다.',
  },

  /** 장성살(將星殺) — JANG_SEONG_SAL
   *  삼합 국(局)의 제왕지(帝旺支). 년지/일지 기준.
   *  장수(將帥)의 별로서 리더십과 권위를 상징. */
  JANG_SEONG_SAL: {
    name: 'JANG_SEONG_SAL',
    hanja: '將星殺',
    hangul: '장성살',
    romanja: 'Jang-seong Sal',
    bunryu: 'GILSIN',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '리더십과 통솔력이 뛰어나 조직을 이끄는 장수(將帥)의 기운이다. '
      + '권위와 위엄이 있으며 군인·경찰·정치가·경영자로 대성한다. '
      + '결단력이 있고 카리스마가 넘치며 아랫사람의 존경을 받는다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '장성이 사주에 있으면 조직의 수장으로서 리더십을 발휘한다. '
      + '길신과 함께하면 대권(大權)을 잡고 높은 지위에 오른다. '
      + '흉살과 함께하면 독선적이 되어 반발을 사기도 한다.',
  },

  /** 반안살(攀鞍殺) — BAN_AN_SAL
   *  삼합 국(局)의 건록지(建祿支). 년지/일지 기준.
   *  말안장(鞍)에 오르는 형상으로 승진·출세를 상징. */
  BAN_AN_SAL: {
    name: 'BAN_AN_SAL',
    hanja: '攀鞍殺',
    hangul: '반안살',
    romanja: 'Ban-an Sal',
    bunryu: 'GILSIN',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '말안장에 오르듯 점진적으로 출세하고 승진하는 기운이다. '
      + '꾸준한 노력으로 사회적 지위를 얻으며 안정된 성공을 이룬다. '
      + '이동·여행에도 인연이 있어 외지에서 성공하기도 한다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '반안살이 있으면 꾸준히 승진하고 출세의 기회가 많다. '
      + '역마살과 함께 있으면 이동을 통한 출세가 유리하다. '
      + '형충(刑沖)을 당하면 승진에 장애가 생기거나 지위가 흔들린다.',
  },

  /** 천라지망(天羅地網) — CHEON_RA_JI_MANG
   *  술해(戌亥) = 천라(天羅), 진사(辰巳) = 지망(地網).
   *  하늘의 그물과 땅의 그물에 걸리는 형상. */
  CHEON_RA_JI_MANG: {
    name: 'CHEON_RA_JI_MANG',
    hanja: '天羅地網',
    hangul: '천라지망',
    romanja: 'Cheon-ra Ji-mang',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'JIJI_SSANG',
    seongjil:
      '하늘과 땅의 그물에 걸려 진퇴양난(進退兩難)에 빠지는 형상이다. '
      + '관재·송사·감금·구속의 위험이 있으며 자유가 제한된다. '
      + '화(火) 일간이 술해(戌亥)를 만나면 천라, 수(水) 일간이 진사(辰巳)를 만나면 지망이다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '천라지망이 있으면 관재·송사·구속 등 법적 문제에 주의해야 한다. '
      + '진퇴양난에 빠져 답답하고 돌파구를 찾기 어려운 시기를 겪는다. '
      + '길신이 함께하면 흉작용이 완화되나 근본적 해소는 어렵다.',
  },

  /** 백호대살(白虎大殺) — BAEK_HO_DAE_SAL
   *  월지(月支) 기준 해당 일지(日支). 백호(白虎)는 피·사고·수술을 상징. */
  BAEK_HO_DAE_SAL: {
    name: 'BAEK_HO_DAE_SAL',
    hanja: '白虎大殺',
    hangul: '백호대살',
    romanja: 'Baek-ho Dae-sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'ILJI',
    seongjil:
      '백호(白虎)가 날뛰는 형상으로 피를 보는 사고·수술·부상의 위험이 있다. '
      + '교통사고·낙상·골절·출혈 등 신체적 손상에 주의해야 한다. '
      + '의사·외과의·군인·경찰 등 피를 다루는 직업에 인연이 있기도 하다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '백호대살이 있으면 사고·수술·부상에 특히 주의해야 한다. '
      + '대운·세운에서 만나면 그 시기에 사고의 위험이 높아진다. '
      + '의료·군사·법집행 분야에 종사하면 살기(殺氣)가 직업으로 해소되기도 한다.',
  },

  /** 괴강살(魁罡殺) — GOE_GANG_SAL
   *  일주(日柱) 기준. 경진(庚辰)·임진(壬辰)·경술(庚戌)·무술(戊戌) 일주.
   *  강렬한 성격과 비범한 기질을 상징. */
  GOE_GANG_SAL: {
    name: 'GOE_GANG_SAL',
    hanja: '魁罡殺',
    hangul: '괴강살',
    romanja: 'Goe-gang Sal',
    bunryu: 'JUNGNIP',
    gyesanGijun: 'ILJU',
    seongjil:
      '성격이 강렬하고 기질이 비범하여 범인(凡人)과 다른 기운을 지닌다. '
      + '총명하고 결단력이 뛰어나며 무예·학문·법률에서 두각을 나타낸다. '
      + '고집이 세고 타협을 거부하며 독선적인 경향이 있다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '괴강일주는 신강(身强)하면 학문·무예·법관으로 대성한다. '
      + '신약(身弱)하면 고독하고 삶이 기복이 심하다. '
      + '재성(財星)·관성(官星)을 꺼리며, 인성(印星)·비겁(比劫)을 좋아한다. '
      + '형충(刑沖)이 있으면 길흉이 극단적으로 변한다.',
  },

  /** 고진(孤辰) — GO_JIN
   *  고진과숙(孤辰寡宿) 중 고진(孤辰). 년지 기준.
   *  외로운 별로서 고독·독립·자존심을 상징. */
  GO_JIN: {
    name: 'GO_JIN',
    hanja: '孤辰',
    hangul: '고진',
    romanja: 'Go-jin',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '독립심이 강하고 자존심이 높으며 외로움을 잘 타는 기운이다. '
      + '홀로 있기를 좋아하며 대인관계가 좁고 사교성이 부족하다. '
      + '남명(男命)에서 고진이 있으면 만혼(晩婚)이나 독신의 경향이 있다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '고진이 있으면 고독하고 외로운 시기를 보내기 쉽다. '
      + '과숙(寡宿)과 함께 있으면 고독이 더욱 심해진다. '
      + '화개살과 함께 있으면 종교·철학에 귀의하여 고독을 승화시킨다.',
  },

  /** 과숙(寡宿) — GWA_SUK
   *  고진과숙(孤辰寡宿) 중 과숙(寡宿). 년지 기준.
   *  과부(寡婦)의 별로서 배우자 운이 약함을 상징. */
  GWA_SUK: {
    name: 'GWA_SUK',
    hanja: '寡宿',
    hangul: '과숙',
    romanja: 'Gwa-suk',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '배우자 운이 약하고 결혼 생활이 순탄하지 않은 기운이다. '
      + '외로움이 깊고 내면이 공허하여 정서적 안정을 찾기 어렵다. '
      + '여명(女命)에서 과숙이 있으면 만혼(晩婚)이나 이혼의 경향이 있다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '과숙이 있으면 배우자와 이별하거나 고독한 생활을 하기 쉽다. '
      + '고진(孤辰)과 함께 있으면 고독이 더욱 심해진다. '
      + '길신과 함께하면 독립적인 생활에서 성취를 이루기도 한다.',
  },

  /** 천의성(天醫星) — CHEON_UI_SEONG
   *  월지(月支)에서 역행 2번째 지지. 의술·치유를 상징하는 길신. */
  CHEON_UI_SEONG: {
    name: 'CHEON_UI_SEONG',
    hanja: '天醫星',
    hangul: '천의성',
    romanja: 'Cheon-ui Seong',
    bunryu: 'GILSIN',
    gyesanGijun: 'WOLJI',
    seongjil:
      '의술·치유·건강 분야에 뛰어난 재능이 있다. '
      + '의사·한의사·약사·간호사 등 의료 관련 직업에 적합하다. '
      + '남을 돌보고 치유하는 능력이 뛰어나며 봉사정신이 강하다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '천의성이 있으면 의료 분야에서 두각을 나타내며 질병 회복이 빠르다. '
      + '질병으로 고생하더라도 좋은 의사를 만나 치유될 가능성이 높다. '
      + '편인(偏印)과 함께 있으면 의술에 더욱 능통하다.',
  },

  /** 천주귀(天廚貴) — CHEON_JU_GWI
   *  일간(日干) 기준. 천상의 주방이라는 뜻으로 식복(食福)이 풍성.
   *  식신(食神)의 녹(祿)에 해당하는 지지. */
  CHEON_JU_GWI: {
    name: 'CHEON_JU_GWI',
    hanja: '天廚貴',
    hangul: '천주귀',
    romanja: 'Cheon-ju Gwi',
    bunryu: 'GILSIN',
    gyesanGijun: 'ILGAN',
    seongjil:
      '식복(食福)이 풍성하여 먹을 것이 풍족하고 재물 운이 좋다. '
      + '식신(食神)의 기운이 녹(祿)에 앉아 복록이 두텁다. '
      + '요식업·식품업·연회·접대 관련 분야에서 성공한다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '천주귀가 있으면 일생 먹고 사는 걱정이 적고 재물이 풍족하다. '
      + '식신(食神)이 용신(用神)일 때 더욱 강하게 작용한다. '
      + '형충(刑沖)이 있으면 식복이 줄어들고 위장 질환에 주의해야 한다.',
  },

  /** 금여록(金輿祿) — GEUM_YEO_ROK
   *  일간(日干)을 기준으로 해당 지지. 금빛 수레(輿)를 타는 형상.
   *  부귀(富貴)·배우자 복(福)을 상징. */
  GEUM_YEO_ROK: {
    name: 'GEUM_YEO_ROK',
    hanja: '金輿祿',
    hangul: '금여록',
    romanja: 'Geum-yeo Rok',
    bunryu: 'GILSIN',
    gyesanGijun: 'ILGAN',
    seongjil:
      '금빛 수레를 타는 귀한 형상으로 배우자 복과 재물 복이 풍성하다. '
      + '부부 화합이 좋고 배우자의 내조가 뛰어나다. '
      + '재물 운이 풍족하고 사치스러운 생활을 즐긴다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '금여록이 있으면 배우자 복이 있고 부부 관계가 원만하다. '
      + '일지(日支)에 금여가 있으면 배우자가 현명하고 아름답다. '
      + '형충(刑沖)을 당하면 배우자 복이 감소한다.',
  },

  /** 천사(天赦) — CHEON_SA
   *  특정 계절(季節)과 간지(干支) 조합. 하늘의 사면(赦免).
   *  모든 죄를 용서받는 최고의 길일(吉日). */
  CHEON_SA: {
    name: 'CHEON_SA',
    hanja: '天赦',
    hangul: '천사',
    romanja: 'Cheon-sa',
    bunryu: 'GILSIN',
    gyesanGijun: 'GANJI_JOGEON',
    seongjil:
      '하늘이 사면(赦免)을 내리는 형상으로 모든 흉살이 해소된다. '
      + '사주에 천사가 있으면 일생 큰 재앙을 면하고 위기에서 구원을 얻는다. '
      + '관재·송사에서 무죄 방면되며 질병에서도 회복이 빠르다.',
    gilhyung: 'GIL',
    gilhyungSeolmyeong:
      '천사일(天赦日)에 태어나면 모든 흉살이 해소되고 길한 작용이 극대화된다. '
      + '백해무침(百害無侵)이라 하여 어떤 흉살도 천사 앞에서 힘을 잃는다. '
      + '매우 드문 길신이므로 사주에 있으면 매우 귀하게 본다.',
  },

  /** 효신살(梟神殺) — HYO_SIN_SAL
   *  식신(食神)을 극(剋)하는 편인(偏印)이 흉하게 작용할 때의 별칭.
   *  올빼미(梟)처럼 음흉한 기운. */
  HYO_SIN_SAL: {
    name: 'HYO_SIN_SAL',
    hanja: '梟神殺',
    hangul: '효신살',
    romanja: 'Hyo-sin Sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'ILGAN',
    seongjil:
      '편인(偏印)이 식신(食神)을 극(剋)하여 식복(食福)을 빼앗는 형상이다. '
      + '의심이 많고 음흉하며 계략을 잘 꾸미는 경향이 있다. '
      + '자녀 운이 약하고 식신의 작용이 억제되어 재물 운이 불안정하다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '효신살이 작용하면 식신의 복록이 감소하고 자녀 문제가 생긴다. '
      + '도식(倒食)이라고도 하며, 식신(食神)이 용신일 때 편인이 오면 흉하다. '
      + '식신이 없거나 편인이 용신이면 효신살은 성립하지 않는다.',
  },

  /** 겁살(劫殺) — GEOP_SAL
   *  삼합 국(局) 생지(生支)의 전(前) 지지. 년지/일지 기준.
   *  겁탈(劫奪)·도난·강탈을 상징. */
  GEOP_SAL: {
    name: 'GEOP_SAL',
    hanja: '劫殺',
    hangul: '겁살',
    romanja: 'Geop-sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '겁탈(劫奪)·도난·강탈의 위험이 있는 흉살이다. '
      + '재물 손실이 갑작스럽게 발생하고 뜻밖의 사건으로 재앙을 당한다. '
      + '총명하고 지혜로우나 이를 악용하여 남을 해치기도 한다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '겁살이 있으면 도난·사기·강탈에 주의해야 한다. '
      + '대운·세운에서 만나면 갑작스러운 재물 손실이 발생한다. '
      + '길신과 함께하면 결단력과 추진력으로 변하여 오히려 이로울 수 있다.',
  },

  /** 재살(災殺) — JAE_SAL
   *  삼합 국(局) 제왕지(帝旺支)의 다음 지지. 년지/일지 기준.
   *  재앙·재난을 상징. */
  JAE_SAL: {
    name: 'JAE_SAL',
    hanja: '災殺',
    hangul: '재살',
    romanja: 'Jae-sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '수재(水災)·화재(火災)·풍재(風災) 등 자연재해와 사고의 위험이 있다. '
      + '질병·부상·사고 등 신체적 재앙에 특히 주의해야 한다. '
      + '감옥·구금과 관련된 일이 발생하기도 한다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '재살이 있으면 재난·사고·질병에 주의해야 한다. '
      + '대운·세운에서 만나면 그 시기에 재앙의 위험이 높아진다. '
      + '화개살과 함께 있으면 종교·철학을 통해 재앙을 피할 수 있다.',
  },

  /** 천살(天殺) — CHEON_SAL
   *  삼합 국(局) 묘지(墓支)의 다음 지지. 년지/일지 기준.
   *  하늘에서 내리는 재앙. */
  CHEON_SAL: {
    name: 'CHEON_SAL',
    hanja: '天殺',
    hangul: '천살',
    romanja: 'Cheon-sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '하늘에서 내리는 재앙으로 천재지변·벼락·기상이변의 위험이 있다. '
      + '뜻밖의 재앙이 하늘에서 내려오는 형상이며 불가항력적 사건이 발생한다. '
      + '예측불허의 사건·사고에 주의해야 한다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '천살이 있으면 천재지변·낙뢰·항공사고 등에 주의해야 한다. '
      + '대운·세운에서 만나면 갑작스러운 재앙에 노출된다. '
      + '귀인(貴人)이 함께하면 흉작용이 완화된다.',
  },

  /** 지살(地殺) — JI_SAL
   *  삼합 국(局) 생지(生支)와 동일. 년지/일지 기준.
   *  땅에서 올라오는 재앙. 역마와 동일한 지지에 해당하기도 한다. */
  JI_SAL: {
    name: 'JI_SAL',
    hanja: '地殺',
    hangul: '지살',
    romanja: 'Ji-sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '땅에서 올라오는 재앙으로 지진·함몰·교통사고의 위험이 있다. '
      + '이동 중 사고·낙상·추락에 주의해야 한다. '
      + '역마(驛馬)의 성격을 겸하여 이동·변화가 많은 기운이다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '지살은 역마와 동일한 지지에 해당하여 이동·변화의 의미가 함께 있다. '
      + '길하게 작용하면 활발한 활동과 이동을 통한 성공을 의미한다. '
      + '흉하게 작용하면 이동 중 사고·재난의 위험이 있다.',
  },

  /** 년살(年殺) — NYEON_SAL
   *  삼합 국(局) 욕지(浴支)와 동일. 년지/일지 기준.
   *  도화(桃花)와 동일한 지지이나 흉살 관점에서 해석. */
  NYEON_SAL: {
    name: 'NYEON_SAL',
    hanja: '年殺',
    hangul: '년살',
    romanja: 'Nyeon-sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '년(年)의 살기(殺氣)로 이성 문제와 색정·주색의 위험이 있다. '
      + '도화살과 동일한 지지에 해당하되 흉살의 관점에서 해석한다. '
      + '음주·도박·색정으로 인한 재물 손실에 주의해야 한다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '년살이 있으면 이성 문제·음주·도박 등에 주의해야 한다. '
      + '도화살과 겹치면 색정 문제가 더욱 심각해진다. '
      + '길신과 함께하면 예술·연예 분야의 재능으로 전환된다.',
  },

  /** 월살(月殺) — WOL_SAL
   *  삼합 국(局) 관대지(冠帶支)와 동일. 년지/일지 기준.
   *  달(月)의 살기. 고통·고난을 상징. */
  WOL_SAL: {
    name: 'WOL_SAL',
    hanja: '月殺',
    hangul: '월살',
    romanja: 'Wol-sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'NYEONJI_ILJI',
    seongjil:
      '월(月)의 살기(殺氣)로 고통과 고난이 반복되는 기운이다. '
      + '한 달 주기로 기복이 있으며 정서적 불안정이 심하다. '
      + '가정·직장 내 갈등과 불화가 주기적으로 반복된다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '월살이 있으면 주기적인 고통과 시련이 반복된다. '
      + '대운·세운에서 만나면 해당 시기에 고난이 집중된다. '
      + '길신과 함께하면 시련을 극복하고 성장의 기회로 삼을 수 있다.',
  },

  /** 혈인살(血刃殺) — HYEOL_IN_SAL
   *  일간(日干) 기준. 피(血)와 칼날(刃)을 상징.
   *  출혈·수술·부상에 관련된 흉살. */
  HYEOL_IN_SAL: {
    name: 'HYEOL_IN_SAL',
    hanja: '血刃殺',
    hangul: '혈인살',
    romanja: 'Hyeol-in Sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'ILGAN',
    seongjil:
      '피(血)를 보는 사고·수술·부상의 위험이 있는 흉살이다. '
      + '교통사고·골절·출혈 등 유혈 사고에 특히 주의해야 한다. '
      + '여명(女命)의 경우 산후 출혈·부인과 질환에 주의해야 한다.',
    gilhyung: 'HYUNG',
    gilhyungSeolmyeong:
      '혈인살이 있으면 유혈 사고·수술에 주의해야 한다. '
      + '양인·비인과 함께 있으면 흉한 작용이 더욱 강화된다. '
      + '의사·외과의·군인 등 피를 다루는 직업에 종사하면 살기가 해소되기도 한다.',
  },

  /** 현침살(懸針殺) — HYEON_CHIM_SAL
   *  특정 천간(天干)의 글자 형태가 바늘을 매단(懸針) 형상.
   *  甲·申·辛 등 세로획이 꿰뚫는 글자. */
  HYEON_CHIM_SAL: {
    name: 'HYEON_CHIM_SAL',
    hanja: '懸針殺',
    hangul: '현침살',
    romanja: 'Hyeon-chim Sal',
    bunryu: 'HYUNGSAL',
    gyesanGijun: 'ILGAN',
    seongjil:
      '바늘을 매달아 놓은 형상으로 날카로움·예리함·극단성을 상징한다. '
      + '성격이 날카롭고 예민하며 비판적이다. '
      + '수술·침술·재봉·정밀기계 등 날카로운 도구를 다루는 직업에 인연이 있다.',
    gilhyung: 'GIL_HYUNG',
    gilhyungSeolmyeong:
      '현침살이 있으면 수술·부상·침습적 시술에 주의해야 한다. '
      + '예리한 판단력과 분석력으로 학문·연구·의술에 능통하기도 하다. '
      + '형충(刑沖)이 있으면 날카로움이 극단적으로 발현된다.',
  },
};

// -------------------------------------------------------------------------
// 계산 테이블
// -------------------------------------------------------------------------

/** 천을귀인(天乙貴人) 일간별 해당 지지 테이블
 *  일간 → [양귀인(陽貴人) 지지, 음귀인(陰貴人) 지지]
 *  출처: 삼명통회(三命通會) */
export const CHEON_EUL_GWIIN_TABLE: Record<Cheongan, [Jiji, Jiji]> = {
  GAP:    ['CHUK', 'MI'],    // 甲 → 丑, 未
  EUL:    ['JA',   'SHIN'],  // 乙 → 子, 申
  BYEONG: ['HAE',  'YU'],    // 丙 → 亥, 酉
  JEONG:  ['HAE',  'YU'],    // 丁 → 亥, 酉
  MU:     ['CHUK', 'MI'],    // 戊 → 丑, 未
  GI:     ['JA',   'SHIN'],  // 己 → 子, 申
  GYEONG: ['CHUK', 'MI'],    // 庚 → 丑, 未
  SIN:    ['IN',   'O'],     // 辛 → 寅, 午
  IM:     ['MYO',  'SA'],    // 壬 → 卯, 巳
  GYE:    ['MYO',  'SA'],    // 癸 → 卯, 巳
};

/** 문창귀인(文昌貴人) 일간별 해당 지지 테이블
 *  장생지(長生支) 기준 순행 4번째 지지. */
export const MUN_CHANG_GWIIN_TABLE: Record<Cheongan, Jiji> = {
  GAP:    'SA',    // 甲 → 巳
  EUL:    'O',     // 乙 → 午
  BYEONG: 'SHIN',  // 丙 → 申
  JEONG:  'YU',    // 丁 → 酉
  MU:     'SHIN',  // 戊 → 申
  GI:     'YU',    // 己 → 酉
  GYEONG: 'HAE',   // 庚 → 亥
  SIN:    'JA',    // 辛 → 子
  IM:     'IN',    // 壬 → 寅
  GYE:    'MYO',   // 癸 → 卯
};

/** 학당귀인(學堂貴人) 일간별 해당 지지 테이블
 *  십이운성(十二運星) 장생(長生)에 해당하는 지지. */
export const HAK_DANG_GWIIN_TABLE: Record<Cheongan, Jiji> = {
  GAP:    'HAE',   // 甲 → 亥 (목의 장생지)
  EUL:    'O',     // 乙 → 午 (음목 장생)
  BYEONG: 'IN',    // 丙 → 寅 (화의 장생지)
  JEONG:  'YU',    // 丁 → 酉 (음화 장생)
  MU:     'IN',    // 戊 → 寅 (양토 = 병과 동일)
  GI:     'JA',    // 己 → 子 (음토 장생)
  GYEONG: 'SA',    // 庚 → 巳 (금의 장생지)
  SIN:    'JA',    // 辛 → 子 (음금 장생)
  IM:     'SHIN',  // 壬 → 申 (수의 장생지)
  GYE:    'MYO',   // 癸 → 卯 (음수 장생)
};

/** 양인(羊刃) 일간별 해당 지지 테이블
 *  십이운성(十二運星) 제왕지(帝旺支). 양간(陽干)에만 성립. */
export const YANG_IN_TABLE: Partial<Record<Cheongan, Jiji>> = {
  GAP:    'MYO',  // 甲 → 卯 (목의 제왕지)
  BYEONG: 'O',    // 丙 → 午 (화의 제왕지)
  MU:     'O',    // 戊 → 午 (토의 제왕지)
  GYEONG: 'YU',   // 庚 → 酉 (금의 제왕지)
  IM:     'JA',   // 壬 → 子 (수의 제왕지)
};

/** 도화살(桃花煞) 년지/일지별 해당 지지 테이블
 *  삼합 국(局)의 욕지(浴支).
 *    申子辰 수국 → 酉  |  寅午戌 화국 → 卯
 *    亥卯未 목국 → 子  |  巳酉丑 금국 → 午 */
export const DO_HWA_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'YU',   // 申 → 酉
  JA:   'YU',   // 子 → 酉
  JIN:  'YU',   // 辰 → 酉
  IN:   'MYO',  // 寅 → 卯
  O:    'MYO',  // 午 → 卯
  SUL:  'MYO',  // 戌 → 卯
  HAE:  'JA',   // 亥 → 子
  MYO:  'JA',   // 卯 → 子
  MI:   'JA',   // 未 → 子
  SA:   'O',    // 巳 → 午
  YU:   'O',    // 酉 → 午
  CHUK: 'O',    // 丑 → 午
};

/** 역마살(驛馬煞) 년지/일지별 해당 지지 테이블
 *  삼합 국(局) 생지(生支)를 충(沖)하는 지지.
 *    申子辰 수국 → 寅  |  寅午戌 화국 → 申
 *    亥卯未 목국 → 巳  |  巳酉丑 금국 → 亥 */
export const YEOK_MA_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'IN',   // 申 → 寅
  JA:   'IN',   // 子 → 寅
  JIN:  'IN',   // 辰 → 寅
  IN:   'SHIN', // 寅 → 申
  O:    'SHIN', // 午 → 申
  SUL:  'SHIN', // 戌 → 申
  HAE:  'SA',   // 亥 → 巳
  MYO:  'SA',   // 卯 → 巳
  MI:   'SA',   // 未 → 巳
  SA:   'HAE',  // 巳 → 亥
  YU:   'HAE',  // 酉 → 亥
  CHUK: 'HAE',  // 丑 → 亥
};

/** 화개살(華蓋煞) 년지/일지별 해당 지지 테이블
 *  삼합 국(局)의 묘지(墓支).
 *    申子辰 수국 → 辰  |  寅午戌 화국 → 戌
 *    亥卯未 목국 → 未  |  巳酉丑 금국 → 丑 */
export const HWA_GAE_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'JIN',  // 申 → 辰
  JA:   'JIN',  // 子 → 辰
  JIN:  'JIN',  // 辰 → 辰 (자체)
  IN:   'SUL',  // 寅 → 戌
  O:    'SUL',  // 午 → 戌
  SUL:  'SUL',  // 戌 → 戌 (자체)
  HAE:  'MI',   // 亥 → 未
  MYO:  'MI',   // 卯 → 未
  MI:   'MI',   // 未 → 未 (자체)
  SA:   'CHUK', // 巳 → 丑
  YU:   'CHUK', // 酉 → 丑
  CHUK: 'CHUK', // 丑 → 丑 (자체)
};

/** 원진살(怨嗔煞) 지지 쌍 목록 — 6쌍
 *  子未(자미), 丑午(축오), 寅酉(인유), 卯申(묘신), 辰亥(진해), 巳戌(사술) */
export const WON_JIN_SAL_SSANG: ReadonlyArray<[Jiji, Jiji]> = [
  ['JA',   'MI'],   // 子未 (자미)
  ['CHUK', 'O'],    // 丑午 (축오)
  ['IN',   'YU'],   // 寅酉 (인유)
  ['MYO',  'SHIN'], // 卯申 (묘신)
  ['JIN',  'HAE'],  // 辰亥 (진해)
  ['SA',   'SUL'],  // 巳戌 (사술)
];

/** 귀문관살(鬼門關煞) 지지 쌍 목록 — 8쌍
 *  子酉(자유), 丑午(축오), 寅未(인미), 卯申(묘신),
 *  辰亥(진해), 巳戌(사술), 午丑(오축), 未寅(미인)
 *  학파에 따라 4쌍 또는 8쌍으로 보는 견해 차이가 있다. */
export const GWIMUN_GWAN_SAL_SSANG: ReadonlyArray<[Jiji, Jiji]> = [
  ['JA',   'YU'],   // 子酉 (자유)
  ['CHUK', 'O'],    // 丑午 (축오)
  ['IN',   'MI'],   // 寅未 (인미)
  ['MYO',  'SHIN'], // 卯申 (묘신)
  ['JIN',  'HAE'],  // 辰亥 (진해)
  ['SA',   'SUL'],  // 巳戌 (사술)
  ['O',    'CHUK'], // 午丑 (오축) — 역방향 포함
  ['MI',   'IN'],   // 未寅 (미인) — 역방향 포함
];

/** 천덕귀인(天德貴人) 월지별 해당 천간/지지 테이블
 *  월지(月支) → 천덕이 되는 천간 또는 지지
 *  출처: 삼명통회(三命通會), 연해자평(淵海子平) */
export const CHEON_DEOK_GWIIN_TABLE: Record<Jiji, Cheongan | Jiji> = {
  IN:   'JEONG',  // 寅월 → 丁
  MYO:  'SHIN',   // 卯월 → 申 (지지)
  JIN:  'IM',     // 辰월 → 壬
  SA:   'SIN',    // 巳월 → 辛
  O:    'HAE',    // 午월 → 亥 (지지)
  MI:   'GAP',    // 未월 → 甲
  SHIN: 'GYE',    // 申월 → 癸
  YU:   'IN',     // 酉월 → 寅 (지지)
  SUL:  'BYEONG', // 戌월 → 丙
  HAE:  'EUL',    // 亥월 → 乙
  JA:   'SA',     // 子월 → 巳 (지지)
  CHUK: 'GYEONG', // 丑월 → 庚
};

/** 월덕귀인(月德貴人) 월지별 해당 천간 테이블
 *  월지(月支) → 월덕이 되는 천간
 *  삼합(三合) 국의 양간(陽干)을 기준으로 한다.
 *  寅午戌(화국) → 丙, 申子辰(수국) → 壬, 亥卯未(목국) → 甲, 巳酉丑(금국) → 庚 */
export const WOL_DEOK_GWIIN_TABLE: Record<Jiji, Cheongan> = {
  IN:   'BYEONG', // 寅 (화국) → 丙
  O:    'BYEONG', // 午 (화국) → 丙
  SUL:  'BYEONG', // 戌 (화국) → 丙
  SHIN: 'IM',     // 申 (수국) → 壬
  JA:   'IM',     // 子 (수국) → 壬
  JIN:  'IM',     // 辰 (수국) → 壬
  HAE:  'GAP',    // 亥 (목국) → 甲
  MYO:  'GAP',    // 卯 (목국) → 甲
  MI:   'GAP',    // 未 (목국) → 甲
  SA:   'GYEONG', // 巳 (금국) → 庚
  YU:   'GYEONG', // 酉 (금국) → 庚
  CHUK: 'GYEONG', // 丑 (금국) → 庚
};

/** 천관귀인(天官貴人) 일간별 해당 지지 테이블
 *  일간(日干)의 정관(正官)이 녹(祿)에 해당하는 지지.
 *  甲→未, 乙→辰, 丙→酉, 丁→申, 戊→亥, 己→戌, 庚→卯, 辛→寅, 壬→巳, 癸→午 */
export const CHEON_GWAN_GWIIN_TABLE: Record<Cheongan, Jiji> = {
  GAP:    'MI',    // 甲 → 未
  EUL:    'JIN',   // 乙 → 辰
  BYEONG: 'YU',    // 丙 → 酉
  JEONG:  'SHIN',  // 丁 → 申
  MU:     'HAE',   // 戊 → 亥
  GI:     'SUL',   // 己 → 戌
  GYEONG: 'MYO',   // 庚 → 卯
  SIN:    'IN',    // 辛 → 寅
  IM:     'SA',    // 壬 → 巳
  GYE:    'O',     // 癸 → 午
};

/** 비인(飛刃) 일간별 해당 지지 테이블
 *  양인(羊刃)을 충(沖)하는 지지. 양간(陽干)에만 성립.
 *  甲양인=卯 → 충=酉, 丙양인=午 → 충=子, 戊양인=午 → 충=子,
 *  庚양인=酉 → 충=卯, 壬양인=子 → 충=午 */
export const BI_IN_TABLE: Partial<Record<Cheongan, Jiji>> = {
  GAP:    'YU',   // 甲 양인 卯 → 沖 酉
  BYEONG: 'JA',   // 丙 양인 午 → 沖 子
  MU:     'JA',   // 戊 양인 午 → 沖 子
  GYEONG: 'MYO',  // 庚 양인 酉 → 沖 卯
  IM:     'O',    // 壬 양인 子 → 沖 午
};

/** 홍염살(紅艷殺) 일간별 해당 지지 테이블
 *  출처: 삼명통회(三命通會) */
export const HONG_YEOM_SAL_TABLE: Record<Cheongan, Jiji> = {
  GAP:    'O',     // 甲 → 午
  EUL:    'SHIN',  // 乙 → 申
  BYEONG: 'IN',    // 丙 → 寅
  JEONG:  'MI',    // 丁 → 未
  MU:     'JIN',   // 戊 → 辰
  GI:     'JIN',   // 己 → 辰
  GYEONG: 'SUL',   // 庚 → 戌
  SIN:    'YU',    // 辛 → 酉
  IM:     'JA',    // 壬 → 子
  GYE:    'SHIN',  // 癸 → 申
};

/** 함지살(咸池殺) 년지/일지별 해당 지지 테이블
 *  도화살(桃花煞)과 동일한 조견표를 사용한다.
 *  해석 관점이 다를 뿐 계산 방법은 동일하다. */
export const HAM_JI_SAL_TABLE: Record<Jiji, Jiji> = DO_HWA_SAL_TABLE;

/** 장성살(將星殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局)의 제왕지(帝旺支).
 *    申子辰 수국 → 子  |  寅午戌 화국 → 午
 *    亥卯未 목국 → 卯  |  巳酉丑 금국 → 酉 */
export const JANG_SEONG_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'JA',   // 申 → 子
  JA:   'JA',   // 子 → 子 (자체)
  JIN:  'JA',   // 辰 → 子
  IN:   'O',    // 寅 → 午
  O:    'O',    // 午 → 午 (자체)
  SUL:  'O',    // 戌 → 午
  HAE:  'MYO',  // 亥 → 卯
  MYO:  'MYO',  // 卯 → 卯 (자체)
  MI:   'MYO',  // 未 → 卯
  SA:   'YU',   // 巳 → 酉
  YU:   'YU',   // 酉 → 酉 (자체)
  CHUK: 'YU',   // 丑 → 酉
};

/** 반안살(攀鞍殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局)의 건록지(建祿支).
 *    申子辰 수국 → 亥  |  寅午戌 화국 → 巳
 *    亥卯未 목국 → 寅  |  巳酉丑 금국 → 申 */
export const BAN_AN_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'HAE',  // 申 → 亥
  JA:   'HAE',  // 子 → 亥
  JIN:  'HAE',  // 辰 → 亥
  IN:   'SA',   // 寅 → 巳
  O:    'SA',   // 午 → 巳
  SUL:  'SA',   // 戌 → 巳
  HAE:  'IN',   // 亥 → 寅
  MYO:  'IN',   // 卯 → 寅
  MI:   'IN',   // 未 → 寅
  SA:   'SHIN', // 巳 → 申
  YU:   'SHIN', // 酉 → 申
  CHUK: 'SHIN', // 丑 → 申
};

/** 천라지망(天羅地網) 지지 쌍 목록
 *  천라(天羅): 戌亥(술해) 쌍 — 화(火) 일간이 만나면 천라
 *  지망(地網): 辰巳(진사) 쌍 — 수(水) 일간이 만나면 지망
 *  넓은 해석: 일간 불문하고 戌亥·辰巳 쌍이 사주에 있으면 성립 */
export const CHEON_RA_JI_MANG_SSANG: ReadonlyArray<[Jiji, Jiji]> = [
  ['SUL', 'HAE'],  // 戌亥 (천라)
  ['JIN', 'SA'],   // 辰巳 (지망)
];

/** 백호대살(白虎大殺) 일지(日支)별 성립 조건 테이블
 *  특정 일진(日辰)의 납음(納音)이 금(金)에 해당하고 백호가 임하는 경우.
 *  간편법: 갑진(甲辰)·을축(乙丑)·병술(丙戌)·정미(丁未)·무진(戊辰)·
 *  기축(己丑)·경술(庚戌)·신미(辛未)·임진(壬辰)·계축(癸丑) 등이 성립.
 *  여기서는 월지(月支) 기준 간편법 테이블을 사용한다.
 *  월지 → 백호가 임하는 지지 */
export const BAEK_HO_DAE_SAL_TABLE: Record<Jiji, Jiji> = {
  IN:   'SHIN',  // 寅월 → 申
  MYO:  'JIN',   // 卯월 → 辰
  JIN:  'SUL',   // 辰월 → 戌
  SA:   'CHUK',  // 巳월 → 丑
  O:    'MI',    // 午월 → 未
  MI:   'MYO',   // 未월 → 卯
  SHIN: 'YU',    // 申월 → 酉
  YU:   'HAE',   // 酉월 → 亥
  SUL:  'SA',    // 戌월 → 巳
  HAE:  'CHUK',  // 亥월 → 丑
  JA:   'O',     // 子월 → 午
  CHUK: 'IN',    // 丑월 → 寅
};

/** 괴강살(魁罡殺) 해당 일주(日柱) 목록
 *  [일간(天干), 일지(地支)] 조합으로 성립.
 *  庚辰(경진), 壬辰(임진), 庚戌(경술), 戊戌(무술) */
export const GOE_GANG_SAL_ILJU: ReadonlyArray<[Cheongan, Jiji]> = [
  ['GYEONG', 'JIN'],  // 庚辰
  ['IM',     'JIN'],  // 壬辰
  ['GYEONG', 'SUL'],  // 庚戌
  ['MU',     'SUL'],  // 戊戌
];

/** 고진(孤辰) 년지/일지별 해당 지지 테이블
 *  삼합(三合) 기준:
 *    寅卯辰(인묘진) → 巳, 巳午未(사오미) → 申,
 *    申酉戌(신유술) → 亥, 亥子丑(해자축) → 寅 */
export const GO_JIN_TABLE: Record<Jiji, Jiji> = {
  IN:   'SA',    // 寅 → 巳
  MYO:  'SA',    // 卯 → 巳
  JIN:  'SA',    // 辰 → 巳
  SA:   'SHIN',  // 巳 → 申
  O:    'SHIN',  // 午 → 申
  MI:   'SHIN',  // 未 → 申
  SHIN: 'HAE',   // 申 → 亥
  YU:   'HAE',   // 酉 → 亥
  SUL:  'HAE',   // 戌 → 亥
  HAE:  'IN',    // 亥 → 寅
  JA:   'IN',    // 子 → 寅
  CHUK: 'IN',    // 丑 → 寅
};

/** 과숙(寡宿) 년지/일지별 해당 지지 테이블
 *  삼합(三合) 기준:
 *    寅卯辰(인묘진) → 丑, 巳午未(사오미) → 辰,
 *    申酉戌(신유술) → 未, 亥子丑(해자축) → 戌 */
export const GWA_SUK_TABLE: Record<Jiji, Jiji> = {
  IN:   'CHUK',  // 寅 → 丑
  MYO:  'CHUK',  // 卯 → 丑
  JIN:  'CHUK',  // 辰 → 丑
  SA:   'JIN',   // 巳 → 辰
  O:    'JIN',   // 午 → 辰
  MI:   'JIN',   // 未 → 辰
  SHIN: 'MI',    // 申 → 未
  YU:   'MI',    // 酉 → 未
  SUL:  'MI',    // 戌 → 未
  HAE:  'SUL',   // 亥 → 戌
  JA:   'SUL',   // 子 → 戌
  CHUK: 'SUL',   // 丑 → 戌
};

/** 천의성(天醫星) 월지별 해당 지지 테이블
 *  월지(月支)에서 역행(逆行) 2번째 지지.
 *  寅월→丑, 卯월→寅, 辰월→卯, ... 순환 */
export const CHEON_UI_SEONG_TABLE: Record<Jiji, Jiji> = {
  IN:   'CHUK',  // 寅월 → 丑
  MYO:  'IN',    // 卯월 → 寅
  JIN:  'MYO',   // 辰월 → 卯
  SA:   'JIN',   // 巳월 → 辰
  O:    'SA',    // 午월 → 巳
  MI:   'O',     // 未월 → 午
  SHIN: 'MI',    // 申월 → 未
  YU:   'SHIN',  // 酉월 → 申
  SUL:  'YU',    // 戌월 → 酉
  HAE:  'SUL',   // 亥월 → 戌
  JA:   'HAE',   // 子월 → 亥
  CHUK: 'JA',    // 丑월 → 子
};

/** 천주귀(天廚貴) 일간별 해당 지지 테이블
 *  식신(食神)의 녹(祿)에 해당하는 지지.
 *  甲의 식신=丙, 丙의 록=巳 → 甲→巳
 *  乙의 식신=丁, 丁의 록=午 → 乙→午 ... */
export const CHEON_JU_GWI_TABLE: Record<Cheongan, Jiji> = {
  GAP:    'SA',    // 甲 → 巳 (식신 丙의 록)
  EUL:    'O',     // 乙 → 午 (식신 丁의 록)
  BYEONG: 'SHIN',  // 丙 → 申 (식신 戊의 록 — 戊寄巳 통설에서 申으로 봄)
  JEONG:  'YU',    // 丁 → 酉 (식신 己의 록 — 己寄午 통설에서 酉로 봄)
  MU:     'SHIN',  // 戊 → 申 (식신 庚의 록)
  GI:     'YU',    // 己 → 酉 (식신 辛의 록)
  GYEONG: 'HAE',   // 庚 → 亥 (식신 壬의 록)
  SIN:    'JA',    // 辛 → 子 (식신 癸의 록)
  IM:     'IN',    // 壬 → 寅 (식신 甲의 록)
  GYE:    'MYO',   // 癸 → 卯 (식신 乙의 록)
};

/** 금여록(金輿祿) 일간별 해당 지지 테이블
 *  일간(日干) 기준. 일간의 정재(正財)가 장생(長生)하는 지지.
 *  甲→辰, 乙→巳, 丙→未, 丁→申, 戊→未, 己→申, 庚→戌, 辛→亥, 壬→丑, 癸→寅 */
export const GEUM_YEO_ROK_TABLE: Record<Cheongan, Jiji> = {
  GAP:    'JIN',   // 甲 → 辰
  EUL:    'SA',    // 乙 → 巳
  BYEONG: 'MI',    // 丙 → 未
  JEONG:  'SHIN',  // 丁 → 申
  MU:     'MI',    // 戊 → 未
  GI:     'SHIN',  // 己 → 申
  GYEONG: 'SUL',   // 庚 → 戌
  SIN:    'HAE',   // 辛 → 亥
  IM:     'CHUK',  // 壬 → 丑
  GYE:    'IN',    // 癸 → 寅
};

/** 천사(天赦) 계절별 해당 간지 조합 목록
 *  [계절 월지 범위, 일간(天干), 일지(地支)]
 *  봄(寅卯辰): 戊寅日, 여름(巳午未): 甲午日, 가을(申酉戌): 戊申日, 겨울(亥子丑): 甲子日 */
export const CHEON_SA_TABLE: ReadonlyArray<{ wolji: Jiji[]; ilgan: Cheongan; ilji: Jiji }> = [
  { wolji: ['IN', 'MYO', 'JIN'],    ilgan: 'MU',  ilji: 'IN'  },  // 봄 → 戊寅日
  { wolji: ['SA', 'O', 'MI'],       ilgan: 'GAP', ilji: 'O'   },  // 여름 → 甲午日
  { wolji: ['SHIN', 'YU', 'SUL'],   ilgan: 'MU',  ilji: 'SHIN'},  // 가을 → 戊申日
  { wolji: ['HAE', 'JA', 'CHUK'],   ilgan: 'GAP', ilji: 'JA'  },  // 겨울 → 甲子日
];

/** 효신살(梟神殺) — 편인(偏印)이 식신(食神)을 극하는 조합
 *  일간(日干) → 효신이 되는 천간(편인 천간) */
export const HYO_SIN_SAL_TABLE: Record<Cheongan, Cheongan> = {
  GAP:    'IM',     // 甲의 편인 = 壬
  EUL:    'GYE',    // 乙의 편인 = 癸
  BYEONG: 'GAP',    // 丙의 편인 = 甲
  JEONG:  'EUL',    // 丁의 편인 = 乙
  MU:     'BYEONG', // 戊의 편인 = 丙
  GI:     'JEONG',  // 己의 편인 = 丁
  GYEONG: 'MU',     // 庚의 편인 = 戊
  SIN:    'GI',     // 辛의 편인 = 己
  IM:     'GYEONG', // 壬의 편인 = 庚
  GYE:    'SIN',    // 癸의 편인 = 辛
};

/** 겁살(劫殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局) 생지(生支)의 전(前) 지지 — 즉 생지에서 역행 1칸.
 *    申子辰 수국 → 생지 申 → 전=巳  |  寅午戌 화국 → 생지 寅 → 전=亥
 *    亥卯未 목국 → 생지 亥 → 전=申  |  巳酉丑 금국 → 생지 巳 → 전=寅 */
export const GEOP_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'SA',    // 申 → 巳
  JA:   'SA',    // 子 → 巳
  JIN:  'SA',    // 辰 → 巳
  IN:   'HAE',   // 寅 → 亥
  O:    'HAE',   // 午 → 亥
  SUL:  'HAE',   // 戌 → 亥
  HAE:  'SHIN',  // 亥 → 申
  MYO:  'SHIN',  // 卯 → 申
  MI:   'SHIN',  // 未 → 申
  SA:   'IN',    // 巳 → 寅
  YU:   'IN',    // 酉 → 寅
  CHUK: 'IN',    // 丑 → 寅
};

/** 재살(災殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局) 제왕지(帝旺支)의 다음 지지 — 즉 쇠지(衰地).
 *    申子辰 수국 → 제왕 子 → 다음=午  |  寅午戌 화국 → 제왕 午 → 다음=子
 *    亥卯未 목국 → 제왕 卯 → 다음=酉  |  巳酉丑 금국 → 제왕 酉 → 다음=卯
 *  (실질적으로 제왕지를 충(沖)하는 지지와 동일) */
export const JAE_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'O',     // 申 → 午
  JA:   'O',     // 子 → 午
  JIN:  'O',     // 辰 → 午
  IN:   'JA',    // 寅 → 子
  O:    'JA',    // 午 → 子
  SUL:  'JA',    // 戌 → 子
  HAE:  'YU',    // 亥 → 酉
  MYO:  'YU',    // 卯 → 酉
  MI:   'YU',    // 未 → 酉
  SA:   'MYO',   // 巳 → 卯
  YU:   'MYO',   // 酉 → 卯
  CHUK: 'MYO',   // 丑 → 卯
};

/** 천살(天殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局) 묘지(墓支)의 다음 지지 — 즉 절지(絶地).
 *    申子辰 수국 → 묘 辰 → 다음=巳  |  寅午戌 화국 → 묘 戌 → 다음=亥
 *    亥卯未 목국 → 묘 未 → 다음=申  |  巳酉丑 금국 → 묘 丑 → 다음=寅 */
export const CHEON_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'SA',    // 申 → 巳
  JA:   'SA',    // 子 → 巳
  JIN:  'SA',    // 辰 → 巳
  IN:   'HAE',   // 寅 → 亥
  O:    'HAE',   // 午 → 亥
  SUL:  'HAE',   // 戌 → 亥
  HAE:  'SHIN',  // 亥 → 申
  MYO:  'SHIN',  // 卯 → 申
  MI:   'SHIN',  // 未 → 申
  SA:   'IN',    // 巳 → 寅
  YU:   'IN',    // 酉 → 寅
  CHUK: 'IN',    // 丑 → 寅
};

/** 지살(地殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局)의 생지(生支)와 동일.
 *    申子辰 수국 → 申  |  寅午戌 화국 → 寅
 *    亥卯未 목국 → 亥  |  巳酉丑 금국 → 巳 */
export const JI_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'SHIN',  // 申 → 申 (자체)
  JA:   'SHIN',  // 子 → 申
  JIN:  'SHIN',  // 辰 → 申
  IN:   'IN',    // 寅 → 寅 (자체)
  O:    'IN',    // 午 → 寅
  SUL:  'IN',    // 戌 → 寅
  HAE:  'HAE',   // 亥 → 亥 (자체)
  MYO:  'HAE',   // 卯 → 亥
  MI:   'HAE',   // 未 → 亥
  SA:   'SA',    // 巳 → 巳 (자체)
  YU:   'SA',    // 酉 → 巳
  CHUK: 'SA',    // 丑 → 巳
};

/** 년살(年殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局) 욕지(浴支) — 도화살과 동일한 지지.
 *  계산 방법은 도화와 동일하되 흉살 관점에서 해석한다. */
export const NYEON_SAL_TABLE: Record<Jiji, Jiji> = DO_HWA_SAL_TABLE;

/** 월살(月殺) 년지/일지별 해당 지지 테이블
 *  삼합 국(局) 관대지(冠帶支).
 *    申子辰 수국 → 戌  |  寅午戌 화국 → 辰
 *    亥卯未 목국 → 丑  |  巳酉丑 금국 → 未 */
export const WOL_SAL_TABLE: Record<Jiji, Jiji> = {
  SHIN: 'SUL',   // 申 → 戌
  JA:   'SUL',   // 子 → 戌
  JIN:  'SUL',   // 辰 → 戌
  IN:   'JIN',   // 寅 → 辰
  O:    'JIN',   // 午 → 辰
  SUL:  'JIN',   // 戌 → 辰
  HAE:  'CHUK',  // 亥 → 丑
  MYO:  'CHUK',  // 卯 → 丑
  MI:   'CHUK',  // 未 → 丑
  SA:   'MI',    // 巳 → 未
  YU:   'MI',    // 酉 → 未
  CHUK: 'MI',    // 丑 → 未
};

/** 혈인살(血刃殺) 일간별 해당 지지 테이블
 *  출처: 삼명통회(三命通會)
 *  甲己→午, 乙庚→戌, 丙辛→寅, 丁壬→未, 戊癸→酉 (오합 기준) */
export const HYEOL_IN_SAL_TABLE: Record<Cheongan, Jiji> = {
  GAP:    'O',     // 甲 → 午
  GI:     'O',     // 己 → 午
  EUL:    'SUL',   // 乙 → 戌
  GYEONG: 'SUL',   // 庚 → 戌
  BYEONG: 'IN',    // 丙 → 寅
  SIN:    'IN',    // 辛 → 寅
  JEONG:  'MI',    // 丁 → 未
  IM:     'MI',    // 壬 → 未
  MU:     'YU',    // 戊 → 酉
  GYE:    'YU',    // 癸 → 酉
};

/** 현침살(懸針殺) 해당 천간 목록
 *  한자 자형(字形)에서 세로획이 관통하는 글자.
 *  甲(갑), 申(신 — 지지이나 천간 '辛'과 혼용되기도 함), 辛(신), 壬(임), 丑(축)
 *  일반적으로 일간이 甲·辛 또는 년간이 甲인 경우를 주로 본다. */
export const HYEON_CHIM_SAL_GAN: ReadonlyArray<Cheongan> = ['GAP', 'SIN'];

// -------------------------------------------------------------------------
// 신살 성립(成立) 판별 유틸리티 함수
// -------------------------------------------------------------------------

/** 천을귀인(天乙貴人) 성립 여부 확인
 *  @param ilgan    - 일간(日干) 로마자
 *  @param jijiList - 사주 지지(地支) 목록
 *  @returns 천을귀인이 성립하는 지지 목록 (없으면 빈 배열) */
export function cheonEulGwiinCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji[] {
  const [yang, eum] = CHEON_EUL_GWIIN_TABLE[ilgan];
  return jijiList.filter((j) => j === yang || j === eum);
}

/** 문창귀인(文昌貴人) 성립 여부 확인
 *  @returns 문창귀인이 성립하면 해당 지지, 없으면 null */
export function munChangGwiinCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = MUN_CHANG_GWIIN_TABLE[ilgan];
  return jijiList.includes(target) ? target : null;
}

/** 도화살(桃花煞) 성립 여부 확인 — 년지 또는 일지 기준 */
export function doHwaSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(DO_HWA_SAL_TABLE[gijunJiji]);
}

/** 역마살(驛馬煞) 성립 여부 확인 — 년지 또는 일지 기준 */
export function yeokMaSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(YEOK_MA_SAL_TABLE[gijunJiji]);
}

/** 원진살(怨嗔煞) 성립 여부 확인 */
export function wonJinSalCheck(jiji1: Jiji, jiji2: Jiji): boolean {
  return WON_JIN_SAL_SSANG.some(
    ([a, b]) => (a === jiji1 && b === jiji2) || (a === jiji2 && b === jiji1),
  );
}

/** 귀문관살(鬼門關煞) 성립 여부 확인 */
export function gwimunGwanSalCheck(jiji1: Jiji, jiji2: Jiji): boolean {
  return GWIMUN_GWAN_SAL_SSANG.some(
    ([a, b]) => (a === jiji1 && b === jiji2) || (a === jiji2 && b === jiji1),
  );
}

/** 학당귀인(學堂貴人) 성립 여부 확인
 *  @returns 학당귀인이 성립하면 해당 지지, 없으면 null */
export function hakDangGwiinCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = HAK_DANG_GWIIN_TABLE[ilgan];
  return jijiList.includes(target) ? target : null;
}

/** 양인(羊刃) 성립 여부 확인
 *  양간(陽干)에만 성립하며, 음간이면 항상 null. */
export function yangInCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = YANG_IN_TABLE[ilgan];
  if (target === undefined) return null;
  return jijiList.includes(target) ? target : null;
}

/** 화개살(華蓋煞) 성립 여부 확인 — 년지 또는 일지 기준 */
export function hwaGaeSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(HWA_GAE_SAL_TABLE[gijunJiji]);
}

/** 천덕귀인(天德貴人) 성립 여부 확인
 *  월지 기준으로 천덕이 되는 간/지가 사주의 천간·지지 목록에 있는지 확인.
 *  @param wolji     - 월지(月支)
 *  @param ganList   - 사주 천간(天干) 목록
 *  @param jijiList  - 사주 지지(地支) 목록
 *  @returns 천덕귀인 성립 여부 */
export function cheonDeokGwiinCheck(
  wolji: Jiji,
  ganList: Cheongan[],
  jijiList: Jiji[],
): boolean {
  const target = CHEON_DEOK_GWIIN_TABLE[wolji];
  // target은 천간 또는 지지일 수 있으므로 양쪽 모두 확인
  return (ganList as string[]).includes(target) || (jijiList as string[]).includes(target);
}

/** 월덕귀인(月德貴人) 성립 여부 확인
 *  월지 기준으로 월덕이 되는 천간이 사주의 천간 목록에 있는지 확인. */
export function wolDeokGwiinCheck(
  wolji: Jiji,
  ganList: Cheongan[],
): boolean {
  const target = WOL_DEOK_GWIIN_TABLE[wolji];
  return ganList.includes(target);
}

/** 천관귀인(天官貴人) 성립 여부 확인 */
export function cheonGwanGwiinCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = CHEON_GWAN_GWIIN_TABLE[ilgan];
  return jijiList.includes(target) ? target : null;
}

/** 비인(飛刃) 성립 여부 확인
 *  양간(陽干)에만 성립하며, 음간이면 항상 null. */
export function biInCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = BI_IN_TABLE[ilgan];
  if (target === undefined) return null;
  return jijiList.includes(target) ? target : null;
}

/** 홍염살(紅艷殺) 성립 여부 확인 */
export function hongYeomSalCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = HONG_YEOM_SAL_TABLE[ilgan];
  return jijiList.includes(target) ? target : null;
}

/** 함지살(咸池殺) 성립 여부 확인 — 년지 또는 일지 기준
 *  도화살과 동일한 테이블을 사용한다. */
export function hamJiSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(HAM_JI_SAL_TABLE[gijunJiji]);
}

/** 장성살(將星殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function jangSeongSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(JANG_SEONG_SAL_TABLE[gijunJiji]);
}

/** 반안살(攀鞍殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function banAnSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(BAN_AN_SAL_TABLE[gijunJiji]);
}

/** 천라지망(天羅地網) 성립 여부 확인
 *  사주 지지 중 戌亥 쌍 또는 辰巳 쌍이 있는지 확인. */
export function cheonRaJiMangCheck(jijiList: Jiji[]): Array<[Jiji, Jiji]> {
  const result: Array<[Jiji, Jiji]> = [];
  for (const [a, b] of CHEON_RA_JI_MANG_SSANG) {
    if (jijiList.includes(a) && jijiList.includes(b)) {
      result.push([a, b]);
    }
  }
  return result;
}

/** 백호대살(白虎大殺) 성립 여부 확인
 *  월지(月支) 기준으로 백호가 임하는 지지가 사주에 있는지 확인. */
export function baekHoDaeSalCheck(wolji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(BAEK_HO_DAE_SAL_TABLE[wolji]);
}

/** 괴강살(魁罡殺) 성립 여부 확인
 *  일간(日干)·일지(日支) 조합이 괴강 일주에 해당하는지 확인. */
export function goeGangSalCheck(ilgan: Cheongan, ilji: Jiji): boolean {
  return GOE_GANG_SAL_ILJU.some(([g, j]) => g === ilgan && j === ilji);
}

/** 고진(孤辰) 성립 여부 확인 — 년지 또는 일지 기준 */
export function goJinCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(GO_JIN_TABLE[gijunJiji]);
}

/** 과숙(寡宿) 성립 여부 확인 — 년지 또는 일지 기준 */
export function gwaSukCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(GWA_SUK_TABLE[gijunJiji]);
}

/** 천의성(天醫星) 성립 여부 확인
 *  월지(月支) 기준으로 천의가 되는 지지가 사주에 있는지 확인. */
export function cheonUiSeongCheck(wolji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(CHEON_UI_SEONG_TABLE[wolji]);
}

/** 천주귀(天廚貴) 성립 여부 확인 */
export function cheonJuGwiCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = CHEON_JU_GWI_TABLE[ilgan];
  return jijiList.includes(target) ? target : null;
}

/** 금여록(金輿祿) 성립 여부 확인 */
export function geumYeoRokCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = GEUM_YEO_ROK_TABLE[ilgan];
  return jijiList.includes(target) ? target : null;
}

/** 천사(天赦) 성립 여부 확인
 *  월지(계절)와 일간·일지 조합으로 판별. */
export function cheonSaCheck(
  wolji: Jiji,
  ilgan: Cheongan,
  ilji: Jiji,
): boolean {
  return CHEON_SA_TABLE.some(
    (entry) =>
      entry.wolji.includes(wolji) &&
      entry.ilgan === ilgan &&
      entry.ilji === ilji,
  );
}

/** 효신살(梟神殺) 성립 여부 확인
 *  사주 천간 중 편인(偏印)에 해당하는 천간이 있는지 확인.
 *  식신(食神)이 사주에 없으면 효신살은 성립하지 않는다는 설도 있으나,
 *  여기서는 편인 존재 여부만으로 판별한다. */
export function hyoSinSalCheck(
  ilgan: Cheongan,
  ganList: Cheongan[],
): boolean {
  const pyeonin = HYO_SIN_SAL_TABLE[ilgan];
  return ganList.includes(pyeonin);
}

/** 겁살(劫殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function geopSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(GEOP_SAL_TABLE[gijunJiji]);
}

/** 재살(災殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function jaeSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(JAE_SAL_TABLE[gijunJiji]);
}

/** 천살(天殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function cheonSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(CHEON_SAL_TABLE[gijunJiji]);
}

/** 지살(地殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function jiSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(JI_SAL_TABLE[gijunJiji]);
}

/** 년살(年殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function nyeonSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(NYEON_SAL_TABLE[gijunJiji]);
}

/** 월살(月殺) 성립 여부 확인 — 년지 또는 일지 기준 */
export function wolSalCheck(gijunJiji: Jiji, jijiList: Jiji[]): boolean {
  return jijiList.includes(WOL_SAL_TABLE[gijunJiji]);
}

/** 혈인살(血刃殺) 성립 여부 확인 */
export function hyeolInSalCheck(
  ilgan: Cheongan,
  jijiList: Jiji[],
): Jiji | null {
  const target = HYEOL_IN_SAL_TABLE[ilgan];
  return jijiList.includes(target) ? target : null;
}

/** 현침살(懸針殺) 성립 여부 확인
 *  일간이 甲 또는 辛이면 성립. */
export function hyeonChimSalCheck(ilgan: Cheongan): boolean {
  return HYEON_CHIM_SAL_GAN.includes(ilgan);
}

// -------------------------------------------------------------------------
// 종합 분석
// -------------------------------------------------------------------------

/** 사주 전체 신살(神殺) 분석 결과 */
export interface SinsalBunseokResult {
  // --- 길신(吉神) ---
  /** 성립한 천을귀인 지지 목록 */
  cheonEulGwiin: Jiji[];
  /** 천덕귀인 성립 여부 */
  cheonDeokGwiin: boolean;
  /** 월덕귀인 성립 여부 */
  wolDeokGwiin: boolean;
  /** 성립한 문창귀인 지지 (없으면 null) */
  munChangGwiin: Jiji | null;
  /** 학당귀인 성립 지지 (없으면 null) */
  hakDangGwiin: Jiji | null;
  /** 천관귀인 성립 지지 (없으면 null) */
  cheonGwanGwiin: Jiji | null;
  /** 천의성 성립 여부 */
  cheonUiSeong: boolean;
  /** 천주귀 성립 지지 (없으면 null) */
  cheonJuGwi: Jiji | null;
  /** 금여록 성립 지지 (없으면 null) */
  geumYeoRok: Jiji | null;
  /** 천사 성립 여부 */
  cheonSa: boolean;

  // --- 중립(中立) / 길흉혼재 ---
  /** 양인 성립 지지 (없으면 null) */
  yangIn: Jiji | null;
  /** 비인 성립 지지 (없으면 null) */
  biIn: Jiji | null;
  /** 도화살 성립 여부 (년지 기준) */
  doHwaSalByNyeonji: boolean;
  /** 도화살 성립 여부 (일지 기준) */
  doHwaSalByIlji: boolean;
  /** 홍염살 성립 지지 (없으면 null) */
  hongYeomSal: Jiji | null;
  /** 함지살 성립 여부 (년지 기준) */
  hamJiSalByNyeonji: boolean;
  /** 함지살 성립 여부 (일지 기준) */
  hamJiSalByIlji: boolean;
  /** 역마살 성립 여부 (년지 기준) */
  yeokMaSalByNyeonji: boolean;
  /** 역마살 성립 여부 (일지 기준) */
  yeokMaSalByIlji: boolean;
  /** 화개살 성립 여부 (년지 기준) */
  hwaGaeSalByNyeonji: boolean;
  /** 화개살 성립 여부 (일지 기준) */
  hwaGaeSalByIlji: boolean;
  /** 장성살 성립 여부 (년지 기준) */
  jangSeongSalByNyeonji: boolean;
  /** 장성살 성립 여부 (일지 기준) */
  jangSeongSalByIlji: boolean;
  /** 반안살 성립 여부 (년지 기준) */
  banAnSalByNyeonji: boolean;
  /** 반안살 성립 여부 (일지 기준) */
  banAnSalByIlji: boolean;
  /** 괴강살 성립 여부 */
  goeGangSal: boolean;
  /** 현침살 성립 여부 */
  hyeonChimSal: boolean;

  // --- 흉살(凶殺) ---
  /** 원진살 성립 지지 쌍 목록 */
  wonJinSal: Array<[Jiji, Jiji]>;
  /** 귀문관살 성립 지지 쌍 목록 */
  gwimunGwanSal: Array<[Jiji, Jiji]>;
  /** 천라지망 성립 지지 쌍 목록 */
  cheonRaJiMang: Array<[Jiji, Jiji]>;
  /** 백호대살 성립 여부 */
  baekHoDaeSal: boolean;
  /** 고진 성립 여부 (년지 기준) */
  goJinByNyeonji: boolean;
  /** 과숙 성립 여부 (년지 기준) */
  gwaSukByNyeonji: boolean;
  /** 효신살 성립 여부 */
  hyoSinSal: boolean;
  /** 겁살 성립 여부 (년지 기준) */
  geopSalByNyeonji: boolean;
  /** 겁살 성립 여부 (일지 기준) */
  geopSalByIlji: boolean;
  /** 재살 성립 여부 (년지 기준) */
  jaeSalByNyeonji: boolean;
  /** 재살 성립 여부 (일지 기준) */
  jaeSalByIlji: boolean;
  /** 천살 성립 여부 (년지 기준) */
  cheonSalByNyeonji: boolean;
  /** 천살 성립 여부 (일지 기준) */
  cheonSalByIlji: boolean;
  /** 지살 성립 여부 (년지 기준) */
  jiSalByNyeonji: boolean;
  /** 지살 성립 여부 (일지 기준) */
  jiSalByIlji: boolean;
  /** 년살 성립 여부 (년지 기준) */
  nyeonSalByNyeonji: boolean;
  /** 년살 성립 여부 (일지 기준) */
  nyeonSalByIlji: boolean;
  /** 월살 성립 여부 (년지 기준) */
  wolSalByNyeonji: boolean;
  /** 월살 성립 여부 (일지 기준) */
  wolSalByIlji: boolean;
  /** 혈인살 성립 지지 (없으면 null) */
  hyeolInSal: Jiji | null;
}

/**
 * 사주 전체 신살(神殺) 종합 분석
 *
 * @param ilgan   - 일간(日干)
 * @param nyeongan - 년간(年干)
 * @param wolgan  - 월간(月干)
 * @param sigan   - 시간(時干)
 * @param nyeonji - 년지(年支)
 * @param wolji   - 월지(月支)
 * @param ilji    - 일지(日支)
 * @param sinji   - 시지(時支)
 */
export function sinsalBunseok(
  ilgan: Cheongan,
  nyeonji: Jiji,
  wolji: Jiji,
  ilji: Jiji,
  sinji: Jiji,
  /** 사주 사천간(四天干) 목록 — 천덕·월덕·효신 등 천간 기반 신살 판별용.
   *  생략 시 [ilgan] 만으로 판별한다. */
  allGan?: Cheongan[],
): SinsalBunseokResult {
  const allJiji: Jiji[] = [nyeonji, wolji, ilji, sinji];
  const ganList: Cheongan[] = allGan ?? [ilgan];

  // 원진살·귀문관살 — 지지 쌍 조합
  const wonJinSal: Array<[Jiji, Jiji]> = [];
  const gwimunGwanSal: Array<[Jiji, Jiji]> = [];
  for (let i = 0; i < allJiji.length; i++) {
    for (let j = i + 1; j < allJiji.length; j++) {
      if (wonJinSalCheck(allJiji[i]!, allJiji[j]!)) {
        wonJinSal.push([allJiji[i]!, allJiji[j]!]);
      }
      if (gwimunGwanSalCheck(allJiji[i]!, allJiji[j]!)) {
        gwimunGwanSal.push([allJiji[i]!, allJiji[j]!]);
      }
    }
  }

  return {
    // 길신
    cheonEulGwiin:        cheonEulGwiinCheck(ilgan, allJiji),
    cheonDeokGwiin:       cheonDeokGwiinCheck(wolji, ganList, allJiji),
    wolDeokGwiin:         wolDeokGwiinCheck(wolji, ganList),
    munChangGwiin:        munChangGwiinCheck(ilgan, allJiji),
    hakDangGwiin:         hakDangGwiinCheck(ilgan, allJiji),
    cheonGwanGwiin:       cheonGwanGwiinCheck(ilgan, allJiji),
    cheonUiSeong:         cheonUiSeongCheck(wolji, allJiji),
    cheonJuGwi:           cheonJuGwiCheck(ilgan, allJiji),
    geumYeoRok:           geumYeoRokCheck(ilgan, allJiji),
    cheonSa:              cheonSaCheck(wolji, ilgan, ilji),

    // 중립 / 길흉혼재
    yangIn:               yangInCheck(ilgan, allJiji),
    biIn:                 biInCheck(ilgan, allJiji),
    doHwaSalByNyeonji:    doHwaSalCheck(nyeonji, allJiji),
    doHwaSalByIlji:       doHwaSalCheck(ilji, allJiji),
    hongYeomSal:          hongYeomSalCheck(ilgan, allJiji),
    hamJiSalByNyeonji:    hamJiSalCheck(nyeonji, allJiji),
    hamJiSalByIlji:       hamJiSalCheck(ilji, allJiji),
    yeokMaSalByNyeonji:   yeokMaSalCheck(nyeonji, allJiji),
    yeokMaSalByIlji:      yeokMaSalCheck(ilji, allJiji),
    hwaGaeSalByNyeonji:   hwaGaeSalCheck(nyeonji, allJiji),
    hwaGaeSalByIlji:      hwaGaeSalCheck(ilji, allJiji),
    jangSeongSalByNyeonji: jangSeongSalCheck(nyeonji, allJiji),
    jangSeongSalByIlji:   jangSeongSalCheck(ilji, allJiji),
    banAnSalByNyeonji:    banAnSalCheck(nyeonji, allJiji),
    banAnSalByIlji:       banAnSalCheck(ilji, allJiji),
    goeGangSal:           goeGangSalCheck(ilgan, ilji),
    hyeonChimSal:         hyeonChimSalCheck(ilgan),

    // 흉살
    wonJinSal,
    gwimunGwanSal,
    cheonRaJiMang:        cheonRaJiMangCheck(allJiji),
    baekHoDaeSal:         baekHoDaeSalCheck(wolji, allJiji),
    goJinByNyeonji:       goJinCheck(nyeonji, allJiji),
    gwaSukByNyeonji:      gwaSukCheck(nyeonji, allJiji),
    hyoSinSal:            hyoSinSalCheck(ilgan, ganList),
    geopSalByNyeonji:     geopSalCheck(nyeonji, allJiji),
    geopSalByIlji:        geopSalCheck(ilji, allJiji),
    jaeSalByNyeonji:      jaeSalCheck(nyeonji, allJiji),
    jaeSalByIlji:         jaeSalCheck(ilji, allJiji),
    cheonSalByNyeonji:    cheonSalCheck(nyeonji, allJiji),
    cheonSalByIlji:       cheonSalCheck(ilji, allJiji),
    jiSalByNyeonji:       jiSalCheck(nyeonji, allJiji),
    jiSalByIlji:          jiSalCheck(ilji, allJiji),
    nyeonSalByNyeonji:    nyeonSalCheck(nyeonji, allJiji),
    nyeonSalByIlji:       nyeonSalCheck(ilji, allJiji),
    wolSalByNyeonji:      wolSalCheck(nyeonji, allJiji),
    wolSalByIlji:         wolSalCheck(ilji, allJiji),
    hyeolInSal:           hyeolInSalCheck(ilgan, allJiji),
  };
}
