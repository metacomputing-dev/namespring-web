import type { StemIdx, BranchIdx } from './cycle.js';
import { hiddenStemsOfBranch } from './hiddenStems.js';
import { tenGodOf, type TenGod } from './tenGod.js';

/**
 * 12궁 (palace) analysis.
 *
 * 자평 명리에서 4 pillar 의 각 지지가 1 가지 인생 단계 / 영역의 "궁(宮)"
 * 으로 해석되는 doctrine. 년주=조상궁, 월주=부모궁, 일주=배우자궁, 시주=
 * 자식궁. 본 모듈은 saju_master/palace.py 의 ts port (PR-Q-4 of
 * spring-info Phase H-E plan).
 *
 * Default off — saju-ts 의 SummaryReport.palace 는 optional. 호출자가
 * `analyzePalaces` 를 명시적으로 호출하거나 spring-ts 가 precisionConfig.
 * surfacePalace=true 시에만 populated.
 */

export type PalacePosition = 'year' | 'month' | 'day' | 'hour';

export interface PalaceMeta {
  readonly name: string;        // 조상궁 / 부모궁 / 배우자궁 / 자식궁
  readonly period: string;      // 초년 / 청년 / 장년 / 말년
  readonly ageRange: string;    // 1~20세 / 21~40세 / 41~60세 / 61~80세
  readonly metaphor: string;    // 뿌리 根 / 묘목 苗 / 꽃 花 / 열매 實
  readonly topic: string;       // 조상덕·먼 인연 / 부모덕·형제 / 배우자·거처 / 자식·후배
}

export const PALACE_INFO: Readonly<Record<PalacePosition, PalaceMeta>> = {
  year:  { name: '조상궁', period: '초년', ageRange: '1~20세',  metaphor: '뿌리 根', topic: '조상덕·먼 인연·초년 환경' },
  month: { name: '부모궁', period: '청년', ageRange: '21~40세', metaphor: '묘목 苗', topic: '부모덕·형제·직업 기반·청년기' },
  day:   { name: '배우자궁', period: '장년', ageRange: '41~60세', metaphor: '꽃 花',   topic: '배우자·거처·최종 결정 심리' },
  hour:  { name: '자식궁', period: '말년', ageRange: '61~80세', metaphor: '열매 實', topic: '자식·후배·말년·성과' },
};

/** 길신 (吉神) 십성 - 자평 doctrine 의 길신 그룹 (saju_master constants.GILSHIN). */
const GILSHIN_TEN_GODS: ReadonlySet<TenGod> = new Set<TenGod>([
  'BI_GYEON', 'SIK_SHIN', 'JEONG_JAE', 'PYEON_JAE', 'JEONG_GWAN', 'PYEON_IN', 'JEONG_IN',
]);

/** 일간 근(根) 의 supporting ten-god (비겁/인성). */
const ROOT_SUPPORT_TEN_GODS: ReadonlySet<TenGod> = new Set<TenGod>([
  'BI_GYEON', 'GEOB_JAE', 'PYEON_IN', 'JEONG_IN',
]);

export interface PalaceRootStatus {
  /** 일간과 같은 五行 의 hidden stem 이 있는가? (e.g., 庚 일간 + 申 → 庚 hidden) */
  readonly hasDayMasterRoot: boolean;
  /** 일간을 지원하는 比劫 / 印星 hidden stem 이 있는가? */
  readonly hasSupportingRoot: boolean;
  /** day-master root 인 hidden stem indices. */
  readonly rootStems: readonly StemIdx[];
  /** supporting hidden stems 와 그 ten-god. */
  readonly supportingStems: ReadonlyArray<{ stem: StemIdx; tenGod: TenGod }>;
}

export type PalaceStatus = 'good' | 'caution' | 'normal';

