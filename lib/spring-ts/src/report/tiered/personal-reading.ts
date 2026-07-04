/**
 * personal-reading.ts -- A1 cross-cell synthesis
 *
 * Composes ONE plain-language profile from the person's measured category
 * grades (the 10-category star pattern of the `life` period). The grade vector
 * is effectively a fingerprint, so even reused sentence frames read as
 * "this is about ME" — while exposing zero saju jargon.
 *
 * Deterministic and WYSIWYG: authored sentence frames + category-name and
 * strength injection only. No runtime rewriting, no LLM. The general-tier
 * plain-language rule holds (see docs/PLAN_PERSONALIZATION_PLAIN.md §0):
 * category labels (재물/건강/…) and the plain strength adjective are the only
 * variable parts; every frame is a reviewed constant.
 */

import type { TieredCategoryId, TieredPersonalReading } from '../types.js';

/** Short, user-facing plain labels for the ten life areas. No jargon. */
const CATEGORY_LABEL: Record<TieredCategoryId, string> = {
  wealth: '재물',
  health: '건강',
  academic: '학업',
  romance: '애정',
  family: '가족',
  career: '직업',
  study_document: '시험·문서',
  expression_children: '표현·자녀',
  health_stress: '마음 건강',
  movement: '이동·이사',
};

/** Deterministic tie-break order when two categories share a star value. */
const CATEGORY_RANK: readonly TieredCategoryId[] = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
];

const HIGH_STARS = 4;
const LOW_STARS = 2;
const MAX_NAMED = 3;

interface Scored {
  readonly cat: TieredCategoryId;
  readonly stars: number;
}

function joinLabels(cats: readonly TieredCategoryId[]): string {
  return cats.map((c) => CATEGORY_LABEL[c]).join('·');
}

/** Stable sort: primary by stars (dir), secondary by fixed category order. */
function sortScored(list: readonly Scored[], dir: 'desc' | 'asc'): Scored[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    if (a.stars !== b.stars) return sign * (a.stars - b.stars);
    return CATEGORY_RANK.indexOf(a.cat) - CATEGORY_RANK.indexOf(b.cat);
  });
}

/**
 * Build the personal reading. Returns `undefined` when there are too few
 * graded categories to say anything meaningful (defensive — a report with no
 * stars still renders, just without this block).
 */
export function buildPersonalReading(input: {
  readonly categoryStars: Partial<Record<TieredCategoryId, number | null>>;
  readonly strengthPlain: string;
}): TieredPersonalReading | undefined {
  const scored: Scored[] = [];
  for (const cat of CATEGORY_RANK) {
    const stars = input.categoryStars[cat];
    if (typeof stars === 'number' && Number.isFinite(stars)) scored.push({ cat, stars });
  }
  if (scored.length < 3) return undefined;

  const highs = sortScored(scored.filter((s) => s.stars >= HIGH_STARS), 'desc')
    .slice(0, MAX_NAMED)
    .map((s) => s.cat);
  const lows = sortScored(scored.filter((s) => s.stars <= LOW_STARS), 'asc')
    .slice(0, MAX_NAMED)
    .map((s) => s.cat);

  const strong = `타고난 기운이 ${input.strengthPlain} 편`;
  const topHigh = highs[0];
  const topLow = lows[0];

  let headline: string;
  let paragraph: string;

  if (highs.length > 0 && lows.length > 0) {
    headline = `${joinLabels(highs)} 쪽은 잘 풀리고, ${joinLabels(lows)} 쪽은 공들여야 하는 배치예요.`;
    paragraph = `${strong}인 당신의 사주는 ${joinLabels(highs)} 쪽으로 흐름이 잘 모이고, `
      + `${joinLabels(lows)} 쪽은 한 박자 더 마음을 써야 결과가 따라오는 구성이에요. `
      + `${CATEGORY_LABEL[topHigh]}에서 얻은 여유를 ${CATEGORY_LABEL[topLow]} 쪽에 조금 나눠 쓰면 `
      + `한 해가 한결 균형 있게 굴러가요.`;
  } else if (highs.length > 0) {
    headline = `특히 ${joinLabels(highs)} 쪽이 도드라지는 배치예요.`;
    paragraph = `${strong}인 당신의 사주는 ${joinLabels(highs)} 쪽으로 힘이 모이는 구성이에요. `
      + `이 강점을 축으로 삼으면 다른 영역도 자연스럽게 끌려 올라오니, `
      + `올 한 해는 ${CATEGORY_LABEL[topHigh]} 쪽을 먼저 세우는 전략이 잘 맞아요.`;
  } else if (lows.length > 0) {
    headline = `${joinLabels(lows)} 쪽은 조금 더 공들여야 하는 배치예요.`;
    paragraph = `${strong}인 당신의 사주는 크게 치우친 강점보다 고른 편에 가깝고, `
      + `${joinLabels(lows)} 쪽은 한 박자 더 마음을 써야 결과가 따라오는 구성이에요. `
      + `무리해서 한 번에 끌어올리기보다 ${CATEGORY_LABEL[topLow]} 쪽을 꾸준히 다지면 `
      + `그 자리가 점점 단단해져요.`;
  } else {
    headline = `어느 쪽으로도 크게 치우치지 않은, 고르게 짜인 배치예요.`;
    paragraph = `${strong}인 당신의 사주는 특별히 약한 데 없이 균형 잡힌 구성이에요. `
      + `튀는 강점이 없는 대신 무너지는 영역도 없으니, 한 해의 목표를 하나 정해 `
      + `꾸준히 가면 어느 영역이든 무리 없이 따라와요.`;
  }

  return {
    source: 'spring-ts.tiered.personalReading',
    headline,
    paragraph,
    highlights: highs,
    cautions: lows,
  };
}
