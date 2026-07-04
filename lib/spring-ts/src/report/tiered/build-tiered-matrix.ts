/**
 * build-tiered-matrix.ts -- Top-level tiered matrix orchestrator
 *
 * Returns `undefined` (the opt-in default) when the caller did not enable
 * `precisionConfig.surfaceTieredMatrix`. Otherwise assembles a full
 * 5 periods × (1 overall + 10 categories) matrix with three depth tiers
 * per cell, an inline-tag glossary, and selection metadata.
 *
 * Content comes from the article engine (`data/articles/**` via
 * article-registry/-selector/-renderer): each cell renders ONE complete,
 * human-reviewed piece of writing. There is no fragment assembly and no
 * post-hoc text rewriting — see PLAN_ARTICLE_REWRITE.md.
 */

import type { SajuSummary, BirthInfo, NamingReport, NamingReportFrame, SourceTierMetadata } from '../../types.js';
import type {
  AgeBandScopedFortunes,
  BriefFortuneText,
  ElementCode,
  ExpertFortuneText,
  FortuneTieredMatrix,
  NumericalEvidenceRow,
  PeriodScopedFortunes,
  StandardFortuneText,
  TaggedParagraph,
  TieredCategoryId,
  TieredFortune,
  TieredLifeStageBand,
  TieredMatrixMeta,
  TieredNameFrameEvidence,
  TieredNamingEvidence,
  TieredPeriodKind,
  TieredSelectedFragments,
} from '../types.js';
import type { GlossaryEntry, TagId } from '../types.js';

import { buildFeatureVector, buildFeatureVectorForAge, type FeatureVector } from './feature-selector.js';
import { loadArticleRegistry, type Article, type ArticleAudience, type ArticleRegistry } from './article-registry.js';
import {
  bandFromStars,
  buildSelectionSeed,
  deriveAudience,
  selectArticle,
  stageAudienceForLifeBand,
} from './article-selector.js';
import {
  buildSlotValues,
  extractTagIds,
  renderArticleLine,
  renderArticleParagraphs,
  type ArticleSlotValues,
} from './article-renderer.js';
import { gradeCell, gradeToStars } from './cell-grader.js';
import { buildPersonalReading } from './personal-reading.js';
import { buildPeriodMeta, periodFortuneElement } from './period-meta-builder.js';
import { loadGlossary } from './glossary-loader.js';
import { buildTagGlossary } from './tag-inliner.js';
import {
  BRANCH_BY_CODE,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATED_BY,
  ELEMENT_GENERATES,
  getElementRelation,
  STEM_BY_CODE,
} from '../common/elementMaps.js';

const PERIOD_ORDER: readonly TieredPeriodKind[] = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];
const CATEGORY_ORDER: readonly TieredCategoryId[] = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
];

type CellGrade = ReturnType<typeof gradeCell>;

interface CategoryElements {
  readonly primary: ElementCode;
  readonly secondary?: ElementCode | null;
}

interface DaeunPillarLike {
  readonly stem: string;
  readonly branch: string;
  readonly startAge: number;
  readonly endAge: number;
}

interface LifeStageBandSpec {
  readonly key: TieredLifeStageBand;
  readonly label: string;
  readonly startAge: number;
  readonly endAge: number;
  readonly representativeAge: number;
}

const LIFE_STAGE_BANDS: readonly LifeStageBandSpec[] = Object.freeze([
  { key: '10-19', label: '10~19세', startAge: 10, endAge: 19, representativeAge: 15 },
  { key: '20-29', label: '20~29세', startAge: 20, endAge: 29, representativeAge: 25 },
  { key: '30-39', label: '30~39세', startAge: 30, endAge: 39, representativeAge: 35 },
  { key: '40-49', label: '40~49세', startAge: 40, endAge: 49, representativeAge: 45 },
  { key: '50-59', label: '50~59세', startAge: 50, endAge: 59, representativeAge: 55 },
  { key: '60-69', label: '60~69세', startAge: 60, endAge: 69, representativeAge: 65 },
  { key: '70-79', label: '70~79세', startAge: 70, endAge: 79, representativeAge: 75 },
  { key: '80-89', label: '80~89세', startAge: 80, endAge: 89, representativeAge: 85 },
  { key: '90-99', label: '90~99세', startAge: 90, endAge: 99, representativeAge: 95 },
  { key: '100-109', label: '100~109세', startAge: 100, endAge: 109, representativeAge: 105 },
]);

