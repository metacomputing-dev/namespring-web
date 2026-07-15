/**
 * johooQiongTongBaoJianTable.ts — 궁통보감(窮通寶鑑) 조후용신표 120셀 (감사 B12).
 *
 * 기준 판본: 徐樂吾 評註 窮通寶鑑 계열 통용 조후용신표(조후용신 희용제요).
 * 저작 방식: 독립 이중 저작 + 대조(불일치 2셀 — 甲巳·甲午 보좌 순서만 — 을 희용제요
 * 원문 인용으로 확정). 판본 소차가 있는 셀은 note에 이설을 기록했다.
 * 참조 소스(교차 확인):
 *  - https://www.suanzhun.net/article/1555.html
 *  - https://blog.sina.com.cn/s/blog_67cfcf33010312qf.html
 *  - https://blog.sina.com.cn/s/blog_62b4d8cb010169v0.html
 *  - https://k.sina.cn/article_6579676247_1882de45700100drzu.html
 *  - https://www.kabsool.com/bbs/board.php?bo_table=basic&wr_id=83
 *  - https://m.cafe.daum.net/scholarlyname/8Duz/19
 *
 * 소비: johooTemplate.ts가 strategies.yongshin.johooTemplate.monthTable=
 *  'qiongTongBaoJian' 일 때 dayStem×monthBranch 셀을 조회한다 (qiongTongBaoJian
 *  프리셋이 이를 활성화). 기본 경로는 weights.johooTemplate=0 + enabled=false
 *  이중 가드로 무파급.
 */
import type { STEM_HANJA, BRANCH_HANJA } from '../../core/cycle.js';

export interface JohooMonthCell {
  /** 주용신 천간 한자 1자. */
  readonly primary: string;
  /** 보좌 천간 한자 0..4자 (원문 우선순위 순서). */
  readonly secondary: readonly string[];
  /** 출처/이설 메모 (설명용, 산출 미관여). */
  readonly note?: string;
}

export type StemHanja = (typeof STEM_HANJA)[number];
export type BranchHanja = (typeof BRANCH_HANJA)[number];

/** 사용자 오버라이드용 부분 테이블 형태 (config 표면). */
export type JohooMonthTable = Partial<Record<StemHanja, Partial<Record<BranchHanja, JohooMonthCell>>>>;