export interface PalaceView {
  readonly position: PalacePosition;
  readonly meta: PalaceMeta;
  readonly branch: BranchIdx;
  readonly mainHiddenStem: StemIdx;
  readonly mainTenGod: TenGod;
  readonly isGilshin: boolean;
  readonly root: PalaceRootStatus;
  readonly status: PalaceStatus;
}

export interface PalaceReport {
  readonly positions: Readonly<Record<PalacePosition, PalaceView>>;
  readonly rule: string;
  readonly caution: string;
}

/** 일간 + branch 의 hidden stem → root status. */
function rootStatus(dayStem: StemIdx, branch: BranchIdx): PalaceRootStatus {
  const dayElem = stemElementIdx(dayStem);
  const hidden = hiddenStemsOfBranch(branch);
  const rootStems: StemIdx[] = [];
  const supporting: Array<{ stem: StemIdx; tenGod: TenGod }> = [];
  for (const h of hidden) {
    if (stemElementIdx(h.stem) === dayElem) {
      rootStems.push(h.stem);
    }
    const code = tenGodOf(dayStem, h.stem);
    if (ROOT_SUPPORT_TEN_GODS.has(code)) {
      supporting.push({ stem: h.stem, tenGod: code });
    }
  }
  return {
    hasDayMasterRoot: rootStems.length > 0,
    hasSupportingRoot: supporting.length > 0,
    rootStems,
    supportingStems: supporting,
  };
}

/** Stem 의 5-element index (0..4). 甲乙=Wood, 丙丁=Fire, 戊己=Earth, 庚辛=Metal, 壬癸=Water. */
function stemElementIdx(stem: StemIdx): number {
  return Math.floor(stem / 2);
}

/** 4 pillar pillar info (stem + branch indices). */
export interface PalacePillarInput {
  readonly stem: StemIdx;
  readonly branch: BranchIdx;
}

export interface PalacePillarsInput {
  readonly year?: PalacePillarInput;
  readonly month?: PalacePillarInput;
  readonly day: PalacePillarInput;        // required (palace analysis is anchored on day stem)
  readonly hour?: PalacePillarInput;
}

/**
 * Analyse the 12 palaces (4 main palaces here — saju_master palace.py
 * surfaces the 4 pillar-anchored palaces). Returns null when day pillar
 * is absent (palace analysis is anchored on day-master ten-god).
 *
 * The full 12-palace doctrine (명궁/재백궁/형제궁/...) requires year stem +
 * month branch lookup which is documented separately in saju_master and
 * not included in this initial port.
 */
export function analyzePalaces(pillars: PalacePillarsInput): PalaceReport {
  const day = pillars.day;
  const positions: Partial<Record<PalacePosition, PalaceView>> = {};
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = pillars[pos];
    if (!p) continue;
    const hidden = hiddenStemsOfBranch(p.branch);
    // 정기(MAIN) is the FIRST entry per rawHiddenStemsTable ([MAIN, MIDDLE?, RESIDUAL?]).
    const main = hidden.find((h) => h.role === 'MAIN')?.stem ?? hidden[0]!.stem;
    const mainTenGod = tenGodOf(day.stem, main);
    const isGilshin = GILSHIN_TEN_GODS.has(mainTenGod);
    const root = rootStatus(day.stem, p.branch);
    const status: PalaceStatus = isGilshin && root.hasSupportingRoot
      ? 'good'
      : !isGilshin
        ? 'caution'
        : 'normal';
    positions[pos] = {
      position: pos,
      meta: PALACE_INFO[pos],
      branch: p.branch,
      mainHiddenStem: main,
      mainTenGod,
      isGilshin,
      root,
      status,
    };
  }
  return {
    positions: positions as Record<PalacePosition, PalaceView>,
    rule: '년지=조상궁/초년, 월지=부모궁/청년, 일지=배우자궁/장년, 시지=자식궁/말년으로 보고 길신·근·형충회합을 함께 봅니다.',
    caution: '궁 판단은 지지 하나만으로 단정하지 않고 성(십성/육친), 운, 합충형파해를 함께 봅니다.',
  };
}
