/**
 * build-tiered-matrix.ts -- Top-level tiered matrix orchestrator
 *
 * Returns `undefined` (the opt-in default) when the caller did not enable
 * `precisionConfig.surfaceTieredMatrix`. Otherwise assembles a full
 * 5 periods × (1 overall + 10 categories) matrix with three depth tiers
 * per cell, an inline-tag glossary, and selection metadata. Narrative
 * content is loaded from `data/narrative/**` and never imported by the
 * scoring layer (see `tiered-isolation-guard.test.ts`).
 */

import type { SajuSummary, BirthInfo } from '../../types.js';
import type {
  FortuneTieredMatrix,
  PeriodScopedFortunes,
  TieredCategoryId,
  TieredPeriodKind,
  TieredDepth,
  TieredFortune,
  BriefFortuneText,
  StandardFortuneText,
  ExpertFortuneText,
  TaggedParagraph,
  TieredMatrixMeta,
} from '../types.js';

import { buildFeatureVector, type FeatureVector } from './feature-selector.js';
import { loadFragmentRegistry, type FragmentRegistry, type NarrativeFragment } from './fragment-registry.js';
import { selectFragment, buildSelectionSeed } from './fragment-selector.js';
import { renderFragment, type RenderContext } from './template-engine.js';
import { gradeCell } from './cell-grader.js';
import { buildPeriodMeta, periodFortuneElement } from './period-meta-builder.js';
import { loadGlossary } from './glossary-loader.js';
import { buildTagGlossary } from './tag-inliner.js';

const PERIOD_ORDER: readonly TieredPeriodKind[] = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];
const CATEGORY_ORDER: readonly TieredCategoryId[] = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
];

const EMPTY_PARAGRAPHS: readonly TaggedParagraph[] = Object.freeze([]);

const PLACEHOLDER_BRIEF: BriefFortuneText = Object.freeze({ headline: '준비 중인 흐름이에요.' });
const PLACEHOLDER_STANDARD: StandardFortuneText = Object.freeze({ paragraphs: EMPTY_PARAGRAPHS });
const PLACEHOLDER_EXPERT: ExpertFortuneText = Object.freeze({ paragraphs: EMPTY_PARAGRAPHS });

function deriveBrief(rendered: TaggedParagraph): BriefFortuneText {
  const text = rendered.plainText.trim();
  return text ? { headline: text } : PLACEHOLDER_BRIEF;
}

function buildExpertText(
  fragment: NarrativeFragment | null,
  rendered: TaggedParagraph,
): ExpertFortuneText {
  if (!fragment) return PLACEHOLDER_EXPERT;
  // TODO(phase-2): wire fragment.numericalEvidence[].valueExpression to the
  // saju feature vector and emit NumericalEvidenceRow[]. Schema permits it
  // (see narrativeFragment.schema.json), renderer currently drops it.
  return {
    paragraphs: rendered.tokens.length ? [rendered] : EMPTY_PARAGRAPHS,
  };
}

function buildStandardText(
  fragment: NarrativeFragment | null,
  rendered: TaggedParagraph,
): StandardFortuneText {
  if (!fragment) return PLACEHOLDER_STANDARD;
  return {
    paragraphs: rendered.tokens.length ? [rendered] : EMPTY_PARAGRAPHS,
    ...(fragment.livingTips && fragment.livingTips.length ? { livingTips: fragment.livingTips } : {}),
    ...(fragment.cautions && fragment.cautions.length ? { cautions: fragment.cautions } : {}),
  };
}

