/**
 * category-fortune-subdomain-data.ts — sub-domain expansion (PR-K-1).
 *
 * Doctrine 출처: saju_master/event_domain_map.py FINE_DOMAIN_KEYWORDS +
 * TEN_GOD_TOPIC_HINTS, spec spring-info/09_finalization/02_event_domain_wireup.md.
 *
 * 5 base FortuneCategory → 1-3 FortuneCategoryExtended sub-rows.
 * Surfaced only when FortuneReportOptions.surfaceSubDomains === true.
 */

import {
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLLED_BY,
  getElementRelation,
} from '../common/elementMaps.js';
import type { ElementCode } from '../types.js';
import type {
  FortuneCategory,
  FortuneCategoryExtended,
  StarRating,
} from '../types.js';

interface CategoryElements {
  readonly primary: ElementCode;
  readonly secondary: ElementCode | null;
}

/** spec §3.2 — 10 case switch (5 base + 5 신규). dme = dayMasterEl. */
export function getExtendedCategoryElements(
  category: FortuneCategoryExtended,
  dme: ElementCode,
): CategoryElements {
  switch (category) {
    case 'wealth':              return { primary: ELEMENT_CONTROLS[dme],     secondary: null };
    case 'health':              return { primary: ELEMENT_GENERATED_BY[dme], secondary: null };
    case 'academic':            return { primary: ELEMENT_GENERATES[dme],    secondary: ELEMENT_GENERATED_BY[dme] };
    case 'romance':             return { primary: ELEMENT_CONTROLS[dme],     secondary: ELEMENT_CONTROLLED_BY[dme] };
    case 'family':              return { primary: ELEMENT_GENERATED_BY[dme], secondary: dme };
    case 'career':              return { primary: ELEMENT_CONTROLLED_BY[dme], secondary: null };
    case 'study_document':      return { primary: ELEMENT_GENERATED_BY[dme], secondary: null };
    case 'expression_children': return { primary: ELEMENT_GENERATES[dme],    secondary: null };
    case 'health_stress':       return { primary: ELEMENT_GENERATED_BY[dme], secondary: ELEMENT_CONTROLLED_BY[dme] };
    case 'movement':            return { primary: ELEMENT_CONTROLS[dme],     secondary: ELEMENT_CONTROLLED_BY[dme] };
  }
}

/** spec §3.3 — sub-domain narrative table. high (≥4) / mid (3) / low (≤2).
 *  Voice (NARRATIVE_STYLE_GUIDE §6): 카테고리 voice 일관, 시기예요·흐름이에요
 *  종결 반복 회피 (P17-A4). */
export const SUB_DOMAIN_NARRATIVES: Record<
  FortuneCategoryExtended,
  Record<'high' | 'mid' | 'low', string>
> = {
  wealth: {
    high: '재물 흐름이 좋아 적극적인 운용도 안정적으로 이어 가요.',
    mid: '재물은 무리 없이 안정적이에요. 큰 결정은 신중히 검토하세요.',
    low: '재물 영역은 보수적으로 운영하는 편이 좋아요.',
  },
  health: {
    high: '체력과 회복력이 안정적이라 큰 부담 없이 활동할 수 있어요.',
    mid: '건강은 평년 수준이에요. 식습관과 수면 관리를 일관되게 유지하세요.',
    low: '건강 영역은 무리 없는 일정을 짜고, 불편한 신호가 있으면 일찍 도움을 청하세요.',
  },
  academic: {
    high: '학습 효율과 집중도가 올라가 시험·문서 관련 일이 잘 풀려요.',
    mid: '학업은 평이한 페이스로 이어져요. 정기 점검과 복습 위주의 운영이 좋아요.',
    low: '학업 영역은 욕심을 줄이고 기본 정리에 집중하면 결과가 안정돼요.',
  },
  romance: {
    high: '인연의 호흡이 부드러워지고 감정 표현이 자연스럽게 풀려 나와요.',
    mid: '관계는 무리 없는 거리감을 유지하면 큰 굴곡 없이 지나가요.',
    low: '관계 영역은 충돌을 최소화하고 본인 페이스를 지키는 편이 안전해요.',
  },
  family: {
    high: '가족 분위기가 따뜻해지고 의사소통이 자연스럽게 풀려요.',
    mid: '가족 운은 안정적이에요. 이벤트보다 일상적인 돌봄이 의미 있어요.',
    low: '가족 영역은 큰 결정을 미루고 갈등 요인은 일찍 풀어두는 편이 좋아요.',
  },
  career: {
    high: '관성 흐름이 안정되어 직장·조직 내 평가가 좋아지는 한 해예요.',
    mid: '직장운은 평이해요. 새로운 시도보다 안정적인 운영이 유리해요.',
    low: '조직 내 갈등 신호는 빠르게 정리하고 무리한 도전은 한 박자 미루세요.',
  },
  study_document: {
    high: '인성이 잘 작동해 시험·계약·문서 처리가 매끄러워요.',
    mid: '문서 운은 평이해요. 기한 관리와 검토 절차를 한 번 더 확인하세요.',
    low: '문서·계약 영역은 변경 사항을 보수적으로 검토하고 서두르지 마세요.',
  },
  expression_children: {
    high: '식상이 활성화되어 표현·창작·자녀 관련 기운이 자연스럽게 받쳐 줘요.',
    mid: '표현 영역은 무리 없이 안정적이에요. 결과보다 과정에 집중하세요.',
    low: '표현·전달 영역은 단어 선택을 신중히 하고 중요한 결정은 한 번 더 검토하세요.',
  },
  health_stress: {
    high: '인성 + 조후 흐름이 안정적이라 생활 리듬이 자연스럽게 회복돼요.',
    mid: '스트레스 영역은 무리 없는 수준이에요. 충분한 수면을 확보하세요.',
    low: '스트레스 신호가 쌓이기 쉬우니 휴식과 회복 시간을 일찍 확보하세요.',
  },
  movement: {
    high: '역마 + 편재 흐름이 활발해 이동·확장 결정이 좋은 결과로 이어지기 쉬워요.',
    mid: '이동 운은 평이해요. 큰 변화보다 점진적 조정이 안전해요.',
    low: '이동·이사 결정은 보수적으로 검토하고, 충해가 동시에 보이면 일정을 늦추세요.',
  },
};

