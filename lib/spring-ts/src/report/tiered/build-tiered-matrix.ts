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
import { normalizeRenderedText, renderFragment, renderFragmentParagraphs, type RenderContext } from './template-engine.js';
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

const CATEGORY_LABEL: Record<'overall' | TieredCategoryId, string> = {
  overall: '전체 흐름',
  wealth: '돈과 물건 관리',
  health: '몸과 마음',
  academic: '공부 흐름',
  romance: '관계와 마음',
  family: '가족 관계',
  career: '진로 감각',
  study_document: '기록과 준비',
  expression_children: '표현과 창의력',
  health_stress: '긴장과 회복',
  movement: '이동과 변화',
};

const MINOR_STANDARD_LIMITED_PARAGRAPH: TaggedParagraph = Object.freeze({
  tokens: [
    {
      kind: 'text',
      value: '지금은 결과를 단정하기보다 학교, 친구, 가족, 컨디션처럼 가까운 생활을 안정시키는 해석이 먼저예요. 작은 약속을 지키고, 큰 결정은 가까운 어른과 함께 확인해 주세요.',
    },
  ] as const,
  plainText: '지금은 결과를 단정하기보다 학교, 친구, 가족, 컨디션처럼 가까운 생활을 안정시키는 해석이 먼저예요. 작은 약속을 지키고, 큰 결정은 가까운 어른과 함께 확인해 주세요.',
});

const MINOR_EXPERT_LIMITED_PARAGRAPHS: readonly TaggedParagraph[] = Object.freeze([
  Object.freeze({
    tokens: [
      {
        kind: 'text',
        value: '이 항목은 나이가 어린 독자에게 결과를 단정적으로 풀이하지 않아요. 같은 흐름이라도 아이가 자라는 속도, 가정과 학교의 환경, 그날그날의 컨디션에 따라 의미가 크게 달라지기 때문이에요.',
      },
    ] as const,
    plainText: '이 항목은 나이가 어린 독자에게 결과를 단정적으로 풀이하지 않아요. 같은 흐름이라도 아이가 자라는 속도, 가정과 학교의 환경, 그날그날의 컨디션에 따라 의미가 크게 달라지기 때문이에요.',
  }),
  Object.freeze({
    tokens: [
      { kind: 'text', value: '전문 해석에서 자주 쓰는 ' },
      { kind: 'tag', tagId: 'dayPillar', label: '일주' },
      { kind: 'text', value: '와 ' },
      { kind: 'tag', tagId: 'yongshin', label: '용신' },
      {
        kind: 'text',
        value: ' 같은 지표는 성격과 흐름을 가늠하는 참고선일 뿐, 어린 시기의 결과를 못 박는 단서로 쓰면 안 돼요.',
      },
    ] as const,
    plainText: '전문 해석에서 자주 쓰는 #일주와 #용신 같은 지표는 성격과 흐름을 가늠하는 참고선일 뿐, 어린 시기의 결과를 못 박는 단서로 쓰면 안 돼요.',
  }),
  Object.freeze({
    tokens: [
      {
        kind: 'text',
        value: '그래서 같은 ',
      },
      { kind: 'tag', tagId: 'dayPillar', label: '일주' },
      {
        kind: 'text',
        value: '라도 성장 과정, 보호자 관찰, 실제 생활 환경을 함께 살피는 자료로 받아 주세요. 아이의 표정, 말투, 잠과 식사 같은 일상 신호가 사주 지표보다 더 정확한 단서가 되는 시기예요.',
      },
    ] as const,
    plainText: '그래서 같은 #일주라도 성장 과정, 보호자 관찰, 실제 생활 환경을 함께 살피는 자료로 받아 주세요. 아이의 표정, 말투, 잠과 식사 같은 일상 신호가 사주 지표보다 더 정확한 단서가 되는 시기예요.',
  }),
  Object.freeze({
    tokens: [
      {
        kind: 'text',
        value: '큰 결정은 보호자가 시간을 두고 가까운 어른과 함께 확인해 주세요. 사주 해석은 한쪽 참고 자료로만 두고, 학교·의료·상담 같은 실제 지원 경로를 우선 활용하면 흐름을 더 안전하게 끌어갈 수 있어요.',
      },
    ] as const,
    plainText: '큰 결정은 보호자가 시간을 두고 가까운 어른과 함께 확인해 주세요. 사주 해석은 한쪽 참고 자료로만 두고, 학교·의료·상담 같은 실제 지원 경로를 우선 활용하면 흐름을 더 안전하게 끌어갈 수 있어요.',
  }),
]);

