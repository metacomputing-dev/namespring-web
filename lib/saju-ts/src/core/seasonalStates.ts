import type { BranchIdx, Element } from './cycle.js';
import { branchElement } from './cycle.js';
import { CONTROLS_TO, GENERATES_TO } from './elements.js';

/**
 * 왕상휴수사(旺相休囚死) — 월지 당령(當令) 오행 기준 오행별 계절 상태 (감사 B434).
 *
 * 고전 규칙: 當令者旺 · 令生者相 · 生令者休 · 克令者囚 · 令克者死.
 *  - 왕(旺): 당령 오행 자신
 *  - 상(相): 당령이 생하는 오행       (예: 木令 → 火)
 *  - 휴(休): 당령을 생하는 오행       (예: 木令 → 水)
 *  - 수(囚): 당령을 극하는 오행       (예: 木令 → 金)
 *  - 사(死): 당령이 극하는 오행       (예: 木令 → 土)
 *
 * 당령 판정: 寅卯=木, 巳午=火, 申酉=金, 亥子=水, 辰未戌丑(사계)=土(본기 기준).
 * 사계월의 wollyul(月律分野) 사령 연동(절입 경과일에 따라 여기/중기 당령)은
 * 후속 옵션 — 본 모듈은 본기 고정이 기본이며 이는 통용 조견표와 일치한다.
 */

export type SeasonalState = 'WANG' | 'SANG' | 'HYU' | 'SU' | 'SA';

export const SEASONAL_STATE_KO: Record<SeasonalState, string> = {
  WANG: '왕',
  SANG: '상',
  HYU: '휴',
  SU: '수',
  SA: '사',
};

export const ALL_ELEMENTS: readonly Element[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;

/** 월지 → 당령 오행. 사계(辰戌丑未)월은 본기 土 기준. */
export function monthCommandElement(monthBranch: BranchIdx): Element {
  // branchElement가 이미 지지 본기 오행을 반환한다:
  // 子·亥=水, 寅·卯=木, 巳·午=火, 申·酉=金, 辰·戌·丑·未=土.
  return branchElement(monthBranch);
}

/** 오행 하나의 해당 월 계절 상태. */
export function seasonalStateOf(element: Element, monthBranch: BranchIdx): SeasonalState {
  const cmd = monthCommandElement(monthBranch);
  if (element === cmd) return 'WANG';
  if (GENERATES_TO[cmd] === element) return 'SANG';
  if (GENERATES_TO[element] === cmd) return 'HYU';
  if (CONTROLS_TO[element] === cmd) return 'SU'; // 克令者囚
  return 'SA'; // 令克者死 — 나머지 한 관계: cmd가 element를 극한다
}

/** 해당 월의 오행 5종 전체 상태 맵. */
export function seasonalStatesForMonth(monthBranch: BranchIdx): Record<Element, SeasonalState> {
  const out = {} as Record<Element, SeasonalState>;
  for (const el of ALL_ELEMENTS) out[el] = seasonalStateOf(el, monthBranch);
  return out;
}
