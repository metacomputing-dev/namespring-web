/**
 * article-selector.ts -- Deterministic article pick per matrix cell
 *
 * Selection axes are intentionally tiny (see PLAN_ARTICLE_REWRITE.md §1.2):
 * (category, period, audience) keys the pool, band narrows it, and a seeded
 * FNV-1a hash picks the variant. Fallback is exact band → 'any' → null;
 * corpus completeness is a quality-gate responsibility, not a runtime one.
 */

import type { StarRating, TieredCategoryId, TieredLifeStageBand, TieredPeriodKind } from '../types.js';
import type { FeatureVector } from './feature-selector.js';
import type { Article, ArticleAudience, ArticleBand, ArticleRegistry } from './article-registry.js';

/** Subject-age audience for the five period surfaces. */
export function deriveAudience(ageBand: FeatureVector['ageBand']): ArticleAudience {
  if (ageBand === '0-9') return 'child';
  if (ageBand === '10-19') return 'teen';
  return 'adult';
}

/** Life-stage audience for byAgeBand cells. */
export function stageAudienceForLifeBand(band: TieredLifeStageBand): ArticleAudience {
  switch (band) {
    case '10-19': return 'stage-teen';
    case '20-29':
    case '30-39': return 'stage-early';
    case '40-49':
    case '50-59': return 'stage-mid';
    case '60-69':
    case '70-79': return 'stage-senior';
    default: return 'stage-elder';
  }
}

/** Star rating → tonal band. Cells without stars read the 'any' pool. */
export function bandFromStars(stars: StarRating | null): ArticleBand {
  if (stars === null) return 'any';
  if (stars >= 4) return 'high';
  if (stars <= 2) return 'low';
  return 'mid';
}

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Build the seed key used by selectArticle. Same joined format as the
 *  legacy fragment selector so existing determinism fixtures stay stable:
 *  birth + target date, axis appended per cell inside selectArticle. */
export function buildSelectionSeed(
  birth: { year?: number | null; month?: number | null; day?: number | null; hour?: number | null; minute?: number | null; gender: string },
  targetDate: Date,
): string {
  return [
    birth.year ?? 0,
    birth.month ?? 0,
    birth.day ?? 0,
    birth.hour ?? 0,
    birth.minute ?? 0,
    birth.gender,
    targetDate.toISOString(),
  ].join('|');
}

export function selectArticle(
  registry: ArticleRegistry,
  category: 'overall' | TieredCategoryId,
  period: TieredPeriodKind,
  audience: ArticleAudience,
  band: ArticleBand,
  seedKey: string,
): Article | null {
  const pool = registry.get(category, period, audience);
  if (pool.length === 0) return null;

  const exact = band === 'any' ? [] : pool.filter((article) => article.band === band);
  const candidates = exact.length > 0 ? exact : pool.filter((article) => article.band === 'any');
  const scoped = candidates.length > 0 ? candidates : pool;

  const seed = fnv1a(`${seedKey}|${category}|${period}|${audience}|${band}`);
  return scoped[seed % scoped.length] ?? null;
}