const NAME_FRAME_STAGE: Record<NamingReportFrame['type'], { stage: TieredNameFrameEvidence['stage']; label: string }> = {
  won: { stage: 'earlyLife', label: '초년운' },
  hyung: { stage: 'youthLife', label: '청년운' },
  lee: { stage: 'middleLife', label: '중년운' },
  jung: { stage: 'lateAndTotal', label: '말년/총운' },
};

/**
 * Maximum Korean code-point count for a brief-tier hook (P13-A1).
 * Style-guide §2-1 frames the hook as a single 보조 sentence — keeping it
 * tight prevents the brief tier from drifting into standard-tier prose.
 * Aligned with the `livingTips ≤ 24` bound in NARRATIVE_STYLE_GUIDE.md and
 * the contract example `큰 무리수만 피하면 든든히 모을 수 있어요.` (22 chars).
 */
const BRIEF_HOOK_MAX_LEN = 24;

/**
 * Sanitize and length-gate an authored hook string. Returns the
 * normalized string if it survives both passes, otherwise undefined so
 * callers can omit the optional `BriefFortuneText.hook` field cleanly.
 *
 * Length is measured in code points (`[...s].length`) for parity with
 * `compressBriefHeadlineIfApplicable`, which uses the same convention.
 */
function deriveBriefHook(hook: string | undefined): string | undefined {
  if (typeof hook !== 'string') return undefined;
  const normalized = normalizeRenderedText(hook).trim();
  if (normalized.length === 0) return undefined;
  if ([...normalized].length > BRIEF_HOOK_MAX_LEN) return undefined;
  return normalized;
}

function deriveBrief(
  rendered: TaggedParagraph,
  fragment: NarrativeFragment | null,
): BriefFortuneText {
  const text = rendered.plainText.trim();
  if (!text) return PLACEHOLDER_BRIEF;
  const hook = deriveBriefHook(fragment?.hook);
  return hook ? { headline: text, hook } : { headline: text };
}

function isMinorAgeBand(ageBand: FeatureVector['ageBand']): boolean {
  return ageBand === '0-9' || ageBand === '10-19';
}

function hasBatchimInText(value: string): boolean {
  for (let i = value.length - 1; i >= 0; i -= 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;
  }
  return false;
}

function withTopicParticle(value: string): string {
  const particleBasis = value.replace(/\s*\([^)]*\)\s*$/, '');
  return `${value}${hasBatchimInText(particleBasis) ? '은' : '는'}`;
}

function withPeriodScopedTopic(periodLabel: string, label: string): string {
  return `${periodLabel}의 ${withTopicParticle(label)}`;
}

function buildMinorBriefFallback(
  feature: FeatureVector,
  category: 'overall' | TieredCategoryId,
  periodLabel: string,
): BriefFortuneText | null {
  if (!isMinorAgeBand(feature.ageBand)) return null;
  const label = CATEGORY_LABEL[category];
  if (category === 'overall') {
    return {
      headline: `${withTopicParticle(periodLabel)} 생활 리듬을 잘 잡는 쪽이 좋아요.`,
    };
  }
  return {
    headline: `${withPeriodScopedTopic(periodLabel, label)} 작은 습관을 지키는 쪽이 좋아요.`,
  };
}

function buildMinorStandardFallback(
  feature: FeatureVector,
  category: 'overall' | TieredCategoryId = 'overall',
  periodLabel = '이 시기',
): StandardFortuneText | null {
  if (!isMinorAgeBand(feature.ageBand)) return null;
  const label = CATEGORY_LABEL[category];
  const plainText = category === 'overall'
    ? `${withTopicParticle(periodLabel)} 아직 방향을 단정하기보다 생활 리듬을 잘 잡는 해석이 먼저예요. 학교, 친구, 가족, 컨디션처럼 가까운 일들을 차분히 챙기면 ${periodLabel}의 흐름이 안정돼요. 큰 결정은 혼자 서두르지 말고 가까운 어른과 함께 확인해 주세요.`
    : `${withPeriodScopedTopic(periodLabel, label)} 아직 결과를 단정하기보다 작은 습관을 살피는 게 좋아요. 해야 할 일을 짧게 나누고, 힘들 때는 바로 도움을 요청하면 흐름이 안정돼요.`;
  return {
    paragraphs: [{
      tokens: [{ kind: 'text', value: plainText }],
      plainText,
    }],
  };
}

function buildMinorExpertFallback(feature: FeatureVector): ExpertFortuneText | null {
  if (!isMinorAgeBand(feature.ageBand)) return null;
  return { paragraphs: MINOR_EXPERT_LIMITED_PARAGRAPHS };
}