/** 120셀 완전 수록 — Record 타입이 셀 누락을 컴파일 에러로 만든다. */
export const QIONG_TONG_BAO_JIAN_TABLE: Record<StemHanja, Record<BranchHanja, JohooMonthCell>> = {
  '甲': {
    '寅': { primary: '丙', secondary: ['癸'] },
    '卯': { primary: '庚', secondary: ['丙', '丁', '戊', '己'], note: '판본에 따라 보좌를 丙丁 또는 戊己만 기재하는 이설 있음' },
    '辰': { primary: '庚', secondary: ['丁', '壬'] },
    '巳': { primary: '癸', secondary: ['庚', '丁'], note: '보좌 순서 확정 庚丁 — 喜用提要 원문 ’原局氣潤 庚丁為用’. 일부 전재본은 丁庚 순' },
    '午': { primary: '癸', secondary: ['庚', '丁'], note: '보좌 순서 확정 庚丁 — 원문 ’木盛先庚 庚盛先丁’, 제요 헤더 癸庚丁. 일부 전재본은 丁庚 순' },
    '未': { primary: '癸', secondary: ['庚', '丁'] },
    '申': { primary: '庚', secondary: ['丁', '壬'] },
    '酉': { primary: '庚', secondary: ['丁', '丙'] },
    '戌': { primary: '庚', secondary: ['甲', '丁', '壬', '癸'], note: '土旺用甲(比劫), 木旺用庚, 丁壬癸 酌用(원문)' },
    '亥': { primary: '庚', secondary: ['丁', '丙', '戊'] },
    '子': { primary: '丁', secondary: ['庚', '丙'] },
    '丑': { primary: '丁', secondary: ['庚', '丙'] },
  },
  '乙': {
    '寅': { primary: '丙', secondary: ['癸'] },
    '卯': { primary: '丙', secondary: ['癸'] },
    '辰': { primary: '癸', secondary: ['丙', '戊'] },
    '巳': { primary: '癸', secondary: [], note: '원문 ’專用癸水 調候爲急’. 한국(아베타이잔 계열) 표는 庚辛 보조 추가 이설' },
    '午': { primary: '癸', secondary: ['丙'] },
    '未': { primary: '癸', secondary: ['丙'] },
    '申': { primary: '丙', secondary: ['癸', '己'] },
    '酉': { primary: '癸', secondary: ['丙', '丁'], note: '상반월 癸先丙後, 하반월 丙先癸後(원문)' },
    '戌': { primary: '癸', secondary: ['辛'] },
    '亥': { primary: '丙', secondary: ['戊'] },
    '子': { primary: '丙', secondary: [] },
    '丑': { primary: '丙', secondary: [] },
  },
  '丙': {
    '寅': { primary: '壬', secondary: ['庚'] },
    '卯': { primary: '壬', secondary: ['己'] },
    '辰': { primary: '壬', secondary: ['甲'] },
    '巳': { primary: '壬', secondary: ['庚', '癸'], note: '보조 순서 이설(癸庚/庚癸). 원문은 庚爲佐, 壬無면 癸 대용' },
    '午': { primary: '壬', secondary: ['庚'] },
    '未': { primary: '壬', secondary: ['庚'] },
    '申': { primary: '壬', secondary: ['戊'] },
    '酉': { primary: '壬', secondary: ['癸'] },
    '戌': { primary: '甲', secondary: ['壬'] },
    '亥': { primary: '甲', secondary: ['戊', '庚', '壬'] },
    '子': { primary: '壬', secondary: ['戊', '己'] },
    '丑': { primary: '壬', secondary: ['甲'] },
  },
  '丁': {
    '寅': { primary: '甲', secondary: ['庚'] },
    '卯': { primary: '庚', secondary: ['甲'] },
    '辰': { primary: '甲', secondary: ['庚'], note: '일부 전재본은 戊를 보좌로 추가(甲庚戊)' },
    '巳': { primary: '甲', secondary: ['庚'] },
    '午': { primary: '壬', secondary: ['庚', '癸'] },
    '未': { primary: '甲', secondary: ['壬', '庚'] },
    '申': { primary: '甲', secondary: ['庚', '丙', '戊'] },
    '酉': { primary: '甲', secondary: ['庚', '丙', '戊'] },
    '戌': { primary: '甲', secondary: ['庚', '戊'] },
    '亥': { primary: '甲', secondary: ['庚'] },
    '子': { primary: '甲', secondary: ['庚'] },
    '丑': { primary: '甲', secondary: ['庚'] },
  },
  '戊': {
    '寅': { primary: '丙', secondary: ['甲', '癸'] },
    '卯': { primary: '丙', secondary: ['甲', '癸'] },
    '辰': { primary: '甲', secondary: ['丙', '癸'] },
    '巳': { primary: '甲', secondary: ['丙', '癸'] },
    '午': { primary: '壬', secondary: ['甲', '丙'] },
    '未': { primary: '癸', secondary: ['丙', '甲'] },
    '申': { primary: '丙', secondary: ['癸', '甲'] },
    '酉': { primary: '丙', secondary: ['癸'] },
    '戌': { primary: '甲', secondary: ['丙', '癸'] },
    '亥': { primary: '甲', secondary: ['丙'], note: '일부 판본은 戊를 보좌로 추가' },
    '子': { primary: '丙', secondary: ['甲'] },
    '丑': { primary: '丙', secondary: ['甲'] },
  },
  '己': {
    '寅': { primary: '丙', secondary: ['庚', '甲'] },
    '卯': { primary: '甲', secondary: ['癸', '丙'] },
    '辰': { primary: '丙', secondary: ['癸', '甲'] },
    '巳': { primary: '癸', secondary: ['丙'] },
    '午': { primary: '癸', secondary: ['丙'] },
    '未': { primary: '癸', secondary: ['丙'] },
    '申': { primary: '丙', secondary: ['癸'] },
    '酉': { primary: '丙', secondary: ['癸'] },
    '戌': { primary: '甲', secondary: ['丙', '癸'] },
    '亥': { primary: '丙', secondary: ['甲', '戊'] },
    '子': { primary: '丙', secondary: ['甲', '戊'] },
    '丑': { primary: '丙', secondary: ['甲', '戊'] },
  },
  '庚': {
    '寅': { primary: '戊', secondary: ['甲', '壬', '丙', '丁'], note: '보좌 순서는 판본에 따라 甲丙壬丁 등으로 갈림' },
    '卯': { primary: '丁', secondary: ['甲', '庚', '丙'], note: '借甲引丁, 用庚劈甲, 無丁用丙(원문)' },
    '辰': { primary: '甲', secondary: ['丁', '壬', '癸'] },
    '巳': { primary: '壬', secondary: ['戊', '丙', '丁'] },
    '午': { primary: '壬', secondary: ['癸'] },
    '未': { primary: '丁', secondary: ['甲'] },
    '申': { primary: '丁', secondary: ['甲'] },
    '酉': { primary: '丁', secondary: ['甲', '丙'] },
    '戌': { primary: '甲', secondary: ['壬'] },
    '亥': { primary: '丁', secondary: ['丙'] },
    '子': { primary: '丁', secondary: ['甲', '丙'] },
    '丑': { primary: '丙', secondary: ['丁', '甲'] },
  },
  '辛': {
    '寅': { primary: '己', secondary: ['壬', '庚'] },
    '卯': { primary: '壬', secondary: ['甲'] },
    '辰': { primary: '壬', secondary: ['甲'] },
    '巳': { primary: '壬', secondary: ['甲', '癸'] },
    '午': { primary: '壬', secondary: ['己', '癸'] },
    '未': { primary: '壬', secondary: ['庚', '甲'] },
    '申': { primary: '壬', secondary: ['甲', '戊'] },
    '酉': { primary: '壬', secondary: ['甲'], note: '일부 전재본은 丁을 추가(壬甲丁)' },
    '戌': { primary: '壬', secondary: ['甲'] },
    '亥': { primary: '壬', secondary: ['丙'], note: '先壬後丙 金白水清(원문). 일부 전재본 壬 단독 표기' },
    '子': { primary: '丙', secondary: ['戊', '壬', '甲'], note: '일부 중문 전재표는 甲 생략(丙戊壬)' },
    '丑': { primary: '丙', secondary: ['壬', '戊', '己'], note: '일부 중문 전재표는 丙 누락(壬戊己). 원문 평주 ’先丙次壬 戊己又次之’' },
  },
  '壬': {
    '寅': { primary: '庚', secondary: ['丙', '戊'] },
    '卯': { primary: '戊', secondary: ['辛', '庚'] },
    '辰': { primary: '甲', secondary: ['庚'] },
    '巳': { primary: '壬', secondary: ['辛', '庚', '癸'], note: '壬水弱極, 比劫 壬 자체가 용신, 庚辛으로 發源(원문)' },
    '午': { primary: '癸', secondary: ['庚', '辛'] },
    '未': { primary: '辛', secondary: ['甲'] },
    '申': { primary: '戊', secondary: ['丁'] },
    '酉': { primary: '甲', secondary: ['庚'] },
    '戌': { primary: '甲', secondary: ['丙'] },
    '亥': { primary: '戊', secondary: ['丙', '庚'] },
    '子': { primary: '戊', secondary: ['丙'] },
    '丑': { primary: '丙', secondary: ['丁', '甲'], note: '상반월 丙 전용, 하반월 丙+甲(원문)' },
  },
  '癸': {
    '寅': { primary: '辛', secondary: ['丙'] },
    '卯': { primary: '庚', secondary: ['辛'] },
    '辰': { primary: '丙', secondary: ['辛', '甲'] },
    '巳': { primary: '辛', secondary: [], note: '無辛用庚(원문) — 일부 판본은 庚을 보좌로 병기' },
    '午': { primary: '庚', secondary: ['辛', '壬', '癸'] },
    '未': { primary: '庚', secondary: ['辛', '壬', '癸'] },
    '申': { primary: '丁', secondary: [], note: '丁火는 午戌未 통근 필요(원문). 일부 판본은 甲을 보좌로 병기(丁甲)' },
    '酉': { primary: '辛', secondary: ['丙'] },
    '戌': { primary: '辛', secondary: ['甲', '壬', '癸'] },
    '亥': { primary: '庚', secondary: ['辛', '戊', '丁'], note: '水多用戊, 金多用丁(원문)' },
    '子': { primary: '丙', secondary: ['辛'] },
    '丑': { primary: '丙', secondary: ['丁'] },
  },
};