function buildCell(
  category: 'overall' | TieredCategoryId,
  period: TieredPeriodKind,
  registry: FragmentRegistry,
  feature: FeatureVector,
  seedKey: string,
  periodLabel: string,
  yongshin: FeatureVector['yongshinElement'],
  heeshin: FeatureVector['heeshinElement'],
  gishin: FeatureVector['gishinElement'],
  fortuneElement: FeatureVector['dayMasterElement'],
): TieredFortune {
  const ctx: RenderContext = { seedKey, periodLabel, feature };

  const briefFrag = selectFragment(registry, category, period, 'brief', feature, { seedKey });
  const standardFrag = selectFragment(registry, category, period, 'standard', feature, { seedKey });
  const expertFrag = selectFragment(registry, category, period, 'expert', feature, { seedKey });

  const briefRender = briefFrag ? renderFragment(briefFrag, ctx) : null;
  const standardRender = standardFrag ? renderFragment(standardFrag, ctx) : null;
  const expertRender = expertFrag ? renderFragment(expertFrag, ctx) : null;

  const brief = briefRender ? deriveBrief(briefRender) : PLACEHOLDER_BRIEF;
  const standard = buildStandardText(standardFrag, standardRender ?? { tokens: [], plainText: '' });
  const expert = buildExpertText(expertFrag, expertRender ?? { tokens: [], plainText: '' });

  const grade = gradeCell(fortuneElement, yongshin, heeshin, gishin);

  // Cell with no fragment matches at all becomes 'na'.
  if (!briefFrag && !standardFrag && !expertFrag) {
    return {
      meaningfulness: 'na',
      stars: null,
      brief: PLACEHOLDER_BRIEF,
      standard: PLACEHOLDER_STANDARD,
      expert: PLACEHOLDER_EXPERT,
    };
  }

  return {
    meaningfulness: grade.meaningfulness,
    stars: grade.stars,
    brief,
    standard,
    expert,
  };
}

function buildPeriodScoped(
  period: TieredPeriodKind,
  registry: FragmentRegistry,
  feature: FeatureVector,
  seedKey: string,
  targetDate: Date,
): PeriodScopedFortunes {
  const meta = buildPeriodMeta(period, targetDate);
  const fortuneElement = period === 'life'
    ? feature.dayMasterElement
    : periodFortuneElement(period, targetDate);

  const overall = buildCell(
    'overall',
    period,
    registry,
    feature,
    seedKey,
    meta.label,
    feature.yongshinElement,
    feature.heeshinElement,
    feature.gishinElement,
    fortuneElement,
  );

  const byCategory = {} as Record<TieredCategoryId, TieredFortune>;
  for (const cat of CATEGORY_ORDER) {
    byCategory[cat] = buildCell(
      cat,
      period,
      registry,
      feature,
      seedKey,
      meta.label,
      feature.yongshinElement,
      feature.heeshinElement,
      feature.gishinElement,
      fortuneElement,
    );
  }

  return {
    periodKind: period,
    periodLabel: meta.label,
    periodMeta: meta.meta,
    overall,
    byCategory,
  };
}

export interface BuildTieredMatrixOptions {
  readonly enabled?: boolean;
  readonly contentSource?: 'placeholder' | 'authored';
}

export function buildTieredMatrix(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
  options: BuildTieredMatrixOptions,
): FortuneTieredMatrix | undefined {
  if (options.enabled !== true) return undefined;

  const feature = buildFeatureVector(saju, birth, targetDate);
  const registry = loadFragmentRegistry();
  const seedKey = buildSelectionSeed(birth, targetDate);

  const periods = {} as Record<TieredPeriodKind, PeriodScopedFortunes>;
  for (const period of PERIOD_ORDER) {
    periods[period] = buildPeriodScoped(period, registry, feature, seedKey, targetDate);
  }

  const allEntries = loadGlossary();
  const glossary = buildTagGlossary({ periods }, allEntries);

  const meta: TieredMatrixMeta = {
    schemaVersion: 'spring-ts.tiered-matrix.v1',
    generatedAt: new Date().toISOString(),
    selectionSeed: seedKey,
    templateContractVersion: '1.0.0',
    contentSource: options.contentSource ?? 'placeholder',
    fragmentCount: registry.totalFragmentCount,
    aiGeneratedFragmentCount: registry.totalFragmentCount,
  };

  return {
    schemaVersion: 'spring-ts.tiered-matrix.v1',
    periods,
    glossary,
    meta,
  };
}