export const SUB_DOMAIN_TITLE: Record<FortuneCategoryExtended, string> = {
  wealth: '재물/커리어운',
  health: '건강운',
  academic: '학업운',
  romance: '연애/결혼운',
  family: '가족운',
  career: '직장/관성',
  study_document: '학업/문서',
  expression_children: '표현/자녀',
  health_stress: '건강/스트레스',
  movement: '이동/변동',
};

/** spec §2 — 5 base 별 sub-domain plan.
 *  always: 무조건 surface (1 row 보장).
 *  conditional: surface 여부를 saju feature 로 게이트. */
interface SubDomainPlan {
  readonly always: FortuneCategoryExtended;
  readonly conditional: readonly FortuneCategoryExtended[];
}

export const SUB_DOMAIN_PLAN: Record<FortuneCategory, SubDomainPlan> = {
  wealth:   { always: 'career',              conditional: ['movement'] },
  health:   { always: 'health_stress',       conditional: ['movement'] },
  academic: { always: 'study_document',      conditional: ['expression_children', 'career'] },
  romance:  { always: 'expression_children', conditional: [] },
  family:   { always: 'expression_children', conditional: [] },
};

/** spec §3.4 — conditional gate using saju ten-god / shinsal hits.
 *  Threshold 0.18 per spec; revisit in PR-B (default flip) baseline. */
const CONDITIONAL_THRESHOLD = 0.18;

export interface SubDomainGateInput {
  /** Ten-god group counts (saju_master groupCounts: friend/output/wealth/authority/resource). */
  readonly groupCounts?: Partial<Record<string, number>>;
  /** Yeokma (역마) hits per pillar. */
  readonly yeokmaHits?: number;
  /** Chung (충) relation count among branches. */
  readonly chungHits?: number;
}

export function shouldSurfaceConditional(
  subDomain: FortuneCategoryExtended,
  saju: SubDomainGateInput,
): boolean {
  const total = sumGroupCounts(saju.groupCounts);
  switch (subDomain) {
    case 'movement': {
      const wealthRatio = ratio(saju.groupCounts?.wealth, total);
      return (saju.yeokmaHits ?? 0) > 0
        || (saju.chungHits ?? 0) > 0
        || wealthRatio >= CONDITIONAL_THRESHOLD;
    }
    case 'expression_children':
      return ratio(saju.groupCounts?.output, total) >= CONDITIONAL_THRESHOLD;
    case 'career':
      return ratio(saju.groupCounts?.authority, total) >= CONDITIONAL_THRESHOLD;
    default:
      return true;
  }
}

function sumGroupCounts(g?: Partial<Record<string, number>>): number {
  if (!g) return 0;
  let s = 0;
  for (const v of Object.values(g)) s += v ?? 0;
  return s;
}

function ratio(value: number | undefined, total: number): number {
  if (!total || total <= 0) return 0;
  return (value ?? 0) / total;
}

/** spec §3.1 — reuse computeCategoryGrade by sharing the relPrimary mapping.
 *  Score: same=5 / generates=4 / generated_by=3 / controls=2 / controlled_by=1 / else=3.
 *  Then 60% category + 40% yongshin blend (caller supplies yongshinGrade). */
export function computeSubDomainGrade(
  fortuneEl: ElementCode,
  els: CategoryElements,
  yongshinGrade: number,
): number {
  const score = scoreFromRelation(getElementRelation(fortuneEl, els.primary));
  if (els.secondary) {
    const sec = scoreFromRelation(getElementRelation(fortuneEl, els.secondary));
    return ((score + sec) / 2) * 0.6 + yongshinGrade * 0.4;
  }
  return score * 0.6 + yongshinGrade * 0.4;
}

function scoreFromRelation(rel: string | null): number {
  switch (rel) {
    case 'same':         return 5;
    case 'generates':    return 4;
    case 'generated_by': return 3;
    case 'controls':     return 2;
    case 'controlled_by': return 1;
    default:             return 3;
  }
}

export function gradeBucket(stars: StarRating): 'high' | 'mid' | 'low' {
  if (stars >= 4) return 'high';
  if (stars === 3) return 'mid';
  return 'low';
}
