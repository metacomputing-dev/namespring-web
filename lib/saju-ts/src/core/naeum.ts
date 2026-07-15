import { deepFreeze } from '../utils/deepMerge.js';

/**
 * 納音 (naeum / sound-of-the-pillar) 60 갑자 table.
 *
 * Port of saju_master/naeum.py (PR-Q-6 of spring-info Phase H-F plan).
 *
 * 30 pillar-pairs cover the full 60갑자 sexagenary cycle. Each pair shares
 * the same 納音 element name + Korean reading + classical metaphor.
 * 자평학에서는 보조 참고이고 三命학(삼명학)에서 중시됨.
 *
 * Default off — saju-ts SummaryReport.naeum is optional. Spring-ts will
 * surface via precisionConfig.surfaceNaeum opt-in.
 */

export interface NaeumEntry {
  /** 한자 명칭 (e.g., "海中金"). */
  readonly nameHanja: string;
  /** 한글 명칭 (e.g., "해중금"). */
  readonly nameKorean: string;
  /** 5요소 (五行) — last hanja of nameHanja (金/木/水/火/土). */
  readonly elementHanja: string;
  /** 비유 의미 (e.g., "바다 속의 금"). */
  readonly meaning: string;
}

/** 60갑자 pair table — 30 entries, each covering 2 consecutive 갑자. */
export const NAEUM_PAIR_TABLE: ReadonlyArray<readonly [readonly [string, string], NaeumEntry]> = deepFreeze([
  [['甲子', '乙丑'], { nameHanja: '海中金', nameKorean: '해중금', elementHanja: '金', meaning: '바다 속의 금' }],
  [['丙寅', '丁卯'], { nameHanja: '爐中火', nameKorean: '노중화', elementHanja: '火', meaning: '화로 속의 불' }],
  [['戊辰', '己巳'], { nameHanja: '大林木', nameKorean: '대림목', elementHanja: '木', meaning: '큰 숲의 나무' }],
  [['庚午', '辛未'], { nameHanja: '路傍土', nameKorean: '노방토', elementHanja: '土', meaning: '길가의 흙' }],
  [['壬申', '癸酉'], { nameHanja: '劍鋒金', nameKorean: '검봉금', elementHanja: '金', meaning: '칼끝의 금' }],
  [['甲戌', '乙亥'], { nameHanja: '山頭火', nameKorean: '산두화', elementHanja: '火', meaning: '산머리의 불' }],
  [['丙子', '丁丑'], { nameHanja: '澗下水', nameKorean: '간하수', elementHanja: '水', meaning: '계곡 아래 물' }],
  [['戊寅', '己卯'], { nameHanja: '城頭土', nameKorean: '성두토', elementHanja: '土', meaning: '성곽의 흙' }],
  [['庚辰', '辛巳'], { nameHanja: '白鑞金', nameKorean: '백랍금', elementHanja: '金', meaning: '백랍의 금' }],
  [['壬午', '癸未'], { nameHanja: '楊柳木', nameKorean: '양류목', elementHanja: '木', meaning: '버드나무' }],
  [['甲申', '乙酉'], { nameHanja: '泉中水', nameKorean: '천중수', elementHanja: '水', meaning: '샘 속의 물' }],
  [['丙戌', '丁亥'], { nameHanja: '屋上土', nameKorean: '옥상토', elementHanja: '土', meaning: '지붕 위의 흙' }],
  [['戊子', '己丑'], { nameHanja: '霹靂火', nameKorean: '벽력화', elementHanja: '火', meaning: '벼락불' }],
  [['庚寅', '辛卯'], { nameHanja: '松柏木', nameKorean: '송백목', elementHanja: '木', meaning: '소나무·잣나무' }],
  [['壬辰', '癸巳'], { nameHanja: '長流水', nameKorean: '장류수', elementHanja: '水', meaning: '길게 흐르는 물' }],
  [['甲午', '乙未'], { nameHanja: '沙中金', nameKorean: '사중금', elementHanja: '金', meaning: '모래 속의 금' }],
  [['丙申', '丁酉'], { nameHanja: '山下火', nameKorean: '산하화', elementHanja: '火', meaning: '산 아래 불' }],
  [['戊戌', '己亥'], { nameHanja: '平地木', nameKorean: '평지목', elementHanja: '木', meaning: '평지의 나무' }],
  [['庚子', '辛丑'], { nameHanja: '壁上土', nameKorean: '벽상토', elementHanja: '土', meaning: '벽 위의 흙' }],
  [['壬寅', '癸卯'], { nameHanja: '金箔金', nameKorean: '금박금', elementHanja: '金', meaning: '금박의 금' }],
  [['甲辰', '乙巳'], { nameHanja: '覆燈火', nameKorean: '복등화', elementHanja: '火', meaning: '등불' }],
  [['丙午', '丁未'], { nameHanja: '天河水', nameKorean: '천하수', elementHanja: '水', meaning: '하늘의 강물' }],
  [['戊申', '己酉'], { nameHanja: '大驛土', nameKorean: '대역토', elementHanja: '土', meaning: '큰 역참의 흙' }],
  [['庚戌', '辛亥'], { nameHanja: '釵釧金', nameKorean: '차천금', elementHanja: '金', meaning: '비녀·팔찌의 금' }],
  [['壬子', '癸丑'], { nameHanja: '桑柘木', nameKorean: '상자목', elementHanja: '木', meaning: '뽕나무·산뽕나무' }],
  [['甲寅', '乙卯'], { nameHanja: '大溪水', nameKorean: '대계수', elementHanja: '水', meaning: '큰 시냇물' }],
  [['丙辰', '丁巳'], { nameHanja: '沙中土', nameKorean: '사중토', elementHanja: '土', meaning: '모래 속의 흙' }],
  [['戊午', '己未'], { nameHanja: '天上火', nameKorean: '천상화', elementHanja: '火', meaning: '하늘의 불' }],
  [['庚申', '辛酉'], { nameHanja: '石榴木', nameKorean: '석류목', elementHanja: '木', meaning: '석류나무' }],
  [['壬戌', '癸亥'], { nameHanja: '大海水', nameKorean: '대해수', elementHanja: '水', meaning: '큰 바닷물' }],
] as const);