const EMPTY_PARAGRAPHS: readonly TaggedParagraph[] = Object.freeze([]);

const PLACEHOLDER_BRIEF: BriefFortuneText = Object.freeze({ headline: '준비 중인 항목이에요.' });
const PLACEHOLDER_STANDARD: StandardFortuneText = Object.freeze({ paragraphs: EMPTY_PARAGRAPHS });
const PLACEHOLDER_EXPERT: ExpertFortuneText = Object.freeze({ paragraphs: EMPTY_PARAGRAPHS });

const ELEMENT_NAME_KO: Record<ElementCode, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

function categoryElements(category: TieredCategoryId, dayMasterElement: ElementCode | null): CategoryElements | null {
  if (!dayMasterElement) return null;

  const wealth = ELEMENT_CONTROLS[dayMasterElement];
  const resource = ELEMENT_GENERATED_BY[dayMasterElement];
  const output = ELEMENT_GENERATES[dayMasterElement];
  const authority = ELEMENT_CONTROLLED_BY[dayMasterElement];

  switch (category) {
    case 'wealth':
      return { primary: wealth };
    case 'health':
      return { primary: resource };
    case 'academic':
      return { primary: output, secondary: resource };
    case 'romance':
      return { primary: wealth, secondary: authority };
    case 'family':
      return { primary: resource, secondary: dayMasterElement };
    case 'career':
      return { primary: authority, secondary: wealth };
    case 'study_document':
      return { primary: resource, secondary: output };
    case 'expression_children':
      return { primary: output };
    case 'health_stress':
      return { primary: resource, secondary: authority };
    case 'movement':
      return { primary: output, secondary: dayMasterElement };
  }
}

function relationGrade(fortuneElement: ElementCode, targetElement: ElementCode): number {
  const relation = getElementRelation(fortuneElement, targetElement);
  if (relation === 'same') return 5;
  if (relation === 'generates') return 4;
  if (relation === 'generated_by') return 3;
  if (relation === 'controls') return 2;
  if (relation === 'controlled_by') return 1;
  return 3;
}

function categoryAlignmentGrade(fortuneElement: ElementCode, elements: CategoryElements): number {
  const grades = [relationGrade(fortuneElement, elements.primary)];
  if (elements.secondary) grades.push(relationGrade(fortuneElement, elements.secondary));
  return grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
}

function gradeCategoryCell(
  category: TieredCategoryId,
  fortuneElement: ElementCode | null,
  feature: FeatureVector,
): CellGrade {
  const baseGrade = gradeCell(
    fortuneElement,
    feature.yongshinElement,
    feature.heeshinElement,
    feature.gishinElement,
  );
  const elements = categoryElements(category, feature.dayMasterElement);
  if (!fortuneElement || !elements || baseGrade.stars === null) return baseGrade;

  const categoryGrade = categoryAlignmentGrade(fortuneElement, elements);
  const blendedGrade = (categoryGrade * 0.6) + (baseGrade.grade * 0.4);
  const roundedGrade = Math.max(1, Math.min(5, Math.round(blendedGrade)));

  return {
    grade: blendedGrade,
    stars: gradeToStars(roundedGrade),
    meaningfulness: roundedGrade === 3 ? 'limited' : 'meaningful',
  };
}

function extractDaeunPillars(saju: SajuSummary): readonly DaeunPillarLike[] {
  const raw = (saju as Record<string, unknown>).daeunInfo;
  if (!raw || typeof raw !== 'object') return [];
  const pillars = (raw as Record<string, unknown>).pillars;
  if (!Array.isArray(pillars)) return [];

  return pillars
    .map((pillar): DaeunPillarLike | null => {
      if (!pillar || typeof pillar !== 'object') return null;
      const data = pillar as Record<string, unknown>;
      const stem = typeof data.stem === 'string' ? data.stem : '';
      const branch = typeof data.branch === 'string' ? data.branch : '';
      const startAge = typeof data.startAge === 'number' ? data.startAge : Number(data.startAge);
      const endAge = typeof data.endAge === 'number' ? data.endAge : Number(data.endAge);
      if (!stem || !branch || !Number.isFinite(startAge) || !Number.isFinite(endAge)) return null;
      return { stem, branch, startAge, endAge };
    })
    .filter((pillar): pillar is DaeunPillarLike => Boolean(pillar))
    .sort((a, b) => a.startAge - b.startAge);
}

