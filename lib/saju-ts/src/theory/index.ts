/**
 * 사주명리학(四柱命理學) 이론 모듈
 *
 * 사주팔자 해석에 필요한 모든 이론적 기반 데이터와 유틸리티를 제공한다.
 */

// ---------------------------------------------------------------------------
// 기초 이론 (export * — 이 모듈들이 공통 타입의 PRIMARY 소유자)
// ---------------------------------------------------------------------------
export * from './eumyang.js';
export * from './ohhaeng.js';
export * from './cheongan.js';
export * from './jiji.js';

// ---------------------------------------------------------------------------
// 관계 이론
// ---------------------------------------------------------------------------
export * from './cheonganHap.js';

// jijihyeong.ts — BranchName, BRANCH_NAME_TO_IDX 는 jiji.ts 에서 이미 export
export {
  type HyeongType,
  type SamhyeongGroup,
  SAMHYEONG_GROUPS,
  type Ihyeong,
  IHYEONG_PAIRS,
  type Jahyeong,
  JAHYEONG_BRANCHES,
  HYEONG_PRINCIPLES,
  HYEONG_RESOLUTION,
  HYEONG_BY_POSITION,
  isHyeong,
  isJahyeong,
  getHyeongType,
  checkSamhyeong,
  getHyeongPartners,
} from './jijihyeong.js';

// jijipa.ts — BranchName 은 jiji.ts 에서 이미 export
export {
  type PaStrength,
  type JijiPa,
  YUKPA_PAIRS,
  PA_PRINCIPLES,
  PA_BY_POSITION,
  isPa,
  getPaPartner,
  getPaInfo,
  getPaStrength,
} from './jijipa.js';

// jijihae.ts — BranchName 은 jiji.ts 에서 이미 export
export {
  type HaeStrength,
  type JijiHae,
  YUKHAE_PAIRS,
  HAE_PRINCIPLES,
  HAE_BY_POSITION,
  isHae,
  getHaePartner,
  getHaeInfo,
  getHaeStrength,
} from './jijihae.js';

// jijanggan.ts — JijangganEntry 는 jiji.ts 에서 이미 export
export {
  type JijangganRole,
  type JijiJijangganData,
  JIJANGGAN_TABLE,
  WOLRYEONG_BUNNYA,
  TUCHUL_THEORY,
  BONGI_PRIORITY,
  TOONGGEUN_RULES,
  SAMU_BRANCHES,
  GAEGO_THEORY,
  JIJANGGAN_SIPSIN_THEORY,
  checkTuchul,
  findTuchulStems,
  getJijanggan,
  getBongi,
  getJunggi,
  getYeogi,
  getAllStems,
  hasRoot,
  rootStrength,
} from './jijanggan.js';

// ---------------------------------------------------------------------------
// 분석 이론
// ---------------------------------------------------------------------------
export * from './sipsin.js';

// sipiunseong.ts — YANG_SUN_EUM_YEOK 은 eumyang.ts 에서 이미 export
export {
  type LifeStage,
  SIPIUNSEONG_ORDER,
  type SipiunseongData,
  SIPIUNSEONG_TABLE,
  YANG_STEM_JANGSEAENG,
  YIN_STEM_JANGSEAENG,
  STEM_BRANCH_LIFESTAGE,
  SA_SAENGJI,
  SA_SAENGJI_NAMES,
  SA_WANGJI,
  SA_WANGJI_NAMES,
  SA_GOJI,
  SA_GOJI_NAMES,
  SA_GOJI_OHHAENG,
  SA_JEOLJI,
  SA_JEOLJI_NAMES,
  JIJI_WANGSWOE,
  ILJU_UNSEONG_GUIDE,
  DAEWUN_UNSEONG_GUIDE,
  STEM_LIFESTAGE_REFERENCE,
  isToongGeun,
  sipiunseongStrength,
  getLifeStage,
  getSipiunseongData,
  isSaSaengji,
  isSaWangji,
  isSaGoji,
  isSaJeolji,
  geonrokji,
  jewangji,
} from './sipiunseong.js';

export * from './gangnyak.js';

// wollyeong.ts — Sipsin 은 sipsin.ts 에서, TUCHUL_THEORY 는 jijanggan.ts 에서 이미 export
export {
  BRANCH,
  STEM,
  WOLRYEONG_DEFINITION,
  type JeolgiWollyeong,
  JEOLGI_WOLLYEONG,
  type Jeolgi24Entry,
  JEOLGI_24_TABLE,
  type SalyeongEntry,
  WOLRYEONG_SALYEONG,
  YONGSA_THEORY,
  BRANCH_BONGI_STEM,
  getSipsin,
  getWollyeongSipsin,
  WOLLYEONG_SIPSIN_TABLE,
  type WollyeongWangSoe,
  WANGSOE_THEORY,
  judgeWollyeongWangSoe,
  type JohuGihu,
  type WollyeongJohu,
  WOLLYEONG_JOHU_TABLE,
  GEOKGUK_THEORY,
  getCurrentSalyeong,
  getBongiSalyeong,
  getJeolgiInfo,
  getGeokgukName,
  getWollyeongAllSipsin,
  getTuchulEntries,
  determineGeokguk,
  getJeolOnly,
  getJunggiOnly,
  get24JeolgiByBranch,
  getWollyeongJohu,
  analyzeWollyeong,
} from './wollyeong.js';

export * from './gyeokguk.js';

// ---------------------------------------------------------------------------
// 용신 이론
// ---------------------------------------------------------------------------