/** Flat ganzhi → NaeumEntry lookup. Built once at module load. */
export const NAEUM_BY_GANZHI: Readonly<Record<string, NaeumEntry>> = deepFreeze((() => {
  const out: Record<string, NaeumEntry> = {};
  for (const [pair, entry] of NAEUM_PAIR_TABLE) {
    for (const gz of pair) out[gz] = entry;
  }
  return out;
})());

export type NaeumPosition = 'year' | 'month' | 'day' | 'hour';

export interface NaeumPillarInput {
  /** Ganzhi string, e.g., "甲子". */
  readonly ganzhi: string;
}

export interface NaeumPositionView extends NaeumEntry {
  readonly pillar: string;
}

export interface NaeumReport {
  readonly positions: Readonly<Record<NaeumPosition, NaeumPositionView | undefined>>;
  /** Element-name → count of pillars matching that 納音 element. */
  readonly elementCounts: Readonly<Record<string, number>>;
  readonly caution: string;
}

/** Analyse the four pillars' 60갑자 → 納音 mapping. */
export function analyzeNaeum(pillars: Partial<Record<NaeumPosition, NaeumPillarInput>>): NaeumReport {
  const positions: Partial<Record<NaeumPosition, NaeumPositionView>> = {};
  const elementCounts: Record<string, number> = {};
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = pillars[pos];
    if (!p) continue;
    const entry = NAEUM_BY_GANZHI[p.ganzhi];
    if (!entry) continue;
    positions[pos] = { ...entry, pillar: p.ganzhi };
    elementCounts[entry.elementHanja] = (elementCounts[entry.elementHanja] ?? 0) + 1;
  }
  return {
    positions: positions as Record<NaeumPosition, NaeumPositionView | undefined>,
    elementCounts,
    caution: '納音(납음)은 三命학에서 중시되었고 자평학에서는 대체로 보조 참고로 봅니다.',
  };
}