function elementFromStemOrBranch(stem: string, branch: string): ElementCode | null {
  const stemCode = stem.trim().toUpperCase();
  const branchCode = branch.trim().toUpperCase();
  return STEM_BY_CODE[stemCode]?.element
    ?? BRANCH_BY_CODE[branchCode]?.element
    ?? null;
}

function lifeFortuneElementForAge(saju: SajuSummary, representativeAge: number): ElementCode | null {
  const pillars = extractDaeunPillars(saju);
  if (!pillars.length) return null;

  const matched = pillars.find((pillar) => (
    representativeAge >= pillar.startAge && representativeAge <= pillar.endAge
  )) ?? pillars.find((pillar) => representativeAge <= pillar.endAge) ?? pillars[pillars.length - 1];

  return matched ? elementFromStemOrBranch(matched.stem, matched.branch) : null;
}

// ---------------------------------------------------------------------------
// Numerical evidence — deterministic chart facts (no enum ordinals)
// ---------------------------------------------------------------------------

const EVIDENCE_SOURCE_TIER: SourceTierMetadata = Object.freeze({
  tier: 'T3_INTERNAL_ENGINE',
  sourceType: 'internal_scoring_policy',
  sourceUrl: null,
  accessedAt: '2026-07-04',
  quoteShort: null,
  humanInterpretation: 'spring-ts 계산 결과에서 확정적으로 산출한 내부 수치예요.',
  copyrightNote: '외부 문장을 복사하지 않고 내부 수치만 사용했어요.',
  authorityTruthEligible: false,
}) as SourceTierMetadata;

function elementCountOf(feature: FeatureVector, element: ElementCode | null): number | null {
  switch (element) {
    case 'WOOD': return feature.woodCount;
    case 'FIRE': return feature.fireCount;
    case 'EARTH': return feature.earthCount;
    case 'METAL': return feature.metalCount;
    case 'WATER': return feature.waterCount;
    default: return null;
  }
}

/** Real, reader-meaningful numbers derived from the chart itself. */
function buildNumericalEvidence(
  feature: FeatureVector,
  fortuneElement: ElementCode | null,
): readonly NumericalEvidenceRow[] | undefined {
  const rows: NumericalEvidenceRow[] = [];

  if (Number.isFinite(feature.ageYears) && feature.ageYears >= 0) {
    rows.push({ label: '현재 나이', value: feature.ageYears, unit: '세', sourceTier: EVIDENCE_SOURCE_TIER });
  }

  const dayMasterCount = elementCountOf(feature, feature.dayMasterElement);
  if (feature.dayMasterElement && dayMasterCount !== null) {
    rows.push({
      label: `사주 안의 일간 오행(${ELEMENT_NAME_KO[feature.dayMasterElement]}) 개수`,
      value: dayMasterCount,
      unit: '개',
      sourceTier: EVIDENCE_SOURCE_TIER,
    });
  }

  const yongshinCount = elementCountOf(feature, feature.yongshinElement);
  if (feature.yongshinElement && yongshinCount !== null) {
    rows.push({
      label: `사주 안의 용신 오행(${ELEMENT_NAME_KO[feature.yongshinElement]}) 개수`,
      value: yongshinCount,
      unit: '개',
      sourceTier: EVIDENCE_SOURCE_TIER,
    });
  }

  if (fortuneElement && feature.yongshinElement) {
    rows.push({
      label: '이 기간 중심 오행과 용신의 조화 등급(1~5)',
      value: relationGrade(fortuneElement, feature.yongshinElement),
      unit: '등급',
      sourceTier: EVIDENCE_SOURCE_TIER,
    });
  }

  return rows.length ? rows : undefined;
}

