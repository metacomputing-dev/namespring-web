/**
 * 조후용신론(調候用神論) — 궁통보감(穷通宝鉴) 기반 월별 조후용신 완전 테이블
 *
 * 조후용신(調候用神)이란 사주 일간(日干)의 기운이 태어난 계절의 기후와 조화를 이루도록
 * 사주에서 필요한 오행·천간을 말한다.
 *
 * 한난조습(寒暖燥濕): 춥거나(寒) 더운(暖) 기후, 건조(燥)하거나 습한(濕) 환경을
 * 조절하는 것이 조후용신의 핵심이다.
 *
 * 출전: 궁통보감(穷通宝鉴), 자평진전(子平眞詮) 논조후
 */

import type { StemIdx, BranchIdx } from '../core/cycle.js';

// ---------------------------------------------------------------------------
// 조후 이론 상수
// ---------------------------------------------------------------------------

/**
 * 조후 이론 설명
 */
export const JOHU_CLIMATE_THEORY = {
  definition:
    '조후(調候)란 사주의 기후(寒暖燥濕)를 조절하여 일간이 최적의 환경에서 ' +
    '기능할 수 있도록 하는 것이다. 궁통보감의 핵심 이론.',
  principle:
    '동절(冬節)에 태어나면 화(火)로 따뜻하게, 하절(夏節)에 태어나면 수(水)로 식히는 것이 기본 원칙. ' +
    '춘절(春節)·추절(秋節)은 기후가 온화하므로 조후보다 억부(抑扶)를 우선한다.',
  priority:
    '조후용신은 억부용신과 함께 사용한다. ' +
    '기후가 극단적일 때(한동·염하)는 조후를 우선하고, ' +
    '기후가 온화할 때(춘추)는 억부를 우선한다.',
} as const;

// ---------------------------------------------------------------------------
// 조후용신 항목 인터페이스
// ---------------------------------------------------------------------------

/**
 * 조후용신 항목
 */
export interface JohuEntry {
  /** 일간(日干) 로마자 */
  stem: string;
  /** 생월 지지 로마자 */
  month: string;
  /** 음력 월 번호 (1=寅월 ~ 12=丑월) */
  monthNum: number;
  /** 계절 */
  season: string;
  /** 제1 용신 — 가장 중요한 천간 */
  primary: string;
  /** 제2 용신 (보조) */
  secondary: string;
  /** 조후 원칙 설명 */
  note: string;
}

// ---------------------------------------------------------------------------
// 천간·지지 이름 상수
// ---------------------------------------------------------------------------

const S = { GAP: 'GAP', EUL: 'EUL', BYEONG: 'BYEONG', JEONG: 'JEONG', MU: 'MU',
            GI: 'GI', GYEONG: 'GYEONG', SIN: 'SIN', IM: 'IM', GYE: 'GYE' } as const;
const B = { IN: 'IN', MYO: 'MYO', JIN: 'JIN', SA: 'SA', O: 'O', MI: 'MI',
            SHIN: 'SHIN', YU: 'YU', SUL: 'SUL', HAE: 'HAE', JA: 'JA', CHUK: 'CHUK' } as const;

// ---------------------------------------------------------------------------
// 120개 조후용신 테이블
// ---------------------------------------------------------------------------

/**
 * 조후용신 완전 테이블 — 궁통보감(穷通宝鉴) 기반
 *
 * 10천간 × 12월 = 120개 조합의 조후용신을 수록한다.
 * 월 순서: 寅(1월)→卯(2월)→辰(3월)→巳(4월)→午(5월)→未(6월)→
 *          申(7월)→酉(8월)→戌(9월)→亥(10월)→子(11월)→丑(12월)
 */
