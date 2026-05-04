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

import type { SajuSummary, BirthInfo, NamingReport, NamingReportFrame } from '../../types.js';
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
  TieredSelectedFragmentEvidence,
  TieredSelectedFragments,
  TaggedParagraph,
  TieredMatrixMeta,
  TieredNameFrameEvidence,
  TieredNamingEvidence,
} from '../types.js';

import { buildFeatureVector, type FeatureVector } from './feature-selector.js';
import { loadFragmentRegistry, type FragmentRegistry, type NarrativeFragment } from './fragment-registry.js';
import { selectFragment, buildSelectionSeed } from './fragment-selector.js';
import { renderFragment, type RenderContext } from './template-engine.js';
import { gradeCell } from './cell-grader.js';
import { buildPeriodMeta, periodFortuneElement } from './period-meta-builder.js';
import { loadGlossary } from './glossary-loader.js';
import { buildTagGlossary } from './tag-inliner.js';
import { resolveNumericalEvidence, type NumericalEvidenceContext } from './numerical-evidence.js';

const PERIOD_ORDER: readonly TieredPeriodKind[] = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];
const CATEGORY_ORDER: readonly TieredCategoryId[] = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
];

const EMPTY_PARAGRAPHS: readonly TaggedParagraph[] = Object.freeze([]);

const PLACEHOLDER_BRIEF: BriefFortuneText = Object.freeze({ headline: '준비 중인 흐름이에요.' });
const PLACEHOLDER_STANDARD: StandardFortuneText = Object.freeze({ paragraphs: EMPTY_PARAGRAPHS });
const PLACEHOLDER_EXPERT: ExpertFortuneText = Object.freeze({ paragraphs: EMPTY_PARAGRAPHS });

const MINOR_STANDARD_LIMITED_PARAGRAPH: TaggedParagraph = Object.freeze({
  tokens: [
    {
      kind: 'text',
      value: '이 항목은 아직 나이에 맞춘 세부 문장이 충분하지 않아요. 지금은 생활 리듬을 지키고, 큰 결정은 가까운 어른과 함께 확인해 주세요.',
    },
  ] as const,
  plainText: '이 항목은 아직 나이에 맞춘 세부 문장이 충분하지 않아요. 지금은 생활 리듬을 지키고, 큰 결정은 가까운 어른과 함께 확인해 주세요.',
});

const MINOR_EXPERT_LIMITED_PARAGRAPH: TaggedParagraph = Object.freeze({
  tokens: [
    { kind: 'text', value: '이 항목은 나이가 어린 독자에게 단정적으로 풀이하지 않아요. ' },
    { kind: 'tag', tagId: 'dayPillar', label: '일주' },
    { kind: 'text', value: '와 ' },
    { kind: 'tag', tagId: 'yongshin', label: '용신' },
    {
      kind: 'text',
      value: ' 같은 전문 지표는 성장 과정, 보호자 관찰, 실제 생활 환경을 함께 보며 참고해야 해요.',
    },
  ] as const,
  plainText: '이 항목은 나이가 어린 독자에게 단정적으로 풀이하지 않아요. #일주와 #용신 같은 전문 지표는 성장 과정, 보호자 관찰, 실제 생활 환경을 함께 보며 참고해야 해요.',
});

const NAME_FRAME_STAGE: Record<NamingReportFrame['type'], { stage: TieredNameFrameEvidence['stage']; label: string }> = {
  won: { stage: 'earlyLife', label: '초년운' },
  hyung: { stage: 'youthLife', label: '청년운' },
  lee: { stage: 'middleLife', label: '중년운' },
  jung: { stage: 'lateAndTotal', label: '말년/총운' },
};

function deriveBrief(rendered: TaggedParagraph): BriefFortuneText {
  const text = rendered.plainText.trim();
  return text ? { headline: text } : PLACEHOLDER_BRIEF;
}

function isMinorAgeBand(ageBand: FeatureVector['ageBand']): boolean {
  return ageBand === '0-9' || ageBand === '10-19';
}

function buildMinorStandardFallback(feature: FeatureVector): StandardFortuneText | null {
  if (!isMinorAgeBand(feature.ageBand)) return null;
  return { paragraphs: [MINOR_STANDARD_LIMITED_PARAGRAPH] };
}

function buildMinorExpertFallback(feature: FeatureVector): ExpertFortuneText | null {
  if (!isMinorAgeBand(feature.ageBand)) return null;
  return { paragraphs: [MINOR_EXPERT_LIMITED_PARAGRAPH] };
}