// ---------------------------------------------------------------------------
// Cell construction from articles
// ---------------------------------------------------------------------------

function placeholderCell(): TieredFortune {
  return {
    meaningfulness: 'na',
    stars: null,
    brief: PLACEHOLDER_BRIEF,
    standard: PLACEHOLDER_STANDARD,
    expert: PLACEHOLDER_EXPERT,
  };
}

function buildSelectedArticleTrace(article: Article, tags: readonly TagId[]): TieredSelectedFragments {
  const base = {
    fragmentId: article.articleId,
    gating: {
      audience: [article.audience],
      band: [article.band],
    } as Readonly<Record<string, readonly string[]>>,
  };
  // brief/standard render no tags (tags are expert-only, enforced by the
  // article gate), so their traces carry empty tag lists; only the expert
  // trace mirrors the article's glossary tags — which is the sole tag field
  // the frontend consumes.
  return {
    brief: { ...base, tags: [] },
    standard: { ...base, tags: [] },
    expert: { ...base, tags },
  };
}

function buildCell(
  category: 'overall' | TieredCategoryId,
  period: TieredPeriodKind,
  registry: ArticleRegistry,
  glossary: Readonly<Record<TagId, GlossaryEntry>>,
  feature: FeatureVector,
  seedKey: string,
  periodLabel: string,
  fortuneElement: ElementCode | null,
  grade: CellGrade,
  audienceOverride?: ArticleAudience,
): TieredFortune {
  const audience = audienceOverride ?? deriveAudience(feature.ageBand);
  const band = bandFromStars(grade.stars);
  const article = selectArticle(registry, category, period, audience, band, seedKey);
  if (!article) return placeholderCell();

  const slots: ArticleSlotValues = buildSlotValues(periodLabel, feature);

  const headline = renderArticleLine(article.summary, slots);
  const hook = article.hook ? renderArticleLine(article.hook, slots) : undefined;
  const brief: BriefFortuneText = hook ? { headline, hook } : { headline };

  const bodyParagraphs = renderArticleParagraphs(article.body, slots, glossary);
  const livingTips = (article.livingTips ?? []).map((tip) => renderArticleLine(tip, slots)).filter(Boolean);
  const cautions = (article.cautions ?? []).map((caution) => renderArticleLine(caution, slots)).filter(Boolean);
  const standard: StandardFortuneText = {
    paragraphs: bodyParagraphs.length ? bodyParagraphs : EMPTY_PARAGRAPHS,
    ...(livingTips.length ? { livingTips } : {}),
    ...(cautions.length ? { cautions } : {}),
  };

  const expertParagraphs = renderArticleParagraphs(article.expert, slots, glossary);
  const numericalEvidence = buildNumericalEvidence(feature, fortuneElement);
  const expert: ExpertFortuneText = {
    paragraphs: expertParagraphs.length ? expertParagraphs : EMPTY_PARAGRAPHS,
    ...(numericalEvidence ? { numericalEvidence } : {}),
  };

  const tags = extractTagIds(article.expert);

  return {
    meaningfulness: grade.meaningfulness,
    stars: grade.stars,
    brief,
    standard,
    expert,
    selectedFragments: buildSelectedArticleTrace(article, tags),
  };
}

function buildPeriodScoped(
  period: TieredPeriodKind,
  registry: ArticleRegistry,
  glossary: Readonly<Record<TagId, GlossaryEntry>>,
  feature: FeatureVector,
  seedKey: string,
  targetDate: Date,
  periodLabelOverride?: string,
  fortuneElementOverride?: ElementCode | null,
  audienceOverride?: ArticleAudience,
): PeriodScopedFortunes {
  const meta = buildPeriodMeta(period, targetDate);
  const periodLabel = periodLabelOverride ?? meta.label;
  const fortuneElement = fortuneElementOverride
    ?? (period === 'life' ? feature.dayMasterElement : periodFortuneElement(period, targetDate));
  const overallGrade = gradeCell(
    fortuneElement,
    feature.yongshinElement,
    feature.heeshinElement,
    feature.gishinElement,
  );

  const overall = buildCell(
    'overall',
    period,
    registry,
    glossary,
    feature,
    seedKey,
    periodLabel,
    fortuneElement,
    overallGrade,
    audienceOverride,
  );

  const byCategory = {} as Record<TieredCategoryId, TieredFortune>;
  for (const cat of CATEGORY_ORDER) {
    const categoryGrade = gradeCategoryCell(cat, fortuneElement, feature);
    byCategory[cat] = buildCell(
      cat,
      period,
      registry,
      glossary,
      feature,
      seedKey,
      periodLabel,
      fortuneElement,
      categoryGrade,
      audienceOverride,
    );
  }

  return {
    periodKind: period,
    periodLabel,
    periodMeta: meta.meta,
    overall,
    byCategory,
  };
}