export const JOHU_YONGSIN_TABLE: JohuEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 甲木(GAP) 일간
  // 궁통보감: 甲木은 양목(陽木), 큰 나무(棟樑之木). 봄에 庚金 가지치기와 丙火 양광이 핵심.
  // 여름에는 癸水 관개가 급선무. 겨울에는 丁火 온기와 庚金 도끼가 필요.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.GAP, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.BYEONG, secondary: S.GYE,    note: '초봄(寅月) 아직 한기가 남아 丙火 양광으로 따뜻하게 해야 甲木이 소생한다. 癸水 우수(雨水)로 뿌리에 자양 공급. 庚金은 3순위로 가지치기.' },
  { stem: S.GAP, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.GYEONG, secondary: S.BYEONG, note: '한봄(卯月) 목왕지절(木旺之節), 甲木이 건록(建祿)에 해당하여 기세가 왕성. 庚金 도끼로 가지치기(斫伐)하여 재목(棟樑)으로 만들어야 한다. 丙火로 양광 보조.' },
  { stem: S.GAP, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.GYEONG, secondary: S.IM,     note: '늦봄(辰月) 토왕용사(土旺用事), 목기(木氣)가 점차 쇠퇴. 庚金으로 재목 다듬기 우선. 壬水로 뿌리 자양하여 갑목의 활력 유지. 甲木이 辰土를 소토(疏土)하는 역할도 겸함.' },
  { stem: S.GAP, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.GYE,  secondary: S.GYEONG, note: '초여름(巳月) 화기(火氣) 강해져 甲木이 마르기 시작. 癸水 관개로 고갈 방지가 급선무. 庚金으로 수원(水源)을 만들어 癸水를 지속 공급.' },
  { stem: S.GAP, month: B.O,    monthNum: 5,  season: '한여름', primary: S.GYE,  secondary: S.GYEONG, note: '한여름(午月) 극열 조토(燥土), 甲木이 불에 탈 위험. 癸水 조후(調候)가 최우선 급무. 庚金으로 수원(水源) 확보. 丁火는 이미 과잉이므로 불필요.' },
  { stem: S.GAP, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.GYE,  secondary: S.GYEONG, note: '늦여름(未月) 조토(燥土)의 계절, 토기(土氣)가 강하고 건조. 癸水로 윤택(潤澤)하게 해야 甲木이 살아남는다. 庚金으로 수원 보조.' },
  { stem: S.GAP, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.JEONG, secondary: S.GYEONG, note: '초가을(申月) 금기(金氣) 강해져 甲木을 극(剋)한다. 丁火로 庚金을 제련(制金)해야 한다. 庚金이 사주에 있어야 丁火가 단련하여 甲木을 재목으로 만든다.' },
  { stem: S.GAP, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.JEONG, secondary: S.GYEONG, note: '한가을(酉月) 금왕지절(金旺之節), 甲木 극금(剋金) 심하다. 丁火로 금기(金氣)를 제어(制金)하는 것이 급선무. 庚金은 재목 다듬기에 쓰이나 丁火가 우선.' },
  { stem: S.GAP, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.GYEONG, secondary: S.GAP,   note: '늦가을(戌月) 토왕(土旺) 건조. 庚金으로 甲木을 다듬어 재목으로 완성. 甲木 비겁(比肩)으로 토를 소토(疏土)하여 뿌리가 뻗도록 돕는다. 壬水 3순위로 윤택.' },
  { stem: S.GAP, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.GYEONG, secondary: S.JEONG, note: '초겨울(亥月) 수왕지절(水旺之節), 甲木 장생(長生)에 해당. 庚金으로 재목 다듬기 우선. 丁火로 한기(寒氣) 제거 보조. 壬水는 이미 과잉이므로 불필요.' },
  { stem: S.GAP, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.JEONG, secondary: S.GYEONG, note: '한겨울(子月) 극한(極寒), 甲木이 얼어붙는다. 丁火(등불/화덕) 온기로 해동이 급선무. 庚金으로 재목 다듬기 보조. 丙火가 아닌 丁火를 쓰는 이유는 甲木이 丁의 어머니(母)로서 생조 관계가 밀접하기 때문.' },
  { stem: S.GAP, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.JEONG, secondary: S.GYEONG, note: '늦겨울(丑月) 한습(寒濕), 토중에 얼어 있는 甲木을 녹여야 한다. 丁火 온기가 최우선. 庚金으로 재목 다듬기 보조. 丙火는 3순위로 보조 난방.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 乙木(EUL) 일간
  // 궁통보감: 乙木은 음목(陰木), 화초·덩굴(藤蘿之木). 丙火 양광과 癸水 우로(雨露)가 기본.
  // 甲木(큰나무)과 달리 庚金 도끼가 필요 없고, 오히려 상한다. 丙火를 가장 중시.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.EUL, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.BYEONG, secondary: S.GYE,    note: '초봄(寅月) 아직 한기가 남아 丙火 양광으로 따뜻하게 해야 乙木 화초가 소생. 癸水 우로(雨露)로 자양. 乙木은 음목이라 庚金 도끼는 불필요.' },
  { stem: S.EUL, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.BYEONG, secondary: S.GYE,    note: '한봄(卯月) 건록(建祿)에 해당, 乙木 기세 왕성. 丙火 양광으로 영화(榮華)를 펼침. 癸水 우로로 뿌리 자양 보조.' },
  { stem: S.EUL, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.GYE,    secondary: S.BYEONG, note: '늦봄(辰月) 토왕(土旺) 시기, 乙木의 뿌리가 토에 묻힘. 癸水로 자양하여 활력 유지가 우선. 丙火로 양광 보조.' },
  { stem: S.EUL, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.GYE,  secondary: S.BYEONG, note: '초여름(巳月) 화기 강해져 乙木 화초가 시들기 시작. 癸水 관개가 급선무. 丙火는 이미 충분하나 구름 뒤 햇살처럼 보조.' },
  { stem: S.EUL, month: B.O,    monthNum: 5,  season: '한여름', primary: S.GYE,  secondary: S.BYEONG, note: '한여름(午月) 극열, 乙木 화초가 마를 위험. 癸水 조후가 최우선 급무. 丙火 보조. 壬水 큰물은 화초를 떠내려 보내므로 癸水(이슬비)가 적합.' },
  { stem: S.EUL, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.GYE,  secondary: S.BYEONG, note: '늦여름(未月) 조토(燥土) 건조한 흙에 乙木 뿌리가 마름. 癸水로 윤택하게 적셔야 함. 丙火 보조.' },
  { stem: S.EUL, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.BYEONG, secondary: S.GYE,  note: '초가을(申月) 금기 강해져 乙木을 극(剋). 丙火로 금기를 제어(火剋金)하여 乙木을 보호. 癸水로 뿌리 자양 보조.' },
  { stem: S.EUL, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.BYEONG, secondary: S.GYE,  note: '한가을(酉月) 금왕지절, 乙木 극금(剋金)이 심하다. 丙火로 금기를 제련·제어하는 것이 급선무. 癸水 자양 보조. 乙庚합(合)이 있으면 화기가 더욱 필요.' },
  { stem: S.EUL, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.GYE,  secondary: S.BYEONG, note: '늦가을(戌月) 토왕(土旺) 건조. 癸水로 토를 윤택하게 적셔 乙木의 뿌리를 보호. 丙火로 양광 보조.' },
  { stem: S.EUL, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.BYEONG, secondary: S.GYE,  note: '초겨울(亥月) 수왕지절, 한기(寒氣) 침투. 丙火 양광으로 따뜻하게 해야 乙木 화초가 살아남는다. 癸水는 이미 충분하나 보조로 뿌리 자양.' },
  { stem: S.EUL, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.BYEONG, secondary: S.GYE,  note: '한겨울(子月) 극한, 乙木이 얼어붙는다. 丙火 조후가 최우선 급무. 癸水는 과잉이나 뿌리 자양 목적으로 보조. 戊土는 필요시 제수(制水) 3순위.' },
  { stem: S.EUL, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.BYEONG, secondary: S.GYE,  note: '늦겨울(丑月) 한습(寒濕), 토 속에 묻힌 乙木을 丙火 양광으로 해동. 癸水 자양 보조. 겨울 乙木은 丙火가 생명선.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 丙火(BYEONG) 일간
  // 궁통보감: 丙火는 양화(陽火), 태양지화(太陽之火). 사계절 壬水가 제1용신.
  // "丙火용壬수" — 태양이 호수에 비치는 형상이 가장 아름답다(湖海映日).
  // 겨울에는 甲木 생조가 필수, 戊土로 壬水 과잉을 제어.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.BYEONG, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.IM,    secondary: S.GYEONG, note: '초봄(寅月) 목생화(木生火)로 丙火 기세가 점점 강해진다. 壬水로 제어하여 호수에 태양이 비치는 형상(湖海映日). 庚金으로 壬水 수원 확보.' },
  { stem: S.BYEONG, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.IM,    secondary: S.GI,     note: '한봄(卯月) 목왕생화(木旺生火), 丙火가 더욱 강해짐. 壬水 제어 필수. 己土로 壬水가 넘치지 않도록 조절(堤防).' },
  { stem: S.BYEONG, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.IM,    secondary: S.GAP,    note: '늦봄(辰月) 토왕용사, 丙火가 토에 설기(洩氣). 壬水로 제어. 甲木으로 소토(疏土)하여 丙火에 목생화 공급.' },
  { stem: S.BYEONG, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.IM,  secondary: S.GYEONG, note: '초여름(巳月) 화왕(火旺), 丙火가 건록(建祿)에 해당. 壬水 조후가 최우선 급무. 庚金으로 수원 확보. 癸水 소량은 태양을 가리지 못한다.' },
  { stem: S.BYEONG, month: B.O,    monthNum: 5,  season: '한여름', primary: S.IM,  secondary: S.GYEONG, note: '한여름(午月) 양인(羊刃), 丙火 극열. 壬水 조후가 절대 필수. 庚金 수원 확보. 壬水 없으면 하격(下格).' },
  { stem: S.BYEONG, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.IM,  secondary: S.GYEONG, note: '늦여름(未月) 화토(火土) 조열. 壬水 조후 필수. 庚金 수원 보조. 토다매화(土多埋火) 주의하여 甲木 3순위.' },
  { stem: S.BYEONG, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.IM,  secondary: S.GAP,    note: '초가을(申月) 금기(金氣) 강해져 丙火 설기. 壬水로 호해영일(湖海映日) 형상 유지. 甲木으로 목생화(木生火) 보조하여 丙火 기력 회복.' },
  { stem: S.BYEONG, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.IM,  secondary: S.GAP,    note: '한가을(酉月) 금왕(金旺) 설기 심함. 壬水 여전히 필수(호해영일). 甲木 생조 보조. 戊土는 3순위로 壬水 과잉 제어.' },
  { stem: S.BYEONG, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.GAP, secondary: S.IM,     note: '늦가을(戌月) 토왕(土旺) 건조, 토다매화(土多埋火) 위험. 甲木으로 소토(疏土)하여 丙火 구출이 급선무. 壬水로 호해영일 보조.' },
  { stem: S.BYEONG, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.GAP, secondary: S.MU,     note: '초겨울(亥月) 수왕지절, 丙火가 극도로 약해짐. 甲木 생조(木生火)가 최우선. 戊土로 壬水 범람을 제어(堤防). 壬水는 이미 과잉.' },
  { stem: S.BYEONG, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.GAP, secondary: S.MU,     note: '한겨울(子月) 극한 수왕, 丙火 태양이 가장 약한 시기. 甲木 생조 필수. 戊土로 壬水 과잉 제어. 壬水 추가 불필요.' },
  { stem: S.BYEONG, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.GAP, secondary: S.MU,     note: '늦겨울(丑月) 한습(寒濕), 축중기토(丑中己土)가 丙火를 매몰. 甲木 생조 필수. 戊土로 수기(水氣) 제어 보조.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 丁火(JEONG) 일간
  // 궁통보감: 丁火는 음화(陰火), 등불·촛불(燈燭之火). 甲木이 제1용신(장작).
  // "丁火용甲木" — 등불은 장작(甲木)이 있어야 오래 탄다. 庚金으로 甲木을 잘라(劈甲引丁) 불 붙인다.
  // 여름에는 壬水 조후가 급선무.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.JEONG, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.GAP,   secondary: S.GYEONG, note: '초봄(寅月) 丁火가 장생(長生)에 해당. 甲木 장작으로 생조(生助)하면 등불이 밝게 탄다. 庚金으로 벽갑인정(劈甲引丁) — 甲木을 쪼개어 불을 당긴다.' },
  { stem: S.JEONG, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.GAP,   secondary: S.GYEONG, note: '한봄(卯月) 목왕지절, 甲木 풍부. 甲木 생조로 丁火가 왕성해진다. 庚金으로 벽갑인정 보조. 乙木(잔가지)은 丁火에 적합하지 않음.' },
  { stem: S.JEONG, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.GAP,   secondary: S.GYEONG, note: '늦봄(辰月) 토왕용사, 丁火가 토에 설기. 甲木 생조가 필수. 庚金으로 벽갑인정하여 화기 유지.' },
  { stem: S.JEONG, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.GAP, secondary: S.IM,     note: '초여름(巳月) 화왕, 丁火가 건록(建祿). 甲木 생조로 지속 연소. 壬水 조후로 과열 방지. 壬水가 甲木과 함께 있으면 목생화·수제화 균형.' },
  { stem: S.JEONG, month: B.O,    monthNum: 5,  season: '한여름', primary: S.GAP, secondary: S.IM,     note: '한여름(午月) 양인(羊刃) 극열. 甲木 생조 여전히 필수(등불은 장작 없으면 꺼짐). 壬水 조후로 과열 제어. 庚金은 3순위.' },
  { stem: S.JEONG, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.GAP, secondary: S.IM,     note: '늦여름(未月) 화토 조열, 토다(土多)로 丁火 설기. 甲木 생조 급선무. 壬水 조후 보조. 토왕 환경에서 목극토(木剋土)로 균형.' },
  { stem: S.JEONG, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.GAP, secondary: S.GYEONG, note: '초가을(申月) 금기 강해져 甲木 피극. 甲木 생조가 필수. 庚金으로 벽갑인정하되, 甲木이 금극(金剋)당하지 않도록 유의. 丙火 3순위 보조.' },
  { stem: S.JEONG, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.GAP, secondary: S.GYEONG, note: '한가을(酉月) 금왕지절, 甲木이 극금당해 구하기 어려움. 甲木 확보가 최우선 급무. 庚金으로 벽갑인정. 丙火 보조로 금기 제어.' },
  { stem: S.JEONG, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.GAP, secondary: S.GYEONG, note: '늦가을(戌月) 토왕 건조. 甲木으로 생조하고 소토(疏土). 庚金으로 벽갑인정 보조.' },
  { stem: S.JEONG, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.GAP, secondary: S.GYEONG, note: '초겨울(亥月) 수왕지절, 丁火가 극도로 약함. 甲木 생조가 절대 필수 — 장작 없는 등불은 꺼진다. 庚金으로 벽갑인정.' },
  { stem: S.JEONG, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.GAP, secondary: S.GYEONG, note: '한겨울(子月) 극한 수왕, 丁火가 가장 약한 시기. 甲木 생조가 생사(生死)를 결정. 庚金으로 벽갑인정하여 화기 유지. 丙火 보조 3순위.' },
  { stem: S.JEONG, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.GAP, secondary: S.GYEONG, note: '늦겨울(丑月) 한습(寒濕), 축중수기(丑中水氣)가 丁火를 위협. 甲木 생조 필수. 庚金으로 벽갑인정. 丙火 보조로 한기 제거.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 戊土(MU) 일간
  // 궁통보감: 戊土는 양토(陽土), 산악·제방지토(城墻之土). 甲木 소토(疏土)가 핵심.
  // 봄에는 丙火 생조, 여름에는 壬水(癸水) 조후, 겨울에는 丙火 조후.
  // 사계절 甲木으로 소토하여 토가 뭉치지 않게 하는 것이 중요.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.MU, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.BYEONG, secondary: S.GAP,    note: '초봄(寅月) 목왕극토(木旺剋土), 戊土가 약함. 丙火로 화생토(火生土) 생조가 급선무. 甲木으로 소토(疏土)하여 토가 비옥해짐. 癸水 3순위.' },
  { stem: S.MU, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.BYEONG, secondary: S.GAP,    note: '한봄(卯月) 목왕극토 극심. 丙火 생조로 戊土 기력 회복. 甲木 소토로 토 경작. 봄 戊土는 화(火)가 없으면 무력.' },
  { stem: S.MU, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.BYEONG, secondary: S.GAP,    note: '늦봄(辰月) 토왕용사, 戊土 비겁(比肩) 강해짐. 丙火로 생조 유지. 甲木으로 소토하여 토다(土多) 방지. 癸水 3순위 윤토.' },
  { stem: S.MU, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.IM,   secondary: S.GAP,    note: '초여름(巳月) 화왕생토, 戊土 강해지나 조열(燥熱). 壬水 조후로 토를 적셔야 만물 생장. 甲木 소토 보조.' },
  { stem: S.MU, month: B.O,    monthNum: 5,  season: '한여름', primary: S.IM,   secondary: S.GAP,    note: '한여름(午月) 극열 조토, 화다토조(火多土燥). 壬水 조후가 최우선 급무. 甲木 소토 보조. 壬水 없으면 마른 사막.' },
  { stem: S.MU, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.GYE,  secondary: S.BYEONG, note: '늦여름(未月) 조토(燥土) 극심. 癸水로 윤토(潤土)하여 비옥하게 만드는 것이 급선무. 丙火 보조. 壬水 큰물보다 癸水 이슬비가 적합.' },
  { stem: S.MU, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.BYEONG, secondary: S.GYE,  note: '초가을(申月) 금기 강해 토생금(土生金)으로 戊土 설기. 丙火로 생조하여 기력 회복. 癸水로 윤택 보조.' },
  { stem: S.MU, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.BYEONG, secondary: S.GYE,  note: '한가을(酉月) 금왕 설기 심함. 丙火 생조 필수. 癸水 윤토 보조. 甲木 3순위 소토.' },
  { stem: S.MU, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.GAP,  secondary: S.IM,     note: '늦가을(戌月) 토왕(土旺) 건조, 戊土 비겁 과다. 甲木 소토가 최우선 — 토가 뭉치면 불모지. 壬水로 윤토 보조. 丙火는 불필요.' },
  { stem: S.MU, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.GAP,  secondary: S.BYEONG, note: '초겨울(亥月) 수왕지절, 수다토류(水多土流) 위험. 甲木 소토로 토를 견고하게 유지. 丙火 조후로 한기 제거 보조.' },
  { stem: S.MU, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.BYEONG, secondary: S.GAP,  note: '한겨울(子月) 극한 수왕, 戊土가 얼어붙음. 丙火 조후가 최우선 급무 — 토를 녹여야 한다. 甲木 소토 보조.' },
  { stem: S.MU, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.BYEONG, secondary: S.GAP,  note: '늦겨울(丑月) 한습(寒濕), 축토(丑土) 습토와 합하여 무거움. 丙火 조후 필수. 甲木 소토 보조. 겨울 토는 丙火가 생명선.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 己土(GI) 일간
  // 궁통보감: 己土는 음토(陰土), 전원·밭토(田園之土). 丙火 양광과 癸水 우로가 핵심.
  // 己土는 부드러운 흙이므로 甲木 대신 癸水(우수)로 윤택하게 하고 丙火로 따뜻하게.
  // "己土용丙癸" — 양광(丙)과 우로(癸)가 있어야 밭에 곡식이 자란다.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.GI, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.BYEONG, secondary: S.GYE,    note: '초봄(寅月) 목왕극토, 己土가 약함. 丙火 양광으로 화생토(火生土) 생조. 癸水 우로로 밭토 윤택. 양광+우로=곡식 소생.' },
  { stem: S.GI, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.BYEONG, secondary: S.GYE,    note: '한봄(卯月) 목극토 극심, 己土 기력 쇠약. 丙火 생조가 급선무. 癸水 우로로 윤택 보조. 甲木은 己土를 합(合)하여 오히려 도움이 될 수 있다.' },
  { stem: S.GI, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.BYEONG, secondary: S.GYE,    note: '늦봄(辰月) 토왕용사, 己土 기세 회복. 丙火 생조로 활력 유지. 癸水 윤토 보조. 甲木 3순위 소토.' },
  { stem: S.GI, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.GYE,  secondary: S.BYEONG, note: '초여름(巳月) 화왕, 화다토조(火多土燥). 癸水 우로로 조후(調候)가 급선무 — 밭이 마르면 곡식 죽는다. 丙火는 이미 충분.' },
  { stem: S.GI, month: B.O,    monthNum: 5,  season: '한여름', primary: S.GYE,  secondary: S.BYEONG, note: '한여름(午月) 극열 조토, 己土가 바싹 마름. 癸水 조후가 절대 필수. 丙火 보조. 壬水 큰물은 밭토를 쓸어가므로 癸水(이슬비)가 적합.' },
  { stem: S.GI, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.GYE,  secondary: S.BYEONG, note: '늦여름(未月) 조토 건조 극심. 癸水로 윤토가 최우선. 丙火 보조. 己未는 비견(比肩)으로 토가 뭉침 — 수기(水氣) 필수.' },
  { stem: S.GI, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.BYEONG, secondary: S.GYE,  note: '초가을(申月) 금기 강해 토생금(土生金) 설기. 丙火로 생조하여 기력 회복. 癸水 윤토 보조.' },
  { stem: S.GI, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.BYEONG, secondary: S.GYE,  note: '한가을(酉月) 금왕 설기 심함. 丙火 생조 필수. 癸水 윤토 보조. 가을 己土는 수확의 계절이나 火없으면 기력 쇠약.' },
  { stem: S.GI, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.GAP,  secondary: S.BYEONG, note: '늦가을(戌月) 토왕(土旺) 건조, 토다(土多). 甲木으로 소토(疏土)하여 밭을 경작. 丙火 보조. 癸水 3순위 윤토.' },
  { stem: S.GI, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.BYEONG, secondary: S.GAP,  note: '초겨울(亥月) 수왕지절, 己土가 물에 잠김. 丙火 조후로 한기 제거. 甲木은 소토 보조. 壬水 과잉이므로 추가 수기 불필요.' },
  { stem: S.GI, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.BYEONG, secondary: S.GAP,  note: '한겨울(子月) 극한, 己土가 얼어붙은 밭. 丙火 조후가 최우선 급무. 甲木 보조로 소토. 겨울 己土는 丙火가 생명선.' },
  { stem: S.GI, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.BYEONG, secondary: S.GAP,  note: '늦겨울(丑月) 한습(寒濕), 축중습토(丑中濕土)와 합쳐 己土 무거움. 丙火 조후 필수. 甲木 소토 보조.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 庚金(GYEONG) 일간
  // 궁통보감: 庚金은 양금(陽金), 도끼·검(斧鉞之金). 丁火 제련이 핵심.
  // "庚金용丁甲" — 丁火(용광로)로 단련하고 甲木(장작)으로 화력 유지.
  // 여름에는 壬水 조후가 급선무. 봄·가을에는 丁火 단련이 우선.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.GYEONG, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.BYEONG, secondary: S.JEONG, note: '초봄(寅月) 목왕극금, 庚金이 약함. 丙火로 한기 제거(조후)하면서 화생토·토생금으로 간접 생조. 丁火 단련은 금이 약할 때는 부적합하므로 보조.' },
  { stem: S.GYEONG, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.JEONG, secondary: S.GAP,    note: '한봄(卯月) 목왕, 庚金 기세가 회복되기 시작. 丁火로 단련(鍛鍊)하여 보검(寶劍)으로 만든다. 甲木 장작으로 丁火 화력 유지.' },
  { stem: S.GYEONG, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.JEONG, secondary: S.GAP,    note: '늦봄(辰月) 토왕생금, 庚金 기세 회복. 丁火로 단련이 우선. 甲木으로 벽갑인정(劈甲引丁)하여 화력 보조. 壬水 3순위 세금(洗金).' },
  { stem: S.GYEONG, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.IM,  secondary: S.JEONG,  note: '초여름(巳月) 화왕, 庚金이 녹을 위험(金見火多則鎔). 壬水 조후로 과열 방지가 급선무. 丁火 단련은 보조적으로 적용.' },
  { stem: S.GYEONG, month: B.O,    monthNum: 5,  season: '한여름', primary: S.IM,  secondary: S.GYE,    note: '한여름(午月) 극열, 庚金이 녹는 위기. 壬水 조후가 절대 필수. 癸水 보조. 丁火 단련은 이 시기에 불필요(이미 火 과잉).' },
  { stem: S.GYEONG, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.JEONG, secondary: S.GAP,  note: '늦여름(未月) 토왕, 토다매금(土多埋金) 주의. 丁火로 단련하되 甲木 장작으로 화력 유지. 壬水 3순위 세금.' },
  { stem: S.GYEONG, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.JEONG, secondary: S.GAP,  note: '초가을(申月) 금왕지절, 庚金 건록(建祿). 丁火 단련이 최우선 — 원석(原石)을 보검으로 만드는 시기. 甲木 장작으로 벽갑인정.' },
  { stem: S.GYEONG, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.JEONG, secondary: S.GAP,  note: '한가을(酉月) 금극왕, 庚金 기세 극도로 강함. 丁火 단련이 절대 필수 — 단련하지 않으면 폐금(廢金). 甲木 벽갑인정 보조.' },
  { stem: S.GYEONG, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.JEONG, secondary: S.GAP,  note: '늦가을(戌月) 토왕, 토다매금(土多埋金). 丁火로 단련하여 금을 빛나게 함. 甲木으로 소토(疏土)하여 금을 구출. 壬水 3순위.' },
  { stem: S.GYEONG, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.JEONG, secondary: S.BYEONG, note: '초겨울(亥月) 수왕지절, 수다금침(水多金沈). 丁火 단련으로 금을 빛나게. 丙火 조후로 한기 제거 보조. 甲木 3순위.' },
  { stem: S.GYEONG, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.JEONG, secondary: S.BYEONG, note: '한겨울(子月) 극한 수왕, 庚金이 차갑게 얼어붙음. 丁火 단련이 우선. 丙火 조후로 한기 제거 보조. 甲木은 벽갑인정 3순위.' },
  { stem: S.GYEONG, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.JEONG, secondary: S.BYEONG, note: '늦겨울(丑月) 한습(寒濕), 축중습토(丑中濕土)에 매몰. 丁火 단련 필수. 丙火 조후 보조. 겨울 庚金은 丁丙 두 火가 모두 필요.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 辛金(SIN) 일간
  // 궁통보감: 辛金은 음금(陰金), 보석·주옥(珠玉之金). 壬水 세금(洗金)이 핵심.
  // "辛金용壬水" — 보석은 물로 씻어야(洗金) 빛난다. 丁火 단련은 보석을 손상시킨다.
  // 겨울에는 丙火 조후가 급선무. 여름에는 壬水 세금+조후.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.SIN, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.BYEONG, secondary: S.IM,    note: '초봄(寅月) 목왕극금, 辛金이 약함. 丙火로 한기 제거(조후)하면서 간접 생조(火生土·土生金). 壬水 세금(洗金) 보조. 己土는 3순위 생금.' },
  { stem: S.SIN, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.IM,    secondary: S.GAP,    note: '한봄(卯月) 목왕, 辛金 기세 회복 시작. 壬水로 세금하여 보석을 빛나게. 甲木으로 소토 보조(토다매금 방지). 丁火 단련은 보석에 부적합.' },
  { stem: S.SIN, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.IM,    secondary: S.GAP,    note: '늦봄(辰月) 토왕용사, 토다매금(土多埋金) 위험. 壬水 세금으로 빛나게 함. 甲木으로 소토하여 금을 구출.' },
  { stem: S.SIN, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.IM,  secondary: S.GI,     note: '초여름(巳月) 화왕, 辛金이 녹을 위험. 壬水 세금+조후가 급선무. 己土로 생금 보조. 庚金 3순위 비겁 도움.' },
  { stem: S.SIN, month: B.O,    monthNum: 5,  season: '한여름', primary: S.IM,  secondary: S.GI,     note: '한여름(午月) 극열, 辛金 보석이 녹는 위기. 壬水 조후+세금이 절대 필수. 己土 생금 보조. 癸水는 3순위.' },
  { stem: S.SIN, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.IM,  secondary: S.GI,     note: '늦여름(未月) 토왕 조열, 토다매금. 壬水로 세금+윤토. 己土 생금 보조(과다하지 않을 때). 甲木 3순위 소토.' },
  { stem: S.SIN, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.IM,  secondary: S.GAP,    note: '초가을(申月) 금왕, 辛金 기세 강해짐. 壬水 세금이 최우선 — 보석은 씻어야 빛남. 甲木 보조로 설기(木氣 배출).' },
  { stem: S.SIN, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.IM,  secondary: S.GAP,    note: '한가을(酉月) 금극왕, 辛金 건록(建祿). 壬水 세금이 절대 필수 — 씻지 않은 보석은 돌멩이. 甲木 설기 보조.' },
  { stem: S.SIN, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.IM,  secondary: S.GAP,    note: '늦가을(戌月) 토왕 건조, 토다매금. 壬水로 세금+윤토. 甲木 소토로 금 구출 보조.' },
  { stem: S.SIN, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.BYEONG, secondary: S.IM,  note: '초겨울(亥月) 수왕지절, 수다금침(水多金沈). 丙火 조후로 한기 제거가 우선. 壬水는 이미 과잉이나 세금 목적으로 보조.' },
  { stem: S.SIN, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.BYEONG, secondary: S.IM,  note: '한겨울(子月) 극한 수왕, 辛金이 차갑게 얼어붙음. 丙火 조후가 최우선 급무. 壬水 세금 보조. 丙火+壬水가 있으면 수화기제(水火旣濟) 대길.' },
  { stem: S.SIN, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.BYEONG, secondary: S.IM,  note: '늦겨울(丑月) 한습(寒濕), 축중습토에 묻힌 辛金. 丙火 조후 필수. 壬水 세금 보조. 겨울 辛金은 丙火가 생명선.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 壬水(IM) 일간
  // 궁통보감: 壬水는 양수(陽水), 대해·강하지수(江河之水). 戊土 제방이 핵심.
  // "壬水용戊土" — 강물은 제방(戊土)이 있어야 범람하지 않는다. 庚金은 수원(水源).
  // 봄에는 목설기(木洩氣) 제어, 여름에는 庚金 수원, 겨울에는 丙火 조후.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.IM, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.MU,    secondary: S.BYEONG, note: '초봄(寅月) 목왕, 壬水가 목에 설기(木洩水). 戊土 제방(堤防)으로 수기를 가두어야 함. 丙火 조후로 봄 한기 제거 보조. 庚金 3순위 수원.' },
  { stem: S.IM, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.MU,    secondary: S.SIN,    note: '한봄(卯月) 목왕설기 극심, 壬水 기력 소모. 戊土 제방이 급선무. 辛金으로 생수(生水)하여 수원 보충. 丙火 3순위.' },
  { stem: S.IM, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.GAP,   secondary: S.GYEONG, note: '늦봄(辰月) 토왕용사, 토다(土多)로 壬水가 막힘. 甲木으로 소토(疏土)하여 수로(水路) 확보가 급선무. 庚金으로 수원 보조. 戊土는 이미 과잉.' },
  { stem: S.IM, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.GYEONG, secondary: S.IM,  note: '초여름(巳月) 화왕, 壬水 증발 위험. 庚金으로 수원(水源) 확보가 급선무(金生水). 壬水 비겁(比肩)으로 수세 보강 보조.' },
  { stem: S.IM, month: B.O,    monthNum: 5,  season: '한여름', primary: S.GYEONG, secondary: S.GYE,  note: '한여름(午月) 극열, 壬水가 말라가는 위기. 庚金 수원 확보가 절대 필수. 癸水 비겁 보조. 壬水는 큰 강이라 수원만 있으면 마르지 않는다.' },
  { stem: S.IM, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.GYEONG, secondary: S.SIN,  note: '늦여름(未月) 토왕 조열, 토다수갈(土多水渴). 庚金 수원 확보 우선. 辛金 생수 보조. 甲木 3순위 소토.' },
  { stem: S.IM, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.MU,   secondary: S.JEONG,  note: '초가을(申月) 금생수(金生水), 壬水 장생(長生). 수세가 강해지므로 戊土 제방이 급선무. 丁火 보조로 금기 제어.' },
  { stem: S.IM, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.GAP,  secondary: S.MU,     note: '한가을(酉月) 금왕생수, 壬水 넘침. 甲木으로 설기(洩氣)하여 수세 분산. 戊土 제방 보조. 丙火 3순위.' },
  { stem: S.IM, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.GAP,  secondary: S.BYEONG, note: '늦가을(戌月) 토왕, 토다제수(土多制水) 과잉. 甲木으로 소토하여 수로 확보. 丙火 보조로 한기 제거 시작.' },
  { stem: S.IM, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.MU,   secondary: S.BYEONG, note: '초겨울(亥月) 수왕지절, 壬水 건록(建祿) 기세 극강. 戊土 제방이 최우선 급무 — 범람 방지. 丙火 조후로 한기 제거 보조.' },
  { stem: S.IM, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.MU,   secondary: S.BYEONG, note: '한겨울(子月) 극한 수왕, 양인(羊刃) 壬水 기세 폭발. 戊土 제방이 절대 필수. 丙火 조후로 한기 제거. 甲木 3순위.' },
  { stem: S.IM, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.BYEONG, secondary: S.MU,   note: '늦겨울(丑月) 한습(寒濕), 壬水가 얼어붙음. 丙火 조후로 해동이 급선무. 戊土 제방 보조. 겨울 끝 壬水는 丙火가 핵심.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // 癸水(GYE) 일간
  // 궁통보감: 癸水는 음수(陰水), 우로·이슬(雨露之水). 辛金 생수가 핵심.
  // "癸水용辛金" — 이슬물은 보석(辛金)에서 맺히는 것이 자연의 이치.
  // 봄에는 辛金 수원, 여름에는 辛金+庚金 수원, 가을에는 丁火 설기, 겨울에는 丙火 조후.
  // ═══════════════════════════════════════════════════════════════════════════
  { stem: S.GYE, month: B.IN,   monthNum: 1,  season: '초봄', primary: S.SIN,   secondary: S.BYEONG, note: '초봄(寅月) 목왕설기(木洩水), 癸水 소모. 辛金으로 생수(金生水)하여 수원 보충. 丙火 조후로 봄 한기 제거 보조. 辛金이 癸水의 어머니(母).' },
  { stem: S.GYE, month: B.MYO,  monthNum: 2,  season: '한봄', primary: S.SIN,   secondary: S.BYEONG, note: '한봄(卯月) 목왕설기 극심, 癸水 고갈 위험. 辛金 생수가 급선무. 丙火 보조. 庚金보다 辛金이 癸水에 적합(음생음).' },
  { stem: S.GYE, month: B.JIN,  monthNum: 3,  season: '늦봄', primary: S.BYEONG, secondary: S.SIN,   note: '늦봄(辰月) 토왕용사, 토다수갈(土多水渴) 위험. 丙火로 조후(봄 끝 한기 제거). 辛金 생수 보조. 甲木 3순위 소토.' },
  { stem: S.GYE, month: B.SA,   monthNum: 4,  season: '초여름', primary: S.SIN,  secondary: S.GYEONG, note: '초여름(巳月) 화왕, 癸水 증발 위기. 辛金 생수가 급선무(陰金生陰水가 자연스러움). 庚金 보조 수원. 壬水 비겁 3순위.' },
  { stem: S.GYE, month: B.O,    monthNum: 5,  season: '한여름', primary: S.GYEONG, secondary: S.SIN, note: '한여름(午月) 극열, 癸水가 말라가는 위기. 庚金 대량 수원(金生水)이 필수 — 辛金만으로는 부족. 辛金 보조. 壬水 비겁 3순위.' },
  { stem: S.GYE, month: B.MI,   monthNum: 6,  season: '늦여름', primary: S.GYEONG, secondary: S.SIN, note: '늦여름(未月) 토왕 조열, 토다수갈. 庚金 대량 수원 확보 우선. 辛金 생수 보조. 甲木 3순위 소토.' },
  { stem: S.GYE, month: B.SHIN, monthNum: 7,  season: '초가을', primary: S.JEONG, secondary: S.GAP,  note: '초가을(申月) 금생수(金生水), 癸水 기세 회복. 금기(金氣) 과다하므로 丁火로 제금(制金)하여 균형. 甲木 장작으로 丁火 유지 보조.' },
  { stem: S.GYE, month: B.YU,   monthNum: 8,  season: '한가을', primary: S.JEONG, secondary: S.GAP,  note: '한가을(酉月) 금왕생수, 금기 극도로 강함. 丁火로 제금이 급선무. 甲木 벽갑인정(劈甲引丁) 보조. 辛金은 이미 과잉.' },
  { stem: S.GYE, month: B.SUL,  monthNum: 9,  season: '늦가을', primary: S.SIN,  secondary: S.GAP,   note: '늦가을(戌月) 토왕 건조, 토다수갈. 辛金 생수로 수원 확보 우선. 甲木 소토 보조. 丙火 3순위.' },
  { stem: S.GYE, month: B.HAE,  monthNum: 10, season: '초겨울', primary: S.BYEONG, secondary: S.SIN, note: '초겨울(亥月) 수왕지절, 癸水 기세 강하나 한기(寒氣) 심각. 丙火 조후로 한기 제거가 급선무. 辛金 보조. 겨울 癸水는 조후가 우선.' },
  { stem: S.GYE, month: B.JA,   monthNum: 11, season: '한겨울', primary: S.BYEONG, secondary: S.SIN, note: '한겨울(子月) 극한 수왕, 癸水가 얼어붙음. 丙火 조후가 절대 필수 — 이슬이 얼면 기능 상실. 辛金 보조. 丙辛합(合)이면 수화기제.' },
  { stem: S.GYE, month: B.CHUK, monthNum: 12, season: '늦겨울', primary: S.BYEONG, secondary: S.SIN, note: '늦겨울(丑月) 한습(寒濕), 축중습토에 癸水 매몰. 丙火 조후 필수 — 해동이 급선무. 辛金 보조 생수. 겨울 끝 癸水는 丙火가 생명선.' },
];

// ---------------------------------------------------------------------------
// 유틸리티 함수
// ---------------------------------------------------------------------------

/** 천간 인덱스 → 로마자 이름 맵 */
const STEM_NAMES = ['GAP','EUL','BYEONG','JEONG','MU','GI','GYEONG','SIN','IM','GYE'] as const;

/** 지지 인덱스 → 로마자 이름 맵 */
const BRANCH_NAMES = ['JA','CHUK','IN','MYO','JIN','SA','O','MI','SHIN','YU','SUL','HAE'] as const;

/** 월지 인덱스(0=子~11=亥) → 생월번호(1=寅~12=丑) */
function branchIdxToMonthNum(branchIdx: BranchIdx): number {
  // 寅=2→1, 卯=3→2, ..., 子=0→11, 丑=1→12
  return ((branchIdx - 2 + 12) % 12) + 1;
}

/**
 * 일간 인덱스와 월지 인덱스로 조후용신을 조회한다
 *
 * @param stemIdx - 일간(日干) 인덱스 (0=甲 ~ 9=癸)
 * @param monthBranchIdx - 월지(月支) 인덱스 (0=子 ~ 11=亥)
 * @returns 해당 조후용신 항목 (없으면 undefined)
 *
 * @example
 * getJohuYongsin(0, 2) // 甲木 寅월 → { primary: 'BYEONG', ... }
 */
export function getJohuYongsin(stemIdx: StemIdx, monthBranchIdx: BranchIdx): JohuEntry | undefined {
  const stemName = STEM_NAMES[stemIdx];
  const branchName = BRANCH_NAMES[monthBranchIdx];
  return JOHU_YONGSIN_TABLE.find(e => e.stem === stemName && e.month === branchName);
}