function buildMinorFallbackCell(
  feature: FeatureVector,
  category: 'overall' | TieredCategoryId,
  periodLabel: string,
  grade: ReturnType<typeof gradeCell>,
): TieredFortune | null {
  const brief = buildMinorBriefFallback(feature, category, periodLabel);
  const standard = buildMinorStandardFallback(feature, category, periodLabel);
  const expert = buildMinorExpertFallback(feature);
  if (!brief || !standard || !expert) return null;
  return {
    meaningfulness: 'limited',
    stars: grade.stars,
    brief,
    standard,
    expert,
  };
}

function buildExpertText(
  fragment: NarrativeFragment | null,
  rendered: readonly TaggedParagraph[],
  evidenceContext: NumericalEvidenceContext,
): ExpertFortuneText {
  if (!fragment) return PLACEHOLDER_EXPERT;
  const numericalEvidence = resolveNumericalEvidence(fragment, evidenceContext);
  // A paragraph counts as content-bearing if it has any tokens. The
  // splitter already drops fully-empty paragraphs, so this filter is
  // belt-and-braces — typical case is `rendered` already valid.
  const paragraphs = rendered.filter((p) => p.tokens.length > 0);
  return {
    paragraphs: paragraphs.length ? paragraphs : EMPTY_PARAGRAPHS,
    ...(numericalEvidence ? { numericalEvidence } : {}),
  };
}

function buildStandardText(
  fragment: NarrativeFragment | null,
  rendered: readonly TaggedParagraph[],
): StandardFortuneText {
  if (!fragment) return PLACEHOLDER_STANDARD;
  const paragraphs = rendered.filter((p) => p.tokens.length > 0);
  return {
    paragraphs: paragraphs.length ? paragraphs : EMPTY_PARAGRAPHS,
    ...(fragment.livingTips && fragment.livingTips.length
      ? { livingTips: fragment.livingTips.map((text) => normalizeRenderedText(text)) }
      : {}),
    ...(fragment.cautions && fragment.cautions.length
      ? { cautions: fragment.cautions.map((text) => normalizeRenderedText(text)) }
      : {}),
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
  const grade = gradeCell(fortuneElement, yongshin, heeshin, gishin);

  // P22-A1: previously a `MINOR_LIMITED_CATEGORIES` early-return forced
  // wealth/romance/study_document into `buildMinorFallbackCell` for
  // minor readers regardless of available authored fragments. Lifted so
  // every category goes through the standard `selectFragment` path; the
  // post-selection `hasAnyFragment` branch and per-tier
  // `buildMinor{Brief,Standard,Expert}Fallback` calls below still
  // provide age-appropriate fallbacks when no minor-gated fragment
  // matches.
  const briefFrag = selectFragment(registry, category, period, 'brief', feature, { seedKey });
  const standardFrag = selectFragment(registry, category, period, 'standard', feature, { seedKey });
  const expertFrag = selectFragment(registry, category, period, 'expert', feature, { seedKey });

  // Brief stays a concise headline — collapse any (rare/absent) `\n\n`
  // splits via `renderFragment` into a single paragraph for headline use.
  const briefRender = briefFrag ? renderFragment(briefFrag, ctx) : null;
  // Standard/Expert preserve `\n\n` paragraph boundaries from the source
  // narrative fragments (style guide §2-3 recommends 4-8 paragraphs for
  // expert depth; renderer collapsed everything to 1 prior to P9-A1).
  const standardRender = standardFrag ? renderFragmentParagraphs(standardFrag, ctx) : EMPTY_PARAGRAPHS;
  const expertRender = expertFrag ? renderFragmentParagraphs(expertFrag, ctx) : EMPTY_PARAGRAPHS;
  const hasAnyFragment = Boolean(briefFrag || standardFrag || expertFrag);

  const brief = briefRender ? deriveBrief(briefRender, briefFrag) : PLACEHOLDER_BRIEF;
  const standard = standardFrag
    ? buildStandardText(standardFrag, standardRender)
    : (hasAnyFragment ? (buildMinorStandardFallback(feature, category, periodLabel) ?? PLACEHOLDER_STANDARD) : PLACEHOLDER_STANDARD);
  const expert = expertFrag
    ? buildExpertText(expertFrag, expertRender, {
      feature,
      cell: { stars: grade.stars },
    })
    : (hasAnyFragment ? (buildMinorExpertFallback(feature) ?? PLACEHOLDER_EXPERT) : PLACEHOLDER_EXPERT);
  const selectedFragments = buildSelectedFragments(briefFrag, standardFrag, expertFrag);

  // Cell with no fragment matches at all becomes 'na'.
  if (!hasAnyFragment) {
    const minorFallback = buildMinorFallbackCell(feature, category, periodLabel, grade);
    if (minorFallback) return minorFallback;
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