function buildExpertText(
  fragment: NarrativeFragment | null,
  rendered: TaggedParagraph,
  evidenceContext: NumericalEvidenceContext,
): ExpertFortuneText {
  if (!fragment) return PLACEHOLDER_EXPERT;
  const numericalEvidence = resolveNumericalEvidence(fragment, evidenceContext);
  return {
    paragraphs: rendered.tokens.length ? [rendered] : EMPTY_PARAGRAPHS,
    ...(numericalEvidence ? { numericalEvidence } : {}),
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

function selectedFragmentEvidence(fragment: NarrativeFragment | null): TieredSelectedFragmentEvidence | undefined {
  if (!fragment) return undefined;
  const gating = Object.fromEntries(
    Object.entries(fragment.gating ?? {})
      .filter(([, values]) => Array.isArray(values) && values.length > 0)
      .map(([key, values]) => [key, values]),
  ) as Readonly<Record<string, readonly string[]>>;
  return {
    fragmentId: fragment.fragmentId,
    gating,
    tags: fragment.tags,
  };
}

function buildSelectedFragments(
  briefFrag: NarrativeFragment | null,
  standardFrag: NarrativeFragment | null,
  expertFrag: NarrativeFragment | null,
): TieredSelectedFragments | undefined {
  const brief = selectedFragmentEvidence(briefFrag);
  const standard = selectedFragmentEvidence(standardFrag);
  const expert = selectedFragmentEvidence(expertFrag);
  if (!brief && !standard && !expert) return undefined;
  return {
    ...(brief ? { brief } : {}),
    ...(standard ? { standard } : {}),
    ...(expert ? { expert } : {}),
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
  const grade = gradeCell(fortuneElement, yongshin, heeshin, gishin);
  const hasAnyFragment = Boolean(briefFrag || standardFrag || expertFrag);

  const brief = briefRender ? deriveBrief(briefRender) : PLACEHOLDER_BRIEF;
  const standard = standardFrag
    ? buildStandardText(standardFrag, standardRender ?? { tokens: [], plainText: '' })
    : (hasAnyFragment ? (buildMinorStandardFallback(feature) ?? PLACEHOLDER_STANDARD) : PLACEHOLDER_STANDARD);
  const expert = expertFrag
    ? buildExpertText(expertFrag, expertRender ?? { tokens: [], plainText: '' }, {
      feature,
      cell: { stars: grade.stars },
    })
    : (hasAnyFragment ? (buildMinorExpertFallback(feature) ?? PLACEHOLDER_EXPERT) : PLACEHOLDER_EXPERT);
  const selectedFragments = buildSelectedFragments(briefFrag, standardFrag, expertFrag);

  // Cell with no fragment matches at all becomes 'na'.
  if (!hasAnyFragment) {
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
    ...(selectedFragments ? { selectedFragments } : {}),
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
  readonly namingReport?: NamingReport | null;
}

function buildNamingEvidence(namingReport: NamingReport | null | undefined): TieredNamingEvidence | undefined {
  const fourFrame = namingReport?.analysis?.fourFrame;
  if (!fourFrame || !Array.isArray(fourFrame.frames) || fourFrame.frames.length === 0) return undefined;
  const frames = fourFrame.frames;

  return {
    source: 'spring-ts.namingReport.analysis.fourFrame',
    fourFrameScore: namingReport?.scores?.fourFrame ?? 0,
    luckScore: fourFrame.luckScore,
    elementScore: fourFrame.elementScore,
    frames: frames.map((frame): TieredNameFrameEvidence => {
      const stage = NAME_FRAME_STAGE[frame.type];
      return {
        source: 'seed-ts.fourframe',
        stage: stage.stage,
        label: stage.label,
        frameType: frame.type,
        strokeSum: frame.strokeSum,
        element: frame.element,
        polarity: frame.polarity,
        luckyLevel: frame.luckyLevel,
        ...(frame.meaning?.title ? { title: frame.meaning.title } : {}),
        ...(frame.meaning?.summary ? { summary: frame.meaning.summary } : {}),
        ...(frame.meaning?.life_period_influence !== undefined
          ? { lifePeriodInfluence: frame.meaning.life_period_influence }
          : {}),
      };
    }),
  };
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
  const namingEvidence = buildNamingEvidence(options.namingReport);

  const meta: TieredMatrixMeta = {
    schemaVersion: 'spring-ts.tiered-matrix.v1',
    generatedAt: new Date().toISOString(),
    selectionSeed: seedKey,
    templateContractVersion: '1.0.0',
    contentSource: options.contentSource ?? registry.contentSource,
    fragmentCount: registry.totalFragmentCount,
    aiGeneratedFragmentCount: registry.totalFragmentCount,
  };

  return {
    schemaVersion: 'spring-ts.tiered-matrix.v1',
    periods,
    glossary,
    ...(namingEvidence ? { namingEvidence } : {}),
    meta,
  };
}