function buildAgeBandScoped(
  saju: SajuSummary,
  band: LifeStageBandSpec,
  registry: ArticleRegistry,
  glossary: Readonly<Record<TagId, GlossaryEntry>>,
  feature: FeatureVector,
  seedKey: string,
  targetDate: Date,
): AgeBandScopedFortunes {
  const fortuneElement = lifeFortuneElementForAge(saju, band.representativeAge) ?? feature.dayMasterElement;
  const scoped = buildPeriodScoped(
    'life',
    registry,
    glossary,
    feature,
    seedKey,
    targetDate,
    band.label,
    fortuneElement,
    stageAudienceForLifeBand(band.key),
  );
  return {
    ...scoped,
    periodKind: 'life',
    ageBand: band.key,
    selectorAgeBand: feature.ageBand,
    startAge: band.startAge,
    endAge: band.endAge,
    representativeAge: band.representativeAge,
  };
}

function placeholderAgeBandScoped(
  band: LifeStageBandSpec,
  feature: FeatureVector,
  targetDate: Date,
): AgeBandScopedFortunes {
  const meta = buildPeriodMeta('life', targetDate);
  const byCategory = {} as Record<TieredCategoryId, TieredFortune>;
  for (const cat of CATEGORY_ORDER) byCategory[cat] = placeholderCell();
  return {
    periodKind: 'life',
    periodLabel: band.label,
    periodMeta: meta.meta,
    overall: placeholderCell(),
    byCategory,
    ageBand: band.key,
    selectorAgeBand: feature.ageBand,
    startAge: band.startAge,
    endAge: band.endAge,
    representativeAge: band.representativeAge,
  };
}

function buildLifeByAgeBand(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
  registry: ArticleRegistry,
  glossary: Readonly<Record<TagId, GlossaryEntry>>,
  seedKey: string,
  subjectIsMinor: boolean,
): Record<TieredLifeStageBand, AgeBandScopedFortunes> {
  const byAgeBand = {} as Record<TieredLifeStageBand, AgeBandScopedFortunes>;
  for (const band of LIFE_STAGE_BANDS) {
    const feature = buildFeatureVectorForAge(saju, birth, targetDate, band.representativeAge);
    // Minor subjects only receive their own life-stage band; adult-stage
    // guidance (투자·이직·결혼 등) is not rendered into a minor's payload.
    // This replaces the retired minor-audience-sanitizer with an
    // authoring-time guarantee (see ARTICLE_STYLE_CONTRACT §6).
    const stageAudience = stageAudienceForLifeBand(band.key);
    if (subjectIsMinor && stageAudience !== 'stage-teen') {
      byAgeBand[band.key] = placeholderAgeBandScoped(band, feature, targetDate);
      continue;
    }
    byAgeBand[band.key] = buildAgeBandScoped(saju, band, registry, glossary, feature, seedKey, targetDate);
  }
  return byAgeBand;
}

export interface BuildTieredMatrixOptions {
  readonly enabled?: boolean;
  readonly contentSource?: 'placeholder' | 'authored';
  readonly namingReport?: NamingReport | null;
}

const NAME_FRAME_STAGE: Record<NamingReportFrame['type'], { stage: TieredNameFrameEvidence['stage']; label: string }> = {
  won: { stage: 'earlyLife', label: '초년운' },
  hyung: { stage: 'youthLife', label: '청년운' },
  lee: { stage: 'middleLife', label: '중년운' },
  jung: { stage: 'lateAndTotal', label: '말년/총운' },
};

