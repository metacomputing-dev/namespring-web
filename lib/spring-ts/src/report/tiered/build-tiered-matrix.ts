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
  AgeBandScopedFortunes,
  ElementCode,
  FortuneTieredMatrix,
  PeriodScopedFortunes,
  TieredCategoryId,
  TieredPeriodKind,
  TieredDepth,
  TieredFortune,
  TieredLifeStageBand,
  BriefFortuneText,
  StandardFortuneText,
  ExpertFortuneText,
  TieredSelectedFragmentEvidence,
  TieredSelectedFragments,
  TaggedParagraph,
  ParagraphToken,
  TieredMatrixMeta,
  TieredNameFrameEvidence,
  TieredNamingEvidence,
} from '../types.js';

import { buildFeatureVector, buildFeatureVectorForAge, type FeatureVector } from './feature-selector.js';
import { loadFragmentRegistry, type FragmentRegistry, type NarrativeFragment } from './fragment-registry.js';
import { selectFragment, buildSelectionSeed, type SelectionContext } from './fragment-selector.js';
import { normalizeRenderedText, renderFragment, renderFragmentParagraphs, type RenderContext } from './template-engine.js';
import { gradeCell, gradeToStars } from './cell-grader.js';
import { buildPeriodMeta, periodFortuneElement } from './period-meta-builder.js';
import { loadGlossary } from './glossary-loader.js';
import { buildTagGlossary } from './tag-inliner.js';
import { resolveNumericalEvidence, type NumericalEvidenceContext } from './numerical-evidence.js';
import { enhanceStandardDepth, type StandardDepthEnhancementContext } from './standard-depth-enhancer.js';
import { sanitizeTieredMatrixForMinorAudience } from './minor-audience-sanitizer.js';
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
  period: TieredPeriodKind,
  periodLabel: string,
  grade: ReturnType<typeof gradeCell>,
  readerAgeBand?: FeatureVector['ageBand'],
): TieredFortune | null {
  const brief = buildMinorBriefFallback(feature, category, periodLabel);
  const standard = buildMinorStandardFallback(feature, category, periodLabel);
  const expert = buildMinorExpertFallback(feature);
  if (!brief || !standard || !expert) return null;
  return {
    meaningfulness: 'limited',
    stars: grade.stars,
    brief,
    standard: enhanceStandardDepth(standard, {
      category,
      period,
      periodLabel,
      feature,
      stars: grade.stars,
      meaningfulness: 'limited',
      ...(readerAgeBand ? { readerAgeBand } : {}),
    }),
    expert,
  };
}