// yongsin.ts — Ohhaeng 은 ohhaeng.ts 에서 이미 export
export {
  type Cheongan,
  type YongsinBangbeop,
  type YongsinYeokhal,
  type YongsinGaebyeom,
  YONGSIN_GAEBYEOM,
  type YongsinBangbeobData,
  YONGSIN_BANGBEOB_TABLE,
  type YongsinUseonSunwi,
  YONGSIN_USEON_SUNWI,
  JAPYEONGJINJEON_YONGSIN,
  type EukBuGyuchik,
  EUK_BU_SINGANG_GYUCHIK,
  EUK_BU_SINYAK_GYUCHIK,
  type JohuGyuchik,
  JOHU_GYEJEOL_GYUCHIK,
  type TonggwanGyuchik,
  TONGGWAN_GYUCHIK_TABLE,
  type ByeongYakGyuchik,
  BYEONG_YAK_TABLE,
  BYEONG_YAK_DEUNGGUB,
  type JeonwangGyuchik,
  JEONWANG_GYUCHIK_TABLE,
  type YuksinGwangyeEntry,
  YUKSIN_GWANGYE_TABLE,
  type IlganYongsinEntry,
  ILGAN_YONGSIN_TABLE,
  type UnseYongsinHwalyong,
  UNSE_YONGSIN_HWALYONG,
  cheonganToOhhaeng,
  getYuksinGwangye,
  getTonggwanOhhaeng,
  getYakOhhaeng,
  getEukbuYongsinHubo,
  getIlganYongsinInfo,
  getJohuGeubYongsin,
  judgeUnseGilhyung,
  getJeonwangGyuchik,
  chucheonYongsinBeop,
  YONGSIN_JONGHAP_HAESOL,
} from './yongsin.js';

export * from './johuYongsin.js';

// ---------------------------------------------------------------------------
// 특수 이론
// ---------------------------------------------------------------------------

// sinsal.ts — Cheongan 은 yongsin.ts 에서 이미 export
export {
  type Jiji,
  type SinsalBunryu,
  type GilhyungDeunggup,
  type SinsalGyesan,
  type SinsalData,
  SINSAL_TABLE,
  CHEON_EUL_GWIIN_TABLE,
  MUN_CHANG_GWIIN_TABLE,
  HAK_DANG_GWIIN_TABLE,
  YANG_IN_TABLE,
  DO_HWA_SAL_TABLE,
  YEOK_MA_SAL_TABLE,
  HWA_GAE_SAL_TABLE,
  WON_JIN_SAL_SSANG,
  GWIMUN_GWAN_SAL_SSANG,
  CHEON_DEOK_GWIIN_TABLE,
  WOL_DEOK_GWIIN_TABLE,
  CHEON_GWAN_GWIIN_TABLE,
  BI_IN_TABLE,
  HONG_YEOM_SAL_TABLE,
  HAM_JI_SAL_TABLE,
  JANG_SEONG_SAL_TABLE,
  BAN_AN_SAL_TABLE,
  CHEON_RA_JI_MANG_SSANG,
  BAEK_HO_DAE_SAL_TABLE,
  GOE_GANG_SAL_ILJU,
  GO_JIN_TABLE,
  GWA_SUK_TABLE,
  CHEON_UI_SEONG_TABLE,
  CHEON_JU_GWI_TABLE,
  GEUM_YEO_ROK_TABLE,
  CHEON_SA_TABLE,
  HYO_SIN_SAL_TABLE,
  GEOP_SAL_TABLE,
  JAE_SAL_TABLE,
  CHEON_SAL_TABLE,
  JI_SAL_TABLE,
  NYEON_SAL_TABLE,
  WOL_SAL_TABLE,
  HYEOL_IN_SAL_TABLE,
  HYEON_CHIM_SAL_GAN,
  cheonEulGwiinCheck,
  munChangGwiinCheck,
  doHwaSalCheck,
  yeokMaSalCheck,
  wonJinSalCheck,
  gwimunGwanSalCheck,
  hakDangGwiinCheck,
  yangInCheck,
  hwaGaeSalCheck,
  cheonDeokGwiinCheck,
  wolDeokGwiinCheck,
  cheonGwanGwiinCheck,
  biInCheck,
  hongYeomSalCheck,
  hamJiSalCheck,
  jangSeongSalCheck,
  banAnSalCheck,
  cheonRaJiMangCheck,
  baekHoDaeSalCheck,
  goeGangSalCheck,
  goJinCheck,
  gwaSukCheck,
  cheonUiSeongCheck,
  cheonJuGwiCheck,
  geumYeoRokCheck,
  cheonSaCheck,
  hyoSinSalCheck,
  geopSalCheck,
  jaeSalCheck,
  cheonSalCheck,
  jiSalCheck,
  nyeonSalCheck,
  wolSalCheck,
  hyeolInSalCheck,
  hyeonChimSalCheck,
  type SinsalBunseokResult,
  sinsalBunseok,
} from './sinsal.js';

export * from './gongmang.js';
export * from './nabeumohhaeng.js';

// iljuron.ts — SAMHAP_GROUPS 는 jiji.ts 에서, GONGMANG_TABLE 은 gongmang.ts 에서 이미 export
export {
  type IljuData,
  SIPPI_UNSUNG_TABLE,
  SIPPI_UNSUNG_NAMES,
  getSippiUnsung,
  ILJU_TABLE,
  getIlju,
  getGongmangForIlju,
  SIPIUN_SUNG_LABELS,
  type TeuksuIljuCode,
  TEUKSU_ILJU_MAP,
  TEUKSU_ILJU_INFO,
} from './iljuron.js';

export * from './jeokcheonsu.js';

// ---------------------------------------------------------------------------
// 보조 이론
// ---------------------------------------------------------------------------
export * from './taeWyeon.js';
export * from './daewun.js';