function buildNamingEvidence(namingReport: NamingReport | null | undefined): TieredNamingEvidence | undefined {
  const fourFrame = namingReport?.analysis?.fourFrame;
  if (!fourFrame || !Array.isArray(fourFrame.frames) || fourFrame.frames.length === 0) return undefined;
  const frames = fourFrame.frames;
  const seenLifePeriodInfluence = new Set<string>();

  return {
    source: 'spring-ts.namingReport.analysis.fourFrame',
    fourFrameScore: namingReport?.scores?.fourFrame ?? 0,
    luckScore: fourFrame.luckScore,
    elementScore: fourFrame.elementScore,
    frames: frames.map((frame): TieredNameFrameEvidence => {
      const stage = NAME_FRAME_STAGE[frame.type];
      const lifePeriodInfluence = frame.meaning?.life_period_influence;
      const shouldSurfaceLifePeriodInfluence =
        typeof lifePeriodInfluence === 'string' &&
        lifePeriodInfluence.trim().length > 0 &&
        !seenLifePeriodInfluence.has(lifePeriodInfluence);
      if (shouldSurfaceLifePeriodInfluence) seenLifePeriodInfluence.add(lifePeriodInfluence);
      return {
        source: 'seed-ts.fourframe',
        stage: stage.stage,
        label: stage.label,
        frameType: frame.type,
        strokeSum: frame.strokeSum,
        element: frame.element,
        ...(frame.elementLabel ? { elementLabel: frame.elementLabel } : {}),
        polarity: frame.polarity,
        luckyLevel: frame.luckyLevel,
        ...(frame.meaning?.title ? { title: frame.meaning.title } : {}),
        ...(frame.meaning?.summary ? { summary: frame.meaning.summary } : {}),
        ...(shouldSurfaceLifePeriodInfluence
          ? { lifePeriodInfluence }
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
  const registry = loadArticleRegistry();
  const allGlossaryEntries = loadGlossary();
  const seedKey = buildSelectionSeed(birth, targetDate);

  const subjectIsMinor = deriveAudience(feature.ageBand) !== 'adult';
  const periods = {} as Record<TieredPeriodKind, PeriodScopedFortunes>;
  for (const period of PERIOD_ORDER) {
    const scoped = buildPeriodScoped(period, registry, allGlossaryEntries, feature, seedKey, targetDate);
    periods[period] = period === 'life'
      ? { ...scoped, byAgeBand: buildLifeByAgeBand(saju, birth, targetDate, registry, allGlossaryEntries, seedKey, subjectIsMinor) }
      : scoped;
  }

  const glossary = buildTagGlossary({ periods }, allGlossaryEntries);
  const namingEvidence = buildNamingEvidence(options.namingReport);

  // A1 cross-cell synthesis — one plain-language profile from the person's
  // measured category grades (life period = structural, uses the day-master
  // element). Jargon-free; names the person's strong/weak life areas.
  const lifeByCategory = periods.life?.byCategory;
  const categoryStars: Partial<Record<TieredCategoryId, number | null>> = {};
  if (lifeByCategory) {
    for (const cat of CATEGORY_ORDER) categoryStars[cat] = lifeByCategory[cat]?.stars ?? null;
  }
  const personalReading = buildPersonalReading({
    categoryStars,
    strengthPlain: buildSlotValues('', feature).strengthPlain,
  });

  const meta: TieredMatrixMeta = {
    schemaVersion: 'spring-ts.tiered-matrix.v1',
    generatedAt: new Date().toISOString(),
    selectionSeed: seedKey,
    templateContractVersion: 'article-v1',
    contentSource: options.contentSource ?? (registry.totalArticleCount > 0 ? 'authored' : 'placeholder'),
    fragmentCount: registry.totalArticleCount,
    aiGeneratedFragmentCount: registry.aiGeneratedCount,
  };

  return {
    schemaVersion: 'spring-ts.tiered-matrix.v1',
    periods,
    glossary,
    ...(namingEvidence ? { namingEvidence } : {}),
    ...(personalReading ? { personalReading } : {}),
    meta,
  };
}