function polishStudyDocumentExpertText(value: string): string {
  let out = normalizeRenderedText(value);
  out = out
    .replace(/학습\/문서운/g, '기록·문서운')
    .replace(/학업·시험에서는/g, '자료·기록 해석에서는')
    .replace(/학업·시험/g, '자료·기록')
    .replace(/학습으로 또렷이 풀리는 시기예요/g, '자료를 읽고 정리하는 힘으로 드러나는 시기예요')
    .replace(/학습으로 또렷이 풀리는/g, '자료를 읽고 정리하는 힘으로 드러나는')
    .replace(/학습으로 또렷이/g, '자료 정리로 또렷이')
    .replace(/젊은 시기의 일진은/g, '오늘의 기록·문서운은')
    .replace(/젊은 시기의 한 주는/g, '이번 주 기록·문서운은')
    .replace(/젊은 시기의 한 달은/g, '이번 달 기록·문서운은')
    .replace(/젊은 시기의 한 해는/g, '올해 기록·문서운은')
    .replace(/젊은 시기의 자료·기록 해석에서는/g, '어린 시기와 학창 시절의 자료·기록 해석에서는')
    .replace(/오늘 남긴 확인 기준이 다음 자료 정리의 키가 돼요/g, '오늘 남긴 표시가 다음 자료를 찾는 기준이 돼요')
    .replace(/이번 주 남긴 확인 기준이 다음 자료 정리의 키가 돼요/g, '이번 주 남긴 표시가 다음 자료를 찾는 기준이 돼요')
    .replace(/한 달 동안 남긴 확인 기준이 다음 자료 정리의 키가 돼요/g, '한 달 동안 남긴 표시와 질문이 다음 자료를 찾는 기준이 돼요')
    .replace(/한 해 동안 남긴 확인 기준이 다음 기록 기준의 키가 돼요/g, '한 해 동안 남긴 표시와 보관 위치가 다음 기록을 정리할 기준이 돼요')
    .replace(/오늘 한 페이지의 깊이가 일주일 뒤의 든든함을 만들어요/g, '오늘 남긴 한 줄 표시가 일주일 뒤 다시 찾을 힘을 만들어요')
    .replace(/이번 주 한 페이지의 깊이가 다음 달의 든든함을 만들어요/g, '이번 주 남긴 자료 이름과 질문 표시가 다음 달 확인을 든든하게 만들어요')
    .replace(/이번 달 한 단원의 깊이가 다음 분기의 든든함을 만들어요/g, '이번 달 남긴 자료 이름과 질문 표시가 다음 분기의 확인을 든든하게 만들어요')
    .replace(/올해 한 트랙의 깊이가 다음 몇 년의 든든함을 만들어요/g, '올해 정한 보관 위치와 확인 순서가 다음 몇 년의 기록 관리를 든든하게 만들어요')
    .replace(/첫 자격·시험 한 번이 다음 10년의 방향을 정해 주는 시기라, 너무 많은 갈래보다는 한두 방향에 집중하는 페이스가 잘 맞아요\./g, '처음 익힌 보관 위치와 질문 표시가 다음 10년의 기록 습관으로 이어지기 쉬운 시기라, 너무 많은 갈래보다 한두 기준을 반복하는 페이스가 잘 맞아요.')
    .replace(/오늘 한 단원의 깊이가 다음 시험의 키가 돼요/g, '오늘 남긴 표시가 다음 자료를 찾는 기준이 돼요')
    .replace(/이번 주 한 단원의 깊이가 다음 시험의 키가 돼요/g, '이번 주 남긴 표시가 다음 자료를 찾는 기준이 돼요')
    .replace(/한 해의 한 트랙이 다음 시험·자격의 키가 돼요/g, '한 해 동안 남긴 표시와 보관 위치가 다음 기록을 정리할 기준이 돼요')
    .replace(/한 달의 한 단원이 다음 시험·자격의 키가 돼요/g, '한 달 동안 남긴 표시와 질문이 다음 자료를 찾는 기준이 돼요')
    .replace(/학교 과정보다 자기 호기심이 끄는 분야/g, '정해진 양식보다 직접 확인한 자료 흐름')
    .replace(/한 분야에 집중할 여유/g, '자료와 도구를 한곳에 모을 여유')
    .replace(/지식 입력과 결과물 산출/g, '자료 확인과 기록 정리')
    .replace(/지식 입력/g, '자료 확인')
    .replace(/커리큘럼/g, '검토 순서')
    .replace(/문서 산출/g, '기록 정리')
    .replace(/산출 속도/g, '기록으로 옮기는 속도')
    .replace(/문서 결과물의 생산성/g, '문서를 차근히 완성하는 힘')
    .replace(/월간 산출물/g, '월간 기록물')
    .replace(/기획과 재해석/g, '분류와 재확인')
    .replace(/기본 이해/g, '기본 자료 확인')
    .replace(/정리한 내용을 실행 가능한 문장/g, '확인한 내용을 실행 가능한 기록')
    .replace(/학문·시험/g, '문서·자격')
    .replace(/자기 자료에 더 깊이 들어가는 시간/g, '자료의 출처와 보관 기준을 더 깊이 확인하는 시간')
    .replace(/자기 호기심이 끄는 분야에서 더 깊이 들어가는 흐름/g, '직접 확인한 자료 흐름을 더 깊이 정리하는 흐름')
    .replace(/환경과 도구가 잘 맞춰져 있어, 자료와 도구를 한곳에 모을 여유/g, '환경과 도구가 잘 맞춰져 있어, 자료와 기록을 한곳에 모을 여유')
    .replace(/글·발표·기록으로 자기 학습을 드러내지/g, '글·메모·파일명으로 확인한 내용을 드러내지')
    .replace(/학습이 글·메모로 자연스럽게 남는 흐름이에요/g, '확인한 내용이 글·메모로 자연스럽게 남는 흐름이에요')
    .replace(/글·발표·기록으로 자기 학습이 또렷해지는 기회/g, '글·메모·파일명으로 확인한 내용이 또렷해지는 기회')
    .replace(/기본 자료 확인를/g, '기본 자료를 확인하고')
    .replace(/기본 자료 확인을 잡고/g, '기본 자료를 확인하고')
    .replace(/검토 순서을/g, '검토 순서를');
  return normalizeRenderedText(out);
}

function plainTextFromPolishedTokens(tokens: readonly ParagraphToken[]): string {
  return normalizeRenderedText(tokens
    .map((token) => token.kind === 'text' ? token.value : `#${token.label}`)
    .join('')
    .replace(/\s{2,}/g, ' '));
}

function polishStudyDocumentExpertParagraphs(
  fragment: NarrativeFragment,
  paragraphs: readonly TaggedParagraph[],
): readonly TaggedParagraph[] {
  if (fragment.axis.category !== 'study_document') return paragraphs;

  return paragraphs.map((paragraph) => {
    const tokens = paragraph.tokens.map((token) => token.kind === 'text'
      ? { ...token, value: polishStudyDocumentExpertText(token.value) }
      : token);
    const plainText = polishStudyDocumentExpertText(plainTextFromPolishedTokens(tokens));
    return { tokens, plainText };
  });
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
  const polishedParagraphs = polishStudyDocumentExpertParagraphs(fragment, paragraphs);
  return {
    paragraphs: polishedParagraphs.length ? polishedParagraphs : EMPTY_PARAGRAPHS,
    ...(numericalEvidence ? { numericalEvidence } : {}),
  };
}

function buildStandardText(
  fragment: NarrativeFragment | null,
  rendered: readonly TaggedParagraph[],
  enhancementContext: StandardDepthEnhancementContext,
): StandardFortuneText {
  if (!fragment) return PLACEHOLDER_STANDARD;
  const paragraphs = rendered.filter((p) => p.tokens.length > 0);
  const standard: StandardFortuneText = {
    paragraphs: paragraphs.length ? paragraphs : EMPTY_PARAGRAPHS,
    ...(fragment.livingTips && fragment.livingTips.length
      ? { livingTips: fragment.livingTips.map((text) => normalizeRenderedText(text)) }
      : {}),
    ...(fragment.cautions && fragment.cautions.length
      ? { cautions: fragment.cautions.map((text) => normalizeRenderedText(text)) }
      : {}),
  };
  return enhanceStandardDepth(standard, enhancementContext);
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
  fragmentSelection?: Pick<SelectionContext, 'preferGatingDimensions'>,
  gradeOverride?: CellGrade,
  readerAgeBand?: FeatureVector['ageBand'],
): TieredFortune {
  const ctx: RenderContext = { seedKey, periodLabel, feature };
  const selectionCtx: SelectionContext = fragmentSelection?.preferGatingDimensions?.length
    ? { seedKey, preferGatingDimensions: fragmentSelection.preferGatingDimensions }
    : { seedKey };
  const grade = gradeOverride ?? gradeCell(fortuneElement, yongshin, heeshin, gishin);

  // P22-A1: previously a `MINOR_LIMITED_CATEGORIES` early-return forced
  // wealth/romance/study_document into `buildMinorFallbackCell` for
  // minor readers regardless of available authored fragments. Lifted so
  // every category goes through the standard `selectFragment` path; the
  // post-selection `hasAnyFragment` branch and per-tier
  // `buildMinor{Brief,Standard,Expert}Fallback` calls below still
  // provide age-appropriate fallbacks when no minor-gated fragment
  // matches.
  const briefFrag = selectFragment(registry, category, period, 'brief', feature, selectionCtx);
  const standardFrag = selectFragment(registry, category, period, 'standard', feature, selectionCtx);
  const expertFrag = selectFragment(registry, category, period, 'expert', feature, selectionCtx);

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
  const standardEnhancementContext: StandardDepthEnhancementContext = {
    category,
    period,
    periodLabel,
    feature,
    stars: grade.stars,
    meaningfulness: grade.meaningfulness,
    ...(readerAgeBand ? { readerAgeBand } : {}),
  };
  const standard = standardFrag
    ? buildStandardText(standardFrag, standardRender, standardEnhancementContext)
    : (hasAnyFragment
      ? enhanceStandardDepth(
        buildMinorStandardFallback(feature, category, periodLabel) ?? PLACEHOLDER_STANDARD,
        standardEnhancementContext,
      )
      : PLACEHOLDER_STANDARD);
  const expert = expertFrag
    ? buildExpertText(expertFrag, expertRender, {
      feature,
      cell: { stars: grade.stars },
    })
    : (hasAnyFragment ? (buildMinorExpertFallback(feature) ?? PLACEHOLDER_EXPERT) : PLACEHOLDER_EXPERT);
  const selectedFragments = buildSelectedFragments(briefFrag, standardFrag, expertFrag);

  // Cell with no fragment matches at all becomes 'na'.
  if (!hasAnyFragment) {
    const minorFallback = buildMinorFallbackCell(feature, category, period, periodLabel, grade, readerAgeBand);
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
  periodLabelOverride?: string,
  fragmentSelection?: Pick<SelectionContext, 'preferGatingDimensions'>,
  fortuneElementOverride?: ElementCode | null,
  readerAgeBand?: FeatureVector['ageBand'],
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
    feature,
    seedKey,
    periodLabel,
    feature.yongshinElement,
    feature.heeshinElement,
    feature.gishinElement,
    fortuneElement,
    fragmentSelection,
    overallGrade,
    readerAgeBand,
  );

  const byCategory = {} as Record<TieredCategoryId, TieredFortune>;
  for (const cat of CATEGORY_ORDER) {
    const categoryGrade = gradeCategoryCell(cat, fortuneElement, feature);
    byCategory[cat] = buildCell(
      cat,
      period,
      registry,
      feature,
      seedKey,
      periodLabel,
      feature.yongshinElement,
      feature.heeshinElement,
      feature.gishinElement,
      fortuneElement,
      fragmentSelection,
      categoryGrade,
      readerAgeBand,
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
  registry: FragmentRegistry,
  feature: FeatureVector,
  seedKey: string,
  targetDate: Date,
  readerAgeBand?: FeatureVector['ageBand'],
): AgeBandScopedFortunes {
  const fortuneElement = lifeFortuneElementForAge(saju, band.representativeAge) ?? feature.dayMasterElement;
  const scoped = buildPeriodScoped(
    'life',
    registry,
    feature,
    seedKey,
    targetDate,
    band.label,
    { preferGatingDimensions: ['agePhase', 'ageBand'] },
    fortuneElement,
    readerAgeBand,
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

function buildLifeByAgeBand(
  saju: SajuSummary,
  birth: BirthInfo,
  targetDate: Date,
  registry: FragmentRegistry,
  seedKey: string,
  readerAgeBand?: FeatureVector['ageBand'],
): Record<TieredLifeStageBand, AgeBandScopedFortunes> {
  const byAgeBand = {} as Record<TieredLifeStageBand, AgeBandScopedFortunes>;
  for (const band of LIFE_STAGE_BANDS) {
    const feature = buildFeatureVectorForAge(saju, birth, targetDate, band.representativeAge);
    byAgeBand[band.key] = buildAgeBandScoped(saju, band, registry, feature, seedKey, targetDate, readerAgeBand);
  }
  return byAgeBand;
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
    const scoped = buildPeriodScoped(period, registry, feature, seedKey, targetDate);
    periods[period] = period === 'life'
      ? { ...scoped, byAgeBand: buildLifeByAgeBand(saju, birth, targetDate, registry, seedKey, feature.ageBand) }
      : scoped;
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

  const matrix: FortuneTieredMatrix = {
    schemaVersion: 'spring-ts.tiered-matrix.v1',
    periods,
    glossary,
    ...(namingEvidence ? { namingEvidence } : {}),
    meta,
  };

  return feature.ageBand === '0-9' || feature.ageBand === '10-19'
    ? sanitizeTieredMatrixForMinorAudience(matrix)
    : matrix;
}
